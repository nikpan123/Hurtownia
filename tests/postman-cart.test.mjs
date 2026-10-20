import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {buildCollection,filename} from '../postman/build-cart.mjs';

function flatten(items){return items.flatMap(i=>i.item?flatten(i.item):[i]);}
function runMock({flags={},badTotal=false,foreignMutation=false,completeTimeout=false,htmlLogin=false}={}){
 const c=buildCollection(),requests=flatten(c.item),values=new Map(c.variable.map(v=>[v.key,v.value]));
 for(const [k,v]of Object.entries({hurtownia_email:'a@example.invalid',hurtownia_api_password:'test-password',hurtownia_email_b:'b@example.invalid',tests_token:'tests-a',...flags}))values.set(k,v);
 const store={get:k=>values.get(k),set:(k,v)=>values.set(k,v),unset:k=>values.delete(k),toObject:()=>Object.fromEntries(values)};
 const carts=new Map(),book=[{id:900,company:'Existing address'}],sent=[],results=[],errors=[];let serial=0,bookId=1000;
 const response=(data,code=200,type='application/json')=>({data,code,type});
 function serve(url,method,body,actor){
  const path=new URL(url).pathname.replace('/api/v2/','');
  if(path==='shop/authentication-token'){
   if(htmlLogin)return response('<html>GitLab</html>',200,'text/html');
   if(body.apiPassword.startsWith('qa-invalid'))return response({code:401,message:'Invalid credentials'},401);
   return response({token:body.email==='b@example.invalid'?'jwt-b':'jwt-a'});
  }
  if(!['jwt-a','jwt-b'].includes(actor))return response({message:'JWT rejected'},401);
  if(path==='shop/orders'&&method==='POST'){
   const token='cart-'+(++serial);carts.set(token,{id:serial,tokenValue:token,owner:actor,items:[],payment:null,shipping:null});return response({id:serial,tokenValue:token},201);
  }
  if(path==='shop/addresses')return response({data:structuredClone(book),pagination:{last:1}});
  if(path.startsWith('shop/addresses/')&&method==='DELETE'){const id=Number(path.split('/').at(-1));book.splice(book.findIndex(a=>a.id===id),1);return response(null,204);}
  if(path==='shop/products-dto')return response({data:[{code:'5lp-1',slug:'book-qa'}]});
  if(path.startsWith('shop/products-dto-by-slug/'))return response({code:'5lp-1',slug:'book-qa'});
  if(path.startsWith('/orders/'))return response('%PDF-1.4\nmock PDF only\n%%EOF',200,'application/pdf');
  const token=path.split('/')[2],o=carts.get(token);assert(o,'Nieznany koszyk w symulacji: '+path);
  if(o.owner!==actor){if(foreignMutation&&path.endsWith('/payments'))o.rebate=0;return response({message:'Not found'},404);}
  const order=()=>{
   const rebate=o.rebate??(o.payment?50:0),items=o.items.map(i=>({...i,unitPrice:1000,discountedUnitPrice:1000*(100-rebate)/100,rebatePercent:rebate,total:i.quantity*1000*(100-rebate)/100,totalNetSalesAfterDiscount:Math.round(i.quantity*1000*(100-rebate)/105)}));
   const itemsTotal=items.reduce((s,i)=>s+i.total,0),shippingTotal=o.shipping?2000:0;
   return {id:o.id,tokenValue:o.tokenValue,number:o.number,state:o.number?'new':'cart',items,itemsTotal,total:itemsTotal+shippingTotal+(badTotal?1:0),totalNet:Math.round((itemsTotal+shippingTotal)/1.05),shippingTotal,shippingTotalNet:Math.round(shippingTotal/1.05),shipmentPackageQuantity:0,payments:o.payment?[{method:{code:o.payment}}]:[],shipments:o.shipping?[{method:{code:o.shipping}}]:[],shippingAddress:o.shippingAddress,billingAddress:o.billingAddress,...(o.number?{pdfSummary:'/orders/'+token+'/summary',paymentForm:'/orders/'+token+'/payment-form'}:{})};
  };
  if(path.endsWith('/payments'))return response([{code:'cash_on_delivery',rebatePercent:50,orderItemTotal:100}]);
  if(path.endsWith('/payment-method')){o.payment=body.paymentMethodCode;return response({});}
  if(path.startsWith('wholesale/checkout-step-two/')){
   if(method==='GET')return response({shippingMethods:[{code:'gls_wholesale'}]});
   if(!body.shippingAddress||!body.billingAddress||body.shippingMethodCode.startsWith('qa-unavailable-'))return response({message:'Validation'},422);
   o.shipping=body.shippingMethodCode;
   for(const [key,a]of Object.entries({shippingAddress:body.shippingAddress,billingAddress:body.billingAddress})){
    const id=++bookId;o[key]={...a,id};if(a.saveToAddressBook)book.push({...a,id});
   }
   return response(null,204);
  }
  if(path.endsWith('/items/bulk')){for(const p of body.items){const existing=o.items.find(i=>i.product.code===p.productVariant);if(existing)existing.quantity+=p.quantity;else o.items.push({id:o.items.length+1,product:{code:p.productVariant},quantity:p.quantity});}return response({},201);}
  if(path.includes('/items/')){const id=Number(path.split('/').at(-1));if(method==='DELETE')o.items=o.items.filter(i=>i.id!==id);else o.items.find(i=>i.id===id).quantity=body.quantity;return response({},200);}
  if(path.endsWith('/complete')){o.number='3000'+o.id;if(completeTimeout)throw Error('NETWORK_TIMEOUT');return response(order());}
  return response(order());
 }
 let index=0,steps=0;
 while(index<requests.length&&steps++<150){
  const item=requests[index],local=new Map();let skip=false,next=undefined;
  const replace=text=>String(text).replace(/\{\{([^}]+)\}\}/g,(_,k)=>k==='$guid'?'guid-'+steps:String(local.has(k)?local.get(k):values.get(k)??'{{'+k+'}}'));
  const headers=new Map(item.request.header.map(h=>[h.key,h.value]));
  const record=(name,fn)=>{try{fn();results.push({name,status:'PASS',request:item.name});}catch(e){results.push({name,status:'FAIL',detail:e.message,request:item.name});}};record.skip=(name)=>results.push({name,status:'SKIP',request:item.name});
  const pm={collectionVariables:store,variables:{set:(k,v)=>local.set(k,v),get:k=>local.has(k)?local.get(k):values.get(k),replaceIn:replace},info:{requestName:item.name},execution:{skipRequest:()=>{skip=true;},setNextRequest:name=>{next=name;}},request:{headers:{remove:k=>headers.delete(k),upsert:h=>headers.set(h.key,h.value)}},test:record,visualizer:{set:()=>{}}};
  const context=vm.createContext({pm,Math:Object.assign(Object.create(Math),{random:()=>0.25}),encodeURIComponent,JSON,Number,String,Set,Object,Array,Error,RegExp});
  try{for(const e of item.event.filter(e=>e.listen==='prerequest'))vm.runInContext(e.script.exec.join('\n'),context,{timeout:1000});}catch(e){errors.push({request:item.name,error:e.message});skip=true;}
  if(!skip){
   const url=replace(typeof item.request.url==='string'?item.request.url:item.request.url.raw);const body=item.request.body?JSON.parse(replace(item.request.body.raw)):undefined;
   let actor=item.request.auth.type==='bearer'?replace(item.request.auth.bearer[0].value):undefined;
   if(headers.has('Authorization'))actor=replace(headers.get('Authorization')).replace('Bearer ','');
   sent.push({name:item.name,url,method:item.request.method,body,actor,headers:Object.fromEntries([...headers].map(([k,v])=>[k,replace(v)]))});
   try{
    const r=serve(url,item.request.method,body,actor);pm.response={code:r.code,text:()=>r.type==='application/json'?(r.data===null?'':JSON.stringify(r.data)):String(r.data),json:()=>structuredClone(r.data),headers:{get:()=>r.type}};
    for(const e of item.event.filter(e=>e.listen==='test'))vm.runInContext(e.script.exec.join('\n'),context,{timeout:1000});
   }catch(e){errors.push({request:item.name,error:e.message});next=null;}
  }
  if(next===null)break;
  index=typeof next==='string'?requests.findIndex(r=>r.name===next):index+1;assert(index>=0,'Nieznany kolejny request');
 }
 assert(steps<150,'Nieograniczona pętla');return {values,sent,results,errors,book,carts};
}

