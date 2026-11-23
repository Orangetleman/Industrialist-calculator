// Gestes d'édition du graphe (PLAN-GRAPHE.md § 3, lot G3), en pur : chaque geste du canevas devient
// ici une commande du modèle (model.ts), annulable par GraphHistory. Le canevas (src/ui/graph-view.ts)
// ne fait que lire le pointeur et appeler ces fonctions ; elles se testent sans navigateur.

import type { GameData } from "../data.ts";
import { ENERGY, recipeProc } from "../resources.ts";
import type { GraphBalance } from "./balance.ts";
import { edgeId, type Graph, type GraphCommand, type NodeId } from "./model.ts";
import { mainOutput, recipePorts, type GraphWorld } from "./ports.ts";

const EPS = 1e-7;

/** Côté d'une prise : entrée (à gauche du nœud) ou sortie (à droite). */
export type Side = "in" | "out";
export type PortRef = { node: NodeId; item: string; side: Side };

// ------------------------------------------------------------------ modes (Alt / Maj / Ctrl)

/** Ce que fait un clic : supprimer, marquer la cible, ajouter à la sélection, relier ; null : le clic ordinaire. */
export type Mode = "del" | "target" | "multi" | "link";
export type Mods = { altKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };

/** Mode d'une touche tenue, d'après ses drapeaux. */
export function modeOfKeys(m: Mods): Mode | null {
  return m.altKey ? "del" : m.shiftKey ? "target" : m.ctrlKey || m.metaKey ? "multi" : null;
}

/**
 * Mode du clic : les touches lues sur le clic lui-même d'abord (exigence du § 6), puis une touche
 * tenue vue au clavier, puis l'outil choisi dans la barre.
 */
export function clickMode(m: Mods, held: Mode | null, tool: Mode | null): Mode | null {
  return modeOfKeys(m) ?? held ?? tool;
}

/** D'où vient le mode affiché dans le rappel : touche tenue ou outil de la barre. */
export function modeSource(held: Mode | null, tool: Mode | null): { mode: Mode; from: "key" | "tool" } | null {
  if (held) return { mode: held, from: "key" };
  if (tool) return { mode: tool, from: "tool" };
  return null;
}

// ------------------------------------------------------------------ recettes proposées

/** Recettes qui produisent `item` (« Produire ») ou le consomment (« Consommer »), produit principal d'abord. */
export function recipesFor(data: GameData, item: string, dir: "produce" | "consume", world: GraphWorld = {}): string[] {
  const out: { id: string; main: boolean }[] = [];
  for (const id of data.recipes.keys()) {
    const p = recipePorts(data, id, world);
    if (dir === "produce" ? p.outs.includes(item) : p.ins.includes(item)) out.push({ id, main: dir === "produce" ? mainOutput(data, id, world) === item : true });
  }
  return [...out.filter((x) => x.main), ...out.filter((x) => !x.main)].map((x) => x.id);
}

/** Recettes qui produisent de l'énergie (générateurs), onglet « Énergie ». */
export function energyRecipes(data: GameData): string[] {
  return [...data.recipes.values()].filter((r) => (r.energyMFps ?? 0) < 0 || Object.hasOwn(r.outputs, ENERGY)).map((r) => r.id);
}

/** Recettes qui peuvent remplacer celle d'un nœud : celles qui font le même produit principal (elle comprise). */
export function recipeAlternatives(data: GameData, recipeId: string, world: GraphWorld = {}): string[] {
  const main = mainOutput(data, recipeId, world);
  if (!main) return [recipeId];
  const list = recipesFor(data, main, "produce", world);
  return list.includes(recipeId) ? list : [recipeId, ...list];
}

/** Débit d'un produit pour une machine, par minute (valeur absolue) ; null si la recette ne se calcule pas. */
export function perMachine(data: GameData, recipeId: string, item: string, world: GraphWorld = {}): number | null {
  const eff = recipePorts(data, recipeId, world).eff;
  if (!eff || !(eff.durationS && eff.durationS > 0) || eff.net[item] === null || eff.net[item] === undefined) return null;
  const q = Math.abs(recipeProc(eff, data.machines).perMin[item] ?? 0);
  return q > 0 ? q : null;
}

