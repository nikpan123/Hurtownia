import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountSummaries} from '../dashboard/account-summary.mjs';

test('Podgląd kont udostępnia wyłącznie adres i właściwe źródło rabatów, bez danych logowania',()=>{
  const credentials={email:'first@example.org',password:'private-password',testsToken:'private-token',cookies:[{value:'private-cookie'}]};
  const vars={HURT_SECOND_EMAIL:'second@example.org',HURT_SECOND_API_PASSWORD:'private-other',HURT_SECOND_REBATE_BANK_TRANSFER:'30,5',HURT_CUSTOM_EMAIL:'third@example.org'};
  const rows=accountSummaries({scenario:{expectations:{groupRebatePercent:{adamada:10}}}},credentials,vars,{paymentRebates:{cash_on_delivery:50}},{email:'old@example.org',profile:{rebates:{adamada:99}}});
  assert.equal(rows[0].email,credentials.email);assert.equal(rows[0].rebates.cash_on_delivery,50);assert.equal(rows[0].rebates.adamada,10);
  assert.equal(rows[1].rebates.bank_transfer,30.5);assert.deepEqual(rows[2].rebates,{});
  for(const secret of ['private-password','private-token','private-cookie','private-other'])assert(!JSON.stringify(rows).includes(secret));
  const profile=accountSummaries({},credentials,vars,{}, {email:'third@example.org',profile:{rebates:{adamada:0,bank_transfer:130},readAt:'now'}})[2];
  assert.deepEqual(profile.rebates,{adamada:0});assert.equal(profile.readAt,'now');assert.match(profile.source,/Syliusa/);
});
