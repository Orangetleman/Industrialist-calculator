// Module de construction pour une étape du plan : N machines identiques, leurs collecteurs
// (un tuyau par ressource), les raccords de chaque port et les poteaux électriques. Plusieurs
// gabarits sont essayés (une rangée, deux rangées dos à dos) dans les 4 orientations ; on garde
// le plus compact, puis le moins cher. Pur, sans DOM.

import type { Port, PortsEntry } from "../extension-types.ts";
import { pipeFor, type Catalog, type PieceRole, type PipeKind, type PipeSet } from "./catalog.ts";
import { OPPOSITE, place, type Cell, type Dir, type Placed, type Rot } from "./geometry.ts";
import { Grid, route, type Bounds } from "./route.ts";

export type Flow = { item: string; perMin: number; fluid: boolean };

export type ModuleRequest = {
  machine: string;
  count: number;
  /** Totaux du module (toutes machines), par minute. */
  inputs: Flow[];
  outputs: Flow[];
  /** Consommation électrique moyenne d'une machine (MF/s), si connue. */
  powerMFps: number | null;
  /** Prix d'une machine ($), si connu. */
  machineCost: number | null;
  /** N'utiliser que des tuyaux de tier III (plus rapides, plus chers). */
  tier3Only?: boolean;
  /** Ce qui départage les dispositions, dans l'ordre (par défaut : place, prix, pièces). */
  priority?: PoseCriterion[];
  /**
   * Bout par lequel chaque collecteur (par ressource) entre ou sort du module : « début » (à gauche de la
   * rangée) ou « fin » (à droite). Par défaut, les entrées au début et les sorties à la fin. Sert à tourner
   * les sorties d'un module vers ses voisins quand toute l'usine est assemblée. « milieu » : le collecteur
   * ne va que de son premier à son dernier port, sans bout ; l'usine assemblée y raccorde un seul tuyau.
   */
  ends?: Record<string, "début" | "fin" | "milieu">;
  /** Module replié : le tuyau principal de chaque ressource arrive ou part par le haut (défaut) ou par le bas. */
  trunkExit?: Record<string, "haut" | "bas">;
  /**
   * Double rangée : le collecteur central de la ressource sort à angle droit par un passage entre deux
   * machines voisines d'une rangée (« haut » : la première, « bas » : la seconde), après la machine
   * n° `after` de cette rangée (1 = entre la 1re et la 2e). S'il n'y a pas de colonne libre entre elles,
   * les machines suivantes de la rangée s'écartent d'une case (le module peut s'élargir). Remplace `ends`.
   */
  passages?: Record<string, Passage>;
};

export type Passage = { row: "haut" | "bas"; after: number };

/** Disposition retenue, pour refaire le même module avec d'autres bouts (`redesign`). */
type FlatConfig = { assign: Assign[]; double: boolean; rot: Rot; sides: Record<string, "haut" | "bas"> | null; hug: boolean; extra: number };

/** Critères des plans de pose : place au sol, forme ramassée (plus grand côté), prix, pièces à poser. */
export type PoseCriterion = "place" | "forme" | "prix" | "pieces";
export const POSE_CRITERIA: PoseCriterion[] = ["place", "forme", "prix", "pieces"];

export type Net = {
  /** Identifiant du réseau : la ressource, suivie de « #n » quand plusieurs collecteurs la portent. */
  id: string;
  item: string;
  /** Numéro du collecteur parallèle (null s'il est seul). */
  line: number | null;
  kind: PipeKind;
  role: "entrée" | "sortie";
  perSec: number;
  pipe: PipeSet | null;
  /** Côté du collecteur : au-dessus ou au-dessous des machines (rangée du haut pour la double rangée). */
  lane: { y: number; x0: number; x1: number } | null;
  /** Raccord vers l'extérieur du module (arrivée d'une entrée, départ d'une sortie). */
  end: { x: number; y: number; dir: Dir } | null;
  /** Sortie par un passage entre deux machines (double rangée) ; `widened` : machines écartées d'une case pour l'ouvrir. */
  via?: Passage & { x: number; widened: boolean };
};

/** Une pièce de tuyau par case ; un croisement porte deux réseaux (`links` pour `net`, `crossLinks` pour `crossNet`). */
export type PlacedPiece = { x: number; y: number; net: string; role: PieceRole; links: Dir[]; pieceId: string | null; crossNet?: string; crossLinks?: Dir[] };
export type PlacedPole = { x: number; y: number; w: number; h: number; pole: string; covers: string[] };
export type Problem = { level: "erreur" | "attention"; message: string };

export type ModulePlan = {
  machine: string;
  count: number;
  template: "rangée" | "double rangée";
  /** Rangées repliées : le module est fait de `folds` blocs empilés (1 : pas replié). */
  folds: number;
  /** Les blocs d'un module replié (pour `redesign`). */
  blocks?: ModulePlan[];
  rot: Rot;
  /** Ports relevés en jeu, ou supposés faute de relevé. */
  portsKnown: boolean;
  width: number;
  height: number;
  machines: Placed[];
  pieces: PlacedPiece[];
  nets: Net[];
  poles: PlacedPole[];
  parts: { id: string; name: string; count: number; unitPrice: number | null }[];
  cost: number;
  costUnknown: number;
  problems: Problem[];
  assumptions: string[];
  order: string[];
  /** Disposition retenue (rangée simple ou double), pour `redesign`. */
  config?: FlatConfig;
  /** Ordre des critères qui a choisi ce module, et ce que donnerait le 2e critère mis en premier. */
  priority: PoseCriterion[];
  other: { first: PoseCriterion; width: number; height: number; cost: number; pieces: number; crossings: number; template: ModulePlan["template"]; folds: number } | null;
};

/** Nombre pour les messages : deux décimales au plus, virgule décimale. */
const num = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");

type Assign = { port: number; item: string; role: "entrée" | "sortie"; kind: PipeKind };

/** Associe chaque ressource à un port du bon type (objet/fluide) et du bon sens. */
export type Namer = (id: string) => string;

/**
 * Les façons d'associer les ressources aux ports : en jeu (onglet 3), une entrée peut arriver par
 * n'importe quel port du même type (objet ou fluide), même un port de sortie ; une sortie, elle, doit
 * partir de son port de sortie. Plafonné à `max`.
 */
export function portAssignments(entry: Pick<PortsEntry, "ports">, req: Pick<ModuleRequest, "inputs" | "outputs">, max = 24): Assign[][] {
  // Sorties : chacune part de son port de sortie (relevé du 2026-10-14 : une sortie ne se redirige pas).
  const used = new Set<number>();
  const outs: Assign[] = [];
  for (const f of req.outputs) {
    const kind: PipeKind = f.fluid ? "fluide" : "objet";
    const j = entry.ports.findIndex((p, k) => !used.has(k) && p.type === kind && (p.direction === "sortie" || p.direction === "les deux"));
    if (j < 0) return [];
    used.add(j);
    outs.push({ port: j, item: f.item, role: "sortie", kind });
  }
  // Entrées : n'importe quel port libre du même type, même un port de sortie (le jeu redirige l'entrée).
  const out: Assign[][] = [];
  const walk = (i: number, acc: Assign[]) => {
    if (out.length >= max) return;
    if (i === req.inputs.length) {
      out.push([...acc, ...outs]);
      return;
    }
    const f = req.inputs[i]!;
    const kind: PipeKind = f.fluid ? "fluide" : "objet";
    entry.ports.forEach((p, j) => {
      if (used.has(j) || p.type !== kind) return;
      used.add(j);
      acc.push({ port: j, item: f.item, role: "entrée", kind });
      walk(i + 1, acc);
      acc.pop();
      used.delete(j);
    });
  };
  walk(0, []);
  return out;
}

