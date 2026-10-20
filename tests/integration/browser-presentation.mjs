import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installBrowserPresentation,publishBrowserStep} from '../../api-tests/browser-presentation.mjs';
const vars={HURT_BROWSER_PREVIEW:'true',HURT_BROWSER_SLOW_MO_MS:'0'};
const browser=await chromium.launch({channel:'msedge',headless:false});
try{
 const context=await browser.newContext();const presentation=await installBrowserPresentation(context,{vars});const page=await context.newPage();
 await page.setContent(`<form><input id="sylius_product_code" name="sylius_product[code]" value="qa-demo"><div class="title" onclick="this.classList.add('active');this.nextElementSibling.style.display='block'">WHOLESALE</div><div class="content" style="display:none"><label for="name">Nazwa WHOLESALE</label><input id="name" name="name" value="Stara nazwa"><label for="rich">Pełny opis</label><input id="rich" type="hidden" name="rich" value=""><label for="short">Krótki opis</label><textarea id="short" name="short">Stary opis</textarea><label for="enabled">Dostępny</label><input id="enabled" type="checkbox" name="enabled" value="1"></div><input type="password" name="password" value="never-show-this"><input type="hidden" name="_token" value="never-show-token"></form>`);
 const body=new URLSearchParams([['sylius_product[code]','qa-demo'],['name','Nowa nazwa QA'],['rich',JSON.stringify([{code:'monsieurbiz.html',data:{content:'<p>Nowy pełny opis</p>'}}])],['short','Nowy krótki opis'],['enabled','1'],['password','do-not-fill'],['_token','do-not-fill']]);const encoded=body.toString();
 publishBrowserStep(vars,'DESC-003: pokazuję zmianę pól QA');await presentation.form(page,body);
 assert.equal(body.toString(),encoded);assert.equal(await page.locator('#name').inputValue(),'Nowa nazwa QA');assert(await page.locator('#enabled').isChecked());assert.equal(await page.locator('[name=password]').inputValue(),'never-show-this');assert.equal(await page.locator('[name=_token]').inputValue(),'never-show-token');assert((await page.locator('[data-qa-editor-preview]').innerText()).includes('Nowy pełny opis'));
 const overlay=await page.locator('#qa-test-preview').evaluate(el=>el.shadowRoot.textContent);assert(!overlay.includes('never-show'));await page.screenshot({path:'raporty-api/podglad-pol-zmiana-2026-10-20.png'});
 body.set('short','Drugi opis');await presentation.form(page,body);assert.equal(await page.locator('#short').inputValue(),'Drugi opis');assert.equal(await page.locator('[data-qa-preview-field="1"]').count(),1);
 console.log('PASS: rozwiniecie sekcji, zmiana pol i checkboxa, czytelny opis edytora, brak zmian sekretow i payloadu, ponowna zmiana bez kolizji selektorow.');
}finally{await browser.close();}
