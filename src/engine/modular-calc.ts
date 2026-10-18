// Calcul des machines modulaires (S13), à partir de data/modular.json seulement :
//   - ferme d'arbres : bois, eau et électricité selon arbres, arroseurs, réservoirs et récolteurs ;
//   - moteur diesel : les configurations relevées sur les wikis (pas de formule connue, MOD-12) ;
//   - turbine : hors du calcul, « non fiable » (MOD-16).
// `applyModular` change les recettes du jeu pour le solveur (étape Oak Log = ferme, moteurs =
// installations énergétiques). Pur : ni DOM ni stockage.

import { fact, rule, treeGrid, type ModAssembly, type ModFact, type ModularFile } from "./modular.ts";
import type { Machine, Recipe, Source, VerifyFlag } from "./types.ts";

const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Sources d'une donnée de modular.json, au format des recettes. */
export function modSources(file: ModularFile, ids: string[]): Source[] {
  return ids.flatMap((id) => {
    const s = file.sources[id];
    if (!s) return [];
    const wiki = s.wiki === "utilisateur" ? "jeu" : s.wiki;
    const out: Source = { wiki, fetchedAt: s.fetchedAt };
    if (s.url) out.url = s.url;
    if (s.page) out.page = s.page;
    const rev = (s as { revisionId?: number }).revisionId;
    if (rev !== undefined) out.revisionId = rev;
    if (s.note) out.note = s.note;
    return [out];
  });
}

const assembly = (file: ModularFile, id: string): ModAssembly | undefined => file.assemblies.find((a) => a.id === id);
const blockFact = (a: ModAssembly | undefined, block: string, key: string): ModFact | undefined => {
  const b = a?.blocks.find((x) => x.id === block);
  return b ? fact(b, key) : undefined;
};

// ---------------------------------------------------------------- ferme d'arbres

/** Valeur de la ferme et d'où elle vient (clé de la donnée, sources, question encore ouverte). */
export type FarmValue = { value: number; fact: ModFact; question?: string };

export type FarmRates = {
  logsPerTree: FarmValue;
  treesPerSprinkler: FarmValue;
  sprinklersPerTank: FarmValue;
  /** Arbres suivis par un récolteur : 22 d'après le guide Miraheze ; maximum réel inconnu (MOD-09). */
  treesPerHarvester: FarmValue;
  /** Eau d'un arroseur, en L/s (33 L toutes les 33,33 s). */
  waterLpsPerSprinkler: FarmValue;
  waterCycle: { periodS: number; litersPerCycle: number };
  /** Électricité par arbre coupé, en MF. */
  energyPerCutMF: FarmValue;
  /** Emplacements d'arbres (4 × 4) que touche la portée du contrôleur, sans la place des autres blocs. */
  controllerSlots: number | null;
};

/** Valeurs de la ferme lues dans modular.json ; null s'il en manque une (le calcul ne s'invente rien). */
export function farmRates(file: ModularFile): FarmRates | null {
  const a = assembly(file, "tree-farm");
  const logs = blockFact(a, "tree", "logsPerTree");
  const perSpr = blockFact(a, "tree-farm-sprinkler", "treesPerSprinkler");
  const cycle = blockFact(a, "tree-farm-sprinkler", "waterCycle");
  const perTank = blockFact(a, "tree-farm-water-tank", "sprinklersPerTank");
  const perHarv = blockFact(a, "farm-harvester", "treesPerHarvester");
  const cut = blockFact(a, "tree-farm-controller", "powerPerTreeMF");
  const range = blockFact(a, "tree-farm-controller", "rangeTiles");
  const c = cycle?.value as { periodS?: number; litersPerCycle?: number } | null | undefined;
  const v = {
    logs: asNum(logs?.value),
    perSpr: asNum((perSpr?.value as { grid?: number } | null)?.grid),
    perTank: asNum(perTank?.value),
    perHarv: asNum((perHarv?.value as { guide?: number } | null)?.guide),
    period: asNum(c?.periodS),
    liters: asNum(c?.litersPerCycle),
    cut: asNum(cut?.value),
  };
  if (Object.values(v).some((x) => x === null || !(x > 0))) return null;
  const r = asNum(range?.value);
  const open = (f: ModFact) => (f.question && file.meta?.openQuestions?.includes(f.question) ? { question: f.question } : {});
  return {
    logsPerTree: { value: v.logs!, fact: logs! },
    treesPerSprinkler: { value: v.perSpr!, fact: perSpr! },
    sprinklersPerTank: { value: v.perTank!, fact: perTank! },
    treesPerHarvester: { value: v.perHarv!, fact: perHarv!, ...open(perHarv!) },
    waterLpsPerSprinkler: { value: v.liters! / v.period!, fact: cycle! },
    waterCycle: { periodS: v.period!, litersPerCycle: v.liters! },
    energyPerCutMF: { value: v.cut!, fact: cut! },
    controllerSlots: r === null ? null : treeGrid(4, r + 2).count,
  };
}

