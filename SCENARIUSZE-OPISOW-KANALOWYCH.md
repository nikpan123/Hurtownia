# Scenariusze opisów produktów w kanałach sprzedaży

Aktualizacja: 2026-10-20

Pełna lista obszarów z przekazanej ściągawki: CMS, API, frontend, dokumenty, URL i integracje. Kodem pokryto część API; katalog nie oznacza wykonania wszystkich przypadków.

**To katalog scenariuszy, a nie raport wykonania.** Status automatyzacji opisuje dostępny kod; nie oznacza wyniku PASS.

## Warunki wspólne

- Źródło: przekazany opis „Zarządzanie opisami produktów per kanał (EMPIK, WHOLESALE)”, 19.10.2026.
- EMPIK nie jest kanałem do testowania przez shop API. Brak jego serwera testowego nie daje podstawy do aktualizacji produkcyjnej oferty.

## Zasady interpretacji

- RETAIL i ACADEMY zawsze korzystają z ProductTranslation. ProductChannelTranslation dotyczy WHOLESALE i EMPIK.
- PASS odpowiedzi API nie potwierdza formularza CMS, frontendu, treści PDF, e-maila ani OfferUpdater.

## Przygotowanie danych

- Wzorce w config/catalog-fixtures.local.json muszą pochodzić z CMS: produkt fallback oraz produkt z odmiennym WHOLESALE.
- variantName wymaga niezależnej wartości w fixture; jej brak powoduje SKIP.
- Historyczny przebieg DEV z 16.10.2026: 18 PASS, 11 SKIP. To historyczny dowód zakresu API, nie aktualny wynik wszystkich 29 scenariuszy.
- Kursy ACADEMY: courses.closed i courses.paid. Puste expected daje SKIP; itemsPath/identityPath/titlePath/slugPath i query należy potwierdzić na rzeczywistej odpowiedzi. Przykład konfiguracji: config/catalog-fixtures.example.json.
- Zestaw descriptions-cms ma osobną konfigurację description-cms.local.json i plik awaryjnego przywracania .auth/description-cms-restore.json. Nie edytuj równocześnie produktu QA.
- 19.10.2026: zestaw formularza CMS wykonał 15 kontroli PASS, łącznie z potwierdzeniem przywrócenia pól QA. Nazwy obu wariantów QA są zdefiniowane; brak variantName w odpowiedzi API koszyka daje FAIL, a nie SKIP.
- 20.10.2026: użytkownik wskazał ofertę CMS /admin/special-offers/7/edit i stronę /product/test321321, produkty 10202/testhurtA i 10203/testhurtB do testów oraz MailHog https://mailhog.gwodev.pl/. Domyślne fixture zestawu web zawierają te dane. Konto RETAIL: wskazane przez użytkownika konto podstawowe; hasła nie są zapisywane w katalogu.
- MailHog ładuje dane asynchronicznie. Początkowe Inbox (0) nie jest dowodem pustej skrzynki. Test wiadomości musi czekać na odpowiedź/dostarczenie i identyfikować nową próbę po odbiorcy oraz unikalnym zamówieniu/znaczniku. Nie usuwać wspólnej skrzynki ani nie zaliczać testu na starej wiadomości.
- Dokumenty i poczta: npm run descriptions:documents zapisuje jedno zamówienie QA WHOLESALE. Wymaga konta podstawowego, poprawnych adresów QA, sesji MailHog oraz ekstraktora pypdf. PDF pozostaje w raporcie, zamówienie na DEV. Nie ponawiaj complete po nieustalonym wyniku. Obsługa MailHoga oparta na oficjalnym GET /api/v2/search (kind=to), z paginacją i dokładnym sprawdzeniem odbiorcy.
- Potwierdzenie zamówienia nie musi zawierać numeru ani nazw produktów w samym body. Dla zweryfikowanego szablonu dane są w MIME podsumowanie.pdf. Odczytuj pełny MIME (także korzeń message.MIME), porównaj numer zamówienia i nazwę w tekście załącznika. Nie uznawaj bezskutecznego wyszukania numeru w body za brak wysyłki.
- Aplikacja referencyjna: Matlandia. Klasa 4, CMS 129, slug matlandia-klasa-4, osobna sesja RETAIL. Produkt AplikacjaQA 10215 zwrócił HTTP 500 w szablonie teacher-packet; nie zastępuje sprawnego wzorca.

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
| DESC-001 | Zakładka kanałowa i dostępne EMPIK/WHOLESALE | P1 | Obsługiwane przez automat |
| DESC-002 | Ukrycie zakładki dla ofert i szkoleń | P1 | Obsługiwane przez automat |
| DESC-003 | Edycja i trwały zapis czterech pól kanałowych | P1 | Częściowo obsługiwane |
| DESC-004 | Puste pola i fallback każdego pola osobno | P1 | Częściowo obsługiwane |
| DESC-005 | Kolizja slugu w tym samym kanale | P1 | Częściowo obsługiwane |
| DESC-006 | Slug kanałowy równy głównemu slugowi | P1 | Częściowo obsługiwane |
| DESC-007 | Ten sam slug w EMPIK i WHOLESALE | P1 | Częściowo obsługiwane |
| DESC-008 | Minimalna długość nazwy kanałowej | P1 | Częściowo obsługiwane |
| DESC-009 | Maksymalna długość slugu kanałowego | P1 | Częściowo obsługiwane |
| DESC-010 | Nowy produkt bez tłumaczeń i ich późniejsze dodanie | P1 | Obsługiwane przez automat |
| DESC-011 | WHOLESALE — nazwa i slug na liście, nadpisanie i fallback | P0 | Obsługiwane przez automat |
| DESC-012 | WHOLESALE — cztery pola szczegółów, nadpisanie i fallback | P0 | Obsługiwane przez automat |
| DESC-013 | RETAIL — główne tłumaczenia w API | P0 | Obsługiwane przez automat |
| DESC-014 | ACADEMY — główne tłumaczenia na liście i w szczegółach | P0 | Obsługiwane przez automat |
| DESC-015 | WHOLESALE — productName w koszyku | P0 | Obsługiwane przez automat |
| DESC-016 | ACADEMY — productName w koszyku | P0 | Obsługiwane przez automat |
| DESC-017 | Nazwa wariantu w pozycjach API | P1 | Częściowo obsługiwane |
| DESC-018 | ACADEMY — closed-courses | P1 | Częściowo obsługiwane |
| DESC-019 | ACADEMY — paid-courses | P1 | Częściowo obsługiwane |
| DESC-020 | RETAIL — strona, listy, wyszukiwanie i paginacja | P1 | Częściowo obsługiwane |
| DESC-021 | RETAIL — koszyk, podsumowanie i zapis nazwy | P1 | Częściowo obsługiwane |
| DESC-022 | RETAIL — opis SpecialOffer | P1 | Obsługiwane przez automat |
| DESC-023 | RETAIL — opis Application i liczby dostępów | P1 | Częściowo obsługiwane |
| DESC-024 | Nazwy produktów w treści PDF | P1 | Częściowo obsługiwane |
| DESC-025 | Nazwy w e-mailach i powiadomieniach | P1 | Częściowo obsługiwane |
| DESC-026 | Generowanie URL dla wszystkich kanałów | P1 | Częściowo obsługiwane |
| DESC-027 | Tłumaczenia produktów dołączonych do oferty | P1 | Częściowo obsługiwane |
| DESC-028 | EMPIK — dane oferty przekazane przez OfferUpdater | P1 | Do automatyzacji |
| DESC-029 | OutOfStockSubscriber — nazwa w RETAIL | P1 | Częściowo obsługiwane |

