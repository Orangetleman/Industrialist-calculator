// Objectif « Recherche (RP) » : installation proposée, chronologie de déblocage, autres options.
// Fonctions pures (chaînes HTML) ; la chaîne de production des items est rendue comme les autres
// plans (graphe, étapes).

import type { RpCandidate, RpResult, TimelineEntry } from "../engine/research-points.ts";
import { esc, fmt, fmtDuration, fmtMF, fmtMoney, fmtRP } from "./format.ts";
import type { Ctx } from "./render.ts";

export type ResearchView = RpResult & {
  nodes: string[];
  capNeeded: number;
  targetRate: number;
  timeline: TimelineEntry[] | null;
  timelineNow: TimelineEntry[] | null;
  currentRate: number | null;
};

const KIND: Record<string, string> = { rs1: "Research Station1", rs2: "Research Station2", rs3: "Research Station3", rs4: "Research Station3 + Research Station4" };

export function renderResearchStatus(v: ResearchView | null): string {
  if (!v) return `<div class="banner bad" role="status">Les formules des stations de recherche sont incomplètes dans les données.</div>`;
  if (v.best) return v.warnings.length ? `<div class="banner warn" role="status">${v.warnings.map(esc).join("<br>")}</div>` : "";
  return `<div class="banner ${v.warnings.some((w) => /déjà|suffit/.test(w)) ? "ok" : "bad"}" role="status">${v.warnings.map(esc).join("<br>") || "Aucune installation possible."}</div>`;
}

function designLine(ctx: Ctx, c: RpCandidate): string {
  const d = c.design;
  const items = d.items.length ? ` · ${d.items.map((i) => esc(ctx.data.items.get(i)?.name ?? i)).join(" + ")}` : "";
  const sat = d.satellites ? ` · ${d.satellites.controllers} contrôleur(s) de paraboles` : "";
  return `${d.stations} × ${esc(KIND[d.kind]!)}${items}${d.logic ? " · mini-jeu Logic" : ""}${sat}`;
}

export function renderResearch(ctx: Ctx, v: ResearchView | null, nodeName: (id: string) => string): string {
  if (!v || !v.best) return "";
  const c = v.best;
  const d = c.design;
  const name = (id: string) => esc(ctx.data.items.get(id)?.name ?? id);
  const chainMachines = c.plan.totals.machines + c.plan.totals.farms;
  const buildings = d.buildings.reduce((s, b) => s + b.count, 0);
  const cards: [string, string][] = [
    [`${fmt(d.rate, 2)}`, `RP/s${v.currentRate ? ` (+ ${fmt(v.currentRate, 2)} déjà produits)` : ""}`],
    [fmtRP(d.cap), `plafond${v.capNeeded ? ` (besoin : ${fmtRP(v.capNeeded)})` : ""}`],
    [String(buildings), "stations et paraboles"],
    [String(chainMachines), "machines pour les items"],
    [fmtMF(d.powerMFps + (c.plan.totals.energyAvg - d.powerMFps)), "énergie (stations comprises)"],
    [fmtMoney(d.buildingCost + c.plan.totals.buildCost), "coût total"],
  ];
  const stats = cards.map(([val, k]) => `<div class="stat"><span class="v">${val}</span><span class="k">${k}</span></div>`).join("");
  const parts: string[] = [`<b>Installation :</b> ${designLine(ctx, c)}.`];
  parts.push(
    `Vitesse : ${fmt(d.baseRate, 2)} RP/s des stations${d.boostRate ? `, + ${fmt(d.boostRate, 2)} des paraboles` : ""}${d.circuitRate ? `, + ${fmt(d.circuitRate, 2)} des circuits Logic (tant que tes RP sont sous le plafond)` : ""}.`,
  );
  if (Object.keys(d.consumption).length) parts.push(`À fournir : ${Object.entries(d.consumption).map(([i, q]) => `${fmt(q, 2)} ${name(i)}/min`).join(", ")}.`);
  if (d.satellites) {
    parts.push(
      `Paraboles : ${d.satellites.controllers} Satellite Dish Controller(s) avec ${name(d.satellites.fluid)} (valeur ${fmt(d.satellites.fluidValue, 2)}) et ${d.satellites.dishes} Satellite Dish(es) pour 100 % d'efficacité. Le wiki écrit « log » sans préciser la base : logarithme décimal retenu, à confirmer en jeu.`,
    );
  }
  if (d.kind === "rs4") parts.push("Une paire RS3 + RS4 consomme 5 MMF/s en tout (« increases power consumption to 5 MMF/s »).");
  let html = `<div class="stats">${stats}</div><p class="list-line">${parts.join(" ")}</p>`;

  if (v.timeline?.length) {
    const now = new Map((v.timelineNow ?? []).map((t) => [t.node, t.at]));
    const rows = v.timeline
      .map(
        (t) =>
          `<tr><td>${esc(nodeName(t.node))}${t.overCap ? ` <span class="tag warn">au-delà du plafond</span>` : ""}</td><td class="num">${esc(fmtRP(t.rp))}</td><td class="num">${esc(fmtDuration(t.at))}</td>${
            v.timelineNow ? `<td class="num">${now.has(t.node) ? esc(fmtDuration(now.get(t.node)!)) : "—"}</td>` : ""
          }</tr>`,
      )
      .join("");
    html += `<details class="timeline" open><summary>Chronologie : quand chaque recherche est débloquée</summary>
      <table class="mini"><thead><tr><th>Recherche</th><th>RP</th><th>Avec l'installation</th>${v.timelineNow ? "<th>À ton rythme actuel</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">Depuis tes RP actuels ; chaque déblocage dépense son coût. Au-delà du plafond, la vitesse chute (plafond souple).</p></details>`;
  }
  if (v.others.length) {
    html += `<details class="alts"><summary>Autres installations comparées</summary><ul class="notes">${v.others
      .map((o) => `<li>${designLine(ctx, o)} — ${fmt(o.design.rate, 1)} RP/s, plafond ${esc(fmtRP(o.design.cap))}, ${esc(fmtMoney(o.design.buildingCost + o.plan.totals.buildCost))}</li>`)
      .join("")}</ul></details>`;
  }
  return html;
}
