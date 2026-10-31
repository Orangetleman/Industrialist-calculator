// B4 (PLAN-BAC-A-SABLE.md § 5, Fluidité) : moins de 16 ms par geste à 200 machines et 2 000 cases.
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
import { applyPlan, buildSandboxCatalog, cellsOf, computeSandbox, pipePath, pipePlan, rectPlan, sandboxCache, type Layout } from "./index.ts";

const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const cat = buildSandboxCatalog(data, { ports: portsJson as unknown as PortsFile, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson });

/** L'exemple 1 (Press → Roller) répété `n` fois sur une grille de 10 colonnes. */
function bigLayout(n: number): Layout {
  let L: Layout = { blocks: [], wires: [], routes: [] };
  for (let k = 0; k < n; k++) {
    const ox = (k % 10) * 14, oy = Math.floor(k / 10) * 5;
    L = applyPlan(L, { remove: [], add: [{ id: "press", x: ox, y: oy, r: 0, choice: "press_02" }, { id: "roller", x: ox + 8, y: oy, r: 0, choice: null }] });
    const path: [number, number][] = [];
    for (let x = 3; x <= 8; x++) path.push([ox + x, oy + 2]);
    L = applyPlan(L, pipePlan(cat, L, path, "o1")!);
  }
  return L;
}

/**
 * Durée médiane de `n` essais (après un premier à vide), en ms. La médiane, et non le pire : pendant `npm test`,
 * les autres fichiers de tests tournent en parallèle et un essai isolé peut être freiné par eux.
 */
const median = (f: (i: number) => void, n = 21) => {
  f(-1);
  const ms: number[] = [];
  for (let i = 0; i < n; i++) { const t0 = performance.now(); f(i); ms.push(performance.now() - t0); }
  return ms.sort((a, b) => a - b)[n >> 1]!;
};

describe("fluidité (B4)", () => {
  const L0 = bigLayout(100);
  it("le montage d'essai : 200 machines, plus de 2 000 cases", () => {
    expect(L0.blocks.filter((b) => !cat.blocks.get(b.id)!.pipe).length).toBe(200);
    expect(L0.blocks.reduce((a, b) => a + cellsOf(cat.blocks.get(b.id)!, b).length, 0)).toBeGreaterThanOrEqual(2000);
  });

  it("un geste (tuyau glissé, posé, puis calculé) prend moins de 16 ms", () => {
    const cache = sandboxCache();
    computeSandbox(cat, L0, undefined, cache);
    const ms = median((i) => {
      const k = Math.abs(i * 37) % 100, ox = (k % 10) * 14, oy = Math.floor(k / 10) * 5;
      // On coupe le tuyau d'un îlot à la gomme, puis on le retrace en glissant (20 cases de glisser).
      let L = applyPlan(L0, rectPlan(cat, L0, ox + 5, oy + 2, ox + 6, oy + 2));
      for (let s = 0; s < 20; s++) pipePath(cat, L, [ox + 4, oy + 2], [ox + 7, oy + 2 + (s % 3)], "o");
      const p = pipePath(cat, L, [ox + 4, oy + 2], [ox + 7, oy + 2], "o")!;
      L = applyPlan(L, pipePlan(cat, L, p, "o1")!);
      computeSandbox(cat, L, undefined, cache);
    });
    expect(ms / 20).toBeLessThan(16); // par case de glisser
    const one = median((i) => {
      const k = Math.abs(i * 37) % 100, ox = (k % 10) * 14, oy = Math.floor(k / 10) * 5;
      const L = applyPlan(L0, rectPlan(cat, L0, ox + 5, oy + 2, ox + 6, oy + 2));
      computeSandbox(cat, L, undefined, cache);
    });
    expect(one).toBeLessThan(16);
  });

  it("le cache ne recalcule que l'îlot touché", () => {
    const cache = sandboxCache();
    computeSandbox(cat, L0, undefined, cache);
    expect(cache.runs).toBe(100);
    const L = applyPlan(L0, rectPlan(cat, L0, 5, 2, 6, 2));
    const before = cache.runs;
    const R = computeSandbox(cat, L, undefined, cache);
    expect(cache.runs - before).toBe(2); // l'îlot coupé devient deux îlots
    expect(R).toEqual(computeSandbox(cat, L));
  });
});
