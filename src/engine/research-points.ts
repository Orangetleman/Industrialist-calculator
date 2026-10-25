// Points de recherche (phase E3) : formules des stations (wiki), choix de l'installation et
// chronologie de déblocage. Pur : aucune dépendance au DOM.
//
// Formules (research-stations.json, chacune avec sa citation) :
//   RS1 : RP/s = √n ; plafond = 200·log₂(n+1)                         (n stations)
//   RS2 : RP/s = 2·V^0,6 ; plafond = 2000·log₂(m+1)                   (V = somme des valeurs de
//         recherche des items présents dans toutes les stations ; m stations)
//   RS3 : RP/s = 2·V^0,6 (V × 0,7 si les deux items sont identiques) ;
//         plafond = 16500·(log₂(C+1) + √C), C = m·(log₄(x/600)+1) si x ≥ 600, sinon m·log₂(x/600+1)
//         (x : prix de vente moyen des deux items)
//   RS4 (accrochée à une RS3, remplace son calcul) : même vitesse ; plafond = 150000·(log₂(C+1)+C^0,9)
//         avec C = (n + 2·m_logic)·(…) ; circuits Logic : plafond/40000 × n_logic × 6/t RP/s
//   Paraboles : + B × 0,78·log(R+1) (R : somme des valeurs des liquides) ; ⌈S + √(S·R)⌉ paraboles
//   Plafond souple : vitesse × 10^(1−x) (RS4 : 10^(1−√x)), x = max(RP/plafond, 1)

import { Chooser, type Criterion } from "./choose.ts";
import type { GameData } from "./data.ts";
import type { ResearchStationsFile } from "./extension-types.ts";
import { solve, type Plan, type PlayerState, type SolveRequest } from "./solve.ts";
import { machineAccess } from "./unlock.ts";
import { msg, type Message } from "./message.ts";

export type StationKind = "rs1" | "rs2" | "rs3" | "rs4";

/** Paramètres numériques des formules ; null si une valeur manque dans les données. */
export type RpParams = {
  rs1: { capCoef: number };
  rs2: { rateCoef: number; rateExp: number; capCoef: number; inputPerSec: number };
  rs3: { rateCoef: number; rateExp: number; capCoef: number; samePenalty: number; inputPerSecPerNode: number; threshold: number };
  rs4: { capCoef: number; capExp: number; logicWeight: number; circuitDivisor: number; circuitTicksPerSec: number; logicTicks: number };
  satellite: { boostCoef: number; liquidPerSec: number };
  power: Record<string, number>;
};

export function rpParams(f: ResearchStationsFile): RpParams | null {
  const v = <T>(x: { value: T | null } | undefined): T | null => x?.value ?? null;
  const n = [
    v(f.rs1.capCoef),
    v(f.rs2.rateCoef),
    v(f.rs2.rateExp),
    v(f.rs2.capCoef),
    v(f.rs2.inputPerSec),
    v(f.rs3.rateCoef),
    v(f.rs3.rateExp),
    v(f.rs3.capCoef),
    v(f.rs3.samePenalty),
    v(f.rs3.inputPerSecPerNode),
    v(f.rs3.factorThreshold),
    v(f.rs4.capCoef),
    v(f.rs4.capExp),
    v(f.rs4.logicWeight),
    v(f.rs4.circuitDivisor),
    v(f.rs4.circuitTicksPerSec),
    v(f.logicTicks),
    v(f.satellite.boostCoef),
    v(f.satellite.liquidPerSec),
  ];
  if (n.some((x) => x === null)) return null;
  const [a, b, c, d, e, g, h, i, j, k, l, m, o, p, q, r, s, t, u] = n as number[];
  return {
    rs1: { capCoef: a! },
    rs2: { rateCoef: b!, rateExp: c!, capCoef: d!, inputPerSec: e! },
    rs3: { rateCoef: g!, rateExp: h!, capCoef: i!, samePenalty: j!, inputPerSecPerNode: k!, threshold: l! },
    rs4: { capCoef: m!, capExp: o!, logicWeight: p!, circuitDivisor: q!, circuitTicksPerSec: r!, logicTicks: s! },
    satellite: { boostCoef: t!, liquidPerSec: u! },
    power: Object.fromEntries(Object.entries(f.power ?? {}).flatMap(([id, fact]) => (fact.value === null ? [] : [[id, fact.value]]))),
  };
}

