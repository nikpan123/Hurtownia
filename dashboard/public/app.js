// Wspólny wybór motywu dla lokalnych paneli na 127.0.0.1 (cookie współdzielone między portami).
(() => {
  const key = 'qa_ui_theme';
  const allowed = ['auto', 'light', 'dark'];
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const select = document.querySelector('#qa-theme-mode');
  function read() {
    try {
      const cookie = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(key + '='));
      const value = cookie ? decodeURIComponent(cookie.slice(key.length + 1)) : localStorage.getItem(key);
      return allowed.includes(value) ? value : 'auto';
    } catch { return 'auto'; }
  }
  function apply(value) {
    document.documentElement.dataset.theme = value === 'auto' ? (system.matches ? 'dark' : 'light') : value;
    document.documentElement.dataset.themePreference = value;
    if (select) select.value = value;
  }
  function refresh() { apply(read()); }
  select?.addEventListener('change', () => {
    const value = allowed.includes(select.value) ? select.value : 'auto';
    try { localStorage.setItem(key, value); } catch {}
    try { document.cookie = key + '=' + value + '; Path=/; Max-Age=31536000; SameSite=Strict'; } catch {}
    apply(value);
  });
  system.addEventListener('change', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('storage', event => { if (event.key === key) refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
})();

const $=id=>document.getElementById(id);
const runDockState={panel:document.querySelector('.run-panel'),anchor:null,jobId:null,dismissed:null};
function positionRunDock(left,top){
 const panel=runDockState.panel;if(!panel.classList.contains('run-docked'))return;
 const bounds=panel.getBoundingClientRect(),gap=8;
 left=Math.max(gap,Math.min(left,Math.max(gap,innerWidth-bounds.width-gap)));
 top=Math.max(gap,Math.min(top,Math.max(gap,innerHeight-bounds.height-gap)));
 runDockState.position={left,top};
 Object.assign(panel.style,{left:left+'px',top:top+'px',bottom:'auto'});
}
function resetRunDockPosition(){runDockState.position=null;for(const key of ['left','top','bottom'])runDockState.panel.style.removeProperty(key);}
function enableRunDockDragging(){
 const panel=runDockState.panel,handle=panel.querySelector('.section-title');let drag;
 const heading=handle.querySelector('h2');heading.tabIndex=0;heading.title='Przeciągnij, aby przesunąć okno. Możesz też użyć klawiszy strzałek.';
 handle.addEventListener('pointerdown',event=>{
  if(!panel.classList.contains('run-docked')||event.button!==0||event.target.closest('button,a,input,select'))return;
  const bounds=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:bounds.left,top:bounds.top};
  handle.setPointerCapture(event.pointerId);panel.classList.add('is-dragging');event.preventDefault();
 });
 handle.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)positionRunDock(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);});
 const finish=event=>{if(drag?.id!==event.pointerId)return;drag=null;panel.classList.remove('is-dragging');if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,finish);
 heading.addEventListener('keydown',event=>{
  const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(!panel.classList.contains('run-docked')||!offsets[event.key])return;
  event.preventDefault();const rect=panel.getBoundingClientRect(),step=event.shiftKey?5:20;
  positionRunDock(rect.left+offsets[event.key][0]*step,rect.top+offsets[event.key][1]*step);
 });
 const clamp=()=>{const p=runDockState.position;if(p)positionRunDock(p.left,p.top);};
 window.addEventListener('resize',clamp);new ResizeObserver(clamp).observe(panel);
}
function setRunDockCollapsed(collapsed){
 const panel=runDockState.panel;
 panel.classList.toggle('is-minimized',collapsed);
 const toggle=$('run-dock-toggle');
 if(toggle){toggle.textContent=collapsed?'Rozwiń logi':'Zwiń logi';toggle.setAttribute('aria-expanded',String(!collapsed));}
}
function revealRunDock(){if(runDockState.panel.classList.contains('run-docked'))setRunDockCollapsed(false);}
function syncRunDock(job,running){
 const dock=runDockState,panel=dock.panel;
 if(!dock.anchor){
  dock.anchor=document.createComment('Miejsce panelu przebiegu');panel.before(dock.anchor);
  const controls=document.createElement('div');controls.className='run-dock-controls';
  controls.innerHTML='<span id="run-dock-state" role="status"></span><button type="button" class="secondary" id="run-dock-toggle" aria-controls="job-content" aria-expanded="true">Zwiń logi</button><button type="button" class="secondary" id="run-dock-dismiss" hidden>Odepnij okno</button>';
  panel.querySelector('.section-title').append(controls);
  $('run-dock-toggle').addEventListener('click',()=>setRunDockCollapsed(!panel.classList.contains('is-minimized')));
  $('run-dock-dismiss').addEventListener('click',()=>{if(state?.jobs.some(j=>j.status==='RUNNING'))return;dock.dismissed=dock.jobId;resetRunDockPosition();panel.classList.remove('run-docked','is-minimized');dock.anchor.after(panel);});
  const reset=document.createElement('button');reset.type='button';reset.className='secondary';reset.textContent='Przywróć położenie';reset.id='run-dock-reset';controls.append(reset);reset.addEventListener('click',resetRunDockPosition);
  enableRunDockDragging();
 }
 const active=running||job;
 if(running&&dock.jobId!==running.id){dock.jobId=running.id;dock.dismissed=null;setRunDockCollapsed(false);}
 if(running&&dock.dismissed!==running.id&&!panel.classList.contains('run-docked')){document.body.append(panel);panel.classList.add('run-docked');}
 $('run-dock-dismiss').hidden=!!running;
 const labels={RUNNING:'Test w trakcie',PASS:'Zakończony — zaliczony',FAIL:'Zakończony — niezgodności',INCOMPLETE:'Zakończony — niepełny zakres',STOPPED:'Zatrzymany',INTERRUPTED:'Przerwany'};
 $('run-dock-state').textContent=active?(labels[active.status]||active.status):'';
}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=document.querySelector('meta[name=ui-token]').content;
let state,activeView='start',loading=false,lastJson='';
const badge=status=>`<span class="badge ${esc(status)}">${esc(status)}</span>`;
const date=value=>value?new Date(value).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const money=value=>typeof value==='number'?(value/100).toLocaleString('pl-PL',{style:'currency',currency:'PLN'}):'brak ceny';
function toast(message){$('toast').textContent=message;$('toast').hidden=false;}
async function post(endpoint,body){if(endpoint==='/api/run')body={...body,browserPreview:{enabled:$('browser-preview').checked,slowMoMs:Number($('browser-preview-speed').value)}};const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-UI-Token':token},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error??'Błąd operacji');return result;}
function setView(view){activeView=view;for(const node of document.querySelectorAll('.view'))node.hidden=node.id!=='view-'+view;for(const b of document.querySelectorAll('nav button'))b.classList.toggle('active',b.dataset.view===view);$('view-label').textContent={start:'Uruchom testy',wizard:'Zamówienie krok po kroku','create-product':'Nowa książka CMS',reports:'Raporty',api:'Podgląd API',settings:'Konfiguracja',scenarios:'Scenariusze testowe',documentation:'Dokumentacja testów'}[view];if(view==='reports')renderReports();if(view==='documentation')loadDocumentation();if(view==='scenarios')loadScenarios();window.scrollTo(0,0);}
function reportTable(rows){if(!rows.length)return '<div class="empty"><span>▤</span><h3>Brak raportów</h3><p>Uruchom test lub zmień ustawienia wyszukiwania.</p></div>';return `<div class="table-scroll"><table class="report-table"><thead><tr><th>SCENARIUSZ</th><th>WYNIK</th><th>SPRAWDZENIA</th><th>DATA</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><div class="report-title">${esc(r.name)}</div><div class="report-sub">${r.orderId?'Koszyk / zamówienie '+esc(r.orderId):({'catalog':'Testy endpointów katalogu','product-create':'Tworzenie produktu','rounding':'Wyceny i zaokrąglenia','descriptions':'Tłumaczenia kanałów','order-regression':'Scenariusze zamówienia i paczek','database':'Porównanie API / baza'}[r.kind]??'Testy API')}${r.products.length?' · '+esc(r.products.slice(0,3).join(', '))+(r.products.length>3?'…':''):''}</div></td><td>${badge(r.status)}</td><td><span class="muted">${r.counts.PASS} ✓ &nbsp; ${r.counts.FAIL} ✕ &nbsp; ${r.counts.SKIP} pom.</span></td><td><span class="muted">${date(r.date)}</span></td><td><button class="plain" data-report="${esc(r.id)}">Otwórz →</button>${r.mailRecheckReady?`<button class="plain" data-mail-report="${esc(r.id)}">Sprawdź e-mail ponownie</button>`:''}${r.finalization==='potwierdzona przez API'?`<button class="plain" data-db-report="${esc(r.id)}">Porównaj z bazą</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;}
function renderReports(){if(!state)return;const text=$('report-search').value.toLocaleLowerCase('pl');const status=$('report-status').value,kind=$('report-kind').value;const rows=state.reports.filter(r=>(!status||r.status===status)&&(!kind||r.kind===kind)&&(!text||[r.name,r.id,r.orderId,...r.products].join(' ').toLocaleLowerCase('pl').includes(text)));$('all-reports').innerHTML=reportTable(rows);}
function openReport(id){const r=state.reports.find(r=>r.id===id);if(!r)return;setView('reports');const url='/reports/'+encodeURIComponent(id)+'/raport.html';$('preview-title').textContent=r.name+(r.orderId?' · '+r.orderId:'');$('open-report').href=url;$('report-frame').src=url;$('report-preview').hidden=false;$('report-preview').scrollIntoView({behavior:'smooth',block:'start'});}
function renderSettings(){const s=state.settings;$('settings-content').innerHTML=`<h2>Stan połączenia</h2><dl class="settings-grid"><dt>Adres API</dt><dd>${esc(state.baseUrl)}</dd><dt>Dane hurtownika</dt><dd>${s.credentialsReady?'✓ Uzupełnione':'Do uzupełnienia w .env'}</dd><dt>Sesja bramki GitLab</dt><dd>${s.gatewaySession?'Zapisana — ważność sprawdza żądanie API':'Brak zapisanej sesji'}</dd><dt>Dane administratora API</dt><dd>${s.adminReady?'Uzupełnione — uprawnienia sprawdza test':'Do uzupełnienia w .env'}</dd><dt>Losowanie produktów</dt><dd>${s.randomProducts?.enabled?'Włączone · Adamada / pozostałe osobno':'Wyłączone'}</dd><dt>Losowanie płatności</dt><dd>${s.randomCheckout?.payment?'Włączone':'Wyłączone'}</dd><dt>Losowanie dostawy</dt><dd>${s.randomCheckout?.shipping?'Włączone':'Wyłączone'}</dd><dt>Rabat Adamady</dt><dd>${esc(s.groupRebates?.adamada??'Nie skonfigurowano')}%</dd><dt>Środowisko test</dt><dd>Zablokowane</dd></dl>`;}
function renderJob(){const job=state.jobs[0];const running=state.jobs.find(j=>j.status==='RUNNING');syncRunDock(job,running);$('checkout-account').disabled=!!running||customAccountSaving;$('custom-account-email').disabled=!!running||customAccountSaving;$('custom-account-save').disabled=!!running||customAccountSaving;if(!$('custom-account-email').dataset.initialized){$('custom-account-email').value=state.customEmail??'';$('custom-account-email').dataset.initialized='true';}$('checkout-account').querySelector('[value=secondary]').disabled=!state.settings.secondAccountReady;for(const b of document.querySelectorAll('.run'))b.disabled=!!running||customAccountSaving;document.querySelector('.run-panel').classList.toggle('busy',!!running);$('stop-job').hidden=!running;$('stop-job').dataset.id=running?.id??'';if(!job){$('job-empty').hidden=false;$('job-content').hidden=true;return;}$('job-empty').hidden=true;$('job-content').hidden=false;$('job-heading').innerHTML=badge(job.status)+`<strong>${esc(job.name)}</strong><span class="muted">${date(job.startedAt)}</span>`;const log=$('job-log');const stick=log.scrollTop+log.clientHeight>=log.scrollHeight-35;log.textContent=job.log||'Uruchamianie zestawu testów…';if(stick)log.scrollTop=log.scrollHeight;const result=state.reports.find(r=>job.log.includes(r.id));$('job-report').innerHTML=result?`<button class="plain" data-report="${esc(result.id)}">Otwórz raport tego przebiegu →</button>`:'';}
async function refresh(){if(loading)return;loading=true;try{const r=await fetch('/api/state');const data=await r.json();if(!r.ok)throw Error(data.error);state=data;$('report-count').textContent=state.reports.length;const pass=state.reports.filter(r=>r.status==='PASS').length,fail=state.reports.filter(r=>['FAIL','INCOMPLETE'].includes(r.status)).length;const last=state.reports[0];$('stats').innerHTML=[['Zebrane raporty',state.reports.length,'Pełna historia na tym komputerze'],['Zakończone PASS',pass,'Wykonane kontrole bez błędów'],['Do sprawdzenia',fail,'Raporty z niezgodnościami'],['Ostatni wynik',last?badge(last.status):'—',last?date(last.date):'Jeszcze bez uruchomień']].map(([label,value,note])=>`<div class="stat"><div class="stat-label">${label}<span>↗</span></div><div class="stat-number">${value}</div><div class="stat-note">${note}</div></div>`).join('');$('recent-reports').innerHTML=reportTable(state.reports.slice(0,5));renderReports();renderSettings();renderJob();renderAccount();renderWizard();renderProductForm();$('local-time').textContent=new Date().toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Warsaw'});}catch(e){toast(e.message);}finally{loading=false;}}
document.addEventListener('click',async event=>{const target=event.target.closest('button');if(!target)return;if(target.dataset.view)setView(target.dataset.view);if(target.dataset.goto)setView(target.dataset.goto);if(target.dataset.report)openReport(target.dataset.report);if(target.dataset.suite){target.disabled=true;try{const suite=target.dataset.suite;const body={suite,verifyDatabase:$('verify-database').checked};const linkedCases=linkedCasesForSuite(suite);if(linkedCases)body.caseIds=linkedCases;if(['cart','order'].includes(suite))body.account=selectedCheckoutAccount();if(['cart','order'].includes(suite)&&$('seed').value.trim())body.seed=$('seed').value.trim();await post('/api/run',body);$('toast').hidden=true;setView('start');await refresh();revealRunDock();}catch(e){toast(e.message);target.disabled=false;}}});
$('refresh').addEventListener('click',refresh);for(const id of ['report-search','report-status','report-kind'])$(id).addEventListener('input',renderReports);
$('stop-job').addEventListener('click',async()=>{try{await post('/api/stop',{id:$('stop-job').dataset.id});toast('Wysłano polecenie zatrzymania. Jeśli trwała finalizacja zamówienia, sprawdź jego stan w CMS.');await refresh();}catch(e){toast(e.message);}});
$('api-endpoint').addEventListener('change',()=>{const detail=$('api-endpoint').value==='detail';$('slug-field').hidden=!detail;$('list-fields').hidden=detail;});
$('api-form').addEventListener('submit',async event=>{event.preventDefault();$('send-api').disabled=true;$('send-api').textContent='Pobieranie odpowiedzi…';try{const body={endpoint:$('api-endpoint').value,channel:$('api-channel').value,slug:$('api-slug').value.trim(),query:{page:$('api-page').value,limit:$('api-limit').value,order_by:$('api-order').value,sort:$('api-sort').value}};if($('api-name').value.trim())body.query.name=$('api-name').value.trim();for(const node of document.querySelectorAll('[data-query]'))if(node.value.trim())body.query[node.dataset.query]=node.value.split(',').map(s=>s.trim()).filter(Boolean);const result=await post('/api/preview',body);lastJson=JSON.stringify(result.data,null,2);$('response-json').textContent=lastJson;$('copy-json').disabled=false;$('response-meta').innerHTML=badge(result.status<400?'PASS':'FAIL')+` <strong>HTTP ${result.status}</strong> · ${result.durationMs} ms<br><span>${esc(result.endpoint)}</span>`;const rows=Array.isArray(result.data?.data)?result.data.data:result.data?.code&&result.data?.name?[result.data]:[];$('product-cards').innerHTML=rows.slice(0,8).map(p=>`<article class="product-mini"><strong>${esc(p.name)}</strong><small>${esc(p.code)} · ${esc(p.slug)}</small><span>${money(p.price)}</span></article>`).join('');$('toast').hidden=true;}catch(e){$('response-json').textContent=e.message;$('response-meta').textContent='Nie udało się pobrać odpowiedzi.';$('product-cards').innerHTML='';}finally{$('send-api').disabled=false;$('send-api').textContent='Wyślij żądanie GET';}});
$('copy-json').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(lastJson);$('copy-json').textContent='Skopiowano ✓';setTimeout(()=>$('copy-json').textContent='Kopiuj JSON',1500);}catch{toast('Zaznacz i skopiuj JSON z podglądu.');}});

