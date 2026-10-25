// Vue « comme en jeu » de l'arbre de recherche : SVG + fiche de la recherche choisie.
// Fonctions pures (chaînes) ; le déplacement/zoom est géré par canvas.ts.

import type { GameData } from "../engine/data.ts";
import type { Machine, ResearchNode } from "../engine/types.ts";
import { dependentsOf, isNodeUnlocked, missingNodes, rpCost, type Progress } from "../engine/unlock.ts";
import { esc, fmt, fmtDuration, fmtMoney, fmtPollution, fmtRP, frText } from "./format.ts";
import { t } from "../i18n/i18n.ts";
import { RN_H, RN_W, type ResearchLayout } from "./research-layout.ts";

export type NodeState = "done" | "available" | "expensive" | "locked" | "incoherent";

/** États comme dans le jeu : vert débloqué, blanc disponible, gris clair trop cher, gris foncé verrouillé. */
export function nodeState(data: GameData, p: Progress, n: ResearchNode, rp: number | null): NodeState {
  const parentsOk = n.requires === "any" ? n.parents.some((x) => isNodeUnlocked(data, p, x)) : n.parents.every((x) => isNodeUnlocked(data, p, x));
  if (n.isRoot || n.startUnlocked || p.unlocked.has(n.id)) return parentsOk || n.isRoot || n.startUnlocked ? "done" : "incoherent";
  if (!parentsOk) return "locked";
  return rp !== null && rp < n.rp ? "expensive" : "available";
}

/** Libellé d'un état, dans la langue choisie. */
const stateLabel = (st: NodeState): string => t(`rs.state.${st}`);

/** Comme en jeu, les noms longs rétrécissent au lieu d'être coupés. */
function nameSize(name: string): number {
  return Math.max(8.5, Math.min(13.5, (13.5 * 21) / Math.max(1, name.length)));
}

function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function renderResearchSvg(data: GameData, p: Progress, layout: ResearchLayout, selected: string | null, rp: number | null): string {
  let s = `<svg id="rs-svg" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="${esc(t("rs.svg.aria"))}" viewBox="0 0 ${layout.width} ${layout.height}">`;
  s += `<g class="rs-edges">`;
  for (const e of layout.edges) {
    const lit = isNodeUnlocked(data, p, e.from);
    s += `<path d="${e.d}" class="rs-edge${lit ? " lit" : ""}"/>`;
  }
  s += `</g><g class="rs-nodes">`;
  for (const ln of layout.nodes) {
    const n = data.nodes.get(ln.id)!;
    const st = nodeState(data, p, n, rp);
    const sel = selected === n.id ? " selected" : "";
    const label = `${n.name}, ${fmt(n.rp, 0)} RP, ${stateLabel(st)}`;
    s += `<g class="rs-node ${st}${sel}" data-rs="${esc(n.id)}" tabindex="0" role="button" aria-pressed="${selected === n.id}" aria-label="${esc(label)}" transform="translate(${ln.x},${ln.y})">
<rect width="${RN_W}" height="${RN_H}" rx="7"/>
<text x="9" y="18" class="rs-name" style="font-size:${nameSize(n.name)}px">${esc(trunc(n.name, 34))}</text>
<text x="${RN_W - 9}" y="38" text-anchor="end" class="rs-rp">${esc(fmt(n.rp, 0))}RP</text>
${n.reqItems.length ? `<text x="9" y="38" class="rs-req">${t("rs.sale")}</text>` : ""}</g>`;
  }
  s += `</g></svg>`;
  return s;
}

function machineCard(m: Machine, data: GameData): string {
  const recipes = [...data.recipes.values()].filter((r) => r.machine === m.id);
  const outputs = [...new Set(recipes.flatMap((r) => Object.keys(r.outputs)))].map((id) => data.items.get(id)?.name ?? id);
  const facts = [
    m.cost !== null ? `<span>${t("rs.price")} <b class="num">${fmtMoney(m.cost)}</b></span>` : "",
    m.size ? `<span>${t("rs.size")} <b class="num">${m.size.w}×${m.size.l}</b></span>` : "",
    m.pollutionPerHour !== null ? `<span>${t("rs.pollution")} <b class="num">${fmtPollution(m.pollutionPerHour)}</b></span>` : "",
    m.category ? `<span>${esc(m.category)}</span>` : "",
    m.limited ? `<span>Limited</span>` : "",
  ].filter(Boolean);
  const src = m.sources[0];
  return `<li class="bcard">
    <div class="bhead"><b>${esc(m.name)}</b>${src?.url ? ` <a href="${esc(src.url)}" target="_blank" rel="noopener" class="muted">wiki ↗</a>` : ""}</div>
    ${m.description ? `<p class="bdesc">${esc(m.description).replace(/\n/g, "<br>")}</p>` : `<p class="bdesc muted">${src?.note ? frText(src.note) : t("rs.noDesc.wiki")}</p>`}
    ${facts.length ? `<div class="meta">${facts.join("")}</div>` : ""}
    ${outputs.length ? `<div class="meta"><span>${esc(t("rs.makes", { list: outputs.slice(0, 12).join(", ") }))}${outputs.length > 12 ? "…" : ""}</span></div>` : ""}
  </li>`;
}

