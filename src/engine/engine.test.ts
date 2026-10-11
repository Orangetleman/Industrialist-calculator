import { describe, expect, it } from "vitest";
import { makeData, progress, SRC } from "../../tests/engine-helpers.ts";
import { formulaSeconds, treeGrowthSeconds } from "./pollution.ts";
import { solve } from "./solve.ts";
import type { TreeGrowth, TreeGrowthFormula } from "./types.ts";
import { inconsistentNodes, machineAccess, missingNodes, unlockUpTo } from "./unlock.ts";

const all = progress();
const step = (plan: ReturnType<typeof solve>, item: string) => plan.steps.find((s) => s.item === item)!;

describe("arrondi et agrégation", () => {
  // 1 machine : 1 x toutes les 10 s = 6 x/min
  const data = makeData({ recipes: [{ id: "rx", machine: "m", t: 10, out: { x: 1 } }] });

  it("machines = ceil(débit demandé / débit d'une machine)", () => {
    expect(step(solve(data, all, { item: "x", ratePerMin: 24 }), "x").machines).toBe(4);
    expect(step(solve(data, all, { item: "x", ratePerMin: 25 }), "x").machines).toBe(5);
  });

  it("tolère les erreurs d'arrondi flottant (4,0000000001 → 4)", () => {
    expect(step(solve(data, all, { item: "x", ratePerMin: 24.0000000001 }), "x").machines).toBe(4);
  });

  it("mode « N machines finales »", () => {
    const plan = solve(data, all, { item: "x", finalMachines: 3 });
    expect(plan.target.ratePerMin).toBeCloseTo(18);
    expect(step(plan, "x").machines).toBe(3);
  });

  it("agrège la demande d'un item partagé avant d'arrondir", () => {
    const d = makeData({
      recipes: [
        { id: "rt", machine: "m", t: 60, in: { a: 1, b: 1 }, out: { t: 1 } },
        { id: "ra", machine: "m", t: 60, in: { s: 1 }, out: { a: 1 } },
        { id: "rb", machine: "m", t: 60, in: { s: 1 }, out: { b: 1 } },
        { id: "rs", machine: "m", t: 10, out: { s: 1 } }, // 6 s/min
      ],
    });
    const plan = solve(d, all, { item: "t", ratePerMin: 1.5 });
    expect(step(plan, "s").demandPerMin).toBeCloseTo(3);
    expect(step(plan, "s").machines).toBe(1); // 0,25 + 0,25 → 1, et non 1 + 1
    expect(step(plan, "s").consumers.map((c) => c.item).sort()).toEqual(["a", "b"]);
  });

  it("énergie moyenne (machines fractionnaires) et pic (machines arrondies)", () => {
    const d = makeData({ recipes: [{ id: "rx", machine: "m", t: 10, e: 1000, out: { x: 1 } }] });
    const plan = solve(d, all, { item: "x", ratePerMin: 9 }); // 1,5 machine
    expect(plan.totals.energyAvg).toBeCloseTo(1500);
    expect(plan.totals.energyPeak).toBe(2000);
  });

  it("recette qui consomme son propre produit : bilan net", () => {
    const d = makeData({
      recipes: [
        { id: "boost", machine: "bf", t: 20, in: { c: 200, o: 10 }, out: { c: 300 } },
        { id: "ro", machine: "m", t: 1, out: { o: 1 } },
      ],
    });
    const plan = solve(d, all, { item: "c", ratePerMin: 300 }); // net 100 / 20 s = 300/min
    expect(step(plan, "c").machinesExact).toBeCloseTo(1);
    expect(step(plan, "c").inputs).toEqual([{ item: "o", perMin: 30 }]);
  });
});

