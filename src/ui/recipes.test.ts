// Page « Recettes » (S5) : liste, recherche, tri, fiches, liens ⚠ — sans navigateur.
import { describe, expect, it } from "vitest";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import energyJson from "../../data/energy.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import type { OverridesFile } from "../engine/types.ts";
import { draftFrom, EDIT_ON, entryRp, entryValue, initials, itemCrafts, machineCrafts, newDraft, parseDraft, parseItemForm, recipeEntries, renderEntryList, renderEntryRows, renderItemCard, renderMachineCard, searchEntries, sortEntries, type Entry } from "./recipes-view.ts";
import { cleanImages, cleanPrefs, parseImagesExport } from "./recipes-store.ts";
import { energyInputText, parseEnergy } from "./format.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const ctx = { data };
const entries = recipeEntries(data);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("liste des recettes", () => {
  it("tous les objets, et les machines qui ont un craft", () => {
    const objets = entries.filter((e) => e.kind === "objet");
    const machines = entries.filter((e) => e.kind === "machine");
    expect(objets).toHaveLength(data.items.size);
    expect(machines.length).toBeGreaterThanOrEqual(100);
    for (const m of machines) expect(machineCrafts(data, m.id).length).toBeGreaterThan(0);
  });

  it("recherche : sans accents ni casse, chaque mot doit figurer, le début du nom d'abord", () => {
    const r = searchEntries(entries, "steel pl");
    expect(r.map((e) => e.name)).toEqual(["Steel Plate"]);
    expect(searchEntries(entries, "STEEL")[0]!.name.startsWith("Steel")).toBe(true);
    expect(searchEntries(entries, "assembler", "machines").every((e) => e.kind === "machine")).toBe(true);
    expect(searchEntries(entries, "assembler", "objets").every((e) => e.kind === "objet")).toBe(true);
  });

  it("tri par valeur, par RP rapportés ou par nom ; les inconnues à la fin", () => {
    const objets = entries.filter((e) => e.kind === "objet");
    const byValue = sortEntries(data, objets, { key: "valeur", dir: "desc" });
    const values = byValue.map((e) => entryValue(data, e));
    const known = values.filter((v): v is number => v !== null);
    expect(known).toEqual([...known].sort((a, b) => b - a));
    expect(values.slice(known.length).every((v) => v === null)).toBe(true);
    const byRp = sortEntries(data, objets, { key: "rp", dir: "asc" }).map((e) => entryRp(data, e)).filter((v): v is number => v !== null);
    expect(byRp).toEqual([...byRp].sort((a, b) => a - b));
    const byName = sortEntries(data, objets, { key: "nom", dir: "desc" });
    expect(byName[0]!.name.localeCompare(byName.at(-1)!.name, "en")).toBeGreaterThan(0);
  });

  it("tuiles et lignes : l'objet ouvert est marqué, l'en-tête dit le tri", () => {
    const sp: Entry = { kind: "objet", id: "steel-plate", name: "Steel Plate" };
    expect(renderEntryList(ctx, [sp], "objet/steel-plate")).toContain(`aria-current="page"`);
    const rows = renderEntryRows(ctx, [sp], null, { key: "valeur", dir: "desc" });
    expect(rows).toContain(`aria-sort="descending"`);
    expect(text(rows)).toContain("89,9 $");
    expect(renderEntryRows(ctx, [{ kind: "machine", id: "chemical-reactor", name: "Chemical Reactor" }], null, { key: "valeur", dir: "desc" })).toContain("750 k$");
    expect(renderEntryList(ctx, [], null)).toContain("Rien ne correspond");
  });

  it("pastilles : initiales lisibles", () => {
    expect(initials("Steel Plate")).toBe("SP");
    expect(initials("Crankshaft")).toBe("Cr");
    expect(initials("10 Karat Gold")).toBe("10K");
  });
});

