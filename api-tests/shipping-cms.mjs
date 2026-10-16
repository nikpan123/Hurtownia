import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {saveFeatureReport} from './feature-report.mjs';

const cmsUrl='https://cms-ksiegarnia.gwodev.pl/shipping-methods/6/edit?_channel_code=WHOLESALE';
export function validateShippingProfile(p){
  assert(p&&Number.isInteger(p.singlePackageWeight)&&p.singlePackageWeight>0&&p.singlePackageWeight<=1000000,'Waga paczki: 1–1000000 g');
  assert(typeof p.priceIsNet==='boolean','priceIsNet musi być true/false');assert.equal(p.taxPercent,5,'Ten profil dotyczy kategorii Książki / VAT 5%; nie zmienia kategorii podatkowej CMS');
  assert(Array.isArray(p.weightRanges)&&p.weightRanges.length>0&&p.weightRanges.length<=10,'Potrzebne 1–10 przedziałów');
  let end=-1;for(const r of p.weightRanges){assert([r.from,r.to,r.priceMinor].every(Number.isSafeInteger)&&r.from===end+1&&r.to>=r.from&&r.priceMinor>=0&&r.priceMinor<=1000000,'Przedziały od 0, bez luk i nakładania; ceny w groszach');end=r.to;}
  return p;
}
async function connect({vars,sessionFile}){
  const {chromium}=await import('playwright');const browser=await chromium.launch({channel:vars.BROWSER_CHANNEL??'msedge',headless:true});
  try{
    const state=JSON.parse(await readFile(sessionFile,'utf8'));const context=await browser.newContext({storageState:state});const page=await context.newPage();page.setDefaultTimeout(20000);
    await page.goto(cmsUrl);
    if(new URL(page.url()).hostname!=='cms-ksiegarnia.gwodev.pl')throw new Error('Odśwież sesję GitLab przez Zaloguj-dev.cmd');
    if(new URL(page.url()).pathname==='/login'){
      assert(vars.SYLIUS_ADMIN_EMAIL&&vars.SYLIUS_ADMIN_PASSWORD,'Uzupełnij dane administratora CMS w .env');
      await page.locator('input[name="_username"]').fill(vars.SYLIUS_ADMIN_EMAIL);await page.locator('input[name="_password"]').fill(vars.SYLIUS_ADMIN_PASSWORD);
      await Promise.all([page.waitForURL(u=>u.pathname!=='/login'),page.locator('button[type="submit"]').click()]);await page.goto(cmsUrl);
    }
    const read=async()=>{
      await page.goto(cmsUrl);assert.equal(await page.locator('#sylius_shipping_method_code').inputValue(),'gls_wholesale','Niewłaściwa metoda dostawy');
      assert.equal(await page.locator('#sylius_shipping_method_calculator').inputValue(),'weight_range_shipping','Metoda nie używa kalkulatora paczek');
      assert.equal(await page.locator('#sylius_shipping_method_taxCategory').inputValue(),'books','Niepotwierdzona kategoria VAT');
      const rows=await page.locator('#sylius_shipping_method_configuration_weightRanges div[id^="sylius_shipping_method_configuration_weightRanges_"]').all();
      const weightRanges=[];for(const row of rows)weightRanges.push({from:Number(await row.locator('input[id$="_orderWeightFrom"]').inputValue()),to:Number(await row.locator('input[id$="_orderWeightTo"]').inputValue()),priceMinor:Math.round(Number((await row.locator('input[id$="_pricePerPackage"]').inputValue()).replace(',','.'))*100)});
      return validateShippingProfile({singlePackageWeight:Number(await page.locator('#sylius_shipping_method_configuration_singlePackageWeight').inputValue()),priceIsNet:await page.locator('#sylius_shipping_method_configuration_priceIsNet').isChecked(),taxPercent:5,weightRanges});
    };
    const write=async profile=>{
      const current=await read();assert.equal(current.weightRanges.length,profile.weightRanges.length,'Profil musi mieć tyle przedziałów co CMS; liczba wierszy nie jest zmieniana automatycznie');
      await page.locator('#sylius_shipping_method_configuration_singlePackageWeight').fill(String(profile.singlePackageWeight));
      const toggle=page.locator('#sylius_shipping_method_configuration_priceIsNet');if(await toggle.isChecked()!==profile.priceIsNet)await page.locator('.ui.checkbox').filter({has:toggle}).click();
      for(let i=0;i<profile.weightRanges.length;i++)for(const [field,value]of Object.entries({orderWeightFrom:profile.weightRanges[i].from,orderWeightTo:profile.weightRanges[i].to,pricePerPackage:(profile.weightRanges[i].priceMinor/100).toFixed(2).replace('.',',')}))await page.locator('#sylius_shipping_method_configuration_weightRanges_'+i+'_'+field).fill(String(value));
      await Promise.all([page.waitForNavigation(),page.locator('#sylius_save_changes_button').click()]);assert.deepEqual(await read(),profile,'CMS nie potwierdził zapisanej konfiguracji');
    };
    return {read,write,screenshot:file=>page.screenshot({path:file}),close:()=>browser.close()};
  }catch(e){await browser.close();throw e;}
}

