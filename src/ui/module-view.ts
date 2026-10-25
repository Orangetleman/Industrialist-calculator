// Plan de pose d'une étape (E4a) : dessin vue de dessus du module, ressources, pièces à acheter,
// ordre de pose. Fonctions pures (chaînes HTML/SVG) ; main.ts gère le choix de l'étape et le cadre.
// S4 : vecteurs des liaisons (« Afficher les liaisons »), machines cliquables, version « dans l'usine ».

import { passageWhere, tplMsg, type ModulePlan, type PassageOption, type PlacedPiece, type PoseCriterion } from "../engine/build/module.ts";
import { moduleFlows, type FlowArrow } from "../engine/build/flow.ts";
import { STEP, type Dir } from "../engine/build/geometry.ts";
import type { SurveyState } from "./buildings-model.ts";
import { colon, esc, fmt, fmtMoney } from "./format.ts";
import { t, type Key } from "../i18n/i18n.ts";
import { fitsPlot } from "./progress.ts";
import type { Message } from "../engine/message.ts";
import { orderPhase, say, turnMessage, txtHtml } from "./engine-text.ts";

const C = 16; // unités SVG par case
/** Nom d'une priorité de disposition, dans la langue choisie. */
const critName = (c: PoseCriterion): string => t(`mv.crit.${c}`);
/** Couleurs des ressources, lisibles sur le fond sombre du cadre. */
const PALETTE = ["#f0913a", "#6cc792", "#8fb8d6", "#e3b25a", "#d77fd0", "#5fd4d4", "#ff8a80", "#c5d86d"];

export function netColors(m: ModulePlan): Map<string, string> {
  // Une couleur par ressource ; ses collecteurs parallèles partagent la même.
  const items = [...new Set(m.nets.map((n) => n.item))];
  return new Map(m.nets.map((n) => [n.id, PALETTE[items.indexOf(n.item) % PALETTE.length]!]));
}

/** Ce qui change dans le dessin d'un module pour sa version « dans l'usine ». */
export type ModuleSvgOptions = {
  /** Pièces à dessiner à la place de celles du module (dans l'usine : collecteurs, prises et tuyaux qui traversent), en cases du module. */
  pieces?: PlacedPiece[];
  /** Couleur, ressource et tier III d'un réseau. */
  color?: (net: string) => string;
  item?: (net: string) => string;
  wide?: (net: string) => boolean;
  /** Vecteurs des liaisons (en cases du module) ; par défaut ceux du module seul. */
  flows?: FlowArrow[];
  /** Infobulle d'un réseau que le module ne connaît pas (tuyau de l'usine) ; null : celle du module. */
  netTip?: (net: string) => string | null;
};

/** Rôle d'une case de tuyau tirée de la grille de l'usine (pour l'infobulle et les tés). */
export function pieceRole(links: readonly Dir[], cross: boolean): PlacedPiece["role"] {
  if (cross) return "croisement";
  if (links.length >= 4) return "croix";
  if (links.length === 3) return "té";
  return links.length === 2 && STEP[links[0]!].x !== STEP[links[1]!].x && STEP[links[0]!].y !== STEP[links[1]!].y ? "coude" : "droit";
}

/**
 * Dessin du module (SVG), à placer dans un cadre navigable. Chaque machine mène à sa fiche (`data-machine`) ;
 * un tuyau sélectionne sa ressource (`data-item`) ; les vecteurs des liaisons (`.m-flow`) et les câbles vers
 * les machines (`.m-plug`) sont cachés tant que « Afficher les liaisons » est éteint.
 */
