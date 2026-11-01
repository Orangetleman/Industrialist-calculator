// Bac à sable (B1) : le montage posé. Empreinte, ports tournés (y compris les ports de 2 cases des grands
// tuyaux et les prises posées dessus), ouvertures des cases de tuyau, raccords face à face.
// Repère : x vers la droite, y vers le bas ; r = quarts de tour dans le sens horaire.

import type { Dir, PortRole, PortType, SbBlock, SbCatalog } from "./catalog.ts";

export const DIRS: Dir[] = ["N", "E", "S", "W"];
export const DV: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const OPP: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };
export const rot = (d: Dir, r: number): Dir => DIRS[(DIRS.indexOf(d) + r) % 4]!;
export const cellKey = (x: number, y: number) => `${x},${y}`;

/**
 * Un bâtiment posé : `u` identifiant unique, `choice` recette choisie par le joueur (gardée tant qu'elle reste possible).
 * `pair` : voies d'un croisement réglées à la main (B3) ; sans réglage, chaque flux ressort en face (↔ et ↕).
 */
export type Placed = { u: number; id: string; x: number; y: number; r: number; choice?: string | null; open?: Dir[]; pair?: CrossPair };

/**
 * Voies d'un croisement (PLAN-BAC-A-SABLE.md § 4) : 0 tout droit (E-O et N-S), 1 en virages N-E et S-O, 2 en
 * virages N-O et S-E. Le réglage ne vaut que pour un croisement d'un seul type (objet ou fluide).
 */
export type CrossPair = 0 | 1 | 2;
export const CROSS_PAIRS: Record<CrossPair, [Dir[], Dir[]]> = { 0: [["E", "W"], ["N", "S"]], 1: [["N", "E"], ["S", "W"]], 2: [["N", "W"], ["S", "E"]] };
/** Voie (0 ou 1) d'un côté d'un croisement. */
export const crossLane = (pair: CrossPair | undefined, d: Dir): 0 | 1 => (CROSS_PAIRS[pair ?? 0][0].includes(d) ? 0 : 1);
/** Câble de prise à prise, orienté de `a` vers `b` (indices des ports dans `geo().ports`). */
export type Wire = { a: number; ia: number; b: number; ib: number; t: "p" | "g" };
/**
 * Liaison choisie par le joueur entre deux machines collées (clic sur un port, puis sur un autre) : ce qui sort
 * du port `ia` de la machine `a` entre dans la machine `b` par son port `ib` (indices dans `geo().ports`).
 */
/**
 * Liaison réglée par le joueur, d'un bouton à l'autre. Entre machines : ports `ia` → `ib`. Avec un tuyau (S57, BAS-12 c),
 * `ia` ou `ib` est la voie du tuyau : tuyau → machine choisit le bouton d'arrivée ; machine → tuyau avec `off` retire le
 * raccord automatique de la production dans ce tuyau (BAS-12 b).
 */
export type Route = { a: number; ia: number; b: number; ib: number; off?: true };
export type Layout = { blocks: Placed[]; wires: Wire[]; routes?: Route[] };

/** Port tourné et placé. Côté : `cells` (1 ou 2 cases, dans le bâtiment). Dessus : centre `px`, `py` (en cases). */
export type PlacedPort = { t: PortType; d: PortRole; tip?: string; items?: string[]; dir: Dir | "top"; cells?: [number, number][]; px?: number; py?: number };
export type PlacedGeo = { w: number; h: number; ports: PlacedPort[] };

export function dims(def: SbBlock, r: number): [number, number] {
  const g = def.geo ?? def.size;
  if (!g) return [1, 1];
  return r % 2 ? [g.h, g.w] : [g.w, g.h];
}

export function cellsOf(def: SbBlock, b: Placed): [number, number][] {
  const [w, h] = dims(def, b.r), out: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([b.x + x, b.y + y]);
  return out;
}

/**
 * Ports du bâtiment posé. Les tuyaux droits, coudes, tés, croix et croisements n'ont pas de sens propre (BAS-02) :
 * leurs ports objet et fluide deviennent « les deux ». Les pièces spéciales gardent le sens relevé.
 */
