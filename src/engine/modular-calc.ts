// Calcul des machines modulaires (S13), à partir de data/modular.json seulement :
//   - ferme d'arbres : bois, eau et électricité selon arbres, arroseurs, réservoirs et récolteurs ;
//   - moteur diesel : les configurations relevées sur les wikis (pas de formule connue, MOD-12) ;
//   - turbine : hors du calcul, « non fiable » (MOD-16).
// `applyModular` change les recettes du jeu pour le solveur (étape Oak Log = ferme, moteurs =
// installations énergétiques). Pur : ni DOM ni stockage.

import { crankshaftsFor, DIESEL_IDS, FARM_IDS, type FarmGeometry, type FarmPole, type PortSpec } from "./build/assembly.ts";
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

/**
 * Géométrie de la ferme pour son plan de pose (S14) : tailles du wiki, portées relevées (depuis le
 * bord, plus la demi-largeur du bloc pour partir du centre), règles de nombre et ports relevés.
 * null s'il manque une valeur (pas de plan inventé). `poles` : poteaux du catalogue (sans le HV).
 */
export function farmGeometry(file: ModularFile, machines: Map<string, Machine>, poles: FarmPole[] = []): FarmGeometry | null {
  const rates = farmRates(file);
  const a = assembly(file, "tree-farm");
  if (!rates || !a) return null;
  const size = (id: string) => {
    const s = machines.get(id)?.size;
    return s ? { w: s.w, h: s.l } : null;
  };
  const range = (id: string) => {
    const v = asNum(blockFact(a, id, "rangeTiles")?.value);
    const s = size(id);
    return v !== null && s && s.w === s.h ? v + s.w / 2 : null;
  };
  const sizes = { sprinkler: size(FARM_IDS.sprinkler), harvester: size(FARM_IDS.harvester), controller: size(FARM_IDS.controller), output: size(FARM_IDS.output), tank: size(FARM_IDS.tank) };
  const tree = size(FARM_IDS.tree);
  const reach = { sprinkler: range(FARM_IDS.sprinkler), harvester: range(FARM_IDS.harvester), controller: range(FARM_IDS.controller) };
  if (!tree || tree.w !== tree.h || Object.values(sizes).some((s) => !s) || Object.values(reach).some((r) => r === null)) return null;
  // Arroseur, contrôleur et sortie occupent un emplacement d'arbre ; le récolteur, un nombre entier d'emplacements.
  if ([sizes.sprinkler!, sizes.controller!, sizes.output!].some((s) => s.w !== tree.w || s.h !== tree.w) || sizes.harvester!.w % tree.w || sizes.harvester!.h % tree.w) return null;
  const port = (block: string, key: string): PortSpec | null => {
    const v = blockFact(a, block, key)?.value as { side?: string; cell?: unknown } | null | undefined;
    return v && typeof v.cell === "number" && ["haut", "bas", "gauche", "droite"].includes(v.side ?? "") ? { side: v.side as PortSpec["side"], cell: v.cell } : null;
  };
  const plug = blockFact(a, FARM_IDS.controller, "powerPort")?.value as { cell?: unknown } | null | undefined;
  return {
    tree: tree.w,
    sizes: sizes as FarmGeometry["sizes"],
    reach: reach as FarmGeometry["reach"],
    perHarvester: rates.treesPerHarvester.value,
    perTank: rates.sprinklersPerTank.value,
    ports: { output: port(FARM_IDS.output, "itemPort"), tank: port(FARM_IDS.tank, "waterPort"), plug: Array.isArray(plug?.cell) && plug.cell.length === 2 ? (plug.cell as [number, number]) : null },
    poles: poles.filter((p) => p.rangeCells > 0),
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
  /** Relevé de configuration (éditeur, S18) : id du relevé. */
  reading?: string;
};

/**
 * Relevé de configuration du moteur (éditeur de bâtiments, S18) : réglages du contrôleur, carburant,
 * blocs posés et ce que l'Info Panel affiche. Gardé dans le navigateur, exporté avec les relevés.
 */
export type DieselReading = {
  id: string;
  date: string;
  cylinders: number;
  airFuel: number;
  throttle: number;
  fuel: string;
  powerMFps: number;
  fuelLps: number;
  torqueMT: number | null;
  blocks: { air: number; exhaust: number; fuel: number; generator: number; flywheel: number };
};

/** Carburants du moteur (Diesel Engine Fuel Input, wiki). */
export const DIESEL_FUELS = ["refined-diesel", "diesel", "poor-quality-diesel", "crude-diesel"] as const;
export const dieselFuelName = (id: string) => id.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");

/** Relevé lu depuis un fichier ou le navigateur ; null s'il est incomplet. */
export function parseDieselReading(x: unknown): DieselReading | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const b = (o.blocks ?? {}) as Record<string, unknown>;
  const cyl = n(o.cylinders), af = n(o.airFuel), th = n(o.throttle), pw = n(o.powerMFps), fl = n(o.fuelLps);
  if (typeof o.id !== "string" || typeof o.fuel !== "string" || cyl === null || af === null || th === null || pw === null || fl === null) return null;
  if (cyl < 1 || pw <= 0 || fl <= 0 || th <= 0 || th > 100) return null;
  const k = (v: unknown, d: number) => Math.max(0, Math.round(n(v) ?? d));
  return {
    id: o.id,
    date: typeof o.date === "string" ? o.date : "",
    cylinders: Math.round(cyl),
    airFuel: af,
    throttle: th,
    fuel: o.fuel,
    powerMFps: pw,
    fuelLps: fl,
    torqueMT: n(o.torqueMT),
    blocks: { air: k(b.air, 1), exhaust: k(b.exhaust, 1), fuel: k(b.fuel, 1), generator: Math.max(1, k(b.generator, 1)), flywheel: k(b.flywheel, 0) },
  };
}

