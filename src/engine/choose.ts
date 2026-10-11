// Choix de la recette pour chaque item, selon le critère d'optimisation.
// Coût estimé pour 1 unité/min de l'item, par point fixe (type Bellman-Ford) : les boucles ne font pas exploser le calcul.

import type { GameData } from "./data.ts";
import { treeGrowthSeconds, type TreeGrowthResult } from "./pollution.ts";
import type { Machine, Recipe, VerifyFlag } from "./types.ts";
import { machineAccess, type MachineAccess, type Progress } from "./unlock.ts";

export type Criterion = "machines" | "energy" | "raw";

export type ChoiceOptions = {
  criterion: Criterion;
  /** Recettes imposées : itemId → recipeId. */
  forced: Record<string, string>;
  /** Accepter les recettes « à vérifier » (valeurs variables ou manquantes) dans le choix automatique. */
  useUnverified: boolean;
  pollutionPct: number | null;
};

/** Recette évaluée dans le contexte du joueur (durée des arbres selon la pollution…). */
export type EffRecipe = {
  recipe: Recipe;
  machine: Machine | undefined;
  durationS: number | null;
  /** Bilan net par cycle : > 0 produit, < 0 consommé ; null = inconnu. */
  net: Record<string, number | null>;
  /** Drapeaux qui empêchent un choix automatique (sauf option activée). */
  blocking: VerifyFlag[];
  growth?: TreeGrowthResult;
};

export type Cost = {
  /** Nombre d'items de la chaîne sans recette utilisable. */
  unresolved: number;
  machines: number;
  energy: number;
  energyUnknown: number;
  raw: number;
};

export type CandidateStatus = "ok" | "forcée" | "verrouillée" | "à vérifier" | "incalculable" | "boucle";
export type Candidate = {
  recipeId: string;
  machine: string;
  status: CandidateStatus;
  access?: MachineAccess;
  flags?: VerifyFlag[];
  cycle?: string[];
  cost?: Cost;
};

export type LeafReason = "verrouillé" | "aucune recette" | "seulement à vérifier" | "incalculable" | "boucle";

export type Choice = {
  item: string;
  /** Recette retenue ; null = item non produit (feuille). */
  eff: EffRecipe | null;
  forced: boolean;
  cost: Cost;
  leafReason?: LeafReason;
  candidates: Candidate[];
};

const BLOCKING_REASONS = new Set(["manquant", "variable"]);
const isQuantityField = (f: string) => f === "durationS" || f === "outputs" || f.startsWith("inputs.") || f.startsWith("outputs.");

export function evalRecipe(data: GameData, recipe: Recipe, pollutionPct: number | null): EffRecipe {
  const machine = data.machines.get(recipe.machine);
  let durationS = recipe.durationS;
  let growth: TreeGrowthResult | undefined;
  if (recipe.durationByPollution) {
    growth = treeGrowthSeconds(data.treeGrowth, pollutionPct);
    if (Number.isFinite(growth.seconds)) durationS = growth.seconds;
  }
  const net: Record<string, number | null> = {};
  for (const k of new Set([...Object.keys(recipe.inputs), ...Object.keys(recipe.outputs)])) {
    const o = Object.hasOwn(recipe.outputs, k) ? recipe.outputs[k]! : 0;
    const i = Object.hasOwn(recipe.inputs, k) ? recipe.inputs[k]! : 0;
    net[k] = o === null || i === null ? null : o - i;
  }
  const blocking = recipe.verify.filter((f) => BLOCKING_REASONS.has(f.reason) && isQuantityField(f.field));
  return { recipe, machine, durationS, net, blocking, ...(growth ? { growth } : {}) };
}

/** Débit d'une machine pour un item, en /min ; null si incalculable. */
export function ratePerMachine(eff: EffRecipe, item: string): number | null {
  const n = eff.net[item];
  if (eff.durationS === null || !(eff.durationS > 0) || n === null || n === undefined || n <= 0) return null;
  return (n / eff.durationS) * 60;
}

export function isCalculable(eff: EffRecipe, item: string): boolean {
  return ratePerMachine(eff, item) !== null && Object.values(eff.net).every((v) => v !== null);
}

const ZERO: Cost = { unresolved: 0, machines: 0, energy: 0, energyUnknown: 0, raw: 0 };
const LEAF: Cost = { unresolved: 1, machines: 0, energy: 0, energyUnknown: 0, raw: 1 };
const EPS = 1e-9;
const same = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

function metric(c: Cost, k: Criterion): number {
  return k === "machines" ? c.machines : k === "energy" ? c.energy : c.raw;
}

/** Surface au sol d'une machine (cases) ; null si inconnue. */
export function machineArea(m: Machine | undefined): number | null {
  return m?.size ? m.size.w * m.size.l : null;
}

