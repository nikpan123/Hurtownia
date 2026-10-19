import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ApiClient} from './http.mjs';
import {normalizeOrder,runScenario} from './engine.mjs';
import {saveFeatureReport} from './feature-report.mjs';
import {checkSecondAccount} from './second-account.mjs';
import {checkDeniedAuthentication,checkRepeatedCompletion,accessSnapshot,accessDifferences} from './regression-access.mjs';

export function packageQuote(weight,settings,surchargeGrossMinor=0){
  assert(Number.isSafeInteger(weight)&&weight>=0,'Waga musi być całkowitą liczbą gramów');
  assert(Number.isSafeInteger(settings.singlePackageWeight)&&settings.singlePackageWeight>0,'Nieprawidłowa waga paczki');
  assert(typeof settings.priceIsNet==='boolean','Określ netto/brutto cennika');
  assert(Number.isSafeInteger(settings.taxPercent)&&settings.taxPercent>=0,'Brak potwierdzonej stawki VAT dostawy');
  const bands=settings.weightRanges.filter(b=>weight>=b.from&&weight<=b.to);
  assert.equal(bands.length,1,'Waga musi pasować do dokładnie jednego przedziału');
  assert(Number.isSafeInteger(bands[0].priceMinor)&&bands[0].priceMinor>=0,'Cena paczki musi być w groszach');
  const shipmentPackageQuantity=weight===0?0:Math.ceil(weight/settings.singlePackageWeight);
  const cost=shipmentPackageQuantity*bands[0].priceMinor;
  const round=(n,d)=>Number((BigInt(n)*2n+BigInt(d))/(BigInt(d)*2n));
  assert(Number.isSafeInteger(surchargeGrossMinor)&&surchargeGrossMinor>=0,'Uzupełnij potwierdzoną dopłatę płatności dla GLS w groszach (0, jeśli brak)');
  const shippingTotal=(settings.priceIsNet?round(cost*(100+settings.taxPercent),100):cost)+surchargeGrossMinor;
  return {shipmentPackageQuantity,shippingTotal,shippingTotalNet:surchargeGrossMinor?round(shippingTotal*100,100+settings.taxPercent):settings.priceIsNet?cost:round(cost*100,100+settings.taxPercent)};
}
export function boundaryQuantities(unitWeight,settings){
  assert(Number.isSafeInteger(unitWeight)&&unitWeight>0,'Potrzebna potwierdzona waga produktu w gramach');
  const limits=[settings.singlePackageWeight,settings.singlePackageWeight*2,...settings.weightRanges.flatMap(b=>[b.from,b.to]).filter(n=>n>0&&n<settings.singlePackageWeight*4)];
  return [...new Set([1,...limits.flatMap(n=>[Math.floor(n/unitWeight)-1,Math.floor(n/unitWeight),Math.floor(n/unitWeight)+1])])].filter(n=>n>0&&n<=1000).sort((a,b)=>a-b);
}

