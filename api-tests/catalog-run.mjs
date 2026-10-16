import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runCatalog} from './catalog.mjs';
try {
  await loadEnv();const args=process.argv.slice(2);const allowed=new Set(['--config','--create','--allow-test']);
  for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))throw new Error('Nieznany argument: '+args[i]);if(args[i]==='--config'){if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Brak ścieżki konfiguracji');i++;}}
  const config=await loadConfig(args.includes('--config')?args[args.indexOf('--config')+1]:'config/catalog.dev.local.json');
  const {report,directory}=await runCatalog(config,await credentialsFor(config),{create:args.includes('--create'),allowTest:args.includes('--allow-test'),adminEmail:process.env[config.creation?.adminEmailEnv??'SYLIUS_ADMIN_EMAIL'],adminPassword:process.env[config.creation?.adminPasswordEnv??'SYLIUS_ADMIN_PASSWORD']});
  console.log(report.status+' — '+directory);
  console.log(JSON.stringify(report.tests.reduce((a,t)=>(a[t.status]=(a[t.status]??0)+1,a),{})));
  process.exitCode=report.status==='PASS'?0:1;
}catch(e){console.error(e.message);process.exitCode=1;}
