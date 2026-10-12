// Phase E2 : objectif énergie sur les vraies données, avec des cas calculés à la main.
import { describe, expect, it } from "vitest";
import energyJson from "../data/energy.json";
import itemsJson from "../data/items.json";
import machinesJson from "../data/machines.json";
import overridesJson from "../data/overrides.json";
import powerJson from "../data/power.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import type { EnergyFile, PowerFile } from "../src/engine/extension-types.ts";
import { ENERGY } from "../src/engine/resources.ts";
import { solve } from "../src/engine/solve.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { progress } from "./engine-helpers.ts";

const energy = energyJson as unknown as EnergyFile;
const power = powerJson as unknown as PowerFile;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy } as unknown as RawFiles;
const { data, errors } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = progress([...data.nodes.keys()]);
const poles = power.entries
  .filter((e) => e.subcategory === "Transfer Poles" && e.transfer)
  .map((e) => ({ id: e.id, name: e.name, perNodeMFps: e.transfer!.perNode, nodes: e.transfer!.nodes, rangeTiles: e.rangeTiles?.tiles ?? null }));
const setup = (id: string) => energy.setups.find((s) => s.id === id)!;

describe("données de l'énergie (energy.json)", () => {
  it("installations calculées à partir du wiki, avec leurs sources", () => {
    expect(errors).toEqual([]);
    // Firebox : 2 Boilers, 2 Large Turbines, vapeur vers 190 °C → 2 × 319 850 MF/s (courbe des turbines).
    expect(setup("centrale:firebox_01")).toMatchObject({
      mfps: 639_700,
      inputsPerSec: { coal: 1 },
      parts: [
        { machine: "firebox", count: 1 },
        { machine: "boiler", count: 2 },
        { machine: "large-turbine", count: 2 },
      ],
      guaranteed: true,
    });
    expect(setup("centrale:firebox_01").verify[0]?.reason).toBe("approximatif");
    expect(setup("centrale:gas_burner_01")).toMatchObject({ mfps: 4_500_000, inputsPerSec: { "refined-gas": 30 } });
    for (const s of energy.setups) expect(s.sources.length, s.id).toBeGreaterThan(0);
  });

  it("solaire : moyenne du tableau horaire (183,75 MF/s) et stockage de nuit exact", () => {
    // 4×120 + 150 + 180 + 11×240 + 4×150 + 3×120 = 4 410 MF/s·h sur 24 h.
    expect(setup("solaire:solar-panel")).toMatchObject({ mfps: 183.75, guaranteed: false });
    // Heure de jeu = 16 min / 24 = 40 s. De 17 h à 5 h, le déficit cumulé vaut
    // 4×33,75×40 + 7×63,75×40 + 33,75×40 + 3,75×40 = 24 750 MF par panneau.
    const rusty = setup("solaire+stockage:rusty-battery");
    expect(rusty.guaranteed).toBe(true);
    expect(rusty.parts[1]!.count).toBeCloseTo(24_750 / 1_000_000, 12); // capacité d'une Rusty Battery
  });

  it("Scrubbers : pollution retirée selon l'eau, ajoutée avec le Residue", () => {
    expect(energy.scrubbers.map((s) => [s.recipe, s.pollutionPerHour])).toEqual([
      ["scrubber_01", -3.24],
      ["scrubber_02", -3.57],
      ["scrubber_03", -6.29],
      ["scrubber_04", 6.48],
    ]);
    expect(data.recipes.get("scrubber_03")?.pollutionPerHour).toBe(-6.29);
  });

  it("ce qui manque est listé au lieu d'être inventé", () => {
    const missing = energy.notComputed.map((n) => n.machine);
    expect(missing).toEqual(expect.arrayContaining(["industrial-firebox", "geothermal-well", "solar-panel3", "steam-turbine"]));
  });
});

