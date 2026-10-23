# Scenariusze testowe API koszyka hurtowego

Aktualizacja: 2026-10-19

Koszyk WHOLESALE, płatności, dostawy, paczki, izolacja kont, finalizacja i odczyt bazy. Katalog opisuje warunki do sprawdzenia; nie jest wynikiem uruchomienia testów.

**To katalog scenariuszy, a nie raport wykonania.** Status automatyzacji opisuje dostępny kod; nie oznacza wyniku PASS.

## Warunki wspólne

- Testy wykonuj na DEV. Środowisko gwotest wymaga wdrożenia zmian i osobnego dopuszczenia.
- Dane dostępowe, token testowy i sesję GitLab przechowuj lokalnie. Dokument nie zawiera prawdziwych haseł ani JWT.
- Każdy niezależny przypadek i wariant negatywny zaczynaj od nowego koszyka. Nie współdziel koszyka między próbami izolacji.
- Przed porównaniem skutków ustabilizuj poprawny stan koszyka i zapisz wybrane metody oraz rabaty.
- Potwierdź aktualne dane produktu, ceny, VAT, grupę i rabaty kont w CMS. Wartości przykładowe nie zastępują aktualnego wzorca.
- Zapis zamówienia, e-mail i transfer są wykonywane tylko na dedykowanych kontach testowych. Odczyt bazy wymaga osobnego dostępu.

## Zasady interpretacji

- Opis automatyzacji mówi o pokryciu kodem, nie o bieżącym wyniku API. Żaden przypadek nie uzyskuje PASS przez samo umieszczenie w katalogu.
- Wykonanie zapisuj jako PASS, FAIL, SKIP lub BLOCKED. W raportach narzędzia brak warunku bywa zapisany jako SKIP z przyczyną.
- INCOMPLETE opisuje niepełne pokrycie przebiegu bez FAIL. Liczby przypadków w katalogu nie są liczbą asercji ani nowych zamówień.
- Dla negatywnego żądania oceniaj osobno brak przyjęcia danych, status HTTP oraz brak nieoczekiwanej zmiany koszyka.
- HTTP 403/404 w izolacji nie wystarcza: wymagany jest również niezmieniony stan właściciela.
- Powrót prawidłowej kwoty przy complete nie usuwa błędu wcześniejszego podsumowania. Bieżący koszyk i utrwalone zamówienie oceniaj osobno.
- Pobranie pliku PDF nie potwierdza jego treści ani dostarczenia e-maila.
- Znane obserwacje z 16.10.2026 są punktami do ponownej weryfikacji, a nie deklaracją aktualnego stanu serwera.

## Przygotowanie danych

- Przykładowy zestaw A: przelew 23%, odbiór 50%, przelew 1-dniowy 75%, terminowa 25%, Adamada 10%.
- Przykładowy zestaw B: 47%, 13%, 30.5%, 90%, Adamada 20% w tej samej kolejności.
- Własny użytkownik ma rabaty odczytywane z CMS; nie wolno przypisywać mu automatycznie wzorca A lub B.
- Przykładowy GLS: W=8000 g, produkt 210 g. Uzupełnij potwierdzone przedziały i ceny, VAT oraz dopłatę płatności przed sprawdzaniem kosztu.

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
| PAY-007 | API hurtowni — zaokrąglenia 1 i 6 sztuk (#36944) | P1 | Obsługiwane przez automat |
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

### PAY-007 — API hurtowni — zaokrąglenia 1 i 6 sztuk (#36944)

**P1 · Obsługiwane przez automat · Zmiana koszyka**

**Warunki wstępne**

- Produkt referencyjny 18.40 zł brutto, VAT 5%, cena oryginalna równa cenie, minimum price=0.
- Dostępna płatność z potwierdzonym rabatem 23%.

**Dane**

Produkt 5lp-1; 1 i 6 sztuk; 18,40 zł brutto, VAT 5%, rabat 23%.

**Kroki**

1. Potwierdź cenę i rabat referencyjny.
2. Dodawaj ustalone ilości i odczytuj wycenę.
3. Dla 1 sztuki sprawdź 13.49 zł netto po rabacie.
4. Dla 6 sztuk sprawdź 84.99 zł brutto po rabacie.

**Oczekiwany wynik**

- Dla 1 sztuki discountedUnitPriceNet = 1349 gr (13,49 zł netto).
- Dla 6 sztuk total pozycji = itemsTotal = 8499 gr (84,99 zł brutto produktów), bez dostawy.
- Brak dostępnego rabatu 23% daje SKIP z przyczyną; niezgodność kwoty daje FAIL.

**Odpowiadający test**

API hurtowni — 1 i 6 sztuk (HURT-36944-01 / HURT-36944-02)

**API hurtowni — 1 i 6 sztuk:** Dwa koszyki WHOLESALE produktu 5lp-1 za 18,40 zł brutto; hurtownik HURT_ROUNDING_EMAIL z rabatem 23%. Bez finalizacji i zmian CMS. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/redmine-36944.mjs`

**Ograniczenia:** Wyłącznie API nowej hurtowni; bez RETAIL, CMS i finalizacji. Konto dedykowane w HURT_ROUNDING_EMAIL.

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

**P1 · Częściowo obsługiwane · Tymczasowa zmiana CMS**

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
