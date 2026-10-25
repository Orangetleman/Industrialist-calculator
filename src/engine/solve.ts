// Résolution d'une chaîne de production (moteur v2) : le simplexe choisit les recettes et leurs
// quantités ; le nombre de machines reste un arrondi explicable, étape par étape.
// Ressources unifiées (objets, énergie, pollution, argent), sous-produits réutilisés, boucles
// gérées par le bilan. Le moteur v1 (heuristique) explique les alternatives de chaque item,
// sert au critère « moins d'étapes » (non linéaire) et de repli si le simplexe échoue.
// Pur : aucune dépendance au DOM. Le résultat (Plan) est sérialisable.

import { farmCounts } from "./build/assembly.ts";
import { Chooser, ratePerMachine, type Candidate, type Criterion, type LeafReason } from "./choose.ts";
import { itemName, type GameData } from "./data.ts";
import { optimize } from "./optimize.ts";
import type { TreeGrowthResult } from "./pollution.ts";
import { excludedMachines, excludedMessage, type MachineFilter } from "./machine-filter.ts";
import { buildFlowModel, ENERGY, POLLUTION, type DepotSpec, type FlowModel, type RecipeProc } from "./resources.ts";
import { solveV1, unresolvedWhy, type PlanV1 } from "./solve-v1.ts";
import { roundTiers, type Tier } from "./tiers.ts";
import type { VerifyFlag } from "./types.ts";
import { machineAccess, orderByDepth, rpCost, type MachineAccess, type Progress, type ReqItem } from "./unlock.ts";
import { msg, type Message } from "./message.ts";

export type PlayerState = Progress & {
  pollutionPct?: number | null;
  money?: number | null;
  rp?: number | null;
  rpPerSec?: number | null;
};

export type SolveRequest = {
  item: string;
  /** Débit voulu, par minute. */
  ratePerMin?: number;
  /** Ou : nombre de machines pour l'étape finale. */
  finalMachines?: number;
  /** Objectif argent : $ par minute (l'item est alors ignoré). */
  moneyPerMin?: number;
  /** Plusieurs cibles à la fois (item → /min), ex. les items des stations de recherche. */
  demands?: Record<string, number>;
  /** Charge électrique fixe en plus de la chaîne (stations de recherche…), en MF/s. */
  extraLoadMFps?: number;
  /** Objectif énergie : MF/s à fournir (l'item est alors ignoré). */
  energyMFps?: number;
  /** Énergie : seulement des sources à production constante (nuit et vent faible compris). */
  guaranteedEnergy?: boolean;
  /** Énergie : sans combustible (solaire, éolien… ; l'eau n'est pas un combustible). */
  noFuel?: boolean;
  /** Moteur diesel du plan (S18) : id de la configuration choisie ; les autres moteurs diesel sont écartés. */
  diesel?: string | null;
  /** Poteaux de transport (power.json) et distance à couvrir, en cases, pour le réseau. */
  poles?: PoleSpec[];
  distanceTiles?: number | null;
  criterion?: Criterion;
  /** Critères suivants, dans l'ordre : ils départagent les solutions égales sur le premier. */
  then?: Criterion[];
  forced?: Record<string, string>;
  useUnverified?: boolean;
  /** La chaîne produit sa propre énergie avec les générateurs débloqués. */
  selfPowered?: boolean;
  /** Pollution maximale de la chaîne (%/h). */
  maxPollution?: number | null;
  /** Budget de construction ($). */
  budget?: number | null;
  /** Dépôts de vente (logistics.json), pour l'objectif argent. */
  depots?: DepotSpec[];
  /** Production déjà en place (/min par item) : utilisée avant de construire quoi que ce soit. */
  existing?: Record<string, number>;
  /** Calculer les paliers ronds (défaut : oui). */
  tiers?: boolean;
  /**
   * Nombre de machines imposé à des étapes (clé d'étape → nombre), réglé dans le schéma (S8) :
   * les recettes restent celles du plan, et le débit devient le plus grand que ces machines
   * permettent. Les autres étapes s'adaptent ; la plus contraignante décide.
   */
  fixedMachines?: Record<string, number>;
  /** Seulement ces recettes pour les objets qu'elles produisent (les autres objets restent libres). */
  onlyRecipes?: string[];
  /** Filtre de machines du plan (S9) : écarter des machines, ou n'utiliser que certaines. */
  machines?: MachineFilter | null;
};

export type Flow = { item: string; perMin: number };
/** Flux entre deux étapes (clés d'étape), pour un item donné ; `loop` : arc de retour d'une boucle. */
export type Edge = { from: string; to: string; item: string; perMin: number; loop?: boolean };

export type Step = {
  /** Identifiant de l'étape : l'item, ou « item@recette » quand plusieurs recettes le produisent. */
  key: string;
  item: string;
  recipeId: string;
  machine: string;
  machineKind: "machine" | "farm";
  forced: boolean;
  /** Profondeur depuis la cible (0 = item final). */
  depth: number;
  durationS: number;
  /** Production nette de l'item par cycle. */
  outputPerCycle: number;
  ratePerMachine: number;
  demandPerMin: number;
  machinesExact: number;
  machines: number;
  utilization: number;
  inputs: Flow[];
  consumers: Flow[];
  byproducts: Flow[];
  energyMFps: number | null;
  energyAvg: number | null;
  energyPeak: number | null;
  area: number | null;
  footprint: number | null;
  unitCost: number | null;
  buildCost: number | null;
  pollutionPerHour: number | [number, number] | null;
  isRaw: boolean;
  usesUnverified: boolean;
  verify: VerifyFlag[];
  machineVerify: VerifyFlag[];
  access: MachineAccess;
  growth?: TreeGrowthResult;
  /** Autres recettes possibles pour cet item (pour « forcer une recette »). */
  alternatives: Candidate[];
  /** Installation composée (énergie) : ses machines, en nombre exact et arrondi. */
  parts?: StepPart[];
};

export type Unresolved = {
  item: string;
  perMin: number;
  reason: LeafReason;
  /** L'item est produit ailleurs dans la chaîne : seule une partie manque (boucle). */
  loopShortfall: boolean;
  /** Option de déblocage la moins chère, si l'item est verrouillé. */
  unlock?: Extract<MachineAccess, { available: false }> & { recipeId: string };
  /** Machines écartées par le filtre (S9) qui le fabriqueraient. */
  excluded?: string[];
  candidates: Candidate[];
};

export type Surplus = { item: string; perMin: number; from: string[]; alsoDemanded: boolean };

