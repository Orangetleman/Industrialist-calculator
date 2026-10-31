// Bac à sable (B1) : câbles électriques. Chaque prise est un flux à part (les deux prises d'un poteau LV sont
// deux flux) et les câbles sont orientés, de la source vers ce qu'elle alimente (retour du 2026-10-31).

import type { SbCatalog } from "./catalog.ts";
import { geo, type Layout, type PlacedPort, type Wire } from "./layout.ts";

export type ElecRole = "pole" | "gen" | "cons";

const placed = (layout: Layout, u: number) => layout.blocks.find((b) => b.u === u);

/** Prises électriques du bâtiment (indices dans `geo().ports`), filtrées par sens si `d` est donné. */
export function powerPorts(cat: SbCatalog, layout: Layout, u: number, d?: "e" | "s"): { p: PlacedPort; i: number }[] {
  const b = placed(layout, u), def = b && cat.blocks.get(b.id), g = def && geo(def, b);
  if (!g) return [];
  return g.ports.map((p, i) => ({ p, i })).filter((x) => x.p.dir === "top" && x.p.t === "p" && (!d || x.p.d === d));
}

/** Poteau (prises dans les deux sens), générateur (prise de sortie), consommateur (prise d'entrée). */
export function elecRole(cat: SbCatalog, layout: Layout, u: number): ElecRole | null {
  const ps = powerPorts(cat, layout, u);
  if (!ps.length) return null;
  return ps.some((x) => x.p.d === "s") ? "gen" : ps.some((x) => x.p.d === "e") ? "cons" : "pole";
}

/** Alimenté : une prise du bâtiment est atteinte depuis un générateur en suivant les câbles dans leur sens. */
export function powered(cat: SbCatalog, layout: Layout, u: number): boolean {
  const seen = new Set<string>(), st: string[] = [];
  for (const b of layout.blocks) if (elecRole(cat, layout, b.u) === "gen") for (const x of powerPorts(cat, layout, b.u, "s")) { seen.add(`${b.u}:${x.i}`); st.push(`${b.u}:${x.i}`); }
  while (st.length) {
    const k = st.pop()!;
    for (const w of layout.wires) if (w.t === "p" && `${w.a}:${w.ia}` === k) {
      const n = `${w.b}:${w.ib}`;
      if (!seen.has(n)) { seen.add(n); st.push(n); }
    }
  }
  return powerPorts(cat, layout, u).some((x) => seen.has(`${u}:${x.i}`));
}

export type WireError = { k: "noPole" } | { k: "tooFar"; dist: number; range: number } | { k: "noPort" };

/**
 * Câbles à poser entre deux bâtiments :
 * - machine ↔ poteau : de chaque prise du poteau vers la prise d'entrée de la machine (les deux prises d'un LV) ;
 * - générateur → poteau : de la prise de sortie vers chaque prise du poteau ;
 * - poteau ↔ poteau : prise à prise, du poteau alimenté vers l'autre. En automatique, jamais entre deux poteaux
 *   tous deux alimentés (1,1) ni tous deux sans source (0,0) : seulement (1,0) et (0,1).
 * Le câble doit tenir dans la portée du bâtiment d'où il part (début de la flèche) : le poteau vers une machine ou
 * un autre poteau, le générateur vers un poteau (règle du 2026-10-14, rappelée le 2026-10-31). Portée non relevée
 * (générateurs) : le câble est posé en manuel avec `rangeUnknown`, jamais en automatique.
 * Renvoie null quand il n'y a rien à faire.
 */
export function powerWires(cat: SbCatalog, layout: Layout, ua: number, ub: number, auto = false): { wires: Wire[]; rangeUnknown?: true } | { err: WireError } | null {
  const ra = elecRole(cat, layout, ua), rb = elecRole(cat, layout, ub);
  if (!ra || !rb) return null;
  if (ra !== "pole" && rb !== "pole") return { err: { k: "noPole" } };
  const wires: Wire[] = [], W = (a: number, ia: number, b: number, ib: number) => wires.push({ a, ia, b, ib, t: "p" });
  let from: number;
  if (ra === "pole" && rb === "pole") {
    const pa = powered(cat, layout, ua), pb = powered(cat, layout, ub);
    let to = ub;
    from = ua;
    if (pb && !pa) [from, to] = [ub, ua];
    else if (pa === pb && auto) return null;
    const F = powerPorts(cat, layout, from), T = powerPorts(cat, layout, to);
    F.forEach((x, k) => { if (T[k]) W(from, x.i, to, T[k].i); });
  } else {
    const pole = ra === "pole" ? ua : ub, other = pole === ua ? ub : ua, role = elecRole(cat, layout, other);
    from = role === "gen" ? other : pole;
    for (const x of powerPorts(cat, layout, pole)) for (const y of powerPorts(cat, layout, other, role === "gen" ? "s" : "e")) {
      if (role === "gen") W(other, y.i, pole, x.i);
      else W(pole, x.i, other, y.i);
    }
  }
  if (!wires.length) return { err: { k: "noPort" } };
  const range = cat.blocks.get(placed(layout, from)!.id)?.elec?.range ?? null;
  const A = powerPorts(cat, layout, ua), B = powerPorts(cat, layout, ub);
  const dist = Math.min(...A.flatMap((x) => B.map((y) => Math.hypot(x.p.px! - y.p.px!, x.p.py! - y.p.py!))));
  if (range == null) return auto ? null : { wires, rangeUnknown: true };
  if (dist > range) return { err: { k: "tooFar", dist, range } };
  return { wires };
}

/** Re-clic sur un poteau : tout ce qui est dans sa portée et pas encore relié, selon les règles automatiques. */
export function autoConnect(cat: SbCatalog, layout: Layout, u: number): Wire[] {
  const out: Wire[] = [];
  for (const b of layout.blocks) {
    if (b.u === u || layout.wires.some((w) => (w.a === u && w.b === b.u) || (w.a === b.u && w.b === u))) continue;
    const r = powerWires(cat, layout, u, b.u, true);
    if (r && "wires" in r) out.push(...r.wires);
  }
  return out;
}
