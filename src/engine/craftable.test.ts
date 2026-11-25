import { expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import modularJson from "../../data/modular.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { craftableItems } from "./craftable.ts";
import { buildGameData } from "./data.ts";
import { solve } from "./solve.ts";

it("un objet marqué « pas fabricable » ne donne aucun plan, même tout débloqué ; les autres ne sont pas marqués à tort", () => {
  const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as never, [overridesJson as never]);
  const t0 = performance.now();
  const ok = craftableItems(data);
  console.log(`durée : ${(performance.now() - t0).toFixed(0)} ms`);
  expect(ok.has("8x-microchip")).toBe(true);
  for (const id of ["liquid-argon", "liquid-oxygen"]) expect(ok.has(id)).toBe(true);
  for (const id of ["2x-microchip", "microchip-scrap"]) expect(ok.has(id)).toBe(false);
  const marked = [...data.items.keys()].filter((id) => !ok.has(id));
  console.log("marqués :", marked.join(", "));
  const unlocked = new Set(data.nodes.keys());
  for (const item of marked) expect(solve(data, { unlocked, pollutionPct: 0 }, { item, ratePerMin: 60, tiers: false }).steps, item).toEqual([]);
}, 120000);
