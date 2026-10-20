import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDescriptionFollowups} from '../api-tests/description-followups.mjs';
test('Mapa SKIP oddziela aktualny wynik od historycznego dowodu i linkuje właściwy scenariusz',()=>{
 const report={tests:[{status:'SKIP',scenarioIds:['DESC-010']},{status:'SKIP',scenarioIds:['DESC-010']}]},catalog={actions:{create:{label:'Nowy produkt',note:'Tworzy QA'}},cases:[{id:'DESC-010',title:'Nowy produkt',automation:{actions:['create'],limits:'Zakres QA'},historicalEvidence:{reportId:'descriptions-2026-10-20T08-03-32-948Z-fdc1cc88',status:'PASS',note:'4 kontrole'}}]};
 const html=renderDescriptionFollowups(report,catalog);assert(html.includes('Nie dopisuje wyników'));assert(html.includes('/?scenario=DESC-010#scenarios'));assert(html.includes('Osobny zapisany przebieg — PASS'));assert.equal((html.match(/<tr><td>/g)??[]).length,1);assert.equal(report.tests[0].status,'SKIP');assert.equal(renderDescriptionFollowups({tests:[{status:'PASS',scenarioIds:['DESC-010']}]},catalog),'');
});
