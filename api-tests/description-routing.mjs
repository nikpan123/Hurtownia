import {readFile} from 'node:fs/promises';
import path from 'node:path';
// Wynik modułu docelowego, a nie samo przekazanie, rozstrzyga kontrolę.
export const descriptionRoutes=[
 {id:'DESC-023',name:'Liczby dostępów aplikacji',module:'retail-cart'},
 {id:'DESC-010',name:'Utworzenie produktu i tłumaczenia w bazie',module:'new-product'},
 {id:'DESC-022',name:'Wygenerowany opis oferty',module:'retail-cart'},
 {id:'DESC-024',name:'Treść PDF zamówienia',module:'documents'},
 {id:'DESC-025',name:'E-mail z potwierdzeniem zamówienia',module:'documents'},
 {id:'DESC-029',name:'Powiadomienie o dostępności',module:'stock'}
];
export function resolveDescriptionRoutes(tests,modules){
 return descriptionRoutes.map(route=>{
  const checks=tests.filter(t=>t.module===route.module&&t.scenarioIds?.includes(route.id));
  const counts=Object.fromEntries(['PASS','FAIL','SKIP'].map(s=>[s,checks.filter(t=>t.status===s).length]));
  const module=modules.find(m=>m.id===route.module);
  const status=counts.FAIL?'FAIL':counts.SKIP?'SKIP':counts.PASS?'PASS':module?.status==='FAIL'?'FAIL':'SKIP';
  return {...route,status,counts,file:module?.file,checks:checks.map(t=>({name:t.name,status:t.status,detail:t.detail})),detail:checks.length?checks.map(t=>t.name+': '+t.status+' — '+(t.detail??'')).join('\n'):module?.reason??'Nie wykonano kontroli w module docelowym.'};
 });
}
export async function readDescriptionEvidence(root,ids,baseUrl){
 const evidence=[];
 for(const id of ids){
  if(!/^[a-zA-Z0-9-]+$/.test(id))throw Error('Nieprawidłowy identyfikator raportu dowodowego.');
  const source=JSON.parse(await readFile(path.join(root,id,'raport.json'),'utf8'));
  if(source.kind!=='descriptions'||source.baseUrl!==baseUrl)throw Error('Raport dowodowy dotyczy innego zakresu lub środowiska.');
  evidence.push({id,file:'../'+id+'/raport.html',date:source.generatedAt,name:source.scenario,status:source.status,scope:source.scopeNote,checks:source.tests.filter(t=>t.scenarioIds?.some(s=>descriptionRoutes.some(r=>r.id===s))).map(t=>({name:t.name,status:t.status,detail:t.detail,scenarioIds:t.scenarioIds}))});
 }
 return evidence;
}
