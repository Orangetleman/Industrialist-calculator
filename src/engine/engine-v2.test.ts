// Moteur v2 : ressources unifiées (énergie, pollution, argent), contraintes, paliers ronds.
import { describe, expect, it } from "vitest";
import { makeData, progress, SRC, type R } from "../../tests/engine-helpers.ts";
import { ENERGY, type DepotSpec } from "./resources.ts";
import { solve } from "./solve.ts";
import { say } from "../ui/engine-text.ts";

const all = progress();
const step = (plan: ReturnType<typeof solve>, item: string) => plan.steps.find((s) => s.item === item)!;

describe("énergie : la chaîne produit sa propre énergie", () => {
  // Une foreuse à charbon (1 000 MF/s), un générateur qui brûle ce charbon (+7 000 MF/s) et une
  // machine qui consomme charbon et énergie : boucle énergie ↔ combustible.
  const recipes: R[] = [
    { id: "drill", machine: "drill", t: 1, e: 1000, out: { coal: 1 } }, // 60 charbon/min
    { id: "gen", machine: "gen", t: 4, e: -7000, in: { coal: 1 }, out: {} }, // 15 charbon/min → 7 000 MF/s
    { id: "make", machine: "m", t: 1, e: 5000, in: { coal: 1 }, out: { x: 1 } },
  ];

  it("sur le réseau : l'énergie est seulement comptée", () => {
    const plan = solve(makeData({ recipes }), all, { item: "x", ratePerMin: 60 });
    expect(plan.steps.map((s) => s.recipeId).sort()).toEqual(["drill", "make"]);
    expect(plan.totals.energyAvg).toBeCloseTo(6000);
    expect(plan.totals.energyProduced).toBe(0);
  });

  it("autonome : générateurs ajoutés, et leur charbon aussi (la boucle est bouclée)", () => {
    const plan = solve(makeData({ recipes }), all, { item: "x", ratePerMin: 60, selfPowered: true });
    expect(plan.status).toBe("ok");
    // d foreuses, g générateurs : 60d = 60 + 15g et 7000g = 5000 + 1000d → d = 33/27, g = 8/9.
    expect(step(plan, "coal").machinesExact).toBeCloseTo(33 / 27, 9);
    expect(step(plan, ENERGY)).toMatchObject({ recipeId: "gen" });
    expect(step(plan, ENERGY).machinesExact).toBeCloseTo(8 / 9, 9);
    expect(plan.totals.energyProduced).toBeCloseTo(plan.totals.energyAvg, 6);
    expect(plan.constraints.selfPowered).toBe(true);
  });

  it("autonome sans générateur débloqué : le manque d'énergie est signalé", () => {
    const d = makeData({ nodes: [{ id: "n", rp: 5 }], machines: [{ id: "gen", unlockedBy: "n" }], recipes });
    const plan = solve(d, all, { item: "x", ratePerMin: 60, selfPowered: true });
    expect(plan.status).toBe("partiel");
    expect(plan.warnings.some((w) => w.code === "énergie-non-couverte")).toBe(true);
  });
});

