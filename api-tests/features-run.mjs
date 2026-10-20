import {runCmsProductCreation as runProductCreation} from './product-create-cms.mjs';
import {readFile} from 'node:fs/promises';
import {loadEnv,loadConfig,credentialsFor} from './config.mjs';
import {runDescriptions,runRounding} from './features.mjs';
try{
  await loadEnv();const args=process.argv.slice(2);const known=new Set(['--suite','--input']);
  for(let i=0;i<args.length;i+=2)if(!known.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Użyj --suite rounding/descriptions/product-create oraz opcjonalnie --input plik.json');
  const suite=args[args.indexOf('--suite')+1];const fn={rounding:runRounding,descriptions:runDescriptions,'product-create':runProductCreation}[suite];if(!fn)throw new Error('Wybierz zestaw testów.');
  const config=await loadConfig('config/dev.local.json');const input=args.includes('--input')?JSON.parse(await readFile(args[args.indexOf('--input')+1],'utf8')):undefined;
  if(suite==='product-create'&&!input)throw new Error('Użyj formularza http://127.0.0.1:18767/#create-product albo dodaj --input config/product-create.local.json.');
  const result=await fn(config,await credentialsFor(config,{requireShop:suite!=='product-create'}),{input,vars:process.env,sessionFile:config.sessionFile??'.auth/dev.json',onProgress:console.log});
  console.log(result.report.status+' — '+result.directory);process.exitCode=result.report.status==='PASS'?0:1;
}catch(e){console.error(e.message);process.exitCode=1;}
