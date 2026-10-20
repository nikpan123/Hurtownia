import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {cookieHeader} from './config.mjs';

const base='https://mailhog.gwodev.pl';
const header=(headers,key)=>Object.entries(headers??{}).find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1]?.[0]??'';
export function decodeMailBody(part){
 const encoding=header(part?.Headers,'Content-Transfer-Encoding').toLowerCase();const source=part?.Body??'';
 assert.equal(typeof source,'string','Niepoprawna treść części MIME');
 let bytes;
 if(encoding==='base64')bytes=Buffer.from(source.replace(/\s/g,''),'base64');
 else if(encoding==='quoted-printable'){
  const unwrapped=source.replace(/=\r?\n/g,'');const values=[];
  for(let i=0;i<unwrapped.length;i++){if(unwrapped[i]==='='&&/^[0-9a-f]{2}$/i.test(unwrapped.slice(i+1,i+3))){values.push(parseInt(unwrapped.slice(i+1,i+3),16));i+=2;}else values.push(...Buffer.from(unwrapped[i],'utf8'));}bytes=Buffer.from(values);
 }else return source;
 const charset=header(part?.Headers,'Content-Type').match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]??'utf-8';
 return new TextDecoder(charset,{fatal:true}).decode(bytes);
}
export function messageText(message){
 const collect=part=>{
  const children=part?.MIME?.Parts??[];
  if(children.length)return children.flatMap(collect);
  const type=header(part?.Headers,'Content-Type').toLowerCase();
  if(type&&!type.startsWith('text/plain')&&!type.startsWith('text/html'))return [];
  return [decodeMailBody(part)];
 };
 const root=message.MIME?{...message.Content,MIME:message.MIME}:message.Content;
 return [header(message.Content?.Headers,'Subject'),...collect(root)].join('\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
}
export function messagePdfAttachments(message){
 const found=[];
 const visit=part=>{
  const disposition=header(part?.Headers,'Content-Disposition'),contentType=header(part?.Headers,'Content-Type');
  const name=(disposition.match(/filename\s*=\s*"([^"]+)"/i)??contentType.match(/name\s*=\s*"([^"]+)"/i))?.[1]??(disposition.match(/filename\s*=\s*([^;\s]+)/i)??contentType.match(/name\s*=\s*([^;\s]+)/i))?.[1];
  if(name?.toLowerCase().endsWith('.pdf')){
   assert(!/[\\/]/.test(name),'Załącznik ma niebezpieczną nazwę');const encoding=header(part.Headers,'Content-Transfer-Encoding').toLowerCase();assert.equal(encoding,'base64','Nieobsługiwane kodowanie załącznika PDF: '+encoding);
   const bytes=Buffer.from((part.Body??'').replace(/\s/g,''),'base64');assert(bytes.length>5&&bytes.length<10*1024*1024,'Nieprawidłowy rozmiar PDF');assert.equal(bytes.subarray(0,5).toString(),'%PDF-','Załącznik .pdf nie ma sygnatury PDF');found.push({name,bytes});
  }
  for(const child of part?.MIME?.Parts??[])visit(child);
 };visit(message.MIME?{...message.Content,MIME:message.MIME}:message.Content);return found;
}
export function freshRecipientMessages(messages,{recipient,baselineIds,notBefore}){
 assert(baselineIds instanceof Set,'Brak migawki ID sprzed operacji');const since=Date.parse(notBefore);assert(Number.isFinite(since),'Brak poprawnego czasu rozpoczęcia');
 return messages.filter(m=>typeof m.ID==='string'&&!baselineIds.has(m.ID)&&Number.isFinite(Date.parse(m.Created))&&Date.parse(m.Created)>=since&&(m.To??[]).some(r=>(r.Mailbox+'@'+r.Domain).toLowerCase()===recipient.toLowerCase()));
}
export function matchingNewMessages(messages,{recipient,baselineIds,notBefore,correlation,expectedTexts=[]}){
 assert(baselineIds instanceof Set,'Brak migawki ID sprzed operacji');
 assert(typeof correlation==='string'&&correlation.length>=4,'Wymagany unikalny numer zamówienia lub znacznik próby');
 const since=Date.parse(notBefore);assert(Number.isFinite(since),'Brak poprawnego czasu rozpoczęcia');
 return messages.filter(message=>{
  if(typeof message.ID!=='string'||baselineIds.has(message.ID)||!Number.isFinite(Date.parse(message.Created))||Date.parse(message.Created)<since)return false;
  const recipients=(message.To??[]).map(r=>(r.Mailbox+'@'+r.Domain).toLowerCase());if(!recipients.includes(recipient.toLowerCase()))return false;
  const text=messageText(message);return text.includes(correlation)&&expectedTexts.every(value=>text.includes(value));
 });
}
export function createMailhogReader({cookies=[],fetchImpl=fetch,signal,onProgress=()=>{},requestTimeoutMs=90000}={}){
 async function search(kind,query,{recentOnly=false}={}){
  const messages=[],seen=new Set();let start=0;
  for(let page=0;page<50;page++){
   signal?.throwIfAborted();const url=new URL(base+'/api/v2/search');for(const [key,value]of Object.entries({kind,query,start,limit:recentOnly?50:250}))url.searchParams.set(key,String(value));
   const cookie=cookieHeader(cookies.filter(c=>c.name.startsWith('_forward_auth')),url);
   let response;try{response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json',...(cookie?{Cookie:cookie}:{})},redirect:'manual',signal:AbortSignal.any([AbortSignal.timeout(requestTimeoutMs),...(signal?[signal]:[])])});}catch(e){if(signal?.aborted)throw e;throw new Error('MailHog: nie ukończono odczytu API w limicie '+requestTimeoutMs+' ms. Nie oceniono treści ani doręczenia wiadomości; '+e.name);}
   assert.equal(response.status,200,'MailHog: HTTP '+response.status+' zamiast danych; sprawdź sesję GitLab');
   assert((response.headers.get('content-type')??'').toLowerCase().includes('json'),'MailHog nie zwrócił JSON; nie uznajemy strony logowania za pustą skrzynkę');
   const data=await response.json(),items=data.items??data.messages;assert(Array.isArray(items)&&Number.isSafeInteger(data.total)&&data.total>=0,'Nie rozpoznano odpowiedzi MailHoga');
   for(const item of items){assert(typeof item.ID==='string','Brak ID wiadomości');assert(!seen.has(item.ID),'Wiadomości powtórzone podczas paginacji; migawka nie jest wiarygodna');seen.add(item.ID);messages.push(item);}
   start+=items.length;if(recentOnly||start>=data.total)return messages;assert(items.length,'Niepełna odpowiedź MailHoga; nie przyjmujemy pustej strony za koniec listy');
  }throw new Error('Nie odczytano całej listy wiadomości odbiorcy QA; limit 50 stron');
 }
 const searchRecipient=recipient=>{assert(typeof recipient==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient),'Podaj konkretny adres odbiorcy QA');return search('to',recipient);};
 const searchCorrelation=correlation=>{assert(typeof correlation==='string'&&correlation.length>=4,'Wymagany unikalny numer zamówienia / znacznik');return search('containing',correlation);};
 return {
  searchRecipient,searchCorrelation,recentRecipient:recipient=>{assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient),'Podaj odbiorcę QA');return search('to',recipient,{recentOnly:true});},
  async getMessage(id){
   assert(typeof id==='string'&&/^[A-Za-z0-9_=@.+-]{10,512}$/.test(id),'Niepoprawne ID wiadomości');const url=new URL(base+'/api/v1/messages/'+encodeURIComponent(id));
   const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json',Cookie:cookieHeader(cookies.filter(c=>c.name.startsWith('_forward_auth')),url)},redirect:'manual',signal:AbortSignal.any([AbortSignal.timeout(requestTimeoutMs),...(signal?[signal]:[])])});assert.equal(response.status,200,'Nie odczytano pełnej wiadomości MIME');assert((response.headers.get('content-type')??'').includes('json'),'Pełna wiadomość nie jest JSON');const message=await response.json();assert.equal(message.ID,id,'Inna wiadomość niż wybrana');return message;
  },
  async baseline(recipient){const messages=await searchRecipient(recipient);return {baselineIds:new Set(messages.map(m=>m.ID)),notBefore:new Date().toISOString(),count:messages.length};},
  async waitForNewMessage({recipient,baselineIds,notBefore,correlation,expectedTexts,timeoutMs=60000,pollMs=2000}){
   assert(timeoutMs>0&&timeoutMs<=180000,'Niepoprawny czas oczekiwania');const deadline=Date.now()+timeoutMs;
   while(true){signal?.throwIfAborted();let messages=await this.recentRecipient(recipient);if(messages.length===50&&messages.every(m=>Date.parse(m.Created)>=Date.parse(notBefore)))messages=await searchRecipient(recipient);const candidates=freshRecipientMessages(messages,{recipient,baselineIds,notBefore}),full=[];for(const candidate of candidates){const message=candidate.MIME||candidate.Content?.MIME?candidate:await this.getMessage(candidate.ID);assert.equal(message.ID,candidate.ID);if(freshRecipientMessages([message],{recipient,baselineIds,notBefore}).length)full.push(message);}const matches=matchingNewMessages(full,{recipient,baselineIds,notBefore,correlation,expectedTexts});assert(matches.length<=1,'Więcej niż jedna nowa wiadomość spełnia warunki; wymagany dokładniejszy znacznik');if(matches.length)return matches[0];if(Date.now()>=deadline)throw new Error('Nie znaleziono nowej wiadomości tej próby z oczekiwaną treścią w dostępnym czasie');onProgress('MailHog: oczekiwanie na nową wiadomość konkretnej próby');await delay(Math.min(pollMs,deadline-Date.now()),undefined,{signal});}
  }
 };
}
