/* global module */
function classifyTestDataError(input) {
  const raw = typeof input === "string" ? input : input?.message || "";
  const message = String(raw)
    .replace(new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g"), "")
    .trim();
  const existing =
    /\[EXISTING_TEST_DATA\]|Pozostałości poprzedniego przebiegu wymagają wyjaśnienia|Konto ma już koszyk\. Nie dodano QA/i.test(
      message,
    );
  const pending =
    /\[TEST_DATA_CONFLICT\]|Istnieje (?:niedokończone przywracanie|dziennik (?:niedokończonego testu CMS|promocji #36944|stock))|Najpierw przywróć[^\n]*(?:Pozostał dziennik|Istnieje niedokończony dziennik)/i.test(
      message,
    );
  const missing =
    /\[TEST_DATA_ERROR\]|\[TEST_PRECONDITION\]|Dane referencyjne [^\s:]+: oczekiwano jednej aktywnej szkoły/i.test(
      message,
    );
  if (!existing && !pending && !missing) return null;
  const detail = message
    .split("\n")[0]
    .replace(/^(?:Error|AssertionError(?: \[ERR_ASSERTION\])?):\s*/i, "")
    .replace(
      /\[(?:EXISTING_TEST_DATA|TEST_DATA_CONFLICT|TEST_DATA_ERROR|TEST_PRECONDITION)\]\s*/g,
      "",
    )
    .slice(0, 2500);
  return {
    category: existing ? "EXISTING_TEST_DATA" : pending ? "TEST_DATA_CONFLICT" : "TEST_DATA_ERROR",
    label: existing
      ? "Błąd istniejących danych"
      : pending
        ? "Niedokończone przygotowanie danych"
        : "Błąd przygotowania danych",
    summary: /Pozostałości poprzedniego przebiegu wymagają wyjaśnienia/i.test(detail)
      ? "Szkoła ma istniejące zamówienia. Test zatrzymał się przed sprawdzeniem promocji."
      : detail,
    suggestion: pending
      ? "Sprawdź dziennik i stan poprzedniej próby. Użyj opisanej procedury przywracania; nie usuwaj dziennika, aby ominąć blokadę."
      : existing
        ? "Sprawdź wskazane dokumenty lub koszyk. Usuń dane tylko wtedy, gdy służyły do testów, albo przygotuj osobne dane i ponów test. Automat nie usuwa cudzych danych."
        : "Uzupełnij wskazane dane i sprawdź środowisko oraz warunki początkowe. Następnie ponów test.",
    qualification:
      "Zatrzymanie z powodu danych testowych nie potwierdza zaliczenia badanej funkcji. Wynik FAIL pozostaje bez zmian.",
  };
}
module.exports = { classifyTestDataError };
