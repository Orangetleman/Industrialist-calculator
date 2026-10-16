// Page « Recettes » : naviguer dans les crafts comme dans l'onglet « Recipes » du jeu (S5).
// Liste avec recherche (tuiles ou lignes triables), fiche d'un objet (Sources, Utilisations),
// fiche d'une machine (ses crafts). Fonctions pures (chaînes HTML), testées sans navigateur.
//
// Images : celle choisie par le joueur, sinon la vignette du wiki, sinon une pastille de couleur
// avec les initiales (passées par `image`).

import type { GameData } from "../engine/data.ts";
import type { Correction, Recipe, VerifyFlag } from "../engine/types.ts";
import { esc, fmt, fmtDuration, fmtMF, fmtMoney, fmtMoneyShort, fmtPollution } from "./format.ts";

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
};

export const recipeHref = (kind: EntryKind, id: string) => `#recettes/${kind}/${encodeURIComponent(id)}`;

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
/** Valeur à vérifier ou corrigée d'une recette ou d'une machine : la correction se fait dans « Données ». */
type FlagTarget = { scope: "recette" | "machine"; id: string } | null;

/**
 * Marque d'une valeur : ✎ corrigée, ⚠ à vérifier. Le ⚠ d'une recette ou d'une machine mène à sa
 * zone de correction ; celui d'un objet (rien à corriger dans « Données ») montre son détail.
 */
function flagMark(e: Flagged, field: string, target: FlagTarget): string {
  const c = e.corrections?.find((x) => x.field === field);
  if (c) {
    const t = `Corrigée (${c.source.wiki === "jeu" ? "relevé en jeu" : c.source.wiki}, ${c.source.fetchedAt.slice(0, 10)}) ; avant : ${String(c.previous ?? "—")}`;
    return ` <span class="rc-flag rc-fixed" title="${esc(t)}">✎<span class="sr-only"> ${esc(t)}</span></span>`;
  }
  const f = e.verify.find((x) => x.field === field);
  if (!f) return "";
  if (!target) return ` <span class="rc-flag warn">⚠ <small>${esc(f.detail)}</small></span>`;
  return ` <a class="rc-flag warn" href="${verifyHref(target.scope, target.id, field)}" title="${esc(`À vérifier : ${f.detail} — cliquer pour corriger`)}">⚠<span class="sr-only"> à vérifier : ${esc(f.detail)}, corriger</span></a>`;
}

/** Pastilles des objets d'un côté du craft, séparées par « + ». */
function side(ctx: RecipesCtx, r: Recipe, which: "inputs" | "outputs"): string {
  const entries = Object.entries(r[which]);
  if (!entries.length) return `<span class="rc-none">rien</span>`;
  const target: FlagTarget = { scope: "recette", id: r.id };
  return entries
    .map(([id, q]) => {
      const name = ctx.data.items.get(id)?.name ?? id;
      const qty = q === null ? "?" : `${fmt(q, 3)}×`;
      return `<span class="rc-q"><a href="${recipeHref("objet", id)}" title="${esc(`${qty} ${name}`)}">${pic(ctx, "objet", id, name, "sm")}<span class="rc-qn">${esc(name)}</span></a><b class="rc-n">${esc(qty)}${flagMark(r, `${which}.${id}`, target)}</b></span>`;
    })
    .join(`<span class="rc-plus" aria-hidden="true">+</span>`);
}

function duration(s: number | null): string {
  if (s === null) return "? s";
  return s < 60 ? `${fmt(s, 2)} s` : fmtDuration(s);
}

