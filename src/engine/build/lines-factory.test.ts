// Lignes doublées, fusions et Overflow Gates dans l'usine : chaque ligne relie sa sortie à son arrivée, aucun tuyau en trop.
import { describe, expect, it } from "vitest";
import energyJson from "../../../data/energy.json";
import itemsJson from "../../../data/items.json";
import logisticsJson from "../../../data/logistics.json";
import machinesJson from "../../../data/machines.json";
import overridesJson from "../../../data/overrides.json";
import portsJson from "../../../data/ports.json";
import powerJson from "../../../data/power.json";
import recipesJson from "../../../data/recipes.json";
import relevesJson from "../../../data/releves.json";
import researchJson from "../../../data/research.json";
import { buildGameData, type RawFiles } from "../data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../extension-types.ts";
import { addMachines, solve } from "../solve.ts";
import { balanceGraph, planToGraph } from "../graph/index.ts";
import type { OverridesFile } from "../types.ts";
import { buildCatalog } from "./catalog.ts";
import { designFactory, factoryInput, lineExtras, type FactoryPlan } from "./factory.ts";
import { OPPOSITE, STEP } from "./geometry.ts";

const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const base = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(base, [overridesJson as unknown as OverridesFile]);
const ports = (portsJson as unknown as PortsFile).machines;

export function factory(item: string, rate: number, full: boolean, gate: boolean, criterion = "area"): FactoryPlan {
  const plan = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 } as never, { item, ratePerMin: rate, criterion, then: ["machines", "energy", "cost", "pollution", "raw", "steps"], tiers: false } as never);
  return designFactory(
    factoryInput(plan, { name: (id) => data.items.get(id)?.name ?? id, isFluid: (id) => !!data.items.get(id)?.isFluid, machine: (id) => data.machines.get(id) ?? null, ports, gate }, cat, { w: 100_000, h: 100_000 }, { priority: ["place", "forme", "prix", "pieces"] }, { full }),
  );
}

/** Chaque réseau d'une ressource à lignes touche sa sortie (module, Gate ou tuyau voisin) et son client. */
export function checkLines(u: FactoryPlan, item: string): void {
  const layer = new Map<string, { net: string; links: Set<string> }[]>();
  for (const [k, o] of u.cells) if (o.kind === "tuyau") layer.set(k, [{ net: o.net, links: o.links as Set<string> }, ...(o.cross ? [{ net: o.cross.net, links: o.cross.links as Set<string> }] : [])]);
  const nets = u.nets.filter((n) => n.item === item);
  const ids = new Set(nets.map((n) => n.id));
  for (const n of nets) {
    // Le réseau peut être coupé par sa Gate : chaque bout est parcouru.
    const starts = [...layer].flatMap(([k, ls]) => ls.flatMap((l, q) => (l.net === n.id ? [`${k}/${q}`] : [])));
    expect(starts.length, `${n.id} : aucun tuyau`).toBeGreaterThan(0);
    const owners = new Set<string>();
    const same = (net: string) => ids.has(net) || net.includes(`~${item}`);
    const seen = new Set(starts);
    const todo = [...starts];
    while (todo.length) {
      const [k, q] = todo.pop()!.split("/") as [string, string];
      const [x, y] = k.split(",").map(Number) as [number, number];
      for (const d of layer.get(k)![Number(q)]!.links) {
        const st = STEP[d as keyof typeof STEP];
        const nk = `${x + st.x},${y + st.y}`;
        const o = u.cells.get(nk);
        if (o?.kind === "bloc") owners.add(o.owner);
        layer.get(nk)?.forEach((l, m) => {
          if (!l.links.has(OPPOSITE[d as keyof typeof OPPOSITE]) || !same(l.net)) return;
          if (ids.has(l.net) && l.net !== n.id) {
            owners.add("~voisin");
            return;
          }
          const id = `${nk}/${m}`;
          if (seen.has(id)) return;
          seen.add(id);
          todo.push(id);
        });
      }
    }
    for (const t of n.to) expect([...owners], `${n.id} → ${t}`).toContain(t);
    expect(owners.has(n.from) || owners.has("~gate") || owners.has("~voisin"), `${n.id} sans source`).toBe(true);
  }
}

