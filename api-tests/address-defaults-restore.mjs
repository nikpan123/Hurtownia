import {readFile,unlink} from 'node:fs/promises';
import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {connectAddressDefaultsCms,restoreAddressDefaults} from './address-defaults-cms.mjs';
await loadEnv();
const config=await loadConfig('config/dev.local.json'),credentials=await credentialsFor(config),journalFile='.auth/address-defaults-restore.json';
let cms;
try{
 const state=await(await fetch('http://127.0.0.1:18767/api/state')).json();if(state.jobs?.some(j=>j.status==='RUNNING'))throw new Error('Trwa inny przebieg; przywracanie zablokowane');
 const journal=JSON.parse(await readFile(journalFile,'utf8'));
 cms=await connectAddressDefaultsCms(credentials.email,{sessionFile:config.sessionFile});await restoreAddressDefaults(cms,journal);await unlink(journalFile);
 console.log('Przywrócono i odczytem CMS potwierdzono oba oryginalne ID adresów domyślnych.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await cms?.close();}
