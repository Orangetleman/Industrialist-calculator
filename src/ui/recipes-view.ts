// Page « Recettes » : naviguer dans les crafts comme dans l'onglet « Recipes » du jeu (S5).
// Liste avec recherche (tuiles ou lignes triables), fiche d'un objet (Sources, Utilisations),
// fiche d'une machine (ses crafts). Fonctions pures (chaînes HTML), testées sans navigateur.
//
// Images : celle choisie par le joueur, sinon la vignette du wiki, sinon une pastille de couleur
// avec les initiales (passées par `image`).
//
// Mode « ✎ Corriger » (S6) : les valeurs de la fiche deviennent des cases, chaque craft peut être
// modifié ou marqué « n'existe pas en jeu », et l'on peut ajouter un craft ou un objet manquant.

import type { GameData } from "../engine/data.ts";
import type { AddedRecipe, Correction, OverridesFile, Recipe, Source, VerifyFlag } from "../engine/types.ts";
import { colon, doubtText, energyInputText, esc, fieldLabel, fmt, fmtDuration, fmtMF, fmtMoney, fmtMoneyShort, fmtPollution, parseEnergy, parseNum } from "./format.ts";
import { t } from "../i18n/i18n.ts";
import { txt } from "./engine-text.ts";

export type EntryKind = "objet" | "machine";
export type Entry = { kind: EntryKind; id: string; name: string };
export type ListFilter = "tout" | "objets" | "machines";
export type ListView = "tuiles" | "lignes";
export type SortKey = "nom" | "valeur" | "rp";
export type SortDir = "asc" | "desc";
export type ListSort = { key: SortKey; dir: SortDir };

/**
 * Image d'un objet ou d'une machine : `own` = choisie par le joueur (`fallback` : le wiki en a une
 * dessous) ; `credit` = source à citer (vignette du wiki).
 */
export type Picture = { src: string; own: boolean; fallback?: boolean; credit?: { label: string; url: string } };

export type RecipesCtx = {
  data: GameData;
  image?: (kind: EntryKind, id: string) => Picture | null;
  /** Nom de la recherche qui manque pour ce craft, ou null s'il est disponible (progression du joueur). */
  locked?: (r: Recipe) => string | null;
  /** Mode « ✎ Corriger » de la fiche (S6) ; absent = lecture. */
  edit?: EditState | null;
  /** Corrections locales du joueur (pour « annuler ma correction », « rétablir », « effacer »). */
  mine?: OverridesFile;
  /** Craft mis en évidence sur la fiche (arrivée depuis le schéma, S7). */
  highlight?: string | null;
};

/** Ligne d'un formulaire de craft : nom de l'objet (comme en jeu) et quantité, tels que saisis. */
export type DraftLine = { item: string; qty: string };
/** Où s'ouvre le formulaire : sous les sources ou les utilisations d'un objet, ou les crafts d'une machine. */
export type DraftAt = "sources" | "uses" | "crafts";
/**
 * Formulaire « ajouter un craft manquant », tel que saisi. `id` : craft ajouté qu'on modifie ;
 * `replace` : craft du wiki remplacé (retiré à l'enregistrement).
 */
export type CraftDraft = {
  at: DraftAt;
  id: string | null;
  replace: string | null;
  machine: string;
  durationS: string;
  energyMFps: string;
  inputs: DraftLine[];
  outputs: DraftLine[];
  errors: string[];
  /** Noms d'objets non reconnus (on propose de les créer). */
  unknown: string[];
};
/** Formulaire « objet manquant » ; `inDraft` : ouvert depuis le formulaire de craft. */
export type ItemDraft = { name: string; inDraft: boolean; error?: string };
export type EditState = {
  /** Craft dont on modifie les valeurs. */
  craft: string | null;
  draft: CraftDraft | null;
  newItem: ItemDraft | null;
  /** Valeur mise en avant (arrivée par un ⚠) : « recipes|id|champ », « items|id|champ », « machines|id|champ ». */
  focus: string | null;
};
export const EDIT_ON: EditState = { craft: null, draft: null, newItem: null, focus: null };

export const recipeHref = (kind: EntryKind, id: string) => `#recettes/${kind}/${encodeURIComponent(id)}`;
/** Fiche d'un objet ou d'une machine, un craft mis en évidence (lien « Voir dans Recettes » du schéma). */
export const craftHref = (kind: EntryKind, id: string, craft: string) => `${recipeHref(kind, id)}/${encodeURIComponent(craft)}`;

/** Objets, puis machines qui ont au moins un craft, triés par nom. */
export function recipeEntries(data: GameData): Entry[] {
  const used = new Set([...data.recipes.values()].map((r) => r.machine));
  const items: Entry[] = [...data.items.values()].map((i) => ({ kind: "objet", id: i.id, name: i.name }));
  const machines: Entry[] = [...data.machines.values()].filter((m) => used.has(m.id)).map((m) => ({ kind: "machine", id: m.id, name: m.name }));
  return [...items, ...machines].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Recherche sur le nom : chaque mot tapé doit y figurer ; les noms qui commencent par la saisie d'abord. */
export function searchEntries(entries: Entry[], query: string, filter: ListFilter = "tout"): Entry[] {
  const list = entries.filter((e) => filter === "tout" || (filter === "objets") === (e.kind === "objet"));
  const q = norm(query);
  if (!q) return list;
  const words = q.split(" ");
  const hits = list.filter((e) => {
    const n = norm(e.name);
    return words.every((w) => n.includes(w));
  });
  const starts = (e: Entry) => (norm(e.name).startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b));
}

/** Valeur en argent : prix de vente d'un objet, prix d'achat d'une machine. */
export function entryValue(data: GameData, e: Entry): number | null {
  return e.kind === "objet" ? (data.items.get(e.id)?.sellValue ?? null) : (data.machines.get(e.id)?.cost ?? null);
}

/** Facteur RP d'un objet (« 35× RP » en jeu) ; une plage (« 1-300 ») ne se trie pas. */
export function entryRp(data: GameData, e: Entry): number | null {
  const v = e.kind === "objet" ? data.items.get(e.id)?.researchValue : null;
  return typeof v === "number" ? v : null;
}

