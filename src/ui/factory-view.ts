// Plan de pose de toute l'usine (S3, S4) : dessin vue de dessus (modules, tuyaux entre modules, poteaux),
// barre d'options, résumé, liste des liaisons, des passages et des machines à compléter, et panneau d'un
// module dans sa version de l'usine. Fonctions pures (chaînes HTML/SVG) ; le calcul tourne dans un Web Worker
// (factory.worker.ts) et main.ts gère l'avancement, l'annulation, le cadre navigable et les clics.
//
// Affichage piloté par des classes du cadre (sans redessiner) : `u-full` (recalculée), `u-detail` (« Tout
// afficher »), `u-nopower`, `u-plugs` (câbles vers chaque machine), `u-links` (« Afficher les liaisons »),
// `hl` (une sélection : les éléments `.on` restent vifs).

import { factoryFits, type FactoryPlan } from "../engine/build/factory.ts";
import type { FactoryArrow } from "../engine/build/flow.ts";
import { STEP, type Dir } from "../engine/build/geometry.ts";
import type { PlacedPiece } from "../engine/build/module.ts";
import { esc, fmt, fmtMF, fmtMoney } from "./format.ts";
import { pieceRole, renderModuleInfo, renderModuleSvg } from "./module-view.ts";
import type { UsineView } from "./state.ts";

const C = 10; // unités SVG par case
/** Couleurs des ressources (les mêmes que la maquette), lisibles sur le fond sombre du cadre. */
const PALETTE = ["#f0913a", "#6cc792", "#8fb8d6", "#e3b25a", "#d77fd0", "#5fd4d4", "#ff8a80", "#c5d86d", "#b39ddb", "#ffcc80"];

type Plot = { w: number; h: number } | null;
type Name = (id: string) => string;
/** Tier du tuyau d'une liaison (1 ou 3), d'après son débit. */
type TierOf = (item: string, perMin: number) => 1 | 3 | null;
type Box = FactoryPlan["boxes"][number];

export function factoryColors(f: FactoryPlan): Map<string, string> {
  return new Map([...new Set(f.nets.map((n) => n.item))].map((it, i) => [it, PALETTE[i % PALETTE.length]!]));
}

/** « tourné d'un quart de tour » (sens horaire) ; vide s'il n'est pas tourné. */
export function turnText(rot: number): string {
  return ["", "tourné d'un quart de tour", "tourné d'un demi-tour", "tourné de trois quarts de tour"][rot % 4] ?? "";
}

