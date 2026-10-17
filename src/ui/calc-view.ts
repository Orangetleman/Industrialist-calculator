// Schéma : panneau « Comment c'est calculé » (S7). Pour un bloc : le craft utilisé (sa ligne, comme
// dans Recettes), puis chaque nombre du bloc avec son calcul et la source des valeurs du jeu. Pour
// une flèche : qui la produit, qui la consomme, et le calcul de son débit. Fonctions pures (chaînes
// HTML) : main.ts les insère sous la barre du bas du schéma.
//
// Les formules suivent le moteur (solve.ts) :
//   débit d'une machine = sortie nette par cycle × 60 ÷ durée ;
//   demande = tout ce que produit l'étape (ses flèches, plus l'objectif ou un surplus) ;
//   machines = demande ÷ débit d'une machine, puis arrondi au-dessus ;
//   entrée = demande × quantité ÷ sortie (quantités nettes par cycle) ;
//   flèche = besoin de l'arrivée × part du départ dans la production de l'objet.

import { ENERGY, POLLUTION } from "../engine/resources.ts";
import type { Step } from "../engine/solve.ts";
import type { Recipe } from "../engine/types.ts";
import { esc, fmt } from "./format.ts";
import { nodeText, type ViewCtx } from "./plan-view.ts";
import { craftHref, fixableHere, fixKey, renderCraft, verifyHref, type RecipesCtx } from "./recipes-view.ts";
import { accessButton, itemN, LEAF_TEXT, lockText, machineN } from "./render.ts";

/** Nombre d'un calcul : assez de décimales pour le refaire à la main, pas plus. */
export function num(x: number): string {
  const a = Math.abs(x);
  return fmt(x, a >= 1000 ? 1 : a >= 1 || a === 0 ? 2 : 4);
}
/** Quantité d'un craft, telle qu'en jeu. */
const qty = (x: number) => fmt(x, 3);
/** Puissance d'un calcul, avec préfixe comme en jeu, sans arrondi qui fausse le calcul (« 6,25 kMF/s »). */
export function mf(w: number | null): string {
  if (w === null || !Number.isFinite(w)) return "—";
  const a = Math.abs(w);
  return a >= 1e9 ? `${fmt(w / 1e9, 3)} GMF/s` : a >= 1e6 ? `${fmt(w / 1e6, 3)} MMF/s` : a >= 1e3 ? `${fmt(w / 1e3, 3)} kMF/s` : `${fmt(w, 2)} MF/s`;
}
const pct = (x: number) => `${fmt(x * 100, x >= 0.9995 || x === 0 ? 0 : 2)} %`;
const isWhole = (x: number) => Math.abs(x - Math.round(x)) < 1e-6;
const EPS = 1e-6;

const SRC_LABEL: Record<string, string> = { miraheze: "wiki", fandom: "wiki", desmos: "Desmos", jeu: "relevé en jeu", saisie: "ta correction" };

/**
 * Étiquette de source d'une valeur de craft : correction (relevé en jeu ou ta saisie), sinon ⚠ à
 * vérifier, sinon craft ajouté (relevé), sinon la source du craft (wiki). `label` : « durée », « sortie »…
 */