export function geo(def: SbBlock, b: Placed): PlacedGeo | null {
  const g = def.geo;
  if (!g) return null;
  let w = g.w, h = g.h;
  // Tuyaux droits : entrée et sortie relevées, gardées (un tuyau droit posé à l'envers coupe le flux, S57) ; les autres pièces vont dans les deux sens.
  const free = !!def.pipe && def.pipe.role !== "spécial" && def.pipe.role !== "droit";
  let ps: PlacedPort[] = g.ports.map((p) => {
    const base = { t: p.t, d: free && (p.t === "o" || p.t === "f") ? ("l" as const) : p.d, tip: p.tip, items: p.items };
    if (p.s === "top") return { ...base, dir: "top" as const, px: p.cx! - 0.5, py: p.cy! - 0.5 };
    const k = p.c! - 1, al: [number, number] = p.s === "N" || p.s === "S" ? [1, 0] : [0, 1];
    const [ix, iy] = p.s === "N" ? [k, 0] : p.s === "S" ? [k, h - 1] : p.s === "W" ? [0, k] : [w - 1, k];
    return { ...base, dir: p.s, cells: Array.from({ length: p.span || 1 }, (_, i) => [ix + al[0] * i, iy + al[1] * i] as [number, number]) };
  });
  for (let i = 0; i < b.r; i++) {
    const H = h;
    ps = ps.map((p) => (p.dir === "top" ? { ...p, px: H - p.py!, py: p.px } : { ...p, dir: rot(p.dir, 1), cells: p.cells!.map(([x, y]) => [H - 1 - y, x] as [number, number]) }));
    [w, h] = [h, w];
  }
  return {
    w, h,
    ports: ps.map((p) => (p.dir === "top" ? { ...p, px: p.px! + b.x, py: p.py! + b.y } : { ...p, cells: p.cells!.map(([x, y]) => [x + b.x, y + b.y] as [number, number]) })),
  };
}

/** Clé d'un port de côté : sa case la plus en haut à gauche, son côté, sa largeur. */
export function portKey(cells: [number, number][], dir: Dir): string {
  const m = cells.reduce((a, c) => (c[1] < a[1] || (c[1] === a[1] && c[0] < a[0]) ? c : a));
  return `${m[0]},${m[1]},${dir},${cells.length}`;
}
/** Clé du port qui ferait face exactement (même largeur : un port de 2 cases ne se raccorde qu'à un port de 2 cases). */
export function facingKey(p: PlacedPort): string {
  const dir = p.dir as Dir;
  return portKey(p.cells!.map(([x, y]) => [x + DV[dir][0], y + DV[dir][1]] as [number, number]), OPP[dir]);
}

/** Ouvertures d'une case de tuyau : ses ports, plus l'axe d'un tuyau droit de largeur 1 (il traverse toutes ses cases). */
export function cellOpen(def: SbBlock, b: Placed, x: number, y: number): Set<Dir> {
  const s = new Set<Dir>(b.open ?? []), g = geo(def, b); // `open` : pièce non relevée, posée « à compléter » (B2)
  if (!g) return s;
  for (const p of g.ports) if (p.dir !== "top" && p.cells!.some(([cx, cy]) => cx === x && cy === y)) s.add(p.dir);
  if (def.pipe?.role === "droit" && Math.min(def.geo!.w, def.geo!.h) === 1) for (const d of (b.r % 2 ? ["E", "W"] : ["N", "S"]) as Dir[]) s.add(d);
  return s;
}

/** Index des cases occupées (case → u) ; les chevauchements sont signalés. */
export function occupancy(cat: SbCatalog, layout: Layout): { occ: Map<string, number>; overlaps: number[] } {
  const occ = new Map<string, number>(), overlaps: number[] = [];
  for (const b of layout.blocks) {
    const def = cat.blocks.get(b.id);
    if (!def) continue;
    for (const [x, y] of cellsOf(def, b)) {
      const k = cellKey(x, y);
      if (occ.has(k)) overlaps.push(b.u);
      else occ.set(k, b.u);
    }
  }
  return { occ, overlaps };
}