/** Un craft sur une ligne : entrées → (durée, MF/s) → sorties (machine). */
export function renderCraft(ctx: RecipesCtx, r: Recipe, showMachine = true): string {
  const m = ctx.data.machines.get(r.machine);
  const setup = r.parts?.length ? (r.setupName ?? null) : null;
  const top = setup ? "par seconde" : duration(r.durationS);
  const e = r.energyMFps;
  const bottom = e === null ? "? MF/s" : e < 0 ? `produit ${fmtMF(-e)}` : e === 0 ? "sans énergie" : fmtMF(e);
  const lock = ctx.locked?.(r) ?? null;
  const mname = setup ?? m?.name ?? r.machine;
  const target: FlagTarget = { scope: "recette", id: r.id };
  return `<li class="rc-craft${lock ? " locked" : ""}">
  <div class="rc-side">${side(ctx, r, "inputs")}</div>
  <div class="rc-arrow"><span>${esc(top)}${setup ? "" : flagMark(r, "durationS", target)}</span><svg viewBox="0 0 60 10" aria-hidden="true"><path d="M0 5H54M48 1l6 4-6 4"/></svg><span class="${e !== null && e < 0 ? "ok" : ""}">${esc(bottom)}${flagMark(r, "energyMFps", target)}</span></div>
  <div class="rc-side">${side(ctx, r, "outputs")}</div>
  ${showMachine ? `<a class="rc-mach" href="${recipeHref("machine", r.machine)}">(${esc(mname)})</a>` : setup ? `<span class="rc-mach muted">(${esc(setup)})</span>` : ""}
  ${lock ? `<span class="rc-lock" title="${esc(`Recherche à débloquer : ${lock}`)}">🔒 pas encore débloqué : ${esc(lock)}</span>` : ""}
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

function craftList(ctx: RecipesCtx, title: string, list: Recipe[], showMachine: boolean, empty: string): string {
  return `<section class="rc-sec"><h3>${esc(title)} <span class="pill">${list.length}</span></h3>
  ${list.length ? `<ul class="rc-crafts">${list.map((r) => renderCraft(ctx, r, showMachine)).join("")}</ul>` : `<p class="muted">${esc(empty)}</p>`}</section>`;
}

function sourceLine(sources: { wiki: string; url?: string; fetchedAt: string }[], picture: Picture | null): string {
  const s = sources.find((x) => x.url) ?? sources[0];
  const label = !s ? "" : s.wiki === "miraheze" ? "wiki Miraheze" : s.wiki === "fandom" ? "wiki Fandom" : s.wiki === "jeu" ? "relevé en jeu" : s.wiki;
  const data = s ? `Source : ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>` : esc(label)}, relevé le ${esc(s.fetchedAt.slice(0, 10))}.` : "";
  const img = picture?.credit ? ` Image : <a href="${esc(picture.credit.url)}" target="_blank" rel="noopener">${esc(picture.credit.label)} ↗</a>.` : picture?.own ? " Image choisie par toi." : "";
  return data || img ? `<p class="hint rc-src">${data}${img}</p>` : "";
}

function tools(kind: EntryKind, id: string, picture: Picture | null): string {
  const own = picture?.own === true;
  return `<div class="rc-tools"><button type="button" class="small" data-rc-img="${kind}|${esc(id)}">🖼 ${picture ? "Changer l'image" : "Ajouter une image"}</button>${own ? `<button type="button" class="small link" data-rc-img-del="${kind}|${esc(id)}">${picture?.fallback ? "revenir à celle du wiki" : "retirer"}</button>` : ""}</div>`;
}

/**
 * Description d'un objet : celle du wiki (citation du jeu) ; sinon, le joueur peut recopier celle
 * du jeu (gardée comme une correction, exportable avec les autres).
 */
function itemDescription(it: { id: string; description?: string | null; corrections?: Correction[] }): string {
  const text = it.description ?? null;
  const saisie = it.corrections?.find((c) => c.field === "description");
  const form = `<details class="rs-desc-edit"><summary>${text ? "Modifier la description" : "Recopier la description du jeu"}</summary>
    <form class="rc-desc-form" data-rc-desc="${esc(it.id)}">
      <label for="rc-desc-${esc(it.id)}" class="sr-only">Description affichée en jeu</label>
      <textarea id="rc-desc-${esc(it.id)}" name="text" rows="3" maxlength="2000" placeholder="Texte affiché sous le nom en jeu (« No Description. » : laisser vide)">${esc(text ?? "")}</textarea>
      <div class="row"><button type="submit">Enregistrer</button>${saisie ? `<button type="button" class="link small" data-rc-desc-del="${esc(it.id)}">effacer ma saisie</button>` : ""}</div>
    </form></details>`;
  const shown = text ? `<p class="rc-desc">${esc(text).replace(/\n/g, "<br>")}</p>${saisie ? `<p class="hint">Recopiée du jeu le ${esc(saisie.source.fetchedAt.slice(0, 10))}.</p>` : ""}` : `<p class="rc-desc muted">Pas de description.</p>`;
  return `<div class="rc-descbox">${shown}${saisie || !text ? form : ""}</div>`;
}

