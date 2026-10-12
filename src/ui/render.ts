// Rendu HTML commun : noms, recettes, sources, boutons de progression, panneau « à vérifier ».
// Fonctions pures (chaînes), sans accès au DOM. La vue d'un plan est dans plan-view.ts.

import type { GameData } from "../engine/data.ts";
import { ENERGY, POLLUTION } from "../engine/resources.ts";
import type { Plan, Step, Unresolved, VerifyEntry } from "../engine/solve.ts";
import type { OverridesFile, Recipe, Source } from "../engine/types.ts";
import { esc, fieldLabel, fmt, fmtRP, isEditableField, REASON_LABEL } from "./format.ts";
import { noteKey, type Notes, type Settings } from "./state.ts";

export type Ctx = { data: GameData; plan: Plan; settings: Settings; corrections: OverridesFile };

export const itemN = (ctx: Pick<Ctx, "data">, id: string) => (id === ENERGY ? "Énergie" : id === POLLUTION ? "Dépollution (Scrubbers)" : (ctx.data.items.get(id)?.name ?? id));
export const machineN = (ctx: Pick<Ctx, "data">, id: string) => ctx.data.machines.get(id)?.name ?? id;
export const nodeN = (ctx: Pick<Ctx, "data">, id: string) => ctx.data.nodes.get(id)?.name ?? id;

export function recipeText(ctx: Ctx, r: Recipe, durationS?: number): string {
  const side = (o: Record<string, number | null>) =>
    Object.entries(o)
      .map(([k, v]) => `${v === null ? "?" : fmt(v, 3)}× ${itemN(ctx, k)}`)
      .join(" + ");
  const ins = side(r.inputs);
  const d = durationS ?? r.durationS;
  return `${ins ? `${ins} → ` : "→ "}${side(r.outputs)} · ${d === null ? "durée ?" : `${fmt(d, 2)} s`}`;
}

export function sourceLink(s: Source | undefined): string {
  if (!s) return "—";
  const label = { miraheze: "Miraheze", fandom: "Fandom", desmos: "Desmos", jeu: "relevé en jeu", saisie: "ta saisie" }[s.wiki];
  const date = s.fetchedAt.slice(0, 10);
  return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(label)}</a> <span class="muted">${esc(date)}</span>` : `${esc(label)} <span class="muted">${esc(date)}</span>`;
}

// ---------------------------------------------------------------- recettes et progression

/** Menu « recette pour cet item » : automatique (selon la priorité) ou forcée. */
export function recipeSelect(ctx: Ctx, item: string, current: string | null, alternatives: Step["alternatives"]): string {
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
  return `<label class="force"><span class="sr-only">Recette pour ${esc(itemN(ctx, item))}</span>
    <select data-force="${esc(item)}"><option value=""${forced ? "" : " selected"}>Automatique (selon la priorité)</option>${opts}</select></label>`;
}

/** Boutons qui mettent à jour la progression depuis le plan (gérés par main.ts). */
export function unlockButton(nodes: string[], label: string): string {
  return nodes.length ? `<button type="button" class="link" data-unlock="${esc(nodes.join(","))}">${esc(label)}</button>` : "";
}
export function ownButton(machines: string[]): string {
  return machines.length ? `<button type="button" class="link" data-own="${esc(machines.join(","))}">Je la possède</button>` : "";
}
export function accessButton(a: Step["access"]): string {
  if (a.available) return "";
  return a.needsOwnership ? ownButton([a.machine]) : unlockButton(a.missingNodes, "Je les ai débloquées");
}

export function lockText(ctx: Ctx, a: Step["access"]): string {
  if (a.available) return "";
  if (a.needsOwnership) return `Il faut posséder la machine ${machineN(ctx, a.machine)} (elle ne se débloque pas par la recherche).`;
  return `Recherche manquante : ${a.missingNodes.map((n) => nodeN(ctx, n)).join(" → ")} (${fmtRP(a.rpCost)})${a.reqItems.length ? ` et vendre ${a.reqItems.map((r) => `${r.amount} ${itemN(ctx, r.item)}`).join(", ")}` : ""}.`;
}

export const LEAF_TEXT: Record<string, string> = {
  verrouillé: "Recherche manquante pour toutes les recettes.",
  "aucune recette": "Aucune recette connue dans les données (source inconnue).",
  "seulement à vérifier": "Seules des recettes « à vérifier » existent : active l'option « utiliser aussi les valeurs à vérifier », ou corrige-les dans Données.",
  incalculable: "Les recettes connues ont des valeurs manquantes : complète-les dans Données.",
  boucle: "Boucle de dépendance : cet item dépend de lui-même.",
};

// ---------------------------------------------------------------- à vérifier

function currentValue(ctx: Ctx, v: VerifyEntry): unknown {
  const e: any = v.scope === "recette" ? ctx.data.recipes.get(v.id) : ctx.data.machines.get(v.id);
  if (!e) return undefined;
  const m = /^(inputs|outputs)\.(.+)$/.exec(v.flag.field);
  const raw = m ? e[m[1]!]?.[m[2]!] : e[v.flag.field];
  // Une recherche s'affiche par son nom, pas par son identifiant.
  return v.flag.field === "unlockedBy" && typeof raw === "string" ? nodeN(ctx, raw) : raw;
}

/** Toutes les valeurs à vérifier des données (recettes et machines), celles du plan d'abord. */
export function allVerifyEntries(ctx: Pick<Ctx, "data" | "plan">): VerifyEntry[] {
  const used = new Set(ctx.plan.verify.filter((v) => v.used).map((v) => `${v.scope}|${v.id}`));
  const out: VerifyEntry[] = [];
  for (const r of ctx.data.recipes.values()) {
    for (const flag of r.verify) out.push({ scope: "recette", id: r.id, item: Object.keys(r.outputs)[0] ?? "", flag, used: used.has(`recette|${r.id}`) });
  }
  for (const m of ctx.data.machines.values()) {
    for (const flag of m.verify) out.push({ scope: "machine", id: m.id, item: "", flag, used: used.has(`machine|${m.id}`) });
  }
  return out;
}

function showValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return fmt(v, 4);
  if (typeof v === "object" && v && "w" in v && "l" in v) return `${(v as { w: number }).w}×${(v as { l: number }).l}`;
  if (Array.isArray(v)) return v.map(showValue).join(" – ");
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 79)}…` : s;
}

