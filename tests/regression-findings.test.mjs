import {test} from 'node:test';
import assert from 'node:assert/strict';
import {regressionFindings,renderRegressionFindings} from '../api-tests/regression-findings.mjs';

test('Raport regresji grupuje 500 i wskazuje historyczny skutek wspólnego koszyka bez zmiany wyników',()=>{
  const report={kind:'order-regression',tests:[...['adamada','pozostale'].map(g=>({name:g+': odrzucenie ilości 1.5',status:'FAIL',detail:'Oczekiwano 422, otrzymano 500',evidence:{requests:[{method:'PATCH',endpoint:'/items/1',status:500}]}})),{name:'Izolacja A → B: cudzy odczyt płatności',status:'FAIL',detail:'Obce żądanie zmieniło koszyk właściciela'}]};
  const before=JSON.stringify(report),groups=regressionFindings(report);assert.equal(groups.length,2);assert.equal(groups[0].cases.length,2);
  const html=renderRegressionFindings(report);assert.match(html,/HTTP 500 dla nieprawidłowej ilości/);assert.match(html,/wspólnego koszyka/);assert.match(html,/wymagający poprawy backendu/);assert.equal(JSON.stringify(report),before);
  assert.equal(renderRegressionFindings({kind:'rounding'}),'');
});
test('Nowe dowody izolacji pokazują konkretną zmianę i nie wykonują HTML z API',()=>{
  const html=renderRegressionFindings({kind:'order-regression',tests:[{name:'Izolacja A → B: cudzy odczyt',status:'FAIL',evidence:{isolation:{freshCart:true,status:404,changes:[{field:'items.0.rebatePercent',before:50,after:13},{field:'<script>x</script>',before:0,after:1}]}}}]});
  assert.match(html,/50% → 13%/);assert.match(html,/osobny: tak/);assert(!html.includes('<script>'));assert(!html.includes('wspólnego koszyka'));
});