const log4 = (x: number) => Math.log(x) / Math.log(4);

// ---------------------------------------------------------------- formules
export const rs1Rate = (n: number) => Math.sqrt(n);
export const rs1Cap = (p: RpParams, n: number) => p.rs1.capCoef * Math.log2(n + 1);
/** RS2 et RS3/RS4 : vitesse selon la somme des valeurs de recherche présentes. */
export const valueRate = (p: RpParams, sum: number) => (sum > 0 ? p.rs2.rateCoef * sum ** p.rs2.rateExp : 0);
export const rs2Cap = (p: RpParams, m: number) => p.rs2.capCoef * Math.log2(m + 1);
/** Facteur de plafond des RS3/RS4 : `count` stations (pondérées), prix de vente moyen x. */
export function capFactor(p: RpParams, count: number, avgPrice: number): number {
  const t = p.rs3.threshold;
  return count * (avgPrice >= t ? log4(avgPrice / t) + 1 : Math.log2(avgPrice / t + 1));
}
export const rs3Cap = (p: RpParams, C: number) => p.rs3.capCoef * (Math.log2(C + 1) + Math.sqrt(C));
export const rs4Cap = (p: RpParams, C: number) => p.rs4.capCoef * (Math.log2(C + 1) + C ** p.rs4.capExp);
/** RP/s des circuits du mini-jeu Logic (tant que les RP sont sous le plafond). */
export const circuitRate = (p: RpParams, cap: number, circuits: number) => (cap / p.rs4.circuitDivisor) * circuits * (p.rs4.circuitTicksPerSec / p.rs4.logicTicks);
/** Paraboles : multiplicateur ajouté à la production de base (log décimal), et paraboles nécessaires. */
export const satelliteBoost = (p: RpParams, R: number) => (R > 0 ? p.satellite.boostCoef * Math.log10(R + 1) : 0);
export const dishesNeeded = (S: number, R: number) => Math.ceil(S + Math.sqrt(S * R) - 1e-9);
/**
 * Un tier entier, vu par ses deux grandeurs additives (S20) : `value` (RS1 : nombre de stations ;
 * RS2 à RS4 : somme des valeurs de recherche V) et `factor` (RS1, RS2 : nombre de stations ; RS3,
 * RS4 : facteur C). Deux groupes du même tier s'additionnent sur ces grandeurs, pas sur les RP/s.
 */
export type TierSum = { value: number; factor: number };
export const tierRate = (p: RpParams, kind: StationKind, value: number) => (kind === "rs1" ? rs1Rate(value) : valueRate(p, value));
export function tierCap(p: RpParams, kind: StationKind, factor: number): number {
  if (kind === "rs1") return rs1Cap(p, factor);
  if (kind === "rs2") return rs2Cap(p, factor);
  return kind === "rs3" ? rs3Cap(p, factor) : rs4Cap(p, factor);
}
/** Grandeurs d'un tier retrouvées depuis le panneau (RP/s des stations et seuil) : inverses des formules. */
export function tierSumFromPanel(p: RpParams, kind: StationKind, stationsRate: number, cap: number): TierSum {
  const value = kind === "rs1" ? stationsRate ** 2 : stationsRate > 0 ? (stationsRate / p.rs2.rateCoef) ** (1 / p.rs2.rateExp) : 0;
  let factor = 0;
  if (Number.isFinite(cap) && cap > 0) {
    let lo = 0;
    let hi = 1;
    while (tierCap(p, kind, hi) < cap && hi < 1e12) hi *= 2;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (tierCap(p, kind, mid) < cap) lo = mid;
      else hi = mid;
    }
    factor = (lo + hi) / 2;
  }
  return { value, factor };
}

/** Plafond souple : facteur appliqué à la vitesse quand les RP dépassent le plafond. */
export function softCapFactor(rp: number, cap: number, kind: StationKind): number {
  const x = Math.max(rp / cap, 1);
  return 10 ** (1 - (kind === "rs4" ? Math.sqrt(x) : x));
}

