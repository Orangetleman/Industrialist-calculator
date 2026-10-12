// Vue « comme en jeu » de l'arbre de recherche : SVG + fiche de la recherche choisie.
// Fonctions pures (chaînes) ; le déplacement/zoom est géré par canvas.ts.

import type { GameData } from "../engine/data.ts";
import type { Machine, ResearchNode } from "../engine/types.ts";
import { dependentsOf, isNodeUnlocked, missingNodes, rpCost, type Progress } from "../engine/unlock.ts";
import { esc, fmt, fmtMoney, fmtPollution, fmtRP } from "./format.ts";
import { RN_H, RN_W, type ResearchLayout } from "./research-layout.ts";

export type NodeState = "done" | "available" | "expensive" | "locked" | "incoherent";

/** États comme dans le jeu : vert débloqué, blanc disponible, gris clair trop cher, gris foncé verrouillé. */
export function nodeState(data: GameData, p: Progress, n: ResearchNode, rp: number | null): NodeState {
  const parentsOk = n.requires === "any" ? n.parents.some((x) => isNodeUnlocked(data, p, x)) : n.parents.every((x) => isNodeUnlocked(data, p, x));
  if (n.isRoot || n.startUnlocked || p.unlocked.has(n.id)) return parentsOk || n.isRoot || n.startUnlocked ? "done" : "incoherent";
  if (!parentsOk) return "locked";
  return rp !== null && rp < n.rp ? "expensive" : "available";
}

const STATE_LABEL: Record<NodeState, string> = {
  done: "Déjà débloquée",
  available: "Disponible",
  expensive: "Disponible, mais pas assez de RP",
  locked: "Prérequis manquants",
  incoherent: "Cochée, mais un prérequis ne l'est pas",
};

/** Comme en jeu, les noms longs rétrécissent au lieu d'être coupés. */
function nameSize(name: string): number {
  return Math.max(8.5, Math.min(13.5, (13.5 * 21) / Math.max(1, name.length)));
}

function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function renderResearchSvg(data: GameData, p: Progress, layout: ResearchLayout, selected: string | null, rp: number | null): string {
  let s = `<svg id="rs-svg" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Arbre de recherche" viewBox="0 0 ${layout.width} ${layout.height}">`;
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
    const label = `${n.name}, ${fmt(n.rp, 0)} RP, ${STATE_LABEL[st]}`;
    s += `<g class="rs-node ${st}${sel}" data-rs="${esc(n.id)}" tabindex="0" role="button" aria-pressed="${selected === n.id}" aria-label="${esc(label)}" transform="translate(${ln.x},${ln.y})">
<rect width="${RN_W}" height="${RN_H}" rx="7"/>
<text x="9" y="18" class="rs-name" style="font-size:${nameSize(n.name)}px">${esc(trunc(n.name, 34))}</text>
<text x="${RN_W - 9}" y="38" text-anchor="end" class="rs-rp">${esc(fmt(n.rp, 0))}RP</text>
${n.reqItems.length ? `<text x="9" y="38" class="rs-req">+ vente</text>` : ""}</g>`;
  }
  s += `</g></svg>`;
  return s;
}

