# Scenariusze testowe API i funkcji księgarni

Aktualizacja: 2026-10-19

Koszyk hurtowy oraz opisy produktów w kanałach sprzedaży. Katalog wymagań i pokrycia kodem; wynik konkretnego wykonania znajduje się w raporcie.

**To katalog scenariuszy, a nie raport wykonania.** Status automatyzacji opisuje dostępny kod; nie oznacza wyniku PASS.

## Warunki wspólne

- Testy wykonuj na DEV. Środowisko gwotest wymaga wdrożenia zmian i osobnego dopuszczenia.
- Dane dostępowe, token testowy i sesję GitLab przechowuj lokalnie. Dokument nie zawiera prawdziwych haseł ani JWT.
- Każdy niezależny przypadek i wariant negatywny zaczynaj od nowego koszyka. Nie współdziel koszyka między próbami izolacji.
- Przed porównaniem skutków ustabilizuj poprawny stan koszyka i zapisz wybrane metody oraz rabaty.
- Potwierdź aktualne dane produktu, ceny, VAT, grupę i rabaty kont w CMS. Wartości przykładowe nie zastępują aktualnego wzorca.
- Zapis zamówienia, e-mail i transfer są wykonywane tylko na dedykowanych kontach testowych. Odczyt bazy wymaga osobnego dostępu.
- Źródło: przekazany opis „Zarządzanie opisami produktów per kanał (EMPIK, WHOLESALE)”, 19.10.2026.
- EMPIK nie jest kanałem do testowania przez shop API. Brak jego serwera testowego nie daje podstawy do aktualizacji produkcyjnej oferty.

## Zasady interpretacji

- Opis automatyzacji mówi o pokryciu kodem, nie o bieżącym wyniku API. Żaden przypadek nie uzyskuje PASS przez samo umieszczenie w katalogu.
- Wykonanie zapisuj jako PASS, FAIL, SKIP lub BLOCKED. W raportach narzędzia brak warunku bywa zapisany jako SKIP z przyczyną.
- INCOMPLETE opisuje niepełne pokrycie przebiegu bez FAIL. Liczby przypadków w katalogu nie są liczbą asercji ani nowych zamówień.
- Dla negatywnego żądania oceniaj osobno brak przyjęcia danych, status HTTP oraz brak nieoczekiwanej zmiany koszyka.
- HTTP 403/404 w izolacji nie wystarcza: wymagany jest również niezmieniony stan właściciela.
- Powrót prawidłowej kwoty przy complete nie usuwa błędu wcześniejszego podsumowania. Bieżący koszyk i utrwalone zamówienie oceniaj osobno.
- Pobranie pliku PDF nie potwierdza jego treści ani dostarczenia e-maila.
- Znane obserwacje z 16.10.2026 są punktami do ponownej weryfikacji, a nie deklaracją aktualnego stanu serwera.
- RETAIL i ACADEMY zawsze korzystają z ProductTranslation. ProductChannelTranslation dotyczy WHOLESALE i EMPIK.
- PASS odpowiedzi API nie potwierdza formularza CMS, frontendu, treści PDF, e-maila ani OfferUpdater.

## Przygotowanie danych

- Przykładowy zestaw A: przelew 23%, odbiór 50%, przelew 1-dniowy 75%, terminowa 25%, Adamada 10%.
- Przykładowy zestaw B: 47%, 13%, 30.5%, 90%, Adamada 20% w tej samej kolejności.
- Własny użytkownik ma rabaty odczytywane z CMS; nie wolno przypisywać mu automatycznie wzorca A lub B.
- Przykładowy GLS: W=8000 g, produkt 210 g. Uzupełnij potwierdzone przedziały i ceny, VAT oraz dopłatę płatności przed sprawdzaniem kosztu.
- Wzorce w config/catalog-fixtures.local.json muszą pochodzić z CMS: produkt fallback oraz produkt z odmiennym WHOLESALE.
- variantName wymaga niezależnej wartości w fixture; jej brak powoduje SKIP.
- Historyczny przebieg DEV z 16.10.2026: 18 PASS, 11 SKIP. To historyczny dowód zakresu API, nie aktualny wynik wszystkich 29 scenariuszy.
- Kursy ACADEMY: courses.closed i courses.paid. Puste expected daje SKIP; itemsPath/identityPath/titlePath/slugPath i query należy potwierdzić na rzeczywistej odpowiedzi. Przykład konfiguracji: config/catalog-fixtures.example.json.
- Zestaw descriptions-cms ma osobną konfigurację description-cms.local.json i plik awaryjnego przywracania .auth/description-cms-restore.json. Nie edytuj równocześnie produktu QA.
- 19.10.2026: zestaw formularza CMS wykonał 15 kontroli PASS, łącznie z potwierdzeniem przywrócenia pól QA. Nazwy obu wariantów QA są zdefiniowane; brak variantName w odpowiedzi API koszyka daje FAIL, a nie SKIP.

## Legenda

- **Obsługiwane przez automat** (automated)

- **Częściowo obsługiwane** (partial)

- **Do automatyzacji** (planned)

- **P0**: Najpierw: poprawność zakupu i izolacja kont.

- **P1**: Podstawowa regresja, walidacja i integracje.

- **P2**: Odtwarzalność i czytelność obsługi.

## Spis scenariuszy

| ID | Scenariusz | Priorytet | Automatyzacja |
| --- | --- | --- | --- |
| AUTH-001 | Poprawne logowanie hurtownika | P0 | Obsługiwane przez automat |
| AUTH-002 | Niepoprawne hasło API | P1 | Obsługiwane przez automat |
| AUTH-003 | Żądanie chronione bez ważnego JWT | P1 | Obsługiwane przez automat |
| CART-001 | Utworzenie i odczyt pustego koszyka | P0 | Obsługiwane przez automat |
| CART-002 | Dodanie pojedynczego produktu | P0 | Obsługiwane przez automat |
| CART-003 | Kilka produktów z tej samej grupy | P0 | Obsługiwane przez automat |
| CART-004 | Ponowne dodanie tego samego produktu | P1 | Obsługiwane przez automat |
| CART-005 | Zmiana ilości po wyborze płatności | P0 | Obsługiwane przez automat |
| CART-006 | Usunięcie pozycji z koszyka | P1 | Obsługiwane przez automat |
| CART-007 | Nieprawidłowa ilość produktu | P1 | Obsługiwane przez automat |
| CART-008 | Nieistniejący kod produktu | P1 | Obsługiwane przez automat |
| CART-009 | Losowanie produktów i powtórzenie przebiegu | P2 | Obsługiwane przez automat |
| CART-010 | Przekroczenie potwierdzonego zapasu | P1 | Obsługiwane przez automat |
| PAY-001 | Lista dostępnych płatności | P0 | Częściowo obsługiwane |
| PAY-002 | Rabaty zwykłych produktów dla obu kont | P0 | Obsługiwane przez automat |
| PAY-003 | Rabat Adamady dla wszystkich dostępnych płatności | P0 | Obsługiwane przez automat |
| PAY-004 | Zmiana dostępnej płatności w tym samym koszyku | P1 | Obsługiwane przez automat |
| PAY-005 | Nieistniejąca metoda płatności | P1 | Obsługiwane przez automat |
| PAY-006 | Istniejąca płatność niedozwolona hurtownikowi | P1 | Obsługiwane przez automat |
| PAY-007 | Zaokrąglenia według wzorca starej hurtowni | P1 | Częściowo obsługiwane |
| SHIP-001 | Dostawy dostępne po wyborze płatności | P0 | Obsługiwane przez automat |
| SHIP-002 | Zapis dostawy i poprawnych adresów | P0 | Obsługiwane przez automat |
| SHIP-003 | Niekompletny adres dostawy | P1 | Obsługiwane przez automat |
| SHIP-004 | Nieistniejąca dostawa | P1 | Obsługiwane przez automat |
| PACK-001 | Granice wagi i liczba paczek GLS | P1 | Częściowo obsługiwane |
| PACK-002 | Ceny paczek i dopłata do płatności | P1 | Obsługiwane przez automat |
| PACK-003 | Zmniejszenie ilości zmniejsza koszt paczek | P1 | Obsługiwane przez automat |
| PACK-004 | Zmiana GLS na dostawę bez kalkulatora paczek | P1 | Obsługiwane przez automat |
| PACK-005 | Tymczasowy cennik GLS i przywrócenie CMS | P1 | Częściowo obsługiwane |
| ORD-001 | Zapis poprawnego zamówienia | P0 | Obsługiwane przez automat |
| ORD-002 | Pusty koszyk nie może zostać zatwierdzony | P1 | Obsługiwane przez automat |
| ORD-003 | Blokada zamówienia mieszanego Adamada i pozostałe | P0 | Obsługiwane przez automat |
| ORD-004 | Powtórne zatwierdzenie i utrata odpowiedzi | P1 | Częściowo obsługiwane |
| ORD-005 | Potwierdzenie PDF i informacje po zakupie | P1 | Częściowo obsługiwane |
| ISO-001 | Dwa konta mają odrębne logowanie i wzorce rabatów | P0 | Obsługiwane przez automat |
| ISO-002 | Obce konto odczytuje cudzy koszyk | P0 | Obsługiwane przez automat |
| ISO-003 | Obce konto odczytuje płatności lub dostawy | P0 | Obsługiwane przez automat |
| ISO-004 | Obce konto modyfikuje produkty koszyka | P0 | Obsługiwane przez automat |
| ISO-005 | Obce konto zmienia płatność lub dostawę | P0 | Obsługiwane przez automat |
| ISO-006 | Wycena po obcym żądaniu i po finalizacji | P0 | Częściowo obsługiwane |
| DB-001 | Porównanie zapisanego zamówienia z Syliusem i transferem | P1 | Obsługiwane przez automat |
| DB-002 | Paczki w przesyłce i koszt KWys w transferze | P1 | Obsługiwane przez automat |
| REPORT-001 | Czytelny raport i rozróżnienie wyników | P2 | Częściowo obsługiwane |
| REPORT-002 | Różnice netto bez potwierdzonej reguły zaokrągleń | P1 | Obsługiwane przez automat |
| DESC-001 | Zakładka kanałowa i dostępne EMPIK/WHOLESALE | P1 | Częściowo obsługiwane |
| DESC-002 | Ukrycie zakładki dla ofert i szkoleń | P1 | Do automatyzacji |
| DESC-003 | Edycja i trwały zapis czterech pól kanałowych | P1 | Częściowo obsługiwane |
| DESC-004 | Puste pola i fallback każdego pola osobno | P1 | Częściowo obsługiwane |
| DESC-005 | Kolizja slugu w tym samym kanale | P1 | Częściowo obsługiwane |
| DESC-006 | Slug kanałowy równy głównemu slugowi | P1 | Częściowo obsługiwane |
| DESC-007 | Ten sam slug w EMPIK i WHOLESALE | P1 | Częściowo obsługiwane |
| DESC-008 | Minimalna długość nazwy kanałowej | P1 | Częściowo obsługiwane |
| DESC-009 | Maksymalna długość slugu kanałowego | P1 | Częściowo obsługiwane |
| DESC-010 | Nowy produkt bez tłumaczeń i ich późniejsze dodanie | P1 | Do automatyzacji |
| DESC-011 | WHOLESALE — nazwa i slug na liście, nadpisanie i fallback | P0 | Obsługiwane przez automat |
| DESC-012 | WHOLESALE — cztery pola szczegółów, nadpisanie i fallback | P0 | Obsługiwane przez automat |
| DESC-013 | RETAIL — główne tłumaczenia w API | P0 | Obsługiwane przez automat |
| DESC-014 | ACADEMY — główne tłumaczenia na liście i w szczegółach | P0 | Obsługiwane przez automat |
| DESC-015 | WHOLESALE — productName w koszyku | P0 | Obsługiwane przez automat |
| DESC-016 | ACADEMY — productName w koszyku | P0 | Obsługiwane przez automat |
| DESC-017 | Nazwa wariantu w pozycjach API | P1 | Częściowo obsługiwane |
| DESC-018 | ACADEMY — closed-courses | P1 | Częściowo obsługiwane |
| DESC-019 | ACADEMY — paid-courses | P1 | Częściowo obsługiwane |
| DESC-020 | RETAIL — strona, listy, wyszukiwanie i paginacja | P1 | Do automatyzacji |
| DESC-021 | RETAIL — koszyk, podsumowanie i zapis nazwy | P1 | Częściowo obsługiwane |
| DESC-022 | RETAIL — opis SpecialOffer | P1 | Do automatyzacji |
| DESC-023 | RETAIL — opis Application i liczby dostępów | P1 | Do automatyzacji |
| DESC-024 | Nazwy produktów w treści PDF | P1 | Do automatyzacji |
| DESC-025 | Nazwy w e-mailach i powiadomieniach | P1 | Do automatyzacji |
| DESC-026 | Generowanie URL dla wszystkich kanałów | P1 | Do automatyzacji |
| DESC-027 | Tłumaczenia produktów dołączonych do oferty | P1 | Do automatyzacji |
| DESC-028 | EMPIK — dane oferty przekazane przez OfferUpdater | P1 | Do automatyzacji |
| DESC-029 | OutOfStockSubscriber — nazwa w RETAIL | P1 | Do automatyzacji |

