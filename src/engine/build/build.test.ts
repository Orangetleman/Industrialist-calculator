// Plans de construction (E4a) : géométrie, routage, modules sur les vraies données.
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
import { buildCatalog, pipeFor } from "./catalog.ts";
import { add, key, OPPOSITE, place, rotateCell, rotatePoint, type Dir } from "./geometry.ts";
import { designModule, normalPriority, portAssignments, redesign, type ModulePlan, type ModuleRequest, type PoseCriterion } from "./module.ts";
import { Grid, route } from "./route.ts";

const PORTS = (portsJson as unknown as PortsFile).machines;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);

describe("géométrie de la grille", () => {
  it("un quart de tour horaire : le coin haut-gauche passe en haut à droite", () => {
    expect(rotatePoint(0, 0, 4, 2, 1)).toEqual({ x: 2, y: 0 });
    expect(rotateCell({ x: 0, y: 0 }, 4, 2, 1)).toEqual({ x: 1, y: 0 });
    // Quatre quarts de tour : retour au départ.
    expect(rotatePoint(1.5, 0.5, 4, 2, 0)).toEqual(rotatePoint(1.5, 0.5, 4, 2, 0));
    let c = { x: 3, y: 1 };
    let [w, h] = [4, 2];
    for (let i = 0; i < 4; i++) {
      c = rotateCell(c, w, h, 1);
      [w, h] = [h, w];
    }
    expect(c).toEqual({ x: 3, y: 1 });
  });

  it("Craft Assembler : ports en bas (plot d'une case), prise sur le dessus ; ils tournent avec lui", () => {
    const e = PORTS["craft-assembler"]!;
    const p0 = place("a", "craft-assembler", e, 0, 0, 0);
    expect(p0.w).toBe(8);
    expect(p0.cells).toHaveLength(8 * 4 + 3); // bâtiment + 3 plots
    expect(p0.ports.map((p) => [p.cell, p.facing])).toEqual([
      [{ x: 2, y: 5 }, "S"],
      [{ x: 6, y: 5 }, "S"],
      [{ x: 7, y: 5 }, "S"],
    ]);
    expect(p0.power[0]).toMatchObject({ x: 7.5, y: 3.5 });
    const p1 = place("a", "craft-assembler", e, 0, 0, 1);
    expect([p1.w, p1.h]).toEqual([4, 8]);
    expect(p1.ports.every((p) => p.facing === "W" && p.cell.x === -2)).toBe(true);
  });
});

describe("routage", () => {
  it("rejoint son collecteur, et croise un autre réseau à angle droit", () => {
    const g = new Grid();
    g.straight({ x: 0, y: 3 }, { x: 6, y: 3 }, "b"); // collecteur d'un autre réseau
    g.straight({ x: 0, y: 5 }, { x: 6, y: 5 }, "a"); // collecteur cible
    const ok = route(g, "a", { x: 3, y: 1 }, "N", { x0: 0, y0: 0, x1: 6, y1: 6 }, (c) => Math.abs(c.y - 5));
    expect(ok).toBe(true);
    const cross = g.get({ x: 3, y: 3 });
    expect(cross).toMatchObject({ kind: "tuyau", net: "b" });
    expect(cross?.kind === "tuyau" && cross.cross?.net).toBe("a");
    const join = g.get({ x: 3, y: 5 });
    expect(join?.kind === "tuyau" && [...join.links].sort()).toEqual(["E", "N", "W"]); // un té
  });

  it("refuse de passer dans un bâtiment", () => {
    const g = new Grid();
    for (let x = 0; x <= 6; x++) g.block({ x, y: 2 }, "mur");
    g.straight({ x: 0, y: 4 }, { x: 6, y: 4 }, "a");
    expect(route(g, "a", { x: 3, y: 0 }, "N", { x0: 0, y0: 0, x1: 6, y1: 4 }, (c) => Math.abs(c.y - 4))).toBe(false);
  });

  it("capacité d'un poteau : la somme de ses nœuds (relevé du 2026-10-13)", () => {
    const hmvt = cat.poles.find((p) => p.id === "hmvt")!;
    expect(hmvt.nodes).toBe(4);
    expect(hmvt.capacityMFps).toBe(hmvt.perNodeMFps * 4);
    expect(cat.poles.find((p) => p.id === "small-mv-pole")!.capacityMFps).toBe(cat.poles.find((p) => p.id === "small-mv-pole")!.perNodeMFps);
  });

  it("choisit le tuyau le moins cher qui porte le débit", () => {
    expect(pipeFor(cat, "objet", 4)?.tier).toBe(1);
    expect(pipeFor(cat, "objet", 50)?.tier).toBe(3);
    expect(pipeFor(cat, "objet", 500)).toBeNull();
  });
});