/** Avertissement du calcul : `code` le range (bloquant ou non…), `message` se traduit (S32). */
export type Warning = { code: string; message: Message; items?: string[] };

export type VerifyEntry = {
  scope: "recette" | "machine";
  id: string;
  item: string;
  flag: VerifyFlag;
  /** true : la valeur sert dans le calcul ; false : elle concerne une recette écartée. */
  used: boolean;
};

export type Economy = {
  buildCost: number;
  buildCostUnknown: number;
  money: number | null;
  moneyMissing: number | null;
  /** Nœuds à débloquer pour tout ce qui est verrouillé dans la chaîne (option la moins chère). */
  nodesToUnlock: string[];
  reqItems: ReqItem[];
  rpNeeded: number;
  rp: number | null;
  rpMissing: number | null;
  rpPerSec: number | null;
  secondsToRp: number | null;
  machinesToOwn: string[];
};

/** Production existante du joueur : disponible et réellement utilisée par le plan (/min). */
export type ExistingUse = { item: string; key: string; available: number; used: number };
/** Poteau de transport d'énergie : débit par nœud (MF/s), nœuds, portée (cases). */
export type PoleSpec = { id: string; name: string; perNodeMFps: number; nodes: number; rangeTiles: number | null };
/** Réseau : pour chaque type de poteau débloqué, combien de lignes et de poteaux. */
export type Distribution = {
  mfps: number;
  distanceTiles: number | null;
  options: { id: string; name: string; perNodeMFps: number; lines: number; polesPerLine: number | null; poles: number | null; cost: number | null }[];
};
/** Machine d'une installation composée, dans une étape : nombre exact et arrondi. */
/** `perFarm` : une fois par installation (contrôleur et sortie d'une ferme d'arbres). */
export type StepPart = { machine: string; exact: number; count: number; perFarm?: boolean };
export type Sale = { item: string; perMin: number; price: number; revenuePerMin: number };
export type DepotUse = { id: string; name: string; machinesExact: number; machines: number; itemsPerMin: number; unitCost: number | null };

export type Plan = {
  status: "ok" | "partiel" | "impossible";
  /** Moteur qui a produit le résultat. */
  engine: "simplexe" | "heuristique";
  /** `ratePerMin` : objets/min, $/min (argent) ou MF/s (énergie). */
  target: { kind: "objet" | "argent" | "énergie"; item: string; ratePerMin: number; finalMachines: number | null };
  criterion: Criterion;
  steps: Step[];
  /** Clés des étapes qui produisent l'objectif (item final, ou objets vendus). */
  finals: string[];
  edges: Edge[];
  raw: Flow[];
  unresolved: Unresolved[];
  surplus: Surplus[];
  sales: Sale[];
  depots: DepotUse[];
  /** Réseau électrique (objectif énergie, ou chaîne autonome) : poteaux nécessaires. */
  distribution: Distribution | null;
  /** Productions existantes du joueur que le plan utilise. */
  existing: ExistingUse[];
  totals: {
    machines: number;
    farms: number;
    depots: number;
    energyAvg: number;
    energyPeak: number;
    /** Énergie produite par les générateurs de la chaîne (autonomie), en moyenne. */
    energyProduced: number;
    energyUnknownSteps: number;
    footprint: number;
    footprintUnknownSteps: number;
    buildCost: number;
    buildCostUnknownSteps: number;
    pollutionPerHour: [number, number];
    pollutionUnknownSteps: number;
    revenuePerMin: number;
  };
  constraints: { maxPollution: number | null; budget: number | null; selfPowered: boolean };
  verify: VerifyEntry[];
  warnings: Warning[];
  economy: Economy;
  /** Débits « ronds » : chaque étape tombe sur un nombre entier de machines (ou presque). */
  tiers: Tier[];
  /** Machines fixées dans le schéma (S8) : débit obtenu, étape qui limite, utilisation de chacune. */
  fixed?: FixedResult;
};

/** Une étape au nombre de machines fixé : `exact` machines suffiraient, `planMachines` sans réglage. */
export type FixedStep = { key: string; recipeId: string; machines: number; planMachines: number; exact: number; utilization: number };
export type FixedResult = {
  /** Débit obtenu, et celui du calcul sans réglage (même unité que `target.ratePerMin`). */
  rate: number;
  baseRate: number;
  /** Clé de l'étape qui limite ; null si c'est une autre contrainte (budget, pollution) ou rien. */
  limit: string | null;
  /** « machines » : une étape fixée limite ; « contrainte » : le budget ou la pollution ; « aucune » : rien n'a pu être fixé. */
  reason: "machines" | "contrainte" | "aucune";
  /** La production déjà en place sert d'abord : le débit n'est plus proportionnel aux machines. */
  existingUsed: boolean;
  steps: FixedStep[];
  /** Clés demandées absentes du plan ou non réglables (installation composée). */
  ignored: string[];
};

const ceilTol = (x: number) => Math.ceil(x - 1e-9);
/** Nombre pour les messages : deux décimales au plus, virgule décimale. */
/** Nombre pour les messages : deux décimales au plus. */
const fmtNum = (x: number) => Math.round(x * 100) / 100;

export function solve(data: GameData, player: PlayerState, req: SolveRequest): Plan {
  const fixed = Object.entries(req.fixedMachines ?? {}).filter(([, n]) => Number.isFinite(n) && n >= 1);
  if (fixed.length && req.demands === undefined) return solveFixed(data, player, req, fixed);
  return solveInner(data, player, req, false);
}

/** La même demande à un autre débit, quel que soit l'objectif (objet /min, argent $/min, énergie MF/s). */
function withRate(req: SolveRequest, rate: number): SolveRequest {
  const { fixedMachines: _f, finalMachines: _m, ...rest } = req;
  if (req.moneyPerMin !== undefined) return { ...rest, moneyPerMin: rate };
  if (req.energyMFps !== undefined) return { ...rest, energyMFps: rate };
  return { ...rest, ratePerMin: rate };
}

/**
 * Machines fixées (S8). Le plan sans réglage donne les recettes ; on cherche ensuite le plus grand
 * débit pour lequel chaque étape fixée a assez de machines. Sans production existante, le nombre
 * exact de machines est proportionnel au débit : la règle de trois tombe juste du premier coup.
 * Sinon (production existante, budget, pollution), recherche par encadrement : fausse position
 * quand les deux bornes sont calculables, dichotomie sinon.
 */
