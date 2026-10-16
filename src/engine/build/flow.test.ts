// Liaisons des tuyaux (S4) : un vecteur par liaison, dans le sens du flux.
import { describe, expect, it } from "vitest";
import itemsJson from "../../../data/items.json";
import machinesJson from "../../../data/machines.json";
import recipesJson from "../../../data/recipes.json";
import researchJson from "../../../data/research.json";
import energyJson from "../../../data/energy.json";
import overridesJson from "../../../data/overrides.json";
import portsJson from "../../../data/ports.json";
import logisticsJson from "../../../data/logistics.json";
import powerJson from "../../../data/power.json";
import relevesJson from "../../../data/releves.json";
import { buildGameData, type RawFiles } from "../data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../extension-types.ts";
import type { OverridesFile } from "../types.ts";
import { solve } from "../solve.ts";
import { buildCatalog } from "./catalog.ts";
import { designFactory, factoryInput } from "./factory.ts";
import { factoryFlows, flowArrows, gridPieces, moduleFlows, type FlowArrow, type FlowPiece } from "./flow.ts";
import { STEP, type Dir } from "./geometry.ts";
import { designModule, requestFromStep, type ModuleRequest } from "./module.ts";

const PORTS = (portsJson as unknown as PortsFile).machines;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()) };
const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
const isFluid = (id: string) => !!data.items.get(id)?.isFluid;

