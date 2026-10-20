// Presentation is opt-in and does not send requests or change assertions.
import {enablePreviewDragging} from './preview-drag.cjs';
const sessions=new WeakMap();
const enabled=vars=>vars?.HURT_BROWSER_PREVIEW==='true';
export function previewValue(value){
 if(typeof value==='boolean')return value?'zaznaczone':'niezaznaczone';
 if(value==='')return '(puste)';
 try{const blocks=JSON.parse(value);if(Array.isArray(blocks)&&blocks.every(b=>typeof b.data?.content==='string'))return blocks.map(b=>b.data.content.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ')).join('\n').trim()||'(puste)';}catch{}
 return String(value);
}
function stateFor(vars){let state=sessions.get(vars);if(!state){state={step:'Przygotowanie testu',views:new Set()};sessions.set(vars,state);}return state;}
function installOverlay({step}){
 if(!document.documentElement){document.addEventListener('DOMContentLoaded',()=>installOverlay({step}),{once:true});return;}
 if(document.getElementById('qa-test-preview'))return;
 const host=document.createElement('div');host.id='qa-test-preview';host.style.cssText='position:fixed;top:74px;right:14px;z-index:2147483647;width:min(430px,calc(100vw - 28px));pointer-events:none';
 const root=host.attachShadow({mode:'open'});root.innerHTML='<style>:host{font:14px/1.5 system-ui;color:#eef8ff}section{background:#102b3ff2;border:2px solid #5ee1b4;border-radius:12px;padding:14px;box-shadow:0 4px 24px #0005}small{color:#85efc7;letter-spacing:.08em}h3{font-size:14px;margin:5px 0 8px;overflow-wrap:anywhere}p{margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}pre{max-height:150px;overflow:hidden;white-space:pre-wrap;font:12px/1.4 system-ui;margin:8px 0 0}</style><section><small>PODGLĄD TESTU · DEV · ⠿ PRZECIĄGNIJ</small><h3></h3><p></p><pre></pre></section>';
 root.querySelector('h3').textContent=step;root.querySelector('p').textContent='Odczyt strony';document.documentElement.append(host);
 const highlight=document.createElement('style');highlight.textContent='[data-qa-preview-active]{outline:3px solid #09b886!important;outline-offset:4px!important}';document.documentElement.append(highlight);
 document.addEventListener('focusin',event=>{const el=event.target;if(!el?.matches?.('input,textarea,select,button,a'))return;root.querySelector('p').textContent='Bieżący element: '+((el.labels?.[0]?.textContent||el.getAttribute('aria-label')||el.textContent||el.id||el.tagName).trim().slice(0,120));},true);
}
export function publishBrowserStep(vars,line){
 if(!enabled(vars))return;const state=stateFor(vars);state.step=String(line).slice(0,300);
 for(const view of state.views)void view.refresh().catch(()=>{});
}
export async function installBrowserPresentation(context,{vars=process.env}={}){
 if(!enabled(vars))return {step:async()=>{},inspect:async()=>{},form:async()=>{},result:async()=>{}};
 const state=stateFor(vars),pauseMs=Math.max(650,Number(vars.HURT_BROWSER_SLOW_MO_MS)||0);
 const refresh=async(page,action,detail)=>{
  if(page.isClosed())return;
  await page.evaluate(installOverlay,{step:state.step});
  await page.evaluate(enablePreviewDragging);
  await page.evaluate(({step,action,detail})=>{const root=document.getElementById('qa-test-preview')?.shadowRoot;if(!root)return;root.querySelector('h3').textContent=step;if(action!==undefined)root.querySelector('p').textContent=action;if(detail!==undefined)root.querySelector('pre').textContent=detail;},{step:state.step,action,detail});
 };
 const view={refresh:()=>Promise.all(context.pages().map(page=>refresh(page)))};state.views.add(view);
 await context.addInitScript(installOverlay,{step:state.step});
 const attach=page=>{page.on('domcontentloaded',()=>void refresh(page,'Odczyt strony','').catch(()=>{}));};
 context.on('page',attach);context.once('close',()=>state.views.delete(view));for(const page of context.pages()){attach(page);await refresh(page);}
 const pause=()=>new Promise(resolve=>setTimeout(resolve,pauseMs));
 const inspect=async(page,locator,label)=>{
  await refresh(page,label,'');
  if(locator&&await locator.count()){
   await locator.first().evaluate(el=>{
    for(let p=el.parentElement;p;p=p.parentElement){
     if(p.classList.contains('tab')&&p.dataset.tab&&!p.classList.contains('active')){const tab=[...document.querySelectorAll('.item[data-tab]')].find(t=>t.dataset.tab===p.dataset.tab);tab?.click();}
     const title=p.previousElementSibling;if(p.classList.contains('content')&&title?.classList.contains('title')&&!title.classList.contains('active'))title.click();
    }
   });
   if(await locator.first().isVisible()){
    await locator.first().evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));
    await locator.first().scrollIntoViewIfNeeded();
    await locator.first().evaluate(el=>{for(const old of document.querySelectorAll('[data-qa-preview-active]'))old.removeAttribute('data-qa-preview-active');el.setAttribute('data-qa-preview-active','');el.animate([{backgroundColor:'#b9f7dc'},{backgroundColor:'transparent'}],{duration:1100});});
   }
  }
  await pause();
 };
 return {
  step:async(page,label)=>{await refresh(page,label,'');await pause();},inspect,
  async form(page,body,label='Przygotowanie pól do zapisu HTTP'){
   // Capture and send the existing body in the caller. Never rebuild it from this preview.
   const data=[...body.entries()];
   const changes=await page.evaluate(entries=>{
    const target=new URLSearchParams(entries),grouped=new Map(),returnValue=[];
    const form=document.getElementById('sylius_product_code')?.form;if(!form)throw new Error('Nie znaleziono formularza produktu do podglądu');
    for(const old of form.querySelectorAll('[data-qa-preview-field]'))old.removeAttribute('data-qa-preview-field');
    for(const el of form.querySelectorAll('input[name],textarea[name],select[name]')){
     if(/^_|password|token|cookie|csrf|authorization|email|phone|street|postcode/i.test(el.name)||el.disabled||['submit','button','file'].includes(el.type))continue;
     const values=target.getAll(el.name),before=el.type==='checkbox'||el.type==='radio'?el.checked:el.value,after=el.type==='checkbox'||el.type==='radio'?values.includes(el.value):(values[0]??'');
     if(before===after||grouped.has(el.name+'|'+el.value))continue;
     grouped.set(el.name+'|'+el.value,true);
     const label=(el.labels?.[0]?.textContent||el.closest('.field')?.querySelector('label')?.textContent||el.id||el.name).trim().slice(0,100);
     el.setAttribute('data-qa-preview-field',String(grouped.size));
     returnValue.push({selector:'[data-qa-preview-field="'+grouped.size+'"]',before,after,label,type:el.type});
    }
    return returnValue;
   // Local list avoids injecting the supplied values into executable HTML.
   },data).catch(error=>{throw new Error('Podgląd formularza: '+error.message);});
   for(const change of changes){
    const field=page.locator(change.selector);await inspect(page,field,label+' — '+change.label);
    const editable=await field.isVisible()&&await field.isEditable();
    if(editable&&!['checkbox','radio','hidden','select-one','select-multiple'].includes(change.type))await field.fill(String(change.after));
    if(['checkbox','radio'].includes(change.type))await field.evaluate((el,checked)=>{if(el.checked!==checked)(el.labels?.[0]??el).click();},change.after);
    if(editable&&change.type==='select-one')await field.selectOption(String(change.after));
    if(change.type==='hidden'){
     await field.evaluate((el,{label,text})=>{let mirror=el.parentElement.querySelector('[data-qa-editor-preview]');if(!mirror){mirror=document.createElement('div');mirror.dataset.qaEditorPreview='';mirror.style.cssText='padding:12px;border:2px solid #09b886;margin:10px 0;background:#effff7;color:#17372b;white-space:pre-wrap';el.parentElement.append(mirror);}mirror.textContent='PODGLĄD TESTU — '+label+' (dane przygotowane dla edytora)\n'+text;mirror.scrollIntoView({block:'center'});},{label:change.label,text:previewValue(change.after)});
    }
    else if(await field.isVisible())await field.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));
    await refresh(page,label+' — '+change.label+(change.type==='hidden'?' (pole edytora — podgląd danych)':''),'PRZED: '+previewValue(change.before).slice(0,240)+'\nPO: '+previewValue(change.after).slice(0,350));await pause();await pause();
   }
   // Client-side name/slug listeners must not make the displayed payload misleading.
   await page.evaluate(entries=>{const target=new URLSearchParams(entries),form=document.getElementById('sylius_product_code').form;for(const el of form.querySelectorAll('input[name],textarea[name]'))if(target.has(el.name)&&!/^_|password|token|cookie|csrf|authorization|email|phone|street|postcode/i.test(el.name)&&!['checkbox','radio','file','submit','button'].includes(el.type))el.value=target.get(el.name);},data);
   await refresh(page,'Wysyłam przygotowane dane przez HTTP','Liczba zmienionych pól: '+changes.length);await pause();
  },
  result:async(page,status,detail='Wynik kontroli ustala test. Następny krok ponownie odczyta dane.')=>{await refresh(page,'Odpowiedź zapisu HTTP: '+status,detail);await pause();}
 };
}
