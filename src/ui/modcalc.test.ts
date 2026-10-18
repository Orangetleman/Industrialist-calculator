// Machines modulaires dans le site (S13) : bloc « Calcul » de l'éditeur, ferme et moteur dans
// « Comment c'est calculé ».
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import modularJson from "../../data/modular.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import type { ModularFile } from "../engine/modular.ts";
import { solve } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { renderStepCalc } from "./calc-view.ts";
import { MODCALC_DEFAULT, modCalcHtml, modCalcOut } from "./modcalc-view.ts";
import type { ViewCtx } from "./plan-view.ts";
import { DEFAULT_SETTINGS } from "./state.ts";

const file = modularJson as unknown as ModularFile;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, modular: file } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const asm = (id: string) => file.assemblies.find((a) => a.id === id)!;

describe("bloc « Calcul » de l'éditeur", () => {
  it("ferme du guide (pousse 362,72 s à 0 %) : 29,11 Oak Log/min, eau, électricité, ⚠ MOD-09", () => {
    const t = text(modCalcHtml(file, data, asm("tree-farm"), structuredClone(MODCALC_DEFAULT)));
    expect(t).toContain("29,11 Oak Log/min");
    expect(t).toContain("118,8 L/min");
    expect(t).toContain("48,52 kMF/s");
    expect(t).toContain("⚠ MOD-09");
    expect(t).toContain("776 emplacements");
  });

  it("ferme incomplète : ce qui manque et le minimum", () => {
    const st = structuredClone(MODCALC_DEFAULT);
    st.farm.harvesters = 3;
    const t = text(modCalcOut(file, data, asm("tree-farm"), st));
    expect(t).toContain("les récolteurs");
    expect(t).toContain("4 récolteur(s)");
  });

  it("moteur : configuration relevée, sinon « à relever »", () => {
    const st = structuredClone(MODCALC_DEFAULT);
    const t = text(modCalcHtml(file, data, asm("diesel-engine"), st));
    expect(t).toContain("1,34 MMF/s");
    expect(t).toContain("0,086 L/s");
    expect(t).toMatch(/68.500 \$/); // S14 : 4 vilebrequins, posé au plus court
    st.diesel = { cylinders: 7, airFuel: 14, throttle: 100 };
    expect(text(modCalcOut(file, data, asm("diesel-engine"), st))).toContain("À relever");
    st.diesel = { cylinders: 32, airFuel: 14, throttle: 59 };
    expect(text(modCalcOut(file, data, asm("diesel-engine"), st))).toContain("MOD-14");
  });

  it("turbine : non fiable", () => {
    expect(text(modCalcHtml(file, data, asm("modular-turbine"), MODCALC_DEFAULT))).toContain("non fiable");
  });
});

describe("« Comment c'est calculé » : la ferme", () => {
  it("blocs, eau et électricité se refont avec les valeurs affichées", () => {
    const plan = solve(data, all, { item: "oak-log", ratePerMin: (88 * 2 * 60) / 363, criterion: "machines", tiers: false });
    const v: ViewCtx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet" };
    const t = text(renderStepCalc(v, { data }, "oak-log"));
    expect(t).toContain("Ferme d'arbres");
    expect(t).toContain("88 arbres ÷ 44 par arroseur");
    expect(t).toContain("2 arroseurs ÷ 3 par réservoir");
    expect(t).toContain("88 arbres ÷ 22 par récolteur");
    expect(t).toContain("200 kMF par coupe");
    expect(t).toContain("L/s par arroseur × 60");
  });
});
