import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {descriptionContext} from './features.mjs';
import {connectDescriptionWeb} from './description-web.mjs';
import {verifyRetailSummary} from './description-retail-cart.mjs';
import {extractPdfText,requireNames} from './description-documents.mjs';
import {waitForOrderMailPdf} from './mail-pdf.mjs';

export function verifyRetailSaved(rows,p){
 assert.equal(rows.length,1,'Zapis zawiera inną liczbę pozycji');
 requireNames(rows[0][0],[p.name,p.summaryName],'Zapis Order RETAIL');
 assert(/11 dostępów uczniowskich/.test(rows[0][0]),'Zapis nie potwierdza 11 dostępów uczniowskich');assert.equal(rows[0][6],'1','Nieprawidłowa ilość pozycji');
}
export async function runDescriptionRetailDocuments(config,credentials,options={}){
 const settings=options.settings??JSON.parse(await readFile('config/description-web.local.json','utf8')),vars=options.vars??process.env;
 const c=await descriptionContext(config,credentials,options,'RETAIL — nowe zamówienie, PDF i e-mail','descriptions');const {report,test,skip}=c;
 report.scopeNote='Tworzy jeden koszyk Matlandii (1 dostęp nauczycielski i 11 uczniowskich), loguje Moje GWO, porównuje nazwę wariantu w podsumowaniu i zapisuje jedno zamówienie RETAIL z przelewem bankowym. Bez wykonywania płatności. Odczytuje zapis CMS, treść PDF i załącznik nowego e-maila. Nie ponawia zapisu po błędzie/wylogowaniu/utracie odpowiedzi. Zatrzymuje się przy połączeniu koszyków. Wymaga osobnego RETAIL_LOGIN_EMAIL i RETAIL_LOGIN_PASSWORD. Nie potwierdza faktur, innych wariantów i produktów ani innych kanałów. Logowanie poprzedza dodanie QA; wymagany pusty koszyk. Rodzaj zamówienia zapisuje formularzem HTTP i otwiera etap danych bezpośrednio. Przed próbą finalizacji sprząta własną pozycję po błędzie; po nieustalonym wyniku finalizacji nie usuwa pozycji.';
 if(options.complete!==true){skip('Nowe zamówienie RETAIL','Wybierz jawny wariant z zapisem zamówienia.',['DESC-021','DESC-024','DESC-025'],'out_of_scope');return c.finish();}
 if(!vars.RETAIL_LOGIN_EMAIL||!vars.RETAIL_LOGIN_PASSWORD){skip('Logowanie Moje GWO','Uzupełnij RETAIL_LOGIN_EMAIL i RETAIL_LOGIN_PASSWORD w .env; nie używaj hasła API.',['DESC-021','DESC-024','DESC-025'],'data_missing');return c.finish();}
 c.api.secrets.push(vars.RETAIL_LOGIN_PASSWORD);let adapter,reader,baseline,number,saved,ready=false;const p=settings.application;
 try{
  assert.equal(config.environment,'dev');assert.equal(new URL(config.baseUrl).origin,'https://ksiegarnia.gwodev.pl');assert(p.summaryName,'Brak application.summaryName');
  adapter=options.adapter??await connectDescriptionWeb({...options,isolateRetailLogin:true,directory:c.directory,onRequest:r=>report.requests.push(r),onSecret:value=>c.api.secrets.push(value)});
  ready=await test('Przygotowanie: wzorzec i migawka czasu przed zapisem',async()=>{
   const source=await adapter.product(p);assert.equal(source.name,p.name);assert.equal(source.slug,p.slug);
   reader=await adapter.mailReader();baseline={notBefore:new Date().toISOString(),baselineIds:new Set()};
   report.reference={product:p,expectedName:p.summaryName,channel:'RETAIL',expectationSource:p.summaryNameSource};report.mailBaseline={notBefore:baseline.notBefore,baselineIdComparison:false};
   return 'Wzorzec CMS potwierdzony. Poczta wymaga dokładnego odbiorcy, daty po rozpoczęciu i numeru nowego zamówienia w PDF; nie deklaruje pełnej migawki ID.';
  });
  if(ready)ready=await test('DESC-021: nazwa wariantu w podsumowaniu RETAIL',async()=>{
   const actual=await adapter.retailSummary(p,{email:vars.RETAIL_LOGIN_EMAIL,password:vars.RETAIL_LOGIN_PASSWORD,address:config.scenario.billingAddress});
   assert.equal(actual.url,'https://ksiegarnia.gwodev.pl/zamowienie/podsumowanie');report.tables.push({title:'Podsumowanie — wzorzec i pomiar',headers:['Oczekiwano','Wiersze podsumowania'],rows:[[p.summaryName,JSON.stringify(actual.rows)]]});verifyRetailSummary(actual.rows,p);await adapter.screenshot('retail-summary');return 'Nazwa wybranego wariantu odpowiada jawnemu wzorcowi; brak nazwy głównej w tej kolumnie jest poprawny.';
  },['DESC-021']);
  if(ready)ready=await test('DESC-021: zapis jednego zamówienia RETAIL',async()=>{
   report.completionAttempted=true;report.finalization='nieustalona — nie ponawiać zapisu';const result=await adapter.completeRetail();assert(/^\d{4,}$/.test(result.number));number=result.number;report.orderNumber=number;report.finalization='potwierdzona przez frontend';await adapter.screenshot('retail-saved');return 'Przyjęto zamówienie #'+number+'. Operacja wykonana raz, bez przelewu bankowego.';
  },['DESC-021']);
  if(ready){
   const read=await test('DESC-021: zapisane nazwy i liczby dostępów w CMS',async()=>{saved=await adapter.savedRetail(number);verifyRetailSaved(saved.rows,p);report.tables.push({title:'Zapis CMS RETAIL',headers:['Numer','Dane pozycji'],rows:[[number,JSON.stringify(saved.rows)]]});return 'Zapisano główną nazwę produktu, wariant, 11 dostępów uczniowskich i ilość 1.';},['DESC-021']);
   if(read)await test('DESC-024: treść potwierdzenia PDF RETAIL',async()=>{const parsed=await(options.extractPdfText??extractPdfText)(path.join(c.directory,saved.pdfFile),{vars,signal:options.signal});requireNames(parsed.text,[number,p.summaryName,'11 dostępów uczniowskich'],'PDF RETAIL');report.documents=[{kind:'Potwierdzenie RETAIL',file:saved.pdfFile,pages:parsed.pages}];return 'PDF tego zamówienia zawiera właściwy numer, nazwę wariantu i 11 dostępów uczniowskich. Nie jest to test faktury.';},['DESC-024']);
   else skip('DESC-024: PDF RETAIL','Nie odczytano dokumentu zapisanego zamówienia.',['DESC-024'],'dependency');
   await test('DESC-025: załącznik nowego e-maila RETAIL',async()=>{
    const found=await waitForOrderMailPdf({reader,recipient:vars.RETAIL_LOGIN_EMAIL,...baseline,orderNumber:number,expectedName:p.summaryName,directory:c.directory,extractPdfText:file=>(options.extractPdfText??extractPdfText)(file,{vars,signal:options.signal}),timeoutMs:options.mailTimeoutMs??60000,signal:options.signal,onProgress:options.onProgress});requireNames(found.text,[number,p.summaryName,'11 dostępów uczniowskich'],'Załącznik RETAIL');const {text,...proof}=found;report.mailEvidence={...proof,baselineIdComparison:false};report.documents??=[];report.documents.push({kind:'Podsumowanie z nowego e-maila RETAIL',file:found.file,pages:found.pages});return 'Dokładny odbiorca, czas po rozpoczęciu i numer tego zamówienia w załączniku. Nazwa wariantu oraz opis dostępów poprawne. Informacyjne body nie musi zawierać nazwy.';
   },['DESC-025']);
  }else for(const [id,label]of [['DESC-021','zapis CMS'],['DESC-024','PDF'],['DESC-025','e-mail']])skip(id+': '+label,'Nie osiągnięto potwierdzonego zapisu; nie ponawiamy finalizacji ani nie zaliczamy historycznych dokumentów.',[id],'dependency');
 }catch(e){report.tests.push({name:'Przebieg RETAIL z zapisem',status:'FAIL',detail:c.api.clean(e.message)});}
 finally{
  if(!report.completionAttempted&&adapter?.cleanupRetailCart)try{report.cartCleanup=await adapter.cleanupRetailCart();}catch(e){report.tests.push({name:'RETAIL: usunięcie własnej pozycji QA',status:'FAIL',detail:c.api.clean(e.message)});}
  await adapter?.close();
 }
 return c.finish();
}
