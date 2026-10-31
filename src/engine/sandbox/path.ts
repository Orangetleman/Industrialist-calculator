// Bac à sable (B2) : tracé des tuyaux, repris de la maquette (`pipePath`, `pipePlan`, `assemble`, `rest`),
// PLAN-BAC-A-SABLE.md § 4. Chemin A* (+8 par virage, comme Mindustry) ; ouvertures voulues case par case ;
// fusion ou croisement avec les tuyaux déjà posés ; pièces choisies (coude, té, croix, droits du plus long au plus
// court) ; les cases restantes d'une pièce remplacée ou coupée gardent leurs ouvertures. Croisements posés seuls :
// jamais de pièce rusty (règle des plans de pose). Les grands tuyaux (tier IV) ne se tracent pas encore.

import type { Dir, PipeRole, SbCatalog } from "./catalog.ts";
import { DIRS, DV, OPP, rot, cellKey as K, cellOpen, cellsOf, geo, occupancy, type Layout, type Placed } from "./layout.ts";

/** Famille de tuyaux : type et tier (o1, f1, o3, f3). */
export type Fam = `${"o" | "f"}${1 | 3}`;
export type Kind = "o" | "f";
export type Piece = Omit<Placed, "u">;
/** Ce qu'un geste change : bâtiments retirés (`u`) et pièces posées. */
export type Plan = { remove: number[]; add: Piece[] };

const isLarge = (cat: SbCatalog, id: string) => {
  const d = cat.blocks.get(id);
  return !!d?.pipe && (d.pipe.tier === 4 || (!!d.geo && Math.min(d.geo.w, d.geo.h) > 1));
};

export function famOf(cat: SbCatalog, id: string): Fam | null {
  const p = cat.blocks.get(id)?.pipe;
  if (!p || p.role === "spécial" || p.kind === "m" || isLarge(cat, id) || (p.tier !== 1 && p.tier !== 3)) return null;
  return `${p.kind}${p.tier}` as Fam;
}

const kindOf = (fam: Fam) => fam[0] as Kind;

/** La pièce d'un rôle dans la famille : relevée d'abord, puis non rusty, puis la moins chère. */
export function famRole(cat: SbCatalog, fam: Fam, role: PipeRole): string | null {
  const ids = [...cat.blocks.values()].filter((b) => famOf(cat, b.id) === fam && b.pipe!.role === role);
  ids.sort((a, b) => +!!b.geo - +!!a.geo || +a.pipe!.rusty - +b.pipe!.rusty || (a.cost ?? Infinity) - (b.cost ?? Infinity));
  return ids[0]?.id ?? null;
}

/** Longueurs droites posables, de la plus longue à la plus courte ; à longueur égale, la moins chère. */
export function droitLens(cat: SbCatalog, fam: Fam): { L: number; id: string }[] {
  const m = new Map<number, string>();
  for (const b of cat.blocks.values()) {
    if (famOf(cat, b.id) !== fam || b.pipe!.role !== "droit" || !b.geo) continue;
    const o = m.get(b.pipe!.len);
    if (!o || (b.cost ?? Infinity) < (cat.blocks.get(o)!.cost ?? Infinity)) m.set(b.pipe!.len, b.id);
  }
  return [...m].map(([L, id]) => ({ L, id })).sort((a, b) => b.L - a.L);
}

/** Croisement posé seul (objet, fluide, ou objet × fluide) : jamais rusty ; celui du tier III sert aussi au tier I. */
export function crossId(cat: SbCatalog, kind: Kind | "m"): string | null {
  const ids = [...cat.blocks.values()].filter((b) => b.pipe?.role === "croisement" && b.pipe.kind === kind && !b.pipe.rusty && !isLarge(cat, b.id) && b.geo);
  ids.sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity));
  return ids[0]?.id ?? null;
}

type Board = { cat: SbCatalog; occ: Map<string, number>; byU: Map<number, Placed> };
const board = (cat: SbCatalog, layout: Layout): Board => ({ cat, occ: occupancy(cat, layout).occ, byU: new Map(layout.blocks.map((b) => [b.u, b])) });
const dirTo = (x: number, y: number, qx: number, qy: number): Dir => (qx > x ? "E" : qx < x ? "W" : qy > y ? "S" : "N");
const openAt = (B: Board, b: Placed, x: number, y: number) => cellOpen(B.cat.blocks.get(b.id)!, b, x, y);

