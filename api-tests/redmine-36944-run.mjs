import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runRounding36944} from './redmine-36944.mjs';
import {restoreRoundingPromotion} from './rounding-promotion.mjs';
import {connectDescriptionWeb} from './description-web.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
try{if(process.argv.includes('--restore')){const adapter=await connectDescriptionWeb({vars:process.env});try{await restoreRoundingPromotion(adapter);console.log('Przywrócono promocję QA 289.');}finally{await adapter.close();}}else{const result=await runRounding36944(config,await credentialsFor(config),{vars:process.env,onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='PASS'?0:1;}}catch(e){console.error(e.message);process.exitCode=1;}
