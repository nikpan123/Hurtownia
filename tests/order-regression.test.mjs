import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {packageQuote,boundaryQuantities,runOrderRegression} from '../api-tests/order-regression.mjs';
import {validateShippingProfile,withShippingConfiguration,restoreShippingConfiguration} from '../api-tests/shipping-cms.mjs';
const profile={singlePackageWeight:8000,priceIsNet:true,taxPercent:5,weightRanges:[{from:0,to:8000,priceMinor:1500},{from:8001,to:9999999,priceMinor:1000}]};
const temp=()=>mkdtemp(path.join(os.tmpdir(),'hurt-regression-'));
test('Paczki: granice 8000/8001 oraz 16000/16001, ceny netto i brutto',()=>{
  assert.deepEqual(packageQuote(8000,profile),{shipmentPackageQuantity:1,shippingTotal:1575,shippingTotalNet:1500});
  assert.deepEqual(packageQuote(8001,profile),{shipmentPackageQuantity:2,shippingTotal:2100,shippingTotalNet:2000});
  assert.equal(packageQuote(16000,profile).shipmentPackageQuantity,2);assert.equal(packageQuote(16001,profile).shipmentPackageQuantity,3);
  assert.deepEqual(packageQuote(8001,{...profile,priceIsNet:false}),{shipmentPackageQuantity:2,shippingTotal:2000,shippingTotalNet:1905});
  assert(boundaryQuantities(210,profile).includes(38));assert(boundaryQuantities(210,profile).includes(39));
  assert.throws(()=>packageQuote(-1,profile));assert.throws(()=>validateShippingProfile({...profile,weightRanges:[{from:0,to:10,priceMinor:10},{from:10,to:20,priceMinor:10}]}));
});
test('CMS przywraca konfigurację po błędzie i anulowaniu; dziennik po przerwaniu pozwala odzyskać stan',async()=>{
  for(const cancelled of [false,true]){
    let current=structuredClone(profile);const writes=[];const adapter={read:async()=>structuredClone(current),write:async p=>{writes.push(p);current=structuredClone(p);},close:async()=>{}};
    const journalFile=path.join(await temp(),'restore.json');const signal=new AbortController();
    await assert.rejects(()=>withShippingConfiguration({profile:{...profile,singlePackageWeight:1000},adapter,journalFile,signal:signal.signal},async()=>{if(cancelled){signal.abort();signal.signal.throwIfAborted();}throw new Error('awaria testu');}));
    assert.deepEqual(current,profile);assert.equal(writes.length,2);await assert.rejects(()=>access(journalFile));
  }
  const journalFile=path.join(await temp(),'restore.json');let current={...profile,singlePackageWeight:1000};await writeFile(journalFile,JSON.stringify({original:profile,applied:current}));await restoreShippingConfiguration({journalFile,adapter:{read:async()=>current,write:async p=>current=p,close:async()=>{}}});assert.deepEqual(current,profile);
});
test('Istniejący dziennik i obca zmiana CMS nie są nadpisywane',async()=>{
  const journalFile=path.join(await temp(),'restore.json');await writeFile(journalFile,'existing');let writes=0;
  await assert.rejects(()=>withShippingConfiguration({profile, journalFile,adapter:{read:async()=>profile,write:async()=>writes++,close:async()=>{}}},async()=>{}),/niedokończone/);assert.equal(writes,0);assert.equal(await readFile(journalFile,'utf8'),'existing');
  const file=path.join(await temp(),'restore.json');let current=profile;
  await assert.rejects(()=>withShippingConfiguration({profile:{...profile,singlePackageWeight:1000},journalFile:file,adapter:{read:async()=>current,write:async p=>current=p,close:async()=>{}}},async()=>{current={...profile,singlePackageWeight:1234};throw new Error('awaria');}),/zmieniona poza testem/);assert.equal(current.singlePackageWeight,1234);await access(file);
});
function mock({badPackage=false,authInsteadOfValidation=false,emptyRead500=false}={}){
  let serial=0;const carts=new Map(),calls=[];
  const response=(b,status=200)=>new Response(JSON.stringify(b),{status,headers:{'content-type':'application/json'}});
  const fetchImpl=async(url,opts)=>{
    const endpoint=new URL(url).pathname.replace('/api/v2/','');const body=opts.body?JSON.parse(opts.body):null;calls.push({endpoint,method:opts.method});
    if(endpoint==='shop/authentication-token')return response({token:'private-login-token'});
    if(endpoint==='shop/orders'){const token='private-cart-'+(++serial);carts.set(token,{id:serial,tokenValue:token,items:[],payment:null,shipping:null});return response({id:serial,tokenValue:token},201);}
    const token=endpoint.startsWith('wholesale/checkout-step-two/')?endpoint.split('/')[2]:endpoint.split('/')[2];const c=carts.get(token);assert(c,'Koszyk istnieje');
    const order=()=>{const items=c.items.map(i=>({...i,unitPrice:1050,unitPriceNet:1000,discountedUnitPriceNet:c.payment?900:1000,totalNetSalesAfterDiscount:(c.payment?900:1000)*i.quantity,total:(c.payment?945:1050)*i.quantity,rebatePercent:c.payment?10:0}));const weight=items.reduce((s,i)=>s+i.quantity*210,0),packages=c.shipping==='gls_wholesale'?Math.ceil(weight/8000):0,shippingTotalNet=packages*(weight<=8000?1500:1000);return {id:c.id,tokenValue:c.tokenValue,items,itemsTotal:items.reduce((s,i)=>s+i.total,0),total:items.reduce((s,i)=>s+i.total,0)+shippingTotalNet*1.05,totalNet:items.reduce((s,i)=>s+i.totalNetSalesAfterDiscount,0)+shippingTotalNet,shippingTotal:shippingTotalNet*1.05,shippingTotalNet,shipmentPackageQuantity:packages+(badPackage&&c.shipping==='gls_wholesale'?1:0),payments:c.payment?[{method:{code:c.payment}}]:[],shipments:c.shipping?[{method:{code:c.shipping}}]:[]};};
    if(endpoint.endsWith('/payments'))return response([{code:'payment',name:'Test',rebatePercent:10,orderItemTotal:order().items.reduce((s,i)=>s+i.totalNetSalesAfterDiscount,0)}]);
    if(endpoint.endsWith('/payment-method')){if(body.paymentMethodCode!=='payment')return response({},422);c.payment=body.paymentMethodCode;return response({});}
    if(endpoint.startsWith('wholesale/checkout-step-two/')){if(opts.method==='GET')return response({shippingMethods:[{code:'gls_wholesale'},{code:'pickup'}]});if(body.shippingAddress?.city===''||!['gls_wholesale','pickup'].includes(body.shippingMethodCode))return response({},422);c.shipping=body.shippingMethodCode;return response({});}
    if(endpoint.endsWith('/items/bulk')){if(body.items.some(i=>i.productVariant.startsWith('qa-nonexistent')))return response({},422);for(const i of body.items){const found=c.items.find(x=>x.product.code===i.productVariant);if(found)found.quantity+=i.quantity;else c.items.push({id:c.items.length+1,product:{code:i.productVariant},quantity:i.quantity});}return response({},201);}
    if(endpoint.includes('/items/')){const id=Number(endpoint.split('/').at(-1));if(opts.method==='DELETE'){c.items=c.items.filter(i=>i.id!==id);return response({});}if(!Number.isInteger(body.quantity)||body.quantity<=0)return response({},authInsteadOfValidation?401:422);c.items.find(i=>i.id===id).quantity=body.quantity;return response({});}
    if(endpoint.endsWith('/complete')&&c.items.length===0)return response({},422);
    if(opts.method==='GET'&&endpoint.startsWith('shop/orders/')&&c.items.length===0&&emptyRead500)return response({message:'Missing shipment'},500);
    return response(order());
  };return {fetchImpl,calls};
}
const settings={groups:{pozostale:[{productVariant:'p1'},{productVariant:'p2'}],adamada:[{productVariant:'a1'},{productVariant:'a2'}]},quantities:[2,6,1],invalidQuantities:[-1,0,1.5],adamadaRebatePercent:10,paymentRebates:{payment:10},maxCombinations:8,nonPackageShippingCodes:['pickup'],validationStatuses:{quantity:[422],product:[422],payment:[422],shipping:[422],complete:[422]},packages:{shippingCode:'gls_wholesale',product:{productVariant:'p1',unitWeightGrams:210},calculator:profile,quantities:[38,39,77]}};
const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:11111/api/v2',scenario:{shippingAddress:{},billingAddress:{},expectations:{paymentQuoteTotalBasis:'net'}}};
test('Macierz używa osobnych koszyków, pobiera dostawy po płatności i nie finalizuje domyślnie',async()=>{
  const m=mock();const r=await runOrderRegression(config,{email:'private-email',password:'private-password',testsToken:'private-tests-token'},{...m,settings,allowLocal:true,directory:await temp()});assert.equal(r.report.status,'INCOMPLETE',JSON.stringify(r.report.tests.filter(t=>t.status==='FAIL')));assert.equal(r.report.tests.filter(t=>t.status==='FAIL').length,0);assert.equal(r.report.tables[0].rows.length,4);assert.equal(new Set(r.report.tables[0].rows.map(row=>row[1])).size,4);assert(!m.calls.some(c=>c.endpoint.endsWith('/complete')));const saved=await readFile(path.join(r.directory,'raport.json'),'utf8');assert(!saved.includes('private-'));
});
test('Błędna liczba paczek i 401 zamiast walidacji powodują FAIL',async()=>{
  for(const mode of [{badPackage:true},{authInsteadOfValidation:true}]){const r=await runOrderRegression(config,{email:'e',password:'p',testsToken:'token'},{...mock(mode),settings,allowLocal:true,directory:await temp()});assert.equal(r.report.status,'FAIL');}
});


test('Błąd GET pustego koszyka nie blokuje osobnej próby PATCH complete i niezmienność nie jest pozornie zaliczona',async()=>{
  const m=mock({emptyRead500:true});
  const r=await runOrderRegression(config,{email:'e',password:'p',testsToken:'token'},{...m,settings,allowLocal:true,complete:true,directory:await temp()});
  const read=r.report.tests.find(t=>t.name==='Pusty koszyk: odczyt przed zatwierdzeniem');
  const rejection=r.report.tests.find(t=>t.name==='Pusty koszyk nie może zostać zatwierdzony');
  assert.equal(read.status,'FAIL');assert.equal(rejection.status,'PASS',rejection.detail);
  assert(rejection.evidence.requests.some(q=>q.method==='PATCH'&&q.endpoint.endsWith('/complete')&&q.status===422));
  assert.equal(r.report.tests.find(t=>t.name==='Pusty koszyk: niezmienność po odrzuceniu').status,'SKIP');
});
