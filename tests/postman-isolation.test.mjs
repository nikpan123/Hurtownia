import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const file=new URL('../postman/HURTOWNIA - Izolacja uzytkownikow.postman_collection.json',import.meta.url);
async function exercise({mutated=false,baseUrl,foreignStatus=404,blockedInitially=false,loginStatus=200,stopAfterIsolation=false,repeatComplete=false,restoreOnComplete=false,completionStatus=200}={}){
  const collection=JSON.parse(await readFile(file,'utf8')),values=new Map(collection.variable.map(v=>[v.key,v.value]));
  values.set('iso_email_a','a@example.invalid');values.set('iso_email_b','b@example.invalid');values.set('iso_api_password','private-"password\\withchars');values.set('iso_tests_token_a','private-tests');
  if(baseUrl)values.set('iso_base_url',baseUrl);
  if(blockedInitially){values.set('iso_setup_blocked','true');values.set('iso_setup_error','Poprzednia nieudana próba');values.set('iso_jwt_a','old-token');}
  const tests=[],sent=[];let visual;
  const before={id:100,itemsTotal:920,shippingTotal:2000,total:2920,totalNet:2781,orderPromotionTotal:-920,payments:[{method:{code:'cash_on_delivery'}}],items:[{id:1,product:{code:'5lp-1'},quantity:1,unitPrice:1840,originalUnitPrice:1840,discountedUnitPrice:920,unitPriceNet:1752,discountedUnitPriceNet:876,totalNetSalesAfterDiscount:876,total:920,rebatePercent:50}]};
  const after=structuredClone(before);if(mutated){after.itemsTotal=1600;after.total=3600;after.items[0].rebatePercent=13;after.items[0].discountedUnitPrice=1600;after.items[0].total=1600;}
  const saved={...structuredClone(restoreOnComplete?before:after),number:'30001234',checkoutState:'completed'};
  const responses={'01':{token:'private-jwt-a'},'02':{token:'private-jwt-b'},'03':{id:100,tokenValue:'private-cart-a'},'04':{},'05':[{code:'cash_on_delivery'}],'06':null,'07':{shippingMethods:[{code:'gls_wholesale'}]},'07b':{},'08':before,'09':{message:'Not found'},'10':after,'11':{number:'30001234'},'12':saved};
  let items=collection.item.filter(item=>!stopAfterIsolation||!['11','12'].includes(item.name.split(' — ')[0]));
  if(repeatComplete){const ix=items.findIndex(i=>i.name.startsWith('11 —'));items.splice(ix+1,0,items[ix]);}
  for(const [index,item]of items.entries()){
    const step=item.name.split(' — ')[0];
    const local=new Map();let skipped=false;
    const pm={collectionVariables:{get:k=>values.get(k),set:(k,v)=>values.set(k,v),unset:k=>values.delete(k)},variables:{get:k=>local.has(k)?local.get(k):values.get(k),set:(k,v)=>local.set(k,v)},info:{requestId:'new-imported-id-'+index,requestName:item.name},request:{headers:{upsert:()=>{}}},execution:{skipRequest:()=>skipped=true,setNextRequest:()=>{}},test:(name,fn)=>{try{fn();tests.push({name,status:'PASS'});}catch(error){tests.push({name,status:'FAIL',detail:error.message});}},response:{code:step==='01'?loginStatus:['03','04'].includes(step)?201:step==='06'?204:step==='09'?foreignStatus:step==='11'?completionStatus:200,json:()=>{if(responses[step]===null)throw Error('empty');return structuredClone(responses[step]);}},visualizer:{set:(template,data)=>visual=data}};
    const run=event=>vm.runInNewContext(event.script.exec.join('\n'),{pm,console:{log(){},warn(){},table(){}}});
    for(const event of [...collection.event,...item.event].filter(e=>e.listen==='prerequest'))run(event);
    if(skipped)continue;
    const resolve=text=>text.replace(/\{\{([^}]+)\}\}/g,(_,key)=>String(pm.variables.get(key)??''));
    const token=item.request.auth.type==='bearer'?resolve(item.request.auth.bearer[0].value):null;
    const body=item.request.body?JSON.parse(resolve(item.request.body.raw)):undefined;
    sent.push({step,method:item.request.method,url:resolve(item.request.url.raw),token,body});
    for(const event of item.event.filter(e=>e.listen==='test'))run(event);
  }
  return {values,tests,sent,visual,collection};
}
test('Kolekcja Postmana wykonuje dokładnie jedną obcą operację i wykrywa zmianę mimo 404',async()=>{
  for(const mutated of [false,true]){
    const r=await exercise({mutated});assert.equal(r.sent.length,13);
    assert(r.sent.slice(2).every(q=>q.token===(q.step==='09'?'private-jwt-b':'private-jwt-a')));
    assert(r.sent.slice(3).every(q=>q.url.includes('private-cart-a')));
    assert.equal(r.sent.filter(q=>q.url.endsWith('/complete')).length,1);
    assert.deepEqual(r.sent.find(q=>q.step==='11').body,{});
    const checkout=r.sent.find(q=>q.step==='07b');assert.equal(checkout.body.orderTokenValue,'private-cart-a');assert.equal(checkout.body.shippingMethodCode,'gls_wholesale');assert(checkout.body.shippingAddress.city);assert(checkout.body.billingAddress.nip);
    assert.equal(r.sent[0].body.apiPassword,'private-"password\\withchars');
    const result=JSON.parse(r.values.get('iso_result'));assert.equal(result.outcome,mutated?'FAIL':'PASS');
    assert.equal(r.tests.find(t=>t.name.includes('IDENTYCZNY')).status,mutated?'FAIL':'PASS');
    assert.equal(r.visual.isolationOutcome,result.outcome);assert.equal(r.values.get('iso_saved_order_number'),'30001234');assert(!r.values.has('iso_jwt_a'));assert(!r.values.has('iso_jwt_b'));assert(!r.values.has('iso_cart_a'));
    for(const secret of ['private-jwt','private-cart','private-tests','private-"password'])assert(!JSON.stringify(result).includes(secret));
    if(mutated)assert(result.changes.some(d=>d.field==='items.0.rebatePercent'&&d.before===50&&d.after===13));
  }
});
test('Kolekcja blokuje inne środowiska i nie uznaje 401 za potwierdzoną izolację',async()=>{
  const blocked=await exercise({baseUrl:'https://ksiegarnia.gwotest.pl/api/v2'});assert.equal(blocked.sent.length,0);assert(blocked.tests.some(t=>t.status==='FAIL'));
  const invalid=await exercise({foreignStatus:401});assert.equal(JSON.parse(invalid.values.get('iso_result')).outcome,'FAIL');
  const original=JSON.parse(await readFile(file,'utf8'));for(const key of ['iso_email_a','iso_email_b','iso_api_password','iso_tests_token_a','iso_tests_token_b','iso_gateway_cookie','iso_jwt_a','iso_jwt_b'])assert.equal(original.variable.find(v=>v.key===key).value,'');
});

