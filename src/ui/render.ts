// Rendu HTML/SVG à partir d'un Plan. Fonctions pures (chaînes), sans accès au DOM :
// main.ts se charge de les insérer et de brancher les événements.

import type { GameData } from "../engine/data.ts";
import { ENERGY } from "../engine/resources.ts";
import type { Plan, Step, Unresolved, VerifyEntry } from "../engine/solve.ts";
import type { OverridesFile, Recipe, Source } from "../engine/types.ts";
import { esc, fieldLabel, fmt, fmtDuration, fmtMF, fmtMoney, fmtPollution, fmtRP, isEditableField, REASON_LABEL } from "./format.ts";
import { edgePath, LABEL_H, labelText, labelWidth, layoutGraph, NODE_H, NODE_W } from "./graph-layout.ts";
import type { Settings } from "./state.ts";

export type Ctx = { data: GameData; plan: Plan; settings: Settings; corrections: OverridesFile };

const itemN = (ctx: Ctx, id: string) => (id === ENERGY ? "Énergie (générateurs)" : (ctx.data.items.get(id)?.name ?? id));
const machineN = (ctx: Ctx, id: string) => ctx.data.machines.get(id)?.name ?? id;
const nodeN = (ctx: Ctx, id: string) => ctx.data.nodes.get(id)?.name ?? id;

function recipeText(ctx: Ctx, r: Recipe, durationS?: number): string {
  const side = (o: Record<string, number | null>) =>
    Object.entries(o)
      .map(([k, v]) => `${v === null ? "?" : fmt(v, 3)}× ${itemN(ctx, k)}`)
      .join(" + ");
  const ins = side(r.inputs);
  const d = durationS ?? r.durationS;
  return `${ins ? `${ins} → ` : "→ "}${side(r.outputs)} · ${d === null ? "durée ?" : `${fmt(d, 2)} s`}`;
}