/**
 * Description de la recherche, comme le panneau « Description » du jeu. Les wikis ne la donnent
 * pas : le joueur peut la recopier depuis le jeu (gardée comme une correction, exportable).
 */
function descriptionBlock(n: ResearchNode): string {
  if (n.isRoot) return "";
  const text = n.description ?? null;
  const saisie = n.corrections?.find((c) => c.field === "description");
  const form = (open: boolean) => `<details class="rs-desc-edit"${open ? " open" : ""}><summary>${t(text ? "rc.desc.edit" : "rc.desc.copy")}</summary>
      <form data-rs-desc="${esc(n.id)}">
        <label for="desc-${esc(n.id)}" class="sr-only">${t("rc.desc.label")}</label>
        <textarea id="desc-${esc(n.id)}" name="text" rows="4" maxlength="2000" placeholder="${esc(t("rs.desc.ph"))}">${esc(text ?? "")}</textarea>
        <div class="actions"><button type="submit">${t("rc.save")}</button>${text ? `<button type="button" class="link" data-rs-desc-del="${esc(n.id)}">${t("rs.delete")}</button>` : ""}</div>
      </form></details>`;
  return `<h4 class="eyebrow">${t("rs.desc")}</h4>
    ${text ? `<p class="rs-desc">${esc(text).replace(/\n/g, "<br>")}</p><p class="hint">${t("rs.copied", { date: saisie ? t("rs.copied.on", { date: esc(saisie.source.fetchedAt.slice(0, 10)) }) : "" })}</p>` : `<p class="muted">${t("rs.noDesc.wikis")}</p>`}
    ${form(false)}`;
}

/** Temps de jeu pour débloquer des recherches dans l'ordre, à ton rythme (null : RP/s inconnus). */
export type RpEta = (ids: string[]) => { seconds: number; straight: boolean } | null;

/** « Dans combien de temps de jeu » (S22) : sous l'état, pour une recherche pas encore débloquée. */
function etaLine(n: ResearchNode, path: string[], rp: number | null, eta: RpEta | undefined): string {
  if (!eta) return "";
  const e = eta(path);
  if (!e) return `<p class="hint rs-eta">${t("rs.eta.none.html")}</p>`;
  if (!(e.seconds > 0)) return "";
  const what = path.length > 1 ? t("rs.eta.n", { n: path.length }) : "";
  const straight = e.straight ? ` <span class="hint">${t("rs.eta.straight")}</span>` : "";
  return `<p class="rs-eta">${t("rs.eta.html", { t: esc(fmtDuration(e.seconds)), what, straight })} <button type="button" class="link" data-rs-faster="${esc(n.id)}">${t("rs.faster")}</button></p>`;
}

/** Boutons d'une recherche (panneau et bulle) : débloquer, avec ou sans prérequis, ou marquer non débloquée. */
function nodeActions(data: GameData, p: Progress, n: ResearchNode, missing: string[]): string[] {
  const actions: string[] = [];
  if (n.startUnlocked) actions.push(`<p class="hint">${t("rs.start")}</p>`);
  else if (!n.isRoot) {
    const deps = p.unlocked.has(n.id) ? dependentsOf(data, p, n.id) : [];
    if (p.unlocked.has(n.id)) actions.push(`<button type="button" data-rs-action="lock" data-id="${esc(n.id)}">${t("rs.lock", { deps: deps.length ? t("rs.lock.deps", { n: deps.length }) : "" })}</button>`);
    else if (missing.length) {
      actions.push(`<button type="button" class="primary" data-rs-action="unlock-all" data-id="${esc(n.id)}">${t("rs.unlockAll", { n: missing.length, rp: esc(fmtRP(rpCost(data, [...missing, n.id]))) })}</button>`);
      actions.push(`<button type="button" data-rs-action="unlock-one" data-id="${esc(n.id)}">${t("rs.unlockOne")}</button>`);
    } else actions.push(`<button type="button" class="primary" data-rs-action="unlock-one" data-id="${esc(n.id)}">${t("rs.unlock")}</button>`);
  }
  return actions;
}

