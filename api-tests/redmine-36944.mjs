import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {descriptionContext} from './features.mjs';

export const roundingCases=[
 {id:'HURT-36944-01',channel:'WHOLESALE',quantity:1,field:'discountedUnitPriceNet',expected:1349,name:'WHOLESALE — 1 sztuka: 13,49 zł netto'},
 {id:'HURT-36944-02',channel:'WHOLESALE',quantity:6,field:'total',expected:8499,name:'WHOLESALE — 6 sztuk: 84,99 zł brutto produktów'}
];
class MissingCondition extends Error {constructor(message,reason='data_missing'){super(message);this.reason=reason;}}
const value=n=>Number.isSafeInteger(n)?(n/100).toFixed(2).replace('.',',')+' zł':'brak poprawnej kwoty';
export function validateRoundingSettings(settings){
 assert.equal(settings.baseGrossMinor,1840,'#36944 wymaga ceny bazowej 1840 gr.');
 assert.equal(settings.baseNetMinor,1752,'#36944 wymaga ceny netto bazowej 1752 gr.');
 assert.equal(settings.rebatePercent,23,'#36944 wymaga rabatu/promocji 23%.');
 assert(typeof settings.WHOLESALE?.productVariant==='string'&&settings.WHOLESALE.productVariant.trim(),'Brak kodu produktu WHOLESALE');
 return settings;
}
export async function runRounding36944(config,credentials,options={}){
 const settings=validateRoundingSettings(options.settings??JSON.parse(await readFile('config/redmine-36944.local.json','utf8')));
 const selected=options.caseIds?roundingCases.filter(c=>options.caseIds.includes(c.id)):roundingCases;
 assert(selected.length&&(!options.caseIds||options.caseIds.every(id=>roundingCases.some(c=>c.id===id))),'Wybierz istniejące przypadki #36944.');
 const vars=options.vars??process.env;
 const accountEmail=vars.HURT_ROUNDING_EMAIL?.trim()||credentials.email;
 const c=await descriptionContext(config,{...credentials,email:accountEmail},options,'Redmine #36944 — API nowej hurtowni: 1 i 6 sztuk','rounding');
 const {report,api}=c;report.issue=36944;report.apiOnlyWholesale=true;report.reference={baseGrossMinor:1840,baseNetMinor:1752,rebatePercent:23,WHOLESALE:settings.WHOLESALE};report.attempts=[];
 report.scopeNote='Wyłącznie API nowej hurtowni, kanał WHOLESALE. Osobny nowy koszyk dla 1 i 6 sztuk produktu za 18,40 zł brutto, VAT 5%. Konto HURT_ROUNDING_EMAIL i rzeczywiście dostępna metoda płatności z rabatem 23%. Oczekiwania: discountedUnitPriceNet = 1349 gr dla 1 sztuki; total pozycji = itemsTotal = 8499 gr dla 6 sztuk. Dostawa poza wzorcem produktów. Bez finalizacji zamówienia; koszyki pozostają na DEV. Bez RETAIL, przeglądarki i operacji CMS.';
 const rows=[];report.tables.push({title:'Oczekiwane i rzeczywiste wartości — bez kosztów dostawy',headers:['Przypadek','Kanał','Szt.','Pole','Oczekiwano','Odczytano','Różnica w groszach','Produkty brutto','Dostawa','Cały koszyk'],rows});
 const logged=await c.test('Przygotowanie — logowanie konta API',async()=>{await api.loginShop();return 'Zalogowano konto testowe. Tokeny nie są zapisywane w raporcie.';});
 for(const scenario of selected){
  options.signal?.throwIfAborted();
  const {id,channel,quantity,field,expected}=scenario,name=id+': '+scenario.name;
  if(!logged){c.skip(name,'Logowanie nie powiodło się.',[id],'dependency');continue;}
  const start=api.requests.length,attempt={caseId:id,channel,quantity,expected:{field,value:expected}};report.attempts.push(attempt);options.onProgress?.(name);
  const evidence=()=>({requests:api.requests.slice(start),...(attempt.actual?{observations:[[channel,attempt.cartId,attempt.productVariant,quantity,attempt.actual.rebatePercent,attempt.actual.discountedUnitPriceNet,attempt.actual.total,attempt.actual.shippingTotal,null,null]]}:{})});
  const request=async(method,endpoint,body,statuses=[200])=>{
   const r=await api.request(method,endpoint,{channel,...(body!==undefined?{body}:{})});
   assert(statuses.includes(r.status),method+' '+api.clean(endpoint)+': HTTP '+r.status);return r.data;
  };
  try{
   const created=await request('POST','shop/orders',{localeCode:'pl_PL'},[200,201]);assert(typeof created.tokenValue==='string'&&created.tokenValue,'Brak tokenu nowego koszyka');
   api.secrets.push(created.tokenValue,encodeURIComponent(created.tokenValue));attempt.cartId=created.id;
   const endpoint='shop/orders/'+encodeURIComponent(created.tokenValue),product=settings.WHOLESALE.productVariant;
   attempt.productVariant=product;
   await request('POST',endpoint+'/items/bulk',{items:[{productVariant:product,quantity:1}]},[200,201,204]);
   const base=await request('GET',endpoint);assert.equal(base.id,created.id,'Odczytano inny koszyk');assert.equal(base.items?.length,1,'Koszyk musi zawierać dokładnie jedną pozycję');const initial=base.items[0];assert(Number.isSafeInteger(initial.id),'Brak ID pozycji');assert.equal(initial.quantity,1);
   attempt.base={unitPrice:initial.unitPrice,originalUnitPrice:initial.originalUnitPrice,unitPriceNet:initial.unitPriceNet,taxRate:initial.taxRate};
   if(initial.unitPrice!==1840||initial.originalUnitPrice!==1840||initial.unitPriceNet!==1752||Number(initial.taxRate)!==0.05)throw new MissingCondition('Produkt nie odpowiada wzorcowi 18,40 zł brutto / 17,52 zł netto / VAT 5%. Odczyt: '+JSON.stringify(attempt.base));
   if(channel==='WHOLESALE'){
    const payments=await request('GET','wholesale/orders/'+encodeURIComponent(created.tokenValue)+'/payments');assert(Array.isArray(payments),'Oferta płatności nie jest listą');
    attempt.paymentOffers=payments.map(p=>({code:p.code,rebatePercent:p.rebatePercent}));
    const payment=payments.find(p=>p.rebatePercent===23&&(!settings.WHOLESALE.paymentCode||p.code===settings.WHOLESALE.paymentCode));
    if(!payment)throw new MissingCondition('Brak dostępnej płatności z rabatem 23%. Oferta konta: '+attempt.paymentOffers.map(p=>p.code+' '+p.rebatePercent+'%').join(', '));
    attempt.paymentCode=payment.code;await request('PATCH','wholesale/orders/'+encodeURIComponent(created.tokenValue)+'/payment-method',{paymentMethodCode:payment.code},[200,204]);
   }
   if(quantity!==1)await request('PATCH',endpoint+'/items/'+encodeURIComponent(initial.id),{quantity},[200,204]);
   const order=await request('GET',endpoint);assert.equal(order.id,created.id,'Odczytano inny koszyk');assert.equal(order.items?.length,1,'Nieoczekiwana liczba pozycji');const item=order.items[0];
   assert.equal(item.id,initial.id,'Odczytano inną pozycję');assert.equal(item.quantity,quantity,'Nie zapisano żądanej ilości');
   attempt.actual={discountedUnitPriceNet:item.discountedUnitPriceNet,total:item.total,itemsTotal:order.itemsTotal,shippingTotal:order.shippingTotal,orderTotal:order.total,rebatePercent:item.rebatePercent,orderPromotionTotal:order.orderPromotionTotal,unitPrice:item.unitPrice};
   rows.push([id,channel,quantity,field,value(expected),value(item[field]),Number.isSafeInteger(item[field])?item[field]-expected:'brak',value(order.itemsTotal),value(order.shippingTotal),value(order.total)]);
   const checkAmounts=async()=>{
   assert.equal(item.unitPrice,1840,'Zmieniła się cena bazowa');if(channel==='WHOLESALE')assert.equal(item.rebatePercent,23,'Koszyk nie zachował rabatu 23%');
   for(const [k,v]of Object.entries({[field]:item[field],itemsTotal:order.itemsTotal,shippingTotal:order.shippingTotal,total:order.total}))assert(Number.isSafeInteger(v),'Nieprawidłowa kwota '+k);
   assert.equal(order.itemsTotal,item.total,'Suma produktów nie zgadza się z jedyną pozycją');assert.equal(order.total,order.itemsTotal+order.shippingTotal,'Produkty + dostawa nie zgadzają się z sumą koszyka');
   assert.equal(item[field],expected,id+': oczekiwano '+value(expected)+', API zwróciło '+value(item[field])+'; różnica '+(item[field]-expected)+' gr');
   };
   if(options.debuggerSession)await options.debuggerSession.operation(id+' — sprawdź '+field+': oczekiwano '+value(expected)+', odczytano '+value(item[field]),checkAmounts);
   else await checkAmounts();
   report.tests.push({name,status:'PASS',scenarioIds:[id],detail:'Porównano '+field+': '+value(item[field])+' = '+value(expected)+'. Koszt dostawy nie jest częścią wzorca produktów.',evidence:evidence()});
  }catch(e){
   if(options.signal?.aborted)throw e;
   report.tests.push({name,status:e instanceof MissingCondition?'SKIP':'FAIL',...(e instanceof MissingCondition?{skipReason:e.reason}:{}),scenarioIds:[id],detail:api.clean(e.message),evidence:evidence()});
  }
  attempt.status=report.tests.at(-1).status;
 }
 return c.finish();
}
