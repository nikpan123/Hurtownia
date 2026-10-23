import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {packageScenarioCategory,packageScenarioActions,packageScenarioCases} from './package-scenarios.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function loadScenarioCatalog(scope='all'){
  const cart=JSON.parse(await readFile(path.join(root,'docs/cart-api-scenarios.json'),'utf8'));
  if(scope==='cart')return cart;
  const descriptions=JSON.parse(await readFile(path.join(root,'docs/product-channel-scenarios.json'),'utf8'));
  if(scope==='descriptions')return {...cart,...descriptions,coverageLabels:cart.coverageLabels,effectLabels:{...cart.effectLabels,...descriptions.effectLabels},priorities:cart.priorities,actions:{...cart.actions,...descriptions.actions}};
  return {...cart,title:'Scenariusze testowe API i funkcji księgarni',scope:'Koszyk hurtowy oraz opisy produktów w kanałach sprzedaży. Katalog wymagań i pokrycia kodem; wynik konkretnego wykonania znajduje się w raporcie.',categories:[...cart.categories,...descriptions.categories,packageScenarioCategory],effectLabels:{...cart.effectLabels,...descriptions.effectLabels},cases:[...cart.cases,...descriptions.cases,...packageScenarioCases],actions:{...cart.actions,...descriptions.actions,...packageScenarioActions},endpoints:[...cart.endpoints,...descriptions.endpoints],rules:[...cart.rules,...descriptions.rules],prerequisites:[...cart.prerequisites,...descriptions.prerequisites],setupNotes:[...cart.setupNotes,...descriptions.setupNotes]};
}
export function renderScenarioMarkdown(c){
  const bullets=items=>items.map(s=>`- ${s}`).join('\n');
  const out=[`# ${c.title}`,`Aktualizacja: ${c.updatedAt}`,c.scope,
    '**To katalog scenariuszy, a nie raport wykonania.** Status automatyzacji opisuje dostępny kod; nie oznacza wyniku PASS.',
    '## Warunki wspólne',bullets(c.prerequisites),'## Zasady interpretacji',bullets(c.rules),
    '## Przygotowanie danych',bullets(c.setupNotes),'## Legenda',
    ...Object.entries(c.coverageLabels).map(([key,label])=>`- **${label}** (${key})`),
    ...Object.entries(c.priorities).map(([key,label])=>`- **${key}**: ${label}`),
    '## Spis scenariuszy',['| ID | Scenariusz | Priorytet | Automatyzacja |','| --- | --- | --- | --- |',
    ...c.cases.map(s=>`| ${s.id} | ${s.title} | ${s.priority} | ${c.coverageLabels[s.coverage]} |`)].join('\n')];
  for(const category of c.categories){
    out.push(`## ${category.label}`);
    for(const s of c.cases.filter(s=>s.category===category.id))out.push(
      `### ${s.id} — ${s.title}`,`**${s.priority} · ${c.coverageLabels[s.coverage]} · ${c.effectLabels[s.effect]}**`,
      s.requirement?`**Wymaganie:** ${s.requirement}`:'',
      s.historicalEvidence?`**Dowód historyczny:** ${s.historicalEvidence.note} [Otwórz raport](http://127.0.0.1:18767/reports/${s.historicalEvidence.reportId}/raport.html)`:'',
      '**Warunki wstępne**',bullets(s.conditions),'**Dane**',s.data,'**Kroki**',s.steps.map((v,i)=>`${i+1}. ${v}`).join('\n'),
      '**Oczekiwany wynik**',bullets(s.expected),'**Odpowiadający test**',s.automation.runner,
      ...(s.automation.actions??[]).map(id=>`**${c.actions[id].label}:** ${c.actions[id].note} Uruchamiany jest cały zestaw, nie pojedynczy przypadek.`),
      bullets(s.automation.sources.map(f=>`\`${f}\``)),s.automation.limits?`**Ograniczenia:** ${s.automation.limits}`:'');
  }
  out.push('## Endpointy',`Adres bazowy: ${c.baseUrl}`,['| Metoda | Ścieżka | Zastosowanie |','| --- | --- | --- |',...c.endpoints.map(e=>`| ${e.method} | \`${e.path}\` | ${e.purpose} |`)].join('\n'),'## Nagłówki',bullets(c.headers),'## Zapis wyniku pojedynczego wykonania',bullets(c.executionFields));
  return out.filter(Boolean).join('\n\n')+'\n';
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  for(const [scope,file]of [['cart','SCENARIUSZE-KOSZYKA-HURTOWEGO.md'],['descriptions','SCENARIUSZE-OPISOW-KANALOWYCH.md'],['all','SCENARIUSZE-TESTOWE.md']])await writeFile(path.join(root,file),renderScenarioMarkdown(await loadScenarioCatalog(scope)),'utf8');
}