$('package-profile').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{
    const cents=id=>{const value=$(id).value.trim().replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(value))throw new Error('Cena: np. 15,00');const [whole,fraction='']=value.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));};
    const threshold=Number($('pack-threshold').value);const profile={singlePackageWeight:Number($('pack-weight').value),priceIsNet:$('pack-net').checked,taxPercent:5,weightRanges:[{from:0,to:threshold,priceMinor:cents('pack-price-one')},{from:threshold+1,to:Number($('pack-max').value),priceMinor:cents('pack-price-two')}]};
    $('pack-profile-preview').textContent=`Profil testowy: paczka ${profile.singlePackageWeight} g; przedziały 0–${threshold} g i ${threshold+1}–${profile.weightRanges[1].to} g. Po teście przywracamy ustawienia początkowe.`;
    await post('/api/run',{suite:'packages-profile',profile});$('toast').hidden=true;await refresh();revealRunDock();
  }catch(e){toast(e.message);}finally{button.disabled=false;}
});


document.addEventListener('click',async event=>{const button=event.target.closest('[data-db-report]');if(!button)return;button.disabled=true;try{await post('/api/run',{suite:'database',reportId:button.dataset.dbReport});setView('start');await refresh();revealRunDock();}catch(e){toast(e.message);}finally{button.disabled=false;}});

