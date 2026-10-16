import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAvailableMethod } from '../api-tests/checkout.mjs';

test('Losowanie wybiera tylko dostępne metody i obejmuje całą pulę',()=>{
  const methods=[{code:'cash'},{code:'transfer'},{code:'timely'}];
  const seen=new Set();
  for(let n=0;n<500;n++) {
    const method=pickAvailableMethod(methods,'seed-'+n,'payment');
    assert(methods.includes(method));seen.add(method.code);
  }
  assert.equal(seen.size,3);
});
test('Ziarno odtwarza wybór niezależnie od kolejności listy API',()=>{
  const methods=[{code:'cash'},{code:'transfer'},{code:'timely'}];
  assert.equal(pickAvailableMethod(methods,'replay','payment').code,pickAvailableMethod([...methods].reverse(),'replay','payment').code);
  assert.equal(pickAvailableMethod([{code:'only'}],'replay','shipping').code,'only');
});
test('Brak metod i niepoprawne kody kończą się błędem, bez wyboru zastępczego',()=>{
  for(const list of [[],null,[{code:''}],[{code:'x'},{code:'x'}]]) assert.throws(()=>pickAvailableMethod(list,'seed','shipping'));
});
