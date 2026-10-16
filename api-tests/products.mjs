import { readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';

function randomFor(seed) {
  let state=createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    state=(state+0x6D2B79F5)>>>0;
    let t=Math.imul(state^(state>>>15),1|state);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
export function selectProducts(settings, catalog, seedOverride) {
  const groups=['adamada','pozostale'];
  if (!Array.isArray(catalog)||!catalog.length) throw new Error('Pula produktów do losowania jest pusta.');
  const seen=new Set();
  for (const p of catalog) {
    if (typeof p.productVariant!=='string'||!p.productVariant.trim()||!groups.includes(p.group)||seen.has(p.productVariant)) throw new Error('Katalog wymaga unikalnych kodów i grup: adamada / pozostale.');
    seen.add(p.productVariant);
  }
  const bounds=(range,label)=>{
    if (!Array.isArray(range)||range.length!==2||!range.every(Number.isSafeInteger)||range[0]<1||range[1]<range[0]) throw new Error('Nieprawidłowy zakres: '+label);
    return range;
  };
  const [min,max]=bounds(settings.productCount??[1,5],'productCount');
  const [qmin,qmax]=bounds(settings.quantity??[1,10],'quantity');
  const [emin,emax]=bounds(settings.editedQuantity??[1,10],'editedQuantity');
  const mode=settings.group??'random';
  if (![...groups,'random'].includes(mode)) throw new Error('Grupa losowania: random, adamada lub pozostale.');
  const seed=String(seedOverride??settings.seed??randomBytes(12).toString('hex'));
  const random=randomFor(seed);
  const integer=(a,b)=>a+Math.floor(random()*(b-a+1));
  const available=catalog.filter(p=>p.enabled!==false);
  const eligible=groups.filter(g=>available.some(p=>p.group===g));
  if (!eligible.length) throw new Error('Brak włączonych produktów do losowania.');
  const group=mode==='random'?eligible[integer(0,eligible.length-1)]:mode;
  const pool=available.filter(p=>p.group===group).map(p=>({...p}));
  if (pool.length<min) throw new Error('Za mało produktów w grupie '+group+' dla minimalnej liczby pozycji.');
  for(let i=pool.length-1;i>0;i--){const j=integer(0,i);[pool[i],pool[j]]=[pool[j],pool[i]];}
  const products=pool.slice(0,integer(min,Math.min(max,pool.length))).map(p=>({
    productVariant:p.productVariant, group, quantity:integer(qmin,qmax),
    ...(p.merchandiseCode?{merchandiseCode:p.merchandiseCode}:{}),
    ...(settings.editQuantities===false?{}:{newQuantity:integer(emin,emax)})
  }));
  return {products,selection:{source:'random',algorithm:'sha256-mulberry32-v1',seed,group,catalog:catalog.map(p=>({...p})),settings:{...settings,seed}}};
}

export async function prepareProducts(config) {
  const settings=config.scenario?.randomProducts;
  if (!settings?.enabled) return config;
  const copy=structuredClone(config);
  const document=JSON.parse((await readFile(settings.catalogFile??'config/products.json','utf8')).replace(/^\uFEFF/,''));
  const {products,selection}=selectProducts(settings,document.products);
  copy.scenario.products=products;
  copy.scenario.productSelection=selection;
  return copy;
}