/** Nombre de machines (exact) pour faire passer `perMin` de `item` ; 1 si la recette ne se calcule pas. */
export function countFor(data: GameData, recipeId: string, item: string, perMin: number, world: GraphWorld = {}): number {
  const q = perMachine(data, recipeId, item, world);
  return q && perMin > EPS ? perMin / q : 1;
}

/**
 * Ce qu'il faut à une prise : pour une entrée, ce qui lui manque (ou toute sa demande si rien ne
 * manque) ; pour une sortie, ce qu'elle ne donne pas encore (ou toute sa production).
 */
export function needAt(bal: GraphBalance, port: PortRef): number {
  const nb = bal.nodes.get(port.node);
  const p = nb?.[port.side === "in" ? "ins" : "outs"].find((x) => x.item === port.item);
  if (!p) return 0;
  const gap = p.perMin - p.flow;
  return gap > EPS ? gap : p.perMin;
}

// ------------------------------------------------------------------ place libre

export type Size = { w: number; h: number };
export type Pt = { x: number; y: number };

/**
 * Place libre la plus proche de `want` pour un nœud de taille `size` : jamais sur un autre nœud
 * (exigence du § 6), à `gap` près. On descend et on monte par pas de 30, puis on décale d'une colonne.
 */
export function freeSpot(g: Graph, want: Pt, size: Size, sizeOf: (id: NodeId) => Size, gap = 24): Pt {
  const hits = (x: number, y: number) =>
    g.nodes.some((o) => {
      const s = sizeOf(o.id);
      return o.x < x + size.w + gap && x < o.x + s.w + gap && o.y < y + size.h + gap && y < o.y + s.h + gap;
    });
  for (let col = 0; col < 8; col++) {
    const xs = col === 0 ? [want.x] : [want.x - col * (size.w + gap), want.x + col * (size.w + gap)];
    for (const x of xs)
      for (let k = 0; k < 40; k++)
        for (const y of k ? [want.y + k * 30, want.y - k * 30] : [want.y]) if (!hits(x, y)) return { x: Math.round(x), y: Math.round(y) };
  }
  // Tout est pris autour : sous le nœud le plus bas.
  return { x: Math.round(want.x), y: Math.round(Math.max(...g.nodes.map((n) => n.y + sizeOf(n.id).h)) + gap) };
}

// ------------------------------------------------------------------ ajouter, relier, supprimer

/** Identifiant neuf, jamais réutilisé dans la session : au-dessus des nœuds présents et de `seq`. */
export function freshId(g: Graph, seq: number): { id: NodeId; seq: number } {
  let max = seq;
  for (const n of g.nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return { id: `n${max + 1}`, seq: max + 1 };
}

/**
 * Ajouter une recette (palette, ou clic sur une ligne d'un nœud) : un seul pas d'annulation. Depuis
 * une entrée, le nouveau nœud la produit et lui est relié, avec assez de machines pour ce qui lui
 * manque ; depuis une sortie, il la consomme. Sans prise, une machine.
 */
export function addRecipeCommand(
  data: GameData,
  recipeId: string,
  o: { id: NodeId; at: Pt; from?: { port: PortRef; perMin: number }; world?: GraphWorld },
): GraphCommand {
  const world = o.world ?? {};
  const f = o.from;
  const machines = f ? countFor(data, recipeId, f.port.item, f.perMin, world) : 1;
  const add: GraphCommand = { type: "addNode", node: { id: o.id, recipeId, machines, x: o.at.x, y: o.at.y } };
  if (!f) return add;
  const p = recipePorts(data, recipeId, world);
  // La recette choisie n'a pas la prise voulue (onglet Énergie…) : le nœud s'ajoute sans liaison.
  const ok = f.port.side === "in" ? p.outs.includes(f.port.item) : p.ins.includes(f.port.item);
  if (!ok) return { type: "addNode", node: { ...add.node, machines: 1 } };
  const edge: GraphCommand = f.port.side === "in" ? { type: "addEdge", from: o.id, to: f.port.node, item: f.port.item } : { type: "addEdge", from: f.port.node, to: o.id, item: f.port.item };
  return { type: "batch", commands: [add, edge] };
}

/** Pourquoi deux prises ne se relient pas (la prise secoue en rouge), ou la commande qui les relie. */
export type LinkRefusal = "même-côté" | "autre-produit" | "même-nœud" | "existe";

export function linkCommand(g: Graph, a: PortRef, b: PortRef): { cmd: GraphCommand } | { refused: LinkRefusal } {
  if (a.side === b.side) return { refused: "même-côté" };
  if (a.item !== b.item) return { refused: "autre-produit" };
  if (a.node === b.node) return { refused: "même-nœud" };
  const [out, inp] = a.side === "out" ? [a, b] : [b, a];
  if (g.edges.some((e) => e.id === edgeId(out.node, inp.node, out.item))) return { refused: "existe" };
  return { cmd: { type: "addEdge", from: out.node, to: inp.node, item: out.item } };
}

/** Prise aimantée : la plus proche du pointeur, à `radius` près (22 px d'écran, exigence du § 6). */
export function snapPort<T extends Pt>(ports: T[], p: Pt, radius: number): T | null {
  let best: T | null = null;
  let bd = radius;
  for (const q of ports) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bd) [best, bd] = [q, d];
  }
  return best;
}

