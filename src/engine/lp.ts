// Programmation linéaire : simplexe en deux phases, écrit à la main (aucune dépendance).
//
//   minimiser  c·x   sous  A·x (≤ | ≥ | =) b,  x ≥ 0
//
// Tableau dense (une ligne Float64Array par contrainte), règle de Dantzig avec repli sur la
// règle de Bland après une suite de pivots dégénérés (évite les cycles). Les lignes sont mises à
// l'échelle (coefficient maximal = 1) pour la stabilité numérique : les débits vont de 0,01/min à
// plusieurs millions de MF/s.
// `solveLexicographic` enchaîne plusieurs objectifs par ordre de priorité sur le même tableau :
// après chaque niveau, les colonnes qui le dégraderaient (coût réduit > 0) sont interdites. C'est
// exact (aucune tolérance ajoutée) et chaque niveau repart de la base optimale du précédent.

export type Op = "<=" | ">=" | "=";
/** Terme creux : [indice de variable, coefficient]. */
export type Term = [number, number];
export type Row = { terms: Term[]; op: Op; rhs: number };
export type LP = { nVars: number; rows: Row[] };
export type LPStatus = "optimal" | "infeasible" | "unbounded" | "limite";
export type LPResult = { status: LPStatus; x: number[]; value: number; iterations: number };
export type LexResult = LPResult & { values: number[] };

const EPS = 1e-9;

class Tableau {
  readonly n: number;
  private m = 0;
  private nCols = 0;
  private firstArt = 0;
  private W = 0;
  private RHS = 0;
  /** Seconds membres d’origine (non perturbés), transformés avec le reste du tableau. */
  private RHS0 = 0;
  private T: Float64Array[] = [];
  private basis: number[] = [];
  private z = new Float64Array(0);
  /** Colonnes interdites (artificielles après la phase 1, niveaux précédents). */
  private banned = new Uint8Array(0);
  iterations = 0;
  infeasibleRows = false;
  private readonly maxIter: number;

  constructor(lp: LP, maxIter: number) {
    this.n = lp.nVars;
    this.maxIter = maxIter;
    const n = this.n;
    type Norm = { cols: Map<number, number>; op: Op; rhs: number };
    const rows: Norm[] = [];
    for (const r of lp.rows) {
      const cols = new Map<number, number>();
      for (const [j, a] of r.terms) {
        if (j < 0 || j >= n) throw new Error(`variable hors limites : ${j}`);
        if (a !== 0 && Number.isFinite(a)) cols.set(j, (cols.get(j) ?? 0) + a);
      }
      let scale = 0;
      for (const [j, a] of cols) {
        if (Math.abs(a) < 1e-15) cols.delete(j);
        else scale = Math.max(scale, Math.abs(a));
      }
      let { op, rhs } = r;
      if (scale === 0) {
        // 0 op rhs : vraie ou fausse, sans variable.
        const ok = op === "<=" ? 0 <= rhs + EPS : op === ">=" ? 0 >= rhs - EPS : Math.abs(rhs) <= EPS;
        if (!ok) this.infeasibleRows = true;
        continue;
      }
      for (const [j, a] of cols) cols.set(j, a / scale);
      rhs /= scale;
      if (rhs < 0) {
        for (const [j, a] of cols) cols.set(j, -a);
        rhs = -rhs;
        op = op === "<=" ? ">=" : op === ">=" ? "<=" : "=";
      }
      rows.push({ cols, op, rhs });
    }
    this.m = rows.length;
    // Perturbation : les bilans à zéro rendent le problème très dégénéré (le simplexe piétine
    // sur un même sommet). Chaque inégalité est relâchée d'un δ minuscule et distinct ; la
    // solution est relue à la fin dans la base optimale avec les seconds membres d'origine
    // (colonne RHS0), donc exacte. Une ligne ≥ 0 relâchée devient −a·x ≤ δ : base d'écart directe.
    let seed = 12345;
    const delta = () => 1e-7 * (1 + (seed = (seed * 16807) % 2147483647) / 2147483647);
    const prepared = rows.map((r) => {
      if (r.op === "<=") return { ...r, rhsP: r.rhs + delta() };
      if (r.op === ">=") {
        const d = delta();
        if (r.rhs - d >= 0) return { ...r, rhsP: r.rhs - d };
        const cols = new Map([...r.cols].map(([j, a]) => [j, -a] as [number, number]));
        return { cols, op: "<=" as Op, rhs: -r.rhs, rhsP: d - r.rhs };
      }
      return { ...r, rhsP: r.rhs };
    });
    // Colonnes : variables, écarts (≤ : +s, ≥ : −s), artificielles (≥ et =), RHS perturbé, RHS0.
    let nCols = n;
    const slackOf = prepared.map((r) => (r.op === "=" ? -1 : nCols++));
    this.firstArt = nCols;
    const artOf = prepared.map((r) => (r.op === "<=" ? -1 : nCols++));
    this.nCols = nCols;
    this.W = nCols + 2;
    this.RHS = nCols;
    this.RHS0 = nCols + 1;
    this.banned = new Uint8Array(nCols);
    this.z = new Float64Array(this.W);
    prepared.forEach((r, i) => {
      const row = new Float64Array(this.W);
      for (const [j, a] of r.cols) row[j] = a;
      if (slackOf[i]! >= 0) row[slackOf[i]!] = r.op === "<=" ? 1 : -1;
      if (artOf[i]! >= 0) row[artOf[i]!] = 1;
      row[this.RHS] = r.rhsP;
      row[this.RHS0] = r.rhs;
      this.T.push(row);
      this.basis.push(r.op === "<=" ? slackOf[i]! : artOf[i]!);
    });
  }

