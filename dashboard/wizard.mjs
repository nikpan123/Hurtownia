import {randomUUID} from 'node:crypto';

export function availableProducts(catalog,rows) {
  return catalog.filter(p=>p.enabled!==false).flatMap(p=>{
    const dto=rows.find(d=>d.code===p.productVariant||d.code===p.merchandiseCode);
    return dto?.availableForSale===true&&dto.outOfStock===false?[{...p,name:dto.name,price:dto.price,originalPrice:dto.originalPrice}]:[];
  });
}

// Jeden wybór na etap; identyfikator zapobiega ponownemu użyciu starego kliknięcia.
export class ChoiceGate {
  constructor(job,signal){this.job=job;this.signal=signal;}
  wait(phase,payload) {
    this.signal.throwIfAborted();
    if(this.pending)throw new Error('Poprzedni etap nadal czeka na wybór.');
    const requestId=randomUUID();
    this.job.wizard={phase,requestId,...payload};
    return new Promise((resolve,reject)=>{
      const abort=()=>{this.pending=null;this.job.wizard=null;reject(new Error('Przebieg zatrzymany przez użytkownika.'));};
      this.signal.addEventListener('abort',abort,{once:true});
      this.pending={requestId,phase,payload,resolve:value=>{this.signal.removeEventListener('abort',abort);this.pending=null;this.job.wizard={phase:'working'};resolve(value);}};
    });
  }
  submit(requestId,value) {
    const p=this.pending;
    if(!p||p.requestId!==requestId)throw new Error('Ten etap nie jest już aktywny.');
    if(p.phase==='review'?value!=='complete':!p.payload.options.some(o=>o.code===value))throw new Error('Wybierz dostępną opcję bieżącego etapu.');
    p.resolve(value);
  }
}

export function validateSelection(items,catalog) {
  if(!Array.isArray(items)||!items.length||items.length>5)throw new Error('Wybierz od 1 do 5 produktów.');
  const used=new Set();
  const selected=items.map(item=>{
    const p=catalog.find(p=>p.productVariant===item.productVariant);
    if(!p||used.has(p.productVariant)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10)throw new Error('Produkt niedostępny, powtórzony lub ilość poza zakresem 1–10.');
    used.add(p.productVariant);return {productVariant:p.productVariant,group:p.group,quantity:item.quantity};
  });
  if(new Set(selected.map(p=>p.group)).size!==1)throw new Error('Nie można łączyć Adamady z pozostałymi produktami.');
  return selected;
}
