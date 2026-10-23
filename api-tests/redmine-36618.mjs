import assert from 'node:assert/strict';
import path from 'node:path';
import {ApiClient} from './http.mjs';
import {packageQuote} from './order-regression.mjs';
import {normalizeOrder} from './engine.mjs';
import {saveFeatureReport} from './feature-report.mjs';

export const packageCases = [
  'Jedna paczka', 'Dwie i trzy paczki', 'Podsumowanie i zatwierdzenie',
  'Retest: książka 140 g, płatność terminowa, odbiór własny',
  'Pozostałe dostawy bez kalkulatora', 'Kalkulator → brak kalkulatora',
  'Brak kalkulatora → kalkulator', 'Zwiększenie i zmniejszenie ilości',
  'Dokładne granice wagowe', 'Zapis KWys', 'Cena jednostkowa KWys',
  'Powtórzone podsumowanie', 'Różne formy płatności', 'Rabaty i promocje',
  'Spójność API, panelu i PDF', 'Palety i wysyłka mieszana'
].map((name, i) => ({id: `T${String(i + 1).padStart(2, '0')}`, name}));

const fields = ['shipmentPackageQuantity', 'shippingTotal', 'shippingTotalNet'];
const shippingSnapshot = order => Object.fromEntries(fields.map(key => [key, order[key]]));

export function assertShipping(order, expected) {
  for (const key of ['shippingTotal', 'shippingTotalNet', 'itemsTotal', 'total'])
    assert(Number.isSafeInteger(order[key]) && order[key] >= 0, `Nieprawidłowe pole ${key}`);
  assert(order.shippingTotal >= order.shippingTotalNet, 'Brutto dostawy mniejsze od netto');
  assert(Array.isArray(order.items), 'Brak pozycji zamówienia');
  assert.equal(order.itemsTotal, order.items.reduce((sum, item) => sum + item.total, 0), 'Suma pozycji');
  // Kontrakt hurtowni: itemsTotal zawiera już rabaty/promocje.
  // orderPromotionTotal jest informacją o obniżce, nie kolejnym składnikiem sumy.
  const promotion = order.orderPromotionTotal ?? 0;
  assert(Number.isSafeInteger(promotion), 'Nieprawidłowe orderPromotionTotal');
  assert.equal(order.total, order.itemsTotal + order.shippingTotal, 'Dostawa uwzględniona dokładnie raz');
  if (expected.noCalculator) {
    const value = order.shipmentPackageQuantity;
    if (expected.representation === 'zero') assert.equal(value, 0, 'Brak kalkulatora: oczekiwano 0');
    else if (expected.representation === 'null') assert.equal(value, null, 'Brak kalkulatora: oczekiwano null');
    else if (expected.representation === 'omitted') assert(!Object.hasOwn(order, 'shipmentPackageQuantity'), 'Pole powinno być pominięte');
    else assert(value === 0 || value === null || value === undefined, 'Dostawa bez kalkulatora zwraca paczki');
  } else assert(Number.isSafeInteger(order.shipmentPackageQuantity) && order.shipmentPackageQuantity >= 0, 'Nieprawidłowa liczba paczek');
  for (const key of fields) if (Object.hasOwn(expected, key)) assert.equal(order[key], expected[key], key);
  for (const key of ['orderPromotionTotal', 'itemsTotal', 'total'])
    if (Object.hasOwn(expected, key)) assert.equal(order[key], expected[key], key);
  if (Object.hasOwn(expected, 'rebatePercent'))
    for (const item of order.items) assert.equal(item.rebatePercent, expected.rebatePercent, 'Rabat pozycji');
}

