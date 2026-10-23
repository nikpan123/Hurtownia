import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
export const roundingPromotionJournal='.auth/rounding-36944-restore.json';
export function roundingPromotionTarget(original,product){
 assert.equal(original.code,'test');assert(/^[A-Za-z0-9_-]+$/.test(product));
 const get=key=>original.fields.find(([k])=>k===key)?.[1];
 assert.equal(get('sylius_promotion[actions][0][type]'),'order_percentage_discount','Wymagana procentowa zniżka zamówienia');
 assert.equal(Number(get('sylius_promotion[actions][0][configuration][percentage]')),23,'Promocja QA musi mieć 23%');
 assert.deepEqual(original.fields.filter(([k])=>k==='sylius_promotion[channels][]').map(([,v])=>v),['RETAIL'],'Promocja QA może dotyczyć wyłącznie RETAIL');
 assert(!original.fields.some(([k])=>k==='sylius_promotion[couponBased]'),'Promocja wymaga kuponu');
 const rules=original.fields.filter(([k])=>/^sylius_promotion\[rules\]\[\d+\]\[type\]$/.test(k));assert(rules.length>0&&rules.every(([,v])=>v==='contains_product'),'Oczekiwano wyłącznie reguł zawiera produkt');
 const products=original.fields.filter(([k])=>/^sylius_promotion\[rules\]\[\d+\]\[configuration\]\[product_code\]$/.test(k));assert.equal(products.length,rules.length);
 return {...original,fields:original.fields.map(([k,v])=>[k,products.some(([key])=>key===k)?product:v])};
}
export async function prepareRoundingPromotion(adapter,product,{file=roundingPromotionJournal,owner,qaProduct}={}){
 try{await readFile(file);throw Error('Istnieje dziennik promocji #36944 — najpierw przywróć konfigurację.');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(qaProduct)assert(/^qa-33388-stock-36944-[a-z0-9-]+$/.test(qaProduct.product.code));
 const original=await adapter.roundingPromotion(),target=roundingPromotionTarget(original,product),journal={version:1,promotionId:289,owner,original,target,qaProduct,createdAt:new Date().toISOString()};
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(journal,null,2),{flag:'wx'});
 if(!equal(original,target))await adapter.saveRoundingPromotion(original,target);
 return journal;
}
export async function restoreRoundingPromotion(adapter,{file=roundingPromotionJournal,owner}={}){
 const journal=JSON.parse(await readFile(file,'utf8'));assert.equal(journal.promotionId,289);if(owner)assert.equal(journal.owner,owner,'Dziennik pochodzi z innego przebiegu');
 const current=await adapter.roundingPromotion();assert(equal(current,journal.original)||equal(current,journal.target),'Promocja zmieniona poza testem — dziennik zachowany');
 if(!equal(current,journal.original))await adapter.saveRoundingPromotion(current,journal.original);
 assert.deepEqual(await adapter.roundingPromotion(),journal.original,'Nie potwierdzono przywrócenia promocji');
 if(journal.qaProduct){
  const qa=journal.qaProduct;assert(/^qa-33388-stock-36944-[a-z0-9-]+$/.test(qa.product.code));const state=await adapter.newProductState(qa.product);
  assert(equal(state,qa.original)||equal(state,qa.target),'Produkt QA zmieniony poza testem — dziennik zachowano');
  if(!equal(state,qa.original))await adapter.saveQaStock(qa.product,state,qa.original);
  assert.deepEqual(await adapter.newProductState(qa.product),qa.original,'Nie potwierdzono ukrycia QA');
 }
 await unlink(file);return journal;
}