export type FarmBlocks = { trees: number; sprinklers: number; tanks: number; harvesters: number; controllers: number; outputs: number };

/** Blocs d'une ferme pour `trees` arbres : arroseurs, réservoirs et récolteurs au plus juste, 1 contrôleur et 1 sortie. */
export function farmBlocks(rates: FarmRates, trees: number): FarmBlocks {
  const t = Math.max(0, Math.ceil(trees - 1e-9));
  const sprinklers = Math.ceil(t / rates.treesPerSprinkler.value);
  return {
    trees: t,
    sprinklers,
    tanks: Math.ceil(sprinklers / rates.sprinklersPerTank.value),
    harvesters: Math.ceil(t / rates.treesPerHarvester.value),
    controllers: t > 0 ? 1 : 0,
    outputs: t > 0 ? 1 : 0,
  };
}

export type FarmLimit = "arbres" | "arroseurs" | "réservoirs" | "récolteurs" | "bloc manquant" | "deux contrôleurs";

export type FarmResult = {
  /** Arbres arrosés par les arroseurs qui ont un réservoir. */
  watered: number;
  /** Arbres coupés (arrosés et suivis par un récolteur). */
  harvested: number;
  /** Arroseurs qui reçoivent de l'eau (3 par réservoir). */
  activeSprinklers: number;
  logsPerMin: number;
  waterLpm: number;
  energyMFps: number;
  /** Ce qui limite le bois : les arbres eux-mêmes si rien d'autre. */
  limit: FarmLimit;
  /** Blocs qui manquent pour que la ferme marche, ou en trop. */
  problems: string[];
};

/** Production d'une ferme posée (nombres de blocs donnés) à la durée de pousse `growthS`. */
export function farmOutput(rates: FarmRates, b: FarmBlocks, growthS: number): FarmResult {
  const problems: string[] = [];
  if (b.controllers < 1) problems.push("il faut un contrôleur");
  if (b.controllers > 1) problems.push("un seul contrôleur par ferme : deux contrôleurs cassent la ferme");
  if (b.tanks < 1) problems.push("il faut un réservoir");
  if (b.sprinklers < 1) problems.push("il faut un arroseur");
  if (b.harvesters < 1) problems.push("il faut un récolteur");
  if (b.outputs < 1) problems.push("il faut une sortie");
  if (b.trees < 1) problems.push("il faut des arbres");
  const broken = problems.length > 0;
  const activeSprinklers = broken ? 0 : Math.min(b.sprinklers, b.tanks * rates.sprinklersPerTank.value);
  const watered = Math.min(b.trees, activeSprinklers * rates.treesPerSprinkler.value);
  const harvested = Math.min(watered, b.harvesters * rates.treesPerHarvester.value);
  let limit: FarmLimit = "arbres";
  if (broken) limit = b.controllers > 1 ? "deux contrôleurs" : "bloc manquant";
  else if (harvested < watered) limit = "récolteurs";
  else if (watered < b.trees) limit = activeSprinklers < b.sprinklers ? "réservoirs" : "arroseurs";
  if (!broken && activeSprinklers < b.sprinklers) problems.push(`${b.sprinklers - activeSprinklers} arroseur(s) sans réservoir (${rates.sprinklersPerTank.value} par réservoir)`);
  const g = growthS > 0 ? growthS : Infinity;
  return {
    watered,
    harvested,
    activeSprinklers,
    logsPerMin: (harvested * rates.logsPerTree.value * 60) / g,
    waterLpm: activeSprinklers * rates.waterLpsPerSprinkler.value * 60,
    energyMFps: (harvested * rates.energyPerCutMF.value) / g,
    limit,
    problems,
  };
}

// ---------------------------------------------------------------- moteur diesel

