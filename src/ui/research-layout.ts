// Disposition de l'arbre de recherche « comme en jeu » (pur, sans DOM).
//
// Même logique que le canevas du jeu :
// - une colonne par palier (plus long chemin depuis la racine), de gauche à droite ;
// - les enfants dans l'ordre des données (Module:RS/Data), qui est celui du jeu ;
// - chaque parent centré sur ses enfants, les sous-arbres empilés au plus serré
//   (ils peuvent s'imbriquer d'une colonne à l'autre sans se chevaucher) ;
// - un nœud à plusieurs parents est rangé sous le dernier rencontré, les autres
//   liens sont tracés quand même.
// Le wiki ne donne pas les coordonnées exactes du jeu : c'est une reconstruction.

import type { GameData } from "../engine/data.ts";
import type { ResearchCategory } from "../engine/types.ts";
import { nodeDepths } from "../engine/unlock.ts";

export const RN_W = 176;
export const RN_H = 46;
const GAP_X = 52;
const ROW = RN_H + 12; // une rangée de la grille
const MARGIN = 28;

export type RNode = { id: string; x: number; y: number; depth: number };
export type REdge = { from: string; to: string; d: string };
export type ResearchLayout = { nodes: RNode[]; edges: REdge[]; width: number; height: number };

/** Contour d'un sous-arbre : pour chaque colonne occupée, rangées min et max (relatives). */
type Contour = Map<number, [number, number]>;

export function layoutResearch(data: GameData, category: ResearchCategory): ResearchLayout {
  const depths = nodeDepths(data);
  const inCat = (id: string) => data.nodes.get(id)?.category === category;
  const root = [...data.nodes.values()].find((n) => n.category === category && n.isRoot) ?? [...data.nodes.values()].find((n) => n.category === category && !n.parents.length);
  if (!root) return { nodes: [], edges: [], width: 0, height: 0 };

  // 1. Parent de rangement : parcours en profondeur dans l'ordre des données ; un nœud à
  //    plusieurs parents est rangé sous le dernier parent rencontré.
  const order = new Map<string, number>();
  const visit = (id: string) => {
    if (order.has(id)) return;
    order.set(id, order.size);
    for (const c of data.nodes.get(id)!.children) if (inCat(c)) visit(c);
  };
  visit(root.id);
  // Nœuds sans lien avec la racine (données incomplètes) : rangés quand même, à la fin.
  for (const n of data.nodes.values()) if (n.category === category) visit(n.id);
  const layoutParent = new Map<string, string>();
  for (const n of data.nodes.values()) {
    if (n.category !== category || n.id === root.id) continue;
    const ps = n.parents.filter((p) => inCat(p) && order.has(p));
    if (!ps.length) continue;
    layoutParent.set(n.id, ps.reduce((a, b) => (order.get(b)! > order.get(a)! ? b : a)));
  }
  const kids = new Map<string, string[]>();
  for (const n of data.nodes.values()) {
    if (n.category !== category) continue;
    kids.set(
      n.id,
      n.children.filter((c) => layoutParent.get(c) === n.id),
    );
  }

  // 2. Arbre « bien rangé », comme le jeu : chaque parent est sur la même rangée que son
  //    enfant « principal » (le plus gros sous-arbre), ce qui dessine de longues lignes
  //    droites ; les enfants d'avant s'empilent au-dessus, ceux d'après en dessous, au plus
  //    serré (les sous-arbres s'imbriquent d'une colonne à l'autre sans se chevaucher).
  const size = new Map<string, number>();
  const sizeOf = (id: string): number => {
    if (!size.has(id)) size.set(id, 1 + (kids.get(id) ?? []).reduce((s, c) => s + sizeOf(c), 0));
    return size.get(id)!;
  };
  const rel = new Map<string, number>(); // rangée relative au parent de rangement
  const merge = (into: Contour, sub: Contour, shift: number) => {
    for (const [col, [lo, hi]] of sub) {
      const used = into.get(col);
      into.set(col, used ? [Math.min(used[0], lo + shift), Math.max(used[1], hi + shift)] : [lo + shift, hi + shift]);
    }
  };
  const place = (id: string): Contour => {
    const d = depths.get(id) ?? 0;
    const children = kids.get(id) ?? [];
    const subs = children.map(place);
    const contour: Contour = new Map([[d, [0, 0]]]);
    if (!children.length) return contour;
    let anchor = 0;
    children.forEach((c, i) => {
      if (sizeOf(c) > sizeOf(children[anchor]!)) anchor = i;
    });
    const offsets: number[] = new Array(children.length).fill(0);
    merge(contour, subs[anchor]!, 0);
    // En dessous : les enfants suivants, dans l'ordre des données.
    for (let i = anchor + 1; i < children.length; i++) {
      let shift = offsets[i - 1]! + 1;
      for (const [col, [lo]] of subs[i]!) {
        const used = contour.get(col);
        if (used) shift = Math.max(shift, used[1] + 1 - lo);
      }
      offsets[i] = shift;
      merge(contour, subs[i]!, shift);
    }
    // Au-dessus : les enfants précédents, du plus proche au plus lointain.
    for (let i = anchor - 1; i >= 0; i--) {
      let shift = offsets[i + 1]! - 1;
      for (const [col, [, hi]] of subs[i]!) {
        const used = contour.get(col);
        if (used) shift = Math.min(shift, used[0] - 1 - hi);
      }
      offsets[i] = shift;
      merge(contour, subs[i]!, shift);
    }
    children.forEach((c, i) => rel.set(c, offsets[i]!));
    return contour;
  };
  // Racine + éventuels nœuds orphelins, empilés.
  const tops = [root.id, ...[...order.keys()].filter((id) => id !== root.id && !layoutParent.has(id))];
  const absolute = new Map<string, number>();
  let floor = -Infinity;
  for (const t of tops) {
    const contour = place(t);
    const lo = Math.min(...[...contour.values()].map(([a]) => a));
    const base = floor === -Infinity ? 0 : floor + 1 - lo;
    const assign = (id: string, row: number) => {
      absolute.set(id, row);
      for (const c of kids.get(id) ?? []) assign(c, row + rel.get(c)!);
    };
    assign(t, base);
    floor = Math.max(floor, ...[...contour.values()].map(([, hi]) => hi + base));
  }

  // 3. Coordonnées.
  const minRow = Math.min(...absolute.values());
  const nodes: RNode[] = [...absolute].map(([id, row]) => {
    const depth = depths.get(id) ?? 0;
    return { id, depth, x: MARGIN + depth * (RN_W + GAP_X), y: MARGIN + (row - minRow) * ROW };
  });
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
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const width = MARGIN * 2 + (maxDepth + 1) * RN_W + maxDepth * GAP_X;
  const height = MARGIN * 2 + Math.max(...nodes.map((n) => n.y - MARGIN)) + RN_H;
  return { nodes, edges, width, height };
}
