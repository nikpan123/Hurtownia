import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runPackageRegression, assertShipping} from '../api-tests/redmine-36618.mjs';
import {DebugSession} from '../dashboard/debugger/hub.mjs';

const config = {environment:'dev', enabled:true, baseUrl:'http://127.0.0.1:11111/api/v2', scenario:{shippingAddress:{company:'QA'}, billingAddress:{company:'QA'}}};
const credentials = {email:'private-email', password:'private-password', testsToken:'private-test-token'};
const settings = {
  packages:{shippingCode:'gls', paymentCode:'term', paymentSurchargeGrossMinor:0,
    product:{productVariant:'book', unitWeightGrams:1},
    calculator:{singlePackageWeight:10, priceIsNet:true, taxPercent:5, weightRanges:[{from:0, to:1000, priceMinor:1000}]}},
  nonCalculatorMethods:[{shippingCode:'pickup', paymentCode:'term', expected:{shippingTotal:210, shippingTotalNet:200}}],
  retest140g:{product:{productVariant:'book140', unitWeightGrams:140}, shippingCode:'pickup', paymentCode:'term',
    source:'Fixture: odbiór bez kalkulatora i płatność terminowa', expected:{shippingTotal:210, shippingTotalNet:200}},
  maxBoundaryWeightGrams:100
};

function mock(bug) {
  let serial = 0;
  const carts = new Map(), calls = [];
  const response = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), {status, headers:{'content-type':'application/json'}});
  const fetchImpl = async (url, args) => {
    const endpoint = new URL(url).pathname.replace('/api/v2/', '');
    const body = args.body ? JSON.parse(args.body) : undefined;
    calls.push({endpoint, method:args.method, body});
    if (endpoint === 'shop/authentication-token') return response({token:'private-jwt'});
    if (endpoint === 'shop/orders') {
      const token = `private-cart-${++serial}`;
      carts.set(token, {id:serial, quantity:1, shipping:null, payment:null, complete:false});
      return response({id:serial, tokenValue:token}, 201);
    }
    const cart = carts.get(endpoint.split('/')[2]);
    assert(cart, `Nieznany endpoint ${endpoint}`);
    if (endpoint.endsWith('/items/bulk')) {cart.product = body.items[0].productVariant;cart.lines=body.items.map((item,i)=>({...item,id:i+1})); return response({}, 201);}
    if (endpoint.includes('/items/')) {cart.quantity = body.quantity;cart.lines.find(i=>i.id===Number(endpoint.split('/').at(-1))).quantity=body.quantity; return response(null, 204);}
    if (endpoint.endsWith('/payments')) return response([{code:'term'}, {code:'cash'}]);
    if (endpoint.endsWith('/payment-method')) {cart.payment = body.paymentMethodCode; return response(null, 204);}
    if (endpoint.startsWith('wholesale/checkout-step-two/')) {
      if (args.method === 'GET') return response({shippingMethods:[{code:'gls'}, {code:'pickup'}]});
      cart.previousShipping = cart.shipping; cart.shipping = body.shippingMethodCode; return response(null, 204);
    }
    if (endpoint.endsWith('/complete')) {
      cart.complete = true;
      if (bug === 'timeout') throw new Error('timeout');
      if (bug === 'completeBody') return response({shipmentPackageQuantity:99});
      return response(null, 204);
    }
    const weight=cart.lines.reduce((sum,i)=>sum+i.quantity*(i.productVariant==='book140'?140:1),0);
    const packages = cart.shipping === 'gls' ? Math.ceil(weight / (cart.product==='book140'?8000:10)) : 0;
    const net = cart.shipping === 'gls' ? packages * 1000 : 200;
    const gross = net * 105 / 100;
    const order = {id:cart.id, state:cart.complete ? 'new' : 'cart', ...(cart.complete ? {number:'000' + cart.id} : {}),
      currencyCode:'PLN', items:cart.lines.map(i=>({id:i.id, product:{code:i.productVariant}, quantity:i.quantity, total:i.quantity*100, rebatePercent:cart.payment === 'cash' ? 10 : 0})),
      itemsTotal:cart.lines.reduce((s,i)=>s+i.quantity*100,0), total:cart.lines.reduce((s,i)=>s+i.quantity*100,0) + gross, shippingTotal:gross, shippingTotalNet:net,
      shipmentPackageQuantity:packages, payments:[{method:{code:cart.payment}}], shipments:[{method:{code:cart.shipping}}]};
    if (bug === 'package') order.shipmentPackageQuantity++;
    if (bug === 'net') order.shippingTotalNet++;
    if (bug === 'double') order.total += gross;
    if (bug === 'type') order.shipmentPackageQuantity = String(packages);
    if (bug === 'stale' && cart.shipping === 'pickup' && cart.previousShipping === 'gls') order.shipmentPackageQuantity = 2;
    if (bug === '0to3' && cart.complete && cart.shipping === 'pickup') order.shipmentPackageQuantity = 3;
    if (bug === 'finalCost' && cart.complete) order.shippingTotal++;
    if (bug === 'notSaved' && cart.complete) order.state = 'cart';
    if (bug === 'noState') delete order.state;
    return response(order);
  };
  return {calls, fetchImpl};
}

