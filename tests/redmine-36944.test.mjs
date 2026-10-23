import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runRounding36944,roundingCases} from '../api-tests/redmine-36944.mjs';
import {DebugSession} from '../dashboard/debugger/hub.mjs';
const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2'};
const credentials={email:'qa@example.invalid',password:'secret-pass',testsToken:'secret-token'};
const settings={baseGrossMinor:1840,baseNetMinor:1752,rebatePercent:23,WHOLESALE:{productVariant:'5lp-1'}};
function mock({wrong=false,no23=false,serverError=false,wrongSum=false}={}){
 const calls=[],orders=new Map();let serial=0;
 return {calls,fetchImpl:async(url,args)=>{
  const endpoint=new URL(url).pathname.replace('/api/v2/',''),channel=args.headers['X-Api-Channel'],body=args.body?JSON.parse(args.body):null;calls.push({endpoint,channel,body,method:args.method});
  const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(endpoint==='shop/authentication-token')return response({token:'private-jwt'});
  if(endpoint==='shop/orders'){const id=++serial,token='private-cart-'+id;orders.set(token,{id,quantity:1,channel,paid:false});return response({id,tokenValue:token},201);}
  const token=endpoint.split('/')[2],o=orders.get(token);assert(o,'Nieoczekiwany endpoint '+endpoint);assert.equal(channel,o.channel,'Błędny kanał żądania');
  if(endpoint.endsWith('/items/bulk'))return response({},201);
  if(endpoint.endsWith('/payments'))return response([{code:'cash_on_delivery',rebatePercent:no23?50:23}]);
  if(endpoint.endsWith('/payment-method')){o.paid=true;return response({});}
  if(args.method==='PATCH'){o.quantity=body.quantity;return response({});}
  if(serverError)return response({message:'Awaria'},500);
  const discounted=o.paid||o.channel==='RETAIL',total=discounted?(o.quantity===6?(wrong?8502:8499):1416):1840;
  return response({id:o.id,itemsTotal:wrongSum?total+1:total,shippingTotal:2000,total:total+2000,orderPromotionTotal:o.channel==='RETAIL'?-424:0,items:[{id:o.id*10,quantity:o.quantity,unitPrice:1840,originalUnitPrice:1840,unitPriceNet:1752,taxRate:0.05,discountedUnitPriceNet:wrong?1350:1349,total,rebatePercent:o.channel==='WHOLESALE'&&o.paid?23:0}]});
 }};
}
async function run(more,fn){const directory=await mkdtemp(path.join(tmpdir(),'rounding36944-'));try{const m=mock(more.mock);const result=await runRounding36944(config,credentials,{settings,allowLocal:true,vars:{},directory,...m,...more});await fn(result,m);}finally{await rm(directory,{recursive:true,force:true});}}
test('#36944: dwa niezależne koszyki wyłącznie API WHOLESALE, bez finalizacji',()=>run({},async({report,directory},m)=>{
 assert.equal(report.status,'PASS');assert.equal(report.attempts.length,2);assert.equal(new Set(report.attempts.map(a=>a.cartId)).size,2);assert.equal(report.tables[0].rows.length,2);
 assert.equal(m.calls.filter(r=>r.endpoint.endsWith('/payment-method')).length,2);assert(!m.calls.some(r=>r.endpoint.includes('complete')));
 assert(report.tests.filter(t=>t.scenarioIds).every(t=>t.evidence.requests.length>0));
 assert(report.tests.filter(t=>t.scenarioIds).every(t=>t.evidence.observations.length===1));
 const html=await readFile(path.join(directory,'raport.html'),'utf8');assert(html.includes('/?selection='));assert(html.includes('redmine-36944'));assert(html.includes('Wartość 8502 gr oznacza różnicę +3 gr'));
}));
test('#36944: 13,50 i 85,02 wykryte jako dwa FAIL z widoczną różnicą',()=>run({mock:{wrong:true}},async({report})=>{
 assert.equal(report.tests.filter(t=>t.status==='FAIL').length,2);assert.deepEqual(report.tables[0].rows.map(r=>r[6]),[1,3]);
}));
test('#36944: brak rabatu WHOLESALE daje SKIP, bez udawanego PASS',()=>run({mock:{no23:true}},async({report},m)=>{
 assert.equal(report.status,'INCOMPLETE');assert.equal(report.tests.filter(t=>t.status==='SKIP').length,2);assert.equal(report.tables[0].rows.length,0);assert.equal(m.calls.filter(r=>r.endpoint==='shop/orders').length,2);assert(!m.calls.some(r=>r.endpoint.endsWith('/payment-method')));
}));
test('#36944: błąd HTTP to FAIL, a nie brak danych do testu',()=>run({mock:{serverError:true}},async({report})=>{
 assert.equal(report.status,'FAIL');assert.equal(report.tests.filter(t=>t.status==='FAIL').length,2);
}));
test('#36944: zgodny wzorzec nie ukrywa błędnej sumy koszyka',()=>run({mock:{wrongSum:true}},async({report})=>assert.equal(report.tests.filter(t=>t.status==='FAIL').length,2)));
test('#36944: można wybrać jeden przypadek i użyć osobnego konta, bez zapisu sekretów',()=>run({caseIds:[roundingCases[0].id],vars:{HURT_ROUNDING_EMAIL:'rounding@example.invalid'}},async({report,directory},m)=>{
 assert.equal(report.attempts.length,1);assert.equal(m.calls[0].body.email,'rounding@example.invalid');const saved=await readFile(path.join(directory,'raport.json'),'utf8');for(const s of ['secret-pass','secret-token','private-jwt','private-cart-','rounding@example.invalid'])assert(!saved.includes(s));
}));
test('#36944: ignoruje historyczne ustawienia RETAIL i nie wywołuje CMS',()=>run({settings:{...settings,RETAIL:{preparePromotion289:true,createQaProduct:true}},promotionAdapter:new Proxy({}, {get(){throw Error('CMS nie może być wywołany');}})},async({report},m)=>{
 assert.equal(report.status,'PASS');assert.equal(report.apiOnlyWholesale,true);assert.equal(report.reference.RETAIL,undefined);
 assert.equal(roundingCases.length,2);assert(m.calls.every(c=>c.channel==='WHOLESALE'));
 assert(!report.tests.some(t=>/RETAIL|przygotowanie promocji|przywrócenie promocji/.test(t.name)));
 assert.equal(report.tables.length,1);assert(!report.qaProduct&&!report.promotionPreparation);
}));
test('#36944 debugger: pauza przed żądaniami i oceną kwot, pełne 1 i 6 sztuk bez ujawniania sekretów',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'rounding-debug-')),session=new DebugSession({id:'rounding-debug',title:'1 i 6 sztuk',mode:'api',environment:'offline'}),m=mock();
 let finished=false;
 const work=runRounding36944(config,credentials,{settings,vars:{},allowLocal:true,directory,...m,debuggerSession:session}).finally(()=>{finished=true;});
 const ready=()=>session.snapshot().steps.find(s=>s.ready);
 const until=async check=>{const end=Date.now()+5000;while(!check()){assert(Date.now()<end,'Timeout kroków');await new Promise(r=>setTimeout(r,5));}};
 try{
  await until(ready);assert.equal(m.calls.length,1);assert.equal(ready().planned.method,'POST');
  await new Promise(r=>setTimeout(r,20));assert.equal(m.calls.length,1,'Bez kliknięcia nie twórz koszyka');
  while(!finished){const step=ready();if(step)session.next(step.id);await until(()=>finished||ready()?.id!==step?.id);}
  const {report}=await work;assert.equal(report.status,'PASS');
  assert.equal(session.steps.filter(s=>s.title.includes('— sprawdź')).length,2);
  assert(session.steps.some(s=>s.title.includes('13,49 zł')));assert(session.steps.some(s=>s.title.includes('84,99 zł')));
  const quantityStep=session.steps.find(s=>s.planned?.body?.quantity===6);assert.equal(quantityStep.planned.method,'PATCH');
  assert(session.steps.every(s=>s.status==='passed'));assert(m.calls.every(c=>c.channel==='WHOLESALE'));
  const captured=JSON.stringify(session.public());for(const secret of ['private-cart-','private-jwt','secret-pass','secret-token'])assert(!captured.includes(secret));
 }finally{session.close();await work;await rm(directory,{recursive:true,force:true});}
});