/** Fiche d'un objet : en-tête (prix de vente, facteur RP, description), Sources, Utilisations. */
export function renderItemCard(ctx: RecipesCtx, id: string): string {
  const it = ctx.data.items.get(id);
  if (!it) return `<p class="muted">Objet inconnu : ${esc(id)}.</p>`;
  const { sources, uses } = itemCrafts(ctx.data, id);
  const rp = it.researchValue === null ? "facteur RP inconnu" : typeof it.researchValue === "number" ? `${fmt(it.researchValue, 2)}× RP` : `${it.researchValue}× RP`;
  const picture = ctx.image?.("objet", id) ?? null;
  return `<article class="rc-card" aria-labelledby="rc-title">
  <header class="rc-head">
    ${pic(ctx, "objet", id, it.name, "lg")}
    <div class="rc-id">
      <p class="eyebrow">Objet${it.isFluid ? " · fluide" : ""}</p>
      <h2 id="rc-title">${esc(it.name)}</h2>
      <p class="rc-price num">${it.sellValue === null ? "prix inconnu" : esc(fmtMoney(it.sellValue))}${flagMark(it, "sellValue", null)}</p>
      <p class="rc-rp num">${esc(rp)}${flagMark(it, "researchValue", null)}</p>
    </div>
    ${tools("objet", id, picture)}
  </header>
  ${itemDescription(it)}
  ${craftList(ctx, "Sources", sources, true, "Aucun craft ne donne cet objet (matière première, ou craft absent des wikis).")}
  ${craftList(ctx, "Utilisations", uses, true, "Aucun craft ne l'utilise : il se vend ou sert à la recherche.")}
  ${sourceLine(it.sources, picture)}
</article>`;
}

/** Champs de machine montrés dans l'en-tête (les autres valeurs à vérifier sont listées dessous). */
const MACHINE_SHOWN = new Set(["cost", "tier", "size", "pollutionPerHour", "page"]);

/** Fiche d'une machine : en-tête (prix d'achat, description), tous ses crafts. */
export function renderMachineCard(ctx: RecipesCtx, id: string): string {
  const m = ctx.data.machines.get(id);
  if (!m) return `<p class="muted">Machine inconnue : ${esc(id)}.</p>`;
  const crafts = machineCrafts(ctx.data, id);
  const node = m.unlockedBy ? ctx.data.nodes.get(m.unlockedBy) : null;
  const target: FlagTarget = { scope: "machine", id };
  const facts = [
    m.tier !== null ? `Tier ${["", "I", "II", "III", "IV", "V", "VI"][m.tier] ?? m.tier}${flagMark(m, "tier", target)}` : "",
    m.size ? `${m.size.w} × ${m.size.l} cases${flagMark(m, "size", target)}` : "",
    m.pollutionPerHour !== null ? `pollution ${esc(fmtPollution(m.pollutionPerHour))}${flagMark(m, "pollutionPerHour", target)}` : "",
    node ? `débloquée par <i>${esc(node.name)}</i>` : "",
  ].filter(Boolean);
  const others = m.verify.filter((f) => !MACHINE_SHOWN.has(f.field));
  const picture = ctx.image?.("machine", id) ?? null;
  return `<article class="rc-card" aria-labelledby="rc-title">
  <header class="rc-head">
    ${pic(ctx, "machine", id, m.name, "lg")}
    <div class="rc-id">
      <p class="eyebrow">Machine${m.category ? ` · ${esc(m.category)}` : ""}</p>
      <h2 id="rc-title">${esc(m.name)}</h2>
      <p class="rc-price num">${m.cost === null ? "prix inconnu" : esc(fmtMoney(m.cost))}${flagMark(m, "cost", target)}</p>
      ${facts.length ? `<p class="rc-facts">${facts.join(" · ")}</p>` : ""}
      ${others.length ? `<p class="rc-facts">Aussi à vérifier : ${others.map((f) => `<a class="rc-flag warn" href="${verifyHref("machine", id, f.field)}" title="${esc(f.detail)}">⚠ ${esc(f.field)}</a>`).join(", ")}</p>` : ""}
    </div>
    ${tools("machine", id, picture)}
  </header>
  <p class="rc-desc${m.description ? "" : " muted"}">${m.description ? esc(m.description).replace(/\n/g, "<br>") : "Pas de description."}</p>
  ${craftList(ctx, "Crafts", crafts, false, "Aucun craft connu pour cette machine.")}
  <p class="hint">Ses entrées, sorties et prises : <a href="#donnees/batiments/${encodeURIComponent(id)}">éditeur de bâtiments</a>.</p>
  ${sourceLine(m.sources, picture)}
</article>`;
}