/** Infobulle d'un module : taille, rotation, prix, électricité, ce qu'il reçoit et envoie. */
function moduleTip(f: FactoryPlan, b: Box, name: Name): string {
  if (!b.mod && b.assembly) return `${b.sub} — ${b.label}\nPlace de son plan de pose : ${b.w} × ${b.h} cases · clique pour l'ouvrir à côté.`;
  if (!b.mod) return `${b.sub} — ${b.label}\nPas encore dessiné : emplacement réservé de ${b.w} × ${b.h} cases.`;
  const sub = (key: string) => f.boxes.find((x) => x.key === key)?.sub ?? key;
  const ins = f.nets.filter((n) => n.to.includes(b.key)).map((n) => `${name(n.item)} (de ${sub(n.from)})`);
  const outs = f.nets.filter((n) => n.from === b.key).map((n) => `${name(n.item)} ${fmt(n.perMin, 0)}/min vers ${n.to.map(sub).join(" et ")}`);
  const passage = f.passagesKept.get(b.key);
  return [
    `${b.sub} — ${b.label}`,
    `${b.w} × ${b.h} cases${b.mod.folds > 1 ? ` en ${b.mod.folds} blocs` : ""}${turnText(b.rot) ? `, ${turnText(b.rot)}` : ""}${f.full ? ", recalculé pour l'usine" : ""}`,
    `${fmtMoney(b.mod.cost)} · consomme ${fmtMF(b.power)}${b.mod.portsKnown ? "" : " · ports supposés"}`,
    ...(ins.length ? [`Reçoit : ${ins.join(", ")}`] : []),
    ...(outs.length ? [`Envoie : ${outs.join(", ")}`] : []),
    ...(passage ? [passage.text] : []),
    "Clique pour ouvrir le module à côté",
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
    s += `<circle class="u-contact" cx="${x}" cy="${y}" r="7" fill="${color.get(n.item) ?? "#9aa7b4"}" data-tip="${esc(`Contact direct : ${name(n.item)}, sans tuyau`)}"/>`;
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
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW * C} ${VH * C}" class="usine" role="img" aria-label="Toute l'usine vue de dessus : ${f.W} × ${f.H} cases">`;
  s += `<defs><pattern id="ug1" width="${C}" height="${C}" patternUnits="userSpaceOnUse"><path d="M${C} 0 L0 0 0 ${C}" fill="none" stroke="#262c33" stroke-width="1"/></pattern><pattern id="ug10" width="${C * 10}" height="${C * 10}" patternUnits="userSpaceOnUse"><rect width="${C * 10}" height="${C * 10}" fill="url(#ug1)"/><path d="M${C * 10} 0 L0 0 0 ${C * 10}" fill="none" stroke="#323a43" stroke-width="1.5"/></pattern>`;
  s += `<marker id="ua" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ffd54a"/></marker><marker id="ub" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c9a83a"/></marker><marker id="uf" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#fff"/></marker></defs>`;
  s += `<rect width="${VW * C}" height="${VH * C}" fill="#1d2126"/><rect width="${VW * C}" height="${VH * C}" fill="url(#ug10)"/>`;
  if (plot) s += `<rect class="u-plot" x="0" y="0" width="${plot.w * C}" height="${plot.h * C}" data-tip="${esc(`Ta parcelle : ${plot.w} × ${plot.h} cases`)}"/><text class="u-plot-t" x="${Math.min(plot.w, VW) * C - 10}" y="16">ta parcelle ${plot.w} × ${plot.h}</text>`;
  s += `<rect class="u-bbox" x="0" y="0" width="${f.W * C}" height="${f.H * C}"/><text class="u-bbox-t" x="${f.W * C - 8}" y="${f.H * C + 16}">usine ${f.W} × ${f.H}</text>`;
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
      let t = byNet.get(net) ?? "";
      for (const d of links) t += `M${cx},${cy} L${cx + (STEP[d].x * C) / 2},${cy + (STEP[d].y * C) / 2} `;
      byNet.set(net, t);
    }
  }
  for (const n of f.nets) {
    const tier = tierOf(n.item, n.perMin) ?? 3;
    const tip = `${name(n.item)} · ${fmt(n.perMin, 0)}/min — de ${sub(n.from)} vers ${n.to.map(sub).join(" et ")} · ${f.netCells[n.id] ?? 0} cases de tuyau${f.full ? ", collecteurs des modules compris" : ""} · tier ${tier === 3 ? "III" : "I"}`;
    s += `<g class="u-net" data-sel="n:${esc(n.id)}" data-item="${esc(n.item)}" data-tip="${esc(`${tip}\nClique pour voir ses liaisons`)}"><path class="u-hit" d="${byNet.get(n.id) ?? ""}"/><path class="u-line" d="${byNet.get(n.id) ?? ""}" stroke="${color.get(n.item)}" stroke-width="${tier === 3 ? 4.6 : 2.6}"/></g>`;
  }
  const netItem = (id: string) => name(f.nets.find((n) => n.id === id)?.item ?? "");
  for (const [k, o] of f.cells) {
    if (o.kind !== "tuyau" || !o.cross) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    s += `<rect class="u-xing" x="${(x + 0.5) * C - 4}" y="${(y + 0.5) * C - 4}" width="8" height="8" rx="1.5" data-tip="${esc(`Croisement : ${netItem(o.net) || "collecteur"} / ${netItem(o.cross.net) || "collecteur"}`)}"/>`;
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
    const tip = `${l.internal ? "Câble entre deux poteaux du module" : "Câble"} vers ${l.to.module ? sub(l.to.module) : `un poteau (${l.to.plugs.length} prise${l.to.plugs.length > 1 ? "s" : ""})`} : porte ${fmtMF(l.load)} (tout ce qui est en aval) ; un ${l.to.type.name} porte ${fmtMF(l.to.type.capacityMFps)}${l.lines > 1 ? ` : ${l.lines} lignes en parallèle` : ""}${l.relays ? ` · ${l.relays} relais ${l.relayType.name} (portée ${l.relayType.rangeCells} cases)` : ""}`;
    s += `<g class="u-cable${l.internal ? " internal" : ""}${l.lines > 1 ? " over" : ""}" data-sel="c:${esc(l.to.id)}" data-pole="${esc(l.to.id)}" data-parent="${esc(l.from.id)}" data-tip="${esc(`${tip}\nClique pour voir ce qu'il alimente`)}"><line class="u-cable-hit" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}"/><line class="u-cable-line" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}" marker-end="url(#ua)"/></g>`;
  }
  for (const p of f.poleNodes) s += `<rect class="u-pole" x="${(p.x - p.type.size.w / 2) * C}" y="${(p.y - p.type.size.h / 2) * C}" width="${p.type.size.w * C}" height="${p.type.size.h * C}" data-tip="${esc(`${p.type.name} : ${p.plugs.length} prise(s), ${fmtMF(p.load)} sur ${fmtMF(p.type.capacityMFps)}`)}"/>`;
  s += `<circle cx="${f.feed.x * C}" cy="${f.feed.y * C}" r="9" class="u-feed" data-tip="${esc(`Arrivée du réseau électrique (${fmtMF(f.stats.total)} pour toute l'usine)`)}"/>`;
  s += `</g>`;
  return { svg: s + "</svg>", width: VW * C, height: VH * C };
}

