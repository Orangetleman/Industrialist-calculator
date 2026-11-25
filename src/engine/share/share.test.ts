// Lot P1 (PLAN-PARTAGE.md § 3) : un design encodé puis décodé est identique en profondeur, sur de vrais
// graphes (G1–G6), de vrais bacs à sable, des réglages variés et 1 000 designs aléatoires ; les liens figés
// de tests/fixtures/liens-v1.txt redonnent toujours le même design ; les anciens codes .msch se lisent.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../../ui/state.ts";
import { planToGraph } from "../graph/index.ts";
import type { Graph } from "../graph/model.ts";
import type { Layout } from "../sandbox/layout.ts";
import { toCode, writeMsch } from "../schematic/msch.ts";
import { deflate, Reader, Writer } from "./bytes.ts";
import { canonNodes, decodeDesign, decodeDesignBytes, designBody, designLink, encodeDesign, encodeDesignBytes, PLAYER_V1, same, SETTINGS_V1, ShareError, SITE_VERSION, type Design } from "./codec.ts";
import { defaultSettingsV1, designFromMschCode, designFromMschFile } from "./msch.ts";
import { NODES_V1 } from "./nodes-v1.ts";
import { TABLE_V1 } from "./table-v1.ts";
import { editedGraph, editOf, factoryLayout, planFor, pollywrathGraph, settingsWith } from "../../../tests/share-designs.ts";

const roundTrip = async (d: Design) => {
  const back = await decodeDesign(await encodeDesign(d));
  expect(back).toStrictEqual(d);
  const file = await decodeDesignBytes(await encodeDesignBytes(d));
  expect(file).toStrictEqual(d);
  return back;
};

const code = async (f: () => Promise<unknown>) => {
  try {
    await f();
    return null;
  } catch (e) {
    return e instanceof ShareError ? e.code : `autre : ${String(e)}`;
  }
};

describe("octets", () => {
  it("nombres exacts : entiers, quarts, décimaux, -0, très grands, null", () => {
    const xs = [0, 1, -1, 63, 64, -65, 2 ** 31, -(2 ** 40), 2 ** 47 - 1, 2 ** 48, 2 ** 53 + 2, 0.25, -0.75, 2.5, 0.1, 1 / 3, -0, Number.MAX_VALUE, Number.MIN_VALUE, Infinity, -Infinity, NaN, null];
    const w = new Writer([]);
    for (const x of xs) w.num(x);
    const r = new Reader(w.bytes(), []);
    for (const x of xs) expect(Object.is(r.num(), x), String(x)).toBe(true);
    expect(r.done).toBe(true);
  });

  it("chaînes : rang dans la table figée, en clair la 1re fois, rang ensuite", () => {
    const w = new Writer(TABLE_V1);
    w.str("crankshaft");
    w.str("Bloc « fer » ✓");
    w.str("Bloc « fer » ✓");
    const b = w.bytes();
    expect(b.length).toBeLessThan(2 + 2 + 1 + 16 + 2 + 3);
    const r = new Reader(b, TABLE_V1);
    expect([r.str(), r.str(), r.str()]).toEqual(["crankshaft", "Bloc « fer » ✓", "Bloc « fer » ✓"]);
  });

  it("la table v1 n'a pas de doublon (un rang = une chaîne)", () => {
    expect(new Set(TABLE_V1).size).toBe(TABLE_V1.length);
  });
});