/** Coût d'un pas : case libre 1 ; tuyau du même type 3 ; croisement ou tuyau de l'autre type traversé tout droit 6 ; null : impossible. */
function stepCost(B: Board, x: number, y: number, d: Dir, kind: Kind): [number, boolean] | null {
  const u = B.occ.get(K(x, y));
  if (u == null) return [1, false];
  const b = B.byU.get(u)!, def = B.cat.blocks.get(b.id)!, p = def.pipe;
  if (!p || p.role === "spécial" || isLarge(B.cat, b.id) || !def.geo) return null;
  if (p.role === "croisement") return [6, true];
  if (p.kind === kind) return [3, false];
  const ex = [...openAt(B, b, x, y)];
  return ex.length === 2 && OPP[ex[0]!] === ex[1] && !ex.includes(d) ? [6, true] : null;
}

class Heap {
  a: [number, number, number, number, number, boolean][] = [];
  get size() { return this.a.length; }
  push(v: Heap["a"][number]) { const a = this.a; a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p]![0] <= a[i]![0]) break; [a[p], a[i]] = [a[i]!, a[p]!]; i = p; } }
  pop() {
    const a = this.a, top = a[0]!, last = a.pop()!;
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l]![0] < a[m]![0]) m = l; if (r < a.length && a[r]![0] < a[m]![0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i]!, a[m]!]; i = m; } }
    return top;
  }
}

/** Chemin de `s` à `t` (cases), ou null. Les machines bloquent ; un croisement ou un tuyau de l'autre type ne se traverse que tout droit. */
export function pipePath(cat: SbCatalog, layout: Layout, s: [number, number], t: [number, number], kind: Kind): [number, number][] | null {
  const B = board(cat, layout), u0 = B.occ.get(K(...s));
  if (u0 != null && cat.blocks.get(B.byU.get(u0)!.id)?.pipe?.kind !== kind) return null;
  const pad = 30, x0 = Math.min(s[0], t[0]) - pad, y0 = Math.min(s[1], t[1]) - pad, x1 = Math.max(s[0], t[0]) + pad, y1 = Math.max(s[1], t[1]) + pad, W = x1 - x0 + 1;
  const key = (x: number, y: number, d: number) => ((y - y0) * W + (x - x0)) * 5 + d, hh = (x: number, y: number) => Math.abs(x - t[0]) + Math.abs(y - t[1]);
  const g = new Map<number, number>(), from = new Map<number, number>(), heap = new Heap();
  g.set(key(s[0], s[1], 4), 0);
  heap.push([hh(...s), 0, s[0], s[1], 4, false]);
  for (let n = 0; heap.size && n < 20000; n++) {
    const [, gc, x, y, d, str] = heap.pop(), kc = key(x, y, d);
    if (gc > g.get(kc)!) continue;
    if (x === t[0] && y === t[1] && !str) {
      const path: [number, number][] = [];
      for (let k: number | undefined = kc; k !== undefined; k = from.get(k)) { const c = Math.floor(k / 5); path.push([x0 + (c % W), y0 + Math.floor(c / W)]); }
      return path.reverse();
    }
    for (let nd = 0; nd < 4; nd++) {
      if (str && nd !== d) continue;
      const D = DIRS[nd]!, nx = x + DV[D][0], ny = y + DV[D][1];
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const c = stepCost(B, nx, ny, D, kind);
      if (!c) continue;
      const ng = gc + c[0] + (d !== 4 && nd !== d ? 8 : 0), nk = key(nx, ny, nd);
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); from.set(nk, kc); heap.push([ng + hh(nx, ny), ng, nx, ny, nd, c[1]]); }
    }
  }
  return null;
}

/** Ctrl : ligne droite seule, sur l'axe le plus long. */
export function straightPath(s: [number, number], t: [number, number]): [number, number][] {
  const ax = Math.abs(t[0] - s[0]) > Math.abs(t[1] - s[1]), dist = ax ? t[0] - s[0] : t[1] - s[1], sg = Math.sign(dist) || 1, out: [number, number][] = [];
  for (let i = 0; i <= Math.abs(dist); i++) out.push(ax ? [s[0] + i * sg, s[1]] : [s[0], s[1] + i * sg]);
  return out;
}

type Cell = { x: number; y: number; fam: Fam; open: Set<Dir>; lenMax: number; axis: "V" | "H"; cross?: { mixed: false } | { mixed: true; kinds: Partial<Record<Dir, Kind>> } };

