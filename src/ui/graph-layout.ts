// Disposition du graphe des flux (pur, sans DOM) : une rangée par profondeur,
// l'item final en haut, les matières premières en bas, comme la référence.
// Ordre dans chaque rangée : barycentre des consommateurs (limite les croisements).

import type { Plan } from "../engine/solve.ts";
import { fmt } from "./format.ts";

export const NODE_W = 140;
export const NODE_H = 60;
const GAP_X = 26;
const GAP_Y = 78;
const MARGIN = 14;

export type GNode = { item: string; x: number; y: number; depth: number; kind: "final" | "step" | "raw" | "unresolved" };
export type GEdge = { from: string; to: string; perMin: number; x1: number; y1: number; x2: number; y2: number; lx: number; ly: number };
export type GraphLayout = { nodes: GNode[]; edges: GEdge[]; width: number; height: number };

export function layoutGraph(plan: Pick<Plan, "steps" | "unresolved" | "edges" | "target">): GraphLayout {
  const depth = new Map<string, number>();
  const kind = new Map<string, GNode["kind"]>();
  for (const s of plan.steps) {
    depth.set(s.item, s.depth);
    kind.set(s.item, s.item === plan.target.item ? "final" : s.isRaw ? "raw" : "step");
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

  const rows: string[][] = [];
  for (const [item, d] of depth) (rows[d] ??= []).push(item);
  for (let d = 0; d < rows.length; d++) rows[d] ??= [];

  const xCenter = new Map<string, number>();
  const consumersOf = (item: string) => plan.edges.filter((e) => e.from === item).map((e) => e.to);
  for (let d = 0; d < rows.length; d++) {
    const row = rows[d]!;
    if (d > 0) {
      const bary = (it: string) => {
        const xs = consumersOf(it).map((c) => xCenter.get(c)).filter((x): x is number => x !== undefined);
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Infinity;
      };
      const b = new Map(row.map((it) => [it, bary(it)]));
      row.sort((a, c) => b.get(a)! - b.get(c)! || a.localeCompare(c));
    }
    row.forEach((it, i) => xCenter.set(it, i * (NODE_W + GAP_X)));
  }

  const maxCount = Math.max(1, ...rows.map((r) => r.length));
  const width = MARGIN * 2 + maxCount * NODE_W + (maxCount - 1) * GAP_X;
  const nodes: GNode[] = [];
  rows.forEach((row, d) => {
    const rowW = row.length * NODE_W + (row.length - 1) * GAP_X;
    const x0 = (width - rowW) / 2;
    row.forEach((it, i) => {
      const x = x0 + i * (NODE_W + GAP_X);
      xCenter.set(it, x + NODE_W / 2);
      nodes.push({ item: it, x, y: MARGIN + d * (NODE_H + GAP_Y), depth: d, kind: kind.get(it)! });
    });
  });
  const height = MARGIN * 2 + rows.length * NODE_H + (rows.length - 1) * GAP_Y;

  // Points d'ancrage répartis sur la largeur du nœud, triés pour éviter les croisements.
  const pos = new Map(nodes.map((n) => [n.item, n]));
  const anchors = (list: { key: string; other: number }[]) => {
    const sorted = [...list].sort((a, b) => a.other - b.other);
    const out = new Map<string, number>();
    sorted.forEach((x, i) => out.set(x.key, ((i + 1) / (sorted.length + 1) - 0.5) * (NODE_W - 24)));
    return out;
  };
  const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;
  const outAnchor = new Map<string, number>();
  const inAnchor = new Map<string, number>();
  for (const n of nodes) {
    const outs = plan.edges.filter((e) => e.from === n.item).map((e) => ({ key: edgeKey(e), other: xCenter.get(e.to) ?? 0 }));
    const ins = plan.edges.filter((e) => e.to === n.item).map((e) => ({ key: edgeKey(e), other: xCenter.get(e.from) ?? 0 }));
    for (const [k, v] of anchors(outs)) outAnchor.set(k, v);
    for (const [k, v] of anchors(ins)) inAnchor.set(k, v);
  }
  const edges: GEdge[] = [];
  const placed: Box[] = nodes.map((n) => ({ x: n.x, y: n.y, w: NODE_W, h: NODE_H }));
  for (const e of plan.edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const k = edgeKey(e);
    const x1 = a.x + NODE_W / 2 + (outAnchor.get(k) ?? 0);
    const y1 = a.y;
    const x2 = b.x + NODE_W / 2 + (inAnchor.get(k) ?? 0);
    const y2 = b.y + NODE_H + 3;
    // Étiquette de préférence juste sous le consommateur ; si la place est prise
    // (nœud ou autre étiquette), on la fait glisser le long de la flèche.
    const len = Math.max(1, y1 - y2);
    const w = labelWidth(e.perMin);
    const preferred = Math.min(0.5, (GAP_Y * 0.55) / len);
    const tries = [preferred, 0.3, 0.42, 0.55, 0.68, 0.8, 0.2].filter((t, i, arr) => arr.indexOf(t) === i);
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
    edges.push({ from: e.from, to: e.to, perMin: e.perMin, x1, y1, x2, y2, lx, ly });
  }
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
