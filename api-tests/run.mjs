import { loadEnv, loadConfig, validateConfig, credentialsFor } from './config.mjs';
import { runScenario } from './engine.mjs';
import { prepareProducts } from './products.mjs';
import {databaseVerifier} from './database.mjs';

try {
  await loadEnv();
  const args=process.argv.slice(2);
  const allowed=new Set(['--config','--plan','--complete','--allow-test','--seed']);
  for (let i=0;i<args.length;i++) {
    if (!allowed.has(args[i])) throw new Error('Nieznany argument: '+args[i]);
    if (args[i]==='--config'||args[i]==='--seed') {
      if (!args[i+1]||args[i+1].startsWith('--')) throw new Error('Brak wartości '+args[i]);
      i++;
    }
  }
  const file=args.includes('--config')?args[args.indexOf('--config')+1]:'config/dev.local.json';
  const config=await loadConfig(file);
  if (args.includes('--seed')) {
    if (!config.scenario?.randomProducts?.enabled&&!config.scenario?.randomCheckout?.payment&&!config.scenario?.randomCheckout?.shipping) throw new Error('--seed wymaga włączonego losowania produktów lub checkoutu.');
    const seed=args[args.indexOf('--seed')+1];
    if (config.scenario.randomProducts?.enabled) config.scenario.randomProducts.seed=seed;
    config.scenario.randomCheckout??={};
    config.scenario.randomCheckout.seed=seed;
  }
  const plan=args.includes('--plan');
  const allowTest=args.includes('--allow-test');
  validateConfig(config,{plan,allowTest});
  if (plan) {
    const prepared=await prepareProducts(config);
    console.log(JSON.stringify({environment:config.environment,baseUrl:config.baseUrl,enabled:config.enabled,scenario:config.scenario?.name,products:prepared.scenario?.products,seed:prepared.scenario?.productSelection?.seed??config.scenario?.randomCheckout?.seed,group:prepared.scenario?.productSelection?.group,payment:config.scenario?.randomCheckout?.payment?'Losowanie z listy API bieżącego koszyka':config.scenario?.paymentMethodCode,shipping:config.scenario?.randomCheckout?.shipping?'Losowanie z listy API po wyborze płatności':config.scenario?.shippingMethodCode,complete:args.includes('--complete'),networkRequests:0},null,2));
  } else {
    const verifyDatabase=process.env.HURT_VERIFY_DATABASE==='true'?databaseVerifier({vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json'}):undefined;
    const result=await runScenario(config,await credentialsFor(config),{complete:args.includes('--complete'),allowTest,verifyDatabase});
    console.log(result.report.status+' — '+result.directory);
    if (result.report.error) console.error(result.report.error);
    process.exitCode=result.report.status==='PASS'?0:1;
  }
} catch (e) { console.error(e.message); process.exitCode=1; }
