// Vue d'un plan, en trois niveaux : la réponse (une phrase, quatre chiffres), la liste de
// construction à cocher, puis le schéma et les détails. Fonctions pures (chaînes HTML/SVG) :
// main.ts les insère et branche les événements.

import { controllerPanel } from "./assembly-view.ts";
import { renderDieselHud, type DieselChoice } from "./diesel.ts";
import type { DieselConfig } from "../engine/modular-calc.ts";
import type { Criterion } from "../engine/choose.ts";
import { ENERGY, POLLUTION } from "../engine/resources.ts";
import type { Plan, Step, Unresolved, Warning } from "../engine/solve.ts";
import { FH, FW, flowLabel, LABEL_H, layoutFlow } from "./flow-layout.ts";
import { esc, fmt, fmtDuration, fmtMF, fmtMoney, fmtMoneyShort, fmtPct, fmtRP } from "./format.ts";
import { joinList, t, type Key } from "../i18n/i18n.ts";
import { designLine, researchAddBlock, researchAlternatives, researchExplain, researchHowBlock, researchMergeNote, researchTimeline, STATION_KIND, type ResearchView } from "./research-plan.ts";
import { accessButton, itemN, LEAF_TEXT, lockText, machineN, nodeN, ownButton, recipeSelect, recipeText, sourceLink, unlockButton, type Ctx } from "./render.ts";
import { planKey, planMachines, type Goal } from "./state.ts";
import { verifyHref } from "./recipes-view.ts";
import type { Interfaces, MachineSettings } from "../engine/interfaces.ts";
import { renderScreenInputs, settingChips, settingLines } from "./iface-view.ts";
import { doubtText, fieldWord, fixAttr, stepWarnings, warnButton, warnChips } from "./plan-bar.ts";

/** `fresh` : rien n'est encore renseigné dans Mon usine (partie neuve supposée). */
/** `plot` : la parcelle du joueur (cases), si renseignée. */
/** `ifaces`, `msettings` : interfaces des machines et réglages chiffrés du plan (S10). */
export type ViewCtx = Ctx & { goal: Goal; research?: ResearchView | null; fresh?: boolean; plot?: { w: number; h: number } | null; ifaces?: Interfaces; msettings?: MachineSettings; /** Moteur diesel du plan (S18) : configurations connues et choix. */ diesel?: { configs: DieselConfig[]; choice: DieselChoice } };

// ---------------------------------------------------------------- priorité

/** Libellé de joueur et effet de chaque priorité (critère d'optimisation), dans la langue choisie. */
export const criterionText = (c: Criterion): { label: string; why: string } => ({ label: t(`crit.${c}.label`), why: t(`crit.${c}.why`) });

/** Ce que fait une priorité, selon l'objectif. */
export function criterionWhy(goal: Goal, c: Criterion): string {
  return c === "machines" && (goal === "énergie" || goal === "recherche") ? t(`crit.machines.why.${goal}`) : criterionText(c).why;
}

/** Phrase d'aide sous les priorités : ce que fait la première, et le rôle des suivantes. */
export function criterionHint(goal: Goal, c: Criterion): string {
  return t("crit.hint", { label: criterionText(c).label, why: criterionWhy(goal, c) });
}

// ---------------------------------------------------------------- petits outils