type Measure = { id: string; columns?: string[]; rows?: number[][]; value?: Record<string, number>; parts?: Record<string, number>; partsComplete?: boolean; sources: string[]; alternatives?: { value: unknown; sources: string[] }[] };

/** Configurations relevées du moteur diesel (Refined Diesel) : tableau du contrôleur (6 cylindres) et 32 cylindres. */
export function dieselConfigs(file: ModularFile, local: DieselReading[] = []): DieselConfig[] {
  const a = assembly(file, "diesel-engine") as (ModAssembly & { measurements?: Measure[]; readings?: unknown[] }) | undefined;
  const ms = a?.measurements ?? [];
  const easy = ms.find((m) => m.id === "easy-setup");
  const table = ms.find((m) => m.id === "air-fuel-6cyl");
  const big = ms.find((m) => m.id === "32-cylinders");
  // Blocs posés (S14) : au moins le minimum du wiki pour chaque bloc obligatoire (entrée d'air,
  // échappement, entrée de carburant : « au moins un »), et le moins de vilebrequins possible, un bloc
  // de côté par côté, contrôleur compris (la longueur ne change pas la puissance, réponse du 2026-10-18).
  const toParts = (p: Record<string, number> | undefined) => {
    const parts = { ...(p ?? {}) };
    for (const id of [DIESEL_IDS.air, DIESEL_IDS.exhaust, DIESEL_IDS.fuel]) {
      const min = asNum((blockFact(a, id, "count")?.value as { min?: unknown } | undefined)?.min);
      if (min !== null && (parts[id] ?? 0) < min) parts[id] = min;
    }
    const side = Object.entries(parts).filter(([id]) => ![DIESEL_IDS.controller, DIESEL_IDS.crankshaft, DIESEL_IDS.generator, DIESEL_IDS.flywheel].includes(id as never)).reduce((s, [, n]) => s + n, 0);
    parts[DIESEL_IDS.crankshaft] = crankshaftsFor(side);
    const order = [DIESEL_IDS.controller, DIESEL_IDS.crankshaft, DIESEL_IDS.flywheel, DIESEL_IDS.cylinder, DIESEL_IDS.air, DIESEL_IDS.exhaust, DIESEL_IDS.fuel, DIESEL_IDS.generator] as string[];
    return Object.entries(parts)
      .sort(([x], [y]) => (order.indexOf(x) + 99) % 99 - (order.indexOf(y) + 99) % 99)
      .map(([machine, count]) => ({ machine, count }));
  };
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
        note: "Tableau du contrôleur (Miraheze), Refined Diesel. Blocs du montage simple du wiki, posés au plus court (blocs de côté des deux côtés, contrôleur compris : moins de vilebrequins ; la longueur ne change pas la puissance). Accélérateur non écrit : supposé à 100 % (la ligne du rapport 16 est celle du montage simple à 100 %).",
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
      note: "Configuration la plus connue (Miraheze), Refined Diesel. Une entrée d'air, un échappement et une entrée de carburant (le minimum du wiki) : leur nombre réel est à relever en jeu. Vilebrequins d'après le plan de pose (un bloc de côté par côté).",
    });
  }
  // Relevés de configuration (S18) : ceux du dépôt, puis ceux du navigateur ; un relevé remplace la
  // configuration aux mêmes réglages et au même carburant (relevé en jeu d'abord).
  const readings = [...(a?.readings ?? []), ...local].map(parseDieselReading).filter((r): r is DieselReading => !!r);
  for (const r of readings) {
    const same = out.findIndex((c) => c.cylinders === r.cylinders && c.airFuel === r.airFuel && c.throttle === r.throttle && c.fuel === r.fuel);
    if (same >= 0) out.splice(same, 1);
    const p: Record<string, number> = { [DIESEL_IDS.controller]: 1, [DIESEL_IDS.cylinder]: r.cylinders, [DIESEL_IDS.air]: r.blocks.air, [DIESEL_IDS.exhaust]: r.blocks.exhaust, [DIESEL_IDS.fuel]: r.blocks.fuel, [DIESEL_IDS.generator]: r.blocks.generator, [DIESEL_IDS.flywheel]: r.blocks.flywheel };
    for (const k of Object.keys(p)) if (!p[k]) delete p[k];
    out.push({
      id: `moteur:releve:${r.id}`,
      label: `${r.cylinders} cylindres, rapport ${r.airFuel}, accélérateur ${r.throttle} %, ${dieselFuelName(r.fuel)}`,
      cylinders: r.cylinders,
      airFuel: r.airFuel,
      throttle: r.throttle,
      throttleAssumed: false,
      powerMFps: r.powerMFps,
      fuel: r.fuel,
      fuelLps: r.fuelLps,
      torqueMT: r.torqueMT,
      parts: toParts(p),
      partsComplete: true,
      sources: [],
      note: `Relevé en jeu${r.date ? ` du ${r.date}` : ""} (Info Panel) : puissance et consommation affichées, blocs posés comptés. Vilebrequins d'après le plan de pose (un bloc de côté par côté).`,
      reading: r.id,
    });
  }
  return out;
}

