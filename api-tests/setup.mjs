import {copyFile,mkdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'config'),{recursive:true});
for(const [source,target]of [
  ['.env.example','.env'],
  ...['dev','test','catalog.dev','catalog-fixtures','product-create','order-regression','description-cms'].map(name=>['config/'+name+'.example.json','config/'+name+'.local.json'])
]){
  try{await copyFile(path.join(root,source),path.join(root,target),constants.COPYFILE_EXCL);console.log('Utworzono '+target);}
  catch(e){if(e.code==='EEXIST')console.log('Pozostawiono istniejący '+target);else throw e;}
}
console.log('Uzupełnij lokalnie .env i ustawienia scenariuszy. Dane dostępowe nie należą do repozytorium.');
