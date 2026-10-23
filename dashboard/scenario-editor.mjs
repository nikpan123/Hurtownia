import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const text = (value, label, required = true) => {
  if (typeof value !== "string" || value.length > 20000 || (required && !value.trim()))
    throw fail("Uzupełnij poprawnie: " + label);
  return value.trim();
};
const lines = (value, label, required = true) => {
  if (!Array.isArray(value) || (required && !value.length) || value.length > 100)
    throw fail("Dodaj od 1 do 100 pozycji: " + label);
  return value.map((item) => text(item, label));
};
export function validateScenarioChanges(changes) {
  if (changes && JSON.stringify(changes).length > 50000)
    throw fail("Opis jest zbyt długi. Skróć go do 50 tysięcy znaków.");
  if (Array.isArray(changes?.steps) && changes.steps.join("\n").length > 20000)
    throw fail("Kroki mogą zawierać łącznie do 20 tysięcy znaków.");
  if (
    !changes ||
    Object.keys(changes).some(
      (key) =>
        !["title", "description", "preconditions", "steps", "expected", "blocker", "data"].includes(
          key,
        ),
    )
  )
    throw fail("Możesz edytować opis scenariusza; ID i kod testów pozostają osobnymi danymi.");
  return {
    title: text(changes.title, "Tytuł"),
    description: text(changes.description ?? "", "Opis", false),
    preconditions: lines(changes.preconditions, "Warunki wstępne", false),
    steps: lines(changes.steps, "Kroki"),
    expected: text(changes.expected, "Oczekiwany wynik"),
    blocker: text(changes.blocker ?? "", "Ograniczenia", false),
    data: text(changes.data ?? "", "Dane testowe", false),
  };
}

export function createScenarioEditor({ file, backupDir, baseCatalog }) {
  const token = randomUUID();
  let tail = Promise.resolve();
  async function read() {
    const source = await readFile(file, "utf8").catch((error) => {
      if (baseCatalog && error.code === "ENOENT") return '{"overrides":{}}';
      throw error;
    });
    const stored = JSON.parse(source),
      base = baseCatalog ? await baseCatalog() : null;
    const catalog = base ? globalThis.structuredClone(base) : stored;
    if (base)
      for (const feature of catalog.features)
        for (const scenario of feature.scenarios)
          Object.assign(scenario, stored.overrides?.[feature.id + ":" + scenario.id] || {});
    return { source, stored, catalog, revision: hash(source + (base ? JSON.stringify(base) : "")) };
  }
  return {
    async catalog() {
      const { catalog, revision } = await read();
      return { ...catalog, revision, editToken: token };
    },
    async update(body, { origin, expectedOrigin, contentType, editToken }) {
      if (
        origin !== expectedOrigin ||
        !contentType?.includes("application/json") ||
        editToken !== token
      )
        throw fail("Odśwież lokalny panel przed zapisem scenariusza.", 403);
      const save = async () => {
        const { source, stored, catalog, revision } = await read();
        if (body.revision !== revision)
          throw fail(
            "Scenariusze zmieniły się w innej karcie. Zachowaj wpisany tekst, odśwież katalog i otwórz edycję ponownie.",
            409,
          );
        const feature = catalog.features.find((item) => item.id === body.featureId);
        const scenario = feature?.scenarios.find((item) => item.id === body.scenarioId);
        if (!scenario) throw fail("Nie znaleziono scenariusza.", 404);
        const changes = validateScenarioChanges(body.changes);
        if (
          Object.entries(changes).every(
            ([key, value]) => JSON.stringify(scenario[key] ?? "") === JSON.stringify(value),
          )
        )
          return { ...catalog, revision, editToken: token };
        // An unchanged instruction retains its exact evidence link after reordering.
        // New/rewritten instructions must not inherit another step's green badge.
        const stepLinks = changes.steps.flatMap((step, index) => {
          if (
            changes.steps.filter((item) => item === step).length !== 1 ||
            scenario.steps.filter((item) => item === step).length !== 1
          )
            return [];
          const oldIndex = scenario.steps.indexOf(step),
            link = scenario.stepLinks?.find((item) => item.step === oldIndex);
          return link ? [{ ...link, step: index }] : [];
        });
        const updatedAt = new Date().toISOString();
        Object.assign(scenario, changes, { stepLinks, descriptionUpdatedAt: updatedAt });
        await mkdir(backupDir, { recursive: true });
        await writeFile(path.join(backupDir, revision + ".json"), source, {
          encoding: "utf8",
          flag: "wx",
        }).catch((error) => {
          if (error.code !== "EEXIST") throw error;
        });
        if (baseCatalog) {
          stored.overrides ??= {};
          stored.overrides[feature.id + ":" + scenario.id] = {
            ...changes,
            stepLinks,
            descriptionUpdatedAt: updatedAt,
          };
        }
        const output = JSON.stringify(baseCatalog ? stored : catalog, null, 2) + "\n",
          temporary = file + "." + randomUUID() + ".tmp";
        await writeFile(temporary, output, "utf8");
        await rename(temporary, file);
        return this.catalog();
      };
      const result = tail.then(save);
      tail = result.catch(() => {});
      return result;
    },
  };
}