export function sourceTag(r: Recipe, field: string, label = ""): string {
  const pre = label ? `${label} : ` : "";
  const c = r.corrections?.find((x) => x.field === field);
  if (c) {
    const mine = c.source.wiki === "saisie";
    const t = `${mine ? "Ta correction" : "Relevé en jeu"} du ${c.source.fetchedAt.slice(0, 10)} ; avant : ${String(c.previous ?? "—")}${c.source.note ? ` — ${c.source.note}` : ""}`;
    return `<span class="src-tag ${mine ? "fix" : "jeu"}" title="${esc(t)}">${esc(pre)}${mine ? "ta correction" : "relevé en jeu"}</span>`;
  }
  const f = r.verify.find((x) => x.field === field);
  if (f) {
    const text = `${pre}⚠ à vérifier : ${f.detail}`;
    return fixableHere("recipes", field)
      ? `<button type="button" class="src-tag warn" data-rc-focus="${esc(fixKey("recipes", r.id, field))}" title="Corriger cette valeur dans la fiche">${esc(text)}</button>`
      : `<a class="src-tag warn" href="${verifyHref("recette", r.id, field)}" title="Corriger cette valeur dans Données">${esc(text)}</a>`;
  }
  if (r.added) return `<span class="src-tag jeu" title="${esc(`Craft ajouté (relevé en jeu, ${r.added.fetchedAt.slice(0, 10)})`)}">${esc(pre)}relevé en jeu</span>`;
  const s = r.sources[0];
  if (!s) return `<span class="src-tag warn">${esc(pre)}sans source</span>`;
  const name = { miraheze: "Miraheze", fandom: "Fandom", desmos: "Desmos", jeu: "relevé en jeu", saisie: "ta saisie" }[s.wiki];
  const t = `${name}, relevé du ${s.fetchedAt.slice(0, 10)}${s.note ? ` — ${s.note}` : ""}`;
  const cls = s.wiki === "jeu" ? "jeu" : s.wiki === "saisie" ? "fix" : "wiki";
  const text = `${pre}${SRC_LABEL[s.wiki] ?? s.wiki}`;
  return s.url
    ? `<a class="src-tag ${cls}" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(t)}">${esc(text)}</a>`
    : `<span class="src-tag ${cls}" title="${esc(t)}">${esc(text)}</span>`;
}

type Row = { label: string; formula: string; result: string; src?: string };

function table(rows: Row[]): string {
  return `<table class="calc-t"><tbody>${rows
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="f">${r.formula}</td><td class="r">${esc(r.result)}</td><td class="s">${r.src ?? ""}</td></tr>`)
    .join("")}</tbody></table>`;
}

function panel(title: string, body: string, link = "", attrs = ""): string {
  return `<section class="calc"${attrs} aria-label="Comment c'est calculé"><div class="calc-head"><h3>Comment c'est calculé <span>· ${esc(title)}</span></h3>${link}</div>${body}</section>`;
}

/** Nom d'un bloc dans un calcul : l'objet, et la machine s'il y a plusieurs blocs pour le même objet. */
function blockName(v: ViewCtx, key: string): string {
  const st = v.plan.steps.find((s) => s.key === key);
  if (st) return key.includes("@") ? `${itemN(v, st.item)}, ${machineN(v, st.machine)}` : itemN(v, st.item);
  const ex = v.plan.existing.find((x) => x.key === key);
  if (ex) return `ta production de ${itemN(v, ex.item)}`;
  return `${itemN(v, key)} à apporter`;
}

/** Quantité nette d'un objet par cycle dans un craft (> 0 produit, < 0 consommé), comme le moteur. */
const netQty = (r: Recipe, item: string) => (r.outputs[item] ?? 0) - (r.inputs[item] ?? 0);

/** Lignes « demande » : les flèches qui partent du bloc, plus l'objectif ou le surplus. */
function demandRow(v: ViewCtx, s: Step, unit = "/min"): Row {
  const out = new Map<string, number>();
  for (const e of v.plan.edges) if (e.from === s.key && e.item === s.item) out.set(e.to, (out.get(e.to) ?? 0) + e.perMin);
  const parts = [...out].map(([k, x]) => ({ x, label: blockName(v, k) }));
  const rest = s.demandPerMin - parts.reduce((t, p) => t + p.x, 0);
  if (rest > EPS * Math.max(1, s.demandPerMin)) {
    const sale = v.plan.sales.find((x) => x.item === s.item);
    const label = v.plan.finals.includes(s.key) ? (sale ? "à vendre, objectif du plan" : "objectif du plan") : "surplus, à évacuer";
    parts.push({ x: rest, label });
  }
  const formula = parts.length ? parts.map((p) => `${num(p.x)} (${esc(p.label)})`).join(" + ") : "aucune";
  return { label: "Demande", formula, result: `${num(s.demandPerMin)} ${unit}`, src: parts.length > 1 ? "somme des flèches qui partent du bloc" : "" };
}

function machinesLabel(v: ViewCtx, s: Step, n: number): string {
  return s.machineKind === "farm" ? `≈ ${fmt(n, 0)} × ${machineN(v, s.machine)}` : `${fmt(n, 0)} ${machineN(v, s.machine)}`;
}

