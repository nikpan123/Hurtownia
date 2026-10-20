import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {stockProfile,restoreStockJournal,runDescriptionStock} from '../api-tests/description-stock.mjs';
test('Dziennik stock nie nadpisuje obcej zmiany ani wspólnego produktu',async()=>{
 const original={enabled:false,onHand:0},allowed=stockProfile(original,1);let writes=0;
 const adapter={newProductState:async()=>({...allowed,onHand:4}),saveQaStock:async()=>{writes++;}};
 await assert.rejects(restoreStockJournal(adapter,{product:{code:'qa-33388-stock-example'},original,allowed:[original,allowed]}),/zmieniony poza testem/);assert.equal(writes,0);
 await assert.rejects(restoreStockJournal(adapter,{product:{code:'D090'},original,allowed:[original,allowed]}),/Nieprawidłowy produkt/);
});
for(const failure of ['none','subscription','mail'])test('Powiadomienie: izolacja i przywrócenie także po błędzie '+failure,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'description-stock-')),journalFile=path.join(directory,'restore.json');let current,original,subscribed=false,creates=0,writes=0;
 const adapter={mailReader:async()=>({recentRecipient:async()=>[],waitForNewMessage:async()=>{if(failure==='mail')throw Error('MailHog timeout');return {ID:'qa-message',Created:new Date().toISOString(),Content:{Headers:{'Content-Type':['text/plain']},Body:current.main.name}};}}),createProduct:async input=>{creates++;current={enabled:false,visible:false,listed:false,onHand:0,tracked:false,activeChannels:['WHOLESALE'],main:{name:input.name,slug:input.code},channels:{}};return {id:123,code:input.code};},saveNewTranslations:async(p,v)=>{current={...current,channels:v};original=structuredClone(current);},newProductState:async()=>structuredClone(current),stockSubscriptionCounts:async()=>({total:subscribed?1:0,own:subscribed?1:0}),saveQaStock:async(p,expected,next)=>{assert.deepEqual(current,expected);current=structuredClone(next);writes++;},subscribeQaStock:async()=>{if(failure==='subscription')throw Error('Nie zapisano subskrypcji');subscribed=true;},close:async()=>{}};
 try{const {report}=await runDescriptionStock({environment:'dev',enabled:true,baseUrl:'http://127.0.0.1:1234/api/v2'},{email:'qa@example.invalid',password:'secret',testsToken:'secret'},{allowLocal:true,adapter,directory,journalFile});assert.equal(report.status,failure==='none'?'PASS':'FAIL');assert.equal(creates,1);assert.deepEqual(current,original);assert.equal(writes,failure==='subscription'?2:3);await assert.rejects(access(journalFile));assert(report.tests.some(t=>/przywrócenie/.test(t.name)&&t.status==='PASS'));}finally{await rm(directory,{recursive:true,force:true});}
});
