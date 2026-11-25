// Plans de pose des ensembles modulaires (S14). Pur, sans DOM.
//   - Ferme d'arbres, assemblage par portées : chaque arroseur au centre d'un carré d'emplacements
//     d'arbre (ceux que son cercle touche) ; les coins vides de quatre carrés font la place d'un
//     récolteur ; le contrôleur au plus près du centre ; sorties et réservoirs là où les portées les
//     touchent, toutes les sorties reliées à un départ unique et tous les réservoirs à une arrivée unique ; une chaîne de poteaux du bord jusqu'à la prise
//     du contrôleur. Au-delà de ce que tient une ferme, plusieurs fermes écartées : le cercle d'un
//     contrôleur ne touche aucun bloc d'une autre ferme.
//   - Moteur diesel, assemblage par contact : contrôleur au bout, vilebrequins en ligne, générateur
//     au bout ; un bloc de côté par côté (contrôleur compris), des deux côtés ; le moins de
//     vilebrequins possible (la longueur ne change pas la puissance, réponse du 2026-10-18).
// Toutes les valeurs viennent de `FarmGeometry` (data/modular.json et tailles du wiki) : rien ici
// n'est une valeur du jeu.

import type { PortsEntry } from "../extension-types.ts";
import { place, STEP, type Dir, type Rot } from "./geometry.ts";
import { pipeFor, type Catalog } from "./catalog.ts";
import { msg, type Message } from "../message.ts";

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type PortSpec = { side: "haut" | "bas" | "gauche" | "droite"; cell: number };
export type FarmPole = { id: string; name: string; rangeCells: number; capacityMFps: number; w: number; h: number; price: number | null };

/** Ids des blocs de la ferme (machines.json). */
export const FARM_IDS = {
  tree: "tree",
  sprinkler: "tree-farm-sprinkler",
  tank: "tree-farm-water-tank",
  harvester: "farm-harvester",
  controller: "tree-farm-controller",
  output: "tree-farm-output",
} as const;
export type FarmKind = keyof typeof FARM_IDS;

export type FarmGeometry = {
  /** Côté d'un arbre, en cases : la grille des emplacements. */
  tree: number;
  sizes: Record<Exclude<FarmKind, "tree">, { w: number; h: number }>;
  /** Portées depuis le centre du bloc, en cases (portée relevée depuis le bord + demi-côté). */
  reach: { sprinkler: number; harvester: number; controller: number };
  /** Arbres suivis par un récolteur, arroseurs par réservoir. */
  perHarvester: number;
  perTank: number;
  /** Ports relevés (sans rotation) : sortie des Oak Logs, entrée d'eau ; prise du contrôleur (dessus, [colonne, ligne]). */
  ports: { output: PortSpec | null; tank: PortSpec | null; plug: [number, number] | null };
  /** Poteaux qui peuvent alimenter le contrôleur (le poteau HV demande un transformateur : absent). */
  poles: FarmPole[];
};

export type AsmBlock = {
  id: string;
  kind: string;
  machine: string;
  /** Ferme (1, 2…) ou moteur (1, 2…). */
  unit: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: Rot;
  /** Rayon de portée depuis le centre, en cases (ferme). */
  reach?: number;
  /** Port à raccorder : la case voisine et le sens du tuyau. */
  port?: { x: number; y: number; facing: Dir; fluid: boolean };
  /** Prise électrique (point continu). */
  plug?: { x: number; y: number };
  /** Ce que le bloc dessert (ids des blocs) : arbres d'un arroseur ou d'un récolteur, sortie d'un récolteur… */
  serves?: string[];
  /** Nombre à relever : le bloc est posé au minimum connu (moteur à 32 cylindres, MOD-14). */
  todo?: boolean;
  /** Chiffre affiché sur le bloc (arbres suivis par un récolteur). */
  tag?: string;
};

export type AsmPole = { x: number; y: number; w: number; h: number; pole: string; unit: number; used: boolean };

export type FarmSet = {
  farms: number;
  /** Arbres de chaque ferme. */
  trees: number[];
  /** Arbres que tient une ferme au plus, s'il a fallu le chercher (0 sinon : voir `farmCapacity`). */
  capacity: number;
  /** Portée des poteaux pour laquelle les places sont réservées (null : pas de poteau). */
  reserveReach: number | null;
  blocks: AsmBlock[];
  poles: AsmPole[];
  /** Câbles : de la prise du contrôleur vers le bord, poteau par poteau. */
  /** Tuyaux des bûches (toutes les sorties) et leur départ unique ; tuyaux d'eau (tous les réservoirs) et leur arrivée unique. */
  pipes: Cell[];
  exit: Cell | null;
  water: Cell[];
  entry: Cell | null;
  cables: { x1: number; y1: number; x2: number; y2: number }[];
  /** Nombre de chaque bloc (id machines.json) ; poteaux à part. */
  counts: Record<string, number>;
  poleCounts: Record<string, number>;
  pole: FarmPole | null;
  /** Poteaux qui conviennent (portent la ferme, portée au moins celle des places réservées). */
  poleOptions: FarmPole[];
  width: number;
  height: number;
  /** Écart laissé entre deux fermes (cases), pour les portées des contrôleurs. */
  gap: number | null;
  problems: Message[];
};

// ---------------------------------------------------------------- outils

const rdist = (cx: number, cy: number, r: Rect) => Math.hypot(Math.max(r.x0 - cx, 0, cx - r.x1), Math.max(r.y0 - cy, 0, cy - r.y1));
const mid = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const shift = (r: Rect, dx: number, dy: number): Rect => ({ x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy });
const bbox = (rs: Rect[]): Rect => ({ x0: Math.min(...rs.map((r) => r.x0)), y0: Math.min(...rs.map((r) => r.y0)), x1: Math.max(...rs.map((r) => r.x1)), y1: Math.max(...rs.map((r) => r.y1)) });
const rectOf = (b: { x: number; y: number; w: number; h: number }): Rect => ({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h });
const skey = (i: number, j: number) => `${i},${j}`;

/** Port relevé d'un bloc w × h posé en (x, y) avec `rot` quarts de tour : la case à toucher et le sens. */
function portOf(spec: PortSpec, w: number, h: number, x: number, y: number, rot: Rot, fluid: boolean) {
  const entry: Pick<PortsEntry, "footprint" | "ports"> = { footprint: { w, h }, ports: [{ type: fluid ? "fluide" : "objet", direction: "sortie", side: spec.side, cell: spec.cell }] };
  const p = place("b", "b", entry, x, y, rot).ports[0]!;
  return { x: p.cell.x, y: p.cell.y, facing: p.facing, fluid };
}

// ---------------------------------------------------------------- ferme : une ferme

export type Cell = { x: number; y: number };
const ck = (x: number, y: number) => `${x},${y}`;

/** Coût de chaque case d'un cadre : 0 interdit, sinon le prix d'y poser un tuyau. */
class CostGrid {
  readonly b: Rect;
  readonly W: number;
  readonly H: number;
  readonly c: Int16Array;
  constructor(b: Rect) {
    this.b = b;
    this.W = b.x1 - b.x0 + 1;
    this.H = b.y1 - b.y0 + 1;
    this.c = new Int16Array(this.W * this.H).fill(1);
  }
  fill(r: Rect, v: number): void {
    const { b, W } = this;
    for (let y = Math.max(b.y0, Math.floor(r.y0)); y < Math.min(b.y1 + 1, r.y1); y++) for (let x = Math.max(b.x0, Math.floor(r.x0)); x < Math.min(b.x1 + 1, r.x1); x++) this.c[(y - b.y0) * W + x - b.x0] = v;
  }
  idx(p: Cell): number {
    const { b, W } = this;
    return p.x < b.x0 || p.y < b.y0 || p.x > b.x1 || p.y > b.y1 ? -1 : (p.y - b.y0) * W + p.x - b.x0;
  }
  at(p: Cell): number {
    const i = this.idx(p);
    return i < 0 ? 0 : this.c[i]!;
  }
}