function solveFixed(data: GameData, player: PlayerState, req: SolveRequest, wanted: [string, number][]): Plan {
  const { fixedMachines: _f, ...plain } = req;
  const base = solveInner(data, player, plain, false);
  const baseRate = base.target.ratePerMin;
  const fixable: { key: string; recipeId: string; n: number; planMachines: number }[] = [];
  const ignored: string[] = [];
  for (const [key, n] of wanted) {
    const st = base.steps.find((s) => s.key === key);
    // Arbres réglables (décision S8) même devenus ferme (S13) : on fixe le nombre d'arbres.
    if (st && (!st.parts || st.machineKind === "farm")) fixable.push({ key, recipeId: st.recipeId, n: Math.round(n), planMachines: st.machines });
    else ignored.push(key);
  }
  const none = (plan: Plan): Plan => ({ ...plan, fixed: { rate: plan.target.ratePerMin, baseRate, limit: null, reason: "aucune", existingUsed: false, steps: [], ignored } });
  if (!fixable.length || base.engine !== "simplexe" || base.status === "impossible" || !(baseRate > 0)) return none(base);

  const only = [...new Set(base.steps.map((s) => s.recipeId))];
  const floor = new Map(fixable.map((f) => [f.recipeId, f.n]));
  const at = (rate: number) => solveInner(data, player, { ...withRate(req, rate), onlyRecipes: only, tiers: false }, false, floor);
  const exactOf = (p: Plan, rid: string) => p.steps.filter((s) => s.recipeId === rid).reduce((t, s) => t + s.machinesExact, 0);
  /** Charge de l'étape fixée la plus chargée, moins 1 (0 : ses machines sont toutes utilisées). */
  const excess = (p: Plan) => Math.max(...fixable.map((f) => exactOf(p, f.recipeId) / f.n)) - 1;
  const blocked = (p: Plan) => p.engine !== "simplexe" || p.status === "impossible" || p.warnings.some((w) => w.code === "contrainte-budget" || w.code === "contrainte-pollution");

  // Encadrement : `lo` est possible (meilleur plan trouvé), `hi` ne l'est pas. g = excès de charge.
  let best: Plan | null = null;
  let lo = 0;
  let gLo = -1;
  let hi = Infinity;
  let gHi: number | null = null;
  const g0 = excess(base);
  let guess = g0 > -1 ? baseRate / (g0 + 1) : baseRate;
  for (let i = 0; i < 60; i++) {
    const p = at(guess);
    const g = blocked(p) ? null : excess(p);
    if (g !== null && g <= 1e-7) {
      if (guess >= lo) [lo, gLo, best] = [guess, g, p];
    } else if (guess < hi) [hi, gHi] = [guess, g];
    if (best && gLo >= -1e-6) break;
    if (hi === Infinity) {
      // Pas encore de borne haute : règle de trois depuis la borne basse (×2 si rien n'y est chargé).
      guess = gLo > -0.999 ? (lo / (gLo + 1)) * (1 + 1e-6) : lo * 2;
      continue;
    }
    if (hi - lo <= 1e-6 * hi) break;
    // Fausse position si les deux bornes sont calculables (une fois sur trois : dichotomie).
    guess = gHi !== null && i % 3 !== 2 ? lo + ((hi - lo) * -gLo) / (gHi - gLo) : (lo + hi) / 2;
    if (!(guess > lo && guess < hi)) guess = (lo + hi) / 2;
  }
  if (!best) return none({ ...base, warnings: [...base.warnings, { code: "machines-fixées", message: msg("plan.fixedNone") }] });
  const plan: Plan = best;
  const steps: FixedStep[] = fixable.map((f) => {
    const exact = exactOf(plan, f.recipeId);
    const key = plan.steps.find((s) => s.recipeId === f.recipeId)?.key ?? f.key;
    return { key, recipeId: f.recipeId, machines: f.n, planMachines: f.planMachines, exact, utilization: exact / f.n };
  });
  const top = steps.reduce((a, b) => (b.utilization > a.utilization ? b : a));
  const byMachines = top.utilization >= 1 - 1e-4;
  plan.target = { ...plan.target, finalMachines: null };
  plan.fixed = { rate: plan.target.ratePerMin, baseRate, limit: byMachines ? top.key : null, reason: byMachines ? "machines" : "contrainte", existingUsed: plan.existing.some((x) => x.used > 0), steps, ignored };
  return plan;
}

