import { describe, expect, it } from "vitest";
import {
  fandomProduction,
  parseAllTemplates,
  parseMamyflux,
  parseNumber,
  parsePollution,
  parseSize,
  parseTemplate,
  parseTreeGrowth,
  researchNodes,
  slugify,
} from "./wiki-extract.ts";

describe("conversions simples", () => {
  it("slugify", () => {
    expect(slugify("Steel Ingot")).toBe("steel-ingot");
    expect(slugify("Plank^2")).toBe("plank-2");
    expect(slugify("Electric Furnace & Molding")).toBe("electric-furnace-and-molding");
    expect(slugify("8x Microchip")).toBe("8x-microchip");
  });

  it("parseMamyflux (mêmes préfixes que le wiki)", () => {
    expect(parseMamyflux("4kMF")).toBe(4000);
    expect(parseMamyflux("6250MF")).toBe(6250);
    expect(parseMamyflux("12.5kMF")).toBe(12500);
    expect(parseMamyflux("-1.25MMF")).toBe(-1_250_000);
    expect(parseMamyflux("1GMF")).toBe(1e9);
    expect(parseMamyflux("0MF")).toBe(0);
    expect(parseMamyflux("3488")).toBe(3488);
    expect(parseMamyflux("15kMF/s")).toBe(15000);
    expect(parseMamyflux("1kMF - 12.5kMF/s")).toBeNull();
    expect(parseMamyflux(null)).toBeNull();
  });

  it("nombres, tailles, pollution", () => {
    expect(parseNumber("150,000")).toBe(150000);
    expect(parseNumber("409")).toBe(409);
    expect(parseNumber("-241")).toBe(-241);
    expect(parseNumber("1-300")).toBeNull();
    expect(parseSize("12x6")).toEqual({ w: 12, l: 6 });
    expect(parseSize("")).toBeNull();
    expect(parsePollution("0.216%/h")).toBe(0.216);
    expect(parsePollution("0.05-0.29%/h")).toEqual([0.05, 0.29]);
    expect(parsePollution("0.648 - 0.432%/h")).toEqual([0.432, 0.648]);
    expect(parsePollution("Depends on recipes")).toBeNull();
  });
});

describe("modèles wiki", () => {
  it("lit une infobox Machine2", () => {
    const page = `{{Top-Tree-Farm}}
{{Machine2
|Tier=3
|Cost=60,000
|Size=8x8
|Pollution=0.216%/h
|Output={{None}}
|Research=Steel
}}
{{Quote|Creates Steel}}`;
    expect(parseTemplate(page, "Machine2")).toEqual({
      Tier: "3",
      Cost: "60,000",
      Size: "8x8",
      Pollution: "0.216%/h",
      Output: "{{None}}",
      Research: "Steel",
    });
    expect(parseTemplate(page, "Item")).toBeNull();
  });

  it("lit les {{Production}} de Fandom, même mal formés", () => {
    const page = `{{Production|input1=steel-ingot|Input1Amount=1|Mamyflux=4000MF|output1=steel-plate|Output1Amount=1|machine=Press|time=5.1}}
{{Production|input1=steel-ingot|Input1Amount=20|Mamyflux=125kMF|time=8|output1=steel-plate|Output1Amount=20}|machine=Press MK2}}
{{ProductionNeue|machine=Press}}`;
    const all = parseAllTemplates(page, "Production").map(fandomProduction);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ machine: "Press", durationS: 5.1, energyMFps: 4000, inputs: { "steel-ingot": 1 }, outputs: { "steel-plate": 1 } });
    // « 20} » n'est pas un nombre : null, pas d'invention.
    expect(all[1]?.outputs["steel-plate"]).toBeNull();
  });
});

describe("tableau de pousse des arbres", () => {
  it("lit les plages, y compris les bornes ouvertes et inversées", () => {
    const page = `{| class="wikitable sortable table"
|+Tree Growth
!'''Pollution'''
!'''Growth Time'''
|-
|{{Pollution|100}}+ (Max)
|~696s (Max)
|-
|{{Pollution|51}} - {{Pollution|99}}
|~370s - ~689s
|-
|{{Pollution|13}} - {{Pollution|37}}
|'''~348s (min)'''
|-
|'''{{Pollution|0}} - {{Pollution|5}} (Normal)'''
|'''~363s (Normal)'''
|-
|{{Pollution|-61}} - {{Pollution|-148}}
|~385s - ~689s
|-
|{{Pollution|-149}}- (Min)
|~696s (Max)
|}`;
    const bands = parseTreeGrowth(page);
    expect(bands.map(({ minPct, maxPct, seconds }) => ({ minPct, maxPct, seconds }))).toEqual([
      { minPct: 100, maxPct: null, seconds: [696, 696] },
      { minPct: 51, maxPct: 99, seconds: [370, 689] },
      { minPct: 13, maxPct: 37, seconds: [348, 348] },
      { minPct: 0, maxPct: 5, seconds: [363, 363] },
      { minPct: -148, maxPct: -61, seconds: [385, 689] },
      { minPct: null, maxPct: -149, seconds: [696, 696] },
    ]);
  });
});

describe("arbre de recherche", () => {
  it("convertit RS/Data, reqItems compris", () => {
    const nodes = researchNodes({
      Production: {
        Production: { RP: 0, Nodes: ["Coal Extracting"] },
        "Advanced Assembler": { RP: 100000, reqItems: { Item: "Crankshaft", Amount: 20 }, Buildings: ["Advanced Assembler"] },
      },
    });
    expect(nodes).toEqual([
      { name: "Production", category: "Production", rp: 0, buildings: [], children: ["Coal Extracting"], reqItems: [] },
      {
        name: "Advanced Assembler",
        category: "Production",
        rp: 100000,
        buildings: ["Advanced Assembler"],
        children: [],
        reqItems: [{ item: "Crankshaft", amount: 20 }],
      },
    ]);
  });

  it("refuse un nœud sans RP", () => {
    expect(() => researchNodes({ Production: { X: { Buildings: [] } } })).toThrow(/RP manquant/);
  });
});
