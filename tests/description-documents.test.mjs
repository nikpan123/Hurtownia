import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {runDescriptionDocuments,requireNames} from '../api-tests/description-documents.mjs';
const settings=JSON.parse(await readFile(new URL('../config/description-web.example.json',import.meta.url)));
const config={environment:'dev',enabled:true,baseUrl:'https://ksiegarnia.gwodev.pl/api/v2',scenario:{shippingAddress:{company:'QA'},billingAddress:{company:'QA'}}},credentials={email:'qa@example.invalid',password:'secret-password',testsToken:'secret-tests'};
for(const mode of ['ok','wrong-cart','wrong-pdf','wrong-mail','complete-timeout'])test('Dokumenty QA: '+mode,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'description-docs-'));const calls=[];let completed=false,closed=false;
 const expected='Nazwa hurtowa QA',source={name:settings.products[0].name,slug:settings.products[0].slug,channels:{WHOLESALE:{name:expected}}};
 const mail={ID:'new',Created:'2026-10-20T08:01:00Z',To:[{Mailbox:'qa',Domain:'example.invalid'}],Content:{Body:'Szczegóły są w załączniku',MIME:{Parts:[{Headers:{'Content-Type':['application/octet-stream; name=podsumowanie.pdf'],'Content-Transfer-Encoding':['base64']},Body:Buffer.from('%PDF-test').toString('base64')}]}}};
 const adapter={product:async()=>source,mailbox:async()=>({baseline:{count:5,baselineIds:new Set(['old']),notBefore:'2026-10-20T08:00:00Z'},reader:{recentRecipient:async()=>[mail]}}),close:async()=>{closed=true;}};
 const fetchImpl=async(url,options)=>{
  const p=new URL(url).pathname.replace('/api/v2/','');calls.push({p,method:options.method});
  if(p==='shop/authentication-token')return Response.json({token:'jwt-private'});
  if(p==='shop/orders')return Response.json({id:42,tokenValue:'private-cart-token'},{status:201});
  if(p.endsWith('/items/bulk'))return new Response(null,{status:204});
  if(p.endsWith('/payments'))return Response.json([{code:'cash_on_delivery'}]);
  if(p.endsWith('/payment-method'))return Response.json({});
  if(p.startsWith('wholesale/checkout-step-two/')&&options.method==='GET')return Response.json({shippingMethods:[{code:'poczta_polska'}]});
  if(p.startsWith('wholesale/checkout-step-two/')&&options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.shippingAddress.isDefault,false);assert.equal(body.billingAddress.saveToAddressBook,false);return new Response(null,{status:204});}
  if(p.endsWith('/complete')){if(mode==='complete-timeout')throw new Error('timeout');completed=true;return Response.json({});}
  if(p.startsWith('shop/orders/'))return Response.json({id:42,number:completed?'30009999':null,pdfSummary:'https://ksiegarnia.gwodev.pl/order/private-pdf-token/summary',items:[{product:{code:'testhurtA'},productName:mode==='wrong-cart'?'Główna błędna nazwa':expected,quantity:1}]});
  throw new Error('Nieznane żądanie '+p);
 };
 try{const {report}=await runDescriptionDocuments(config,credentials,{settings,adapter,complete:true,fetchImpl,directory,extractPdfText:async file=>({pages:1,text:'30009999 '+((mode==='wrong-pdf'&&!file.includes('mail-candidate'))||(mode==='wrong-mail'&&file.includes('mail-candidate'))?'Główna błędna nazwa':expected)}),fetchPdf:async()=>new Response('%PDF-test',{headers:{'content-type':'application/pdf'}})});
  assert(closed);assert.equal(report.status,mode==='ok'?'INCOMPLETE':'FAIL');assert.equal(calls.filter(c=>c.p.endsWith('/complete')).length,mode==='wrong-cart'?0:1);
  if(mode==='ok'){assert(report.tests.some(t=>t.scenarioIds?.includes('DESC-024')&&t.status==='PASS'));assert(report.tests.some(t=>t.scenarioIds?.includes('DESC-025')&&t.status==='PASS'));assert.equal(report.orderNumber,'30009999');}
  if(mode==='wrong-pdf')assert(report.tests.some(t=>t.name.includes('treści PDF')&&t.status==='FAIL'));
  if(mode==='wrong-mail')assert(report.tests.some(t=>t.name.includes('załączniku nowego e-maila')&&t.status==='FAIL'));
  const json=await readFile(path.join(directory,'raport.json'),'utf8');for(const secret of ['secret-password','secret-tests','jwt-private','private-cart-token','private-pdf-token'])assert(!json.includes(secret));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('PDF: zawartość musi zawierać właściwą nazwę, sam plik nie wystarczy',()=>{assert.throws(()=>requireNames('Inny tekst',['Nazwa kanałowa'],'PDF'),/brak oczekiwanej nazwy/);requireNames('Nazwa\n  kanałowa',['Nazwa kanałowa'],'PDF');});
