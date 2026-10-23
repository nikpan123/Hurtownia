import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {withPackageProducts,recoverPackageProducts} from '../api-tests/package-products.mjs';
import {packageWeightBody} from '../api-tests/package-book-fields.mjs';
import {runConfiguredPackageRegression} from '../api-tests/package-suite.mjs';
import {DebugSession} from '../dashboard/debugger/hub.mjs';

const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:11111/api/v2'};
const settings={packages:{product:{productVariant:'existing'},calculator:{singlePackageWeight:8000}},retest140g:{shippingCode:'pickup'}};
const setup=async()=>({allowLocal:true,productManifestFile:path.join(await mkdtemp(path.join(os.tmpdir(),'package-qa-')),'manifest.json')});
function adapter({badWeight=false,timeout=false,activationTimeout=false,conflict=false,cleanupFail=false}={}){
 let serial=0,creates=0,closed=0;
 const states=new Map(),writes=[];
 return {states,writes,get creates(){return creates;},get closed(){return closed;},
  async createSimpleBook(input){
   creates++;if(timeout)throw new Error('Niepewny POST');
   const product={id:++serial,code:input.code};
   states.set(product.id,{weightGrams:badWeight?2:input.weightGrams,merchandiseCode:input.code,prices:{price:'1,00',originalPrice:'1,00',minimumPrice:'0,00'},enabled:false,visible:false,listed:false,tracked:true,activeChannels:['WHOLESALE']});return product;
  },
  async packageBookState(p){return structuredClone(states.get(p.id));},
  async savePackageBook(p,current,next){
   assert.deepEqual(states.get(p.id),current);
   if(cleanupFail&&!next.enabled)throw new Error('Błąd wyłączenia');
   states.set(p.id,structuredClone(next));writes.push({p,next});
   if(activationTimeout&&next.enabled)throw new Error('Timeout po zapisie');
   if(conflict&&next.enabled)states.get(p.id).weightGrams=999;
  },
  async close(){closed++;}
 };
}

test('Tworzy 1 g i 140 g, mapuje tylko produkty, udostępnia do testu i wyłącza; drugi przebieg używa tych samych ID',async()=>{
 const options=await setup(),a=adapter();let calls=0;
 for(let i=0;i<2;i++)await withPackageProducts(config,settings,{...options,productAdapter:a},async prepared=>{
  calls++;assert.equal(a.creates,2);assert.equal(prepared.packages.product.unitWeightGrams,140);assert.equal(prepared.packages.boundaryProduct.unitWeightGrams,1);assert.equal(prepared.retest140g.product.unitWeightGrams,140);
  assert.equal(prepared.retest140g.shippingCode,'pickup');assert.deepEqual(prepared.packages.calculator,settings.packages.calculator);
  for(const [id,state]of a.states){assert(state.enabled&&state.visible&&!state.listed&&!state.tracked);assert.deepEqual(state.activeChannels,['WHOLESALE']);assert.equal(state.prices.price,'21,00');assert.equal(state.prices.originalPrice,'21,00');assert.equal(state.merchandiseCode,'qa36618-'+id);assert(state.merchandiseCode.length<=20);}
 });
 assert.equal(calls,2);assert.equal(a.creates,2);assert.equal(settings.packages.product.productVariant,'existing');
 for(const state of a.states.values()){assert(!state.enabled&&!state.visible&&!state.listed&&state.tracked);assert.equal(state.prices.price,'1,00');}
 const manifest=JSON.parse(await readFile(options.productManifestFile,'utf8'));assert.equal(manifest.products.length,2);
 await assert.rejects(()=>access(options.productManifestFile+'.lock'));
});

for(const mode of ['error','abort','activationTimeout'])test('Przywraca książkę po '+mode,async()=>{
 const options=await setup(),a=adapter({activationTimeout:mode==='activationTimeout'}),controller=new AbortController();
 await assert.rejects(()=>withPackageProducts(config,settings,{...options,productAdapter:a,signal:controller.signal},async()=>{
  if(mode==='abort'){controller.abort();controller.signal.throwIfAborted();}throw new Error('Błąd API');
 }));
 for(const state of a.states.values())assert(!state.enabled&&!state.visible);
 assert.equal(a.closed,1);await assert.rejects(()=>access(options.productManifestFile+'.lock'));
});

test('Nie ponawia niepewnego POST tworzenia, także przy następnym uruchomieniu',async()=>{
 const options=await setup(),a=adapter({timeout:true});
 for(let i=0;i<2;i++)await assert.rejects(()=>withPackageProducts(config,settings,{...options,productAdapter:a},async()=>assert.fail('Nie wolno testować')));
 assert.equal(a.creates,1);const m=JSON.parse(await readFile(options.productManifestFile,'utf8'));assert(m.products[0].intent.code);assert(!m.products[0].product);
});

