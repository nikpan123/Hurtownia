import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runDescriptionRetailSummary} from '../api-tests/description-retail-cart.mjs';
const settings=JSON.parse(await readFile(new URL('../config/description-web.example.json',import.meta.url)));
for(const mode of ['missing','correct','wrong','cleanup-fail'])test('Podsumowanie RETAIL: '+mode,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'retail-summary-'));let closed=false,opened=false,cleaned=false;
 try{
  const vars=mode==='missing'?{}:{RETAIL_LOGIN_EMAIL:'qa@example.invalid',RETAIL_LOGIN_PASSWORD:'retail-private-password'};
  const adapter={product:async p=>({name:p.name,slug:p.slug}),retailSummary:async()=>{opened=true;return {url:'https://ksiegarnia.gwodev.pl/zamowienie/podsumowanie',rows:[['1',mode==='wrong'?'Inny wariant':settings.application.summaryName,'1']]};},screenshot:async()=>{},cleanupRetailCart:async()=>{cleaned=true;if(mode==='cleanup-fail')throw Error('Obca zmiana koszyka — nie usunięto pozycji');return {attempted:true,restoredEmpty:true};},close:async()=>{closed=true;}};
  const {report}=await runDescriptionRetailSummary({environment:'dev',enabled:true,baseUrl:'https://ksiegarnia.gwodev.pl/api/v2',scenario:{billingAddress:{street:'Testowa'}}},{email:'qa@example.invalid',password:'api-password',testsToken:'tests-private'},{directory,settings,vars,adapter});
  assert.equal(report.status,mode==='missing'?'INCOMPLETE':mode==='correct'?'PASS':'FAIL');assert.equal(opened,mode!=='missing');assert.equal(closed,mode!=='missing');
  assert.equal(cleaned,mode!=='missing');if(mode==='correct'||mode==='wrong')assert.equal(report.cartCleanup.restoredEmpty,true);
  const json=await readFile(path.join(directory,'raport.json'),'utf8');assert(!json.includes('retail-private-password'));assert(!report.completionAttempted);
 }finally{await rm(directory,{recursive:true,force:true});}
});
