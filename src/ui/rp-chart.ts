// « Ma recherche » › historique (lot S21) : interrupteur « Je joue », deux graphiques (RP et RP/s, en
// temps de jeu) et journal. Rendu pur (chaînes HTML et SVG), puis le survol (DOM) en fin de fichier.
//
// Lecture surtout par le graphique (Q22.3) : un trait vertical suit la souris ou le doigt sur les
// deux graphiques et donne la prévision, les relevés et leur écart, les repères (⚙ configuration,
// $ dépense) et les reconnexions proches. Le journal, replié, sert à retirer une faute de frappe.

import { gameNow, readingGap, realTimeAt, removable, evalPiece, type Mark, type RpHistory, type RpJournal } from "../engine/rp-history.ts";
import { TIERS, nominalRate, rateAt, type ResearchSetup } from "../engine/research-balance.ts";
import { esc, fmt, fmtDuration, fmtShort } from "./format.ts";

const H = 3_600_000;

export type Names = { node: (id: string) => string; item: (id: string) => string };

// ---------------------------------------------------------------- textes

const n2 = (x: number | null, d: number) => (x === null ? "—" : fmt(x, d));
const arrow = (a: number | null, b: number | null, d: number) => `${n2(a, d)} → ${n2(b, d)}`;
const sgn = (x: number, d: number) => `${x >= 0 ? "+" : "−"}${fmt(Math.abs(x), d)}`;
const clock = (ms: number) => new Date(ms).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Ce qui a changé dans « Ma recherche » (texte d'un repère ⚙). */
export function describeSetupChange(prev: ResearchSetup | null, next: ResearchSetup | null, names: Names): string {
  if (!prev) return "première configuration";
  if (!next) return "configuration effacée";
  const out: string[] = [];
  if (prev.mode !== next.mode) out.push(`saisie ${next.mode === "detaille" ? "détaillée" : "rapide"}`);
  for (const k of TIERS) {
    const a = prev.panel[k];
    const b = next.panel[k];
    const parts: string[] = [];
    if (a.stations !== b.stations) parts.push(`stations ${arrow(a.stations, b.stations, 0)}`);
    if (a.rate !== b.rate) parts.push(`RP/s ${arrow(a.rate, b.rate, 2)}`);
    if (a.cap !== b.cap) parts.push(`seuil ${arrow(a.cap, b.cap, 0)}`);
    const ga = prev.groups[k];
    const gb = next.groups[k];
    const count = (gs: typeof ga) => gs.reduce((s, g) => s + g.count, 0);
    const ca = count(ga);
    const cb = count(gb);
    if (ca !== cb) parts.push(`${cb > ca ? "+" : "−"} ${fmt(Math.abs(cb - ca), 0)} station${Math.abs(cb - ca) > 1 ? "s" : ""}`);
    const items = (gs: typeof ga) => gs.map((g) => g.items.filter(Boolean).map(names.item).join(" + ")).join(" ; ");
    if (items(ga) !== items(gb)) parts.push(`items : ${items(gb) || "aucun"}`);
    if (ga.filter((g) => g.logic).length !== gb.filter((g) => g.logic).length) parts.push("mini-jeu Logic");
    if (parts.length) out.push(`tier ${k.slice(2)} : ${parts.join(", ")}`);
  }
  const d: string[] = [];
  if (prev.dish.rate !== next.dish.rate) d.push(`RP/s ${arrow(prev.dish.rate, next.dish.rate, 2)}`);
  if (prev.dish.controllers !== next.dish.controllers) d.push(`contrôleurs ${arrow(prev.dish.controllers, next.dish.controllers, 0)}`);
  if (prev.dish.dishes !== next.dish.dishes) d.push(`paraboles ${arrow(prev.dish.dishes, next.dish.dishes, 0)}`);
  if (prev.dish.efficiency !== next.dish.efficiency) d.push(`efficacité ${arrow(prev.dish.efficiency, next.dish.efficiency, 0)} %`);
  const ctrlCount = (s: ResearchSetup) => s.controllers.reduce((a, c) => a + c.count, 0);
  if (ctrlCount(prev) !== ctrlCount(next)) d.push(`contrôleurs ${arrow(ctrlCount(prev), ctrlCount(next), 0)}`);
  const fluids = (s: ResearchSetup) => s.controllers.map((c) => (c.fluid ? names.item(c.fluid) : "")).filter(Boolean).join(", ");
  if (fluids(prev) !== fluids(next)) d.push(`liquide : ${fluids(next) || "aucun"}`);
  if (d.length) out.push(`paraboles : ${d.join(", ")}`);
  if (prev.maxRp !== next.maxRp) out.push(`Max RP ${arrow(prev.maxRp, next.maxRp, 0)}`);
  return out.length ? out.join(" ; ") : "configuration modifiée";
}

/** Texte d'un repère (configuration ou dépense). */
export function describeMark(m: Mark, names: Names): string {
  if (m.type === "config") {
    const v = m.rateBefore !== null && m.rateAfter !== null && Math.abs(m.rateAfter - m.rateBefore) > 0.005 ? ` (vitesse ${fmt(m.rateBefore, 2)} → ${fmt(m.rateAfter, 2)} RP/s)` : "";
    return `${describeSetupChange(m.prev, m.setup, names)}${v}`;
  }
  const what = [...m.added.map((id) => `${names.node(id)} débloquée`), ...m.removed.map((id) => `${names.node(id)} rendue`)].join(", ") || "RP dépensés";
  const ba = m.before !== null && m.after !== null ? ` (${fmt(m.before, 0)} → ${fmt(m.after, 0)})` : "";
  return `${what} : ${m.spent >= 0 ? "−" : "+"}${fmt(Math.abs(m.spent), 0)} RP${ba}`;
}

/** « il y a 3 h 10 de jeu », « maintenant », « dans 2 h 00 de jeu ». */
export function relGame(g: number, gNow: number): string {
  const d = (g - gNow) / 1000;
  if (Math.abs(d) < 30) return "maintenant";
  return d < 0 ? `il y a ${fmtDuration(-d)} de jeu` : `dans ${fmtDuration(d)} de jeu`;
}

// ---------------------------------------------------------------- interrupteur

/** « En jeu depuis … · ⏸ Je ne joue plus » ou « Hors jeu depuis … · ▶ Je joue ». */
export function renderPlay(j: RpJournal, now: number): string {
  const c = j.clock;
  const since = fmtDuration((now - c.since) / 1000);
  const total = fmtDuration(gameNow(c, now) / 1000);
  return c.playing
    ? `<div class="play on"><span class="state">En jeu depuis ${esc(since)}</span><span class="hint">Les RP montent. ${esc(total)} de jeu depuis le début du journal.</span><button type="button" data-play="off">⏸ Je ne joue plus</button></div>`
    : `<div class="play off"><span class="state">Hors jeu${j.events.some((e) => e.type === "session") ? ` depuis ${esc(since)}` : ""}</span><span class="hint">Les RP ne montent qu'en jeu : clique en lançant le jeu.</span><button type="button" data-play="on">▶ Je joue</button></div>`;
}

// ---------------------------------------------------------------- graphiques

/** Période affichée : 24 h de jeu (par défaut), 7 jours, ou tout (0). */
export const PERIODS = [
  { ms: 24 * H, label: "24 h de jeu" },
  { ms: 7 * 24 * H, label: "7 jours" },
  { ms: 0, label: "Tout" },
] as const;

/** Domaine horizontal (ms de jeu) : la période jusqu'à maintenant, plus un quart de prévision. */
export function chartDomain(j: RpJournal, gNow: number, period: number): [number, number] {
  const firstG = j.events.find((e) => e.type === "releve" && e.rp !== null)?.g ?? gNow;
  const x0 = period ? Math.max(firstG, gNow - period) : firstG;
  const span = Math.max(gNow - x0, H);
  return [Math.min(x0, gNow), Math.max(gNow, x0) + span / 4];
}

export type ChartKind = "rp" | "rps";
type Geometry = { x0: number; x1: number; W: number; Hh: number; m: { l: number; r: number; t: number; b: number }; ymax: number };
export type ChartGeo = Geometry & { X: (g: number) => number; Y: (v: number) => number; inv: (px: number) => number };

/** Points de la courbe prévue (un tous les ~3 px), morceau par morceau : [g, RP, RP/s]. */
export function samplePieces(h: RpHistory, x0: number, x1: number, step: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const p of h.pieces) {
    const a = Math.max(p.from, x0);
    const b = Math.min(p.to, x1);
    if (b < a) continue;
    const n = Math.max(1, Math.ceil((b - a) / step));
    for (let k = 0; k <= n; k++) {
      const g = a + ((b - a) * k) / n;
      const rp = evalPiece(p, g);
      out.push([g, rp, p.tiers ? rateAt(p.tiers, rp) : 0]);
    }
  }
  return out;
}

