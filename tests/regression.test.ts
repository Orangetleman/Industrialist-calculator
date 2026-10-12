// Non-régression : la référence (fixture) et les vraies données du wiki.
import { describe, expect, it } from "vitest";
import itemsJson from "../data/items.json";
import logisticsJson from "../data/logistics.json";
import machinesJson from "../data/machines.json";
import overridesJson from "../data/overrides.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import { solve, type Plan } from "../src/engine/solve.ts";
import { solveV1 } from "../src/engine/solve-v1.ts";
import { machineAccess } from "../src/engine/unlock.ts";
import type { LogisticsFile } from "../src/engine/extension-types.ts";
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

  it("paliers ronds : 15 assembleurs est un palier, 52,33/min le débit courant", () => {
    const cur = plan.tiers.find((t) => t.current)!;
    expect(cur.finalMachines).toBeCloseTo(15, 9);
    expect(plan.tiers.length).toBeGreaterThan(1);
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
    // L'écart avec Fandom sur le Crankshaft est tranché par un relevé en jeu (overrides.json) :
    // la valeur Miraheze est confirmée, la contradiction n'est plus signalée.
    expect(plan.verify.some((v) => v.id === "craft_assembler_05")).toBe(false);
    expect(real.recipes.get("craft_assembler_05")?.corrections?.map((c) => c.source.wiki)).toEqual(["jeu", "jeu"]);
    // Ce qui reste incertain est affiché, pas caché : le rendement des arbres (« au moins 2 »).
    expect(plan.verify.map((v) => `${v.id} ${v.flag.field} ${v.flag.reason}`)).toEqual(["tree_01 outputs.oak-log approximatif"]);
  });

  it("Crankshaft, toute la recherche débloquée : chaîne complète avec chaque critère", () => {
    for (const criterion of ["machines", "energy", "raw", "steps", "pollution", "cost"] as const) {
      const plan = solve(real, allNodes, { item: "crankshaft", ratePerMin: 60, criterion });
      expect(plan.status, criterion).toBe("ok");
      expect(plan.engine, criterion).toBe("simplexe");
      expect(plan.unresolved, criterion).toEqual([]);
      // Une étape par recette (un item peut venir de plusieurs recettes : clés distinctes).
      expect(new Set(plan.steps.map((s) => s.key)).size, criterion).toBe(plan.steps.length);
      expect(new Set(plan.steps.map((s) => s.recipeId)).size, criterion).toBe(plan.steps.length);
      // Bilan : chaque item consommé est produit en quantité suffisante.
      const net = new Map<string, number>([["crankshaft", -60]]);
      for (const s of plan.steps) {
        net.set(s.item, (net.get(s.item) ?? 0) + s.demandPerMin);
        for (const b of s.byproducts) net.set(b.item, (net.get(b.item) ?? 0) + b.perMin);
        for (const i of s.inputs) net.set(i.item, (net.get(i.item) ?? 0) - i.perMin);
      }
      for (const [item, v] of net) expect(v, `${criterion} : bilan de ${item}`).toBeGreaterThan(-1e-6);
    }
  });

  it("moteur v2 : jamais moins bon que l'heuristique v1 sur le nombre réel de machines", () => {
    const v1 = solveV1(real, allNodes, { item: "crankshaft", ratePerMin: 60, criterion: "machines" });
    const v2 = solve(real, allNodes, { item: "crankshaft", ratePerMin: 60, criterion: "machines" });
    expect(v2.totals.machines + v2.totals.farms).toBeLessThanOrEqual(v1.totals.machines + v1.totals.farms);
  });

  it("vraies données : autonomie énergétique, objectif argent, pollution maximale", () => {
    const own = solve(real, allNodes, { item: "crankshaft", ratePerMin: 60, criterion: "machines", selfPowered: true });
    expect(own.status).toBe("ok");
    expect(own.totals.energyProduced).toBeGreaterThanOrEqual(own.totals.energyAvg * (1 - 1e-9));

    const logistics = logisticsJson as unknown as LogisticsFile;
    const depots = logistics.depots.map((d) => ({ id: d.id, name: d.name, kind: d.kind, itemsPerSec: d.itemsPerSec }));
    const money = solve(real, allNodes, { item: "", moneyPerMin: 100_000, depots });
    expect(money.status).toBe("ok");
    expect(money.totals.revenuePerMin).toBeGreaterThanOrEqual(100_000 * (1 - 1e-9));
    expect(money.depots.length).toBeGreaterThan(0);
    // Transportation et Truck Depot sont acquis d'office (relevé en jeu) : sans aucune recherche,
    // le dépôt est là, mais rien n'est encore productible à vendre.
    expect(machineAccess(real, progress(), "truck-depot").available).toBe(true);
    const none = solve(real, progress(), { item: "", moneyPerMin: 10, depots });
    expect(none.warnings.some((w) => w.code === "dépôt")).toBe(false);
    const early = progress([...real.nodes.keys()].filter((n) => n !== "van-depot" && n !== "huge-truck-depot"));
    const start = solve(real, early, { item: "", moneyPerMin: 10, depots });
    expect(start.depots.map((d) => d.id)).toEqual(["truck-depot"]);

    const free = solve(real, allNodes, { item: "crankshaft", ratePerMin: 60 });
    const max = free.totals.pollutionPerHour[1] / 2;
    const clean = solve(real, allNodes, { item: "crankshaft", ratePerMin: 60, maxPollution: max });
    const exactPollution = clean.steps.reduce((s, x) => {
      const p = real.machines.get(x.machine)?.pollutionPerHour;
      return s + x.machinesExact * (p == null ? 0 : typeof p === "number" ? p : p[1]);
    }, 0);
    expect(exactPollution).toBeLessThanOrEqual(max + 1e-6);
  });

  it("« moins d'étapes » raccourcit la chaîne obtenue avec « moins de machines »", () => {
    const byMachines = solve(real, allNodes, { item: "crankshaft", ratePerMin: 60, criterion: "machines" });
    const bySteps = solve(real, allNodes, { item: "crankshaft", ratePerMin: 60, criterion: "steps" });
    expect(bySteps.status).toBe("ok");
    expect(bySteps.steps.length).toBeLessThan(byMachines.steps.length);
  });

  it("sans aucune recherche, le Crankshaft est verrouillé et le plan dit quoi débloquer", () => {
    const plan = solve(real, progress(), { item: "crankshaft", ratePerMin: 10 });
    expect(plan.status).toBe("impossible");
    expect(plan.unresolved[0]?.reason).toBe("verrouillé");
    // Toute la chaîne, pas seulement la machine du Crankshaft : l'acier (Blast Furnace) en fait partie.
    expect(plan.economy.nodesToUnlock).toEqual(expect.arrayContaining(["craft-assembler", "steel"]));
    expect(plan.economy.rpNeeded).toBeGreaterThan(real.nodes.get("craft-assembler")!.rp);
    // Et cette liste suffit : une fois cochée, le plan est complet.
    const unlocked = progress(plan.economy.nodesToUnlock);
    const after = solve(real, unlocked, { item: "crankshaft", ratePerMin: 10 });
    expect(after.status).toBe("ok");
    expect(after.economy.nodesToUnlock).toEqual([]);
  });

  it("le moteur ne plante sur aucun item, quels que soient le critère et l'option", () => {
    const problems: string[] = [];
    for (const item of real.producers.keys()) {
      for (const criterion of ["machines", "energy", "raw", "steps"] as const) {
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
  }, 600_000); // ~1 300 résolutions complètes : 50 s à plus de 4 min selon la charge de la machine
});
