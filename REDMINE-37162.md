# Redmine #37162 — ShipmentInterface: Got NULL

Zgłoszenie: https://redmine.gwo.pl/issues/37162. Źródło zakresu: opis i payload na zrzucie ekranu użytkownika. Zgłoszenie jest na zrzucie zamknięte; nie oznacza to wykonania poniższych testów.

## Uruchomienie

Panel Hurtowni: karta **Dodawanie produktów — błąd 500**, przycisk **Sprawdź #37162**. Jeżeli serwer panelu działał przed dodaniem scenariuszy, należy go ponownie uruchomić dopiero po zakończeniu aktywnych testów. Alternatywnie `Testuj-Redmine-37162-dev.cmd` (konfiguracja DEV, konto 1).

## Scenariusze

| ID | Zakres |
|---|---|
| HURT-BUG-37162-01 | Oryginalny payload m-F8P:9, D414:5; trzy osobne próby na nowych koszykach |
| HURT-BUG-37162-02 | Tylko m-F8P:9 |
| HURT-BUG-37162-03 | Tylko D414:5 |
| HURT-BUG-37162-04 | Jeden payload, kolejność D414:5, m-F8P:9 |
| HURT-BUG-37162-05 | Dwa żądania: najpierw m-F8P:9, potem D414:5 |
| HURT-BUG-37162-06 | Dwa żądania w odwrotnej kolejności |

Łącznie 8 koszyków i 10 prób dodawania. Każda próba wymaga poprawnego HTTP, braku błędu ShipmentInterface oraz zgodności produktów i ilości w niezależnym GET właściwego koszyka. Pojedynczy błąd oznacza FAIL całego zestawu; brak automatycznych ponowień. Błędy danych (np. brak produktu lub dostępności) również dają FAIL i wymagają analizy raportu — nie potwierdzają automatycznie tej samej przyczyny co zgłoszenie.

Raport HTML i JSON zawiera wynik każdej próby, wejście, HTTP, identyfikator koszyka i odczytane produkty. Dane dostępowe i tokeny są maskowane. Raport zapisuje się w `raporty-api` i może zostać przypięty do karty #37162 w Centrum testów po odświeżeniu.

Testy tworzą rzeczywiste koszyki i je pozostawiają. Nie wybierają płatności ani dostawy, nie finalizują zamówień, nie zmieniają CMS. Skończona liczba prób nie dowodzi wyeliminowania nieregularnego problemu we wszystkich warunkach. Nie obejmują innych kont, kanałów i konfiguracji dostaw.

Stan: kod i kontrole na atrapach API gotowe; nie wykonano testów na DEV/TEST.
