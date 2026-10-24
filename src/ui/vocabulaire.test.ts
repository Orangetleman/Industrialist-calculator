// S29 : vocabulaire de joueur. Aucun identifiant interne (craft, objet, machine, recherche, champ des
// données) ni référence du projet (RP-04, MOD-09, « à m'envoyer ») dans ce que voit le joueur : textes,
// infobulles (title, data-tip). Les vues sont rendues avec les vraies données, comme sur le site.
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import interfacesJson from "../../data/interfaces.json";
import modularJson from "../../data/modular.json";
import { buildGameData, spacedName, type RawFiles } from "../engine/data.ts";
import { solve, type Plan } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { renderStepCalc } from "./calc-view.ts";
import { buildRows, renderAnswer, renderBuildList, renderDetails, renderFlow, renderFlowHud, type ViewCtx } from "./plan-view.ts";
import { renderItemCard, renderMachineCard } from "./recipes-view.ts";
import { allVerifyEntries, renderVerify } from "./render.ts";
import { renderNodeBubble, renderNodeDetail } from "./research-view.ts";
import { DEFAULT_SETTINGS } from "./state.ts";

// Comme le site (main.ts) : interfaces des machines et machines modulaires (ferme d'arbres, moteurs) comprises.
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const fresh = { unlocked: new Set<string>(), pollutionPct: 0 };

/** Ce que lit le joueur : le texte sans balises, plus les infobulles. */
function visible(html: string): string {
  const tips = [...html.matchAll(/(?:title|data-tip)="([^"]*)"/g)].map((m) => m[1]!);
  const svgTitles = [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]!);
  return [html.replace(/<[^>]+>/g, " "), ...tips, ...svgTitles].join(" ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

// Identifiants à plusieurs morceaux (« blast_furnace_09 », « steel-rod », « water-pump-2 ») : un nom du jeu ne
// s'écrit jamais ainsi. Les identifiants d'un seul mot (« coal ») ne se distinguent pas d'un mot ordinaire.
const IDS = new Set([...data.recipes.keys(), ...data.items.keys(), ...data.machines.keys(), ...data.nodes.keys()].filter((id) => /[-_]/.test(id)));
const FIELDS = ["durationS", "energyMFps", "pollutionPerHour", "sellValue", "researchValue", "unlockedBy"];

function problems(text: string): string[] {
  const out = new Set<string>();
  for (const tok of text.match(/[a-z0-9]+(?:[-_][a-z0-9]+)+/g) ?? []) if (IDS.has(tok)) out.add(tok);
  for (const f of FIELDS) if (new RegExp(`\\b${f}\\b`).test(text)) out.add(f);
  for (const ref of text.match(/\b(?:RP|MOD|IF)-\d+\b|m'envoyer|m’envoyer/g) ?? []) out.add(ref);
  for (const m of data.machines.values()) {
    const raw = (machinesJson as unknown as { machines: { id: string; name: string }[] }).machines.find((x) => x.id === m.id)?.name;
    if (raw && raw !== m.name && new RegExp(`\\b${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) out.add(raw);
  }
  return [...out];
}

const views = (plan: Plan): string[] => {
  const v: ViewCtx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet" };
  const out = [renderAnswer(v), renderBuildList(v, buildRows(v), new Set()), renderFlow(v)?.svg ?? "", renderDetails(v)];
  for (const s of plan.steps) {
    out.push(renderStepCalc(v, { data }, s.key));
    out.push(renderFlowHud(v, s.key, () => "depot"));
  }
  return out;
};

describe("vocabulaire de joueur (S29)", () => {
  it("le test reconnaît ce qu'affichait le site avant S29", () => {
    expect(problems(visible(`<p>Craft <code>blast_furnace_09</code> · water → oak-log</p><span title="durationS">x</span> supposé (RP-04), un fichier à m'envoyer, 1 Water Pump2`)).sort()).toEqual(
      ["RP-04", "Water Pump2", "blast_furnace_09", "durationS", "m'envoyer", "oak-log"].sort(),
    );
  });

  it("noms des bâtiments numérotés avec une espace, comme l'arbre de recherche", () => {
    expect(["Water Pump2", "Research Station4", "Short Pipe2", "Press MK2", "Coal Drill"].map(spacedName)).toEqual(["Water Pump 2", "Research Station 4", "Short Pipe 2", "Press MK2", "Coal Drill"]);
    expect(data.machines.get("water-pump2")?.name).toBe("Water Pump 2");
  });

  it("un plan (réponse, liste, schéma, détails, panneau de chaque bloc) : aucun identifiant à l'écran", () => {
    for (const [item, rate] of [["crankshaft", 60], ["light-oil", 60], ["steel-plate", 30]] as const) {
      const plan = solve(data, all, { item, ratePerMin: rate, criterion: "area", tiers: false });
      expect(problems(visible(views(plan).join(" "))), item).toEqual([]);
    }
  });

  it("partie neuve (recherches manquantes) : aucun identifiant à l'écran", () => {
    const plan = solve(data, fresh, { item: "crankshaft", ratePerMin: 60, criterion: "area", tiers: false });
    expect(problems(visible(views(plan).join(" ")))).toEqual([]);
  });

  it("valeurs à vérifier, fiches Recettes et arbre : aucun identifiant à l'écran", () => {
    const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "area", tiers: false });
    const ctx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {} };
    const html = [renderVerify(ctx, { entries: allVerifyEntries(ctx), all: true })];
    for (const id of ["crankshaft", "gear", "oak-log", "light-oil", "water"]) html.push(renderItemCard({ data }, id));
    for (const id of ["blast-furnace", "water-pump2", "coal-generator", "craft-assembler"]) html.push(renderMachineCard({ data }, id));
    const p = { unlocked: new Set<string>() };
    for (const id of ["water-pump-2", "research-station-4", "foundry"]) {
      html.push(renderNodeDetail(data, p, id, 1000), renderNodeBubble(data, p, id, 1000));
    }
    expect(problems(visible(html.join(" ")))).toEqual([]);
  });
});