## Opisy kanałowe — CMS

### DESC-001 — Zakładka kanałowa i dostępne EMPIK/WHOLESALE

**P1 · Obsługiwane przez automat · Zmiana danych CMS**

**Wymaganie:** 1.1 — widoczność zakładki i kanałów

**Dowód historyczny:** 20.10.2026: wykonane kontrole WWW przeszły. Zestaw: 13 PASS, 7 SKIP i brak FAIL. Ukrycie sekcji dla oferty i szkoleń, widoczność dla zwykłego produktu, strony A/B, wyszukiwarka Matlandii, dwie strony listy i linki. Zakresy częściowe nie oznaczają zaliczenia całego wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-10-50-576Z-4d7bb556/raport.html)

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

**Sprawdź CMS i frontend RETAIL:** Odczyt formularzy oferty i szkoleń oraz frontendu RETAIL: nazwy, slugi, pełne opisy A/B i Matlandii, wyszukiwarka, paginacja, kategoria Matematyka i niepusty krótki opis Matlandii. Wzorzec z głównych pól CMS. Bez zmian produktów, koszyków i finalizacji. Wymaga config/description-web.local.json. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-cms.mjs`
- `tests/description-cms.test.mjs`
- `api-tests/description-web.mjs`

**Ograniczenia:** Odczytowy automat WWW potwierdza widoczną sekcję zwykłego produktu oraz pola EMPIK/WHOLESALE. Osobny zestaw CMS sprawdza zapis i walidacje. Nie testuje każdego widgetu JavaScript.

### DESC-002 — Ukrycie zakładki dla ofert i szkoleń

**P1 · Obsługiwane przez automat · Zmiana danych CMS**

**Wymaganie:** 1.1 — SpecialOffer, szkolenia rad i nauczycieli

**Dowód historyczny:** 20.10.2026: wykonane kontrole WWW przeszły. Zestaw: 13 PASS, 7 SKIP i brak FAIL. Ukrycie sekcji dla oferty i szkoleń, widoczność dla zwykłego produktu, strony A/B, wyszukiwarka Matlandii, dwie strony listy i linki. Zakresy częściowe nie oznaczają zaliczenia całego wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-10-50-576Z-4d7bb556/raport.html)

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

Opisy kanałowe — CMS i frontend RETAIL

**Sprawdź CMS i frontend RETAIL:** Odczyt formularzy oferty i szkoleń oraz frontendu RETAIL: nazwy, slugi, pełne opisy A/B i Matlandii, wyszukiwarka, paginacja, kategoria Matematyka i niepusty krótki opis Matlandii. Wzorzec z głównych pól CMS. Bez zmian produktów, koszyków i finalizacji. Wymaga config/description-web.local.json. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-web.mjs`
- `config/description-web.example.json`

