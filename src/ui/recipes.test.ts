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
import { entryRp, entryValue, initials, itemCrafts, machineCrafts, recipeEntries, renderEntryList, renderEntryRows, renderItemCard, renderMachineCard, searchEntries, sortEntries, type Entry } from "./recipes-view.ts";
import { cleanImages, cleanPrefs, parseImagesExport } from "./recipes-store.ts";

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

  it("un ⚠ de recette mène à sa valeur dans « Valeurs à vérifier »", () => {
    const r = [...data.recipes.values()].find((x) => x.verify.some((f) => f.field === "durationS"))!;
    const out = Object.keys(r.outputs)[0]!;
    const html = renderItemCard(ctx, out);
    expect(html).toContain(`href="#donnees/verifier/recette/${encodeURIComponent(r.id)}/durationS"`);
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
