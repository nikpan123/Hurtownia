import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionAll} from './description-all.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
const evidenceReports=process.argv.filter(a=>a.startsWith('--evidence=')).map(a=>a.slice('--evidence='.length));
try{const result=await runDescriptionAll(config,await credentialsFor(config),{evidenceReports,vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json',complete:process.argv.includes('--complete'),onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='PASS'?0:1;}catch(e){console.error(e.message);process.exitCode=1;}