// ---------------------------------------------------------------- installation
export type RpDesign = {
  kind: StationKind;
  /** Nombre de stations (RS4 : paires RS3 + RS4). */
  stations: number;
  /** Items par station : 0 (RS1), 1 (RS2) ou 2 (RS3/RS4). */
  items: string[];
  logic: boolean;
  satellites: { controllers: number; fluid: string; fluidValue: number; dishes: number } | null;
  /** RP/s : stations seules, paraboles en plus, circuits Logic en plus, total. */
  baseRate: number;
  boostRate: number;
  circuitRate: number;
  rate: number;
  cap: number;
  /** Consommation électrique des stations et paraboles (MF/s) et leur prix. */
  powerMFps: number;
  buildingCost: number;
  buildings: { machine: string; count: number }[];
  /** Items et liquides consommés (/min). */
  consumption: Record<string, number>;
};

export type RpRequest = {
  /** RP/s voulus. */
  targetRate: number;
  /** Plafond minimal (la recherche la plus chère à débloquer). */
  capNeeded: number;
  satellites: boolean;
  logic: boolean;
  criterion: Criterion;
  /** Critères suivants, dans l'ordre : ils départagent les solutions égales sur le premier. */
  then?: Criterion[];
  useUnverified?: boolean;
  selfPowered?: boolean;
  existing?: Record<string, number>;
  /** Stations autorisées (défaut : toutes celles débloquées). */
  kinds?: StationKind[];
  /**
   * Stations que le joueur a déjà, par tier (S20) : une installation du même tier s'y ajoute (vitesse
   * et seuil recalculés sur tout le tier, `baseRate` = le gain, `cap` = le seuil du tier entier).
   */
  base?: Partial<Record<StationKind, TierSum>>;
};

export type RpCandidate = { design: RpDesign; plan: Plan; score: number };
export type RpResult = { best: RpCandidate | null; others: RpCandidate[]; warnings: Message[] };

const STATION: Record<StationKind, string[]> = {
  rs1: ["research-station1"],
  rs2: ["research-station2"],
  rs3: ["research-station3"],
  rs4: ["research-station3", "research-station4"],
};

/** Valeur de recherche numérique (les plages « 1-300 » sont écartées). */
const researchValue = (data: GameData, id: string) => {
  const v = data.items.get(id)?.researchValue;
  return typeof v === "number" && v > 0 ? v : null;
};

/** Plus petit entier n ≥ 1 tel que ok(n), par doublement puis dichotomie (ok croissant). */
function smallest(ok: (n: number) => boolean, max = 1e7): number | null {
  let hi = 1;
  while (!ok(hi)) {
    hi *= 2;
    if (hi > max) return null;
  }
  let lo = Math.floor(hi / 2);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return ok(lo) && lo >= 1 ? lo : hi;
}

/** Évaluation d'une installation : vitesse et plafond pour `n` stations. */
export function evaluateStations(
  p: RpParams,
  kind: StationKind,
  n: number,
  items: string[],
  data: GameData,
  logic: boolean,
  base?: TierSum | null,
): { base: number; circuits: number; cap: number } {
  const own = groupSum(p, kind, n, items, data, logic);
  // Stations ajoutées à celles du joueur (S20) : le tier se recalcule en entier ; `base` = le gain.
  const value = own.value + (base?.value ?? 0);
  const cap = tierCap(p, kind, own.factor + (base?.factor ?? 0));
  const rate = tierRate(p, kind, value) - (base ? tierRate(p, kind, base.value) : 0);
  return { base: rate, circuits: kind === "rs4" && logic ? circuitRate(p, cap, n) : 0, cap };
}

