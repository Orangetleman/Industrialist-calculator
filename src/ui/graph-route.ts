// Tracé des liaisons de l'éditeur de graphe (pur, sans DOM) : segments droits qui contournent les nœuds et
// ne se posent pas les uns sur les autres. Deux liaisons de produits différents peuvent se croiser (un graphe
// n'est pas toujours dessinable sans croisement), jamais partager le même trait ; celles qui partent de la
// même sortie, ou arrivent à la même entrée, peuvent le partager.

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
export type RouteIn = {
  id: string;
  /** Sortie (a) et entrée (b), en coordonnées du monde. */
  a: Pt;
  b: Pt;
  /** Boîtes d'où part et où arrive la liaison. */
  ab: Box;
  bb: Box;
  /** Clés de la sortie et de l'entrée : deux liaisons de même clé peuvent se superposer. */
  from: string;
  to: string;
  /** Largeur de l'étiquette de débit. */
  lw: number;
  /** Hauteur de l'étiquette (LABEL_H à défaut). */
  lh?: number;
};
export type Route = { pts: Pt[]; d: string; lx: number; ly: number };

/** Écart entre deux traits voisins. */
export const LANE = 12;
/** Sortie et arrivée d'une liaison : bout droit minimal. */
const STUB = 16;
const CLOSE = 6;
const CELL = 160;
const LABEL_H = 16;
const W_BOX = 1000;
const W_OVER = 200;
const W_CROSS = 6;
const W_BEND = 14;
const W_LEN = 0.05;

/** Un trait posé (ou une boîte, ou une étiquette) ; `seen` évite de compter deux fois un élément à cheval sur deux cases. */
type Item = { x0: number; y0: number; x1: number; y1: number; from: string; to: string; seen: number; dead?: boolean; id?: string };

/** Éléments rangés par case du plan. */
class Grid {
  private readonly m = new Map<number, Item[]>();
  private static stamp = 0;
  add(v: Item): void {
    for (let cx = Math.floor(v.x0 / CELL); cx <= Math.floor(v.x1 / CELL); cx++)
      for (let cy = Math.floor(v.y0 / CELL); cy <= Math.floor(v.y1 / CELL); cy++) {
        const key = cx * 100003 + cy;
        const l = this.m.get(key);
        if (l) l.push(v);
        else this.m.set(key, [v]);
      }
  }
  /** Chaque élément qui touche le rectangle, une fois. */
  each(x0: number, y0: number, x1: number, y1: number, f: (v: Item) => void): void {
    const s = ++Grid.stamp;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
        for (const v of this.m.get(cx * 100003 + cy) ?? []) {
          if (v.seen === s || v.dead) continue;
          v.seen = s;
          if (v.x0 <= x1 && v.x1 >= x0 && v.y0 <= y1 && v.y1 >= y0) f(v);
        }
  }
}

