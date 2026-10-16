// Funkcje są osadzane jako skrypty w eksportowanej kolekcji. Nie odczytują .env.
export function prepare(pm,firstName){
  const c=pm.collectionVariables;
  // Postman może nadać żądaniom nowe ID przy imporcie; nazwa pierwszego kroku pozostaje stała.
  if(pm.info.requestName===firstName)for(const key of ['iso_jwt_a','iso_jwt_b','iso_cart_a','iso_before','iso_after','iso_selected_shipping','iso_foreign_status','iso_result','iso_complete_attempted','iso_completion_result','iso_saved_order_id','iso_saved_order_number','iso_setup_blocked','iso_setup_error'])c.unset(key);
  function block(message){pm.test('Konfiguracja i kolejność',()=>{throw Error(message);});c.set('iso_setup_blocked','true');if(!c.get('iso_setup_error'))c.set('iso_setup_error',message);pm.execution.skipRequest();pm.execution.setNextRequest(null);}
  if(c.get('iso_setup_blocked')==='true'){block('Wcześniejszy błąd: '+(c.get('iso_setup_error')||'przyczyna nie została zapisana w starszej wersji kolekcji')+'. Popraw go i zacznij od żądania 01.');return;}
  const value=key=>String(pm.variables.get(key)??'').trim();
  if(value('iso_base_url')!=='https://ksiegarnia.gwodev.pl/api/v2'){block('Kolekcja jest przeznaczona wyłącznie dla DEV: https://ksiegarnia.gwodev.pl/api/v2');return;}
  if(!value('iso_tests_token_a')||!value('iso_email_a')||!value('iso_email_b')||!String(pm.variables.get('iso_api_password')??'')){block('Uzupełnij iso_email_a, iso_email_b, iso_api_password i iso_tests_token_a.');return;}
  if(value('iso_email_a').toLowerCase()===value('iso_email_b').toLowerCase()){block('Potrzebne są dwa różne konta.');return;}
  for(const key of ['iso_jwt_a','iso_jwt_b','iso_cart_a'])pm.variables.set(key,c.get(key)||'');
  pm.variables.set('iso_selected_shipping_json',JSON.stringify(c.get('iso_selected_shipping')||''));
  pm.variables.set('iso_cart_a_json',JSON.stringify(c.get('iso_cart_a')||''));
  pm.variables.set('iso_tests_token_b_effective',value('iso_tests_token_b')||value('iso_tests_token_a'));
  for(const actor of ['a','b'])pm.variables.set('iso_email_'+actor+'_json',JSON.stringify(value('iso_email_'+actor)));
  pm.variables.set('iso_password_json',JSON.stringify(String(pm.variables.get('iso_api_password'))));
  pm.variables.set('iso_product_json',JSON.stringify(value('iso_product_code')));
  pm.variables.set('iso_payment_json',JSON.stringify(value('iso_payment_code')));
  if(value('iso_gateway_cookie'))pm.request.headers.upsert({key:'Cookie',value:value('iso_gateway_cookie')});
}
export function requirePrevious(pm,keys){
  const missing=keys.filter(k=>!pm.collectionVariables.get(k));
  if(missing.length){const message='Brak '+missing.join(', ')+'. Zacznij od 01.';pm.test('Wykonano poprzednie kroki',()=>{throw Error(message);});pm.collectionVariables.set('iso_setup_blocked','true');if(!pm.collectionVariables.get('iso_setup_error'))pm.collectionVariables.set('iso_setup_error',message);pm.execution.skipRequest();pm.execution.setNextRequest(null);}
}
export function helpers(pm){
  const c=pm.collectionVariables;
  const test=(name,condition,message)=>{pm.test(name,()=>{if(!condition)throw Error(message||name);});return condition;};
  const stop=message=>{c.set('iso_setup_blocked','true');if(!c.get('iso_setup_error'))c.set('iso_setup_error',pm.info.requestName+': '+message);pm.execution.setNextRequest(null);console.warn(message);};
  const expected=codes=>{const ok=test('Oczekiwany HTTP: '+codes.join('/'),codes.includes(pm.response.code),'Otrzymano HTTP '+pm.response.code);if(!ok)stop('HTTP '+pm.response.code+' zamiast '+codes.join('/')+'. Sprawdź odpowiedź, dane logowania i sesję GitLab.');return ok;};
  const json=()=>{try{return pm.response.json();}catch{test('Odpowiedź jest JSON',false,'Możliwe przekierowanie do logowania GitLab.');stop('Brak JSON.');return null;}};
  function snapshot(o){
    const pick=(x,keys)=>Object.fromEntries(keys.filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));
    return {id:o.id,...pick(o,['itemsTotal','shippingTotal','total','totalNet','orderPromotionTotal']),paymentCode:o.payments?.[0]?.method?.code,shippingCode:o.shipments?.[0]?.method?.code,items:o.items.map(i=>({code:i.product?.code,...pick(i,['id','quantity','unitPrice','originalUnitPrice','discountedUnitPrice','unitPriceNet','discountedUnitPriceNet','totalNetSalesAfterDiscount','total','rebatePercent'])})).sort((a,b)=>String(a.code).localeCompare(String(b.code)))};
  }
  return {c,test,stop,expected,json,snapshot};
}
export function login(pm,h,actor){
  if(!h.expected([200]))return;const b=h.json();if(!b)return;
  const token=typeof b==='string'?b:b.token??b.accessToken??b.bearerToken??b.jwt??b.data?.token;
  if(!h.test('Uzyskano token konta '+actor.toUpperCase(),typeof token==='string'&&token.length>0)){h.stop('Brak tokenu.');return;}
  if(actor==='b'&&!h.test('Konta A i B otrzymały różne tokeny',token!==h.c.get('iso_jwt_a'))){h.stop('Nie potwierdzono dwóch odrębnych tożsamości.');return;}
  h.c.set('iso_jwt_'+actor,token);
}
export function createCart(pm,h){
  if(!h.expected([200,201]))return;const b=h.json();if(!b)return;
  if(!h.test('Utworzono koszyk A',typeof b.tokenValue==='string'&&b.tokenValue.length>0)){h.stop('Brak tokenValue.');return;}
  h.c.set('iso_cart_a',b.tokenValue);
}
export function accepted(pm,h,codes){h.expected(codes);}
export function payments(pm,h){
  if(!h.expected([200]))return;const b=h.json();if(!b)return;
  if(!h.test('Wybrana płatność jest dostępna kontu A',Array.isArray(b)&&b.some(p=>p.code===pm.variables.get('iso_payment_code'))))h.stop('Wybierz dostępną płatność.');
}
export function shipping(pm,h){
  if(!h.expected([200]))return;const b=h.json();if(!b)return;
  const raw=b.shippingMethods,list=Array.isArray(raw)?raw:raw?.['hydra:member']??raw?.member;
  if(!h.test('Konto A otrzymało listę dostaw',Array.isArray(list)&&list.length>0)){h.stop('Nie uzyskano dostaw.');return;}
  const preferred=String(pm.variables.get('iso_shipping_code')??'').trim(),selected=preferred?list.find(s=>s.code===preferred):list[0];
  if(!h.test('Dostawa dostępna dla tego koszyka',typeof selected?.code==='string'&&selected.code.length>0)){h.stop('Wybrana iso_shipping_code nie jest dostępna.');return;}
  h.c.set('iso_selected_shipping',selected.code);
}
export function prepareAddresses(pm){
  if(pm.collectionVariables.get('iso_setup_blocked')==='true')return;
  for(const kind of ['shipping','billing']){
    const key='iso_'+kind+'_address_json';
    try{const value=JSON.parse(String(pm.variables.get(key)||''));if(!value||typeof value!=='object'||Array.isArray(value)||!['company','street','streetNumber','city','postcode'].every(k=>typeof value[k]==='string'&&value[k].trim()))throw Error('Wypełnij firmę i adres.');pm.variables.set(key,JSON.stringify(value));}
    catch{const message='Uzupełnij poprawny obiekt JSON adresu w '+key;pm.test('Adresy do zamówienia',()=>{throw Error(message);});pm.collectionVariables.set('iso_setup_blocked','true');pm.collectionVariables.set('iso_setup_error',message);pm.execution.skipRequest();pm.execution.setNextRequest(null);return;}
  }
}
export function before(pm,h){
  if(!h.expected([200]))return;const b=h.json();if(!b)return;
  if(!h.test('Koszyk zawiera jedną pozycję',Array.isArray(b.items)&&b.items.length===1)){h.stop('Nieprawidłowy koszyk.');return;}
  const s=h.snapshot(b),i=s.items[0];
  if(!h.test('Właściwy produkt, ilość i płatność',i.code===pm.variables.get('iso_product_code')&&i.quantity===1&&s.paymentCode===pm.variables.get('iso_payment_code'))){h.stop('Nieprawidłowe przygotowanie.');return;}
  const wanted=String(pm.variables.get('iso_expected_rebate_a')??'').trim();
  if(wanted&&!h.test('Rabat początkowy A: '+wanted+'%',Number.isFinite(Number(wanted))&&i.rebatePercent===Number(wanted),'Otrzymano '+i.rebatePercent+'%. Sprawdź konto A i iso_expected_rebate_a.')){h.stop('Nieprawidłowy rabat początkowy.');return;}
  h.c.set('iso_before',JSON.stringify(s));console.log('Stan PRZED — kwoty w groszach',s);
}
export function foreign(pm,h){
  h.c.set('iso_foreign_status',String(pm.response.code));
  h.test('Obce konto otrzymało odmowę 403/404',[403,404].includes(pm.response.code),'Obce żądanie zwróciło HTTP '+pm.response.code+'. Porównanie koszyka nastąpi w kroku 10.');
}
export function after(pm,h,template){
  if(!h.expected([200]))return;const b=h.json();if(!b)return;
  if(!h.test('Końcowy odczyt zawiera pozycje',Array.isArray(b.items))){h.stop('Brak danych do porównania.');return;}
  const before=JSON.parse(h.c.get('iso_before')),after=h.snapshot(b),changes=[],rows=[];
  function compare(a,z,field){
    if(a&&z&&typeof a==='object'&&typeof z==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(z)]))compare(a[key],z[key],field?field+'.'+key:key);return;}
    if(a!==z)changes.push({field,before:a??null,after:z??null});rows.push({field,before:a??'brak',after:z??'brak'});
  }
  compare(before,after,'');
  h.test('Koszyk właściciela pozostał IDENTYCZNY',changes.length===0,changes.map(d=>d.field+': '+d.before+' → '+d.after).join('; '));
  h.test('Rabat produktu pozostał bez zmian',before.items[0].rebatePercent===after.items[0]?.rebatePercent,'Rabat: '+before.items[0].rebatePercent+'% → '+after.items[0]?.rebatePercent+'%');
  h.test('Produkty brutto bez zmian',before.itemsTotal===after.itemsTotal,'itemsTotal: '+before.itemsTotal+' → '+after.itemsTotal+' groszy');
  h.test('Kwota do zapłaty bez zmian',before.total===after.total,'total: '+before.total+' → '+after.total+' groszy');
  const status=Number(h.c.get('iso_foreign_status'));
  const summary={outcome:[403,404].includes(status)&&changes.length===0?'PASS':'FAIL',foreignStatus:status,cartId:before.id,changeCount:changes.length,changes,before,after,completeSent:false};
  h.c.set('iso_result',JSON.stringify(summary,null,2));h.c.set('iso_after',JSON.stringify(after));console.log('Wynik izolacji',summary);console.table(changes);pm.visualizer.set(template,{...summary,rows});
  // Tokeny pozostają do kroku 12. FAIL izolacji nie blokuje żądanego zapisu diagnostycznego na DEV.
}
export function markCompletion(pm){
  const c=pm.collectionVariables;
  if(c.get('iso_setup_blocked')==='true')return;
  if(c.get('iso_complete_attempted')==='true'){
    const message='Próba complete została już wykonana dla tego koszyka. Sprawdź krok 12 lub Syliusa; nie ponawiamy zapisu, także po timeout.';
    pm.test('Brak ponownego complete',()=>{throw Error(message);});c.set('iso_setup_error',message);pm.execution.skipRequest();pm.execution.setNextRequest(null);return;
  }
  c.set('iso_complete_attempted','true');c.set('iso_completion_result',JSON.stringify({state:'attempted',message:'Wysłano próbę complete; wynik wymaga odpowiedzi i odczytu w kroku 12.'}));
}
export function completed(pm,h){
  const isolation=JSON.parse(h.c.get('iso_result'));isolation.completeSent=true;h.c.set('iso_result',JSON.stringify(isolation,null,2));
  h.c.set('iso_completion_result',JSON.stringify({state:[200,204].includes(pm.response.code)?'accepted':'rejected',httpStatus:pm.response.code,isolationOutcome:isolation.outcome}));
  h.expected([200,204]);
}
export function saved(pm,h){
  if(!h.expected([200]))return;const o=h.json();if(!o)return;
  if(!h.test('Zapisany odczyt zawiera pozycje',Array.isArray(o.items))){h.stop('Nie otrzymano danych zamówienia.');return;}
  const before=JSON.parse(h.c.get('iso_after')),current=h.snapshot(o),number=typeof o.number==='string'||typeof o.number==='number'?String(o.number):'';
  const same=h.test('Odczyt dotyczy tego samego koszyka',current.id===before.id);
  const numbered=h.test('Zamówienie ma numer do wyszukania w Syliusie',number.trim().length>0,'API nie zwróciło number. Sprawdź ręcznie ID '+o.id+' w CMS.');
  if(same){h.c.set('iso_saved_order_id',String(o.id));h.c.set('iso_saved_order_number',number);}
  const isolation=JSON.parse(h.c.get('iso_result')),priceChangedOnComplete=JSON.stringify({...before,id:null})!==JSON.stringify({...current,id:null});
  const result={state:same&&numbered?'confirmed':'needs_manual_check',id:o.id,number,checkoutState:o.checkoutState??o.state,isolationOutcome:isolation.outcome,priceChangedOnComplete,afterIsolation:before,saved:current};
  h.c.set('iso_completion_result',JSON.stringify(result,null,2));console.log('Wyszukaj zamówienie w Syliusie — numer:',number,'ID:',o.id);console.log('Po izolacji a po zapisie — kwoty w groszach',result);
  pm.visualizer.set('<h2>Zamówienie do sprawdzenia w Syliusie</h2><p>Numer: <b>{{number}}</b> · ID: {{id}}</p><p>Wynik zapisu: {{state}}. Izolacja przed zapisem: {{isolationOutcome}}.</p><p>Wycena zmieniła się przy complete: {{priceChangedOnComplete}}. Brutto po izolacji: {{afterIsolation.total}} gr. Brutto zapisane: {{saved.total}} gr.</p><p>Pełne porównanie znajduje się w iso_completion_result. Wynik izolacji pozostaje w iso_result.</p>',result);
  if(String(pm.variables.get('iso_clear_tokens_after_run')).toLowerCase()==='true')for(const key of ['iso_jwt_a','iso_jwt_b','iso_cart_a','iso_before','iso_after','iso_selected_shipping','iso_foreign_status'])h.c.unset(key);
}
