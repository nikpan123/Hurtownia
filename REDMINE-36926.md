# Redmine #36926 — adresy w drugim kroku koszyka

Typ: **Nowa funkcjonalność**. Zgłoszenie: https://redmine.gwo.pl/issues/36926. Oczekiwania pochodzą ze zrzutów kryteriów akceptacji przekazanych przez użytkownika. Strukturę operacji sprawdzono w aktualnej dokumentacji `GET /api/v2/docs.json` na DEV.

## Kontrakt i warunki

`POST /api/v2/wholesale/checkout-step-two/{tokenValue}` przyjmuje metodę dostawy, adres dostawy i adres faktury. Token jest w URL; testy nie dopisują niewymaganego w zgłoszeniu `orderTokenValue` do body.

Adres dostawy wymaga `company`, `street`, `streetNumber`, `city`, `postcode`, `phoneNumber`. Adres faktury wymaga `company`, `street`, `streetNumber`, `city`, `postcode`, `nip`. `carrierName` jest opcjonalny. Oba adresy mogą mieć `saveToAddressBook` i `isDefault`, domyślnie false.

Aktualne kryterium sukcesu: **HTTP 204 No Content, puste body**. Zmianę z 201 Created potwierdził developer w komentarzu przekazanym przez użytkownika 20.10.2026; zaktualizował również opis zgłoszenia. OpenAPI opisuje model odpowiedzi, więc ewentualna rozbieżność jest raportowana względem wymagań zgłoszenia, a nie automatycznie uznawana za poprawną. Kontrola zapisu używa osobnego GET koszyka i sprawdza pola, a nie sam status.

Przygotowanie: konto 1, kanał WHOLESALE, produkt fizyczny `5lp-1`, ilość 1, dostępna płatność, świeża lista dostępnych dostaw (preferowany GLS). Każdy wykonywany przypadek dostaje osobny koszyk i unikalnie oznaczone dane QA. Nie ma finalizacji, PDF ani wysyłki wiadomości. Koszyki pozostają na DEV.

## Zakres 38 przypadków

| ID | Sprawdzenie |
|---|---|
| HURT-36926-01 | Dokładny status 204 i puste body |
| HURT-36926-02 | Wszystkie wymagane pola dostawy odczytane z koszyka |
| HURT-36926-03 | Wszystkie wymagane pola faktury odczytane z koszyka |
| HURT-36926-04 | Wybrana dostępna metoda dostawy zapisana w koszyku |
| HURT-36926-05 | Pominięcie carrierName i obu flag; brak zmian książki i adresów domyślnych |
| HURT-36926-06 | Dopisek „Przewoźnik: {carrierName}” w order.notes, jeśli dostępny do odczytu |
| HURT-36926-07–18 | Każde pole dostawy osobno: brak właściwości oraz pusty string |
| HURT-36926-19–30 | Każde pole faktury osobno: brak właściwości oraz pusty string |
| HURT-36926-31 | Brak shippingAddress |
| HURT-36926-32 | Brak billingAddress |
| HURT-36926-33 | Brak shippingMethodCode |
| HURT-36926-34 | Metoda dostawy nieobecna na liście dostępnych |
| HURT-36926-35 | Nieistniejący token w URL |
| HURT-36926-36 | Brak segmentu tokenu w URL |
| HURT-36926-37 | Dodanie obu adresów do książki i usunięcie tylko nowych adresów QA |
| HURT-36926-38 | API ustawia oba adresy domyślne; świeży koszyk i CMS potwierdzają ID oraz pola; CMS przywraca oryginalne ID przyciskami „Ustaw” |

Dla braków/pustych pól oczekiwane jest 400 lub 422 i brak zmiany adresów oraz metody dostawy koszyka. Nieznany token wymaga 404; brak segmentu tokenu dopuszcza odrzucenie przez router 404/405. Są to oczekiwania testowe doprecyzowujące „walidację”; screenshot nie definiuje dokładnych statusów błędów.

## Książka i adresy domyślne

Książka jest odczytywana przez `GET shop/addresses` z paginacją. Dla zapisu test zapisuje zbiór istniejących ID, wysyła unikalnie oznaczone adresy, porównuje wynik i usuwa wyłącznie nowe ID odpowiadające oznaczeniu tej próby. Sprzątanie wykonywane jest również po niepowodzeniu zapisu/weryfikacji. Najpierw odczytuje oba ID adresów koszyka, w razie potrzeby zapisuje inne adresy z flagami false (HTTP 204), a potem ponownym GET potwierdza odłączenie. Dopiero wtedy wykonuje DELETE. Brak ID lub nieudane odłączenie blokuje usuwanie, również w ścieżce obsługi błędu. Nie usuwa istniejących adresów.

