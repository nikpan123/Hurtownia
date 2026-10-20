import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionDocuments} from './description-documents.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
const state=await(await fetch('http://127.0.0.1:18767/api/state')).json();if(state.jobs?.some(j=>j.status==='RUNNING'))throw new Error('Trwa inny przebieg; nie rozpoczynamy zapisu QA');
try{const result=await runDescriptionDocuments(config,await credentialsFor(config),{complete:process.argv.includes('--complete'),sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='FAIL'?1:0;}catch(e){console.error(e.message);process.exitCode=1;}
