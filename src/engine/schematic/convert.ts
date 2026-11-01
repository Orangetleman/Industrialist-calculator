/**
 * Plans du site → montage du bac à sable (lot S55, R25) : un module ou une usine devient un `Layout`, qu'on écrit
 * ensuite en .msch (`msch.ts`). Un seul format d'import / export pour tout le site.
 *
 * Les machines gardent leur rotation ; une pièce de tuyau prend la rotation dont les ports relevés tombent sur
 * ses liaisons (un coude ou un té relevé dans un seul sens). Les pièces sans bâtiment connu sont comptées dans
 * `skipped` et laissées de côté.
 *
 * Électricité : chaque poteau est relié aux machines qu'il couvre, et les poteaux entre eux (l'arbre de câbles de
 * l'usine, relais compris), avec les mêmes câbles que dans le bac à sable (`powerWires`).
 */
import type { Dir, SbCatalog } from "../sandbox/catalog";
import { cellsOf, dims, geo, type CrossPair, type Layout, type Placed, type Route, type Wire } from "../sandbox/layout";
import { powerWires } from "../sandbox/wires";
import { orientPipes } from "../sandbox/orient";
import { mergeStraights } from "../sandbox/path";
import { pipeFor, type Catalog, type PieceRole } from "../build/catalog";
import type { ModulePlan, PlacedPiece } from "../build/module";
import type { FactoryPlan } from "../build/factory";

export type Converted = { layout: Layout; width: number; height: number; skipped: string[] };

const OPP: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };
const roleOf = (l: Set<Dir>): PieceRole => (l.size >= 4 ? "croix" : l.size === 3 ? "té" : l.size === 2 && OPP[[...l][0]!] === [...l][1] ? "droit" : l.size === 2 ? "coude" : "droit");

/** Rotation d'une pièce dont les ports de côté couvrent exactement `links` (0 si aucune). */
function pipeRot(sb: SbCatalog, id: string, x: number, y: number, links: Set<Dir>): number {
  const def = sb.blocks.get(id);
  if (!def?.geo) return 0;
  for (let r = 0; r < 4; r++) {
    const g = geo(def, { u: 0, id, x, y, r });
    const sides = new Set(g?.ports.filter((p) => p.dir !== "top").map((p) => p.dir as Dir));
    if (sides.size === links.size && [...links].every((d) => sides.has(d))) return r;
  }
  return 0;
}

/** Voies d'un croisement : 0 tout droit, sinon la paire de virages qui contient les liaisons du premier réseau. */
function pairOf(links: Dir[]): CrossPair {
  const s = new Set(links);
  if ((s.has("E") && s.has("W")) || (s.has("N") && s.has("S"))) return 0;
  return (s.has("N") && s.has("E")) || (s.has("S") && s.has("W")) ? 1 : 2;
}