/** Chaque liaison de chaque pièce a son vecteur : entre deux centres (il passe par le bord commun) ou jusqu'au bord. */
function uncovered(pieces: FlowPiece[], arrows: FlowArrow[]): string[] {
  const mids = new Set<string>();
  const k = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
  for (const a of arrows) {
    mids.add(k((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2));
    mids.add(k(a.x1, a.y1));
    mids.add(k(a.x2, a.y2));
  }
  const miss: string[] = [];
  for (const p of pieces)
    for (const [net, links] of [[p.net, p.links], [p.crossNet, p.crossLinks ?? []]] as [string, Dir[]][])
      for (const d of links) if (!mids.has(k(p.x + 0.5 + STEP[d].x / 2, p.y + 0.5 + STEP[d].y / 2))) miss.push(`${net} ${p.x},${p.y} ${d}`);
  return miss;
}

describe("liaisons des tuyaux", () => {
  it("une ligne : de la source au puits, chaque vecteur dans le même sens", () => {
    const pieces: FlowPiece[] = [0, 1, 2].map((x) => ({ x, y: 0, net: "a", links: ["W", "E"] as Dir[] }));
    const arrows = flowArrows(pieces, (n) => n, (_n, x, _y, d) => (x === 0 && d === "W" ? "source" : x === 2 && d === "E" ? "puits" : null));
    expect(arrows).toHaveLength(4);
    expect(arrows.every((a) => a.x2 > a.x1 && a.y1 === a.y2)).toBe(true);
    expect(uncovered(pieces, arrows)).toEqual([]);
  });

  it("un té : la source alimente deux puits ; une boucle sans sens n'est pas tracée", () => {
    // (0,0) source à l'ouest → (1,0) té → (2,0) puits à l'est, et (1,1) puits au sud.
    const pieces: FlowPiece[] = [
      { x: 0, y: 0, net: "a", links: ["W", "E"] },
      { x: 1, y: 0, net: "a", links: ["W", "E", "S"] },
      { x: 2, y: 0, net: "a", links: ["W", "E"] },
      { x: 1, y: 1, net: "a", links: ["N", "S"] },
    ];
    const end = (_n: string, x: number, y: number, d: Dir) => (x === 0 && d === "W" ? "source" : (x === 2 && d === "E") || (y === 1 && d === "S") ? "puits" : null);
    const arrows = flowArrows(pieces, (n) => n, end);
    expect(arrows.find((a) => a.x1 === 1.5 && a.y1 === 0.5 && a.x2 === 1.5 && a.y2 === 1.5)).toBeTruthy();
    expect(arrows.find((a) => a.x1 === 1.5 && a.x2 === 2.5)).toBeTruthy();
    expect(uncovered(pieces, arrows)).toEqual([]);
    // Chaque côté a une source et un puits : la liaison du milieu reste sans sens (seuls les bouts sont tracés).
    const two: FlowPiece[] = [
      { x: 0, y: 0, net: "a", links: ["W", "E", "N"] },
      { x: 1, y: 0, net: "a", links: ["W", "E", "S"] },
    ];
    const both = flowArrows(two, (n) => n, (_n, x, _y, d) => (d === "W" || d === "E" ? "source" : "puits"));
    expect(both).toHaveLength(4);
    expect(both.some((a) => a.x1 === 0.5 && a.x2 === 1.5)).toBe(false);
  });

  it("modules de la chaîne du Crankshaft : chaque liaison a son vecteur, l'entrée va vers les machines", () => {
    const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
    let n = 0;
    for (const s of plan.steps) {
      const m = data.machines.get(s.machine);
      if (!m || s.machineKind === "farm") continue;
      const mod = designModule({ ...requestFromStep(s, isFluid, m.cost), priority: ["forme", "place", "prix", "pieces"] } as ModuleRequest, PORTS[s.machine] ?? null, m.size, cat, name);
      const arrows = moduleFlows(mod);
      expect(uncovered(mod.pieces, arrows), s.key).toEqual([]);
      // Chaque vecteur qui touche une machine : vers elle pour une entrée, depuis elle pour une sortie.
      const cells = new Set(mod.machines.flatMap((q) => q.cells.map((c) => `${c.x},${c.y}`)));
      const into = (x: number, y: number, a: FlowArrow) => cells.has(`${Math.floor(x + (a.x2 - a.x1) * 0.25)},${Math.floor(y + (a.y2 - a.y1) * 0.25)}`);
      for (const a of arrows) {
        const role = mod.nets.find((x) => x.id === a.net)?.role;
        if (into(a.x2, a.y2, a)) expect(role, `${s.key} ${a.net}`).toBe("entrée");
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it("toute l'usine, module par module : chaque tuyau entre modules part du fournisseur", () => {
    const plan = solve(data, all, { item: "steel-plate", ratePerMin: 20, criterion: "energy", tiers: false });
    const input = factoryInput(plan, { name, isFluid, machine: (id) => data.machines.get(id) ?? null, ports: PORTS }, cat, { w: 160, h: 110 }, { priority: ["forme", "place", "prix", "pieces"] });
    const f = designFactory(input);
    expect(f.nets.length).toBeGreaterThan(0);
    const arrows = factoryFlows(f);
    expect(uncovered(gridPieces(f.cells), arrows)).toEqual([]);
    for (const net of f.nets) {
      const mine = arrows.filter((a) => a.net === net.id);
      expect(mine.length, net.id).toBeGreaterThan(0);
      const from = f.boxes.find((b) => b.key === net.from)!;
      const inBox = (b: typeof from, x: number, y: number) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
      // Aucun vecteur n'entre dans le module fournisseur ; chaque client en reçoit un.
      expect(mine.some((a) => inBox(from, a.x2 + (a.x2 - a.x1) * 0.01, a.y2 + (a.y2 - a.y1) * 0.01)), net.id).toBe(false);
      for (const to of net.to) {
        const b = f.boxes.find((x) => x.key === to)!;
        expect(mine.some((a) => inBox(b, a.x2 + (a.x2 - a.x1) * 0.01, a.y2 + (a.y2 - a.y1) * 0.01)), `${net.id} → ${to}`).toBe(true);
      }
    }
    // Les collecteurs des modules, placés et tournés, ont aussi leurs vecteurs.
    expect(arrows.some((a) => a.net.includes("~"))).toBe(true);
  }, 120_000);
});