/** Machines exactes → arrondies, puis utilisation et énergie (communes à toutes les étapes). */
function countRows(v: ViewCtx, s: Step, r: Recipe, formula: string): Row[] {
  const rows: Row[] = [];
  const round = isWhole(s.machinesExact) ? "" : " → arrondi au-dessus";
  rows.push({ label: s.parts ? "Installations" : "Machines", formula: `${formula} = ${num(s.machinesExact)}${round}`, result: s.parts ? num(s.machinesExact) : machinesLabel(v, s, s.machines) });
  if (s.parts) {
    for (const q of s.parts) {
      const per = r.parts?.find((p) => p.machine === q.machine)?.count ?? 0;
      rows.push({ label: machineN(v, q.machine), formula: `${num(s.machinesExact)} × ${qty(per)} = ${num(q.exact)}${isWhole(q.exact) ? "" : " → arrondi au-dessus"}`, result: `${fmt(q.count, 0)} ${machineN(v, q.machine)}` });
    }
    return rows;
  }
  if (s.machines) rows.push({ label: "Utilisation", formula: `${num(s.machinesExact)} ÷ ${fmt(s.machines, 0)}`, result: pct(s.utilization) });
  const e = s.energyMFps;
  if (s.machineKind !== "farm" && s.item !== ENERGY) {
    rows.push(
      e === null
        ? { label: "Énergie", formula: "inconnue pour ce craft", result: "—", src: sourceTag(r, "energyMFps") }
        : e === 0
          ? { label: "Énergie", formula: "sans énergie", result: "0", src: sourceTag(r, "energyMFps") }
          : {
              label: "Énergie",
              formula: `${num(s.machinesExact)} × ${esc(mf(e))}${!isWhole(s.machinesExact) ? ` (en pointe : ${fmt(s.machines, 0)} × ${esc(mf(e))} = ${esc(mf(s.energyPeak))})` : ""}`,
              result: mf(s.energyAvg),
              src: sourceTag(r, "energyMFps"),
            },
    );
  }
  return rows;
}

/** Entrées (et sous-produits) : demande × quantité ÷ sortie, ou machines × quantité × 60 ÷ durée. */
function flowRows(v: ViewCtx, s: Step, r: Recipe, byDemand: boolean): Row[] {
  const out = s.outputPerCycle;
  const formula = (q: number) => (byDemand ? `${num(s.demandPerMin)} × ${qty(q)} ÷ ${qty(out)}` : `${num(s.machinesExact)} × ${qty(q)} × 60 ÷ ${num(s.durationS)} s`);
  const rows: Row[] = [];
  for (const f of s.inputs) rows.push({ label: `Entrée ${itemN(v, f.item)}`, formula: formula(-netQty(r, f.item)), result: `${num(f.perMin)} /min`, src: sourceTag(r, `inputs.${f.item}`) });
  for (const f of s.byproducts) rows.push({ label: `Sous-produit ${itemN(v, f.item)}`, formula: formula(netQty(r, f.item)), result: `${num(f.perMin)} /min`, src: sourceTag(r, `outputs.${f.item}`) });
  return rows;
}

/** Phrase d'explication en tête du tableau, pour les cas particuliers. */
function stepNote(v: ViewCtx, s: Step): string {
  const notes: string[] = [];
  if (s.parts) notes.push("Installation composée : le craft décrit l'installation entière, « par seconde ». Chaque bâtiment est compté à part et arrondi au-dessus.");
  if (s.growth)
    notes.push(
      `La durée est celle de la pousse des arbres : ${esc(s.growth.detail)}${s.growth.sourceUrl ? ` (<a href="${esc(s.growth.sourceUrl)}" target="_blank" rel="noopener">source</a>)` : ""}. Le nombre d'arbres est indicatif.`,
    );
  else if (s.isRaw && s.item !== ENERGY && s.item !== POLLUTION) notes.push("Matière première : extraite sur place, sans entrée.");
  if (!s.access.available) notes.push(`${esc(lockText(v, s.access))} ${accessButton(s.access)}`);
  return notes.length ? `<p class="calc-note">${notes.join(" ")}</p>` : "";
}

