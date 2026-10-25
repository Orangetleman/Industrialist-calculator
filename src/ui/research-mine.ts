// « Mon usine » › « Ma recherche » (lot S20) : saisie (rapide : le panneau ; détaillé : les stations)
// et ce qu'en tire le site (RP estimés, seuil, vitesse réelle, contrôles « comme en jeu »).
// Fonctions pures : chaînes HTML.

import type { GameData } from "../engine/data.ts";
import { itemsPerStation, nearlyZero, nominalRate, rateAt, TIERS, timeToReach, type ResearchSetup, type RpModel, type RpTier } from "../engine/research-balance.ts";
import type { StationKind } from "../engine/research-points.ts";
import { esc, fmt, fmtDate, fmtDuration, fmtPct, fmtRP, frText } from "./format.ts";
import { lang, t } from "../i18n/i18n.ts";

const TIER_N: Record<StationKind, string> = { rs1: "1", rs2: "2", rs3: "3", rs4: "4" };
const STATION_N: Record<StationKind, string> = { rs1: "Research Station 1", rs2: "Research Station 2", rs3: "Research Station 3", rs4: "Research Station 3 + Research Station 4" };

/** Étiquette « supposé », avec le relevé qui le confirmera. */
/** « supposé » : pas encore confirmé en jeu ; la référence de la question (data/a-verifier.md) reste dans `data-ref`, pas à l'écran (S29). */
export const assumed = (ref: string) => `<span class="supp" data-ref="${esc(ref)}" title="${esc(t("rm.assumed.title"))}">${t("rm.assumed")}</span>`;

/** Nombre dans une case, avec la virgule décimale en français. */
const val = (x: number | null) => (x === null ? "" : lang() === "fr" ? String(x).replace(".", ",") : String(x));
const input = (attr: string, v: number | null, cls = "", ph = "—") => `<input ${attr} inputmode="decimal" autocomplete="off" class="${cls}" value="${esc(val(v))}" placeholder="${esc(ph)}">`;