function plans(settings, id) {
  const p = settings.packages;
  const calculated = quantity => {
    assert(p?.product?.productVariant && p.calculator && p.paymentCode, 'Uzupełnij packages: product, calculator, paymentCode');
    assert(Number.isSafeInteger(p.product.unitWeightGrams) && p.product.unitWeightGrams > 0, 'Brak potwierdzonej wagi produktu');
    assert(Number.isSafeInteger(p.paymentSurchargeGrossMinor), 'Potwierdź paymentSurchargeGrossMinor, również gdy wynosi 0');
    return {quantity, shippingCode:p.shippingCode, paymentCode:p.paymentCode,
      expected:packageQuote(quantity * p.product.unitWeightGrams, p.calculator, p.paymentSurchargeGrossMinor)};
  };
  const nonCalculated = (method, quantity = 1) => {
    assert(method?.shippingCode && method.paymentCode, 'Brak dostawy i płatności bez kalkulatora');
    for (const field of ['shippingTotal', 'shippingTotalNet']) assert(Number.isSafeInteger(method.expected?.[field]), `Uzupełnij niezależny wzorzec ${field}`);
    return {quantity, shippingCode:method.shippingCode, paymentCode:method.paymentCode,
      expected:{...method.expected, noCalculator:true, representation:method.representation}};
  };
  const q = count => {
    assert(p?.calculator && p.product?.unitWeightGrams, 'Brak danych kalkulatora');
    const quantity = Math.floor((count - 1) * p.calculator.singlePackageWeight / p.product.unitWeightGrams) + 1;
    assert.equal(calculated(quantity).expected.shipmentPackageQuantity, count, `Produkt nie pozwala uzyskać ${count} paczek`);
    return quantity;
  };
  const plan = (steps, extra = {}) => [{product:p.product, steps, ...extra}];
  if (id === 'T01') return plan([calculated(q(1))]);
  if (id === 'T02') return plan([calculated(q(2)), calculated(q(3))]);
  if (id === 'T03') return plan([calculated(q(2))], {complete:true});
  if (id === 'T04') {
    const fixture = settings.retest140g;
    assert.equal(fixture?.product?.unitWeightGrams, 140, 'Uzupełnij retest140g z potwierdzoną książką 140 g');
    assert(fixture.source, 'Potwierdź terminową płatność i odbiór bez kalkulatora w retest140g.source');
    return [{product:fixture.product, steps:[nonCalculated(fixture)], complete:true}];
  }
  if (id === 'T05') {
    assert(settings.nonCalculatorMethods?.length, 'Brak nonCalculatorMethods');
    return settings.nonCalculatorMethods.map(m => ({product:p.product, steps:[nonCalculated(m, 1), nonCalculated(m, settings.heavyQuantity ?? 100)], complete:true}));
  }
  if (id === 'T06') return plan([calculated(q(2)), nonCalculated(settings.nonCalculatorMethods?.[0], q(2))]);
  if (id === 'T07') return plan([nonCalculated(settings.nonCalculatorMethods?.[0]), calculated(q(2))]);
  if (id === 'T08') return plan([calculated(q(1)), calculated(q(3)), calculated(q(1))]);
  if (id === 'T09') {
    const limits = [...new Set([p?.calculator?.singlePackageWeight, p?.calculator?.singlePackageWeight * 2,
      ...(p?.calculator?.weightRanges ?? []).flatMap(b => [b.from > 0 ? b.from - 1 : 0, b.to])])]
      .filter(n => Number.isSafeInteger(n) && n > 0 && n < (settings.maxBoundaryWeightGrams ?? 100000));
    assert(limits.length, 'Brak progów kalkulatora');
    const weights = [...new Set(limits.flatMap(n => [n - 1, n, n + 1]))].filter(n => n > 0);
    if (p.boundaryProduct?.unitWeightGrams === 1) {
      assert(Number.isSafeInteger(p.paymentSurchargeGrossMinor), 'Potwierdź dopłatę płatności');
      return weights.map(weight => {
        const coarse = Math.floor(weight / p.product.unitWeightGrams);
        const fine = weight % p.product.unitWeightGrams;
        const entries = [{...p.product,quantity:coarse},{...p.boundaryProduct,quantity:fine}].filter(item=>item.quantity>0);
        assert(entries.every(item=>item.quantity<=1000),'Próg wymaga ponad 1000 sztuk jednej książki; użyj cięższego produktu referencyjnego');
        return {product:p.product,products:entries,steps:[{quantity:entries.reduce((sum,item)=>sum+item.quantity,0),
          items:entries.map(({productVariant,quantity})=>({productVariant,quantity})),weightGrams:weight,
          shippingCode:p.shippingCode,paymentCode:p.paymentCode,
          expected:packageQuote(weight,p.calculator,p.paymentSurchargeGrossMinor)}]};
      });
    }
    assert(weights.every(w => w % p.product.unitWeightGrams === 0), 'Do dokładnych granic użyj produktu 1 g lub extraCases.T09 z niezależnymi wzorcami');
    return plan(weights.map(w => calculated(w / p.product.unitWeightGrams)));
  }
  if (id === 'T10' || id === 'T11') return plan([calculated(q(id === 'T10' ? 1 : 3))], {complete:true, database:true});
  if (id === 'T12') return plan([calculated(q(2))], {repeat:3, complete:true, database:true});
  if (id === 'T13') {
    assert(settings.paymentVariants?.length >= 2, 'Uzupełnij co najmniej dwie paymentVariants: paymentCode, surchargeGrossMinor');
    assert(new Set(settings.paymentVariants.map(v => v.paymentCode)).size >= 2, 'Potrzebne różne płatności');
    return plan(settings.paymentVariants.map(v => ({...calculated(q(2)), paymentCode:v.paymentCode,
      expected:packageQuote(q(2) * p.product.unitWeightGrams, p.calculator, v.surchargeGrossMinor)})));
  }
  if (id === 'T14') {
    assert(settings.discountVariants?.length, 'Brak discountVariants z niezależnymi wzorcami rabatów/promocji');
    for (const v of settings.discountVariants) {
      assert(v.source && v.steps?.length >= 2, 'Rabat: źródło oraz kroki przed i po zmianie');
      assert(v.steps.some(s => s.expected?.rebatePercent > 0 || s.expected?.orderPromotionTotal < 0), 'Brak oczekiwanego rabatu/promocji');
    }
    return settings.discountVariants;
  }
  if (id === 'T15') return plan([calculated(q(2))], {complete:true, database:true});
  if (id === 'T16') {
    assert(settings.palletVariants?.length >= 2, 'Uzupełnij palletVariants: paleta oraz paleta z paczkami, z niezależnymi wzorcami');
    assert(settings.palletVariants.every(v => v.source), 'Potwierdź regułę liczenia palet w source');
    return settings.palletVariants.map(v => ({...v, complete:true, database:true}));
  }
  throw new Error(`Uzupełnij extraCases.${id}; ten wariant wymaga osobnych wzorców lub adaptera dokumentów`);
}