/** Grandeurs additives de `n` stations identiques (items, mini-jeu Logic pour la RS4). */
export function groupSum(p: RpParams, kind: StationKind, n: number, items: string[], data: GameData, logic: boolean): TierSum {
  if (kind === "rs1") return { value: n, factor: n };
  const vals = items.map((i) => researchValue(data, i) ?? 0);
  if (kind === "rs2") return { value: n * (vals[0] ?? 0), factor: n };
  const same = items[0] === items[1];
  const value = n * ((vals[0] ?? 0) + (vals[1] ?? 0)) * (same ? 1 - p.rs3.samePenalty : 1);
  const price = items.reduce((s, i) => s + (data.items.get(i)?.sellValue ?? 0), 0) / Math.max(1, items.length);
  return { value, factor: price > 0 ? capFactor(p, kind === "rs4" && logic ? n * p.rs4.logicWeight : n, price) : 0 };
}

function designFor(p: RpParams, data: GameData, kind: StationKind, items: string[], logic: boolean, sat: RpDesign["satellites"], req: RpRequest): RpDesign | null {
  const boost = sat ? satelliteBoost(p, sat.controllers * sat.fluidValue) : 0;
  const n = smallest((k) => {
    const e = evaluateStations(p, kind, k, items, data, logic, req.base?.[kind]);
    return e.base * (1 + boost) + e.circuits >= req.targetRate - 1e-9 && e.cap >= req.capNeeded - 1e-9;
  });
  if (n === null) return null;
  const e = evaluateStations(p, kind, n, items, data, logic, req.base?.[kind]);
  const perStation =
    kind === "rs2" ? { [items[0]!]: p.rs2.inputPerSec * 60 } : kind === "rs1" ? {} : Object.fromEntries(items.map((i) => [i, 0] as [string, number]));
  const consumption: Record<string, number> = {};
  if (kind === "rs2") consumption[items[0]!] = n * perStation[items[0]!]!;
  if (kind === "rs3" || kind === "rs4") for (const i of items) consumption[i] = (consumption[i] ?? 0) + n * p.rs3.inputPerSecPerNode * 60;
  if (sat) consumption[sat.fluid] = (consumption[sat.fluid] ?? 0) + sat.controllers * p.satellite.liquidPerSec * 60;
  const buildings: RpDesign["buildings"] = STATION[kind].map((m) => ({ machine: m, count: n }));
  if (sat) buildings.push({ machine: "satellite-dish-controller", count: sat.controllers }, { machine: "satellite-dish", count: sat.dishes });
  // RS4 : la consommation de la paire est celle de la RS4 (« increases power consumption to 5 MMF/s »).
  const stationPower = kind === "rs4" ? (p.power["research-station4"] ?? 0) : (p.power[STATION[kind][0]!] ?? 0);
  const powerMFps = n * stationPower + (sat ? (sat.controllers * (p.power["satellite-dish-controller"] ?? 0) + sat.dishes * (p.power["satellite-dish"] ?? 0)) : 0);
  const buildingCost = buildings.reduce((s, b) => s + b.count * (data.machines.get(b.machine)?.cost ?? 0), 0);
  return {
    kind,
    stations: n,
    items,
    logic: kind === "rs4" && logic,
    satellites: sat,
    baseRate: e.base,
    boostRate: e.base * boost,
    circuitRate: e.circuits,
    rate: e.base * (1 + boost) + e.circuits,
    cap: e.cap,
    powerMFps,
    buildingCost,
    buildings,
    consumption,
  };
}

/**
 * Meilleure installation pour atteindre `targetRate` RP/s avec un plafond ≥ `capNeeded` :
 * toutes les stations débloquées, les items et paires d'items productibles, avec ou sans
 * paraboles. Un premier tri utilise le coût estimé de la chaîne (choix heuristique) ; les
 * meilleures installations sont ensuite calculées exactement par le simplexe.
 */