export function assignPorts(entry: Pick<PortsEntry, "ports">, req: Pick<ModuleRequest, "inputs" | "outputs">, name: Namer = (id) => id): { assign: Assign[]; problems: Problem[] } {
  const used = new Set<number>();
  const assign: Assign[] = [];
  const problems: Problem[] = [];
  const pick = (f: Flow, role: "entrée" | "sortie") => {
    const kind: PipeKind = f.fluid ? "fluide" : "objet";
    const dir: Port["direction"] = role === "entrée" ? "entrée" : "sortie";
    const i = entry.ports.findIndex((p, j) => !used.has(j) && p.type === kind && (p.direction === dir || p.direction === "les deux"));
    if (i < 0) {
      problems.push({ level: "erreur", message: `Aucun port ${role === "entrée" ? "d'entrée" : "de sortie"} ${kind === "fluide" ? "de fluide" : "d'objet"} libre pour ${name(f.item)} dans le relevé de ce bâtiment.` });
      return;
    }
    used.add(i);
    assign.push({ port: i, item: f.item, role, kind });
  };
  for (const f of req.inputs) pick(f, "entrée");
  for (const f of req.outputs) pick(f, "sortie");
  return { assign, problems };
}

/** Ports supposés d'un bâtiment non relevé : entrées à gauche, sorties à droite, prise au centre. */
export function assumedEntry(size: { w: number; l: number } | null, req: Pick<ModuleRequest, "inputs" | "outputs">): Pick<PortsEntry, "footprint" | "ports"> {
  const w = Math.max(2, size?.w ?? 4);
  const h = Math.max(2, size?.l ?? 4, req.inputs.length + 1, req.outputs.length + 1);
  const ports: Port[] = [];
  req.inputs.forEach((f, i) => ports.push({ type: f.fluid ? "fluide" : "objet", direction: "entrée", side: "gauche", cell: 1 + i }));
  req.outputs.forEach((f, i) => ports.push({ type: f.fluid ? "fluide" : "objet", direction: "sortie", side: "droite", cell: 1 + i }));
  ports.push({ type: "énergie", direction: "entrée", side: "dessus", cell: [Math.ceil(w / 2), Math.ceil(h / 2)] });
  return { footprint: { w, h }, ports };
}

const ROLE_OF = (links: Set<Dir>): PieceRole => {
  if (links.size >= 4) return "croix";
  if (links.size === 3) return "té";
  if (links.size === 2) {
    const [a, b] = [...links];
    return OPPOSITE[a!] === b ? "droit" : "coude";
  }
  return "droit";
};

type Layout = { grid: Grid; machines: Placed[]; nets: Net[]; problems: Problem[]; bounds: Bounds; template: ModulePlan["template"]; rot: Rot };

/**
 * Pose N machines en une rangée (ou deux rangées dos à dos), trace un collecteur par ressource
 * le long de la rangée, puis raccorde chaque port au collecteur de sa ressource.
 */
