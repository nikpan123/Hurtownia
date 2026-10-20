import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../dashboard/public/product-form.js',import.meta.url),'utf8');
function form(post){
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',disabled:false,hidden:false,events:{},classList:{toggle(){}},attrs:{},addEventListener(name,fn){this.events[name]=fn;},querySelectorAll(){return ['new-code','new-variant','new-name','new-slug','new-channel','new-price','new-original','new-minimum'].map($);},checkValidity(){return true;},removeAttribute(k){delete this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;},focus(){}});return nodes.get(id);};
 for(const [id,value] of Object.entries({'new-name':'Nazwa A','new-channel':'WHOLESALE','new-price':'50,00','new-original':'50,00','new-minimum':'0,00'}))$(id).value=value;
 runInNewContext(source,{$,post,state:{jobs:[],reports:[]},crypto:{randomUUID:()=> 'abcde-123'},location:{hash:''},refresh(){},setInterval(){},toast(){},setView(){},badge(){},esc:x=>x});
 return {$,submit:()=>$('product-form').events.submit({preventDefault(){}}),edit:(id,value)=>{$(id).value=value;$('product-form').events.input();}};
}
const preview=input=>({method:'POST',endpoint:'/products/new/simple/BOOK',contentType:'form',name:input.name,channel:input.channel});
test('Podgląd: zmiana nazwy i kanału usuwa stare dane, kolejny podgląd zawiera nowe wartości',async()=>{
 const f=form(async(url,{input})=>preview(input));await f.submit();assert(f.$('product-json').textContent.includes('Nazwa A'));
 f.edit('new-name','Nazwa B');f.edit('new-channel','RETAIL');assert(!f.$('product-json').textContent.includes('Nazwa A'));assert.equal(f.$('product-create').disabled,true);
 await f.submit();assert(f.$('product-json').textContent.includes('Nazwa B'));assert(f.$('product-json').textContent.includes('RETAIL'));assert.equal(f.$('product-create').disabled,false);
});
test('Podgląd: błędny kod daje lokalny komunikat i nigdy nie pozostawia poprzedniego JSON',async()=>{
 let calls=0;const f=form(async(url,{input})=>{calls++;return preview(input);});await f.submit();f.edit('new-code','Testowy produkt API');await f.submit();
 assert.equal(calls,1);assert.equal(f.$('new-code').attrs['aria-invalid'],'true');assert(f.$('product-feedback').textContent.includes('qa-'));assert(!f.$('product-json').textContent.includes('Nazwa A'));assert.equal(f.$('product-create').disabled,true);
});
test('Podgląd: spóźniona odpowiedź nie nadpisuje nowszego podglądu',async()=>{
 const pending=[];const f=form((url,{input})=>new Promise(resolve=>pending.push(()=>resolve(preview(input)))));
 const first=f.submit();f.edit('new-name','Nowsza nazwa');const second=f.submit();pending[1]();await second;pending[0]();await first;
 assert(f.$('product-json').textContent.includes('Nowsza nazwa'));assert(!f.$('product-json').textContent.includes('Nazwa A'));
});
