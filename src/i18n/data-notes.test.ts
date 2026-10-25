// S32 : les notes des données en anglais. Chaque note affichée par le site a sa traduction
// (data/i18n/en.json, ou une règle pour les gabarits des scripts) ; sinon elle s'affiche en français,
// marquée « (FR) », et ce test les compte.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import modularJson from "../../data/modular.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { dataNote, dataNoteEntries } from "./data-notes.ts";
import { looksFrench, shownNotes } from "./data-notes-list.ts";
import { setLang } from "./i18n.ts";
import { txt, txtHtml } from "../ui/engine-text.ts";

/** Le code des vues : les notes que le site écrit lui-même avec une correction (section « site » du dictionnaire). */
const SITE = import.meta.glob<string>(["../ui/*.ts", "!../ui/*.test.ts"], { query: "?raw", import: "default", eager: true });

const FILES: Record<string, unknown> = {
  "items.json": itemsJson,
  "machines.json": machinesJson,
  "recipes.json": recipesJson,
  "research.json": researchJson,
  "energy.json": energyJson,
  "overrides.json": overridesJson,
  "interfaces.json": interfacesJson,
  "modular.json": modularJson,
};

describe("notes des données en anglais (S32)", () => {
  beforeAll(() => setLang("en"));
  afterAll(() => setLang("fr"));

  it("chaque note affichée a sa traduction : aucune marque « (FR) »", () => {
    const missing = Object.entries(FILES).flatMap(([f, json]) => shownNotes(f, json).filter((s) => dataNote(s) === null).map((s) => `${f} : ${s.slice(0, 90)}`));
    expect(missing).toEqual([]);
  });

  it("une traduction est en anglais, et sa note existe encore dans son fichier (ou dans le code du site)", () => {
    const site = Object.values(SITE).join("\n");
    for (const [file, fr, en] of dataNoteEntries()) {
      if (file === "site") expect(site.includes(`"${fr}"`), fr).toBe(true);
      else expect(shownNotes(file, FILES[file]), `${file} : ${fr.slice(0, 60)}`).toContain(fr);
      expect(looksFrench(en.replace(/“[^”]*”/g, "")), en).toBe(false);
    }
  });

  it("une note sans traduction s'affiche en français, marquée « (FR) » (et lang=\"fr\" dans la page)", () => {
    expect(txt("une note pas encore traduite")).toBe("(FR) une note pas encore traduite");
    expect(txtHtml("une note pas encore traduite")).toBe('(FR) <span lang="fr">une note pas encore traduite</span>');
    expect(txt("Large Turbine")).toBe("Large Turbine"); // un nom du jeu n'est pas une note française
  });

  it("gabarits des scripts : traduits par règle", () => {
    expect(dataNote("quantité de Argon variable (mode « plant_speed »), valeur de base 20")).toBe("amount of Argon varies (mode “plant_speed”), base value 20");
    expect(dataNote("énergie variable (mode « maxwell »), valeur de base 0MF")).toBe("power varies (mode “maxwell”), base value 0MF");
    expect(dataNote("Miraheze : 5 ; Fandom : 17.2")).toBe("Miraheze: 5; Fandom: 17.2");
  });
});
