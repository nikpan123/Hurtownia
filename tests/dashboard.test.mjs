import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createDashboardServer,safeReportPath} from '../dashboard/server.mjs';
import {browserLaunchOptions} from '../api-tests/browser-options.mjs';

test('Debugger #36944: wyszukiwanie 1 i 6 sztuk, pełny zestaw i pojedyncze przypadki',async()=>{
 let called;
 const server=createDashboardServer({runSuite:async body=>{called=body;return {report:{status:'PASS'},directory:'raporty-api/rounding-debugger-mock'};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const catalog=await(await fetch(base+'/api/debugger/catalog')).json(),cases=catalog.catalog.filter(c=>c.suite==='redmine-36944');
  const state=await(await fetch(base+'/api/state')).json();assert(!state.suites.some(s=>s.id==='rounding'));assert(state.suites.some(s=>s.id==='redmine-36944'));
  const html=await(await fetch(base)).text(),uiToken=html.match(/name="ui-token" content="([^"]+)"/)[1];assert(!html.includes('data-suite="rounding"'));assert(html.includes('data-suite="redmine-36944"'));
  const obsolete=await fetch(base+'/api/run',{method:'POST',headers:{origin:base,'content-type':'application/json','x-ui-token':uiToken},body:JSON.stringify({suite:'rounding'})});assert.equal(obsolete.status,400);assert.equal(called,undefined);
  assert.equal(cases.length,3);assert(cases.every(c=>c.title.includes('1 i 6 sztuk')&&c.mode==='api'));
  assert.deepEqual(cases.find(c=>c.id==='HURT-36944').caseIds,['HURT-36944-01','HURT-36944-02']);
  assert.deepEqual(cases.find(c=>c.id==='HURT-36944-02').caseIds,['HURT-36944-02']);
  const result=await fetch(base+'/api/debugger/start',{method:'POST',headers:{origin:base,'content-type':'application/json','x-debugger-token':catalog.token},body:JSON.stringify({id:'HURT-36944'})});
  assert.equal(result.status,202);assert.equal(called.suite,'redmine-36944');assert.equal(called.debugger,true);assert.deepEqual(called.caseIds,['HURT-36944-01','HURT-36944-02']);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Debugger udostępnia #36618 jako cały zestaw i 16 przypadków oraz uruchamia właściwy moduł',async()=>{
 let called;
 const server=createDashboardServer({runSuite:async body=>{called=body;return {report:{status:'PASS'},directory:'raporty-api/package-debugger-mock'};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const catalog=await(await fetch(base+'/api/debugger/catalog')).json();
  const packages=catalog.catalog.filter(c=>c.suite==='redmine-36618');assert.equal(packages.length,17);
  assert(packages.every(c=>c.title.includes('#36618 — liczba paczek')));
  assert.deepEqual(packages.find(c=>c.id==='HURT-36618-T04').caseIds,['T04']);
  assert.equal(packages.find(c=>c.id==='HURT-36618').caseIds.length,16);
  const full=catalog.catalog.find(c=>c.id==='HURT-36618-complete');assert.equal(full.suite,'redmine-36618-complete');assert.equal(full.caseIds.length,16);assert(full.description.includes('8 zamówień'));
  const result=await fetch(base+'/api/debugger/start',{method:'POST',headers:{origin:base,'content-type':'application/json','x-debugger-token':catalog.token},body:JSON.stringify({id:'HURT-36618-T01'})});
  assert.equal(result.status,202);assert.equal(called.suite,'redmine-36618');assert.deepEqual(called.caseIds,['T01']);assert.equal(called.debugger,true);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('#36618 jest widoczny, ma dwa warianty i przekazuje wybór przypadków',async()=>{
 const calls=[];
 const server=createDashboardServer({runSuite:async body=>{calls.push(body);return {report:{status:'PASS'},directory:'raporty-api/packages-ui-mock'};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const html=await(await fetch(base)).text(),token=html.match(/name="ui-token" content="([^"]+)"/)[1];
  assert(html.includes('data-suite="redmine-36618"'));assert(html.includes('data-suite="redmine-36618-complete"'));
  const state=await(await fetch(base+'/api/state')).json();
  assert(state.suites.some(s=>s.id==='redmine-36618-complete'));
  const catalog=await(await fetch(base+'/api/scenarios')).json();
  assert.equal(catalog.cases.filter(c=>c.id.startsWith('HURT-36618-')).length,16);
  const documentation=await(await fetch(base+'/api/documentation')).json();assert(documentation.html.includes('#36618'));
  const post=body=>fetch(base+'/api/run',{method:'POST',headers:{origin:base,'x-ui-token':token,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({suite:'redmine-36618',caseIds:['T99']})).status,400);
  for(const suite of ['redmine-36618','redmine-36618-complete']){
   assert.equal((await post({suite,caseIds:['T04'],verifyDatabase:true})).status,202);
   assert.deepEqual(calls.at(-1),{suite,caseIds:['T04'],verifyDatabase:true});
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Panel przekazuje podgląd do modułów tylko w wybranym przebiegu i odrzuca błędne tempo',async()=>{
 const called=[],original=process.env.HURT_BROWSER_PREVIEW;
 const server=createDashboardServer({runSuite:async(body,vars)=>{called.push(browserLaunchOptions(vars));return {report:{status:'PASS'},directory:'raporty-api/preview-mock'};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const html=await(await fetch(base)).text(),token=html.match(/name="ui-token" content="([^"]+)"/)[1];
  const post=body=>fetch(base+'/api/run',{method:'POST',headers:{origin:base,'x-ui-token':token,'content-type':'application/json'},body:JSON.stringify(body)});
  const invalid=await post({suite:'descriptions-web',browserPreview:{enabled:true,slowMoMs:-1}});assert.equal(invalid.status,400);assert.equal(called.length,0);
  const first=await post({suite:'descriptions-all',browserPreview:{enabled:true,slowMoMs:750}});assert.equal(first.status,202);const job=await first.json();assert.deepEqual(job.browserPreview,{enabled:true,slowMoMs:750});assert.deepEqual(called[0],{channel:process.env.BROWSER_CHANNEL??'msedge',headless:false,slowMo:750});
  const second=await post({suite:'descriptions-web'});assert.equal(second.status,202);assert.equal(called[1].headless,true);assert.equal(called[1].slowMo,0);assert.equal(process.env.HURT_BROWSER_PREVIEW,original);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Nieudane przywracanie CMS pozostaje FAIL także po zatrzymaniu testu przez użytkownika',async()=>{
  let finish;const ended=new Promise(resolve=>finish=resolve);
  const server=createDashboardServer({runSuite:async(body,vars,{signal})=>{
    await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    finish();return {report:{status:'FAIL',restorationFailed:true},directory:'raporty-api/restore-mock'};
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    const html=await(await fetch(base)).text();assert(html.includes('data-suite="descriptions-cms"'));const token=html.match(/name="ui-token" content="([^"]+)"/)[1];
    const post=(url,body)=>fetch(base+url,{method:'POST',headers:{origin:base,'x-ui-token':token,'content-type':'application/json'},body:JSON.stringify(body)});
    const response=await post('/api/run',{suite:'descriptions-cms'});assert.equal(response.status,202);const job=await response.json();
    assert.equal((await post('/api/stop',{id:job.id})).status,200);await ended;
    const state=await(await fetch(base+'/api/state')).json();assert.equal(state.jobs.find(j=>j.id===job.id).status,'FAIL');
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});

test('Panel przekazuje wybrane przypadki i odrzuca nieznane lub z innego zestawu',async()=>{
 let called;const server=createDashboardServer({runSuite:async body=>{called=body;return {report:{status:'PASS'},directory:'raporty-api/selection-mock'};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const html=await(await fetch(base)).text();const token=html.match(/name="ui-token" content="([^"]+)"/)[1];
 const post=body=>fetch(base+'/api/run',{method:'POST',headers:{origin:base,'x-ui-token':token,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post({suite:'redmine-37162',caseIds:['HURT-FEAT-36926-01']})).status,400);
 assert.equal((await post({suite:'catalog',caseIds:['HURT-BUG-37162-02']})).status,400);
 assert.equal((await post({suite:'redmine-37162',caseIds:[]})).status,400);
 assert.equal(called,undefined);
 assert.equal((await post({suite:'redmine-37162',caseIds:['HURT-BUG-37162-02']})).status,202);
 assert.deepEqual(called.caseIds,['HURT-BUG-37162-02']);
 }finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});}
});

test('Raporty można czytać tylko z dozwolonego katalogu i rozszerzeń',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'hurt-ui-'));await mkdir(path.join(root,'run'));await writeFile(path.join(root,'run','raport.json'),'{}');await writeFile(path.join(root,'.env'),'secret');
  assert.equal(await safeReportPath(root,['run','raport.json']),path.join(root,'run','raport.json'));
  for(const segments of [['..','.env'],['run/../.env'],['.env']])await assert.rejects(()=>safeReportPath(root,segments));
});
test('Panel serwuje UI i odrzuca żądania zmiany bez tokenu i poprawnego Origin',async()=>{
  const server=createDashboardServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const page=await fetch(base);assert.equal(page.status,200);const html=await page.text();assert(html.includes('Centrum testów'));assert(!html.includes('__UI_TOKEN__'));
    const rejected=await fetch(base+'/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({suite:'order'})});assert.equal(rejected.status,403);
    const state=await (await fetch(base+'/api/state')).json();assert(Array.isArray(state.reports));assert.equal(state.settings.testEnvironmentEnabled,false);assert(!JSON.stringify(state).includes('SYLIUS_ADMIN_PASSWORD='));
  } finally {await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});

test('Panel uruchamia wybrany zestaw bez dodatkowego procesu, blokuje drugi i zatrzymuje pierwszy',async()=>{
  let called;let finished;
  const ended=new Promise(resolve=>finished=resolve);
  const server=createDashboardServer({runSuite:async(body,vars,{signal,onProgress})=>{
    called=body;onProgress('Sprawdzam katalog');
    await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    finished();return {report:{status:'FAIL'},directory:'raporty-api/test'};
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try {
    const html=await (await fetch(base)).text();const token=html.match(/name="ui-token" content="([^"]+)"/)[1];
    const post=(url,body)=>fetch(base+url,{method:'POST',headers:{origin:base,'x-ui-token':token,'content-type':'application/json'},body:JSON.stringify(body)});
    const launched=await post('/api/run',{suite:'catalog'});assert.equal(launched.status,202);const job=await launched.json();
    assert.equal(called.suite,'catalog');assert.equal((await post('/api/run',{suite:'order'})).status,409);
    assert.equal((await post('/api/stop',{id:job.id})).status,200);await ended;
    const state=await (await fetch(base+'/api/state')).json();assert.equal(state.jobs[0].status,'CANCELLED');assert(state.jobs[0].log.includes('Sprawdzam katalog'));
  } finally {await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
