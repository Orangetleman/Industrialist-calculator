// Interface mobile (MB3, PLAN-MOBILE.md) : en-tête court, boutons du bas (dock), panneaux. Elle ne recalcule rien :
// elle présente les éléments du site PC (mêmes identifiants, mêmes commandes) dans une autre disposition (mobile.css).
// Active si l'écran est étroit ou tactile (tablettes comprises) ; réversible si la fenêtre change.

import { t, type Key } from "../i18n/i18n.ts";
import { panZoomOf } from "./canvas.ts";
import { icon, type IconName } from "./icons.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Vue montrée dans Planifier : un onglet du résultat, ou un volet (étapes, bilan). */
export type MView = "pose" | "schema" | "etapes" | "bilan" | "liste" | "details";
type Panel = "" | "goal" | "menu";
type DockItem = { id: string; ic: IconName; label: Key };

export const PLAN_DOCK: DockItem[] = [
  { id: "pose", ic: "home", label: "tab.usine" },
  { id: "schema", ic: "share", label: "tab.schema" },
  { id: "etapes", ic: "list", label: "mob.steps" },
  { id: "bilan", ic: "chart", label: "mob.sum" },
];
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
let contrib = "posts";
let panel: Panel = "";
let pageTitle = (): string => "";

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

let head: HTMLElement, dock: HTMLElement, scrim: HTMLElement, menu: HTMLElement, empty: HTMLElement, more: HTMLElement, fiche: HTMLElement;
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
      : `<span class="m-title">${esc(pageTitle())}</span>`;
}
function drawDock(): void {
  const contribPage = page === "donnees" || page === "propositions";
  const items =
    page === "plan" ? PLAN_DOCK.map((d) => btn(d, d.id === dockOn(view))) : contribPage ? CONTRIB_DOCK.map((d) => btn(d, d.id === contrib)) : [`<button type="button" data-dock="back">${icon("home")}<span>${esc(t("mob.myplan"))}</span></button>`];
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
  b.dataset.mview = view;
  b.dataset.mpage = page;
  b.dataset.mcontrib = contrib;
  if (panel) b.dataset.mpanel = panel;
  else delete b.dataset.mpanel;
  scrim.hidden = !panel;
  menu.hidden = panel !== "menu";
  const blank = $("rtabs-result").hidden;
  empty.hidden = !(page === "plan" && blank && (view === "pose" || view === "schema" || view === "liste" || view === "details"));
  empty.innerHTML = `<p>${esc($("no-plan").hidden ? ($("answer").textContent ?? "").trim() || ($("plan-title").textContent ?? "") : "")}</p><button type="button" class="primary" data-m="goal">${esc(t("mob.pickgoal"))}</button>`;
  more.innerHTML = (["liste", "details"] as const).map((x) => `<button type="button" data-dock="${x}">${icon("list")}<span>${esc(t(x === "liste" ? "tab.liste" : "tab.details"))}</span>${icon("chevR")}</button>`).join("");
  more.hidden = blank;
  fiche.textContent = t("mob.card");
  drawHead();
  drawDock();
  if (panel === "menu") drawMenu();
}

// ---------------------------------------------------------------- retour du téléphone : ferme d'abord ce qui est ouvert

/** Ce qui est ouvert par-dessus, du plus haut au plus bas, et comment le fermer. */
function overlays(): { close(): void }[] {
  const out: { close(): void }[] = [];
  const box = document.getElementById("steps-box");
  if (document.body.classList.contains("m-steps") && box && !box.hidden) out.push({ close: closeSteps });
  if (!$("share").hidden) out.push({ close: () => $("shr-close").click() });
  if (panel) out.push({ close: () => setPanel("") });
  if (!$("plan-drawer").hidden) out.push({ close: () => $("plan-set-close").click() });
  if (document.body.classList.contains("m-fiche")) out.push({ close: closeFiche });
  if (page === "plan" && !$("pose-focus").hidden && view === "pose") out.push({ close: () => $("pose-focus").querySelector<HTMLElement>("button[data-focus-back].icon-btn")?.click() });
  return out;
}
let pushed: string | null = null;
let syncing = 0;
function syncHistory(): void {
  clearTimeout(syncing);
  syncing = window.setTimeout(() => {
    const open = on && overlays().length > 0;
    if (open && pushed === null) {
      history.pushState({ m: 1 }, "");
      pushed = location.href;
    } else if (!open && pushed !== null) {
      const same = pushed === location.href;
      pushed = null;
      if (same && history.state?.m) history.back();
    }
  }, 60);
}
function onPop(): void {
  if (pushed === null) return;
  pushed = null;
  overlays()[0]?.close();
  syncHistory();
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
function closeFiche(): void {
  document.body.classList.remove("m-fiche");
  syncHistory();
}

/** Aller à une adresse depuis un panneau : elle remplace l'entrée posée pour « Retour ». */
function nav(href: string): void {
  panel = "";
  const was = pushed !== null && history.state?.m;
  pushed = null;
  if (was) location.replace(href);
  else location.hash = href;
  apply();
}

function setView(v: MView): void {
  view = v;
  closeFiche();
  if (v === "pose" || v === "schema" || v === "liste" || v === "details") $(`rtab-${v}`).click();
  apply();
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}

function setContrib(id: string): void {
  contrib = id;
  const to = { posts: "#propositions", bat: "#contribuer/batiments", val: "#contribuer/verifier", envois: "#contribuer/verifier" }[id]!;
  if (location.hash !== to) location.hash = to;
  apply();
  window.scrollTo(0, 0);
}

function onClick(e: Event): void {
  const el = (e.target as Element).closest<HTMLElement>("[data-m], [data-dock], [data-href]");
  if (!el) return;
  if (el.dataset.href) return nav(el.dataset.href);
  const d = el.dataset.dock;
  if (d === "back") return nav("#objet");
  if (d && CONTRIB_DOCK.some((x) => x.id === d)) return setContrib(d);
  if (d) return setView(d as MView);
  const m = el.dataset.m;
  if (m === "goal" || m === "menu") setPanel(m);
  else if (m === "close") setPanel("");
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

// ---------------------------------------------------------------- visite guidée (tour.ts) : ses cibles, sur mobile

const ALIAS: Record<string, string> = { "#rtabs-result": ".m-dock", "#me": ".m-menu", "#remark-btn": ".m-menu", "#plan-set-open": ".m-set", "#graph-bar": "#flow-frame", "#upto-form": "#upto-form" };
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
    document.body.classList.remove("m-about", "m-steps", "m-fiche");
    panel = "";
  }
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
  unifyMedia(on);
  if (on) {
    const st = menu.querySelector<HTMLElement>(".m-status")!;
    for (const id of ["me", "me-play", "lang-sw", "theme-btn"]) move($(id), st);
    move($("plan-insp"), $("page-plan"));
    tab = readTab();
    view = nextView("pose", tab, true);
    sync();
  } else {
    restore();
    panel = "";
    scrim.hidden = menu.hidden = true;
    for (const k of ["mview", "mpage", "mpanel", "mcontrib"]) delete document.body.dataset[k];
    document.body.classList.remove("m-steps", "m-fiche", "m-about");
  }
  window.dispatchEvent(new Event("resize"));
}

/** À appeler une fois, après le premier affichage de la page. */
export function initMobile(title: () => string): void {
  pageTitle = title;
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
  window.addEventListener("popstate", onPop);
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