export type DieselConfig = {
  id: string;
  label: string;
  cylinders: number;
  airFuel: number;
  throttle: number;
  /** L'accélérateur n'est pas écrit par la source : supposé. */
  throttleAssumed: boolean;
  powerMFps: number;
  fuel: string;
  fuelLps: number;
  torqueMT: number | null;
  /** Blocs du moteur ; `partsComplete` false : seuls ceux qu'écrit la source (MOD-14). */
  parts: { machine: string; count: number }[];
  partsComplete: boolean;
  sources: string[];
  note: string;
};

type Measure = { id: string; columns?: string[]; rows?: number[][]; value?: Record<string, number>; parts?: Record<string, number>; partsComplete?: boolean; sources: string[]; alternatives?: { value: unknown; sources: string[] }[] };

/** Configurations relevées du moteur diesel (Refined Diesel) : tableau du contrôleur (6 cylindres) et 32 cylindres. */
export function dieselConfigs(file: ModularFile): DieselConfig[] {
  const a = assembly(file, "diesel-engine") as (ModAssembly & { measurements?: Measure[] }) | undefined;
  const ms = a?.measurements ?? [];
  const easy = ms.find((m) => m.id === "easy-setup");
  const table = ms.find((m) => m.id === "air-fuel-6cyl");
  const big = ms.find((m) => m.id === "32-cylinders");
  const toParts = (p: Record<string, number> | undefined) => Object.entries(p ?? {}).map(([machine, count]) => ({ machine, count }));
  const out: DieselConfig[] = [];
  if (table?.rows && table.columns && easy?.parts) {
    const col = (n: string) => table.columns!.indexOf(n);
    for (const row of table.rows) {
      const af = row[col("airFuel")]!;
      out.push({
        id: `moteur:6cyl-af${af}`,
        label: `6 cylindres, rapport ${af}`,
        cylinders: 6,
        airFuel: af,
        throttle: 100,
        throttleAssumed: true,
        powerMFps: row[col("powerMFps")]!,
        fuel: "refined-diesel",
        fuelLps: row[col("fuelLps")]!,
        torqueMT: row[col("torqueMT")] ?? null,
        parts: toParts(easy.parts),
        partsComplete: true,
        sources: [...table.sources, ...easy.sources.filter((s) => !table.sources.includes(s))],
        note: "Tableau du contrôleur (Miraheze), Refined Diesel. Blocs du montage simple du wiki. Accélérateur non écrit : supposé à 100 % (la ligne du rapport 16 est celle du montage simple à 100 %).",
      });
    }
  }
  if (big?.value && big.parts) {
    const v = big.value;
    out.push({
      id: `moteur:${v.cylinders}cyl-af${v.airFuel}-t${v.throttle}`,
      label: `${v.cylinders} cylindres, rapport ${v.airFuel}, accélérateur ${v.throttle} %`,
      cylinders: v.cylinders!,
      airFuel: v.airFuel!,
      throttle: v.throttle!,
      throttleAssumed: false,
      powerMFps: v.powerMFps!,
      fuel: "refined-diesel",
      fuelLps: v.fuelLps!,
      torqueMT: null,
      parts: toParts(big.parts),
      partsComplete: big.partsComplete !== false,
      sources: big.sources,
      note: "Configuration la plus connue (Miraheze), Refined Diesel. Vilebrequins, entrées d'air, échappements et entrées de carburant : nombres à relever (MOD-14).",
    });
  }
  return out;
}

/** Configuration relevée correspondant aux réglages ; null : « à relever » (pas de formule, MOD-12). */
export function dieselLookup(configs: DieselConfig[], cylinders: number, airFuel: number, throttle: number): DieselConfig | null {
  return configs.find((c) => c.cylinders === cylinders && c.airFuel === airFuel && c.throttle === throttle) ?? null;
}

// ---------------------------------------------------------------- turbine

/** La turbine modulaire n'entre pas dans le calcul : ses chiffres ne sont pas fiables (décision de l'utilisateur). */
export function turbineReliability(file: ModularFile): { reliable: false; text: string } | null {
  const r = rule(assembly(file, "modular-turbine") ?? ({ rules: [] } as unknown as ModAssembly), "reliability");
  return r ? { reliable: false, text: "Turbine modulaire : chiffres de production non fiables (pas de formule connue, seulement les tableaux du développeur) ; elle n'entre pas dans le calcul." } : null;
}

