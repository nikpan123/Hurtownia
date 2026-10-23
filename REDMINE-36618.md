# #36618 — automatyczne testy paczek

## Uruchomienie w panelu

Wybierz **Uruchom testy → Regresja i dostawa → #36618 — liczba paczek i koszt dostawy**.

- **Bez zapisu** tworzy i zmienia koszyki. Kontrole wymagające zatwierdzenia mają SKIP.
- **Z zapisem** wykonuje pełny zakres, składa do 8 zamówień QA na dev, porównuje
  KWys z bazą oraz panel CMS i PDF. Może wysłać testowe e-maile i uruchomić transfer.
  Porównanie bazy i dokumentów jest w tym wariancie włączone automatycznie.

W **Debuggerze testów** wyszukaj `36618`. Dostępne są T01–T16 osobno,
cały zestaw bez zapisu i pełny zestaw z zapisem, bazą i PDF.
Zapisy CMS i każde żądanie API czekają na **Następny krok**. Logowanie,
odczyty konfiguracji CMS oraz przywracanie ustawień są automatyczne.

## Automatyczne przygotowanie

Nie trzeba ręcznie wpisywać kodów produktów, cen dostawy ani rabatów.
Wymagane są istniejące dane konta API i administratora CMS w `.env`,
ważna sesja GitLab i dostęp do CMS oraz phpMyAdmin na dev.

1. Automat tworzy lub ponownie wykorzystuje dwie własne książki QA: 140 g i 1 g.
   Na czas testu udostępnia je tylko w WHOLESALE, poza listami, w cenie 21,00 zł brutto (20,00 zł netto przy VAT 5%). Rabaty 25%, 50% i 75% dają wtedy dokładne kwoty; po próbie przywraca wcześniejsze ceny.
2. Zwykłe przypadki używają książki 140 g. Dokładne granice są osiągane przez
   połączenie obu książek, np. 57 × 140 g + 20 × 1 g = 8000 g.
3. Odczytuje kalkulator GLS, VAT książek, stawki dostaw i dopłaty płatności z CMS.
   Osobno odczytuje rabaty skonfigurowanego hurtownika w CMS. API służy do
   ustalenia dostępności metod, a nie do wyznaczania oczekiwanych cen.
4. Na czas próby udostępnia istniejący odbiór własny w WHOLESALE i usuwa wymaganie
   kategorii wysyłkowej. Zmienia tylko te dwa pola, z dziennikiem przed zapisem.
5. Po próbie przywraca dokładny stan odbioru własnego i wyłącza książki QA.
   Kody handlowe QA mają najwyżej 20 znaków, zgodnie z ograniczeniem bazy transferowej. Rekordy książek pozostają do ponownego użycia. Konflikt z cudzą zmianą daje FAIL
   i zachowuje dziennik, zamiast nadpisywać obce dane.

Kalkulator `weight_range_shipping` w tym środowisku obsługuje paczki i ich ceny.
Jeśli odczytane formularze nie mają konfiguracji palet, T16 jest oznaczony
**NIE DOTYCZY**, z opisem źródła. Nie jest zaliczany jako wykonany test palet.

## Zakres T01–T16

| ID | Kontrola |
| --- | --- |
| T01 | Jedna paczka i koszt netto/brutto |
| T02 | Dwie i trzy paczki |
| T03 | Spójność podsumowania i zatwierdzenia |
| T04 | Książka 140 g, płatność terminowa, odbiór własny: retest 0 → 3 |
| T05 | Dostawy bez kalkulatora dla lekkiego i ciężkiego zamówienia |
| T06 | Zmiana kalkulator → brak kalkulatora |
| T07 | Zmiana brak kalkulatora → kalkulator |
| T08 | Zwiększenie i zmniejszenie ilości |
| T09 | Dokładne granice wagowe ±1 g |
| T10 | Jedna pozycja KWys i jej wartość w bazie |
| T11 | Cena jednostkowa KWys i liczba paczek |
| T12 | Trzy odczyty podsumowania i brak duplikatu KWys po zapisie |
| T13 | Dostępne płatności i niezależne dopłaty CMS |
| T14 | Różne rabaty płatności: zgodność z CMS i niezmienność paczek |
| T15 | API, baza, wyświetlone kwoty panelu CMS i treść PDF |
| T16 | Palety i wysyłka mieszana, jeśli konfiguracja je obsługuje |

