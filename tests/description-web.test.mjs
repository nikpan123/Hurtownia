import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {validateWebFixtures,compareOfferLinks,assertHiddenChannelFields,compareRetailDescription,compareCategoryProduct,runDescriptionWeb} from '../api-tests/description-web.mjs';
const settings=JSON.parse(await readFile(new URL('../config/description-web.example.json',import.meta.url)));
const links=settings.products.map(p=>({text:p.name,href:'https://ksiegarnia.gwodev.pl/product/'+p.slug}));
test('Oferta: błędny kanał nazwy, slug, brak i duplikat produktu są wykrywane',()=>{
 compareOfferLinks(links,settings.products);
 for(const values of [[{...links[0],text:'Nazwa hurtowa'},links[1]],[{...links[0],href:'https://ksiegarnia.gwodev.pl/product/WHOLESALE'},links[1]],[links[0]],[...links,links[0]]])assert.throws(()=>compareOfferLinks(values,settings.products));
});
test('Ukryta zakładka wymaga potwierdzonego formularza; strona logowania nie daje PASS',()=>{
 assertHiddenChannelFields({identity:true,channelFields:0,channelTab:false});
 for(const snapshot of [{identity:false,channelFields:0,channelTab:false},{identity:true,channelFields:1,channelTab:false},{identity:true,channelFields:0,channelTab:true}])assert.throws(()=>assertHiddenChannelFields(snapshot));
 validateWebFixtures(settings);assert.throws(()=>validateWebFixtures({...settings,products:[settings.products[0],settings.products[0]]}));
});
for(const bad of [false,true])test('Zestaw web zachowuje częściowy zakres, nie zalicza treści maili/PDF i wykrywa błędny frontend: '+bad,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'description-web-'));let closed=false;const reads=new Map();
 const adapter={
  form:async()=>({identity:true,channelFields:0,channelTab:false,showLinks:['https://ksiegarnia.gwodev.pl/product/'+settings.offer.slug]}),
  product:async p=>{reads.set(p.id,(reads.get(p.id)??0)+1);return {name:p.name,slug:p.slug,channelSectionVisible:true,descriptionText:'Opis '+p.code,shortDescriptionText:'Krótki '+p.code,channels:{EMPIK:{},WHOLESALE:{}}};},
  retailProduct:async p=>({name:bad?'Nazwa WHOLESALE':p.name,url:'https://ksiegarnia.gwodev.pl/product/'+p.slug,description:'Opis '+p.code}),
  application:async p=>({name:p.name,text:p.name}),
  retailCatalog:async({query,category}={})=>category?[{url:'https://ksiegarnia.gwodev.pl/?'+new URLSearchParams({[settings.category.name]:settings.category.value}),items:[{text:settings.application.name,href:'https://ksiegarnia.gwodev.pl/product/'+settings.application.slug,shortDescription:'Krótki '+settings.application.code}]}]:query?[{url:'https://ksiegarnia.gwodev.pl/?name=Matlandia',items:settings.searchProducts.map(p=>({text:p.name,href:'https://ksiegarnia.gwodev.pl/product/'+p.slug}))}]:[1,2].map(page=>({url:'https://ksiegarnia.gwodev.pl/?page='+page,items:Array.from({length:10},(_,i)=>({text:'Produkt '+page+'-'+i,href:'https://ksiegarnia.gwodev.pl/product/p-'+page+'-'+i}))})),
  offer:async()=>({text:settings.offer.name,links}),mailhog:async()=>({loaded:true,visibleMessages:50}),screenshot:async()=>{},close:async()=>{closed=true;}
 };
 try{const {report}=await runDescriptionWeb({environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2'},{email:'qa@example.invalid',password:'private-password',testsToken:'private-token'},{settings,adapter,directory,allowLocal:true,fetchImpl:()=>{throw new Error('Zestaw odczytu UI nie powinien wykonywać API koszyka');}});
  assert.equal(report.status,bad?'FAIL':'INCOMPLETE');assert(closed);assert.equal(report.tests.filter(t=>t.status==='SKIP').length,6);
  assert.equal(report.tests.filter(t=>t.scenarioIds?.includes('DESC-002')&&t.status==='PASS').length,3);
  assert.equal(reads.get(settings.products[0].id),1);assert.equal(report.reference.reusedCmsSource.productId,settings.products[0].id);
  assert(!report.tests.some(t=>t.scenarioIds?.some(id=>['DESC-024','DESC-025','DESC-029'].includes(id))&&t.status==='PASS'));
  assert(!report.requests.length);const html=await readFile(path.join(directory,'raport.html'),'utf8');assert(html.includes('Nie zmienia produktów'));assert(!html.includes('private-password'));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('RETAIL: pełny opis i krótki opis kategorii nie mogą pochodzić z innego kanału',()=>{
 const source={name:'Główna nazwa',slug:'main',descriptionText:'Główny opis',shortDescriptionText:'Główny skrót'};
 compareRetailDescription({description:'Główny opis'},source);
 assert.throws(()=>compareRetailDescription({description:'Opis WHOLESALE'},source));
 assert.throws(()=>compareRetailDescription({description:''},source));
 assert.throws(()=>compareRetailDescription({description:''},{}));
 const pages=[{items:[{text:source.name,href:'https://ksiegarnia.gwodev.pl/product/main',shortDescription:source.shortDescriptionText}]}];
 compareCategoryProduct(pages,{code:'QA'},source);
 for(const key of ['text','href','shortDescription']){const bad=structuredClone(pages);bad[0].items[0][key]='WHOLESALE';assert.throws(()=>compareCategoryProduct(bad,{code:'QA'},source));}
 assert.throws(()=>compareCategoryProduct(pages,{code:'QA'},{...source,shortDescriptionText:''}));
 assert.throws(()=>compareCategoryProduct([...pages,...pages],{code:'QA'},source));assert.throws(()=>compareCategoryProduct(pages,{code:'QA'},source,{name:'category',value:'math'}));
});
