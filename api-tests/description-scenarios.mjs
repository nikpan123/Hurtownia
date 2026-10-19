import {readFile} from 'node:fs/promises';

export function descriptionScenarioIds(channel,stage){
  if(stage==='variant')return ['DESC-017'];
  if(stage==='cart')return [{WHOLESALE:'DESC-015',ACADEMY:'DESC-016',RETAIL:'DESC-021'}[channel]].filter(Boolean);
  if(channel==='WHOLESALE')return [stage==='list'?'DESC-011':'DESC-012'];
  return [{RETAIL:'DESC-013',ACADEMY:'DESC-014'}[channel]].filter(Boolean);
}
export async function descriptionScenarioCatalog(){
  return JSON.parse(await readFile(new URL('../docs/product-channel-scenarios.json',import.meta.url),'utf8'));
}
export function descriptionCoverage(tests,catalog){
  return catalog.cases.map(s=>{
    const checks=tests.filter(t=>t.scenarioIds?.includes(s.id));
    const counts=Object.fromEntries(['PASS','FAIL','SKIP'].map(status=>[status,checks.filter(t=>t.status===status).length]));
    return {id:s.id,title:s.title,requirement:s.requirement,automation:s.coverage,counts,checks:checks.map(t=>t.name),note:'Liczby dotyczą powiązanych kontroli tego przebiegu. Nie są pełnym zaliczeniem wymagania ani scenariusza.'};
  });
}
