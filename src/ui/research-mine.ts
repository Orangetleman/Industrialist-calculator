// « Mon usine » › « Ma recherche » (lot S20) : saisie (rapide : le panneau ; détaillé : les stations)
// et ce qu'en tire le site (RP estimés, seuil, vitesse réelle, contrôles « comme en jeu »).
// Fonctions pures : chaînes HTML.

import type { GameData } from "../engine/data.ts";
import { itemsPerStation, nearlyZero, nominalRate, rateAt, TIERS, timeToReach, type ResearchSetup, type RpModel, type RpTier } from "../engine/research-balance.ts";
import type { StationKind } from "../engine/research-points.ts";
import { esc, fmt, fmtDuration, fmtRP } from "./format.ts";

const TIER_N: Record<StationKind, string> = { rs1: "1", rs2: "2", rs3: "3", rs4: "4" };
const STATION_N: Record<StationKind, string> = { rs1: "Research Station1", rs2: "Research Station2", rs3: "Research Station3", rs4: "Research Station3 + Research Station4" };

/** Étiquette « supposé », avec le relevé qui le confirmera. */
export const assumed = (ref: string) => `<span class="supp" title="Pas encore confirmé en jeu : voir data/a-verifier.md">supposé (${esc(ref)})</span>`;

const val = (x: number | null) => (x === null ? "" : String(x).replace(".", ","));
const input = (attr: string, v: number | null, cls = "", ph = "—") => `<input ${attr} inputmode="decimal" autocomplete="off" class="${cls}" value="${esc(val(v))}" placeholder="${esc(ph)}">`;

/** Le formulaire (sans les champs RP et RP/s, qui restent dans la page). */
export function renderResearchForm(data: GameData, s: ResearchSetup): string {
  const itemName = (id: string) => data.items.get(id)?.name ?? id;
  const panel = `<div class="tw"><table class="rp-panel">
    <caption class="hint">${s.mode === "detaille" ? "Ce que le panneau affiche, pour comparer (facultatif)." : "Une ligne par tier, comme sur le panneau."}</caption>
    <thead><tr><th>Ligne du panneau</th><th>Stations actives</th><th>RP/s</th><th>Seuil d'efficacité (RP)</th></tr></thead><tbody>
    ${TIERS.map((k) => {
      const r = s.panel[k];
      const on = (r.rate ?? 0) > 0 || (r.stations ?? 0) > 0;
      return `<tr class="${on ? "" : "off"}"><td>${on ? `<b>Tier ${TIER_N[k]}</b>` : `Tier ${TIER_N[k]}`}</td><td>${input(`data-rsp="${k}:stations" aria-label="Tier ${TIER_N[k]} : stations actives"`, r.stations, "s", "0")}</td><td>${input(
        `data-rsp="${k}:rate" aria-label="Tier ${TIER_N[k]} : RP/s"`,
        r.rate,
      )}</td><td>${input(`data-rsp="${k}:cap" aria-label="Tier ${TIER_N[k]} : seuil d'efficacité"`, r.cap)}</td></tr>`;
    }).join("")}
    <tr><td>Paraboles (écran du bas)</td><td>${input(`data-rsd="controllers" aria-label="Contrôleurs de paraboles actifs"`, s.dish.controllers, "s", "0")} contrôleurs</td><td>${input(`data-rsd="rate" aria-label="RP/s des contrôleurs"`, s.dish.rate)}</td><td>${input(
      `data-rsd="dishes" aria-label="Paraboles alimentées"`,
      s.dish.dishes,
      "s",
      "0",
    )} paraboles · ${input(`data-rsd="efficiency" aria-label="Efficacité des paraboles (%)"`, s.dish.efficiency, "s", "%")} %</td></tr>
    <tr><td>Max RP before RP/s is nearly zero</td><td colspan="3">${input(`data-rsmax aria-label="Max RP before RP/s is nearly zero"`, s.maxRp, "", "ex. 231000")}</td></tr>
    </tbody></table></div>`;
  if (s.mode !== "detaille") return panel;

  const groups = TIERS.map((k) => {
    const n = itemsPerStation(k);
    const rows = s.groups[k]
      .map(
        (g, i) => `<div class="grp"><span class="grp-t">Tier ${TIER_N[k]}</span> ${input(`data-rsg="${k}:${i}:count" aria-label="Nombre de stations"`, g.count, "n", "0")} × ${esc(STATION_N[k])}${
          n
            ? ` avec ${Array.from({ length: n }, (_, j) => `<input data-rsg="${k}:${i}:item${j}" list="item-list" autocomplete="off" spellcheck="false" class="i" aria-label="Item ${j + 1}" value="${esc(g.items[j] ? itemName(g.items[j]!) : "")}" placeholder="item">`).join(" + ")}`
            : ""
        }${k === "rs4" ? ` <label><input type="checkbox" data-rsg="${k}:${i}:logic"${g.logic ? " checked" : ""}> mini-jeu Logic résolu</label>` : ""} <button type="button" class="link small" data-rsg-del="${k}:${i}" aria-label="Retirer ce groupe">✕</button></div>`,
      )
      .join("");
    return `${rows}`;
  }).join("");
  const ctrl = s.controllers
    .map(
      (c, i) => `<div class="grp">${input(`data-rsc="${i}:count" aria-label="Nombre de contrôleurs"`, c.count, "n", "0")} × Satellite Dish Controller avec <input data-rsc="${i}:fluid" list="item-list" autocomplete="off" spellcheck="false" class="i" aria-label="Liquide" value="${esc(c.fluid ? itemName(c.fluid) : "")}" placeholder="liquide"> <button type="button" class="link small" data-rsc-del="${i}" aria-label="Retirer ce groupe">✕</button></div>`,
    )
    .join("");
  return `<h3>Mes stations <span class="hint">(groupes de stations identiques)</span></h3>
    ${groups || `<p class="hint">Aucune station décrite.</p>`}
    <div class="grp"><label>Ajouter un groupe : <select data-rsg-add aria-label="Tier du groupe">${TIERS.map((k) => `<option value="${k}"${k === "rs3" ? " selected" : ""}>Tier ${TIER_N[k]} (${esc(STATION_N[k])})</option>`).join("")}</select></label> <button type="button" class="small" data-rsg-addbtn>+ Ajouter</button></div>
    <h3>Mes paraboles</h3>
    ${ctrl}
    <div class="grp"><button type="button" class="small" data-rsc-add>+ Contrôleurs de paraboles</button> <span class="hint">Paraboles alimentées et efficacité : dans le tableau ci-dessous.</span></div>
    ${panel}`;
}

