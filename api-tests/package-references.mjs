import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {minorUnits} from './features.mjs';
import {packageQuote} from './order-regression.mjs';
import {sortedFields} from './package-cms.mjs';

export function shippingReference(form){
 const v=new URLSearchParams(form.fields),prefix='sylius_shipping_method',get=key=>v.get(prefix+'['+key+']');
 const method={code:get('code'),enabled:get('enabled')==='1',channels:v.getAll(prefix+'[channels][]'),calculator:get('calculator'),taxCategory:get('taxCategory'),source:form.route};
 assert.equal(method.taxCategory,'books','Wzorzec dostawy wymaga kategorii books');
 if(method.calculator==='flat_rate')method.grossMinor=minorUnits(v.get(prefix+'[configuration][WHOLESALE][amount]'));
 else if(method.calculator==='weight_range_shipping'){
  const config=key=>v.get(prefix+'[configuration]['+key+']');
  const indices=[...new Set(form.fields.map(([key])=>key.match(/\[weightRanges\]\[(\d+)\]/)?.[1]).filter(Boolean))];
  method.profile={singlePackageWeight:Number(config('singlePackageWeight')),priceIsNet:config('priceIsNet')==='1',taxPercent:5,
   weightRanges:indices.map(i=>({from:Number(v.get(prefix+'[configuration][weightRanges]['+i+'][orderWeightFrom]')),to:Number(v.get(prefix+'[configuration][weightRanges]['+i+'][orderWeightTo]')),priceMinor:minorUnits(v.get(prefix+'[configuration][weightRanges]['+i+'][pricePerPackage]'))}))};
 }
 return method;
}
export function paymentReference(form){
 const v=new URLSearchParams(form.fields),prefix='sylius_payment_method',fees={};
 for(const [key,shipping]of form.fields){const match=key.match(/^sylius_payment_method\[paymentMethodFees\]\[(\d+)\]\[shippingMethod\]$/);if(!match||!shipping)continue;
  const base=prefix+'[paymentMethodFees]['+match[1]+']';
  assert.equal(v.get(base+'[calculator]'),'flat_rate','Nieobsługiwany kalkulator dopłaty');assert.equal(v.get(base+'[taxCategory]'),'books');
  const amount=minorUnits(v.get(base+'[calculatorConfiguration][WHOLESALE][amount]'));(fees[shipping]??=[]).push(amount);
 }
 return {code:v.get(prefix+'[code]'),fees,source:form.route};
}
export function pickupTarget(original){
 const fields=new URLSearchParams(original.fields),key='sylius_shipping_method[channels][]';
 if(!fields.getAll(key).includes('WHOLESALE'))fields.append(key,'WHOLESALE');
 fields.set('sylius_shipping_method[categoryRequirement]','0');
 return {route:original.route,fields:sortedFields([...fields])};
}
export async function protectPickup(adapter,run,{file=path.resolve('.auth/package-pickup-36618.json'),debuggerSession,onProgress=()=>{}}={}){
 await mkdir(path.dirname(file),{recursive:true});
 let existing;try{existing=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing)throw new Error('Pozostał dziennik odbioru własnego #36618. Użyj redmine:36618:restore przed nową próbą.');
 const original=await adapter.pickup(),target=pickupTarget(original);let owns=false,result;
 try{
  if(!isDeepStrictEqual(original,target)){
   await writeFile(file,JSON.stringify({original,target,createdAt:new Date().toISOString()},null,2),{flag:'wx'});owns=true;
   onProgress('CMS: tymczasowo udostępniam odbiór własny w WHOLESALE');
   if(debuggerSession)await debuggerSession.operation('CMS: udostępnienie odbioru własnego',()=>adapter.savePickup(original,target));
   else await adapter.savePickup(original,target);
  }
  result=await run();return result;
 }finally{
  if(owns)try{const current=await adapter.pickup();assert(isDeepStrictEqual(current,original)||isDeepStrictEqual(current,target),'Odbiór własny zmieniony poza testem — zachowano dziennik');
   if(!isDeepStrictEqual(current,original))await adapter.savePickup(current,original);
   assert.deepEqual(await adapter.pickup(),original,'Nie przywrócono odbioru własnego');await unlink(file);
   if(result)result.report.tests.push({name:'CMS: przywrócenie odbioru własnego',status:'PASS',detail:'Dokładny stan pól i kanałów zgodny z migawką sprzed próby.'});
  }catch(error){
   if(result){result.report.restorationFailed=true;result.report.status='FAIL';result.report.tests.push({name:'CMS: przywrócenie odbioru własnego',status:'FAIL',detail:error.message+'; zachowano dziennik, użyj redmine:36618:restore'});}
   else throw Object.assign(error,{restorationFailed:true});
  }
 }
}
export async function restorePickup(adapter,{file=path.resolve('.auth/package-pickup-36618.json')}={}){
 let journal;try{journal=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return;throw e;}
 const current=await adapter.pickup();assert(isDeepStrictEqual(current,journal.original)||isDeepStrictEqual(current,journal.target),'Odbiór własny zmieniony poza próbą');
 if(!isDeepStrictEqual(current,journal.original))await adapter.savePickup(current,journal.original);
 assert.deepEqual(await adapter.pickup(),journal.original);await unlink(file);
}