function layout(entry: Pick<PortsEntry, "footprint" | "ports">, assign: Assign[], req: ModuleRequest, rot: Rot, double: boolean, gapExtra: number, cat: Catalog, name: Namer, sides: Record<string, "haut" | "bas"> | null = null, hug = false, widen = false): Layout | null {
  const problems: Problem[] = [];
  const probe = place("m", req.machine, entry, 0, 0, rot);
  const used = new Map(assign.map((a) => [a.port, a]));
  const pipePorts = probe.ports.filter((p) => used.has(p.index));
  const sideCount = (f: Dir) => pipePorts.filter((p) => p.facing === f).length;
  const gap = sideCount("E") + sideCount("W") + gapExtra;
  const perRow = double ? Math.ceil(req.count / 2) : req.count;
  const pitch = probe.w + gap;

  // Collecteurs : chaque ressource du côté où sont la plupart de ses ports (nord ou sud de la rangée).
  // Au-delà du tuyau le plus rapide permis, plusieurs collecteurs en parallèle, chacun pour un
  // groupe de machines voisines.
  const items = [...new Set(assign.map((a) => a.item))];
  const flowOf = new Map(items.map((it) => {
    const a = assign.find((x) => x.item === it)!;
    const f = (a.role === "entrée" ? req.inputs : req.outputs).find((x) => x.item === it)!;
    return [it, { a, perSec: f.perMin / 60 }] as const;
  }));
  const linesOf = new Map(items.map((it) => {
    const { a, perSec } = flowOf.get(it)!;
    if (pipeFor(cat, a.kind, perSec, req.tier3Only)) return [it, 1] as const;
    const fastest = Math.max(...cat.pipes.filter((x) => x.kind === a.kind).map((x) => x.flowPerSec));
    return [it, Math.min(req.count, Math.ceil(perSec / fastest - 1e-9))] as const;
  }));
  const netId = (it: string, i: number) => (linesOf.get(it)! > 1 ? `${it}#${1 + Math.floor((i * linesOf.get(it)!) / req.count)}` : it);
  const sideOf = new Map<string, "haut" | "bas">();
  for (const it of items) {
    const ps = pipePorts.filter((p) => used.get(p.index)!.item === it);
    const north = ps.filter((p) => p.facing === "N").length;
    const south = ps.filter((p) => p.facing === "S").length;
    // Côté imposé (rangée simple) : un raccord peut contourner la machine pour éviter un croisement.
    sideOf.set(it, double ? "bas" : (sides?.[it] ?? (north > south ? "haut" : "bas")));
  }
  const netIds = items.flatMap((it) => (linesOf.get(it)! > 1 ? Array.from({ length: linesOf.get(it)! }, (_, j) => `${it}#${j + 1}`) : [it]));
  const itemOf = (id: string) => id.replace(/#\d+$/, "");
  const above = netIds.filter((id) => sideOf.get(itemOf(id)) === "haut");
  const below = netIds.filter((id) => sideOf.get(itemOf(id)) === "bas");
  // Les cases qui touchent les ports (rangée de raccord), puis un collecteur par ressource. Collecteur
  // collé (`hug`) : le plus proche passe sur la rangée de raccord ; une autre ressource le traverse
  // par un croisement collé au port (en jeu, les deux tuyaux du croisement se relient à la machine).
  const touchN = sideCount("N") ? 1 : 0;
  const touchS = sideCount("S") ? 1 : 0;
  const hugN = hug && !!above.length && !!touchN;
  const hugS = hug && !!below.length && !!touchS;
  const y0 = above.length + touchN - (hugN ? 1 : 0); // haut de la (première) rangée
  const aboveRow = (k: number) => y0 - touchN - (hugN ? k : k + 1);
  const touchRowS = y0 + probe.h + touchS - 1; // sous la (première) rangée
  const belowRow = (k: number) => touchRowS + (hugS ? k : k + 1);
  const lastBelow = below.length ? belowRow(below.length - 1) : touchRowS;
  // Double rangée : la seconde rangée est tournée d'un demi-tour, ports vers le collecteur central.
  const rot2 = ((rot + 2) % 4) as Rot;
  const probe2 = place("m", req.machine, entry, 0, 0, rot2);
  const touchN2 = probe2.ports.some((p) => used.has(p.index) && p.facing === "N") ? 1 : 0;
  const row2y = touchN2 ? (hug && below.length ? lastBelow : lastBelow + 1) + touchN2 : lastBelow + 1;

  // Passages du collecteur central (double rangée) ; `widen` : chaque passage écarte les machines suivantes de sa rangée d'une case.
  const vias = double ? Object.entries(req.passages ?? {}).filter(([it]) => items.includes(it)) : [];
  const rowSize = (row: "haut" | "bas") => (row === "haut" ? perRow : req.count - perRow);
  if (vias.some(([, v]) => v.after < 1 || v.after > rowSize(v.row) || (v.after === rowSize(v.row) && rowSize(v.row) >= rowSize(v.row === "haut" ? "bas" : "haut")))) return null;
  const shiftOf = (row: "haut" | "bas", k: number) => (widen ? vias.filter(([, v]) => v.row === row && v.after <= k && v.after < rowSize(row)).length : 0);

  const grid = new Grid();
  const machines: Placed[] = [];
  const x0 = 1; // colonne 0 : arrivée des collecteurs d'entrée
  for (let i = 0; i < req.count; i++) {
    const second = double && i >= perRow;
    const k = second ? i - perRow : i;
    const pm = place(`m${i + 1}`, req.machine, entry, x0 + k * pitch + shiftOf(second ? "bas" : "haut", k), second ? row2y : y0, second ? rot2 : rot);
    machines.push(pm);
    for (const c of pm.cells) {
      if (grid.get(c)) return null;
      grid.block(c, pm.id);
    }
  }
  const allPorts = machines.flatMap((m, i) => m.ports.filter((p) => used.has(p.index)).map((p) => ({ m, p, a: used.get(p.index)!, net: netId(used.get(p.index)!.item, i) })));
  for (const { p, net } of allPorts) {
    if (grid.get(p.cell)) return null;
    grid.reserve(p.cell, net);
  }
  const xMax = Math.max(...machines.map((m) => m.x + m.w), ...allPorts.map((q) => q.p.cell.x + 1));
  const yMax = Math.max(...machines.map((m) => m.y + m.h), ...allPorts.map((q) => q.p.cell.y + 1), lastBelow + 1);
  const bounds: Bounds = { x0: 0, y0: 0, x1: xMax, y1: yMax + 1 };

  const nets: Net[] = netIds.map((id) => {
    const it = itemOf(id);
    const { a, perSec } = flowOf.get(it)!;
    const k = linesOf.get(it)!;
    const share = k > 1 ? allPorts.filter((q) => q.net === id && q.a.item === it).length / allPorts.filter((q) => q.a.item === it).length : 1;
    const pipe = pipeFor(cat, a.kind, perSec * share, req.tier3Only);
    if (!pipe) problems.push({ level: "erreur", message: `${name(it)} : ${num(perSec * share)} par seconde pour une seule machine, au-delà du tuyau le plus rapide.` });
    return { id, item: it, line: k > 1 ? Number(id.split("#")[1]) : null, kind: a.kind, role: a.role, perSec: perSec * share, pipe, lane: null, end: null };
  });
  for (const it of items) {
    const k = linesOf.get(it)!;
    if (k < 2) continue;
    const { a, perSec } = flowOf.get(it)!;
    problems.push({
      level: "attention",
      message: `${name(it)} : ${num(perSec)} par seconde, plus qu'un seul tuyau : ${k} collecteurs en parallèle.${
        a.kind === "fluide" ? " Pour l'amener jusqu'au module, un gros tuyau de tier IV (Large Fluid Pipe) puis une Large Fluid Pipe Conversion par collecteur : ce sera dans l'usine assemblée." : ""
      }`,
    });
  }
  // Collecteurs droits : les entrées arrivent par la gauche (colonne 0), les sorties partent à droite.
  const laneRow = (id: string) => (sideOf.get(itemOf(id)) === "haut" ? aboveRow(above.indexOf(id)) : belowRow(below.indexOf(id)));
  const portAt = new Map(allPorts.map((q) => [`${q.p.cell.x},${q.p.cell.y}`, q.p.facing]));
  const viaOf = new Map(vias);
  if (vias.some(([it]) => linesOf.get(it)! > 1)) return null; // un seul collecteur par passage
  const retry = () => (!widen && vias.length ? layout(entry, assign, req, rot, double, gapExtra, cat, name, sides, hug, true) : null);
  // Étendue de chaque collecteur : au début (colonne 0, à gauche), à la fin (dernière colonne, à droite),
  // ou « milieu » (au moins deux cases, pour qu'il y ait un tuyau où raccorder les ports).
  const lanes = new Map(
    nets.map((n) => {
      const xs = allPorts.filter((q) => q.net === n.id).map((q) => q.p.cell.x);
      const y = laneRow(n.id);
      const endKind = viaOf.has(n.item) ? "milieu" : (req.ends?.[n.item] ?? (n.role === "entrée" ? "début" : "fin"));
      const lane = endKind === "milieu" ? { y, x0: Math.min(...xs), x1: Math.max(Math.max(...xs), Math.min(...xs) + 1) } : endKind === "fin" ? { y, x0: Math.min(...xs), x1: bounds.x1 } : { y, x0: 0, x1: Math.max(...xs) };
      return [n.id, { lane, endKind }] as const;
    }),
  );
  // Passages : une colonne libre entre les deux machines (ni bâtiment ni port jusqu'au bord du module), qui
  // croise les autres collecteurs sur un tuyau droit (pas à leur bout) ; la plus proche du milieu de l'écart.
  const rowMachines = (row: "haut" | "bas") => (row === "haut" ? machines.slice(0, perRow) : machines.slice(perRow));
  const viaCol = new Map<string, number>();
  for (const n of nets) {
    const v = viaOf.get(n.item);
    if (!v) continue;
    const ms = rowMachines(v.row);
    const left = ms[v.after - 1]!;
    const right = ms[v.after];
    const other = rowMachines(v.row === "haut" ? "bas" : "haut");
    const lo = left.x + left.w;
    const hi = right ? right.x - 1 : Math.max(...other.map((m) => m.x + m.w)) - 1;
    const { lane } = lanes.get(n.id)!;
    const span = (px: number) => (v.row === "haut" ? Array.from({ length: lane.y }, (_, k) => ({ x: px, y: k })) : Array.from({ length: bounds.y1 - lane.y }, (_, k) => ({ x: px, y: lane.y + 1 + k })));
    const crossable = (px: number, y: number) =>
      [...lanes].every(([id, o]) => id === n.id || o.lane.y !== y || px < o.lane.x0 || px > o.lane.x1 || (px > o.lane.x0 && px < o.lane.x1));
    const cols = Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => lo + k).sort((a, b) => Math.abs(a - (lo + hi) / 2) - Math.abs(b - (lo + hi) / 2));
    const px = cols.find((x) => ![...viaCol.values()].includes(x) && span(x).every((c) => !grid.get(c) && crossable(x, c.y)));
    if (px === undefined) return retry();
    viaCol.set(n.id, px);
    lane.x0 = Math.min(lane.x0, px);
    lane.x1 = Math.max(lane.x1, px);
  }
  for (const n of nets) {
    const { lane, endKind } = lanes.get(n.id)!;
    const y = lane.y;
    const atEnd = endKind === "fin";
    for (let x = lane.x0; x <= lane.x1; x++) {
      // Un collecteur collé passe sur les cases de raccord des ports qui lui font face, pas ailleurs.
      const o = grid.get({ x, y });
      const facing = portAt.get(`${x},${y}`);
      if (o && !(o.kind === "réservé" && (facing === "N" || facing === "S"))) return null;
    }
    grid.straight({ x: lane.x0, y }, { x: lane.x1, y }, n.id);
    n.lane = lane;
    if (endKind !== "milieu") {
      grid.link({ x: atEnd ? lane.x1 : lane.x0, y }, atEnd ? "E" : "W", n.id); // arrivée ou départ
      n.end = atEnd ? { x: lane.x1, y, dir: "E" } : { x: lane.x0, y, dir: "W" };
    }
  }
  // Puis chaque passage, du collecteur jusqu'au bord du module ; vers le bas, jusqu'à la rangée de
  // contournement (retirée ensuite si aucun raccord ne la croise).
  for (const n of nets) {
    const px = viaCol.get(n.id);
    if (px === undefined) continue;
    const v = viaOf.get(n.item)!;
    const y = n.lane!.y;
    const edge = v.row === "haut" ? 0 : bounds.y1;
    for (let yy = Math.min(y, edge); yy <= Math.max(y, edge); yy++) {
      if (yy === y) continue;
      const o = grid.get({ x: px, y: yy });
      if (o && !(o.kind === "tuyau" && o.net !== n.id && !o.cross && o.links.size === 2 && o.links.has("E") && o.links.has("W"))) return retry();
    }
    grid.straight({ x: px, y }, { x: px, y: edge }, n.id);
    const dir: Dir = v.row === "haut" ? "N" : "S";
    grid.link({ x: px, y: edge }, dir, n.id);
    n.end = { x: px, y: edge, dir };
    n.via = { ...v, x: px, widened: widen && v.after < rowSize(v.row) };
  }
  // Raccords : du port vers le collecteur, les plus proches d'abord.
  const order = [...allPorts].sort((a, b) => Math.abs(a.p.cell.y - laneRow(a.net)) - Math.abs(b.p.cell.y - laneRow(b.net)) || a.p.cell.x - b.p.cell.x);
  for (const { m, p, a, net } of order) {
    const lane = nets.find((n) => n.id === net)!.lane!;
    const h = (c: Cell) => Math.abs(c.y - lane.y) + Math.max(0, lane.x0 - c.x, c.x - lane.x1);
    if (!route(grid, net, p.cell, OPPOSITE[p.facing], bounds, h)) {
      problems.push({ level: "erreur", message: `Machine ${m.id.slice(1)} : impossible de raccorder le port ${a.role === "entrée" ? "d'entrée" : "de sortie"} (${name(a.item)}) à son collecteur.` });
      return { grid, machines, nets, problems, bounds, template: double ? "double rangée" : "rangée", rot };
    }
  }
  // Passage vers le bas : la rangée de contournement n'est gardée que si un raccord y croise le passage.
  for (const n of nets) {
    if (n.via?.row !== "bas" || n.end?.y !== bounds.y1) continue;
    const o = grid.get(n.end);
    if (o?.kind !== "tuyau" || o.cross || o.links.size > 2) continue;
    grid.cells.delete(`${n.end.x},${n.end.y}`);
    n.end = { ...n.end, y: n.end.y - 1 };
  }
  return { grid, machines, nets, problems, bounds, template: double ? "double rangée" : "rangée", rot };
}