/** Classes du cadre pour les réglages d'affichage (sans redessiner). */
export function factoryFrameClasses(v: UsineView, full: boolean): Record<string, boolean> {
  return { "u-full": full, "u-detail": v.detail, "u-nopower": !v.power, "u-plugs": v.plugs, "u-links": v.links };
}

/** Bouton « Afficher les liaisons », bien en vue (vue de l'usine et vue d'un module). */
export function linksButton(on: boolean): string {
  return `<button type="button" class="u-links-btn" data-uopt="links" aria-pressed="${on}">⇄ ${on ? "Liaisons affichées" : "Afficher les liaisons"}</button>`;
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
  return `<div class="u-bar" role="group" aria-label="Affichage de l'usine">
    ${check("detail", "Tout afficher", "Montre l'intérieur des modules (machines et collecteurs) et les câbles entre les poteaux d'un même module.")}${check("power", "Réseau électrique", "Montre les poteaux et les câbles.")}
    ${linksButton(v.links)}
  </div>
  <p class="hint u-hint">${v.links ? "Toutes les liaisons sont tracées : une flèche blanche par liaison entre deux pièces, dans le sens du flux, et les câbles électriques de chaque poteau vers ses voisins et ses machines." : "Clique un tuyau pour voir ses liaisons, un câble pour voir ce qu'il alimente, un module pour ouvrir son plan."}</p>`;
}

/** « Plus d'options » de l'usine : le calcul (module par module par défaut, S25) et les liaisons collées. */
export function renderFactoryMore(v: UsineView): string {
  return `<div class="u-bar" role="group" aria-label="Calcul de l'usine">
    <span class="grp"><b>Calcul</b>${radio("full", "0", !v.full, "module par module", "Chaque module tel que son plan de pose seul, relié aux autres par des tuyaux ; le plus rapide.")}${radio("full", "1", v.full, "recalculé pour l'usine entière", "Une seule prise par collecteur, modules réorganisés et tournés vers leurs voisins ; plus de calcul.")}</span>
    <span class="grp${v.full ? " off" : ""}"><b>Liaisons</b>${radio("glue", "0", !v.glue, "des tuyaux", "Chaque liaison entre deux modules a son tuyau.")}${radio("glue", "1", v.glue, "coller quand c'est possible", "Une sortie collée contre l'entrée du module suivant, sans tuyau (module par module seulement).")}</span>
  </div>`;
}

