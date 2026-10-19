import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionCms,restoreDescriptionCms} from './description-cms.mjs';
await loadEnv();
const config=await loadConfig('config/dev.local.json');
const options={vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log};
if(process.argv.includes('--restore')){await restoreDescriptionCms(options);console.log('Przywrócono dane produktu QA.');}
else{const result=await runDescriptionCms(config,await credentialsFor(config),options);console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='PASS'?0:1;}