test('Kolekcja zawiera wszystkie metody koszyka, adresów, dokumentów i katalogu; skrypty są poprawne składniowo',async()=>{
 const c=JSON.parse(await readFile(new URL('../postman/'+filename,import.meta.url),'utf8')),rows=flatten(c.item);
 assert.equal(c.item.length,7);assert.equal(rows.length,81);assert.equal(new Set(rows.map(r=>r.name)).size,rows.length);
 for(const r of rows){assert(r.request.description.length>60);for(const e of r.event)new vm.Script(e.script.exec.join('\n'));}
 for(const [method,fragment]of [['POST','/shop/authentication-token'],['POST','/shop/orders'],['POST','/items/bulk'],['GET','/shop/orders/'],['PATCH','/items/'],['DELETE','/items/'],['GET','/payments'],['PATCH','/payment-method'],['GET','/checkout-step-two/'],['POST','/checkout-step-two/'],['PATCH','/complete'],['GET','/shop/addresses'],['DELETE','/shop/addresses/'],['GET','/shop/products-dto?'],['GET','/shop/products-dto-by-slug/']])assert(rows.some(r=>r.request.method===method&&(typeof r.request.url==='string'?r.request.url:r.request.url.raw).includes(fragment)),method+' '+fragment);
 assert.equal(rows.filter(r=>r.request.url==='{{document_url}}').length,2);
 for(const key of ['hurtownia_email','hurtownia_api_password','tests_token','hurtownia_email_b','hurtownia_api_password_b','bearer_token','tokenValue'])assert.equal(c.variable.find(v=>v.key===key).value,'');
});

