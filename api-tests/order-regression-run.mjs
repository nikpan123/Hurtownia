import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runOrderRegression} from './order-regression.mjs';
import {databaseVerifier} from './database.mjs';
import {secondAccountFromEnv} from './second-account.mjs';
try{
  await loadEnv();const args=process.argv.slice(2);if(args.some(a=>!['--complete','--packages'].includes(a)))throw new Error('Opcje: --complete, --packages');
  const config=await loadConfig('config/dev.local.json');const credentials=await credentialsFor(config);const verifyDatabase=process.env.HURT_VERIFY_DATABASE==='true'?databaseVerifier({vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json'}):undefined;const r=await runOrderRegression(config,credentials,{secondAccount:secondAccountFromEnv(process.env,credentials),complete:args.includes('--complete'),packagesOnly:args.includes('--packages'),verifyDatabase,onProgress:console.log});console.log(r.report.status+' — '+r.directory);process.exitCode=r.report.status==='FAIL'?1:0;
}catch(e){console.error(e.message);process.exitCode=1;}
