import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {descriptionContext,runDescriptions} from './features.mjs';
import {descriptionScenarioCatalog} from './description-scenarios.mjs';
import {runDescriptionCms} from './description-cms.mjs';
import {runDescriptionWeb} from './description-web.mjs';
import {runDescriptionNewProduct} from './description-new-product.mjs';
import {runDescriptionRetailCart} from './description-retail-cart.mjs';
import {runDescriptionStock} from './description-stock.mjs';
import {runDescriptionDocuments} from './description-documents.mjs';
import {resolveDescriptionRoutes,readDescriptionEvidence} from './description-routing.mjs';
import {saveFeatureReport} from './feature-report.mjs';

export const descriptionModules=[
 {id:'api',name:'API — nazwy, opisy, slugi i warianty',run:runDescriptions},
 {id:'cms',name:'CMS — zapis, walidacje i przywrócenie',run:runDescriptionCms},
 {id:'web',name:'CMS i frontend RETAIL — formularze, opisy i listy',run:runDescriptionWeb},
 {id:'new-product',name:'Nowy ukryty produkt — CMS i baza',run:runDescriptionNewProduct},
 {id:'retail-cart',name:'Koszyki RETAIL — aplikacja i oferta',run:runDescriptionRetailCart},
 {id:'stock',name:'Dostępność — zapas QA i nowy e-mail',run:runDescriptionStock},
 {id:'documents',name:'Nowe zamówienie WHOLESALE — PDF i e-mail',run:runDescriptionDocuments}
];
export async function assertDescriptionRestored(){
 for(const file of ['.auth/description-cms-restore.json','.auth/description-stock-restore.json']){
  try{await access(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
  throw new Error('Pozostał dziennik przywracania '+file+'. Przywróć dane przed dalszymi modułami.');
 }
}
export async function runDescriptionAll(config,credentials,options={}){
 const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — zestaw zbiorczy #33388 ('+(options.complete===true?'z zamówieniem':'bez zapisu zamówienia')+')','descriptions');
 const {report}=c,complete=options.complete===true;
 if(options.evidenceReports?.length)report.historicalEvidence=await readDescriptionEvidence(config.outputDirectory??'raporty-api',options.evidenceReports,config.baseUrl);
 report.scopeNote='Nowe, kolejne przebiegi modułów API, CMS, RETAIL, tworzenia produktu, koszyków i dostępności. Tworzy ukryte produkty QA i koszyki; tymczasowo zmienia dane QA z przywracaniem i wysyła powiadomienie o dostępności. '+(complete?'Dodatkowo tworzy jedno zamówienie WHOLESALE, pobiera PDF i sprawdza nowy e-mail.':'Bez finalizacji zamówienia; moduł PDF i potwierdzenia zamówienia pominięty.')+' Wyniki historyczne nie są przenoszone. PASS kontroli nie oznacza pełnego zaliczenia scenariusza. Przekazania do innych modułów są osobną listą, nie wynikami PASS. Błąd kontroli nie zatrzymuje niezależnych modułów; niedokończone przywracanie lub anulowanie zatrzymuje zestaw.';
 report.modules=[];report.routedChecks=[];report.mode=complete?'with-order':'without-order';
 let stopped=false;
 for(const module of options.modules??descriptionModules){
  const entry={id:module.id,name:module.name,status:'NOT_RUN'};report.modules.push(entry);
  if(stopped||options.signal?.aborted){stopped=true;entry.reason='Zatrzymano zestaw; modułu nie uruchomiono.';report.tests.push({name:module.name,status:'SKIP',skipReason:'dependency',detail:entry.reason});continue;}
  if(module.id==='documents'&&!complete){entry.status='SKIP';entry.reason='Wybrano wariant bez finalizacji zamówienia.';report.tests.push({name:module.name,status:'SKIP',skipReason:'out_of_scope',scenarioIds:['DESC-024','DESC-025'],detail:entry.reason});continue;}
  try{
   await (options.checkRestored??assertDescriptionRestored)();options.signal?.throwIfAborted();
   options.onProgress?.('Moduł '+module.name);
   const result=await module.run(config,credentials,{...options,modules:undefined,directory:path.join(c.directory,module.id),complete:module.id==='documents',onProgress:line=>options.onProgress?.('['+module.id+'] '+line)});
   entry.status=result.report.status;entry.file=module.id+'/raport.html';
   try{
    const child=JSON.parse(await readFile(path.join(c.directory,module.id,'raport.json'),'utf8'));
    child.aggregateReport='../raport.html';await saveFeatureReport(child,path.join(c.directory,module.id));
   }catch(e){if(e.code!=='ENOENT')throw e;}
   entry.counts=Object.fromEntries(['PASS','FAIL','SKIP'].map(s=>[s,result.report.tests.filter(t=>t.status===s).length]));
   for(const check of result.report.tests){
    if(check.status==='SKIP'&&check.skipReason==='out_of_scope'){report.routedChecks.push({module:module.id,...check});continue;}
    report.tests.push({...check,name:module.name+' — '+check.name,module:module.id,evidence:{...check.evidence,report:entry.file}});
   }
   if(result.report.restorationFailed){report.restorationFailed=true;throw new Error('Moduł nie przywrócił danych QA. Dalsze moduły zatrzymano.');}
   await (options.checkRestored??assertDescriptionRestored)();
  }catch(e){entry.status=options.signal?.aborted?'CANCELLED':'FAIL';entry.reason=c.api.clean(e.message);report.tests.push({name:module.name+' — wykonanie zestawu',status:'FAIL',detail:entry.reason,module:module.id});stopped=true;report.error=entry.reason;}
 }
 report.cancelled=options.signal?.aborted===true;
 report.routedResults=resolveDescriptionRoutes(report.tests,report.modules);
 const catalog=await descriptionScenarioCatalog();
 report.tables.push({title:'Pozostałe granice scenariuszy — także przy poprawnych kontrolach',headers:['ID','Scenariusz','Zakres wymagający dalszych kontroli'],rows:catalog.cases.filter(s=>s.coverage!=='automated').map(s=>[s.id,s.title,s.automation.limits])});
 report.tables.push({title:'Przekazania zakresu między modułami — nie są zaliczeniem kontroli',headers:['Moduł źródłowy','Kontrola','Uzasadnienie'],rows:report.routedChecks.map(t=>[t.module,t.name,t.detail])});
 return c.finish();
}
