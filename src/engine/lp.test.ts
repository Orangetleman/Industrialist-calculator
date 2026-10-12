import { describe, expect, it } from "vitest";
import { solveLexicographic, solveLP, type LP } from "./lp.ts";

describe("simplexe (programmation linéaire)", () => {
  it("cas d'école : max 3x + 5y, x ≤ 4, 2y ≤ 12, 3x + 2y ≤ 18 → (2, 6), 36", () => {
    const lp: LP = {
      nVars: 2,
      rows: [
        { terms: [[0, 1]], op: "<=", rhs: 4 },
        { terms: [[1, 2]], op: "<=", rhs: 12 },
        { terms: [[0, 3], [1, 2]], op: "<=", rhs: 18 },
      ],
    };
    const r = solveLP(lp, [[0, -3], [1, -5]]);
    expect(r.status).toBe("optimal");
    expect(r.x[0]).toBeCloseTo(2);
    expect(r.x[1]).toBeCloseTo(6);
    expect(r.value).toBeCloseTo(-36);
  });

  it("contraintes ≥ (phase 1) : min x + y, x + 2y ≥ 4, 3x + y ≥ 6 → (1,6 ; 1,2)", () => {
    const r = solveLP(
      { nVars: 2, rows: [{ terms: [[0, 1], [1, 2]], op: ">=", rhs: 4 }, { terms: [[0, 3], [1, 1]], op: ">=", rhs: 6 }] },
      [[0, 1], [1, 1]],
    );
    expect(r.status).toBe("optimal");
    expect(r.x[0]).toBeCloseTo(1.6);
    expect(r.x[1]).toBeCloseTo(1.2);
    expect(r.value).toBeCloseTo(2.8);
  });

  it("infaisable et non borné sont reconnus", () => {
    expect(solveLP({ nVars: 1, rows: [{ terms: [[0, 1]], op: ">=", rhs: 5 }, { terms: [[0, 1]], op: "<=", rhs: 3 }] }, [[0, 1]]).status).toBe("infeasible");
    expect(solveLP({ nVars: 1, rows: [{ terms: [[0, 1]], op: ">=", rhs: 1 }] }, [[0, -1]]).status).toBe("unbounded");
    expect(solveLP({ nVars: 1, rows: [{ terms: [], op: ">=", rhs: 1 }] }, [[0, 1]]).status).toBe("infeasible");
  });

  it("exemple de Beale (cycle avec la règle de Dantzig seule) : optimum −5/4", () => {
    const lp: LP = {
      nVars: 4,
      rows: [
        { terms: [[0, 0.25], [1, -8], [2, -1], [3, 9]], op: "<=", rhs: 0 },
        { terms: [[0, 0.5], [1, -12], [2, -0.5], [3, 3]], op: "<=", rhs: 0 },
        { terms: [[2, 1]], op: "<=", rhs: 1 },
      ],
    };
    const r = solveLP(lp, [[0, -0.75], [1, 20], [2, -0.5], [3, 6]]);
    expect(r.status).toBe("optimal");
    expect(r.value).toBeCloseTo(-1.25);
  });

  it("égalités redondantes et second membre négatif", () => {
    const r = solveLP(
      {
        nVars: 2,
        rows: [
          { terms: [[0, 1], [1, 1]], op: "=", rhs: 2 },
          { terms: [[0, 2], [1, 2]], op: "=", rhs: 4 },
          { terms: [[0, -1]], op: "<=", rhs: -0.5 }, // x ≥ 0,5
        ],
      },
      [[0, 1]],
    );
    expect(r.status).toBe("optimal");
    expect(r.x[0]).toBeCloseTo(0.5);
    expect(r.x[1]).toBeCloseTo(1.5);
  });

  it("échelles très différentes (0,001 à un million) sans perte de précision", () => {
    // y produit 1e6 « MF/s » par unité, x consomme 0,001 ; il faut 5 000 unités de x.
    const r = solveLP(
      { nVars: 2, rows: [{ terms: [[0, 1]], op: ">=", rhs: 5000 }, { terms: [[1, 1e6], [0, -0.001 * 1e3]], op: ">=", rhs: 0 }] },
      [[0, 1], [1, 1]],
    );
    expect(r.status).toBe("optimal");
    expect(r.x[1]).toBeCloseTo(5000 / 1e6, 9);
  });

  it("niveaux de priorité : le second objectif départage sans dégrader le premier", () => {
    // Deux recettes aussi bonnes pour le 1er critère ; la seconde est plus petite au sol.
    const lp: LP = { nVars: 2, rows: [{ terms: [[0, 1], [1, 1]], op: ">=", rhs: 10 }] };
    const r = solveLexicographic(lp, [
      [[0, 1], [1, 1]],
      [[0, 5], [1, 2]],
    ]);
    expect(r.status).toBe("optimal");
    expect(r.x[0]).toBeCloseTo(0);
    expect(r.x[1]).toBeCloseTo(10);
    expect(r.values[0]).toBeCloseTo(10);
    expect(r.values[1]).toBeCloseTo(20);
  });

  it("problème de taille réelle (300 variables, 150 contraintes) en un temps raisonnable", () => {
    // Chaîne aléatoire mais reproductible : chaque item i a deux recettes qui consomment i+1.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const nItems = 150;
    const rows: LP["rows"] = [];
    const obj: [number, number][] = [];
    for (let i = 0; i < nItems; i++) {
      const terms: [number, number][] = [
        [2 * i, 1 + rnd()],
        [2 * i + 1, 1 + rnd()],
      ];
      if (i > 0) terms.push([2 * (i - 1), -(0.5 + rnd())], [2 * (i - 1) + 1, -(0.5 + rnd())]);
      rows.push({ terms, op: ">=", rhs: i === 0 ? 10 : 0 });
      obj.push([2 * i, 1 + rnd()], [2 * i + 1, 1 + rnd()]);
    }
    const t0 = performance.now();
    const r = solveLP({ nVars: 2 * nItems, rows }, obj);
    expect(r.status).toBe("optimal");
    expect(performance.now() - t0).toBeLessThan(2000);
    // Chaque contrainte est respectée.
    for (const row of rows) {
      const lhs = row.terms.reduce((s, [j, a]) => s + a * r.x[j]!, 0);
      expect(lhs).toBeGreaterThanOrEqual(row.rhs - 1e-6);
    }
  });
});
