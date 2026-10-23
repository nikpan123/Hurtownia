import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {roundingPromotionTarget,prepareRoundingPromotion,restoreRoundingPromotion} from '../api-tests/rounding-promotion.mjs';
const original={code:'test',fields:[['sylius_promotion[actions][0][type]','order_percentage_discount'],['sylius_promotion[actions][0][configuration][percentage]','23'],['sylius_promotion[channels][]','RETAIL'],['sylius_promotion[rules][0][type]','contains_product'],['sylius_promotion[rules][0][configuration][product_code]','testhurtA'],['sylius_promotion[rules][1][type]','contains_product'],['sylius_promotion[rules][1][configuration][product_code]','other']]};
test('Promocja QA: brak zmiany procentu lub kanałów; odrzuca inną konfigurację',()=>{
 const target=roundingPromotionTarget(original,'5lp-1');assert.equal(target.fields.filter(([,v])=>v==='5lp-1').length,2);assert(original.fields.some(([,v])=>v==='testhurtA'));
 for(const [key,value]of [['sylius_promotion[channels][]','WHOLESALE'],['sylius_promotion[actions][0][configuration][percentage]','30']])assert.throws(()=>roundingPromotionTarget({...original,fields:original.fields.map(([k,v])=>[k,k===key?value:v])},'5lp-1'));
});
test('Promocja QA: dziennik przed zapisem, przywrócenie i blokada obcej zmiany',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'rounding-promo-')),file=path.join(directory,'restore.json');let current=structuredClone(original),writes=0;
 const adapter={roundingPromotion:async()=>structuredClone(current),saveRoundingPromotion:async(expected,target)=>{await readFile(file);assert.deepEqual(current,expected);current=structuredClone(target);writes++;}};
 try{
  await prepareRoundingPromotion(adapter,'5lp-1',{file,owner:'own'});assert.equal(writes,1);
  await assert.rejects(prepareRoundingPromotion(adapter,'5lp-1',{file,owner:'second'}));
  current.code='external';await assert.rejects(restoreRoundingPromotion(adapter,{file,owner:'own'}));await readFile(file);assert.equal(writes,1);
  current=roundingPromotionTarget(original,'5lp-1');await assert.rejects(restoreRoundingPromotion(adapter,{file,owner:'other'}));
  await restoreRoundingPromotion(adapter,{file,owner:'own'});assert.equal(writes,2);assert.deepEqual(current,original);await assert.rejects(readFile(file),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true});}
});