test('Domyślny przebieg poprawnie losuje jedną grupę, edytuje i wybiera oferty; nie zapisuje zamówienia',()=>{
 const r=runMock({flags:{require_empty_checkout_body:'true'}});assert.deepEqual(r.errors,[]);assert(!r.results.some(t=>t.status==='FAIL'),JSON.stringify(r.results));
 assert(!r.sent.some(s=>s.url.endsWith('/complete')));assert(!r.sent.some(s=>s.method==='DELETE'));assert(!r.sent.some(s=>s.url.includes('/shop/addresses')));
 assert.equal(new Set(JSON.parse(r.values.get('cartProductPlan')).map(p=>p.group)).size,1);
 assert(r.sent.find(s=>s.method==='PATCH').headers['Content-Type']==='application/merge-patch+json');
});

test('Losowanie Adamady nie dodaje zwykłych ani wyłączonych produktów',()=>{
 const r=runMock({flags:{product_group:'adamada',product_pool_json:JSON.stringify([{productVariant:'D087',group:'adamada'},{productVariant:'D090',group:'adamada',enabled:false},{productVariant:'5lp-1',group:'pozostale'}])}});
 assert.deepEqual(r.errors,[]);assert.deepEqual(JSON.parse(r.values.get('cartProductPlan')).map(p=>p.productVariant),['D087']);
});

test('Wszystkie jawnie włączone foldery przechodzą na modelu, dokumenty i usuwanie adresów używają właściwych zmiennych',()=>{
 const r=runMock({flags:{enable_complete:'true',enable_repeat_complete:'true',run_mutations:'true',run_auth_tests:'true',run_address_validation:'true',run_isolation:'true',run_address_book:'true',run_catalog:'true'}});
 assert.deepEqual(r.errors,[]);assert(!r.results.some(t=>t.status==='FAIL'),JSON.stringify(r.results.filter(t=>t.status==='FAIL')));
 assert.equal(r.sent.filter(s=>s.url.endsWith('/complete')).length,2);assert.equal(r.sent.filter(s=>s.url.includes('/orders/')&&!s.url.includes('/api/')).length,2);
 assert.equal(r.sent.filter(s=>s.method==='DELETE'&&s.url.includes('/shop/addresses/')).length,2);assert.deepEqual(r.book,[{id:900,company:'Existing address'}]);
 assert.equal(r.sent.filter(s=>s.name.includes('[AUTH-003]')).length,6);assert(r.sent.some(s=>s.name.includes('błędnym JWT')&&s.actor==='qa-invalid-jwt'));
 assert(r.sent.find(s=>s.name.includes('05.05')).actor==='jwt-b');
});

test('Niespójna suma blokuje complete, utrata odpowiedzi go nie ponawia, mutacja po 404 daje FAIL',()=>{
 const financial=runMock({badTotal:true,flags:{enable_complete:'true'}});assert(financial.results.some(t=>t.status==='FAIL'));assert(!financial.sent.some(s=>s.url.endsWith('/complete')));
 const timeout=runMock({completeTimeout:true,flags:{enable_complete:'true',enable_repeat_complete:'true'}});assert.equal(timeout.sent.filter(s=>s.url.endsWith('/complete')).length,1);
 const isolation=runMock({foreignMutation:true,flags:{run_isolation:'true'}});assert(isolation.results.some(t=>t.status==='FAIL'&&t.name.includes('Odrzucenie')));
 const html=runMock({htmlLogin:true});assert(html.errors.some(e=>e.error.includes('GitLab')));assert.equal(html.sent.length,1);
});
