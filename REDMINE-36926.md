# Redmine #36926 — adresy w drugim kroku koszyka

Typ: **Nowa funkcjonalność**. Zgłoszenie: https://redmine.gwo.pl/issues/36926. Oczekiwania pochodzą ze zrzutów kryteriów akceptacji przekazanych przez użytkownika. Strukturę operacji sprawdzono w aktualnej dokumentacji `GET /api/v2/docs.json` na DEV.

## Kontrakt i warunki

`POST /api/v2/wholesale/checkout-step-two/{tokenValue}` przyjmuje metodę dostawy, adres dostawy i adres faktury. Token jest w URL; testy nie dopisują niewymaganego w zgłoszeniu `orderTokenValue` do body.

Adres dostawy wymaga `company`, `street`, `streetNumber`, `city`, `postcode`, `phoneNumber`. Adres faktury wymaga `company`, `street`, `streetNumber`, `city`, `postcode`, `nip`. `carrierName` jest opcjonalny. Oba adresy mogą mieć `saveToAddressBook` i `isDefault`, domyślnie false.

Kryterium sukcesu ze zgłoszenia: **HTTP 201, puste body**. OpenAPI opisuje model odpowiedzi, więc ewentualna rozbieżność jest raportowana względem wymagań zgłoszenia, a nie automatycznie uznawana za poprawną. Kontrola zapisu używa osobnego GET koszyka i sprawdza pola, a nie sam status.

Przygotowanie: konto 1, kanał WHOLESALE, produkt fizyczny `5lp-1`, ilość 1, dostępna płatność, świeża lista dostępnych dostaw (preferowany GLS). Każdy wykonywany przypadek dostaje osobny koszyk i unikalnie oznaczone dane QA. Nie ma finalizacji, PDF ani wysyłki wiadomości. Koszyki pozostają na DEV.

## Zakres 38 przypadków

| ID | Sprawdzenie |
|---|---|
| HURT-36926-01 | Dokładny status 201 i puste body |
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
| HURT-36926-38 | Ustawianie i aktualizacja domyślnych — SKIP do zapewnienia pełnego przywrócenia powiązań |

Dla braków/pustych pól oczekiwane jest 400 lub 422 i brak zmiany adresów oraz metody dostawy koszyka. Nieznany token wymaga 404; brak segmentu tokenu dopuszcza odrzucenie przez router 404/405. Są to oczekiwania testowe doprecyzowujące „walidację”; screenshot nie definiuje dokładnych statusów błędów.

## Książka i adresy domyślne

Książka jest odczytywana przez `GET shop/addresses` z paginacją. Dla zapisu test zapisuje zbiór istniejących ID, wysyła unikalnie oznaczone adresy, porównuje wynik i usuwa wyłącznie nowe ID odpowiadające oznaczeniu tej próby. Sprzątanie wykonywane jest również po niepowodzeniu zapisu/weryfikacji. Nie usuwa istniejących adresów.

Próba 37 jest pomijana, jeżeli trwa inny przebieg lub nie można wykluczyć aktywności; zapobiega zmianie kolekcji używanej przez inne testy. Uruchomienie z panelu korzysta z jego blokady jednego przebiegu. Dodatkowe procesy uruchomione poza panelem nie są objęte tą blokadą.

Odczyt drugiego kroku udostępnia `defaultShippingAddress` i `defaultBillingAddress`, ale nie potwierdzono operacji przywracającej oryginalne powiązanie `CustomerDefaultAddress` wraz z tożsamością adresu. Nie ustawiamy `isDefault=true` na współdzielonym koncie i nie raportujemy tego kryterium jako zaliczonego. Samo odtworzenie tekstowych pól nie gwarantuje przywrócenia wcześniejszego powiązania. Do domknięcia potrzebne jest osobne konto lub sprawdzona procedura przywrócenia.

Brak `notes` w GET koszyka daje SKIP kontroli carrierName, nie PASS. W takim przypadku potrzebny jest niezależny odczyt `order.notes` z backendu/bazy; samo przesłanie pola nie potwierdza zapisu.

## Raport i uruchomienie

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
