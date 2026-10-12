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
};

export type Net = {
  item: string;
  kind: PipeKind;
  role: "entrée" | "sortie";
  perSec: number;
  pipe: PipeSet | null;
  /** Côté du collecteur : au-dessus ou au-dessous des machines (rangée du haut pour la double rangée). */
  lane: { y: number; x0: number; x1: number } | null;
  /** Raccord vers l'extérieur du module (arrivée d'une entrée, départ d'une sortie). */
  end: { x: number; y: number; dir: Dir } | null;
};

/** Une pièce de tuyau par case ; un croisement porte deux réseaux (`links` pour `net`, `crossLinks` pour `crossNet`). */
export type PlacedPiece = { x: number; y: number; net: string; role: PieceRole; links: Dir[]; pieceId: string | null; crossNet?: string; crossLinks?: Dir[] };
export type PlacedPole = { x: number; y: number; w: number; h: number; pole: string; covers: string[] };
export type Problem = { level: "erreur" | "attention"; message: string };

export type ModulePlan = {
  machine: string;
  count: number;
  template: "rangée" | "double rangée";
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
};

/** Nombre pour les messages : deux décimales au plus, virgule décimale. */
const num = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");

type Assign = { port: number; item: string; role: "entrée" | "sortie"; kind: PipeKind };

