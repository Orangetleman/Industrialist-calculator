// Occupation de la grille et routage des tuyaux (A*). Une case porte un bâtiment, ou un tuyau d'un
// réseau (une ressource) avec ses liaisons vers les cases voisines. Deux réseaux peuvent se
// croiser à angle droit dans une même case (pièce de croisement du jeu). Pur, sans DOM.

import { add, key, OPPOSITE, type Cell, type Dir } from "./geometry.ts";

export type PipeCell = { net: string; links: Set<Dir>; cross?: { net: string; links: Set<Dir> } };
/** Case réservée à un port ; avec `facing` (sens du port), un autre réseau peut la traverser en travers du port. */
export type Occupant = { kind: "bloc"; owner: string } | { kind: "réservé"; net: string; facing?: Dir } | ({ kind: "tuyau" } & PipeCell);
export type Bounds = { x0: number; y0: number; x1: number; y1: number };

const COST = { step: 1, turn: 0.6, cross: 8 };

/**
 * Clé numérique d'un état de recherche (case, sens d'arrivée, croisement) : remplace la clé texte
 * « x,y|sens|croisement » (S27 bis, plus rapide ; mêmes états distingués). Cases de −1 024 à 64 511.
 */
const DIR_INDEX: Record<Dir, number> = { N: 0, E: 1, S: 2, W: 3 };
export function stateKey(x: number, y: number, d: Dir | null, crossing: boolean): number {
  return (((x + 1024) * 65536 + (y + 1024)) * 5 + (d === null ? 4 : DIR_INDEX[d])) * 2 + (crossing ? 1 : 0);
}

export class Grid {
  readonly cells = new Map<string, Occupant>();

  get(c: Cell): Occupant | undefined {
    return this.cells.get(key(c));
  }
  block(c: Cell, owner: string): void {
    this.cells.set(key(c), { kind: "bloc", owner });
  }
  reserve(c: Cell, net: string, facing?: Dir): void {
    this.cells.set(key(c), facing ? { kind: "réservé", net, facing } : { kind: "réservé", net });
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
  // Collecteur de la même ressource collé au port : il l'alimente directement (té).
  if (so?.kind === "tuyau" && (so.net === net || so.cross?.net === net)) {
    grid.link(start, toPort, net);
    return true;
  }
  // Collecteur d'une autre ressource collé au port : on le traverse par un croisement collé au port
  // (en jeu, les deux tuyaux d'un croisement collé à un port se relient à la machine).
  const away = OPPOSITE[toPort];
  const across = away === "N" || away === "S" ? ["E", "W"] : ["N", "S"];
  const startCross = so?.kind === "tuyau" && !so.cross && so.links.size === 2 && across.every((d) => so.links.has(d as Dir));
  if (so && !(so.kind === "réservé" && so.net === net) && !startCross) return false;
  type Node = { c: Cell; d: Dir | null; g: number; f: number; prev: Node | null; crossing: boolean };
  const open = new Heap<Node>();
  open.push({ c: start, d: startCross ? away : null, g: startCross ? COST.cross : 0, f: h(start), prev: null, crossing: startCross });
  const best = new Map<number, number>();
  let found: Node | null = null;
  let guard = 0;
  while (open.size && guard++ < 200_000) {
    const cur = open.pop()!;
    const sk = stateKey(cur.c.x, cur.c.y, cur.d, cur.crossing);
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
      // Case d'un port d'un autre réseau, traversée en travers du port : elle deviendra un croisement collé
      // au port (en jeu, les deux tuyaux du croisement se relient à la machine).
      if (o?.kind === "réservé" && o.net !== net && o.facing && (o.facing === "N" || o.facing === "S") !== (d === "N" || d === "S")) {
        const g = cur.g + COST.step + COST.cross + turnCost;
        push(open, best, { c: n, d, g, f: g + h(n), prev: cur, crossing: true });
        continue;
      }
      if (o) continue; // bâtiment, plot, ou case réservée à un autre port
      const g = cur.g + COST.step + turnCost;
      push(open, best, { c: n, d, g, f: g + h(n), prev: cur, crossing: false });
    }
    if (found && (!open.size || open.peek()!.f >= found.g)) break;
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

function push<T extends { c: Cell; d: Dir | null; g: number; f: number; crossing: boolean }>(open: Heap<T>, best: Map<number, number>, n: T): void {
  const sk = stateKey(n.c.x, n.c.y, n.d, n.crossing);
  if ((best.get(sk) ?? Infinity) <= n.g) return;
  best.set(sk, n.g);
  open.push(n);
}

/**
 * File de priorité (tas binaire) : le plus petit `f` d'abord ; à égalité, le premier entré
 * (comme une recherche linéaire du minimum, mais en temps logarithmique).
 */
export class Heap<T extends { f: number }> {
  // Valeurs et numéros d'entrée côte à côte ; on déplace les éléments vers un trou au lieu de les échanger
  // (moins d'objets créés). L'ordre (f, numéro d'entrée) est total : les sorties sont les mêmes qu'avant.
  private v: T[] = [];
  private s: number[] = [];
  private seq = 0;
  get size(): number {
    return this.v.length;
  }
  peek(): T | undefined {
    return this.v[0];
  }
  push(x: T): void {
    const { v, s } = this;
    const q = this.seq++;
    let i = v.length;
    v.push(x);
    s.push(q);
    while (i > 0) {
      const p = (i - 1) >> 1;
      const pv = v[p]!;
      if (!(x.f < pv.f || (x.f === pv.f && q < s[p]!))) break;
      v[i] = pv;
      s[i] = s[p]!;
      i = p;
    }
    v[i] = x;
    s[i] = q;
  }
  pop(): T | undefined {
    const { v, s } = this;
    if (!v.length) return undefined;
    const top = v[0]!;
    const x = v.pop()!;
    const q = s.pop()!;
    const n = v.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        let c = l;
        if (r < n && (v[r]!.f < v[l]!.f || (v[r]!.f === v[l]!.f && s[r]! < s[l]!))) c = r;
        const cv = v[c]!;
        if (!(cv.f < x.f || (cv.f === x.f && s[c]! < q))) break;
        v[i] = cv;
        s[i] = s[c]!;
        i = c;
      }
      v[i] = x;
      s[i] = q;
    }
    return top;
  }
}
