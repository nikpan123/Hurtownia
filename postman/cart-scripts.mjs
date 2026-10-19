export function helpers(pm){
 const c=pm.collectionVariables;
 const get=(key)=>c.get(key),set=(key,value)=>c.set(key,typeof value==='object'?JSON.stringify(value):String(value));
 const json=key=>{try{return JSON.parse(get(key));}catch{throw Error('Niepoprawny JSON zmiennej '+key);}};
 const need=(...keys)=>{for(const key of keys)if(!get(key))throw Error('Brak '+key+' — wykonaj wcześniejsze kroki lub uzupełnij Variables.');};
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const check=(name,fn)=>pm.test(name,()=>{try{fn();}catch(error){set('collectionBlocked',true);pm.execution.setNextRequest(null);throw error;}});
 const data=()=>{const type=(pm.response.headers.get('Content-Type')||'').toLowerCase();assert(!type.includes('text/html')&&!(pm.response.code>=300&&pm.response.code<400),'Odpowiedź bramki GitLab. Odśwież sesję w Postmanie.');try{return pm.response.text().trim()?pm.response.json():null;}catch{throw Error('API nie zwróciło poprawnego JSON.');}};
 const status=(codes)=>pm.test('HTTP '+codes.join('/'),()=>assert(codes.includes(pm.response.code),'Otrzymano HTTP '+pm.response.code));
 const ok=(codes=[200])=>{status(codes);assert(codes.includes(pm.response.code),'Przerwano po HTTP '+pm.response.code);return data();};
 const current=(kind='main')=>get(kind==='main'?'tokenValue':'workToken');
 const items=(o)=>{assert(o&&Array.isArray(o.items),'Brak items w odczycie koszyka');return o.items;};
 const normalized=o=>{
  const address=a=>a&&typeof a==='object'?Object.fromEntries(Object.entries(a).filter(([k])=>!['@id','@type','id','createdAt','updatedAt'].includes(k)).sort(([a],[b])=>a.localeCompare(b))):a;
  return {id:o.id,number:o.number,state:o.state,itemsTotal:o.itemsTotal,total:o.total,totalNet:o.totalNet,shippingTotal:o.shippingTotal,shippingTotalNet:o.shippingTotalNet,shipmentPackageQuantity:o.shipmentPackageQuantity,orderPromotionTotal:o.orderPromotionTotal,payment:o.payments?.[0]?.method?.code??o.payments?.[0]?.method,shipping:o.shipments?.[0]?.method?.code??o.shipments?.[0]?.method,shippingAddress:address(o.shippingAddress),billingAddress:address(o.billingAddress),items:items(o).map(i=>({id:i.id,code:i.product?.code,quantity:i.quantity,unitPrice:i.unitPrice,originalUnitPrice:i.originalUnitPrice,unitPriceNet:i.unitPriceNet,discountedUnitPriceNet:i.discountedUnitPriceNet,discountedUnitPrice:i.discountedUnitPrice,rebatePercent:i.rebatePercent,total:i.total,net:i.totalNetSalesAfterDiscount})).sort((a,b)=>String(a.id).localeCompare(String(b.id)))};
 };
 const unchanged=(before,after,label='Koszyk nie zmienił się')=>check(label,()=>assert(JSON.stringify(before)===JSON.stringify(after),label+' — wykryto zmianę stanu'));
 const saveOrder=(o,kind='main')=>{
  items(o);assert(o.tokenValue===current(kind),'Odczytano inny token koszyka');
  check('Sumy produktów i dostawy są spójne',()=>{for(const k of ['itemsTotal','total','shippingTotal'])assert(Number.isSafeInteger(o[k])&&o[k]>=0,'Nieprawidłowe '+k);assert(o.itemsTotal===o.items.reduce((s,i)=>s+i.total,0),'Suma pozycji różni się od itemsTotal');assert(o.total===o.itemsTotal+o.shippingTotal,'total różni się od produktów + dostawy');});
  if(kind==='main'){
   const first=o.items[0];if(first)set('itemId',first.id);set('ownerBaseline',normalized(o));
   for(const k of ['itemsTotal','shippingTotal','total','shippingTotalNet','shipmentPackageQuantity'])if(o[k]!==undefined)set(k==='total'?'orderTotal':k,o[k]);
   if(o.number)set('orderNumber',o.number);
   for(const k of ['pdfSummary','paymentForm'])if(typeof o[k]==='string')set(k,o[k]);
   const rows=o.items.map(i=>({code:i.product?.code,name:i.productName||i.product?.name||'',quantity:i.quantity,rebate:i.rebatePercent,gross:i.total,net:i.totalNetSalesAfterDiscount}));
   pm.visualizer.set('<h2>Podsumowanie koszyka {{id}}</h2><p>Kwoty w groszach. Produkty: {{itemsTotal}}, dostawa: {{shippingTotal}}, do zapłaty: {{total}}.</p><table><tr><th>Kod</th><th>Produkt</th><th>Szt.</th><th>Rabat %</th><th>Brutto</th><th>Netto</th></tr>{{#each rows}}<tr><td>{{code}}</td><td>{{name}}</td><td>{{quantity}}</td><td>{{rebate}}</td><td>{{gross}}</td><td>{{net}}</td></tr>{{/each}}</table>',{id:o.id,itemsTotal:o.itemsTotal,shippingTotal:o.shippingTotal,total:o.total,rows});
  }
  return o;
 };
 const addresses=(marker='')=>{
  const shipping=json('shipping_address_json'),billing=json('billing_address_json');
  for(const a of [shipping,billing]){a.saveToAddressBook=false;a.isDefault=false;}
  if(marker){shipping.company=marker+'-S';billing.company=marker+'-B';}
  return {shippingAddress:shipping,billingAddress:billing};
 };
 const body=value=>pm.variables.set('requestBody',JSON.stringify(value));
 const shippingList=d=>{const x=d?.shippingMethods;const rows=Array.isArray(x)?x:x?.['hydra:member']??x?.member;assert(Array.isArray(rows)&&rows.length,'Brak dostępnych dostaw');return rows;};
 const choose=(rows,preferred)=>{assert(Array.isArray(rows)&&rows.length,'Brak dostępnych metod');const found=preferred?rows.find(r=>r.code===preferred):rows[Math.floor(Math.random()*rows.length)];assert(found,'Preferowana metoda nie jest aktualnie dostępna');return found;};
 return {c,get,set,json,need,assert,check,data,status,ok,current,items,normalized,unchanged,saveOrder,addresses,body,shippingList,choose};
}

