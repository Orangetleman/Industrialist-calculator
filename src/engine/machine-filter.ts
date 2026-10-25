// Filtre de machines d'un plan (S9) : écarter certaines machines, ou n'utiliser que celles choisies.
// Pur : aucune dépendance au DOM.

import type { Candidate } from "./choose.ts";
import { itemName, type GameData } from "./data.ts";
import type { Machine, Recipe } from "./types.ts";
import { msg, type Message } from "./message.ts";

export type MachineFilter = {
  /** « exclure » : `ids` sont écartées ; « seulement » : `ids` sont les seules permises (avec l'extraction). */
  mode: "exclure" | "seulement";
  ids: string[];
  /**
   * Mode « seulement » : machines d'extraction écartées quand même. L'extraction est permise d'office
   * dans ce mode (décision Q8), mais on peut en retirer.
   */
  noExtraction?: string[];
};

/** Machine d'extraction : catégorie « Extractors » du wiki (foreuses, pompes, puits…) ou arbre. */
export function isExtractor(m: Machine | undefined): boolean {
  return !!m && (m.category === "Extractors" || m.kind === "farm");
}

/** Un filtre qui ne change rien (mode « exclure » sans machine) vaut « pas de filtre ». */
export function activeFilter(f: MachineFilter | null | undefined): MachineFilter | null {
  if (!f) return null;
  if (f.mode === "exclure" && !f.ids.length) return null;
  return f;
}

/** Test « cette machine est-elle permise ? » ; `only` : mode « seulement ». */
export type AllowedFn = ((machineId: string) => boolean) & { only?: boolean };

/** Fabrique le test « cette machine est-elle permise ? » ; null : toutes le sont. */
export function machineAllowed(data: GameData, filter: MachineFilter | null | undefined): AllowedFn | null {
  const f = activeFilter(filter);
  if (!f) return null;
  const ids = new Set(f.ids);
  if (f.mode === "exclure") return (id) => !ids.has(id);
  const off = new Set(f.noExtraction ?? []);
  return Object.assign((id: string) => ids.has(id) || (isExtractor(data.machines.get(id)) && !off.has(id)), { only: true });
}

/**
 * Recette permise : sa machine, et chaque machine d'une installation composée. En mode
 * « seulement », les blocs d'une ferme d'arbres (S13) suivent l'arbre, qui est de l'extraction.
 */
export function recipeAllowed(allowed: AllowedFn | null, r: Recipe): boolean {
  if (!allowed) return true;
  if (!allowed(r.machine)) return false;
  if (r.farm && allowed.only) return true;
  return !(r.parts ?? []).some((p) => !allowed(p.machine));
}

/** Machines écartées par le filtre parmi les recettes candidates d'un objet. */
export function excludedMachines(candidates: Candidate[]): string[] {
  return [...new Set(candidates.filter((c) => c.status === "écartée").map((c) => c.machine))];
}

/** « Aucune machine permise ne fabrique X » : le message d'un objet que le filtre rend impossible. */
export function excludedMessage(data: GameData, item: string, perMin: number, excluded: string[]): Message {
  const names = excluded.map((m) => data.machines.get(m)?.name ?? m);
  const r = Math.round(perMin * 100) / 100;
  return msg("plan.excluded", { item: itemName(data, item), r, list: { join: names, by: "virgule" }, verb: msg(names.length > 1 ? "plan.excluded.many" : "plan.excluded.one") });
}
