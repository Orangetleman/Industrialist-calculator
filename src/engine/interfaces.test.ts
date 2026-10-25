// Interfaces des machines (S10) : données, position à mettre pour un craft (le mouleur), écran
// chiffré de la Chemical Plant (valeurs du wiki à 1×, multipliées par le réglage du plan).
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "./data.ts";
import type { InterfacesFile } from "./extension-types.ts";
import { applyMachineSettings, checkInterface, choicesFor, choiceText, factorsFor, hasEffect, type MachineSettings } from "./interfaces.ts";
import { solve } from "./solve.ts";
import type { OverridesFile } from "./types.ts";
import { say } from "../ui/engine-text.ts";

const ifaces = (interfacesJson as unknown as InterfacesFile).machines;
const base = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData({ ...base, interfaces: interfacesJson as unknown as InterfacesFile }, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
// Priorités du site pour un objet (énergie d'abord).
const plan = (item: string, settings: MachineSettings = {}, extra = {}) =>
  solve(applyMachineSettings(data, ifaces, settings), all, { item, ratePerMin: 60, criterion: "energy", then: ["machines", "cost", "pollution", "area", "raw", "steps"], tiers: false, ...extra });
const stepOf = (p: ReturnType<typeof plan>, machine: string) => p.steps.find((s) => s.machine === machine);
const settingOf = (machine: string, recipeId: string) => choicesFor(ifaces[machine], recipeId).map((x) => say(choiceText(ifaces[machine]!, x.setting, x.choice)));

describe("données des interfaces", () => {
  it("machines connues, crafts de la bonne machine, chaque interface sourcée et vérifiée", () => {
    for (const [id, i] of Object.entries(ifaces)) {
      expect(data.machines.has(id), id).toBe(true);
      expect(i.sources.length, id).toBeGreaterThan(0);
      const own = [...data.recipes.values()].filter((r) => r.machine === id).map((r) => r.id);
      expect(checkInterface(i, own), id).toEqual([]);
      // Sans effet sur le calcul : il faut dire pourquoi.
      if (!hasEffect(i)) expect(i.effect, id).toBeTruthy();
    }
  });
  it("chaque craft des machines à positions a sa position", () => {
    for (const id of ["plastic-molding-machine", "industrial-plastic-molder", "quarry"]) {
      for (const r of [...data.recipes.values()].filter((x) => x.machine === id)) expect(settingOf(id, r.id), r.id).toHaveLength(1);
    }
  });
});

describe("le mouleur : le plan dit la position du levier", () => {
  it("Gearbox 60/min : 4 Industrial Plastic Molder, levier sur « container »", () => {
    const s = stepOf(plan("gearbox"), "industrial-plastic-molder")!;
    expect(s.item).toBe("plastic-casing");
    expect(s.machines).toBe(4);
    expect(settingOf(s.machine, s.recipeId)).toEqual(["levier sur « container »"]);
  });
  it("Plastic Bottle : levier sur « bottle » ; Hardened Plastic Casing : « container »", () => {
    expect(settingOf("industrial-plastic-molder", stepOf(plan("plastic-bottle"), "industrial-plastic-molder")!.recipeId)).toEqual(["levier sur « bottle »"]);
    expect(settingOf("industrial-plastic-molder", "industrial_plastic_molder_03")).toEqual(["levier sur « container »"]);
    expect(settingOf("plastic-molding-machine", "plastic_molding_machine_02")).toEqual(["levier sur « container »"]);
  });
  it("Quarry : écran à l'avant, choix définitif", () => {
    const s = stepOf(plan("clay-brick"), "quarry")!;
    expect(settingOf("quarry", s.recipeId)).toEqual(["Écran à l'avant : « Soil & Clay »"]);
    expect(ifaces.quarry!.once).toBe(true);
  });
});

describe("écran de la Chemical Plant", () => {
  it("les valeurs « variables » du wiki ne bloquent plus : la Hardened Plastic Casing se calcule", () => {
    for (const r of [...data.recipes.values()].filter((x) => x.machine === "chemical-plant")) {
      expect(r.verify.filter((f) => f.mode?.startsWith("plant_speed")), r.id).toEqual([]);
    }
    // Sans le fichier des interfaces : elles restent « à vérifier » (comportement d'avant S10).
    const old = buildGameData(base, [overridesJson as unknown as OverridesFile]).data;
    expect(old.recipes.get("chemical_plant_02")!.verify.some((f) => f.reason === "variable")).toBe(true);
    const p = plan("hardened-plastic-casing");
    expect(p.unresolved.filter((u) => u.item === "hardened-plastic-pellets")).toEqual([]);
    expect(stepOf(p, "chemical-plant")).toBeDefined();
  });
  it("1× : les données ne changent pas", () => {
    expect(applyMachineSettings(data, ifaces, {})).toBe(data);
    expect(applyMachineSettings(data, ifaces, { "chemical-plant": { input: 1, output: 1, power: 1 } })).toBe(data);
  });
  it("entrées × 1,67, sorties × 2, énergie × 4 : les crafts sont multipliés, l'original est gardé", () => {
    const set = { "chemical-plant": { input: 1.67, output: 2, power: 4 } };
    expect(factorsFor(ifaces["chemical-plant"], set["chemical-plant"])).toEqual({ inputs: 1.67, outputs: 2, energy: 4 });
    const d = applyMachineSettings(data, ifaces, set);
    const r = d.recipes.get("chemical_plant_02")!;
    expect(r.outputs["hardened-plastic-pellets"]).toBe(100);
    expect(r.inputs.ammonia).toBeCloseTo(41.75, 9);
    expect(r.inputs.naphtha).toBeCloseTo(8.35, 9);
    expect(r.energyMFps).toBe(4_000_000);
    expect(r.screen?.base.outputs["hardened-plastic-pellets"]).toBe(50);
    expect(r.durationS).toBe(5);
    // data intact, autres machines inchangées (mêmes objets).
    expect(data.recipes.get("chemical_plant_02")!.outputs["hardened-plastic-pellets"]).toBe(50);
    expect(d.recipes.get("craft_assembler_05")).toBe(data.recipes.get("craft_assembler_05"));
    expect(d.producers.get("hardened-plastic-pellets")).toContain(r);
  });
  it("dans le plan : débit doublé, énergie par objet doublée (vitesse + efficacité au plus)", () => {
    const a = stepOf(plan("hardened-plastic-casing"), "chemical-plant")!;
    const set = { "chemical-plant": { input: 1.67, output: 2, power: 4 } };
    const steps = plan("hardened-plastic-casing", set).steps.filter((s) => s.machine === "chemical-plant");
    const b = steps.find((s) => s.item === a.item)!;
    expect(b.ratePerMachine).toBeCloseTo(a.ratePerMachine * 2, 9);
    expect(b.demandPerMin).toBeCloseTo(a.demandPerMin, 6);
    expect(b.machinesExact).toBeCloseTo(a.machinesExact / 2, 9);
  });
});
