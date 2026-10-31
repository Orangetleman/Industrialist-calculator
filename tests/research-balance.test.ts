// Lot S20 : solde de RP avec le plafond souple, installation du joueur, stations à ajouter.
// Référence : capture du Research Tracking Panel de l'utilisateur (2026-10-18) — 19 273,50 RP,
// 50,40 RP/s ; Tier 3 : 4 actives, +47,47 RP/s, seuil 76 875 ; « Max RP … » > 231 000 ; paraboles :
// 2 contrôleurs, +2,93 RP/s, 7 paraboles. Deux Crankshaft par station et Light Oil (0,1) supposés.
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
  balanceAfter,
  balanceTimeline,
  emptySetup,
  exactBalance,
  nearlyZero,
  nominalRate,
  parseResearchSetup,
  proposeAddStations,
  rateAt,
  researchModel,
  timeToReach,
  withAddedStations,
  type ResearchSetup,
  type RpTier,
} from "../src/engine/research-balance.ts";
import { circuitRate, designResearch, dishEfficiency, dishesExact, dishesNeeded, evaluateStations, rpParams, softCapFactor, tierSumFromPanel, unlockTimeline } from "../src/engine/research-points.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { progress } from "./engine-helpers.ts";
import { say } from "../src/ui/engine-text.ts";

const p = rpParams(stationsJson as unknown as ResearchStationsFile)!;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);

const RP0 = 19273.5;

/** Niveau détaillé de la capture (suppositions RP-01 et RP-02). */
function detailed(): ResearchSetup {
  const s = emptySetup();
  s.mode = "detaille";
  s.groups.rs3 = [{ count: 4, items: ["crankshaft", "crankshaft"] }];
  s.controllers = [{ count: 2, fluid: "light-oil" }];
  s.dish = { controllers: 2, rate: 2.93, dishes: 7, efficiency: 100 };
  s.panel.rs3 = { stations: 4, rate: 47.47, cap: 76875 };
  s.maxRp = 231000;
  return s;
}
/** Niveau rapide : les nombres du panneau recopiés. */
function quick(): ResearchSetup {
  const s = emptySetup();
  s.panel.rs3 = { stations: 4, rate: 47.47, cap: 76875 };
  s.dish = { controllers: 2, rate: 2.93, dishes: 7, efficiency: 100 };
  s.maxRp = 231000;
  return s;
}

describe("capture du 2026-10-18 refaite par le moteur", () => {
  const m = researchModel(p, data, detailed(), 50.4, RP0);
  const t3 = m.tiers[0]!;

  it("stations : +47,47 RP/s et seuil de 76 875 RP", () => {
    expect(m.source).toBe("stations");
    expect(m.tiers).toHaveLength(1);
    expect(t3.stationsRate).toBeCloseTo(47.47, 2);
    expect(t3.cap).toBeCloseTo(76875.4, 0);
  });

  it("paraboles : +2,93 RP/s, 3 paraboles suffisent pour 100 %", () => {
    expect(t3.boostRate).toBeCloseTo(2.93, 2);
    expect(t3.rate).toBeCloseTo(50.4, 2);
    expect(m.liquids).toBeCloseTo(0.2, 9);
    expect(m.dishesFor100).toBe(3);
  });

  it("« Max RP before RP/s is nearly zero » : 3 × seuil = 230 626, affiché > 231 000", () => {
    expect(nearlyZero(m.tiers)!).toBeCloseTo(230626.3, 0);
    expect(m.checks.every((c) => c.ok)).toBe(true);
    expect(m.checks.map((c) => say(c.label))).toEqual(["Tier 3 : RP/s", "Tier 3 : seuil", "Paraboles : RP/s", "Max RP before RP/s is nearly zero", "1ʳᵉ ligne : RP/s"]);
  });

  it("niveau rapide : les mêmes tiers, retrouvés depuis le panneau", () => {
    const q = researchModel(p, data, quick(), 50.4, RP0);
    expect(q.source).toBe("panneau");
    expect(q.tiers[0]!.rate).toBeCloseTo(50.4, 6);
    expect(q.tiers[0]!.cap).toBe(76875);
    // Les grandeurs du tier, retrouvées par les formules inverses, sont celles des 4 stations.
    expect(q.tiers[0]!.sum.value).toBeCloseTo(196, 0);
    expect(q.tiers[0]!.sum.factor).toBeCloseTo(4.659, 2);
    expect(q.checks.every((c) => c.ok)).toBe(true);
  });

  it("une capture qui ne colle pas est signalée", () => {
    const s = detailed();
    s.panel.rs3.cap = 80000;
    const bad = researchModel(p, data, s, 50.4, RP0).checks.find((c) => say(c.label) === "Tier 3 : seuil")!;
    expect(bad.ok).toBe(false);
  });

  it("évolution : seuil en 19 min, 2 × seuil après 1 h 58, 24 h ≈ 239 300 RP (et non 4,4 millions)", () => {
    const tiers = m.tiers;
    expect(timeToReach(tiers, RP0, t3.cap) / 60).toBeCloseTo(19.05, 1);
    expect(timeToReach(tiers, RP0, 2 * t3.cap) / 3600).toBeCloseTo(1.974, 2);
    expect(rateAt(tiers, 2 * t3.cap)).toBeCloseTo(5.04, 2);
    expect(rateAt(tiers, 100000)).toBeCloseTo(25.21, 1);
    expect(balanceAfter(tiers, RP0, 86400)).toBeCloseTo(239308, -1);
    expect(balanceAfter(tiers, RP0, 2 * 3600)).toBeCloseTo(154226, -1);
  });
});

