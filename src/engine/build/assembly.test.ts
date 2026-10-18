// Plans de pose des ensembles modulaires (S14) : chaque règle de modular.json est vérifiée sur le
// plan produit (portées, nombres, passages des tuyaux, poteaux, écart entre fermes, contact du moteur).
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
import { dieselConfigs, farmGeometry } from "../modular-calc.ts";
import type { ModularFile } from "../modular.ts";
import { solve } from "../solve.ts";
import type { OverridesFile } from "../types.ts";
import { crankshaftsFor, designDiesel, designFarm, DIESEL_IDS, farmCapacity, FARM_IDS, sprinklerOffsets, type AsmBlock, type FarmGeometry, type FarmSet } from "./assembly.ts";
import { buildCatalog } from "./catalog.ts";
import { STEP } from "./geometry.ts";

const file = modularJson as unknown as ModularFile;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const farmPoles = cat.poles.map((p) => ({ id: p.id, name: p.name, rangeCells: p.rangeCells, capacityMFps: p.capacityMFps, w: p.size.w, h: p.size.h, price: p.price }));
const base = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, modular: file, farmPoles } as unknown as RawFiles;
const { data } = buildGameData(base, [overridesJson as unknown as OverridesFile]);
const g = farmGeometry(file, data.machines, farmPoles)!;
const ports = (portsJson as unknown as PortsFile).machines;

const rect = (b: { x: number; y: number; w: number; h: number }) => ({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h });
const rdist = (cx: number, cy: number, r: ReturnType<typeof rect>) => Math.hypot(Math.max(r.x0 - cx, 0, cx - r.x1), Math.max(r.y0 - cy, 0, cy - r.y1));
const center = (b: AsmBlock) => [b.x + b.w / 2, b.y + b.h / 2] as const;
const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Toutes les règles de la ferme, vérifiées sur le plan. */
function checkFarm(f: FarmSet, geo: FarmGeometry) {
  const byId = new Map(f.blocks.map((b) => [b.id, b]));
  const of = (kind: string) => f.blocks.filter((b) => b.kind === kind);
  // Rien ne se chevauche (blocs et poteaux).
  const rs = [...f.blocks.map(rect), ...f.poles.map(rect)];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(overlap(rs[i]!, rs[j]!), `chevauchement ${i}/${j}`).toBe(false);
  for (const u of Array.from({ length: f.farms }, (_, k) => k + 1)) {
    const mine = f.blocks.filter((b) => b.unit === u);
    const ctrl = mine.filter((b) => b.kind === "controller");
    expect(ctrl).toHaveLength(1);
    const [cx, cy] = center(ctrl[0]!);
    // Tout bloc de la ferme touche le cercle de son contrôleur…
    for (const b of mine) expect(rdist(cx, cy, rect(b)), `${b.id} hors de portée du contrôleur`).toBeLessThanOrEqual(geo.reach.controller + 1e-9);
    // … et aucun bloc d'une autre ferme.
    for (const b of f.blocks.filter((q) => q.unit !== u)) expect(rdist(cx, cy, rect(b)), `${b.id} touché par le contrôleur ${u}`).toBeGreaterThan(geo.reach.controller);
    // Réservoirs : un pour trois arroseurs.
    expect(mine.filter((b) => b.kind === "tank")).toHaveLength(Math.ceil(mine.filter((b) => b.kind === "sprinkler").length / geo.perTank));
  }
  // Chaque arbre est à portée d'un arroseur et suivi par un seul récolteur à portée (22 au plus).
  const harvOf = new Map<string, string>();
  for (const h of of("harvester")) {
    const trees = h.serves!.filter((id) => byId.get(id)?.kind === "tree");
    expect(trees.length).toBeLessThanOrEqual(geo.perHarvester);
    const [hx, hy] = center(h);
    for (const t of trees) {
      expect(harvOf.has(t)).toBe(false);
      harvOf.set(t, h.id);
      expect(rdist(hx, hy, rect(byId.get(t)!))).toBeLessThanOrEqual(geo.reach.harvester + 1e-9);
    }
    // Sa sortie, à portée.
    const outs = h.serves!.filter((id) => byId.get(id)?.kind === "output");
    expect(outs, h.id).toHaveLength(1);
    expect(rdist(hx, hy, rect(byId.get(outs[0]!)!))).toBeLessThanOrEqual(geo.reach.harvester + 1e-9);
  }
  for (const t of of("tree")) {
    expect(harvOf.has(t.id), `${t.id} sans récolteur`).toBe(true);
    expect(of("sprinkler").some((s) => s.unit === t.unit && rdist(...center(s), rect(t)) <= geo.reach.sprinkler + 1e-9)).toBe(true);
  }
  // Passages : de la case du port jusqu'au bord, aucune case occupée.
  const blocked = (x: number, y: number) => f.blocks.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || f.poles.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
  expect(f.corridors).toHaveLength(of("output").length + of("tank").length);
  for (const c of f.corridors) for (let n = 0; n < c.len; n++) expect(blocked(c.x + STEP[c.dir].x * n, c.y + STEP[c.dir].y * n), `passage de ${c.block}`).toBe(false);
  // Câbles : de la prise au bord, chaque portée tenue.
  if (f.pole) for (const c of f.cables) expect(Math.hypot(c.x2 - c.x1, c.y2 - c.y1)).toBeLessThanOrEqual(f.pole.rangeCells + 1e-9);
}

