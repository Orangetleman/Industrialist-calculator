// Calcul des machines modulaires (S13) : ferme d'arbres, moteur diesel, turbine « non fiable ».
// Chaque nombre attendu se refait avec les valeurs sourcées de data/modular.json.
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import modularJson from "../../data/modular.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "./data.ts";
import { dieselConfigs, dieselLitersPerMMF, dieselLookup, dieselPick, farmBlocks, farmOutput, farmRates, turbineReliability } from "./modular-calc.ts";
import type { ModularFile } from "./modular.ts";
import { solve } from "./solve.ts";
import type { OverridesFile } from "./types.ts";

const file = modularJson as unknown as ModularFile;
const base = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData({ ...base, modular: file }, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const rates = farmRates(file)!;

describe("ferme d'arbres", () => {
  it("valeurs lues dans modular.json", () => {
    expect(rates.logsPerTree.value).toBe(2);
    expect(rates.treesPerSprinkler.value).toBe(44);
    expect(rates.sprinklersPerTank.value).toBe(3);
    expect(rates.treesPerHarvester.value).toBe(22);
    expect(rates.treesPerHarvester.question).toBe("MOD-09");
    expect(rates.waterLpsPerSprinkler.value).toBeCloseTo(33 / 33.33, 9);
    expect(rates.energyPerCutMF.value).toBe(200000);
    expect(rates.controllerSlots).toBe(776);
  });

  it("blocs de la ferme du guide Miraheze : 88 arbres → 2 arroseurs, 1 réservoir, 4 récolteurs", () => {
    expect(farmBlocks(rates, 88)).toEqual({ trees: 88, sprinklers: 2, tanks: 1, harvesters: 4, controllers: 1, outputs: 1 });
    expect(farmBlocks(rates, 89)).toMatchObject({ sprinklers: 3, tanks: 1, harvesters: 5 });
    expect(farmBlocks(rates, 133)).toMatchObject({ sprinklers: 4, tanks: 2 });
  });

  it("production : 88 arbres à 363 s → 29,09 Oak Log/min, 48,48 kMF/s, 118,8 L/min", () => {
    const r = farmOutput(rates, farmBlocks(rates, 88), 363);
    expect(r.limit).toBe("arbres");
    expect(r.logsPerMin).toBeCloseTo((88 * 2 * 60) / 363, 9);
    expect(r.energyMFps).toBeCloseTo((88 * 200000) / 363, 6);
    expect(r.waterLpm).toBeCloseTo(2 * (33 / 33.33) * 60, 9);
    expect(r.problems).toEqual([]);
  });

  it("ce qui limite : récolteurs, arroseurs, réservoirs, bloc manquant", () => {
    const b = farmBlocks(rates, 88);
    expect(farmOutput(rates, { ...b, harvesters: 3 }, 363)).toMatchObject({ limit: "récolteurs", harvested: 66 });
    expect(farmOutput(rates, { ...b, sprinklers: 1 }, 363)).toMatchObject({ limit: "arroseurs", watered: 44 });
    const tanks = farmOutput(rates, { ...b, trees: 200, sprinklers: 4, harvesters: 10 }, 363);
    expect(tanks).toMatchObject({ limit: "réservoirs", activeSprinklers: 3, watered: 132 });
    expect(tanks.problems[0]).toContain("1 arroseur(s) sans réservoir");
    expect(farmOutput(rates, { ...b, outputs: 0 }, 363)).toMatchObject({ limit: "bloc manquant", logsPerMin: 0 });
    expect(farmOutput(rates, { ...b, controllers: 2 }, 363)).toMatchObject({ limit: "deux contrôleurs", logsPerMin: 0 });
  });

  it("sans modular.json, l'arbre reste une recette seule (comportement d'avant S13)", () => {
    const old = buildGameData(base, [overridesJson as unknown as OverridesFile]).data;
    expect(old.recipes.get("tree_01")!.parts).toBeUndefined();
  });

  it("dans le solveur : l'étape Oak Log est une ferme avec ses blocs, son eau et son électricité", () => {
    const p = solve(data, all, { item: "oak-log", ratePerMin: (88 * 2 * 60) / 363, criterion: "machines", tiers: false });
    const s = p.steps.find((x) => x.key === "oak-log")!;
    const g = s.durationS;
    expect(s.machines).toBe(88);
    expect(Object.fromEntries(s.parts!.map((q) => [q.machine, q.count]))).toEqual({
      tree: 88,
      "tree-farm-sprinkler": 2,
      "tree-farm-water-tank": 1,
      "farm-harvester": 4,
      "tree-farm-controller": 1,
      // S14 : d'après le plan de pose, deux sorties (une à portée de chaque récolteur), comme le guide.
      "tree-farm-output": 2,
    });
    expect(s.energyAvg!).toBeCloseTo((s.machinesExact * 200000) / g, 6);
    expect(s.inputs.find((i) => i.item === "water")!.perMin).toBeCloseTo((s.machinesExact * (33 / 33.33) * 60) / 44, 6);
    expect(p.steps.some((x) => x.key === "water")).toBe(true);
    // Les blocs de la ferme sont des bâtiments ; les arbres restent comptés à part.
    expect(p.totals.farms).toBe(88);
    expect(p.totals.machines).toBeGreaterThanOrEqual(2 + 1 + 4 + 1 + 1);
  });

  it("filtre de machines (S9) : en « Seulement… », les blocs suivent l'arbre ; écarter un récolteur écarte la ferme", () => {
    const only = solve(data, all, { item: "oak-log", ratePerMin: 10, criterion: "machines", tiers: false, machines: { mode: "seulement", ids: [] } });
    expect(only.steps.some((x) => x.key === "oak-log")).toBe(true);
    const out = solve(data, all, { item: "oak-log", ratePerMin: 10, criterion: "machines", tiers: false, machines: { mode: "exclure", ids: ["farm-harvester"] } });
    expect(out.steps.some((x) => x.recipeId === "tree_01")).toBe(false);
  });

  it("arbres fixés dans le schéma (S8) : les blocs suivent le nombre d'arbres", () => {
    const p = solve(data, all, { item: "oak-log", ratePerMin: 29.09, criterion: "machines", tiers: false, fixedMachines: { "oak-log": 45 } });
    const s = p.steps.find((x) => x.key === "oak-log")!;
    expect(s.machines).toBe(45);
    expect(s.parts!.find((q) => q.machine === "tree-farm-sprinkler")!.count).toBe(2);
    expect(s.parts!.find((q) => q.machine === "farm-harvester")!.count).toBe(3);
    expect(p.target.ratePerMin).toBeCloseTo((45 * 2 * 60) / s.durationS, 6);
  });
});

describe("moteur diesel", () => {
  const configs = dieselConfigs(file);

  it("configurations relevées : 6 cylindres (rapport 10 à 16) et 32 cylindres", () => {
    expect(configs.map((c) => c.id)).toEqual(["moteur:6cyl-af10", "moteur:6cyl-af11", "moteur:6cyl-af12", "moteur:6cyl-af13", "moteur:6cyl-af14", "moteur:6cyl-af15", "moteur:6cyl-af16", "moteur:32cyl-af14-t59"]);
    expect(dieselLookup(configs, 6, 16, 100)).toMatchObject({ powerMFps: 1340000, fuelLps: 0.086, throttleAssumed: true, partsComplete: true });
    expect(dieselLookup(configs, 32, 14, 59)).toMatchObject({ powerMFps: 3000000, fuelLps: 0.092, partsComplete: false });
    expect(dieselLookup(configs, 7, 14, 100)).toBeNull();
  });

  it("montage simple posé au plus court (S14) : 4 vilebrequins au lieu de 8, 68 500 $ au lieu de 84 500 $", () => {
    const c = dieselLookup(configs, 6, 16, 100)!;
    const cost = c.parts.reduce((s, p) => s + p.count * data.machines.get(p.machine)!.cost!, 0);
    // 9 000 + 4 × 4 000 + 6 × 4 000 + 3 × 4 500 + 6 000 (le wiki : 8 vilebrequins, 84 500 $).
    expect(cost).toBe(68500);
  });

  it("installation énergétique du solveur : moteurs entiers, Refined Diesel, blocs à relever signalés", () => {
    const r = data.recipes.get("moteur:32cyl-af14-t59")!;
    expect(r.energyMFps).toBe(-3000000);
    expect(r.inputs).toEqual({ "refined-diesel": 0.092 });
    expect(r.verify.map((f) => f.field)).toEqual(["pollutionPerHour", "parts"]);
    const p = solve(data, all, { item: "", energyMFps: 6000000, criterion: "energy", tiers: false, machines: { mode: "exclure", ids: ["large-diesel-engine", "wind-turbine1", "wind-turbine2", "wind-turbine3", "solar-panel", "firebox", "gas-burner"] } });
    const s = p.steps.find((x) => x.recipeId === "moteur:32cyl-af14-t59");
    expect(s).toBeDefined();
    if (s) {
      expect(s.parts!.find((q) => q.machine === "diesel-engine-cylinder")!.count).toBe(32 * s.machines);
      expect(s.inputs.find((i) => i.item === "refined-diesel")!.perMin).toBeCloseTo(s.machinesExact * 0.092 * 60, 6);
    }
  });
});

describe("moteur diesel : relevés de configuration et choix (S18)", () => {
  // Valeurs de test (pas des valeurs du jeu) : servent seulement à vérifier le traitement.
  const reading = { id: "t1", date: "2026-10-18", cylinders: 6, airFuel: 16, throttle: 100, fuel: "diesel", powerMFps: 1000, fuelLps: 2, torqueMT: null, blocks: { air: 1, exhaust: 1, fuel: 1, generator: 1, flywheel: 1 } };

  it("un relevé devient une configuration, avec son carburant et ses blocs", () => {
    const configs = dieselConfigs(file, [reading]);
    const c = configs.find((x) => x.reading === "t1")!;
    expect(c).toMatchObject({ id: "moteur:releve:t1", fuel: "diesel", powerMFps: 1000, fuelLps: 2, throttleAssumed: false });
    expect(c.parts.find((p) => p.machine === "diesel-engine-flywheel")?.count).toBe(1);
    // 6 cylindres + air + échappement + carburant = 9 blocs de côté → 4 vilebrequins (le volant n'est pas de côté).
    expect(c.parts.find((p) => p.machine === "diesel-engine-crankshaft")?.count).toBe(4);
    expect(dieselLookup(configs, 6, 16, 100, "diesel")).toBe(c);
    expect(dieselLookup(configs, 6, 16, 100)?.id).toBe("moteur:6cyl-af16");
  });

  it("un relevé aux mêmes réglages et carburant remplace la configuration du wiki", () => {
    const configs = dieselConfigs(file, [{ ...reading, fuel: "refined-diesel" }]);
    expect(configs.filter((c) => c.cylinders === 6 && c.airFuel === 16 && c.fuel === "refined-diesel").map((c) => c.id)).toEqual(["moteur:releve:t1"]);
  });

  it("relevé incomplet refusé", () => {
    expect(dieselConfigs(file, [{ ...reading, powerMFps: 0 }]).some((c) => c.reading)).toBe(false);
  });

  it("choix : le moins de carburant par MF/s, seulement avec le carburant voulu, ou la configuration imposée", () => {
    const configs = dieselConfigs(file, [reading]);
    const none = () => null;
    // 0,092 ÷ 3 MMF/s = 0,031 L par MMF, contre 0,086 ÷ 1,34 = 0,064 au mieux pour 6 cylindres.
    expect(dieselPick(configs, "refined-diesel", "carburant", null, none)?.id).toBe("moteur:32cyl-af14-t59");
    expect(dieselPick(configs, "refined-diesel", "carburant", "moteur:6cyl-af13", none)?.id).toBe("moteur:6cyl-af13");
    expect(dieselPick(configs, "diesel", "carburant", "moteur:6cyl-af13", none)?.id).toBe("moteur:releve:t1");
    expect(dieselPick(configs, "crude-diesel", "carburant", null, none)).toBeNull();
    // Meilleure production énergétique : la plus grande puissance par moteur (32 cylindres, 3 MMF/s ;
    // 6 cylindres au mieux 1,5 MMF/s au rapport 13).
    expect(dieselPick(configs, "refined-diesel", "puissance", null, none)?.id).toBe("moteur:32cyl-af14-t59");
    expect(dieselPick(configs.filter((c) => c.cylinders === 6), "refined-diesel", "puissance", null, none)?.id).toBe("moteur:6cyl-af13");
    expect(dieselLitersPerMMF(configs.find((c) => c.id === "moteur:32cyl-af14-t59")!)).toBeCloseTo(0.092 / 3, 9);
  });

  it("le solveur ne garde que le moteur choisi", () => {
    const { data: d } = buildGameData({ ...base, modular: file, dieselReadings: [reading] }, [overridesJson as unknown as OverridesFile]);
    expect(d.recipes.get("moteur:releve:t1")?.inputs).toEqual({ diesel: 2 });
    const ex = { mode: "exclure" as const, ids: ["large-diesel-engine", "wind-turbine1", "wind-turbine2", "wind-turbine3", "solar-panel", "firebox", "gas-burner"] };
    const p = solve(d, all, { item: "", energyMFps: 2000000, criterion: "energy", tiers: false, machines: ex, diesel: "moteur:6cyl-af13" });
    const diesel = p.steps.filter((s) => s.machine === "diesel-engine-controller");
    expect(diesel.map((s) => s.recipeId)).toEqual(["moteur:6cyl-af13"]);
  });
});

describe("turbine", () => {
  it("non fiable, hors du calcul", () => {
    expect(turbineReliability(file)).toMatchObject({ reliable: false });
    expect([...data.recipes.values()].some((r) => r.machine === "turbine-generator" || r.parts?.some((p) => p.machine === "turbine-generator"))).toBe(false);
  });
});