/** Débit d'une machine pour un objet : sortie nette × 60 ÷ durée (le détail si le craft en consomme aussi). */
function rateRow(s: Step, r: Recipe, name: string): Row {
  const gross = r.outputs[s.item] ?? 0;
  const back = r.inputs[s.item] ?? 0;
  const out = back ? `(${qty(gross)} − ${qty(back)})` : qty(s.outputPerCycle);
  const duration = s.growth ? `<span class="src-tag warn" title="${esc(s.growth.detail)}">durée : pousse, ${esc(s.growth.method === "formule" ? "approximative" : s.growth.method)}</span>` : sourceTag(r, "durationS", "durée");
  return {
    label: "Débit d'une machine",
    formula: `${out} ${esc(name)} × 60 ÷ ${num(s.durationS)} s`,
    result: `${num(s.ratePerMachine)} /min`,
    src: `${sourceTag(r, `outputs.${s.item}`, "sortie")} ${duration}`,
  };
}

/** Panneau d'un bloc du schéma : étape, production existante ou objet non produit. */
export function renderStepCalc(v: ViewCtx, rc: RecipesCtx, key: string): string {
  const p = v.plan;
  const s = p.steps.find((x) => x.key === key);
  if (!s) {
    const ex = p.existing.find((x) => x.key === key);
    if (ex) {
      return panel(
        itemN(v, ex.item),
        `<p class="calc-note">Ta production déjà en place (<a href="#usine">Mon usine</a>) : ${num(ex.available)} /min déclarés, dont <b>${num(ex.used)} /min</b> utilisés par ce plan. Rien à construire : le calcul s'en sert avant de construire.</p>`,
      );
    }
    const u = p.unresolved.find((x) => x.item === key);
    if (!u) return "";
    const why = u.loopShortfall ? "la chaîne en consomme aussi pour s'alimenter elle-même (boucle) : prévois de la marge" : u.unlock ? `${esc(lockText(v, u.unlock))} ${accessButton(u.unlock)}` : esc(LEAF_TEXT[u.reason] ?? u.reason);
    return panel(itemN(v, u.item), `<p class="calc-note">Non produit dans ce plan : <b>${num(u.perMin)} /min</b> à apporter. ${why}</p>`);
  }
  const r = v.data.recipes.get(s.recipeId);
  if (!r) return "";
  const card = s.item === ENERGY || s.item === POLLUTION || !v.data.items.has(s.item) ? craftHref("machine", r.machine, r.id) : craftHref("objet", s.item, r.id);
  const link = `<a href="${card}" class="calc-link">Voir dans Recettes ▸</a>`;
  const craft = `<ul class="rc-crafts calc-craft">${renderCraft({ ...rc, edit: null, highlight: null }, r)}</ul>`;
  const name = itemN(v, s.item);
  const rows: Row[] = [];
  if (s.item === ENERGY) {
    const made = -(s.energyAvg ?? 0);
    rows.push({ label: s.parts ? "Production d'une installation" : "Production d'une machine", formula: "énergie du craft", result: mf(s.ratePerMachine), src: sourceTag(r, "energyMFps") });
    rows.push({ label: "Énergie à produire", formula: "consommation de la chaîne (et l'objectif)", result: mf(made) });
    rows.push(...countRows(v, s, r, `${esc(mf(made))} ÷ ${esc(mf(s.ratePerMachine))}`));
    rows.push(...flowRows(v, s, r, false));
  } else if (s.item === POLLUTION || !(s.outputPerCycle > 0)) {
    rows.push(...countRows(v, s, r, "pollution à retirer, d'après l'optimisation"));
    rows.push(...flowRows(v, s, r, false));
  } else {
    rows.push(rateRow(s, r, name));
    rows.push(demandRow(v, s));
    rows.push(...countRows(v, s, r, `${num(s.demandPerMin)} ÷ ${num(s.ratePerMachine)}`));
    rows.push(...flowRows(v, s, r, true));
  }
  const foot = `<p class="calc-foot">Craft <code>${esc(r.id)}</code>${r.verify.length ? ` · ${r.verify.length} valeur${r.verify.length > 1 ? "s" : ""} à vérifier : un ⚠ mène à la valeur, dans la fiche, en mode « ✎ Corriger »` : ""}.</p>`;
  return panel(name, `${craft}${stepNote(v, s)}${table(rows)}${foot}`, link, ` data-calc-item="${esc(s.item === ENERGY || s.item === POLLUTION ? "" : s.item)}" data-calc-machine="${esc(r.machine)}" data-calc-craft="${esc(r.id)}"`);
}

export type EdgeSel = { from: string; to: string; item: string; perMin: number; loop: boolean };