let documentation;
function renderDocToc(){
  const query=$('doc-search').value.toLocaleLowerCase('pl');
  $('doc-toc').innerHTML=(documentation?.toc??[]).filter(h=>h.level<=3&&h.title.toLocaleLowerCase('pl').includes(query)).map(h=>`<button class="plain doc-toc-item" data-doc-heading="${esc(h.id)}">${esc(h.title)}</button>`).join('')||'<p>Brak pasującego rozdziału.</p>';
}
async function loadDocumentation(){
  try{const response=await fetch('/api/documentation');const result=await response.json();if(!response.ok)throw Error(result.error??'Nie udało się wczytać README.');documentation=result;$('doc-content').innerHTML=result.html;renderDocToc();}catch(error){$('doc-content').textContent=error.message;}
}
$('doc-search').addEventListener('input',renderDocToc);
document.addEventListener('click',event=>{const button=event.target.closest('[data-doc-heading]');if(button){event.preventDefault();document.getElementById(button.dataset.docHeading)?.scrollIntoView({behavior:'smooth',block:'start'});}});

let customAccountSaving=false;
function selectedCheckoutAccount(){
  const account=$('checkout-account').value;
  if(account==='custom'&&(customAccountSaving||!state?.customEmail||$('custom-account-email').value.trim()!==state.customEmail))throw Error('Najpierw zapisz e-mail użytkownika przyciskiem obok pola.');
  return account;
}
function toggleAccountEditor(force){
  const open=force??$('account-editor').hidden;
  $('account-editor').hidden=!open;$('account-toggle').setAttribute('aria-expanded',String(open));$('account-toggle').textContent=open?'Zwiń ustawienia':'Zmień użytkownika';
  if(open)$('checkout-account').focus();
}
function renderAccount(){
  if(!state)return;
  if($('checkout-account').value==='secondary'&&!state.settings.secondAccountReady)$('checkout-account').value='primary';
  const id=$('checkout-account').value,profile=state.accounts?.find(a=>a.id===id),dirty=id==='custom'&&$('custom-account-email').value.trim()!==state.customEmail;
  $('custom-account-box').hidden=id!=='custom';
  $('active-account-label').textContent=profile?.label??({primary:'Konto 1',secondary:'Konto 2',custom:'Własny użytkownik'}[id]);
  $('account-header-name').textContent=$('active-account-label').textContent;
  $('active-account-email').textContent=dirty?'Niezapisana zmiana e-maila — zapisz przed testem':profile?.email||'Nie skonfigurowano adresu e-mail';
  document.querySelector('.account-summary').classList.toggle('account-unsaved',dirty||id==='custom'&&!state.customEmail);
  const labels={bank_transfer:'Przelew bankowy',cash_on_delivery:'Płatność przy odbiorze',bank_transfer_1_day:'Przelew 1-dniowy',payment_timely:'Płatność terminowa',adamada:'Adamada'};
  $('account-rebates').innerHTML=`<div class="rebate-heading"><h3>Rabaty wybranego użytkownika</h3><span>${esc(profile?.source??'Wczytywanie danych…')}${profile?.readAt?' · '+date(profile.readAt):''}</span></div><div class="rebate-grid">${Object.entries(labels).map(([code,label])=>`<div><span>${esc(label)}</span><strong>${Number.isFinite(profile?.rebates?.[code])?esc(profile.rebates[code].toLocaleString('pl-PL'))+'%':'—'}</strong></div>`).join('')}</div>${id==='custom'&&!Object.keys(profile?.rebates??{}).length?'<p class="account-help">Zapisz e-mail, aby odczytać rabaty teraz. Przy uruchomieniu testu odczytamy je ponownie z CMS.</p>':''}`;
}
$('account-toggle').addEventListener('click',()=>toggleAccountEditor());
$('account-header-open').addEventListener('click',()=>{toggleAccountEditor(true);document.querySelector('.account-panel').scrollIntoView({behavior:'smooth',block:'start'});});
try{const saved=sessionStorage.getItem('checkout-account');if(['primary','secondary','custom'].includes(saved))$('checkout-account').value=saved;}catch{}
$('checkout-account').addEventListener('change',()=>{try{sessionStorage.setItem('checkout-account',$('checkout-account').value);}catch{}$('custom-account-profile').textContent='';renderAccount();});
$('custom-account-email').addEventListener('input',renderAccount);
$('custom-account-form').addEventListener('submit',async event=>{
  event.preventDefault();customAccountSaving=true;$('custom-account-email').disabled=true;$('custom-account-profile').className='account-feedback';$('custom-account-profile').textContent='Pobieranie rabatów z Syliusa…';renderJob();
  try{const result=await post('/api/account/custom',{email:$('custom-account-email').value.trim()});$('custom-account-email').value=result.email;$('custom-account-profile').textContent='Użytkownik zapisany. Rabaty odczytane z CMS są widoczne poniżej.';await refresh();}catch(error){$('custom-account-profile').className='account-feedback account-error';$('custom-account-profile').textContent=error.message;}finally{customAccountSaving=false;renderJob();renderAccount();}
});

