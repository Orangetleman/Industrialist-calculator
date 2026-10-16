// Plan de pose de toute l'usine (S3) : dessin vue de dessus (modules, tuyaux entre modules, poteaux),
// résumé et liste des liaisons. Fonctions pures (chaînes HTML/SVG) ; le calcul tourne dans un Web Worker
// (factory.worker.ts) et main.ts gère l'avancement, l'annulation et le cadre navigable.

import { factoryFits, type FactoryPlan } from "../engine/build/factory.ts";
import { STEP, type Dir } from "../engine/build/geometry.ts";
import { esc, fmt, fmtMF, fmtMoney } from "./format.ts";

const C = 10; // unités SVG par case
/** Couleurs des ressources (les mêmes que la maquette), lisibles sur le fond sombre du cadre. */
const PALETTE = ["#f0913a", "#6cc792", "#8fb8d6", "#e3b25a", "#d77fd0", "#5fd4d4", "#ff8a80", "#c5d86d", "#b39ddb", "#ffcc80"];

type Plot = { w: number; h: number } | null;
type Name = (id: string) => string;
/** Tier du tuyau d'une liaison (1 ou 3), d'après son débit. */
type TierOf = (item: string, perMin: number) => 1 | 3 | null;

export function factoryColors(f: FactoryPlan): Map<string, string> {
  return new Map([...new Set(f.nets.map((n) => n.item))].map((it, i) => [it, PALETTE[i % PALETTE.length]!]));
}