## Logowanie i dostęp

### AUTH-001 — Poprawne logowanie hurtownika

**P0 · Obsługiwane przez automat · Odczyt**

**Warunki wstępne**

- Ważna sesja GitLab i aktywne konto hurtownika A.

**Dane**

Konto A; dane dostępowe uzupełnione lokalnie.

**Kroki**

1. Wyślij POST /shop/authentication-token z email i apiPassword.
2. Sprawdź odpowiedź i zapisz otrzymany JWT.
3. Użyj JWT A do utworzenia własnego koszyka.

**Oczekiwany wynik**

- Logowanie zwraca HTTP 200 i niepusty token.
- Odpowiedź jest JSON, a nie stroną logowania GitLab.
- Token pozwala wykonać operację konta A.

**Odpowiadający test**

Koszyk / regresja

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`

### AUTH-002 — Niepoprawne hasło API

**P1 · Obsługiwane przez automat · Odczyt**

**Warunki wstępne**

- Ważna bramka GitLab; znany poprawny adres konta.

**Dane**

Prawidłowy e-mail, celowo błędne apiPassword.

**Kroki**

1. Potwierdź poprawne logowanie konta i działanie bramki.
2. Wyślij jedną próbę logowania z losowym błędnym hasłem API.
3. Sprawdź HTTP 401 i brak JWT w odpowiedzi.

**Oczekiwany wynik**

- Dla uzgodnionego kontraktu logowania: kontrolowana odmowa, typowo HTTP 401.
- Brak tokenu umożliwiającego działanie jako użytkownik.
- Brak HTTP 500 i ujawnienia danych dostępowych.

**Odpowiadający test**

Regresja — AUTH-002

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `api-tests/regression-access.mjs`
- `tests/regression-access.test.mjs`
- `tests/order-regression.test.mjs`

**Ograniczenia:** Jedna błędna próba na przebieg. Nie bada blokady konta po wielu próbach ani limitowania żądań.

### AUTH-003 — Żądanie chronione bez ważnego JWT

**P1 · Obsługiwane przez automat · Odczyt**

**Warunki wstępne**

- Potwierdzony wymóg JWT dla badanego endpointu WHOLESALE.
- Istniejący koszyk A; sprawna bramka GitLab.

**Dane**

GET koszyka, GET płatności i GET dostaw. Dla każdego: brak JWT oraz celowo błędny JWT, łącznie sześć prób.

**Kroki**

1. Zapisz stan koszyka jako A.
2. Wyślij żądanie bez JWT; powtórz na nowym koszyku z nieważnym JWT.
3. Odczytaj stan jako A po każdej próbie.

**Oczekiwany wynik**

- Każdy endpoint jest najpierw dostępny dla właściciela (HTTP 200).
- Brak JWT i błędny JWT dają HTTP 401 bez danych koszyka i list metod.
- Wycena, metody i udostępnione adresy właściciela pozostają bez zmian.

**Odpowiadający test**

Regresja — AUTH-003 (6 prób)

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `api-tests/regression-access.mjs`
- `tests/regression-access.test.mjs`
- `tests/order-regression.test.mjs`

**Ograniczenia:** Nie bada naturalnego wygasania poprawnie podpisanego JWT. HTTP 401 jest jawnym oczekiwaniem ochrony tych endpointów; nie jest to izolacja dwóch zalogowanych kont.

## Produkty i ilości

### CART-001 — Utworzenie i odczyt pustego koszyka

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Konto A zalogowane.

**Dane**

POST /shop/orders, body {"localeCode":"pl_PL"}.

**Kroki**

1. Utwórz nowy koszyk jako A.
2. Zapisz id i tokenValue.
3. Odczytaj GET /shop/orders/{token_A} przed dodaniem produktów.

**Oczekiwany wynik**

- POST zwraca nowy identyfikator i token.
- GET zwraca HTTP 200 i pustą listę produktów.
- Brak HTTP 500 z powodu nieutworzonej przesyłki.

**Odpowiadający test**

Regresja — utworzenie i dwukrotny odczyt pustego koszyka

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `tests/order-regression.test.mjs`

**Ograniczenia:** Sprawdzany także bez finalizacji. Osobny przypadek w wariancie z zapisem sprawdza odmowę complete pustego koszyka.

### CART-002 — Dodanie pojedynczego produktu

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Nowy koszyk A; produkt dostępny w WHOLESALE.

**Dane**

5lp-1, quantity=1; kod wariantu potwierdzony w API.

**Kroki**

1. Wyślij POST /shop/orders/{token_A}/items/bulk.
2. Dodaj jedną pozycję productVariant=5lp-1, quantity=1.
3. Odczytaj koszyk.

**Oczekiwany wynik**

- Odpowiedź operacji odpowiada kontraktowi sukcesu; GET zwraca dodaną pozycję.
- Kod, ilość i tożsamość koszyka są prawidłowe.
- itemsTotal jest sumą total pozycji, a total obejmuje produkty i zwrócony shippingTotal.

**Odpowiadający test**

Koszyk / regresja

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`
- `api-tests/order-regression.mjs`

### CART-003 — Kilka produktów z tej samej grupy

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Dostępne co najmniej dwa produkty jednej grupy.

**Dane**

Osobne wykonania: 5lp-1 + POP1 oraz D087 + D090.

**Kroki**

1. Utwórz nowy koszyk dla wskazanej grupy.
2. Dodaj dwa różne warianty w jednym żądaniu bulk.
3. Odczytaj pozycje i sumy.

**Oczekiwany wynik**

- W koszyku znajdują się oba produkty z właściwymi ilościami.
- Nie dodano produktu z innej grupy.
- Sumy i później zastosowany rabat odpowiadają wybranej grupie i kontu.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### CART-004 — Ponowne dodanie tego samego produktu

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Koszyk z jednym produktem w ilości 1.

**Dane**

Ten sam productVariant dodany drugi raz z quantity=1.

**Kroki**

1. Dodaj produkt do koszyka.
2. Ponów dodanie tego samego wariantu.
3. Odczytaj pozycje.

**Oczekiwany wynik**

- Ilość tego wariantu wynosi 2.
- Nie powstaje nieoczekiwana druga pozycja tego samego wariantu.
- Sumy uwzględniają łączną ilość.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### CART-005 — Zmiana ilości po wyborze płatności

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Koszyk z produktem i wybraną dostępną płatnością.

**Dane**

quantity kolejno 2, 6, 1; osobno obie grupy produktów.

**Kroki**

1. Zapisz płatność i odczytaj rabat.
2. Dla każdej ilości wyślij PATCH /shop/orders/{token_A}/items/{item_id}.
3. Po każdej zmianie ponownie odczytaj koszyk.

**Oczekiwany wynik**

- Każdy odczyt pokazuje nową ilość.
- Rabat pozostaje zgodny z kontem, grupą i płatnością.
- Suma produktów oraz total odpowiadają aktualnym ilościom; nie używa się poprzedniej sumy.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### CART-006 — Usunięcie pozycji z koszyka

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Koszyk z dwoma różnymi produktami jednej grupy.

**Dane**

DELETE /shop/orders/{token_A}/items/{item_id}.

**Kroki**

1. Zapisz identyfikatory obu pozycji i sumy.
2. Usuń jedną pozycję przez DELETE.
3. Odczytaj koszyk.

**Oczekiwany wynik**

- Usunięta pozycja nie występuje w odpowiedzi.
- Druga pozycja pozostaje z prawidłową ilością.
- Sumy są przeliczone dla pozostałego produktu.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### CART-007 — Nieprawidłowa ilość produktu

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Świeży koszyk z jedną poprawną pozycją dla każdego wariantu.

**Dane**

quantity=-1, 0, 1.5; każda wartość osobno dla obu grup.

**Kroki**

1. Odczytaj stan przed próbą.
2. Wyślij PATCH ilości z badaną wartością.
3. Zapisz status HTTP i odczytaj koszyk jako właściciel.
4. Oceń osobno odrzucenie wartości i sposób obsługi błędu.

**Oczekiwany wynik**

- Ilość i pozostałe dane koszyka nie zmieniają się.
- API zwraca uzgodniony status walidacji, obecnie oczekiwane 400 lub 422.
- Odrzucenie 1.5 przy HTTP 500 oznacza poprawny brak przyjęcia wartości, ale błąd obsługi żądania; cały przypadek nie jest pełnym PASS.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

**Ograniczenia:** Obecny raport może agregować obie kontrole w jeden FAIL. Przy analizie opisz oba warunki osobno.

### CART-008 — Nieistniejący kod produktu

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Świeży koszyk z poprawną pozycją.

**Dane**

productVariant=qa-nonexistent-{unikalny_id}, quantity=1.

**Kroki**