/** « 3 machines » : nombre arrondi, pluriel accordé selon la langue. */
const plural = (key: Key, n: number) => t(key, { n: Math.round(n) });
// Vues pas encore traduites (liste, schéma, détails : S31) : leurs textes restent en français ici.
const pluralFr = (n: number, one: string, many: string) => `${fmt(n, 0)} ${n > 1 ? many : one}`;
/** « a », « a et b », « a, b et c ». */
const joinFr = (list: string[]) => (list.length < 2 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} et ${list.at(-1)}`);
const fmtRate = (x: number) => fmt(x, x >= 100 ? 0 : x >= 10 ? 1 : 2);
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** Pollution lisible : « 33 %/h », « 1,1 %/h », « 0,17 %/h » (fourchette si elle varie). */
function fmtPol(p: [number, number]): string {
  const f = (x: number) => fmt(x, Math.abs(x) >= 10 ? 0 : Math.abs(x) >= 1 ? 1 : 2);
  return p[0] === p[1] || f(p[0]) === f(p[1]) ? `${f(p[0])} %/h` : `${f(p[0])} – ${f(p[1])} %/h`;
}

/** Avertissements qui empêchent ou faussent le plan : affichés dans la réponse. */
const BLOCKING = new Set([
  "item-inconnu",
  "machines-finales",
  "dépôt",
  "simplexe",
  "énergie-non-couverte",
  "contrainte-pollution",
  "contrainte-budget",
  "pollution-arrondi",
  "budget-arrondi",
  "forcée-invalide",
  "forcée-verrouillée",
]);
const isBlocking = (w: Warning) => BLOCKING.has(w.code);

function countsText(p: Plan): string {
  const parts = [plural("ans.machines", p.totals.machines)];
  if (p.totals.farms) parts.push(t("ans.trees", { n: fmt(p.totals.farms, 0) }));
  if (p.totals.depots) parts.push(plural("ans.depots", p.totals.depots));
  return joinList(parts);
}

const finalSteps = (p: Plan) => p.steps.filter((s) => p.finals.includes(s.key));
/** Nom court d'une installation composée : « Centrale Firebox (coal) » (le détail des bâtiments est à part). */
function plantName(v: Pick<ViewCtx, "data">, s: Step, word = true): string {
  const r = v.data.recipes.get(s.recipeId);
  const name = (r?.setupName ?? machineN(v, s.machine)).split(" + ")[0]!;
  // Ferme d'arbres et moteur diesel modulaire (S13) : leur nom se suffit.
  return r?.farm || r?.wholeUnits || !word ? name : t("ans.plant", { name });
}
/** Pollution retirée par une étape de Scrubbers (%/h, positive). */
function removedPollution(s: Step): string {
  const p = s.pollutionPerHour;
  if (p === null) return "";
  const r: [number, number] = typeof p === "number" ? [-p, -p] : [-p[1], -p[0]];
  return `retire ${fmtPol(r)}`;
}

// ---------------------------------------------------------------- la réponse

function headline(v: ViewCtx): { text: string; tone: "ok" | "warn" | "bad" } {
  const p = v.plan;
  const tg = p.target;
  const item = esc(itemN(v, tg.item));
  const missing = p.unresolved.filter((u) => !u.loopShortfall).length;
  const partial = p.status === "partiel" ? plural("ans.partial", missing) : "";
  const tone = p.status === "ok" ? "ok" : p.status === "partiel" ? "warn" : "bad";
  if (v.goal === "recherche") return researchHeadline(v);
  const counts = countsText(p);
  if (v.goal === "argent") {
    const x = esc(fmtMoney(tg.ratePerMin));
    return { text: p.status === "impossible" ? t("ans.money.impossible", { x }) : t("ans.money.ok", { x, counts, partial }), tone };
  }
  if (v.goal === "énergie") {
    const x = esc(fmtMF(tg.ratePerMin));
    if (p.status === "impossible") return { text: t("ans.energy.impossible", { x }), tone };
    return { text: t("ans.energy.ok", { x, how: t(v.settings.energyGuaranteed ? "ans.energy.guaranteed" : "ans.energy.avg"), counts, partial }), tone };
  }
  if (p.status === "impossible") return { text: t("ans.item.impossible", { item }), tone };
  const fin = finalSteps(p)[0];
  const by = tg.finalMachines !== null && fin ? t("ans.item.byMachines", { n: fmt(fin.machines, 0), m: esc(machineN(v, fin.machine)) }) : "";
  return { text: t("ans.item.ok", { rate: fmtRate(tg.ratePerMin), item, by, counts, partial }), tone };
}

function researchGoalText(v: ViewCtx): string {
  const s = v.settings;
  const n = v.research?.nodes.length ?? 0;
  const time = esc(fmtDuration(s.rpMinutes * 60));
  if (s.rpMode === "rate") return `${fmt(s.rpRate ?? 0, 2)} RP/s`;
  if (s.rpMode === "node") return t("ans.rp.node", { node: esc(s.rpNode ? nodeN(v, s.rpNode) : t("ans.rp.node.chosen")), time });
  return t("ans.rp.plan", { n: plural("ans.rp.n", n), time });
}

function researchHeadline(v: ViewCtx): { text: string; tone: "ok" | "warn" | "bad" } {
  const r = v.research;
  if (!r) return { text: t("ans.rp.noData"), tone: "bad" };
  // « Quand » avant « comment » (S22) : le temps de jeu à ton rythme, puis l'installation pour aller plus vite.
  const last = v.settings.rpMode !== "rate" ? r.timelineNow?.[r.timelineNow.length - 1] : undefined;
  const pace = last && Number.isFinite(last.at) && last.at > 0 ? t("ans.rp.pace", { t: esc(fmtDuration(last.at)) }) : "";
  if (!r.best) {
    const done = r.warnings.some((w) => /déjà|suffit/.test(w));
    return { text: pace + esc(r.warnings[0] ?? t("ans.rp.none")), tone: done ? "ok" : "bad" };
  }
  const d = r.best.design;
  const chain = r.best.plan.totals.machines + r.best.plan.totals.farms;
  const buildings = d.buildings.reduce((s, b) => s + b.count, 0);
  const extra = buildings - d.stations * (d.kind === "rs4" ? 2 : 1);
  return {
    text: t("ans.rp.ok", {
      pace,
      goal: researchGoalText(v),
      n: String(d.stations),
      kind: esc(STATION_KIND[d.kind]!),
      extra: extra > 0 ? plural("ans.rp.dishes", extra) : "",
      chain: chain ? plural("ans.rp.chain", chain) : "",
    }),
    tone: r.best.plan.status === "ok" ? "ok" : "warn",
  };
}

function kpis(v: ViewCtx): [string, string][] {
  const p = v.plan;
  const tt = p.totals;
  const e = p.economy;
  const unk = (n: number) => (n ? "+" : "");
  const costLabel = e.money === null ? t("kpi.cost") : e.moneyMissing ? t("kpi.cost.missing", { x: fmtMoneyShort(e.moneyMissing) }) : t("kpi.cost.ok", { x: fmtMoneyShort(e.money) });
  const cost: [string, string] = [fmtMoneyShort(e.buildCost) + unk(e.buildCostUnknown), costLabel];
  const removes = tt.pollutionPerHour[1] < 0;
  const pollution: [string, string] = [
    fmtPol(tt.pollutionPerHour),
    `${t(removes ? "kpi.pollution.removes" : "kpi.pollution.adds")}${tt.pollutionUnknownSteps ? t("kpi.pollution.unknown", { n: String(tt.pollutionUnknownSteps) }) : ""}`,
  ];
  // Surface des machines seules (sans tuyaux ni poteaux) : si elle dépasse la parcelle, rien ne tiendra.
  const plotArea = v.plot ? v.plot.w * v.plot.h : null;
  const area: [string, string] = [
    `${fmt(tt.footprint, 0)}${unk(tt.footprintUnknownSteps)}`,
    plotArea === null ? t("kpi.area") : t(tt.footprint > plotArea ? "kpi.area.over" : "kpi.area.fits", { x: fmt(plotArea, 0) }),
  ];
  if (v.goal === "recherche" && v.research?.best) {
    const d = v.research.best.design;
    const total = d.buildingCost + e.buildCost;
    return [
      [`${fmt(d.rate, d.rate >= 100 ? 0 : 2)} RP/s`, v.research.currentRate ? t("kpi.rp.extra", { x: fmt(v.research.currentRate, 2) }) : t("kpi.rp.rate")],
      [fmtRP(d.cap), v.research.capNeeded ? t("kpi.rp.cap.need", { x: fmtRP(v.research.capNeeded) }) : t("kpi.rp.cap")],
      [fmtMF(tt.energyAvg), t("kpi.rp.energy")],
      [fmtMoneyShort(total) + unk(e.buildCostUnknown), e.money === null ? t("kpi.rp.cost") : t(e.money >= total ? "kpi.have.ok" : "kpi.have", { x: fmtMoneyShort(e.money) })],
    ];
  }
  if (v.goal === "énergie") {
    return [[fmtMF(tt.energyProduced), t("kpi.energy.produced", { x: fmtMF(tt.energyAvg) })], cost, pollution, area];
  }
  const energy: [string, string] = [
    fmtMF(tt.energyAvg) + unk(tt.energyUnknownSteps),
    tt.energyProduced ? t("kpi.energy.onSite", { x: fmtMF(tt.energyProduced) }) : t("kpi.energy.peak", { x: fmtMF(tt.energyPeak) }),
  ];
  // S23 : l'ordre qui compte pour un joueur (la place, les machines, l'énergie, puis le prix) ; la pollution passe dans Détails.
  const machines: [string, string] = [fmt(tt.machines, 0), t("kpi.machines")];
  return [area, machines, energy, cost];
}

/** La pollution du plan, pour Détails (S23 : retirée des chiffres de la réponse, sauf pour l'énergie). */
function pollutionLine(v: ViewCtx): string {
  const t = v.plan.totals;
  const removes = t.pollutionPerHour[1] < 0;
  return `<p class="hint">Pollution ${removes ? "retirée (les Scrubbers en retirent plus qu'il n'en est ajouté)" : "ajoutée"} : <b>${esc(fmtPol(t.pollutionPerHour))}</b>${
    t.pollutionUnknownSteps ? ` (${t.pollutionUnknownSteps} étape(s) inconnue(s))` : ""
  } · elle ralentit la pousse des arbres.</p>`;
}

function chipLine(label: string, chips: string[]): string {
  return chips.length ? `<p class="chips"><span class="chips-k">${label}</span> ${chips.join(" ")}</p>` : "";
}
const chip = (name: string, n: string, cls = "") => `<span class="chip${cls ? ` ${cls}` : ""}">${esc(name)} <span class="n">${esc(n)}</span></span>`;

/** Débit voisin où les machines sont mieux occupées (un seul, le plus proche). */
function tierSuggestion(v: ViewCtx): string {
  const p = v.plan;
  const cur = p.tiers.find((t) => t.current);
  if (!cur || cur.efficiency >= 0.97 || p.status !== "ok") return "";
  const better = p.tiers.filter((t) => !t.current && t.efficiency >= cur.efficiency + 0.05);
  if (!better.length) return "";
  const best = better.sort((a, b) => Math.abs(Math.log(a.ratePerMin / cur.ratePerMin)) - Math.abs(Math.log(b.ratePerMin / cur.ratePerMin)))[0]!;
  // S29 (vocabulaire de la maquette) : « À 60/min au lieu de 30, tes machines tournent à 96 % (91 % ici) ».
  return `<li class="tip">${t("ans.tier", { btn: tierButton(v, best), cur: esc(tierUnit(v, cur.ratePerMin)), a: fmtPct(fmt(best.efficiency * 100, 0)), b: fmtPct(fmt(cur.efficiency * 100, 0)) })}</li>`;
}

function tierUnit(v: ViewCtx, r: number): string {
  return v.goal === "argent" ? `${fmtMoney(r)}/min` : v.goal === "énergie" ? fmtMF(r) : `${fmtRate(r)}/min`;
}
function tierButton(v: ViewCtx, tier: Plan["tiers"][number], long = false): string {
  const whole = Math.abs(tier.finalMachines - Math.round(tier.finalMachines)) < 1e-6;
  const final = v.goal === "objet" && whole ? ` data-final="${Math.round(tier.finalMachines)}"` : "";
  const label = long ? `${tierUnit(v, tier.ratePerMin)} · ${plural("ans.machines", tier.machines)} · ${fmtPct(fmt(tier.efficiency * 100, 0))}` : tierUnit(v, tier.ratePerMin);
  return `<button type="button" class="chip tier${tier.exact ? " exact" : ""}" data-tier="${tier.ratePerMin}"${final}>${esc(label)}${tier.exact ? " ●" : ""}</button>`;
}

/** Ce qui manque (recherches, machines à posséder), avec les boutons pour le cocher. */
function missingNotes(v: ViewCtx): string[] {
  const p = v.plan;
  const e = p.economy;
  const out: string[] = [];
  // Filtre de machines (S9) : chaque objet que plus aucune machine permise ne fabrique, avec de quoi la permettre.
  for (const u of p.unresolved.filter((x) => !x.loopShortfall && x.reason === "machine écartée")) {
    const excluded = u.excluded ?? [];
    const allow = excluded.map((m) => `<button type="button" class="link" data-mf-allow="${esc(m)}">${esc(t("mf.allow", { m: machineN(v, m) }))}</button>`).join(" · ");
    const list = excluded.map((m) => esc(machineN(v, m))).join(", ");
    out.push(`<li class="bad">${t("ans.mf.none.html", { item: esc(itemN(v, u.item)), rate: esc(fmtRate(u.perMin)), list, verb: t("ans.mf.verb", { n: excluded.length }), allow })}</li>`);
  }
  const unres = p.unresolved.filter((u) => !u.loopShortfall && u.reason !== "machine écartée");
  if (unres.length) {
    const why = unres.map((u) => `<b>${esc(itemN(v, u.item))}</b> (${esc(u.unlock ? lockText(v, u.unlock) : (LEAF_TEXT[u.reason] ?? u.reason))})`);
    out.push(`<li class="bad">${t("ans.unresolved", { list: why.join(" ; ") })}</li>`);
  }
  if (e.nodesToUnlock.length) {
    const time = e.rpMissing && e.secondsToRp !== null ? t("ans.unlock.time", { t: esc(fmtDuration(e.secondsToRp)) }) : e.rpMissing ? t("ans.unlock.missing", { rp: esc(fmtRP(e.rpMissing)) }) : "";
    const sell = e.reqItems.length ? t("ans.unlock.sell", { list: e.reqItems.map((r) => `${r.amount} ${esc(itemN(v, r.item))}${r.done ? " ✓" : ""}`).join(", ") }) : "";
    const list = e.nodesToUnlock.map((n) => esc(nodeN(v, n))).join(" → ");
    out.push(`<li>${t("ans.unlock", { list, rp: esc(fmtRP(e.rpNeeded)), time, sell, btn: unlockButton(e.nodesToUnlock, t("ans.unlock.done")) })}</li>`);
  }
  if (e.machinesToOwn.length) out.push(`<li>${t("ans.own", { list: e.machinesToOwn.map((m) => esc(machineN(v, m))).join(", "), btn: ownButton(e.machinesToOwn) })}</li>`);
  return out;
}

export function renderAnswer(v: ViewCtx): string {
  const p = v.plan;
  const h = headline(v);
  const empty = v.goal === "recherche" ? !v.research?.best : p.status === "impossible" && !p.steps.length;
  const stats = empty
    ? ""
    : `<div class="kpis">${kpis(v)
        .map(([val, k]) => `<div class="kpi"><b>${esc(val)}</b><span>${esc(k)}</span></div>`)
        .join("")}</div>`;
  const plants = p.steps.filter((s) => s.item === ENERGY);
  const lines = [
    v.goal === "énergie"
      ? chipLine(
          t("ans.chips.plants"),
          plants.map((s) => chip(s.parts ? plantName(v, s, false) : `${fmt(s.machines, 0)} × ${machineN(v, s.machine)}`, fmtMF(-(s.energyAvg ?? 0)))),
        )
      : "",
    v.goal === "recherche" && v.research?.best
      ? chipLine(t("ans.chips.stations"), Object.entries(v.research.best.design.consumption).map(([i, q]) => chip(itemN(v, i), `${fmtRate(q)}/min`)))
      : "",
    chipLine(t("ans.chips.sales"), p.sales.map((s) => chip(itemN(v, s.item), `${fmtRate(s.perMin)}/min × ${fmtMoney(s.price)}`))),
    chipLine(
      t("ans.chips.raw"),
      p.raw.filter((r) => r.item !== ENERGY && r.item !== POLLUTION).map((r) => chip(itemN(v, r.item), `${fmtRate(r.perMin)}/min`)),
    ),
    chipLine(t("ans.chips.existing"), p.existing.map((x) => chip(itemN(v, x.item), t("ans.chips.existing.n", { used: fmtRate(x.used), available: fmtRate(x.available) }), "ok"))),
    chipLine(
      t("ans.chips.surplus"),
      p.surplus.filter((s) => s.item !== ENERGY && s.item !== POLLUTION).map((s) => chip(itemN(v, s.item), `${fmtRate(s.perMin)}/min`, "accent")),
    ),
  ].join("");
  const notes = [
    v.fresh ? `<li>${t("ans.fresh.html")}</li>` : "",
    ...p.warnings.filter(isBlocking).map((w) => `<li class="bad">${esc(w.message)}</li>`),
    ...missingNotes(v),
    ...[...new Set(p.steps.map((s) => v.data.recipes.get(s.recipeId)?.setupObserved).filter((x): x is string => !!x))].map((x) => `<li class="bad">${esc(x)}</li>`),
    tierSuggestion(v),
  ].filter(Boolean);
  return `<div class="answer ${h.tone}" role="status"><h2>${h.text}</h2>${stats}${lines}${notes.length ? `<ul class="notices">${notes.join("")}</ul>` : ""}</div>`;
}

// ---------------------------------------------------------------- liste de construction

export type BuildRow = {
  key: string;
  stage: string;
  /** Machines à poser (0 : rien à construire). */
  count: number;
  countText: string;
  machine: string;
  /** Installation composée (centrale…) : le détail des bâtiments. */
  parts?: string;
  product: string;
  rate: string;
  feeds: string;
  energy: string;
  note: string;
  /** Ligne à cocher (une machine à poser). */
  buildable: boolean;
  /** Objet pour « je l'ai déjà » (production existante). */
  have?: { item: string; perMin: number };
  /** Étape qui a un plan de pose (clé d'étape). */
  pose?: string;
  /** Réglage à faire sur les machines (S10) : pastilles « ⚙ … » (HTML). */
  setting?: string;
  /** Valeur à vérifier utilisée par cette ligne (S28) : ⚠ cliquable vers la correction (HTML). */
  warn?: string;
};

const STAGES = ["Extraction", "Transformation", "Produit final", "Vente", "Centrales électriques", "Énergie", "Dépollution", "Stations de recherche", "Réseau électrique", "Déjà en place", "Non produit"] as const;

function stepRow(v: ViewCtx, s: Step, stage: string): BuildRow {
  const p = v.plan;
  const r = v.data.recipes.get(s.recipeId);
  const farm = s.machineKind === "farm";
  const gen = s.item === ENERGY;
  const feeds = [...new Set(s.consumers.map((f) => itemN(v, f.item)))];
  const occupied = s.utilization < 0.95 && !farm ? `occupée${s.machines > 1 ? "s" : ""} à ${fmt(s.utilization * 100, 0)} %` : "";
  const locked = s.access.available ? "" : `${esc(lockText(v, s.access))} ${accessButton(s.access)}`;
  return {
    key: s.key,
    stage,
    // Installation composée : les bâtiments sont comptés un par un (le nombre d'installations, arrondi
    // bâtiment par bâtiment, ne dit pas combien en poser).
    count: s.parts ? s.parts.reduce((n, q) => n + q.count, 0) : s.machines,
    countText: s.parts ? "" : `${farm ? "≈ " : ""}${fmt(s.machines, 0)}`,
    machine: s.parts ? plantName(v, s) : machineN(v, s.machine),
    parts: s.parts ? s.parts.map((q) => `${q.count} × ${machineN(v, q.machine)}`).join(" + ") : undefined,
    product: gen ? "Énergie" : itemN(v, s.item),
    rate: gen ? fmtMF(-(s.energyAvg ?? 0)) : s.item === POLLUTION ? removedPollution(s) : `${fmtRate(s.demandPerMin)}/min`,
    feeds: p.finals.includes(s.key) && !feeds.length ? "" : feeds.join(", "),
    // Ferme d'arbres (S13) : l'électricité des récolteurs, par la prise du contrôleur.
    energy: gen || (farm && !s.parts) ? "—" : fmtMF(s.energyAvg),
    note: [occupied, farm && s.growth ? "nombre indicatif (pousse)" : "", locked].filter(Boolean).join(" · "),
    buildable: true,
    have: gen || s.item === POLLUTION ? undefined : { item: s.item, perMin: s.demandPerMin },
    pose: isPosable(s) ? s.key : undefined,
    setting: s.parts ? dieselSetting(v, s) : settingChips(settingLines(v.ifaces, v.msettings, s.machine, s.recipeId)) || undefined,
    warn: warnButton(v, stepWarnings(v, s)) || undefined,
  };
}

/** Réglages du contrôleur d'un moteur diesel (S18), pour la liste de construction. */
function dieselSetting(v: ViewCtx, s: Step): string | undefined {
  if (s.machine !== "diesel-engine-controller") return undefined;
  const c = v.diesel?.configs.find((x) => x.id === s.recipeId);
  return c ? controllerPanel(c.airFuel, c.throttle, c.throttleAssumed) : undefined;
}

/** Lignes de la liste de construction, dans l'ordre où l'on pose les machines. */
export function buildRows(v: ViewCtx): BuildRow[] {
  const p = v.plan;
  const rows: BuildRow[] = [];
  const isFinal = (s: Step) => p.finals.includes(s.key);
  const deepFirst = (a: Step, b: Step) => b.depth - a.depth || a.item.localeCompare(b.item);
  const steps = [...p.steps].sort(deepFirst);
  const finalStage = v.goal === "argent" ? "Vente" : v.goal === "énergie" ? "Centrales électriques" : "Produit final";
  for (const s of steps) {
    if (isFinal(s)) continue;
    if (s.item === ENERGY) rows.push(stepRow(v, s, "Énergie"));
    else if (s.item === POLLUTION) rows.push(stepRow(v, s, "Dépollution"));
    else rows.push(stepRow(v, s, s.isRaw || !s.inputs.length ? "Extraction" : "Transformation"));
  }
  for (const s of steps.filter(isFinal)) rows.push(stepRow(v, s, finalStage));
  for (const d of p.depots) {
    rows.push({
      key: `dépôt:${d.id}`,
      stage: "Vente",
      count: d.machines,
      countText: fmt(d.machines, 0),
      machine: d.name,
      product: "vente",
      rate: `${fmtRate(d.itemsPerMin)} objets/min chacun`,
      feeds: "",
      energy: "—",
      note: d.machinesExact < d.machines - 0.05 ? `occupé${d.machines > 1 ? "s" : ""} à ${fmt((d.machinesExact / d.machines) * 100, 0)} %` : "",
      buildable: true,
    });
  }
  const rs = v.goal === "recherche" ? v.research?.best?.design : undefined;
  for (const b of rs?.buildings ?? []) {
    rows.push({ key: `rs:${b.machine}`, stage: "Stations de recherche", count: b.count, countText: fmt(b.count, 0), machine: machineN(v, b.machine), product: "RP", rate: "", feeds: "", energy: "—", note: "", buildable: true });
  }
  const net = p.distribution;
  const pole = net && net.distanceTiles !== null ? net.options.find((o) => o.poles !== null) : undefined;
  if (net && pole) {
    rows.push({
      key: `réseau:${pole.id}`,
      stage: "Réseau électrique",
      count: pole.poles!,
      countText: fmt(pole.poles!, 0),
      machine: pole.name,
      product: fmtMF(net.mfps),
      rate: `sur ${fmt(net.distanceTiles! * 2, 0)} cases`,
      feeds: "",
      energy: "—",
      note: `${pluralFr(pole.lines, "ligne", "lignes")} de ${pole.polesPerLine} poteaux${pole.cost !== null ? ` · ${fmtMoney(pole.cost)}` : ""} (autres poteaux : Détails)`,
      buildable: true,
    });
  }
  for (const x of p.existing) {
    rows.push({
      key: `existant:${x.item}`,
      stage: "Déjà en place",
      count: 0,
      countText: "",
      machine: "Rien à construire",
      product: itemN(v, x.item),
      rate: `${fmtRate(x.used)}/min utilisés`,
      feeds: "",
      energy: "—",
      note: x.used < x.available - 1e-9 ? `il t'en reste ${fmtRate(x.available - x.used)}/min` : "",
      buildable: false,
    });
  }
  for (const u of p.unresolved) rows.push(unresolvedRow(v, u));
  // Dans l'ordre d'affichage : par étage (tri stable, l'ordre de construction est gardé dans chaque étage).
  const rank = (r: BuildRow) => (STAGES as readonly string[]).indexOf(r.stage);
  return rows.sort((x, y) => rank(x) - rank(y));
}

