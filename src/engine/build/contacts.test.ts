// S56 : génération des plans de pose par contacts (maquette `generation-contacts.html`, règle BAS-11 de
// data/a-verifier.md). Chaque essai est vérifié par le moteur du bac à sable.
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
import { buildSandboxCatalog, computeSandbox, geo, type Layout, type SbBlock, type SbCatalog } from "../sandbox/index.ts";
import { layoutFromFactory, layoutFromModule, touchRoute } from "../schematic/convert.ts";
import { buildCatalog } from "./catalog.ts";
import { designFactory, factoryInput } from "./factory.ts";
import { designModule, portAssignments, requestFromStep, sharedAssignments } from "./module.ts";
import { checkLayout, checkModule } from "./verify.ts";

const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const files = { ports: portsJson as unknown as PortsFile, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson };
const sb = buildSandboxCatalog(data, files);
const cat = buildCatalog(files.logistics, files.power, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const fluid = (id: string) => !!data.items.get(id)?.isFluid;
const all = { unlocked: new Set(data.nodes.keys()) };

/**
 * Catalogue d'essai : les vrais tuyaux et croisements, plus des machines de 3 × 3 aux ports choisis et des objets
 * « ta » à « tz » et le fluide « tf » (rien de tout ça n'est une valeur du jeu : seules les règles de contact comptent).
 */
function testCatalog(machines: Record<string, Pick<SbBlock, "geo" | "recipes">>): SbCatalog {
  const blocks = new Map(sb.blocks);
  for (const [id, m] of Object.entries(machines)) blocks.set(id, { id, name: id, tier: null, cost: 0, poll: 0, incomplete: [], ...m });
  const items = new Map(sb.items);
  for (const i of ["ta", "tb", "tc", "td", "tz"]) items.set(i, { name: i, fluid: false, sell: null });
  items.set("tf", { name: "tf", fluid: true, sell: null });
  return { blocks, items };
}
const box = (ports: NonNullable<SbBlock["geo"]>["ports"]) => ({ w: 3, h: 3, ports });
const lay = (blocks: Omit<Layout["blocks"][number], "u">[]): Layout => ({ blocks: blocks.map((b, u) => ({ ...b, u })), wires: [] });

describe("S56 : règles de contact dans le moteur du bac à sable (BAS-11)", () => {
  it("un croisement collé à un port y fait entrer ses deux flux : deux ressources par un port", () => {
    const c = testCatalog({ m: { geo: box([{ t: "o", d: "e", s: "N", c: 2 }]), recipes: [{ id: "r", s: 1, in: { ta: 1, tb: 1 }, out: { tc: 1 }, e: null }] } });
    // Machine en (0, 1) ; port au milieu du haut ; croisement juste au-dessus ; « ta » arrive de l'ouest, « tb » du nord.
    const l = lay([
      { id: "m", x: 0, y: 1, r: 0 },
      { id: "pipe-intersection", x: 1, y: 0, r: 0 },
      { id: "short-pipe", x: 0, y: 0, r: 1 },
      { id: "short-pipe", x: 1, y: -1, r: 0 },
    ]);
    const ck = checkLayout(c, l, [{ x: 0, y: 0, dir: "W", item: "ta" }, { x: 1, y: -1, dir: "N", item: "tb" }], { m: { recipe: "r", need: 1 } });
    expect(ck.issues).toEqual([]);
    expect(ck.result!.machines.get(0)!.f).toBeCloseTo(1);
  });

  it("un croisement sur le port de sortie : l'entrée arrive par l'autre voie, la production part dans la voie branchée sur le port (Grinder testé en jeu)", () => {
    const c = testCatalog({ g: { geo: box([{ t: "o", d: "s", s: "N", c: 2 }]), recipes: [{ id: "r", s: 1, in: { ta: 1 }, out: { tc: 1 }, e: null }] } });
    const l = lay([
      { id: "g", x: 0, y: 1, r: 0 },
      { id: "pipe-intersection", x: 1, y: 0, r: 0 },
      { id: "short-pipe", x: 0, y: 0, r: 1 },
      { id: "short-pipe", x: 1, y: -1, r: 0 }, // part vers le nord, bout ouvert
    ]);
    const ck = checkLayout(c, l, [{ x: 0, y: 0, dir: "W", item: "ta" }], { g: { recipe: "r", need: 1 } });
    expect(ck.issues).toEqual([]);
    const out = ck.result!.lanes.find((x) => x.u === 3)!;
    expect(out.item).toBe("tc");
    expect(out.flow).toBeCloseTo(1);
    // La voie d'entrée ne porte que l'entrée : la production ne repart pas par elle.
    expect(ck.result!.lanes.find((x) => x.u === 2)!.item).toBe("ta");
  });

  it("rien ne traverse une machine : un port d'entrée ne fait rien ressortir", () => {
    const c = testCatalog({ x: { geo: box([{ t: "o", d: "e", s: "W", c: 2 }, { t: "o", d: "e", s: "E", c: 2 }]), recipes: [{ id: "r", s: 1, in: { ta: 1 }, out: { tc: 1 }, e: null }] } });
    const l = lay([
      { id: "x", x: 0, y: 0, r: 0 },
      { id: "short-pipe", x: -1, y: 1, r: 1 },
      { id: "short-pipe", x: 3, y: 1, r: 1 }, // de l'autre côté, bout ouvert
    ]);
    const ck = checkLayout(c, l, [{ x: -1, y: 1, dir: "W", item: "ta" }], { x: { recipe: "r", need: 1 } });
    expect(ck.ok).toBe(true);
    const other = ck.result!.lanes.find((x) => x.u === 2);
    expect(other?.flow ?? 0).toBe(0);
    expect(other?.item ?? null).toBe(null);
  });

  it("une entrée amenée par un simple tuyau sur le port de sortie se mêle à la production : l'essai est rejeté", () => {
    const c = testCatalog({ g: { geo: box([{ t: "o", d: "s", s: "N", c: 2 }]), recipes: [{ id: "r", s: 1, in: { ta: 1 }, out: { tc: 1 }, e: null }] } });
    const l = lay([
      { id: "g", x: 0, y: 1, r: 0 },
      { id: "short-pipe", x: 1, y: 0, r: 0 },
      { id: "short-pipe", x: 1, y: -1, r: 0 },
    ]);
    const ck = checkLayout(c, l, [{ x: 1, y: -1, dir: "N", item: "ta" }], { g: { recipe: "r", need: 1 } });
    expect(ck.ok).toBe(false);
    expect(ck.issues.some((i) => i.k === "mixed")).toBe(true);
  });

  it("croisement objet × fluide collé au port objet : ses deux flux entrent (testé en jeu, BAS-12)", () => {
    const c = testCatalog({ m: { geo: box([{ t: "o", d: "e", s: "N", c: 2 }]), recipes: [{ id: "r", s: 1, in: { ta: 1, tf: 1 }, out: { tc: 1 }, e: null }] } });
    // Tourné d'un quart de tour : le côté objet touche le port, le fluide passe d'ouest en est.
    const l = lay([
      { id: "m", x: 0, y: 1, r: 0 },
      { id: "fluid-pipe-and-item-intersection", x: 1, y: 0, r: 1 },
      { id: "short-fluid-pipe", x: 0, y: 0, r: 1 },
      { id: "short-pipe", x: 1, y: -1, r: 0 },
    ]);
    const ck = checkLayout(c, l, [{ x: 0, y: 0, dir: "W", item: "tf" }, { x: 1, y: -1, dir: "N", item: "ta" }], { m: { recipe: "r", need: 1 } });
    expect(ck.issues).toEqual([]);
  });

  it("un port de sortie qui ne sert pas au craft reste libre : une entrée peut y arriver par un simple tuyau", () => {
    const c = testCatalog({ g: { geo: box([{ t: "o", d: "s", s: "N", c: 2, items: ["td"] }]), recipes: [{ id: "r", s: 1, in: { ta: 1 }, out: { tc: 1 }, e: null }] } });
    const l = lay([
      { id: "g", x: 0, y: 1, r: 0 },
      { id: "short-pipe", x: 1, y: 0, r: 0 },
      { id: "short-pipe", x: 1, y: -1, r: 0 },
    ]);
    const ck = checkLayout(c, l, [{ x: 1, y: -1, dir: "N", item: "ta" }], { g: { recipe: "r", need: 1 } });
    expect(ck.issues).toEqual([]);
  });

  it("sortie de A collée au port de sortie de B : la liaison d'un bouton à l'autre fait passer le flux (BAS-12)", () => {
    const c = testCatalog({
      a: { geo: box([{ t: "o", d: "s", s: "E", c: 2 }]), recipes: [{ id: "ra", s: 1, in: {}, out: { tc: 2 }, e: null }] },
      b: { geo: box([{ t: "o", d: "s", s: "W", c: 2, items: ["tz"] }]), recipes: [{ id: "rb", s: 1, in: { tc: 1 }, out: { td: 1 }, e: null }] },
    });
    const l = lay([{ id: "a", x: 0, y: 0, r: 0 }, { id: "b", x: 3, y: 0, r: 0 }]);
    const route = touchRoute(c, l.blocks, { x: 3, y: 1, dir: "E" });
    expect(route).toEqual({ a: 0, ia: 0, b: 1, ib: 0 });
    const runs = { a: { recipe: "ra", need: 1 }, b: { recipe: "rb", need: 1 } };
    const ck = checkLayout(c, { ...l, routes: [route!] }, [], runs, true);
    expect(ck.issues).toEqual([]);
    // B ne prend que la moitié de ce que A produit : A ralentit (bouchon).
    expect(ck.result!.machines.get(0)!.f).toBeCloseTo(0.5);
  });

  it("sortie de A collée à l'entrée de B : seul ce que B consomme passe, le surplus fait un bouchon (A ralentit)", () => {
    const c = testCatalog({
      a: { geo: box([{ t: "o", d: "e", s: "W", c: 2 }, { t: "o", d: "s", s: "E", c: 2 }]), recipes: [{ id: "ra", s: 1, in: { ta: 1 }, out: { tc: 2 }, e: null }] },
      b: { geo: box([{ t: "o", d: "e", s: "W", c: 2 }]), recipes: [{ id: "rb", s: 1, in: { tc: 1 }, out: { td: 1 }, e: null }] },
    });
    const l = lay([
      { id: "a", x: 0, y: 0, r: 0 },
      { id: "b", x: 3, y: 0, r: 0 },
      { id: "short-pipe", x: -1, y: 1, r: 1 },
    ]);
    const feeds = [{ x: -1, y: 1, dir: "W" as const, item: "ta" }];
    const runs = { a: { recipe: "ra", need: 1 }, b: { recipe: "rb", need: 1 } };
    const ok = checkLayout(c, l, feeds, runs, true);
    expect(ok.issues).toEqual([]);
    expect(ok.result!.machines.get(1)!.f).toBeCloseTo(1);
    expect(ok.result!.machines.get(0)!.f).toBeCloseTo(0.5);
    expect(ok.result!.machines.get(0)!.reason).toEqual({ k: "blocked", item: "tc" });
    // Sans le bouchon permis, A (qui ne tourne qu'à moitié) ne passe pas.
    expect(checkLayout(c, l, feeds, runs).ok).toBe(false);
  });
});

/** La demande de module d'une étape du plan. */
function stepReq(item: string, rate: number, machine: string) {
  const plan = solve(data, all, { item, ratePerMin: rate, criterion: "energy", tiers: false });
  const s = plan.steps.find((x) => x.machine === machine && x.item === item)!;
  const m = data.machines.get(s.machine)!;
  return { req: requestFromStep(s, fluid, m.cost)!, entry: files.ports.machines[s.machine] ?? null, size: m.size };
}

describe("S56 : modules générés et vérifiés", () => {
  it("variantes « deux ressources par un port » : une entrée prend le port d'une autre ressource (même d'un autre type)", () => {
    const { req, entry } = stepReq("zinc-sulfate", 60, "chemical-reactor");
    const vs = sharedAssignments(portAssignments(entry!, req, 8));
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) {
      const s = v.filter((a) => a.shared);
      expect(s).toHaveLength(1);
      const host = v.find((a) => !a.shared && a.port === s[0]!.port)!;
      expect(host.item).not.toBe(s[0]!.item);
    }
  });

  it("Chemical Reactor (Gunpowder) : le Sulfur n'a pas de port à lui, il entre par le croisement collé au port d'une autre ressource, et le bac à sable le confirme", () => {
    const { req, entry, size } = stepReq("gunpowder", 60, "chemical-reactor");
    const mod = designModule(req, entry, size, cat, (x) => x, sb);
    expect(mod.checked).toBe(true);
    expect(mod.problems.filter((p) => p.level === "erreur")).toEqual([]);
    const shared = mod.config!.assign.find((a) => a.shared)!;
    expect(shared.item).toBe("sulfur");
    const host = mod.config!.assign.find((a) => !a.shared && a.port === shared.port)!;
    expect(host.item).not.toBe("sulfur");
    // À chaque machine, un croisement collé au port hôte : la ressource du port dans une voie, le Sulfur dans l'autre.
    for (const m of mod.machines) {
      const port = m.ports.find((p) => p.index === shared.port)!;
      const x = mod.pieces.find((p) => p.x === port.cell.x && p.y === port.cell.y)!;
      expect(x.role).toBe("croisement");
      expect([x.net, x.crossNet]).toContain("sulfur");
    }
    expect(checkModule(mod, req, sb)!.ok).toBe(true);
  });

  it("Chemical Reactor (Zinc Sulfate) : vérifié par le bac à sable", () => {
    const { req, entry, size } = stepReq("zinc-sulfate", 60, "chemical-reactor");
    const mod = designModule(req, entry, size, cat, (x) => x, sb);
    expect(mod.checked).toBe(true);
    expect(checkModule(mod, req, sb)!.ok).toBe(true);
  });

  it("croisement objet × fluide tourné pour que le fluide suive son tuyau (Ingot Molder, Gold Ingot)", () => {
    const { req, entry, size } = stepReq("gold-ingot", 60, "ingot-molder");
    const mod = designModule(req, entry, size, cat, (x) => x, sb);
    expect(mod.checked).toBe(true);
    const conv = layoutFromModule(mod, sb);
    const mixed = mod.pieces.filter((p) => p.pieceId === "fluid-pipe-and-item-intersection");
    for (const p of mixed) {
      const fl = mod.nets.find((n) => n.id === p.net)!.kind === "fluide" ? p.links : p.crossLinks!;
      const b = conv.layout.blocks.find((q) => q.x === p.x && q.y === p.y)!;
      const fluidSides = geo(sb.blocks.get(b.id)!, b)!.ports.filter((q) => q.t === "f").map((q) => q.dir);
      for (const d of fl) expect(fluidSides).toContain(d);
    }
  });

  it("avec le bac à sable, aucun module retenu n'est rejeté (Crankshaft, Gunpowder, Glass à 60/min)", () => {
    for (const item of ["crankshaft", "gunpowder", "glass"]) {
      const plan = solve(data, all, { item, ratePerMin: 60, criterion: "energy", tiers: false });
      for (const s of plan.steps) {
        const m = data.machines.get(s.machine);
        const req = m && requestFromStep(s, fluid, m.cost);
        if (!req) continue;
        const mod = designModule(req, files.ports.machines[s.machine] ?? null, m.size, cat, (x) => x, sb);
        expect(mod.checked, `${s.machine} → ${s.item}`).not.toBe(false);
      }
    }
  }, 120000);
});