/** Le formulaire (sans les champs RP et RP/s, qui restent dans la page). */
export function renderResearchForm(data: GameData, s: ResearchSetup): string {
  const itemName = (id: string) => data.items.get(id)?.name ?? id;
  const panel = `<div class="tw"><table class="rp-panel">
    <caption class="hint">${t(s.mode === "detaille" ? "rm.cap.detail" : "rm.cap.quick")}</caption>
    <thead><tr><th>${t("rm.th.line")}</th><th>${t("rm.th.stations")}</th><th>RP/s</th><th>${t("rm.th.cap")}</th></tr></thead><tbody>
    ${TIERS.map((k) => {
      const r = s.panel[k];
      const on = (r.rate ?? 0) > 0 || (r.stations ?? 0) > 0;
      const n = TIER_N[k];
      return `<tr class="${on ? "" : "off"}"><td>${on ? `<b>${t("rm.tier", { n })}</b>` : t("rm.tier", { n })}</td><td>${input(`data-rsp="${k}:stations" aria-label="${esc(t("rm.tier.stations", { n }))}"`, r.stations, "s", "0")}</td><td>${input(
        `data-rsp="${k}:rate" aria-label="${esc(t("rm.tier.rate", { n }))}"`,
        r.rate,
      )}</td><td>${input(`data-rsp="${k}:cap" aria-label="${esc(t("rm.tier.cap", { n }))}"`, r.cap)}</td></tr>`;
    }).join("")}
    <tr><td>${t("rm.dishes.row")}</td><td>${input(`data-rsd="controllers" aria-label="${esc(t("rm.dishes.ctrl.aria"))}"`, s.dish.controllers, "s", "0")} ${t("rm.controllers")}</td><td>${input(`data-rsd="rate" aria-label="${esc(t("rm.dishes.rate.aria"))}"`, s.dish.rate)}</td><td>${input(
      `data-rsd="dishes" aria-label="${esc(t("rm.dishes.n.aria"))}"`,
      s.dish.dishes,
      "s",
      "0",
    )} ${t("rm.dishes")} · ${input(`data-rsd="efficiency" aria-label="${esc(t("rm.dishes.eff.aria"))}"`, s.dish.efficiency, "s", "%")} %</td></tr>
    <tr><td>Max RP before RP/s is nearly zero</td><td colspan="3">${input(`data-rsmax aria-label="Max RP before RP/s is nearly zero"`, s.maxRp, "", t("rm.maxRp.ph"))}</td></tr>
    </tbody></table></div>`;
  if (s.mode !== "detaille") return panel;

  const groups = TIERS.map((k) => {
    const n = itemsPerStation(k);
    const rows = s.groups[k]
      .map(
        (g, i) => `<div class="grp"><span class="grp-t">${t("rm.tier", { n: TIER_N[k] })}</span> ${input(`data-rsg="${k}:${i}:count" aria-label="${esc(t("rm.grp.count"))}"`, g.count, "n", "0")} × ${esc(STATION_N[k])}${
          n
            ? ` ${t("rm.grp.with")} ${Array.from({ length: n }, (_, j) => `<input data-rsg="${k}:${i}:item${j}" list="item-list" autocomplete="off" spellcheck="false" class="i" aria-label="${esc(t("rm.grp.item", { n: String(j + 1) }))}" value="${esc(g.items[j] ? itemName(g.items[j]!) : "")}" placeholder="${esc(t("rm.grp.item.ph"))}">`).join(" + ")}`
            : ""
        }${k === "rs4" ? ` <label><input type="checkbox" data-rsg="${k}:${i}:logic"${g.logic ? " checked" : ""}> ${t("rm.grp.logic")}</label>` : ""} <button type="button" class="link small" data-rsg-del="${k}:${i}" aria-label="${esc(t("rm.grp.del"))}">✕</button></div>`,
      )
      .join("");
    return `${rows}`;
  }).join("");
  const ctrl = s.controllers
    .map(
      (c, i) => `<div class="grp">${input(`data-rsc="${i}:count" aria-label="${esc(t("rm.ctrl.count"))}"`, c.count, "n", "0")} × Satellite Dish Controller ${t("rm.grp.with")} <input data-rsc="${i}:fluid" list="item-list" autocomplete="off" spellcheck="false" class="i" aria-label="${esc(t("rm.ctrl.fluid"))}" value="${esc(c.fluid ? itemName(c.fluid) : "")}" placeholder="${esc(t("rm.ctrl.fluid.ph"))}"> <button type="button" class="link small" data-rsc-del="${i}" aria-label="${esc(t("rm.grp.del"))}">✕</button></div>`,
    )
    .join("");
  return `<h3>${t("rm.stations.title.html")}</h3>
    ${groups || `<p class="hint">${t("rm.stations.none")}</p>`}
    <div class="grp"><label>${t("rm.grp.add")} <select data-rsg-add aria-label="${esc(t("rm.grp.tier"))}">${TIERS.map((k) => `<option value="${k}"${k === "rs3" ? " selected" : ""}>${t("rm.tier", { n: TIER_N[k] })} (${esc(STATION_N[k])})</option>`).join("")}</select></label> <button type="button" class="small" data-rsg-addbtn>${t("rm.add")}</button></div>
    <h3>${t("rm.myDishes")}</h3>
    ${ctrl}
    <div class="grp"><button type="button" class="small" data-rsc-add>${t("rm.ctrl.add")}</button> <span class="hint">${t("rm.ctrl.hint")}</span></div>
    ${panel}`;
}

export type ResearchOutArgs = {
  model: RpModel;
  /**
   * Départ de la courbe actuelle (dernier relevé, dépense ou changement de configuration) : RP et
   * temps de jeu (ms) ; RP estimés maintenant ; temps de jeu actuel (S21 : tout compte en temps de jeu).
   */
  rp0: number | null;
  rpAt: number | null;
  rpNow: number | null;
  now: number;
  /** En jeu : les heures réelles se déduisent (« si tu continues ») ; hors jeu, rien ne bouge. */
  playing: boolean;
  realNow: number;
  /** Ce que le site aurait compté en ligne droite (avant S20). */
  linearNow: number | null;
  /** Moment (temps de jeu) où le seuil a été franchi, retrouvé dans l'historique ; null : inconnu. */
  overSince?: number | null;
  /** Ajouter « Comment c'est calculé » (sinon, la page l'affiche à part). */
  how?: boolean;
  /** Tableau des seuils déplié (le joueur l'a ouvert avant le rafraîchissement). */
  stepsOpen?: boolean;
};

const clock = (ms: number) => fmtDate(ms, { weekday: "short", hour: "2-digit", minute: "2-digit" });
/** Heure réelle d'un instant de jeu à venir : seulement en jeu (« si tu continues »). */
const realAt = (a: ResearchOutArgs, g: number) => (a.playing ? t("rm.ifContinue", { t: clock(a.realNow + (g - a.now)) }) : "");

