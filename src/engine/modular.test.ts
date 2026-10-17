// Blocs modulaires dans l'éditeur (S12) : faces par contact, portées de la ferme, corrections.
import { describe, expect, it } from "vitest";
import modularJson from "../../data/modular.json";
import machinesJson from "../../data/machines.json";
import { exportSurveys, parseModular } from "../ui/buildings-model.ts";
import {
  blockFaces,
  blockRange,
  circleTouches,
  editDiff,
  fact,
  findBlock,
  frontEdge,
  isOpen,
  type ModularEdit,
  type ModularFile,
  repeats,
  treeGrid,
} from "./modular.ts";
import type { MachinesFile } from "./types.ts";

const file = modularJson as unknown as ModularFile;
const size = (id: string) => (machinesJson as unknown as MachinesFile).machines.find((m) => m.id === id)?.size ?? null;
const get = (id: string) => findBlock(file, id)!;
const src = { wiki: "saisie" as const, fetchedAt: "2026-10-18T00:00:00.000Z" };

describe("blocs par contact : faces", () => {
  it("chaque bloc par contact dit quelles faces sont obligatoires", () => {
    for (const a of file.assemblies.filter((x) => x.assembly === "contact")) {
      for (const b of a.blocks) expect(fact(b, "facesRequired"), b.id).toBeDefined();
    }
  });

  it("vilebrequin : derrière et devant obligatoires, côtés facultatifs ; le volant peut le suivre", () => {
    const { block } = get("diesel-engine-crankshaft");
    const faces = blockFaces(block).faces!;
    expect(faces.map((f) => [f.face, f.required])).toEqual([["back", true], ["front", true], ["side", false]]);
    expect(faces.find((f) => f.face === "front")!.blocks).toEqual(["diesel-engine-crankshaft", "diesel-engine-generator", "diesel-engine-flywheel"]);
    expect(faces.find((f) => f.face === "side")!.blocks).toContain("diesel-engine-cylinder");
  });

  it("volant (réponse du 2026-10-18) : se place comme un vilebrequin, sans face obligatoire", () => {
    const fly = blockFaces(get("diesel-engine-flywheel").block).faces!;
    const crank = blockFaces(get("diesel-engine-crankshaft").block).faces!;
    expect(fly.map((f) => f.face)).toEqual(["back", "front"]);
    for (const f of fly) {
      expect(f.required, f.face).toBe(false);
      expect(f.blocks, f.face).toEqual(crank.find((c) => c.face === f.face)!.blocks);
    }
    expect(blockFaces(get("diesel-engine-generator").block).faces![0]!.blocks).toContain("diesel-engine-flywheel");
    expect(blockFaces(get("diesel-engine-controller").block).faces!.find((f) => f.face === "front")!.blocks).toContain("diesel-engine-flywheel");
  });

  it("turbine : chaque bloc de la chaîne doit toucher ses voisins, la sortie seulement derrière", () => {
    const req = (id: string) => blockFaces(get(id).block).faces!.filter((f) => f.required).map((f) => f.face);
    expect(req("turbine-input")).toEqual(["front"]);
    for (const id of ["high-pressure-turbine", "intermediate-pressure-turbine", "low-pressure-turbine", "turbine-generator"]) expect(req(id), id).toEqual(["back", "front"]);
    expect(req("turbine-output")).toEqual(["back"]);
  });

  it("blocs en plusieurs exemplaires dans la chaîne (× n)", () => {
    const rep = file.assemblies.flatMap((a) => a.blocks).filter(repeats).map((b) => b.id);
    expect(rep.sort()).toEqual(["diesel-engine-crankshaft", "diesel-engine-flywheel", "high-pressure-turbine", "low-pressure-turbine"]);
  });

  it("une correction locale remplace les faces ; le bord « devant » est inconnu par défaut (MOD-17)", () => {
    const { assembly, block } = get("diesel-engine-cylinder");
    expect(frontEdge(block)).toBeNull();
    expect(isOpen(file, assembly.rules.find((r) => r.key === "frontEdge"))).toBe(true);
    const edit: ModularEdit = { faces: { side: ["diesel-engine-crankshaft"], back: ["diesel-engine-decoration"] }, frontEdge: "haut", source: src };
    const info = blockFaces(block, edit);
    expect(info.local).toBe(true);
    expect(info.faces!.map((f) => f.face)).toEqual(["back", "side"]);
    expect(frontEdge(block, edit)).toBe("haut");
  });

  it("questions : ⚠ seulement pour celles encore ouvertes", () => {
    expect(isOpen(file, fact(get("tree-farm-sprinkler").block, "rangeTiles"))).toBe(false); // MOD-03 répondue
    expect(isOpen(file, fact(get("diesel-engine-crankshaft").block, "facesRequired"))).toBe(true); // MOD-11
  });
});

