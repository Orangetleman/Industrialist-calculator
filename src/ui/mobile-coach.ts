// Tutoriel au téléphone (MB10, format « coach » de maquette/tutoriel-mobile.html) : une ligne sous l'en-tête, une
// consigne à la fois ; l'élément visé respire, sans voile ; l'étape avance quand le joueur fait le vrai geste. Huit
// courtes leçons, chacune de trois gestes ; à la fin d'une leçon, la suivante est proposée. Le tutoriel du PC (tour.ts)
// ne change pas.

import { t, type Key } from "../i18n/i18n.ts";
import { icon } from "./icons.ts";

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const shown = (sel: string) => {
  const e = q(sel);
  return !!e && !e.closest("[hidden]") && e.getClientRects().length > 0;
};
const d = () => document.body.dataset;

/** Un geste : la consigne, l'élément montré, l'adresse où il se fait, et le test qui le dit fait. */
export type CoachStep = { key: string; target?: string; hash?: string; /** Vue de Planifier à montrer (bouton du bas). */ dock?: string; done: (s: Snap) => boolean };
/** Ce qu'une étape compare : l'état au moment où elle commence. */
type Snap = Record<string, string>;
const snap = (): Snap => ({
  item: (q<HTMLInputElement>("#item")?.value ?? "").trim(),
  zoom: q("#pose-frame")?.dataset.zoom ?? "",
  prio: q("#criteria-chips")?.textContent ?? "",
  graph: localStorage.getItem("ind-calc:v1:graph") ?? "",
  bac: String((JSON.parse(localStorage.getItem("ind-calc:v1:bac") ?? "{}").blocks ?? []).length),
});

/** Les leçons, dans l'ordre du parcours d'un joueur ; trois gestes chacune. */
export const LESSONS: { id: string; steps: CoachStep[] }[] = [
  { id: "plan", steps: [
    { key: "goal", target: ".m-goal", hash: "#objet", done: () => d().mpanel === "goal" },
    { key: "item", target: "#item-pick", done: (s) => !!q<HTMLInputElement>("#item")?.value.trim() && q<HTMLInputElement>("#item")!.value.trim() !== s.item && !shown(".cmd-pal") },
    { key: "close", done: () => !d().mpanel && !q("#rtabs-result")!.hidden },
  ] },
  { id: "usine", steps: [
    { key: "pinch", target: "#pose-frame", hash: "#objet", dock: "pose", done: (s) => d().mview === "pose" && (q("#pose-frame")?.dataset.zoom ?? "") !== s.zoom },
    { key: "module", target: "#pose-frame", done: () => shown("#pose-focus") },
    { key: "unmodule", done: () => !shown("#pose-focus") },
  ] },
  { id: "vues", steps: [
    { key: "schema", target: '[data-dock="schema"]', done: () => d().mview === "schema" },
    { key: "etapes", target: '[data-dock="etapes"]', done: () => d().mview === "etapes" },
    { key: "bilan", target: '[data-dock="bilan"]', done: () => d().mview === "bilan" },
  ] },
  { id: "schema", steps: [
    { key: "node", target: "#flow-frame", hash: "#objet", dock: "schema", done: () => shown(".gv-bub") },
    { key: "count", target: ".gv-bub", done: (s) => (localStorage.getItem("ind-calc:v1:graph") ?? "") !== s.graph },
    { key: "recalc", target: ".gv-tray [data-act=recalc]", done: () => !!q("dialog#ask[open]") },
  ] },
  { id: "regler", steps: [
    { key: "open", target: ".m-set", hash: "#objet", done: () => !q("#plan-drawer")!.hidden },
    { key: "prio", target: "#criteria", done: (s) => (q("#criteria-chips")?.textContent ?? "") !== s.prio },
    { key: "shut", done: () => !!q("#plan-drawer")!.hidden },
  ] },
  { id: "partie", steps: [
    { key: "menu", target: ".m-menu", done: () => d().mpanel === "menu" || d().mpage === "usine" },
    { key: "usine", target: '.m-grid [data-href="#usine"]', done: () => d().mpage === "usine" },
    { key: "recherche", target: '[data-dock="us-recherche"]', done: () => d().mpage === "usine" && q("#utab-recherche")?.getAttribute("aria-selected") === "true" },
  ] },
  { id: "bac", steps: [
    { key: "poser", target: '[data-dock="poser"]', hash: "#bac", done: () => d().mbac === "poser" },
    { key: "choose", target: "#bac-mtree", done: () => !!q("#bac-mtree [data-mb=pose]") },
    { key: "pose", target: "#bac-mtree [data-mb=pose]", done: (s) => String((JSON.parse(localStorage.getItem("ind-calc:v1:bac") ?? "{}").blocks ?? []).length) !== s.bac },
  ] },
  { id: "recettes", steps: [
    { key: "search", target: "#rc-q", hash: "#recettes", done: () => (q<HTMLInputElement>("#rc-q")?.value ?? "").trim().length > 1 },
    { key: "card", target: "#rc-list", done: () => !!q("#rc-layout.has-card") },
    { key: "remark", target: ".m-menu", done: () => !!q("dialog.rm-dialog[open]") },
  ] },
];

