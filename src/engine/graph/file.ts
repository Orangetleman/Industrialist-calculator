// Fichier du graphe (PLAN-GRAPHE.md § 2, décision 4) : notre JSON, simple et versionné.
//   { "format": "industrialist-graph", "version": 1, "name": "...", "graph": { nodes, edges, target, rate } }
// Lecture prudente : ce qui est abîmé est écarté et signalé, jamais deviné ; un fichier d'une
// version plus récente est refusé (on ne sait pas ce qu'il contient).

import { edgeId, GraphError, type Graph, type GraphEdge, type GraphNode } from "./model.ts";

export const GRAPH_FORMAT = "industrialist-graph";
export const GRAPH_VERSION = 1;

export type GraphFile = { format: typeof GRAPH_FORMAT; version: number; name?: string; graph: Graph };

export type FileWarningCode = "nœud-abîmé" | "id-en-double" | "arête-abîmée" | "arête-orpheline" | "arête-en-double" | "cible-abîmée" | "débit-abîmé";
export type FileWarning = { code: FileWarningCode; at: number | string };


/** Écrit le document : champs dans un ordre fixe, pour qu'un aller-retour donne le même texte. */
export function writeGraphFile(g: Graph, name?: string): string {
  const node = (n: GraphNode) => ({
    id: n.id,
    recipeId: n.recipeId,
    machines: n.machines,
    ...(n.fixed ? { fixed: true } : {}),
    ...(n.settings && Object.keys(n.settings).length ? { settings: n.settings } : {}),
    x: n.x,
    y: n.y,
    ...(n.group ? { group: n.group } : {}),
    ...(n.added ? { added: true } : {}),
  });
  const file = {
    format: GRAPH_FORMAT,
    version: GRAPH_VERSION,
    ...(name ? { name } : {}),
    graph: {
      nodes: g.nodes.map(node),
      edges: g.edges.map((e) => ({ from: e.from, to: e.to, item: e.item })),
      target: g.target ? { node: g.target.node, item: g.target.item } : null,
      rate: g.rate,
    },
  };
  return JSON.stringify(file, null, 1) + "\n";
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown): x is string => typeof x === "string" && x.length > 0;

/**
 * Relit un fichier (texte ou objet déjà parsé). Lève une GraphError (`pas-un-graphe`,
 * `version-future`) si rien n'est utilisable ; sinon rend le graphe et ce qui a été écarté.
 * Les recettes inconnues sont gardées telles quelles : l'équilibre les signale (« recette inconnue »).
 */
export function readGraphFile(raw: unknown): { graph: Graph; name: string | null; warnings: FileWarning[] } {
  let r = raw;
  if (typeof r === "string") {
    try {
      r = JSON.parse(r);
    } catch {
      throw new GraphError("pas-un-graphe", "JSON");
    }
  }
  if (!isObj(r) || r.format !== GRAPH_FORMAT || !isObj(r.graph)) throw new GraphError("pas-un-graphe");
  if (!num(r.version) || r.version > GRAPH_VERSION) throw new GraphError("version-future", String(r.version));
  const warnings: FileWarning[] = [];
  const gr = r.graph;

  const nodes: GraphNode[] = [];
  (Array.isArray(gr.nodes) ? gr.nodes : []).forEach((x: unknown, i: number) => {
    if (!isObj(x) || !str(x.id) || !str(x.recipeId) || !num(x.machines) || x.machines < 0) return warnings.push({ code: "nœud-abîmé", at: i });
    if (nodes.some((n) => n.id === x.id)) return warnings.push({ code: "id-en-double", at: x.id });
    nodes.push({
      id: x.id,
      recipeId: x.recipeId,
      machines: x.machines,
      ...(x.fixed === true ? { fixed: true } : {}),
      ...(isObj(x.settings) && Object.keys(x.settings).length ? { settings: x.settings } : {}),
      x: num(x.x) ? x.x : 0,
      y: num(x.y) ? x.y : 0,
      ...(str(x.group) ? { group: x.group } : {}),
      ...(x.added === true ? { added: true } : {}),
    });
  });
  const ids = new Set(nodes.map((n) => n.id));

  const edges: GraphEdge[] = [];
  (Array.isArray(gr.edges) ? gr.edges : []).forEach((x: unknown, i: number) => {
    if (!isObj(x) || !str(x.from) || !str(x.to) || !str(x.item) || x.from === x.to) return warnings.push({ code: "arête-abîmée", at: i });
    if (!ids.has(x.from) || !ids.has(x.to)) return warnings.push({ code: "arête-orpheline", at: i });
    const id = edgeId(x.from, x.to, x.item);
    if (edges.some((e) => e.id === id)) return warnings.push({ code: "arête-en-double", at: id });
    edges.push({ id, from: x.from, to: x.to, item: x.item });
  });

  let target: Graph["target"] = null;
  if (gr.target !== null && gr.target !== undefined) {
    const t = gr.target;
    if (isObj(t) && str(t.node) && str(t.item) && ids.has(t.node)) target = { node: t.node, item: t.item };
    else warnings.push({ code: "cible-abîmée", at: "target" });
  }
  let rate: number | null = null;
  if (gr.rate !== null && gr.rate !== undefined) {
    if (num(gr.rate) && gr.rate > 0) rate = gr.rate;
    else warnings.push({ code: "débit-abîmé", at: "rate" });
  }
  return { graph: { nodes, edges, target, rate }, name: str(r.name) ? r.name : null, warnings };
}