/** Associe chaque ressource à un port du bon type (objet/fluide) et du bon sens. */
export type Namer = (id: string) => string;

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
  req.inputs.forEach((f, i) => ports.push({ type: f.fluid ? "fluide" : "objet", direction: "entrée", side: "gauche", cell: 1 + i, stub: 1 }));
  req.outputs.forEach((f, i) => ports.push({ type: f.fluid ? "fluide" : "objet", direction: "sortie", side: "droite", cell: 1 + i, stub: 1 }));
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
function layout(entry: Pick<PortsEntry, "footprint" | "ports">, assign: Assign[], req: ModuleRequest, rot: Rot, double: boolean, gapExtra: number, cat: Catalog, name: Namer): Layout | null {
  const problems: Problem[] = [];
  const probe = place("m", req.machine, entry, 0, 0, rot);
  const used = new Map(assign.map((a) => [a.port, a]));
  const pipePorts = probe.ports.filter((p) => used.has(p.index));
  const sideCount = (f: Dir) => pipePorts.filter((p) => p.facing === f).length;
  const stubOut = (f: Dir) => Math.max(0, ...probe.cells.map((c) => (f === "E" ? c.x - (probe.w - 1) : f === "W" ? -c.x : f === "S" ? c.y - (probe.h - 1) : -c.y)));
  const gap = sideCount("E") + sideCount("W") ? stubOut("E") + stubOut("W") + sideCount("E") + sideCount("W") + gapExtra : gapExtra;
  const perRow = double ? Math.ceil(req.count / 2) : req.count;
  const pitch = probe.w + gap;

  // Collecteurs : chaque ressource du côté où sont la plupart de ses ports (nord ou sud de la rangée).
  const items = [...new Set(assign.map((a) => a.item))];
  const sideOf = new Map<string, "haut" | "bas">();
  for (const it of items) {
    const ps = pipePorts.filter((p) => used.get(p.index)!.item === it);
    const north = ps.filter((p) => p.facing === "N").length;
    const south = ps.filter((p) => p.facing === "S").length;
    sideOf.set(it, double ? "bas" : north > south ? "haut" : "bas");
  }
  const above = items.filter((it) => sideOf.get(it) === "haut");
  const below = items.filter((it) => sideOf.get(it) === "bas");
  // Une rangée de raccord (les cases qui touchent les ports), puis un collecteur par ressource.
  const touchN = sideCount("N") ? stubOut("N") + 1 : 0;
  const touchS = sideCount("S") ? stubOut("S") + 1 : 0;
  const y0 = above.length + touchN; // haut de la (première) rangée
  const laneBelow0 = y0 + probe.h + touchS;
  // Double rangée : la seconde rangée est tournée d'un demi-tour, ports vers le collecteur central.
  const rot2 = ((rot + 2) % 4) as Rot;
  const probe2 = place("m", req.machine, entry, 0, 0, rot2);
  const touchN2 = probe2.ports.some((p) => used.has(p.index) && p.facing === "N") ? Math.max(0, ...probe2.cells.map((c) => -c.y)) + 1 : 0;
  const row2y = laneBelow0 + below.length + touchN2;

  const grid = new Grid();
  const machines: Placed[] = [];
  const x0 = 1; // colonne 0 : arrivée des collecteurs d'entrée
  for (let i = 0; i < req.count; i++) {
    const second = double && i >= perRow;
    const k = second ? i - perRow : i;
    const pm = place(`m${i + 1}`, req.machine, entry, x0 + k * pitch, second ? row2y : y0, second ? rot2 : rot);
    machines.push(pm);
    for (const c of pm.cells) {
      if (grid.get(c)) return null;
      grid.block(c, pm.id);
    }
  }
  const allPorts = machines.flatMap((m) => m.ports.filter((p) => used.has(p.index)).map((p) => ({ m, p, a: used.get(p.index)! })));
  for (const { p, a } of allPorts) {
    if (grid.get(p.cell)) return null;
    grid.reserve(p.cell, a.item);
  }
  const xMax = Math.max(...machines.map((m) => m.x + m.w), ...allPorts.map((q) => q.p.cell.x + 1));
  const yMax = Math.max(...machines.map((m) => m.y + m.h), ...allPorts.map((q) => q.p.cell.y + 1), laneBelow0 + below.length);
  const bounds: Bounds = { x0: 0, y0: 0, x1: xMax, y1: Math.max(yMax, laneBelow0 + below.length) + 1 };

  const nets: Net[] = items.map((it) => {
    const a = assign.find((x) => x.item === it)!;
    const flow = (a.role === "entrée" ? req.inputs : req.outputs).find((f) => f.item === it)!;
    const perSec = flow.perMin / 60;
    const pipe = pipeFor(cat, a.kind, perSec);
    if (!pipe) problems.push({ level: "erreur", message: `${name(it)} : ${num(perSec)} par seconde, au-delà du tuyau le plus rapide (120/s) : il faut plusieurs collecteurs en parallèle (pas encore proposé).` });
    return { item: it, kind: a.kind, role: a.role, perSec, pipe, lane: null, end: null };
  });
  // Collecteurs droits : les entrées arrivent par la gauche (colonne 0), les sorties partent à droite.
  const laneRow = (it: string) => (sideOf.get(it) === "haut" ? above.length - 1 - above.indexOf(it) : laneBelow0 + below.indexOf(it));
  for (const n of nets) {
    const xs = allPorts.filter((q) => q.a.item === n.item).map((q) => q.p.cell.x);
    const y = laneRow(n.item);
    const lane = n.role === "entrée" ? { y, x0: 0, x1: Math.max(...xs) } : { y, x0: Math.min(...xs), x1: bounds.x1 };
    for (let x = lane.x0; x <= lane.x1; x++) if (grid.get({ x, y })) return null;
    grid.straight({ x: lane.x0, y }, { x: lane.x1, y }, n.item);
    grid.link({ x: n.role === "entrée" ? lane.x0 : lane.x1, y }, n.role === "entrée" ? "W" : "E", n.item); // arrivée ou départ
    n.lane = lane;
    n.end = n.role === "entrée" ? { x: lane.x0, y, dir: "W" } : { x: lane.x1, y, dir: "E" };
  }
  // Raccords : du port vers le collecteur, les plus proches d'abord.
  const order = [...allPorts].sort((a, b) => Math.abs(a.p.cell.y - laneRow(a.a.item)) - Math.abs(b.p.cell.y - laneRow(b.a.item)) || a.p.cell.x - b.p.cell.x);
  for (const { m, p, a } of order) {
    const lane = nets.find((n) => n.item === a.item)!.lane!;
    const h = (c: Cell) => Math.abs(c.y - lane.y) + Math.max(0, lane.x0 - c.x, c.x - lane.x1);
    if (!route(grid, a.item, p.cell, OPPOSITE[p.facing], bounds, h)) {
      problems.push({ level: "erreur", message: `Machine ${m.id.slice(1)} : impossible de raccorder le port ${a.role === "entrée" ? "d'entrée" : "de sortie"} (${name(a.item)}) à son collecteur.` });
      return { grid, machines, nets, problems, bounds, template: double ? "double rangée" : "rangée", rot };
    }
  }
  return { grid, machines, nets, problems, bounds, template: double ? "double rangée" : "rangée", rot };
}

/**
 * Poteaux : une file au-dessus du module et, si besoin, une au-dessous (double rangée) ; chaque
 * prise va à la file la plus proche, puis les poteaux sont placés pour que toutes soient à portée.
 */