/** Liste des modules à côté de l'usine (S25) : « posé ✓ » quand il est construit en jeu ; il se grise dans le dessin. */
export function renderFactoryModules(f: FactoryPlan, posed: ReadonlySet<string>): string {
  const n = f.boxes.filter((b) => posed.has(b.key)).length;
  const rows = f.boxes
    .map((b) => `<li><label${posed.has(b.key) ? ' class="done"' : ""}><input type="checkbox" data-posed="${esc(b.key)}"${posed.has(b.key) ? " checked" : ""}> ${esc(b.label)} — ${esc(b.sub)}</label> <button type="button" class="link small" data-focus="${esc(b.key)}">ouvrir</button></li>`)
    .join("");
  return `<details class="more u-mods" open><summary>Modules (${f.boxes.length}) <span class="hint">${n} posé${n > 1 ? "s" : ""} sur ${f.boxes.length}</span></summary><p class="hint">Coche un module quand il est construit en jeu : il se grise dans le dessin. Gardé pour ce plan, dans ce navigateur.</p><ul class="u-modlist">${rows}</ul></details>`;
}

/** Machines incomplètes dans le plan de pose : pas dessinées, ports supposés, prix inconnus, problèmes. */
export function incompleteMachines(f: FactoryPlan): { box: Box; reasons: string[]; survey: boolean }[] {
  const out: { box: Box; reasons: string[]; survey: boolean }[] = [];
  for (const b of f.boxes) {
    const reasons: string[] = [];
    if (!b.mod) reasons.push(`pas encore dessiné : emplacement réservé de ${b.w} × ${b.h} cases`);
    else {
      if (!b.mod.portsKnown) reasons.push("ports supposés : bâtiment pas encore relevé");
      if (b.mod.costUnknown) reasons.push(`prix inconnu pour ${b.mod.costUnknown} sorte${b.mod.costUnknown > 1 ? "s" : ""} de pièce`);
      for (const p of b.mod.problems) reasons.push(p.message);
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
    const m = /^(.*?) : (\S+) → (\S+)$/.exec(p);
    if (!m) {
      expected = false;
      return p;
    }
    if (!reserved.has(m[3]!) && !reserved.has(m[2]!)) expected = false;
    return `${m[1]} : ${sub(m[2]!)} → ${sub(m[3]!)}`;
  });
  return expected
    ? `<p class="mod-other hint">${f.problems.length > 1 ? "Liaisons" : "Liaison"} à poser à la main : ${esc(text.join(" ; "))} (une place réservée, comme la ferme d'arbres, n'a pas de port dans le plan).</p>`
    : `<ul class="notices"><li class="bad">${f.problems.length} liaison(s) non tracée(s) : ${esc(text.join(" ; "))}</li></ul>`;
}

