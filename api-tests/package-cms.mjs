import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {browserLaunchOptions} from './browser-options.mjs';
import {installBrowserPresentation} from './browser-presentation.mjs';

const origin='https://cms-ksiegarnia.gwodev.pl';
export const sortedFields=fields=>[...fields].sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv));
export async function connectPackageCms({vars=process.env,sessionFile='.auth/dev.json',onRequest=()=>{},onSecret=()=>{},directory}={}){
 const {chromium}=await import('playwright');const browser=await chromium.launch(browserLaunchOptions(vars));
 try{
  const context=await browser.newContext({storageState:JSON.parse(await readFile(sessionFile,'utf8'))});
  const presentation=await installBrowserPresentation(context,{vars}),page=await context.newPage();page.setDefaultTimeout(25000);
  const goto=async route=>{assert(route==='/'||/^\/[a-z0-9/?_=&%-]+$/i.test(route),'Niedozwolona ścieżka CMS');const r=await page.goto(origin+route,{waitUntil:'domcontentloaded'});assert.equal(new URL(page.url()).origin,origin,'Odśwież sesję GitLab');onRequest({method:'GET',endpoint:origin+route.split('?')[0],status:r?.status()});assert.equal(r?.status(),200,'Odczyt CMS '+route+' HTTP '+r?.status());};
  await goto('/');
  if(new URL(page.url()).pathname==='/login'){
   assert(vars.SYLIUS_ADMIN_EMAIL&&vars.SYLIUS_ADMIN_PASSWORD,'Brak administratora CMS');
   onSecret(vars.SYLIUS_ADMIN_EMAIL);onSecret(vars.SYLIUS_ADMIN_PASSWORD);
   await page.locator('input[name="_username"]').fill(vars.SYLIUS_ADMIN_EMAIL);await page.locator('input[name="_password"]').fill(vars.SYLIUS_ADMIN_PASSWORD);
   await Promise.all([page.waitForURL(u=>u.pathname!=='/login'),page.locator('button[type="submit"]').click()]);
  }
  const form=async(route,prefix)=>{
   if(!route.includes('?'))route+='?_channel_code=WHOLESALE';
   await goto(route);const result=await page.locator('#'+prefix+'_code').evaluate(e=>{const fields=[...new FormData(e.form).entries()].filter(([,v])=>typeof v==='string');const disabled=[...e.form.querySelectorAll('input[disabled][name],select[disabled][name]')].filter(i=>!['checkbox','radio'].includes(i.type)||i.checked).map(i=>[i.name,i.value]);return {action:e.form.action,fields,referenceFields:[...fields,...disabled]};});
   assert.equal(result.action.split('?')[0],origin+route.split('?')[0]);
   for(const [key,value]of result.fields)if(/token/i.test(key))onSecret(value);
   return {route,fields:sortedFields(result.referenceFields.filter(([key])=>!/token/i.test(key))),live:result.fields};
  };
  return {
   async references(){
    const output={shipping:[],payments:[],readAt:new Date().toISOString()};
    for(const [kind,prefix,target]of [['shipping-methods','sylius_shipping_method','shipping'],['payment-methods','sylius_payment_method','payments']]){
     await goto('/'+kind+'/?_channel_code=WHOLESALE');
     const links=await page.locator('table tbody a[href]').evaluateAll((links,kind)=>[...new Set(links.map(a=>a.getAttribute('href')).filter(h=>new RegExp('^/'+kind+'/[0-9]+/edit$').test(h)))],kind);
     assert(links.length>0&&links.length<=20,'Nie odczytano całej listy metod CMS');
     for(const route of links){const f=await form(route,prefix),values=new URLSearchParams(f.fields);
      // Płatności spoza kanału hurtowego i bramki internetowe nie są wzorcami testów.
      if(target==='payments'&&(!values.getAll(prefix+'[channels][]').includes('WHOLESALE')||values.get(prefix+'[gatewayConfig][factoryName]')!=='offline'))continue;
      output[target].push({route,fields:f.fields.filter(([key])=>!key.includes('[gatewayConfig]'))});
     }
    }
    await goto('/tax-rates/');output.taxRows=await page.locator('table tbody tr').allTextContents();
    return output;
   },
   async pickup(){const {live,...state}=await form('/shipping-methods/4/edit','sylius_shipping_method');assert.equal(new URLSearchParams(state.fields).get('sylius_shipping_method[code]'),'personal_collection');return state;},
   async savePickup(expected,next){
    const current=await form('/shipping-methods/4/edit','sylius_shipping_method');assert.deepEqual({route:current.route,fields:current.fields},expected,'Odbiór własny zmieniony poza testem');
    const allowed=new Set(['sylius_shipping_method[channels][]','sylius_shipping_method[categoryRequirement]']);
    assert.deepEqual(current.fields.filter(([key])=>!allowed.has(key)),next.fields.filter(([key])=>!allowed.has(key)),'Niedozwolona zmiana odbioru własnego');
    const body=new URLSearchParams(current.live);
    for(const key of allowed){body.delete(key);for(const [name,value]of next.fields)if(name===key)body.append(key,value);}
    await presentation.form(page,body,'Tymczasowa dostępność odbioru własnego dla #36618');
    const r=await context.request.post(origin+current.route,{data:body.toString(),headers:{'content-type':'application/x-www-form-urlencoded',origin,referer:origin+current.route},maxRedirects:0,timeout:30000});
    onRequest({method:'POST',endpoint:origin+current.route,status:r.status()});assert([302,303].includes(r.status()),'Zapis odbioru własnego HTTP '+r.status()+'; nie ponawiam');
    assert.deepEqual(await this.pickup(),next,'Nie potwierdzono ustawień odbioru własnego');
   },
   async savedOrder(order){
    assert(Number.isSafeInteger(order.id)&&order.id>0&&/^\d+$/.test(String(order.number)),'Brak tożsamości zamówienia');
    await goto('/orders/'+order.id);const heading=await page.locator('h1').innerText();assert(heading.includes(String(order.number)),'Inne zamówienie w CMS');
    const rows=await page.locator('table').first().evaluate(t=>[...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent.replace(/\s+/g,' ').trim())).filter(r=>r.length));
    const content=await page.locator('#content, .pusher, main').first().innerText().catch(()=>page.locator('body').innerText());
    if(directory){await mkdir(directory,{recursive:true});await page.screenshot({path:path.join(directory,'cms-zamowienie-'+order.id+'.png'),fullPage:true});}
    return {heading,rows,content};
   },
   async downloadOrderPdf(order,file){
    if(new URL(page.url()).pathname!=='/orders/'+order.id)await this.savedOrder(order);
    const link=page.getByRole('link',{name:/Pobierz PDF z zamówieniem/});assert.equal(await link.count(),1,'Brak jednego linku PDF zamówienia');
    const url=new URL(await link.getAttribute('href'),origin);assert([origin,'https://ksiegarnia.gwodev.pl'].includes(url.origin),'PDF poza dev');
    const csrf=url.searchParams.get('_csrf_token');if(csrf)onSecret(csrf);
    const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);
    await download.saveAs(file);onRequest({method:'GET',endpoint:'/documents/cms-order-summary',status:200});
   },
   close:()=>browser.close()
  };
 }catch(e){await browser.close();throw e;}
}
