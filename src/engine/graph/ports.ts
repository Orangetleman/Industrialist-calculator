// Prises d'un nœud : les objets que sa recette consomme (entrées) et produit (sorties), en bilan
// net par cycle (un objet à la fois consommé et rendu ne compte que pour la différence), comme le
// solveur. Les quantités viennent de data/recipes.json via evalRecipe (pollution, mois, fermes).

import { evalRecipe, type EffRecipe } from "../choose.ts";
import type { GameData } from "../data.ts";
import { ENERGY } from "../resources.ts";

/** Réglages de partie qui changent les quantités des recettes (S50). */
export type GraphWorld = { pollutionPct?: number | null; month?: number | null; igloo?: boolean; /** Nombre entier posé par le plan au-delà de l'arrondi, par recette (débit partagé entre des tuyaux). */ extra?: Record<string, { exact: number; whole: number }> };

export type Ports = {
  /** Objets consommés, dans l'ordre de la recette (entrées puis sorties nettes négatives). */
  ins: string[];
  outs: string[];
  /** Recette évaluée ; null si la recette est inconnue. */
  eff: EffRecipe | null;
};

const memo = new WeakMap<GameData, Map<string, Ports>>();

export function recipePorts(data: GameData, recipeId: string, world: GraphWorld = {}): Ports {
  let byKey = memo.get(data);
  if (!byKey) memo.set(data, (byKey = new Map()));
  const key = `${recipeId}|${world.pollutionPct ?? ""}|${world.month ?? ""}|${world.igloo ? 1 : 0}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  const recipe = data.recipes.get(recipeId);
  let out: Ports;
  if (!recipe) out = { ins: [], outs: [], eff: null };
  else {
    const eff = evalRecipe(data, recipe, world.pollutionPct ?? null, { month: world.month ?? null, igloo: world.igloo ?? false });
    const ins: string[] = [];
    const outs: string[] = [];
    // Ordre : celui de la recette (entrées d'abord), pour que les prises restent stables à l'écran.
    for (const k of [...Object.keys(eff.recipe.inputs), ...Object.keys(eff.recipe.outputs)]) {
      if (k === ENERGY || ins.includes(k) || outs.includes(k)) continue;
      const n = eff.net[k];
      // Quantité inconnue (null) : la prise existe quand même, du côté où la recette la range.
      if (n === null || n === undefined) (Object.hasOwn(eff.recipe.outputs, k) ? outs : ins).push(k);
      else if (n < 0) ins.push(k);
      else if (n > 0) outs.push(k);
    }
    out = { ins, outs, eff };
  }
  byKey.set(key, out);
  return out;
}

/**
 * Produit principal d'une recette : la sortie au plus fort débit (la première en cas d'égalité).
 * Sert de titre au nœud et de produit par défaut quand on le marque comme cible.
 */
export function mainOutput(data: GameData, recipeId: string, world: GraphWorld = {}): string | null {
  const p = recipePorts(data, recipeId, world);
  let best: string | null = null;
  let q = -Infinity;
  for (const k of p.outs) {
    const n = p.eff?.net[k] ?? 0;
    if (n !== null && n > q) [best, q] = [k, n];
  }
  return best;
}