**Ograniczenia:** Automat potwierdza tożsamość formularza i brak zakładki/pól channelTranslations dla oferty 7, szkolenia dla nauczycieli 347 i szkolenia dla rad 6614. Nie edytuje tych obiektów.

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

**P1 · Obsługiwane przez automat · Zmiana danych CMS**

**Wymaganie:** 1.2 — nowy produkt i ProductChannelTranslation

**Dowód historyczny:** 20.10.2026: 4 PASS. Utworzono ukryty produkt 10216; SELECT potwierdził 0 rekordów kanałowych przed dodaniem i 2 po dodaniu, z dokładną zgodnością czterech pól każdego kanału. Produkt nieaktywny, niewidoczny i bez sprzedaży EMPIK. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-03-32-948Z-fdc1cc88/raport.html)

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

Utwórz ukryty produkt QA i sprawdź tłumaczenia

**Utwórz ukryty produkt QA i sprawdź tłumaczenia:** Jeden nowy nieaktywny produkt BOOK. Puste pola i zero rekordów kanałowych, potem zapis czterech pól obu kanałów oraz CMS i SELECT. Produkt pozostaje na DEV. Bez publikacji i zamówień. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-new-product.mjs`
- `api-tests/description-web.mjs`
- `tests/description-new-product.test.mjs`

**Ograniczenia:** Tworzy nowy ukryty BOOK; puste pola i zero rekordów w bazie, dodanie czterech pól WHOLESALE/EMPIK oraz CMS i SELECT. Tylko DEV; produkt pozostaje nieaktywny i niewidoczny.

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

**P1 · Częściowo obsługiwane · Odczyt**

**Wymaganie:** 2.1/2.2 — rzeczywisty frontend RETAIL

**Dowód historyczny:** 20.10.2026, nowy odczyt CMS i frontendu RETAIL: 17 PASS, 0 FAIL, 6 SKIP innych modułów. Pełne opisy A/B i aplikacji oraz nazwa, slug i niepusty krótki opis Matlandii w kategorii Matematyka. Bez zmian produktów i bez finalizacji. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T09-49-29-061Z-4198cb30/raport.html)

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

Opisy kanałowe — CMS i frontend RETAIL

**Sprawdź CMS i frontend RETAIL:** Odczyt formularzy oferty i szkoleń oraz frontendu RETAIL: nazwy, slugi, pełne opisy A/B i Matlandii, wyszukiwarka, paginacja, kategoria Matematyka i niepusty krótki opis Matlandii. Wzorzec z głównych pól CMS. Bez zmian produktów, koszyków i finalizacji. Wymaga config/description-web.local.json. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-web.mjs`
- `config/description-web.example.json`

**Ograniczenia:** Pełne teksty opisów A/B (również pusty) i niepusty opis Matlandii; nazwa i slug A/B; wyszukiwarka Matlandii; dwie kolejne strony listy (10 + 10, bez duplikatów); rzeczywisty filtr Matematyka, wszystkie strony wyniku do limitu 8 oraz nazwa, slug i cały niepusty krótki opis Matlandii względem CMS. Inne produkty kategorii nie są niezależnie porównywane z CMS. Brak kontrolowanej zmiany WHOLESALE w tym odczytowym module; nie potwierdza izolacji po nowej mutacji. Podsumowanie, zapis Order i dokumenty mają osobny zakres.

