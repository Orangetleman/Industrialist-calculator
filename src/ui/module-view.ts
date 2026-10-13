// Plan de pose d'une étape (E4a) : dessin vue de dessus du module, ressources, pièces à acheter,
// ordre de pose. Fonctions pures (chaînes HTML/SVG) ; main.ts gère le choix de l'étape et le cadre.

import type { ModulePlan } from "../engine/build/module.ts";
import { STEP, type Dir } from "../engine/build/geometry.ts";
import type { SurveyState } from "./buildings-model.ts";
import { esc, fmt, fmtMoney } from "./format.ts";

const C = 16; // unités SVG par case
/** Couleurs des ressources, lisibles sur le fond sombre du cadre. */
const PALETTE = ["#f0913a", "#6cc792", "#8fb8d6", "#e3b25a", "#d77fd0", "#5fd4d4", "#ff8a80", "#c5d86d"];

export function netColors(m: ModulePlan): Map<string, string> {
  // Une couleur par ressource ; ses collecteurs parallèles partagent la même.
  const items = [...new Set(m.nets.map((n) => n.item))];
  return new Map(m.nets.map((n) => [n.id, PALETTE[items.indexOf(n.item) % PALETTE.length]!]));
}

/** Dessin du module (SVG), à placer dans un cadre navigable. */
export function renderModuleSvg(m: ModulePlan, name: (id: string) => string): { svg: string; width: number; height: number } {
  const W = (m.width + 4) * C;
  const H = (m.height + 2) * C;
  const ox = 2 * C;
  const oy = C;
  const color = netColors(m);
  const cx = (x: number) => ox + x * C + C / 2;
  const cy = (y: number) => oy + y * C + C / 2;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Plan de pose vu de dessus : ${m.count} ${esc(name(m.machine))}">`;
  // Grille légère (une case = un Short Pipe).
  s += `<g class="mg">`;
  for (let x = 0; x <= m.width; x++) s += `<line x1="${ox + x * C}" y1="${oy}" x2="${ox + x * C}" y2="${oy + m.height * C}"/>`;
  for (let y = 0; y <= m.height; y++) s += `<line x1="${ox}" y1="${oy + y * C}" x2="${ox + m.width * C}" y2="${oy + y * C}"/>`;
  s += `</g>`;
  // Machines et plots des ports.
  for (const mm of m.machines) {
    const body = mm.cells.filter((c) => c.x >= mm.x && c.x < mm.x + mm.w && c.y >= mm.y && c.y < mm.y + mm.h);
    const stubs = mm.cells.filter((c) => !body.includes(c));
    s += `<g class="mm"><title>${esc(`${name(m.machine)} n° ${mm.id.slice(1)}`)}</title><rect x="${ox + mm.x * C}" y="${oy + mm.y * C}" width="${mm.w * C}" height="${mm.h * C}" rx="3"/>`;
    for (const c of stubs) s += `<rect class="stub" x="${ox + c.x * C + 3}" y="${oy + c.y * C + 3}" width="${C - 6}" height="${C - 6}"/>`;
    const label = mm.w * C >= 70 ? name(m.machine) : `n° ${mm.id.slice(1)}`;
    s += `<text x="${ox + (mm.x + mm.w / 2) * C}" y="${oy + (mm.y + mm.h / 2) * C + 4}" text-anchor="middle">${esc(label.length * 6.5 > mm.w * C - 6 ? `n° ${mm.id.slice(1)}` : label)}</text>`;
    for (const p of mm.power) s += `<circle class="plug" cx="${ox + p.x * C}" cy="${oy + p.y * C}" r="3.5"><title>Prise électrique</title></circle>`;
    s += `</g>`;
  }
  // Tuyaux : un trait du centre de la case vers chaque liaison ; croisement : le second réseau passe dessus.
  const seg = (x: number, y: number, d: Dir, col: string, wide: boolean, bridge = false) =>
    `<line class="${bridge ? "pp bridge" : "pp"}" x1="${cx(x)}" y1="${cy(y)}" x2="${cx(x) + (STEP[d].x * C) / 2}" y2="${cy(y) + (STEP[d].y * C) / 2}" stroke="${col}" stroke-width="${wide ? 5 : 3}"/>`;
  const tier = new Map(m.nets.map((n) => [n.id, n.pipe?.tier ?? 1]));
  const res = (id: string) => name(id.replace(/#\d+$/, ""));
  for (const p of m.pieces) {
    const tip = p.role === "croisement" ? `Croisement : ${res(p.net)} / ${res(p.crossNet ?? "")}` : `${res(p.net)} — ${p.role}`;
    s += `<g><title>${esc(tip)}</title>`;
    for (const d of p.links) s += seg(p.x, p.y, d, color.get(p.net)!, tier.get(p.net) === 3);
    if (p.crossNet) for (const d of p.crossLinks ?? []) s += seg(p.x, p.y, d, color.get(p.crossNet)!, tier.get(p.crossNet) === 3, true);
    if (p.role === "té" || p.role === "croix") s += `<circle cx="${cx(p.x)}" cy="${cy(p.y)}" r="3.2" fill="${color.get(p.net)}"/>`;
    if (p.role === "croisement") s += `<rect class="xing" x="${cx(p.x) - 5}" y="${cy(p.y) - 5}" width="10" height="10" rx="2"/>`;
    s += `</g>`;
  }
  // Arrivées et départs du module.
  for (const n of m.nets) {
    if (!n.end) continue;
    const x = cx(n.end.x) + (STEP[n.end.dir].x * C) / 2;
    const y = cy(n.end.y);
    const out = n.end.dir === "E";
    s += `<g class="end"><title>${esc(`${n.role === "entrée" ? "Arrivée" : "Départ"} : ${name(n.item)}, ${fmt(n.perSec, 2)}/s`)}</title><path d="M${x - (out ? 0 : 7)},${y - 5} L${x + (out ? 7 : 0)},${y} L${x - (out ? 0 : 7)},${y + 5} z" fill="${color.get(n.id)}"/></g>`;
  }
  // Poteaux.
  for (const p of m.poles) s += `<g class="pole"><title>${esc(`${name(p.pole)}${p.covers.length ? ` — machines ${p.covers.map((c) => c.slice(1)).join(", ")}` : " — relais"}`)}</title><rect x="${ox + p.x * C}" y="${oy + p.y * C}" width="${C * p.w}" height="${C * p.h}" rx="4"/><text x="${ox + (p.x + p.w / 2) * C}" y="${oy + (p.y + p.h / 2) * C + 4}" text-anchor="middle">P</text></g>`;
  return { svg: s + "</svg>", width: W, height: H };
}

/** Texte autour du dessin : résumé, problèmes, ressources, pièces, ordre de pose, hypothèses. */
export function renderModuleInfo(m: ModulePlan, name: (id: string) => string, survey: SurveyState = m.portsKnown ? "depot" : "manquant"): { head: string; legend: string; details: string } {
  const color = netColors(m);
  const crossings = m.parts.filter((p) => /intersection/i.test(p.id));
  const crossCost = crossings.reduce((s, p) => s + (p.unitPrice ?? 0) * p.count, 0);
  const head = `<p class="mod-sum"><b>${m.count} × ${esc(name(m.machine))}</b> en ${esc(m.template)} : ${m.width} × ${m.height} cases, ${esc(fmtMoney(m.cost))}${m.costUnknown ? " (prix incomplets)" : ""}${
    crossCost ? `, dont ${esc(fmtMoney(crossCost))} de croisements` : ""
  }.${
    !m.portsKnown
      ? ` <span class="warn-text">Ports supposés : ce bâtiment n'est pas encore relevé.</span>`
      : survey === "local"
        ? ` <span class="muted">Ports d'après ton relevé local (dans ce navigateur, pas encore envoyé).</span>`
        : ""
  }</p>${
    m.problems.length ? `<ul class="notices">${m.problems.map((p) => `<li${p.level === "erreur" ? ' class="bad"' : ""}>${esc(p.message)}</li>`).join("")}</ul>` : ""
  }`;
  const legend = `<ul class="mod-legend">${m.nets
    .map(
      (n) =>
        `<li><i style="background:${color.get(n.id)}"></i>${esc(name(n.item))}${n.line ? ` n° ${n.line}` : ""} <span class="muted">· ${n.role === "entrée" ? "entre" : "sort"} ${esc(fmt(n.perSec, 2))}/s · ${n.pipe ? `tier ${n.pipe.tier === 1 ? "I" : "III"} (${n.pipe.flowPerSec}/s)` : "aucun tuyau assez rapide"}</span></li>`,
    )
    .join("")}<li><i class="sw-plug"></i>Prise électrique</li>${m.poles.length ? `<li><i class="sw-pole"></i>Poteau</li>` : ""}</ul>`;
  const rows = m.parts
    .map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${p.count}</td><td class="num">${p.unitPrice === null ? "?" : esc(fmtMoney(p.unitPrice))}</td><td class="num">${p.unitPrice === null ? "?" : esc(fmtMoney(p.unitPrice * p.count))}</td></tr>`)
    .join("");
  const details = `<details class="more" open><summary>Ordre de pose</summary><ol class="steps-list">${m.order.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></details>
    <details class="more"><summary>Pièces à acheter (${m.parts.reduce((s, p) => s + p.count, 0)})</summary><div class="tablewrap"><table class="mini"><thead><tr><th>Pièce</th><th>Nombre</th><th>Prix</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>Hypothèses à vérifier en jeu (${m.assumptions.length})</summary><ul class="notes">${m.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>`;
  return { head, legend, details };
}
