import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {loadScenarioCatalog,renderScenarioMarkdown} from '../dashboard/scenario-catalog.mjs';
import {createDashboardServer} from '../dashboard/server.mjs';
import vm from 'node:vm';

test('Katalog ma unikalne, kompletne przypadki i istniejące źródła automatyzacji',async()=>{
  const c=await loadScenarioCatalog();assert.equal(c.cases.length,73);assert.equal(new Set(c.cases.map(s=>s.id)).size,c.cases.length);
  for(const s of c.cases){
    assert(c.categories.some(v=>v.id===s.category),s.id);assert(c.coverageLabels[s.coverage],s.id);assert(c.effectLabels[s.effect],s.id);assert(c.priorities[s.priority],s.id);
    for(const field of ['conditions','steps','expected'])assert(s[field].length>0&&s[field].every(v=>typeof v==='string'&&v.trim()),s.id+' '+field);
    assert(s.data&&s.automation.runner,s.id);
    for(const action of s.automation.actions){assert(c.actions[action],s.id+' nieznana akcja');assert(c.actions[action].note,s.id);}
    if(s.coverage==='planned')assert.equal(s.automation.actions.length,0,s.id);
    for(const source of s.automation.sources)await access(new URL('../'+source,import.meta.url));
  }
  const md=renderScenarioMarkdown(c);for(const s of c.cases)assert(md.includes('### '+s.id+' — '+s.title));
  assert.equal(await readFile(new URL('../SCENARIUSZE-TESTOWE.md',import.meta.url),'utf8'),md,'Eksport Markdown musi być aktualny');
  assert.equal((await loadScenarioCatalog('cart')).cases.length,44);assert.equal((await loadScenarioCatalog('descriptions')).cases.length,29);
  assert.equal(await readFile(new URL('../SCENARIUSZE-OPISOW-KANALOWYCH.md',import.meta.url),'utf8'),renderScenarioMarkdown(await loadScenarioCatalog('descriptions')));
});

test('Przyciski scenariuszy pokazują zakres, blokują start w trakcie testu i kierują do ustawień',async()=>{
  const c=await loadScenarioCatalog();const nodes=new Map();let view,scrolled=false,reset=false;const details={open:false};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(type,fn){this.listener=fn;}});return nodes.get(id);};
  nodes.set('package-profile',{closest:()=>details,scrollIntoView:()=>{scrolled=true;}});
  nodes.set('suite-reset',{click:()=>{reset=true;}});
  const context=vm.createContext({$:node,URLSearchParams,location:{search:'?scenario=DESC-012'},esc:s=>String(s??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),state:{jobs:[]},customAccountSaving:false,setView:v=>{view=v;}});
  vm.runInContext(await readFile(new URL('../dashboard/public/scenarios.js',import.meta.url),'utf8'),context);
  context.catalog=c;vm.runInContext('scenarioCatalog=catalog',context);
  const render=id=>{context.example=c.cases.find(s=>s.id===id);return vm.runInContext('scenarioActions(example)',context);};
  assert(render('CART-007').includes('data-suite="regression"'));assert(render('ORD-002').includes('data-suite="regression-order"'));assert(render('ORD-002').includes('Może zapisać zamówienia'));
  assert(render('AUTH-002').includes('data-suite="regression"'));assert(render('AUTH-003').includes('data-suite="regression"'));assert(render('ISO-006').includes('data-suite="regression-order"'));
  assert(render('DB-001').includes('data-scenario-view="reports"'));assert(!render('PACK-005').includes('data-suite="packages-profile"'));
  assert(render('DESC-012').includes('data-suite="descriptions"'));assert(render('DESC-001').includes('data-suite="descriptions-cms"'));assert.equal(vm.runInContext('selectedScenario',context),'DESC-012');
  context.state.jobs=[{status:'RUNNING'}];assert(render('CART-007').includes('disabled'));
  nodes.get('scenario-detail').listener({target:{closest:()=>({dataset:{scenarioView:'start',scenarioTarget:'package-profile'}})}});
  assert.equal(view,'start');assert(details.open);assert(scrolled);assert(reset,'Filtr biblioteki nie może ukrywać formularza paczek');
  assert(render('DESC-002').includes('data-suite="descriptions-web"'));assert(render('DESC-020').includes('data-suite="descriptions-web"'));
  assert(render('DESC-024').includes('data-suite="descriptions-documents"'));assert(render('DESC-025').includes('data-suite="descriptions-documents"'));
  const allowed=new Set(['cart','regression','regression-order','order','packages','rounding','redmine-36926','descriptions','descriptions-cms','descriptions-web','descriptions-documents','descriptions-new-product','descriptions-retail-cart','descriptions-retail-summary','descriptions-retail-documents','descriptions-stock']);
  for(const action of Object.values(c.actions))if(action.suite)assert(allowed.has(action.suite));
});

test('Panel udostępnia katalog i dokument do pobrania bez uruchamiania testów',async()=>{
  const server=createDashboardServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    const result=await fetch(base+'/api/scenarios');assert.equal(result.status,200);assert.equal((await result.json()).cases.length,73);
    const md=await fetch(base+'/SCENARIUSZE-KOSZYKA-HURTOWEGO.md');assert(md.headers.get('content-disposition').includes('attachment'));assert((await md.text()).includes('ISO-006'));
    const descriptions=await (await fetch(base+'/SCENARIUSZE-OPISOW-KANALOWYCH.md')).text();assert(descriptions.includes('DESC-029'));assert(!descriptions.includes('### CART-'));
    assert.equal((await fetch(base+'/scenarios.js')).status,200);assert.equal((await fetch(base+'/.env')).status,404);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
