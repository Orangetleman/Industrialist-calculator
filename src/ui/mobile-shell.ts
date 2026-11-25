// Interface mobile (MB3, PLAN-MOBILE.md) : en-tête court, boutons du bas (dock), panneaux. Elle ne recalcule rien :
// elle présente les éléments du site PC (mêmes identifiants, mêmes commandes) dans une autre disposition (mobile.css).
// Active si l'écran est étroit ou tactile (tablettes comprises) ; réversible si la fenêtre change.

import { t, type Key } from "../i18n/i18n.ts";
import { panZoomOf } from "./canvas.ts";
import { icon, type IconName } from "./icons.ts";
import { closePop, popEl } from "./popmenu.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Vue montrée dans Planifier : un onglet du résultat, ou un volet (étapes, bilan). */
export type MView = "pose" | "schema" | "etapes" | "bilan" | "liste" | "details";
type Panel = "" | "goal" | "menu" | "bac" | "steps";
/** Ce que le bac à sable offre à la coquille (MB7). */
export type MobileBac = { tool(): string; setTool(x: never): void; pinned(): boolean; canBack(): boolean; back(): void; listen(f: () => void): void; reset(): void; rows(): { id: string; ic: string; label: string; on?: boolean }[]; act(id: string): void };
type DockItem = { id: string; ic: IconName; label: Key };

export const PLAN_DOCK: DockItem[] = [
  { id: "pose", ic: "home", label: "tab.usine" },
  { id: "schema", ic: "share", label: "tab.schema" },
  { id: "etapes", ic: "list", label: "mob.steps" },
  { id: "bilan", ic: "chart", label: "mob.sum" },
];
export const BAC_DOCK: DockItem[] = [
  { id: "voir", ic: "move", label: "mob.bac.see" },
  { id: "poser", ic: "plus", label: "mob.bac.pose" },
  { id: "relier", ic: "link", label: "mob.bac.tie" },
  { id: "effacer", ic: "trash", label: "mob.bac.del" },
];
/** Pages dont les boutons du bas sont des commandes déjà présentes dans la page (MB8) : le bouton, l'élément touché, l'attribut qui le dit allumé. */
type Proxy = DockItem & { sel: string; on: string };
export const PROXY_DOCK: Record<string, Proxy[]> = {
  recettes: [
    { id: "rc-tout", ic: "tiles", label: "rcp.all", sel: '[data-rc-filter="tout"]', on: "aria-pressed" },
    { id: "rc-objets", ic: "module", label: "rcp.items", sel: '[data-rc-filter="objets"]', on: "aria-pressed" },
    { id: "rc-machines", ic: "config", label: "rcp.machines", sel: '[data-rc-filter="machines"]', on: "aria-pressed" },
  ],
  usine: [
    { id: "us-partie", ic: "home", label: "us.tab.partie", sel: "#utab-partie", on: "aria-selected" },
    { id: "us-recherche", ic: "chart", label: "us.tab.recherche", sel: "#utab-recherche", on: "aria-selected" },
  ],
  arbre: [
    { id: "ar-p", ic: "module", label: "mob.cat.p", sel: '#page-arbre [data-cat="Production"]', on: "aria-selected" },
    { id: "ar-e", ic: "power", label: "mob.cat.e", sel: '#page-arbre [data-cat="Energy"]', on: "aria-selected" },
    { id: "ar-u", ic: "config", label: "mob.cat.u", sel: '#page-arbre [data-cat="Utility"]', on: "aria-selected" },
  ],
};
export const CONTRIB_DOCK: DockItem[] = [
  { id: "posts", ic: "idea", label: "mob.posts" },
  { id: "bat", ic: "module", label: "mob.buildings" },
  { id: "val", ic: "warn", label: "mob.values" },
  { id: "envois", ic: "send", label: "mob.sent" },
];
const MENU: { href: string; ic: IconName; label: Key }[] = [
  { href: "#objet", ic: "home", label: "nav.plan" },
  { href: "#recettes", ic: "list", label: "nav.recettes" },
  { href: "#bac", ic: "tiles", label: "page.bac" },
  { href: "#usine", ic: "config", label: "nav.usine" },
  { href: "#arbre", ic: "group", label: "page.arbre" },
  { href: "#propositions", ic: "edit", label: "nav.contribuer" },
];

/** Vue de Planifier quand l'onglet du résultat change (fonction pure, testée) : un volet ouvert reste ouvert tant que l'onglet ne bouge pas. */
export function nextView(view: MView, tab: string, tabChanged: boolean): MView {
  const asTab = (["pose", "schema", "liste", "details"] as const).find((x) => x === tab) ?? "pose";
  if (tabChanged) return asTab;
  return view === "etapes" || view === "bilan" ? view : asTab;
}

/** Bouton du bas allumé (fonction pure, testée) : liste et détails dépendent du bilan. */
export const dockOn = (view: MView): string => (view === "liste" || view === "details" ? "bilan" : view);

/** Cran d'un panneau bas (pixels visibles) le plus proche, dans le sens du geste ; 0 : fermer (fonction pure, testée). */
export function snapTo(v: number, delta: number, stops: number[]): number {
  if (Math.abs(delta) < 8) return stops.find((s) => s > v + 4) ?? stops[0]!;
  const list = [0, ...stops];
  const aim = v + delta * 0.6;
  return list.reduce((best, s) => (Math.abs(s - aim) < Math.abs(best - aim) ? s : best), list[0]!);
}

type Page = string;
let on = false;
let page: Page = "plan";
let tab = "";
let view: MView = "pose";
/** Dernier dessin montré (usine ou schéma) : « retour » y ramène depuis Étapes et Bilan. */
let lastDraw: MView = "pose";
let contrib = "posts";
let panel: Panel = "";
let pageTitle = (): string => "";
let bac: MobileBac | null = null;

export const mobileOn = (): boolean => on;

// ---------------------------------------------------------------- feuilles de style : un seul jeu de règles

