// Canevas de l'éditeur de graphe (G2) : parties pures (tracé des liaisons, « Ranger »). Les gestes
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
import { arrangeGraph, edgePath, NODE_W } from "./graph-view.ts";

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

describe("Ranger", () => {
  const heights = new Map(graph.nodes.map((n, i) => [n.id, 100 + (i % 3) * 40]));
  const moves = arrangeGraph(graph, data, world, heights, balanceGraph(graph, data, world));
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
