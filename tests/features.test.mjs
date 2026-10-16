import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {minorUnits,productPayload,runProductCreation,runRounding,runDescriptions} from '../api-tests/features.mjs';
const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:11111/api/v2'};
const credentials={email:'qa@example.invalid',password:'secret-password-mock',testsToken:'secret-tests-token'};
const input={code:'qa-form-1',variantCode:'qa-form-v1',name:'QA książka',slug:'qa-ksiazka',channel:'WHOLESALE',price:'18,40',originalPrice:'18.40',minimumPrice:'0'};
const fixture=(code,override)=>({code,productVariant:code,main:{name:'Główna '+code,slug:code,description:'Główny opis',shortDescription:'Główny krótki'},channels:Object.fromEntries(['WHOLESALE','RETAIL','ACADEMY'].map(channel=>[channel,{visible:true,name:override&&channel==='WHOLESALE'?'Hurt '+code:'Główna '+code,slug:override&&channel==='WHOLESALE'?'hurt-'+code:code,description:override&&channel==='WHOLESALE'?'Hurt opis':'Główny opis',shortDescription:override&&channel==='WHOLESALE'?'Hurt krótki':'Główny krótki'}]))});
const fixtures=[fixture('qa-one',false),fixture('qa-two',true)];
function mock({deny=false,wrongPrice=false,no23=false,wrongName=false}={}){
  const calls=[];const orders=new Map();let serial=0;
  const fetchImpl=async(url,options)=>{
    url=new URL(url);const endpoint=url.pathname.replace('/api/v2/',''),body=options.body?JSON.parse(options.body):null,channel=options.headers['X-Api-Channel'];calls.push({method:options.method,endpoint,body,channel});
    const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(endpoint.endsWith('authentication-token'))return response({token:'private-jwt-mock'});
    if(endpoint==='admin/products')return deny?response({message:'Access Denied.'},403):response({id:1,...body},201);
    if(endpoint==='admin/product-variants')return response({...body,channelPricings:{[channel]:{id:55,...body.channelPricings[channel]}}},201);
    if(endpoint==='shop/orders'&&options.method==='POST'){const token='private-order-'+(++serial);orders.set(token,{quantity:1,channel});return response({id:serial,tokenValue:token},201);}
    if(endpoint.startsWith('shop/products-dto-by-slug/')){const slug=endpoint.split('/').at(-1);const f=fixtures.find(f=>f.channels[channel].slug===slug);return response({...f.channels[channel],code:f.code});}
    if(endpoint==='shop/products-dto')return response({data:fixtures.map(f=>({code:f.code,...f.channels[channel]}))});
    if(endpoint.includes('/payments'))return response([{code:'cash_on_delivery',rebatePercent:no23?50:23,name:'Przy odbiorze'}]);
    if(endpoint.endsWith('/payment-method'))return response({});
    if(endpoint.startsWith('shop/orders/')){
      const token=endpoint.split('/')[2],o=orders.get(token);
      if(endpoint.endsWith('/items/bulk')){o.variant=body.items[0].productVariant;return response({},201);}
      if(options.method==='PATCH'){o.quantity=body.quantity;return response({});}
      const f=fixtures.find(f=>f.code===o.variant);const q=o.quantity;const total=q===6?(wrongPrice?8502:8499):1416*q;
      return response({id:serial,itemsTotal:total,total:total+1000,shippingTotal:1000,items:[{id:1,quantity:q,unitPrice:1840,originalUnitPrice:1840,unitPriceNet:1752,discountedUnitPriceNet:wrongPrice?1350:1349,totalNetSalesAfterDiscount:1349*q,total,rebatePercent:23,productName:wrongName?'Błędna nazwa':f?.channels[o.channel].name??'Książka'}]});
    }
    throw new Error('Nieoczekiwane żądanie '+endpoint);
  };return {calls,fetchImpl};
}
async function options(more={}){return {allowLocal:true,directory:await mkdtemp(path.join(os.tmpdir(),'hurt-feature-')),...more};}
test('Kwoty PLN są zamieniane na grosze dokładnie; formularz odrzuca obce kody i błędne kwoty',()=>{
  assert.equal(minorUnits('18,40'),1840);assert.equal(minorUnits('0.01'),1);assert.equal(productPayload(input).variant.channelPricings.WHOLESALE.minimumPrice,0);
  for(const value of ['1.005','-1','1e3','NaN',''])assert.throws(()=>minorUnits(value));
  assert.throws(()=>productPayload({...input,code:'istniejacy-produkt'}));assert.throws(()=>productPayload({...input,minimumPrice:'19'}));
});
test('Tworzenie wykonuje wyłącznie logowanie i dwa POST-y, potwierdza zapisane ceny',async()=>{
  for(const channel of ['WHOLESALE','RETAIL','ACADEMY']){
  const m=mock();const r=await runProductCreation(config,credentials,await options({...m,input:{...input,channel},adminEmail:'admin@example.invalid',adminPassword:'private-admin-pass'}));
  assert.equal(r.report.status,'PASS',JSON.stringify(r.report.tests));assert.equal(r.report.creation.state,'variant_created');
  assert.deepEqual(m.calls.map(c=>c.endpoint),['admin/authentication-token','admin/products','admin/product-variants']);
  assert.deepEqual(m.calls.slice(1).map(c=>c.channel),[channel,channel]);
  }
});
test('403 kończy tworzenie bez POST wariantu i bez testów katalogu; nie ujawnia tokenu',async()=>{
  const m=mock({deny:true});const r=await runProductCreation(config,credentials,await options({...m,input,adminEmail:'admin@example.invalid',adminPassword:'private-admin-pass'}));
  assert.equal(r.report.status,'FAIL');assert.equal(r.report.lastResponse.status,403);assert.equal(m.calls.length,3);
  assert.equal(m.calls[2].method,'GET');assert.equal(r.report.accessDiagnostic.readStatus,403);assert.match(r.report.blockedReason,/403/);
  const saved=await readFile(path.join(r.directory,'raport.json'),'utf8');for(const secret of ['private-admin-pass','private-jwt-mock',...Object.values(credentials)])assert(!saved.includes(secret));
});
const settings={productVariant:'5lp-1',baseGrossMinor:1840,baseNetMinor:1752,rebatePercent:23,quantities:[1,6],anchors:{1:{discountedUnitPriceNet:1349},6:{total:8499}}};
test('Wzorce 13,49 i 84,99 przechodzą; 13,50 i 85,02 są wykrywane w obu punktach',async()=>{
  for(const wrongPrice of [false,true]){
    const m=mock({wrongPrice});const r=await runRounding(config,credentials,await options({...m,settings}));assert.equal(r.report.status,wrongPrice?'FAIL':'PASS');
    assert.equal(r.report.tables[0].rows.length,2);assert(!m.calls.some(c=>c.endpoint.endsWith('/complete')));
    if(wrongPrice)assert.equal(r.report.tests.filter(t=>t.status==='FAIL').length,2);
  }
});
test('Brak rabatu 23% daje INCOMPLETE i nie wybiera niedostępnej płatności',async()=>{
  const m=mock({no23:true});const r=await runRounding(config,credentials,await options({...m,settings}));assert.equal(r.report.status,'INCOMPLETE');assert(r.report.blockedReason);assert(!m.calls.some(c=>c.endpoint.endsWith('/payment-method')));
});
test('Opisy sprawdzają trzy kanały i zapis productName, jawnie wskazują niesprawdzony zakres',async()=>{
  const m=mock();const r=await runDescriptions(config,credentials,await options({...m,fixtures}));assert.equal(r.report.status,'INCOMPLETE',JSON.stringify(r.report.tests.filter(t=>t.status==='FAIL')));
  assert.equal(r.report.tests.filter(t=>t.status==='PASS').length,18);assert.equal(r.report.tables[0].rows.length,6);assert(!m.calls.some(c=>c.endpoint.endsWith('/complete')));
  const saved=await readFile(path.join(r.directory,'raport.json'),'utf8');assert(!saved.includes('private-order-'));
});
test('Nieprawidłowy productName w zamówieniu nie zostaje ukryty przez poprawne DTO',async()=>{
  const m=mock({wrongName:true});const r=await runDescriptions(config,credentials,await options({...m,fixtures}));assert.equal(r.report.status,'FAIL');assert.equal(r.report.tests.filter(t=>t.name.includes('nazwa zapisana')&&t.status==='FAIL').length,6);
});