/** Seuil (le plus bas des tiers) de chaque morceau, fusionné quand il ne change pas. */
export function capSegments(h: RpHistory, x0: number, x1: number): { from: number; to: number; cap: number }[] {
  const out: { from: number; to: number; cap: number }[] = [];
  for (const p of h.pieces) {
    const caps = (p.tiers ?? []).map((t) => t.cap).filter((c) => Number.isFinite(c));
    const a = Math.max(p.from, x0);
    const b = Math.min(p.to, x1);
    if (!caps.length || b <= a) continue;
    const cap = Math.min(...caps);
    const last = out[out.length - 1];
    if (last && last.cap === cap && Math.abs(last.to - a) < 1) last.to = b;
    else out.push({ from: a, to: b, cap });
  }
  return out;
}

const niceStep = (v: number) => {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

/** Pas de la graduation horizontale (heures de jeu), selon la place. */
const stepX = (span: number, W: number) => [H, 2 * H, 4 * H, 6 * H, 12 * H, 24 * H, 48 * H, 96 * H, 168 * H, 336 * H, 720 * H].find((s) => span / s <= (W < 500 ? 5 : 9)) ?? 1440 * H;
const tickLabel = (d: number) => {
  if (Math.abs(d) < 1) return "maint.";
  const a = Math.abs(d);
  return `${d > 0 ? "+" : "−"}${a >= 48 ? `${fmt(a / 24, 0)} j` : `${fmt(a, 0)} h`}`;
};

/**
 * Un graphique (RP ou RP/s) : grille, seuil, courbe prévue (pleine jusqu'à maintenant, en pointillé
 * après), relevés, repères verticaux numérotés (en haut du graphique des RP), reconnexions (sous
 * l'axe du graphique des RP/s), trait du survol (caché).
 */
export function renderChart(h: RpHistory, gNow: number, dom: [number, number], kind: ChartKind, W: number): { svg: string; geo: ChartGeo } {
  const [x0, x1] = dom;
  const Hh = kind === "rp" ? 190 : 140;
  const m = { l: 44, r: 8, t: kind === "rp" ? 22 : 8, b: kind === "rp" ? 8 : 26 };
  const plotW = Math.max(10, W - m.l - m.r);
  const pts = samplePieces(h, x0, x1, ((x1 - x0) / plotW) * 3);
  const val = (p: [number, number, number]) => (kind === "rp" ? p[1] : p[2]);
  const caps = kind === "rp" ? capSegments(h, x0, x1) : [];
  const reads = h.readings.filter((r) => r.g >= x0 && r.g <= x1);
  const readVal = (r: (typeof reads)[number]) => (kind === "rp" ? r.rp : r.rps);
  let ymax = Math.max(1, ...pts.map(val), ...caps.map((c) => c.cap), ...reads.map((r) => readVal(r) ?? 0));
  const sy = niceStep(ymax / 5);
  ymax = Math.ceil(ymax / sy) * sy;
  const X = (g: number) => m.l + ((g - x0) / (x1 - x0)) * plotW;
  const Y = (v: number) => m.t + (1 - v / ymax) * (Hh - m.t - m.b);
  const inv = (px: number) => x0 + ((px - m.l) / plotW) * (x1 - x0);
  const f1 = (x: number) => x.toFixed(1);
  const s: string[] = [];
  for (let v = 0; v <= ymax + sy / 1000; v += sy) {
    s.push(`<line class="grid" x1="${m.l}" x2="${f1(W - m.r)}" y1="${f1(Y(v))}" y2="${f1(Y(v))}"/><text class="num" x="${m.l - 4}" y="${f1(Y(v) + 3.5)}" text-anchor="end">${esc(kind === "rp" ? fmtShort(v) : fmt(v, v < 10 && sy < 1 ? 1 : 0))}</text>`);
  }
  if (kind === "rps") {
    const st = stepX(x1 - x0, W);
    for (let g = gNow - Math.floor((gNow - x0) / st) * st; g <= x1 + 1; g += st) s.push(`<text class="num" x="${f1(X(g))}" y="${Hh - 6}" text-anchor="middle">${esc(tickLabel((g - gNow) / H))}</text>`);
    for (const r of h.reconnects) if (r.g >= x0 && r.g <= x1) s.push(`<path class="recon" d="M${f1(X(r.g))} ${Hh - m.b + 2} l4 7 h-8 Z"/>`);
  }
  h.marks.forEach((mk) => {
    if (mk.g >= x0 && mk.g <= x1) s.push(`<line class="mark" x1="${f1(X(mk.g))}" x2="${f1(X(mk.g))}" y1="${m.t}" y2="${Hh - m.b}"/>`);
  });
  s.push(`<line class="now" x1="${f1(X(gNow))}" x2="${f1(X(gNow))}" y1="${kind === "rp" ? m.t - 14 : m.t}" y2="${Hh - m.b}"/>`);
  if (kind === "rp") {
    const nx = X(gNow);
    s.push(`<text x="${f1(nx + (nx > W - 70 ? -3 : 3))}" y="${m.t - 6}" text-anchor="${nx > W - 70 ? "end" : "start"}">maintenant</text>`);
    for (const c of caps) s.push(`<line class="cap" x1="${f1(X(c.from))}" x2="${f1(X(c.to))}" y1="${f1(Y(c.cap))}" y2="${f1(Y(c.cap))}"/>`);
    const last = caps[caps.length - 1];
    if (last) s.push(`<text x="${f1(W - m.r)}" y="${f1(Y(last.cap) - 4)}" text-anchor="end">seuil ${esc(fmt(last.cap, 0))}</text>`);
  }
  const path = (arr: typeof pts) => arr.map((p, i) => `${i ? "L" : "M"}${f1(X(p[0]))} ${f1(Y(val(p)))}`).join("");
  const past = pts.filter((p) => p[0] <= gNow);
  const future = pts.filter((p) => p[0] >= gNow);
  if (past.length > 1) s.push(`<path class="pred" d="${path(past)}"/>`);
  if (future.length > 1) s.push(`<path class="pred future" d="${path(future)}"/>`);
  for (const r of reads) {
    const v = readVal(r);
    if (v !== null) s.push(`<circle class="meas" cx="${f1(X(r.g))}" cy="${f1(Y(v))}" r="4.5"/>`);
  }
  // Un seul nombre écrit sur le graphique : l'écart du dernier relevé (le reste au survol).
  const lastGap = [...reads].reverse().find((r) => readingGap(r));
  if (kind === "rp" && lastGap) {
    const gap = readingGap(lastGap)!;
    const x = X(lastGap.g);
    s.push(`<text class="num" x="${f1(x > m.l + 60 ? x - 7 : x + 7)}" y="${f1(Y(lastGap.rp!) - 8)}" text-anchor="${x > m.l + 60 ? "end" : "start"}">${esc(sgn(gap.pct, 1))} %</text>`);
  }
  if (kind === "rp") {
    // Repères trop proches : l'étiquette suivante se décale à droite (le trait vertical reste à sa place).
    let prev = -Infinity;
    h.marks.forEach((mk, i) => {
      if (mk.g < x0 || mk.g > x1) return;
      const x = Math.max(X(mk.g), prev + 16);
      prev = x;
      s.push(mk.type === "config" ? `<circle class="flag" cx="${f1(x)}" cy="${m.t - 8}" r="7"/>` : `<rect class="flag" x="${f1(x - 7)}" y="${m.t - 15}" width="14" height="14" rx="2"/>`);
      s.push(`<text class="flag-t" x="${f1(x)}" y="${m.t - 4.5}">${i + 1}</text>`);
    });
  }
  s.push(`<line class="hair" y1="${m.t}" y2="${Hh - m.b}" visibility="hidden"/>`);
  const label = kind === "rp" ? "Solde de RP en fonction du temps de jeu" : "Vitesse des RP en fonction du temps de jeu";
  return {
    svg: `<svg class="rh-svg" data-chart="${kind}" viewBox="0 0 ${W} ${Hh}" height="${Hh}" role="img" aria-label="${label}" tabindex="0">${s.join("")}</svg>`,
    geo: { x0, x1, W, Hh, m, ymax, X, Y, inv },
  };
}

/** Info-bulle au temps de jeu `g` : prévision, puis relevés, repères et reconnexions à moins de `tol` ms. */
export function tipAt(h: RpHistory, j: RpJournal, g: number, gNow: number, tol: number, names: Names): string {
  const rows: string[] = [];
  const real = realTimeAt(j, g);
  rows.push(`<div class="t">${g > gNow + 30_000 ? "prévision, " : ""}${esc(relGame(g, gNow))}${real !== null && Math.abs(g - gNow) >= 30_000 ? ` · ${esc(clock(real))}` : ""}</div>`);
  const p = [...h.pieces].reverse().find((x) => x.from <= g);
  if (p) {
    const rp = evalPiece(p, g);
    const rate = p.tiers ? rateAt(p.tiers, rp) : null;
    const nominal = p.tiers ? nominalRate(p.tiers) : 0;
    const caps = (p.tiers ?? []).map((t) => t.cap).filter((c) => Number.isFinite(c));
    rows.push(
      `<div><span class="k pred"></span>prévu <b>${esc(fmt(rp, 0))}</b> RP · <b>${esc(rate === null ? "—" : fmt(rate, 2))}</b> RP/s${rate !== null && nominal > 0 && rate < nominal * 0.995 ? ` <span class="t">(${esc(fmt((rate / nominal) * 100, rate < nominal * 0.1 ? 1 : 0))} %)</span>` : ""}</div>`,
    );
    if (caps.length) rows.push(`<div class="t">seuil ${esc(fmt(Math.min(...caps), 0))}${rp > Math.min(...caps) ? " : dépassé" : ""}</div>`);
  }
  for (const r of h.readings) {
    if (Math.abs(r.g - g) > tol) continue;
    const gap = readingGap(r);
    const vals = [r.rp !== null ? `<b>${esc(fmt(r.rp, r.rp < 1000 ? 1 : 0))}</b> RP` : "", r.rps !== null ? `<b>${esc(fmt(r.rps, 2))}</b> RP/s` : ""].filter(Boolean).join(" · ");
    rows.push(
      `<div><span class="k meas"></span>relevé ${vals}${gap ? `<br><span class="t">prévu ${esc(fmt(r.predRp!, 0))} : écart ${esc(sgn(gap.rp, 0))} RP (${esc(sgn(gap.pct, 1))} %)</span>` : r.predRp === null ? `<br><span class="t">premier relevé</span>` : ""}</div>`,
    );
  }
  h.marks.forEach((mk, i) => {
    if (Math.abs(mk.g - g) <= tol) rows.push(`<div><b>${mk.type === "config" ? "⚙" : "$"}${i + 1}</b> ${esc(describeMark(mk, names))}</div>`);
  });
  for (const r of h.reconnects) if (Math.abs(r.g - g) <= tol) rows.push(`<div class="t">▲ reconnexion après ${esc(fmtDuration((r.onAt - r.offAt) / 1000))} hors jeu (${esc(clock(r.onAt))})</div>`);
  return rows.join("");
}

/** Le bloc complet : période, légende, deux graphiques, journal replié. */
export function renderHistory(h: RpHistory, j: RpJournal, gNow: number, period: number, W: number, names: Names, journalOpen: boolean): string {
  if (!h.pieces.length) return `<p class="hint">L'historique commence à ton premier relevé des RP (1ʳᵉ ligne du panneau), en temps de jeu.</p>`;
  const dom = chartDomain(j, gNow, period);
  const rp = renderChart(h, gNow, dom, "rp", W);
  const rps = renderChart(h, gNow, dom, "rps", W);
  const total = fmtDuration(gNow / 1000);
  const legend = `<div class="rh-legend" aria-hidden="true">
    <span><svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" class="lg-pred"/></svg>prévu</span>
    <span><svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" class="lg-pred future"/></svg>prévision</span>
    <span><svg width="10" height="10"><circle cx="5" cy="5" r="4" class="lg-meas"/></svg>relevé</span>
    <span><svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" class="lg-cap"/></svg>seuil</span>
    <span><svg width="14" height="14"><circle cx="7" cy="7" r="6" class="lg-flag"/></svg>⚙ configuration</span>
    <span><svg width="14" height="14"><rect x="1" y="1" width="12" height="12" rx="2" class="lg-flag"/></svg>$ dépense</span>
    <span><svg width="10" height="8"><path d="M5 0 L10 8 L0 8 Z" class="lg-recon"/></svg>reconnexion</span></div>`;
  return `<div class="rh-bar"><div class="seg" role="radiogroup" aria-label="Période, en temps de jeu">${PERIODS.map(
    (p) => `<button type="button" role="radio" data-rh-period="${p.ms}" aria-checked="${p.ms === period}">${esc(p.label)}</button>`,
  ).join("")}</div><span class="hint">${esc(total)} de jeu depuis le début du journal · touche ou survole un graphique</span></div>
    ${legend}
    <div class="rh-chart"><h3>RP (solde)</h3>${rp.svg}</div>
    <div class="rh-chart"><h3>RP/s (vitesse)</h3>${rps.svg}</div>
    <div class="rh-tip" hidden></div>
    <details class="more rh-journal"${journalOpen ? " open" : ""}><summary>Journal (${j.events.length} événement${j.events.length > 1 ? "s" : ""})</summary>${renderJournal(h, j, gNow, names)}</details>`;
}

/** Le journal en tableau (le plus récent en haut), avec ✕ pour retirer une saisie fausse. */
export function renderJournal(h: RpHistory, j: RpJournal, gNow: number, names: Names): string {
  const markN = new Map(h.marks.map((m, i) => [m.index, { m, n: i + 1 }]));
  const readN = new Map(h.readings.map((r) => [r.index, r]));
  const rows = j.events
    .map((e, i) => {
      let what = "";
      let gap = "";
      if (e.type === "releve") {
        what = `Relevé : ${[e.rp !== null ? `${fmt(e.rp, e.rp < 1000 ? 1 : 0)} RP` : "", e.rps !== null ? `${fmt(e.rps, 2)} RP/s` : ""].filter(Boolean).join(", ")}`;
        const r = readN.get(i);
        const gp = r ? readingGap(r) : null;
        if (gp) gap = `${sgn(gp.rp, 0)} RP (${sgn(gp.pct, 1)} %)`;
      } else if (e.type === "config") {
        const mk = markN.get(i);
        what = mk ? `⚙${mk.n} ${describeMark(mk.m, names)}` : "Configuration de départ";
      } else if (e.type === "depense") {
        const mk = markN.get(i);
        what = mk ? `$${mk.n} ${describeMark(mk.m, names)}` : "Dépense";
      } else what = e.on ? "▶ Je joue" : "⏸ Je ne joue plus";
      const del = removable(j, i) ? `<button type="button" class="small" data-rh-del="${i}" title="Retirer cet événement du journal" aria-label="Retirer">✕</button>` : "";
      return `<tr><td class="num">${esc(relGame(e.g, gNow))}</td><td class="num">${esc(clock(e.at))}</td><td>${esc(what)}</td><td class="num">${esc(gap)}</td><td>${del}</td></tr>`;
    })
    .reverse();
  return `<div class="tw"><table class="rh-log"><thead><tr><th>Temps de jeu</th><th>Heure réelle</th><th>Événement</th><th>Écart prévu / relevé</th><th></th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <p class="hint">90 jours de jeu sont gardés ; les saisies à moins de 2 min de jeu d'écart sont fondues en une. ✕ retire l'événement du journal seulement (une dépense retirée ne décoche pas la recherche).</p>`;
}

// ---------------------------------------------------------------- survol (DOM)

export type HistoryState = { h: RpHistory; j: RpJournal; gNow: number; period: number; names: Names };

/**
 * Le trait vertical qui suit la souris ou le doigt sur les deux graphiques, et l'info-bulle. Au
 * toucher, l'info-bulle reste jusqu'au prochain toucher ailleurs ; au clavier, ← et → déplacent le trait.
 */
export function bindHistoryHover(root: HTMLElement, state: () => HistoryState | null): void {
  let cursor: number | null = null;
  const geoOf = (svg: SVGSVGElement) => {
    const st = state();
    if (!st) return null;
    const W = svg.viewBox.baseVal.width;
    const dom = chartDomain(st.j, st.gNow, st.period);
    return { st, W, ...renderChartGeo(dom, W) };
  };
  const show = (svg: SVGSVGElement, g: number) => {
    const geo = geoOf(svg);
    const tip = root.querySelector<HTMLElement>(".rh-tip");
    if (!geo || !tip) return;
    const gg = Math.min(geo.x1, Math.max(geo.x0, g));
    cursor = gg;
    for (const s of root.querySelectorAll<SVGSVGElement>("svg.rh-svg")) {
      const hair = s.querySelector(".hair");
      const x = geo.X(gg);
      hair?.setAttribute("x1", String(x));
      hair?.setAttribute("x2", String(x));
      hair?.setAttribute("visibility", "visible");
    }
    const tol = (12 / (geo.W - 52)) * (geo.x1 - geo.x0);
    tip.innerHTML = tipAt(geo.st.h, geo.st.j, gg, geo.st.gNow, tol, geo.st.names);
    tip.hidden = false;
    const box = root.getBoundingClientRect();
    const r = svg.getBoundingClientRect();
    const left = r.left - box.left + (geo.X(gg) / geo.W) * r.width;
    tip.style.left = `${Math.max(0, Math.min(box.width - tip.offsetWidth, left + (left > box.width / 2 ? -tip.offsetWidth - 12 : 12)))}px`;
    tip.style.top = `${r.top - box.top + 24}px`;
  };
  const hide = () => {
    cursor = null;
    root.querySelector<HTMLElement>(".rh-tip")?.setAttribute("hidden", "");
    for (const h of root.querySelectorAll(".rh-svg .hair")) h.setAttribute("visibility", "hidden");
  };
  const fromEvent = (e: PointerEvent) => {
    const svg = (e.target as Element).closest<SVGSVGElement>("svg.rh-svg");
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const geo = geoOf(svg);
    if (!geo) return;
    show(svg, geo.inv(((e.clientX - r.left) / r.width) * geo.W));
  };
  root.addEventListener("pointermove", fromEvent);
  root.addEventListener("pointerdown", fromEvent);
  root.addEventListener("pointerout", (e) => {
    if (e.pointerType === "mouse" && !(e.relatedTarget as Element | null)?.closest?.("svg.rh-svg")) hide();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!(e.target as Element).closest?.("svg.rh-svg")) hide();
  });
  root.addEventListener("keydown", (e) => {
    const svg = (e.target as Element).closest<SVGSVGElement>("svg.rh-svg");
    if (!svg || !["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)) return;
    const geo = geoOf(svg);
    if (!geo) return;
    e.preventDefault();
    if (e.key === "Escape") return hide();
    const step = (geo.x1 - geo.x0) / 40;
    const at = cursor ?? geo.st.gNow;
    show(svg, e.key === "Home" ? geo.x0 : e.key === "End" ? geo.st.gNow : at + (e.key === "ArrowLeft" ? -step : step));
  });
  root.addEventListener("focusout", (e) => {
    if ((e.target as Element).closest?.("svg.rh-svg") && !(e.relatedTarget as Element | null)?.closest?.("svg.rh-svg")) hide();
  });
}

/** La géométrie horizontale d'un graphique (même calcul que `renderChart`). */
function renderChartGeo(dom: [number, number], W: number) {
  const [x0, x1] = dom;
  const l = 44;
  const plotW = Math.max(10, W - l - 8);
  return { x0, x1, X: (g: number) => l + ((g - x0) / (x1 - x0)) * plotW, inv: (px: number) => x0 + ((px - l) / plotW) * (x1 - x0) };
}
