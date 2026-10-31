// Bac à sable (B1) : le montage posé. Empreinte, ports tournés (y compris les ports de 2 cases des grands
// tuyaux et les prises posées dessus), ouvertures des cases de tuyau, raccords face à face.
// Repère : x vers la droite, y vers le bas ; r = quarts de tour dans le sens horaire.

import type { Dir, PortRole, PortType, SbBlock, SbCatalog } from "./catalog.ts";

export const DIRS: Dir[] = ["N", "E", "S", "W"];
export const DV: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const OPP: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };
export const rot = (d: Dir, r: number): Dir => DIRS[(DIRS.indexOf(d) + r) % 4]!;
export const cellKey = (x: number, y: number) => `${x},${y}`;

/** Un bâtiment posé : `u` identifiant unique, `choice` recette choisie par le joueur (gardée tant qu'elle reste possible). */
export type Placed = { u: number; id: string; x: number; y: number; r: number; choice?: string | null };
/** Câble de prise à prise, orienté de `a` vers `b` (indices des ports dans `geo().ports`). */
export type Wire = { a: number; ia: number; b: number; ib: number; t: "p" | "g" };
export type Layout = { blocks: Placed[]; wires: Wire[] };

/** Port tourné et placé. Côté : `cells` (1 ou 2 cases, dans le bâtiment). Dessus : centre `px`, `py` (en cases). */
export type PlacedPort = { t: PortType; d: PortRole; tip?: string; items?: string[]; dir: Dir | "top"; cells?: [number, number][]; px?: number; py?: number };
export type PlacedGeo = { w: number; h: number; ports: PlacedPort[] };

export function dims(def: SbBlock, r: number): [number, number] {
  const g = def.geo;
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
  const free = !!def.pipe && def.pipe.role !== "spécial";
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
  const s = new Set<Dir>(), g = geo(def, b);
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
    if ((p.d === "e" && q.p.d === "e") || (p.d === "s" && q.p.d === "s") || (!isPipe(u) && !isPipe(q.u))) continue;
    seen.add(k); seen.add(facingKey(p));
    out.push({ a: u, pa: p, b: q.u, pb: q.p });
  }
  return out;
}