function sourceLink(s: Source | undefined): string {
  if (!s) return "—";
  const label = { miraheze: "Miraheze", fandom: "Fandom", desmos: "Desmos", jeu: "relevé en jeu", saisie: "ta saisie" }[s.wiki];
  const date = s.fetchedAt.slice(0, 10);
  return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(label)}</a> <span class="muted">${esc(date)}</span>` : `${esc(label)} <span class="muted">${esc(date)}</span>`;
}

// ---------------------------------------------------------------- résumé

export function renderStatus(ctx: Ctx): string {
  const p = ctx.plan;
  if (p.status === "ok") return "";
  const msg =
    p.status === "impossible"
      ? p.target.kind === "argent"
        ? `Impossible de gagner ${esc(fmtMoney(p.target.ratePerMin))}/min avec ta progression actuelle. Voir les avertissements ci-dessous.`
        : `<b>${esc(itemN(ctx, p.target.item))}</b> ne peut pas être produit avec ta progression actuelle. Voir ci-dessous ce qui manque.`
      : `Plan partiel : ${p.unresolved.length} item(s) ne sont pas produits (verrouillés, sans recette ou en boucle). Ils sont marqués en pointillés dans le graphe.`;
  return `<div class="banner ${p.status === "impossible" ? "bad" : "warn"}" role="status">${msg}</div>`;
}

export function renderSummary(ctx: Ctx): string {
  const p = ctx.plan;
  const t = p.totals;
  const e = p.economy;
  const energyNote = t.energyUnknownSteps ? ` <small>(≥, ${t.energyUnknownSteps} inconnue(s))</small>` : "";
  const cards: [string, string][] = [
    p.target.kind === "argent"
      ? [fmtMoney(t.revenuePerMin || p.target.ratePerMin), "de ventes / min"]
      : [p.status === "impossible" && !p.target.ratePerMin ? "—" : fmt(p.target.ratePerMin, 2), `${esc(itemN(ctx, p.target.item))} / min`],
    [String(t.machines), "machines"],
    ...(t.farms ? ([[`≈ ${t.farms}`, "arbres (indicatif)"]] as [string, string][]) : []),
    ...(t.depots ? ([[String(t.depots), `dépôt(s) de vente`]] as [string, string][]) : []),
    [fmtMF(t.energyAvg) + energyNote, "énergie consommée (moyenne)"],
    ...(p.constraints.selfPowered || t.energyProduced ? ([[fmtMF(t.energyProduced), "énergie produite (générateurs)"]] as [string, string][]) : []),
    [fmtMF(t.energyPeak), "pic si tout tourne"],
    [`${fmt(t.footprint, 0)}${t.footprintUnknownSteps ? "+" : ""}`, `cases au sol${t.footprintUnknownSteps ? ` (${t.footprintUnknownSteps} taille(s) inconnue(s))` : ""}`],
    [fmtMoney(e.buildCost) + (e.buildCostUnknown ? "+" : ""), "coût des machines"],
    [fmtPollution(t.pollutionPerHour), `pollution générée${t.pollutionUnknownSteps ? ` (${t.pollutionUnknownSteps} inconnue(s))` : ""}`],
  ];
  if (e.money !== null) cards.push([e.moneyMissing ? fmtMoney(e.moneyMissing) : "✓", e.moneyMissing ? "d'argent manquant" : "argent suffisant"]);
  if (e.rpNeeded > 0) cards.push([fmtRP(e.rpNeeded), `de recherche à débloquer${e.secondsToRp !== null ? ` · ≈ ${fmtDuration(e.secondsToRp)}` : ""}`]);
  const stats = cards.map(([v, k]) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`).join("");

  const raw = p.raw.length
    ? `<p class="list-line"><b>Matières premières :</b> ${p.raw.map((r) => `<span class="chip">${esc(itemN(ctx, r.item))} <span class="num">${fmt(r.perMin, 2)}/min</span></span>`).join(" ")}</p>`
    : "";
  const surplus = p.surplus.length
    ? `<p class="list-line"><b>Surplus à évacuer :</b> ${p.surplus.map((s) => `<span class="chip accent">${esc(itemN(ctx, s.item))} <span class="num">${fmt(s.perMin, 2)}/min</span>${s.alsoDemanded ? " ♻" : ""}</span>`).join(" ")}</p>`
    : "";
  const research = e.nodesToUnlock.length
    ? `<p class="list-line"><b>Recherche à débloquer :</b> ${e.nodesToUnlock.map((n) => `<span class="chip">${esc(nodeN(ctx, n))} <span class="num">${fmt(ctx.data.nodes.get(n)?.rp ?? 0, 0)} RP</span></span>`).join(" ")}${
        e.reqItems.length ? ` — et vendre : ${e.reqItems.map((r) => `${r.amount} ${esc(itemN(ctx, r.item))}${r.done ? " ✓" : ""}`).join(", ")}` : ""
      } ${unlockButton(e.nodesToUnlock, "Je les ai débloquées")}</p>`
    : "";
  const own = e.machinesToOwn.length
    ? `<p class="list-line"><b>Machines à posséder :</b> ${e.machinesToOwn.map((m) => esc(machineN(ctx, m))).join(", ")} ${ownButton(e.machinesToOwn)}</p>`
    : "";
  const sales = p.sales.length
    ? `<p class="list-line"><b>Ventes :</b> ${p.sales.map((x) => `<span class="chip">${esc(itemN(ctx, x.item))} <span class="num">${fmt(x.perMin, 2)}/min × ${esc(fmtMoney(x.price))}</span></span>`).join(" ")}${
        p.depots.length ? ` — dépôts : ${p.depots.map((d) => `${d.machines} × ${esc(d.name)}`).join(", ")}` : ""
      }</p>`
    : "";
  return `<div class="stats">${stats}</div>${sales}${raw}${surplus}${research}${own}${renderTiers(ctx)}`;
}