describe("ferme d'arbres : plan de pose", () => {
  it("géométrie lue dans modular.json et machines.json", () => {
    expect(g.tree).toBe(4);
    expect(g.reach).toEqual({ sprinkler: 12, harvester: 27, controller: 60 });
    expect(sprinklerOffsets(g)).toHaveLength(44); // comme les deux wikis
    expect(g.ports.output).toEqual({ side: "bas", cell: 2 });
    expect(g.ports.tank).toEqual({ side: "bas", cell: 2 });
    expect(g.ports.plug).toEqual([3.5, 4]);
    expect(g.poles.map((p) => p.id)).not.toContain("hv-pole");
  });

  it("guide Miraheze, 88 arbres : 2 arroseurs, 1 réservoir, 4 récolteurs, 1 contrôleur, toutes les règles tenues", () => {
    const f = designFarm(g, 88, 48_500);
    expect(f.farms).toBe(1);
    expect(f.counts).toMatchObject({ [FARM_IDS.tree]: 88, [FARM_IDS.sprinkler]: 2, [FARM_IDS.tank]: 1, [FARM_IDS.harvester]: 4, [FARM_IDS.controller]: 1 });
    expect(f.problems).toEqual([]);
    checkFarm(f, g);
  });

  it("Oak Log 30/min (91 arbres) : règles tenues, poteaux du bord jusqu'au contrôleur", () => {
    const f = designFarm(g, 91, 50_200);
    expect(f.counts[FARM_IDS.sprinkler]).toBe(3);
    expect(f.counts[FARM_IDS.harvester]).toBe(5);
    expect(f.pole?.id).toBe("mv-pole"); // le moins cher qui porte 50 kMF/s
    expect(f.cables.length).toBeGreaterThan(0);
    checkFarm(f, g);
  });

  it("une ferme pleine, puis une de plus : deux fermes écartées, aucun contrôleur ne touche l'autre ferme", () => {
    const cap = farmCapacity(g, designFarm(g, 91, 0).reserveReach);
    expect(cap).toBeGreaterThan(400);
    const one = designFarm(g, cap, 0);
    expect(one.farms).toBe(1);
    checkFarm(one, g);
    const two = designFarm(g, cap + 1, 0);
    expect(two.farms).toBe(2);
    expect(two.trees.reduce((a, b) => a + b, 0)).toBe(cap + 1);
    expect(two.counts[FARM_IDS.controller]).toBe(2);
    checkFarm(two, g);
  });

  it("un poteau de plus grande portée saute des places réservées", () => {
    const def = designFarm(g, 300, 160_000);
    expect(def.poleOptions.length).toBeGreaterThan(0);
    const far = def.poleOptions.sort((a, b) => b.rangeCells - a.rangeCells)[0]!;
    const alt = designFarm(g, 300, 160_000, far.id);
    expect(alt.pole?.id).toBe(far.id);
    expect(alt.counts).toEqual(def.counts); // les blocs ne changent pas
    expect(alt.cables.length).toBeLessThanOrEqual(def.cables.length);
    checkFarm(alt, g);
  });

  it("dans le calcul : les blocs de la ferme suivent le plan de pose", () => {
    const plan = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 } as never, { item: "oak-log", ratePerMin: 30, criterion: "machines", tiers: false });
    const st = plan.steps.find((s) => s.item === "oak-log")!;
    const f = designFarm(g, st.machines, st.energyAvg ?? 0);
    for (const q of st.parts!) if (q.machine !== FARM_IDS.tree) expect(q.count, q.machine).toBe(f.counts[q.machine]);
  });
});

