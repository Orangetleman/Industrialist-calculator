// Plans de pose des ensembles modulaires (S14). Pur, sans DOM.
//   - Ferme d'arbres, assemblage par portées : chaque arroseur au centre d'un carré d'emplacements
//     d'arbre (ceux que son cercle touche) ; les coins vides de quatre carrés font la place d'un
//     récolteur ; le contrôleur au plus près du centre ; sorties et réservoirs là où les portées les
//     touchent, avec un passage libre pour leur tuyau ; une chaîne de poteaux du bord jusqu'à la prise
//     du contrôleur. Au-delà de ce que tient une ferme, plusieurs fermes écartées : le cercle d'un
//     contrôleur ne touche aucun bloc d'une autre ferme.
//   - Moteur diesel, assemblage par contact : contrôleur au bout, vilebrequins en ligne, générateur
//     au bout ; un bloc de côté par côté (contrôleur compris), des deux côtés ; le moins de
//     vilebrequins possible (la longueur ne change pas la puissance, réponse du 2026-10-18).
// Toutes les valeurs viennent de `FarmGeometry` (data/modular.json et tailles du wiki) : rien ici
// n'est une valeur du jeu.

import type { PortsEntry } from "../extension-types.ts";
import { place, STEP, type Dir, type Rot } from "./geometry.ts";

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

/** Passage réservé pour un tuyau : de la case du port, en ligne droite, jusqu'au bord de l'ensemble. */
export type Corridor = { x: number; y: number; dir: Dir; len: number; block: string };
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
  corridors: Corridor[];
  poles: AsmPole[];
  /** Câbles : de la prise du contrôleur vers le bord, poteau par poteau. */
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
  problems: string[];
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
  /** Places réservées aux poteaux, de la prise vers le bord (la dernière est hors de la ferme). */
  poleSpots: { x: number; y: number }[];
  ok: boolean;
  lost: number;
};

const LAT: [number, number][] = [];
for (let a = -5; a <= 5; a++) for (let c = -5; c <= 5; c++) LAT.push([a, c]);
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

