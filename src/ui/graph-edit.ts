// Graphe édité de Planifier (PLAN-GRAPHE.md, lot G4) : l'état qui raccorde l'éditeur au reste du site.
//   - `graph` : le document affiché et édité dans l'onglet Schéma ;
//   - `solved` : le document tel qu'au dernier « Recalculer » → « Appliquer ». Tant qu'il existe et que
//     l'objectif n'a pas changé, le plan du site (tableau de bord, rail, Usine, plans de pose) se calcule
//     depuis lui (solveFromGraph), et plus depuis la proposition brute ;
//   - `sig` : l'objectif pour lequel ce graphe vaut (goalSig de main.ts) ;
//   - `touched` : le joueur l'a modifié (un nouveau plan ne l'écrase plus sans prévenir).
// Enregistré au rechargement et dans les plans enregistrés, au format du fichier (file.ts). Pur, sans DOM.

import { compareWithPlan, readGraphFile, writeGraphFile, type Graph, type NodeId } from "../engine/graph/index.ts";
import type { Plan } from "../engine/solve.ts";

export type GraphEdit = { sig: string; graph: Graph; solved: Graph | null; touched: boolean };

/** Ce qui s'enregistre (localStorage, plan enregistré) : les deux documents au format du fichier. */
export type StoredGraphEdit = { v: 1; sig: string; graph: string; solved: string | null; touched: boolean };

export function storeGraphEdit(e: GraphEdit): StoredGraphEdit {
  return { v: 1, sig: e.sig, graph: writeGraphFile(e.graph), solved: e.solved ? writeGraphFile(e.solved) : null, touched: e.touched };
}

/** Relit un état enregistré ; null si abîmé (on repart de la proposition, sans rien deviner). */
export function loadGraphEdit(raw: unknown): GraphEdit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<StoredGraphEdit>;
  if (r.v !== 1 || typeof r.sig !== "string" || typeof r.graph !== "string") return null;
  try {
    const graph = readGraphFile(r.graph).graph;
    const solved = typeof r.solved === "string" ? readGraphFile(r.solved).graph : null;
    return { sig: r.sig, graph, solved, touched: r.touched === true || !!solved };
  } catch {
    return null;
  }
}

/**
 * Étape du plan → nœud du graphe, par recette : chaque étape prend le premier nœud de sa recette pas
 * encore pris (une recette sur deux étapes : deux nœuds). Vaut pour la proposition (plan → graphe) comme
 * pour un plan recalculé depuis le graphe.
 */
export function linkSteps(plan: Plan, g: Graph): Map<string, NodeId> {
  const out = new Map<string, NodeId>();
  const used = new Set<NodeId>();
  for (const s of plan.steps) {
    const n = g.nodes.find((x) => x.recipeId === s.recipeId && !used.has(x.id));
    if (!n) continue;
    used.add(n.id);
    out.set(s.key, n.id);
  }
  return out;
}

/**
 * Les liens étape → nœud posés avec le plan (`linkSteps`), après un geste : seuls restent ceux dont le
 * nœud est encore là avec la recette de l'étape. Aucun lien nouveau : un nœud ajouté à la main n'est
 * pas l'étape du plan de même recette (sa fiche montrait les nombres du plan, remarque de G6) ; un
 * nœud supprimé puis rendu par Ctrl Z retrouve le sien, puisqu'on repart toujours des liens d'origine.
 */
export function keepLinks(base: Map<string, NodeId>, plan: Plan, g: Graph): Map<string, NodeId> {
  const out = new Map<string, NodeId>();
  const recipe = new Map(g.nodes.map((n) => [n.id, n.recipeId]));
  for (const s of plan.steps) {
    const id = base.get(s.key);
    if (id && recipe.get(id) === s.recipeId) out.set(s.key, id);
  }
  return out;
}

/**
 * Le plan affiché correspond-il encore au graphe ? Faux dès qu'un nombre de machines, une recette, la
 * cible ou le débit diffère (les positions et les liaisons ne comptent pas : le solveur relie par produit).
 */
export function graphMatchesPlan(g: Graph, plan: Plan): boolean {
  if (compareWithPlan(g, plan).added.length) return false;
  // Machines par recette : celles du graphe face à celles du plan (exactes ; pour une étape fixée, le
  // nombre fixé). Un nœud dont la recette n'est plus dans le plan (gardé à l'« Appliquer ») ne compte pas.
  const fixedKeys = new Set((plan.fixed?.steps ?? []).map((s) => s.key));
  const want = new Map<string, number>();
  for (const s of plan.steps) want.set(s.recipeId, (want.get(s.recipeId) ?? 0) + (fixedKeys.has(s.key) ? s.machines : s.machinesExact));
  const have = new Map<string, number>();
  for (const n of g.nodes) if (want.has(n.recipeId)) have.set(n.recipeId, (have.get(n.recipeId) ?? 0) + n.machines);
  for (const [r, w] of want) if (Math.abs((have.get(r) ?? 0) - w) > 1e-6 * Math.max(1, w)) return false;
  if (g.target && plan.target.kind === "objet" && g.target.item !== plan.target.item) return false;
  if (g.rate !== null && Math.abs(g.rate - plan.target.ratePerMin) > 1e-6 * Math.max(1, g.rate)) return false;
  return true;
}