### DESC-021 — RETAIL — koszyk, podsumowanie i zapis nazwy

**P1 · Częściowo obsługiwane · Odczyt**

**Wymaganie:** 2.3 — koszyk i zatwierdzone zamówienie RETAIL

**Dowód historyczny:** 20.10.2026, próba wspomagana z logowaniem użytkownika: RETAIL #30001631, 57,34 zł, Matlandia — 1 dostęp nauczycielski i 11 uczniowskich. Cztery kontrole PASS: poprawna nazwa wariantu w podsumowaniu, zapis CMS, potwierdzenie PDF i nowy e-mail z takim samym tekstem załącznika. Nie jest to dowód pełnego automatycznego logowania, faktur ani innych wariantów/kanałów. Automat samego podsumowania również przeszedł (20.10.2026), z logowaniem przed utworzeniem i potwierdzonym usunięciem własnej pozycji QA. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T10-02-46-041Z-f35d6c21/raport.html)

**Warunki wstępne**

- Dwa niezależne wzorce QA: bez tłumaczenia kanałowego i z odmiennym WHOLESALE.
- Potwierdzone w CMS name, slug, description/descriptionContains i shortDescription; aktywne kanały.
- W wariancie tworzącym RETAIL: pusty koszyk oraz brak równoległych logowań na to konto.

**Dane**

Nazwa główna i wariant QA w RETAIL.

**Kroki**

1. Sprawdź productName w koszyku API.
2. Osobno przejdź koszyk i podsumowanie w sklepie.
3. Zapisz dedykowane zamówienie i sprawdź utrwaloną nazwę oraz wariant.

**Oczekiwany wynik**

- RETAIL korzysta z ProductTranslation w koszyku, widoku i zapisie.
- Dla aplikacji w podsumowaniu poprawna jest nazwa wybranego wariantu zgodna z jawnym wzorcem; nie wymagamy dodatkowej nazwy produktu w tej kolumnie.

**Odpowiadający test**

Opisy per kanał — zestaw API