1. Odczytaj koszyk.
2. Spróbuj dodać nieistniejący wariant przez items/bulk.
3. Odczytaj koszyk ponownie.

**Oczekiwany wynik**

- Kontrolowana odmowa 400, 404 lub 422 zgodnie z konfiguracją kontraktu.
- Brak nowej pozycji i nieoczekiwanej zmiany istniejących produktów lub wyceny.
- HTTP 500 nie jest zaliczaną walidacją.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### CART-009 — Losowanie produktów i powtórzenie przebiegu

**P2 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Stała pula produktów i niezmienione ustawienia losowania.

**Dane**

Ziarno zapisane w raporcie; grupy Adamada i pozostałe.

**Kroki**

1. Uruchom koszyk z losowaniem i zapisz ziarno oraz plan.
2. Uruchom ponownie z tym samym ziarnem i identyczną pulą danych.
3. Porównaj produkty, ilości i plan wyboru metod.

**Oczekiwany wynik**

- Plan losowania odtwarza się przy tej samej puli i ustawieniach.
- Każdy wygenerowany koszyk ma jedną grupę; Adamada nie jest mieszana z pozostałymi.
- Wybrane metody należą do aktualnych odpowiedzi API; zmiana dostępności może zmienić wybór metod i wymaga odnotowania.

**Odpowiadający test**

Koszyk z ziarnem

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/products.mjs`
- `api-tests/checkout.mjs`
- `api-tests/engine.mjs`

### CART-010 — Przekroczenie potwierdzonego zapasu

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Produkt fizyczny z aktywną kontrolą zapasu i wyłączonym backorder.
- Niezależnie potwierdzony aktualny zapas 1–999 sztuk.

**Dane**

stockFixture: {productVariant, availableQuantity, source}. Próba ilości availableQuantity + 1.

**Kroki**

1. Utwórz nowy koszyk i dodaj jedną sztukę produktu.
2. Zapisz stan koszyka.
3. Wyślij PATCH ilości powyżej potwierdzonego zapasu.
4. Odczytaj koszyk i porównaj stan.

**Oczekiwany wynik**

- Odmowa HTTP 400/422 lub uzgodniony status validationStatuses.stock.
- Koszyk pozostaje niezmieniony; nie wykonano complete.

**Odpowiadający test**

Regresja — przekroczenie potwierdzonego zapasu

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `tests/order-regression.test.mjs`

**Ograniczenia:** Brak potwierdzonego stanu magazynowego daje SKIP. Zapas i brak backorder potwierdź przed uruchomieniem; współbieżne zmiany zapasu mogą unieważnić wzorzec.

## Płatności i rabaty

### PAY-001 — Lista dostępnych płatności

**P0 · Częściowo obsługiwane · Zmiana koszyka**

**Warunki wstępne**

- Koszyk A z produktem.
- Dla kontroli uprawnień: niezależnie potwierdzona lista metod konta.

**Dane**

GET /wholesale/orders/{token_A}/payments.

**Kroki**

1. Pobierz oferty płatności.
2. Sprawdź code, nazwę, rabat i orderItemTotal.
3. Porównaj dostępność z ustawieniami hurtownika, gdy zapisano niezależny wzorzec.

**Oczekiwany wynik**

- Niepusta lista z unikalnymi kodami i poprawnymi typami pól.
- Rabaty mają zakres 0–100, kwoty są całkowitymi groszami.
- Przy skonfigurowanej liście uprawnień nie ma brakujących ani dodatkowych metod.

**Odpowiadający test**

Koszyk / regresja

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`
- `api-tests/order-regression.mjs`

**Ograniczenia:** Sama lista API nie jest niezależnym dowodem poprawnych uprawnień. Bez wzorca lista uprawnień pozostaje niesprawdzona.

### PAY-002 — Rabaty zwykłych produktów dla obu kont

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Rabaty obu kont potwierdzone w CMS lub wzorcach konfiguracji.

**Dane**

A: przelew 23%, odbiór 50%, przelew 1-dniowy 75%, terminowa 25%. B: 47%, 13%, 30.5%, 90%. Wartości są przykładowym zestawem referencyjnym i wymagają potwierdzenia przed uruchomieniem.

**Kroki**

1. Dla każdej dostępnej płatności pobierz jej ofertę.
2. Wybierz ją w koszyku zwykłych produktów.
3. Odczytaj rabaty pozycji i porównaj z niezależnym wzorcem.
4. Powtórz na drugim koncie.

**Oczekiwany wynik**

- Oferta i pozycje stosują rabat właściwego konta i metody.
- Niedostępnej metody nie wybiera się poza listą; jej pokrycie jest odnotowane jako pominięte.

**Odpowiadający test**

Regresja / drugie konto

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `api-tests/second-account.mjs`

### PAY-003 — Rabat Adamady dla wszystkich dostępnych płatności

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Koszyk zawiera wyłącznie produkty Adamada.
- Potwierdzony indywidualny rabat Adamady konta.

**Dane**

Przykładowo A=10%, B=20%; użytkownik własny może mieć np. 0%.

**Kroki**

1. Pobierz wszystkie dostępne płatności.
2. Sprawdź rebatePercent każdej oferty.
3. Wybieraj dostępne płatności i po każdej zmianie odczytaj pozycje.

**Oczekiwany wynik**

- Każda oferta i każda pozycja stosuje indywidualny rabat Adamady, niezależnie od standardowego rabatu danej płatności.
- Nie zakłada się stałego rabatu 10% dla wszystkich hurtowników.

**Odpowiadający test**

Koszyk / regresja / drugie konto

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`
- `api-tests/order-regression.mjs`
- `api-tests/second-account.mjs`

### PAY-004 — Zmiana dostępnej płatności w tym samym koszyku

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Co najmniej dwie płatności oferowane danemu kontu.

**Dane**

Zwykły produkt; kolejne metody z różnymi rabatami.

**Kroki**

1. Wybierz pierwszą płatność i zapisz kwoty.
2. Zmień ją na drugą przez payment-method.
3. Odczytaj kod metody, rabat i sumy.
4. Wróć do pierwszej metody i odczytaj ponownie.

**Oczekiwany wynik**

- Zapisany kod odpowiada ostatniemu wyborowi.
- Promocje nie sumują się ze starym rabatem; wycena odpowiada aktualnej metodzie.
- Dostawy pobrano ponownie dla aktualnej płatności.

**Odpowiadający test**

Regresja — kolejne metody i powrót do pierwszej

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/second-account.mjs`
- `api-tests/order-regression.mjs`

**Ograniczenia:** Wymaga co najmniej dwóch dostępnych metod; brak daje SKIP. Po każdym wyborze pobierane są aktualne dostawy.

### PAY-005 — Nieistniejąca metoda płatności

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Nowy koszyk dla każdej grupy.

**Dane**

paymentMethodCode=qa-nonexistent-{unikalny_id}.

**Kroki**

1. Przygotuj i zapisz stabilny stan początkowy koszyka.
2. Wyślij PATCH /wholesale/orders/{token_A}/payment-method z nieistniejącym kodem.
3. Odczytaj koszyk i status operacji.

**Oczekiwany wynik**

- Status walidacji 400, 404 lub 422 według kontraktu.
- Brak zapisania nieistniejącej metody i nieoczekiwanej zmiany rabatu lub kwot.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

**Ograniczenia:** Przy zmianie ceny sprawdź także, czy stan początkowy był już w pełni przeliczony. Samo HTTP 500 pozostaje błędem obsługi żądania.

### PAY-006 — Istniejąca płatność niedozwolona hurtownikowi

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Niezależnie potwierdzony kod metody istniejącej w systemie, ale niedostępnej dla A.

**Dane**

forbiddenPayments: [{code, source}] w order-regression.local.json; source dokumentuje potwierdzone istnienie metody w CMS.

**Kroki**

1. Potwierdź brak metody w ofertach A.
2. Wyślij bezpośrednią próbę ustawienia tej metody jako A.
3. Odczytaj koszyk i porównaj z początkowym stanem.

**Oczekiwany wynik**

- Metoda nie jest oferowana i bezpośrednie przypisanie zostaje odrzucone.
- Płatność i kwoty pozostają niezmienione.

**Odpowiadający test**

Regresja — istniejąca niedostępna płatność

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `tests/order-regression.test.mjs`

**Ograniczenia:** Bez potwierdzonego kodu i źródła przypadek ma SKIP. Losowy nieistniejący kod nie zastępuje tej kontroli uprawnień.

### PAY-007 — Zaokrąglenia według wzorca starej hurtowni

**P1 · Częściowo obsługiwane · Zmiana koszyka**

**Warunki wstępne**

- Produkt referencyjny 18.40 zł brutto, VAT 5%, cena oryginalna równa cenie, minimum price=0.
- Dostępna płatność z potwierdzonym rabatem 23%.

**Dane**

Ilości 1–10; wartości wzorcowe dla 1 i 6 sztuk.

**Kroki**

1. Potwierdź cenę i rabat referencyjny.
2. Dodawaj ustalone ilości i odczytuj wycenę.
3. Dla 1 sztuki sprawdź 13.49 zł netto po rabacie.
4. Dla 6 sztuk sprawdź 84.99 zł brutto po rabacie.

**Oczekiwany wynik**

- Wartości odpowiadają uzgodnionemu wzorcowi starej hurtowni.
- Dla pozostałych ilości zapisano pomiary; brak jawnego wzorca nie jest pozornym PASS.
- Brak płatności 23% oznacza niespełniony warunek, a nie błąd kalkulacji produktu.

**Odpowiadający test**

Zaokrąglenia cen

**Uruchom test zaokrągleń:** Zestaw ilości 1–10 dla przygotowanego produktu 18,40 zł i rabatu 23%. Wymaga przygotowanych danych; nie zmienia rabatu automatycznie. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`

**Ograniczenia:** Kontrola wymaga przygotowanych danych. Jeżeli tymczasowo zmieniano rabat w CMS, należy go przywrócić i potwierdzić odczytem.

## Dostawa i adresy

### SHIP-001 — Dostawy dostępne po wyborze płatności

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Koszyk z dostępną, zapisaną płatnością.

**Dane**

GET /wholesale/checkout-step-two/{token_A}.

**Kroki**

1. Zapisz płatność w koszyku.
2. Pobierz listę dostaw.
3. Powtórz dla kolejnych płatności na osobnych koszykach.

**Oczekiwany wynik**

- Niepusta lista z unikalnymi kodami metod.
- Wybór dostawy następuje z odpowiedzi dla bieżącego koszyka i płatności.
- Brak wykorzystywania starej listy z innej płatności lub konta.

**Odpowiadający test**

Koszyk / regresja

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`
- `api-tests/order-regression.mjs`

### SHIP-002 — Zapis dostawy i poprawnych adresów

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Wybrana płatność i dostępna metoda dostawy.

**Dane**

POST checkout-step-two: orderTokenValue, shippingMethodCode, shippingAddress, billingAddress.

**Kroki**

1. Prześlij poprawne adresy i oferowany kod dostawy.
2. Odczytaj koszyk.
3. Sprawdź kod dostawy, płatność, koszt i total.