// ---------------------------------------------------------------- modules sur la chaîne du Crankshaft
const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()) };
const fluid = (id: string) => !!data.items.get(id)?.isFluid;

const PLACE: PoseCriterion[] = ["place", "forme", "prix", "pieces"];
const PRIX: PoseCriterion[] = ["prix", "place", "forme", "pieces"];

function moduleFor(stepItem: string, priority: PoseCriterion[] = PLACE): { mod: ModulePlan; req: ModuleRequest } {
  const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
  const s = plan.steps.find((x) => x.item === stepItem)!;
  const m = data.machines.get(s.machine)!;
  const req: ModuleRequest = {
    machine: s.machine,
    count: s.machines,
    inputs: s.inputs.map((f) => ({ item: f.item, perMin: f.perMin, fluid: fluid(f.item) })),
    outputs: [{ item: s.item, perMin: s.demandPerMin, fluid: fluid(s.item) }, ...s.byproducts.map((f) => ({ item: f.item, perMin: f.perMin, fluid: fluid(f.item) }))],
    powerMFps: s.energyAvg !== null ? s.energyAvg / s.machines : null,
    machineCost: m.cost,
    priority,
  };
  return { mod: designModule(req, PORTS[s.machine] ?? null, m.size, cat), req };
}

/** Contrôles d'un module : aucun chevauchement, chaque liaison réciproque, chaque port raccordé, pièces comptées. */
function checkModule(mod: ModulePlan, req: ModuleRequest, item: string): void {
    expect(mod.problems.filter((p) => p.level === "erreur"), item).toEqual([]);
    expect(mod.portsKnown).toBe(true);
    expect(mod.machines).toHaveLength(req.count);
    // Cases : un seul occupant (bâtiment, plot ou tuyau), poteaux compris.
    const seen = new Map<string, string>();
    const take = (k: string, who: string) => {
      expect(seen.get(k), `${item} : ${k} pris par ${seen.get(k)} et ${who}`).toBeUndefined();
      seen.set(k, who);
    };
    for (const m of mod.machines) for (const c of m.cells) take(key(c), m.id);
    for (const pc of mod.pieces) take(key(pc), `tuyau ${pc.net}`);
    expect(mod.machines.every((m) => m.cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < mod.width && c.y < mod.height))).toBe(true);
    // Liaisons : chaque liaison d'un tuyau mène à un tuyau du même réseau, à un port, ou au bord.
    const at = new Map(mod.pieces.map((p) => [key(p), p]));
    const linksOf = (x: number, y: number, net: string): Dir[] | null => {
      const p = at.get(`${x},${y}`);
      if (!p) return null;
      return p.net === net ? p.links : p.crossNet === net ? (p.crossLinks ?? []) : null;
    };
    const portCells = new Map(mod.machines.flatMap((m) => m.ports.map((p) => [key(p.cell), p] as const)));
    for (const pc of mod.pieces) {
      for (const [net, links] of [[pc.net, pc.links], ...(pc.crossNet ? [[pc.crossNet, pc.crossLinks ?? []]] : [])] as [string, Dir[]][]) {
        for (const d of links) {
          const n = add(pc, d);
          const back = linksOf(n.x, n.y, net);
          const toPort = portCells.get(key(pc))?.facing === OPPOSITE[d];
          const end = mod.nets.some((x) => x.id === net && x.end?.x === pc.x && x.end.y === pc.y && x.end.dir === d);
          expect(back?.includes(OPPOSITE[d]) || toPort || end, `${item} : ${key(pc)} → ${d} (${net})`).toBe(true);
        }
      }
    }
    // Chaque port utilisé touche un tuyau de sa ressource, ouvert vers lui.
    const used = mod.pieces.filter((p) => portCells.has(key(p)));
    expect(used.length).toBe(req.count * (req.inputs.length + req.outputs.length));
    // Croisement collé à un port : l'un de ses deux tuyaux s'ouvre vers lui.
    for (const p of used) expect([...p.links, ...(p.crossLinks ?? [])]).toContain(OPPOSITE[portCells.get(key(p))!.facing]);
    // Liste des pièces : machines, chaque tuyau, chaque poteau.
    const count = (id: string) => mod.parts.find((p) => p.id === id)?.count ?? 0;
    expect(count(req.machine)).toBe(req.count);
    expect(mod.parts.reduce((s, p) => s + p.count, 0)).toBe(req.count + mod.pieces.length + mod.poles.length);
}

