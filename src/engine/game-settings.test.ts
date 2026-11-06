import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { evalRecipe } from "./choose.ts";
import { buildGameData, type RawFiles } from "./data.ts";
import { asuResidue, logsMultiplier, TREE_SCRUBBER, TREE_SCRUBBER_RECIPE, treeScrubberPollution, treeScrubberResidue } from "./game-settings.ts";
import { solve } from "./solve.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files);
const unlocked = new Set(data.nodes.keys());

describe("réglages de partie (S50)", () => {
  it("Residue de l'ASU : formule du wiki", () => {
    expect([asuResidue(-45), asuResidue(10), asuResidue(25), asuResidue(200), asuResidue(900)]).toEqual([1, 1, 2.5, 20, 20]);
    const e = evalRecipe(data, data.recipes.get("air_separation_unit_01")!, 50);
    expect(e.net.residue).toBe(5);
  });

  it("bûches : +50 % seulement avec l'Igloo, de décembre à février", () => {
    expect([12, 1, 2].map((m) => logsMultiplier(m, true))).toEqual([1.5, 1.5, 1.5]);
    expect(logsMultiplier(3, true)).toBe(1);
    expect(logsMultiplier(1, false)).toBe(1);
    const tree = data.recipes.get("tree_01")!;
    expect(evalRecipe(data, tree, 10, { month: 1, igloo: true }).net["oak-log"]).toBe(3);
    expect(evalRecipe(data, tree, 10, { month: 7, igloo: true }).net["oak-log"]).toBe(2);
  });

  it("Tree Scrubber : −3,88 %/h à 0 %, à l'arrêt sous −1 500 % mais boit encore", () => {
    expect(treeScrubberPollution(0)).toBeCloseTo(-3.88, 6);
    expect(treeScrubberPollution(100)).toBeLessThan(treeScrubberPollution(0));
    expect(treeScrubberPollution(-1501)).toBe(0);
    expect(treeScrubberResidue(-1501)).toBe(0);
    expect(evalRecipe(data, data.recipes.get(TREE_SCRUBBER_RECIPE)!, -1501).recipe.inputs.water).toBe(18);
  });

  it("le plan suit la pollution et le mois", () => {
    const req = { item: "oak-log", ratePerMin: 60, criterion: "machines", tiers: false } as const;
    const n = (p: object) => solve(data, { unlocked, pollutionPct: 10, ...p }, req).steps.find((s) => s.item === "oak-log")!.machinesExact;
    expect(n({ month: 1, igloo: true })).toBeLessThan(n({ month: 7, igloo: true }));
    expect(n({ pollutionPct: 25 })).toBeLessThan(n({ pollutionPct: 150 }));
  });

  it("le Tree Scrubber attend d'être possédé", () => {
    expect(data.machines.get(TREE_SCRUBBER)?.unlockedBy).toBeNull();
    const req = { item: "residue", ratePerMin: 60, criterion: "machines", tiers: false } as const;
    const uses = (owned: string[]) => solve(data, { unlocked, owned: new Set(owned), pollutionPct: 10 }, { ...req, maxPollution: -1 }).steps.some((s) => s.machine === TREE_SCRUBBER);
    expect(uses([])).toBe(false);
  });
});
