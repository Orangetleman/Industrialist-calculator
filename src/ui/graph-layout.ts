// Disposition du graphe des flux (pur, sans DOM) : une rangée par profondeur,
// l'item final en haut, les matières premières en bas, comme la référence.
// Une flèche qui saute plusieurs rangées passe par des points de passage invisibles
// placés dans les rangées intermédiaires : elle contourne les nœuds au lieu de les traverser.
// Ordre dans chaque rangée : barycentre des consommateurs (limite les croisements).

import type { Plan } from "../engine/solve.ts";
import { fmt } from "./format.ts";

export const NODE_W = 140;
export const NODE_H = 60;
const VIRTUAL_W = 14;
const GAP_X = 26;
const GAP_VIRTUAL = 8;
const GAP_Y = 78;
const MARGIN = 14;

/** `item` est l'identifiant du nœud : clé de l'étape (souvent l'item), ou item non produit. */
export type GNode = { item: string; x: number; y: number; depth: number; kind: "final" | "step" | "raw" | "unresolved" };
/** `loop` : arc de retour d'une boucle (sous-produit qui remonte la chaîne), tracé à part. */
export type GEdge = { from: string; to: string; perMin: number; points: [number, number][]; lx: number; ly: number; loop?: boolean };
export type GraphLayout = { nodes: GNode[]; edges: GEdge[]; width: number; height: number };

type Ent = { id: string; virtual: boolean; w: number; x: number; up: string[] };