**Uruchom test opisów per kanał:** Cały zestaw API dla WHOLESALE, RETAIL i ACADEMY. Tworzy koszyki na koncie skonfigurowanym w scenariuszu; bez complete, zmian CMS i wysyłek. Nie testuje frontendów ani Empika. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Sprawdź opisy aplikacji i oferty w koszykach RETAIL:** Dwie odrębne sesje i koszyki: Matlandia 129 (1 dostęp nauczycielski + 11 uczniowskich), oferta 7 (2 A + 2 B). Czeka na przeliczenia konfiguratora. Bez complete i wysyłek. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Sprawdź nazwę w podsumowaniu RETAIL:** Loguje Moje GWO przed dodaniem QA i wymaga pustego koszyka. Tworzy Matlandię: 1 dostęp nauczycielski i 11 uczniowskich, sprawdza nazwę wariantu w podsumowaniu. Bez regulaminu i finalizacji. Po próbie usuwa własną pozycję po dokładnym ID i potwierdza pusty koszyk. Wymaga RETAIL_LOGIN_EMAIL i RETAIL_LOGIN_PASSWORD w .env. Etap danych przygotowuje aktualnym formularzem HTTP; nie testuje przycisku przejścia z koszyka. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Zapisz RETAIL i sprawdź PDF oraz e-mail:** Tworzy jedno zamówienie Matlandii RETAIL, akceptuje regulamin na DEV i wybiera przelew bankowy (bez zapłaty). Wymaga osobnych danych RETAIL_LOGIN_EMAIL / RETAIL_LOGIN_PASSWORD w .env. Sprawdza podsumowanie, zapis CMS, PDF i załącznik nowego e-maila. Nie ponawia utraconego zapisu; nie usuwa istniejących pozycji. Nie jest uruchamiany przez zestaw zbiorczy WHOLESALE. Logowanie następuje przed dodaniem QA; wymaga pustego koszyka i braku równoległego używania konta. Przed finalizacją sprząta własną pozycję po błędzie; po nieustalonym wyniku zapisu niczego nie usuwa. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/features.mjs`
- `api-tests/description-scenarios.mjs`
- `tests/features.test.mjs`
- `api-tests/description-retail-cart.mjs`
- `api-tests/description-retail-cart.mjs`
- `api-tests/description-retail-documents.mjs`

**Ograniczenia:** API sprawdza productName w koszyku. Dodatkowy automat frontendu sprawdza koszyk Matlandii oraz opis dostępów 1 + 11. Podsumowanie i zapis Order RETAIL nadal wymagają osobnego testu. Podsumowanie aplikacji może poprawnie pokazywać samą nazwę wariantu: Matlandia — Dostęp nauczycielski 2 lata (ustalenie użytkownika 20.10.2026). Automat podsumowania wymaga oddzielnego logowania RETAIL w .env; ten przebieg nie finalizuje. Osobny wariant RETAIL: Matlandia, wzorzec nazwy wariantu, 11 dostępów uczniowskich, jedno zamówienie i potwierdzenie PDF/nowego e-maila. Nie obejmuje faktur i innych wariantów.

### DESC-022 — RETAIL — opis SpecialOffer

**P1 · Obsługiwane przez automat · Odczyt**

**Wymaganie:** 2.4 — shortDescription oferty specjalnej

**Dowód historyczny:** 20.10.2026: 2 PASS w dwóch osobnych koszykach RETAIL. Matlandia: główna nazwa i opis 1 + 11. Oferta: opis 2 x A i 2 x B z głównymi nazwami CMS. Bez podsumowania i zapisu zamówienia. Przyciski oferty są sprawdzane po zakończeniu przeliczenia. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-10-15-175Z-487849e9/raport.html)

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

**Sprawdź opisy aplikacji i oferty w koszykach RETAIL:** Dwie odrębne sesje i koszyki: Matlandia 129 (1 dostęp nauczycielski + 11 uczniowskich), oferta 7 (2 A + 2 B). Czeka na przeliczenia konfiguratora. Bez complete i wysyłek. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `docs/product-channel-scenarios.json`
- `api-tests/description-retail-cart.mjs`
- `tests/description-retail-cart.test.mjs`

**Ograniczenia:** Potwierdzono wygenerowany opis oferty 7 w koszyku RETAIL: 2 A + 2 B, dokładne główne nazwy i ilości. Oczekiwanie na gotowy komponent i odpowiedzi przeliczeń. Inne oferty i kanały poza zakresem.

### DESC-023 — RETAIL — opis Application i liczby dostępów

**P1 · Częściowo obsługiwane · Zmiana koszyka**

**Wymaganie:** 2.4 — aplikacje

**Dowód historyczny:** 20.10.2026: 2 PASS w dwóch osobnych koszykach RETAIL. Matlandia: główna nazwa i opis 1 + 11. Oferta: opis 2 x A i 2 x B z głównymi nazwami CMS. Bez podsumowania i zapisu zamówienia. Przyciski oferty są sprawdzane po zakończeniu przeliczenia. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-10-15-175Z-487849e9/raport.html)

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

Sprawdź opis aplikacji w koszyku RETAIL

**Sprawdź opisy aplikacji i oferty w koszykach RETAIL:** Dwie odrębne sesje i koszyki: Matlandia 129 (1 dostęp nauczycielski + 11 uczniowskich), oferta 7 (2 A + 2 B). Czeka na przeliczenia konfiguratora. Bez complete i wysyłek. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-retail-cart.mjs`
- `api-tests/description-web.mjs`
- `tests/description-retail-cart.test.mjs`

**Ograniczenia:** Potwierdzono główną nazwę Matlandii 129 i wygenerowany opis w koszyku RETAIL: 1 dostęp nauczycielski, 11 uczniowskich. Bez podsumowania i zapisu Order; inne warianty/pakiety nieprzetestowane.

### DESC-024 — Nazwy produktów w treści PDF

**P1 · Częściowo obsługiwane · Zapis zamówienia QA i wiadomość do konta testowego**

**Wymaganie:** 5.1 — dokumenty RETAIL/WHOLESALE/ACADEMY

**Dowód historyczny:** 20.10.2026, próba wspomagana z logowaniem użytkownika: RETAIL #30001631, 57,34 zł, Matlandia — 1 dostęp nauczycielski i 11 uczniowskich. Cztery kontrole PASS: poprawna nazwa wariantu w podsumowaniu, zapis CMS, potwierdzenie PDF i nowy e-mail z takim samym tekstem załącznika. Nie jest to dowód pełnego automatycznego logowania, faktur ani innych wariantów/kanałów. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T10-02-46-041Z-f35d6c21/raport.html)

**Warunki wstępne**

- Dedykowane zapisane zamówienia i ekstraktor tekstu PDF.
- W wariancie tworzącym RETAIL: pusty koszyk oraz brak równoległych logowań na to konto.

**Dane**

Główne nazwy dla RETAIL/ACADEMY; nadpisanie i fallback WHOLESALE.

**Kroki**

