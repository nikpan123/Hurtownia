import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ApiClient} from './http.mjs';
import {saveCatalogReport} from './catalog-report.mjs';

export function validateProduct(product,{detail=false}={}) {
  assert(product&&typeof product==='object'&&!Array.isArray(product),'Produkt musi być obiektem');
  assert(Number.isSafeInteger(product.id),'id musi być liczbą całkowitą');
  for(const field of ['code','name','slug'])assert(typeof product[field]==='string'&&product[field].length>0,field+': brak tekstu');
  for(const field of ['price','originalPrice'])assert(Number.isSafeInteger(product[field])&&product[field]>=0,field+': oczekiwano nieujemnych groszy');
  for(const field of ['outOfStock','stockAvailable','availableForSale'])assert.equal(typeof product[field],'boolean',field+': oczekiwano boolean');
  for(const field of ['subjects','levels','publicationType'])assert(Array.isArray(product[field])&&product[field].every(x=>typeof x==='string'),field+': oczekiwano tablicy tekstów');
  for(const field of ['isbnNumber','author'])assert(product[field]===null||typeof product[field]==='string',field+': oczekiwano tekstu lub null');
  if(detail) {
    assert.equal(typeof product.description,'string');
    assert(product.shortDescription===null||typeof product.shortDescription==='string');
    assert.equal(typeof product.type,'string');
  }
}
export function validateList(body) {
  assert(body&&Array.isArray(body.data),'Brak tablicy data');
  assert(body.pagination&&typeof body.pagination==='object','Brak pagination');
  for(const k of ['current','last','perPage','totalItems'])assert(Number.isSafeInteger(body.pagination[k]),'pagination.'+k+': oczekiwano integer');
  assert(body.pagination.perPage>0);assert(body.pagination.totalItems>=0);
  assert(body.data.length<=body.pagination.perPage,'Przekroczono limit strony');
  assert.equal(new Set(body.data.map(p=>p.code)).size,body.data.length,'Duplikaty kodów na stronie');
  body.data.forEach(p=>validateProduct(p));return body;
}
const codes=rows=>rows.map(p=>p.code);
const sortedCodes=rows=>codes(rows).sort();
const groups=rows=>rows.map(p=>p.name).filter((n,i,a)=>i===0||n!==a[i-1]);

