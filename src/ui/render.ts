// Rendu HTML commun : noms, recettes, sources, boutons de progression, panneau « à vérifier ».
// Fonctions pures (chaînes), sans accès au DOM. La vue d'un plan est dans plan-view.ts.

import type { GameData } from "../engine/data.ts";
import { ENERGY, POLLUTION } from "../engine/resources.ts";
import type { Plan, Step, Unresolved, VerifyEntry } from "../engine/solve.ts";
import type { OverridesFile, Recipe, Source } from "../engine/types.ts";
import { colon, esc, fieldLabel, fmt, fmtMF, fmtRP, isEditableField, reasonLabel } from "./format.ts";
import { t, type Key } from "../i18n/i18n.ts";
import { noteKey, type Notes, type Settings } from "./state.ts";
import { txtHtml } from "./engine-text.ts";

export type Ctx = { data: GameData; plan: Plan; settings: Settings; corrections: OverridesFile };

export const itemN = (ctx: Pick<Ctx, "data">, id: string) => (id === ENERGY ? t("common.energy") : id === POLLUTION ? t("rd.pollution") : (ctx.data.items.get(id)?.name ?? id));
export const machineN = (ctx: Pick<Ctx, "data">, id: string) => ctx.data.machines.get(id)?.name ?? id;
export const nodeN = (ctx: Pick<Ctx, "data">, id: string) => ctx.data.nodes.get(id)?.name ?? id;

export function recipeText(ctx: Ctx, r: Recipe, durationS?: number): string {
  const side = (o: Record<string, number | null>) =>
    Object.entries(o)
      .map(([k, v]) => `${v === null ? "?" : fmt(v, 3)}× ${itemN(ctx, k)}`)
      .join(" + ");
  const ins = side(r.inputs);
  const d = durationS ?? r.durationS;
  return `${ins ? `${ins} → ` : "→ "}${side(r.outputs)} · ${d === null ? t("rd.duration.unknown") : `${fmt(d, 2)} s`}`;
}

export function sourceLink(s: Source | undefined): string {
  if (!s) return "—";
  const label = { miraheze: "Miraheze", fandom: "Fandom", desmos: "Desmos", jeu: t("rd.src.jeu"), saisie: t("rd.src.saisie") }[s.wiki];
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
      const flag = st && st !== "ok" && st !== "forcée" ? ` — ${t(`cand.${st}`)}` : r.verify.length ? " — ⚠" : "";
      const label = `${machineN(ctx, r.machine)} · ${recipeText(ctx, r)}${flag}${r.id === current && !forced ? t("rd.chosen") : ""}`;
      return `<option value="${esc(r.id)}"${r.id === forced ? " selected" : ""}>${esc(label)}</option>`;
    })
    .join("");
  return `<label class="force"><span class="sr-only">${esc(t("rd.recipeFor", { item: itemN(ctx, item) }))}</span>
    <select data-force="${esc(item)}"><option value=""${forced ? "" : " selected"}>${t("rd.auto")}</option>${opts}</select></label>`;
}

/** Boutons qui mettent à jour la progression depuis le plan (gérés par main.ts). */
export function unlockButton(nodes: string[], label: string): string {
  return nodes.length ? `<button type="button" class="link" data-unlock="${esc(nodes.join(","))}">${esc(label)}</button>` : "";
}
export function ownButton(machines: string[]): string {
  return machines.length ? `<button type="button" class="link" data-own="${esc(machines.join(","))}">${t("rd.own")}</button>` : "";
}
export function accessButton(a: Step["access"]): string {
  if (a.available) return "";
  return a.needsOwnership ? ownButton([a.machine]) : unlockButton(a.missingNodes, t("rd.unlocked"));
}

export function lockText(ctx: Ctx, a: Step["access"]): string {
  if (a.available) return "";
  if (a.needsOwnership) return t("rd.mustOwn", { m: machineN(ctx, a.machine) });
  const sell = a.reqItems.length ? t("rd.missing.sell", { list: a.reqItems.map((r) => `${r.amount} ${itemN(ctx, r.item)}`).join(", ") }) : "";
  return t("rd.missing", { m: machineN(ctx, a.machine), list: a.missingNodes.map((n) => nodeN(ctx, n)).join(" → "), rp: fmtRP(a.rpCost), sell });
}

