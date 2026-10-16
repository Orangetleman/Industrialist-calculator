import { describe, expect, it } from "vitest";
import { nextStack, parseRoute, routeHash, routeTitle } from "./route.ts";

describe("adresses des vues", () => {
  it("chaque vue a son adresse, relue à l'identique", () => {
    const routes = [
      { page: "accueil" },
      { page: "usine" },
      { page: "plan", goal: "objet" },
      { page: "plan", goal: "énergie", tab: "liste" },
      { page: "plan", goal: "objet", tab: "schema", step: "plastic-bottle" },
      { page: "plan", goal: "argent", tab: "pose", step: "steam@boiler_01" },
      { page: "donnees", dataTab: "batiments", machine: "bottling-plant" },
      { page: "donnees", dataTab: "verifier" },
      { page: "plan", goal: "objet", tab: "pose", step: "usine-entiere", focus: "steel-plate" },
      { page: "recettes" },
      { page: "recettes", card: { kind: "objet", id: "steel-plate" } },
      { page: "recettes", card: { kind: "machine", id: "craft-assembler" } },
      { page: "donnees", dataTab: "verifier", verify: { scope: "recette", id: "advanced_assembler_02", field: "inputs.tire-rim" } },
      { page: "donnees", dataTab: "verifier", verify: { scope: "machine", id: "press" } },
    ] as const;
    for (const r of routes) expect(parseRoute(routeHash(r))).toEqual(r);
    expect(routeHash({ page: "plan", goal: "objet", tab: "pose", step: "steam@boiler_01" })).toBe("#objet/pose/steam%40boiler_01");
  });

  it("adresses inconnues ou incomplètes : une vue sensée", () => {
    expect(parseRoute("")).toEqual({ page: "accueil" });
    expect(parseRoute("#nimporte")).toEqual({ page: "accueil" });
    expect(parseRoute("#plan")).toEqual({ page: "accueil" });
    expect(parseRoute("#objet/nimporte/x")).toEqual({ page: "plan", goal: "objet" });
    expect(parseRoute("#objet/liste/x")).toEqual({ page: "plan", goal: "objet", tab: "liste" }); // pas d'étape pour la liste
    expect(parseRoute("#donnees/verifier/x")).toEqual({ page: "donnees", dataTab: "verifier" });
    expect(parseRoute("#objet/pose/%E0")).toEqual({ page: "plan", goal: "objet", tab: "pose", step: "%E0" });
  });

  it("le bouton Retour dit où il ramène", () => {
    expect(routeTitle(parseRoute("#objet/schema/x"))).toBe("Schéma");
    expect(routeTitle(parseRoute("#objet/pose/x"))).toBe("Plan de pose");
    expect(routeTitle(parseRoute("#energie"))).toBe("Produire de l'énergie");
    expect(routeTitle(parseRoute("#donnees/batiments/press"))).toBe("Éditeur de bâtiments");
    expect(routeTitle(parseRoute("#usine"))).toBe("Mon usine");
    expect(routeTitle(parseRoute("#recettes"))).toBe("Recettes");
    expect(routeTitle(parseRoute("#recettes/machine/press"))).toBe("Fiche de la machine");
    expect(routeTitle(parseRoute("#recettes/objet/gear"))).toBe("Fiche de l'objet");
    expect(parseRoute("#recettes/nimporte/x")).toEqual({ page: "recettes" });
  });

  it("pile des vues : on empile, un retour dépile, la même adresse ne compte pas", () => {
    let s = nextStack([], "#objet");
    s = nextStack(s, "#objet/schema/a");
    s = nextStack(s, "#objet/pose/a");
    expect(s).toEqual(["#objet", "#objet/schema/a", "#objet/pose/a"]);
    s = nextStack(s, "#objet/schema/a"); // retour
    expect(s).toEqual(["#objet", "#objet/schema/a"]);
    expect(nextStack(s, "#objet/schema/a")).toBe(s);
    expect(nextStack(["#a", "#b"], "#c", 2)).toEqual(["#b", "#c"]);
  });
});