export function layoutGraph(plan: Pick<Plan, "steps" | "unresolved" | "edges" | "target" | "finals">): GraphLayout {
  const depth = new Map<string, number>();
  const kind = new Map<string, GNode["kind"]>();
  for (const s of plan.steps) {
    depth.set(s.key, s.depth);
    kind.set(s.key, plan.finals.includes(s.key) ? "final" : s.isRaw ? "raw" : "step");
  }
  for (const u of plan.unresolved) {
    if (depth.has(u.item)) continue; // produit ailleurs (manque dû à une boucle) : pas de second nœud
    const consumers = plan.edges.filter((e) => e.from === u.item).map((e) => depth.get(e.to) ?? 0);
    depth.set(u.item, u.item === plan.target.item ? 0 : consumers.length ? Math.max(...consumers) + 1 : 1);
    kind.set(u.item, "unresolved");
  }
  // Les feuilles non résolues peuvent dépendre d'autres feuilles : recalcul jusqu'à stabilité.
  for (let i = 0; i < 5; i++) {
    for (const e of plan.edges) {
      const d = (depth.get(e.to) ?? 0) + 1;
      if ((depth.get(e.from) ?? 0) < d && kind.get(e.from) === "unresolved") depth.set(e.from, d);
    }
  }

  // Entités par rangée : les nœuds réels + les points de passage des longues flèches.
  const rows: Ent[][] = [];
  const ent = new Map<string, Ent>();
  const add = (d: number, e: Ent) => {
    (rows[d] ??= []).push(e);
    ent.set(e.id, e);
  };
  for (const [item, d] of depth) add(d, { id: item, virtual: false, w: NODE_W, x: 0, up: [] });
  const chains: string[][] = []; // par flèche : [consommateur, points…, producteur]
  plan.edges.forEach((e, i) => {
    const dc = depth.get(e.to);
    const dp = depth.get(e.from);
    if (dc === undefined || dp === undefined) {
      chains.push([]);
      return;
    }
    if (e.loop || dp <= dc) {
      chains.push([e.to, e.from]); // arc de retour : ni points de passage, ni influence sur l'ordre
      return;
    }
    const chain = [e.to];
    for (let d = dc + 1; d < dp; d++) {
      const id = `~${i}:${d}`;
      add(d, { id, virtual: true, w: VIRTUAL_W, x: 0, up: [] });
      chain.push(id);
    }
    chain.push(e.from);
    for (let k = 1; k < chain.length; k++) ent.get(chain[k]!)!.up.push(chain[k - 1]!);
    chains.push(chain);
  });
  for (let d = 0; d < rows.length; d++) rows[d] ??= [];

  const gapBetween = (a: Ent, b: Ent) => (a.virtual || b.virtual ? GAP_VIRTUAL : GAP_X);
  const placeRow = (row: Ent[]) => {
    let x = 0;
    row.forEach((e, i) => {
      if (i) x += gapBetween(row[i - 1]!, e);
      e.x = x + e.w / 2; // centre provisoire
      x += e.w;
    });
    return x;
  };
  for (let d = 0; d < rows.length; d++) {
    const row = rows[d]!;
    if (d > 0) {
      const bary = (e: Ent) => {
        const xs = e.up.map((u) => ent.get(u)!.x);
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Infinity;
      };
      const b = new Map(row.map((e) => [e.id, bary(e)]));
      row.sort((a, c) => b.get(a.id)! - b.get(c.id)! || Number(a.virtual) - Number(c.virtual) || a.id.localeCompare(c.id));
    }
    placeRow(row);
  }

  const rowWidths = rows.map((r) => placeRow(r));
  // Place à droite pour les arcs de retour des boucles.
  const loopRoom = plan.edges.some((e) => e.loop) ? 80 : 0;
  const width = MARGIN * 2 + Math.max(NODE_W, ...rowWidths) + loopRoom;
  const nodes: GNode[] = [];
  const top = (d: number) => MARGIN + d * (NODE_H + GAP_Y);
  rows.forEach((row, d) => {
    const x0 = (width - loopRoom - rowWidths[d]!) / 2;
    for (const e of row) {
      e.x += x0; // centre définitif
      if (!e.virtual) nodes.push({ item: e.id, x: e.x - NODE_W / 2, y: top(d), depth: d, kind: kind.get(e.id)! });
    }
  });
  const height = MARGIN * 2 + rows.length * NODE_H + (rows.length - 1) * GAP_Y;

  // Points d'ancrage répartis sur la largeur du nœud, triés selon la direction de la flèche.
  const anchors = (list: { key: number; other: number }[]) => {
    const sorted = [...list].sort((a, b) => a.other - b.other);
    const out = new Map<number, number>();
    sorted.forEach((x, i) => out.set(x.key, ((i + 1) / (sorted.length + 1) - 0.5) * (NODE_W - 24)));
    return out;
  };
  const outAnchor = new Map<number, number>();
  const inAnchor = new Map<number, number>();
  for (const n of nodes) {
    const outs: { key: number; other: number }[] = [];
    const ins: { key: number; other: number }[] = [];
    chains.forEach((c, i) => {
      if (c.length < 2) return;
      if (c.at(-1) === n.item) outs.push({ key: i, other: ent.get(c.at(-2)!)!.x });
      if (c[0] === n.item) ins.push({ key: i, other: ent.get(c[1]!)!.x });
    });
    for (const [k, v] of anchors(outs)) outAnchor.set(k, v);
    for (const [k, v] of anchors(ins)) inAnchor.set(k, v);
  }

  const edges: GEdge[] = [];
  const placed: Box[] = nodes.map((n) => ({ x: n.x, y: n.y, w: NODE_W, h: NODE_H }));
  plan.edges.forEach((e, i) => {
    const chain = chains[i]!;
    if (chain.length < 2) return;
    const prod = ent.get(e.from)!;
    const cons = ent.get(e.to)!;
    const dp = depth.get(e.from)!;
    const dc = depth.get(e.to)!;
    if (e.loop || dp <= dc) {
      // Couloir réservé sur le bord droit : du producteur au couloir, puis vers le consommateur,
      // en angles droits, sans traverser de nœud.
      const lane = width - MARGIN - loopRoom / 2;
      // Les tronçons horizontaux passent entre les rangées, là où il n'y a pas de nœud.
      const px = prod.x + NODE_W / 2 - 14;
      const cx = cons.x + NODE_W / 2 - 14;
      const below = top(dp) + NODE_H + GAP_Y * 0.3;
      const above = top(dc) - GAP_Y * 0.3;
      const points: [number, number][] = [
        [px, top(dp) + NODE_H],
        [px, below],
        [lane, below],
        [lane, above],
        [cx, above],
        [cx, top(dc) - 3],
      ];
      edges.push({ from: e.from, to: e.to, perMin: e.perMin, points, lx: lane, ly: (below + above) / 2, loop: true });
      return;
    }
    const points: [number, number][] = [[prod.x + (outAnchor.get(i) ?? 0), top(dp)]];
    // Points de passage, du producteur (bas) vers le consommateur (haut).
    for (let k = chain.length - 2; k >= 1; k--) {
      const v = ent.get(chain[k]!)!;
      const d = dc + k;
      points.push([v.x, top(d) + NODE_H], [v.x, top(d)]);
    }
    points.push([cons.x + (inAnchor.get(i) ?? 0), top(dc) + NODE_H + 3]);

    // Étiquette sur le dernier tronçon, de préférence juste sous le consommateur ;
    // si la place est prise (nœud ou autre étiquette), elle glisse le long du tronçon.
    const [x1, y1] = points.at(-2)!;
    const [x2, y2] = points.at(-1)!;
    const len = Math.max(1, y1 - y2);
    const w = labelWidth(e.perMin);
    const preferred = Math.min(0.5, (GAP_Y * 0.55) / len);
    const tries = [preferred, 0.3, 0.42, 0.55, 0.68, 0.8, 0.2].filter((t, j, arr) => arr.indexOf(t) === j);
    let best = { t: preferred, hits: Infinity };
    for (const t of tries) {
      const lx = x2 + (x1 - x2) * t;
      const ly = y2 + (y1 - y2) * t;
      const box = { x: lx - w / 2, y: ly - LABEL_H / 2, w, h: LABEL_H };
      const hits = placed.filter((p) => overlap(box, p)).length;
      if (hits < best.hits) best = { t, hits };
      if (!hits) break;
    }
    const lx = x2 + (x1 - x2) * best.t;
    const ly = y2 + (y1 - y2) * best.t;
    placed.push({ x: lx - w / 2, y: ly - LABEL_H / 2, w, h: LABEL_H });
    edges.push({ from: e.from, to: e.to, perMin: e.perMin, points, lx, ly });
  });
  return { nodes, edges, width, height };
}

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const LABEL_H = 16;

/** Texte et largeur estimée d'une étiquette de flux (police mono 9,5 px). */
export function labelText(perMin: number): string {
  return `${fmt(perMin, 1)}/min`;
}
export function labelWidth(perMin: number): number {
  return labelText(perMin).length * 5.8 + 12;
}

/** Tracé SVG d'une flèche : segments droits, coins légèrement arrondis aux points de passage. */
export function edgePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}
