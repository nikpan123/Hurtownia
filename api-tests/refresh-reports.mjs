import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {saveReport} from './report.mjs';
import {saveFeatureReport} from './feature-report.mjs';
import {saveCatalogReport} from './catalog-report.mjs';
export async function refreshReports(root=path.resolve('raporty-api')){
  let updated=0;const errors=[];
  async function visit(directory){
    const entries=await readdir(directory,{withFileTypes:true});
    if(entries.some(e=>e.isFile()&&e.name==='raport.json')){
      try{const report=JSON.parse(await readFile(path.join(directory,'raport.json'),'utf8'));const writer=report.kind&&report.kind!=='catalog'?saveFeatureReport:report.tests?saveCatalogReport:saveReport;await writer(report,directory,{htmlOnly:true});updated++;}catch(e){errors.push({directory,error:e.message});}
    }
    for(const e of entries)if(e.isDirectory())await visit(path.join(directory,e.name));
  }
  await visit(root);return {updated,errors};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await refreshReports();console.log(JSON.stringify(result));if(result.errors.length)process.exitCode=1;}
