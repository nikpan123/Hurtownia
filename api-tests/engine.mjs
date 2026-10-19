import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { cookieHeader, validateConfig,redactText } from './config.mjs';
import { saveReport } from './report.mjs';
import { prepareProducts } from './products.mjs';
import { pickAvailableMethod } from './checkout.mjs';

export function normalizeOrder(o) {
  return {
    id:o.id, number:o.number, tokenValue:o.tokenValue, state:o.state, currencyCode:o.currencyCode,
    itemsTotal:o.itemsTotal, total:o.total, totalNet:o.totalNet, shippingTotal:o.shippingTotal, shippingTotalNet:o.shippingTotalNet, shippingTaxRate:o.shippingTaxRate,
    orderPromotionTotal:o.orderPromotionTotal, shipmentPackageQuantity:o.shipmentPackageQuantity,
    paymentCode:o.payments?.[0]?.method?.code ?? o.payments?.[0]?.method,
    shippingCode:o.shipments?.[0]?.method?.code ?? o.shipments?.[0]?.method,
    items:(Array.isArray(o.items) ? o.items : []).map(i=>({
      id:i.id, code:i.product?.code, isbn:i.product?.isbnNumber, productName:i.productName, variantName:i.variantName,
      quantity:i.quantity, unitPrice:i.unitPrice, originalUnitPrice:i.originalUnitPrice,
      discountedUnitPrice:i.discountedUnitPrice, unitPriceNet:i.unitPriceNet,
      discountedUnitPriceNet:i.discountedUnitPriceNet, rebatePercent:i.rebatePercent,
      total:i.total, totalNetSalesAfterDiscount:i.totalNetSalesAfterDiscount,
      lineDifference: Number.isFinite(i.total) && Number.isFinite(i.discountedUnitPrice) ? i.total-i.discountedUnitPrice*i.quantity : null
    }))
  };
}

