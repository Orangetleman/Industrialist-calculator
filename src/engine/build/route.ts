// Occupation de la grille et routage des tuyaux (A*). Une case porte un bâtiment, ou un tuyau d'un
// réseau (une ressource) avec ses liaisons vers les cases voisines. Deux réseaux peuvent se
// croiser à angle droit dans une même case (pièce de croisement du jeu). Pur, sans DOM.

import { add, key, OPPOSITE, type Cell, type Dir } from "./geometry.ts";

export type PipeCell = { net: string; links: Set<Dir>; cross?: { net: string; links: Set<Dir> } };
export type Occupant = { kind: "bloc"; owner: string } | { kind: "réservé"; net: string } | ({ kind: "tuyau" } & PipeCell);
export type Bounds = { x0: number; y0: number; x1: number; y1: number };

const COST = { step: 1, turn: 0.6, cross: 8 };

export class Grid {
  readonly cells = new Map<string, Occupant>();

  get(c: Cell): Occupant | undefined {
    return this.cells.get(key(c));
  }
  block(c: Cell, owner: string): void {
    this.cells.set(key(c), { kind: "bloc", owner });
  }
  reserve(c: Cell, net: string): void {
    this.cells.set(key(c), { kind: "réservé", net });
  }
  /** Ajoute une liaison du réseau `net` dans la case `c` (crée le tuyau si la case est libre ou réservée pour lui). */
  link(c: Cell, d: Dir, net: string): void {
    const o = this.get(c);
    if (o?.kind === "tuyau") {
      if (o.net === net) o.links.add(d);
      else if (o.cross?.net === net) o.cross.links.add(d);
      else (o.cross = { net, links: new Set([d]) });
      return;
    }
    this.cells.set(key(c), { kind: "tuyau", net, links: new Set([d]) });
  }
  /** Tuyau droit d'un réseau, de `a` à `b` sur une ligne ou une colonne. */
  straight(a: Cell, b: Cell, net: string): void {
    const horiz = a.y === b.y;
    const [lo, hi] = horiz ? [Math.min(a.x, b.x), Math.max(a.x, b.x)] : [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    for (let v = lo; v <= hi; v++) {
      const c = horiz ? { x: v, y: a.y } : { x: a.x, y: v };
      if (v > lo) this.link(c, horiz ? "W" : "N", net);
      if (v < hi) this.link(c, horiz ? "E" : "S", net);
    }
  }
}

/**
 * Route un tuyau du réseau `net` depuis `start` (la case qui touche un port ; `toPort` = sens du
 * port vu depuis cette case) jusqu'à une case déjà occupée par ce réseau. Les autres réseaux ne se
 * traversent qu'à angle droit, sur un tuyau droit (croisement). Renvoie false sans rien poser si
 * aucun chemin n'existe dans `bounds`.
 */
export function route(grid: Grid, net: string, start: Cell, toPort: Dir, bounds: Bounds, h: (c: Cell) => number): boolean {
  const so = grid.get(start);
  if (so && !(so.kind === "réservé" && so.net === net)) return false;
  type Node = { c: Cell; d: Dir | null; g: number; f: number; prev: Node | null; crossing: boolean };
  const open: Node[] = [{ c: start, d: null, g: 0, f: h(start), prev: null, crossing: false }];
  const best = new Map<string, number>();
  let found: Node | null = null;
  let guard = 0;
  while (open.length && guard++ < 200_000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    const sk = `${key(cur.c)}|${cur.d}|${cur.crossing}`;
    if ((best.get(sk) ?? Infinity) <= cur.g - 1e-9 && cur.prev) continue;
    const dirs: Dir[] = cur.crossing ? [cur.d!] : (["N", "E", "S", "W"] as Dir[]).filter((d) => !cur.d || d !== OPPOSITE[cur.d]);
    for (const d of dirs) {
      if (!cur.d && d === toPort) continue; // ne pas repartir dans le port
      const n = add(cur.c, d);
      if (n.x < bounds.x0 || n.x > bounds.x1 || n.y < bounds.y0 || n.y > bounds.y1) continue;
      const o = grid.get(n);
      const turnCost = cur.d && d !== cur.d ? COST.turn : 0;
      if (o?.kind === "tuyau") {
        if (o.net === net && !o.cross) {
          if (o.links.size >= 4) continue;
          const g = cur.g + COST.step + turnCost;
          if (!found || g < found.g) found = { c: n, d, g, f: g, prev: cur, crossing: false };
          continue;
        }
        // Croisement : un tuyau droit d'un autre réseau, perpendiculaire, sans croisement déjà.
        const vertical = d === "N" || d === "S";
        const straightOther = o.net !== net && !o.cross && o.links.size === 2 && (vertical ? o.links.has("E") && o.links.has("W") : o.links.has("N") && o.links.has("S"));
        if (!straightOther) continue;
        const g = cur.g + COST.step + COST.cross + turnCost;
        push(open, best, { c: n, d, g, f: g + h(n), prev: cur, crossing: true });
        continue;
      }
      if (o) continue; // bâtiment, plot, ou case réservée à un autre port
      const g = cur.g + COST.step + turnCost;
      push(open, best, { c: n, d, g, f: g + h(n), prev: cur, crossing: false });
    }
    if (found && open.every((x) => x.f >= found!.g)) break;
  }
  if (!found) return false;
  // Pose : la case de départ se raccorde au port, puis chaque pas relie deux cases.
  const path: { c: Cell; d: Dir | null }[] = [];
  for (let n: Node | null = found; n; n = n.prev) path.unshift({ c: n.c, d: n.d });
  grid.link(start, toPort, net);
  for (let i = 1; i < path.length; i++) {
    const d = path[i]!.d!;
    grid.link(path[i - 1]!.c, d, net);
    grid.link(path[i]!.c, OPPOSITE[d], net);
  }
  return true;
}

function push(open: { c: Cell; d: Dir | null; g: number; f: number; crossing: boolean }[], best: Map<string, number>, n: { c: Cell; d: Dir | null; g: number; f: number; prev: unknown; crossing: boolean }): void {
  const sk = `${key(n.c)}|${n.d}|${n.crossing}`;
  if ((best.get(sk) ?? Infinity) <= n.g) return;
  best.set(sk, n.g);
  open.push(n as never);
}