export async function runOrderRegression(config,credentials,options={}){
  const settings=options.settings??JSON.parse(await readFile('config/order-regression.local.json','utf8'));
  const directory=options.directory??path.resolve(config.outputDirectory??'raporty-api','order-regression-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8));
  const api=new ApiClient(config,credentials,options);
  const report={scenario:options.packagesOnly?'Paczki i koszt dostawy GLS':'Regresja koszyka i zamówienia',kind:'order-regression',generatedAt:new Date().toISOString(),baseUrl:config.baseUrl,status:'RUNNING',scopeNote:options.complete?'Zapis do 3 poprawnych zamówień oraz do 2 diagnostycznych ISO-006. Druga próba complete tylko po potwierdzonym zapisie. Negatywne próby mogą ujawnić błędny zapis backendu.':'Bez finalizacji. Przypadki wymagające zapisu są jawnie pomijane.',tests:[],requests:api.requests,tables:[],reference:settings};
  const quoteRows=[];const quoteTable={title:'Oferty płatności — zestawienie informacyjne, bez oceny zgodności zaokrągleń',headers:['Koszyk','Płatność','Podstawa','Oferta (grosze)','Produkty (grosze)','Różnica (grosze)'],rows:quoteRows};
  const snapshots=[],combinations=[];report.tables.push({title:'Kombinacje płatności i dostawy',headers:['Grupa','Koszyk','Płatność','Dostawa','Brutto produkty','Brutto dostawa','Paczki'],rows:combinations});
  report.tables.push({title:'Pomiary koszyka',headers:['Przypadek / etap','Koszyk','Kod','Ilość','Rabat %','Netto / szt.','Brutto pozycji','Brutto dostawy','Netto dostawy','Paczki'],rows:snapshots});
  report.tables.push(quoteTable);
  const skip=(name,detail)=>report.tests.push({name,status:'SKIP',detail});
  const test=async(name,fn)=>{options.signal?.throwIfAborted();options.onProgress?.(name);const requestStart=api.requests.length,observationStart=snapshots.length;const evidence=(extra={})=>({requests:api.requests.slice(requestStart),observations:snapshots.slice(observationStart),...extra});try{const details=await fn();report.tests.push({name,status:'PASS',detail:'',evidence:evidence(details)});return true;}catch(e){report.tests.push({name,status:'FAIL',detail:api.clean(e.message),evidence:evidence(e.evidence)});options.signal?.throwIfAborted();return false;}};
  const request=async(method,endpoint,args={},statuses=[200])=>{const r=await api.request(method,endpoint,args);assert(statuses.includes(r.status),`${method} ${endpoint}: HTTP ${r.status}; ${api.clean(r.data?.message??r.data?.detail??r.data?.['hydra:description']??'')}`);return r.data;};
  const get=cart=>request('GET',cart.path);
  const add=(cart,items)=>request('POST',cart.path+'/items/bulk',{body:{items:items.map(p=>({productVariant:p.productVariant,quantity:p.quantity??1}))}},[200,201,204]);
  const create=async(products=[])=>{const o=await request('POST','shop/orders',{body:{localeCode:'pl_PL'}},[200,201]);assert(o.tokenValue,'Brak tokenu koszyka');api.secrets.push(o.tokenValue);const cart={id:o.id,path:'shop/orders/'+encodeURIComponent(o.tokenValue),wholesale:'wholesale/orders/'+encodeURIComponent(o.tokenValue),checkout:'wholesale/checkout-step-two/'+encodeURIComponent(o.tokenValue),token:o.tokenValue};if(products.length)await add(cart,products);return cart;};
  function verify(o,label,expected){
    assert(Array.isArray(o.items),'Brak pozycji');
    for(const k of ['itemsTotal','total','totalNet','shippingTotal'])assert(Number.isSafeInteger(o[k])&&o[k]>=0,'Nieprawidłowa kwota '+k);
    assert.equal(o.itemsTotal,o.items.reduce((s,i)=>s+i.total,0),'Suma pozycji');assert.equal(o.total,o.itemsTotal+o.shippingTotal,'Produkty + dostawa');
    for(const i of o.items){assert(Number.isSafeInteger(i.quantity)&&i.quantity>0,'Ilość');for(const k of ['unitPrice','total','unitPriceNet','discountedUnitPriceNet','totalNetSalesAfterDiscount'])assert(Number.isSafeInteger(i[k])&&i[k]>=0,'Kwota pozycji '+k);if(expected!==undefined)assert.equal(i.rebatePercent,expected,'Rabat pozycji '+i.product?.code);snapshots.push([label,o.id,i.product?.code,i.quantity,i.rebatePercent,i.discountedUnitPriceNet,i.total,o.shippingTotal,o.shippingTotalNet,o.shipmentPackageQuantity]);}
  }
  const payments=async cart=>{const p=await request('GET',cart.wholesale+'/payments');assert(Array.isArray(p)&&p.length,'Brak płatności');assert(p.every(v=>typeof v.code==='string'&&v.code&&Number.isFinite(v.rebatePercent)&&v.rebatePercent>=0&&v.rebatePercent<=100&&Number.isSafeInteger(v.orderItemTotal)&&v.orderItemTotal>=0),'Nieprawidłowe oferty płatności');assert.equal(new Set(p.map(v=>v.code)).size,p.length,'Powtórzone płatności');return p;};
  const pay=(cart,code)=>request('PATCH',cart.wholesale+'/payment-method',{body:{paymentMethodCode:code}},[200,204]);
  const shipping=async cart=>{const r=await request('GET',cart.checkout);const raw=r?.shippingMethods;const list=Array.isArray(raw)?raw:raw?.['hydra:member']??raw?.member;assert(Array.isArray(list)&&list.length,'Brak dostaw');assert(list.every(v=>typeof v.code==='string'&&v.code),'Nieprawidłowe kody dostawy');assert.equal(new Set(list.map(v=>v.code)).size,list.length,'Powtórzone dostawy');return list;};
  const ship=(cart,code,address=config.scenario.shippingAddress)=>request('POST',cart.checkout,{body:{orderTokenValue:cart.token,shippingMethodCode:code,shippingAddress:address,billingAddress:config.scenario.billingAddress}},[200,201,204]);
  const expectedRebate=(group,code,offer)=>group==='adamada'?settings.adamadaRebatePercent:settings.paymentRebates?.[code]??offer.rebatePercent;
  async function rejectUnchanged(cart,method,endpoint,args,statuses,authorization=false){
    assert(Array.isArray(statuses)&&statuses.length&&statuses.every(s=>[400,404,409,422].includes(s)||(authorization&&s===403)),'Skonfiguruj oczekiwane błędy walidacji (403 tylko dla braku uprawnień; bez 401/500)');
    const before=accessSnapshot(await get(cart));const r=await api.request(method,endpoint,args);const after=accessSnapshot(await get(cart));const changes=accessDifferences(before,after);
    const evidence={cartId:before.id,validation:{method,expectedStatuses:statuses,actualStatus:r.status,changes}};
    if(!statuses.includes(r.status)||changes.length)throw Object.assign(new Error((!statuses.includes(r.status)?'Oczekiwano '+statuses.join('/')+', otrzymano '+r.status+'. ':'')+(changes.length?'Żądanie zmieniło koszyk: '+changes.slice(0,5).map(d=>d.field+': '+JSON.stringify(d.before)+' → '+JSON.stringify(d.after)).join('; '):'Koszyk po żądaniu pozostał niezmieniony.')),{evidence});
    return evidence;
  }
  try{
    if(!await test('Logowanie hurtownika',()=>api.loginShop()))throw new Error('Nie można uruchomić scenariuszy bez logowania');
    assert(settings.groups?.pozostale?.length&&settings.groups?.adamada?.length,'Skonfiguruj produkty obu grup');
    assert(Number.isInteger(settings.maxCombinations)&&settings.maxCombinations>0&&settings.maxCombinations<=96,'maxCombinations: 1–96');
    if(!options.packagesOnly)await checkDeniedAuthentication({api,create:async()=>{const c=await create([settings.groups.pozostale[0]]);await pay(c,(await payments(c))[0].code);return c;},get,test});
    if(!options.packagesOnly)await test('CART-001: utworzenie i odczyt pustego koszyka',async()=>{
      const c=await create(),o=await get(c);assert.equal(o.id,c.id,'Inny koszyk niż utworzony');assert.deepEqual(o.items,[],'Nowy koszyk zawiera produkty');assert.equal(o.itemsTotal,0,'Pusty koszyk ma koszt produktów');verify(o,'Pusty koszyk');
      assert.deepEqual(accessSnapshot(await get(c)),accessSnapshot(o),'Ponowny GET zmienił pusty koszyk');
    });
    if(!options.packagesOnly){
      const stock=settings.stockFixture;
      if(!stock)skip('Przekroczenie zapasu','Uzupełnij stockFixture: {productVariant, availableQuantity, source}; aktualny zapas i blokada backorder muszą być potwierdzone niezależnie.');
      else await test('Przekroczenie potwierdzonego zapasu',async()=>{
        assert(typeof stock.productVariant==='string'&&stock.productVariant&&typeof stock.source==='string'&&stock.source.trim(),'Potrzebny kod produktu i niezależne źródło zapasu');
        assert(Number.isSafeInteger(stock.availableQuantity)&&stock.availableQuantity>=1&&stock.availableQuantity<1000,'Zapas referencyjny: 1–999 sztuk, bez backorder');
        const c=await create([{productVariant:stock.productVariant,quantity:1}]),o=await get(c);
        return rejectUnchanged(c,'PATCH',c.path+'/items/'+o.items[0].id,{body:{quantity:stock.availableQuantity+1}},settings.validationStatuses.stock??[400,422]);
      });
    }
    let count=0;const firstChoices={};
    if(!options.packagesOnly)for(const [group,products]of Object.entries(settings.groups)){
      let offered=[];await test(group+': pobranie dostępnych płatności',async()=>{const c=await create([products[0]]);offered=await payments(c);if(group==='adamada')for(const p of offered)assert.equal(p.rebatePercent,settings.adamadaRebatePercent,'Rabat Adamada dla '+p.code);});
      if(offered.length>1)await test(group+': zmiana płatności i powrót do pierwszej w tym samym koszyku',async()=>{
        const c=await create([products[0]]);let baseline;
        for(const offer of [...offered,offered[0]]){
          assert((await payments(c)).some(p=>p.code===offer.code),'Płatność przestała być dostępna: '+offer.code);
          await pay(c,offer.code);const o=await get(c);verify(o,'Zmiana płatności / '+offer.code,expectedRebate(group,offer.code,offer));
          assert.equal(normalizeOrder(o).paymentCode,offer.code,'Nie zapisano wybranej płatności');
          await shipping(c);
          if(!baseline)baseline=normalizeOrder(o);
          const before=accessSnapshot(o);await payments(c);assert.deepEqual(accessSnapshot(await get(c)),before,'Własny odczyt ofert zmienił wycenę lub adresy');
        }
        assert.deepEqual(normalizeOrder(await get(c)),baseline,'Powrót do pierwszej płatności nie przywrócił stanu koszyka');
      });else skip(group+': zmiana między dostępnymi płatnościami','API nie udostępniło co najmniej dwóch płatności. Nie zastępujemy ich nieistniejącymi kodami.');
      const forbidden=settings.forbiddenPayments??[];
      if(!forbidden.length)skip(group+': istniejąca niedostępna płatność','Uzupełnij forbiddenPayments: [{code, source}] po potwierdzeniu istnienia i braku uprawnień w CMS.');
      for(const fixture of forbidden)await test(group+': istniejąca niedostępna płatność '+fixture.code,async()=>{
        assert(typeof fixture.code==='string'&&fixture.code&&typeof fixture.source==='string'&&fixture.source.trim(),'Potrzebny kod i niezależne źródło potwierdzenia istnienia płatności');
        const c=await create([products[0]]);const offers=await payments(c);assert(!offers.some(p=>p.code===fixture.code),'Płatność referencyjna jest dostępna dla konta');
        await pay(c,offers[0].code);
        return rejectUnchanged(c,'PATCH',c.wholesale+'/payment-method',{body:{paymentMethodCode:fixture.code}},settings.validationStatuses.forbiddenPayment??[400,403,422],true);
      });
      for(const offer of offered){
        let methods=[];await test(group+' / '+offer.code+': dostawy po płatności',async()=>{const c=await create([products[0]]);await pay(c,offer.code);methods=await shipping(c);});
        for(const method of methods){
          if(count>=settings.maxCombinations){skip(group+' / '+offer.code+' / '+method.code,'Limit kombinacji '+settings.maxCombinations+'; zwiększ limit, aby pokryć całą macierz.');continue;}count++;
          await test(group+' / '+offer.code+' / '+method.code,async()=>{
            const c=await create([products[0]]);let o=await get(c);verify(o,'Dodanie');
            const current=await payments(c);const quote=current.find(p=>p.code===offer.code);assert(quote,'Płatność przestała być dostępna');await pay(c,offer.code);
            const rebate=expectedRebate(group,offer.code,quote);o=await get(c);verify(o,'Płatność',rebate);
            if(group!=='adamada'&&settings.paymentRebates?.[offer.code]===undefined)skip('Niezależny rabat '+offer.code,'Sprawdzono spójność z ofertą API. Uzupełnij paymentRebates, aby sprawdzać także ustawienia konta.');
            for(const quantity of settings.quantities){assert(Number.isInteger(quantity)&&quantity>0&&quantity<=1000,'Ilości: 1–1000');await request('PATCH',c.path+'/items/'+o.items[0].id,{body:{quantity}},[200,204]);o=await get(c);assert.equal(o.items[0].quantity,quantity);verify(o,'Zmiana ilości po płatności',rebate);}
            const fresh=await payments(c);const freshQuote=fresh.find(p=>p.code===offer.code);assert(freshQuote,'Brak oferty po edycji');const basis=config.scenario.expectations?.paymentQuoteTotalBasis;
            if((basis==='net'||basis==='gross')&&config.scenario.expectations?.enforcePaymentQuoteTotal===true)assert.equal(freshQuote.orderItemTotal,basis==='net'?o.items.reduce((s,i)=>s+i.totalNetSalesAfterDiscount,0):o.itemsTotal,'Aktualna wycena płatności');else { const actual=basis==='net'?o.items.reduce((sum,i)=>sum+i.totalNetSalesAfterDiscount,0):basis==='gross'?o.itemsTotal:undefined;quoteRows.push([c.id,offer.code,basis??'nieustalona',freshQuote.orderItemTotal,actual??'nieustalona',actual===undefined?'nieustalona':actual-freshQuote.orderItemTotal]);(report.observations??=[]).push({name:'Oferta płatności / koszyk '+c.id,payment:offer.code,basis,offer:freshQuote.orderItemTotal,cart:actual,difference:actual===undefined?undefined:actual-freshQuote.orderItemTotal,detail:'Zestawienie informacyjne — bez potwierdzonej wspólnej reguły naliczania i zaokrąglania nie wymagamy równości.'}); }
            assert((await shipping(c)).some(m=>m.code===method.code),'Dostawa przestała być dostępna');await ship(c,method.code);o=await get(c);verify(o,'Dostawa',rebate);
            assert.equal(normalizeOrder(o).paymentCode,offer.code);assert.equal(normalizeOrder(o).shippingCode,method.code);
            if(settings.nonPackageShippingCodes.includes(method.code))assert.equal(o.shipmentPackageQuantity??0,0,'Dostawa bez kalkulatora zwraca paczki');
            combinations.push([group,c.id,offer.code,method.code,o.itemsTotal,o.shippingTotal,o.shipmentPackageQuantity]);firstChoices[group]??={payment:offer.code,shipping:method.code};
          });
        }
      }
      await test(group+': kilka produktów, ponowne dodanie i usunięcie',async()=>{assert(products.length>=2,'Potrzebne dwa produkty grupy');const c=await create(products.slice(0,2));await add(c,[products[0]]);let o=await get(c);assert.equal(o.items.length,2);const item=o.items.find(i=>i.product?.code===products[0].productVariant);assert(item,'Nie znaleziono pierwszego produktu');assert.equal(item.quantity,2);verify(o,'Dodanie drugi raz');await request('DELETE',c.path+'/items/'+item.id,{},[200,204]);o=await get(c);assert.equal(o.items.length,1);verify(o,'Usunięcie pozycji');});
      for(const quantity of settings.invalidQuantities)await test(group+': odrzucenie ilości '+quantity,async()=>{const c=await create([products[0]]);const o=await get(c);await rejectUnchanged(c,'PATCH',c.path+'/items/'+o.items[0].id,{body:{quantity}},settings.validationStatuses.quantity);});
      for(const kind of ['product','payment','shipping'])await test(group+': nieistniejący kod '+kind,async()=>{const c=await create([products[0]]);const code='qa-nonexistent-'+crypto.randomUUID();if(kind==='product')await rejectUnchanged(c,'POST',c.path+'/items/bulk',{body:{items:[{productVariant:code,quantity:1}]}},settings.validationStatuses.product);if(kind==='payment')await rejectUnchanged(c,'PATCH',c.wholesale+'/payment-method',{body:{paymentMethodCode:code}},settings.validationStatuses.payment);if(kind==='shipping'){await pay(c,(await payments(c))[0].code);await rejectUnchanged(c,'POST',c.checkout,{body:{orderTokenValue:c.token,shippingMethodCode:code,shippingAddress:config.scenario.shippingAddress,billingAddress:config.scenario.billingAddress}},settings.validationStatuses.shipping);}});
      await test(group+': niepełny adres wysyłki',async()=>{const c=await create([products[0]]);await pay(c,(await payments(c))[0].code);await rejectUnchanged(c,'POST',c.checkout,{body:{orderTokenValue:c.token,shippingMethodCode:(await shipping(c))[0].code,shippingAddress:{...config.scenario.shippingAddress,city:'',street:'',postcode:''},billingAddress:config.scenario.billingAddress}},settings.validationStatuses.address??[400,422]);});
    }
    const pack=settings.packages;
    if(pack?.product?.unitWeightGrams&&pack.calculator){
      const quantities=pack.quantities??boundaryQuantities(pack.product.unitWeightGrams,pack.calculator);
      for(const quantity of [...quantities,1])await test('GLS: progi paczek / ilość '+quantity,async()=>{
        const c=await create([pack.product]);const offers=await payments(c);const p=pack.paymentCode?offers.find(p=>p.code===pack.paymentCode):offers[0];assert(p,'Referencyjna płatność paczek nie jest dostępna');await pay(c,p.code);assert((await shipping(c)).some(m=>m.code===pack.shippingCode),'GLS niedostępny dla koszyka');await ship(c,pack.shippingCode);
        let o=await get(c);const itemId=o.items[0].id;
        await request('PATCH',c.path+'/items/'+itemId,{body:{quantity}},[200,204]);await ship(c,pack.shippingCode);o=await get(c);verify(o,'Paczki / ilość '+quantity);const expected=packageQuote(quantity*pack.product.unitWeightGrams,pack.calculator,pack.paymentSurchargeGrossMinor);for(const [key,value]of Object.entries(expected))assert.equal(o[key],value,`${key}; waga ${quantity*pack.product.unitWeightGrams} g`);
        firstChoices.packages={payment:p.code,shipping:pack.shippingCode,product:{...pack.product,quantity},expected};
        if(quantity>1){await request('PATCH',c.path+'/items/'+itemId,{body:{quantity:1}},[200,204]);await ship(c,pack.shippingCode);const reduced=await get(c);verify(reduced,'Zmniejszenie wagi do 1 szt.');for(const [key,value]of Object.entries(packageQuote(pack.product.unitWeightGrams,pack.calculator,pack.paymentSurchargeGrossMinor)))assert.equal(reduced[key],value,'Po zmniejszeniu wagi: '+key);}
        for(const code of settings.nonPackageShippingCodes){if(!(await shipping(c)).some(m=>m.code===code)){skip('Zmiana GLS na '+code,'Metoda niedostępna');continue;}await ship(c,code);const without=await get(c);assert.equal(without.shipmentPackageQuantity??0,0,'Po zmianie dostawy pozostały paczki');}
      });
    }else skip('GLS: granice wag i ceny','Uzupełnij potwierdzoną wagę produktu i kalkulator w config/order-regression.local.json');
    if(options.complete){
      if(!options.packagesOnly){
        const c=await create();let before;
        const readable=await test('Pusty koszyk: odczyt przed zatwierdzeniem',async()=>{before=normalizeOrder(await get(c));assert.equal(before.items.length,0,'Koszyk powinien być pusty');});
        await test('Pusty koszyk nie może zostać zatwierdzony',async()=>{
          const statuses=settings.validationStatuses.complete;assert(Array.isArray(statuses)&&statuses.length&&statuses.every(s=>[400,404,409,422].includes(s)),'Skonfiguruj statusy walidacji complete bez 500');
          const result=await api.request('PATCH',c.path+'/complete',{body:{}});assert(statuses.includes(result.status),'Oczekiwano '+statuses.join('/')+', otrzymano '+result.status);
        });
        if(readable)await test('Pusty koszyk: niezmienność po odrzuceniu',async()=>assert.deepEqual(normalizeOrder(await get(c)),before,'Zatwierdzenie zmieniło pusty koszyk'));
        else skip('Pusty koszyk: niezmienność po odrzuceniu','Odczyt przed próbą nie powiódł się. Próba PATCH complete została wykonana osobno; brak wiarygodnego stanu do porównania.');
      }
      for(const [group,choice]of Object.entries(firstChoices))await test(group+': zapis i PDF',async()=>{
        const child=structuredClone(config);child.scenario.randomProducts={enabled:false};child.scenario.randomCheckout={payment:false,shipping:false};
        child.scenario.products=[choice.product??{...settings.groups[group][0],group,quantity:1}];child.scenario.expectations={...child.scenario.expectations,beforeComplete:choice.expected??{}};
        child.scenario.paymentMethodCode=choice.payment;child.scenario.shippingMethodCode=choice.shipping;child.scenario.name='Regresja — finalizacja '+group;
        const r=await runScenario(child,credentials,{...options,complete:true,directory:path.join(directory,'final-'+group),afterComplete:async({token,order})=>{
          api.secrets.push(token);
          if(!order.number||order.state==='cart'){skip(group+': ponowne zatwierdzenie','GET nie potwierdził numeru zapisanego zamówienia lub nadal pokazuje koszyk. Nie wysłano drugiego complete.');return;}
          await test(group+': ponowne zatwierdzenie zapisanego zamówienia',()=>checkRepeatedCompletion({api,cart:{path:'shop/orders/'+encodeURIComponent(token)},get,statuses:settings.validationStatuses.repeatComplete}));
        }});
        (report.relatedReports??=[]).push({name:'Raport zapisu i PDF: '+group,file:'final-'+group+'/raport.html'});report.tables.push({title:'Finalizacja '+group,headers:['Wynik','Raport'],rows:[[r.report.status,'final-'+group+'/raport.html']]});assert.equal(r.report.status,'PASS',r.report.error);
      });
      if(!Object.keys(firstChoices).length)skip('Finalizacja','Brak poprawnej kombinacji płatności i dostawy');
      if(!options.packagesOnly)await test('Adamada: mieszany koszyk nie może zostać zatwierdzony',async()=>{const c=await create();const added=await api.request('POST',c.path+'/items/bulk',{body:{items:[settings.groups.adamada[0],settings.groups.pozostale[0]].map(p=>({productVariant:p.productVariant,quantity:1}))}});if([400,422].includes(added.status))return;assert([200,201,204].includes(added.status),'Nieoczekiwany status dodania '+added.status);await pay(c,(await payments(c))[0].code);await ship(c,(await shipping(c))[0].code);await rejectUnchanged(c,'PATCH',c.path+'/complete',{body:{}},settings.validationStatuses.complete);});
    }else skip('Finalizacja, PDF i blokada finalizacji mieszanego koszyka','Wybierz regresję z zapisem. Bez finalizacji nie potwierdzamy reguły blokady zamówienia Adamady.');
    if(!options.verifyDatabase||!options.complete)skip('sylius_shipment.shipment_package_details i transfer orders_items / KWys','Włącz porównanie z bazą i wariant z finalizacją. Poprawne pola API nie potwierdzają zapisów w tabelach.');
    if(!options.packagesOnly){if(options.secondAccount)report.reference={...settings,secondAccountRebates:options.secondAccount.rebates};await checkSecondAccount({config,primary:api,secondary:options.secondAccount,settings,test,skip,options,snapshots});}
    if(!options.packagesOnly&&!options.complete)skip('Ponowne zatwierdzenie','Wybierz wariant regresji z zapisem. Nie ponawiamy niepotwierdzonego pierwszego complete.');
  }catch(e){report.tests.push({name:'Przebieg regresji',status:'FAIL',detail:api.clean(e.message)});}
  report.status=report.tests.some(t=>t.status==='FAIL')?'FAIL':report.tests.some(t=>t.status==='SKIP')?'INCOMPLETE':'PASS';
  const safe=api.clean(report);await saveFeatureReport(safe,directory);return {report:safe,directory};
}
