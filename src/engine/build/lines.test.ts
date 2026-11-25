// Lignes de tuyaux : le partage à parts égales affame un simple pont ; avec Overflow Gate ou le partage ajusté, tout est servi.
import { describe, expect, it } from "vitest";
import { planLines, linesWithGate, linesWithoutGate, served, simulate, type Chain, type Client } from "./lines.ts";

const CAP = 120;
const chairs = (k: number): Client[] => [
  { key: "planks", n: 5 * k, p: 30 },
  { key: "chunk", n: 5 * k, p: 30 },
  { key: "cut", n: 3 * k, p: 25 },
];
const total = (chains: Chain[], key: string) => chains.flat().filter((l) => l.client === key).reduce((t, l) => t + l.machines, 0);

describe("lignes de tuyaux (débit au-delà d'un tuyau)", () => {
  it("le pont simple 2 + 3 (première maquette) affame la petite ligne", () => {
    const c: Chain[] = [[{ source: 0, client: "a", machines: 2, demand: 60 }, { source: 1, client: "a", machines: 3, demand: 90 }]];
    expect(simulate(c, 75, CAP, false)[0]![0]!).toBeLessThan(55);
    expect(served(c, 75, CAP, true)).toBe(true); // la même avec une Overflow Gate
  });

  it.each([1, 2, 3])("chaises × %i, avec Overflow Gate : toutes les machines servies", (k) => {
    const cl = chairs(k);
    const need = cl.reduce((t, c) => t + c.n * c.p, 0);
    const s = 90; // un Boiler à fond
    const n = Math.ceil(need / s - 1e-9);
    const r = linesWithGate(cl, n, s, CAP)!;
    for (const c of cl) expect(total(r.chains, c.key)).toBe(c.n);
    expect(r.extra).toBe(0);
    expect(served(r.chains, s, CAP, true)).toBe(true);
  });

  it.each([1, 2, 3])("chaises × %i, sans Overflow Gate : toutes les machines servies", (k) => {
    const cl = chairs(k);
    const s = 90; // un Boiler à fond
    const n = Math.ceil(cl.reduce((t, c) => t + c.n * c.p, 0) / s - 1e-9);
    const r = linesWithoutGate(cl, n, s, CAP)!;
    for (const c of cl) expect(total(r.chains, c.key)).toBe(c.n);
    expect(served(r.chains, s, CAP, false)).toBe(true);
    expect(r.chains.flat().every((l) => l.demand <= CAP)).toBe(true);
  });

  it("60 Chair/min : 5 Boiler, aucun pont dans les deux modes ; 120 : une Overflow Gate, ou un Boiler de plus", () => {
    for (const gate of [true, false]) {
      const r = planLines(chairs(1), 5, 90, CAP, gate)!;
      expect([r.extra, r.gates, r.splits]).toEqual([0, 0, 0]);
    }
    const on = planLines(chairs(2), 9, 90, CAP, true)!;
    expect([on.gate, on.extra]).toEqual([true, 0]);
    expect(on.gates).toBeGreaterThan(0);
    const off = planLines(chairs(2), 9, 90, CAP, false)!;
    expect([off.gate, off.extra]).toEqual([false, 1]);
  });
});