// ---------------------------------------------------------------- recettes du solveur

/** Ferme d'une recette d'arbre : eau par seconde et par arbre, électricité par arbre coupé. */
export type FarmRecipe = { waterItem: string; waterLpsPerTree: number; energyPerCutMF: number };

/**
 * Adapte les recettes au calcul des modulaires :
 *   - la recette de l'arbre devient une ferme (installation composée par arbre : arroseurs,
 *     réservoirs, récolteurs au prorata ; contrôleur et sortie une fois par ferme), avec l'eau des
 *     arroseurs et l'électricité des coupes ;
 *   - chaque configuration relevée du moteur diesel devient une installation énergétique.
 */
export function applyModular(recipes: Map<string, Recipe>, machines: Map<string, Machine>, file: ModularFile): void {
  const rates = farmRates(file);
  if (rates) {
    const perSpr = rates.treesPerSprinkler.value;
    const perTank = rates.sprinklersPerTank.value;
    const perHarv = rates.treesPerHarvester.value;
    const src = modSources(file, [
      ...new Set([
        ...rates.treesPerSprinkler.fact.sources,
        ...rates.sprinklersPerTank.fact.sources,
        ...rates.treesPerHarvester.fact.sources,
        ...rates.waterLpsPerSprinkler.fact.sources,
        ...rates.energyPerCutMF.fact.sources,
      ]),
    ]);
    for (const r of recipes.values()) {
      if (!r.durationByPollution || r.parts || !machines.has(r.machine)) continue;
      const parts = [
        { machine: r.machine, count: 1 },
        { machine: "tree-farm-sprinkler", count: 1 / perSpr },
        { machine: "tree-farm-water-tank", count: 1 / (perSpr * perTank) },
        { machine: "farm-harvester", count: 1 / perHarv },
        { machine: "tree-farm-controller", count: 1, perFarm: true },
        { machine: "tree-farm-output", count: 1, perFarm: true },
      ];
      if (parts.some((p) => !machines.has(p.machine))) continue;
      r.parts = parts;
      r.setupName = "Ferme d'arbres";
      r.setupNote = `Par arbre : 1/${perSpr} d'arroseur, 1/${perSpr * perTank} de réservoir, 1/${perHarv} de récolteur (guide Miraheze) ; 1 contrôleur et 1 sortie par ferme (une seule ferme jusqu'au plan de pose). Eau : ${rates.waterCycle.litersPerCycle} L toutes les ${String(rates.waterCycle.periodS).replace(".", ",")} s par arroseur ; électricité : ${rates.energyPerCutMF.value / 1000} kMF par arbre coupé.`;
      r.farm = { waterItem: "water", waterLpsPerTree: rates.waterLpsPerSprinkler.value / perSpr, energyPerCutMF: rates.energyPerCutMF.value };
      r.sources = [...r.sources, ...src];
      if (rates.treesPerHarvester.question) {
        r.verify = [...r.verify, { field: "parts", reason: "approximatif", detail: `${perHarv} arbres par récolteur d'après le guide Miraheze ; le maximum réel est à relever (${rates.treesPerHarvester.question})` }];
      }
    }
  }
  for (const c of dieselConfigs(file)) {
    if (!c.parts.every((p) => machines.has(p.machine))) continue;
    const verify: VerifyFlag[] = [{ field: "pollutionPerHour", reason: "manquant", detail: "pollution de l'échappement selon la configuration inconnue (MOD-15)" }];
    if (c.throttleAssumed) verify.push({ field: "energyMFps", reason: "approximatif", detail: "accélérateur non écrit par le tableau du contrôleur : supposé à 100 %" });
    if (!c.partsComplete) verify.push({ field: "parts", reason: "manquant", detail: "blocs autres que contrôleur, cylindres et générateur à relever (MOD-14) : liste et prix incomplets" });
    recipes.set(c.id, {
      id: c.id,
      machine: "diesel-engine-controller",
      durationS: 1,
      inputs: { [c.fuel]: c.fuelLps },
      outputs: {},
      energyMFps: -c.powerMFps,
      research: null,
      parts: c.parts.map((p) => ({ ...p })),
      setupName: `Moteur diesel modulaire — ${c.label}`,
      setupNote: c.note,
      energyGuaranteed: true,
      wholeUnits: true,
      sources: modSources(file, c.sources),
      verify,
    });
  }
}