type Pole = Catalog["poles"][number];

/**
 * Poteaux : une file au-dessus du module et, si besoin, une au-dessous (double rangée) ; chaque
 * prise va à la file la plus proche, puis les poteaux sont placés pour que toutes soient à portée.
 * Une file est alimentée par un bout : son premier poteau porte toute sa consommation. On prend le
 * poteau le moins cher dont chaque file ne demande qu'une alimentation ; sinon le plus fort, avec
 * plusieurs alimentations.
 */
function placePoles(l: Layout, req: ModuleRequest, cat: Catalog, name: Namer): { poles: PlacedPole[]; problems: Problem[]; pole: Pole | null } {
  const plugs = l.machines.flatMap((m) => m.power.filter((p) => p.type === "énergie" && p.direction !== "sortie").map((p) => ({ m: m.id, x: p.x, y: p.y })));
  if (!plugs.length) return { poles: [], problems: [], pole: null };
  const each = req.powerMFps ?? 0;
  const types = cat.poles.filter((p) => p.capacityMFps >= each);
  if (!types.length) return { poles: [], problems: [{ level: "attention", message: "Aucun poteau connu ne porte la consommation d'une machine." }], pole: null };
  // Une seule file (au-dessus ou au-dessous) quand elle atteint toutes les prises : deux rangées de moins.
  const pick = (use: FileUse) => {
    const tries = types.map((pole) => ({ pole, ...polesWith(l, plugs, pole, each, use) }));
    const oneFeed = tries.filter((t) => t.files.every((f) => f.feeds <= 1));
    return oneFeed.length
      ? oneFeed.sort((a, b) => a.cost - b.cost)[0]!
      : tries.sort((a, b) => a.files.reduce((s, f) => s + f.feeds, 0) - b.files.reduce((s, f) => s + f.feeds, 0) || a.cost - b.cost)[0]!;
  };
  const single = (["haut", "bas"] as const).map(pick).filter((t) => !t.outOfRange).sort((a, b) => a.cost - b.cost)[0];
  const best = single ?? pick("deux");
  const problems = [...best.problems];
  for (const f of best.files) {
    if (f.feeds > 1)
      problems.push({
        level: "attention",
        message: `File de poteaux ${f.label} : ${Math.round(f.load).toLocaleString("fr-FR")} MF/s, plus que ce que porte un ${name(best.pole.id)} (${best.pole.capacityMFps.toLocaleString("fr-FR")} MF/s, tous ses nœuds) : alimente-la par ${f.feeds} lignes séparées.`,
      });
  }
  return { poles: best.poles, problems, pole: best.pole };
}

type FileUse = "deux" | "haut" | "bas";

/** Emprise de ce qui est posé (calculée une fois par disposition : les poteaux l'interrogent souvent). */
const extents = new WeakMap<Layout, { minX: number; maxX: number; minY: number; maxY: number }>();
function extentOf(l: Layout) {
  let e = extents.get(l);
  if (!e) {
    e = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const k of l.grid.cells.keys()) {
      const i = k.indexOf(",");
      const x = Number(k.slice(0, i));
      const y = Number(k.slice(i + 1));
      if (x < e.minX) e.minX = x;
      if (x > e.maxX) e.maxX = x;
      if (y < e.minY) e.minY = y;
      if (y > e.maxY) e.maxY = y;
    }
    extents.set(l, e);
  }
  return e;
}

function polesWith(l: Layout, plugs: { m: string; x: number; y: number }[], pole: Pole, each: number, use: FileUse = "deux") {
  const problems: Problem[] = [];
  const ext = extentOf(l);
  const rows = [ext.minY - pole.size.h, ext.maxY + 1]; // haut de chaque file
  const R = pole.rangeCells;
  // Un poteau reste au-dessus (ou au-dessous) du module, sans l'élargir.
  const xLo = ext.minX + pole.size.w / 2;
  const xHi = ext.maxX + 1 - pole.size.w / 2;
  const poles: PlacedPole[] = [];
  const files: { label: string; load: number; feeds: number }[] = [];
  let outOfRange = false;
  // Colonnes des passages (double rangée) : aucun poteau de la file de leur côté ne s'y pose.
  const avoid = (ri: number) => l.nets.filter((n) => n.via && (n.via.row === "haut") === (ri === 0)).map((n) => n.via!.x);
  const hits = (x: number, cols: number[]) => cols.some((a) => a >= x && a < x + pole.size.w);
  const dist = (p: { y: number }, r: number) => Math.abs(p.y - (r + pole.size.h / 2));
  rows.forEach((py, ri) => {
    const cy = py + pole.size.h / 2;
    const mine = use === "deux" ? plugs.filter((p) => (ri === 0 ? dist(p, rows[0]!) <= dist(p, rows[1]!) : dist(p, rows[1]!) < dist(p, rows[0]!))) : (use === "haut") === (ri === 0) ? plugs : [];
    if (!mine.length) return;
    const spans = mine.map((p) => {
      const dy = Math.abs(p.y - cy);
      const r = dy <= R ? Math.sqrt(R * R - dy * dy) : -1;
      return { ...p, lo: p.x - r, hi: p.x + r, ok: r >= 0 };
    });
    for (const s of spans.filter((s) => !s.ok)) {
      outOfRange = true;
      problems.push({ level: "attention", message: `Machine ${s.m.slice(1)} : prise à plus de ${num(R)} cases de la file de poteaux.` });
    }
    const todo = spans.filter((s) => s.ok).sort((a, b) => a.hi - b.hi);
    const covered = new Set<number>();
    const row: PlacedPole[] = [];
    const cols = avoid(ri);
    for (let i = 0; i < todo.length; i++) {
      if (covered.has(i)) continue;
      let cx = Math.max(todo[i]!.lo, Math.min(todo[i]!.hi, xHi, Math.max(xLo, todo[i]!.hi)));
      // Sur un passage : le poteau glisse à côté, s'il atteint encore sa prise.
      const at = (c: number) => Math.floor(c - pole.size.w / 2);
      if (hits(at(cx), cols)) {
        const near = Array.from({ length: 2 * (pole.size.w + 1) }, (_, k) => cx + (k % 2 ? 1 : -1) * (1 + (k >> 1)));
        cx = near.find((c) => c >= todo[i]!.lo - 1e-9 && c <= todo[i]!.hi + 1e-9 && !hits(at(c), cols)) ?? cx;
      }
      const covers: string[] = [];
      todo.forEach((s, j) => {
        if (!covered.has(j) && s.lo <= cx + 1e-9 && s.hi >= cx - 1e-9) {
          covered.add(j);
          covers.push(s.m);
        }
      });
      row.push({ x: Math.floor(cx - pole.size.w / 2), y: py, w: pole.size.w, h: pole.size.h, pole: pole.id, covers });
    }
    // Les poteaux d'une file se relient entre eux : un poteau de plus si deux voisins sont trop loin.
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      while (row[i]!.x - row[i - 1]!.x > R) {
        let x = row[i - 1]!.x + Math.floor(R);
        while (hits(x, cols) && x > row[i - 1]!.x + 1) x--;
        row.splice(i, 0, { x, y: py, w: pole.size.w, h: pole.size.h, pole: pole.id, covers: [] });
      }
    }
    poles.push(...row);
    const load = new Set(mine.map((p) => p.m)).size * each;
    files.push({ label: ri === 0 ? "du haut" : "du bas", load, feeds: Math.max(1, Math.ceil(load / pole.capacityMFps - 1e-9)) });
  });
  if (files.length === 2 && rows[1]! - rows[0]! > R) {
    problems.push({ level: "attention", message: `Les deux files de poteaux sont à ${rows[1]! - rows[0]!} cases l'une de l'autre, plus que la portée (${num(R)}) : relie-les par un poteau sur le côté du module.` });
  }
  return { poles, problems, files, cost: poles.length * (pole.price ?? 0), outOfRange };
}

