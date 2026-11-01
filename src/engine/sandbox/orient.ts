// Sens des tuyaux droits (S57) : un tuyau droit a une entrée et une sortie, et posé à l'envers il coupe le flux
// (réponse de l'utilisateur, 2026-11-01). Pour un montage généré (plans de pose, S56), on tourne chaque tuyau droit
// dans le sens du flux : en partant des sorties de machine (et des sources), puis, pour ce qui reste, en remontant
// depuis les entrées. Les autres pièces vont dans les deux sens et ne changent pas.

import type { Dir, SbCatalog } from "./catalog.ts";
import { crossLane, facingKey, geo, portKey, type Layout, type Placed, type PlacedPort } from "./layout.ts";

type At = { b: Placed; p: PlacedPort };

/** `first` : bâtiments dont les sorties passent avant les autres (les sources d'une vérification). */
export function orientPipes(cat: SbCatalog, layout: Layout, first: number[] = []): Layout {
  const blocks = layout.blocks.map((b) => ({ ...b }));
  const at = new Map<string, At>();
  const portsOf = (b: Placed) => { const d = cat.blocks.get(b.id); return (d && geo(d, b)?.ports.filter((p) => p.cells && (p.t === "o" || p.t === "f"))) ?? []; };
  for (const b of blocks) for (const p of portsOf(b)) at.set(portKey(p.cells!, p.dir as Dir), { b, p });
  const pipe = (b: Placed) => cat.blocks.get(b.id)?.pipe;
  const laneOf = (b: Placed, p: PlacedPort) => (pipe(b)?.role === "croisement" ? crossLane(pipe(b)!.kind === "m" ? 0 : b.pair, p.dir as Dir) : 0);
  const done = new Set<string>();
  /** Numéro d'un port dans `geo().ports` (les objets sont refaits à chaque appel : on compare la place). */
  const idx = (b: Placed, q: PlacedPort) => geo(cat.blocks.get(b.id)!, b)!.ports.findIndex((x) => x.dir === q.dir && x.t === q.t && !!x.cells && portKey(x.cells, x.dir as Dir) === portKey(q.cells!, q.dir as Dir));
  const off = new Set((layout.routes ?? []).filter((r) => r.off).map((r) => `${r.a}|${r.ia}|${r.b}|${r.ib}`));

  /** Parcourt le réseau à partir de la pièce `b`, atteinte par son port `p` ; `fwd` : le flux y entre (sinon il en sort). */
  const walk = (b0: Placed, p0: PlacedPort, fwd: boolean) => {
    const stack: At[] = [{ b: b0, p: p0 }];
    while (stack.length) {
      const { b, p } = stack.pop()!, l = laneOf(b, p), k = `${b.u}:${l}`;
      if (done.has(k)) continue;
      done.add(k);
      const pi = pipe(b)!;
      // Le port par lequel on arrive doit être l'entrée (ou la sortie en remontant) : sinon demi-tour.
      if (pi.role === "droit" && p.d !== (fwd ? "e" : "s")) b.r = (b.r + 2) % 4;
      for (const q of portsOf(b)) {
        if (laneOf(b, q) !== l || portKey(q.cells!, q.dir as Dir) === portKey(p.cells!, p.dir as Dir)) continue;
        const n = at.get(facingKey(q));
        if (n && n.p.t === q.t && pipe(n.b)) stack.push(n);
      }
    }
  };
  const ord = [...blocks.filter((b) => first.includes(b.u)), ...blocks.filter((b) => !first.includes(b.u))];
  const fromMachines = (role: "s" | "e") => {
    for (const b of ord) {
      if (pipe(b)) continue;
      for (const p of portsOf(b)) {
        const n = at.get(facingKey(p));
        if (!n || n.p.t !== p.t || !pipe(n.b)) continue;
        // Port de sortie dont le joueur a retiré la production (raccord retiré) : il sert d'entrée.
        const asIn = p.d === "s" && off.has(`${b.u}|${idx(b, p)}|${n.b.u}|${laneOf(n.b, n.p)}`);
        if ((asIn ? "e" : p.d) === role) walk(n.b, n.p, role === "s");
      }
    }
  };
  fromMachines("s");
  fromMachines("e");
  treeRule();
  return { ...layout, blocks };

  /**
   * Règle de l'arbre (2026-11-01) : un tuyau droit coupe son réseau en deux côtés. Le flux va du côté qui a seul des
   * sorties de machine vers l'autre ; sinon vers le côté qui a seul des entrées ; sinon (aucune source connue, machine
   * non relevée en amont) depuis le côté qui a seul un bout ouvert. Corrige les remontées depuis les entrées qui se
   * contredisent sur un collecteur desservant plusieurs machines ; sinon le sens trouvé plus haut reste.
   */
  function treeRule(): void {
    type T = { src: number; snk: number; open: number };
    const term: (T | null)[] = [], adj: number[][] = [], id = new Map<string, number>();
    const node = (t: T | null) => { term.push(t); adj.push([]); return term.length - 1; };
    const lanesOf = (b: Placed) => (pipe(b)!.role === "croisement" ? [0, 1] : [0]);
    for (const b of blocks) if (pipe(b)) for (const l of lanesOf(b)) id.set(`${b.u}:${l}`, node(null));
    const via = new Map<string, number>(); // « pièce|port » → nœud d'en face
    for (const b of blocks) {
      if (!pipe(b)) continue;
      for (const q of portsOf(b)) {
        const me = id.get(`${b.u}:${laneOf(b, q)}`)!, n = at.get(facingKey(q));
        let nb: number;
        if (n && n.p.t === q.t && pipe(n.b)) nb = id.get(`${n.b.u}:${laneOf(n.b, n.p)}`)!;
        else if (n && n.p.t === q.t) {
          const off_ = n.p.d === "s" && off.has(`${n.b.u}|${idx(n.b, n.p)}|${b.u}|${laneOf(b, q)}`);
          nb = node({ src: n.p.d === "s" && !off_ ? 1 : 0, snk: n.p.d === "e" || off_ ? 1 : 0, open: n.p.d === "l" ? 1 : 0 });
        } else nb = node({ src: 0, snk: 0, open: 1 }); // bout libre, ou contre autre chose (machine non relevée)
        via.set(`${b.u}|${idx(b, q)}`, nb);
        if (!adj[me]!.includes(nb)) adj[me]!.push(nb);
        if (!adj[nb]!.includes(me)) adj[nb]!.push(me);
      }
    }
    // Arbre couvrant (parcours en profondeur), sommes des sous-arbres.
    const N = term.length, parent = new Int32Array(N).fill(-2), root = new Int32Array(N), sub: T[] = term.map((t) => ({ src: t?.src ?? 0, snk: t?.snk ?? 0, open: t?.open ?? 0 }));
    for (let r = 0; r < N; r++) {
      if (parent[r] !== -2) continue;
      parent[r] = -1;
      const order: number[] = [], st = [r];
      while (st.length) {
        const v = st.pop()!;
        order.push(v);
        root[v] = r;
        for (const w of adj[v]!) if (parent[w] === -2) { parent[w] = v; st.push(w); }
      }
      for (let i = order.length - 1; i > 0; i--) { const v = order[i]!, pv = parent[v]!; sub[pv]!.src += sub[v]!.src; sub[pv]!.snk += sub[v]!.snk; sub[pv]!.open += sub[v]!.open; }
    }
    const side = (me: number, nb: number): T | null => {
      if (parent[nb] === me) return sub[nb]!;
      if (parent[me] === nb) { const t = sub[root[me]!]!, m = sub[me]!; return { src: t.src - m.src, snk: t.snk - m.snk, open: t.open - m.open }; }
      return null; // arête hors de l'arbre (boucle) : on ne tranche pas
    };
    for (const b of blocks) {
      if (pipe(b)?.role !== "droit") continue;
      const ps = portsOf(b);
      if (ps.length !== 2) continue;
      const me = id.get(`${b.u}:0`)!, A = side(me, via.get(`${b.u}|${idx(b, ps[0]!)}`)!), B = side(me, via.get(`${b.u}|${idx(b, ps[1]!)}`)!);
      if (!A || !B) continue;
      // Vrai : le flux vient du côté A (le port 0 doit être l'entrée).
      const fromA = A.src && !B.src ? true : B.src && !A.src ? false : B.snk && !A.snk ? true : A.snk && !B.snk ? false : !A.src && !B.src && A.open && !B.open ? true : !A.src && !B.src && B.open && !A.open ? false : null;
      if (fromA === null) continue;
      if ((ps[0]!.d === "e") !== fromA) b.r = (b.r + 2) % 4;
    }
  }
}