function solveInner(data: GameData, player: PlayerState, req: SolveRequest, nested: boolean, floor?: Map<string, number>): Plan {
  const criterion = req.criterion ?? "machines";
  const moneyMode = req.moneyPerMin !== undefined;
  const energyMode = !moneyMode && req.energyMFps !== undefined;
  const multi = !moneyMode && !energyMode && req.demands !== undefined;
  const demands = new Map(Object.entries(req.demands ?? {}).filter(([, v]) => v > 0));
  const noItem = moneyMode || energyMode || multi;
  const extraLoad = Math.max(0, req.extraLoadMFps ?? 0);
  const chooser = new Chooser(data, player, {
    criterion,
    then: req.then,
    forced: req.forced ?? {},
    useUnverified: !!req.useUnverified,
    pollutionPct: player.pollutionPct ?? null,
    machines: req.machines,
  });
  const name = (id: string) => (id === ENERGY ? "Énergie" : itemName(data, id));
  const warnings: Warning[] = [];
  if (!noItem && !data.items.has(req.item)) warnings.push({ code: "item-inconnu", message: msg("plan.unknownItem", { item: req.item }), items: [req.item] });

  // Critère « moins d'étapes » : ce n'est pas une quantité linéaire ; l'heuristique choisit une
  // recette par item, le simplexe calcule ensuite les quantités (sous-produits compris).
  // Recettes imposées (S8) : pour un objet que l'une d'elles produit, seulement celles-là.
  const onlySet = req.onlyRecipes ? new Set(req.onlyRecipes) : null;
  const onlyFor = (item: string): string[] | null => {
    if (!onlySet) return null;
    const ids = chooser.usableFor(item).map((e) => e.recipe.id).filter((id) => onlySet.has(id));
    return ids.length ? ids : null;
  };
  const restrictTo =
    criterion === "steps"
      ? (item: string) => {
          const c = chooser.choose(item);
          return onlyFor(item) ?? (c.eff ? [c.eff.recipe.id] : []);
        }
      : onlySet
        ? onlyFor
        : undefined;
  const model = buildFlowModel(data, player, chooser, {
    targets: multi ? [...demands.keys()] : noItem ? [] : [req.item],
    money: moneyMode,
    selfPowered: energyMode || !!req.selfPowered,
    guaranteedOnly: energyMode && !!req.guaranteedEnergy,
    noFuel: energyMode && !!req.noFuel,
    diesel: req.diesel ?? null,
    scrubbers: criterion === "pollution" || req.maxPollution != null,
    restrictTo,
    depots: req.depots,
  });

  // Débit cible ; « N machines finales » : débit pour lequel l'étape finale compte N machines.
  let ratePerMin = moneyMode ? req.moneyPerMin! : energyMode ? req.energyMFps! : (req.ratePerMin ?? 0);
  // Choix de l'heuristique (une recette par item) : candidat de comparaison pour les critères
  // comptés en machines entières, pour ne jamais faire moins bien que le moteur v1.
  const preferred =
    !energyMode && (criterion === "machines" || criterion === "cost" || criterion === "pollution")
      ? new Set([...model.items].flatMap((i) => (model.usable.get(i)?.length ? [chooser.choose(i).eff?.recipe.id ?? ""] : [])))
      : undefined;
  const run = (rate: number) =>
    optimize(model, {
      criterion,
      then: req.then,
      demand: multi ? demands : noItem ? new Map() : new Map([[req.item, rate]]),
      moneyPerMin: moneyMode ? rate : null,
      selfPowered: energyMode || !!req.selfPowered,
      ...(energyMode ? { energyTarget: rate + extraLoad } : req.selfPowered && extraLoad ? { energyTarget: extraLoad } : {}),
      maxPollution: req.maxPollution ?? null,
      budget: req.budget ?? null,
      preferred,
      existing: new Map(Object.entries(req.existing ?? {})),
    });
  if (!noItem && req.finalMachines !== undefined) {
    const unit = run(1);
    const perUnit = unit.status === "ok" ? [...unit.machines].filter(([id]) => (model.recipes.find((p) => p.id === id)?.perMin[req.item] ?? 0) > 0).reduce((s, [, x]) => s + x, 0) : 0;
    if (perUnit > 0) ratePerMin = req.finalMachines / perUnit;
    else warnings.push({ code: "machines-finales", message: msg("plan.finalMachines", { n: req.finalMachines, item: name(req.item) }) });
  }
  let depotUnlock: Extract<MachineAccess, { available: false }> | null = null;
  if (moneyMode && !model.depots.length) {
    // Le dépôt le moins cher à débloquer, pour dire quoi faire.
    for (const d of req.depots ?? []) {
      if (d.kind !== "objet" || !(d.itemsPerSec! > 0)) continue;
      const a = machineAccess(data, player, d.id);
      if (!a.available && !a.needsOwnership && (!depotUnlock || a.rpCost < depotUnlock.rpCost)) depotUnlock = a;
    }
    const how = depotUnlock ? msg("plan.noDepot.how", { list: { join: depotUnlock.missingNodes.map((n) => data.nodes.get(n)?.name ?? n), by: "flèche" } }) : undefined;
    warnings.push({ code: "dépôt", message: msg("plan.noDepot", { how }) });
  }
  const res = run(ratePerMin);
  if (res.status !== "ok") {
    if (energyMode) return emptyPlan(req, criterion, ratePerMin, [...warnings, { code: "simplexe", message: msg("plan.noEnergy") }], player, data);
    if (multi) return emptyPlan(req, criterion, ratePerMin, [...warnings, { code: "simplexe", message: msg("plan.failed") }], player, data);
    if (!moneyMode) return fromV1(solveV1(data, player, { ...req, criterion: criterion === "pollution" || criterion === "cost" || criterion === "area" ? "machines" : criterion }), req);
    return emptyPlan(req, criterion, ratePerMin, model.depots.length ? [...warnings, { code: "simplexe", message: msg("plan.noSale") }] : warnings, player, data, depotUnlock?.missingNodes ?? []);
  }

  // ---------------------------------------------------------------- étapes
  const procOf = new Map(model.recipes.map((p) => [p.id, p]));
  const used = [...res.machines].map(([id, x]) => ({ p: procOf.get(id)!, x }));
  const prodOf = new Map<string, { id: string; amount: number }[]>();
  const consOf = new Map<string, { id: string; amount: number }[]>();
  for (const { p, x } of used) {
    for (const [k, v] of Object.entries(p.perMin)) {
      const map = v > 0 ? prodOf : consOf;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({ id: p.id, amount: Math.abs(v) * x });
    }
  }
  const external = (item: string) => (moneyMode ? (res.sells.get(item) ?? 0) : energyMode ? 0 : multi ? (demands.get(item) ?? 0) : item === req.item ? ratePerMin : 0);
  const totalProd = (k: string) => (prodOf.get(k) ?? []).reduce((s, e) => s + e.amount, 0);
  const totalCons = (k: string) => (consOf.get(k) ?? []).reduce((s, e) => s + e.amount, 0) + external(k);

  // Item principal de chaque recette : la cible, sinon la sortie la plus consommée par la chaîne.
  const mainOf = new Map<string, string>();
  for (const { p } of used) {
    const outs = Object.entries(p.perMin).filter(([, v]) => v > 0);
    let main: string | null = null;
    if (!noItem && p.perMin[req.item]! > 0) main = req.item;
    else if (multi && outs.some(([k]) => demands.has(k))) main = outs.filter(([k]) => demands.has(k)).sort(([, a], [, b]) => b - a)[0]![0];
    else if (p.eff.recipe.pollutionPerHour !== undefined && p.eff.recipe.pollutionPerHour < 0 && !outs.some(([k]) => totalCons(k) > 1e-9)) main = POLLUTION;
    else if (outs.length) {
      let best = -1;
      for (const [k, v] of outs.sort(([a], [b]) => a.localeCompare(b))) {
        const share = Math.min(1, totalCons(k) / Math.max(1e-12, totalProd(k)));
        const score = share * 1e6 + v;
        if (share > 1e-9 && score > best) {
          best = score;
          main = k;
        }
      }
      if (main === null) main = p.energy !== null && p.energy < 0 ? ENERGY : outs.sort(([, a], [, b]) => b - a)[0]![0];
    } else main = ENERGY;
    mainOf.set(p.id, main);
  }
  const countByItem = new Map<string, number>();
  for (const m of mainOf.values()) countByItem.set(m, (countByItem.get(m) ?? 0) + 1);
  const keyOf = (rid: string) => {
    const m = mainOf.get(rid)!;
    return countByItem.get(m)! > 1 ? `${m}@${rid}` : m;
  };

  // Flux : la production d'un item est répartie entre ses consommateurs au prorata. Un manque
  // (item non produit) est une source comme une autre, de clé « l'item » : le graphe le relie.
  const edges: Edge[] = [];
  const sources = new Map<string, { key: string; id: string; amount: number }[]>();
  for (const [k, producers] of prodOf) sources.set(k, producers.map((p) => ({ key: keyOf(p.id), id: p.id, amount: p.amount })));
  for (const [k, amount] of res.supplies) sources.set(k, [...(sources.get(k) ?? []), { key: `existant:${k}`, id: `existant:${k}`, amount }]);
  for (const [k, amount] of res.imports) sources.set(k, [...(sources.get(k) ?? []), { key: k, id: `manque:${k}`, amount }]);
  for (const [k, list] of sources) {
    const S = list.reduce((s, x) => s + x.amount, 0);
    for (const pr of list) {
      for (const c of consOf.get(k) ?? []) {
        if (c.id === pr.id) continue;
        const perMin = (pr.amount * c.amount) / S;
        if (perMin > 1e-12) edges.push({ from: pr.key, to: keyOf(c.id), item: k, perMin });
      }
    }
  }

  const finals = [
    ...used
      .filter(({ p }) => (moneyMode ? res.sells.has(mainOf.get(p.id)!) : energyMode ? mainOf.get(p.id) === ENERGY : multi ? demands.has(mainOf.get(p.id)!) : mainOf.get(p.id) === req.item))
      .map(({ p }) => keyOf(p.id)),
    // Une production existante peut fournir directement l'objectif.
    ...[...res.supplies.keys()].filter((k) => (moneyMode ? res.sells.has(k) : multi ? demands.has(k) : k === req.item)).map((k) => `existant:${k}`),
  ];
  // Profondeur : plus long chemin depuis l'objectif. Les boucles rentables (un sous-produit qui
  // revient plus haut dans la chaîne) existent désormais : leurs arcs de retour sont marqués
  // `loop` et ignorés pour la profondeur (parcours en profondeur depuis l'objectif).
  const toProducers = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!toProducers.has(e.to)) toProducers.set(e.to, []);
    toProducers.get(e.to)!.push(e);
  }
  const visitState = new Map<string, 1 | 2>();
  const postOrder: string[] = [];
  const dfs = (k: string) => {
    visitState.set(k, 1);
    for (const e of toProducers.get(k) ?? []) {
      const st = visitState.get(e.from);
      if (st === 1) e.loop = true;
      else if (!st) dfs(e.from);
    }
    visitState.set(k, 2);
    postOrder.push(k);
  };
  for (const f of finals) if (!visitState.has(f)) dfs(f);
  const depth = new Map<string, number>(finals.map((k) => [k, 0]));
  for (const k of [...postOrder].reverse()) {
    const d = depth.get(k) ?? 0;
    for (const e of toProducers.get(k) ?? []) if (!e.loop) depth.set(e.from, Math.max(depth.get(e.from) ?? 0, d + 1));
  }
  // Étapes hors de l'arbre de l'objectif (générateurs…) : leurs propres arcs de retour aussi.
  for (const { p } of used) if (!visitState.has(keyOf(p.id))) dfs(keyOf(p.id));
  const maxDepth = Math.max(0, ...depth.values());

  const steps: Step[] = [];
  const verify: VerifyEntry[] = [];
  for (const { p, x } of used) {
    const main = mainOf.get(p.id)!;
    const key = keyOf(p.id);
    const eff = p.eff;
    const r = eff.recipe;
    const m = p.machine;
    // Machines fixées dans le schéma (S8) : ce nombre, même si moins suffiraient.
    const machines = Math.max(ceilTol(x), floor?.get(p.id) ?? 0);
    const choice = main === ENERGY || main === POLLUTION ? null : chooser.choose(main);
    const access = machineAccess(data, player, r.machine);
    // Pollution par machine : celle de la recette (Scrubber), sinon de la machine ; installation : par unité.
    const pollution = r.pollutionPerHour ?? (p.parts ? p.pollution : (m?.pollutionPerHour ?? null));
    // Pièce « une fois par ferme » (contrôleur, sortie) : son nombre ne suit pas celui des arbres.
    // Ferme : ses blocs se comptent pour les arbres posés (nombre entier, ou fixé dans le schéma) ;
    // moteur diesel : pour des moteurs entiers.
    const basis = m?.kind === "farm" || r.wholeUnits ? machines : x;
    const parts: StepPart[] | undefined = p.parts?.map((q) => (q.perFarm ? { machine: q.machine, exact: q.count, count: q.count, perFarm: true } : { machine: q.machine, exact: x * q.count, count: ceilTol(basis * q.count) }));
    // Ferme d'arbres (S14) : les blocs se comptent d'après son plan de pose (nombre de fermes, récolteurs, sorties…).
    if (parts && r.farm?.geometry && machines > 0) {
      const counts = farmCounts(r.farm.geometry, machines, x * (r.energyMFps ?? 0));
      for (const q of parts) if (q.machine !== r.machine && counts[q.machine] !== undefined) q.count = counts[q.machine]!;
    }
    const partSum = (k: "cost" | "area" | "pollution") => (p.parts!.some((q) => q[k] === null) ? null : p.parts!.reduce((s2, q, i) => s2 + parts![i]!.count * q[k]!, 0));
    const isForced = req.forced?.[main] === r.id;
    const ratePerMachineMain = main === ENERGY ? -(p.energy ?? 0) : (ratePerMachine(eff, main) ?? 0);
    const step: Step = {
      key,
      item: main,
      recipeId: r.id,
      machine: r.machine,
      machineKind: m?.kind === "farm" ? "farm" : "machine",
      forced: isForced,
      depth: depth.get(key) ?? (main === ENERGY ? 1 : maxDepth + 1),
      durationS: eff.durationS!,
      outputPerCycle: main === ENERGY ? 0 : (eff.net[main] ?? 0),
      ratePerMachine: ratePerMachineMain,
      demandPerMin: main === ENERGY ? 0 : (p.perMin[main] ?? 0) * x,
      machinesExact: x,
      machines,
      utilization: machines ? x / machines : 0,
      inputs: Object.entries(p.perMin)
        .filter(([, v]) => v < 0)
        .map(([k, v]) => ({ item: k, perMin: -v * x })),
      consumers: aggregate(edges.filter((e) => e.from === key && e.item === main).map((e) => ({ item: e.to.split("@")[0]!, perMin: e.perMin }))),
      byproducts: Object.entries(p.perMin)
        .filter(([k, v]) => v > 0 && k !== main)
        .map(([k, v]) => ({ item: k, perMin: v * x })),
      energyMFps: r.energyMFps,
      energyAvg: r.energyMFps === null ? null : x * r.energyMFps,
      energyPeak: r.energyMFps === null ? null : machines * r.energyMFps,
      area: p.area,
      footprint: parts ? partSum("area") : p.area === null ? null : machines * p.area,
      unitCost: parts ? p.cost : (m?.cost ?? null),
      buildCost: parts ? partSum("cost") : m?.cost == null ? null : machines * m.cost,
      pollutionPerHour: parts
        ? r.pollutionPerHour !== undefined
          ? machines * r.pollutionPerHour
          : partSum("pollution")
        : pollution === null
          ? null
          : typeof pollution === "number"
            ? machines * pollution
            : [machines * pollution[0], machines * pollution[1]],
      isRaw: p.isRaw,
      usesUnverified: eff.blocking.length > 0,
      verify: r.verify,
      machineVerify: m?.verify ?? [],
      access,
      ...(eff.growth ? { growth: eff.growth } : {}),
      alternatives: choice?.candidates ?? [],
      ...(parts ? { parts } : {}),
    };
    steps.push(step);
    for (const f of r.verify) verify.push({ scope: "recette", id: r.id, item: main, flag: f, used: true });
    for (const f of m?.verify ?? []) verify.push({ scope: "machine", id: r.machine, item: main, flag: f, used: true });
    for (const cand of choice?.candidates ?? []) {
      if (cand.status !== "à vérifier") continue;
      for (const f of cand.flags ?? []) verify.push({ scope: "recette", id: cand.recipeId, item: main, flag: f, used: false });
    }
    if (isForced && !access.available) {
      warnings.push({ code: "forcée-verrouillée", message: msg("plan.forcedLocked", { item: name(main), m: m?.name ?? r.machine }), items: [main] });
    }
    if (step.usesUnverified) {
      warnings.push({ code: "à-vérifier", message: msg("plan.unverified", { item: name(main), r: r.id, list: { join: eff.blocking.map((f) => ({ note: f.detail })), by: "point-virgule" } }), items: [main] });
    }
    if (eff.growth) {
      warnings.push({ code: "arbres", message: msg("plan.trees", { detail: eff.growth.detail, s: Math.round(eff.growth.seconds * 10) / 10 }), items: [main] });
    }
  }
  steps.sort((a, b) => a.depth - b.depth || a.key.localeCompare(b.key));
  for (const { p } of used) {
    const reused = Object.entries(p.perMin).filter(([k, v]) => v > 0 && k !== mainOf.get(p.id) && (consOf.get(k) ?? []).some((c) => c.id !== p.id));
    for (const [k] of reused) {
      warnings.push({ code: "sous-produit-réutilisé", message: msg("plan.reused", { item: name(k), r: p.id }), items: [k] });
    }
  }

  // ---------------------------------------------------------------- manques
  const unresolved: Unresolved[] = [];
  for (const [item, perMin] of res.imports) {
    const c = chooser.choose(item);
    const reason: LeafReason = c.leafReason ?? "boucle";
    let unlock: Unresolved["unlock"];
    for (const cand of c.candidates) {
      if (cand.status !== "verrouillée" || !cand.access || cand.access.available) continue;
      const a = cand.access;
      const better = !unlock || (unlock.needsOwnership && !a.needsOwnership) || (!a.needsOwnership && a.rpCost < unlock.rpCost);
      if (better) unlock = { ...a, recipeId: cand.recipeId };
    }
    const loopShortfall = prodOf.has(item);
    const excluded = excludedMachines(c.candidates);
    unresolved.push({ item, perMin, reason, loopShortfall, ...(unlock ? { unlock } : {}), ...(excluded.length ? { excluded } : {}), candidates: c.candidates });
    for (const cand of c.candidates) {
      if (cand.status === "à vérifier" || cand.status === "incalculable") {
        for (const f of cand.flags ?? []) verify.push({ scope: "recette", id: cand.recipeId, item, flag: f, used: false });
      }
    }
    const label = unresolvedWhy(data, reason, unlock);
    if (reason === "machine écartée") {
      warnings.push({ code: "non-résolu:machine écartée", message: excludedMessage(data, item, perMin, excluded), items: [item] });
    } else if (reason === "boucle") {
      const cyc = findCycle(model, item);
      warnings.push({
        code: "boucle",
        message: msg("plan.loop", { cycle: cyc.length > 1 ? msg("plan.loop.cycle", { list: { join: [...cyc, cyc[0]!].map(name), by: "flèche" } }) : undefined, r: fmtNum(perMin), item: name(item) }),
        items: cyc.length ? cyc : [item],
      });
    } else warnings.push({ code: `non-résolu:${reason}`, message: msg("plan.unresolved", { item: name(item), r: fmtNum(perMin), why: label }), items: [item] });
  }
  if (res.energyImport > 0) {
    warnings.push({ code: "énergie-non-couverte", message: msg("plan.energyMissing", { p: { mf: res.energyImport } }) });
  }
  if (res.impossible.pollution !== undefined) {
    warnings.push({
      code: "contrainte-pollution",
      message: msg("plan.pollutionLimit", { max: fmtNum(req.maxPollution!), best: fmtNum(res.impossible.pollution) }),
    });
  }
  if (res.impossible.budget !== undefined) {
    warnings.push({ code: "contrainte-budget", message: msg("plan.budgetLimit", { max: fmtNum(req.budget!), min: fmtNum(res.impossible.budget) }) });
  }

  // ---------------------------------------------------------------- surplus
  const surplus: Surplus[] = [];
  for (const [k, producers] of prodOf) {
    const extra = totalProd(k) - totalCons(k);
    if (extra > 1e-7 * Math.max(1, totalProd(k))) {
      surplus.push({ item: k, perMin: extra, from: producers.map((x) => x.id), alsoDemanded: totalCons(k) > 1e-9 });
    }
  }
  surplus.sort((a, b) => b.perMin - a.perMin);

  for (const f of chooser.invalidForced) warnings.push({ code: "forcée-invalide", message: msg("plan.forcedIgnored", { item: name(f.item), r: f.recipeId, why: f.reason }), items: [f.item] });

  // ---------------------------------------------------------------- ventes et dépôts
  const sales: Sale[] = [...res.sells].map(([item, perMin]) => ({ item, perMin, price: model.sellable.get(item)!, revenuePerMin: perMin * model.sellable.get(item)! }));
  sales.sort((a, b) => b.revenuePerMin - a.revenuePerMin);
  const depots: DepotUse[] = [...res.depots].map(([id, x]) => {
    const d = model.depots.find((q) => q.id === id)!;
    return { id, name: d.name, machinesExact: x, machines: ceilTol(x), itemsPerMin: d.itemsPerMin, unitCost: d.cost };
  });

  // ---------------------------------------------------------------- totaux
  const totals: Plan["totals"] = {
    machines: 0,
    farms: 0,
    depots: depots.reduce((s, d) => s + d.machines, 0),
    energyAvg: 0,
    energyPeak: 0,
    energyProduced: 0,
    energyUnknownSteps: 0,
    footprint: 0,
    footprintUnknownSteps: 0,
    buildCost: 0,
    buildCostUnknownSteps: 0,
    pollutionPerHour: [0, 0],
    pollutionUnknownSteps: 0,
    revenuePerMin: sales.reduce((s, x) => s + x.revenuePerMin, 0),
  };
  for (const s of steps) {
    if (s.machineKind === "farm") {
      totals.farms += s.machines;
      // Blocs de la ferme (arroseurs, réservoirs, récolteurs, contrôleur, sortie) : des bâtiments.
      if (s.parts) totals.machines += s.parts.filter((q) => q.machine !== s.machine).reduce((n, q) => n + q.count, 0);
    } else totals.machines += s.parts ? s.parts.reduce((n, q) => n + q.count, 0) : s.machines;
    if (s.energyAvg === null) totals.energyUnknownSteps++;
    else if (s.energyAvg >= 0) {
      totals.energyAvg += s.energyAvg;
      totals.energyPeak += s.energyPeak!;
    } else totals.energyProduced -= s.energyAvg;
    if (s.footprint === null) totals.footprintUnknownSteps++;
    else totals.footprint += s.footprint;
    if (s.buildCost === null) totals.buildCostUnknownSteps++;
    else totals.buildCost += s.buildCost;
    if (s.pollutionPerHour === null) totals.pollutionUnknownSteps++;
    else if (typeof s.pollutionPerHour === "number") {
      totals.pollutionPerHour[0] += s.pollutionPerHour;
      totals.pollutionPerHour[1] += s.pollutionPerHour;
    } else {
      totals.pollutionPerHour[0] += s.pollutionPerHour[0];
      totals.pollutionPerHour[1] += s.pollutionPerHour[1];
    }
  }
  for (const d of depots) {
    if (d.unitCost === null) totals.buildCostUnknownSteps++;
    else totals.buildCost += d.machines * d.unitCost;
  }
  totals.energyAvg += extraLoad;
  totals.energyPeak += extraLoad;
  if (totals.energyUnknownSteps) {
    warnings.push({ code: "énergie-inconnue", message: msg("plan.energyUnknown", { n: totals.energyUnknownSteps }) });
  }
  if (req.maxPollution != null && res.impossible.pollution === undefined && totals.pollutionPerHour[1] > req.maxPollution * (1 + 1e-9)) {
    const exact = steps.reduce((s, x) => {
      const p = data.machines.get(x.machine)?.pollutionPerHour;
      return s + x.machinesExact * (p == null ? 0 : typeof p === "number" ? p : p[1]);
    }, 0);
    warnings.push({
      code: "pollution-arrondi",
      message: msg("plan.pollutionRounded", { max: fmtNum(req.maxPollution), exact: fmtNum(exact), rounded: fmtNum(totals.pollutionPerHour[1]) }),
    });
  }
  if (req.budget != null && res.impossible.budget === undefined && totals.buildCost > req.budget) {
    warnings.push({ code: "budget-arrondi", message: msg("plan.budgetRounded", { cost: fmtNum(totals.buildCost), max: fmtNum(req.budget) }) });
  }

  const economy = economyOf(data, player, req, steps, unresolved, totals, nested);
  // Matières premières : les extracteurs (le solaire et l'éolien n'extraient rien).
  const raw: Flow[] = steps.filter((s) => s.isRaw && s.item !== ENERGY && s.item !== POLLUTION).map((s) => ({ item: s.item, perMin: s.demandPerMin }));
  const status: Plan["status"] = !finals.length
    ? "impossible"
    : unresolved.length || res.energyImport > 0
      ? "partiel"
      : "ok";
  const plan: Plan = {
    status,
    engine: "simplexe",
    target: { kind: moneyMode ? "argent" : energyMode ? "énergie" : "objet", item: noItem ? "" : req.item, ratePerMin, finalMachines: noItem ? null : (req.finalMachines ?? null) },
    criterion,
    steps,
    finals,
    edges,
    raw,
    unresolved,
    surplus,
    sales,
    depots,
    existing: [...res.supplies].map(([item, used]) => ({ item, key: `existant:${item}`, available: req.existing![item]!, used })),
    distribution: totals.energyProduced > 0 ? distributionOf(data, player, req, totals.energyProduced) : null,
    totals,
    constraints: { maxPollution: req.maxPollution ?? null, budget: req.budget ?? null, selfPowered: !!req.selfPowered },
    verify: dedupeVerify(verify),
    warnings,
    economy,
    tiers: [],
  };
  if (!nested && req.tiers !== false && status !== "impossible") plan.tiers = roundTiers(plan);
  return plan;

  // Un item verrouillé cache ses propres ingrédients : on simule les déblocages successifs.
  function economyOf(data: GameData, player: PlayerState, req: SolveRequest, steps: Step[], unresolved: Unresolved[], totals: Plan["totals"], nested: boolean): Economy {
    const nodeSet = new Set<string>();
    const machinesToOwn = new Set<string>();
    for (const s of steps) {
      if (s.access.available) continue;
      if (s.access.needsOwnership) machinesToOwn.add(s.machine);
      for (const n of s.access.missingNodes) nodeSet.add(n);
    }
    for (const u of unresolved) {
      if (!u.unlock) continue;
      if (u.unlock.needsOwnership) machinesToOwn.add(u.unlock.machine);
      for (const n of u.unlock.missingNodes) nodeSet.add(n);
    }
    if (!nested && unresolved.some((u) => u.reason === "verrouillé")) {
      for (let i = 0; i < 12; i++) {
        const extended: PlayerState = { ...player, unlocked: new Set([...player.unlocked, ...nodeSet]) };
        const sub = solveInner(data, extended, { ...req, tiers: false }, true);
        const added = sub.economy.nodesToUnlock.filter((n) => !nodeSet.has(n));
        for (const m of sub.economy.machinesToOwn) machinesToOwn.add(m);
        if (!added.length) break;
        for (const n of added) nodeSet.add(n);
      }
    }
    return economyFrom(data, player, nodeSet, machinesToOwn, totals);
  }
}

