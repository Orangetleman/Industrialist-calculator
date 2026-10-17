// « Comment c'est calculé » (S7) : les nombres du panneau refont ceux du schéma (chaîne du Crankshaft).
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
import { renderEdgeCalc, renderStepCalc, sourceTag } from "./calc-view.ts";
import { renderFixBar, renderFlow, renderFlowHud, type ViewCtx } from "./plan-view.ts";
import { DEFAULT_SETTINGS } from "./state.ts";

// Comme le site : données des wikis, énergie, puis les corrections du dépôt (overrides.json).
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const ctx = (plan: Plan): ViewCtx => ({ data, plan, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet" });
const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "machines", tiers: false });
const v = ctx(plan);
const rc = { data };
/** Texte du panneau, sans balises (les entités HTML gardées). */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("panneau d'un bloc", () => {
  it("Gear : débit, demande, machines, utilisation, énergie, entrée, sources", () => {
    const html = renderStepCalc(v, rc, "gear");
    const t = text(html);
    expect(t).toContain("20 Gear × 60 ÷ 4 s");
    expect(t).toContain("300 /min");
    expect(t).toContain("240 (Crankshaft)");
    expect(t).toContain("240 ÷ 300 = 0,8 → arrondi au-dessus");
    expect(t).toContain("1 Press MK2");
    expect(t).toContain("80 %");
    expect(t).toContain("0,8 × 75 kMF/s (en pointe : 1 × 75 kMF/s = 75 kMF/s)");
    expect(t).toContain("60 kMF/s");
    expect(t).toContain("240 × 20 ÷ 20");
    // Le craft sur sa ligne, comme dans Recettes, et le lien vers sa fiche sur ce craft.
    expect(html).toContain('data-rc-craft="press_mk2_05"');
    expect(html).toContain('href="#recettes/objet/gear/press_mk2_05"');
    // Les deux valeurs à vérifier mènent à la correction ; la durée vient du wiki.
    expect(html).toContain('data-rc-focus="recipes|press_mk2_05|outputs.gear"');
    expect(html).toContain('data-rc-focus="recipes|press_mk2_05|energyMFps"');
    expect(t).toContain("durée : wiki");
  });

  it("Steel Ingot : la demande additionne ses consommateurs", () => {
    const t = text(renderStepCalc(v, rc, "steel-ingot"));
    expect(t).toContain("240 (Steel Plate) + 120 (Steel Coil)");
    expect(t).toContain("360 ÷ 900 = 0,4 → arrondi au-dessus");
    expect(t).toContain("360 × 50 ÷ 300");
  });

  it("Crankshaft : la demande est l'objectif, le compte tombe juste", () => {
    const t = text(renderStepCalc(v, rc, "crankshaft"));
    expect(t).toContain("60 (objectif du plan)");
    expect(t).toContain("60 ÷ 12 = 5");
    expect(t).not.toContain("60 ÷ 12 = 5 → arrondi");
    expect(t).toContain("100 %");
  });

  it("un craft qui consomme son propre produit : sortie nette (Sulfuric Acid)", () => {
    expect(text(renderStepCalc(v, rc, "sulfuric-acid"))).toContain("(17 − 2) Sulfuric Acid × 60 ÷ 3 s");
  });

  it("cas particuliers : matière première, arbres, production existante", () => {
    expect(text(renderStepCalc(v, rc, "raw-iron"))).toContain("Matière première");
    const trees = solve(data, all, { item: "oak-log", ratePerMin: 60, criterion: "machines", tiers: false });
    const t = text(renderStepCalc(ctx(trees), rc, "oak-log"));
    expect(t).toContain("pousse des arbres");
    expect(t).toContain("durée : pousse");
    const mine = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "machines", tiers: false, existing: { "steel-plate": 100 } });
    const ex = mine.existing.find((x) => x.item === "steel-plate")!;
    expect(text(renderStepCalc(ctx(mine), rc, ex.key))).toMatch(/100 \/min déclarés, dont 100 \/min utilisés/);
  });

  it("chaque nombre se refait avec les valeurs affichées (toutes les étapes)", () => {
    for (const s of plan.steps) {
      const r = data.recipes.get(s.recipeId)!;
      const net = (k: string) => (r.outputs[k] ?? 0) - (r.inputs[k] ?? 0);
      expect(s.ratePerMachine).toBeCloseTo((s.outputPerCycle * 60) / s.durationS, 6);
      expect(s.machinesExact).toBeCloseTo(s.demandPerMin / s.ratePerMachine, 6);
      for (const f of s.inputs) expect(f.perMin).toBeCloseTo((s.demandPerMin * -net(f.item)) / s.outputPerCycle, 6);
      const out = plan.edges.filter((e) => e.from === s.key && e.item === s.item).reduce((t, e) => t + e.perMin, 0);
      if (!plan.finals.includes(s.key) && !plan.surplus.some((x) => x.item === s.item)) expect(out).toBeCloseTo(s.demandPerMin, 6);
    }
  });
});