describe("sous-produits et boucles", () => {
  it("liste les sous-produits comme surplus à évacuer", () => {
    const d = makeData({
      recipes: [
        { id: "rp", machine: "m", t: 60, in: { ore: 2 }, out: { p: 1, slag: 3 } },
        { id: "rore", machine: "m", t: 1, out: { ore: 1 } },
      ],
    });
    const plan = solve(d, all, { item: "p", ratePerMin: 2 });
    expect(plan.surplus).toEqual([{ item: "slag", perMin: 6, from: ["rp"], alsoDemanded: false }]);
    expect(step(plan, "p").byproducts).toEqual([{ item: "slag", perMin: 6 }]);
  });

  it("signale un surplus qui est aussi demandé ailleurs", () => {
    const d = makeData({
      recipes: [
        { id: "rt", machine: "m", t: 60, in: { p: 1, slag: 1 }, out: { t: 1 } },
        { id: "rp", machine: "m", t: 60, out: { p: 1, slag: 1 } },
        { id: "rslag", machine: "m", t: 30, out: { slag: 1 } }, // plus efficace que rp pour le slag
      ],
    });
    const plan = solve(d, all, { item: "t", ratePerMin: 1 });
    expect(plan.surplus[0]).toMatchObject({ item: "slag", alsoDemanded: true });
    expect(plan.warnings.some((w) => w.code === "surplus-réutilisable")).toBe(true);
  });

  it("détecte une boucle sans planter", () => {
    const d = makeData({
      recipes: [
        { id: "ra", machine: "m", t: 10, in: { b: 1 }, out: { a: 1 } },
        { id: "rb", machine: "m", t: 10, in: { a: 1 }, out: { b: 1 } },
      ],
    });
    const plan = solve(d, all, { item: "a", ratePerMin: 6 });
    expect(plan.status).toBe("partiel");
    expect(plan.unresolved).toHaveLength(1);
    expect(plan.unresolved[0]?.reason).toBe("boucle");
    expect(plan.warnings.some((w) => w.code.startsWith("boucle") && w.items?.includes("a") && w.items.includes("b"))).toBe(true);
  });

  it("sans recette forcée, une alternative sans boucle est préférée", () => {
    const d = makeData({
      recipes: [
        { id: "ra", machine: "m", t: 10, in: { b: 1 }, out: { a: 1 } },
        { id: "rb-loop", machine: "m", t: 10, in: { a: 1 }, out: { b: 1 } },
        { id: "rb-raw", machine: "m", t: 10, out: { b: 1 } },
      ],
    });
    const plan = solve(d, all, { item: "a", ratePerMin: 6 });
    expect(step(plan, "b").recipeId).toBe("rb-raw");
    expect(plan.status).toBe("ok");
  });

  it("une boucle de conversion « gratuite » (gain 1) n'est jamais préférée à une vraie source", () => {
    // Cas réel du wiki : 5 Sulfur → 10 Liquid Sulfur ; 4 Liquid Sulfur → 2 Sulfur.
    // Avec le critère « matières premières », tourner en rond ne coûte rien de plus.
    const d = makeData({
      machines: [
        { id: "furnace", size: [2, 2] },
        { id: "molder", size: [2, 2] },
        { id: "oxidation", size: [20, 20] },
      ],
      recipes: [
        { id: "melt", machine: "furnace", t: 5, in: { sulfur: 5 }, out: { liquid: 10 } },
        { id: "mold", machine: "molder", t: 4, in: { liquid: 4 }, out: { sulfur: 2 } },
        { id: "oxid", machine: "oxidation", t: 20, in: { gas: 20 }, out: { liquid: 30 } },
        { id: "well", machine: "m", t: 1, out: { gas: 1 } },
      ],
    });
    for (const criterion of ["machines", "energy", "raw"] as const) {
      const plan = solve(d, all, { item: "sulfur", ratePerMin: 10, criterion });
      expect(plan.status, criterion).toBe("ok");
      expect(step(plan, "liquid").recipeId, criterion).toBe("oxid");
      expect(plan.unresolved, criterion).toEqual([]);
    }
  });

  it("une recette forcée qui crée une boucle est respectée, et la boucle est signalée", () => {
    const d = makeData({
      recipes: [
        { id: "ra", machine: "m", t: 10, in: { b: 1 }, out: { a: 1 } },
        { id: "rb-loop", machine: "m", t: 10, in: { a: 1 }, out: { b: 1 } },
        { id: "rb-raw", machine: "m", t: 10, out: { b: 1 } },
      ],
    });
    const plan = solve(d, all, { item: "a", ratePerMin: 6, forced: { b: "rb-loop" } });
    expect(step(plan, "b")).toMatchObject({ recipeId: "rb-loop", forced: true });
    expect(plan.warnings.some((w) => w.code === "boucle")).toBe(true);
    expect(plan.status).toBe("partiel");
  });
});