/** Meilleur module pour une étape : gabarits × orientations × ports × côtés des collecteurs. */
export function designModule(req: ModuleRequest, entry: PortsEntry | null, wikiSize: { w: number; l: number } | null, cat: Catalog, name: Namer = (id) => id): ModulePlan {
  const portsKnown = !!entry?.footprint;
  const e = portsKnown ? entry! : assumedEntry(wikiSize, req);
  // Ports supposés : leur place est déjà une hypothèse, inutile d'en essayer d'autres combinaisons.
  const options = portAssignments(e, req, portsKnown ? 8 : 1);
  const fallback = assignPorts(e, req, name);
  const assigns: { assign: Assign[]; problems: Problem[] }[] = options.length ? options.map((assign) => ({ assign, problems: [] })) : [fallback];
  const items = [...new Set(assigns[0]!.assign.map((a) => a.item))];
  // Côtés des collecteurs (rangée simple) : tous les choix au-dessus / au-dessous, jusqu'à 4 ressources.
  // (Au-delà, le côté où sont la plupart des ports de chaque ressource.)
  const sideSets: (Record<string, "haut" | "bas"> | null)[] = items.length <= 4 ? [] : [null];
  for (let mask = 0; items.length <= 4 && mask < 1 << items.length; mask++) sideSets.push(Object.fromEntries(items.map((it, k) => [it, mask & (1 << k) ? "haut" : "bas"])));
  type Config = { assign: Assign[]; problems: Problem[]; double: boolean; rot: Rot; sides: Record<string, "haut" | "bas"> | null; hug: boolean };
  const configs: Config[] = [];
  for (const a of assigns) {
    for (const double of req.count >= 2 ? [false, true] : [false]) {
      for (const rot of [0, 1, 2, 3] as Rot[]) for (const sides of double ? [null] : sideSets) for (const hug of [false, true]) configs.push({ ...a, double, rot, sides, hug });
    }
  }
  const build = (c: Config, r: ModuleRequest): ModulePlan | null => {
    let last: ModulePlan | null = null;
    for (let extra = 0; extra <= 3; extra++) {
      const l = layout(e, c.assign, r, c.rot, c.double, extra, cat, name, c.sides, c.hug);
      if (!l) continue;
      last = finish(l, r, portsKnown, cat, [...c.problems, ...l.problems], name);
      last.config = { assign: c.assign, double: c.double, rot: c.rot, sides: c.sides, hug: c.hug, extra };
      // Plus d'espace entre les machines n'aide que si un raccord n'a pas trouvé de chemin.
      if (!l.problems.some((p) => p.level === "erreur" && p.message.includes("impossible de raccorder"))) break;
    }
    return last;
  };
  const errors = (p: ModulePlan) => p.problems.filter((x) => x.level === "erreur").length;
  const pieceCount = (p: ModulePlan) => p.pieces.length + p.poles.length;
  type Metrics = Record<PoseCriterion, number>;
  const score = (prio: PoseCriterion[], p: ModulePlan, m: Metrics) => [errors(p), ...prio.map((k) => m[k])];
  const order = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return 0;
  };
  const metrics = (p: ModulePlan): Metrics => ({ place: p.width * p.height, forme: Math.max(p.width, p.height), prix: p.cost, pieces: pieceCount(p) });
  // 1. Essai rapide de chaque configuration sur 2 machines (4 en double rangée) : valeurs par machine,
  //    et forme estimée pour `count` machines (la longueur croît avec le nombre de machines).
  const probeN = (c: Config) => Math.min(req.count, c.double ? 4 : 2);
  const probed = configs
    .map((c) => {
      const n = probeN(c);
      const p = build(c, scaleRequest(req, n));
      return p ? { c, p, n } : null;
    })
    .filter((x): x is { c: Config; p: ModulePlan; n: number } => !!x);
  const estimate = (x: (typeof probed)[number], count: number): Metrics => ({
    place: (x.p.width * x.p.height * count) / x.n,
    forme: Math.max((x.p.width * count) / x.n, x.p.height),
    prix: (x.p.cost * count) / x.n,
    pieces: (pieceCount(x.p) * count) / x.n,
  });
  // 2. Pour un nombre de machines et un ordre des critères, les meilleures en vrai (calculées une fois).
  const full = new Map<string, ModulePlan | null>();
  const real = (k: number, count: number) => {
    const key = `${k}|${count}`;
    if (!full.has(key)) full.set(key, build(probed[k]!.c, scaleRequest(req, count)));
    return full.get(key)!;
  };
  const best = (count: number, prio: PoseCriterion[], tries = 3): ModulePlan | null =>
    probed
      .map((x, k) => ({ k, s: score(prio, x.p, estimate(x, count)) }))
      .sort((a, b) => order(a.s, b.s))
      .slice(0, tries)
      .map((x) => real(x.k, count))
      .filter((p): p is ModulePlan => !!p)
      .sort((a, b) => order(score(prio, a, metrics(a)), score(prio, b, metrics(b))))[0] ?? null;
  // 3. Rangées repliées : le même module en blocs empilés, alimentés par des tuyaux principaux. On
  //    essaie le nombre de blocs qui rend l'ensemble à peu près carré, et ses voisins (2 à 4 blocs).
  const candidates = (prio: PoseCriterion[]): ModulePlan[] => {
    const out: ModulePlan[] = [];
    const flat = best(req.count, prio);
    if (!flat) return out;
    out.push(flat);
    if (flat.width <= 2 * flat.height && flat.height <= 2 * flat.width) return out; // déjà ramassé
    const ideal = Math.round(Math.sqrt(Math.max(flat.width, flat.height) / Math.min(flat.width, flat.height)));
    for (const k of [...new Set([ideal - 1, ideal, ideal + 1])].filter((k) => k >= 2 && k <= 4)) {
      const n = Math.ceil(req.count / k);
      const last = req.count - (k - 1) * n;
      if (n < 2 || last < 1) continue;
      const a = best(n, prio, 1);
      const b = last === n ? a : best(last, prio, 1);
      if (!a || !b || errors(a) || errors(b)) continue;
      const f = foldModule([...Array.from({ length: k - 1 }, () => a), b], req, cat, name);
      if (f) out.push(f);
    }
    return out;
  };
  const pick = (prio: PoseCriterion[]) => candidates(prio).sort((a, b) => order(score(prio, a, metrics(a)), score(prio, b, metrics(b))))[0] ?? null;
  const priority = normalPriority(req.priority);
  const chosen = pick(priority);
  // L'autre choix : le 2e critère passé en premier.
  const swapped = [priority[1]!, priority[0]!, ...priority.slice(2)];
  const alt = pick(swapped);
  const crossings = (p: ModulePlan) => p.pieces.filter((x) => x.role === "croisement").length;
  if (chosen) {
    chosen.priority = priority;
    chosen.other =
      alt && (alt.width !== chosen.width || alt.height !== chosen.height || Math.round(alt.cost) !== Math.round(chosen.cost)) && !errors(alt)
        ? { first: swapped[0]!, width: alt.width, height: alt.height, cost: alt.cost, pieces: pieceCount(alt), crossings: crossings(alt), template: alt.template, folds: alt.folds }
        : null;
  }
  return (
    chosen ?? {
      machine: req.machine,
      count: req.count,
      template: "rangée",
      folds: 1,
      rot: 0,
      portsKnown,
      width: 0,
      height: 0,
      machines: [],
      pieces: [],
      nets: [],
      poles: [],
      parts: [],
      cost: 0,
      costUnknown: 0,
      problems: [...fallback.problems, { level: "erreur", message: "Aucune disposition trouvée." }],
      assumptions: cat.assumptions,
      order: [],
      priority: normalPriority(req.priority),
      other: null,
    }
  );
}