/**
 * Valeurs à vérifier, groupées par recette ou machine. `entries` : celles du plan (par défaut) ou
 * toutes ; `notes` : les notes laissées (affichées sous chaque valeur, avec de quoi en écrire une).
 */
export function renderVerify(ctx: Ctx, opts: { entries?: VerifyEntry[]; notes?: Notes; all?: boolean } = {}): string {
  const entries = opts.entries ?? ctx.plan.verify;
  const notes = opts.notes ?? {};
  const groups = new Map<string, VerifyEntry[]>();
  for (const v of entries) {
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
        const nk = noteKey(scopeKey, v.id, v.flag.field);
        const note = notes[nk];
        const noteBox = `<details class="vnote"${note ? " open" : ""}><summary>${note ? "Ta note" : "Laisser une note plutôt qu'une valeur"}</summary>
            <form class="note-form" data-note="${esc(nk)}"><label class="sr-only" for="note-${esc(nk)}">Note</label>
            <textarea id="note-${esc(nk)}" name="note" rows="2" maxlength="1000" placeholder="ex. deux ports d'entrée : l'un pour l'eau chaude, l'autre pour l'eau à convertir">${esc(note?.text ?? "")}</textarea>
            <div class="row"><button type="submit">Enregistrer la note</button>${note ? `<button type="button" class="link" data-note-del="${esc(nk)}">effacer</button> <span class="muted small">${esc(note.at.slice(0, 10))}</span>` : ""}</div></form></details>`;
        const input = editable
          ? `<form class="fix" data-scope="${scopeKey}" data-id="${esc(v.id)}" data-field="${esc(v.flag.field)}">
              <label for="${esc(fid)}">Valeur relevée en jeu</label>
              <input id="${esc(fid)}" name="value" inputmode="decimal" placeholder="${v.flag.field === "size" ? "ex. 8x8" : `actuel : ${esc(showValue(currentValue(ctx, v)))}`}" autocomplete="off">
              <button type="submit">Appliquer</button><span class="fix-error" role="alert"></span></form>`
          : `<p class="muted vdetail">Ce champ ne se corrige pas ici (voir <code>data/overrides.json</code>).</p>`;
        return `<li class="vrow"><div class="vhead"><span class="vfield">${esc(fieldLabel(v.flag.field, (id) => itemN(ctx, id)))}</span>
            <span class="badge ${esc(v.flag.reason)}">${esc(REASON_LABEL[v.flag.reason] ?? v.flag.reason)}</span></div>
          <div class="vvals">Retenu : <b class="num">${esc(showValue(currentValue(ctx, v)))}</b>${primary ? ` selon ${sourceLink(primary)}` : ""}${alts ? ` · Autre : ${alts}` : ""}</div>
          ${detail}${input}${noteBox}</li>`;
      })
      .join("");
    return `<div class="verify-group panel${head.used ? "" : " unused"}"><h3>${title}</h3>
      <p class="vstate">${head.used ? "Utilisée dans le calcul" : opts.all ? "Pas utilisée par le dernier calcul" : "Recette écartée (elle pourrait être meilleure une fois vérifiée)"}</p>
      <ul class="vrows">${rows}</ul></div>`;
  });
  if (!blocks.length) return `<p class="muted">${opts.all ? "Aucune valeur ne correspond." : "Aucune valeur douteuse dans cette chaîne."}</p>`;
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