export function pathOf(pts: Pt[]): string {
  let d = `M${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) d += pts[i]!.y === pts[i - 1]!.y ? `H${pts[i]!.x}` : `V${pts[i]!.y}`;
  return d;
}

/** Retire les points en double ou alignés. */
function clean(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out.at(-1);
    if (q && q.x === p.x && q.y === p.y) continue;
    const r = out.at(-2);
    if (q && r && ((r.x === q.x && q.x === p.x) || (r.y === q.y && q.y === p.y))) out.pop();
    out.push(p);
  }
  return out;
}

const item = (x0: number, y0: number, x1: number, y1: number, from = "", to = ""): Item => ({ x0, y0, x1, y1, from, to, seen: 0 });

/** Au-delà, on ne retrace que les liaisons touchées par un geste (`prev`) ; en deçà, tout se retrace à chaque fois. */
const FULL_MAX = 150;

/**
 * Trace les liaisons. `prev` : les tracés d'avant ; sur un grand graphe, une liaison dont les prises n'ont pas
 * bougé et qu'aucun nœud ne gêne garde le sien. `budgetMs` : au-delà, les liaisons restantes ont un tracé simple
 * (un graphe entassé ne doit pas figer la page).
 */
export function routeEdges(boxes: Box[], edges: RouteIn[], prev?: Map<string, Route>, budgetMs = 600): Map<string, Route> {
  const until = performance.now() + budgetMs;
  const G = new Grid();
  for (const b of boxes) G.add(item(b.x, b.y, b.x + b.w, b.y + b.h));
  const V = new Grid();
  const H = new Grid();
  /** Couloirs verticaux sur des multiples de LANE, d'où qu'on les compte : deux voisins ne se gênent pas. */
  const up = (v: number) => Math.ceil(v / LANE) * LANE;
  const down = (v: number) => Math.floor(v / LANE) * LANE;
  /** Vrai si le dernier coût compté touche un nœud ou un autre trait. */
  let bad = false;
  /** Liaisons sur lesquelles se pose le trait compté (relevé pendant les reprises). */
  let foes: Set<string> | null = null;

  const costV = (x: number, y0: number, y1: number, e: RouteIn): number => {
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (hi - lo < 1) return 0;
    let c = (hi - lo) * W_LEN;
    G.each(x - CLOSE, lo - 4, x + CLOSE, hi + 4, () => {
      c += W_BOX;
      bad = true;
    });
    V.each(x - CLOSE, lo - 2, x + CLOSE, hi + 2, (s) => {
      if (Math.abs(s.x0 - x) >= CLOSE || s.from === e.from || s.to === e.to) return;
      c += W_OVER + Math.max(0, Math.min(hi, s.y1) - Math.max(lo, s.y0));
      bad = true;
      foes?.add(s.id!);
    });
    H.each(x, lo, x, hi, (s) => {
      if (s.x0 < x && s.x1 > x && s.y0 > lo && s.y0 < hi && s.from !== e.from && s.to !== e.to) c += W_CROSS;
    });
    return c;
  };
  const costH = (y: number, x0: number, x1: number, e: RouteIn): number => {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    if (hi - lo < 1) return 0;
    let c = (hi - lo) * W_LEN;
    G.each(lo, y - 6, hi, y + 6, (b) => {
      if (lo >= b.x1 || hi <= b.x0) return; // part du bord d'un nœud, ou y arrive
      c += W_BOX;
      bad = true;
    });
    H.each(lo, y - CLOSE, hi, y + CLOSE, (s) => {
      if (Math.abs(s.y0 - y) >= CLOSE || s.from === e.from || s.to === e.to || lo >= s.x1 || hi <= s.x0) return;
      c += W_OVER + Math.min(hi, s.x1) - Math.max(lo, s.x0);
      bad = true;
      foes?.add(s.id!);
    });
    V.each(lo, y, hi, y, (s) => {
      if (s.x0 > lo && s.x0 < hi && s.y0 < y && s.y1 > y && s.from !== e.from && s.to !== e.to) c += W_CROSS;
    });
    return c;
  };
  const total = (pts: Pt[], e: RouteIn): number => {
    let c = (pts.length - 2) * W_BEND;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!;
      const q = pts[i]!;
      c += p.y === q.y ? costH(p.y, p.x, q.x, e) : costV(p.x, p.y, q.y, e);
    }
    return c;
  };

  /**
   * Détour : le chemin traverse une à une les colonnes de nœuds placées entre la sortie et l'entrée, chacune
   * à une hauteur libre (choisie par programmation dynamique), et change de hauteur dans les couloirs.
   */
  const detour = (e: RouteIn): Pt[] => {
    const { a, b } = e;
    const right = b.x - a.x >= 2 * STUB;
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    // Colonnes à traverser : boîtes entre les deux prises, réunies quand elles se touchent presque.
    const slabs: { x0: number; x1: number; boxes: Item[] }[] = [];
    const inside = boxes.filter((o) => (right ? o.x < x1 && o.x + o.w > x0 : o.x < x1 + 1 && o.x + o.w > x0 - 1)).sort((p, q) => p.x - q.x);
    for (const o of inside) {
      const it = item(o.x, o.y, o.x + o.w, o.y + o.h);
      const s = slabs.at(-1);
      if (s && o.x < s.x1 + 2 * STUB) {
        s.x1 = Math.max(s.x1, it.x1);
        s.boxes.push(it);
      } else slabs.push({ x0: it.x0, x1: it.x1, boxes: [it] });
    }
    if (!right) slabs.reverse();
    if (!slabs.length && !right) return simple(e);
    if (!slabs.length) {
      // Colonnes voisines, couloir encombré : une marche de plus, pour quitter la hauteur d'un autre trait.
      let pts: Pt[] = [a, { x: a.x + STUB, y: a.y }, { x: a.x + STUB, y: b.y }, b];
      let pc = Infinity;
      const mid = Math.round((a.y + b.y) / 2);
      for (let n = -14; n <= 14; n++) {
        const y = mid + n * LANE;
        const pick = (from: number, x: number, dir: 1 | -1) => {
          let bx = x + dir * STUB;
          let bc = Infinity;
          for (let i = 0; i < 24; i++) {
            const at = (dir > 0 ? up(x + STUB) : down(x - STUB)) + dir * i * LANE;
            if (at < a.x + STUB || at > b.x - STUB) break;
            const c = costH(from, x, at, e) + costV(at, from, y, e);
            if (c < bc) [bc, bx] = [c, at];
          }
          return bx;
        };
        const l = pick(a.y, a.x, 1);
        const r = pick(b.y, b.x, -1);
        const q = clean([a, { x: l, y: a.y }, { x: l, y }, { x: r, y }, { x: r, y: b.y }, b]);
        const c = total(q, e);
        if (c < pc) [pc, pts] = [c, q];
      }
      return pts;
    }
    // Hauteurs possibles dans chaque colonne (multiples de LANE : les couloirs de deux nœuds se raccordent),
    // les plus proches de la ligne droite d'abord.
    const layers = slabs.map((s, i) => {
      const t = (i + 1) / (slabs.length + 1);
      const aim = a.y + (b.y - a.y) * t;
      const ys = new Set<number>([a.y, b.y]);
      for (const o of s.boxes)
        for (let n = 0; n < 8; n++) {
          ys.add((Math.floor((o.y0 - 8) / LANE) - n) * LANE);
          ys.add((Math.ceil((o.y1 + 8) / LANE) + n) * LANE);
        }
      return [...ys]
        .sort((p, q) => Math.abs(p - aim) - Math.abs(q - aim))
        .slice(0, 110)
        .map((y) => ({ y, c: costH(y, s.x0 - STUB, s.x1 + STUB, e), best: Infinity, from: -1 }));
    });
    layers[0]!.forEach((p) => (p.best = p.c + Math.abs(p.y - a.y) * W_LEN + (p.y === a.y ? 0 : 2 * W_BEND)));
    for (let i = 1; i < layers.length; i++)
      for (const q of layers[i]!)
        layers[i - 1]!.forEach((p, n) => {
          const c = p.best + q.c + Math.abs(p.y - q.y) * W_LEN + (p.y === q.y ? 0 : 2 * W_BEND);
          if (c < q.best) [q.best, q.from] = [c, n];
        });
    let last = 0;
    let lc = Infinity;
    layers.at(-1)!.forEach((p, n) => {
      const c = p.best + Math.abs(p.y - b.y) * W_LEN + (p.y === b.y ? 0 : 2 * W_BEND);
      if (c < lc) [lc, last] = [c, n];
    });
    const ys: number[] = [];
    for (let i = layers.length - 1, n = last; i >= 0; i--) {
      ys[i] = layers[i]![n]!.y;
      n = layers[i]![n]!.from;
    }
    // Changements de hauteur, chacun dans le couloir d'avant sa colonne (et le dernier avant l'entrée).
    const pts: Pt[] = [a];
    const jog = (from: number, to: number, lo: number, hi: number, prevX: number, nextX: number, near: "lo" | "hi") => {
      if (from === to) return;
      let bx = near === "lo" ? lo : hi;
      let bc = Infinity;
      for (let n = 0; n < 30; n++) {
        const x = near === "lo" ? up(lo) + n * LANE : down(hi) - n * LANE;
        if (x < lo || x > hi) break;
        const c = costV(x, from, to, e) + costH(from, prevX, x, e) + costH(to, x, nextX, e);
        if (c < bc) [bc, bx] = [c, x];
      }
      pts.push({ x: bx, y: from }, { x: bx, y: to });
    };
    const far = 30 * LANE;
    for (let i = 0; i <= slabs.length; i++) {
      const from = i ? ys[i - 1]! : a.y;
      const to = i < slabs.length ? ys[i]! : b.y;
      const s = slabs[i];
      const p = slabs[i - 1];
      if (right) {
        const lo = (p ? p.x1 : a.x) + STUB;
        const hi = (s ? s.x0 : b.x) - STUB;
        jog(from, to, lo, Math.max(lo, hi), p ? p.x1 : a.x, s ? s.x0 : b.x, i === 0 ? "lo" : "hi");
      } else if (i === 0) jog(from, to, Math.max(a.x, s!.x1) + STUB, s!.x1 + far, a.x, s!.x1, "lo");
      else if (!s) jog(from, to, p!.x0 - far, Math.min(b.x, p!.x0) - STUB, p!.x0, b.x, "hi");
      else jog(from, to, s.x1 + STUB, Math.max(s.x1 + STUB, p!.x0 - STUB), p!.x0, s.x1, "hi");
    }
    pts.push(b);
    return clean(pts);
  };

  /** Tracé à rebours le plus simple : sous les deux boîtes. */
  const simple = (e: RouteIn): Pt[] => {
    const y = Math.max(e.ab.y + e.ab.h, e.bb.y + e.bb.h) + 24;
    return clean([e.a, { x: e.a.x + STUB, y: e.a.y }, { x: e.a.x + STUB, y }, { x: e.b.x - STUB, y }, { x: e.b.x - STUB, y: e.b.y }, e.b]);
  };

  const best = (e: RouteIn): Pt[] => {
    const { a, b } = e;
    const mx = Math.round((a.x + b.x) / 2);
    if (performance.now() > until) return b.x - a.x >= 2 * STUB ? clean([a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]) : simple(e);
    let bestPts: Pt[] | null = null;
    let bestC = Infinity;
    let ok = false;
    const take = (pts: Pt[]) => {
      bad = false;
      const c = total(pts, e);
      if (c < bestC) [bestC, bestPts, ok] = [c, pts, !bad];
    };
    if (b.x - a.x >= 2 * STUB) {
      if (Math.abs(a.y - b.y) < 1) take([a, { x: b.x, y: a.y }]);
      const xs = new Set<number>();
      for (let i = 0; i < 24; i++) {
        const l = up(a.x + STUB) + i * LANE;
        const r = down(b.x - STUB) - i * LANE;
        if (l <= b.x - STUB) xs.add(l);
        if (r >= a.x + STUB) xs.add(r);
      }
      for (const x of xs) take(clean([a, { x, y: a.y }, { x, y: b.y }, b]));
      if (ok) return bestPts!;
    }
    const d = detour(e);
    take(d);
    return bestPts ?? d;
  };

  // Les plus courtes d'abord : elles ont le moins de choix.
  const order = [...edges].sort((p, q) => Math.abs(p.b.x - p.a.x) + Math.abs(p.b.y - p.a.y) - Math.abs(q.b.x - q.a.x) - Math.abs(q.b.y - q.a.y) || (p.id < q.id ? -1 : 1));
  const paths = new Map<string, Pt[]>();
  const laid = new Map<string, Item[]>();
  const lay = (e: RouteIn, pts: Pt[]) => {
    paths.set(e.id, pts);
    const own: Item[] = [];
    laid.set(e.id, own);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!;
      const q = pts[i]!;
      const s = item(Math.min(p.x, q.x), Math.min(p.y, q.y), Math.max(p.x, q.x), Math.max(p.y, q.y), e.from, e.to);
      s.id = e.id;
      (p.y === q.y ? H : V).add(s);
      own.push(s);
    }
  };
  const lift = (e: RouteIn) => laid.get(e.id)?.forEach((s) => (s.dead = true));
  const same = (p: Pt | undefined, q: Pt) => !!p && Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5;
  const todo: RouteIn[] = [];
  for (const e of order) {
    const was = prev && edges.length > FULL_MAX ? prev.get(e.id)?.pts : undefined;
    bad = false;
    // Posées une à une : le coût ne voit encore que les nœuds et les liaisons déjà gardées.
    if (was && same(was[0], e.a) && same(was.at(-1), e.b) && (total(was, e), !bad)) lay(e, was);
    else todo.push(e);
  }
  for (const e of todo) lay(e, best(e));
  // Reprises : une liaison posée sur un trait ou un nœud se retrace, maintenant que tout est en place.
  // Celles qu'elle gênait se retracent après elle ; on garde l'ensemble le moins coûteux.
  const byId = new Map(edges.map((e) => [e.id, e]));
  const passes = edges.length > FULL_MAX ? 3 : 10;
  for (let pass = 0; pass < passes && performance.now() < until; pass++) {
    let left = 0;
    for (const e of pass % 2 ? order : [...order].reverse()) {
      if (performance.now() > until) break;
      lift(e);
      bad = false;
      foes = new Set();
      total(paths.get(e.id)!, e);
      const hit = [...foes].map((id) => byId.get(id)!);
      foes = null;
      if (!bad) {
        lay(e, paths.get(e.id)!);
        continue;
      }
      left++;
      const set = [e, ...(pass ? hit.slice(0, 4) : [])];
      // Coût de l'ensemble : posé un à un dans cet ordre, chaque trait compté contre ceux déjà là.
      const layAll = (list: RouteIn[], route: (x: RouteIn) => Pt[]) => {
        for (const x of list) lift(x);
        let sum = 0;
        for (const x of list) {
          const pts = route(x);
          sum += total(pts, x);
          lay(x, pts);
        }
        return sum;
      };
      let keep = new Map(set.map((x) => [x.id, paths.get(x.id)!]));
      let cost = layAll(set, (x) => keep.get(x.id)!);
      for (const list of set.length > 1 ? [set, [...set].reverse(), [e]] : [set]) {
        const got = layAll(list, best);
        // Celles qui ne sont pas du lot n'ont pas bougé : on compare l'ensemble entier.
        const all = list === set || list.length === set.length ? got : layAll(set, (x) => paths.get(x.id)!);
        if (all < cost) [cost, keep] = [all, new Map(set.map((x) => [x.id, paths.get(x.id)!]))];
        else layAll(set, (x) => keep.get(x.id)!);
      }
    }
    if (!left) break;
  }

  // Étiquettes : sur le trait, hors des nœuds et des autres étiquettes, en couvrant le moins de traits possible.
  const L = new Grid();
  const out = new Map<string, Route>();
  for (const e of order) {
    const pts = paths.get(e.id)!;
    const cands: Pt[] = [];
    for (let i = pts.length - 1; i > 0; i--) {
      const p = pts[i - 1]!;
      const q = pts[i]!;
      for (const t of [0.5, 0.25, 0.75, 0.1, 0.9]) cands.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
    let at = cands[0]!;
    let bc = Infinity;
    for (const c of cands) {
      const h = e.lh ?? LABEL_H;
      const r = [c.x - e.lw / 2, c.y - h / 2, c.x + e.lw / 2, c.y + h / 2] as const;
      let cost = 0;
      G.each(...r, () => (cost += 100));
      L.each(...r, () => (cost += 50));
      const over = (s: Item) => {
        if (s.from !== e.from) cost++;
      };
      V.each(...r, over);
      H.each(...r, over);
      if (cost < bc) [bc, at] = [cost, c];
      if (!cost) break;
    }
    const lh = e.lh ?? LABEL_H;
    L.add(item(at.x - e.lw / 2 - 2, at.y - lh / 2 - 1, at.x + e.lw / 2 + 2, at.y + lh / 2 + 1));
    out.set(e.id, { pts, d: pathOf(pts), lx: at.x, ly: at.y });
  }
  return out;
}

const turn = (p: Pt): Pt => ({ x: p.y, y: p.x });
const turnBox = (b: Box): Box => ({ x: b.y, y: b.x, w: b.h, h: b.w });
/** Liaisons de haut en bas (MB5, téléphone) : le même tracé, sur le plan couché (x et y échangés). `prev` et le résultat sont relevés. */
export function routeVertical(boxes: Box[], edges: RouteIn[], prev?: Map<string, Route>, budgetMs = 600): Map<string, Route> {
  const flip = (r: Route): Route => {
    const pts = r.pts.map(turn);
    return { pts, d: pathOf(pts), lx: r.ly, ly: r.lx };
  };
  const was = prev && new Map([...prev].map(([k, r]) => [k, flip(r)]));
  const lying = edges.map((e) => ({ ...e, a: turn(e.a), b: turn(e.b), ab: turnBox(e.ab), bb: turnBox(e.bb), lw: e.lh ?? LABEL_H, lh: e.lw }));
  return new Map([...routeEdges(boxes.map(turnBox), lying, was, budgetMs)].map(([k, r]) => [k, flip(r)]));
}