/**
 * Rangées repliées : les blocs (modules déjà dessinés) sont empilés ; chaque ressource arrive par un
 * tuyau principal vertical, à gauche pour les entrées et à droite pour les sorties, avec un
 * embranchement vers le collecteur de chaque bloc. Le tuyau principal porte le débit de tous les
 * blocs : null s'il n'existe pas de tuyau assez rapide.
 */
export function foldModule(blocks: ModulePlan[], req: ModuleRequest, cat: Catalog, name: Namer = (id) => id): ModulePlan | null {
  const first = blocks[0]!;
  const ids = [...new Set(blocks.flatMap((b) => b.nets.map((n) => n.id)))];
  const netOf = (id: string) => blocks.flatMap((b) => b.nets).find((n) => n.id === id)!;
  // Côté de chaque tuyau principal : celui du bout des collecteurs (par défaut, entrées à gauche, sorties à droite).
  const right = (id: string) => (req.ends?.[netOf(id).item] ?? (netOf(id).role === "entrée" ? "début" : "fin")) === "fin";
  const ins = ids.filter((id) => !right(id));
  const outs = ids.filter((id) => right(id));
  // Tuyau principal de chaque ressource : le débit de tous les blocs.
  const trunkPipe = new Map<string, PipeSet>();
  for (const id of ids) {
    const total = blocks.reduce((s, b) => s + (b.nets.find((n) => n.id === id)?.perSec ?? 0), 0);
    const pipe = pipeFor(cat, netOf(id).kind, total, req.tier3Only);
    if (!pipe) return null;
    trunkPipe.set(id, pipe);
  }
  const L = ins.length + 1; // colonnes des tuyaux d'entrée, puis une case libre
  const widest = Math.max(...blocks.map((b) => b.width));
  const grid = new Grid();
  const pipeAt = new Map<string, PipeSet | null>();
  const machines: Placed[] = [];
  const poles: PlacedPole[] = [];
  const lanes = new Map<string, { y: number; x: number }[]>(); // bouts des collecteurs, par ressource
  let y0 = 0;
  for (const b of blocks) {
    const ox = L;
    const ren = new Map(b.machines.map((m, i) => [m.id, `m${machines.length + i + 1}`]));
    for (const m of b.machines) {
      const mv = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.x + ox, y: o.y + y0 });
      const pm = { ...mv(m), id: ren.get(m.id)!, cells: m.cells.map(mv), ports: m.ports.map((q) => ({ ...q, cell: mv(q.cell) })), power: m.power.map(mv) };
      machines.push(pm);
      for (const c of pm.cells) grid.block(c, pm.id);
    }
    for (const q of b.poles) poles.push({ ...q, x: q.x + ox, y: q.y + y0, covers: q.covers.map((c) => ren.get(c) ?? c) });
    for (const pc of b.pieces) {
      const c = { x: pc.x + ox, y: pc.y + y0 };
      grid.cells.set(`${c.x},${c.y}`, { kind: "tuyau", net: pc.net, links: new Set(pc.links), ...(pc.crossNet ? { cross: { net: pc.crossNet, links: new Set(pc.crossLinks ?? []) } } : {}) });
      pipeAt.set(`${c.x},${c.y}`, b.nets.find((n) => n.id === pc.net)?.pipe ?? null);
    }
    for (const n of b.nets) if (n.end) lanes.set(n.id, [...(lanes.get(n.id) ?? []), { y: n.end.y + y0, x: n.end.x + ox }]);
    y0 += b.height;
  }
  const H = y0;
  const R0 = L + widest + 1; // première colonne des tuyaux de sortie
  // Ordre des tuyaux principaux : le moins de croisements avec les embranchements des autres.
  const arrange = (list: string[], side: "gauche" | "droite") => {
    const perms = (a: string[]): string[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])));
    const colOf = (pos: number) => (side === "gauche" ? L - 2 - pos : R0 + pos); // pos 0 : le plus près du module
    let bestP = list;
    let bestN = Infinity;
    for (const pm of list.length <= 5 ? perms(list) : [list]) {
      let n = 0;
      pm.forEach((id, pos) => {
        const bottom = Math.max(...lanes.get(id)!.map((e) => e.y));
        // Les embranchements des ressources plus éloignées traversent ce tuyau s'il descend jusqu'à eux.
        for (const other of pm.slice(pos + 1)) n += lanes.get(other)!.filter((e) => e.y <= bottom).length;
      });
      if (n < bestN) [bestN, bestP] = [n, pm];
    }
    return new Map(bestP.map((id, pos) => [id, colOf(pos)]));
  };
  const col = new Map([...arrange(ins, "gauche"), ...arrange(outs, "droite")]);
  // Tuyau principal : du haut (ou du bas) du module jusqu'au bloc le plus éloigné, puis un embranchement par bloc.
  const low = (id: string) => req.trunkExit?.[netOf(id).item] === "bas";
  for (const id of ids) {
    const c = col.get(id)!;
    const ends = lanes.get(id)!;
    const [y0t, y1t] = low(id) ? [Math.min(...ends.map((e) => e.y)), H - 1] : [0, Math.max(...ends.map((e) => e.y))];
    for (let y = y0t; y <= y1t; y++) pipeAt.set(`${c},${y}`, trunkPipe.get(id)!);
    grid.straight({ x: c, y: y0t }, { x: c, y: y1t }, id);
    grid.link({ x: c, y: low(id) ? H - 1 : 0 }, low(id) ? "S" : "N", id); // arrivée (entrée) ou départ (sortie)
    for (const e of ends) {
      const [a, b] = c < e.x ? [c, e.x] : [e.x, c];
      for (let x = a; x <= b; x++) {
        const k = `${x},${e.y}`;
        const o = grid.cells.get(k);
        if (o && o.kind !== "tuyau") return null;
        if (!pipeAt.has(k)) pipeAt.set(k, blocks.flatMap((bl) => bl.nets).find((n) => n.id === id)?.pipe ?? trunkPipe.get(id)!);
      }
      grid.straight({ x: a, y: e.y }, { x: b, y: e.y }, id);
    }
  }
  // Pièces : rôle selon les liaisons ; tuyau du bloc, ou du tuyau principal.
  const kindOf = (id: string) => netOf(id).kind;
  const pieces: PlacedPiece[] = [];
  for (const [k, o] of grid.cells) {
    if (o.kind !== "tuyau") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    if (o.cross) {
      const kinds = new Set([kindOf(o.net), kindOf(o.cross.net)]);
      const piece = kinds.size > 1 ? cat.crossings.mixte : kinds.has("fluide") ? cat.crossings.fluide : cat.crossings.objet;
      pieces.push({ x, y, net: o.net, crossNet: o.cross.net, role: "croisement", links: [...o.links], crossLinks: [...o.cross.links], pieceId: piece?.id ?? null });
      continue;
    }
    const role = ROLE_OF(o.links);
    const set = pipeAt.get(k) ?? null;
    pieces.push({ x, y, net: o.net, role, links: [...o.links], pieceId: set ? set.pieces[role === "croisement" ? "droit" : role].id : null });
  }
  const width = R0 + outs.length;
  const nets: Net[] = ids.map((id) => {
    const n = netOf(id);
    const perSec = blocks.reduce((s, b) => s + (b.nets.find((x) => x.id === id)?.perSec ?? 0), 0);
    return { ...n, perSec, pipe: trunkPipe.get(id)!, lane: null, end: low(id) ? { x: col.get(id)!, y: H - 1, dir: "S" } : { x: col.get(id)!, y: 0, dir: "N" } };
  });
  const problems: Problem[] = [...blocks.flatMap((b) => b.problems).filter((p, i, a) => a.findIndex((q) => q.message === p.message) === i)];
  const tally = countParts(req, pieces, poles, cat, name, problems);
  const crossings = pieces.filter((pc) => pc.role === "croisement").length;
  return {
    ...first,
    count: machines.length,
    folds: blocks.length,
    blocks,
    width,
    height: H,
    machines,
    pieces,
    nets,
    poles,
    ...tally,
    problems,
    order: [
      `Poser ${blocks.length} blocs de ${first.count} ${name(req.machine)} en ${first.template}, les uns sous les autres${blocks.at(-1)!.count !== first.count ? ` (le dernier n'en a que ${blocks.at(-1)!.count})` : ""}.`,
      ...nets.map((n) => `Tuyau principal ${n.role === "entrée" ? "d'entrée" : "de sortie"} : ${name(n.item)}${n.line ? ` (n° ${n.line})` : ""}, tier ${n.pipe!.tier === 1 ? "I" : "III"} (${num(n.perSec)} par seconde), ${right(n.id) ? "à droite" : "à gauche"}, par ${low(n.id) ? "le bas" : "le haut"}, avec un embranchement vers chaque bloc.`),
      ...first.order.slice(1).map((o) => `Dans chaque bloc : ${o.charAt(0).toLowerCase()}${o.slice(1)}`),
      ...(crossings ? [`En tout, ${crossings} croisement(s).`] : []),
    ],
    other: null,
  };
}

