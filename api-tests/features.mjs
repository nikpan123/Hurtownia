import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ApiClient} from './http.mjs';
import {saveFeatureReport} from './feature-report.mjs';

const money=n=>Number.isSafeInteger(n)?(n/100).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'brak';
async function context(config,credentials,options,scenario,kind){
  const api=new ApiClient(config,credentials,options);
  const report={scenario,kind,generatedAt:new Date().toISOString(),baseUrl:config.baseUrl,status:'RUNNING',scopeNote:'Test API na dev. Nie zatwierdza zamówień.',tests:[],requests:api.requests,tables:[]};
  const directory=options.directory??path.resolve(config.outputDirectory??'raporty-api',kind+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8));
  const skip=(name,detail)=>report.tests.push({name,status:'SKIP',detail});
  const test=async(name,fn)=>{
    options.signal?.throwIfAborted();options.onProgress?.(name);
    try{const detail=await fn();report.tests.push({name,status:'PASS',detail:typeof detail==='string'?detail:''});return true;}
    catch(e){report.tests.push({name,status:'FAIL',detail:api.clean(e.message)});options.signal?.throwIfAborted();return false;}
  };
  const request=async(method,endpoint,args={},statuses=[200])=>{
    const r=await api.request(method,endpoint,args);
    if(kind==='product-create')report.lastResponse={status:r.status,body:Object.fromEntries(Object.entries(r.data??{}).filter(([k])=>['id','code','translations','channelPricings','title','detail','message','hydra:title','hydra:description','violations'].includes(k)))};
    assert(statuses.includes(r.status),`HTTP ${r.status}; ${r.data?.detail??r.data?.message??r.data?.['hydra:description']??''}`);
    return r.data;
  };
  const cart=async(channel,productVariant,quantity=1)=>{
    const created=await request('POST','shop/orders',{channel,body:{localeCode:'pl_PL'}},[200,201]);
    assert(typeof created.tokenValue==='string'&&created.tokenValue.length>0,'Brak tokenu nowego koszyka');api.secrets.push(created.tokenValue);
    const endpoint='shop/orders/'+encodeURIComponent(created.tokenValue);
    await request('POST',endpoint+'/items/bulk',{channel,body:{items:[{productVariant,quantity}]}},[200,201,204]);
    return {endpoint,token:created.tokenValue,id:created.id};
  };
  const finish=async()=>{
    report.status=report.tests.some(t=>t.status==='FAIL')?'FAIL':report.tests.some(t=>t.status==='SKIP')?'INCOMPLETE':'PASS';
    const safe=api.clean(report);await saveFeatureReport(safe,directory);return {report:safe,directory};
  };
  return {api,report,test,skip,request,cart,finish};
}

export function minorUnits(value){
  assert(typeof value==='string'&&/^\d{1,7}([,.]\d{1,2})?$/.test(value.trim()),'Kwota musi mieć format np. 18,40.');
  const [whole,fraction='']=value.trim().replace(',','.').split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function productPayload(input){
  assert(input&&typeof input==='object','Brak danych produktu');
  for(const key of ['code','variantCode'])assert(typeof input[key]==='string'&&/^qa-[A-Za-z0-9_-]{1,90}$/.test(input[key]),key+': użyj unikalnego kodu zaczynającego się od qa-');
  assert(typeof input.name==='string'&&input.name.trim().length>=2&&input.name.length<=255,'Nazwa: 2–255 znaków');
  assert(typeof input.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)&&input.slug.length<=255,'Slug: małe litery, cyfry i myślniki, do 255 znaków');
  assert(['WHOLESALE','RETAIL','ACADEMY'].includes(input.channel),'Nieprawidłowy kanał cennika');
  const price=minorUnits(input.price),originalPrice=minorUnits(input.originalPrice),minimumPrice=minorUnits(input.minimumPrice);
  assert(minimumPrice<=price,'Minimum price nie może przekraczać ceny');
  return {
    product:{code:input.code,translations:{pl_PL:{name:input.name.trim(),slug:input.slug,locale:'pl_PL'}}},
    variant:{code:input.variantCode,product:'/api/v2/admin/products/'+encodeURIComponent(input.code),channelPricings:{[input.channel]:{channelCode:input.channel,price,originalPrice,minimumPrice}}}
  };
}
export async function runProductCreation(config,credentials,options={}){
  const payload=productPayload(options.input);
  const c=await context(config,credentials,options,'Tworzenie produktu przez API','product-create');const {report,test,request,finish}=c;
  report.scopeNote='Wyłącznie utworzenie nowego rekordu produktu i wariantu z cennikiem. Bez testów katalogu i zamówień. Ten kontrakt POST nie udostępnia opisów kanałowych, typu, aktywacji i przypisania kanałów produktu; cennik nie potwierdza dostępności w sklepie.';
  report.reference=payload;report.creation={code:payload.product.code,state:'not_started'};
  try{
    if(await test('Logowanie administratora',async()=>{assert(options.adminEmail&&options.adminPassword,'Uzupełnij SYLIUS_ADMIN_EMAIL i SYLIUS_ADMIN_PASSWORD');await c.api.loginAdmin(options.adminEmail,options.adminPassword);})){ 
      const ok=await test('Utworzenie produktu: POST admin/products',async()=>{
        const r=await request('POST','admin/products',{token:'admin',body:payload.product},[201]);
        assert.equal(r.code,payload.product.code,'Serwer zwrócił inny kod produktu');report.creation.state='product_created';report.creation.id=r.id;
      });
      if(ok)await test('Utworzenie wariantu i cen: POST admin/product-variants',async()=>{
        const r=await request('POST','admin/product-variants',{token:'admin',body:payload.variant},[201]);
        assert.equal(r.code,payload.variant.code,'Serwer zwrócił inny kod wariantu');
        for(const [key,value]of Object.entries(payload.variant.channelPricings[options.input.channel]))assert.deepEqual(r.channelPricings?.[options.input.channel]?.[key],value,'Zapisany cennik: '+key);
        report.creation.state='variant_created';
      });
      else report.creation.state='creation_rejected';
    }
  }catch(e){report.error=c.api.clean(e.message);if(!report.tests.some(t=>t.status==='FAIL'))report.tests.push({name:'Przebieg',status:'FAIL',detail:report.error});}
  return finish();
}