/** Les règles « grand écran » et « petit écran » du site n'ont plus cours : une base unique, à toutes les tailles. */
const mediaSaved = new Map<CSSMediaRule, string>();
function unifyMedia(active: boolean): void {
  if (!active) {
    for (const [r, m] of mediaSaved) r.media.mediaText = m;
    mediaSaved.clear();
    return;
  }
  for (const sh of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sh.cssRules;
    } catch {
      continue; // feuille d'un autre site (polices)
    }
    for (const r of rules) {
      if (!(r instanceof CSSMediaRule) || mediaSaved.has(r)) continue;
      const m = r.media.mediaText;
      const min = /min-width:\s*(\d+)px|width\s*>=\s*(\d+)px/.exec(m);
      const max = /max-width:\s*(\d+)px|width\s*<=\s*(\d+)px/.exec(m);
      let to: string | null = null;
      if (min && Number(min[1] ?? min[2]) >= 640) to = "not all";
      else if (max && Number(max[1] ?? max[2]) >= 600) to = "all";
      if (!to) continue;
      mediaSaved.set(r, m);
      r.media.mediaText = to;
    }
  }
}

// ---------------------------------------------------------------- éléments

let stepBar: HTMLElement, head: HTMLElement, dock: HTMLElement, scrim: HTMLElement, menu: HTMLElement, empty: HTMLElement, more: HTMLElement, fiche: HTMLElement;
const moved: { el: HTMLElement; mark: Comment }[] = [];
function move(el: HTMLElement | null, to: HTMLElement, first = false): void {
  if (!el) return;
  const mark = document.createComment("mob");
  el.before(mark);
  if (first) to.prepend(el);
  else to.append(el);
  moved.push({ el, mark });
}
function restore(): void {
  for (const { el, mark } of moved.splice(0).reverse()) mark.replaceWith(el);
}

const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const lit = (d: Proxy) => q(d.sel)?.getAttribute(d.on) === "true" && !(page === "recettes" && cardOpen());
const cardOpen = () => !!q("#rc-layout.has-card");
const bldOpen = () => page === "donnees" && contrib === "bat" && !$("bld-editor").hidden && !bldList;
/** Éditeur de bâtiments : la liste est rouverte (« ‹ ») sans oublier le bâtiment en cours. */
let bldList = false;
const treeList = () => q('[data-view="list"]')?.getAttribute("aria-checked") === "true";

const btn = (d: DockItem, cur: boolean) =>
  `<button type="button" data-dock="${d.id}"${cur ? ' aria-current="page"' : ""}>${icon(d.ic)}<span>${esc(t(d.label))}</span></button>`;

function goalText(): string {
  const val = (id: string) => ($<HTMLInputElement>(id)?.value ?? "").trim();
  const opt = (id: string) => $<HTMLSelectElement>(id)?.selectedOptions[0]?.textContent ?? "";
  const cur = document.querySelector<HTMLElement>("[data-goal][aria-current]");
  const g = cur?.dataset.goal ?? "objet";
  if (g === "objet" && val("item")) return `<b>${esc(val("item"))}</b> <i>${esc(val("qty"))} ${esc(opt("qty-unit"))}</i>`;
  if (g === "énergie" && val("energy")) return `<b>${esc(cur?.textContent ?? "")}</b> <i>${esc(val("energy"))} ${esc(opt("energy-unit"))}</i>`;
  if (g === "argent" && val("money")) return `<b>${esc(cur?.textContent ?? "")}</b> <i>${esc(val("money"))} $/min</i>`;
  return `<b>${esc($("plan-title").textContent ?? "")}</b>`;
}

const DOT = '<span class="m-dot"></span>';
function stepsLeft(): string {
  const n = document.querySelector("#steps-box .steps-n")?.textContent ?? "";
  const [a, b] = n.split("/").map((x) => parseInt(x, 10));
  return a !== undefined && b !== undefined && a < b ? n : "";
}

