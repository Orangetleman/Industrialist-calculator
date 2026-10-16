// Liaisons des tuyaux (S4, « Afficher les liaisons ») : pour chaque pièce, le vecteur vers chaque pièce voisine
// reliée et vers les ports, dans le sens du flux, comme l'onglet 3 en jeu. Pur, sans DOM.
//
// Les pièces reliées forment un arbre (un collecteur, ses branches vers les ports, le tuyau vers les voisins).
// Les bouts qui ne mènent à aucune pièce sont des « terminaux » : une source (port de sortie d'une machine,
// arrivée d'un module) ou un puits (port d'entrée, départ). Une liaison va du côté qui a les sources vers le
// côté qui a les puits ; si les deux côtés ont les deux (boucle), son sens n'est pas tracé.

import type { FactoryPlan } from "./factory.ts";
import { OPPOSITE, STEP, type Dir } from "./geometry.ts";
import type { ModulePlan } from "./module.ts";

/** Une pièce : son réseau et ses liaisons ; un croisement porte un second réseau (`crossNet`). */
export type FlowPiece = { x: number; y: number; net: string; links: readonly Dir[]; crossNet?: string; crossLinks?: readonly Dir[] };
/** Vecteur d'une liaison, en cases (le centre d'une case est à x + 0,5). */
export type FlowArrow = { net: string; x1: number; y1: number; x2: number; y2: number };
/** Ce qu'il y a au bout d'une liaison qui ne mène à aucune pièce : le flux en sort (source), y entre (puits), ou on ne sait pas. */
export type FlowEnd = "source" | "puits" | null;

type Node = { x: number; y: number; net: string; links: readonly Dir[]; src: number; sink: number; ends: { d: Dir; t: "source" | "puits" }[] };

/**
 * Vecteurs de toutes les liaisons. `group` dit quels réseaux se raccordent entre eux (la même ressource : un
 * collecteur de module et le tuyau de l'usine qui s'y branche) ; `end` classe un bout libre.
 */
export function flowArrows(pieces: readonly FlowPiece[], group: (net: string) => string, end: (net: string, x: number, y: number, d: Dir) => FlowEnd): FlowArrow[] {
  const nodes: Node[] = [];
  const at = new Map<string, Node[]>();
  for (const p of pieces) {
    const layers: [string, readonly Dir[]][] = [[p.net, p.links]];
    if (p.crossNet) layers.push([p.crossNet, p.crossLinks ?? []]);
    for (const [net, links] of layers) {
      const n: Node = { x: p.x, y: p.y, net, links, src: 0, sink: 0, ends: [] };
      nodes.push(n);
      const k = `${p.x},${p.y}`;
      at.set(k, [...(at.get(k) ?? []), n]);
    }
  }
  // Voisins : la pièce d'à côté qui a la liaison opposée, du même réseau de préférence, sinon de la même ressource.
  const adj = new Map<Node, Node[]>(nodes.map((n) => [n, []]));
  for (const n of nodes)
    for (const d of n.links) {
      const there = at.get(`${n.x + STEP[d].x},${n.y + STEP[d].y}`) ?? [];
      const back = there.filter((m) => m.links.includes(OPPOSITE[d]));
      const m = back.find((q) => q.net === n.net) ?? back.find((q) => group(q.net) === group(n.net));
      if (m) adj.get(n)!.push(m);
      else {
        const t = end(n.net, n.x, n.y, d);
        if (t) {
          n.ends.push({ d, t });
          if (t === "source") n.src++;
          else n.sink++;
        }
      }
    }
  const out: FlowArrow[] = [];
  const c = (n: Node) => ({ x: n.x + 0.5, y: n.y + 0.5 });
  const seen = new Set<Node>();
  for (const root of nodes) {
    if (seen.has(root)) continue;
    // Arbre couvrant (parcours en largeur) ; les liaisons hors de l'arbre (boucles) restent sans sens.
    const order: Node[] = [root];
    const parent = new Map<Node, Node | null>([[root, null]]);
    seen.add(root);
    for (let i = 0; i < order.length; i++)
      for (const m of adj.get(order[i]!)!) {
        if (seen.has(m)) continue;
        seen.add(m);
        parent.set(m, order[i]!);
        order.push(m);
      }
    const sub = new Map<Node, { src: number; sink: number }>(order.map((n) => [n, { src: n.src, sink: n.sink }]));
    for (let i = order.length - 1; i > 0; i--) {
      const n = order[i]!;
      const s = sub.get(parent.get(n)!)!;
      s.src += sub.get(n)!.src;
      s.sink += sub.get(n)!.sink;
    }
    const tot = sub.get(root)!;
    for (const n of order) {
      const p = parent.get(n);
      if (p) {
        const inner = sub.get(n)!;
        const outer = { src: tot.src - inner.src, sink: tot.sink - inner.sink };
        const up = inner.src > 0 && outer.sink > 0; // du côté de n vers le parent
        const down = outer.src > 0 && inner.sink > 0;
        if (up && !down) out.push({ net: n.net, x1: c(n).x, y1: c(n).y, x2: c(p).x, y2: c(p).y });
        else if (down && !up) out.push({ net: p.net, x1: c(p).x, y1: c(p).y, x2: c(n).x, y2: c(n).y });
      }
      for (const e of n.ends) {
        const b = { x: c(n).x + STEP[e.d].x / 2, y: c(n).y + STEP[e.d].y / 2 };
        out.push(e.t === "source" ? { net: n.net, x1: b.x, y1: b.y, x2: c(n).x, y2: c(n).y } : { net: n.net, x1: c(n).x, y1: c(n).y, x2: b.x, y2: b.y });
      }
    }
  }
  return out;
}

