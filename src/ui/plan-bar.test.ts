// Réglages visibles (S28) : la barre « Ton plan », la barre du bloc du schéma et les ⚠ cliquables
// (bloc, ligne de la liste, module de l'usine), sur la chaîne du Crankshaft.
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import type { InterfacesFile } from "../engine/extension-types.ts";
import { solve } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { renderFactoryModules } from "./factory-view.ts";
import { doubtText, fieldWord, renderPlanBar, stepWarnings, warnButton, type PlanBarInput } from "./plan-bar.ts";
import { buildRows, renderBuildList, renderFlow, renderFlowHud, type ViewCtx } from "./plan-view.ts";
import { DEFAULT_SETTINGS, NO_FILTER } from "./state.ts";

const IF = interfacesJson as unknown as InterfacesFile;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: IF } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
// Le Gear y passe par la Press MK2, dont la sortie et l'énergie sont à vérifier (les wikis se contredisent).
const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "machines", tiers: false });
const v: ViewCtx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet", ifaces: IF.machines };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const base: PlanBarInput = { goal: "objet", criteria: DEFAULT_SETTINGS.criteria.objet, filter: NO_FILTER, fixed: {}, forced: {}, msettings: {}, ifaces: IF.machines, diesel: null, advanced: 0 };
const gear = plan.steps.find((s) => s.key === "gear")!;

describe("mots de joueur", () => {
  it("le champ et le doute, avec leurs unités", () => {
    expect(fieldWord(v, "durationS")).toBe("durée");
    expect(fieldWord(v, "outputs.gear")).toBe("sortie Gear");
    expect(fieldWord(v, "energyMFps")).toBe("énergie");
    expect(doubtText({ field: "durationS", reason: "contradiction", detail: "Miraheze : 15 ; Fandom : 17.2" })).toBe("15 s (Miraheze) ou 17,2 s (Fandom)");
    expect(doubtText({ field: "energyMFps", reason: "contradiction", detail: "Miraheze : 75000 ; Fandom : 500000" })).toBe("75 kMF/s (Miraheze) ou 500 kMF/s (Fandom)");
    // Un doute écrit en phrase reste tel quel.
    expect(doubtText({ field: "parts", reason: "manquant", detail: "22 arbres par récolteur" })).toBe("22 arbres par récolteur");
  });
});

describe("barre « Ton plan »", () => {
  it("par défaut : priorités et machines sans ✕, les valeurs à vérifier du plan", () => {
    const html = renderPlanBar(v, base);
    const t = text(html);
    expect(t).toContain("Ton plan");
    expect(t).toContain("Priorités : place › machines › énergie");
    expect(t).toContain("Machines : toutes");
    expect(html).not.toContain("data-pb-x");
    expect(html).not.toContain("data-mf-clear");
    const n = plan.verify.filter((e) => e.used).length;
    expect(n).toBeGreaterThan(0);
    expect(t).toContain(`${n} valeur${n > 1 ? "s" : ""} à vérifier`);
    // Chaque ligne mène à sa correction, en mots de joueur (plus de « energyMFps »).
    expect(html).toContain('data-fix="recette|press_mk2_05|outputs.gear|gear"');
    expect(t).toContain("Gear (Press MK2) : sortie Gear — 20 (Miraheze) ou 10 (Fandom)");
    expect(t).not.toContain("energyMFps");
  });

  it("chaque réglage de S8, S9, S10, S18 et les recettes choisies : visible, cliquable, ✕ pour l'annuler", () => {
    const html = renderPlanBar(v, {
      ...base,
      criteria: ["energy", "area", "machines", "cost", "pollution", "raw", "steps"],
      filter: { ...NO_FILTER, mode: "exclure", exclure: ["blast-furnace"] },
      fixed: { gear: 2 },
      forced: { crankshaft: "craft_assembler_05", "plastic-casing": "x" },
      msettings: { "chemical-plant": { input: 2 } },
      diesel: { fuel: "diesel", mode: "place", config: null },
      advanced: 2,
    });
    const t = text(html);
    expect(t).toContain("Priorités : énergie › place › machines");
    expect(html).toContain('data-pb-x="criteria"');
    expect(t).toContain("Machines : toutes sauf Blast Furnace");
    expect(html).toContain("data-mf-clear");
    expect(t).toContain("2 × Press MK2 (Gear) fixés");
    expect(html).toContain('data-flow="gear"');
    expect(html).toContain('data-pb-x="fixed" data-key="gear"');
    expect(t).toContain("Recette de Crankshaft : Craft Assembler");
    expect(html).toContain('data-pb-x="forced" data-item="crankshaft"');
    // Une recette choisie pour un objet absent du plan ne s'affiche pas.
    expect(html).not.toContain('data-item="plastic-casing"');
    expect(t).toContain("Chemical Plant : écran entrées × 2");
    expect(html).toContain('data-pb-x="msetting" data-machine="chemical-plant"');
    expect(t).toContain("Moteur diesel : Diesel, moins de place");
    expect(html).toContain('data-pb-x="diesel"');
    expect(t).toContain("Options avancées : 2");
  });

  it("le moteur diesel au réglage par défaut et l'écran à 1× ne s'affichent pas", () => {
    const html = renderPlanBar(v, { ...base, msettings: { "chemical-plant": { input: 1 } }, diesel: { fuel: "refined-diesel", mode: "carburant", config: null } });
    expect(html).not.toContain("Moteur diesel");
    expect(html).not.toContain("Chemical Plant");
  });
});

