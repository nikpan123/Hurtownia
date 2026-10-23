import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {buildCollection,filename} from '../postman/build-redmine-36618.mjs';

function run({stale=false,product='book-140g',badBaseline=false}={}){
 const collection=buildCollection(),config=new Map(collection.variable.map(v=>[v.key,v.value]));
 for(const [k,v]of Object.entries({email:'qa@example.invalid',api_password:'secret-password',tests_token:'secret-tests',product_variant_140g:product}))config.set(k,v);
 const local=new Map(),results=[],sent=[],errors=[];let current,serial=0;
 const get=k=>local.has(k)?local.get(k):config.get(k);
 const replace=s=>s.replace(/\{\{([^}]+)\}\}/g,(_,k)=>get(k));
 const quote=shipping=>shipping==='gls_wholesale'?{shipmentPackageQuantity:2,shippingTotal:3600,shippingTotalNet:3429}:{shipmentPackageQuantity:0,shippingTotal:2000,shippingTotalNet:1905};
 for(const folder of collection.item){let stopped=false;
  for(const item of folder.item){
   let skipped=false,next,raw=item.request.body?.raw;
   const pm={variables:{get,set:(k,v)=>local.set(k,v),unset:k=>local.delete(k)},execution:{skipRequest:()=>{skipped=true;},setNextRequest:n=>{next=n;}},request:{body:{update:s=>{raw=s;}}},visualizer:{set:()=>{}},
    test:(name,fn)=>{try{fn();results.push({folder:folder.name,name,pass:true});}catch(e){results.push({folder:folder.name,name,pass:false});}},
    expect:v=>({to:{eql:w=>assert.deepEqual(v,w),have:{lengthOf:n=>assert.equal(v.length,n)}}})};
   const context={pm,console:{log:()=>{}}};
   try{vm.runInNewContext(item.event[0].script.exec.join('\n'),context);}catch(e){errors.push(e.message);}
   if(skipped||next===null){stopped=true;break;}
   const path=replace(item.request.url).replace(config.get('base_url'),''),body=raw?JSON.parse(replace(raw)):null;
   sent.push({path,method:item.request.method,body});let data,status=200;
   if(path==='/shop/authentication-token')data={token:'secret-jwt'};
   else if(path==='/shop/orders'){serial++;current={id:serial,tokenValue:'secret-cart-'+serial,quantity:1};data={id:serial,tokenValue:current.tokenValue};status=201;}
   else if(path.endsWith('/items/bulk')){assert.equal(body.items[0].productVariant,product);data={};status=201;}
   else if(/\/items\/\d+$/.test(path)){current.quantity=body.quantity;data={};}
   else if(path.endsWith('/payments'))data=[{code:'cash_on_delivery'}];
   else if(path.endsWith('/payment-method')){current.payment=body.paymentMethodCode;data={};}
   else if(path.includes('/checkout-step-two/')&&item.request.method==='GET')data={shippingMethods:[{code:'gls_wholesale'},{code:'poczta_polska'}]};
   else if(path.includes('/checkout-step-two/')){
    assert.equal(body.orderTokenValue,current.tokenValue);assert.equal(body.shippingAddress.saveToAddressBook,false);assert.equal(body.billingAddress.isDefault,false);
    if(!stale||!current.shipping)current.quote=quote(body.shippingMethodCode);
    else if(body.shippingMethodCode==='poczta_polska')current.quote={...current.quote,shipmentPackageQuantity:0};
    current.shipping=body.shippingMethodCode;data=null;status=204;
   }else data={id:current.id,items:[{id:100+serial,quantity:current.quantity}],shipments:current.shipping?[{method:{code:current.shipping}}]:[],payments:[{method:{code:current.payment}}],...current.quote,...(badBaseline&&current.shipping?{shippingTotal:999}:{} )};
   pm.response={code:status,json:()=>structuredClone(data)};
   try{vm.runInNewContext(item.event[1].script.exec.join('\n'),context);}catch(e){errors.push(e.message);}
   if(next===null){stopped=true;break;}
  }
 }
 return {collection,local,config,results,sent,errors};
}

test('Kolekcja przechodzi dla poprawnego API; dwa osobne koszyki, bez complete',()=>{
 const r=run();assert.deepEqual(r.errors,[]);assert.equal(r.results.filter(t=>!t.pass).length,0);
 assert.equal(r.sent.filter(s=>s.path==='/shop/orders').length,2);
 assert.equal(r.sent.some(s=>s.path.includes('/complete')),false);
 assert.equal(r.config.has('r36618_jwt'),false);
});
test('Pozostawione wartości z poprzedniej dostawy dają 2 błędy T06 i 3 błędy T07',()=>{
 const r=run({stale:true});assert.deepEqual(r.errors,[]);
 const failures=r.results.filter(t=>!t.pass);
 assert.equal(failures.filter(t=>t.folder.startsWith('T06')).length,2);
 assert.equal(failures.filter(t=>t.folder.startsWith('T07')).length,3);
 assert(failures.every(t=>t.name.startsWith('PO ZMIANIE')));
});
test('Brak przygotowanego produktu zatrzymuje folder przed wysłaniem żądań',()=>{
 const r=run({product:''});assert.equal(r.sent.length,0);assert.equal(r.errors.length,2);
});
test('Błędny stan początkowy nie jest przedstawiany jako regresja zmiany dostawy',()=>{
 const r=run({badBaseline:true});assert.equal(r.errors.length,2);
 assert(r.errors.every(e=>e.includes('Niepoprawny stan początkowy')));
 assert.equal(r.results.some(t=>t.name.startsWith('PO ZMIANIE')),false);
});
test('Eksport zgadza się z generatorem i nie zawiera haseł ani runtime tokenów',async()=>{
 const saved=JSON.parse(await readFile(new URL('../postman/'+filename,import.meta.url),'utf8'));
 assert.deepEqual(saved,buildCollection());
 for(const key of ['email','api_password','tests_token','product_variant_140g'])assert.equal(saved.variable.find(v=>v.key===key).value,'');
 assert(saved.item.every(f=>f.item.every(i=>i.protocolProfileBehavior.followRedirects===false)));
});
