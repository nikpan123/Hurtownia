import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runAddressRegression} from '../api-tests/redmine-36926.mjs';
const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2',scenario:{paymentMethodCode:'transfer',shippingMethodCode:'gls_wholesale'}};
const credentials={email:'qa@example.invalid',password:'password-hidden',testsToken:'tests-hidden'};
function mock({ignoreRequired=false,checkoutStatus=204,corruptBook=false,detachFails=false,omitNotes=false,wrongNotes=false}={}){
 let serial=0,addressSerial=1000;const carts=new Map(),calls=[],events=[],defaults={shipping:'999',billing:'999'};let addressList=[{id:999,company:'Istniejący adres — pozostaw'}];
 const shipping=['company','street','streetNumber','city','postcode','phoneNumber'],billing=['company','street','streetNumber','city','postcode','nip'];
 const fetchImpl=async(url,options)=>{
  const p=new URL(url).pathname.replace('/api/v2/',''),body=options.body?JSON.parse(options.body):null;calls.push(p);events.push({method:options.method,path:p});
  const r=(data,status=200)=>new Response(status===204?null:data===null?'':JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(p==='shop/authentication-token')return r({token:'private-jwt'});
  if(p==='shop/orders'&&options.method==='POST'){const token='private-cart-'+(++serial);const c={id:serial,tokenValue:token,shippingAddress:null,billingAddress:null,shipments:[],notes:null};carts.set(token,c);return r(c,201);}
  if(p==='shop/addresses')return r({data:addressList,pagination:{last:1}});
  if(p.startsWith('shop/addresses/')&&options.method==='DELETE'){const id=Number(p.split('/').pop());if([...carts.values()].some(c=>c.shippingAddress?.id===id||c.billingAddress?.id===id))return r({message:'Adres powiązany z koszykiem'},500);addressList=addressList.filter(a=>a.id!==id);return new Response(null,{status:204});}
  const token=p.split('/').pop(),cartToken=p.split('/')[2],cart=carts.get(cartToken)??carts.get(token);
  if(p==='wholesale/checkout-step-two/')return r({},404);
  if(!cart)return r({},404);
  if(p.endsWith('/items/bulk'))return r({},201);
  if(p.endsWith('/payments'))return r([{code:'transfer'}]);
  if(p.endsWith('/payment-method'))return r({});
  if(p.startsWith('shop/orders/')&&options.method==='GET')return r({...cart,...(omitNotes?{notes:undefined}:wrongNotes?{notes:'Niepoprawny dopisek'}:{})});
  if(p.startsWith('wholesale/checkout-step-two/')&&options.method==='GET')return r({shippingMethods:[{code:'gls_wholesale'}],defaultShippingAddress:addressList.find(a=>String(a.id)===defaults.shipping),defaultBillingAddress:addressList.find(a=>String(a.id)===defaults.billing)});
  if(p.startsWith('wholesale/checkout-step-two/')&&options.method==='POST'){
   const valid=body.shippingMethodCode==='gls_wholesale'&&shipping.every(k=>body.shippingAddress?.[k])&&billing.every(k=>body.billingAddress?.[k]);
   if(!valid&&!ignoreRequired)return r({message:'Validation'},422);
   if(detachFails&&body.shippingAddress?.company.endsWith('-CLEANUP'))return r({message:'Nie odłączono'},422);
   const saved=a=>{if(!a)return a;const result={...a,id:++addressSerial};if(a.saveToAddressBook)addressList.push({...result,...(corruptBook?{street:'Błędna ulica'}:{})});return result;};
   cart.shippingAddress=saved(body.shippingAddress);cart.billingAddress=saved(body.billingAddress);cart.shipments=[{method:{code:body.shippingMethodCode}}];cart.notes=body.shippingAddress?.carrierName?'Przewoźnik: '+body.shippingAddress.carrierName:null;
   for(const kind of ['shipping','billing'])if(body[kind+'Address']?.isDefault)defaults[kind]=String(cart[kind+'Address'].id);
   return r(null,checkoutStatus);
  }
  throw new Error('Nieznane żądanie '+p);
 };return {fetchImpl,calls,events,addresses:()=>addressList,connectDefaultsCms:async()=>({listUrl:'https://cms.example/addresses/999',read:async()=>({rows:addressList.map(a=>({...a,billing:String(a.id)===defaults.billing?'Domyślny adres':'Ustaw',shipping:String(a.id)===defaults.shipping?'Domyślny adres':'Ustaw'}))}),set:async(kind,id)=>{defaults[kind]=id;},close:async()=>{}})};
}
for(const [options,status,manual] of [[{omitNotes:true},'PASS',true],[{omitNotes:true,checkoutStatus:201},'FAIL',false],[{wrongNotes:true},'FAIL',false]])test('Potwierdzenie ręczne nie maskuje błędu bieżącego żądania ani niezgodnej notatki: '+JSON.stringify(options),async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'address-carrier-manual-'));
 try{const m=mock(options);const {report}=await runAddressRegression({...config,baseUrl:'https://ksiegarnia.gwodev.pl/api/v2'},credentials,{...m,directory,caseIds:['HURT-36926-06']});assert.equal(report.status,status);assert.equal(report.tests[0].verification?.mode==='manual-reference',manual);if(manual)assert.match(await readFile(path.join(directory,'raport.html'),'utf8'),/Potwierdzenia ręczne/);}
 finally{await rm(directory,{recursive:true,force:true});}
});
for(const ignoreRequired of [false,true])test('Walidacja adresów i dowody: '+(ignoreRequired?'wykrywa brak walidacji':'przechodzi kontrakt na atrapie'),async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'address-36926-'));
 try{const m=mock({ignoreRequired});const {report}=await runAddressRegression(config,credentials,{...m,allowLocal:true,directory,otherRunning:async()=>false});
 assert.equal(report.tests.length,38);assert.equal(report.status,ignoreRequired?'FAIL':'INCOMPLETE');
 if(!ignoreRequired){assert.equal(report.tests.filter(t=>t.status==='FAIL').length,0);assert.equal(report.tests.filter(t=>t.status==='SKIP').length,1);assert.match(report.attempts.find(a=>a.id==='HURT-36926-37').cleanup,/Przywrócono/);}
 assert(!m.calls.some(p=>p.endsWith('/complete')));const json=await readFile(path.join(directory,'raport.json'),'utf8');for(const secret of ['password-hidden','tests-hidden','private-jwt','private-cart-'])assert(!json.includes(secret));
 }finally{await rm(directory,{recursive:true,force:true});}
});

