import {loadEnv,loadConfig} from './config.mjs';
import {restoreShippingConfiguration} from './shipping-cms.mjs';
try{await loadEnv();const c=await loadConfig('config/dev.local.json');await restoreShippingConfiguration({vars:process.env,sessionFile:c.sessionFile??'.auth/dev.json'});console.log('Ustawienia GLS przywrócone i potwierdzone.');}catch(e){console.error(e.message);process.exitCode=1;}