/** Dessin de l'usine (SVG), à placer dans un cadre navigable. La parcelle du joueur est tracée si connue. */
export function renderFactorySvg(f: FactoryPlan, name: Name, plot: Plot, tierOf: TierOf): { svg: string; width: number; height: number } {
  const color = factoryColors(f);
  const VW = Math.max(f.W, plot?.w ?? 0) + 2;
  const VH = Math.max(f.H, plot?.h ?? 0) + 2;
  const sub = (key: string) => f.boxes.find((b) => b.key === key)?.sub ?? key;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW * C} ${VH * C}" class="usine" role="img" aria-label="Toute l'usine vue de dessus : ${f.W} × ${f.H} cases">`;
  s += `<defs><pattern id="ug1" width="${C}" height="${C}" patternUnits="userSpaceOnUse"><path d="M${C} 0 L0 0 0 ${C}" fill="none" stroke="#262c33" stroke-width="1"/></pattern><pattern id="ug10" width="${C * 10}" height="${C * 10}" patternUnits="userSpaceOnUse"><rect width="${C * 10}" height="${C * 10}" fill="url(#ug1)"/><path d="M${C * 10} 0 L0 0 0 ${C * 10}" fill="none" stroke="#323a43" stroke-width="1.5"/></pattern><marker id="ua" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ffd54a"/></marker></defs>`;
  s += `<rect width="${VW * C}" height="${VH * C}" fill="#1d2126"/><rect width="${VW * C}" height="${VH * C}" fill="url(#ug10)"/>`;
  if (plot) s += `<g><title>${esc(`Ta parcelle : ${plot.w} × ${plot.h} cases`)}</title><rect class="u-plot" x="0" y="0" width="${plot.w * C}" height="${plot.h * C}"/></g><text class="u-plot-t" x="${plot.w * C - 10}" y="${plot.h * C - 10}">ta parcelle ${plot.w} × ${plot.h}</text>`;
  s += `<rect class="u-bbox" x="0" y="0" width="${f.W * C}" height="${f.H * C}"/><text class="u-bbox-t" x="${f.W * C - 8}" y="${f.H * C + 16}">usine ${f.W} × ${f.H}</text>`;
  // Modules : cadre, machines et collecteurs, puis l'étiquette par-dessus (estompée).
  for (const b of f.boxes) {
    const passage = f.passagesKept.get(b.key);
    const tip = `${b.sub} — ${b.label}${b.mod ? ` : module de ${b.w} × ${b.h} cases${b.mod.folds > 1 ? ` en ${b.mod.folds} blocs` : ""}${passage ? ` ; ${passage.text}` : ""}, ${fmtMoney(b.mod.cost)}, consomme ${fmtMF(b.power)}` : " : pas encore dessiné (emplacement réservé)"}`;
    s += `<g class="u-mod"><title>${esc(tip)}</title><rect x="${b.x * C}" y="${b.y * C}" width="${b.w * C}" height="${b.h * C}" rx="6" class="${b.mod ? "u-box" : "u-farm"}"/>`;
    if (b.mod) {
      for (const m of b.mod.machines) s += `<rect x="${(b.x + m.x) * C + 1}" y="${(b.y + m.y) * C + 1}" width="${m.w * C - 2}" height="${m.h * C - 2}" rx="2" class="u-mach"/>`;
      const item = (net: string) => b.mod!.nets.find((n) => n.id === net)?.item ?? "";
      const wide = (net: string) => b.mod!.nets.find((n) => n.id === net)?.pipe?.tier === 3;
      for (const p of b.mod.pieces) {
        const cx = (b.x + p.x + 0.5) * C;
        const cy = (b.y + p.y + 0.5) * C;
        for (const [net, links] of [[p.net, p.links], ...(p.crossNet ? [[p.crossNet, p.crossLinks ?? []]] : [])] as [string, Dir[]][])
          for (const d of links) s += `<line x1="${cx}" y1="${cy}" x2="${cx + (STEP[d].x * C) / 2}" y2="${cy + (STEP[d].y * C) / 2}" stroke="${color.get(item(net)) ?? "#9aa7b4"}" stroke-width="${wide(net) ? 4 : 2.2}"/>`;
      }
    }
    const fs = Math.max(5, Math.min(20, ((b.w * C) / Math.max(b.sub.length, b.label.length * 0.62)) * 1.25, (b.h * C) / 4.2));
    const cx = (b.x + b.w / 2) * C;
    const cy = (b.y + b.h / 2) * C;
    s += `<g class="u-lbl"><text x="${cx}" y="${cy - fs * 0.25}" font-size="${fs.toFixed(1)}" class="u-t1">${esc(b.sub)}</text><text x="${cx}" y="${cy + fs * 0.95}" font-size="${(fs * 0.62).toFixed(1)}" class="u-t2">${esc(b.label)}</text></g></g>`;
  }
  // Tuyaux entre modules, groupés par liaison (en mode complet, les collecteurs raccordés en font partie).
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
    s += `<g class="u-net"><title>${esc(tip)}</title><path class="u-hit" d="${byNet.get(n.id) ?? ""}"/><path class="u-line" d="${byNet.get(n.id) ?? ""}" stroke="${color.get(n.item)}" stroke-width="${tier === 3 ? 4.6 : 2.6}"/></g>`;
  }
  const netItem = (id: string) => name(f.nets.find((n) => n.id === id)?.item ?? "");
  for (const [k, o] of f.cells) {
    if (o.kind !== "tuyau" || !o.cross) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    s += `<rect class="u-xing" x="${(x + 0.5) * C - 4}" y="${(y + 0.5) * C - 4}" width="8" height="8" rx="1.5"><title>${esc(`Croisement : ${netItem(o.net)} / ${netItem(o.cross.net)}`)}</title></rect>`;
  }
  // Réseau électrique : câbles entre poteaux (ceux d'un même module ne sont pas tracés), poteaux, arrivée.
  for (const l of f.links) {
    if (l.internal) continue;
    const tip = `Câble vers ${l.to.module ? sub(l.to.module) : `un poteau (${l.to.plugs.length} prise${l.to.plugs.length > 1 ? "s" : ""})`} : porte ${fmtMF(l.load)} (tout ce qui est en aval) ; un ${l.to.type.name} porte ${fmtMF(l.to.type.capacityMFps)}${l.lines > 1 ? ` : ${l.lines} lignes en parallèle` : ""}${l.relays ? ` · ${l.relays} relais ${l.relayType.name} (portée ${l.relayType.rangeCells} cases)` : ""}`;
    s += `<g class="u-cable${l.lines > 1 ? " over" : ""}"><title>${esc(tip)}</title><line class="u-cable-hit" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}"/><line class="u-cable-line" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}" marker-end="url(#ua)"/></g>`;
  }
  for (const p of f.poleNodes) s += `<rect class="u-pole" x="${(p.x - p.type.size.w / 2) * C}" y="${(p.y - p.type.size.h / 2) * C}" width="${p.type.size.w * C}" height="${p.type.size.h * C}"><title>${esc(`${p.type.name} : ${p.plugs.length} prise(s), ${fmtMF(p.load)} sur ${fmtMF(p.type.capacityMFps)}`)}</title></rect>`;
  s += `<circle cx="${f.feed.x * C}" cy="${f.feed.y * C}" r="9" class="u-feed"><title>${esc(`Arrivée du réseau électrique (${fmtMF(f.stats.total)} pour toute l'usine)`)}</title></circle>`;
  return { svg: s + "</svg>", width: VW * C, height: VH * C };
}

