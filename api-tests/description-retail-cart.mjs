import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {descriptionContext} from './features.mjs';
import {connectDescriptionWeb} from './description-web.mjs';
export function verifyRetailSummary(rows,product){
 assert(Array.isArray(rows)&&rows.length>0,'Podsumowanie nie zawiera pozycji');
 const expected=product.summaryName??product.name;assert(typeof expected==='string'&&expected.trim(),'Brak jawnej oczekiwanej nazwy podsumowania');
 assert(rows.some(row=>String(row[1]??'').replace(/\s+/g,' ').trim()===expected),'Nazwa w podsumowaniu różni się od ustalonego wzorca „'+expected+'”; odczytano: '+rows.map(row=>row.join(' | ')).join('; '));
}
export async function runDescriptionRetailSummary(config,credentials,options={}){
 const settings=options.settings??JSON.parse(await readFile('config/description-web.local.json','utf8'));
 const c=await descriptionContext(config,credentials,options,'RETAIL — nazwa produktu w podsumowaniu, bez finalizacji','descriptions');
 const {report,test,skip}=c,vars=options.vars??process.env;
 report.scopeNote='Osobny koszyk Matlandii: 1 dostęp nauczycielski i 11 uczniowskich, logowanie RETAIL, dane QA i odczyt podsumowania. Bez zaznaczania regulaminu i bez finalizacji. Nie potwierdza zapisanego Order, PDF ani e-maila. Logowanie może połączyć koszyk z istniejącym koszykiem konta; próba zatrzymuje się przy więcej niż jednej pozycji i nigdy ich nie usuwa. Wymaga osobnego RETAIL_LOGIN_EMAIL i RETAIL_LOGIN_PASSWORD. Najpierw loguje konto i wymaga pustego koszyka. Rodzaj zamówienia zapisuje aktualnym formularzem HTTP, a etap danych otwiera bezpośrednio; nie ocenia przycisku przejścia z koszyka. Po kontroli usuwa wyłącznie własną pozycję o zapamiętanym ID i potwierdza pusty koszyk.';
 if(!vars.RETAIL_LOGIN_EMAIL||!vars.RETAIL_LOGIN_PASSWORD){skip('DESC-021: podsumowanie RETAIL','Uzupełnij RETAIL_LOGIN_EMAIL i RETAIL_LOGIN_PASSWORD w .env. Hasło API nie jest hasłem Moje GWO.',['DESC-021'],'data_missing');return c.finish();}
 c.api.secrets.push(vars.RETAIL_LOGIN_PASSWORD);let adapter;
 try{
  assert.equal(config.environment,'dev');assert.equal(new URL(config.baseUrl).origin,'https://ksiegarnia.gwodev.pl');
  adapter=options.adapter??await connectDescriptionWeb({...options,isolateRetailLogin:true,directory:c.directory,onRequest:r=>report.requests.push(r),onSecret:value=>c.api.secrets.push(value)});
  await test('DESC-021: nazwa wariantu RETAIL w podsumowaniu',async()=>{
   const p=settings.application,source=await adapter.product(p);assert.equal(source.name,p.name);assert.equal(source.slug,p.slug);
   const actual=await adapter.retailSummary(p,{email:vars.RETAIL_LOGIN_EMAIL,password:vars.RETAIL_LOGIN_PASSWORD,address:config.scenario.billingAddress});
   assert.equal(new URL(actual.url).origin,'https://ksiegarnia.gwodev.pl');assert.equal(new URL(actual.url).pathname,'/zamowienie/podsumowanie','Nie odczytano podsumowania');
   report.tables.push({title:'Podsumowanie RETAIL — oczekiwano i odczytano',headers:['Produkt CMS','Oczekiwana nazwa wariantu / produktu','Wiersze podsumowania','Widok'],rows:[[source.name,p.summaryName??source.name,JSON.stringify(actual.rows),actual.url]]});await adapter.screenshot('retail-summary');verifyRetailSummary(actual.rows,{...p,name:source.name});
   return 'Nazwa podsumowania zgodna z jawnym wzorcem. Dla Matlandii jest to nazwa wariantu — potwierdzone przez użytkownika. To nie jest potwierdzenie zapisu zamówienia.';
  },['DESC-021']);
 }catch(e){report.tests.push({name:'Przygotowanie podsumowania RETAIL',status:'FAIL',scenarioIds:['DESC-021'],detail:c.api.clean(e.message)});}
 finally{
  if(adapter?.cleanupRetailCart)try{report.cartCleanup=await adapter.cleanupRetailCart();}catch(e){report.tests.push({name:'RETAIL: usunięcie własnej pozycji QA',status:'FAIL',detail:c.api.clean(e.message)});}
  await adapter?.close();
 }
 return c.finish();
}
export function verifyApplicationDescription(text,{name,students}){
 assert(text.includes(name),'Koszyk nie zawiera głównej nazwy aplikacji');
 assert(/Dostępy nauczycielskie:\s*1(?!\d)/i.test(text),'Opis: oczekiwano 1 dostępu nauczycielskiego');
 assert(new RegExp('Dostępy uczniowskie:\\s*'+students+'(?!\\d)','i').test(text),'Opis: oczekiwano '+students+' dostępów uczniowskich');
}
export function verifyOfferDescription(text,products,quantity=2){
 for(const p of products){const name=p.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');assert(new RegExp('(?:^|\\s)'+quantity+'\\s*[x×]\\s*'+name+'(?=\\s|$)','u').test(text),'Opis oferty: brak '+quantity+' x '+p.name);}
}
export async function runDescriptionRetailCart(config,credentials,options={}){
 const settings=options.settings??JSON.parse(await readFile('config/description-web.local.json','utf8'));
 const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — aplikacja i koszyk RETAIL bez finalizacji','descriptions');const {report,test}=c;
 report.scopeNote='Dwie osobne nowe sesje sklepu, bez istniejącego PHPSESSID użytkownika. Pierwszy koszyk: Matlandia, pakiet nauczycielski z 11 dostępami uczniowskimi. Drugi koszyk: oferta 7, po 2 sztuki produktów A i B. Porównuje główne nazwy oraz wygenerowane opisy dostępów i produktów składowych. Czeka na zakończenie przeliczeń konfiguratora. Nie zatwierdza zamówień, nie wysyła e-maili, nie zmienia produktów ani zapasów. Inne okresy, pakiet szkolny i zapis Order pozostają poza zakresem.';
 const p=settings.application;assert(p?.id&&p?.code&&p?.name&&p?.slug,'Brak fixture aplikacji');report.reference={application:p,students:11,teachers:1};let adapter;
 try{
  adapter=options.adapter??await connectDescriptionWeb({...options,directory:c.directory,onRequest:r=>report.requests.push(r)});
  await test('DESC-023: RETAIL — nazwa aplikacji i opis liczby dostępów w koszyku',async()=>{
   const actual=await adapter.applicationCart(p,{students:11});report.tables.push({title:'Wygenerowany widok po dodaniu aplikacji',headers:['Widok','Tekst koszyka / komunikatu'],rows:[[actual.url,actual.text]]});verifyApplicationDescription(actual.text,{name:p.name,students:11});assert.equal(new URL(actual.url).pathname,'/koszyk','Porównano tylko komunikat, nie koszyk');await adapter.screenshot('application-retail-cart');return 'Główna nazwa aplikacji oraz liczba dostępów w opisie zgodne: nauczycielskie 1, uczniowskie 11. Bez complete. Koszyk utworzono w odrębnej sesji.';
  },['DESC-023','DESC-021']);
  await adapter.close();adapter=options.offerAdapter??await connectDescriptionWeb({...options,directory:c.directory,onRequest:r=>report.requests.push(r)});
  report.reference.offer=settings.offer;report.reference.offerProducts=settings.products.map(p=>({...p,quantity:2}));
  await test('DESC-022: RETAIL — wygenerowany opis oferty 2 × A + 2 × B w koszyku',async()=>{const actual=await adapter.offerCart(settings);report.tables.push({title:'Wygenerowany opis oferty w koszyku RETAIL',headers:['Widok','Opis'],rows:[[actual.url,actual.text]]});assert.equal(new URL(actual.url).pathname,'/koszyk');verifyOfferDescription(actual.text,settings.products,2);await adapter.screenshot('offer-retail-cart');return 'Po zakończeniu przeliczeń dodano ofertę do osobnego koszyka. Wygenerowany opis zawiera po 2 sztuki A i B, z głównymi nazwami RETAIL zgodnymi z CMS. Bez complete.';},['DESC-022','DESC-027']);
 }catch(e){report.tests.push({name:'Przygotowanie aplikacji RETAIL',status:'FAIL',detail:c.api.clean(e.message),scenarioIds:['DESC-023']});}
 finally{await adapter?.close();}
 return c.finish();
}
