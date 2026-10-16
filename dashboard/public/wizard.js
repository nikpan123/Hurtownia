// Funkcje współdzielą lokalny stan panelu; plik dołączany po app.js.
let wizardProducts=[],wizardJobId=null,wizardPhaseKey='',wizardAutoStarting=false,wizardShowSelection=false;
const selectedWizardItems=()=>[...document.querySelectorAll('[data-wizard-product]:checked')].map(c=>({productVariant:c.value,quantity:Number(document.querySelector('[data-quantity="'+CSS.escape(c.value)+'"]').value)}));
function updateWizardSelection(){
  const items=selectedWizardItems();const group=items.length?wizardProducts.find(p=>p.productVariant===items[0].productVariant).group:null;
  for(const c of document.querySelectorAll('[data-wizard-product]')){const p=wizardProducts.find(p=>p.productVariant===c.value);c.disabled=!!group&&(p.group!==group||items.length>=5&&!c.checked);}
  $('wizard-start').disabled=!items.length||!!state?.jobs.some(j=>j.status==='RUNNING');
  $('wizard-auto').disabled=!wizardProducts.length||!!state?.jobs.some(j=>j.status==='RUNNING')||wizardAutoStarting;
  $('wizard-auto').textContent=items.length?'Przejdź automatycznie z wybranymi produktami aż do zapisu':'Losuj i przejdź automatycznie aż do zapisu';
  $('wizard-selection').textContent=items.length?items.length+' pozycji · '+(group==='adamada'?'tylko Adamada':'pozostałe produkty'):'Nie wybrano produktów.';
}
$('wizard-load').addEventListener('click',async()=>{
  $('wizard-load').disabled=true;
  try{const r=await post('/api/wizard/products',{account:selectedCheckoutAccount()});wizardProducts=r.products;
    $('wizard-products').innerHTML=wizardProducts.length?wizardProducts.map(p=>`<label class="wizard-product"><input type="checkbox" value="${esc(p.productVariant)}" data-wizard-product><div><strong>${esc(p.name)}</strong><small>${esc(p.merchandiseCode??p.productVariant)} · ${p.group==='adamada'?'Adamada':'Pozostałe'}</small><span>${money(p.price)} brutto / szt. przed rabatem konta</span></div><input aria-label="Ilość ${esc(p.name)}" data-quantity="${esc(p.productVariant)}" type="number" min="1" max="10" value="1"></label>`).join(''):'<p>Brak dostępnych produktów w puli testowej.</p>';
    updateWizardSelection();$('toast').hidden=true;
  }catch(e){toast(e.message);}finally{$('wizard-load').disabled=false;}
});
$('wizard-products').addEventListener('change',updateWizardSelection);
$('wizard-start').addEventListener('click',async()=>{
  $('wizard-start').disabled=true;
  try{const job=await post('/api/run',{suite:'wizard',account:selectedCheckoutAccount(),verifyDatabase:$('verify-database').checked,items:selectedWizardItems(),automatic:wizardAutoStarting});wizardJobId=job.id;wizardPhaseKey='';wizardShowSelection=false;$('wizard-summary').innerHTML='';$('toast').hidden=true;await refresh();}catch(e){toast(e.message);updateWizardSelection();}finally{wizardAutoStarting=false;}
});
$('wizard-auto').addEventListener('click',()=>{
  if(selectedWizardItems().length){wizardAutoStarting=true;$('wizard-start').click();return;}
  const groups=[...new Set(wizardProducts.map(p=>p.group))];const group=groups[Math.floor(Math.random()*groups.length)];
  const pool=wizardProducts.filter(p=>p.group===group);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const picked=new Set(pool.slice(0,1+Math.floor(Math.random()*Math.min(5,pool.length))).map(p=>p.productVariant));
  for(const c of document.querySelectorAll('[data-wizard-product]')){c.checked=picked.has(c.value);if(c.checked)document.querySelector('[data-quantity="'+CSS.escape(c.value)+'"]').value=1+Math.floor(Math.random()*10);}
  updateWizardSelection();wizardAutoStarting=true;$('wizard-start').click();
});
function wizardOrder(order){
  if(!order)return '';
  return `<h3>Koszyk / zamówienie ${esc(order.id)}</h3><div class="table-scroll"><table class="report-table"><thead><tr><th>PRODUKT</th><th>SZT.</th><th>RABAT</th><th>NETTO PO RABACIE</th><th>BRUTTO PO RABACIE</th></tr></thead><tbody>${order.items.map(p=>`<tr><td>${esc(p.productName)}<small class="report-sub"> ${esc(p.code)}</small></td><td>${p.quantity}</td><td>${esc(p.rebatePercent)}%</td><td>${money(p.totalNetSalesAfterDiscount)}</td><td>${money(p.total)}</td></tr>`).join('')}</tbody></table></div><div class="wizard-totals"><span>Produkty brutto <strong>${money(order.itemsTotal)}</strong></span><span>Dostawa <strong>${money(order.shippingTotal)}</strong></span><span>Do zapłaty <strong>${money(order.total)}</strong></span></div>`;
}
function renderWizard(){
  const job=state.jobs.find(j=>j.id===wizardJobId)??state.jobs.find(j=>j.suite==='wizard');
  if(!job){updateWizardSelection();return;}
  wizardJobId=job.id;const running=job.status==='RUNNING';$('wizard-select').hidden=running||!wizardShowSelection;$('wizard-live').hidden=false;$('wizard-stop').hidden=!running;$('wizard-log').textContent=job.log;
  const w=job.wizard??{};const phaseKey=job.id+':'+(w.requestId??w.phase??job.status);
  if(phaseKey!==wizardPhaseKey){
    wizardPhaseKey=phaseKey;
    $('wizard-title').textContent=running?({payment:'Wybierz płatność',shipping:'Wybierz dostawę',review:'Sprawdź i zatwierdź zamówienie',working:'Trwa wykonywanie żądań API…'}[w.phase]??'Przygotowanie koszyka'):job.status==='PASS'?'Zamówienie zapisane i sprawdzone':job.status==='CANCELLED'?'Przebieg zatrzymany':job.completionBlocked?'Wykryto niezgodności — zapis zamówienia zablokowany':'Test zatrzymany — sprawdź raport';
    if(w.order)$('wizard-summary').innerHTML=wizardOrder(w.order);
    else if(job.lastOrder)$('wizard-summary').innerHTML=wizardOrder(job.lastOrder);
    $('wizard-choices').innerHTML=running&&w.options?`<div class="wizard-options">${w.options.map(o=>`<button class="secondary" data-wizard-choice="${esc(o.code)}">${esc(o.name??o.code)}${w.phase==='payment'?`<small>Rabat ${esc(o.rebatePercent)}% · oferta produktów: ${money(o.orderItemTotal)} (${state.settings.paymentQuoteTotalBasis==='gross'?'brutto':'netto'})</small>`:''}</button>`).join('')}</div>`:running&&w.phase==='review'?`<p>Płatność: <strong>${esc(w.order.paymentCode)}</strong> · Dostawa: <strong>${esc(w.order.shippingCode)}</strong></p><div class="wizard-addresses"><div><strong>Wysyłka</strong><p>${esc(w.shippingAddress.company)}<br>${esc(w.shippingAddress.street)} ${esc(w.shippingAddress.streetNumber)}<br>${esc(w.shippingAddress.postcode)} ${esc(w.shippingAddress.city)}</p></div><div><strong>Faktura</strong><p>${esc(w.billingAddress.company)}<br>NIP: ${esc(w.billingAddress.nip)}<br>${esc(w.billingAddress.street)} ${esc(w.billingAddress.streetNumber)}<br>${esc(w.billingAddress.postcode)} ${esc(w.billingAddress.city)}</p></div></div><p>Zapis dotyczy konta testowego dev. Może wysłać e-mail i przekazać zamówienie do bazy transferowej.</p><button class="primary" data-wizard-choice="complete">Zatwierdź i zapisz zamówienie testowe</button>`:'';
    if(running&&job.automatic&&w.requestId){
      const notice=document.createElement('p');notice.textContent='Tryb automatyczny: wybór za 3 sekundy…';$('wizard-choices').prepend(notice);
      setTimeout(()=>{const latest=state.jobs.find(j=>j.id===job.id);if(latest?.status!=='RUNNING'||latest.wizard?.requestId!==w.requestId)return;const buttons=[...document.querySelectorAll('[data-wizard-choice]')];buttons[Math.floor(Math.random()*buttons.length)]?.click();},3000);
    }
  }
  const report=state.reports.find(r=>job.log.includes(r.id));
  $('wizard-result').innerHTML=!running?`${badge(job.status)} <button class="secondary" data-wizard-new>Nowe zamówienie</button>${job.lastOrder?`<p>Płatność: <strong>${esc(job.lastOrder.paymentCode)}</strong> · Dostawa: <strong>${esc(job.lastOrder.shippingCode)}</strong></p>`:''}<p>${job.status==='PASS'?'Serwer potwierdził zamówienie. Dokumenty i sprawdzenia znajdziesz w raporcie.':job.status==='CANCELLED'?'Przerwanie nie cofa operacji przyjętych przez API.':'Szczegóły błędu są w raporcie lub dzienniku poniżej. Nie ponawiaj zapisu bez sprawdzenia stanu zamówienia.'}</p>${job.error?`<pre>${esc(job.error)}</pre>`:''}${report?`<button class="secondary" data-report="${esc(report.id)}">Otwórz raport →</button> ${report.files.filter(f=>f.endsWith('.pdf')).map(f=>`<a class="secondary" target="_blank" rel="noopener" href="/reports/${encodeURIComponent(report.id)}/${encodeURIComponent(f)}">${esc(f)} ↗</a>`).join('')}`:''}`:'';
  updateWizardSelection();
}
$('wizard-choices').addEventListener('click',async event=>{
  const button=event.target.closest('[data-wizard-choice]');if(!button)return;
  for(const b of $('wizard-choices').querySelectorAll('button'))b.disabled=true;
  try{const job=state.jobs.find(j=>j.id===wizardJobId);await post('/api/wizard/choice',{id:job.id,requestId:job.wizard.requestId,value:button.dataset.wizardChoice});await refresh();}catch(e){toast(e.message);for(const b of $('wizard-choices').querySelectorAll('button'))b.disabled=false;}
});
$('wizard-stop').addEventListener('click',async()=>{try{await post('/api/stop',{id:wizardJobId});await refresh();}catch(e){toast(e.message);}});


$('wizard-result').addEventListener('click',event=>{if(event.target.closest('[data-wizard-new]')){wizardShowSelection=true;renderWizard();$('wizard-select').scrollIntoView({behavior:'smooth',block:'start'});}});

$('checkout-account').addEventListener('change',()=>{wizardProducts=[];$('wizard-products').innerHTML='<p>Zmieniono konto. Pobierz ponownie produkty dla wybranego użytkownika.</p>';updateWizardSelection();});
