// Modèle de flux commun (moteur v2) : objets, énergie (MF/s), pollution (%/h) et argent ($/min)
// sont des ressources comme les autres. Chaque « procédé » en produit et en consomme :
//   - une recette par machine (débits nets par minute, énergie, pollution, prix, surface) ;
//   - une vente (objet → $) et un dépôt (capacité de vente) pour l'objectif argent ;
//   - un « manque » (import) : ce que la chaîne ne sait pas produire, très pénalisé, pour que
//     le calcul reste faisable et dise ce qui manque au lieu d'échouer.
// Pur : aucune dépendance au DOM.

import type { Chooser, EffRecipe } from "./choose.ts";
import type { GameData } from "./data.ts";
import type { Machine } from "./types.ts";
import { machineAccess, type Progress } from "./unlock.ts";

/** Pseudo-item des générateurs : leur « produit » est l'énergie. */
export const ENERGY = "énergie";
/** Pseudo-item des Scrubbers : leur « produit » est la pollution retirée. */
export const POLLUTION = "pollution";

/** Dépôt de vente (logistics.json) : débit de vente en objets/s, null si inconnu. */
export type DepotSpec = { id: string; name: string; kind: "objet" | "fluide"; itemsPerSec: number | null };

export type RecipeProc = {
  kind: "recette";
  id: string;
  eff: EffRecipe;
  machine: Machine | undefined;
  /** Bilan net par machine et par minute (> 0 produit, < 0 consommé). */
  perMin: Record<string, number>;
  /** MF/s par machine (< 0 : production) ; null si inconnu. */
  energy: number | null;
  /** Pollution par machine (%/h), borne haute d'une plage ; null si inconnue. */
  pollution: number | null;
  cost: number | null;
  area: number | null;
  /** Aucune entrée : matière première (foreuse, pompe, arbre…). */
  isRaw: boolean;
  /** Machines par unité (installation composée : la somme de ses pièces ; sinon 1). */
  units: number;
  /** Pièces d'une installation composée, avec leurs valeurs unitaires. */
  parts: { machine: string; count: number; cost: number | null; pollution: number | null; area: number | null }[] | null;
};

export type DepotProc = { kind: "dépôt"; id: string; name: string; itemsPerMin: number; machine: Machine | undefined; cost: number | null; area: number | null };

export type FlowModel = {
  /** Recettes retenues comme variables, triées par id (résultat reproductible). */
  recipes: RecipeProc[];
  /** Items de la fermeture (atteignables depuis les cibles par des recettes utilisables). */
  items: Set<string>;
  /** Items sans aucune recette utilisable : seuls candidats au « manque » au premier essai. */
  leaves: Set<string>;
  /** Pour chaque item, les recettes utilisables qui le produisent (pour expliquer les boucles). */
  usable: Map<string, string[]>;
  /** Objets vendables (objectif argent) et leur prix unitaire. */
  sellable: Map<string, number>;
  depots: DepotProc[];
  /** Recettes de générateurs ajoutées pour l'autonomie énergétique. */
  generators: string[];
};

export type ModelOptions = {
  /** Items à produire (objectif objet) ; vide en mode argent. */
  targets: string[];
  /** Mode argent : toutes les ventes possibles sont candidates. */
  money: boolean;
  /** La chaîne produit sa propre énergie (générateurs inclus). */
  selfPowered: boolean;
  /** Seulement les sources dont la production est constante (nuit, vent faible) : puissance garantie. */
  guaranteedOnly?: boolean;
  /** Seulement les sources sans combustible (l'eau n'en est pas un). */
  noFuel?: boolean;
  /** Scrubbers candidats (critère pollution, ou pollution maximale). */
  scrubbers?: boolean;
  /** Recettes imposées par item (critère « moins d'étapes » : choix de l'heuristique). */
  restrictTo?: (item: string) => string[] | null;
  depots?: DepotSpec[];
};

const area = (m: Machine | undefined) => (m?.size ? m.size.w * m.size.l : null);
const pollutionOf = (m: Machine | undefined) => {
  const p = m?.pollutionPerHour;
  return p === null || p === undefined ? null : typeof p === "number" ? p : p[1];
};

