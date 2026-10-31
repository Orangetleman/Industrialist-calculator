import { describe, expect, it } from "vitest";
import { fromCode, readMsch, toCode, writeMsch, type Schematic } from "./msch";

const s: Schematic = {
  name: "Ferme à fer", description: "Deux foreuses\u0000et un tapis", labels: ["fer", "début"], width: 10, height: 6,
  layout: {
    blocks: [
      { u: 7, id: "drill", x: 0, y: 0, r: 1, choice: "iron-ore" },
      { u: 9, id: "conveyor", x: 4, y: 5, r: 0, open: ["N", "E"] },
      { u: 3, id: "crossing", x: 9, y: 2, r: 3, pair: 2 },
    ],
    wires: [{ a: 7, ia: 0, b: 9, ib: 1, t: "p" }],
    routes: [{ a: 9, ia: 0, b: 3, ib: 2 }],
  },
};

describe("format .msch", () => {
  it("commence par l'en-tête de Mindustry", async () => {
    const d = await writeMsch(s);
    expect([...d.subarray(0, 5)]).toEqual([0x6d, 0x73, 0x63, 0x68, 1]);
  });

  it("relit ce qu'il écrit (aller-retour par le code base64)", async () => {
    const back = await fromCode(await toCode(s));
    expect(back.name).toBe(s.name);
    expect(back.description).toBe(s.description);
    expect(back.labels).toEqual(s.labels);
    expect([back.width, back.height]).toEqual([10, 6]);
    expect(back.layout.blocks).toEqual([
      { u: 0, id: "drill", x: 0, y: 0, r: 1, choice: "iron-ore" },
      { u: 1, id: "conveyor", x: 4, y: 5, r: 0, open: ["N", "E"] },
      { u: 2, id: "crossing", x: 9, y: 2, r: 3, pair: 2 },
    ]);
    expect(back.layout.wires).toEqual([{ a: 0, ia: 0, b: 1, ib: 1, t: "p" }]);
    expect(back.layout.routes).toEqual([{ a: 1, ia: 0, b: 2, ib: 2 }]);
  });

  it("ramène un montage en coordonnées négatives au coin (0, 0)", async () => {
    const neg: Schematic = { ...s, layout: { blocks: [{ u: 0, id: "a", x: -3, y: -2, r: 0 }, { u: 1, id: "a", x: 1, y: 0, r: 0 }], wires: [] } };
    const back = await readMsch(await writeMsch(neg));
    expect(back.layout.blocks.map((b) => [b.x, b.y])).toEqual([[0, 0], [4, 2]]);
  });

  it("refuse ce qui n'est pas un .msch", async () => {
    await expect(readMsch(new Uint8Array([1, 2, 3, 4, 5, 6]))).rejects.toThrow("not a .msch");
    await expect(fromCode("bonjour")).rejects.toThrow();
  });
});