test('Po niepewnym POST odczyt po kodzie odzyskuje ID zamiast tworzyć duplikat',async()=>{
 const options=await setup(),a=adapter({timeout:true});
 await assert.rejects(()=>withPackageProducts(config,settings,{...options,productAdapter:a},async()=>assert.fail()));
 const manifest=JSON.parse(await readFile(options.productManifestFile,'utf8')),code=manifest.products[0].intent.code;
 const recovered=adapter();
 // Rejestr w tym adapterze używa ID 10 dla wcześniej zapisanego rekordu.
 recovered.states.set(10,{weightGrams:1,merchandiseCode:code,prices:{price:'1,00',originalPrice:'1,00',minimumPrice:'0,00'},enabled:false,visible:false,listed:false,tracked:true,activeChannels:['WHOLESALE']});
 recovered.findPackageBook=async expected=>{assert.equal(expected,code);return {id:10,code};};
 await withPackageProducts(config,settings,{...options,productAdapter:recovered},async prepared=>assert.equal(prepared.packages.boundaryProduct.productVariant,code));
 assert.equal(recovered.creates,1,'Utworzono tylko brakującą książkę 140 g');
 assert.equal(JSON.parse(await readFile(options.productManifestFile,'utf8')).products[0].product.id,10);
});

test('Niepoprawna waga zatrzymuje próbę przed udostępnieniem produktu',async()=>{
 const options=await setup(),a=adapter({badWeight:true});
 await assert.rejects(()=>withPackageProducts(config,settings,{...options,productAdapter:a},async()=>assert.fail()),/waga/);
 assert.equal(a.writes.length,0);
});

test('Konflikt z obcą zmianą nie nadpisuje produktu i pozostawia dziennik',async()=>{
 const options=await setup(),a=adapter({conflict:true});
 await assert.rejects(()=>withPackageProducts(config,settings,{...options,productAdapter:a},async()=>assert.fail()),/zmieniony poza/);
 assert.equal(a.states.get(1).weightGrams,999);assert.equal(a.writes.length,1);
 const m=JSON.parse(await readFile(options.productManifestFile,'utf8'));assert(m.products[0].active);
});

test('Blokada nie pozwala równolegle tworzyć produktów',async()=>{
 const options=await setup(),a=adapter();
 await withPackageProducts(config,settings,{...options,productAdapter:a},async()=>{
  await assert.rejects(()=>withPackageProducts(config,settings,{...options,productAdapter:a},async()=>assert.fail()),/już trwa/);
 });assert.equal(a.creates,2);
});

test('Odzyskiwanie wyłącza produkt po przerwaniu i zwalnia blokadę',async()=>{
 const options=await setup(),a=adapter({cleanupFail:true});
 await assert.rejects(()=>withPackageProducts(config,settings,{...options,productAdapter:a},async()=>{throw new Error('awaria');}),/Nie udało się wyłączyć/);
 const clean=adapter();for(const [id,value]of a.states)clean.states.set(id,value);
 await recoverPackageProducts({...options,productAdapter:clean});
 for(const state of clean.states.values())assert(!state.enabled&&!state.visible);
});

test('Błąd przygotowania ma raport FAIL; test koszyka nie rusza',async()=>{
 const options=await setup(),a=adapter({badWeight:true});
 const result=await runConfiguredPackageRegression(config,{email:'private-email',password:'private-password',testsToken:'private-token'},
  {...options,settings,directory:path.dirname(options.productManifestFile),productAdapter:a,fetchImpl:()=>assert.fail('Nie wolno wysłać API')});
 assert.equal(result.report.status,'FAIL');assert.equal(result.report.tests.length,1);
 assert(!(await readFile(path.join(result.directory,'raport.json'),'utf8')).includes('private-'));
});

test('Waga jest wpisywana do istniejącego pola CMS; inne pola formularza pozostają',()=>{
 const entries=[['sylius_product[variant][weight]',''],['_token','csrf'],['channel[]','WHOLESALE']];
 assert.equal(packageWeightBody(entries,140).get('sylius_product[variant][weight]'),'140');
 assert.equal(packageWeightBody(entries,1).get('_token'),'csrf');
 assert.throws(()=>packageWeightBody(entries,0));assert.throws(()=>packageWeightBody([],1));
});

for(const stopBeforeCreate of [true,false])test('Debugger CMS: pauza przed zapisem i sprzątanie po stop '+stopBeforeCreate,async()=>{
 const options=await setup(),a=adapter(),session=new DebugSession({id:'qa-cms-stop',title:'T01',mode:'api',environment:'offline'});
 const work=withPackageProducts(config,settings,{...options,productAdapter:a,debuggerSession:session},async()=>assert.fail('Nie uruchamiaj API'));
 const rejected=assert.rejects(work);
 const wait=async()=>{const end=Date.now()+8000;while(!session.snapshot().steps.some(s=>s.ready)){assert(Date.now()<end);await new Promise(r=>setTimeout(r,10));}return session.snapshot().steps.find(s=>s.ready);};
 try{
  let step=await wait();assert.match(step.title,/utworzenie/);assert.equal(a.creates,0);
  if(!stopBeforeCreate){
   session.next(step.id);step=await wait();assert.match(step.title,/udostępnienie/);assert.equal(a.creates,1);assert(!a.states.get(1).enabled);
   session.next(step.id);step=await wait();assert.match(step.title,/utworzenie.*140/);assert(a.states.get(1).enabled);
  }
  session.close();await rejected;
  for(const state of a.states.values())assert(!state.enabled&&!state.visible);
  const manifest=JSON.parse(await readFile(options.productManifestFile,'utf8'));
  assert(manifest.products.every(p=>p.product),'Anulowanie przed POST nie zostawia niepewnego zamiaru tworzenia');
 }finally{session.close();await rejected;}
});
