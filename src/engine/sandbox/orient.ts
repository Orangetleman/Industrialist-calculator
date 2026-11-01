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
        if (p.d !== role) continue;
        const n = at.get(facingKey(p));
        if (n && n.p.t === p.t && pipe(n.b)) walk(n.b, n.p, role === "s");
      }
    }
  };
  fromMachines("s");
  fromMachines("e");
  return { ...layout, blocks };
}