async function run({bug, caseIds, complete = false, more = {}} = {}) {
  const m = mock(bug);
  const result = await runPackageRegression(config, credentials, {settings, allowLocal:true,
    directory:await mkdtemp(path.join(os.tmpdir(), 'hurt-36618-')), ...m, complete, caseIds, ...more});
  return {...result, calls:m.calls};
}

test('T01–T12: koszyki, granice, przełączenia, finalizacja i podłączenie bazy', async () => {
  let databaseCalls = 0;
  const r = await run({caseIds:Array.from({length:12}, (_, i) => `T${String(i + 1).padStart(2, '0')}`), complete:true,
    more:{verifyDatabase:async order => {databaseCalls++; assert(order.number); return {checks:[{name:'KWys adapter', status:'PASS'}]};}}});
  assert.equal(r.report.status, 'PASS', JSON.stringify(r.report.tests.filter(t => t.status !== 'PASS')));
  assert.equal(databaseCalls, 3);
  for (const call of r.calls.filter(c => c.endpoint.startsWith('wholesale/checkout-step-two/') && c.method === 'POST')) {
    assert.equal(call.body.shippingAddress.saveToAddressBook, false);
    assert.equal(call.body.billingAddress.isDefault, false);
  }
  const saved = await readFile(path.join(r.directory, 'raport.json'), 'utf8');
  assert(!saved.includes('private-'));
  assert.match(await readFile(path.join(r.directory, 'raport.html'), 'utf8'), /T04/);
});

for (const [bug, caseId] of [['package','T01'], ['net','T01'], ['double','T11'], ['type','T01'], ['stale','T06'],
  ['0to3','T04'], ['finalCost','T03'], ['notSaved','T03'], ['completeBody','T03']]) {
  test(`${caseId} wykrywa błąd: ${bug}`, async () => {
    const r = await run({bug, caseIds:[caseId], complete:true});
    assert.equal(r.report.status, 'FAIL', JSON.stringify(r.report.tests));
    assert(r.report.tests.some(t => t.status === 'FAIL' && t.scenarioIds.includes(caseId)));
    if (['package','net','double','type','stale'].includes(bug)) assert(!r.calls.some(c => c.endpoint.endsWith('/complete')));
  });
}

test('Bez --complete finalizacja jest SKIP, a GET jest rzeczywiście sprawdzany', async () => {
  const r = await run({caseIds:['T03','T04','T10']});
  assert.equal(r.report.status, 'INCOMPLETE');
  assert.equal(r.report.tests.filter(t => t.status === 'SKIP').length, 3);
  assert(!r.calls.some(c => c.endpoint.endsWith('/complete')));
});

test('Timeout complete nie powoduje ponowienia zapisu', async () => {
  const r = await run({bug:'timeout', caseIds:['T03'], complete:true});
  assert.equal(r.report.status, 'FAIL');
  assert.equal(r.calls.filter(c => c.endpoint.endsWith('/complete')).length, 1);
});