const hasWarn = (ctx: RecipesCtx, e: Entry) => (e.kind === "objet" ? ctx.data.items.get(e.id) : ctx.data.machines.get(e.id))?.verify.some((f) => f.field !== "page") === true;

/** Une tuile de la liste (pastille et nom), avec ⚠ si une valeur de sa fiche est à vérifier. */
function tile(ctx: RecipesCtx, e: Entry, current: string | null): string {
  const warn = hasWarn(ctx, e) ? `<span class="rc-flag warn" title="Une valeur de sa fiche est à vérifier">⚠</span>` : "";
  const on = current === `${e.kind}/${e.id}`;
  return `<li><a class="rc-tile${on ? " on" : ""}" href="${recipeHref(e.kind, e.id)}"${on ? ` aria-current="page"` : ""}>${pic(ctx, e.kind, e.id, e.name)}<span class="rc-name">${esc(e.name)}</span>${warn}</a></li>`;
}

const EMPTY = `<p class="muted rc-empty">Rien ne correspond. Essaie un autre mot (en anglais, comme en jeu).</p>`;

export function renderEntryList(ctx: RecipesCtx, entries: Entry[], current: string | null): string {
  if (!entries.length) return EMPTY;
  return `<ul class="rc-grid">${entries.map((e) => tile(ctx, e, current)).join("")}</ul>`;
}

const SORT_LABEL: Record<SortKey, string> = { nom: "Nom", valeur: "Valeur", rp: "RP" };

/** Affichage en lignes : nom, valeur (vente ou achat) et facteur RP, triables par l'en-tête. */
export function renderEntryRows(ctx: RecipesCtx, entries: Entry[], current: string | null, sort: ListSort): string {
  if (!entries.length) return EMPTY;
  const th = (k: SortKey, cls: string, help: string) => {
    const on = sort.key === k;
    const arrow = on ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
    return `<th class="${cls}" aria-sort="${on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}"><button type="button" class="link" data-rc-sort="${k}" title="${esc(help)}">${SORT_LABEL[k]}${arrow}</button></th>`;
  };
  const rows = entries
    .map((e) => {
      const on = current === `${e.kind}/${e.id}`;
      const v = entryValue(ctx.data, e);
      const rv = e.kind === "objet" ? ctx.data.items.get(e.id)?.researchValue : null;
      const href = recipeHref(e.kind, e.id);
      const warn = hasWarn(ctx, e) ? ` <span class="rc-flag warn" title="Une valeur de sa fiche est à vérifier">⚠</span>` : "";
      return `<tr class="${on ? "on" : ""}"><td class="rc-rname"><a href="${href}"${on ? ` aria-current="page"` : ""}>${pic(ctx, e.kind, e.id, e.name, "xs")}<span>${esc(e.name)}</span></a>${warn}</td>
<td class="num"${v === null ? "" : ` title="${esc(`${fmtMoney(v)}${e.kind === "machine" ? " (prix d'achat)" : " (prix de vente)"}`)}"`}>${v === null ? "—" : esc(fmtMoneyShort(v))}${e.kind === "machine" ? ` <small class="muted">achat</small>` : ""}</td>
<td class="num">${rv === null || rv === undefined ? "—" : esc(typeof rv === "number" ? `${fmt(rv, 2)}×` : `${rv}×`)}</td></tr>`;
    })
    .join("");
  return `<table class="rc-rows"><thead><tr>${th("nom", "", "Trier par ordre alphabétique")}${th("valeur", "num", "Trier par prix : vente pour un objet, achat pour une machine")}${th("rp", "num", "Trier par RP rapportés (facteur RP de l'objet dans une station de recherche)")}</tr></thead><tbody>${rows}</tbody></table>`;
}