/** Supprimer des nœuds (leurs liaisons partent avec eux) et des liaisons : un seul pas ; null si rien. */
export function deleteCommand(g: Graph, nodes: Iterable<NodeId>, edges: Iterable<string> = []): GraphCommand | null {
  const ids = new Set([...nodes].filter((id) => g.nodes.some((n) => n.id === id)));
  const commands: GraphCommand[] = [];
  for (const id of new Set(edges)) {
    const e = g.edges.find((x) => x.id === id);
    if (e && !ids.has(e.from) && !ids.has(e.to)) commands.push({ type: "removeEdge", id });
  }
  for (const id of ids) commands.push({ type: "removeNode", id });
  return commands.length ? (commands.length === 1 ? commands[0]! : { type: "batch", commands }) : null;
}

/** Maj + clic : marque la cible (le produit cliqué, sinon le principal) ; sur la cible déjà marquée, l'efface. */
export function targetCommand(g: Graph, node: NodeId, item?: string): GraphCommand {
  const t = g.target;
  if (t && t.node === node && (item === undefined || item === t.item)) return { type: "setTarget", id: null };
  return item === undefined ? { type: "setTarget", id: node } : { type: "setTarget", id: node, item };
}

// ------------------------------------------------------------------ nombre de machines (bulle)

/** − / + et molette : d'un entier au suivant (de 2,4 : + donne 4, − donne 2), jamais sous 1. */
export function stepCount(n: number, delta: 1 | -1): number {
  const whole = Math.ceil(n - 1e-9);
  if (delta > 0) return whole + 1;
  return Math.max(1, (Math.abs(whole - n) > 1e-9 ? Math.floor(n) : whole - 1) || 1);
}

/** Nombre saisi (« 2,5 », « 3 ») : positif, sinon null. */
export function parseCount(s: string): number | null {
  const v = Number(s.trim().replace(/\s/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Le nombre du nœud, seul ou avec toute la chaîne en amont au même rapport (« Mettre la chaîne à l'échelle »).
 * Un nombre choisi à la main est fixé (cadenas) dans le même pas d'annulation : sans cela, « Recalculer »
 * remettait la valeur de la proposition sans que le joueur comprenne pourquoi (remarque de G6).
 */
export function countCommand(g: Graph, id: NodeId, machines: number, chain: boolean): GraphCommand {
  const n = g.nodes.find((x) => x.id === id);
  const set: GraphCommand = chain && n && n.machines > 0 ? { type: "scaleChain", id, machines } : { type: "setMachines", id, machines };
  return n && !n.fixed ? { type: "batch", commands: [set, { type: "setFixed", id, fixed: true }] } : set;
}