function farmOnce(g: FarmGeometry, N: number, cells: number, reach: number | null, full = false, extra = 0): Farm & { short: boolean } {
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
  if (trees.length < N + extra && !full) return { ...base, harv: [], outs: [], tanks: [], ok: false, lost: N - trees.length, short: true };

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
  const caseBlocked = (x: number, y: number) => (occ.get(skey(slotAt(x), slotAt(y))) ?? "r") !== "r" || tanks.some((t) => x >= t.r.x0 && x < t.r.x1 && y >= t.r.y0 && y < t.r.y1);
  const rectBlocked = (r: Rect) => {
    for (let i = slotAt(r.x0); i <= slotAt(r.x1 - 1e-9); i++) for (let j = slotAt(r.y0); j <= slotAt(r.y1 - 1e-9); j++) if (occ.has(skey(i, j))) return true;
    return tanks.some((t) => overlap(t.r, r));
  };
  const placedBox = (): Rect => {
    const ks = [...occ.keys()].map((k) => k.split(",").map(Number) as [number, number]);
    return bbox([...ks.map(([i, j]) => slot(i, j)), ...tanks.map((t) => t.r)]);
  };
  // Passage : de la case du port en ligne droite jusqu'au-delà de tout ce qui est posé.
  const rays: { x: number; y: number; dir: Dir }[] = [];
  const rayClear = (p: { x: number; y: number; facing: Dir }, box: Rect, extra?: Rect) => {
    let x = p.x;
    let y = p.y;
    for (let n = 0; n < 1000; n++) {
      if (x < box.x0 - 1 || x > box.x1 || y < box.y0 - 1 || y > box.y1) return true;
      if (caseBlocked(x, y) || (extra && x >= extra.x0 && x < extra.x1 && y >= extra.y0 && y < extra.y1)) return false;
      x += STEP[p.facing].x;
      y += STEP[p.facing].y;
    }
    return true;
  };
  /** Passage d'une sortie : les emplacements de sa ligne (arbres à retirer compris) ; null : un autre bloc la coupe. */
  const rayCarve = (p: { x: number; y: number; facing: Dir }, box: Rect): string[] | null => {
    let x = p.x;
    let y = p.y;
    const carve = new Set<string>();
    for (let n = 0; n < 1000; n++) {
      if (x < box.x0 - 1 || x > box.x1 || y < box.y0 - 1 || y > box.y1) return [...carve];
      const k = skey(slotAt(x), slotAt(y));
      const kind = occ.get(k);
      if (!kind || kind === "t" || kind === "r") carve.add(k);
      else if (tanks.some((t) => x >= t.r.x0 && x < t.r.x1 && y >= t.r.y0 && y < t.r.y1)) return null;
      else return null;
      x += STEP[p.facing].x;
      y += STEP[p.facing].y;
    }
    return [...carve];
  };
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
    while (harv.some((h) => !h.out)) {
      const box = placedBox();
      let bestO: { c: (typeof ocands)[number]; rot: Rot; port: Out["port"]; gain: number; len: number; carve: string[]; lane: string[] } | null = null;
      for (const c of ocands) {
        const here = occ.get(skey(c.i, c.j));
        if (here && here !== "t") continue;
        const gain = c.cov.filter((h) => !h.out).length;
        if (!gain) continue;
        for (const rot of [0, 1, 2, 3] as Rot[]) {
          const port = at(outPorts[rot]!, c.r.x0, c.r.y0);
          const ray = port ? rayCarve(port, box) : [];
          if (!ray) continue;
          const lane = ray.filter((k) => k !== skey(c.i, c.j));
          const carve = [...(here === "t" ? [skey(c.i, c.j)] : []), ...lane.filter((k) => occ.get(k) === "t")];
          // D'abord une place qui ne retire aucun arbre ; puis celle qui dessert le plus de récolteurs, qui
          // retire le moins d'arbres, et la plus courte.
          const len = port ? distOut(port, box) : 0;
          const better = !bestO || lexLess([carve.length ? 1 : 0, -gain, carve.length, len], [bestO.carve.length ? 1 : 0, -bestO.gain, bestO.carve.length, bestO.len]);
          if (better) bestO = { c, rot, port: port ?? { x: c.r.x0, y: c.r.y1, facing: "S", fluid: false }, gain, len, carve, lane };
        }
      }
      if (!bestO) break;
      // Passage à travers le bois : ses arbres sont retirés (la ferme en replace d'autres, voir oneFarm).
      for (const k of bestO.carve) {
        occ.set(k, "r");
        const n = trees.findIndex((t) => skey(t.i, t.j) === k);
        if (n < 0) continue;
        const t = trees[n]!;
        if (t.h) t.h.trees = t.h.trees.filter((q) => q !== t);
        trees.splice(n, 1);
      }
      // Toute la ligne du passage est réservée : aucun bloc posé après ne la bouche.
      for (const k of bestO.lane) if (!occ.has(k)) occ.set(k, "r");
      occ.set(skey(bestO.c.i, bestO.c.j), "o");
      const o: Out = { r: bestO.c.r, rot: bestO.rot, port: bestO.port, cov: bestO.c.cov };
      outs.push(o);
      if (g.ports.output) rays.push({ x: bestO.port.x, y: bestO.port.y, dir: bestO.port.facing });
      for (const h of o.cov) h.out ??= o;
    }
  }

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
  for (let k = 0; k < nt; k++) {
    const box = placedBox();
    let bestT: Tank | null = null;
    for (const c of tcands) {
      if (rectBlocked(c.r) || crossesRay(c.r)) continue;
      const port = at(tankPorts[c.rot]!, c.r.x0, c.r.y0);
      if (port && !rayClear(port, bbox([box, c.r]), c.r)) continue;
      bestT = { r: c.r, rot: c.rot, port };
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
    if (bestT.port) rays.push({ x: bestT.port.x, y: bestT.port.y, dir: bestT.port.facing });
  }
  const lost = trees.filter((t) => !t.h).length;
  const ok = (full || trees.length >= N) && trees.length > 0 && !lost && harv.every((h) => h.out) && tanks.length === nt;
  return { ...base, harv, outs, tanks, ok, lost, short: false };
}

const byIdUnit = (blocks: AsmBlock[], id: string) => blocks.find((b) => b.id === id)?.unit ?? 1;

/** a avant b, critère par critère. */
function lexLess(a: number[], b: number[]): boolean {
  for (let n = 0; n < a.length; n++) if (a[n] !== b[n]) return a[n]! < b[n]!;
  return false;
}

/** Distance du port au bord de la boîte, dans son sens (longueur du passage). */
function distOut(p: { x: number; y: number; facing: Dir }, box: Rect): number {
  if (p.facing === "N") return Math.max(0, p.y - box.y0);
  if (p.facing === "S") return Math.max(0, box.y1 - p.y);
  if (p.facing === "W") return Math.max(0, p.x - box.x0);
  return Math.max(0, box.x1 - p.x);
}