export async function runRounding(config,credentials,options={}){
  const settings=options.settings??JSON.parse(await readFile('config/regressions.local.json','utf8')).pricing;
  const c=await context(config,credentials,options,'Ceny netto / brutto — wzorzec starej hurtowni','rounding');const {api,report,test,skip,request,cart,finish}=c;
  report.reference=settings;const rows=[];report.tables.push({title:'Pomiary — kwoty dotyczą produktów bez dostawy',headers:['Ilość','Netto / szt. po rabacie API','Netto razem API','Brutto razem API','Wzorzec potwierdzony','Różnica (grosze)'],rows});
  try{
    await api.loginShop();let order,session;
    if(!await test('Produkt referencyjny: cena 18,40 zł brutto i VAT 5%',async()=>{
      session=await cart('WHOLESALE',settings.productVariant);order=await request('GET',session.endpoint);
      assert.equal(order.items.length,1);const item=order.items[0];assert.equal(item.unitPrice,settings.baseGrossMinor);assert.equal(item.originalUnitPrice,settings.baseGrossMinor);assert.equal(item.unitPriceNet,settings.baseNetMinor);
    }))return await finish();
    const payments=await request('GET','wholesale/orders/'+encodeURIComponent(session.token)+'/payments');
    assert(Array.isArray(payments));report.paymentOffers=payments;
    const payment=payments.find(p=>p.rebatePercent===settings.rebatePercent&&(!settings.paymentCode||p.code===settings.paymentCode));
    if(!payment){
      report.blockedReason='Brak dostępnej płatności z rabatem '+settings.rebatePercent+'%. Nie wybieramy metody spoza listy API ani nie zmieniamy ustawień hurtownika.';
      skip('Warunek: dostępny rabat 23%',report.blockedReason+' Dostępne: '+payments.map(p=>p.code+' '+p.rebatePercent+'%').join(', '));
      for(const quantity of settings.quantities)skip('Ilość '+quantity+': porównanie wyceny','Nie można uruchomić bez właściwego rabatu.');
      return await finish();
    }
    report.selectedPayment=payment.code;
    await request('PATCH','wholesale/orders/'+encodeURIComponent(session.token)+'/payment-method',{body:{paymentMethodCode:payment.code}});
    const itemId=order.items[0].id;
    for(const quantity of settings.quantities){
      await test('Ilość '+quantity+': wycena i wzorzec starej hurtowni',async()=>{
        await request('PATCH',session.endpoint+'/items/'+encodeURIComponent(itemId),{body:{quantity}},[200,204]);
        const o=await request('GET',session.endpoint);assert.equal(o.items.length,1);const i=o.items[0];
        assert.equal(i.quantity,quantity);assert.equal(i.rebatePercent,settings.rebatePercent);assert.equal(i.unitPrice,settings.baseGrossMinor,'Cena bazowa zmieniła się podczas testu');
        const expected=settings.anchors[String(quantity)];
        rows.push([quantity,money(i.discountedUnitPriceNet),money(i.totalNetSalesAfterDiscount),money(i.total),expected?Object.entries(expected).map(([k,v])=>k+': '+money(v)).join('; '):'obserwacja — brak niezależnego wzorca',expected?Object.entries(expected).map(([k,v])=>`${k}: ${i[k]-v}`).join('; '):'—']);
        assert.equal(o.itemsTotal,o.items.reduce((sum,p)=>sum+p.total,0),'Suma produktów');
        assert.equal(o.total,o.itemsTotal+o.shippingTotal,'Do zapłaty = produkty + dostawa');
        for(const [field,value]of Object.entries(expected??{}))assert.equal(i[field],value,'Wzorzec starej hurtowni: '+field);
      });
    }
  }catch(e){report.error=api.clean(e.message);report.tests.push({name:'Przebieg / logowanie',status:'FAIL',detail:report.error});}
  return finish();
}