Próba 37 jest pomijana, jeżeli trwa inny przebieg lub nie można wykluczyć aktywności; zapobiega zmianie kolekcji używanej przez inne testy. Uruchomienie z panelu korzysta z jego blokady jednego przebiegu. Dodatkowe procesy uruchomione poza panelem nie są objęte tą blokadą.

Procedurę CMS wskazał użytkownik 20.10.2026: **Hurtownicy → wybrany hurtownik → Adresy**, osobne przyciski **„Ustaw”** w kolumnach **„Adres płatności”** i **„Adres dostawy”**. Aktualny wybór ma napis „Domyślny adres”. Test odczytuje całą paginowaną listę; nie zakłada, że domyślne adresy znajdują się na pierwszej stronie.

Przypadek 38 wykonuje następujące kroki:

1. Znajduje konto w CMS po dokładnym e-mailu konta używanego przez API i zapisuje ID obu obecnych adresów domyślnych. Wymaga istniejących domyślnych adresów obu rodzajów; nie zgaduje sposobu usunięcia pustego wcześniej ustawienia.
2. Tworzy nowy koszyk i porównuje ID z `defaultShippingAddress` oraz `defaultBillingAddress` w `GET /api/v2/wholesale/checkout-step-two/{tokenValue}` z odczytem CMS.
3. Zapisuje dziennik `.auth/address-defaults-restore.json` przed zmianą. Istniejący dziennik blokuje kolejną próbę.
4. Wysyła nowe, unikalnie oznaczone adresy QA z `saveToAddressBook=true` i `isDefault=true` przez `POST /api/v2/wholesale/checkout-step-two/{tokenValue}`. Wymaga 204 i pustego body.
5. Sprawdza, że oba nowe ID wskazuje CMS oraz GET drugiego kroku kolejnego, świeżego koszyka; porównuje również wymagane pola adresów.
6. W bloku sprzątania przywraca w CMS oryginalny adres płatności i dostawy, używając właściwych przycisków „Ustaw”. Odczyt listy musi potwierdzić oba oryginalne ID. Następny nowy koszyk musi je również zwrócić w API.
7. Odłącza adresy QA od koszyka i usuwa tylko nowe rekordy tej próby, jak w przypadku 37. Nie finalizuje zamówienia.

Przywracanie działa również po błędzie sprawdzenia. Wykrycie innego adresu domyślnego niż oryginalny lub oznaczony przez ten test blokuje nadpisywanie cudzej zmiany. Nieudane przywracanie daje FAIL, zachowuje dziennik i blokuje usuwanie nowych adresów. Awaryjne przywrócenie: `npm run addresses:restore`, po zatrzymaniu innych przebiegów. Nie usuwaj ręcznie dziennika, żeby odblokować test. Blokada panelu i dziennik chronią przebiegi tego projektu; nie blokują równoczesnej ręcznej pracy innego administratora.

To kontrola flagi API `isDefault` oraz przywrócenia ustawień przez CMS. Osobna kontrola początkowej zmiany wyłącznie kliknięciem CMS nie zastępuje sprawdzenia flagi w żądaniu API.

Brak `notes` w GET koszyka nie potwierdza automatycznie zapisu carrierName. Na DEV, po decyzji użytkownika z 20.10.2026, kontrola 06 może mieć **PASS — potwierdzono ręcznie 19.10.2026** na podstawie wcześniejszej kontroli w Syliusie. Raport wskazuje datę, źródło i ograniczenie: notatka nowego koszyka nie została ponownie odczytana automatycznie. Taki PASS jest liczony osobno od bieżących kontroli automatycznych. Nie jest przenoszony na TEST ani inne hosty. Jeśli API zwraca `notes`, automat nadal porównuje rzeczywistą wartość; niezgodność daje FAIL, a potwierdzenie ręczne jej nie maskuje. Błąd bieżącego POST również pozostaje FAIL.

Weryfikacja ręczna użytkownika z 19.10.2026: po wysłaniu `shippingAddress.carrierName` w Postmanie ta sama wartość została pokazana jako „Przewoźnik: …” w sekcji „Uwagi” zapisanego zamówienia w Syliusie. Potwierdza to zapis i prezentację w tym konkretnym przebiegu. Na wyraźne polecenie użytkownika raport `redmine-36926-2026-10-20T06-11-32-370Z-6d4c4120` uzupełniono o ręczny PASS kontroli 06: **37 PASS automatycznych + 1 PASS ręczny**. Pierwotny raport JSON zachowano obok jako `raport.przed-potwierdzeniem-recznym.json`, a historia przeglądu wskazuje poprzedni SKIP i podstawę zmiany. Innych dawnych raportów nie zmieniono.

## Raport i uruchomienie

