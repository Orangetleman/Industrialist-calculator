// Page « Méthodes de calcul » (remarque n° 16) : l'exemple Purple Gold vient du vrai moteur, et chaque
// priorité du site a son explication.
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import interfacesJson from "../../data/interfaces.json";
import modularJson from "../../data/modular.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import { fr } from "../i18n/fr.ts";
import { exampleRows, renderExample } from "./methods-view.ts";
import { parseRoute, routeHash } from "./route.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as never]);

describe("méthodes de calcul", () => {
  it("adresse #methodes", () => {
    expect(parseRoute("#methodes")).toEqual({ page: "methodes" });
    expect(routeHash({ page: "methodes" })).toBe("#methodes");
  });

  it("chaque priorité a son explication et sa limite", () => {
    for (const c of ["machines", "energy", "cost", "pollution", "area", "raw", "steps"]) {
      expect(fr).toHaveProperty(`me.c.${c}.html`);
      expect(fr).toHaveProperty(`me.c.${c}.lim.html`);
    }
  });

  it("exemple Purple Gold : chaque priorité est la meilleure sur sa propre mesure", () => {
    const rows = exampleRows(data)!;
    expect(rows).toHaveLength(8);
    const [machines, cost, pollution, , area] = rows;
    const opt = rows.slice(0, -1);
    expect(machines!.machines).toBe(Math.min(...opt.map((r) => r.machines)));
    expect(cost!.cost).toBe(Math.min(...opt.map((r) => r.cost)));
    expect(pollution!.pollution).toBe(Math.min(...opt.map((r) => r.pollution)));
    expect(area!.area).toBe(Math.min(...opt.map((r) => r.area)));
    // L'optimiseur ne fait pas moins bien que l'ancien moteur en machines.
    expect(machines!.machines).toBeLessThanOrEqual(rows.at(-1)!.machines);
    const html = renderExample(rows);
    expect(html).toContain("me-best");
    expect(html).not.toMatch(/NaN|undefined/);
  });
});
