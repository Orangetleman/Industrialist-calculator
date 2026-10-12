// Point d'entrée de l'interface : charge les données, lit les réglages, appelle
// solve() et affiche le résultat. Toute la logique de calcul est dans src/engine.

import "../styles.css";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type GameData, type RawFiles } from "../engine/data.ts";
import { solve, type Plan, type PlayerState } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { dependentsOf, missingNodes, rpCost, unlockUpTo } from "../engine/unlock.ts";
import { esc, fmt, fmtMoney, fmtRP, parseInput } from "./format.ts";
import {
  exportProgress,
  currentRp,
  loadPlayer,
  loadProgress,
  parseOptional,
  parseProgressExport,
  progressSummary,
  renderOwned,
  renderTree,
  sanitizeProgress,
  savePlayer,
  withRpRate,
  saveProgress,
  toEngineProgress,
  type PlayerInfo,
  type ProgressState,
  type TreeView,
} from "./progress.ts";
import { PanZoom } from "./canvas.ts";
import { initBuildings } from "./buildings.ts";
import portsJson from "../../data/ports.json";
import logisticsJson from "../../data/logistics.json";
import type { LogisticsFile, PortsFile } from "../engine/extension-types.ts";
import { layoutResearch, RN_H, RN_W, type ResearchLayout } from "./research-layout.ts";
import { renderNodeDetail, renderResearchSvg } from "./research-view.ts";
import { renderCorrections, renderGraph, renderPlan, renderRecipes, renderStatus, renderSummary, renderVerify, renderWarnings, type Ctx } from "./render.ts";
import {
  countCorrections,
  isOverridesFile,
  loadCorrections,
  loadSettings,
  mergeCorrections,
  pruneIntegratedCorrections,
  removeCorrection,
  saveCorrections,
  saveSettings,
  setCorrection,
  type Scope,
  type Settings,
} from "./state.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson } as unknown as RawFiles;
const repoOverrides = overridesJson as unknown as OverridesFile;
/** Dépôts de vente (objectif argent) : débit de vente relevé ou lu sur le wiki. */
const DEPOTS = (logisticsJson as unknown as LogisticsFile).depots.map((d) => ({ id: d.id, name: d.name, kind: d.kind, itemsPerSec: d.itemsPerSec }));

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings = loadSettings();
// Corrections locales déjà intégrées aux données (même date) : la copie locale est retirée.
const prunedCorrections = pruneIntegratedCorrections(loadCorrections(), repoOverrides);
let corrections: OverridesFile = prunedCorrections.kept;
if (prunedCorrections.dropped) saveCorrections(corrections);
let data: GameData = buildGameData(files, []).data;
let dataErrors: string[] = [];
let plan: Plan | undefined;
let prog: ProgressState = loadProgress();
let player: PlayerInfo = loadPlayer();
const treeView: TreeView = { category: "Production", filter: "" };
type Tab = "production" | "recherche" | "verifier" | "batiments" | "partie";
const TABS: Tab[] = ["production", "recherche", "verifier", "batiments", "partie"];
const KEY_UI = "ind-calc:v1:ui";
let ui: { view: "tree" | "list"; selected: string | null } = { view: "tree", selected: null };
try {
  const raw = JSON.parse(localStorage.getItem(KEY_UI) ?? "null");
  if (raw && (raw.view === "tree" || raw.view === "list")) ui = { view: raw.view, selected: typeof raw.selected === "string" ? raw.selected : null };
} catch {
  // préférences d'affichage indisponibles : valeurs par défaut
}
function saveUi(): void {
  try {
    localStorage.setItem(KEY_UI, JSON.stringify(ui));
  } catch {
    // idem
  }
}
let panzoom: PanZoom | null = null;
const layouts = new Map<string, ResearchLayout>();
let lastLayoutKey = "";

function rebuildData(): void {
  const r = buildGameData(files, [repoOverrides, corrections]);
  data = r.data;
  dataErrors = r.errors;
}

function playerState(): PlayerState {
  return { ...toEngineProgress(prog), ...player, rp: currentRp(player) };
}

// ---------------------------------------------------------------- recherche d'item
const byName = new Map<string, string>();
function fillItemList(): void {
  const list = $("item-list");
  const items = [...data.items.values()].sort((a, b) => a.name.localeCompare(b.name));
  byName.clear();
  for (const it of items) byName.set(it.name.toLowerCase(), it.id);
  list.innerHTML = items.map((it) => `<option value="${esc(it.name)}"></option>`).join("");
}
function resolveItem(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (byName.has(t)) return byName.get(t)!;
  if (data.items.has(t)) return t;
  const partial = [...byName.entries()].filter(([n]) => n.includes(t));
  return partial.length === 1 ? partial[0]![1] : null;
}