for(const checkoutStatus of [204,201])test('Domyślne w regresji: nowy koszyk, CMS i sprzątanie po HTTP '+checkoutStatus,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'address-default-integration-'));
 try{const m=mock({checkoutStatus});const {report}=await runAddressRegression(config,credentials,{...m,allowLocal:true,directory,caseIds:['HURT-36926-38'],cmsDefaults:true,defaultsJournalFile:path.join(directory,'restore.json'),otherRunning:async()=>false});
  assert.equal(report.status,checkoutStatus===204?'PASS':'FAIL');assert.equal(report.restorationFailed,undefined);
  if(checkoutStatus===204){assert.match(report.attempts[0].defaultRestoration,/oryginalne ID/);assert.equal(m.addresses().length,1);assert.equal(m.events.filter(e=>e.method==='DELETE').length,2);}
  // A failed detach with the legacy status preserves QA records rather than deleting attached addresses.
  assert.equal((await (await m.connectDefaultsCms()).read()).rows.find(r=>r.shipping==='Domyślny adres').id,999);
  await assert.rejects(readFile(path.join(directory,'restore.json')),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('Nowy kontrakt wymaga dokładnie 204; dawny status 201 nie daje PASS',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'address-contract-'));
 try{const m=mock({checkoutStatus:201});const {report}=await runAddressRegression(config,credentials,{...m,allowLocal:true,directory,caseIds:['HURT-36926-01']});assert.equal(report.status,'FAIL');assert.match(report.tests[0].detail,/204.*201/);}
 finally{await rm(directory,{recursive:true,force:true});}
});
test('Sprzątanie po błędzie porównania najpierw odłącza adresy; po odmowie odłączenia nie wysyła DELETE',async()=>{
 for(const detachFails of [false,true]){
  const directory=await mkdtemp(path.join(tmpdir(),'address-cleanup-'));
  try{const m=mock({corruptBook:true,detachFails});const {report}=await runAddressRegression(config,credentials,{...m,allowLocal:true,directory,caseIds:['HURT-36926-37'],otherRunning:async()=>false});
   assert.equal(report.status,'FAIL');assert.match(report.tests[0].detail,/Pole street/);
   assert.equal(m.events.filter(e=>e.method==='DELETE').length,detachFails?0:2);
   assert.equal(m.addresses().length,detachFails?3:1);assert.equal(m.addresses()[0].id,999);
   if(!detachFails)assert.match(report.attempts[0].cleanup,/odłączenia/);
  }finally{await rm(directory,{recursive:true,force:true});}
 }
});
