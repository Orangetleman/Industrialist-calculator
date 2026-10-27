// S42 : l'accélération du placement des modules ne change aucun plan (empreintes relevées avec le code d'avant S42,
// sur les données du moment : à relever de nouveau si les données changent).
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
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

const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
const look = { name, isFluid: (id: string) => !!data.items.get(id)?.isFluid, machine: (id: string) => data.machines.get(id) ?? null, ports: (portsJson as unknown as PortsFile).machines };

const CASES = [
  { item: "crankshaft", priority: ["place", "forme", "prix", "pieces"] },
  { item: "crankshaft", priority: ["forme", "place", "prix", "pieces"] },
] as const;

export const empreinte = (item: string, priority: readonly string[]) => {
  const plan = solve(data, { unlocked: new Set(data.nodes.keys()) }, { item, ratePerMin: 60, criterion: "energy", tiers: false });
  const f = designFactory(factoryInput(plan, look, cat, { w: 160, h: 110 }, { priority: [...priority] } as never, { full: true }));
  return createHash("sha256").update(JSON.stringify(f)).digest("hex").slice(0, 16);
};

it("toute l'usine : mêmes plans qu'avant S42", () => {
  const got = CASES.map((c) => `${c.item}/${c.priority[0]}=${empreinte(c.item, c.priority)}`);
  console.info(got.join("\n"));
  expect(got).toEqual(EXPECTED);
}, 900000);

const EXPECTED = ["crankshaft/place=c681dcfa9df59fd5", "crankshaft/forme=d098178f5d4f3392"];

it("S42 : avec une limite de temps dépassée, un plan complet est quand même rendu, marqué « abrégé »", () => {
  const plan = solve(data, { unlocked: new Set(data.nodes.keys()) }, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
  const f = designFactory(factoryInput(plan, look, cat, { w: 160, h: 110 }, { priority: ["place", "forme", "prix", "pieces"] } as never, { full: true, budgetMs: 1 }));
  expect(f.cut).toBe(true);
  expect(f.boxes.length).toBeGreaterThan(0);
  expect(f.nets.length).toBeGreaterThan(0);
}, 120000);
