import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {runDescriptionRetailDocuments} from '../api-tests/description-retail-documents.mjs';
const settings=JSON.parse(await readFile(new URL('../config/description-web.example.json',import.meta.url)));
for(const mode of ['ok','wrong-summary','timeout','wrong-mail'])test('RETAIL zapis i dokumenty: '+mode,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'retail-docs-'));let completions=0,closed=false,cleaned=false;
 const p=settings.application,expected='30009999 '+p.summaryName+' 11 dostępów uczniowskich';
 const mail={ID:'new',Created:new Date(Date.now()+1000).toISOString(),To:[{Mailbox:'qa',Domain:'example.invalid'}],Content:{MIME:{Parts:[{Headers:{'Content-Type':['application/octet-stream; name=podsumowanie.pdf'],'Content-Transfer-Encoding':['base64']},Body:Buffer.from('%PDF-test').toString('base64')}]}}};
 const adapter={product:async()=>p,mailReader:async()=>({recentRecipient:async()=>[mail]}),retailSummary:async()=>({url:'https://ksiegarnia.gwodev.pl/zamowienie/podsumowanie',rows:[['1',mode==='wrong-summary'?'Inny wariant':p.summaryName]]}),completeRetail:async()=>{completions++;if(mode==='timeout')throw Error('timeout retail-private');return {number:'30009999'};},savedRetail:async()=>({pdfFile:'retail-potwierdzenie.pdf',rows:[[p.name+' '+p.summaryName+' 11 dostępów uczniowskich','','','','','','1','','','']]}),screenshot:async()=>{},cleanupRetailCart:async()=>{cleaned=true;return {attempted:true,restoredEmpty:true};},close:async()=>{closed=true;}};
 try{
  const {report}=await runDescriptionRetailDocuments({environment:'dev',enabled:true,baseUrl:'https://ksiegarnia.gwodev.pl/api/v2',scenario:{billingAddress:{}}},{email:'qa@example.invalid',password:'api-private',testsToken:'test-private'},{settings,directory,adapter,complete:true,vars:{RETAIL_LOGIN_EMAIL:'qa@example.invalid',RETAIL_LOGIN_PASSWORD:'retail-private'},extractPdfText:async file=>({pages:1,text:mode==='wrong-mail'&&file.includes('mail-candidate')?'30009999 inny wariant':expected})});
  assert.equal(completions,mode==='wrong-summary'?0:1);assert(closed);assert.equal(report.status,mode==='ok'?'PASS':'FAIL');
  assert.equal(cleaned,mode==='wrong-summary','Po próbie finalizacji o nieustalonym wyniku nie usuwamy pozycji');
  if(mode==='timeout')assert(!report.orderNumber);if(mode==='ok')assert.equal(report.tests.filter(t=>t.status==='PASS').length,6);
  const json=await readFile(path.join(directory,'raport.json'),'utf8');assert(!json.includes('retail-private'));assert(!json.includes('api-private'));
 }finally{await rm(directory,{recursive:true,force:true});}
});
