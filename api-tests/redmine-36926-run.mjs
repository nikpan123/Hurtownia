import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runAddressRegression} from './redmine-36926.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
try{const r=await runAddressRegression(config,await credentialsFor(config),{onProgress:console.log});console.log(r.report.status+' — '+r.directory);process.exitCode=r.report.status==='PASS'?0:1;}catch(e){console.error(e.message);process.exitCode=1;}
