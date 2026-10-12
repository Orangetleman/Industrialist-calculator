// Moteur v2 : du modèle de flux au programme linéaire, puis optimisation par niveaux.
//
// Variables : machines par recette (fractionnaires), manques (imports pénalisés), ventes et
// dépôts (objectif argent). Contraintes : bilan de chaque item (production ≥ consommation +
// demande ; l'excédent est un surplus), énergie (autonomie), pollution maximale, budget.
// Niveaux (départages identiques au moteur v1) :
//   1. le moins de manques possible ;
//   2. le critère choisi ;
//   3. la plus petite surface au sol (taille inconnue en dernier) ;
//   4. les autres critères : machines, énergie, matières premières.

import { solveLexicographic, solveLP, type LP, type Row, type Term } from "./lp.ts";
import type { Criterion } from "./choose.ts";
import type { FlowModel } from "./resources.ts";

export type OptimizeRequest = {
  criterion: Criterion;
  /** Demande par item (/min) : la cible en mode objet. */
  demand: Map<string, number>;
  /** Objectif argent ($/min) ; null en mode objet. */
  moneyPerMin: number | null;
  selfPowered: boolean;
  /** Objectif énergie : puissance nette à fournir en plus de la consommation de la chaîne (MF/s). */
  energyTarget?: number;
  maxPollution: number | null;
  budget: number | null;
  /** Production déjà en place chez le joueur (/min par item) : source gratuite, plafonnée. */
  existing?: Map<string, number>;
  /** Recettes du choix heuristique (moteur v1) : une solution candidate de plus. */
  preferred?: Set<string>;
};

export type OptimizeResult = {
  status: "ok" | "échec";
  /** Machines (fractionnaires) par recette utilisée. */
  machines: Map<string, number>;
  imports: Map<string, number>;
  energyImport: number;
  sells: Map<string, number>;
  /** Production existante utilisée (/min par item). */
  supplies: Map<string, number>;
  depots: Map<string, number>;
  /** Contraintes impossibles à tenir sans manque supplémentaire ; le plan est calculé sans elles. */
  impossible: { pollution?: number; budget?: number };
  iterations: number;
};

const TARGET_PENALTY = 1000;
const ENERGY_PENALTY = 1e-3; // par MF/s manquant
const UNKNOWN_AREA = 1e4; // surface d'une machine de taille inconnue : départage en dernier

type Built = {
  lp: LP;
  imports: { item: string; col: number }[];
  energyCol: number;
  sells: { item: string; col: number }[];
  supplies: { item: string; col: number }[];
  depots: { id: string; col: number }[];
  objectives: Record<"imports" | Criterion | "area", Term[]>;
  pollutionRow: Row | null;
  budgetRow: Row | null;
};