/** Plus courts chemins, case par case, depuis `src` (file par distance : les coûts sont de petits entiers). */
function flood(src: Cell[], g: CostGrid) {
  const { W, H, b } = g;
  const D = new Int32Array(W * H).fill(FAR);
  const P = new Int32Array(W * H).fill(-1);
  const q: (number[] | undefined)[] = [];
  const add = (i: number, d: number) => void (q[d] ??= []).push(i);
  for (const c of src) {
    const i = g.idx(c);
    if (i < 0 || D[i] === 0) continue;
    D[i] = 0;
    add(i, 0);
  }
  for (let d = 0; d < q.length; d++) {
    const l = q[d];
    if (!l) continue;
    for (const i of l) {
      if (D[i] !== d) continue;
      const x = i % W;
      const y = (i - x) / W;
      for (let k = 0; k < 4; k++) {
        const j = k === 0 ? (x + 1 < W ? i + 1 : -1) : k === 1 ? (x ? i - 1 : -1) : k === 2 ? (y + 1 < H ? i + W : -1) : y ? i - W : -1;
        if (j < 0) continue;
        const c = g.c[j]!;
        if (!c || d + c >= D[j]!) continue;
        D[j] = d + c;
        P[j] = i;
        add(j, d + c);
      }
    }
    q[d] = undefined;
  }
  return {
    d: (c: Cell): number => {
      const i = g.idx(c);
      return i < 0 ? FAR : D[i]!;
    },
    /** De `c` jusqu'à la source la plus proche. */
    path: (c: Cell): Cell[] => {
      const o: Cell[] = [];
      for (let i = g.idx(c); i >= 0; i = P[i]!) o.push({ x: (i % W) + b.x0, y: Math.floor(i / W) + b.y0 });
      return o;
    },
  };
}
const FAR = 1e9;

type Slot = { i: number; j: number; r: Rect };
type Tree = Slot & { h: Harv | null };
type Harv = { i: number; j: number; r: Rect; cx: number; cy: number; cov: Tree[]; trees: Tree[]; out: Out | null };
type Out = { r: Rect; rot: Rot; port: { x: number; y: number; facing: Dir; fluid: boolean }; cov: Harv[] };
type Tank = { r: Rect; rot: Rot; port: { x: number; y: number; facing: Dir; fluid: boolean } | null };

/** Une ferme posée, dans ses propres coordonnées (cases ; l'arroseur du premier carré centré en 0). */
type Farm = {
  N: number;
  trees: Tree[];
  spr: Slot[];
  ctrl: Slot;
  plug: { x: number; y: number };
  harv: Harv[];
  outs: Out[];
  tanks: Tank[];
  pipes: Cell[];
  exit: Cell | null;
  water: Cell[];
  entry: Cell | null;
  /** Places réservées aux poteaux, de la prise vers le bord (la dernière est hors de la ferme). */
  poleSpots: { x: number; y: number }[];
  ok: boolean;
  lost: number;
};

const LAT: [number, number][] = [];
for (let a = -5; a <= 5; a++) for (let c = -5; c <= 5; c++) LAT.push([a, c]);
/** Façons de tracer les bûches : le moins de sorties d'abord ou non, et ce que coûte un tuyau à la place d'arbres. */
type Try = { few: boolean; carve: number };
const TRIES: Try[] = [{ few: true, carve: 14 }, { few: true, carve: 300 }, { few: false, carve: 60 }, { few: false, carve: 300 }];
const MAX_CELLS = 30;

/** Décalages des emplacements d'arbre que touche le cercle d'un arroseur (44 en grille avec les portées relevées). */
export function sprinklerOffsets(g: FarmGeometry): [number, number][] {
  const T = g.tree;
  const out: [number, number][] = [];
  const n = Math.ceil(g.reach.sprinkler / T) + 1;
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      if (!i && !j) continue;
      const r = { x0: T * i - T / 2, y0: T * j - T / 2, x1: T * i + T / 2, y1: T * j + T / 2 };
      if (rdist(0, 0, r) <= g.reach.sprinkler) out.push([i, j]);
    }
  return out;
}

