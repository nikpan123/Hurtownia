import {installBrowserPresentation} from './browser-presentation.mjs';
import {browserLaunchOptions} from './browser-options.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCustomEmail} from '../dashboard/custom-user.mjs';
const base='https://cms-ksiegarnia.gwodev.pl';
export function cmsBrowserLaunchError(error){
  if(error.code!=='EPERM'&&!/spawn EPERM/.test(error.message??''))return error;
  return Object.assign(new Error('Nie można uruchomić przeglądarki do odczytu rabatów z Syliusa (Windows: EPERM — uruchomienie procesu zablokowane). Test API koszyka jeszcze się nie rozpoczął. Zamknij panel i uruchom go ponownie przez plik Panel-testow.cmd z folderu projektu. Jeśli błąd powróci, sprawdź blokadę procesu Microsoft Edge w zabezpieczeniach Windows. Nie zmieniono rabatów ani nie zapisano zamówienia.'),{code:'CMS_BROWSER_BLOCKED',cause:error});
}
export function parseRebateFields(fields,id){
  const prefix='promotions_promotionList_wholesaler_'+id+'_',rebates={};
  for(const f of fields){if(!f.id.startsWith(prefix)||!f.id.endsWith('_value'))continue;const code=f.id.slice(prefix.length,-6),key=code==='WHOLESALE_ADAMADA'?'adamada':code;const value=Number(f.value.replace(',','.'));assert(f.value.trim()&&Number.isFinite(value)&&value>=0&&value<=100,'Nieprawidłowy rabat CMS: '+key);assert(!Object.hasOwn(rebates,key),'Powtórzony rabat CMS');rebates[key]=value;}
  for(const code of ['bank_transfer','cash_on_delivery','bank_transfer_1_day','payment_timely','adamada'])assert(Object.hasOwn(rebates,code),'Brak rabatu CMS: '+code);
  return rebates;
}
export async function readWholesalerRebates(email,{vars=process.env,sessionFile='.auth/dev.json',signal}={}){
  validateCustomEmail(email);const {chromium}=await import('playwright');let browser;
  try{browser=await chromium.launch(browserLaunchOptions(vars));}catch(error){throw cmsBrowserLaunchError(error);}
  const abort=()=>{browser.close().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  try{
    signal?.throwIfAborted();const context=await browser.newContext({storageState:JSON.parse(await readFile(sessionFile,'utf8'))});const presentation=await installBrowserPresentation(context,{vars});const page=await context.newPage();page.setDefaultTimeout(20000);
    const list=base+'/wholesale/admin/wholesaler';await page.goto(list);
    assert.equal(new URL(page.url()).hostname,new URL(base).hostname,'Odśwież sesję GitLab.');
    if(new URL(page.url()).pathname==='/login'){
      assert(vars.SYLIUS_ADMIN_EMAIL&&vars.SYLIUS_ADMIN_PASSWORD,'Uzupełnij dane administratora CMS.');await page.locator('input[name="_username"]').fill(vars.SYLIUS_ADMIN_EMAIL);await page.locator('input[name="_password"]').fill(vars.SYLIUS_ADMIN_PASSWORD);await Promise.all([page.waitForURL(u=>u.pathname!=='/login'),page.locator('button[type="submit"]').click()]);
    }
    const url=new URL(list);url.searchParams.set('criteria[email][type]','equal');url.searchParams.set('criteria[email][value]',email);await page.goto(url.href);
    const matches=await page.locator('table tbody tr').evaluateAll((rows,email)=>rows.filter(r=>Array.from(r.querySelectorAll('td')).some(td=>td.textContent.trim().toLowerCase()===email.toLowerCase())).flatMap(r=>Array.from(r.querySelectorAll('a[href]')).map(a=>a.getAttribute('href')).filter(h=>/^\/wholesale\/admin\/wholesaler\/\d+\/edit$/.test(h))),email);
    const links=[...new Set(matches)];assert.equal(links.length,1,'Nie znaleziono dokładnie jednego hurtownika dla e-maila w CMS.');await page.goto(base+links[0]);
    const id=Number(links[0].match(/\/(\d+)\/edit$/)[1]);
    const uid=await page.locator('table').evaluateAll(tables=>{for(const t of tables){const headers=Array.from(t.querySelectorAll('thead th')).map(e=>e.textContent.trim().toLowerCase()),index=headers.indexOf('uid');if(index>=0)return t.querySelector('tbody tr')?.querySelectorAll('td')[index]?.textContent.trim();}return null;});
    assert(typeof uid==='string'&&/^\d+$/.test(uid),'Nie odczytano poprawnego UID hurtownika z CMS.');
    const rebateLink=page.getByRole('link',{name:'Rabaty',exact:true});const href=await rebateLink.getAttribute('href');assert.equal(href,'/wholesale/admin/wholesaler/'+id+'/wholesaler-promotions','Nieoczekiwany adres rabatów.');await rebateLink.click();
    await presentation.inspect(page,page.locator('input[id^="promotions_promotionList_wholesaler_"]').first(),'Odczytuję rabaty wybranego hurtownika — bez zapisu');
    const fields=await page.locator('input[id^="promotions_promotionList_wholesaler_"]').evaluateAll(inputs=>inputs.map(e=>({id:e.id,value:e.value})));
    return {id,uid,rebates:parseRebateFields(fields,id),source:'Sylius CMS — odczyt rabatów po dokładnym dopasowaniu e-maila',readAt:new Date().toISOString()};
  }finally{signal?.removeEventListener('abort',abort);await browser.close();}
}