describe("réglages", () => {
  it("les défauts figés de la v1 sont ceux du site (un champ ajouté à Settings va EN FIN de SETTINGS_V1)", () => {
    expect(SETTINGS_V1.map(([k]) => k)).toEqual(Object.keys(DEFAULT_SETTINGS));
    expect(defaultSettingsV1()).toStrictEqual(DEFAULT_SETTINGS);
  });

  it("réglages par défaut : presque rien dans le lien", async () => {
    const d: Design = { site: SITE_VERSION, settings: defaultSettingsV1() };
    await roundTrip(d);
    expect(designBody(d).length).toBeLessThan(20);
  });

  it("réglages variés : chaque champ changé revient tel quel", async () => {
    const variants: Partial<Settings>[] = [
      { goal: "énergie", entered: ["objet", "énergie"], energyMFps: 2_500_000.5, energyUnit: "M", energyGuaranteed: true },
      { item: "gearbox", rate: 120, rateUnit: "min", mode: "machines", machines: 7, maxPollution: 12.3 },
      { criteria: { ...DEFAULT_SETTINGS.criteria, objet: ["energy", "area", "machines", "cost", "pollution", "raw", "steps"] }, posePriority: ["prix", "place", "forme", "pieces"] },
      { forced: { "iron-ingot": "iron-ingot-from-ore" }, fixed: { sig: "objet|crankshaft|rate|60", machines: { a: 3, b: 1 } } },
      { machineFilters: { "objet|crankshaft": { mode: "exclure", exclure: ["press"], seulement: [], noExtraction: [] } }, machineSettings: { "objet|crankshaft": { "chemical-plant": { temp: 0.5 } } } as never },
      { dieselChoice: { énergie: { fuel: "refined-diesel", mode: "carburant", config: null } } as never, mineshaftChoice: { "objet|gold": { depth: "auto", head: "steel", acid: "hcl", oil: true } } as never },
      { evacSides: { "objet|crankshaft": { crankshaft: "droite" } }, existing: { "iron-ore": 30.25 }, useExisting: false, money: 1e9 },
      { usine: { full: true, glue: true, detail: true, power: false, plugs: true, links: true }, tier3Only: true, distanceTiles: 0 },
      { goal: "recherche", rpMode: "rate", rpRate: 0.1, rpNode: "advanced-assembler", rpMinutes: 90, rpCap: 0, rpSatellites: false, rpLogic: true, rpCurrent: false },
    ];
    for (const v of variants) await roundTrip({ site: SITE_VERSION, settings: settingsWith(v) });
  });

  it("champ manquant (vieux réglages) ou inconnu de la v1 : gardé tel quel", async () => {
    const { rpCurrent: _r, ...old } = defaultSettingsV1();
    await roundTrip({ site: "0.0.1", settings: old });
    await roundTrip({ site: "9.9.9", settings: { ...defaultSettingsV1(), nouveau: { a: [1, 2.5] } } });
  });
});

describe("vrais designs (graphes G1–G6, bacs à sable)", () => {
  const gearbox = planFor("gearbox", 120);
  const crank = planFor("crankshaft", 3600);

  it("graphe du plan (G1), retouché (G3–G5), recalculé (G4), importé d'Industrialist Calculator (G5)", async () => {
    for (const g of [planToGraph(gearbox).graph, editedGraph(gearbox), editedGraph(crank), pollywrathGraph()]) {
      await roundTrip({ site: SITE_VERSION, settings: defaultSettingsV1(), graph: editOf("objet|gearbox|rate|120", g) });
      await roundTrip({ site: SITE_VERSION, name: "Essai", settings: defaultSettingsV1(), graph: { ...editOf("s", g, g), links: { "a|b": g.nodes[0]!.id }, linksFor: "x" } });
    }
  });

  it("bac à sable : l'usine convertie (comme l'export .msch), et figée dans le fichier", async () => {
    const l = factoryLayout(gearbox);
    expect(l.blocks.length).toBeGreaterThan(10);
    await roundTrip({ site: SITE_VERSION, settings: defaultSettingsV1(), graph: editOf("s", editedGraph(gearbox)), sandbox: l, factory: l });
  }, 180_000); // calcul de l'usine : ~20 s seul, bien plus quand toute la suite tourne

  it("bac à sable avec recettes choisies, côtés ouverts, voies, liaisons et chiffres saisis", async () => {
    const l: Layout = {
      blocks: [
        { u: 7, id: "press", x: 10, y: 20, r: 1, choice: "iron-coil" },
        { u: 8, id: "conveyor", x: 13, y: 20, r: 0, open: ["N", "E"] },
        { u: 9, id: "crossing", x: 14, y: 22, r: 3, pair: 2 },
        { u: 3, id: "pole", x: -40, y: 40.5, r: 2, choice: null },
      ],
      wires: [{ a: 9, ia: 0, b: 7, ib: 1, t: "p" }, { a: 3, ia: 0, b: 9, ib: 0, t: "g" }, { a: 99, ia: 0, b: 3, ib: 2, t: "p" }],
      routes: [{ a: 7, ia: 0, b: 8, ib: 1 }, { a: 8, ia: 1, b: 9, ib: 0, off: true }],
      fills: { "x-recipe": { s: 2.5, in: { a: 1 }, out: { b: 0.3 } } },
    };
    await roundTrip({ site: SITE_VERSION, settings: defaultSettingsV1(), sandbox: l });
  });
});


// ---------------------------------------------------------------- fuzz