// ---------------------------------------------------------------- rendu
function syncForm(): void {
  ($("item") as HTMLInputElement).value = data.items.get(settings.item)?.name ?? settings.item;
  ($("criterion") as HTMLSelectElement).value = settings.criterion;
  ($("unverified") as HTMLInputElement).checked = settings.useUnverified;
  // Affichage arrondi ; le réglage garde la valeur exacte (un palier tombe juste).
  ($("rate") as HTMLInputElement).value = String(Number(settings.rate.toFixed(4)));
  ($("machines") as HTMLInputElement).value = String(settings.machines);
  ($("money") as HTMLInputElement).value = String(settings.money);
  ($("max-pollution") as HTMLInputElement).value = settings.maxPollution === null ? "" : String(settings.maxPollution);
  ($("self-powered") as HTMLInputElement).checked = settings.selfPowered;
  ($("use-budget") as HTMLInputElement).checked = settings.useBudget;
}

function render(): void {
  const money = settings.goal === "argent";
  plan = solve(data, playerState(), {
    item: settings.item,
    ...(money ? { moneyPerMin: settings.money } : settings.mode === "rate" ? { ratePerMin: settings.rate } : { finalMachines: settings.machines }),
    criterion: settings.criterion,
    forced: settings.forced,
    useUnverified: settings.useUnverified,
    selfPowered: settings.selfPowered,
    maxPollution: settings.maxPollution,
    budget: settings.useBudget && player.money !== null ? player.money : null,
    depots: DEPOTS,
    existing: Object.fromEntries(Object.entries(settings.existing).filter(([id]) => data.items.has(id))),
  });
  const ctx: Ctx = { data, plan, settings, corrections };

  // Champ « complémentaire » : débit calculé en mode machines, et inversement.
  const finals = plan.steps.filter((s) => plan!.finals.includes(s.key));
  if (settings.mode === "machines" && document.activeElement !== $("rate")) ($("rate") as HTMLInputElement).value = fmt(plan.target.ratePerMin, 2).replace(/\s/g, "").replace(",", ".");
  if (settings.mode === "rate" && finals.length && document.activeElement !== $("machines")) ($("machines") as HTMLInputElement).value = String(finals.reduce((n, s) => n + s.machines, 0));
  $("item-fields").hidden = money;
  $("money-fields").hidden = !money;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-goal]")) b.setAttribute("aria-checked", String(b.dataset.goal === settings.goal));
  $("mode-hint").textContent = money ? "" : settings.mode === "machines" ? "Calcul à partir du nombre de machines finales." : "Calcul à partir du débit voulu.";
  $("budget-hint").textContent = player.money === null ? "(renseigne ton argent dans « Ma partie »)" : `(${fmtMoney(player.money)})`;
  $("rate").closest("label")!.classList.toggle("active", settings.mode === "rate");
  $("machines").closest("label")!.classList.toggle("active", settings.mode === "machines");

  $("status").innerHTML = renderStatus(ctx);
  $("stats").innerHTML = renderSummary(ctx);
  $("graph").innerHTML = renderGraph(ctx);
  $("plan").innerHTML = renderPlan(ctx);
  $("verify").innerHTML = renderVerify(ctx);
  $("verify-count").textContent = String(plan.verify.filter((v) => v.used).length);
  $("corrections").innerHTML = renderCorrections(ctx);
  $("corrections-count").textContent = String(countCorrections(corrections));
  $("data-errors").innerHTML = dataErrors.length ? `<div class="banner bad">Corrections ignorées :<ul>${dataErrors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : "";
  $("rec").innerHTML = renderRecipes(ctx);
  $("warnings").innerHTML = renderWarnings(ctx);
  $("forced-reset").hidden = !Object.keys(settings.forced).length;
  renderExisting();
  saveSettings(settings);
  renderProgress();
}

// ---------------------------------------------------------------- progression et « Ma partie »
function renderProgress(): void {
  const p = toEngineProgress(prog);
  const summary = progressSummary(data, p);
  $("progress-summary").textContent = summary;
  const done = prog.unlocked.filter((id) => data.nodes.has(id)).length;
  $("tab-research-count").textContent = `${done}/${[...data.nodes.values()].filter((n) => !n.isRoot).length}`;
  $("context-hint").innerHTML = `Progression prise en compte : ${esc(summary)} — <a href="#recherche">modifier</a>${
    player.pollutionPct !== null ? ` · pollution ${esc(fmt(player.pollutionPct, 1))} %` : ""
  } · <a href="#partie">Ma partie</a>`;
  const focused = (document.activeElement as HTMLElement | null)?.dataset;
  const focusKey = focused?.node ? `[data-node="${focused.node}"]` : focused?.req ? `[data-req="${focused.req}"]` : focused?.rs ? `[data-rs="${focused.rs}"]` : null;
  $("tree-view").hidden = ui.view !== "tree";
  $("list-view").hidden = ui.view !== "list";
  for (const b of document.querySelectorAll<HTMLButtonElement>(".seg [data-view]")) b.setAttribute("aria-checked", String(b.dataset.view === ui.view));
  if (ui.view === "list") {
    $("tree").innerHTML = renderTree(data, p, treeView);
    if (focusKey) $("tree").querySelector<HTMLElement>(focusKey)?.focus();
  } else renderResearchCanvas(focusKey);
  $("owned").innerHTML = renderOwned(data, p);
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tabs [data-cat]")) tab.setAttribute("aria-selected", String(tab.dataset.cat === treeView.category));
  const parts = [
    player.pollutionPct !== null ? `pollution ${fmt(player.pollutionPct, 1)} %` : null,
    player.money !== null ? fmtMoney(player.money) : null,
    player.rp !== null ? `${fmtRP(currentRp(player))}${player.rpPerSec && player.rpAt !== null ? " (estimé)" : ""}` : null,
    player.rpPerSec !== null ? `${fmt(player.rpPerSec, 2)} RP/s` : null,
  ].filter(Boolean);
  $("player-summary").textContent = parts.length ? parts.join(" · ") : "non renseignée";
}

function researchLayout(): ResearchLayout {
  let l = layouts.get(treeView.category);
  if (!l) {
    l = layoutResearch(data, treeView.category);
    layouts.set(treeView.category, l);
  }
  return l;
}

/** Recherches qui correspondent au filtre (nom ou machine débloquée). */
function matchesFilter(id: string): boolean {
  const q = treeView.filter.trim().toLowerCase();
  if (!q) return true;
  const n = data.nodes.get(id);
  if (!n) return false;
  return n.name.toLowerCase().includes(q) || n.unlocksMachines.some((x) => (data.machines.get(x)?.name ?? x).toLowerCase().includes(q));
}

function renderResearchCanvas(focusKey: string | null): void {
  const p = toEngineProgress(prog);
  const layout = researchLayout();
  if (ui.selected && data.nodes.get(ui.selected)?.category !== treeView.category) ui.selected = null;
  $("rs-canvas").innerHTML = renderResearchSvg(data, p, layout, ui.selected, currentRp(player));
  const svg = $("rs-canvas").querySelector("svg") as SVGSVGElement;
  if (treeView.filter.trim()) {
    for (const g of svg.querySelectorAll<SVGGElement>("[data-rs]")) g.classList.toggle("dim", !matchesFilter(g.dataset.rs!));
  }
  panzoom ??= new PanZoom($("rs-frame"));
  const key = `${treeView.category}`;
  const rootNode = layout.nodes.find((n) => data.nodes.get(n.id)?.isRoot);
  panzoom.attach(svg, layout.width, layout.height, key === lastLayoutKey, rootNode ? { x: rootNode.x, y: rootNode.y + RN_H / 2 } : undefined);
  lastLayoutKey = key;
  $("rs-detail").innerHTML = renderNodeDetail(data, p, ui.selected, currentRp(player));
  renderHud();
  if (focusKey) svg.querySelector<SVGGElement>(focusKey)?.focus({ preventScroll: true });
}

/** Bandeau du canevas, comme en jeu : coût et état à gauche, bouton d'action à droite. */
function renderHud(): void {
  const n = ui.selected ? data.nodes.get(ui.selected) : undefined;
  const btn = $("rs-hud-action") as HTMLButtonElement;
  if (!n || n.isRoot || n.startUnlocked) {
    $("rs-hud-info").textContent = n ? `${n.name}${n.startUnlocked ? " · acquise d'office" : ""}` : "";
    btn.hidden = true;
    return;
  }
  const p = toEngineProgress(prog);
  const unlocked = prog.unlocked.includes(n.id);
  const missing = unlocked ? [] : missingNodes(data, p, n.id).filter((x) => x !== n.id);
  $("rs-hud-info").innerHTML = `<b>${esc(fmtRP(n.rp))}</b> <span>${esc(n.name)} · ${unlocked ? "déjà débloquée" : missing.length ? `${missing.length} prérequis manquant(s)` : "disponible"}</span>`;
  btn.hidden = false;
  btn.dataset.id = n.id;
  btn.dataset.unlocked = String(unlocked);
  btn.textContent = unlocked ? "Retirer" : missing.length ? `Débloquer (+${missing.length})` : "Débloquer";
  btn.classList.toggle("undo", unlocked);
}

function revealNode(id: string): void {
  const n = researchLayout().nodes.find((x) => x.id === id);
  if (n && panzoom) panzoom.reveal(n.x, n.y, RN_W, RN_H);
}

function selectNode(id: string, reveal = true): void {
  const n = data.nodes.get(id);
  if (!n) return;
  if (n.category !== treeView.category) treeView.category = n.category;
  ui.selected = id;
  saveUi();
  renderProgress();
  if (reveal) revealNode(id);
}

// ---------------------------------------------------------------- onglets
function currentTab(): Tab {
  const h = location.hash.replace("#", "") as Tab;
  return TABS.includes(h) ? h : "production";
}
function showTab(tab: Tab, focus = false): void {
  for (const t of TABS) {
    const on = t === tab;
    $(`panel-${t}`).hidden = !on;
    const link = $(`tab-${t}`);
    link.setAttribute("aria-selected", String(on));
    link.tabIndex = on ? 0 : -1;
    if (on && focus) link.focus();
  }
  document.body.classList.toggle("wide", tab === "recherche" || tab === "batiments");
  // Le canevas mesure son cadre : il faut le recaler quand l'onglet devient visible.
  if (tab === "recherche" && ui.view === "tree") renderResearchCanvas(null);
}
function bindTabs(): void {
  window.addEventListener("hashchange", () => showTab(currentTab()));
  $("tab-production").closest("nav")!.addEventListener("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== "ArrowRight" && k !== "ArrowLeft" && k !== "Home" && k !== "End") return;
    e.preventDefault();
    const i = TABS.indexOf(currentTab());
    const next = k === "Home" ? 0 : k === "End" ? TABS.length - 1 : (i + (k === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    history.replaceState(null, "", `#${TABS[next]}`);
    showTab(TABS[next]!, true);
  });
}