function farmOnce(g: FarmGeometry, N: number, cells: number, reach: number | null, TRY: Try, full = false, extra = 0): Farm & { short: boolean } {
  const T = g.tree;
  const OFFS = sprinklerOffsets(g);
  const pitch = 2 * Math.max(...OFFS.map(([i]) => Math.abs(i))) + 1;
  const slot = (i: number, j: number, w = 1, h = 1): Rect => ({ x0: T * i - T / 2, y0: T * j - T / 2, x1: T * (i + w) - T / 2, y1: T * (j + h) - T / 2 });
  // Carrés d'arroseur au plus près du centre (la portée du contrôleur est un cercle) ; centre entre deux carrés s'il y en a plusieurs.
  const off = cells > 1 ? 0.5 : 0;
  const pick = [...LAT].sort((p, q) => Math.hypot(p[0] - off, p[1]) - Math.hypot(q[0] - off, q[1]) || p[1] - q[1] || p[0] - q[0]).slice(0, cells);
  const xs = pick.map((p) => p[0] * pitch * T);
  const ys = pick.map((p) => p[1] * pitch * T);
  const fc = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] as const;
  const cellSlots = new Set<string>();
  for (const [a, c] of pick) {
    cellSlots.add(skey(a * pitch, c * pitch));
    for (const [i, j] of OFFS) cellSlots.add(skey(a * pitch + i, c * pitch + j));
  }
  const half = (pitch - 1) / 2;
  const I0 = Math.min(...pick.map((p) => p[0])) * pitch - half;
  const J0 = Math.min(...pick.map((p) => p[1])) * pitch - half;
  const I1 = Math.max(...pick.map((p) => p[0])) * pitch + half;
  const J1 = Math.max(...pick.map((p) => p[1])) * pitch + half;
  // Contrôleur : un coin vide (hors des emplacements d'un arroseur) au plus près du centre.
  let best: { i: number; j: number; d: number } | null = null;
  for (let i = I0 - 1; i <= I1 + 1; i++)
    for (let j = J0 - 1; j <= J1 + 1; j++) {
      if (cellSlots.has(skey(i, j))) continue;
      const [x, y] = mid(slot(i, j));
      const d = Math.hypot(x - fc[0], y - fc[1]);
      if (!best || d < best.d) best = { i, j, d };
    }
  const ctrl: Slot = { i: best!.i, j: best!.j, r: slot(best!.i, best!.j) };
  const [ccx, ccy] = mid(ctrl.r);
  const inC = (r: Rect) => rdist(ccx, ccy, r) <= g.reach.controller;
  const dC = (r: Rect) => rdist(ccx, ccy, r);
  const occ = new Map<string, string>([[skey(ctrl.i, ctrl.j), "c"]]);
  const plugPos = g.ports.plug ? { x: ctrl.r.x0 + g.ports.plug[0] - 0.5, y: ctrl.r.y0 + g.ports.plug[1] - 0.5 } : { x: ccx, y: ccy };

  // Poteaux : une place tous les `reach` au plus, en ligne droite de la prise vers le bord le plus proche.
  const poleSpots: { x: number; y: number }[] = [];
  if (reach !== null && reach >= T) {
    let chosen: { spots: [number, number][]; inner: number } | null = null;
    for (const d of ["N", "E", "S", "W"] as Dir[]) {
      const spots: [number, number][] = [];
      let prev = plugPos;
      let k = 0;
      let inner = 0;
      for (let guard = 0; guard < 200; guard++) {
        // Le plus loin possible le long de la ligne, à portée du précédent.
        let next = k;
        while (true) {
          const [x, y] = mid(slot(ctrl.i + STEP[d].x * (next + 1), ctrl.j + STEP[d].y * (next + 1)));
          if (Math.hypot(x - prev.x, y - prev.y) > reach) break;
          next++;
        }
        if (next === k) break;
        k = next;
        const si = ctrl.i + STEP[d].x * k;
        const sj = ctrl.j + STEP[d].y * k;
        spots.push([si, sj]);
        const [x, y] = mid(slot(si, sj));
        prev = { x, y };
        // Hors du bois : le réseau peut y arriver ; une place dans le bois coûte un arbre.
        if (si < I0 || si > I1 || sj < J0 || sj > J1) break;
        if (cellSlots.has(skey(si, sj))) inner++;
      }
      if (!spots.length) continue;
      if (!chosen || inner < chosen.inner || (inner === chosen.inner && spots.length < chosen.spots.length)) chosen = { spots, inner };
    }
    for (const [i, j] of chosen?.spots ?? []) {
      occ.set(skey(i, j), "p");
      const [x, y] = mid(slot(i, j));
      poleSpots.push({ x, y });
    }
  }

  // Arbres : carrés d'arroseur à portée du contrôleur, les emplacements les plus proches d'abord.
  const spr: Slot[] = [];
  const trees: Tree[] = [];
  // `extra` : arbres de plus, pour remplacer ceux qu'enlèvent les passages des sorties (tentative précédente).
  let left = N + extra;
  const cellsByD = pick
    .map(([a, c]) => ({ i: a * pitch, j: c * pitch, r: slot(a * pitch, c * pitch) }))
    .filter((s) => inC(s.r) && !occ.has(skey(s.i, s.j)))
    .sort((p, q) => dC(p.r) - dC(q.r));
  for (const s of cellsByD) {
    if (left <= 0) break;
    const offs = OFFS.map(([a, b]) => [s.i + a, s.j + b] as [number, number])
      .filter(([i, j]) => !occ.has(skey(i, j)) && inC(slot(i, j)))
      .sort((p, q) => dC(slot(...p)) - dC(slot(...q)));
    const take = offs.slice(0, left);
    if (!take.length) continue;
    spr.push(s);
    occ.set(skey(s.i, s.j), "s");
    for (const [i, j] of take) {
      trees.push({ i, j, r: slot(i, j), h: null });
      occ.set(skey(i, j), "t");
    }
    left -= take.length;
  }
  const base = { N, trees, spr, ctrl, plug: plugPos, poleSpots };
  if (trees.length < N + extra && !full) return { ...base, harv: [], outs: [], tanks: [], pipes: [], exit: null, water: [], entry: null, ok: false, lost: N - trees.length, short: true };

  // Récolteurs : places libres de la taille d'un récolteur ; glouton, les arbres les plus difficiles d'abord.
  const hw = Math.max(1, Math.round(g.sizes.harvester.w / T));
  const hh = Math.max(1, Math.round(g.sizes.harvester.h / T));
  const freeH = (i: number, j: number) => {
    for (let a = 0; a < hw; a++) for (let b = 0; b < hh; b++) if (occ.has(skey(i + a, j + b))) return false;
    return true;
  };
  const cand: Harv[] = [];
  for (let i = I0 - hw; i <= I1 + 1; i++)
    for (let j = J0 - hh; j <= J1 + 1; j++) {
      const r = slot(i, j, hw, hh);
      if (!freeH(i, j) || !inC(r)) continue;
      const [cx, cy] = mid(r);
      const cov = trees.filter((t) => rdist(cx, cy, t.r) <= g.reach.harvester);
      if (cov.length) cand.push({ i, j, r, cx, cy, cov, trees: [], out: null });
    }
  const nAlt = new Map(trees.map((t) => [t, 0]));
  for (const c of cand) for (const t of c.cov) nAlt.set(t, nAlt.get(t)! + 1);
  const harv: Harv[] = [];
  while (trees.some((t) => !t.h)) {
    let pickH: Harv | null = null;
    let bs = 0;
    for (const c of cand) {
      if (!freeH(c.i, c.j)) continue;
      let open = 0;
      let rare = 0;
      for (const t of c.cov)
        if (!t.h) {
          open++;
          rare += 1 / nAlt.get(t)!;
        }
      if (!open) continue;
      const s = Math.min(g.perHarvester, open) + rare / 1000;
      if (s > bs) {
        bs = s;
        pickH = c;
      }
    }
    if (!pickH) break;
    const take = pickH.cov.filter((t) => !t.h).sort((a, b) => nAlt.get(a)! - nAlt.get(b)!).slice(0, g.perHarvester);
    pickH.trees = take;
    for (const t of take) t.h = pickH;
    harv.push(pickH);
    for (let a = 0; a < hw; a++) for (let b = 0; b < hh; b++) occ.set(skey(pickH.i + a, pickH.j + b), "h");
  }

  // Cases occupées (pour les passages de tuyau) : tout ce qui est posé, places des poteaux comprises.
  const tanks: Tank[] = [];
  const slotAt = (v: number) => Math.floor((v + T / 2) / T);
  const rectBlocked = (r: Rect) => {
    for (let i = slotAt(r.x0); i <= slotAt(r.x1 - 1e-9); i++) for (let j = slotAt(r.y0); j <= slotAt(r.y1 - 1e-9); j++) if (occ.has(skey(i, j))) return true;
    return tanks.some((t) => overlap(t.r, r));
  };
  const placedBox = (): Rect => {
    const ks = [...occ.keys()].map((k) => k.split(",").map(Number) as [number, number]);
    return bbox([...ks.map(([i, j]) => slot(i, j)), ...tanks.map((t) => t.r)]);
  };
  // Le départ des bûches va tout droit jusqu'au bord droit : rien ne se pose dessus.
  const rays: { x: number; y: number; dir: Dir }[] = [];
  const crossesRay = (r: Rect) =>
    rays.some((q) => {
      // La demi-droite part de (q.x, q.y) : le rectangle la coupe-t-il ?
      if (q.dir === "N" || q.dir === "S") return q.x >= r.x0 && q.x < r.x1 && (q.dir === "S" ? r.y1 > q.y : r.y0 <= q.y);
      return q.y >= r.y0 && q.y < r.y1 && (q.dir === "E" ? r.x1 > q.x : r.x0 <= q.x);
    });

  // Sorties : une place libre à portée de récolteurs, avec un passage pour le tuyau des Oak Logs.
  const ow = g.sizes.output.w;
  const oh = g.sizes.output.h;
  // Port de chaque rotation, relatif au coin du bloc (calculé une fois).
  const rel = (spec: PortSpec | null, w: number, h: number, fluid: boolean) => ([0, 1, 2, 3] as Rot[]).map((rot) => (spec ? portOf(spec, w, h, 0, 0, rot, fluid) : null));
  const outPorts = rel(g.ports.output, ow, oh, false);
  const at = (p: { x: number; y: number; facing: Dir; fluid: boolean } | null, x: number, y: number) => (p ? { ...p, x: p.x + x, y: p.y + y } : null);
  const outs: Out[] = [];
  let pipes: Cell[] = [];
  let exit: Cell | null = null;
  if (harv.length) {
    // Une place libre, ou celle d'un arbre (retiré, puis replacé ailleurs) quand un récolteur est cerné.
    const ocands: { i: number; j: number; r: Rect; cov: Harv[] }[] = [];
    for (let i = I0 - 3; i <= I1 + 3; i++)
      for (let j = J0 - 3; j <= J1 + 3; j++) {
        const kind = occ.get(skey(i, j));
        if (kind && kind !== "t") continue;
        const r = slot(i, j);
        if (!inC(r)) continue;
        const cov = harv.filter((h) => rdist(h.cx, h.cy, r) <= g.reach.harvester);
        if (cov.length) ocands.push({ i, j, r, cov });
      }
    const wb = placedBox();
    const bd: Rect = { x0: wb.x0 - 2, y0: wb.y0 - 2, x1: wb.x1 + 2, y1: wb.y1 + 2 };
    const edge: Cell[] = [];
    for (let y = wb.y0; y < wb.y1; y++) edge.push({ x: wb.x1, y });
    const grid = () => {
      const c = new CostGrid(bd);
      for (const [k, kind] of occ) {
        if (kind === "r") continue;
        const [a, b] = k.split(",").map(Number) as [number, number];
        c.fill(slot(a, b), kind === "t" ? TRY.carve : 0);
      }
      return c;
    };
    const remove = (k: string) => {
      const n = trees.findIndex((t) => skey(t.i, t.j) === k);
      if (n < 0) return 0;
      const t = trees[n]!;
      if (t.h) t.h.trees = t.h.trees.filter((q) => q !== t);
      trees.splice(n, 1);
      return 1;
    };
    while (harv.some((h) => !h.out)) {
      const fl = flood(pipes.length ? pipes : edge, grid());
      const list: { c: (typeof ocands)[number]; rot: Rot; port: Out["port"]; gain: number; d: number }[] = [];
      for (const c of ocands) {
        const here = occ.get(skey(c.i, c.j));
        if (here && here !== "t") continue;
        const gain = c.cov.filter((h) => !h.out).length;
        if (!gain) continue;
        for (const rot of [0, 1, 2, 3] as Rot[]) {
          const port = at(outPorts[rot]!, c.r.x0, c.r.y0) ?? { x: c.r.x0, y: c.r.y1, facing: "S" as Dir, fluid: false };
          const d = fl.d(port) + (here === "t" ? 4 * TRY.carve : 0);
          if (d < 1e8) list.push({ c, rot, port, gain, d });
        }
      }
      list.sort((a, b) => TRY.few ? b.gain - a.gain || a.d - b.d : a.d / a.gain - b.d / b.gain);
      let done = false;
      for (const o of list) {
        const k0 = skey(o.c.i, o.c.j);
        const was = occ.get(k0);
        occ.set(k0, "o");
        const f2 = flood(pipes.length ? pipes : edge, grid());
        if (f2.d(o.port) >= 1e8) {
          if (was) occ.set(k0, was);
          else occ.delete(k0);
          continue;
        }
        remove(k0);
        const p = f2.path(o.port);
        if (!exit) exit = p[p.length - 1]!;
        for (const c of p) {
          const k = skey(slotAt(c.x), slotAt(c.y));
          remove(k);
          occ.set(k, "r");
          if (!pipes.some((q) => q.x === c.x && q.y === c.y)) pipes.push(c);
        }
        const out: Out = { r: o.c.r, rot: o.rot, port: o.port, cov: o.c.cov };
        outs.push(out);
        for (const h of out.cov) h.out ??= out;
        done = true;
        break;
      }
      if (!done) break;
    }
  }
  if (exit) rays.push({ x: (exit as Cell).x, y: (exit as Cell).y, dir: "E" });

  if (!full && trees.length > N) {
    const far = [...trees].sort((a, b) => dC(b.r) - dC(a.r)).slice(0, trees.length - N);
    for (const t of far) {
      if (t.h) t.h.trees = t.h.trees.filter((q) => q !== t);
      trees.splice(trees.indexOf(t), 1);
      occ.delete(skey(t.i, t.j));
    }
    for (const h of [...harv]) {
      if (h.trees.length) continue;
      harv.splice(harv.indexOf(h), 1);
      for (let a = 0; a < hw; a++) for (let b = 0; b < hh; b++) occ.delete(skey(h.i + a, h.j + b));
    }
    for (const o of [...outs]) {
      if (harv.some((h) => h.out === o)) continue;
      outs.splice(outs.indexOf(o), 1);
      occ.delete(skey(slotAt(o.r.x0), slotAt(o.r.y0)));
    }
    for (const sp of [...spr]) {
      const [sx, sy] = mid(sp.r);
      if (trees.some((t) => rdist(sx, sy, t.r) <= g.reach.sprinkler)) continue;
      spr.splice(spr.indexOf(sp), 1);
      occ.delete(skey(sp.i, sp.j));
    }
  }
  for (let cut = true; cut; ) {
    const set = new Set(pipes.map((p) => ck(p.x, p.y)));
    const keep = pipes.filter((p) => (exit && p.x === exit.x && p.y === exit.y) || outs.some((o) => o.port.x === p.x && o.port.y === p.y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => set.has(ck(p.x + a!, p.y + b!))).length > 1);
    cut = keep.length < pipes.length;
    pipes = keep;
  }
  // Réservoirs : une place libre que touche le contrôleur, hors du bois de préférence, avec un passage pour l'eau.
  const nt = Math.ceil(spr.length / g.perTank);
  const wood = bbox(trees.length ? trees.map((t) => t.r) : [ctrl.r]);
  const tw = g.sizes.tank.w;
  const th = g.sizes.tank.h;
  const tankPorts = rel(g.ports.tank, tw, th, true);
  // Positions possibles, de la plus proche du contrôleur à la plus loin (hors du bois d'abord) : triées une fois.
  const ring = (inside: boolean) => {
    const out: { r: Rect; rot: Rot; s: number }[] = [];
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const [w, h] = rot % 2 ? [th, tw] : [tw, th];
      for (let x = wood.x0 - 16; x <= wood.x1 + 6; x++)
        for (let y = wood.y0 - 16; y <= wood.y1 + 6; y++) {
          // Hors du bois d'abord : on saute l'intérieur de la boîte du bois.
          if (!inside && x > wood.x0 - w && x < wood.x1 && y > wood.y0 - h && y < wood.y1) {
            y = wood.y1 - 1;
            continue;
          }
          const r = { x0: x, y0: y, x1: x + w, y1: y + h };
          if (inC(r)) out.push({ r, rot, s: dC(r) });
        }
    }
    return out.sort((a, b) => a.s - b.s);
  };
  let tcands = nt ? ring(false) : [];
  let inner = false;
  const water: Cell[] = [];
  let entry: Cell | null = null;
  for (let k = 0; k < nt; k++) {
    const box = placedBox();
    let bestT: Tank | null = null;
    const bd: Rect = { x0: Math.floor(box.x0) - 14, y0: Math.floor(box.y0) - 14, x1: Math.ceil(box.x1) + 14, y1: Math.ceil(box.y1) + 14 };
    const wgrid = (more?: Rect) => {
      const c = new CostGrid(bd);
      for (const [k, kind] of occ) if (kind !== "r") c.fill(slot(...(k.split(",").map(Number) as [number, number])), 0);
      for (const t of tanks) c.fill(t.r, 0);
      for (const p of pipes) c.fill({ x0: p.x, y0: p.y, x1: p.x + 1, y1: p.y + 1 }, 0);
      if (exit) c.fill({ x0: exit.x, y0: exit.y, x1: bd.x1 + 1, y1: exit.y + 1 }, 0);
      if (more) c.fill(more, 0);
      return c;
    };
    const wg = wgrid();
    const edge: Cell[] = [];
    for (let y = Math.floor(box.y0) - 1; y <= box.y1; y++) if (wg.at({ x: Math.floor(box.x0) - 1, y })) edge.push({ x: Math.floor(box.x0) - 1, y });
    const src = water.length ? water : edge;
    const fl = flood(src, wg);
    // Les places les plus proches du contrôleur d'abord ; parmi elles, la plus proche de l'eau.
    const list: { c: (typeof tcands)[number]; port: NonNullable<Tank["port"]>; d: number }[] = [];
    for (const c of tcands) {
      if (list.length >= 400) break;
      const port = at(tankPorts[c.rot]!, c.r.x0, c.r.y0) ?? { x: c.r.x0, y: c.r.y1, facing: "S" as Dir, fluid: true };
      const d = fl.d(port) + c.s * 2;
      if (d >= FAR || !wg.at(port) || rectBlocked(c.r) || crossesRay(c.r)) continue;
      list.push({ c, port, d });
    }
    list.sort((a, b) => a.d - b.d);
    for (const q of list.slice(0, 40)) {
      const r = q.c.r;
      // Le réservoir ne se pose ni sur un tuyau d'eau, ni sur l'arrivée (vers la gauche) déjà prévue.
      if (water.some((w) => w.x >= r.x0 && w.x < r.x1 && w.y >= r.y0 && w.y < r.y1) || (entry && entry.y >= r.y0 && entry.y < r.y1 && r.x0 <= entry.x)) continue;
      const f2 = flood(src.filter((w) => !(w.x >= r.x0 && w.x < r.x1 && w.y >= r.y0 && w.y < r.y1)), wgrid(r));
      if (f2.d(q.port) >= 1e8) continue;
      const way = f2.path(q.port);
      if (!entry) entry = way[way.length - 1]!;
      for (const c of way) if (!water.some((w) => w.x === c.x && w.y === c.y)) water.push(c);
      bestT = { r, rot: q.c.rot, port: q.port };
      break;
    }
    if (!bestT && !inner) {
      // Plus de place autour du bois : dans le bois, s'il y a un trou.
      tcands = ring(true);
      inner = true;
      k--;
      continue;
    }
    if (!bestT) break;
    tanks.push({ r: bestT.r, rot: bestT.rot, port: bestT.port });
  }
  const lost = trees.filter((t) => !t.h).length;
  const ok = (full || trees.length >= N) && trees.length > 0 && !lost && harv.every((h) => h.out) && tanks.length === nt;
  return { ...base, harv, outs, tanks, pipes, exit, water, entry, ok, lost, short: false };
}

