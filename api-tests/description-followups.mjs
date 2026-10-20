import {readFile} from 'node:fs/promises';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderDescriptionFollowups(report,catalog){
 const ids=[...new Set(report.tests.filter(t=>t.status==='SKIP').flatMap(t=>t.scenarioIds??[]))];if(!ids.length)return '';
 const rows=ids.map(id=>{const s=catalog.cases.find(s=>s.id===id);if(!s)return '';const actions=(s.automation.actions??[]).map(id=>catalog.actions[id]).filter(Boolean),e=s.historicalEvidence;
  return `<tr><td><a href="/?scenario=${esc(id)}#scenarios">${esc(id)} — ${esc(s.title)}</a></td><td>${actions.length?actions.map(a=>`<p><b>${esc(a.label)}</b><br>${esc(a.note)}</p>`).join(''):'Brak gotowego automatu dla pełnego zakresu.'}<p>${esc(s.automation.limits)}</p></td><td>${e&&/^[a-z0-9_-]+$/i.test(e.reportId)?`<a href="/reports/${esc(e.reportId)}/raport.html">Osobny zapisany przebieg — ${esc(e.status)}</a><p>${esc(e.note)}</p>`:'Brak przypisanego potwierdzenia wykonania.'}</td></tr>`;
 }).join('');
 return `<section><h2>Pominięte w tym przebiegu — gdzie sprawdzić dalej?</h2><p>Mapa z aktualnego katalogu scenariuszy. Nie dopisuje wyników do tego przebiegu. Dowód z innego raportu dotyczy wyłącznie opisanych w nim danych, czasu i zakresu. Kliknij ID, aby zobaczyć kroki i przyciski właściwych zestawów.</p><details><summary>Pokaż właściwe zestawy i osobne dowody (${ids.length})</summary><div class="scroll"><table><tr><th>Scenariusz</th><th>Właściwy zestaw i pozostałe braki</th><th>Osobny dowód wykonania</th></tr>${rows}</table></div></details></section>`;
}
export async function descriptionFollowups(report){if(report.kind!=='descriptions')return '';const catalog=JSON.parse(await readFile(new URL('../docs/product-channel-scenarios.json',import.meta.url),'utf8'));return renderDescriptionFollowups(report,catalog);}