/**
 * Le même module (même disposition, mêmes machines), refait avec d'autres bouts de collecteurs
 * (`req.ends`) : quand l'usine est assemblée, chaque module tourne ses entrées et ses sorties vers ses
 * voisins, et ses collecteurs ne s'étendent que jusqu'à leurs ports. null si ce n'est pas possible.
 */
export function redesign(plan: ModulePlan, req: ModuleRequest, entry: PortsEntry | null, wikiSize: { w: number; l: number } | null, cat: Catalog, name: Namer = (id) => id): ModulePlan | null {
  const portsKnown = !!entry?.footprint;
  const e = portsKnown ? entry! : assumedEntry(wikiSize, req);
  const one = (p: ModulePlan, r: ModuleRequest): ModulePlan | null => {
    const c = p.config;
    if (!c) return null;
    const l = layout(e, c.assign, r, c.rot, c.double, c.extra, cat, name, c.sides, c.hug);
    if (!l) return null;
    const out = finish(l, r, portsKnown, cat, [...l.problems], name);
    out.config = c;
    return out.problems.some((x) => x.level === "erreur") ? null : out;
  };
  let out: ModulePlan | null;
  if (plan.folds > 1 && plan.blocks) {
    const blocks = plan.blocks.map((b) => one(b, scaleRequest(req, b.count)));
    if (blocks.some((b) => !b)) return null;
    out = foldModule(blocks as ModulePlan[], req, cat, name);
  } else out = one(plan, req);
  if (out) {
    out.priority = plan.priority;
    out.other = plan.other;
  }
  return out;
}

/**
 * Les autres dispositions internes d'un module simple (mêmes machines ; la taille peut varier d'une ou deux cases) :
 * collecteurs au-dessus ou au-dessous de la rangée, rangée retournée, collecteur collé ou non, autre
 * choix des ports. Sert à tourner les collecteurs vers les voisins quand l'usine est assemblée.
 */
export function alternatives(plan: ModulePlan, req: ModuleRequest, entry: PortsEntry | null, wikiSize: { w: number; l: number } | null, cat: Catalog, name: Namer = (id) => id): ModulePlan[] {
  const c = plan.config;
  if (!c || plan.folds > 1) return [];
  const portsKnown = !!entry?.footprint;
  const e = portsKnown ? entry! : assumedEntry(wikiSize, req);
  const items = [...new Set(c.assign.map((a) => a.item))];
  const sideSets: (Record<string, "haut" | "bas"> | null)[] = c.double || items.length > 4 ? [c.sides] : [];
  for (let mask = 0; !c.double && items.length <= 4 && mask < 1 << items.length; mask++) sideSets.push(Object.fromEntries(items.map((it, k) => [it, mask & (1 << k) ? "haut" : "bas"])));
  const assigns = [c.assign, ...portAssignments(e, req, portsKnown ? 4 : 1).filter((a) => JSON.stringify(a) !== JSON.stringify(c.assign))];
  const out: ModulePlan[] = [];
  for (const assign of assigns)
    for (const rot of [c.rot, ((c.rot + 2) % 4) as Rot])
      for (const sides of sideSets)
        for (const hug of [false, true]) {
          const l = layout(e, assign, req, rot, c.double, c.extra, cat, name, sides, hug);
          if (!l) continue;
          const p = finish(l, req, portsKnown, cat, [...l.problems], name);
          if (p.problems.some((x) => x.level === "erreur")) continue;
          p.config = { assign, double: c.double, rot, sides, hug, extra: c.extra };
          p.priority = plan.priority;
          p.other = plan.other;
          out.push(p);
        }
  return out;
}

/** Liste des pièces et coût : machines, tuyaux, croisements, poteaux. */
function countParts(req: ModuleRequest, pieces: PlacedPiece[], poles: PlacedPole[], cat: Catalog, name: Namer, problems: Problem[]) {
  const parts = new Map<string, { id: string; name: string; count: number; unitPrice: number | null }>();
  const addPart = (id: string, label: string, price: number | null, n = 1) => {
    const p = parts.get(id) ?? { id, name: label, count: 0, unitPrice: price };
    p.count += n;
    parts.set(id, p);
  };
  addPart(req.machine, name(req.machine), req.machineCost, req.count);
  const allPieces = [...cat.pipes.flatMap((s) => Object.values(s.pieces)), ...Object.values(cat.crossings).filter((x): x is NonNullable<typeof x> => !!x)];
  for (const pc of pieces) {
    const def = allPieces.find((x) => x.id === pc.pieceId);
    if (def) addPart(def.id, def.name, def.price);
    else problems.push({ level: "erreur", message: `Pièce inconnue pour un ${pc.role} de ${name(pc.net.replace(/#\d+$/, ""))}.` });
  }
  for (const q of poles) {
    const def = cat.poles.find((x) => x.id === q.pole);
    addPart(q.pole, def?.name ?? q.pole, def?.price ?? null);
  }
  const list = [...parts.values()];
  return { parts: list, cost: list.reduce((s, p) => s + (p.unitPrice ?? 0) * p.count, 0), costUnknown: list.filter((p) => p.unitPrice === null).length };
}

/** « vers le haut, entre les machines n° 2 et n° 3 » (machines numérotées rangée par rangée, la première d'abord). */
export function passageWhere(v: Passage, count: number): string {
  const first = v.row === "haut" ? 0 : Math.ceil(count / 2);
  const last = v.row === "haut" ? Math.ceil(count / 2) : count - first;
  return `vers le ${v.row}, ${v.after < last ? `entre les machines n° ${first + v.after} et n° ${first + v.after + 1}` : `après la machine n° ${first + v.after}`}`;
}

/** « Le collecteur de X sort à angle droit vers le haut, entre les machines n° 2 et n° 3 ». */
export function passageText(v: Passage & { widened?: boolean }, count: number, item: string): string {
  return `Le collecteur de ${item} sort à angle droit ${passageWhere(v, count)}${v.widened ? " (écartées d'une case pour ouvrir le passage)" : ""}`;
}

export type PassageOption = { item: string; passage: Passage; widens: boolean; plan: ModulePlan };

/**
 * Les passages possibles du collecteur central d'une double rangée (non repliée), pour chaque ressource :
 * le même module refait avec ce passage. `widens` : le module est plus large ou plus haut qu'avant (à
 * proposer en option, la place passant d'abord).
 */
export function passageOptions(plan: ModulePlan, req: ModuleRequest, entry: PortsEntry | null, wikiSize: { w: number; l: number } | null, cat: Catalog, name: Namer = (id) => id, items?: string[]): PassageOption[] {
  if (plan.template !== "double rangée" || plan.folds > 1 || !plan.config) return [];
  const perRow = Math.ceil(req.count / 2);
  const rows: [Passage["row"], number][] = [["haut", perRow], ["bas", req.count - perRow]];
  const out: PassageOption[] = [];
  for (const n of plan.nets) {
    if (n.line !== null || (items && !items.includes(n.item))) continue;
    for (const [row, size] of rows)
      for (let after = 1; after <= size; after++) {
        const passage = { row, after };
        const p = redesign(plan, { ...req, passages: { ...req.passages, [n.item]: passage } }, entry, wikiSize, cat, name);
        if (!p || !p.nets.some((x) => x.item === n.item && x.via)) continue;
        out.push({ item: n.item, passage, widens: p.width > plan.width || p.height > plan.height, plan: p });
      }
  }
  return out;
}