/** Raccord entre deux ports de côté : face à face, même type, au moins un tuyau, jamais deux entrées ni deux sorties. */
export type Link = { a: number; pa: PlacedPort; b: number; pb: PlacedPort };
export function links(cat: SbCatalog, layout: Layout): Link[] {
  const at = new Map<string, { u: number; p: PlacedPort }>();
  for (const b of layout.blocks) {
    const def = cat.blocks.get(b.id), g = def && geo(def, b);
    if (g) for (const p of g.ports) if (p.cells) at.set(portKey(p.cells, p.dir as Dir), { u: b.u, p });
  }
  const ids = new Map(layout.blocks.map((b) => [b.u, b.id]));
  const isPipe = (u: number) => !!cat.blocks.get(ids.get(u)!)?.pipe;
  const out: Link[] = [], seen = new Set<string>();
  for (const [k, { u, p }] of at) {
    const q = at.get(facingKey(p));
    if (!q || q.u === u || q.p.t !== p.t || seen.has(k)) continue;
    if (!isPipe(u) && !isPipe(q.u)) continue;
    // Deux entrées ou deux sorties ne se lient pas, sauf un tuyau dont la sortie touche un port de sortie de machine (entrée par ce port, BAS-11).
    const sameRole = (p.d === "e" && q.p.d === "e") || (p.d === "s" && q.p.d === "s");
    if (sameRole && !(p.d === "s" && isPipe(u) !== isPipe(q.u))) continue;
    seen.add(k); seen.add(facingKey(p));
    out.push({ a: u, pa: p, b: q.u, pb: q.p });
  }
  return out;
}

/*
 * Machines collées (règles du 2026-10-13 et du 2026-10-14, rappelées le 2026-10-31). Un port n'est qu'un point de
 * contact : deux machines dont des ports objet ou fluide se font face sont liées, même par deux entrées. Le joueur
 * choisit alors quel port de la 1re envoie vers quel port de la 2de : une sortie part de son port de sortie, une
 * ressource entre par n'importe quel port du même type (même une sortie). Un contact d'un type (objet ou fluide)
 * autorise autant de liaisons qu'on veut entre tous les ports de ce type des deux machines. Par défaut, une sortie collée à une entrée du même type s'y raccorde seule.
 */

/** Contacts entre deux machines : paires de ports de côté qui se font face, du même type (objet ou fluide). */
export type Contact = { a: number; ia: number; b: number; ib: number; t: "o" | "f" };
export function contacts(cat: SbCatalog, layout: Layout): Contact[] {
  const at = new Map<string, { u: number; i: number; p: PlacedPort }>();
  for (const b of layout.blocks) {
    const def = cat.blocks.get(b.id), g = def && !def.pipe && geo(def, b);
    if (g) g.ports.forEach((p, i) => { if (p.cells && (p.t === "o" || p.t === "f")) at.set(portKey(p.cells, p.dir as Dir), { u: b.u, i, p }); });
  }
  const out: Contact[] = [];
  for (const [k, x] of at) {
    const fk = facingKey(x.p), y = at.get(fk);
    if (!y || y.u === x.u || y.p.t !== x.p.t || k > fk) continue;
    out.push({ a: x.u, ia: x.i, b: y.u, ib: y.i, t: x.p.t as "o" | "f" });
  }
  return out;
}

