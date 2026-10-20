import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyApplicationDescription,verifyRetailSummary,verifyOfferDescription} from '../api-tests/description-retail-cart.mjs';
test('Podsumowanie RETAIL: nazwa wariantu jest poprawna, gdy wskazuje ją jawne oczekiwanie',()=>{
 const p={name:'Matlandia. Klasa 4',summaryName:'Dostęp nauczycielski 2 lata'};
 verifyRetailSummary([['1','Dostęp nauczycielski 2 lata','1']],p);
 assert.throws(()=>verifyRetailSummary([['1','Dostęp nauczycielski 1 rok','1']],p),/Nazwa w podsumowaniu/);
 assert.throws(()=>verifyRetailSummary([['1','Inny wariant','Dostęp nauczycielski 2 lata']],p));
 assert.throws(()=>verifyRetailSummary([],p));
});
test('Opis aplikacji: nazwa i obie dokładne liczby są wymagane; 111 nie zastępuje 11',()=>{
 const expected={name:'Matlandia. Klasa 4',students:11};const text='Matlandia. Klasa 4\nDostępy nauczycielskie: 1\nDostępy uczniowskie: 11';verifyApplicationDescription(text,expected);
 for(const bad of [text.replace('Klasa 4','Klasa 5'),text.replace('nauczycielskie: 1','nauczycielskie: 11'),text.replace('uczniowskie: 11','uczniowskie: 111'),text.replace('uczniowskie: 11','uczniowskie: 10')])assert.throws(()=>verifyApplicationDescription(bad,expected));
});
test('Opis oferty wymaga obu nazw i dokładnych ilości, z literalnymi znakami w nazwie',()=>{const p=[{name:'Produkt (A)'},{name:'Produkt B'}],text='2 x Produkt (A)\n2 × Produkt B';verifyOfferDescription(text,p);for(const bad of [text.replace('Produkt (A)','Nazwa hurtowa'),text.replace('2 ×','12 ×'),text.replace('Produkt B','Produkt C')])assert.throws(()=>verifyOfferDescription(bad,p));});
