import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {cookieHeader} from './config.mjs';
import {extractPdfText} from './description-documents.mjs';

const plain=value=>String(value??'').replace(/\s+/g,' ').trim();
export function documentMinor(value){const text=String(value).replace(/\s/g,'');assert(/^\d+,\d{2}$/.test(text),'Nieprawidłowa kwota dokumentu: '+value);const [whole,fraction]=text.split(',');return Number(whole)*100+Number(fraction);}
export function comparePackagePanel(order,panel){
 const checks=[],check=(name,fn)=>{try{fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',detail:e.message});}};
 check('Panel CMS: numer zapisanego zamówienia',()=>assert(panel.heading.includes(String(order.number))));
 check('Panel CMS: kwota dostawy brutto',()=>{
  const text=plain(panel.rows.flat().join(' ')),match=text.match(/Koszt wysyłki:\s*([\d\s]+,\d{2})/i);assert(match,'Brak kwoty dostawy w panelu');assert.equal(documentMinor(match[1]),order.shippingTotal);
 });
 check('Panel CMS: suma zamówienia',()=>{const match=plain(panel.rows.flat().join(' ')).match(/Suma zamówienia:\s*([\d\s]+,\d{2})/i);assert(match,'Brak sumy w panelu');assert.equal(documentMinor(match[1]),order.total);});
 for(const item of order.items)check('Panel CMS: produkt i ilość '+item.product?.code,()=>{
  const rows=panel.rows.filter(row=>plain(row[0]).includes(plain(item.productName)));assert.equal(rows.length,1,'Brak lub duplikat produktu w panelu');assert.equal(Number(rows[0][6]),item.quantity);
 });
 return checks;
}
export function comparePackagePdf(order,text){
 const value=plain(text),checks=[],check=(name,fn)=>{try{fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',detail:e.message});}};
 check('PDF: numer zamówienia',()=>assert(value.includes(String(order.number)),'PDF nie zawiera numeru tego zamówienia'));
 check('PDF: liczba paczek',()=>{const match=value.match(/liczba paczek:\s*(\d+)/i);assert(match,'Brak liczby paczek w PDF');assert.equal(Number(match[1]),order.shipmentPackageQuantity);});
 check('PDF: suma do zapłaty',()=>{const match=value.match(/do zapłaty:\s*([\d\s]+,\d{2})/i);assert(match,'Brak sumy w PDF');assert.equal(documentMinor(match[1]),order.total);});
 check('PDF: koszt dostawy brutto',()=>{
  const match=value.match(/(?:Przesyłka kurierska(?:\s*\(GLS\))?|Koszt (?:wysyłki|dostawy)):\s*([\d\s]+,\d{2})/i);
  assert(match,'Brak kwoty dostawy w PDF');assert.equal(documentMinor(match[1]),order.shippingTotal);
 });
 for(const item of order.items)check('PDF: nazwa produktu '+item.product?.code,()=>assert(value.includes(plain(item.productName)),'Brak nazwy produktu'));
 return checks;
}
export function packageDocumentVerifier(config,credentials,{cms,directory,vars,fetchPdf=fetch,extractText=extractPdfText,onRequest=()=>{}}){
 return async(order,{api,final}={})=>{
  const panel=await cms.savedOrder(order),checks=comparePackagePanel(order,panel);
  await mkdir(directory,{recursive:true});const file='potwierdzenie-'+String(order.number)+'.pdf';
  if(cms.downloadOrderPdf){
    await cms.downloadOrderPdf(order,path.join(directory,file));
    const bytes=await readFile(path.join(directory,file));assert(bytes.length<10*1024*1024&&bytes.subarray(0,5).toString()==='%PDF-','Niepoprawny PDF z CMS');
    const parsed=await extractText(path.join(directory,file),{vars});checks.push(...comparePackagePdf(order,parsed.text));
    return {checks,documents:[{kind:'Potwierdzenie zamówienia '+order.number,file,pages:parsed.pages}]};
  }
  const link=order.pdfSummary??final?.pdfSummary;assert(typeof link==='string','Brak pdfSummary zapisanego zamówienia');
  const url=new URL(link,'https://ksiegarnia.gwodev.pl');assert.equal(url.origin,'https://ksiegarnia.gwodev.pl');assert(/^\/(?:[a-z]{2}\/)?order\/[^/]+\/summary$/.test(url.pathname),'Nieoczekiwany URL PDF');
  const r=await fetchPdf(url,{method:'GET',headers:{Accept:'application/pdf','X-Api-Channel':'WHOLESALE','X-Tests-Token':credentials.testsToken,Authorization:'Bearer '+api.tokens.shop,Cookie:credentials.cookie||cookieHeader(credentials.cookies,url)},redirect:'manual',signal:AbortSignal.timeout(config.timeoutMs??30000)});
  onRequest({method:'GET',endpoint:'/documents/summary',status:r.status});assert.equal(r.status,200);assert((r.headers.get('content-type')??'').includes('application/pdf'),'Odpowiedź nie jest PDF');
  const bytes=Buffer.from(await r.arrayBuffer());assert(bytes.length<10*1024*1024&&bytes.subarray(0,5).toString()==='%PDF-','Niepoprawny PDF');
  await writeFile(path.join(directory,file),bytes);
  const parsed=await extractText(path.join(directory,file),{vars});checks.push(...comparePackagePdf(order,parsed.text));
  return {checks,documents:[{kind:'Potwierdzenie zamówienia '+order.number,file,pages:parsed.pages}]};
 };
}
