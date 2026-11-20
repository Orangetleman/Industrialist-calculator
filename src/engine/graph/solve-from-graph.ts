// « Recalculer » (PLAN-GRAPHE.md § 2, décision 2) : le graphe devient une requête pour solve().
//   - onlyRecipes : les recettes du graphe (les sous-produits suivent, commit 708ea55) ;
//   - fixedMachines : les nœuds fixés (même recette sur plusieurs nœuds : leurs nombres s'ajoutent) ;
//   - objet et débit : ceux de la cible.
// Le résultat se compare nœud par nœud (avant / après) ; « Appliquer » écrit les nombres, ajoute
// les étapes que le solveur a dû créer (marquées `added`) et ne retire les nœuds inutilisés que si
// le joueur le demande. Le solveur ne se relance jamais tout seul : c'est l'interface qui appelle.

import type { GameData } from "../data.ts";
import { solve, type Plan, type PlayerState, type SolveRequest } from "../solve.ts";
import { ENERGY } from "../resources.ts";
import { COL_W, ROW_H } from "./from-plan.ts";
import { edgeId, nextNodeId, type Graph, type GraphEdge, type GraphNode, type NodeId } from "./model.ts";

const ceilTol = (x: number) => Math.ceil(x - 1e-9);

export type GraphRequestProblem = "sans-cible" | "sans-débit" | "recette-inconnue";

export type GraphRequest = {
  /** null si le graphe ne peut pas devenir une requête (pas de cible, pas de débit). */
  request: SolveRequest | null;
  /** Machines fixées, par recette (à traduire en clés d'étape après un premier calcul). */
  fixedByRecipe: Record<string, number>;
  problems: { code: GraphRequestProblem; id?: string }[];
};

/**
 * Requête pour solve(), sans les machines fixées (leurs clés d'étape ne se connaissent qu'après un
 * premier calcul : voir solveFromGraph). `base` apporte le reste du réglage du plan (critère…).
 */
export function graphToRequest(g: Graph, data: GameData, base: Partial<SolveRequest> = {}): GraphRequest {
  const problems: GraphRequest["problems"] = [];
  const known = g.nodes.filter((n) => data.recipes.has(n.recipeId));
  for (const n of g.nodes) if (!data.recipes.has(n.recipeId)) problems.push({ code: "recette-inconnue", id: n.recipeId });
  const fixedByRecipe: Record<string, number> = {};
  for (const n of known) if (n.fixed) fixedByRecipe[n.recipeId] = (fixedByRecipe[n.recipeId] ?? 0) + n.machines;
  if (!g.target) problems.push({ code: "sans-cible" });
  else if (!(g.rate !== null && g.rate > 0)) problems.push({ code: "sans-débit" });
  if (!g.target || !(g.rate !== null && g.rate > 0)) return { request: null, fixedByRecipe, problems };
  const { fixedMachines: _f, finalMachines: _m, moneyPerMin: _p, energyMFps: _e, demands: _d, ...rest } = base;
  const request: SolveRequest = { ...rest, item: g.target.item, ratePerMin: g.rate, onlyRecipes: [...new Set(known.map((n) => n.recipeId))] };
  return { request, fixedByRecipe, problems };
}

export type GraphSolve = GraphRequest & { plan: Plan | null };

/**
 * Calcule le graphe : un premier plan donne les clés d'étape, puis, s'il y a des nœuds fixés, le
 * calcul avec fixedMachines (le débit devient le plus grand que ces machines permettent).
 */
export function solveFromGraph(data: GameData, player: PlayerState, g: Graph, base: Partial<SolveRequest> = {}): GraphSolve {
  const r = graphToRequest(g, data, base);
  if (!r.request) return { ...r, plan: null };
  const first = solve(data, player, r.request);
  const fixedMachines: Record<string, number> = {};
  for (const [rid, n] of Object.entries(r.fixedByRecipe)) {
    const key = first.steps.find((s) => s.recipeId === rid)?.key;
    if (key) fixedMachines[key] = ceilTol(n);
  }
  if (!Object.keys(fixedMachines).length) return { ...r, plan: first };
  const request = { ...r.request, fixedMachines };
  return { ...r, request, plan: solve(data, player, request) };
}

export type NodeChange = { id: NodeId; recipeId: string; before: number; after: number | null; fixed: boolean };

export type GraphComparison = {
  /** Un nœud par ligne ; `after` null : le solveur n'utilise plus cette recette. */
  nodes: NodeChange[];
  /** Étapes du plan dont la recette n'est sur aucun nœud (le solveur a dû les créer). */
  added: { key: string; recipeId: string; machines: number }[];
  rate: { before: number | null; after: number };
};