export function build(model: FlowModel, req: OptimizeRequest, loopImports: boolean): Built {
  const R = model.recipes;
  let n = R.length;
  const consumed = new Set<string>();
  for (const p of R) for (const [k, v] of Object.entries(p.perMin)) if (v < 0) consumed.add(k);
  const needs = [...model.items].filter((i) => consumed.has(i) || (req.demand.get(i) ?? 0) > 0).sort();
  const imports = needs.filter((i) => loopImports || model.leaves.has(i)).map((item) => ({ item, col: n++ }));
  const supplies = [...(req.existing ?? [])].filter(([item, v]) => v > 0 && model.items.has(item)).sort(([a], [b]) => a.localeCompare(b)).map(([item]) => ({ item, col: n++ }));
  const energyCol = req.selfPowered ? n++ : -1;
  const sells = req.moneyPerMin !== null ? [...model.sellable.keys()].sort().map((item) => ({ item, col: n++ })) : [];
  const depots = req.moneyPerMin !== null ? model.depots.map((d) => ({ id: d.id, col: n++ })) : [];

  const rowsOf = new Map<string, Term[]>();
  const termsFor = (item: string) => {
    let t = rowsOf.get(item);
    if (!t) rowsOf.set(item, (t = []));
    return t;
  };
  R.forEach((p, j) => {
    for (const [k, v] of Object.entries(p.perMin)) termsFor(k).push([j, v]);
  });
  for (const im of imports) termsFor(im.item).push([im.col, 1]);
  for (const s of sells) termsFor(s.item).push([s.col, -1]);
  for (const s of supplies) termsFor(s.item).push([s.col, 1]);
  const rows: Row[] = [];
  for (const [item, terms] of [...rowsOf].sort(([a], [b]) => a.localeCompare(b))) {
    const d = req.demand.get(item) ?? 0;
    if (d <= 0 && !terms.some(([, v]) => v < 0)) continue; // seulement produit : surplus libre
    rows.push({ terms, op: ">=", rhs: d });
  }
  for (const [item, d] of req.demand) if (d > 0 && !rowsOf.has(item)) rows.push({ terms: imports.filter((i) => i.item === item).map((i) => [i.col, 1]), op: ">=", rhs: d });

  if (req.selfPowered) {
    const t: Term[] = [];
    R.forEach((p, j) => {
      if (p.energy) t.push([j, -p.energy]);
    });
    t.push([energyCol, 1]);
    rows.push({ terms: t, op: ">=", rhs: req.energyTarget ?? 0 });
  }
  if (req.moneyPerMin !== null) {
    rows.push({ terms: sells.map((s) => [s.col, model.sellable.get(s.item)!]), op: ">=", rhs: req.moneyPerMin });
    rows.push({
      terms: [...sells.map((s): Term => [s.col, 1]), ...depots.map((d, k): Term => [d.col, -model.depots[k]!.itemsPerMin])],
      op: "<=",
      rhs: 0,
    });
  }
  const pollutionTerms: Term[] = [];
  const costTerms: Term[] = [];
  R.forEach((p, j) => {
    if (p.pollution) pollutionTerms.push([j, p.pollution]);
    if (p.cost) costTerms.push([j, p.cost]);
  });
  depots.forEach((d, k) => {
    const c = model.depots[k]!.cost;
    if (c) costTerms.push([d.col, c]);
  });
  const pollutionRow: Row | null = req.maxPollution !== null ? { terms: pollutionTerms, op: "<=", rhs: req.maxPollution } : null;
  const budgetRow: Row | null = req.budget !== null ? { terms: costTerms, op: "<=", rhs: req.budget } : null;

  const machinesObj: Term[] = [...R.map((p, j): Term => [j, p.units]), ...depots.map((d): Term => [d.col, 1])];
  // Avec des Scrubbers, « moins de pollution » s'arrête à zéro (sinon : Scrubbers à l'infini).
  if (req.criterion === "pollution" && pollutionTerms.some(([, v]) => v < 0)) rows.push({ terms: pollutionTerms, op: ">=", rhs: 0 });
  const objectives: Built["objectives"] = {
    imports: [
      ...imports.map((im): Term => [im.col, (req.demand.get(im.item) ?? 0) > 0 ? TARGET_PENALTY : 1]),
      ...(energyCol >= 0 ? [[energyCol, ENERGY_PENALTY] as Term] : []),
    ],
    machines: machinesObj,
    steps: machinesObj,
    energy: R.flatMap((p, j): Term[] => (p.energy && p.energy > 0 ? [[j, p.energy]] : [])),
    raw: R.flatMap((p, j): Term[] => (p.isRaw ? [[j, Object.values(p.perMin).reduce((s, v) => s + Math.max(0, v), 0)]] : [])),
    pollution: pollutionTerms,
    cost: costTerms,
    area: [
      ...R.map((p, j): Term => [j, p.area ?? UNKNOWN_AREA]),
      ...depots.map((d, k): Term => [d.col, model.depots[k]!.area ?? UNKNOWN_AREA]),
    ],
  };
  // Production existante : au plus ce que le joueur a déjà, sans coût (elle est construite).
  for (const s of supplies) rows.push({ terms: [[s.col, 1]], op: "<=", rhs: req.existing!.get(s.item)! });
  return { lp: { nVars: n, rows }, imports, energyCol, sells, supplies, depots, objectives, pollutionRow, budgetRow };
}

function levels(b: Built, criterion: Criterion): Term[][] {
  const out: Term[][] = [];
  if (b.objectives.imports.length) out.push(b.objectives.imports);
  out.push(b.objectives[criterion]);
  if (criterion !== "area") out.push(b.objectives.area);
  for (const k of ["machines", "energy", "raw"] as const) if (k !== criterion && !(criterion === "steps" && k === "machines")) out.push(b.objectives[k]);
  return out.filter((t) => t.length);
}

