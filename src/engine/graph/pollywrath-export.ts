// Export du graphe vers le format d'Industrialist Calculator (Pollywrath, MIT) : le fichier
// « <Nom>_save.json » que son panneau « Saves » relit. La table data/pollywrath-map.json (leur
// recette → la nôtre, établie par contenu) est inversée ; une recette sans équivalent chez eux est
// signalée et son nœud laissé de côté, jamais remplacée par une autre.
//
// Leurs arêtes désignent les prises par leur rang dans la liste des entrées / sorties de la recette.
// On prend le rang dans nos listes (data/recipes.json) : sur le graphe tutoriel « Gearbox » de leur
// dépôt, les 21 arêtes entre recettes connues tombent toutes juste ainsi (voir data/a-verifier.md).

import type { GameData } from "../data.ts";
import type { Graph, NodeId } from "./model.ts";

/** Même forme que la table lue par l'import (src/ui/pollywrath-import.ts). */
export type PollywrathMapFile = { recipes: Record<string, string>; missing?: Record<string, string> };

export type PollywrathNode = {
  id: string;
  type: "recipe";
  recipeId: string;
  machineCount: number;
  inputOrder: number[];
  outputOrder: number[];
  position: { x: number; y: number };
  settings: Record<string, never>;
  isTarget?: true;
};
export type PollywrathEdge = { id: string; source: string; sourceIndex: number; target: string; targetIndex: number };
export type PollywrathSave = {
  id: string;
  name: string;
  timestamp: number;
  data: { version: 2; nodes: PollywrathNode[]; edges: PollywrathEdge[]; globalSettings?: { global_pollution: number } };
};

export type PollywrathExport = {
  save: PollywrathSave;
  /** Nœuds laissés de côté : leur recette n'a pas d'équivalent dans leur calculateur. */
  missing: { node: NodeId; recipeId: string }[];
  /** Liaisons perdues avec ces nœuds. */
  droppedEdges: number;
  /** La cible fait partie des nœuds laissés de côté (leur graphe n'aura pas de cible). */
  targetLost: boolean;
};

/** Notre recette → la leur (la première dans l'ordre alphabétique si plusieurs y mènent). */
export function invertPollywrathMap(map: PollywrathMapFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const theirs of Object.keys(map.recipes).sort()) {
    const ours = map.recipes[theirs]!;
    if (!out.has(ours)) out.set(ours, theirs);
  }
  return out;
}

export function exportPollywrath(
  g: Graph,
  data: GameData,
  map: PollywrathMapFile,
  opts: { name?: string; pollutionPct?: number | null; now?: number } = {},
): PollywrathExport {
  const inverse = invertPollywrathMap(map);
  const now = opts.now ?? Date.now();
  const tag = now.toString(36);
  const theirId = (id: NodeId) => `n-${tag}-${id}`;
  const missing: PollywrathExport["missing"] = [];
  const nodes: PollywrathNode[] = [];
  const kept = new Set<NodeId>();
  for (const n of g.nodes) {
    const theirs = inverse.get(n.recipeId);
    const r = data.recipes.get(n.recipeId);
    if (!theirs || !r) {
      missing.push({ node: n.id, recipeId: n.recipeId });
      continue;
    }
    kept.add(n.id);
    const range = (k: number) => Array.from({ length: k }, (_, i) => i);
    nodes.push({
      id: theirId(n.id),
      type: "recipe",
      recipeId: theirs,
      machineCount: n.machines,
      inputOrder: range(Object.keys(r.inputs).length),
      outputOrder: range(Object.keys(r.outputs).length),
      position: { x: Math.round(n.x), y: Math.round(n.y) },
      settings: {},
      ...(g.target?.node === n.id ? { isTarget: true as const } : {}),
    });
  }
  const edges: PollywrathEdge[] = [];
  let droppedEdges = 0;
  for (const e of g.edges) {
    const a = g.nodes.find((n) => n.id === e.from);
    const b = g.nodes.find((n) => n.id === e.to);
    const sourceIndex = a ? Object.keys(data.recipes.get(a.recipeId)?.outputs ?? {}).indexOf(e.item) : -1;
    const targetIndex = b ? Object.keys(data.recipes.get(b.recipeId)?.inputs ?? {}).indexOf(e.item) : -1;
    if (!kept.has(e.from) || !kept.has(e.to) || sourceIndex < 0 || targetIndex < 0) {
      droppedEdges++;
      continue;
    }
    edges.push({ id: `e-${tag}-${edges.length}`, source: theirId(e.from), sourceIndex, target: theirId(e.to), targetIndex });
  }
  const save: PollywrathSave = {
    id: `save-${tag}-0`,
    name: opts.name?.trim() || "Industrialist",
    timestamp: now,
    data: { version: 2, nodes, edges, ...(typeof opts.pollutionPct === "number" ? { globalSettings: { global_pollution: opts.pollutionPct } } : {}) },
  };
  return { save, missing, droppedEdges, targetLost: !!g.target && !kept.has(g.target.node) };
}
