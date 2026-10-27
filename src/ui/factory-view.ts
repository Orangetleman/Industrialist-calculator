// Plan de pose de toute l'usine (S3, S4) : dessin vue de dessus (modules, tuyaux entre modules, poteaux),
// barre d'options, résumé, liste des liaisons, des passages et des machines à compléter, et panneau d'un
// module dans sa version de l'usine. Fonctions pures (chaînes HTML/SVG) ; le calcul tourne dans un Web Worker
// (factory.worker.ts) et main.ts gère l'avancement, l'annulation, le cadre navigable et les clics.
//
// Affichage piloté par des classes du cadre (sans redessiner) : `u-full` (recalculée), `u-detail` (« Tout
// afficher »), `u-nopower`, `u-plugs` (câbles vers chaque machine), `u-links` (« Afficher les liaisons »),
// `hl` (une sélection : les éléments `.on` restent vifs).

import { factoryFits, type EvacSide, type FactoryPlan } from "../engine/build/factory.ts";
import type { FactoryArrow } from "../engine/build/flow.ts";
import { STEP, type Dir } from "../engine/build/geometry.ts";
import type { PlacedPiece } from "../engine/build/module.ts";
import { colon, esc, fmt, fmtMF, fmtMoney, semi } from "./format.ts";
import { icon, withIcons } from "./icons.ts";
import { t } from "../i18n/i18n.ts";
import { pieceRole, renderModuleInfo, renderModuleSvg } from "./module-view.ts";
import type { UsineView } from "./state.ts";
import { say, txt, txtHtml } from "./engine-text.ts";

const C = 10; // unités SVG par case
/** Couleurs des ressources (les mêmes que la maquette), lisibles sur le fond sombre du cadre. */
const PALETTE = ["#f0913a", "#6cc792", "#8fb8d6", "#e3b25a", "#d77fd0", "#5fd4d4", "#ff8a80", "#c5d86d", "#b39ddb", "#ffcc80"];

type Plot = { w: number; h: number } | null;
type Name = (id: string) => string;
/** Tier du tuyau d'une liaison (1 ou 3), d'après son débit. */
type TierOf = (item: string, perMin: number) => 1 | 3 | null;
type Box = FactoryPlan["boxes"][number];

export function factoryColors(f: FactoryPlan): Map<string, string> {
  return new Map([...new Set([...f.nets.map((n) => n.item), ...(f.evacs ?? []).map((e) => e.item)])].map((it, i) => [it, PALETTE[i % PALETTE.length]!]));
}

const SIDE_DIR: Record<EvacSide, { x: number; y: number }> = { haut: { x: 0, y: -1 }, bas: { x: 0, y: 1 }, gauche: { x: -1, y: 0 }, droite: { x: 1, y: 0 } };
/** « en haut », « à gauche »… : le bord de l'usine par lequel sort un produit. */
const sideWord = (s: EvacSide): string => t(`uf.side.${s}`);
const and = () => t("uf.and");

