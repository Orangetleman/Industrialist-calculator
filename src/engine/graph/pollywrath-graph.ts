// Import d'un graphe d'Industrialist Calculator (Pollywrath, MIT) dans l'éditeur (lot G5) : leur fichier
// « <Nom>_save.json » devient notre document, nœud pour nœud (recette, nombre de machines, position) et
// arête pour arête, avec leur cible. La table data/pollywrath-map.json donne nos recettes ; une recette
// sans équivalent chez nous est signalée et son nœud laissé de côté, jamais remplacée par une autre.
// Leurs arêtes désignent les prises par leur rang dans la liste des sorties / entrées de la recette (même
// règle que l'export, voir data/a-verifier.md, GRA-01) ; une arête dont les deux bouts ne tombent pas sur le
// même produit est écartée et comptée.

import type { GameData } from "../data.ts";
import { edgeId, type Graph, type GraphEdge, type GraphNode, type NodeId } from "./model.ts";
import { mainOutput, recipePorts, type GraphWorld } from "./ports.ts";
import type { PollywrathMapFile } from "./pollywrath-export.ts";

export type PollywrathGraph = {
  graph: Graph;
  name: string;
  /** Leurs recettes sans équivalent chez nous : leur identifiant → libellé (table), nombre de nœuds. */
  unknown: { id: string; label: string; nodes: number }[];
  /** Arêtes écartées : un bout sur un nœud laissé de côté, ou des produits qui ne correspondent pas. */
  droppedEdges: number;
  /** Leur graphe avait une cible, mais sur un nœud laissé de côté. */
  targetLost: boolean;
};

type TheirNode = { id?: unknown; type?: unknown; recipeId?: unknown; machineCount?: unknown; position?: { x?: unknown; y?: unknown }; isTarget?: unknown };
type TheirEdge = { source?: unknown; sourceIndex?: unknown; target?: unknown; targetIndex?: unknown };

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Rend null si le fichier n'est pas un graphe de leur format (pas de liste de nœuds). */
export function pollywrathToGraph(raw: unknown, data: GameData, map: PollywrathMapFile, opts: { world?: GraphWorld; fileName?: string } = {}): PollywrathGraph | null {
  const world = opts.world ?? {};
  const r = (raw && typeof raw === "object" ? raw : {}) as { name?: unknown; data?: { nodes?: unknown; edges?: unknown }; nodes?: unknown; edges?: unknown };
  const list = Array.isArray(r.data?.nodes) ? r.data!.nodes : Array.isArray(r.nodes) ? r.nodes : null;
  if (!list) return null;
  const edgesIn = (Array.isArray(r.data?.edges) ? r.data!.edges : Array.isArray(r.edges) ? r.edges : []) as TheirEdge[];
  const nodes: GraphNode[] = [];
  const ours = new Map<string, NodeId>(); // leur identifiant de nœud → le nôtre
  const unknown = new Map<string, { id: string; label: string; nodes: number }>();
  let target: Graph["target"] = null;
  let targetLost = false;
  let rate: number | null = null;
  for (const n of list as TheirNode[]) {
    if (!n || typeof n !== "object" || (n.type !== undefined && n.type !== "recipe") || typeof n.recipeId !== "string") continue;
    const mine = map.recipes[n.recipeId];
    if (!mine || !data.recipes.has(mine)) {
      const u = unknown.get(n.recipeId) ?? { id: n.recipeId, label: map.missing?.[n.recipeId] ?? n.recipeId, nodes: 0 };
      u.nodes++;
      unknown.set(n.recipeId, u);
      if (n.isTarget === true) targetLost = true;
      continue;
    }
    const id = `n${nodes.length + 1}`;
    if (typeof n.id === "string") ours.set(n.id, id);
    const machines = num(n.machineCount) && n.machineCount >= 0 ? n.machineCount : 1;
    nodes.push({ id, recipeId: mine, machines, x: num(n.position?.x) ? Math.round(n.position!.x) : 0, y: num(n.position?.y) ? Math.round(n.position!.y) : 0 });
    if (n.isTarget === true && !target) {
      const item = mainOutput(data, mine, world);
      if (item) {
        target = { node: id, item };
        const rc = data.recipes.get(mine)!;
        const q = rc.outputs[item];
        if (typeof q === "number" && q > 0 && rc.durationS && machines > 0) rate = Math.round(((machines * q) / rc.durationS) * 60 * 1000) / 1000;
      }
    }
  }
  const edges: GraphEdge[] = [];
  let droppedEdges = 0;
  for (const e of edgesIn) {
    const from = typeof e?.source === "string" ? ours.get(e.source) : undefined;
    const to = typeof e?.target === "string" ? ours.get(e.target) : undefined;
    const a = from ? nodes.find((n) => n.id === from) : undefined;
    const b = to ? nodes.find((n) => n.id === to) : undefined;
    const out = a && num(e.sourceIndex) ? Object.keys(data.recipes.get(a.recipeId)!.outputs)[e.sourceIndex] : undefined;
    const inp = b && num(e.targetIndex) ? Object.keys(data.recipes.get(b.recipeId)!.inputs)[e.targetIndex] : undefined;
    const ok =
      a && b && out && out === inp && a.id !== b.id && recipePorts(data, a.recipeId, world).outs.includes(out) && recipePorts(data, b.recipeId, world).ins.includes(out) && !edges.some((x) => x.id === edgeId(a.id, b.id, out));
    if (!ok) {
      droppedEdges++;
      continue;
    }
    edges.push({ id: edgeId(a!.id, b!.id, out!), from: a!.id, to: b!.id, item: out! });
  }
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : (opts.fileName ?? "").replace(/(_save)?\.json$/i, "") || "Industrialist Calculator";
  return { graph: { nodes, edges, target, rate }, name, unknown: [...unknown.values()], droppedEdges, targetLost };
}
