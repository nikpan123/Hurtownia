import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {DebugHub} from '../dashboard/debugger/hub.mjs';
async function until(check){const end=Date.now()+8000;while(!check()){if(Date.now()>end)throw new Error('Timeout debuggera');await new Promise(r=>setTimeout(r,20));}}

test('Debugger: uprawnienia lokalnego panelu, pojedyncze kroki, automatyzacja i stop',async()=>{
 let writes=0,work;
 const hub=new DebugHub({project:'Test',catalog:()=>[{id:'one',title:'Test',mode:'api'}],environment:()=> 'Lokalne',start:()=>{const run=hub.create({id:'run-one',title:'Test',mode:'api',environment:'offline'});work=(async()=>{await run.operation('Pierwsza operacja',async()=>{writes++;return{status:200,data:{token:'hidden',quantity:3}};},{request:{method:'POST',path:'/items',body:{quantity:3}}});await run.operation('Druga operacja',async()=>{writes++;return{status:200,data:{}};});await hub.finish(run.id,'PASS');})().catch(async()=>{await hub.finish(run.id,'STOPPED');});},stop:()=>{}});
 const server=http.createServer(async(req,res)=>{await hub.handle(req,res,new URL(req.url,'http://'+req.headers.host));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const post=(action,body,token=hub.token)=>fetch(base+'/api/debugger/'+action,{method:'POST',headers:{origin:base,'Content-Type':'application/json','x-debugger-token':token},body:JSON.stringify(body)});
 try{
  assert.equal((await post('start',{id:'one'},'wrong')).status,403);assert.equal(writes,0);
  assert.equal((await post('start',{id:'missing'})).status,400);
  assert.equal((await post('start',{id:'one'})).status,202);await until(()=>hub.last.snapshot().steps[0]?.ready);assert.equal(writes,0);
  const state=await(await fetch(base+'/api/debugger/state')).json();assert.ok(!JSON.stringify(state).includes(hub.last.key));
  const step=state.run.steps[0].id;assert.equal((await post('next',{runId:'run-one',stepId:step})).status,200);await until(()=>hub.last.snapshot().steps[1]?.ready);assert.equal(writes,1);
  assert.equal((await post('next',{runId:'run-one',stepId:step})).status,400);
  assert.equal((await post('stop',{runId:'run-one'})).status,200);await work;assert.equal(writes,1);assert.equal(hub.last.status,'STOPPED');
  assert.ok(!JSON.stringify(hub.last.public()).includes('"token":"hidden"'));
 }finally{hub.last?.close();if(work)await work;server.closeAllConnections();await new Promise(r=>server.close(r));}
});

