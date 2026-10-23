// Réglage « Machines » d'un plan (S9) : changements, résumé, messages de la réponse et du schéma.
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import { solve, type Plan } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { allowMachine, banMachine, filterSummary, findMachine, planMachineIds, renderFilterBody, withMode } from "./mfilter-view.ts";
import { renderAnswer, renderFlowHud, type ViewCtx } from "./plan-view.ts";
import { DEFAULT_SETTINGS, engineFilter, NO_FILTER, planKey, planMachines, type PlanMachines, type Settings } from "./state.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const ctx = { data };
const run = (pm: PlanMachines) => solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", then: ["machines"], tiers: false, machines: engineFilter(pm) });
const base = run(NO_FILTER);
const view = (plan: Plan, pm: PlanMachines): ViewCtx => {
  const settings: Settings = { ...DEFAULT_SETTINGS, machineFilters: { "objet|crankshaft": pm } };
  return { data, plan, settings, corrections: {}, goal: "objet" };
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("clé et filtre du plan", () => {
  it("un filtre par objet, un pour l'énergie et l'argent, aucun pour les RP", () => {
    expect(planKey("objet", "crankshaft")).toBe("objet|crankshaft");
    expect(planKey("énergie", "crankshaft")).toBe("énergie");
    expect(planKey("recherche", "crankshaft")).toBeNull();
    const s = { machineFilters: { "objet|gear": { ...NO_FILTER, mode: "exclure" as const, exclure: ["press-mk2"] } } };
    expect(planMachines(s, "objet|gear").exclure).toEqual(["press-mk2"]);
    expect(planMachines(s, "objet|crankshaft")).toBe(NO_FILTER);
  });
  it("pour le moteur : « toutes » ou « exclure » vide → pas de filtre", () => {
    expect(engineFilter(NO_FILTER)).toBeNull();
    expect(engineFilter({ ...NO_FILTER, mode: "exclure" })).toBeNull();
    expect(engineFilter({ ...NO_FILTER, mode: "seulement", seulement: ["roller"], noExtraction: ["tree"] })).toEqual({ mode: "seulement", ids: ["roller"], noExtraction: ["tree"] });
  });
});

describe("changements", () => {
  it("« Seulement… » part des machines de fabrication du plan affiché", () => {
    const pm = withMode(ctx, NO_FILTER, "seulement", base);
    expect(pm.seulement.sort()).toEqual(["blast-furnace", "craft-assembler", "electric-furnace", "ingot-molder", "press-mk2", "roller"]);
    // Et le plan est le même qu'avant.
    expect(run(pm).steps.map((s) => s.recipeId)).toEqual(base.steps.map((s) => s.recipeId));
    // Une liste déjà choisie est gardée.
    expect(withMode(ctx, { ...NO_FILTER, seulement: ["roller"] }, "seulement", base).seulement).toEqual(["roller"]);
  });
  it("ne plus utiliser / permettre, dans chaque mode", () => {
    const ex = banMachine(ctx, NO_FILTER, "blast-furnace");
    expect(ex).toMatchObject({ mode: "exclure", exclure: ["blast-furnace"] });
    expect(allowMachine(ctx, ex, "blast-furnace").exclure).toEqual([]);
    const only = { ...NO_FILTER, mode: "seulement" as const, seulement: ["roller", "press-mk2"] };
    expect(banMachine(ctx, only, "roller").seulement).toEqual(["press-mk2"]);
    expect(banMachine(ctx, only, "tree").noExtraction).toEqual(["tree"]);
    expect(allowMachine(ctx, { ...only, noExtraction: ["tree"] }, "tree").noExtraction).toEqual([]);
    expect(allowMachine(ctx, only, "blast-furnace").seulement).toEqual(["roller", "press-mk2", "blast-furnace"]);
  });
  it("une machine cherchée par son nom", () => {
    expect(findMachine(ctx, "blast furnace")).toBe("blast-furnace");
    expect(findMachine(ctx, "Blast Furnace MK")).toBe("blast-furnace-mk2");
    expect(findMachine(ctx, "zzz")).toBeNull();
  });
});

describe("affichage", () => {
  it("résumé replié", () => {
    expect(filterSummary(ctx, NO_FILTER)).toBeNull();
    expect(filterSummary(ctx, { ...NO_FILTER, mode: "exclure", exclure: ["blast-furnace"] })).toBe("toutes sauf Blast Furnace");
    const six = withMode(ctx, NO_FILTER, "seulement", base);
    expect(filterSummary(ctx, six)).toBe("seulement 6 machines (+ l'extraction)");
    expect(filterSummary(ctx, { ...six, noExtraction: ["tree"] })).toBe("seulement 6 machines (+ l'extraction, sauf Tree)");
  });
  it("réglage ouvert : machines du plan en raccourcis ; extraction du plan en mode « seulement »", () => {
    const ex = renderFilterBody(ctx, { ...NO_FILTER, mode: "exclure", exclure: ["blast-furnace"] }, base);
    expect(ex.chips).toContain('data-mf-allow="blast-furnace"');
    expect(ex.more).toContain('data-mf-ban="roller"');
    expect(ex.more).not.toContain('data-mf-ban="blast-furnace"');
    const only = renderFilterBody(ctx, { ...withMode(ctx, NO_FILTER, "seulement", base), noExtraction: ["tree"] }, base);
    expect(text(only.more)).toContain("Extraction, permise d'office");
    expect(only.more).toContain('data-mf-ban="iron-drill"');
    expect(only.more).toContain('data-mf-allow="tree"');
    expect(planMachineIds(ctx, base)).toContain("tree");
  });
  it("réponse : « Aucune machine permise ne fabrique » avec « Permettre … »", () => {
    const pm: PlanMachines = { ...NO_FILTER, mode: "exclure", exclure: ["blast-furnace", "blast-furnace-mk2"] };
    const html = renderAnswer(view(run(pm), pm));
    const t = text(html);
    expect(t).toContain("Aucune machine permise ne fabrique Steel Ingot (360/min manquent)");
    expect(html).toContain('data-mf-allow="blast-furnace-mk2"');
    // S28 : le filtre se lit (et s'annule) dans la barre « Ton plan », plus dans la réponse.
    expect(t).not.toContain("Filtre de machines");
  });
  it("schéma : « Ne plus utiliser » sur un bloc de machine, pas sur l'objectif RP", () => {
    const v = view(base, NO_FILTER);
    const hud = renderFlowHud(v, "steel-ingot", () => "depot");
    expect(hud).toContain('data-mf-ban="blast-furnace"');
    expect(text(hud)).toContain("Ne plus utiliser Blast Furnace");
    expect(renderFlowHud({ ...v, goal: "recherche" }, "steel-ingot", () => "depot")).not.toContain("data-mf-ban");
  });
});
