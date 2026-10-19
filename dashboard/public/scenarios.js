let scenarioCatalog,scenarioLoading=false,selectedScenario=new URLSearchParams(location.search).get('scenario');
const scenarioList=items=>`<ul>${items.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`;
function scenarioActions(s){
  const actions=s.automation.actions??[];
  return `<section class="scenario-launch"><h3>Uruchom powiązany test</h3>${actions.length?'<p>Przycisk uruchamia cały opisany zestaw, nie pojedynczy przypadek. Wynik zestawu nie jest osobnym wynikiem tego scenariusza.</p>'+actions.map(id=>{const a=scenarioCatalog.actions[id];return `<div class="scenario-launch-option"><button class="${a.suite?'primary run':'secondary'}" ${a.suite?`data-suite="${esc(a.suite)}" ${state?.jobs.some(j=>j.status==='RUNNING')||customAccountSaving?'disabled':''}`:`data-scenario-view="${esc(a.view)}"${a.target?` data-scenario-target="${esc(a.target)}"`:''}`}>${esc(a.label)} →</button><p>${esc(a.note)}</p></div>`;}).join(''):'<p>Ten przypadek nie ma jeszcze samodzielnego testu uruchamianego w panelu. Wykonaj opisane kroki ręcznie; sposób i ograniczenia znajdziesz poniżej.</p>'}</section>`;
}
async function loadScenarios(){
  if(scenarioCatalog){renderScenarios();return;}if(scenarioLoading)return;scenarioLoading=true;
  try{
    const response=await fetch('/api/scenarios');if(!response.ok)throw Error('Nie udało się wczytać scenariuszy.');scenarioCatalog=await response.json();
    $('scenario-category').innerHTML='<option value="">Wszystkie obszary</option>'+scenarioCatalog.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
    $('scenario-coverage').innerHTML='<option value="">Cały zakres</option>'+Object.entries(scenarioCatalog.coverageLabels).map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');
    $('scenario-summary').innerHTML=`<div><strong>${scenarioCatalog.cases.length}</strong><span>scenariusze</span></div><div><strong>${scenarioCatalog.categories.length}</strong><span>obszarów</span></div>`+Object.entries(scenarioCatalog.coverageLabels).map(([id,label])=>`<div><strong>${scenarioCatalog.cases.filter(s=>s.coverage===id).length}</strong><span>${esc(label)}</span></div>`).join('');
    $('scenario-guide').innerHTML=`<h3>Warunki wspólne</h3>${scenarioList(scenarioCatalog.prerequisites)}<h3>Przygotowanie danych</h3>${scenarioList(scenarioCatalog.setupNotes)}<h3>Zasady interpretacji</h3>${scenarioList(scenarioCatalog.rules)}<h3>Priorytety</h3>${scenarioList(Object.entries(scenarioCatalog.priorities).map(([id,label])=>id+' — '+label))}<h3>Endpointy</h3><p>${esc(scenarioCatalog.baseUrl)}</p>${scenarioList(scenarioCatalog.endpoints.map(e=>`${e.method} ${e.path} — ${e.purpose}`))}<h3>Nagłówki</h3>${scenarioList(scenarioCatalog.headers)}<h3>Co zapisać po wykonaniu</h3>${scenarioList(scenarioCatalog.executionFields)}`;
    renderScenarios();
  }catch(error){$('scenario-count').textContent='Błąd wczytywania';$('scenario-detail').textContent=error.message;$('scenario-list').innerHTML='<button class="secondary" id="scenario-retry">Spróbuj ponownie</button>';}
  finally{scenarioLoading=false;}
}
function renderScenarios(){
  if(!scenarioCatalog)return;
  const query=$('scenario-search').value.trim().toLocaleLowerCase('pl');
  const cases=scenarioCatalog.cases.filter(s=>['category','priority','coverage'].every(key=>!$('scenario-'+key).value||$('scenario-'+key).value===s[key])&&(!query||JSON.stringify(s).toLocaleLowerCase('pl').includes(query)));
  if(!cases.some(s=>s.id===selectedScenario))selectedScenario=cases[0]?.id;
  $('scenario-count').textContent=`${cases.length} z ${scenarioCatalog.cases.length} scenariuszy`;
  $('scenario-list').innerHTML=cases.map(s=>`<button class="scenario-item ${s.id===selectedScenario?'selected':''}" data-scenario="${esc(s.id)}" aria-pressed="${s.id===selectedScenario}"><span class="scenario-item-meta"><strong>${esc(s.id)}</strong><span class="scenario-priority ${esc(s.priority)}">${esc(s.priority)}</span></span><span class="scenario-item-title">${esc(s.title)}</span><small>${esc(scenarioCatalog.coverageLabels[s.coverage])}</small></button>`).join('')||'<p>Brak wyników. Zmień hasło lub wyczyść filtry.</p>';
  const s=cases.find(s=>s.id===selectedScenario);if(!s){$('scenario-detail').textContent='Nie ma scenariuszy pasujących do wybranych filtrów.';return;}
  const category=scenarioCatalog.categories.find(c=>c.id===s.category);
  $('scenario-detail').innerHTML=`<div class="eyebrow">${esc(category.label)} · ${esc(s.id)}</div><h2>${esc(s.title)}</h2>${s.requirement?`<p class="muted">Wymaganie: ${esc(s.requirement)}</p>`:''}${s.historicalEvidence?`<div class="scenario-notice${s.historicalEvidence.status==='FAIL'?' scenario-evidence-fail':''}"><strong>Dowód z zapisanego przebiegu${s.historicalEvidence.status?' — '+esc(s.historicalEvidence.status):''}</strong><p>${esc(s.historicalEvidence.note)}</p><a href="/reports/${encodeURIComponent(s.historicalEvidence.reportId)}/raport.html" target="_blank" rel="noopener">Otwórz raport tego przebiegu ↗</a></div>`:''}<div class="scenario-tags"><span class="scenario-priority ${esc(s.priority)}">${esc(s.priority)}</span><span>${esc(scenarioCatalog.coverageLabels[s.coverage])}</span><span>${esc(scenarioCatalog.effectLabels[s.effect])}</span></div>${scenarioActions(s)}<h3>Warunki wstępne</h3>${scenarioList(s.conditions)}<h3>Dane testowe</h3><p>${esc(s.data)}</p><h3>Krok po kroku</h3><ol class="scenario-steps">${s.steps.map(v=>`<li>${esc(v)}</li>`).join('')}</ol><h3>Oczekiwany wynik</h3><div class="scenario-expected">${scenarioList(s.expected)}</div><div class="scenario-automation"><h3>Gdzie sprawdzamy ten przypadek?</h3><p><strong>${esc(s.automation.runner)}</strong></p>${s.automation.limits?`<p>${esc(s.automation.limits)}</p>`:''}<details><summary>Pliki powiązane ze scenariuszem</summary>${scenarioList(s.automation.sources)}</details><p class="muted">Opis zakresu automatyzacji. Aktualny wynik znajdziesz w raporcie konkretnego uruchomienia.</p></div>`;
}
for(const id of ['search','category','priority','coverage'])$('scenario-'+id).addEventListener('input',renderScenarios);
$('scenario-reset').addEventListener('click',()=>{for(const id of ['search','category','priority','coverage'])$('scenario-'+id).value='';renderScenarios();});
$('scenario-list').addEventListener('click',event=>{const item=event.target.closest('[data-scenario]');if(item){selectedScenario=item.dataset.scenario;renderScenarios();}if(event.target.closest('#scenario-retry'))loadScenarios();});
$('scenario-detail').addEventListener('click',event=>{
  const button=event.target.closest('[data-scenario-view]');if(!button)return;
  setView(button.dataset.scenarioView);
  if(button.dataset.scenarioTarget){$('suite-reset').click();const form=$(button.dataset.scenarioTarget);if(form){form.closest('details').open=true;form.scrollIntoView({behavior:'smooth',block:'center'});}}
});
