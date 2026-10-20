import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionRetailSummary} from './description-retail-cart.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
try{const result=await runDescriptionRetailSummary(config,await credentialsFor(config),{sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='FAIL'?1:0;}catch{console.error('Nie uruchomiono kontroli podsumowania RETAIL. Sprawdź konfigurację i raport.');process.exitCode=1;}