/** a avant b, critère par critère. */
function lexLess(a: number[], b: number[]): boolean {
  for (let n = 0; n < a.length; n++) if (a[n] !== b[n]) return a[n]! < b[n]!;
  return false;
}

/** Ferme de N arbres : on ajoute des carrés d'arroseur tant que les arbres à portée du contrôleur manquent. */
function oneFarm(g: FarmGeometry, N: number, reach: number | null): Farm {
  let best: Farm | null = null;
  let key: number[] = [];
  for (const t of TRIES) {
    const f = tryMemo(g, N, reach, t);
    const b = bbox([...f.trees.map((q) => q.r), ...f.spr.map((q) => q.r), ...f.harv.map((q) => q.r), ...f.outs.map((q) => q.r), ...f.tanks.map((q) => q.r), f.ctrl.r, ...[...f.pipes, ...f.water].map((q) => ({ x0: q.x, y0: q.y, x1: q.x + 1, y1: q.y + 1 }))]);
    const k = [f.ok ? 0 : 1, (b.x1 - b.x0) * (b.y1 - b.y0), f.harv.length + f.spr.length + f.outs.length, f.pipes.length];
    if (!best || lexLess(k, key)) [best, key] = [f, k];
  }
  return best!;
}
function oneTry(g: FarmGeometry, N: number, reach: number | null, t: Try): Farm {
  const per = sprinklerOffsets(g).length;
  let extra = 0;
  let f!: Farm & { short: boolean };
  for (let cells = Math.max(1, Math.ceil(N / per)), guard = 0; guard < 60; guard++) {
    f = farmOnce(g, N, cells, reach, t, false, extra);
    if (f.short) {
      if (cells >= MAX_CELLS) return f;
      cells++;
      continue;
    }
    if (f.trees.length >= N) return f;
    extra += N - f.trees.length;
  }
  return f;
}