describe("choix des recettes", () => {
  // r1 : lent mais sobre ; r2 : rapide, gourmand en énergie et en minerai
  const data = makeData({
    recipes: [
      { id: "r1", machine: "m1", t: 10, e: 100, in: { ore: 1 }, out: { x: 1 } },
      { id: "r2", machine: "m2", t: 5, e: 10000, in: { ore: 3 }, out: { x: 1 } },
      { id: "rore", machine: "drill", t: 1, e: 1000, out: { ore: 1 } },
    ],
  });

  it("critère « moins de machines »", () => {
    expect(step(solve(data, all, { item: "x", ratePerMin: 6, criterion: "machines" }), "x").recipeId).toBe("r2");
  });
  it("critère « moins d'énergie »", () => {
    expect(step(solve(data, all, { item: "x", ratePerMin: 6, criterion: "energy" }), "x").recipeId).toBe("r1");
  });
  it("critère « moins de matières premières »", () => {
    expect(step(solve(data, all, { item: "x", ratePerMin: 6, criterion: "raw" }), "x").recipeId).toBe("r1");
  });

  it("recette forcée à la main", () => {
    const plan = solve(data, all, { item: "x", ratePerMin: 6, criterion: "machines", forced: { x: "r1" } });
    expect(step(plan, "x")).toMatchObject({ recipeId: "r1", forced: true });
  });

  it("recette forcée invalide : ignorée avec avertissement", () => {
    const plan = solve(data, all, { item: "x", ratePerMin: 6, forced: { x: "rore" } });
    expect(step(plan, "x").recipeId).toBe("r2");
    expect(plan.warnings.some((w) => w.code === "forcée-invalide")).toBe(true);
  });

  it("à égalité, la machine la plus petite l'emporte ; taille inconnue en dernier", () => {
    const d = makeData({
      machines: [
        { id: "kiln", size: [20, 10] },
        { id: "furnace", size: [8, 8] },
        { id: "mystery" },
      ],
      recipes: [
        { id: "a-kiln", machine: "kiln", t: 20, e: 15000, out: { mix: 51.2 } },
        { id: "b-furnace", machine: "furnace", t: 5, e: 15000, out: { mix: 12.8 } },
        { id: "c-mystery", machine: "mystery", t: 5, e: 15000, out: { mix: 12.8 } },
      ],
    });
    expect(step(solve(d, all, { item: "mix", ratePerMin: 100 }), "mix").recipeId).toBe("b-furnace");
  });

  it("préfère une chaîne complète à une chaîne avec un item verrouillé", () => {
    const d = makeData({
      nodes: [{ id: "n", rp: 10 }],
      machines: [{ id: "locked", unlockedBy: "n" }],
      recipes: [
        { id: "fast", machine: "m", t: 1, in: { rare: 1 }, out: { x: 1 } },
        { id: "rare", machine: "locked", t: 1, out: { rare: 1 } },
        { id: "slow", machine: "m", t: 100, out: { x: 1 } },
      ],
    });
    expect(step(solve(d, all, { item: "x", ratePerMin: 1 }), "x").recipeId).toBe("slow");
  });
});

describe("valeurs « à vérifier »", () => {
  const flag = { field: "durationS", reason: "variable" as const, mode: "plant_speed", detail: "durée variable" };
  const data = makeData({
    recipes: [
      { id: "good-but-variable", machine: "m", t: 1, out: { x: 1 }, verify: [flag] },
      { id: "safe", machine: "m", t: 10, out: { x: 1 } },
      { id: "only-variable", machine: "m", t: 1, out: { y: 1 }, verify: [flag] },
    ],
  });

  it("option désactivée : la recette n'est pas choisie mais elle est signalée", () => {
    const plan = solve(data, all, { item: "x", ratePerMin: 6 });
    expect(step(plan, "x").recipeId).toBe("safe");
    expect(plan.verify).toContainEqual(expect.objectContaining({ id: "good-but-variable", used: false }));
  });

  it("option activée : la recette participe au choix et le plan le dit", () => {
    const plan = solve(data, all, { item: "x", ratePerMin: 6, useUnverified: true });
    expect(step(plan, "x")).toMatchObject({ recipeId: "good-but-variable", usesUnverified: true });
    expect(plan.verify).toContainEqual(expect.objectContaining({ id: "good-but-variable", used: true }));
    expect(plan.warnings.some((w) => w.code === "à-vérifier")).toBe(true);
  });

  it("seules des recettes à vérifier : item non résolu, avec la raison", () => {
    const plan = solve(data, all, { item: "y", ratePerMin: 6 });
    expect(plan.status).toBe("impossible");
    expect(plan.unresolved[0]).toMatchObject({ item: "y", reason: "seulement à vérifier" });
  });

  it("énergie manquante : résultat partiel, total minimal signalé", () => {
    const d = makeData({ recipes: [{ id: "r", machine: "m", t: 10, e: null, out: { x: 1 } }] });
    const plan = solve(d, all, { item: "x", ratePerMin: 6 });
    expect(step(plan, "x").energyAvg).toBeNull();
    expect(plan.totals.energyUnknownSteps).toBe(1);
    expect(plan.warnings.some((w) => w.code === "énergie-inconnue")).toBe(true);
  });

  it("valeur manquante (durée nulle) : recette incalculable, jamais choisie", () => {
    const d = makeData({ recipes: [{ id: "r", machine: "m", t: null, out: { x: 1 }, verify: [{ field: "durationS", reason: "manquant", detail: "" }] }] });
    const plan = solve(d, all, { item: "x", ratePerMin: 6, useUnverified: true });
    expect(plan.unresolved[0]).toMatchObject({ item: "x", reason: "incalculable" });
  });

  it("une correction (overrides) remplace la valeur et lève le drapeau", () => {
    const d = makeData({
      recipes: [{ id: "r", machine: "m", t: null, out: { x: 1 }, verify: [{ field: "durationS", reason: "manquant", detail: "" }] }],
      overrides: [{ recipes: { r: { durationS: { value: 10, source: { wiki: "jeu", fetchedAt: "2026-10-11" } } } } }],
    });
    const r = d.recipes.get("r")!;
    expect(r.durationS).toBe(10);
    expect(r.verify).toEqual([]);
    expect(r.corrections?.[0]).toMatchObject({ field: "durationS", previous: null, value: 10 });
    expect(step(solve(d, all, { item: "x", ratePerMin: 6 }), "x").machines).toBe(1);
  });

  it("une correction invalide est refusée avec un message", () => {
    expect(() =>
      makeData({
        recipes: [{ id: "r", machine: "m", t: 1, out: { x: 1 } }],
        overrides: [{ recipes: { r: { durationS: { value: -1, source: SRC }, "inputs.zzz": { value: 1, source: SRC } } } }],
      }),
    ).toThrow(/durée > 0[\s\S]*zzz/);
  });
});