/** Texte autour du dessin : résumé, légende, liaisons, passages et machines à compléter. */
export function renderFactoryInfo(f: FactoryPlan, name: Name, plot: Plot, tierOf: TierOf, ms: number, glue = false): { head: string; legend: string; details: string } {
  const color = factoryColors(f);
  const st = f.stats;
  const sub = (key: string) => f.boxes.find((b) => b.key === key)?.sub ?? key;
  const fit = plot ? factoryFits(f, plot) : null;
  const plotText = !plot
    ? `<p class="mod-other">Indique la taille de ta parcelle dans <a href="#usine">Mon usine</a> pour vérifier que l'usine tient sur ton terrain.</p>`
    : fit === "non"
      ? `<p class="mod-fit warn-text">Ne tient pas sur ta parcelle (${plot.w} × ${plot.h} cases).</p>`
      : `<p class="mod-fit ok-text">Tient sur ta parcelle (${plot.w} × ${plot.h} cases)${fit === "tourné" ? " en la tournant d'un quart de tour" : ""}.</p>`;
  const missing = incompleteMachines(f);
  const pipes = f.full ? `${fmt(st.allPipeCells, 0)} cases en tout` : `${fmt(st.pipeCells, 0)} cases entre modules, ${fmt(st.allPipeCells, 0)} en tout`;
  const head = `<p class="mod-sum"><b>Toute l'usine — proposition</b> : ${f.W} × ${f.H} cases, ${f.boxes.length} module${f.boxes.length > 1 ? "s" : ""} · tuyaux : ${pipes}, ${st.allCrossings} croisement${st.allCrossings > 1 ? "s" : ""}${f.glued.length ? `, ${f.glued.length} contact${f.glued.length > 1 ? "s" : ""} direct${f.glued.length > 1 ? "s" : ""}` : ""} · électricité : ${esc(fmtMF(st.total))}, ${f.poleNodes.length} poteaux${st.relays ? ` + ${st.relays} relais` : ""}${st.upgraded ? ` (${st.upgraded} renforcés)` : ""}, ${esc(fmtMoney(st.polesCost))}.</p>${plotText}${
    unlinked(f, name, sub)
  }${st.overloaded ? `<ul class="notices"><li>${st.overloaded} câble(s) à doubler (charge au-delà du poteau le plus fort).</li></ul>` : ""}${
    missing.length ? `<p class="mod-other warn-text">${missing.length} module${missing.length > 1 ? "s" : ""} incomplet${missing.length > 1 ? "s" : ""} dans le plan de pose : voir « Machines à compléter » sous le dessin.</p>` : ""
  }<p class="mod-other">${
    f.full
      ? `Recalculée pour l'usine entière : une seule prise par collecteur, modules tournés vers leurs voisins, collecteur central d'une double rangée sorti entre deux machines quand ça raccourcit les tuyaux sans élargir le module${st.pruned ? `, puis ${st.pruned} case${st.pruned > 1 ? "s" : ""} de tuyau sans issue retirée${st.pruned > 1 ? "s" : ""} (bouts qui ne menaient nulle part)` : ""}.`
      : `Module par module : chaque module tel que son plan de pose seul, relié aux autres par des tuyaux${glue ? `, ou collé quand c'est possible${f.glued.length ? "" : " (aucune liaison n'a pu être collée dans ce plan)"}` : ""}.`
  } Calculée en ${fmt(ms / 1000, 1)} s.</p>`;
  const items = [...color.keys()];
  const legend = `<ul class="mod-legend">${items.map((it) => `<li><i style="background:${color.get(it)}"></i>${esc(name(it))}</li>`).join("")}<li><i class="sw-pole"></i>Poteau</li><li><i class="sw-cable"></i>Câble électrique</li><li><i class="sw-flow"></i>Liaison (sens du flux)</li>${plot ? `<li><i class="sw-plot"></i>Ta parcelle</li>` : ""}</ul>`;
  const rows = f.nets
    .map((n) => {
      const tier = tierOf(n.item, n.perMin);
      return `<tr data-sel="n:${esc(n.id)}"><td><i class="sw" style="background:${color.get(n.item)}"></i>${esc(name(n.item))}</td><td>${esc(sub(n.from))}</td><td>${esc(n.to.map(sub).join(", "))}</td><td class="num">${esc(fmt(n.perMin, 0))}/min</td><td class="num">${f.netCells[n.id] ?? 0}</td><td>${tier ? `tier ${tier === 1 ? "I" : "III"}` : "—"}</td></tr>`;
    })
    .join("");
  const passages = [...f.passagesKept].map(([k, p]) => `<li><b>${esc(sub(k))}</b> : ${esc(p.text)}</li>`).join("");
  const machines = missing
    .map(
      ({ box: b, reasons, survey }) =>
        `<li><b>${esc(b.sub)}</b> <span class="muted">(${esc(b.label)})</span> : ${esc(reasons.join(" ; "))}.${b.mod ? ` <button type="button" class="link small" data-focus="${esc(b.key)}">voir le module</button>` : ""}${survey ? ` · <button type="button" class="link small" data-edit="${esc(b.machine)}">relever ${esc(name(b.machine))} ✎</button>` : ""}</li>`,
    )
    .join("");
  const details = `<details class="more"><summary>Liaisons (${f.nets.length})</summary><p class="hint">Clique une ligne pour la voir sur le dessin.</p><div class="tablewrap"><table class="mini u-rows"><thead><tr><th>Produit</th><th>De</th><th>Vers</th><th>Débit</th><th>Cases</th><th>Tuyau</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>Passages entre machines (${f.passagesKept.size})</summary>${passages ? `<ul class="notes">${passages}</ul><p class="hint">Choisis d'après les modules voisins : le passage est gardé s'il raccourcit les tuyaux sans ajouter de croisement. Le plan de pose de chaque module le signale.</p>` : `<p class="hint">${f.full ? "Aucun passage ne raccourcit les tuyaux sans élargir un module." : "Les passages sont choisis en mode « recalculé pour l'usine entière »."}</p>`}</details>
    <details class="more"><summary>Machines à compléter (${missing.length})</summary>${machines ? `<ul class="notes">${machines}</ul><p class="hint">Ce qui manque pour que le plan de pose soit complet : un relevé des ports (Données → Éditeur de bâtiments), un prix, ou un module pas encore dessiné (arbres, centrales composées).</p>` : `<p class="hint">Tous les modules sont dessinés, avec des ports relevés et des prix connus.</p>`}</details>`;
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
  const svg = renderModuleSvg(m, name, { pieces, flows: mine, item: itemOf, wide, color: (net) => color.get(itemOf(net)) ?? "#9aa7b4" });
  const info = renderModuleInfo(m, name);
  const sub = (k: string) => box.get(k)?.sub ?? k;
  const ins = f.nets.filter((n) => n.to.includes(key));
  const outs = f.nets.filter((n) => n.from === key);
  const passage = f.passagesKept.get(key);
  const turn = turnText(b.rot);
  const head = `<p class="mod-sum"><b>${esc(b.label)} — ${esc(b.sub)}</b> : ${b.w} × ${b.h} cases, ${esc(fmtMoney(m.cost))}${m.costUnknown ? " (prix incomplets)" : ""}, consomme ${esc(fmtMF(b.power))}.${m.portsKnown ? "" : ` <span class="warn-text">Ports supposés : ce bâtiment n'est pas encore relevé.</span>`}</p>
    <p class="mod-other">Version dans l'usine : ${f.full ? "recalculée pour l'usine entière (une seule prise par collecteur)" : "telle que son plan de pose seul"}${turn ? `, ${turn} (sens horaire)` : ""}.${passage ? ` ${esc(passage.text)}.` : ""} Les tuyaux de l'usine qui arrivent, partent ou passent par le module sont dessinés aussi.</p>
    ${ins.length ? `<p class="mod-other">Reçoit : ${ins.map((n) => `${esc(name(n.item))} <span class="muted">(de ${esc(sub(n.from))})</span>`).join(", ")}.</p>` : ""}
    ${outs.length ? `<p class="mod-other">Envoie : ${outs.map((n) => `${esc(name(n.item))} ${esc(fmt(n.perMin, 0))}/min <span class="muted">(vers ${esc(n.to.map(sub).join(" et "))})</span>`).join(", ")}.</p>` : ""}
    ${m.problems.length ? `<ul class="notices">${m.problems.map((p) => `<li${p.level === "erreur" ? ' class="bad"' : ""}>${esc(p.message)}</li>`).join("")}</ul>` : ""}`;
  const items = [...new Set(m.nets.map((n) => n.item))];
  const legend = `<ul class="mod-legend">${items.map((it) => `<li><i style="background:${color.get(it) ?? "#9aa7b4"}"></i>${esc(name(it))}</li>`).join("")}<li><i class="sw-plug"></i>Prise électrique</li>${m.poles.length ? `<li><i class="sw-pole"></i>Poteau</li>` : ""}<li><i class="sw-flow"></i>Liaison (sens du flux)</li></ul>`;
  const details = `${turn ? `<p class="hint">L'ordre de pose décrit le module avant sa rotation (« au-dessus », « vers le haut »…) : dans l'usine, il est ${turn}.</p>` : ""}${info.details}`;
  return { title: `${b.label} — ${b.sub}`, svg, head, legend, details };
}
