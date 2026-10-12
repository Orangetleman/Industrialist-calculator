// Objectif « Gagner des RP » : installation proposée, chronologie de déblocage, autres options.
// Fonctions pures (chaînes HTML) ; la chaîne qui produit les items des stations est rendue comme
// les autres plans (plan-view.ts).

import type { RpCandidate, RpResult, TimelineEntry } from "../engine/research-points.ts";
import { esc, fmt, fmtDuration, fmtMoney, fmtRP } from "./format.ts";
import { itemN, type Ctx } from "./render.ts";

export type ResearchView = RpResult & {
  nodes: string[];
  capNeeded: number;
  targetRate: number;
  timeline: TimelineEntry[] | null;
  timelineNow: TimelineEntry[] | null;
  currentRate: number | null;
};

export const STATION_KIND: Record<string, string> = { rs1: "Research Station1", rs2: "Research Station2", rs3: "Research Station3", rs4: "Research Station3 + Research Station4" };

/** « 4 × Research Station2 · Gear · contrôleur de paraboles ». */
export function designLine(ctx: Pick<Ctx, "data">, c: RpCandidate): string {
  const d = c.design;
  const items = d.items.length ? ` · ${d.items.map((i) => esc(itemN(ctx, i))).join(" + ")}` : "";
  const sat = d.satellites ? ` · ${d.satellites.controllers} contrôleur(s) de paraboles` : "";
  return `${d.stations} × ${esc(STATION_KIND[d.kind]!)}${items}${d.logic ? " · mini-jeu Logic" : ""}${sat}`;
}

/** Explication de l'installation : d'où viennent les RP/s, ce qu'il faut fournir. */
export function researchExplain(ctx: Pick<Ctx, "data">, c: RpCandidate): string {
  const d = c.design;
  const name = (id: string) => esc(itemN(ctx, id));
  const parts: string[] = [`<b>Installation :</b> ${designLine(ctx, c)}.`];
  parts.push(
    `Vitesse : ${fmt(d.baseRate, 2)} RP/s des stations${d.boostRate ? `, + ${fmt(d.boostRate, 2)} des paraboles` : ""}${d.circuitRate ? `, + ${fmt(d.circuitRate, 2)} des circuits Logic (tant que tes RP sont sous le plafond)` : ""}.`,
  );
  if (Object.keys(d.consumption).length) parts.push(`À fournir : ${Object.entries(d.consumption).map(([i, q]) => `${fmt(q, 2)} ${name(i)}/min`).join(", ")}.`);
  if (d.satellites) {
    parts.push(
      `Paraboles : ${d.satellites.controllers} Satellite Dish Controller(s) avec ${name(d.satellites.fluid)} (valeur ${fmt(d.satellites.fluidValue, 2)}) et ${d.satellites.dishes} Satellite Dish(es) pour 100 % d'efficacité. Le wiki écrit « log » sans préciser la base : logarithme décimal, d'après un joueur.`,
    );
  }
  if (d.kind === "rs4") parts.push("Une paire RS3 + RS4 consomme 5 MMF/s en tout (« increases power consumption to 5 MMF/s »).");
  return `<p>${parts.join(" ")}</p>`;
}

/** Chronologie : quand chaque recherche visée est débloquée (avec l'installation, et au rythme actuel). */
export function researchTimeline(v: ResearchView, nodeName: (id: string) => string): string {
  if (!v.timeline?.length) return "";
  const now = new Map((v.timelineNow ?? []).map((t) => [t.node, t.at]));
  const rows = v.timeline
    .map(
      (t) =>
        `<tr><td>${esc(nodeName(t.node))}${t.overCap ? ` <span class="tag warn">au-delà du plafond</span>` : ""}</td><td class="num">${esc(fmtRP(t.rp))}</td><td class="num">${esc(fmtDuration(t.at))}</td>${
          v.timelineNow ? `<td class="num">${now.has(t.node) ? esc(fmtDuration(now.get(t.node)!)) : "—"}</td>` : ""
        }</tr>`,
    )
    .join("");
  return `<div class="tablewrap"><table class="mini"><thead><tr><th>Recherche</th><th>RP</th><th>Avec l'installation</th>${v.timelineNow ? "<th>À ton rythme actuel</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Depuis tes RP actuels ; chaque déblocage dépense son coût. Au-delà du plafond, la vitesse chute.</p>`;
}

/** Autres installations comparées. */
export function researchAlternatives(ctx: Pick<Ctx, "data">, v: ResearchView): string {
  if (!v.others.length) return "";
  return `<ul class="notes">${v.others
    .map((o) => `<li>${designLine(ctx, o)} — ${fmt(o.design.rate, 1)} RP/s, plafond ${esc(fmtRP(o.design.cap))}, ${esc(fmtMoney(o.design.buildingCost + o.plan.totals.buildCost))}</li>`)
    .join("")}</ul>`;
}