function machineCard(m: Machine, data: GameData): string {
  const recipes = [...data.recipes.values()].filter((r) => r.machine === m.id);
  const outputs = [...new Set(recipes.flatMap((r) => Object.keys(r.outputs)))].map((id) => data.items.get(id)?.name ?? id);
  const facts = [
    m.cost !== null ? `<span>Prix : <b class="num">${fmtMoney(m.cost)}</b></span>` : "",
    m.size ? `<span>Taille : <b class="num">${m.size.w}×${m.size.l}</b></span>` : "",
    m.pollutionPerHour !== null ? `<span>Pollution : <b class="num">${fmtPollution(m.pollutionPerHour)}</b></span>` : "",
    m.category ? `<span>${esc(m.category)}</span>` : "",
    m.limited ? `<span>Limited</span>` : "",
  ].filter(Boolean);
  const src = m.sources[0];
  return `<li class="bcard">
    <div class="bhead"><b>${esc(m.name)}</b>${src?.url ? ` <a href="${esc(src.url)}" target="_blank" rel="noopener" class="muted">wiki ↗</a>` : ""}</div>
    ${m.description ? `<p class="bdesc">${esc(m.description).replace(/\n/g, "<br>")}</p>` : `<p class="bdesc muted">${src?.note ? esc(src.note) : "Pas de description sur le wiki."}</p>`}
    ${facts.length ? `<div class="meta">${facts.join("")}</div>` : ""}
    ${outputs.length ? `<div class="meta"><span>Produit : ${esc(outputs.slice(0, 12).join(", "))}${outputs.length > 12 ? "…" : ""}</span></div>` : ""}
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
  const form = (open: boolean) => `<details class="rs-desc-edit"${open ? " open" : ""}><summary>${text ? "Modifier la description" : "Recopier la description du jeu"}</summary>
      <form data-rs-desc="${esc(n.id)}">
        <label for="desc-${esc(n.id)}" class="sr-only">Description affichée en jeu</label>
        <textarea id="desc-${esc(n.id)}" name="text" rows="4" maxlength="2000" placeholder="Texte du panneau « Description » en jeu">${esc(text ?? "")}</textarea>
        <div class="actions"><button type="submit">Enregistrer</button>${text ? `<button type="button" class="link" data-rs-desc-del="${esc(n.id)}">Supprimer</button>` : ""}</div>
      </form></details>`;
  return `<h4 class="eyebrow">Description</h4>
    ${text ? `<p class="rs-desc">${esc(text).replace(/\n/g, "<br>")}</p><p class="hint">Recopiée du jeu${saisie ? ` le ${esc(saisie.source.fetchedAt.slice(0, 10))}` : ""}.</p>` : `<p class="muted">Pas de description sur les wikis.</p>`}
    ${form(false)}`;
}

/** Fiche détaillée d'une recherche (affichée sous l'arbre, comme le panneau du jeu). */
export function renderNodeDetail(data: GameData, p: Progress, id: string | null, rp: number | null): string {
  const n = id ? data.nodes.get(id) : undefined;
  if (!n) return `<p class="muted">Clique sur une recherche pour voir ce qu'elle débloque.</p>`;
  const st = nodeState(data, p, n, rp);
  const missing = missingNodes(data, p, n.id).filter((x) => x !== n.id);
  const deps = p.unlocked.has(n.id) ? dependentsOf(data, p, n.id) : [];
  const nodeName = (x: string) => data.nodes.get(x)?.name ?? x;
  const buildings = n.unlocksMachines.map((m) => data.machines.get(m)).filter((m): m is Machine => !!m);
  const actions: string[] = [];
  if (n.startUnlocked) actions.push(`<p class="hint">Acquise d'office dans un nouveau monde.</p>`);
  else if (!n.isRoot) {
    if (p.unlocked.has(n.id)) actions.push(`<button type="button" data-rs-action="lock" data-id="${esc(n.id)}">Marquer comme non débloquée${deps.length ? ` (+ ${deps.length} dépendante(s))` : ""}</button>`);
    else if (missing.length) {
      actions.push(`<button type="button" class="primary" data-rs-action="unlock-all" data-id="${esc(n.id)}">Débloquer avec ses ${missing.length} prérequis (${esc(fmtRP(rpCost(data, [...missing, n.id])))})</button>`);
      actions.push(`<button type="button" data-rs-action="unlock-one" data-id="${esc(n.id)}">Seulement celle-ci</button>`);
    } else actions.push(`<button type="button" class="primary" data-rs-action="unlock-one" data-id="${esc(n.id)}">Marquer comme débloquée</button>`);
  }
  const reqDone = p.reqItemsDone?.has(n.id);
  return `<div class="rs-detail ${st}">
    <div class="rs-detail-head">
      <div><div class="eyebrow">${esc(n.category)}</div><h3>${esc(n.name)}</h3></div>
      <div class="rs-cost num">${n.isRoot ? "" : esc(fmtRP(n.rp))}</div>
    </div>
    <p class="rs-status">${esc(STATE_LABEL[st])}${st === "expensive" && rp !== null ? ` : il te manque ${esc(fmtRP(n.rp - rp))}` : ""}</p>
    ${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}
    ${n.parents.length ? `<p class="meta"><span>Requiert ${n.requires === "any" && n.parents.length > 1 ? "l'une de" : ""} : ${n.parents.map((x) => `<button type="button" class="link${isNodeUnlocked(data, p, x) ? "" : " miss"}" data-rs-goto="${esc(x)}">${esc(nodeName(x))}</button>`).join(n.requires === "any" ? " ou " : " + ")}</span></p>` : ""}
    ${missing.length && !p.unlocked.has(n.id) ? `<p class="meta"><span>Chemin depuis ta progression : ${missing.map((x) => esc(nodeName(x))).join(" → ")} → ${esc(n.name)}</span></p>` : ""}
    ${n.reqItems.length ? `<label class="req"><input type="checkbox" data-req="${esc(n.id)}"${reqDone ? " checked" : ""}> Condition : vendre ${n.reqItems.map((r) => `${r.amount} ${esc(data.items.get(r.item)?.name ?? r.item)}`).join(" + ")}</label>` : ""}
    ${descriptionBlock(n)}
    <h4 class="eyebrow">Débloque</h4>
    ${buildings.length ? `<ul class="bcards">${buildings.map((m) => machineCard(m, data)).join("")}</ul>` : `<p class="muted">Aucun bâtiment.</p>`}
    ${n.unlocksOther.length ? `<p class="muted">Aussi : ${esc(n.unlocksOther.join(", "))}</p>` : ""}
    ${n.children.length ? `<p class="meta"><span>Mène à : ${n.children.map((x) => `<button type="button" class="link" data-rs-goto="${esc(x)}">${esc(nodeName(x))}</button>`).join(", ")}</span></p>` : ""}
  </div>`;
}