// ---------------------------------------------------------------- ferme : plusieurs fermes

const cache = new Map<string, unknown>();
const memo = <T>(k: string, f: () => T): T => {
  if (!cache.has(k)) {
    if (cache.size > 2000) cache.clear();
    cache.set(k, f());
  }
  return cache.get(k) as T;
};
const geomKey = (g: FarmGeometry) => JSON.stringify(g);

/** Poteau par défaut : le moins cher qui porte la ferme (son premier poteau porte toute la consommation). */
function defaultPole(g: FarmGeometry, loadMFps: number): FarmPole | null {
  const ok = g.poles.filter((p) => p.capacityMFps >= loadMFps - 1e-9);
  return ok.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || b.rangeCells - a.rangeCells)[0] ?? null;
}

/** Arbres que tient une ferme au plus : le plus grand nombre qui se place sans rien perdre. */
export function farmCapacity(g: FarmGeometry, reach: number | null): number {
  return memo(`cap|${geomKey(g)}|${reach}`, () => {
    // Borne haute : une ferme pleine (tous les carrés à portée). Puis le plus grand nombre vérifié par dichotomie.
    const full = farmOnce(g, 1e6, MAX_CELLS, reach, TRIES[0]!, true);
    if (full.ok) return full.trees.length;
    let hi = full.trees.filter((t) => t.h).length;
    let lo = 0;
    if (hi > 0 && fits(g, hi, reach)) lo = hi;
    while (hi - lo > 1) {
      const m = Math.floor((lo + hi) / 2);
      if (fits(g, m, reach)) lo = m;
      else hi = m;
    }
    // Le placement n'est pas tout à fait monotone : on monte tant que la ferme suivante se place encore.
    for (let k = 0; k < 20 && fits(g, lo + 1, reach); k++) lo++;
    return Math.max(1, lo);
  });
}

const tryMemo = (g: FarmGeometry, n: number, reach: number | null, t: Try) => memo(`try|${geomKey(g)}|${n}|${reach}|${t.few}|${t.carve}`, () => oneTry(g, n, reach, t));
/** Une ferme de n arbres se place-t-elle, de l’une des deux premières façons ? (premier essai qui marche) */
const fits = (g: FarmGeometry, n: number, reach: number | null) => TRIES.slice(0, 2).some((t) => tryMemo(g, n, reach, t).ok);
const farmMemo = (g: FarmGeometry, n: number, reach: number | null) => memo(`farm|${geomKey(g)}|${n}|${reach}`, () => oneFarm(g, n, reach));

/**
 * Fermes pour `trees` arbres. `loadMFps` : électricité de toutes les fermes (pour le poteau) ;
 * `pole` : poteau choisi (sinon le moins cher qui porte une ferme). Les places des poteaux sont
 * toujours réservées pour le poteau par défaut : un poteau de plus grande portée en laisse libres.
 */
