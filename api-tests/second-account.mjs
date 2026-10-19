import assert from 'node:assert/strict';
import {ApiClient} from './http.mjs';
import {normalizeOrder} from './engine.mjs';
import {accessSnapshot,accessDifferences,hasReadableAddresses} from './regression-access.mjs';

export function secondAccountFromEnv(vars,primary){
  const keys={bank_transfer:'HURT_SECOND_REBATE_BANK_TRANSFER',cash_on_delivery:'HURT_SECOND_REBATE_CASH_ON_DELIVERY',bank_transfer_1_day:'HURT_SECOND_REBATE_BANK_TRANSFER_1_DAY',payment_timely:'HURT_SECOND_REBATE_PAYMENT_TIMELY',adamada:'HURT_SECOND_REBATE_ADAMADA'};
  if(!vars.HURT_SECOND_EMAIL&&!vars.HURT_SECOND_API_PASSWORD&&!Object.values(keys).some(k=>vars[k]))return undefined;
  const rebates={};for(const [code,key]of Object.entries(keys))if(vars[key]?.trim())rebates[code]=Number(vars[key].replace(',','.'));
  return {credentials:{...primary,email:vars.HURT_SECOND_EMAIL,password:vars.HURT_SECOND_API_PASSWORD,testsToken:vars.HURT_SECOND_TESTS_TOKEN||primary.testsToken},rebates};
}

