// Paliers ronds (décision Q4) : les débits où, avec les recettes retenues, chaque étape tombe sur
// un nombre entier de machines (ou presque), comme les 15 assembleurs de la référence.
//
// Sans contrainte de pollution ni de budget, la solution du simplexe est proportionnelle au
// débit : l'étape i demande aᵢ·R machines (aᵢ = machines par unité de débit). Un palier est un
// débit R où Σ aᵢR / Σ ⌈aᵢR⌉ (le taux d'occupation des machines) est maximal. Les candidats
// sont les débits où au moins une étape tombe juste : R = k / aᵢ.

export type Tier = {
  /** Débit (objets/min, ou $/min pour l'objectif argent). */
  ratePerMin: number;
  /** Machines de l'étape finale à ce débit (fractionnaire si elle ne tombe pas juste). */
  finalMachines: number;
  /** Total des machines (arbres et dépôts compris), arrondies. */
  machines: number;
  /** Occupation moyenne des machines : 1 = aucune machine à moitié vide. */
  efficiency: number;
  /** Toutes les étapes tombent exactement sur un entier. */
  exact: boolean;
  /** Débit actuellement demandé. */
  current: boolean;
};

type PlanLike = {
  target: { ratePerMin: number };
  steps: { key: string; machinesExact: number; parts?: { exact: number }[] }[];
  finals: string[];
  depots: { machinesExact: number }[];
};

const ceilTol = (x: number) => Math.ceil(x - 1e-9);

export function evaluateTier(units: number[], finalUnit: number, R: number, current = false): Tier {
  let exact = 0;
  let rounded = 0;
  let allInt = true;
  for (const a of units) {
    const v = a * R;
    exact += v;
    rounded += ceilTol(v);
    if (Math.abs(v - Math.round(v)) > 1e-6 * Math.max(1, v)) allInt = false;
  }
  return { ratePerMin: R, finalMachines: finalUnit * R, machines: rounded, efficiency: rounded ? exact / rounded : 0, exact: allInt, current };
}

/**
 * Paliers autour du débit demandé (de ¼ à 10 fois), triés par débit. `max` paliers au plus,
 * en privilégiant l'occupation, puis la proximité du débit demandé.
 */
export function roundTiers(plan: PlanLike, opts: { minFactor?: number; maxFactor?: number; max?: number } = {}): Tier[] {
  const R0 = plan.target.ratePerMin;
  if (!(R0 > 0)) return [];
  // Une installation composée compte chacune de ses machines (1 Firebox, 2 Boilers…).
  const units = [...plan.steps.flatMap((s) => (s.parts ? s.parts.map((q) => q.exact / R0) : [s.machinesExact / R0])), ...plan.depots.map((d) => d.machinesExact / R0)].filter((a) => a > 1e-12);
  if (!units.length) return [];
  const finalUnit = plan.steps.filter((s) => plan.finals.includes(s.key)).reduce((s, x) => s + x.machinesExact, 0) / R0;
  const lo = R0 * (opts.minFactor ?? 0.25);
  const hi = R0 * (opts.maxFactor ?? 10);
  const candidates = new Set<number>();
  for (const a of units) {
    const kMin = Math.max(1, Math.ceil(a * lo - 1e-9));
    const kMax = Math.floor(a * hi + 1e-9);
    // Au plus 400 candidats par étape : au-delà, les grandes étapes tombent juste presque partout.
    const step = Math.max(1, Math.ceil((kMax - kMin + 1) / 400));
    for (let k = kMin; k <= kMax; k += step) candidates.add(k / a);
  }
  const all = [...candidates].map((R) => evaluateTier(units, finalUnit, R));
  // À grand débit, tout tombe presque juste : trier seulement par occupation ne proposerait que
  // des débits énormes. On garde le meilleur palier de chaque tranche autour du débit demandé
  // (¼–½, ½–1, 1–2, 2–4, 4–10 fois), le plus petit débit à occupation égale.
  const bands: [number, number][] = [
    [0.25, 0.5],
    [0.5, 1],
    [1, 2],
    [2, 4],
    [4, 10],
  ];
  const picked: Tier[] = [];
  const now = evaluateTier(units, finalUnit, R0, true);
  // Un palier tout proche du débit demandé n'a d'intérêt que s'il est nettement mieux rempli.
  const worth = (t: Tier) => Math.abs(t.ratePerMin - R0) / R0 > 0.03 || t.efficiency > now.efficiency + 0.005;
  for (const [a, b] of bands) {
    const inBand = all.filter((t) => t.ratePerMin >= R0 * a * (1 - 1e-12) && t.ratePerMin <= R0 * b * (1 + 1e-12) && Math.abs(t.ratePerMin - R0) / R0 > 1e-9 && worth(t));
    inBand.sort((x, y) => y.efficiency - x.efficiency || x.ratePerMin - y.ratePerMin);
    const best = inBand[0];
    if (best && best.efficiency > 0 && !picked.some((p) => Math.abs(p.ratePerMin - best.ratePerMin) / best.ratePerMin < 0.03)) picked.push(best);
    if (picked.length >= (opts.max ?? 6)) break;
  }
  const current = picked.find((p) => Math.abs(p.ratePerMin - R0) / R0 < 1e-9);
  if (current) current.current = true;
  else picked.push(now);
  return picked.sort((a, b) => a.ratePerMin - b.ratePerMin);
}