/**
 * Réseau : pour transporter P MF/s, il faut ⌈P / capacité du poteau⌉ lignes de câble (capacité = débit
 * par nœud × nombre de nœuds : un poteau compte comme si tous ses nœuds étaient reliés, relevé du
 * 2026-10-13) ; sur une distance
 * D (cases), chaque ligne demande ⌈D / portée⌉ + 1 poteaux. Indicatif : la règle des couleurs de
 * nœuds et le tracé réel viendront avec les plans de construction (E4).
 */
function distributionOf(data: GameData, player: PlayerState, req: SolveRequest, mfps: number): Distribution | null {
  const poles = (req.poles ?? []).filter((p) => p.perNodeMFps > 0 && machineAccess(data, player, p.id).available);
  if (!poles.length) return null;
  const d = req.distanceTiles != null && req.distanceTiles > 0 ? req.distanceTiles : null;
  const options = poles.map((p) => {
    const lines = Math.ceil(mfps / (p.perNodeMFps * Math.max(1, p.nodes)) - 1e-9);
    const polesPerLine = d !== null && p.rangeTiles ? Math.ceil(d / p.rangeTiles - 1e-9) + 1 : null;
    const poles = polesPerLine === null ? null : lines * polesPerLine;
    const unit = data.machines.get(p.id)?.cost ?? null;
    return { id: p.id, name: p.name, perNodeMFps: p.perNodeMFps, lines, polesPerLine, poles, cost: poles === null || unit === null ? null : poles * unit };
  });
  options.sort((a, b) => a.lines - b.lines || (a.cost ?? Infinity) - (b.cost ?? Infinity));
  return { mfps, distanceTiles: d, options };
}