export function renderModuleSvg(m: ModulePlan, name: (id: string) => string, opts: ModuleSvgOptions = {}): { svg: string; width: number; height: number } {
  const W = (m.width + 4) * C;
  const H = (m.height + 2) * C;
  const ox = 2 * C;
  const oy = C;
  const palette = netColors(m);
  const color = opts.color ?? ((net: string) => palette.get(net) ?? "#9aa7b4");
  const itemOf = opts.item ?? ((net: string) => m.nets.find((n) => n.id === net)?.item ?? net);
  const tier = new Map(m.nets.map((n) => [n.id, n.pipe?.tier ?? 1]));
  const wide = opts.wide ?? ((net: string) => tier.get(net) === 3);
  const cx = (x: number) => ox + x * C + C / 2;
  const cy = (y: number) => oy + y * C + C / 2;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="module" role="img" aria-label="${esc(t("mv.svg.aria", { n: String(m.count), m: name(m.machine) }))}">`;
  s += `<defs><marker id="mfa" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#fff"/></marker><marker id="mfb" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ffd54a"/></marker></defs>`;
  // Grille légère (une case = un Short Pipe).
  s += `<g class="mg">`;
  for (let x = 0; x <= m.width; x++) s += `<line x1="${ox + x * C}" y1="${oy}" x2="${ox + x * C}" y2="${oy + m.height * C}"/>`;
  for (let y = 0; y <= m.height; y++) s += `<line x1="${ox}" y1="${oy + y * C}" x2="${ox + m.width * C}" y2="${oy + y * C}"/>`;
  s += `</g>`;
  // Machines : un clic ouvre la fiche de la machine. Infobulles en `data-tip` (la bulle du cadre, au survol et au clic).
  for (const mm of m.machines) {
    s += `<g class="mm" data-machine="${esc(m.machine)}" data-tip="${esc(t("mv.machine.tip", { m: name(m.machine), n: mm.id.slice(1) }))}"><rect x="${ox + mm.x * C}" y="${oy + mm.y * C}" width="${mm.w * C}" height="${mm.h * C}" rx="3"/>`;
    const no = t("mv.no", { n: mm.id.slice(1) });
    const label = mm.w * C >= 70 ? name(m.machine) : no;
    s += `<text x="${ox + (mm.x + mm.w / 2) * C}" y="${oy + (mm.y + mm.h / 2) * C + 4}" text-anchor="middle">${esc(label.length * 6.5 > mm.w * C - 6 ? no : label)}</text>`;
    for (const p of mm.power) s += `<circle class="plug" cx="${ox + p.x * C}" cy="${oy + p.y * C}" r="3.5" data-tip="${esc(t("mv.plug.tip", { n: mm.id.slice(1) }))}"/>`;
    s += `</g>`;
  }
  // Tuyaux : un trait du centre de la case vers chaque liaison ; croisement : le second réseau passe dessus.
  const seg = (x: number, y: number, d: Dir, col: string, w: boolean, bridge = false) =>
    `<line class="${bridge ? "pp bridge" : "pp"}" x1="${cx(x)}" y1="${cy(y)}" x2="${cx(x) + (STEP[d].x * C) / 2}" y2="${cy(y) + (STEP[d].y * C) / 2}" stroke="${col}" stroke-width="${w ? 5 : 3}"/>`;
  const res = (net: string) => name(itemOf(net));
  // Ce qu'on sait d'un réseau : collecteur du module (rôle, débit, tuyau), ou ce que l'usine en dit (opts.netTip).
  const netTip = (net: string): string => {
    const own = opts.netTip?.(net);
    if (own) return own;
    const n = m.nets.find((x) => x.id === net);
    if (!n) return res(net);
    return `${name(n.item)}${n.line ? ` (${t("mv.no", { n: String(n.line) })})` : ""} — ${t(n.role === "entrée" ? "mv.net.in" : "mv.net.out")}, ${fmt(n.perSec, 2)}/s${n.pipe ? t("mv.net.pipe", { t: n.pipe.tier === 1 ? "I" : "III", f: String(n.pipe.flowPerSec) }) : t("mv.net.noPipe")}`;
  };
  const PIECES = ["droit", "coude", "té", "croix", "croisement", "bout"];
  const piece = (role: string) => (PIECES.includes(role) ? t(`mv.piece.${role}` as Key) : role);
  for (const p of opts.pieces ?? m.pieces) {
    const tip =
      p.role === "croisement"
        ? `${t("mv.crossing.tip")}\n${netTip(p.net)}\n${netTip(p.crossNet ?? "")}`
        : `${netTip(p.net)}\n${t("mv.piece.tip", { p: piece(p.role) })}`;
    s += `<g class="m-pipe" data-item="${esc(itemOf(p.net))}" data-tip="${esc(`${tip}\n${t("mv.pipe.click")}`)}">`;
    for (const d of p.links) s += seg(p.x, p.y, d, color(p.net), wide(p.net));
    if (p.crossNet) for (const d of p.crossLinks ?? []) s += seg(p.x, p.y, d, color(p.crossNet), wide(p.crossNet), true);
    if (p.role === "té" || p.role === "croix") s += `<circle cx="${cx(p.x)}" cy="${cy(p.y)}" r="3.2" fill="${color(p.net)}"/>`;
    if (p.role === "croisement") s += `<rect class="xing" x="${cx(p.x) - 5}" y="${cy(p.y) - 5}" width="10" height="10" rx="2"/>`;
    s += `</g>`;
  }
  // Arrivées et départs du module seul (dans l'usine, les tuyaux vers les voisins les remplacent).
  if (!opts.pieces)
    for (const n of m.nets) {
      if (!n.end) continue;
      // Flèche au bord de la case, dans le sens du flux (vers le module pour une arrivée).
      const d = STEP[n.end.dir];
      const ex = cx(n.end.x) + (d.x * C) / 2;
      const ey = cy(n.end.y) + (d.y * C) / 2;
      const out = n.role === "sortie";
      const f = out ? d : { x: -d.x, y: -d.y };
      const bx = out ? ex : ex - 7 * f.x;
      const by = out ? ey : ey - 7 * f.y;
      const pts = [[bx - 5 * f.y, by + 5 * f.x], [bx + 7 * f.x, by + 7 * f.y], [bx + 5 * f.y, by - 5 * f.x]].map(([a, b]) => `${a},${b}`).join(" L");
      s += `<g class="end" data-tip="${esc(t(n.role === "entrée" ? "mv.end.in" : "mv.end.out", { item: name(n.item), r: fmt(n.perSec, 2) }))}"><path d="M${pts} z" fill="${color(n.id)}"/></g>`;
    }
  // Vecteurs des liaisons, par ressource : de 12 % à 88 % du trajet, pour qu'ils se suivent comme une chaîne.
  const byItem = new Map<string, string>();
  for (const a of opts.flows ?? moduleFlows(m)) {
    const at = (t: number) => [ox + (a.x1 + (a.x2 - a.x1) * t) * C, oy + (a.y1 + (a.y2 - a.y1) * t) * C].map((v) => v.toFixed(1));
    const [[x1, y1], [x2, y2]] = [at(0.12), at(0.88)] as [string[], string[]];
    const it = itemOf(a.net);
    byItem.set(it, (byItem.get(it) ?? "") + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#mfa)"/>`);
  }
  s += `<g class="m-flows">${[...byItem].map(([it, l]) => `<g class="m-flow" data-item="${esc(it)}">${l}</g>`).join("")}</g>`;
  // Câbles de chaque poteau vers les prises des machines qu'il alimente, puis les poteaux.
  const plugs = new Map(m.machines.map((q) => [q.id, q.power.filter((p) => p.direction !== "sortie")]));
  for (const p of m.poles) {
    const [px, py] = [ox + (p.x + p.w / 2) * C, oy + (p.y + p.h / 2) * C];
    for (const id of p.covers) for (const q of plugs.get(id) ?? []) s += `<line class="m-plug" x1="${px}" y1="${py}" x2="${ox + q.x * C}" y2="${oy + q.y * C}" marker-end="url(#mfb)"/>`;
  }
  for (const p of m.poles) s += `<g class="pole" data-tip="${esc(`${name(p.pole)}${p.covers.length ? t("mv.pole.feeds", { list: p.covers.map((c) => c.slice(1)).join(", ") }) : t("mv.pole.relay")}`)}"><rect x="${ox + p.x * C}" y="${oy + p.y * C}" width="${C * p.w}" height="${C * p.h}" rx="4"/><text x="${ox + (p.x + p.w / 2) * C}" y="${oy + (p.y + p.h / 2) * C + 4}" text-anchor="middle">P</text></g>`;
  return { svg: s + "</svg>", width: W, height: H };
}

/** Le module tient-il sur la parcelle du joueur ? Sinon, l'autre choix tiendrait-il ? */
function plotLine(m: ModulePlan, plot: { w: number; h: number } | null): string {
  if (!plot) return `<p class="mod-other">${t("mv.plot.none.html")}</p>`;
  const fit = fitsPlot(m.width, m.height, plot);
  const size = t("mv.plot.size", { w: String(plot.w), h: String(plot.h) });
  if (fit === "oui") return `<p class="mod-fit ok-text">${t("mv.plot.fits", { size })}</p>`;
  if (fit === "tourné") return `<p class="mod-fit ok-text">${t("mv.plot.turned", { size })}</p>`;
  const alt = m.other && fitsPlot(m.other.width, m.other.height, plot) !== "non" ? t("mv.plot.other", { c: esc(critName(m.other.first)) }) : "";
  return `<p class="mod-fit warn-text">${t("mv.plot.no", { size, w: String(m.width), h: String(m.height), alt })}</p>`;
}

/**
 * Choix de la sortie du collecteur central d'une double rangée : par les bouts (proposé), ou par un passage
 * entre deux machines ; la place d'abord : ceux qui élargissent le module sont à part, en option.
 * `advised` : les passages que « Toute l'usine » a gardés pour ce module, vers ses voisins (« ressource|rangée|n° »),
 * en tête de liste ; null si l'usine n'est pas encore calculée.
 */
export function renderPassagePick(base: ModulePlan, options: PassageOption[], chosen: string, name: (id: string) => string, advised: string[] | null = null): string {
  if (!options.length) return "";
  const key = (o: PassageOption) => `${o.item}|${o.passage.row}|${o.passage.after}`;
  const size = (o: PassageOption) => t("mv.plot.size", { w: String(o.plan.width), h: String(o.plan.height) });
  const good = (o: PassageOption) => !!advised?.includes(key(o));
  const opt = (o: PassageOption) =>
    `<option value="${esc(key(o))}"${key(o) === chosen ? " selected" : ""}>${good(o) ? "★ " : ""}${esc(`${name(o.item)}${colon()}${say(passageWhere(o.passage, base.count))} · ${size(o)}`)}${good(o) ? t("mv.via.good") : ""}</option>`;
  const first = (list: PassageOption[]) => [...list.filter(good), ...list.filter((o) => !good(o))];
  const keep = first(options.filter((o) => !o.widens));
  const wide = first(options.filter((o) => o.widens));
  const tips = options.filter(good).map((o) => `${name(o.item)} ${say(passageWhere(o.passage, base.count))}`);
  const advice =
    advised === null
      ? t("mv.via.compute.html")
      : tips.length
        ? esc(t("mv.via.tips", { list: tips.join(" ; ") }))
        : t("mv.via.none");
  return `<div class="pose-via"><label class="pose-pick" for="pose-via">${t("mv.via.label")}
    <select id="pose-via"><option value="">${esc(t("mv.via.ends", { w: String(base.width), h: String(base.height) }))}</option>${
      keep.length ? `<optgroup label="${esc(t("mv.via.passage"))}">${keep.map(opt).join("")}</optgroup>` : ""
    }${wide.length ? `<optgroup label="${esc(t("mv.via.widen"))}">${wide.map(opt).join("")}</optgroup>` : ""}</select></label>
    <p class="hint">${t("mv.via.hint", { advice })}</p></div>`;
}

/** « double rangée », ou « 3 blocs empilés (double rangée) » pour des rangées repliées. */
const layoutName = (m: { template: ModulePlan["template"]; folds: number }) => (m.folds > 1 ? t("mv.layout.folds", { n: String(m.folds), t: say(tplMsg(m.template)) }) : say(tplMsg(m.template)));

/** Texte autour du dessin : résumé, problèmes, ressources, pièces, ordre de pose, hypothèses. */
// ---------------------------------------------------------------- ordre de pose du joueur (S26)

/**
 * Les étapes du joueur dans chaque module (parcours B de S15) : « je construis les bâtiments, puis les tuyaux,
 * puis l'électricité, puis la logique », chacune avec sa touche du mode construction (relevée par l'utilisateur :
 * 1 « & » bâtiments, 2 « é » câbles électriques et logiques, 3 « " » tuyaux, en AZERTY).
 */
export const POSE_PHASES = [
  { key: "batiments", touche: "1", azerty: "&" },
  { key: "tuyaux", touche: "3", azerty: '"' },
  { key: "electricite", touche: "2", azerty: "é" },
  { key: "logique", touche: "2", azerty: "é" },
] as const;
export type PosePhase = (typeof POSE_PHASES)[number]["key"];

/** L'ordre de pose rangé par étape du joueur, dans le sens de l'usine ; une étape vide n'apparaît pas. */
export function phasedOrder(order: readonly Message[], rot = 0): { phase: (typeof POSE_PHASES)[number]; lines: string[] }[] {
  return POSE_PHASES.map((phase) => ({
    phase,
    lines: order.filter((o) => orderPhase(o) === phase.key).map((o) => say(turnMessage(o, rot))),
  })).filter((p) => p.lines.length);
}

/** « Ordre de pose » d'un module : par étape du joueur, avec la touche du jeu, dans le sens de l'usine. */
export function renderOrder(order: readonly Message[], rot = 0, open = true): string {
  const phases = phasedOrder(order, rot);
  return `<details class="more pose-order"${open ? " open" : ""}><summary>${t("mv.order")}${rot % 4 ? ` <span class="hint">${t("mv.order.turned")}</span>` : ""}</summary>${phases
    .map(
      ({ phase, lines }) =>
        `<h4 class="pose-phase">${t(`mv.phase.${phase.key}`)} <span class="key">${phase.touche}</span> <span class="hint">${esc(t("mv.azerty", { k: phase.azerty }))}</span></h4><ol class="steps-list">${lines.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>`,
    )
    .join("")}</details>`;
}

export function renderModuleInfo(m: ModulePlan, name: (id: string) => string, survey: SurveyState = m.portsKnown ? "depot" : "manquant", plot: { w: number; h: number } | null = null, rot = 0): { head: string; legend: string; details: string } {
  const color = netColors(m);
  const crossings = m.parts.filter((p) => /intersection/i.test(p.id));
  const crossCost = crossings.reduce((s, p) => s + (p.unitPrice ?? 0) * p.count, 0);
  const head = `<p class="mod-sum">${t("mv.sum.html", { n: String(m.count), m: esc(name(m.machine)), layout: esc(layoutName(m)), w: String(m.width), h: String(m.height), cost: esc(fmtMoney(m.cost)), unknown: m.costUnknown ? t("mv.sum.unknown") : "", cross: crossCost ? t("mv.sum.cross", { x: esc(fmtMoney(crossCost)) }) : "" })}${
    !m.portsKnown
      ? ` <span class="warn-text">${t("mv.ports.assumed")}</span>`
      : survey === "local"
        ? ` <span class="muted">${t("mv.ports.local")}</span>`
        : ""
  }</p>${plotLine(m, plot)}${
    m.other
      ? `<p class="mod-other">${esc(t("mv.other", { c: critName(m.other.first), layout: layoutName(m.other), w: String(m.other.width), h: String(m.other.height), cost: fmtMoney(m.other.cost), p: String(m.other.pieces), n: m.other.crossings }))} <button type="button" class="link small" data-first="${m.other.first}">${t("mv.other.btn")}</button></p>`
      : ""
  }${
    m.problems.length ? `<ul class="notices">${m.problems.map((p) => `<li${p.level === "erreur" ? ' class="bad"' : ""}>${txtHtml(p.message)}</li>`).join("")}</ul>` : ""
  }`;
  const legend = `<ul class="mod-legend">${m.nets
    .map(
      (n) =>
        `<li><i style="background:${color.get(n.id)}"></i>${esc(name(n.item))}${n.line ? ` ${t("mv.no", { n: String(n.line) })}` : ""} <span class="muted">· ${t(n.role === "entrée" ? "mv.lg.in" : "mv.lg.out")} ${esc(fmt(n.perSec, 2))}/s · ${n.pipe ? t("mv.lg.tier", { t: n.pipe.tier === 1 ? "I" : "III", f: String(n.pipe.flowPerSec) }) : t("mv.lg.noPipe")}</span></li>`,
    )
    .join("")}<li><i class="sw-plug"></i>${t("mv.lg.plug")}</li>${m.poles.length ? `<li><i class="sw-pole"></i>${t("mv.lg.pole")}</li>` : ""}</ul>`;
  const rows = m.parts
    .map((p) => `<tr><td>${txtHtml(p.name)}</td><td class="num">${p.count}</td><td class="num">${p.unitPrice === null ? "?" : esc(fmtMoney(p.unitPrice))}</td><td class="num">${p.unitPrice === null ? "?" : esc(fmtMoney(p.unitPrice * p.count))}</td></tr>`)
    .join("");
  const details = `${renderOrder(m.order, rot)}
    <details class="more"><summary>${t("mv.parts", { n: m.parts.reduce((s, p) => s + p.count, 0) })}</summary><div class="tablewrap"><table class="mini"><thead><tr><th>${t("mv.th.piece")}</th><th>${t("mv.th.n")}</th><th>${t("mv.th.price")}</th><th>${t("mv.th.total")}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>${t("mv.assumptions", { n: m.assumptions.length })}</summary><ul class="notes">${m.assumptions.map((a) => `<li>${txtHtml(a)}</li>`).join("")}</ul></details>`;
  return { head, legend, details };
}
