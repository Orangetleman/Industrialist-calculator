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
import { cellsOf, geo, type CrossPair, type Layout, type Placed, type Route, type Wire } from "../sandbox/layout";
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
  at = new Map<string, number>();
  sb: SbCatalog;
  /** Paires à relier par câble (bâtiments gardés par référence : les numéros changent quand une pièce est remplacée). */
  elec: [Placed, Placed][] = [];
  /** Machines posées, par « module|machine ». */
  machines = new Map<string, Placed>();
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
    if (this.at.has(k)) { const i = this.at.get(k)!; this.blocks.splice(i, 1); this.blocks.forEach((b, j) => (b.u = j)); this.at.forEach((v, kk) => v > i && this.at.set(kk, v - 1)); this.at.delete(k); }
    if (!id) { this.skipped.push("?"); return; }
    if (!this.sb.blocks.has(id)) { this.skipped.push(id); return; }
    const all = new Set([...links, ...(crossLinks ?? [])]);
    const mixed = this.sb.blocks.get(id)?.pipe?.kind === "m";
    const b: Placed = { u: this.blocks.length, id, x, y, r: mixed ? (fluidLinks?.some((d) => d === "E" || d === "W") ? 1 : 0) : pipeRot(this.sb, id, x, y, all) };
    if (crossLinks) b.pair = pairOf(links);
    this.at.set(k, this.blocks.length);
    this.blocks.push(b);
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
  }
  /** Cases prises par les bâtiments posés. */
  taken(): Set<string> {
    const s = new Set<string>();
    for (const b of this.blocks) for (const [x, y] of cellsOf(this.sb.blocks.get(b.id)!, b)) s.add(`${x},${y}`);
    return s;
  }
  /** Câbles des paires notées, posés comme dans le bac à sable ; une paire hors de portée reste sans câble. */
  wires(): Wire[] {
    const out: Wire[] = [];
    for (const [a, b] of this.elec) {
      const r = powerWires(this.sb, { blocks: this.blocks, wires: out }, a.u, b.u);
      if (r && "wires" in r) out.push(...r.wires.filter((w) => !out.some((o) => o.a === w.a && o.ia === w.ia && o.b === w.b && o.ib === w.ib)));
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
  const starts: number[] = [];
  for (const { m, x, y } of list) {
    starts.push(b.blocks.length);
    b.module(m, x, y);
  }
  return { layout: mergeStraights(sb, orientPipes(sb, { blocks: b.blocks, wires: b.wires() })), width: Math.max(...list.map((o) => o.x + o.m.width)), height: Math.max(...list.map((o) => o.y + o.m.height)), skipped: b.skipped, starts };
}

export function layoutFromModule(m: ModulePlan, sb: SbCatalog): Converted {
  const b = new Builder(sb);
  b.module(m, 0, 0);
  return { layout: mergeStraights(sb, orientPipes(sb, { blocks: b.blocks, wires: b.wires() })), width: m.width, height: m.height, skipped: b.skipped };
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
    const n = f.nets.find((x) => x.id === net);
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
  const routes = (f.touches ?? []).map((t) => touchRoute(sb, b.blocks, t)).filter((r): r is Route => !!r);
  return { layout: mergeStraights(sb, orientPipes(sb, { blocks: b.blocks, wires: b.wires(), ...(routes.length ? { routes } : {}) })), width: f.W, height: f.H, skipped: b.skipped };
}

/**
 * Poteaux de l'usine (le plan donne leur centre, le bac à sable le coin haut-gauche), reliés aux machines de leurs
 * prises, puis l'arbre de câbles avec ses relais, répartis sur la ligne, chacun à la case libre la plus proche.
 */
function poles(f: FactoryPlan, b: Builder) {
  const at = new Map<string, Placed>(), boxOf = new Map(f.boxes.map((x) => [x.key, x]));
  const put = (id: string, w: number, h: number, cx: number, cy: number): Placed | null => {
    const taken = b.taken(), x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    const free = (x: number, y: number) => { for (let a = 0; a < w; a++) for (let c = 0; c < h; c++) if (taken.has(`${x + a},${y + c}`)) return false; return true; };
    for (let r = 0; r <= 4; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(x0 + dx, y0 + dy)) return b.add({ id, x: x0 + dx, y: y0 + dy, r: 0 });
    return null;
  };
  for (const p of f.poleNodes) {
    const pb = put(p.type.id, p.type.size.w, p.type.size.h, p.x, p.y);
    if (!pb) continue;
    at.set(p.id, pb);
    // Prise → machine qui la porte : la plus proche de la prise parmi les machines de son module.
    for (const plug of p.plugs) {
      const box = boxOf.get(plug.key);
      if (!box?.mod) continue;
      let best: Placed | null = null, bd = Infinity;
      for (const m of box.mod.machines) {
        const mb = b.machines.get(`${box.key}|${m.id}`);
        if (!mb) continue;
        const d = Math.min(...m.cells.map((c) => Math.hypot(box.x + c.x - plug.x, box.y + c.y - plug.y)));
        if (d < bd) { bd = d; best = mb; }
      }
      if (best && !b.elec.some(([x, y]) => x === pb && y === best)) b.elec.push([pb, best]);
    }
  }
  for (const l of f.links) {
    const from = at.get(l.from.id), to = at.get(l.to.id);
    if (!from || !to) continue; // l'arrivée (« feed ») n'est pas un bâtiment
    let prev = from;
    for (let k = 1; k <= l.relays; k++) {
      const t = k / (l.relays + 1), r = put(l.relayType.id, l.relayType.size.w, l.relayType.size.h, l.from.x + (l.to.x - l.from.x) * t, l.from.y + (l.to.y - l.from.y) * t);
      if (r) { b.elec.push([prev, r]); prev = r; }
    }
    b.elec.push([prev, to]);
  }
}
