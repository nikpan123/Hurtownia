import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runScenario } from '../api-tests/engine.mjs';
import { validateConfig, cookieHeader } from '../api-tests/config.mjs';
import { startMock } from './mock-server.mjs';

const credentials={email:'qa-test@example.invalid',password:'mock-password-private',testsToken:'mock-tests-token-private',cookie:'session=mock-cookie-private'};
export async function fixtureConfig(baseUrl) {
  const c=JSON.parse(await readFile('config/dev.example.json','utf8'));
  c.baseUrl=baseUrl;
  c.scenario.randomProducts.enabled=false;
  c.scenario.randomCheckout={payment:false,shipping:false};
  c.scenario.shippingMethodCode='inpost_kurier';
  c.scenario.expectations.afterPayment={itemsTotal:22500,items:{testhurtA:{quantity:3,rebatePercent:25,productName:'Produkt demonstracyjny WHOLESALE'}}};
  c.scenario.expectations.paymentQuotes={cash_on_delivery:{rebatePercent:25,orderItemTotal:22500}};
  c.scenario.expectations.paymentQuoteTotalBasis='gross';
  c.scenario.expectations.checkoutInformationIncludes=['shop_billing'];
  c.scenario.expectations.requirePaymentForm=true;
  c.scenario.expectations.lineRoundingToleranceMinor=0;
  return c;
}
async function exercise(options={},complete=true, mutate=()=>{}) {
  const mock=await startMock(options);
  try {
    const config=await fixtureConfig(mock.baseUrl);mutate(config);
    const directory=await mkdtemp(path.join(os.tmpdir(),'hurtownia-api-'));
    const result=await runScenario(config,credentials,{complete,allowLocal:true,directory});
    return {...result,requests:mock.requests,files:await readdir(directory),json:await readFile(path.join(directory,'raport.json'),'utf8'),html:await readFile(path.join(directory,'raport.html'),'utf8')};
  } finally {await mock.close();}
}
test('Pełny checkout, historia cen, dokumenty i brak sekretów w raporcie',async()=>{
  const r=await exercise();assert.equal(r.report.status,'PASS',r.report.error);
  assert.equal(r.report.documents.length,2);assert.equal(r.report.snapshots.length,5);
  assert(r.report.changes.some(c=>c.stage==='Po wyborze płatności'&&c.after.rebatePercent===25));
  assert(r.files.includes('pdfSummary.pdf'));
  for(const secret of [...Object.values(credentials),'mock-bearer-private','mock-order-token-private'])assert(!r.json.includes(secret),secret);
  assert(r.html.includes('Produkt demonstracyjny WHOLESALE'));
  assert.equal(r.requests.filter(r=>r.url.endsWith('/complete')).length,1);
  for (const request of r.requests.filter(r=>r.method==='PATCH')) assert.equal(request.headers['content-type'],'application/merge-patch+json');
});
test('Bez --complete nie finalizuje i nie pobiera PDF',async()=>{
  const r=await exercise({},false);assert.equal(r.report.status,'PASS',r.report.error);
  assert(!r.requests.some(r=>r.url.endsWith('/complete')));assert.equal(r.report.documents.length,0);
});
test('Lista dostaw jako tablica jest odczytywana obok formatu Hydra',async()=>{
  const r=await exercise({directShippingArray:true},false);
  assert.equal(r.report.status,'PASS',r.report.error);assert.equal(r.report.shippingMethods.length,2);
});
test('Losowy checkout wybiera metody z API i pobiera dostawy dopiero po zapisaniu płatności',async()=>{
  const r=await exercise({shippingByPayment:true},true,c=>{
    c.scenario.randomCheckout={payment:true,shipping:true,seed:'dynamic-checkout'};
    delete c.scenario.paymentMethodCode;
    delete c.scenario.shippingMethodCode;
  });
  assert.equal(r.report.status,'PASS',r.report.error);
  assert(r.report.payments.some(p=>p.code===r.report.selectedPayment));
  const expectedShipping=r.report.selectedPayment==='bank_transfer_1_day'?'pickup':'inpost_kurier';
  assert.equal(r.report.selectedShipping,expectedShipping);
  const payment=r.requests.find(r=>r.url.endsWith('/payment-method'));
  const shippingListIndex=r.requests.findIndex(r=>r.method==='GET'&&r.url.includes('/checkout-step-two/'));
  assert(r.requests.indexOf(payment)<shippingListIndex);
  assert.equal(payment.body.paymentMethodCode,r.report.selectedPayment);
  assert.equal(r.requests.find(r=>r.method==='POST'&&r.url.includes('/checkout-step-two/')).body.shippingMethodCode,expectedShipping);
  assert.equal(r.report.checkoutSelection.seed,'dynamic-checkout');
});
test('Losowanie nie używa stałych kodów, gdy API nie oferuje żadnych metod',async()=>{
  for(const options of [{emptyPayments:true},{emptyShipping:true}]) {
    const r=await exercise(options,true,c=>{c.scenario.randomCheckout={payment:true,shipping:true,seed:'empty'};});
    assert.equal(r.report.status,'FAIL');
    assert(!r.requests.some(r=>r.url.endsWith('/complete')));
    if(options.emptyPayments)assert(!r.requests.some(r=>r.url.endsWith('/payment-method')));
    if(options.emptyShipping)assert(!r.requests.some(r=>r.method==='POST'&&r.url.includes('/checkout-step-two/')));
  }
});
test('Wylosowany plan jest wysyłany do API i zapisywany w raporcie',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'hurtownia-catalog-'));
  const catalogFile=path.join(folder,'products.json');
  await writeFile(catalogFile,JSON.stringify({products:[{productVariant:'testhurtA',merchandiseCode:'inny-kod-handlowy',group:'pozostale'}]}));
  const r=await exercise({},false,c=>{
    c.scenario.randomProducts={enabled:true,catalogFile,group:'random',seed:'regression-plan',productCount:[1,1],quantity:[2,2],editedQuantity:[3,3]};
  });
  assert.equal(r.report.status,'PASS',r.report.error);
  assert.equal(r.report.productSelection.seed,'regression-plan');
  const bulk=r.requests.find(r=>r.url.endsWith('/items/bulk'));
  assert.deepEqual(bulk.body.items,[{productVariant:'testhurtA',quantity:2}]);
  assert.equal(r.report.products[0].merchandiseCode,'inny-kod-handlowy');
  assert(r.html.includes('regression-plan'));assert(r.html.includes('Grupa koszyka'));
});
test('Oferta płatności netto jest porównywana z netto produktów, bez kosztu dostawy',async()=>{
  const r=await exercise({quoteNet:true},false,c=>{
    c.scenario.expectations.paymentQuoteTotalBasis='net';
    c.scenario.expectations.paymentQuotes.cash_on_delivery.orderItemTotal=21429;
  });
  assert.equal(r.report.status,'PASS',r.report.error);
  assert.equal(r.report.paymentQuoteTotalBasis,'net');
});
test('Błędna suma zatrzymuje przed finalizacją i zapisuje raport błędu',async()=>{
  const r=await exercise({brokenTotal:true});assert.equal(r.report.status,'FAIL');assert(r.report.error.includes('do zapłaty'));
  assert(!r.requests.some(r=>r.url.endsWith('/complete')));assert(r.files.includes('raport.html'));
});
test('422 zapisuje komunikat walidacji API bez śladu serwera i sekretów',async()=>{
  const r=await exercise({rejectBulk:true});
  assert.equal(r.report.status,'FAIL');assert(r.report.error.includes('Produkt jest niedostępny'));
  assert(r.html.includes('items[0].productVariant'));assert(!r.json.includes('mock-password-private'));
  assert(!r.requests.some(r=>r.url.endsWith('/complete')));
});
test('Przekierowanie GitLab nie jest uznawane za udane API',async()=>{
  const r=await exercise({redirect:true});assert.equal(r.report.status,'FAIL');assert.equal(r.requests.length,1);
});
test('HTML z kodem 200 od bramki nie przechodzi jako sukces',async()=>{
  const c=await fixtureConfig('http://127.0.0.1:11111/api/v2');
  const directory=await mkdtemp(path.join(os.tmpdir(),'hurtownia-api-'));
  const r=await runScenario(c,credentials,{allowLocal:true,directory,fetchImpl:async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})});
  assert.equal(r.report.status,'FAIL');assert(r.report.error.includes('HTML'));
});
test('Niedostępna płatność musi zostać odrzucona i nie zmieniać zamówienia',async()=>{
  const r=await exercise({},true,c=>{c.scenario.forbiddenPaymentCodes=['forbidden'];});assert.equal(r.report.status,'PASS',r.report.error);
});
test('Znany błąd: akceptacja niedostępnej płatności blokuje finalizację',async()=>{
  const r=await exercise({acceptForbidden:true},true,c=>{c.scenario.forbiddenPaymentCodes=['forbidden'];});
  assert.equal(r.report.status,'FAIL');assert(!r.requests.some(r=>r.url.endsWith('/complete')));
});
test('Uszkodzony PDF nie daje zielonego raportu',async()=>{
  const r=await exercise({badPdf:true},true,c=>{c.pdfRetryMs=1;c.pdfAttempts=2;});assert.equal(r.report.status,'FAIL');assert.equal(r.report.documents.length,0);
});
test('Nie ponawia finalizacji po utracie odpowiedzi',async()=>{
  const r=await exercise({completeTimeout:true},true,c=>{c.timeoutMs=50;});
  assert.equal(r.report.status,'FAIL');assert.equal(r.requests.filter(r=>r.url.endsWith('/complete')).length,1);
  assert.equal(r.report.finalization,'rozpoczęta — wynik niepotwierdzony');
});
test('Nieprawidłowy rabat Adamady w ofertach blokuje finalizację',async()=>{
  const r=await exercise({},true,c=>{c.scenario.expectations.allPaymentRebatePercent=30;});
  assert.equal(r.report.status,'FAIL');assert(r.report.error.includes('rabat dla każdej płatności'));assert(!r.requests.some(r=>r.url.endsWith('/complete')));
});
function adamadaScenario(c) {
  c.scenario.products[0].group='adamada';
  c.scenario.expectations.afterPayment={};
  c.scenario.expectations.paymentQuotes={};
}
test('Adamadzie przysługuje 10% w każdej ofercie i na pozycjach koszyka',async()=>{
  const r=await exercise({itemRebatePercent:10,paymentRebatePercent:10},false,adamadaScenario);
  assert.equal(r.report.status,'PASS',r.report.error);
  assert(r.report.checks.some(c=>c.name.includes('rabat grupy adamada')&&c.status==='PASS'));
});
test('Oferta Adamady 10% i pozycja 50% dają jednoznaczny błąd przed complete',async()=>{
  const r=await exercise({itemRebatePercent:50,paymentRebatePercent:10},true,adamadaScenario);
  assert.equal(r.report.status,'FAIL');assert(r.report.error.includes('oczekiwano 10%, otrzymano 50%'));
  assert(!r.requests.some(r=>r.url.endsWith('/complete')));
});
test('Niepoprawne oferty Adamady zatrzymują test przed wyborem płatności',async()=>{
  const r=await exercise({itemRebatePercent:10,paymentRebatePercent:25},true,adamadaScenario);
  assert.equal(r.report.status,'FAIL');assert(r.report.error.includes('oczekiwano 10%, otrzymano 25%'));
  assert(!r.requests.some(r=>r.url.endsWith('/payment-method')));
});
test('Reguła 10% Adamady nie jest stosowana do pozostałych produktów',async()=>{
  const r=await exercise({},false,c=>{c.scenario.products[0].group='pozostale';});
  assert.equal(r.report.status,'PASS',r.report.error);
});
test('Zamówienie łączy kod i ISBN tego samego produktu',async()=>{
  const r=await exercise({},false,c=>{c.scenario.products=[{productVariant:'testhurtA',quantity:1,newQuantity:3},{isbn:'9780306406157',quantity:2}];});
  assert.equal(r.report.status,'PASS',r.report.error);
});
test('Test jest zablokowany także przy oznaczeniu hosta gwotest jako dev',()=>{
  for(const environment of ['dev','test'])assert.throws(()=>validateConfig({environment,baseUrl:'https://hurt.gwotest.pl/api/v2',enabled:true}),/zablokowane/);
  assert.doesNotThrow(()=>validateConfig({environment:'test',baseUrl:'https://hurt.gwotest.pl/api/v2',enabled:false},{plan:true}));
  assert.throws(()=>validateConfig({environment:'test',baseUrl:'https://hurt.gwotest.pl/api/v2',enabled:false},{allowTest:true}),/wyłączone/);
});
test('Ciasteczka respektują domenę, ścieżkę, secure i wygaśnięcie',()=>{
  const cookies=[{name:'a',value:'1',domain:'.gwodev.pl',path:'/',secure:true,expires:-1},{name:'gitlab',value:'secret',domain:'gitlab.gwo.pl',path:'/'},{name:'admin',value:'secret',domain:'ksiegarnia.gwodev.pl',path:'/admin'},{name:'expired',value:'secret',domain:'ksiegarnia.gwodev.pl',path:'/',expires:1}];
  assert.equal(cookieHeader(cookies,'https://ksiegarnia.gwodev.pl/api/v2'),'a=1');
  assert.equal(cookieHeader(cookies,'http://ksiegarnia.gwodev.pl/api/v2'),'');
});
