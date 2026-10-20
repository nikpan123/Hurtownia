import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptionRetailDocuments} from './description-retail-documents.mjs';
await loadEnv();const config=await loadConfig('config/dev.local.json');
try{const result=await runDescriptionRetailDocuments(config,await credentialsFor(config),{complete:process.argv.includes('--complete'),sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log});console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='FAIL'?1:0;}catch{console.error('Nie uruchomiono zestawu RETAIL. Sprawdź konfigurację i zapisany raport; nie ponawiaj nieustalonego zapisu zamówienia.');process.exitCode=1;}
