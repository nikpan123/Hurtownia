import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {descriptionContext} from './features.mjs';
import {connectDescriptionWeb} from './description-web.mjs';

export function newProductTranslations(code){
 assert(/^qa-33388-[a-z0-9-]+$/.test(code),'Niedozwolony kod nowego produktu QA');
 return Object.fromEntries(['WHOLESALE','EMPIK'].map(channel=>[channel,{name:'QA '+channel+' '+code.slice(-8),slug:code+'-'+channel.toLowerCase(),description:JSON.stringify([{code:'monsieurbiz.html',data:{content:'<p>Opis QA '+channel+' '+code+'</p>'}}]),shortDescription:'Krótki opis QA '+channel+' '+code}]));
}
export function verifyTranslationRows(rows,expected){
 assert.equal(rows.length,2,'Oczekiwano dwóch rekordów tłumaczeń po zapisie');
 for(const [channel,values]of Object.entries(expected)){
  const matching=rows.filter(r=>r.channel===channel);assert.equal(matching.length,1,'Niepoprawna liczba rekordów '+channel);
  for(const [key,value]of Object.entries(values))assert.equal(matching[0][key+'_hash'],createHash('md5').update(value).digest('hex'),'Baza: inne pole '+channel+'.'+key);
 }
}
export async function runDescriptionNewProduct(config,credentials,options={}){
 const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — utworzenie nowego produktu i dodanie tłumaczeń','descriptions');const {report,test,skip}=c;
 const code='qa-33388-'+randomUUID().slice(0,18),input={code,name:'QA nowy produkt '+code.slice(-8)},expected=newProductTranslations(code);
 report.scopeNote='Tworzy jeden nowy, nieaktywny i ukryty produkt BOOK na DEV. EMPIK pozostaje wyłączony ze sprzedaży. Sprawdza puste pola i brak rekordów tłumaczeń po utworzeniu, następnie dodaje cztery pola WHOLESALE/EMPIK i weryfikuje ponowny odczyt CMS oraz SELECT. Produkt pozostaje jako oznaczony QA, bez publikacji, zamówień i wysyłki. Nie ponawia zapisów po błędzie lub timeout.';
 report.reference={input,expected};let adapter,p;
 try{
  adapter=options.adapter??await connectDescriptionWeb({...options,directory:c.directory,onRequest:r=>report.requests.push(r)});
  const created=await test('DESC-010: utworzenie ukrytego produktu BOOK z pustymi polami kanałów',async()=>{
   await mkdir(c.directory,{recursive:true});report.creationAttempted=true;await writeFile(path.join(c.directory,'creation-intent.json'),JSON.stringify({code,createdAt:new Date().toISOString(),note:'Przed nową próbą sprawdź ten kod w CMS. Nie ponawiaj niepewnego POST.'},null,2),{flag:'wx'});
   p=await adapter.createProduct(input);report.reference.product=p;const state=await adapter.newProductState(p);assert(!state.enabled&&!state.visible&&!state.listed,'Produkt został włączony lub opublikowany');assert.deepEqual(state.activeChannels,['WHOLESALE']);assert.deepEqual(Object.keys(state.channels).sort(),['EMPIK','WHOLESALE']);for(const values of Object.values(state.channels))assert(Object.values(values).every(v=>!v),'Nowy produkt ma niepuste pole kanałowe');await adapter.screenshot('new-product-empty');return 'Utworzono produkt '+p.id+' / '+code+'. Nieaktywny i niewidoczny; pola obu kanałów puste. Liczba rekordów w bazie jest osobną kontrolą.';
  },['DESC-010']);
  if(created){
   await test('DESC-010: brak rekordów ProductChannelTranslation po utworzeniu — baza',async()=>{const rows=await adapter.translationRows(p);report.tables.push({title:'Tłumaczenia kanałowe po utworzeniu',headers:['Produkt','Liczba rekordów','Oczekiwano'],rows:[[p.id,rows.length,0]]});assert.equal(rows.length,0,'Nowy produkt ma rekordy tłumaczeń kanałowych mimo pustych pól');return 'SELECT w bookshop_product_channel_translation dla dokładnego ID i kodu: 0 rekordów.';},['DESC-010']);
   const saved=await test('DESC-010: późniejsze dodanie i trwały zapis czterech pól obu kanałów',async()=>{await adapter.saveNewTranslations(p,expected);const state=await adapter.newProductState(p);assert.deepEqual(state.channels,expected,'Ponowny odczyt CMS różni się od zapisanych pól');assert(!state.enabled&&!state.visible&&!state.listed);assert.deepEqual(state.activeChannels,['WHOLESALE']);await adapter.screenshot('new-product-translations');return 'Ponownie odczytano dokładne name, slug, description i shortDescription WHOLESALE oraz EMPIK. Produkt pozostaje ukryty i nieaktywny.';},['DESC-010']);
   if(saved)await test('DESC-010: dwa zapisane tłumaczenia i zgodność wszystkich pól — baza',async()=>{const rows=await adapter.translationRows(p);verifyTranslationRows(rows,expected);report.tables.push({title:'Tłumaczenia po dodaniu — niezależny SELECT',headers:['Kanał','Pola zgodne z wysłanymi danymi'],rows:rows.map(r=>[r.channel,'name, slug, description, shortDescription'])});return 'Dokładnie dwa rekordy powiązane z nowym produktem; skróty każdego pola zgodne z wysłanym wzorcem.';},['DESC-010']);
   else skip('DESC-010: baza po dodaniu tłumaczeń','Nie odczytano poprawnie zapisanych tłumaczeń. Bez ponawiania POST.',['DESC-010'],'dependency');
  }else skip('DESC-010: dalsze kontrole nowego produktu','Nie potwierdzono utworzenia i pustego stanu. Sprawdź kod z creation-intent.json przed nową próbą.',['DESC-010'],'dependency');
 }catch(e){report.tests.push({name:'Przygotowanie nowego produktu',status:'FAIL',detail:c.api.clean(e.message),scenarioIds:['DESC-010']});}
 finally{await adapter?.close();}
 return c.finish();
}
