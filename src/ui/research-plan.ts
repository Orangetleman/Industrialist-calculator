// Objectif « Gagner des RP » : installation proposée, chronologie de déblocage, autres options.
// Fonctions pures (chaînes HTML) ; la chaîne qui produit les items des stations est rendue comme
// les autres plans (plan-view.ts).

import type { AddProposal, RpModel } from "../engine/research-balance.ts";
import type { RpCandidate, RpResult, StationKind, TimelineEntry } from "../engine/research-points.ts";
import { esc, fmt, fmtDuration, fmtMoney, fmtRP } from "./format.ts";
import { itemN, type Ctx } from "./render.ts";
import { researchHow } from "./research-mine.ts";

export type ResearchView = RpResult & {
  nodes: string[];
  capNeeded: number;
  targetRate: number;
  timeline: TimelineEntry[] | null;
  timelineNow: TimelineEntry[] | null;
  currentRate: number | null;
  /** Ma recherche (S20) : mes stations, si elles comptent (« Compter ma production actuelle »). */
  model?: RpModel | null;
  /** « Ajoute N stations aux tiennes » (niveau détaillé), ou pourquoi ce n'est pas possible. */
  add?: (AddProposal & { buildingCost: number; consumption: Record<string, number>; timeline: TimelineEntry[] | null }) | { reason: string } | null;
  /** L'installation neuve est du même tier que mes stations : elle s'y ajoute. */
  mergedTier?: StationKind | null;
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

/** L'installation neuve s'ajoute à mes stations du même tier : la vitesse affichée est le gain. */
export function researchMergeNote(v: ResearchView): string {
  const t = v.mergedTier ? v.model?.tiers.find((x) => x.kind === v.mergedTier) : null;
  if (!t || !v.best) return "";
  return `<p class="hint">Tes ${t.stations !== null ? `${t.stations} ` : ""}stations du tier ${t.kind.slice(2)} et les nouvelles forment un seul tier : vitesse et seuil se recalculent sur toutes les stations du tier (deux groupes ne s'additionnent pas). La vitesse affichée est le gain réel, le seuil celui du tier entier (${esc(fmtRP(v.best.design.cap))}, au lieu de ${esc(fmtRP(t.cap))}).</p>`;
}

/** « Ajoute N stations aux tiennes » (S20). */
export function researchAddBlock(ctx: Pick<Ctx, "data">, v: ResearchView): string {
  const a = v.add;
  if (!a) return "";
  if ("reason" in a) return `<p class="hint">${esc(a.reason)}</p>`;
  const name = (id: string) => esc(itemN(ctx, id));
  const items = a.group.items.length ? ` avec ${a.group.items.map(name).join(" + ")}` : "";
  const kind = STATION_KIND[a.kind]!;
  const boost = a.after.boostRate > 0.005 ? ` (+ ${esc(fmt(a.after.boostRate, 2))} des paraboles)` : "";
  const feed = Object.keys(a.consumption).length ? ` ; à fournir en plus : ${Object.entries(a.consumption).map(([i, q]) => `${esc(fmt(q, 1))} ${name(i)}/min`).join(", ")}` : "";
  return `<p><b>+ ${a.added} ${esc(kind)}</b>${items} (comme les tiennes) → ${a.after.stations} stations au tier ${a.kind.slice(2)} : <b>${esc(fmt(a.after.stationsRate, 2))} RP/s</b>${boost}, seuil <b>${esc(fmtRP(a.after.cap))}</b> (au lieu de ${esc(fmtRP(a.before.cap))}). Stations : ${esc(fmtMoney(a.buildingCost))}${feed}.</p>
  <p class="hint">Le plus petit nombre de stations qui atteint la vitesse visée (${esc(fmt(v.targetRate + (v.currentRate ?? 0), 2))} RP/s) avec un seuil d'au moins ${esc(fmtRP(v.capNeeded))}.</p>`;
}

/** « Comment c'est calculé » : vitesse et seuil de mes stations. */
export function researchHowBlock(v: ResearchView): string {
  if (!v.model) return `<p class="hint">Ta production actuelle ne compte pas (option « Compter ma production actuelle de RP »), ou « Ma recherche » est vide dans Mon usine.</p>`;
  return researchHow(v.model);
}

/** Chronologie : quand chaque recherche visée est débloquée (avec l'installation, et au rythme actuel). */
export function researchTimeline(v: ResearchView, nodeName: (id: string) => string): string {
  const base = v.timeline ?? v.timelineNow;
  if (!base?.length) return "";
  const col = (list: TimelineEntry[] | null | undefined) => {
    if (!list) return null;
    const m = new Map(list.map((t) => [t.node, t.at]));
    return (id: string) => `<td class="num">${m.has(id) ? esc(fmtDuration(m.get(id)!)) : "—"}</td>`;
  };
  const now = col(v.timelineNow);
  const add = v.add && "added" in v.add ? col(v.add.timeline) : null;
  const inst = col(v.timeline);
  const cap = v.model ? Math.min(...v.model.tiers.map((t) => t.cap)) : null;
  const tag = (t: TimelineEntry) =>
    cap !== null ? (t.rp > cap ? ` <span class="tag warn">au-delà de ton seuil</span>` : "") : t.overCap ? ` <span class="tag warn">au-delà du plafond</span>` : "";
  const rows = base
    .map((t) => `<tr><td>${esc(nodeName(t.node))}${tag(t)}</td><td class="num">${esc(fmtRP(t.rp))}</td>${now ? now(t.node) : ""}${add ? add(t.node) : ""}${inst ? inst(t.node) : ""}</tr>`)
    .join("");
  const addHead = v.add && "added" in v.add ? `<th>+ ${v.add.added} station${v.add.added > 1 ? "s" : ""} aux tiennes</th>` : "";
  const capText =
    cap !== null && Number.isFinite(cap)
      ? ` À ton rythme, la vitesse baisse au-delà de ton seuil (${esc(fmtRP(cap))}) : dépense tes RP pour la retrouver.`
      : v.model?.source === "rps"
        ? " « À ton rythme actuel » compte en ligne droite : recopie ton seuil dans Mon usine (Ma recherche)."
        : "";
  return `<div class="tablewrap"><table class="mini"><thead><tr><th>Recherche</th><th>RP</th>${now ? "<th>À ton rythme actuel</th>" : ""}${addHead}${inst ? "<th>Avec l'installation neuve</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Depuis tes RP actuels, en <b>temps de jeu</b> (les RP ne montent que quand tu es connecté) ; chaque déblocage dépense son coût. Au-delà du seuil, la vitesse chute.${capText}</p>`;
}

/** Autres installations comparées. */
export function researchAlternatives(ctx: Pick<Ctx, "data">, v: ResearchView): string {
  if (!v.others.length) return "";
  return `<ul class="notes">${v.others
    .map((o) => `<li>${designLine(ctx, o)} — ${fmt(o.design.rate, 1)} RP/s, plafond ${esc(fmtRP(o.design.cap))}, ${esc(fmtMoney(o.design.buildingCost + o.plan.totals.buildCost))}</li>`)
    .join("")}</ul>`;
}
