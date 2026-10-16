import http from 'node:http';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {parseEnv} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ApiClient} from '../api-tests/http.mjs';
import {runScenario} from '../api-tests/engine.mjs';
import {runCatalog} from '../api-tests/catalog.mjs';
import {ChoiceGate,validateSelection,availableProducts} from './wizard.mjs';
import {redactText} from '../api-tests/config.mjs';
import {runProductCreation,runRounding,runDescriptions,productPayload} from '../api-tests/features.mjs';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reportRoot=path.join(workspace,'raporty-api');
const secret=randomBytes(24).toString('hex');
const definitions={
  cart:{name:'Koszyk',script:'api-tests/run.mjs',args:['--config','config/dev.local.json']},
  wizard:{name:'Zamówienie krok po kroku',script:'',args:[]},
  order:{name:'Pełne zamówienie',script:'api-tests/run.mjs',args:['--config','config/dev.local.json','--complete']},
  catalog:{name:'Katalog produktów',script:'api-tests/catalog-run.mjs',args:[]},
  'product-create':{name:'Tworzenie produktu przez API',script:'',args:[]},
  rounding:{name:'Ceny netto / brutto — wzorzec starej hurtowni',script:'',args:[]},
  descriptions:{name:'Opisy produktów zależne od kanału — API',script:'',args:[]},
  login:{name:'Logowanie GitLab',script:'api-tests/login.mjs',args:[]}
};
const jobs=[];let currentChild;let currentController;let launching=false;const gates=new Map();
async function env() {
  let local={};try{local=parseEnv(await readFile(path.join(workspace,'.env'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  return {...process.env,...local};
}
function scrub(text,values){return redactText(text,Object.values(values));}
async function settings() {
  const vars=await env();const config=JSON.parse(await readFile(path.join(workspace,'config/dev.local.json'),'utf8'));
  if(vars.HURT_DEV_BASE_URL)config.baseUrl=vars.HURT_DEV_BASE_URL;
  const keys=config.credentials;
  const credentials={email:vars[keys.emailEnv],password:vars[keys.passwordEnv],testsToken:vars[keys.testsTokenEnv],cookie:vars[keys.cookieEnv]};
  if(!credentials.cookie)try{credentials.cookies=JSON.parse(await readFile(path.resolve(workspace,config.sessionFile??'.auth/dev.json'),'utf8')).cookies;}catch(e){if(e.code!=='ENOENT')throw e;}
  return {vars,config,credentials};
}
function countResults(data){return (data.tests??data.checks??[]).reduce((a,t)=>(a[t.status]=(a[t.status]??0)+1,a),{PASS:0,FAIL:0,SKIP:0});}
async function reports() {
  let entries=[];try{entries=await readdir(reportRoot,{withFileTypes:true});}catch(e){if(e.code!=='ENOENT')throw e;}
  const results=[];
  for(const entry of entries) {
    if(!entry.isDirectory())continue;
    try{
      const data=JSON.parse(await readFile(path.join(reportRoot,entry.name,'raport.json'),'utf8'));
      const files=(await readdir(path.join(reportRoot,entry.name))).filter(f=>/\.(html|json|pdf)$/.test(f));
      results.push({id:entry.name,date:data.generatedAt,status:data.status??'UNKNOWN',name:data.scenario??'Katalog produktów',kind:data.kind??(data.tests?'catalog':'cart'),finalization:data.finalization??null,orderId:data.orderId??data.snapshots?.[0]?.order?.id,error:data.error??null,counts:countResults(data),products:(data.products??[]).map(p=>p.productVariant??p.isbn),payment:data.selectedPayment,shipping:data.selectedShipping,files});
    }catch{/* Pomijamy foldery bez zakończonego raportu. */}
  }
  return results.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
async function state() {
  const {config,credentials,vars}=await settings();const all=await reports();
  return {baseUrl:config.baseUrl,environment:config.environment,reports:all,jobs:jobs.slice(-15).reverse(),suites:Object.entries(definitions).filter(([id])=>id!=='login').map(([id,d])=>({id,name:d.name})),
    settings:{credentialsReady:!!(credentials.email&&credentials.password&&credentials.testsToken),gatewaySession:!!(credentials.cookie||credentials.cookies?.length),adminReady:!!(vars.SYLIUS_ADMIN_EMAIL&&vars.SYLIUS_ADMIN_PASSWORD),randomProducts:config.scenario?.randomProducts,randomCheckout:config.scenario?.randomCheckout,groupRebates:config.scenario?.expectations?.groupRebatePercent,paymentQuoteTotalBasis:config.scenario?.expectations?.paymentQuoteTotalBasis,testEnvironmentEnabled:false}};
}
async function executeSuite(body,vars,options) {
  const {config:cartConfig,credentials}=await settings();
  if(!credentials.testsToken||(body.suite!=='product-create'&&(!credentials.email||!credentials.password)))throw new Error('Uzupełnij wymagane dane API w .env.');
  if(body.suite==='product-create')return runProductCreation(cartConfig,credentials,{...options,input:body.input,adminEmail:vars.SYLIUS_ADMIN_EMAIL,adminPassword:vars.SYLIUS_ADMIN_PASSWORD});
  if(body.suite==='rounding')return runRounding(cartConfig,credentials,options);
  if(body.suite==='descriptions')return runDescriptions(cartConfig,credentials,options);
  if(body.suite==='wizard') {
    cartConfig.scenario.products=validateSelection(body.items,await wizardProducts());
    cartConfig.scenario.randomProducts={enabled:false};
    cartConfig.scenario.productSelection={source:body.automatic?'frontend':'manual',group:cartConfig.scenario.products[0].group};
    cartConfig.scenario.name='Zamówienie krok po kroku';
    return runScenario(cartConfig,credentials,{...options,complete:true,interactiveMode:body.automatic?'ui-random':'manual'});
  }
  if(['cart','order'].includes(body.suite)) {
    if(body.seed){
      if(cartConfig.scenario.randomProducts?.enabled)cartConfig.scenario.randomProducts.seed=body.seed;
      cartConfig.scenario.randomCheckout??={};cartConfig.scenario.randomCheckout.seed=body.seed;
    }
    return runScenario(cartConfig,credentials,{...options,complete:body.suite==='order'});
  }
  const config=JSON.parse(await readFile(path.join(workspace,'config/catalog.dev.local.json'),'utf8'));
  if(vars.HURT_DEV_BASE_URL)config.baseUrl=vars.HURT_DEV_BASE_URL;
  return runCatalog(config,credentials,{...options,create:body.suite==='catalog-create',adminEmail:vars[config.creation?.adminEmailEnv??'SYLIUS_ADMIN_EMAIL'],adminPassword:vars[config.creation?.adminPasswordEnv??'SYLIUS_ADMIN_PASSWORD']});
}
async function launch(body,runner) {
  if(launching||currentChild||currentController)throw Object.assign(new Error('Poczekaj na zakończenie aktualnego przebiegu.'),{status:409});
  launching=true;
  try {
  const d=definitions[body.suite];if(!d)throw Object.assign(new Error('Nieznany zestaw testów.'),{status:400});
  if(body.suite==='product-create')productPayload(body.input);
  const args=[d.script,...d.args];
  if(body.seed){if(!['cart','order'].includes(body.suite))throw new Error('Ziarno dotyczy koszyka i zamówienia.');if(typeof body.seed!=='string'||body.seed.length>128)throw new Error('Niepoprawne ziarno.');args.push('--seed',body.seed);}
  const vars=await env();
  const job={id:randomUUID(),suite:body.suite,name:d.name,status:'RUNNING',startedAt:new Date().toISOString(),log:'',seed:body.seed??null,automatic:body.suite==='wizard'&&body.automatic===true};
  const sensitive=Object.fromEntries(Object.entries(vars).filter(([k])=>/PASSWORD|TOKEN|COOKIE|EMAIL|USERNAME/i.test(k)));
  jobs.push(job);
  const append=chunk=>{job.log=(job.log+scrub(chunk.toString(),sensitive)).slice(-64000);};
  if(body.suite!=='login') {
    const controller=new AbortController();currentController=controller;
    let interactive={};
    if(body.suite==='wizard') {
      const gate=new ChoiceGate(job,controller.signal);gates.set(job.id,gate);
      interactive={choosePayment:p=>gate.wait('payment',p),chooseShipping:p=>gate.wait('shipping',p),beforeComplete:p=>gate.wait('review',p)};
      job.wizard={phase:'working'};
    }
    append('Rozpoczęto testy na dev.\n');
    Promise.resolve().then(()=>runner(body,vars,{signal:controller.signal,onProgress:line=>append(line+'\n'),...interactive})).then(result=>{
      job.status=controller.signal.aborted?'CANCELLED':result.report.status;
      job.error=result.report.error??null;
      if(body.suite==='product-create'){job.creation=result.report.creation;job.lastResponse=result.report.lastResponse;}
      if(body.suite==='wizard')job.lastOrder=result.report.snapshots?.at(-1)?.order;
      append('\n'+job.status+' — '+result.directory+'\n');
      if(result.report.error)append(result.report.error+'\n');
    }).catch(error=>{job.status=controller.signal.aborted?'CANCELLED':'FAIL';append(error.message+'\n');}).finally(()=>{job.finishedAt=new Date().toISOString();job.wizard=null;gates.delete(job.id);if(currentController===controller)currentController=null;});
    return job;
  }
  let child;
  try {child=spawn(process.execPath,args,{cwd:workspace,env:vars,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});}
  catch {job.status='FAIL';job.finishedAt=new Date().toISOString();append('Nie udało się otworzyć logowania. Uruchom plik Zaloguj-dev.cmd.');return job;}
  currentChild=child;
  child.stdout.on('data',append);child.stderr.on('data',append);
  child.on('error',error=>{job.log+='\nNie udało się uruchomić procesu: '+error.code;job.status='FAIL';job.finishedAt=new Date().toISOString();if(currentChild===child)currentChild=null;});
  child.on('close',(code,signal)=>{job.exitCode=code;job.status=job.status==='CANCELLED'?'CANCELLED':code===0?'PASS':'FAIL';job.finishedAt=new Date().toISOString();if(signal)job.signal=signal;if(currentChild===child)currentChild=null;});
  return job;
  } finally {launching=false;}
}
async function wizardProducts() {
  const {config,credentials}=await settings();
  if(!credentials.email||!credentials.password||!credentials.testsToken)throw new Error('Uzupełnij HURT_EMAIL, HURT_API_PASSWORD i HURT_TESTS_TOKEN w .env.');
  const api=new ApiClient(config,credentials);await api.loginShop();
  const catalog=JSON.parse(await readFile(path.join(workspace,'config/products.json'),'utf8')).products.filter(p=>p.enabled!==false);
  const rows=[];let last=1;
  for(let page=1;page<=last;page++) {
    const r=await api.request('GET','shop/products-dto',{query:{page,limit:50}});
    if(r.status!==200||!Array.isArray(r.data?.data))throw new Error('Nie udało się pobrać produktów WHOLESALE: HTTP '+r.status);
    last=r.data.pagination?.last??1;if(!Number.isInteger(last)||last>20)throw new Error('Przekroczono limit stron katalogu.');
    rows.push(...r.data.data);
  }
  return availableProducts(catalog,rows);
}
async function preview(body) {
  const allowed=new Set(['page','limit','order_by','sort','name','publication_type[]','subjects[]','primary_school[]','high_school[]','taxons[]']);
  if(!['WHOLESALE','RETAIL','ACADEMY'].includes(body.channel))throw new Error('Wybierz kanał.');
  if(!['list','detail'].includes(body.endpoint))throw new Error('Nieznany endpoint podglądu.');
  const query=body.query??{};
  if(Object.keys(query).some(k=>!allowed.has(k)))throw new Error('Nieobsługiwany parametr.');
  if(query.limit!==undefined&&(!Number.isInteger(Number(query.limit))||Number(query.limit)>100||Number(query.limit)<1))throw new Error('Podgląd obsługuje limit 1–100.');
  if(Object.values(query).some(v=>JSON.stringify(v).length>1000))throw new Error('Parametr jest zbyt długi.');
  const {config,credentials}=await settings();
  if(!credentials.email||!credentials.password||!credentials.testsToken)throw new Error('Uzupełnij dane hurtownika w .env.');
  const api=new ApiClient(config,credentials);await api.loginShop();
  const endpoint=body.endpoint==='list'?'shop/products-dto':'shop/products-dto-by-slug/'+encodeURIComponent(body.slug??'');
  if(body.endpoint==='detail'&&(!body.slug||body.slug.length>255||['.','..'].includes(body.slug)))throw new Error('Podaj poprawny slug.');
  const result=await api.request('GET',endpoint,{channel:body.channel,query:body.endpoint==='list'?query:{}});
  return api.clean({status:result.status,durationMs:result.meta.durationMs,endpoint:result.meta.endpoint,contentType:result.contentType,data:result.data});
}
export async function safeReportPath(root,segments) {
  if(!segments.length||segments.some(s=>!s||s==='.'||s==='..'||/[\\/\0]/.test(s)))throw Object.assign(new Error('Niepoprawna ścieżka raportu.'),{status:400});
  const resolvedRoot=await realpath(root);const file=await realpath(path.join(resolvedRoot,...segments));
  if(!file.startsWith(resolvedRoot+path.sep))throw Object.assign(new Error('Niedozwolona ścieżka.'),{status:403});
  if(!/\.(html|json|pdf)$/.test(file))throw Object.assign(new Error('Nieobsługiwany plik.'),{status:400});
  return file;
}
async function jsonBody(req) {
  let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>16000)throw Object.assign(new Error('Zbyt duże żądanie.'),{status:413});}
  try{return JSON.parse(raw);}catch{throw Object.assign(new Error('Niepoprawny JSON.'),{status:400});}
}
export function createDashboardServer({runSuite=executeSuite}={}) {
  const server=http.createServer(async(req,res)=>{
    const host=req.headers.host;
    const port=server.address()?.port;
    const origin='http://127.0.0.1:'+port;
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    if(host!=='127.0.0.1:'+port)return send(403,{error:'Panel dostępny tylko lokalnie.'});
    try {
      const url=new URL(req.url,origin);
      if(req.method==='POST') {
        if(req.headers.origin!==origin||req.headers['x-ui-token']!==secret||!(req.headers['content-type']??'').includes('application/json'))return send(403,{error:'Odśwież panel przed wykonaniem operacji.'});
        const body=await jsonBody(req);
        if(url.pathname==='/api/run')return send(202,await launch(body,runSuite));
        if(url.pathname==='/api/preview')return send(200,await preview(body));
        if(url.pathname==='/api/product/preview')return send(200,productPayload(body.input));
        if(url.pathname==='/api/wizard/products')return send(200,{products:await wizardProducts()});
        if(url.pathname==='/api/wizard/choice'){
          const gate=gates.get(body.id);if(!gate)throw new Error('Brak aktywnego etapu zamówienia.');
          gate.submit(body.requestId,body.value);return send(200,{ok:true});
        }
        if(url.pathname==='/api/stop'){
          const job=jobs.find(j=>j.id===body.id&&j.status==='RUNNING');
          if(!job||(!currentChild&&!currentController))return send(409,{error:'Ten przebieg już się zakończył.'});
          job.log+='\nZatrzymywanie przebiegu…\n';currentController?.abort(new Error('Przebieg zatrzymany przez użytkownika.'));currentChild?.kill();return send(200,{ok:true});
        }
      }
      if(req.method!=='GET')return send(404,{error:'Nie znaleziono.'});
      if(url.pathname==='/api/state')return send(200,await state());
      if(url.pathname.startsWith('/reports/')) {
        const file=await safeReportPath(reportRoot,url.pathname.slice('/reports/'.length).split('/').map(decodeURIComponent));
        res.writeHead(200,{'Content-Type':file.endsWith('.pdf')?'application/pdf':file.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; sandbox allow-popups allow-same-origin"});return res.end(await readFile(file));
      }
      const assets={'/':'index.html','/app.js':'app.js','/wizard.js':'wizard.js','/product-form.js':'product-form.js','/style.css':'style.css'};
      const asset=assets[url.pathname];if(!asset)return send(404,{error:'Nie znaleziono.'});
      let data=await readFile(path.join(workspace,'dashboard/public',asset));
      if(asset==='index.html')data=Buffer.from(data.toString().replace('__UI_TOKEN__',secret));
      res.writeHead(200,{'Content-Type':asset.endsWith('.css')?'text/css':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'self'"});res.end(data);
    } catch(error){send(error.status??(error.code==='ENOENT'?404:400),{error:error.code==='ENOENT'?'Nie znaleziono pliku lub konfiguracji.':error.message});}
  });
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=createDashboardServer();
  server.listen(18767,'127.0.0.1',()=>console.log('Panel testów: http://127.0.0.1:18767'));
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Panel jest już uruchomiony: http://127.0.0.1:18767':error.message);process.exitCode=1;});
  const stop=()=>{currentController?.abort();currentChild?.kill();server.close(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