describe("moteur diesel : plan de pose", () => {
  const size = (id: string) => {
    const s = data.machines.get(id)!.size!;
    return { w: s.w, h: s.l };
  };
  const configs = dieselConfigs(file);

  it("vilebrequins au plus court : un bloc par côté, contrôleur compris", () => {
    expect(crankshaftsFor(9)).toBe(4);
    expect(crankshaftsFor(35)).toBe(17);
    expect(crankshaftsFor(1)).toBe(1);
    const six = configs.find((c) => c.cylinders === 6)!;
    expect(Object.fromEntries(six.parts.map((p) => [p.machine, p.count]))).toEqual({ [DIESEL_IDS.controller]: 1, [DIESEL_IDS.crankshaft]: 4, [DIESEL_IDS.cylinder]: 6, [DIESEL_IDS.air]: 1, [DIESEL_IDS.exhaust]: 1, [DIESEL_IDS.fuel]: 1, [DIESEL_IDS.generator]: 1 });
    const big = configs.find((c) => c.cylinders === 32)!;
    expect(big.parts.find((p) => p.machine === DIESEL_IDS.crankshaft)?.count).toBe(17);
    expect(big.parts.find((p) => p.machine === DIESEL_IDS.air)?.count).toBe(1);
    expect(big.partsComplete).toBe(false);
  });

  it("32 cylindres : 17 vilebrequins, blocs à relever posés au minimum et signalés", () => {
    const big = configs.find((c) => c.cylinders === 32)!;
    const todo = [DIESEL_IDS.air, DIESEL_IDS.exhaust, DIESEL_IDS.fuel, DIESEL_IDS.generator];
    const p = designDiesel(big.parts, 1, size, ports, todo);
    expect(p.cranks).toBe(17);
    expect(p.counts[DIESEL_IDS.cylinder]).toBe(32);
    expect(p.freeSides).toBe(2 * 18 - 35);
    expect(p.blocks.filter((b) => b.todo).map((b) => b.machine).sort()).toEqual([...todo].sort());
    expect(p.width).toBe(19 * 2);
  });

  it("deux moteurs de 6 cylindres : contact par face, deux côtés libres, carburant raccordable", () => {
    const six = configs.find((c) => c.cylinders === 6)!;
    const p = designDiesel(six.parts, 2, size, ports);
    expect(p.cranks).toBe(4);
    expect(p.counts[DIESEL_IDS.crankshaft]).toBe(8);
    expect(p.freeSides).toBe(1);
    const rs = p.blocks.map(rect);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(overlap(rs[i]!, rs[j]!)).toBe(false);
    for (const u of [1, 2]) {
      const mine = p.blocks.filter((b) => b.unit === u);
      const line = mine.filter((b) => [DIESEL_IDS.controller, DIESEL_IDS.crankshaft, DIESEL_IDS.generator].includes(b.machine as never));
      // La ligne : contrôleur au bout, vilebrequins, générateur au bout, sur une seule rangée.
      expect(new Set(line.map((b) => b.y)).size).toBe(1);
      expect(line.sort((a, b) => a.x - b.x).map((b) => b.machine)).toEqual([DIESEL_IDS.controller, ...Array(4).fill(DIESEL_IDS.crankshaft), DIESEL_IDS.generator]);
      // Chaque bloc de côté touche le côté d'un vilebrequin ou du contrôleur.
      for (const b of mine.filter((q) => !line.includes(q))) expect(line.some((l) => l.machine !== DIESEL_IDS.generator && l.x === b.x && Math.abs(l.y - b.y) === l.h)).toBe(true);
      // Le port de l'entrée de carburant donne hors du moteur.
      const fuel = mine.find((b) => b.machine === DIESEL_IDS.fuel)!;
      expect(fuel.port).toMatchObject({ facing: "W", fluid: true });
      expect(p.blocks.some((b) => fuel.port!.x >= b.x && fuel.port!.x < b.x + b.w && fuel.port!.y >= b.y && fuel.port!.y < b.y + b.h)).toBe(false);
    }
  });
});