describe("usine : lignes de steam de Chair", () => {
  for (const full of [false, true])
    for (const [rate, gate] of [[60, true], [90, true], [90, false], [120, true], [120, false]] as const)
      it(`${rate}/min, ${full ? "usine entière" : "par module"}, Overflow Gate ${gate ? "permise" : "non"}`, () => {
        const u = factory("chair", rate, full, gate);
        const steam = u.nets.filter((n) => n.item === "steam");
        expect(u.problems.filter((p) => p.item === "Steam")).toEqual([]);
        expect(steam.length).toBeGreaterThan(1);
        for (const n of steam) expect(n.perMin / 60).toBeLessThanOrEqual(120);
        checkLines(u, "steam");
        if (!gate) expect(u.gates).toEqual([]);
      }, 120_000);
});

describe("usine : fusion de deux sources", () => {
  it.each([false, true])("60 Cut Oak Log/min, usine entière %s : les deux sources d'eau rejoignent leurs clients", (full) => {
    const u = factory("cut-oak-log", 60, full, true, "machines");
    expect(u.problems.filter((p) => p.item === "Water" && p.to !== "oak-log")).toEqual([]);
  }, 60_000);
});

describe("machine ajoutée : plan, graphe et usine d'accord", () => {
  it("90 Chair/min sans Overflow Gate : 8 Boiler partout, totaux compris", () => {
    const look = { name: (id: string) => data.items.get(id)?.name ?? id, isFluid: (id: string) => !!data.items.get(id)?.isFluid, machine: (id: string) => data.machines.get(id) ?? null, ports, gate: false };
    const base0 = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 } as never, { item: "chair", ratePerMin: 90, criterion: "area", then: ["machines", "energy", "cost", "pollution", "raw", "steps"], tiers: false } as never);
    const ex = lineExtras(base0, look, cat);
    expect(ex).toEqual([{ key: "steam", n: 1, item: "steam" }]);
    const plan = addMachines(base0, look.name, ex);
    const [a, b] = [base0.steps.find((s) => s.key === "steam")!, plan.steps.find((s) => s.key === "steam")!];
    expect(b.machines).toBe(a.machines + 1);
    expect(plan.totals.machines).toBe(base0.totals.machines + 1);
    expect(plan.totals.buildCost - base0.totals.buildCost).toBeCloseTo(a.buildCost! / a.machines);
    expect(plan.totals.footprint - base0.totals.footprint).toBeCloseTo(a.footprint! / a.machines);
    expect(lineExtras(plan, look, cat)).toEqual([]); // rien de plus à ajouter
    // L'usine part du même nombre, et le graphe l'affiche.
    const input = factoryInput(plan, look, cat, { w: 1e5, h: 1e5 }, { priority: ["place", "forme", "prix", "pieces"] });
    expect(input.steps.find((s) => s.key === "steam")!.req!.count).toBe(b.machines);
    expect(input.lines!.every((l) => !l.extra)).toBe(true);
    const { graph, nodeOfStep } = planToGraph(plan);
    const bal = balanceGraph(graph, data, { pollutionPct: 0, extra: { [b.recipeId]: { exact: b.machinesExact, whole: b.machines } } });
    expect(bal.nodes.get(nodeOfStep.get("steam")!)!.machinesWhole).toBe(b.machines);
  });
});

describe("Item Overflow Gate", () => {
  it("permise pour les objets, par type", () => {
    const plan = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 } as never, { item: "chair", ratePerMin: 60, criterion: "area", tiers: false } as never);
    const of = (gate: boolean | { objet: boolean; fluide: boolean }) => Object.keys(factoryInput(plan, { name: (id) => id, isFluid: (id) => !!data.items.get(id)?.isFluid, machine: (id) => data.machines.get(id) ?? null, ports, gate }, cat, { w: 1e5, h: 1e5 }, { priority: ["place", "forme", "prix", "pieces"] }).gates ?? {}).sort();
    expect(of(true)).toEqual(["fluide", "objet"]);
    expect(of({ objet: true, fluide: false })).toEqual(["objet"]);
    expect(of(false)).toEqual([]);
  });
});
