// P4 : fichier .indus (usine figée, schémas du bac à sable) et plus aucune trace de l'ancien format à l'écran.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeDesignBytes, designFromFile, designFromSchematic, encodeDesignBytes, ENGINE_VERSION, isIndus, schematicOf, SITE_VERSION } from "../engine/share/index.ts";
import { writeMsch } from "../engine/schematic/msch.ts";
import { factoryLayout, planFor, sbCatalog } from "../../tests/share-designs.ts";
import { frozenSvg } from "./frozen-view.ts";
import { settingsWith } from "../../tests/share-designs.ts";

const L = factoryLayout(planFor("gear", 60));
const ctx = { cat: sbCatalog, img: () => null, itemName: (id: string) => id };

describe("fichier .indus", () => {
  it("l'usine figée revient à l'identique", async () => {
    expect(ENGINE_VERSION).toMatch(/^[0-9a-f]{8}$/);
    const d = { site: SITE_VERSION, engine: ENGINE_VERSION, name: "Gear", settings: settingsWith({ item: "gear" }), factory: L };
    const bytes = await encodeDesignBytes(d);
    expect(isIndus(bytes)).toBe(true);
    expect(await decodeDesignBytes(bytes)).toStrictEqual(d);
    expect(await designFromFile(bytes)).toStrictEqual(d);
  });
  it("schéma du bac à sable : description et étiquettes gardées ; ancien fichier toujours lu", async () => {
    const s = { name: "Four", description: "deux lignes\nici", labels: ["acier", "x"], width: 0, height: 0, layout: L };
    expect(schematicOf(await decodeDesignBytes(await encodeDesignBytes(designFromSchematic(s))))).toStrictEqual(s);
    const old = schematicOf(await designFromFile(await writeMsch({ ...s, width: 40, height: 40 })));
    expect([old?.name, old?.layout.blocks.length]).toEqual(["Four", L.blocks.length]);
  });
  it("usine figée dessinée sans calcul ; un bâtiment inconnu est compté, pas bloquant", () => {
    const f = frozenSvg(L, ctx);
    expect(f.unknown).toBe(0);
    expect(f.width).toBeGreaterThan(0);
    expect(f.svg).toContain("u-frozen");
    expect(frozenSvg({ ...L, blocks: [...L.blocks, { ...L.blocks[0]!, u: 999999, id: "machine-disparue" }] }, ctx)).toEqual({ ...f, unknown: 1 });
    expect(frozenSvg({ blocks: [], wires: [], routes: [], fills: {} }, ctx).unknown).toBe(0);
  });
  it("plus aucune mention de l'ancien format à l'écran", () => {
    const i18n = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? i18n(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    for (const f of ["index.html", ...i18n("src/i18n")]) expect(readFileSync(f, "utf8"), f).not.toMatch(/msch|mindustry/i);
  });
});
