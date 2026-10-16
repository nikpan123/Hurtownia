import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {runCatalog} from '../api-tests/catalog.mjs';

const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:11111/api/v2',catalog:{channels:['WHOLESALE'],pageSize:2,maxPages:10,maxProducts:20,strictInvalidParameters:true}};
const credentials={email:'qa@example.invalid',password:'private-password-mock',testsToken:'private-tests-token-mock'};
const rows=[
  {id:1,code:'one',name:'Alfa żółć',slug:'alfa',price:1000,originalPrice:1000,author:'QA Author',isbnNumber:'9780000000019',subjects:['math'],levels:['primary'],publicationType:['book'],outOfStock:false,stockAvailable:true,availableForSale:true},
  {id:2,code:'two',name:'Beta',slug:'beta',price:2000,originalPrice:2000,author:null,isbnNumber:null,subjects:[],levels:[],publicationType:[],outOfStock:false,stockAvailable:true,availableForSale:true},
  {id:3,code:'three',name:'Gamma',slug:'gamma',price:3000,originalPrice:3000,author:null,isbnNumber:null,subjects:[],levels:[],publicationType:[],outOfStock:false,stockAvailable:true,availableForSale:true}
];
function mock({badDetail=false,ignoreSort=false,brokenShape=false}={}) {
  const requests=[];
  const fetchImpl=async(url,options)=>{
    url=new URL(url);requests.push({path:url.pathname,method:options.method});
    const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(url.pathname.endsWith('/authentication-token'))return response({token:'private-jwt-mock'});
    if(url.pathname.endsWith('/admin/products')&&options.method==='POST')return response({message:'Access Denied.'},403);
    if(!options.headers['X-Api-Channel']||options.headers['X-Api-Channel']==='QA_INVALID')return response({message:'Bad channel'},400);
    if(url.pathname.includes('/products-dto-by-slug/')) {
      const slug=decodeURIComponent(url.pathname.split('/').at(-1));const p=rows.find(p=>p.slug===slug);
      if(!p)return response({message:'Not found'},404);
      return response({...p,price:p.price+(badDetail?1:0),description:'Opis QA',shortDescription:'Krótki QA',type:'BOOK'});
    }
    if(brokenShape)return response({data:'broken',pagination:{}});
    const q=url.searchParams;const page=Number(q.get('page')??1),limit=Number(q.get('limit')??10);
    if(!Number.isInteger(page)||!Number.isInteger(limit)||page<1||limit<1||q.get('sort')==='qa_invalid'||q.get('order_by')==='qa_invalid')return response({message:'Bad query'},400);
    let result=[...rows];
    if(q.has('name'))result=result.filter(p=>[p.name,p.author,p.isbnNumber].some(v=>v?.includes(q.get('name'))));
    for(const key of ['publication_type[]','subjects[]','primary_school[]','high_school[]','taxons[]'])if(q.has(key)) {
      const value=q.get(key);result=result.filter(p=>p.code==='one'&&value==={ 'publication_type[]':'book','subjects[]':'math','primary_school[]':'4','high_school[]':'1','taxons[]':'test'}[key]);
    }
    if(q.get('sort')==='desc'&&!ignoreSort)result.reverse();
    const total=result.length;return response({data:result.slice((page-1)*limit,page*limit),pagination:{current:page,perPage:limit,totalItems:total,last:Math.max(1,Math.ceil(total/limit))}});
  };return {requests,fetchImpl};
}
const fixtures={products:[{code:'one',slug:'alfa',channels:{WHOLESALE:{visible:true,name:'Alfa żółć',slug:'alfa',price:1000,originalPrice:1000,description:'Opis QA',shortDescription:'Krótki QA'}}}],filters:Object.entries({'publication_type[]':'book','subjects[]':'math','primary_school[]':'4','high_school[]':'1','taxons[]':'test'}).map(([key,value])=>({name:key,query:{[key]:[value]},expectedCodes:['one']}))};
async function exercise(options={},extra={}) {
  const m=mock(options);const directory=await mkdtemp(path.join(os.tmpdir(),'hurt-catalog-'));
  const result=await runCatalog(config,credentials,{...m,allowLocal:true,directory,fixtures,...extra});return {...result,...m};
}
test('Katalog: paginacja, sortowanie, filtry, wyszukiwanie i slug przechodzą na kontrolowanych danych',async()=>{
  const r=await exercise();assert.equal(r.report.status,'PASS',JSON.stringify(r.report.tests.filter(t=>t.status==='FAIL')));
  assert(r.report.tests.length>30);
  const saved=await readFile(path.join(r.directory,'raport.json'),'utf8');
  for(const secret of [...Object.values(credentials),'private-jwt-mock'])assert(!saved.includes(secret));
});
test('Niezgodność listy i szczegółów jest wykrywana bez zatrzymania pozostałych testów',async()=>{
  const r=await exercise({badDetail:true});assert.equal(r.report.status,'FAIL');
  assert(r.report.tests.some(t=>t.name.includes('lista i szczegóły')&&t.status==='FAIL'));
  assert(r.report.tests.some(t=>t.name.includes('Nieprawidłowy kanał')&&t.status==='PASS'));
});
test('Ignorowanie sortowania i uszkodzony kontrakt nie dają PASS',async()=>{
  for(const opt of [{ignoreSort:true},{brokenShape:true}])assert.equal((await exercise(opt)).report.status,'FAIL');
});
test('Brak uprawnień do tworzenia jest osobnym błędem, testy odczytu dalej działają',async()=>{
  const r=await exercise({}, {create:true,adminEmail:'admin@example.invalid',adminPassword:'private-admin-pass'});
  assert.equal(r.report.creation.httpStatus,403);assert.equal(r.report.creation.state,'creation_rejected');
  assert(r.report.tests.some(t=>t.name.includes('wszystkie strony')&&t.status==='PASS'));
  assert(!JSON.stringify(r.report).includes('private-admin-pass'));
});
