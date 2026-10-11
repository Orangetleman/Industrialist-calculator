// Disposition de l'arbre de recherche « comme en jeu » (pur, sans DOM) :
// une colonne par palier, de gauche à droite, liens coudés parent → enfant.

import type { GameData } from "../engine/data.ts";
import type { ResearchCategory } from "../engine/types.ts";
import { nodeDepths } from "../engine/unlock.ts";

export const RN_W = 168;
export const RN_H = 44;
const GAP_X = 56;
const GAP_Y = 14;
const MARGIN = 24;

export type RNode = { id: string; x: number; y: number; depth: number };
export type REdge = { from: string; to: string; d: string };
export type ResearchLayout = { nodes: RNode[]; edges: REdge[]; width: number; height: number };

export function layoutResearch(data: GameData, category: ResearchCategory): ResearchLayout {
  const depths = nodeDepths(data);
  const ids = [...data.nodes.values()].filter((n) => n.category === category).map((n) => n.id);
  const inCat = new Set(ids);
  const cols: string[][] = [];
  for (const id of ids) (cols[depths.get(id) ?? 0] ??= []).push(id);
  for (let i = 0; i < cols.length; i++) cols[i] ??= [];
  const name = (id: string) => data.nodes.get(id)?.name ?? id;
  for (const c of cols) c.sort((a, b) => name(a).localeCompare(name(b)));

  // Ordre dans chaque colonne : barycentre des parents puis des enfants (quelques passes).
  const index = new Map<string, number>();
  const reindex = () => cols.forEach((c) => c.forEach((id, i) => index.set(id, i)));
  reindex();
  const bary = (list: string[], fallback: number) => {
    const xs = list.filter((x) => inCat.has(x) && index.has(x)).map((x) => index.get(x)!);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback;
  };
  for (let pass = 0; pass < 4; pass++) {
    for (let d = 1; d < cols.length; d++) {
      cols[d]!.sort((a, b) => bary(data.nodes.get(a)!.parents, index.get(a)!) - bary(data.nodes.get(b)!.parents, index.get(b)!) || name(a).localeCompare(name(b)));
      reindex();
    }
    for (let d = cols.length - 2; d >= 1; d--) {
      cols[d]!.sort((a, b) => bary(data.nodes.get(a)!.children, index.get(a)!) - bary(data.nodes.get(b)!.children, index.get(b)!) || name(a).localeCompare(name(b)));
      reindex();
    }
  }

  // Placement vertical : chaque nœud au plus près de la moyenne de ses parents, sans chevauchement.
  const y = new Map<string, number>();
  const row = RN_H + GAP_Y;
  cols.forEach((c, d) => {
    let next = 0;
    for (const id of c) {
      const parents = data.nodes.get(id)!.parents.filter((p) => y.has(p));
      const want = d === 0 || !parents.length ? next : parents.reduce((s, p) => s + y.get(p)!, 0) / parents.length;
      const pos = Math.max(want, next);
      y.set(id, pos);
      next = pos + row;
    }
  });
  // Passe inverse : un parent remonte/descend vers le centre de ses enfants si la place le permet.
  for (let d = cols.length - 2; d >= 0; d--) {
    const c = cols[d]!;
    for (let i = 0; i < c.length; i++) {
      const id = c[i]!;
      const kids = data.nodes.get(id)!.children.filter((k) => y.has(k) && inCat.has(k));
      if (!kids.length) continue;
      const want = kids.reduce((s, k) => s + y.get(k)!, 0) / kids.length;
      const min = i > 0 ? y.get(c[i - 1]!)! + row : 0;
      const max = i < c.length - 1 ? y.get(c[i + 1]!)! - row : Infinity;
      y.set(id, Math.min(Math.max(want, min), max));
    }
  }

  const nodes: RNode[] = [];
  cols.forEach((c, d) => c.forEach((id) => nodes.push({ id, depth: d, x: MARGIN + d * (RN_W + GAP_X), y: MARGIN + y.get(id)! })));
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const edges: REdge[] = [];
  for (const n of nodes) {
    for (const p of data.nodes.get(n.id)!.parents) {
      const a = pos.get(p);
      if (!a) continue;
      const x1 = a.x + RN_W;
      const y1 = a.y + RN_H / 2;
      const x2 = n.x;
      const y2 = n.y + RN_H / 2;
      const xm = x2 - GAP_X / 2;
      edges.push({ from: p, to: n.id, d: `M${x1},${y1} H${xm} V${y2} H${x2}` });
    }
  }
  const width = MARGIN * 2 + cols.length * RN_W + (cols.length - 1) * GAP_X;
  const height = MARGIN * 2 + Math.max(RN_H, ...nodes.map((n) => n.y - MARGIN + RN_H));
  return { nodes, edges, width, height };
}
