// « Mon usine » › « Ma recherche » (lot S20, refait en S49) : saisie par tier (stations et items),
// paraboles, panneau recopié en option
// et ce qu'en tire le site (RP estimés, seuil, vitesse réelle, contrôles « comme en jeu »).
// Fonctions pures : chaînes HTML.

import type { GameData } from "../engine/data.ts";
import { itemsPerStation, nearlyZero, nominalRate, rateAt, TIERS, timeToReach, type ResearchSetup, type RpModel, type RpTier } from "../engine/research-balance.ts";
import type { StationKind } from "../engine/research-points.ts";
import { esc, fmt, fmtDate, fmtDuration, fmtPct, fmtRP } from "./format.ts";
import { icon, withIcons } from "./icons.ts";
import { lang, t } from "../i18n/i18n.ts";
import { txtHtml } from "./engine-text.ts";

const TIER_N: Record<StationKind, string> = { rs1: "1", rs2: "2", rs3: "3", rs4: "4" };
const STATION_N: Record<StationKind, string> = { rs1: "Research Station 1", rs2: "Research Station 2", rs3: "Research Station 3", rs4: "Research Station 3 + Research Station 4" };

/** Étiquette « supposé », avec le relevé qui le confirmera. */
/** « supposé » : pas encore confirmé en jeu ; la référence de la question (data/a-verifier.md) reste dans `data-ref`, pas à l'écran (S29). */
export const assumed = (ref: string) => `<span class="supp" data-ref="${esc(ref)}" title="${esc(t("rm.assumed.title"))}">${t("rm.assumed")}</span>`;

/** Nombre dans une case, avec la virgule décimale en français. */
const val = (x: number | null) => (x === null ? "" : lang() === "fr" ? String(x).replace(".", ",") : String(x));
const input = (attr: string, v: number | null, cls = "", ph = "—") => `<input ${attr} inputmode="decimal" autocomplete="off" class="${cls}" value="${esc(val(v))}" placeholder="${esc(ph)}">`;

/** Une étiquette de source (S47) : « wiki », ou ce qui vient d'Industrialist Calculator (à vérifier). */
const src = (ic = false) => `<span class="rs-src${ic ? " ic" : ""}">${t(ic ? "rm.src.ic" : "rm.src.wiki")}</span>`;

/** Le tableau du Research Tracking Panel, recopié pour comparer (ou seul, si les stations ne sont pas décrites). */
function panelTable(s: ResearchSetup): string {
  return `<div class="tw"><table class="rp-panel">
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
      `data-rsd="efficiency" aria-label="${esc(t("rm.dishes.eff.aria"))}"`,
      s.dish.efficiency,
      "s",
      "%",
    )} %</td></tr>
    <tr><td>Max RP before RP/s is nearly zero</td><td colspan="3">${input(`data-rsmax aria-label="Max RP before RP/s is nearly zero"`, s.maxRp, "", t("rm.maxRp.ph"))}</td></tr>
    </tbody></table></div>`;
}

/**
 * Le formulaire (S49, maquette S47) : un bloc par tier, chaque groupe = nombre de stations identiques
 * + items entrés par station ; paraboles ; le panneau recopié, replié et facultatif. Les cases
 * calculées (`data-rs-rate`, `data-rs-cap`, `#rs-dish-eff`) sont remplies par `fillResearchCalc`.
 */
