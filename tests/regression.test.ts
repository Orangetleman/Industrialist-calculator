// Non-régression : la référence (fixture) et les vraies données du wiki.
import { describe, expect, it } from "vitest";
import itemsJson from "../data/items.json";
import machinesJson from "../data/machines.json";
import overridesJson from "../data/overrides.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import { solve, type Plan } from "../src/engine/solve.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import fixtureJson from "./fixtures/reference-crankshaft.json";
import { makeData, progress } from "./engine-helpers.ts";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type FixtureRecipe = { key: string; machine: string; durationS: number; energyMFps: number; inputs: Record<string, number>; outputs: Record<string, number> };
type Fixture = {
  recipes: FixtureRecipe[];
  scenario: {
    finalMachines: number;
    ironMix: string;
    expected: { crankshaftPerMin: number; machines: Record<string, number>; totalMachinesExcludingTrees: number; energyAvgMFps: number; energyPeakMFps: number };
  };
};
const fixture = fixtureJson as unknown as Fixture;

describe("non-régression : référence Ligne Vilebrequin (fixture)", () => {
  const data = makeData({
    machines: [{ id: "tree", kind: "farm" }],
    recipes: fixture.recipes.map((r) => ({
      id: r.key,
      machine: slug(r.machine),
      t: r.durationS,
      e: r.energyMFps,
      in: Object.fromEntries(Object.entries(r.inputs).map(([k, v]) => [slug(k), v])),
      out: Object.fromEntries(Object.entries(r.outputs).map(([k, v]) => [slug(k), v])),
    })),
  });
  const { scenario } = fixture;
  const plan = solve(data, progress(), {
    item: "crankshaft",
    finalMachines: scenario.finalMachines,
    forced: { "iron-mix": scenario.ironMix },
  });
  const byKey = new Map(plan.steps.map((s) => [s.recipeId, s]));

  it("15 Craft Assemblers → ≈ 52,33 vilebrequins/min", () => {
    expect(plan.status).toBe("ok");
    expect(plan.target.ratePerMin).toBeCloseTo(scenario.expected.crankshaftPerMin, 3);
  });

  it("mêmes nombres de machines que la référence, à chaque étape", () => {
    const got = Object.fromEntries(Object.keys(scenario.expected.machines).map((k) => [k, byKey.get(k)?.machines]));
    expect(got).toEqual(scenario.expected.machines);
  });

  it("mêmes totaux : 111 machines hors arbres, énergie moyenne et pic", () => {
    expect(plan.totals.machines).toBe(scenario.expected.totalMachinesExcludingTrees);
    expect(plan.totals.farms).toBe(scenario.expected.machines.oak);
    expect(Math.round(plan.totals.energyAvg)).toBe(scenario.expected.energyAvgMFps);
    expect(plan.totals.energyPeak).toBe(scenario.expected.energyPeakMFps);
  });

  it("plan ordonné de l'item final vers la matière première", () => {
    expect(plan.steps[0]?.item).toBe("crankshaft");
    expect(plan.steps.at(-1)?.isRaw).toBe(true);
    expect(plan.raw.map((r) => r.item).sort()).toEqual(["coal", "oak-log", "raw-iron"]);
  });
});

// ---------------------------------------------------------------- vraies données
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson } as unknown as RawFiles;
const { data: real, errors } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const allNodes = progress([...real.nodes.keys()]);

describe("vraies données (Miraheze)", () => {
  it("overrides.json est valide", () => {
    expect(errors).toEqual([]);
  });

  it("chaîne de la référence avec les valeurs Miraheze : 15 assembleurs → 60/min", () => {
    const forced = {
      crankshaft: "craft_assembler_05",
      "steel-rod": "roller_03",
      gear: "roller_04",
      "steel-plate": "press_03",
      "steel-ingot": "blast_furnace_10",
      "iron-mix": "industrial_kiln_08",
      "iron-powder": "grinder_03",
      "coke-fuel": "blast_furnace_05",
      "raw-iron": "iron_drill_01",
      coal: "coal_drill_01",
      "oak-log": "tree_01",
    };
    const plan = solve(real, { ...allNodes, pollutionPct: 0 }, { item: "crankshaft", finalMachines: 15, forced });
    expect(plan.status).toBe("ok");
    expect(plan.target.ratePerMin).toBeCloseTo(60, 6);
    const counts = Object.fromEntries(plan.steps.map((s) => [s.item, s.machines]));
    // Valeurs calculées indépendamment dans PLAN.md §0 bis (8 / 16 / 16, 12 Grinders, 46 Iron Drills, 46 arbres)
    expect(counts).toEqual({
      crankshaft: 15,
      "steel-rod": 8,
      gear: 16,
      "steel-plate": 16,
      "steel-ingot": 2,
      "iron-mix": 2,
      "iron-powder": 12,
      "coke-fuel": 1,
      "raw-iron": 46,
      coal: 2,
      "oak-log": 46,
    });
    expect(plan.totals.machines).toBe(120);
    // Écarts connus avec Fandom : affichés, pas cachés.
    expect(plan.verify.some((v) => v.id === "craft_assembler_05" && v.flag.reason === "contradiction")).toBe(true);
  });

  it("sans aucune recherche, le Crankshaft est verrouillé et le plan dit quoi débloquer", () => {
    const plan = solve(real, progress(), { item: "crankshaft", ratePerMin: 10 });
    expect(plan.status).toBe("impossible");
    expect(plan.unresolved[0]?.reason).toBe("verrouillé");
    expect(plan.economy.nodesToUnlock.length).toBeGreaterThan(0);
    expect(plan.economy.rpNeeded).toBeGreaterThan(0);
  });

  it("le moteur ne plante sur aucun item, quels que soient le critère et l'option", () => {
    const problems: string[] = [];
    for (const item of real.producers.keys()) {
      for (const criterion of ["machines", "energy", "raw"] as const) {
        for (const useUnverified of [false, true]) {
          let plan: Plan;
          try {
            plan = solve(real, allNodes, { item, ratePerMin: 10, criterion, useUnverified });
          } catch (e) {
            problems.push(`${item}/${criterion}/${useUnverified} : ${(e as Error).message}`);
            continue;
          }
          for (const s of plan.steps) {
            if (!Number.isFinite(s.machinesExact) || s.machines < 0) problems.push(`${item} : étape ${s.item} incohérente`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  }, 60_000); // ~1 300 résolutions complètes
});