**Oczekiwany wynik**

- Zapisany kod dostawy jest zgodny z wyborem.
- total odpowiada itemsTotal + shippingTotal.
- Poprawne adresy nie powodują błędu walidacji.

**Odpowiadający test**

Koszyk / regresja / Redmine 36926

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Uruchom test adresów #36926:** Cały zestaw 38 przypadków na koncie 1. Bez finalizacji. Testuje też książkę adresową i usuwa nowo utworzone dane QA; ograniczenia opisuje raport. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`
- `api-tests/order-regression.mjs`
- `api-tests/redmine-36926.mjs`

### SHIP-003 — Niekompletny adres dostawy

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Stabilny koszyk z wybraną płatnością.

**Dane**

Puste city, street, postcode; poprawny billingAddress i oferowana dostawa.

**Kroki**

1. Zapisz stan przed zmianą.
2. Wyślij checkout-step-two z niekompletnym adresem.
3. Sprawdź status i ponowny odczyt koszyka.

**Oczekiwany wynik**

- Kontrolowany błąd walidacji 400/422 zgodnie z kontraktem.
- Koszyk nie przechodzi do poprawnie przygotowanego zamówienia z niepełnym adresem.
- Brak nieoczekiwanych zmian stanu po odrzuceniu.

**Odpowiadający test**

Regresja / Redmine 36926

**Uruchom test adresów #36926:** Cały zestaw 38 przypadków na koncie 1. Bez finalizacji. Testuje też książkę adresową i usuwa nowo utworzone dane QA; ograniczenia opisuje raport. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `api-tests/redmine-36926.mjs`

**Ograniczenia:** Regresja koszyka sprawdza wskazany zestaw pustych pól. Pełne warianty pól adresowych są opisane w REDMINE-36926.md.

### SHIP-004 — Nieistniejąca dostawa

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Koszyk z poprawnie zapisaną płatnością.

**Dane**

shippingMethodCode=qa-nonexistent-{unikalny_id}.

**Kroki**

1. Odczytaj stan koszyka.
2. Prześlij nieistniejącą dostawę i poprawne adresy.
3. Sprawdź status i stan po próbie.

**Oczekiwany wynik**

- Kontrolowana odmowa 400, 404 lub 422 według kontraktu.
- Metoda, produkty, rabaty i kwoty nie zmieniają się w wyniku odrzuconego żądania.

**Odpowiadający test**

Regresja

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

## Paczki GLS

### PACK-001 — Granice wagi i liczba paczek GLS

**P1 · Częściowo obsługiwane · Zmiana koszyka**

**Warunki wstępne**

- Potwierdzona waga produktu oraz waga paczki W w aktualnym CMS.

**Dane**

Przykład: W=8000 g, produkt 210 g, ilości 1, 38, 39, 76, 77. Dokładne W/W+1 wymagają odpowiedniej masy fixture.

**Kroki**

1. Wybierz gls_wholesale.
2. Dla każdej ilości ustaw ilość, ponownie zapisz dostawę i odczytaj koszyk.
3. Oblicz wagę jako ilość × wagę sztuki.
4. Porównaj shipmentPackageQuantity z ceil(waga/W).

**Oczekiwany wynik**

- Dla przykładu: 38 szt.=7980 g → 1 paczka; 39 szt.=8190 g → 2; 76 szt.=15960 g → 2; 77 szt.=16170 g → 3.
- Sprawdź też dokładne granice W i W+1 na przygotowanym produkcie, jeżeli to wymagane.

**Odpowiadający test**

Paczki / regresja

**Uruchom test paczek:** Cały zestaw paczek z lokalną konfiguracją progów i produktu. Bez finalizacji i bez zmiany CMS; konto z konfiguracji regresji. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

**Ograniczenia:** Automat sprawdza granice osiągalne przez ilości całkowite. Nie oznacza to automatycznie sprawdzenia dokładnie 8000 i 8001 g dla produktu ważącego 210 g.

### PACK-002 — Ceny paczek i dopłata do płatności

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Niezależnie odczytany kalkulator GLS: przedziały, cena paczki, netto/brutto, VAT i dopłata płatności.

**Dane**

Cennik i paymentSurchargeGrossMinor z potwierdzonej konfiguracji.

**Kroki**

1. Utwórz koszyki o wagach z obu przedziałów.
2. Wyznacz liczbę paczek i cenę właściwego przedziału.
3. Uwzględnij oznaczenie netto/brutto i potwierdzony VAT.
4. Dodaj dopłatę płatności i porównaj shippingTotal oraz shippingTotalNet.

**Oczekiwany wynik**

- Koszt wynika z niezależnego cennika, a nie z ponownego użycia otrzymanej kwoty API jako wzorca.
- Koszt paczek i opłata płatności są rozróżnione.
- Przedziały nie są pomylone z samą liczbą paczek.

**Odpowiadający test**

Paczki z przygotowaną konfiguracją

**Uruchom test paczek:** Cały zestaw paczek z lokalną konfiguracją progów i produktu. Bez finalizacji i bez zmiany CMS; konto z konfiguracji regresji. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

**Ograniczenia:** Bez danych kalkulatora przypadek pozostaje niesprawdzony. Regułę VAT i zaokrągleń dostawy należy potwierdzić dla użytej konfiguracji.

### PACK-003 — Zmniejszenie ilości zmniejsza koszt paczek

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Koszyk GLS przekraczający co najmniej jeden próg paczek.

**Dane**

Zmniejszenie ilości np. 77 → 1.

**Kroki**

1. Odczytaj liczbę paczek i koszty dla dużej ilości.
2. Zmień ilość na 1 i przelicz zapisując dostawę.
3. Odczytaj ilość paczek i koszty ponownie.

**Oczekiwany wynik**

- Liczba paczek i ceny odpowiadają nowej, mniejszej wadze.
- Nie pozostają stare koszty wielopaczkowej przesyłki.

**Odpowiadający test**

Paczki

**Uruchom test paczek:** Cały zestaw paczek z lokalną konfiguracją progów i produktu. Bez finalizacji i bez zmiany CMS; konto z konfiguracji regresji. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### PACK-004 — Zmiana GLS na dostawę bez kalkulatora paczek

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Dla tego samego koszyka API oferuje GLS oraz metodę bez kalkulatora.

**Dane**

Kod potwierdzony w nonPackageShippingCodes; nie zakładaj dostępności personal_collection.

**Kroki**

1. Przygotuj GLS z dodatnią ilością paczek.
2. Zmień dostawę na oferowaną metodę bez kalkulatora.
3. Odczytaj podsumowanie.

**Oczekiwany wynik**

- Kod dostawy jest zmieniony.
- shipmentPackageQuantity wynosi 0; koszt odpowiada nowej metodzie.
- Jeżeli metoda nie jest oferowana, ten wariant jest pominięty z podaniem powodu.

**Odpowiadający test**

Paczki

**Uruchom test paczek:** Cały zestaw paczek z lokalną konfiguracją progów i produktu. Bez finalizacji i bez zmiany CMS; konto z konfiguracji regresji. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### PACK-005 — Tymczasowy cennik GLS i przywrócenie CMS

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Warunki wstępne**

- Dostęp CMS i uzgodniony zakres zmian na DEV.
- Brak równoległych testów korzystających ze wspólnego cennika.

**Dane**

Kontrolowany profil wag i cen oraz kopia początkowych ustawień.

**Kroki**

1. Zapisz kopię konfiguracji i dziennik przywracania.
2. Ustaw profil testowy, odczytaj go i wykonaj próby progów.
3. Zakończ poprawnie, z błędem lub anulowaniem jako osobne warianty.
4. Przywróć konfigurację i potwierdź odczytem.

**Oczekiwany wynik**

- Zastosowano żądany profil, a po teście wróciła konfiguracja początkowa.
- Przerwanie procesu pozostawia możliwość przywrócenia z dziennika.
- Obca równoległa zmiana nie jest bezwarunkowo nadpisywana.

**Odpowiadający test**

Paczki z tymczasową konfiguracją CMS

**Otwórz ustawienia testu paczek:** Uzupełnij profil w sekcji „Paczki i koszt dostawy”. Dopiero przycisk formularza zmienia wspólną konfigurację CMS na czas testu i ją przywraca. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/shipping-cms.mjs`
- `api-tests/shipping-restore.mjs`
- `tests/order-regression.test.mjs`

**Ograniczenia:** Błędy i anulowanie mają testy lokalne adaptera; gwałtowne zabicie procesu i odtworzenie stanu wymagają kontrolowanej próby integracyjnej.

## Zapis i dokumenty

### ORD-001 — Zapis poprawnego zamówienia

**P0 · Obsługiwane przez automat · Możliwy zapis zamówienia**

**Warunki wstępne**

- Dedykowane konto DEV.
- Poprawny koszyk, płatność, dostawa i adresy; brak blokujących błędów wyceny.

**Dane**

PATCH /shop/orders/{token_A}/complete, body {}.

**Kroki**

1. Zapisz podsumowanie przed complete.
2. Wyślij complete dokładnie raz jako właściciel.
3. Odczytaj ten sam token zamówienia.
4. Zapisz numer, ID i kwoty.

**Oczekiwany wynik**

- API przyjmuje zatwierdzenie i pozwala odczytać to samo zamówienie.
- Kwoty poprawnego koszyka są zgodne przed i po zapisie.
- Jeżeli zwracane jest state, zamówienie nie pozostaje cart; brak pola jest osobną niesprawdzoną kontrolą.
- Potwierdzenie API samo nie potwierdza e-maila ani transferu do bazy.

**Odpowiadający test**

Pełne zamówienie / regresja z zapisem

**Uruchom pełne zamówienie:** Cały proces dla użytkownika wybranego u góry panelu. Zatwierdza zamówienie; może wysłać e-mail i uruchomić transfer. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Uruchom regresję z zapisem:** Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`
- `api-tests/order-regression.mjs`

### ORD-002 — Pusty koszyk nie może zostać zatwierdzony

**P1 · Obsługiwane przez automat · Możliwy zapis zamówienia**

**Warunki wstępne**

- Nowy pusty koszyk A.

**Dane**

Osobno GET pustego koszyka i PATCH complete z body {}.

**Kroki**

1. Spróbuj odczytać pusty koszyk i zapisz wynik.
2. Niezależnie od sukcesu GET wykonaj jedną próbę complete.
3. Jeżeli istnieje wiarygodny stan przed próbą, porównaj odczyt po odmowie.

**Oczekiwany wynik**

- Zatwierdzenie zostaje odrzucone kontrolowanym statusem walidacji, obecnie 400/422.
- Nie powstaje złożone zamówienie bez produktów.
- Błąd GET i błąd complete są osobnymi wynikami; bez poprawnego odczytu nie zalicza się niezmienności.

**Odpowiadający test**

Regresja z zapisem

**Uruchom regresję z zapisem:** Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

**Ograniczenia:** To test negatywny endpointu zapisującego. Jeżeli API błędnie przyjmie żądanie, może powstać nieprawidłowe zamówienie testowe.

