# Redmine #36618 — reprodukcja zmiany dostawy w Postmanie

Importuj `HURTOWNIA - Redmine 36618 - zmiana dostawy.postman_collection.json`.
Kolekcja obejmuje wyłącznie dwa błędy T06/T07, nie cały zestaw T01–T16.
Każdy folder tworzy osobny koszyk na DEV. Nie zatwierdza zamówień, nie zmienia CMS ani książki adresowej.

## Uruchomienie

1. Uzupełnij lokalnie zmienne `email`, `api_password` (hasło API hurtownika), `tests_token` oraz `product_variant_140g` (kod wariantu, nie numeryczne ID). Możesz użyć środowiska Postmana; jego wartości mają pierwszeństwo przed zmiennymi kolekcji. Dane uwierzytelniające w dostarczonym pliku są puste.
2. Zapewnij sesję bramki GitLab w Postmanie, jeżeli środowisko jej wymaga. Zalogowanie w innej przeglądarce nie gwarantuje dostępu Postmana. Przekierowania są wyłączone; HTML lub błąd logowania przerywa scenariusz.
3. Przygotuj aktywną, dostępną w WHOLESALE książkę fizyczną: **140 g, VAT 5%, bez Adamady, możliwość dodania 58 sztuk**. Wzorce cen dostaw i dopłat opisano niżej — potwierdź je niezależnie w CMS. Ceny produktu nie są częścią tych porównań.
4. Uruchom całą kolekcję w Collection Runner, jedną iteracją, bez przerywania na pierwszym niezaliczonym teście. Można uruchomić jeden folder, zawsze od jego logowania. Nie uruchamiaj kilku Runnerów równolegle.
5. Otwórz **ostatni GET** w każdym folderze: Test Results i Visualize pokażą wartości oczekiwane/rzeczywiste. Postman Console pokazuje ID nowych koszyków i kwoty przed/po zmianie; skrypty nie wypisują haseł i tokenów. Do zgłoszenia dołącz wynik Runnera i odpowiedzi końcowych GET po usunięciu danych sesji/osobowych.

Własny produkt automatu: **ID 10233**, kod wariantu `qa-36618-00f95a52-bfeb-461d-ae73-0c8058da5a00-140g`. Po automatycznych testach jest wyłączony. Aby go użyć, trzeba przygotować jego dostępność na DEV i potem przywrócić wcześniejszy stan. Kolekcja sama go nie włącza; alternatywnie wskaż inny aktywny wariant spełniający warunki.

## Niezależne wzorce z konfiguracji CMS

Płatność w obu przypadkach: `cash_on_delivery`. Kwoty API są **w groszach**.

| Parametr | GLS (`gls_wholesale`) | Poczta Polska (`poczta_polska`) |
|---|---|---|
| Kalkulator | paczka do 8000 g | brak kalkulatora paczek |
| Liczba sztuk / waga dla porównania | 58 × 140 g = 8120 g | T06: 58 szt.; początek T07: 1 szt. |
| Cena bazowa | 2 paczki × 1000 gr netto = 2000 netto, 2100 brutto | 1000 gr brutto |
| Dopłata do płatności | 1500 gr brutto | 1000 gr brutto |
| Oczekiwany `shippingTotal` | **3600** | **2000** |
| Oczekiwany `shippingTotalNet` | **3429** | **1905** |
| Oczekiwany `shipmentPackageQuantity` | **2** | brak dodatniej wartości (0/null/brak pola) |

Wzorce pochodzą z odczytanej konfiguracji CMS użytej w raporcie. VAT dostawy 5%. Jeśli konfiguracja ulegnie zmianie, najpierw potwierdź nowe wartości i zaktualizuj asercje w kolekcji. Nie zastępuj wzorców błędną odpowiedzią API. Stan początkowy ma osobne asercje; jego niezgodność zatrzymuje folder przed oceną zmiany dostawy.

## Dokładne sekwencje i dowód błędu

**T06:** nowy koszyk → dodanie produktu → ustawienie 58 szt. → wybór płatności → zapis GLS → GET i kontrola stanu początkowego → ponowny zapis 58 szt. i płatności → zapis Poczty Polskiej → końcowy GET.

Oczekiwano Poczty Polskiej, braku dodatniej liczby paczek oraz kosztów **2000/1905 gr**. Historyczny koszyk **6972**: metoda zmieniona poprawnie i 0 paczek, ale koszty pozostały **3600/3429 gr**.

**T07:** nowy koszyk → dodanie produktu → zapis 1 szt. → wybór płatności → zapis Poczty Polskiej → GET i kontrola stanu początkowego → zmiana na 58 szt. → ponowny wybór płatności → zapis GLS → końcowy GET.

Oczekiwano GLS, **2 paczek** i kosztów **3600/3429 gr**. Historyczny koszyk **6973**: metoda zmieniona poprawnie, ale pozostało **0 paczek** i koszty **2000/1905 gr**.

Zachowano kolejność oryginalnego automatu, łącznie z ponownym zapisem ilości i płatności przed wyborem dostawy. Kolekcja nie rozstrzyga, która operacja wewnątrz backendu pomija przeliczenie — pokazuje odtwarzalny przepływ i odpowiedź końcową.

Raport źródłowy: http://127.0.0.1:18767/reports/redmine-36618-1792583373530-f4328629/raport.html

Adres `127.0.0.1` działa tylko na komputerze z panelem. Developerowi przekaż plik raportu/eksport wyników, jeśli nie ma dostępu do tej instancji.

Każde pole kosztu i liczba paczek ma osobną asercję: obecny błąd może dać **2 niezaliczone asercje T06 oraz 3 T07**. Raport panelu liczy jeden FAIL na scenariusz, dlatego pokazuje 2 FAIL. Po poprawce wszystkie asercje mają przejść.

Kolekcję i skrypty sprawdzono lokalnie na symulacji poprawnych i błędnych odpowiedzi, w tym blokady po złym stanie początkowym. Nie wykonywano tej kolekcji ponownie przeciwko DEV. Zapisane wyżej obserwacje pochodzą z podanego raportu rzeczywistego wykonania.