/** Hasard reproductible (mulberry32). */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fuzzDesign(rand: () => number): Design {
  const int = (n: number) => Math.floor(rand() * n);
  const pick = <T,>(xs: readonly T[]): T => xs[int(xs.length)]!;
  const chance = (p: number) => rand() < p;
  const num = (): number => pick([() => int(200) - 100, () => (int(800) - 400) / 4, () => rand() * 1e6 - 5e5, () => pick([-0, 2 ** 52, -(2 ** 60), 1e-300, 0.1, NaN, Infinity]), () => int(10)])();
  const str = (): string => pick([() => pick(TABLE_V1), () => pick(["", "é", "n1", "Bloc « fer »", "a>b:c", "🏭", "__proto__", "x".repeat(int(300))]), () => `id-${int(50)}`])();
  const value = (depth: number): unknown => {
    const k = int(depth > 2 ? 5 : 7);
    if (k === 0) return null;
    if (k === 1) return chance(0.5);
    if (k === 2) return num();
    if (k === 3 || k === 4) return str();
    if (k === 5) return Array.from({ length: int(4) }, () => value(depth + 1));
    return Object.fromEntries(Array.from({ length: int(4) }, () => [str(), value(depth + 1)]));
  };
  const settings = defaultSettingsV1();
  for (const [k] of SETTINGS_V1) if (chance(0.15)) settings[k] = value(0);
  if (chance(0.05)) settings[str() + "?"] = value(0);
  const canonical = chance(0.7);
  const graph = (): Graph => {
    const n = int(30);
    const ids = canonical ? Array.from({ length: n }, (_, i) => `n${i + 1 + (chance(0.1) ? int(5) : 0)}`) : Array.from({ length: n }, () => str());
    const nodes = ids.map((id) => {
      const node: Record<string, unknown> = { id, recipeId: str(), machines: chance(0.5) ? int(20) / 4 : num(), x: chance(0.8) ? int(2000) : num(), y: chance(0.8) ? int(2000) : num() };
      if (chance(0.2)) node.fixed = chance(0.8);
      if (chance(0.1)) node.added = chance(0.8);
      if (chance(0.1)) node.settings = value(1);
      if (chance(0.2)) node.group = pick(["g1", "g2", str()]);
      return node;
    }) as Graph["nodes"];
    const ref = () => (nodes.length && chance(0.95) ? pick(nodes).id : str());
    const edges = Array.from({ length: int(40) }, () => {
      const from = ref(), to = ref(), item = str();
      return { id: chance(0.97) ? `${from}>${to}:${item}` : str(), from, to, item };
    });
    const g: Graph = { nodes, edges, target: chance(0.7) ? { node: ref(), item: str() } : null, rate: chance(0.7) ? num() : null };
    if (chance(0.3)) g.groups = Array.from({ length: int(3) }, () => ({ id: str(), name: str(), ...(chance(0.5) ? { collapsed: chance(0.7) } : {}) }));
    return g;
  };
  const layout = (): Layout => {
    let u = int(5);
    const blocks = Array.from({ length: int(60) }, () => {
      u += chance(0.9) ? 1 : int(10) - 3;
      const b: Record<string, unknown> = { u: chance(0.98) ? u : num(), id: str(), x: chance(0.9) ? int(300) - 50 : num(), y: chance(0.9) ? int(300) - 50 : num(), r: chance(0.97) ? int(4) : num() };
      if (chance(0.3)) b.choice = chance(0.8) ? str() : null;
      if (chance(0.2)) b.open = Array.from({ length: int(5) }, () => pick(["N", "E", "S", "W", "W", str()]));
      if (chance(0.1)) b.pair = pick([0, 1, 2, num()]);
      return b;
    }) as Layout["blocks"];
    const ref = () => (blocks.length && chance(0.95) ? pick(blocks).u : num());
    const l: Layout = { blocks, wires: Array.from({ length: int(30) }, () => ({ a: ref(), ia: int(6), b: ref(), ib: chance(0.9) ? int(6) : num(), t: pick(["p", "g", "p", str()]) as "p" })) };
    if (chance(0.4)) l.routes = Array.from({ length: int(10) }, () => ({ a: ref(), ia: int(4), b: ref(), ib: int(4), ...(chance(0.3) ? { off: true as const } : {}) }));
    if (chance(0.2)) l.fills = value(1) as Layout["fills"];
    return l;
  };
  const d: Design = { site: chance(0.9) ? SITE_VERSION : str(), settings };
  if (chance(0.3)) d.name = str();
  if (chance(0.8)) {
    const g = graph();
    d.graph = { sig: str(), graph: g, solved: chance(0.4) ? (chance(0.5) ? g : graph()) : null, touched: chance(0.5) };
    if (chance(0.3)) d.graph.links = Object.fromEntries(Array.from({ length: int(5) }, () => [str(), str()]));
    if (chance(0.3)) d.graph.linksFor = str();
  }
  if (chance(0.5)) d.sandbox = layout();
  if (chance(0.2)) d.factory = layout();
  if (chance(0.3)) d.print = Array.from({ length: 16 }, () => int(16).toString(16)).join("");
  if (chance(0.4)) {
    const nodes = () => (chance(0.7) ? canonNodes(NODES_V1.filter(() => chance(0.5)).concat(chance(0.2) ? [str() + "?"] : [])) : Array.from({ length: int(12) }, str));
    const player: Record<string, unknown> = Object.fromEntries(PLAYER_V1.map(([k, v]) => [k, chance(0.3) ? value(1) : v]));
    if (chance(0.1)) delete player.month;
    d.profile = { progress: { unlocked: nodes(), reqItemsDone: nodes(), owned: Array.from({ length: int(5) }, str) }, player };
    for (const k of ["corrections", "surveys", "interfaces", "diesel"] as const) if (chance(0.2)) d.profile[k] = value(0) ?? {};
  }
  return d;
}