1. Wygeneruj dokumenty dla wszystkich trzech kanałów.
2. Odczytaj ich treść, nie tylko nagłówek pliku.
3. Porównaj nazwy produktów i wariantów ze wzorcem.

**Oczekiwany wynik**

- Każdy dokument używa właściwego źródła nazwy dla kanału.

**Odpowiadający test**

Opisy kanałowe — zapis WHOLESALE, treść PDF i nowego e-maila

**Zapisz QA i sprawdź PDF oraz nowy e-mail:** Tworzy jedno zamówienie WHOLESALE na koncie podstawowym z produktu A (1 szt.). Wysyła complete najwyżej raz; zamówienie pozostaje na DEV i może wysłać e-mail. Migawka MailHoga przed operacją, potem dokładny odbiorca, nowe ID/czas i numer zamówienia. Porównuje tekst PDF i wiadomości z niezależną nazwą CMS. Nie testuje RETAIL, ACADEMY ani faktury. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Zapisz RETAIL i sprawdź PDF oraz e-mail:** Tworzy jedno zamówienie Matlandii RETAIL, akceptuje regulamin na DEV i wybiera przelew bankowy (bez zapłaty). Wymaga osobnych danych RETAIL_LOGIN_EMAIL / RETAIL_LOGIN_PASSWORD w .env. Sprawdza podsumowanie, zapis CMS, PDF i załącznik nowego e-maila. Nie ponawia utraconego zapisu; nie usuwa istniejących pozycji. Nie jest uruchamiany przez zestaw zbiorczy WHOLESALE. Logowanie następuje przed dodaniem QA; wymaga pustego koszyka i braku równoległego używania konta. Przed finalizacją sprząta własną pozycję po błędzie; po nieustalonym wyniku zapisu niczego nie usuwa. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-documents.mjs`
- `api-tests/pdf-text.py`
- `api-tests/mailhog.mjs`
- `api-tests/description-retail-documents.mjs`

**Ograniczenia:** Automat sprawdza numer zamówienia i nazwę WHOLESALE/fallback w tekście nowego PDF potwierdzenia. Nie sprawdza faktury ani pozostałych kanałów. Prawidłowa sygnatura PDF nie wystarcza. Wymaga Python z pypdf (HURT_PDF_PYTHON albo runtime Codex). Osobny wariant RETAIL: Matlandia, wzorzec nazwy wariantu, 11 dostępów uczniowskich, jedno zamówienie i potwierdzenie PDF/nowego e-maila. Nie obejmuje faktur i innych wariantów.

### DESC-025 — Nazwy w e-mailach i powiadomieniach

**P1 · Częściowo obsługiwane · Zapis zamówienia QA i wiadomość do konta testowego**

**Wymaganie:** 5 — RETAIL, WHOLESALE, ACADEMY

**Dowód historyczny:** 20.10.2026, próba wspomagana z logowaniem użytkownika: RETAIL #30001631, 57,34 zł, Matlandia — 1 dostęp nauczycielski i 11 uczniowskich. Cztery kontrole PASS: poprawna nazwa wariantu w podsumowaniu, zapis CMS, potwierdzenie PDF i nowy e-mail z takim samym tekstem załącznika. Nie jest to dowód pełnego automatycznego logowania, faktur ani innych wariantów/kanałów. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T10-02-46-041Z-f35d6c21/raport.html)

**Warunki wstępne**

- Kontrolowana skrzynka testowa i powiązanie wiadomości z konkretnym zamówieniem.
- W wariancie tworzącym RETAIL: pusty koszyk oraz brak równoległych logowań na to konto.

**Dane**

Wzorce nazw dla trzech kanałów, z nadpisaniem i fallbackiem WHOLESALE.

**Kroki**

1. Wywołaj zdarzenie w dedykowanym przebiegu.
2. Odbierz właściwą wiadomość i porównaj treść z danymi kanału.

**Oczekiwany wynik**

- Wiadomość używa właściwych nazw i dotyczy badanego zamówienia.

**Odpowiadający test**

Opisy kanałowe — zapis WHOLESALE, treść PDF i nowego e-maila

**Zapisz QA i sprawdź PDF oraz nowy e-mail:** Tworzy jedno zamówienie WHOLESALE na koncie podstawowym z produktu A (1 szt.). Wysyła complete najwyżej raz; zamówienie pozostaje na DEV i może wysłać e-mail. Migawka MailHoga przed operacją, potem dokładny odbiorca, nowe ID/czas i numer zamówienia. Porównuje tekst PDF i wiadomości z niezależną nazwą CMS. Nie testuje RETAIL, ACADEMY ani faktury. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Sprawdź powiadomienie o dostępności nowego QA:** Nowy produkt QA i jeden odbiorca konta podstawowego. Tymczasowy zapas 0→1, własna subskrypcja, nowy e-mail, na końcu przywrócenie stanu/ukrycia. Może wysłać testową wiadomość; nie zmienia wspólnych produktów. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Zapisz RETAIL i sprawdź PDF oraz e-mail:** Tworzy jedno zamówienie Matlandii RETAIL, akceptuje regulamin na DEV i wybiera przelew bankowy (bez zapłaty). Wymaga osobnych danych RETAIL_LOGIN_EMAIL / RETAIL_LOGIN_PASSWORD w .env. Sprawdza podsumowanie, zapis CMS, PDF i załącznik nowego e-maila. Nie ponawia utraconego zapisu; nie usuwa istniejących pozycji. Nie jest uruchamiany przez zestaw zbiorczy WHOLESALE. Logowanie następuje przed dodaniem QA; wymaga pustego koszyka i braku równoległego używania konta. Przed finalizacją sprząta własną pozycję po błędzie; po nieustalonym wyniku zapisu niczego nie usuwa. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-documents.mjs`
- `api-tests/pdf-text.py`
- `api-tests/mailhog.mjs`
- `api-tests/mail-pdf.mjs`
- `api-tests/description-mail-recheck.mjs`
- `api-tests/description-stock.mjs`
- `api-tests/description-retail-documents.mjs`