const LEAVES = ["verrouillé", "aucune recette", "seulement à vérifier", "incalculable", "boucle", "machine écartée"];
/** Pourquoi un objet n'est pas produit (motif du moteur), en phrase de joueur. */
export const leafText = (reason: string): string => (LEAVES.includes(reason) ? t(`leaf.${reason}` as Key) : reason);

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

/** Valeur lisible ; l'énergie avec son préfixe comme ailleurs (« 4 kMF/s », S29). */
function showValue(v: unknown, field = ""): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return field === "energyMFps" ? fmtMF(v) : fmt(v, 4);
  if (typeof v === "object" && v && "w" in v && "l" in v) return `${(v as { w: number }).w}×${(v as { l: number }).l}`;
  if (Array.isArray(v)) return v.map((x) => showValue(x, field)).join(" – ");
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
    const title = esc(isRecipe ? t("vf.craft", { m: machineN(ctx, (entity as Recipe | undefined)?.machine ?? ""), item: itemN(ctx, head.item) }) : t("vf.machine", { m: machineN(ctx, head.id) }));
    const primary = entity?.sources[0];
    const rows = list
      .map((v) => {
        const editable = isEditableField(head.scope, v.flag.field);
        const scopeKey = isRecipe ? "recipes" : "machines";
        const fid = `fix-${v.id}-${v.flag.field}`;
        const alts = (v.flag.alternatives ?? []).map((a) => `<b class="num">${esc(showValue(a.value, v.flag.field))}</b> ${t("vf.according", { src: sourceLink(a.source) })}`).join(" ; ");
        // Pour une contradiction, le détail répète les valeurs : on le remplace par « retenu / autre ».
        const detail = v.flag.reason === "contradiction" && alts ? "" : `<div class="vdetail">${txtHtml(v.flag.detail)}</div>`;
        const nk = noteKey(scopeKey, v.id, v.flag.field);
        const note = notes[nk];
        const noteBox = `<details class="vnote"${note ? " open" : ""}><summary>${t(note ? "vf.note.mine" : "vf.note.leave")}</summary>
            <form class="note-form" data-note="${esc(nk)}"><label class="sr-only" for="note-${esc(nk)}">${t("vf.note")}</label>
            <textarea id="note-${esc(nk)}" name="note" rows="2" maxlength="1000" placeholder="${esc(t("vf.note.ph"))}">${esc(note?.text ?? "")}</textarea>
            <div class="row"><button type="submit">${t("vf.note.save")}</button>${note ? `<button type="button" class="link" data-note-del="${esc(nk)}">${t("vf.note.del")}</button> <span class="muted small">${esc(note.at.slice(0, 10))}</span>` : ""}</div></form></details>`;
        const input = editable
          ? `<form class="fix" data-scope="${scopeKey}" data-id="${esc(v.id)}" data-field="${esc(v.flag.field)}">
              <label for="${esc(fid)}">${t("vf.value")}</label>
              <input id="${esc(fid)}" name="value" inputmode="decimal" placeholder="${esc(v.flag.field === "size" ? t("vf.ph.size") : v.flag.field === "energyMFps" ? t("vf.ph.energy", { x: showValue(currentValue(ctx, v), v.flag.field) }) : t("vf.ph.current", { x: showValue(currentValue(ctx, v)) }))}" autocomplete="off">
              <button type="submit">${t("vf.apply")}</button><span class="fix-error" role="alert"></span></form>`
          : `<p class="muted vdetail">${t("vf.noFix")}</p>`;
        return `<li class="vrow"><div class="vhead"><span class="vfield">${esc(fieldLabel(v.flag.field, (id) => itemN(ctx, id)))}</span>
            <span class="badge ${esc(v.flag.reason)}">${esc(reasonLabel(v.flag.reason))}</span></div>
          <div class="vvals">${t("vf.kept", { x: `<b class="num">${esc(showValue(currentValue(ctx, v), v.flag.field))}</b>` })}${primary ? ` ${t("vf.according", { src: sourceLink(primary) })}` : ""}${alts ? t("vf.other", { list: alts }) : ""}</div>
          ${detail}${input}${noteBox}</li>`;
      })
      .join("");
    return `<div class="verify-group panel${head.used ? "" : " unused"}"><h3>${title}</h3>
      <p class="vstate">${t(head.used ? "vf.used" : opts.all ? "vf.unusedAll" : "vf.unused")}</p>
      <ul class="vrows">${rows}</ul></div>`;
  });
  if (!blocks.length) return `<p class="muted">${t(opts.all ? "vf.none.all" : "vf.none")}</p>`;
  return blocks.join("");
}