test('Import z nowymi ID i poprzednia blokada nie uniemożliwiają ponownego startu od 01',async()=>{
  const r=await exercise({blockedInitially:true});assert.equal(r.sent.length,13);assert.equal(JSON.parse(r.values.get('iso_result')).outcome,'PASS');assert(!r.values.has('iso_setup_error'));assert(!r.values.has('iso_setup_blocked'));
});
test('Po błędzie logowania zachowuje pierwotny powód i nie wysyła dalszych żądań',async()=>{
  const r=await exercise({loginStatus:401});assert.equal(r.sent.length,1);assert.match(r.values.get('iso_setup_error'),/01 — Logowanie konta A: HTTP 401/);assert(!r.values.has('iso_result'));
});

test('Po kroku 10 zachowuje tokeny do zapisu; FAIL izolacji pozostaje także po przeliczeniu przy complete',async()=>{
  const partial=await exercise({mutated:true,stopAfterIsolation:true});assert.equal(partial.sent.length,11);assert(!partial.sent.some(q=>q.url.endsWith('/complete')));assert(partial.values.get('iso_jwt_a'));assert(partial.values.get('iso_cart_a'));
  const full=await exercise({mutated:true,restoreOnComplete:true});const result=JSON.parse(full.values.get('iso_completion_result'));
  assert.equal(result.state,'confirmed');assert.equal(result.isolationOutcome,'FAIL');assert.equal(result.priceChangedOnComplete,true);assert.equal(result.afterIsolation.items[0].rebatePercent,13);assert.equal(result.saved.items[0].rebatePercent,50);
  assert.equal(JSON.parse(full.values.get('iso_result')).outcome,'FAIL');
});
test('Nie ponawia complete dla tego samego koszyka i rozróżnia odrzucenie zapisu',async()=>{
  const repeated=await exercise({repeatComplete:true});assert.equal(repeated.sent.filter(q=>q.url.endsWith('/complete')).length,1);assert(repeated.tests.some(t=>t.name==='Brak ponownego complete'&&t.status==='FAIL'));
  const rejected=await exercise({completionStatus:422});assert.equal(JSON.parse(rejected.values.get('iso_completion_result')).state,'rejected');assert(!rejected.sent.some(q=>q.step==='12'));assert(!rejected.values.has('iso_saved_order_number'));
});
