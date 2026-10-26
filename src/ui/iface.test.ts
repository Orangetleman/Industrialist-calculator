// Interfaces des machines dans le site (S10) : le plan dit le réglage à faire (le mouleur), l'écran
// de la Chemical Plant se règle dans la barre du bas, l'éditeur lit et exporte les interfaces.
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import type { InterfacesFile, PortsEntry } from "../engine/extension-types.ts";
import { applyMachineSettings, type MachineSettings } from "../engine/interfaces.ts";
import { solve } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { exportSurveys, parseInterfaces, parseSurveys } from "./buildings-model.ts";
import { renderStepCalc } from "./calc-view.ts";
import { parseFactor, renderScreenInputs, settingLines } from "./iface-view.ts";
import { buildRows, renderBuildList, renderFlowHud, type ViewCtx } from "./plan-view.ts";
import { DEFAULT_SETTINGS } from "./state.ts";

const IF = interfacesJson as unknown as InterfacesFile;
const ifaces = IF.machines;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: IF } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
function view(item: string, msettings: MachineSettings = {}): ViewCtx {
  const d = applyMachineSettings(data, ifaces, msettings);
  const plan = solve(d, all, { item, ratePerMin: 60, criterion: "energy", then: ["machines", "cost", "pollution", "area", "raw", "steps"], tiers: false });
  return { data: d, plan, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet", ifaces, msettings };
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/\s+/g, " ");
const keyOf = (v: ViewCtx, machine: string) => v.plan.steps.find((s) => s.machine === machine)!.key;

describe("le plan dit le réglage à faire", () => {
  const v = view("gearbox");
  it("liste de construction : 4 Industrial Plastic Molder, ⚙ levier sur « container »", () => {
    const row = buildRows(v).find((r) => r.machine === "Industrial Plastic Molder")!;
    expect(row.count).toBe(4);
    expect(text(row.setting!)).toContain("levier sur « container »");
    expect(renderBuildList(v, buildRows(v), new Set())).toContain('class="iset"');
    // Une machine sans interface n'a pas de pastille.
    expect(buildRows(v).find((r) => r.machine === "Craft Assembler")!.setting).toBeUndefined();
  });
  it("barre du bas et « Comment c'est calculé »", () => {
    const key = keyOf(v, "industrial-plastic-molder");
    expect(text(renderFlowHud(v, key, () => "depot"))).toContain("levier sur « container »");
    const t = text(renderStepCalc(v, { data: v.data }, key));
    expect(t).toContain("Réglage de la machine");
    expect(t).toContain("levier (sur le côté de la machine) : « Levier » sur la position « container », celle de ce craft");
  });
  it("Quarry : choix définitif", () => {
    const q = view("clay-brick");
    const lines = settingLines(ifaces, {}, "quarry", q.plan.steps.find((s) => s.machine === "quarry")!.recipeId);
    expect(lines).toEqual([{ text: "Écran à l'avant : « Soil & Clay »", once: true, doubt: undefined, screen: false }]);
    expect(buildRows(q).find((r) => r.machine === "Quarry")!.setting).toContain('class="iset once"');
  });
});

describe("écran de la Chemical Plant", () => {
  const set = { "chemical-plant": { input: 1.67, output: 2, power: 4 } };
  it("cases de l'écran dans la barre du bas, « ↺ 1× » seulement si réglé", () => {
    const v1 = view("hardened-plastic-casing");
    const key = keyOf(v1, "chemical-plant");
    const hud = renderFlowHud(v1, key, () => "depot");
    expect(hud.match(/data-iset-input/g)).toHaveLength(3);
    expect(hud).not.toContain("data-iset-reset");
    expect(text(renderStepCalc(v1, { data: v1.data }, key))).toContain("Resource Input, Resource Output, Power Input à 1× (réglage d'usine)");
    const v2 = view("hardened-plastic-casing", set);
    expect(renderScreenInputs(ifaces["chemical-plant"], "chemical-plant", "Chemical Plant", set["chemical-plant"])).toContain('value="1,67"');
    expect(renderFlowHud(v2, keyOf(v2, "chemical-plant"), () => "depot")).toContain('data-iset-reset="chemical-plant"');
  });
  it("le réglage est dit dans le plan et le panneau refait le calcul", () => {
    const v = view("hardened-plastic-casing", set);
    const row = buildRows(v).find((r) => r.machine === "Chemical Plant")!;
    expect(text(row.setting!)).toContain("écran : entrées × 1,67 · sorties × 2 · énergie × 4");
    const st = v.plan.steps.find((s) => s.recipeId === "chemical_plant_02")!;
    const t = text(renderStepCalc(v, { data: v.data }, st.key));
    expect(t).toContain("Réglage de l'écran");
    expect(t).toContain("Hardened Plastic Pellets : 50 × 2 = 100 par cycle");
    expect(t).toContain("100 Hardened Plastic Pellets × 60 ÷ 5 s");
  });
  it("nombre tapé : virgule ou point, > 0", () => {
    expect(parseFactor("1,67")).toBe(1.67);
    expect(parseFactor(" 2 ")).toBe(2);
    expect(parseFactor("")).toBeNull();
    expect(parseFactor("0")).toBeNull();
    expect(parseFactor("abc")).toBeNull();
  });
});

describe("éditeur : lire et exporter les interfaces", () => {
  it("data/interfaces.json se relit à l'identique", () => {
    expect(parseInterfaces(IF)).toEqual(ifaces);
  });
  it("l'export garde les relevés et ajoute les interfaces ; l'import relit les deux", () => {
    const local: Record<string, PortsEntry> = { quarry: { footprint: { w: 24, h: 24 }, ports: [], noPorts: true, noPower: true, source: { wiki: "saisie", fetchedAt: "2026-10-17T00:00:00Z" } } };
    const mine = { "plastic-molding-machine": ifaces["plastic-molding-machine"]! };
    const file = JSON.parse(JSON.stringify(exportSurveys(local, mine)));
    expect(parseSurveys(file)).toEqual(local);
    expect(parseInterfaces(file)).toEqual(mine);
    expect(exportSurveys(local)).not.toHaveProperty("interfaces");
  });
  it("une interface mal formée est ignorée", () => {
    expect(parseInterfaces({ interfaces: { x: { kind: "radar", settings: [], sources: [{ wiki: "jeu", fetchedAt: "x" }] }, y: { kind: "levier", settings: [], sources: [] } } })).toEqual({});
  });
});
