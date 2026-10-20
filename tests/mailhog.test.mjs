import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeMailBody,messageText,matchingNewMessages,createMailhogReader} from '../api-tests/mailhog.mjs';
const recipient='qa@example.invalid',notBefore='2026-10-20T08:00:00Z';
const fresh={ID:'new',Created:'2026-10-20T08:00:01Z',To:[{Mailbox:'qa',Domain:'example.invalid'}],Content:{Headers:{'Content-Type':['text/plain; charset=utf-8']},Body:'QA-unique-123 Nazwa główna A'}};
test('MailHog: świeży e-mail z polskim znacznikiem jest dekodowany po ID, bez wyszukiwania surowego MIME',async()=>{
 const message={...fresh,ID:'unique-qa-message-123',Content:{Headers:{'Content-Type':['text/plain; charset=utf-8'],'Content-Transfer-Encoding':['quoted-printable']},Body:'QA dost=C4=99pno=C5=9B=C4=87 123'}},calls=[];
 const reader=createMailhogReader({fetchImpl:async input=>{const u=new URL(input);calls.push(u);return new Response(JSON.stringify(u.pathname==='/api/v2/search'?{total:1,items:[{ID:message.ID,Created:message.Created,To:message.To}]}:message),{status:200,headers:{'content-type':'application/json'}});}});
 const found=await reader.waitForNewMessage({recipient,notBefore,baselineIds:new Set(),correlation:'QA dostępność 123',expectedTexts:['dostępność'],timeoutMs:1000});assert.equal(found.ID,message.ID);assert.equal(calls[0].searchParams.get('kind'),'to');assert(calls.some(u=>u.pathname.includes('/api/v1/messages/')));assert(!calls.some(u=>u.searchParams.get('kind')==='containing'));
});
test('MailHog: stara wiadomość, inny odbiorca, czas i znacznik nie zaliczają próby',()=>{
 const options={recipient,notBefore,baselineIds:new Set(['old']),correlation:'QA-unique-123',expectedTexts:['Nazwa główna A']};
 const messages=[{...fresh,ID:'old'},{...fresh,ID:'before',Created:'2026-10-20T07:00:00Z'},{...fresh,ID:'other',To:[{Mailbox:'other',Domain:'example.invalid'}]},{...fresh,ID:'wrong',Content:{Body:'Inny numer zamówienia'}},fresh];
 assert.deepEqual(matchingNewMessages(messages,options).map(m=>m.ID),['new']);assert.equal(matchingNewMessages([fresh],{...options,expectedTexts:['Niepoprawna nazwa']} ).length,0);
 assert.throws(()=>matchingNewMessages([fresh],{...options,baselineIds:undefined}));assert.throws(()=>matchingNewMessages([fresh],{...options,correlation:''}));
});
test('MailHog: dekodowanie polskich treści MIME, quoted-printable, base64 i pomijanie załączników',()=>{
 assert.equal(decodeMailBody({Headers:{'Content-Transfer-Encoding':['quoted-printable'],'Content-Type':['text/plain; charset=utf-8']},Body:'Za=C5=BC=C3=B3=C5=82=C4=87=\r\n g=C4=99=C5=9Bl=C4=85'}),'Zażółć gęślą');
 const part={Headers:{'Content-Type':['text/html; charset=utf-8'],'Content-Transfer-Encoding':['base64']},Body:Buffer.from('<p>Nazwa&nbsp;A</p>').toString('base64')};
 assert.equal(messageText({Content:{MIME:{Parts:[part,{Headers:{'Content-Type':['application/pdf']},Body:'Sekretny załącznik'}]}}}),'Nazwa A');
});
test('MailHog: baseline czeka na JSON, obsługuje paginację i nie uznaje HTML za pustą skrzynkę',async()=>{
 let calls=0;const methods=[];
 const reader=createMailhogReader({fetchImpl:async(url,o)=>{calls++;methods.push(o.method);assert.equal(new URL(url).searchParams.get('kind'),'to');return Response.json({total:2,items:[{...fresh,ID:calls===1?'one':'two'}]});}});
 const baseline=await reader.baseline(recipient);assert.equal(baseline.count,2);assert.deepEqual([...baseline.baselineIds],['one','two']);assert.deepEqual(methods,['GET','GET']);
 await assert.rejects(createMailhogReader({fetchImpl:async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})}).baseline(recipient),/nie zwrócił JSON/);
});
test('MailHog: oczekiwanie odrzuca niejednoznaczne wyniki i respektuje przerwanie',async()=>{
 const args={recipient,baselineIds:new Set(),notBefore,correlation:'QA-unique-123',expectedTexts:['Nazwa główna A'],timeoutMs:1000};
 const full={...fresh,MIME:{Parts:[fresh.Content]}};await assert.rejects(createMailhogReader({fetchImpl:async()=>Response.json({total:2,items:[full,{...full,ID:'another'}]})}).waitForNewMessage(args),/Więcej niż jedna/);
 const signal=AbortSignal.abort();await assert.rejects(createMailhogReader({signal}).waitForNewMessage(args),{name:'AbortError'});
});
