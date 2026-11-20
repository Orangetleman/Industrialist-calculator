// Document graphe de l'éditeur (PLAN-GRAPHE.md § 4, lot G1) : nœuds (une recette et son nombre de
// machines), arêtes (d'une sortie vers une entrée, pour un produit), cible et débit. Le document
// est immuable : chaque geste est une commande qui rend un nouveau document, et l'historique garde
// les précédents (annuler / rétablir). Pur, sans DOM.

import type { GameData } from "../data.ts";
import { mainOutput, recipePorts, type GraphWorld } from "./ports.ts";

export type NodeId = string;

export type GraphNode = {
  id: NodeId;
  recipeId: string;
  /** Nombre de machines ; décimal permis (affiché entier vers le haut, l'exact dans la bulle). */
  machines: number;
  /** Nombre fixé par le joueur : « Recalculer » le garde, « Mettre la chaîne à l'échelle » ne le touche pas. */
  fixed?: boolean;
  /** Réglages propres au nœud (écran de la Chemical Plant, diesel, Mineshaft…), lus à partir de G5. */
  settings?: Record<string, unknown>;
  x: number;
  y: number;
  group?: string;
  /** Nœud ajouté par « Recalculer » (le solveur en avait besoin), à signaler au joueur. */
  added?: boolean;
};

export type GraphEdge = {
  /** `from>to:item` : une seule arête par paire de prises. */
  id: string;
  from: NodeId;
  to: NodeId;
  item: string;
};

export type GraphTarget = { node: NodeId; item: string };

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  target: GraphTarget | null;
  /** Débit voulu pour la cible, par minute (la phrase d'objectif). */
  rate: number | null;
};

export const emptyGraph = (): Graph => ({ nodes: [], edges: [], target: null, rate: null });

export const edgeId = (from: NodeId, to: NodeId, item: string): string => `${from}>${to}:${item}`;

