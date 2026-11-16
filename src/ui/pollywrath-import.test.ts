// Import d'un graphe du calculateur de Pollywrath (remarque n°16). Fichier exemple : le tutoriel
// « Gearbox » de son dépôt (Pollywrath/Industrialist-Production-Calculator, licence MIT).
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import modularJson from "../../data/modular.json";
import overridesJson from "../../data/overrides.json";
import mapJson from "../../data/pollywrath-map.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import { solve } from "../engine/solve.ts";
import gearbox from "./fixtures/pollywrath-gearbox-tutorial.json";
import { cleanImportedGraph, parsePollywrathSave, type PollywrathMap } from "./pollywrath-import.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as never]);
const map = mapJson as unknown as PollywrathMap;

describe("import d'un graphe Industrialist Calculator", () => {
  const res = parsePollywrathSave(gearbox, data, map);

  it("objectif : l'objet du nœud cible, au débit de ses 30 machines", () => {
    const r = data.recipes.get("craft_assembler_06")!;
    const [item, q] = Object.entries(r.outputs)[0]!;
    expect(res.item).toBe(item);
    expect(res.ratePerMin).toBeCloseTo(((30 * q!) / r.durationS!) * 60, 3);
    expect(res.graph.name).toBe("Gearbox Tutorial");
  });

  it("recettes reconnues par contenu, pas par numéro ; machines additionnées (deux Oil Rig)", () => {
    expect(res.graph.recipes).toContain("roller_03");
    expect(res.graph.recipes).toContain("coal_drill_01");
    expect(res.graph.theirs.oil_rig_01).toBeCloseTo(8.333333333333 + 7.407407407407, 9);
    for (const id of res.graph.recipes) expect(data.recipes.has(id)).toBe(true);
  });

  it("recettes sans équivalent signalées par leur identifiant, jamais inventées", () => {
    expect(Object.keys(res.graph.unknown).sort()).toEqual(["r_boiler_01", "r_gas_burner_01", "r_steam_cracking_plant_01", "r_van_depot_01"]);
    expect(res.graph.unknown.r_van_depot_01).toBe("r_van_depot_01");
  });

  it("le solveur utilise seulement ces recettes pour les objets qu'elles produisent", () => {
    const plan = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 }, { item: res.item, ratePerMin: res.ratePerMin, onlyRecipes: res.graph.recipes, tiers: false });
    // Mêmes recettes que leur graphe pour la chaîne principale, et mêmes nombres de machines.
    const at = (id: string) => plan.steps.find((s) => s.recipeId === id)?.machines;
    for (const [id, n] of Object.entries({ craft_assembler_05: 30, roller_04: 32, roller_03: 16, press_03: 32, blast_furnace_02: 10, blast_furnace_03: 10, industrial_plastic_molder_02: 8 })) expect(at(id)).toBe(n);
    expect(plan.steps.some((s) => s.recipeId === "craft_assembler_06")).toBe(true);
  });

  it("fichiers refusés avec un message clair", () => {
    expect(() => parsePollywrathSave({ foo: 1 }, data, map)).toThrow();
    expect(() => parsePollywrathSave({ data: { nodes: [] } }, data, map)).toThrow();
    const noTarget = { data: { nodes: gearbox.data.nodes.map((n) => ({ ...n, isTarget: false })) } };
    expect(() => parsePollywrathSave(noTarget, data, map)).toThrow();
  });

  it("graphe gardé dans les réglages : relu, ou écarté s'il est abîmé", () => {
    expect(cleanImportedGraph(JSON.parse(JSON.stringify(res.graph)))).toEqual(res.graph);
    expect(cleanImportedGraph({ name: "x", recipes: [] })).toBeNull();
    expect(cleanImportedGraph("x")).toBeNull();
  });
});
