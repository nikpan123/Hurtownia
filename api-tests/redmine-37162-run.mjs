import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runShipmentRegression} from './redmine-37162.mjs';
try{
 if(process.argv.length>2)throw new Error('Ten scenariusz używa konfiguracji DEV, bez dodatkowych argumentów.');
 await loadEnv();const config=await loadConfig('config/dev.local.json');
 const {report,directory}=await runShipmentRegression(config,await credentialsFor(config),{onProgress:console.log});
 console.log(report.status+' — '+directory);process.exitCode=report.status==='PASS'?0:1;
}catch(error){console.error(error.message);process.exitCode=1;}
