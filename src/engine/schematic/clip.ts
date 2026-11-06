/**
 * Copie d'une zone du bac à sable (lot B5) : bâtiments, recettes, voies des croisements, câbles et liaisons.
 * Dans `wires` et `routes`, `a` et `b` sont des indices dans `items`. Module pur : la vue ne fait que le poser.
 */
import { CROSS_PAIRS, cellsOf, crossLane, dims, type CrossPair, type Layout, type Placed, type Route, type Wire } from "../sandbox/layout";
import type { Dir, RecipeFill, SbCatalog } from "../sandbox/catalog";
import type { Schematic } from "./msch";

export type ClipItem = { id: string; dx: number; dy: number; r: number; choice: string | null; pair?: CrossPair; open?: Dir[] };
/** `wires` et `routes` manquent dans les schémas enregistrés avant B5. */
export type Clip = { id: number; items: ClipItem[]; W: number; H: number; wires?: Wire[]; routes?: Route[]; fills?: Fills; saved?: string };
type Fills = Record<string, RecipeFill>;

/** Ajoute les chiffres d'un schéma à ceux du joueur : ce que le joueur a déjà saisi n'est jamais remplacé. */
export const mergeFills = (mine: Fills, incoming: Fills | undefined): Fills => ({ ...incoming, ...mine });

type Linked = { a: number; b: number };
/** Renumérote des câbles ou des liaisons ; ceux dont un bout n'est plus là sont écartés. */
export const relink = <T extends Linked>(l: readonly T[] | undefined, to: (n: number) => number | undefined): T[] =>
  (l ?? []).flatMap((w) => { const a = to(w.a), b = to(w.b); return a == null || b == null ? [] : [{ ...w, a, b }]; });

/** Un montage devient une copie : bâtiments inconnus écartés, coin ramené en (0, 0), taille au plus juste. */
export function clipOf(cat: SbCatalog, layout: Layout, id = Date.now()): Clip | null {
  const ok = layout.blocks.filter((b) => cat.blocks.has(b.id));
  if (!ok.length) return null;
  const mx = Math.min(...ok.map((b) => b.x)), my = Math.min(...ok.map((b) => b.y)), at = new Map(ok.map((b, i) => [b.u, i]));
  const items = ok.map((b): ClipItem => ({
    id: b.id, dx: b.x - mx, dy: b.y - my, r: b.r, choice: b.choice ?? null,
    ...(b.pair != null ? { pair: b.pair } : {}), ...(b.open ? { open: b.open } : {}),
  }));
  const size = (i: ClipItem) => dims(cat.blocks.get(i.id)!, i.r);
  const fills = Object.entries(layout.fills ?? {}).filter(([r]) => items.some((i) => i.choice === r)); // seulement les recettes utilisées
  return {
    id, items,
    W: Math.max(...items.map((i) => i.dx + size(i)[0])), H: Math.max(...items.map((i) => i.dy + size(i)[1])),
    wires: relink(layout.wires, (u) => at.get(u)), routes: relink(layout.routes, (u) => at.get(u)),
    ...(fills.length ? { fills: Object.fromEntries(fills) } : {}),
  };
}

/** Ce qui tient entier dans le rectangle (cases, bornes comprises). Les pièces « à compléter » ne se copient pas. */
export function copyZone(cat: SbCatalog, layout: Layout, x0: number, y0: number, x1: number, y1: number): Clip | null {
  const blocks = layout.blocks.filter((b) => { const d = cat.blocks.get(b.id); return d && !b.open && cellsOf(d, b).every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1); });
  const keep = new Set(blocks.map((b) => b.u)), inside = (w: Linked) => keep.has(w.a) && keep.has(w.b);
  return clipOf(cat, { ...layout, blocks, wires: layout.wires.filter(inside), routes: (layout.routes ?? []).filter(inside) });
}

/** La copie vue comme un montage, numéros = indices (`x`, `y` : coin d'arrivée). */
export function clipLayout(c: Clip, x = 0, y = 0): Layout {
  return {
    blocks: c.items.map((it, u): Placed => ({
      u, id: it.id, x: x + it.dx, y: y + it.dy, r: it.r, choice: it.choice,
      ...(it.pair != null ? { pair: it.pair } : {}), ...(it.open ? { open: it.open } : {}),
    })),
    wires: c.wires ?? [], routes: c.routes ?? [], ...(c.fills ? { fills: c.fills } : {}),
  };
}

export const clipToSchematic = (c: Clip, meta: { name: string; desc?: string; tags?: string[] }): Schematic => ({
  name: meta.name, description: meta.desc ?? "", labels: meta.tags ?? [], width: c.W, height: c.H, layout: clipLayout(c),
});