export function renderResearchForm(data: GameData, s: ResearchSetup, panelOpen = false): string {
  const itemName = (id: string) => data.items.get(id)?.name ?? id;
  const itemInput = (attr: string, id: string | undefined, label: string, ph = t("rm.grp.item.ph")) =>
    `<input ${attr} list="item-list" autocomplete="off" spellcheck="false" class="i" aria-label="${esc(label)}" value="${esc(id ? itemName(id) : "")}" placeholder="${esc(ph)}">`;
  const rows = TIERS.map((k) => {
    const n = TIER_N[k];
    const per = itemsPerStation(k);
    const groups = s.groups[k];
    const span = Math.max(1, groups.length);
    const head = `<th scope="row" rowspan="${span}">${t("rm.tier", { n })}<span class="hint rs-st">${esc(STATION_N[k])}</span></th>`;
    const calc = `<td class="num" rowspan="${span}" data-rs-rate="${k}">—</td><td class="num" rowspan="${span}" data-rs-cap="${k}">—</td><td rowspan="${span}">${src()}</td>`;
    if (!groups.length) {
      // Pas encore de groupe : la case « Stations » le crée à la première frappe.
      return `<tr class="off">${head}<td>${input(`data-rsg-new="${k}" aria-label="${esc(t("rm.tier.stations", { n }))}"`, null, "n", "0")}</td><td class="hint">${per ? t("rm.items.later") : t("rm.items.none")}</td>${calc}</tr>`;
    }
    return groups
      .map((g, i) => {
        const items = per
          ? Array.from({ length: per }, (_, j) => itemInput(`data-rsg="${k}:${i}:item${j}"`, g.items[j], t("rm.grp.item", { n: String(j + 1) }))).join(" + ")
          : `<span class="hint">${t("rm.items.none")}</span>`;
        const logic = k === "rs4" ? ` <label class="rs-logic"><input type="checkbox" data-rsg="${k}:${i}:logic"${g.logic ? " checked" : ""}> ${t("rm.grp.logic")}</label>` : "";
        const del = `<button type="button" class="link small" data-rsg-del="${k}:${i}" aria-label="${esc(t("rm.grp.del"))}" title="${esc(t("rm.grp.del"))}">${icon("close")}</button>`;
        return `<tr>${i === 0 ? head : ""}<td>${input(`data-rsg="${k}:${i}:count" aria-label="${esc(t("rm.grp.count"))}"`, g.count, "n", "0")}</td><td>${items}${logic} ${del}</td>${i === 0 ? calc : ""}</tr>`;
      })
      .join("");
  }).join("");
  const ctrl = s.controllers
    .map(
      (c, i) =>
        `<div class="grp">${input(`data-rsc="${i}:count" aria-label="${esc(t("rm.ctrl.count"))}"`, c.count, "n", "0")} × Satellite Dish Controller ${t("rm.grp.with")} ${itemInput(`data-rsc="${i}:fluid"`, c.fluid, t("rm.ctrl.fluid"), t("rm.ctrl.fluid.ph"))} <button type="button" class="link small" data-rsc-del="${i}" aria-label="${esc(t("rm.grp.del"))}" title="${esc(t("rm.grp.del"))}">${icon("close")}</button></div>`,
    )
    .join("");
  return `<h3>${t("rm.byTier")}</h3>
    <p class="hint">${t("rm.byTier.hint")}</p>
    <div class="tw"><table class="rp-tiers">
      <thead><tr><th>${t("rm.th.tier")}</th><th>${t("rm.th.stationsN")}</th><th>${t("rm.th.items")}</th><th>${t("rm.th.speed")}</th><th>${t("rm.th.capCalc")}</th><th>${t("rm.th.src")}</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="row rs-add"><label>${t("rm.grp.add")} <select data-rsg-add aria-label="${esc(t("rm.grp.tier"))}">${TIERS.map((k) => `<option value="${k}"${k === "rs3" ? " selected" : ""}>${t("rm.tier", { n: TIER_N[k] })}</option>`).join("")}</select></label> <button type="button" class="small" data-rsg-addbtn>${t("rm.grp.other")}</button></div>
    <h3>${t("rm.myDishes")}</h3>
    ${ctrl}
    <div class="row rs-add"><button type="button" class="small" data-rsc-add>${t("rm.ctrl.add")}</button>
      <label class="inline"><span>${t("rm.dishes.placed")}</span>${input(`data-rsd="dishes" aria-label="${esc(t("rm.dishes.n.aria"))}"`, s.dish.dishes, "s", "0")}</label></div>
    <p class="hint" id="rs-dish-eff"></p>
    <details class="more rs-panel-d"${panelOpen ? " open" : ""}><summary>${t("rm.panel.sum")}</summary><p class="hint">${t("rm.panel.hint")}</p>${panelTable(s)}</details>`;
}

/** Cases calculées du formulaire : vitesse et plafond de chaque tier, efficacité des paraboles. */
export function fillResearchCalc(root: ParentNode, m: RpModel): void {
  const fromStations = m.source === "stations";
  for (const k of TIERS) {
    const x = fromStations ? m.tiers.find((y) => y.kind === k) : undefined;
    const r = root.querySelector(`[data-rs-rate="${k}"]`);
    const c = root.querySelector(`[data-rs-cap="${k}"]`);
    if (r) r.textContent = x ? `${fmt(x.stationsRate, 2)} RP/s${x.circuits ? ` + ${fmt(x.circuits, 2)}` : ""}` : "—";
    if (c) c.textContent = x ? fmtRP(x.cap) : "—";
  }
  const eff = root.querySelector("#rs-dish-eff");
  if (eff) {
    const dish = m.tiers.reduce((a, x) => a + x.boostRate, 0);
    eff.innerHTML =
      fromStations && m.liquids !== null && m.dishesFor100 !== null
        ? `${t("rm.dish.calc", { n: String(m.dishesFor100), p: esc(fmtPct(fmt(m.efficiency * 100, 0))), x: esc(fmt(dish, 2)) })} ${src(true)}`
        : "";
  }
}

/**
 * Contrôle (S47, sous la saisie) : la 1ʳᵉ ligne du panneau recopiée contre ce que le site calcule
 * au même solde. Écart toléré : 2 % (critère de S20).
 */
export function renderResearchControl(m: RpModel, rp: number | null, rps: number | null): string {
  if (m.source !== "stations" || rp === null || rps === null || !(rps > 0)) return "";
  const calc = rateAt(m.tiers, rp);
  const gap = Math.abs(calc - rps) / rps;
  return gap <= 0.02
    ? `<div class="rs-chk">${withIcons(t("rm.ctl.ok.html", { x: esc(fmt(calc, 2)), d: esc(fmtPct(fmt(gap * 100, 1))) }))}</div>`
    : `<div class="rs-chk bad">${withIcons(t("rm.ctl.bad.html", { x: esc(fmt(calc, 2)), d: esc(fmtPct(fmt(gap * 100, 0))) }))}</div>`;
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
  // La 1ʳᵉ ligne du panneau a son propre bloc de contrôle quand les stations sont décrites (S49).
  const checks = m.source === "stations" ? m.checks.filter((c) => c.label.code !== "rs.check.first") : m.checks;
  if (checks.length) {
    out.push(
      `<ul class="rs-checks">${checks
        .map((c) =>
          c.ok
            ? `<li class="okc">${withIcons(t("rm.check.ok", { label: txtHtml(c.label), x: esc(fmt(c.computed, c.digits)) }))}</li>`
            : `<li class="warn-text">${withIcons(t("rm.check.bad", { label: txtHtml(c.label), a: esc(fmt(c.computed, c.digits)), b: esc(fmt(c.panel, c.digits)), d: esc(fmtPct(fmt(((c.computed - c.panel) / c.panel) * 100, 1))) }))}</li>`,
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
      `<p>${withIcons(t("rm.over.html", { since: since !== null ? t("rm.over.since", { t: esc(fmtDuration((a.now - since) / 1000)) }) : t("rm.over.before") }))}</p>`,
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
