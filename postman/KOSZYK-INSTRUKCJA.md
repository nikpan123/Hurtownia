# Kolekcja koszyka hurtowego — komplet endpointów

Importuj `HURTOWNIA - Koszyk - komplet endpointow.postman_collection.json` do Postmana. To nowa, czysta wersja przesłanej kolekcji, bez haseł, JWT i cookies. Oryginalny plik z Downloads pozostaje bez zmian.

## Pierwsze uruchomienie

1. W Variables kolekcji wpisz lokalnie `hurtownia_email`, `hurtownia_api_password` i `tests_token`.
2. Zachowaj działającą sesję bramki GitLab w Postmanie. Cookies z przeglądarki nie są automatycznie cookies Postmana. HTML lub przekierowanie zamiast JSON przerywa przebieg.
3. Sprawdź `product_pool_json` i oba adresy testowe. Pula zawiera znane warianty 5lp-1, POP1, D087, D090; dostępność w sprzedaży może się zmieniać. Kody wariantów nie zawsze są kodami handlowymi.
4. Uruchom folder **01** od pierwszego kroku, jedną iteracją. Wszystkie dodatkowe flagi są domyślnie `false`. Używaj aktualnego Postmana z `pm.execution.skipRequest()` i wyłącz śledzenie przekierowań.
5. Wyniki oglądaj w Test Results, a podsumowanie w Visualize przy GET koszyka. Kwoty są w groszach.

Przy wysyłaniu pojedynczych żądań przyciskiem Send skrypty nadal wymagają wcześniejszych kroków. Przejścia przez `setNextRequest` działają w Runnerze, nie wykonują za użytkownika kolejnego Send. Dotyczy to zwłaszcza pętli usuwania dwóch nowych adresów QA.

## Foldery i flagi

| Folder | Włączenie i działanie |
| --- | --- |
| 01 — koszyk | Logowanie, nowy koszyk, losowanie jednej grupy produktów, edycja ilości, płatność, dostawa, adresy, podsumowanie. Domyślnie bez finalizacji |
| 01 — zapis i PDF | `enable_complete=true`: zapisuje zamówienie; może wysłać e-mail i transfer. GET po zapisie można wysłać ręcznie również po niepewnej odpowiedzi, bez ponawiania PATCH |
| 01 — drugie complete | Dodatkowo `enable_repeat_complete=true`: jedna jawna druga próba po potwierdzonym zapisie z numerem. Nie jest automatycznym retry po timeout |
| 02 — dodawanie/usuwanie | `run_mutations=true`: osobny koszyk, sumowanie powtórnego dodania, DELETE pozycji i GET po usunięciu |
| 03 — logowanie/JWT | `run_auth_tests=true`: jedno błędne hasło, sześć odczytów bez ważnego JWT, kontrola niezmienności właściciela |
| 04 — walidacja adresów | `run_address_validation=true`: trzy osobne koszyki — brak shippingAddress, brak billingAddress, nieistniejąca dostawa; oczekiwane 400/422, 500 daje FAIL |
| 05 — izolacja | `run_isolation=true` i `hurtownia_email_b`: B odczytuje płatności nowego koszyka A; odmowa 403/404 i porównanie stanu jako A. Hasło/token B można podać osobno lub użyć wspólnych |
| 06 — książka | `run_address_book=true`: odczyt baseline, tworzenie dwóch nowych adresów QA, odłączenie ich od koszyka, DELETE tylko ich ID i kontrola sprzątnięcia. Nie zmienia adresów domyślnych |
| 07 — katalog | `run_catalog=true`: lista DTO i szczegóły po slugu, tylko odczyt |

Uruchom wcześniej folder 01, aby pozostałe miały prawidłowy JWT i plan produktów. Dodatkowe foldery nie są pełną kopią wszystkich 44 scenariuszy panelu. Kolekcja ma 81 zdefiniowanych żądań; liczba faktycznie wykonanych zależy od flag i pętli. Nie uruchamiaj jej równolegle z drugim Runnerem używającym tych samych zmiennych.

## Wzorce i interpretacja

