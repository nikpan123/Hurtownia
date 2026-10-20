import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionRetailCart} from './description-retail-cart.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
try{const result=await runDescriptionRetailCart(config,await credentialsFor(config),{vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='PASS'?0:1;}catch(e){console.error(e.message);process.exitCode=1;}