describe("formule exacte contre intégration numérique", () => {
  const one: RpTier[] = [{ kind: "rs3", rate: 50.4, cap: 76875 }];
  const twin: RpTier[] = [
    { kind: "rs3", rate: 25.2, cap: 76875 },
    { kind: "rs2", rate: 25.2, cap: 76875 },
  ];

  it("deux tiers au même seuil (intégration) = un seul tier (formule exacte)", () => {
    for (const b of [50000, 76875, 100000, 153750, 230000]) {
      const exact = timeToReach(one, RP0, b);
      const numeric = timeToReach(twin, RP0, b);
      expect(Math.abs(numeric - exact) / exact).toBeLessThan(1e-6);
    }
    for (const t of [600, 3600, 6 * 3600, 86400]) expect(balanceAfter(twin, RP0, t)).toBeCloseTo(exactBalance(RP0, 50.4, 76875, t), 0);
  });

  it("la formule exacte suit dRP/dt = r × 10^(1−RP/seuil) (Euler fin)", () => {
    let rp = RP0;
    const dt = 0.5;
    for (let t = 0; t < 4 * 3600; t += dt) rp += dt * 50.4 * softCapFactor(rp, 76875, "rs3");
    expect(rp).toBeCloseTo(exactBalance(RP0, 50.4, 76875, 4 * 3600), -1);
  });

  it("le temps et le solde sont inverses l'un de l'autre, tier 4 compris", () => {
    const mixed: RpTier[] = [
      { kind: "rs3", rate: 30, cap: 50000 },
      { kind: "rs4", rate: 20, cap: 120000, circuits: 5 },
    ];
    for (const t of [1000, 5000, 20000]) {
      const b = balanceAfter(mixed, 1000, t);
      expect(timeToReach(mixed, 1000, b)).toBeCloseTo(t, 0);
    }
    expect(nominalRate(mixed)).toBe(55);
    // Tier 4 seul : la vitesse tombe à 1 % à 9 × le seuil (√9 = 3).
    expect(nearlyZero([{ kind: "rs4", rate: 10, cap: 1000 }])!).toBeCloseTo(9000, 3);
  });

  it("la chronologie rejoint l'ancienne (intégration de unlockTimeline)", () => {
    const nodes = [
      { id: "a", rp: 60000 },
      { id: "b", rp: 100000 },
    ];
    const ours = balanceTimeline(nodes, RP0, one)!;
    const old = unlockTimeline(nodes, RP0, 50.4, 76875, "rs3")!;
    ours.forEach((e, i) => expect(Math.abs(e.at - old[i]!.at) / old[i]!.at).toBeLessThan(1e-3));
    expect(ours.map((e) => e.overCap)).toEqual([false, true]);
  });
});