function unresolvedRow(v: ViewCtx, u: Unresolved): BuildRow {
  return {
    key: `manque:${u.item}`,
    stage: "Non produit",
    count: 0,
    countText: "",
    machine: u.loopShortfall ? "Marge à prévoir" : "Impossible pour l'instant",
    product: itemN(v, u.item),
    rate: u.perMin ? `${fmtRate(u.perMin)}/min` : "",
    feeds: "",
    energy: "—",
    note: u.loopShortfall
      ? "la chaîne en consomme aussi pour s'alimenter elle-même (boucle) : prévois de la marge"
      : `${u.unlock && u.reason !== "machine écartée" ? `${esc(lockText(v, u.unlock))} ${accessButton(u.unlock)}` : esc(LEAF_TEXT[u.reason] ?? u.reason)}`,
    buildable: false,
    have: { item: u.item, perMin: u.perMin },
  };
}

/** Signature d'un plan pour retrouver les lignes déjà cochées (mêmes machines, mêmes nombres). */
export function buildSignature(goal: Goal, rows: BuildRow[]): string {
  const text = `${goal}|${rows
    .filter((r) => r.buildable)
    .map((r) => `${r.key}:${r.count}`)
    .join(",")}`;
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function renderBuildList(v: ViewCtx, rows: BuildRow[], built: Set<string>): string {
  if (!rows.length) return `<p class="muted">Rien à construire.</p>`;
  const buildable = rows.filter((r) => r.buildable);
  const done = buildable.filter((r) => built.has(r.key)).length;
  const pct = buildable.length ? Math.round((done / buildable.length) * 100) : 0;
  let body = "";
  for (const stage of STAGES) {
    const list = rows.filter((r) => r.stage === stage);
    if (!list.length) continue;
    const machines = list.reduce((s, r) => s + r.count, 0);
    body += `<tr class="stage"><td colspan="5">${esc(stage)}${machines && stage !== "Réseau électrique" ? ` <span>· ${fmt(machines, 0)}</span>` : ""}</td></tr>`;
    for (const r of list) {
      const on = built.has(r.key);
      const box = r.buildable
        ? `<input type="checkbox" data-built="${esc(r.key)}"${on ? " checked" : ""} aria-label="${esc(`${r.countText} ${r.machine} : construit`)}">`
        : "";
      const have = r.have
        ? ` <button type="button" class="link small have" data-have="${esc(r.have.item)}" data-amount="${Math.round(r.have.perMin * 100) / 100}" title="Tu produis déjà cet objet ailleurs : le calcul s'en servira au lieu de construire.">je l'ai déjà</button>`
        : "";
      body += `<tr class="${[on ? "done" : "", r.buildable ? "" : "info"].filter(Boolean).join(" ")}"><td class="chk">${box}</td>
        <td class="what">${r.countText ? `<span class="count">${esc(r.countText)} ×</span> ` : ""}${esc(r.machine)}${r.warn ? ` ${r.warn}` : ""}${r.pose ? ` <button type="button" class="link small" data-pose="${esc(r.pose)}" title="Comment poser ces machines : disposition, tuyaux, poteaux">plan de pose</button>` : ""}${r.parts ? `<div class="sub">${esc(r.parts)}</div>` : ""}${r.setting ? `<div class="sub">${r.setting}</div>` : ""}${r.note ? `<div class="sub">${r.note}</div>` : ""}</td>
        <td class="prod">${esc(r.product)}${r.rate ? ` <span class="sub num">${esc(r.rate)}</span>` : ""}${have}</td>
        <td class="feeds">${r.feeds ? `<span class="sub-k">alimente</span> ${esc(r.feeds)}` : ""}</td>
        <td class="num energy">${esc(r.energy)}</td></tr>`;
    }
  }
  const bar = `<div class="progress"><span>${done} ligne${done > 1 ? "s" : ""} construite${done > 1 ? "s" : ""} sur ${buildable.length}</span><span class="bar"><i style="width:${pct}%"></i></span>${
    done ? `<button type="button" class="link small" data-built-reset>tout décocher</button>` : ""
  }</div>`;
  return `${buildable.length ? bar : ""}
    <table class="build"><thead><tr><th><span class="sr-only">Construit</span></th><th>Construire</th><th>Pour produire</th><th>Alimente</th><th>Énergie</th></tr></thead><tbody>${body}</tbody></table>
    <p class="hint">Coche au fur et à mesure : de l'extraction vers l'objet final, dans l'ordre où l'on pose les machines. Les cases restent cochées pour ce plan, dans ce navigateur.</p>`;
}

// ---------------------------------------------------------------- schéma

/** Ensemble modulaire qui a son plan de pose (S14) : ferme d'arbres, moteur diesel (recettes « moteur:… »). */
export const assemblyKind = (s: Pick<Step, "machineKind" | "parts" | "recipeId" | "machines">): "ferme" | "moteur" | null =>
  s.machines < 1 ? null : s.machineKind === "farm" && s.parts?.length ? "ferme" : s.recipeId.startsWith("moteur:") ? "moteur" : null;

/** Étape qui a un plan de pose : des machines à poser, ou un ensemble modulaire (pas les autres centrales composées). */
export const isPosable = (s: Step) => (s.machineKind !== "farm" && !s.parts && s.machines >= 1) || assemblyKind(s) !== null;

/** Nom court d'un bloc du schéma (étape, manque ou production existante), pour les raccordements. */
export function nodeText(v: ViewCtx, key: string): { text: string; step: Step | null } {
  const st = v.plan.steps.find((s) => s.key === key) ?? null;
  if (st) {
    const what = st.parts ? st.parts.map((q) => `${q.count} ${machineN(v, q.machine)}`).join(" + ") : `${st.machineKind === "farm" ? "≈ " : ""}${st.machines} × ${machineN(v, st.machine)}`;
    return { text: `${what} (${itemN(v, st.item)})`, step: st };
  }
  const ex = v.plan.existing.find((x) => x.key === key);
  if (ex) return { text: `ta production déjà en place (${itemN(v, ex.item)})`, step: null };
  return { text: `non produit dans ce plan : à apporter`, step: null };
}

/** Boutons vers une autre étape : son plan de pose, sa place dans le schéma. */
function nodeButtons(st: Step | null, key: string): string {
  return `${st && isPosable(st) ? `<button type="button" class="link small" data-pose="${esc(key)}">son plan de pose</button> ` : ""}<button type="button" class="link small" data-flow="${esc(key)}">au schéma</button>`;
}

/**
 * Raccordements d'une étape : d'où viennent ses entrées et où partent ses sorties (une étape peut
 * en alimenter plusieurs et être alimentée par plusieurs, en amont comme en aval pour les boucles).
 */
export function renderStepLinks(v: ViewCtx, key: string): string {
  const p = v.plan;
  const st = p.steps.find((s) => s.key === key);
  if (!st) return "";
  const loopTag = `<span class="tag" title="flux qui remonte la chaîne : il revient vers une étape en amont">boucle</span>`;
  const ins = p.edges
    .filter((e) => e.to === key)
    .map((e) => {
      const n = nodeText(v, e.from);
      return `<li><b>${esc(itemN(v, e.item))}</b> <span class="num">${esc(fmtRate(e.perMin))}/min</span> ← ${esc(n.text)}${e.loop ? ` ${loopTag}` : ""} ${nodeButtons(n.step, e.from)}</li>`;
    });
  const outs = p.edges
    .filter((e) => e.from === key)
    .map((e) => {
      const n = nodeText(v, e.to);
      return `<li><b>${esc(itemN(v, e.item))}</b> <span class="num">${esc(fmtRate(e.perMin))}/min</span> → ${esc(n.text)}${e.loop ? ` ${loopTag}` : ""} ${nodeButtons(n.step, e.to)}</li>`;
    });
  if (p.finals.includes(key)) {
    const sale = p.sales.find((x) => x.item === st.item);
    // Ce qui reste pour l'objectif, une fois servies les autres étapes de la chaîne.
    const kept = st.demandPerMin - p.edges.filter((e) => e.from === key && e.item === st.item).reduce((t, e) => t + e.perMin, 0);
    outs.unshift(`<li><b>${esc(itemN(v, st.item))}</b> <span class="num">${esc(fmtRate(sale?.perMin ?? kept))}/min</span> → ${sale ? "à vendre (objectif)" : "objectif du plan"}</li>`);
  }
  for (const x of p.surplus.filter((x) => x.from.includes(st.recipeId))) {
    outs.push(`<li><b>${esc(itemN(v, x.item))}</b> <span class="num">${esc(fmtRate(x.perMin))}/min</span> → surplus${x.from.length > 1 ? " du plan (toutes étapes)" : ""} : à stocker, vendre ou détruire</li>`);
  }
  const list = (title: string, items: string[], none: string) => `<div><h4>${title}</h4>${items.length ? `<ul class="links-list">${items.join("")}</ul>` : `<p class="muted">${none}</p>`}</div>`;
  return `<div class="step-links">${list("Entrées : d'où elles viennent", ins, "Aucune entrée (extraction).")}${list("Sorties : où elles partent", outs, "Rien ne part de cette étape.")}</div>`;
}

/** Barre du bas du schéma pour une flèche sélectionnée : ce qui passe, d'où, vers où. */
export function renderEdgeHud(v: ViewCtx, e: { from: string; to: string; item: string; perMin: number; loop: boolean }): string {
  const a = nodeText(v, e.from);
  const b = nodeText(v, e.to);
  const info = `<b>${esc(itemN(v, e.item))} · ${esc(flowLabel(e.perMin))}</b><span>de ${esc(a.text)} vers ${esc(b.text)}${e.loop ? " · boucle : remonte la chaîne" : ""}</span>`;
  return `<div class="flow-hud-head"><div class="flow-hud-info">${info}</div><div class="flow-hud-acts"><button type="button" class="flow-hud-btn" data-flow="${esc(e.from)}">◂ Départ</button><button type="button" class="flow-hud-btn" data-flow="${esc(e.to)}">Arrivée ▸</button><button type="button" class="flow-hud-x" data-flow-close aria-label="Fermer">×</button></div></div>`;
}

/** Barre du bas du schéma pour le bloc sélectionné : ce qu'il est, et où aller. */
export function renderFlowHud(v: ViewCtx, key: string, survey: (machine: string) => "depot" | "local" | "manquant"): string {
  const n = nodeText(v, key);
  const st = n.step;
  const ins = v.plan.edges.filter((e) => e.to === key).length;
  const outs = v.plan.edges.filter((e) => e.from === key).length + (v.plan.finals.includes(key) ? 1 : 0);
  const name = st ? itemN(v, st.item) : itemN(v, v.plan.existing.find((x) => x.key === key)?.item ?? key);
  const fx = v.plan.fixed?.steps.find((s) => s.key === key);
  const info = `<b>${esc(name)}</b><span>${esc(st ? n.text.replace(/ \([^)]*\)$/, "") : n.text)}${fx ? " (fixé)" : ""}${st ? ` · reçoit ${ins} flux · en envoie ${outs}` : ""}</span>`;
  // S28 : ce qui est douteux (⚠ → la correction) et la position à mettre en jeu (S10), à côté du nom.
  const notes: string[] = [];
  if (st) notes.push(warnChips(v, stepWarnings(v, st)));
  if (st && !st.parts) notes.push(settingChips(settingLines(v.ifaces, undefined, st.machine, st.recipeId)));
  // « Tu peux régler : » (S28) : tout ce qui change ce bloc, au même endroit.
  const sets: string[] = [];
  const planGoal = v.goal !== "recherche";
  // Nombre de machines réglable (S8) : boutons, molette ou clavier ; pas pour une installation composée.
  if (st && !st.parts && planGoal) {
    sets.push(
      `<span class="mset${fx ? " on" : ""}" title="Molette sur le nombre : une de plus ou de moins. Entrée pour appliquer un nombre tapé.">Machines : <button type="button" data-mset="-1" aria-label="Une machine de moins">−</button><input type="text" inputmode="numeric" data-mset-input data-key="${esc(key)}" value="${st.machines}" aria-label="Nombre de machines (${esc(name)})"><button type="button" data-mset="1" aria-label="Une machine de plus">+</button>${fx && fx.planMachines !== fx.machines ? ` <small>plan : ${fx.planMachines}</small>` : ""}</span>`,
    );
  }
  // Recette de l'objet (comme dans Détails) : automatique ou choisie à la main.
  if (st && planGoal && st.item !== ENERGY && st.item !== POLLUTION) {
    const choose = recipeSelect(v, st.item, st.recipeId, st.alternatives);
    if (choose) sets.push(`<span class="mset hud-recipe">Recette : ${choose}</span>`);
  }
  // Écran chiffré de la machine (S10), réglable pour le plan.
  if (st && !st.parts && planGoal) sets.push(renderScreenInputs(v.ifaces?.[st.machine], st.machine, machineN(v, st.machine), v.msettings?.[st.machine]));
  // Moteur diesel (S18) : carburant, critère ou configuration imposée, et les réglages du contrôleur.
  if (st && st.machine === "diesel-engine-controller" && v.diesel && planGoal) sets.push(renderDieselHud(v.diesel.configs, v.diesel.choice, v.diesel.configs.find((c) => c.id === st.recipeId) ?? null));
  // Filtre de machines (S9) : écarter la machine de ce plan, d'un clic.
  if (st && !st.parts && planGoal) {
    sets.push(`<button type="button" class="flow-hud-btn" data-mf-ban="${esc(st.machine)}" title="Écarter ${esc(machineN(v, st.machine))} de ce plan (réglage « Machines »)">Ne plus utiliser ${esc(machineN(v, st.machine))} ⊘</button>`);
  }
  const acts: string[] = [];
  // Le module de cette étape, à sa place dans l'usine (S25) ; « Plan de pose seul » reste dans son panneau.
  if (st && isPosable(st) && v.goal !== "recherche") acts.push(`<button type="button" class="flow-hud-btn primary" data-focus="${esc(key)}">Voir le module dans l'usine ▸</button>`);
  else if (st && isPosable(st)) acts.push(`<button type="button" class="flow-hud-btn primary" data-pose="${esc(key)}">Plan de pose ▸</button>`);
  if (st && !st.parts) {
    const state = survey(st.machine);
    const label = state === "depot" ? "ports relevés" : state === "local" ? "relevé local, à envoyer" : "ports pas encore relevés";
    acts.push(`<button type="button" class="flow-hud-btn" data-edit="${esc(st.machine)}" title="Ouvrir ${esc(machineN(v, st.machine))} dans l'éditeur de bâtiments">Bâtiment : ${esc(label)} ✎</button>`);
  }
  const noteRow = notes.filter(Boolean).join(" ");
  const setRow = sets.filter(Boolean).length ? `<div class="flow-hud-sets"><span class="flow-hud-k">Tu peux régler :</span>${sets.filter(Boolean).join("")}</div>` : "";
  return `<div class="flow-hud-head"><div class="flow-hud-info">${info}</div><div class="flow-hud-acts">${acts.join("")}<button type="button" class="flow-hud-x" data-flow-close aria-label="Fermer">×</button></div></div>${noteRow ? `<div class="flow-hud-notes">${noteRow}</div>` : ""}${setRow}`;
}

/**
 * Bandeau des machines fixées dans le schéma (S8), au-dessus des onglets du résultat : production
 * obtenue, ce qui la limite, l'utilisation des autres étapes fixées, et « Revenir au calcul ».
 */
export function renderFixBar(v: ViewCtx): string {
  const f = v.plan.fixed;
  if (!f || v.goal === "recherche") return "";
  const rateText = (r: number) => (v.goal === "argent" ? `${fmtMoney(r)}/min` : v.goal === "énergie" ? fmtMF(r) : `${fmtRate(r)} ${itemN(v, v.plan.target.item)}/min`);
  const stepName = (key: string) => {
    const st = v.plan.steps.find((s) => s.key === key);
    return st ? (st.item === ENERGY ? t("common.energy") : itemN(v, st.item)) : itemN(v, key.split("@")[0]!);
  };
  const machinesText = (key: string, n: number) => {
    const st = v.plan.steps.find((s) => s.key === key);
    return t("fix.machines", { n, m: st ? machineN(v, st.machine) : t("common.machines") });
  };
  const pct = (x: number) => fmtPct(fmt(x * 100, x >= 0.9995 ? 0 : 1));
  const goTo = (key: string) => `<button type="button" class="link" data-flow="${esc(key)}">${esc(stepName(key))}</button>`;
  const lines: string[] = [];
  const top = f.steps.find((s) => s.key === f.limit);
  if (f.reason === "machines" && top) {
    lines.push(`<p>${t("fix.limit.html", { step: goTo(top.key), machines: esc(machinesText(top.key, top.machines)), used: t("fix.used", { n: top.machines }), pct: pct(top.utilization) })}</p>`);
  }
  if (f.reason === "contrainte") {
    const what = [v.plan.constraints.budget !== null ? t("fix.budget") : "", v.plan.constraints.maxPollution !== null ? t("fix.pollution") : ""].filter(Boolean).join(` ${t("common.or")} `) || t("fix.other");
    lines.push(`<p>${t("fix.limit.constraint", { what: esc(what) })}</p>`);
  }
  const others = f.steps.filter((s) => s !== top || f.reason !== "machines");
  if (others.length) {
    const li = (s: (typeof others)[number]) => t("fix.step", { step: goTo(s.key), machines: esc(machinesText(s.key, s.machines)), used: t("fix.used", { n: s.machines }), pct: pct(s.utilization), exact: esc(fmt(s.exact, 2)) });
    lines.push(`<ul>${others.map((s) => `<li>${li(s)}</li>`).join("")}</ul>`);
  }
  if (f.existingUsed) lines.push(`<p class="muted">${t("fix.existing")}</p>`);
  if (f.ignored.length) lines.push(`<p class="muted">${t("fix.ignored", { list: esc(f.ignored.map(stepName).join(", ")) })}</p>`);
  const head =
    f.reason === "aucune"
      ? `<p class="big">${t("fix.none")}</p>`
      : `<p class="big">${t("fix.rate", { x: esc(rateText(f.rate)) })}${Math.abs(f.rate - f.baseRate) > 1e-9 * f.baseRate ? ` <span class="muted">${t("fix.rate.instead", { x: esc(rateText(f.baseRate)) })}</span>` : ""}</p>`;
  return `<div class="fixbar" role="status"><div>${head}${lines.join("")}</div><button type="button" data-fix-reset>${t("fix.reset")}</button></div>`;
}

/** Schéma des flux (SVG), à placer dans un cadre navigable. */
export function renderFlow(v: ViewCtx): { svg: string; width: number; height: number } | null {
  const p = v.plan;
  if (!p.steps.length && !p.unresolved.length) return null;
  const L = layoutFlow(p, (id) => itemN(v, id));
  const steps = new Map(p.steps.map((s) => [s.key, s]));
  const unres = new Map(p.unresolved.map((u) => [u.item, u]));
  const existing = new Map(p.existing.map((x) => [x.key, x]));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.width} ${L.height}" role="img" aria-label="Schéma des flux, des matières premières (à gauche) vers l'objectif (à droite)">
<defs><marker id="fa" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" class="fa"/></marker></defs>`;
  L.edges.forEach((e, i) => {
    s += `<path d="${e.d}" class="fe${e.loop ? " loop" : ""}" data-edge="${i}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" marker-end="url(#fa)"/>`;
  });
  // Zones de survol larges et invisibles : une flèche fine se survole et se sélectionne facilement.
  L.edges.forEach((e, i) => {
    const tip = `${itemN(v, e.item)} : ${flowLabel(e.perMin)}${e.loop ? " (boucle : sous-produit qui remonte la chaîne)" : ""}`;
    s += `<path d="${e.d}" class="fe-hit" data-edge="${i}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" data-item="${esc(e.item)}" data-rate="${e.perMin}"${e.loop ? ' data-loop="1"' : ""}><title>${esc(tip)}</title></path>`;
  });
  for (const n of L.nodes) {
    const st = steps.get(n.id);
    const u = unres.get(n.id);
    const ex = existing.get(n.id);
    const name = itemN(v, st?.item ?? ex?.item ?? n.id);
    const final = n.kind === "final";
    let sub: string;
    if (ex) sub = `déjà en place · ${fmtRate(ex.used)}/min`;
    else if (st?.machineKind === "farm") sub = `≈ ${st.machines} × ${machineN(v, st.machine)}`;
    else if (st?.parts) sub = st.parts.map((q) => `${q.count} ${machineN(v, q.machine)}`).join(" + ");
    else if (st) sub = `${st.machines} × ${machineN(v, st.machine)}`;
    else sub = u?.loopShortfall ? "boucle : marge à prévoir" : "non produit";
    const rate = final && st ? (st.item === ENERGY ? fmtMF(-(st.energyAvg ?? 0)) : `${fmtRate(st.demandPerMin)}/min`) : "";
    const tip = st
      ? `${name} — ${st.parts ? sub : `${st.machines} × ${machineN(v, st.machine)}`}, ${st.item === ENERGY ? fmtMF(-(st.energyAvg ?? 0)) : `${fmtRate(st.demandPerMin)}/min`}${st.energyAvg !== null && st.energyAvg > 0 ? `, ${fmtMF(st.energyAvg)}` : ""}`
      : ex
        ? `${name} — ta production existante : ${fmtRate(ex.used)} sur ${fmtRate(ex.available)} par min`
        : `${name} — ${u ? (LEAF_TEXT[u.reason] ?? u.reason) : ""}`;
    // Machines fixées (S8) : cadre en tirets ; celle qui limite en orange, les autres avec leur utilisation.
    const fx = p.fixed?.steps.find((x) => x.key === n.id);
    const limit = !!fx && p.fixed!.limit === n.id;
    if (fx) sub += " · fixé";
    const tag = fx ? (limit ? "limite" : `${fmt(fx.utilization * 100, 0)} %`) : "";
    // Valeur à vérifier (S28) : un ⚠ cliquable qui ouvre la correction de la première.
    const doubts = st ? stepWarnings(v, st) : [];
    const warn = doubts.length
      ? `<g class="fn-warn" ${fixAttr(doubts[0]!)} role="button" aria-label="${esc(`Valeur à vérifier : corriger (${name})`)}"><title>${esc(`À vérifier : ${doubts.map((d) => `${fieldWord(v, d.flag.field)} (${doubtText(d.flag)})`).join(" ; ")} — clique pour corriger`)}</title><rect x="${n.x + FW - 30}" y="${n.y + 28}" width="26" height="24" rx="6"/><text x="${n.x + FW - 17}" y="${n.y + 45}" text-anchor="middle">⚠</text></g>`
      : "";
    const fixTip = fx ? ` — ${fx.machines} fixée${fx.machines > 1 ? "s" : ""}${limit ? ", c'est l'étape qui limite" : `, utilisée${fx.machines > 1 ? "s" : ""} à ${fmt(fx.utilization * 100, 1)} %`}` : "";
    s += `<g class="fn ${n.kind}${fx ? " fixed" : ""}${limit ? " limit" : ""}" data-key="${esc(n.id)}"><title>${esc(tip + fixTip)}</title><rect x="${n.x}" y="${n.y}" width="${FW}" height="${FH}" rx="9"/>
<g class="fn-near"><text class="fn-name" x="${n.x + 12}" y="${n.y + 23}">${esc(trunc(name, rate || tag ? 14 : 23))}</text>${rate ? `<text class="fn-rate" x="${n.x + FW - 10}" y="${n.y + 23}" text-anchor="end">${esc(rate)}</text>` : tag ? `<text class="fn-tag${limit ? " limit" : ""}" x="${n.x + FW - 10}" y="${n.y + 21}" text-anchor="end">${esc(tag)}</text>` : ""}
<text class="fn-sub" x="${n.x + 12}" y="${n.y + 42}">${esc(trunc(sub, doubts.length ? 22 : 26))}</text></g>
<g class="fn-far" aria-hidden="true"><text class="fn-fname" x="${n.x + 9}" y="${n.y + 27}">${esc(trunc(name, 12))}</text><text class="fn-fsub" x="${n.x + 9}" y="${n.y + 50}">${esc(trunc(rate || sub.replace(/ · fixé$/, " ·fixé"), doubts.length ? 12 : 15))}</text></g>${warn}</g>`;
  }
  for (const [i, e] of L.edges.entries()) {
    // Étiquette sur deux lignes : le produit, puis son débit (nom entier au survol).
    s += `<g class="fl" data-edge="${i}" data-from="${esc(e.from)}" data-to="${esc(e.to)}"><title>${esc(`${itemN(v, e.item)} : ${flowLabel(e.perMin)}`)}</title><rect x="${(e.lx - e.lw / 2).toFixed(1)}" y="${(e.ly - LABEL_H / 2).toFixed(1)}" width="${e.lw.toFixed(1)}" height="${LABEL_H}" rx="8"/><text class="fl-name" x="${e.lx.toFixed(1)}" y="${(e.ly - 2).toFixed(1)}" text-anchor="middle">${esc(e.name)}</text><text x="${e.lx.toFixed(1)}" y="${(e.ly + 10).toFixed(1)}" text-anchor="middle">${esc(flowLabel(e.perMin))}</text></g>`;
  }
  return { svg: s + "</svg>", width: L.width, height: L.height };
}