const pairOf = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Raccords directs entre machines : les liaisons du joueur, et par défaut sortie collée à entrée (sauf si le joueur a choisi pour ce contact). */
export function machineLinks(cat: SbCatalog, layout: Layout): (Route & { auto: boolean })[] {
  const cs = contacts(cat, layout), routes = layout.routes ?? [];
  const ok: Route[] = []; // dans l'ordre de pose : une liaison devenue impossible (machine déplacée) est ignorée
  for (const r of routes) if (!routeError(cat, { ...layout, routes: ok }, r)) ok.push(r);
  const chosen = new Set(ok.map((r) => `${pairOf(r.a, r.b)}|${portType(cat, layout, r.a, r.ia)}`));
  const out: (Route & { auto: boolean })[] = ok.map((r) => ({ ...r, auto: false }));
  for (const c of cs) {
    if (chosen.has(`${pairOf(c.a, c.b)}|${c.t}`)) continue;
    const da = portAt(cat, layout, c.a, c.ia)?.d, db = portAt(cat, layout, c.b, c.ib)?.d;
    if (da === "s" && db === "e") out.push({ a: c.a, ia: c.ia, b: c.b, ib: c.ib, auto: true });
    else if (da === "e" && db === "s") out.push({ a: c.b, ia: c.ib, b: c.a, ib: c.ia, auto: true });
  }
  return out;
}

function portAt(cat: SbCatalog, layout: Layout, u: number, i: number): PlacedPort | undefined {
  const b = layout.blocks.find((x) => x.u === u), def = b && cat.blocks.get(b.id), g = def && geo(def, b);
  return g?.ports[i];
}
const portType = (cat: SbCatalog, layout: Layout, u: number, i: number) => portAt(cat, layout, u, i)?.t;

export type RouteError = "same" | "notMachine" | "type" | "notOutput" | "noContact";
/** Pourquoi une liaison n'est pas permise (null : elle l'est). `layout.routes` : les liaisons déjà posées, sans celle-ci. */
export function routeError(cat: SbCatalog, layout: Layout, r: Route): RouteError | null {
  if (r.a === r.b) return "same";
  const ba = layout.blocks.find((x) => x.u === r.a), bb = layout.blocks.find((x) => x.u === r.b);
  if (!ba || !bb || cat.blocks.get(ba.id)?.pipe || cat.blocks.get(bb.id)?.pipe) return "notMachine";
  const pa = portAt(cat, layout, r.a, r.ia), pb = portAt(cat, layout, r.b, r.ib);
  if (!pa?.cells || !pb?.cells || pa.t !== pb.t || (pa.t !== "o" && pa.t !== "f")) return "type";
  if (pa.d === "e") return "notOutput";
  if (!contacts(cat, layout).some((c) => pairOf(c.a, c.b) === pairOf(r.a, r.b) && c.t === pa.t)) return "noContact";
  // Un contact autorise autant de liaisons qu'on veut entre tous les ports du même type des deux machines (2026-10-31).
  return null;
}

const sameRoute = (q: Route, r: Route) => q.a === r.a && q.ia === r.ia && q.b === r.b && q.ib === r.ib;

/** Voie d'une pièce de tuyau par laquelle passe ce port (0, ou 0 / 1 pour un croisement). */
export function laneAt(cat: SbCatalog, b: Placed, p: PlacedPort): 0 | 1 {
  const pi = cat.blocks.get(b.id)?.pipe;
  return pi?.role === "croisement" ? crossLane(pi.kind === "m" ? 0 : b.pair, p.dir as Dir) : 0;
}
/** Paires de ports qui se font face entre la voie `lane` du tuyau `pu` et le bâtiment `u` (même type). */
function laneContacts(cat: SbCatalog, layout: Layout, pu: number, lane: number, u: number): { p: PlacedPort; q: PlacedPort; qi: number }[] {
  const A = layout.blocks.find((x) => x.u === pu), B = layout.blocks.find((x) => x.u === u);
  const ga = A && geo(cat.blocks.get(A.id)!, A), gb = B && geo(cat.blocks.get(B.id)!, B);
  if (!ga || !gb) return [];
  const out: { p: PlacedPort; q: PlacedPort; qi: number }[] = [];
  for (const p of ga.ports) {
    if (!p.cells || laneAt(cat, A!, p) !== lane) continue;
    const fk = facingKey(p);
    gb.ports.forEach((q, qi) => { if (q.cells && q.t === p.t && portKey(q.cells, q.dir as Dir) === fk) out.push({ p, q, qi }); });
  }
  return out;
}

