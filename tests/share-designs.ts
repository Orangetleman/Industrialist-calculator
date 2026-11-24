// Designs plausibles pour les tests et les mesures du partage (lot P1) : de vrais plans du site (Gearbox,
// Crankshaft…) passés en graphe (comme G1–G6), le graphe importé d'Industrialist Calculator (fixture G5),
// et leurs usines converties en bac à sable (comme l'export .msch). Lu par les tests seulement.

import energyJson from "../data/energy.json";
import interfacesJson from "../data/interfaces.json";
import itemsJson from "../data/items.json";
import logisticsJson from "../data/logistics.json";
import machinesJson from "../data/machines.json";
import modularJson from "../data/modular.json";
import overridesJson from "../data/overrides.json";
import mapJson from "../data/pollywrath-map.json";
import portsJson from "../data/ports.json";
import powerJson from "../data/power.json";
import recipesJson from "../data/recipes.json";
import relevesJson from "../data/releves.json";
import researchJson from "../data/research.json";
import gearboxSave from "../src/ui/fixtures/pollywrath-gearbox-tutorial.json";
import { buildCatalog } from "../src/engine/build/catalog.ts";
import { designFactory, factoryInput } from "../src/engine/build/factory.ts";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../src/engine/extension-types.ts";
import { applyCommand, planToGraph, pollywrathToGraph, type Graph, type PollywrathMapFile } from "../src/engine/graph/index.ts";
import { buildSandboxCatalog, type Layout } from "../src/engine/sandbox/index.ts";
import { layoutFromFactory } from "../src/engine/schematic/convert.ts";
import { solve, type Plan } from "../src/engine/solve.ts";
import type { GraphEdit } from "../src/ui/graph-edit.ts";
import { defaultSettingsV1 } from "../src/engine/share/msch.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
export const { data } = buildGameData(files, [overridesJson as never]);
const player = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const world = { pollutionPct: 0 };
const fluid = (id: string) => !!data.items.get(id)?.isFluid;
const ports = portsJson as unknown as PortsFile;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const sb = buildSandboxCatalog(data, { ports, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson });
const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;

const plans = new Map<string, Plan>();
/** Plan du site, tout débloqué (même plan pour la même demande : l'usine calculée se réutilise). */
export function planFor(item: string, ratePerMin: number): Plan {
  const k = `${item}|${ratePerMin}`;
  if (!plans.has(k)) plans.set(k, solve(data, player, { item, ratePerMin, tiers: false }));
  return plans.get(k)!;
}

/** L'usine du plan, convertie en bac à sable (ce que le joueur exporte aujourd'hui en .msch). */
const factories = new Map<Plan, Map<string, Layout>>();
export function factoryLayout(plan: Plan, size = { w: 160, h: 110 }): Layout {
  const k = `${size.w}x${size.h}`, known = factories.get(plan)?.get(k);
  if (known) return known;
  const f = designFactory(factoryInput(plan, { name, isFluid: fluid, machine: (id) => data.machines.get(id) ?? null, ports: ports.machines }, cat, size, { priority: ["forme", "place", "prix", "pieces"] }));
  const l = layoutFromFactory(f, sb, cat, fluid).layout;
  if (!factories.has(plan)) factories.set(plan, new Map());
  factories.get(plan)!.set(k, l);
  return l;
}

/** Graphe du plan, retouché comme en G3–G5 : un nœud déplacé, un nombre fixé, un groupe replié. */
export function editedGraph(plan: Plan): Graph {
  let g = planToGraph(plan).graph;
  const [a, b, c] = g.nodes;
  if (a) g = applyCommand(g, { type: "move", moves: [{ id: a.id, x: a.x + 37.5, y: a.y - 12 }] }, data, world);
  if (b) g = applyCommand(g, { type: "setMachines", id: b.id, machines: 2.25 }, data, world);
  if (b) g = applyCommand(g, { type: "setFixed", id: b.id, fixed: true }, data, world);
  if (b && c) g = applyCommand(g, { type: "group", id: "g1", name: "Bloc fer", nodes: [b.id, c.id] }, data, world);
  if (b && c) g = applyCommand(g, { type: "setGroup", id: "g1", collapsed: true }, data, world);
  return g;
}

export const editOf = (sig: string, graph: Graph, solved: Graph | null = null): GraphEdit => ({ sig, graph, solved, touched: true });

export const pollywrathGraph = (): Graph => pollywrathToGraph(gearboxSave, data, mapJson as unknown as PollywrathMapFile, { world })!.graph;

export const settingsWith = (patch: Record<string, unknown>) => ({ ...defaultSettingsV1(), ...patch });
