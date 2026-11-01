// S52 : catégorie du menu Build, portée des câbles logiques, largeur 2 des ports des grands tuyaux.
import { describe, expect, it } from "vitest";
import type { Port, PortsEntry } from "../engine/extension-types.ts";
import { readGeo } from "../engine/sandbox/catalog.ts";
import { applyTool, canWiden, entryChanged, mergeHalves, parseSurveys, portCenter, CELL } from "./buildings-model.ts";

const src = { wiki: "saisie", fetchedAt: "2026-11-02T00:00:00Z" };
const halves: Port[] = [
  { type: "fluide", direction: "sortie", side: "haut", cell: 1, tip: "Output 1/2 large fluid pipe" },
  { type: "fluide", direction: "sortie", side: "haut", cell: 2, tip: "Output 2/2 large fluid pipe" },
  { type: "objet", direction: "entrée", side: "bas", cell: 1 },
];

describe("S52, relevés de l'éditeur", () => {
  it("fusionne les deux moitiés d'un grand tuyau en un port de 2 cases", () => {
    const m = mergeHalves(halves);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ side: "haut", cell: 1, span: 2, tip: "Output large fluid pipe" });
  });

  it("n'élargit qu'un port fluide dont la case suivante est libre et dans le bord", () => {
    const ports: Port[] = [{ type: "fluide", direction: "entrée", side: "gauche", cell: 1 }, { type: "fluide", direction: "sortie", side: "gauche", cell: 2 }];
    expect(canWiden(ports, 0, 3)).toBe(false);
    expect(canWiden(ports, 1, 3)).toBe(true);
    expect(canWiden(ports, 1, 2)).toBe(false);
    expect(canWiden([{ type: "objet", direction: "entrée", side: "gauche", cell: 1 }], 0, 3)).toBe(false);
  });

  it("un clic sur la 2e case d'un port de 2 cases touche ce port", () => {
    const p: Port[] = [{ type: "fluide", direction: "entrée", side: "haut", cell: 1, span: 2 }];
    expect(applyTool(p, "gomme", { side: "haut", cell: 2 }, "entrée")).toEqual([]);
    expect(portCenter(4, 2, p[0]!)[0]).toBe(2 * CELL);
  });

  it("garde catégorie, portée logique et largeur à l'import, et les compte comme un changement", () => {
    const e = { footprint: { w: 2, h: 2 }, ports: [{ type: "fluide", direction: "entrée", side: "haut", cell: 1, span: 2 }], buildCategory: "Logic", logicRangeTiles: 7.5, source: src };
    const r = parseSurveys({ machines: { x: e, y: { ...e, buildCategory: "Inventée", logicRangeTiles: -1 } } })!;
    expect(r.x).toMatchObject({ buildCategory: "Logic", logicRangeTiles: 7.5, ports: [{ span: 2 }] });
    expect(r.y!.buildCategory).toBeUndefined();
    expect(r.y!.logicRangeTiles).toBeUndefined();
    const base = { footprint: { w: 2, h: 2 }, ports: [], source: src } as PortsEntry;
    expect(entryChanged({ ...base, buildCategory: "Power" }, base)).toBe(true);
    expect(entryChanged({ ...base, logicRangeTiles: 3 }, base)).toBe(true);
  });

  it("le bac à sable lit la largeur relevée comme les anciennes moitiés", () => {
    const fp = { w: 2, h: 2 };
    const old = readGeo({ footprint: fp, ports: halves, source: src })!;
    const now = readGeo({ footprint: fp, ports: mergeHalves(halves), source: src })!;
    expect(now.ports.map(({ tip: _t, ...p }) => p)).toEqual(old.ports.map(({ tip: _t, ...p }) => p));
    expect(now.ports[0]).toMatchObject({ s: "N", c: 1, span: 2 });
  });
});
