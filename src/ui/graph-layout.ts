// « Aligner » de l'éditeur de graphe (pur, sans DOM) : colonnes de l'extraction à l'objectif, ordre qui
// croise le moins de liaisons, hauteurs choisies pour des liaisons droites, tout sur la grille des croix.
// Une liaison qui saute des colonnes y garde une place, pour passer entre les nœuds (graph-route.ts).

import { collapsedOwners, type Graph, type GraphEdge, type NodeId } from "../engine/graph/index.ts";
import { LANE } from "./graph-route.ts";

/** Pas de la grille : celui des croix du canevas. */
export const GRID = 28;
export const snapGrid = (v: number): number => Math.round(v / GRID) * GRID || 0;
/** Largeur d'un nœud (pixels du monde). */
export const NODE_W = 256;
const GAP_X = 120;
const GAP_Y = 32;
const LANE_H = 12;

export type ArrangeSizes = {
  /** Hauteur d'un nœud, ou d'un groupe replié (clé `@groupe`). */
  height: (key: string) => number;
  /** Hauteur d'une prise dans sa boîte ; à défaut, son milieu. */
  portY?: (key: string, dir: "ins" | "outs", item: string) => number | null;
};

type Ent = { id: string; real: boolean; h: number; y: number; col: number; prev: Link[]; next: Link[] };
/** Voisin, et hauteurs des prises : la mienne et la sienne. */
type Link = { e: Ent; mine: number; its: number };

/** Ordre imposé, hauteurs voulues : les places les plus proches qui gardent l'ordre et les écarts (moindres carrés). */
function fitColumn(col: Ent[], want: number[]): void {
  const off: number[] = [];
  let acc = 0;
  col.forEach((e, i) => {
    off.push(acc);
    const n = col[i + 1];
    if (n) acc += e.h + (e.real && n.real ? GAP_Y : e.real || n.real ? GAP_Y / 2 : 0);
  });
  const blocks: { sum: number; w: number; n: number }[] = [];
  want.forEach((v, i) => {
    const w = col[i]!.real ? 1 : 2; // une liaison qui traverse reste droite plus volontiers
    blocks.push({ sum: (v - off[i]!) * w, w, n: 1 });
    while (blocks.length > 1) {
      const b = blocks.at(-1)!;
      const a = blocks.at(-2)!;
      if (a.sum / a.w <= b.sum / b.w) break;
      blocks.pop();
      a.sum += b.sum;
      a.w += b.w;
      a.n += b.n;
    }
  });
  let i = 0;
  for (const b of blocks) for (let k = 0; k < b.n; k++, i++) col[i]!.y = b.sum / b.w + off[i]!;
}