export type ResearchOutArgs = {
  model: RpModel;
  /** RP et heure de la saisie, RP estimés maintenant. */
  rp0: number | null;
  rpAt: number | null;
  rpNow: number | null;
  now: number;
  /** Ce que le site aurait compté en ligne droite (avant S20). */
  linearNow: number | null;
};

const clock = (ms: number) => new Date(ms).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** RP estimés, seuil, vitesse réelle, contrôles et « Comment c'est calculé ». */
export function renderResearchOut(a: ResearchOutArgs): string {
  const m = a.model;
  const out: string[] = [];
  if (m.checks.length) {
    out.push(
      `<ul class="rs-checks">${m.checks
        .map((c) =>
          c.ok
            ? `<li class="okc">✓ comme en jeu : ${esc(c.label)} ${esc(fmt(c.computed, c.digits))}</li>`
            : `<li class="warn-text">⚠ ${esc(c.label)} : le site calcule ${esc(fmt(c.computed, c.digits))}, le panneau affiche ${esc(fmt(c.panel, c.digits))} (écart ${esc(fmt(((c.computed - c.panel) / c.panel) * 100, 1))} %)</li>`,
        )
        .join("")}</ul>`,
    );
  }
  if (m.source === "aucune" || a.rp0 === null) {
    out.push(`<p class="hint">Renseigne tes RP et ta production (1ʳᵉ ligne, puis une ligne par tier) : le site estime tes RP à tout moment, avec la baisse au-delà du seuil.</p>`);
    return out.join("");
  }
  const tiers: RpTier[] = m.tiers;
  const nominal = nominalRate(tiers);
  const rpNow = a.rpNow ?? a.rp0;
  const real = rateAt(tiers, rpNow);
  const finite = tiers.filter((t) => Number.isFinite(t.cap));
  const minCap = finite.length ? Math.min(...finite.map((t) => t.cap)) : null;
  const pct = nominal > 0 ? (real / nominal) * 100 : 100;
  const over = minCap !== null && rpNow > minCap;
  const t0 = a.rpAt ?? a.now;
  const lines: string[] = [`<p class="big">≈ <b>${esc(fmtRP(rpNow))}</b> maintenant · vitesse réelle <b>${esc(fmt(real, 2))} RP/s</b>${pct < 99.95 ? ` (${esc(fmt(pct, pct < 10 ? 1 : 0))} % de ${esc(fmt(nominal, 2))})` : ""}</p>`];
  if (m.source === "rps") {
    lines.push(`<p>Sans seuil, le site compte en <b>ligne droite</b>. Recopie le seuil de chaque tier ci-dessus : au-delà, la vitesse baisse.</p>`);
  } else if (minCap === null) {
    lines.push(`<p>Seuil non renseigné : le site compte en ligne droite. Recopie-le dans le tableau.</p>`);
  } else if (over) {
    const since = a.rp0 >= minCap ? null : t0 + timeToReach(tiers, a.rp0, minCap) * 1000;
    lines.push(
      `<p>⚠ <b>Seuil dépassé${since !== null ? ` depuis ${esc(fmtDuration((a.now - since) / 1000))}` : " (déjà à la saisie)"}</b>. Au-delà, la vitesse baisse : <b>dépense tes RP</b> pour la retrouver.</p>`,
    );
  } else {
    const at = t0 + timeToReach(tiers, a.rp0, minCap) * 1000;
    lines.push(`<p>Seuil (${esc(fmtRP(minCap))}) atteint dans <b>${esc(fmtDuration((at - a.now) / 1000))}</b> (${esc(clock(at))}). Au-delà, la vitesse baisse : dépense tes RP avant.</p>`);
  }
  out.push(`<div class="rs-est${over ? " over" : ""}">${lines.join("")}</div>`);

  if (minCap !== null && m.source !== "rps") {
    const rows: { label: string; rp: number }[] = [];
    for (const t of finite) rows.push({ label: `Seuil ${finite.length > 1 ? `du tier ${TIER_N[t.kind]} ` : "d'efficacité "}: ${fmtRP(t.cap)}`, rp: t.cap });
    rows.push({ label: `1,3 × seuil : ${fmtRP(1.3 * minCap)}`, rp: 1.3 * minCap });
    rows.push({ label: `2 × seuil : ${fmtRP(2 * minCap)}`, rp: 2 * minCap });
    const nz = nearlyZero(tiers);
    if (nz !== null) rows.push({ label: `« Max RP » : ${fmtRP(nz)}`, rp: nz });
    rows.sort((x, y) => x.rp - y.rp);
    const when = (rp: number) => {
      if (rp <= a.rp0!) return "déjà dépassé à la saisie";
      const at = t0 + timeToReach(tiers, a.rp0!, rp) * 1000;
      return at <= a.now ? `atteint il y a ${fmtDuration((a.now - at) / 1000)}` : `dans ${fmtDuration((at - a.now) / 1000)} (${clock(at)})`;
    };
    out.push(`<div class="tw"><table class="mini rs-steps"><thead><tr><th>Solde de RP</th><th>Atteint</th><th>Vitesse à ce moment</th></tr></thead><tbody>${rows
      .map((r) => {
        const v = rateAt(tiers, r.rp);
        return `<tr><td>${esc(r.label)}</td><td class="num">${esc(when(r.rp))}</td><td class="num">${esc(fmt(v, 2))} RP/s (${esc(fmt((v / nominal) * 100, 0))} %)</td></tr>`;
      })
      .join("")}</tbody></table></div>`);
    const lin = a.linearNow !== null && a.linearNow > rpNow * 1.01 ? ` En ligne droite (sans le seuil), le site aurait compté ${esc(fmtRP(a.linearNow))} maintenant.` : "";
    out.push(`<p class="hint">Sans rien dépenser. Les lignes 1,3 × et 2 × seuil servent au relevé RP-04.${lin}</p>`);
  }
  out.push(`<details class="more"><summary>Comment c'est calculé</summary>${researchHow(m)}</details>`);
  return out.join("");
}