function placePoles(l: Layout, req: ModuleRequest, cat: Catalog, name: Namer): { poles: PlacedPole[]; problems: Problem[]; pole: Catalog["poles"][number] | null } {
  const plugs = l.machines.flatMap((m) => m.power.filter((p) => p.type === "énergie" && p.direction !== "sortie").map((p) => ({ m: m.id, x: p.x, y: p.y })));
  if (!plugs.length) return { poles: [], problems: [], pole: null };
  const total = (req.powerMFps ?? 0) * l.machines.length;
  // Distribution : le moins cher des poteaux dont un nœud porte une machine. Si le module consomme
  // plus qu'un nœud, un avertissement propose plusieurs lignes ou un poteau plus fort à l'arrivée.
  const pole = cat.poles.filter((p) => p.perNodeMFps >= (req.powerMFps ?? 0)).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0] ?? null;
  if (!pole) return { poles: [], problems: [{ level: "attention", message: "Aucun poteau connu ne porte la consommation d'une machine." }], pole: null };
  const problems: Problem[] = [];
  const ys = [...l.grid.cells.keys()].map((k) => Number(k.split(",")[1]));
  const rows = [Math.min(...ys) - pole.size.h, Math.max(...ys) + 1]; // haut de chaque file
  const R = pole.rangeTiles;
  const poles: PlacedPole[] = [];
  const dist = (p: { y: number }, r: number) => Math.abs(p.y - (r + pole.size.h / 2));
  rows.forEach((py, ri) => {
    const cy = py + pole.size.h / 2;
    const mine = plugs.filter((p) => (ri === 0 ? dist(p, rows[0]!) <= dist(p, rows[1]!) : dist(p, rows[1]!) < dist(p, rows[0]!)));
    const spans = mine.map((p) => {
      const dy = Math.abs(p.y - cy);
      const r = dy <= R ? Math.sqrt(R * R - dy * dy) : -1;
      return { ...p, lo: p.x - r, hi: p.x + r, ok: r >= 0 };
    });
    for (const s of spans.filter((s) => !s.ok)) problems.push({ level: "attention", message: `Machine ${s.m.slice(1)} : prise à plus de ${num(R)} cases de la file de poteaux.` });
    const todo = spans.filter((s) => s.ok).sort((a, b) => a.hi - b.hi);
    const covered = new Set<number>();
    const row: PlacedPole[] = [];
    for (let i = 0; i < todo.length; i++) {
      if (covered.has(i)) continue;
      const cx = todo[i]!.hi;
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
      while (row[i]!.x - row[i - 1]!.x > R) row.splice(i, 0, { x: row[i - 1]!.x + Math.floor(R), y: py, w: pole.size.w, h: pole.size.h, pole: pole.id, covers: [] });
    }
    poles.push(...row);
  });
  if (new Set(poles.map((p) => p.y)).size === 2 && rows[1]! - rows[0]! > R) {
    problems.push({ level: "attention", message: `Les deux files de poteaux sont à ${rows[1]! - rows[0]!} cases l'une de l'autre, plus que la portée (${num(R)}) : relie-les par un poteau sur le côté du module.` });
  }
  if (total > pole.perNodeMFps) {
    const lines = Math.ceil(total / pole.perNodeMFps - 1e-9);
    problems.push({
      level: "attention",
      message: `Le module consomme ${Math.round(total).toLocaleString("fr-FR")} MF/s, plus qu'un nœud de ${name(pole.id)} (${pole.perNodeMFps.toLocaleString("fr-FR")} MF/s) : prévois ${lines} lignes d'alimentation, ou un poteau plus fort à l'arrivée.`,
    });
  }
  return { poles, problems, pole };
}