describe("recherche et déblocage", () => {
  const data = makeData({
    nodes: [
      { id: "n1", rp: 10 },
      { id: "n2", rp: 100, parents: ["n1"] },
      { id: "cheap", rp: 5 },
      { id: "costly", rp: 500 },
      { id: "both", rp: 1, parents: ["cheap", "costly"] },
      { id: "either", rp: 1, parents: ["cheap", "costly"], requires: "any" },
      { id: "sell", rp: 50, parents: ["n2"], reqItems: [{ item: "x", amount: 20 }] },
    ],
    machines: [
      { id: "mx", unlockedBy: "n2" },
      { id: "my", unlockedBy: "sell" },
      { id: "limited", unlockedBy: null },
    ],
    recipes: [
      { id: "rx", machine: "mx", t: 10, out: { x: 1 } },
      { id: "ry", machine: "my", t: 10, out: { y: 1 } },
      { id: "rz", machine: "limited", t: 10, out: { z: 1 } },
    ],
  });

  it("nœuds manquants : ancêtres compris, de la racine vers la feuille", () => {
    expect(missingNodes(data, progress(), "n2")).toEqual(["n1", "n2"]);
    expect(missingNodes(data, progress(["n1"]), "n2")).toEqual(["n2"]);
  });

  it("prérequis « tous » contre « un seul »", () => {
    expect(missingNodes(data, progress(), "both").sort()).toEqual(["both", "cheap", "costly"]);
    expect(missingNodes(data, progress(), "either").sort()).toEqual(["cheap", "either"]);
  });

  it("« tout débloquer jusqu'à » coche le nœud et ses ancêtres", () => {
    expect([...unlockUpTo(data, progress(), "sell")].sort()).toEqual(["n1", "n2", "sell"]);
  });

  it("repère les nœuds cochés sans leurs prérequis", () => {
    expect(inconsistentNodes(data, progress(["n2"]))).toEqual(["n2"]);
    expect(inconsistentNodes(data, progress(["n1", "n2"]))).toEqual([]);
  });

  it("item verrouillé : affiche les nœuds manquants au lieu d'une erreur", () => {
    const plan = solve(data, progress(), { item: "x", ratePerMin: 6 });
    expect(plan.status).toBe("impossible");
    expect(plan.unresolved[0]).toMatchObject({ item: "x", reason: "verrouillé", unlock: { missingNodes: ["n1", "n2"], rpCost: 110 } });
    expect(plan.economy.rpNeeded).toBe(110);
  });

  it("conditions « vendre N items » remontées dans l'économie", () => {
    const plan = solve(data, progress(["n1"]), { item: "y", ratePerMin: 6 });
    expect(plan.economy.nodesToUnlock).toEqual(["n2", "sell"]);
    expect(plan.economy.reqItems).toEqual([{ node: "sell", item: "x", amount: 20, done: false }]);
  });

  it("machine sans nœud (Limited) : disponible seulement si possédée", () => {
    expect(machineAccess(data, progress(), "limited")).toMatchObject({ available: false, needsOwnership: true });
    expect(solve(data, progress(), { item: "z", ratePerMin: 6 }).unresolved[0]?.unlock?.needsOwnership).toBe(true);
    expect(solve(data, progress([], ["limited"]), { item: "z", ratePerMin: 6 }).status).toBe("ok");
  });

  it("RP, argent et délai estimé si le joueur les renseigne", () => {
    const plan = solve(data, { ...progress(), money: 50, rp: 10, rpPerSec: 2 }, { item: "x", ratePerMin: 6 });
    expect(plan.economy).toMatchObject({ rpNeeded: 110, rpMissing: 100, secondsToRp: 50 });
    const ok = solve(data, { ...progress(["n1", "n2"]), money: 50 }, { item: "x", ratePerMin: 12 });
    expect(ok.economy).toMatchObject({ buildCost: 200, moneyMissing: 150 });
  });

  it("sans informations sur le joueur : seulement les prix", () => {
    const plan = solve(data, progress(["n1", "n2"]), { item: "x", ratePerMin: 12 });
    expect(plan.economy).toMatchObject({ buildCost: 200, money: null, moneyMissing: null, rp: null, rpMissing: null, secondsToRp: null });
  });
});