class Builder {
  blocks: Placed[] = [];
  skipped: string[] = [];
  /** Pièce de tuyau de chaque case ; celles remplacées sont écartées à la fin (`list`), sans renuméroter à chaque fois. */
  at = new Map<string, Placed>();
  removed = new Set<Placed>();
  sb: SbCatalog;
  /** Paires à relier par câble (bâtiments gardés par référence : les numéros changent quand une pièce est remplacée). */
  elec: [Placed, Placed][] = [];
  /** Machines posées, par « module|machine ». */
  machines = new Map<string, Placed>();
  /**
   * Ports de sortie qui servent d'entrée (le plan y amène une ressource, ce que le jeu permet) : la production en est
   * retirée, comme le joueur le règle aux boutons (`Route.off`). Pièces gardées par référence.
   */
  offs: [Placed, number, Placed][] = [];
  constructor(sb: SbCatalog) { this.sb = sb; }
  add(b: Omit<Placed, "u">): Placed | null {
    if (!this.sb.blocks.has(b.id)) { this.skipped.push(b.id); return null; }
    const p = { ...b, u: this.blocks.length };
    this.blocks.push(p);
    return p;
  }
  /**
   * Une pièce par case : une pièce posée plus tard sur la même case remplace la précédente. `fluidLinks` : pour un
   * croisement objet × fluide, les liaisons du tuyau de fluide (la pièce relevée a son fluide nord-sud).
   */
  piece(id: string | null, x: number, y: number, links: Dir[], crossLinks?: Dir[], fluidLinks?: Dir[]) {
    const k = `${x},${y}`;
    const old = this.at.get(k);
    if (old) { this.removed.add(old); this.at.delete(k); }
    if (!id) { this.skipped.push("?"); return; }
    if (!this.sb.blocks.has(id)) { this.skipped.push(id); return; }
    const all = new Set([...links, ...(crossLinks ?? [])]);
    const mixed = this.sb.blocks.get(id)?.pipe?.kind === "m";
    const b: Placed = { u: this.blocks.length, id, x, y, r: mixed ? (fluidLinks?.some((d) => d === "E" || d === "W") ? 1 : 0) : pipeRot(this.sb, id, x, y, all) };
    if (crossLinks) b.pair = pairOf(links);
    this.at.set(k, b);
    this.blocks.push(b);
  }
  /** Les bâtiments gardés, numérotés dans l'ordre. */
  list(): Placed[] {
    if (this.removed.size) { this.blocks = this.blocks.filter((b) => !this.removed.has(b)); this.removed.clear(); }
    this.blocks.forEach((b, i) => (b.u = i));
    return this.blocks;
  }
  /** Un module ; ses poteaux seulement si `poles` (l'usine pose les siens, gardés ou refaits). */
  module(m: ModulePlan, ox: number, oy: number, key = "", poles = true) {
    // Recette : celle qui produit la sortie du module (et dont les entrées arrivent au module, s'il y en a plusieurs).
    const outs = new Set(m.nets.filter((n) => n.role === "sortie").map((n) => n.item)), ins = new Set(m.nets.filter((n) => n.role === "entrée").map((n) => n.item));
    const recs = (this.sb.blocks.get(m.machine)?.recipes ?? []).filter((r) => Object.keys(r.out).some((i) => outs.has(i)));
    const choice = (recs.find((r) => Object.keys(r.in).every((i) => ins.has(i))) ?? recs[0])?.id;
    for (const p of m.machines) {
      const b = this.add({ id: p.machine, x: ox + p.x, y: oy + p.y, r: p.rot, ...(choice ? { choice } : {}) });
      if (b) this.machines.set(`${key}|${p.id}`, b);
    }
    if (poles) {
      const placed: Placed[] = [];
      for (const q of m.poles) {
        const b = this.add({ id: q.pole, x: ox + q.x, y: oy + q.y, r: 0 });
        if (!b) continue;
        for (const id of q.covers) { const mb = this.machines.get(`${key}|${id}`); if (mb) this.elec.push([b, mb]); }
        // Chaque poteau relié au plus proche des précédents : une seule chaîne par module.
        const d = (o: Placed) => Math.hypot(o.x - b.x, o.y - b.y);
        const near = placed.reduce<Placed | null>((a, o) => (!a || d(o) < d(a) ? o : a), null);
        if (near) this.elec.push([near, b]);
        placed.push(b);
      }
    }
    const fluid = (net: string) => m.nets.find((n) => n.id === net)?.kind === "fluide";
    for (const p of m.pieces as PlacedPiece[]) this.piece(p.pieceId, ox + p.x, oy + p.y, p.links, p.crossLinks, p.crossNet ? (fluid(p.net) ? p.links : fluid(p.crossNet) ? p.crossLinks : undefined) : undefined);
    const inNet = new Set(m.nets.filter((n) => n.role === "entrée").map((n) => n.id)), inAt = new Set<string>();
    for (const p of m.pieces) if (!p.crossNet && inNet.has(p.net)) inAt.add(`${ox + p.x},${oy + p.y}`);
    for (const pm of m.machines) {
      const b = this.machines.get(`${key}|${pm.id}`), d = b && this.sb.blocks.get(b.id);
      geo(d!, b!)?.ports.forEach((q, i) => {
        if (q.d !== "s" || q.cells?.length !== 1) return;
        const k = `${q.cells[0]![0] + STEP[q.dir as Dir][0]},${q.cells[0]![1] + STEP[q.dir as Dir][1]}`, pc = this.at.get(k);
        if (pc && inAt.has(k)) this.offs.push([b!, i, pc]);
      });
    }
  }
  /** Raccords retirés (voir `offs`), pour les pièces encore posées. */
  routes(): Route[] {
    this.list();
    return this.offs.filter(([, , pc]) => !this.removed.has(pc) && this.blocks[pc.u] === pc).map(([m, i, pc]) => ({ a: m.u, ia: i, b: pc.u, ib: 0, off: true as const }));
  }
  /** Retire le dernier bâtiment posé (relais essayé puis écarté). */
  drop(p: Placed) {
    if (this.blocks[this.blocks.length - 1] !== p) return;
    this.blocks.pop();
    for (const [x, y] of cellsOf(this.sb.blocks.get(p.id)!, p)) this.takenSet?.delete(`${x},${y}`);
  }
  /** Cases prises par les bâtiments posés (calculées une fois, puis tenues à jour par `put`). */
  takenSet: Set<string> | null = null;
  taken(): Set<string> {
    if (!this.takenSet) {
      this.takenSet = new Set<string>();
      for (const b of this.list()) for (const [x, y] of cellsOf(this.sb.blocks.get(b.id)!, b)) this.takenSet.add(`${x},${y}`);
    }
    return this.takenSet;
  }
  /** Câbles des paires notées, posés comme dans le bac à sable ; une paire hors de portée reste sans câble. */
  wires(): Wire[] {
    const out: Wire[] = [], seen = new Set<string>();
    this.list();
    for (const [a, b] of this.elec) {
      // Les deux bâtiments seuls : le câble va du premier au second (amont → aval), sans parcourir tout le montage.
      const r = powerWires(this.sb, { blocks: [a, b], wires: [] }, a.u, b.u);
      if (r && "wires" in r) for (const w of r.wires) { const k = `${w.a}:${w.ia}>${w.b}:${w.ib}`; if (!seen.has(k)) { seen.add(k); out.push(w); } }
    }
    return out;
  }
}

