// Sélecteur de recettes de l'éditeur de graphe (PLAN-GRAPHE.md § 3, lot G3) : la palette S61 étendue
// aux recettes. Une fenêtre au-dessus de la page, un champ, des onglets (Produire / Consommer /
// Énergie), chaque recette dessinée « entrées → machine → sorties ». Flèches pour choisir, Entrée
// pour ajouter, Échap pour fermer ; un clic hors de la boîte ferme aussi.

import { t } from "../i18n/i18n.ts";
import { esc } from "./format.ts";
import { icon } from "./icons.ts";

export type PickerTab = { key: string; label: string; ids: () => string[] };
export type PickerCard = {
  ins: { item: string; name: string; q: string }[];
  outs: { item: string; name: string; q: string }[];
  machine: string;
  info: string;
};

/** Plus de cartes que ça : on demande de préciser la recherche (la page reste rapide). */
const MAX_SHOWN = 120;
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function openRecipePicker(o: { title: string; tabs: PickerTab[]; item?: string | null; card: (id: string) => PickerCard; onPick: (id: string) => void; onClose?: () => void }): () => void {
  let tab = o.tabs[0]!.key;
  let focus = 0;
  let shown: string[] = [];
  const el = document.createElement("div");
  el.className = "cmd-pal gv-pick";
  el.innerHTML = `<div class="pal-box gv-pick-box" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
    <header><b>${esc(o.title)}</b><button type="button" class="gv-pick-x" data-close aria-label="${esc(t("gv.close"))}" title="${esc(t("gv.close"))}">${icon("close")}</button></header>
    <input class="pal-q" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t("gv.pick.ph"))}" aria-label="${esc(t("gv.pick.ph"))}">
    <div class="pal-tabs" role="group">${o.tabs.map((x) => `<button type="button" data-tab="${esc(x.key)}">${esc(x.label)}</button>`).join("")}</div>
    <div class="gv-pick-list" role="listbox"></div>
    <p class="pal-help">${esc(t("gv.pick.help"))}</p>
  </div>`;
  document.body.append(el);
  const q = el.querySelector<HTMLInputElement>(".pal-q")!;
  const list = el.querySelector<HTMLElement>(".gv-pick-list")!;
  const cards = new Map<string, PickerCard & { text: string }>();
  const cardOf = (id: string) => {
    let c = cards.get(id);
    if (!c) {
      const raw = o.card(id);
      c = { ...raw, text: fold([raw.machine, ...raw.ins.map((x) => x.name), ...raw.outs.map((x) => x.name)].join(" ")) };
      cards.set(id, c);
    }
    return c;
  };
  const tag = (x: { item: string; name: string; q: string }) => `<span class="gv-tag${x.item === o.item ? " hit" : ""}"><span class="num">${esc(x.q)}</span>${esc(x.name)}</span>`;

  function render(): void {
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-tab]")) b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
    const needle = fold(q.value.trim());
    const ids = o.tabs.find((x) => x.key === tab)!.ids();
    // Ce que la recette produit d'abord (chercher « gearbox », c'est vouloir en faire), puis la machine, puis les entrées.
    const words = needle.split(/\s+/).filter(Boolean);
    const rank = (id: string) => {
      const c = cardOf(id);
      const has = (s: string) => words.every((w) => fold(s).includes(w));
      return c.outs.some((x) => has(x.name)) ? 0 : has(c.machine) ? 1 : 2;
    };
    const all = needle
      ? ids
          .filter((id) => words.every((w) => cardOf(id).text.includes(w)))
          .map((id, i) => ({ id, r: rank(id), i }))
          .sort((a, b) => a.r - b.r || a.i - b.i)
          .map((x) => x.id)
      : ids;
    shown = all.slice(0, MAX_SHOWN);
    focus = Math.min(focus, Math.max(0, shown.length - 1));
    list.innerHTML = shown.length
      ? shown
          .map((id, i) => {
            const c = cardOf(id);
            return `<button type="button" class="gv-rc${i === focus ? " f" : ""}" role="option" aria-selected="${i === focus}" data-pick="${esc(id)}">
              <span class="side i">${c.ins.map(tag).join("") || `<small>${esc(t("gv.pick.raw"))}</small>`}</span>
              <span class="mid"><b>${esc(c.machine)}</b>${esc(c.info)}</span>
              <span class="side o">${c.outs.map(tag).join("")}</span></button>`;
          })
          .join("") + (all.length > shown.length ? `<p class="pal-more">${esc(t("gv.pick.more", { n: all.length - shown.length }))}</p>` : "")
      : `<p class="pal-more">${esc(t("gv.pick.none"))}</p>`;
  }
  function move(d: number): void {
    if (!shown.length) return;
    focus = (focus + d + shown.length) % shown.length;
    for (const [i, b] of [...list.querySelectorAll<HTMLElement>(".gv-rc")].entries()) {
      b.classList.toggle("f", i === focus);
      b.setAttribute("aria-selected", String(i === focus));
      if (i === focus) b.scrollIntoView({ block: "nearest" });
    }
  }
  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    el.remove();
    o.onClose?.();
  }
  function pick(id: string): void {
    close();
    o.onPick(id);
  }
  el.addEventListener("click", (e) => {
    const t0 = e.target as Element;
    if (t0 === el || t0.closest("[data-close]")) return close();
    const b = t0.closest<HTMLElement>("[data-tab]");
    if (b) {
      tab = b.dataset.tab!;
      focus = 0;
      render();
      q.focus();
      return;
    }
    const c = t0.closest<HTMLElement>("[data-pick]");
    if (c) pick(c.dataset.pick!);
  });
  el.addEventListener("keydown", (e) => {
    // Les touches de la fenêtre restent à elle (pas de Ctrl Z, Suppr ni Échap du canevas derrière).
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && (e.target === q || (e.target as Element).closest(".gv-rc"))) {
      e.preventDefault();
      const id = (e.target as Element).closest<HTMLElement>("[data-pick]")?.dataset.pick ?? shown[focus];
      if (id) pick(id);
    }
  });
  q.addEventListener("input", () => {
    focus = 0;
    render();
  });
  render();
  q.focus();
  return close;
}