describe("pollution et arbres", () => {
  const formula: TreeGrowthFormula = {
    posCoefs: [1, 0.005, -0.0001],
    negBelow: -60,
    negSlope: 0.005,
    negIntercept: 1.25,
    clampMin: 0.5,
    clampMax: 1.2,
    points: 4500,
    pointsDivisor: 100,
    avgOffsets: [7, 8, 9, 10, 11],
    cycleFactor: 2,
    tickMs: 30,
    logsPerTree: 2,
    source: { wiki: "desmos", url: "https://www.desmos.com/calculator/u6sonlrwl9", fetchedAt: "2026-10-11" },
  };
  const bands = [
    { minPct: 100, maxPct: null, seconds: [696, 696] as [number, number], label: "100+" },
    { minPct: 51, maxPct: 99, seconds: [370, 689] as [number, number], label: "51-99" },
    { minPct: 13, maxPct: 37, seconds: [348, 348] as [number, number], label: "13-37" },
    { minPct: 0, maxPct: 5, seconds: [363, 363] as [number, number], label: "Normal" },
  ];

  it("la formule redonne les valeurs du tableau du wiki", () => {
    expect(formulaSeconds(formula, 0)).toBeCloseTo(362.7, 1);
    expect(formulaSeconds(formula, 25)).toBeCloseTo(347.5, 1);
    expect(formulaSeconds(formula, 40)).toBeCloseTo(354.7, 1);
    expect(formulaSeconds(formula, 150)).toBeCloseTo(697.0, 1);
    expect(formulaSeconds(formula, -200)).toBeCloseTo(697.0, 1);
  });

  it("sans formule : tableau, borne haute pour une plage", () => {
    const tg: TreeGrowth = { bands, source: SRC };
    expect(treeGrowthSeconds(tg, 75)).toMatchObject({ seconds: 689, method: "tableau" });
    expect(treeGrowthSeconds(tg, 2)).toMatchObject({ seconds: 363, method: "tableau" });
    expect(treeGrowthSeconds(tg, null).seconds).toBe(363);
  });

  it("le nombre d'arbres dépend de la pollution du joueur", () => {
    const d = makeData({
      machines: [{ id: "tree", kind: "farm" }],
      recipes: [{ id: "tree_01", machine: "tree", t: 363, e: 0, out: { log: 2 }, tree: true }],
      treeGrowth: { bands, source: SRC, formula },
    });
    const clean = solve(d, all, { item: "log", ratePerMin: 10 });
    const dirty = solve(d, { ...all, pollutionPct: 150 }, { item: "log", ratePerMin: 10 });
    expect(step(clean, "log").machines).toBe(31); // 10 / (2 / 362,7 × 60) = 30,2
    expect(step(dirty, "log").machines).toBe(59); // 10 / (2 / 697 × 60) = 58,1
    expect(clean.totals).toMatchObject({ machines: 0, farms: 31 });
    expect(clean.warnings.some((w) => w.code === "arbres")).toBe(true);
  });
});