const withRows = (b: Built, extra: (Row | null)[]): LP => ({ nVars: b.lp.nVars, rows: [...b.lp.rows, ...extra.filter((r): r is Row => !!r)] });

export function optimize(model: FlowModel, req: OptimizeRequest): OptimizeResult {
  let iterations = 0;
  // 1. La chaîne elle-même : manques seulement là où rien n'est productible ; sinon une boucle
  //    sans source oblige à autoriser un manque sur les items bouclés.
  let b = build(model, req, false);
  let base = solveLP(b.lp, b.objectives.imports.length ? b.objectives.imports : [[0, 0]]);
  iterations += base.iterations;
  if (base.status !== "optimal") {
    b = build(model, req, true);
    base = solveLP(b.lp, b.objectives.imports.length ? b.objectives.imports : [[0, 0]]);
    iterations += base.iterations;
  }
  const fail = (): OptimizeResult => ({ status: "échec", machines: new Map(), imports: new Map(), energyImport: 0, sells: new Map(), supplies: new Map(), depots: new Map(), impossible: {}, iterations });
  if (base.status !== "optimal") return fail();
  const importsFloor = b.objectives.imports.length ? base.value : 0;
  const noExtraImports: Row | null = b.objectives.imports.length ? { terms: b.objectives.imports, op: "<=", rhs: importsFloor + 1e-7 * Math.max(1, Math.abs(importsFloor)) } : null;

  // 2. Contraintes du joueur (pollution maximale, budget), sans manque supplémentaire.
  const impossible: OptimizeResult["impossible"] = {};
  let constraints = [b.pollutionRow, b.budgetRow];
  if (b.pollutionRow || b.budgetRow) {
    const probe = solveLP(withRows(b, [noExtraImports, ...constraints]), [[0, 0]]);
    iterations += probe.iterations;
    if (probe.status !== "optimal") {
      // Ce qui est atteignable au mieux, contrainte par contrainte.
      const best = (terms: Term[]) => {
        const r = solveLP(withRows(b, [noExtraImports]), terms.length ? terms : [[0, 0]]);
        iterations += r.iterations;
        return r.status === "optimal" ? r.value : NaN;
      };
      if (b.pollutionRow && solveLP(withRows(b, [noExtraImports, b.pollutionRow]), [[0, 0]]).status !== "optimal") impossible.pollution = best(b.objectives.pollution);
      if (b.budgetRow && solveLP(withRows(b, [noExtraImports, b.budgetRow]), [[0, 0]]).status !== "optimal") impossible.budget = best(b.objectives.cost);
      if (impossible.pollution === undefined && impossible.budget === undefined) impossible.budget = best(b.objectives.cost); // les deux ensemble
      constraints = [impossible.pollution === undefined ? b.pollutionRow : null, impossible.budget === undefined ? b.budgetRow : null];
      if (solveLP(withRows(b, [noExtraImports, ...constraints]), [[0, 0]]).status !== "optimal") constraints = [];
    }
  }

  // 3. Optimisation par niveaux, sur un ensemble de variables autorisées.
  const full = withRows(b, constraints);
  const lv = levels(b, req.criterion);
  const nR = model.recipes.length;
  const hasImports = b.objectives.imports.length > 0;
  const solveOn = (allowed: (j: number) => boolean): number[] | null => {
    const lp: LP = { nVars: full.nVars, rows: full.rows.map((r) => ({ ...r, terms: r.terms.filter(([j]) => allowed(j)) })) };
    const objs = lv.map((t) => t.filter(([j]) => allowed(j))).filter((t) => t.length);
    const r = solveLexicographic(lp, objs);
    iterations += r.iterations;
    if (r.status !== "optimal") return null;
    // Sans manque de plus que le minimum (une recette écartée ne doit pas créer de manque).
    if (hasImports && b.objectives.imports.reduce((s, [j, a]) => s + a * r.x[j]!, 0) > importsFloor + 1e-6 * Math.max(1, importsFloor)) return null;
    return r.x;
  };

  // 4. Le simplexe minimise des machines fractionnaires : il peut éparpiller la production sur
  //    beaucoup de recettes à 0,01 machine, chacune comptant pour une machine entière une fois
  //    arrondie. Pour les critères qui se comptent en machines entières (machines, prix,
  //    pollution), on compare plusieurs solutions sur le total arrondi : la solution exacte, des
  //    variantes élaguées (sans les recettes à moins d'une machine) et le choix de l'heuristique.
  // Machines entières : une installation composée s'arrondit pièce par pièce.
  const rounded = (p: (typeof model.recipes)[number], x: number, value: (q: { cost: number | null; pollution: number | null; area: number | null }) => number) =>
    p.parts ? p.parts.reduce((s, q) => s + Math.ceil(x * q.count - 1e-9) * value(q), 0) : Math.ceil(x - 1e-9) * value(p);
  const real = (x: number[]): [number, number] => {
    let v = 0;
    let used = 0;
    const ceil = (t: number) => Math.ceil(t - 1e-9);
    model.recipes.forEach((p, j) => {
      if (x[j]! <= 1e-9) return;
      used++;
      if (req.criterion === "cost") v += rounded(p, x[j]!, (q) => q.cost ?? 0);
      else if (req.criterion === "pollution") v += p.parts ? rounded(p, x[j]!, (q) => q.pollution ?? 0) : ceil(x[j]!) * (p.pollution ?? 0);
      else if (req.criterion === "area") v += rounded(p, x[j]!, (q) => q.area ?? 0);
      else if (req.criterion === "machines" || req.criterion === "steps") v += rounded(p, x[j]!, () => 1);
      else v += b.objectives[req.criterion].reduce((s, [k, a]) => (k === j ? s + a * x[j]! : s), 0);
    });
    b.depots.forEach((d, k) => {
      const t = x[d.col]!;
      if (t <= 1e-9) return;
      if (req.criterion === "cost") v += ceil(t) * (model.depots[k]!.cost ?? 0);
      else if (req.criterion === "machines") v += ceil(t);
    });
    return [v, used];
  };
  const better = (a: number[], c: number[]) => {
    const [va, ua] = real(a);
    const [vc, uc] = real(c);
    return va < vc - 1e-9 * Math.max(1, Math.abs(vc)) || (Math.abs(va - vc) <= 1e-9 * Math.max(1, Math.abs(vc)) && ua < uc);
  };
  let x = solveOn(() => true);
  if (!x) return fail();
  if (req.criterion === "machines" || req.criterion === "cost" || req.criterion === "pollution" || req.criterion === "area") {
    const banned = new Set<number>();
    let cur = x;
    for (let round = 0; round < 8; round++) {
      const small = model.recipes.map((_, j) => j).filter((j) => cur[j]! > 1e-9 && cur[j]! < 1 - 1e-9).sort((p, q) => cur[p]! - cur[q]!);
      if (!small.length) break;
      let next: number[] | null = null;
      for (const tryBan of [small, small.slice(0, Math.ceil(small.length / 2)), small.slice(0, 1)]) {
        next = solveOn((j) => j >= nR || (!banned.has(j) && !tryBan.includes(j)));
        if (next) {
          for (const j of tryBan) banned.add(j);
          break;
        }
      }
      if (!next) break;
      cur = next;
      if (better(cur, x)) x = cur;
    }
    if (req.preferred?.size) {
      const v1 = solveOn((j) => j >= nR || req.preferred!.has(model.recipes[j]!.id));
      if (v1 && better(v1, x)) x = v1;
    }
  }
  const keep = (v: number) => v > 1e-9;
  const machines = new Map<string, number>();
  model.recipes.forEach((p, j) => {
    if (keep(x[j]!)) machines.set(p.id, x[j]!);
  });
  const imports = new Map<string, number>();
  for (const im of b.imports) if (keep(x[im.col]!)) imports.set(im.item, x[im.col]!);
  const sells = new Map<string, number>();
  for (const s of b.sells) if (keep(x[s.col]!)) sells.set(s.item, x[s.col]!);
  const depots = new Map<string, number>();
  for (const d of b.depots) if (keep(x[d.col]!)) depots.set(d.id, x[d.col]!);
  const supplies = new Map<string, number>();
  for (const s of b.supplies) if (keep(x[s.col]!)) supplies.set(s.item, x[s.col]!);
  return { status: "ok", machines, imports, energyImport: b.energyCol >= 0 && keep(x[b.energyCol]!) ? x[b.energyCol]! : 0, sells, supplies, depots, impossible, iterations };
}