/** Tri de la liste ; les valeurs inconnues vont toujours à la fin. Tri stable : à égalité, l'ordre reçu. */
export function sortEntries(data: GameData, entries: Entry[], sort: ListSort): Entry[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "nom") return [...entries].sort((a, b) => sign * a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const val = sort.key === "valeur" ? (e: Entry) => entryValue(data, e) : (e: Entry) => entryRp(data, e);
  return [...entries].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return sign * (x - y) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

/** Sens par défaut d'un tri : nom de A à Z, valeur et RP du plus fort au plus faible. */
export const defaultDir = (key: SortKey): SortDir => (key === "nom" ? "asc" : "desc");

/** Initiales de la pastille : « Steel Plate » → « SP », « Crankshaft » → « Cr », « 10 Karat Gold » → « 10K ». */
export function initials(name: string): string {
  const words = name.split(/[\s\-–/()]+/).filter(Boolean);
  if (words.length >= 2) return (/^\d/.test(words[0]!) ? words[0]! : words[0]![0]!.toUpperCase()) + words[1]![0]!.toUpperCase();
  const w = words[0] ?? "?";
  return w.slice(0, 1).toUpperCase() + w.slice(1, 2).toLowerCase();
}

/** Teinte stable tirée de l'identifiant, pour que chaque objet garde sa couleur. */
export function hue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function pic(ctx: RecipesCtx, kind: EntryKind, id: string, name: string, cls = ""): string {
  const fluid = kind === "objet" && ctx.data.items.get(id)?.isFluid === true;
  const img = ctx.image?.(kind, id) ?? null;
  const c = `rc-pic${cls ? ` ${cls}` : ""}${fluid ? " fluid" : ""}${kind === "machine" ? " mach" : ""}`;
  return img
    ? `<span class="${c} img" aria-hidden="true"><img src="${esc(img.src)}" alt="" loading="lazy"></span>`
    : `<span class="${c}" style="--h:${hue(id)}" aria-hidden="true">${esc(initials(name))}</span>`;
}

/** Adresse de la zone de correction d'une valeur (Données › Valeurs à vérifier, sur cette valeur). */
export const verifyHref = (scope: "recette" | "machine", id: string, field: string) => `#donnees/verifier/${scope}/${encodeURIComponent(id)}/${encodeURIComponent(field)}`;

type Flagged = { verify: VerifyFlag[]; corrections?: Correction[] };
export type FixScope = "recipes" | "items" | "machines";

/** Valeurs corrigeables depuis la fiche (S6) ; les autres se corrigent dans « Données ». */
export function fixableHere(scope: FixScope, field: string): boolean {
  if (scope === "recipes") return field === "durationS" || field === "energyMFps" || field === "machine" || /^(inputs|outputs)\..+/.test(field);
  if (scope === "items") return field === "sellValue" || field === "researchValue";
  return field === "cost";
}

export const fixKey = (scope: FixScope, id: string, field: string) => `${scope}|${id}|${field}`;

/**
 * Marque d'une valeur : ✎ corrigée, ⚠ à vérifier. Le ⚠ ouvre le mode « Corriger » sur la valeur
 * (S6) ; une valeur qui ne se corrige pas ici mène à « Données ».
 */
function flagMark(e: Flagged, scope: FixScope, id: string, field: string): string {
  const c = e.corrections?.find((x) => x.field === field);
  if (c) {
    const before = typeof c.previous === "number" ? (field === "energyMFps" ? fmtMF(c.previous) : field === "durationS" ? `${fmt(c.previous, 2)} s` : fmt(c.previous, 3)) : String(c.previous ?? "—");
    const tip = t("rc.fixed", { src: c.source.wiki === "jeu" ? t("rc.src.game") : c.source.wiki, date: c.source.fetchedAt.slice(0, 10), before });
    return ` <span class="rc-flag rc-fixed" title="${esc(tip)}">✎<span class="sr-only"> ${esc(tip)}</span></span>`;
  }
  const f = e.verify.find((x) => x.field === field);
  if (!f) return "";
  // S29 : le doute en mots de joueur, avec ses unités (« 4 kMF/s (Miraheze) ou 3,5 kMF/s (Fandom) »).
  const d = doubtText(f);
  if (fixableHere(scope, field)) return ` <button type="button" class="rc-flag warn" data-rc-focus="${esc(fixKey(scope, id, field))}" title="${esc(t("rc.verify.title", { d }))}">⚠<span class="sr-only">${esc(t("rc.verify.sr", { d }))}</span></button>`;
  if (scope === "items") return ` <span class="rc-flag warn">⚠ <small>${esc(d)}</small></span>`;
  return ` <a class="rc-flag warn" href="${verifyHref(scope === "recipes" ? "recette" : "machine", id, field)}" title="${esc(t("rc.verify.title", { d }))}">⚠<span class="sr-only">${esc(t("rc.verify.sr", { d }))}</span></a>`;
}

/** Doute du wiki sur une valeur, montré à côté de sa case en mode correction. */
function doubt(e: Flagged, field: string): string {
  const f = e.verify.find((x) => x.field === field);
  if (!f) return "";
  const d = doubtText(f);
  const show = (x: unknown) => (typeof x === "number" ? (field === "energyMFps" ? fmtMF(x) : fmt(x, 3)) : String(x));
  const alts = f.alternatives?.length && d === txt(f.detail) ? esc(t("rc.alts", { list: f.alternatives.map((a) => show(a.value)).join(", ") })) : "";
  return `<span class="rc-doubt">⚠ ${esc(d)}${alts}</span>`;
}

/** Case d'une valeur en mode correction : enregistrée quand on la quitte ; « annuler ma correction » si elle est à moi. */
function fixInput(ctx: RecipesCtx, e: Flagged, scope: FixScope, id: string, field: string, value: number | null, label: string, unit: string, cls = ""): string {
  const key = fixKey(scope, id, field);
  const mine = !!ctx.mine?.[scope]?.[id]?.[field];
  const focus = ctx.edit?.focus === key ? " focus" : "";
  return `<label class="rc-fixl">${esc(label)} <input class="rc-edit-in${cls ? ` ${cls}` : ""}${focus}" data-rc-fix="${esc(key)}" value="${value === null ? "" : esc(String(value))}" inputmode="decimal" placeholder="${esc(t("rc.unknown.ph"))}"> ${esc(unit)}</label>${mine ? ` <button type="button" class="link small" data-rc-unfix="${esc(key)}">${t("rc.unfix")}</button>` : ""}${doubt(e, field)}`;
}

/** Pastilles des objets d'un côté du craft, séparées par « + ». */
function side(ctx: RecipesCtx, r: Recipe, which: "inputs" | "outputs"): string {
  const entries = Object.entries(r[which]);
  if (!entries.length) return `<span class="rc-none">${t("rc.nothing")}</span>`;
  return entries
    .map(([id, q]) => {
      const name = ctx.data.items.get(id)?.name ?? id;
      const qty = q === null ? "?" : `${fmt(q, 3)}×`;
      return `<span class="rc-q"><a href="${recipeHref("objet", id)}" title="${esc(`${qty} ${name}`)}">${pic(ctx, "objet", id, name, "sm")}<span class="rc-qn">${esc(name)}</span></a><b class="rc-n">${esc(qty)}${flagMark(r, "recipes", r.id, `${which}.${id}`)}</b></span>`;
    })
    .join(`<span class="rc-plus" aria-hidden="true">+</span>`);
}

function duration(s: number | null): string {
  if (s === null) return "? s";
  return s < 60 ? `${fmt(s, 2)} s` : fmtDuration(s);
}

/** Un craft sur une ligne : entrées → (durée, MF/s) → sorties (machine). En mode correction : ses actions. */
export function renderCraft(ctx: RecipesCtx, r: Recipe, showMachine = true): string {
  if (ctx.edit?.craft === r.id) return renderCraftEdit(ctx, r);
  const m = ctx.data.machines.get(r.machine);
  // La ferme d'arbres (S13) garde le craft de l'arbre : sa durée de pousse, et l'électricité d'une coupe.
  // Nom d'installation écrit par le moteur (S32) : marqué comme texte français.
  const setup = r.parts?.length && !r.farm && r.setupName ? txt(r.setupName) : null;
  const top = setup ? t("rc.perSecond") : duration(r.durationS);
  const e = r.energyMFps;
  const bottom = r.farm ? t("rc.perCut", { x: fmt(r.farm.energyPerCutMF / 1000, 0) }) : e === null ? "? MF/s" : e < 0 ? t("rc.produces", { x: fmtMF(-e) }) : e === 0 ? t("rc.noEnergy") : fmtMF(e);
  const lock = ctx.locked?.(r) ?? null;
  const mname = setup ?? m?.name ?? r.machine;
  const tag = r.added ? ` <span class="rc-tag add" title="${esc(t("rc.added.title", { date: r.added.fetchedAt.slice(0, 10) }))}">${t("rc.added")}</span>` : "";
  const acts = !ctx.edit
    ? ""
    : ctx.mine?.added?.recipes?.[r.id]
      ? `<div class="rc-acts"><button type="button" class="small" data-rc-edit-added="${esc(r.id)}">${t("rc.edit")}</button><button type="button" class="small" data-rc-del-added="${esc(r.id)}">${t("rc.delAdded")}</button></div>`
      : `<div class="rc-acts">${setup ? "" : `<button type="button" class="small" data-rc-edit="${esc(r.id)}">${t("rc.edit")}</button>`}<button type="button" class="small" data-rc-remove="${esc(r.id)}">${t("rc.remove")}</button></div>`;
  return `<li class="rc-craft${lock ? " locked" : ""}${ctx.highlight === r.id ? " on" : ""}" data-rc-craft="${esc(r.id)}">
  <div class="rc-side">${side(ctx, r, "inputs")}</div>
  <div class="rc-arrow"><span>${esc(top)}${setup ? "" : flagMark(r, "recipes", r.id, "durationS")}</span><svg viewBox="0 0 60 10" aria-hidden="true"><path d="M0 5H54M48 1l6 4-6 4"/></svg><span class="${e !== null && e < 0 ? "ok" : ""}">${esc(bottom)}${flagMark(r, "recipes", r.id, "energyMFps")}</span></div>
  <div class="rc-side">${side(ctx, r, "outputs")}</div>
  ${showMachine ? `<a class="rc-mach" href="${recipeHref("machine", r.machine)}">(${esc(mname)})</a>${flagMark(r, "recipes", r.id, "machine")}` : setup ? `<span class="rc-mach muted">(${esc(setup)})</span>` : ""}${tag}
  ${acts}
  ${lock ? `<span class="rc-lock" title="${esc(t("rc.lock.title", { r: lock }))}">${esc(t("rc.lock", { r: lock }))}</span>` : ""}
</li>`;
}

/** Machines proposées dans les formulaires (pas les bâtiments qui ne font aucun craft). */
export const craftMachines = (data: GameData) => [...data.machines.values()].filter((m) => m.kind !== "building").sort((a, b) => a.name.localeCompare(b.name, "en"));

/** Un craft dont on modifie les valeurs : quantités, durée, MF/s et machine dans des cases. */
function renderCraftEdit(ctx: RecipesCtx, r: Recipe): string {
  const foc = (f: string) => (ctx.edit?.focus === fixKey("recipes", r.id, f) ? " focus" : "");
  const q = (which: "inputs" | "outputs") => {
    const list = Object.entries(r[which]);
    if (!list.length) return `<span class="rc-none">${t("rc.nothing")}</span>`;
    return list
      .map(([id, v]) => {
        const name = ctx.data.items.get(id)?.name ?? id;
        const f = `${which}.${id}`;
        return `<span class="rc-q"><a href="${recipeHref("objet", id)}">${pic(ctx, "objet", id, name, "sm")}<span class="rc-qn">${esc(name)}</span></a></span><input class="rc-edit-in qty${foc(f)}" data-f="${esc(f)}" value="${v === null ? "" : esc(String(v))}" inputmode="decimal" aria-label="${esc(t(which === "inputs" ? "rc.qtyIn" : "rc.qtyOut", { item: name }))}">`;
      })
      .join(`<span class="rc-plus" aria-hidden="true">+</span>`);
  };
  const doubts = r.verify.map((f) => `<span class="rc-doubt">⚠ ${esc(fieldLabel(f.field, (id) => ctx.data.items.get(id)?.name ?? id))}${colon()}${esc(doubtText(f))}</span>`).join("");
  const options = craftMachines(ctx.data)
    .map((m) => `<option value="${esc(m.id)}"${m.id === r.machine ? " selected" : ""}>${esc(m.name)}</option>`)
    .join("");
  return `<li class="rc-craft editing" data-rc-craftedit="${esc(r.id)}">
  <div class="rc-side">${q("inputs")}</div>
  <div class="rc-arrow"><span><input class="rc-edit-in qty${foc("durationS")}" data-f="durationS" value="${r.durationS === null ? "" : esc(String(r.durationS))}" inputmode="decimal" aria-label="${esc(t("rc.duration.aria"))}"> s</span><svg viewBox="0 0 60 10" aria-hidden="true"><path d="M0 5H54M48 1l6 4-6 4"/></svg><span><input class="rc-edit-in${foc("energyMFps")}" data-f="energyMFps" value="${esc(energyInputText(r.energyMFps))}" aria-label="${esc(t("rc.energy.aria"))}" title="${esc(t("rc.energy.title"))}"> MF/s</span></div>
  <div class="rc-side">${q("outputs")}</div>
  <label class="rc-mach">${t("rc.machine")} <select data-f="machine" class="rc-edit-sel${foc("machine")}">${options}</select></label>
  ${doubts}
  <p class="rc-err" data-rc-err role="alert"></p>
  <div class="rc-acts"><button type="button" class="small primary" data-rc-save="${esc(r.id)}">${t("rc.save")}</button><button type="button" class="small" data-rc-cancel>${t("rc.cancel")}</button><button type="button" class="small link" data-rc-replace="${esc(r.id)}">${t("rc.replace")}</button></div>
</li>`;
}

/** Craft « n'existe pas en jeu » : barré, avec « Rétablir » si le retrait est à moi. */
function renderRemoved(ctx: RecipesCtx, r: Recipe, source: Source, showMachine: boolean): string {
  const m = ctx.data.machines.get(r.machine);
  const mine = !!ctx.mine?.removed?.recipes?.[r.id];
  const qty = (which: "inputs" | "outputs") =>
    Object.entries(r[which])
      .map(([id, q]) => `${q === null ? "?" : fmt(q, 3)} ${ctx.data.items.get(id)?.name ?? id}`)
      .join(" + ") || t("rc.nothing");
  return `<li class="rc-craft removed" data-rc-craft="${esc(r.id)}">
  <span class="rc-strike">${esc(qty("inputs"))} → ${esc(qty("outputs"))}, ${esc(duration(r.durationS))}${showMachine ? ` (${esc(m?.name ?? r.machine)})` : ""}</span>
  <div class="rc-acts"><span class="rc-tag del">${esc(t("rc.removed.on", { date: source.fetchedAt.slice(0, 10) }))}</span>${mine ? `<button type="button" class="small" data-rc-restore="${esc(r.id)}">${t("rc.restore")}</button>` : `<span class="hint">${t("rc.removedBySite")}</span>`}</div>
</li>`;
}

/** Crafts qui donnent l'objet (sortie nette > 0) et crafts qui l'utilisent (en entrée). */
export function itemCrafts(data: GameData, id: string): { sources: Recipe[]; uses: Recipe[] } {
  const all = [...data.recipes.values()];
  const byName = (a: Recipe, b: Recipe) => (data.machines.get(a.machine)?.name ?? "").localeCompare(data.machines.get(b.machine)?.name ?? "") || a.id.localeCompare(b.id);
  return {
    sources: [...(data.producers.get(id) ?? [])].sort(byName),
    uses: all.filter((r) => Object.hasOwn(r.inputs, id)).sort(byName),
  };
}

export function machineCrafts(data: GameData, id: string): Recipe[] {
  return [...data.recipes.values()].filter((r) => r.machine === id).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

/** Crafts retirés (« n'existe pas en jeu ») d'une section : sources ou utilisations d'un objet, crafts d'une machine. */
export function removedCrafts(data: GameData, at: DraftAt, id: string): { recipe: Recipe; source: Source }[] {
  return [...data.removed.values()].filter(({ recipe: r }) => {
    if (at === "crafts") return r.machine === id;
    if (at === "uses") return Object.hasOwn(r.inputs, id);
    const out = r.outputs[id];
    return out !== undefined && (out === null || out - (r.inputs[id] ?? 0) > 0);
  });
}

/** Ce que le formulaire d'ajout reçoit d'avance : l'objet en sortie (sources), en entrée (utilisations), ou la machine. */
export type Prefill = { at: DraftAt; id: string };

function craftList(ctx: RecipesCtx, title: string, list: Recipe[], showMachine: boolean, empty: string, prefill: Prefill): string {
  const removed = removedCrafts(ctx.data, prefill.at, prefill.id);
  const draft = ctx.edit?.draft?.at === prefill.at ? ctx.edit.draft : null;
  const rows = [...list.map((r) => renderCraft(ctx, r, showMachine)), ...removed.map((x) => renderRemoved(ctx, x.recipe, x.source, showMachine)), ...(draft ? [renderDraft(ctx, draft)] : [])];
  const tag = removed.length ? ` <span class="rc-tag del">${t("rc.removedN", { n: removed.length })}</span>` : "";
  const add = ctx.edit && !draft ? `<p><button type="button" class="small" data-rc-add="${esc(`${prefill.at}|${prefill.id}`)}">${t("rc.addCraft")}</button></p>` : "";
  return `<section class="rc-sec"><h3>${esc(title)} <span class="pill">${list.length}</span>${tag}</h3>
  ${rows.length ? `<ul class="rc-crafts">${rows.join("")}</ul>` : `<p class="muted">${esc(empty)}</p>`}${add}</section>`;
}

// ---------------------------------------------------------------- ajouter un craft ou un objet (S6)

const lower = (s: string) => s.trim().toLowerCase();

/** Objet désigné par son nom en jeu (sans tenir compte de la casse) ou son identifiant. */
export function findItem(data: GameData, text: string): string | null {
  const t = lower(text);
  if (!t) return null;
  if (data.items.has(text.trim())) return text.trim();
  return [...data.items.values()].find((i) => lower(i.name) === t)?.id ?? null;
}
export function findMachine(data: GameData, text: string): string | null {
  const t = lower(text);
  if (!t) return null;
  if (data.machines.has(text.trim())) return text.trim();
  return craftMachines(data).find((m) => lower(m.name) === t)?.id ?? null;
}

/** Nombre saisi, selon la langue (parseNum) ; null si vide ou illisible. */
export function readNum(raw: string): number | null {
  const n = parseNum(raw);
  return Number.isFinite(n) ? n : null;
}

const blankLine = (): DraftLine => ({ item: "", qty: "1" });

/** Formulaire vide, avec l'objet de la fiche en sortie (sources) ou en entrée (utilisations), ou la machine. */
export function newDraft(data: GameData, p: Prefill): CraftDraft {
  const name = (id: string) => data.items.get(id)?.name ?? id;
  return {
    at: p.at,
    id: null,
    replace: null,
    machine: p.at === "crafts" ? (data.machines.get(p.id)?.name ?? p.id) : "",
    durationS: "",
    energyMFps: "",
    inputs: p.at === "uses" ? [{ item: name(p.id), qty: "1" }] : [blankLine()],
    outputs: p.at === "sources" ? [{ item: name(p.id), qty: "1" }] : [blankLine()],
    errors: [],
    unknown: [],
  };
}

/** Formulaire pré-rempli avec un craft : modifier un craft ajouté (`id`) ou en remplacer un (`replace`). */
export function draftFrom(data: GameData, r: Recipe, at: DraftAt, mode: "id" | "replace"): CraftDraft {
  const lines = (side: Record<string, number | null>) => Object.entries(side).map(([id, q]) => ({ item: data.items.get(id)?.name ?? id, qty: q === null ? "" : String(q) }));
  return {
    at,
    id: mode === "id" ? r.id : null,
    replace: mode === "replace" ? r.id : null,
    machine: data.machines.get(r.machine)?.name ?? r.machine,
    durationS: r.durationS === null ? "" : String(r.durationS),
    energyMFps: energyInputText(r.energyMFps),
    inputs: lines(r.inputs),
    outputs: lines(r.outputs),
    errors: [],
    unknown: [],
  };
}

/**
 * Lit le formulaire : un craft valide (mêmes règles que `buildGameData`), ou les erreurs et les
 * noms d'objets inconnus. Les lignes sans objet sont ignorées ; un objet présent deux fois du même
 * côté est refusé.
 */
export function parseDraft(data: GameData, d: CraftDraft): { ok: true; recipe: Omit<AddedRecipe, "source"> } | { ok: false; errors: string[]; unknown: string[] } {
  const errors: string[] = [];
  const unknown: string[] = [];
  const machine = findMachine(data, d.machine);
  if (!machine) errors.push(d.machine.trim() ? t("rc.err.machine", { m: d.machine.trim() }) : t("rc.err.pickMachine"));
  const durationS = readNum(d.durationS);
  if (durationS === null || durationS <= 0) errors.push(t("rc.err.duration"));
  const energyMFps = parseEnergy(d.energyMFps);
  if (energyMFps === null) errors.push(t("rc.err.energy"));
  const side = (lines: DraftLine[], label: string) => {
    const out: Record<string, number> = {};
    for (const l of lines) {
      if (!l.item.trim()) continue;
      const id = findItem(data, l.item);
      if (!id) {
        if (!unknown.includes(l.item.trim())) unknown.push(l.item.trim());
        continue;
      }
      const q = readNum(l.qty);
      if (q === null || q <= 0) errors.push(t("rc.err.qty", { side: label, item: l.item.trim() }));
      else if (Object.hasOwn(out, id)) errors.push(t("rc.err.twice", { side: label, item: l.item.trim() }));
      else out[id] = q;
    }
    return out;
  };
  const inputs = side(d.inputs, t("rc.inputs"));
  const outputs = side(d.outputs, t("rc.outputs"));
  for (const u of unknown) errors.push(t("rc.err.item", { item: u }));
  if (!Object.keys(outputs).length && !unknown.length) errors.push(t("rc.err.noOutput"));
  if (errors.length) return { ok: false, errors, unknown };
  return { ok: true, recipe: { machine: machine!, durationS: durationS!, energyMFps: energyMFps!, inputs, outputs } };
}

function draftLines(d: CraftDraft, which: "inputs" | "outputs"): string {
  const lines = d[which].map(
    (l, i) => `<div class="rc-line" data-side="${which}"><input class="it" name="item" list="rc-dl-items" value="${esc(l.item)}" aria-label="${esc(t(which === "inputs" ? "rc.line.in" : "rc.line.out"))}" placeholder="${esc(t("rc.line.ph"))}" autocomplete="off"><input class="qty" name="qty" value="${esc(l.qty)}" inputmode="decimal" aria-label="${esc(t("rc.qty"))}"><button type="button" class="small link" data-rc-line-del="${which}|${i}" title="${esc(t("rc.line.del"))}">✕</button></div>`,
  );
  return `<div class="rc-lines">${lines.join("")}<div class="rc-line"><button type="button" class="small" data-rc-line-add="${which}">${t(which === "inputs" ? "rc.line.addIn" : "rc.line.addOut")}</button></div></div>`;
}

/** Formulaire d'ajout (ou de modification d'un craft ajouté, ou de remplacement d'un craft). */
export function renderDraft(ctx: RecipesCtx, d: CraftDraft): string {
  const replaced = d.replace ? ctx.data.recipes.get(d.replace) : undefined;
  const title = d.id ? t("rc.draft.edit") : replaced ? esc(t("rc.draft.replace", { m: ctx.data.machines.get(replaced.machine)?.name ?? replaced.machine })) : t("rc.draft.new");
  const machines = craftMachines(ctx.data)
    .map((m) => `<option value="${esc(m.name)}"></option>`)
    .join("");
  const items = [...ctx.data.items.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((i) => `<option value="${esc(i.name)}"></option>`)
    .join("");
  const errs = d.errors.length ? `<ul class="rc-err full" role="alert">${d.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : "";
  const create = d.unknown.length && !ctx.edit?.newItem ? `<p class="full">${d.unknown.map((u) => `<button type="button" class="small" data-rc-newitem="${esc(u)}">${esc(t("rc.createItem", { item: u }))}</button>`).join(" ")}</p>` : "";
  const itemForm = ctx.edit?.newItem?.inDraft ? `<div class="full rc-subform">${renderItemForm(ctx.edit.newItem)}</div>` : "";
  return `<li class="rc-craft editing rc-draft">
  <b>${title}</b>
  <div class="rc-form" data-rc-draft>
    <label>${t("rc.machine")} <input name="machine" list="rc-dl-machines" value="${esc(d.machine)}" placeholder="${esc(t("rc.machine.ph"))}" autocomplete="off"></label>
    <label>${t("rc.durationS")} <input name="durationS" value="${esc(d.durationS)}" inputmode="decimal"></label>
    <label>${t("rc.energy.label")} <input name="energyMFps" value="${esc(d.energyMFps)}"></label>
    <div class="full"><span class="hint">${t("rc.inputs.hint")}</span>${draftLines(d, "inputs")}</div>
    <div class="full"><span class="hint">${t("rc.outputs")}</span>${draftLines(d, "outputs")}</div>
    ${errs}${create}${itemForm}
    <div class="full row"><button type="button" class="primary" data-rc-draft-save>${t(d.id ? "rc.save" : "rc.addThis")}</button> <button type="button" data-rc-draft-cancel>${t("rc.cancel")}</button> <span class="hint">${t("rc.draft.source")}</span></div>
    <datalist id="rc-dl-machines">${machines}</datalist><datalist id="rc-dl-items">${items}</datalist>
  </div>
</li>`;
}

/** Formulaire « objet manquant » : nom en jeu, fluide, prix de vente, facteur RP (vides = inconnus). */
export function renderItemForm(d: ItemDraft): string {
  return `<div class="rc-form" data-rc-itemform>
  <b class="full">${t("rc.item.title")}</b>
  <label>${t("rc.item.name")} <input name="name" value="${esc(d.name)}" maxlength="100" placeholder="${esc(t("form.item.ph"))}" autocomplete="off"></label>
  <label>${t("rc.item.fluid")} <select name="fluid"><option value="non">${t("rc.item.fluid.no")}</option><option value="oui">${t("rc.item.fluid.yes")}</option><option value="">${t("rc.item.fluid.unknown")}</option></select></label>
  <label>${t("rc.sellValue")} <input name="sellValue" inputmode="decimal" placeholder="${esc(t("rc.emptyUnknown"))}"></label>
  <label>${t("rc.rpFactor")} <input name="researchValue" inputmode="decimal" placeholder="${esc(t("rc.emptyUnknown"))}"></label>
  ${d.error ? `<p class="rc-err full" role="alert">${esc(d.error)}</p>` : ""}
  <div class="full row"><button type="button" class="primary" data-rc-item-save>${t("rc.item.add")}</button> <button type="button" data-rc-item-cancel>${t("rc.cancel")}</button></div>
</div>`;
}

/** Lit le formulaire « objet manquant » ; refuse un nom vide ou déjà pris. */
export function parseItemForm(data: GameData, f: { name: string; fluid: string; sellValue: string; researchValue: string }): { ok: true; item: { name: string; isFluid: boolean | null; sellValue: number | null; researchValue: number | null } } | { ok: false; error: string } {
  const name = f.name.trim();
  if (!name) return { ok: false, error: t("rc.item.err.name") };
  if (findItem(data, name)) return { ok: false, error: t("rc.item.err.exists", { name }) };
  const num = (raw: string, label: string) => {
    if (!raw.trim()) return { v: null as number | null };
    const n = readNum(raw);
    return n === null || n < 0 ? { err: t("rc.item.err.num", { label }) } : { v: n };
  };
  const s = num(f.sellValue, t("rc.price.sell"));
  const r = num(f.researchValue, t("rc.rp"));
  const err = ("err" in s && s.err) || ("err" in r && r.err);
  if (err) return { ok: false, error: err };
  return { ok: true, item: { name, isFluid: f.fluid === "oui" ? true : f.fluid === "non" ? false : null, sellValue: (s as { v: number | null }).v, researchValue: (r as { v: number | null }).v } };
}

function sourceLine(sources: { wiki: string; url?: string; fetchedAt: string }[], picture: Picture | null): string {
  const s = sources.find((x) => x.url) ?? sources[0];
  const label = !s ? "" : s.wiki === "miraheze" ? t("rc.src.miraheze") : s.wiki === "fandom" ? t("rc.src.fandom") : s.wiki === "jeu" ? t("rc.src.game") : s.wiki;
  const data = s ? t("rc.source", { src: s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>` : esc(label), date: esc(s.fetchedAt.slice(0, 10)) }) : "";
  const img = picture?.credit ? t("rc.image", { link: `<a href="${esc(picture.credit.url)}" target="_blank" rel="noopener">${esc(picture.credit.label)} ↗</a>` }) : picture?.own ? t("rc.image.own") : "";
  return data || img ? `<p class="hint rc-src">${data}${img}</p>` : "";
}

function tools(ctx: RecipesCtx, kind: EntryKind, id: string, picture: Picture | null): string {
  const own = picture?.own === true;
  const fix = ctx.edit ? "" : `<button type="button" class="small primary" data-rc-edit-on>${t("rc.fix")}</button>`;
  return `<div class="rc-tools"><button type="button" class="small" data-rc-img="${kind}|${esc(id)}">🖼 ${t(picture ? "rc.img.change" : "rc.img.add")}</button>${own ? `<button type="button" class="small link" data-rc-img-del="${kind}|${esc(id)}">${t(picture?.fallback ? "rc.img.wiki" : "rc.img.del")}</button>` : ""}${fix}</div>`;
}

/** Bandeau du mode correction. */
function editBar(ctx: RecipesCtx): string {
  if (!ctx.edit) return "";
  return `<div class="rc-editbar"><span>${t("rc.editbar.html")}</span><button type="button" class="small" data-rc-edit-off>${t("rc.done")}</button></div>`;
}

/** Étiquette d'un objet ajouté par le joueur, et de quoi l'effacer si l'ajout est à moi. */
function addedLine(ctx: RecipesCtx, id: string, added: Source | undefined): string {
  if (!added) return "";
  const mine = !!ctx.mine?.added?.items?.[id];
  return `<p class="rc-facts"><span class="rc-tag add">${t("rc.added")}</span> ${esc(t("rc.addedItem", { date: added.fetchedAt.slice(0, 10) }))}${mine && ctx.edit ? ` · <button type="button" class="small link" data-rc-del-item="${esc(id)}">${t("rc.delItem")}</button>` : ""}</p>`;
}

/**
 * Description d'un objet : celle du wiki (citation du jeu) ; sinon, le joueur peut recopier celle
 * du jeu (gardée comme une correction, exportable avec les autres).
 */
function itemDescription(it: { id: string; description?: string | null; corrections?: Correction[] }): string {
  const text = it.description ?? null;
  const saisie = it.corrections?.find((c) => c.field === "description");
  const form = `<details class="rs-desc-edit"><summary>${t(text ? "rc.desc.edit" : "rc.desc.copy")}</summary>
    <form class="rc-desc-form" data-rc-desc="${esc(it.id)}">
      <label for="rc-desc-${esc(it.id)}" class="sr-only">${t("rc.desc.label")}</label>
      <textarea id="rc-desc-${esc(it.id)}" name="text" rows="3" maxlength="2000" placeholder="${esc(t("rc.desc.ph"))}">${esc(text ?? "")}</textarea>
      <div class="row"><button type="submit">${t("rc.save")}</button>${saisie ? `<button type="button" class="link small" data-rc-desc-del="${esc(it.id)}">${t("rc.desc.del")}</button>` : ""}</div>
    </form></details>`;
  const shown = text ? `<p class="rc-desc">${esc(text).replace(/\n/g, "<br>")}</p>${saisie ? `<p class="hint">${esc(t("rc.desc.copied", { date: saisie.source.fetchedAt.slice(0, 10) }))}</p>` : ""}` : `<p class="rc-desc muted">${t("rc.desc.none")}</p>`;
  return `<div class="rc-descbox">${shown}${saisie || !text ? form : ""}</div>`;
}

/** Fiche d'un objet : en-tête (prix de vente, facteur RP, description), Sources, Utilisations. */
export function renderItemCard(ctx: RecipesCtx, id: string): string {
  const it = ctx.data.items.get(id);
  if (!it) return `<p class="muted">${esc(t("rc.item.unknown", { id }))}</p>`;
  const { sources, uses } = itemCrafts(ctx.data, id);
  const rp = it.researchValue === null ? t("rc.rp.unknown") : typeof it.researchValue === "number" ? `${fmt(it.researchValue, 2)}× RP` : `${it.researchValue}× RP`;
  const picture = ctx.image?.("objet", id) ?? null;
  const rv = typeof it.researchValue === "number" ? it.researchValue : null;
  const values = ctx.edit
    ? `<p class="rc-price num">${fixInput(ctx, it, "items", id, "sellValue", it.sellValue, t("rc.price.sell"), "$")}</p>
      <p class="rc-rp num">${fixInput(ctx, it, "items", id, "researchValue", rv, t("rc.rp"), "×", "qty")}${typeof it.researchValue === "string" ? ` <small class="muted">${esc(t("rc.wiki", { v: it.researchValue }))}</small>` : ""}</p>
      <p class="hint">${t("rc.saveHint")}</p>`
    : `<p class="rc-price num">${it.sellValue === null ? t("rc.price.unknown") : esc(fmtMoney(it.sellValue))}${flagMark(it, "items", id, "sellValue")}</p>
      <p class="rc-rp num">${esc(rp)}${flagMark(it, "items", id, "researchValue")}</p>`;
  return `<article class="rc-card${ctx.edit ? " editing" : ""}" aria-labelledby="rc-title">
  ${editBar(ctx)}
  <header class="rc-head">
    ${pic(ctx, "objet", id, it.name, "lg")}
    <div class="rc-id">
      <p class="eyebrow">${t("rc.kind.item")}${it.isFluid ? t("rc.fluid") : ""}</p>
      <h2 id="rc-title">${esc(it.name)}</h2>
      ${values}
      ${addedLine(ctx, id, it.added)}
    </div>
    ${tools(ctx, "objet", id, picture)}
  </header>
  ${itemDescription(it)}
  ${craftList(ctx, t("rc.sources"), sources, true, t("rc.sources.none"), { at: "sources", id })}
  ${craftList(ctx, t("rc.uses"), uses, true, t("rc.uses.none"), { at: "uses", id })}
  ${sourceLine(it.sources, picture)}
</article>`;
}

/** Champs de machine montrés dans l'en-tête (les autres valeurs à vérifier sont listées dessous). */
const MACHINE_SHOWN = new Set(["cost", "tier", "size", "pollutionPerHour", "page"]);

/** Fiche d'une machine : en-tête (prix d'achat, description), tous ses crafts. */
export function renderMachineCard(ctx: RecipesCtx, id: string): string {
  const m = ctx.data.machines.get(id);
  if (!m) return `<p class="muted">${esc(t("rc.machine.unknown", { id }))}</p>`;
  const crafts = machineCrafts(ctx.data, id);
  const node = m.unlockedBy ? ctx.data.nodes.get(m.unlockedBy) : null;
  const facts = [
    m.tier !== null ? `Tier ${["", "I", "II", "III", "IV", "V", "VI"][m.tier] ?? m.tier}${flagMark(m, "machines", id, "tier")}` : "",
    m.size ? `${t("rc.size", { w: m.size.w, l: m.size.l })}${flagMark(m, "machines", id, "size")}` : "",
    m.pollutionPerHour !== null ? `${esc(t("rc.pollution", { x: fmtPollution(m.pollutionPerHour) }))}${flagMark(m, "machines", id, "pollutionPerHour")}` : "",
    node ? t("rc.unlockedBy.html", { node: esc(node.name) }) : "",
  ].filter(Boolean);
  const others = m.verify.filter((f) => !MACHINE_SHOWN.has(f.field));
  const picture = ctx.image?.("machine", id) ?? null;
  const price = ctx.edit
    ? `<p class="rc-price num">${fixInput(ctx, m, "machines", id, "cost", m.cost, t("rc.price.buy"), "$")}</p>`
    : `<p class="rc-price num">${m.cost === null ? t("rc.price.unknown") : esc(fmtMoney(m.cost))}${flagMark(m, "machines", id, "cost")}</p>`;
  return `<article class="rc-card${ctx.edit ? " editing" : ""}" aria-labelledby="rc-title">
  ${editBar(ctx)}
  <header class="rc-head">
    ${pic(ctx, "machine", id, m.name, "lg")}
    <div class="rc-id">
      <p class="eyebrow">${t("rc.kind.machine")}${m.category ? ` · ${esc(m.category)}` : ""}</p>
      <h2 id="rc-title">${esc(m.name)}</h2>
      ${price}
      ${facts.length ? `<p class="rc-facts">${facts.join(" · ")}</p>` : ""}
      ${others.length ? `<p class="rc-facts">${t("rc.alsoVerify", { list: others.map((f) => `<a class="rc-flag warn" href="${verifyHref("machine", id, f.field)}" title="${esc(txt(f.detail))}">⚠ ${esc(fieldLabel(f.field, (x) => ctx.data.items.get(x)?.name ?? x))}</a>`).join(", ") })}</p>` : ""}
      ${ctx.edit ? `<p class="hint">${t("rc.machine.hint.html", { id: encodeURIComponent(id) })}</p>` : ""}
    </div>
    ${tools(ctx, "machine", id, picture)}
  </header>
  <p class="rc-desc${m.description ? "" : " muted"}">${m.description ? esc(m.description).replace(/\n/g, "<br>") : t("rc.desc.none")}</p>
  ${craftList(ctx, t("rc.crafts"), crafts, false, t("rc.crafts.none"), { at: "crafts", id })}
  <p class="hint">${t("rc.ports.html", { id: encodeURIComponent(id) })}</p>
  ${sourceLine(m.sources, picture)}
</article>`;
}

const hasWarn = (ctx: RecipesCtx, e: Entry) => (e.kind === "objet" ? ctx.data.items.get(e.id) : ctx.data.machines.get(e.id))?.verify.some((f) => f.field !== "page") === true;

/** Une tuile de la liste (pastille et nom), avec ⚠ si une valeur de sa fiche est à vérifier. */
function tile(ctx: RecipesCtx, e: Entry, current: string | null): string {
  const added = e.kind === "objet" && ctx.data.items.get(e.id)?.added ? `<span class="rc-tag add rc-tile-tag">${t("rc.added")}</span>` : "";
  const warn = (hasWarn(ctx, e) ? `<span class="rc-flag warn" title="${esc(t("rc.tile.warn"))}">⚠</span>` : "") + added;
  const on = current === `${e.kind}/${e.id}`;
  return `<li><a class="rc-tile${on ? " on" : ""}" href="${recipeHref(e.kind, e.id)}"${on ? ` aria-current="page"` : ""}>${pic(ctx, e.kind, e.id, e.name)}<span class="rc-name">${esc(e.name)}</span>${warn}</a></li>`;
}

const empty = () => `<p class="muted rc-empty">${t("rc.empty")}</p>`;

export function renderEntryList(ctx: RecipesCtx, entries: Entry[], current: string | null): string {
  if (!entries.length) return empty();
  return `<ul class="rc-grid">${entries.map((e) => tile(ctx, e, current)).join("")}</ul>`;
}

/** Affichage en lignes : nom, valeur (vente ou achat) et facteur RP, triables par l'en-tête. */
export function renderEntryRows(ctx: RecipesCtx, entries: Entry[], current: string | null, sort: ListSort): string {
  if (!entries.length) return empty();
  const th = (k: SortKey, cls: string) => {
    const on = sort.key === k;
    const arrow = on ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
    return `<th class="${cls}" aria-sort="${on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}"><button type="button" class="link" data-rc-sort="${k}" title="${esc(t(`rc.sort.${k}.help`))}">${t(`rc.sort.${k}`)}${arrow}</button></th>`;
  };
  const rows = entries
    .map((e) => {
      const on = current === `${e.kind}/${e.id}`;
      const v = entryValue(ctx.data, e);
      const rv = e.kind === "objet" ? ctx.data.items.get(e.id)?.researchValue : null;
      const href = recipeHref(e.kind, e.id);
      const warn = hasWarn(ctx, e) ? ` <span class="rc-flag warn" title="${esc(t("rc.tile.warn"))}">⚠</span>` : "";
      return `<tr class="${on ? "on" : ""}"><td class="rc-rname"><a href="${href}"${on ? ` aria-current="page"` : ""}>${pic(ctx, e.kind, e.id, e.name, "xs")}<span>${esc(e.name)}</span></a>${warn}</td>
<td class="num"${v === null ? "" : ` title="${esc(`${fmtMoney(v)}${t(e.kind === "machine" ? "rc.buyPrice" : "rc.sellPrice")}`)}"`}>${v === null ? "—" : esc(fmtMoneyShort(v))}${e.kind === "machine" ? ` <small class="muted">${t("rc.buy")}</small>` : ""}</td>
<td class="num">${rv === null || rv === undefined ? "—" : esc(typeof rv === "number" ? `${fmt(rv, 2)}×` : `${rv}×`)}</td></tr>`;
    })
    .join("");
  return `<table class="rc-rows"><thead><tr>${th("nom", "")}${th("valeur", "num")}${th("rp", "num")}</tr></thead><tbody>${rows}</tbody></table>`;
}
