// Machines fixées dans le schéma (S8) : débit obtenu, étape qui limite, utilisation des autres
// (chaîne du Crankshaft, tout débloqué, comme le panneau « Comment c'est calculé »).
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "./data.ts";
import { solve, type SolveRequest } from "./solve.ts";
import type { OverridesFile } from "./types.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const req: SolveRequest = { item: "crankshaft", ratePerMin: 60, criterion: "machines", tiers: false };
const step = (p: ReturnType<typeof solve>, key: string) => p.steps.find((s) => s.key === key)!;

describe("machines fixées", () => {
  const base = solve(data, all, req);

  it("une étape fixée : débit proportionnel, elle limite, les autres s'adaptent", () => {
    // Sans réglage : 6,667 Iron Drill → 7 pour 60/min. Avec 5 : 60 × 5 ÷ 6,667 = 45/min.
    expect(step(base, "raw-iron").machinesExact).toBeCloseTo(20 / 3, 6);
    const p = solve(data, all, { ...req, fixedMachines: { "raw-iron": 5 } });
    expect(p.target.ratePerMin).toBeCloseTo(45, 6);
    expect(p.fixed).toMatchObject({ limit: "raw-iron", reason: "machines", baseRate: 60, existingUsed: false, ignored: [] });
    expect(p.fixed!.steps[0]).toMatchObject({ key: "raw-iron", machines: 5, planMachines: 7 });
    expect(p.fixed!.steps[0]!.utilization).toBeCloseTo(1, 6);
    expect(step(p, "raw-iron").machines).toBe(5);
    // Les autres étapes sont recalculées pour 45/min : 3,75 → 4 Advanced Assembler.
    expect(step(p, "crankshaft").machinesExact).toBeCloseTo(3.75, 6);
    expect(step(p, "crankshaft").machines).toBe(4);
    // Mêmes recettes que le plan sans réglage.
    expect(new Set(p.steps.map((s) => s.recipeId))).toEqual(new Set(base.steps.map((s) => s.recipeId)));
  });

  it("plus de machines que le plan : le débit monte d'autant", () => {
    const p = solve(data, all, { ...req, fixedMachines: { crankshaft: 8 } });
    expect(p.target.ratePerMin).toBeCloseTo(96, 6);
    expect(step(p, "crankshaft").machines).toBe(8);
  });

  it("deux étapes fixées : la plus contraignante l'emporte, l'autre montre sa capacité inutilisée", () => {
    const p = solve(data, all, { ...req, fixedMachines: { "raw-iron": 5, "steel-plate": 1 } });
    // Steel Plate : 1,6 Press MK2 pour 60/min → 1 seule : 37,5/min. Raw Iron : 4,167 sur 5.
    expect(p.target.ratePerMin).toBeCloseTo(37.5, 6);
    expect(p.fixed!.limit).toBe("steel-plate");
    const iron = p.fixed!.steps.find((s) => s.key === "raw-iron")!;
    expect(iron.exact).toBeCloseTo(25 / 6, 6);
    expect(iron.utilization).toBeCloseTo(5 / 6, 6);
    // Le bloc garde ses 5 machines fixées, même si 5 suffiraient.
    expect(step(p, "raw-iron").machines).toBe(5);
    expect(step(p, "raw-iron").utilization).toBeCloseTo(5 / 6, 6);
  });

  it("avec de la production existante : elle sert d'abord, le débit n'est plus proportionnel", () => {
    // 10 Raw Iron/min déjà en place : il reste 20/min à extraire avec 5 Iron Drill (4/min chacune),
    // soit 30/min de Raw Iron en tout ; la chaîne en demande 26,667 pour 60 Crankshaft → 67,5/min.
    const p = solve(data, all, { ...req, existing: { "raw-iron": 10 }, fixedMachines: { "raw-iron": 5 } });
    expect(p.target.ratePerMin).toBeCloseTo(67.5, 3);
    expect(p.fixed!.limit).toBe("raw-iron");
    expect(p.fixed!.existingUsed).toBe(true);
    expect(p.existing.find((x) => x.item === "raw-iron")!.used).toBeCloseTo(10, 6);
  });

  it("une clé absente du plan est ignorée", () => {
    const p = solve(data, all, { ...req, fixedMachines: { "pas-une-etape": 3 } });
    expect(p.target.ratePerMin).toBe(60);
    expect(p.fixed).toMatchObject({ reason: "aucune", ignored: ["pas-une-etape"] });
  });

  it("objectif argent : le débit est en $/min", () => {
    const money = solve(data, all, { item: "", moneyPerMin: 10000, criterion: "machines", tiers: false });
    const st = money.steps.find((s) => s.machines >= 2 && !s.parts);
    if (!st) return;
    const p = solve(data, all, { item: "", moneyPerMin: 10000, criterion: "machines", tiers: false, fixedMachines: { [st.key]: st.machines * 2 } });
    expect(p.fixed!.reason).toBe("machines");
    expect(p.target.ratePerMin).toBeGreaterThan(10000);
  });
});
