import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {descriptionContext} from './features.mjs';
import {connectDescriptionWeb,validateWebFixtures} from './description-web.mjs';
import {cookieHeader} from './config.mjs';
import {waitForOrderMailPdf} from './mail-pdf.mjs';

const exec=promisify(execFile),plain=s=>String(s).replace(/\s+/g,' ').trim();
export async function extractPdfText(file,{vars=process.env,signal}={}){
 const python=vars.HURT_PDF_PYTHON??path.join(process.env.USERPROFILE??'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
 const {stdout}=await exec(python,[fileURLToPath(new URL('./pdf-text.py',import.meta.url)),file],{timeout:30000,maxBuffer:5*1024*1024,signal});const result=JSON.parse(stdout);assert(result.pages>0&&typeof result.text==='string','Nie odczytano tekstu PDF');return result;
}
export function requireNames(text,names,where){for(const name of names)assert(plain(text).includes(plain(name)),where+': brak oczekiwanej nazwy „'+name+'”');}
export async function runDescriptionDocuments(config,credentials,options={}){
 const settings=options.settings??JSON.parse(await readFile('config/description-web.local.json','utf8'));validateWebFixtures(settings);
 const c=await descriptionContext(config,credentials,options,'Opisy kanałowe — zapis WHOLESALE, treść PDF i nowego e-maila','descriptions');const {api,report,test,skip,request,cart}=c;
 report.scopeNote='Tworzy jedno zamówienie QA WHOLESALE z produktem testhurtA (1 szt.), wybiera dostępną płatność i dostawę, zapisuje adresy z flagami false i wysyła complete najwyżej raz. Może uruchomić e-mail do skonfigurowanego konta. Porównuje nazwę z bieżącym niezależnym CMS, tekst potwierdzenia PDF i wyłącznie nową wiadomość tego zamówienia w MailHogu. Nie testuje faktury, RETAIL, ACADEMY ani powiadomień o dostępności.';
 let adapter,mailbox,expectedName,root,saved,ready=false;
 const product=settings.products.find(p=>p.id===10202&&p.code==='testhurtA');assert(product,'Brak dedykowanej fixture testhurtA');
 if(options.complete!==true){skip('Zapis QA i dokumenty','Uruchom jawnie wariant zapisujący zamówienie (--complete).',['DESC-024','DESC-025'],'out_of_scope');return c.finish();}
 try{
  assert.equal(config.environment,'dev','Ten zestaw zapisuje wyłącznie na DEV');assert.equal(new URL(config.baseUrl).origin,'https://ksiegarnia.gwodev.pl','Odmowa zapisu poza wskazanym DEV');
  adapter=options.adapter??await connectDescriptionWeb({...options,mailRecipient:credentials.email,onRequest:r=>report.requests.push(r)});
  ready=await test('Przygotowanie: wzorzec CMS i migawka wiadomości przed operacją',async()=>{
   const source=await adapter.product(product);assert.equal(source.name,product.name);assert.equal(source.slug,product.slug);expectedName=source.channels?.WHOLESALE?.name||source.name;assert(expectedName,'Brak wzorca nazwy');
   report.reference={productId:product.id,code:product.code,mainName:source.name,wholesaleName:source.channels?.WHOLESALE?.name??'',expectedName,quantity:1,channel:'WHOLESALE',source:'Główne i kanałowe pola formularza CMS odczytane przed nowym zamówieniem'};
   mailbox=await adapter.mailbox(credentials.email);report.mailBaseline={count:mailbox.baseline.count,notBefore:mailbox.baseline.notBefore};await api.loginShop();return 'Odczytano niezależny wzorzec i ID istniejących wiadomości odbiorcy. Żadna z nich nie może zaliczyć nowej próby.';
  });
  if(ready)ready=await test('DESC-015: nazwa WHOLESALE przed zapisem zamówienia',async()=>{
   const created=await cart('WHOLESALE',product.code,1);root=created.endpoint;report.cartId=created.id;
   const payments=await request('GET','wholesale/orders/'+encodeURIComponent(created.token)+'/payments');assert(Array.isArray(payments)&&payments.length,'Brak płatności');const payment=payments.find(p=>p.code==='cash_on_delivery')??payments[0];
   await request('PATCH','wholesale/orders/'+encodeURIComponent(created.token)+'/payment-method',{body:{paymentMethodCode:payment.code}},[200,204]);
   const stepEndpoint='wholesale/checkout-step-two/'+encodeURIComponent(created.token),step=await request('GET',stepEndpoint);assert(Array.isArray(step.shippingMethods)&&step.shippingMethods.length,'Brak dostaw');const shipping=step.shippingMethods.find(s=>s.code==='poczta_polska')??step.shippingMethods[0];
   const payload={shippingMethodCode:shipping.code,shippingAddress:structuredClone(config.scenario.shippingAddress),billingAddress:structuredClone(config.scenario.billingAddress)};
   for(const key of ['shippingAddress','billingAddress']){assert(payload[key],'Brak adresu QA');payload[key].saveToAddressBook=false;payload[key].isDefault=false;}
   await request('POST',stepEndpoint,{body:payload},[204]);const order=await request('GET',root);assert.equal(order.items?.length,1);assert.equal(order.items[0].product?.code,product.code);assert.equal(order.items[0].quantity,1);assert.equal(order.items[0].productName,expectedName,'Nazwa koszyka nie odpowiada WHOLESALE CMS');
   const current=await adapter.product(product);assert.equal(current.channels?.WHOLESALE?.name||current.name,expectedName,'Wzorzec CMS zmienił się podczas próby; nie zapisujemy');return 'Nazwa koszyka odpowiada tłumaczeniu WHOLESALE lub fallbackowi. Zapis zablokowany w razie niezgodności.';
  },['DESC-015']);
  if(ready)ready=await test('Zapis zamówienia QA — complete wysłane jeden raz',async()=>{
   report.completionAttempted=true;report.finalization='nieustalona — wysłano complete; nie ponawiać';await request('PATCH',root+'/complete',{body:{}},[200,201,204]);saved=await request('GET',root);report.orderId=saved.id;report.orderNumber=saved.number;assert(saved.number&&String(saved.number).length>=4,'Brak numeru zapisanego zamówienia');assert.equal(saved.items?.[0]?.productName,expectedName,'Zapis zmienił nazwę produktu');
   report.finalization='potwierdzona przez API';report.orderId=saved.id;report.orderNumber=saved.number;report.tables.push({title:'Wzorzec i zapis zamówienia QA',headers:['Kod','Nazwa z CMS WHOLESALE / fallback','Nazwa po complete','Numer zamówienia'],rows:[[product.code,expectedName,saved.items[0].productName,saved.number]]});return 'Zapisane QA #'+saved.number+'. Nie ponawiamy complete po błędzie lub timeout.';
  },['DESC-015']);
  if(ready){
   await test('DESC-024: nazwa produktu w treści PDF WHOLESALE',async()=>{
    assert(typeof saved.pdfSummary==='string','Brak linku do potwierdzenia PDF');const url=new URL(saved.pdfSummary,'https://ksiegarnia.gwodev.pl');assert.equal(url.origin,'https://ksiegarnia.gwodev.pl','PDF wskazuje obcy host');assert(/^\/(?:[a-z]{2}\/)?order\/[^/]+\/summary$/.test(url.pathname),'Nieoczekiwany URL potwierdzenia PDF');
    const response=await(options.fetchPdf??fetch)(url,{method:'GET',headers:{Accept:'application/pdf','X-Api-Channel':'WHOLESALE','X-Tests-Token':credentials.testsToken,Authorization:'Bearer '+api.tokens.shop,Cookie:credentials.cookie||cookieHeader(credentials.cookies,url)},redirect:'manual',signal:options.signal});report.requests.push({method:'GET',endpoint:'/documents/summary',status:response.status});assert.equal(response.status,200);assert((response.headers.get('content-type')??'').includes('application/pdf'),'Odpowiedź nie jest PDF');const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.length<10*1024*1024,'PDF przekracza 10 MB');
    await mkdir(c.directory,{recursive:true});const file=path.join(c.directory,'potwierdzenie.pdf');await writeFile(file,bytes);const extracted=await(options.extractPdfText??extractPdfText)(file,{vars:options.vars,signal:options.signal});requireNames(extracted.text,[expectedName],'PDF');assert(plain(extracted.text).includes(String(saved.number)),'PDF nie zawiera numeru tego zamówienia');report.documents=[{kind:'potwierdzenie WHOLESALE',file:'potwierdzenie.pdf',pages:extracted.pages,nameConfirmed:true}];return 'Tekst PDF ('+extracted.pages+' str.) zawiera właściwy numer zamówienia i nazwę „'+expectedName+'”. To potwierdzenie zamówienia, nie faktura.';
   },['DESC-024']);
   await test('DESC-025: nazwa produktu w załączniku nowego e-maila tego zamówienia',async()=>{
    const found=await waitForOrderMailPdf({reader:mailbox.reader,recipient:credentials.email,...mailbox.baseline,orderNumber:saved.number,expectedName,directory:c.directory,extractPdfText:file=>(options.extractPdfText??extractPdfText)(file,{vars:options.vars,signal:options.signal}),timeoutMs:options.mailTimeoutMs??60000,signal:options.signal,onProgress:options.onProgress});const {text,...evidence}=found;
    report.mailEvidence={...evidence,excludesPreexistingIds:true,nameConfirmed:plain(text).includes(plain(expectedName))};report.documents??=[];report.documents.push({kind:'Podsumowanie załączone do nowego e-maila',file:found.file,pages:found.pages});
    report.tables.push({title:'Dowód nowego e-maila i jego załącznika',headers:['ID wiadomości','Utworzono','Numer z załączonego PDF','Oczekiwana nazwa'],rows:[[found.messageId,found.created,saved.number,expectedName]]});requireNames(text,[expectedName],'PDF załączony do nowego e-maila');return 'Nowa wiadomość: dokładny odbiorca, ID nieobecne przed próbą i czas po jej rozpoczęciu. Numer oraz nazwę WHOLESALE potwierdzono w podsumowanie.pdf. Body tego szablonu jest informacyjne; nie wymagamy w nim numeru ani nazwy produktu.';
   },['DESC-025']);
  }else for(const id of ['DESC-024','DESC-025'])skip(id+': dokument / wiadomość','Nie osiągnięto potwierdzonego nowego zamówienia; nie pobieramy przypadkowego PDF ani starego e-maila.',[id],'dependency');
  for(const id of ['DESC-024','DESC-025'])skip(id+': pozostałe kanały i warianty','Ten przebieg obejmuje jedno potwierdzenie WHOLESALE. RETAIL, ACADEMY i faktura wymagają osobnych kontroli.',[id],'out_of_scope');
 }catch(e){report.tests.push({name:'Przebieg dokumentów i poczty',status:'FAIL',detail:api.clean(e.message)});}
 finally{await adapter?.close();}
 return c.finish();
}
