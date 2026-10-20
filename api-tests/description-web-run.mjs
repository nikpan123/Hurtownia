import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionWeb} from './description-web.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
try{const result=await runDescriptionWeb(config,await credentialsFor(config),{sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='FAIL'?1:0;}catch(e){console.error(e.message);process.exitCode=1;}
