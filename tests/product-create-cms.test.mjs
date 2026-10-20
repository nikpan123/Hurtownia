import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {cmsProductPreview,runCmsProductCreation} from '../api-tests/product-create-cms.mjs';
const input={code:'qa-cms-test',variantCode:'qa-handlowy-test',name:'Książka QA',slug:'qa-inny-slug',channel:'RETAIL',price:'18,40',originalPrice:'20,00',minimumPrice:'1,25'};
const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2'};
const credentials={email:'qa@example.invalid',password:'secret',testsToken:'secret'};
test('CMS preview: właściwy endpoint formularza, kod handlowy i dokładne ceny',()=>{
 const p=cmsProductPreview(input);assert.equal(p.endpoint,'https://cms-ksiegarnia.gwodev.pl/products/new/simple/BOOK');assert.equal(p.merchandiseCode,input.variantCode);assert.equal(p.prices.price,1840);assert.equal(p.prices.minimumPrice,125);assert.equal(p.enabled,false);assert.throws(()=>cmsProductPreview({...input,code:'existing'}));
 assert.throws(()=>cmsProductPreview({...input,channel:'WHOLESALE'}),/jednakowe/);
 assert.throws(()=>cmsProductPreview({...input,channel:'WHOLESALE',originalPrice:input.price}),/0 zł/);
 assert.equal(cmsProductPreview({...input,channel:'WHOLESALE',originalPrice:input.price,minimumPrice:'0'}).prices.minimumPrice,0);
});
for(const mode of ['ok','wrong-price','timeout'])test('CMS tworzenie: '+mode+', pojedynczy zapis i ponowny odczyt',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'cms-create-'));let writes=0,reads=0,closed=false;
 const adapter={async createSimpleBook(actual){writes++;assert.deepEqual(actual,input);if(mode==='timeout')throw Error('Timeout — wynik nieustalony');return {id:123,code:input.code};},async createdBookState(p,channel){reads++;assert.equal(channel,'RETAIL');return {main:{name:input.name,slug:input.slug},merchandiseCode:input.variantCode,prices:{price:mode==='wrong-price'?'18,41':'18,40',originalPrice:'20,00',minimumPrice:'1,25'},activeChannels:['RETAIL'],enabled:false,visible:false,listed:false};},async screenshot(){},async close(){closed=true;}};
 try{
  const r=await runCmsProductCreation(config,credentials,{directory,allowLocal:true,input,adapter,fetchImpl:()=>{throw Error('Nie wolno użyć admin API');}});
  assert.equal(writes,1);assert.equal(reads,mode==='timeout'?0:1);assert(closed);assert.equal(r.report.status,mode==='ok'?'PASS':'FAIL');assert.equal(r.report.creation.state,mode==='ok'?'verified':mode==='timeout'?'creation_attempted':'product_created');assert.equal(r.report.requests.length,0);
  const saved=JSON.parse(await readFile(path.join(directory,'raport.json'),'utf8'));assert(saved.scopeNote.includes('Nie sprawdza /api/v2/admin/products'));assert(!JSON.stringify(saved).includes('secret'));
 }finally{await rm(directory,{recursive:true,force:true});}
});