const STEP: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

/**
 * Liaison d'une étape collée (S56) : le port de sortie de la machine dont le bord touche la case (x, y) vers le sens `dir`
 * (case de la machine suivante), vers le port de la machine suivante qui lui fait face. Le flux va d'un bouton à l'autre,
 * comme le règle le joueur en jeu ; null si l'un des deux ports manque.
 */
export function touchRoute(sb: SbCatalog, blocks: Placed[], at: { x: number; y: number; dir: Dir }): Route | null {
  const from = [at.x - STEP[at.dir][0], at.y - STEP[at.dir][1]] as const;
  const portOn = (cx: number, cy: number, dir: Dir) => {
    for (const b of blocks) {
      const def = sb.blocks.get(b.id);
      if (!def || def.pipe) continue;
      const i = geo(def, b)?.ports.findIndex((p) => p.dir === dir && p.cells?.some(([x, y]) => x === cx && y === cy)) ?? -1;
      if (i >= 0) return { u: b.u, i };
    }
    return null;
  };
  const a = portOn(from[0], from[1], at.dir), b = portOn(at.x, at.y, OPP[at.dir]);
  return a && b ? { a: a.u, ia: a.i, b: b.u, ib: b.i } : null;
}

/** Plusieurs modules, chacun à sa place (S56 : étapes collées, vérifiées ensemble par le bac à sable). */
export function layoutFromModules(list: { m: ModulePlan; x: number; y: number }[], sb: SbCatalog): Converted & { starts: number[] } {
  const b = new Builder(sb);
  const firsts: number[] = [];
  for (const { m, x, y } of list) {
    firsts.push(b.blocks.length);
    b.module(m, x, y);
  }
  const heads = firsts.map((i) => b.blocks[i]), blocks = b.list();
  // Vérification seulement (pas de pièces longues) : les numéros restent dans l'ordre des modules.
  const rs = b.routes();
  return { layout: orientPipes(sb, { blocks, wires: b.wires(), ...(rs.length ? { routes: rs } : {}) }), width: Math.max(...list.map((o) => o.x + o.m.width)), height: Math.max(...list.map((o) => o.y + o.m.height)), skipped: b.skipped, starts: heads.map((h) => h?.u ?? blocks.length) };
}

