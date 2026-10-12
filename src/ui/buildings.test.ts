import { describe, expect, it } from "vitest";
import portsJson from "../../data/ports.json";
import type { PortsEntry, PortsFile } from "../engine/extension-types.ts";
import {
  applyTool,
  bodyPoint,
  CELL,
  checkEntry,
  exportSurveys,
  fitTwoCorners,
  isComplete,
  marginToPort,
  parseSurveys,
  portCenter,
  pruneIntegrated,
  scaleAround,
} from "./buildings-model.ts";

const src = { wiki: "saisie" as const, fetchedAt: "2026-10-12T09:00:00Z" };

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

  it("poser, remplacer, effacer un port ; tous les sens, y compris pour l'énergie", () => {
    let ports = applyTool([], "objet", { side: "bas", cell: 1 }, "entrée");
    expect(ports).toEqual([{ type: "objet", direction: "entrée", side: "bas", cell: 1, stub: 1 }]);
    ports = applyTool(ports, "fluide", { side: "bas", cell: 1 }, "sortie");
    expect(ports).toEqual([{ type: "fluide", direction: "sortie", side: "bas", cell: 1, stub: 1 }]);
    ports = applyTool(ports, "objet", { side: "haut", cell: 2 }, "les deux"); // stockages
    expect(ports.at(-1)?.direction).toBe("les deux");
    ports = applyTool(ports, "énergie", { side: "dessus", cell: [1, 2] }, "sortie"); // générateur
    expect(ports.find((p) => p.type === "énergie")).toEqual({ type: "énergie", direction: "sortie", side: "dessus", cell: [1, 2] });
    ports = applyTool(ports, "gomme", { side: "bas", cell: 1 }, "entrée");
    expect(ports.map((p) => p.type)).toEqual(["objet", "énergie"]);
  });

  it("positions de dessin cohérentes avec la grille", () => {
    expect(portCenter(4, 2, { type: "objet", direction: "entrée", side: "bas", cell: 1 })).toEqual([1.5 * CELL, 3.5 * CELL]);
    expect(portCenter(4, 2, { type: "énergie", direction: "entrée", side: "dessus", cell: [1, 2] })).toEqual([1.5 * CELL, 2.5 * CELL]);
  });

  it("complet : empreinte, ports et prise électrique — ou « sans prise électrique » coché", () => {
    const boiler: PortsEntry = { footprint: { w: 8, h: 6 }, ports: [{ type: "fluide", direction: "entrée", side: "bas", cell: 1 }], source: src };
    expect(isComplete(boiler)).toBe(false);
    expect(checkEntry(boiler)[0]).toMatch(/Sans prise électrique/);
    expect(isComplete({ ...boiler, noPower: true })).toBe(true);
    const contradiction: PortsEntry = { ...boiler, noPower: true, ports: [...boiler.ports, { type: "énergie", direction: "entrée", side: "dessus", cell: [1, 1] }] };
    expect(checkEntry(contradiction)).toEqual(["« Sans prise électrique » est coché alors qu'une prise est posée"]);
  });

  it("les relevés des données passent les contrôles de l'éditeur (sauf ceux signalés incomplets)", () => {
    const repo = portsJson as unknown as PortsFile;
    for (const [id, e] of Object.entries(repo.machines)) {
      const problems = checkEntry(e);
      // Truck Depot et petit silo : ni prise relevée ni « sans prise » coché (le wiki laisse
      // « PowerInput » vide) : en attente de confirmation en jeu.
      if (id === "truck-depot" || id === "small-item-storage-silo") expect(problems, id).toEqual([expect.stringMatching(/pas de prise électrique/)]);
      else expect(problems, id).toEqual([]);
    }
  });

  it("export puis import : même contenu, entrées invalides écartées, ancien champ « rotations » ignoré", () => {
    const repo = portsJson as unknown as PortsFile;
    const file = JSON.parse(JSON.stringify(exportSurveys({ press: repo.machines.press!, boiler: repo.machines.boiler! })));
    expect(parseSurveys(file)).toEqual({ press: repo.machines.press, boiler: repo.machines.boiler });
    expect(parseSurveys({ machines: { x: { ports: "non" } } })).toEqual({});
    expect(parseSurveys([])).toBeNull();
    const old = { machines: { roller: { footprint: { w: 4, h: 2 }, rotations: null, ports: [], source: src } } };
    expect(parseSurveys(old)).toEqual({ roller: { footprint: { w: 4, h: 2 }, ports: [], source: src } });
  });

  it("un relevé local déjà intégré aux données (même date) est retiré du navigateur", () => {
    const repo = portsJson as unknown as PortsFile;
    const roller = repo.machines.roller!;
    const local = { roller: { ...roller, ports: [] }, press: { ...repo.machines.press!, source: src } };
    const r = pruneIntegrated(local, repo);
    expect(r.dropped).toEqual(["roller"]);
    expect(Object.keys(r.kept)).toEqual(["press"]); // relevé plus récent que la version intégrée : gardé
  });

  it("molette sur la capture : le point sous la souris ne bouge pas", () => {
    const b = { x: -2, y: 1.5, scale: 0.4 };
    const at = (p: { x: number; y: number; scale: number }, u: number, v: number) => [p.x * CELL + p.scale * u, p.y * CELL + p.scale * v];
    const [px, py] = at(b, 300, 120); // point de l'image sous la souris
    const n = scaleAround(b, 1.25, px!, py!);
    expect(n.scale).toBeCloseTo(0.5);
    const [qx, qy] = at(n, 300, 120);
    expect(qx).toBeCloseTo(px!);
    expect(qy).toBeCloseTo(py!);
  });

  it("calage sur deux coins : les coins cliqués tombent sur ceux de l'empreinte", () => {
    // Capture où le bâtiment (4 × 2 cases) mesure 80 × 40 unités, coin haut-gauche en (100, 50).
    const b = { x: 0, y: 0, scale: 1 };
    const fit = fitTwoCorners(b, [180, 90], [100, 50], 4, 2)!; // ordre des clics indifférent
    expect(fit.ratio).toBeCloseTo(1);
    expect(fit.scale).toBeCloseTo(30 / 20);
    const at = (u: number, v: number) => [fit.x * CELL + fit.scale * u, fit.y * CELL + fit.scale * v];
    expect(at(100, 50).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([CELL, CELL]);
    expect(at(180, 90).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([5 * CELL, 3 * CELL]);
    // Largeur et hauteur inversées : les proportions ne collent pas (ratio 4).
    expect(fitTwoCorners(b, [100, 50], [180, 90], 2, 4)!.ratio).toBeCloseTo(0.25);
    expect(fitTwoCorners(b, [100, 50], [101, 90], 4, 2)).toBeNull();
  });
});