const KEY = "ind-calc:v1:coach";
const loadDone = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};

/** Prochaine leçon à proposer après `id` : la suivante pas encore faite (fonction pure, testée). */
export function nextLesson(id: string | null, done: Set<string>): string | null {
  const ids = LESSONS.map((l) => l.id);
  const from = id ? ids.indexOf(id) + 1 : 0;
  return [...ids.slice(from), ...ids.slice(0, from)].find((x) => x !== id && !done.has(x)) ?? null;
}

export type CoachHooks = { begin(id: string): void; end(): void; changed(): void };

export function createCoach(bar: HTMLElement, hooks: CoachHooks) {
  const done = loadDone();
  let cur: { id: string; i: number; snap: Snap } | null = null;
  let after: string | null = null;
  let timer = 0;
  let lit: HTMLElement | null = null;
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...done]));
    } catch {
      // stockage indisponible : la liste repart de zéro
    }
  };
  const lesson = () => LESSONS.find((l) => l.id === cur?.id)!;
  function light(sel?: string): void {
    const el = sel ? q(sel) : null;
    if (el === lit) return;
    lit?.classList.remove("m-coach-target");
    lit = el;
    lit?.classList.add("m-coach-target");
  }
  function draw(): void {
    bar.hidden = !cur && !after;
    // Les panneaux du bas s'arrêtent sous la consigne : elle reste lisible pendant le geste.
    requestAnimationFrame(() => document.body.style.setProperty("--m-coach", bar.hidden ? "0px" : `${Math.ceil(bar.getBoundingClientRect().bottom)}px`));
    if (after) {
      const nx = nextLesson(after, done);
      bar.innerHTML = `<small>${esc(t("coach.done", { n: done.size, total: LESSONS.length }))}</small><b>${esc(nx ? t("coach.next", { name: t(`coach.${nx}` as Key) }) : t("coach.all"))}</b>${nx ? `<button type="button" class="go" data-coach="start" data-id="${nx}">${esc(t("coach.go"))} ${icon("chevR")}</button>` : ""}<button type="button" class="x" data-coach="later" aria-label="${esc(t("coach.later"))}">${icon("close")}</button>`;
      light();
      return hooks.changed();
    }
    if (!cur) {
      light();
      return hooks.changed();
    }
    const l = lesson(), st = l.steps[cur.i]!;
    bar.innerHTML = `<small>${esc(t(`coach.${l.id}` as Key))} · ${cur.i + 1} / ${l.steps.length}</small><b>${esc(t(`coach.${l.id}.${st.key}` as Key))}</b><button type="button" class="x" data-coach="quit" aria-label="${esc(t("coach.quit"))}">${icon("close")}</button><span class="bar"><i style="width:${(100 * cur.i) / l.steps.length}%"></i></span>`;
    light(st.target);
    hooks.changed();
  }
  function tick(): void {
    if (!cur) return;
    const st = lesson().steps[cur.i]!;
    if (st.target && lit?.isConnected === false) lit = null;
    light(st.target); // la page redessine ses éléments : la cible suit
    if (!st.done(cur.snap)) return;
    bar.classList.remove("ok");
    void bar.offsetWidth;
    bar.classList.add("ok");
    if (++cur.i >= lesson().steps.length) return finish(true);
    enterStep();
  }
  function enterStep(): void {
    const st = lesson().steps[cur!.i]!;
    if (st.hash && !location.hash.startsWith(st.hash)) location.hash = st.hash;
    if (st.dock) setTimeout(() => q<HTMLElement>(`[data-dock="${st.dock}"]`)?.click(), 200);
    setTimeout(() => {
      if (!cur) return;
      cur.snap = snap();
      draw();
    }, st.hash ? 500 : 0);
    draw();
  }
  function start(id: string): void {
    if (!LESSONS.some((l) => l.id === id)) return;
    after = null;
    hooks.end(); // la partie supposée débloquée ne sert qu'aux leçons qui en ont besoin
    cur = { id, i: 0, snap: snap() };
    hooks.begin(id);
    enterStep();
    clearInterval(timer);
    timer = window.setInterval(tick, 300);
  }
  function finish(ok: boolean): void {
    clearInterval(timer);
    if (cur && ok) {
      done.add(cur.id);
      save();
      after = cur.id;
    }
    cur = null;
    // Leçon réussie : le plan reste affiché tant que la suite est proposée.
    if (!ok || !after) hooks.end();
    draw();
  }
  bar.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-coach]");
    if (!b) return;
    const a = b.dataset.coach;
    if (a === "start") start(b.dataset.id!);
    else if (a === "quit") finish(false);
    else if (a === "later") {
      after = null;
      hooks.end();
      draw();
    }
  });
  return {
    start,
    active: () => !!cur || !!after,
    /** « Retour » : quitte la leçon, ou ferme la proposition de la suivante. */
    close(): void {
      if (cur) finish(false);
      else {
        after = null;
        hooks.end();
        draw();
      }
    },
    /** Les leçons et leur état, pour la liste « Premiers pas ». */
    list: () => LESSONS.map((l) => ({ id: l.id, done: done.has(l.id), n: l.steps.length })),
    left: () => LESSONS.length - done.size,
  };
}
