// Disposition du schéma des flux (pur, sans DOM) : de gauche (extraction) à droite (objectif).
// Une colonne par étage de la chaîne. Une flèche qui saute des colonnes passe par des points de
// passage réservés dans les colonnes intermédiaires : elle ne traverse aucun nœud. L'ordre dans
// chaque colonne suit le barycentre des voisins (peu de croisements). Les étiquettes de débit
// sont placées dans les espaces entre colonnes, à un endroit libre (jamais l'une sur l'autre).

import type { Plan } from "../engine/solve.ts";
import { fmt } from "./format.ts";

export const FW = 184;
export const FH = 56;
/** Espace minimal entre deux colonnes ; élargi pour que les étiquettes des flux y tiennent. */
const GAP_X_MIN = 104;
const VIRTUAL_H = 12;
const MARGIN = 24;
const LANE_GAP = 36;
/** Hauteur d'une étiquette de flux : le produit, puis le débit. */
export const LABEL_H = 30;

export type FKind = "final" | "step" | "raw" | "unresolved" | "existing";
export type FNode = { id: string; x: number; y: number; col: number; kind: FKind };
export type FEdge = { from: string; to: string; item: string; perMin: number; d: string; lx: number; ly: number; lw: number; loop: boolean; name: string };
export type FlowLayout = { nodes: FNode[]; edges: FEdge[]; width: number; height: number };

export const flowLabel = (perMin: number) => `${fmt(perMin, perMin >= 100 ? 0 : 1)}/min`;
/** Nom du produit sur une étiquette : raccourci au-delà de 18 caractères (le nom entier est au survol). */
export const flowName = (name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name);
export const flowLabelWidth = (perMin: number, name = "") => Math.max(flowLabel(perMin).length, flowName(name).length) * 6.3 + 14;

type Ent = { id: string; virtual: boolean; h: number; y: number; col: number; prev: string[]; next: string[] };
type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

type FlowPlan = Pick<Plan, "steps" | "unresolved" | "edges" | "finals"> & Partial<Pick<Plan, "existing">>;

/**
 * Disposition du schéma. Si une étiquette ne trouve pas de place libre, on recommence en espaçant
 * davantage les blocs d'une colonne : les étiquettes ne se chevauchent jamais.
 */
export function layoutFlow(plan: FlowPlan, name: (item: string) => string = (id) => id): FlowLayout {
  let last: (FlowLayout & { clean: boolean }) | null = null;
  for (const [gapY, wide] of [[22, 1], [44, 1], [72, 1.4], [108, 1.8], [160, 2.4], [220, 3.2]] as const) {
    last = layoutOnce(plan, name, gapY, wide);
    if (last.clean) break;
  }
  const { clean: _clean, ...out } = last!;
  return out;
}

