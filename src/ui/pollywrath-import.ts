// Import d'un graphe du calculateur de Pollywrath (Industrialist Calculator, MIT,
// industrialist-calculator.pages.dev) : le fichier « <Nom>_save.json » de son panneau « Saves ».
// Ses recettes deviennent les recettes imposées du plan (onlyRecipes) et son nœud cible donne
// l'objet et le débit ; notre solveur recalcule les quantités. Les recettes sans équivalent chez
// nous sont signalées, jamais inventées. Correspondance : data/pollywrath-map.json.

import type { GameData } from "../engine/data.ts";
import { t } from "../i18n/i18n.ts";

export type PollywrathMap = { recipes: Record<string, string>; missing: Record<string, string> };

/** Graphe importé, gardé par plan : recettes imposées et leur graphe pour comparer. */
export type ImportedGraph = {
  name: string;
  /** Nos recettes (identifiants chez nous) imposées au solveur. */
  recipes: string[];
  /** Leurs nombres de machines, par recette chez nous (somme des nœuds). */
  theirs: Record<string, number>;
  /** Recettes de leur graphe sans équivalent chez nous : leur identifiant → libellé. */
  unknown: Record<string, string>;
};

export type ImportResult = { item: string; ratePerMin: number; graph: ImportedGraph };

type Node = { type?: string; recipeId?: unknown; machineCount?: unknown; isTarget?: unknown };

/** Lit le fichier ; lève une Error au message traduit si rien n'est utilisable. */
export function parsePollywrathSave(raw: unknown, data: GameData, map: PollywrathMap, fileName = ""): ImportResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as { name?: unknown; data?: { nodes?: unknown }; nodes?: unknown };
  const nodes = Array.isArray(r.data?.nodes) ? r.data!.nodes : Array.isArray(r.nodes) ? r.nodes : null;
  if (!nodes) throw new Error(t("pw.err.format"));
  const recipeNodes = (nodes as Node[]).filter((n) => n && typeof n === "object" && (n.type === undefined || n.type === "recipe") && typeof n.recipeId === "string");
  if (!recipeNodes.length) throw new Error(t("pw.err.empty"));

  const ours = (theirId: string): string | null => {
    const id = map.recipes[theirId];
    return id && data.recipes.has(id) ? id : null;
  };
  const theirs: Record<string, number> = {};
  const unknown: Record<string, string> = {};
  for (const n of recipeNodes) {
    const id = n.recipeId as string;
    const mine = ours(id);
    if (!mine) {
      unknown[id] = map.missing[id] ?? id;
      continue;
    }
    const count = typeof n.machineCount === "number" && Number.isFinite(n.machineCount) && n.machineCount > 0 ? n.machineCount : 0;
    theirs[mine] = (theirs[mine] ?? 0) + count;
  }

  const target = recipeNodes.find((n) => n.isTarget === true);
  if (!target) throw new Error(t("pw.err.noTarget"));
  const tid = target.recipeId as string;
  const tr = ours(tid) ? data.recipes.get(ours(tid)!)! : null;
  if (!tr) throw new Error(t("pw.err.targetUnknown", { id: unknown[tid] ?? tid }));
  const out = Object.entries(tr.outputs).find(([, q]) => typeof q === "number" && q > 0);
  const count = typeof target.machineCount === "number" && target.machineCount > 0 ? target.machineCount : 0;
  if (!out || !tr.durationS || !count) throw new Error(t("pw.err.targetRate"));
  const ratePerMin = Math.round(((count * (out[1] as number)) / tr.durationS) * 60 * 1000) / 1000;

  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : fileName.replace(/(_save)?\.json$/i, "") || "Industrialist Calculator";
  return { item: out[0], ratePerMin, graph: { name, recipes: Object.keys(theirs), theirs, unknown } };
}

/** Relit un graphe gardé dans les réglages (localStorage) : null s'il est abîmé. */
export function cleanImportedGraph(raw: unknown): ImportedGraph | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<ImportedGraph>;
  if (typeof g.name !== "string" || !Array.isArray(g.recipes)) return null;
  const recipes = g.recipes.filter((x): x is string => typeof x === "string");
  if (!recipes.length) return null;
  const nums = (o: unknown) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v)));
  const strs = (o: unknown) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([, v]) => typeof v === "string"));
  return { name: g.name, recipes, theirs: nums(g.theirs), unknown: strs(g.unknown) };
}
