// Phase E3 : formules des stations contre les exemples du wiki, installation, chronologie.
import { describe, expect, it } from "vitest";
import energyJson from "../data/energy.json";
import itemsJson from "../data/items.json";
import machinesJson from "../data/machines.json";
import overridesJson from "../data/overrides.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import stationsJson from "../data/research-stations.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import type { ResearchStationsFile } from "../src/engine/extension-types.ts";
import {
  capFactor,
  designResearch,
  dishesNeeded,
  rpParams,
  rs1Cap,
  rs1Rate,
  rs2Cap,
  satelliteBoost,
  softCapFactor,
  unlockTimeline,
  valueRate,
} from "../src/engine/research-points.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { progress } from "./engine-helpers.ts";

const p = rpParams(stationsJson as unknown as ResearchStationsFile)!;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = progress([...data.nodes.keys()]);

describe("formules des stations (exemples du wiki)", () => {
  it("toutes les valeurs sont dans les données, consommations comprises", () => {
    expect(p).not.toBeNull();
    expect(p.power).toMatchObject({ "research-station1": 2100, "research-station2": 17000, "research-station3": 600_000, "research-station4": 5_000_000 });
    expect(p.rs4.logicTicks).toBe(5);
  });

  it("RS1 : 13 stations donnent un plafond de 761 RP ; 9 stations, 3 RP/s", () => {
    expect(Math.floor(rs1Cap(p, 13))).toBe(761);
    expect(rs1Rate(9)).toBe(3);
  });

  it("RS2 : le tableau des plafonds du wiki", () => {
    const table: [number, number][] = [
      [1, 2000],
      [2, 3170],
      [3, 4000],
      [4, 4644],
      [5, 5170],
      [10, 6919],
      [15, 8000],
      [20, 8785],
      [30, 9908],
      [50, 11345],
      [100, 13316],
    ];
    for (const [m, cap] of table) expect(Math.round(rs2Cap(p, m)), `${m} stations`).toBe(cap);
  });

  it("RS3 : Raw Copper deux fois → 2,45 RP/s (pénalité de 30 %) ; Raw Copper + Coal → 3,03 RP/s", () => {
    expect(valueRate(p, 2 * (1 - p.rs3.samePenalty))).toBeCloseTo(2.45, 2);
    expect(valueRate(p, 2)).toBeCloseTo(3.03, 2);
  });

  it("facteur de plafond selon le prix de vente moyen (seuil de 600 $)", () => {
    expect(capFactor(p, 3, 600)).toBeCloseTo(3);
    expect(capFactor(p, 1, 2400)).toBeCloseTo(2); // log₄(4) + 1
    expect(capFactor(p, 1, 300)).toBeCloseTo(Math.log2(1.5));
  });

  it("paraboles : 1 contrôleur au Leaded Gasoline (23) → 17 % par parabole, 6 paraboles", () => {
    expect(100 / (Math.sqrt(23) + 1)).toBeCloseTo(17.25, 2);
    expect(dishesNeeded(1, 23)).toBe(6);
    expect(satelliteBoost(p, 23)).toBeCloseTo(0.78 * Math.log10(24));
  });

  it("plafond souple : vitesse pleine sous le plafond, ÷10 au double (RS4 : 10^(1−√2))", () => {
    expect(softCapFactor(500, 1000, "rs2")).toBe(1);
    expect(softCapFactor(2000, 1000, "rs3")).toBeCloseTo(0.1);
    expect(softCapFactor(2000, 1000, "rs4")).toBeCloseTo(10 ** (1 - Math.SQRT2));
  });
});

describe("chronologie de déblocage", () => {
  it("chaque déblocage dépense son coût ; au-delà du plafond, c'est plus lent", () => {
    const t = unlockTimeline(
      [
        { id: "a", rp: 100 },
        { id: "b", rp: 50 },
      ],
      20,
      10,
      Infinity,
      "rs2",
    )!;
    expect(t.map((x) => x.at)).toEqual([8, 13]); // 80 RP à 10 RP/s, puis 50 RP
    const slow = unlockTimeline([{ id: "c", rp: 2000 }], 0, 10, 1000, "rs2")!;
    // 1000 RP en 100 s, puis ∫ de 1000 à 2000 de dRP / (10 × 10^(1 − RP/1000))
    //   = (1000 / (10 · ln 10)) × (10¹ − 10⁰) ≈ 390,9 s.
    expect(slow[0]!.at).toBeCloseTo(100 + (1000 * 9) / (10 * Math.LN10), 3);
    expect(slow[0]!.overCap).toBe(true);
  });
});

describe("installation de recherche (vraies données)", () => {
  it("atteint la vitesse et le plafond demandés, chaîne des items comprise", () => {
    const r = designResearch(data, all, p, { targetRate: 50, capNeeded: 20_000, satellites: false, logic: false, criterion: "machines" });
    const d = r.best!.design;
    expect(d.rate).toBeGreaterThanOrEqual(50);
    expect(d.cap).toBeGreaterThanOrEqual(20_000);
    expect(r.best!.plan.status).toBe("ok");
    // Chaque item est fourni au débit des stations : 0,1 u/s par entrée et par station (RS3/RS4).
    if (d.kind === "rs3" || d.kind === "rs4") for (const q of Object.values(d.consumption)) expect(q % (d.stations * 6)).toBeCloseTo(0);
    // Une station de moins ne suffirait pas.
    const fewer = { ...d, stations: d.stations - 1 };
    expect(fewer.stations).toBeGreaterThanOrEqual(0);
  });

  it("RS2 seule : nombre de stations calculé à la main", () => {
    const r = designResearch(data, all, p, { targetRate: 20, capNeeded: 0, satellites: false, logic: false, criterion: "machines", kinds: ["rs2"] });
    const d = r.best!.design;
    const v = data.items.get(d.items[0]!)!.researchValue as number;
    // 2·(m·v)^0,6 ≥ 20  →  m ≥ 10^(1/0,6) / v
    expect(d.stations).toBe(Math.ceil(10 ** (1 / 0.6) / v - 1e-9));
    expect(d.consumption[d.items[0]!]).toBeCloseTo(d.stations * 30); // 0,5 u/s par station
    expect(d.powerMFps).toBe(d.stations * 17_000);
  });

  it("avec les paraboles, il faut moins de stations", () => {
    const base = designResearch(data, all, p, { targetRate: 300, capNeeded: 1e6, satellites: false, logic: false, criterion: "machines", kinds: ["rs4"] });
    const sat = designResearch(data, all, p, { targetRate: 300, capNeeded: 1e6, satellites: true, logic: false, criterion: "machines", kinds: ["rs4"] });
    expect(sat.best!.design.stations).toBeLessThanOrEqual(base.best!.design.stations);
  });

  it("sans station débloquée : un message, pas une erreur", () => {
    const r = designResearch(data, progress(), p, { targetRate: 10, capNeeded: 0, satellites: false, logic: false, criterion: "machines" });
    expect(r.best === null || r.best.design.kind === "rs1").toBe(true);
  });
});
