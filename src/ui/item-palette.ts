// Palette de recherche d'objet (S61, maquette S58) : le choix de l'objet sans liste déroulante.
// Une fenêtre au-dessus de la page, un champ, une grille de vignettes ; Ctrl+K l'ouvre, les flèches
// choisissent, Entrée valide, Échap ferme. Les derniers objets choisis sont gardés dans ce navigateur.

import { t } from "../i18n/i18n.ts";
import { esc } from "./format.ts";

export type PalItem = { id: string; name: string; pic: string | null };

const KEY_RECENT = "ind-calc:v1:recent-items";
const MAX_SHOWN = 160;

function loadRecent(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}
function saveRecent(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 24)));
  } catch {
    // stockage indisponible : la liste des récents reste en mémoire
  }
}

/** Sans accents ni majuscules, pour chercher « fer » dans « Fer » ou « crank » dans « Crankshaft ». */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Deux lettres pour une vignette sans image. */
const initials = (name: string) => name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export function itemTile(it: PalItem, cls = "pal-ico"): string {
  return it.pic ? `<img class="${cls}" src="${esc(it.pic)}" alt="" loading="lazy">` : `<span class="${cls} pal-txt" aria-hidden="true">${esc(initials(it.name))}</span>`;
}

/** Une palette par sorte d'élément du jeu (objet, machine, recherche…) : ses récents et son texte de recherche. */
export function createItemPalette(opts: { items: () => PalItem[]; current: () => string | null; onPick: (id: string) => void; recentKey?: string; ph?: () => string }) {
  const recentKey = opts.recentKey ?? KEY_RECENT;
  let recent = loadRecent(recentKey);
  let tab: "all" | "recent" = "all";
  let shown: PalItem[] = [];
  let focus = 0;
  let back: HTMLElement | null = null;

  const el = document.createElement("div");
  el.className = "cmd-pal";
  el.hidden = true;
  el.innerHTML = `<div class="pal-box" role="dialog" aria-modal="true">
    <input class="pal-q" type="search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" >
    <div class="pal-tabs" role="group"><button type="button" data-pal-tab="all"></button><button type="button" data-pal-tab="recent"></button></div>
    <div class="pal-grid" role="listbox"></div>
    <p class="pal-help"></p>
  </div>`;
  document.body.append(el);
  const q = el.querySelector<HTMLInputElement>(".pal-q")!;
  const grid = el.querySelector<HTMLElement>(".pal-grid")!;
  const uid = Math.random().toString(36).slice(2, 7); // plusieurs palettes : des identifiants distincts

  function texts(): void {
    const ph = opts.ph ? opts.ph() : t("pal.ph");
    q.placeholder = ph;
    q.setAttribute("aria-label", ph);
    el.querySelector('[data-pal-tab="all"]')!.textContent = t("pal.all");
    el.querySelector('[data-pal-tab="recent"]')!.textContent = t("pal.recent");
    el.querySelector(".pal-help")!.textContent = t("pal.help");
  }

  function render(): void {
    const all = opts.items();
    const byId = new Map(all.map((it) => [it.id, it]));
    const needle = fold(q.value.trim());
    let list = tab === "recent" ? recent.map((id) => byId.get(id)).filter((x): x is PalItem => !!x) : all;
    if (needle) {
      list = list.filter((it) => fold(it.name).includes(needle));
      // Ce qui commence par le texte d'abord.
      list = [...list.filter((it) => fold(it.name).startsWith(needle)), ...list.filter((it) => !fold(it.name).startsWith(needle))];
    }
    shown = list.slice(0, MAX_SHOWN);
    focus = Math.min(focus, Math.max(0, shown.length - 1));
    const cur = opts.current();
    for (const b of el.querySelectorAll<HTMLElement>("[data-pal-tab]")) b.setAttribute("aria-pressed", String(b.dataset.palTab === tab));
    grid.innerHTML = shown.length
      ? shown
          .map((it, i) => `<button type="button" role="option" class="pal-it${i === focus ? " f" : ""}${it.id === cur ? " cur" : ""}" id="pal-${uid}-${i}" data-pal="${esc(it.id)}" aria-selected="${i === focus}" tabindex="-1">${itemTile(it)}<span>${esc(it.name)}</span></button>`)
          .join("") + (list.length > MAX_SHOWN ? `<p class="pal-more">${esc(t("pal.more", { n: list.length - MAX_SHOWN }))}</p>` : "")
      : `<p class="pal-more">${esc(t(tab === "recent" && !needle ? "pal.noRecent" : "pal.empty"))}</p>`;
    q.setAttribute("aria-activedescendant", shown.length ? `pal-${uid}-${focus}` : "");
  }

  function move(to: number): void {
    if (!shown.length) return;
    focus = Math.max(0, Math.min(shown.length - 1, to));
    grid.querySelectorAll(".pal-it").forEach((b, i) => {
      b.classList.toggle("f", i === focus);
      b.setAttribute("aria-selected", String(i === focus));
    });
    q.setAttribute("aria-activedescendant", `pal-${uid}-${focus}`);
    grid.querySelector(`#pal-${uid}-${focus}`)?.scrollIntoView({ block: "nearest" });
  }
  const cols = () => Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").length);

  function pick(id: string): void {
    recent = [id, ...recent.filter((x) => x !== id)];
    saveRecent(recentKey, recent);
    close();
    opts.onPick(id);
  }
  function open(): void {
    back = document.activeElement as HTMLElement | null;
    texts();
    q.value = "";
    tab = "all";
    focus = 0;
    el.hidden = false;
    render();
    const i = shown.findIndex((it) => it.id === opts.current());
    if (i >= 0) move(i);
    q.focus();
  }
  function close(): void {
    if (el.hidden) return;
    el.hidden = true;
    back?.focus();
  }

  q.addEventListener("input", () => {
    focus = 0;
    render();
  });
  q.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowDown") move(focus + cols());
    else if (k === "ArrowUp") move(focus - cols());
    else if (k === "ArrowRight" && q.selectionStart === q.value.length) move(focus + 1);
    else if (k === "ArrowLeft" && q.selectionStart === q.value.length && focus > 0) move(focus - 1);
    else if (k === "Enter" && shown[focus]) pick(shown[focus]!.id);
    else return;
    e.preventDefault();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  el.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target === el) return close();
    const b = target.closest<HTMLElement>("[data-pal]");
    if (b) return pick(b.dataset.pal!);
    const tb = target.closest<HTMLElement>("[data-pal-tab]");
    if (tb) {
      tab = tb.dataset.palTab as typeof tab;
      focus = 0;
      render();
      q.focus();
    }
  });

  return { open, close, isOpen: () => !el.hidden };
}