export function layoutFromModule(m: ModulePlan, sb: SbCatalog): Converted {
  const b = new Builder(sb);
  b.module(m, 0, 0);
  const rs = b.routes();
  return { layout: mergeStraights(sb, orientPipes(sb, { blocks: b.list(), wires: b.wires(), ...(rs.length ? { routes: rs } : {}) })), width: m.width, height: m.height, skipped: b.skipped };
}

/**
 * Une usine : chaque module à sa place, ses poteaux, puis les tuyaux entre modules (pièce choisie comme dans
 * le module : le tuyau le moins cher qui porte le débit de la liaison).
 */
export function layoutFromFactory(f: FactoryPlan, sb: SbCatalog, cat: Catalog, isFluid: (item: string) => boolean, tier3Only = false): Converted {
  const b = new Builder(sb);
  for (const box of f.boxes) if (box.mod) b.module(box.mod, box.x, box.y, box.key, false);
  const setOf = (net: string) => {
    const [key, sub] = net.split("~");
    if (sub !== undefined) return f.boxes.find((x) => x.key === key)?.mod?.nets.find((n) => n.id === sub)?.pipe ?? null;
    // Liaison entre modules, ou évacuation d'un produit jusqu'au bord de l'usine.
    const n = f.nets.find((x) => x.id === net) ?? f.evacs.find((x) => x.id === net);
    return n ? pipeFor(cat, isFluid(n.item) ? "fluide" : "objet", n.perMin / 60, tier3Only) : null;
  };
  for (const [k, o] of f.cells) {
    if (o.kind !== "tuyau") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    if (o.cross) {
      const kinds = new Set([setOf(o.net)?.kind, setOf(o.cross.net)?.kind]);
      const piece = kinds.size > 1 ? cat.crossings.mixte : kinds.has("fluide") ? cat.crossings.fluide : cat.crossings.objet;
      b.piece(piece?.id ?? null, x, y, [...o.links], [...o.cross.links], setOf(o.net)?.kind === "fluide" ? [...o.links] : setOf(o.cross.net)?.kind === "fluide" ? [...o.cross.links] : undefined);
    } else {
      const role = roleOf(o.links), set = setOf(o.net);
      b.piece(set ? set.pieces[role === "croisement" ? "droit" : role].id : null, x, y, [...o.links]);
    }
  }
  // Étapes collées : la liaison d'un bouton à l'autre, comme le joueur la règle en jeu.
  poles(f, b);
  const routes = [...(f.touches ?? []).map((t) => touchRoute(sb, b.list(), t)).filter((r): r is Route => !!r), ...b.routes()];
  return { layout: mergeStraights(sb, orientPipes(sb, { blocks: b.list(), wires: b.wires(), ...(routes.length ? { routes } : {}) })), width: f.W, height: f.H, skipped: b.skipped };
}

/**
 * Poteaux de l'usine (le plan donne leur centre, le bac à sable le coin haut-gauche), reliés aux machines de leurs
 * prises, puis l'arbre de câbles avec ses relais, répartis sur la ligne, chacun à la case libre la plus proche.
 */