/** Texte autour du dessin : résumé (taille, parcelle, tuyaux, électricité), légende, liaisons et passages. */
export function renderFactoryInfo(f: FactoryPlan, name: Name, plot: Plot, tierOf: TierOf, ms: number): { head: string; legend: string; details: string } {
  const color = factoryColors(f);
  const st = f.stats;
  const sub = (key: string) => f.boxes.find((b) => b.key === key)?.sub ?? key;
  const fit = plot ? factoryFits(f, plot) : null;
  const plotText = !plot
    ? `<p class="mod-other">Indique la taille de ta parcelle dans <a href="#usine">Mon usine</a> pour vérifier que l'usine tient sur ton terrain.</p>`
    : fit === "non"
      ? `<p class="mod-fit warn-text">Ne tient pas sur ta parcelle (${plot.w} × ${plot.h} cases).</p>`
      : `<p class="mod-fit ok-text">Tient sur ta parcelle (${plot.w} × ${plot.h} cases)${fit === "tourné" ? " en la tournant d'un quart de tour" : ""}.</p>`;
  const branches = f.links.filter((l) => l.from.id === "feed");
  const undrawn = f.boxes.filter((b) => !b.mod);
  const head = `<p class="mod-sum"><b>Toute l'usine — proposition</b> : ${f.W} × ${f.H} cases, ${f.boxes.length} module${f.boxes.length > 1 ? "s" : ""} · tuyaux : ${fmt(st.allPipeCells, 0)} cases en tout, ${st.allCrossings} croisement${st.allCrossings > 1 ? "s" : ""} · électricité : ${esc(fmtMF(st.total))}, ${f.poleNodes.length} poteaux${st.relays ? ` + ${st.relays} relais` : ""}${st.upgraded ? ` (${st.upgraded} renforcés)` : ""}, ${esc(fmtMoney(st.polesCost))}.</p>${plotText}${
    f.problems.length ? `<ul class="notices"><li class="bad">${f.problems.length} liaison(s) non tracée(s) : ${esc(f.problems.join(" ; "))}</li></ul>` : ""
  }${st.overloaded ? `<ul class="notices"><li>${st.overloaded} câble(s) à doubler (charge au-delà du poteau le plus fort).</li></ul>` : ""}${
    undrawn.length ? `<p class="mod-other">Pas encore dessinés (emplacement réservé) : ${esc(undrawn.map((b) => b.sub).join(", "))}.</p>` : ""
  }<p class="mod-other">Recalculée pour l'usine entière : une seule prise par collecteur, modules tournés vers leurs voisins, collecteur central d'une double rangée sorti entre deux machines quand ça raccourcit les tuyaux sans élargir le module. Calculée en ${fmt(ms / 1000, 1)} s.</p>`;
  const items = [...color.keys()];
  const legend = `<ul class="mod-legend">${items.map((it) => `<li><i style="background:${color.get(it)}"></i>${esc(name(it))}</li>`).join("")}<li><i class="sw-pole"></i>Poteau</li><li><i class="sw-cable"></i>Câble électrique</li>${plot ? `<li><i class="sw-plot"></i>Ta parcelle</li>` : ""}</ul>`;
  const rows = f.nets
    .map((n) => {
      const tier = tierOf(n.item, n.perMin);
      return `<tr><td><i class="sw" style="background:${color.get(n.item)}"></i>${esc(name(n.item))}</td><td>${esc(sub(n.from))}</td><td>${esc(n.to.map(sub).join(", "))}</td><td class="num">${esc(fmt(n.perMin, 0))}/min</td><td class="num">${f.netCells[n.id] ?? 0}</td><td>${tier ? `tier ${tier === 1 ? "I" : "III"}` : "—"}</td></tr>`;
    })
    .join("");
  const passages = [...f.passagesKept].map(([k, p]) => `<li><b>${esc(sub(k))}</b> : ${esc(p.text)}</li>`).join("");
  const details = `<details class="more"><summary>Liaisons (${f.nets.length})</summary><div class="tablewrap"><table class="mini"><thead><tr><th>Produit</th><th>De</th><th>Vers</th><th>Débit</th><th>Cases</th><th>Tuyau</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>Passages entre machines (${f.passagesKept.size})</summary>${passages ? `<ul class="notes">${passages}</ul><p class="hint">Choisis d'après les modules voisins : le passage est gardé s'il raccourcit les tuyaux sans ajouter de croisement. Le plan de pose de chaque module le signale.</p>` : `<p class="hint">Aucun passage ne raccourcit les tuyaux sans élargir un module.</p>`}</details>`;
  return { head, legend, details };
}
