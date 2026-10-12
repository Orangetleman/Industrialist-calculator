// Retours de l'utilisateur du 2026-10-13 : eau chaude des Boilers, prudence sur les plages,
// Scrubber, Industrial Diesel Refinery, notes et liste complète des valeurs à vérifier.
import { describe, expect, it } from "vitest";
import itemsJson from "../data/items.json";
import machinesJson from "../data/machines.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import energyJson from "../data/energy.json";
import overridesJson from "../data/overrides.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import { solve } from "../src/engine/solve.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { allVerifyEntries, renderVerify } from "../src/ui/render.ts";
import { cleanNotes, DEFAULT_SETTINGS, noteKey } from "../src/ui/state.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data, errors } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()) };

describe("eau chaude : le Boiler a deux entrées d'eau", () => {
  it("3 d'eau convertie + 3 d'eau chaude → 90 de vapeur + 3 d'eau usée ; les chauffe-eau rendent de l'eau chaude", () => {
    expect(errors).toEqual([]);
    expect(data.items.get("hot-water")?.isFluid).toBe(true);
    const b = data.recipes.get("boiler_01")!;
    expect(b.inputs).toEqual({ water: 3, "hot-water": 3 });
    expect(b.outputs).toEqual({ water: 3, steam: 90 });
    expect(b.verify.filter((f) => f.field === "inputs.water")).toEqual([]);
    expect(data.recipes.get("firebox_01")!.outputs).toEqual({ "hot-water": 6 });
  });

  it("pas de vapeur sans chauffe-eau dans la chaîne", () => {
    const plan = solve(data, all, { item: "steam", ratePerMin: 5400, criterion: "machines", tiers: false });
    expect(plan.status).toBe("ok");
    expect(plan.steps.some((s) => s.item === "hot-water")).toBe(true);
  });
});

describe("prudence et corrections", () => {
  it("une pollution en plage compte pour sa borne la plus forte", () => {
    const m = data.machines.get("large-diesel-engine")!;
    expect(m.pollutionPerHour).toBe(0.648);
    expect(m.verify.find((f) => f.field === "pollutionPerHour")?.detail).toMatch(/par prudence/);
  });

  it("Scrubber : pollution donnée recette par recette (page du wiki), plus de doute sur la machine", () => {
    expect(data.machines.get("scrubber")!.verify.filter((f) => f.field === "pollutionPerHour")).toEqual([]);
    expect(data.recipes.get("scrubber_01")!.pollutionPerHour).toBe(-3.24);
  });

  it("pas de fausse contradiction quand les deux sources nomment la même recherche", () => {
    expect(data.machines.get("diesel-engine-flywheel")!.verify.filter((f) => f.field === "unlockedBy")).toEqual([]);
  });

  it("Industrial Diesel Refinery : débloquée par la recherche Industrial Diesel Refining", () => {
    const m = data.machines.get("industrial-diesel-refinery")!;
    expect(m.unlockedBy).toBe("industrial-diesel-refining");
    expect(m.verify.filter((f) => f.field === "unlockedBy")).toEqual([]);
  });
});

describe("valeurs à vérifier : toutes, et des notes", () => {
  const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
  const ctx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {} };

  it("la liste complète contient plus que le plan, celles du plan marquées « utilisées »", () => {
    const every = allVerifyEntries(ctx);
    expect(every.length).toBeGreaterThan(plan.verify.length);
    const groups = new Set(every.map((x) => `${x.scope}|${x.id}`));
    expect(groups.size).toBeGreaterThan(50);
    for (const v of plan.verify.filter((x) => x.used)) expect(every.some((x) => x.id === v.id && x.used)).toBe(true);
    expect(renderVerify(ctx, { entries: every, all: true })).toContain("Pas utilisée par le dernier calcul");
  });

  it("une note s'affiche sous sa valeur, avec de quoi la modifier ; les notes mal formées sont écartées", () => {
    const every = allVerifyEntries(ctx);
    const v = every.find((x) => x.scope === "machine")!;
    const k = noteKey("machines", v.id, v.flag.field);
    const html = renderVerify(ctx, { entries: [v], notes: { [k]: { text: "deux ports <b>distincts</b>", at: "2026-10-13T10:00:00Z" } }, all: true });
    expect(html).toContain("Ta note");
    expect(html).toContain("deux ports &lt;b&gt;distincts&lt;/b&gt;");
    expect(html).toContain(`data-note="${k}"`);
    expect(cleanNotes({ [k]: { text: " ok ", at: "x" }, "autre|a|b": { text: "non" }, [noteKey("recipes", "r", "f")]: { text: "  " } })).toEqual({ [k]: { text: "ok", at: "x" } });
  });
});
