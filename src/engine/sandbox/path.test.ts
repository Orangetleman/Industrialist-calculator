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
import { applyPlan, buildSandboxCatalog, computeSandbox, crossId, droitLens, explicitPlan, links, pipePath, pipePlan, rectPlan, straightPath, type Layout, type Plan } from "./index.ts";

const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const cat = buildSandboxCatalog(data, { ports: portsJson as unknown as PortsFile, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson });

const empty = (): Layout => ({ blocks: [], wires: [] });
const one = (id: string, x: number, y: number, r = 0): Layout => ({ blocks: [{ u: 1, id, x, y, r }], wires: [] });
const ids = (p: Plan | null) => p!.add.map((a) => a.id).sort();

describe("tracé des tuyaux", () => {
  it("longueurs auto : 20 cases de tier III = 5 Long Pipe2", () => {
    expect(droitLens(cat, "o3").map((o) => o.L)).toEqual([4, 2, 1]);
    const p = pipePlan(cat, empty(), straightPath([0, 0], [0, 19]), "o3")!;
    expect(ids(p)).toEqual(Array(5).fill("long-pipe2"));
    expect(p.add.map((a) => a.y)).toEqual([0, 4, 8, 12, 16]);
    // À l'horizontale, les mêmes pièces tournées d'un quart de tour.
    expect(pipePlan(cat, empty(), straightPath([0, 0], [7, 0]), "o3")!.add).toEqual([{ id: "long-pipe2", x: 0, y: 0, r: 1 }, { id: "long-pipe2", x: 4, y: 0, r: 1 }]);
    // Longueur auto décochée : pas plus long que la pièce choisie.
    expect(ids(pipePlan(cat, empty(), straightPath([0, 0], [0, 3]), "o3", 2))).toEqual(["pipe2", "pipe2"]);
  });

  it("la gomme coupe un Long Pipe2 en Pipe2 + Short Pipe2", () => {
    const L = one("long-pipe2", 0, 0);
    const p = rectPlan(cat, L, 0, 0, 0, 0);
    expect(p.remove).toEqual([1]);
    expect(p.add).toEqual(expect.arrayContaining([{ id: "pipe2", x: 0, y: 1, r: 0 }, { id: "short-pipe2", x: 0, y: 3, r: 0 }]));
    expect(p.add).toHaveLength(2);
  });

  it("un té se pose seul en arrivant sur un tuyau, le reste du tuyau s'adapte", () => {
    const L = one("long-pipe2", 0, 0);
    const p = pipePlan(cat, L, straightPath([3, 1], [0, 1]), "o3")!;
    expect(p.remove).toEqual([1]);
    const te = p.add.find((a) => a.x === 0 && a.y === 1)!;
    expect(te.id).toBe("pipe-junction2");
    expect(p.add.find((a) => a.x === 0 && a.y === 0)!.id).toBe("short-pipe2");
    expect(p.add.find((a) => a.x === 0 && a.y === 2)!.id).toBe("pipe2");
    // Le té se raccorde de ses trois côtés.
    const L2 = applyPlan(L, p), u = L2.blocks.find((b) => b.x === 0 && b.y === 1)!.u;
    expect(links(cat, L2).filter((l) => l.a === u || l.b === u)).toHaveLength(3);
  });

  it("refusé à travers une machine ; le chemin A* la contourne", () => {
    const L = one("press", 0, 0); // 4 × 2 cases
    expect(pipePlan(cat, L, straightPath([-2, 1], [6, 1]), "o1")).toBeNull();
    const path = pipePath(cat, L, [-2, 1], [6, 1], "o")!;
    expect(path.some(([x, y]) => x >= 0 && x <= 3 && y >= 0 && y <= 1)).toBe(false);
    expect(pipePlan(cat, L, path, "o1")).not.toBeNull();
  });

  it("croisements : traversée tout droit, jamais de pièce rusty", () => {
    expect(crossId(cat, "o")).toBe("pipe-intersection");
    // Objet sur objet (tier I) : le croisement du tier III.
    const v = pipePlan(cat, empty(), straightPath([1, -1], [1, 1]), "o1")!, L = applyPlan(empty(), v);
    expect(pipePlan(cat, L, straightPath([0, 0], [2, 0]), "o1")!.add.find((a) => a.x === 1 && a.y === 0)!.id).toBe("pipe-intersection");
    // Objet sur fluide : le croisement objet × fluide, tourné pour que chaque type garde son axe.
    const F = applyPlan(empty(), pipePlan(cat, empty(), straightPath([1, -1], [1, 1]), "f3")!);
    const x = pipePlan(cat, F, straightPath([0, 0], [2, 0]), "o3")!.add.find((a) => a.x === 1 && a.y === 0)!;
    expect(x.id).toBe("fluid-pipe-and-item-intersection");
    const R = computeSandbox(cat, applyPlan(F, pipePlan(cat, F, straightPath([0, 0], [2, 0]), "o3")!));
    expect(R.alerts.map((a) => a.a.k)).not.toContain("mixed");
    // Un tuyau de l'autre type rejoint autrement que tout droit : refusé.
    expect(pipePlan(cat, F, straightPath([0, 0], [1, 0]), "o3")).toBeNull();
  });

  it("pièce non relevée (coude fluide du tier III) : posée avec ses ouvertures, à compléter", () => {
    const p = pipePlan(cat, empty(), [[0, 0], [0, 1], [1, 1]], "f3")!;
    const turn = p.add.find((a) => a.x === 0 && a.y === 1)!;
    expect(turn.id).toBe("pipe-fluid-turn2");
    expect(turn.open?.sort()).toEqual(["E", "N"]);
    expect(computeSandbox(cat, applyPlan(empty(), p)).alerts.map((a) => a.a)).toContainEqual({ k: "missing", id: "pipe-fluid-turn2" });
  });

  it("pièce posée d'un clic sur un tuyau du même type : elle le remplace, le reste s'adapte", () => {
    const L = one("long-pipe2", 0, 0);
    const p = explicitPlan(cat, L, "pipe-section2", 0, 2, 0)!;
    expect(p.remove).toEqual([1]);
    expect(ids(p)).toEqual(["pipe-section2", "pipe2", "short-pipe2"]);
    expect(explicitPlan(cat, one("press", 0, 0), "short-pipe2", 1, 1, 0)).toBeNull();
  });

  it("exemple 1 tracé : Press → Roller par le chemin A*, 30 Iron Coil/min", () => {
    let L: Layout = { blocks: [{ u: 1, id: "press", x: 0, y: 0, r: 0, choice: "press_02" }, { u: 2, id: "roller", x: 8, y: 0, r: 0 }], wires: [] };
    const path = pipePath(cat, L, [3, 2], [8, 2], "o")!;
    L = applyPlan(L, pipePlan(cat, L, path, "o1")!);
    const R = computeSandbox(cat, L);
    expect(R.machines.get(2)!.shown).toBe("roller_02");
    expect(R.stats.outs["iron-coil"]! * 60).toBeCloseTo(30, 6);
  });
});
