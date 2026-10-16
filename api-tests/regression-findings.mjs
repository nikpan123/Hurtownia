const differenceValue=(field,value)=>typeof value!=='number'?value:/rebatePercent$/i.test(field)?value+'%':/price|total/i.test(field)?(value/100).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':value;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function regressionFindings(report){
  const groups=new Map();
  for(const t of report.tests??[]){
    if(t.status!=='FAIL')continue;
    const requests=t.evidence?.requests??[],serverError=requests.find(r=>r.status>=500);
    let title,meaning;
    if(t.name.startsWith('Izolacja')&&(t.evidence?.isolation?.changes?.length||t.detail?.includes('zmieniło koszyk'))){title='Obce konto zmienia dane koszyka';meaning='Odmowa dostępu nie wystarcza: po żądaniu drugiego konta stan koszyka właściciela się zmienił. To problem API, wymagający poprawy backendu.';}
    else if(serverError){title=t.name.includes('ilości')?'HTTP 500 dla nieprawidłowej ilości':t.name.includes('kod payment')?'HTTP 500 dla nieistniejącej płatności':t.name.includes('kod shipping')?'HTTP 500 dla nieistniejącej dostawy':t.name.includes('Pusty koszyk')?'HTTP 500 przy obsłudze pustego koszyka':'Błąd serwera HTTP 500';meaning='API zwróciło błąd serwera. Dla błędnych danych test oczekuje kontrolowanej odpowiedzi walidacji 4xx. Odczyt istniejącego koszyka powinien działać. Tego wyniku nie zaliczamy jako poprawnego odrzucenia.';}
    else {title=t.name;meaning='Sprawdź szczegóły i zapisane żądania tego przypadku. Sam status FAIL nie rozstrzyga, czy przyczyną są dane, test czy API.';}
    const item=groups.get(title)??{title,meaning,cases:[]};item.cases.push({name:t.name,detail:t.detail,cartId:t.evidence?.cartId,request:serverError,isolation:t.evidence?.isolation});groups.set(title,item);
  }
  return [...groups.values()];
}
export function renderRegressionFindings(report){
  if(report.kind!=='order-regression')return '';
  const findings=regressionFindings(report),legacyIsolation=(report.tests??[]).some(t=>t.status==='FAIL'&&t.name.startsWith('Izolacja')&&!t.evidence?.isolation&&t.detail?.includes('zmieniło koszyk'));
  return `<section><h2>Najważniejsze ustalenia regresji</h2><p>Liczba niezaliczonych kontroli nie jest liczbą niezależnych usterek. Poniżej pogrupowano zapisane wyniki według objawu.</p>${legacyIsolation?'<p><b>Uwaga do starszego przebiegu:</b> próby izolacji korzystały ze wspólnego koszyka dla danego kierunku. Po pierwszej zmianie kolejne porównania mogły pokazywać jej skutek. Nowy test tworzy osobny koszyk dla każdej obcej operacji; historyczne wyniki pozostają zachowane.</p>':''}${findings.length?findings.map(f=>`<article><h3 class="FAIL">${esc(f.title)} — ${f.cases.length} kontroli</h3><p>${esc(f.meaning)}</p><ul>${f.cases.map(c=>`<li><b>${esc(c.name)}</b>${c.request?' — '+esc(c.request.method)+' '+esc(c.request.endpoint)+' → HTTP '+esc(c.request.status):''}${c.isolation?` — koszyk ${esc(c.cartId??'nieustalony')}, osobny: ${c.isolation.freshCart?'tak':'nie'}, HTTP ${esc(c.isolation.status)}${c.isolation.changes?.length?'<ul>'+c.isolation.changes.map(d=>`<li>${esc(d.field)}: ${esc(differenceValue(d.field,d.before))} → ${esc(differenceValue(d.field,d.after))}</li>`).join('')+'</ul>':''}`:''}</li>`).join('')}</ul></article>`).join(''):'<p>Nie zapisano niezaliczonych kontroli. Pominięte przypadki nadal wymagają osobnego sprawdzenia.</p>'}<p>SKIP oznacza brak wykonanej kontroli, np. niedostępną metodę odbioru lub brak niezależnie potwierdzonego stanu magazynowego. Nie zamieniamy go na PASS.</p></section>`;
}