export function designFarm(g: FarmGeometry, trees: number, loadMFps: number, pole?: string): FarmSet {
  const T = g.tree;
  const N = Math.max(0, Math.ceil(trees - 1e-9));
  const problems: Message[] = [];
  const empty: FarmSet = { farms: 0, trees: [], capacity: 0, reserveReach: null, blocks: [], poles: [], pipes: [], exit: null, water: [], entry: null, cables: [], counts: {}, poleCounts: {}, pole: null, poleOptions: [], width: 0, height: 0, gap: null, problems };
  if (!N) return empty;
  // Poteau : d'abord pour une seule ferme, puis pour la part de chacune.
  let farms = 1;
  let def: FarmPole | null = null;
  let reach: number | null = null;
  let cap = 0;
  def = defaultPole(g, loadMFps);
  reach = def ? def.rangeCells : null;
  if (!fits(g, N, reach)) {
    for (let guard = 0; guard < 4; guard++) {
      cap = farmCapacity(g, reach);
      const n = Math.max(1, Math.ceil(N / Math.max(1, cap)));
      if (n === farms && guard) break;
      farms = n;
      def = defaultPole(g, loadMFps / farms);
      reach = def ? def.rangeCells : null;
    }
  }
  if (g.poles.length && !def) problems.push(msg("asm.farmNoPole"));
  // Parts égales ; une ferme de plus si l'une d'elles ne se place pas.
  let sizes: number[] = [];
  let layouts: Farm[] = [];
  for (let guard = 0; guard < 50; guard++) {
    const base = Math.floor(N / farms);
    const extra = N % farms;
    sizes = Array.from({ length: farms }, (_, k) => base + (k < extra ? 1 : 0));
    layouts = sizes.map((n) => farmMemo(g, n, reach));
    if (layouts.every((f) => f.ok)) break;
    farms++;
  }
  for (const f of layouts) if (!f.ok) problems.push(msg("asm.farmLost", { trees: f.N, n: f.lost }));
  // Écart entre deux fermes : le cercle d'un contrôleur ne touche aucun bloc de l'autre.
  const rectsOf = (f: Farm): Rect[] => [...f.trees.map((t) => t.r), ...f.spr.map((s) => s.r), ...f.harv.map((h) => h.r), ...f.outs.map((o) => o.r), ...f.tanks.map((t) => t.r), f.ctrl.r, ...[...f.pipes, ...f.water].map((q) => ({ x0: q.x, y0: q.y, x1: q.x + 1, y1: q.y + 1 }))];
  const big = layouts[0]!;
  const rs = rectsOf(big);
  const fb = bbox([...rs, ...big.poleSpots.map((p) => ({ x0: p.x - T / 2, y0: p.y - T / 2, x1: p.x + T / 2, y1: p.y + T / 2 }))]);
  const [ccx, ccy] = mid(big.ctrl.r);
  const clash = (dx: number, dy: number) => rs.some((r) => rdist(ccx, ccy, shift(r, dx, dy)) <= g.reach.controller || rdist(ccx + dx, ccy + dy, r) <= g.reach.controller || overlap(fb, shift(fb, dx, dy)));
  const cols = Math.ceil(Math.sqrt(farms));
  // Les tuyaux de chaque ferme et deux couloirs (bûches, eau) tiennent entre deux fermes.
  const pb = layouts.map((f) => bbox([...rectsOf(f), fb, ...[...f.pipes, ...f.water].map((c) => ({ x0: c.x, y0: c.y, x1: c.x + 1, y1: c.y + 1 }))]));
  const ab = bbox(pb);
  let dx = ab.x1 - ab.x0 + 4;
  let dy = ab.y1 - ab.y0 + 4;
  if (farms > 1) {
    while (clash(dx, 0)) dx++;
    if (farms > cols) {
      while (clash(0, dy)) dy++;
      while (clash(dx, dy) || clash(dx, -dy)) {
        dx++;
        dy++;
      }
    }
  }
  // Assemblage, puis coordonnées positives.
  const blocks: AsmBlock[] = [];
  const poles: AsmPole[] = [];
  const cables: FarmSet["cables"] = [];
  const pick = (pole ? g.poles.find((p) => p.id === pole && def && p.capacityMFps >= def.capacityMFps - 1e-9 && p.rangeCells >= def.rangeCells) : null) ?? def;
  layouts.forEach((f, k) => {
    const ox = (k % cols) * dx;
    const oy = Math.floor(k / cols) * dy;
    const u = k + 1;
    const id = (s: string) => `f${u}:${s}`;
    const R = (r: Rect) => ({ x: r.x0 + ox, y: r.y0 + oy, w: r.x1 - r.x0, h: r.y1 - r.y0 });
    const treeId = new Map(f.trees.map((t, n) => [t, id(`t${n}`)]));
    const harvId = new Map(f.harv.map((h, n) => [h, id(`h${n}`)]));
    const outId = new Map(f.outs.map((o, n) => [o, id(`o${n}`)]));
    f.trees.forEach((t) => blocks.push({ id: treeId.get(t)!, kind: "tree", machine: FARM_IDS.tree, unit: u, ...R(t.r), rot: 0 }));
    f.spr.forEach((s, n) => {
      const [cx, cy] = mid(s.r);
      const served = f.trees.filter((t) => rdist(cx, cy, t.r) <= g.reach.sprinkler).map((t) => treeId.get(t)!);
      blocks.push({ id: id(`s${n}`), kind: "sprinkler", machine: FARM_IDS.sprinkler, unit: u, ...R(s.r), rot: 0, reach: g.reach.sprinkler, serves: served });
    });
    f.harv.forEach((h) => blocks.push({ id: harvId.get(h)!, kind: "harvester", machine: FARM_IDS.harvester, unit: u, ...R(h.r), rot: 0, reach: g.reach.harvester, serves: [...h.trees.map((t) => treeId.get(t)!), ...(h.out ? [outId.get(h.out)!] : [])], tag: String(h.trees.length) }));
    f.outs.forEach((o) => {
      blocks.push({ id: outId.get(o)!, kind: "output", machine: FARM_IDS.output, unit: u, ...R(o.r), rot: o.rot, port: { ...o.port, x: o.port.x + ox, y: o.port.y + oy } });
    });
    f.tanks.forEach((t, n) => {
      const served = f.spr.slice(n * g.perTank, (n + 1) * g.perTank).map((_, m) => id(`s${n * g.perTank + m}`));
      blocks.push({ id: id(`w${n}`), kind: "tank", machine: FARM_IDS.tank, unit: u, ...R(t.r), rot: t.rot, serves: served, ...(t.port ? { port: { ...t.port, x: t.port.x + ox, y: t.port.y + oy } } : {}) });
    });
    blocks.push({ id: id("c"), kind: "controller", machine: FARM_IDS.controller, unit: u, ...R(f.ctrl.r), rot: 0, reach: g.reach.controller, plug: { x: f.plug.x + ox, y: f.plug.y + oy }, serves: [] });
    // Poteaux : chaîne depuis la prise ; avec un poteau de plus grande portée, on saute des places.
    if (pick && f.poleSpots.length) {
      let prev = f.plug;
      const used = new Set<number>();
      let n = 0;
      while (n < f.poleSpots.length) {
        let far = n;
        while (far + 1 < f.poleSpots.length && Math.hypot(f.poleSpots[far + 1]!.x - prev.x, f.poleSpots[far + 1]!.y - prev.y) <= pick.rangeCells) far++;
        if (Math.hypot(f.poleSpots[far]!.x - prev.x, f.poleSpots[far]!.y - prev.y) > pick.rangeCells) break;
        used.add(far);
        cables.push({ x1: prev.x + ox, y1: prev.y + oy, x2: f.poleSpots[far]!.x + ox, y2: f.poleSpots[far]!.y + oy });
        prev = f.poleSpots[far]!;
        n = far + 1;
      }
      f.poleSpots.forEach((p, m) => poles.push({ x: p.x - pick.w / 2 + ox, y: p.y - pick.h / 2 + oy, w: pick.w, h: pick.h, pole: pick.id, unit: u, used: used.has(m) }));
    }
  });
  // Coordonnées positives.
  const all = [...blocks.map(rectOf), ...poles.map(rectOf), ...layouts.flatMap((f, k) => [...f.pipes, ...f.water].map((c) => { const x = c.x + (k % cols) * dx, y = c.y + Math.floor(k / cols) * dy; return { x0: x, y0: y, x1: x + 1, y1: y + 1 }; }))];
  const b = bbox(all);
  const mg = layouts.length > 1 ? 3 : 1;
  const mx = -b.x0 + mg;
  const my = -b.y0 + mg;
  for (const q of blocks) {
    q.x += mx;
    q.y += my;
    if (q.port) q.port = { ...q.port, x: q.port.x + mx, y: q.port.y + my };
    if (q.plug) q.plug = { x: q.plug.x + mx, y: q.plug.y + my };
  }
  for (const p of poles) {
    p.x += mx;
    p.y += my;
  }
  for (const c of cables) {
    c.x1 += mx;
    c.x2 += mx;
    c.y1 += my;
    c.y2 += my;
  }
  const width = b.x1 - b.x0 + 2 * mg;
  const height = b.y1 - b.y0 + 2 * mg;
  // Maillage : bûches vers un départ unique (à droite), eau depuis une arrivée unique (à gauche).
  const bounds: Rect = { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
  const abs = (k: number, c: Cell): Cell => ({ x: c.x + (k % cols) * dx + mx, y: c.y + Math.floor(k / cols) * dy + my });
  const logsIn = layouts.map((f, k) => f.pipes.map((c) => abs(k, c)));
  const waterIn = layouts.map((f, k) => f.water.map((c) => abs(k, c)));
  const base = new CostGrid(bounds);
  for (const r of [...blocks, ...poles].map(rectOf)) base.fill(r, 0);
  const joinAll = (own: Cell[][], ends: (Cell | null)[], other: Cell[], edgeX: number): { cells: Cell[]; end: Cell | null } => {
    const seen = new Set<string>();
    const cells: Cell[] = [];
    const add = (c: Cell) => { if (!seen.has(ck(c.x, c.y))) { seen.add(ck(c.x, c.y)); cells.push(c); } };
    let end: Cell | null = null;
    const cost = new CostGrid(bounds);
    cost.c.set(base.c);
    for (const c of other) cost.c[cost.idx(c)] = 0;
    const order = ends.map((e, k) => ({ e, k })).filter((q) => q.e).sort((p, q) => Math.abs(p.e!.x - edgeX) - Math.abs(q.e!.x - edgeX));
    for (const { e, k } of order) {
      const edge: Cell[] = [];
      if (!end) for (let y = 0; y < height; y++) if (cost.at({ x: edgeX, y })) edge.push({ x: edgeX, y });
      const fl = flood(end ? cells : edge, cost);
      const best = end ? own[k]!.reduce((a, c) => (fl.d(c) < fl.d(a) ? c : a), e!) : e!;
      if (fl.d(best) >= 1e8) { problems.push(msg("asm.farmUnlinked")); continue; }
      const way = fl.path(best);
      end ??= way[way.length - 1]!;
      way.forEach(add);
      own[k]!.forEach(add);
    }
    return { cells, end };
  };
  const logEnds = layouts.map((f, k) => (f.exit ? abs(k, f.exit) : null));
  const waterEnds = layouts.map((f, k) => (f.entry ? abs(k, f.entry) : null));
  const n0 = problems.length;
  let WN = joinAll(waterIn, waterEnds, logsIn.flat(), 0);
  let L = joinAll(logsIn, logEnds, WN.cells, width - 1);
  if (problems.length > n0) {
    const bad = problems.splice(n0);
    L = joinAll(logsIn, logEnds, waterIn.flat(), width - 1);
    WN = joinAll(waterIn, waterEnds, L.cells, 0);
    if (problems.length > n0) problems.push(...bad);
  }
  const pipes = L.cells, exit = L.end, water = WN.cells, entry = WN.end;
  const counts: Record<string, number> = {};
  for (const q of blocks) counts[q.machine] = (counts[q.machine] ?? 0) + 1;
  const poleCounts: Record<string, number> = {};
  for (const p of poles) if (p.used) poleCounts[p.pole] = (poleCounts[p.pole] ?? 0) + 1;
  const poleOptions = def ? g.poles.filter((p) => p.capacityMFps >= def!.capacityMFps - 1e-9 && p.rangeCells >= def!.rangeCells) : [];
  if (!g.ports.output) problems.push(msg("asm.noOutputPort"));
  if (!g.ports.tank) problems.push(msg("asm.noTankPort"));
  return { farms: layouts.length, trees: sizes, capacity: cap, reserveReach: reach, blocks, poles, pipes, exit, water, entry, cables, counts, poleCounts, pole: pick, poleOptions, width, height, gap: layouts.length > 1 ? dx - (fb.x1 - fb.x0) : null, problems };
}

/** Pièces d'un tracé d'une case de large : droites, coudes, embranchements à 3 et 4 voies. */
export function pipeRoles(cells: Cell[], ports: Cell[], end: Cell | null): Record<"droit" | "coude" | "té" | "croix", number> {
  const set = new Set(cells.map((c) => ck(c.x, c.y)));
  const n = { droit: 0, coude: 0, té: 0, croix: 0 };
  for (const c of cells) {
    const we = Number(set.has(ck(c.x - 1, c.y))) + Number(set.has(ck(c.x + 1, c.y)));
    const ns = Number(set.has(ck(c.x, c.y - 1))) + Number(set.has(ck(c.x, c.y + 1)));
    const k = we + ns + ports.filter((p) => p.x === c.x && p.y === c.y).length + Number(!!end && end.x === c.x && end.y === c.y);
    if (k >= 4) n.croix++;
    else if (k === 3) n.té++;
    else if (k === 2 && we === 1 && ns === 1) n.coude++;
    else n.droit++;
  }
  return n;
}

/** Pièces et prix des tuyaux de la ferme (bûches et eau), avec le jeu de tuyaux le moins cher qui porte le débit. */
export function farmPipes(f: FarmSet, cat: Catalog, logsPerSec: number, waterPerSec: number, tier3Only = false): { parts: { id: string; name: string; count: number; price: number | null }[]; count: number; cost: number; ok: boolean } {
  const parts: { id: string; name: string; count: number; price: number | null }[] = [];
  let ok = true;
  const ports = (kind: string): Cell[] => f.blocks.flatMap((b) => (b.kind === kind && b.port ? [b.port] : []));
  for (const [cells, end, kind, perSec] of [[f.pipes, f.exit, "objet", logsPerSec], [f.water, f.entry, "fluide", waterPerSec]] as const) {
    const set = pipeFor(cat, kind, perSec, tier3Only);
    if (!set) {
      ok = false;
      continue;
    }
    const roles = pipeRoles(cells, ports(kind === "objet" ? "output" : "tank"), end);
    for (const [role, count] of Object.entries(roles) as [keyof typeof roles, number][]) if (count) parts.push({ id: set.pieces[role].id, name: set.pieces[role].name, count, price: set.pieces[role].price });
  }
  return { parts, count: f.pipes.length + f.water.length, cost: parts.reduce((t, p) => t + p.count * (p.price ?? 0), 0), ok };
}

/** La ferme tournée de `r` quarts de tour (sens horaire). */
export function turnFarm(f: FarmSet, r: number): FarmSet {
  if (!(r % 4)) return f;
  const H = f.height;
  const cell = <T extends Cell>(c: T): T => ({ ...c, x: H - 1 - c.y, y: c.x });
  const pt = <T extends Cell>(c: T): T => ({ ...c, x: H - c.y, y: c.x });
  const rect = <T extends Cell & { w: number; h: number }>(o: T): T => ({ ...o, x: H - o.y - o.h, y: o.x, w: o.h, h: o.w });
  const TURN: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };
  const out: FarmSet = {
    ...f,
    width: f.height,
    height: f.width,
    blocks: f.blocks.map((b) => ({ ...rect(b), rot: ((b.rot + 1) % 4) as Rot, ...(b.port ? { port: { ...cell(b.port), facing: TURN[b.port.facing] } } : {}), ...(b.plug ? { plug: pt(b.plug) } : {}) })),
    poles: f.poles.map(rect),
    pipes: f.pipes.map(cell),
    exit: f.exit && cell(f.exit),
    water: f.water.map(cell),
    entry: f.entry && cell(f.entry),
    cables: f.cables.map((c) => ({ x1: H - c.y1, y1: c.x1, x2: H - c.y2, y2: c.x2 })),
  };
  return turnFarm(out, (r % 4) - 1);
}