function economyFrom(data: GameData, player: PlayerState, nodeSet: Set<string>, machinesToOwn: Set<string>, totals: { buildCost: number; buildCostUnknownSteps: number }): Economy {
  const nodesToUnlock = orderByDepth(data, [...nodeSet]);
  const rpNeeded = rpCost(data, nodesToUnlock);
  const money = player.money ?? null;
  const rp = player.rp ?? null;
  const rpPerSec = player.rpPerSec ?? null;
  const rpMissing = rp === null ? null : Math.max(0, rpNeeded - rp);
  return {
    buildCost: totals.buildCost,
    buildCostUnknown: totals.buildCostUnknownSteps,
    money,
    moneyMissing: money === null ? null : Math.max(0, totals.buildCost - money),
    nodesToUnlock,
    reqItems: nodesToUnlock.flatMap((id) => (data.nodes.get(id)?.reqItems ?? []).map((r) => ({ node: id, item: r.item, amount: r.amount, done: !!player.reqItemsDone?.has(id) }))),
    rpNeeded,
    rp,
    rpMissing,
    rpPerSec,
    secondsToRp: rpMissing === null || !rpPerSec || rpPerSec <= 0 ? null : rpMissing / rpPerSec,
    machinesToOwn: [...machinesToOwn],
  };
}

