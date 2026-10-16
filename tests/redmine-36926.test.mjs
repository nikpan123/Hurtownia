import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runAddressRegression} from '../api-tests/redmine-36926.mjs';
const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2',scenario:{paymentMethodCode:'transfer',shippingMethodCode:'gls_wholesale'}};
const credentials={email:'qa@example.invalid',password:'password-hidden',testsToken:'tests-hidden'};
function mock({ignoreRequired=false}={}){
 let serial=0;const carts=new Map(),calls=[];let addressList=[];
 const shipping=['company','street','streetNumber','city','postcode','phoneNumber'],billing=['company','street','streetNumber','city','postcode','nip'];
 const fetchImpl=async(url,options)=>{
  const p=new URL(url).pathname.replace('/api/v2/',''),body=options.body?JSON.parse(options.body):null;calls.push(p);
  const r=(data,status=200)=>new Response(data===null?'':JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(p==='shop/authentication-token')return r({token:'private-jwt'});
  if(p==='shop/orders'&&options.method==='POST'){const token='private-cart-'+(++serial);const c={id:serial,tokenValue:token,shippingAddress:null,billingAddress:null,shipments:[],notes:null};carts.set(token,c);return r(c,201);}
  if(p==='shop/addresses')return r({data:addressList,pagination:{last:1}});
  if(p.startsWith('shop/addresses/')&&options.method==='DELETE'){addressList=addressList.filter(a=>a.id!==Number(p.split('/').pop()));return new Response(null,{status:204});}
  const token=p.split('/').pop(),cartToken=p.split('/')[2],cart=carts.get(cartToken)??carts.get(token);
  if(p==='wholesale/checkout-step-two/')return r({},404);
  if(!cart)return r({},404);
  if(p.endsWith('/items/bulk'))return r({},201);
  if(p.endsWith('/payments'))return r([{code:'transfer'}]);
  if(p.endsWith('/payment-method'))return r({});
  if(p.startsWith('shop/orders/')&&options.method==='GET')return r(cart);
  if(p.startsWith('wholesale/checkout-step-two/')&&options.method==='GET')return r({shippingMethods:[{code:'gls_wholesale'}],defaultShippingAddress:null,defaultBillingAddress:null});
  if(p.startsWith('wholesale/checkout-step-two/')&&options.method==='POST'){
   const valid=body.shippingMethodCode==='gls_wholesale'&&shipping.every(k=>body.shippingAddress?.[k])&&billing.every(k=>body.billingAddress?.[k]);
   if(!valid&&!ignoreRequired)return r({message:'Validation'},422);
   cart.shippingAddress=body.shippingAddress;cart.billingAddress=body.billingAddress;cart.shipments=[{method:{code:body.shippingMethodCode}}];cart.notes=body.shippingAddress?.carrierName?'Przewoźnik: '+body.shippingAddress.carrierName:null;
   for(const a of [body.shippingAddress,body.billingAddress])if(a?.saveToAddressBook)addressList.push({...a,id:1000+addressList.length});
   return r(null,201);
  }
  throw new Error('Nieznane żądanie '+p);
 };return {fetchImpl,calls};
}
for(const ignoreRequired of [false,true])test('Walidacja adresów i dowody: '+(ignoreRequired?'wykrywa brak walidacji':'przechodzi kontrakt na atrapie'),async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'address-36926-'));
 try{const m=mock({ignoreRequired});const {report}=await runAddressRegression(config,credentials,{...m,allowLocal:true,directory,otherRunning:async()=>false});
 assert.equal(report.tests.length,38);assert.equal(report.status,ignoreRequired?'FAIL':'INCOMPLETE');
 if(!ignoreRequired){assert.equal(report.tests.filter(t=>t.status==='FAIL').length,0);assert.equal(report.tests.filter(t=>t.status==='SKIP').length,1);assert.match(report.attempts.find(a=>a.id==='HURT-36926-37').cleanup,/Przywrócono/);}
 assert(!m.calls.some(p=>p.endsWith('/complete')));const json=await readFile(path.join(directory,'raport.json'),'utf8');for(const secret of ['password-hidden','tests-hidden','private-jwt','private-cart-'])assert(!json.includes(secret));
 }finally{await rm(directory,{recursive:true,force:true});}
});