/** Avant / après, nœud par nœud. Une recette sur plusieurs nœuds : le nouveau total se partage au prorata. */
export function compareWithPlan(g: Graph, plan: Plan): GraphComparison {
  const exact = new Map<string, number>();
  for (const s of plan.steps) exact.set(s.recipeId, (exact.get(s.recipeId) ?? 0) + s.machinesExact);
  const fixedTotal = new Map<string, number>();
  for (const s of plan.fixed?.steps ?? []) fixedTotal.set(s.recipeId, s.machines);
  const sumBefore = new Map<string, { total: number; count: number }>();
  for (const n of g.nodes) {
    const x = sumBefore.get(n.recipeId) ?? { total: 0, count: 0 };
    sumBefore.set(n.recipeId, { total: x.total + n.machines, count: x.count + 1 });
  }
  const nodes: NodeChange[] = g.nodes.map((n) => {
    const fixed = !!n.fixed;
    if (fixed) return { id: n.id, recipeId: n.recipeId, before: n.machines, after: exact.has(n.recipeId) ? n.machines : null, fixed };
    const total = exact.get(n.recipeId);
    if (total === undefined) return { id: n.id, recipeId: n.recipeId, before: n.machines, after: null, fixed };
    const s = sumBefore.get(n.recipeId)!;
    // Les nœuds fixés de la même recette gardent leur part ; le reste se partage.
    const fixedHere = g.nodes.filter((m) => m.recipeId === n.recipeId && m.fixed).reduce((t, m) => t + m.machines, 0);
    const free = Math.max(0, total - fixedHere);
    const freeBefore = s.total - fixedHere;
    const freeCount = g.nodes.filter((m) => m.recipeId === n.recipeId && !m.fixed).length;
    const after = freeBefore > 0 ? (free * n.machines) / freeBefore : free / freeCount;
    return { id: n.id, recipeId: n.recipeId, before: n.machines, after, fixed };
  });
  const inGraph = new Set(g.nodes.map((n) => n.recipeId));
  const added = plan.steps.filter((s) => !inGraph.has(s.recipeId)).map((s) => ({ key: s.key, recipeId: s.recipeId, machines: s.machinesExact }));
  return { nodes, added, rate: { before: g.rate, after: plan.target.ratePerMin } };
}

/**
 * « Appliquer » : nouveaux nombres, nœuds ajoutés par le solveur (avec leurs liaisons), nœuds
 * inutilisés retirés seulement si `removeUnused`. Rend un nouveau document (commande « replace »).
 */
export function applyComparison(g: Graph, plan: Plan, cmp: GraphComparison, opts: { removeUnused?: boolean } = {}): Graph {
  const after = new Map(cmp.nodes.map((c) => [c.id, c]));
  const drop = new Set(opts.removeUnused ? cmp.nodes.filter((c) => c.after === null).map((c) => c.id) : []);
  let nodes: GraphNode[] = g.nodes.filter((n) => !drop.has(n.id)).map((n) => {
    const c = after.get(n.id);
    return c && c.after !== null && !n.fixed ? { ...n, machines: c.after } : n;
  });
  let edges: GraphEdge[] = g.edges.filter((e) => !drop.has(e.from) && !drop.has(e.to));
  // Étape du plan → nœud du graphe (le premier nœud de la recette).
  const nodeOfStep = new Map<string, NodeId>();
  for (const s of plan.steps) {
    const n = nodes.find((x) => x.recipeId === s.recipeId);
    if (n) nodeOfStep.set(s.key, n.id);
  }
  // Nœuds ajoutés : posés à droite du graphe, les uns sous les autres, à des places libres.
  const right = nodes.length ? Math.max(...nodes.map((n) => n.x)) + COL_W : 0;
  let row = 0;
  let work: Graph = { ...g, nodes, edges };
  for (const a of cmp.added) {
    const id = nextNodeId(work);
    nodes = [...nodes, { id, recipeId: a.recipeId, machines: a.machines, x: right, y: row++ * ROW_H, added: true }];
    nodeOfStep.set(a.key, id);
    work = { ...work, nodes };
  }
  // Liaisons du plan qui touchent un nœud ajouté.
  const addedIds = new Set(nodes.filter((n) => n.added && !g.nodes.some((m) => m.id === n.id)).map((n) => n.id));
  for (const e of plan.edges) {
    const from = nodeOfStep.get(e.from);
    const to = nodeOfStep.get(e.to);
    if (!from || !to || from === to || e.item === ENERGY || (!addedIds.has(from) && !addedIds.has(to))) continue;
    const id = edgeId(from, to, e.item);
    if (!edges.some((x) => x.id === id)) edges = [...edges, { id, from, to, item: e.item }];
  }
  const target = g.target && !drop.has(g.target.node) ? g.target : null;
  return { nodes, edges, target, rate: target ? cmp.rate.after : g.rate };
}