// ---------------------------------------------------------------- détails

function warningsBlock(v: ViewCtx): { html: string; count: number } {
  const w = v.plan.warnings;
  const reused = w.filter((x) => x.code === "sous-produit-réutilisé");
  const rest = w.filter((x) => x.code !== "sous-produit-réutilisé");
  const items = [
    ...rest.filter(isBlocking).map((x) => `<li class="bad">${esc(x.message)}</li>`),
    ...rest.filter((x) => !isBlocking(x)).map((x) => `<li>${esc(x.message)}</li>`),
    reused.length
      ? `<li>Sous-produits réutilisés dans la chaîne (rien à évacuer pour eux) : ${esc(joinFr([...new Set(reused.flatMap((x) => x.items ?? []))].map((i) => itemN(v, i))))}.</li>`
      : "",
  ].filter(Boolean);
  return { html: items.length ? `<ul class="notes">${items.join("")}</ul>` : `<p class="muted">Rien à signaler.</p>`, count: items.length };
}

function recipesBlock(v: ViewCtx): string {
  const p = v.plan;
  const rows = p.steps.map((s) => {
    const r = v.data.recipes.get(s.recipeId)!;
    const flags = r.verify.length ? ` <a class="tag warn" href="${verifyHref("recette", r.id, r.verify[0]!.field)}" title="Aller à la valeur à corriger">⚠ à vérifier</a>` : "";
    const body = s.parts
      ? `${esc(r.setupName ?? "")}${Object.keys(r.inputs).length ? ` · consomme par seconde : ${esc(Object.entries(r.inputs).map(([k, q]) => `${fmt(q ?? 0, 2)} ${itemN(v, k)}`).join(" + "))}` : ""}${r.setupNote ? `<br><span class="muted">${esc(r.setupNote)}</span>` : ""}`
      : esc(recipeText(v, r, s.durationS));
    const choose = s.item === ENERGY || s.item === POLLUTION ? "" : recipeSelect(v, s.item, s.recipeId, s.alternatives);
    return `<li id="rec-${esc(s.key)}"><div class="rec-head"><b>${esc(itemN(v, s.item))}</b> <span class="muted">${esc(machineN(v, r.machine))}${s.forced ? " · choisie à la main" : ""}</span>${flags}</div>
      <div class="rec-text">${body}</div><div class="src">${r.sources.map(sourceLink).join(" · ")}</div>${choose}</li>`;
  });
  for (const u of p.unresolved) {
    const choose = recipeSelect(v, u.item, null, u.candidates);
    if (choose) rows.push(`<li><div class="rec-head"><b>${esc(itemN(v, u.item))}</b> <span class="muted">non produit</span></div>${choose}</li>`);
  }
  const forced = Object.keys(v.settings.forced).length;
  return `<p class="hint">Le menu de chaque objet permet d'imposer une recette au lieu du choix automatique.${
    forced ? ` <button type="button" class="link" data-forced-reset>Annuler les ${forced} choix à la main</button>` : ""
  }</p><ul class="recs">${rows.join("")}</ul>`;
}