describe("pollution et budget", () => {
  const machines = [
    { id: "dirty", pollution: 1, cost: 100 },
    { id: "clean", pollution: 0, cost: 1000 },
  ];
  const recipes: R[] = [
    { id: "r-dirty", machine: "dirty", t: 10, out: { x: 1 } }, // 6/min
    { id: "r-clean", machine: "clean", t: 20, out: { x: 1 } }, // 3/min
  ];
  const d = makeData({ machines, recipes });
  const pollutionOf = (plan: ReturnType<typeof solve>) => plan.steps.reduce((s, x) => s + x.machinesExact * (x.machine === "dirty" ? 1 : 0), 0);

  it("critères « moins de pollution » et « moins cher »", () => {
    expect(step(solve(d, all, { item: "x", ratePerMin: 6, criterion: "pollution" }), "x").recipeId).toBe("r-clean");
    expect(step(solve(d, all, { item: "x", ratePerMin: 6, criterion: "cost" }), "x").recipeId).toBe("r-dirty");
  });

  it("pollution maximale : la chaîne la respecte", () => {
    const plan = solve(d, all, { item: "x", ratePerMin: 6, maxPollution: 0.5 });
    expect(plan.status).toBe("ok");
    expect(pollutionOf(plan)).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(plan.warnings.some((w) => w.code.startsWith("contrainte"))).toBe(false);
  });

  it("pollution maximale impossible : le minimum atteignable est donné", () => {
    const only = makeData({ machines, recipes: [recipes[0]!] });
    const plan = solve(only, all, { item: "x", ratePerMin: 6, maxPollution: 0.5 });
    const w = plan.warnings.find((x) => x.code === "contrainte-pollution");
    expect(say(w!.message)).toMatch(/au mieux 1 %\/h/);
    expect(plan.steps.length).toBe(1); // plan calculé sans la limite
  });

  it("budget : la chaîne la moins chère qui tient, ou le minimum nécessaire", () => {
    expect(step(solve(d, all, { item: "x", ratePerMin: 6, criterion: "pollution", budget: 500 }), "x").recipeId).toBe("r-dirty");
    const plan = solve(d, all, { item: "x", ratePerMin: 6, budget: 50 });
    expect(say(plan.warnings.find((x) => x.code === "contrainte-budget")!.message)).toMatch(/au moins 100 \$/);
  });
});

describe("objectif argent", () => {
  const src = SRC;
  const data = makeData({
    machines: [{ id: "depot", cost: 100 }],
    recipes: [
      { id: "ra", machine: "m", t: 1, out: { a: 1 } }, // 60 a/min
      { id: "rb", machine: "m", t: 1, out: { b: 1 } },
    ],
    overrides: [{ items: { a: { sellValue: { value: 10, source: src } }, b: { sellValue: { value: 1, source: src } } } }],
  });
  const depots: DepotSpec[] = [{ id: "depot", name: "Depot", kind: "objet", itemsPerSec: 1 }]; // 60 objets/min

  it("vend ce qui rapporte le plus pour le moins de machines, dépôts compris", () => {
    const plan = solve(data, all, { item: "", moneyPerMin: 600, depots });
    expect(plan.status).toBe("ok");
    expect(plan.target).toMatchObject({ kind: "argent", ratePerMin: 600 });
    expect(plan.sales).toEqual([{ item: "a", perMin: 60, price: 10, revenuePerMin: 600 }]);
    expect(plan.depots).toMatchObject([{ id: "depot", machines: 1 }]);
    expect(plan.finals).toEqual(["a"]);
    expect(plan.totals.revenuePerMin).toBeCloseTo(600);
  });

  it("la capacité des dépôts est respectée", () => {
    const plan = solve(data, all, { item: "", moneyPerMin: 1200, depots });
    expect(plan.depots[0]).toMatchObject({ machines: 2 });
    expect(step(plan, "a").machines).toBe(2);
  });

  it("sans dépôt utilisable : impossible, avec la raison", () => {
    const plan = solve(data, all, { item: "", moneyPerMin: 600, depots: [] });
    expect(plan.status).toBe("impossible");
    expect(plan.warnings.some((w) => w.code === "dépôt")).toBe(true);
  });
});

describe("paliers ronds", () => {
  // x : 6/min par machine, et 1 y par x ; y : 3/min par machine.
  const d = makeData({
    recipes: [
      { id: "rx", machine: "m", t: 10, in: { y: 1 }, out: { x: 1 } },
      { id: "ry", machine: "m", t: 20, out: { y: 1 } },
    ],
  });

  it("débits où chaque étape tombe juste, autour du débit demandé", () => {
    const plan = solve(d, all, { item: "x", ratePerMin: 10 });
    const exact = plan.tiers.filter((t) => t.exact).map((t) => Math.round(t.ratePerMin * 1e6) / 1e6);
    expect(exact).toEqual(expect.arrayContaining([6, 12]));
    const six = plan.tiers.find((t) => Math.abs(t.ratePerMin - 6) < 1e-9)!;
    expect(six).toMatchObject({ finalMachines: 1, machines: 3, efficiency: 1 });
    const cur = plan.tiers.find((t) => t.current)!;
    expect(cur.ratePerMin).toBe(10);
    expect(cur.efficiency).toBeLessThan(1);
    // Triés par débit.
    expect(plan.tiers.map((t) => t.ratePerMin)).toEqual([...plan.tiers.map((t) => t.ratePerMin)].sort((a, b) => a - b));
  });
});