describe("ferme d'arbres : portées", () => {
  it("cercle centré sur le bloc, rayon = portée depuis le bord + demi-largeur ; il suffit de toucher", () => {
    expect(circleTouches(12, 0, 0, { x0: 10, y0: 6, x1: 14, y1: 10 })).toBe(true); // arbre décalé de (3, 2) : 11,7 cases
    expect(circleTouches(12, 0, 0, { x0: 10, y0: 10, x1: 14, y1: 14 })).toBe(false); // (3, 3) : 14,1 cases
    expect(circleTouches(12, 0, 0, { x0: 14, y0: -2, x1: 18, y1: 2 })).toBe(false); // (4, 0) : 14 cases
  });

  it("arroseur : 10 cases depuis le bord, 12 depuis le centre ; 44 arbres en grille, comme les wikis", () => {
    const { assembly, block } = get("tree-farm-sprinkler");
    const r = blockRange(assembly, block, size(block.id));
    expect([r.tiles, r.fromCenter, r.serves]).toEqual([10, 12, ["tree"]]);
    expect(r.servedBy).toEqual([{ id: "tree-farm-controller", tiles: 58 }, { id: "tree-farm-water-tank", tiles: "infinie" }]);
    const wiki = (fact(block, "treesPerSprinkler")!.value as { grid: number }).grid;
    expect(treeGrid(4, r.fromCenter!).count).toBe(wiki);
    expect(wiki).toBe(44);
  });

  it("récolteur : 23 cases (27 depuis le centre), dessert arbres et sortie ; 168 emplacements touchés", () => {
    const { assembly, block } = get("farm-harvester");
    const r = blockRange(assembly, block, size(block.id));
    expect([r.tiles, r.fromCenter, r.serves]).toEqual([23, 27, ["tree", "tree-farm-output"]]);
    expect(treeGrid(8, 27).count).toBe(168);
  });

  it("arbre et sortie : pas de portée, desservis par d'autres ; réservoir : portée infinie", () => {
    const tree = get("tree");
    const rt = blockRange(tree.assembly, tree.block, size("tree"));
    expect(rt.tiles).toBeNull();
    expect(rt.servedBy.map((x) => [x.id, x.tiles])).toEqual([["tree-farm-controller", 58], ["tree-farm-sprinkler", 10], ["farm-harvester", 23]]);
    const out = get("tree-farm-output");
    expect(blockRange(out.assembly, out.block, size(out.block.id)).servedBy.map((x) => x.id)).toEqual(["tree-farm-controller", "farm-harvester"]);
    const tank = get("tree-farm-water-tank");
    const r = blockRange(tank.assembly, tank.block, size(tank.block.id));
    expect([r.tiles, r.fromCenter, r.serves]).toEqual(["infinie", null, ["tree-farm-sprinkler"]]);
  });

  it("une portée corrigée change le dessin et les blocs desservis", () => {
    const { assembly, block } = get("tree-farm-sprinkler");
    const edits = { "tree-farm-sprinkler": { rangeTiles: 11, source: src } };
    expect(blockRange(assembly, block, size(block.id), edits).fromCenter).toBe(13);
    const tree = get("tree");
    expect(blockRange(tree.assembly, tree.block, null, edits).servedBy.find((x) => x.id === "tree-farm-sprinkler")!.tiles).toBe(11);
  });
});

describe("corrections : ce qui est gardé, export et import", () => {
  it("un brouillon identique au dépôt ne garde rien ; seul ce qui change est gardé", () => {
    const { assembly, block } = get("diesel-engine-crankshaft");
    const faces = blockFaces(block).faces!;
    const draft: ModularEdit = {
      faces: Object.fromEntries(faces.map((f) => [f.face, [...f.blocks].reverse()])),
      facesRequired: Object.fromEntries(faces.map((f) => [f.face, f.required === true])),
      source: src,
    };
    expect(editDiff(assembly, block, draft)).toBeNull();
    const back = editDiff(assembly, block, { ...draft, facesRequired: { ...draft.facesRequired, back: false } })!;
    expect(back).toEqual({ facesRequired: { front: true }, source: src });
    expect(editDiff(assembly, block, { ...draft, note: "vu en jeu" })).toEqual({ note: "vu en jeu", source: src });
    expect(editDiff(assembly, block, { ...draft, frontEdge: "bas" })).toEqual({ frontEdge: "bas", source: src });
  });

  it("portée : changer la valeur ou les blocs desservis", () => {
    const { assembly, block } = get("farm-harvester");
    expect(editDiff(assembly, block, { rangeTiles: 23, serves: ["tree-farm-output", "tree"], source: src })).toBeNull();
    expect(editDiff(assembly, block, { rangeTiles: 24, serves: ["tree"], source: src })).toEqual({ rangeTiles: 24, serves: ["tree"], source: src });
  });

  it("export (clé « modular ») puis import : identiques ; les entrées mal formées sont ignorées", () => {
    const mine = { "tree-farm-sprinkler": { rangeTiles: 11 as const, note: "mesuré", source: src }, "diesel-engine-cylinder": { faces: { side: ["diesel-engine-crankshaft"] }, facesRequired: { side: true }, frontEdge: "gauche" as const, source: src } };
    const out = JSON.parse(JSON.stringify(exportSurveys({}, {}, mine)));
    expect(parseModular(out)).toEqual(mine);
    expect(exportSurveys({})).not.toHaveProperty("modular");
    expect(parseModular({ modular: { a: { rangeTiles: -1, frontEdge: "nord", source: src }, b: { rangeTiles: 3 } } })).toEqual({ a: { source: src } });
    expect(parseModular({ machines: {} })).toBeNull();
  });
});
