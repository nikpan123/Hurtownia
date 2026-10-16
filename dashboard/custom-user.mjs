import assert from 'node:assert/strict';
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
let saving=false;
export function validateCustomEmail(value){
  assert(typeof value==='string','Podaj e-mail użytkownika.');const email=value.trim();
  assert(email.length<=254&&/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(email)&&!email.includes('..'),'Podaj poprawny adres e-mail.');
  return email;
}
export async function saveCustomEmail(value,file){
  const email=validateCustomEmail(value);assert(!saving,'Trwa zapisywanie użytkownika. Spróbuj ponownie.');saving=true;
  const temp=file+'.'+randomUUID()+'.tmp';
  try{
    const original=await readFile(file,'utf8'),eol=original.includes('\r\n')?'\r\n':'\n';
    let replaced=false;const updated=original.split(/\r?\n/).map(line=>{if(!/^\s*(?:export\s+)?HURT_CUSTOM_EMAIL\s*=/.test(line))return line;if(replaced)return '';replaced=true;return 'HURT_CUSTOM_EMAIL='+email;}).join(eol);
    const result=replaced?updated:updated+(updated.endsWith('\n')?'':eol)+'HURT_CUSTOM_EMAIL='+email+eol;
    await writeFile(temp,result,{flag:'wx',mode:0o600});assert.equal(await readFile(file,'utf8'),original,'Plik .env zmieniono w trakcie zapisu. Spróbuj ponownie.');await rename(temp,file);
    return {email};
  }finally{saving=false;await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
