import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildReportExplanation,renderReportExplanation} from '../api-tests/report-explanations.mjs';
import {saveFeatureReport} from '../api-tests/feature-report.mjs';
import {saveCatalogReport} from '../api-tests/catalog-report.mjs';
import {saveReport} from '../api-tests/report.mjs';
import {refreshReports} from '../api-tests/refresh-reports.mjs';
const base={scenario:'Próba',kind:'order-regression',generatedAt:'2026-10-16T08:00:00Z',baseUrl:'https://ksiegarnia.gwodev.pl/api/v2',status:'INCOMPLETE',tests:[{name:'Logowanie hurtownika',status:'PASS',detail:''},{name:'Zmiana GLS na personal_collection',status:'SKIP',detail:'Metoda niedostępna'},{name:'Zmiana GLS na personal_collection',status:'SKIP',detail:'Metoda niedostępna'}],requests:[]};

test('Kontrakt 204 dotyczy nowych raportów #36926; historyczne zachowują oczekiwanie 201',()=>{
 assert.match(buildReportExplanation({...base,reference:{checkoutSuccessStatus:204}},'redmine-36926').source,/HTTP 204/);
 assert.match(buildReportExplanation({...base},'redmine-36926').source,/HTTP 201/);
});
test('Wyjaśnienie INCOMPLETE liczy rzeczywiste wyniki i grupuje identyczne pominięcia',()=>{
  const g=buildReportExplanation(base,'order-regression');assert.deepEqual(g.counts,{PASS:1,FAIL:0,SKIP:2});assert.equal(g.incompleteReasons.length,1);assert.equal(g.incompleteReasons[0].count,2);assert.match(g.outcome,/pominięta/);
  const html=renderReportExplanation({...base,status:'PASS'},'order-regression');assert.match(html,/mimo pominięć/);assert.match(html,/Metoda niedostępna/);
});
test('Błędna ilość pokazuje plan, oczekiwane statusy i faktyczny błąd 500 bez udawania końca testu',()=>{
  const r={...base,status:'FAIL',reference:{validationStatuses:{quantity:[422]}},tests:[{name:'pozostale: odrzucenie ilości 1.5',status:'FAIL',detail:'Oczekiwano 422, otrzymano 500',evidence:{requests:[{method:'PATCH',endpoint:'/items/1',status:500}],observations:[['Po dodaniu',1,'A',1,0,100,105,0,0,0]]}}]};const g=buildReportExplanation(r,'order-regression');assert.match(g.cases[0].expected,/422/);const html=renderReportExplanation(r,'order-regression');assert.match(html,/HTTP 500/);assert.match(html,/przed końcem planu/);assert.match(html,/Pomiary tego przypadku/);
});
test('Wszystkie trzy formaty mają opis, a aktualizacja historycznych HTML zachowuje bajty JSON i obejmuje raporty podrzędne',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'hurt-guides-'));const reports=[{folder:'feature',writer:saveFeatureReport,report:base},{folder:'catalog',writer:saveCatalogReport,report:{...base,kind:undefined}},{folder:'order/final',writer:saveReport,report:{...base,kind:undefined,tests:undefined,checks:base.tests,products:[],snapshots:[]}}];
  for(const item of reports){const dir=path.join(root,item.folder);await item.writer(item.report,dir);const json=JSON.parse(await readFile(path.join(dir,'raport.json'),'utf8'));assert.equal(json.explanation.version,1);assert.match(await readFile(path.join(dir,'raport.html'),'utf8'),/Raport prostym językiem/);}
  const before=await Promise.all(reports.map(r=>readFile(path.join(root,r.folder,'raport.json'))));const result=await refreshReports(root);assert.equal(result.updated,3);assert.deepEqual(result.errors,[]);for(let i=0;i<reports.length;i++)assert.deepEqual(await readFile(path.join(root,reports[i].folder,'raport.json')),before[i]);
});
test('Opis nie wykonuje HTML z nazw, błędów ani danych referencyjnych',()=>{const html=renderReportExplanation({...base,tests:[{name:'<img src=x onerror=alert(1)>',status:'FAIL',detail:'<script>attack</script>'}]},'catalog');assert(!html.includes('<script>'));assert(!html.includes('<img src=x'));assert(html.includes('&lt;script&gt;'));});

test('Raport rozróżnia brak danych, automatu, dostępu i zależności bez zmieniania SKIP na PASS',()=>{
  const report={...base,tests:['data_missing','not_automated','environment','dependency','out_of_scope'].map(skipReason=>({name:skipReason,status:'SKIP',detail:'Powód',skipReason}))};
  const explanation=buildReportExplanation(report,'descriptions');assert.equal(explanation.skipGroups.length,5);assert.equal(explanation.counts.PASS,0);
  const html=renderReportExplanation(report,'descriptions');for(const text of ['Brak danych testowych','Brak automatu','Ograniczenie środowiska','Niepowodzenie wcześniejszego kroku','Inny zestaw testów'])assert(html.includes(text));
});

test('Raport podaje odnośnik do przypisanego scenariusza i odrzuca niepoprawne identyfikatory',()=>{
  const report={...base,tests:[{name:'Kontrola opisu',status:'PASS',scenarioIds:['DESC-012','<script>bad</script>','x" onclick="bad']}]};
  const explanation=buildReportExplanation(report,'descriptions');assert.deepEqual(explanation.cases[0].scenarioIds,['DESC-012']);
  const html=renderReportExplanation(report,'descriptions');assert.match(html,/scenario=DESC-012#scenarios/);assert(!html.includes('<script>'));
});

test('Raport rozdziela odmowę JWT, trzy stany izolacji i ponowne complete; kod HTML w dowodach jest tekstem',()=>{
 const amounts={rebatePercent:50,itemsTotal:920,total:2920,totalNet:2781};
 const r={...base,status:'FAIL',tests:[{name:'AUTH-003: chroniony koszyk — bez JWT',status:'PASS',evidence:{authentication:{expectedStatuses:[401],actualStatus:401}}},{name:'ISO-006 / A → B',status:'FAIL',evidence:{isolation:{changes:[{field:'rebatePercent',before:50,after:0}]},completionComparison:{before:amounts,afterForeign:{...amounts,rebatePercent:0,total:3840},saved:amounts,status:200,orderNumber:'<script>bad</script>',changes:[],limit:'API'}}},{name:'pozostale: ponowne zatwierdzenie zapisanego zamowienia',status:'PASS',evidence:{repeatComplete:{actualStatus:409,expectedStatuses:[409],numberBefore:'12',numberAfter:'12',changes:[],limit:'Bez e-maila'}}}]};
 const html=renderReportExplanation(r,'order-regression');assert(html.includes('HTTP 401'));assert(html.includes('Podsumowanie a zapis — trzy stany'));assert(html.includes('3840'));assert(html.includes('Drugie complete:'));assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
 const g=buildReportExplanation(r,'order-regression');assert(g.cases[0].expected.includes('HTTP 401'));assert(g.cases[1].expected.includes('nie usuwa'));
});
