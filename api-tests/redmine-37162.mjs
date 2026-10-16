import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {ApiClient} from './http.mjs';
import {saveFeatureReport} from './feature-report.mjs';

const multimedia={productVariant:'m-F8P',quantity:9};
const printed={productVariant:'D414',quantity:5};
export const shipmentCases=[
 {id:'HURT-BUG-37162-01',name:'Oryginalny payload: m-F8P × 9 i D414 × 5 — trzy nowe koszyki',batches:[[multimedia,printed]],repeat:3},
 {id:'HURT-BUG-37162-02',name:'Sam produkt m-F8P × 9',batches:[[multimedia]],repeat:1},
 {id:'HURT-BUG-37162-03',name:'Sam produkt D414 × 5',batches:[[printed]],repeat:1},
 {id:'HURT-BUG-37162-04',name:'Odwrotna kolejność w żądaniu zbiorczym',batches:[[printed,multimedia]],repeat:1},
 {id:'HURT-BUG-37162-05',name:'Dodawanie kolejno: m-F8P, następnie D414',batches:[[multimedia],[printed]],repeat:1},
 {id:'HURT-BUG-37162-06',name:'Dodawanie kolejno: D414, następnie m-F8P',batches:[[printed],[multimedia]],repeat:1},
];
export async function runShipmentRegression(config,credentials,options={}){
 const api=new ApiClient(config,credentials,options);
 const report={kind:'redmine-37162',scenario:'Redmine #37162 — ShipmentInterface: Got NULL',issue:37162,generatedAt:new Date().toISOString(),baseUrl:config.baseUrl,status:'RUNNING',tests:[],requests:api.requests,attempts:[],reference:{cases:shipmentCases},scopeNote:'Osiem nowych koszyków na koncie 1: oryginalny payload powtarzany trzy razy i pięć wariantów. Bez płatności, dostawy, finalizacji i zmian CMS. Koszyki pozostają na DEV. Skończona liczba prób nie wyklucza rzadkiego błędu; 4xx jest niepowodzeniem próby, a nie dowodem usunięcia błędu 500.',tables:[]};
 const directory=options.directory??path.resolve('raporty-api','redmine-37162-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 function verify(response,label,allowed){
  const message=[response.data?.message,response.data?.detail,response.data?.['hydra:description']].filter(Boolean).join(' ');
  if(!allowed.includes(response.status)||Number(response.data?.code)===500||/ShipmentInterface[\s\S]*Got\s*:?\s*NULL/i.test(message))throw new Error(`${label}: HTTP ${response.status}${message?' — '+message:''}`);
 }
 try{
  await api.loginShop();
  for(const scenario of shipmentCases){
   for(let trial=1;trial<=scenario.repeat;trial++){
    options.signal?.throwIfAborted();
    const name=`${scenario.id}: ${scenario.name}${scenario.repeat>1?' — próba '+trial+'/'+scenario.repeat:''}`;
    options.onProgress?.(name);
    const requestStart=api.requests.length;
    const attempt={caseId:scenario.id,trial,status:'RUNNING',input:scenario.batches,operations:[]};report.attempts.push(attempt);
    try{
     const created=await api.request('POST','shop/orders',{body:{localeCode:'pl_PL'}});verify(created,'Utworzenie koszyka',[200,201]);
     const token=created.data?.tokenValue;if(typeof token!=='string'||!token)throw new Error('Brak tokenu nowego koszyka.');
     api.secrets.push(token,encodeURIComponent(token));attempt.cartId=created.data.id;
     const endpoint='shop/orders/'+encodeURIComponent(token),expected=new Map();
     for(const items of scenario.batches){
      const response=await api.request('POST',endpoint+'/items/bulk',{body:{items}});
      attempt.operations.push({input:{items},status:response.status,error:response.status>=400?{code:response.data?.code,message:response.data?.message,detail:response.data?.detail}:null});
      verify(response,'Dodawanie produktów',[200,201,204]);
      for(const item of items)expected.set(item.productVariant,(expected.get(item.productVariant)||0)+item.quantity);
      const read=await api.request('GET',endpoint);verify(read,'Ponowny odczyt koszyka',[200]);
      if(read.data?.tokenValue!==token)throw new Error('Odczytano inny koszyk.');
      const actual=(read.data?.items??[]).map(item=>({productVariant:item.product?.code,quantity:item.quantity}));
      attempt.actual=actual;
      if(actual.length!==expected.size)throw new Error(`Niezgodna liczba pozycji: ${actual.length}, oczekiwano ${expected.size}.`);
      for(const [code,quantity] of expected){const rows=actual.filter(item=>item.productVariant===code);if(rows.length!==1||rows[0].quantity!==quantity)throw new Error(`Nie zapisano dokładnie ${code} × ${quantity}.`);}
     }
     attempt.status='PASS';report.tests.push({id:scenario.id,name,status:'PASS',detail:'Dodawanie bez błędu; niezależny GET potwierdza właściwe produkty i ilości w tym koszyku.'});
    }catch(error){
     attempt.status='FAIL';attempt.error=api.clean(error.message);report.tests.push({id:scenario.id,name,status:'FAIL',detail:attempt.error});
     if(options.signal?.aborted)throw error;
    }finally{
     const result=report.tests.at(-1);if(result?.id===scenario.id)result.evidence={requests:api.requests.slice(requestStart),observations:[]};
    }
   }
  }
 }catch(error){report.error=api.clean(error.message);if(!report.tests.some(t=>t.status==='FAIL'))report.tests.push({name:'Przygotowanie / przerwanie przebiegu',status:'FAIL',detail:report.error});}
 report.status=options.signal?.aborted?'CANCELLED':report.tests.some(t=>t.status==='FAIL')?'FAIL':'PASS';
 report.tables=[{title:'Próby na niezależnych koszykach',headers:['Scenariusz','Próba','Koszyk ID','Wynik','Odczytane produkty i ilości','Błąd'],rows:report.attempts.map(a=>[a.caseId,a.trial,a.cartId??'—',a.status,JSON.stringify(a.actual??[]),a.error??''])}];
 const safe=api.clean(report);await saveFeatureReport(safe,directory);return {report:safe,directory};
}
