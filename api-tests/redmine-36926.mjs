import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ApiClient} from './http.mjs';
import {normalizeOrder} from './engine.mjs';
import {saveFeatureReport} from './feature-report.mjs';

const shippingFields=['company','street','streetNumber','city','postcode','phoneNumber'];
const billingFields=['company','street','streetNumber','city','postcode','nip'];
export const addressCases=[
 {id:'HURT-36926-01',name:'Poprawny zapis: HTTP 201 i puste body',mode:'positive'},
 {id:'HURT-36926-02',name:'Odczyt zapisanych pól adresu dostawy',mode:'shipping'},
 {id:'HURT-36926-03',name:'Odczyt zapisanych pól adresu faktury',mode:'billing'},
 {id:'HURT-36926-04',name:'Zapis dostępnej metody dostawy',mode:'method'},
 {id:'HURT-36926-05',name:'Opcjonalne flagi pominięte: brak zapisu do książki i zmiany domyślnych',mode:'defaults-false'},
 {id:'HURT-36926-06',name:'carrierName trafia do order.notes',mode:'carrier'},
 ...shippingFields.flatMap((field,index)=>['missing','empty'].map((mode,offset)=>({id:'HURT-36926-'+String(7+index*2+offset).padStart(2,'0'),name:`Adres dostawy: ${mode==='missing'?'brak':'puste'} ${field}`,mode,object:'shippingAddress',field}))),
 ...billingFields.flatMap((field,index)=>['missing','empty'].map((mode,offset)=>({id:'HURT-36926-'+String(19+index*2+offset).padStart(2,'0'),name:`Adres faktury: ${mode==='missing'?'brak':'puste'} ${field}`,mode,object:'billingAddress',field}))),
 {id:'HURT-36926-31',name:'Brak obiektu shippingAddress',mode:'top-missing',field:'shippingAddress'},
 {id:'HURT-36926-32',name:'Brak obiektu billingAddress',mode:'top-missing',field:'billingAddress'},
 {id:'HURT-36926-33',name:'Brak shippingMethodCode',mode:'top-missing',field:'shippingMethodCode'},
 {id:'HURT-36926-34',name:'Niedostępna metoda dostawy',mode:'bad-method'},
 {id:'HURT-36926-35',name:'Nieistniejący token zamówienia w URL',mode:'bad-token'},
 {id:'HURT-36926-36',name:'Brak tokenu w URL',mode:'missing-token'},
 {id:'HURT-36926-37',name:'Zapis obu adresów do książki i usunięcie tylko danych QA',mode:'book'},
 {id:'HURT-36926-38',name:'Ustawienie i aktualizacja domyślnych adresów dla kanału',mode:'default-true'},
];
function requireTrue(value,message){if(!value)throw new Error(message);}
export async function runAddressRegression(config,credentials,options={}){
 const api=new ApiClient(config,credentials,options),marker='QA36926-'+randomUUID().slice(0,8);
 const selected=options.caseIds?addressCases.filter(c=>options.caseIds.includes(c.id)):addressCases;
 if(!selected.length)throw new Error('Nie wybrano istniejących przypadków.');
 const report={kind:'redmine-36926',issue:36926,scenario:'Redmine #36926 — adresy w drugim kroku koszyka',generatedAt:new Date().toISOString(),baseUrl:config.baseUrl,status:'RUNNING',tests:[],requests:api.requests,reference:{shippingFields,billingFields,productVariant:'5lp-1',channel:'WHOLESALE'},tables:[],attempts:[],scopeNote:'Osobne koszyki z fizycznym produktem 5lp-1. Bez finalizacji, e-maili i zmian CMS. Zapis książki wykonywany tylko gdy nie trwa inny przebieg; domyślnych adresów konta nie zmieniamy bez możliwości przywrócenia ich tożsamości i stanu.'};
 const directory=options.directory??path.resolve('raporty-api','redmine-36926-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 const request=async(method,endpoint,args={},allowed=[200])=>{const r=await api.request(method,endpoint,args);requireTrue(allowed.includes(r.status),`${method} ${endpoint}: HTTP ${r.status}; ${r.data?.message??r.data?.detail??''}`);return r;};
 async function book(){let all=[];for(let page=1;page<=20;page++){const r=await request('GET','shop/addresses',{query:{page,limit:100}});const rows=Array.isArray(r.data)?r.data:r.data?.data??r.data?.['hydra:member'];requireTrue(Array.isArray(rows),'Nie rozpoznano odpowiedzi książki adresowej.');all.push(...rows);const last=r.data?.pagination?.last??1;if(page>=last)return all;}throw new Error('Nie odczytano całej książki adresowej (limit 20 stron).');}
 async function prepare(){
  const created=await request('POST','shop/orders',{body:{localeCode:'pl_PL'}},[200,201]);const token=created.data?.tokenValue;requireTrue(typeof token==='string'&&token,'Brak tokenu koszyka.');api.secrets.push(token,encodeURIComponent(token));
  const root='shop/orders/'+encodeURIComponent(token),wholesale='wholesale/orders/'+encodeURIComponent(token),checkout='wholesale/checkout-step-two/'+encodeURIComponent(token);
  await request('POST',root+'/items/bulk',{body:{items:[{productVariant:'5lp-1',quantity:1}]}},[200,201,204]);
  const payments=(await request('GET',wholesale+'/payments')).data;requireTrue(Array.isArray(payments)&&payments.length,'Brak płatności.');
  const payment=payments.find(p=>p.code===config.scenario.paymentMethodCode)??payments[0];await request('PATCH',wholesale+'/payment-method',{body:{paymentMethodCode:payment.code}},[200,204]);
  const step=(await request('GET',checkout)).data;const raw=step?.shippingMethods,methods=Array.isArray(raw)?raw:raw?.['hydra:member']??raw?.member;requireTrue(Array.isArray(methods)&&methods.length,'Brak dostępnych dostaw.');
  const method=methods.find(m=>m.code==='gls_wholesale')??methods.find(m=>m.code===config.scenario.shippingMethodCode)??methods[0];
  const shippingAddress={company:marker+'-S',street:'Testowa',streetNumber:'10',city:'Gdańsk',postcode:'80-001',phoneNumber:'123456789',carrierName:marker+'-Przewoznik',saveToAddressBook:false,isDefault:false};
  const billingAddress={company:marker+'-B',street:'Testowa',streetNumber:'20',city:'Gdańsk',postcode:'80-001',nip:'1234563218',saveToAddressBook:false,isDefault:false};
  return {id:created.data.id,root,checkout,step,payload:{shippingMethodCode:method.code,shippingAddress,billingAddress}};
 }
 const compareFields=(actual,expected,fields)=>{for(const field of fields)requireTrue(actual?.[field]===expected[field],`Pole ${field}: oczekiwano ${JSON.stringify(expected[field])}, odczytano ${JSON.stringify(actual?.[field])}.`);};
 const project=order=>({shippingAddress:order.shippingAddress,billingAddress:order.billingAddress,shippingCode:normalizeOrder(order).shippingCode});
 const otherRunning=async()=>{if(options.otherRunning)return options.otherRunning();try{const r=await fetch('http://127.0.0.1:18767/api/state',{signal:AbortSignal.timeout(2000)});if(!r.ok)throw new Error();const state=await r.json();return state.jobs?.some(j=>j.status==='RUNNING'&&j.suite!=='redmine-36926')??true;}catch{return true;}};
 try{
  await api.loginShop();
  for(const sample of selected){
   options.signal?.throwIfAborted();options.onProgress?.(sample.id+': '+sample.name);
   let bookBaseline=null,bookCompanies=[];
   const start=api.requests.length,attempt={id:sample.id,name:sample.name,status:'RUNNING'};report.attempts.push(attempt);
   try{
    if(sample.mode==='default-true'){attempt.status='SKIP';attempt.reason='Nie zmieniano adresów domyślnych: brak potwierdzonej operacji przywracającej oryginalne powiązanie CustomerDefaultAddress. W kanale może równocześnie działać inny przebieg.';continue;}
    if(sample.mode==='book'&&await otherRunning()){attempt.status='SKIP';attempt.reason='Inny przebieg jest aktywny lub nie można wykluczyć aktywności. Nie zmieniano wspólnej książki adresowej.';continue;}
    const cart=await prepare();attempt.cartId=cart.id;const payload=structuredClone(cart.payload);
    let endpoint=cart.checkout;
    const negative=['missing','empty','top-missing','bad-method','bad-token','missing-token'].includes(sample.mode);
    const before=(await request('GET',cart.root)).data;
    if(sample.mode==='missing')delete payload[sample.object][sample.field];
    if(sample.mode==='empty')payload[sample.object][sample.field]='';
    if(sample.mode==='top-missing')delete payload[sample.field];
    if(sample.mode==='bad-method')payload.shippingMethodCode='qa-unavailable-'+randomUUID();
    if(sample.mode==='bad-token')endpoint='wholesale/checkout-step-two/qa-unknown-'+randomUUID();
    if(sample.mode==='missing-token')endpoint='wholesale/checkout-step-two/';
    if(sample.mode==='defaults-false'){delete payload.shippingAddress.carrierName;for(const address of [payload.shippingAddress,payload.billingAddress]){delete address.saveToAddressBook;delete address.isDefault;}}
    const beforeBook=['defaults-false','book'].includes(sample.mode)?await book():null;
    if(sample.mode==='book'){
     bookBaseline=new Set(beforeBook.map(x=>x.id));bookCompanies=[payload.shippingAddress.company,payload.billingAddress.company];
     for(const address of [payload.shippingAddress,payload.billingAddress])address.saveToAddressBook=true;
    }
    attempt.input=payload;
    const response=await api.request('POST',endpoint,{body:payload});attempt.http=response.status;attempt.responseBody=response.data;
    const after=(await request('GET',cart.root)).data;attempt.actual=project(after);
    if(negative){
     const statuses=sample.mode==='missing-token'?[404,405]:sample.mode==='bad-token'?[404]:[400,422];
     requireTrue(statuses.includes(response.status),`Oczekiwano ${statuses.join('/')}, otrzymano HTTP ${response.status}.`);
     requireTrue(isDeepStrictEqual(project(before),project(after)),'Odrzucone żądanie zmieniło adresy lub metodę dostawy koszyka.');
    }else{
     requireTrue(response.status===201,`Oczekiwano HTTP 201, otrzymano ${response.status}.`);
     if(sample.mode==='positive')requireTrue(response.data===null,'Oczekiwano pustego body; API zwróciło '+JSON.stringify(response.data));
     if(['shipping','defaults-false','book'].includes(sample.mode))compareFields(after.shippingAddress,payload.shippingAddress,shippingFields);
     if(['billing','defaults-false','book'].includes(sample.mode))compareFields(after.billingAddress,payload.billingAddress,billingFields);
     if(sample.mode==='method')requireTrue(normalizeOrder(after).shippingCode===payload.shippingMethodCode,'Nie zapisano wybranej metody dostawy.');
     if(sample.mode==='carrier'){
      if(!Object.hasOwn(after,'notes')){attempt.status='SKIP';attempt.reason='GET koszyka nie udostępnia order.notes; nie potwierdzono zapisu carrierName w notatkach.';continue;}
      requireTrue(String(after.notes??'').includes('Przewoźnik: '+payload.shippingAddress.carrierName),'Brak oczekiwanego dopisku Przewoźnik w order.notes.');
     }
     if(sample.mode==='defaults-false'){
      requireTrue(isDeepStrictEqual(beforeBook.map(x=>x.id).sort(),(await book()).map(x=>x.id).sort()),'Pominięcie saveToAddressBook zmieniło kolekcję adresów.');
      // GET drugiego kroku zapisanego koszyka może preferować adres koszyka.
      // Domyślne adresy kanału porównujemy na świeżym, niezapisanym koszyku.
      const latest=(await prepare()).step;
      attempt.defaultAddressComparison={beforeShipping:cart.step.defaultShippingAddress,afterShipping:latest.defaultShippingAddress,beforeBilling:cart.step.defaultBillingAddress,afterBilling:latest.defaultBillingAddress};
      requireTrue(isDeepStrictEqual(cart.step.defaultShippingAddress,latest.defaultShippingAddress)&&isDeepStrictEqual(cart.step.defaultBillingAddress,latest.defaultBillingAddress),'Pominięcie isDefault zmieniło adresy domyślne.');
     }
     if(sample.mode==='book'){
      const oldIds=new Set(beforeBook.map(x=>x.id));let created=[];
      try{
       created=(await book()).filter(a=>!oldIds.has(a.id)&&[payload.shippingAddress.company,payload.billingAddress.company].includes(a.company));
       attempt.createdAddressIds=created.map(a=>a.id);
       for(const address of [payload.shippingAddress,payload.billingAddress]){const matches=created.filter(a=>a.company===address.company);requireTrue(matches.length===1,'Nie dodano dokładnie jednego adresu '+address.company);compareFields(matches[0],address,['company','street','city','postcode']);}
      }finally{
       const cleanup=(await book()).filter(a=>!oldIds.has(a.id)&&[payload.shippingAddress.company,payload.billingAddress.company].includes(a.company));
       if(cleanup.length){
        const detached=structuredClone(cart.payload);for(const address of [detached.shippingAddress,detached.billingAddress]){address.company+='-CLEANUP';address.saveToAddressBook=false;address.isDefault=false;}
        await request('POST',cart.checkout,{body:detached},[201]);
        const current=(await request('GET',cart.root)).data;
        requireTrue(!cleanup.some(a=>a.id===current.shippingAddress?.id||a.id===current.billingAddress?.id),'Koszyk nadal wskazuje adresy książki; nie usuwamy powiązanych rekordów.');
       }
       for(const address of cleanup)await request('DELETE','shop/addresses/'+encodeURIComponent(address.id),{},[200,204]);
       requireTrue(!(await book()).some(a=>cleanup.some(c=>c.id===a.id)),'Nie usunięto testowych adresów z książki.');attempt.cleanup='Przywrócono kolekcję: usunięto wyłącznie nowe adresy tego przebiegu.';bookBaseline=null;
      }
     }
    }
    attempt.status='PASS';
   }catch(error){attempt.status='FAIL';attempt.error=api.clean(error.message);if(options.signal?.aborted)throw error;}
   finally{
    if(bookBaseline){try{const leftovers=(await book()).filter(a=>!bookBaseline.has(a.id)&&bookCompanies.includes(a.company));for(const a of leftovers)await request('DELETE','shop/addresses/'+encodeURIComponent(a.id),{},[200,204]);requireTrue(!(await book()).some(a=>leftovers.some(c=>c.id===a.id)),'Pozostały testowe adresy w książce.');attempt.cleanup='Usunięto nowe adresy QA także po nieudanej próbie.';}catch(error){attempt.status='FAIL';attempt.error=(attempt.error??'')+' Sprzątanie książki: '+api.clean(error.message);}}
    report.tests.push({id:sample.id,name:sample.id+': '+sample.name,status:attempt.status,detail:attempt.error??attempt.reason??'Sprawdzono odpowiedź i stan koszyka.',evidence:{requests:api.requests.slice(start),observations:[]}});
   }
  }
 }catch(error){report.error=api.clean(error.message);report.tests.push({name:'Przygotowanie / przerwanie',status:'FAIL',detail:report.error});}
 report.status=options.signal?.aborted?'CANCELLED':report.tests.some(t=>t.status==='FAIL')?'FAIL':report.tests.some(t=>t.status==='SKIP')?'INCOMPLETE':'PASS';
 report.tables=[{title:'Wyniki adresów i walidacji',headers:['ID','Koszyk','HTTP','Wynik','Szczegóły'],rows:report.attempts.map(a=>[a.id,a.cartId??'—',a.http??'—',a.status,a.error??a.reason??a.cleanup??'Zgodne'])}];
 const safe=api.clean(report);await saveFeatureReport(safe,directory);return {report:safe,directory};
}
