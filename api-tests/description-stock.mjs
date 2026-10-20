import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
import path from 'node:path';
import {descriptionContext} from './features.mjs';
import {connectDescriptionWeb} from './description-web.mjs';
import {newProductTranslations} from './description-new-product.mjs';
import {messageText} from './mailhog.mjs';
export function stockProfile(original,onHand){assert([0,1].includes(onHand));return {...original,enabled:true,visible:true,listed:false,tracked:true,onHand,activeChannels:['RETAIL']};}
export async function restoreStockJournal(adapter,journal){
 assert(/^qa-33388-stock-[a-z0-9-]+$/.test(journal.product?.code),'Nieprawidłowy produkt dziennika');const current=await adapter.newProductState(journal.product);
 if(equal(current,journal.original))return;
 assert(journal.allowed.some(s=>equal(s,current)),'Produkt zmieniony poza testem. Przywracanie zatrzymane — zachowano dziennik.');
 await adapter.saveQaStock(journal.product,current,journal.original);assert.deepEqual(await adapter.newProductState(journal.product),journal.original,'Nie potwierdzono przywrócenia zapasu i ukrycia QA');
}
export async function restoreDescriptionStock(options={}){
 const file=options.journalFile??path.resolve('.auth/description-stock-restore.json'),journal=JSON.parse(await readFile(file,'utf8'));const adapter=options.adapter??await connectDescriptionWeb(options);
 try{await restoreStockJournal(adapter,journal);await unlink(file);}finally{await adapter.close();}
}
export async function runDescriptionStock(config,credentials,options={}){
 const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — powiadomienie RETAIL o dostępności nowego QA','descriptions');const {report,test,skip}=c;
 report.scopeNote='Tworzy jeden nowy produkt QA stock, ukryty na listach. Tymczasowo udostępnia jego stronę RETAIL ze śledzonym stanem 0. Sprawdza brak subskrypcji, zapisuje wyłącznie testowego odbiorcę i potwierdza w bazie, że jest jedyny. Zmienia zapas 0 → 1 i szuka nowej wiadomości tej próby. Na końcu przywraca stan i ukrycie produktu. Bez zamówienia i bez zmiany zapasów wspólnych produktów. Dziennik umożliwia przywrócenie po przerwaniu.';
 const file=options.journalFile??path.resolve('.auth/description-stock-restore.json');let adapter,journal,owns=false,reader,baseline;
 try{
  adapter=options.adapter??await connectDescriptionWeb({...options,directory:c.directory,onRequest:r=>report.requests.push(r)});
  let ready=await test('DESC-029: izolowany produkt QA, migawka poczty i zero subskrypcji',async()=>{
   try{await readFile(file);throw Error('Istnieje dziennik stock. Najpierw descriptions:stock:restore.');}catch(e){if(e.code!=='ENOENT')throw e;}
   reader=await adapter.mailReader();const recent=await reader.recentRecipient(credentials.email);baseline={baselineIds:new Set(recent.map(m=>m.ID)),notBefore:new Date().toISOString()};report.mailBaseline={notBefore:baseline.notBefore,observedIds:recent.length,scope:'Najnowsze 50 ID + czas przed próbą i unikalna nazwa nowego produktu. Starsze wiadomości wyklucza czas.'};const code='qa-33388-stock-'+randomUUID().slice(0,16),input={code,name:'QA dostępność RETAIL '+code.slice(-8)};report.reference={input};report.creationAttempted=true;await mkdir(c.directory,{recursive:true});await writeFile(path.join(c.directory,'creation-intent.json'),JSON.stringify({input,createdAt:new Date().toISOString(),note:'Przed ponowieniem sprawdź kod w CMS. Nie ponawiaj niepewnego POST.'},null,2),{flag:'wx'});const p=await adapter.createProduct(input);report.reference.product=p;
   await adapter.saveNewTranslations(p,newProductTranslations(code));const original=await adapter.newProductState(p);assert(!original.enabled&&!original.visible&&!original.listed&&original.onHand===0,'Nieprawidłowy początkowy profil QA');assert.notEqual(original.main.name,original.channels.WHOLESALE.name,'Wzorzec kanałów musi być różny');
   const hash=createHash('md5').update(credentials.email.toLowerCase()).digest('hex'),counts=await adapter.stockSubscriptionCounts(p,hash);assert.deepEqual(counts,{total:0,own:0},'Nowy produkt ma już subskrypcje');
   journal={product:p,original,allowed:[original],createdAt:new Date().toISOString()};await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(journal,null,2),{flag:'wx'});owns=true;report.reference.expectedName=original.main.name;report.reference.unwantedWholesaleName=original.channels.WHOLESALE.name;return 'Nowy QA, różne nazwy RETAIL/WHOLESALE, zero subskrypcji i migawka wiadomości przed zmianami.';
  },['DESC-029']);
  const patch=async(next)=>{const current=await adapter.newProductState(journal.product);assert(journal.allowed.some(s=>equal(s,current)),'Nieoczekiwana zmiana QA');journal.allowed.push(next);await writeFile(file,JSON.stringify(journal,null,2));await adapter.saveQaStock(journal.product,current,next);assert.deepEqual(await adapter.newProductState(journal.product),next);};
  if(ready)ready=await test('DESC-029: własna subskrypcja RETAIL przy zapasie 0',async()=>{await patch(stockProfile(journal.original,0));await adapter.subscribeQaStock(journal.product,credentials.email);const counts=await adapter.stockSubscriptionCounts(journal.product,createHash('md5').update(credentials.email.toLowerCase()).digest('hex'));report.tables.push({title:'Izolacja odbiorcy przed zmianą zapasu',headers:['Wszystkie subskrypcje','Subskrypcje konta QA'],rows:[[counts.total,counts.own]]});assert.deepEqual(counts,{total:1,own:1},'Przed zmianą zapasu wymagany jest dokładnie jeden własny odbiorca');return 'Jedna subskrypcja i tylko własny odbiorca. Wspólne produkty i ich subskrybenci nietknięci.';},['DESC-029']);
  if(ready)ready=await test('DESC-029: zmiana zapasu nowego QA 0 → 1',async()=>{await patch(stockProfile(journal.original,1));return 'CMS ponownie odczytał zapas 1, RETAIL i aktywną stronę nowego QA. Bez ponawiania zapisu.';},['DESC-029']);
  if(ready)await test('DESC-029: nowy e-mail zawiera główną nazwę RETAIL',async()=>{const m=await reader.waitForNewMessage({recipient:credentials.email,...baseline,correlation:journal.original.main.name,expectedTexts:[journal.original.main.name],timeoutMs:90000});const text=messageText(m);assert(!text.includes(journal.original.channels.WHOLESALE.name),'Powiadomienie RETAIL używa nazwy WHOLESALE');report.mailEvidence={messageId:m.ID,created:m.Created,expectedName:journal.original.main.name,afterBaseline:true};return 'Nowa wiadomość tego odbiorcy, po migawce, z unikalną główną nazwą produktu QA. Nie zawiera odmiennej nazwy WHOLESALE. Pełna korespondencja nie jest kopiowana do raportu.';},['DESC-029','DESC-025']);
  else skip('DESC-029: treść nowego powiadomienia','Nie potwierdzono przygotowania subskrypcji i zapasu. Nie wysłano dalszych zapisów.',['DESC-029'],'dependency');
 }catch(e){report.tests.push({name:'Przebieg testu dostępności',status:'FAIL',detail:c.api.clean(e.message),scenarioIds:['DESC-029']});}
 finally{
  if(owns)try{await restoreStockJournal(adapter,journal);await unlink(file);report.tests.push({name:'DESC-029: przywrócenie zapasu, kanałów i ukrycia QA',status:'PASS',detail:'Odczyt CMS zgodny z profilem sprzed próby; produkt nieaktywny i ukryty.',scenarioIds:['DESC-029']});}catch(e){report.restorationFailed=true;report.tests.push({name:'DESC-029: przywracanie QA',status:'FAIL',detail:c.api.clean(e.message)+'; zachowano dziennik, użyj descriptions:stock:restore.',scenarioIds:['DESC-029']});}
  await adapter?.close();
 }
 return c.finish();
}
