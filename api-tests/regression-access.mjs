import assert from 'node:assert/strict';
import {normalizeOrder} from './engine.mjs';

export function orderDifferences(before,after){
  const changes=[];
  function visit(a,b,field){
    if(field==='tokenValue')return;
    if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)]))visit(a[key],b[key],field?field+'.'+key:key);
    else if(!Object.is(a,b))changes.push({field,before:a??null,after:b??null});
  }
  visit(before,after,'');return changes;
}

// Adresy są porównywane w pamięci. W raporcie zapisujemy nazwy zmienionych pól,
// nie wartości danych osobowych ani identyfikatory adresów.
export function accessSnapshot(order){
  const address=value=>typeof value==='string'?{reference:value}:Object.fromEntries(Object.entries(value??{}).filter(([key])=>!['@id','@type','id','createdAt','updatedAt'].includes(key)));
  return {...normalizeOrder(order),shippingAddress:address(order.shippingAddress),billingAddress:address(order.billingAddress)};
}
export function hasReadableAddresses(order){
  return ['shippingAddress','billingAddress'].every(key=>order[key]&&typeof order[key]==='object'&&!Array.isArray(order[key])&&['city','street','postcode'].some(field=>Object.hasOwn(order[key],field)));
}
export function accessDifferences(before,after){
  return orderDifferences(before,after).map(d=>/^(shippingAddress|billingAddress)\./.test(d.field)?{field:d.field,before:'[dane adresowe]',after:'[zmienione dane adresowe]'}:d);
}
function returnedToken(data){
  return typeof data==='string'?data:data?.token??data?.accessToken??data?.bearerToken??data?.jwt??data?.data?.token;
}
export async function checkDeniedAuthentication({api,create,get,test}){
  await test('AUTH-002: logowanie z błędnym hasłem API',async()=>{
    const password='qa-invalid-'+crypto.randomUUID();api.secrets.push(password);
    const r=await api.request('POST','shop/authentication-token',{token:null,body:{email:api.credentials.email,apiPassword:password}});
    const issued=returnedToken(r.data);if(typeof issued==='string')api.secrets.push(issued);
    assert.equal(r.status,401,'Błędne hasło: oczekiwano HTTP 401, otrzymano '+r.status);
    assert(!issued,'Błędne hasło zwróciło token dostępu');
    return {authentication:{expectedStatuses:[401],actualStatus:r.status,tokenIssued:!!issued}};
  });
  for(const variant of ['bez JWT','błędny JWT'])for(const target of ['koszyk','płatności','dostawy'])await test('AUTH-003: chroniony '+target+' — '+variant,async()=>{
    const cart=await create();const endpoint=target==='koszyk'?cart.path:target==='płatności'?cart.wholesale+'/payments':cart.checkout;
    assert.equal((await api.request('GET',endpoint)).status,200,'Właściciel nie może odczytać endpointu referencyjnego');
    const before=accessSnapshot(await get(cart));
    const invalid='qa-invalid-jwt-'+crypto.randomUUID();api.secrets.push(invalid);
    const r=await api.request('GET',endpoint,{token:null,headers:variant==='bez JWT'?{}:{Authorization:'Bearer '+invalid}});
    const after=accessSnapshot(await get(cart));const changes=accessDifferences(before,after);
    const evidence={cartId:before.id,authentication:{variant,target,expectedStatuses:[401],actualStatus:r.status,changes}};
    if(r.status!==401||changes.length)throw Object.assign(new Error('Dostęp '+variant+': oczekiwano 401 i niezmienionego koszyka; HTTP '+r.status+', zmian: '+changes.length),{evidence});
    assert(!Array.isArray(r.data)&&!r.data?.items&&!r.data?.tokenValue&&!r.data?.shippingMethods,'Odmowa uwierzytelnienia ujawniła dane koszyka lub metod');
    return evidence;
  });
}

export async function checkRepeatedCompletion({api,cart,get,statuses=[200,204,400,409,422]}){
  assert(Array.isArray(statuses)&&statuses.length&&statuses.every(s=>[200,204,400,404,409,422].includes(s)),'Nieprawidłowe statusy ponownego complete');
  const before=accessSnapshot(await get(cart));assert(before.number,'Brak numeru potwierdzonego zamówienia — nie ponawiamy complete');
  assert.notEqual(before.state,'cart','Zamówienie nadal jest koszykiem — nie ponawiamy complete');
  let response,error;
  try{response=await api.request('PATCH',cart.path+'/complete',{body:{}});}catch(e){error=e;}
  // Po utracie odpowiedzi odczytujemy stan. Nie wykonujemy trzeciej próby PATCH.
  const after=accessSnapshot(await get(cart)),changes=accessDifferences(before,after);
  if(response&&[200,204].includes(response.status))for(const key of ['id','number'])if(response.data?.[key]!==undefined&&response.data[key]!==before[key])changes.push({field:'response.'+key,before:before[key],after:response.data[key]});
  const evidence={cartId:before.id,repeatComplete:{expectedStatuses:statuses,actualStatus:response?.status??'NETWORK_ERROR',changes,numberBefore:before.number,numberAfter:after.number,limit:'Odczyt tego samego zamówienia nie potwierdza liczby e-maili ani braku dodatkowego rekordu w transferze.'}};
  if(error||!statuses.includes(response.status)||changes.length)throw Object.assign(new Error('Ponowne complete: '+(error?'utrata odpowiedzi; nie ponowiono żądania':('HTTP '+response.status))+'; zmiany zamówienia: '+changes.length),{evidence});
  return evidence;
}
