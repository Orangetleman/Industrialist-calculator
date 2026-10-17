// S6 : crafts et objets ajoutés (« added »), crafts retirés (« removed ») dans overrides.json.
import { describe, expect, it } from "vitest";
import { solve } from "../src/engine/solve.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { countCorrections, isOverridesFile, mergeCorrections, newItemId, newRecipeId, pruneIntegratedCorrections, removeAdded, setAddedItem, setAddedRecipe, setCorrection, setRemoved } from "../src/ui/state.ts";
import { makeData, progress, type R } from "./engine-helpers.ts";

const all = progress();
const JEU = { wiki: "jeu" as const, fetchedAt: "2026-10-17T10:00:00Z", note: "test" };
const step = (plan: ReturnType<typeof solve>, item: string) => plan.steps.find((s) => s.item === item);

// Deux façons de faire x : rapide (r1) et lente (r2) ; a vient d'une mine.
const base: { recipes: R[] } = {
  recipes: [
    { id: "r1", machine: "m1", t: 1, in: { a: 1 }, out: { x: 1 } },
    { id: "r2", machine: "m2", t: 10, in: { a: 1 }, out: { x: 1 } },
    { id: "ra", machine: "mine", t: 1, out: { a: 1 }, e: 0 },
  ],
};

describe("crafts retirés", () => {
  it("un craft retiré disparaît du calcul, et revient quand on le rétablit", () => {
    expect(step(solve(makeData(base), all, { item: "x", ratePerMin: 60 }), "x")!.recipeId).toBe("r1");
    const removed: OverridesFile = { removed: { recipes: { r1: { source: JEU } } } };
    const d = makeData({ ...base, overrides: [removed] });
    expect(d.recipes.has("r1")).toBe(false);
    expect(d.producers.get("x")!.map((r) => r.id)).toEqual(["r2"]);
    expect(d.removed.get("r1")).toMatchObject({ recipe: { id: "r1", machine: "m1" }, source: JEU });
    expect(step(solve(d, all, { item: "x", ratePerMin: 60 }), "x")!.recipeId).toBe("r2");
    // Rétablir : plus de retrait, le craft revient.
    const back = makeData({ ...base, overrides: [setRemoved(removed, "r1", false)] });
    expect(back.recipes.has("r1")).toBe(true);
    expect(back.removed.size).toBe(0);
  });

  it("retirer un craft inconnu est refusé", () => {
    expect(() => makeData({ ...base, overrides: [{ removed: { recipes: { zz: { source: JEU } } } }] })).toThrow(/removed\/recipes\/zz : craft inconnu/);
  });

  it("une correction d'un autre fichier sur un craft retiré ne plante pas", () => {
    const d = makeData({ ...base, overrides: [{ recipes: { r1: { durationS: { value: 2, source: JEU } } } }, { removed: { recipes: { r1: { source: JEU } } } }] });
    expect(d.removed.get("r1")!.recipe.durationS).toBe(2);
  });
});

describe("crafts et objets ajoutés", () => {
  it("un craft ajouté est proposé par le calcul, avec la recherche de sa machine", () => {
    const o: OverridesFile = {
      added: {
        items: { z: { name: "Zinc Bolt", isFluid: false, sellValue: 12, researchValue: null, source: JEU } },
        recipes: { "ajout-m1-z": { machine: "m1", durationS: 2, energyMFps: 500, inputs: { a: 2 }, outputs: { z: 1 }, source: JEU } },
      },
    };
    const d = makeData({ ...base, machines: [{ id: "m1", unlockedBy: "production" }], overrides: [o] });
    expect(d.items.get("z")).toMatchObject({ name: "Zinc Bolt", sellValue: 12, researchValue: null, added: JEU });
    expect(d.recipes.get("ajout-m1-z")).toMatchObject({ machine: "m1", research: "production", added: JEU, verify: [] });
    const plan = solve(d, all, { item: "z", ratePerMin: 30 });
    expect(step(plan, "z")).toMatchObject({ recipeId: "ajout-m1-z", machines: 1 });
    expect(step(plan, "a")!.recipeId).toBe("ra");
  });

  it("un craft ajouté plus rapide est préféré à ceux du wiki", () => {
    const o: OverridesFile = { added: { recipes: { fast: { machine: "m2", durationS: 0.5, energyMFps: 100, inputs: { a: 1 }, outputs: { x: 1 }, source: JEU } } } };
    const d = makeData({ ...base, overrides: [o] });
    expect(d.producers.get("x")!.map((r) => r.id)).toEqual(["fast", "r1", "r2"]);
  });

  it("un craft invalide est refusé avec la raison", () => {
    const bad = (r: object) => makeData({ ...base, overrides: [{ added: { recipes: { n: { machine: "m1", durationS: 1, energyMFps: 0, inputs: {}, outputs: { x: 1 }, source: JEU, ...r } } } } as OverridesFile] });
    expect(() => bad({ machine: "nope" })).toThrow(/added\/recipes\/n : machine inconnue/);
    expect(() => bad({ durationS: 0 })).toThrow(/durée > 0/);
    expect(() => bad({ outputs: {} })).toThrow(/au moins une sortie/);
    expect(() => bad({ inputs: { inconnu: 1 } })).toThrow(/objet inconnu dans inputs \(inconnu\)/);
    expect(() => bad({ outputs: { x: -1 } })).toThrow(/quantité > 0/);
    expect(() => bad({ energyMFps: "beaucoup" })).toThrow(/énergie/);
    expect(() => bad({ source: undefined })).toThrow(/source/);
    expect(() => makeData({ ...base, overrides: [{ added: { recipes: { r1: { machine: "m1", durationS: 1, energyMFps: 0, inputs: {}, outputs: { x: 1 }, source: JEU } } } }] })).toThrow(/existe déjà/);
    expect(() => makeData({ ...base, overrides: [{ added: { items: { x: { name: "X", isFluid: false, sellValue: null, researchValue: null, source: JEU } } } }] })).toThrow(/added\/items\/x : cet objet existe déjà/);
    expect(() => makeData({ ...base, overrides: [{ added: { items: { q: { name: " ", isFluid: false, sellValue: null, researchValue: null, source: JEU } } } }] })).toThrow(/nom/);
  });

  it("nouvelles corrections de valeurs : machine (et sa recherche) et facteur RP", () => {
    const d = makeData({
      ...base,
      machines: [{ id: "m2", unlockedBy: "n1" }],
      nodes: [{ id: "n1", rp: 5 }],
      overrides: [{ recipes: { r1: { machine: { value: "m2", source: JEU } } }, items: { x: { researchValue: { value: 35, source: JEU } } } }],
    });
    expect(d.recipes.get("r1")).toMatchObject({ machine: "m2", research: "n1" });
    expect(d.items.get("x")!.researchValue).toBe(35);
    expect(() => makeData({ ...base, overrides: [{ recipes: { r1: { machine: { value: "nope", source: JEU } } } }] })).toThrow(/machine inconnue/);
  });
});