/** Nombre de chaque bloc pour `trees` arbres, d'après le plan de pose (sert au calcul, S14). */
export function farmCounts(g: FarmGeometry, trees: number, loadMFps: number): Record<string, number> {
  return memo(`counts|${geomKey(g)}|${Math.ceil(trees - 1e-9)}|${Math.round(loadMFps)}`, () => designFarm(g, trees, loadMFps).counts);
}

// ---------------------------------------------------------------- moteur diesel

/** Ids des blocs du moteur (machines.json). */
export const DIESEL_IDS = {
  controller: "diesel-engine-controller",
  crankshaft: "diesel-engine-crankshaft",
  generator: "diesel-engine-generator",
  fuel: "diesel-engine-fuel-input",
  cylinder: "diesel-engine-cylinder",
  air: "diesel-engine-air-input",
  exhaust: "diesel-engine-exhaust",
  panel: "diesel-engine-info-panel",
  decoration: "diesel-engine-decoration",
  flywheel: "diesel-engine-flywheel",
} as const;
/** Ordre des blocs de côté, du contrôleur vers le générateur (image MDESetup du wiki). */
export const SIDE_ORDER = [DIESEL_IDS.fuel, DIESEL_IDS.cylinder, DIESEL_IDS.air, DIESEL_IDS.exhaust, DIESEL_IDS.panel, DIESEL_IDS.decoration];

