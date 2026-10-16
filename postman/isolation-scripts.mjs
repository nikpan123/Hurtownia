// Funkcje są osadzane jako skrypty w eksportowanej kolekcji. Nie odczytują .env.
export function prepare(pm,firstId){
  const c=pm.collectionVariables;
  if(pm.info.requestId===firstId)for(const key of ['iso_jwt_a','iso_jwt_b','iso_cart_a','iso_before','iso_foreign_status','iso_result','iso_setup_blocked'])c.unset(key);
  function block(message){pm.test('Konfiguracja i kolejność',()=>{throw Error(message);});c.set('iso_setup_blocked','true');pm.execution.skipRequest();pm.execution.setNextRequest(null);}
  if(c.get('iso_setup_blocked')==='true'){block('Popraw wcześniejszy błąd i zacznij od żądania 01.');return;}
  const value=key=>String(pm.variables.get(key)??'').trim();
  if(value('iso_base_url')!=='https://ksiegarnia.gwodev.pl/api/v2'){block('Kolekcja jest przeznaczona wyłącznie dla DEV: https://ksiegarnia.gwodev.pl/api/v2');return;}
  if(!value('iso_tests_token_a')||!value('iso_email_a')||!value('iso_email_b')||!String(pm.variables.get('iso_api_password')??'')){block('Uzupełnij iso_email_a, iso_email_b, iso_api_password i iso_tests_token_a.');return;}
  if(value('iso_email_a').toLowerCase()===value('iso_email_b').toLowerCase()){block('Potrzebne są dwa różne konta.');return;}
  for(const key of ['iso_jwt_a','iso_jwt_b','iso_cart_a'])pm.variables.set(key,c.get(key)||'');
  pm.variables.set('iso_tests_token_b_effective',value('iso_tests_token_b')||value('iso_tests_token_a'));
  for(const actor of ['a','b'])pm.variables.set('iso_email_'+actor+'_json',JSON.stringify(value('iso_email_'+actor)));
  pm.variables.set('iso_password_json',JSON.stringify(String(pm.variables.get('iso_api_password'))));
  pm.variables.set('iso_product_json',JSON.stringify(value('iso_product_code')));
  pm.variables.set('iso_payment_json',JSON.stringify(value('iso_payment_code')));
  if(value('iso_gateway_cookie'))pm.request.headers.upsert({key:'Cookie',value:value('iso_gateway_cookie')});
}
export function requirePrevious(pm,keys){
  const missing=keys.filter(k=>!pm.collectionVariables.get(k));
  if(missing.length){pm.test('Wykonano poprzednie kroki',()=>{throw Error('Brak '+missing.join(', ')+'. Zacznij od 01.');});pm.collectionVariables.set('iso_setup_blocked','true');pm.execution.skipRequest();pm.execution.setNextRequest(null);}
}
export function helpers(pm){
  const c=pm.collectionVariables;
  const test=(name,condition,message)=>{pm.test(name,()=>{if(!condition)throw Error(message||name);});return condition;};
  const stop=message=>{c.set('iso_setup_blocked','true');pm.execution.setNextRequest(null);console.warn(message);};
  const expected=codes=>{const ok=test('Oczekiwany HTTP: '+codes.join('/'),codes.includes(pm.response.code),'Otrzymano HTTP '+pm.response.code);if(!ok)stop('Sprawdź odpowiedź i sesję GitLab. Przygotowanie zostało przerwane.');return ok;};
  const json=()=>{try{return pm.response.json();}catch{test('Odpowiedź jest JSON',false,'Możliwe przekierowanie do logowania GitLab.');stop('Brak JSON.');return null;}};
  function snapshot(o){
    const pick=(x,keys)=>Object.fromEntries(keys.filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));
    return {id:o.id,...pick(o,['itemsTotal','shippingTotal','total','totalNet','orderPromotionTotal']),paymentCode:o.payments?.[0]?.method?.code,items:o.items.map(i=>({code:i.product?.code,...pick(i,['id','quantity','unitPrice','originalUnitPrice','discountedUnitPrice','unitPriceNet','discountedUnitPriceNet','totalNetSalesAfterDiscount','total','rebatePercent'])})).sort((a,b)=>String(a.code).localeCompare(String(b.code)))};
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
  if(!h.test('Konto A otrzymało listę dostaw',Array.isArray(list)&&list.length>0))h.stop('Nie uzyskano dostaw.');
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
  h.c.set('iso_result',JSON.stringify(summary,null,2));console.log('Wynik izolacji',summary);console.table(changes);pm.visualizer.set(template,{...summary,rows});
  if(String(pm.variables.get('iso_clear_tokens_after_run')).toLowerCase()==='true')for(const key of ['iso_jwt_a','iso_jwt_b','iso_cart_a','iso_before','iso_foreign_status'])h.c.unset(key);
}
