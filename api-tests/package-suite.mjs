import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {runPackageRegression} from './redmine-36618.mjs';
import {withPackageProducts} from './package-products.mjs';
import {ApiClient} from './http.mjs';
import {saveFeatureReport} from './feature-report.mjs';
import {connectPackageCms} from './package-cms.mjs';
import {protectPickup,restorePickup,buildPackageSettings} from './package-references.mjs';
import {readWholesalerRebates} from './wholesaler-cms.mjs';
import {databaseVerifier} from './database.mjs';
import {packageDocumentVerifier} from './package-documents.mjs';

export async function packageOffers(api,product){
 const req=async(method,endpoint,body)=>{const r=await api.request(method,endpoint,{body});if(![200,201,204].includes(r.status))throw new Error('Przygotowanie ofert: HTTP '+r.status);return r.data;};
 await api.loginShop();const cart=await req('POST','shop/orders',{localeCode:'pl_PL'});if(!cart.tokenValue)throw new Error('Brak tokenu koszyka przygotowania');api.secrets.push(cart.tokenValue,encodeURIComponent(cart.tokenValue));
 const token=encodeURIComponent(cart.tokenValue);await req('POST','shop/orders/'+token+'/items/bulk',{items:[{productVariant:product.productVariant,quantity:1}]});
 const payments=await req('GET','wholesale/orders/'+token+'/payments'),offers=[];
 for(const payment of payments){await req('PATCH','wholesale/orders/'+token+'/payment-method',{paymentMethodCode:payment.code});const data=(await req('GET','wholesale/checkout-step-two/'+token)).shippingMethods;
  const shipping=Array.isArray(data)?data:data?.['hydra:member']??data?.member;if(!Array.isArray(shipping))throw new Error('Brak listy dostaw');offers.push({code:payment.code,shipping:shipping.map(s=>s.code)});
 }
 return offers;
}

export async function loadPackageSettings() {
  try { return JSON.parse(await readFile('config/redmine-36618.local.json','utf8')); }
  catch(e) {
    if(e.code!=='ENOENT')throw e;
    const settings=JSON.parse(await readFile('config/redmine-36618.example.json','utf8'));
    try {
      const existing=JSON.parse(await readFile('config/order-regression.local.json','utf8'));
      settings.packages={...settings.packages,...existing.packages};
    } catch(error) { if(error.code!=='ENOENT')throw error; }
    return settings;
  }
}

export async function runConfiguredPackageRegression(config, credentials, options={}) {
  const settings=options.settings??await loadPackageSettings();
  const directory=options.directory??path.resolve(config.outputDirectory??'raporty-api',`redmine-36618-${Date.now()}-${randomUUID().slice(0,8)}`);
  const opts={...options,directory};
  if((options.autoProducts??settings.autoProducts??true)===false)return runPackageRegression(config,credentials,{...opts,settings});
  const api=new ApiClient(config,credentials,opts);
  const preparationRequests=[];
  try {
    return await withPackageProducts(config,settings,{...opts,onSecret:value=>api.secrets.push(value)},
      async prepared=>{
        if(settings.autoReferences===false)return runPackageRegression(config,credentials,{...opts,settings:prepared});
        const requests=preparationRequests;
        const cms=options.referenceAdapter??await connectPackageCms({...opts,onRequest:r=>requests.push(r),onSecret:value=>api.secrets.push(value)});
        try{
          return await protectPickup(cms,async()=>{
            opts.onProgress?.('CMS: odczyt kalkulatorów, dopłat i rabatów konta');
            const references=await cms.references();
            const profile=options.rebateProfile??await readWholesalerRebates(credentials.email,opts);
            const offers=await packageOffers(api,prepared.packages.product);
            const completed=buildPackageSettings(prepared,references,offers,profile.rebates);
            const verifyDatabase=opts.verifyDatabase??(opts.complete?databaseVerifier(opts):undefined);
            const verifyDocuments=opts.verifyDocuments??packageDocumentVerifier(config,credentials,{...opts,cms,onRequest:r=>requests.push(r)});
            const result=await runPackageRegression(config,credentials,{...opts,settings:completed,verifyDatabase,verifyDocuments});
            result.report.reference=completed.referenceSource;
            result.report.requests.unshift(...api.clean([...requests,...api.requests]));
            return result;
          },opts);
        }finally{await cms.close();}
      });
  } catch(e) {
    const report=api.clean({kind:'redmine-36618',issue:36618,scenario:'Redmine #36618 — przygotowanie produktów QA',
      generatedAt:new Date().toISOString(),baseUrl:config.baseUrl,status:'FAIL',restorationFailed:e.restorationFailed===true,
      scopeNote:'Przygotowanie produktów lub wzorców CMS nie zostało potwierdzone. Nie uruchomiono dalszych zamówień.',
      tests:[{name:'Przygotowanie zestawu #36618',status:'FAIL',detail:e.message}],requests:[...preparationRequests,...api.requests],tables:[]});
    await saveFeatureReport(report,directory);return {report,directory};
  }
}

export async function restorePackageEnvironment(options={}){
 const cms=options.referenceAdapter??await connectPackageCms(options);
 try{await restorePickup(cms,options);}finally{await cms.close();}
}