/** < 0 si a est meilleur que b. */
function compare(a: { cost: Cost; area: number | null; id: string }, b: { cost: Cost; area: number | null; id: string }, criterion: Criterion): number {
  if (a.cost.unresolved !== b.cost.unresolved) return a.cost.unresolved - b.cost.unresolved;
  if (criterion === "energy" && a.cost.energyUnknown !== b.cost.energyUnknown) return a.cost.energyUnknown - b.cost.energyUnknown;
  const pa = metric(a.cost, criterion);
  const pb = metric(b.cost, criterion);
  if (!same(pa, pb)) return pa - pb;
  // Départage (décision Q2) : la machine la plus petite au sol, par unité produite.
  if (a.area !== b.area) {
    if (a.area === null) return 1;
    if (b.area === null) return -1;
    if (!same(a.area, b.area)) return a.area - b.area;
  }
  for (const k of ["machines", "energy", "raw"] as Criterion[]) {
    if (k === criterion) continue;
    const x = metric(a.cost, k);
    const y = metric(b.cost, k);
    if (!same(x, y)) return x - y;
  }
  return a.id.localeCompare(b.id);
}

/** Recette candidate déjà filtrée (verrou, à vérifier, calculabilité). */
type Usable = { eff: EffRecipe; forced: boolean; access: MachineAccess };
type Pre = { usable: Usable[]; rejected: Candidate[]; forced: boolean; recipes: Recipe[] };
type Entry = { eff: EffRecipe; cost: Cost; area: number | null; id: string; forced: boolean };

/**
 * Choix des recettes pour une résolution (options et progression fixées).
 *
 * Algorithme : coût de chaque item = min sur ses recettes utilisables de
 * (machines/énergie/matières de l'étape + Σ quantité × coût de l'entrée).
 * On part de « coût inconnu » partout et on relâche jusqu'à stabilité : les coûts
 * ne font que baisser, ce qui converge même en présence de boucles. Un item dont
 * toutes les recettes dépendent d'une boucle sans sortie reçoit ensuite un coût
 * « entrée non résolue » ; la boucle est coupée et signalée par solve().
 */
export class Chooser {
  private readonly choices = new Map<string, Choice>();
  private readonly effMemo = new Map<string, EffRecipe>();
  private readonly preMemo = new Map<string, Pre>();
  readonly invalidForced: { item: string; recipeId: string; reason: string }[] = [];
  readonly notConverged: string[] = [];

  private readonly data: GameData;
  private readonly progress: Progress;
  private readonly opts: ChoiceOptions;

  constructor(data: GameData, progress: Progress, opts: ChoiceOptions) {
    this.data = data;
    this.progress = progress;
    this.opts = opts;
  }

  eff(recipe: Recipe): EffRecipe {
    let e = this.effMemo.get(recipe.id);
    if (!e) {
      e = evalRecipe(this.data, recipe, this.opts.pollutionPct);
      this.effMemo.set(recipe.id, e);
    }
    return e;
  }

  choose(item: string): Choice {
    if (!this.choices.has(item)) this.compute(item);
    return this.choices.get(item)!;
  }

  /** Filtre les recettes d'un item : utilisables, ou rejetées avec la raison. */
  private pre(item: string): Pre {
    const cached = this.preMemo.get(item);
    if (cached) return cached;
    const recipes = this.data.producers.get(item) ?? [];
    const forcedId = this.opts.forced[item];
    const forcedRecipe = forcedId ? this.data.recipes.get(forcedId) : undefined;
    if (forcedId && (!forcedRecipe || !recipes.includes(forcedRecipe))) {
      this.invalidForced.push({ item, recipeId: forcedId, reason: forcedRecipe ? "cette recette ne produit pas l'item" : "recette inconnue" });
    }
    const forcedValid = !!forcedRecipe && recipes.includes(forcedRecipe);
    const usable: Usable[] = [];
    const rejected: Candidate[] = [];
    for (const r of recipes) {
      const eff = this.eff(r);
      const access = machineAccess(this.data, this.progress, r.machine);
      const base = { recipeId: r.id, machine: r.machine };
      const isForced = forcedRecipe === r;
      if (!isCalculable(eff, item)) {
        rejected.push({ ...base, status: "incalculable", flags: r.verify });
        continue;
      }
      if (forcedValid && !isForced) {
        // Une recette forcée calculable remplace toutes les autres.
        if (isCalculable(this.eff(forcedRecipe!), item)) {
          rejected.push({ ...base, status: access.available ? "ok" : "verrouillée", ...(access.available ? {} : { access }) });
          continue;
        }
      }
      if (!isForced) {
        if (!access.available) {
          rejected.push({ ...base, status: "verrouillée", access });
          continue;
        }
        if (eff.blocking.length && !this.opts.useUnverified) {
          rejected.push({ ...base, status: "à vérifier", flags: eff.blocking });
          continue;
        }
      }
      usable.push({ eff, forced: isForced, access });
    }
    const pre: Pre = { usable, rejected, forced: forcedValid, recipes };
    this.preMemo.set(item, pre);
    return pre;
  }