let suiteCategory='shopping';
let linkedHurtSelection=[],linkedHurtOnly=false;
const linkedHurtParams=new URLSearchParams(location.search);
try{const raw=linkedHurtParams.get('selection');if(raw){const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||!parsed.length||parsed.length>500||parsed.some(t=>typeof t.code!=='string'||typeof t.suite!=='string'))throw Error('Niepoprawny wybór testów');linkedHurtSelection=parsed;linkedHurtOnly=true;suiteCategory='all';}}catch{toast('Nie udało się odczytać wyboru zgłoszenia. Otwórz panel ponownie z jego karty.');}
function linkedCasesForSuite(suite){
 if(!linkedHurtOnly)return;
 const chosen=linkedHurtSelection.filter(t=>t.suite===suite);
 if(!chosen.length)throw Error('Ten zestaw nie należy do wyboru zgłoszenia.');
 if(chosen.some(t=>t.code===suite))return;
 return [...new Set(chosen.map(t=>t.code))];
}
const suiteGroups=[...document.querySelectorAll('.suite-group')];
const suiteCards=[...document.querySelectorAll('[data-test-card]')];
function renderSuiteLibrary(){
  const query=$('suite-search').value.trim().toLocaleLowerCase('pl');let visible=0;
  for(const group of suiteGroups){let count=0;for(const card of group.querySelectorAll('[data-test-card]')){const show=(!linkedHurtOnly||[...card.querySelectorAll('[data-suite]')].some(b=>linkedHurtSelection.some(t=>t.suite===b.dataset.suite)))&&(suiteCategory==='all'||suiteCategory===group.dataset.category)&&(!query||card.textContent.toLocaleLowerCase('pl').includes(query));card.hidden=!show;if(show)count++;}group.hidden=!count;visible+=count;}
  $('suite-result-count').textContent=`Widoczne: ${visible} z ${suiteCards.length}`;$('suite-empty').hidden=visible>0;
  for(const button of $('suite-categories').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.suiteCategory===suiteCategory));
}
$('suite-categories').innerHTML=[['all','Wszystkie',suiteCards.length],...suiteGroups.map(g=>[g.dataset.category,g.dataset.categoryLabel,g.querySelectorAll('[data-test-card]').length])].map(([key,label,count])=>`<button type="button" data-suite-category="${esc(key)}" aria-pressed="false">${esc(label)} <span>${count}</span></button>`).join('');
$('suite-categories').addEventListener('click',event=>{const button=event.target.closest('[data-suite-category]');if(!button)return;suiteCategory=button.dataset.suiteCategory;renderSuiteLibrary();});
$('suite-search').addEventListener('input',()=>{if($('suite-search').value.trim())suiteCategory='all';renderSuiteLibrary();});
$('suite-reset').addEventListener('click',()=>{suiteCategory='all';$('suite-search').value='';renderSuiteLibrary();});
renderSuiteLibrary();

if(linkedHurtOnly){
 const notice=document.createElement('section');notice.className='panel';notice.setAttribute('aria-label','Testy ze zgłoszenia');
 const heading=document.createElement('h2');heading.textContent='Zgłoszenie #'+(linkedHurtParams.get('issue')||'—')+' — wybrane testy';notice.append(heading);
 const list=document.createElement('ul');for(const t of linkedHurtSelection){const row=document.createElement('li');row.textContent=t.code===t.suite?t.code+' — cały zestaw':t.code+' — '+(t.title||'przypadek API');list.append(row);}notice.append(list);
 const info=document.createElement('p');info.textContent='Poniżej widzisz powiązane zestawy. Kliknięcie „Uruchom” wykona tylko wskazane przypadki danego zestawu. Testy czekają na Twoje uruchomienie.';notice.append(info);
 const reset=document.createElement('button');reset.className='secondary';reset.textContent='Przejdź do pełnej biblioteki';reset.onclick=()=>{linkedHurtOnly=false;notice.remove();suiteCategory='all';renderSuiteLibrary();};notice.append(reset);document.querySelector('.test-library').before(notice);
}

document.addEventListener('click',async event=>{const button=event.target.closest('[data-mail-report]');if(!button)return;button.disabled=true;try{await post('/api/run',{suite:'descriptions-mail-recheck',reportId:button.dataset.mailReport});setView('start');await refresh();revealRunDock();}catch(e){toast(e.message);}finally{button.disabled=false;}});