export async function checkSecondAccount({config,primary,secondary,settings,test,skip,options,snapshots=[]}){
  if(!secondary){skip('Drugie konto: rabaty i izolacja koszyków','Uzupełnij HURT_SECOND_EMAIL, HURT_SECOND_API_PASSWORD i oczekiwane rabaty HURT_SECOND_REBATE_* w .env.');return;}
  primary.secrets.push(...Object.values(secondary.credentials).filter(v=>typeof v==='string'));
  const other=new ApiClient(config,secondary.credentials,options);other.requests=primary.requests;
  const call=async(api,method,endpoint,args={},statuses=[200])=>{const r=await api.request(method,endpoint,args);assert(statuses.includes(r.status),`${method}: oczekiwano ${statuses.join('/')}, otrzymano ${r.status}`);return r.data;};
  const create=async(api,product)=>{const o=await call(api,'POST','shop/orders',{body:{localeCode:'pl_PL'}},[200,201]);assert(o.tokenValue,'Brak tokenu koszyka');primary.secrets.push(o.tokenValue);other.secrets.push(o.tokenValue);const root='shop/orders/'+encodeURIComponent(o.tokenValue);await call(api,'POST',root+'/items/bulk',{body:{items:[{productVariant:product.productVariant,quantity:1}]}},[200,201,204]);return {root,wholesale:'wholesale/orders/'+encodeURIComponent(o.tokenValue),checkout:'wholesale/checkout-step-two/'+encodeURIComponent(o.tokenValue)};};
  const logged=await test('Drugie konto: odrębne dane i poprawne logowanie',async()=>{
    assert(secondary.credentials.email&&secondary.credentials.password,'Uzupełnij dane drugiego konta w .env');
    assert.notEqual(secondary.credentials.email.trim().toLowerCase(),primary.credentials.email.trim().toLowerCase(),'Potrzebne dwa różne konta');
    for(const value of Object.values(secondary.rebates))assert(Number.isFinite(value)&&value>=0&&value<=100,'Rabat drugiego konta musi być liczbą 0–100');
    await other.loginShop();primary.secrets.push(...Object.values(other.tokens));assert.notEqual(other.tokens.shop,primary.tokens.shop,'Oba logowania zwróciły ten sam token');
  });
  if(!logged)return;
  for(const [group,products]of Object.entries(settings.groups))await test('Drugie konto / '+group+': oferty i rabaty po wyborze płatności',async()=>{
    const c=await create(other,products[0]);const offers=await call(other,'GET',c.wholesale+'/payments');assert(Array.isArray(offers)&&offers.length,'Brak ofert');
    if(group!=='adamada')for(const code of Object.keys(secondary.rebates).filter(c=>c!=='adamada'))if(!offers.some(o=>o.code===code))skip('Drugie konto: niedostępna płatność '+code,'Rabat jest skonfigurowany, ale API nie oferuje tej płatności dla badanego koszyka. Nie wybierano jej poza listą dostępności.');
    for(const offer of offers){const expected=secondary.rebates[group==='adamada'?'adamada':offer.code];assert(expected!==undefined,'Uzupełnij oczekiwany rabat drugiego konta dla '+(group==='adamada'?'Adamada':offer.code));assert.equal(offer.rebatePercent,expected,'Oferta: '+offer.code);await call(other,'PATCH',c.wholesale+'/payment-method',{body:{paymentMethodCode:offer.code}},[200,204]);const o=await call(other,'GET',c.root);assert(o.items?.length,'Brak pozycji');for(const item of o.items){snapshots.push(['Drugie konto / '+group+' / '+offer.code+' / oczekiwano '+expected+'%',o.id,item.product?.code,item.quantity,item.rebatePercent,item.discountedUnitPriceNet,item.total,o.shippingTotal,o.shippingTotalNet,o.shipmentPackageQuantity]);assert.equal(item.rebatePercent,expected,'Rabat pozycji po '+offer.code);}}
  });
  for(const [label,owner,intruder]of [['A → B',primary,other],['B → A',other,primary]]){
    const ready=await test('Izolacja '+label+': właściciel odczytuje własny koszyk',async()=>{
      const c=await create(owner,settings.groups.pozostale[0]);const offers=await call(owner,'GET',c.wholesale+'/payments');assert(offers?.length,'Brak płatności właściciela');await call(owner,'PATCH',c.wholesale+'/payment-method',{body:{paymentMethodCode:offers[0].code}},[200,204]);const o=await call(owner,'GET',c.root);assert(o.items.length,'Brak pozycji właściciela');
    });
    if(!ready)continue;
    const attempts=[['odczyt koszyka','GET',c=>c.root,()=>({})],['odczyt płatności','GET',c=>c.wholesale+'/payments',()=>({})],['odczyt dostaw','GET',c=>c.checkout,()=>({})],['zmiana ilości','PATCH',c=>c.root+'/items/'+c.itemId,()=>({body:{quantity:2}})],['dodanie produktu','POST',c=>c.root+'/items/bulk',()=>({body:{items:[{productVariant:settings.groups.pozostale[0].productVariant,quantity:1}]}})],['zmiana płatności','PATCH',c=>c.wholesale+'/payment-method',c=>({body:{paymentMethodCode:c.paymentCode}})],['zmiana dostawy','POST',c=>c.checkout,c=>({body:{orderTokenValue:c.token,shippingMethodCode:c.shippingCode,shippingAddress:{...config.scenario.shippingAddress,city:'QA foreign address'},billingAddress:{...config.scenario.billingAddress,city:'QA foreign billing'}}})],['usunięcie pozycji','DELETE',c=>c.root+'/items/'+c.itemId,()=>({})]];
    for(const [name,method,endpoint,args]of attempts)await test('Izolacja '+label+': cudzy '+name,async()=>{
      // Każda obca operacja otrzymuje nowy koszyk. Poprzednia próba nie może zanieczyścić następnej.
      const c=await create(owner,settings.groups.pozostale[0]);const offers=await call(owner,'GET',c.wholesale+'/payments');assert(offers?.length,'Brak płatności właściciela');c.paymentCode=offers[0].code;await call(owner,'PATCH',c.wholesale+'/payment-method',{body:{paymentMethodCode:c.paymentCode}},[200,204]);
      const delivery=await call(owner,'GET',c.checkout);const raw=delivery.shippingMethods,methods=Array.isArray(raw)?raw:raw?.['hydra:member']??raw?.member;assert(methods?.length,'Brak dostaw właściciela');c.shippingCode=methods[0].code;
      c.token=(await call(owner,'GET',c.root)).tokenValue;
      await call(owner,'POST',c.checkout,{body:{orderTokenValue:c.token,shippingMethodCode:c.shippingCode,shippingAddress:config.scenario.shippingAddress,billingAddress:config.scenario.billingAddress}},[200,201,204]);
      const rawBefore=await call(owner,'GET',c.root),addressesReadable=hasReadableAddresses(rawBefore);
      if(!addressesReadable)skip('Izolacja '+label+' / '+name+': pełne adresy','GET koszyka nie zwraca obu adresów. Kontrola kwot i metod pozostaje niezależna.');
      const before=accessSnapshot(rawBefore);assert(before.items.length,'Brak pozycji właściciela');c.itemId=before.items[0].id;
      const target=endpoint(c),r=await intruder.request(method,target,args(c)),after=accessSnapshot(await call(owner,'GET',c.root));
      const changes=accessDifferences(before,after),evidence={cartId:before.id,isolation:{direction:label,method,status:r.status,expectedStatuses:[403,404],freshCart:true,changes,addressComparison:addressesReadable}};
      if(changes.length)throw Object.assign(new Error('Obce żądanie '+method+' (HTTP '+r.status+') zmieniło koszyk '+before.id+'. '+changes.slice(0,5).map(d=>d.field+': '+JSON.stringify(d.before)+' → '+JSON.stringify(d.after)).join('; ')),{evidence});
      if(![403,404].includes(r.status))throw Object.assign(new Error('Dostęp do cudzego koszyka: oczekiwano 403/404, otrzymano '+r.status),{evidence});
      return evidence;
    });
    if(options.complete)await test('ISO-006 / '+label+': wycena przed obcym żądaniem, po nim i po zapisie',async()=>{
      const c=await create(owner,settings.groups.pozostale[0]);const offers=await call(owner,'GET',c.wholesale+'/payments');assert(offers?.length,'Brak płatności');
      const payment=offers[0],expected=(owner===primary?settings.paymentRebates:secondary.rebates)?.[payment.code];
      assert(Number.isFinite(expected),'Brak niezależnego rabatu właściciela — nie zapisano koszyka diagnostycznego');
      await call(owner,'PATCH',c.wholesale+'/payment-method',{body:{paymentMethodCode:payment.code}},[200,204]);
      const delivery=await call(owner,'GET',c.checkout),raw=delivery.shippingMethods,methods=Array.isArray(raw)?raw:raw?.['hydra:member']??raw?.member;assert(methods?.length,'Brak dostawy');
      const initial=await call(owner,'GET',c.root);await call(owner,'POST',c.checkout,{body:{orderTokenValue:initial.tokenValue,shippingMethodCode:methods[0].code,shippingAddress:config.scenario.shippingAddress,billingAddress:config.scenario.billingAddress}},[200,201,204]);
      const before=accessSnapshot(await call(owner,'GET',c.root));assert(before.items.length,'Brak produktów');for(const item of before.items)assert.equal(item.rebatePercent,expected,'Niewłaściwy rabat przed próbą — nie zapisano');
      const foreign=await intruder.request('GET',c.wholesale+'/payments'),afterForeign=accessSnapshot(await call(owner,'GET',c.root));
      // Świadomy zapis diagnostyczny po pomiarze, także gdy izolacja zawiodła.
      // Nie zastępuje zabezpieczenia cen w zwykłym runScenario.
      let completed,completionError;
      try{completed=await owner.request('PATCH',c.root+'/complete',{body:{}});}catch(error){completionError=error;}
      const saved=accessSnapshot(await call(owner,'GET',c.root));
      if(!saved.number)skip('ISO-006 / '+label+': numer zamówienia','GET po complete nie udostępnia numeru. Wycena jest porównana osobno; numer sprawdź w CMS po id koszyka.');
      const isolationChanges=accessDifferences(before,afterForeign),savedChanges=accessDifferences(before,{...saved,number:before.number,state:before.state});
      const amounts=o=>({itemsTotal:o.itemsTotal,total:o.total,totalNet:o.totalNet,rebatePercent:o.items[0]?.rebatePercent});
      const evidence={cartId:before.id,isolation:{direction:label,method:'GET',status:foreign.status,expectedStatuses:[403,404],freshCart:true,changes:isolationChanges},completionComparison:{before:amounts(before),afterForeign:amounts(afterForeign),saved:amounts(saved),status:completed?.status??'NETWORK_ERROR',orderNumber:saved.number,changes:savedChanges,limit:'Kontrola API trzech stanów; nie potwierdza osobno CMS, e-maili ani transferu.'}};
      const failures=[];
      if(![403,404].includes(foreign.status))failures.push('obce żądanie: HTTP '+foreign.status);
      if(isolationChanges.length)failures.push('podsumowanie zmienione po obcym żądaniu: '+isolationChanges.length+' pól');
      if(completionError||![200,204].includes(completed?.status)||saved.state==='cart'||saved.id!==before.id)failures.push('zapis niepotwierdzony w odpowiedzi complete; wykonano odczyt bez ponowienia PATCH');
      if(savedChanges.length)failures.push('zapis różni się od poprawnego stanu właściciela: '+savedChanges.length+' pól');
      if(failures.length)throw Object.assign(new Error(failures.join('; ')+'. Poprawny zapis nie usuwa wcześniejszego błędu izolacji.'),{evidence});
      return evidence;
    });else skip('ISO-006 / '+label+': porównanie po finalizacji','Tylko wariant regresji z zapisem. Bez finalizacji nie wysyłamy diagnostycznego complete.');
  }
}

export {orderDifferences} from './regression-access.mjs';
