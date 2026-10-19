import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {runDescriptionCms,validateDescriptionCmsSettings,richText} from '../api-tests/description-cms.mjs';
const settings={productId:123,code:'qa-cms',peerWholesaleSlug:'qa-peer'};
const empty={name:'',slug:'',description:'',shortDescription:''};
const original={indices:{WHOLESALE:'0',EMPIK:'1'},main:{name:'Główna nazwa',slug:'qa-main',description:'',shortDescription:'Główny krótki'},channels:{WHOLESALE:{...empty},EMPIK:{...empty}}};
const config={environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:12345/api/v2'};
async function harness({mutateApi=false,external=false,abort=false,shuffle=false,serverError=false}={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'hurt-cms-'));let state=structuredClone(original),writes=0;const controller=new AbortController();
  const adapter={read:async()=>structuredClone(state),submit:async candidate=>{
    writes++;if(candidate.channels.WHOLESALE.name.length===1||candidate.channels.WHOLESALE.slug.length>255||['qa-peer','qa-main'].includes(candidate.channels.WHOLESALE.slug))return {status:200,hasErrors:true};
    state=structuredClone(candidate);if(shuffle)state.indices={WHOLESALE:String(writes%2),EMPIK:String(1-writes%2)};if(abort&&writes===1)controller.abort();return {status:serverError&&writes===1?500:302};
  },close:async()=>{}};
  const fetchImpl=async(url,options)=>{
    if(String(url).endsWith('authentication-token'))return Response.json({token:'mock-private-jwt'});
    const channel=options.headers['X-Api-Channel'];const result={code:settings.code};for(const key of ['name','slug','description','shortDescription'])result[key]=(channel==='WHOLESALE'&&state.channels.WHOLESALE[key])||state.main[key];result.description=richText(result.description);
    if(mutateApi)result.name='Błąd API';if(external)state.main.name='Zmiana zewnętrzna';return Response.json(result);
  };
  const result=await runDescriptionCms(config,{email:'qa@example.invalid',password:'private',testsToken:'private-tests'},{allowLocal:true,settings,adapter,fetchImpl,directory:path.join(root,'report'),journalFile:path.join(root,'journal.json'),signal:controller.signal});
  return {...result,state,writes,root};
}
test('CMS wykonuje zapis, fallback pól, obie granice i kolizje; przywraca oryginał',async()=>{
  const r=await harness();assert.equal(r.report.status,'PASS',JSON.stringify(r.report.tests.filter(t=>t.status==='FAIL')));assert.deepEqual(r.state,original);
  assert(r.writes>15);assert.equal(r.report.tests.filter(t=>t.scenarioIds?.includes('DESC-004')).length,5);
  for(const id of ['DESC-001','DESC-003','DESC-004','DESC-005','DESC-006','DESC-007','DESC-008','DESC-009'])assert(r.report.tests.some(t=>t.scenarioIds?.includes(id)&&t.status==='PASS'));
  assert.equal(JSON.parse(await readFile(path.join(r.directory,'description-cms-audit.json'))).status,'restored');await assert.rejects(access(path.join(r.root,'journal.json')));
});
test('CMS przywraca dane po błędzie API i przerwaniu; zewnętrznej zmiany nie nadpisuje',async()=>{
  for(const option of [{mutateApi:true},{abort:true}]){const r=await harness(option);assert.equal(r.report.status,'FAIL');assert.deepEqual(r.state,original);assert(r.report.tests.some(t=>t.name.includes('przywrócenie')&&t.status==='PASS'));}
  const r=await harness({external:true});assert.equal(r.report.status,'FAIL');assert.equal(r.state.main.name,'Zmiana zewnętrzna');await access(path.join(r.root,'journal.json'));assert(r.report.tests.some(t=>t.name.includes('przywrócenie')&&t.status==='FAIL'));
});
test('CMS odrzuca produkt spoza QA i nieobsługiwane treści',()=>{
  assert.throws(()=>validateDescriptionCmsSettings({...settings,code:'D090'}));assert.throws(()=>richText('[{"code":"unknown"}]'));assert.equal(richText(''),'');
});
test('Zmiana kolejności indeksów kanałów po zapisie nie zmienia mapowania ani przywracania',async()=>{
  const r=await harness({shuffle:true});assert.equal(r.report.status,'PASS');assert.deepEqual(r.state.channels,original.channels);assert.deepEqual(r.state.main,original.main);
});
test('Błąd 500 po częściowym zapisie blokuje kolejne próby, pomija zależne testy i przywraca dane',async()=>{
  const r=await harness({serverError:true});assert.equal(r.report.status,'FAIL');assert.equal(r.writes,2);assert.deepEqual(r.state,original);
  assert(r.report.tests.some(t=>t.status==='FAIL'&&t.detail.includes('500')));
  assert(r.report.tests.some(t=>t.status==='SKIP'&&t.skipReason==='dependency'));
  assert(r.report.tests.some(t=>t.name.includes('przywrócenie')&&t.status==='PASS'));
});
test('Niedokończony dziennik blokuje nowy zapis i pozostaje bez zmian',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'hurt-cms-lock-')),journalFile=path.join(root,'journal.json');const contents='{"status":"pending","original":"nie nadpisuj"}';await writeFile(journalFile,contents);
  const r=await runDescriptionCms(config,{email:'qa@example.invalid',password:'private',testsToken:'private-tests'},{allowLocal:true,settings,journalFile,directory:path.join(root,'report'),adapter:{read:async()=>structuredClone(original),submit:()=>assert.fail('Zapis zablokowany'),close:async()=>{}},fetchImpl:()=>assert.fail('API nie jest uruchamiane przy blokadzie')});
  assert.equal(r.report.status,'FAIL');assert.match(r.report.tests[0].detail,/dziennik/);assert.equal(await readFile(journalFile,'utf8'),contents);
});