/** Paliers ronds : débits où chaque étape tombe sur un nombre entier de machines (cliquables). */
export function renderTiers(ctx: Ctx): string {
  const p = ctx.plan;
  if (p.tiers.length < 2) return "";
  const money = p.target.kind === "argent";
  const unit = (r: number) => (money ? `${fmtMoney(r)}/min` : `${fmt(r, 2)}/min`);
  const chips = p.tiers
    .map((t) => {
      const final = money ? "" : ` · ${fmt(t.finalMachines, 2)} finale(s)`;
      const label = `${unit(t.ratePerMin)}${final} · ${t.machines} machines · ${fmt(t.efficiency * 100, 0)} %`;
      const title = t.exact ? "Chaque étape tombe exactement sur un nombre entier de machines." : `Occupation moyenne des machines : ${fmt(t.efficiency * 100, 1)} %.`;
      return t.current
        ? `<span class="chip tier current" title="Débit actuel. ${esc(title)}">${esc(label)}${t.exact ? " ●" : ""}</span>`
        : `<button type="button" class="chip tier${t.exact ? " exact" : ""}" data-tier="${t.ratePerMin}"${!money && Math.abs(t.finalMachines - Math.round(t.finalMachines)) < 1e-6 ? ` data-final="${Math.round(t.finalMachines)}"` : ""} title="${esc(title)}">${esc(label)}${t.exact ? " ●" : ""}</button>`;
    })
    .join(" ");
  const note = p.constraints.maxPollution !== null || p.constraints.budget !== null ? " Avec une limite de pollution ou de budget, un autre débit peut changer les recettes." : "";
  return `<p class="list-line tiers"><b>Paliers ronds :</b> ${chips}<br><span class="hint">● : chaque étape tombe juste. Le pourcentage est l'occupation moyenne des machines.${esc(note)}</span></p>`;
}

// ---------------------------------------------------------------- graphe

function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function renderGraph(ctx: Ctx): string {
  const p = ctx.plan;
  if (!p.steps.length && !p.unresolved.length) return `<p class="muted">Rien à afficher.</p>`;
  const g = layoutGraph(p);
  const steps = new Map(p.steps.map((s) => [s.key, s]));
  const unres = new Map(p.unresolved.map((u) => [u.item, u]));
  let s = `<svg viewBox="0 0 ${g.width} ${g.height}" style="${g.width < 620 ? "width:100%;max-width:620px" : `width:${g.width}px`}" role="img" aria-label="Graphe de production de ${esc(p.target.kind === "argent" ? "l'objectif argent" : itemN(ctx, p.target.item))}">
<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="var(--accent)"/></marker></defs>`;
  for (const e of g.edges) {
    s += `<path d="${edgePath(e.points)}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" marker-end="url(#ar)" opacity=".85"${e.loop ? ' stroke-dasharray="4 3"' : ""}><title>${e.loop ? "Boucle : ce flux remonte la chaîne (sous-produit réutilisé)" : ""}</title></path>`;
  }
  for (const n of g.nodes) {
    const st = steps.get(n.item);
    const u = unres.get(n.item);
    const name = itemN(ctx, st?.item ?? n.item);
    const fill = n.kind === "raw" ? "var(--bg)" : n.kind === "unresolved" ? "var(--surface)" : "var(--steel-soft)";
    const stroke = n.kind === "unresolved" ? "var(--accent)" : "var(--steel)";
    const dash = n.kind === "unresolved" ? ` stroke-dasharray="5 4"` : "";
    const line2 = st ? (st.machineKind === "farm" ? `≈ ${st.machines} arbres` : `${trunc(machineN(ctx, st.machine), 17)} ×${st.machines}`) : `non produit (${u?.reason ?? "?"})`;
    const line3 = st
      ? st.machineKind === "farm"
        ? `${fmt(st.durationS, 0)} s / pousse`
        : st.energyAvg !== null && st.energyAvg < 0
          ? `+${fmtMF(-st.energyAvg)}`
          : fmtMF(st.energyAvg)
      : `${fmt(u?.perMin ?? 0, 2)}/min`;
    const warn = st && p.verify.some((v) => v.used && v.item === st.item);
    const cx = n.x + NODE_W / 2;
    s += `<g><title>${esc(name)}${st ? ` — ${esc(machineN(ctx, st.machine))} ×${st.machines}, ${esc(fmt(st.demandPerMin, 2))}/min` : ""}</title>
<rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${n.kind === "final" ? 2 : 1}"${dash}/>
<text x="${cx}" y="${n.y + 18}" text-anchor="middle" class="g-name">${esc(trunc(name, 20))}</text>
<text x="${cx}" y="${n.y + 34}" text-anchor="middle" class="g-machine">${esc(line2)}</text>
<text x="${cx}" y="${n.y + 49}" text-anchor="middle" class="g-energy">${esc(line3)}</text>
${warn ? `<text x="${n.x + NODE_W - 10}" y="${n.y + 15}" text-anchor="middle" class="g-warn" aria-label="valeur à vérifier">⚠</text>` : ""}</g>`;
  }
  for (const e of g.edges) {
    const txt = labelText(e.perMin);
    const w = labelWidth(e.perMin);
    s += `<rect x="${e.lx - w / 2}" y="${e.ly - LABEL_H / 2}" width="${w}" height="${LABEL_H}" rx="8" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width=".8"/><text x="${e.lx}" y="${e.ly + 3.5}" text-anchor="middle" class="g-flow">${esc(txt)}</text>`;
  }
  return s + "</svg>";
}