export function designResearch(data: GameData, player: PlayerState, p: RpParams, req: RpRequest): RpResult {
  const warnings: Message[] = [];
  const chooser = new Chooser(data, player, { criterion: req.criterion, then: req.then, forced: {}, useUnverified: !!req.useUnverified, pollutionPct: player.pollutionPct ?? null });
  const available = (kind: StationKind) => STATION[kind].every((m) => machineAccess(data, player, m).available);
  const kinds = (req.kinds ?? (["rs1", "rs2", "rs3", "rs4"] as StationKind[])).filter(available);
  if (!kinds.length) return { best: null, others: [], warnings: [msg("rs.noStation")] };

  // Coût estimé d'une unité/min de chaque item productible (heuristique, rapide).
  const unitCost = new Map<string, number>();
  const costOf = (id: string): number | null => {
    if (unitCost.has(id)) return unitCost.get(id)!;
    const c = chooser.choose(id);
    const v = c.eff && !c.cost.unresolved ? (req.criterion === "energy" ? c.cost.energy / 1000 : req.criterion === "raw" ? c.cost.raw : c.cost.machines) : null;
    if (v !== null) unitCost.set(id, v);
    return v;
  };
  const solids = [...data.items.values()].filter((i) => i.isFluid === false && researchValue(data, i.id) !== null && costOf(i.id) !== null).map((i) => i.id);
  const fluids = [...data.items.values()].filter((i) => i.isFluid === true && researchValue(data, i.id) !== null && costOf(i.id) !== null).map((i) => i.id);

  // Coût exact d'une unité/min selon le critère (simplexe, machines fractionnaires), pour les items présélectionnés.
  const metricOf = (plan: Plan, extra: { buildings: number; cost: number; power: number }) => {
    const exact = (k: "cost" | "area") => plan.steps.reduce((s, x) => s + x.machinesExact * ((k === "cost" ? x.unitCost : x.area) ?? 0), 0);
    switch (req.criterion) {
      case "energy":
        return plan.totals.energyAvg + extra.power;
      case "cost":
        return exact("cost") + extra.cost;
      case "pollution":
        return plan.steps.reduce((s, x) => s + (typeof x.pollutionPerHour === "number" ? x.pollutionPerHour / Math.max(1, x.machines) : 0) * x.machinesExact, 0);
      case "area":
        return exact("area");
      case "raw":
        return plan.raw.reduce((s, r) => s + r.perMin, 0);
      default:
        return plan.steps.reduce((s, x) => s + x.machinesExact, 0) + extra.buildings;
    }
  };
  const lpUnit = new Map<string, number>();
  const unitOf = (id: string): number => {
    if (!lpUnit.has(id)) {
      const pl = solve(data, player, { item: id, ratePerMin: 1, criterion: req.criterion, then: req.then, useUnverified: req.useUnverified, existing: req.existing, tiers: false });
      lpUnit.set(id, pl.status === "ok" ? metricOf(pl, { buildings: 0, cost: 0, power: 0 }) : 1e12);
    }
    return lpUnit.get(id)!;
  };
  const proxy = (d: RpDesign) => {
    const chain = Object.entries(d.consumption).reduce((s, [i, q]) => s + unitOf(i) * q, 0);
    const buildings = d.buildings.reduce((s, b) => s + b.count, 0);
    return chain + (req.criterion === "energy" ? d.powerMFps : req.criterion === "cost" ? d.buildingCost : req.criterion === "machines" || req.criterion === "steps" ? buildings : 0);
  };

  const candidates: RpDesign[] = [];
  const push = (d: RpDesign | null) => {
    if (d) candidates.push(d);
  };
  // Paraboles : le meilleur liquide (valeur de recherche / coût), 1 à 4 contrôleurs.
  const fluid = fluids.sort((a, b) => (costOf(a)! + 0.01) / researchValue(data, a)! - (costOf(b)! + 0.01) / researchValue(data, b)!)[0];
  const satOptions: RpDesign["satellites"][] = [null];
  if (req.satellites && fluid && machineAccess(data, player, "satellite-dish-controller").available && machineAccess(data, player, "satellite-dish").available) {
    const r = researchValue(data, fluid)!;
    for (const S of [1, 2, 3, 4]) satOptions.push({ controllers: S, fluid, fluidValue: r, dishes: dishesNeeded(S, S * r) });
  } else if (req.satellites) warnings.push(msg("rs.noDish"));

  // Items candidats : les meilleurs rapports valeur / coût, et les plus chers (plafond des RS3/RS4).
  const byValue = [...solids].sort((a, b) => (costOf(a)! + 0.01) / researchValue(data, a)! - (costOf(b)! + 0.01) / researchValue(data, b)!).slice(0, 10);
  const byPrice = [...solids].sort((a, b) => (data.items.get(b)!.sellValue ?? 0) - (data.items.get(a)!.sellValue ?? 0)).slice(0, 6);
  const pool = [...new Set([...byValue, ...byPrice])];
  for (const sat of satOptions) {
    for (const kind of kinds) {
      if (kind === "rs1") push(designFor(p, data, kind, [], false, sat, req));
      else if (kind === "rs2") for (const i of byValue) push(designFor(p, data, kind, [i], false, sat, req));
      else {
        for (let a = 0; a < pool.length; a++) {
          for (let b = a; b < pool.length; b++) {
            const pair = [pool[a]!, pool[b]!];
            push(designFor(p, data, kind, pair, false, sat, req));
            if (kind === "rs4" && req.logic) push(designFor(p, data, kind, pair, true, sat, req));
          }
        }
      }
    }
  }
  if (!candidates.length) return { best: null, others: [], warnings: [...warnings, msg("rs.none")] };

  // Calcul exact des meilleures installations estimées.
  candidates.sort((a, b) => proxy(a) - proxy(b));
  const seen = new Set<string>();
  const top = candidates.filter((d) => {
    const k = `${d.kind}|${d.items.join("+")}|${d.logic}|${d.satellites?.controllers ?? 0}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 6);
  const evaluated: RpCandidate[] = top.map((design) => {
    const plan = solve(data, player, {
      item: "",
      demands: design.consumption,
      criterion: req.criterion,
      then: req.then,
      useUnverified: req.useUnverified,
      selfPowered: req.selfPowered,
      existing: req.existing,
      extraLoadMFps: design.powerMFps,
      tiers: false,
    } satisfies SolveRequest);
    const buildings = design.buildings.reduce((s, b) => s + b.count, 0);
    // Score réel : machines arrondies, prix et énergie de la chaîne, plus ceux des stations.
    const score =
      plan.status === "ok" || design.kind === "rs1"
        ? req.criterion === "energy"
          ? plan.totals.energyAvg
          : req.criterion === "cost"
            ? plan.totals.buildCost + design.buildingCost
            : req.criterion === "pollution"
              ? plan.totals.pollutionPerHour[1]
              : req.criterion === "area"
                ? plan.totals.footprint + design.buildings.reduce((s, b) => s + b.count * ((data.machines.get(b.machine)?.size?.w ?? 0) * (data.machines.get(b.machine)?.size?.l ?? 0)), 0)
                : plan.totals.machines + plan.totals.farms + buildings
        : Infinity;
    return { design, plan, score };
  });
  evaluated.sort((a, b) => a.score - b.score || a.design.buildingCost - b.design.buildingCost);
  return { best: evaluated[0] ?? null, others: evaluated.slice(1), warnings };
}

// ---------------------------------------------------------------- chronologie
export type TimelineEntry = { node: string; rp: number; at: number; overCap: boolean };

/**
 * Temps pour débloquer des recherches dans l'ordre, à `rate` RP/s, en partant de `rp0` RP. Au-delà
 * du plafond, la vitesse baisse (plafond souple) : intégration numérique. Chaque déblocage dépense
 * son coût. `cap` = Infinity si inconnu.
 */
export function unlockTimeline(nodes: { id: string; rp: number }[], rp0: number, rate: number, cap: number, kind: StationKind): TimelineEntry[] | null {
  if (!(rate > 0)) return null;
  const timeTo = (a: number, b: number): number => {
    if (b <= a) return 0;
    if (b <= cap) return (b - a) / rate;
    const below = Math.max(0, Math.min(b, cap) - a) / rate;
    const from = Math.max(a, cap);
    const steps = 200;
    const h = (b - from) / steps;
    let sum = 0;
    for (let i = 0; i <= steps; i++) {
      const w = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
      sum += w / (rate * softCapFactor(from + i * h, cap, kind));
    }
    return below + (sum * h) / 3;
  };
  let t = 0;
  let rp = rp0;
  const out: TimelineEntry[] = [];
  for (const n of nodes) {
    t += timeTo(rp, n.rp);
    rp = Math.max(rp, n.rp) - n.rp;
    out.push({ node: n.id, rp: n.rp, at: t, overCap: n.rp > cap });
  }
  return out;
}
