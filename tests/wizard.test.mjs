import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {ChoiceGate,validateSelection,availableProducts} from '../dashboard/wizard.mjs';
import {runScenario} from '../api-tests/engine.mjs';
import {startMock} from './mock-server.mjs';

test('Dostępność rozpoznaje kod wariantu i handlowy, pomija niedostępne oraz wyłączone produkty',()=>{
  const catalog=[{productVariant:'12',merchandiseCode:'12a',group:'pozostale'},{productVariant:'x',enabled:false},{productVariant:'y'}];
  const dto={code:'12',availableForSale:true,outOfStock:false,name:'Książka',price:100};
  assert.equal(availableProducts(catalog,[dto,{...dto,code:'x'},{...dto,code:'y',outOfStock:true}]).length,1);
  assert.equal(availableProducts(catalog,[{...dto,code:'12a'}])[0].productVariant,'12');
});

test('Formularz blokuje mieszanie grup, nieznane produkty, duplikaty i błędne ilości',()=>{
  const catalog=[{productVariant:'a',group:'adamada'},{productVariant:'b',group:'pozostale'}];
  assert.equal(validateSelection([{productVariant:'a',quantity:2}],catalog)[0].group,'adamada');
  for(const items of [[],[{productVariant:'x',quantity:1}],[{productVariant:'a',quantity:0}],[{productVariant:'a',quantity:11}],[{productVariant:'a',quantity:1},{productVariant:'a',quantity:1}],[{productVariant:'a',quantity:1},{productVariant:'b',quantity:1}]])assert.throws(()=>validateSelection(items,catalog));
});
test('Etap przyjmuje tylko bieżącą opcję, odrzuca ponowienie i reaguje na zatrzymanie',async()=>{
  const controller=new AbortController();const job={};const gate=new ChoiceGate(job,controller.signal);
  const waiting=gate.wait('payment',{options:[{code:'cash'}]});const id=job.wizard.requestId;
  assert.throws(()=>gate.submit(id,'other'));gate.submit(id,'cash');assert.equal(await waiting,'cash');assert.throws(()=>gate.submit(id,'cash'));
  const review=gate.wait('review',{});assert.throws(()=>gate.submit(job.wizard.requestId,'yes'));
  controller.abort();await assert.rejects(review,/zatrzymany/);assert.equal(job.wizard,null);
});
test('Zamówienie czeka na każdy wybór, nie ujawnia tokenu i wykonuje complete tylko po zatwierdzeniu',async()=>{
  const mock=await startMock();
  try{
    const config=JSON.parse(await readFile('config/dev.example.json','utf8'));config.baseUrl=mock.baseUrl;
    config.scenario.randomProducts={enabled:false};config.scenario.randomCheckout={payment:true,shipping:true};config.scenario.expectations={paymentQuoteTotalBasis:'gross'};
    const directory=await mkdtemp(path.join(os.tmpdir(),'hurt-wizard-'));let release;let entered;
    const reviewEntered=new Promise(resolve=>entered=resolve);const approval=new Promise(resolve=>release=resolve);const steps=[];
    const running=runScenario(config,{email:'qa@example.invalid',password:'mock-password',testsToken:'mock-tests-token'},{allowLocal:true,complete:true,directory,
      choosePayment:async p=>{steps.push('payment');assert(!('tokenValue' in p.order));assert(p.options.some(o=>o.code==='cash_on_delivery'));return 'cash_on_delivery';},
      chooseShipping:async p=>{steps.push('shipping');assert(mock.requests.some(r=>r.url.endsWith('/payment-method')));return 'inpost_kurier';},
      beforeComplete:async p=>{steps.push('review');assert.equal(p.order.paymentCode,'cash_on_delivery');entered();await approval;}
    });
    await reviewEntered;assert.deepEqual(steps,['payment','shipping','review']);assert.equal(mock.requests.filter(r=>r.url.endsWith('/complete')).length,0);
    release();const result=await running;assert.equal(result.report.status,'PASS',result.report.error);assert.equal(result.report.checkoutSelection.paymentMode,'manual');assert.equal(mock.requests.filter(r=>r.url.endsWith('/complete')).length,1);
  }finally{await mock.close();}
});
