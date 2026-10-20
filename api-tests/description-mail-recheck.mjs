import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {descriptionContext} from './features.mjs';
import {connectDescriptionWeb} from './description-web.mjs';
import {requireNames,extractPdfText} from './description-documents.mjs';
import {waitForOrderMailPdf} from './mail-pdf.mjs';

export async function runDescriptionMailRecheck(config,credentials,options={}){
 assert(/^[a-z0-9_-]+$/i.test(options.sourceReportId??''),'Wybierz raport z zapisanego zamówienia QA');
 const source=options.source??JSON.parse(await readFile(path.resolve(config.outputDirectory??'raporty-api',options.sourceReportId,'raport.json'),'utf8'));
 assert(source.completionAttempted&&source.finalization==='potwierdzona przez API'&&source.orderNumber&&source.mailBaseline?.notBefore&&source.reference?.expectedName,'Raport nie ma potwierdzonego zamówienia, czasu migawki lub wzorca nazwy');
 const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — ponowny odczyt e-maila istniejącego zamówienia QA','descriptions');const {report,test}=c;
 report.scopeNote='Wyłącznie odczyt MailHoga dla istniejącego QA #'+source.orderNumber+'. Nie tworzy ani nie zapisuje ponownie zamówienia i nie wysyła e-maila. Sprawdza dokładnego odbiorcę, czas po migawce sprzed oryginalnej operacji, unikalny numer tego zamówienia i nazwę z niezależnego CMS zapisaną w raporcie źródłowym. Pierwotny raport nie przechowywał listy ID migawki; powtórzenie nie deklaruje porównania tych ID. Oryginalny wynik pozostaje bez zmian.';
 report.reference={sourceReportId:options.sourceReportId,orderId:source.orderId,orderNumber:source.orderNumber,notBefore:source.mailBaseline.notBefore,expectedName:source.reference.expectedName};let adapter;
 try{
  adapter=options.adapter??await connectDescriptionWeb({...options,mailRecipient:credentials.email,onRequest:r=>report.requests.push(r)});
  await test('DESC-025: e-mail tego zamówienia — niezależne ponowienie odczytu',async()=>{
   const reader=await adapter.mailReader(),found=await waitForOrderMailPdf({reader,recipient:credentials.email,baselineIds:new Set(),notBefore:source.mailBaseline.notBefore,orderNumber:source.orderNumber,expectedName:source.reference.expectedName,directory:c.directory,extractPdfText:file=>(options.extractPdfText??extractPdfText)(file,{vars:options.vars,signal:options.signal}),timeoutMs:options.mailTimeoutMs??60000,signal:options.signal,onProgress:options.onProgress});const {text,...evidence}=found;
   report.mailEvidence={...evidence,afterOriginalBaseline:true,baselineIdComparison:false,nameConfirmed:text.includes(source.reference.expectedName)};report.documents=[{kind:'Podsumowanie załączone do e-maila',file:found.file,pages:found.pages}];
   report.tables.push({title:'Dowód poczty i załącznika dla istniejącego zamówienia',headers:['ID wiadomości','Utworzono','Migawka przed operacją','Zamówienie z PDF','Oczekiwana nazwa'],rows:[[found.messageId,found.created,source.mailBaseline.notBefore,source.orderNumber,source.reference.expectedName]]});
   requireNames(text,[source.reference.expectedName],'PDF załączony do e-maila zamówienia #'+source.orderNumber);
   return 'Świeży odczyt potwierdził wiadomość konkretnego odbiorcy po rozpoczęciu oryginalnej próby, a w załączniku podsumowanie.pdf jej unikalny numer zamówienia i nazwę WHOLESALE. Body jest ogólne — nie wymagamy w nim nazwy ani numeru. Nie wykonano complete ani nowej wysyłki. Pełna treść korespondencji nie jest kopiowana do raportu.';
  },['DESC-025']);
 }catch(e){report.tests.push({name:'Odczyt MailHoga',status:'FAIL',detail:c.api.clean(e.message)});}
 finally{await adapter?.close();}
 return c.finish();
}