test('Brak danych, nieosiągalne dokładne granice i brak adapterów nie dają PASS', async () => {
  const missing = structuredClone(settings); missing.packages.product.unitWeightGrams = 140;
  const r = await run({caseIds:['T09','T13','T14','T16'], more:{settings:missing}});
  assert.equal(r.report.status, 'INCOMPLETE');
  assert(r.report.tests.every(t => t.status === 'SKIP'));
  assert.equal((await run({caseIds:['T10'], complete:true})).report.status, 'INCOMPLETE');
});

test('Błąd KWys z adaptera bazy nie jest ukrywany przez poprawne API', async () => {
  const r = await run({caseIds:['T11'], complete:true, more:{verifyDatabase:async () => ({checks:[{name:'Jedna pozycja KWys', status:'FAIL', detail:'2 zamiast 1'}]})}});
  assert.equal(r.report.status, 'FAIL');
  assert(r.report.tests.some(t => t.name.includes('KWys') && t.status === 'FAIL'));
});

test('T13–T16: niezależne warianty i dokumenty mają osobne wyniki', async () => {
  const fixture = {product:{productVariant:'book'}, steps:[{quantity:11, shippingCode:'gls', paymentCode:'cash',
    expected:{shipmentPackageQuantity:2, shippingTotal:2100, shippingTotalNet:2000}}], complete:true};
  const custom = {...settings, extraCases:Object.fromEntries(['T13','T14','T15','T16'].map(id => [id,[fixture]]))};
  const r = await run({caseIds:['T13','T14','T15','T16'], complete:true, more:{settings:custom,
    verifyDatabase:async () => ({checks:[{name:'KWys', status:'PASS'}]}),
    verifyDocuments:async () => [{name:'PDF: paczki', status:'FAIL', detail:'3 zamiast 2'}]}});
  assert.equal(r.report.status, 'FAIL');
  assert(r.report.tests.some(t => t.scenarioIds.includes('T15') && t.name.includes('PDF') && t.status === 'FAIL'));
});

test('Brak kalkulatora: akceptacja 0/null/braku i ścisły wariant kontraktu', () => {
  const base = {items:[], itemsTotal:0, total:210, shippingTotal:210, shippingTotalNet:200};
  for (const value of [0, null, undefined]) assertShipping({...base, shipmentPackageQuantity:value}, {noCalculator:true});
  for (const value of [3, -1, '0', false]) assert.throws(() => assertShipping({...base, shipmentPackageQuantity:value}, {noCalculator:true}));
  assert.throws(() => assertShipping(base, {noCalculator:true, representation:'zero'}));
  assertShipping(base, {noCalculator:true, representation:'omitted'});
  const discounted={items:[{total:49}],itemsTotal:49,total:3124,shippingTotal:3075,shippingTotalNet:2929,shipmentPackageQuantity:1,orderPromotionTotal:-51};
  assertShipping(discounted, {shipmentPackageQuantity:1});
  assert.throws(()=>assertShipping({...discounted,total:3073}, {shipmentPackageQuantity:1}),'Nie odejmuj rabatu drugi raz');
});

test('T13 i T14 sprawdzają rzeczywiste przełączenie płatności oraz oczekiwany rabat', async () => {
  const expected = {shipmentPackageQuantity:2, shippingTotal:2100, shippingTotalNet:2000};
  const variants = {...settings,
    paymentVariants:[{paymentCode:'term', surchargeGrossMinor:0}, {paymentCode:'cash', surchargeGrossMinor:0}],
    discountVariants:[{source:'Potwierdzony rabat QA 10%', product:{productVariant:'book'}, steps:[
      {quantity:11, shippingCode:'gls', paymentCode:'term', expected:{...expected, rebatePercent:0}},
      {quantity:11, shippingCode:'gls', paymentCode:'cash', expected:{...expected, rebatePercent:10}}
    ]}]};
  const r = await run({caseIds:['T13','T14'], more:{settings:variants}});
  assert.equal(r.report.status, 'PASS', JSON.stringify(r.report.tests));
  variants.discountVariants[0].steps[1].expected.rebatePercent = 23;
  const wrong = await run({caseIds:['T14'], more:{settings:variants}});
  assert.equal(wrong.report.status, 'FAIL');
});