function bindResearchCanvas(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".seg [data-view]")) {
    b.addEventListener("click", () => {
      ui.view = b.dataset.view as "tree" | "list";
      saveUi();
      renderProgress();
    });
  }
  $("rs-canvas").addEventListener("click", (e) => {
    if (panzoom?.suppressClick) return;
    const g = (e.target as Element).closest<SVGGElement>("[data-rs]");
    if (g) selectNode(g.dataset.rs!, false);
  });
  $("rs-canvas").addEventListener("keydown", (e) => {
    const g = (e.target as Element).closest<SVGGElement>("[data-rs]");
    if (!g) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectNode(g.dataset.rs!, false);
    }
  });
  $("rs-canvas").addEventListener("focusin", (e) => {
    const g = (e.target as Element).closest<SVGGElement>("[data-rs]");
    if (g) revealNode(g.dataset.rs!);
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-zoom]")) {
    b.addEventListener("click", () => {
      const z = b.dataset.zoom;
      if (z === "in") panzoom?.zoom(1.25);
      else if (z === "out") panzoom?.zoom(1 / 1.25);
      else if (z === "fit") panzoom?.fit();
      else panzoom?.reset();
    });
  }
  // Bouton du canevas : même comportement que cocher/décocher (dialogue si prérequis ou dépendants).
  $("rs-hud-action").addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    if (btn.dataset.id) await toggleNode(btn.dataset.id, btn.dataset.unlocked !== "true");
  });
  $("rs-hud-action").addEventListener("pointerdown", (e) => e.stopPropagation()); // pas de glisser du canevas
  $("rs-detail").addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;
    const go = t.closest<HTMLElement>("[data-rs-goto]");
    if (go) return selectNode(go.dataset.rsGoto!);
    const act = t.closest<HTMLElement>("[data-rs-action]");
    if (!act) return;
    const id = act.dataset.id!;
    if (act.dataset.rsAction === "unlock-all") setProgress({ ...prog, unlocked: [...unlockUpTo(data, toEngineProgress(prog), id)] });
    else if (act.dataset.rsAction === "unlock-one") setProgress({ ...prog, unlocked: [...new Set([...prog.unlocked, id])] });
    else if (act.dataset.rsAction === "lock") await toggleNode(id, false);
  });
  // Description recopiée du jeu : gardée comme une correction (exportable avec les autres).
  $("rs-detail").addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>("form[data-rs-desc]");
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.rsDesc!;
    const text = (form.elements.namedItem("text") as HTMLTextAreaElement).value.trim();
    corrections = text ? setCorrection(corrections, "research", id, "description", text, "description recopiée du jeu") : removeCorrection(corrections, "research", id, "description");
    saveCorrections(corrections);
    rebuildData();
    render();
  });
  $("rs-detail").addEventListener("click", (e) => {
    const del = (e.target as HTMLElement).closest<HTMLElement>("[data-rs-desc-del]");
    if (!del) return;
    corrections = removeCorrection(corrections, "research", del.dataset.rsDescDel!, "description");
    saveCorrections(corrections);
    rebuildData();
    render();
  });
  $("rs-detail").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.req;
    if (id) setProgress({ ...prog, reqItemsDone: input.checked ? [...new Set([...prog.reqItemsDone, id])] : prog.reqItemsDone.filter((x) => x !== id) });
  });
}

