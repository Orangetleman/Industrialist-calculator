// B5 : un schéma copié, enregistré, exporté puis réimporté redonne la même empreinte.
import { describe, expect, it } from "vitest";
import type { SbCatalog } from "../sandbox/catalog";
import type { Layout } from "../sandbox/layout";
import { clipLayout, clipOf, clipToSchematic, copyZone, fingerprint, flipClip, rotateClip, type Clip } from "./clip";
import { fromCode, readMsch, toCode, writeMsch } from "./msch";

const size = (w: number, h: number, pipe?: object) => ({ size: { w, h }, geo: { w, h, ports: [] }, ...(pipe ? { pipe } : {}) });
const cat = { blocks: new Map<string, unknown>([["press", size(3, 2)], ["pole", size(1, 1)], ["cross", size(1, 1, { role: "croisement", kind: "o" })]]) } as unknown as SbCatalog;

const mount: Layout = {
  blocks: [
    { u: 5, id: "press", x: 10, y: 20, r: 1, choice: "iron-coil" },
    { u: 8, id: "cross", x: 13, y: 20, r: 0, pair: 1 },
    { u: 9, id: "pole", x: 14, y: 22, r: 0 },
    { u: 12, id: "pole", x: 40, y: 40, r: 0 }, // hors de la zone
  ],
  wires: [{ a: 9, ia: 0, b: 5, ib: 1, t: "p" }, { a: 12, ia: 0, b: 9, ib: 0, t: "p" }],
  routes: [{ a: 5, ia: 0, b: 8, ib: 1 }],
};
const zone = () => copyZone(cat, mount, 8, 18, 20, 30)!; // marges autour des bâtiments
const stored = (c: Clip) => JSON.parse(JSON.stringify(c)) as Clip; // localStorage

describe("copie d'une zone", () => {
  it("garde recettes, voies, câbles et liaisons de l'intérieur, au plus juste", () => {
    const c = zone();
    expect(c.items).toHaveLength(3);
    expect([c.W, c.H, c.items[0]!.dx, c.items[0]!.dy]).toEqual([5, 3, 0, 0]);
    expect(c.wires).toEqual([{ a: 2, ia: 0, b: 0, ib: 1, t: "p" }]); // le câble vers l'extérieur est écarté
    expect(c.routes).toEqual([{ a: 0, ia: 0, b: 1, ib: 1 }]);
    expect(c.items[1]!.pair).toBe(1);
  });

  it("copié, enregistré, exporté puis réimporté : même empreinte, par le code et par le fichier", async () => {
    const c = stored(zone()), print = fingerprint(clipLayout(c)), s = clipToSchematic(c, { name: "Essai", desc: "d", tags: ["fer"] });
    expect(print).not.toBe("");
    const byCode = await fromCode(await toCode(s)), byFile = await readMsch(await writeMsch(s));
    for (const back of [byCode, byFile]) {
      expect(fingerprint(back.layout)).toBe(print);
      expect(fingerprint(clipLayout(clipOf(cat, back.layout)!, 77, 3))).toBe(print); // recollé ailleurs
    }
    expect([byCode.name, byCode.labels]).toEqual(["Essai", ["fer"]]);
  });

  it("l'empreinte voit une recette, une voie, un câble ou une liaison en moins", () => {
    const base = clipLayout(zone()), print = fingerprint(base);
    expect(fingerprint({ ...base, wires: [] })).not.toBe(print);
    expect(fingerprint({ ...base, routes: [] })).not.toBe(print);
    expect(fingerprint({ ...base, blocks: base.blocks.map((b) => ({ ...b, pair: undefined })) })).not.toBe(print);
    expect(fingerprint({ ...base, blocks: base.blocks.map((b) => ({ ...b, choice: null })) })).not.toBe(print);
  });

  it("un schéma enregistré avant B5 (sans câbles) se relit", () => {
    const old: Clip = { id: 1, items: [{ id: "pole", dx: 2, dy: 3, r: 0, choice: null }], W: 6, H: 6 };
    const c = clipOf(cat, clipLayout(old))!;
    expect([c.W, c.H, c.items[0]!.dx]).toEqual([1, 1, 0]);
  });
});

describe("tourner et retourner", () => {
  it("quatre quarts de tour et deux retournements rendent la même copie", () => {
    const c = zone(), print = fingerprint(clipLayout(c));
    for (let i = 0; i < 4; i++) rotateClip(cat, c);
    expect(fingerprint(clipLayout(c))).toBe(print);
    flipClip(cat, c, true); flipClip(cat, c, true);
    flipClip(cat, c, false); flipClip(cat, c, false);
    expect(fingerprint(clipLayout(c))).toBe(print);
  });

  it("les voies d'un croisement tournent avec lui, et la liaison suit sa voie", () => {
    const c = zone();
    rotateClip(cat, c); // voie 1 : S-O → O-N, la voie 0 de la paire 2
    expect(c.items[1]!.pair).toBe(2);
    expect(c.routes![0]!.ib).toBe(0);
    const d = zone();
    flipClip(cat, d, true); // S-O → S-E, la voie 1 de la paire 2
    expect(d.items[1]!.pair).toBe(2);
    expect(d.routes![0]!.ib).toBe(1);
  });
});