/** Les pièces d'une grille (cases « x,y » → tuyau), pour `flowArrows`. */
export function gridPieces(cells: ReadonlyMap<string, { kind: string; net?: string; links?: ReadonlySet<Dir>; cross?: { net: string; links: ReadonlySet<Dir> } }>): FlowPiece[] {
  const out: FlowPiece[] = [];
  for (const [k, o] of cells) {
    if (o.kind !== "tuyau" || !o.net || !o.links) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    out.push({ x, y, net: o.net, links: [...o.links], ...(o.cross ? { crossNet: o.cross.net, crossLinks: [...o.cross.links] } : {}) });
  }
  return out;
}

/** Une entrée va vers la machine (puits) et vient du raccord (source) ; une sortie, l'inverse. */
const byRole = (role: "entrée" | "sortie", toMachine: boolean): FlowEnd => ((role === "entrée") === toMachine ? "puits" : "source");

/** Bouts libres d'un module seul : une liaison vers une machine est un port (puits pour une entrée), sinon le raccord du module. */
export function moduleEnd(m: Pick<ModulePlan, "machines" | "nets">): (net: string, x: number, y: number, d: Dir) => FlowEnd {
  const machine = new Set(m.machines.flatMap((q) => q.cells.map((c) => `${c.x},${c.y}`)));
  const role = new Map(m.nets.map((n) => [n.id, n.role]));
  return (net, x, y, d) => {
    const r = role.get(net);
    return r ? byRole(r, machine.has(`${x + STEP[d].x},${y + STEP[d].y}`)) : null;
  };
}

/** Vecteurs d'un module seul (plan de pose d'une étape). */
export function moduleFlows(m: Pick<ModulePlan, "machines" | "nets" | "pieces">): FlowArrow[] {
  return flowArrows(m.pieces, (net) => net.replace(/#\d+$/, ""), moduleEnd(m));
}

/** Un vecteur de l'usine, avec sa ressource (pour n'afficher que celle qu'on a sélectionnée). */
export type FactoryArrow = FlowArrow & { item: string };

/**
 * Vecteurs de toute l'usine : tuyaux entre modules et, en mode recalculé, collecteurs des modules (ils sont dans
 * la grille de l'usine) ; en mode module par module, ceux de chaque module, tourné et placé.
 */
export function factoryFlows(f: Pick<FactoryPlan, "cells" | "nets" | "boxes" | "full">): FactoryArrow[] {
  const inter = new Map(f.nets.map((n) => [n.id, n]));
  const box = new Map(f.boxes.map((b) => [b.key, b]));
  // Collecteur d'un module dans la grille : « étape~réseau ».
  const modNet = (net: string) => {
    const i = net.indexOf("~");
    return i < 0 ? null : (box.get(net.slice(0, i))?.mod?.nets.find((n) => n.id === net.slice(i + 1)) ?? null);
  };
  const item = (net: string) => inter.get(net)?.item ?? modNet(net)?.item ?? net;
  const end = (net: string, x: number, y: number, d: Dir): FlowEnd => {
    const o = f.cells.get(`${x + STEP[d].x},${y + STEP[d].y}`);
    const owner = o?.kind === "bloc" ? o.owner : null;
    const n = inter.get(net);
    if (n) return owner === n.from ? "source" : owner && n.to.includes(owner) ? "puits" : null;
    const m = modNet(net);
    return m ? byRole(m.role, !!owner) : null;
  };
  const out: FactoryArrow[] = flowArrows(gridPieces(f.cells), item, end).map((a) => ({ ...a, item: item(a.net) }));
  if (!f.full)
    for (const b of f.boxes) {
      if (!b.mod) continue;
      const items = new Map(b.mod.nets.map((n) => [n.id, n.item]));
      for (const a of moduleFlows(b.mod)) out.push({ net: `${b.key}~${a.net}`, item: items.get(a.net) ?? a.net, x1: a.x1 + b.x, y1: a.y1 + b.y, x2: a.x2 + b.x, y2: a.y2 + b.y });
    }
  return out;
}