describe("fiches", () => {
  it("Crankshaft : valeurs des captures du jeu (754 $, 35× RP, 2 sources)", () => {
    const html = renderItemCard(ctx, "crankshaft");
    const t = text(html);
    expect(t).toContain("754 $");
    expect(t).toContain("35× RP");
    const { sources } = itemCrafts(data, "crankshaft");
    expect(sources.map((r) => [r.machine, r.durationS, r.energyMFps])).toEqual([
      ["advanced-assembler", 5, 200000],
      ["craft-assembler", 15, 4000],
    ]);
    // Chaque objet et chaque machine du craft mène à sa fiche.
    expect(html).toContain(`href="#recettes/objet/steel-rod"`);
    expect(html).toContain(`href="#recettes/machine/craft-assembler"`);
  });

  it("Steel Plate : ses utilisations mènent aux machines en un clic", () => {
    const { uses } = itemCrafts(data, "steel-plate");
    expect(uses.length).toBeGreaterThan(0);
    const html = renderItemCard(ctx, "steel-plate");
    for (const r of uses) expect(html).toContain(`href="#recettes/machine/${r.machine}"`);
  });

  it("Chemical Reactor : prix d'achat, description, ses crafts sans le nom de la machine", () => {
    const html = renderMachineCard(ctx, "chemical-reactor");
    expect(text(html)).toContain("750 000 $".replace(/ /g, " "));
    expect(html).toContain("Combines or refines");
    expect(html).not.toContain(`href="#recettes/machine/chemical-reactor"`);
    expect((html.match(/<li class="rc-craft/g) ?? []).length).toBe(machineCrafts(data, "chemical-reactor").length);
  });

  it("un ⚠ de recette ouvre « ✎ Corriger » sur sa valeur (S6) ; celui d'une valeur qui ne se corrige pas ici mène à « Données »", () => {
    const r = [...data.recipes.values()].find((x) => x.verify.some((f) => f.field === "durationS"))!;
    const out = Object.keys(r.outputs)[0]!;
    const html = renderItemCard(ctx, out);
    expect(html).toContain(`data-rc-focus="recipes|${r.id}|durationS"`);
    // Une valeur de la machine listée sous « Aussi à vérifier » (ni prix, ni tier, ni taille, ni pollution).
    const shown = ["cost", "tier", "size", "pollutionPerHour", "page"];
    const m = [...data.machines.values()].find((x) => x.verify.some((f) => !shown.includes(f.field)) && machineCrafts(data, x.id).length)!;
    const field = m.verify.find((f) => !shown.includes(f.field))!.field;
    expect(renderMachineCard(ctx, m.id)).toContain(`href="#donnees/verifier/machine/${encodeURIComponent(m.id)}/${field}"`);
  });

  it("une valeur corrigée porte ✎ (Crankshaft au Craft Assembler : 15 s relevées en jeu)", () => {
    const r = data.recipes.get("craft_assembler_05")!;
    expect(r.corrections?.some((c) => c.field === "durationS")).toBe(true);
    expect(renderItemCard(ctx, "crankshaft")).toContain("rc-fixed");
  });

  it("description d'un objet : celle du wiki, sinon recopiée par le joueur", () => {
    expect(data.items.get("coal")!.description).toBe("Coal.");
    const withSaisie = buildGameData(files, [{ items: { gear: { description: { value: "Un engrenage.", source: { wiki: "saisie", fetchedAt: "2026-10-17" } } } } } as unknown as OverridesFile]).data;
    expect(renderItemCard({ data: withSaisie }, "gear")).toContain("Un engrenage.");
  });

  it("cadenas : un craft dont la recherche manque le dit", () => {
    const html = renderItemCard({ data, locked: (r) => (r.machine === "advanced-assembler" ? "Advanced Assembler" : null) }, "crankshaft");
    expect(text(html)).toContain("pas encore débloqué : Advanced Assembler");
  });

  it("image : celle du joueur ou du wiki remplace la pastille, avec sa source", () => {
    const html = renderItemCard({ data, image: () => ({ src: "/img/objet/gear.png", own: false, credit: { label: "wiki Miraheze, CC BY-NC-SA 4.0", url: "https://x" } }) }, "gear");
    expect(html).toContain(`<img src="/img/objet/gear.png"`);
    expect(text(html)).toContain("Image : wiki Miraheze, CC BY-NC-SA 4.0");
  });
});

describe("préférences et images du joueur", () => {
  it("préférences relues proprement", () => {
    expect(cleanPrefs(null)).toEqual({ view: "tuiles", filter: "tout", sort: { key: "nom", dir: "asc" } });
    expect(cleanPrefs({ view: "lignes", filter: "objets", sort: { key: "rp" } })).toEqual({ view: "lignes", filter: "objets", sort: { key: "rp", dir: "desc" } });
  });

  it("images : seules les entrées valides sont gardées ; un export vide est refusé", () => {
    const ok = "data:image/png;base64,AAAA";
    expect(cleanImages({ "objet|gear": ok, "x|gear": ok, "machine|press": "http://x.png" })).toEqual({ "objet|gear": ok });
    expect(parseImagesExport({ images: { "machine|press": ok } })).toEqual({ "machine|press": ok });
    expect(() => parseImagesExport({ images: {} })).toThrow();
  });
});

describe("« ✎ Corriger » (S6)", () => {
  const edit = { ...EDIT_ON };
  const JEU = { wiki: "jeu" as const, fetchedAt: "2026-10-17T10:00:00Z", note: "test" };

  it("le bouton « ✎ Corriger » est sur la fiche ; en mode correction, prix et facteur RP sont des cases", () => {
    expect(renderItemCard(ctx, "crankshaft")).toContain("data-rc-edit-on");
    const html = renderItemCard({ data, edit }, "crankshaft");
    expect(html).toContain("Mode correction");
    expect(html).not.toContain("data-rc-edit-on");
    expect(html).toMatch(/data-rc-fix="items\|crankshaft\|sellValue" value="754"/);
    expect(html).toMatch(/data-rc-fix="items\|crankshaft\|researchValue" value="35"/);
    // Chaque craft : modifier ou « n'existe pas en jeu » ; chaque section : ajouter un craft.
    expect(html).toContain(`data-rc-edit="craft_assembler_05"`);
    expect(html).toContain(`data-rc-remove="advanced_assembler_05"`);
    expect(html).toContain(`data-rc-add="sources|crankshaft"`);
    expect(html).toContain(`data-rc-add="uses|crankshaft"`);
    expect(renderMachineCard({ data, edit }, "craft-assembler")).toMatch(/data-rc-fix="machines\|craft-assembler\|cost"/);
  });

  it("un craft en cours de modification montre ses valeurs dans des cases, et la machine au choix", () => {
    const html = renderItemCard({ data, edit: { ...edit, craft: "craft_assembler_05", focus: "recipes|craft_assembler_05|durationS" } }, "crankshaft");
    expect(html).toContain(`data-rc-craftedit="craft_assembler_05"`);
    expect(html).toMatch(/class="rc-edit-in qty focus" data-f="durationS" value="15"/);
    expect(html).toMatch(/data-f="inputs.gear" value="4"/);
    expect(html).toMatch(/<option value="craft-assembler" selected>Craft Assembler<\/option>/);
    expect(html).toContain(`data-rc-replace="craft_assembler_05"`);
  });

  it("un craft retiré reste sur la fiche, barré, avec « Rétablir » ; il n'est plus dans les sources", () => {
    const mine: OverridesFile = { removed: { recipes: { advanced_assembler_05: { source: JEU } } } };
    const d = buildGameData(files, [overridesJson as unknown as OverridesFile, mine]).data;
    expect(itemCrafts(d, "crankshaft").sources.map((r) => r.id)).toEqual(["craft_assembler_05"]);
    const html = renderItemCard({ data: d, mine }, "crankshaft");
    expect(html).toContain("1 retiré");
    expect(text(html)).toContain("2 Steel Rod + 4 Gear → 1 Crankshaft, 5 s (Advanced Assembler)");
    expect(html).toContain(`data-rc-restore="advanced_assembler_05"`);
    // Sur la fiche de la machine aussi.
    expect(renderMachineCard({ data: d, mine }, "advanced-assembler")).toContain(`data-rc-restore="advanced_assembler_05"`);
  });

  it("formulaire d'ajout : pré-rempli depuis la fiche, lu avec les noms du jeu, refusé s'il est incomplet", () => {
    const d0 = newDraft(data, { at: "sources", id: "crankshaft" });
    expect(d0.outputs).toEqual([{ item: "Crankshaft", qty: "1" }]);
    expect(newDraft(data, { at: "crafts", id: "craft-assembler" }).machine).toBe("Craft Assembler");
    const empty = parseDraft(data, d0);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors.join(" ")).toMatch(/Choisis la machine[\s\S]*Durée[\s\S]*Énergie/);
    const ok = parseDraft(data, { ...d0, machine: "craft assembler", durationS: "12,5", energyMFps: "4 000", inputs: [{ item: "Steel Rod", qty: "3" }, { item: "", qty: "1" }] });
    expect(ok).toEqual({ ok: true, recipe: { machine: "craft-assembler", durationS: 12.5, energyMFps: 4000, inputs: { "steel-rod": 3 }, outputs: { crankshaft: 1 } } });
    const unknown = parseDraft(data, { ...d0, machine: "Craft Assembler", durationS: "1", energyMFps: "0", inputs: [{ item: "Steel Ingt", qty: "1" }] });
    expect(unknown).toMatchObject({ ok: false, unknown: ["Steel Ingt"] });
    const html = renderItemCard({ data, edit: { ...edit, draft: { ...d0, errors: ["x"], unknown: ["Steel Ingt"] } } }, "crankshaft");
    expect(html).toContain(`data-rc-newitem="Steel Ingt"`);
    expect(html).not.toContain(`data-rc-add="sources|crankshaft"`);
  });

  it("remplacer un craft : formulaire pré-rempli avec ses valeurs", () => {
    const d = draftFrom(data, data.recipes.get("craft_assembler_05")!, "sources", "replace");
    expect(d).toMatchObject({ replace: "craft_assembler_05", id: null, machine: "Craft Assembler", durationS: "15", energyMFps: "4 k" });
    expect(d.inputs).toEqual([{ item: "Steel Rod", qty: "2" }, { item: "Gear", qty: "4" }]);
  });

  it("énergie comme en jeu (S29) : « 4 k » s'affiche et se relit en MF/s", () => {
    expect([energyInputText(4000), energyInputText(30), energyInputText(-2_500_000), energyInputText(null)]).toEqual(["4 k", "30", "-2,5 M", ""]);
    expect(["4500", "4,5 k", "4,5 kMF/s", "4500 MF/s", "-2 M", "1 234", "abc", ""].map(parseEnergy)).toEqual([4500, 4500, 4500, 4500, -2e6, 1234, null, null]);
  });

  it("objet manquant : nom obligatoire et nouveau ; valeurs vides = inconnues", () => {
    expect(parseItemForm(data, { name: " ", fluid: "non", sellValue: "", researchValue: "" })).toMatchObject({ ok: false });
    expect(parseItemForm(data, { name: "gear", fluid: "non", sellValue: "", researchValue: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/existe déjà/) });
    expect(parseItemForm(data, { name: "Titanium Bolt", fluid: "", sellValue: "12", researchValue: "" })).toEqual({ ok: true, item: { name: "Titanium Bolt", isFluid: null, sellValue: 12, researchValue: null } });
    expect(parseItemForm(data, { name: "Titanium Bolt", fluid: "non", sellValue: "-1", researchValue: "" })).toMatchObject({ ok: false });
  });

  it("un objet et un craft ajoutés : dans la liste, sur la fiche (« ajouté »), effaçables par le joueur", () => {
    const mine: OverridesFile = {
      added: {
        items: { "titanium-bolt": { name: "Titanium Bolt", isFluid: false, sellValue: null, researchValue: null, source: JEU } },
        recipes: { "ajout-craft-assembler-titanium-bolt": { machine: "craft-assembler", durationS: 3, energyMFps: 1000, inputs: { "steel-rod": 1 }, outputs: { "titanium-bolt": 2 }, source: JEU } },
      },
    };
    const d = buildGameData(files, [overridesJson as unknown as OverridesFile, mine]).data;
    expect(searchEntries(recipeEntries(d), "titanium").map((e) => e.id)).toEqual(["titanium-bolt"]);
    const html = renderItemCard({ data: d, mine, edit }, "titanium-bolt");
    expect(html).toContain("rc-tag add");
    expect(html).toContain(`data-rc-del-item="titanium-bolt"`);
    expect(html).toContain(`data-rc-edit-added="ajout-craft-assembler-titanium-bolt"`);
    expect(html).toContain(`data-rc-del-added="ajout-craft-assembler-titanium-bolt"`);
    expect(renderItemCard({ data: d, mine, edit }, "steel-rod")).toContain(`data-rc-edit-added="ajout-craft-assembler-titanium-bolt"`);
  });
});
