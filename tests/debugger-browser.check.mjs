import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {DebugHub} from '../dashboard/debugger/hub.mjs';
import {chromium} from 'playwright';
async function until(check){const end=Date.now()+8000;while(!await check()){if(Date.now()>end)throw new Error('Timeout debuggera');await new Promise(r=>setTimeout(r,20));}}

test('Debugger UI: konfiguracja, pojedynczy start, F10, raport i oba motywy',async()=>{
 const hub=new DebugHub({project:'Test',environment:()=> 'offline',catalog:()=>[{id:'one',title:'Przykładowy przypadek',mode:'ui',description:'Lokalny test interfejsu bez połączenia z aplikacją.'}],start:()=>{const run=hub.create({id:'ui-one',title:'Przykładowy przypadek',mode:'ui',environment:'offline'});run.event({kind:'start',stepId:'step',title:'Otwórz formularz'});run.wait('step');},stop:()=>{}});
 const server=http.createServer(async(req,res)=>{await hub.handle(req,res,new URL(req.url,'http://'+req.headers.host));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.DEBUGGER_CHANNEL?{channel:process.env.DEBUGGER_CHANNEL}:{})});
 try{
  const page=await browser.newPage();await page.goto(base+'/debugger/');await page.selectOption('#tests','one');assert.equal(hub.last,null);
  page.once('dialog',d=>d.accept());await page.locator('#start').click();await page.locator('#session').waitFor();await until(()=>hub.last?.snapshot().steps[0]?.ready);
  await until(async()=>!await page.locator('#next').isDisabled());await page.keyboard.press('F10');await until(()=>hub.last.steps[0].status==='running');
  await page.keyboard.press('F10');assert.equal(hub.last.steps.length,1);
  hub.last.event({kind:'finish',stepId:'step',status:'passed'});
  // Newest rows appear first, without changing chronological execution numbers or JSON.
  await page.setViewportSize({width:1600,height:1000});
  const addStep = n => {hub.last.event({kind:'start',stepId:'order-'+n,title:'Etap '+n,automatic:true});hub.last.steps.at(-1).planned={method:'GET',path:'/offline/'+n};hub.last.event({kind:'finish',stepId:'order-'+n,status:'passed'});};
  for(let n=2;n<=40;n++)addStep(n);
  await until(async()=>await page.locator('#steps>li').count()===40);
  assert.match(await page.locator('#steps>li').first().innerText(),/^40\. Etap 40/);
  assert.match(await page.locator('#steps>li').last().innerText(),/^1\. Otwórz formularz/);
  assert.equal(hub.last.snapshot().steps[0].id,'step');
  await page.locator('#steps').evaluate(list=>{list.closest('aside').scrollTop=0;});
  addStep(41);
  await until(async()=>await page.locator('#steps>li').count()===41);
  assert.equal(await page.locator('#steps').evaluate(list=>list.closest('aside').scrollTop),0);
  await page.locator('[data-step="order-20"] summary').click();
  const anchor=page.locator('[data-step-id="order-20"]');
  const before=await anchor.evaluate(node=>node.getBoundingClientRect().top);
  addStep(42);
  await until(async()=>await page.locator('#steps>li').count()===42);
  assert.equal(await page.locator('[data-step="order-20"]').getAttribute('open'),'');
  assert.ok(Math.abs(await anchor.evaluate(node=>node.getBoundingClientRect().top)-before)<3,'Dodanie kroku nie przesuwa czytanej starszej odpowiedzi');
  await hub.finish('ui-one','PASS',{report:'/report/offline/'});
  await page.locator('#report').waitFor();
  for(const theme of ['light','dark']){await page.context().addCookies([{name:'qa_ui_theme',value:theme,url:base}]);await until(async()=>await page.locator('html').getAttribute('data-theme')===theme);for(const width of [1600,1000,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' '+width);}}
 }finally{await browser.close();hub.last?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