/** Identifiant libre : n1, n2… (le plus petit numéro au-dessus de ceux déjà pris). */
export function nextNodeId(g: Graph): NodeId {
  let max = 0;
  for (const n of g.nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `n${max + 1}`;
}

export type GraphCommand =
  | { type: "addNode"; node: Omit<GraphNode, "id"> & { id?: NodeId } }
  | { type: "removeNode"; id: NodeId }
  | { type: "addEdge"; from: NodeId; to: NodeId; item: string }
  | { type: "removeEdge"; id: string }
  | { type: "setMachines"; id: NodeId; machines: number }
  | { type: "replaceRecipe"; id: NodeId; recipeId: string }
  | { type: "setFixed"; id: NodeId; fixed: boolean }
  /** Marque la cible (produit : le principal de la recette par défaut) ; null l'efface. */
  | { type: "setTarget"; id: NodeId | null; item?: string }
  | { type: "setRate"; rate: number | null }
  | { type: "move"; moves: { id: NodeId; x: number; y: number }[] }
  /** Le nœud passe à `machines`, et tout ce qui l'alimente (en amont) suit le même rapport. */
  | { type: "scaleChain"; id: NodeId; machines: number }
  /** Plusieurs commandes en un seul pas d'annulation (ajouter une recette et la relier…). */
  | { type: "batch"; commands: GraphCommand[] }
  /** Remplace tout le document (proposition du solveur, « Appliquer », fichier ouvert). */
  | { type: "replace"; graph: Graph };

export type GraphErrorCode =
  | "nœud-inconnu"
  | "arête-inconnue"
  | "recette-inconnue"
  | "id-pris"
  | "nombre-invalide"
  | "même-nœud"
  | "pas-une-sortie"
  | "pas-une-entrée"
  | "arête-existe"
  | "produit-absent"
  | "pas-un-graphe"
  | "version-future";

/** Geste refusé : `code` se traduit dans l'interface (la prise secoue en rouge…). */
export class GraphError extends Error {
  readonly code: GraphErrorCode;
  readonly detail: string;
  constructor(code: GraphErrorCode, detail = "") {
    super(detail ? `${code} : ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

const validCount = (n: number) => Number.isFinite(n) && n >= 0;

function nodeOf(g: Graph, id: NodeId): GraphNode {
  const n = g.nodes.find((x) => x.id === id);
  if (!n) throw new GraphError("nœud-inconnu", id);
  return n;
}

/** La liaison est-elle possible ? null si oui, sinon la raison (même règle que la commande). */
export function linkError(g: Graph, data: GameData, from: NodeId, to: NodeId, item: string, world: GraphWorld = {}): GraphErrorCode | null {
  const a = g.nodes.find((x) => x.id === from);
  const b = g.nodes.find((x) => x.id === to);
  if (!a || !b) return "nœud-inconnu";
  if (from === to) return "même-nœud";
  if (!recipePorts(data, a.recipeId, world).outs.includes(item)) return "pas-une-sortie";
  if (!recipePorts(data, b.recipeId, world).ins.includes(item)) return "pas-une-entrée";
  if (g.edges.some((e) => e.id === edgeId(from, to, item))) return "arête-existe";
  return null;
}

const patchNode = (g: Graph, id: NodeId, f: (n: GraphNode) => GraphNode): Graph => {
  nodeOf(g, id);
  return { ...g, nodes: g.nodes.map((n) => (n.id === id ? f(n) : n)) };
};

/**
 * Applique une commande ; lève une GraphError si elle est impossible (le document n'est pas
 * modifié). `data` sert à vérifier les prises (liaisons, remplacement de recette, cible).
 */
export function applyCommand(g: Graph, cmd: GraphCommand, data: GameData, world: GraphWorld = {}): Graph {
  switch (cmd.type) {
    case "addNode": {
      const id = cmd.node.id ?? nextNodeId(g);
      if (g.nodes.some((n) => n.id === id)) throw new GraphError("id-pris", id);
      if (!data.recipes.has(cmd.node.recipeId)) throw new GraphError("recette-inconnue", cmd.node.recipeId);
      if (!validCount(cmd.node.machines)) throw new GraphError("nombre-invalide", String(cmd.node.machines));
      return { ...g, nodes: [...g.nodes, { ...cmd.node, id }] };
    }
    case "removeNode": {
      nodeOf(g, cmd.id);
      return {
        ...g,
        nodes: g.nodes.filter((n) => n.id !== cmd.id),
        edges: g.edges.filter((e) => e.from !== cmd.id && e.to !== cmd.id),
        target: g.target?.node === cmd.id ? null : g.target,
      };
    }
    case "addEdge": {
      const err = linkError(g, data, cmd.from, cmd.to, cmd.item, world);
      if (err) throw new GraphError(err, edgeId(cmd.from, cmd.to, cmd.item));
      return { ...g, edges: [...g.edges, { id: edgeId(cmd.from, cmd.to, cmd.item), from: cmd.from, to: cmd.to, item: cmd.item }] };
    }
    case "removeEdge": {
      if (!g.edges.some((e) => e.id === cmd.id)) throw new GraphError("arête-inconnue", cmd.id);
      return { ...g, edges: g.edges.filter((e) => e.id !== cmd.id) };
    }
    case "setMachines": {
      if (!validCount(cmd.machines)) throw new GraphError("nombre-invalide", String(cmd.machines));
      return patchNode(g, cmd.id, (n) => ({ ...n, machines: cmd.machines }));
    }
    case "replaceRecipe": {
      if (!data.recipes.has(cmd.recipeId)) throw new GraphError("recette-inconnue", cmd.recipeId);
      const p = recipePorts(data, cmd.recipeId, world);
      // Les liaisons dont le produit existe encore du bon côté restent ; les autres tombent.
      const edges = g.edges.filter((e) => (e.from === cmd.id ? p.outs.includes(e.item) : e.to === cmd.id ? p.ins.includes(e.item) : true));
      let target = g.target;
      if (target?.node === cmd.id && !p.outs.includes(target.item)) {
        const main = mainOutput(data, cmd.recipeId, world);
        target = main ? { node: cmd.id, item: main } : null;
      }
      // Les réglages appartenaient à l'ancienne recette.
      const out = patchNode(g, cmd.id, ({ settings: _s, ...n }) => ({ ...n, recipeId: cmd.recipeId }));
      return { ...out, edges, target };
    }
    case "setFixed":
      return patchNode(g, cmd.id, ({ fixed: _f, ...n }) => (cmd.fixed ? { ...n, fixed: true } : n));
    case "setTarget": {
      if (cmd.id === null) return { ...g, target: null };
      const n = nodeOf(g, cmd.id);
      const item = cmd.item ?? mainOutput(data, n.recipeId, world);
      if (!item || !recipePorts(data, n.recipeId, world).outs.includes(item)) throw new GraphError("produit-absent", `${cmd.id}:${cmd.item ?? ""}`);
      return { ...g, target: { node: cmd.id, item } };
    }
    case "setRate": {
      if (cmd.rate !== null && !(Number.isFinite(cmd.rate) && cmd.rate > 0)) throw new GraphError("nombre-invalide", String(cmd.rate));
      return { ...g, rate: cmd.rate };
    }
    case "move": {
      const at = new Map(cmd.moves.map((m) => [m.id, m]));
      for (const id of at.keys()) nodeOf(g, id);
      return { ...g, nodes: g.nodes.map((n) => (at.has(n.id) ? { ...n, x: at.get(n.id)!.x, y: at.get(n.id)!.y } : n)) };
    }
    case "scaleChain": {
      const start = nodeOf(g, cmd.id);
      if (!validCount(cmd.machines) || !(start.machines > 0)) throw new GraphError("nombre-invalide", String(cmd.machines));
      const k = cmd.machines / start.machines;
      // Remontée par les arêtes entrantes ; un nœud fixé garde son nombre et arrête la remontée.
      const scaled = new Set<NodeId>([cmd.id]);
      const queue = [cmd.id];
      while (queue.length) {
        const id = queue.shift()!;
        for (const e of g.edges) {
          if (e.to !== id || scaled.has(e.from)) continue;
          if (g.nodes.find((n) => n.id === e.from)?.fixed) continue;
          scaled.add(e.from);
          queue.push(e.from);
        }
      }
      return { ...g, nodes: g.nodes.map((n) => (n.id === cmd.id ? { ...n, machines: cmd.machines } : scaled.has(n.id) ? { ...n, machines: n.machines * k } : n)) };
    }
    case "batch":
      return cmd.commands.reduce((acc, c) => applyCommand(acc, c, data, world), g);
    case "replace":
      return cmd.graph;
  }
}

/** Historique du document : chaque commande réussie est un pas d'annulation. */
export class GraphHistory {
  private past: Graph[] = [];
  private future: Graph[] = [];
  private current: Graph;
  private readonly data: GameData;
  private readonly world: GraphWorld;
  /** Pas gardés au plus. */
  private readonly limit: number;

  constructor(graph: Graph, data: GameData, world: GraphWorld = {}, limit = 100) {
    this.current = graph;
    this.data = data;
    this.world = world;
    this.limit = limit;
  }

  get graph(): Graph {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Applique la commande ; une commande refusée lève une GraphError et ne touche pas l'historique. */
  apply(cmd: GraphCommand): Graph {
    const next = applyCommand(this.current, cmd, this.data, this.world);
    if (next === this.current) return next;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.current = next;
    return next;
  }

  undo(): Graph {
    const prev = this.past.pop();
    if (prev) {
      this.future.push(this.current);
      this.current = prev;
    }
    return this.current;
  }

  redo(): Graph {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }
}