function drawHead(): void {
  head.innerHTML =
    page === "plan"
      ? `<button type="button" class="m-goal" data-m="goal" aria-expanded="${panel === "goal"}"><span>${goalText()}</span>${icon("edit")}</button><button type="button" class="m-ib m-set" data-m="set" aria-label="${esc(t("mob.settings"))}">${icon("settings")}</button><button type="button" class="m-ib" data-m="share" aria-label="${esc(t("share.btn"))}">${icon("share")}</button>`
      : page === "recettes" && cardOpen()
        ? `<button type="button" class="m-ib" data-m="cardback" aria-label="${esc(t("rcp.back"))}">${icon("chevL")}</button><span class="m-title m-tl">${esc(q("#rc-card h2")?.textContent ?? pageTitle())}</span>${location.hash.startsWith("#recettes/objet/") ? `<button type="button" class="m-go" data-m="plan">${esc(t("nav.plan"))}</button>` : ""}`
      : bldOpen()
        ? `<button type="button" class="m-ib" data-m="bldback" aria-label="${esc(t("mob.bld.list"))}">${icon("chevL")}</button><span class="m-title m-tl">${esc(q("#bld-head h3")?.textContent ?? "")}</span><button type="button" class="m-go" data-m="bldsave">${esc(t("bld.save"))}</button>`
      : `<span class="m-title">${esc(pageTitle())}</span>${page === "recettes" || page === "arbre" ? `<span class="m-sp"></span>${page === "arbre" ? `<button type="button" class="m-ib" data-m="treeview" aria-label="${esc(t(treeList() ? "tr.view.tree" : "tr.view.list"))}">${icon(treeList() ? "share" : "list")}</button>` : ""}<button type="button" class="m-ib" data-m="opts" aria-expanded="${document.body.classList.contains("m-opts")}" aria-label="${esc(t("mob.opts"))}">${icon("settings")}</button>` : ""}${page === "bac" ? `<span class="m-sp"></span><button type="button" class="m-ib" data-m="stats" aria-label="${esc(t("bac.stats.title"))}">${icon("chart")}</button><button type="button" class="m-ib" data-m="bac" aria-expanded="${panel === "bac"}" aria-label="${esc(t("mob.bac.more"))}">${icon("settings")}</button>` : ""}`;
}
/** Usine : l'étape montrée, la précédente, la suivante, « posé » (MB6) ; le nom ouvre la liste des étapes. */
const stepRows = () => [...document.querySelectorAll<HTMLElement>("#plan-steps .cmd-row")];
const stepAt = (rows: HTMLElement[]) => rows.findIndex((r) => r.classList.contains("on"));
function drawSteps(): void {
  const rows = stepRows();
  const i = stepAt(rows);
  stepBar.hidden = !(page === "plan" && view === "pose" && i >= 0 && rows.length > 1);
  if (stepBar.hidden) return;
  const row = rows[i]!, box = row.querySelector<HTMLInputElement>("input.cmd-box");
  const name = row.querySelector(".nm")?.innerHTML ?? "", n = row.querySelector(".x")?.textContent ?? "";
  stepBar.innerHTML = `<button type="button" data-step-go="-1" aria-label="${esc(t("mob.prev"))}"${i ? "" : " disabled"}>${icon("chevL")}</button><button type="button" class="nm" data-m="steps" aria-haspopup="listbox" aria-expanded="${panel === "steps"}"><span><small>${esc(i ? t("mob.stepn", { n: i, total: rows.length - 1 }) : t("mob.stepall", { total: rows.length - 1 }))}</small>${name}</span><i>${esc(n)}</i>${icon("more")}</button>${box ? `<button type="button" class="ck" data-step-posed aria-pressed="${box.checked}" aria-label="${esc(box.getAttribute("aria-label") ?? "")}"><span class="m-sw">${box.checked ? icon("check") : ""}</span></button>` : "<span></span>"}<button type="button" data-step-go="1" aria-label="${esc(t("mob.next"))}"${i < rows.length - 1 ? "" : " disabled"}>${icon("chevR")}</button>`;
}
function drawStepList(): void {
  const rows = stepRows(), i = stepAt(rows);
  menu.querySelector("h2")!.textContent = t("mob.picksteps");
  menu.querySelector(".m-grid")!.innerHTML = "";
  menu.querySelector(".m-rows")!.innerHTML = rows
    .map((r, k) => `<button type="button" role="option" data-step-pick="${k}" aria-selected="${k === i}">${k ? `<b>${k}</b>` : icon("home")}<span>${r.querySelector(".nm")?.innerHTML ?? ""}</span><i>${esc(r.querySelector(".x")?.textContent ?? "")}</i>${r.querySelector<HTMLInputElement>("input.cmd-box")?.checked ? icon("check") : ""}</button>`)
    .join("");
  requestAnimationFrame(() => menu.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "center" }));
}
function onSteps(e: Event): void {
  const b = (e.target as Element).closest<HTMLElement>("button");
  if (!b) return;
  const rows = stepRows(), i = stepAt(rows);
  if (b.dataset.stepGo) rows[i + Number(b.dataset.stepGo)]?.querySelector<HTMLElement>(".cmd-step")?.click();
  else if ("stepPosed" in b.dataset) rows[i]?.querySelector<HTMLInputElement>("input.cmd-box")?.click();
  else setPanel("steps");
  drawSteps();
}
function drawDock(): void {
  const contribPage = page === "donnees" || page === "propositions";
  const items =
    page === "plan" ? PLAN_DOCK.map((d) => btn(d, d.id === dockOn(view))) : page === "bac" ? BAC_DOCK.map((d) => btn(d, d.id === bac?.tool())) : PROXY_DOCK[page] ? PROXY_DOCK[page]!.map((d) => btn(d, lit(d))) : contribPage ? CONTRIB_DOCK.map((d) => btn(d, d.id === contrib)) : [`<button type="button" data-dock="back">${icon("home")}<span>${esc(t("mob.myplan"))}</span></button>`];
  dock.innerHTML = `${items.join("")}<button type="button" class="m-menu" data-m="menu" aria-expanded="${panel === "menu"}">${icon("rows")}<span>${esc(t("mob.menu"))}</span>${stepsLeft() ? DOT : ""}</button>`;
}
function drawMenu(): void {
  const cur: Record<string, string> = { plan: "#objet", recettes: "#recettes", bac: "#bac", usine: "#usine", arbre: "#arbre", donnees: "#propositions", propositions: "#propositions" };
  const n = stepsLeft();
  menu.querySelector(".m-grid")!.innerHTML = MENU.map((x) => `<button type="button" data-href="${x.href}"${cur[page] === x.href ? ' aria-current="page"' : ""}>${icon(x.ic)}<span>${esc(t(x.label))}</span></button>`).join("");
  menu.querySelector(".m-rows")!.innerHTML = `<button type="button" data-m="first">${icon("check")}<span>${esc(t("steps.title"))}</span>${n ? `<i>${esc(n)}</i>${DOT}` : ""}</button>
    <button type="button" data-m="remark">${icon("remark")}<span>${esc(t("mob.remark"))}</span></button>
    <button type="button" data-href="#methodes">${icon("info")}<span>${esc(t("mob.methods"))}</span></button>
    <button type="button" data-m="about">${icon("info")}<span>${esc(t("mob.about"))}</span></button>`;
  menu.querySelector("h2")!.textContent = t("mob.goto");
  menu.querySelector(".m-x")!.setAttribute("aria-label", t("common.close"));
}

function apply(): void {
  if (!on) return;
  const b = document.body;
  if (view === "pose" || view === "schema") lastDraw = view;
  b.dataset.mview = view;
  b.dataset.mpage = page;
  b.dataset.mcontrib = contrib;
  if (page === "bac" && bac) b.dataset.mbac = bac.tool();
  else delete b.dataset.mbac;
  b.classList.toggle("m-bld", bldOpen());
  drawSteps();
  drawBldTabs();
  b.classList.toggle("m-binfo", page === "bac" && !!bac?.pinned());
  if (panel) b.dataset.mpanel = panel;
  else delete b.dataset.mpanel;
  scrim.hidden = !panel;
  menu.hidden = panel !== "menu" && panel !== "bac" && panel !== "steps";
  const blank = $("rtabs-result").hidden;
  empty.hidden = !(page === "plan" && blank && (view === "pose" || view === "schema" || view === "liste" || view === "details"));
  empty.innerHTML = `<p>${esc($("no-plan").hidden ? ($("answer").textContent ?? "").trim() || ($("plan-title").textContent ?? "") : "")}</p><button type="button" class="primary" data-m="goal">${esc(t("mob.pickgoal"))}</button>`;
  more.innerHTML = (["liste", "details"] as const).map((x) => `<button type="button" data-dock="${x}">${icon("list")}<span>${esc(t(x === "liste" ? "tab.liste" : "tab.details"))}</span>${icon("chevR")}</button>`).join("");
  more.hidden = blank;
  fiche.textContent = t("mob.card");
  sent.querySelector("h2")!.textContent = t("mob.surveys");
  sent.querySelector(".m-rows span")!.textContent = t("mob.mine");
  drawHead();
  drawDock();
  if (panel === "menu") drawMenu();
  if (panel === "steps") drawStepList();
  if (panel === "bac" && bac) {
    menu.querySelector("h2")!.textContent = t("mob.bac.more");
    menu.querySelector(".m-grid")!.innerHTML = "";
    menu.querySelector(".m-rows")!.innerHTML = bac.rows().map((r) => `<button type="button" data-bac="${r.id}"${r.on === undefined ? "" : ` aria-pressed="${r.on}"`}>${r.ic}<span>${esc(r.label)}</span>${r.on === undefined ? "" : `<i class="m-sw">${r.on ? icon("check") : ""}</i>`}</button>`).join("");
  }
}