export function recipeProc(eff: EffRecipe, machines?: Map<string, Machine>): RecipeProc {
  const d = eff.durationS!;
  const perMin: Record<string, number> = {};
  for (const [k, v] of Object.entries(eff.net)) if (v) perMin[k] = (v! / d) * 60;
  const m = eff.machine;
  const r = eff.recipe;
  const parts = r.parts
    ? r.parts.map((p) => {
        const pm = machines?.get(p.machine);
        return { machine: p.machine, count: p.count, cost: pm?.cost ?? null, pollution: pollutionOf(pm), area: area(pm) };
      })
    : null;
  const sum = (k: "cost" | "pollution" | "area") => (parts!.some((p) => p[k] === null) ? null : parts!.reduce((s, p) => s + p.count * p[k]!, 0));
  return {
    kind: "recette",
    id: r.id,
    eff,
    machine: m,
    perMin,
    energy: r.energyMFps,
    pollution: r.pollutionPerHour ?? (parts ? sum("pollution") : pollutionOf(m)),
    cost: parts ? sum("cost") : (m?.cost ?? null),
    area: parts ? sum("area") : area(m),
    isRaw: !Object.values(perMin).some((v) => v < 0),
    units: parts ? parts.reduce((s, p) => s + p.count, 0) : 1,
    parts,
  };
}

export function buildFlowModel(data: GameData, player: Progress, chooser: Chooser, opts: ModelOptions): FlowModel {
  const items = new Set<string>();
  const usable = new Map<string, string[]>();
  const procs = new Map<string, RecipeProc>();
  const queue: string[] = [];
  const visit = (item: string) => {
    if (items.has(item)) return;
    items.add(item);
    queue.push(item);
  };
  const addRecipe = (eff: EffRecipe) => {
    if (procs.has(eff.recipe.id)) return;
    const p = recipeProc(eff, data.machines);
    procs.set(p.id, p);
    for (const [k, v] of Object.entries(p.perMin)) if (v < 0 && k !== ENERGY) visit(k);
  };

  const sellable = new Map<string, number>();
  if (opts.money) {
    for (const it of data.items.values()) {
      // Objets solides seulement : la capacité des dépôts de liquides n'est pas connue.
      if (it.isFluid !== false || !(it.sellValue! > 0)) continue;
      if (!chooser.usableFor(it.id).length) continue;
      sellable.set(it.id, it.sellValue!);
      visit(it.id);
    }
  }
  for (const t of opts.targets) visit(t);

  const generators: string[] = [];
  const isWater = (k: string) => /(^|-)water$/.test(k);
  if (opts.selfPowered) {
    for (const r of [...data.recipes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!(r.energyMFps !== null && r.energyMFps < 0) || !chooser.isUsable(r)) continue;
      if (opts.guaranteedOnly && r.energyGuaranteed === false) continue;
      if (opts.noFuel && Object.entries(r.inputs).some(([k, v]) => v && !isWater(k) && (r.outputs[k] ?? 0) < v)) continue;
      generators.push(r.id);
      addRecipe(chooser.eff(r));
    }
  }
  if (opts.scrubbers) {
    for (const r of [...data.recipes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!(r.pollutionPerHour !== undefined && r.pollutionPerHour < 0) || !chooser.isUsable(r)) continue;
      addRecipe(chooser.eff(r));
    }
  }

  while (queue.length) {
    const item = queue.shift()!;
    let effs = chooser.usableFor(item);
    const only = opts.restrictTo?.(item);
    if (only) effs = effs.filter((e) => only.includes(e.recipe.id));
    usable.set(item, effs.map((e) => e.recipe.id));
    for (const e of effs) addRecipe(e);
  }
  // Items touchés seulement comme sous-produits : présents dans le bilan, sans recette propre.
  for (const p of procs.values()) for (const k of Object.keys(p.perMin)) if (!items.has(k)) items.add(k);
  const leaves = new Set([...items].filter((i) => !(usable.get(i)?.length)));

  const depots: DepotProc[] = [];
  if (opts.money) {
    for (const d of opts.depots ?? []) {
      if (d.kind !== "objet" || !(d.itemsPerSec! > 0)) continue;
      if (!machineAccess(data, player, d.id).available) continue;
      const m = data.machines.get(d.id);
      depots.push({ kind: "dépôt", id: d.id, name: d.name, itemsPerMin: d.itemsPerSec! * 60, machine: m, cost: m?.cost ?? null, area: area(m) });
    }
  }

  return {
    recipes: [...procs.values()].sort((a, b) => a.id.localeCompare(b.id)),
    items,
    leaves,
    usable,
    sellable,
    depots,
    generators,
  };
}
