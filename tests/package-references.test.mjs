import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {shippingReference,paymentReference,pickupTarget,protectPickup,restorePickup,buildPackageSettings} from '../api-tests/package-references.mjs';
import {comparePackagePdf,comparePackagePanel,packageDocumentVerifier} from '../api-tests/package-documents.mjs';

const shipping=(code,calculator='flat_rate')=>({route:'/shipping-methods/4/edit',fields:[['sylius_shipping_method[code]',code],['sylius_shipping_method[enabled]','1'],['sylius_shipping_method[channels][]','WHOLESALE'],['sylius_shipping_method[taxCategory]','books'],['sylius_shipping_method[calculator]',calculator],['sylius_shipping_method[categoryRequirement]','1'],['sylius_shipping_method[configuration][WHOLESALE][amount]','7,55'],...Object.entries({singlePackageWeight:'8000',priceIsNet:'1','weightRanges][0][orderWeightFrom':'0','weightRanges][0][orderWeightTo':'999999','weightRanges][0][pricePerPackage':'15,00'}).map(([k,v])=>['sylius_shipping_method[configuration]['+k+']',v])]});
const payment=(code,fee)=>({route:'/payment-methods/1/edit',fields:[['sylius_payment_method[code]',code],...['gls_wholesale','personal_collection','poczta_polska'].flatMap((method,i)=>Object.entries({shippingMethod:method,calculator:'flat_rate',taxCategory:'books','calculatorConfiguration][WHOLESALE][amount':fee}).map(([k,v])=>['sylius_payment_method[paymentMethodFees]['+i+']['+k+']',v]))]});
const refs={readAt:'2026-10-21',taxRows:['books_sales_tax_5 Podatek Książki 5%'],shipping:[shipping('gls_wholesale','weight_range_shipping'),shipping('personal_collection'),shipping('poczta_polska')],payments:[payment('cash_on_delivery','15,00'),payment('payment_timely','0,00')]};
const offers=[{code:'cash_on_delivery',shipping:['gls_wholesale','personal_collection','poczta_polska']},{code:'payment_timely',shipping:['gls_wholesale','personal_collection']}];
const settings={packages:{product:{productVariant:'book',unitWeightGrams:140}},retest140g:{product:{productVariant:'book',unitWeightGrams:140}}};

test('Wzorce pochodzą z CMS: kwoty, kalkulator, odbiór, różne płatności i rabaty',()=>{
 assert.equal(shippingReference(refs.shipping[0]).profile.singlePackageWeight,8000);
 assert.equal(paymentReference(refs.payments[0]).fees.gls_wholesale[0],1500);
 const s=buildPackageSettings(settings,refs,offers,{cash_on_delivery:50,payment_timely:25});
 assert.equal(s.packages.paymentSurchargeGrossMinor,1500);assert.equal(s.retest140g.paymentCode,'payment_timely');
 assert.deepEqual(s.retest140g.expected,{shippingTotal:755,shippingTotalNet:719});
 assert.equal(s.nonCalculatorMethods.length,2);assert.equal(s.paymentVariants.length,2);
 assert.equal(s.discountVariants[0].steps[1].expected.rebatePercent,25);
 assert.equal(s.palletApplicability.supported,false);assert.equal(settings.packages.calculator,undefined);
});

test('Brak VAT, dostępnego odbioru lub różnych rabatów nie jest zastępowany zgadywaniem',()=>{
 assert.throws(()=>buildPackageSettings(settings,{...refs,taxRows:[]},offers,{cash_on_delivery:50,payment_timely:25}));
 assert.throws(()=>buildPackageSettings(settings,refs,offers.map(o=>({...o,shipping:['gls_wholesale']})),{cash_on_delivery:50,payment_timely:25}));
 assert.throws(()=>buildPackageSettings(settings,refs,offers,{cash_on_delivery:50,payment_timely:50}));
});

test('Tymczasowa dostępność odbioru jest przywracana po sukcesie i błędzie',async()=>{
 for(const fail of [false,true]){
  const original=shipping('personal_collection');original.fields=original.fields.filter(([k])=>k!=='sylius_shipping_method[channels][]');
  const {sortedFields}=await import('../api-tests/package-cms.mjs');original.fields=sortedFields(original.fields);
  let current=structuredClone(original);const writes=[];
  const adapter={pickup:async()=>structuredClone(current),savePickup:async(before,after)=>{assert.deepEqual(before,current);writes.push(after);current=structuredClone(after);}};
  const file=path.join(await mkdtemp(path.join(os.tmpdir(),'pickup-')),'restore.json');
  const work=protectPickup(adapter,async()=>{assert.deepEqual(current,pickupTarget(original));if(fail)throw Error('Błąd API');return {report:{tests:[]}};},{file});
  if(fail)await assert.rejects(work,/Błąd API/);else await work;
  assert.deepEqual(current,original);assert.equal(writes.length,2);await assert.rejects(()=>access(file));
 }
});

