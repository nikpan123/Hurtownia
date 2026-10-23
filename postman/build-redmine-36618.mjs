import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const filename='HURTOWNIA - Redmine 36618 - zmiana dostawy.postman_collection.json';
const event=(listen,code)=>({listen,script:{type:'text/javascript',exec:code.split('\n')}});
const common=`
function need(ok,message){if(!ok)throw new Error(message);}
function value(k){return pm.variables.get(k);}
function set(k,v){pm.variables.set(k,v);}
function stop(message){set('r36618_blocked',true);pm.execution.setNextRequest(null);throw new Error(message);}
function body(data){pm.request.body.update(JSON.stringify(data));}
function json(){try{return pm.response.json();}catch(e){stop('Brak JSON — sprawdź sesję GitLab i adres API.');}}
function ok(codes){const pass=codes.includes(pm.response.code);pm.test('HTTP '+codes.join('/'),()=>pm.expect(pass).to.eql(true));if(!pass)stop('Niepoprawny HTTP '+pm.response.code+' — dalsze kroki zatrzymane.');}
function methods(data){return Array.isArray(data)?data:data?.['hydra:member']??data?.member??[];}
function code(method){return typeof method==='string'?method:method?.code;}
`;
function request(name,method,path,{pre='',test='',data,description='',login=false}={}){
 const before=common+`
if(${login}){
 set('r36618_blocked',false);
 for(const k of ['r36618_jwt','r36618_token','r36618_path','r36618_item','r36618_before'])pm.variables.unset(k);
}
try{
 need(!value('r36618_blocked'),'Poprzedni krok nie powiódł się. Uruchom folder od logowania.');
 need(value('base_url') === 'https://ksiegarnia.gwodev.pl/api/v2','Kolekcja przeznaczona dla https://ksiegarnia.gwodev.pl/api/v2');
 ${pre}
}catch(e){set('r36618_blocked',true);pm.execution.setNextRequest(null);pm.execution.skipRequest();throw e;}`;
 return {name,request:{method,auth:login?{type:'noauth'}:{type:'bearer',bearer:[{key:'token',value:'{{r36618_jwt}}',type:'string'}]},
 header:[{key:'Accept',value:'application/json'},{key:'X-Api-Channel',value:'WHOLESALE'},{key:'X-Tests-Token',value:'{{tests_token}}'},...(data!==undefined?[{key:'Content-Type',value:method==='PATCH'?'application/merge-patch+json':'application/json'}]:[])],
 url:'{{base_url}}'+path,description,...(data!==undefined?{body:{mode:'raw',raw:JSON.stringify(data,null,2),options:{raw:{language:'json'}}}}:{})},
 event:[event('prerequest',before),event('test',common+`try{${test}}catch(e){set('r36618_blocked',true);pm.execution.setNextRequest(null);throw e;}`)],protocolProfileBehavior:{followRedirects:false}};
}

function readTest(shipping,expected,final){return `
ok([200]);const order=json();
const selected=code(order.shipments?.[0]?.method);
pm.test('Zapisana metoda dostawy: ${shipping}',()=>pm.expect(selected).to.eql('${shipping}'));
pm.test('Zapisana płatność: '+value('payment_code'),()=>pm.expect(code(order.payments?.[0]?.method)).to.eql(value('payment_code')));
pm.test('Jedna pozycja z poprawną ilością',()=>{pm.expect(order.items).to.have.lengthOf(1);pm.expect(order.items[0].quantity).to.eql(${expected.quantity});});
const expected=${JSON.stringify(expected)};
const observed={cartId:order.id,shippingMethod:selected,shipmentPackageQuantity:order.shipmentPackageQuantity,shippingTotal:order.shippingTotal,shippingTotalNet:order.shippingTotalNet};
for(const field of ['shippingTotal','shippingTotalNet'])pm.test('${final?'PO ZMIANIE':'PRZED ZMIANĄ'}: '+field+' = '+expected[field]+' gr',()=>pm.expect(order[field]).to.eql(expected[field]));
pm.test('${final?'PO ZMIANIE':'PRZED ZMIANĄ'}: liczba paczek ${expected.noCalculator?'bez dodatniej wartości':expected.shipmentPackageQuantity}',()=>{
 ${expected.noCalculator?'pm.expect(order.shipmentPackageQuantity===0||order.shipmentPackageQuantity===null||order.shipmentPackageQuantity===undefined).to.eql(true);':`pm.expect(order.shipmentPackageQuantity).to.eql(${expected.shipmentPackageQuantity});`}
});
console.log('${final?'PO ZMIANIE':'PRZED ZMIANĄ'} #36618 — kwoty w groszach',observed,'OCZEKIWANO',expected);
${final?'':`set('r36618_before',JSON.stringify(observed));
if(selected!=='${shipping}'||order.items?.length!==1||order.items[0].quantity!==expected.quantity||order.shippingTotal!==expected.shippingTotal||order.shippingTotalNet!==expected.shippingTotalNet||${expected.noCalculator?'!(order.shipmentPackageQuantity===0||order.shipmentPackageQuantity===null||order.shipmentPackageQuantity===undefined)':'order.shipmentPackageQuantity!==expected.shipmentPackageQuantity'})stop('Niepoprawny stan początkowy — nie oceniaj regresji zmiany dostawy.');`}
pm.visualizer.set('<h2>#36618 — ${final?'Po zmianie':'Stan początkowy'}</h2><p>Kwoty w groszach. Dane oczekiwane pochodzą z konfiguracji CMS opisanej w instrukcji.</p><pre>{{details}}</pre>',{details:JSON.stringify({before:value('r36618_before')?JSON.parse(value('r36618_before')):null,expected,actual:observed},null,2)});
`;}