describe("fuzz", () => {
  it("1 000 designs aléatoires : aller-retour identique", async () => {
    const rand = rng(20261124);
    for (let i = 0; i < 1000; i++) {
      const d = fuzzDesign(rand);
      const back = await decodeDesignBytes(await encodeDesignBytes(d));
      if (!same(back, d)) expect(back, `design n°${i}`).toStrictEqual(d);
      expect(back).toStrictEqual(d);
    }
  }, 60_000);

  it("données abîmées : erreur typée, jamais un design inventé ni un plantage", async () => {
    const rand = rng(7);
    const good = await encodeDesignBytes(fuzzDesign(rand));
    for (let i = 0; i < 300; i++) {
      const bad = good.slice(0, 1 + Math.floor(rand() * good.length));
      const at = Math.min(bad.length - 1, 1 + Math.floor(rand() * bad.length));
      bad[at] = bad[at]! ^ (1 + Math.floor(rand() * 255));
      const c = await code(() => decodeDesignBytes(bad));
      // Une altération peut tomber par chance sur un autre design valide : on n'exige que l'absence de plantage non typé.
      expect([null, "abîmé", "version-future"]).toContain(c);
    }
    // Corps valide en deflate mais faux : abîmé.
    const junk = await deflate(new Uint8Array([200, 1, 2, 3]));
    expect(await code(() => decodeDesignBytes(new Uint8Array([1, ...junk])))).toBe("abîmé");
  });
});

describe("liens", () => {
  it("formes acceptées : adresse entière, #d=, d=, données seules", async () => {
    const d: Design = { site: SITE_VERSION, settings: settingsWith({ item: "gearbox" }) };
    const s = await encodeDesign(d);
    expect(s).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    for (const form of [s, `d=${s}`, `#d=${s}`, designLink("https://industrialist.myprisme.fr/", s), `  ${designLink("http://localhost:5173", s)}  `]) expect(await decodeDesign(form)).toStrictEqual(d);
    expect(designLink("https://industrialist.myprisme.fr/", s)).toBe(`https://industrialist.myprisme.fr/#d=${s}`);
  });

  it("version future, pas un lien, données abîmées", async () => {
    const s = await encodeDesign({ site: SITE_VERSION, settings: defaultSettingsV1() });
    expect(await code(() => decodeDesign("2.AAAA"))).toBe("version-future");
    expect(await code(() => decodeDesignBytes(new Uint8Array([2, 0])))).toBe("version-future");
    expect(await code(() => decodeDesign("bonjour"))).toBe("pas-un-lien");
    expect(await code(() => decodeDesign("https://industrialist.myprisme.fr/#recettes"))).toBe("pas-un-lien");
    expect(await code(() => decodeDesign(s.slice(0, -6)))).toBe("abîmé");
    expect(await code(() => decodeDesign(`1.${s.slice(2, 3) === "A" ? "B" : "A"}${s.slice(3)}`))).toBe("abîmé");
  });
});

// ---------------------------------------------------------------- liens figés (non-régression)

