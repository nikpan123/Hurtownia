import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runDescriptionAll} from '../api-tests/description-all.mjs';
import {renderDescriptionModules} from '../api-tests/feature-report.mjs';
import {buildReportExplanation,renderReportExplanation} from '../api-tests/report-explanations.mjs';

const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2'};
const credentials={email:'qa@example.invalid',password:'secret',testsToken:'secret'};
async function fixture(fn){const directory=await mkdtemp(path.join(tmpdir(),'description-all-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}
test('Zbiorczy: nowe moduły kolejno, FAIL nie blokuje; przekazanie nie staje się PASS',()=>fixture(async directory=>{
 const calls=[];const modules=['api','cms','documents'].map(id=>({id,name:id,run:async(c,k,o)=>{calls.push(id);assert.equal(o.directory,path.join(directory,id));return {report:{status:id==='api'?'FAIL':'PASS',tests:[{name:'rzeczywista kontrola',status:id==='api'?'FAIL':'PASS',detail:'wynik',scenarioIds:['DESC-017']},{name:'osobny moduł',status:'SKIP',skipReason:'out_of_scope',scenarioIds:['DESC-010']} ]}};}}));
 const {report}=await runDescriptionAll(config,credentials,{directory,allowLocal:true,modules,checkRestored:async()=>{}});
 assert.deepEqual(calls,['api','cms']);assert.equal(report.status,'FAIL');assert.equal(report.tests.length,3);assert.equal(report.routedChecks.length,2);assert.equal(report.modules[2].status,'SKIP');assert.equal(report.tests[0].evidence.report,'api/raport.html');
 assert((await readFile(path.join(directory,'raport.html'),'utf8')).includes('href="api/raport.html"'));
}));
test('Zbiorczy: dokumenty tylko z jawnym complete i bez ponawiania',()=>fixture(async directory=>{
 let calls=0;const {report}=await runDescriptionAll(config,credentials,{directory,allowLocal:true,complete:true,checkRestored:async()=>{},modules:[{id:'documents',name:'Dokumenty',run:async(c,k,o)=>{calls++;assert.equal(o.complete,true);return {report:{status:'FAIL',tests:[{name:'Niepewny zapis',status:'FAIL'}]}};}}]});assert.equal(calls,1);assert.equal(report.status,'FAIL');
}));
for(const reason of ['restore','abort'])test('Zbiorczy: zatrzymanie po '+reason+', zachowanie raportu',()=>fixture(async directory=>{
 const controller=new AbortController();let calls=0;
 const modules=['cms','stock','documents'].map(id=>({id,name:id,run:async()=>{calls++;if(reason==='abort')controller.abort();return {report:{status:'FAIL',restorationFailed:reason==='restore',tests:[{name:'Kontrola',status:'FAIL'}]}};}}));
 const {report}=await runDescriptionAll(config,credentials,{directory,allowLocal:true,modules,complete:true,signal:controller.signal,checkRestored:async()=>{}});assert.equal(calls,1);assert.equal(report.modules[1].status,'NOT_RUN');assert.equal(report.cancelled,reason==='abort');assert.equal(report.restorationFailed===true,reason==='restore');await readFile(path.join(directory,'raport.json'),'utf8');
}));
test('Zbiorczy: dziennik przed startem blokuje wszystkie moduły',()=>fixture(async directory=>{
 let calls=0;const {report}=await runDescriptionAll(config,credentials,{directory,allowLocal:true,checkRestored:async()=>{throw Error('Pozostał dziennik');},modules:[{id:'cms',name:'CMS',run:async()=>{calls++;}}]});assert.equal(calls,0);assert.equal(report.status,'FAIL');
}));
test('Raport zbiorczy nie linkuje ścieżek spoza modułów',()=>{
 const html=renderDescriptionModules([{name:'<CMS>',status:'FAIL',file:'../../secret/raport.html'},{name:'API',status:'PASS',file:'api/raport.html'}]);assert(!html.includes('../../secret'));assert(html.includes('&lt;CMS&gt;'));assert(html.includes('href="api/raport.html"'));
});
test('Raport zbiorczy zachowuje dokładny opis kontroli CMS i link do dowodów',()=>{
 const report={status:'PASS',modules:[{name:'CMS'}],tests:[{name:'CMS — DESC-004: puste name — fallback CMS → API',status:'PASS',evidence:{report:'cms/raport.html'}}]};
 const explanation=buildReportExplanation(report,'descriptions');assert.equal(explanation.cases[0].category,'Opisy — formularz CMS');assert(explanation.cases[0].expected.includes('Wyczyszczone pola'));
 assert(renderReportExplanation(report,'descriptions').includes('href="cms/raport.html"'));
});
