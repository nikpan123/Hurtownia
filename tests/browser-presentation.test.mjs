import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installBrowserPresentation,previewValue,publishBrowserStep} from '../api-tests/browser-presentation.mjs';
test('Bez podglądu prezentacja nie odczytuje DOM, nie dotyka kontekstu ani danych',async()=>{
 const forbidden=new Proxy({},{get(){throw Error('Tryb bez podglądu nie powinien uruchamiać prezentacji');}});
 const vars={HURT_BROWSER_PREVIEW:'false'},presentation=await installBrowserPresentation(forbidden,{vars});
 publishBrowserStep(vars,'Kontrola');await presentation.form(forbidden,forbidden);await presentation.inspect(forbidden,forbidden);await presentation.step(forbidden,'Etap');await presentation.result(forbidden,204);
});
test('Puste i logiczne wartości oraz treść edytora mają czytelny podgląd',()=>{
 assert.equal(previewValue(false),'niezaznaczone');assert.equal(previewValue(true),'zaznaczone');assert.equal(previewValue(''),'(puste)');assert.equal(previewValue(0),'0');
 assert.equal(previewValue(JSON.stringify([{code:'monsieurbiz.html',data:{content:'<p>Nowy opis</p>'}}])),'Nowy opis');
});
