import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confirmCarrierManually,describeManualVerifications} from '../api-tests/address-manual-evidence.mjs';
test('Ręczne carrierName jest opisane jako historyczny PASS, wyłącznie dla potwierdzonego DEV',()=>{
 const attempt={};assert(confirmCarrierManually(attempt,{environment:'dev',baseUrl:'https://ksiegarnia.gwodev.pl/api/v2'}));assert.equal(attempt.status,'PASS');assert.equal(attempt.verification.mode,'manual-reference');assert.match(attempt.reason,/19.10.2026/);assert.match(attempt.reason,/nie został ponownie odczytany/);
 for(const config of [{environment:'test',baseUrl:'https://ksiegarnia.gwodev.pl/api/v2'},{environment:'dev',baseUrl:'https://other.invalid/api/v2'}])assert.equal(confirmCarrierManually({},config),false);
 const report={scopeNote:'Zakres.',tables:[],tests:[{id:'HURT-36926-06',status:'PASS',verification:attempt.verification},{id:'other',status:'PASS'}]};describeManualVerifications(report);assert.match(report.scopeNote,/1 PASS.*historycznego/);assert.equal(report.tables[0].rows[0][1],'2026-10-19');
});