/** Ce que produit un bloc d'un objet (/min) : son objet principal, un sous-produit, ta production, un manque. */
function producedBy(v: ViewCtx, key: string, item: string): number {
  const s = v.plan.steps.find((x) => x.key === key);
  if (s) return s.item === item ? s.demandPerMin : (s.byproducts.find((f) => f.item === item)?.perMin ?? 0);
  const ex = v.plan.existing.find((x) => x.key === key);
  if (ex) return ex.item === item ? ex.used : 0;
  return v.plan.unresolved.find((u) => u.item === key && u.item === item)?.perMin ?? 0;
}

/** Tous les blocs qui produisent un objet, avec leur production. */
function producersOf(v: ViewCtx, item: string): { key: string; x: number; by: boolean }[] {
  const p = v.plan;
  const list: { key: string; x: number; by: boolean }[] = [];
  for (const s of p.steps) {
    const x = producedBy(v, s.key, item);
    if (x > 0) list.push({ key: s.key, x, by: s.item !== item });
  }
  for (const ex of p.existing) if (ex.item === item && ex.used > 0) list.push({ key: ex.key, x: ex.used, by: false });
  for (const u of p.unresolved) if (u.item === item && u.perMin > 0) list.push({ key: u.item, x: u.perMin, by: false });
  return list;
}

/** Panneau d'une flèche : qui la produit, qui la consomme, et le calcul de son débit. */
export function renderEdgeCalc(v: ViewCtx, e: EdgeSel): string {
  const name = itemN(v, e.item);
  const a = nodeText(v, e.from);
  const b = nodeText(v, e.to);
  const made = producedBy(v, e.from, e.item);
  const to = b.step;
  const need = to?.inputs.find((f) => f.item === e.item)?.perMin ?? e.perMin;
  const who = `<div class="calc-who"><div><h4>Produit par</h4>${esc(a.text)} : ${num(made)} /min <button type="button" class="link small" data-flow="${esc(e.from)}">au schéma</button></div><div><h4>Consommé par</h4>${esc(b.text)} : ${num(need)} /min <button type="button" class="link small" data-flow="${esc(e.to)}">au schéma</button></div></div>`;
  const rows: Row[] = [];
  const r = to ? v.data.recipes.get(to.recipeId) : undefined;
  if (to && r && to.outputPerCycle > 0 && to.item !== ENERGY && to.item !== POLLUTION) {
    rows.push({ label: "Besoin de l'arrivée", formula: `${num(to.demandPerMin)} × ${qty(-netQty(r, e.item))} ÷ ${qty(to.outputPerCycle)} (entrée ${esc(name)} de ${esc(blockName(v, e.to))})`, result: `${num(need)} /min`, src: sourceTag(r, `inputs.${e.item}`) });
  } else if (to && r) {
    rows.push({ label: "Besoin de l'arrivée", formula: `${num(to.machinesExact)} × ${qty(-netQty(r, e.item))} × 60 ÷ ${num(to.durationS)} s`, result: `${num(need)} /min`, src: sourceTag(r, `inputs.${e.item}`) });
  }
  const prods = producersOf(v, e.item);
  if (prods.length > 1) {
    const total = prods.reduce((t, x) => t + x.x, 0);
    rows.push({ label: `${name} produit en tout`, formula: prods.map((x) => `${num(x.x)} (${x.by ? "sous-produit : " : ""}${esc(blockName(v, x.key))})`).join(" + "), result: `${num(total)} /min` });
    rows.push({ label: "Part du départ", formula: `${num(made)} ÷ ${num(total)}`, result: pct(made / total), src: "chaque consommateur est servi au prorata des producteurs" });
    rows.push({ label: "Débit de la flèche", formula: `${num(need)} × ${pct(made / total)}`, result: `${num(e.perMin)} /min` });
  } else {
    rows.push({ label: "Débit de la flèche", formula: `tout vient de ${esc(blockName(v, e.from))}`, result: `${num(e.perMin)} /min` });
  }
  const loop = e.loop ? `<p class="calc-note">Boucle : ce flux remonte la chaîne (un sous-produit renvoyé vers une étape en amont).</p>` : "";
  return panel(`${name}, ${num(e.perMin)} /min`, `${who}${loop}${table(rows)}`);
}