describe("objectif énergie", () => {
  it("1 MMF/s au moins cher : Firebox, calcul à la main", () => {
    const plan = solve(data, all, { item: "", energyMFps: 1_000_000, criterion: "cost", poles, distanceTiles: 50 });
    expect(plan.status).toBe("ok");
    expect(plan.target.kind).toBe("énergie");
    // Une installation : 639 700 MF/s, 60 charbon/min = 4 foreuses à 15/min et 120 MF/s chacune.
    const u = 1_000_000 / (639_700 - 4 * 120);
    const centrale = plan.steps.find((s) => s.recipeId === "centrale:firebox_01")!;
    expect(centrale.item).toBe(ENERGY);
    expect(centrale.machinesExact).toBeCloseTo(u, 9);
    expect(centrale.parts!.map((q) => [q.machine, q.count])).toEqual([
      ["firebox", 2],
      ["boiler", 4],
      ["large-turbine", 4],
    ]);
    expect(centrale.parts![1]!.exact).toBeCloseTo(2 * u, 9);
    expect(plan.steps.find((s) => s.item === "coal")!.machinesExact).toBeCloseTo(4 * u, 9);
    expect(plan.totals.energyProduced - plan.totals.energyAvg).toBeCloseTo(1_000_000, 3);
    expect(plan.totals.machines).toBe(2 + 4 + 4 + 7);
    // Réseau : un HMVT porte 1,5 MMF/s par nœud, portée 22 cases → 50 cases : ⌈50/22⌉ + 1 = 4 poteaux.
    expect(plan.distribution?.options.find((o) => o.id === "hmvt")).toMatchObject({ lines: 1, polesPerLine: 4, poles: 4 });
  });

  it("puissance garantie : jamais de source qui s'arrête la nuit sans stockage", () => {
    const plan = solve(data, all, { item: "", energyMFps: 50_000, guaranteedEnergy: true, noFuel: true, criterion: "cost" });
    expect(plan.status).toBe("ok");
    for (const s of plan.steps) expect(data.recipes.get(s.recipeId)?.energyGuaranteed, s.recipeId).not.toBe(false);
    // Sans combustible : aucune étape ne consomme d'objet.
    expect(plan.steps.every((s) => s.inputs.length === 0)).toBe(true);
  });

  it("pollution maximale respectée (machines exactes)", () => {
    const free = solve(data, all, { item: "", energyMFps: 2_000_000, criterion: "cost" });
    const max = free.totals.pollutionPerHour[1] / 3;
    const clean = solve(data, all, { item: "", energyMFps: 2_000_000, criterion: "cost", maxPollution: max });
    expect(clean.status).toBe("ok");
    const exact = clean.steps.reduce((s, x) => {
      const r = data.recipes.get(x.recipeId)!;
      const m = data.machines.get(x.machine)?.pollutionPerHour;
      const per = r.pollutionPerHour ?? (r.parts ? r.parts.reduce((t, q) => t + q.count * ((data.machines.get(q.machine)?.pollutionPerHour as number) ?? 0), 0) : typeof m === "number" ? m : Array.isArray(m) ? m[1] : 0);
      return s + x.machinesExact * per;
    }, 0);
    expect(exact).toBeLessThanOrEqual(max + 1e-6);
  });

  it("« moins de pollution » ajoute des Scrubbers jusqu'à zéro, pas au-delà", () => {
    const plan = solve(data, all, { item: "", energyMFps: 1_000_000, criterion: "pollution" });
    expect(plan.status).toBe("ok");
    const scrub = plan.steps.filter((s) => s.machine === "scrubber");
    const exact = plan.steps.reduce((s, x) => {
      const r = data.recipes.get(x.recipeId)!;
      const m = data.machines.get(x.machine)?.pollutionPerHour;
      return s + x.machinesExact * (r.pollutionPerHour ?? (typeof m === "number" ? m : Array.isArray(m) ? m[1] : 0));
    }, 0);
    if (scrub.length) expect(exact).toBeCloseTo(0, 6);
    else expect(exact).toBeGreaterThanOrEqual(0);
  });

  it("une chaîne autonome (E1) peut maintenant s'alimenter avec une centrale thermique", () => {
    const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "cost", selfPowered: true });
    expect(plan.status).toBe("ok");
    expect(plan.totals.energyProduced).toBeGreaterThanOrEqual(plan.totals.energyAvg * (1 - 1e-9));
  });
});
