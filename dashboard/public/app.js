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
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=document.querySelector('meta[name=ui-token]').content;
let state,activeView='start',loading=false,lastJson='';
const badge=status=>`<span class="badge ${esc(status)}">${esc(status)}</span>`;
const date=value=>value?new Date(value).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const money=value=>typeof value==='number'?(value/100).toLocaleString('pl-PL',{style:'currency',currency:'PLN'}):'brak ceny';
function toast(message){$('toast').textContent=message;$('toast').hidden=false;}
async function post(endpoint,body){const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-UI-Token':token},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error??'Błąd operacji');return result;}
function setView(view){activeView=view;for(const node of document.querySelectorAll('.view'))node.hidden=node.id!=='view-'+view;for(const b of document.querySelectorAll('nav button'))b.classList.toggle('active',b.dataset.view===view);$('view-label').textContent={start:'Uruchom testy',wizard:'Zamówienie krok po kroku','create-product':'Nowy produkt API',reports:'Raporty',api:'Podgląd API',settings:'Konfiguracja',scenarios:'Scenariusze testowe',documentation:'Dokumentacja testów'}[view];if(view==='reports')renderReports();if(view==='documentation')loadDocumentation();if(view==='scenarios')loadScenarios();window.scrollTo(0,0);}
function reportTable(rows){if(!rows.length)return '<div class="empty"><span>▤</span><h3>Brak raportów</h3><p>Uruchom test lub zmień ustawienia wyszukiwania.</p></div>';return `<div class="table-scroll"><table class="report-table"><thead><tr><th>SCENARIUSZ</th><th>WYNIK</th><th>SPRAWDZENIA</th><th>DATA</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><div class="report-title">${esc(r.name)}</div><div class="report-sub">${r.orderId?'Koszyk / zamówienie '+esc(r.orderId):({'catalog':'Testy endpointów katalogu','product-create':'Tworzenie produktu przez API','rounding':'Wyceny i zaokrąglenia','descriptions':'Tłumaczenia kanałów','order-regression':'Scenariusze zamówienia i paczek','database':'Porównanie API / baza'}[r.kind]??'Testy API')}${r.products.length?' · '+esc(r.products.slice(0,3).join(', '))+(r.products.length>3?'…':''):''}</div></td><td>${badge(r.status)}</td><td><span class="muted">${r.counts.PASS} ✓ &nbsp; ${r.counts.FAIL} ✕ &nbsp; ${r.counts.SKIP} pom.</span></td><td><span class="muted">${date(r.date)}</span></td><td><button class="plain" data-report="${esc(r.id)}">Otwórz →</button>${r.finalization==='potwierdzona przez API'?`<button class="plain" data-db-report="${esc(r.id)}">Porównaj z bazą</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;}
function renderReports(){if(!state)return;const text=$('report-search').value.toLocaleLowerCase('pl');const status=$('report-status').value,kind=$('report-kind').value;const rows=state.reports.filter(r=>(!status||r.status===status)&&(!kind||r.kind===kind)&&(!text||[r.name,r.id,r.orderId,...r.products].join(' ').toLocaleLowerCase('pl').includes(text)));$('all-reports').innerHTML=reportTable(rows);}
function openReport(id){const r=state.reports.find(r=>r.id===id);if(!r)return;setView('reports');const url='/reports/'+encodeURIComponent(id)+'/raport.html';$('preview-title').textContent=r.name+(r.orderId?' · '+r.orderId:'');$('open-report').href=url;$('report-frame').src=url;$('report-preview').hidden=false;$('report-preview').scrollIntoView({behavior:'smooth',block:'start'});}
function renderSettings(){const s=state.settings;$('settings-content').innerHTML=`<h2>Stan połączenia</h2><dl class="settings-grid"><dt>Adres API</dt><dd>${esc(state.baseUrl)}</dd><dt>Dane hurtownika</dt><dd>${s.credentialsReady?'✓ Uzupełnione':'Do uzupełnienia w .env'}</dd><dt>Sesja bramki GitLab</dt><dd>${s.gatewaySession?'Zapisana — ważność sprawdza żądanie API':'Brak zapisanej sesji'}</dd><dt>Dane administratora API</dt><dd>${s.adminReady?'Uzupełnione — uprawnienia sprawdza test':'Do uzupełnienia w .env'}</dd><dt>Losowanie produktów</dt><dd>${s.randomProducts?.enabled?'Włączone · Adamada / pozostałe osobno':'Wyłączone'}</dd><dt>Losowanie płatności</dt><dd>${s.randomCheckout?.payment?'Włączone':'Wyłączone'}</dd><dt>Losowanie dostawy</dt><dd>${s.randomCheckout?.shipping?'Włączone':'Wyłączone'}</dd><dt>Rabat Adamady</dt><dd>${esc(s.groupRebates?.adamada??'Nie skonfigurowano')}%</dd><dt>Środowisko test</dt><dd>Zablokowane</dd></dl>`;}
function renderJob(){const job=state.jobs[0];const running=state.jobs.find(j=>j.status==='RUNNING');$('checkout-account').disabled=!!running||customAccountSaving;$('custom-account-email').disabled=!!running||customAccountSaving;$('custom-account-save').disabled=!!running||customAccountSaving;if(!$('custom-account-email').dataset.initialized){$('custom-account-email').value=state.customEmail??'';$('custom-account-email').dataset.initialized='true';}$('checkout-account').querySelector('[value=secondary]').disabled=!state.settings.secondAccountReady;for(const b of document.querySelectorAll('.run'))b.disabled=!!running||customAccountSaving;document.querySelector('.run-panel').classList.toggle('busy',!!running);$('stop-job').hidden=!running;$('stop-job').dataset.id=running?.id??'';if(!job){$('job-empty').hidden=false;$('job-content').hidden=true;return;}$('job-empty').hidden=true;$('job-content').hidden=false;$('job-heading').innerHTML=badge(job.status)+`<strong>${esc(job.name)}</strong><span class="muted">${date(job.startedAt)}</span>`;const log=$('job-log');const stick=log.scrollTop+log.clientHeight>=log.scrollHeight-35;log.textContent=job.log||'Uruchamianie zestawu testów…';if(stick)log.scrollTop=log.scrollHeight;const result=state.reports.find(r=>job.log.includes(r.id));$('job-report').innerHTML=result?`<button class="plain" data-report="${esc(result.id)}">Otwórz raport tego przebiegu →</button>`:'';}
async function refresh(){if(loading)return;loading=true;try{const r=await fetch('/api/state');const data=await r.json();if(!r.ok)throw Error(data.error);state=data;$('report-count').textContent=state.reports.length;const pass=state.reports.filter(r=>r.status==='PASS').length,fail=state.reports.filter(r=>['FAIL','INCOMPLETE'].includes(r.status)).length;const last=state.reports[0];$('stats').innerHTML=[['Zebrane raporty',state.reports.length,'Pełna historia na tym komputerze'],['Zakończone PASS',pass,'Wykonane kontrole bez błędów'],['Do sprawdzenia',fail,'Raporty z niezgodnościami'],['Ostatni wynik',last?badge(last.status):'—',last?date(last.date):'Jeszcze bez uruchomień']].map(([label,value,note])=>`<div class="stat"><div class="stat-label">${label}<span>↗</span></div><div class="stat-number">${value}</div><div class="stat-note">${note}</div></div>`).join('');$('recent-reports').innerHTML=reportTable(state.reports.slice(0,5));renderReports();renderSettings();renderJob();renderAccount();renderWizard();renderProductForm();$('local-time').textContent=new Date().toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Warsaw'});}catch(e){toast(e.message);}finally{loading=false;}}
document.addEventListener('click',async event=>{const target=event.target.closest('button');if(!target)return;if(target.dataset.view)setView(target.dataset.view);if(target.dataset.goto)setView(target.dataset.goto);if(target.dataset.report)openReport(target.dataset.report);if(target.dataset.suite){target.disabled=true;try{const suite=target.dataset.suite;const body={suite,verifyDatabase:$('verify-database').checked};const linkedCases=linkedCasesForSuite(suite);if(linkedCases)body.caseIds=linkedCases;if(['cart','order'].includes(suite))body.account=selectedCheckoutAccount();if(['cart','order'].includes(suite)&&$('seed').value.trim())body.seed=$('seed').value.trim();await post('/api/run',body);$('toast').hidden=true;setView('start');await refresh();document.querySelector('.run-panel').scrollIntoView({behavior:'smooth',block:'center'});}catch(e){toast(e.message);target.disabled=false;}}});
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
    await post('/api/run',{suite:'packages-profile',profile});$('toast').hidden=true;await refresh();document.querySelector('.run-panel').scrollIntoView({behavior:'smooth'});
  }catch(e){toast(e.message);}finally{button.disabled=false;}
});


document.addEventListener('click',async event=>{const button=event.target.closest('[data-db-report]');if(!button)return;button.disabled=true;try{await post('/api/run',{suite:'database',reportId:button.dataset.dbReport});setView('start');await refresh();document.querySelector('.run-panel').scrollIntoView({behavior:'smooth'});}catch(e){toast(e.message);}finally{button.disabled=false;}});

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
