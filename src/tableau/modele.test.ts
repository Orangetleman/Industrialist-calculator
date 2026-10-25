// Tableau de bord (S36) : filtres, champs à traduire, lien vers la page d'une remarque.
import { describe, expect, it } from "vitest";
import { aTraduire, autreChamp, depuis, filtrer, lienPage, titreDe, type Remarque } from "./modele.ts";

const r = (x: Partial<Remarque>): Remarque => ({
  id: 1,
  cree: 0,
  type: "idee",
  texte: "",
  pseudo: null,
  page: null,
  langue: "fr",
  version: null,
  plan: null,
  aPiece: 0,
  etat: "nouvelle",
  reponse: null,
  repondu: null,
  sujet: null,
  traduction: null,
  ...x,
});

describe("filtres de la boîte", () => {
  const liste = [r({ id: 1 }), r({ id: 2, etat: "lue", sujet: 4 }), r({ id: 3, etat: "traitee", langue: "en", type: "bogue" })];
  it("« À traiter » par défaut : nouvelles et lues", () => {
    expect(filtrer(liste, { type: "", etat: "a-traiter", langue: "" }).map((x) => x.id)).toEqual([1, 2]);
  });
  it("non rangées, traitées, type et langue", () => {
    expect(filtrer(liste, { type: "", etat: "non-rangees", langue: "" }).map((x) => x.id)).toEqual([1, 3]);
    expect(filtrer(liste, { type: "", etat: "traitee", langue: "" }).map((x) => x.id)).toEqual([3]);
    expect(filtrer(liste, { type: "bogue", etat: "toutes", langue: "en" }).map((x) => x.id)).toEqual([3]);
  });
});

describe("traduction automatique d'un sujet", () => {
  it("remplit seulement les champs vides dont l'autre langue est écrite, un appel par langue", () => {
    expect(aTraduire({ titre: "Partager un plan", titre_en: "", description: "", description_en: "Send a plan", reponse: "Oui", reponse_en: "Yes" })).toEqual([
      { vers: "en", depuis: ["titre"], vides: ["titre_en"] },
      { vers: "fr", depuis: ["description_en"], vides: ["description"] },
    ]);
    expect(aTraduire({ titre: "x", titre_en: "y" })).toEqual([]);
    expect(autreChamp("reponse_en")).toBe("reponse");
  });
});

describe("liens et dates", () => {
  it("retrouve l'adresse de la page jointe par le site", () => {
    expect(lienPage("Planifier › Usine (#objet/pose)")).toBe("/#objet/pose");
    expect(lienPage("#recettes/fer")).toBeNull();
    expect(lienPage(null)).toBeNull();
  });
  it("dit depuis quand, et le titre d'un sujet sans français", () => {
    const now = Date.UTC(2026, 9, 25, 12);
    expect(depuis(now - 4 * 60_000, now)).toBe("il y a 4 min");
    expect(depuis(now - 3 * 3600_000, now)).toBe("il y a 3 h");
    expect(titreDe({ titre: "", titre_en: "Share a plan" })).toBe("Share a plan");
  });
});