/** Voies d'un croisement après un retournement ou une rotation (`f` : ce que devient chaque côté). */
function movedPair(pair: CrossPair, f: (d: Dir) => Dir): CrossPair {
  const [a, b] = CROSS_PAIRS[pair][0].map(f) as [Dir, Dir];
  return ([0, 1, 2] as const).find((q) => CROSS_PAIRS[q].some((l) => l.includes(a) && l.includes(b)))!;
}

/** Applique un déplacement à toute la copie : les liaisons qui visent une voie de croisement la suivent. */
function moved(cat: SbCatalog, c: Clip, f: (d: Dir) => Dir, place: (it: ClipItem, w: number, h: number) => Pick<ClipItem, "dx" | "dy" | "r">): ClipItem[] {
  const before = c.items, items = before.map((it) => {
    const [w, h] = dims(cat.blocks.get(it.id)!, it.r), n: ClipItem = { ...it, ...place(it, w, h) };
    if (it.pair != null) n.pair = movedPair(it.pair, f);
    if (it.open) n.open = it.open.map(f);
    return n;
  });
  const lane = (i: number, l: number) => {
    const it = before[i]!, p = cat.blocks.get(it.id)?.pipe;
    if (p?.role !== "croisement") return l;
    const pair = p.kind === "m" ? 0 : it.pair ?? 0;
    return crossLane(p.kind === "m" ? 0 : items[i]!.pair ?? movedPair(pair, f), f(CROSS_PAIRS[pair][l === 1 ? 1 : 0][0]!));
  };
  if (c.routes) c.routes = c.routes.map((r) => ({ ...r, ia: lane(r.a, r.ia), ib: lane(r.b, r.ib) }));
  return items;
}

const CW: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };
const MIRROR_X: Record<Dir, Dir> = { N: "N", S: "S", E: "W", W: "E" };
const MIRROR_Y: Record<Dir, Dir> = { E: "E", W: "W", N: "S", S: "N" };

/** Un quart de tour dans le sens horaire. */
export function rotateClip(cat: SbCatalog, c: Clip): void {
  const H = c.H;
  c.items = moved(cat, c, (d) => CW[d], (it, _w, h) => ({ dx: H - (it.dy + h), dy: it.dx, r: (it.r + 1) % 4 }));
  [c.W, c.H] = [c.H, c.W];
}

/** Retourne la copie (`x` : gauche-droite). Comme Mindustry, un bâtiment garde sa forme : seul son sens change. */
export function flipClip(cat: SbCatalog, c: Clip, x: boolean): void {
  const { W, H } = c;
  c.items = moved(cat, c, (d) => (x ? MIRROR_X : MIRROR_Y)[d], (it, w, h) => (x
    ? { dx: W - (it.dx + w), dy: it.dy, r: it.r % 2 ? (it.r + 2) % 4 : it.r }
    : { dx: it.dx, dy: H - (it.dy + h), r: it.r % 2 ? it.r : (it.r + 2) % 4 }));
}

/**
 * Empreinte d'un montage : ne dépend ni de sa place sur la grille, ni de l'ordre des bâtiments, ni de leurs numéros.
 * Deux montages de même empreinte ont les mêmes pièces, recettes, chiffres saisis, voies, câbles et liaisons.
 */
export function fingerprint(l: Layout): string {
  if (!l.blocks.length) return "";
  const x0 = Math.min(...l.blocks.map((b) => b.x)), y0 = Math.min(...l.blocks.map((b) => b.y));
  const line = (b: Placed) => [b.id, b.x - x0, b.y - y0, b.r, b.choice ?? "", b.pair ?? "", (b.open ?? []).join("")].join(",");
  const sorted = [...l.blocks].sort((p, q) => (line(p) < line(q) ? -1 : 1)), at = new Map(sorted.map((b, i) => [b.u, i]));
  const wires = relink(l.wires, (u) => at.get(u)).map((w) => [w.a, w.ia, w.b, w.ib, w.t].join(",")).sort();
  const routes = relink(l.routes, (u) => at.get(u)).map((r) => [r.a, r.ia, r.b, r.ib, r.off ? 1 : 0].join(",")).sort();
  const nums = (o: Record<string, number> = {}) => Object.entries(o).sort(([p], [q]) => (p < q ? -1 : 1)).join(",");
  const fills = Object.entries(l.fills ?? {}).map(([r, f]) => [r, f.s ?? "", nums(f.in), nums(f.out)].join(":")).sort();
  return [sorted.map(line).join(";"), wires.join(";"), routes.join(";"), fills.join(";")].join("|");
}
