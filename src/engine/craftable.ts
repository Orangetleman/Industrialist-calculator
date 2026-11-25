import type { GameData } from "./data.ts";
import { solve } from "./solve.ts";

/**
 * Objets que le calcul sait fabriquer, toutes recherches faites. Une recette complète (durée et quantités connues)
 * suffit ; les quelques objets sans recette de ce genre sont demandés au calcul, qui connaît des cas particuliers.
 */
export function craftableItems(data: GameData): Set<string> {
  const out = new Set<string>();
  for (const r of data.recipes.values()) {
    if (!(r.durationS && r.durationS > 0)) continue;
    if ([...Object.values(r.inputs), ...Object.values(r.outputs)].some((q) => q === null || q === undefined)) continue;
    for (const id of Object.keys(r.outputs)) out.add(id);
  }
  const unlocked = new Set(data.nodes.keys());
  for (const id of data.items.keys())
    if (!out.has(id) && solve(data, { unlocked, pollutionPct: 0 }, { item: id, ratePerMin: 60, tiers: false }).steps.length) out.add(id);
  return out;
}