export async function runDescriptions(config,credentials,options={}){
  const fixtures=options.fixtures??JSON.parse(await readFile('config/catalog-fixtures.local.json','utf8')).products.filter(p=>p.main);
  const c=await context(config,credentials,options,'Opisy produktów zależne od kanału — API','descriptions');const {api,report,test,skip,request,cart,finish}=c;
  report.reference=fixtures;report.scopeNote='Sprawdza listę, szczegóły produktu i nazwę w koszyku w API. Tworzy koszyki testowe, bez complete. Nie potwierdza walidacji CMS, e-maili, PDF ani integracji Empik.';
  const rows=[];report.tables.push({title:'Dane zwrócone przez API',headers:['Produkt','Kanał','Nazwa','Slug','Krótki opis','Nazwa w koszyku'],rows});
  const compare=(actual,expected)=>{for(const [field,value]of Object.entries(expected))if(field==='descriptionContains')assert(actual.description?.includes(value),'Opis nie zawiera niezależnej treści z CMS');else if(['name','slug','description','shortDescription'].includes(field))assert.deepEqual(actual[field],value,field);};
  try{
    await api.loginShop();assert(fixtures.length>=2,'Brak fixture fallback i osobnego opisu WHOLESALE');
    for(const f of fixtures)for(const channel of ['WHOLESALE','RETAIL','ACADEMY']){
      const expected=f.channels[channel];if(!expected?.visible){skip(`${f.code} / ${channel}`,'Brak produktu QA aktywnego dla tego kanału.');continue;}
      let detail;
      const ok=await test(`${f.code} / ${channel}: nazwa, slug, opis, krótki opis`,async()=>{
        detail=await request('GET','shop/products-dto-by-slug/'+encodeURIComponent(expected.slug),{channel});assert.equal(detail.code,f.code);compare(detail,expected);
        if(channel!=='WHOLESALE')compare(detail,f.main);
      });
      await test(`${f.code} / ${channel}: lista zwraca właściwą nazwę i slug`,async()=>{
        const list=await request('GET','shop/products-dto',{channel,query:{name:expected.name,limit:50,order_by:'name'}});
        assert(Array.isArray(list.data));const row=list.data.find(p=>p.code===f.code);assert(row,'Brak produktu referencyjnego w wyszukiwaniu');assert.equal(row.name,expected.name);assert.equal(row.slug,expected.slug);
      });
      if(ok)await test(`${f.code} / ${channel}: nazwa zapisana w koszyku`,async()=>{
        const s=await cart(channel,f.productVariant??f.code);const order=await request('GET',s.endpoint,{channel});
        assert.equal(order.items.length,1);const item=order.items[0];rows.push([f.code,channel,detail.name,detail.slug,detail.shortDescription,item.productName]);
        assert.equal(item.productName,expected.name,'productName w zamówieniu');if(f.variantName!==undefined)assert.equal(item.variantName,f.variantName,'variantName');
      });
      if(f.variantName===undefined)skip(`${f.code} / ${channel}: nazwa wariantu`,'Brak niezależnie ustawionej nazwy wariantu w fixture.');
    }
    skip('CMS: walidacja unikalności slugów i długości pól','Osobny test interfejsu CMS; ten zestaw wykonuje żądania API sklepu.');
    skip('CMS: ukrywanie zakładki dla SpecialOffer / szkoleń','Wymagane fixture specjalnych typów oraz test UI CMS.');
    skip('ACADEMY: closed-courses i paid-courses','Brak niezależnych fixture szkoleń z oczekiwanym tytułem i slugiem.');
    skip('PDF / e-maile / powiadomienia / OfferUpdater Empik','Wymagają osobnych integracji i scenariuszy. Nie uruchomiono wysyłek ani finalizacji.');
    skip('GenerateProductUrlByChannel i SpecialOffer','Wymagany dostęp do wygenerowanych URL i fixture oferty z dołączonymi produktami.');
  }catch(e){report.error=api.clean(e.message);report.tests.push({name:'Przebieg / logowanie',status:'FAIL',detail:report.error});}
  return finish();
}
