import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import * as scripts from './isolation-scripts.mjs';

export const filename='HURTOWNIA - Izolacja uzytkownikow.postman_collection.json';
export function buildCollection(){
  const ids=Array.from({length:13},()=>randomUUID());
  const script=(fn,...args)=>({type:'text/javascript',exec:[`(${fn.toString()})(pm,${args.map(x=>JSON.stringify(x)).join(',')});`]});
  const testScript=(fn,arg)=>({type:'text/javascript',exec:[`const h=(${scripts.helpers.toString()})(pm);`, `(${fn.toString()})(pm,h,${JSON.stringify(arg)??'undefined'});`]});
  const item=(n,name,method,url,{actor,body,fn,arg,required=[],pre,description=''}={})=>{
    const header=[{key:'X-Api-Channel',value:'WHOLESALE'},{key:'X-Tests-Token',value:actor==='b'||n===2?'{{iso_tests_token_b_effective}}':'{{iso_tests_token_a}}'},{key:'Accept',value:'application/json'}];
    if(body!==undefined)header.push({key:'Content-Type',value:method==='PATCH'?'application/merge-patch+json':'application/json'});
    return {id:ids[n-1],name:String(n).padStart(2,'0')+' — '+name,request:{method,header,auth:actor?{type:'bearer',bearer:[{key:'token',value:'{{iso_jwt_'+actor+'}}',type:'string'}]}:{type:'noauth'},url:{raw:'{{iso_base_url}}'+url,host:['{{iso_base_url}}'],path:url.slice(1).split('/')},description,...(body!==undefined?{body:{mode:'raw',raw:body,options:{raw:{language:'json'}}}}:{})},event:[...(required.length?[{listen:'prerequest',script:script(scripts.requirePrevious,required)}]:[]),...(pre?[{listen:'prerequest',script:{type:'text/javascript',exec:[`(${pre.toString()})(pm);`]}}]:[]),{listen:'test',script:testScript(fn,arg)}],response:[]};
  };
  const a=['iso_jwt_a','iso_cart_a'];
  const template=`<style>body{font:14px system-ui;color:#183044}table{border-collapse:collapse;width:100%}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}th{background:#edf3f7}.FAIL{color:#a32929}.PASS{color:#147248}</style><h2 class="{{outcome}}">Izolacja użytkowników: {{outcome}}</h2><p>Obce żądanie: HTTP {{foreignStatus}}. Koszyk: {{cartId}}. Liczba zmienionych pól: {{changeCount}}.</p><p>Oczekiwane: odmowa 403/404 i identyczny stan koszyka. Kwoty są w groszach, rebatePercent w procentach.</p><table><tr><th>Pole</th><th>Przed — konto A</th><th>Po obcym żądaniu — konto A</th></tr>{{#each rows}}<tr><td>{{field}}</td><td>{{before}}</td><td>{{after}}</td></tr>{{/each}}</table><p>Na tym etapie nie wysłano jeszcze complete. Krok 11 zapisze ten koszyk jako konto A, również po FAIL izolacji, do sprawdzenia w Syliusie. Wynik pozostaje w iso_result.</p>`;
  const vars=[
    ['iso_base_url','https://ksiegarnia.gwodev.pl/api/v2','Adres DEV; inne hosty są blokowane.'],
    ['iso_email_a','','E-mail właściciela koszyka (konto 1). Uzupełnij lokalnie.'],
    ['iso_email_b','','E-mail innego użytkownika (konto 2). Uzupełnij lokalnie.'],
    ['iso_api_password','','Wspólne hasło API. Uzupełnij lokalnie.'],
    ['iso_tests_token_a','','X-Tests-Token. Uzupełnij lokalnie.'],
    ['iso_tests_token_b','','Opcjonalny X-Tests-Token B; pusty oznacza użycie tokenu A.'],
    ['iso_gateway_cookie','','Opcjonalny nagłówek Cookie bramki GitLab. Pusty, gdy Postman ma działającą sesję.'],
    ['iso_product_code','5lp-1','Kod wariantu produktu.'],
    ['iso_payment_code','cash_on_delivery','Płatność dostępna kontu A.'],
    ['iso_shipping_code','','Opcjonalny kod dostawy. Pusty wybiera pierwszą dostępną metodę z kroku 07.'],
    ['iso_shipping_address_json',JSON.stringify({phoneNumber:'123456789',carrierName:'Test',company:'Firma testowa QA',street:'Testowa',streetNumber:'10',city:'Gdańsk',postcode:'80-001',saveToAddressBook:false,isDefault:false}),'Adres dostawy testowej w JSON — można zmienić lokalnie.'],
    ['iso_billing_address_json',JSON.stringify({nip:'1234563218',company:'Firma testowa QA',street:'Testowa',streetNumber:'10',city:'Gdańsk',postcode:'80-001',saveToAddressBook:false,isDefault:false}),'Dane rozliczeniowe testowe w JSON — można zmienić lokalnie.'],
    ['iso_expected_rebate_a','50','Oczekiwany rabat A. Zmień dla innego konta lub wyczyść, aby nie wymagać określonego procentu.'],
    ['iso_clear_tokens_after_run','true','Usuwa tokeny i stan roboczy po kroku 12; kolejną próbę zacznij od 01.'],
    ...['iso_jwt_a','iso_jwt_b','iso_cart_a','iso_before','iso_after','iso_selected_shipping','iso_foreign_status','iso_complete_attempted'].map(k=>[k,'','Ustawiane automatycznie — nie uzupełniaj.']),
    ['iso_result','','Końcowy wynik z porównaniem pól finansowych, bez danych logowania i tokenów.']
    ,['iso_completion_result','','Wynik zapisu, numer zamówienia i porównanie wyceny po izolacji z zapisanym zamówieniem.']
    ,['iso_saved_order_id','','ID zapisanego zamówienia.']
    ,['iso_saved_order_number','','Numer zamówienia do wyszukania w Syliusie.']
    ,['iso_setup_blocked','','Automatyczna blokada po błędzie; krok 01 ją resetuje.']
    ,['iso_setup_error','','Powód zatrzymania wraz z nazwą kroku. Krok 01 czyści wcześniejszy błąd.']
  ];
  return {info:{_postman_id:randomUUID(),name:'HURTOWNIA — izolacja użytkowników A → B i zapis zamówienia',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:`Odtworzenie zmiany cen w cudzym koszyku mimo odmowy HTTP 404. Tylko DEV. Kolekcja tworzy jeden nowy koszyk i ZAPISUJE ZAMÓWIENIE w kroku 11 — także po FAIL izolacji. Może uruchomić e-mail i zapis do bazy transferowej. Użyj dedykowanego konta testowego.

1. Zaimportuj plik przez Import w Postmanie.
2. W Variables uzupełnij lokalnie iso_email_a, iso_email_b, iso_api_password i iso_tests_token_a. Opcjonalnie iso_tests_token_b oraz iso_gateway_cookie. Plik nie zawiera prawdziwych danych dostępowych.
3. Domyślnie A to konto 1 z rabatem przy odbiorze 50%. B to konto 2 z rabatem 13%. Dla innych ustawień A zmień iso_expected_rebate_a. Rabat B nie jest narzucony w asercjach: sprawdzamy niezmienność rzeczywistego stanu A.
4. Uruchom całą kolekcję przez Run, w zapisanej kolejności 01–12 (z dodatkowym krokiem 07b), z jedną iteracją. Krok 07b przygotowuje dostawę i testowe adresy PRZED pomiarem izolacji. Opcjonalnie zmień iso_shipping_code i adresy JSON. Każdą nową próbę zaczynaj od 01. Nie zmieniaj nazwy pierwszego kroku: resetuje poprzednią blokadę także po imporcie. Powód zatrzymania jest w iso_setup_error.
5. Krok 09 używa JWT B, ale token koszyka nadal należy do A. Oczekiwane 403/404 to tylko połowa kontroli.
6. Krok 10 odczytuje koszyk jako A i porównuje pola. Sprawdź Test Results i Visualize. Wynik pozostaje również w iso_result. Odmowa w kroku 09 i zmiany w kroku 10 oznaczają odtworzony błąd.
7. Krok 11 wysyła PATCH complete jako konto A z body {}. Krok 12 odczytuje zapisane zamówienie, pokazuje numer do wyszukania w Syliusie i porównuje cenę po izolacji z ceną zapisaną. Complete może przeliczyć rabat ponownie. Wynik zapisu jest w iso_completion_result oraz iso_saved_order_number. Dopiero po kroku 12 usuwa się robocze tokeny. Nie ponawiamy complete dla tego samego koszyka, także po timeout. Żeby wykonać wyłącznie izolację bez zapisu, zaznacz w Runnerze kroki do 10 (wraz z 07b).
8. Dla odwrotnego kierunku zamień e-maile A/B i ustaw rabat nowego A, np. 13%. Każda pełna nowa próba może utworzyć kolejne zamówienie.

HTML lub przekierowanie zamiast JSON oznacza problem sesji GitLab, a nie wynik izolacji. Skorzystaj ze swojego działającego dostępu do API w Postmanie. Hasła i tokeny wpisuj tylko lokalnie; nie eksportuj kolekcji z uzupełnionymi sekretami.

Dokumentacja kolejności i zatrzymywania: https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution/`},variable:vars.map(([key,value,description])=>({key,value,description,type:'string'})),event:[{listen:'prerequest',script:script(scripts.prepare,'01 — Logowanie konta A')}],item:[
    item(1,'Logowanie konta A','POST','/shop/authentication-token',{body:'{"email":{{iso_email_a_json}},"apiPassword":{{iso_password_json}}}',fn:scripts.login,arg:'a'}),
    item(2,'Logowanie konta B','POST','/shop/authentication-token',{body:'{"email":{{iso_email_b_json}},"apiPassword":{{iso_password_json}}}',fn:scripts.login,arg:'b',required:['iso_jwt_a']}),
    item(3,'Konto A tworzy nowy koszyk','POST','/shop/orders',{actor:'a',body:'{"localeCode":"pl_PL"}',fn:scripts.createCart,required:['iso_jwt_a','iso_jwt_b']}),
    item(4,'Konto A dodaje 1 sztukę produktu','POST','/shop/orders/{{iso_cart_a}}/items/bulk',{actor:'a',body:'{"items":[{"productVariant":{{iso_product_json}},"quantity":1}]}',fn:scripts.accepted,arg:[200,201,204],required:a}),
    item(5,'Konto A odczytuje płatności','GET','/wholesale/orders/{{iso_cart_a}}/payments',{actor:'a',fn:scripts.payments,required:a}),
    item(6,'Konto A wybiera płatność','PATCH','/wholesale/orders/{{iso_cart_a}}/payment-method',{actor:'a',body:'{"paymentMethodCode":{{iso_payment_json}}}',fn:scripts.accepted,arg:[200,204],required:a}),
    item(7,'Konto A odczytuje dostawy','GET','/wholesale/checkout-step-two/{{iso_cart_a}}',{actor:'a',fn:scripts.shipping,required:a,description:'Zapamiętuje wskazaną iso_shipping_code lub pierwszą dostępną dostawę.'}),
    {...item(13,'Konto A przygotowuje dostawę i adresy','POST','/wholesale/checkout-step-two/{{iso_cart_a}}',{actor:'a',body:'{"orderTokenValue":{{iso_cart_a_json}},"shippingMethodCode":{{iso_selected_shipping_json}},"shippingAddress":{{iso_shipping_address_json}},"billingAddress":{{iso_billing_address_json}}}',fn:scripts.accepted,arg:[200,201,204],required:[...a,'iso_selected_shipping'],pre:scripts.prepareAddresses,description:'Przygotowanie checkoutu przed pomiarem izolacji. Używa testowych adresów z Variables. Nie zapisuje adresu do książki adresowej.'}),name:'07b — Konto A przygotowuje dostawę i adresy'},
    item(8,'Konto A — zapisz stan PRZED','GET','/shop/orders/{{iso_cart_a}}',{actor:'a',fn:scripts.before,required:a,description:'Zapamiętuje ID, produkt i pola finansowe; pomija adresy i tokenValue.'}),
    item(9,'Konto B — płatności CUDZEGO koszyka A','GET','/wholesale/orders/{{iso_cart_a}}/payments',{actor:'b',fn:scripts.foreign,required:['iso_jwt_b','iso_cart_a','iso_before'],description:'Jedyne obce żądanie: JWT B, token koszyka A. Po 403/404 nadal wykonaj krok 10.'}),
    item(10,'Konto A — stan PO i porównanie','GET','/shop/orders/{{iso_cart_a}}',{actor:'a',fn:scripts.after,arg:template,required:[...a,'iso_before','iso_foreign_status'],description:'Wyniki: Test Results, Visualize i iso_result. Zachowuje tokeny do zapisu. FAIL izolacji nie blokuje żądanego zapisu diagnostycznego.'}),
    item(11,'Konto A — ZAPISZ ZAMÓWIENIE','PATCH','/shop/orders/{{iso_cart_a}}/complete',{actor:'a',body:'{}',fn:scripts.completed,required:[...a,'iso_result','iso_after'],pre:scripts.markCompletion,description:'Zatwierdza ten sam koszyk jako właściciel A, również po FAIL izolacji. Może wysłać e-mail i zapisać zamówienie w bazie transferowej. Nie ponawiaj po timeout — sprawdź krok 12 lub CMS.'}),
    item(12,'Konto A — numer i wycena zapisanego zamówienia','GET','/shop/orders/{{iso_cart_a}}',{actor:'a',fn:scripts.saved,required:[...a,'iso_after','iso_result','iso_complete_attempted'],description:'Odczytuje zapisane zamówienie. Numer do wyszukania w Syliusie: iso_saved_order_number. Pełne porównanie wyceny: iso_completion_result.'})
  ]};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const destination=fileURLToPath(new URL(filename,import.meta.url));await writeFile(destination,JSON.stringify(buildCollection(),null,2)+'\n');console.log(destination);
}