/** Ferme de N arbres : on ajoute des carrés d'arroseur tant que les arbres à portée du contrôleur manquent. */
function oneFarm(g: FarmGeometry, N: number, reach: number | null): Farm {
  const per = sprinklerOffsets(g).length;
  let extra = 0;
  let f!: Farm & { short: boolean };
  for (let cells = Math.max(1, Math.ceil(N / per)), guard = 0; guard < 60; guard++) {
    f = farmOnce(g, N, cells, reach, false, extra);
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
    if (cache.size > 400) cache.clear();
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
    const full = farmOnce(g, 1e6, MAX_CELLS, reach, true);
    if (full.ok) return full.trees.length;
    let hi = full.trees.filter((t) => t.h).length;
    let lo = 0;
    if (hi > 0 && farmMemo(g, hi, reach).ok) lo = hi;
    while (hi - lo > 1) {
      const m = Math.floor((lo + hi) / 2);
      if (farmMemo(g, m, reach).ok) lo = m;
      else hi = m;
    }
    // Le placement n'est pas tout à fait monotone : on monte tant que la ferme suivante se place encore.
    for (let k = 0; k < 20 && farmMemo(g, lo + 1, reach).ok; k++) lo++;
    return Math.max(1, lo);
  });
}

const farmMemo = (g: FarmGeometry, n: number, reach: number | null) => memo(`farm|${geomKey(g)}|${n}|${reach}`, () => oneFarm(g, n, reach));

/**
 * Fermes pour `trees` arbres. `loadMFps` : électricité de toutes les fermes (pour le poteau) ;
 * `pole` : poteau choisi (sinon le moins cher qui porte une ferme). Les places des poteaux sont
 * toujours réservées pour le poteau par défaut : un poteau de plus grande portée en laisse libres.
 */
