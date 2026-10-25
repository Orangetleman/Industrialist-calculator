// Filtre de machines d'un plan (S9), sur la chaîne du Crankshaft (données du site, tout débloqué).
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "./data.ts";
import { isExtractor, machineAllowed, type MachineFilter } from "./machine-filter.ts";
import { solve } from "./solve.ts";
import type { OverridesFile } from "./types.ts";
import { say } from "../ui/engine-text.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
// Priorités du site pour un objet (énergie d'abord).
const crankshaft = (machines?: MachineFilter, extra = {}) =>
  solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", then: ["machines", "cost", "pollution", "area", "raw", "steps"], tiers: false, machines, ...extra });
const machinesOf = (p: ReturnType<typeof crankshaft>) => new Set(p.steps.map((s) => s.machine));
const FAB = ["craft-assembler", "press-mk2", "roller", "blast-furnace", "ingot-molder", "electric-furnace"];

describe("extraction", () => {
  it("catégorie « Extractors » du wiki et arbres ; pas les machines de fabrication", () => {
    for (const id of ["iron-drill", "coal-drill", "water-pump", "tree"]) expect(isExtractor(data.machines.get(id)), id).toBe(true);
    for (const id of ["blast-furnace", "craft-assembler", "press-mk2"]) expect(isExtractor(data.machines.get(id)), id).toBe(false);
  });
  it("mode « seulement » : extraction permise d'office, sauf celles qu'on écarte", () => {
    const ok = machineAllowed(data, { mode: "seulement", ids: ["roller"], noExtraction: ["tree"] })!;
    expect(ok("roller")).toBe(true);
    expect(ok("iron-drill")).toBe(true);
    expect(ok("tree")).toBe(false);
    expect(ok("press-mk2")).toBe(false);
  });
  it("« exclure » sans machine : pas de filtre", () => {
    expect(machineAllowed(data, { mode: "exclure", ids: [] })).toBeNull();
    expect(crankshaft({ mode: "exclure", ids: [] }).steps.length).toBe(crankshaft().steps.length);
  });
});

describe("exclure", () => {
  it("sans Blast Furnace, Steel Ingot passe sur une autre machine", () => {
    const base = crankshaft();
    expect(machinesOf(base).has("blast-furnace")).toBe(true);
    const p = crankshaft({ mode: "exclure", ids: ["blast-furnace"] });
    expect(p.status).toBe("ok");
    expect(machinesOf(p).has("blast-furnace")).toBe(false);
    expect(p.steps.find((s) => s.item === "steel-ingot")?.machine).toBe("blast-furnace-mk2");
    // Le craft écarté est signalé parmi les candidats (onglet Détails).
    expect(p.steps.find((s) => s.item === "steel-ingot")?.alternatives.some((c) => c.machine === "blast-furnace" && c.status === "écartée")).toBe(true);
  });
  it("un objet que plus aucune machine permise ne fabrique : « Aucune machine permise ne fabrique »", () => {
    const p = crankshaft({ mode: "exclure", ids: ["blast-furnace", "blast-furnace-mk2"] });
    expect(p.status).toBe("partiel");
    const u = p.unresolved.find((x) => x.item === "steel-ingot")!;
    expect(u.reason).toBe("machine écartée");
    expect(u.excluded?.sort()).toEqual(["blast-furnace", "blast-furnace-mk2"]);
    const w = p.warnings.find((x) => x.code === "non-résolu:machine écartée")!;
    expect(say(w.message)).toContain("Aucune machine permise ne fabrique Steel Ingot");
    expect(say(w.message)).toContain("Blast Furnace, Blast Furnace MK2 sont écartées");
  });
  it("l'objectif lui-même : plan impossible, avec la raison", () => {
    const p = crankshaft({ mode: "exclure", ids: ["craft-assembler", "advanced-assembler"] });
    expect(p.status).toBe("impossible");
    expect(p.warnings.some((w) => say(w.message).startsWith("Aucune machine permise ne fabrique Crankshaft"))).toBe(true);
  });
  it("une recette forcée dont la machine est écartée est ignorée, avec la raison", () => {
    const rid = crankshaft().steps.find((s) => s.item === "steel-ingot")!.recipeId;
    const p = crankshaft({ mode: "exclure", ids: ["blast-furnace"] }, { forced: { "steel-ingot": rid } });
    expect(machinesOf(p).has("blast-furnace")).toBe(false);
    expect(say(p.warnings.find((w) => w.code === "forcée-invalide")!.message)).toContain("sa machine est écartée par le filtre de machines");
  });
  it("le filtre vaut aussi pour les machines fixées dans le schéma (S8)", () => {
    const p = crankshaft({ mode: "exclure", ids: ["blast-furnace"] }, { fixedMachines: { crankshaft: 10 } });
    expect(p.fixed?.rate).toBeCloseTo(40, 6);
    expect(machinesOf(p).has("blast-furnace")).toBe(false);
  });
});

describe("seulement", () => {
  it("les machines de fabrication du plan, et l'extraction d'office : même plan que sans filtre", () => {
    const base = crankshaft();
    const p = crankshaft({ mode: "seulement", ids: FAB });
    expect(p.steps.map((s) => `${s.key}:${s.recipeId}:${s.machines}`)).toEqual(base.steps.map((s) => `${s.key}:${s.recipeId}:${s.machines}`));
  });
  it("sans arbres : Steel Ingot se fait au charbon", () => {
    const p = crankshaft({ mode: "seulement", ids: FAB, noExtraction: ["tree"] });
    expect(p.status).toBe("ok");
    expect(p.totals.farms).toBe(0);
    expect(machinesOf(p).has("tree")).toBe(false);
    expect(p.steps.some((s) => s.item === "coke-fuel")).toBe(false);
  });
  it("aucune machine de fabrication : rien n'est possible, la raison est donnée", () => {
    const p = crankshaft({ mode: "seulement", ids: [] });
    expect(p.status).toBe("impossible");
    expect(p.unresolved[0]?.reason).toBe("machine écartée");
  });
  it("générateurs : ils suivent le filtre (produire sa propre énergie)", () => {
    const own = crankshaft(undefined, { selfPowered: true });
    const gens = own.steps.filter((s) => s.energyAvg !== null && s.energyAvg < 0).map((s) => s.machine);
    expect(gens.length).toBeGreaterThan(0);
    const p = crankshaft({ mode: "exclure", ids: gens }, { selfPowered: true });
    for (const g of gens) expect(machinesOf(p).has(g)).toBe(false);
  });
});
