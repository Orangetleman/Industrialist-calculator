// Flot maximal (Edmonds-Karp), comme la maquette du bac à sable : assez rapide pour quelques centaines de nœuds.

export type Arc = { to: number; cap: number; f: number; r: Arc };

export class MaxFlow {
  private g: Arc[][];
  constructor(n: number) { this.g = Array.from({ length: n }, () => []); }
  add(a: number, b: number, cap: number): Arc {
    const A = { to: b, cap, f: 0 } as Arc, B = { to: a, cap: 0, f: 0 } as Arc;
    A.r = B; B.r = A;
    this.g[a]!.push(A); this.g[b]!.push(B);
    return A;
  }
  /** Pousse tout ce qui peut encore passer de s à t (peut être rappelé après avoir ajouté des arcs). */
  run(s: number, t: number): void {
    for (;;) {
      const prev: (Arc | null)[] = new Array(this.g.length).fill(null), q = [s];
      let seen = false;
      const mark = new Uint8Array(this.g.length); mark[s] = 1;
      while (q.length && !seen) {
        const v = q.shift()!;
        for (const e of this.g[v]!) if (!mark[e.to] && e.cap - e.f > 1e-12) { mark[e.to] = 1; prev[e.to] = e; q.push(e.to); if (e.to === t) { seen = true; break; } }
      }
      if (!seen) return;
      let a = Infinity;
      for (let v = t; v !== s; v = prev[v]!.r.to) a = Math.min(a, prev[v]!.cap - prev[v]!.f);
      for (let v = t; v !== s; v = prev[v]!.r.to) { prev[v]!.f += a; prev[v]!.r.f -= a; }
    }
  }
}