describe("stations ajoutées à celles du joueur", () => {
  const m = researchModel(p, data, detailed(), 50.4, RP0);

  it("4 stations de plus : 71,95 RP/s (+4,44 des paraboles), seuil 105 926", () => {
    const prop = proposeAddStations(p, data, detailed(), m, 0, 100000);
    expect(prop && "added" in prop).toBe(true);
    if (!prop || !("added" in prop)) return;
    expect(prop.added).toBe(4);
    expect(prop.after.stations).toBe(8);
    expect(prop.after.stationsRate).toBeCloseTo(71.95, 2);
    expect(prop.after.boostRate).toBeCloseTo(4.44, 2);
    expect(prop.after.cap).toBeCloseTo(105926, 0);
  });

  it("rien à ajouter si l'installation suffit ; seulement au niveau détaillé", () => {
    expect(proposeAddStations(p, data, detailed(), m, 50, 70000)).toBeNull();
    expect(proposeAddStations(p, data, quick(), researchModel(p, data, quick(), 50.4, RP0), 0, 100000)).toBeNull();
  });

  it("deux groupes du même tier ne s'additionnent pas : le tier se recalcule en entier", () => {
    const add = { value: 4 * 70 * 0.7, factor: tierSumFromPanel(p, "rs3", 47.466, 76875.45).factor };
    const merged = withAddedStations(p, m, "rs3", add);
    expect(merged).toHaveLength(1);
    // 8 stations : 2 × 392^0,6 × (1 + bonus) et non 2 × 47,47.
    expect(merged[0]!.rate).toBeCloseTo(71.95 + 4.44, 1);
    const other = withAddedStations(p, m, "rs2", { value: 10, factor: 2 });
    expect(other).toHaveLength(2);
  });

  it("une installation neuve du même tier se fusionne aussi dans designResearch (gain réel)", () => {
    const fresh = evaluateStations(p, "rs3", 4, ["crankshaft", "crankshaft"], data, false);
    const added = evaluateStations(p, "rs3", 4, ["crankshaft", "crankshaft"], data, false, m.tiers[0]!.sum);
    expect(fresh.base).toBeCloseTo(47.47, 2);
    expect(added.base).toBeCloseTo(71.95 - 47.47, 1);
    expect(added.cap).toBeCloseTo(105926, 0);
    const all = progress([...data.nodes.keys()]);
    const r = designResearch(data, all, p, { targetRate: 30, capNeeded: 0, satellites: false, logic: false, criterion: "machines", base: { rs3: m.tiers[0]!.sum }, kinds: ["rs3"] });
    expect(r.best).not.toBeNull();
    const d = r.best!.design;
    expect(d.rate).toBeGreaterThanOrEqual(30 - 1e-9);
    // Le gain est compté sur le tier entier : plus de stations qu'une installation neuve seule.
    const alone = designResearch(data, all, p, { targetRate: 30, capNeeded: 0, satellites: false, logic: false, criterion: "machines", kinds: ["rs3"] });
    const sameItems = alone.others.concat(alone.best ? [alone.best] : []).find((c) => c.design.items.join() === d.items.join());
    if (sameItems) expect(d.stations).toBeGreaterThanOrEqual(sameItems.design.stations);
  });
});

