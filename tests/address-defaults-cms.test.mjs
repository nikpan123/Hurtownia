import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {protectAddressDefaults,defaultIds} from '../api-tests/address-defaults-cms.mjs';
function adapter(){
 const ids={billing:'1',shipping:'2'},calls=[];
 const rows=[{id:'1',company:'Old billing'},{id:'2',company:'Old shipping'},{id:'3',company:'QA-S'},{id:'4',company:'QA-B'},{id:'5',company:'External'}];
 return {listUrl:'https://cms.example/addresses/1',ids,calls,read:async()=>({rows:rows.map(r=>({...r,billing:r.id===ids.billing?'Domyślny adres':'Ustaw',shipping:r.id===ids.shipping?'Domyślny adres':'Ustaw'}))}),set:async(k,id)=>{calls.push([k,id]);ids[k]=id;}};
}
for(const fail of [false,true])test('Domyślne: dokładne ID wracają również po błędzie '+fail,async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'defaults-')),journalFile=path.join(dir,'restore.json'),cms=adapter();
 try{const operation=()=>protectAddressDefaults(cms,'QA',async()=>{cms.ids.shipping='3';cms.ids.billing='4';if(fail)throw new Error('Przerwano API');return 'ok';},{journalFile});
  if(fail)await assert.rejects(operation,/Przerwano API/);else assert.equal(await operation(),'ok');
  assert.deepEqual(defaultIds(await cms.read()),{billing:'1',shipping:'2'});await assert.rejects(readFile(journalFile),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Domyślne: obca zmiana nie jest nadpisywana i dziennik pozostaje',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'defaults-')),journalFile=path.join(dir,'restore.json'),cms=adapter();
 try{await assert.rejects(protectAddressDefaults(cms,'QA',async()=>{cms.ids.shipping='5';},{journalFile}),e=>e.restorationFailed&&/obcą zmianę/.test(e.message));assert.deepEqual(cms.calls,[]);assert.equal(JSON.parse(await readFile(journalFile)).ids.shipping,'2');}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('Domyślne: istniejący dziennik blokuje kolejne zmiany; brak oryginalnego domyślnego blokuje zapis',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'defaults-')),journalFile=path.join(dir,'restore.json'),cms=adapter();let writes=0;
 try{await protectAddressDefaults(cms,'QA',async()=>{await assert.rejects(protectAddressDefaults(cms,'OTHER',async()=>writes++,{journalFile}),{code:'EEXIST'});},{journalFile});assert.equal(writes,0);
  cms.ids.billing='missing';await assert.rejects(protectAddressDefaults(cms,'QA',async()=>writes++,{journalFile}),/dokładnie jeden/);assert.equal(writes,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
