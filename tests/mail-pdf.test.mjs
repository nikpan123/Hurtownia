import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {waitForOrderMailPdf} from '../api-tests/mail-pdf.mjs';
import {messagePdfAttachments} from '../api-tests/mailhog.mjs';
const pdf=(content,name='podsumowanie.pdf')=>({Headers:{'Content-Type':['application/octet-stream; name='+name],'Content-Transfer-Encoding':['base64']},Body:Buffer.from('%PDF-'+content).toString('base64')});
const message=(id,content,mailbox='qa')=>({ID:id,Created:'2026-10-20T08:01:00Z',To:[{Mailbox:mailbox,Domain:'example.invalid'}],Content:{Body:'Dziękujemy. Szczegóły są w załączniku.',MIME:{Parts:[pdf(content)]}}});
test('Numer i nazwa w PDF wystarczają przy informacyjnym body; stare/obce/inne zamówienie nie zaliczają',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'mail-pdf-'));
 try{const messages=[message('old','30009999 Nazwa kanałowa'),message('other','30009999 Nazwa kanałowa','other'),message('wrong-order','30008888 Nazwa kanałowa'),message('right','30009999 Nazwa kanałowa')];
  const found=await waitForOrderMailPdf({reader:{recentRecipient:async()=>messages},recipient:'qa@example.invalid',baselineIds:new Set(['old']),notBefore:'2026-10-20T08:00:00Z',orderNumber:'30009999',expectedName:'Nazwa kanałowa',directory,extractPdfText:async file=>({pages:1,text:(await readFile(file,'utf8')).slice(5)})});
  assert.equal(found.messageId,'right');assert.equal(found.bodyContainsOrderNumber,false);assert.equal(found.bodyContainsExpectedName,false);assert.deepEqual(await readdir(directory),['mail-podsumowanie.pdf']);assert(found.text.includes('Nazwa kanałowa'));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('PDF MIME: odrzucenie pliku z fałszywą sygnaturą i niebezpieczną nazwą',()=>{
 assert.equal(messagePdfAttachments(message('right','text'))[0].name,'podsumowanie.pdf');
 const nested=message('root-mime','text');nested.MIME=nested.Content.MIME;delete nested.Content.MIME;assert.equal(messagePdfAttachments(nested)[0].name,'podsumowanie.pdf');
 assert.throws(()=>messagePdfAttachments({Content:{MIME:{Parts:[{...pdf('text'),Body:Buffer.from('not pdf').toString('base64')}]}}}),/sygnatury PDF/);
 assert.throws(()=>messagePdfAttachments({Content:{MIME:{Parts:[pdf('text','../podsumowanie.pdf')]}}}),/niebezpieczną nazwę/);
});
test('Lista bez MIME wymaga pełnego odczytu tego samego ID; obce szczegóły nie zaliczają',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'mail-pdf-detail-'));let reads=0;const summary=message('right','30009999 Nazwa kanałowa');delete summary.Content.MIME;
 const args={reader:{recentRecipient:async()=>[summary],getMessage:async id=>{reads++;assert.equal(id,'right');return message(id,'30009999 Nazwa kanałowa');}},recipient:'qa@example.invalid',baselineIds:new Set(),notBefore:'2026-10-20T08:00:00Z',orderNumber:'30009999',expectedName:'Nazwa kanałowa',directory,extractPdfText:async file=>({pages:1,text:(await readFile(file,'utf8')).slice(5)})};
 try{assert.equal((await waitForOrderMailPdf(args)).messageId,'right');assert.equal(reads,1);await assert.rejects(waitForOrderMailPdf({...args,reader:{recentRecipient:async()=>[summary],getMessage:async()=>message('other','30009999 Nazwa kanałowa')}}),/innej wiadomości/);}
 finally{await rm(directory,{recursive:true,force:true});}
});
