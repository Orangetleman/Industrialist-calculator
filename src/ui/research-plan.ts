// Objectif « Gagner des RP » : installation proposée, chronologie de déblocage, autres options.
// Fonctions pures (chaînes HTML) ; la chaîne qui produit les items des stations est rendue comme
// les autres plans (plan-view.ts).

import type { AddProposal, RpModel } from "../engine/research-balance.ts";
import type { RpCandidate, RpResult, StationKind, TimelineEntry } from "../engine/research-points.ts";
import { esc, fmt, fmtDuration, fmtMoney, fmtRP, frText } from "./format.ts";
import { t } from "../i18n/i18n.ts";
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

export const STATION_KIND: Record<string, string> = { rs1: "Research Station 1", rs2: "Research Station 2", rs3: "Research Station 3", rs4: "Research Station 3 + Research Station 4" };

/** « 4 × Research Station2 · Gear · contrôleur de paraboles ». */
export function designLine(ctx: Pick<Ctx, "data">, c: RpCandidate): string {
  const d = c.design;
  const items = d.items.length ? ` · ${d.items.map((i) => esc(itemN(ctx, i))).join(" + ")}` : "";
  const sat = d.satellites ? t("rp.dishCtrl", { n: d.satellites.controllers }) : "";
  return `${d.stations} × ${esc(STATION_KIND[d.kind]!)}${items}${d.logic ? t("rp.logic") : ""}${sat}`;
}

/** Explication de l'installation : d'où viennent les RP/s, ce qu'il faut fournir. */
export function researchExplain(ctx: Pick<Ctx, "data">, c: RpCandidate): string {
  const d = c.design;
  const name = (id: string) => esc(itemN(ctx, id));
  const parts: string[] = [t("rp.setup.html", { line: designLine(ctx, c) })];
  parts.push(
    t("rp.speed", { base: fmt(d.baseRate, 2), boost: d.boostRate ? t("rp.speed.boost", { x: fmt(d.boostRate, 2) }) : "", circuit: d.circuitRate ? t("rp.speed.circuit", { x: fmt(d.circuitRate, 2) }) : "" }),
  );
  if (Object.keys(d.consumption).length) parts.push(t("rp.feed", { list: Object.entries(d.consumption).map(([i, q]) => `${fmt(q, 2)} ${name(i)}/min`).join(", ") }));
  if (d.satellites) {
    parts.push(
      t("rp.dishes", { c: String(d.satellites.controllers), fluid: name(d.satellites.fluid), v: fmt(d.satellites.fluidValue, 2), d: String(d.satellites.dishes) }),
    );
  }
  if (d.kind === "rs4") parts.push(t("rp.rs4"));
  return `<p>${parts.join(" ")}</p>`;
}

/** L'installation neuve s'ajoute à mes stations du même tier : la vitesse affichée est le gain. */
export function researchMergeNote(v: ResearchView): string {
  const tier = v.mergedTier ? v.model?.tiers.find((x) => x.kind === v.mergedTier) : null;
  if (!tier || !v.best) return "";
  return `<p class="hint">${t("rp.merge", { n: tier.stations !== null ? `${tier.stations} ` : "", tier: tier.kind.slice(2), cap: esc(fmtRP(v.best.design.cap)), before: esc(fmtRP(tier.cap)) })}</p>`;
}

/** « Ajoute N stations aux tiennes » (S20). */
export function researchAddBlock(ctx: Pick<Ctx, "data">, v: ResearchView): string {
  const a = v.add;
  if (!a) return "";
  if ("reason" in a) return `<p class="hint">${frText(a.reason)}</p>`;
  const name = (id: string) => esc(itemN(ctx, id));
  const items = a.group.items.length ? t("rp.add.with", { list: a.group.items.map(name).join(" + ") }) : "";
  const kind = STATION_KIND[a.kind]!;
  const boost = a.after.boostRate > 0.005 ? t("rp.add.boost", { x: esc(fmt(a.after.boostRate, 2)) }) : "";
  const feed = Object.keys(a.consumption).length ? t("rp.add.feed", { list: Object.entries(a.consumption).map(([i, q]) => `${esc(fmt(q, 1))} ${name(i)}/min`).join(", ") }) : "";
  return `<p>${t("rp.add.html", { n: String(a.added), kind: esc(kind), items, total: String(a.after.stations), tier: a.kind.slice(2), rate: esc(fmt(a.after.stationsRate, 2)), boost, cap: esc(fmtRP(a.after.cap)), before: esc(fmtRP(a.before.cap)), cost: esc(fmtMoney(a.buildingCost)), feed })}</p>
  <p class="hint">${t("rp.add.hint", { rate: esc(fmt(v.targetRate + (v.currentRate ?? 0), 2)), cap: esc(fmtRP(v.capNeeded)) })}</p>`;
}

/** « Comment c'est calculé » : vitesse et seuil de mes stations. */
export function researchHowBlock(v: ResearchView): string {
  if (!v.model) return `<p class="hint">${t("rp.how.none")}</p>`;
  return researchHow(v.model);
}

/** Chronologie : quand chaque recherche visée est débloquée (avec l'installation, et au rythme actuel). */
export function researchTimeline(v: ResearchView, nodeName: (id: string) => string): string {
  const base = v.timeline ?? v.timelineNow;
  if (!base?.length) return "";
  const col = (list: TimelineEntry[] | null | undefined) => {
    if (!list) return null;
    const m = new Map(list.map((x) => [x.node, x.at]));
    return (id: string) => `<td class="num">${m.has(id) ? esc(fmtDuration(m.get(id)!)) : "—"}</td>`;
  };
  const now = col(v.timelineNow);
  const add = v.add && "added" in v.add ? col(v.add.timeline) : null;
  const inst = col(v.timeline);
  const cap = v.model ? Math.min(...v.model.tiers.map((x) => x.cap)) : null;
  const tag = (e: TimelineEntry) =>
    cap !== null ? (e.rp > cap ? ` <span class="tag warn">${t("rp.overThreshold")}</span>` : "") : e.overCap ? ` <span class="tag warn">${t("rp.overCap")}</span>` : "";
  const rows = base
    .map((e) => `<tr><td>${esc(nodeName(e.node))}${tag(e)}</td><td class="num">${esc(fmtRP(e.rp))}</td>${now ? now(e.node) : ""}${add ? add(e.node) : ""}${inst ? inst(e.node) : ""}</tr>`)
    .join("");
  const addHead = v.add && "added" in v.add ? `<th>${t("rp.addCol", { n: v.add.added })}</th>` : "";
  const capText =
    cap !== null && Number.isFinite(cap)
      ? t("rp.cap.text", { cap: esc(fmtRP(cap)) })
      : v.model?.source === "rps"
        ? t("rp.cap.rps")
        : "";
  return `<div class="tablewrap"><table class="mini"><thead><tr><th>${t("rp.col.research")}</th><th>RP</th>${now ? `<th>${t("rp.col.now")}</th>` : ""}${addHead}${inst ? `<th>${t("rp.col.new")}</th>` : ""}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">${t("rp.timeline.hint.html", { cap: capText })}</p>`;
}

/** Autres installations comparées. */
export function researchAlternatives(ctx: Pick<Ctx, "data">, v: ResearchView): string {
  if (!v.others.length) return "";
  return `<ul class="notes">${v.others
    .map((o) => `<li>${t("rp.alt", { line: designLine(ctx, o), rate: fmt(o.design.rate, 1), cap: esc(fmtRP(o.design.cap)), cost: esc(fmtMoney(o.design.buildingCost + o.plan.totals.buildCost)) })}</li>`)
    .join("")}</ul>`;
}
