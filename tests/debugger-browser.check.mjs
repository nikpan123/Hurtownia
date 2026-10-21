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
  hub.last.event({kind:'finish',stepId:'step',status:'passed'});await hub.finish('ui-one','PASS',{report:'/report/offline/'});
  await page.locator('#report').waitFor();
  for(const theme of ['light','dark']){await page.context().addCookies([{name:'qa_ui_theme',value:theme,url:base}]);await until(async()=>await page.locator('html').getAttribute('data-theme')===theme);for(const width of [1600,1000,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' '+width);}}
 }finally{await browser.close();hub.last?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
