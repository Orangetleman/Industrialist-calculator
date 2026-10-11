// Temps de pousse des arbres selon la pollution du monde.
// 1) Formule du calculateur Desmos (si présente dans les données) ;
// 2) sinon, tableau « Tree Growth » du wiki, borne haute (pessimiste) pour une plage.

import type { GrowthBand, TreeGrowth, TreeGrowthFormula } from "./types.ts";

export type TreeGrowthResult = {
  seconds: number;
  method: "formule" | "tableau" | "défaut";
  detail: string;
  sourceUrl?: string;
};

export function growthDebuff(f: TreeGrowthFormula, pollutionPct: number): number {
  const p = pollutionPct;
  const [a, b, c] = f.posCoefs;
  const d = p > 0 ? a + b * p + c * p * p : p < f.negBelow ? f.negSlope * p + f.negIntercept : 1;
  return Math.max(f.clampMin, Math.min(f.clampMax, d));
}

/** Moyenne récursive A(n) du calculateur, calculée itérativement. */
function averageTicks(f: TreeGrowthFormula, n: number): number {
  if (n <= 0) return 0;
  const a: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    let s = 0;
    for (const k of f.avgOffsets) s += i - k > 0 ? a[i - k]! : 0;
    a[i] = 1 + s / f.avgOffsets.length;
  }
  return a[n]!;
}

export function formulaSeconds(f: TreeGrowthFormula, pollutionPct: number): number {
  const need = Math.ceil(f.points / (f.pointsDivisor * growthDebuff(f, pollutionPct)));
  return f.cycleFactor * (1000 / f.tickMs) * averageTicks(f, need);
}

function bandFor(bands: GrowthBand[], p: number): GrowthBand | null {
  const inside = bands.find((b) => (b.minPct === null || p >= b.minPct) && (b.maxPct === null || p <= b.maxPct));
  if (inside) return inside;
  // Entre deux plages entières (ex. 99,5 %) : la plage la plus proche.
  let best: GrowthBand | null = null;
  let dist = Infinity;
  for (const b of bands) {
    const lo = b.minPct ?? -Infinity;
    const hi = b.maxPct ?? Infinity;
    const d = p < lo ? lo - p : p - hi;
    if (d < dist) {
      dist = d;
      best = b;
    }
  }
  return best;
}

export function treeGrowthSeconds(tg: TreeGrowth, pollutionPct: number | null | undefined): TreeGrowthResult {
  const p = pollutionPct ?? 0;
  if (tg.formula) {
    return {
      seconds: formulaSeconds(tg.formula, p),
      method: "formule",
      detail: `pollution ${p} % → formule du calculateur des arbres (moyenne, valeur approximative)`,
      sourceUrl: tg.formula.source.url,
    };
  }
  const band = bandFor(tg.bands, p);
  if (band) {
    const [lo, hi] = band.seconds;
    return {
      seconds: hi,
      method: "tableau",
      detail: lo === hi ? `pollution ${p} % → ~${hi} s (tableau du wiki)` : `pollution ${p} % → entre ~${lo} et ~${hi} s ; borne haute retenue (pessimiste)`,
      sourceUrl: tg.source.url,
    };
  }
  return { seconds: NaN, method: "défaut", detail: "aucune donnée de pousse des arbres" };
}