describe("S56 : étapes collées dans l'usine", () => {
  it("Black Dye à 6/min, liaisons collées : le port de sortie du Coal Drill touche la machine suivante, sans tuyau, et le bac à sable fait tourner les deux", () => {
    const plan = solve(data, all, { item: "black-dye", ratePerMin: 6, criterion: "energy", tiers: false });
    const look = { name: (id: string) => id, isFluid: fluid, machine: (id: string) => data.machines.get(id) ?? null, ports: files.ports.machines, sb };
    const input = factoryInput(plan, look, cat, { w: 160, h: 110 }, { priority: ["place", "forme", "prix", "pieces"] }, { glue: true });
    const f = designFactory(structuredClone(input));
    expect(f.problems).toEqual([]);
    expect(f.touches.length).toBeGreaterThan(0);
    for (const t of f.touches) {
      expect(f.glued).toContain(`${t.from}>${t.to}`);
      // Le montage du bac à sable porte la liaison d'un bouton à l'autre.
      expect(layoutFromFactory(f, sb, cat, fluid).layout.routes?.length).toBeGreaterThan(0);
      // Aucun tuyau pour cette liaison ; la case de contact est une case de la machine suivante.
      expect(f.nets.some((n) => n.id === `${t.from}:${t.item}`)).toBe(false);
      const a = f.boxes.find((b) => b.key === t.from)!;
      const b = f.boxes.find((x) => x.key === t.to)!;
      expect(b.mod!.machines[0]!.cells.some((c) => b.x + c.x === t.x && b.y + c.y === t.y)).toBe(true);
      expect(a.mod!.nets.some((n) => n.item === t.item && n.role === "sortie")).toBe(false);
      expect(b.mod!.nets.some((n) => n.item === t.item && n.role === "entrée")).toBe(false);
      // Prix et liste d'achat : seulement les pièces posées.
      expect(a.mod!.parts.reduce((s, p) => s + p.count, 0)).toBe(1 + a.mod!.pieces.length + a.mod!.poles.length);
    }
    // Machines collées dans le montage du bac à sable : la sortie de la 1re alimente la 2de.
    const t = f.touches[0]!;
    const [a, b] = [t.from, t.to].map((k) => f.boxes.find((x) => x.key === k)!);
    const blocks = [a, b].flatMap((x, i) => x!.mod!.machines.map((m) => ({ u: i, id: m.machine, x: x!.x + m.x, y: x!.y + m.y, r: m.rot })));
    const res = computeSandbox(sb, { blocks, wires: [] });
    expect(res.machines.get(1)!.rec?.in[t.item]).toBeGreaterThan(0);
  }, 120000);
});