### ORD-003 — Blokada zamówienia mieszanego Adamada i pozostałe

**P0 · Obsługiwane przez automat · Możliwy zapis zamówienia**

**Warunki wstępne**

- Dostępny produkt Adamada i zwykły produkt.

**Dane**

D087 + 5lp-1 w jednym nowym koszyku.

**Kroki**

1. Spróbuj dodać obie grupy.
2. Jeżeli API odrzuci dodanie, zapisz odmowę.
3. Jeżeli je dopuści, przygotuj dostępne metody i wykonaj jedną próbę complete.

**Oczekiwany wynik**

- Nie można skutecznie złożyć zamówienia mieszanego.
- Odrzucenie może nastąpić przy dodawaniu albo najpóźniej przy finalizacji zgodnie z uzgodnioną regułą.
- Komunikat walidacji wyjaśnia problem bez HTTP 500.

**Odpowiadający test**

Regresja z zapisem

**Uruchom regresję z zapisem:** Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`

### ORD-004 — Powtórne zatwierdzenie i utrata odpowiedzi

**P1 · Częściowo obsługiwane · Możliwy zapis zamówienia**

**Warunki wstępne**

- Dedykowane konto DEV i uzgodniony kontrakt ponownego complete.

**Dane**

Ponowne complete po sukcesie; osobno timeout po wysłaniu.

**Kroki**

1. Zapisz numer zamówienia po pierwszej próbie.
2. Sprawdź uzgodniony wariant ponownego wywołania na tym samym tokenie.
3. W wariancie utraconej odpowiedzi odczytaj status lub sprawdź CMS przed kolejną akcją.

**Oczekiwany wynik**

- Nie powstaje drugie zamówienie ani zduplikowany transfer lub e-mail.
- Status ponowienia jest zgodny z uzgodnionym kontraktem.
- Narzędzie nie ponawia automatycznie complete po timeout.

**Odpowiadający test**

Regresja z zapisem — drugie complete po potwierdzonym sukcesie

**Uruchom regresję z zapisem:** Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/order-regression.mjs`
- `api-tests/regression-access.mjs`
- `tests/regression-access.test.mjs`
- `tests/order-regression.test.mjs`

**Ograniczenia:** Automat sprawdza numer, id i niezmienność tego samego zamówienia. Nie potwierdza braku dodatkowego e-maila lub rekordu w transferze. Kontrola timeoutu jest sprawdzona lokalnie; bez potwierdzenia pierwszego zapisu nie wysyła drugiego complete.

### ORD-005 — Potwierdzenie PDF i informacje po zakupie

**P1 · Częściowo obsługiwane · Możliwy zapis zamówienia**

**Warunki wstępne**

- Poprawnie zapisane zamówienie.
- Dla paymentForm: uzgodniona wymagalność druczka danej płatności.

**Dane**

pdfSummary, paymentForm, checkoutInformation; potwierdzona lista wymaganych informacji.

**Kroki**

1. Odczytaj link potwierdzenia i pobierz plik.
2. Sprawdź Content-Type i sygnaturę PDF.
3. Gdy wymagany, pobierz paymentForm.
4. Sprawdź shop_billing lub pickup_address dla odpowiednich metod.
5. Ręcznie albo parserem porównaj zawartość PDF z zamówieniem.

**Oczekiwany wynik**

- Potwierdzenie jest prawidłowym plikiem PDF.
- Wymagane linki i informacje są obecne dla danego wariantu.
- Numer, produkty, ilości, rabaty i kwoty w treści PDF odpowiadają zamówieniu.

**Odpowiadający test**

Pełne zamówienie / ręczne sprawdzenie treści

**Uruchom pełne zamówienie:** Cały proces dla użytkownika wybranego u góry panelu. Zatwierdza zamówienie; może wysłać e-mail i uruchomić transfer. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Uruchom regresję z zapisem:** Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`

**Ograniczenia:** Automat potwierdza typ i sygnaturę pliku, a nie poprawność jego treści ani doręczenie e-maila. Warunki checkoutInformation są sprawdzane po ich skonfigurowaniu.

## Izolacja użytkowników

### ISO-001 — Dwa konta mają odrębne logowanie i wzorce rabatów

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Dwa różne, aktywne konta A i B.
- Rabaty obu kont potwierdzone niezależnie.

**Dane**

Przykładowo odbiór A=50%, B=13%; Adamada A=10%, B=20%.

**Kroki**

1. Zaloguj A i B, zapisując JWT osobno.
2. Potwierdź różne tokeny.
3. Na własnych koszykach obu kont sprawdź dostępne płatności i rabaty.

**Oczekiwany wynik**

- JWT nie są zamienne ani identyczne.
- Każde konto otrzymuje własny rabat.
- Brakująca metoda konta nie jest wybierana poza listą dostępności.

**Odpowiadający test**

Drugie konto

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/second-account.mjs`

### ISO-002 — Obce konto odczytuje cudzy koszyk

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Dla każdego kierunku nowy koszyk właściciela z ustabilizowaną wyceną.

**Dane**

JWT B + token koszyka A; potem JWT A + token koszyka B.

**Kroki**

1. Przygotuj koszyk właściciela i zapisz jego stan.
2. Wyślij GET /shop/orders/{cudzy_token} jako drugie konto.
3. Odczytaj koszyk jako właściciel.

**Oczekiwany wynik**

- Obce żądanie zwraca 403/404 bez ujawnienia zamówienia.
- Ponowny odczyt właściciela pokazuje identyczny stan, rabaty i kwoty.

**Odpowiadający test**

Izolacja w regresji

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/second-account.mjs`

### ISO-003 — Obce konto odczytuje płatności lub dostawy

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Nowy koszyk dla każdej operacji i każdego kierunku; właściciel wybrał płatność.

**Dane**

GET /wholesale/orders/{cudzy_token}/payments oraz GET /wholesale/checkout-step-two/{cudzy_token}.

**Kroki**

1. Zapisz stan koszyka jako właściciel.
2. Wykonaj jedną z badanych operacji z JWT drugiego konta.
3. Zapisz HTTP obcego żądania.
4. Ponownie odczytaj koszyk jako właściciel i porównaj pola.

**Oczekiwany wynik**

- HTTP 403/404 oraz niezmieniony koszyk są dwoma wymaganymi warunkami.
- Rabat i kwoty nie przejmują ustawień obcego konta ani nie zerują się.
- Powtórz każdy endpoint w obu kierunkach na nowych koszykach.

**Odpowiadający test**

Izolacja w regresji / Postman dla odczytu płatności

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/second-account.mjs`
- `postman/HURTOWNIA - Izolacja uzytkownikow.postman_collection.json`

**Ograniczenia:** Znajomość tokenu jest założeniem testu. Przypadek nie sprawdza możliwości odgadnięcia tokenu ani przejęcia logowania.

### ISO-004 — Obce konto modyfikuje produkty koszyka

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Osobny nowy koszyk dla każdej próby i kierunku.

**Dane**

PATCH ilości; POST items/bulk; DELETE pozycji.

**Kroki**

1. Zapisz stan koszyka właściciela.
2. Jako drugie konto spróbuj kolejno na osobnych koszykach: zmienić ilość, dodać produkt, usunąć pozycję.
3. Po każdej próbie odczytaj stan jako właściciel.

**Oczekiwany wynik**

- Każda obca operacja otrzymuje 403/404.
- Produkty, ilości, rabaty i sumy pozostają identyczne.
- Odmowa bez kontroli stanu nie wystarcza do PASS.

**Odpowiadający test**

Izolacja w regresji

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/second-account.mjs`

### ISO-005 — Obce konto zmienia płatność lub dostawę

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Nowy przygotowany koszyk dla każdej próby i kierunku.

**Dane**

PATCH payment-method; POST checkout-step-two z odmiennymi testowymi adresami, poprawnymi strukturalnie.

**Kroki**

1. Przygotuj nowy koszyk i zapisz w nim metody oraz adresy jako właściciel.
2. Wyślij jedną obcą próbę zmiany płatności albo dostawy; próba dostawy zawiera inne adresy QA.
3. Odczytaj koszyk jako właściciel.
4. Porównaj kwoty, metody i treść adresów; powtórz na nowym koszyku w odwrotnym kierunku.

**Oczekiwany wynik**

- Obce żądanie zwraca 403/404.
- Kod płatności, kod dostawy i wycena nie zmieniają się.
- Nie zapisano obcych adresów.

**Odpowiadający test**

Izolacja w regresji — kwoty, metody i adresy

**Uruchom regresję bez zapisu:** Cały zestaw regresji, w tym izolacja kont. Bez finalizacji; używa kont i danych z konfiguracji regresji, niezależnie od użytkownika wybranego u góry. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/second-account.mjs`
- `api-tests/regression-access.mjs`
- `tests/second-account.test.mjs`

**Ograniczenia:** Jeżeli GET koszyka nie ujawnia obu adresów, kontrola pełnych adresów ma jawny SKIP. Raport pokazuje nazwy zmienionych pól, bez treści danych adresowych.

### ISO-006 — Wycena po obcym żądaniu i po finalizacji

**P0 · Częściowo obsługiwane · Możliwy zapis zamówienia**

**Warunki wstępne**

- Dedykowane konto DEV; dostawa i adresy przygotowane przed pomiarem.
- Świadomy diagnostyczny zapis po odtworzeniu błędu izolacji.

**Dane**

Trzy odczyty: przed obcą operacją, po niej i po complete tego samego koszyka.

**Kroki**

1. Zapisz początkowy rabat i total jako A.
2. Wykonaj obce żądanie i ponowny odczyt jako A.
3. Zachowaj wynik izolacji oraz zmienione wartości.
4. Zatwierdź ten sam koszyk jako A, bez dodatkowych zmian między pomiarem a complete.
5. Odczytaj zapis i sprawdź numer w Syliusie.

**Oczekiwany wynik**

- Wymaganie izolacji: wycena po obcym żądaniu nie zmienia się.
- Wymaganie zapisu: utrwalone zamówienie ma prawidłową wycenę właściciela.
- Jeżeli zapis przywróci poprawną cenę, wynik finalizacji może być poprawny, ale wcześniejszy błąd izolacji pozostaje FAIL.
- Raport rozdziela nieprawidłowe podsumowanie koszyka od niepotwierdzonego wpływu na końcowe rozliczenie.

**Odpowiadający test**

Regresja z zapisem — diagnostyczne trzy stany, oba kierunki kont