describe("production existante du joueur", () => {
  // t demande 1 a par unité ; a demande 2 s ; 6 t/min.
  const d = makeData({
    recipes: [
      { id: "rt", machine: "m", t: 10, in: { a: 1 }, out: { t: 1 } }, // 6 t/min
      { id: "ra", machine: "m", t: 10, in: { s: 2 }, out: { a: 1 } }, // 6 a/min
      { id: "rs", machine: "m", t: 1, out: { s: 1 } }, // 60 s/min
    ],
  });

  it("utilisée avant de construire : seul le complément est produit", () => {
    const plan = solve(d, all, { item: "t", ratePerMin: 6, existing: { a: 3 } });
    expect(plan.status).toBe("ok");
    expect(step(plan, "a").machinesExact).toBeCloseTo(0.5);
    expect(step(plan, "s").machinesExact).toBeCloseTo(0.1);
    expect(plan.existing).toEqual([{ item: "a", key: "existant:a", available: 3, used: 3 }]);
    expect(plan.edges).toContainEqual({ from: "existant:a", to: "t", item: "a", perMin: 3 });
  });

  it("plus que nécessaire : on n'en prend que ce qu'il faut, rien n'est construit en amont", () => {
    const plan = solve(d, all, { item: "t", ratePerMin: 6, existing: { a: 50 } });
    expect(plan.existing[0]).toMatchObject({ item: "a", used: 6, available: 50 });
    expect(plan.steps.map((s) => s.recipeId)).toEqual(["rt"]);
  });

  it("l'objectif lui-même déjà produit : plan complet sans machine", () => {
    const plan = solve(d, all, { item: "t", ratePerMin: 4, existing: { t: 10 } });
    expect(plan.status).toBe("ok");
    expect(plan.steps).toEqual([]);
    expect(plan.finals).toEqual(["existant:t"]);
  });

  it("un item verrouillé mais déjà produit par le joueur n'est plus un manque", () => {
    const locked = makeData({
      nodes: [{ id: "n", rp: 5 }],
      machines: [{ id: "lk", unlockedBy: "n" }],
      recipes: [
        { id: "rt", machine: "m", t: 10, in: { a: 1 }, out: { t: 1 } },
        { id: "ra", machine: "lk", t: 10, out: { a: 1 } },
      ],
    });
    expect(solve(locked, all, { item: "t", ratePerMin: 6 }).status).toBe("partiel");
    const plan = solve(locked, all, { item: "t", ratePerMin: 6, existing: { a: 6 } });
    expect(plan.status).toBe("ok");
    expect(plan.unresolved).toEqual([]);
  });
});

describe("priorités dans l'ordre : les suivantes départagent les égalités", () => {
  // Deux recettes de même surface : l'une moins chère, l'autre sans énergie.
  const recipes: R[] = [
    { id: "cheap", machine: "ma", t: 1, e: 1000, out: { x: 1 } },
    { id: "green", machine: "mb", t: 1, e: 0, out: { x: 1 } },
  ];
  const machines = [
    { id: "ma", size: [2, 2] as [number, number], cost: 100 },
    { id: "mb", size: [2, 2] as [number, number], cost: 500 },
  ];
  const d = makeData({ recipes, machines });
  const pick = (then?: ("cost" | "energy")[]) => solve(d, all, { item: "x", ratePerMin: 60, criterion: "area", then }).steps.find((s) => s.item === "x")!.recipeId;

  it("le premier critère ne départage pas (même surface) : le suivant décide", () => {
    expect(pick(["cost"])).toBe("cheap");
    expect(pick(["energy"])).toBe("green");
  });

  it("sans liste : l'ordre habituel (surface, machines, énergie…)", () => {
    expect(pick()).toBe("green");
  });
});
