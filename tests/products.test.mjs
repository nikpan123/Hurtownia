import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectProducts} from '../api-tests/products.mjs';
const catalog=JSON.parse(await readFile('config/products.json','utf8')).products;
const settings={productCount:[1,5],quantity:[1,10],editedQuantity:[1,10]};

test('500 losowań nie miesza Adamady z pozostałymi, bez duplikatów i poza zakresem',()=>{
  const observed=new Set();
  for(let n=0;n<500;n++) {
    const r=selectProducts(settings,catalog,'seed-'+n);
    observed.add(r.selection.group);
    assert(r.products.length>=1&&r.products.length<=5);
    assert.equal(new Set(r.products.map(p=>p.productVariant)).size,r.products.length);
    assert.equal(new Set(r.products.map(p=>p.group)).size,1);
    for (const p of r.products) {
      assert.equal(catalog.find(c=>c.productVariant===p.productVariant).group,r.selection.group);
      assert.notEqual(catalog.find(c=>c.productVariant===p.productVariant).enabled,false);
      assert(p.quantity>=1&&p.quantity<=10);assert(p.newQuantity>=1&&p.newQuantity<=10);
    }
    if(r.selection.group==='adamada')assert(r.products.length<=2);
  }
  assert.deepEqual([...observed].sort(),['adamada','pozostale']);
});
test('To samo ziarno odtwarza kody, grupę i wszystkie ilości',()=>{
  assert.deepEqual(selectProducts(settings,catalog,'powtorka'),selectProducts(settings,catalog,'powtorka'));
});
test('Wyłączone produkty nie są losowane, a całkowicie wyłączona pula jest błędem',()=>{
  const data=[{productVariant:'bad',group:'adamada',enabled:false},{productVariant:'good',group:'pozostale'}];
  for(let n=0;n<20;n++)assert.deepEqual(selectProducts(settings,data,String(n)).products.map(p=>p.productVariant),['good']);
  assert.throws(()=>selectProducts(settings,[{...data[0]}],'seed'),/Brak włączonych/);
});
test('Można wymusić grupę Adamada, pozostałe oraz wyłączyć edycję',()=>{
  for(const group of ['adamada','pozostale']) {
    const r=selectProducts({...settings,group,editQuantities:false},catalog,'seed');
    assert(r.products.every(p=>p.group===group&&!Object.hasOwn(p,'newQuantity')));
  }
});
test('Katalog odrzuca duplikaty, brak grupy i niepoprawne zakresy',()=>{
  assert.throws(()=>selectProducts(settings,[catalog[0],catalog[0]],'x'),/unikalnych/);
  assert.throws(()=>selectProducts(settings,[{productVariant:'unknown'}],'x'),/grup/);
  assert.throws(()=>selectProducts({...settings,quantity:[0,10]},catalog,'x'),/zakres/);
  assert.throws(()=>selectProducts({...settings,group:'adamada',productCount:[3,5]},catalog,'x'),/Za mało/);
});