**Uruchom regresję z zapisem:** Cały zestaw z zapisem do 3 poprawnych zamówień i do 2 dodatkowych zamówień diagnostycznych izolacji na kontach z konfiguracji. Może zapisać zamówienia, wysłać e-maile i uruchomić transfer. Wysyła też drugie complete po potwierdzonym zapisie; nie ponawia timeoutu. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/second-account.mjs`
- `tests/second-account.test.mjs`
- `postman/isolation-scripts.mjs`

**Ograniczenia:** Wariant z zapisem może utworzyć dwa dodatkowe zamówienia diagnostyczne, także po błędzie izolacji. Zwykły silnik zamówienia nadal blokuje zapis przy błędach cen. Automat porównuje API; widok CMS, transfer i e-maile wymagają osobnej kontroli.

## Porównanie z bazą

### DB-001 — Porównanie zapisanego zamówienia z Syliusem i transferem

**P1 · Obsługiwane przez automat · Odczyt**

**Warunki wstępne**

- Zapisane zamówienie z potwierdzonym ID i numerem.
- Dostęp tylko do odczytu obu baz; porównanie jawnie włączone.

**Dane**

bookshop2.sylius_order, sylius_order_item, sylius_payment; gwo_transfer.orders i orders_items.

**Kroki**

1. Pobierz zapisane zamówienie z API bez ponawiania complete.
2. Powiąż API id z sylius_order.id.
3. Powiąż sylius_order.number z transferowym nOrderID.
4. Porównaj walutę, sumy, płatność, produkty, ilości, ceny i rabaty.

**Oczekiwany wynik**

- Rekordy dotyczą dokładnie tego samego zamówienia.
- Kwoty porównano po prawidłowym przeliczeniu groszy i wartości DECIMAL.
- Przy kilku rekordach transferu produktu sumuje się ilości i wartości.
- Kod wariantu API jest poprawnie mapowany na kod handlowy.

**Odpowiadający test**

Porównanie z bazą

**Wybierz zamówienie do porównania:** W raporcie zatwierdzonego zamówienia użyj „Porównaj z bazą”. To odczyt istniejącego zapisu, bez składania nowego zamówienia. Wymaga dostępu do baz. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/database.mjs`
- `api-tests/database-run.mjs`

**Ograniczenia:** Nie potwierdzaj zapisu transferowego na podstawie samego HTTP 200. Bez dostępu do bazy zakres pozostaje niesprawdzony.

### DB-002 — Paczki w przesyłce i koszt KWys w transferze

**P1 · Obsługiwane przez automat · Odczyt**

**Warunki wstępne**

- Zapisane zamówienie GLS z paczkami i dostęp do obu baz.

**Dane**

sylius_shipment.shipment_package_details oraz gwo_transfer.orders_items, vcIDT=KWys.

**Kroki**

1. Odczytaj ilość paczek i koszty z API.
2. Sprawdź JSON przesyłki: kod dostawy, liczbę paczek, cenę jednostkową i netto/brutto.
3. Odszukaj KWys w transferze.
4. Porównaj liczbę i wartość paczek, oddzielając dopłatę płatności.

**Oczekiwany wynik**

- Dane przesyłki odpowiadają zwróconej ilości paczek i metodzie.
- KWys reprezentuje koszt paczek.
- Nie wymaga się, by KWys obejmował dodatkową opłatę płatności zawartą w shippingTotal API.

**Odpowiadający test**

Porównanie z bazą

**Wybierz zamówienie do porównania:** W raporcie zatwierdzonego zamówienia użyj „Porównaj z bazą”. To odczyt istniejącego zapisu, bez składania nowego zamówienia. Wymaga dostępu do baz. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/database.mjs`

## Raporty i interpretacja

### REPORT-001 — Czytelny raport i rozróżnienie wyników

**P2 · Częściowo obsługiwane · Odczyt**

**Warunki wstępne**

- Raport z przypadkami pozytywnymi, błędem i pominięciem.

**Dane**

PASS, FAIL, SKIP i INCOMPLETE; osobne dane warunku oraz wykonania.

**Kroki**

1. Otwórz raport w panelu.
2. Sprawdź opis kroków, oczekiwania, statusy HTTP i pomiary.
3. Sprawdź, czy pominięte etapy mają powód.
4. Dla błędu cen sprawdź produkt, pole, wartości przed/po i jednostkę.

**Oczekiwany wynik**

- Czytelnik rozumie, co sprawdzono i co wymaga dalszej pracy.
- Liczby kontroli nie są przedstawione jako liczba zamówień lub niezależnych usterek.
- Pominięcie nie jest przedstawiane jako zaliczenie.
- Raport nie zawiera haseł, JWT, cookies ani tokenów koszyka.

**Odpowiadający test**

Kontrola raportu / testy lokalne generatorów

**Otwórz raporty:** Wybierz raport uruchomienia i porównaj jego zawartość z oczekiwaniami scenariusza. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/report-explanations.mjs`
- `api-tests/report.mjs`
- `api-tests/feature-report.mjs`
- `tests/report-explanations.test.mjs`

**Ograniczenia:** Kontrola czytelności i prezentacji wymaga przeglądu przez człowieka; lokalne testy sprawdzają strukturę i wybrane zabezpieczenia.

### REPORT-002 — Różnice netto bez potwierdzonej reguły zaokrągleń

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Produkt z różnymi jednostkowymi polami netto przy rabacie 0%.
- Nie włączono nieuzgodnionego wymagania ścisłej równości.

**Dane**

Przykład historyczny: D090, unitPriceNet=20286 i discountedUnitPriceNet=20285; 10 sztuk.

**Kroki**

1. Odczytaj wartości jednostkowe netto i sumę netto pozycji.
2. Porównaj z orderItemTotal oferty płatności.
3. Sprawdź osobno poprawność brutto i rabatu względem niezależnego wzorca.
4. Otwórz raport i zweryfikuj klasyfikację obserwacji.

**Oczekiwany wynik**

- Różnica 1 gr/szt. i 10 gr dla 10 sztuk jest pokazana z nazwami źródłowych pól.
- Bez potwierdzonej reguły równości różnica pozostaje obserwacją i nie blokuje zapisu.
- Różnica brutto pozycji i porównanie netto nie są mylone.
- Potwierdzone błędy brutto lub rabatu nadal powodują FAIL.

**Odpowiadający test**

Koszyk / lokalne testy raportowania

**Uruchom test koszyka:** Cały test koszyka, bez finalizacji. Używa użytkownika wybranego u góry panelu oraz ustawień losowania i ziarna z widoku „Uruchom testy”. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/engine.mjs`
- `api-tests/diagnostic-summary.mjs`
- `tests/diagnostic-summary.test.mjs`

## Opisy kanałowe — CMS

### DESC-001 — Zakładka kanałowa i dostępne EMPIK/WHOLESALE

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — widoczność zakładki i kanałów

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 1 PASS, 0 FAIL w kontrolach przypisanych do DESC-001. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Zwykły produkt i kanały faktycznie istniejące w systemie.

**Kroki**

1. Otwórz edycję produktu.
2. Sprawdź zakładkę „Opisy produktu dla kanałów sprzedaży”.
3. Porównaj jej kanały z konfiguracją systemu.

**Oczekiwany wynik**

- Zakładka jest widoczna dla zwykłego produktu.
- Edytowane są EMPIK i WHOLESALE, jeśli istnieją; RETAIL i ACADEMY nie używają ProductChannelTranslation.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora. Dla DESC-001 sprawdza strukturę pól formularza; widoczność zakładki w interfejsie wymaga osobnego testu UI.

### DESC-002 — Ukrycie zakładki dla ofert i szkoleń

**P1 · Do automatyzacji · Zmiana danych CMS**

**Wymaganie:** 1.1 — SpecialOffer, szkolenia rad i nauczycieli

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Po jednym produkcie każdego wymienionego typu.

**Kroki**

1. Otwórz formularze trzech typów produktów.
2. Sprawdź dostępność zakładki kanałowej.

**Oczekiwany wynik**

- Zakładka nie jest dostępna dla SpecialOffer i obu typów szkoleń.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Obecny zestaw „Opisy per kanał” wykonuje wyłącznie API sklepu. Ten warunek nie jest przez niego automatycznie potwierdzany. Wymagane fixture specjalnych typów.

### DESC-003 — Edycja i trwały zapis czterech pól kanałowych

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — name, slug, description, shortDescription

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 1 PASS, 0 FAIL w kontrolach przypisanych do DESC-003. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Różne treści główne, WHOLESALE i EMPIK.

**Kroki**

1. Wpisz odmienne wartości czterech pól w obu kanałach.
2. Zapisz formularz i odśwież stronę.
3. Porównaj z wpisanymi wartościami oraz głównymi danymi produktu.

**Oczekiwany wynik**

- Zmiany są zachowane oddzielnie w każdym kanale.
- Dane główne i drugi kanał nie są nadpisane.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora.

### DESC-004 — Puste pola i fallback każdego pola osobno

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — puste pola oraz fallback

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 5 PASS, 0 FAIL w kontrolach przypisanych do DESC-004. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Dane główne i komplet kanałowy; wyczyszczenie każdego pola osobno oraz wszystkich.

**Kroki**

1. Usuń jedną wartość kanałową i zapisz.
2. Sprawdź formularz po odświeżeniu i odczyt WHOLESALE.
3. Powtórz dla każdego pola, następnie usuń komplet tłumaczenia.

**Oczekiwany wynik**

- Puste wartości są dopuszczalne.
- Brakujące dane są zastępowane właściwymi danymi głównymi, bez utraty pozostałych nadpisań.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora.

### DESC-005 — Kolizja slugu w tym samym kanale

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — unikalność slugu w obrębie kanału

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 1 PASS, 0 FAIL w kontrolach przypisanych do DESC-005. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Dwa produkty QA, istniejący slug WHOLESALE lub EMPIK.

**Kroki**

1. Ustaw slug drugiego produktu równy slugowi pierwszego w tym samym kanale.
2. Spróbuj zapisać i odczytaj stan obu produktów.

**Oczekiwany wynik**

- Kontrolowany błąd walidacji.
- Pierwszy produkt i poprzednia poprawna konfiguracja drugiego pozostają zachowane.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora.

### DESC-006 — Slug kanałowy równy głównemu slugowi

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — zakaz slugu identycznego z głównym

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 1 PASS, 0 FAIL w kontrolach przypisanych do DESC-006. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Produkt z głównym slugiem i pustym kanałowym.

**Kroki**

1. Wpisz główny slug jako slug kanałowy.
2. Spróbuj zapisać.

**Oczekiwany wynik**

- Zapis jest odrzucony czytelną walidacją zgodnie z wymaganiem.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora.

### DESC-007 — Ten sam slug w EMPIK i WHOLESALE

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — powtarzalność pomiędzy kanałami

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 1 PASS, 0 FAIL w kontrolach przypisanych do DESC-007. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Niepowtarzalny slug w obrębie każdego kanału.

**Kroki**

1. Wpisz tę samą nową wartość w EMPIK i WHOLESALE.
2. Zapisz i odśwież formularz.

**Oczekiwany wynik**

- Taka sama wartość między różnymi kanałami jest dozwolona.
- Wartość różni się od głównego slugu.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora.

### DESC-008 — Minimalna długość nazwy kanałowej

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — nazwa minimum 2 znaki

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-008. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Nazwa jednoliterowa, dwuznakowa i pusta.

**Kroki**

1. Spróbuj zapisać nazwę o długości 1.
2. Powtórz dla 2 znaków i pustego pola.

**Oczekiwany wynik**

- Nazwa jednoliterowa jest odrzucona.
- Dwa znaki są dopuszczalne; pusta nazwa uruchamia fallback.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora.

### DESC-009 — Maksymalna długość slugu kanałowego

**P1 · Częściowo obsługiwane · Zmiana danych CMS**

**Wymaganie:** 1.1 — slug maksimum 255 znaków

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-009. Cztery pola WHOLESALE i EMPIK sprawdzono po zapisie. Pierwotne pola kanałowe QA przywrócono i potwierdzono odczytem CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html)

**Warunki wstępne**

- Administrator CMS na DEV.
- Osobny produkt QA; zapisz stan przed zmianą i przywróć go po próbie.

**Dane**

Poprawne, unikalne slugi o długości 255 i 256 znaków.

**Kroki**

1. Zapisz slug 255-znakowy.
2. Spróbuj zastąpić go 256-znakowym.
3. Sprawdź stan po odmowie.

**Oczekiwany wynik**

- 255 znaków jest dopuszczalne, 256 odrzucone.
- Nie zapisano częściowej ani uciętej wartości bez walidacji.

**Odpowiadający test**

Opisy kanałowe — zapis i walidacje formularza CMS

**Sprawdź zapis i walidacje CMS:** Oddzielny zestaw: tymczasowo zmienia pola WHOLESALE i EMPIK dedykowanego produktu QA; sprawdza formularz przez HTTP, odczyt CMS i API, a na końcu przywraca pola. Bez complete i bez OfferUpdater. JavaScript edytora pozostaje poza zakresem. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`

