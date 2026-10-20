import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDescriptionRoutes,readDescriptionEvidence} from '../api-tests/description-routing.mjs';
import {renderDescriptionRoutes,renderDescriptionHistory} from '../api-tests/feature-report.mjs';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('Przekazania: PASS wymaga rzeczywistej kontroli właściwego modułu',()=>{
 const rows=resolveDescriptionRoutes([{module:'web',status:'PASS',scenarioIds:['DESC-010']}],[{id:'new-product',status:'PASS',file:'new-product/raport.html'}]);
 assert.equal(rows.find(r=>r.id==='DESC-010').status,'SKIP');
});
test('Wcześniejsze dowody: jawne źródło, właściwe środowisko i brak przenoszenia PASS',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'description-evidence-'));
 try{
  await mkdir(path.join(root,'proof'));await writeFile(path.join(root,'proof','raport.json'),JSON.stringify({kind:'descriptions',baseUrl:'https://dev/api/v2',generatedAt:'2026-10-20',status:'PASS',scenario:'Próba wspomagana',scopeNote:'Nie jest nowym automatem.',tests:[{name:'PDF',status:'PASS',scenarioIds:['DESC-024']}]}));
  const evidence=await readDescriptionEvidence(root,['proof'],'https://dev/api/v2');
  assert.equal(evidence[0].checks.length,1);assert.equal(evidence[0].file,'../proof/raport.html');
  const html=renderDescriptionHistory(evidence);assert(html.includes('Próba wspomagana'));assert(html.includes('nie zwiększają liczników'));
  assert.equal(renderDescriptionHistory([{...evidence[0],file:'../../secret'}]),'');
  assert(renderDescriptionHistory([{...evidence[0],file:'../descriptions-2026-10-20T10-02-46-041Z-f35d6c21/raport.html'}]).includes('href='));
  await assert.rejects(readDescriptionEvidence(root,['../proof'],'https://dev/api/v2'));
  await assert.rejects(readDescriptionEvidence(root,['proof'],'https://other/api/v2'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Przekazania: FAIL i SKIP nie znikają obok poprawnych kontroli',()=>{
 for(const extra of ['FAIL','SKIP']){
  const rows=resolveDescriptionRoutes(['PASS',extra].map(status=>({name:'Kontrola',module:'new-product',status,scenarioIds:['DESC-010']})),[{id:'new-product',status:'FAIL',file:'new-product/raport.html'}]);
  assert.equal(rows.find(r=>r.id==='DESC-010').status,extra);
 }
});
test('Przekazania: dowody i przyczyna pominięcia są widoczne bez zmiany liczników testów',()=>{
 const tests=[{name:'Opis oferty',detail:'2 × A i B',module:'retail-cart',status:'PASS',scenarioIds:['DESC-022']}];
 const rows=resolveDescriptionRoutes(tests,[{id:'retail-cart',status:'PASS',file:'retail-cart/raport.html'},{id:'documents',status:'SKIP',reason:'Bez zapisu zamówienia.'}]);
 assert.equal(rows.find(r=>r.id==='DESC-022').status,'PASS');assert.equal(tests.length,1);
 const html=renderDescriptionRoutes(rows);assert(html.includes('href="retail-cart/raport.html"'));assert(html.includes('Bez zapisu zamówienia.'));
 assert(!renderDescriptionRoutes(rows.map(r=>({...r,file:'../../secret'}))).includes('href='));
});