T15 sprawdza numer zamówienia, produkty i ilości oraz sumę i koszt dostawy
w panelu CMS. W PDF sprawdza numer, nazwy produktów, liczbę paczek,
koszt dostawy i kwotę do zapłaty. Ilość i koszty netto/brutto KWys są porównywane
z zapisem Sylius oraz bazy transferowej. Kontrola nie obejmuje faktury.

## Uruchomienie poleceniem

```powershell
npm run redmine:36618 -- --plan
npm run redmine:36618
npm run redmine:36618 -- --complete
```

Raporty JSON/HTML i pobrane PDF trafiają do `raporty-api/redmine-36618-*`.
Każdy nowy koszyk ma osobny token. `complete` nie jest ponawiane po błędzie lub
utracie odpowiedzi. Numer zamówienia potwierdza zapis; jeśli API zwraca `state`,
nie może on nadal mieć wartości `cart`.

## Przywracanie po przerwaniu

Po zakończeniu zatrzymanego procesu:

```powershell
npm run redmine:36618:restore
```

Rejestr produktów: `.auth/package-products-36618.json`.
Dziennik odbioru własnego: `.auth/package-pickup-36618.json`.
Nie kasuj tych plików, aby ukryć błąd. Niepewny POST utworzenia książki nie jest
ponawiany; następny przebieg szuka dokładnego kodu w bazie i potwierdza jego ID
oraz dane w CMS. Przy braku potwierdzenia zatrzymuje przygotowanie.

## Ręczne wzorce i testy lokalne

Opcjonalny `config/redmine-36618.local.json` nadpisuje ustawienia przykładowe.
`autoProducts: false` pozostawia własne produkty, a `autoReferences: false`
wyłącza odczyt i przygotowanie wzorców CMS. W tym trybie trzeba samodzielnie
podać kalkulator, dopłaty, nonCalculatorMethods, retest140g, paymentVariants
oraz discountVariants. Braki mają SKIP, nie PASS.

```powershell
node tests/redmine-36618.test.mjs
node tests/package-products.test.mjs
node tests/package-references.test.mjs
```

Są to lokalne kontrole automatu na symulowanych odpowiedziach. Ich PASS nie
zastępuje raportu z rzeczywistego wykonania na dev.

## Wynik weryfikacji na dev — 21.10.2026

[Zestawienie końcowe z jawnymi źródłami prób](http://127.0.0.1:18767/reports/redmine-36618-wynik-koncowy-1792583019810/raport.html):
222 PASS, 2 FAIL, 0 SKIP, 1 NIE DOTYCZY.

Retest T04 z płatnością terminową i odbiorem własnym przeszedł także po
zatwierdzeniu (zamówienie 30001636). T10, T11, T12 i T15 zostały ponownie
wykonane z krótkimi kodami handlowymi: 203 PASS, w tym baza, KWys, panel i PDF.
Historyczne błędy adaptera i danych QA pozostają w źródłach; nie zmieniano ich wyników.

Potwierdzone niezgodności API:

- **T06, koszyk 6945:** po przejściu GLS → poczta API zapisuje `poczta_polska`,
  ale pozostawia 36,00 zł brutto / 34,29 zł netto zamiast 20,00 zł / 19,05 zł.
- **T07, koszyk 6946:** po przejściu poczta → GLS API zapisuje `gls_wholesale`,
  ale zwraca 0 paczek zamiast 2 oraz 20,00 zł / 19,05 zł zamiast 36,00 zł / 34,29 zł.

T16 nie dotyczy odczytanych konfiguracji, które nie mają obsługi palet.
Nie oznacza to zaliczenia testu palet. Po obu próbach potwierdzono przywrócenie
odbioru własnego oraz cen, kodów handlowych i ukrycia produktów QA.