export function buildPackageSettings(settings,references,offers,rebates){
 assert(references.taxRows.some(row=>row.includes('books_sales_tax_5')&&/5\s*%/.test(row)),'Nie potwierdzono VAT książek 5% w CMS');
 const offeredCodes=new Set(offers.flatMap(o=>o.shipping));
 const shipping=references.shipping.filter(f=>offeredCodes.has(new URLSearchParams(f.fields).get('sylius_shipping_method[code]'))).map(shippingReference),payments=references.payments.map(paymentReference);
 const s=structuredClone(settings),gls=shipping.find(m=>m.code==='gls_wholesale');assert(gls?.profile,'Brak kalkulatora GLS w CMS');
 const fee=(payment,method)=>{const values=payment.fees[method];assert(values?.length,'Brak niezależnej dopłaty CMS '+payment.code+'/'+method);assert(values.length===1||values.every(v=>v===values[0]),'Niejednoznaczne dopłaty CMS '+payment.code+'/'+method);return values[0];};
 const allowed=offers.filter(o=>o.shipping.includes(gls.code)).map(o=>payments.find(p=>p.code===o.code)).filter(Boolean);assert(allowed.length>=2,'Brak co najmniej dwóch dostępnych płatności');
 const main=allowed.find(p=>p.code==='cash_on_delivery')??allowed[0];
 s.packages={...s.packages,calculator:gls.profile,paymentCode:main.code,paymentSurchargeGrossMinor:fee(main,gls.code),source:gls.source};
 const source='Niezależny odczyt CMS '+references.readAt;
 s.nonCalculatorMethods=[];
 for(const offer of offers)for(const method of shipping.filter(m=>m.calculator==='flat_rate'&&offer.shipping.includes(m.code))){
  const payment=payments.find(p=>p.code===offer.code);assert(payment,'Brak wzorca płatności');
  // Jedna referencyjna kombinacja na metodę, bez wnioskowania cen z odpowiedzi API.
  if(s.nonCalculatorMethods.some(m=>m.shippingCode===method.code))continue;
  const gross=method.grossMinor+fee(payment,method.code);
  s.nonCalculatorMethods.push({shippingCode:method.code,paymentCode:payment.code,source,expected:{shippingTotal:gross,shippingTotalNet:Math.round(gross/1.05)}});
 }
 const timely=payments.find(p=>p.code==='payment_timely'),pickup=shipping.find(m=>m.code==='personal_collection');
 assert(timely&&pickup&&offers.find(p=>p.code===timely.code)?.shipping.includes(pickup.code),'Brak dostępnego odbioru własnego z płatnością terminową');
 const pickupGross=pickup.grossMinor+fee(timely,pickup.code);
 s.retest140g={...s.retest140g,shippingCode:pickup.code,paymentCode:timely.code,source,representation:'zero',expected:{shippingTotal:pickupGross,shippingTotalNet:Math.round(pickupGross/1.05)}};
 s.paymentVariants=allowed.map(p=>({paymentCode:p.code,surchargeGrossMinor:fee(p,gls.code)}));
 const variations=allowed.filter(p=>Number.isFinite(rebates[p.code]));assert(variations.length>=2,'Brak niezależnych rabatów konta w CMS');
 assert(new Set(variations.map(p=>rebates[p.code])).size>=2,'Konto nie ma różnych rabatów dla płatności');
 s.discountVariants=[{product:s.packages.product,source:source+'; rabaty hurtownika z CMS',steps:variations.map(p=>({quantity:1,shippingCode:gls.code,paymentCode:p.code,
  expected:{...packageQuote(s.packages.product.unitWeightGrams,gls.profile,fee(p,gls.code)),rebatePercent:rebates[p.code]}}))}];
 const palletFields=references.shipping.some(form=>form.fields.some(([key])=>/pallet|palet/i.test(key)));
 s.palletApplicability={supported:palletFields,source:source+'; wszystkie odczytane kalkulatory CMS: '+[...new Set(shipping.map(m=>m.calculator))].join(', ')+'. weight_range_shipping udostępnia wagę pojedynczej paczki i przedziały cen; '+(palletFields?'wykryto pola palet.':'brak pól konfiguracji palet.')};
 s.referenceSource={readAt:references.readAt,shipping:shipping.map(m=>({code:m.code,source:m.source,calculator:m.calculator})),payments:payments.map(p=>({code:p.code,source:p.source})),rebates};
 return s;
}