describe("saisie gardée", () => {
  it("relit ce qui a été gardé, écarte le reste", () => {
    const s = detailed();
    expect(parseResearchSetup(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseResearchSetup(null)).toBeNull();
    const odd = parseResearchSetup({ mode: "?", panel: { rs3: { rate: "x", cap: 5 } }, groups: { rs3: [{ count: 2, items: ["a", 3] }, { items: [] }] } })!;
    expect(odd.mode).toBe("rapide");
    expect(odd.panel.rs3).toEqual({ stations: null, rate: null, cap: 5 });
    expect(odd.groups.rs3).toEqual([{ count: 2, items: ["a"] }]);
  });

  it("sans tier renseigné : les RP/s de la 1ʳᵉ ligne, en ligne droite (comme avant)", () => {
    const m = researchModel(p, data, null, 3.5, 100);
    expect(m.source).toBe("rps");
    expect(balanceAfter(m.tiers, 100, 1000)).toBeCloseTo(3600, 6);
    expect(researchModel(p, data, null, null, null).source).toBe("aucune");
  });

  it("un seuil manquant : ce tier ne ralentit pas", () => {
    const s = quick();
    s.panel.rs3.cap = null;
    const m = researchModel(p, data, s, 50.4, RP0);
    expect(m.tiers[0]!.capMissing).toBe(true);
    expect(balanceAfter(m.tiers, 0, 1000)).toBeCloseTo(50400, 3);
  });
});

describe("Ma recherche : rendu (S20)", async () => {
  const { renderResearchOut, renderResearchForm } = await import("../src/ui/research-mine.ts");
  const m = researchModel(p, data, detailed(), 50.4, RP0);
  const t0 = Date.parse("2026-10-18T12:00:00Z");

  it("2 h après la saisie : ≈ 154 226 RP, 4,97 RP/s, seuil dépassé depuis 1 h 41", () => {
    const rpNow = balanceAfter(m.tiers, RP0, 7200);
    const html = renderResearchOut({ model: m, rp0: RP0, rpAt: t0, rpNow, now: t0 + 7_200_000, playing: false, realNow: t0 + 7_200_000, linearNow: RP0 + 50.4 * 7200 });
    expect(html).toContain("154\u202f226 RP");
    expect(html).toContain("4,97 RP/s");
    expect(html).toContain("Seuil dépassé depuis 1 h 41 min");
    expect(html).toContain("</svg> comme en jeu : Tier 3 : seuil 76\u202f875");
    expect(html).not.toContain('<li class="warn-text">');
  });

  it("le formulaire détaillé montre les groupes, avec les noms des items", () => {
    const html = renderResearchForm(data, detailed());
    expect(html).toContain('value="Crankshaft"');
    expect(html).toContain('data-rsg="rs3:0:count"');
    expect(html).toContain("Light Oil");
  });
});

describe("S48 : cas Industrialist Calculator avec les entrées de la capture", () => {
  // Leurs formules (COMPARAISON-POLLYWRATH.md § 4), recalculées ici à la main.
  const S = 2;
  const R = 0.2;
  it("paraboles : √(S × R) + S sans arrondi, efficacité linéaire, bonus 78 × log₁₀(R + 1) %", () => {
    expect(dishesExact(S, R)).toBeCloseTo(2 + Math.sqrt(0.4), 12);
    expect(dishesExact(S, R)).toBeLessThan(dishesNeeded(S, R));
    expect(dishEfficiency(7, S, R)).toBe(1);
    expect(dishEfficiency(dishesExact(S, R) / 2, S, R)).toBeCloseTo(0.5, 12);
    const m = researchModel(p, data, detailed(), 50.4, RP0);
    // Même résultat que le wiki sur cette capture : 47,47 × 0,78 × log₁₀(1,2) = 2,93.
    expect(m.tiers[0]!.stationsRate * 0.78 * Math.log10(R + 1)).toBeCloseTo(2.93, 2);
    expect(m.tiers[0]!.boostRate).toBeCloseTo(2.93, 2);
  });
  it("efficacité du modèle : 2 paraboles sur 2,63 nécessaires → 76 %, le bonus baisse d'autant", () => {
    const s = detailed();
    s.dish = { controllers: 2, rate: null, dishes: 2, efficiency: null };
    const m = researchModel(p, data, s, null, null);
    expect(m.efficiency).toBeCloseTo(2 / dishesExact(S, R), 9);
    expect(m.tiers[0]!.boostRate).toBeCloseTo(m.tiers[0]!.stationsRate * 0.78 * Math.log10(1.2) * m.efficiency, 9);
  });
  it("bonus RS4 : le wiki (× 6 ÷ t, t = 5) donne 1,2 fois leur plafond × 0,000025 × n ; on garde le wiki (RP-09)", () => {
    const cap = 100000;
    const theirs = cap * 0.000025 * 3;
    expect(circuitRate(p, cap, 3) / theirs).toBeCloseTo(6 / p.rs4.logicTicks, 9);
  });
});

describe("S49 : Ma recherche par tier (maquette S47)", async () => {
  const { renderResearchControl, renderResearchForm } = await import("../src/ui/research-mine.ts");
  it("un bloc par tier ; un tier sans groupe se crée par sa case « Stations »", () => {
    const html = renderResearchForm(data, detailed());
    for (const k of ["rs1", "rs2", "rs4"]) expect(html).toContain(`data-rsg-new="${k}"`);
    expect(html).not.toContain('data-rsg-new="rs3"');
    expect(html).toContain('data-rs-rate="rs3"');
    expect(html).toContain('data-rsd="dishes"');
    expect(html).not.toContain("data-rsmode");
  });
  it("contrôle de la 1ʳᵉ ligne : ✓ sous 2 % d'écart, sinon l'écart", () => {
    const m = researchModel(p, data, detailed(), 50.4, RP0);
    expect(renderResearchControl(m, RP0, 50.4)).toContain('class="rs-chk"');
    expect(renderResearchControl(m, RP0, 50.4 * 1.019)).toContain('class="rs-chk"');
    expect(renderResearchControl(m, RP0, 45)).toContain('class="rs-chk bad"');
    expect(renderResearchControl(researchModel(p, data, quick(), 50.4, RP0), RP0, 50.4)).toBe("");
  });
  it("une ancienne saisie « rapide » avec des groupes compte ses stations ; sans groupe, le panneau", () => {
    const s = detailed();
    s.mode = "rapide";
    expect(researchModel(p, data, s, 50.4, RP0).source).toBe("stations");
    expect(researchModel(p, data, quick(), 50.4, RP0).source).toBe("panneau");
  });
});