  private entryFor(u: Usable, item: string, inputCost: (i: string) => Cost | null): Entry | null {
    const eff = u.eff;
    const rate = ratePerMachine(eff, item)!;
    const perUnitMachines = 1 / rate;
    const cost: Cost = { ...ZERO, machines: perUnitMachines };
    if (eff.recipe.energyMFps === null) cost.energyUnknown++;
    else cost.energy = eff.recipe.energyMFps * perUnitMachines;
    const produced = eff.net[item]!;
    let hasInput = false;
    for (const [input, v] of Object.entries(eff.net)) {
      if (!(v! < 0)) continue;
      hasInput = true;
      const sub = inputCost(input);
      if (!sub) return null;
      const k = -v! / produced;
      cost.unresolved += sub.unresolved;
      cost.machines += k * sub.machines;
      cost.energy += k * sub.energy;
      cost.energyUnknown += sub.energyUnknown;
      cost.raw += k * sub.raw;
    }
    if (!hasInput) cost.raw = 1;
    const a = machineArea(eff.machine);
    return { eff, cost, area: a === null ? null : a / rate, id: eff.recipe.id, forced: u.forced };
  }

  private compute(root: string): void {
    // 1. Fermeture : items atteignables depuis la racine par des recettes utilisables.
    const items: string[] = [];
    const seen = new Set<string>();
    const stack = [root];
    while (stack.length) {
      const it = stack.pop()!;
      if (seen.has(it) || this.choices.has(it)) continue;
      seen.add(it);
      items.push(it);
      for (const u of this.pre(it).usable) for (const [k, v] of Object.entries(u.eff.net)) if (v! < 0) stack.push(k);
    }

    // 2. Point fixe.
    const best = new Map<string, Entry | "feuille">();
    for (const it of items) if (!this.pre(it).usable.length) best.set(it, "feuille");
    const costOf = (i: string): Cost | null => {
      const done = this.choices.get(i);
      if (done) return done.cost;
      const b = best.get(i);
      return b === undefined ? null : b === "feuille" ? LEAF : b.cost;
    };
    const relax = (): boolean => {
      const maxRounds = items.length * 4 + 20;
      for (let round = 0; round < maxRounds; round++) {
        let changed = false;
        for (const it of items) {
          if (best.get(it) === "feuille") continue;
          const current = best.get(it) as Entry | undefined;
          let candidate: Entry | null = null;
          for (const u of this.pre(it).usable) {
            const e = this.entryFor(u, it, costOf);
            if (e && (!candidate || compare(e, candidate, this.opts.criterion) < 0)) candidate = e;
          }
          if (candidate && (!current || compare(candidate, current, this.opts.criterion) < 0)) {
            best.set(it, candidate);
            changed = true;
          }
        }
        if (!changed) return true;
      }
      return false;
    };
    let converged = relax();
    if (items.some((it) => !best.has(it))) {
      // Boucles sans sortie : on évalue ces items en considérant l'entrée bouclée comme non résolue.
      const stuck = items.filter((it) => !best.has(it));
      for (const it of stuck) {
        let candidate: Entry | null = null;
        for (const u of this.pre(it).usable) {
          const e = this.entryFor(u, it, (i) => costOf(i) ?? LEAF);
          if (e && (!candidate || compare(e, candidate, this.opts.criterion) < 0)) candidate = e;
        }
        if (candidate) best.set(it, candidate);
      }
      converged = relax() && converged;
    }
    if (!converged) this.notConverged.push(root);

    // 3. Choix finaux et liste des candidates (avec leur coût final).
    for (const it of items) {
      const pre = this.pre(it);
      const b = best.get(it);
      const candidates: Candidate[] = [];
      for (const u of pre.usable) {
        const e = this.entryFor(u, it, (i) => costOf(i) ?? LEAF);
        candidates.push({
          recipeId: u.eff.recipe.id,
          machine: u.eff.recipe.machine,
          status: u.forced ? "forcée" : "ok",
          ...(e ? { cost: e.cost } : {}),
          ...(u.access.available ? {} : { access: u.access }),
          ...(u.eff.blocking.length ? { flags: u.eff.blocking } : {}),
        });
      }
      candidates.push(...pre.rejected);
      if (b && b !== "feuille") {
        this.choices.set(it, { item: it, eff: b.eff, forced: b.forced, cost: b.cost, candidates });
        continue;
      }
      const reason: LeafReason = !pre.recipes.length
        ? "aucune recette"
        : pre.rejected.some((c) => c.status === "à vérifier")
          ? "seulement à vérifier"
          : pre.rejected.some((c) => c.status === "verrouillée")
            ? "verrouillé"
            : pre.usable.length
              ? "boucle"
              : "incalculable";
      this.choices.set(it, { item: it, eff: null, forced: pre.forced, cost: LEAF, leafReason: reason, candidates });
    }
  }
}

