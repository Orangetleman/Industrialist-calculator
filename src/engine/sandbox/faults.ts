// Garde-fou du raccord automatique (S57, R26) : chaque flux qui passe relie la bonne ressource au bon port. Sert aux
// tests (montages faits à la main et plans générés par S56). Règles : BAS-11 et BAS-12 de data/a-verifier.md.

import type { SbCatalog } from "./catalog.ts";
import type { FlowArrow, FlowBtn, SandboxResult } from "./compute.ts";
import { geo, type Layout } from "./layout.ts";

/** Ce qui ne va pas dans les flèches d'un montage calculé ; vide quand tout est relié comme il faut. */
export function arrowFaults(cat: SbCatalog, layout: Layout, R: SandboxResult): string[] {
  const byU = new Map(layout.blocks.map((b) => [b.u, b]));
  const portOf = (x: FlowBtn) => {
    if (!("port" in x)) return null;
    const b = byU.get(x.u)!, d = cat.blocks.get(b.id)!;
    return { b, d, p: geo(d, b)!.ports[x.port]!, ports: geo(d, b)!.ports };
  };
  const laneItem = (x: FlowBtn) => ("lane" in x ? R.lanes.find((l) => l.u === x.u && l.lane === x.lane)?.item ?? null : null);
  const out: string[] = [];
  for (const a of R.arrows) {
    if (!a.item || a.f <= 1e-9) continue;
    const say = (m: string) => out.push(`${describe(a)} : ${m}`);
    const t = cat.items.get(a.item)?.fluid ? "f" : "o";
    if (a.t !== t) say(`flux ${a.t} pour ${a.item}`);
    const from = portOf(a.from), to = portOf(a.to);
    if (from) {
      if (from.p.d !== "s") say("une production part d'un port qui n'est pas une sortie");
      const rec = R.machines.get(a.from.u)?.rec;
      if (!rec || !(a.item in rec.out)) say(`${a.item} n'est pas produit par ${from.d.id}`);
    } else if (laneItem(a.from) !== a.item) say("la voie de départ porte une autre ressource");
    if (to) {
      const rec = R.machines.get(a.to.u)?.rec;
      if (!rec || !(a.item in rec.in)) say(`${a.item} n'est pas consommé par ${to.d.id}`);
      // L'arrivée est une entrée du type de la ressource, sauf si la machine n'en a pas (croisement objet × fluide, BAS-12 a)
      // ou si le flux va d'une machine à l'autre (liaison collée, réglée d'un bouton à l'autre : BAS-12 c).
      const hasIn = to.ports.some((p) => p.cells && p.d === "e" && p.t === t);
      if (!from && hasIn && (to.p.d !== "e" || to.p.t !== t)) say("le flux n'arrive pas sur le bouton d'entrée de sa ressource");
    } else if (laneItem(a.to) !== a.item) say("la voie d'arrivée porte une autre ressource");
  }
  return out;
}

const btn = (x: FlowBtn) => ("port" in x ? `${x.u}#port${x.port}` : `${x.u}#voie${x.lane}`);
const describe = (a: FlowArrow) => `${btn(a.from)} → ${btn(a.to)} (${a.item})`;