export type ClickResult = { routes: Route[]; did: "added" | "removed" | "off" | "on" } | { pair: CrossPair; u: number; did: "lane" } | { err: RouteError };
/**
 * Geste du joueur, d'un bouton à l'autre, comme en jeu (S57 : machines et tuyaux, BAS-12 c). Entre machines : refaire une
 * liaison déjà posée la supprime ; sinon elle est posée si les règles le permettent. Avec un tuyau (`ia` / `ib` = voie) :
 * - machine → tuyau collé à son port de sortie : retire (puis rend) la production dans ce tuyau (BAS-12 b) ;
 * - tuyau → machine qu'il touche : le bouton d'entrée d'arrivée (refaire la même le retire) ;
 * - voie d'un croisement → bouton voisin : la voie sort de ce côté (les deux autres côtés vont à l'autre voie). `keep` :
 *   le côté par lequel le flux y entre, gardé dans la voie.
 */
export function clickRoute(cat: SbCatalog, layout: Layout, r: Route, keep?: Dir): ClickResult {
  const routes = layout.routes ?? [];
  const blk = (u: number) => layout.blocks.find((x) => x.u === u);
  const A = blk(r.a), B = blk(r.b);
  if (!A || !B || r.a === r.b) return { err: "same" };
  const pa = cat.blocks.get(A.id)?.pipe, pb = cat.blocks.get(B.id)?.pipe;
  const crossSet = (): ClickResult => {
    const gx = geo(cat.blocks.get(A.id)!, A), gb = geo(cat.blocks.get(B.id)!, B);
    const side = gx?.ports.find((p) => p.cells && gb?.ports.some((q) => q.cells && q.t === p.t && portKey(q.cells, q.dir as Dir) === facingKey(p)))?.dir as Dir | undefined;
    if (!side) return { err: "noContact" };
    const cur = CROSS_PAIRS[A.pair ?? 0][r.ia === 1 ? 1 : 0];
    if (cur.includes(side)) return { pair: A.pair ?? 0, u: A.u, did: "lane" };
    const k0 = keep && cur.includes(keep) ? keep : cur[0]!;
    const pair = ([0, 1, 2] as CrossPair[]).find((k) => CROSS_PAIRS[k].some((l) => l.includes(k0) && l.includes(side)))!;
    return { pair, u: A.u, did: "lane" };
  };
  if (pa || pb) {
    if (pa?.role === "croisement" && pa.kind !== "m") return crossSet();
    if (pa && !pb) { // tuyau → machine : le bouton d'arrivée
      const cs = laneContacts(cat, layout, r.a, r.ia, r.b);
      if (!cs.length) return { err: "noContact" };
      const q = portAt(cat, layout, r.b, r.ib);
      if (!q?.cells || q.t !== cs[0]!.p.t) return { err: "type" };
      const has = routes.find((x) => !x.off && x.a === r.a && x.ia === r.ia && x.b === r.b);
      const rest = routes.filter((x) => x !== has);
      return has && has.ib === r.ib ? { routes: rest, did: "removed" } : { routes: [...rest, { a: r.a, ia: r.ia, b: r.b, ib: r.ib }], did: "added" };
    }
    if (!pa && pb) { // machine → tuyau : production retirée ou rendue
      const q = portAt(cat, layout, r.a, r.ia);
      if (!q?.cells) return { err: "type" };
      if (q.d !== "s") return { err: "notOutput" };
      if (!laneContacts(cat, layout, r.b, r.ib, r.a).some((c) => c.qi === r.ia)) return { err: "noContact" };
      const off: Route = { a: r.a, ia: r.ia, b: r.b, ib: r.ib, off: true };
      return routes.some((x) => x.off && sameRoute(x, off)) ? { routes: routes.filter((x) => !(x.off && sameRoute(x, off))), did: "on" } : { routes: [...routes, off], did: "off" };
    }
    return { err: "notMachine" }; // tuyau → tuyau : seule la voie d'un croisement se règle
  }
  if (routes.some((q) => sameRoute(q, r))) return { routes: routes.filter((q) => !sameRoute(q, r)), did: "removed" };
  const e = routeError(cat, layout, r);
  return e ? { err: e } : { routes: [...routes, r], did: "added" };
}
