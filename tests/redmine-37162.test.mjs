import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {runShipmentRegression,shipmentCases} from '../api-tests/redmine-37162.mjs';

const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:11111/api/v2'};
const credentials={email:'qa@example.invalid',password:'secret-password',testsToken:'secret-tests'};
function mock({failureAt=0,dropItem=false,hidden500=false,loginDenied=false}={}){
 const calls=[],orders=new Map();let serial=0,adds=0;
 const fetchImpl=async(url,options)=>{
  const endpoint=new URL(url).pathname.replace('/api/v2/',''),body=options.body?JSON.parse(options.body):null;calls.push({endpoint,method:options.method,body});
  const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(endpoint==='shop/authentication-token')return response({token:'secret-login-token'},loginDenied?401:200);
  if(endpoint==='shop/orders'&&options.method==='POST'){const tokenValue='secret-cart-'+(++serial);orders.set(tokenValue,{id:serial,tokenValue,items:[]});return response(orders.get(tokenValue),201);}
  const token=endpoint.split('/')[2],order=orders.get(token);assert.ok(order,'Znany koszyk');
  if(endpoint.endsWith('/items/bulk')){
   adds++;if(adds===failureAt)return response({code:500,message:'Expected an instance of Sylius\\Component\\Shipping\\Model\\ShipmentInterface. Got: NULL'},hidden500?200:500);
   for(const item of body.items)order.items.push({product:{code:item.productVariant},quantity:item.quantity});
   if(dropItem&&order.items.length>1)order.items.pop();return response({},201);
  }
  assert.equal(options.method,'GET');return response(order);
 };return {fetchImpl,calls};
}
async function run(options,check){const directory=await mkdtemp(path.join(tmpdir(),'shipment-37162-'));try{const m=mock(options);const result=await runShipmentRegression(config,credentials,{allowLocal:true,directory,...m});await check(result,m,directory);}finally{await rm(directory,{recursive:true,force:true});}}
test('8 niezależnych koszyków, dokładny payload zgłoszenia, odczyt po każdej zmianie i brak finalizacji',async()=>run({},async({report},m,dir)=>{
 assert.equal(report.status,'PASS');assert.equal(report.tests.length,8);assert.equal(shipmentCases.length,6);
 assert.equal(m.calls.filter(x=>x.endpoint==='shop/orders').length,8);assert.equal(m.calls.filter(x=>x.endpoint.endsWith('/items/bulk')).length,10);
 assert.deepEqual(m.calls.find(x=>x.endpoint.endsWith('/items/bulk')).body,{items:[{productVariant:'m-F8P',quantity:9},{productVariant:'D414',quantity:5}]});
 assert(!m.calls.some(x=>/complete|payment|shipping|admin/.test(x.endpoint)));
 const saved=await readFile(path.join(dir,'raport.json'),'utf8');for(const secret of [...Object.values(credentials),'secret-cart-','secret-login-token'])assert(!saved.includes(secret));assert.match(await readFile(path.join(dir,'raport.html'),'utf8'),/HURT-BUG-37162-01/);
}));
test('Pojedynczy nieregularny błąd 500 nie znika po kolejnych udanych próbach',async()=>run({failureAt:2},async({report},m)=>{
 assert.equal(report.status,'FAIL');assert.equal(report.tests.filter(t=>t.status==='FAIL').length,1);assert.equal(report.tests.length,8);assert.match(report.tests.find(t=>t.status==='FAIL').detail,/ShipmentInterface/);
 assert.equal(m.calls.filter(x=>x.endpoint==='shop/orders').length,8);
}));
test('HTTP 200 z błędem 500 w JSON nie jest zaliczeniem',async()=>run({failureAt:1,hidden500:true},async({report})=>assert.equal(report.status,'FAIL')));
test('2xx bez zapisania produktu zostaje wykryte niezależnym GET',async()=>run({dropItem:true},async({report})=>assert.equal(report.status,'FAIL')));
test('Odmowa logowania daje raport FAIL bez tworzenia koszyków',async()=>run({loginDenied:true},async({report},m)=>{assert.equal(report.status,'FAIL');assert.equal(m.calls.length,1);}));

test('Wybór pojedynczego przypadku nie wykonuje pozostałych prób',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'shipment-selection-'));
 try{const m=mock();const {report}=await runShipmentRegression(config,credentials,{allowLocal:true,directory,...m,caseIds:['HURT-BUG-37162-02']});
 assert.equal(report.status,'PASS');assert.deepEqual(report.tests.map(t=>t.id),['HURT-BUG-37162-02']);assert.equal(m.calls.filter(x=>x.endpoint==='shop/orders').length,1);
 }finally{await rm(directory,{recursive:true,force:true});}
});