/** Litres de carburant par MMF : sert à comparer les configurations. */
export const dieselLitersPerMMF = (c: DieselConfig) => (c.fuelLps * 1e6) / c.powerMFps;

/** Critères du choix (réponse Q16) : meilleur rapport production/consommation, moins de place, meilleure production. */
export type DieselPickMode = "carburant" | "place" | "puissance";

/**
 * Configuration du moteur pour un plan (S18) : celle imposée si elle existe avec ce carburant, sinon
 * la meilleure selon le critère : le moins de carburant par MF/s, le moins de place (moteur posé) par
 * MF/s, ou la plus grande puissance par moteur. Seules les configurations relevées avec ce carburant
 * comptent (pas de rapport déduit, réponse Q16).
 */
export function dieselPick(configs: DieselConfig[], fuel: string, mode: DieselPickMode, forced: string | null, area: (c: DieselConfig) => number | null): DieselConfig | null {
  const ok = configs.filter((c) => c.fuel === fuel);
  const f = forced ? ok.find((c) => c.id === forced) : undefined;
  if (f) return f;
  const score = (c: DieselConfig) => {
    if (mode === "puissance") return -c.powerMFps;
    const v = mode === "carburant" ? c.fuelLps : area(c);
    return v === null ? Infinity : v / c.powerMFps;
  };
  return [...ok].sort((x, y) => score(x) - score(y) || dieselLitersPerMMF(x) - dieselLitersPerMMF(y) || x.id.localeCompare(y.id))[0] ?? null;
}

