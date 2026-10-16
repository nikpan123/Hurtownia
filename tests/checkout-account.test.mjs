import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkoutForAccount} from '../dashboard/checkout-account.mjs';
const config={scenario:{name:'Test',expectations:{groupRebatePercent:{adamada:10},afterPayment:{total:123},paymentQuoteTotalBasis:'net',availablePaymentCodes:['old']},forbiddenPaymentCodes:['old']}};
const primary={email:'a',password:'a-password',testsToken:'shared',cookie:'gate'};
const vars={HURT_SECOND_EMAIL:'b',HURT_SECOND_API_PASSWORD:'b-password',HURT_SECOND_REBATE_ADAMADA:'20',HURT_SECOND_REBATE_CASH_ON_DELIVERY:'13',HURT_SECOND_REBATE_BANK_TRANSFER_1_DAY:'30.5'};
test('Wybrane konto ma własne dane i wzorce bez zmiany konfiguracji konta 1',()=>{
  const original=structuredClone(config),second=checkoutForAccount(config,primary,vars,'secondary');
  assert.equal(second.credentials.email,'b');assert.equal(second.credentials.cookie,'gate');assert.equal(second.config.scenario.expectations.groupRebatePercent.adamada,20);assert.equal(second.config.scenario.expectations.paymentRebatePercentByCode.bank_transfer_1_day,30.5);assert.deepEqual(second.config.scenario.expectations.afterPayment,{});assert.equal(second.config.scenario.expectations.paymentQuoteTotalBasis,'net');assert.deepEqual(config,original);
  const first=checkoutForAccount(config,primary,vars,'primary',{cash_on_delivery:50});assert.equal(first.credentials.email,'a');assert.equal(first.config.scenario.expectations.groupRebatePercent.adamada,10);assert.deepEqual(first.config.scenario.expectations.afterPayment,{total:123});
});
test('Nieznane konto i brak danych nie powodują cichego użycia konta 1',()=>{
  assert.throws(()=>checkoutForAccount(config,primary,vars,'admin'));
  assert.throws(()=>checkoutForAccount(config,primary,{},'secondary'),/dane/);
  assert.throws(()=>checkoutForAccount(config,primary,{...vars,HURT_SECOND_REBATE_ADAMADA:'abc'},'secondary'),/rabat/);
});