/** RP estimés, seuil, vitesse réelle, contrôles et « Comment c'est calculé ». */
export function renderResearchOut(a: ResearchOutArgs): string {
  const m = a.model;
  const out: string[] = [];
  if (m.checks.length) {
    out.push(
      `<ul class="rs-checks">${m.checks
        .map((c) =>
          c.ok
            ? `<li class="okc">${t("rm.check.ok", { label: frText(c.label), x: esc(fmt(c.computed, c.digits)) })}</li>`
            : `<li class="warn-text">${t("rm.check.bad", { label: frText(c.label), a: esc(fmt(c.computed, c.digits)), b: esc(fmt(c.panel, c.digits)), d: esc(fmtPct(fmt(((c.computed - c.panel) / c.panel) * 100, 1))) })}</li>`,
        )
        .join("")}</ul>`,
    );
  }
  if (m.source === "aucune" || a.rp0 === null) {
    out.push(`<p class="hint">${t("rm.empty")}</p>`);
    return out.join("");
  }
  const tiers: RpTier[] = m.tiers;
  const nominal = nominalRate(tiers);
  const rpNow = a.rpNow ?? a.rp0;
  const real = rateAt(tiers, rpNow);
  const finite = tiers.filter((x) => Number.isFinite(x.cap));
  const minCap = finite.length ? Math.min(...finite.map((x) => x.cap)) : null;
  const pct = nominal > 0 ? (real / nominal) * 100 : 100;
  const over = minCap !== null && rpNow > minCap;
  const t0 = a.rpAt ?? a.now;
  const lines: string[] = [`<p class="big">${t("rm.now.html", { rp: esc(fmtRP(rpNow)), rate: esc(fmt(real, 2)), pct: pct < 99.95 ? t("rm.now.pct", { p: esc(fmtPct(fmt(pct, pct < 10 ? 1 : 0))), nominal: esc(fmt(nominal, 2)) }) : "" })}</p>`];
  if (m.source === "rps") {
    lines.push(`<p>${t("rm.noCap.rps.html")}</p>`);
  } else if (minCap === null) {
    lines.push(`<p>${t("rm.noCap")}</p>`);
  } else if (over) {
    const since = a.overSince !== undefined ? a.overSince : a.rp0 >= minCap ? null : t0 + timeToReach(tiers, a.rp0, minCap) * 1000;
    lines.push(
      `<p>${t("rm.over.html", { since: since !== null ? t("rm.over.since", { t: esc(fmtDuration((a.now - since) / 1000)) }) : t("rm.over.before") })}</p>`,
    );
  } else {
    const at = t0 + timeToReach(tiers, a.rp0, minCap) * 1000;
    lines.push(`<p>${t("rm.reach.html", { cap: esc(fmtRP(minCap)), t: esc(fmtDuration((at - a.now) / 1000)), real: esc(realAt(a, at)) })}</p>`);
  }
  out.push(`<div class="rs-est${over ? " over" : ""}">${lines.join("")}</div>`);

  if (minCap !== null && m.source !== "rps") {
    const rows: { label: string; rp: number }[] = [];
    for (const x of finite) rows.push({ label: finite.length > 1 ? t("rm.step.tier", { n: TIER_N[x.kind], rp: fmtRP(x.cap) }) : t("rm.step.eff", { rp: fmtRP(x.cap) }), rp: x.cap });
    rows.push({ label: t("rm.step.x", { k: fmt(1.3, 1), rp: fmtRP(1.3 * minCap) }), rp: 1.3 * minCap });
    rows.push({ label: t("rm.step.x", { k: "2", rp: fmtRP(2 * minCap) }), rp: 2 * minCap });
    const nz = nearlyZero(tiers);
    if (nz !== null) rows.push({ label: t("rm.step.max", { rp: fmtRP(nz) }), rp: nz });
    rows.sort((x, y) => x.rp - y.rp);
    const when = (rp: number) => {
      if (rp <= a.rp0!) return t("rm.when.past");
      const at = t0 + timeToReach(tiers, a.rp0!, rp) * 1000;
      return at <= a.now ? t("rm.when.ago", { t: fmtDuration((a.now - at) / 1000) }) : t("rm.when.in", { t: fmtDuration((at - a.now) / 1000), real: realAt(a, at) });
    };
    const lin = a.linearNow !== null && a.linearNow > rpNow * 1.01 ? esc(t("rm.linear", { rp: fmtRP(a.linearNow) })) : "";
    // S29 : replié (Mon usine tient en moins de 2 000 px au téléphone) ; `stepsOpen` garde le dépliage au rafraîchissement.
    out.push(`<details class="more rs-steps-d"${a.stepsOpen ? " open" : ""}><summary>${t("rm.steps")}</summary><div class="tw"><table class="mini rs-steps"><thead><tr><th>${t("rm.th.balance")}</th><th>${t("rm.th.reached")}</th><th>${t("rm.th.rate")}</th></tr></thead><tbody>${rows
      .map((r) => {
        const v = rateAt(tiers, r.rp);
        return `<tr><td>${esc(r.label)}</td><td class="num">${esc(when(r.rp))}</td><td class="num">${esc(fmt(v, 2))} RP/s (${esc(fmtPct(fmt((v / nominal) * 100, 0)))})</td></tr>`;
      })
      .join("")}</tbody></table></div><p class="hint">${t("rm.noSpend", { lin })}</p></details>`);
  }
  if (a.how !== false) out.push(`<details class="more"><summary>${t("cv.title")}</summary>${researchHow(m)}</details>`);
  return out.join("");
}

