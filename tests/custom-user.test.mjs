import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {saveCustomEmail,validateCustomEmail} from '../dashboard/custom-user.mjs';
import {cmsBrowserLaunchError,parseRebateFields} from '../api-tests/wholesaler-cms.mjs';
import {checkoutForAccount} from '../dashboard/checkout-account.mjs';

test('Zapis użytkownika zmienia wyłącznie e-mail zdefiniowany, zachowując hasła, komentarze i pozostałe konta',async()=>{
  const file=path.join(await mkdtemp(path.join(os.tmpdir(),'hurt-email-')),'.env');
  const existing='# konfiguracja\r\nHURT_EMAIL=first@example.org\r\nHURT_API_PASSWORD="a#b=c"\r\nHURT_SECOND_EMAIL=second@example.org\r\nHURT_CUSTOM_EMAIL=old@example.org\r\n';
  await writeFile(file,existing);await saveCustomEmail(' new@example.org ',file);
  assert.equal(await readFile(file,'utf8'),existing.replace('old@example.org','new@example.org'));
  for(const email of ['bad','new@example.org\nHURT_API_PASSWORD=changed','x@example.org"','x..x@example.org'])await assert.rejects(()=>saveCustomEmail(email,file));
  assert.equal(await readFile(file,'utf8'),existing.replace('old@example.org','new@example.org'));
  assert.equal(validateCustomEmail('a+b@example.org'),'a+b@example.org');
});
test('CMS wymaga pełnego niezależnego zestawu rabatów, włącznie z 0 i ułamkiem procenta',()=>{
  const rebates={bank_transfer:47,cash_on_delivery:13,bank_transfer_1_day:30.5,payment_timely:0,WHOLESALE_ADAMADA:20};
  const fields=Object.entries(rebates).map(([k,v])=>({id:'promotions_promotionList_wholesaler_195_'+k+'_value',value:String(v).replace('.',',')}));
  assert.deepEqual(parseRebateFields(fields,195),{bank_transfer:47,cash_on_delivery:13,bank_transfer_1_day:30.5,payment_timely:0,adamada:20});
  assert.throws(()=>parseRebateFields(fields.slice(1),195));assert.throws(()=>parseRebateFields([{...fields[0],value:'101'},...fields.slice(1)],195));assert.throws(()=>parseRebateFields([{...fields[0],value:''},...fields.slice(1)],195));
});
test('Użytkownik zdefiniowany używa wspólnego hasła i wzorca z CMS zamiast rabatów konta 1',()=>{
  const primary={email:'first@example.org',password:'shared-password',testsToken:'shared-tests'};
  const config={scenario:{name:'Koszyk',expectations:{groupRebatePercent:{adamada:10},afterPayment:{total:100}}}};
  const profile={id:195,uid:'123',source:'CMS',rebates:{adamada:20,cash_on_delivery:13}};
  const result=checkoutForAccount(config,primary,{HURT_CUSTOM_EMAIL:'custom@example.org'},'custom',{},profile);
  assert.equal(result.credentials.email,'custom@example.org');assert.equal(result.credentials.password,primary.password);assert.equal(result.config.scenario.expectations.groupRebatePercent.adamada,20);assert.deepEqual(result.config.scenario.expectations.afterPayment,{});assert.equal(result.config.scenario.account.rebateReference.uid,'123');assert.equal(config.scenario.expectations.groupRebatePercent.adamada,10);
  assert.throws(()=>checkoutForAccount(config,primary,{HURT_CUSTOM_EMAIL:'custom@example.org'},'custom'),/CMS/);
});


test('Blokada procesu przeglądarki daje zrozumiały komunikat, inne błędy zachowują znaczenie',()=>{
  const original=new Error('browserType.launch: spawn EPERM; Call log: private profile path');
  const error=cmsBrowserLaunchError(original);
  assert.equal(error.code,'CMS_BROWSER_BLOCKED');assert.equal(error.cause,original);
  assert.match(error.message,/Panel-testow.cmd/);assert.match(error.message,/jeszcze się nie rozpoczął/);
  assert(!error.message.includes('private profile path'));
  const other=new Error('Browser executable does not exist');assert.equal(cmsBrowserLaunchError(other),other);
});