**Ograniczenia:** Potwierdzenie zamówienia ma ogólne body; numer i nazwę porównujemy w dołączonym podsumowanie.pdf, także gdy MIME ma application/octet-stream. Lista API może nie zawierać MIME: wtedy odczyt pełnej wiadomości po tym samym ID. Tylko wiadomość właściwego odbiorcy po rozpoczęciu próby; odrzucamy stare ID. Inne kanały, faktury i powiadomienia poza tym testem. Osobny wariant RETAIL: Matlandia, wzorzec nazwy wariantu, 11 dostępów uczniowskich, jedno zamówienie i potwierdzenie PDF/nowego e-maila. Nie obejmuje faktur i innych wariantów.

### DESC-026 — Generowanie URL dla wszystkich kanałów

**P1 · Częściowo obsługiwane · Odczyt**

**Wymaganie:** 6.1 — GenerateProductUrlByChannel

**Dowód historyczny:** 20.10.2026: wykonane kontrole WWW przeszły. Zestaw: 13 PASS, 7 SKIP i brak FAIL. Ukrycie sekcji dla oferty i szkoleń, widoczność dla zwykłego produktu, strony A/B, wyszukiwarka Matlandii, dwie strony listy i linki. Zakresy częściowe nie oznaczają zaliczenia całego wymagania. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-10-50-576Z-4d7bb556/raport.html)

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

Opisy kanałowe — CMS i frontend RETAIL

**Sprawdź CMS i frontend RETAIL:** Odczyt formularzy oferty i szkoleń oraz frontendu RETAIL: nazwy, slugi, pełne opisy A/B i Matlandii, wyszukiwarka, paginacja, kategoria Matematyka i niepusty krótki opis Matlandii. Wzorzec z głównych pól CMS. Bez zmian produktów, koszyków i finalizacji. Wymaga config/description-web.local.json. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-web.mjs`
- `config/description-web.example.json`

**Ograniczenia:** Automat sprawdza rzeczywisty link Pokaż produkt na stronie sklepu z formularza oferty i odpowiadający mu widok RETAIL. Nie potwierdza generatora dla pozostałych kanałów i typów produktów.

### DESC-027 — Tłumaczenia produktów dołączonych do oferty

**P1 · Częściowo obsługiwane · Odczyt**

**Wymaganie:** 7.1 — SpecialOffer i produkty składowe

**Dowód historyczny:** 20.10.2026: 2 PASS w dwóch osobnych koszykach RETAIL. Matlandia: główna nazwa i opis 1 + 11. Oferta: opis 2 x A i 2 x B z głównymi nazwami CMS. Bez podsumowania i zapisu zamówienia. Przyciski oferty są sprawdzane po zakończeniu przeliczenia. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-10-15-175Z-487849e9/raport.html)

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

Opisy kanałowe — CMS i frontend RETAIL

**Sprawdź CMS i frontend RETAIL:** Odczyt formularzy oferty i szkoleń oraz frontendu RETAIL: nazwy, slugi, pełne opisy A/B i Matlandii, wyszukiwarka, paginacja, kategoria Matematyka i niepusty krótki opis Matlandii. Wzorzec z głównych pól CMS. Bez zmian produktów, koszyków i finalizacji. Wymaga config/description-web.local.json. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

**Sprawdź opisy aplikacji i oferty w koszykach RETAIL:** Dwie odrębne sesje i koszyki: Matlandia 129 (1 dostęp nauczycielski + 11 uczniowskich), oferta 7 (2 A + 2 B). Czeka na przeliczenia konfiguratora. Bez complete i wysyłek. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-web.mjs`
- `config/description-web.example.json`
- `api-tests/description-retail-cart.mjs`
- `tests/description-retail-cart.test.mjs`

