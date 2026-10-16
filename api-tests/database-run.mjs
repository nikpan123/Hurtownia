import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadEnv,loadConfig} from './config.mjs';
import {verifySavedReport} from './database.mjs';
import {saveFeatureReport} from './feature-report.mjs';
try{
  await loadEnv();const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--report'||!/^[a-z0-9_-]+$/i.test(args[1]))throw new Error('Użyj --report identyfikator-raportu');
  const config=await loadConfig('config/dev.local.json');const source=JSON.parse(await readFile(path.join('raporty-api',args[1],'raport.json'),'utf8'));const report=await verifySavedReport(source,{vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json'});const directory=path.resolve('raporty-api','database-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8));await saveFeatureReport(report,directory);console.log(JSON.stringify({status:report.status,directory,failures:report.tests.filter(c=>c.status==='FAIL')}));process.exitCode=report.status==='FAIL'?1:0;
}catch(e){console.error(e.message);process.exitCode=1;}
