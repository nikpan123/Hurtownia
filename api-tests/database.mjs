import {installBrowserPresentation} from './browser-presentation.mjs';
import {browserLaunchOptions} from './browser-options.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export function databaseQueries(orderId){
  assert(Number.isSafeInteger(orderId)&&orderId>0,'Nieprawidłowy identyfikator zamówienia');
  const order=`SELECT id,number,state,items_total,total,currency_code FROM bookshop2.sylius_order WHERE id=${orderId}`;
  const encodedName="REPLACE(TO_BASE64(i.product_name),CHAR(10),'')";
  const items=`SELECT i.id,i.order_id,v.code,i.quantity,i.unit_price,i.original_unit_price,i.total,CHAR_LENGTH(i.product_name) AS product_name_length,${Array.from({length:36},(_,i)=>`SUBSTRING(${encodedName},${i*40+1},40) AS pn${i}`).join(',')} FROM bookshop2.sylius_order_item i JOIN bookshop2.sylius_product_variant v ON v.id=i.variant_id WHERE i.order_id=${orderId} ORDER BY i.id`;
  const shipment=`SELECT s.order_id,m.code,s.adjustments_total,LENGTH(s.shipment_package_details) AS details_length,${Array.from({length:10},(_,i)=>`SUBSTRING(s.shipment_package_details,${i*40+1},40) AS part${i}`).join(',')} FROM bookshop2.sylius_shipment s JOIN bookshop2.sylius_shipping_method m ON m.id=s.method_id WHERE s.order_id=${orderId}`;
  const transfer=`SELECT t.nOrderID,t.nIsWholesale,t.cCurrencyCode,t.dPrice FROM gwo_transfer.orders t JOIN bookshop2.sylius_order o ON CAST(o.number AS UNSIGNED)=t.nOrderID WHERE o.id=${orderId}`;
  const transferItems=`SELECT t.nOrderID,t.nID,t.vcIDT,t.nAmount,t.dPrice,t.dPriceNetto,t.dRebatePercent,t.dPriceWithRebate,t.dPriceNettoWithRebate,t.dVATPercent FROM gwo_transfer.orders_items t JOIN bookshop2.sylius_order o ON CAST(o.number AS UNSIGNED)=t.nOrderID WHERE o.id=${orderId} ORDER BY t.nID`;
  const payments=`SELECT p.order_id,m.code,p.amount,p.currency_code FROM bookshop2.sylius_payment p JOIN bookshop2.sylius_payment_method m ON m.id=p.method_id WHERE p.order_id=${orderId}`;
  const adjustments=`SELECT type,amount FROM bookshop2.sylius_adjustment WHERE order_id=${orderId} AND type IN ('shipping','payment')`;
  return {order,items,shipment,payments,adjustments,transfer,transferItems};
}
// PLN DECIMAL(9,3) -> tysięczne złotego, bez utraty trzeciego miejsca.
export function decimalMilli(value){
  assert(typeof value==='string'&&/^\d+(?:\.\d{1,3})?$/.test(value),'Nieprawidłowa kwota DECIMAL: '+value);const [whole,fraction='']=value.split('.');return Number(whole)*1000+Number(fraction.padEnd(3,'0'));
}
export function decodeDatabaseNames(rows){
  return rows.map(row=>{
    const encoded=Array.from({length:36},(_,i)=>row['pn'+i]??'').join('');
    assert(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded),'Odczyt nazwy produktu jest skrócony lub niepoprawny');
    const product_name=Buffer.from(encoded,'base64').toString('utf8');assert.equal(Array.from(product_name).length,Number(row.product_name_length),'Nie odczytano pełnej nazwy produktu z bazy');
    return {...Object.fromEntries(Object.entries(row).filter(([key])=>!/^pn\d+$/.test(key)&&key!=='product_name_length')),product_name};
  });
}
export function compareDatabase(order,db,products=[]){
  const checks=[];let packageDetails;const add=(name,expected,actual)=>checks.push({name,status:String(expected)===String(actual)?'PASS':'FAIL',detail:`Wzorzec / API: ${expected}; baza: ${actual}`});
  add('Jeden rekord zamówienia Sylius',1,db.order.length);add('Jeden rekord w transferze',1,db.transfer.length);
  if(db.order.length===1){const o=db.order[0];add('Identyfikator Sylius',order.id,o.id);add('Brutto zamówienia (grosze)',order.total,o.total);add('Brutto produktów (grosze)',order.itemsTotal,o.items_total);add('Waluta Sylius',order.currencyCode,o.currency_code);checks.push({name:'Stan zamówienia w bazie',status:o.state==='cart'?'FAIL':'PASS',detail:o.state});if(order.number!==undefined)add('Numer zamówienia',order.number,o.number);if(db.transfer.length===1){const t=db.transfer[0];add('Numer transferu zgodny z numerem Sylius',Number(o.number),t.nOrderID);add('Flaga hurtowni',1,t.nIsWholesale);add('Waluta transferu',order.currencyCode,t.cCurrencyCode);add('Brutto transferu (tysięczne PLN)',order.total*10,decimalMilli(t.dPrice));}}
  add('Liczba pozycji Sylius',order.items.length,db.items.length);
  add('Jedna płatność Sylius',1,db.payments?.length??0);if(db.payments?.length===1){const p=db.payments[0];add('Kwota płatności w bazie',order.total,p.amount);add('Waluta płatności',order.currencyCode,p.currency_code);if(order.paymentCode?.includes('[ukryto]'))checks.push({name:'Kod płatności w bazie',status:'SKIP',detail:'Historyczny raport ma zmaskowany fragment kodu płatności; wymagany nowy raport API.'});else add('Kod płatności w bazie',order.paymentCode,p.code);}
  for(const i of order.items){const found=db.items.filter(d=>d.code===i.code);add('Jedna pozycja Sylius '+i.code,1,found.length);if(found.length===1){const d=found[0];for(const [apiKey,dbKey]of Object.entries({quantity:'quantity',unitPrice:'unit_price',originalUnitPrice:'original_unit_price',total:'total',productName:'product_name'}))if(i[apiKey]!==undefined)add(i.code+': '+apiKey,i[apiKey],d[dbKey]);}
    const merchandise=products.find(p=>p.productVariant===i.code)?.merchandiseCode??i.code;const rows=db.transferItems.filter(d=>d.vcIDT===merchandise);add('Obecność produktu w transferze '+merchandise,true,rows.length>0);
    if(rows.length){
      const validAmounts=rows.every(d=>Number.isSafeInteger(Number(d.nAmount))&&Number(d.nAmount)>0);add(merchandise+': poprawne ilości rekordów',true,validAmounts);
      add(merchandise+': ilość w transferze',i.quantity,rows.reduce((sum,d)=>sum+Number(d.nAmount),0));
      for(const [index,d]of rows.entries()){
        const label=merchandise+(rows.length>1?' / rekord '+(index+1):'');add(label+': rabat w transferze',i.rebatePercent,Number(d.dRebatePercent));
        for(const [apiKey,dbKey]of Object.entries({unitPrice:'dPrice',unitPriceNet:'dPriceNetto',discountedUnitPrice:'dPriceWithRebate',discountedUnitPriceNet:'dPriceNettoWithRebate'}))if(i[apiKey]!==undefined)add(label+': '+dbKey,i[apiKey]*10,decimalMilli(d[dbKey]));
      }
      if(i.total!==undefined)add(merchandise+': suma brutto w transferze (tysięczne PLN)',i.total*10,rows.reduce((sum,d)=>sum+decimalMilli(d.dPriceWithRebate)*Number(d.nAmount),0));
      if(i.totalNetSalesAfterDiscount!==undefined)add(merchandise+': suma netto w transferze (tysięczne PLN)',i.totalNetSalesAfterDiscount*10,rows.reduce((sum,d)=>sum+decimalMilli(d.dPriceNettoWithRebate)*Number(d.nAmount),0));
    }}
  const allowedCodes=new Set(order.items.map(i=>products.find(p=>p.productVariant===i.code)?.merchandiseCode??i.code));allowedCodes.add('KWys');add('Brak nieoczekiwanych produktów w transferze',0,db.transferItems.filter(i=>!allowedCodes.has(i.vcIDT)).length);
  add('Jedna przesyłka Sylius',1,db.shipment.length);
  if(db.shipment.length===1){const s=db.shipment[0];add('Metoda dostawy w bazie',order.shippingCode,s.code);const length=Number(s.details_length??0);if(length>400)checks.push({name:'Pełne szczegóły paczek',status:'FAIL',detail:'JSON dłuższy niż limit odczytu 400 znaków'});else{const text=Array.from({length:10},(_,i)=>s['part'+i]==='NULL'?'':s['part'+i]??'').join('');if(text&&text!=='null'){try{const details=JSON.parse(text);packageDetails=details;checks.push({name:'shipment_package_details: zapis JSON',status:'PASS',detail:JSON.stringify(details)});add('shipment_package_details: kod dostawy',order.shippingCode,details.shippingMethodCode);add('shipment_package_details: liczba paczek',order.shipmentPackageQuantity??0,details.packageQuantity);checks.push({name:'shipment_package_details: cena jednostkowa i netto/brutto',status:Number.isSafeInteger(details.singlePackagePrice)&&details.singlePackagePrice>=0&&typeof details.priceIsNet==='boolean'?'PASS':'FAIL',detail:JSON.stringify({singlePackagePrice:details.singlePackagePrice,priceIsNet:details.priceIsNet})});}catch{checks.push({name:'shipment_package_details: zapis JSON',status:'FAIL',detail:'Nieprawidłowy lub skrócony JSON'});}}else checks.push({name:'shipment_package_details: zawartość',status:order.shipmentPackageQuantity>0?'FAIL':'SKIP',detail:'Brak szczegółów paczek w bazie'});}}
  const shipping=db.transferItems.filter(i=>i.vcIDT==='KWys');
  const fee=(db.adjustments??[]).filter(a=>a.type==='payment').reduce((s,a)=>s+Number(a.amount),0);
  if(db.shipment.length===1)add('API koszt dostawy = przesyłka + opłata płatności',order.shippingTotal,Number(db.shipment[0].adjustments_total)+fee);
  if(order.shippingTotal-fee>0){add('Jedna pozycja KWys',1,shipping.length);if(shipping.length===1){const s=shipping[0];if(order.shipmentPackageQuantity>0)add('KWys: liczba paczek',order.shipmentPackageQuantity,s.nAmount);add('KWys: brutto samych paczek bez opłaty płatności',(order.shippingTotal-fee)*10,decimalMilli(s.dPriceWithRebate)*Number(s.nAmount));const vat=order.shippingTaxRate;if(order.shippingTotalNet!==undefined&&(fee===0||typeof vat==='number'&&vat>=0&&vat<=1)){const feeNet=fee===0?0:Math.round(fee/(1+vat));add('KWys: netto dostawy bez opłaty płatności',(order.shippingTotalNet-feeNet)*10,decimalMilli(s.dPriceNettoWithRebate)*Number(s.nAmount));}if(packageDetails){add('Cena paczki JSON zgodna z KWys',packageDetails.singlePackagePrice*10,decimalMilli(packageDetails.priceIsNet?s.dPriceNettoWithRebate:s.dPriceWithRebate));}}}
  else add('Brak kosztu KWys przy bezpłatnej dostawie',0,shipping.reduce((s,i)=>s+decimalMilli(i.dPriceWithRebate)*Number(i.nAmount),0));
  return checks;
}
export async function readDatabase(orderId,{sessionFile='.auth/dev.json',vars=process.env,signal}={}){
  const queries=databaseQueries(orderId);const {chromium}=await import('playwright');const browser=await chromium.launch(browserLaunchOptions(vars));
  try{
    const context=await browser.newContext({storageState:JSON.parse(await readFile(sessionFile,'utf8'))});const presentation=await installBrowserPresentation(context,{vars});const page=await context.newPage();page.setDefaultTimeout(30000);const result={};
    // Pierwsze wejście inicjalizuje sesję phpMyAdmin i może odrzucić trasę /table/sql.
    await page.goto('https://phpmyadmin.gwodev.pl/',{waitUntil:'domcontentloaded'});
    assert.equal(new URL(page.url()).hostname,'phpmyadmin.gwodev.pl','Odśwież sesję GitLab do phpMyAdmin');
    for(const [key,sql]of Object.entries(queries)){
      signal?.throwIfAborted();await page.goto('https://phpmyadmin.gwodev.pl/index.php?route=/table/sql&db=gwo_transfer&table=orders_items');
      if(new URL(page.url()).hostname!=='phpmyadmin.gwodev.pl')throw new Error('Odśwież sesję GitLab do phpMyAdmin');
      const editor=page.locator('#sqlquery + .CodeMirror textarea');await presentation.inspect(page,page.locator('.CodeMirror'),'Kontrola bazy: '+key+' — SELECT');await editor.press('ControlOrMeta+A');await editor.fill(sql);await editor.press('Tab');await presentation.step(page,'Zapytanie wpisane — wykonuję odczyt '+key);
      await page.getByRole('button',{name:'Wykonaj',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('table.table_results')||document.querySelector('#page_content .alert-success')||document.querySelector('#page_content .alert-danger'));
      const parsed=await page.evaluate(()=>{const error=document.querySelector('#page_content .alert-danger');if(error)return {error:error.textContent};const table=document.querySelector('table.table_results');if(!table)return {rows:[]};const headers=Array.from(table.querySelectorAll('thead th[data-column]')).map(e=>e.getAttribute('data-column'));const rows=Array.from(table.querySelectorAll('tbody tr')).map(r=>Object.fromEntries(Array.from(r.querySelectorAll('td.data')).map((c,i)=>[headers[i],c.textContent.trim()])));return {rows};});
      await presentation.inspect(page,page.locator('table.table_results'),'Porównuję wynik odczytu '+key);if(parsed.error)throw new Error('Błąd odczytu bazy: '+parsed.error.slice(0,1000));result[key]=key==='items'?decodeDatabaseNames(parsed.rows):parsed.rows;
    }
    return result;
  }finally{await browser.close();}
}
export function databaseVerifier(settings={}){
  return async(order,products)=>{
    let db;for(let attempt=0;attempt<3;attempt++){db=await readDatabase(order.id,settings);if(db.transfer.length&&db.transferItems.length)break;if(attempt<2)await new Promise(r=>setTimeout(r,2000));}
    return {checks:compareDatabase(order,db,products),snapshot:db};
  };
}
export async function verifySavedReport(report,options){
  assert.equal(new URL(report.baseUrl).hostname,'ksiegarnia.gwodev.pl','Porównanie obsługuje wyłącznie raporty dev ksiegarnia.gwodev.pl');
  const order=report.snapshots?.at(-1)?.order;assert(order?.id&&report.finalization==='potwierdzona przez API','Wybierz raport zamówienia z potwierdzoną finalizacją');
  const catalog=JSON.parse(await readFile('config/products.json','utf8')).products;
  const products=(report.products??[]).map(p=>({...catalog.find(c=>c.productVariant===p.productVariant),...p}));
  const {checks,snapshot}=await databaseVerifier(options)(order,products);
  return {scenario:'Porównanie zamówienia z bazami',kind:'database',generatedAt:new Date().toISOString(),baseUrl:report.baseUrl,status:checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='SKIP')?'INCOMPLETE':'PASS',scopeNote:'SELECT dla jednego zamówienia w bookshop2 i gwo_transfer. Bez danych osobowych klientów i bez zmian rekordów.',tests:checks,requests:[],tables:[{title:'Odczyt bazy',headers:['Tabela','Dane'],rows:Object.entries(snapshot).map(([k,v])=>[k,JSON.stringify(v)])}],reference:{orderId:order.id,orderNumber:snapshot.order[0]?.number}};
}