// ---------------------------------------------------------------- plan d'action

function recipeSelect(ctx: Ctx, item: string, current: string | null, alternatives: Step["alternatives"]): string {
  const recipes = ctx.data.producers.get(item) ?? [];
  if (recipes.length < 2 && !ctx.settings.forced[item]) return "";
  const status = new Map(alternatives.map((a) => [a.recipeId, a.status]));
  const forced = ctx.settings.forced[item] ?? "";
  const opts = recipes
    .map((r) => {
      const st = status.get(r.id);
      const flag = st && st !== "ok" && st !== "forcée" ? ` — ${st}` : r.verify.length ? " — ⚠" : "";
      const label = `${machineN(ctx, r.machine)} · ${recipeText(ctx, r)}${flag}${r.id === current && !forced ? " (choisie)" : ""}`;
      return `<option value="${esc(r.id)}"${r.id === forced ? " selected" : ""}>${esc(label)}</option>`;
    })
    .join("");
  return `<label class="force">Recette pour cet item
    <select data-force="${esc(item)}"><option value=""${forced ? "" : " selected"}>Automatique (selon le critère)</option>${opts}</select></label>`;
}

function stepCard(ctx: Ctx, s: Step, i: number): string {
  const p = ctx.plan;
  const r = ctx.data.recipes.get(s.recipeId)!;
  const tags: string[] = [];
  if (p.finals.includes(s.key)) tags.push(p.target.kind === "argent" ? "Vendu" : "Produit final");
  if (s.item === ENERGY) tags.push("Générateur");
  if (s.isRaw) tags.push("Matière première");
  if (s.forced) tags.push("Recette forcée");
  if (!s.access.available) tags.push("Machine non débloquée");
  const usedFlags = p.verify.filter((v) => v.used && v.item === s.item);
  const util = Math.round(s.utilization * 100);
  const count = s.machineKind === "farm" ? `≈ ${s.machines} arbres` : `${s.machines} × ${esc(machineN(ctx, s.machine))}`;
  const ins = s.inputs.map((f) => `${fmt(f.perMin, 2)} ${esc(itemN(ctx, f.item))}`).join(" + ");
  const outs = s.consumers.map((f) => `${fmt(f.perMin, 2)} → ${esc(itemN(ctx, f.item))}`).join(" · ");
  const by = s.byproducts.map((f) => `${fmt(f.perMin, 2)} ${esc(itemN(ctx, f.item))}`).join(" + ");
  const produced = s.item === ENERGY ? `${fmtMF(-(s.energyAvg ?? 0))}` : `${fmt(s.demandPerMin, 2)}/min`;
  const energy = s.energyAvg !== null && s.energyAvg < 0 ? "" : `<span>Énergie : <span class="num">${fmtMF(s.energyAvg)}</span> (pic ${fmtMF(s.energyPeak)})</span>`;
  return `<li class="step" id="step-${esc(s.key)}"><div class="n">${String(i + 1).padStart(2, "0")}</div><div class="body">
    ${tags.length || usedFlags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}${usedFlags.length ? `<a class="tag warn" href="#verifier">⚠ ${usedFlags.length} valeur(s) à vérifier</a>` : ""}</div>` : ""}
    <div class="top"><h3>${esc(itemN(ctx, s.item))}</h3><span class="count">${count}</span></div>
    <div class="recipe">${esc(recipeText(ctx, r, s.durationS))} <span class="muted">(${esc(r.id)})</span></div>
    <div class="meta"><span>Produit : <b class="num">${produced}</b></span>${ins ? `<span>Consomme : <span class="num">${ins}</span> /min</span>` : ""}${outs ? `<span>Envoie : <span class="num">${outs}</span></span>` : ""}${
      s.machineKind === "farm" ? "" : energy
    }</div>
    ${by ? `<div class="meta"><span>Sous-produits : <span class="num">${by}</span> /min (réutilisés si la chaîne en a besoin, sinon à évacuer)</span></div>` : ""}
    ${s.growth ? `<div class="meta"><span>${esc(s.growth.detail)}</span></div>` : ""}
    ${!s.access.available ? `<div class="meta warn-text">${esc(lockText(ctx, s.access))} ${accessButton(s.access)}</div>` : ""}
    <div class="meta"><span>Calcul exact : <span class="num">${fmt(s.machinesExact, 2)}</span> → utilisation <span class="num">${util} %</span></span>${s.buildCost !== null ? `<span>Coût : <span class="num">${fmtMoney(s.buildCost)}</span></span>` : ""}${
      s.footprint !== null ? `<span>Surface : <span class="num">${fmt(s.footprint, 0)}</span> cases</span>` : ""
    }</div>
    <div class="bar" aria-hidden="true"><i class="${util < 60 ? "low" : ""}" style="width:${util}%"></i></div>
    ${s.item === ENERGY ? "" : recipeSelect(ctx, s.item, s.recipeId, s.alternatives)}
  </div></li>`;
}

/** Boutons qui mettent à jour la progression depuis le plan (gérés par main.ts). */
function unlockButton(nodes: string[], label: string): string {
  return nodes.length ? `<button type="button" class="link" data-unlock="${esc(nodes.join(","))}">${esc(label)}</button>` : "";
}
function ownButton(machines: string[]): string {
  return machines.length ? `<button type="button" class="link" data-own="${esc(machines.join(","))}">Je la possède</button>` : "";
}
function accessButton(a: Step["access"]): string {
  if (a.available) return "";
  return a.needsOwnership ? ownButton([a.machine]) : unlockButton(a.missingNodes, "Je les ai débloquées");
}

function lockText(ctx: Ctx, a: Step["access"]): string {
  if (a.available) return "";
  if (a.needsOwnership) return `Il faut posséder la machine ${machineN(ctx, a.machine)} (elle ne se débloque pas par la recherche).`;
  return `Recherche manquante : ${a.missingNodes.map((n) => nodeN(ctx, n)).join(" → ")} (${fmtRP(a.rpCost)})${a.reqItems.length ? ` et vendre ${a.reqItems.map((r) => `${r.amount} ${itemN(ctx, r.item)}`).join(", ")}` : ""}.`;
}

const LEAF_TEXT: Record<string, string> = {
  verrouillé: "Recherche manquante pour toutes les recettes.",
  "aucune recette": "Aucune recette connue dans les données (source inconnue).",
  "seulement à vérifier": "Seules des recettes « à vérifier » existent : active l'option « utiliser les recettes à vérifier » ou corrige les valeurs plus bas.",
  incalculable: "Les recettes connues ont des valeurs manquantes : complète-les dans « À vérifier ».",
  boucle: "Boucle de dépendance : cet item dépend de lui-même.",
};

function unresolvedCard(ctx: Ctx, u: Unresolved, i: number): string {
  if (u.loopShortfall) {
    return `<li class="step unresolved" id="loop-${esc(u.item)}"><div class="n">${String(i + 1).padStart(2, "0")}</div><div class="body">
    <div class="tags"><span class="tag warn">Boucle</span></div>
    <div class="top"><h3>${esc(itemN(ctx, u.item))}</h3><span class="count">+${fmt(u.perMin, 2)}/min</span></div>
    <div class="meta"><span>Cet item est produit plus haut dans le plan, mais la chaîne en consomme aussi pour s'alimenter elle-même (boucle). Cette quantité supplémentaire n'est pas comptée : prévois de la marge, ou force une autre recette.</span></div>
  </div></li>`;
  }
  return `<li class="step unresolved" id="step-${esc(u.item)}"><div class="n">${String(i + 1).padStart(2, "0")}</div><div class="body">
    <div class="tags"><span class="tag warn">Non produit</span></div>
    <div class="top"><h3>${esc(itemN(ctx, u.item))}</h3><span class="count">${u.perMin ? `${fmt(u.perMin, 2)}/min` : "—"}</span></div>
    <div class="meta"><span>${esc(LEAF_TEXT[u.reason] ?? u.reason)}</span></div>
    ${u.unlock ? `<div class="meta warn-text">${esc(lockText(ctx, u.unlock))} ${accessButton(u.unlock)}</div>` : ""}
    ${recipeSelect(ctx, u.item, null, u.candidates)}
  </div></li>`;
}

export function renderPlan(ctx: Ctx): string {
  const p = ctx.plan;
  const cards = p.steps.map((s, i) => stepCard(ctx, s, i));
  p.unresolved.forEach((u, j) => cards.push(unresolvedCard(ctx, u, p.steps.length + j)));
  return cards.join("");
}

// ---------------------------------------------------------------- à vérifier

function currentValue(ctx: Ctx, v: VerifyEntry): unknown {
  const e: any = v.scope === "recette" ? ctx.data.recipes.get(v.id) : ctx.data.machines.get(v.id);
  if (!e) return undefined;
  const m = /^(inputs|outputs)\.(.+)$/.exec(v.flag.field);
  return m ? e[m[1]!]?.[m[2]!] : e[v.flag.field];
}

function showValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return fmt(v, 4);
  if (typeof v === "object" && v && "w" in v && "l" in v) return `${(v as { w: number }).w}×${(v as { l: number }).l}`;
  if (Array.isArray(v)) return v.map(showValue).join(" – ");
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 79)}…` : s;
}