export function renderCorrections(ctx: Ctx): string {
  const rows: string[] = [];
  // S29 : ce qui est corrigé, en noms du jeu (plus « recipes/blast_furnace_09 »).
  const what = (scope: "recipes" | "machines" | "items" | "research", id: string) => {
    if (scope === "recipes") {
      const r = ctx.data.recipes.get(id);
      return r ? t("vf.craft", { m: machineN(ctx, r.machine), item: Object.keys(r.outputs).map((i) => itemN(ctx, i)).join(", ") }) : t("cor.craftGone");
    }
    return scope === "machines" ? t("vf.machine", { m: machineN(ctx, id) }) : scope === "items" ? t("cor.item", { item: itemN(ctx, id) }) : t("cor.research", { r: nodeN(ctx, id) });
  };
  for (const scope of ["recipes", "machines", "items", "research"] as const) {
    for (const [id, fields] of Object.entries(ctx.corrections[scope] ?? {})) {
      for (const [field, entry] of Object.entries(fields)) {
        rows.push(`<li>${esc(what(scope, id))} · ${esc(fieldLabel(field, (x) => itemN(ctx, x)))} = <b>${esc(field === "machine" && typeof entry.value === "string" ? machineN(ctx, entry.value) : showValue(entry.value, field))}</b> <span class="muted">(${esc(entry.source.fetchedAt.slice(0, 10))})</span>
          <button type="button" class="link" data-remove="${esc(scope)}|${esc(id)}|${esc(field)}">${t("cor.remove")}</button></li>`);
      }
    }
  }
  // Crafts et objets ajoutés, crafts retirés (page Recettes, S6).
  const craft = (r: { machine: string; inputs: Record<string, number | null>; outputs: Record<string, number | null> }) => {
    const side = (s: Record<string, number | null>) => Object.entries(s).map(([i, q]) => `${q === null ? "?" : fmt(q, 3)} ${itemN(ctx, i)}`).join(" + ") || t("rc.nothing");
    return `${machineN(ctx, r.machine)}${colon()}${side(r.inputs)} → ${side(r.outputs)}`;
  };
  const day = (s: Source) => esc(s.fetchedAt.slice(0, 10));
  const card = (kind: "objet" | "machine", id: string) => `<a href="#recettes/${kind}/${encodeURIComponent(id)}">${t("cor.card")}</a>`;
  for (const [id, it] of Object.entries(ctx.corrections.added?.items ?? {})) {
    rows.push(`<li><span class="rc-tag add">${t("cor.itemAdded")}</span> ${esc(it.name)} <span class="muted">(${day(it.source)})</span> ${card("objet", id)} · <button type="button" class="link" data-remove="added|items|${esc(id)}">${t("vf.note.del")}</button></li>`);
  }
  for (const [id, r] of Object.entries(ctx.corrections.added?.recipes ?? {})) {
    const first = Object.keys(r.outputs)[0];
    rows.push(`<li><span class="rc-tag add">${t("cor.craftAdded")}</span> ${esc(craft(r))} <span class="muted">(${day(r.source)})</span>${first ? ` ${card("objet", first)}` : ""} · <button type="button" class="link" data-remove="added|recipes|${esc(id)}">${t("vf.note.del")}</button></li>`);
  }
  for (const [id, x] of Object.entries(ctx.corrections.removed?.recipes ?? {})) {
    const r = ctx.data.removed.get(id)?.recipe;
    rows.push(`<li><span class="rc-tag del">${t("cor.craftRemoved")}</span> ${esc(r ? craft(r) : id)} <span class="muted">(${day(x.source)})</span>${r ? ` ${card("machine", r.machine)}` : ""} · <button type="button" class="link" data-remove="removed|recipes|${esc(id)}">${t("cor.restore")}</button></li>`);
  }
  return rows.length ? `<ul class="corrections">${rows.join("")}</ul>` : `<p class="muted">${t("cor.none")}</p>`;
}
