import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ApiClient} from './http.mjs';
import {normalizeOrder} from './engine.mjs';
import {saveFeatureReport} from './feature-report.mjs';
import {connectAddressDefaultsCms,protectAddressDefaults,defaultIds} from './address-defaults-cms.mjs';
import {confirmCarrierManually,describeManualVerifications} from './address-manual-evidence.mjs';

const shippingFields=['company','street','streetNumber','city','postcode','phoneNumber'];
const billingFields=['company','street','streetNumber','city','postcode','nip'];
export const addressCases=[
 {id:'HURT-36926-01',name:'Poprawny zapis: HTTP 204 i puste body',mode:'positive'},
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
 const report={kind:'redmine-36926',issue:36926,scenario:'Redmine #36926 — adresy w drugim kroku koszyka',generatedAt:new Date().toISOString(),baseUrl:config.baseUrl,status:'RUNNING',tests:[],requests:api.requests,reference:{shippingFields,billingFields,productVariant:'5lp-1',channel:'WHOLESALE',checkoutSuccessStatus:204,emptyResponseBody:true,contractSource:'Zmiana 201 na 204 No Content potwierdzona komentarzem developera przekazanym 20.10.2026.'},tables:[],attempts:[],scopeNote:'Osobne koszyki z fizycznym produktem 5lp-1. Bez finalizacji, e-maili i zmian CMS. Zapis książki wykonywany tylko gdy nie trwa inny przebieg; domyślnych adresów konta nie zmieniamy bez możliwości przywrócenia ich tożsamości i stanu.'};
 report.scopeNote='Osobne koszyki z fizycznym produktem 5lp-1. Bez finalizacji i e-maili. Przypadki 37/38 zapisują tylko nowe adresy QA; przypadek 38 tymczasowo ustawia je jako domyślne przez API, porównuje CMS i świeży koszyk, po czym przywraca oryginalne ID w CMS przyciskami Ustaw. Raport podaje wynik przywrócenia i sprzątania.';
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
 async function cleanupBook(cart,baseline,companies){
  const leftovers=(await book()).filter(a=>!baseline.has(String(a.id))&&companies.includes(a.company));
  if(!leftovers.length)return;
  const ids=new Set(leftovers.map(a=>String(a.id)));
  const current=()=>request('GET',cart.root).then(r=>r.data);
  const addressIds=order=>{
   requireTrue(order.shippingAddress&&order.billingAddress&&order.shippingAddress.id!=null&&order.billingAddress.id!=null,'Nie odczytano obu ID adresów koszyka; nie usuwamy rekordów bez potwierdzenia odłączenia.');
   return [String(order.shippingAddress.id),String(order.billingAddress.id)];
  };
  if(addressIds(await current()).some(id=>ids.has(id))){
   const detached=structuredClone(cart.payload);for(const address of [detached.shippingAddress,detached.billingAddress]){address.company+='-CLEANUP';address.saveToAddressBook=false;address.isDefault=false;}
   const response=await request('POST',cart.checkout,{body:detached},[204]);requireTrue(response.data===null,'Odłączenie adresów wymaga pustego body po HTTP 204.');
  }
  requireTrue(!addressIds(await current()).some(id=>ids.has(id)),'Koszyk nadal wskazuje adresy książki; nie wykonano DELETE.');
  for(const address of leftovers)await request('DELETE','shop/addresses/'+encodeURIComponent(address.id),{},[200,204]);
  requireTrue(!(await book()).some(a=>ids.has(String(a.id))),'Pozostały testowe adresy w książce.');
 }
 const otherRunning=async()=>{if(options.otherRunning)return options.otherRunning();try{const r=await fetch('http://127.0.0.1:18767/api/state',{signal:AbortSignal.timeout(2000)});if(!r.ok)throw new Error();const state=await r.json();return state.jobs?.some(j=>j.status==='RUNNING'&&j.suite!=='redmine-36926')??true;}catch{return true;}};
 try{
  await api.loginShop();
  for(const sample of selected){
   options.signal?.throwIfAborted();options.onProgress?.(sample.id+': '+sample.name);
   let bookBaseline=null,bookCompanies=[],cart;
   const start=api.requests.length,attempt={id:sample.id,name:sample.name,status:'RUNNING'};report.attempts.push(attempt);
   try{
    if(sample.mode==='default-true'){
     if(!options.cmsDefaults){attempt.status='SKIP';attempt.reason='Kontrola domyślnych wymaga adaptera CMS: osobne przyciski Ustaw dla płatności i dostawy oraz przywrócenie obu oryginalnych ID.';continue;}
     if(await otherRunning()){attempt.status='SKIP';attempt.reason='Inny przebieg jest aktywny; nie zmieniano adresów domyślnych.';continue;}
     const cms=await (options.connectDefaultsCms??connectAddressDefaultsCms)(credentials.email,{vars:options.vars,sessionFile:options.sessionFile??config.sessionFile??'.auth/dev.json'});
     try{
      await protectAddressDefaults(cms,marker,async(baseline,ids)=>{
       cart=await prepare();attempt.cartId=cart.id;
       requireTrue(String(cart.step.defaultShippingAddress?.id)===ids.shipping&&String(cart.step.defaultBillingAddress?.id)===ids.billing,'API świeżego koszyka i CMS wskazują inne początkowe ID; przerwano przed zmianą.');
       bookBaseline=new Set((await book()).map(a=>String(a.id)));bookCompanies=[cart.payload.shippingAddress.company,cart.payload.billingAddress.company];
       const payload=structuredClone(cart.payload);for(const address of [payload.shippingAddress,payload.billingAddress]){address.saveToAddressBook=true;address.isDefault=true;}
       requireTrue(isDeepStrictEqual(defaultIds(await cms.read()),ids),'Ustawienia CMS zmieniły się podczas przygotowania; nie wysłano zapisu API.');
       options.signal?.throwIfAborted();attempt.input=payload;attempt.defaultIdsBefore=ids;
       const response=await request('POST',cart.checkout,{body:payload},[204]);attempt.http=response.status;requireTrue(response.data===null,'Oczekiwano pustego body po HTTP 204.');
       const created=(await book()).filter(a=>!bookBaseline.has(String(a.id))&&bookCompanies.includes(a.company));attempt.createdAddressIds=created.map(a=>a.id);
       const expected={};for(const [kind,address] of [['shipping',payload.shippingAddress],['billing',payload.billingAddress]]){const found=created.filter(a=>a.company===address.company);requireTrue(found.length===1,'Nie zapisano jednoznacznie nowego adresu '+kind);expected[kind]=String(found[0].id);}
       const fresh=await prepare();attempt.verificationCartId=fresh.id;attempt.defaultIdsAfter=defaultIds(await cms.read());
       requireTrue(isDeepStrictEqual(attempt.defaultIdsAfter,expected),'CMS nie wskazuje obu nowych adresów QA jako domyślnych.');
       for(const [kind,fields] of [['shipping',shippingFields],['billing',billingFields]]){const actual=fresh.step[kind==='shipping'?'defaultShippingAddress':'defaultBillingAddress'];requireTrue(String(actual?.id)===expected[kind],'Nowy koszyk nie zwrócił domyślnego ID '+kind);compareFields(actual,payload[kind+'Address'],fields);}
      },{journalFile:options.defaultsJournalFile});
      attempt.defaultRestoration='CMS: przywrócono oryginalne ID płatności i dostawy przyciskami Ustaw; potwierdzono odczytem listy.';
      const restored=await prepare();attempt.restorationCartId=restored.id;
      if(String(restored.step.defaultShippingAddress?.id)!==attempt.defaultIdsBefore.shipping||String(restored.step.defaultBillingAddress?.id)!==attempt.defaultIdsBefore.billing){bookBaseline=null;throw new Error('CMS potwierdził przywrócenie ID, ale API nowego koszyka zwróciło inne; nie usuwano adresów QA.');}
      attempt.status='PASS';
     }finally{await cms.close();}
     continue;
    }
    if(sample.mode==='book'&&await otherRunning()){attempt.status='SKIP';attempt.reason='Inny przebieg jest aktywny lub nie można wykluczyć aktywności. Nie zmieniano wspólnej książki adresowej.';continue;}
    cart=await prepare();attempt.cartId=cart.id;const payload=structuredClone(cart.payload);
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
     bookBaseline=new Set(beforeBook.map(x=>String(x.id)));bookCompanies=[payload.shippingAddress.company,payload.billingAddress.company];
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
     requireTrue(response.status===204,`Oczekiwano HTTP 204, otrzymano ${response.status}.`);
     if(sample.mode==='positive')requireTrue(response.data===null,'Oczekiwano pustego body; API zwróciło '+JSON.stringify(response.data));
     if(['shipping','defaults-false','book'].includes(sample.mode))compareFields(after.shippingAddress,payload.shippingAddress,shippingFields);
     if(['billing','defaults-false','book'].includes(sample.mode))compareFields(after.billingAddress,payload.billingAddress,billingFields);
     if(sample.mode==='method')requireTrue(normalizeOrder(after).shippingCode===payload.shippingMethodCode,'Nie zapisano wybranej metody dostawy.');
     if(sample.mode==='carrier'){
      if(!Object.hasOwn(after,'notes')){if(!confirmCarrierManually(attempt,config)){attempt.status='SKIP';attempt.reason='GET koszyka nie udostępnia order.notes; brak zaakceptowanego potwierdzenia ręcznego dla tego środowiska.';}continue;}
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
      const oldIds=new Set(beforeBook.map(x=>String(x.id)));let created=[];
       created=(await book()).filter(a=>!oldIds.has(String(a.id))&&[payload.shippingAddress.company,payload.billingAddress.company].includes(a.company));
       attempt.createdAddressIds=created.map(a=>a.id);
       for(const address of [payload.shippingAddress,payload.billingAddress]){const matches=created.filter(a=>a.company===address.company);requireTrue(matches.length===1,'Nie dodano dokładnie jednego adresu '+address.company);compareFields(matches[0],address,['company','street','city','postcode']);}
     }
    }
    attempt.status='PASS';
   }catch(error){attempt.status='FAIL';attempt.error=api.clean(error.message);if(error.restorationFailed){report.restorationFailed=true;bookBaseline=null;}if(options.signal?.aborted)throw error;}
   finally{
    if(bookBaseline){const signal=api.signal;try{if(sample.mode==='default-true')api.signal=undefined;await cleanupBook(cart,bookBaseline,bookCompanies);attempt.cleanup='Przywrócono kolekcję: usunięto wyłącznie nowe adresy tego przebiegu po potwierdzeniu odłączenia.';}catch(error){attempt.status='FAIL';attempt.error=(attempt.error??'')+' Sprzątanie książki: '+api.clean(error.message);}finally{api.signal=signal;}}
    report.tests.push({id:sample.id,name:sample.id+': '+sample.name,status:attempt.status,verification:attempt.verification,detail:attempt.error??attempt.reason??(sample.mode==='default-true'?`POST: 204 i puste body. Nowy koszyk ${attempt.verificationCartId}: zgodne ID i pola obu adresów QA. ${attempt.defaultRestoration} API koszyka ${attempt.restorationCartId} potwierdziło oryginalne ID: płatności ${attempt.defaultIdsBefore?.billing}, dostawy ${attempt.defaultIdsBefore?.shipping}. ${attempt.cleanup??''}`:'Sprawdzono odpowiedź i stan koszyka.'),evidence:{requests:api.requests.slice(start),observations:[],addressDefaults:sample.mode==='default-true'?{before:attempt.defaultIdsBefore,after:attempt.defaultIdsAfter,restoration:attempt.defaultRestoration,cleanup:attempt.cleanup}:undefined}});
   }
  }
 }catch(error){report.error=api.clean(error.message);report.tests.push({name:'Przygotowanie / przerwanie',status:'FAIL',detail:report.error});}
 report.status=report.restorationFailed?'FAIL':options.signal?.aborted?'CANCELLED':report.tests.some(t=>t.status==='FAIL')?'FAIL':report.tests.some(t=>t.status==='SKIP')?'INCOMPLETE':'PASS';
 report.tables=[{title:'Wyniki adresów i walidacji',headers:['ID','Koszyk','HTTP','Wynik','Szczegóły'],rows:report.attempts.map(a=>[a.id,a.cartId??'—',a.http??'—',a.status,a.error??a.reason??a.cleanup??'Zgodne'])}];
 for(const attempt of report.attempts.filter(a=>a.defaultIdsBefore))report.tables.push({title:'Adresy domyślne — CMS i nowe koszyki',headers:['Rodzaj','ID przed testem','ID QA po zapisie API','Przywrócenie'],rows:[['Płatności',attempt.defaultIdsBefore.billing,attempt.defaultIdsAfter?.billing??'Nie potwierdzono',attempt.defaultRestoration??'Nie potwierdzono'],['Dostawy',attempt.defaultIdsBefore.shipping,attempt.defaultIdsAfter?.shipping??'Nie potwierdzono',attempt.defaultRestoration??'Nie potwierdzono']]});
 describeManualVerifications(report);
 const safe=api.clean(report);await saveFeatureReport(safe,directory);return {report:safe,directory};
}
