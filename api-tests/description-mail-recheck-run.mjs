import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionMailRecheck} from './description-mail-recheck.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
try{const result=await runDescriptionMailRecheck(config,await credentialsFor(config),{sourceReportId:process.argv[2],sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='PASS'?0:1;}catch(e){console.error(e.message);process.exitCode=1;}