export async function runCatalog(config,credentials,{allowLocal=false,allowTest=false,fetchImpl=fetch,directory,fixtures,create=false,adminEmail,adminPassword,signal,onProgress=()=>{}}={}) {
  const api=new ApiClient(config,credentials,{allowLocal,allowTest,fetchImpl,signal});
  const dir=directory??path.resolve(config.outputDirectory??'raporty-api','katalog-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8));
  const report={generatedAt:new Date().toISOString(),baseUrl:config.baseUrl,status:'RUNNING',tests:[],requests:api.requests,documentationIssues:[
    'Swagger opisuje odpowiedź products-dto jako tablicę, natomiast rzeczywisty kontrakt ma obiekt {data,pagination}.',
    'Swagger wymienia parametr ścieżki code dla products-dto-by-slug/{slug}, mimo że ścieżka zawiera wyłącznie slug.'
  ]};
  async function test(name,fn) {
    signal?.throwIfAborted();
    onProgress(name);
    const start=performance.now();
    try {const detail=await fn();report.tests.push({name,status:'PASS',detail:typeof detail==='string'?detail:'',durationMs:Math.round(performance.now()-start)});return true;}
    catch(e){report.tests.push({name,status:'FAIL',detail:api.clean(e.message),durationMs:Math.round(performance.now()-start)});signal?.throwIfAborted();return false;}
  }
  const skip=(name,detail)=>report.tests.push({name,status:'SKIP',detail});
  const list=async(channel,query={})=>{
    const r=await api.request('GET','shop/products-dto',{channel,query});assert.equal(r.status,200,'Lista HTTP '+r.status);return validateList(r.data);
  };
  const all=async(channel,query={})=>{
    const limit=config.catalog?.pageSize??50;
    const first=await list(channel,{...query,page:1,limit});
    const last=first.pagination.last;
    assert(last<=(config.catalog?.maxPages??100),'Przekroczono limit stron audytu');
    assert(first.pagination.totalItems<=(config.catalog?.maxProducts??1000),'Przekroczono limit produktów audytu');
    const result=[...first.data];
    for(let page=2;page<=last;page++) {
      const b=await list(channel,{...query,page,limit});
      assert.equal(b.pagination.current,page,'API ignoruje numer strony');
      assert.equal(b.pagination.totalItems,first.pagination.totalItems,'Liczba produktów zmieniła się między stronami');
      result.push(...b.data);
    }
    assert.equal(new Set(codes(result)).size,result.length,'Powtórzone produkty pomiędzy stronami');
    assert.equal(result.length,first.pagination.totalItems,'Nie pobrano wszystkich produktów');return result;
  };
  async function detail(channel,slug) {
    const r=await api.request('GET','shop/products-dto-by-slug/'+encodeURIComponent(slug),{channel});
    assert.equal(r.status,200,'Szczegóły HTTP '+r.status);validateProduct(r.data,{detail:true});return r.data;
  }
  try {
    await api.loginShop();
    if(!fixtures) {
      try {fixtures=JSON.parse(await readFile(config.catalog?.fixtureFile??'config/catalog-fixtures.local.json','utf8'));}
      catch(e){if(e.code==='ENOENT')fixtures={products:[],filters:[]};else throw e;}
    }
    if(create) {
      report.creation={transport:'admin JSON API',state:'not_started'};
      if(!adminEmail||!adminPassword)await test('Tworzenie: dostęp do administratora',()=>{throw new Error('Uzupełnij SYLIUS_ADMIN_EMAIL i SYLIUS_ADMIN_PASSWORD w .env');});
      else if(await test('Tworzenie: logowanie API administratora',()=>api.loginAdmin(adminEmail,adminPassword))) {
        const code=(config.creation?.prefix??'qa-catalog')+'-'+Date.now()+'-'+crypto.randomUUID().slice(0,5);
        report.creation.code=code;
        const ok=await test('Tworzenie: POST admin/products',async()=>{
          const response=await api.request('POST','admin/products',{token:'admin',body:{code,translations:{pl_PL:{name:'QA katalog '+code,slug:code,locale:'pl_PL'}}}});
          report.creation.httpStatus=response.status;
          assert.equal(response.status,201,'Tworzenie produktu HTTP '+response.status+'; '+(response.data?.message??response.data?.detail??''));
          report.creation.state='product_created';report.creation.id=response.data.id;
        });
        if(ok) {
          await test('Tworzenie: POST admin/product-variants i cennik WHOLESALE',async()=>{
            const price=config.creation?.priceMinor??5000;
            const r=await api.request('POST','admin/product-variants',{token:'admin',body:{code,product:'/api/v2/admin/products/'+code,channelPricings:{WHOLESALE:{channelCode:'WHOLESALE',price,originalPrice:price,minimumPrice:0}}}});
            assert.equal(r.status,201,'Tworzenie wariantu HTTP '+r.status);report.creation.state='variant_created';
            assert.equal(r.data.channelPricings?.WHOLESALE?.price,price,'Zapisana cena wariantu');
          });
          await test('Tworzenie: nowy produkt jest widoczny w API sklepu',async()=>{
            let row;for(let n=0;n<(config.catalog?.pollAttempts??10);n++){
              const r=await api.request('GET','shop/products-dto-by-slug/'+encodeURIComponent(code));
              if(r.status===200){row=r.data;break;}
              if(r.status!==404)throw new Error('Oczekiwanie na produkt HTTP '+r.status);
              if(n+1<(config.catalog?.pollAttempts??10))await new Promise(resolve=>setTimeout(resolve,config.catalog?.pollDelayMs??1500));
            }
            assert(row,'Produkt zapisany w admin API nie pojawił się w WHOLESALE. Sprawdź typ produktu, kanał, taksonomię i indeks Elasticsearch.');
            validateProduct(row,{detail:true});assert.equal(row.code,code);report.creation.state='visible_in_shop';
          });
        } else report.creation.state='creation_rejected';
      }
    }
    report.fixtures=fixtures.products??[];
    for(const channel of config.catalog?.channels??['WHOLESALE']) {
      let baseline;
      const ready=await test(channel+': wszystkie strony, kontrakt i unikalność',async()=>{baseline=await all(channel);return baseline.length+' produktów';});
      if(!ready)continue;
      await test(channel+': domyślna paginacja 1 / 10',async()=>{
        const b=await list(channel);assert.equal(b.pagination.current,1);assert.equal(b.pagination.perPage,10);
      });
      for(const limit of [1,2,10,50])await test(`${channel}: limit=${limit}`,async()=>{
        const b=await list(channel,{limit});assert.equal(b.pagination.perPage,limit);assert.equal(b.data.length,Math.min(limit,b.pagination.totalItems));
      });
      await test(channel+': strona za końcem katalogu',async()=>{
        const r=await api.request('GET','shop/products-dto',{channel,query:{page:baseline.length+100,limit:1}});
        assert([200,404].includes(r.status),'Oczekiwano pustej strony lub 404, otrzymano '+r.status);if(r.status===200)assert.deepEqual(validateList(r.data).data,[]);
      });
      await test(channel+': domyślne sortowanie jak jawne taxon_position_wholesale_category asc',async()=>{
        assert.deepEqual(codes(baseline),codes(await all(channel,{order_by:'taxon_position_wholesale_category',sort:'asc'})));
      });
      await test(channel+': sortowanie name asc / desc',async()=>{
        const asc=await all(channel,{order_by:'name',sort:'asc'}),desc=await all(channel,{order_by:'name',sort:'desc'});
        assert.deepEqual(sortedCodes(asc),sortedCodes(baseline));assert.deepEqual(sortedCodes(desc),sortedCodes(baseline));
        assert.deepEqual(groups(asc),groups(desc).reverse(),'Nazwy w asc i desc nie są wzajemnie odwrócone (kolejność w ramach tej samej nazwy pomijamy)');
      });
      await test(channel+': sortowanie pozycji desc zachowuje komplet produktów',async()=>{
        assert.deepEqual(sortedCodes(await all(channel,{order_by:'taxon_position_wholesale_category',sort:'desc'})),sortedCodes(baseline));
      });
      await test(channel+': wyszukiwanie bez wyników',async()=>{assert.equal((await list(channel,{name:'zz'+crypto.randomUUID().replaceAll('-','')+'zz'})).pagination.totalItems,0);});
      const searchRows=baseline.slice(0,3);
      for(const [kind,field]of [['nazwa','name'],['ISBN','isbnNumber'],['autor','author']]) {
        const p=kind==='nazwa'?searchRows[0]:baseline.find(p=>typeof p[field]==='string'&&p[field].trim());
        if(!p){skip(channel+': wyszukiwanie '+kind,'Brak danych referencyjnych w katalogu');continue;}
        await test(channel+': wyszukiwanie '+kind,async()=>{
          const rows=await all(channel,{name:p[field]});assert(rows.some(r=>r.code===p.code),'Wyniki nie zawierają produktu referencyjnego '+p.code);
        });
      }
      await test(channel+': lista i szczegóły po slugu są zgodne',async()=>{
        for(const p of searchRows) {
          const d=await detail(channel,p.slug);
          for(const field of ['id','code','name','slug','price','originalPrice','isbnNumber','author','subjects','publicationType'])assert.deepEqual(d[field],p[field],`${p.code}: różnica ${field} pomiędzy listą i szczegółami`);
        }
      });
      await test(channel+': nieistniejący slug zwraca 404',async()=>{
        const r=await api.request('GET','shop/products-dto-by-slug/qa-brak-'+crypto.randomUUID(),{channel});assert.equal(r.status,404);
      });
      await test(channel+': slug z polskimi znakami i odstępami bez błędu serwera',async()=>{
        const r=await api.request('GET','shop/products-dto-by-slug/'+encodeURIComponent('qa żółć nie istnieje'),{channel});assert.equal(r.status,404);
      });
      for(const fixture of fixtures.products??[]) {
        const expected=fixture.channels?.[channel];
        if(!expected)continue;
        await test(`${channel}: fixture ${fixture.code} — ${fixture.purpose??'oczekiwane pola'}`,async()=>{
          if(expected.visible===false){assert(!baseline.some(p=>p.code===fixture.code),'Produkt nie powinien być na liście kanału');const r=await api.request('GET','shop/products-dto-by-slug/'+encodeURIComponent(expected.slug??fixture.slug),{channel});assert.equal(r.status,404);return;}
          const p=baseline.find(p=>p.code===fixture.code);assert(p,'Brak fixture na liście: '+fixture.code);
          const d=await detail(channel,expected.slug??fixture.slug);
          assert.equal(d.code,fixture.code);
          for(const [field,value]of Object.entries(expected))if(field==='descriptionContains')assert(d.description.includes(value),'Opis nie zawiera niezależnie przygotowanej treści WHOLESALE');else if(field!=='visible')assert.deepEqual(d[field],value,'Szczegóły: '+field);
          for(const field of ['name','slug','price','originalPrice'])if(expected[field]!==undefined)assert.deepEqual(p[field],expected[field],'Lista: '+field);
        });
      }
      for(const filter of fixtures.filters??[])if((filter.channel??'WHOLESALE')===channel)await test(`${channel}: filtr ${filter.name}`,async()=>{
        const rows=await all(channel,filter.query);assert.deepEqual(sortedCodes(rows),[...filter.expectedCodes].sort(),'Zbiór wyników niezgodny z niezależną fixture');
      });
      for(const key of ['publication_type[]','subjects[]','primary_school[]','high_school[]','taxons[]']) {
        if(!(fixtures.filters??[]).some(f=>(f.channel??'WHOLESALE')===channel&&Object.hasOwn(f.query,key)))skip(channel+': dodatni filtr '+key,'Brak niezależnej fixture z prawidłowymi wartościami i oczekiwanymi kodami.');
        await test(channel+': filtr bez dopasowania '+key,async()=>{const b=await list(channel,{[key]:'qa-brak-'+crypto.randomUUID()});assert.equal(b.pagination.totalItems,0,'Filtr ignorowany albo nieistniejąca wartość nie ogranicza wyników');});
      }
      for(const query of [{page:0},{page:-1},{limit:0},{limit:-1},{page:'abc'},{limit:'abc'},{order_by:'qa_invalid'},{sort:'qa_invalid'}])await test(channel+': niepoprawne parametry '+JSON.stringify(query),async()=>{
        const r=await api.request('GET','shop/products-dto',{channel,query});
        if(config.catalog?.strictInvalidParameters!==false)assert([400,404,422].includes(r.status),'Oczekiwano odrzucenia parametru (400/404/422), otrzymano '+r.status);
        else {assert([200,400,404,422].includes(r.status));if(r.status===200)validateList(r.data);return 'Obserwacja łagodnej walidacji: HTTP '+r.status;}
      });
    }
    for(const endpoint of ['shop/products-dto','shop/products-dto-by-slug/qa-invalid-channel']) {
      await test('Nieprawidłowy kanał: '+endpoint,async()=>{const r=await api.request('GET',endpoint,{channel:'QA_INVALID'});assert([400,403,404,422].includes(r.status),'Oczekiwano odrzucenia kanału, HTTP '+r.status);});
      await test('Brak wymaganego nagłówka kanału: '+endpoint,async()=>{const r=await api.request('GET',endpoint,{channel:null});assert([400,422].includes(r.status),'Swagger wymaga nagłówka; HTTP '+r.status);});
    }
    if(!(fixtures.products??[]).length)skip('Nazwy/slugi/opisy WHOLESALE oraz fallback','Brak niezależnych fixture z ustawieniami produktu w CMS.');
  } catch(e){report.error=api.clean(e.message);report.tests.push({name:'Przygotowanie / logowanie',status:'FAIL',detail:report.error});}
  report.status=report.tests.some(t=>t.status==='FAIL')?'FAIL':'PASS';
  const safe=api.clean(report);await saveCatalogReport(safe,dir);return {report:safe,directory:dir};
}
