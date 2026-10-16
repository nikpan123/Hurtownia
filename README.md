# Hurtownia — testy API i lokalny panel testowy

Projekt do testowania API księgarni hurtowej GWO bez docelowego frontendu. Zawiera scenariusze koszyka i zamówienia, testy katalogu, kontrole cen i tłumaczeń produktów oraz panel w przeglądarce z raportami i formularzami testowymi.

Testy API wykonuje **Node.js i `fetch`**. Playwright służy do logowania przez bramkę GitLab i zapisania lokalnej sesji. Scenariusze zakupowe nie wymagają gotowego interfejsu sklepu. Panel zawiera własny, uproszczony formularz zamówienia; jego automat wybiera opcje w tej karcie przeglądarki.

## Spis treści

- [Wymagania i środowiska](#wymagania-i-środowiska)
- [Pierwsze uruchomienie po sklonowaniu](#pierwsze-uruchomienie-po-sklonowaniu)
- [Dane dostępowe i logowanie](#dane-dostępowe-i-logowanie)
- [Panel i dostępne scenariusze](#panel-i-dostępne-scenariusze)
- [Polecenia i pliki startowe](#polecenia-i-pliki-startowe)
- [Konfiguracja testów](#konfiguracja-testów)
- [Kontrole cen i rabatów](#kontrole-cen-i-rabatów)
- [Tłumaczenia produktów per kanał](#tłumaczenia-produktów-per-kanał)
- [Tworzenie produktu przez API](#tworzenie-produktu-przez-api)
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
| `BROWSER_CHANNEL` | Przeglądarka logowania, domyślnie `msedge` |
| `HURT_TEST_EMAIL`, `HURT_TEST_API_PASSWORD`, `HURT_TEST_TESTS_TOKEN`, `HURT_TEST_GATEWAY_COOKIE` | Dane przyszłego środowiska test; nie odblokowują go |

Logowanie GitLab zapisuje sesję w `.auth/dev.json` (lub ścieżce `sessionFile` z konfiguracji). Jeśli podano `HURT_GATEWAY_COOKIE`, ma on pierwszeństwo przed plikiem sesji. Nieaktualny ręczny cookie może więc blokować dostęp mimo ponownego logowania w przeglądarce.

Logowanie w CMS nie przekazuje automatycznie uprawnień do JSON admin API. Odpowiedź `403` po udanym logowaniu administratora oznacza odmowę wykonania operacji, a nie konieczność ponownego wpisania hasła hurtownika.

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

`paymentQuoteTotalBasis: "net"` porównuje `orderItemTotal` oferty płatności z sumą `totalNetSalesAfterDiscount` produktów, bez dostawy. To konfigurowana interpretacja kontraktu. Ustawienie `"gross"` porównuje z `itemsTotal`. Brak ustalenia podstawy daje pominiętą kontrolę zamiast zgadywania.

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

## Tworzenie produktu przez API

Mini formularz ma pola: kod produktu, kod wariantu, nazwa, slug, kanał cennika, cena, oryginalna cena i minimum price. Kody muszą zaczynać się od `qa-`. Przycisk generowania nadaje unikalne kody, a przed wysłaniem trzeba wyświetlić i sprawdzić JSON.

Przebieg obejmuje tylko:

1. Logowanie administratora.
2. `POST /admin/products` z kodem i tłumaczeniem `pl_PL` nazwy/slugu.
3. Po potwierdzeniu produktu: `POST /admin/product-variants` z kodem wariantu, IRI produktu i cennikiem.
4. Porównanie kodów i cen zwróconych przez API, zapis osobnego raportu.

Nie uruchamia testów ogólnego katalogu. Jeśli pierwszy POST zostanie odrzucony, wariant nie jest tworzony. Jeśli produkt powstał, ale zapis wariantu się nie udał, raport zachowuje kod i stan częściowego utworzenia — program nie usuwa rekordu i nie powtarza sam tworzenia.

Udokumentowany kontrakt tworzenia **nie udostępnia** zapisu opisów, tłumaczeń kanałowych, typu produktu ani aktywacji/przypisania kanałów produktu. Sam cennik wariantu nie gwarantuje widoczności w sklepie. Nieobsługiwane pola nie są wysyłane ani po cichu ignorowane. Obserwowana odmowa `403 Access Denied` pozostaje kwestią uprawnień/konfiguracji admin API; formularz jej nie omija i nie przełącza zapisu na CMS.

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

W przekazanym opisie zadania występują `/academy/closed-courses` i `/academy/paid-courses`. Ten projekt **nie wykonuje jeszcze ich testów**: brakuje przygotowanych szkoleń i niezależnych oczekiwań. Integracja OfferUpdater Empik również nie jest wywoływana.

Panel CMS `/login`, formularze `/products/new/simple/BOOK`, `/products/{id}/edit` i ustawienia hurtownika są odrębnym interfejsem administracyjnym. Formularz „Nowy produkt API” nie wysyła do nich danych i nie obchodzi uprawnień admin API.

## Endpointy lokalnego panelu

Te ścieżki należą do `http://127.0.0.1:18767`, nie do Syliusa.

| Metoda | Ścieżka | Zastosowanie |
| --- | --- | --- |
| GET | `/` | Interfejs panelu |
| GET | `/app.js`, `/wizard.js`, `/product-form.js`, `/style.css` | Zasoby panelu |
| GET | `/api/state` | Stan danych, przebiegów i raportów; bez haseł/tokenów |
| POST | `/api/run` | Uruchomienie dozwolonego zestawu: `cart`, `order`, `wizard`, `catalog`, `product-create`, `rounding`, `descriptions`, `login` |
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

Pobranie poprawnego pliku PDF nie potwierdza jego treści ani doręczenia e-maila. Projekt nie ma integracji z bazą transferową, skrzynką odbiorczą ani ekstraktorem zawartości PDF. Nie oznacza tych kontroli jako wykonanych.

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