/** Configuration relevée correspondant aux réglages ; null : « à relever » (pas de formule, MOD-12). */
export function dieselLookup(configs: DieselConfig[], cylinders: number, airFuel: number, throttle: number, fuel = "refined-diesel"): DieselConfig | null {
  return configs.find((c) => c.cylinders === cylinders && c.airFuel === airFuel && c.throttle === throttle && c.fuel === fuel) ?? null;
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
export function applyModular(recipes: Map<string, Recipe>, machines: Map<string, Machine>, file: ModularFile, poles: FarmPole[] = [], readings: DieselReading[] = []): void {
  const rates = farmRates(file);
  const geometry = farmGeometry(file, machines, poles);
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
      r.setupNote = geometry
        ? `Blocs comptés d'après le plan de pose de la ferme : ${perSpr} arbres au plus par arroseur, ${perTank} arroseurs par réservoir, ${perHarv} arbres au plus par récolteur (guide Miraheze), une sortie à portée de chaque récolteur, un contrôleur par ferme (plusieurs fermes au-delà de ce que touche sa portée). Eau : ${rates.waterCycle.litersPerCycle} L toutes les ${String(rates.waterCycle.periodS).replace(".", ",")} s par arroseur ; électricité : ${rates.energyPerCutMF.value / 1000} kMF par arbre coupé.`
        : `Par arbre : 1/${perSpr} d'arroseur, 1/${perSpr * perTank} de réservoir, 1/${perHarv} de récolteur (guide Miraheze) ; 1 contrôleur et 1 sortie par ferme. Eau : ${rates.waterCycle.litersPerCycle} L toutes les ${String(rates.waterCycle.periodS).replace(".", ",")} s par arroseur ; électricité : ${rates.energyPerCutMF.value / 1000} kMF par arbre coupé.`;
      r.farm = { waterItem: "water", waterLpsPerTree: rates.waterLpsPerSprinkler.value / perSpr, energyPerCutMF: rates.energyPerCutMF.value, ...(geometry ? { geometry } : {}) };
      r.sources = [...r.sources, ...src];
      if (rates.treesPerHarvester.question) {
        r.verify = [...r.verify, { field: "parts", reason: "approximatif", detail: `${perHarv} arbres par récolteur d'après le guide Miraheze ; le maximum réel est à relever en jeu` }];
      }
    }
  }
  for (const c of dieselConfigs(file, readings)) {
    if (!c.parts.every((p) => machines.has(p.machine))) continue;
    const verify: VerifyFlag[] = [{ field: "pollutionPerHour", reason: "manquant", detail: "pollution de l'échappement selon la configuration inconnue" }];
    if (c.throttleAssumed) verify.push({ field: "energyMFps", reason: "approximatif", detail: "accélérateur non écrit par le tableau du contrôleur : supposé à 100 %" });
    if (!c.partsComplete) verify.push({ field: "parts", reason: "manquant", detail: "blocs autres que contrôleur, cylindres et générateur à relever en jeu : liste et prix incomplets" });
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