function fillNodeList(): void {
  $("node-list").innerHTML = [...data.nodes.values()]
    .filter((n) => !n.isRoot)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((n) => `<option value="${esc(n.name)}">${esc(n.category)} · ${fmt(n.rp, 0)} RP</option>`)
    .join("");
}

function syncPlayerForm(): void {
  const set = (id: string, v: number | null) => {
    ($(id) as HTMLInputElement).value = v === null ? "" : String(v).replace(".", ",");
  };
  set("p-pollution", player.pollutionPct);
  set("p-money", player.money);
  const rp = currentRp(player);
  set("p-rp", rp === null ? null : Math.floor(rp));
  renderRpLive();
  set("p-rps", player.rpPerSec);
}

function setProgress(next: ProgressState): void {
  prog = next;
  saveProgress(prog);
  render();
}

const nodeName = (id: string) => data.nodes.get(id)?.name ?? id;

/** Petite boîte de dialogue : renvoie la valeur du bouton choisi ("" si fermée). */
function ask(title: string, bodyHtml: string, buttons: { value: string; label: string; primary?: boolean }[]): Promise<string> {
  const dlg = $("ask") as HTMLDialogElement;
  $("ask-title").textContent = title;
  $("ask-body").innerHTML = bodyHtml;
  $("ask-actions").innerHTML = buttons.map((b) => `<button value="${esc(b.value)}"${b.primary ? ` class="primary"` : ""}>${esc(b.label)}</button>`).join("");
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue), { once: true });
    dlg.returnValue = "";
    dlg.showModal();
    dlg.querySelector<HTMLButtonElement>("button.primary")?.focus();
  });
}