describe("⚠ cliquables et barre du bloc", () => {
  it("bloc du schéma : ⚠ vers la correction, et lecture de loin", () => {
    const svg = renderFlow(v)!.svg;
    expect(svg).toMatch(/<g class="fn-warn" data-fix="recette\|press_mk2_05\|[a-zA-Z.]+\|gear"/);
    expect(svg).toContain('class="fn-near"');
    expect(svg).toContain('<text class="fn-fname"');
  });

  it("ligne de la liste et module de l'usine : le même ⚠", () => {
    const rows = buildRows(v);
    expect(rows.find((r) => r.key === "gear")!.warn).toContain('data-fix="recette|press_mk2_05|');
    expect(rows.find((r) => r.key === "crankshaft")!.warn).toBeUndefined();
    expect(renderBuildList(v, rows, new Set())).toContain('class="warn-btn"');
    const warn = (k: string) => (k === "gear" ? warnButton(v, stepWarnings(v, gear)) : "");
    const f = { boxes: [{ key: "gear", label: "1 × Press MK2", sub: "Gear" }, { key: "crankshaft", label: "5 × Craft Assembler", sub: "Crankshaft" }] } as unknown as Parameters<typeof renderFactoryModules>[0];
    const html = renderFactoryModules(f, new Set(), warn);
    expect(html.match(/warn-btn/g)).toHaveLength(1);
  });

  it("barre du bloc : « Tu peux régler : », la recette, les ⚠ et le module dans l'usine", () => {
    const hud = renderFlowHud(v, "gear", () => "depot");
    const t = text(hud);
    expect(t).toContain("Tu peux régler :");
    expect(hud).toContain('data-mset-input data-key="gear"');
    expect(hud).toContain('select data-force="gear"');
    expect(hud).toContain('data-mf-ban="press-mk2"');
    expect(hud).toContain('data-focus="gear"');
    expect(t).toContain("Voir le module dans l'usine");
    expect(t).toContain("sortie Gear à vérifier : 20 (Miraheze) ou 10 (Fandom) — corriger");
    // Objectif RP : rien à régler, l'ancien bouton du plan de pose reste.
    const rp = renderFlowHud({ ...v, goal: "recherche" }, "gear", () => "depot");
    expect(rp).not.toContain("Tu peux régler");
    expect(rp).toContain('data-pose="gear"');
  });
});