export async function runScenario(config, credentials, {complete=false, allowLocal=false, allowTest=false, fetchImpl=fetch, directory,signal,onProgress=()=>{},choosePayment,chooseShipping,beforeComplete,afterComplete,interactiveMode='manual',verifyDatabase} = {}) {
  config=await prepareProducts(config);
  validateConfig(config, {allowLocal,allowTest});
  const s = config.scenario;
  let selectedPaymentCode=s.randomCheckout?.payment?undefined:s.paymentMethodCode;
  let selectedShippingCode=s.randomCheckout?.shipping?undefined:s.shippingMethodCode;
  const checkoutSeed=String(s.randomCheckout?.seed??s.productSelection?.seed??crypto.randomUUID());
  const dir = directory ?? path.resolve(config.outputDirectory ?? 'raporty-api', new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8));
  await mkdir(dir,{recursive:true});
  const report = {
    generatedAt:new Date().toISOString(), environment:config.environment, baseUrl:config.baseUrl, scenario:s.name,
    status:'RUNNING', account:s.account, finalization:'nie wykonano', products:s.products, productSelection:s.productSelection, expectedGroupRebates:s.expectations?.groupRebatePercent, snapshots:[], changes:[],
    checkoutSelection:{seed:checkoutSeed,algorithm:choosePayment||chooseShipping?'frontend-choice':'sha256-method-v1',paymentMode:choosePayment?interactiveMode:s.randomCheckout?.payment?'random':'fixed',shippingMode:chooseShipping?interactiveMode:s.randomCheckout?.shipping?'random':'fixed'},
    payments:[], shippingMethods:[], checks:[], observations:[], requests:[], documents:[], stages:[], completeRequested:complete, completionBlocked:false
  };
  let bearer, token;
  const secretValues = [credentials.email,credentials.password,credentials.testsToken,credentials.cookie,...(credentials.cookies??[]).map(c=>c.value)].filter(Boolean);
  const redact = input => {
    return redactText(input,[...secretValues,bearer,token]);
  };
  let activeStage;
  function finishStage(){if(!activeStage)return;const checks=report.checks.filter(c=>c.stage===activeStage.name);activeStage.status=checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='PASS')?'PASS':'SKIP';activeStage.finishedAt=new Date().toISOString();}
  function startStage(name){finishStage();activeStage={name,status:'RUNNING',startedAt:new Date().toISOString()};report.stages.push(activeStage);}
  function financial(name,condition,detail='',comparison){
    const c={name,stage:activeStage?.name,status:condition?'PASS':'FAIL',detail:condition?'':redact(detail),type:'financial',blocksFinalization:!condition,...(comparison?{comparison:{...comparison,delta:typeof comparison.actual==='number'&&typeof comparison.expected==='number'?comparison.actual-comparison.expected:undefined}}:{})};
    report.checks.push(c);if(!condition){if(report.finalization==='nie wykonano')report.completionBlocked=true;onProgress('NIEZGODNOŚĆ — '+name+': '+redact(detail)+'; kontynuuję diagnostykę.');}
  }
  function check(name, condition, detail='') {
    report.checks.push({name,stage:activeStage?.name,status:condition?'PASS':'FAIL',detail:condition?'':redact(detail),type:'critical'});
    if (!condition) throw Object.assign(new Error(name + (detail ? ': '+redact(detail) : '')),{checkRecorded:true});
  }
  const skip = (name, detail) => report.checks.push({name,stage:activeStage?.name,status:'SKIP',detail});
  const observe=(name,detail,comparison)=>report.observations.push({name,stage:activeStage?.name,detail:redact(detail),comparison,blocksFinalization:false});
  async function request(method, endpoint, body, {expected, binary=false, document=false} = {}) {
    signal?.throwIfAborted();
    const url = new URL(endpoint,config.baseUrl+'/');
    const apiOrigin = new URL(config.baseUrl).origin;
    if (document) {
      check('Zaufane źródło PDF', (url.protocol==='https:' || allowLocal && url.hostname==='127.0.0.1') && !url.username && !url.password &&
        (url.origin===apiOrigin || (config.pdfAllowedOrigins??[]).includes(url.origin)));
    } else if (url.origin !== apiOrigin) throw new Error('Niepoprawny host API.');
    const headers = {Accept:binary?'application/pdf':'application/json'};
    if (url.origin===apiOrigin) {
      headers['X-Api-Channel']='WHOLESALE'; headers['X-Tests-Token']=credentials.testsToken;
      if (bearer) headers.Authorization='Bearer '+bearer;
      const cookie = credentials.cookie || cookieHeader(credentials.cookies,url);
      if (cookie) headers.Cookie=cookie;
    }
    if (body !== undefined) headers['Content-Type']=method==='PATCH'?'application/merge-patch+json':'application/json';
    const start = performance.now();
    let response;
    const safeEndpoint = document ? `/documents/${binary?'pdf':'data'}` : endpoint.replace(token??'___','{order_token}');
    onProgress(method+' '+safeEndpoint);
    try {
      response = await fetchImpl(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.any([AbortSignal.timeout(config.timeoutMs??30000),...(signal?[signal]:[])])});
    } catch { report.requests.push({method,endpoint:safeEndpoint,status:'NETWORK_ERROR',durationMs:Math.round(performance.now()-start)}); throw new Error('Błąd połączenia lub timeout: '+safeEndpoint); }
    report.requests.push({method,endpoint:safeEndpoint,status:response.status,durationMs:Math.round(performance.now()-start)});
    check(`${method} ${safeEndpoint}: brak przekierowania do logowania`, response.status<300 || response.status>=400,'Przekierowanie — odśwież sesję GitLab przez npm run login:dev.');
    const statusAccepted=expected ? expected.includes(response.status) : response.ok;
    let errorDetail='';
    if (!statusAccepted && (response.headers.get('content-type')??'').toLowerCase().includes('json')) {
      try {
        const payload=await response.json();
        const details={};
        for (const key of ['title','detail','description','message','hydra:title','hydra:description'])
          if (typeof payload?.[key]==='string') details[key]=redact(payload[key]).slice(0,4000);
        if (Array.isArray(payload?.violations)) details.violations=payload.violations.slice(0,30).map(v=>({propertyPath:redact(v.propertyPath??''),message:redact(v.message??'')}));
        report.requests.at(-1).apiError=details;
        errorDetail=Object.keys(details).length?'; '+JSON.stringify(details):'; brak szczegółów walidacji w rozpoznanych polach odpowiedzi';
      } catch { errorDetail='; nie udało się odczytać błędu JSON'; }
    }
    check(`${method} ${safeEndpoint}: status`,statusAccepted,`HTTP ${response.status}${errorDetail}`);
    const type=response.headers.get('content-type')??'';
    check(`${safeEndpoint}: odpowiedź nie jest HTML`,!type.toLowerCase().includes('text/html'),'HTML może oznaczać wygasłą sesję GitLab.');
    if (binary) {
      check('Typ odpowiedzi PDF',type.toLowerCase().includes('application/pdf'));
      const bytes=Buffer.from(await response.arrayBuffer());
      check('Sygnatura pliku PDF',bytes.subarray(0,5).toString()==='%PDF-' && bytes.length>20);
      return bytes;
    }
    const text=await response.text();
    if (!text.trim()) return {status:response.status, data:null};
    try { return {status:response.status,data:JSON.parse(text)}; }
    catch { throw new Error('Oczekiwano JSON: '+safeEndpoint); }
  }
  const orderPath = () => `shop/orders/${encodeURIComponent(token)}`;
  const wholesalePath = () => `wholesale/orders/${encodeURIComponent(token)}`;
  const isbn = v => String(v??'').replace(/[\s-]/g,'');
  function matched(p, order) {
    const found=order.items.filter(i=>p.productVariant ? i.product?.code===p.productVariant : isbn(i.product?.isbnNumber)===isbn(p.isbn));
    check('Jednoznaczne dopasowanie produktu '+(p.productVariant??p.isbn),found.length===1);
    return found[0];
  }
  function verifyPlan(order, edited) {
    const expected=new Map();
    for (const p of s.products) {
      const i=matched(p,order);
      const prev=expected.get(i.id)??{quantity:0,edits:new Set()};
      prev.quantity+=p.quantity;
      if (edited && p.newQuantity!==undefined) prev.edits.add(p.newQuantity);
      expected.set(i.id,prev);
    }
    check('Liczba różnych produktów',order.items.length===expected.size);
    for (const i of order.items) {
      const e=expected.get(i.id);
      check('Brak sprzecznych edycji kodu i ISBN', e.edits.size<=1);
      check('Ilość pozycji '+(i.product?.code??i.id),i.quantity===(e.edits.size?[...e.edits][0]:e.quantity));
    }
  }
  function assertExpectations(order, expected, stage) {
    if(expected===undefined){skip(stage+': oczekiwane ceny i rabaty','Ten etap nie przekazuje osobnego wzorca konkretnych cen i rabatów. Nie wymaga to uzupełnienia .env. Pozostałe kontrole tego etapu są wykazane oddzielnie; wzorce afterPayment i beforeComplete dotyczą późniejszych etapów.');return;}
    if (!expected || !Object.keys(expected).length) { skip(stage+': oczekiwane ceny i rabaty','Uzupełnij expectations — nie potwierdzono reguł biznesowych na podstawie samych sum.'); return; }
    for (const [key,value] of Object.entries(expected)) {
      if (key==='items') {
        for (const [code,fields] of Object.entries(value)) {
          const item=order.items.find(i=>i.product?.code===code);
          check(stage+': obecność '+code,!!item);
          for (const [field,want] of Object.entries(fields)) financial(`${stage}: ${code}.${field}`,isDeepStrictEqual(item[field],want),`oczekiwano ${JSON.stringify(want)}, otrzymano ${JSON.stringify(item[field])}`,{field,product:code,expected:want,actual:item[field],unit:typeof want==='number'&&/price|total/i.test(field)?'minor':'value'});
        }
      } else financial(stage+': '+key,isDeepStrictEqual(order[key],value),`oczekiwano ${JSON.stringify(value)}, otrzymano ${JSON.stringify(order[key])}`,{field:key,expected:value,actual:order[key],unit:typeof value==='number'&&/price|total/i.test(key)?'minor':'value'});
    }
  }
  async function snapshot(stage, {edited=false, expectations, selected=false, verifyGroupRebates=false}={}) {
    const {data:o}=await request('GET',orderPath());
    check(stage+': właściwy koszyk',o?.tokenValue===token);
    check(stage+': produkty w odpowiedzi',Array.isArray(o.items)&&o.items.length>0);
    const normalized=normalizeOrder(o);
    const prev=report.snapshots.at(-1)?.order;
    report.snapshots.push({stage,capturedAt:new Date().toISOString(),order:normalized});
    for (const i of normalized.items) {
      const old=prev?.items.find(p=>p.id===i.id);
      if (old && ['quantity','discountedUnitPrice','total','rebatePercent'].some(k=>old[k]!==i[k])) report.changes.push({stage,code:i.code??i.isbn,before:old,after:i});
      check(stage+': ilość i kwoty '+(i.code??i.id), Number.isSafeInteger(i.quantity)&&i.quantity>0 && ['unitPrice','discountedUnitPrice','total','unitPriceNet','discountedUnitPriceNet','totalNetSalesAfterDiscount'].every(k=>Number.isSafeInteger(i[k])&&i[k]>=0));
      check(stage+': rabat procentowy '+i.code, typeof i.rebatePercent==='number' && i.rebatePercent>=0 && i.rebatePercent<=100);
      if (verifyGroupRebates || selected) {
        const planned=s.products.find(p=>p.productVariant?p.productVariant===i.code:isbn(p.isbn)===isbn(i.isbn));
        const expectedPercent=s.expectations?.groupRebatePercent?.[planned?.group]??s.expectations?.paymentRebatePercentByCode?.[selectedPaymentCode];
        if (expectedPercent!=null) financial(`${stage}: rabat grupy ${planned.group} dla ${i.code}`,i.rebatePercent===expectedPercent,`oczekiwano ${expectedPercent}%, otrzymano ${i.rebatePercent}%`,{field:'rebatePercent',product:i.code,expected:expectedPercent,actual:i.rebatePercent,unit:'percent'});
      }
      const tolerance=s.expectations?.lineRoundingToleranceMinor;
      if (tolerance!=null) financial(stage+': zaokrąglenie pozycji '+i.code,Math.abs(i.lineDifference)<=tolerance,`różnica ${i.lineDifference} groszy, tolerancja ${tolerance}`,{product:i.code,field:'total',expected:i.discountedUnitPrice*i.quantity,actual:i.total,unit:'minor'});
      if(i.rebatePercent===0&&i.unitPrice===i.discountedUnitPrice&&i.unitPriceNet!==i.discountedUnitPriceNet)observe(stage+': różne jednostkowe pola netto przy rabacie 0% / '+i.code,`unitPriceNet: ${i.unitPriceNet}; discountedUnitPriceNet: ${i.discountedUnitPriceNet} groszy. Nie ustalono reguły, która wymaga równości tych zaokrąglonych pól. Sama ta różnica nie potwierdza błędnej kwoty zamówienia i nie blokuje zapisu.`,{product:i.code,field:'discountedUnitPriceNet',expected:i.unitPriceNet,actual:i.discountedUnitPriceNet,unit:'minor'});
    }
    verifyPlan(o,edited);
    check(stage+': sumy są kwotami w groszach',['itemsTotal','shippingTotal','total','totalNet'].every(k=>Number.isSafeInteger(o[k])&&o[k]>=0));
    financial(stage+': suma pozycji',o.itemsTotal===o.items.reduce((sum,i)=>sum+i.total,0),'Suma total pozycji musi odpowiadać itemsTotal.',{field:'itemsTotal',expected:o.items.reduce((sum,i)=>sum+i.total,0),actual:o.itemsTotal,unit:'minor'});
    // Historyczne odpowiedzi pokazują, że orderPromotionTotal jest już ujęte w itemsTotal.
    financial(stage+': do zapłaty = produkty + dostawa',o.total===o.itemsTotal+o.shippingTotal,'total musi odpowiadać itemsTotal + shippingTotal.',{field:'total',expected:o.itemsTotal+o.shippingTotal,actual:o.total,unit:'minor'});
    if (selected) {
      check(stage+': zapisana płatność',normalized.paymentCode===selectedPaymentCode);
      check(stage+': zapisana dostawa',normalized.shippingCode===selectedShippingCode);
    }
    assertExpectations(o,expectations,stage);
    return o;
  }
  try {
    startStage('Logowanie');
    const {data:auth}=await request('POST','shop/authentication-token',{email:credentials.email,apiPassword:credentials.password});
    bearer=typeof auth==='string'?auth:auth?.token??auth?.accessToken??auth?.bearerToken??auth?.jwt??auth?.data?.token??auth?.data?.accessToken;
    check('Uzyskano token API',typeof bearer==='string'&&!!bearer);
    startStage('Utworzenie koszyka i dodanie produktów');
    const {data:created}=await request('POST','shop/orders',{localeCode:'pl_PL'});
    token=created?.tokenValue;
    check('Utworzono nowy koszyk',typeof token==='string'&&!!token);
    report.orderId=created.id;
    await request('POST',orderPath()+'/items/bulk',{items:s.products.map(p=>({...(p.productVariant?{productVariant:p.productVariant}:{isbn:p.isbn}),quantity:p.quantity}))});
    let order=await snapshot('Po dodaniu produktów');
    startStage('Edycja ilości');
    const edits=new Map();
    for (const p of s.products.filter(p=>p.newQuantity!==undefined)) {
      const i=matched(p,order);
      check('Spójne ilości edycji produktu '+i.id,!edits.has(i.id)||edits.get(i.id)===p.newQuantity);
      edits.set(i.id,p.newQuantity);
    }
    for (const [id,quantity] of edits) await request('PATCH',orderPath()+'/items/'+encodeURIComponent(id),{quantity});
    order=await snapshot('Po edycji ilości',{edited:true});
    startStage('Płatność i rabaty');
    const {data:payments}=await request('GET',wholesalePath()+'/payments');
    check('Niepusta lista płatności',Array.isArray(payments)&&payments.length>0);
    report.payments=payments.map(p=>({code:p.code,name:p.name,rebatePercent:p.rebatePercent,orderItemTotal:p.orderItemTotal}));
    check('Unikalne kody płatności',payments.every(p=>typeof p.code==='string'&&p.code)&&new Set(payments.map(p=>p.code)).size===payments.length);
    check('Oferty płatności zawierają poprawne rabaty i kwoty',payments.every(p=>typeof p.rebatePercent==='number'&&p.rebatePercent>=0&&p.rebatePercent<=100&&Number.isSafeInteger(p.orderItemTotal)&&p.orderItemTotal>=0));
    const publicOrder=order=>{const result=normalizeOrder(order);delete result.tokenValue;return result;};
    if(choosePayment)selectedPaymentCode=await choosePayment({options:report.payments,order:publicOrder(order)});
    else if (s.randomCheckout?.payment) selectedPaymentCode=pickAvailableMethod(payments,checkoutSeed,'payment').code;
    report.selectedPayment=selectedPaymentCode;
    check('Wybrana płatność dostępna',payments.some(p=>p.code===selectedPaymentCode));
    if (s.expectations?.availablePaymentCodes) check('Lista płatności zgodna z ustawieniami konta',isDeepStrictEqual(payments.map(p=>p.code).sort(),[...s.expectations.availablePaymentCodes].sort()));
    else skip('Uprawnienia konta do płatności','Nie skonfigurowano oczekiwanej listy płatności.');
    const groups=[...new Set(s.products.map(p=>p.group))];
    const groupPaymentRebate=groups.length===1?s.expectations?.groupRebatePercent?.[groups[0]]:undefined;
    const expectedPaymentRebate=groupPaymentRebate??s.expectations?.allPaymentRebatePercent;
    if (!Object.keys(s.expectations?.paymentQuotes??{}).length && !Object.keys(s.expectations?.paymentRebatePercentByCode??{}).length && expectedPaymentRebate==null) skip('Rabaty ofert płatności / Adamada','Uzupełnij paymentQuotes, groupRebatePercent lub allPaymentRebatePercent dla potwierdzonych produktów i ustawień konta.');
    if (expectedPaymentRebate!=null) for (const p of payments) financial('Oczekiwany rabat dla każdej płatności: '+p.code,p.rebatePercent===expectedPaymentRebate,`oczekiwano ${expectedPaymentRebate}%, otrzymano ${p.rebatePercent}%`,{field:'rebatePercent',payment:p.code,expected:expectedPaymentRebate,actual:p.rebatePercent,unit:'percent'});
    if(expectedPaymentRebate==null&&s.expectations?.paymentRebatePercentByCode)for(const p of payments){const expected=s.expectations.paymentRebatePercentByCode[p.code];financial('Wzorzec rabatu konta: '+p.code,Number.isFinite(expected)&&p.rebatePercent===expected,`oczekiwano ${expected??'brak wzorca'}%, otrzymano ${p.rebatePercent}%`,{field:'rebatePercent',payment:p.code,expected:expected,actual:p.rebatePercent,unit:'percent'});}
    for (const [code,fields] of Object.entries(s.expectations?.paymentQuotes??{})) {
      const p=payments.find(p=>p.code===code);
      check('Oferta płatności istnieje: '+code,!!p);
      for (const [field,value] of Object.entries(fields)) financial(`Oferta ${code}: ${field}`,isDeepStrictEqual(p[field],value),`oczekiwano ${value}, otrzymano ${p[field]}`,{field,payment:code,expected:value,actual:p[field],unit:field==='orderItemTotal'?'minor':'value'});
    }
    await request('PATCH',wholesalePath()+'/payment-method',{paymentMethodCode:selectedPaymentCode});
    order=await snapshot('Po wyborze płatności',{edited:true,expectations:s.expectations?.afterPayment,verifyGroupRebates:true});
    check('Zapisano wybraną płatność',normalizeOrder(order).paymentCode===selectedPaymentCode);
    const quote=payments.find(p=>p.code===selectedPaymentCode);
    check('Wycena płatności zawiera kwotę produktów',Number.isSafeInteger(quote.orderItemTotal)&&quote.orderItemTotal>=0);
    const quoteBasis=s.expectations?.paymentQuoteTotalBasis;
    report.paymentQuoteTotalBasis=quoteBasis??'nieustalona';
    report.paymentQuoteComparisonEnforced=s.expectations?.enforcePaymentQuoteTotal===true;
    if (quoteBasis==='net' || quoteBasis==='gross') {
      const actual=quoteBasis==='net'?order.items.reduce((sum,i)=>sum+i.totalNetSalesAfterDiscount,0):order.itemsTotal;
      if(report.paymentQuoteComparisonEnforced){
      financial('Cena produktów '+(quoteBasis==='net'?'netto':'brutto')+' po wyborze płatności zgodna z jej ofertą',actual===quote.orderItemTotal,
        `Oferta: ${quote.orderItemTotal} groszy; produkty ${quoteBasis==='net'?'netto':'brutto'}: ${actual} groszy.`,{field:'orderItemTotal',payment:selectedPaymentCode,expected:quote.orderItemTotal,actual,unit:'minor',expectedSource:'GET /wholesale/orders/{token}/payments — orderItemTotal',actualSource:'GET /shop/orders/{token} — '+(quoteBasis==='net'?'suma totalNetSalesAfterDiscount':'itemsTotal')});
      }else{
        observe('Zestawienie oferty płatności i produktów '+(quoteBasis==='net'?'netto':'brutto'),`Oferta: ${quote.orderItemTotal} groszy; produkty: ${actual} groszy; różnica: ${actual-quote.orderItemTotal} groszy. Porównanie informacyjne — nie potwierdzono wspólnej reguły naliczania i zaokrąglania.`,{field:'orderItemTotal',payment:selectedPaymentCode,expected:quote.orderItemTotal,actual,unit:'minor'});
        skip('Ścisła zgodność oferty płatności z sumą produktów','Brak potwierdzonej reguły naliczania i zaokrąglania. Zapisano obserwację; enforcePaymentQuoteTotal=true włącza wymaganie ścisłej równości.');
      }
    } else skip('Porównanie ceny z ofertą płatności','Ustaw paymentQuoteTotalBasis: net lub gross zgodnie z kontraktem orderItemTotal.');
    for (const code of s.forbiddenPaymentCodes??[]) {
      check('Zabroniona płatność nie jest oferowana: '+code,!payments.some(p=>p.code===code));
      await request('PATCH',wholesalePath()+'/payment-method',{paymentMethodCode:code},{expected:[400,403,422]});
      const after=await snapshot('Po odrzuceniu płatności '+code,{edited:true});
      check('Odrzucenie nie zmienia płatności i kwot',isDeepStrictEqual(normalizeOrder(after),normalizeOrder(order)));
    }
    startStage('Dostawa i podsumowanie');
    const checkout=`wholesale/checkout-step-two/${encodeURIComponent(token)}`;
    const {data:stepTwo}=await request('GET',checkout);
    const rawShipping=stepTwo?.shippingMethods;
    const shipping=Array.isArray(rawShipping)?rawShipping:rawShipping?.['hydra:member']??rawShipping?.member;
    report.shippingResponseShape={topLevelKeys:stepTwo&&typeof stepTwo==='object'?Object.keys(stepTwo):[],shippingMethodsType:Array.isArray(rawShipping)?'array':typeof rawShipping,shippingMethodsKeys:rawShipping&&typeof rawShipping==='object'&&!Array.isArray(rawShipping)?Object.keys(rawShipping):[]};
    check('Niepusta lista dostaw',Array.isArray(shipping)&&shipping.length>0,Array.isArray(shipping)?'API zwróciło pustą listę dostaw.':'Nie rozpoznano listy dostaw. Struktura: '+JSON.stringify(report.shippingResponseShape));
    report.shippingMethods=shipping.map(p=>({code:p.code,name:p.name}));
    check('Poprawne, unikalne kody dostaw',shipping.every(p=>typeof p.code==='string'&&p.code)&&new Set(shipping.map(p=>p.code)).size===shipping.length);
    if(chooseShipping)selectedShippingCode=await chooseShipping({options:report.shippingMethods,order:publicOrder(order)});
    else if (s.randomCheckout?.shipping) selectedShippingCode=pickAvailableMethod(shipping,checkoutSeed,'shipping').code;
    report.selectedShipping=selectedShippingCode;
    check('Wybrana dostawa dostępna',shipping.some(p=>p.code===selectedShippingCode));
    if (s.expectations?.availableShippingCodes) check('Oczekiwana lista dostaw',isDeepStrictEqual(shipping.map(p=>p.code).sort(),[...s.expectations.availableShippingCodes].sort()));
    await request('POST',checkout,{orderTokenValue:token,shippingMethodCode:selectedShippingCode,shippingAddress:s.shippingAddress,billingAddress:s.billingAddress});
    order=await snapshot('Przed finalizacją',{edited:true,selected:true,expectations:s.expectations?.beforeComplete});
    if (s.expectations?.lineRoundingToleranceMinor==null) skip('Reguła zaokrągleń','Różnice pokazano w raporcie; brak potwierdzonej tolerancji biznesowej w groszach.');
    startStage('Finalizacja');
    if(complete&&report.checks.some(c=>c.status==='FAIL')){
      report.finalization='zablokowana — wykryto niezgodności przed zapisem';
      skip('Zapis zamówienia zablokowany','Nie wysłano PATCH complete. Wykryte różnice zachowano jako FAIL; dalsze etapy koszyka sprawdzono diagnostycznie.');
      report.finalizationBlockReasons=report.checks.filter(c=>c.status==='FAIL').map(c=>({name:c.name,stage:c.stage}));
      startStage('Dokumenty PDF');
      skip('Dokumenty PDF','Nie wykonano, ponieważ zapis zamówienia został zablokowany.');
      startStage('Porównanie baz');
      skip('Porównanie baz','Nie wykonano, ponieważ zapis zamówienia został zablokowany.');
    } else if (complete) {
      if(beforeComplete)await beforeComplete({order:publicOrder(order),shippingAddress:s.shippingAddress,billingAddress:s.billingAddress});
      signal?.throwIfAborted();
      report.finalization='rozpoczęta — wynik niepotwierdzony';
      // Nie ponawiamy complete: timeout może oznaczać zapisane zamówienie.
      const {data:final}=await request('PATCH',orderPath()+'/complete',{});
      report.finalization='serwer przyjął zatwierdzenie';
      const after=await snapshot('Po finalizacji',{edited:true,selected:true});
      if(typeof after.state==='string')check('Zamówienie opuściło stan koszyka',after.state!=='cart');
      else skip('Zamówienie opuściło stan koszyka','API przyjęło complete, ale GET zamówienia nie zwraca pola state. Zmiana stanu nie została osobno potwierdzona.');
      check('Kwoty nie zmieniły się przy finalizacji',after.total===order.total && after.totalNet===order.totalNet && after.itemsTotal===order.itemsTotal && after.shippingTotal===order.shippingTotal);
      for(const field of ['shippingTotalNet','shipmentPackageQuantity'])if(order[field]!==undefined)check(field+': bez zmiany przy finalizacji',after[field]===order[field],`przed ${order[field]}, po ${after[field]}`);
      report.finalization='potwierdzona przez API';
      if(afterComplete)await afterComplete({token,order:publicOrder(after)});
      startStage('Dokumenty PDF');
      const documents={...final,...after,pdfSummary:after.pdfSummary??final?.pdfSummary,paymentForm:after.paymentForm??final?.paymentForm,checkoutInformation:after.checkoutInformation??final?.checkoutInformation};
      for (const info of s.expectations?.checkoutInformationIncludes??[]) check('checkoutInformation zawiera '+info,Array.isArray(documents.checkoutInformation)?documents.checkoutInformation.includes(info):typeof documents.checkoutInformation==='object'&&documents.checkoutInformation!==null ? Object.hasOwn(documents.checkoutInformation,info):String(documents.checkoutInformation??'').includes(info));
      for (const kind of ['pdfSummary','paymentForm']) {
        const link=documents[kind];
        if (!link && kind==='paymentForm' && !s.expectations?.requirePaymentForm) { skip('paymentForm','Brak druczka; obowiązkowy po ustawieniu requirePaymentForm.'); continue; }
        check('Link '+kind,typeof link==='string'&&link.length>0);
        let bytes;
        for (let attempt=0;attempt<(config.pdfAttempts??3);attempt++) {
          const checkStart=report.checks.length;
          try { bytes=await request('GET',new URL(link,new URL('/',config.baseUrl)).href,undefined,{binary:true,document:true}); break; }
          catch (e) {
            if (attempt===(config.pdfAttempts??3)-1) throw e;
            // Zachowujemy ślad próby, ale wynik końcowy zależy od ostatniej próby.
            for (const c of report.checks.slice(checkStart)) if (c.status==='FAIL') {c.status='SKIP';c.detail+='; ponowienie pobrania PDF';}
            await new Promise(r=>setTimeout(r,config.pdfRetryMs??1500));
          }
        }
        const file=kind+'.pdf';
        await writeFile(path.join(dir,file),bytes);
        report.documents.push({kind,file,bytes:bytes.length});
      }
      report.finalization='potwierdzona przez API';
      startStage('Porównanie baz');
      if(verifyDatabase){onProgress('Porównanie zapisu z bazami Sylius i transfer');const result=await verifyDatabase(publicOrder(after),s.products);report.databaseComparison=result;report.checks.push(...result.checks);if(result.checks.some(c=>c.status==='FAIL'))throw new Error('Wykryto różnice API / baza — szczegóły w porównaniu bazy.');}
      else skip('Porównanie z bazą Sylius i transfer','Włącz porównanie z bazą w panelu lub HURT_VERIFY_DATABASE=true.');
      skip('E-mail, treść PDF i baza transferowa','Brak integracji ze skrzynką, ekstraktorem PDF i bazą transferową.');
    } else skip('Finalizacja i dokumenty PDF','Uruchom z --complete na dedykowanym koncie dev.');
    report.status=report.checks.some(c=>c.status==='FAIL')?'FAIL':'PASS';
    if(report.status==='FAIL')report.error=report.checks.filter(c=>c.status==='FAIL').map(c=>c.name+(c.detail?': '+c.detail:'')).join('\n');
  } catch (error) {
    report.status='FAIL'; report.error=redact(error.message);
    if (!error.checkRecorded) report.checks.push({name:'Przerwanie przebiegu',stage:activeStage?.name,status:'FAIL',type:'critical',detail:report.error});
    report.interrupted=true;
  } finally {
    finishStage();
    if(complete&&report.interrupted&&report.finalization==='nie wykonano'){report.completionBlocked=true;report.finalization='zablokowana — przebieg przerwany przed zapisem';}
    for(const name of ['Logowanie','Utworzenie koszyka i dodanie produktów','Edycja ilości','Płatność i rabaty','Dostawa i podsumowanie','Finalizacja','Dokumenty PDF','Porównanie baz'])if(!report.stages.some(s=>s.name===name))report.stages.push({name,status:'SKIP',reason:report.interrupted?'Nie osiągnięto etapu — przebieg przerwano.':!complete?'Nie uruchamiano finalizacji w tym wariancie.':'Etap zależny nie został uruchomiony.'});
    // Usuwamy token koszyka oraz ewentualne sekrety odbite w odpowiedzi API.
    for (const snapshot of report.snapshots) delete snapshot.order.tokenValue;
    const scrub = value => typeof value==='string' ? redact(value) : Array.isArray(value) ? value.map(scrub) : value && typeof value==='object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v)])) : value;
    const safe=scrub(report);
    await saveReport(safe,dir);
  }
  return {report,directory:dir};
}
