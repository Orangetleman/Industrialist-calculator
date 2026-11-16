// Mineshaft Drill (remarque joueur n°16) : recettes paramétrées (profondeur, tête, acide, huile) et
// cas du joueur (Purple Gold Ingot, Deep Earth Fragment, Trommels). Chaque nombre attendu se refait à
// la main avec les valeurs de data/mineshaft.json (page Mineshaft Drill de Miraheze).
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import mineshaftJson from "../../data/mineshaft.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "./data.ts";
import { cleanMineshaftChoice, DEFAULT_MINESHAFT, isMineshaftRecipe, mineshaftCycle, mineshaftDepths, withMineshaft, type MineshaftFile } from "./mineshaft.ts";
import { solve, type Plan } from "./solve.ts";
import type { OverridesFile } from "./types.ts";

const FILE = mineshaftJson as unknown as MineshaftFile;
const base = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const without = buildGameData(base, [overridesJson as unknown as OverridesFile]).data;
const { data } = buildGameData({ ...base, mineshaft: FILE }, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const machines = (p: Plan) => p.steps.reduce((s, x) => s + (x.machineKind === "machine" ? x.machines : 0), 0);
const step = (p: Plan, item: string) => p.steps.find((s) => s.item === item);

describe("données (wiki Miraheze)", () => {
  it("tableau des rendements : 41 profondeurs de 300 à 9 000 m, objets connus", () => {
    expect(FILE.depths.map((d) => d.depth)).toEqual([300, 900, 1200, 1500, 1800, ...Array.from({ length: 36 }, (_, k) => 2000 + 200 * k)]);
    for (const d of FILE.depths) for (const item of Object.keys(d.perSec)) expect(data.items.has(item), item).toBe(true);
    // Valeurs relues sur le wiki (où Industrialist Calculator diffère : MSD-07).
    expect(FILE.depths.find((d) => d.depth === 8000)!.perSec["deep-earth-fragment"]).toBe(11.65);
    expect(FILE.depths.find((d) => d.depth === 7800)!.perSec["medium-earth-fragment"]).toBe(6.67);
    expect(FILE.depths.find((d) => d.depth === 7000)!.perSec.rock).toBeUndefined();
  });
});

describe("cycle d'une tête", () => {
  it("8 000 m, Steel, Hydrochloric Acid : usure, durée, débit", () => {
    const cy = mineshaftCycle(FILE, 8000, DEFAULT_MINESHAFT)!;
    // d ≥ 6000 : 0,5 × (0,02 · d^0,25) × (0,09 · d^0,25) = 0,0009 · √d ; √8000 = 89,4427
    expect(cy.lossPctPerSec).toBeCloseTo(0.0009 * Math.sqrt(8000), 9);
    expect(cy.extractS).toBeCloseTo(1242.26, 1);
    expect(cy.travelS).toBe(320); // 2 × 8000 m ÷ 50 m/s
    expect(cy.cycleS).toBeCloseTo(1242.26 + 320 + 12, 1);
    expect(cy.inputs).toEqual({ "steel-drill-head": 1, "hydrochloric-acid": expect.closeTo(1.5 * cy.extractS, 6) });
    // 11,65 Deep Earth Fragment/s pendant l'extraction : ≈ 551,6 par minute et par machine.
    expect((cy.outputs["deep-earth-fragment"]! / cy.cycleS) * 60).toBeCloseTo(551.6, 1);
    // 3,1 MMF/s en extraction et en trajet, 0,1 MMF/s au changement.
    expect(cy.energyMFps).toBeCloseTo((3.1e6 * (cy.extractS + 320) + 0.1e6 * 12) / cy.cycleS, 3);
  });

  it("Machine Oil : +10 % de ressources et d'usure, trajet deux fois plus rapide, 2 L/s", () => {
    const a = mineshaftCycle(FILE, 8000, DEFAULT_MINESHAFT)!;
    const b = mineshaftCycle(FILE, 8000, { ...DEFAULT_MINESHAFT, oil: true })!;
    expect(b.extractS).toBeCloseTo(a.extractS / 1.1, 6);
    expect(b.travelS).toBe(160);
    // Presque autant de ressources par tête (le wiki le dit) : 1,1 × 1/1,1.
    expect(b.outputs["deep-earth-fragment"]).toBeCloseTo(a.outputs["deep-earth-fragment"]!, 6);
    expect(b.inputs["machine-oil"]).toBeCloseTo(2 * (b.extractS + 160), 6);
  });

  it("sans acide, la tête cuivre ne tient que quelques secondes", () => {
    const cy = mineshaftCycle(FILE, 8000, { ...DEFAULT_MINESHAFT, head: "copper", acid: "none" })!;
    // 0,5 × 8000/150 × 8000²/900 000 = 1 896 %/s
    expect(cy.lossPctPerSec).toBeCloseTo(0.5 * (8000 / 150) * (8000 ** 2 / 900000), 6);
    expect(cy.inputs).toEqual({ "copper-drill-head": 1 });
  });

  it("profondeur auto : la meilleure de chaque objet ; profondeur imposée : une seule recette", () => {
    const depths = mineshaftDepths(FILE, DEFAULT_MINESHAFT);
    expect(depths).toContain(8000); // Deep Earth Fragment
    expect(depths).toContain(6000); // Coal 54/s
    const fixed = withMineshaft(data, FILE, { ...DEFAULT_MINESHAFT, depth: 6600 });
    expect([...fixed.recipes.keys()].filter(isMineshaftRecipe)).toEqual(["mineshaft_drill@6600"]);
    expect(fixed.producers.get("deep-earth-fragment")!.map((r) => r.id)).toEqual(["mineshaft_drill@6600"]);
    // Les données de départ ne changent pas.
    expect(data.recipes.has("mineshaft_drill@8000")).toBe(true);
  });

  it("réglage relu : valeurs invalides → défaut", () => {
    expect(cleanMineshaftChoice({ depth: 8000, head: "iron", acid: "water", oil: true })).toEqual({ depth: 8000, head: "iron", acid: "water", oil: true });
    expect(cleanMineshaftChoice({ depth: "x", head: "gold", acid: 3 })).toEqual(DEFAULT_MINESHAFT);
    expect(cleanMineshaftChoice(null)).toBeNull();
  });
});

describe("machine utilisable par le calcul", () => {
  it("sans data/mineshaft.json : simple bâtiment, aucun producteur de Deep Earth Fragment", () => {
    expect(without.machines.get("mineshaft-drill")!.kind).toBe("building");
    expect(without.producers.get("deep-earth-fragment")).toBeUndefined();
  });
  it("avec : machine du nœud Mineshaft Drill, recettes sourcées et marquées à vérifier", () => {
    expect(data.machines.get("mineshaft-drill")!.kind).toBe("machine");
    const r = data.recipes.get("mineshaft_drill@8000")!;
    expect(r.research).toBe("mineshaft-drill");
    expect(r.sources[0]!.page).toBe("Mineshaft Drill");
    expect(r.verify.map((f) => f.field)).toEqual(["durationS", "energyMFps", "inputs.hydrochloric-acid"]);
  });
});

describe("cas du joueur : Purple Gold Ingot (60/min)", () => {
  const req = { item: "purple-gold-ingot", ratePerMin: 60, tiers: false } as const;

  it("avec le Mineshaft Drill, l'or vient du Deep Earth Fragment et il faut bien moins de machines", () => {
    const before = solve(without, all, { ...req, criterion: "machines" });
    const after = solve(data, all, { ...req, criterion: "machines" });
    expect(before.status).toBe("ok");
    expect(step(before, "deep-earth-fragment")).toBeUndefined();
    expect(step(after, "deep-earth-fragment")!.recipeId).toBe("mineshaft_drill@8000");
    expect(machines(after)).toBeLessThan(machines(before) * 0.7);
    // Toujours de l'or 24 carats pour l'or liquide (1 pour 1).
    expect(step(after, "liquid-gold")!.recipeId).toBe("industrial_electric_furnace_01");
  });

  it("la voie 10 Karat Gold (Trommel) coûte 10 fois plus d'or : c'est elle qui fait les centaines de Trommels", () => {
    const p = solve(data, all, { ...req, criterion: "machines", forced: { "liquid-gold": "industrial_electric_furnace_04", "10-karat-gold": "trommel_05" } });
    // 120 Liquid Gold/min à 0,1 par 10 Karat Gold : 1 200/min ; un Trommel en fait 7 / 28 s = 15/min → 80.
    expect(step(p, "10-karat-gold")!.machines).toBe(80);
    expect(step(p, "liquid-gold")!.machines).toBe(100);
    expect(machines(p)).toBeGreaterThan(2 * machines(solve(data, all, { ...req, criterion: "machines" })));
  });
});
