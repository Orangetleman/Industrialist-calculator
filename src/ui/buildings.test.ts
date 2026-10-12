import { describe, expect, it } from "vitest";
import portsJson from "../../data/ports.json";
import type { PortsFile } from "../engine/extension-types.ts";
import { applyTool, bodyPoint, CELL, checkEntry, exportSurveys, marginToPort, parseSurveys, portCenter } from "./buildings-model.ts";

describe("éditeur de bâtiments", () => {
  it("une case de la marge désigne un bord et un numéro de case ; les coins ne comptent pas", () => {
    // Press : 4 × 2 cases, marge d'une case tout autour.
    expect(marginToPort(4, 2, 1, 3)).toEqual({ side: "bas", cell: 1 });
    expect(marginToPort(4, 2, 4, 3)).toEqual({ side: "bas", cell: 4 });
    expect(marginToPort(4, 2, 0, 2)).toEqual({ side: "gauche", cell: 2 });
    expect(marginToPort(4, 2, 5, 1)).toEqual({ side: "droite", cell: 1 });
    expect(marginToPort(4, 2, 2, 0)).toEqual({ side: "haut", cell: 2 });
    expect(marginToPort(4, 2, 0, 0)).toBeNull();
    expect(marginToPort(4, 2, 2, 1)).toBeNull(); // dans le corps
  });

  it("un clic dans le corps donne une position à la demi-case", () => {
    expect(bodyPoint(8, 8, 1.5 * CELL, 1.5 * CELL)).toEqual([1, 1]);
    expect(bodyPoint(8, 8, 8 * CELL, 8 * CELL)).toEqual([7.5, 7.5]); // comme la prise du Blast Furnace
    expect(bodyPoint(8, 8, 0.2 * CELL, 3 * CELL)).toBeNull();
  });

  it("poser, remplacer, effacer un port", () => {
    let ports = applyTool([], "objet", { side: "bas", cell: 1 }, "entrée");
    expect(ports).toEqual([{ type: "objet", direction: "entrée", side: "bas", cell: 1, stub: 1 }]);
    ports = applyTool(ports, "fluide", { side: "bas", cell: 1 }, "sortie");
    expect(ports).toEqual([{ type: "fluide", direction: "sortie", side: "bas", cell: 1, stub: 1 }]);
    ports = applyTool(ports, "énergie", { side: "dessus", cell: [1, 2] }, "sortie");
    expect(ports.find((p) => p.type === "énergie")).toEqual({ type: "énergie", direction: "entrée", side: "dessus", cell: [1, 2] });
    ports = applyTool(ports, "gomme", { side: "bas", cell: 1 }, "entrée");
    expect(ports.map((p) => p.type)).toEqual(["énergie"]);
  });

  it("positions de dessin cohérentes avec la grille", () => {
    expect(portCenter(4, 2, { type: "objet", direction: "entrée", side: "bas", cell: 1 })).toEqual([1.5 * CELL, 3.5 * CELL]);
    expect(portCenter(4, 2, { type: "énergie", direction: "entrée", side: "dessus", cell: [1, 2] })).toEqual([1.5 * CELL, 2.5 * CELL]);
  });

  it("les relevés des données passent les contrôles de l'éditeur", () => {
    const repo = portsJson as unknown as PortsFile;
    for (const [id, e] of Object.entries(repo.machines)) expect(checkEntry(e), id).toEqual([]);
  });

  it("export puis import : même contenu, entrées invalides écartées", () => {
    const repo = portsJson as unknown as PortsFile;
    const file = JSON.parse(JSON.stringify(exportSurveys({ press: repo.machines.press! })));
    expect(parseSurveys(file)).toEqual({ press: repo.machines.press });
    expect(parseSurveys({ machines: { x: { ports: "non" } } })).toEqual({});
    expect(parseSurveys([])).toBeNull();
  });
});