export function renderVerify(ctx: Ctx): string {
  const p = ctx.plan;
  const groups = new Map<string, VerifyEntry[]>();
  for (const v of p.verify) {
    const k = `${v.scope}|${v.id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(v);
  }
  const sorted = [...groups.values()].sort((a, b) => Number(b[0]!.used) - Number(a[0]!.used));
  const blocks = sorted.map((list) => {
    const head = list[0]!;
    const isRecipe = head.scope === "recette";
    const entity = isRecipe ? ctx.data.recipes.get(head.id) : ctx.data.machines.get(head.id);
    const title = isRecipe
      ? `Recette <code>${esc(head.id)}</code> · ${esc(machineN(ctx, (entity as Recipe | undefined)?.machine ?? ""))} → ${esc(itemN(ctx, head.item))}`
      : `Machine ${esc(machineN(ctx, head.id))}`;
    const primary = entity?.sources[0];
    const rows = list
      .map((v) => {
        const editable = isEditableField(head.scope, v.flag.field);
        const scopeKey = isRecipe ? "recipes" : "machines";
        const fid = `fix-${v.id}-${v.flag.field}`;
        const alts = (v.flag.alternatives ?? []).map((a) => `<b class="num">${esc(showValue(a.value))}</b> selon ${sourceLink(a.source)}`).join(" ; ");
        // Pour une contradiction, le détail répète les valeurs : on le remplace par « retenu / autre ».
        const detail = v.flag.reason === "contradiction" && alts ? "" : `<div class="vdetail">${esc(v.flag.detail)}</div>`;
        const input = editable
          ? `<form class="fix" data-scope="${scopeKey}" data-id="${esc(v.id)}" data-field="${esc(v.flag.field)}">
              <label for="${esc(fid)}">Valeur relevée en jeu</label>
              <input id="${esc(fid)}" name="value" inputmode="decimal" placeholder="${v.flag.field === "size" ? "ex. 8x8" : `actuel : ${esc(showValue(currentValue(ctx, v)))}`}" autocomplete="off">
              <button type="submit">Appliquer</button><span class="fix-error" role="alert"></span></form>`
          : `<p class="muted vdetail">Ce champ ne se corrige pas ici (voir <code>data/overrides.json</code>).</p>`;
        return `<li class="vrow"><div class="vhead"><span class="vfield">${esc(fieldLabel(v.flag.field, (id) => itemN(ctx, id)))}</span>
            <span class="badge ${esc(v.flag.reason)}">${esc(REASON_LABEL[v.flag.reason] ?? v.flag.reason)}</span></div>
          <div class="vvals">Retenu : <b class="num">${esc(showValue(currentValue(ctx, v)))}</b>${primary ? ` selon ${sourceLink(primary)}` : ""}${alts ? ` · Autre : ${alts}` : ""}</div>
          ${detail}${input}</li>`;
      })
      .join("");
    return `<div class="verify-group panel${head.used ? "" : " unused"}"><h3>${title}</h3>
      <p class="vstate">${head.used ? "Utilisée dans le calcul" : "Recette écartée (elle pourrait être meilleure une fois vérifiée)"}</p>
      <ul class="vrows">${rows}</ul></div>`;
  });
  if (!blocks.length) return `<p class="muted">Aucune valeur douteuse dans cette chaîne.</p>`;
  return blocks.join("");
}

export function renderCorrections(ctx: Ctx): string {
  const rows: string[] = [];
  for (const scope of ["recipes", "machines", "items", "research"] as const) {
    for (const [id, fields] of Object.entries(ctx.corrections[scope] ?? {})) {
      for (const [field, entry] of Object.entries(fields)) {
        rows.push(`<li><code>${esc(scope)}/${esc(id)}</code> · ${esc(fieldLabel(field, (x) => itemN(ctx, x)))} = <b>${esc(showValue(entry.value))}</b> <span class="muted">(${esc(entry.source.fetchedAt.slice(0, 10))})</span>
          <button type="button" class="link" data-remove="${esc(scope)}|${esc(id)}|${esc(field)}">retirer</button></li>`);
      }
    }
  }
  return rows.length ? `<ul class="corrections">${rows.join("")}</ul>` : `<p class="muted">Aucune correction locale pour l'instant.</p>`;
}

// ---------------------------------------------------------------- recettes et avertissements

export function renderRecipes(ctx: Ctx): string {
  return ctx.plan.steps
    .map((s) => {
      const r = ctx.data.recipes.get(s.recipeId)!;
      const flags = r.verify.length ? ` <a class="tag warn" href="#verifier">⚠ ${r.verify.length}</a>` : "";
      return `<tr><td>${esc(itemN(ctx, s.item))}${flags}</td><td>${esc(machineN(ctx, r.machine))}</td><td class="mono">${esc(recipeText(ctx, r, s.durationS))}</td>
        <td class="num">${r.energyMFps === null ? "?" : fmtMF(r.energyMFps)}</td><td class="src">${r.sources.map(sourceLink).join("<br>")}</td></tr>`;
    })
    .join("");
}

export function renderWarnings(ctx: Ctx): string {
  const w = ctx.plan.warnings;
  if (!w.length) return `<p class="muted">Aucun avertissement.</p>`;
  return `<ul class="notes">${w.map((x) => `<li class="w-${esc(x.code.split(":")[0])}">${esc(x.message)}</li>`).join("")}</ul>`;
}