/** Les cases restantes des pièces retirées gardent leurs ouvertures : un long tuyau coupé devient des pièces plus courtes. */
function rest(B: Board, remove: Iterable<number>, cells: Map<string, Cell>, skip?: (x: number, y: number) => boolean) {
  for (const u of remove) {
    const b = B.byU.get(u)!, f = famOf(B.cat, b.id);
    if (!f) continue;
    for (const [x, y] of cellsOf(B.cat.blocks.get(b.id)!, b)) {
      const k = K(x, y);
      if (cells.has(k) || skip?.(x, y)) continue;
      cells.set(k, { x, y, fam: f, open: openAt(B, b, x, y), lenMax: Infinity, axis: b.r % 2 ? "H" : "V" });
    }
  }
}

const sameSet = (a: Dir[], b: Dir[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Des ouvertures voulues aux pièces. Pièce non relevée : posée quand même avec ses ouvertures (`open`), « à compléter ». */
function assemble(cat: SbCatalog, cells: Map<string, Cell>): Piece[] {
  const out: Piece[] = [], straight = new Map<string, Cell>(), ax = (d: Dir) => (d === "N" || d === "S" ? "V" : "H");
  for (const [k, c] of cells) {
    if (c.cross) {
      const id = crossId(cat, c.cross.mixed ? "m" : kindOf(c.fam));
      if (!id) continue;
      const kinds = c.cross.mixed ? c.cross.kinds : null;
      const r = kinds ? [0, 1, 2, 3].find((rr) => cat.blocks.get(id)!.geo!.ports.every((p) => kinds[rot(p.s as Dir, rr)] === p.t)) ?? 0 : 0;
      out.push({ id, x: c.x, y: c.y, r });
      continue;
    }
    const o = [...c.open], n = o.length;
    const axis = n === 0 ? c.axis : n === 1 ? ax(o[0]!) : n === 2 && OPP[o[0]!] === o[1] ? ax(o[0]!) : null;
    if (axis) { straight.set(k, { ...c, axis }); continue; }
    const id = famRole(cat, c.fam, n === 2 ? "coude" : n === 3 ? "té" : "croix");
    if (!id) continue;
    const g = cat.blocks.get(id)!.geo, r = g ? [0, 1, 2, 3].find((rr) => sameSet(g.ports.map((p) => rot(p.s as Dir, rr)), o)) : undefined;
    out.push(r === undefined ? { id, x: c.x, y: c.y, r: 0, open: o } : { id, x: c.x, y: c.y, r });
  }
  const seen = new Set<string>(), same = (a: Cell | undefined, c: Cell) => !!a && a.axis === c.axis && a.fam === c.fam && a.lenMax === c.lenMax;
  for (const [k, c] of straight) {
    if (seen.has(k)) continue;
    const [dx, dy] = c.axis === "V" ? [0, 1] : [1, 0];
    let sx = c.x, sy = c.y;
    while (same(straight.get(K(sx - dx, sy - dy)), c) && !seen.has(K(sx - dx, sy - dy))) { sx -= dx; sy -= dy; }
    const run: [number, number][] = [];
    for (let x = sx, y = sy; same(straight.get(K(x, y)), c) && !seen.has(K(x, y)); x += dx, y += dy) { run.push([x, y]); seen.add(K(x, y)); }
    const lens = droitLens(cat, c.fam).filter((o) => o.L <= c.lenMax);
    for (let i = 0; i < run.length; ) {
      const pick = lens.find((o) => o.L <= run.length - i), [x, y] = run[i]!;
      if (!pick) { const id = famRole(cat, c.fam, "droit"); if (id) out.push({ id, x, y, r: 0, open: c.axis === "V" ? ["N", "S"] : ["E", "W"] }); i++; continue; }
      out.push({ id: pick.id, x, y, r: c.axis === "V" ? 0 : 1 });
      i += pick.L;
    }
  }
  return out;
}

/** Port d'une case (1 case de large) qui regarde la case (x, y) depuis la direction d, du type voulu. */
function portFacing(B: Board, x: number, y: number, d: Dir, kind: Kind): boolean {
  const nx = x + DV[d][0], ny = y + DV[d][1], u = B.occ.get(K(nx, ny));
  if (u == null) return false;
  const b = B.byU.get(u)!, def = B.cat.blocks.get(b.id)!, g = geo(def, b);
  return !!g?.ports.some((p) => p.cells?.length === 1 && p.cells[0]![0] === nx && p.cells[0]![1] === ny && p.dir === OPP[d] && p.t === kind);
}

/**
 * Un tracé glissé : ouvertures le long du chemin, raccord aux ports qui regardent les bouts, fusion avec un tuyau du
 * même type (coude, té, croix), croisement quand on le traverse tout droit. null : refusé (machine, pièce spéciale,
 * grand tuyau, ou tuyau de l'autre type traversé autrement que tout droit). `lenMax` : longueur auto décochée.
 */
export function pipePlan(cat: SbCatalog, layout: Layout, path: [number, number][], fam: Fam, lenMax = Infinity, axis: "V" | "H" = "V"): Plan | null {
  const B = board(cat, layout), kind = kindOf(fam), cells = new Map<string, Cell>(), remove = new Set<number>(), onPath = new Set(path.map(([x, y]) => K(x, y)));
  path.forEach(([x, y], i) => {
    const open = new Set<Dir>();
    for (const q of [path[i - 1], path[i + 1]]) if (q) open.add(dirTo(x, y, q[0], q[1]));
    cells.set(K(x, y), { x, y, fam, open, lenMax, axis });
  });
  for (const i of [0, path.length - 1]) {
    const [x, y] = path[i]!, c = cells.get(K(x, y))!;
    for (const d of DIRS) if (!onPath.has(K(x + DV[d][0], y + DV[d][1])) && portFacing(B, x, y, d, kind)) c.open.add(d);
  }
  for (const [k, c] of [...cells]) {
    const u = B.occ.get(k);
    if (u == null) continue;
    const b = B.byU.get(u)!, def = cat.blocks.get(b.id)!, p = def.pipe;
    if (!p || p.role === "spécial" || isLarge(cat, b.id)) return null;
    if (p.role === "croisement") { cells.delete(k); continue; }
    const ex = openAt(B, b, c.x, c.y), e = [...ex], o = [...c.open];
    const through = o.length === 2 && OPP[o[0]!] === o[1], perp = e.length === 2 && OPP[e[0]!] === e[1] && !c.open.has(e[0]!);
    if (p.kind === kind) { if (through && perp) c.cross = { mixed: false }; else ex.forEach((d) => c.open.add(d)); }
    else if (through && perp) { const kinds: Partial<Record<Dir, Kind>> = {}; o.forEach((d) => (kinds[d] = kind)); e.forEach((d) => (kinds[d] = p.kind as Kind)); c.cross = { mixed: true, kinds }; }
    else return null;
    remove.add(u);
  }
  rest(B, remove, cells);
  return { remove: [...remove], add: assemble(cat, cells) };
}

/** Une pièce posée d'un clic : telle quelle ; sur un tuyau du même type, elle le remplace et le reste s'adapte. */
export function explicitPlan(cat: SbCatalog, layout: Layout, id: string, x: number, y: number, r: number): Plan | null {
  const B = board(cat, layout), d = cat.blocks.get(id);
  if (!d?.geo) return null;
  const nb: Piece = { id, x, y, r }, mine = new Set(cellsOf(d, { u: 0, ...nb }).map(([a, b]) => K(a, b))), remove = new Set<number>();
  for (const k of mine) {
    const u = B.occ.get(k);
    if (u == null) continue;
    const b = B.byU.get(u)!, p = cat.blocks.get(b.id)!.pipe;
    if (!d.pipe || !p || p.kind !== d.pipe.kind || isLarge(cat, b.id) || isLarge(cat, id) || p.role === "spécial") return null;
    remove.add(u);
  }
  const cells = new Map<string, Cell>();
  rest(B, remove, cells, (a, b) => mine.has(K(a, b)));
  return { remove: [...remove], add: [nb, ...assemble(cat, cells)] };
}

/** La gomme sur un rectangle : tout ce qui y touche part ; les tuyaux coupés gardent leurs cases hors du rectangle. */
export function rectPlan(cat: SbCatalog, layout: Layout, x0: number, y0: number, x1: number, y1: number): Plan {
  const B = board(cat, layout), inR = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1, remove = new Set<number>();
  for (const b of layout.blocks) { const d = cat.blocks.get(b.id); if (d && cellsOf(d, b).some(([x, y]) => inR(x, y))) remove.add(b.u); }
  const cells = new Map<string, Cell>();
  rest(B, remove, cells, inR);
  return { remove: [...remove], add: assemble(cat, cells) };
}

/** Applique un geste : nouveaux identifiants à la suite ; câbles et liaisons des bâtiments retirés supprimés. */
export function applyPlan(layout: Layout, plan: Plan): Layout {
  const gone = new Set(plan.remove);
  let n = layout.blocks.reduce((m, b) => Math.max(m, b.u), 0);
  return {
    blocks: [...layout.blocks.filter((b) => !gone.has(b.u)), ...plan.add.map((p) => ({ ...p, u: ++n }))],
    wires: layout.wires.filter((w) => !gone.has(w.a) && !gone.has(w.b)),
    ...(layout.routes ? { routes: layout.routes.filter((r) => !gone.has(r.a) && !gone.has(r.b)) } : {}),
  };
}
