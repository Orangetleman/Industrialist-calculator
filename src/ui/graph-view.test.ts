// Canevas de l'éditeur de graphe (G2) : parties pures (tracé des liaisons, « Aligner »). Les gestes
// eux-mêmes se vérifient à la souris dans le navigateur (PLAN-GRAPHE.md § 6, Exigences).
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import modularJson from "../../data/modular.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import { applyCommand, balanceGraph, planToGraph } from "../engine/graph/index.ts";
import { solve } from "../engine/solve.ts";
import { arrangeGraph, GRID, NODE_W, snapGrid } from "./graph-layout.ts";
import { routeEdges, type RouteIn } from "./graph-route.ts";
import { edgePath } from "./graph-view.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as never]);
const world = { pollutionPct: 0 };
const plan = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 }, { item: "gearbox", ratePerMin: 120, tiers: false });
const { graph } = planToGraph(plan);

describe("tracé d'une liaison", () => {
  it("part exactement de la sortie et arrive exactement sur l'entrée, en segments droits", () => {
    const p = edgePath({ x: 10, y: 20 }, { x: 300, y: 90 }, 0);
    expect(p.d).toBe("M10 20H155V90H300");
    expect(p.lx).toBe(155);
  });
  it("à rebours, passe sous les nœuds", () => {
    const p = edgePath({ x: 300, y: 20 }, { x: 10, y: 90 }, 400);
    expect(p.d).toBe("M300 20H316V400H-6V90H10");
    expect(p.ly).toBe(400);
  });
});

describe("Aligner", () => {
  const heights = new Map(graph.nodes.map((n, i) => [n.id, 100 + (i % 3) * 40]));
  const moves = arrangeGraph(graph, { height: (k) => heights.get(k) ?? 120 });
  const g = applyCommand(graph, { type: "move", moves }, data, world);

  it("place chaque nœud, sans chevauchement", () => {
    expect(moves).toHaveLength(graph.nodes.length);
    for (const a of g.nodes)
      for (const b of g.nodes) {
        if (a.id >= b.id) continue;
        const ha = heights.get(a.id)!;
        const hb = heights.get(b.id)!;
        const overlap = a.x < b.x + NODE_W && b.x < a.x + NODE_W && a.y < b.y + hb && b.y < a.y + ha;
        expect(overlap, `${a.id} / ${b.id}`).toBe(false);
      }
  });
  it("de l'extraction (à gauche) à l'objectif (tout à droite) : chaque liaison va vers la droite, sauf le retour d'une boucle", () => {
    const at = new Map(g.nodes.map((n) => [n.id, n]));
    const target = at.get(g.target!.node)!;
    expect(Math.max(...g.nodes.map((n) => n.x))).toBe(target.x);
    // b atteint-il a en suivant les liaisons ? (alors a → b ferme une boucle)
    const reaches = (from: string, to: string): boolean => {
      const seen = new Set([from]);
      const stack = [from];
      while (stack.length) {
        const id = stack.pop()!;
        if (id === to) return true;
        for (const e of g.edges) if (e.from === id && !seen.has(e.to)) seen.add(e.to), stack.push(e.to);
      }
      return false;
    };
    let back = 0;
    for (const e of g.edges) {
      if (at.get(e.from)!.x < at.get(e.to)!.x) continue;
      expect(reaches(e.to, e.from), e.id).toBe(true);
      back++;
    }
    expect(back).toBeLessThan(g.edges.length / 5);
  });
});

/** Boîtes et liaisons d'un graphe rangé, prises réparties sur la hauteur comme à l'écran. */
function routed(item: string) {
  const p = planToGraph(solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 }, { item, ratePerMin: 60, tiers: false })).graph;
  const bal = balanceGraph(p, data, world);
  const rows = (id: string) => bal.nodes.get(id)!;
  const height = (id: string) => 60 + 31 * Math.max(1, rows(id).ins.length, rows(id).outs.length);
  const portY = (id: string, dir: "ins" | "outs", it2: string) => 70 + 31 * rows(id)[dir].findIndex((x) => x.item === it2);
  const g = applyCommand(p, { type: "move", moves: arrangeGraph(p, { height, portY }) }, data, world);
  const at = new Map(g.nodes.map((n) => [n.id, n]));
  const box = (id: string) => ({ x: at.get(id)!.x, y: at.get(id)!.y, w: NODE_W, h: height(id) });
  const boxes = g.nodes.map((n) => box(n.id));
  const list: RouteIn[] = g.edges.map((e) => ({
    id: e.id,
    a: { x: at.get(e.from)!.x + NODE_W, y: at.get(e.from)!.y + portY(e.from, "outs", e.item) },
    b: { x: at.get(e.to)!.x, y: at.get(e.to)!.y + portY(e.to, "ins", e.item) },
    ab: box(e.from),
    bb: box(e.to),
    from: `${e.from}:${e.item}`,
    to: `${e.to}:${e.item}`,
    lw: 70,
  }));
  return { g, boxes, list, routes: routeEdges(boxes, list, undefined, 20000) };
}