**Ograniczenia:** Automat formularza CMS z aktualnym CSRF i ponownym odczytem. Wymaga config/description-cms.local.json, sesji GitLab i administratora CMS. Zapis wyłącznie pól kanałowych QA; dziennik przywracania i odmowa nadpisania zmiany zewnętrznej. Nie testuje interakcji JavaScript edytora.

### DESC-010 — Nowy produkt bez tłumaczeń i ich późniejsze dodanie

**P1 · Do automatyzacji · Zmiana danych CMS**

**Wymaganie:** 1.2 — nowy produkt i ProductChannelTranslation

**Warunki wstępne**

- Administrator CMS; unikalny nowy produkt QA.

**Dane**

Nowy produkt z głównymi danymi, bez wypełniania pól kanałowych.

**Kroki**

1. Utwórz produkt i ponownie otwórz edycję.
2. Potwierdź puste pola kanałowe; istnienie rekordów sprawdź w bazie/admin odczycie, jeśli dostępny.
3. Dodaj tłumaczenia WHOLESALE i EMPIK i zapisz.

**Oczekiwany wynik**

- Nowy produkt domyślnie nie ma ProductChannelTranslation.
- Późniejsze dodanie obu dostępnych kanałów jest możliwe.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Sam formularz „Nowy produkt API” tworzy produkt i wariant; nie potwierdza tego kryterium CMS ani braku rekordów kanałowych w bazie.

## Opisy kanałowe — API

### DESC-011 — WHOLESALE — nazwa i slug na liście, nadpisanie i fallback

**P0 · Obsługiwane przez automat · Odczyt**

**Wymaganie:** 3.1 — GET products-dto WHOLESALE

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-011. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.

**Dane**

config/catalog-fixtures.local.json, main i channels.WHOLESALE.

**Kroki**

1. Wyślij GET /shop/products-dto z X-Api-Channel: WHOLESALE i wyszukiwaniem nazwy referencyjnej.
2. Znajdź kod każdego produktu QA.
3. Porównaj name i slug ze wzorcem kanałowym lub głównym.

**Oczekiwany wynik**

- Produkt z nadpisaniem zwraca wartości WHOLESALE.
- Produkt fallback zwraca dane główne.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Wymagane niezależnie przygotowane fixture; nie sprawdza całej paginacji ani UI.

### DESC-012 — WHOLESALE — cztery pola szczegółów, nadpisanie i fallback

**P0 · Obsługiwane przez automat · Odczyt**

**Wymaganie:** 3.2 — GET products-dto-by-slug WHOLESALE

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-012. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.

**Dane**

Nazwa, slug, pełny i krótki opis dla dwóch wzorców QA.

**Kroki**

1. Pobierz produkt przez jego oczekiwany slug WHOLESALE.
2. Porównaj code, name, slug, description i shortDescription z fixture.
3. Powtórz dla produktu bez tłumaczenia kanałowego.

**Oczekiwany wynik**

- WHOLESALE używa nadpisania, a przy jego braku danych głównych.
- Kod produktu pozostaje właściwy.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Pełny opis jest porównywany dokładnie lub jako niezależny fragment descriptionContains, zależnie od fixture. Per-field czyszczenie CMS jest osobnym DESC-004.

### DESC-013 — RETAIL — główne tłumaczenia w API

**P0 · Obsługiwane przez automat · Odczyt**

**Wymaganie:** 2.1/2.2 — część API, bez potwierdzenia frontendu

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 4 PASS, 0 FAIL w kontrolach przypisanych do DESC-013. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.

**Dane**

Produkt z odmiennym WHOLESALE, aktywny również w RETAIL.

**Kroki**

1. Pobierz listę i szczegóły z X-Api-Channel: RETAIL.
2. Porównaj pola z main oraz oczekiwanym kanałem RETAIL.

**Oczekiwany wynik**

- RETAIL korzysta z ProductTranslation, a nie nadpisań WHOLESALE.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** To kontrola odpowiedzi API; nie potwierdza widoków i linków sklepu z punktu 2.

### DESC-014 — ACADEMY — główne tłumaczenia na liście i w szczegółach

**P0 · Obsługiwane przez automat · Odczyt**

**Wymaganie:** 3 — ACADEMY używa ProductTranslation

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 4 PASS, 0 FAIL w kontrolach przypisanych do DESC-014. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.

**Dane**

Aktywny produkt z odmiennym WHOLESALE i głównymi danymi ACADEMY.

**Kroki**

1. Pobierz listę i szczegóły z X-Api-Channel: ACADEMY.
2. Porównaj nazwę, slug i opisy z main.

**Oczekiwany wynik**

- ACADEMY korzysta z ProductTranslation niezależnie od WHOLESALE.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Nie obejmuje list kursów closed-courses i paid-courses.

### DESC-015 — WHOLESALE — productName w koszyku

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Wymaganie:** 3.3 — GET orders, WHOLESALE

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-015. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.

**Dane**

Warianty obu produktów QA: fallback i override.

**Kroki**

1. Utwórz osobny koszyk WHOLESALE dla produktu.
2. Dodaj wariant i odczytaj GET /shop/orders/{token}.
3. Porównaj productName z niezależną nazwą dla kanału.

**Oczekiwany wynik**

- productName odpowiada WHOLESALE lub głównemu fallbackowi.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Bez complete; nie potwierdza nazwy w zatwierdzonym zamówieniu, CMS, PDF ani e-mailu.

### DESC-016 — ACADEMY — productName w koszyku

**P0 · Obsługiwane przez automat · Zmiana koszyka**

**Wymaganie:** 3.3 — GET orders, ACADEMY

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-016. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.

**Dane**

Aktywny wariant i główna nazwa referencyjna.

**Kroki**

1. Utwórz koszyk ACADEMY i dodaj produkt.
2. Odczytaj GET zamówienia w tym kanale.
3. Porównaj productName z main.

**Oczekiwany wynik**

- Nazwa w koszyku korzysta z ProductTranslation.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Bez finalizacji; kursy i dokumenty są osobnymi scenariuszami.

### DESC-017 — Nazwa wariantu w pozycjach API

**P1 · Częściowo obsługiwane · Zmiana koszyka**

**Wymaganie:** 2.3/2.4/3.3 — variantName

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 0 PASS, 6 FAIL w kontrolach przypisanych do DESC-017. API nie zwróciło variantName mimo nazw wariantów zapisanych w CMS. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.
- Fixture zawiera niezależnie potwierdzone variantName.

**Dane**

Wariant z ustawioną nazwą; WHOLESALE, RETAIL i ACADEMY.

**Kroki**

1. Dodaj referencyjny wariant w każdym aktywnym kanale.
2. Odczytaj variantName i porównaj z fixture.

**Oczekiwany wynik**

- variantName odpowiada rzeczywistej nazwie wariantu.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Automat porównuje variantName z niezależną nazwą zapisaną w CMS. Oba warianty QA mają już nazwy; przebieg DEV z 19.10.2026 wykrył brak pola w API (6 FAIL). Dla innych produktów brak wzorca daje SKIP. Interfejs sklepu pozostaje poza zakresem.

### DESC-018 — ACADEMY — closed-courses

**P1 · Częściowo obsługiwane · Odczyt**

**Wymaganie:** 3.4 — tytuł i slug kursów

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 3 PASS, 0 FAIL w kontrolach przypisanych do DESC-018. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Konto ACADEMY z referencyjnym kursem widocznym w tej kolekcji.
- Niezależny tytuł i slug ProductTranslation.

**Dane**

GET /api/v2/academy/closed-courses; wzorce: courses.closed w config/catalog-fixtures.local.json.

**Kroki**

1. Zaloguj konto z dostępem do kursu.
2. Pobierz listę closed-courses.
3. Znajdź kurs i porównaj title oraz slug z głównym tłumaczeniem.

**Oczekiwany wynik**

- ACADEMY nie używa tłumaczeń WHOLESALE ani EMPIK.

**Odpowiadający test**

Opisy per kanał — kontrola kursów ACADEMY

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-courses.mjs`
- `api-tests/features.mjs`
- `tests/description-courses.test.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Obsługuje pojedynczą stronę (query/expected) oraz wiele jawnych pages, po kilka niezależnych wzorców kursów na stronę. Kontroluje powtórzone identyfikatory między stronami. Brak wzorców daje SKIP. Nie dowodzi pokrycia wszystkich kursów ani dostępu innych kont.

### DESC-019 — ACADEMY — paid-courses

**P1 · Częściowo obsługiwane · Odczyt**

**Wymaganie:** 3.5 — tytuł i slug kursów

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-019. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Konto ACADEMY z referencyjnym kursem widocznym w tej kolekcji.
- Niezależny tytuł i slug ProductTranslation.

**Dane**

GET /api/v2/academy/paid-courses; wzorce: courses.paid w config/catalog-fixtures.local.json.

**Kroki**

1. Zaloguj konto z dostępem do kursu.
2. Pobierz listę paid-courses.
3. Znajdź kurs i porównaj title oraz slug z głównym tłumaczeniem.

**Oczekiwany wynik**

- ACADEMY nie używa tłumaczeń WHOLESALE ani EMPIK.

**Odpowiadający test**

Opisy per kanał — kontrola kursów ACADEMY

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-courses.mjs`
- `api-tests/features.mjs`
- `tests/description-courses.test.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Obsługuje pojedynczą stronę (query/expected) oraz wiele jawnych pages, po kilka niezależnych wzorców kursów na stronę. Kontroluje powtórzone identyfikatory między stronami. Brak wzorców daje SKIP. Nie dowodzi pokrycia wszystkich kursów ani dostępu innych kont.