export function loginPre(pm,h){
 for(const key of ['bearer_token','bearer_token_b','tokenValue','tokenPath','workToken','workPath','itemId','workItemId','orderId','orderNumber','cartProductPlan','ownerBaseline','beforeNegative','negativeStatus','selectedPaymentMethodCode','selectedShippingMethodCode','pdfSummary','paymentForm','completeAttempted','completeConfirmed','completeResponseAccepted','repeatAttempted','createdAddressIds','bookBaseline','addressDeleteQueue'])h.c.unset(key);
 h.c.unset('collectionBlocked');h.set('completeConfirmed',false);h.set('runMarker','QA-POSTMAN-'+pm.variables.replaceIn('{{$guid}}'));
 h.need('hurtownia_email','hurtownia_api_password','tests_token');
 h.body({email:h.get('hurtownia_email'),apiPassword:h.get('hurtownia_api_password')});
}
export function loginPost(pm,h,actor='a'){
 const d=h.ok([200]),token=typeof d==='string'?d:d?.token??d?.accessToken??d?.bearerToken??d?.jwt??d?.data?.token;
 h.assert(typeof token==='string'&&token,'Brak JWT w odpowiedzi logowania');if(actor==='b')h.assert(token!==h.get('bearer_token'),'Konta A i B otrzymały ten sam JWT — nie można ocenić izolacji');h.set(actor==='b'?'bearer_token_b':'bearer_token',token);
 pm.test('Uzyskano JWT',()=>h.assert(!!token,'Brak JWT'));
}
export function createPost(pm,h,kind='main'){
 const o=h.ok([200,201]);h.assert(typeof o?.tokenValue==='string'&&o.tokenValue,'Brak tokenValue');h.set(kind==='main'?'tokenValue':'workToken',o.tokenValue);h.set(kind==='main'?'tokenPath':'workPath',encodeURIComponent(o.tokenValue));h.set(kind==='main'?'orderId':'workOrderId',o.id);
}
export function productsPre(pm,h){
 const pool=h.json('product_pool_json').filter(p=>p.enabled!==false);h.assert(pool.length,'Pusta pula produktów');
 let group=h.get('product_group');if(group==='random'){const groups=[...new Set(pool.map(p=>p.group))];group=groups[Math.floor(Math.random()*groups.length)];}
 h.assert(['adamada','pozostale'].includes(group),'product_group: random, adamada lub pozostale');
 const candidates=pool.filter(p=>p.group===group);h.assert(candidates.length,'Brak produktów wybranej grupy');
 const max=Number(h.get('max_products')),qty=Number(h.get('max_quantity'));h.assert(Number.isInteger(max)&&max>0&&max<=20&&Number.isInteger(qty)&&qty>0&&qty<=1000,'Nieprawidłowe limity produktów/ilości');
 // Fisher–Yates; jedna grupa w całym koszyku, bez duplikatów wariantów.
 h.assert(new Set(candidates.map(p=>p.productVariant)).size===candidates.length,'Powtórzone kody wariantów w puli');
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const count=1+Math.floor(Math.random()*Math.min(max,candidates.length));const plan=candidates.slice(0,count).map(p=>({productVariant:p.productVariant,group,quantity:1+Math.floor(Math.random()*qty)}));
 h.set('cartProductPlan',plan);h.set('selectedGroup',group);h.body({items:plan.map(({productVariant,quantity})=>({productVariant,quantity}))});
}
export function readPost(pm,h,mode='main'){
 const o=h.ok();h.saveOrder(o,mode==='main'||mode==='plan'||mode==='edited'||mode==='payment'||mode==='summary'||mode==='saved'?'main':'work');
 if(mode==='plan'){const plan=h.json('cartProductPlan');pm.test('Produkty i ilości zgodne z wylosowanym planem',()=>{h.assert(o.items.length===plan.length,'Inna liczba pozycji');for(const p of plan)h.assert(o.items.some(i=>i.product?.code===p.productVariant&&i.quantity===p.quantity),'Brak produktu lub niezgodna ilość '+p.productVariant);});}
 if(mode==='edited')pm.test('Zapisano nową ilość pierwszej pozycji',()=>h.assert(o.items.find(i=>String(i.id)===h.get('itemId'))?.quantity===Number(h.get('newQuantity')),'Ilość niezgodna'));
 if(mode==='payment'){
  const offer=h.json('selectedPaymentMethod');const refs=h.json('expected_rebates_json'),group=h.get('selectedGroup'),expected=group==='adamada'?refs.adamada:refs[offer.code];
  pm.test('Zapisano wybraną płatność',()=>h.assert((o.payments?.[0]?.method?.code??o.payments?.[0]?.method)===offer.code,'Inna płatność'));
  pm.test('Rabat pozycji zgodny z ofertą',()=>{for(const i of o.items)h.assert(i.rebatePercent===offer.rebatePercent,'Inny rabat pozycji');});
  if(expected!==undefined)pm.test('Rabat zgodny z niezależnym wzorcem konta',()=>h.assert(offer.rebatePercent===expected,'Rabat różni się od expected_rebates_json'));else pm.test.skip('Brak niezależnego wzorca rabatu — sprawdzono tylko spójność z ofertą',()=>{});
 }
 if(mode==='summary'){
  pm.test('Zapisano wybraną dostawę',()=>h.assert((o.shipments?.[0]?.method?.code??o.shipments?.[0]?.method)===h.get('selectedShippingMethodCode'),'Inna dostawa'));
  h.set('beforeComplete',h.normalized(o));
 }
 if(mode==='summary'||mode==='saved'){
  const carrier=h.json('shipping_address_json').carrierName;
  if(carrier){if(typeof o.notes==='string')pm.test('carrierName zapisano jako Przewoźnik w notes',()=>h.assert(o.notes.includes('Przewoźnik: '+carrier),'Brak nazwy przewoźnika w notes'));else pm.test.skip('GET nie udostępnia notes — sprawdź przewoźnika w Uwagi w Syliusie',()=>{});}
 }
 if(mode==='saved'){
  const before=h.json('beforeComplete'),after=h.normalized(o);h.assert(o.state!=='cart','Zamówienie nadal jest koszykiem');
  pm.test('Kwoty i produkty nie zmieniły się przy finalizacji',()=>{for(const k of ['itemsTotal','total','totalNet','shippingTotal','shippingTotalNet','shipmentPackageQuantity','items'])h.assert(JSON.stringify(before[k])===JSON.stringify(after[k]),'Zmiana '+k);});h.set('savedBaseline',after);
  h.assert(h.get('completeResponseAccepted')===h.current()||(o.number&&typeof o.state==='string'&&o.state!=='cart'),'Odczyt nie potwierdza jeszcze zapisu; nie ponawiaj complete');h.set('completeConfirmed',true);
 }
 if(mode==='delete')pm.test('Pozycja została usunięta',()=>h.assert(!o.items.some(i=>String(i.id)===h.get('workItemId')),'Pozycja nadal istnieje'));
 if(mode==='baseline')h.set('beforeNegative',h.normalized(o));
 if(mode==='after-negative'){
  const changes=JSON.stringify(h.json('beforeNegative'))!==JSON.stringify(h.normalized(o));
  h.unchanged(h.json('beforeNegative'),h.normalized(o),'Odrzucenie nie zmieniło koszyka');
  if(changes)h.set('collectionBlocked',true);
 }
}
export function paymentPost(pm,h,kind='main'){
 const rows=h.ok();h.assert(Array.isArray(rows)&&rows.length,'Brak płatności');
 pm.test('Oferty mają poprawne rabaty i unikalne kody',()=>{h.assert(new Set(rows.map(p=>p.code)).size===rows.length,'Duplikaty');for(const p of rows)h.assert(typeof p.code==='string'&&Number.isFinite(p.rebatePercent)&&p.rebatePercent>=0&&p.rebatePercent<=100&&Number.isSafeInteger(p.orderItemTotal),'Nieprawidłowa oferta');});
 const p=h.choose(rows,h.get('preferred_payment_code'));h.set(kind==='main'?'selectedPaymentMethodCode':'workPayment',p.code);if(kind==='main')h.set('selectedPaymentMethod',p);
}
export function shippingPost(pm,h,kind='main'){
 const rows=h.shippingList(h.ok()),m=h.choose(rows,h.get('preferred_shipping_code'));h.set(kind==='main'?'selectedShippingMethodCode':'workShipping',m.code);
}
export function checkoutPre(pm,h,{kind='main',variant='valid',book=false}={}){
 const payload={shippingMethodCode:h.get(kind==='main'?'selectedShippingMethodCode':'workShipping'),...h.addresses(book?h.get('runMarker'):'')};
 if(book)for(const a of [payload.shippingAddress,payload.billingAddress])a.saveToAddressBook=true;
 if(variant==='no-shipping')delete payload.shippingAddress;
 if(variant==='no-billing')delete payload.billingAddress;
 if(variant==='bad-shipping')payload.shippingMethodCode='qa-unavailable-'+pm.variables.replaceIn('{{$guid}}');
 if(variant==='detach')for(const a of [payload.shippingAddress,payload.billingAddress])a.company=h.get('runMarker')+'-DETACHED';
 h.body(payload);
}
export function validationPost(pm,h,statuses=[400,422]){
 h.data();h.status(statuses);h.set('negativeStatus',pm.response.code);
 // Nie przerywamy po niepoprawnym HTTP: kolejny GET ma pokazać ewentualny częściowy zapis.
}
export function requireComplete(pm,h){
 h.need('tokenValue','beforeComplete');h.assert(h.get('completeAttempted')!==h.current(),'Complete już próbowano dla tego koszyka — sprawdź zapis przed kolejnym działaniem.');h.set('completeAttempted',h.current());
}
export function completePost(pm,h){h.ok([200,204]);h.set('completeResponseAccepted',h.current());}
export function pdfPre(pm,h,kind){
 if(kind==='paymentForm'&&!h.get(kind)){pm.execution.skipRequest();return;}
 h.need(kind);let value=h.get(kind);if(value.startsWith('/'))value='https://ksiegarnia.gwodev.pl'+value;
 h.assert(/^https:\/\/ksiegarnia\.gwodev\.pl\/orders\//.test(value),'Dokument musi pochodzić z /orders/ na hoście DEV');pm.variables.set('document_url',value);
}
export function pdfPost(pm,h){
 h.status([200]);pm.test('Odpowiedź jest dokumentem PDF',()=>{h.assert((pm.response.headers.get('Content-Type')||'').toLowerCase().includes('application/pdf'),'Nieprawidłowy Content-Type');h.assert(pm.response.text().startsWith('%PDF-'),'Brak sygnatury PDF');});
}
export function bookPost(pm,h,mode){
 const d=h.ok(),rows=Array.isArray(d)?d:d?.data??d?.['hydra:member'];h.assert(Array.isArray(rows),'Nie rozpoznano książki adresowej');
 const last=d?.pagination?.last??1;h.assert(last===1&&!d?.['hydra:view']?.['hydra:next']&&rows.length<100,'Książka wymaga paginacji — przerwano bez usuwania danych.');
 if(mode==='baseline')h.set('bookBaseline',rows.map(a=>a.id));
 if(mode==='created'){
  const baseline=h.json('bookBaseline'),marker=h.get('runMarker');const created=rows.filter(a=>!baseline.includes(a.id)&&[marker+'-S',marker+'-B'].includes(a.company));
  h.assert(created.length===2,'Nie znaleziono dokładnie dwóch nowych adresów QA');h.set('createdAddressIds',created.map(a=>String(a.id)));h.set('addressDeleteQueue',created.map(a=>String(a.id)));
 }
 if(mode==='cleaned')pm.test('Usunięto wyłącznie nowe adresy QA',()=>{const ids=h.json('createdAddressIds');h.assert(!rows.some(a=>ids.includes(String(a.id))),'Pozostały adresy QA');});
}
export function addressDeletePre(pm,h){
 const ids=h.json('addressDeleteQueue');h.assert(ids.length,'Pusta kolejka usuwania');const id=String(ids[0]);h.assert(h.json('createdAddressIds').includes(id)&&!h.json('bookBaseline').map(String).includes(id),'Nie wolno usuwać istniejącego adresu');pm.variables.set('qa_address_id',encodeURIComponent(id));
}
export function addressDeletePost(pm,h){
 h.ok([200,204]);const ids=h.json('addressDeleteQueue');ids.shift();h.set('addressDeleteQueue',ids);if(ids.length)pm.execution.setNextRequest(pm.info.requestName);
}