// ---------------------------------------------------------------- retour du téléphone : ferme d'abord ce qui est ouvert

/** Ce qui est ouvert par-dessus, du plus haut au plus bas, et comment le fermer. */
function overlays(): { close(): void }[] {
  const out: { close(): void }[] = [];
  const has = (c: string) => document.body.classList.contains(c);
  const add = (open: boolean, close: () => void) => open && out.push({ close });
  const byId = (id: string) => document.getElementById(id);
  const tip = q(".m-tip");
  add(!!tip && !tip.hidden, () => (tip!.hidden = true));
  // La bulle de la visite reste ouverte : la quitter a son bouton.
  add(!!popEl(), closePop);
  for (const p of document.querySelectorAll<HTMLElement>(".cmd-pal")) add(!p.hidden, () => p.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  const box = byId("steps-box");
  add(has("m-steps") && !!box && !box.hidden, closeSteps);
  add(has("m-about"), () => document.body.classList.remove("m-about"));
  add(!$("share").hidden, () => $("shr-close").click());
  add(!!panel, () => setPanel(""));
  add(!$("plan-drawer").hidden, () => $("plan-set-close").click());
  if (page === "bac") {
    const dlg = byId("bac-dlg");
    add(!!dlg && !dlg.hidden, () => byId("bac-dlg-back")?.click());
    add(has("m-bstats"), closeStats);
    add(!!bac?.canBack(), () => bac?.back());
  }
  if (page === "plan") {
    add(has("m-fiche"), closeFiche);
    const bub = q(".gv-bub");
    add(view === "schema" && !!bub && !bub.hidden, () => bub!.querySelector<HTMLElement>("[data-b=close]")?.click());
    const tool = q('.gv-tray [data-tool][aria-pressed="true"]');
    add(view === "schema" && !!tool, () => tool!.click());
    const full = $("pose-focus").classList.contains("full");
    add(view === "pose" && full, () => $("pose-focus").querySelector<HTMLElement>("[data-focus-full]")?.click());
    add(view === "pose" && !$("pose-focus").hidden, () => $("pose-focus").querySelector<HTMLElement>("button[data-focus-back].icon-btn")?.click());
    const sub = q(".cmd-pane.sub.on [data-back]");
    add(view === "bilan" && !!sub, () => sub!.click());
    add(view === "liste" || view === "details", () => setView("bilan"));
    add(view === "etapes" || view === "bilan", () => setView(lastDraw));
    const rows = stepRows();
    add(view === "pose" && stepAt(rows) > 0, () => rows[0]!.querySelector<HTMLElement>(".cmd-step")?.click());
  }
  add(has("m-opts"), closeOpts);
  add(has("m-node"), closeNode);
  if (page === "donnees") {
    const bb = $("bld-bubble");
    add(!bb.hidden, () => bb.querySelector<HTMLElement>("[data-bb-close]")?.click());
    const face = q("#bld-facepop [data-face-close], #bld-facepop [data-fp-close]");
    add(!!face, () => face!.click());
    add(bldOpen() && bldTab !== "grid", () => setBldTab("grid"));
    add(bldOpen(), () => {
      bldList = true;
      apply();
    });
  }
  return out;
}

/**
 * Bouton ou geste « retour ». `CloseWatcher` (Chrome, Android compris) reçoit le retour tant que quelque chose est
 * ouvert, sans toucher à l'historique : l'ancienne méthode (une entrée d'historique en plus) se perdait quand la page
 * réécrivait son adresse, et pouvait ramener à une page d'avant. Sans lui, le retour reste celui du navigateur.
 */
type Watcher = { destroy(): void; requestClose(): void; onclose: (() => void) | null };
const WatcherCtor = (globalThis as unknown as { CloseWatcher?: new () => Watcher }).CloseWatcher;
let watcher: Watcher | null = null;
let syncing = 0;
let treeSeen = false;
let lastHash = "";
let lastEsc = -1e9;
function syncHistory(): void {
  clearTimeout(syncing);
  syncing = window.setTimeout(() => {
    const open = on && overlays().length > 0;
    if (open && !watcher && WatcherCtor) {
      watcher = new WatcherCtor();
      watcher.onclose = () => {
        watcher = null;
        // Échap a déjà été traité par la page : on ne ferme pas deux choses.
        if (performance.now() - lastEsc > 150) overlays()[0]?.close();
        syncHistory();
      };
    } else if (!open && watcher) {
      const w = watcher;
      watcher = null;
      w.onclose = null;
      w.destroy();
    }
  }, 40);
}

function setPanel(p: Panel): void {
  panel = panel === p ? "" : p;
  apply();
  syncHistory();
  if (panel === "menu") menu.querySelector<HTMLElement>("[data-href]")?.focus({ preventScroll: true });
}
function closeSteps(): void {
  document.body.classList.remove("m-steps");
  syncHistory();
}
function closeStats(): void {
  document.body.classList.remove("m-bstats");
  syncHistory();
}
/** Fiche ouverte depuis une autre vue de Recettes : « ‹ » revient à elle. */
let cardTrail = false;
let sent: HTMLElement;
function closeOpts(): void {
  document.body.classList.remove("m-opts");
  if (on) drawHead();
  syncHistory();
}
/** Éditeur d'un bâtiment : la grille, la liste de ses ports (avec leur info-bulle), sa fiche. */
let bldTab: "grid" | "ports" | "card" = "grid";
let bldTabs: HTMLElement, portList: HTMLElement;
function setBldTab(x: typeof bldTab): void {
  bldTab = x;
  apply();
  window.scrollTo(0, 0);
  syncHistory();
  if (x === "grid") requestAnimationFrame(() => panZoomOf($("bld-frame"))?.reset());
}
function drawBldTabs(): void {
  document.body.classList.toggle("m-bldcard", bldOpen() && bldTab === "card");
  document.body.classList.toggle("m-bldports", bldOpen() && bldTab === "ports");
  if (!bldOpen()) return;
  const ports = [...document.querySelectorAll<SVGElement>("#bld-svg [data-port]")];
  bldTabs.innerHTML = (["grid", "ports", "card"] as const).map((x) => `<button type="button" role="tab" data-bt="${x}" aria-selected="${x === bldTab}">${esc(t(`mob.bt.${x}` as Key))}${x === "ports" ? ` <i>${ports.length}</i>` : ""}</button>`).join("");
  if (bldTab !== "ports") return;
  portList.innerHTML = ports.length
    ? ports.map((p) => { const [a, ...b] = (p.querySelector("title")?.textContent ?? "").split(" — "); return `<button type="button" data-pick-port="${p.dataset.port}"><i class="bld-sw ${esc(p.classList[1] ?? "")}"></i><span>${esc(b.join(" — ").split(" · ")[0]! || t("mob.notip"))}<small>${esc((a ?? "").split(" · ").slice(0, 3).join(" · "))}</small></span>${icon("chevR")}</button>`; }).join("")
    : `<p class="hint">${esc(t("mob.noports"))}</p>`;
}
function pickPort(e: Event): void {
  const b = (e.target as Element).closest<HTMLElement>("[data-pick-port]");
  if (!b) return;
  setBldTab("grid");
  setTimeout(() => document.querySelector(`#bld-svg [data-port="${b.dataset.pickPort}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true })), 60);
}
function closeNode(): void {
  document.body.classList.remove("m-node");
  syncHistory();
}
/** Tableaux en lignes : chaque case porte le titre de sa colonne. */
function labelCells(root: HTMLElement): void {
  for (const tb of root.querySelectorAll("table")) {
    const heads = [...tb.querySelectorAll("thead th")].map((x) => x.textContent?.trim() ?? "");
    for (const tr of tb.querySelectorAll("tbody tr")) if (tr.children.length === heads.length) [...tr.children].forEach((c, i) => (c as HTMLElement).dataset.l !== heads[i] && ((c as HTMLElement).dataset.l = heads[i]!));
  }
}
function closeFiche(): void {
  document.body.classList.remove("m-fiche");
  syncHistory();
}

/** Aller à une adresse depuis un panneau : elle remplace l'entrée posée pour « Retour ». */
function nav(href: string): void {
  panel = "";
  location.hash = href;
  apply();
  syncHistory();
}

function setView(v: MView): void {
  view = v;
  closeFiche();
  if (v === "pose" || v === "schema" || v === "liste" || v === "details") $(`rtab-${v}`).click();
  apply();
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}

function setContrib(id: string): void {
  // « Bâtiments » touché une seconde fois : la liste, puis le bâtiment en cours.
  bldList = id === "bat" && contrib === "bat" ? bldOpen() : id === "bat" ? !!$("bld-editor").hidden : false;
  contrib = id;
  const to = { posts: "#propositions", bat: "#contribuer/batiments", val: "#contribuer/verifier", envois: "#contribuer/verifier" }[id]!;
  if (location.hash !== to) location.hash = to;
  apply();
  window.scrollTo(0, 0);
}

function onClick(e: Event): void {
  const el = (e.target as Element).closest<HTMLElement>("[data-m], [data-dock], [data-href], [data-bac], [data-step-pick], [data-bt]");
  if (!el) return;
  if (el.dataset.stepPick) {
    setPanel("");
    stepRows()[Number(el.dataset.stepPick)]?.querySelector<HTMLElement>(".cmd-step")?.click();
    return;
  }
  if (el.dataset.bt) return setBldTab(el.dataset.bt as typeof bldTab);
  if (el.dataset.href) return nav(el.dataset.href);
  if (el.dataset.bac) {
    bac?.act(el.dataset.bac);
    // Un interrupteur laisse le menu ouvert ; le reste agit sur le plan.
    if (el.hasAttribute("aria-pressed")) apply();
    else {
      setPanel("");
      syncHistory();
    }
    return;
  }
  const d = el.dataset.dock;
  if (d === "back") return nav("#objet");
  const px = d && PROXY_DOCK[page]?.find((x) => x.id === d);
  if (px) {
    if (page === "recettes" && cardOpen()) location.hash = "#recettes";
    q(px.sel)?.click();
    closeNode();
    window.scrollTo(0, 0);
    return void setTimeout(apply, 0);
  }
  if (d && BAC_DOCK.some((x) => x.id === d)) {
    closeStats();
    bac?.setTool(d as never);
    return apply();
  }
  if (d && CONTRIB_DOCK.some((x) => x.id === d)) return setContrib(d);
  if (d) return setView(d as MView);
  const m = el.dataset.m;
  if (m === "goal" || m === "menu" || m === "bac") setPanel(m);
  else if (m === "stats") {
    document.body.classList.toggle("m-bstats");
    document.getElementById("bac-stats")?.setAttribute("open", "");
    syncHistory();
  }
  else if (m === "close") setPanel("");
  else if (m === "bldback") {
    bldList = true;
    setBldTab("grid");
    apply();
    syncHistory();
  } else if (m === "bldsave") $("bld-save")?.click();
  else if (m === "mine") {
    $("remark-btn").click();
    setTimeout(() => document.querySelector<HTMLElement>("dialog.rm-dialog [data-rm-tab=mine], dialog.rm-dialog [data-tab=mine]")?.click(), 50);
  } else if (m === "cardback") history.length > 1 && document.referrer === "" && cardTrail ? history.back() : (location.hash = "#recettes");
  else if (m === "plan") {
    const it = $<HTMLInputElement>("item");
    it.value = q("#rc-card h2")?.textContent ?? "";
    it.dispatchEvent(new Event("input", { bubbles: true }));
    it.dispatchEvent(new Event("change", { bubbles: true }));
    nav("#objet");
    setTimeout(() => panel !== "goal" && setPanel("goal"), 80);
  } else if (m === "treeview") {
    q(`[data-view="${treeList() ? "tree" : "list"}"]`)?.click();
    closeNode();
    setTimeout(() => {
      apply();
      panZoomOf($("rs-frame"))?.reset();
    }, 0);
  } else if (m === "opts") {
    document.body.classList.toggle("m-opts");
    apply();
    syncHistory();
  }
  else if (m === "set") $("plan-set-open").click();
  else if (m === "share") $("share-open").click();
  else if (m === "fiche") {
    document.body.classList.toggle("m-fiche");
    syncHistory();
  } else if (m === "remark") {
    setPanel("");
    $("remark-btn").click();
  } else if (m === "about") {
    setPanel("");
    document.body.classList.add("m-about");
    document.querySelector("footer.src")?.scrollIntoView();
  } else if (m === "first") {
    setPanel("");
    $("help").click();
    document.body.classList.add("m-steps");
    syncHistory();
  }
}

// ---------------------------------------------------------------- panneaux bas à crans

function grip(sheet: HTMLElement, close: () => void): void {
  const g = Object.assign(document.createElement("div"), { className: "m-grip", innerHTML: "<i></i>" });
  sheet.prepend(g);
  let start: { id: number; y: number; v: number } | null = null;
  const stops = () => [140, Math.round(innerHeight * 0.5), innerHeight - 150];
  g.addEventListener("pointerdown", (e) => {
    start = { id: e.pointerId, y: e.clientY, v: sheet.getBoundingClientRect().height };
    g.setPointerCapture(e.pointerId);
    sheet.classList.add("m-drag");
  });
  g.addEventListener("pointermove", (e) => {
    if (start?.id === e.pointerId) sheet.style.setProperty("--m-v", `${Math.max(60, start.v + start.y - e.clientY)}px`);
  });
  const end = (e: PointerEvent) => {
    if (start?.id !== e.pointerId) return;
    const v = snapTo(start.v, start.y - e.clientY, stops());
    start = null;
    sheet.classList.remove("m-drag");
    if (!v) sheet.style.removeProperty("--m-v");
    else sheet.style.setProperty("--m-v", `${v}px`);
    if (!v) close();
  };
  g.addEventListener("pointerup", end);
  g.addEventListener("pointercancel", end);
}

/** Ce qu'on vient de toucher reste visible à côté du panneau qui s'ouvre. */
function keepVisible(frame: HTMLElement, el: Element | null, sheet: HTMLElement): void {
  if (!on || !el) return;
  const f = frame.getBoundingClientRect(), b = el.getBoundingClientRect(), p = sheet.getBoundingClientRect();
  const side = p.left > f.left + 20; // panneau à droite (paysage)
  const right = side ? p.left : f.right, bottom = side ? f.bottom : p.top;
  const shift = (a: number, z: number, lo: number, hi: number) => (z - a > hi - lo ? lo + (hi - lo) / 2 - (a + z) / 2 : a < lo ? lo - a : z > hi ? hi - z : 0);
  const dx = shift(b.left, b.right, f.left + 12, right - 12), dy = shift(b.top, b.bottom, f.top + 12, bottom - 12);
  if (dx || dy) panZoomOf(frame)?.panBy(dx, dy);
}
function watchBubble(bub: HTMLElement): void {
  new MutationObserver(() => {
    if (!bub.hidden) requestAnimationFrame(() => keepVisible($("flow-frame"), document.querySelector(".gn.sel, .gn.on, .gn[aria-pressed='true']"), bub));
  }).observe(bub, { attributes: true, attributeFilter: ["hidden"] });
}

/** Appui long : montre le texte qu'un survol montre sur PC (`title`), en bas de l'écran. */
function longPress(): void {
  const tip = Object.assign(document.createElement("div"), { className: "m-tip", hidden: true });
  tip.setAttribute("role", "status");
  document.body.append(tip);
  let timer = 0, shown = false, x = 0, y = 0;
  const textOf = (el: Element | null): string => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = e.getAttribute("title") || [...e.children].find((c) => c.tagName === "title")?.textContent;
      if (s) return s;
    }
    return "";
  };
  document.addEventListener("pointerdown", (e) => {
    clearTimeout(timer);
    shown = false;
    if (!on || e.pointerType !== "touch") return;
    tip.hidden = true;
    // Le plan du bac à sable a son propre appui long (zone à copier ou à effacer).
    const el = e.target as Element;
    if (!e.isPrimary || el.closest("#bac-map, .m-grip, input:not([type="checkbox"], [type="radio"]), select, textarea")) return;
    const s = textOf(el);
    if (!s) return;
    [x, y] = [e.clientX, e.clientY];
    timer = window.setTimeout(() => {
      tip.textContent = s;
      tip.hidden = false;
      shown = true;
      syncHistory();
    }, 480);
  }, true);
  const stop = (e: PointerEvent) => {
    if (e.type === "pointermove" && Math.hypot(e.clientX - x, e.clientY - y) < 10) return;
    clearTimeout(timer);
  };
  for (const ev of ["pointermove", "pointerup", "pointercancel"] as const) document.addEventListener(ev, stop, true);
  // Le clic qui suit un appui long ne déclenche rien ; pas de menu du navigateur par-dessus.
  document.addEventListener("click", (e) => {
    if (!shown) return;
    shown = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  document.addEventListener("contextmenu", (e) => { if (on && textOf(e.target as Element)) e.preventDefault(); });
}

// ---------------------------------------------------------------- visite guidée (tour.ts) : ses cibles, sur mobile

const ALIAS: Record<string, string> = { ".bld-tools": "#bld-frame", "#rtabs-result": ".m-dock", "#me": ".m-menu", "#remark-btn": ".m-menu", "#plan-set-open": ".m-set", "#graph-bar": "#flow-frame", "#upto-form": "#upto-form" };
/** L'élément à montrer pour une étape de la visite. */
export const tourTarget = (sel: string): string => (on ? (ALIAS[sel] ?? sel) : sel);
/** Ouvre le volet où se trouve la cible d'une étape de la visite. */
export function tourReveal(sel: string | undefined): void {
  if (!on) return;
  closeSteps();
  panel = sel === "#query" || sel === ".prio-bar" ? "goal" : "";
  if (sel === ".cmd-left") view = "etapes";
  else if (sel === ".cmd-right" || sel === "#answer" || sel === "#plan-share") view = "bilan";
  else if (sel === "#pose-frame") setView("pose");
  else if (sel === "#flow-frame" || sel === ".gv-tray" || sel === ".gv-recalc" || sel === "#graph-bar") setView("schema");
  apply();
}

// ---------------------------------------------------------------- mise en route

function build(): void {
  const el = (tag: string, cls: string, html = "") => Object.assign(document.createElement(tag), { className: cls, innerHTML: html });
  head = el("div", "m-head");
  document.querySelector("header.top")!.prepend(head);
  dock = el("nav", "m-dock");
  scrim = el("div", "m-scrim");
  scrim.hidden = true;
  menu = el("section", "m-panel m-menu-panel", `<div class="m-ph"><h2></h2><button type="button" class="m-x" data-m="close">${icon("close")}</button></div><div class="m-grid"></div><div class="m-status"></div><div class="m-rows"></div>`);
  menu.hidden = true;
  document.body.append(dock, scrim, menu);
  empty = el("div", "m-empty");
  document.querySelector(".cmd-stage")!.append(empty);
  stepBar = el("div", "m-steps-bar");
  stepBar.hidden = true;
  document.querySelector(".cmd-stage")!.append(stepBar);
  stepBar.addEventListener("click", onSteps);
  sent = el("section", "m-sent", `<h2></h2><div class="m-sent-b"></div><div class="m-rows"><button type="button" data-m="mine">${icon("remark")}<span></span>${icon("chevR")}</button></div>`);
  sent.addEventListener("click", onClick);
  document.querySelector("#dpanel-verifier .corrections-panel")!.after(sent);
  bldTabs = el("div", "m-bldtabs");
  bldTabs.setAttribute("role", "tablist");
  portList = el("div", "m-rows m-portlist");
  $("bld-editor").prepend(bldTabs);
  bldTabs.after(portList);
  bldTabs.addEventListener("click", onClick);
  portList.addEventListener("click", pickPort);
  more = el("div", "m-rows m-more");
  $("pane-root").querySelector(".cmd-pb")!.append(more);
  fiche = el("button", "m-fiche-btn");
  fiche.setAttribute("type", "button");
  fiche.dataset.m = "fiche";
  for (const r of [head, dock, menu, empty, more]) r.addEventListener("click", onClick);
  scrim.addEventListener("click", () => setPanel(""));
  fiche.addEventListener("click", onClick);
  grip($("pose-focus"), () => $("pose-focus").querySelector<HTMLElement>("button[data-focus-back].icon-btn")?.click());
  grip($("plan-insp"), closeFiche);
  grip($("rs-detail"), closeNode);
}

function readTab(): string {
  return document.querySelector<HTMLElement>('[data-rtab][aria-selected="true"]')?.dataset.rtab ?? "";
}

function sync(): void {
  if (!on) return;
  const p = document.querySelector<HTMLElement>("main > .page:not([hidden])")?.id.replace("page-", "") ?? "plan";
  const nt = readTab();
  view = nextView(view, nt, nt !== tab);
  tab = nt;
  if (p !== page) {
    document.body.classList.remove("m-about", "m-steps", "m-fiche", "m-bstats", "m-opts", "m-node");
    panel = "";
  }
  // Arbre : la liste d'abord, la première fois (décision n° 4 du plan) ; ensuite, la dernière vue choisie.
  if (p === "arbre" && page !== "arbre" && !treeSeen) {
    treeSeen = true;
    if (!treeList()) setTimeout(() => q('[data-view="list"]')?.click(), 0);
  }
  cardTrail = p === "recettes" && page === "recettes" && lastHash.startsWith("#recettes") ? true : p === "recettes" ? false : cardTrail;
  lastHash = location.hash;
  page = p;
  // La bulle d'un nœud n'existe qu'une fois le schéma affiché.
  const bub = document.querySelector<HTMLElement>(".gv-bub");
  if (bub && bub.nextElementSibling !== fiche) {
    bub.after(fiche);
    watchBubble(bub);
  }
  if (page === "propositions") contrib = "posts";
  else if (page === "donnees") contrib = location.hash.includes("/batiments") || $("dpanel-batiments").hidden === false ? "bat" : contrib === "envois" ? "envois" : "val";
  apply();
}

function enable(active: boolean): void {
  if (active === on) return;
  on = active;
  document.body.classList.toggle("mob", on);
  bac?.reset();
  unifyMedia(on);
  if (on) {
    const st = menu.querySelector<HTMLElement>(".m-status")!;
    for (const id of ["me", "me-play", "lang-sw", "theme-btn"]) move($(id), st);
    move($("plan-insp"), $("page-plan"));
    // Envois : mes relevés de bâtiments à côté de mes corrections.
    move(q(".bld-list > .actions"), sent.querySelector<HTMLElement>(".m-sent-b")!);
    move($("bld-io"), sent.querySelector<HTMLElement>(".m-sent-b")!);
    tab = readTab();
    view = nextView("pose", tab, true);
    sync();
  } else {
    restore();
    panel = "";
    scrim.hidden = menu.hidden = true;
    for (const k of ["mview", "mpage", "mpanel", "mcontrib", "mbac"]) delete document.body.dataset[k];
    document.body.classList.remove("m-steps", "m-fiche", "m-about", "m-bstats", "m-binfo", "m-opts", "m-node", "m-bld", "m-bldcard", "m-bldports");
  }
  window.dispatchEvent(new Event("resize"));
}

/** À appeler une fois, après le premier affichage de la page. */
export function initMobile(title: () => string, sandbox: MobileBac): void {
  pageTitle = title;
  bac = sandbox;
  bac.listen(() => {
    if (!on || page !== "bac") return;
    apply();
    syncHistory();
  });
  build();
  const mq = matchMedia("(max-width: 899px), (pointer: coarse)");
  const size = new ResizeObserver(() => {
    const r = document.documentElement.style;
    r.setProperty("--m-top", `${Math.round(document.querySelector("header.top")!.getBoundingClientRect().height)}px`);
  });
  size.observe(document.querySelector("header.top")!);
  // Clavier du téléphone : les panneaux du bas tiennent dans la partie visible.
  const vv = window.visualViewport;
  const kb = () => document.documentElement.style.setProperty("--m-kb", `${Math.max(0, Math.round(innerHeight - (vv?.height ?? innerHeight) - (vv?.offsetTop ?? 0)))}px`);
  vv?.addEventListener("resize", kb);
  vv?.addEventListener("scroll", kb);
  window.addEventListener("hashchange", () => {
    // Un lien vers un bâtiment ouvre son éditeur, même si la liste était rouverte.
    if (/^#(contribuer|donnees)\/batiments\/./.test(location.hash)) bldList = false;
    sync();
    // Une adresse qui nomme un onglet le montre, même si un volet (étapes, bilan) était ouvert.
    if (on && page === "plan" && /^#[^/]+\/(schema|pose|liste|details)/.test(location.hash)) {
      view = nextView(view, readTab(), true);
      apply();
    }
  });
  // Téléphone tourné : le dessin se recadre dans sa nouvelle place.
  matchMedia("(orientation: landscape)").addEventListener("change", () => {
    if (on) setTimeout(() => ["pose-frame", "flow-frame"].forEach((id) => $(id).clientWidth && panZoomOf($(id))?.reset()), 250);
  });
  // Tout ce qui s'ouvre ou se ferme suit un geste ou une adresse : le retour se met à jour après.
  for (const ev of ["click", "pointerup", "keyup", "change", "hashchange"]) window.addEventListener(ev, () => on && (syncHistory(), setTimeout(() => on && syncHistory(), 450)), true);
  window.addEventListener("keydown", (e) => e.key === "Escape" && (lastEsc = performance.now()), true);
  if (import.meta.env.DEV) (window as unknown as { __retour: () => boolean }).__retour = () => (watcher ? (watcher.requestClose(), true) : false);
  longPress();
  // Une recherche repart du premier résultat, même si la liste avait été défilée.
  document.addEventListener("input", (e) => {
    const el = e.target as HTMLElement;
    if (on && el.matches("#rc-q, #bld-search, #tree-filter, #verify-filter, #pr-q")) window.scrollTo(0, 0);
  });
  document.addEventListener("keydown", (e) => {
    if (on && e.key === "Escape" && panel) setPanel("");
  });
  // Une étape choisie dans la liste mène à l'usine, même si l'onglet ne change pas.
  $("plan-steps").addEventListener("click", (e) => {
    if (on && (e.target as Element).closest("[data-step]")) {
      view = "pose";
      apply();
    }
  });
  $("query").addEventListener("input", () => on && drawHead());
  $("query").addEventListener("change", () => on && drawHead());
  // Ce que la page ouvre, ferme ou recalcule d'elle-même.
  const mo = new MutationObserver(() => {
    if (!on) return;
    sync();
    syncHistory();
  });
  for (const id of ["rtabs-result", "plan-drawer", "share", "pose-focus", "flow-hud"]) mo.observe($(id), { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(() => {
    if ($("pose-focus").hidden) return;
    const key = decodeURIComponent(location.hash.split("/")[3] ?? "");
    requestAnimationFrame(() => keepVisible($("pose-frame"), key ? document.querySelector(`#pose-canvas .u-mod[data-mod="${CSS.escape(key)}"] > rect`) : null, $("pose-focus")));
  }).observe($("pose-focus"), { attributes: true, attributeFilter: ["hidden"] });
  // MB8 : recherche choisie dans l'arbre → panneau ; boutons du bas à jour ; tableaux de Ma recherche en lignes.
  const detail = $("rs-detail");
  let lastNode = "";
  new MutationObserver(() => {
    if (!on) return;
    if (!detail.querySelector(".m-grip")) grip(detail, closeNode);
    const id = document.querySelector<SVGElement>(".rs-node[aria-pressed='true']")?.dataset.rs ?? "";
    if (page === "arbre" && id && id !== lastNode && !treeList()) {
      document.body.classList.add("m-node");
      requestAnimationFrame(() => keepVisible($("rs-frame"), document.querySelector(".rs-node[aria-pressed='true']"), detail));
      syncHistory();
    }
    lastNode = id;
  }).observe(detail, { childList: true });
  $("rs-frame").addEventListener("click", (e) => {
    // Un second appui sur la même recherche rouvre son panneau.
    const n = (e.target as Element).closest<SVGElement>(".rs-node");
    if (on && n && n.dataset.rs === lastNode && document.querySelector(".rs-node[aria-pressed='true']")) setTimeout(() => document.body.classList.add("m-node"), 0);
  });
  const lit2 = new MutationObserver(() => on && (PROXY_DOCK[page] || page === "donnees") && apply());
  for (const list of Object.values(PROXY_DOCK)) for (const d of list) lit2.observe(q(d.sel)!, { attributes: true, attributeFilter: [d.on] });
  lit2.observe(q('[data-view="list"]')!, { attributes: true, attributeFilter: ["aria-checked"] });
  lit2.observe($("rc-layout"), { attributes: true, attributeFilter: ["class"] });
  lit2.observe($("rc-card"), { childList: true });
  // MB9 : bâtiment choisi → son éditeur ; panneau d'un port → l'élément touché reste visible.
  $("bld-items").addEventListener("click", (e) => {
    if (!on || !(e.target as Element).closest("[data-bld]")) return;
    bldList = false;
    bldTab = "grid";
    setTimeout(() => {
      apply();
      window.scrollTo(0, 0);
      panZoomOf($("bld-frame"))?.reset();
      syncHistory();
    }, 0);
  });
  lit2.observe($("bld-editor"), { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(() => on && page === "donnees" && (drawHead(), drawBldTabs())).observe($("bld-head"), { childList: true });
  new MutationObserver(() => on && page === "donnees" && drawBldTabs()).observe($("bld-canvas"), { childList: true });
  const bb = $("bld-bubble");
  new MutationObserver(() => {
    if (!on) return;
    if (!bb.hidden) requestAnimationFrame(() => keepVisible($("bld-frame"), document.querySelector("#bld-svg .sel, #bld-svg [aria-pressed='true']"), bb));
    syncHistory();
  }).observe(bb, { attributes: true, attributeFilter: ["hidden"] });
  // MB6 : barre d'étape à jour avec la liste des étapes.
  new MutationObserver(() => on && drawSteps()).observe($("plan-steps"), { childList: true });
  const rech = $("upanel-recherche");
  new MutationObserver(() => on && labelCells(rech)).observe(rech, { childList: true, subtree: true });
  labelCells(rech);
  mo.observe($("plan-title"), { childList: true, characterData: true, subtree: true });
  mo.observe($("item-pick"), { childList: true, characterData: true, subtree: true });
  new MutationObserver(() => {
    if (on && $("flow-hud").hidden) closeFiche();
  }).observe($("flow-hud"), { attributes: true, attributeFilter: ["hidden"] });
  mq.addEventListener("change", () => enable(mq.matches));
  enable(mq.matches);
  // Ouverture sans onglet précis : l'Usine (décision n° 8).
  if (on && page === "plan" && /^#?(objet)?$/.test(location.hash)) setView("pose");
}
