// Plan du solveur → graphe (PLAN-GRAPHE.md § 4) : chaque étape devient un nœud (sa recette, son
// nombre exact de machines), chaque flux entre deux étapes une arête. Les flux venant d'un manque
// ou d'une production existante n'ont pas de nœud : leur entrée reste à alimenter (manque visible).
// Disposition provisoire par profondeur, de l'extraction (à gauche) à l'objectif (à droite) ;
// « Aligner » (graph-layout.ts) la remplacera.

import { ENERGY } from "../resources.ts";
import type { Plan } from "../solve.ts";
import { edgeId, type Graph, type GraphEdge, type GraphNode } from "./model.ts";

/** Écart entre colonnes et entre lignes de la disposition provisoire (pixels du canevas). */
export const COL_W = 320;
export const ROW_H = 200;

export type PlanGraph = {
  graph: Graph;
  /** Clé d'étape du plan → nœud. */
  nodeOfStep: Map<string, string>;
};

export function planToGraph(plan: Plan): PlanGraph {
  const nodeOfStep = new Map<string, string>();
  const maxDepth = Math.max(0, ...plan.steps.map((s) => s.depth));
  const rowAt = new Map<number, number>();
  const fixedKeys = new Set((plan.fixed?.steps ?? []).map((f) => f.key));
  const nodes: GraphNode[] = plan.steps.map((s, i) => {
    const id = `n${i + 1}`;
    nodeOfStep.set(s.key, id);
    const row = rowAt.get(s.depth) ?? 0;
    rowAt.set(s.depth, row + 1);
    const fixed = fixedKeys.has(s.key);
    return {
      id,
      recipeId: s.recipeId,
      // Un nombre fixé reste celui du joueur ; sinon le nombre exact qui équilibre la chaîne.
      machines: fixed ? s.machines : s.machinesExact,
      ...(fixed ? { fixed: true } : {}),
      x: (maxDepth - s.depth) * COL_W,
      y: row * ROW_H,
    };
  });
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const e of plan.edges) {
    const from = nodeOfStep.get(e.from);
    const to = nodeOfStep.get(e.to);
    if (!from || !to || from === to || e.item === ENERGY) continue;
    const id = edgeId(from, to, e.item);
    if (seen.has(id)) continue;
    seen.add(id);
    edges.push({ id, from, to, item: e.item });
  }
  const finalKey = plan.target.kind === "objet" ? plan.finals.find((k) => nodeOfStep.has(k) && plan.steps.find((s) => s.key === k)?.item === plan.target.item) : undefined;
  const target = finalKey ? { node: nodeOfStep.get(finalKey)!, item: plan.target.item } : null;
  return { graph: { nodes, edges, target, rate: target && plan.target.ratePerMin > 0 ? plan.target.ratePerMin : null }, nodeOfStep };
}