describe("panneau d'une flèche", () => {
  it("un seul producteur : tout vient du départ (Gear → Crankshaft)", () => {
    const e = plan.edges.find((x) => x.from === "gear" && x.to === "crankshaft")!;
    const t = text(renderEdgeCalc(v, { ...e, loop: !!e.loop }));
    expect(t).toContain("60 × 4 ÷ 1");
    expect(t).toContain("tout vient de Gear");
    expect(t).toContain("240 /min");
  });

  it("deux producteurs : le consommateur est servi au prorata (Coke Fuel → Steel Ingot)", () => {
    const e = plan.edges.find((x) => x.from === "coke-fuel" && x.to === "steel-ingot")!;
    const t = text(renderEdgeCalc(v, { ...e, loop: !!e.loop }));
    expect(t).toContain("360 × 50 ÷ 300");
    expect(t).toContain("81,53 (Coke Fuel)");
    expect(t).toContain("sous-produit : Light Oil, Advanced Oil Separator");
    expect(t).toContain("82,39 /min");
    expect(t).toContain("60 × 98,96 %");
    expect(t).toContain("59,37 /min");
  });

  it("le calcul affiché redonne chaque flèche", () => {
    for (const e of plan.edges) {
      const to = plan.steps.find((s) => s.key === e.to)!;
      const need = to.inputs.find((f) => f.item === e.item)!.perMin;
      const made = (k: string) => {
        const s = plan.steps.find((x) => x.key === k);
        return s ? (s.item === e.item ? s.demandPerMin : (s.byproducts.find((f) => f.item === e.item)?.perMin ?? 0)) : 0;
      };
      const total = plan.steps.reduce((t, s) => t + made(s.key), 0);
      expect(e.perMin).toBeCloseTo((need * made(e.from)) / total, 6);
    }
  });
});

describe("source d'une valeur", () => {
  it("relevé en jeu (correction du dépôt), wiki, à vérifier", () => {
    const ca = data.recipes.get("craft_assembler_05")!;
    expect(sourceTag(ca, "durationS")).toContain("relevé en jeu");
    expect(sourceTag(data.recipes.get("advanced_assembler_05")!, "durationS", "durée")).toMatch(/durée : wiki/);
    expect(sourceTag(data.recipes.get("foundry_05")!, "outputs.iron-ingot")).toContain("⚠ à vérifier : Miraheze : 1200 ; Fandom : 1000");
  });
});

describe("machines fixées (S8)", () => {
  const fixed = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "machines", tiers: false, fixedMachines: { "raw-iron": 5, "steel-plate": 1 } });
  const one = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "machines", tiers: false, fixedMachines: { "raw-iron": 5 } });

  it("le panneau du bloc refait le débit obtenu par une règle de trois", () => {
    const t = text(renderStepCalc(ctx(one), rc, "raw-iron"));
    expect(t).toContain("Nombre fixé");
    expect(t).toContain("le calcul sans réglage en demandait 7");
    expect(t).toContain("60 Crankshaft/min × 5 ÷ 6,67");
    expect(t).toContain("45 Crankshaft/min");
    expect(t).toContain("20 ÷ 4 = 5 (5 fixées)");
  });

  it("une étape fixée qui ne limite pas : l'autre limite, ses machines ne sont pas toutes utilisées", () => {
    const t = text(renderStepCalc(ctx(fixed), rc, "raw-iron"));
    expect(t).toContain("Steel Plate limite : 4,17 machines sur 5 suffisent");
    expect(t).toContain("37,5 Crankshaft/min");
  });

  it("bandeau, schéma et barre du bas", () => {
    const bar = text(renderFixBar(ctx(fixed)));
    expect(bar).toContain("Production obtenue : 37,5 Crankshaft/min");
    expect(bar).toContain("au lieu de 60 Crankshaft/min");
    expect(bar).toContain("Limitée par Steel Plate : 1 Press MK2 fixée, utilisée à 100 %");
    expect(bar).toContain("Raw Iron : 5 Iron Drill fixées, utilisées à 83,3 % (4,17 suffiraient)");
    expect(renderFixBar(v)).toBe("");
    const svg = renderFlow(ctx(fixed))!.svg;
    expect(svg).toContain('class="fn raw fixed" data-key="raw-iron"');
    expect(svg).toMatch(/class="fn [a-z]+ fixed limit" data-key="steel-plate"/);
    const hud = renderFlowHud(ctx(fixed), "raw-iron", () => "depot");
    expect(hud).toContain('data-mset-input data-key="raw-iron" value="5"');
    expect(hud).toContain("plan : 7");
  });
});
