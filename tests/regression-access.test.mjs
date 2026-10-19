import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRepeatedCompletion,accessSnapshot,accessDifferences,hasReadableAddresses} from '../api-tests/regression-access.mjs';

const order={id:12,number:'30000012',state:'new',itemsTotal:920,total:2920,totalNet:2781,shippingTotal:2000,items:[{id:1,quantity:1,total:920,rebatePercent:50}],shippingAddress:{id:1,city:'private-city',street:'private-street'},billingAddress:{city:'private-billing'}};
test('Ponowne complete dopuszcza bezpieczny sukces lub odmowę i porównuje ten sam zapis',async()=>{
  for(const status of [200,204,400,409,422]){
    let calls=0,reads=0;const api={request:async()=>{calls++;return {status,data:{id:12,number:'30000012'}};}};
    const result=await checkRepeatedCompletion({api,cart:{path:'shop/orders/token'},get:async()=>{reads++;return structuredClone(order);}});
    assert.equal(calls,1);assert.equal(reads,2);assert.equal(result.repeatComplete.changes.length,0);
  }
});
test('Ponowne complete wykrywa zmianę zapisu, odpowiedź o innym zamówieniu i HTTP 500',async()=>{
  for(const mode of ['mutation','identity','server']){
    let reads=0;const api={request:async()=>({status:mode==='server'?500:200,data:{id:mode==='identity'?13:12}})};
    await assert.rejects(()=>checkRepeatedCompletion({api,cart:{path:'shop/orders/token'},get:async()=>({...order,total:++reads===2&&mode==='mutation'?9999:2920})}),e=>{assert(e.evidence.repeatComplete);return true;});
  }
});
test('Timeout ponownego complete powoduje odczyt, bez kolejnego PATCH; brak numeru blokuje próbę',async()=>{
  let writes=0,reads=0;const api={request:async()=>{writes++;throw Error('timeout');}};
  await assert.rejects(()=>checkRepeatedCompletion({api,cart:{path:'shop/orders/token'},get:async()=>{reads++;return order;}}));assert.equal(writes,1);assert.equal(reads,2);
  await assert.rejects(()=>checkRepeatedCompletion({api,cart:{path:'shop/orders/token'},get:async()=>({...order,number:null})}),/Brak numeru/);assert.equal(writes,1);
});
test('Izolacja adresów wykrywa zmianę treści, ignoruje techniczne ID i nie raportuje danych osobowych',()=>{
  assert(hasReadableAddresses(order));assert(!hasReadableAddresses({...order,shippingAddress:'/api/addresses/1'}));assert(!hasReadableAddresses({...order,billingAddress:{id:1}}));
  const before=accessSnapshot(order),same=accessSnapshot({...order,shippingAddress:{...order.shippingAddress,id:99}});
  assert.deepEqual(accessDifferences(before,same),[]);
  const differences=accessDifferences(before,accessSnapshot({...order,shippingAddress:{city:'private-foreign',street:'private-street'}}));
  assert(differences.some(d=>d.field==='shippingAddress.city'));assert(!JSON.stringify(differences).includes('private-'));
});