describe("corrections locales : ajouts et retraits", () => {
  it("l'export contient le craft retiré et le craft ajouté, et se réimporte", () => {
    let c: OverridesFile = setCorrection({}, "recipes", "r2", "durationS", 8);
    c = setRemoved(c, "r1", true);
    c = setAddedItem(c, "z", { name: "Zinc Bolt", isFluid: false, sellValue: null, researchValue: null });
    c = setAddedRecipe(c, "ajout-m1-z", { machine: "m1", durationS: 2, energyMFps: 0, inputs: { a: 1 }, outputs: { z: 1 } });
    expect(countCorrections(c)).toBe(4);
    expect(c.removed!.recipes!.r1!.source).toMatchObject({ wiki: "jeu" });
    expect(c.added!.recipes!["ajout-m1-z"]!.source.fetchedAt).toMatch(/^\d{4}-\d\d-\d\d/);
    // Export = fichier du dépôt + corrections locales, en JSON.
    const exported = JSON.parse(JSON.stringify(mergeCorrections({ recipes: {}, items: {} }, c)));
    expect(isOverridesFile(exported)).toBe(true);
    expect(Object.keys(exported.removed.recipes)).toEqual(["r1"]);
    expect(Object.keys(exported.added.recipes)).toEqual(["ajout-m1-z"]);
    const d = makeData({ ...base, overrides: [exported] });
    expect(d.recipes.has("r1")).toBe(false);
    expect(d.recipes.has("ajout-m1-z")).toBe(true);
    // Intégré au dépôt (même date) : la copie locale est retirée.
    const { kept, dropped } = pruneIntegratedCorrections(c, exported);
    expect(dropped).toBe(4);
    expect(countCorrections(kept)).toBe(0);
    expect(kept.added).toBeUndefined();
  });

  it("effacer un objet ajouté emporte les crafts ajoutés qui l'utilisent", () => {
    let c = setAddedItem({}, "z", { name: "Z", isFluid: null, sellValue: null, researchValue: null });
    c = setAddedRecipe(c, "k", { machine: "m1", durationS: 1, energyMFps: 0, inputs: {}, outputs: { z: 1 } });
    const { next, alsoRemoved } = removeAdded(c, "items", "z");
    expect(alsoRemoved).toEqual(["k"]);
    expect(next.added).toBeUndefined();
  });

  it("identifiants libres", () => {
    const taken = new Set(["titanium-bolt", "ajout-m1-x"]);
    expect(newItemId("Titanium Bolt", (id) => taken.has(id))).toBe("titanium-bolt-2");
    expect(newItemId("Énergie Café", () => false)).toBe("energie-cafe");
    expect(newRecipeId("m1", "x", (id) => taken.has(id))).toBe("ajout-m1-x-2");
  });

  it("un fichier importé mal formé est refusé", () => {
    expect(isOverridesFile({ added: [] })).toBe(false);
    expect(isOverridesFile({ removed: { recipes: "r1" } })).toBe(false);
    expect(isOverridesFile({ added: { recipes: {} }, removed: {} })).toBe(true);
  });
});