function layoutOnce(plan: FlowPlan, name: (item: string) => string, GAP_Y: number, wide: number): FlowLayout & { clean: boolean } {
  const GAP_X = Math.max(GAP_X_MIN, ...plan.edges.map((e) => flowLabelWidth(e.perMin, name(e.item)) + 24)) * wide;
  // 1. Nœuds et profondeur (0 = objectif). Manques et productions existantes : sous leurs consommateurs.
  const depth = new Map<string, number>();
  const kind = new Map<string, FKind>();
  for (const s of plan.steps) {
    depth.set(s.key, s.depth);
    kind.set(s.key, plan.finals.includes(s.key) ? "final" : s.isRaw ? "raw" : "step");
  }
  const sources: [string, FKind][] = [
    ...plan.unresolved.filter((u) => !depth.has(u.item)).map((u) => [u.item, "unresolved"] as [string, FKind]),
    ...(plan.existing ?? []).map((x) => [x.key, "existing"] as [string, FKind]),
  ];
  for (const [id, k] of sources) {
    depth.set(id, plan.finals.includes(id) ? 0 : 1);
    kind.set(id, plan.finals.includes(id) ? "final" : k);
  }
  for (let i = 0; i < 6; i++) {
    for (const e of plan.edges) {
      if (!sources.some(([id]) => id === e.from) || plan.finals.includes(e.from)) continue;
      const d = (depth.get(e.to) ?? 0) + 1;
      if ((depth.get(e.from) ?? 0) < d) depth.set(e.from, d);
    }
  }
  const maxD = Math.max(0, ...depth.values());
  const colOf = (id: string) => maxD - (depth.get(id) ?? 0);
  const edges = plan.edges.filter((e) => depth.has(e.from) && depth.has(e.to));

  // 2. Entités par colonne : nœuds réels + points de passage des flèches longues.
  const ents = new Map<string, Ent>();
  const cols: Ent[][] = Array.from({ length: maxD + 1 }, () => []);
  const add = (e: Ent) => {
    ents.set(e.id, e);
    cols[e.col]!.push(e);
  };
  for (const id of depth.keys()) add({ id, virtual: false, h: FH, y: 0, col: colOf(id), prev: [], next: [] });
  const chains: string[][] = edges.map((e, i) => {
    const a = colOf(e.from);
    const b = colOf(e.to);
    if (a >= b) return []; // arc de retour : tracé à part
    const chain = [e.from];
    for (let c = a + 1; c < b; c++) {
      const id = `~${i}:${c}`;
      add({ id, virtual: true, h: VIRTUAL_H, y: 0, col: c, prev: [], next: [] });
      chain.push(id);
    }
    chain.push(e.to);
    for (let k = 1; k < chain.length; k++) {
      ents.get(chain[k - 1]!)!.next.push(chain[k]!);
      ents.get(chain[k]!)!.prev.push(chain[k - 1]!);
    }
    return chain;
  });

  // 3. Ordre dans les colonnes : barycentres, en allers-retours.
  const place = (col: Ent[]) => {
    let y = 0;
    for (const e of col) {
      e.y = y;
      y += e.h + (e.virtual ? 6 : GAP_Y);
    }
  };
  cols.forEach((c) => c.sort((a, b) => Number(a.virtual) - Number(b.virtual) || a.id.localeCompare(b.id)));
  cols.forEach(place);
  const center = (e: Ent) => e.y + e.h / 2;
  for (let sweep = 0; sweep < 6; sweep++) {
    const forward = sweep % 2 === 0;
    const order = forward ? cols.map((_, i) => i) : cols.map((_, i) => cols.length - 1 - i);
    for (const i of order) {
      const col = cols[i]!;
      const bary = new Map(
        col.map((e) => {
          const ns = (forward ? e.prev : e.next).map((n) => center(ents.get(n)!));
          return [e.id, ns.length ? ns.reduce((s, v) => s + v, 0) / ns.length : center(e)] as [string, number];
        }),
      );
      col.sort((a, b) => bary.get(a.id)! - bary.get(b.id)! || a.id.localeCompare(b.id));
      place(col);
    }
  }
  // Colonnes centrées verticalement.
  const colH = cols.map((c) => (c.length ? c.at(-1)!.y + c.at(-1)!.h : 0));
  const H0 = Math.max(FH, ...colH);
  cols.forEach((c, i) => {
    const off = (H0 - colH[i]!) / 2;
    for (const e of c) e.y += off + MARGIN;
  });
  const colX = (c: number) => MARGIN + c * (FW + GAP_X);
  const nodes: FNode[] = [...depth.keys()].map((id) => ({ id, x: colX(colOf(id)), y: ents.get(id)!.y, col: colOf(id), kind: kind.get(id)! }));
  const nodeOf = new Map(nodes.map((n) => [n.id, n]));
  const nodeBoxes: Box[] = nodes.map((n) => ({ x: n.x, y: n.y, w: FW, h: FH }));

  // 4. Points d'ancrage répartis sur la hauteur des nœuds, triés selon l'autre extrémité.
  const spread = (list: { key: number; other: number }[]) => {
    const sorted = [...list].sort((a, b) => a.other - b.other);
    const out = new Map<number, number>();
    sorted.forEach((x, i) => out.set(x.key, ((i + 1) / (sorted.length + 1) - 0.5) * (FH - 18)));
    return out;
  };
  const outOff = new Map<number, number>();
  const inOff = new Map<number, number>();
  for (const n of nodes) {
    const outs: { key: number; other: number }[] = [];
    const ins: { key: number; other: number }[] = [];
    chains.forEach((c, i) => {
      if (c.length < 2) return;
      if (c[0] === n.id) outs.push({ key: i, other: center(ents.get(c[1]!)!) });
      if (c.at(-1) === n.id) ins.push({ key: i, other: center(ents.get(c.at(-2)!)!) });
    });
    for (const [k, v] of spread(outs)) outOff.set(k, v);
    for (const [k, v] of spread(ins)) inOff.set(k, v);
  }

  // 5. Tracés. Échantillons des courbes dans les espaces entre colonnes : candidats d'étiquettes.
  const bez = (p: [number, number], q: [number, number], t: number): [number, number] => {
    const dx = (q[0] - p[0]) / 2;
    const c1: [number, number] = [p[0] + dx, p[1]];
    const c2: [number, number] = [q[0] - dx, q[1]];
    const u = 1 - t;
    return [u * u * u * p[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * q[0], u * u * u * p[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * q[1]];
  };
  const out: FEdge[] = [];
  const labels: Box[] = [];
  let clean = true;
  const pick = (base: [number, number][], w: number): [number, number] => {
    // Sur la courbe d'abord ; sinon légèrement au-dessus ou au-dessous (l'étiquette reste contre son flux).
    const step = (LABEL_H + 3) / 2;
    const cands = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6].flatMap((k) => base.map(([x, y]): [number, number] => [x, y + k * step]));
    let best = cands[0]!;
    let bestHits = Infinity;
    for (const [x, y] of cands) {
      const box = { x: x - w / 2 - 2, y: y - LABEL_H / 2 - 2, w: w + 4, h: LABEL_H + 4 };
      const hits = nodeBoxes.filter((b) => overlap(box, b)).length * 10 + labels.filter((b) => overlap(box, b)).length;
      if (hits < bestHits) {
        best = [x, y];
        bestHits = hits;
        if (!hits) break;
      }
    }
    labels.push({ x: best[0] - w / 2, y: best[1] - LABEL_H / 2, w, h: LABEL_H });
    if (bestHits) clean = false;
    return best;
  };
  let lanes = 0;
  const bottom = MARGIN + H0;
  edges.forEach((e, i) => {
    const w = flowLabelWidth(e.perMin, name(e.item));
    const a = nodeOf.get(e.from)!;
    const b = nodeOf.get(e.to)!;
    const chain = chains[i]!;
    if (chain.length < 2) {
      // Arc de retour : sous le schéma, en pointillés.
      const lane = bottom + LANE_GAP * ++lanes;
      const ax = a.x + FW / 2 + 12;
      const bx = b.x + FW / 2 - 12;
      const d = `M${ax},${a.y + FH} L${ax},${lane} L${bx},${lane} L${bx},${b.y + FH + 3}`;
      const cands: [number, number][] = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9].map((t) => [ax + (bx - ax) * t, lane]);
      const [lx, ly] = pick(cands, w);
      out.push({ from: e.from, to: e.to, item: e.item, perMin: e.perMin, d, lx, ly, lw: w, loop: true, name: flowName(name(e.item)) });
      return;
    }
    const pts: [number, number][] = [[a.x + FW, a.y + FH / 2 + (outOff.get(i) ?? 0)]];
    for (const v of chain.slice(1, -1)) {
      const ve = ents.get(v)!;
      pts.push([colX(ve.col), center(ve)], [colX(ve.col) + FW, center(ve)]);
    }
    pts.push([b.x - 3, b.y + FH / 2 + (inOff.get(i) ?? 0)]);
    let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
    const gaps: [number, number][][] = []; // échantillons par espace entre colonnes, de gauche à droite
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k - 1]!;
      const q = pts[k]!;
      if (k % 2 === 0) {
        d += ` L${q[0].toFixed(1)},${q[1].toFixed(1)}`; // traversée d'une colonne par un point de passage
        continue;
      }
      const dx = (q[0] - p[0]) / 2;
      d += ` C${(p[0] + dx).toFixed(1)},${p[1].toFixed(1)} ${(q[0] - dx).toFixed(1)},${q[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}`;
      gaps.push([0.5, 0.36, 0.64, 0.24, 0.76, 0.44, 0.56, 0.3, 0.7, 0.16, 0.84].map((t) => bez(p, q, t)));
    }
    // Préférence : l'espace juste avant le consommateur, puis celui après le producteur, puis les autres.
    const order = [gaps.length - 1, 0, ...gaps.map((_, k) => k).slice(1, -1)].filter((k, j, arr) => k >= 0 && arr.indexOf(k) === j);
    const [lx, ly] = pick(order.flatMap((k) => gaps[k]!), w);
    out.push({ from: e.from, to: e.to, item: e.item, perMin: e.perMin, d, lx, ly, lw: w, loop: false, name: flowName(name(e.item)) });
  });

  const width = MARGIN * 2 + (maxD + 1) * FW + maxD * GAP_X;
  const height = bottom + MARGIN + (lanes ? LANE_GAP * lanes + LABEL_H : 0);
  return { nodes, edges: out, width, height, clean };
}