describe("Aligner : grille, liaisons séparées", () => {
  for (const item of ["gearbox", "crankshaft", "electric-motor", "lithium-battery-pack", "tire", "8x-microchip"])
    it(`${item} : sur la grille, aucune liaison sur un nœud ni sur une autre`, () => {
      const { g, boxes, list, routes } = routed(item);
      for (const n of g.nodes) expect([n.x - snapGrid(n.x), n.y - snapGrid(n.y)]).toEqual([0, 0]);
      const segs = list.flatMap((e) => {
        const r = routes.get(e.id)!.pts;
        expect(r[0]).toEqual(e.a);
        expect(r.at(-1)).toEqual(e.b);
        return r.slice(1).map((q, i) => ({ e, x0: Math.min(q.x, r[i]!.x), x1: Math.max(q.x, r[i]!.x), y0: Math.min(q.y, r[i]!.y), y1: Math.max(q.y, r[i]!.y) }));
      });
      for (const s of segs) {
        expect(s.x0 === s.x1 || s.y0 === s.y1).toBe(true);
        for (const b of boxes) expect(s.x0 < b.x + b.w && s.x1 > b.x && s.y0 < b.y + b.h && s.y1 > b.y, `${s.e.id} traverse un nœud`).toBe(false);
      }
      const over: string[] = [];
      for (let i = 0; i < segs.length; i++)
        for (let j = i + 1; j < segs.length; j++) {
          const [p, q] = [segs[i]!, segs[j]!];
          if (p.e.from === q.e.from || p.e.to === q.e.to) continue;
          const v = p.x0 === p.x1 && q.x0 === q.x1 && Math.abs(p.x0 - q.x0) < 2 && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 0;
          const h = p.y0 === p.y1 && q.y0 === q.y1 && Math.abs(p.y0 - q.y0) < 2 && Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 0;
          if (v || h) over.push(`${p.e.id} sur ${q.e.id}`);
        }
      expect(over).toEqual([]);
    });

  it("un groupe replié compte pour une boîte : ses nœuds le suivent, rien ne le chevauche", () => {
    const ids = graph.nodes.slice(2, 5).map((n) => n.id);
    let g = applyCommand(graph, { type: "group", id: "g1", name: "G", nodes: ids }, data, world);
    g = applyCommand(g, { type: "setGroup", id: "g1", collapsed: true }, data, world);
    const before = new Map(g.nodes.map((n) => [n.id, n]));
    const moves = arrangeGraph(g, { height: (k) => (k === "@g1" ? 300 : 140) });
    const at = new Map(moves.map((m) => [m.id, m]));
    const d = ids.map((id) => [at.get(id)!.x - before.get(id)!.x, at.get(id)!.y - before.get(id)!.y]);
    expect(new Set(d.map(String)).size).toBe(1);
    const corner = { x: Math.min(...ids.map((id) => at.get(id)!.x)), y: Math.min(...ids.map((id) => at.get(id)!.y)) };
    expect([corner.x % GRID, corner.y % GRID].map(Math.abs)).toEqual([0, 0]);
    const boxes = [{ ...corner, h: 300 }, ...moves.filter((m) => !ids.includes(m.id)).map((m) => ({ x: m.x, y: m.y, h: 140 }))];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i]!, boxes[j]!];
        expect(a.x < b.x + NODE_W && b.x < a.x + NODE_W && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
  });

  it("400 nœuds : tout se trace en moins de 2,5 s, un geste en moins de 250 ms", () => {
    const { boxes, list } = routed("electric-motor");
    const n = Math.ceil(400 / boxes.length);
    const H = Math.max(...boxes.map((b) => b.y + b.h)) + 200;
    const sh = <T extends { y: number }>(p: T, k: number): T => ({ ...p, y: p.y + k * H });
    const B = Array.from({ length: n }, (_, k) => boxes.map((b) => sh(b, k))).flat();
    const L = Array.from({ length: n }, (_, k) => list.map((e) => ({ ...e, id: `${e.id}c${k}`, a: sh(e.a, k), b: sh(e.b, k), ab: sh(e.ab, k), bb: sh(e.bb, k), from: `${e.from}c${k}`, to: `${e.to}c${k}` }))).flat();
    const t0 = performance.now();
    const all = routeEdges(B, L, undefined, 20000);
    const t1 = performance.now();
    // Un nœud glissé d'un cran : seules ses liaisons (et celles qu'il gêne) se retracent.
    const o = B[3]!;
    const move = <T extends { x: number; y: number }>(p: T): T => ({ ...p, y: p.y + GRID });
    const B2 = B.map((b) => (b === o ? move(b) : b));
    const L2 = L.map((e) => ({ ...e, ...(e.ab.x === o.x && e.ab.y === o.y ? { a: move(e.a), ab: move(e.ab) } : {}), ...(e.bb.x === o.x && e.bb.y === o.y ? { b: move(e.b), bb: move(e.bb) } : {}) }));
    routeEdges(B2, L2, all);
    const t2 = performance.now();
    console.log(`routage : ${B.length} nœuds, ${L.length} liaisons, ${(t1 - t0).toFixed(0)} ms ; un nœud glissé ${(t2 - t1).toFixed(0)} ms`);
    expect(t1 - t0).toBeLessThan(2500);
    expect(t2 - t1).toBeLessThan(250);
  });
});