/** « Comment c'est calculé » : vitesse et seuil (Mon usine et objectif recherche). */
export function researchHow(m: RpModel): string {
  const rows: string[] = [];
  const row = (th: string, f: string, src: string) => rows.push(`<tr><th>${th}</th><td class="f">${f}</td><td class="s">${src}</td></tr>`);
  if (m.source === "rps") {
    row("Vitesse", `${esc(fmt(m.tiers[0]?.rate ?? 0, 2))} RP/s`, "1ʳᵉ ligne du panneau ; sans seuil, en ligne droite");
    return `<table class="calc-t">${rows.join("")}</table>`;
  }
  for (const t of m.tiers) {
    const n = TIER_N[t.kind];
    if (m.source === "stations") {
      row(
        `Tier ${n} : vitesse`,
        t.kind === "rs1" ? `√${esc(fmt(t.sum.value, 0))} = ${esc(fmt(t.stationsRate, 2))} RP/s` : `V = ${esc(fmt(t.sum.value, 2))} ; 2 × V^0,6 = ${esc(fmt(t.stationsRate, 2))} RP/s`,
        t.kind === "rs1" ? "wiki, Research Station1" : "V : somme des valeurs de recherche des items de toutes les stations du tier, −30 % si les deux items d'une station sont identiques (wiki)",
      );
      row(
        `Tier ${n} : seuil`,
        t.kind === "rs1" || t.kind === "rs2"
          ? `${t.kind === "rs1" ? "200" : "2000"} × log₂(${esc(fmt(t.sum.factor, 0))} + 1) = ${esc(fmtRP(t.cap))}`
          : `C = ${esc(fmt(t.sum.factor, 3))} ; ${t.kind === "rs3" ? "16 500 × (log₂(C + 1) + √C)" : "150 000 × (log₂(C + 1) + C^0,9)"} = ${esc(fmtRP(t.cap))}`,
        t.kind === "rs3" || t.kind === "rs4" ? `C = somme, station par station, de log₄(prix moyen ÷ 600) + 1 (wiki) ; items différents d'une station à l'autre : ${assumed("RP-11")}` : "wiki, nombre de stations du tier",
      );
      if (t.circuits) row(`Tier ${n} : circuits Logic`, `${esc(fmt(t.circuits, 2))} RP/s sous le seuil`, `wiki, Research Station4 ; ${assumed("RP-09")}`);
    } else {
      row(`Tier ${n}`, `${esc(fmt(t.stationsRate, 2))} RP/s ; seuil ${t.capMissing ? "non renseigné" : esc(fmtRP(t.cap))}`, "recopiés du panneau");
    }
  }
  if (m.boost > 0) {
    const dish = m.tiers.reduce((a, t) => a + t.boostRate, 0);
    row(
      "Paraboles",
      m.source === "stations"
        ? `B × 0,78 × log₁₀(${esc(fmt(m.liquids ?? 0, 2))} + 1)${m.efficiency < 1 ? ` × ${esc(fmt(m.efficiency * 100, 0))} %` : ""} = ${esc(fmt(dish, 2))} RP/s`
        : `${esc(fmt(dish, 2))} RP/s, soit +${esc(fmt(m.boost * 100, 1))} % des stations`,
      `${m.source === "stations" ? `B : RP/s des stations ; R : valeurs des liquides de tous les contrôleurs (wiki, log décimal confirmé par la capture du 2026-10-18)${m.dishesFor100 !== null ? ` ; ${m.dishesFor100} paraboles pour 100 %` : ""} ; efficacité au prorata ${assumed("RP-12")} ; ` : ""}répartis entre les tiers et en baisse avec eux ${assumed("RP-04")}`,
    );
  }
  row("Au-delà du seuil", "RP/s × 10^(1 − solde ÷ seuil) ; tier 4 : 10^(1 − √(solde ÷ seuil))", "wiki, Research System");
  row("Solde au-delà", "seuil × (1 + log₁₀(1 + ln 10 × RP/s × t ÷ seuil))", "formule exacte, déduite de la précédente (t : temps depuis le seuil) ; plusieurs seuils ou tier 4 : intégration numérique");
  row("Un seuil par tier", "chaque tier ralentit à son propre seuil", assumed("RP-05"));
  row("« Max RP »", "solde où la vitesse tombe à 1 % : 3 × seuil (tier 4 : 9 ×)", `le panneau arrondit au millier supérieur ${assumed("RP-06")}`);
  row("Dépenser", "le solde redescend, la vitesse remonte aussitôt", assumed("RP-08"));
  return `<table class="calc-t">${rows.join("")}</table>`;
}