/** « Comment c'est calculé » : vitesse et seuil (Mon usine et objectif recherche). */
export function researchHow(m: RpModel): string {
  const rows: string[] = [];
  const row = (th: string, f: string, src: string) => rows.push(`<tr><th>${th}</th><td class="f">${f}</td><td class="s">${src}</td></tr>`);
  if (m.source === "rps") {
    row(t("rm.how.rate"), `${esc(fmt(m.tiers[0]?.rate ?? 0, 2))} RP/s`, t("rm.how.rps.src"));
    return `<table class="calc-t">${rows.join("")}</table>`;
  }
  const sep = lang() === "fr" ? " ; " : "; ";
  for (const x of m.tiers) {
    const n = TIER_N[x.kind];
    if (m.source === "stations") {
      row(
        t("rm.how.tierRate", { n }),
        x.kind === "rs1" ? `√${esc(fmt(x.sum.value, 0))} = ${esc(fmt(x.stationsRate, 2))} RP/s` : `V = ${esc(fmt(x.sum.value, 2))}${sep}2 × V^${fmt(0.6, 1)} = ${esc(fmt(x.stationsRate, 2))} RP/s`,
        x.kind === "rs1" ? t("rm.how.rs1.src") : t("rm.how.v.src"),
      );
      row(
        t("rm.how.tierCap", { n }),
        x.kind === "rs1" || x.kind === "rs2"
          ? `${x.kind === "rs1" ? "200" : fmt(2000, 0)} × log₂(${esc(fmt(x.sum.factor, 0))} + 1) = ${esc(fmtRP(x.cap))}`
          : `C = ${esc(fmt(x.sum.factor, 3))}${sep}${x.kind === "rs3" ? `${fmt(16500, 0)} × (log₂(C + 1) + √C)` : `${fmt(150000, 0)} × (log₂(C + 1) + C^${fmt(0.9, 1)})`} = ${esc(fmtRP(x.cap))}`,
        x.kind === "rs3" || x.kind === "rs4" ? t("rm.how.c.src", { a: assumed("RP-11") }) : t("rm.how.cap.src"),
      );
      if (x.circuits) row(t("rm.how.circuits", { n }), t("rm.how.circuits.f", { x: esc(fmt(x.circuits, 2)) }), t("rm.how.circuits.src", { a: assumed("RP-09") }));
    } else {
      row(t("rm.tier", { n }), t("rm.how.panel.f", { rate: esc(fmt(x.stationsRate, 2)), cap: x.capMissing ? t("rm.how.notEntered") : esc(fmtRP(x.cap)) }), t("rm.how.panel.src"));
    }
  }
  if (m.boost > 0) {
    const dish = m.tiers.reduce((a, x) => a + x.boostRate, 0);
    row(
      t("rm.how.dishes"),
      m.source === "stations"
        ? `B × ${fmt(0.78, 2)} × log₁₀(${esc(fmt(m.liquids ?? 0, 2))} + 1)${m.efficiency < 1 ? ` × ${esc(fmtPct(fmt(m.efficiency * 100, 0)))}` : ""} = ${esc(fmt(dish, 2))} RP/s`
        : t("rm.how.dishes.panel", { x: esc(fmt(dish, 2)), p: esc(fmtPct(fmt(m.boost * 100, 1))) }),
      `${m.source === "stations" ? t("rm.how.dishes.src", { n: m.dishesFor100 !== null ? t("rm.how.dishes.n", { n: String(m.dishesFor100) }) : "", a: assumed("RP-12") }) : ""}${t("rm.how.dishes.split", { a: assumed("RP-04") })}`,
    );
  }
  row(t("rm.how.past"), t("rm.how.past.f"), t("rm.how.past.src"));
  row(t("rm.how.balance"), t("rm.how.balance.f"), t("rm.how.balance.src"));
  row(t("rm.how.perTier"), t("rm.how.perTier.f"), assumed("RP-05"));
  row(t("rm.how.max"), t("rm.how.max.f"), t("rm.how.max.src", { a: assumed("RP-06") }));
  row(t("rm.how.spend"), t("rm.how.spend.f"), assumed("RP-08"));
  return `<table class="calc-t">${rows.join("")}</table>`;
}
