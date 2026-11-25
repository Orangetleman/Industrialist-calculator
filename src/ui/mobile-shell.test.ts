// Interface mobile (MB3) : les règles pures de l'ossature.
import { describe, expect, it } from "vitest";
import { dockOn, nextView, PLAN_DOCK, snapTo } from "./mobile-shell.ts";

describe("vues de Planifier", () => {
  it("ordre des boutons du bas : Usine, Schéma, Étapes, Bilan (décision du 2026-11-25)", () => {
    expect(PLAN_DOCK.map((d) => d.id)).toEqual(["pose", "schema", "etapes", "bilan"]);
  });
  it("un volet ouvert reste ouvert tant que l'onglet ne change pas", () => {
    expect(nextView("bilan", "pose", false)).toBe("bilan");
    expect(nextView("etapes", "schema", true)).toBe("schema");
    expect(nextView("schema", "", true)).toBe("pose");
  });
  it("liste et détails allument Bilan", () => {
    expect([dockOn("liste"), dockOn("details"), dockOn("pose")]).toEqual(["bilan", "bilan", "pose"]);
  });
});

describe("crans d'un panneau", () => {
  const stops = [140, 400, 700];
  it("toucher la poignée passe au cran suivant, puis revient au premier", () => {
    expect(snapTo(140, 0, stops)).toBe(400);
    expect(snapTo(700, 0, stops)).toBe(140);
  });
  it("glisser va au cran le plus proche dans le sens du geste ; tout en bas, le panneau se ferme", () => {
    expect(snapTo(400, 300, stops)).toBe(700);
    expect(snapTo(400, -300, stops)).toBe(140);
    expect(snapTo(140, -200, stops)).toBe(0);
  });
});
