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
import { buildCatalog } from "../build/catalog.ts";
import { designModule } from "../build/module.ts";
import { designFactory, factoryInput } from "../build/factory.ts";
import { buildSandboxCatalog, cellsOf, dims, elecRole, geo, mergeStraights } from "../sandbox/index.ts";
import { layoutFromFactory, layoutFromModule } from "./convert.ts";
import { computeSandbox } from "../sandbox/index.ts";
import { fromCode, toCode } from "./msch.ts";

const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const files = { ports: portsJson as unknown as PortsFile, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson };
const sb = buildSandboxCatalog(data, files);
const cat = buildCatalog(files.logistics, files.power, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const fluid = (id: string) => !!data.items.get(id)?.isFluid;

function aModule() {
  const plan = solve(data, { unlocked: new Set(data.nodes.keys()) }, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
  const s = plan.steps.find((x) => x.item === "crankshaft")!;
  return designModule({
    machine: s.machine, count: s.machines,
    inputs: s.inputs.map((f) => ({ item: f.item, perMin: f.perMin, fluid: fluid(f.item) })),
    outputs: [{ item: s.item, perMin: s.demandPerMin, fluid: fluid(s.item) }],
    powerMFps: s.energyAvg !== null ? s.energyAvg / s.machines : null, machineCost: data.machines.get(s.machine)!.cost,
  }, (files.ports.machines)[s.machine] ?? null, data.machines.get(s.machine)!.size, cat);
}

describe("plan du site → schéma", () => {
  it("un module : chaque machine, poteau et pièce devient un bâtiment du bac à sable", () => {
    const m = aModule(), c = layoutFromModule(m, sb);
    const pieces = m.pieces.filter((p) => p.pieceId).length;
    expect(c.layout.blocks.length + c.skipped.length).toBe(m.machines.length + m.poles.length + m.pieces.length);
    expect(c.layout.blocks.length).toBeGreaterThanOrEqual(m.machines.length + pieces - c.skipped.length);
    expect([c.width, c.height]).toEqual([m.width, m.height]);
    expect(c.skipped).toEqual([]);
  });

  it("chaque pièce de tuyau est tournée pour que ses ports tombent sur ses liaisons", () => {
    const m = aModule(), c = layoutFromModule(m, sb);
    for (const p of m.pieces) {
      if (!p.pieceId || p.crossLinks) continue;
      const b = c.layout.blocks.find((x) => x.x === p.x && x.y === p.y && x.id === p.pieceId);
      if (!b) continue;
      const sides = new Set(geo(sb.blocks.get(b.id)!, b)!.ports.map((q) => q.dir));
      if (sides.size === p.links.length) expect([...sides].sort()).toEqual([...p.links].sort());
    }
  });

  it("passe par le .msch sans rien perdre", async () => {
    const c = layoutFromModule(aModule(), sb);
    const back = await fromCode(await toCode({ name: "Module", description: "", labels: [], width: c.width, height: c.height, layout: c.layout }));
    expect(back.layout.blocks.map(({ id, x, y, r }) => [id, x, y, r])).toEqual(c.layout.blocks.map(({ id, x, y, r }) => [id, x, y, r]));
  });
  it("un module : chaque machine est reliée à un poteau par câble", () => {
    const m = aModule(), c = layoutFromModule(m, sb), L = c.layout;
    expect(m.poles.length).toBeGreaterThan(0);
    const cons = L.blocks.filter((b) => elecRole(sb, L, b.u) === "cons");
    for (const b of cons) expect(L.wires.some((w) => w.t === "p" && w.b === b.u), b.id).toBe(true);
  });

  it("une usine : poteaux posés une seule fois, sans chevauchement, câbles des machines et entre poteaux", () => {
    const plan = solve(data, { unlocked: new Set(data.nodes.keys()) }, { item: "steel-plate", ratePerMin: 20, criterion: "energy", tiers: false });
    const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
    const f = designFactory(factoryInput(plan, { name, isFluid: fluid, machine: (id) => data.machines.get(id) ?? null, ports: files.ports.machines }, cat, { w: 160, h: 110 }, { priority: ["forme", "place", "prix", "pieces"] }));
    const c = layoutFromFactory(f, sb, cat, fluid), L = c.layout;
    const poles = L.blocks.filter((b) => elecRole(sb, L, b.u) === "pole");
    // Les poteaux du plan, plus les relais qu'il faut pour que chaque câble tienne dans la portée.
    expect(poles.length).toBeGreaterThanOrEqual(f.poleNodes.length);
    const seen = new Map<string, string>();
    for (const b of L.blocks) for (const [x, y] of cellsOf(sb.blocks.get(b.id)!, b)) {
      expect(seen.get(`${x},${y}`), `${b.id} sur ${seen.get(`${x},${y}`)} en ${x},${y}`).toBeUndefined();
      seen.set(`${x},${y}`, b.id);
    }
    const cons = L.blocks.filter((b) => elecRole(sb, L, b.u) === "cons");
    const wired = cons.filter((b) => L.wires.some((w) => w.t === "p" && w.b === b.u));
    expect(wired.length).toBe(cons.length);
    const poleLinks = L.wires.filter((w) => poles.some((p) => p.u === w.a) && poles.some((p) => p.u === w.b));
    expect(poleLinks.length).toBeGreaterThan(0);
  });
  it("chaque machine garde la recette du plan ; une machine sans ports relevés garde sa taille", () => {
    const m = aModule(), c = layoutFromModule(m, sb);
    for (const b of c.layout.blocks.filter((x) => x.id === m.machine)) expect(sb.blocks.get(b.id)!.recipes.find((r) => r.id === b.choice)?.out.crankshaft).toBeGreaterThan(0);
    expect(dims(sb.blocks.get("industrial-electric-furnace")!, 0)).toEqual([12, 12]);
  });

  it("tuyaux droits du tier III bout à bout : posés en pièces longues, dans le sens du flux", () => {
    const L = mergeStraights(sb, { blocks: [0, 1, 2, 3, 4].map((i) => ({ u: i, id: "short-pipe2", x: i, y: 0, r: 1 })), wires: [] });
    expect(L.blocks.map((b) => [b.id, b.x, b.r])).toEqual([["long-pipe2", 0, 1], ["short-pipe2", 4, 1]]);
  });
  it("usine 8x Microchip (retour du 2026-11-01) : aucun tuyau perdu, aucun flux croisé ni à l'envers, un seul réseau, câbles à portée", () => {
    const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
    const outOrder = (id: string) => { const r = data.recipes.get(id); return r ? Object.keys(r.outputs) : undefined; };
    const plan = solve(data, { unlocked: new Set(data.nodes.keys()) }, { item: "8x-microchip", ratePerMin: 8, criterion: "energy", tiers: false });
    const f = designFactory(factoryInput(plan, { name, isFluid: fluid, machine: (id) => data.machines.get(id) ?? null, ports: files.ports.machines, sb, outOrder }, cat, { w: 100000, h: 100000 }, { priority: ["place", "forme", "prix", "pieces"] }, { glue: false }));
    const c = layoutFromFactory(f, sb, cat, fluid), L = c.layout, R = computeSandbox(sb, L);
    // Tuyaux : chaque case du plan (modules, liaisons, évacuations) a sa pièce.
    const planCells = new Set<string>(), conv = new Set<string>();
    for (const b of f.boxes) for (const p of b.mod?.pieces ?? []) planCells.add(`${b.x + p.x},${b.y + p.y}`);
    for (const [k, o] of f.cells) if (o.kind === "tuyau") planCells.add(k);
    for (const b of L.blocks) { const d = sb.blocks.get(b.id)!; if (d.pipe) for (const [x, y] of cellsOf(d, b)) conv.add(`${x},${y}`); }
    expect([...planCells].filter((k) => !conv.has(k))).toEqual([]);
    const kinds = R.alerts.map((a) => a.a.k);
    expect(kinds).not.toContain("reversed");
    expect(kinds).not.toContain("mixed");
    expect([...R.machines.values()].filter((m) => m.reason?.k === "noRecipe")).toEqual([]);
    // Câbles : chaque câble tient dans la portée du bâtiment d'où il part ; tous les poteaux forment un seul réseau.
    const byU = new Map(L.blocks.map((b) => [b.u, b]));
    for (const w of L.wires) {
      const A = byU.get(w.a)!, B = byU.get(w.b)!, pa = geo(sb.blocks.get(A.id)!, A)!.ports[w.ia]!, pb = geo(sb.blocks.get(B.id)!, B)!.ports[w.ib]!, Rg = sb.blocks.get(A.id)!.elec?.range;
      if (Rg != null) expect(Math.hypot(pa.px! - pb.px!, pa.py! - pb.py!)).toBeLessThanOrEqual(Rg + 1e-9);
    }
    expect(R.power.length).toBe(1);
  }, 60000);
});
