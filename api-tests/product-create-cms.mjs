import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {descriptionContext,productPayload,minorUnits} from './features.mjs';
import {connectDescriptionWeb} from './description-web.mjs';

export function cmsProductPreview(input){
 const validated=productPayload(input);
 if(input.channel==='WHOLESALE'){
  const prices=validated.variant.channelPricings.WHOLESALE;
  assert.equal(prices.price,prices.originalPrice,'WHOLESALE: cena i oryginalna cena muszą być jednakowe.');
  assert.equal(prices.minimumPrice,0,'WHOLESALE: minimum price musi wynosić 0 zł.');
 }
 return {method:'POST',endpoint:'https://cms-ksiegarnia.gwodev.pl/products/new/simple/BOOK',contentType:'application/x-www-form-urlencoded',type:'BOOK',code:input.code,merchandiseCode:input.variantCode,name:validated.product.translations.pl_PL.name,slug:input.slug,channel:input.channel,prices:validated.variant.channelPricings[input.channel],enabled:false,visible:false,listed:false,note:'Ceny w podglądzie są w groszach; formularz CMS wysyła kwoty w złotych. Aktualne pola formularza, wymagane atrybuty książki i CSRF są pobierane z CMS dopiero podczas testu. Nie jest to body JSON API.'};
}
export async function runCmsProductCreation(config,credentials,options={}){
 const preview=cmsProductPreview(options.input),input={...options.input,name:preview.name};
 const c=await descriptionContext(config,credentials,options,'Tworzenie książki przez formularz CMS','product-create');
 const {report,test}=c;let adapter,product;
 report.scopeNote='Jeden POST formularza /products/new/simple/BOOK z aktualną sesją CMS i CSRF. Tworzy nieaktywną, ukrytą książkę QA z kodem handlowym i cennikiem wybranego kanału; pozostaje w CMS. Ponowny odczyt potwierdza ID, kod, nazwę, slug, kod handlowy, ceny i ukrycie. Bez bezpośrednich zapisów do bazy, bez zamówień i bez ponawiania niepewnego POST. Nie sprawdza /api/v2/admin/products.';
 report.reference=preview;report.creation={code:input.code,state:'not_started'};
 try{
  assert(options.allowLocal||config.environment==='dev'&&new URL(config.baseUrl).origin==='https://ksiegarnia.gwodev.pl','Tworzenie CMS dozwolone wyłącznie na DEV.');
  adapter=options.adapter??await connectDescriptionWeb({...options,directory:c.directory,onRequest:r=>report.requests.push(r),onSecret:value=>c.api.secrets.push(value)});
  const created=await test('CMS: utworzenie książki — POST /products/new/simple/BOOK',async()=>{
   report.creation.state='creation_attempted';await mkdir(c.directory,{recursive:true});await writeFile(path.join(c.directory,'creation-intent.json'),JSON.stringify({code:input.code,createdAt:new Date().toISOString(),note:'Sprawdź kod w CMS przed kolejną próbą. Nie ponawiaj niepewnego zapisu.'}),{flag:'wx'});
   product=await adapter.createSimpleBook(input);assert(Number.isSafeInteger(product.id)&&product.id>0,'Brak ID nowego produktu');assert.equal(product.code,input.code);
   report.creation={code:input.code,id:product.id,state:'product_created'};return 'CMS przekierował do edycji produktu '+product.id+'. Zapis wykonany jeden raz.';
  });
  if(created)await test('CMS: niezależny odczyt zapisanej książki i cen',async()=>{
   const actual=await adapter.createdBookState(product,input.channel);report.tables.push({title:'Oczekiwane i zapisane dane CMS',headers:['Pole','Oczekiwano','Odczytano'],rows:[['Nazwa',preview.name,actual.main.name],['Slug',input.slug,actual.main.slug],['Kod handlowy',input.variantCode,actual.merchandiseCode],...Object.keys(actual.prices).map(k=>[k,preview.prices[k],minorUnits(actual.prices[k])])]});
   assert.equal(actual.main.name,preview.name);assert.equal(actual.main.slug,input.slug);assert.equal(actual.merchandiseCode,input.variantCode);assert.deepEqual(actual.activeChannels,[input.channel]);assert(!actual.enabled&&!actual.visible&&!actual.listed,'Produkt nie pozostał ukryty');
   for(const key of ['price','originalPrice','minimumPrice'])assert.equal(minorUnits(actual.prices[key]),preview.prices[key],'Cennik '+key);
   report.creation.state='verified';await adapter.screenshot('created-book');return 'Kod, nazwa, slug, kod handlowy, ceny wybranego kanału i ukrycie potwierdzone odczytem CMS.';
  });
 }catch(e){report.tests.push({name:'Przygotowanie tworzenia w CMS',status:'FAIL',detail:c.api.clean(e.message)});}
 finally{await adapter?.close();}
 return c.finish();
}