/**
 * Bulle à côté de la recherche cliquée (S29, option « Débloquer : Bulle ») : prix, état, durée à ton rythme
 * et les mêmes boutons que le panneau, sans aller jusqu'au panneau. Vide pour la racine.
 */
export function renderNodeBubble(data: GameData, p: Progress, id: string | null, rp: number | null, eta?: RpEta): string {
  const n = id ? data.nodes.get(id) : undefined;
  if (!n || n.isRoot) return "";
  const st = nodeState(data, p, n, rp);
  const missing = p.unlocked.has(n.id) ? [] : missingNodes(data, p, n.id).filter((x) => x !== n.id);
  const nodeName = (x: string) => data.nodes.get(x)?.name ?? x;
  return `<div class="rs-bub-head"><b>${esc(n.name)}</b><button type="button" class="rs-bub-x" data-rsb-close aria-label="${esc(t("rs.bub.close"))}">✕</button></div>
    <p class="rs-bub-st"><span class="num">${esc(fmtRP(n.rp))}</span> · ${esc(stateLabel(st))}${st === "expensive" && rp !== null ? esc(t("rs.short", { x: fmtRP(n.rp - rp) })) : ""}</p>
    ${st === "expensive" || st === "locked" ? etaLine(n, [...missing, n.id], rp, eta) : ""}
    ${missing.length ? `<p class="hint">${esc(t("rs.before", { list: missing.map(nodeName).join(" → ") }))}</p>` : ""}
    <div class="actions">${nodeActions(data, p, n, missing).join("")}</div>`;
}

/** Fiche détaillée d'une recherche (affichée sous l'arbre, comme le panneau du jeu). */
export function renderNodeDetail(data: GameData, p: Progress, id: string | null, rp: number | null, eta?: RpEta): string {
  const n = id ? data.nodes.get(id) : undefined;
  if (!n) return `<p class="muted">${t("rs.pick")}</p>`;
  const st = nodeState(data, p, n, rp);
  const missing = missingNodes(data, p, n.id).filter((x) => x !== n.id);
  const nodeName = (x: string) => data.nodes.get(x)?.name ?? x;
  const buildings = n.unlocksMachines.map((m) => data.machines.get(m)).filter((m): m is Machine => !!m);
  const actions = nodeActions(data, p, n, missing);
  const reqDone = p.reqItemsDone?.has(n.id);
  return `<div class="rs-detail ${st}">
    <div class="rs-detail-head">
      <div><div class="eyebrow">${esc(n.category)}</div><h3>${esc(n.name)}</h3></div>
      <div class="rs-cost num">${n.isRoot ? "" : esc(fmtRP(n.rp))}</div>
    </div>
    <p class="rs-status">${esc(stateLabel(st))}${st === "expensive" && rp !== null ? esc(t("rs.short", { x: fmtRP(n.rp - rp) })) : ""}</p>
    ${st === "expensive" || st === "locked" ? etaLine(n, [...missing, n.id], rp, eta) : ""}
    ${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}
    ${n.parents.length ? `<p class="meta"><span>${t(n.requires === "any" && n.parents.length > 1 ? "rs.requires.any" : "rs.requires", { list: n.parents.map((x) => `<button type="button" class="link${isNodeUnlocked(data, p, x) ? "" : " miss"}" data-rs-goto="${esc(x)}">${esc(nodeName(x))}</button>`).join(n.requires === "any" ? ` ${t("common.or")} ` : " + ") })}</span></p>` : ""}
    ${missing.length && !p.unlocked.has(n.id) ? `<p class="meta"><span>${esc(t("rs.path", { list: [...missing.map(nodeName), n.name].join(" → ") }))}</span></p>` : ""}
    ${n.reqItems.length ? `<label class="req"><input type="checkbox" data-req="${esc(n.id)}"${reqDone ? " checked" : ""}> ${esc(t("rs.condition", { list: n.reqItems.map((r) => `${r.amount} ${data.items.get(r.item)?.name ?? r.item}`).join(" + ") }))}</label>` : ""}
    ${descriptionBlock(n)}
    <h4 class="eyebrow">${t("rs.unlocks")}</h4>
    ${buildings.length ? `<ul class="bcards">${buildings.map((m) => machineCard(m, data)).join("")}</ul>` : `<p class="muted">${t("rs.noBuilding")}</p>`}
    ${n.unlocksOther.length ? `<p class="muted">${esc(t("rs.also", { list: n.unlocksOther.join(", ") }))}</p>` : ""}
    ${n.children.length ? `<p class="meta"><span>${t("rs.leadsTo", { list: n.children.map((x) => `<button type="button" class="link" data-rs-goto="${esc(x)}">${esc(nodeName(x))}</button>`).join(", ") })}</span></p>` : ""}
  </div>`;
}