const FIX = new URL("../../../tests/fixtures/", import.meta.url);
const fixed = (): Record<string, Design> => {
  const gearbox = planFor("gearbox", 120);
  const g = editedGraph(gearbox);
  return {
    "réglages-seuls": { site: "0.1.0", settings: settingsWith({ goal: "énergie", entered: ["énergie"], energyMFps: 2_500_000, selfPowered: true }) },
    "graphe-gearbox": { site: "0.1.0", name: "Gearbox 120/min", settings: settingsWith({ item: "gearbox", rate: 120, rateUnit: "min", entered: ["objet"] }), graph: editOf("objet|gearbox|rate|120", g, g) },
    "graphe-importé": { site: "0.1.0", settings: defaultSettingsV1(), graph: editOf("objet|gearbox|rate|120", pollywrathGraph()) },
    "bac-à-sable": { site: "0.1.0", name: "Montage", settings: defaultSettingsV1(), sandbox: { blocks: [{ u: 0, id: "press", x: 0, y: 0, r: 1, choice: "iron-coil" }, { u: 1, id: "conveyor", x: 3, y: 0, r: 0, open: ["N", "E"] }, { u: 2, id: "crossing", x: 4, y: 2, r: 3, pair: 2 }], wires: [{ a: 0, ia: 0, b: 1, ib: 1, t: "p" }], routes: [{ a: 1, ia: 0, b: 2, ib: 2 }], fills: { r: { s: 2.5 } } } },
  };
};

describe("liens figés v1 (tests/fixtures/liens-v1.txt)", () => {
  it.runIf(process.env.FIGER_LIENS === "1")("écrit les liens figés (une seule fois, à la création du format)", async () => {
    const ds = fixed();
    const lines = ["# Liens de partage v1 figés le 2026-11-24 : chacun doit toujours redonner le design de liens-v1.json.", "# NE PAS régénérer : un lien déjà donné à un joueur ne change pas.", ""];
    for (const [k, d] of Object.entries(ds)) lines.push(`${k}\t${await encodeDesign(d)}`);
    writeFileSync(new URL("liens-v1.txt", FIX), lines.join("\n") + "\n");
    writeFileSync(new URL("liens-v1.json", FIX), JSON.stringify(ds, null, 1) + "\n");
  });

  it("chaque lien figé redonne exactement son design", async () => {
    const want = JSON.parse(readFileSync(new URL("liens-v1.json", FIX), "utf8")) as Record<string, Design>;
    const lines = readFileSync(new URL("liens-v1.txt", FIX), "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
    expect(lines.length).toBe(Object.keys(want).length);
    for (const l of lines) {
      const [k, link] = l.split("\t") as [string, string];
      expect(await decodeDesign(link), k).toStrictEqual(want[k]);
    }
  });
});

// ---------------------------------------------------------------- anciens .msch

describe("anciens codes .msch (lecture seule)", () => {
  it("un code ou un fichier .msch devient un design (bac à sable seul, réglages par défaut)", async () => {
    const s = { name: "Ferme à fer", description: "", labels: [], width: 10, height: 6, layout: { blocks: [{ u: 0, id: "drill", x: 0, y: 0, r: 1, choice: "iron-ore" }, { u: 1, id: "conveyor", x: 4, y: 5, r: 0, open: ["N", "E"] as ("N" | "E")[] }], wires: [{ a: 0, ia: 0, b: 1, ib: 1, t: "p" as const }] } };
    const want: Design = { site: "", name: "Ferme à fer", settings: defaultSettingsV1(), sandbox: s.layout };
    expect(await designFromMschCode(await toCode(s))).toStrictEqual(want);
    expect(await designFromMschFile(await writeMsch(s))).toStrictEqual(want);
    await roundTrip(want); // et il se repartage en lien v1
    expect(await code(() => designFromMschCode("bonjour"))).toBe("abîmé");
  });

  it("l'usine convertie en .msch puis relue se repartage à l'identique", async () => {
    const l = factoryLayout(planFor("gearbox", 120));
    const d = await designFromMschCode(await toCode({ name: "Gearbox", description: "", labels: [], width: 160, height: 110, layout: l }));
    await roundTrip(d);
    // Le .msch part de 0 : un relais posé hors du bord (x < 0) décale tout, à l'identique.
    const dx = Math.min(0, ...l.blocks.map((b) => b.x));
    const dy = Math.min(0, ...l.blocks.map((b) => b.y));
    expect(d.sandbox!.blocks.map(({ id, x, y, r }) => [id, x, y, r])).toEqual(l.blocks.map(({ id, x, y, r }) => [id, x - dx, y - dy, r]));
  }, 180_000);
});
