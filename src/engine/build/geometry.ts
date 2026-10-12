// Géométrie de la grille de construction (pur, sans DOM) : une case = un Short Pipe = 2×2 studs.
// x vers la droite, y vers le bas, comme la vue de dessus de l'éditeur de bâtiments. Les bâtiments
// pivotent par quarts de tour (relevé en jeu : 4 rotations, pas de 45°).

import type { Port, PortsEntry } from "../extension-types.ts";

export type Dir = "N" | "E" | "S" | "W";
export type Rot = 0 | 1 | 2 | 3;
export type Cell = { x: number; y: number };

export const DIRS: Dir[] = ["N", "E", "S", "W"];
export const STEP: Record<Dir, Cell> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };
const SIDE_DIR: Record<Exclude<Port["side"], "dessus">, Dir> = { haut: "N", droite: "E", bas: "S", gauche: "W" };

export const key = (c: Cell) => `${c.x},${c.y}`;
export const add = (c: Cell, d: Dir, n = 1): Cell => ({ x: c.x + STEP[d].x * n, y: c.y + STEP[d].y * n });
/** Direction après `r` quarts de tour dans le sens horaire. */
export const turn = (d: Dir, r: number): Dir => DIRS[(DIRS.indexOf(d) + r) % 4]!;

/** Point continu (coins des cases aux entiers) dans une boîte w×h, après `r` quarts de tour horaires. */
export function rotatePoint(px: number, py: number, w: number, h: number, r: Rot): { x: number; y: number } {
  let x = px;
  let y = py;
  let W = w;
  let H = h;
  for (let i = 0; i < r; i++) {
    [x, y] = [H - y, x];
    [W, H] = [H, W];
  }
  return { x, y };
}

/** Case (x, y) d'une boîte w×h, après `r` quarts de tour horaires. */
export function rotateCell(c: Cell, w: number, h: number, r: Rot): Cell {
  const p = rotatePoint(c.x + 0.5, c.y + 0.5, w, h, r);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

export const rotatedSize = (w: number, h: number, r: Rot) => (r % 2 ? { w: h, h: w } : { w, h });

/** Port d'un bâtiment posé : la case où un tuyau doit venir le toucher, et vers où elle regarde. */
export type PlacedPort = {
  index: number;
  type: Port["type"];
  direction: Port["direction"];
  /** Case extérieure à toucher (après le plot du port). */
  cell: Cell;
  /** Sens qui s'éloigne du bâtiment. */
  facing: Dir;
  tip?: string;
};

/** Prise électrique ou nœud posé sur le dessus : point continu dans la grille. */
export type PlacedPower = { index: number; type: Port["type"]; direction: Port["direction"]; x: number; y: number };

export type Placed = {
  id: string;
  machine: string;
  x: number;
  y: number;
  rot: Rot;
  /** Taille après rotation, en cases. */
  w: number;
  h: number;
  /** Cases occupées : le bâtiment et les plots de ses ports. */
  cells: Cell[];
  ports: PlacedPort[];
  power: PlacedPower[];
};

/** Pose un bâtiment (empreinte et ports relevés, vue de dessus sans rotation) en (x, y), pivoté de `rot`. */
export function place(id: string, machine: string, entry: Pick<PortsEntry, "footprint" | "ports">, x: number, y: number, rot: Rot): Placed {
  const fw = entry.footprint?.w ?? 1;
  const fh = entry.footprint?.h ?? 1;
  const size = rotatedSize(fw, fh, rot);
  const cells: Cell[] = [];
  for (let i = 0; i < fw; i++) for (let j = 0; j < fh; j++) cells.push(rotateCell({ x: i, y: j }, fw, fh, rot));
  const ports: PlacedPort[] = [];
  const power: PlacedPower[] = [];
  entry.ports.forEach((p, index) => {
    if (p.side === "dessus") {
      const [c, r] = Array.isArray(p.cell) ? p.cell : [p.cell, 1];
      const q = rotatePoint(c - 0.5, r - 0.5, fw, fh, rot);
      power.push({ index, type: p.type, direction: p.direction, x: x + q.x, y: y + q.y });
      return;
    }
    const k = (Array.isArray(p.cell) ? p.cell[0] : p.cell) - 1;
    const side = SIDE_DIR[p.side];
    // Case du bâtiment contre le bord, puis le plot (stub) qui dépasse, puis la case à toucher.
    const inner: Cell = side === "N" ? { x: k, y: 0 } : side === "S" ? { x: k, y: fh - 1 } : side === "W" ? { x: 0, y: k } : { x: fw - 1, y: k };
    const stub = p.stub ?? 0;
    for (let s = 1; s <= stub; s++) cells.push(rotateStub(inner, side, s, fw, fh, rot));
    const facing = turn(side, rot);
    const touch = rotateStub(inner, side, stub + 1, fw, fh, rot);
    ports.push({ index, type: p.type, direction: p.direction, cell: { x: x + touch.x, y: y + touch.y }, facing, ...(p.tip ? { tip: p.tip } : {}) });
  });
  return { id, machine, x, y, rot, w: size.w, h: size.h, cells: cells.map((c) => ({ x: x + c.x, y: y + c.y })), ports, power };
}

/** Case à `n` pas de `inner` vers l'extérieur (côté `side`), exprimée après rotation. */
function rotateStub(inner: Cell, side: Dir, n: number, w: number, h: number, rot: Rot): Cell {
  const out = add(inner, side, n);
  const p = rotatePoint(out.x + 0.5, out.y + 0.5, w, h, rot);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}
