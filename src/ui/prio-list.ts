// Liste de priorités à réordonner : glisser une ligne, ou ses boutons ↑ ↓ (clavier, téléphone).
// La première départage d'abord, les suivantes seulement à égalité.

import { t } from "../i18n/i18n.ts";
import { esc } from "./format.ts";

export type PrioItem<K extends string> = { key: K; label: string; why: string };

/** Lignes de la liste (à placer dans un <ol class="prio-list">). */
export function renderPrioItems<K extends string>(items: PrioItem<K>[]): string {
  return items
    .map(
      (it, i) =>
        `<li draggable="true" data-crit="${esc(it.key)}"><span class="grip" aria-hidden="true">⋮⋮</span><span class="rank">${i + 1}</span><span class="crit"><b>${esc(it.label)}</b> <span class="hint">${esc(it.why)}</span></span><button type="button" class="mv" data-move="-1" aria-label="${esc(t("prio.up", { label: it.label }))}"${i === 0 ? " disabled" : ""}>↑</button><button type="button" class="mv" data-move="1" aria-label="${esc(t("prio.down", { label: it.label }))}"${i === items.length - 1 ? " disabled" : ""}>↓</button></li>`,
    )
    .join("");
}

/** Déplace `k` d'un cran (`by` = −1 ou +1), ou avant `to` (glisser). */
export function moveItem<K>(list: K[], k: K, by: number): K[] {
  const out = [...list];
  const i = out.indexOf(k);
  const j = i + by;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
export function moveBefore<K>(list: K[], k: K, to: K): K[] {
  if (k === to) return [...list];
  const out = list.filter((x) => x !== k);
  out.splice(list.indexOf(to) > list.indexOf(k) ? out.indexOf(to) + 1 : out.indexOf(to), 0, k);
  return out;
}

/** Branche le glisser et les boutons ; `set` reçoit le nouvel ordre (le rendu est à sa charge). */
export function bindPrioList<K extends string>(el: HTMLElement, get: () => K[], set: (list: K[], focus?: K) => void): void {
  el.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-move]");
    if (!b) return;
    const k = b.closest<HTMLElement>("[data-crit]")!.dataset.crit as K;
    set(moveItem(get(), k, Number(b.dataset.move)), k);
  });
  let dragged: K | null = null;
  const clear = () => {
    for (const x of el.querySelectorAll(".dragging, .drop")) x.classList.remove("dragging", "drop");
  };
  el.addEventListener("dragstart", (e) => {
    const li = (e.target as Element).closest<HTMLElement>("[data-crit]");
    if (!li) return;
    dragged = li.dataset.crit as K;
    li.classList.add("dragging");
    e.dataTransfer?.setData("text/plain", dragged);
  });
  el.addEventListener("dragover", (e) => {
    if (!dragged) return;
    e.preventDefault();
    const li = (e.target as Element).closest<HTMLElement>("[data-crit]");
    for (const x of el.querySelectorAll(".drop")) x.classList.remove("drop");
    if (li && li.dataset.crit !== dragged) li.classList.add("drop");
  });
  el.addEventListener("dragend", () => {
    dragged = null;
    clear();
  });
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    const li = (e.target as Element).closest<HTMLElement>("[data-crit]");
    const k = dragged;
    dragged = null;
    clear();
    if (k && li) set(moveBefore(get(), k, li.dataset.crit as K));
  });
}

/** Remet le focus sur un bouton actif de la ligne `k` après un nouveau rendu. */
export function focusItem(el: HTMLElement, k: string): void {
  el.querySelector<HTMLButtonElement>(`[data-crit="${CSS.escape(k)}"] .mv:not(:disabled)`)?.focus();
}