## Opisy kanałowe — sklep i integracje

### DESC-020 — RETAIL — strona, listy, wyszukiwanie i paginacja

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 2.1/2.2 — rzeczywisty frontend RETAIL

**Warunki wstępne**

- Aktywny produkt QA z odmiennym WHOLESALE.
- Działający frontend RETAIL i kategorie/search.

**Dane**

ProductTranslation i adres strony produktu.

**Kroki**

1. Otwórz stronę produktu, kategorię i wyszukiwanie.
2. Sprawdź name, description, shortDescription i slug w miejscach, które je prezentują.
3. Przejdź między stronami listy i otwórz link produktu.

**Oczekiwany wynik**

- Frontend używa głównych tłumaczeń.
- Link działa, a paginacja nie zamienia ani nie gubi nazw.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Odczyt RETAIL przez API nie potwierdza renderowania szablonów.

### DESC-021 — RETAIL — koszyk, podsumowanie i zapis nazwy

**P1 · Częściowo obsługiwane · Odczyt**

**Wymaganie:** 2.3 — koszyk i zatwierdzone zamówienie RETAIL

**Dowód historyczny:** Zapisany przebieg DEV z 19.10.2026: 2 PASS, 0 FAIL w kontrolach przypisanych do DESC-021. Wynik dotyczy tylko danych i zakresu tego przebiegu; nie oznacza pełnego pokrycia wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.

**Dane**

Nazwa główna i wariant QA w RETAIL.

**Kroki**

1. Sprawdź productName w koszyku API.
2. Osobno przejdź koszyk i podsumowanie w sklepie.
3. Zapisz dedykowane zamówienie i sprawdź utrwaloną nazwę oraz wariant.

**Oczekiwany wynik**

- RETAIL korzysta z ProductTranslation w koszyku, widoku i zapisie.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`

**Ograniczenia:** Automat sprawdza tylko productName w koszyku API, bez complete. Frontend i utrwalony Order nie są potwierdzone.

### DESC-022 — RETAIL — opis SpecialOffer

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 2.4 — shortDescription oferty specjalnej

**Warunki wstępne**

- Referencyjna oferta z dołączonymi produktami i odmiennymi tłumaczeniami kanałowymi.

**Dane**

SpecialOffer i oczekiwany wygenerowany krótki opis.

**Kroki**

1. Otwórz ofertę w RETAIL.
2. Porównaj shortDescription oraz dane dołączonych produktów z oczekiwaniem.

**Oczekiwany wynik**

- Opis jest prawidłowo wygenerowany, z głównymi danymi produktów RETAIL.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Wymagana fixture oferty; zwykły produkt BOOK nie zastępuje tej kontroli.

### DESC-023 — RETAIL — opis Application i liczby dostępów

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 2.4 — aplikacje

**Warunki wstępne**

- Produkt Application z ustaloną liczbą dostępów nauczycieli i uczniów.

**Dane**

Niezależne liczby X/Y oraz oczekiwany opis zamówienia.

**Kroki**

1. Dodaj aplikację w RETAIL i sprawdź opis pozycji.
2. Porównaj wartości dostępu w podsumowaniu i zamówieniu.

**Oczekiwany wynik**

- Opis zawiera właściwe liczby dostępów i dane produktu.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Brak fixture aplikacji i automatu tego mechanizmu.

### DESC-024 — Nazwy produktów w treści PDF

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 5.1 — dokumenty RETAIL/WHOLESALE/ACADEMY

**Warunki wstępne**

- Dedykowane zapisane zamówienia i ekstraktor tekstu PDF.

**Dane**

Główne nazwy dla RETAIL/ACADEMY; nadpisanie i fallback WHOLESALE.

**Kroki**

1. Wygeneruj dokumenty dla wszystkich trzech kanałów.
2. Odczytaj ich treść, nie tylko nagłówek pliku.
3. Porównaj nazwy produktów i wariantów ze wzorcem.

**Oczekiwany wynik**

- Każdy dokument używa właściwego źródła nazwy dla kanału.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Obecny silnik pobiera plik i sprawdza sygnaturę PDF; nie sprawdza jego treści.

### DESC-025 — Nazwy w e-mailach i powiadomieniach

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 5 — RETAIL, WHOLESALE, ACADEMY

**Warunki wstępne**

- Kontrolowana skrzynka testowa i powiązanie wiadomości z konkretnym zamówieniem.

**Dane**

Wzorce nazw dla trzech kanałów, z nadpisaniem i fallbackiem WHOLESALE.

**Kroki**

1. Wywołaj zdarzenie w dedykowanym przebiegu.
2. Odbierz właściwą wiadomość i porównaj treść z danymi kanału.

**Oczekiwany wynik**

- Wiadomość używa właściwych nazw i dotyczy badanego zamówienia.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Brak integracji ze skrzynką/transportem; samo complete nie potwierdza treści ani doręczenia.

### DESC-026 — Generowanie URL dla wszystkich kanałów

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 6.1 — GenerateProductUrlByChannel

**Warunki wstępne**

- Dostęp do rzeczywistego wygenerowanego linku dla każdego kanału.

**Dane**

RETAIL/ACADEMY: slug główny; WHOLESALE/EMPIK: kanałowy lub fallback.

**Kroki**

1. Wywołaj „Pokaż produkt na stronie sklepu” lub właściwy mechanizm generowania URL.
2. Porównaj host, kanał i slug z wzorcem.
3. Dla dostępnego frontendu RETAIL sprawdź otwarcie linku.

**Oczekiwany wynik**

- URL korzysta ze źródła slugu właściwego dla kanału.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Poprawny GET API po podanym slugu nie dowodzi poprawności generatora URL.

### DESC-027 — Tłumaczenia produktów dołączonych do oferty

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 7.1 — SpecialOffer i produkty składowe

**Warunki wstępne**

- Oferta specjalna z referencyjnymi produktami składowymi.

**Dane**

Różne nazwy i slugi główne i WHOLESALE dołączonych produktów.

**Kroki**

1. Odczytaj lub wyświetl ofertę dla RETAIL, ACADEMY i WHOLESALE.
2. Porównaj nazwy i slugi produktów składowych, nie samej oferty.

**Oczekiwany wynik**

- RETAIL i ACADEMY używają ProductTranslation składowych.
- WHOLESALE używa ich nadpisań kanałowych lub fallbacku.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Brak fixture SpecialOffer; zwykłe DTO pojedynczego produktu nie pokrywa mechanizmu oferty.

### DESC-028 — EMPIK — dane oferty przekazane przez OfferUpdater

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** Dostępność kanałów — tylko OfferUpdater

**Warunki wstępne**

- Dostępny izolowany adapter/środowisko testowe OfferUpdater.

**Dane**

Nazwy, slugi i opisy EMPIK oraz wariant fallback.

**Kroki**

1. Przygotuj kontrolowany odbiornik aktualizacji oferty.
2. Sprawdź wysyłane dane bez aktualizacji produkcyjnej oferty.

**Oczekiwany wynik**

- OfferUpdater używa ProductChannelTranslation EMPIK lub fallbacku.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Według przekazanego wymagania brak serwera testowego Empik. Nie uruchamiamy aktualizacji produkcyjnej; przypadek jest zablokowany warunkiem środowiska.

### DESC-029 — OutOfStockSubscriber — nazwa w RETAIL

**P1 · Do automatyzacji · Odczyt**

**Wymaganie:** 8.1 — powiadomienie o dostępności

**Warunki wstępne**

- Dedykowany produkt i kontrolowany odbiornik powiadomienia.

**Dane**

Główna nazwa RETAIL przy odmiennym WHOLESALE.

**Kroki**

1. Zarejestruj testowe powiadomienie i wywołaj odpowiednie zdarzenie dostępności.
2. Porównaj nazwę w wygenerowanej wiadomości.

**Oczekiwany wynik**

- Powiadomienie RETAIL korzysta z ProductTranslation.

**Odpowiadający test**

Test ręczny / do automatyzacji

- `docs/product-channel-scenarios.json`

**Ograniczenia:** Brak izolowanego testu subscriber i odbiornika wiadomości; nie zmieniamy zapasów współdzielonych produktów.

## Endpointy

Adres bazowy: https://ksiegarnia.gwodev.pl/api/v2

| Metoda | Ścieżka | Zastosowanie |
| --- | --- | --- |
| POST | `/shop/authentication-token` | Logowanie hurtownika |
| POST | `/shop/orders` | Utworzenie koszyka |
| GET | `/shop/orders/{token}` | Odczyt koszyka lub zamówienia |
| POST | `/shop/orders/{token}/items/bulk` | Dodanie produktów |
| PATCH | `/shop/orders/{token}/items/{item_id}` | Zmiana ilości |
| DELETE | `/shop/orders/{token}/items/{item_id}` | Usunięcie pozycji |
| GET | `/wholesale/orders/{token}/payments` | Dostępne płatności i rabaty |
| PATCH | `/wholesale/orders/{token}/payment-method` | Wybór płatności |
| GET | `/wholesale/checkout-step-two/{token}` | Dostępne dostawy |
| POST | `/wholesale/checkout-step-two/{token}` | Zapis dostawy i adresów |
| PATCH | `/shop/orders/{token}/complete` | Zatwierdzenie zamówienia |
| GET | `/shop/products-dto` | Nazwy i slugi w listach poszczególnych kanałów |
| GET | `/shop/products-dto-by-slug/{slug}` | Nazwa, slug, pełny i krótki opis |
| GET | `/academy/closed-courses` | Automat DESC-018 — główny tytuł i slug, wymaga wzorców kursów i potwierdzonej struktury odpowiedzi |
| GET | `/academy/paid-courses` | Automat DESC-019 — główny tytuł i slug, wymaga wzorców kursów i potwierdzonej struktury odpowiedzi |
| GET | `https://cms-ksiegarnia.gwodev.pl/products/{id}/edit` | Odczyt formularza, pól kanałów i potwierdzenie zapisu |
| POST | `https://cms-ksiegarnia.gwodev.pl/products/{id}/edit` | Zapis, walidacja i przywracanie czterech pól opisów QA z aktualnym CSRF i Referer |

## Nagłówki

- X-Api-Channel: WHOLESALE
- X-Tests-Token: wartość lokalna
- Authorization: Bearer JWT właściwego konta, poza samym logowaniem
- Accept: application/json
- Content-Type: application/json dla POST; application/merge-patch+json dla PATCH

## Zapis wyniku pojedynczego wykonania

- Data i wersja backendu
- ID scenariusza i wariant parametrów
- Konto A/B lub identyfikator testowego użytkownika
- ID koszyka i numer zamówienia, jeżeli zapisano
- Oczekiwane i otrzymane HTTP
- Wartości przed i po wraz z jednostką
- Wynik każdego warunku oraz wynik przypadku
- Link do raportu, odpowiedzi lub zgłoszenia bez sekretów
