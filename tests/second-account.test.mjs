import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../api-tests/http.mjs';
import {checkSecondAccount,secondAccountFromEnv} from '../api-tests/second-account.mjs';

test('Drugie konto ma oddzielne dane, wspólną bramkę i niezależne rabaty',()=>{
  assert.equal(secondAccountFromEnv({},{}),undefined);
  const result=secondAccountFromEnv({HURT_SECOND_EMAIL:'b',HURT_SECOND_API_PASSWORD:'secret-b',HURT_SECOND_REBATE_ADAMADA:'12,5',HURT_SECOND_REBATE_CASH_ON_DELIVERY:'0'},{email:'a',password:'secret-a',testsToken:'tests',cookies:[{value:'gate'}]});
  assert.equal(result.credentials.testsToken,'tests');assert.equal(result.credentials.email,'b');assert.equal(result.rebates.adamada,12.5);assert.equal(result.rebates.cash_on_delivery,0);
});
async function exercise({allowForeign=false,badRebate=false,unauthorized=false,foreignMutation=false}={}){
  let serial=0;const carts=new Map(),checks=[],calls=[];
  const config={baseUrl:'http://127.0.0.1:11111/api/v2',environment:'dev',enabled:true,scenario:{shippingAddress:{city:'Test'},billingAddress:{city:'Test'}}};
  const fetchImpl=async(url,opts)=>{
    const endpoint=new URL(url).pathname.replace('/api/v2/','');const body=opts.body?JSON.parse(opts.body):{};const actor=opts.headers.Authorization?.replace('Bearer ','');calls.push({endpoint,method:opts.method,actor});const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(endpoint==='shop/authentication-token')return response({token:'token-'+body.email});
    if(endpoint==='shop/orders'){const token='cart-'+(++serial);carts.set(token,{id:serial,owner:actor,tokenValue:token,items:[],payments:[],shipments:[]});return response({id:serial,tokenValue:token},201);}
    const token=endpoint.split('/')[2],c=carts.get(token);assert(c);
    if(c.owner!==actor&&!allowForeign){if(foreignMutation&&endpoint.endsWith('/payments'))for(const item of c.items)item.rebatePercent=99;return response({message:'blocked'},unauthorized?401:403);}
    if(endpoint.endsWith('/payments'))return response([{code:'cash_on_delivery',rebatePercent:badRebate?99:20}]);
    if(endpoint.endsWith('/payment-method')){c.payments=[{method:{code:body.paymentMethodCode}}];for(const i of c.items)i.rebatePercent=20;return response({});}
    if(endpoint.startsWith('wholesale/checkout-step-two/'))return response({shippingMethods:[{code:'pickup'}]});
    if(endpoint.endsWith('/items/bulk')){for(const item of body.items){const found=c.items.find(i=>i.product.code===item.productVariant);if(found)found.quantity+=item.quantity;else c.items.push({id:1,product:{code:item.productVariant},quantity:item.quantity,rebatePercent:0});}return response({},201);}
    if(endpoint.includes('/items/')){if(opts.method==='DELETE')c.items=[];else c.items[0].quantity=body.quantity;return response({});}
    return response(c);
  };
  const primary=new ApiClient(config,{email:'a',password:'password-a',testsToken:'tests'},{allowLocal:true,fetchImpl});await primary.loginShop();
  await checkSecondAccount({config,primary,secondary:secondAccountFromEnv({HURT_SECOND_EMAIL:'b',HURT_SECOND_API_PASSWORD:'password-b',HURT_SECOND_REBATE_CASH_ON_DELIVERY:'20',HURT_SECOND_REBATE_ADAMADA:'20'},primary.credentials),settings:{groups:{pozostale:[{productVariant:'p1'}],adamada:[{productVariant:'a1'}]}},options:{allowLocal:true,fetchImpl},skip:(name,detail)=>checks.push({name,detail,status:'SKIP'}),test:async(name,fn)=>{try{const evidence=await fn();checks.push({name,status:'PASS',evidence});return true;}catch(error){checks.push({name,status:'FAIL',detail:error.message,evidence:error.evidence});return false;}}});
  assert(!calls.some(c=>c.endpoint.endsWith('/complete')));assert(!JSON.stringify(primary.clean({requests:primary.requests,secret:'password-b token-b'})).includes('password-b'));
  return checks;
}
test('Oba kierunki izolacji przechodzą tylko dla 403/404 i niezmienionego koszyka',async()=>{
  const checks=await exercise();assert.equal(checks.filter(c=>c.status==='FAIL').length,0,JSON.stringify(checks));assert.equal(checks.filter(c=>c.name.startsWith('Izolacja')).length,18);
  for(const mode of [{allowForeign:true},{unauthorized:true}]){const failed=await exercise(mode);assert(failed.some(c=>c.name.includes('cudzy odczyt koszyka')&&c.status==='FAIL'));}
});
test('Inny niż skonfigurowany rabat drugiego konta daje FAIL',async()=>{const checks=await exercise({badRebate:true});assert(checks.some(c=>c.name.includes('oferty i rabaty')&&c.status==='FAIL'));});


test('Izolacja tworzy nowy koszyk dla każdej obcej operacji; zmiana podczas GET payments nie zanieczyszcza dalszych prób',async()=>{
  const checks=await exercise({foreignMutation:true});
  const foreign=checks.filter(c=>c.name.includes(': cudzy '));assert.equal(foreign.length,16);
  assert.equal(new Set(foreign.map(c=>c.evidence.cartId)).size,16);
  const failures=foreign.filter(c=>c.status==='FAIL');assert.equal(failures.length,2);
  assert(failures.every(c=>c.name.includes('odczyt płatności')));
  assert(failures.every(c=>c.evidence.isolation.freshCart&&c.evidence.isolation.status===403&&c.evidence.isolation.changes.some(d=>d.field==='items.0.rebatePercent'&&d.before===20&&d.after===99)));
});