test('T15 bez adaptera dokumentów nie zalicza PDF na podstawie API', async () => {
  const r = await run({caseIds:['T15'], complete:true, more:{verifyDatabase:async () => ({checks:[{name:'KWys', status:'PASS'}]})}});
  assert.equal(r.report.status, 'INCOMPLETE');
  assert(r.report.tests.some(t => t.name.includes('Panel i PDF') && t.status === 'SKIP'));
});

test('T02/T08 i dokładne granice T09 używają 140 g oraz reszty 1 g bez tysięcy sztuk',async()=>{
  const mixed=structuredClone(settings);
  mixed.packages.product={productVariant:'book140',unitWeightGrams:140};
  mixed.packages.boundaryProduct={productVariant:'book',unitWeightGrams:1};
  mixed.packages.calculator.singlePackageWeight=8000;
  mixed.packages.calculator.weightRanges=[{from:0,to:50000,priceMinor:1000}];
  mixed.maxBoundaryWeightGrams=20000;
  const r=await run({caseIds:['T02','T08','T09'],more:{settings:mixed}});
  assert.equal(r.report.status,'PASS',JSON.stringify(r.report.tests.filter(t=>t.status!=='PASS')));
  assert(r.calls.filter(c=>c.method==='PATCH'&&c.endpoint.includes('/items/')).every(c=>c.body.quantity<=140));
  const weights=r.report.tests.filter(t=>t.scenarioIds.includes('T09')).flatMap(t=>t.evidence.measurements.filter(m=>m.stage==='input').map(m=>m.weightGrams));
  assert.deepEqual(weights,[7999,8000,8001,15999,16000,16001]);
});

test('#36618 w debuggerze: logowanie automatyczne, pauza przed koszykiem i bez sekretów',async()=>{
  const session=new DebugSession({id:'packages-api',title:'T01',mode:'api',environment:'offline'});
  const m=mock();
  const work=runPackageRegression(config,credentials,{...m,settings,caseIds:['T01'],allowLocal:true,
    directory:await mkdtemp(path.join(os.tmpdir(),'package-debug-')),debuggerSession:session});
  try{
    const deadline=Date.now()+8000;
    while(!session.snapshot().steps.some(s=>s.ready)){assert(Date.now()<deadline,'Brak pauzy');await new Promise(r=>setTimeout(r,10));}
    assert.equal(m.calls.length,1);assert.equal(m.calls[0].endpoint,'shop/authentication-token');
    const step=session.snapshot().steps.find(s=>s.ready);assert.equal(step.planned.method,'POST');assert.equal(step.planned.path,'shop/orders');
    session.next(step.id);
    while(!session.snapshot().steps.some(s=>s.ready)){assert(Date.now()<deadline);await new Promise(r=>setTimeout(r,10));}
    assert.equal(m.calls.length,2);assert.match(session.snapshot().steps.find(s=>s.ready).planned.path,/items\/bulk$/);
    session.setContinuous(true);assert.equal((await work).report.status,'PASS');
    assert(!JSON.stringify(session.public()).includes('private-'));
  }finally{session.close();await work;}
});

test('Zapis potwierdza nowy numer; brak opcjonalnego state nie jest błędem',async()=>{
 const r=await run({bug:'noState',caseIds:['T03'],complete:true});assert.equal(r.report.status,'PASS');assert.equal(r.report.savedOrders.length,1);assert(!Object.hasOwn(r.report.savedOrders[0],'tokenValue'));
});

test('Palety bez konfiguracji mają Nie dotyczy ze źródłem, zamiast fałszywego PASS lub SKIP',async()=>{
 const r=await run({caseIds:['T16'],more:{settings:{...settings,palletApplicability:{supported:false,source:'Odczyt CMS: tylko flat_rate i weight_range_shipping, brak pól palet'}}}});
 assert.equal(r.report.status,'NOT_APPLICABLE');assert.equal(r.report.tests[0].status,'NOT_APPLICABLE');assert(r.report.tests[0].detail.includes('CMS'));
 const html=await readFile(path.join(r.directory,'raport.html'),'utf8');assert(html.includes('Nie dotyczy: 1'));assert(html.includes('NIE DOTYCZY'));
});