/* QA_GUIDE_START */
// Wspólna instrukcja obsługi. Adapter projektu dostarcza rzeczywiste dane testu.
function installQaGuide(config) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list = values => `<ol>${values.filter(Boolean).map(value => `<li>${escape(value)}</li>`).join('')}</ol>`;
  const section = (title, content) => `<section><h3>${title}</h3>${content}</section>`;
  const legend = `<dl class="qa-guide-legend"><dt>PASS / Zaliczone</dt><dd>Wykonane kontrole spełniły oczekiwania. Otwórz raport i potwierdź, że zawiera wybrany test.</dd><dt>FAIL / Niezaliczone</dt><dd>Kontrola nie przeszła lub wystąpił problem z jej wykonaniem. Odczytaj przyczynę; sam czerwony wynik nie rozstrzyga, czy winna jest aplikacja, dane czy połączenie.</dd><dt>SKIP / Pominięte</dt><dd>Nie sprawdzono tego warunku. To nie jest potwierdzenie poprawności.</dd><dt>BLOCKED / Zablokowane</dt><dd>Brakuje warunku potrzebnego do wykonania. Uzupełnij wskazane dane lub dostęp.</dd><dt>INCOMPLETE / Niepełne</dt><dd>Sprawdzono część zakresu; pozostałe warunki nadal wymagają wykonania.</dd></dl>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'qa-guide-dialog';
  dialog.setAttribute('aria-labelledby', 'qa-guide-title');
  document.body.append(dialog);
  let returnFocus;
  dialog.addEventListener('click', event => { if (event.target.closest('[data-guide-close]')) dialog.close(); });
  dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  function show(test, opener) {
    returnFocus = opener;
    const manual = test.type === 'manual';
    const steps = Array.isArray(test.steps) ? test.steps : test.steps ? [test.steps] : [];
    const expected = Array.isArray(test.expected) ? test.expected : test.expected ? [test.expected] : [];
    const effect = test.effect || config.effect;
    const actions = manual
      ? ['Przeczytaj warunki i oczekiwany wynik poniżej.', 'Wykonaj opisane kroki w testowanej aplikacji.', 'W Centrum wybierz „Zapisz wynik ręczny”, wpisz rzeczywisty rezultat i dołącz dowody. Zapisz wynik zgodny z obserwacją.']
      : test.actions || config.actions;
    dialog.innerHTML = `<div class="qa-guide-head"><div><small>INSTRUKCJA TESTU · ${escape(config.name)}</small><h2 id="qa-guide-title">${escape(test.title)}</h2></div><button type="button" class="secondary" data-guide-close>Zamknij</button></div>`
      + section('1. Co sprawdzamy?', `<p>${escape(test.purpose || test.title)}</p>${test.scope ? `<p>${escape(test.scope)}</p>` : ''}`)
      + section('2. Co przygotować?', list(test.prepare || config.prepare))
      + section('3. Co kliknąć i co się stanie?', list(actions) + `<p class="qa-guide-effect"><strong>Wpływ na dane:</strong> ${escape(effect)}</p>`)
      + section(manual ? '4. Kroki do wykonania ręcznie' : '4. Co zrobi automat?', (manual ? '' : '<p>Po uruchomieniu poniższe czynności wykonuje program. Nie musisz samodzielnie wysyłać zapytań ani klikać w testowanej aplikacji.</p>') + (steps.length ? list(steps) : `<p>Szczegółowe kroki tego przypadku nie zostały jeszcze opisane w katalogu. Sprawdź zakres w dokumentacji projektu przed uruchomieniem; ta karta nie zastępuje pełnego opisu testu.</p>`))
      + section('5. Jakiego wyniku oczekiwać?', expected.length ? list(expected) : `<p>Automat ocenia warunki dotyczące scenariusza „${escape(test.title)}”. Katalog nie zawiera osobnego, pełnego opisu oczekiwanego rezultatu. Nie potwierdzaj całej funkcjonalności wyłącznie na podstawie nazwy testu.</p>`)
      + section('6. Gdzie jest wynik i co zrobić dalej?', `<p>${escape(test.result || config.result)}</p>${legend}<p>Do zgłoszenia przypnij raport z tego uruchomienia, wskaż faktycznie wykonane ID testów, środowisko i wersję aplikacji. Dla błędu opisz oczekiwany i rzeczywisty rezultat. Samo dodanie testu do zgłoszenia nie potwierdza poprawki.</p>`)
      + `<div class="qa-guide-foot"><p>Ta instrukcja nie uruchamia testu ani nie zmienia wyboru.</p><button type="button" class="secondary" data-guide-close>Wróć do panelu</button></div>`;
    dialog.showModal();
  }
  const intro = document.createElement('details');
  intro.className = 'qa-guide-intro';
  intro.innerHTML = `<summary>Pierwszy raz tutaj? Jak wybrać test i odczytać wynik</summary><div class="qa-guide-intro-body"><h3>${escape(config.name)} — od czego zacząć</h3>${list(config.intro)}<h3>Co oznacza wynik?</h3>${legend}<p><strong>Słownik:</strong> scenariusz = jeden opisany przypadek; zestaw = grupa testów; środowisko = adres sprawdzanej aplikacji; API = sprawdzanie poprzez zapytania zamiast klikania w przeglądarce; raport = zapis przebiegu i dowody.</p><p>Przy testach wybierz „Jak wykonać test?”, aby poznać przygotowanie, zakres, wpływ na dane i dalsze kroki.</p></div>`;
  const main = document.querySelector('main');
  const header = main?.querySelector(':scope > header');
  if (header) header.after(intro); else main?.prepend(intro);
  function button(test, host) {
    if (!host || host.querySelector(':scope > [data-qa-guide]')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'secondary qa-guide-button'; b.dataset.qaGuide = 'true';
    b.textContent = 'Jak wykonać test?';
    b.setAttribute('aria-label', 'Jak wykonać test: ' + test.title);
    b.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); show(test, b); });
    host.append(b);
  }
  let pending = false;
  function refresh() {
    pending = false;
    config.decorate(button);
    const authorFields = document.querySelector('#modal[open] #fields');
    if (authorFields && document.querySelector('#dialog-title')?.textContent === 'Nowy test ręczny' && !authorFields.querySelector('.qa-guide-author')) {
      const note = document.createElement('p');
      note.className = 'qa-guide-effect qa-guide-author';
      note.textContent = 'Napisz instrukcję dla osoby, która pierwszy raz widzi aplikację: gdzie wejść, jakie dane przygotować, co kolejno kliknąć i jaki komunikat lub zapis ma się pojawić. Opisz również wpływ na dane i co posprzątać po próbie. Oczekiwany wynik podaj konkretnie, np. „Zapis jest zablokowany, a nowe zamówienie nie powstaje”.';
      authorFields.prepend(note);
    }
    for (const control of document.querySelectorAll(config.launchSelector || '[data-no-launch-control]')) {
      if (control.closest('.qa-guide-dialog')) continue;
      let note = control.parentElement.querySelector(':scope > .qa-guide-before-run');
      if (!note) { note = document.createElement('p'); note.className = 'qa-guide-before-run'; control.after(note); }
      const text = config.launchNote();
      if (note.textContent !== text) note.textContent = text;
    }
  }
  function queue() { if (!pending) { pending = true; setTimeout(refresh, 30); } }
  const observer = new MutationObserver(records => { if (records.some(record => !record.target.closest?.('.qa-guide-dialog,.qa-guide-intro,.qa-guide-before-run,.qa-guide-button'))) queue(); });
  if (main) observer.observe(main, {childList:true,subtree:true});
  document.addEventListener('change', queue);
  document.addEventListener('click', queue);
  refresh();
}

const qaGuideData_warehouse={"cart":{"effect":"Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”.","steps":["AUTH-001 — Poprawne logowanie hurtownika","CART-002 — Dodanie pojedynczego produktu","CART-009 — Losowanie produktów i powtórzenie przebiegu","PAY-001 — Lista dostępnych płatności","PAY-003 — Rabat Adamady dla wszystkich dostępnych płatności","SHIP-001 — Dostawy dostępne po wyborze płatności","SHIP-002 — Zapis dostawy i poprawnych adresów","REPORT-002 — Różnice netto bez potwierdzonej reguły zaokrągleń"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”."},"regression":{"effect":"Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry.","steps":["AUTH-002 — Niepoprawne hasło API","AUTH-003 — Żądanie chronione bez ważnego JWT","CART-001 — Utworzenie i odczyt pustego koszyka","CART-003 — Kilka produktów z tej samej grupy","CART-004 — Ponowne dodanie tego samego produktu","CART-005 — Zmiana ilości po wyborze płatności","CART-006 — Usunięcie pozycji z koszyka","CART-007 — Nieprawidłowa ilość produktu","CART-008 — Nieistniejący kod produktu","CART-010 — Przekroczenie potwierdzonego zapasu","PAY-002 — Rabaty zwykłych produktów dla obu kont","PAY-004 — Zmiana dostępnej płatności w tym samym koszyku","PAY-005 — Nieistniejąca metoda płatności","PAY-006 — Istniejąca płatność niedozwolona hurtownikowi","SHIP-003 — Niekompletny adres dostawy","SHIP-004 — Nieistniejąca dostawa","ISO-001 — Dwa konta mają odrębne logowanie i wzorce rabatów","ISO-002 — Obce konto odczytuje cudzy koszyk","ISO-003 — Obce konto odczytuje płatności lub dostawy","ISO-004 — Obce konto modyfikuje produkty koszyka","ISO-005 — Obce konto zmienia płatność lub dostawę"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry."},"regression-order":{"effect":"Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu.","steps":["ORD-001 — Zapis poprawnego zamówienia","ORD-002 — Pusty koszyk nie może zostać zatwierdzony","ORD-003 — Blokada zamówienia mieszanego Adamada i pozostałe","ORD-004 — Powtórne zatwierdzenie i utrata odpowiedzi","ORD-005 — Potwierdzenie PDF i informacje po zakupie","ISO-006 — Wycena po obcym żądaniu i po finalizacji"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu."},"order":{"effect":"Cały proces dla użytkownika wybranego u góry panelu. Zatwierdza zamówienie; może wysłać e-mail i uruchomić transfer.","steps":["ORD-001 — Zapis poprawnego zamówienia","ORD-005 — Potwierdzenie PDF i informacje po zakupie"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Cały proces dla użytkownika wybranego u góry panelu. Zatwierdza zamówienie; może wysłać e-mail i uruchomić transfer."},"packages":{"effect":"Cały zestaw paczek z lokalną konfiguracją progów i produktu. Bez finalizacji i bez zmiany CMS; konto z konfiguracji regresji.","steps":["PACK-001 — Granice wagi i liczba paczek GLS","PACK-002 — Ceny paczek i dopłata do płatności","PACK-003 — Zmniejszenie ilości zmniejsza koszt paczek","PACK-004 — Zmiana GLS na dostawę bez kalkulatora paczek"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Cały zestaw paczek z lokalną konfiguracją progów i produktu. Bez finalizacji i bez zmiany CMS; konto z konfiguracji regresji."},"rounding":{"effect":"Zestaw ilości 1–10 dla przygotowanego produktu 18,40 zł i rabatu 23%. Wymaga przygotowanych danych; nie zmienia rabatu automatycznie.","steps":["PAY-007 — Zaokrąglenia według wzorca starej hurtowni"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Zestaw ilości 1–10 dla przygotowanego produktu 18,40 zł i rabatu 23%. Wymaga przygotowanych danych; nie zmienia rabatu automatycznie."},"redmine-36926":{"effect":"Cały zestaw 38 przypadków na koncie 1. Bez finalizacji. Testuje też książkę adresową i usuwa nowo utworzone dane QA; ograniczenia opisuje raport.","steps":["SHIP-002 — Zapis dostawy i poprawnych adresów","SHIP-003 — Niekompletny adres dostawy"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Cały zestaw 38 przypadków na koncie 1. Bez finalizacji. Testuje też książkę adresową i usuwa nowo utworzone dane QA; ograniczenia opisuje raport."},"descriptions":{"effect":"Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika.","steps":["DESC-011 — WHOLESALE — nazwa i slug na liście, nadpisanie i fallback","DESC-012 — WHOLESALE — cztery pola szczegółów, nadpisanie i fallback","DESC-013 — RETAIL — główne tłumaczenia w API","DESC-014 — ACADEMY — główne tłumaczenia na liście i w szczegółach","DESC-015 — WHOLESALE — productName w koszyku","DESC-016 — ACADEMY — productName w koszyku","DESC-017 — Nazwa wariantu w pozycjach API","DESC-018 — ACADEMY — closed-courses","DESC-019 — ACADEMY — paid-courses","DESC-021 — RETAIL — koszyk, podsumowanie i zapis nazwy"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika."},"descriptions-cms":{"effect":"Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem.","steps":["DESC-001 — Zakładka kanałowa i dostępne EMPIK/WHOLESALE","DESC-003 — Edycja i trwały zapis czterech pól kanałowych","DESC-004 — Puste pola i fallback każdego pola osobno","DESC-005 — Kolizja slugu w tym samym kanale","DESC-006 — Slug kanałowy równy głównemu slugowi","DESC-007 — Ten sam slug w EMPIK i WHOLESALE","DESC-008 — Minimalna długość nazwy kanałowej","DESC-009 — Maksymalna długość slugu kanałowego"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem."},"descriptions-web":{"effect":"Odczyt formularzy oferty i szkoleń oraz frontendu RETAIL: nazwy, slugi, pełne opisy A/B i Matlandii, wyszukiwarka, paginacja, kategoria Matematyka i niepusty krótki opis Matlandii. Wzorzec z głównych pól CMS. Bez zmian produktów, koszyków i finalizacji. Wymaga config/description-web.local.json.","steps":["DESC-002 — Ukrycie zakładki dla ofert i szkoleń","DESC-020 — RETAIL — strona, listy, wyszukiwanie i paginacja","DESC-026 — Generowanie URL dla wszystkich kanałów","DESC-027 — Tłumaczenia produktów dołączonych do oferty"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Odczyt formularzy oferty i szkoleń oraz frontendu RETAIL: nazwy, slugi, pełne opisy A/B i Matlandii, wyszukiwarka, paginacja, kategoria Matematyka i niepusty krótki opis Matlandii. Wzorzec z głównych pól CMS. Bez zmian produktów, koszyków i finalizacji. Wymaga config/description-web.local.json."},"descriptions-documents":{"effect":"Tworzy jedno zamówienie WHOLESALE na koncie podstawowym z produktu A (1 szt.). Wysyła complete najwyżej raz; zamówienie pozostaje na DEV i może wysłać e-mail. Migawka MailHoga przed operacją, potem dokładny odbiorca, nowe ID/czas i numer zamówienia. Porównuje tekst PDF i wiadomości z niezależną nazwą CMS. Nie testuje RETAIL, ACADEMY ani faktury.","steps":["DESC-024 — Nazwy produktów w treści PDF","DESC-025 — Nazwy w e-mailach i powiadomieniach"],"expected":["Dla wykonanych przypadków są spełnione ich oczekiwane wyniki. Pełną listę warunków otworzysz w zakładce „Scenariusze testowe”.","Raport wskazuje rzeczywisty zakres wykonania. Pominięcia oznaczają brak potwierdzenia dla tych przypadków."],"scope":"Tworzy jedno zamówienie WHOLESALE na koncie podstawowym z produktu A (1 szt.). Wysyła complete najwyżej raz; zamówienie pozostaje na DEV i może wysłać e-mail. Migawka MailHoga przed operacją, potem dokładny odbiorca, nowe ID/czas i numer zamówienia. Porównuje tekst PDF i wiadomości z niezależną nazwą CMS. Nie testuje RETAIL, ACADEMY ani faktury."}};
qaGuideData_warehouse["descriptions-all"]={"effect":"Tworzy ukryte produkty QA i nowe koszyki. Tymczasowo zmienia dane QA z przywróceniem. Wysyła testowe powiadomienie o dostępności.","steps":["API: porównanie nazw, slugów, opisów oraz nazwy wariantu z wzorcem.","CMS: zapis i walidacje tłumaczeń, ponowny odczyt i przywrócenie.","RETAIL: formularze ofert i szkoleń, nazwy, linki, wyszukiwarka i paginacja.","Nowy produkt: brak tłumaczeń po utworzeniu, zapis czterech pól i kontrola bazy.","Dwa koszyki RETAIL: Matlandia (1 nauczyciel + 11 uczniów) oraz oferta (2 A + 2 B).","Dostępność: własna subskrypcja nowego QA, zapas 0 → 1, nowy e-mail i przywrócenie."],"expected":["Raport zbiorczy zawiera rzeczywiste wyniki i linki do podraportów tej samej próby. Osobna tabela pokazuje sześć kontroli przekazanych z CMS i frontendu RETAIL, ich wyniki oraz dowody.","Błędy i rzeczywiste pominięcia pozostają widoczne. PASS kontroli nie oznacza pełnej akceptacji #33388."],"scope":"Konto podstawowe i konfiguracje modułów. Bez finalizacji zamówienia; PDF i potwierdzenie zamówienia pominięte. Nie przenosi historycznych PASS."};
qaGuideData_warehouse["descriptions-all-complete"]={"effect":"Tworzy ukryte produkty QA i nowe koszyki. Tymczasowo zmienia dane QA z przywróceniem. Wysyła testowe powiadomienie o dostępności. Dodatkowo zapisuje jedno zamówienie WHOLESALE i sprawdza PDF oraz nowe potwierdzenie e-mail.","steps":["API: porównanie nazw, slugów, opisów oraz nazwy wariantu z wzorcem.","CMS: zapis i walidacje tłumaczeń, ponowny odczyt i przywrócenie.","RETAIL: formularze ofert i szkoleń, nazwy, linki, wyszukiwarka i paginacja.","Nowy produkt: brak tłumaczeń po utworzeniu, zapis czterech pól i kontrola bazy.","Dwa koszyki RETAIL: Matlandia (1 nauczyciel + 11 uczniów) oraz oferta (2 A + 2 B).","Dostępność: własna subskrypcja nowego QA, zapas 0 → 1, nowy e-mail i przywrócenie.","Dokumenty: jedno complete, numer zamówienia i nazwa WHOLESALE w PDF oraz załączniku nowej wiadomości."],"expected":["Raport zbiorczy zawiera rzeczywiste wyniki i linki do podraportów tej samej próby. Osobna tabela pokazuje sześć kontroli przekazanych z CMS i frontendu RETAIL, ich wyniki oraz dowody.","Błędy i rzeczywiste pominięcia pozostają widoczne. PASS kontroli nie oznacza pełnej akceptacji #33388."],"scope":"Konto podstawowe; nowe zamówienie pozostaje na DEV. Nie obejmuje faktur, dokumentów RETAIL/ACADEMY ani całej akceptacji #33388. Nie ponawia niepewnej finalizacji."};
qaGuideData_warehouse["descriptions-retail-summary"]={"effect":"Loguje Moje GWO przed dodaniem QA i wymaga pustego koszyka. Tworzy Matlandię: 1 dostęp nauczycielski i 11 uczniowskich, sprawdza nazwę wariantu w podsumowaniu. Bez regulaminu i finalizacji. Po próbie usuwa własną pozycję po dokładnym ID i potwierdza pusty koszyk. Wymaga RETAIL_LOGIN_EMAIL i RETAIL_LOGIN_PASSWORD w .env. Etap danych przygotowuje aktualnym formularzem HTTP; nie testuje przycisku przejścia z koszyka.","prepare":["Konto Moje GWO z .env ma pusty koszyk.","Nie używaj tego konta równolegle."],"steps":["Zaloguj Moje GWO i potwierdź pusty koszyk.","Dodaj Matlandię z 1 dostępem nauczycielskim i 11 uczniowskimi.","Przygotuj dane zamówienia i porównaj nazwę wariantu w podsumowaniu.","Usuń wyłącznie własną pozycję QA i potwierdź pusty koszyk."],"expected":["Nazwa wariantu zgodna z application.summaryName. Koszyk po próbie znów jest pusty."],"scope":"Bez regulaminu, finalizacji, PDF i e-maila. Rodzaj zamówienia zapisuje formularzem HTTP; test dotyczy nazw, a nie przycisku nawigacji."};
qaGuideData_warehouse["descriptions-retail-documents"]={"effect":"Tworzy jedno zamówienie Matlandii RETAIL, akceptuje regulamin na DEV i wybiera przelew bankowy (bez zapłaty). Wymaga osobnych danych RETAIL_LOGIN_EMAIL / RETAIL_LOGIN_PASSWORD w .env. Sprawdza podsumowanie, zapis CMS, PDF i załącznik nowego e-maila. Nie ponawia utraconego zapisu; nie usuwa istniejących pozycji. Nie jest uruchamiany przez zestaw zbiorczy WHOLESALE. Logowanie następuje przed dodaniem QA; wymaga pustego koszyka i braku równoległego używania konta. Przed finalizacją sprząta własną pozycję po błędzie; po nieustalonym wyniku zapisu niczego nie usuwa.","prepare":["Konto Moje GWO z .env ma pusty koszyk.","Nie używaj konta równolegle w innych testach ani Postmanie."],"steps":["Zaloguj Moje GWO i potwierdź pusty koszyk.","Dodaj Matlandię: 1 dostęp nauczycielski i 11 uczniowskich.","Przygotuj dane i porównaj nazwę wariantu w podsumowaniu.","Zapisz jedno zamówienie z przelewem bankowym, bez wykonywania przelewu.","Porównaj zapis CMS, potwierdzenie PDF i załącznik nowej wiadomości tego numeru zamówienia."],"expected":["Numer zamówienia, nazwa wariantu i 11 dostępów uczniowskich są zgodne."],"scope":"Zapisuje jedno zamówienie na DEV. Rodzaj zamówienia przygotowuje formularzem HTTP; nie ocenia przycisku przejścia z koszyka. Nie ponawia nieustalonej finalizacji. Nie jest częścią wariantu zbiorczego WHOLESALE."};
installQaGuide({name:'Hurtownia',intro:['Na początek wybierz „Scenariusze testowe”: tam znajdziesz warunki, dane, kroki i oczekiwany wynik. Przycisk może uruchamiać cały zestaw, a nie jeden przypadek.',...["Wybierz przypadek według funkcji lub numeru zgłoszenia. Najpierw przeczytaj jego instrukcję.","Sprawdź adres środowiska i dane potrzebne do testu. Nazwa DEV oznacza środowisko programistyczne, a TEST — testowe.","Zaznaczenie testu lub otwarcie panelu tylko przygotowuje wybór. Dopiero przycisk uruchomienia rozpoczyna automat.","Po zakończeniu otwórz raport tego przebiegu. Sprawdź ID testu, wynik oraz powód ewentualnego pominięcia.","Jeśli sprawdzasz zgłoszenie, zapisz dowód w Centrum testów. Nie oznaczaj poprawki jako sprawdzonej, gdy właściwy test został pominięty."]],prepare:['Sprawdź aktywnego użytkownika u góry panelu. Koszyk i zamówienie korzystają z tego wyboru; inne zestawy mogą mieć własne konta.','W Konfiguracji sprawdź dostęp do API oraz sesję GitLab.','Przeczytaj warunki wybranego scenariusza i wpływ zestawu na dane.'],actions:['Otwórz „Scenariusze testowe” i wybierz przypadek z listy.','Przeczytaj sekcję „Uruchom powiązany test”, w tym zakres i ograniczenia zestawu.','Kliknij przycisk uruchomienia dopiero po sprawdzeniu wpływu na dane.','Wróć do „Uruchom testy”, obserwuj postęp, następnie otwórz raport tego przebiegu.'],effect:'Zależy od zestawu. Niektóre testy tylko odczytują dane, inne zapisują koszyki, zamówienia lub ustawienia CMS.',result:'Raporty są dostępne w zakładce Raporty. Wybierz konkretny przebieg; znajdziesz tam wykonane kontrole, faktyczne żądania i powody pominięć.',decorate(add){const effects={"cart":"Tworzy koszyk i zmienia jego pozycje. Nie finalizuje zamówienia.","order":"Tworzy i finalizuje zamówienie na środowisku DEV. Może uruchomić generowanie dokumentów i wiadomości.","regression":"Tworzy koszyki i sprawdza wiele przypadków. Bez finalizacji zamówienia.","regression-order":"Tworzy zamówienia z zapisem. Sprawdź w raporcie ich numery i stan finalizacji.","catalog":"Odczytuje katalog produktów i porównuje dane z wzorcem.","descriptions":"Odczytuje dane produktów i tworzy koszyki. Bez finalizacji. Formularze CMS, dokumenty i e-maile są sprawdzane osobnymi zestawami.","descriptions-cms":"Zapisuje pola kanałowe produktów QA w CMS i sprawdza walidacje. Zobacz w raporcie wynik przywracania danych.","descriptions-web":"Odczytuje ofertę oraz widoki sklepu RETAIL i porównuje nazwy oraz adresy stron.","descriptions-documents":"Tworzy nowe zamówienie WHOLESALE i sprawdza dokument PDF oraz wiadomość e-mail.","packages-profile":"Tymczasowo zmienia konfigurację paczek w CMS. Wynik przywrócenia konfiguracji sprawdź w raporcie.","product-create":"Tworzy ukrytą książkę QA przez formularz CMS, a następnie odczytuje i porównuje zapisane pola oraz ceny.","database":"Odczytuje zapisany raport i porównuje zamówienie z bazą.","login":"Otwiera przeglądarkę do logowania GitLab. Dokończ logowanie; samo otwarcie nie sprawdza funkcjonalności sklepu."};for(const run of document.querySelectorAll('button[data-suite]')){const suite=run.dataset.suite;let host=run.closest('.suite-card')||run.closest('.scenario-launch-option')||run.parentElement;if(host.querySelectorAll('button[data-suite]').length>1){if(!run.parentElement.classList.contains('qa-guide-action')){const wrapper=document.createElement('span');wrapper.className='qa-guide-action';run.before(wrapper);wrapper.append(run);}host=run.parentElement;}if(host.closest('.qa-guide-dialog'))continue;const title=host.querySelector('h3,h2')?.textContent||run.textContent.trim();add({title,...qaGuideData_warehouse[suite],effect:qaGuideData_warehouse[suite]?.effect||effects[suite]||'Zakres i wpływ tego zestawu sprawdź w opisach powiązanych scenariuszy przed uruchomieniem. Nie zakładaj, że jest tylko do odczytu.',scope:qaGuideData_warehouse[suite]?.scope||'Przycisk uruchamia zestaw „'+title+'”. Może obejmować więcej niż jeden przypadek.'},host);}const detail=document.getElementById('scenario-detail');if(typeof scenarioCatalog!=='undefined'&&scenarioCatalog&&detail){const s=scenarioCatalog.cases.find(x=>x.id===selectedScenario);if(s)add({title:s.id+' — '+s.title,type:s.coverage==='planned'?'manual':'automatic',prepare:[...s.conditions,'Dane do tej próby: '+s.data],steps:s.steps,expected:s.expected,effect:scenarioCatalog.effectLabels[s.effect],scope:s.automation.limits||'',purpose:s.requirement||s.title},detail);}}});
/* QA_GUIDE_END */

// Preferencja podglądu jest lokalna; nie zmienia .env ani kolejnych uruchomień CLI.
(()=>{const toggle=$('browser-preview'),speed=$('browser-preview-speed');try{const saved=JSON.parse(localStorage.getItem('hurt-browser-preview')??'null');if(saved){toggle.checked=saved.enabled===true;if(['0','250','750'].includes(String(saved.slowMoMs)))speed.value=String(saved.slowMoMs);}}catch{}const update=()=>{speed.disabled=!toggle.checked;try{localStorage.setItem('hurt-browser-preview',JSON.stringify({enabled:toggle.checked,slowMoMs:Number(speed.value)}));}catch{}};toggle.addEventListener('change',update);speed.addEventListener('change',update);update();})();
