// Historical manual evidence accepted by the user. It is never a fresh automated read of notes.
export function confirmCarrierManually(attempt,config){
 if(config.environment!=='dev'||new URL(config.baseUrl).hostname!=='ksiegarnia.gwodev.pl')return false;
 attempt.status='PASS';
 attempt.verification={mode:'manual-reference',confirmedOn:'2026-10-19',acceptedOn:'2026-10-20',environment:'dev',channel:'WHOLESALE',source:'Potwierdzenie użytkownika w rozmowie i zrzuty Postmana oraz sekcji Uwagi w Syliusie z 19.10.2026.',limitation:'Historyczne potwierdzenie ręczne; w tym przebiegu automat nie odczytał order.notes dla nowego koszyka.'};
 attempt.reason='PASS — potwierdzone ręcznie 19.10.2026: carrierName zapisuje się i jest wyświetlane jako „Przewoźnik: …” w uwagach zamówienia w Syliusie. Zaliczenie zaakceptowane przez użytkownika 20.10.2026. Bieżące żądanie POST przeszło kontrolę HTTP 204; GET koszyka nie udostępnia order.notes, więc zapis notatki dla tego nowego koszyka nie został ponownie odczytany automatycznie.';
 return true;
}
export function describeManualVerifications(report){
 const manual=report.tests.filter(t=>t.verification?.mode==='manual-reference');if(!manual.length)return;
 report.scopeNote+=' Wynik łączy kontrole automatyczne i ręczne: '+manual.length+' PASS na podstawie historycznego potwierdzenia ręcznego (carrierName, 19.10.2026); pozostałe PASS: '+report.tests.filter(t=>t.status==='PASS'&&t.verification?.mode!=='manual-reference').length+'. Nie jest to ponowna automatyczna kontrola notatek nowych koszyków.';
 report.tables.push({title:'Potwierdzenia ręczne — osobno od bieżących kontroli automatycznych',headers:['Przypadek','Data potwierdzenia','Źródło','Ograniczenie'],rows:manual.map(t=>[t.id,t.verification.confirmedOn,t.verification.source,t.verification.limitation])});
}
