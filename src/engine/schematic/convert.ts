/**
 * Plans du site → montage du bac à sable (lot S55, R25) : un module ou une usine devient un `Layout`, qu'on écrit
 * ensuite en .msch (`msch.ts`). Un seul format d'import / export pour tout le site.
 *
 * Les machines gardent leur rotation ; une pièce de tuyau prend la rotation dont les ports relevés tombent sur
 * ses liaisons (un coude ou un té relevé dans un seul sens). Les pièces sans bâtiment connu sont comptées dans
 * `skipped` et laissées de côté.
 */
import type { Dir, SbCatalog } from "../sandbox/catalog";
import { geo, type CrossPair, type Layout, type Placed } from "../sandbox/layout";
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
  constructor(sb: SbCatalog) { this.sb = sb; }
  add(b: Omit<Placed, "u">) {
    if (!this.sb.blocks.has(b.id)) { this.skipped.push(b.id); return; }
    this.blocks.push({ ...b, u: this.blocks.length });
  }
  /** Une pièce par case : une pièce posée plus tard sur la même case remplace la précédente. */
  piece(id: string | null, x: number, y: number, links: Dir[], crossLinks?: Dir[]) {
    const k = `${x},${y}`;
    if (this.at.has(k)) { const i = this.at.get(k)!; this.blocks.splice(i, 1); this.blocks.forEach((b, j) => (b.u = j)); this.at.forEach((v, kk) => v > i && this.at.set(kk, v - 1)); this.at.delete(k); }
    if (!id) { this.skipped.push("?"); return; }
    if (!this.sb.blocks.has(id)) { this.skipped.push(id); return; }
    const all = new Set([...links, ...(crossLinks ?? [])]);
    const b: Placed = { u: this.blocks.length, id, x, y, r: pipeRot(this.sb, id, x, y, all) };
    if (crossLinks) b.pair = pairOf(links);
    this.at.set(k, this.blocks.length);
    this.blocks.push(b);
  }
  module(m: ModulePlan, ox: number, oy: number) {
    for (const p of m.machines) this.add({ id: p.machine, x: ox + p.x, y: oy + p.y, r: p.rot });
    for (const p of m.poles) this.add({ id: p.pole, x: ox + p.x, y: oy + p.y, r: 0 });
    for (const p of m.pieces as PlacedPiece[]) this.piece(p.pieceId, ox + p.x, oy + p.y, p.links, p.crossLinks);
  }
}

export function layoutFromModule(m: ModulePlan, sb: SbCatalog): Converted {
  const b = new Builder(sb);
  b.module(m, 0, 0);
  return { layout: { blocks: b.blocks, wires: [] }, width: m.width, height: m.height, skipped: b.skipped };
}

/**
 * Une usine : chaque module à sa place, ses poteaux, puis les tuyaux entre modules (pièce choisie comme dans
 * le module : le tuyau le moins cher qui porte le débit de la liaison).
 */
export function layoutFromFactory(f: FactoryPlan, sb: SbCatalog, cat: Catalog, isFluid: (item: string) => boolean, tier3Only = false): Converted {
  const b = new Builder(sb);
  for (const box of f.boxes) if (box.mod) b.module(box.mod, box.x, box.y);
  for (const p of f.poleNodes) b.add({ id: p.type.id, x: p.x, y: p.y, r: 0 });
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
      b.piece(piece?.id ?? null, x, y, [...o.links], [...o.cross.links]);
    } else {
      const role = roleOf(o.links), set = setOf(o.net);
      b.piece(set ? set.pieces[role === "croisement" ? "droit" : role].id : null, x, y, [...o.links]);
    }
  }
  return { layout: { blocks: b.blocks, wires: [] }, width: f.W, height: f.H, skipped: b.skipped };
}
