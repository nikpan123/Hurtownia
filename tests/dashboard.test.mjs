import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createDashboardServer,safeReportPath} from '../dashboard/server.mjs';

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
