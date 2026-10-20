import {installBrowserPresentation} from './browser-presentation.mjs';
import {browserLaunchOptions} from './browser-options.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';

const origin='https://cms-ksiegarnia.gwodev.pl';
const kinds=['billing','shipping'];
export function defaultIds(snapshot){
 const result={};
 for(const kind of kinds){const matches=snapshot.rows.filter(r=>r[kind]==='Domyślny adres');assert.equal(matches.length,1,'Wymagany dokładnie jeden istniejący domyślny adres: '+kind);result[kind]=String(matches[0].id);}
 return result;
}
// The journal remains on disk after any unverified restoration. Never delete it to unlock a run.
export async function protectAddressDefaults(adapter,marker,operation,{journalFile='.auth/address-defaults-restore.json'}={}){
 const baseline=await adapter.read(),ids=defaultIds(baseline);
 await mkdir(path.dirname(journalFile),{recursive:true});
 const journal={version:1,createdAt:new Date().toISOString(),listUrl:adapter.listUrl,marker,ids};
 await writeFile(journalFile,JSON.stringify(journal,null,2),{flag:'wx'});
 let result,error;
 try{result=await operation(baseline,ids);}catch(e){error=e;}
 try{await restoreAddressDefaults(adapter,journal);await unlink(journalFile);}
 catch(e){throw Object.assign(new Error((error?error.message+'; ':'')+'Nie przywrócono adresów domyślnych: '+e.message+'. Zachowano '+journalFile),{restorationFailed:true,cause:e});}
 if(error)throw error;
 return result;
}
export async function restoreAddressDefaults(adapter,journal){
 assert.equal(adapter.listUrl,journal.listUrl,'Inne konto niż zapisane w dzienniku przywracania');
 for(const kind of kinds){
  const state=await adapter.read(),current=defaultIds(state);
  assert(state.rows.some(r=>String(r.id)===journal.ids[kind]),'Brak oryginalnego adresu '+kind);
  for(const k of kinds){const row=state.rows.find(r=>String(r.id)===current[k]);assert(current[k]===journal.ids[k]||row?.company===journal.marker+'-'+(k==='shipping'?'S':'B'),'Wykryto obcą zmianę domyślnego adresu '+k+'; nie nadpisujemy jej');}
  if(current[kind]!==journal.ids[kind])await adapter.set(kind,journal.ids[kind]);
 }
 const final=defaultIds(await adapter.read());assert.deepEqual(final,journal.ids,'Odczyt CMS nie potwierdził obu oryginalnych ID');
}
export async function connectAddressDefaultsCms(email,{vars=process.env,sessionFile='.auth/dev.json'}={}){
 const {chromium}=await import('playwright');const browser=await chromium.launch(browserLaunchOptions(vars));
 try{
  const context=await browser.newContext({storageState:JSON.parse(await readFile(sessionFile,'utf8'))});const presentation=await installBrowserPresentation(context,{vars});const page=await context.newPage();page.setDefaultTimeout(20000);
  const list=new URL(origin+'/wholesale/admin/wholesaler');await page.goto(list.href);
  assert.equal(new URL(page.url()).origin,origin,'Odśwież sesję GitLab przez Zaloguj-dev.cmd');
  if(new URL(page.url()).pathname==='/login'){
   assert(vars.SYLIUS_ADMIN_EMAIL&&vars.SYLIUS_ADMIN_PASSWORD,'Brak danych administratora CMS w .env');
   await page.locator('input[name="_username"]').fill(vars.SYLIUS_ADMIN_EMAIL);await page.locator('input[name="_password"]').fill(vars.SYLIUS_ADMIN_PASSWORD);
   await Promise.all([page.waitForURL(u=>u.pathname!=='/login'),page.locator('button[type="submit"]').click()]);
  }
  list.searchParams.set('criteria[email][type]','equal');list.searchParams.set('criteria[email][value]',email);await page.goto(list.href);
  const links=await page.locator('table tbody tr').evaluateAll((rows,email)=>rows.filter(r=>[...r.querySelectorAll('td')].some(td=>td.textContent.trim().toLowerCase()===email.toLowerCase())).flatMap(r=>[...r.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/^\/wholesale\/admin\/wholesaler\/\d+\/edit$/.test(h))),email);
  assert.equal(new Set(links).size,1,'Nie znaleziono jednoznacznie konta hurtownika');await page.goto(origin+links[0]);
  const href=await page.getByRole('link',{name:'Adresy',exact:true}).getAttribute('href');assert(/^\/wholesale\/admin\/wholesaler\/\d+\/address\/\d+$/.test(href),'Nie rozpoznano książki adresów');
  const listUrl=origin+href;
  async function read(){
   const rows=[],seen=new Set();let url=listUrl+'?limit=50';
   for(let i=0;i<100;i++){
    assert(!seen.has(url),'Pętla paginacji adresów');seen.add(url);await page.goto(url);assert.equal(new URL(page.url()).origin,origin,'Sesja CMS wygasła');
    await presentation.inspect(page,page.locator('table').first(),'Odczyt adresów domyślnych — strona '+(i+1));const data=await page.locator('table').evaluateAll(tables=>{
     const table=tables.find(t=>t.textContent.includes('Adres płatności')&&t.textContent.includes('Adres dostawy'));if(!table)throw new Error('Brak tabeli adresów');
     const headers=[...table.querySelectorAll('thead th')].map(e=>e.textContent.trim());
     const billing=headers.indexOf('Adres płatności'),shipping=headers.indexOf('Adres dostawy'),company=headers.indexOf('Firma');if([billing,shipping,company].some(i=>i<0))throw new Error('Nieznane kolumny adresów');
     return [...table.querySelectorAll('tbody tr')].map(r=>{const cells=[...r.querySelectorAll('td')],edit=r.querySelector('a[href*="/edit/"]')?.getAttribute('href');if(!edit)throw new Error('Brak ID adresu');return {id:edit.split('/').pop(),company:cells[company].textContent.trim(),billing:cells[billing].textContent.trim(),shipping:cells[shipping].textContent.trim(),billingHref:cells[billing].querySelector('a')?.getAttribute('href'),shippingHref:cells[shipping].querySelector('a')?.getAttribute('href'),pageUrl:location.href};});
    });rows.push(...data);
    const next=page.getByRole('link',{name:'Następna',exact:true}).first();if(!await next.count()){assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'Powtórzone ID adresów');return {rows};}
    const nextUrl=new URL(await next.getAttribute('href'),url);assert.equal(nextUrl.origin+nextUrl.pathname,listUrl,'Paginacja wskazuje inne konto');url=nextUrl.href;
   }throw new Error('Przekroczono limit stron książki');
  }
  async function set(kind,id){
   assert(kinds.includes(kind),'Nieznany rodzaj adresu');const state=await read(),row=state.rows.find(r=>String(r.id)===String(id));assert(row,'Brak adresu do przywrócenia');if(row[kind]==='Domyślny adres')return;
   const target=row[kind+'Href'];assert(new RegExp('^/wholesale/admin/wholesaler/address/default_'+kind+'/'+id+'/\\d+$').test(target??''),'Nieoczekiwany link Ustaw');
   await page.goto(row.pageUrl);await presentation.inspect(page,page.locator('a[href="'+target+'"]'),'Ustawiam domyślny adres '+(kind==='shipping'?'dostawy':'płatności'));await Promise.all([page.waitForURL(u=>!u.pathname.includes('/address/default_')),page.locator('a[href="'+target+'"]').click()]);
   assert.equal(defaultIds(await read())[kind],String(id),'CMS nie zapisał wskazanego adresu');
  }
  return {listUrl,read,set,close:()=>browser.close()};
 }catch(e){await browser.close();throw e;}
}