describe("module d'une étape (chaîne du Crankshaft, 60/min)", () => {
  for (const [item, prio] of ["crankshaft", "steel-rod", "steel-ingot", "raw-iron", "coal"].flatMap((i) => [[i, PLACE], [i, PRIX]] as const)) {
    it(`${item} (${prio[0]} d'abord) : rien ne se chevauche, chaque port est raccordé, chaque réseau est continu`, () => {
      const { mod, req } = moduleFor(item, prio);
      checkModule(mod, req, item);
    });
  }

  it("double rangée pour 15 Craft Assemblers : plus compacte qu'une seule rangée", () => {
    const { mod } = moduleFor("crankshaft");
    expect(mod.template).toBe("double rangée");
    expect(mod.width * mod.height).toBeLessThan(15 * 9 * 12);
    expect(mod.poles.length).toBeGreaterThan(0);
  });

  it("ports au choix : chaque ressource peut prendre n'importe quel port de son type et de son sens", () => {
    const { req } = moduleFor("crankshaft");
    const opts = portAssignments(PORTS["craft-assembler"]!, req);
    expect(opts).toHaveLength(2); // deux entrées d'objets, deux ports d'entrée : deux façons
    for (const o of opts) expect(new Set(o.map((a) => a.port)).size).toBe(o.length);
    expect(opts.map((o) => o.filter((a) => a.role === "entrée").map((a) => a.port).join(","))).toEqual(["1,2", "2,1"]);
  });

  it("le prix d'abord : les raccords contournent les machines au lieu de croiser les collecteurs", () => {
    const compact = moduleFor("crankshaft", ["place", "prix", "forme", "pieces"]).mod;
    const cheap = moduleFor("crankshaft", PRIX).mod;
    const crossings = (m: ModulePlan) => m.pieces.filter((p) => p.role === "croisement").length;
    expect(cheap.cost).toBeLessThan(compact.cost * 0.7);
    expect(crossings(cheap)).toBeLessThan(crossings(compact) / 2);
    expect(cheap.width * cheap.height).toBeGreaterThanOrEqual(compact.width * compact.height);
    // Chacun annonce l'autre choix.
    expect(compact.other).toMatchObject({ first: "prix", width: cheap.width, height: cheap.height, crossings: crossings(cheap) });
    expect(cheap.other).toMatchObject({ first: "place", width: compact.width, height: compact.height });
  });

  it("collecteur collé aux machines : la place gagnée, et les croisements collés aux ports", () => {
    const { mod } = moduleFor("crankshaft", PLACE);
    expect(mod.height).toBeLessThanOrEqual(15); // 19 avant (rangée de raccord libre, deux files de poteaux)
    const ports = new Set(mod.machines.flatMap((m) => m.ports.map((p) => `${p.cell.x},${p.cell.y}`)));
    expect(mod.pieces.some((p) => p.role === "croisement" && ports.has(`${p.x},${p.y}`))).toBe(true);
    expect(new Set(mod.poles.map((p) => p.y)).size).toBe(1); // une seule file atteint toutes les prises
  });

  it("rangées repliées : la forme ramassée d'abord, des blocs empilés et des tuyaux principaux", () => {
    const { req, mod: flat } = moduleFor("raw-iron", PLACE);
    const { mod } = moduleFor("raw-iron", ["forme", "place", "prix", "pieces"]);
    expect(mod.folds).toBeGreaterThan(1);
    expect(Math.max(mod.width, mod.height)).toBeLessThan(Math.max(flat.width, flat.height));
    checkModule(mod, req, "raw-iron replié");
    // Une arrivée ou un départ par ressource, par le haut.
    expect(mod.nets.every((n) => n.end?.dir === "N" && n.end.y === 0)).toBe(true);
    // Le plan le plus compact annonce la version repliée (2e critère : la forme).
    expect(flat.other).toMatchObject({ first: "forme" });
  });

  it("bouts des collecteurs au choix (redesign) : même disposition, sorties et entrées tournées", () => {
    const { mod, req } = moduleFor("steel-rod", PLACE);
    const out = req.outputs[0]!.item;
    const inn = req.inputs[0]!.item;
    const r = redesign(mod, { ...req, ends: { [out]: "début", [inn]: "fin" } }, PORTS["roller"]!, null, cat)!;
    expect(r).not.toBeNull();
    expect([r.width, r.height]).toEqual([mod.width, mod.height]);
    expect(r.nets.find((n) => n.item === out)!.end!.dir).toBe("W");
    expect(r.nets.find((n) => n.item === inn)!.end!.dir).toBe("E");
    checkModule(r, req, "steel-rod tourné");
    // Module replié : le tuyau principal change de côté.
    const fold = moduleFor("raw-iron", ["forme", "place", "prix", "pieces"]);
    const item = fold.req.outputs[0]!.item;
    const f = redesign(fold.mod, { ...fold.req, ends: { [item]: "début" } }, PORTS["iron-drill"]!, null, cat)!;
    expect(f.folds).toBe(fold.mod.folds);
    expect(f.nets.find((n) => n.item === item)!.end!.x).toBeLessThan(f.width / 2);
    expect(fold.mod.nets.find((n) => n.item === item)!.end!.x).toBeGreaterThan(fold.mod.width / 2);
    checkModule(f, fold.req, "raw-iron replié, sortie à gauche");
  });

  it("ordre des critères : complété et sans doublon", () => {
    expect(normalPriority(undefined)).toEqual(["place", "forme", "prix", "pieces"]);
    expect(normalPriority(["pieces"])).toEqual(["pieces", "place", "forme", "prix"]);
    expect(normalPriority(["prix", "prix", "x" as PoseCriterion])).toEqual(["prix", "place", "forme", "pieces"]);
  });

  it("option « tier III seulement » : aucun tuyau de tier I", () => {
    const { req } = moduleFor("steel-rod");
    const mod = designModule({ ...req, tier3Only: true }, PORTS["roller"]!, null, cat);
    expect(mod.nets.every((n) => n.pipe?.tier === 3)).toBe(true);
    expect(mod.parts.some((p) => p.id === "short-pipe")).toBe(false);
  });

  it("au-delà d'un tuyau (120/s) : plusieurs collecteurs en parallèle, chacun sous sa capacité", () => {
    const { req } = moduleFor("steel-rod");
    const big = { ...req, count: 24, inputs: req.inputs.map((f) => ({ ...f, perMin: f.perMin * 3 * 24 / req.count })), outputs: req.outputs.map((f) => ({ ...f, perMin: 9000 })) };
    const mod = designModule(big, PORTS["roller"]!, null, cat);
    const out = mod.nets.filter((n) => n.item === "steel-rod");
    expect(out.map((n) => n.line)).toEqual([1, 2]);
    for (const n of out) expect(n.perSec).toBeLessThanOrEqual(n.pipe!.flowPerSec);
    expect(mod.problems.filter((p) => p.level === "erreur")).toEqual([]);
  });

  it("bâtiment non relevé : ports supposés, et le plan le dit", () => {
    const { mod } = moduleFor("liquid-iron");
    expect(mod.portsKnown).toBe(false);
    expect(mod.assumptions[0]).toMatch(/Ports supposés/);
  });
});

describe("vue du plan de pose", () => {
  it("dessine chaque machine, chaque poteau et une légende par ressource ; échappe les noms", async () => {
    const { renderModuleInfo, renderModuleSvg } = await import("../../ui/module-view.ts");
    const { mod } = moduleFor("steel-rod");
    const name = (id: string) => (id === "steel-rod" ? "<b>Rod</b>" : (data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id));
    const svg = renderModuleSvg(mod, name).svg;
    expect((svg.match(/<g class="mm">/g) ?? []).length).toBe(mod.count);
    expect((svg.match(/<g class="pole">/g) ?? []).length).toBe(mod.poles.length);
    const info = renderModuleInfo(mod, name);
    expect((info.legend.match(/<li><i style/g) ?? []).length).toBe(mod.nets.length);
    expect(info.details).toContain("Ordre de pose");
    expect(svg + info.legend + info.details).not.toContain("<b>Rod</b>");
  });
});
