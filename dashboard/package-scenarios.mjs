import {packageCases} from '../api-tests/redmine-36618.mjs';

const saveIds = new Set(['T03','T04','T05','T10','T11','T12','T15','T16']);
const checks = [
  ['Przygotuj zamówienie na jedną paczkę i pobierz podsumowanie.', 'API zwraca jedną paczkę oraz koszt netto i brutto zgodny z kalkulatorem.'],
  ['Zwiększ ilość do dwóch, następnie trzech paczek.', 'Liczba paczek i koszty odpowiadają każdej ilości.'],
  ['Pobierz podsumowanie i zatwierdź niezmienione zamówienie.', 'Liczba paczek i koszty pozostają zgodne przed zapisem i po nim.'],
  ['Dodaj książkę 140 g, wybierz płatność terminową i odbiór własny; odczytaj podsumowanie i zatwierdź.', 'Brak dodatniej liczby paczek na obu etapach; nie występuje zmiana 0 → 3.'],
  ['Dla każdej dostawy bez kalkulatora sprawdź lekkie i ciężkie zamówienie oraz zapis.', 'Brak wyliczonych paczek; koszt odpowiada konfiguracji metody.'],
  ['Zmień dostawę z kalkulatorem na dostawę bez kalkulatora.', 'Poprzednia liczba paczek jest usunięta, a koszt aktualny.'],
  ['Zmień dostawę bez kalkulatora na dostawę z kalkulatorem.', 'API zwraca aktualną liczbę paczek i koszty.'],
  ['Zwiększ i zmniejsz ilość produktu na tym samym koszyku.', 'Liczba paczek i koszt są przeliczane w obu kierunkach.'],
  ['Sprawdź każdy próg dokładnie oraz 1 g poniżej i powyżej.', 'Liczba paczek i koszt odpowiadają włącznym granicom kalkulatora.'],
  ['Zatwierdź zamówienie i porównaj jego zapis z bazą.', 'Jedna pozycja KWys ma właściwą ilość i wartość.'],
  ['Zatwierdź zamówienie na kilka paczek i porównaj KWys z API.', 'Cena jednostkowa razy ilość daje koszt dostawy bez ponownego mnożenia całkowitego kosztu.'],
  ['Odczytaj podsumowanie trzy razy, następnie zatwierdź i porównaj bazę.', 'Odczyty nie zmieniają zamówienia; KWys nie jest powielony.'],
  ['Zmień płatność między co najmniej dwiema dostępnymi metodami.', 'Paczki i koszty są zgodne z niezależnym wzorcem oraz dopłatą płatności.'],
  ['Porównaj koszyk przed i po zmianie rabatu/płatności dla przygotowanej promocji.', 'Rabaty oraz koszty i liczba paczek odpowiadają wzorcom.'],
  ['Zatwierdź zamówienie; porównaj API, bazę, panel i PDF.', 'Dane są spójne; bez adaptera panelu i PDF ta część pozostaje SKIP.'],
  ['Sprawdź wariant paletowy i mieszany zgodnie z potwierdzoną regułą liczenia jednostek.', 'Ilości i koszty są zgodne z niezależnym wzorcem i zapisem KWys.']
];

export const packageScenarioCategory = {id:'redmine-36618', label:'#36618 — paczki i koszt dostawy'};
export const packageScenarioActions = {
  'redmine-36618':{label:'Sprawdź #36618 bez finalizacji', suite:'redmine-36618', note:'Uruchamia cały zestaw T01–T16 na koncie z konfiguracji. Tworzy koszyki; kontrole zapisu mają SKIP.'},
  'redmine-36618-complete':{label:'Sprawdź #36618 także z zapisem', suite:'redmine-36618-complete', note:'Uruchamia cały zestaw i składa do 8 zamówień QA na dev. Może wysłać e-maile i uruchomić transfer. Automatycznie porównuje bazę, panel CMS i PDF; na końcu przywraca odbiór własny i wyłącza produkty QA.'}
};
export const packageScenarioCases = packageCases.map((sample, index) => ({
  id:`HURT-36618-${sample.id}`, title:sample.name, category:packageScenarioCategory.id,
  priority:index < 11 ? 'P1' : 'P2', coverage:'automated',
  effect:saveIds.has(sample.id) ? 'order' : 'cart',
  requirement:`#36618 / ${sample.id} — ${sample.name}`,
  conditions:['Dostęp do API dev i konto hurtowe oraz sesja administratora CMS do przygotowania książek QA.', 'Dostęp do odczytu CMS; dla pełnego wariantu także do phpMyAdmin.'],
  data:'Automat przygotowuje książki QA 140 g i 1 g, odczytuje kalkulator, dopłaty i rabaty z CMS oraz tymczasowo udostępnia odbiór własny. Po próbie przywraca ustawienia. Instrukcja: Dokumentacja testów → #36618.',
  steps:[checks[index][0], 'Otwórz raport bieżącego wykonania i sprawdź wynik odpowiedniego T01–T16.'], expected:[checks[index][1]],
  automation:{runner:`runPackageRegression / ${sample.id}`, actions:['redmine-36618', ...(saveIds.has(sample.id) ? ['redmine-36618-complete'] : [])],
    sources:['api-tests/redmine-36618.mjs','tests/redmine-36618.test.mjs','REDMINE-36618.md'],
    limits:'Wariant bez zapisu pomija finalizację. Pełny wariant porównuje bazę, panel i PDF automatycznie. T16 ma Nie dotyczy, jeśli odczytana konfiguracja nie obsługuje palet. Niejednoznaczny wzorzec lub błąd odczytu CMS zatrzymuje przygotowanie.'}
}));