async function toggleNode(id: string, checked: boolean): Promise<void> {
  const p = toEngineProgress(prog);
  if (checked) {
    const missing = missingNodes(data, p, id).filter((x) => x !== id);
    let add = [id];
    if (missing.length) {
      const choice = await ask(
        "Prérequis non cochés",
        `<p><b>${esc(nodeName(id))}</b> demande ${missing.length} recherche(s) que tu n'as pas cochée(s) (${esc(fmtRP(rpCost(data, missing)))}) :</p><ul>${missing.map((x) => `<li>${esc(nodeName(x))}</li>`).join("")}</ul>`,
        [
          { value: "all", label: "Tout débloquer", primary: true },
          { value: "one", label: "Seulement celle-ci" },
          { value: "", label: "Annuler" },
        ],
      );
      if (!choice) return renderProgress();
      if (choice === "all") add = [...missing, id];
    }
    setProgress({ ...prog, unlocked: [...new Set([...prog.unlocked, ...add])] });
  } else {
    const deps = dependentsOf(data, p, id);
    let remove = [id];
    if (deps.length) {
      const choice = await ask(
        "Recherches qui en dépendent",
        `<p>${deps.length} recherche(s) cochée(s) dépendent de <b>${esc(nodeName(id))}</b> :</p><ul>${deps.map((x) => `<li>${esc(nodeName(x))}</li>`).join("")}</ul>`,
        [
          { value: "all", label: "Tout décocher", primary: true },
          { value: "one", label: "Seulement celle-ci" },
          { value: "", label: "Annuler" },
        ],
      );
      if (!choice) return renderProgress();
      if (choice === "all") remove = [id, ...deps];
    }
    setProgress({ ...prog, unlocked: prog.unlocked.filter((x) => !remove.includes(x)) });
  }
}

