import assert from 'node:assert/strict';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {freshRecipientMessages,messagePdfAttachments,messageText} from './mailhog.mjs';

export async function waitForOrderMailPdf({reader,recipient,baselineIds,notBefore,orderNumber,expectedName,directory,extractPdfText,timeoutMs=60000,pollMs=2000,signal,onProgress=()=>{}}){
 assert(/^\d{4,}$/.test(String(orderNumber)),'Wymagany numer konkretnego zapisanego zamówienia');assert(typeof expectedName==='string'&&expectedName,'Brak wzorca nazwy');assert(directory&&typeof extractPdfText==='function','Brak katalogu i ekstraktora PDF');
 const deadline=Date.now()+timeoutMs,seen=new Set();await mkdir(directory,{recursive:true});
 while(true){
  signal?.throwIfAborted();let messages=await reader.recentRecipient(recipient);
  // Use the fast recent window only when it crosses the time boundary and is ordered.
  const dates=messages.map(m=>Date.parse(m.Created)),ordered=dates.every((d,i)=>Number.isFinite(d)&&(!i||dates[i-1]>=d));
  if(!ordered||(messages.length>=50&&dates.at(-1)>=Date.parse(notBefore)))messages=await reader.searchRecipient(recipient);
  for(let message of freshRecipientMessages(messages,{recipient,baselineIds,notBefore})){
   if(seen.has(message.ID))continue;seen.add(message.ID);
   if(!message.MIME&&!message.Content?.MIME&&reader.getMessage){const id=message.ID;message=await reader.getMessage(id);assert.equal(message.ID,id,'Pełny MIME pochodzi z innej wiadomości');assert.equal(freshRecipientMessages([message],{recipient,baselineIds,notBefore}).length,1,'Pełna wiadomość nie potwierdza odbiorcy/czasu migawki');}
   for(const attachment of messagePdfAttachments(message).filter(a=>a.name.toLowerCase()==='podsumowanie.pdf')){
    const candidate=path.join(directory,'mail-candidate-'+crypto.randomUUID()+'.pdf');await writeFile(candidate,attachment.bytes);
    try{
     const parsed=await extractPdfText(candidate),text=parsed.text.replace(/\s+/g,' ').trim();
     if(!text.includes(String(orderNumber)))continue;
     const file='mail-podsumowanie.pdf';await writeFile(path.join(directory,file),attachment.bytes);
     return {messageId:message.ID,created:message.Created,orderNumber,recipientMatchedExactly:true,attachmentName:attachment.name,file,pages:parsed.pages,text,bodyContainsOrderNumber:messageText(message).includes(String(orderNumber)),bodyContainsExpectedName:messageText(message).includes(expectedName)};
    }finally{await unlink(candidate);}
   }
  }
  if(Date.now()>=deadline)throw new Error('Nie potwierdzono wiadomości odbiorcy z załącznikiem podsumowanie.pdf zawierającym numer tego zamówienia w dostępnym czasie. To nie dowodzi braku wysyłki.');
  onProgress('MailHog: oczekiwanie na PDF konkretnego zamówienia w nowej wiadomości');await delay(Math.min(pollMs,deadline-Date.now()),undefined,{signal});
 }
}
