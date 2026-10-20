import {installBrowserPresentation} from './browser-presentation.mjs';
import {browserLaunchOptions} from './browser-options.mjs';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {descriptionContext} from './features.mjs';
import {createMailhogReader} from './mailhog.mjs';

const cms='https://cms-ksiegarnia.gwodev.pl',shop='https://ksiegarnia.gwodev.pl';
const plainText=value=>String(value??'').replace(/\s+/g,' ').trim();
export function compareRetailDescription(actual,source){
 assert.equal(typeof source.descriptionText,'string','Brak niezależnego odczytu opisu CMS');
 assert.equal(plainText(actual.description),plainText(source.descriptionText),'Pełny opis RETAIL różni się od głównego opisu CMS');
}
export function compareCategoryProduct(pages,product,source,category){
 assert(pages.length&&pages.every(p=>p.items.length),'Pusta lista kategorii');
 if(category)for(const page of pages){const url=new URL(page.url);assert.equal(url.origin,shop,'Kategoria wskazuje obcy host');assert([...url.searchParams].some(([k,v])=>k.replace(/\[\d*\]$/,'[]')===category.name&&v===category.value),'Wynik utracił filtr kategorii');}
 const items=pages.flatMap(p=>p.items);assert.equal(new Set(items.map(p=>p.href)).size,items.length,'Duplikaty produktów kategorii');
 const found=items.filter(p=>p.href===shop+'/product/'+encodeURIComponent(source.slug));assert.equal(found.length,1,'Brak lub duplikat produktu kategorii '+product.code);
 assert.equal(plainText(found[0].text),plainText(source.name),'Kategoria: nazwa inna niż główne tłumaczenie CMS');
 assert(plainText(source.shortDescriptionText),'Brak niepustego krótkiego opisu CMS — próba nie może zaliczyć pustych danych');
 assert.equal(plainText(found[0].shortDescription),plainText(source.shortDescriptionText),'Kategoria: krótki opis różni się od głównego opisu CMS');
}
export function validateWebFixtures(s){
 assert(s&&Array.isArray(s.products)&&s.products.length>=2,'Wymagane przynajmniej dwa niezależne produkty QA');
 for(const p of [...s.products,s.offer]){assert(Number.isSafeInteger(p.id)&&p.id>0,'Niepoprawne ID fixture');for(const key of ['code','name','slug'])assert(typeof p[key]==='string'&&p[key].trim(),'Brak '+key+' fixture');assert(!/[/?#]/.test(p.slug),'Slug nie może zawierać ścieżki ani query');}
 assert(new Set(s.products.map(p=>p.id)).size===s.products.length,'Powtórzone ID produktów');
 for(const kind of ['paid','closed'])assert(s.courses?.some(c=>c.kind===kind&&Number.isSafeInteger(c.id)&&c.id>0&&c.name),'Brak fixture szkolenia '+kind);
 assert.equal(s.mailhogUrl,'https://mailhog.gwodev.pl/','Ten zestaw jest przeznaczony wyłącznie dla MailHog DEV');
}
export function compareOfferLinks(actual,products){
 for(const p of products){const matching=actual.filter(a=>a.href===shop+'/product/'+encodeURIComponent(p.slug));assert.equal(matching.length,1,'Oferta: oczekiwano dokładnie jednego linku produktu '+p.code);assert.equal(matching[0].text,p.name,'Oferta RETAIL: nieprawidłowa nazwa produktu '+p.code);}
 assert.equal(actual.length,products.length,'Oferta zawiera inną liczbę linków produktów niż fixture');
}
export function assertHiddenChannelFields(snapshot){
 assert(snapshot.identity,'Nie potwierdzono tożsamości otwartego formularza');
 assert.equal(snapshot.channelFields,0,'Specjalny typ produktu udostępnia pola channelTranslations');
 assert.equal(snapshot.channelTab,false,'Specjalny typ produktu udostępnia zakładkę opisów kanałowych');
}
export async function connectDescriptionWeb({vars=process.env,sessionFile='.auth/dev.json',directory,onRequest=()=>{},onSecret=()=>{},onProgress=()=>{},isolateRetailLogin=false,mailRecipient,signal}={}){
 const {chromium}=await import('playwright');const browser=await chromium.launch(browserLaunchOptions(vars));
 try{
  const storage=JSON.parse(await readFile(sessionFile,'utf8'));
  // Keep gateway access but do not reuse an existing shopper's PHP session or cart.
  storage.cookies=storage.cookies.filter(c=>!(c.name==='PHPSESSID'&&c.domain.replace(/^\./,'')==='ksiegarnia.gwodev.pl'));
  if(isolateRetailLogin)storage.cookies=storage.cookies.filter(c=>c.name.startsWith('_forward_auth')||!['gwodev.pl','moje.gwodev.pl','ksiegarnia.gwodev.pl'].includes(c.domain.replace(/^\./,'')));
  const context=await browser.newContext({storageState:storage});const presentation=await installBrowserPresentation(context,{vars});const page=await context.newPage();page.setDefaultTimeout(20000);
  let ownedRetail;
  async function goto(url){
   const parsed=new URL(url);assert([cms,shop,'https://mailhog.gwodev.pl'].includes(parsed.origin),'Odmowa nawigacji poza DEV');
   const started=performance.now();let response;
   try{response=await page.goto(url,{waitUntil:'domcontentloaded'});}catch(e){onRequest({method:'GET',endpoint:parsed.origin+parsed.pathname,status:'NAVIGATION_ERROR',durationMs:Math.round(performance.now()-started)});throw e;}
   onRequest({method:'GET',endpoint:parsed.origin+parsed.pathname,status:response?.status()??'NO_RESPONSE',durationMs:Math.round(performance.now()-started)});
   assert.equal(new URL(page.url()).origin,parsed.origin,'Przekierowanie do logowania zamiast strony DEV');assert.equal(response?.status(),200,'Strona zwróciła HTTP '+response?.status());await presentation.step(page,'Odczyt: '+parsed.pathname);
  }
  await goto(cms+'/');
  if(new URL(page.url()).pathname==='/login'){
   assert(vars.SYLIUS_ADMIN_EMAIL&&vars.SYLIUS_ADMIN_PASSWORD,'Brak administratora CMS w .env');
   await page.locator('input[name="_username"]').fill(vars.SYLIUS_ADMIN_EMAIL);await page.locator('input[name="_password"]').fill(vars.SYLIUS_ADMIN_PASSWORD);
   await Promise.all([page.waitForURL(u=>u.pathname!=='/login'),page.locator('button[type="submit"]').click()]);
  }
  async function form(url,identitySelector,expected){
   await goto(url);await page.locator(identitySelector).waitFor();await presentation.inspect(page,page.locator(identitySelector),'Sprawdzam formularz i tożsamość produktu');assert.equal(await page.locator(identitySelector).inputValue(),expected,'Inna tożsamość formularza niż fixture');
   return page.locator('body').evaluate(body=>({identity:true,channelFields:body.querySelectorAll('[id*="channelTranslations"]').length,channelTab:[...body.querySelectorAll('a,h3,h4,legend')].some(e=>e.textContent.trim()==='Opisy produktu dla kanałów sprzedaży'),showLinks:[...body.querySelectorAll('a[href]')].filter(a=>a.textContent.includes('Pokaż produkt na stronie sklepu')).map(a=>a.href)}));
  }
  return {
   form,
   async createProduct(input){
    assert(/^qa-33388-[a-z0-9-]+$/.test(input.code),'Tworzenie ograniczone do nowego produktu qa-33388-');
    return this.createSimpleBook(input);
   },
   async createSimpleBook(input){
    assert(/^qa-[A-Za-z0-9_-]{1,90}$/.test(input.code),'Tworzenie ograniczone do nowego produktu QA');
    const url=cms+'/products/new/simple/BOOK';await goto(url);
    const form=await page.locator('#sylius_product_code').evaluate(e=>({action:e.form.action,entries:[...new FormData(e.form).entries()].filter(([,v])=>typeof v==='string')}));
    assert.equal(form.action,url);const body=new URLSearchParams(form.entries);
    for(const [key,value] of form.entries)if(/token/i.test(key))onSecret(value);
    for(const key of ['enabled','visibleOnList','visibleInBookshop'])body.delete('sylius_product['+key+']');
    body.delete('sylius_product[channels][]');body.append('sylius_product[channels][]',input.channel??'WHOLESALE');
    for(const channel of ['RETAIL','EMPIK','ACADEMY','WHOLESALE'])for(const [key,value]of Object.entries({price:'1,00',originalPrice:'1,00',minimumPrice:'0,00'}))body.set('sylius_product[variant][channelPricings]['+channel+']['+key+']',value);
    if(input.channel)for(const key of ['price','originalPrice','minimumPrice'])body.set('sylius_product[variant][channelPricings]['+input.channel+']['+key+']',String(input[key]).replace('.',','));
    body.set('sylius_product[code]',input.code);body.set('sylius_product[variant][merchandiseCode]',input.variantCode??input.code);
    body.set('sylius_product[translations][pl_PL][name]',input.name);body.set('sylius_product[translations][pl_PL][slug]',input.slug??input.code);
    const attrs=await page.locator('#sylius_product_code').evaluate(e=>[...e.form.querySelectorAll('[id^="sylius_product_attributes_"][id$="_value"]')].map(v=>({name:v.name,type:v.type})));
    assert.deepEqual(attrs.map(a=>a.type),['textarea','number','checkbox','text'],'Zmieniła się struktura atrybutów nowej książki');
    const isbnBase='978'+[...input.code.replace(/[^a-f0-9]/g,'')].map(c=>parseInt(c,16)%10).join('').padEnd(9,'0').slice(0,9);const isbn=isbnBase+((10-[...isbnBase].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10)%10);
    body.set(attrs[0].name,'Autor QA');body.set(attrs[1].name,'1');body.set(attrs[3].name,isbn);
    await presentation.form(page,body,'Nowy produkt QA — przygotowanie danych');
    const start=performance.now();const response=await context.request.post(url,{data:body.toString(),headers:{'content-type':'application/x-www-form-urlencoded',referer:url,origin:cms},maxRedirects:0,timeout:30000});
    onRequest({method:'POST',endpoint:url,status:response.status(),durationMs:Math.round(performance.now()-start)});await presentation.result(page,response.status());
    const location=response.headers().location;if(![302,303].includes(response.status())){const html=await response.text();const fieldErrors=await page.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html');return [...d.querySelectorAll('[class*="error"],[class*="pointing"]')].map(e=>({fields:[...(e.closest('.field')??e.parentElement).querySelectorAll('input,select,textarea')].map(e=>e.id),message:e.textContent.replace(/\s+/g,' ').trim().slice(0,300)}));},html);const errors=[...html.matchAll(/<(?:div|span|li|p)[^>]*class=["'][^"']*(?:error|negative|red pointing)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|li|p)>/gi)].map(m=>m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,8);throw new Error('Utworzenie produktu HTTP '+response.status()+'; '+JSON.stringify(fieldErrors)+'; '+errors.join('; ')+'; zapis nie zostanie ponowiony');}
    assert(location,'Brak przekierowania po utworzeniu');const target=new URL(location,url);assert.equal(target.origin,cms);const id=target.pathname.match(/^\/products\/(\d+)\/edit$/)?.[1];assert(id,'Nie potwierdzono ID produktu; sprawdź kod z raportu przed następną próbą');return {id:Number(id),code:input.code};
   },
   async newProductState(p){
    await goto(cms+'/products/'+p.id+'/edit');assert.equal(await page.locator('#sylius_product_code').inputValue(),p.code);
    return page.locator('#sylius_product_code').evaluate(e=>{const f=e.form,channels={},indices={};for(const input of f.querySelectorAll('input[id*="channelTranslations"][id$="_name"]')){let node=input;for(let i=0;node&&i<8;i++,node=node.parentElement){const match=(node.previousElementSibling?.textContent??'').match(/\((WHOLESALE|EMPIK)\)/);if(match){const index=input.id.match(/_(\d+)_name$/)[1];indices[match[1]]=index;channels[match[1]]=Object.fromEntries(['name','slug','description','shortDescription'].map(k=>[k,f.querySelector('#sylius_product_channelTranslations_'+index+'_'+k)?.value]));break;}}}return {main:{name:f.querySelector('#sylius_product_translations_pl_PL_name').value,slug:f.querySelector('#sylius_product_translations_pl_PL_slug').value},tracked:f.querySelector('#sylius_product_variant_tracked').checked,onHand:Number(f.querySelector('#sylius_product_variant_onHand').value),notification:f.querySelector('#sylius_product_variant_notificationOfAvailability').checked,enabled:f.querySelector('#sylius_product_enabled').checked,visible:f.querySelector('#sylius_product_visibleInBookshop').checked,listed:f.querySelector('#sylius_product_visibleOnList').checked,activeChannels:[...f.querySelectorAll('input[name="sylius_product[channels][]"]:checked')].map(e=>e.value),channels,indices};});
   },
   async createdBookState(p,channel){
    const state=await this.newProductState(p);
    const details=await page.locator('#sylius_product_code').evaluate((e,channel)=>{const f=e.form;return {merchandiseCode:f.querySelector('#sylius_product_variant_merchandiseCode').value,prices:Object.fromEntries(['price','originalPrice','minimumPrice'].map(k=>[k,f.querySelector('#sylius_product_variant_channelPricings_'+channel+'_'+k).value]))};},channel);
    return {...state,...details};
   },
   async saveNewTranslations(p,expected){
    assert(/^qa-33388-[a-z0-9-]+$/.test(p.code));const state=await this.newProductState(p);assert(!state.enabled&&!state.visible&&!state.listed,'Nowy produkt QA musi pozostać nieaktywny i ukryty');assert.deepEqual(state.activeChannels,['WHOLESALE']);
    for(const values of Object.values(state.channels))assert(Object.values(values).every(v=>!v),'Nie nadpisujemy istniejących tłumaczeń');
    const url=cms+'/products/'+p.id+'/edit',form=await page.locator('#sylius_product_code').evaluate(e=>({action:e.form.action,entries:[...new FormData(e.form).entries()].filter(([,v])=>typeof v==='string')}));assert.equal(form.action,url);const body=new URLSearchParams(form.entries);
    assert.deepEqual(Object.keys(state.indices).sort(),['EMPIK','WHOLESALE']);for(const [channel,values]of Object.entries(expected))for(const [key,value]of Object.entries(values))body.set('sylius_product[channelTranslations]['+state.indices[channel]+']['+key+']',value);
    await presentation.form(page,body,'Cztery pola opisów dla WHOLESALE i EMPIK');
    const start=performance.now();const response=await context.request.post(url,{data:body.toString(),headers:{'content-type':'application/x-www-form-urlencoded',referer:url,origin:cms},maxRedirects:0,timeout:30000});onRequest({method:'POST',endpoint:url,status:response.status(),durationMs:Math.round(performance.now()-start)});await presentation.result(page,response.status());assert([302,303].includes(response.status()),'Zapis tłumaczeń HTTP '+response.status()+'; bez ponawiania');
   },
   async saveQaStock(p,expected,next){
    assert(/^qa-33388-stock-[a-z0-9-]+$/.test(p.code),'Zmiany zapasu wyłącznie nowego QA stock');assert.deepEqual(await this.newProductState(p),expected,'Produkt zmieniony poza testem — odmowa nadpisania');
    const url=cms+'/products/'+p.id+'/edit',form=await page.locator('#sylius_product_code').evaluate(e=>({action:e.form.action,entries:[...new FormData(e.form).entries()].filter(([,v])=>typeof v==='string')}));assert.equal(form.action,url);const body=new URLSearchParams(form.entries);
    for(const [key,enabled]of Object.entries({enabled:next.enabled,visibleOnList:next.listed,visibleInBookshop:next.visible})){body.delete('sylius_product['+key+']');if(enabled)body.set('sylius_product['+key+']','1');}
    body.delete('sylius_product[variant][tracked]');if(next.tracked)body.set('sylius_product[variant][tracked]','1');assert(Number.isSafeInteger(next.onHand)&&next.onHand>=0&&next.onHand<=1);body.set('sylius_product[variant][onHand]',String(next.onHand));body.delete('sylius_product[channels][]');assert(next.activeChannels.every(c=>['RETAIL','WHOLESALE'].includes(c)));for(const channel of next.activeChannels)body.append('sylius_product[channels][]',channel);
    await presentation.form(page,body,'Zmiana zapasu i ustawień QA');
    const start=performance.now(),response=await context.request.post(url,{data:body.toString(),headers:{'content-type':'application/x-www-form-urlencoded',referer:url,origin:cms},maxRedirects:0,timeout:30000});onRequest({method:'POST',endpoint:url+' / QA stock',status:response.status(),durationMs:Math.round(performance.now()-start)});await presentation.result(page,response.status());assert([302,303].includes(response.status()),'Zapis zapasu QA HTTP '+response.status()+'; bez ponawiania');
   },
   async subscribeQaStock(p,recipient){
    assert(/^qa-33388-stock-[a-z0-9-]+$/.test(p.code));assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient));
    await goto(shop+'/product/'+p.code);const consent=page.getByRole('button',{name:'Akceptuję i przechodzę do Serwisu',exact:true});if(await consent.isVisible())await consent.click();await page.getByRole('button',{name:'Powiadom mnie o dostępności',exact:true}).click();const form=page.locator('form').filter({has:page.locator('#subscription_email')});await form.waitFor({state:'visible'});await presentation.inspect(page,form.locator('#subscription_email'),'Wpisuję odbiorcę testowego powiadomienia');await form.locator('#subscription_email').fill(recipient);await presentation.step(page,'Odbiorca wpisany — przygotowuję zgody');
    const boxes=form.locator('input[type="checkbox"]');assert.equal(await boxes.count(),2,'Inny formularz zgód subskrypcji');for(const box of await boxes.all()){const id=await box.getAttribute('id');await form.locator('label[for="'+id+'"]').click();assert(await box.isChecked(),'Nie zaznaczono zgody na testowe powiadomienie');}
    const submit=page.locator('button[form="back_in_stock_not"]');assert.equal(await submit.count(),1,'Inna akcja zapisu subskrypcji');const start=performance.now(),response=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/back-in-stock-notification/add-subscription'&&r.request().method()==='POST'),submit.click()]).then(([r])=>r);onRequest({method:'POST',endpoint:shop+'/back-in-stock-notification/add-subscription',status:response.status(),durationMs:Math.round(performance.now()-start)});assert([200,201,302].includes(response.status()),'Nie zapisano subskrypcji QA');
   },
   async stockSubscriptionCounts(p,recipientHash){
    assert(Number.isSafeInteger(p.id)&&p.id>0&&/^qa-33388-stock-[a-z0-9-]+$/.test(p.code)&&/^[a-f0-9]{32}$/.test(recipientHash));const db=await context.newPage();try{
     const sql=`SELECT COUNT(*) AS total,COALESCE(SUM(MD5(LOWER(n.email))='${recipientHash}'),0) AS own FROM bookshop2.webgriffe_back_in_stock_notification_subscription n JOIN bookshop2.sylius_product_variant v ON v.id=n.product_variant_id JOIN bookshop2.sylius_product p ON p.id=v.product_id WHERE p.id=${p.id} AND p.code='${p.code}'`;
     await db.goto('https://phpmyadmin.gwodev.pl/index.php?route=/table/sql&db=bookshop2&table=webgriffe_back_in_stock_notification_subscription',{waitUntil:'domcontentloaded'});assert.equal(new URL(db.url()).hostname,'phpmyadmin.gwodev.pl');const editor=db.locator('#sqlquery + .CodeMirror textarea');await presentation.inspect(db,db.locator('.CodeMirror'),'Przygotowuję kontrolę SELECT w bazie');await editor.press('ControlOrMeta+A');await editor.fill(sql);await editor.press('Tab');await presentation.step(db,'Zapytanie SELECT wpisane — odczyt bez zmiany danych');await db.getByRole('button',{name:'Wykonaj',exact:true}).click();await db.waitForFunction(()=>document.querySelector('table.table_results')||document.querySelector('#page_content .alert-danger'));
     const result=await db.evaluate(()=>{const error=document.querySelector('#page_content .alert-danger');if(error)return {error:error.textContent};const t=document.querySelector('table.table_results'),headers=[...t.querySelectorAll('thead th[data-column]')].map(e=>e.dataset.column),cells=[...t.querySelectorAll('tbody tr:first-child td.data')].map(e=>e.textContent.trim());return Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));});assert(!result.error,'Błąd SELECT subskrypcji');assert(/^\d+$/.test(result.total)&&/^\d+$/.test(result.own),'Nie odczytano liczby subskrypcji');return {total:Number(result.total),own:Number(result.own)};
    }finally{await db.close();}
   },
   async translationRows(p){
    assert(Number.isSafeInteger(p.id)&&p.id>0&&/^qa-33388-[a-z0-9-]+$/.test(p.code));
    const db=await context.newPage();try{
     const sql=`SELECT c.code AS channel,MD5(t.name) AS name_hash,MD5(t.slug) AS slug_hash,MD5(t.description) AS description_hash,MD5(t.short_description) AS shortDescription_hash FROM bookshop2.bookshop_product_channel_translation t JOIN bookshop2.sylius_channel c ON c.id=t.channel_id JOIN bookshop2.sylius_product p ON p.id=t.product_id WHERE p.id=${p.id} AND p.code='${p.code}' ORDER BY c.code`;
     await db.goto('https://phpmyadmin.gwodev.pl/index.php?route=/table/sql&db=bookshop2&table=bookshop_product_channel_translation',{waitUntil:'domcontentloaded'});assert.equal(new URL(db.url()).hostname,'phpmyadmin.gwodev.pl','Brak sesji phpMyAdmin');
     const editor=db.locator('#sqlquery + .CodeMirror textarea');await presentation.inspect(db,db.locator('.CodeMirror'),'Przygotowuję kontrolę SELECT w bazie');await editor.press('ControlOrMeta+A');await editor.fill(sql);await editor.press('Tab');await presentation.step(db,'Zapytanie SELECT wpisane — odczyt bez zmiany danych');const start=performance.now();await db.getByRole('button',{name:'Wykonaj',exact:true}).click();await db.waitForFunction(()=>document.querySelector('table.table_results')||document.querySelector('#page_content .alert-success')||document.querySelector('#page_content .alert-danger'));
     const result=await db.evaluate(()=>{const error=document.querySelector('#page_content .alert-danger');if(error)return {error:error.textContent};const t=document.querySelector('table.table_results');if(!t)return {rows:[]};const headers=[...t.querySelectorAll('thead th[data-column]')].map(e=>e.dataset.column);return {rows:[...t.querySelectorAll('tbody tr')].map(r=>Object.fromEntries([...r.querySelectorAll('td.data')].map((e,i)=>[headers[i],e.textContent.trim()])))};});
     onRequest({method:'SELECT',endpoint:'bookshop2.bookshop_product_channel_translation / product '+p.id,status:result.error?'ERROR':'OK',durationMs:Math.round(performance.now()-start)});assert(!result.error,'Błąd SELECT: '+result.error);return result.rows;
    }finally{await db.close();}
   },
   async product(p){
    await goto(cms+'/products/'+p.id+'/edit');await page.locator('#sylius_product_code').waitFor();assert.equal(await page.locator('#sylius_product_code').inputValue(),p.code,'Inny kod produktu QA');
    const channelSectionVisible=await page.locator('h4').filter({hasText:'Opisy produktu dla kanałów sprzedaży'}).isVisible();return page.locator('#sylius_product_code').evaluate((e,channelSectionVisible)=>{const f=e.form,channels={};for(const input of f.querySelectorAll('input[id*="channelTranslations"][id$="_name"]')){let node=input;for(let i=0;node&&i<8;i++,node=node.parentElement){const match=(node.previousElementSibling?.textContent??'').match(/\((WHOLESALE|EMPIK)\)/);if(match){const index=input.id.match(/_(\d+)_name$/)[1];channels[match[1]]=Object.fromEntries(['name','slug','description','shortDescription'].map(key=>[key,f.querySelector('#sylius_product_channelTranslations_'+index+'_'+key)?.value]));break;}}}const readable=value=>{let blocks;try{blocks=JSON.parse(value||'[]');}catch{blocks=[{code:'monsieurbiz.html',data:{content:value}}];}if(!Array.isArray(blocks))throw Error('Nieznany format opisu CMS');return blocks.map(b=>{if(b.code!=='monsieurbiz.html')throw Error('Nieobsługiwany blok opisu: '+b.code);const doc=new DOMParser().parseFromString(b.data?.content||'','text/html');for(const el of doc.querySelectorAll('script,style'))el.remove();for(const el of doc.body.querySelectorAll('p,div,li,h1,h2,h3,h4,br'))el.append(doc.createTextNode(' '));return doc.body.textContent;}).join(' ').replace(/\s+/g,' ').trim();};return {descriptionText:readable(f.querySelector('#sylius_product_translations_pl_PL_description')?.value),shortDescriptionText:readable(f.querySelector('#sylius_product_translations_pl_PL_shortDescription')?.value),name:f.querySelector('#sylius_product_translations_pl_PL_name')?.value,slug:f.querySelector('#sylius_product_translations_pl_PL_slug')?.value,channels,channelSectionVisible,channelNames:Object.values(channels).map(c=>c.name).filter(Boolean)};},channelSectionVisible);
   },
   async retailProduct(p){await goto(shop+'/product/'+encodeURIComponent(p.slug));await page.locator('.product-header__headline').waitFor();await presentation.inspect(page,page.locator('.product-header__headline'),'Porównuję widoczną nazwę produktu RETAIL');return {name:(await page.locator('.product-header__headline').innerText()).trim(),url:page.url(),description:await page.locator('.product-card__body > .product-body').innerText()};},
   async retailCatalog({query,category}={}){
    await goto(shop+'/');
    const consent=page.getByRole('button',{name:'Akceptuję i przechodzę do Serwisu',exact:true});
    await page.locator('.product-item__title a').first().waitFor();
    if(await consent.isVisible())await consent.click();
    if(query){const search=page.locator('input[type="search"][name="name"]');await presentation.inspect(page,search,'Wpisuję wyszukiwaną nazwę produktu');await search.fill(query);await presentation.step(page,'Wpisano nazwę — uruchamiam wyszukiwanie');await search.press('Enter');await page.waitForURL(u=>u.searchParams.get('name')===query,{waitUntil:'domcontentloaded'});}
    if(category){const label=page.locator('#filters-sidebar label').filter({hasText:category.label});assert.equal(await label.count(),1,'Nie znaleziono jednoznacznego filtra kategorii');const input=label.locator('input');assert.equal(await input.getAttribute('name'),category.name);assert.equal(await input.getAttribute('value'),category.value);await presentation.inspect(page,label,'Wybieram kategorię '+category.label);await label.click();await page.locator('input[type=search][name=name]').press('Enter');await page.waitForURL(u=>u.searchParams.getAll(category.name).includes(category.value),{waitUntil:'domcontentloaded'});}
    const pages=[],visited=new Set();
    for(let n=0;n<((query||category)?8:2);n++){
     await page.locator('.product-item__title a').first().waitFor();const url=page.url();assert(!visited.has(url),'Powtórzona strona listy');visited.add(url);
     const snapshot=await page.evaluate(()=>({url:location.href,items:[...document.querySelectorAll('.product-item__title a')].map(a=>({text:a.textContent.trim().replace(/\s+/g,' '),href:a.href,shortDescription:[...a.closest('.product-item').querySelectorAll('.product-item__excerption')].at(-1)?.textContent.trim()})),links:[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>{const u=new URL(h);return u.origin===location.origin&&u.pathname===location.pathname&&u.searchParams.has('page');})}));pages.push(snapshot);
     const current=Number(new URL(url).searchParams.get('page')??1),next=snapshot.links.find(h=>{const u=new URL(h);return Number(u.searchParams.get('page'))===current+1&&(!query||u.searchParams.get('name')===query)&&(!category||[...u.searchParams].some(([k,v])=>k.replace(/\[\d*\]$/,'[]')===category.name&&v===category.value));});
     if(!next)break;if(n===((query||category)?7:1))assert(!(query||category),'Nie odczytano całego wyniku wyszukiwania — limit ośmiu stron');else await goto(next);
    }
    return pages;
   },
   async application(p){
    await goto(cms+'/products/'+p.id+'/edit');assert.equal(await page.locator('#sylius_product_code').inputValue(),p.code);const main={name:await page.locator('#sylius_product_translations_pl_PL_name').inputValue(),slug:await page.locator('#sylius_product_translations_pl_PL_slug').inputValue()};assert.equal(main.name,p.name);assert.equal(main.slug,p.slug);
    await goto(shop+'/product/'+encodeURIComponent(p.slug));await page.locator('.product-header__headline').waitFor();return {name:await page.locator('.product-header__headline').innerText(),text:await page.locator('main').innerText()};
   },
   async applicationCart(p,{students=11}={}){
    assert(Number.isSafeInteger(students)&&students>=1&&students<=29,'Wybierz 1–29 dostępów w pakiecie nauczycielskim');
    await this.application(p);const consent=page.getByRole('button',{name:'Akceptuję i przechodzę do Serwisu',exact:true});if(await consent.isVisible())await consent.click();
    await page.locator('#teacherAccessTab').click();await page.locator('#tab2').waitFor({state:'visible'});
    const field=page.locator('#tab2 input[name="sylius_add_to_cart[accessesCount]"]');await presentation.inspect(page,field,'Zmieniam liczbę dostępów uczniowskich');await field.fill(String(students));await field.press('Tab');await presentation.step(page,'Liczba dostępów uczniowskich: '+students+' — sprawdzam przeliczenie');
    await page.waitForFunction(n=>document.querySelector('#tab2 input[name="sylius_add_to_cart[accessesCount]"]')?.value===String(n)&&document.querySelector('#tab2 .teacher-packet__total')?.textContent.includes('Razem'),students);
    const submit=page.locator('#tab2 form button[type="submit"]:visible');assert.equal(await submit.count(),1,'Pakiet ma inną niż jedna widoczną akcję dodawania');
    await presentation.inspect(page,submit,'Klikam dodanie aplikacji do koszyka');
    const started=performance.now();const response=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/ajax/cart/add'&&r.request().method()==='POST'),submit.click()]).then(([r])=>r);
    onRequest({method:'POST',endpoint:shop+'/ajax/cart/add?productId='+p.id,status:response.status(),durationMs:Math.round(performance.now()-started)});assert.equal(response.status(),200,'Nie dodano aplikacji do koszyka');
    await page.locator('turbo-frame#dialog').waitFor({state:'visible'});const dialog=await page.locator('turbo-frame#dialog').innerText();
    const links=await page.locator('turbo-frame#dialog a[href]').evaluateAll(items=>items.map(a=>({text:a.textContent.trim(),href:a.href})));
    const cart=links.find(a=>/koszyk/i.test(a.text)&&new URL(a.href).origin===shop);
    if(!cart){const button=page.locator('turbo-frame#dialog').getByRole('button',{name:/PRZEJDŹ DO KOSZYKA/i});if(await button.count()){await button.click();await page.waitForURL(u=>u.pathname==='/koszyk',{waitUntil:'domcontentloaded'});return {text:await page.locator('main').innerText(),url:page.url(),dialog};}}
    if(cart){await goto(cart.href);return {text:await page.locator('main').innerText(),url:page.url(),dialog};}
    return {text:dialog,url:page.url(),dialog,links};
   },
   async offerCart(settings){
    for(const p of settings.products){const source=await this.product(p);assert.equal(source.name,p.name);assert.equal(source.slug,p.slug);}
    await this.offer(settings.offer);const consent=page.getByRole('button',{name:'Akceptuję i przechodzę do Serwisu',exact:true});if(await consent.isVisible())await consent.click();
    const rows=await page.locator('#special-offer-configurator').evaluate(root=>[...root.querySelectorAll('input[name^="productsQuantity"]')].map(input=>{let row=input.parentElement;for(let i=0;row&&i<8;i++,row=row.parentElement){const a=row.querySelector('a[href*="/product/"]');if(a&&row.querySelectorAll('input[name^="productsQuantity"]').length===1)return {name:input.name,href:a.href};}throw Error('Nie powiązano ilości z produktem');}));
    const live=await page.locator('main [data-live-url-value]').getAttribute('data-live-url-value');assert.equal(live,'/_components/special_offer_configurator');await page.locator('main [data-live-url-value][data-original-data]').waitFor({state:'attached'});
    for(const p of settings.products){const matched=rows.filter(r=>r.href===shop+'/product/'+p.slug);assert.equal(matched.length,1,'Inne produkty konfiguratora');const field=page.locator('input').filter({visible:true}).and(page.locator('input[name="'+matched[0].name+'"]'));await presentation.inspect(page,field,'Zmieniam ilość produktu '+p.code+' na 2');const start=performance.now();const response=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.startsWith(live)),(async()=>{await field.fill('2');await field.press('Tab');})()]).then(([r])=>r);onRequest({method:response.request().method(),endpoint:shop+live+' / przeliczenie '+p.code,status:response.status(),durationMs:Math.round(performance.now()-start)});assert.equal(response.status(),200,'Nie przeliczono oferty');await presentation.step(page,'Przeliczono '+p.code+' — ilość 2');}
    const button=page.locator('#special-offer-configurator').getByRole('button',{name:/Dodaj do koszyka/});await button.waitFor({state:'visible'});
    await page.waitForFunction(()=>[...document.querySelectorAll('#special-offer-configurator input[name^="productsQuantity"]')].every(e=>e.value==='2')&&/4\s*egz\./.test(document.querySelector('#special-offer-configurator').textContent.replace(/\s+/g,' ')));
    await presentation.inspect(page,button,'Klikam dodanie oferty do koszyka');
    const start=performance.now();const response=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.startsWith(live)),button.click()]).then(([r])=>r);onRequest({method:response.request().method(),endpoint:shop+live+' / dodanie oferty',status:response.status(),durationMs:Math.round(performance.now()-start)});assert.equal(response.status(),200,'Nie dodano oferty');
    const dialog=page.locator('turbo-frame#dialog');await dialog.getByRole('button',{name:/PRZEJDŹ DO KOSZYKA/i}).waitFor();const confirmation=await dialog.innerText();await dialog.getByRole('button',{name:/PRZEJDŹ DO KOSZYKA/i}).click();await page.waitForURL(u=>u.pathname==='/koszyk',{waitUntil:'domcontentloaded'});return {text:await page.locator('main').innerText(),url:page.url(),confirmation};
   },
   async retailSummary(p,{email,password,address}){
    assert(email&&password,'Brak danych logowania RETAIL (osobne od hasła API)');
    onProgress('RETAIL: logowanie przed utworzeniem koszyka QA');await goto(shop+'/');
    const service=page.getByRole('button',{name:'Akceptuję i przechodzę do Serwisu',exact:true});if(await service.isVisible())await service.click();
    const homeCookies=page.getByRole('button',{name:'Akceptuję',exact:true});if(await homeCookies.isVisible())await homeCookies.press('Enter');
    if(!await page.getByRole('link',{name:/Wyloguj/}).isVisible()){
     await page.getByRole('link',{name:/Zaloguj/}).click();
     await page.waitForFunction(()=>location.origin==='https://moje.gwodev.pl'&&document.querySelector('input[name=login]')||location.origin==='https://ksiegarnia.gwodev.pl'&&[...document.querySelectorAll('a')].some(a=>a.textContent.includes('Wyloguj')));
     if(new URL(page.url()).origin==='https://moje.gwodev.pl'){
      await page.locator('input[name=login]').fill(email);await page.locator('input[name=password]').fill(password);
      await Promise.all([page.waitForURL(u=>u.origin===shop,{waitUntil:'domcontentloaded'}),page.getByRole('button',{name:'Zaloguj się',exact:true}).click()]);
     }
    }
    assert(await page.getByRole('link',{name:/Wyloguj/}).isVisible(),'Nie potwierdzono logowania Moje GWO');
    onProgress('RETAIL: kontrola pustego koszyka przed dodaniem QA');await goto(shop+'/koszyk');
    assert((await page.locator('main').innerText()).includes('Twój koszyk jest pusty.'),'Konto ma już koszyk. Nie dodano QA i nie zmieniono istniejących pozycji.');
    await this.applicationCart(p,{students:11});
    const links=await page.locator('main a[href*="/product/"]').evaluateAll(links=>links.map(a=>a.textContent.trim()).filter(Boolean));
    assert.equal(links.length,1,'Logowanie połączyło koszyki lub zmieniło pozycje — dalsza próba zatrzymana');assert.equal(links[0],p.name,'Koszyk nie zawiera oczekiwanej aplikacji');
    const removeActions=await page.locator('main form[action*="/remove"]').evaluateAll(forms=>forms.map(f=>f.getAttribute('action')));assert.equal(removeActions.length,1,'Nie zidentyfikowano własnej pozycji QA');assert(/^\/cart\/\d+\/remove$/.test(removeActions[0]));ownedRetail={action:removeActions[0],name:p.name};
    onProgress('RETAIL: przejście z koszyka do danych zamówienia');
    const consent=page.getByRole('button',{name:'Akceptuję',exact:true});if(await consent.isVisible())await consent.press('Enter');
    await page.locator('#sylius_cart label').filter({hasText:'Zamówienie na siebie'}).click();
    // This suite checks names, not the JavaScript navigation button. Save the
    // current cart form, then open the documented data stage directly.
    const form=await page.locator('#sylius_cart').evaluate(f=>({action:f.action,entries:[...new FormData(f).entries()].filter(([,v])=>typeof v==='string')}));
    assert.equal(form.action,shop+'/cart/');const body=new URLSearchParams(form.entries);assert.equal(body.get('sylius_cart[type][type]'),'individual','Nie wybrano rodzaju zamówienia');
    const csrf=body.get('sylius_cart[_token]');if(csrf)onSecret(csrf);
    const start=performance.now(),response=await context.request.post(form.action,{data:body.toString(),headers:{'content-type':'application/x-www-form-urlencoded',referer:shop+'/koszyk',origin:shop},maxRedirects:0,timeout:30000});
    onRequest({method:'POST',endpoint:shop+'/cart/',status:response.status(),durationMs:Math.round(performance.now()-start)});assert([200,302,303].includes(response.status()),'Nie zapisano rodzaju zamówienia');
    await goto(shop+'/zamowienie/dane');assert.equal(new URL(page.url()).pathname,'/zamowienie/dane','Nie otwarto danych zamówienia');
    const dataConsent=page.getByRole('button',{name:'Akceptuję',exact:true});if(await dataConsent.isVisible())await dataConsent.press('Enter');
    const paymentId=await page.locator('input[name="checkout_form[payments][0][method]"][value=bank_transfer]').getAttribute('id');assert(/^checkout_form_payments_0_method_\d+$/.test(paymentId),'Nie rozpoznano płatności');const payment=page.locator('label[for="'+paymentId+'"]');
    assert.equal(await payment.count(),1,'Brak przelewu bez zewnętrznej bramki');await payment.click();
    await page.locator('label[for=checkout_form_activationMethod_0]').click();
    await page.locator('#checkout_form_orderDetails_phoneNumber').fill(address.phoneNumber??'123456789');
    await page.getByRole('button',{name:/^Dalej/}).click();
    if(new URL(page.url()).pathname==='/zamowienie/dane'){
     for(const [key,value]of Object.entries({firstName:'Test',lastName:'QA',street:address.street,streetNumber:address.streetNumber,postcode:address.postcode,city:address.city})){const field=page.locator('#checkout_form_billingAddress_'+key);if(await field.isVisible()){assert(value,'Brak testowego adresu '+key);await presentation.inspect(page,field,'Wpisuję testowe pole adresu: '+key);await field.fill(value);}}
     await page.getByRole('button',{name:/^Dalej/}).click();
    }
    await page.waitForURL(u=>u.pathname==='/zamowienie/podsumowanie',{waitUntil:'domcontentloaded'});
    onProgress('RETAIL: odczyt nazwy wariantu w podsumowaniu');
    const rows=await page.locator('main table tr').evaluateAll(rows=>rows.slice(1).map(row=>[...row.querySelectorAll('td')].map(cell=>cell.textContent.trim())));
    await presentation.inspect(page,page.locator('main table'),'Porównuję nazwę produktu w podsumowaniu');return {rows,url:page.url()};
   },
   async cleanupRetailCart(){
    if(!ownedRetail)return {attempted:false};await goto(shop+'/koszyk');
    const own=page.locator('main form[action="'+ownedRetail.action+'"]');assert.equal(await own.count(),1,'Nie znaleziono dokładnej własnej pozycji QA — niczego nie usunięto');
    const links=await page.locator('main a[href*="/product/"]').evaluateAll(links=>links.map(a=>a.textContent.trim()).filter(Boolean));assert.deepEqual(links,[ownedRetail.name],'Koszyk zmienił się zewnętrznie — niczego nie usunięto');
    onProgress('RETAIL: usunięcie własnej pozycji QA po próbie bez zapisu');const action=ownedRetail.action;
    await page.getByRole('button',{name:'icon_del_items',exact:true}).click();await page.getByRole('button',{name:'Usuń',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('Twój koszyk jest pusty.'));ownedRetail=null;
    if(directory)await page.screenshot({path:path.join(directory,'retail-cart-cleaned.png'),fullPage:false});return {attempted:true,restoredEmpty:true,ownItemAction:action};
   },
   async completeRetail(){
    assert.equal(page.url(),shop+'/zamowienie/podsumowanie','Brak gotowego podsumowania');
    await presentation.inspect(page,page.locator('main table'),'Zapis jednego zamówienia QA RETAIL');
    await page.locator('label[for=complete_form_regulations]').click();
    const start=performance.now();const [response]=await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===shop+'/zamowienie/podsumowanie'),page.getByRole('button',{name:/^Zamawiam i płacę/}).click()]);
    onRequest({method:'POST',endpoint:shop+'/zamowienie/podsumowanie',status:response.status(),durationMs:Math.round(performance.now()-start)});
    const destination=response.headers().location;if(destination){const token=new URL(destination,shop).pathname.match(/^\/zamowienia\/([^/]+)\//)?.[1];if(token)onSecret(token);}
    await page.waitForURL(u=>/^\/zamowienia\/[^/]+\/dziekujemy$/.test(u.pathname),{waitUntil:'domcontentloaded'});
    const text=await page.locator('main').innerText(),number=text.match(/Zamówienie nr\s+(\d+)\s+zostało przyjęte/)?.[1];assert(number,'Brak potwierdzonego numeru zamówienia');ownedRetail=null;return {number};
   },
   async savedRetail(number){
    assert(/^\d{4,}$/.test(number));await goto(cms+'/orders/?sorting%5Bdate%5D=desc&page=1');
    const link=page.getByRole('link',{name:'#'+number,exact:true});assert.equal(await link.count(),1,'Brak zapisanego zamówienia na najnowszej stronie CMS');
    await Promise.all([page.waitForURL(u=>/^\/orders\/\d+$/.test(u.pathname)),link.click()]);assert((await page.locator('h1').innerText()).includes(number),'Inne zamówienie CMS');
    const rows=await page.locator('table').first().evaluate(t=>[...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent.trim().replace(/\s+/g,' '))).filter(r=>r.length>=10));
    await presentation.inspect(page,page.locator('table').first(),'Odczyt zapisanego Order RETAIL');
    const pdfLink=page.getByRole('link',{name:/Pobierz PDF z zamówieniem/});const pdfUrl=new URL(await pdfLink.getAttribute('href'),cms);const csrf=pdfUrl.searchParams.get('_csrf_token');if(csrf)onSecret(csrf);
    const [download]=await Promise.all([page.waitForEvent('download'),pdfLink.click()]);
    await mkdir(directory,{recursive:true});await download.saveAs(path.join(directory,'retail-potwierdzenie.pdf'));return {number,rows,pdfFile:'retail-potwierdzenie.pdf'};
   },
   async offer(s){await goto(shop+'/product/'+encodeURIComponent(s.slug));await page.locator('#special-offer-configurator').waitFor();await presentation.inspect(page,page.locator('#special-offer-configurator'),'Sprawdzam produkty i ilości oferty');return {text:await page.locator('main').innerText(),links:await page.locator('#special-offer-configurator a[href]').evaluateAll(items=>items.map(a=>({href:a.href,text:a.textContent.trim()})))};},
   async mailhog(){
    await goto('https://mailhog.gwodev.pl/');
    // An initial Inbox (0) is a placeholder, not proof that loading has finished.
    // A non-empty list proves this known shared DEV inbox has received its data.
    await page.locator('[ng-repeat="message in messages"]').first().waitFor({timeout:45000});
    const reader=createMailhogReader({cookies:await context.cookies('https://mailhog.gwodev.pl/'),signal});
    const baseline=await reader.baseline(mailRecipient);
    return {loaded:true,visibleMessages:await page.locator('[ng-repeat="message in messages"]').count(),messagesForTestAccount:baseline.count,baselineReadAt:baseline.notBefore,note:'Tylko odczyt gotowości i migawki ID. Nie uruchomiono wysyłki ani kontroli doręczenia.'};
   },
   async mailbox(recipient){await goto('https://mailhog.gwodev.pl/');await page.locator('[ng-repeat="message in messages"]').first().waitFor({timeout:45000});const reader=createMailhogReader({cookies:await context.cookies('https://mailhog.gwodev.pl/'),signal});return {reader,baseline:await reader.baseline(recipient)};},
   async mailReader(){await goto('https://mailhog.gwodev.pl/');await page.locator('[ng-repeat="message in messages"]').first().waitFor({timeout:45000});return createMailhogReader({cookies:await context.cookies('https://mailhog.gwodev.pl/'),signal});},
   async screenshot(name){if(directory){await mkdir(directory,{recursive:true});await page.screenshot({path:path.join(directory,name+'.png'),fullPage:false});}},
   close:()=>browser.close()
  };
 }catch(e){await browser.close();throw e;}
}
export async function runDescriptionWeb(config,credentials,options={}){
 const settings=options.settings??JSON.parse(await readFile('config/description-web.local.json','utf8'));validateWebFixtures(settings);
 const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — CMS i frontend RETAIL','descriptions');
 const {report,test,skip}=c;report.scopeNote='Kontrole odczytu na rzeczywistych formularzach CMS i stronach RETAIL. Oczekiwania nazw/slugów pochodzą z jawnych fixture i niezależnego odczytu głównych pól CMS. Nie zmienia produktów, nie dodaje do koszyka, nie finalizuje zamówień i nie wysyła wiadomości. Kontrole częściowe mają opisane granice; nie są pełnym zaliczeniem frontendów, PDF, maili ani generatora URL.';
 report.reference={products:settings.products,offer:settings.offer,courses:settings.courses};
 let adapter,primarySource;const sources=new Map(),retailSnapshots=new Map();
 try{
  adapter=options.adapter??await connectDescriptionWeb({...options,mailRecipient:credentials.email,directory:c.directory,onRequest:r=>report.requests.push(r)});
  const forms=[{name:'oferta specjalna',url:cms+'/admin/special-offers/'+settings.offer.id+'/edit',selector:'#special_offer_product_code',expected:settings.offer.code},...settings.courses.map(p=>({name:p.kind==='paid'?'szkolenie dla nauczycieli':'szkolenie dla rad',url:cms+'/academy/admin/'+p.kind+'-courses/'+p.id+'/edit',selector:'#'+p.kind+'_course_product_translations_pl_PL_name',expected:p.name}))];
  for(const f of forms)await test('DESC-002: ukrycie opisów kanałowych — '+f.name,async()=>{const actual=await adapter.form(f.url,f.selector,f.expected);assertHiddenChannelFields(actual);await adapter.screenshot('hidden-'+(f.name==='oferta specjalna'?'offer':f.selector.startsWith('#paid')?'paid':'closed'));return 'Potwierdzono formularz '+f.url+', brak zakładki oraz pól channelTranslations. Bez zapisu.';},['DESC-002']);
  await test('DESC-001: widoczna sekcja i kanały zwykłego produktu QA',async()=>{const actual=primarySource=await adapter.product(settings.products[0]);assert(actual.channelSectionVisible,'Sekcja opisów kanałowych niewidoczna');assert.deepEqual(Object.keys(actual.channels).sort(),['EMPIK','WHOLESALE']);await adapter.screenshot('regular-product-channels');return 'Zwykły produkt QA: sekcja widoczna, formularze EMPIK i WHOLESALE obecne. Bez zapisu.';},['DESC-001']);
  for(const p of settings.products){
   const ready=await test('DESC-020: niezależny wzorzec CMS — '+p.code,async()=>{const reused=p.id===settings.products[0].id&&primarySource;const actual=reused||await adapter.product(p);if(reused)report.reference.reusedCmsSource={productId:p.id,sourceCheck:'DESC-001',usedBy:'DESC-020',scope:'Ten sam moduł odczytu, bez zapisu i bez ponownej nawigacji CMS.'};sources.set(p.id,actual);assert.equal(actual.name,p.name,'Fixture nazwy nie odpowiada CMS');assert.equal(actual.slug,p.slug,'Fixture slugu nie odpowiada CMS');return 'Główne name i slug potwierdzone w CMS. '+(reused?'Wykorzystano odczyt z DESC-001 tego samego modułu bez zapisu. ':'')+'Pola kanałowe nie zastępują wzorca RETAIL.';},['DESC-020']);
   if(ready)await test('DESC-020: RETAIL — nazwa i główny slug strony '+p.code,async()=>{const actual=await adapter.retailProduct(p);retailSnapshots.set(p.id,actual);assert.equal(actual.name,p.name);assert.equal(actual.url,shop+'/product/'+encodeURIComponent(p.slug));await adapter.screenshot('retail-'+p.code);return 'Widoczna nazwa i URL strony zgodne z głównymi polami CMS. Pełny opis, listy, wyszukiwarka i paginacja mają osobne wyniki kontroli.';},['DESC-020']);
   if(ready)await test('DESC-020: RETAIL — pełny opis '+p.code,async()=>{const source=sources.get(p.id),actual=retailSnapshots.get(p.id)??await adapter.retailProduct(p);report.tables.push({title:'Pełny opis RETAIL — '+p.code,headers:['Źródło CMS','Oczekiwano','Odczytano na stronie'],rows:[['ProductTranslation.description',source.descriptionText,actual.description]]});compareRetailDescription(actual,source);return 'Porównano cały tekst opisu z głównym polem CMS, także gdy jest pusty. Nie użyto tłumaczenia WHOLESALE jako wzorca.';},['DESC-020']);
   else skip('DESC-020: strona RETAIL '+p.code,'Nie porównano strony z niepotwierdzonym wzorcem CMS.',['DESC-020'],'dependency');
  }
  if(settings.searchProducts?.length)await test('DESC-020: RETAIL — nazwy i slugi w wyszukiwarce',async()=>{for(const p of settings.searchProducts){const source=await adapter.product(p);assert.equal(source.name,p.name,'Wzorzec CMS wyszukiwarki: nazwa');assert.equal(source.slug,p.slug,'Wzorzec CMS wyszukiwarki: slug');}const pages=await adapter.retailCatalog({query:settings.searchQuery});const items=pages.flatMap(p=>p.items);report.tables.push({title:'Wyszukiwanie RETAIL — rzeczywiście odczytane strony',headers:['Strona','Liczba pozycji','Nazwy i URL'],rows:pages.map(p=>[p.url,p.items.length,JSON.stringify(p.items)])});for(const p of settings.searchProducts){const matching=items.filter(a=>a.href===shop+'/product/'+encodeURIComponent(p.slug));assert.equal(matching.length,1,'Wyszukiwarka: brak lub duplikat '+p.code);assert.equal(matching[0].text,p.name,'Wyszukiwarka: inna nazwa '+p.code);}return 'Wyszukiwanie przez rzeczywisty formularz. Odczytano '+pages.length+' stron do końca wyników; główne nazwy i slugi skonfigurowanych produktów zgodne z niezależnym CMS. Produktów A/B bez potwierdzenia przypisania do katalogu RETAIL nie wymagamy w wynikach.';},['DESC-020']);
  else skip('DESC-020: wyszukiwarka RETAIL','Brak niezależnej fixture produktu należącego do katalogu RETAIL.',['DESC-020'],'data_missing');
  await test('DESC-020: RETAIL — pierwsze dwie strony listy produktów',async()=>{const pages=await adapter.retailCatalog();assert.equal(pages.length,2,'Brak drugiej strony listy');for(const p of pages){assert.equal(p.items.length,10,'Inna liczba pozycji na stronie');assert(p.items.every(a=>a.text&&a.href.startsWith(shop+'/product/')),'Puste nazwy lub błędne linki');assert.equal(new Set(p.items.map(a=>a.href)).size,p.items.length,'Duplikat na stronie');}const first=new Set(pages[0].items.map(a=>a.href));assert(!pages[1].items.some(a=>first.has(a.href)),'Powtórzone produkty między stronami');await adapter.screenshot('retail-pagination');return 'Dwie kolejne strony po 10 produktów, widoczne niepuste nazwy i linki, bez duplikatów na stronie i pomiędzy stronami. To kontrola paginacji, nie niezależny wzorzec nazw wszystkich produktów katalogu.';},['DESC-020']);
  if(settings.application){
   const ready=await test('DESC-023: RETAIL — otwarcie aplikacji QA i nazwa główna',async()=>{const actual=await adapter.application(settings.application);assert.equal(actual.name.trim(),settings.application.name);await adapter.screenshot('retail-application');return 'Strona aplikacji odpowiedziała HTTP 200, a nazwa jest zgodna z główną nazwą CMS.';},['DESC-023']);
   await test('DESC-020: RETAIL — niepusty pełny opis aplikacji',async()=>{const source=await adapter.product(settings.application);sources.set(settings.application.id,source);assert(plainText(source.descriptionText),'Brak niepustego opisu aplikacji');const actual=await adapter.retailProduct(settings.application);compareRetailDescription(actual,source);report.tables.push({title:'Niepusty opis aplikacji RETAIL',headers:['CMS','Strona produktu'],rows:[[source.descriptionText,actual.description]]});return 'Cały niepusty opis aplikacji zgodny z głównymi danymi CMS.';},['DESC-020']);
   skip('DESC-023: liczby dostępów nauczycielskich i uczniowskich',ready?'Osobny moduł descriptions-retail-cart sprawdza Matlandię: 1 dostęp nauczycielski i 11 uczniowskich.':'Strona aplikacji nie działa; nie można sprawdzić konfiguratora dostępów.',['DESC-023'],ready?'out_of_scope':'dependency');
  }
  await test('DESC-027: RETAIL — nazwy i linki produktów dołączonych do oferty',async()=>{const actual=await adapter.offer(settings.offer);assert(actual.text.includes(settings.offer.name),'Brak własnej nazwy oferty');compareOfferLinks(actual.links,settings.products);await adapter.screenshot('retail-offer');report.tables.push({title:'Produkty w ofercie RETAIL — rzeczywiste linki i nazwy',headers:['Nazwa','URL'],rows:actual.links.map(p=>[p.text,p.href])});return 'Dwa dołączone produkty: dokładne główne nazwy i slugi. Strony docelowe są osobnymi kontrolami i mają własne wyniki. To zakres RETAIL; nie potwierdza oferty WHOLESALE ani wygenerowanego shortDescription.';},['DESC-027']);
  await test('DESC-026: link CMS „Pokaż produkt” dla oferty RETAIL',async()=>{const actual=await adapter.form(forms[0].url,forms[0].selector,forms[0].expected);assert.deepEqual(actual.showLinks,[shop+'/product/'+encodeURIComponent(settings.offer.slug)]);return 'Sprawdzono rzeczywisty link wygenerowany w CMS i działający widok oferty. Pozostałe kanały i inne miejsca generatora URL poza tym przebiegiem.';},['DESC-026']);
  if(settings.category&&settings.application)await test('DESC-020: RETAIL — kategoria, nazwa, slug i niepusty krótki opis',async()=>{const p=settings.application,source=sources.get(p.id)??await adapter.product(p);const pages=await adapter.retailCatalog({category:settings.category});compareCategoryProduct(pages,p,source,settings.category);report.tables.push({title:'Kategoria RETAIL — '+settings.category.label,headers:['Strona','Odczytane produkty'],rows:pages.map(page=>[page.url,JSON.stringify(page.items)])});report.tables.push({title:'Krótki opis: niezależny wzorzec CMS',headers:['Produkt','Główna nazwa','Główny slug','Krótki opis'],rows:[[p.code,source.name,source.slug,source.shortDescriptionText]]});await adapter.screenshot('retail-category');return 'Rzeczywisty filtr kategorii, wszystkie strony wyniku (maks. 8), bez duplikatów. Nazwa, slug i cały niepusty krótki opis aplikacji porównane z głównymi polami CMS. Pozostałe produkty listy sprawdzono strukturalnie; nie potwierdza to ich przypisań do kategorii w bazie.';},['DESC-020']);
  else skip('DESC-020: lista kategorii i krótki opis','Brak konfiguracji category i application w description-web.local.json.',['DESC-020'],'data_missing');
  for(const [id,title,reason]of [
   ['DESC-010','tworzenie nowego produktu','Nie wykonywano zapisu nowego produktu. Potrzebna kontrola utworzenia, braku rekordów kanałowych i późniejszego dodania tłumaczeń.'],
   ['DESC-022','wygenerowany opis oferty','Wygenerowany opis oferty sprawdza osobny moduł descriptions-retail-cart.'],
   ['DESC-023','aplikacja i liczby dostępów','Liczby dostępów sprawdza osobny moduł descriptions-retail-cart.'],
   ['DESC-024','treść PDF','Nie wygenerowano ani nie odczytano treści PDF zamówienia z kontrolowanymi nazwami.'],
   ['DESC-025','treść wiadomości e-mail','Dostęp do MailHoga nie potwierdza nowej wiadomości. Wymagany odbiorca, identyfikator nowej próby i porównanie treści.'],
   ['DESC-029','powiadomienie o dostępności','Nie zmieniono zapasów ani nie uruchomiono powiadomienia. Wymagany unikalny zapis QA i identyfikacja wiadomości tej próby.']
  ]){if(id==='DESC-023'&&settings.application)continue;skip(id+': '+title,reason,[id],'out_of_scope');}
 }catch(e){report.tests.push({name:'Przygotowanie / przebieg przeglądarki',status:'FAIL',detail:c.api.clean(e.message)});}
 finally{await adapter?.close();}
 return c.finish();
}