export function designFarm(g: FarmGeometry, trees: number, loadMFps: number, pole?: string): FarmSet {
  const T = g.tree;
  const N = Math.max(0, Math.ceil(trees - 1e-9));
  const problems: string[] = [];
  const empty: FarmSet = { farms: 0, trees: [], capacity: 0, reserveReach: null, blocks: [], corridors: [], poles: [], cables: [], counts: {}, poleCounts: {}, pole: null, poleOptions: [], width: 0, height: 0, gap: null, problems };
  if (!N) return empty;
  // Poteau : d'abord pour une seule ferme, puis pour la part de chacune.
  let farms = 1;
  let def: FarmPole | null = null;
  let reach: number | null = null;
  let cap = 0;
  def = defaultPole(g, loadMFps);
  reach = def ? def.rangeCells : null;
  if (!farmMemo(g, N, reach).ok) {
    for (let guard = 0; guard < 4; guard++) {
      cap = farmCapacity(g, reach);
      const n = Math.max(1, Math.ceil(N / Math.max(1, cap)));
      if (n === farms && guard) break;
      farms = n;
      def = defaultPole(g, loadMFps / farms);
      reach = def ? def.rangeCells : null;
    }
  }
  if (g.poles.length && !def) problems.push("Aucun poteau connu ne porte l'électricité d'une ferme : le contrôleur n'est pas alimenté dans ce plan.");
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
  for (const f of layouts) if (!f.ok) problems.push(`Une ferme de ${f.N} arbres ne se place pas en entier (${f.lost} arbre${f.lost > 1 ? "s" : ""} sans récolteur, sortie ou réservoir).`);
  // Écart entre deux fermes : le cercle d'un contrôleur ne touche aucun bloc de l'autre.
  const rectsOf = (f: Farm): Rect[] => [...f.trees.map((t) => t.r), ...f.spr.map((s) => s.r), ...f.harv.map((h) => h.r), ...f.outs.map((o) => o.r), ...f.tanks.map((t) => t.r), f.ctrl.r];
  const big = layouts[0]!;
  const rs = rectsOf(big);
  const fb = bbox([...rs, ...big.poleSpots.map((p) => ({ x0: p.x - T / 2, y0: p.y - T / 2, x1: p.x + T / 2, y1: p.y + T / 2 }))]);
  const [ccx, ccy] = mid(big.ctrl.r);
  const clash = (dx: number, dy: number) => rs.some((r) => rdist(ccx, ccy, shift(r, dx, dy)) <= g.reach.controller || rdist(ccx + dx, ccy + dy, r) <= g.reach.controller || overlap(fb, shift(fb, dx, dy)));
  const cols = Math.ceil(Math.sqrt(farms));
  let dx = fb.x1 - fb.x0;
  let dy = fb.y1 - fb.y0;
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
  const corridors: Corridor[] = [];
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
      if (g.ports.output) corridors.push({ x: o.port.x + ox, y: o.port.y + oy, dir: o.port.facing, len: 0, block: outId.get(o)! });
    });
    f.tanks.forEach((t, n) => {
      const served = f.spr.slice(n * g.perTank, (n + 1) * g.perTank).map((_, m) => id(`s${n * g.perTank + m}`));
      blocks.push({ id: id(`w${n}`), kind: "tank", machine: FARM_IDS.tank, unit: u, ...R(t.r), rot: t.rot, serves: served, ...(t.port ? { port: { ...t.port, x: t.port.x + ox, y: t.port.y + oy } } : {}) });
      if (t.port) corridors.push({ x: t.port.x + ox, y: t.port.y + oy, dir: t.port.facing, len: 0, block: id(`w${n}`) });
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
  // Coordonnées positives et longueur des passages jusqu'au bord de l'ensemble.
  const all = [...blocks.map(rectOf), ...poles.map(rectOf)];
  const b = bbox(all);
  const mx = -b.x0 + 1;
  const my = -b.y0 + 1;
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
  const width = b.x1 - b.x0 + 2;
  const height = b.y1 - b.y0 + 2;
  // Un passage va jusqu'au bord de sa ferme (au-delà, l'écart entre deux fermes laisse passer le tuyau).
  const unitBox = new Map<number, Rect>();
  for (const q of blocks) unitBox.set(q.unit, unitBox.has(q.unit) ? bbox([unitBox.get(q.unit)!, rectOf(q)]) : rectOf(q));
  for (const p of poles) unitBox.set(p.unit, bbox([unitBox.get(p.unit)!, rectOf(p)]));
  for (const c of corridors) {
    c.x += mx;
    c.y += my;
    const u = byIdUnit(blocks, c.block);
    const fb2 = unitBox.get(u)!;
    c.len = Math.max(0, c.dir === "N" ? c.y - fb2.y0 + 1 : c.dir === "S" ? fb2.y1 - c.y : c.dir === "W" ? c.x - fb2.x0 + 1 : fb2.x1 - c.x);
  }
  const counts: Record<string, number> = {};
  for (const q of blocks) counts[q.machine] = (counts[q.machine] ?? 0) + 1;
  const poleCounts: Record<string, number> = {};
  for (const p of poles) if (p.used) poleCounts[p.pole] = (poleCounts[p.pole] ?? 0) + 1;
  const poleOptions = def ? g.poles.filter((p) => p.capacityMFps >= def!.capacityMFps - 1e-9 && p.rangeCells >= def!.rangeCells) : [];
  if (!g.ports.output) problems.push("Port de la sortie non relevé : pas de passage réservé pour le tuyau des Oak Logs.");
  if (!g.ports.tank) problems.push("Entrée d'eau du réservoir non relevée : pas de passage réservé pour l'eau.");
  return { farms: layouts.length, trees: sizes, capacity: cap, reserveReach: reach, blocks, corridors, poles, cables, counts, poleCounts, pole: pick, poleOptions, width, height, gap: layouts.length > 1 ? dx - (fb.x1 - fb.x0) : null, problems };
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
  for (const p of parts) if (!SIDE_ORDER.includes(p.machine as (typeof SIDE_ORDER)[number]) && ![DIESEL_IDS.controller, DIESEL_IDS.crankshaft, DIESEL_IDS.generator].includes(p.machine as never)) for (let k = 0; k < p.count; k++) side.push(p.machine);
  const cranks = crankshaftsFor(side.length);
  const S = sizes(DIESEL_IDS.crankshaft);
  const cw = S.w;
  const ch = S.h;
  const rowH = 3 * ch;
  const blocks: AsmBlock[] = [];
  for (let u = 1; u <= Math.max(1, units); u++) {
    const y0 = (u - 1) * rowH;
    const put = (machine: string, col: number, row: 0 | 1 | 2, n: number) => {
      const sz = sizes(machine);
      const x = col * cw;
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
    put(DIESEL_IDS.generator, cranks + 1, 1, 0);
    // Blocs de côté, colonne par colonne (au-dessous puis au-dessus), du contrôleur vers le générateur.
    side.forEach((id, k) => put(id, Math.floor(k / 2), k % 2 ? 0 : 2, k));
  }
  const counts: Record<string, number> = {};
  for (const b of blocks) counts[b.machine] = (counts[b.machine] ?? 0) + 1;
  return { units: Math.max(1, units), cranks, blocks, width: (cranks + 2) * cw, height: Math.max(1, units) * rowH, freeSides: 2 * (cranks + 1) - side.length, counts };
}