- `expected_rebates_json` uzupełnij rabatami konkretnego konta, np. `{"cash_on_delivery":50,"adamada":10}`. `{}` oznacza kontrolę spójności rabatu z ofertą API, a pominięcie niezależnego wzorca. Nie wpisuj rabatów pierwszego konta dla innego użytkownika.
- `preferred_payment_code` i `preferred_shipping_code`: puste oznaczają losowanie z otrzymanych opcji. Podany kod musi być aktualnie dostępny; kolekcja nie zastępuje go po cichu innym.
- `require_empty_checkout_body=true` wymaga dokładnie pustego body po HTTP 204 No Content zgodnie z aktualnym #36926. Odpowiedź `[]` spowoduje FAIL tej kontroli. Domyślne `false` nie ocenia tego spornego formatu, tylko dalszy odczyt zapisu.
- `carrierName` jest przesyłany w shippingAddress. Jeżeli GET zwraca `notes`, jest sprawdzany dopisek „Przewoźnik: …”. Brak tego pola daje SKIP odczytu; sprawdź sekcję „Uwagi” w Syliusie. Użytkownik potwierdził ręcznie poprawny zapis i prezentację w swoim przebiegu z 19.10.2026.
- GET po odrzuconych danych sprawdza brak częściowej zmiany; sam HTTP 4xx nie wystarcza. Nie odgadujemy reguły netto z jednostkowej ceny brutto. Pobranie PDF nie weryfikuje treści dokumentu ani wysłania e-maila.

## Książka adresowa i niepewna finalizacja

Książka mająca 100 lub więcej wpisów albo kolejną stronę jest celowo blokowana przed sprzątaniem — ta kolekcja nie ma pełnej pętli paginacji książki. GET musi też ujawnić identyfikatory obu odłączonych adresów, aby DELETE było dozwolone. Nie usuwaj ręcznie starych adresów, aby „odblokować” test.

Przerwanie Runnera lub błąd w środku próby może pozostawić nowe adresy QA. Ich firmy mają unikalny `runMarker`; sprawdź pozostałości. Nie deklarujemy gwarantowanego sprzątania po zamknięciu Postmana.

Po timeoutcie complete nie uruchamiaj go ponownie na tym samym koszyku. Najpierw wykonaj GET po zapisie lub sprawdź CMS według `orderId`. Zmienna `completeAttempted` blokuje kolejną próbę. Nowy krok 01.01 oznacza nowy przebieg i czyści runtime — nie służy do diagnozowania poprzedniego zamówienia.

## Endpointy

Wszystkie ścieżki API poniżej mają bazę `https://ksiegarnia.gwodev.pl/api/v2`. Token koszyka nie jest jego numerycznym ID.

| Metoda | Ścieżka | Zastosowanie |
| --- | --- | --- |
| POST | `/shop/authentication-token` | Logowanie A/B i próba błędnego hasła |
| POST | `/shop/orders` | Nowy koszyk |
| POST | `/shop/orders/{token}/items/bulk` | Produkty i ponowne dodanie |
| GET | `/shop/orders/{token}` | Plan, ilości, rabaty, sumy, stan po błędzie i po zapisie |
| PATCH | `/shop/orders/{token}/items/{itemId}` | Ilość |
| DELETE | `/shop/orders/{token}/items/{itemId}` | Usunięcie pozycji |
| GET | `/wholesale/orders/{token}/payments` | Dostępne płatności, rabaty i izolacja |
| PATCH | `/wholesale/orders/{token}/payment-method` | Wybór płatności |
| GET | `/wholesale/checkout-step-two/{token}` | Dostępne dostawy |
| POST | `/wholesale/checkout-step-two/{token}` | Adresy, dostawa, walidacja i zapis do książki |
| PATCH | `/shop/orders/{token}/complete` | Opcjonalna finalizacja i jawny test ponowienia |
| GET | `/shop/addresses?page=1&limit=100` | Książka adresowa |
| DELETE | `/shop/addresses/{id}` | Tylko nowe, odłączone adresy QA tej próby |
| GET | `/shop/products-dto` | Pomocnicza lista produktów |
| GET | `/shop/products-dto-by-slug/{slug}` | Pomocnicze szczegóły produktu |
| GET | URL `pdfSummary` zwrócony przez API | PDF podsumowania, poza prefiksem `/api/v2` |
| GET | URL `paymentForm` zwrócony przez API | Druczek płatności, jeżeli udostępniony |

Nie ma tu endpointów admin API, konfiguracji CMS, SQL ani phpMyAdmin. Nie są to endpointy koszyka. Dokumenty są pobierane wyłącznie z `/orders/` na tym samym hoście DEV.

## Utrzymanie

Źródła: `build-cart.mjs` oraz `cart-scripts.mjs`. Ponowne wygenerowanie czystego pliku: `node postman/build-cart.mjs`. Skrypty i przepływy są sprawdzane lokalnie na symulowanych odpowiedziach w `tests/postman-cart.test.mjs`; nie oznacza to wykonania scenariuszy na DEV ani uruchomienia ich w aplikacji Postman.

Po rzeczywistym wykonaniu Variables mogą zawierać JWT i tokeny koszyków. Do udostępniania używaj wygenerowanego czystego pliku, nie eksportu z uzupełnionymi sekretami.

Dokumentacja Postmana: [sterowanie wykonywaniem i skipRequest](https://learning.postman.com/v11/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution).