export function buildCollection(){
 const root='/shop/orders/{{r36618_path}}',wholesale='/wholesale/orders/{{r36618_path}}',checkout='/wholesale/checkout-step-two/{{r36618_path}}';
 const gls={quantity:58,shipmentPackageQuantity:2,shippingTotal:3600,shippingTotalNet:3429};
 const flat=quantity=>({quantity,noCalculator:true,shippingTotal:2000,shippingTotalNet:1905});
 function folder(id,from,to,initial,after){
  const select=(prefix,shipping)=>[
   request(prefix+'a — dostępne płatności','GET',wholesale+'/payments',{test:`ok([200]);need(methods(json()).some(m=>m.code===value('payment_code')),'Brak wymaganej płatności');`}),
   request(prefix+'b — zapisz płatność','PATCH',wholesale+'/payment-method',{data:{paymentMethodCode:'{{payment_code}}'},test:'ok([200,204]);'}),
   request(prefix+'c — dostępne dostawy','GET',checkout,{test:`ok([200]);need(methods(json().shippingMethods).some(m=>m.code==='${shipping}'),'Brak wymaganej dostawy ${shipping}');`}),
   request(prefix+'d — zapisz dostawę '+shipping,'POST',checkout,{data:{},pre:`const shipping=JSON.parse(value('shipping_address_json')),billing=JSON.parse(value('billing_address_json'));body({orderTokenValue:value('r36618_token'),shippingMethodCode:'${shipping}',shippingAddress:{...shipping,saveToAddressBook:false,isDefault:false},billingAddress:{...billing,saveToAddressBook:false,isDefault:false}});`,test:'ok([200,201,204]);'})
  ];
  const change=quantity=>request('Zapis ilości: '+quantity,'PATCH',root+'/items/{{r36618_item}}',{data:{quantity},test:'ok([200,204]);'});
  return {name:id+' — '+from+' → '+to,description:'Uruchom cały folder od logowania. Osobny nowy koszyk, bez finalizacji. Oczekiwane ceny dla cash_on_delivery i potwierdzonej konfiguracji opisanej w instrukcji. Wszystkie asercje końcowe wykonują się niezależnie.',item:[
   request('01 — logowanie hurtownika','POST','/shop/authentication-token',{login:true,data:{},pre:`need(value('email')&&value('api_password')&&value('tests_token'),'Uzupełnij lokalnie email, api_password i tests_token.');need(value('product_variant_140g'),'Uzupełnij product_variant_140g — aktywny wariant książki 140 g, VAT 5%.');need(value('payment_code')==='cash_on_delivery','Wzorce kolekcji wymagają cash_on_delivery.');body({email:value('email'),apiPassword:value('api_password')});`,test:`ok([200]);const b=json();const t=typeof b==='string'?b:b?.token??b?.accessToken??b?.bearerToken??b?.jwt??b?.data?.token;need(typeof t==='string'&&t,'Brak JWT');set('r36618_jwt',t);`}),
   request('02 — utwórz nowy koszyk','POST','/shop/orders',{data:{localeCode:'pl_PL'},test:`ok([200,201]);const o=json();need(o.tokenValue&&!o.number,'Nieprawidłowy nowy koszyk');set('r36618_token',o.tokenValue);set('r36618_path',encodeURIComponent(o.tokenValue));console.log('${id} — ID nowego koszyka',o.id);`}),
   request('03 — dodaj jedną książkę 140 g','POST',root+'/items/bulk',{data:{},pre:`body({items:[{productVariant:value('product_variant_140g'),quantity:1}]});`,test:'ok([200,201,204]);'}),
   request('04 — pobierz ID pozycji','GET',root,{test:`ok([200]);const o=json();need(o.items?.length===1&&o.items[0].id,'Oczekiwano jednej pozycji');set('r36618_item',o.items[0].id);`}),
   change(initial.quantity),...select('06',from),
   request('07 — potwierdź poprawny stan początkowy','GET',root,{test:readTest(from,initial,false)}),
   change(after.quantity),...select('09',to),
   request('10 — WERYFIKACJA BŁĘDU po zmianie dostawy','GET',root,{test:readTest(to,after,true),description:'Ten GET jest dowodem. HTTP 200 nie oznacza poprawnej wyceny. Oddzielne testy porównują metodę, liczbę paczek, brutto i netto. FAIL oznacza rozbieżność z niezależnym wzorcem; nie jest oczekiwanym wynikiem poprawnej implementacji.'})
  ]};
 }
 return {info:{name:'Hurtownia #36618 — reprodukcja T06 i T07',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:`Dwa niezależne odtworzenia błędów zmiany dostawy, zgodne z raportem redmine-36618-1792583373530-f4328629 (koszyki historyczne 6972/6973). Każdy folder tworzy NOWY koszyk. Bez complete, zamówień, CMS i e-maili.

START: uzupełnij lokalnie email, api_password, tests_token oraz product_variant_140g. Zapewnij sesję bramki GitLab w Postmanie. Uruchom oba foldery w Collection Runner, jedna iteracja; nie używaj opcji przerywania na pierwszym FAIL, aby wykonać drugi przypadek. Każdy folder można też uruchomić oddzielnie od logowania. Nie uruchamiaj współbieżnie.

DANE: aktywna w WHOLESALE fizyczna książka o wadze 140 g, VAT 5%, bez Adamady. 58 szt. = 8120 g. Testowa książka QA ID 10233 ma wariant qa-36618-00f95a52-bfeb-461d-ae73-0c8058da5a00-140g i jest po automatach wyłączona — sama znajomość ID nie wystarczy. Użyj przygotowanego aktywnego wariantu o tych parametrach. Kolekcja nie zmienia dostępności produktów. Zwracany kod handlowy może różnić się od kodu wariantu.

WZORCE z CMS: GLS singlePackageWeight=8000 g; dla 8120 g dwie paczki po 1000 gr netto, VAT 5%, dopłata cash_on_delivery 1500 gr brutto: razem 3600 gr brutto / 3429 gr netto. Poczta Polska 1000 gr brutto + dopłata cash_on_delivery 1000 gr brutto = 2000 gr brutto / 1905 gr netto, bez kalkulatora paczek. Jeżeli konfiguracja się zmieniła, potwierdź nowe wzorce w CMS przed oceną wyniku. Wzorców nie uczymy z odpowiedzi badanego API.

T06: GLS → poczta_polska, cały czas 58 szt. Oczekiwano 2000/1905 gr i braku dodatniej liczby paczek; odnotowano 3600/3429 gr i 0 paczek.
T07: poczta_polska (1 szt.) → GLS (58 szt.). Oczekiwano 2 paczek i 3600/3429 gr; odnotowano 0 paczek i 2000/1905 gr. Celowo zachowano kolejność żądań oryginalnego automatu, w tym zapis ilości i płatności przed każdą zmianą dostawy.

Dowód: ostatni GET w folderze, Test Results / Visualize oraz Postman Console z ID koszyka i kwotami przed/po. Konsola nie wypisuje haseł ani tokenów. Czyść dane uwierzytelniające przed eksportem. JWT i token koszyka są zapisywane w lokalnych zmiennych przebiegu (pm.variables), poza kolekcją. Przekierowania są wyłączone.`},
 variable:Object.entries({base_url:'https://ksiegarnia.gwodev.pl/api/v2',email:'',api_password:'',tests_token:'',product_variant_140g:'',payment_code:'cash_on_delivery',shipping_address_json:JSON.stringify({phoneNumber:'123456789',carrierName:'QA 36618',company:'Firma testowa QA',street:'Testowa',streetNumber:'10',city:'Gdańsk',postcode:'80-001'}),billing_address_json:JSON.stringify({nip:'1234563218',company:'Firma testowa QA',street:'Testowa',streetNumber:'10',city:'Gdańsk',postcode:'80-001'})}).map(([key,value])=>({key,value,type:'string'})),
 item:[folder('T06','gls_wholesale','poczta_polska',gls,flat(58)),folder('T07','poczta_polska','gls_wholesale',flat(1),gls)]};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await writeFile(new URL(filename,import.meta.url),JSON.stringify(buildCollection(),null,2)+'\n');console.log(filename);}