// Journal pozostaje na dysku po zabiciu procesu; kolejny test nie nadpisze kopii.
export async function withShippingConfiguration(options,run){
  validateShippingProfile(options.profile);const file=options.journalFile??path.resolve('.auth/shipping-restore.json');await mkdir(path.dirname(file),{recursive:true});
  const adapter=options.adapter??await connect(options);let journal,result,restoreError,ownsJournal=false;
  try{
    const original=await adapter.read();assert.equal(original.weightRanges.length,options.profile.weightRanges.length,'Liczba zakresów profilu musi odpowiadać CMS');
    journal={url:cmsUrl,createdAt:new Date().toISOString(),original,applied:options.profile,status:'pending'};
    try{await writeFile(file,JSON.stringify(journal,null,2),{flag:'wx'});ownsJournal=true;}catch(e){if(e.code==='EEXIST')throw new Error('Istnieje niedokończone przywracanie .auth/shipping-restore.json. Użyj npm run packages:restore przed kolejną zmianą.');throw e;}
    options.signal?.throwIfAborted();options.onProgress?.('CMS: zapis konfiguracji tymczasowej');await adapter.write(options.profile);options.signal?.throwIfAborted();result=await run();
  }finally{
    if(ownsJournal){
      try{options.onProgress?.('CMS: przywracanie ustawień początkowych');const current=await adapter.read();assert(isDeepStrictEqual(current,journal.original)||isDeepStrictEqual(current,journal.applied),'Konfiguracja CMS została zmieniona poza testem. Kopia pozostaje w .auth/shipping-restore.json; wymagane ręczne uzgodnienie zmian.');await adapter.write(journal.original);assert.deepEqual(await adapter.read(),journal.original,'Przywrócenie niepotwierdzone');journal.status='restored';journal.restoredAt=new Date().toISOString();if(result){await writeFile(path.join(result.directory,'shipping-config-audit.json'),JSON.stringify(journal,null,2));if(adapter.screenshot)await adapter.screenshot(path.join(result.directory,'shipping-restored.png'));}await unlink(file);
      }catch(e){restoreError=e;}
    }
    await adapter.close();
    if(result){result.report.tables.push({title:'Tymczasowa konfiguracja CMS',headers:['Operacja','Wynik'],rows:[['Przywrócenie ustawień',restoreError?'FAIL: '+restoreError.message:'Potwierdzone odczytem CMS']]});if(restoreError){result.report.status='FAIL';result.report.tests.push({name:'Przywrócenie konfiguracji CMS',status:'FAIL',detail:restoreError.message});}await saveFeatureReport(result.report,result.directory);}
    if(restoreError)throw Object.assign(new Error('Nie udało się przywrócić GLS: '+restoreError.message),{code:'RESTORE_FAILED'});
  }
  return result;
}
export async function restoreShippingConfiguration(options){
  const file=options.journalFile??path.resolve('.auth/shipping-restore.json');const journal=JSON.parse(await readFile(file,'utf8'));validateShippingProfile(journal.original);validateShippingProfile(journal.applied);const adapter=options.adapter??await connect(options);
  try{const current=await adapter.read();assert(isDeepStrictEqual(current,journal.applied)||isDeepStrictEqual(current,journal.original),'CMS zmieniony poza testem — uzgodnij zmiany ręcznie');await adapter.write(journal.original);assert.deepEqual(await adapter.read(),journal.original);await unlink(file);}finally{await adapter.close();}
}