function bindProgress(): void {
  $("tree").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.node) void toggleNode(input.dataset.node, input.checked);
    else if (input.dataset.req) {
      const id = input.dataset.req;
      setProgress({ ...prog, reqItemsDone: input.checked ? [...new Set([...prog.reqItemsDone, id])] : prog.reqItemsDone.filter((x) => x !== id) });
    }
  });
  $("owned").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.owned;
    if (id) setProgress({ ...prog, owned: input.checked ? [...new Set([...prog.owned, id])] : prog.owned.filter((x) => x !== id) });
  });
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tabs [data-cat]")) {
    tab.addEventListener("click", () => {
      treeView.category = tab.dataset.cat as TreeView["category"];
      renderProgress();
    });
  }
  $("tree-filter").addEventListener("input", (e) => {
    treeView.filter = (e.target as HTMLInputElement).value;
    if (ui.view === "tree" && treeView.filter.trim()) {
      const first = [...data.nodes.values()].filter((n) => !n.isRoot && matchesFilter(n.id)).sort((a, b) => Number(b.category === treeView.category) - Number(a.category === treeView.category))[0];
      if (first) return selectNode(first.id);
    }
    renderProgress();
  });
  $("upto-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = ($("upto") as HTMLInputElement).value.trim().toLowerCase();
    const nodes = [...data.nodes.values()].filter((n) => !n.isRoot);
    const node = nodes.find((n) => n.name.toLowerCase() === text) ?? (text ? nodes.filter((n) => n.name.toLowerCase().includes(text)).at(0) : undefined);
    if (!node) {
      $("upto-hint").textContent = "Recherche introuvable : choisis un nom dans la liste.";
      return;
    }
    const before = new Set(prog.unlocked);
    const next = unlockUpTo(data, toEngineProgress(prog), node.id);
    const added = [...next].filter((x) => !before.has(x)).length;
    $("upto-hint").textContent = `${node.name} : ${added} recherche(s) cochée(s).`;
    treeView.category = node.category;
    ui.selected = node.id;
    saveUi();
    setProgress({ ...prog, unlocked: [...next] });
    if (ui.view === "tree") revealNode(node.id);
  });
  $("progress-reset").addEventListener("click", async () => {
    const choice = await ask("Réinitialiser la progression", "<p>Décocher toutes les recherches et toutes les machines possédées ?</p>", [
      { value: "yes", label: "Réinitialiser", primary: true },
      { value: "", label: "Annuler" },
    ]);
    if (choice === "yes") setProgress({ unlocked: [], reqItemsDone: [], owned: [] });
  });

  // Transférer la progression (autre adresse, autre appareil)
  $("progress-export").addEventListener("click", () => {
    const file = exportProgress(prog, player);
    downloadJson(file, `progression-industrialist-${file.exportedAt.slice(0, 10)}.json`);
    $("progress-io-hint").textContent = "Fichier exporté.";
  });
  $("progress-import").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    let parsed: ReturnType<typeof parseProgressExport>;
    try {
      parsed = parseProgressExport(data, JSON.parse(await file.text()));
    } catch {
      parsed = { ok: false, error: "fichier illisible (JSON attendu)" };
    }
    if (!parsed.ok) {
      $("progress-io-hint").textContent = `Import impossible : ${parsed.error}.`;
      return;
    }
    const when = parsed.exportedAt ? ` (exporté le ${new Date(parsed.exportedAt).toLocaleString("fr-FR")})` : "";
    const choice = await ask(
      "Importer une progression",
      `<p>Remplacer ta progression actuelle (${prog.unlocked.length} recherche(s) cochée(s)) par celle du fichier${esc(when)} : <b>${parsed.progress.unlocked.length}</b> recherche(s), ${parsed.progress.owned.length} machine(s) possédée(s), et les informations de « Ma partie » ?</p>${
        parsed.dropped ? `<p class="hint">${parsed.dropped} élément(s) inconnu(s) des données actuelles seront ignorés.</p>` : ""
      }`,
      [
        { value: "yes", label: "Remplacer", primary: true },
        { value: "", label: "Annuler" },
      ],
    );
    if (choice !== "yes") return;
    player = parsed.player;
    savePlayer(player);
    syncPlayerForm();
    setProgress(parsed.progress);
    $("progress-io-hint").textContent = `Progression importée : ${parsed.progress.unlocked.length} recherche(s).`;
  });

  const playerFields: [string, keyof PlayerInfo][] = [
    ["p-pollution", "pollutionPct"],
    ["p-money", "money"],
    ["p-rp", "rp"],
    ["p-rps", "rpPerSec"],
  ];
  for (const [id, key] of playerFields) {
    $(id).addEventListener("input", (e) => {
      const v = parseOptional((e.target as HTMLInputElement).value);
      $(id).setAttribute("aria-invalid", String(v === "invalide"));
      $("player-hint").textContent = v === "invalide" ? "Nombre attendu (ou laisse vide)." : "";
      if (v === "invalide") return;
      if (key === "rpPerSec") player = withRpRate(player, v);
      else if (key === "rp") player = { ...player, rp: v, rpAt: v === null ? null : Date.now() };
      else player = { ...player, [key]: v };
      savePlayer(player);
      renderRpLive();
      renderSoon();
    });
  }

  // Production déjà en place : ajout, modification, retrait (réglage et plan).
  $("existing-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("item") as HTMLInputElement).value;
    const id = resolveItem(name);
    const v = parseFloat((form.elements.namedItem("rate") as HTMLInputElement).value.replace(",", "."));
    if (!id) return void ($("existing-hint").textContent = "Item introuvable : choisis un nom dans la liste.");
    if (!(v > 0)) return void ($("existing-hint").textContent = "Indique un débit positif, par minute.");
    $("existing-hint").textContent = "";
    form.reset();
    addExisting(id, v);
  });
  $("existing-list").addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const id = t.dataset.existingRate;
    const v = parseFloat(t.value.replace(",", "."));
    if (!id || !(v > 0)) return;
    settings.existing = { ...settings.existing, [id]: v };
    renderSoon();
  });
  document.querySelector(".wrap")!.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const del = t.closest<HTMLElement>("[data-existing-del]");
    if (del) {
      const { [del.dataset.existingDel!]: _, ...rest } = settings.existing;
      settings.existing = rest;
      render();
      return;
    }
    const have = t.closest<HTMLElement>("[data-have]");
    if (have) addExisting(have.dataset.have!, Number(have.dataset.amount) > 0 ? Number(have.dataset.amount) : 1);
  });

  // Boutons du plan : « Je les ai débloquées », « Je la possède »
  document.querySelector(".wrap")!.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-unlock], button[data-own]");
    if (!btn) return;
    if (btn.dataset.unlock) {
      let next = new Set(prog.unlocked);
      for (const id of btn.dataset.unlock.split(",")) next = unlockUpTo(data, { ...toEngineProgress(prog), unlocked: next }, id);
      setProgress({ ...prog, unlocked: [...next] });
    } else if (btn.dataset.own) {
      setProgress({ ...prog, owned: [...new Set([...prog.owned, ...btn.dataset.own.split(",")])] });
    }
  });
}

