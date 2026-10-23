export function createScenarioEditorUI({ onSaved = () => {}, onError = console.error } = {}) {
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const dialog = document.createElement("dialog");
  dialog.className = "scenario-editor-dialog";
  dialog.setAttribute("aria-labelledby", "scenario-editor-title");
  document.body.append(dialog);
  let catalog,
    featureId,
    scenarioId,
    saving = false,
    initial = "";
  const row = (value) =>
    `<li class="scenario-editor-step"><div class="scenario-editor-step-head"><strong></strong><div><button type="button" data-step-move="-1" aria-label="Przesuń krok w górę">↑</button><button type="button" data-step-move="1" aria-label="Przesuń krok w dół">↓</button><button type="button" data-step-remove>Usuń</button></div></div><textarea required maxlength="20000" aria-label="Treść kroku">${esc(value)}</textarea></li>`;
  const field = (label, name, value, required = false) =>
    `<label>${label}<textarea name="${name}" maxlength="20000" ${required ? "required" : ""}>${esc(value)}</textarea></label>`;
  function renumber() {
    const rows = [...dialog.querySelectorAll(".scenario-editor-step")];
    rows.forEach((node, i) => {
      node.querySelector("strong").textContent = "Krok " + (i + 1);
      node.querySelector('[data-step-move="-1"]').disabled = i === 0;
      node.querySelector('[data-step-move="1"]').disabled = i === rows.length - 1;
      node.querySelector("[data-step-remove]").disabled = rows.length === 1;
    });
  }
  function values() {
    const form = dialog.querySelector("form"),
      data = Object.fromEntries(new globalThis.FormData(form));
    return {
      ...data,
      preconditions: data.preconditions
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      steps: [...dialog.querySelectorAll(".scenario-editor-step textarea")].map((el) => el.value),
    };
  }
  function close() {
    if (saving) return;
    if (
      JSON.stringify(values()) !== initial &&
      !confirm("Porzucić niezapisane zmiany scenariusza?")
    )
      return;
    dialog.close();
  }
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || saving) return;
    if (button.hasAttribute("data-editor-close")) close();
    if (button.hasAttribute("data-step-add")) {
      dialog.querySelector("ol").insertAdjacentHTML("beforeend", row(""));
      renumber();
      dialog.querySelector("ol li:last-child textarea").focus();
    }
    const current = button.closest(".scenario-editor-step");
    if (button.hasAttribute("data-step-remove")) {
      current.remove();
      renumber();
    }
    if (button.dataset.stepMove) {
      const before = button.dataset.stepMove === "-1";
      if (before && current.previousElementSibling) current.previousElementSibling.before(current);
      else if (!before && current.nextElementSibling) current.nextElementSibling.after(current);
      renumber();
    }
  });
  dialog.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    if(JSON.stringify(values())===initial){dialog.close();return;}
    saving = true;
    const save = dialog.querySelector("[type=submit]");
    save.disabled = true;
    dialog.querySelector("[role=alert]").textContent = "";
    try {
      const headers = { "Content-Type": "application/json", "X-Scenario-Token": catalog.editToken };
      for (const [meta, header] of [
        ["cms-token", "X-CMS-Token"],
        ["center-token", "X-Center-Token"],
        ["ui-token", "X-UI-Token"],
      ]) {
        const node = document.querySelector(`meta[name="${meta}"]`);
        if (node) headers[header] = node.content;
      }
      const response = await fetch("/api/scenarios/update", {
          method: "POST",
          headers,
          body: JSON.stringify({
            featureId,
            scenarioId,
            revision: catalog.revision,
            changes: values(),
          }),
        }),
        body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się zapisać scenariusza.");
      await onSaved(body);
      dialog.close();
    } catch (error) {
      dialog.querySelector("[role=alert]").textContent = error.message;
    } finally {
      saving = false;
      save.disabled = false;
    }
  });
  return {
    async open(feature, id) {
      try {
        const response = await fetch("/api/scenarios", { cache: "no-store" });
        catalog = await response.json();
        if (!response.ok || !catalog.editToken)
          throw new Error("Odśwież serwer panelu, aby włączyć edycję scenariuszy.");
        featureId = feature;
        scenarioId = id;
        const scenario = catalog.features
          .find((f) => f.id === feature)
          ?.scenarios.find((s) => s.id === id);
        if (!scenario) throw new Error("Nie znaleziono scenariusza. Odśwież katalog.");
        dialog.innerHTML = `<form><div class="scenario-editor-heading"><div><small>EDYCJA INSTRUKCJI · ${esc(id)}</small><h2 id="scenario-editor-title">Edytuj scenariusz</h2></div><button type="button" data-editor-close aria-label="Zamknij edycję">×</button></div><p class="scenario-editor-note">Opis zapisujemy lokalnie w tym panelu. Zmieniasz instrukcję dla użytkownika. Kod automatu i powiązane ID testów pozostają osobnymi danymi. Zmienione kroki nie dziedziczą potwierdzeń z poprzedniego opisu.</p><div class="scenario-editor-fields"><label>Tytuł<input name="title" required maxlength="20000" value="${esc(scenario.title)}"></label>${field("Opis / cel sprawdzenia", "description", scenario.description || "")}${field("Warunki wstępne — opcjonalnie, jeden w wierszu", "preconditions", scenario.preconditions.join("\n"))}${field("Dane testowe", "data", scenario.data || "")}<section><h3>Kroki wykonania</h3><ol>${scenario.steps.map(row).join("")}</ol><button type="button" data-step-add>+ Dodaj krok</button></section>${field("Oczekiwany wynik", "expected", scenario.expected, true)}${field("Ograniczenia pokrycia", "blocker", scenario.blocker || "")}<p class="scenario-editor-note">Powiązane testy: ${esc((scenario.testIds || []).join(", ") || "Scenariusz ręczny")}. Poprzednia wersja opisu zostanie zachowana w kopii lokalnej.</p></div><p role="alert"></p><div class="scenario-editor-footer"><button type="button" data-editor-close>Anuluj</button><button type="submit" class="primary">Zapisz scenariusz</button></div></form>`;
        renumber();
        initial = JSON.stringify(values());
        dialog.showModal();
      } catch (error) {
        onError(error.message);
      }
    },
  };
}