const more = (title: string, body: string, open = false) => (body ? `<details class="more"${open ? " open" : ""}><summary>${title}</summary>${body}</details>` : "");

export function renderDetails(v: ViewCtx): string {
  const p = v.plan;
  const parts: string[] = [];
  const nodeName = (id: string) => nodeN(v, id);
  if (v.goal === "recherche" && v.research) {
    if (v.research.best) parts.push(more("Installation de recherche", researchExplain(v, v.research.best) + researchMergeNote(v.research), true));
    parts.push(more("Chronologie : quand chaque recherche sera débloquée", researchTimeline(v.research, nodeName), true));
    parts.push(more("Ajouter des stations aux tiennes", researchAddBlock(v, v.research), true));
    if (v.research.best) parts.push(more(`Autres installations comparées (${v.research.others.length})`, researchAlternatives(v, v.research)));
    parts.push(more("Comment c'est calculé : vitesse et seuil", researchHowBlock(v.research)));
  }
  const warn = warningsBlock(v);
  parts.push(more(`Remarques sur le calcul (${warn.count})`, warn.html));
  if (p.steps.length || p.unresolved.length) parts.push(more(`Recettes, sources et choix à la main (${p.steps.length})`, recipesBlock(v)));
  if (p.tiers.length > 1) {
    parts.push(
      more(
        "Débits « ronds » (machines bien remplies)",
        `<p class="chips">${p.tiers.filter((t) => !t.current).map((t) => tierButton(v, t, true)).join(" ")}</p>
        <p class="hint">Un clic adopte ce débit. Le pourcentage est l'occupation moyenne des machines ; ● : chaque étape tombe juste.</p>`,
      ),
    );
  }
  if (p.distribution) {
    const d = p.distribution;
    parts.push(
      more(
        "Réseau électrique (poteaux)",
        `<p>${esc(fmtMF(d.mfps))} à transporter${d.distanceTiles !== null ? ` sur ${fmt(d.distanceTiles * 2, 0)} cases (${fmt(d.distanceTiles, 1)} tuiles de portée)` : " — indique la distance dans les options pour compter les poteaux"}.</p><ul class="notes">${d.options
          .map((o) => `<li>${esc(o.name)} : ${pluralFr(o.lines, "ligne", "lignes")}${o.poles !== null ? `, ${o.poles} poteaux${o.cost !== null ? `, ${esc(fmtMoney(o.cost))}` : ""}` : ""}</li>`)
          .join("")}</ul>`,
      ),
    );
  }
  const used = p.verify.filter((x) => x.used).length;
  if (used) parts.push(more(`Valeurs à vérifier en jeu (${used})`, `<p>${pluralFr(used, "valeur utilisée par ce plan est douteuse", "valeurs utilisées par ce plan sont douteuses")} (manquante, variable ou contradictoire entre les wikis). <a href="#donnees">Les voir et les corriger</a>.</p>`));
  if (v.goal !== "recherche") {
    const how = p.engine === "simplexe" ? "optimisation exacte (simplexe)" : "choix heuristique, une recette par objet";
    parts.push(more("Comment ce plan est calculé", `<p>Priorité : ${esc(criterionText(p.criterion).label.toLowerCase())} ; ${esc(how)}. Les machines sont arrondies à l'unité supérieure, d'où l'occupation affichée quand elle n'est pas pleine.</p>`));
  }
  if (v.goal === "objet" || v.goal === "argent") parts.unshift(pollutionLine(v));
  return parts.join("") || `<p class="muted">Rien de plus.</p>`;
}

/** Ligne courte pour l'en-tête des autres pages (« Données ») : de quel calcul parle-t-on ? */
export function planLabel(v: ViewCtx): string {
  const t = v.plan.target;
  if (v.goal === "recherche") return v.research?.best ? designLine(v, v.research.best) : "objectif recherche";
  if (v.goal === "argent") return `${fmtMoney(t.ratePerMin)}/min de ventes`;
  if (v.goal === "énergie") return fmtMF(t.ratePerMin);
  return `${fmtRate(t.ratePerMin)} ${itemN(v, t.item)}/min`;
}
