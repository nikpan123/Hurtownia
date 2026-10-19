import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
import {descriptionContext} from './features.mjs';

const origin='https://cms-ksiegarnia.gwodev.pl';
const fields=['name','slug','description','shortDescription'];
const sameState=(a,b)=>equal({main:a.main,channels:a.channels},{main:b.main,channels:b.channels});
export function validateDescriptionCmsSettings(s){
  assert(s&&Number.isSafeInteger(s.productId)&&s.productId>0,'Podaj productId produktu QA');
  assert(typeof s.code==='string'&&/^qa-[a-zA-Z0-9_-]+$/.test(s.code),'Dozwolony jest wyłącznie produkt z kodem qa-');
  assert(typeof s.peerWholesaleSlug==='string'&&s.peerWholesaleSlug.length>0,'Podaj niezależny slug WHOLESALE innego produktu QA do kontroli kolizji');
}
export function richText(value){
  if(!value)return '';
  const blocks=JSON.parse(value);assert(Array.isArray(blocks),'Nieobsługiwany format edytora');
  assert(blocks.every(b=>b.code==='monsieurbiz.html'&&typeof b.data?.content==='string'),'Automat opisów obsługuje wyłącznie elementy HTML');
  return blocks.map(b=>b.data.content).join('');
}
const plain=value=>value.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
export async function connectDescriptionCms({settings,vars=process.env,sessionFile='.auth/dev.json'}){
  validateDescriptionCmsSettings(settings);
  const {chromium}=await import('playwright');const browser=await chromium.launch({channel:vars.BROWSER_CHANNEL??'msedge',headless:true});
  try{
    const context=await browser.newContext({storageState:JSON.parse(await readFile(sessionFile,'utf8'))});const page=await context.newPage();page.setDefaultTimeout(20000);
    const url=origin+'/products/'+settings.productId+'/edit';
    await page.goto(url);
    assert.equal(new URL(page.url()).origin,origin,'Odśwież sesję GitLab przez Zaloguj-dev.cmd');
    if(new URL(page.url()).pathname==='/login'){
      assert(vars.SYLIUS_ADMIN_EMAIL&&vars.SYLIUS_ADMIN_PASSWORD,'Brak danych administratora CMS w .env');
      await page.locator('input[name="_username"]').fill(vars.SYLIUS_ADMIN_EMAIL);await page.locator('input[name="_password"]').fill(vars.SYLIUS_ADMIN_PASSWORD);
      await Promise.all([page.waitForURL(u=>u.pathname!=='/login'),page.locator('button[type="submit"]').click()]);
    }
    const read=async()=>{
      await page.goto(url);assert.equal(new URL(page.url()).href,url,'CMS przekierował poza formularz produktu');
      assert.equal(await page.locator('#sylius_product_code').inputValue(),settings.code,'Niewłaściwy produkt QA');
      assert.equal(await page.locator('input[name="sylius_product[channels][]"][value="EMPIK"]').isChecked(),false,'Produkt QA nie może być włączony do sprzedaży w EMPIK podczas zmian opisów');
      const state=await page.locator('#sylius_product_code').evaluate(e=>{
        const form=e.form;const get=id=>form.querySelector('[id="'+id+'"]')?.value;
        const fields=['name','slug','description','shortDescription'];const main=Object.fromEntries(fields.map(k=>[k,get('sylius_product_translations_pl_PL_'+k)]));
        const channels={},indices={};
        for(const input of form.querySelectorAll('input[id^="sylius_product_channelTranslations_"][id$="_name"]')){
          let node=input,channel;
          for(let i=0;node&&i<8;i++,node=node.parentElement){const text=node.previousElementSibling?.textContent??'';const match=text.match(/\((WHOLESALE|EMPIK)\)/);if(match){channel=match[1];break;}}
          if(!channel)throw new Error('Nie odczytano nagłówka kanału');
          const index=input.id.match(/_(\d+)_name$/)[1];if(channels[channel])throw new Error('Powtórzony kanał');indices[channel]=index;
          channels[channel]=Object.fromEntries(fields.map(k=>[k,get('sylius_product_channelTranslations_'+index+'_'+k)]));
        }
        return {main,channels,indices};
      });
      for(const value of [state.main,...Object.values(state.channels)])for(const key of fields)assert.equal(typeof value[key],'string','Brak pola '+key);
      return state;
    };
    const submit=async(candidate)=>{
      const current=await read();
      assert.deepEqual(Object.keys(current.channels).sort(),Object.keys(candidate.channels).sort(),'Zmieniła się lista kanałów');
      const form=await page.locator('#sylius_product_code').evaluate(e=>({action:e.form.action,entries:[...new FormData(e.form).entries()].filter(([,v])=>typeof v==='string')}));
      assert.equal(form.action,url,'Nieoczekiwany adres formularza');
      const body=new URLSearchParams(form.entries);
      for(const [channel,values]of Object.entries(candidate.channels))for(const key of fields)body.set('sylius_product[channelTranslations]['+current.indices[channel]+']['+key+']',values[key]);
      const response=await context.request.post(url,{data:body.toString(),headers:{'content-type':'application/x-www-form-urlencoded',referer:url,origin},maxRedirects:0});
      const status=response.status();const html=await response.text();
      const location=response.headers().location;if(location)assert.equal(new URL(location,url).origin,origin,'Zapis przekierował poza CMS');
      const messages=[...html.matchAll(/<(?:div|span|li|p)[^>]*class=["'][^"']*(?:error|negative|red pointing)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|li|p)>/gi)].map(m=>plain(m[1])).filter(Boolean).slice(0,8);
      const errorTitle=status>=500?plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'').slice(0,800):undefined;
      return {status,hasErrors:/class=["'][^"']*(?:error|negative)/i.test(html),messages,...(errorTitle?{errorTitle}:{})};
    };
    return {read,submit,screenshot:file=>page.screenshot({path:file}),close:()=>browser.close()};
  }catch(e){await browser.close();throw e;}
}

export async function runDescriptionCms(config,credentials,options={}){
  const settings=options.settings??JSON.parse(await readFile('config/description-cms.local.json','utf8'));validateDescriptionCmsSettings(settings);
  const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — zapis i walidacje formularza CMS','descriptions');
  const {api,report,request}=c;report.scopeNote='Zapis formularza CMS przez HTTP z aktualnym CSRF i ponowny odczyt CMS/API. Nie sprawdza interakcji edytora JavaScript. Zmienia wyłącznie opisy kanałowe dedykowanego produktu QA i przywraca pola; nie finalizuje zamówień ani nie aktualizuje oferty Empik.';
  report.reference={productId:settings.productId,code:settings.code,peerWholesaleSlug:settings.peerWholesaleSlug};
  const journalFile=options.journalFile??path.resolve('.auth/description-cms-restore.json');await mkdir(path.dirname(journalFile),{recursive:true});
  let adapter,original,last,owns=false,journal,unsafe=false,writeBlocked=false;
  const test=async(name,fn,ids)=>{
    if(unsafe||writeBlocked){c.skip(name,'Nie wykonano po błędzie zapisu CMS lub nieoczekiwanej zmianie danych. Nie ponawiamy zapisu testowego.',ids,'dependency');return false;}
    return c.test(name,fn,ids);
  };
  try{
    adapter=options.adapter??await connectDescriptionCms({...options,settings});original=await adapter.read();last=original;
    richText(original.main.description);assert(original.channels.WHOLESALE&&original.channels.EMPIK,'Wymagane kanały WHOLESALE i EMPIK');
    journal={settings,original,allowed:[original],status:'pending',createdAt:new Date().toISOString()};
    try{await writeFile(journalFile,JSON.stringify(journal,null,2),{flag:'wx'});owns=true;}
    catch(e){if(e.code==='EEXIST')throw new Error('Istnieje dziennik niedokończonego testu CMS. Poczekaj na zakończenie albo użyj npm run descriptions:restore przed kolejnym zapisem.');throw e;}
    const attempt=async(candidate)=>{
      options.signal?.throwIfAborted();assert(!unsafe,'Dalszy zapis zablokowany po nieoczekiwanej zmianie produktu');
      if(!sameState(await adapter.read(),last)){unsafe=true;throw new Error('Produkt QA zmieniono poza testem');}
      journal.allowed=[original,last,candidate];await writeFile(journalFile,JSON.stringify(journal,null,2));
      const result=await adapter.submit(candidate);if(result.status>=500)writeBlocked=true;report.requests.push({method:'POST',endpoint:'/products/'+settings.productId+'/edit',status:result.status});
      last=await adapter.read();if(!journal.allowed.some(s=>sameState(s,last))){unsafe=true;throw new Error('CMS zapisał nieoczekiwany stan. Dziennik pozostaje do uzgodnienia.');}return result;
    };
    const apply=async(candidate)=>{const result=await attempt(candidate);assert([302,303].includes(result.status),'Zapis CMS: '+JSON.stringify(result));assert(sameState(last,candidate),'Odczyt CMS po zapisie różni się od danych wysłanych');};
    const seed='qa-desc-'+crypto.randomUUID().slice(0,8),base=structuredClone(original);
    base.channels.WHOLESALE={name:'QA nazwa '+seed,slug:seed,description:JSON.stringify([{code:'monsieurbiz.html',data:{content:'<p>Pełny opis '+seed+'</p>'}}]),shortDescription:'Krótki opis '+seed};
    base.channels.EMPIK={name:'QA Empik '+seed,slug:seed+'-empik',description:JSON.stringify([{code:'monsieurbiz.html',data:{content:'<p>Opis Empik '+seed+'</p>'}}]),shortDescription:'Krótki Empik '+seed};
    const apiCheck=async(state)=>{
      for(const channel of ['WHOLESALE','RETAIL','ACADEMY']){
        const values=Object.fromEntries(fields.map(key=>[key,channel==='WHOLESALE'?(state.channels.WHOLESALE[key]||state.main[key]):state.main[key]]));
        const actual=await request('GET','shop/products-dto-by-slug/'+encodeURIComponent(values.slug),{channel});assert.equal(actual.code,settings.code);
        for(const key of ['name','slug','shortDescription'])assert.equal(actual[key],values[key],channel+' / '+key);
        const expected=plain(richText(values.description));assert.equal(typeof actual.description,'string');assert.equal(plain(actual.description),expected,channel+' / description');
      }
    };
    await api.loginShop();
    await test('DESC-001: formularz zawiera cztery pola wyłącznie WHOLESALE/EMPIK',()=>assert.deepEqual(Object.keys(original.channels).sort(),['EMPIK','WHOLESALE']),['DESC-001']);
    await test('DESC-003: zapis czterech pól, ponowny odczyt CMS i API trzech kanałów',async()=>{await apply(base);await apiCheck(base);},['DESC-003']);
    for(const keys of [...fields.map(key=>[key]),fields])await test('DESC-004: puste '+keys.join(', ')+' — fallback CMS → API',async()=>{
      await apply(base);const candidate=structuredClone(base);for(const key of keys)candidate.channels.WHOLESALE[key]='';await apply(candidate);await apiCheck(candidate);
    },['DESC-004']);
    const reject=async(change)=>{
      await apply(base);const candidate=structuredClone(base);Object.assign(candidate.channels.WHOLESALE,change);const result=await attempt(candidate);
      assert.equal(result.status,200,'Oczekiwano formularza z błędem walidacji');assert(result.hasErrors,'Brak komunikatu błędu formularza');assert(sameState(last,base),'Błędne dane zostały zapisane');
    };
    await test('DESC-005: odrzucenie slugu innego produktu WHOLESALE',()=>reject({slug:settings.peerWholesaleSlug}),['DESC-005']);
    await test('DESC-006: odrzucenie slugu równego głównemu',()=>reject({slug:original.main.slug}),['DESC-006']);
    await test('DESC-007: identyczny slug w WHOLESALE i EMPIK jest dozwolony',async()=>{const candidate=structuredClone(base);candidate.channels.EMPIK={...candidate.channels.EMPIK,slug:seed};await apply(candidate);await apiCheck(candidate);},['DESC-007']);
    await test('DESC-008: nazwa jednoznakowa odrzucona',()=>reject({name:'X'}),['DESC-008']);
    await test('DESC-008: nazwa dwuznakowa zapisana',async()=>{const candidate=structuredClone(base);candidate.channels.WHOLESALE.name='QA';await apply(candidate);await apiCheck(candidate);},['DESC-008']);
    await test('DESC-009: slug 256 znaków odrzucony',()=>reject({slug:'qa-'+ 'x'.repeat(253)}),['DESC-009']);
    await test('DESC-009: slug 255 znaków zapisany',async()=>{const candidate=structuredClone(base);candidate.channels.WHOLESALE.slug='qa-'+ 'x'.repeat(252);await apply(candidate);await apiCheck(candidate);},['DESC-009']);
  }catch(e){report.tests.push({name:'Przebieg CMS',status:'FAIL',detail:api.clean(e.message)});}
  finally{
    if(owns)try{
      options.onProgress?.('CMS: przywracanie pierwotnych opisów produktu QA');
      const current=await adapter.read();assert(journal.allowed.some(s=>sameState(s,current)),'Wykryto zmianę zewnętrzną — dziennik zachowany, nie nadpisano danych');
      let restoreStatus=null;
      if(!sameState(current,original)){const response=await adapter.submit(original);restoreStatus=response.status;report.requests.push({method:'POST',endpoint:'/products/'+settings.productId+'/edit',status:restoreStatus});}
      assert(sameState(await adapter.read(),original),'Przywrócenie niepotwierdzone');
      journal.status='restored';journal.restoredAt=new Date().toISOString();await mkdir(c.directory,{recursive:true});
      await writeFile(path.join(c.directory,'description-cms-audit.json'),JSON.stringify(journal,null,2));
      if(adapter.screenshot)await adapter.screenshot(path.join(c.directory,'cms-restored.png'));
      await unlink(journalFile);report.restoration={status:'PASS',httpStatus:restoreStatus};report.tests.push({name:'CMS: przywrócenie pierwotnych pól kanałowych',status:'PASS',detail:'Oryginalne pola potwierdzono ponownym odczytem CMS. HTTP zapisu: '+(restoreStatus??'bez zapisu')+'. Audyt w description-cms-audit.json.'});
      if(restoreStatus!==null&&![302,303].includes(restoreStatus))report.tests.push({name:'CMS: nieprawidłowy status przywracania mimo zapisu pól',status:'FAIL',detail:'Pola pierwotne potwierdzono odczytem, ale CMS zwrócił HTTP '+restoreStatus+'. Nie ponowiono operacji.'});
      options.onProgress?.('CMS: pierwotne pola potwierdzone ponownym odczytem');
    }catch(e){report.restorationFailed=true;report.restoration={status:'FAIL',journalFile};report.tests.push({name:'CMS: przywrócenie pierwotnych pól kanałowych',status:'FAIL',detail:api.clean(e.message)+' Dziennik: '+journalFile});}
    if(adapter)await adapter.close();
  }
  return c.finish();
}

export async function restoreDescriptionCms(options={}){
  const file=options.journalFile??path.resolve('.auth/description-cms-restore.json');const journal=JSON.parse(await readFile(file,'utf8'));validateDescriptionCmsSettings(journal.settings);
  const adapter=options.adapter??await connectDescriptionCms({...options,settings:journal.settings});
  try{
    const current=await adapter.read();assert(journal.allowed.some(s=>sameState(s,current)),'Produkt zmieniono poza testem — uzgodnij ręcznie dane przed przywracaniem');
    if(!sameState(current,journal.original)){const response=await adapter.submit(journal.original);assert([302,303].includes(response.status),'Nieudany zapis przywracania: '+JSON.stringify(response));}
    assert(sameState(await adapter.read(),journal.original),'Nie potwierdzono przywrócenia');await unlink(file);
  }finally{await adapter.close();}
}