export async function runPackageRegression(config, credentials, options = {}) {
  const settings = options.settings;
  assert(settings && typeof settings === 'object', 'Brak konfiguracji #36618');
  const api = new ApiClient(config, credentials, options);
  const directory = options.directory ?? path.resolve(config.outputDirectory ?? 'raporty-api', `redmine-36618-${Date.now()}`);
  const report = {kind:'redmine-36618', issue:36618, scenario:'Redmine #36618 — paczki i koszt dostawy',
    generatedAt:new Date().toISOString(), baseUrl:config.baseUrl, tests:[], requests:api.requests, tables:[],
    scopeNote:options.complete ? 'Zapis zamówień dla przypadków wymagających finalizacji. Brak ponawiania complete.' : 'Testy koszyków bez zatwierdzania. Finalizacja i zależne kontrole mają SKIP.'};
  const rows = [];
  report.tables.push({title:'Podsumowanie: niezależny wzorzec i odpowiedź API', headers:['Przypadek','Ilość','Dostawa','Wzorzec','Odpowiedź'], rows});
  const record = (sample, name, status, detail = '', evidence) => report.tests.push({name:`${sample.id}: ${name}`, scenarioIds:[sample.id], status, detail, ...(evidence ? {evidence} : {})});
  const request = async (method, endpoint, body, statuses = [200]) => {
    const r = await api.request(method, endpoint, {body});
    const detail=r.data?.detail??r.data?.message??r.data?.['hydra:description']??r.data?.violations;
    assert(statuses.includes(r.status), `${method}: HTTP ${r.status}${detail?' — '+api.clean(typeof detail==='string'?detail:JSON.stringify(detail)):''}`);
    return r.data;
  };
  const selected = options.caseIds ?? packageCases.map(c => c.id);
  assert(selected.length && selected.every(id => packageCases.some(c => c.id === id)), 'Nieznany lub pusty wybór przypadków');
  try {
    await api.loginShop();
    for (const sample of packageCases.filter(c => selected.includes(c.id))) {
      options.signal?.throwIfAborted();
      options.onProgress?.(`${sample.id}: ${sample.name}`);
      if(sample.id==='T16'&&settings.palletApplicability?.supported===false){record(sample,sample.name,'NOT_APPLICABLE',settings.palletApplicability.source);continue;}
      let variants;
      try { variants = settings.extraCases?.[sample.id] ?? plans(settings, sample.id); }
      catch (e) { record(sample, sample.name, 'SKIP', e.message); continue; }
      if (!Array.isArray(variants) || !variants.length) { record(sample, sample.name, 'SKIP', 'Brak wariantów'); continue; }
      for (const [index, variant] of variants.entries()) {
        const start = api.requests.length, observations = [];
        const evidence = () => ({requests:api.requests.slice(start), measurements:observations.slice()});
        try {
          assert(variant.product?.productVariant && variant.steps?.length, 'Wariant wymaga produktu i kroków');
          for (const step of variant.steps) {
            assert(Number.isSafeInteger(step.quantity) && step.quantity > 0, 'Nieprawidłowa ilość');
            if(step.items)assert(step.items.length&&step.items.every(i=>i.productVariant&&Number.isSafeInteger(i.quantity)&&i.quantity>0),'Nieprawidłowe pozycje kroku');
            assert(step.shippingCode && step.paymentCode && step.expected, 'Brak metody lub wzorca');
            for (const key of ['shippingTotal', 'shippingTotalNet']) assert(Number.isSafeInteger(step.expected[key]) && step.expected[key] >= 0, `Brak wzorca ${key}`);
            if (!step.expected.noCalculator) assert(Number.isSafeInteger(step.expected.shipmentPackageQuantity), 'Brak wzorca liczby paczek');
          }
          const created = await request('POST', 'shop/orders', {localeCode:'pl_PL'}, [200,201]);
          assert(typeof created.tokenValue === 'string' && created.tokenValue, 'Brak tokenu koszyka');
          api.secrets.push(created.tokenValue, encodeURIComponent(created.tokenValue));
          const root = `shop/orders/${encodeURIComponent(created.tokenValue)}`;
          const wholesale = `wholesale/orders/${encodeURIComponent(created.tokenValue)}`;
          const checkout = `wholesale/checkout-step-two/${encodeURIComponent(created.tokenValue)}`;
          const products=variant.products??[variant.product];
          await request('POST', root + '/items/bulk', {items:products.map(p=>({productVariant:p.productVariant,quantity:1}))}, [200,201,204]);
          let before;
          for (const step of variant.steps) {
            const current = await request('GET', root);
            const desired=step.items??[{productVariant:variant.product.productVariant,quantity:step.quantity}];
            observations.push({stage:'input',cartId:created.id,items:desired,weightGrams:step.weightGrams,shippingCode:step.shippingCode});
            assert.equal(current.items?.length, desired.length, 'Nieprawidłowa liczba pozycji');
            for(const line of desired){
              const item=current.items.find(i=>i.product?.code===line.productVariant)??(desired.length===1?current.items[0]:undefined);
              assert(item,'Brak produktu '+line.productVariant);
              await request('PATCH', `${root}/items/${encodeURIComponent(item.id)}`, {quantity:line.quantity}, [200,204]);
            }
            const payments = await request('GET', wholesale + '/payments');
            assert(payments.some(p => p.code === step.paymentCode), 'Niedostępna płatność referencyjna');
            await request('PATCH', wholesale + '/payment-method', {paymentMethodCode:step.paymentCode}, [200,204]);
            const offers = (await request('GET', checkout)).shippingMethods;
            const methods = Array.isArray(offers) ? offers : offers?.['hydra:member'] ?? offers?.member;
            assert(methods?.some(m => m.code === step.shippingCode), 'Niedostępna dostawa referencyjna');
            const shippingAddress = {...config.scenario.shippingAddress, saveToAddressBook:false, isDefault:false};
            const billingAddress = {...config.scenario.billingAddress, saveToAddressBook:false, isDefault:false};
            await request('POST', checkout, {orderTokenValue:created.tokenValue, shippingMethodCode:step.shippingCode, shippingAddress, billingAddress}, [200,201,204]);
            before = await request('GET', root);
            observations.push({cartId:before.id,quantity:step.quantity,shippingCode:step.shippingCode,currentShippingCode:normalizeOrder(before).shippingCode,expected:step.expected,actual:shippingSnapshot(before)});
            rows.push([sample.id, step.quantity, step.shippingCode, JSON.stringify(step.expected), JSON.stringify(shippingSnapshot(before))]);
            assert.equal(before.items?.length,desired.length,'Nieprawidłowa liczba pozycji po zapisie');
            for(const line of desired){
              const item=before.items.find(i=>i.product?.code===line.productVariant)??(desired.length===1?before.items[0]:undefined);
              assert.equal(item?.quantity,line.quantity,'Nie zapisano ilości '+line.productVariant);
            }
            assert.equal(normalizeOrder(before).shippingCode, step.shippingCode, 'Nie zapisano dostawy');
            assert.equal(normalizeOrder(before).paymentCode, step.paymentCode, 'Nie zapisano płatności');
            assertShipping(before, step.expected);
            for (let i = 1; i < (variant.repeat ?? 1); i++) {
              const repeated = await request('GET', root);
              assertShipping(repeated, step.expected);
              assert.deepEqual(normalizeOrder(repeated), normalizeOrder(before), 'Ponowny GET zmienił zamówienie');
            }
          }
          record(sample, `${sample.name} / wariant ${index + 1} / podsumowanie`, 'PASS', '', evidence());
          if (variant.complete || variant.database || sample.id === 'T15') {
            if (!options.complete) { record(sample, 'Finalizacja i kontrole zapisu', 'SKIP', 'Uruchom z --complete'); continue; }
            assert(!before.number,'Koszyk ma już numer zamówienia; nie wysyłam complete');
            const final = await request('PATCH', root + '/complete', {}, [200,201,204]);
            const after = await request('GET', root);
            assert(after.number && after.state !== 'cart', 'GET nie potwierdził zapisu zamówienia');
            const {tokenValue,...saved}=normalizeOrder(after);
            (report.savedOrders??=[]).push({caseId:sample.id,...saved});
            const expected = variant.steps.at(-1).expected;
            assertShipping(after, expected);
            assert.deepEqual(shippingSnapshot(after), shippingSnapshot(before), 'Koszty lub paczki zmieniły się przy zatwierdzeniu');
            if (final && typeof final === 'object' && fields.some(k => Object.hasOwn(final, k))) {
              for (const key of fields) if (Object.hasOwn(final, key)) assert.deepEqual(final[key], before[key], `Odpowiedź complete: ${key}`);
            }
            observations.push({stage:'complete', id:after.id, actual:shippingSnapshot(after)});
            record(sample, 'Zatwierdzenie: niezmienność paczek i kosztów', 'PASS', '', evidence());
            if (variant.database || sample.id === 'T12' || sample.id === 'T15') {
              if (!options.verifyDatabase) record(sample, 'Baza / KWys', 'SKIP', 'Brak adaptera bazy');
              else {
                options.onProgress?.(sample.id+': porównanie zapisu Sylius i KWys w bazie');
                const result = await options.verifyDatabase(normalizeOrder(after), products);
                assert(result.checks?.length, 'Adapter bazy nie zwrócił kontroli');
                for (const check of result.checks) record(sample, check.name, check.status, check.detail);
                assert(!result.checks.some(c => c.status === 'FAIL'), 'Różnica API / baza');
              }
            }
            if (sample.id === 'T15') {
              if (!options.verifyDocuments) record(sample, 'Panel i PDF', 'SKIP', 'Brak adaptera porównania panelu i PDF');
              else {
                options.onProgress?.(sample.id+': porównanie panelu CMS i treści PDF');
                const result = await options.verifyDocuments(after,{api,final,expected,directory,sample});
                const checks=Array.isArray(result)?result:result.checks;
                assert(checks?.length, 'Adapter dokumentów nie zwrócił kontroli');
                for (const check of checks) record(sample, check.name, check.status, check.detail);
                if(result.documents)(report.documents??=[]).push(...result.documents);
              }
            }
          }
        } catch (e) {
          record(sample, `${sample.name} / wariant ${index + 1}`, 'FAIL', api.clean(e.message), evidence());
          options.signal?.throwIfAborted();
        }
      }
    }
  } catch (e) { report.tests.push({name:'Przebieg / logowanie', status:'FAIL', detail:api.clean(e.message)}); }
  report.status = report.tests.some(t => t.status === 'FAIL') ? 'FAIL' : report.tests.some(t => t.status === 'SKIP') ? 'INCOMPLETE' : report.tests.every(t=>t.status==='NOT_APPLICABLE')?'NOT_APPLICABLE':'PASS';
  const safe = api.clean(report);
  await saveFeatureReport(safe, directory);
  return {report:safe, directory};
}