  private pivot(p: number, q: number): void {
    const rp = this.T[p]!;
    const inv = 1 / rp[q]!;
    const nz: number[] = [];
    for (let j = 0; j < this.W; j++) {
      if (rp[j] !== 0) {
        rp[j]! *= inv;
        nz.push(j);
      }
    }
    rp[q] = 1;
    const RHS = this.RHS;
    const elim = (row: Float64Array) => {
      const f = row[q]!;
      if (f === 0) return;
      for (const j of nz) {
        const v = row[j]! - f * rp[j]!;
        // Le bruit d'arrondi (1e-17…) remplirait le tableau et créerait de faux pivots.
        row[j] = Math.abs(v) < 1e-13 ? 0 : v;
      }
      row[q] = 0;
    };
    for (let i = 0; i < this.m; i++) {
      if (i === p) continue;
      const row = this.T[i]!;
      elim(row);
      if (row[RHS]! < 0) row[RHS] = 0; // dans la tolérance du test de Harris
    }
    elim(this.z);
    this.basis[p] = q;
  }

  private iterate(): LPStatus {
    let degenerate = 0;
    const { T, z, m, RHS, basis, banned } = this;
    const PIV = 1e-9; // plus petit pivot accepté
    const HARRIS = 1e-9; // tolérance du test du ratio
    for (;;) {
      if (this.iterations >= this.maxIter) return "limite";
      const bland = degenerate > 40;
      let q = -1;
      let best = -EPS;
      for (let j = 0; j < this.nCols; j++) {
        if (banned[j]) continue;
        const r = z[j]!;
        if (r < best) {
          q = j;
          if (bland) break;
          best = r;
        }
      }
      if (q < 0) return "optimal";
      // Test du ratio de Harris : borne avec tolérance, puis, parmi les lignes sous la borne, le
      // plus grand pivot (le plus stable) — ou le plus petit indice de base en mode Bland.
      let bound = Infinity;
      for (let i = 0; i < m; i++) {
        const a = T[i]![q]!;
        if (a > PIV) bound = Math.min(bound, (T[i]![RHS]! + HARRIS) / a);
      }
      if (bound === Infinity) return "unbounded";
      let p = -1;
      for (let i = 0; i < m; i++) {
        const a = T[i]![q]!;
        if (a <= PIV || T[i]![RHS]! / a > bound) continue;
        if (p < 0 || (bland ? basis[i]! < basis[p]! : a > T[p]![q]!)) p = i;
      }
      degenerate = T[p]![RHS]! / T[p]![q]! <= EPS ? degenerate + 1 : 0;
      this.pivot(p, q);
      this.iterations++;
    }
  }

