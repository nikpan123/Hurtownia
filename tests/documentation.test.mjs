import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDocumentation} from '../dashboard/documentation.mjs';
import {createDashboardServer} from '../dashboard/server.mjs';

test('Dokumentacja renderuje tekst, tabele i spis treści bez wykonywania HTML i javascript',()=>{
  const r=renderDocumentation('# Instrukcja\n\n## Koszyk\n1. **Dodaj** `produkt`\n2. Sprawdź\n\n| Pole | Wartość |\n| --- | --- |\n| Cena | 12 |\n\n<script>alert(1)</script>\n[x](javascript:alert(1))\n```html\n<img onerror=alert(1)>\n```');
  assert.equal(r.toc[1].title,'Koszyk');assert(r.html.includes('id="doc-1"'));assert(r.html.includes('<ol>'));assert(r.html.includes('<table>'));assert(r.html.includes('<strong>Dodaj</strong>'));assert(!r.html.includes('<script>'));assert(!r.html.includes('<img'));assert(!r.html.includes('href="javascript:'));
});
test('Panel udostępnia bieżący README i pobranie jednego stałego pliku',async()=>{
  const server=createDashboardServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{const result=await (await fetch(base+'/api/documentation')).json();assert(result.toc.some(h=>h.title==='Drugie konto — konfiguracja i przebieg kontroli'));assert(result.html.includes('Regresja koszyka — wiele przypadków bez finalizacji'));const raw=await fetch(base+'/README.md');assert(raw.headers.get('content-disposition').includes('attachment'));assert((await raw.text()).includes('HURT_SECOND_EMAIL'));assert.equal((await fetch(base+'/.env')).status,404);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
