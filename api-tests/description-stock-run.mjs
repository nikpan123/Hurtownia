import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionStock,restoreDescriptionStock} from './description-stock.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json'),options={vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log};
try{if(process.argv.includes('--restore')){await restoreDescriptionStock(options);console.log('Przywrócono produkt QA stock.');}else{const result=await runDescriptionStock(config,await credentialsFor(config),options);console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='PASS'?0:1;}}catch(e){console.error(e.message);process.exitCode=1;}