/** Somme des flux par item (un consommateur peut recevoir d'un même producteur par plusieurs voies). */
function aggregate(flows: Flow[]): Flow[] {
  const m = new Map<string, number>();
  for (const f of flows) m.set(f.item, (m.get(f.item) ?? 0) + f.perMin);
  return [...m].map(([item, perMin]) => ({ item, perMin }));
}

/** Boucle qui empêche de produire `item` : chemin item → entrée → … → item par recettes utilisables. */
function findCycle(model: FlowModel, item: string): string[] {
  const procs = new Map<string, RecipeProc>(model.recipes.map((p) => [p.id, p]));
  const path: string[] = [];
  const seen = new Set<string>();
  const dfs = (it: string): boolean => {
    path.push(it);
    seen.add(it);
    for (const rid of model.usable.get(it) ?? []) {
      for (const [k, v] of Object.entries(procs.get(rid)?.perMin ?? {})) {
        if (v >= 0) continue;
        if (k === item) return true;
        if (!seen.has(k) && path.length < 12 && dfs(k)) return true;
      }
    }
    path.pop();
    return false;
  };
  return dfs(item) ? path : [];
}

function dedupeVerify(v: VerifyEntry[]): VerifyEntry[] {
  const seen = new Map<string, VerifyEntry>();
  for (const e of v) {
    const k = `${e.scope}|${e.id}|${e.flag.field}|${e.flag.reason}`;
    const prev = seen.get(k);
    if (!prev || (e.used && !prev.used)) seen.set(k, e);
  }
  return [...seen.values()];
}

