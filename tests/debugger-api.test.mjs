import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DebugSession} from '../dashboard/debugger/hub.mjs';
import {runShipmentRegression} from '../api-tests/redmine-37162.mjs';
async function until(check){const end=Date.now()+8000;while(!check()){if(Date.now()>end)throw new Error('Timeout');await new Promise(r=>setTimeout(r,15));}}
test('Rzeczywisty silnik Hurtowni: logowanie automatyczne, pauza przed zapisem, brak sekretów w krokach',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'hurt-debugger-'));
 const session=new DebugSession({id:'engine-test',title:'D414',mode:'api',environment:'offline'});
 const calls=[];let order;
 const fetchImpl=async(url,options)=>{const endpoint=new URL(url).pathname;calls.push({endpoint,method:options.method});const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
  if(endpoint.endsWith('authentication-token'))return json({token:'opaque-login-secret'});
  if(endpoint.endsWith('/shop/orders')){order={id:77,tokenValue:'opaque-cart-secret',items:[]};return json(order,201);}
  if(endpoint.endsWith('/items/bulk')){order.items=[{product:{code:'D414'},quantity:5}];return json({},201);}
  return json(order);
 };
 const work=runShipmentRegression({environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:11111/api/v2'},{email:'qa@example.invalid',password:'test-password',testsToken:'test-key'},{allowLocal:true,directory,fetchImpl,debuggerSession:session,caseIds:['HURT-BUG-37162-03']});
 try{
  const ready=()=>session.snapshot().steps.find(s=>s.ready);
  await until(()=>ready());assert.equal(calls.length,1);assert.match(calls[0].endpoint,/authentication-token/);
  session.next(ready().id);await until(()=>ready());assert.equal(calls.length,2);assert.match(ready().planned.path,/items\/bulk$/);
  assert.deepEqual(ready().planned.body,{items:[{productVariant:'D414',quantity:5}]});
  session.next(ready().id);await until(()=>ready());assert.equal(calls.length,3);assert.equal(ready().planned.method,'GET');
  session.next(ready().id);const result=await work;assert.equal(result.report.status,'PASS');assert.equal(calls.length,4);
  const captured=JSON.stringify(session.public());for(const secret of ['opaque-cart-secret','opaque-login-secret','test-password','test-key'])assert.equal(captured.includes(secret),false,secret);
 }finally{session.close();await work;}
});
