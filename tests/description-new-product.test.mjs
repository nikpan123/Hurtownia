import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {newProductTranslations,verifyTranslationRows,runDescriptionNewProduct} from '../api-tests/description-new-product.mjs';
const rowsFor=e=>Object.entries(e).map(([channel,v])=>({channel,...Object.fromEntries(Object.entries(v).map(([k,s])=>[k+'_hash',createHash('md5').update(s).digest('hex')]))}));
test('Nowy produkt: baza wykrywa brak kanału, duplikat i zmianę każdego z czterech pól',()=>{
 const e=newProductTranslations('qa-33388-example'),rows=rowsFor(e);verifyTranslationRows(rows,e);
 for(const key of ['name','slug','description','shortDescription'])assert.throws(()=>verifyTranslationRows([{...rows[0],[key+'_hash']:'other'},rows[1]],e));
 assert.throws(()=>verifyTranslationRows([rows[0],rows[0]],e));assert.throws(()=>verifyTranslationRows([rows[0]],e));assert.throws(()=>newProductTranslations('existing-product'));
});
for(const createFails of [false,true])test('Nowy produkt: jeden POST i brak dalszych zapisów po niepewnym utworzeniu '+createFails,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'description-new-'));let creates=0,saves=0,reads=0,expected;
 const adapter={createProduct:async input=>{creates++;if(createFails)throw Error('Timeout POST');return {id:123,code:input.code};},newProductState:async()=>({enabled:false,visible:false,listed:false,activeChannels:['WHOLESALE'],channels:expected??{WHOLESALE:{name:'',slug:'',description:'',shortDescription:''},EMPIK:{name:'',slug:'',description:'',shortDescription:''}}}),translationRows:async()=>++reads===1?[]:rowsFor(expected),saveNewTranslations:async(p,v)=>{saves++;expected=v;},screenshot:async()=>{},close:async()=>{}};
 try{const {report}=await runDescriptionNewProduct({environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2'},{email:'qa@example.invalid',password:'secret',testsToken:'secret'},{allowLocal:true,adapter,directory});assert.equal(creates,1);assert.equal(saves,createFails?0:1);assert.equal(report.status,createFails?'FAIL':'PASS');assert.equal(reads,createFails?0:2);}finally{await rm(directory,{recursive:true,force:true});}
});
