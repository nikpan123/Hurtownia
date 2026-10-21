# Hurtownia — testy API i lokalny panel testowy

[Scenariusze API koszyka hurtowego](SCENARIUSZE-KOSZYKA-HURTOWEGO.md) — 44 przypadki z danymi, krokami, oczekiwaniami i zakresem automatyzacji. W panelu wybierz **Scenariusze testowe** lub otwórz [katalog scenariuszy](http://127.0.0.1:18767/#scenarios). Dostępne są wyszukiwanie, filtry obszaru, priorytetu i automatyzacji oraz pobranie całego dokumentu.

[Scenariusze opisów kanałowych](SCENARIUSZE-OPISOW-KANALOWYCH.md) — 29 przypadków `DESC-001`–`DESC-029`: konfiguracja CMS, walidacja, API, sklep i integracje. [Pełny katalog](SCENARIUSZE-TESTOWE.md) oraz widok scenariuszy w panelu obejmują łącznie 73 przypadki. Każdy przypadek opisów wskazuje punkt wymagań, kroki, oczekiwania, powiązany kod i ograniczenia; dostępny dowód historyczny ma osobny link do raportu.

Katalog opisuje zakres, nie wyniki wykonania. „Obsługiwane przez automat” nie oznacza PASS; ograniczenia są opisane przy każdym przypadku. Wyniki należy odczytywać z raportów konkretnych uruchomień. Dane katalogu znajdują się w `docs/cart-api-scenarios.json`; po zmianie uruchom `node dashboard/scenario-catalog.mjs`, aby odświeżyć dokument Markdown. Panel i pobieranie dokumentu korzystają bezpośrednio z aktualnego katalogu.

W szczegółach scenariusza znajdują się przyciski powiązanych testów. Każdy opisuje zakres, używane konta i skutki zapisu. Przycisk uruchamia cały zestaw, nie wyłącznie wybrany przypadek. Przypadki ręczne i niezaimplementowane nie mają przycisku startu. Scenariusze baz kierują do wyboru zapisanego zamówienia w raportach, a tymczasowa konfiguracja GLS do formularza ustawień.

[Pełna kolekcja koszyka do Postmana](postman/HURTOWNIA%20-%20Koszyk%20-%20komplet%20endpointow.postman_collection.json) obejmuje 81 żądań w siedmiu folderach oraz wszystkie endpointy koszyka, książki adresowej i dokumentów używane przez testy. Domyślnie nie finalizuje zamówienia; dodatkowe próby wymagają jawnego włączenia flag. Zawiera też pomocniczy odczyt katalogu. [Instrukcja i spis endpointów](postman/KOSZYK-INSTRUKCJA.md) opisują konfigurację, zakres i ograniczenia. Dane dostępowe w dostarczonym JSON są puste.

[Redmine #36926 — adresy w drugim kroku koszyka](REDMINE-36926.md): 38 przypadków API obejmujących zapis i walidację. Przypadek 38 sprawdza `isDefault=true`, porównuje oba adresy domyślne w CMS i nowym koszyku, a następnie przywraca oryginalne ID przyciskami **„Ustaw”** w kolumnach **„Adres płatności”** i **„Adres dostawy”**. Wymaga sesji i uprawnień CMS oraz istniejących adresów domyślnych. Dziennik przywracania blokuje nadpisanie niedokończonej próby; awaryjnie użyj `npm run addresses:restore`. Pozostałe luki są opisane w raporcie. Uruchomienie: `Testuj-Redmine-36926-dev.cmd`.

Aktualizacja kontraktu #36926 potwierdzona komentarzem developera przekazanym 20.10.2026: poprawny `POST /wholesale/checkout-step-two/{token}` zwraca **204 No Content i puste body**, zamiast wcześniejszego 201. Regresja i kolekcja Postmana uwzględniają tę zmianę. Sprzątanie nowych adresów QA potwierdza ich odłączenie od koszyka przed DELETE, także po nieudanym sprawdzeniu. Dawne raporty zachowują swoje oczekiwanie 201 i wyniki; zmianę ocenia nowe wykonanie.

Kontrola `carrierName` (#36926-06) na DEV uwzględnia ręczne potwierdzenie użytkownika z 19.10.2026, zaakceptowane 20.10.2026. Gdy GET nie zwraca `order.notes`, wynik ma opis **PASS — potwierdzone ręcznie**, datę, źródło i ograniczenie; raport oddziela takie zaliczenie od bieżących kontroli automatycznych. Nie oznacza to ponownego automatycznego odczytu notatki nowego koszyka. Błędna odpowiedź POST lub niezgodna zwrócona notatka nadal daje FAIL.

Regresja [Redmine #37162 — ShipmentInterface: Got NULL](REDMINE-37162.md) jest dostępna w panelu jako **Sprawdź #37162** lub przez `Testuj-Redmine-37162-dev.cmd`. Obejmuje sześć scenariuszy, osiem nowych koszyków i raport HTML/JSON. Kod został sprawdzony na atrapach API; nie wykonano jeszcze tych testów na DEV/TEST.

Projekt do testowania API księgarni hurtowej GWO bez docelowego frontendu. Zawiera scenariusze koszyka i zamówienia, testy katalogu, kontrole cen i tłumaczeń produktów oraz panel w przeglądarce z raportami i formularzami testowymi.

Testy API wykonuje **Node.js i `fetch`**. Playwright służy do logowania przez bramkę GitLab, tymczasowej konfiguracji CMS oraz opcjonalnego odczytu baz przez phpMyAdmin. Scenariusze zakupowe nie wymagają gotowego interfejsu sklepu. Panel zawiera własny, uproszczony formularz zamówienia; jego automat wybiera opcje w tej karcie przeglądarki.

## Spis treści

- [Wymagania i środowiska](#wymagania-i-środowiska)
- [Pierwsze uruchomienie po sklonowaniu](#pierwsze-uruchomienie-po-sklonowaniu)
- [Dane dostępowe i logowanie](#dane-dostępowe-i-logowanie)
- [Panel i dostępne scenariusze](#panel-i-dostępne-scenariusze)
- [Polecenia i pliki startowe](#polecenia-i-pliki-startowe)
- [Konfiguracja testów](#konfiguracja-testów)
- [Kontrole cen i rabatów](#kontrole-cen-i-rabatów)
- [Tłumaczenia produktów per kanał](#tłumaczenia-produktów-per-kanał)
- [Tworzenie książki przez CMS](#tworzenie-książki-przez-formularz-cms)
- [Wszystkie endpointy używane przez scenariusze](#wszystkie-endpointy-używane-przez-scenariusze)
- [Endpointy lokalnego panelu](#endpointy-lokalnego-panelu)
- [Raporty i interpretacja wyników](#raporty-i-interpretacja-wyników)
- [Testy samego narzędzia](#testy-samego-narzędzia)
- [Struktura projektu](#struktura-projektu)
- [Git i pliki lokalne](#git-i-pliki-lokalne)
- [Rozwiązywanie problemów i ograniczenia](#rozwiązywanie-problemów-i-ograniczenia)

## Wymagania i środowiska

- Node.js **22 lub nowszy** oraz npm.
- Windows: pliki `.cmd` uruchamiają projekt z właściwego katalogu. Polecenia Node/npm można wykonywać również z terminala w katalogu projektu.
- Microsoft Edge do logowania przez GitLab. Inny zainstalowany kanał Playwright można wskazać przez `BROWSER_CHANNEL`.
- Dostęp sieciowy do dev i GitLab oraz dedykowane konto testowe hurtownika.
- Do tworzenia produktu: dodatkowo dane administratora uprawnionego do **admin API**.

| Element | Adres / zasada |
| --- | --- |
| API dev | `https://ksiegarnia.gwodev.pl/api/v2` |
| CMS Sylius dev | `https://cms-ksiegarnia.gwodev.pl/` |
| Panel lokalny | `http://127.0.0.1:18767` |
| Test | Plik `config/test.example.json`; domyślnie `enabled: false` |

Środowisko test pozostaje zablokowane do wdrożenia zmian i osobnej zgody na uruchamianie. Samo wpisanie hosta `gwotest` jako środowiska `dev` nie omija blokady. Panel udostępnia scenariusze dev; nie ma przełącznika odblokowującego test.

**Pełne zamówienie wykonuje rzeczywisty zapis na dev** i może uruchomić e-mail oraz przekazanie zamówienia do bazy transferowej. Korzystaj z konta przeznaczonego do testów. Zatrzymanie przebiegu nie cofa operacji przyjętych przez serwer.

## Pierwsze uruchomienie po sklonowaniu

W katalogu projektu:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run setup
```

Alternatywnie uruchom dwukrotnie `Przygotuj.cmd`. Program przygotowania kopiuje brakujące pliki:

| Wzór w repozytorium | Tworzony plik lokalny |
| --- | --- |
| `.env.example` | `.env` |
| `config/dev.example.json` | `config/dev.local.json` |
| `config/test.example.json` | `config/test.local.json` |
| `config/catalog.dev.example.json` | `config/catalog.dev.local.json` |
| `config/catalog-fixtures.example.json` | `config/catalog-fixtures.local.json` |
| `config/regressions.example.json` | `config/regressions.local.json` |
| `config/product-create.example.json` | `config/product-create.local.json` |

**Istniejące pliki nie są nadpisywane.** Pliki lokalne są ignorowane przez Git. Po sklonowaniu trzeba uzupełnić dane dostępowe, sprawdzić adresy i scenariusze oraz przygotować własne oczekiwania dla produktów QA. Samo skopiowanie pustej listy fixture nie potwierdza reguł biznesowych.

Następnie:

1. Uzupełnij `.env` danymi kont testowych.
2. Sprawdź `config/dev.local.json`: adresy, produkty i oczekiwane rabaty.
3. Uruchom `Zaloguj-dev.cmd` i dokończ logowanie GitLab, w tym wymagane 2FA.
4. Uruchom `Panel-testow.cmd` lub `npm.cmd run ui`.
5. Otwórz `http://127.0.0.1:18767`.

Pozostaw uruchomiony proces panelu. Jeśli przeglądarka otworzyła się przed serwerem, odśwież stronę. Gdy panel już działa, kolejna próba uruchomienia serwera może zgłosić zajęty port — użyj istniejącej karty.

## Dane dostępowe i logowanie

Wartości wpisuj lokalnie, nigdy w README, kodzie, raporcie ani commicie.

| Zmienna `.env` | Zastosowanie |
| --- | --- |
| `GITLAB_USERNAME` | Login do bramki GitLab |
| `GITLAB_PASSWORD` | Hasło do bramki GitLab |
| `HURT_EMAIL` | Konto testowe hurtownika |
| `HURT_API_PASSWORD` | `apiPassword` do API sklepu; to osobne dane niż hasło GitLab |
| `HURT_TESTS_TOKEN` | Wartość nagłówka `X-Tests-Token` |
| `HURT_GATEWAY_COOKIE` | Opcjonalny ręczny nagłówek Cookie, zamiast pliku sesji |
| `HURT_DEV_BASE_URL` | Opcjonalne nadpisanie adresu API dev |
| `SYLIUS_ADMIN_EMAIL` | Administrator do logowania przez admin API |
| `SYLIUS_ADMIN_PASSWORD` | Hasło administratora do admin API |
| `BROWSER_CHANNEL` | Przeglądarka logowania, CMS i phpMyAdmin, domyślnie `msedge` |
| `HURT_VERIFY_DATABASE` | `true` włącza porównanie z bazami po finalizacji; domyślnie false |
| `HURT_TEST_EMAIL`, `HURT_TEST_API_PASSWORD`, `HURT_TEST_TESTS_TOKEN`, `HURT_TEST_GATEWAY_COOKIE` | Dane przyszłego środowiska test; nie odblokowują go |

Logowanie GitLab zapisuje sesję w `.auth/dev.json` (lub ścieżce `sessionFile` z konfiguracji). Jeśli podano `HURT_GATEWAY_COOKIE`, ma on pierwszeństwo przed plikiem sesji. Nieaktualny ręczny cookie może więc blokować dostęp mimo ponownego logowania w przeglądarce.

Logowanie w CMS nie przekazuje automatycznie uprawnień do JSON admin API. Odpowiedź `403` po udanym logowaniu administratora oznacza odmowę wykonania operacji, a nie konieczność ponownego wpisania hasła hurtownika.

Historyczny test admin API po odmowie `403` przy tworzeniu wykonuje dodatkowy odczyt `GET admin/products` w wybranym kanale. Raport pokazuje osobno wynik odczytu i zapisu, bez zapisywania tokenu i listy produktów. Jeżeli oba żądania zwracają `403`, backend musi sprawdzić reguły dostępu do admin API oraz obsługę ról administratora. Nie jest to potwierdzenie błędnego body produktu. Test nie ponawia zapisu i nie tworzy wariantu po odmowie.

## Panel i dostępne scenariusze

Panel nasłuchuje tylko na `127.0.0.1`. Odczytuje lokalne ustawienia i nie pokazuje haseł ani tokenów. Mutacje lokalnego panelu wymagają zgodnego `Origin` i tokenu strony. Jednocześnie może działać jeden przebieg testów.

| Tryb | Co wykonuje | Zapis po stronie dev |
| --- | --- | --- |
| Koszyk | Dodawanie, zmiana ilości, rabaty, wybór dostępnej płatności i dostawy | Tworzy i aktualizuje koszyk; bez `complete` |
| Pełne zamówienie | Koszyk oraz końcowe zatwierdzenie i pobranie PDF | Tak — finalizuje zamówienie |
| Katalog produktów | Kontrakt DTO, strony, wyszukiwanie, sortowanie, filtry, kanały, fixture | Odczyt; bez tworzenia produktu i zamówienia |
| Nowy produkt API | Osobny formularz: podgląd dwóch JSON-ów, produkt i wariant z cenami | Próba utworzenia nowego produktu i wariantu; bez testów katalogu |
| Zaokrąglenia cen | Cena 18,40 zł, rabat 23%, ilości 1–10 i wzorce starej hurtowni | Tworzy koszyk i zmienia ilości/płatność; bez finalizacji |
| Opisy per kanał | Nazwa, slug, opisy, lista i `productName` koszyka dla trzech kanałów | Odczyt oraz koszyki QA; bez finalizacji |
| Opisy kanałowe — CMS | Zapis i odczyt czterech pól, fallback, granice długości i kolizje slugów | Tymczasowa zmiana opisów QA i przywrócenie pól; bez finalizacji |

Dodatkowe widoki:

- **Zamówienie krok po kroku** — `/#wizard`: ręczny wybór produktów i ilości, płatności, dostawy, podsumowanie i zapis. Można uruchomić automat przechodzący przez formularz.
- **Nowy produkt API** — `/#create-product`: samodzielny formularz tworzenia produktu.
- **Raporty** — historia HTML/JSON/PDF, wyszukiwanie i filtry wyniku oraz rodzaju testu.
- **Podgląd API** — formularz GET obu endpointów katalogu, wybór kanału i parametrów, status HTTP, czas, JSON i karty produktów.
- **Konfiguracja** — stan uzupełnienia danych oraz sesji, losowanie i odnośnik do logowania GitLab.

### Automat formularza zamówienia

Po pobraniu dostępnych produktów:

- Bez zaznaczonych produktów: przycisk automatu losuje grupę, produkty i ilości.
- Z zaznaczonymi produktami: zachowuje wybrane pozycje i ilości, a losuje płatność i dostawę.
- Dostawy pobiera dopiero po zapisaniu płatności.
- Pokazuje dany wybór przez około 3 sekundy, po czym przechodzi dalej.
- Przycisk automatycznego przejścia **obejmuje również końcowe zatwierdzenie zamówienia**.
- Karta musi pozostać otwarta. Zamknięcie karty może pozostawić przebieg oczekujący na wybór; nie cofa koszyka.

Tryb ręczny czeka na ostatni przycisk zatwierdzenia. Oba tryby korzystają z tych samych kontroli wyceny co scenariusz API. Błąd rabatu lub sumy nie jest pomijany po to, aby doprowadzić do zapisu.

## Instrukcja panelu: wszystkie testy krok po kroku

W menu panelu wybierz **Dokumentacja testów**. Treść pochodzi bezpośrednio z tego README, bez osobnej kopii. Spis treści pozwala przejść do rozdziału; pole wyszukiwania filtruje tytuły rozdziałów. Przycisk **Pobierz README.md** zapisuje plik. Wejście do dokumentacji nie uruchamia testów ani logowania. Kwoty i produkty poniżej opisują bieżącą konfigurację; własne ustawienia mogą zmienić zakres przebiegu.

### Wybór konta przed testem

W nagłówku panelu ustaw **Konto do koszyka / zamówienia**: Konto 1 (HURT_EMAIL / HURT_API_PASSWORD) albo Konto 2 (HURT_SECOND_EMAIL / HURT_SECOND_API_PASSWORD). Konto 2 jest dostępne po uzupełnieniu jego danych w .env.

1. Wybierz konto przed uruchomieniem Koszyka, Pełnego zamówienia lub formularza krok po kroku.
2. Test loguje wyłącznie wybranego hurtownika, tworzy jego koszyk i pobiera jego dostępne płatności oraz dostawy. Raport i nazwa przebiegu wskazują numer konta.
3. Dla konta 2 rabat Adamady i rabaty według metod pochodzą z HURT_SECOND_REBATE_*; dla konta 1 rabaty metod z order-regression.local.json i pozostałe oczekiwania z konfiguracji koszyka. Przy zmianie na konto 2 nie używamy kwot, ofert, zabronionych metod ani list dostępności zapisanych jako szczególne oczekiwania konta 1; pozostają kontrole ogólne i niezależne rabaty konta 2.
4. Zmiana konta w formularzu usuwa dotychczasowy wybór produktów. Pobierz je ponownie dla nowego konta. W trakcie przebiegu wybór konta jest zablokowany.

Wspólne pozostają adresy QA z konfiguracji, pula produktów i sesja bramki GitLab. Wybór nie zmienia danych w .env. Regresja nadal korzysta z obu kont, jeśli zostały skonfigurowane; paczki, katalog, opisy i ceny używają pierwszego konta. Tworzenie książki korzysta z sesji administratora CMS.

### Koszyk — jeden przebieg bez finalizacji

1. Odczytaj konfigurację i przygotuj plan produktów: losowany z puli albo wskazany w pliku. Adamada i pozostałe produkty mają osobne koszyki.
2. Zaloguj hurtownika przez API i utwórz nowy koszyk.
3. Dodaj produkty zbiorczo i pobierz koszyk. Sprawdź zgodność produktów i ilości z planem, typy kwot, rabaty oraz sumy.
4. Zmień ilości zgodnie z planem i ponownie sprawdź koszyk; zapisz różnice cen i ilości w raporcie.
5. Pobierz płatności dostępne dla tego koszyka. Wybierz jedną zgodnie z konfiguracją lub losowaniem, ustaw ją i sprawdź rabaty oraz zgodność wyceny z ofertą.
6. Pobierz dostępne dostawy już po ustawieniu płatności. Wybierz dostawę, prześlij adres wysyłki i faktury, odczytaj podsumowanie.
7. Sprawdź, czy API zachowało wybrane metody, produkty, ilości i oczekiwane wartości. Zapisz HTML i JSON z żądaniami oraz pomiarami.

Pozostaje rzeczywisty koszyk dev. Nie następuje complete, pobranie PDF ani porównanie zapisu finalnego w bazach. Oczekiwania biznesowe zależą od wypełnienia konfiguracji; samo sprawdzenie sum nie dowodzi poprawności wszystkich cen.

### Pełne zamówienie — jeden przebieg z zapisem

1. Wykonaj kroki testu Koszyk, włącznie z kontrolą podsumowania przed zapisem.
2. Wyślij PATCH complete dokładnie raz. Timeout nie powoduje automatycznego ponowienia, ponieważ serwer mógł już zapisać zamówienie.
3. Pobierz zamówienie po zapisie i porównaj kwoty przed i po finalizacji, wybrane metody oraz dostępne pola paczek.
4. Sprawdź wymagane przez konfigurację informacje checkoutInformation i linki dokumentów.
5. Pobierz dokumenty PDF wskazane przez API. Sprawdź typ odpowiedzi i początek pliku PDF; zapisz je przy raporcie.
6. Jeśli zaznaczono porównanie baz, odczytaj zapis Syliusa i transferu dla tego zamówienia i dołącz wyniki.

Zapis może uruchomić e-mail i transfer. Test nie potwierdza doręczenia wiadomości ani wizualnej i tekstowej treści PDF. Błąd kontroli po complete nie cofa zamówienia.

### Regresja koszyka — wiele przypadków bez finalizacji

1. Zaloguj hurtownika. Użyj ustalonych produktów obu grup: obecnie 5lp-1 i POP1 oraz osobno Adamada D087 i D090.
2. Dla każdej grupy pobierz płatności, a dla każdej płatności dostępne dostawy. Sprawdź poprawność i unikalność kodów ofert.
3. Dla każdej pary płatność–dostawa utwórz osobny koszyk. Limit wynosi obecnie 48 par; kombinacje ponad limit otrzymują SKIP.
4. Dodaj pierwszy produkt grupy, wybierz płatność i sprawdź rabat. Wzorce: Adamada 10%; pozostałe — bank_transfer 23%, cash_on_delivery 50%, bank_transfer_1_day 75%, payment_timely 25%.
5. Zmieniaj ilości kolejno na 2, 6 i 1. Po każdej zmianie sprawdź ilość, rabat, poprawność kwot, sumę pozycji oraz produkty + dostawa = do zapłaty. Porównaj aktualną ofertę płatności z kwotą produktów według skonfigurowanej podstawy netto/brutto.
6. Ustaw dostawę dostępną dla danego koszyka i sprawdź zapisane kody płatności oraz dostawy. Dla dostawy bez kalkulatora oczekuj braku paczek.
7. W osobnym koszyku dodaj dwa produkty tej samej grupy. Dodaj pierwszy ponownie: mają pozostać dwie różne pozycje, a ilość pierwszej ma wzrosnąć do 2. Usuń pierwszą pozycję i sprawdź pozostałą.
8. Dla każdej grupy wyślij ilości -1, 0 i 1,5, nieistniejące kody produktu, płatności i dostawy oraz niepełny adres. Każde żądanie ma zostać odrzucone zgodnym z konfiguracją błędem walidacji, a odczyt po próbie ma potwierdzić brak zmian koszyka. HTTP 500 i 401 nie zaliczają walidacji.
9. Uruchom sprawdzenia paczek opisane poniżej. Jeśli skonfigurowano drugie konto, uruchom również kontrole jego rabatów i izolacji koszyków.
10. Zapisz oddzielny wynik każdego przypadku, rzeczywiste żądania i pomiary. Niewykonane kontrole oznacz SKIP wraz z przyczyną.

Nie finalizuje zamówień. Bez kompletu kontroli raport może mieć INCOMPLETE nawet przy braku FAIL. Przekroczenie zapasu wymaga niezależnie znanego stanu magazynowego; ponowne complete i istniejąca płatność zabroniona dla konta wymagają osobnych wzorców i pozostają pominięte.

### Regresja zamówienia — także zapis i PDF

1. Wykonaj regresję koszyka.
2. Sprawdź odrzucenie finalizacji pustego koszyka bez zmiany jego stanu.
3. Dla poprawnie rozpoznanych kombinacji uruchom pełne zamówienie: maksymalnie po jednym dla każdej grupy i jedno dla paczek, czyli do 3 poprawnych zamówień.
4. Sprawdź PDF-y i niezmienność wyceny po zapisie; opcjonalnie porównaj bazy. Raporty finalizacji są dostępne jako odnośniki w raporcie regresji.
5. Spróbuj dodać mieszany koszyk Adamada + pozostałe. Jeśli API odrzuci już dodanie, blokada jest potwierdzona; jeśli pozwoli dodać i wybrać metody, complete ma go odrzucić.

Jeśli backend błędnie zaakceptuje negatywną próbę complete, także ona może stworzyć zamówienie. Raport pokaże FAIL; test nie powtarza zapisu.

### Paczki i koszt dostawy GLS

1. Utwórz oddzielny koszyk produktu referencyjnego, wybierz wskazaną płatność i gls_wholesale.
2. Sprawdź ilości 1, 38, 39, 76 i 77 sztuk produktu o potwierdzonej wadze 210 g. Przy limicie 8000 g są to wagi 210, 7980, 8190, 15960 i 16170 g, czyli oczekiwane 1, 1, 2, 2 i 3 paczki.
3. Wylicz wzorzec niezależnie od odpowiedzi API: zaokrąglij w górę wagę podzieloną przez pojemność paczki; dobierz cenę jednostkową z przedziału wagi całego koszyka.
4. Porównaj shipmentPackageQuantity, shippingTotal i shippingTotalNet, uwzględniając netto/brutto cennika, VAT i wskazaną dopłatę płatności. Obecny wzorzec: do 8000 g 15 zł netto za paczkę, powyżej 10 zł netto za paczkę, VAT 5%, dopłata przy odbiorze 15 zł brutto.
5. Po większej ilości zmniejsz ją do 1 i sprawdź ponowne przeliczenie. Na końcu wykonaj ponownie przypadek 1 sztuki w oddzielnym koszyku.
6. Jeśli API oferuje personal_collection, zmień metodę i sprawdź, czy liczba paczek wynosi 0. Niedostępna metoda daje SKIP, nie wynik pozytywny tej kontroli.

Przycisk paczek nie zapisuje zamówienia ani nie zmienia CMS. Zapis paczek w bazie można potwierdzić regresją z finalizacją i porównaniem baz.

### Paczki — tymczasowa konfiguracja CMS

1. Wypełnij profil: pojemność paczki, dwa przedziały wagowe, ceny i netto/brutto. Panel sprawdza format i poprawność przedziałów.
2. Zaloguj automat do CMS, odczytaj aktualną konfigurację GLS i zachowaj dziennik przywracania.
3. Ustaw profil testowy i odczytaj go ponownie, aby potwierdzić zapis.
4. Dobierz osiągalne ilości produktu przed i za progami; jeśli waga produktu nie pozwala trafić dokładnie w próg, sprawdzaj najbliższe osiągalne wagi. Wykonaj test API paczek.
5. Po sukcesie, błędzie lub zwykłym anulowaniu przywróć początkowe ustawienia CMS i potwierdź je odczytem.
6. Dołącz audyt i wynik przywracania do raportu. Po awarii procesu niedokończony dziennik blokuje kolejne przebiegi zmieniające dane; użyj packages:restore. Obca zmiana konfiguracji wymaga uzgodnienia zamiast jej nadpisania.

Ustawienia GLS są wspólne dla dev. Ten scenariusz nie finalizuje zamówienia.

### Zamówienie krok po kroku — formularz ręczny i automat

1. Pobierz produkty z puli testowej, które API udostępnia obecnie w WHOLESALE.
2. Wybierz do 5 produktów jednej grupy i ilości 1–10; albo uruchom losowanie automatyczne.
3. Utwórz koszyk, sprawdź produkty i ilości. Pokaż dostępne płatności, ich rabaty i wyceny; zaczekaj na wybór ręczny albo wybierz automatycznie.
4. Pobierz dostawy po ustawieniu płatności. Pokaż ich wybór i zaktualizowaną wycenę.
5. Pokaż podsumowanie, adresy i kwotę do zapłaty. Tryb ręczny czeka na zatwierdzenie; automat przechodzi aż do zapisu bez dodatkowego kliknięcia.
6. Wykonaj finalizację i kontrole pełnego zamówienia, pobierz PDF-y, opcjonalnie porównaj bazy i udostępnij raport.

Karta automatu musi pozostać otwarta. Zamknięcie lub zatrzymanie nie cofa operacji przyjętych przez API.

### Katalog produktów — lista i szczegóły

1. Zaloguj API i wykonaj sprawdzenia dla skonfigurowanych kanałów WHOLESALE, RETAIL i ACADEMY.
2. Pobierz wszystkie strony katalogu: sprawdź strukturę, paginację, pola produktów oraz brak powtarzających się kodów.
3. Sprawdź domyślne page=1 i limit=10, limity 1, 2, 10 i 50 oraz stronę za końcem listy.
4. Porównaj domyślne sortowanie z jawnym sortowaniem po pozycji. Sprawdź nazwę rosnąco/malejąco i zachowanie kompletu produktów przy odwróceniu sortowania pozycji.
5. Sprawdź wyszukiwanie po nazwie, ISBN i autorze, jeżeli są dane referencyjne, oraz frazę bez wyników.
6. Porównaj produkty z listy ze szczegółami po slugu. Sprawdź nieistniejący slug i żądanie ze znakami specjalnymi.
7. Porównaj niezależne oczekiwania produktów i poprawnych filtrów z konfiguracji. Dla filtrów publication_type[], subjects[], primary_school[], high_school[] i taxons[] sprawdź także wartości bez dopasowań. Brak wzorca dodatniego filtra daje SKIP.
8. Wyślij niepoprawne page, limit, order_by i sort oraz nieprawidłowy i brakujący nagłówek kanału. Oceń odrzucenie według kontraktu.
9. Zapisz osobny wynik i odpowiedzi w raporcie. Sam brak HTTP 500 nie potwierdza poprawności wyniku wyszukiwania.

Przycisk katalogu służy do odczytu; tworzenie produktu ma osobny formularz.

### Nowa książka CMS — formularz tworzenia

1. Wpisz nowy kod QA, kod handlowy, nazwę, slug, kanał i ceny.
2. Kliknij „Sprawdź i pokaż dane”. Dla WHOLESALE cena i oryginalna cena muszą być identyczne, a minimum price wynosić 0 zł.
3. Kliknij „Utwórz książkę w CMS”. Test pobiera formularz z aktualnym CSRF i wysyła jeden POST `/products/new/simple/BOOK`.
4. Potwierdza ID z przekierowania, następnie odczytuje zapisane pola oraz ceny w edycji produktu.
5. Otwórz raport. Produkt pozostaje nieaktywny i ukryty na DEV. W razie nieustalonego wyniku sprawdź jego kod w CMS przed kolejną próbą; test nie ponawia POST.

Wymagana jest zapisana sesja administratora CMS. Nie są potrzebne dane JWT admin API. Dotychczasowe 403 w admin API pozostają wynikiem osobnej, historycznej ścieżki.

### Zaokrąglenia cen — wzorzec starej hurtowni

1. Utwórz koszyk produktu referencyjnego i sprawdź bazowe ceny: brutto 18,40 zł, zgodną cenę oryginalną i oczekiwaną cenę netto.
2. Pobierz płatności i znajdź dostępną ofertę z rabatem 23%. Bez niej pomiń pomiary z wyjaśnieniem; zwykły przycisk nie zmienia rabatów konta.
3. Ustaw tę płatność i zmieniaj ilości według konfiguracji, obecnie 1–10 sztuk.
4. Dla każdej ilości zapisz cenę netto po rabacie, sumę netto i brutto. Sprawdź ilość, rabat, niezmienność ceny bazowej oraz zgodność sum.
5. Dla ilości z niezależnym wzorcem porównaj konkretne pola: 13,49 zł netto za sztukę przy 1 sztuce oraz 84,99 zł brutto przy 6 sztukach. Pozostałe ilości bez wzorca są obserwacjami i kontrolą spójności.
6. Zapisz tabelę pomiarów i różnic w groszach. Nie finalizuj zamówienia.

### Opisy produktów zależne od kanału

1. Odczytaj niezależne wzorce produktów: opisy główne, nadpisania kanałowe, slugi i widoczność w kanałach.
2. Dla każdego widocznego produktu i kanału pobierz szczegóły po slugu. Porównaj kod, nazwę, slug, pełny i krótki opis zgodnie z wypełnionymi wzorcami. Dla RETAIL i ACADEMY sprawdź też dane główne.
3. Wyszukaj produkt na liście i porównaj jego nazwę oraz slug.
4. Utwórz koszyk danego kanału, dodaj produkt i sprawdź productName oraz variantName, jeśli ustalono wzorzec nazwy wariantu.
5. Zapisz wyniki i jawne pominięcia: niewidoczne produkty, brak wzorca wariantu, walidacje i zakładki CMS, specjalne typy, kursy, e-maile, PDF oraz integracje zewnętrzne.

Tworzy koszyki, ale nie finalizuje ich ani nie zmienia opisów produktów w CMS.

**Pokrycie wymagań opisów kanałowych:** istniejący zestaw sprawdza część API: listę i szczegóły produktów oraz `productName` koszyka w WHOLESALE, RETAIL i ACADEMY. Dla WHOLESALE korzysta z niezależnych wzorców nadpisania i fallbacku; dla RETAIL i ACADEMY porównuje również dane główne. Wzorce są w lokalnym `config/catalog-fixtures.local.json`, w `products` z polem `main`. Wymagane są nazwa, slug, krótki opis oraz pełny opis lub `descriptionContains`. `variantName` wymaga osobnego wzorca — jego brak oznacza SKIP.

Raport DEV z 16.10.2026, 07:52 UTC (`descriptions-2026-10-16T07-52-56-681Z-8f4e2b26`) zawiera **18 PASS i 11 SKIP**: 6 kontroli szczegółów, 6 list i 6 nazw w koszyku przeszło. Pominięto 6 nazw wariantów i 5 zbiorczych obszarów poza zestawem. To dowód częściowego pokrycia, bez potwierdzenia walidacji CMS, rzeczywistego frontendu, kursów, treści PDF, e-maili, generatora URL ani Empiku. Powiązanie tego raportu ze scenariuszami w katalogu jest opisem historycznych kontroli, nie ponownym wykonaniem testu.

W nowych raportach każda kontrola ma identyfikator `DESC-…` i link do scenariusza w panelu. Tabela pokrycia pokazuje wszystkie 29 scenariuszy oraz liczbę powiązanych kontroli PASS/FAIL/SKIP; liczba PASS nie oznacza sprawdzenia całego wymagania. Niesprawdzone w tym zestawie scenariusze mają osobne SKIP zamiast dawnych zbiorczych wpisów; dodatkowe SKIP dotyczą brakujących wzorców wariantów i kursów. Kontrole API uruchomisz przyciskiem **Opisy per kanał** ze szczegółów powiązanego scenariusza — uruchamia on cały zestaw. Scenariusze CMS, sklepu i integracji pozostają do wdrożenia lub wykonania ręcznego. Brak serwera testowego Empik nie upoważnia do testowania aktualizacji na produkcji.

**Automaty kursów `DESC-018` i `DESC-019`:** w tym samym zestawie dostępne są odczyty `GET /academy/closed-courses` i `GET /academy/paid-courses` z kanałem ACADEMY i tokenem zalogowanego konta. Porównują `title` i `slug` z głównym tłumaczeniem wskazanych kursów. Błędny tytuł/slug, brak kursu, duplikat identyfikatora lub niezgodna struktura odpowiedzi daje FAIL; brak wzorców daje SKIP bez wysyłania żądania. Nie kupują kursów ani nie sprawdzają dostępu innych kont. Kontrole sprawdzono lokalnie i na DEV; zakres potwierdzonego przebiegu opisano poniżej.

Konfiguracja jest w `config/catalog-fixtures.local.json`, w `courses.closed` i `courses.paid`; szablon zawiera `config/catalog-fixtures.example.json`. Dla każdej kolekcji:

- `expected`: lista `{ "id": "identyfikator-kursu", "title": "Tytuł główny z CMS", "slug": "slug-glowny-z-cms" }`. Użyj faktycznego identyfikatora i niezależnych danych CMS; nie kopiuj oczekiwań z badanego endpointu.
- `itemsPath`: położenie tablicy rekordów, np. `["data"]`; `[]` oznacza odpowiedź będącą tablicą.
- `identityPath`, `titlePath`, `slugPath`: ścieżki wewnątrz rekordu, np. `["id"]`, `["title"]`, `["slug"]`. Jeżeli identyfikator jest zagnieżdżony, np. `product.code`, użyj `["product", "code"]` i zgodnych identyfikatorów we wzorcach.
- `query`: potwierdzone parametry strony zawierającej wskazane kursy. Przykładowe `page` i `limit` w szablonie wymagają sprawdzenia kontraktu. Automat nie przeszukuje kolejnych stron.

Konto skonfigurowane dla tego zestawu musi widzieć wskazane kursy. Sam brak kursu w wyniku nie pozwala stwierdzić błędu tłumaczenia: najpierw sprawdź jego dostępność dla konta i wybraną stronę.

**Wiele kursów i stron:** opcjonalne `pages` zastępuje pojedyncze `query`/`expected`. Każda strona wymaga własnych parametrów i co najmniej jednego niezależnego wzorca. Pozostałe ścieżki pól są dziedziczone z konfiguracji kolekcji. Przykład:

```json
"pages": [
  {"query": {"page": 1, "limit": 2}, "expected": [
    {"id": "kurs-1", "title": "Tytuł główny 1", "slug": "slug-glowny-1"},
    {"id": "kurs-2", "title": "Tytuł główny 2", "slug": "slug-glowny-2"}
  ]},
  {"query": {"page": 2, "limit": 2}, "expected": [
    {"id": "kurs-3", "title": "Tytuł główny 3", "slug": "slug-glowny-3"}
  ]}
]
```

Automat sprawdza duplikaty identyfikatorów w odpowiedzi i między wskazanymi stronami oraz tytuł/slug wszystkich podanych wzorców. Nie przechodzi po nieznanych kolejnych stronach i nie nadaje dostępu do kursów. Lokalnie przygotowano cztery wzorce kursów rad na dwóch stronach z tytułami/slugami potwierdzonymi w CMS. Konto zwraca obecnie tylko jeden kurs płatny — rozszerzenie tej kolekcji wymaga następnych dostępnych kursów. Dwie kontrole konfiguracji nie są odczytami API; mają oddzielne wiersze, bez żądań w dowodach.

### Opisy kanałowe — zapis i walidacje CMS

Osobny przycisk **Opisy kanałowe — CMS** w grupie Produkty uruchamia zestaw `descriptions-cms`. Ten sam zestaw jest podpięty do scenariuszy `DESC-001`, `DESC-003`–`DESC-009`. Można go uruchomić również przez `npm run descriptions:cms`.

1. Odczytuje `config/description-cms.local.json` (szablon: `config/description-cms.example.json`), loguje administratora, potwierdza kod produktu `qa-` i wyłączoną sprzedaż tego produktu w EMPIK.
2. Odczytuje główne opisy i sekcje WHOLESALE/EMPIK. Mapuje pola na podstawie nagłówków kanałów; numery formularza mogą zmieniać kolejność po zapisie.
3. Tworzy dziennik `.auth/description-cms-restore.json` przed pierwszym zapisem. Istniejący dziennik blokuje nowy test.
4. Wysyła rzeczywisty formularz CMS przez HTTP z aktualnym tokenem CSRF. Zmienia wyłącznie cztery pola opisów kanałowych: nazwę, slug, pełny i krótki opis. Pozostałe pola bierze z najświeższego formularza.
5. Potwierdza zapis ponownym odczytem CMS oraz odczytem `products-dto-by-slug` dla WHOLESALE, RETAIL i ACADEMY. WHOLESALE ma używać nadpisania, pozostałe kanały tłumaczenia głównego.
6. Czyści każde pole WHOLESALE osobno, a następnie wszystkie naraz. Sprawdza zapis pustych wartości i fallback odpowiednich pól do opisu głównego.
7. Sprawdza odrzucenie slugu innego produktu w WHOLESALE i slugu równego głównemu; akceptację takiego samego slugu w WHOLESALE i EMPIK; nazwy 1/2 znaki oraz slugi 256/255 znaków.
8. W bloku końcowym przywraca pierwotne pola także po błędzie lub przerwaniu i potwierdza je odczytem. Raport zawiera wynik przywracania, `description-cms-audit.json` i `cms-restored.png`.

Nie testuje interakcji JavaScript edytora treści, pełnego frontendu, generowania URL ani wysyłki do Empiku. Obsługuje opisy z elementami HTML edytora; inne rodzaje bloków wymagają rozszerzenia adaptera. Nie finalizuje zamówień. Ukrywanie sekcji dla specjalnych typów sprawdza osobny zestaw WWW, a tworzenie produktu i rekordy tłumaczeń — zestaw „Nowy produkt i tłumaczenia”.

Nie edytuj równocześnie produktu QA. Przy wykryciu zmiany zewnętrznej automat blokuje dalszy zapis i zachowuje dziennik zamiast nadpisywać cudze dane. Po zabiciu procesu użyj `npm run descriptions:restore`; polecenie porównuje aktualne pola z zapisanymi stanami i odmawia zapisu przy konflikcie. Przywracanie pól nie usuwa historii zmian CMS ani ewentualnych wewnętrznych rekordów utworzonych przez backend. Sam test API opisów blokuje się, jeśli dziennik CMS wskazuje niedokończoną zmianę.

**Powody SKIP:** nowe raporty rozdzielają brak danych testowych (`data_missing`), brak automatu (`not_automated`), ograniczenie środowiska (`environment`), błąd zależnego kroku (`dependency`) i przypadek należący do innego zestawu (`out_of_scope`). W teście odczytu API kontrole CMS wskazują osobny zestaw, zamiast twierdzić, że nie mają automatu. Stare wpisy bez oznaczenia pozostają w kategorii „Pozostałe pominięcia”; nie zmieniamy historycznych wyników.

**Potwierdzenie DEV z 19.10.2026:**

- [Zapis i walidacje CMS — raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-44-12-194Z-b2b5f4a8/raport.html): **15 PASS**, łącznie z ponownym odczytem pierwotnych pól po przywróceniu. Kontrole formularza HTTP nie potwierdzają działania JavaScript edytora.
- [Odczyt opisów, wariantów i kursów — raport](http://127.0.0.1:18767/reports/descriptions-2026-10-19T07-41-22-238Z-05d08f9e/raport.html): **23 PASS, 6 FAIL, 19 SKIP**. Kursy rad: 4 wzorce na 2 stronach; kursy płatne: 1 wzorzec na 1 stronie. Pięć PASS kursów obejmuje dwie walidacje konfiguracji i trzy rzeczywiste odczyty stron API.
- Wszystkie 6 FAIL dotyczą `DESC-017`: `GET /api/v2/shop/orders/{token}` nie zwraca `items[].variantName`, mimo zapisanych w CMS nazw dwóch wariantów QA. Potwierdzono w WHOLESALE, RETAIL i ACADEMY. Odpowiedź zawiera `productName` oraz `variant` z polami ceny/dostępności; nie zastępuje to wymaganej nazwy wariantu. Test nie pomija tej niezgodności.
- 19 SKIP w raporcie API: 8 kontroli przeniesionych do osobnego zestawu CMS, 10 bez automatu, 1 z ograniczeniem środowiska Empik. Nie jest to 19 nowych błędów backendu.

### Porównanie zapisanego zamówienia z bazą

1. Wybierz raport z potwierdzoną finalizacją i kliknij Porównaj z bazą albo zaznacz kontrolę baz przed uruchomieniem zamówienia.
2. Powiąż id API z sylius_order.id, a numer zamówienia Syliusa z nOrderID w bazie transferowej. Nie wyszukuj po prostu ostatniego zamówienia.
3. Wykonaj stałe SELECT-y przez phpMyAdmin. Porównaj rekord nagłówka, walutę, stan i kwoty.
4. Porównaj produkty, kody z uwzględnieniem mapowania kodów handlowych, pełne nazwy, ilości, ceny i rabaty. Sprawdź brak nieoczekiwanych pozycji.
5. Porównaj płatność, dostawę i szczegóły paczek w sylius_shipment oraz pozycję KWys w transferze. Oddziel koszt paczek od opłaty płatności i przelicz skale groszy API oraz kwot dziesiętnych bazy.
6. Jeśli transfer nie jest jeszcze widoczny, ponów wyłącznie odczyt do 3 razy, co 2 sekundy. Nie powtarzaj zamówienia.
7. Zapisz wyniki każdej kontroli i snapshot finansowy. Brak danych lub różnica nie oznaczają PASS.

Nie wykonuje zmian SQL. Porównanie starego raportu używa jego historycznego snapshotu API i aktualnego rekordu bazy.

### Podgląd API i logowanie GitLab

1. W Podglądzie API wybierz listę lub szczegóły, kanał i parametry. Wyślij żądanie GET, obejrzyj status, czas i JSON. To ręczna inspekcja odpowiedzi, nie pełny test jej zgodności z wzorcem.
2. Gdy bramka GitLab przekierowuje do logowania, w Konfiguracji uruchom logowanie, dokończ logowanie i ewentualne 2FA. Sesja zostanie zapisana lokalnie do kolejnych żądań API.
3. Samo logowanie nie sprawdza poprawności koszyka ani tworzenia produktu. Panel i raporty nie wyświetlają haseł i tokenów.

### Drugie konto — konfiguracja i przebieg kontroli

Uzupełnij lokalny .env. Pola pozostają puste w repozytoryjnym .env.example; nie przesyłaj haseł do rozmowy ani Gita.

| Zmienna | Co wpisać |
| --- | --- |
| HURT_SECOND_EMAIL | E-mail innego hurtownika dev |
| HURT_SECOND_API_PASSWORD | Jego apiPassword, nie hasło GitLab |
| HURT_SECOND_TESTS_TOKEN | Opcjonalny token testów; puste używa HURT_TESTS_TOKEN |
| HURT_SECOND_REBATE_BANK_TRANSFER | Oczekiwany procent rabatu zwykłego przelewu bankowego |
| HURT_SECOND_REBATE_CASH_ON_DELIVERY | Oczekiwany procent rabatu przy odbiorze |
| HURT_SECOND_REBATE_BANK_TRANSFER_1_DAY | Oczekiwany procent rabatu przelewu jednodniowego |
| HURT_SECOND_REBATE_PAYMENT_TIMELY | Oczekiwany procent rabatu płatności terminowej |
| HURT_SECOND_REBATE_ADAMADA | Oczekiwany procent rabatu Adamady |

Rabaty wpisz jako procenty 0–100 (np. 12 lub 12,5), także 0 przy braku rabatu. Wypełnij rabaty metod dostępnych dla drugiego konta; niedostępne metody pozostaw puste. Sam wpis w .env stanowi oczekiwanie testu, nie zmienia ustawień CMS. Ustaw je wcześniej na koncie drugiego hurtownika. Dodatkowe metody oferowane przez API wymagają dopisania ich wzorca w integracji. Niedostępna metoda ze skonfigurowanym rabatem otrzymuje SKIP; sam procent nie oznacza jej dostępności.

Wzorce odczytane z ekranów CMS: pierwsze konto — przelew bankowy 23%, odbiór 50%, przelew jednodniowy 75%, terminowa 25%, Adamada 10%. Drugie konto — odpowiednio 47%, 13%, 30,5%, 90% i 20%. Te wartości nie są wyznaczane z odpowiedzi badanego API.

1. Uruchom Regresję koszyka albo Regresję zamówienia. Testy wyłącznie paczek nie używają drugiego konta.
2. Sprawdź, czy to różne konta, zaloguj drugiego użytkownika i używaj osobnego tokenu API. Wspólna może być sesja bramki GitLab.
3. Dla obu grup produktów drugiego konta sprawdź rabaty oferowane przez każdą dostępną płatność. Ustawiaj płatności i odczytuj koszyk, porównując rabat każdej pozycji z niezależną wartością .env. Pierwsze konto ma własne wzorce w order-regression.local.json.
4. Utwórz własny koszyk konta A i sprawdź, że właściciel może go odczytać, pobrać płatności i dostawy.
5. Jako konto B spróbuj odczytać koszyk A, jego płatności i dostawy oraz zmienić ilość, dodać produkt, ustawić płatność i dostawę oraz usunąć pozycję. Każda próba ma zwrócić 403 albo 404; po próbie właściciel odczytuje koszyk i sprawdza brak zmian.
6. Powtórz te same próby w odwrotnym kierunku. Po nieudanej kontroli zapisu przerwij dalsze mutacje tego koszyka, zachowując FAIL.
7. Pokaż osobne wyniki w raporcie regresji. Bez danych drugiego konta jest SKIP; niepoprawne dane, brak oczekiwanego rabatu, obcy odczyt lub zmiana dają FAIL. HTTP 401 nie zalicza izolacji — oba konta muszą być poprawnie zalogowane.

Standardowe próby izolacji tworzą wyłącznie koszyki. **Regresja z zapisem** wykonuje dodatkowo ISO-006: po jednym nowym zamówieniu diagnostycznym dla każdego kierunku kont (do dwóch), także po zmianie wyceny przez obce żądanie. Raport porównuje trzy stany: przed próbą, po próbie i po finalizacji. Poprawne przeliczenie podczas zapisu nie usuwa wcześniejszego FAIL izolacji. Nie są pobierane PDF-y tych dwóch zamówień. Zwykły silnik zamówień nadal blokuje finalizację przy niezgodnościach cen. Test zakłada, że token koszyka nie zastępuje uprawnień właściciela.

## Co oznacza „ziarno losowania”?

Ziarno (`seed`) to tekst sterujący losowym wyborem produktów, ilości, płatności i dostawy. Pozwala powtórzyć wybór z wcześniejszego testu, np. podczas sprawdzania zgłoszonego błędu. Nie jest hasłem ani tokenem dostępu.

W panelu pole **Powtórz losowanie** jest opcjonalne. Pozostaw je puste, aby użyć losowania wynikającego z konfiguracji testu. Aby odtworzyć wcześniejszy przebieg, skopiuj wartość **Ziarno losowania** z jego raportu i wklej ją do tego pola. Możesz też wpisać własny tekst, np. `proba-1`, i używać go w kolejnych uruchomieniach.

Ten sam tekst odtwarza wybory tylko przy tej samej liście produktów, ustawieniach i dostępnych metodach API. Nie przywraca dawnych cen, rabatów, stanów magazynowych ani zamówienia. Pole w panelu dotyczy testów koszyka i zamówienia; nie steruje regresją ani testami paczek.

## Polecenia i pliki startowe

W PowerShell użycie `npm.cmd` omija problemy lokalnej polityki uruchamiania skryptów `npm.ps1`.

| Polecenie | Działanie |
| --- | --- |
| `npm.cmd run setup` | Tworzy brakujące lokalne konfiguracje z przykładów |
| `npm.cmd run ui` | Uruchamia panel |
| `npm.cmd run login:dev` | Otwiera logowanie GitLab i zapisuje sesję |
| `npm.cmd run dev` | Testuje koszyk bez finalizacji |
| `npm.cmd run dev -- --complete` | Testuje i finalizuje zamówienie dev |
| `npm.cmd run dev -- --seed MOJE_ZIARNO` | Odtwarza losowanie koszyka/metod przy tej samej puli i dostępności |
| `npm.cmd run plan` | Pokazuje plan przykładowej konfiguracji bez żądań API |
| `node api-tests/run.mjs --config config/dev.local.json --plan` | Plan aktualnej lokalnej konfiguracji bez żądań API |
| `npm.cmd run catalog` | Ogólne testy katalogu |
| `npm.cmd run prices` | Osobny test cen i zaokrągleń |
| `npm.cmd run descriptions` | Osobny test opisów zależnych od kanału |
| `npm.cmd run catalog:create -- --input config/product-create.local.json` | Tworzy tylko produkt i wariant z podanych danych; historyczna nazwa skryptu npm |
| `npm.cmd test` | Testy samego narzędzia na symulowanym API |
| `npm.cmd run demo` | Lokalna demonstracja raportu bez połączeń do GWO |

Pliki do uruchamiania dwuklikiem:

| Plik | Zastosowanie |
| --- | --- |
| `Przygotuj.cmd` | Przygotowanie konfiguracji i zależności |
| `Panel-testow.cmd` | Panel lokalny |
| `Zaloguj-dev.cmd` | Sesja GitLab |
| `Testuj-koszyk-dev.cmd` | Koszyk bez finalizacji |
| `Zamowienie-dev.cmd` | Pełne zamówienie |
| `Testuj-katalog-dev.cmd` | Ogólny katalog |
| `Testuj-ceny-dev.cmd` | Zaokrąglenia |
| `Testuj-opisy-dev.cmd` | Opisy kanałowe |
| `Nowy-produkt-dev.cmd` | Formularz tworzenia produktu |
| `Nowy-produkt-i-katalog-dev.cmd` | Zgodność ze starą nazwą: otwiera już sam formularz, nie cały katalog |

Starsze `node api-tests/catalog-run.mjs --create` pozostaje technicznym trybem łączonym tworzenia i audytu katalogu. Nowy formularz i skrypt `catalog:create` nie korzystają z tego trybu.

## Konfiguracja testów

### Koszyk: `config/dev.local.json`

- `baseUrl`, `environment`, `enabled` — adres i blokady środowiska.
- `credentials` — **nazwy zmiennych środowiskowych**, bez wartości haseł.
- `scenario.products` — stała lista kodów wariantów/ISBN i ilości; używana po wyłączeniu losowania.
- `scenario.shippingAddress`, `billingAddress` — adresy konta testowego; nie są automatycznie losowane.
- `scenario.randomProducts` — grupa i zakresy losowania.
- `scenario.randomCheckout` — losowanie płatności i dostawy.
- `scenario.expectations` — niezależne oczekiwania sum, rabatów, dostępnych metod i dokumentów.
- `scenario.forbiddenPaymentCodes` — opcjonalny negatywny test odrzucania niedostępnych płatności.
- `pdfAllowedOrigins` — dodatkowe jawnie zaufane źródła PDF; domyślnie pobieranie tylko z pochodzenia API.
- `timeoutMs`, `pdfAttempts`, `pdfRetryMs` — timeout i ponawianie pobierania PDF. Nie ponawiają `complete`.

### Pula produktów: `config/products.json`

Lista zawiera `productVariant`, opcjonalny `merchandiseCode`, grupę `adamada` / `pozostale` i opcjonalne `enabled: false` z uzasadnieniem. To utrzymywana lokalnie pula testowa, nie automatycznie synchronizowany katalog CMS.

Kod handlowy CMS i kod wariantu API mogą być różne. Przykładowe mapowanie używane w puli: `12a → 12`, `34 → 4321`, `dsgdsg → 432423`, `testowy321 → test1`, `11 → 3465346`. W koszyku należy wysłać kod wariantu.

Losowanie wybiera grupę, następnie 1–5 różnych produktów i ilości 1–10. Adamada nie jest łączona z pozostałymi grupami. Dla Adamady pula może być mniejsza od pięciu pozycji. Formularz dodatkowo przecina pulę z bieżącą dostępnością WHOLESALE w API.

Ziarno zapisuje wybór, ale nie zamraża cen, stanów i konfiguracji backendu. Odtworzenie wymaga tej samej puli, parametrów i oferowanych metod.

### Katalog: `config/catalog.dev.local.json`

Określa kanały, limit stron i produktów audytu, rozmiar strony, ścieżkę fixture i rygor odrzucania błędnych parametrów. Nieprawidłowe parametry powinny zwrócić kontrolowany błąd klienta; odpowiedź 500 jest zgłaszana jako błąd.

### Fixture: `config/catalog-fixtures.local.json`

Oczekiwania muszą pochodzić z przygotowanych danych CMS/specyfikacji, a nie z kopiowania odpowiedzi badanego API.

```json
{
  "products": [
    {
      "code": "qa-przyklad",
      "productVariant": "qa-przyklad",
      "main": {
        "name": "Nazwa główna QA",
        "slug": "qa-przyklad",
        "descriptionContains": "Pełny opis główny QA",
        "shortDescription": "Krótki opis główny QA"
      },
      "channels": {
        "WHOLESALE": {
          "visible": true,
          "name": "Nazwa hurtowa QA",
          "slug": "qa-hurt-przyklad",
          "descriptionContains": "Pełny opis hurtowy QA",
          "shortDescription": "Krótki opis hurtowy QA",
          "price": 5000,
          "originalPrice": 5000
        }
      }
    }
  ],
  "filters": []
}
```

Do testu fallbacku przygotuj drugi produkt z pustymi polami kanałowymi i **niepustymi danymi głównymi**. Dla RETAIL i ACADEMY ustaw w `channels` oczekiwania główne. Aktywuj właściwe kanały, ceny i kategorie produktu QA; brak produktu na liście może wynikać z taksonomii, mimo że szczegóły po slugu są dostępne.

Opcjonalne `variantName` na poziomie fixture włącza porównanie nazwy wariantu w koszyku. Bez niezależnej wartości ta kontrola ma SKIP. Filtry pozytywne wymagają jawnych wartości i pełnej oczekiwanej listy kodów.

## Kontrole cen i rabatów

Kwoty API są liczbami całkowitymi w **groszach**. Formularz produktu przyjmuje złote jako tekst, np. `18,40`, i przelicza je dokładnie na `1840`. Procent rabatu w odpowiedziach to np. `10`, nie `0.10`.

Scenariusz zamówienia sprawdza m.in.:

- poprawność i zgodność ilości;
- sumę pozycji i `total = itemsTotal + shippingTotal`;
- zapis wybranej płatności i dostawy;
- rabat Adamady **10%** w ofertach i po wybraniu płatności;
- zgodność kwoty produktów z ofertą płatności według skonfigurowanej podstawy netto/brutto;
- oczekiwania zapisane w `expectations` oraz opcjonalne zaokrąglenia pozycji;
- niezmienione kwoty przy finalizacji i obecność wymaganych linków do dokumentów.

`paymentQuoteTotalBasis: "net"` porównuje `orderItemTotal` oferty płatności z sumą `totalNetSalesAfterDiscount` produktów, bez dostawy. To konfigurowane zestawienie pól, domyślnie informacyjne. Ścisłą kontrolę równości i blokadę zapisu włącza dopiero `enforcePaymentQuoteTotal: true`, po potwierdzeniu wspólnej reguły naliczania i zaokrąglania. Ustawienie `"gross"` porównuje z `itemsTotal`. Brak ustalenia podstawy daje pominiętą kontrolę zamiast zgadywania.

### Osobny test zaokrągleń

Konfiguracja: `config/regressions.local.json`, sekcja `pricing`.

Potwierdzone przez użytkownika wzorce starej hurtowni dla ceny 18,40 zł brutto i rabatu 23%:

| Ilość | Sprawdzane pole pozycji | Oczekiwanie |
| --- | --- | --- |
| 1 | `discountedUnitPriceNet` | `1349`, czyli 13,49 zł netto |
| 6 | `total` | `8499`, czyli 84,99 zł brutto pozycji |

Dla ilości 1–10 raport zapisuje netto/brutto oraz kontroluje rabat i spójność sum. Dla ilości bez niezależnego wzorca pokazuje obserwacje; nie uznaje domyślnego algorytmu za potwierdzony.

Test wybiera wyłącznie płatność z listy API oferującą 23%. Jeśli jej nie ma, wynik to **INCOMPLETE**. Program nie zmienia sam rabatów konta i nie wybiera ukrytej metody płatności. Tymczasowe ustawienie rabatu w CMS wymaga uzgodnienia; po pomiarze należy odtworzyć poprzednią wartość. Jednorazowy pomiar dev z 16.10.2026 potwierdził obie wartości wzorcowe; po teście przywrócono pierwotne 50% przy odbiorze. Wyniki są w lokalnych raportach, poza Git.

## Tłumaczenia produktów per kanał

Osobny zestaw `npm.cmd run descriptions` wykorzystuje fixture zawierające `main`.

| Kanał | Oczekiwane źródło |
| --- | --- |
| WHOLESALE | Pola `ProductChannelTranslation`, a przy pustych polach wartości główne `ProductTranslation` |
| RETAIL | Główne `ProductTranslation` |
| ACADEMY | Główne `ProductTranslation` |
| EMPIK | Integracja OfferUpdater; brak pokrycia tym zestawem API sklepu |

Sprawdzane: nazwa i slug na liście, nazwa/slug/opis/krótki opis w szczegółach oraz `productName` w nowo utworzonym koszyku dla każdego przygotowanego kanału. Test nie finalizuje tych koszyków.

Nie należy utożsamiać wyniku tego zestawu z pełną akceptacją zadania. Oddzielne przypadki SKIP wskazują brak pokrycia walidacji CMS, długości i unikalności slugów, specjalnych typów produktów, kursów, generowania URL, e-maili, powiadomień, treści PDF oraz integracji Empik. W szczególności brak testowego serwera Empik nie jest wynikiem PASS.

## Tworzenie książki przez formularz CMS

Formularz w panelu tworzy książkę przez `POST https://cms-ksiegarnia.gwodev.pl/products/new/simple/BOOK`. Jest to zapis formularza CMS z sesją administratora i aktualnym CSRF, w formacie `application/x-www-form-urlencoded`. Nie używa admin API ani bezpośredniego zapisu do bazy.

Pola panelu: kod produktu QA, kod handlowy (wcześniej podpisany „kod wariantu”), nazwa, slug, kanał i trzy ceny. Przed zapisem panel pokazuje podgląd danych; tokeny i pola sesji nie są wyświetlane. Wymagane atrybuty książki (autor, liczba stron, ISBN) test uzupełnia wartościami QA. Produkt powstaje jako nieaktywny i niewidoczny; pozostaje w CMS.

Każda zmiana pola usuwa poprzedni podgląd i blokuje tworzenie do ponownego sprawdzenia. Błąd walidacji jest widoczny przy podglądzie, a błędne pole zostaje zaznaczone. Kod QA nie jest nazwą produktu: np. `qa-testowa-ksiazka` wpisuje się jako kod, a dowolny tytuł w pole nazwy. Spóźnione odpowiedzi nie nadpisują nowszych danych.

1. Pobranie świeżego formularza w sesji zapisanej w `.auth/dev.json`.
2. Jeden POST nowej książki i potwierdzenie przekierowania do ID produktu.
3. Ponowny odczyt formularza edycji: kod, nazwa, slug, kod handlowy, kanał, trzy ceny i ukrycie.
4. Osobny raport z oczekiwaniami, pomiarami i faktycznym HTTP. Przy timeout zapis nie jest ponawiany; przed kolejną próbą należy sprawdzić kod z `creation-intent.json` w CMS.

Z terminala: `npm run catalog:create -- --input config/product-create.local.json`. Dotychczasowy format wejścia pozostaje zgodny; `variantCode` oznacza teraz **kod handlowy formularza CMS**, a nie osobny kod wariantu admin API. Ten endpoint obsługuje wyłącznie typ BOOK. Dla WHOLESALE cena i oryginalna cena muszą być identyczne, a minimum price wynosić 0 zł; podgląd odrzuca inne wartości przed zapisem.

Historyczne testy `POST /api/v2/admin/products` oraz `/admin/product-variants` i ich wyniki 403 pozostają dowodem tamtej ścieżki. Funkcja `runProductCreation` w `features.mjs` zachowuje stary test API; panel i CLI `product-create` używają teraz `runCmsProductCreation`. Sukces CMS nie oznacza naprawy uprawnień API.

## Wszystkie endpointy używane przez scenariusze

Wszystkie poniższe ścieżki są względem `https://ksiegarnia.gwodev.pl/api/v2`. `{order_token}` oznacza token nowo utworzonego koszyka, a `{item_id}` identyfikator pozycji z jego odpowiedzi. Token nie jest numerem zamówienia.

| Metoda | Endpoint | Zastosowanie / główne dane |
| --- | --- | --- |
| POST | `/shop/authentication-token` | Logowanie hurtownika; body `email`, `apiPassword`; token Bearer |
| POST | `/shop/orders` | Utworzenie koszyka; `localeCode: "pl_PL"`; odczyt `tokenValue` i `id` |
| POST | `/shop/orders/{order_token}/items/bulk` | Dodanie produktów; `items[]` z `productVariant` **albo** `isbn` oraz `quantity` |
| GET | `/shop/orders/{order_token}` | Migawka pozycji, sum, rabatów, płatności/dostawy oraz dokumentów po finalizacji |
| PATCH | `/shop/orders/{order_token}/items/{item_id}` | Zmiana ilości; body `quantity` |
| GET | `/wholesale/orders/{order_token}/payments` | Dostępne płatności, `code`, `name`, `rebatePercent`, `orderItemTotal` |
| PATCH | `/wholesale/orders/{order_token}/payment-method` | Zapis płatności; body `paymentMethodCode` |
| GET | `/wholesale/checkout-step-two/{order_token}` | Lista dostaw dla bieżącego koszyka po zapisaniu płatności |
| POST | `/wholesale/checkout-step-two/{order_token}` | Zapis dostawy i adresów; `orderTokenValue`, `shippingMethodCode`, `shippingAddress`, `billingAddress` |
| PATCH | `/shop/orders/{order_token}/complete` | Końcowe zatwierdzenie; body `{}`; wyłącznie tryby z finalizacją |
| GET | `/shop/products-dto` | Lista, wyszukiwanie, filtrowanie i sortowanie produktów w wybranym kanale |
| GET | `/shop/products-dto-by-slug/{slug}` | Szczegóły produktu po slugu i dla wskazanego kanału |
| POST | `/admin/authentication-token` | Logowanie administratora; body `email`, `password` |
| POST | `/admin/products` | Utworzenie produktu; kod i `translations.pl_PL` |
| POST | `/admin/product-variants` | Utworzenie wariantu; kod, IRI produktu i `channelPricings` |

### Dokumenty PDF

Runner wykonuje także **GET adresów zwróconych przez API** w `pdfSummary` i opcjonalnie `paymentForm`. Nie ma jednej stałej ścieżki PDF. Link jest sprawdzany względem dozwolonych źródeł; program kontroluje typ odpowiedzi i sygnaturę `%PDF-`. Domyślne nazwy lokalne: `pdfSummary.pdf`, `paymentForm.pdf`.

### Nagłówki

| Nagłówek | Zastosowanie |
| --- | --- |
| `X-Api-Channel` | `WHOLESALE`, `RETAIL`, `ACADEMY`; checkout hurtowni używa WHOLESALE |
| `X-Tests-Token` | Lokalna wartość z `.env` |
| `Authorization: Bearer …` | Token właściwego API po logowaniu |
| `Cookie` | Sesja bramki GitLab, ograniczana domeną/ścieżką/ważnością cookie |
| `Accept: application/json` | Odpowiedzi API |
| `Content-Type: application/json` | POST z JSON |
| `Content-Type: application/merge-patch+json` | PATCH z JSON |

Przekierowanie do logowania ani HTML z kodem 200 nie jest uznawane za poprawną odpowiedź JSON.

### Parametry listy `/shop/products-dto`

| Parametr | Działanie |
| --- | --- |
| `page` | Numer strony |
| `limit` | Rozmiar strony; podgląd panelu dopuszcza 1–100 |
| `order_by` | `taxon_position_wholesale_category` lub `name` |
| `sort` | `asc` lub `desc` |
| `name` | Wyszukiwanie po nazwie, ISBN lub autorze |
| `publication_type[]` | Rodzaje publikacji |
| `subjects[]` | Przedmioty |
| `primary_school[]` | Klasy szkoły podstawowej |
| `high_school[]` | Klasy liceum/technikum |
| `taxons[]` | Taksonomie |

Rzeczywista odpowiedź listy jest obiektem `{data, pagination}`. W szczegółach parametr `{slug}` jest kodowany jako fragment ścieżki. Opis Swaggera wymieniał też `code` jako parametr ścieżki, mimo że URL ma tylko `{slug}`; runner nie dodaje fikcyjnego parametru.

### Endpointy pomocnicze i zakres niezaimplementowany

Podczas ręcznej diagnostyki używano również `GET /shop/products/{code}` (np. identyfikacja wariantu), `GET /admin/products` i `GET /admin/taxons` (sprawdzenie dostępu) oraz `GET /api/v2` (odczyt osadzonej specyfikacji). Nie są stałą częścią powyższych scenariuszy.

`GET /academy/closed-courses` i `GET /academy/paid-courses` są testowane w zestawie opisów kanałowych z kanałem ACADEMY, zgodnie z lokalnymi wzorcami kursów i stron. Integracja OfferUpdater Empik nie jest wywoływana.

Panel CMS `/login`, formularze `/products/new/simple/BOOK`, `/products/{id}/edit` i ustawienia hurtownika są odrębnym interfejsem administracyjnym. Formularz „Nowy produkt API” nie wysyła do nich danych i nie obchodzi uprawnień admin API.

Zestaw `descriptions-cms` korzysta z `GET /products/{id}/edit` i `POST /products/{id}/edit` na hoście `https://cms-ksiegarnia.gwodev.pl`, z aktualnym CSRF, sesją administratora i nagłówkiem Referer formularza. Są to operacje formularza CMS, a nie `/api/v2/admin/products`. Nazwy wariantów QA przygotowano w oddzielnych formularzach `/products/{id}/variants/{variantId}/edit` i potwierdzono po zapisie; zwykły test opisów tylko porównuje je z API koszyka.

## Endpointy lokalnego panelu

Te ścieżki należą do `http://127.0.0.1:18767`, nie do Syliusa.

| Metoda | Ścieżka | Zastosowanie |
| --- | --- | --- |
| GET | `/` | Interfejs panelu |
| GET | `/app.js`, `/wizard.js`, `/product-form.js`, `/style.css` | Zasoby panelu |
| GET | `/api/documentation` | Bieżący README jako bezpiecznie sformatowana dokumentacja i spis treści |
| GET | `/README.md` | Pobranie źródłowego README projektu |
| GET | `/api/state` | Stan danych, przebiegów i raportów; bez haseł/tokenów |
| POST | `/api/run` | Uruchomienie dozwolonego zestawu: m.in. `cart`, `order`, `wizard`, `catalog`, `product-create`, `rounding`, `descriptions`, `descriptions-cms`, `login`; również zestawy regresji i zgłoszeń opisane wyżej |
| POST | `/api/stop` | Zatrzymanie aktywnego przebiegu po jego identyfikatorze |
| POST | `/api/preview` | Bezpiecznie ograniczony podgląd GET listy lub szczegółów katalogu |
| POST | `/api/product/preview` | Lokalna walidacja danych i przygotowanie JSON; bez zapisu w Syliusie |
| POST | `/api/wizard/products` | Pobranie dostępnej puli formularza zamówienia |
| POST | `/api/wizard/choice` | Wybór aktywnej płatności, dostawy lub zatwierdzenia; identyfikator etapu chroni przed ponowieniem starego kliknięcia |
| GET | `/reports/{przebieg}/{plik}` | HTML/JSON/PDF istniejącego raportu, wyłącznie spod `raporty-api` |

Operacje POST wymagają `Content-Type: application/json`, zgodnego nagłówka `Origin` oraz `X-UI-Token` pobranego z bieżącej strony. Panel nie jest publicznym serwerem ani ogólnym proxy dowolnych adresów.

## Raporty i interpretacja wyników

Każdy przebieg zapisuje osobny folder w `raporty-api/`:

```text
raporty-api/
  <data-i-identyfikator>/
    raport.html
    raport.json
    pdfSummary.pdf       # jeśli pobrano
    paymentForm.pdf      # jeśli wymagany/dostępny i pobrano
  katalog-<data-i-id>/
  rounding-<data-i-id>/
  descriptions-<data-i-id>/
  product-create-<data-i-id>/
```

| Wynik | Znaczenie |
| --- | --- |
| PASS | Wykonane kontrole danego przebiegu przeszły; zawsze sprawdź również liczbę SKIP i zakres |
| FAIL | Co najmniej jedna kontrola lub żądanie nie przeszło; raport zachowuje błąd i wykonane kroki |
| SKIP | Konkretna kontrola nie została wykonana lub brakuje niezależnych danych oczekiwanych |
| INCOMPLETE | Osobne zestawy cen/opisów nie mogły wykonać pełnego zakresu, bez wykrytego FAIL |
| CANCELLED | Stan lokalnego przebiegu zatrzymanego przez użytkownika; częściowy raport może mieć FAIL |

Raport zakupowy zawiera plan produktów, migawki cen, rabatów i sum, historię zmian, dostępne i wybrane metody, ziarno losowania, żądania HTTP i pobrane dokumenty. Raporty funkcjonalne zawierają dane referencyjne oraz tabele pomiarów/wyników. Raport tworzenia produktu nie jest raportem katalogu.

Po wysłaniu `complete` program **nie ponawia** tej operacji po timeoutach. Brak odpowiedzi może oznaczać zapisane zamówienie. Sprawdź stan w CMS przed kolejną próbą. Jeżeli API nie zwraca `state`, kontrola zmiany stanu jest SKIP; przyjęcie `complete`, kwoty i dokumenty są sprawdzane osobno.

Pobranie poprawnego pliku PDF nie potwierdza jego treści ani doręczenia e-maila. Odczyt bazy transferowej i Syliusa jest opcjonalny (sekcja Porównanie API z bazą poniżej). Skrzynka odbiorcza i ekstraktor zawartości PDF nie są zintegrowane; ich kontrole pozostają pominięte.

## Testy samego narzędzia

```powershell
npm.cmd test
```

Testy w `tests/` działają na lokalnych serwerach/mockach odpowiedzi, **bez połączeń do dev/test**. Obejmują m.in.:

- checkout i finalizację, brak powtórzeń `complete`, awarie i błędny PDF;
- rabaty Adamady, sumy, oferty płatności i interpretację netto/brutto;
- losowanie bez mieszania grup, odtwarzanie ziarna i wybór tylko dostępnych metod;
- katalog, fixture, filtry, paginację i niezgodności listy/szczegółów;
- lokalny panel, dostęp do raportów, token/Origin i zatrzymywanie przebiegu;
- etapy formularza i oczekiwanie na zatwierdzenie;
- osobne tworzenie produktu, odmowę 403, brak uruchamiania katalogu po tworzeniu;
- dokładne przeliczanie złotych na grosze, wzorce zaokrągleń i brak wymaganego rabatu;
- nazwy per kanał w DTO oraz koszykach, jawne oznaczanie niepokrytego zakresu;
- maskowanie sekretów, również krótkich, bez uszkadzania nazw plików.

Zielony wynik tych testów oznacza poprawność narzędzia na kontrolowanych odpowiedziach. Nie zastępuje uruchomienia scenariuszy wobec rzeczywistego backendu.

## Struktura projektu

```text
api-tests/
  config.mjs             # .env, konfiguracja, blokady, cookies, maskowanie
  setup.mjs              # przygotowanie lokalnych plików po sklonowaniu
  engine.mjs             # przebieg koszyka i zamówienia, kontrole, PDF
  products.mjs           # losowanie produktów i grup
  checkout.mjs           # losowanie dostępnych metod
  http.mjs               # klient API dla katalogu i osobnych funkcji
  catalog.mjs            # ogólny zestaw katalogu
  features.mjs           # tworzenie produktu, ceny, opisy kanałowe
  run.mjs                # CLI koszyka/zamówienia
  catalog-run.mjs        # CLI katalogu (także historyczny tryb łączony)
  features-run.mjs       # CLI osobnych zestawów funkcjonalnych
  login.mjs              # logowanie przez Playwright
  report.mjs             # raport zakupowy HTML/JSON
  catalog-report.mjs     # raport katalogu
  feature-report.mjs     # raporty osobnych zestawów
  demo.mjs               # lokalna symulacja
config/
  *.example.json         # bezpieczne wzory w Git
  *.local.json           # lokalne ustawienia — poza Git
  products.json          # wspólna pula produktów testowych
dashboard/
  server.mjs             # lokalny HTTP i uruchamianie zestawów
  wizard.mjs             # walidacja koszyka i oczekiwanie na wybory
  public/                # HTML, CSS i JS panelu, formularze
tests/                   # testy samego narzędzia i mock API
.env.example             # nazwy zmiennych, bez danych dostępowych
.gitignore
INSTRUKCJA.txt            # dodatkowe notatki i historia ustaleń
zapisz-raport.ps1         # starszy konwerter lokalnych danych do raportu
```

Oryginalna kolekcja Postmana i historyczne katalogi `raporty/`, `raporty-api/` mogą pozostać lokalnie. Nie są potrzebne do działania silnika po sklonowaniu. Raport demonstracyjny można odtworzyć przez `npm.cmd run demo`.

## Git i pliki lokalne

Do repozytorium należą źródła, testy, `package.json`, **`package-lock.json`**, bezpieczne przykłady konfiguracji, skrypty startowe i dokumentacja.

`.gitignore` wyklucza:

- `.env` i jego lokalne odmiany, z wyjątkiem plików przykładowych;
- `.auth/`, prywatne klucze/certyfikaty i pliki sesji;
- `config/*.local.json` oraz obserwacje formularzy CMS;
- oryginalną lokalną kolekcję Postmana i eksporty środowisk/globalnych zmiennych;
- `node_modules/`;
- raporty, PDF-y, zrzuty i specyfikacje zapisane pod `raporty/` i `raporty-api/`;
- wyniki Playwright/coverage, cache, logi i pliki tymczasowe.

Plik już śledzony nie zostaje odśledzony przez samo dodanie reguły ignorowania. Przy porządkowaniu indeksu używa się `git rm --cached`; plik pozostaje na dysku. Zmiana ignorowania i usunięcie plików z indeksu **nie czyszczą wcześniejszej historii commitów**. Nie należy przepisywać opublikowanej historii bez uzgodnienia z zespołem.

Przed commitem/push sprawdź:

```powershell
git status --short
git diff --cached --stat
git ls-files .env .auth node_modules raporty raporty-api "config/*.local.json"
git check-ignore -v .env .auth/dev.json node_modules/playwright/package.json config/dev.local.json
```

Polecenie `git ls-files` dla powyższych prywatnych/wygenerowanych ścieżek powinno niczego nie zwracać. Nie dodawaj ich przez `git add -f`. Przed udostępnieniem także raportów poza Git sprawdź dane klientów i adresy.

Projekt nie wykonuje sam commitów, push ani zmian historii. Zmiany cen/rabatów backendu nie są częścią inicjalizacji repozytorium.

## Rozwiązywanie problemów i ograniczenia

| Objaw | Co sprawdzić |
| --- | --- |
| Przekierowanie do GitLab albo HTML zamiast JSON | Uruchom logowanie ponownie; sprawdź, czy ręczny cookie nie zasłania nowej sesji |
| Brak danych logowania / HTTP 400 przy autoryzacji | Uzupełnij właściwe dane hurtownika w `.env`; hasło GitLab nie jest `apiPassword` |
| `403 Access Denied` przy `admin/products` | Uprawnienia/konfigurację admin API; działający CMS nie dowodzi możliwości zapisu JSON |
| Produkt „nie istnieje” lub nie jest dostępny | Kod wariantu, kanał, aktywację, cennik, dostępność, kategorię i indeks wyszukiwania |
| Szczegóły produktu działają, brak na liście | Kategorie kanału, widoczność na liście i indeksowanie; nie zakładaj automatycznie błędu nazwy |
| INCOMPLETE w cenach | Dostępną płatność z dokładnie 23% rabatu |
| INCOMPLETE w opisach | Fixture i opisany w raporcie zakres nieobjęty API sklepu |
| Oferta płatności różni się od koszyka | Porównaj pola netto/brutto i rabaty pozycji; test zatrzymuje dalszy zakup |
| API 500 dla listy innego kanału lub złych parametrów | Zachowaj raport dla backendu; nie zmieniaj asercji na PASS tylko dlatego, że serwer zwraca 500 |
| FAIL po wysłaniu `complete` | Sprawdź informację o finalizacji i CMS przed ponownym uruchomieniem |
| Port 18767 zajęty | Panel może już działać; otwórz istniejący adres |
| Nie udało się uruchomić logowania z panelu | Uruchom `Zaloguj-dev.cmd` bezpośrednio |
| Brak `*.local.json` po pobraniu repozytorium | Wykonaj `npm.cmd run setup`, a następnie uzupełnij konfigurację |

Backend i dane dev mogą się zmieniać. Raport jest dowodem konkretnego przebiegu w określonym czasie; wcześniejszy PASS nie gwarantuje wyniku kolejnego zamówienia.


## Regresja zamówienia i paczek

Panel startowy udostępnia **Regresję zamówienia** (bez finalizacji lub z zapisem) oraz **Paczki i koszt dostawy**. Poprzedni test losowy i formularz zamówienia nadal działają. Regresja używa ustalonych produktów i oczekiwań, a metody płatności i dostawy pobiera z bieżącego API.

```powershell
npm.cmd run setup
npm.cmd run regression
npm.cmd run regression -- --complete
npm.cmd run packages
npm.cmd run packages -- --complete
```

Konfiguracja: `config/order-regression.local.json` (ignorowana przez Git), wzór: `config/order-regression.example.json`. Nowa kopia projektu wymaga potwierdzenia własnych produktów, wag, rabatów i taryfy; wartości brakujące nie są pobierane z odpowiedzi badanego API jako wzorzec.

| Ustawienie | Znaczenie |
| --- | --- |
| `groups` | Po dwa znane produkty grup `adamada` i `pozostale`; kody wariantów API |
| `quantities` | Kolejne dodatnie ilości po wyborze płatności, np. 2, 6, 1 |
| `invalidQuantities` | Ilości, które zgodnie z przyjętym kontraktem mają być odrzucone: -1, 0, 1.5; jeśli 0 ma usuwać pozycję, zmień ten zestaw i kontrakt testu |
| `adamadaRebatePercent` | Niezależny oczekiwany rabat Adamada, 10% |
| `paymentRebates` | Oczekiwane rabaty konta według kodów płatności. Brak wpisu oznacza tylko sprawdzenie spójności z ofertą API, nie poprawności ustawień konta |
| `maxCombinations` | Limit 1–96 kombinacji w jednym przebiegu. Każda pominięta z powodu limitu jest widoczna jako SKIP |
| `nonPackageShippingCodes` | Potwierdzone w CMS dostawy bez kalkulatora paczek, np. `personal_collection` (flat_rate) |
| `validationStatuses` | Konkretne dozwolone statusy walidacji; 401 i 500 nie zaliczają testu negatywnego. 403 jest dopuszczony wyłącznie w kontroli uprawnień do istniejącej płatności |
| `forbiddenPayments` | Tablica `{code, source}`: metoda istniejąca w systemie, ale niedostępna kontu; `source` opisuje niezależne potwierdzenie w CMS. Pusta tablica daje SKIP, nie zastępuj jej losowym kodem |
| `stockFixture` | `null` lub `{productVariant, availableQuantity, source}`: potwierdzony zapas 1–999 sztuk, aktywna kontrola zapasu, bez backorder. Test próbuje dodać jedną sztukę ponad zapas, bez complete. Brak wzorca daje SKIP |
| `validationStatuses.forbiddenPayment` | Odmowa wyboru istniejącej niedostępnej płatności; domyślnie 400/403/422 |
| `validationStatuses.repeatComplete` | Dopuszczalne odpowiedzi drugiego complete: domyślnie 200/204/400/409/422, zawsze z wymaganiem niezmienionego id, numeru i zapisu. 404 można dodać po uzgodnieniu kontraktu |
| `packages.product.unitWeightGrams` | Waga jednej sztuki potwierdzona w CMS, w gramach |
| `packages.paymentCode` | Dostępna płatność używana do niezależnych pomiarów kosztu GLS |
| `packages.paymentSurchargeGrossMinor` | Potwierdzona dopłata tej płatności dla GLS w groszach, także jawne 0. Przy cash_on_delivery na dev odczytano 1500. Nie wolno pomijać dopłaty przy porównaniu shippingTotal |
| `packages.calculator` | Niezależny wzorzec: singlePackageWeight (g), priceIsNet, taxPercent, weightRanges: from/to włącznie i priceMinor w groszach |
| `packages.quantities` | Opcjonalne ilości referencyjne. Bez nich test dobiera najbliższe osiągalne wagi przed/na/za progami paczek i przedziałów |

### Zakres przypadków

- AUTH-002: jedna próba logowania prawidłowego konta z losowym błędnym hasłem, oczekiwane HTTP 401 bez JWT. AUTH-003: sześć prób GET koszyka, płatności i dostaw — bez JWT oraz z błędnym JWT. Każda ma nowy, wcześniej dostępny właścicielowi koszyk i porównanie stanu po odmowie. Nie bada to naturalnego wygasania poprawnie podpisanego JWT ani blokady konta po wielu nieudanych logowaniach.
- Kolejne płatności w tym samym koszyku i powrót do pierwszej, z kontrolą rabatów, kodu metody, ofert i dostaw. Brak dwóch dostępnych metod daje SKIP.
- Istniejąca, ale niedostępna płatność po skonfigurowaniu `forbiddenPayments`. Kontrola obejmuje bezpośredni PATCH i niezmienność koszyka, także adresów.
- Każda dostępna płatność, a następnie dostawy dostępne po jej zapisaniu. Każda kombinacja ma nowy koszyk; obie grupy produktów są testowane oddzielnie.
- Przeliczenie po zmianie ilości, rabat pozycji, świeża oferta płatności, sumy pozycji i suma produktów z dostawą. Pola pieniężne muszą być nieujemnymi całkowitymi kwotami w groszach.
- Kilka produktów jednej grupy, ponowne dodanie produktu zwiększające ilość oraz `DELETE /api/v2/shop/orders/{tokenValue}/items/{itemId}` usuwające pozycję.
- Ilości niepoprawne, nieistniejące produkty/płatności/dostawy i niepełny adres. Po odrzuceniu porównywany jest stan koszyka, aby wykryć częściowy zapis.
- Dla GLS: `shipmentPackageQuantity`, `shippingTotal`, `shippingTotalNet`, wzrost i spadek ilości oraz przejście na metodę bez kalkulatora. Liczba paczek = sufit(waga/pojemność), cena paczki pochodzi z przedziału wagi całego zamówienia. Wzorzec kosztu uwzględnia dopłatę płatności i VAT, z zaokrągleniem do grosza.
- Wariant `--complete`: zapis maksymalnie po jednym poprawnym zamówieniu dla każdej grupy i dla scenariusza paczek (do 3), pobranie PDF, kontrola kosztów i liczby paczek. Po potwierdzonym zapisie z numerem zamówienia: jedna jawna druga próba complete i porównanie id, numeru, kwot, pozycji, metod i adresów. Po timeoutcie pierwszego complete nie wykonuje tej próby; po timeoutcie drugiego tylko odczytuje stan, bez trzeciego PATCH. Nie dowodzi to braku dodatkowych e-maili lub rekordów transferu. Dodatkowo ISO-006 może zapisać dwa zamówienia diagnostyczne izolacji, a negatywne próby pustego i mieszanego koszyka mogą utworzyć zamówienie, jeśli backend błędnie je zaakceptuje. Test odnotowuje FAIL i nie ponawia negatywnego żądania.

Nie zakładamy, że sprawdzenie kilku osiągalnych wag książki 210 g potwierdza dokładnie granicę 8000/8001 g. Do dokładnych granic można użyć tymczasowego profilu, np. 420 g i książki 210 g: 1, 2, 3 szt. dają wagi poniżej, na i powyżej limitu. Nie zmieniamy wagi istniejących produktów.

Bez włączenia porównania baz zapisy `sylius_shipment.shipment_package_details` i transfer `orders_items` z kodem KWys mają SKIP. Izolacja między klientami jest sprawdzana po skonfigurowaniu drugiego konta; porównuje również treść adresów, jeśli GET udostępnia oba. Różnice adresowe w dowodach nie zawierają ich wartości. Nadal wymagają danych lub osobnej integracji: przekroczenie potwierdzonego zapasu, istniejąca niedostępna metoda bez wzorca, wykrywanie zduplikowanych e-maili/transferów i treść PDF. Jeśli brak błędów, ale są pominięcia, raport ma INCOMPLETE, nie pełny PASS.

### Tymczasowa konfiguracja GLS przez CMS

W karcie paczek rozwiń **Test z tymczasową zmianą ustawień CMS**. Wpisz wagę jednej paczki, granicę dwóch przedziałów, ceny w zł oraz netto/brutto. Przycisk uruchamia kolejno zapis profilu w CMS, test API i przywrócenie ustawień początkowych. Nie jest to zapis przez admin JSON API: ustawienia przygotowuje Playwright w CMS, a badany koszyk obsługuje natywne HTTP API.

Mechanizm jest ograniczony do dev, `shipping-methods/6/edit?_channel_code=WHOLESALE`, kodu `gls_wholesale`, kalkulatora `weight_range_shipping` i kategorii podatkowej `books` / VAT 5%. Liczba wierszy przedziałów musi odpowiadać CMS (obecnie 2). Nie zmienia kanałów, dostępności, kodu dostawy ani podatków. Wykorzystuje `BROWSER_CHANNEL` (domyślnie msedge), sesję GitLab z `.auth/dev.json` oraz `SYLIUS_ADMIN_EMAIL` i `SYLIUS_ADMIN_PASSWORD`. Sesja CMS z ręcznie otwartego okna nie jest automatycznie współdzielona.

Przed zmianą powstaje `.auth/shipping-restore.json`; zawiera tylko kopię konfiguracji, bez haseł, tokenów i cookies. Istniejący dziennik blokuje nową zmianę. Przywracanie w finally działa również po błędzie i zatrzymaniu testu; po nim następuje odczyt kontrolny. Po zabiciu procesu lub komputera finally może się nie wykonać — wtedy użyj:

```powershell
npm.cmd run packages:restore
```

Jeżeli ktoś w międzyczasie zmienił konfigurację, test nie nadpisze jego wartości i zachowa dziennik do ręcznego uzgodnienia. Nie uruchamiaj równolegle innych narzędzi/testów GLS podczas tego scenariusza: ustawienia są wspólne dla dev. Automatyczne przywrócenie nie jest transakcją bazodanową.

Raport zawiera tabelę każdej kombinacji, pomiary cen i paczek oraz wynik przywracania. Osobne raporty finalizacji i PDF znajdują się w podfolderach final-*. W scenariuszu zmiany CMS zachowywany jest `shipping-config-audit.json` i zrzut `shipping-restored.png` (pliki lokalne, ignorowane przez Git). Nowe identyfikatory zestawów `POST /api/run`: regression, regression-order, packages, packages-profile; ostatni przyjmuje obiekt profile. Pozostałe zabezpieczenia lokalnego panelu i blokada gwotest nadal obowiązują.

## Porównanie API z bazą po finalizacji

Na ekranie startowym zaznacz **Po zapisie porównaj z bazą Sylius i transfer** przed uruchomieniem zamówienia lub regresji z zapisem. Opcja działa także dla formularza krok po kroku. Alternatywnie ustaw `HURT_VERIFY_DATABASE=true` w `.env` dla CLI. Kontrola następuje po potwierdzeniu finalizacji i pobraniu dokumentów; jej błąd nie ponawia complete i nie cofa zamówienia. Przy raportach z potwierdzoną finalizacją dostępny jest przycisk **Porównaj z bazą** — wykonuje sam odczyt, bez tworzenia nowego zamówienia.

```powershell
npm.cmd run database -- --report IDENTYFIKATOR-RAPORTU-ZAMOWIENIA
```

Dostęp został zweryfikowany przez `https://phpmyadmin.gwodev.pl/`. Baza Syliusa to **bookshop2**, baza transferowa **gwo_transfer**. Integracja wykonuje wyłącznie stałe SELECT-y z liczbowym id zamówienia. Nie ma dowolnego SQL ani operacji INSERT/UPDATE/DELETE. Nie wymaga bezpośredniego hasła DB: używa sesji GitLab `.auth/dev.json`, Edge i dostępu phpMyAdmin w tej sesji. Jeśli phpMyAdmin wymaga dodatkowego logowania, automat zgłosi błąd; nie przejmuje sesji z ręcznie otwartego okna.

API `id` odpowiada `bookshop2.sylius_order.id`. Transferowe **nOrderID odpowiada sylius_order.number**, a nie id. Potwierdzony przykład: id 5998 → numer 30001604 → transfer nOrderID 30001604. Faktyczna tabela pozycji transferu na tym środowisku to **orders_items**, podczas gdy opis zadania używał order_items.

| Tabela | Porównywane dane |
| --- | --- |
| `bookshop2.sylius_order` | Jeden rekord, id, numer, stan inny niż cart, waluta, items_total, total |
| `sylius_order_item` + `sylius_product_variant` | Kod wariantu, liczba pozycji, ilość, cena oryginalna i jednostkowa, suma pozycji, nazwa produktu |
| `sylius_payment` + `sylius_payment_method` | Jedna płatność, kod metody, kwota i waluta |
| `sylius_shipment` + `sylius_shipping_method` | Kod dostawy, koszt przesyłki oraz shipment_package_details: JSON, liczba paczek, cena jednostkowa i netto/brutto |
| `sylius_adjustment` | Korekty typów shipping/payment: koszt przesyłki i opłata płatności |
| `gwo_transfer.orders` | Jeden rekord właściwego numeru, flaga hurtowni, waluta i dPrice zgodne z total API |
| `gwo_transfer.orders_items` | Kod handlowy vcIDT, nAmount, rabat, ceny netto/brutto przed i po rabacie; brak nadmiarowych produktów |
| Pozycja `KWys` | Liczba paczek, cena z shipment_package_details oraz koszt samych paczek netto i brutto |

**shippingTotal API zawiera koszt przesyłki i opłatę płatności. KWys zawiera koszt samych paczek.** Porównanie rozdziela te składniki na podstawie korekty payment w Syliusie. Potwierdzony przykład GLS + payment_timely: paczka 15,75 zł brutto + opłata 10,00 zł = shippingTotal 25,75 zł; KWys 15,75 zł. Dla netto opłata jest przeliczana według `shippingTaxRate` API (ułamek 0.05 dla zweryfikowanego scenariusza książek 5%). W transferze odczytano dVATPercent=0.05 dla KWys, ale 5.00 dla książki — nie wolno bezpośrednio traktować obu pól jako procentu w tej samej skali. Inne kategorie podatkowe opłaty wymagają osobnego kontraktu i rozszerzenia mapowania.

API używa groszy, transfer DECIMAL(9,3) w PLN. Porównanie zachowuje trzecią cyfrę i nie zaokrągla różnic 0,001 zł do pozornego sukcesu. Kod handlowy może różnić się od kodu wariantu — mapowanie pochodzi z planu produktów. Odczyty dotyczą jednego zamówienia; nie pobieramy adresów, e-maili, numerów podatkowych ani tokenów zamówień.

Raport zamówienia pokazuje sekcję **Porównanie API / baza** oraz finansowy snapshot odczytu. Samodzielne porównanie daje osobny raport typu database. Brak wpisu transferowego jest sprawdzany do 3 razy (przerwa 2 s); nie powstaje kolejne zamówienie. Błędy odczytu i różnice nie są zaliczane jako PASS.

JSON szczegółów paczek ma limit odczytu 400 znaków; dłuższy zapis zgłasza FAIL zamiast porównania uciętych danych. Historyczne raporty z uszkodzonym przez dawne maskowanie kodem płatności mają SKIP dla tego kodu. Porównanie istniejącego raportu odnosi aktualny zapis bazy do historycznego snapshotu API, nie do nowego GET API.

Nazwy produktów są odczytywane przez SELECT w porcjach Base64 po 40 znaków, następnie dekodowane i sprawdzane względem CHAR_LENGTH z bazy. Zapobiega to fałszywym różnicom powodowanym skracaniem długich komórek przez phpMyAdmin oraz jego sposobem prezentowania spacji. Nie skracamy ani nie upraszczamy właściwej nazwy przy porównaniu. Jeśli pełna wartość nie zostanie odczytana, kontrola zgłasza błąd zamiast porównywać skrót z API.

Zestaw `POST /api/run` o identyfikatorze `database` przyjmuje `reportId`. Pole `verifyDatabase: true` w uruchomieniu zamówienia włącza automatyczne porównanie po jego zapisie. Moduł `api-tests/database.mjs` zawiera komplet SELECT-ów i mapowanie pól.

## Raporty wyjaśnione dla osób spoza zespołu API

Każdy format raportu (koszyk/zamówienie, katalog, tworzenie produktu, ceny, opisy, regresja, paczki i baza) zawiera sekcję **Raport prostym językiem**. Pokazuje cel, źródło oczekiwań, liczbę rzeczywiście zaliczonych i niezaliczonych kontroli oraz konkretne powody pominięć. Powtarzające się pominięcie jednej metody dostawy jest zgrupowane z podaniem liczby wystąpień.

Sekcja **Co i jak sprawdzono — każdy przypadek** zawiera rozwijany opis celu, planu kroków, oczekiwanego wyniku i wyniku zapisanego w przebiegu. Błędy są domyślnie rozwinięte. Nowe przebiegi regresji przypisują do każdego przypadku faktyczne żądania i pomiary cen/ilości/paczek. Plan kroków nie jest dowodem ich pełnego wykonania: FAIL może przerwać przypadek, a SKIP nie oznacza sukcesu. Dla starszych raportów bez takiej ewidencji opisy wskazują wspólne tabele i listę żądań zamiast odtwarzać brakujące dane.

PASS potwierdza wyłącznie wykonane warunki, FAIL oznacza niezgodność lub błąd kontroli, SKIP brak potwierdzenia danego warunku, a INCOMPLETE brak błędów przy niepełnym pokryciu. Niektóre starsze silniki nadają PASS mimo pominięć — opis raportu jawnie ostrzega wtedy, że pełne pokrycie nie zostało potwierdzone. Słownik wyjaśnia API, regresję, kanały, kwoty w groszach, kod wariantu, kod handlowy i KWys.

Nowe pliki JSON zawierają także pole `explanation` w wersji 1. Historyczne HTML można rozbudować bez ponownego uruchamiania API:

```powershell
npm.cmd run reports:refresh
```

Polecenie odczytuje zapisane raporty, również w podfolderach finalizacji, i aktualizuje wyłącznie `raport.html`. Zachowuje bajty `raport.json`, wyniki i dokumenty PDF. Nie wykonuje logowania, żądań sieciowych, zapisów zamówień ani odczytów bazy. Nie dopisuje historycznym testom wyników, których wcześniej nie utrwalono.

Porównanie pozycji transferu sumuje ilości i wartości netto/brutto wszystkich rekordów tego samego kodu, także gdy transfer rozbija pozycję na pojedyncze sztuki. Nadal sprawdza rabat i ceny każdego rekordu; dodatkowy rekord zwiększający ilość lub wartość daje FAIL. Porównanie pełnej wartości pozycji wykrywa różnice zaokrągleń niewidoczne przy samym sprawdzaniu ceny jednostkowej. Formularz zachowuje kod handlowy z puli produktów; dla starszych raportów bez mapowania samodzielny odczyt uzupełnia je z aktualnego config/products.json. W przypadku zmiany mapowania od czasu zamówienia trzeba najpierw potwierdzić historyczny kod w CMS.

## Użytkownik zdefiniowany — własny e-mail i rabaty z CMS

1. W nagłówku wybierz **Użytkownik zdefiniowany**. Wpisz e-mail hurtownika dev i kliknij **Zapisz e-mail i odczytaj rabaty z CMS**.
2. Panel wyszuka dokładnie jednego hurtownika po e-mailu w Syliusie. Odczyta jego id, UID i pięć rabatów, również z nieaktywnych pól formularza, bez klikania Zapisz w CMS.
3. Po udanym odczycie zapisze wyłącznie `HURT_CUSTOM_EMAIL` w lokalnym `.env`. Używa wspólnego hasła `HURT_API_PASSWORD` i tokenu środowiska pierwszego konta. Nie zmienia `HURT_EMAIL`, haseł ani drugiego konta. Nieznany e-mail albo błąd CMS nie nadpisują poprzedniego wyboru.
4. Uruchom Koszyk, Pełne zamówienie lub formularz krok po kroku. Niezapisana zmiana adresu blokuje uruchomienie z poprzednim e-mailem. Test ponownie odczyta aktualne rabaty z CMS jako niezależny wzorzec, zaloguje wskazanego użytkownika przez API i wybierze z jego dostępnych metod.
5. Raport wskazuje użytkownika zdefiniowanego i zawiera źródło wzorców rabatów wraz z id/UID i czasem odczytu. E-mail jest maskowany w żądaniach i raportach. Sam zapis adresu i pobranie rabatów nie tworzą koszyka ani zamówienia.

Wymagany jest dostęp administratora do CMS: SYLIUS_ADMIN_EMAIL, SYLIUS_ADMIN_PASSWORD i ważna sesja GitLab. Błąd odczytu zatrzymuje test; wartości nie są kopiowane z odpowiedzi badanego API. Konto 1 i Konto 2 nadal działają zgodnie ze swoimi osobnymi ustawieniami. Regresja dwóch kont nie używa wyboru użytkownika zdefiniowanego.

Nowy lokalny endpoint: `POST /api/account/custom` z body `{ "email": "uzytkownik@example.org" }`, chroniony tokenem panelu i Origin. Nie pozwala zmieniać dowolnych kluczy .env. Zapis pliku jest atomowy; hasła i pozostałe ustawienia są zachowywane. Nie zmieniaj ręcznie .env podczas zapisywania z panelu.

### UID i tabela tmp_whole_sale_wholesaler

CMS pozwala powiązać e-mail z id hurtownika oraz zewnętrznym UID. Kolumna `tmp_whole_sale_wholesaler.uid` jest unikalnym UID, a jej `id` jest odrębnym identyfikatorem rekordu tej tabeli. Nie wolno utożsamiać tych identyfikatorów. Tabela zawiera user_rebate_1, user_rebate_2, user_rebate_3 i user_rebate_5, ale nie kompletny zestaw pięciu nazwanych rabatów widocznych w CMS.

Odczyt 16.10.2026 dla potwierdzonego UID pierwszego konta nie znalazł rekordu w tej tabeli. Dlatego obecna integracja użytkownika zdefiniowanego korzysta z CMS, a nie z tabeli tmp. Nie zgadujemy mapowania numerów user_rebate_* na metody płatności ani źródła rabatu Adamady. Automatyczne porównanie tych rabatów z bazą wymaga potwierdzenia aktualnej tabeli i mapowania; nie jest jeszcze częścią testu.

Dodatkowo potwierdzono powiązanie drugiego konta: CMS id 195 → UID 235820 → tmp_whole_sale_wholesaler.id 2. Odczyt tmp dla tego UID zwrócił user_rebate_1=30,50, user_rebate_2=0, user_rebate_3=30, user_rebate_5=0, podczas gdy ekran CMS miał odpowiednio nazwane rabaty 47 / 13 / 30,5 / 90 oraz Adamada 20. Te dane nie wystarczają do ustalenia równoważnego aktualnego wzorca w bazie. Nie kopiujemy wartości tmp do CMS ani nie nadpisujemy nimi oczekiwań.


## Diagnostyka cen i blokada zapisu zamówienia

Niezgodności finansowe z potwierdzonym wzorcem (ceny, rabaty, sumy oraz oferta płatności przy włączonej ścisłej kontroli) są zapisywane jako FAIL. Test kontynuuje edycję koszyka, wybór płatności i dostawy oraz odczyt podsumowania, żeby zebrać dane z kolejnych etapów. Przed wysłaniem `PATCH /shop/orders/{token}/complete` sprawdza wyniki: wcześniejszy FAIL blokuje zapis. Wtedy nie pobiera potwierdzenia PDF ani nie porównuje zapisu z bazą. Błędy uniemożliwiające dalszy przebieg, np. brak logowania, niepoprawna odpowiedź HTTP lub niedostępna wybrana metoda, nadal przerywają test od razu.

Na początku raportu zamówienia sekcja **Co jest nie tak?** wskazuje błędny etap, produkt lub płatność, pole, wartość oczekiwaną, otrzymaną i różnicę. Tabela etapów odróżnia wykonane kontrole od pominiętych. Starszym raportom nie dopisujemy etapów, których nie zapisały.

Sekcja **Oferta płatności a netto koszyka** porównuje `orderItemTotal` wybranej oferty z sumą `items[].totalNetSalesAfterDiscount` po wybraniu płatności, bez dostawy. Pokazuje również jednostkowe netto przed i po rabacie. Przykład: D090 przy rabacie 0% zwraca 202,86 zł przed rabatem i 202,85 zł po rabacie. Dla 10 sztuk to −0,10 zł. Kolumna **Różnica brutto pozycji** sprawdza osobno `total − discountedUnitPrice × quantity`, więc może wynosić 0,00 zł mimo rozbieżności netto. Raport pokazuje różne wartości pól API; bez ustalonej reguły ich zaokrąglania nie uznaje samej różnicy za błąd ceny. Równość `unitPriceNet` i `discountedUnitPriceNet` przy rabacie 0% nie jest domyślnie wymagana. Takie obserwacje nie blokują zapisu i nie są liczone jako PASS ani FAIL. Błędne brutto, suma do zapłaty lub rabat sprzeczny z niezależnym wzorcem nadal dają FAIL. Starsze wyniki pozostają zachowane, z uwagą o wcześniejszym niepotwierdzonym założeniu.


## Biblioteka testów i wybór użytkownika w panelu

Główny widok dzieli testy na kategorie: **Zakupy**, **Regresja i dostawa**, **Produkty** i **Zgłoszenia błędów**. Początkowo pokazuje zakupy. Przycisk **Wszystkie** pokazuje cały katalog, a wyszukiwarka przeszukuje nazwy i opisy we wszystkich kategoriach. Karty wskazują zakres kont i skutek uruchomienia. Opcje porównania z bazą oraz ziarna losowania są w rozwijanej sekcji **Opcje uruchomienia**.

Panel **Aktywny użytkownik** pokazuje konto i e-mail. Przycisk **Zmień użytkownika** rozwija wybór konta oraz pięć rabatów z opisanym źródłem. Konto 1 i Konto 2 pokazują wzorce z konfiguracji; własny użytkownik pokazuje ostatni odczyt z CMS dla zapisanego adresu. Po restarcie panelu nie ma pamięci tego odczytu — zapisz e-mail ponownie, aby odczytać rabaty teraz; uruchomienie testu również odczytuje je na nowo. Wpisanie nowego e-maila wymaga użycia **Zapisz i pobierz rabaty** przed uruchomieniem testu. Wybór rodzaju konta jest pamiętany w danej sesji przeglądarki. Podczas trwającego testu zmiana konta jest zablokowana.

Wybrane konto dotyczy koszyka, pełnego zamówienia i formularza krok po kroku. Pozostałe zestawy, w tym regresja, korzystają z kont określonych w swoich scenariuszach. Dodając nową kartę w `dashboard/public/index.html`, umieść ją w odpowiedniej sekcji `suite-group` i oznacz `data-test-card`; wyszukiwarka i liczniki obejmą ją automatycznie.


### Niezależne przypadki regresji i interpretacja błędów

Do ręcznego odtworzenia izolacji w Postmanie służy [kolekcja JSON](postman/HURTOWNIA%20-%20Izolacja%20uzytkownikow.postman_collection.json). Zaimportuj plik, a w jego Variables uzupełnij lokalnie `iso_email_a`, `iso_email_b`, `iso_api_password` i `iso_tests_token_a`. Token B jest opcjonalny — pusty oznacza użycie tokenu testowego A. Zachowaj działającą sesję bramki GitLab w Postmanie lub podaj opcjonalne `iso_gateway_cookie`. Domyślny wariant to `5lp-1`, płatność przy odbiorze i oczekiwany rabat A 50%; wartości można zmienić. Uruchom kolekcję w zapisanej kolejności 01–12, z dodatkowym krokiem 07b przygotowującym dostawę i adresy, z jedną iteracją. W kroku 10 zobacz Test Results, tabelę Visualize i wynik w `iso_result`.

**Pełny przebieg zapisuje zamówienie na DEV, również po FAIL izolacji:** krok 11 wysyła `PATCH /shop/orders/{token}/complete` jako konto A, z body `{}`. Może uruchomić e-mail i transfer do bazy. Krok 12 odczytuje numer zamówienia (`iso_saved_order_number`) i porównuje wycenę po izolacji z zapisaną (`iso_completion_result`). Finalizacja może ponownie przeliczyć rabat, co nie zmienia wcześniejszego wyniku izolacji. Tokeny są zachowane po kroku 10 i czyszczone dopiero po 12. Complete nie jest ponawiane dla tego samego koszyka, także po timeout. Dla wariantu bez zapisu zaznacz w Runnerze tylko kroki do 10, wraz z 07b. Dostawę wybiera `iso_shipping_code` lub pierwsza dostępna metoda; testowe adresy można edytować w `iso_shipping_address_json` i `iso_billing_address_json`.

Dla odwrotnego kierunku zamień e-maile i oczekiwany rabat A. Plik zawiera puste dane dostępowe; wypełnione wartości pozostają lokalnie. Inne hosty niż DEV są zablokowane. Generator: `node postman/build-isolation.mjs`.

Każda próba dostępu obcego konta ma własny nowy koszyk. Właściciel najpierw wybiera płatność i odczytuje stan; następnie drugie konto wykonuje dokładnie jedną badaną operację. Test sprawdza zarówno odmowę HTTP 403/404, jak i brak zmian danych właściciela. Raport zapisuje ID koszyka, status obcej operacji i listę zmienionych pól z wartościami przed i po. Błąd jednej próby nie zanieczyszcza kolejnych. W starszych raportach ostrzeżenie wskazuje możliwość powtarzania skutku wcześniejszej zmiany wspólnego koszyka.

W wariancie z zapisem kontrola pustego koszyka rozdziela odczyt, próbę zatwierdzenia oraz niezmienność stanu. Awaria odczytu GET nie blokuje osobnego żądania PATCH complete. Jeżeli nie ma poprawnego stanu początkowego, porównanie niezmienności jest SKIP. Nie zaliczamy go na podstawie samego statusu odpowiedzi.

Sekcja **Najważniejsze ustalenia regresji** grupuje podobne objawy i wskazuje żądania zwracające HTTP 500. Odpowiedź 500 dla nieprawidłowej ilości lub nieistniejącej metody nie jest poprawną walidacją; oczekiwane statusy 4xx pozostają wymagane. Testy nie poprawiają kodu badanego backendu. Porównanie oferty płatności z netto koszyka jest informacyjne, dopóki nie potwierdzono wspólnej reguły zaokrągleń i nie włączono ścisłego wymagania `enforcePaymentQuoteTotal`.

Kolekcja Postmana resetuje poprzednią blokadę przy kroku 01 według nazwy żądania, ponieważ identyfikatory mogą zmienić się po imporcie. Nie zmieniaj nazwy pierwszego kroku. Powód zatrzymania jest zapisany w zmiennej iso_setup_error; ponowna próba od 01 czyści poprzedni błąd. Sama flaga iso_setup_blocked=true nie wyjaśnia przyczyny pierwotnego zatrzymania.

## Opisy kanałowe: oferta, RETAIL, PDF i e-mail (#33388)

W kategorii **Produkty** są dwa dodatkowe zestawy:

- **CMS i frontend RETAIL** — odczytuje trzy formularze CMS (oferta, szkolenie płatne i zamknięte), sprawdza ukrycie zakładki opisów kanałowych, porównuje nazwy i główne adresy dwóch produktów z CMS ze stronami RETAIL oraz nazwy i linki produktów dołączonych do oferty. Nie zapisuje produktów. Pozostałe widoki mają osobne SKIP, a nie domyślne PASS.
- **Nazwy w PDF i e-mailu** — tworzy i zapisuje jedno nowe zamówienie QA WHOLESALE z jedną sztuką testhurtA. Oczekiwaną nazwę odczytuje niezależnie z CMS. Sprawdza nazwę w koszyku, zapisanym zamówieniu, potwierdzeniu PDF i załączniku wiadomości. Wysyłka jest automatyczna. Adresy mają saveToAddressBook=false i isDefault=false. Nie ponawia complete po niepewnym wyniku zapisu.

Wzór ustawień: `config/description-web.example.json`; lokalne ustawienia: `config/description-web.local.json`. Zawierają produkty 10202/10203, ofertę 7 (strona /product/test321321), szkolenia kontrolne i adres MailHoga. Test dokumentów korzysta z konta pierwszego z .env; wybór użytkownika koszyka nie zmienia tego konta. Dane logowania pozostają w .env i lokalnej sesji.

### Jak sprawdzany jest e-mail

MailHog najpierw musi załadować listę — chwilowe Inbox (0) nie jest dowodem pustej skrzynki. Przed nowym zamówieniem test zapisuje czas i identyfikatory wiadomości odbiorcy. Po zapisie szuka nowej wiadomości do tego samego odbiorcy. Nie wybiera jej wyłącznie po tytule ani jako najnowszej wiadomości.

Potwierdzenie ma ogólną treść i odsyła do załączników. Dlatego nazwa produktu oraz numer zamówienia są sprawdzane w **podsumowanie.pdf**, a nie wymagane w body. Załącznik może mieć typ application/octet-stream; odczyt sprawdza nazwę, kodowanie i sygnaturę PDF. Obsługiwane jest MIME na głównym poziomie odpowiedzi MailHoga i wewnątrz Content; w razie braku pełnego MIME pobierana jest treść konkretnej wiadomości. Numer zamówienia w PDF wiąże dowód z właściwym zamówieniem. Timeout odczytu nie dowodzi, że aplikacja nie wysłała poczty.

Przy raporcie z potwierdzonym zapisem i migawką MailHoga jest przycisk **Sprawdź e-mail ponownie**. Wyłącznie odczytuje istniejącą pocztę i zapisuje osobny raport; nie tworzy koszyka, nie ponawia zapisu zamówienia i nie wysyła nowej wiadomości. Historyczny wynik pozostaje zachowany. Dla pierwotnego raportu #30001628 nie utrwalono listy ID migawki — raport powtórzenia jawnie wskazuje to ograniczenie i sprawdza odbiorcę, czas oraz unikalny numer zamówienia w PDF.

Raport zawiera sekcję **Dokumenty wykorzystane jako dowody** z linkiem do pobranego PDF. Nie kopiuje całej korespondencji do tabeli wyników. Odczyt tekstu wymaga pypdf; interpreter można wskazać zmienną HURT_PDF_PYTHON (domyślnie środowisko Python aplikacji).

Uruchomienie spoza panelu:

```powershell
npm.cmd run descriptions:web
npm.cmd run descriptions:documents
npm.cmd run descriptions:mail -- descriptions-2026-10-20T06-53-44-114Z-b6b4f919
```

Drugie polecenie zapisuje **nowe** zamówienie. Trzecie odczytuje pocztę istniejącego zamówienia z podanego raportu.

Potwierdzone wyniki z 20.10.2026:

- Widoki WWW: `descriptions-2026-10-20T06-47-44-167Z-fc2f2968` — 10 PASS, 7 SKIP, brak FAIL; cały zakres jest INCOMPLETE.
- Zamówienie #30001628: `descriptions-2026-10-20T06-53-44-114Z-b6b4f919` — nazwy w koszyku, po zapisie i w PDF poprawne; pierwotny odczyt maila zakończył się timeoutem.
- Ponowny odczyt tej samej poczty: `descriptions-2026-10-20T07-03-58-105Z-2af280e5` — PASS; załącznik zawiera #30001628 i nazwę „test WHOLESALE”. Nie utworzono kolejnego zamówienia.

Uzupełnione kontrole, ich rzeczywiste raporty oraz pozostały zakres #33388 opisuje następna sekcja. Wyniki API dotyczące variantName pozostają osobnymi niezgodnościami.

### Uzupełnione kontrole opisów — 20.10.2026

Dodatkowe karty w kategorii **Produkty** i przyciski przy scenariuszach:

- **Nowy produkt i tłumaczenia** (`npm.cmd run descriptions:new-product`, DESC-010): tworzy jedną ukrytą, nieaktywną książkę QA z poprawnymi wymaganymi atrybutami. Potwierdza puste pola i zero rekordów kanałowych; następnie dodaje wszystkie cztery pola WHOLESALE/EMPIK, odczytuje CMS i porównuje każdy zapis w bazie. Produkt pozostaje jako QA; nie jest publikowany ani eksportowany do EMPIK. Przed POST powstaje creation-intent.json z kodem. Po błędzie nie ponawiaj POST tego samego kodu bez odczytu CMS. Rzeczywisty przebieg: `descriptions-2026-10-20T08-03-32-948Z-fdc1cc88`, 4 PASS, produkt 10216.
- **Aplikacja i oferta — opisy koszyka** (`npm.cmd run descriptions:retail-cart`, DESC-021/022/023/027): dwa oddzielne koszyki i sesje RETAIL. Matlandia 129: główna nazwa, 1 dostęp nauczycielski i 11 uczniowskich. Oferta 7: po 2 sztuki A/B i dokładne główne nazwy w wygenerowanym opisie. Automat czeka na inicjalizację i odpowiedzi przeliczeń konfiguratora, a potem przechodzi do /koszyk. Nie finalizuje zamówień. Rzeczywisty przebieg: `descriptions-2026-10-20T08-10-15-175Z-487849e9`, 2 PASS.
- **Powiadomienie o dostępności** (`npm.cmd run descriptions:stock`, zakres częściowy DESC-029/025): nowy, odizolowany produkt QA stock, różne nazwy RETAIL/WHOLESALE, brak wcześniejszych subskrypcji i migawka poczty. Tymczasowo udostępnia stronę RETAIL przy zapasie 0, zapisuje własny adres z konta podstawowego, potwierdza w bazie dokładnie jednego własnego odbiorcę, zmienia zapas na 1 i szuka nowej wiadomości z główną nazwą. Na końcu przywraca stan, kanały i ukrycie. Nie zmienia zapasów wspólnych produktów. Dziennik `.auth/description-stock-restore.json` blokuje kolejne uruchomienie po niedokończonym teście; przywracanie: `npm.cmd run descriptions:stock:restore`. Nie usuwaj tego dziennika ręcznie. To kontrola powrotu dostępności; wywołanie OutOfStockSubscriber przy braku towaru wymaga osobnego potwierdzenia.

Zestaw **Oferta i widoki RETAIL** sprawdza teraz także widoczną sekcję zwykłego produktu, formularz wyszukiwarki dla Matlandii i dwie kolejne strony listy (10 + 10, bez duplikatów). Wynik: `descriptions-2026-10-20T08-10-50-576Z-4d7bb556`, 13 PASS, 7 SKIP. Produkty A/B są wzorcem stron i oferty; bez potwierdzenia ich przypisania do katalogu GWO nie wymagamy ich w wynikach wyszukiwania. MailHog ma osobne testy i nie jest warunkiem działania stron WWW.

Raporty opisów zawierają teraz sekcję **Pominięte w tym przebiegu — gdzie sprawdzić dalej?**. Mapa pokazuje właściwy zestaw, ograniczenia i osobny dowód wykonania. Korzysta z aktualnego katalogu scenariuszy; nie zmienia historycznych wyników raportu. HTML można odświeżyć bez ponownego wykonywania zapisów. Dowody API, CMS, WWW, koszyków, PDF i poczty pozostają osobnymi przebiegami.

Nadal oddzielnie pozostają: zapis i podsumowanie Order RETAIL, pozostałe warianty aplikacji, dokumenty i e-maile innych kanałów, faktury, pełny generator URL, właściwy OutOfStockSubscriber i środowisko OfferUpdater EMPIK. Brak variantName w API to istniejąca niezgodność DESC-017; nowe kontrole jej nie usuwają.

Powiadomienie o powrocie dostępności — rzeczywisty przebieg `descriptions-2026-10-20T08-17-48-824Z-ec91401a`: **5 PASS** (przygotowanie, jedyna własna subskrypcja, stan 0→1, treść nowego e-maila, przywrócenie i ukrycie QA). Dziennik został zamknięty po odczycie zgodnego stanu. Migawka obejmuje ostatnie 50 ID i czas sprzed utworzenia unikalnego produktu; starsze wiadomości wyklucza czas. Dopasowanie wymaga dokładnego odbiorcy oraz unikalnej nazwy próby. Czytnik dekoduje pełny MIME po ID, zamiast wymagać dosłownej polskiej nazwy w surowym kodowaniu wiadomości.

### Zestaw zbiorczy opisów kanałowych (#33388)

W panelu **Produkty → Opisy kanałowe — wszystkie moduły** dostępne są dwa przyciski:

- **Zbiorczy bez zapisu zamówienia**: API, zapis i walidacje CMS z przywróceniem, formularze i widoki RETAIL, utworzenie ukrytego produktu QA z kontrolą bazy, osobne koszyki aplikacji i oferty oraz powiadomienie o dostępności nowego produktu QA.
- **Zbiorczy z zamówieniem, PDF i e-mailem**: powyższe oraz jedno nowe zamówienie WHOLESALE i odczyt jego PDF oraz nowego potwierdzenia e-mail. Nie obejmuje faktur ani dokumentów wszystkich kanałów.

Oba warianty pozostawiają ukryte produkty QA i koszyki na DEV oraz wysyłają testowe powiadomienie o dostępności. Wariant bez zapisu zamówienia nie jest testem tylko do odczytu. Korzystają z podstawowego konta i dotychczasowych konfiguracji modułów; nie wymagają ponownego wpisywania danych użytkownika.

Uruchomienie z terminala: `npm run descriptions:all` lub `npm run descriptions:all:complete`.

Raport ma osobną tabelę **Sześć kontroli przekazanych z CMS i frontendu RETAIL**: DESC-010, 022, 023, 024, 025 i 029. Pokazuje wynik kontroli modułu docelowego, liczniki i link do kroków oraz dowodów. Samo przekazanie zakresu nie daje PASS; błąd lub pominięcie części kontroli pozostaje widoczne.

Można jawnie dołączyć odsyłacz do wcześniejszej próby: `npm run descriptions:all -- --evidence=IDENTYFIKATOR_RAPORTU`. Sekcja **Wcześniejsze potwierdzenia — osobne próby** pokazuje datę, zakres i wyniki źródła. Nie dodaje historycznych PASS do bieżących liczników i nie zmienia bieżących SKIP/FAIL. Nie zapisuje ponownie zamówienia. Raport źródłowy musi dotyczyć opisów i tego samego środowiska.

Przebieg 20.10.2026: [66 PASS, 6 FAIL, 2 SKIP](http://127.0.0.1:18767/reports/descriptions-2026-10-20T10-30-53-284Z-755bec99/raport.html). DESC-010: 4 PASS, DESC-022/023: po 1 PASS, DESC-029: 5 PASS z potwierdzonym przywróceniem. Dołączono osobne wcześniejsze potwierdzenie PDF/e-mail RETAIL #30001631, bez ponownego zapisu zamówienia. Sześć FAIL dotyczy brakującego `variantName` w API; SKIP dotyczą Empik bez środowiska i wyłączonego zapisu zamówienia WHOLESALE. Każdy podraport ma link powrotny do zestawienia.

Raport zbiorczy zawiera wyniki rzeczywiście wykonanych kontroli, powiązania DESC-001–DESC-029, granice pokrycia oraz linki do szczegółowych raportów modułów z tej samej próby. Podraporty znajdują się w folderach raportu zbiorczego. Nie kopiuje historycznych PASS. Przekazania „poza zakresem tego modułu” pokazuje osobno i nie zamienia ich w PASS. Rzeczywiste braki automatyzacji i pominięcia pozostają SKIP. Liczniki modułów mogą obejmować przekazania zakresu, dlatego nie są prostą sumą liczników raportu zbiorczego.

Błędy asercji nie blokują następnych niezależnych modułów. Niedokończone przywracanie danych, błąd uruchomienia modułu lub zatrzymanie przez użytkownika blokują kolejne moduły. Nie ma automatycznego ponawiania zapisu zamówienia. Zestaw nie usuwa znanych błędów API (np. brak `variantName`) i nie oznacza pełnej akceptacji #33388: zapis zamówienia RETAIL, inne warianty aplikacji, wszystkie dokumenty/kanały URL, literalny OutOfStockSubscriber i Empik nadal mają ograniczenia wskazane w raporcie.

Pierwszy zbiorczy przebieg DEV bez finalizacji (20.10.2026): **62 PASS, 6 FAIL, 3 SKIP**. [Raport zbiorczy](http://127.0.0.1:18767/reports/descriptions-2026-10-20T08-30-39-757Z-6bb16f0a/raport.html). Sześć FAIL: brak `variantName` w API dla dwóch produktów i trzech kanałów. SKIP: Empik bez środowiska, pełne opisy/listy kategorii RETAIL, dokumenty wyłączone w tym wariancie. CMS 15 PASS, tworzenie produktu 4 PASS, koszyki RETAIL 2 PASS, dostępność 5 PASS. Oba przywrócenia potwierdzone; brak pozostawionych dzienników zmian. Wariant z nowym zamówieniem jest podłączony i sprawdzony testami kodu; w tej zbiorczej próbie nie uruchamiano jego finalizacji.

### Podgląd przeglądarki podczas testu

Przed uruchomieniem zaznacz **Pokaż przeglądarkę podczas testu** nad opcjami uruchomienia i wybierz **Tempo podglądu**: normalne, 0,25 s lub 0,75 s opóźnienia na akcję przeglądarki. Ustawienie dotyczy nowego przebiegu, również uruchomionego ze scenariusza i zestawu zbiorczego. Panel zapamiętuje je lokalnie w przeglądarce; nie zapisuje do `.env` i nie zmienia ustawień już trwającego testu.

Podgląd obejmuje moduły przeglądarkowe: CMS, RETAIL, koszyki WWW, MailHog, odczyty rabatów i bazy oraz konfigurację GLS/adresów. Testy wywołujące bezpośrednio API nie otwierają witryny sklepu; ich żądania i wyniki pozostają w logu i raporcie. Część zapisów CMS wykonuje się przez HTTP, więc nie pokazuje wpisywania każdego pola. Wybrane tempo opóźnia akcje Playwright, nie wszystkie żądania API/HTTP i nie gwarantuje, że każdy odczyt pozostanie na ekranie przez wskazany czas.

Okno pojawia się, gdy moduł otwiera przeglądarkę, i zamyka po jego zakończeniu. W zestawie zbiorczym kolejne moduły mogą otwierać kolejne okna. Nie zamykaj okna ręcznie ani nie zmieniaj w nim danych w trakcie testu; użyj przycisku **Zatrzymaj test**, aby uruchomić obsługę zatrzymania i przywracania danych.

Dla uruchomień CLI można ustawić na czas procesu `HURT_BROWSER_PREVIEW=true` oraz `HURT_BROWSER_SLOW_MO_MS=250` (dozwolone 0, 250, 750). Domyślnie moduły działają w tle. Logowanie GitLab nadal korzysta z widocznego okna niezależnie od tej opcji.

W trybie podglądu okno pokazuje również **bieżącą kontrolę**, przewija do używanego pola i podświetla je. Po zmianach jest krótka pauza na przeczytanie wartości. Formularze produktu zapisywane przez HTTP pokazują przygotowane wartości w polach, a pasek testu podaje **PRZED / PO** oraz kod odpowiedzi HTTP. Ukryta treść edytora ma czytelny, oznaczony podgląd; nie jest to test obsługi przycisków edytora. Zapis nadal korzysta z tego samego, wcześniej przygotowanego body żądania; prezentacja nie dodaje kliknięcia „Zapisz” ani drugiego POST. Hasła, tokeny i inne pola dostępowe są wyłączone z podglądu zmian.

Czytelne pauzy działają wyłącznie przy włączonym podglądzie, także przy normalnym tempie. Wybrane 0,25/0,75 s dodatkowo spowalnia akcje przeglądarki. Bez podglądu nie instaluje się paska, nie rozwija sekcji i nie wykonuje zmian pól ani tych pauz. Zatrzymanie i przywracanie danych pozostają częścią dotychczasowych testów.

Sprawdzenie prezentacji na lokalnym formularzu (bez danych DEV): `node tests/integration/browser-presentation.mjs`. Próba obejmuje rozwinięcie sekcji, widoczną zmianę tekstu i przełącznika, treść ukrytego edytora, zachowanie oryginalnego body i pominięcie sekretów.

### Skrócenie przygotowania opisów kanałowych

Moduł CMS używa jednego świeżo odczytanego formularza zarówno do kontroli obcych zmian, jak i przygotowania najbliższego zapisu. Formularz wraz z aktualnymi polami i CSRF można wykorzystać do zapisu tylko raz; kolejna operacja wymaga nowego odczytu. Jeżeli produkt jest już otwarty po przygotowaniu sesji, pierwszy odczyt nie odświeża ponownie strony.

Przywrócenie wzorca przed kolejnym przypadkiem nie wysyła POST, jeśli ostatni potwierdzony stan już jest tym wzorcem. W poprawnym pełnym przebiegu usuwa to dwa identyczne zapisy przygotowawcze. Właściwe próby zapisów, walidacji i fallbacku nadal są wykonywane. Raport CMS podaje liczbę pominiętych identycznych zapisów.

Moduł odczytu RETAIL wykorzystuje odczyt produktu QA z DESC-001 również do sprawdzenia jego nazwy i slugu w DESC-020. Raport wskazuje ponowne wykorzystanie tego samego źródła. Dotyczy to tylko tego samego modułu bez zapisów; dane nie są współdzielone między modułami ani kolejnymi przebiegami.

Zachowano świeżą kontrolę stanu przed rzeczywistym zapisem, odczyt po operacji, blokadę przy obcej zmianie, dziennik zmian, weryfikację przywrócenia i osobne sesje koszyków. Przygotowania związane z nową wiadomością i zapasami również pozostają odrębne.

### Rozszerzenie CMS i frontendu RETAIL — 20.10.2026

Zestaw descriptions-web porównuje cały tekst głównego opisu A/B z treścią karty produktu: zarówno niepusty opis A, jak i pusty B. Dodatkowo porównuje niepusty pełny opis Matlandii 129. Normalizuje wyłącznie HTML do tekstu i odstępy; nie ocenia wizualnego formatowania. Na liście wybiera rzeczywisty filtr Matematyka, zatwierdza formularz, sprawdza zachowanie filtra w URL i odczytuje kolejne strony do końca (maksymalnie 8; przekroczenie limitu jest FAIL). Dla Matlandii wymaga dokładnej głównej nazwy, slugu i całego niepustego krótkiego opisu CMS. Nie wymaga A/B w katalogu bez potwierdzonej taksonomii. Pozostałe produkty kategorii nie mają niezależnej kontroli nazw CMS. W raporcie są porównania tekstów i odczytane strony list.

Uruchomienie: przycisk **CMS i frontend RETAIL** lub npm.cmd run descriptions:web. Konfiguracja category jest w config/description-web.local.json (wzór w example.json). Zestaw jest odczytowy, także w wariancie z podglądem. Nie finalizuje zamówień. Podsumowanie, zapis zamówienia RETAIL, PDF i e-mail RETAIL wymagają oddzielnego zestawu; kontrole dokumentów WHOLESALE ich nie zastępują.

Podsumowanie aplikacji RETAIL prezentuje nazwę wybranego wariantu (potwierdzenie użytkownika 20.10.2026). Dla Matlandii wzorzec application.summaryName to „Dostęp nauczycielski 2 lata”. Sam brak nazwy Matlandia. Klasa 4 w tej kolumnie nie jest błędem. Osobny przycisk „Nazwa w podsumowaniu RETAIL” wymaga RETAIL_LOGIN_EMAIL i RETAIL_LOGIN_PASSWORD w .env; nie finalizuje. Ten nowy automat wymaga jeszcze weryfikacji całej ścieżki logowania na DEV z poprawnymi danymi; kontrolę konkretnego widoku wykonano w sesji wspomaganej.

**Zapis RETAIL + PDF i e-mail** to osobny automat (descriptions-retail-documents): jeden koszyk Matlandii, login Moje GWO, wariant w podsumowaniu, jedna finalizacja, odczyt Order w CMS, tekst potwierdzenia PDF i załącznika nowej wiadomości. Nie wykonuje przelewu i nie ponawia finalizacji po timeout lub wylogowaniu. Wymaga uzupełnienia RETAIL_LOGIN_PASSWORD w .env. Zapis CMS ma zawierać także główną nazwę aplikacji i 11 dostępów uczniowskich; PDF porównujemy z nazwą wariantu z podsumowania. Poczta jest identyfikowana przez dokładnego odbiorcę, czas sprzed operacji oraz numer nowego zamówienia w załączniku — nie deklarujemy migawki wszystkich wcześniejszych ID wiadomości. Pełny automatyczny przebieg wymaga weryfikacji po uzupełnieniu oddzielnego hasła; wykonano niezależną próbę wspomaganą #30001631.

Próba wspomagana RETAIL: [raport #30001631 — 4 PASS](http://127.0.0.1:18767/reports/descriptions-2026-10-20T10-02-46-041Z-f35d6c21/raport.html). Potwierdzono wariant w podsumowaniu, zapis CMS z główną nazwą aplikacji i 11 dostępami, PDF oraz nowy e-mail. PDF z CMS i załącznik mają identyczny tekst. Odczytowy moduł CMS i frontend RETAIL: [17 PASS, 0 FAIL, 6 SKIP](http://127.0.0.1:18767/reports/descriptions-2026-10-20T09-49-29-061Z-4198cb30/raport.html). Sześć pominięć dotyczy innych modułów. Zapisane zamówienie pozostaje na DEV; nie wykonano płatności. Pierwszą próbę przerwało równoczesne logowanie — do testów procesu używaj konta bez równoległych sesji.

Automat podsumowania RETAIL: [PASS, własna pozycja usunięta](http://127.0.0.1:18767/reports/descriptions-2026-10-20T10-18-08-426Z-12547867/raport.html). Loguje konto przed utworzeniem QA i wymaga pustego koszyka. Nie korzysta z poprzedniej sesji zakupowej z .auth; używa osobnych danych Moje GWO. Po próbie bez zapisu usuwa jedynie zapamiętaną własną pozycję i potwierdza pusty koszyk. Rodzaj zamówienia zapisuje aktualnym formularzem HTTP i bezpośrednio otwiera etap danych: ten zestaw porównuje nazwy, nie sprawdza działania przycisku przejścia z koszyka. Zapis i dokumenty potwierdzono oddzielną próbą wspomaganą #30001631; pełnej automatycznej finalizacji nie powtarzano, aby nie tworzyć drugiego zamówienia.

## Debugger testów

W menu wybierz **Debugger testów**. Na start dostępne są pojedyncze przypadki `HURT-BUG-37162-01`–`06`: tworzenie koszyka, dodawanie produktów i niezależny odczyt zapisu. Logowanie jest automatyczne; kolejne żądania wymagają przycisku **Następny krok** lub **F10**. Można włączyć kontynuację automatyczną, zatrzymać się przed następnym krokiem i przerwać test. Nie ma okna przeglądarki, ponieważ te przypadki korzystają wyłącznie z API.

Przypadek 01 tworzy trzy koszyki; pozostałe po jednym. Testy nie finalizują zamówienia. Koszyki pozostają na DEV, zgodnie z dotychczasowym działaniem tych przypadków. Produkty e-bookowe ze zgłoszenia mogą być niedopuszczone w hurtowni — odpowiedź walidacyjna nie potwierdza ich dostępności w sprzedaży. Wynik całego przypadku oraz błędy kontroli są pokazane w podsumowaniu i raporcie. Hasła, tokeny i dane sesji są maskowane w podglądzie.

Raport i kroki JSON można pobrać po zakończeniu. Zwykłe uruchomienia nie czekają na debugger. Inne przypadki wymagają jeszcze przygotowania do tego trybu. `npm run test:debugger` sprawdza mechanizm na lokalnych odpowiedziach próbnych, bez testów na DEV.