Weryfikacja przypadku 38 na DEV, 20.10.2026: **PASS**. [Szczegółowy opis dowodów](http://127.0.0.1:18767/reports/redmine-36926-2026-10-20T06-04-10-745Z-b0794ad0-opis/raport.html) przedstawia dane [źródłowego przebiegu](http://127.0.0.1:18767/reports/redmine-36926-2026-10-20T06-04-10-745Z-b0794ad0/raport.html), bez zmiany jego wyników. ID dostawy 10024 → QA 10708 → 10024; ID płatności 10025 → QA 10709 → 10025. Koszyk 6736 potwierdził nowe adresy, koszyk 6737 oryginalne po przywróceniu. Oba nowe adresy QA usunięto z HTTP 204 po odłączeniu. To dowód jednego przypadku, a nie wynik wszystkich 38.

Weryfikacja po zmianie kontraktu, 20.10.2026: [raport dwóch przypadków 01 i 37](http://127.0.0.1:18767/reports/redmine-36926-2026-10-20T05-47-49-787Z-970deafc/raport.html) — **2 PASS**. Potwierdzono HTTP 204 z pustym body oraz zapis i sprzątnięcie dwóch nowych adresów QA. DELETE wykonano dopiero po odłączeniu i odczycie ID adresów koszyka; oba usunięcia zwróciły 204. To ponowienie tych dwóch przypadków, nie pełnych 38. Historyczne raporty nie zostały zmienione.

Panel Hurtowni: **Sprawdź #36926** (po ponownym uruchomieniu serwera, jeżeli nie zna nowej definicji). Alternatywa: `Testuj-Redmine-36926-dev.cmd` lub `npm run redmine:36926`.

Raporty HTML/JSON w `raporty-api/redmine-36926-*` zawierają wejścia, statusy, odczytane adresy, ID koszyków, wynik każdej kontroli i powiązane żądania. Hasła i tokeny są maskowane. Raport z rzeczywistego wykonania jest dowodem; kontrole na atrapach w `tests/redmine-36926.test.mjs` sprawdzają jedynie mechanizm testujący.

Wynik FAIL oznacza co najmniej jedną niezgodność lub niemożność wykonania kontroli. INCOMPLETE oznacza brak niezgodności w wykonanych przypadkach, ale pozostałe SKIP. Nie jest to pełne potwierdzenie funkcjonalności.

Po zakończeniu wykonania raport można przypiąć do #36926 w Centrum. Zachowaj rzeczywiste wyniki i przyczyny SKIP. Nie zmieniaj historycznych raportów po zmianie implementacji testu.

## Poza zakresem

Izolacja drugiego konta, inne kanały, walidacja typów JSON/null/formatów telefonu i NIP, duplikaty w książce przy ponowieniu, szczegółowa atomowość całej bazy, finalizacja oraz integracja z transferem. Nieznany token sprawdza brak zasobu, a nie ochronę przed dostępem do koszyka innego klienta.

## Wykonanie DEV — 16.10.2026

Pierwszy raport `redmine-36926-2026-10-16T11-31-22-650Z-ceddd1a5`: 30 PASS, 6 FAIL, 2 SKIP. Potwierdzone rozbieżności względem kryteriów: body `[]` zamiast pustego oraz HTTP 500 dla braku `shippingAddress`, braku `billingAddress` i niedostępnej metody dostawy.

Dwa inne niepowodzenia wymagały doprecyzowania metody kontroli. GET drugiego kroku zapisanego koszyka preferuje adres koszyka, dlatego domyślne adresy kanału należy porównywać na świeżym koszyku. Przed usunięciem adresu zapisanego do książki trzeba też odłączyć go od testowego koszyka — bezpośrednie DELETE zwracało 500 z naruszeniem klucza obcego. Usunięto pierwotne wpisy QA 10565/10566 po odłączeniu. Po poprawieniu kontroli i sprzątania powtórzenie 05 oraz 37 dało **2 PASS** (`redmine-36926-2026-10-16T11-41-18-821Z-96a196e7`); usunięto również wpisy QA 10571/10572 z powtórzenia.

Niezależny SELECT `order.notes` koszyka 6428 potwierdził dokładny dopisek przewoźnika — **PASS** kontroli 06 w osobnym raporcie `redmine-36926-notes-2026-10-16T11-47-50-608Z-a6aed7f1`. GET koszyka nadal nie stanowi źródła tego pola.

`isDefault=true` pozostaje nieprzetestowane. Nie zmieniono historycznych raportów. Wszystkie trzy raporty oraz wyjaśnienie są przypięte do #36926 w Centrum. Nie potwierdzono pełnej akceptacji funkcjonalności; pozostają cztery niezgodności i zakres adresów domyślnych. Numer wdrożenia nieznany.