/** Repli : résultat du moteur v1 dans le format v2. */
function fromV1(p: PlanV1, req: SolveRequest): Plan {
  return {
    ...p,
    engine: "heuristique",
    target: { kind: "objet", ...p.target },
    steps: p.steps.map((s) => ({ ...s, key: s.item })),
    finals: p.steps.filter((s) => s.item === p.target.item).map((s) => s.item),
    edges: p.edges.map((e) => ({ ...e, item: e.from })),
    sales: [],
    depots: [],
    existing: [],
    distribution: null,
    totals: { ...p.totals, depots: 0, energyProduced: 0, revenuePerMin: 0 },
    constraints: { maxPollution: req.maxPollution ?? null, budget: req.budget ?? null, selfPowered: !!req.selfPowered },
    warnings: [...p.warnings, { code: "simplexe", message: msg("plan.v1") }],
    tiers: [],
  };
}

function emptyPlan(req: SolveRequest, criterion: Criterion, ratePerMin: number, warnings: Warning[], player: PlayerState, data: GameData, nodes: string[] = []): Plan {
  const totals: Plan["totals"] = {
    machines: 0,
    farms: 0,
    depots: 0,
    energyAvg: 0,
    energyPeak: 0,
    energyProduced: 0,
    energyUnknownSteps: 0,
    footprint: 0,
    footprintUnknownSteps: 0,
    buildCost: 0,
    buildCostUnknownSteps: 0,
    pollutionPerHour: [0, 0],
    pollutionUnknownSteps: 0,
    revenuePerMin: 0,
  };
  return {
    status: "impossible",
    engine: "simplexe",
    target: { kind: req.moneyPerMin !== undefined ? "argent" : req.energyMFps !== undefined ? "énergie" : "objet", item: req.moneyPerMin !== undefined || req.energyMFps !== undefined ? "" : req.item, ratePerMin, finalMachines: null },
    criterion,
    steps: [],
    finals: [],
    edges: [],
    raw: [],
    unresolved: [],
    surplus: [],
    sales: [],
    depots: [],
    existing: [],
    distribution: null,
    totals,
    constraints: { maxPollution: req.maxPollution ?? null, budget: req.budget ?? null, selfPowered: !!req.selfPowered },
    verify: [],
    warnings,
    economy: economyFrom(data, player, new Set(nodes), new Set(), totals),
    tiers: [],
  };
}