  private setObjective(cost: Float64Array): void {
    const { z, T, m, W, basis } = this;
    z.fill(0);
    for (let j = 0; j < this.nCols; j++) z[j] = cost[j]!;
    for (let i = 0; i < m; i++) {
      const cb = cost[basis[i]!]!;
      if (cb === 0) continue;
      const row = T[i]!;
      for (let j = 0; j < W; j++) if (row[j] !== 0) z[j]! -= cb * row[j]!;
    }
  }

  /** Phase 1 : trouve une base réalisable. */
  phase1(): LPStatus {
    if (this.infeasibleRows) return "infeasible";
    if (this.firstArt < this.nCols) {
      const cost = new Float64Array(this.nCols);
      for (let j = this.firstArt; j < this.nCols; j++) cost[j] = 1;
      this.setObjective(cost);
      const st = this.iterate();
      if (st === "limite") return st;
      if (-this.z[this.RHS]! > 1e-7) return "infeasible";
      // Sortir les artificielles restées en base (à zéro) ; une ligne sans pivot possible est redondante.
      for (let i = 0; i < this.m; i++) {
        if (this.basis[i]! < this.firstArt) continue;
        for (let j = 0; j < this.firstArt; j++) {
          if (Math.abs(this.T[i]![j]!) > 1e-7) {
            this.pivot(i, j);
            break;
          }
        }
      }
      for (let j = this.firstArt; j < this.nCols; j++) this.banned[j] = 1;
    }
    return "optimal";
  }

  /** Minimise un objectif (mis à l'échelle) depuis la base courante. */
  minimize(objective: Term[]): LPStatus {
    const c = new Float64Array(this.nCols);
    for (const [j, a] of objective) if (j >= 0 && j < this.n && Number.isFinite(a)) c[j]! += a;
    let s = 0;
    for (let j = 0; j < this.n; j++) s = Math.max(s, Math.abs(c[j]!));
    if (s > 0) for (let j = 0; j < this.n; j++) c[j]! /= s;
    this.setObjective(c);
    return this.iterate();
  }

  /** Interdit les colonnes dont l'entrée dégraderait l'objectif qui vient d'être optimisé. */
  freezeLevel(): void {
    for (let j = 0; j < this.nCols; j++) if (this.z[j]! > 1e-9) this.banned[j] = 1;
  }

  solution(): number[] {
    const x = new Array<number>(this.n).fill(0);
    for (let i = 0; i < this.m; i++) {
      const b = this.basis[i]!;
      if (b < this.n) x[b] = Math.max(0, this.T[i]![this.RHS0]!);
    }
    return x;
  }
}

const valueOf = (objective: Term[], x: number[]) => objective.reduce((s, [j, a]) => (j >= 0 && j < x.length ? s + a * x[j]! : s), 0);

export function solveLP(lp: LP, objective: Term[], opts: { maxIter?: number } = {}): LPResult {
  const r = solveLexicographic(lp, [objective], opts);
  return { status: r.status, x: r.x, value: r.value, iterations: r.iterations };
}

/**
 * Optimisation par niveaux : chaque objectif est minimisé sans dégrader les précédents —
 * l'équivalent exact des départages successifs du moteur v1.
 */
export function solveLexicographic(lp: LP, objectives: Term[][], opts: { maxIter?: number } = {}): LexResult {
  const t = new Tableau(lp, opts.maxIter ?? 50_000);
  const fail = (status: LPStatus): LexResult => ({ status, x: new Array(lp.nVars).fill(0), value: NaN, iterations: t.iterations, values: [] });
  const st = t.phase1();
  if (st !== "optimal") return fail(st);
  const values: number[] = [];
  const objs = objectives.length ? objectives : [[]];
  for (let k = 0; k < objs.length; k++) {
    const s = t.minimize(objs[k]!);
    if (s !== "optimal") return fail(s);
    values.push(valueOf(objs[k]!, t.solution()));
    if (k < objs.length - 1) t.freezeLevel();
  }
  const x = t.solution();
  return { status: "optimal", x, value: valueOf(objs.at(-1)!, x), iterations: t.iterations, values };
}
