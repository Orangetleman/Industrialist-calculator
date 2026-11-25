// La ferme d'arbres dans l'usine : le départ des bûches et l'arrivée d'eau se branchent au reste (60 Chair/min).
import { describe, expect, it } from "vitest";
import energyJson from "../../../data/energy.json";
import itemsJson from "../../../data/items.json";
import logisticsJson from "../../../data/logistics.json";
import machinesJson from "../../../data/machines.json";
import modularJson from "../../../data/modular.json";
import overridesJson from "../../../data/overrides.json";
import portsJson from "../../../data/ports.json";
import powerJson from "../../../data/power.json";
import recipesJson from "../../../data/recipes.json";
import relevesJson from "../../../data/releves.json";
import researchJson from "../../../data/research.json";
import { buildGameData, type RawFiles } from "../data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../extension-types.ts";
import type { ModularFile } from "../modular.ts";
import { solve } from "../solve.ts";
import type { OverridesFile } from "../types.ts";
import { buildCatalog } from "./catalog.ts";
const file = modularJson as unknown as ModularFile;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const farmPoles = cat.poles.map((p) => ({ id: p.id, name: p.name, rangeCells: p.rangeCells, capacityMFps: p.capacityMFps, w: p.size.w, h: p.size.h, price: p.price }));
const base = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, modular: file, farmPoles } as unknown as RawFiles;
const { data } = buildGameData(base, [overridesJson as unknown as OverridesFile]);
const g = farmGeometry(file, data.machines, farmPoles)!;
const ports = (portsJson as unknown as PortsFile).machines;
import { farmGeometry } from "../modular-calc.ts";
import { designFarm, farmPipes } from "./assembly.ts";
import { STEP, type Dir } from "./geometry.ts";
import { designFactory, factoryInput, type AsmEnd } from "./factory.ts";

const plan = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 } as never, { item: "chair", ratePerMin: 60, criterion: "area", then: ["machines", "energy", "cost", "pollution", "raw", "steps"], tiers: false });
const name = (id: string) => data.items.get(id)?.name ?? id;

describe("ferme d'arbres dans l'usine", () => {
  it.each([true, false])("60 Chair/min, usine entière %s : bûches et eau reliées aux deux bouts", (full) => {
    const st = plan.steps.find((s) => s.item === "oak-log")!;
    const f = designFarm(g, st.machines, st.energyAvg ?? 0);
    const pipes = farmPipes(f, cat, (st.ratePerMachine * st.machines) / 60, 10);
    expect(pipes.ok).toBe(true);
    expect(pipes.parts.reduce((t, q) => t + q.count, 0)).toBe(f.pipes.length + f.water.length);
    const ends: AsmEnd[] = [
      { item: "oak-log", role: "sortie", x: f.exit!.x, y: f.exit!.y, dir: "E" },
      { item: "water", role: "entrée", x: f.entry!.x, y: f.entry!.y, dir: "W" },
    ];
    const input = factoryInput(
      plan,
      { name, isFluid: (id) => !!data.items.get(id)?.isFluid, machine: (id) => data.machines.get(id) ?? null, ports, reserve: (key) => (key === st.key ? { w: f.width, h: f.height, label: "ferme", ends, pipes: pipes.count, pipesCost: pipes.cost } : null) },
      cat,
      { w: 100_000, h: 100_000 },
      { priority: ["place", "forme", "prix", "pieces"] },
      { full },
    );
    const u = designFactory(input);
    expect(u.problems.filter((q) => JSON.stringify(q).includes(st.key))).toEqual([]);
    const b = u.boxes.find((q) => q.key === st.key)!;
    expect([b.w, b.h]).toEqual(b.rot % 2 ? [f.height, f.width] : [f.width, f.height]);
    const turn = (e: AsmEnd) => {
      let [x, y, w, h, d] = [e.x, e.y, f.width, f.height, e.dir as Dir];
      for (let r = 0; r < b.rot; r++) [x, y, w, h, d] = [h - 1 - y, x, h, w, ({ N: "E", E: "S", S: "W", W: "N" } as const)[d]];
      return { x: b.x + x + STEP[d].x, y: b.y + y + STEP[d].y, d };
    };
    const back = { N: "S", S: "N", E: "W", W: "E" } as const;
    for (const e of ends) {
      const a = turn(e);
      const o = u.cells.get(`${a.x},${a.y}`);
      const want = e.role === "sortie" ? `${st.key}:oak-log` : "water:water";
      expect(o?.kind === "tuyau" && o.net, e.item).toBe(want);
      if (o?.kind === "tuyau") {
        expect(o.links.has(back[a.d]), "tourné vers la ferme").toBe(true);
        expect(o.links.size, "relié au reste").toBeGreaterThan(1);
      }
    }
  }, 120_000);
});