test('Obca zmiana odbioru nie jest nadpisywana; dziennik pozostaje do odzyskania',async()=>{
 const {sortedFields}=await import('../api-tests/package-cms.mjs');const original=shipping('personal_collection');original.fields=sortedFields(original.fields);
 let current=original;const adapter={pickup:async()=>structuredClone(current),savePickup:async(_,next)=>{current=structuredClone(next);}};
 const file=path.join(await mkdtemp(path.join(os.tmpdir(),'pickup-')),'restore.json');
 await assert.rejects(()=>protectPickup(adapter,async()=>{current.fields.push(['obca','zmiana']);throw Error('przerwano');},{file}),/zmieniony poza/);
 assert(JSON.parse(await readFile(file,'utf8')).original);await assert.rejects(()=>restorePickup(adapter,{file}),/zmieniony poza/);
});

test('Nieudane przywrócenie odbioru zachowuje raport wykonanych testów i oznacza FAIL',async()=>{
 const {sortedFields}=await import('../api-tests/package-cms.mjs');const original=shipping('personal_collection');original.fields=sortedFields(original.fields);
 let current=original,writes=0;const adapter={pickup:async()=>structuredClone(current),savePickup:async(_,next)=>{if(++writes===2)throw Error('Błąd CMS przywracania');current=structuredClone(next);}};
 const file=path.join(await mkdtemp(path.join(os.tmpdir(),'pickup-')),'restore.json');
 const result=await protectPickup(adapter,async()=>({report:{status:'PASS',tests:[{name:'T04',status:'PASS'}]}}),{file});
 assert.equal(result.report.status,'FAIL');assert.equal(result.report.restorationFailed,true);assert.equal(result.report.tests[0].name,'T04');assert.equal(result.report.tests.at(-1).status,'FAIL');await access(file);
});

const order={id:12,number:'30001699',shipmentPackageQuantity:2,shippingTotal:3600,total:4100,items:[{product:{code:'qa'},productName:'Książka QA',quantity:5}]};
test('Panel i PDF mają niezależne kontrole paczek, kosztu i sumy; błędy dokumentu dają FAIL',()=>{
 const pdf='Zamówienie GWO 30001699 Książka QA Sposób pakowania: paczka (liczba paczek: 2) Przesyłka kurierska (GLS): 36,00 zł do zapłaty: 41,00 zł';
 assert(comparePackagePdf(order,pdf).every(c=>c.status==='PASS'));
 assert(comparePackagePdf(order,pdf.replace('paczek: 2','paczek: 3')).some(c=>c.status==='FAIL'&&c.name.includes('liczba paczek')));
 assert(comparePackagePdf(order,pdf.replace('36,00','72,00')).some(c=>c.status==='FAIL'&&c.name.includes('koszt')));
 const panel={heading:'Zamówienie #30001699',rows:[['Książka QA','','','','','','5'],['Koszt wysyłki: 36,00 zł'],['Suma zamówienia: 41,00 zł']]};
 assert(comparePackagePanel(order,panel).every(c=>c.status==='PASS'));
 assert(comparePackagePanel(order,{...panel,rows:[...panel.rows.slice(0,2),['Suma zamówienia: 42,00 zł']]}).some(c=>c.status==='FAIL'));
});

test('Ponowny odczyt dokumentu używa CMS i ID zamówienia, bez tokenu koszyka ani nowego complete',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'package-document-'));
 const panel={heading:'Zamówienie 30001699',rows:[['Książka QA','','','','','','5'],['Koszt wysyłki: 36,00 zł'],['Suma zamówienia: 41,00 zł']]};
 let downloads=0;
 const cms={savedOrder:async o=>{assert.equal(o.id,12);return panel;},downloadOrderPdf:async(o,file)=>{downloads++;assert.equal(o.number,'30001699');await writeFile(file,'%PDF-1.4 test');}};
 const verify=packageDocumentVerifier({}, {}, {cms,directory,fetchPdf:()=>assert.fail('Nie pobieraj przez token API'),extractText:async()=>({pages:1,text:'Zamówienie 30001699 Książka QA liczba paczek: 2 Przesyłka kurierska: 36,00 zł do zapłaty: 41,00 zł'})});
 const result=await verify(order);assert(result.checks.every(c=>c.status==='PASS'));assert.equal(downloads,1);assert.equal(result.documents[0].file,'potwierdzenie-30001699.pdf');
});