function poles(f: FactoryPlan, b: Builder) {
  const at = new Map<string, Placed>(), boxOf = new Map(f.boxes.map((x) => [x.key, x]));
  const put = (id: string, w: number, h: number, cx: number, cy: number, rad = 8): Placed | null => {
    const taken = b.taken(), x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    const free = (x: number, y: number) => { for (let a = 0; a < w; a++) for (let c = 0; c < h; c++) if (taken.has(`${x + a},${y + c}`)) return false; return true; };
    for (let r = 0; r <= rad; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(x0 + dx, y0 + dy)) {
          const nb = b.add({ id, x: x0 + dx, y: y0 + dy, r: 0 });
          if (nb) for (let a = 0; a < w; a++) for (let c = 0; c < h; c++) taken.add(`${x0 + dx + a},${y0 + dy + c}`);
          return nb;
        }
    return null;
  };
  const plugOf = new Map<string, Placed>(), paired = new Set<string>();
  for (const box of f.boxes) for (const m of box.mod?.machines ?? []) {
    const mb = b.machines.get(`${box.key}|${m.id}`);
    if (mb) for (const q of m.power) plugOf.set(`${box.x + q.x},${box.y + q.y}`, mb);
  }
  b.list(); // numéros à jour pour les clés des paires
  for (const p of f.poleNodes) {
    const pb = put(p.type.id, p.type.size.w, p.type.size.h, p.x, p.y);
    if (!pb) continue;
    at.set(p.id, pb);
    // Prise → la machine qui la porte (les prises du plan sont celles des machines).
    for (const plug of p.plugs) {
      const best = plugOf.get(`${plug.x},${plug.y}`), k = best && `${pb.u}>${best.u}`;
      if (best && !paired.has(k!)) { paired.add(k!); b.elec.push([pb, best]); }
    }
  }
  // Câbles entre poteaux : un câble tient dans la portée du poteau d'où il part (portée du bac à sable). Tant que le
  // poteau suivant est trop loin, un relais est posé sur la ligne, au plus loin que la portée permet, à la case libre
  // la plus proche (le plan compte ses relais avec sa propre mesure ; ici, on garantit que chaque câble tient).
  const mid = (q: Placed) => { const [w, h] = dims(b.sb.blocks.get(q.id)!, q.r); return { x: q.x + w / 2, y: q.y + h / 2 }; };
  // Chaque câble (prise à prise) tient dans la portée du poteau d'où il part, pas seulement la paire la plus proche.
  const fits = (a: Placed, c: Placed) => {
    const L = { blocks: [a, c], wires: [] }, r = powerWires(b.sb, L, a.u, c.u);
    if (!r || !("wires" in r)) return false;
    return r.wires.every((w) => {
      const A = w.a === a.u ? a : c, B = w.b === a.u ? a : c, R = b.sb.blocks.get(A.id)?.elec?.range;
      const pa = geo(b.sb.blocks.get(A.id)!, A)!.ports[w.ia]!, pb = geo(b.sb.blocks.get(B.id)!, B)!.ports[w.ib]!;
      return R == null || Math.hypot(pa.px! - pb.px!, pa.py! - pb.py!) <= R;
    });
  };
  // Les branches qui partent de l'arrivée électrique sont reliées entre elles : un seul réseau à brancher sur ses générateurs.
  const roots = f.links.filter((l) => l.from.id === "feed").map((l) => l.to);
  const links = [...f.links.filter((l) => l.from.id !== "feed"), ...roots.slice(1).map((t, i) => ({ ...f.links.find((l) => l.to === t)!, from: roots[i]!, to: t }))];
  // Poteau du plan sans case libre dans le bac à sable : ses câbles partent de son amont.
  const up = new Map(links.map((l) => [l.to.id, l.from.id]));
  const placedOrUp = (id: string) => { for (let k = 0; k < 50 && !at.has(id) && up.has(id); k++) id = up.get(id)!; return at.get(id); };
  for (const l of links) {
    const from = placedOrUp(l.from.id), to = at.get(l.to.id);
    if (!from || !to || from === to) continue;
    let prev = from;
    for (let k = 0; k < 60 && !fits(prev, to); k++) {
      const a = mid(prev), z = mid(to), d = Math.hypot(z.x - a.x, z.y - a.y), R = b.sb.blocks.get(prev.id)?.elec?.range ?? l.relayType.rangeCells;
      let r: Placed | null = null;
      for (const f2 of [0.85, 0.7, 0.55, 0.4, 0.25]) {
        const t = Math.min(1, (R * f2) / d), c = put(l.relayType.id, l.relayType.size.w, l.relayType.size.h, a.x + (z.x - a.x) * t, a.y + (z.y - a.y) * t, 8);
        if (!c) continue;
        if (fits(prev, c)) { r = c; break; }
        b.drop(c);
      }
      if (!r) break;
      b.elec.push([prev, r]);
      prev = r;
    }
    b.elec.push([prev, to]);
  }
}