/** Vilebrequins au plus court : un bloc par côté, contrôleur compris (ses deux côtés), au moins un. */
export const crankshaftsFor = (sideBlocks: number) => Math.max(1, Math.ceil((sideBlocks - 2) / 2));

export type DieselPlan = {
  units: number;
  /** Vilebrequins par moteur. */
  cranks: number;
  blocks: AsmBlock[];
  width: number;
  height: number;
  /** Places de côté restées libres (une décoration peut s'y poser), par moteur. */
  freeSides: number;
  counts: Record<string, number>;
};

/**
 * Moteurs diesel posés côte à côte : une ligne contrôleur → vilebrequins → générateur, les blocs de
 * côté au-dessus et au-dessous (deux rangées), les moteurs voisins sans toucher la ligne des autres.
 * `parts` : blocs d'un moteur (vilebrequins recalculés) ; `todo` : blocs dont le nombre est à relever.
 */
export function designDiesel(parts: { machine: string; count: number }[], units: number, sizes: (id: string) => { w: number; h: number }, entries: Record<string, Pick<PortsEntry, "footprint" | "ports">>, todo: string[] = []): DieselPlan {
  const count = (id: string) => parts.find((p) => p.machine === id)?.count ?? 0;
  const side: string[] = [];
  for (const id of SIDE_ORDER) for (let k = 0; k < count(id); k++) side.push(id);
  for (const p of parts) if (!SIDE_ORDER.includes(p.machine as (typeof SIDE_ORDER)[number]) && ![DIESEL_IDS.controller, DIESEL_IDS.crankshaft, DIESEL_IDS.generator, DIESEL_IDS.flywheel].includes(p.machine as never)) for (let k = 0; k < p.count; k++) side.push(p.machine);
  const cranks = crankshaftsFor(side.length);
  const flywheels = count(DIESEL_IDS.flywheel);
  const flyW = flywheels * sizes(DIESEL_IDS.flywheel).w;
  const S = sizes(DIESEL_IDS.crankshaft);
  const cw = S.w;
  const ch = S.h;
  const rowH = 3 * ch;
  const blocks: AsmBlock[] = [];
  for (let u = 1; u <= Math.max(1, units); u++) {
    const y0 = (u - 1) * rowH;
    const put = (machine: string, col: number, row: 0 | 1 | 2, n: number, dx = 0) => {
      const sz = sizes(machine);
      const x = col * cw + dx;
      const y = y0 + row * ch;
      const e = entries[machine];
      const b: AsmBlock = { id: `m${u}:${machine.replace("diesel-engine-", "")}${n}`, kind: machine.replace("diesel-engine-", ""), machine, unit: u, x, y, w: sz.w, h: sz.h, rot: 0 };
      if (todo.includes(machine)) b.todo = true;
      const p = e?.ports.find((q) => q.side !== "dessus" && (q.type === "fluide" || q.type === "objet"));
      if (e && p) {
        const pl = place(b.id, machine, e, x, y, 0).ports.find((q) => q.index === e.ports.indexOf(p));
        if (pl) b.port = { x: pl.cell.x, y: pl.cell.y, facing: pl.facing, fluid: p.type === "fluide" };
      }
      blocks.push(b);
    };
    put(DIESEL_IDS.controller, 0, 1, 0);
    for (let c = 1; c <= cranks; c++) put(DIESEL_IDS.crankshaft, c, 1, c);
    // Volants (relevés, S18) : dans la ligne, après les vilebrequins, avant le générateur.
    let dx = 0;
    for (let k = 0; k < flywheels; k++) {
      put(DIESEL_IDS.flywheel, cranks + 1, 1, k, dx);
      dx += sizes(DIESEL_IDS.flywheel).w;
    }
    put(DIESEL_IDS.generator, cranks + 1, 1, 0, dx);
    // Blocs de côté, colonne par colonne (au-dessous puis au-dessus), du contrôleur vers le générateur.
    side.forEach((id, k) => put(id, Math.floor(k / 2), k % 2 ? 0 : 2, k));
  }
  const counts: Record<string, number> = {};
  for (const b of blocks) counts[b.machine] = (counts[b.machine] ?? 0) + 1;
  return { units: Math.max(1, units), cranks, blocks, width: (cranks + 2) * cw + flyW, height: Math.max(1, units) * rowH, freeSides: 2 * (cranks + 1) - side.length, counts };
}