/** Déplacements qui alignent tout le graphe. Un groupe replié compte pour une boîte : ses nœuds le suivent. */
export function arrangeGraph(g: Graph, sizes: ArrangeSizes): { id: NodeId; x: number; y: number }[] {
  if (!g.nodes.length) return [];
  const owners = collapsedOwners(g);
  const unit = (id: NodeId) => (owners.has(id) ? `@${owners.get(id)}` : id);
  const units = [...new Set(g.nodes.map((n) => unit(n.id)))];
  const known = new Set(g.nodes.map((n) => n.id));
  const edges = g.edges.filter((e) => known.has(e.from) && known.has(e.to)).map((e) => ({ ...e, from: unit(e.from), to: unit(e.to) })).filter((e) => e.from !== e.to);

  // Profondeur = plus long chemin vers l'objectif (0), boucles ouvertes d'abord. Dans une boucle, on garde les
  // liaisons qui rapprochent de l'objectif (en nombre d'étapes) : déplier la boucle entière ferait un ruban de
  // dizaines de colonnes. Hors des boucles, rien n'est écarté.
  const feeders = new Map<string, GraphEdge[]>();
  const users = new Map<string, GraphEdge[]>();
  const push = (m: Map<string, GraphEdge[]>, k: string, e: GraphEdge) => {
    const l = m.get(k);
    if (l) l.push(e);
    else m.set(k, [e]);
  };
  for (const e of edges) {
    push(feeders, e.to, e);
    push(users, e.from, e);
  }
  const sinks = units.filter((u) => !users.has(u));
  const dist = new Map<string, number>();
  const spread = (from: string[]) => {
    let wave = from.filter((u) => !dist.has(u));
    wave.forEach((u) => dist.set(u, 0));
    for (let d = 1; wave.length; d++) {
      const next: string[] = [];
      for (const u of wave)
        for (const e of feeders.get(u) ?? [])
          if (!dist.has(e.from)) {
            dist.set(e.from, d);
            next.push(e.from);
          }
      wave = next;
    }
  };
  spread([...new Set([...(g.target && known.has(g.target.node) ? [unit(g.target.node)] : []), ...sinks])]);
  for (const u of units) spread([u]); // boucle fermée sur elle-même, sans débouché
  // Composantes : a et b sont dans la même boucle si chacun atteint l'autre (Kosaraju, sans récursion).
  const done: string[] = [];
  const seen = new Set<string>();
  for (const r of units) {
    if (seen.has(r)) continue;
    seen.add(r);
    const st = [{ u: r, i: 0 }];
    while (st.length) {
      const top = st.at(-1)!;
      const e = users.get(top.u)?.[top.i++];
      if (!e) done.push(st.pop()!.u);
      else if (!seen.has(e.to)) {
        seen.add(e.to);
        st.push({ u: e.to, i: 0 });
      }
    }
  }
  const comp = new Map<string, number>();
  let nc = 0;
  for (const r of done.reverse()) {
    if (comp.has(r)) continue;
    const st = [r];
    comp.set(r, nc);
    while (st.length) for (const e of feeders.get(st.pop()!) ?? []) if (!comp.has(e.from)) comp.set(e.from, nc), st.push(e.from);
    nc++;
  }
  const rank = new Map(units.map((u, n) => [u, n]));
  const keeps = (e: GraphEdge) => {
    if (comp.get(e.from) !== comp.get(e.to)) return true;
    const d = dist.get(e.from)! - dist.get(e.to)!;
    return d > 0 || (d === 0 && rank.get(e.from)! > rank.get(e.to)!);
  };
  const back = new Set(edges.filter((e) => !keeps(e)));
  const dag = edges.filter((e) => !back.has(e));
  const depth = new Map(units.map((u) => [u, 0]));
  for (let k = 0; k < units.length; k++) {
    let changed = false;
    for (const e of dag) {
      const d = depth.get(e.to)! + 1;
      if (d > depth.get(e.from)!) {
        depth.set(e.from, d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const maxD = Math.max(...depth.values());

  // Colonnes : les boîtes, et la place des liaisons qui les traversent.
  const cols: Ent[][] = Array.from({ length: maxD + 1 }, () => []);
  const ents = new Map<string, Ent>();
  const add = (id: string, real: boolean, h: number, col: number): Ent => {
    const e: Ent = { id, real, h, y: 0, col, prev: [], next: [] };
    ents.set(id, e);
    cols[col]!.push(e);
    return e;
  };
  for (const u of units) add(u, true, sizes.height(u), maxD - depth.get(u)!);
  const port = (u: string, dir: "ins" | "outs", item: string) => sizes.portY?.(u, dir, item) ?? ents.get(u)!.h / 2;
  const join = (a: Ent, ya: number, b: Ent, yb: number) => {
    a.next.push({ e: b, mine: ya, its: yb });
    b.prev.push({ e: a, mine: yb, its: ya });
  };
  const gutters = cols.map(() => new Set<string>());
  // Une liaison de retour passe aussi par les couloirs de ses deux bouts.
  for (const e of back) {
    gutters[ents.get(e.from)!.col]?.add(`${e.from}:${e.item}`);
    gutters[ents.get(e.to)!.col - 1]?.add(`${e.from}:${e.item}`);
  }
  for (const e of dag) {
    let last = ents.get(e.from)!;
    let ly = port(e.from, "outs", e.item);
    const end = ents.get(e.to)!;
    for (let c = last.col; c < end.col; c++) gutters[c]!.add(`${e.from}:${e.item}`);
    for (let c = last.col + 1; c < end.col; c++) {
      // Une même sortie ne prend qu'une place par colonne, quel que soit le nombre de ses liaisons.
      const id = `~${e.from}:${e.item}:${c}`;
      const had = ents.get(id);
      const v = had ?? add(id, false, LANE_H, c);
      if (!had) join(last, ly, v, LANE_H / 2);
      last = v;
      ly = LANE_H / 2;
    }
    join(last, ly, end, port(e.to, "ins", e.item));
  }

  // Ordre : barycentres en allers-retours ; on garde celui qui croise le moins.
  const stack = (col: Ent[]) => {
    let y = 0;
    for (const e of col) {
      e.y = y;
      y += e.h + (e.real ? GAP_Y : 6);
    }
  };
  const crossings = (): number => {
    let n = 0;
    for (const col of cols) {
      const l = col.flatMap((e) => e.next.map((x) => [e.y + x.mine, x.e.y + x.its] as const)).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (l[j]![1] < l[i]![1] && l[j]![0] > l[i]![0]) n++;
    }
    return n;
  };
  cols.forEach(stack);
  let bestN = Infinity;
  let bestOrder: Ent[][] = [];
  for (let sweep = 0; sweep < 16; sweep++) {
    const n = crossings();
    if (n < bestN) [bestN, bestOrder] = [n, cols.map((c) => [...c])];
    const fwd = sweep % 2 === 1;
    for (let k = 0; k < cols.length; k++) {
      const col = cols[fwd ? k : cols.length - 1 - k]!;
      const key = new Map(
        col.map((e) => {
          const ns = fwd ? e.prev : e.next;
          return [e, ns.length ? ns.reduce((s, x) => s + x.e.y + x.its - x.mine, 0) / ns.length + e.h / 2 : e.y + e.h / 2] as const;
        }),
      );
      col.sort((a, b) => key.get(a)! - key.get(b)! || (a.id < b.id ? -1 : 1));
      stack(col);
    }
  }
  bestOrder.forEach((c, i) => (cols[i] = c));
  cols.forEach(stack);

  // Hauteurs : chaque boîte au plus près de là où ses liaisons sont droites.
  for (let it = 0; it < 24; it++) {
    const fwd = it % 2 === 0;
    for (let k = 0; k < cols.length; k++) {
      const col = cols[fwd ? k : cols.length - 1 - k]!;
      fitColumn(
        col,
        col.map((e) => {
          const ns = it >= 20 ? [...e.prev, ...e.next] : fwd ? e.prev : e.next;
          return ns.length ? ns.reduce((s, x) => s + x.e.y + x.its - x.mine, 0) / ns.length : e.y;
        }),
      );
    }
  }

  // Sur la grille, sans perdre l'ordre ni les écarts.
  const top = Math.min(...[...ents.values()].filter((e) => e.real).map((e) => e.y));
  for (const col of cols) {
    let min = -Infinity;
    for (const e of col) {
      const y = e.y - top;
      if (e.real) {
        e.y = Math.max(snapGrid(y), Math.ceil(min / GRID) * GRID);
        min = e.y + e.h + GAP_Y;
      } else {
        e.y = Math.max(y, min);
        min = e.y + e.h + 4;
      }
    }
  }
  const colX: number[] = [];
  let x = 0;
  cols.forEach((_, c) => {
    colX.push(x);
    x += Math.ceil((NODE_W + Math.max(GAP_X, 96 + LANE * gutters[c]!.size)) / GRID) * GRID;
  });

  // Coin d'un groupe replié = celui de ses nœuds : tous suivent du même écart.
  const corner = new Map<string, { x: number; y: number }>();
  for (const n of g.nodes) {
    const u = unit(n.id);
    const c = corner.get(u);
    corner.set(u, c ? { x: Math.min(c.x, n.x), y: Math.min(c.y, n.y) } : { x: n.x, y: n.y });
  }
  return g.nodes.map((n) => {
    const e = ents.get(unit(n.id))!;
    const c = corner.get(unit(n.id))!;
    return { id: n.id, x: colX[e.col]! + n.x - c.x, y: e.y + n.y - c.y };
  });
}