/** Meilleur module pour une étape : gabarits × orientations, le plus compact puis le moins cher. */
export function designModule(req: ModuleRequest, entry: PortsEntry | null, wikiSize: { w: number; l: number } | null, cat: Catalog, name: Namer = (id) => id): ModulePlan {
  const portsKnown = !!entry?.footprint;
  const e = portsKnown ? entry! : assumedEntry(wikiSize, req);
  const { assign, problems: assignProblems } = assignPorts(e, req, name);
  const candidates: ModulePlan[] = [];
  for (const double of req.count >= 2 ? [false, true] : [false]) {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      for (let extra = 0; extra <= 2; extra++) {
        const l = layout(e, assign, req, rot, double, extra, cat, name);
        if (!l) continue;
        const plan = finish(l, req, portsKnown, cat, [...assignProblems, ...l.problems], name);
        candidates.push(plan);
        if (!plan.problems.some((p) => p.level === "erreur")) break;
      }
    }
  }
  const score = (p: ModulePlan) => [p.problems.filter((x) => x.level === "erreur").length, p.width * p.height, p.cost] as const;
  candidates.sort((a, b) => {
    const [x, y] = [score(a), score(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  return (
    candidates[0] ?? {
      machine: req.machine,
      count: req.count,
      template: "rangée",
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
      problems: [...assignProblems, { level: "erreur", message: "Aucune disposition trouvée." }],
      assumptions: cat.assumptions,
      order: [],
    }
  );
}

function finish(l: Layout, req: ModuleRequest, portsKnown: boolean, cat: Catalog, problems: Problem[], name: Namer): ModulePlan {
  const netOf = new Map(l.nets.map((n) => [n.item, n]));
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
  const power = placePoles(l, req, cat, name);
  // Dimensions : tout ce qui est posé, poteaux compris.
  const cells: Cell[] = [...l.grid.cells.keys()].map((k) => {
    const [x, y] = k.split(",").map(Number) as [number, number];
    return { x, y };
  });
  for (const p of power.poles) for (let i = 0; i < p.w; i++) for (let j = 0; j < p.h; j++) cells.push({ x: p.x + i, y: p.y + j });
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));
  // Coordonnées ramenées à (0, 0).
  const shift = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.x - minX, y: o.y - minY });
  const machines = l.machines.map((m) => ({
    ...shift(m),
    cells: m.cells.map(shift),
    ports: m.ports.map((p) => ({ ...p, cell: shift(p.cell) })),
    power: m.power.map(shift),
  }));
  const nets = l.nets.map((n) => ({ ...n, lane: n.lane ? { y: n.lane.y - minY, x0: n.lane.x0 - minX, x1: n.lane.x1 - minX } : null, end: n.end ? shift(n.end) : null }));

  // Liste des pièces et coût.
  const parts = new Map<string, { id: string; name: string; count: number; unitPrice: number | null }>();
  const addPart = (id: string, name: string, price: number | null, n = 1) => {
    const p = parts.get(id) ?? { id, name, count: 0, unitPrice: price };
    p.count += n;
    parts.set(id, p);
  };
  addPart(req.machine, name(req.machine), req.machineCost, req.count);
  const allPieces = [...cat.pipes.flatMap((s) => Object.values(s.pieces)), ...Object.values(cat.crossings).filter((x): x is NonNullable<typeof x> => !!x)];
  for (const pc of pieces) {
    const def = allPieces.find((x) => x.id === pc.pieceId);
    if (def) addPart(def.id, def.name, def.price);
    else problems.push({ level: "erreur", message: `Pièce inconnue pour un ${pc.role} de ${name(pc.net)}.` });
  }
  if (power.pole) addPart(power.pole.id, power.pole.name, power.pole.price, power.poles.length);
  const list = [...parts.values()];
  const cost = list.reduce((s, p) => s + (p.unitPrice ?? 0) * p.count, 0);
  const costUnknown = list.filter((p) => p.unitPrice === null).length;
  const crossings = pieces.filter((p) => p.role === "croisement").length;
  const assumptions = [...cat.assumptions];
  if (!portsKnown) assumptions.unshift("Ports supposés (bâtiment pas encore relevé) : entrées à gauche, sorties à droite. Relève-le dans Données → Éditeur de bâtiments.");
  const order = [
    `Poser les ${req.count} ${name(req.machine)} en ${l.template}${l.template === "double rangée" ? " (la seconde tournée d'un demi-tour, ports face à face)" : ""}.`,
    ...nets.map((n) => `Collecteur ${n.role === "entrée" ? "d'entrée" : "de sortie"} : ${name(n.item)}, ${n.pipe ? `tuyaux tier ${n.pipe.tier === 1 ? "I" : "III"}` : "tuyau à choisir"} (${num(n.perSec)} par seconde).`),
    `Raccorder chaque port à son collecteur${crossings ? `, avec ${crossings} croisement(s)` : ""}.`,
    ...(power.poles.length ? [`Poser ${power.poles.length} ${power.pole!.name} ${new Set(power.poles.map((p) => p.y)).size > 1 ? "au-dessus et au-dessous" : "le long"} du module, et relier chaque prise.`] : []),
  ];
  return {
    machine: req.machine,
    count: req.count,
    template: l.template,
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
