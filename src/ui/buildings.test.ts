import { describe, expect, it } from "vitest";
import modularJson from "../../data/modular.json";
import portsJson from "../../data/ports.json";
import type { PortsEntry, PortsFile } from "../engine/extension-types.ts";
import { blockFaces, editDiff, findBlock, type ModularEdit, type ModularFile } from "../engine/modular.ts";
import {
  applyTool,
  bodyPoint,
  CELL,
  checkEntry,
  entryChanged,
  exportSurveys,
  faceBoxes,
  fitTwoCorners,
  isComplete,
  marginToPort,
  mergeSurveys,
  parseModular,
  parseSurveys,
  portCenter,
  pruneIntegrated,
  sameSize,
  scaleAround,
  setFaceRequired,
  splitSides,
  surveyState,
  toggleFaceBlock,
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
    expect(ports).toEqual([{ type: "objet", direction: "entrée", side: "bas", cell: 1 }]);
    ports = applyTool(ports, "fluide", { side: "bas", cell: 1 }, "sortie");
    expect(ports).toEqual([{ type: "fluide", direction: "sortie", side: "bas", cell: 1 }]);
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

  it("complet sans aucun port si « Sans port » est coché (arbre, récolteur)", () => {
    const tree: PortsEntry = { footprint: { w: 4, h: 4 }, ports: [], noPower: true, source: src };
    expect(checkEntry(tree)).toEqual([expect.stringMatching(/Sans port/)]);
    expect(isComplete({ ...tree, noPorts: true })).toBe(true);
    const withPort: PortsEntry = { ...tree, noPorts: true, ports: [{ type: "objet", direction: "sortie", side: "bas", cell: 2 }] };
    expect(checkEntry(withPort)).toEqual(["« Sans port » est coché alors qu'un port est posé"]);
    const controller: PortsEntry = { footprint: { w: 4, h: 4 }, ports: [{ type: "énergie", direction: "entrée", side: "dessus", cell: [3.5, 4] }], noPorts: true, source: src };
    expect(isComplete(controller)).toBe(true);
    expect(parseSurveys({ machines: { tree: { ...tree, noPorts: true } } })!.tree!.noPorts).toBe(true);
  });

  it("les relevés des données passent les contrôles de l'éditeur", () => {
    const repo = portsJson as unknown as PortsFile;
    // Truck Depot, petit silo et Tree Farm Sprinkler : « sans prise » confirmé par l'export du 2026-10-18.
    // Diesel Engine Fuel Input : port reporté depuis le relevé de l'entrée d'air, prise pas encore relevée.
    for (const [id, e] of Object.entries(repo.machines)) {
      if (id === "diesel-engine-fuel-input") expect(checkEntry(e), id).toEqual([expect.stringMatching(/pas de prise électrique/)]);
      else expect(checkEntry(e), id).toEqual([]);
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
    // Ancien plot (`stub`, supprimé le 2026-10-16) : le relevé est accepté, la clé est ignorée.
    const withStub = { machines: { press: { footprint: { w: 4, h: 2 }, ports: [{ type: "objet", direction: "entrée", side: "bas", cell: 1, stub: 1, tip: "x" }], source: src } } };
    expect(parseSurveys(withStub)).toEqual({ press: { footprint: { w: 4, h: 2 }, ports: [{ type: "objet", direction: "entrée", side: "bas", cell: 1, tip: "x" }], source: src } });
  });

  it("un relevé local déjà intégré aux données (même date) est retiré du navigateur", () => {
    const repo = portsJson as unknown as PortsFile;
    const roller = repo.machines.roller!;
    const local = { roller: { ...roller, ports: [] }, press: { ...repo.machines.press!, source: src } };
    const r = pruneIntegrated(local, repo);
    expect(r.dropped).toEqual(["roller"]);
    expect(Object.keys(r.kept)).toEqual(["press"]); // relevé plus récent que la version intégrée : gardé
  });

  it("les plans de pose utilisent les relevés locaux, qui l'emportent sur le dépôt", () => {
    const repo = portsJson as unknown as PortsFile;
    expect(repo.machines["oil-rig"]).toBeUndefined(); // pas encore dans le dépôt
    const rig: PortsEntry = { footprint: { w: 6, h: 4 }, ports: [{ side: "gauche", cell: 1, type: "objet", direction: "entrée" }], source: src };
    const press: PortsEntry = { ...repo.machines.press!, ports: [], source: src };
    const local = { "oil-rig": rig, press };
    const merged = mergeSurveys(repo, local);
    expect(merged["oil-rig"]).toBe(rig);
    expect(merged.press).toBe(press);
    expect(merged.roller).toBe(repo.machines.roller);
    expect(surveyState("oil-rig", repo, local)).toBe("local");
    expect(surveyState("press", repo, local)).toBe("local");
    expect(surveyState("roller", repo, local)).toBe("depot");
    expect(surveyState("oil-rig", repo, {})).toBe("manquant");
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

// ---------------------------------------------------------------- S19 : cases des faces, Enregistrer
const modular = modularJson as unknown as ModularFile;
const crank = findBlock(modular, "diesel-engine-crankshaft")!;
const draftOf = () => {
  const faces = blockFaces(crank.block).faces!;
  return {
    source: src,
    faces: Object.fromEntries(faces.map((r) => [r.face, [...r.blocks]])),
    facesRequired: Object.fromEntries(faces.map((r) => [r.face, r.required === true])),
  } as ModularEdit;
};

describe("éditeur simplifié (S19)", () => {
  it("une case par face : devant en haut, derrière en bas, les côtés communs à gauche et à droite", () => {
    const boxes = faceBoxes(blockFaces(crank.block))!;
    expect(boxes.haut.blocks).toContain("diesel-engine-generator");
    expect(boxes.bas.blocks).toContain("diesel-engine-controller");
    expect(boxes.gauche).toEqual(boxes.droite);
    expect(boxes.gauche.blocks).toContain("diesel-engine-cylinder");
    expect([boxes.haut.required, boxes.bas.required, boxes.gauche.required]).toEqual([true, true, false]);
    // Bloc posé sur un côté : devant et derrière ne sont pas cités, donc « rien ».
    const cyl = findBlock(modular, "diesel-engine-cylinder")!;
    expect(faceBoxes(blockFaces(cyl.block))!.haut).toEqual({ blocks: [], required: false });
  });

  it("côtés liés par défaut : cocher à gauche coche aussi à droite", () => {
    const d = toggleFaceBlock(draftOf(), "gauche", "diesel-engine-cylinder", false);
    const boxes = faceBoxes(blockFaces(crank.block, d))!;
    expect(boxes.droite.blocks).not.toContain("diesel-engine-cylinder");
    expect(setFaceRequired(d, "droite", true).facesRequired?.side).toBe(true);
  });

  it("côtés réglés à part : chacun le sien, leur réunion reste la face « côtés » ; réunir les fusionne", () => {
    let d = splitSides(draftOf(), true);
    d = toggleFaceBlock(d, "gauche", "diesel-engine-cylinder", false);
    d = setFaceRequired(d, "droite", true);
    const boxes = faceBoxes(blockFaces(crank.block, d))!;
    expect(boxes.gauche.blocks).not.toContain("diesel-engine-cylinder");
    expect(boxes.droite.blocks).toContain("diesel-engine-cylinder");
    expect([boxes.gauche.required, boxes.droite.required]).toEqual([false, true]);
    // Enregistré : la face « side » = réunion (le cylindre y reste), obligatoire ; le détail est gardé.
    const kept = editDiff(crank.assembly, crank.block, d)!;
    expect(kept.sides).toMatchObject({ rightRequired: true });
    expect(kept.facesRequired?.side).toBe(true);
    expect(blockFaces(crank.block, kept).faces!.find((r) => r.face === "side")!.blocks).toContain("diesel-engine-cylinder");
    // Export puis import : les deux côtés reviennent.
    const back = parseModular(JSON.parse(JSON.stringify(exportSurveys({}, {}, { [crank.block.id]: kept }))))!;
    expect(back[crank.block.id]!.sides).toEqual(kept.sides);
    // Réunir : côtés communs, obligatoires puisque l'un l'était.
    const merged = splitSides(d, false);
    expect(merged.sides).toBeUndefined();
    expect(merged.facesRequired?.side).toBe(true);
    expect(merged.faces?.side).toContain("diesel-engine-cylinder");
  });

  it("un seul Enregistrer : un relevé inchangé n'est pas réenregistré", () => {
    const base: PortsEntry = { footprint: { w: 4, h: 2 }, ports: [{ type: "objet", direction: "entrée", side: "bas", cell: 1 }], source: src };
    expect(entryChanged(structuredClone(base), base)).toBe(false);
    expect(entryChanged({ ...structuredClone(base), source: { wiki: "saisie", fetchedAt: "2026-10-19T00:00:00Z" } }, base)).toBe(false);
    expect(entryChanged({ ...structuredClone(base), noPower: true }, base)).toBe(true);
    // Bâtiment pas encore relevé : rien posé, rien à enregistrer.
    expect(entryChanged({ footprint: { w: 2, h: 2 }, ports: [], source: src }, undefined)).toBe(false);
    expect(entryChanged({ footprint: { w: 2, h: 2 }, ports: [], noPorts: true, source: src }, undefined)).toBe(true);
  });

  it("la taille du wiki ne s'affiche que si elle diffère du relevé", () => {
    expect(sameSize({ w: 4, h: 2 }, { w: 4, l: 2 })).toBe(true);
    expect(sameSize({ w: 2, h: 4 }, { w: 4, l: 2 })).toBe(true);
    expect(sameSize({ w: 3, h: 3 }, { w: 4, l: 2 })).toBe(false);
    expect(sameSize({ w: 3, h: 3 }, null)).toBe(true);
  });
});

import { portCandidates, tipSuggest } from "./buildings-model.ts";
import type { Item } from "../engine/types.ts";
describe("objets d'un port (S38)", () => {
  const items: Map<string, Item> = new Map([
    ["ingot", { id: "ingot", name: "Metal Ingot", isFluid: false }],
    ["plate", { id: "plate", name: "Metal Plate", isFluid: false }],
    ["water", { id: "water", name: "Water", isFluid: true }],
  ] as [string, Item][]);
  const recs = [{ inputs: { ingot: 1, water: 1 }, outputs: { plate: 1 } }] as never;
  it("propose les objets du bon côté et du bon genre", () => {
    expect(portCandidates(recs, items, { type: "objet", direction: "entrée" })).toEqual(["ingot"]);
    expect(portCandidates(recs, items, { type: "fluide", direction: "entrée" })).toEqual(["water"]);
    expect(portCandidates(recs, items, { type: "objet", direction: "les deux" })).toEqual(["ingot", "plate"]);
  });
  it("reprend l'infobulle et signale les noms inconnus", () => {
    expect(tipSuggest("input for metal ingot", ["ingot"], items)).toEqual({ found: ["ingot"], unknown: [] });
    expect(tipSuggest("Input for Metal Ingot/heavy Oil", ["ingot"], items).unknown).toEqual(["heavy oil"]);
  });
});