**Ograniczenia:** Automat porównuje dokładne główne nazwy oraz slugi dwóch dołączonych produktów w ofercie RETAIL. WHOLESALE, fallback i wygenerowany shortDescription oferty wymagają osobnych kontroli.

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

**P1 · Częściowo obsługiwane · Zapis zamówienia QA i wiadomość do konta testowego**

**Wymaganie:** 8.1 — powiadomienie o dostępności

**Dowód historyczny:** 20.10.2026: 5 PASS. Nowy produkt QA stock, zero wcześniejszych subskrypcji, dokładnie 1 własny odbiorca, zapas 0→1, nowy e-mail z główną nazwą RETAIL oraz przywrócenie stanu/ukrycia. Kontrola dotyczy powrotu dostępności; wywołanie OutOfStockSubscriber przy braku towaru pozostaje osobną kontrolą. [Otwórz raport](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-17-48-824Z-ec91401a/raport.html)

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

Powiadomienie RETAIL o dostępności nowego QA

**Sprawdź powiadomienie o dostępności nowego QA:** Nowy produkt QA i jeden odbiorca konta podstawowego. Tymczasowy zapas 0→1, własna subskrypcja, nowy e-mail, na końcu przywrócenie stanu/ukrycia. Może wysłać testową wiadomość; nie zmienia wspólnych produktów. Uruchamiany jest cały zestaw, nie pojedynczy przypadek.

- `api-tests/description-stock.mjs`
- `api-tests/description-web.mjs`
- `api-tests/mailhog.mjs`
- `tests/description-stock.test.mjs`

**Ograniczenia:** Automat tworzy własny produkt, kontroluje 0 subskrypcji przed próbą i dokładnie 1 własną przed zmianą zapasu. Wymaga MailHoga i phpMyAdmina. Sprawdza nową wiadomość i nazwę RETAIL przy odmiennej WHOLESALE. Dziennik .auth/description-stock-restore.json; po przerwaniu descriptions:stock:restore. Wynik rzeczywistego wykonania wymaga raportu. Migawka obejmuje ostatnie 50 ID i czas przed utworzeniem unikalnego produktu; dopasowanie wymaga dokładnego odbiorcy, czasu oraz nazwy nowej próby. Poczta MIME jest dekodowana po ID, więc polska nazwa nie jest szukana tylko w surowym kodowaniu. Wywołanie OutOfStockSubscriber przy braku towaru wymaga osobnego potwierdzenia.

## Endpointy

Adres bazowy: https://ksiegarnia.gwodev.pl/api/v2

| Metoda | Ścieżka | Zastosowanie |
| --- | --- | --- |
| GET | `/shop/products-dto` | Nazwy i slugi w listach poszczególnych kanałów |
| GET | `/shop/products-dto-by-slug/{slug}` | Nazwa, slug, pełny i krótki opis |
| GET | `/academy/closed-courses` | Automat DESC-018 — główny tytuł i slug, wymaga wzorców kursów i potwierdzonej struktury odpowiedzi |
| GET | `/academy/paid-courses` | Automat DESC-019 — główny tytuł i slug, wymaga wzorców kursów i potwierdzonej struktury odpowiedzi |
| GET | `https://cms-ksiegarnia.gwodev.pl/products/{id}/edit` | Odczyt formularza, pól kanałów i potwierdzenie zapisu |
| POST | `https://cms-ksiegarnia.gwodev.pl/products/{id}/edit` | Zapis, walidacja i przywracanie czterech pól opisów QA z aktualnym CSRF i Referer |

## Nagłówki

- X-Api-Channel: WHOLESALE / RETAIL / ACADEMY dla odczytów API.
- Authorization: Bearer JWT oraz X-Tests-Token, zgodnie z konfiguracją testów.

## Zapis wyniku pojedynczego wykonania

- ID DESC, produkt QA, kanał, źródło wzorca, faktyczne kontrole PASS/FAIL/SKIP i przyczyny pominięcia.
