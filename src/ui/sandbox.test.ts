// B3 : la partie pure de l'écran du bac à sable (menu de pose, raccourcis, pose en ligne, touches, textes du moteur).
import { afterEach, describe, expect, it } from "vitest";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import energyJson from "../../data/energy.json";
import overridesJson from "../../data/overrides.json";
import portsJson from "../../data/ports.json";
import logisticsJson from "../../data/logistics.json";
import powerJson from "../../data/power.json";
import relevesJson from "../../data/releves.json";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../engine/extension-types.ts";
import type { OverridesFile } from "../engine/types.ts";
import { buildSandboxCatalog } from "../engine/sandbox/index.ts";
import { setLang } from "../i18n/i18n.ts";
import { alertText, buildMenu, entriesFor, keyLabel, linePositions, machinesFor, recipeLine, routeErrorText, shortcut, wireErrorText } from "./sandbox-model.ts";

const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const cat = buildSandboxCatalog(data, { ports: portsJson as unknown as PortsFile, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson });
const menu = buildMenu(cat, (id) => (cat.blocks.get(id)?.pipe ? "Pipes" : data.machines.get(id)?.category ?? null));
const names = { block: (id: string) => cat.blocks.get(id)?.name ?? id, item: (id: string) => cat.items.get(id)?.name ?? id };

afterEach(() => setLang("fr"));

describe("menu de pose", () => {
  it("une entrée par famille de tuyaux, les variantes à part, jamais une pièce rusty par défaut", () => {
    const o1 = menu.byKey.get("fam:o1")!;
    expect(o1.def).toBe("short-pipe");
    expect(menu.variants.o1.slice(0, 4)).toEqual(["short-pipe", "pipe-turn", "pipe-junction", "pipe-section"]);
    expect(menu.entries.filter((e) => e.def === "pipe-turn")).toEqual([]);
  });
  it("posables d'abord, les bâtiments non relevés en gris à la fin", () => {
    const list = entriesFor(cat, menu, 1, "Factories");
    const firstLocked = list.findIndex((e) => !cat.blocks.get(e.def)!.geo);
    expect(firstLocked).toBeGreaterThan(0);
    expect(list.slice(firstLocked).every((e) => !cat.blocks.get(e.def)!.geo)).toBe(true);
  });
  it("raccourci [tier, catégorie, bloc]", () => {
    expect(shortcut(cat, menu, menu.byKey.get("press")!)).toBe("[1,5,3]");
    expect(shortcut(cat, menu, menu.byKey.get("fam:o1")!)).toBe("[1,1,1]");
  });
  it("port libre : les machines qui fournissent ce qu'il attend", () => {
    expect(machinesFor(cat, ["iron-ingot"], "out")).toEqual(expect.arrayContaining(["foundry"]));
    expect(machinesFor(cat, ["iron-plate"], "in")).toContain("roller");
  });
});

describe("pose", () => {
  it("en ligne sur l'axe le plus long, au pas de la machine, sans diagonale", () => {
    const roller = cat.blocks.get("roller")!; // 4 × 2
    expect(linePositions(roller, [0, 0], [9, 3], 0).map((p) => [p.x, p.y])).toEqual([[-1, 0], [3, 0], [7, 0]]);
    expect(linePositions(roller, [0, 0], [1, 5], 1).map((p) => [p.x, p.y])).toEqual([[0, -1], [0, 3]]);
  });
});

describe("touches et textes", () => {
  it("la lettre du clavier du joueur, sinon celle du QWERTY", () => {
    expect(keyLabel("KeyW", new Map())).toBe("W");
    expect(keyLabel("KeyW", new Map([["KeyW", "Z"]]))).toBe("Z");
    expect(keyLabel("Comma", new Map())).toBe(",");
  });
  it("alertes et refus dans les deux langues", () => {
    const a = { k: "machine", id: "roller", pct: 80, reason: { k: "saturatedOut", item: "copper-wire" } } as const;
    expect(alertText(a, names)).toBe("Roller à 80 % : tuyau saturé en sortie (Copper Wire)");
    expect(routeErrorText("notOutput")).toMatch(/entrée/);
    expect(wireErrorText({ k: "tooFar", dist: 30, range: 21 })).toMatch(/30 cases pour 21/);
    setLang("en");
    expect(alertText(a, names)).toBe("Roller at 80%: saturated output pipe (Copper Wire)");
    expect(recipeLine({ s: null, in: { "iron-ingot": 1 }, out: { "iron-plate": null } }, names.item)).toBe("1 Iron Ingot → ? Iron Plate (? s)");
  });
});