/** Propose un fichier JSON au téléchargement. */
function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value, null, 1) + "\n"], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

let timer: number | undefined;
/** Liste « Production déjà en place » du réglage. */
function renderExisting(): void {
  const entries = Object.entries(settings.existing);
  $("existing-count").textContent = entries.length ? String(entries.length) : "";
  const used = new Map((plan?.existing ?? []).map((x) => [x.item, x.used]));
  $("existing-list").innerHTML = entries
    .map(([id, v]) => {
      const name = data.items.get(id)?.name ?? id;
      const u = used.get(id);
      return `<li><span class="name">${esc(name)}</span>
        <label class="sr-only" for="ex-${esc(id)}">Débit de ${esc(name)}</label>
        <input id="ex-${esc(id)}" type="number" min="0.01" step="any" inputmode="decimal" data-existing-rate="${esc(id)}" value="${v}"> /min
        <span class="hint">${u === undefined ? "pas utilisé par ce plan" : `${fmt(u, 2)}/min utilisés`}</span>
        <button type="button" class="link" data-existing-del="${esc(id)}" aria-label="Retirer ${esc(name)}">retirer</button></li>`;
    })
    .join("");
}

/** « Ma partie » : RP estimés maintenant, d'après les RP/s. */
function renderRpLive(): void {
  const rp = currentRp(player);
  $("rp-live").textContent =
    rp !== null && player.rpPerSec && player.rpAt !== null
      ? `≈ ${fmtRP(rp)} maintenant : ${fmtRP(player.rp)} saisis le ${new Date(player.rpAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}, + ${fmt(player.rpPerSec, 2)} RP/s depuis. Estimation : si ta production de RP change en jeu, corrige-la ici.`
      : "";
}

/** Les RP montent tout seuls : affichage rafraîchi, et l'arbre ou le plan quand ça change quelque chose. */
let rpSignature = "";
let lastRpPlanRender = 0;
function tickRp(): void {
  if (player.rp === null || !player.rpPerSec || player.rpAt === null) return;
  const rp = currentRp(player)!;
  const input = $("p-rp") as HTMLInputElement;
  if (document.activeElement !== input) input.value = String(Math.floor(rp));
  renderRpLive();
  // Recherches qui deviennent abordables : l'arbre change de couleur.
  const sig = [...data.nodes.values()].filter((n) => !n.isRoot && n.rp <= rp).length.toString();
  const tab = currentTab();
  if (sig !== rpSignature) {
    rpSignature = sig;
    if (tab === "recherche") renderProgress();
  }
  // Temps restant pour les RP du plan : au plus toutes les 30 s.
  if (tab === "production" && (plan?.economy.rpNeeded ?? 0) > 0 && Date.now() - lastRpPlanRender > 30_000) {
    lastRpPlanRender = Date.now();
    render();
  }
}

/** Ajoute (ou met à jour) une production existante, puis ouvre la liste sur elle. */
function addExisting(id: string, perMin: number): void {
  settings.existing = { ...settings.existing, [id]: perMin };
  render();
  ($("existing-box") as HTMLDetailsElement).open = true;
  const input = document.getElementById(`ex-${id}`) as HTMLInputElement | null;
  input?.focus();
  input?.select();
}

function renderSoon(): void {
  clearTimeout(timer);
  timer = window.setTimeout(render, 120);
}