/** Tuyaux des produits à évacuer (S27) : leur tracé, et une flèche qui sort de l'usine avec le nom du produit. */
function evacSvg(f: FactoryPlan, name: Name, color: Map<string, string>): string {
  let s = "";
  for (const ev of f.evacs ?? []) {
    let d = "";
    for (const k of ev.cells) {
      const o = f.cells.get(k);
      if (o?.kind !== "tuyau") continue;
      const [x, y] = k.split(",").map(Number) as [number, number];
      const [cx, cy] = [(x + 0.5) * C, (y + 0.5) * C];
      const links = o.net === ev.id ? o.links : o.cross?.net === ev.id ? o.cross.links : null;
      for (const dd of links ?? []) d += `M${cx},${cy} L${cx + (STEP[dd].x * C) / 2},${cy + (STEP[dd].y * C) / 2} `;
    }
    const c = color.get(ev.item) ?? "#9aa7b4";
    const tip = t("uf.evac.tip", { item: name(ev.item), r: fmt(ev.perMin, 1), side: sideWord(ev.side), ko: ev.ok ? "" : t("uf.evac.ko") });
    s += `<g class="u-net u-evac" data-item="${esc(ev.item)}" data-tip="${esc(tip)}"><path class="u-hit" d="${d}"/><path class="u-line" d="${d}" stroke="${c}" stroke-width="2.6"/>`;
    if (ev.ok) {
      const v = SIDE_DIR[ev.side];
      const [x0, y0] = [(ev.at.x + 0.5) * C, (ev.at.y + 0.5) * C];
      // La flèche s'arrête au bord de la case ; le nom se lit juste à côté, à l'intérieur du cadre.
      const [x1, y1] = [x0 + v.x * C * 0.5, y0 + v.y * C * 0.5];
      const [tx, ty, anchor] = v.y ? [x0 + 7, y0 - v.y * 2, "start"] : [x0 - v.x * 6, y0 - 7, v.x > 0 ? "end" : "start"];
      s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${c}" stroke-width="2.6" marker-end="url(#uf)"/><text class="u-evac-t" x="${tx}" y="${ty}" text-anchor="${anchor}" fill="${c}">${esc(name(ev.item))}</text>`;
    }
    s += `</g>`;
  }
  return s;
}

/** « À évacuer » sous l'usine (S27) : chaque produit, son débit, et le bord par lequel il sort (choix gardé par plan). */
export function renderFactoryEvac(f: FactoryPlan, name: Name, chosen: Partial<Record<string, EvacSide>>): string {
  const list = f.evacs ?? [];
  if (!list.length) return "";
  const opt = (v: string, label: string, on: boolean) => `<option value="${v}"${on ? " selected" : ""}>${label}</option>`;
  const rows = list
    .map((ev) => {
      const pick = chosen[ev.item];
      return `<li><span><i class="sw" style="background:${factoryColors(f).get(ev.item)}"></i>${esc(name(ev.item))} <span class="hint">${esc(fmt(ev.perMin, 1))}/min</span>${ev.ok ? "" : ` <span class="warn-text">${t("uf.evac.notDrawn")}</span>`}</span>
        <label class="sr-only" for="evac-${esc(ev.item)}">${esc(t("uf.evac.edge", { item: name(ev.item) }))}</label><select id="evac-${esc(ev.item)}" data-evac="${esc(ev.item)}">${opt("", esc(t("uf.evac.nearest", { side: sideWord(ev.side) })), !pick)}${(["haut", "bas", "gauche", "droite"] as EvacSide[]).map((s) => opt(s, esc(sideWord(s)), pick === s)).join("")}</select></li>`;
    })
    .join("");
  return `<details class="more u-evacs" open><summary>${t("uf.evac.title.html", { n: String(list.length) })}</summary><p class="hint">${t("uf.evac.hint")}</p><ul class="u-evaclist">${rows}</ul></details>`;
}

/** « tourné d'un quart de tour » (sens horaire) ; vide s'il n'est pas tourné. */
export function turnText(rot: number): string {
  const r = ((rot % 4) + 4) % 4;
  return r === 1 ? t("uf.turn.1") : r === 2 ? t("uf.turn.2") : r === 3 ? t("uf.turn.3") : "";
}

/** Infobulle d'un module : taille, rotation, prix, électricité, ce qu'il reçoit et envoie. */
function moduleTip(f: FactoryPlan, b: Box, name: Name): string {
  if (!b.mod && b.assembly) return `${b.sub} — ${b.label}\n${t("uf.tip.assembly", { w: String(b.w), h: String(b.h) })}`;
  if (!b.mod) return `${b.sub} — ${b.label}\n${t("uf.tip.reserved", { w: String(b.w), h: String(b.h) })}`;
  const sub = (key: string) => f.boxes.find((x) => x.key === key)?.sub ?? key;
  const ins = f.nets.filter((n) => n.to.includes(b.key)).map((n) => t("uf.tip.from", { item: name(n.item), m: sub(n.from) }));
  const outs = f.nets.filter((n) => n.from === b.key).map((n) => t("uf.tip.to", { item: name(n.item), r: fmt(n.perMin, 0), list: n.to.map(sub).join(and()) }));
  const passage = f.passagesKept.get(b.key);
  return [
    `${b.sub} — ${b.label}`,
    t("uf.tip.size", { w: String(b.w), h: String(b.h), folds: b.mod.folds > 1 ? t("uf.tip.folds", { n: String(b.mod.folds) }) : "", turn: turnText(b.rot) ? `, ${turnText(b.rot)}` : "", full: f.full ? t("uf.tip.full") : "" }),
    t("uf.tip.cost", { cost: fmtMoney(b.mod.cost), p: fmtMF(b.power), ports: b.mod.portsKnown ? "" : t("uf.tip.assumed") }),
    ...(ins.length ? [t("uf.tip.gets", { list: ins.join(", ") })] : []),
    ...(outs.length ? [t("uf.tip.sends", { list: outs.join(", ") })] : []),
    ...(passage ? [txt(passage.text)] : []),
    t("uf.tip.open"),
  ].join("\n");
}

/** Liaisons collées (module par module) : le point de contact, sur le bord du fournisseur. */
function contacts(f: FactoryPlan, name: Name, color: Map<string, string>): string {
  let s = "";
  for (const g of f.glued) {
    const [from, to] = g.split(">");
    const p = f.boxes.find((b) => b.key === from);
    const c = f.boxes.find((b) => b.key === to);
    const n = p?.mod?.nets.find((x) => x.role === "sortie" && x.end && c?.mod?.nets.some((y) => y.role === "entrée" && y.item === x.item));
    if (!p || !n?.end) continue;
    const x = (p.x + n.end.x + 0.5 + STEP[n.end.dir].x / 2) * C;
    const y = (p.y + n.end.y + 0.5 + STEP[n.end.dir].y / 2) * C;
    s += `<circle class="u-contact" cx="${x}" cy="${y}" r="7" fill="${color.get(n.item) ?? "#9aa7b4"}" data-tip="${esc(t("uf.contact", { item: name(n.item) }))}"/>`;
  }
  return s;
}

/** Dessin de l'usine (SVG), à placer dans un cadre navigable. La parcelle du joueur est tracée si connue. */
export function renderFactorySvg(f: FactoryPlan, name: Name, plot: Plot, tierOf: TierOf, flows: FactoryArrow[] = []): { svg: string; width: number; height: number } {
  const color = factoryColors(f);
  // S25 : le dessin est cadré sur l'usine ; la parcelle n'est qu'un repère (ses bords au-delà sont coupés).
  const VW = f.W + 2;
  const VH = f.H + 3;
  const sub = (key: string) => f.boxes.find((b) => b.key === key)?.sub ?? key;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW * C} ${VH * C}" class="usine" role="img" aria-label="${esc(t("uf.svg.aria", { w: String(f.W), h: String(f.H) }))}">`;
  s += `<defs><pattern id="ug1" width="${C}" height="${C}" patternUnits="userSpaceOnUse"><path d="M${C} 0 L0 0 0 ${C}" fill="none" stroke="#262c33" stroke-width="1"/></pattern><pattern id="ug10" width="${C * 10}" height="${C * 10}" patternUnits="userSpaceOnUse"><rect width="${C * 10}" height="${C * 10}" fill="url(#ug1)"/><path d="M${C * 10} 0 L0 0 0 ${C * 10}" fill="none" stroke="#323a43" stroke-width="1.5"/></pattern>`;
  s += `<marker id="ua" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ffd54a"/></marker><marker id="ub" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c9a83a"/></marker><marker id="uf" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#fff"/></marker></defs>`;
  s += `<rect width="${VW * C}" height="${VH * C}" fill="#1d2126"/><rect width="${VW * C}" height="${VH * C}" fill="url(#ug10)"/>`;
  if (plot) s += `<rect class="u-plot" x="0" y="0" width="${plot.w * C}" height="${plot.h * C}" data-tip="${esc(t("uf.plot.tip", { w: String(plot.w), h: String(plot.h) }))}"/><text class="u-plot-t" x="6" y="${Math.min(plot.h, VH) * C - 6}">${esc(t("uf.plot.label", { w: String(plot.w), h: String(plot.h) }))}</text>`;
  s += `<rect class="u-bbox" x="0" y="0" width="${f.W * C}" height="${f.H * C}"/><text class="u-bbox-t" x="${f.W * C - 8}" y="${f.H * C + 16}">${esc(t("uf.bbox", { w: String(f.W), h: String(f.H) }))}</text>`;
  // Modules : cadre, intérieur (machines et collecteurs), puis l'étiquette par-dessus. Survol : infobulle ; clic : panneau.
  for (const b of f.boxes) {
    s += `<g class="u-mod" data-mod="${esc(b.key)}" data-tip="${esc(moduleTip(f, b, name))}"><rect x="${b.x * C}" y="${b.y * C}" width="${b.w * C}" height="${b.h * C}" rx="6" class="${b.mod ? "u-box" : "u-farm"}"/>`;
    if (b.mod) {
      s += `<g class="u-detail">`;
      for (const m of b.mod.machines) s += `<rect x="${(b.x + m.x) * C + 1}" y="${(b.y + m.y) * C + 1}" width="${m.w * C - 2}" height="${m.h * C - 2}" rx="2" class="u-mach"/>`;
      const item = (net: string) => b.mod!.nets.find((n) => n.id === net)?.item ?? "";
      const wide = (net: string) => b.mod!.nets.find((n) => n.id === net)?.pipe?.tier === 3;
      for (const p of b.mod.pieces) {
        const cx = (b.x + p.x + 0.5) * C;
        const cy = (b.y + p.y + 0.5) * C;
        for (const [net, links] of [[p.net, p.links], ...(p.crossNet ? [[p.crossNet, p.crossLinks ?? []]] : [])] as [string, Dir[]][])
          for (const d of links) s += `<line x1="${cx}" y1="${cy}" x2="${cx + (STEP[d].x * C) / 2}" y2="${cy + (STEP[d].y * C) / 2}" stroke="${color.get(item(net)) ?? "#9aa7b4"}" stroke-width="${wide(net) ? 4 : 2.2}"/>`;
      }
      s += `</g>`;
    }
    const fs = Math.max(5, Math.min(20, ((b.w * C) / Math.max(b.sub.length, b.label.length * 0.62)) * 1.25, (b.h * C) / 4.2));
    const cx = (b.x + b.w / 2) * C;
    const cy = (b.y + b.h / 2) * C;
    s += `<g class="u-lbl"><text x="${cx}" y="${cy - fs * 0.25}" font-size="${fs.toFixed(1)}" class="u-t1">${esc(b.sub)}</text><text x="${cx}" y="${cy + fs * 0.95}" font-size="${(fs * 0.62).toFixed(1)}" class="u-t2">${esc(b.label)}</text></g></g>`;
  }
  // Tuyaux entre modules, groupés par liaison (en mode recalculé, les collecteurs raccordés en font partie).
  const byNet = new Map<string, string>();
  for (const [k, o] of f.cells) {
    if (o.kind !== "tuyau") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    const cx = (x + 0.5) * C;
    const cy = (y + 0.5) * C;
    for (const [net, links] of [[o.net, o.links], ...(o.cross ? [[o.cross.net, o.cross.links]] : [])] as [string, Set<Dir>][]) {
      let path = byNet.get(net) ?? "";
      for (const d of links) path += `M${cx},${cy} L${cx + (STEP[d].x * C) / 2},${cy + (STEP[d].y * C) / 2} `;
      byNet.set(net, path);
    }
  }
  for (const n of f.nets) {
    const tier = tierOf(n.item, n.perMin) ?? 3;
    const tip = t("uf.net.tip", { item: name(n.item), r: fmt(n.perMin, 0), from: sub(n.from), to: n.to.map(sub).join(and()), cells: String(f.netCells[n.id] ?? 0), full: f.full ? t("uf.net.full") : "", tier: tier === 3 ? "III" : "I" });
    s += `<g class="u-net" data-sel="n:${esc(n.id)}" data-item="${esc(n.item)}" data-tip="${esc(`${tip}\n${t("uf.net.click")}`)}"><path class="u-hit" d="${byNet.get(n.id) ?? ""}"/><path class="u-line" d="${byNet.get(n.id) ?? ""}" stroke="${color.get(n.item)}" stroke-width="${tier === 3 ? 4.6 : 2.6}"/></g>`;
  }
  s += evacSvg(f, name, color);
  const netItem = (id: string) => name(f.nets.find((n) => n.id === id)?.item ?? f.evacs?.find((e) => e.id === id)?.item ?? "");
  for (const [k, o] of f.cells) {
    if (o.kind !== "tuyau" || !o.cross) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    s += `<rect class="u-xing" x="${(x + 0.5) * C - 4}" y="${(y + 0.5) * C - 4}" width="8" height="8" rx="1.5" data-tip="${esc(t("uf.crossing", { a: netItem(o.net) || t("uf.manifold"), b: netItem(o.cross.net) || t("uf.manifold") }))}"/>`;
  }
  s += contacts(f, name, color);
  // Vecteurs des liaisons, par ressource : de 15 % à 85 % du trajet, pour qu'ils se suivent comme une chaîne.
  // Ceux de l'intérieur des modules (module par module) suivent « Tout afficher ».
  const groups = new Map<string, string>();
  for (const a of flows) {
    const at = (t: number) => [(a.x1 + (a.x2 - a.x1) * t) * C, (a.y1 + (a.y2 - a.y1) * t) * C].map((v) => v.toFixed(1));
    const [[x1, y1], [x2, y2]] = [at(0.15), at(0.85)] as [string[], string[]];
    const k = `${a.item}|${!f.full && a.net.includes("~") ? "in" : "out"}`;
    groups.set(k, (groups.get(k) ?? "") + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#uf)"/>`);
  }
  s += `<g class="u-flows">${[...groups].map(([k, l]) => `<g class="u-flow${k.endsWith("|in") ? " u-detail" : ""}" data-item="${esc(k.slice(0, k.lastIndexOf("|")))}">${l}</g>`).join("")}</g>`;
  // Réseau électrique : câbles poteau → prise de chaque machine, câbles entre poteaux (ceux d'un même module à
  // part), poteaux, arrivée. Chaque câble garde sa flèche (sens du courant, depuis l'arrivée).
  s += `<g class="u-power">`;
  for (const p of f.poleNodes) for (const q of p.plugs) s += `<line class="u-plug" data-pole="${esc(p.id)}" x1="${p.x * C}" y1="${p.y * C}" x2="${q.x * C}" y2="${q.y * C}" marker-end="url(#ub)"/>`;
  for (const l of f.links) {
    const tip = t("uf.cable.tip", { what: t(l.internal ? "uf.cable.internal" : "uf.cable"), to: l.to.module ? sub(l.to.module) : t("uf.cable.pole", { n: l.to.plugs.length }), load: fmtMF(l.load), type: l.to.type.name, cap: fmtMF(l.to.type.capacityMFps), lines: l.lines > 1 ? t("uf.cable.lines", { n: String(l.lines) }) : "", relays: l.relays ? t("uf.cable.relays", { n: String(l.relays), type: l.relayType.name, r: String(l.relayType.rangeCells) }) : "" });
    s += `<g class="u-cable${l.internal ? " internal" : ""}${l.lines > 1 ? " over" : ""}" data-sel="c:${esc(l.to.id)}" data-pole="${esc(l.to.id)}" data-parent="${esc(l.from.id)}" data-tip="${esc(`${tip}\n${t("uf.cable.click")}`)}"><line class="u-cable-hit" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}"/><line class="u-cable-line" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}" marker-end="url(#ua)"/></g>`;
  }
  for (const p of f.poleNodes) s += `<rect class="u-pole" x="${(p.x - p.type.size.w / 2) * C}" y="${(p.y - p.type.size.h / 2) * C}" width="${p.type.size.w * C}" height="${p.type.size.h * C}" data-tip="${esc(t("uf.pole.tip", { type: p.type.name, n: String(p.plugs.length), load: fmtMF(p.load), cap: fmtMF(p.type.capacityMFps) }))}"/>`;
  s += `<circle cx="${f.feed.x * C}" cy="${f.feed.y * C}" r="9" class="u-feed" data-tip="${esc(t("uf.feed", { p: fmtMF(f.stats.total) }))}"/>`;
  s += `</g>`;
  return { svg: s + "</svg>", width: VW * C, height: VH * C };
}

/** Classes du cadre pour les réglages d'affichage (sans redessiner). */
export function factoryFrameClasses(v: UsineView, full: boolean): Record<string, boolean> {
  return { "u-full": full, "u-detail": v.detail, "u-nopower": !v.power, "u-plugs": v.plugs, "u-links": v.links };
}

/** Bouton « Afficher les liaisons », bien en vue (vue de l'usine et vue d'un module). */
export function linksButton(on: boolean): string {
  return `<button type="button" class="u-links-btn" data-uopt="links" aria-pressed="${on}">${icon("link")} ${t(on ? "uf.links.on" : "uf.links.off")}</button>`;
}

const radio = (opt: string, value: string, on: boolean, label: string, why: string) =>
  `<label title="${esc(why)}"><input type="radio" name="u-${opt}" data-uopt="${opt}" value="${value}"${on ? " checked" : ""}> ${label}</label>`;

/**
 * Barre au-dessus de l'usine (S25) : les trois réglages dont le joueur se sert (« Tout afficher », « Réseau
 * électrique », « Afficher les liaisons ») ; le calcul et les liaisons collées passent dans « Plus d'options »
 * (renderFactoryMore), « Câbles » est retiré (« Afficher les liaisons » montre aussi les câbles vers les machines).
 */
export function renderFactoryBar(v: UsineView): string {
  const check = (opt: keyof UsineView, label: string, why: string) => `<label class="u-tog" title="${esc(why)}"><input type="checkbox" data-uopt="${opt}"${v[opt] ? " checked" : ""}> ${label}</label>`;
  return `<div class="u-bar" role="group" aria-label="${esc(t("uf.bar.aria"))}">
    ${check("detail", t("uf.detail"), t("uf.detail.why"))}${check("power", t("uf.power"), t("uf.power.why"))}
    ${linksButton(v.links)}
  </div>
  <p class="hint u-hint">${t(v.links ? "uf.hint.links" : "uf.hint")}</p>`;
}

/** « Plus d'options » de l'usine : le calcul (module par module par défaut, S25) et les liaisons collées. */
export function renderFactoryMore(v: UsineView): string {
  return `<div class="u-bar" role="group" aria-label="${esc(t("uf.more.aria"))}">
    <span class="grp"><b>${t("uf.calc")}</b>${radio("full", "0", !v.full, t("uf.byModule"), t("uf.byModule.why"))}${radio("full", "1", v.full, t("uf.full"), t("uf.full.why"))}</span>
    <span class="grp${v.full ? " off" : ""}"><b>${t("uf.links")}</b>${radio("glue", "0", !v.glue, t("uf.pipes"), t("uf.pipes.why"))}${radio("glue", "1", v.glue, t("uf.glue"), t("uf.glue.why"))}</span>
  </div>`;
}

/** Liste des modules à côté de l'usine (S25) : « posé ✓ » quand il est construit en jeu ; il se grise dans le dessin. */
/** `warn` : le ⚠ cliquable d'un module qui utilise une valeur à vérifier (S28), en HTML. */
export function renderFactoryModules(f: FactoryPlan, posed: ReadonlySet<string>, warn: (key: string) => string = () => ""): string {
  const n = f.boxes.filter((b) => posed.has(b.key)).length;
  const rows = f.boxes
    .map((b) => `<li><label${posed.has(b.key) ? ' class="done"' : ""}><input type="checkbox" data-posed="${esc(b.key)}"${posed.has(b.key) ? " checked" : ""}> ${esc(b.label)} — ${esc(b.sub)}</label>${warn(b.key) ? ` ${warn(b.key)}` : ""} <button type="button" class="link small" data-focus="${esc(b.key)}">${t("uf.open")}</button></li>`)
    .join("");
  return `<details class="more u-mods" open><summary>${t("uf.mods.title.html", { n: String(f.boxes.length), posed: t("uf.mods.posed", { n, total: f.boxes.length }) })}</summary><p class="hint">${t("uf.mods.hint")}</p><ul class="u-modlist">${rows}</ul></details>`;
}

/** Machines incomplètes dans le plan de pose : pas dessinées, ports supposés, prix inconnus, problèmes. */
export function incompleteMachines(f: FactoryPlan): { box: Box; reasons: string[]; survey: boolean }[] {
  const out: { box: Box; reasons: string[]; survey: boolean }[] = [];
  for (const b of f.boxes) {
    const reasons: string[] = [];
    if (!b.mod) reasons.push(t("uf.why.reserved", { w: String(b.w), h: String(b.h) }));
    else {
      if (!b.mod.portsKnown) reasons.push(t("uf.why.ports"));
      if (b.mod.costUnknown) reasons.push(t("uf.why.price", { n: b.mod.costUnknown }));
      for (const p of b.mod.problems) reasons.push(txt(p.message));
    }
    if (reasons.length) out.push({ box: b, reasons, survey: !!b.mod && !b.mod.portsKnown });
  }
  return out;
}

/**
 * Liaisons non tracées (S25, F11) : avec les noms du jeu, pas les clés internes (« water → oak-log »). Une liaison
 * vers une place réservée (ferme d'arbres…) est prévue : la place n'a pas de port ; c'est une note, pas une erreur.
 */
function unlinked(f: FactoryPlan, name: Name, sub: (key: string) => string): string {
  if (!f.problems.length) return "";
  const reserved = new Set(f.boxes.filter((b) => !b.mod).map((b) => b.key));
  let expected = true;
  const text = f.problems.map((p) => {
    const from = String(p.from ?? "");
    const to = p.code === "fac.unrouted" ? String(p.to ?? "") : "";
    if (p.code !== "fac.unrouted" || (!reserved.has(to) && !reserved.has(from))) expected = false;
    return say({ ...p, from: sub(from), ...(to ? { to: sub(to) } : {}) });
  });
  return expected
    ? `<p class="mod-other hint">${esc(t("uf.unlinked.manual", { n: f.problems.length, list: text.join(semi()) }))}</p>`
    : `<ul class="notices"><li class="bad">${esc(t("uf.unlinked", { n: String(f.problems.length), list: text.join(semi()) }))}</li></ul>`;
}

/** Texte autour du dessin : résumé, légende, liaisons, passages et machines à compléter. */
export function renderFactoryInfo(f: FactoryPlan, name: Name, plot: Plot, tierOf: TierOf, ms: number, glue = false, cached = false): { head: string; legend: string; details: string } {
  const color = factoryColors(f);
  const st = f.stats;
  const sub = (key: string) => f.boxes.find((b) => b.key === key)?.sub ?? key;
  const fit = plot ? factoryFits(f, plot) : null;
  const plotText = !plot
    ? `<p class="mod-other">${t("uf.plot.none.html")}</p>`
    : fit === "non"
      ? `<p class="mod-fit warn-text">${t("uf.plot.no", { w: String(plot.w), h: String(plot.h) })}</p>`
      : `<p class="mod-fit ok-text">${t("uf.plot.fits", { w: String(plot.w), h: String(plot.h), turned: fit === "tourné" ? t("uf.plot.turned") : "" })}</p>`;
  const missing = incompleteMachines(f);
  const pipes = f.full ? t("uf.pipes.full", { n: fmt(st.allPipeCells, 0) }) : t("uf.pipes.mod", { a: fmt(st.pipeCells, 0), b: fmt(st.allPipeCells, 0) });
  const sum = t("uf.sum.html", {
    w: String(f.W),
    h: String(f.H),
    mods: t("uf.n.modules", { n: f.boxes.length }),
    pipes,
    xings: t("uf.n.crossings", { n: st.allCrossings }),
    contacts: f.glued.length ? t("uf.n.contacts", { n: f.glued.length }) : "",
    power: esc(fmtMF(st.total)),
    poles: t("uf.n.poles", { n: String(f.poleNodes.length) }),
    relays: st.relays ? t("uf.relays", { n: String(st.relays) }) : "",
    upgraded: st.upgraded ? t("uf.upgraded", { n: String(st.upgraded) }) : "",
    cost: esc(fmtMoney(st.polesCost)),
  });
  const mode = f.full
    ? t("uf.mode.full", { pruned: st.pruned ? t("uf.pruned", { n: st.pruned }) : "" })
    : t("uf.mode.mod", { glue: glue ? t("uf.mode.glue", { none: f.glued.length ? "" : t("uf.mode.noGlue") }) : "" });
  const head = `<p class="mod-sum">${sum}</p>${plotText}${unlinked(f, name, sub)}${st.overloaded ? `<ul class="notices"><li>${t("uf.overloaded", { n: String(st.overloaded) })}</li></ul>` : ""}${
    missing.length ? `<p class="mod-other warn-text">${t("uf.incomplete", { n: missing.length })}</p>` : ""
  }<p class="mod-other">${mode}${t("uf.time", { s: fmt(ms / 1000, 1), cached: cached ? t("uf.cached") : "" })}</p>${
    f.cut ? `<p class="mod-other warn-text">${t("uf.cut", { s: fmt(ms / 1000, 0) })} <button type="button" class="small" data-usine="complete">${t("uf.cut.more")}</button></p>` : ""
  }`;
  const items = [...color.keys()];
  const legend = `<ul class="mod-legend">${items.map((it) => `<li><i style="background:${color.get(it)}"></i>${esc(name(it))}</li>`).join("")}<li><i class="sw-pole"></i>${t("mv.lg.pole")}</li><li><i class="sw-cable"></i>${t("uf.lg.cable")}</li><li><i class="sw-flow"></i>${t("uf.lg.flow")}</li>${plot ? `<li><i class="sw-plot"></i>${t("uf.lg.plot")}</li>` : ""}</ul>`;
  const rows = f.nets
    .map((n) => {
      const tier = tierOf(n.item, n.perMin);
      return `<tr data-sel="n:${esc(n.id)}"><td><i class="sw" style="background:${color.get(n.item)}"></i>${esc(name(n.item))}</td><td>${esc(sub(n.from))}</td><td>${esc(n.to.map(sub).join(", "))}</td><td class="num">${esc(fmt(n.perMin, 0))}/min</td><td class="num">${f.netCells[n.id] ?? 0}</td><td>${tier ? t("uf.tier", { t: tier === 1 ? "I" : "III" }) : "—"}</td></tr>`;
    })
    .join("");
  const passages = [...f.passagesKept].map(([k, p]) => `<li><b>${esc(sub(k))}</b>${colon()}${txtHtml(p.text)}</li>`).join("");
  const machines = missing
    .map(
      ({ box: b, reasons, survey }) =>
        `<li><b>${esc(b.sub)}</b> <span class="muted">(${esc(b.label)})</span>${colon()}${esc(reasons.join(semi()))}.${b.mod ? ` <button type="button" class="link small" data-focus="${esc(b.key)}">${t("uf.seeModule")}</button>` : ""}${survey ? ` · <button type="button" class="link small" data-edit="${esc(b.machine)}">${withIcons(esc(t("uf.record", { m: name(b.machine) })))}</button>` : ""}</li>`,
    )
    .join("");
  const details = `<details class="more"><summary>${t("uf.d.links", { n: f.nets.length })}</summary><p class="hint">${t("uf.d.links.hint")}</p><div class="tablewrap"><table class="mini u-rows"><thead><tr><th>${t("uf.th.product")}</th><th>${t("uf.th.from")}</th><th>${t("uf.th.to")}</th><th>${t("uf.th.rate")}</th><th>${t("uf.th.cells")}</th><th>${t("uf.th.pipe")}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>${t("uf.d.passages", { n: f.passagesKept.size })}</summary>${passages ? `<ul class="notes">${passages}</ul><p class="hint">${t("uf.d.passages.hint")}</p>` : `<p class="hint">${t(f.full ? "uf.d.passages.none.full" : "uf.d.passages.none")}</p>`}</details>
    <details class="more"><summary>${t("uf.d.missing", { n: missing.length })}</summary>${machines ? `<ul class="notes">${machines}</ul><p class="hint">${t("uf.d.missing.hint")}</p>` : `<p class="hint">${t("uf.d.missing.none")}</p>`}</details>`;
  return { head, legend, details };
}

/**
 * Panneau d'un module dans sa version de l'usine : le dessin (machines, collecteurs, prises et tuyaux de l'usine
 * qui passent par là, tourné comme dans l'usine), le résumé et les détails. null si le module n'est pas dessiné.
 */
export function renderFactoryModule(
  f: FactoryPlan,
  key: string,
  name: Name,
  tierOf: TierOf,
  flows: FactoryArrow[],
): { title: string; svg: { svg: string; width: number; height: number }; head: string; legend: string; details: string } | null {
  const b = f.boxes.find((x) => x.key === key);
  if (!b?.mod) return null;
  const m = b.mod;
  const color = factoryColors(f);
  const inter = new Map(f.nets.map((n) => [n.id, n]));
  const box = new Map(f.boxes.map((x) => [x.key, x]));
  // Réseaux : de l'usine (« étape:objet »), d'un collecteur dans la grille (« étape~réseau ») ou du module.
  const itemOf = (net: string) => {
    const n = inter.get(net);
    if (n) return n.item;
    const ev = f.evacs?.find((e) => e.id === net);
    if (ev) return ev.item; // tuyau d'un produit à évacuer (S27)
    const i = net.indexOf("~");
    if (i >= 0) return box.get(net.slice(0, i))?.mod?.nets.find((x) => x.id === net.slice(i + 1))?.item ?? net;
    return m.nets.find((x) => x.id === net)?.item ?? net;
  };
  const wide = (net: string) => {
    const n = inter.get(net);
    if (n) return tierOf(n.item, n.perMin) === 3;
    const id = net.includes("~") ? net.slice(net.indexOf("~") + 1) : net;
    return m.nets.find((x) => x.id === id)?.pipe?.tier === 3;
  };
  // Fenêtre du dessin d'un module : 2 cases de marge à gauche et à droite, 1 en haut et en bas.
  const inside = (x: number, y: number) => x >= b.x - 2 && x < b.x + b.w + 2 && y >= b.y - 1 && y < b.y + b.h + 1;
  const pieces: PlacedPiece[] = f.full ? [] : m.pieces.map((p) => ({ ...p }));
  for (const [k, o] of f.cells) {
    if (o.kind !== "tuyau") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    if (!inside(x, y)) continue;
    const links = [...o.links];
    pieces.push({ x: x - b.x, y: y - b.y, net: o.net, links, role: pieceRole(links, !!o.cross), pieceId: null, ...(o.cross ? { crossNet: o.cross.net, crossLinks: [...o.cross.links] } : {}) });
  }
  const mine = flows
    .filter((a) => inside(Math.floor((a.x1 + a.x2) / 2), Math.floor((a.y1 + a.y2) / 2)))
    .map((a) => ({ net: a.net, x1: a.x1 - b.x, y1: a.y1 - b.y, x2: a.x2 - b.x, y2: a.y2 - b.y }));
  const sub = (k: string) => box.get(k)?.sub ?? k;
  // Infobulle d'un tuyau de l'usine (S27 bis) : liaison entre modules, évacuation, collecteur d'un module.
  const netTip = (net: string): string | null => {
    const n = inter.get(net);
    if (n) {
      const tier = tierOf(n.item, n.perMin);
      return t("uf.mtip.link", { item: name(n.item), r: fmt(n.perMin, 1), from: sub(n.from), to: n.to.map(sub).join(and()), tier: tier ? t("uf.mtip.tier", { t: tier === 3 ? "III" : "I" }) : "" });
    }
    const ev = f.evacs?.find((e) => e.id === net);
    if (ev) return t("uf.evac.tip", { item: name(ev.item), r: fmt(ev.perMin, 1), side: sideWord(ev.side), ko: "" });
    const i = net.indexOf("~");
    if (i < 0) return null;
    const owner = box.get(net.slice(0, i));
    const c = owner?.mod?.nets.find((x) => x.id === net.slice(i + 1));
    if (!c) return null;
    return t("uf.mtip.manifold", { item: name(c.item), role: t(c.role === "entrée" ? "mv.net.in" : "mv.net.out"), owner: owner!.sub, r: fmt(c.perSec, 2), pipe: c.pipe ? t("mv.net.pipe", { t: c.pipe.tier === 1 ? "I" : "III", f: String(c.pipe.flowPerSec) }) : "" });
  };
  const svg = renderModuleSvg(m, name, { pieces, flows: mine, item: itemOf, wide, color: (net) => color.get(itemOf(net)) ?? "#9aa7b4", netTip });
  // S26 : l'ordre de pose dans le sens où le module est posé dans l'usine, replié (le dessin suffit souvent).
  const info = renderModuleInfo(m, name, undefined, null, b.rot);
  const ins = f.nets.filter((n) => n.to.includes(key));
  const outs = f.nets.filter((n) => n.from === key);
  const passage = f.passagesKept.get(key);
  const turn = turnText(b.rot);
  const head = `<p class="mod-sum">${t("uf.mod.sum.html", { title: `${esc(b.label)} — ${esc(b.sub)}`, w: String(b.w), h: String(b.h), cost: esc(fmtMoney(m.cost)), unknown: m.costUnknown ? t("mv.sum.unknown") : "", p: esc(fmtMF(b.power)) })}${m.portsKnown ? "" : ` <span class="warn-text">${t("mv.ports.assumed")}</span>`}</p>
    <p class="mod-other">${t("uf.mod.version", { how: t(f.full ? "uf.mod.full" : "uf.mod.alone"), turn: turn ? t("uf.mod.turn", { turn }) : "", passage: passage ? ` ${txtHtml(passage.text)}.` : "" })}</p>
    ${ins.length ? `<p class="mod-other">${t("uf.mod.gets", { list: ins.map((n) => `${esc(name(n.item))} <span class="muted">${esc(t("uf.mod.from", { m: sub(n.from) }))}</span>`).join(", ") })}</p>` : ""}
    ${outs.length ? `<p class="mod-other">${t("uf.mod.sends", { list: outs.map((n) => `${esc(name(n.item))} ${esc(fmt(n.perMin, 0))}/min <span class="muted">${esc(t("uf.mod.to", { list: n.to.map(sub).join(and()) }))}</span>`).join(", ") })}</p>` : ""}
    ${m.problems.length ? `<ul class="notices">${m.problems.map((p) => `<li${p.level === "erreur" ? ' class="bad"' : ""}>${txtHtml(p.message)}</li>`).join("")}</ul>` : ""}`;
  const items = [...new Set(m.nets.map((n) => n.item))];
  const legend = `<ul class="mod-legend">${items.map((it) => `<li><i style="background:${color.get(it) ?? "#9aa7b4"}"></i>${esc(name(it))}</li>`).join("")}<li><i class="sw-plug"></i>${t("mv.lg.plug")}</li>${m.poles.length ? `<li><i class="sw-pole"></i>${t("mv.lg.pole")}</li>` : ""}<li><i class="sw-flow"></i>${t("uf.lg.flow")}</li></ul>`;
  const details = info.details.replace('<details class="more pose-order" open>', '<details class="more pose-order">');
  return { title: `${b.label} — ${b.sub}`, svg, head, legend, details };
}