/** Ordre complet des critères : ceux demandés (sans doublon), puis les autres dans l'ordre par défaut. */
export function normalPriority(p: PoseCriterion[] | undefined): PoseCriterion[] {
  const seen = [...new Set((p ?? []).filter((k) => POSE_CRITERIA.includes(k)))];
  return [...seen, ...POSE_CRITERIA.filter((k) => !seen.includes(k))];
}

/** La même demande pour `n` machines (débits au prorata) : sert à comparer les dispositions vite. */
function scaleRequest(req: ModuleRequest, n: number): ModuleRequest {
  if (n === req.count) return req;
  const k = n / req.count;
  return { ...req, count: n, inputs: req.inputs.map((f) => ({ ...f, perMin: f.perMin * k })), outputs: req.outputs.map((f) => ({ ...f, perMin: f.perMin * k })) };
}

function finish(l: Layout, req: ModuleRequest, portsKnown: boolean, cat: Catalog, problems: Problem[], name: Namer): ModulePlan {
  const netOf = new Map(l.nets.map((n) => [n.id, n]));
  const power = placePoles(l, req, cat, name);
  // Passages : le tuyau traverse la file de poteaux de son côté, jusqu'au bord du module.
  {
    const ext = extentOf(l);
    const top = Math.min(ext.minY, ...power.poles.map((p) => p.y));
    const bottom = Math.max(ext.maxY, ...power.poles.map((p) => p.y + p.h - 1));
    for (const n of l.nets) {
      if (!n.via || !n.end) continue;
      let to = n.end.dir === "N" ? top : bottom;
      // Bout sur un croisement : une case de plus, pour que le tuyau vers les voisins s'y raccorde simplement.
      if (to === n.end.y && (l.grid.get(n.end) as { cross?: unknown } | undefined)?.cross) to += n.end.dir === "N" ? -1 : 1;
      if (to === n.end.y) continue;
      const x = n.end.x;
      const [a, b] = [Math.min(n.end.y, to), Math.max(n.end.y, to)];
      if (power.poles.some((p) => x >= p.x && x < p.x + p.w && p.y <= b && p.y + p.h - 1 >= a)) {
        problems.push({ level: "erreur", message: `Le passage de ${name(n.item)} est bouché par un poteau.` });
        continue;
      }
      l.grid.straight(n.end, { x, y: to }, n.id);
      l.grid.link({ x, y: to }, n.end.dir, n.id);
      n.end = { ...n.end, y: to };
    }
  }
  const pieces: PlacedPiece[] = [];
  for (const [k, o] of l.grid.cells) {
    if (o.kind !== "tuyau") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    if (o.cross) {
      const kinds = new Set([netOf.get(o.net)?.kind, netOf.get(o.cross.net)?.kind]);
      const piece = kinds.size > 1 ? cat.crossings.mixte : kinds.has("fluide") ? cat.crossings.fluide : cat.crossings.objet;
      pieces.push({ x, y, net: o.net, crossNet: o.cross.net, role: "croisement", links: [...o.links], crossLinks: [...o.cross.links], pieceId: piece?.id ?? null });
      continue;
    }
    const role = ROLE_OF(o.links);
    const set = netOf.get(o.net)?.pipe;
    pieces.push({ x, y, net: o.net, role, links: [...o.links], pieceId: set ? set.pieces[role === "croisement" ? "droit" : role].id : null });
  }
  // Dimensions : tout ce qui est posé, poteaux compris.
  const ext = extentOf(l);
  const minX = Math.min(ext.minX, ...power.poles.map((p) => p.x));
  const viaEnds = l.nets.flatMap((n) => (n.via && n.end ? [n.end.y] : []));
  const minY = Math.min(ext.minY, ...power.poles.map((p) => p.y), ...viaEnds);
  const maxX = Math.max(ext.maxX, ...power.poles.map((p) => p.x + p.w - 1));
  const maxY = Math.max(ext.maxY, ...power.poles.map((p) => p.y + p.h - 1), ...viaEnds);
  // Coordonnées ramenées à (0, 0).
  const shift = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.x - minX, y: o.y - minY });
  const machines = l.machines.map((m) => ({
    ...shift(m),
    cells: m.cells.map(shift),
    ports: m.ports.map((p) => ({ ...p, cell: shift(p.cell) })),
    power: m.power.map(shift),
  }));
  const nets = l.nets.map((n) => ({ ...n, lane: n.lane ? { y: n.lane.y - minY, x0: n.lane.x0 - minX, x1: n.lane.x1 - minX } : null, end: n.end ? shift(n.end) : null, ...(n.via ? { via: { ...n.via, x: n.via.x - minX } } : {}) }));

  // Liste des pièces et coût.
  const { parts: list, cost, costUnknown } = countParts(req, pieces, power.poles, cat, name, problems);
  const crossings = pieces.filter((p) => p.role === "croisement").length;
  const portCells = new Set(l.machines.flatMap((m) => m.ports.map((p) => `${p.cell.x},${p.cell.y}`)));
  const atPorts = pieces.filter((p) => p.role === "croisement" && portCells.has(`${p.x},${p.y}`)).length;
  const assumptions = [...cat.assumptions];
  if (!portsKnown) assumptions.unshift("Ports supposés (bâtiment pas encore relevé) : entrées à gauche, sorties à droite. Relève-le dans Données → Éditeur de bâtiments.");
  const order = [
    `Poser les ${req.count} ${name(req.machine)} en ${l.template}${l.template === "double rangée" ? " (la seconde tournée d'un demi-tour, ports face à face)" : ""}.`,
    ...nets.map((n) => `Collecteur ${n.role === "entrée" ? "d'entrée" : "de sortie"} : ${name(n.item)}${n.line ? ` (n° ${n.line})` : ""}, ${n.pipe ? `tuyaux tier ${n.pipe.tier === 1 ? "I" : "III"}` : "tuyau à choisir"} (${num(n.perSec)} par seconde).`),
    ...nets.filter((n) => n.via).map((n) => `${passageText(n.via!, req.count, name(n.item))}.`),
    `Raccorder chaque port à son collecteur${crossings ? `, avec ${crossings} croisement(s)` : ""}.`,
    ...(atPorts
      ? [`${atPorts} croisement(s) sont collés à un port : ses deux tuyaux se relient à la machine ; dans l'onglet 3 du mode construction, dirige chaque vecteur vers la bonne entrée ou sortie.`]
      : []),
    ...(power.poles.length ? [`Poser ${power.poles.length} ${power.pole!.name} ${new Set(power.poles.map((p) => p.y)).size > 1 ? "au-dessus et au-dessous" : "le long"} du module, et relier chaque prise.`] : []),
  ];
  return {
    machine: req.machine,
    count: req.count,
    template: l.template,
    folds: 1,
    rot: l.rot,
    portsKnown,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    machines,
    pieces: pieces.map(shift),
    nets,
    poles: power.poles.map(shift),
    parts: list,
    cost,
    costUnknown,
    problems: [...problems, ...power.problems],
    assumptions,
    order,
    priority: normalPriority(req.priority),
    other: null,
  };
}


/** Demande de module pour une étape du plan (machines simples ; ni arbres ni installations composées). */
export function requestFromStep(
  s: { machine: string; machines: number; machineKind: string; parts?: unknown; item: string; demandPerMin: number; energyAvg: number | null; inputs: { item: string; perMin: number }[]; byproducts: { item: string; perMin: number }[] },
  isFluid: (item: string) => boolean,
  machineCost: number | null,
): ModuleRequest | null {
  if (s.machineKind === "farm" || s.parts || s.machines < 1) return null;
  return {
    machine: s.machine,
    count: s.machines,
    inputs: s.inputs.map((f) => ({ item: f.item, perMin: f.perMin, fluid: isFluid(f.item) })),
    outputs: [{ item: s.item, perMin: s.demandPerMin, fluid: isFluid(s.item) }, ...s.byproducts.map((f) => ({ item: f.item, perMin: f.perMin, fluid: isFluid(f.item) }))],
    powerMFps: s.energyAvg !== null ? s.energyAvg / s.machines : null,
    machineCost,
  };
}
