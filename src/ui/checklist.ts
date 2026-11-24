// Liste « Premiers pas » (remarque n° 14, maquette reference/maquette-tutoriel.html) : le volet en bas à droite
// qui reste après le premier parcours. Six cases ; chacune lance un mini-parcours (tour.ts) sur la bonne page.
// Ce qui est vu se coche et reste coché dans ce navigateur ; « Masquer » la range, « ? Tutoriel » la rouvre.

import { t, type Key } from "../i18n/i18n.ts";
import { CHECKLIST, SITE_TOUR, tourSeq, type CheckItem } from "./tour.ts";

const KEY = "ind-calc:v1:premiers-pas";
type Saved = { done: CheckItem[]; hidden: boolean };

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Saved>;
    return { done: (raw.done ?? []).filter((d): d is CheckItem => (CHECKLIST as readonly string[]).includes(d)), hidden: !!raw.hidden };
  } catch {
    return { done: [], hidden: false };
  }
}
function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible : la liste repart de zéro au prochain chargement
  }
}

/** Nombre de bulles d'une case (0 pour les deux du premier parcours, qui se cochent en le suivant). */
export function stepsOf(item: CheckItem): number {
  return item === "premier-plan" || item === "plan-pose" ? 0 : tourSeq(SITE_TOUR, item).length;
}

/** Case cochée par une étape atteinte du parcours (fonction pure, testée) : la réponse vue = premier plan, les vues = plan de pose. */
export function reachedItem(mode: string, index: number): CheckItem | null {
  if (mode !== "first") return null;
  const step = SITE_TOUR[index];
  if (step?.target === "#answer") return "premier-plan";
  if (step?.target === "#rtabs-result") return "plan-pose";
  return null;
}

export function createChecklist(hooks: { start(mode: string): void; replay(): void }) {
  const st = load();
  let box: HTMLElement | null = null;
  function build(): HTMLElement {
    if (box) return box;
    box = Object.assign(document.createElement("aside"), { className: "steps-box", id: "steps-box" });
    box.setAttribute("aria-labelledby", "steps-h");
    box.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-steps]");
      const a = el?.dataset.steps;
      if (!a) return;
      if (a === "hide") hide();
      else if (a === "replay") {
        hide(false);
        hooks.replay();
      } else {
        hide(false);
        hooks.start(a);
      }
    });
    document.body.append(box);
    return box;
  }
  function render(): void {
    const b = build();
    const n = st.done.length;
    b.hidden = st.hidden;
    b.innerHTML = `<div class="steps-head"><h2 id="steps-h">${t("steps.title")}</h2><span class="steps-n">${n} / ${CHECKLIST.length}</span></div>
      <div class="steps-bar"><i style="width:${(n / CHECKLIST.length) * 100}%"></i></div>
      <ul>${CHECKLIST.map((it) => {
        const done = st.done.includes(it);
        const k = stepsOf(it);
        const sub = k ? ` <small>${t("steps.n", { n: k })}</small>` : "";
        return `<li class="${done ? "done" : ""}"><button type="button" data-steps="${it === "premier-plan" || it === "plan-pose" ? "first" : it}">${t(`steps.${it}` as Key)}${sub}</button></li>`;
      }).join("")}</ul>
      <div class="steps-foot">${n === CHECKLIST.length ? `<span>${t("steps.all")}</span>` : `<button type="button" class="tour-link" data-steps="replay">${t("steps.replay")}</button>`}<button type="button" class="tour-link" data-steps="hide">${t("steps.hide")}</button></div>`;
  }
  /** Faire (ré)apparaître la liste (fin d'un parcours, bouton « ? Tutoriel »). */
  function show(): void {
    st.hidden = false;
    save(st);
    render();
  }
  function hide(persist = true): void {
    if (persist) {
      st.hidden = true;
      save(st);
    }
    if (box) box.hidden = true;
  }
  function check(item: CheckItem): void {
    if (st.done.includes(item)) return;
    st.done = [...st.done, item];
    save(st);
    if (box && !box.hidden) render();
  }
  return { show, hide, check, render, done: () => st.done.length };
}