// ---------------------------------------------------------------- événements
function bind(): void {
  const itemInput = $("item") as HTMLInputElement;
  const onItem = () => {
    const id = resolveItem(itemInput.value);
    $("item-hint").textContent = id ? "" : itemInput.value.trim() ? "Item introuvable : choisis un nom dans la liste." : "";
    if (id && id !== settings.item) {
      settings.item = id;
      render();
    }
  };
  itemInput.addEventListener("change", onItem);
  itemInput.addEventListener("input", () => {
    if (byName.has(itemInput.value.trim().toLowerCase())) onItem();
  });

  $("rate").addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value.replace(",", "."));
    if (v > 0) {
      settings.mode = "rate";
      settings.rate = v;
      renderSoon();
    }
  });
  $("machines").addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value.replace(",", "."));
    if (v > 0) {
      settings.mode = "machines";
      settings.machines = v;
      renderSoon();
    }
  });
  $("criterion").addEventListener("change", (e) => {
    settings.criterion = (e.target as HTMLSelectElement).value as Settings["criterion"];
    render();
  });
  $("unverified").addEventListener("change", (e) => {
    settings.useUnverified = (e.target as HTMLInputElement).checked;
    render();
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-goal]")) {
    b.addEventListener("click", () => {
      settings.goal = b.dataset.goal as Settings["goal"];
      render();
    });
  }
  $("money").addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value.replace(",", "."));
    if (v > 0) {
      settings.money = v;
      renderSoon();
    }
  });
  $("max-pollution").addEventListener("input", (e) => {
    const raw = (e.target as HTMLInputElement).value.trim().replace(",", ".");
    const v = parseFloat(raw);
    if (!raw) settings.maxPollution = null;
    else if (v >= 0) settings.maxPollution = v;
    else return;
    renderSoon();
  });
  $("self-powered").addEventListener("change", (e) => {
    settings.selfPowered = (e.target as HTMLInputElement).checked;
    render();
  });
  $("use-budget").addEventListener("change", (e) => {
    settings.useBudget = (e.target as HTMLInputElement).checked;
    render();
  });
  // Paliers ronds : un clic adopte ce débit.
  $("stats").addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-tier]");
    if (!b) return;
    const v = Number(b.dataset.tier);
    if (!(v > 0)) return;
    const final = Number(b.dataset.final);
    if (settings.goal === "argent") settings.money = Math.round(v * 100) / 100;
    else if (final > 0) {
      // Palier sur un nombre entier de machines finales : calcul exact par ce nombre.
      settings.mode = "machines";
      settings.machines = final;
    } else {
      settings.mode = "rate";
      settings.rate = v;
    }
    syncForm();
    render();
  });
  $("forced-reset").addEventListener("click", () => {
    settings.forced = {};
    render();
  });

  // Forcer une recette (menu sur chaque étape du plan)
  $("plan").addEventListener("change", (e) => {
    const sel = e.target as HTMLSelectElement;
    const item = sel.dataset.force;
    if (!item) return;
    if (sel.value) settings.forced = { ...settings.forced, [item]: sel.value };
    else {
      const { [item]: _, ...rest } = settings.forced;
      settings.forced = rest;
    }
    render();
    document.getElementById(`step-${item}`)?.querySelector("select")?.focus();
  });

  // Saisie d'une valeur relevée en jeu
  $("verify").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const { scope, id, field } = form.dataset as { scope: Scope; id: string; field: string };
    const raw = (form.elements.namedItem("value") as HTMLInputElement).value;
    const parsed = parseInput(field, raw);
    const err = form.querySelector(".fix-error")!;
    if (!parsed.ok) {
      err.textContent = parsed.error;
      return;
    }
    corrections = setCorrection(corrections, scope, id, field, parsed.value);
    saveCorrections(corrections);
    rebuildData();
    render();
  });
  $("corrections").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove]");
    if (!btn) return;
    const [scope, id, field] = btn.dataset.remove!.split("|") as [Scope, string, string];
    corrections = removeCorrection(corrections, scope, id, field);
    saveCorrections(corrections);
    rebuildData();
    render();
  });
  $("export").addEventListener("click", () => downloadJson(mergeCorrections(repoOverrides, corrections), "overrides.json"));
  $("import").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isOverridesFile(parsed)) throw new Error("format inattendu");
      corrections = mergeCorrections(corrections, parsed);
      saveCorrections(corrections);
      rebuildData();
      render();
    } catch (err) {
      $("data-errors").innerHTML = `<div class="banner bad">Import impossible : ${esc((err as Error).message)}</div>`;
    }
  });
  $("clear-corrections").addEventListener("click", () => {
    if (!countCorrections(corrections)) return;
    if (!confirm("Effacer toutes tes corrections locales ? (Pense à les exporter avant.)")) return;
    corrections = {};
    saveCorrections(corrections);
    rebuildData();
    render();
  });
}

rebuildData();
if (!data.items.has(settings.item)) settings.item = "crankshaft";
prog = sanitizeProgress(data, prog);
fillItemList();
fillNodeList();
syncForm();
syncPlayerForm();
bind();
bindProgress();
bindTabs();
bindResearchCanvas();
initBuildings($("bld-root"), data, portsJson as unknown as PortsFile);
// Première visite (aucune recherche cochée) : on commence par l'onglet Recherche.
if (!location.hash && !prog.unlocked.length) history.replaceState(null, "", "#recherche");
render();
showTab(currentTab());
window.setInterval(tickRp, 5000);
