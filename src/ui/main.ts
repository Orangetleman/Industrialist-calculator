// Point d'entrée de l'interface : charge les données, route entre les pages (accueil, une page
// par objectif, Mon usine, arbre, données), appelle solve() et affiche le résultat. Toute la
// logique de calcul est dans src/engine ; le rendu du plan dans plan-view.ts.

import "../styles.css";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import portsJson from "../../data/ports.json";
import logisticsJson from "../../data/logistics.json";
import energyJson from "../../data/energy.json";
import stationsJson from "../../data/research-stations.json";
import powerJson from "../../data/power.json";
import { buildGameData, type GameData, type RawFiles } from "../engine/data.ts";
import { solve, type Plan, type PlayerState } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import type { EnergyFile, LogisticsFile, PortsFile, PowerFile, ResearchStationsFile } from "../engine/extension-types.ts";
import { designResearch, rpParams, unlockTimeline, type RpResult } from "../engine/research-points.ts";
import { dependentsOf, missingNodes, rpCost, unlockUpTo } from "../engine/unlock.ts";
import { esc, fmt, fmtMoney, fmtMoneyShort, fmtRP, fmtShort, parseInput } from "./format.ts";
import {
  currentRp,
  exportProgress,
  loadPlayer,
  loadProgress,
  parseOptional,
  parseProgressExport,
  progressSummary,
  renderOwned,
  renderTree,
  rpDelta,
  sanitizeProgress,
  savePlayer,
  saveProgress,
  toEngineProgress,
  withRpRate,
  type PlayerInfo,
  type ProgressState,
  type TreeView,
} from "./progress.ts";
import { PanZoom } from "./canvas.ts";
import { initBuildings } from "./buildings.ts";
import { layoutResearch, RN_H, RN_W, type ResearchLayout } from "./research-layout.ts";
import { renderNodeDetail, renderResearchSvg } from "./research-view.ts";
import type { ResearchView } from "./research-plan.ts";
import { renderCorrections, renderVerify } from "./render.ts";
import { buildRows, buildSignature, criterionHint, CRITERION_TEXT, planLabel, renderAnswer, renderBuildList, renderDetails, renderFlow, type BuildRow, type ViewCtx } from "./plan-view.ts";
import {
  builtFor,
  countCorrections,
  CRITERIA,
  isOverridesFile,
  loadBuilt,
  loadCorrections,
  loadSettings,
  mergeCorrections,
  pruneIntegratedCorrections,
  removeCorrection,
  saveBuilt,
  saveCorrections,
  saveSettings,
  setBuilt,
  setCorrection,
  type Goal,
  type ResultTab,
  type Scope,
  type Settings,
} from "./state.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles;
/** Poteaux de transport d'énergie (réseau de l'objectif énergie). */
const POLES = (powerJson as unknown as PowerFile).entries
  .filter((e) => e.subcategory === "Transfer Poles" && e.transfer)
  .map((e) => ({ id: e.id, name: e.name, perNodeMFps: e.transfer!.perNode, nodes: e.transfer!.nodes, rangeTiles: e.rangeTiles?.tiles ?? null }));
const ENERGY_FILE = energyJson as unknown as EnergyFile;
const RP_PARAMS = rpParams(stationsJson as unknown as ResearchStationsFile);
const repoOverrides = overridesJson as unknown as OverridesFile;
/** Dépôts de vente (objectif argent) : débit de vente relevé ou lu sur le wiki. */
const DEPOTS = (logisticsJson as unknown as LogisticsFile).depots.map((d) => ({ id: d.id, name: d.name, kind: d.kind, itemsPerSec: d.itemsPerSec }));

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);

// ---------------------------------------------------------------- état

let settings: Settings = loadSettings();
// Corrections locales déjà intégrées aux données (même date) : la copie locale est retirée.
const prunedCorrections = pruneIntegratedCorrections(loadCorrections(), repoOverrides);
let corrections: OverridesFile = prunedCorrections.kept;
if (prunedCorrections.dropped) saveCorrections(corrections);
let data: GameData = buildGameData(files, []).data;
let dataErrors: string[] = [];
let prog: ProgressState = loadProgress();
let player: PlayerInfo = loadPlayer();
let built = loadBuilt();
const treeView: TreeView = { category: "Production", filter: "" };

/** Dernier calcul (recalculé seulement quand un réglage, la progression ou les données changent). */
let plan: Plan | undefined;
let rpView: ResearchView | null = null;
let planDirty = true;
let rows: BuildRow[] = [];
let signature = "";

const KEY_UI = "ind-calc:v1:ui";
let ui: { view: "tree" | "list"; selected: string | null; dataTab: "verifier" | "batiments" } = { view: "tree", selected: null, dataTab: "verifier" };
try {
  const raw = JSON.parse(localStorage.getItem(KEY_UI) ?? "null");
  if (raw && typeof raw === "object") {
    ui = {
      view: raw.view === "list" ? "list" : "tree",
      selected: typeof raw.selected === "string" ? raw.selected : null,
      dataTab: raw.dataTab === "batiments" ? "batiments" : "verifier",
    };
  }
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

function rebuildData(): void {
  const r = buildGameData(files, [repoOverrides, corrections]);
  data = r.data;
  dataErrors = r.errors;
  layouts.clear();
}

function playerState(): PlayerState {
  return { ...toEngineProgress(prog), ...player, rp: currentRp(player) };
}

const nodeName = (id: string) => data.nodes.get(id)?.name ?? id;
const itemName = (id: string) => data.items.get(id)?.name ?? id;

// ---------------------------------------------------------------- pages et adresses

type Page = "accueil" | "plan" | "usine" | "arbre" | "donnees";
const PAGES: Page[] = ["accueil", "plan", "usine", "arbre", "donnees"];
const GOAL_ROUTE: Record<Goal, string> = { objet: "objet", énergie: "energie", recherche: "rp", argent: "argent" };
const ROUTE_GOAL: Record<string, Goal> = { objet: "objet", energie: "énergie", rp: "recherche", argent: "argent" };
const GOAL_TITLE: Record<Goal, string> = { objet: "Produire un objet", énergie: "Produire de l'énergie", recherche: "Gagner des points de recherche", argent: "Gagner de l'argent" };
/** Adresses d'avant la refonte. */
const OLD_ROUTES: Record<string, string> = { production: "", recherche: "arbre", verifier: "donnees", batiments: "donnees", partie: "usine" };

function currentPage(): Page {
  const h = decodeURIComponent(location.hash.replace("#", ""));
  if (ROUTE_GOAL[h]) return "plan";
  return (PAGES as string[]).includes(h) && h !== "plan" ? (h as Page) : "accueil";
}

/** Lit l'adresse : objectif choisi, anciennes adresses redirigées. */
function readRoute(): void {
  const h = decodeURIComponent(location.hash.replace("#", ""));
  if (h in OLD_ROUTES) {
    if (h === "batiments") ui.dataTab = "batiments";
    if (h === "verifier") ui.dataTab = "verifier";
    history.replaceState(null, "", `#${OLD_ROUTES[h] || GOAL_ROUTE[settings.goal]}`);
  }
  const goal = ROUTE_GOAL[decodeURIComponent(location.hash.replace("#", ""))];
  if (goal && goal !== settings.goal) {
    settings.goal = goal;
    planDirty = true;
  }
}

let lastPage: Page | null = null;
function showPage(): void {
  readRoute();
  const page = currentPage();
  for (const p of PAGES) $(`page-${p}`).hidden = p !== page;
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
    if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.body.classList.toggle("wide", page === "arbre" || (page === "donnees" && ui.dataTab === "batiments"));
  if (page !== lastPage) window.scrollTo(0, 0);
  lastPage = page;
  const titles: Record<Page, string> = { accueil: "", plan: GOAL_TITLE[settings.goal], usine: "Mon usine", arbre: "Arbre de recherche", donnees: "Données" };
  document.title = titles[page] ? `${titles[page]} — Calculateur de production` : "Calculateur de production";
  render();
}

// ---------------------------------------------------------------- calcul

/** Objectif recherche : recherches visées, vitesse et plafond nécessaires, installation, chronologie. */
function computeResearch(): ResearchView | null {
  if (!RP_PARAMS) return null;
  const ps = playerState();
  const p = toEngineProgress(prog);
  const rp0 = ps.rp ?? 0;
  const current = settings.rpCurrent && player.rpPerSec ? player.rpPerSec : 0;
  let nodes: string[] = [];
  if (settings.rpMode === "node" && settings.rpNode) nodes = missingNodes(data, p, settings.rpNode);
  if (settings.rpMode === "plan") {
    const itemPlan = solve(data, ps, {
      item: settings.item,
      ...(settings.mode === "rate" ? { ratePerMin: settings.rate } : { finalMachines: settings.machines }),
      criterion: settings.criteria.objet,
      forced: settings.forced,
      useUnverified: settings.useUnverified,
      tiers: false,
    });
    nodes = itemPlan.economy.nodesToUnlock;
  }
  const costs = nodes.map((id) => ({ id, rp: data.nodes.get(id)?.rp ?? 0 }));
  const remaining = [...data.nodes.values()].filter((n) => !n.isRoot && !n.startUnlocked && !p.unlocked.has(n.id));
  const capNeeded = settings.rpCap ?? (settings.rpMode === "rate" ? Math.max(0, ...remaining.map((n) => n.rp)) : Math.max(0, ...costs.map((c) => c.rp)));
  const total = costs.reduce((s, c) => s + c.rp, 0);
  const wanted = settings.rpMode === "rate" ? settings.rpRate : Math.max(0, total - rp0) / (settings.rpMinutes * 60);
  const targetRate = Math.max(0, wanted - current);
  const result: RpResult =
    targetRate > 0 || settings.rpMode === "rate"
      ? designResearch(data, ps, RP_PARAMS, {
          targetRate: Math.max(targetRate, 1e-6),
          capNeeded,
          satellites: settings.rpSatellites,
          logic: settings.rpLogic,
          criterion: settings.criteria.recherche,
          useUnverified: settings.useUnverified,
          selfPowered: settings.selfPowered,
          existing: settings.useExisting ? settings.existing : {},
        })
      : {
          best: null,
          others: [],
          warnings: [
            settings.rpMode === "node" && !settings.rpNode
              ? "Choisis la recherche à débloquer."
              : !nodes.length
                ? "Rien à débloquer : c'est déjà fait."
                : total <= rp0
                  ? "Tu as déjà assez de RP pour tout débloquer."
                  : "Ta production actuelle de RP suffit pour ce délai.",
          ],
        };
  const d = result.best?.design;
  const kind = d?.kind ?? "rs2";
  const timeline = d ? unlockTimeline(costs, rp0, d.rate + current, d.cap, kind) : null;
  const timelineNow = current > 0 ? unlockTimeline(costs, rp0, current, Infinity, kind) : null;
  return { ...result, nodes, capNeeded, targetRate, timeline, timelineNow, currentRate: current || null };
}

function ensurePlan(): void {
  if (!planDirty && plan) return;
  planDirty = false;
  const goal = settings.goal;
  rpView = goal === "recherche" ? computeResearch() : null;
  if (goal === "recherche") {
    plan = rpView?.best?.plan ?? solve(data, playerState(), { item: "", demands: {}, tiers: false });
    return;
  }
  const request = (target: Partial<Parameters<typeof solve>[2]>) =>
    solve(data, playerState(), {
      item: settings.item,
      ...target,
      poles: POLES,
      distanceTiles: settings.distanceTiles,
      criterion: settings.criteria[goal],
      forced: settings.forced,
      useUnverified: settings.useUnverified,
      selfPowered: settings.selfPowered,
      maxPollution: settings.maxPollution,
      budget: settings.useBudget && player.money !== null ? player.money : null,
      depots: DEPOTS,
      existing: settings.useExisting ? Object.fromEntries(Object.entries(settings.existing).filter(([id]) => data.items.has(id))) : {},
    });
  plan = request(
    goal === "argent"
      ? { moneyPerMin: settings.money }
      : goal === "énergie"
        ? { energyMFps: settings.energyMFps, guaranteedEnergy: settings.energyGuaranteed, noFuel: settings.energyNoFuel }
        : settings.mode === "rate"
          ? { ratePerMin: settings.rate }
          : { finalMachines: settings.machines },
  );
  // N machines finales impossibles à convertir (aucune recette utilisable) : on calcule au débit
  // pour pouvoir dire ce qui manque, plutôt qu'un message technique.
  if (goal === "objet" && settings.mode === "machines" && plan.warnings.some((w) => w.code === "machines-finales")) plan = request({ ratePerMin: settings.rate });
}

function viewCtx(): ViewCtx {
  ensurePlan();
  return { data, plan: plan!, settings, corrections, goal: settings.goal, research: rpView, fresh: isFresh() };
}

/** Un réglage, la progression, « Mon usine » ou les données ont changé : recalcul puis affichage. */
function update(): void {
  planDirty = true;
  saveSettings(settings);
  render();
}

let timer: number | undefined;
function updateSoon(): void {
  clearTimeout(timer);
  timer = window.setTimeout(update, 150);
}

// ---------------------------------------------------------------- rendu

function render(): void {
  renderHeader();
  const page = currentPage();
  if (page === "accueil") renderHome();
  else if (page === "plan") renderPlanPage();
  else if (page === "usine") renderUsine();
  else if (page === "arbre") renderTreePage();
  else renderData();
}

const researchTotal = () => [...data.nodes.values()].filter((n) => !n.isRoot).length;
const unlockedCount = () => [...data.nodes.values()].filter((n) => !n.isRoot && (n.startUnlocked || prog.unlocked.includes(n.id))).length;
const isFresh = () => !prog.unlocked.length && player.money === null && player.rp === null;

/** Barre du haut : où en est le joueur, en bref (cliquable vers « Mon usine »). */
function renderHeader(): void {
  $<HTMLAnchorElement>("nav-plan").href = `#${GOAL_ROUTE[settings.goal]}`;
  if (isFresh()) {
    $("me").innerHTML = `<a class="me-chip cta" href="#usine">Renseigner mon usine</a>`;
    return;
  }
  const rp = currentRp(player);
  const chips = [
    `<a class="me-chip" href="#usine" title="Recherches débloquées">${unlockedCount()}/${researchTotal()} recherches</a>`,
    rp !== null ? `<a class="me-chip" href="#usine" title="RP disponibles (estimés)">≈ ${esc(fmtShort(rp))} RP${player.rpPerSec ? ` · ${esc(fmt(player.rpPerSec, 1))}/s` : ""}</a>` : "",
    player.money !== null ? `<a class="me-chip" href="#usine" title="Argent">${esc(fmtMoneyShort(player.money))}</a>` : "",
  ];
  $("me").innerHTML = chips.join("");
}

function renderHome(): void {
  $("first-visit").hidden = !isFresh();
}

// ---------------------------------------------------------------- page d'un objectif

function syncForm(): void {
  const set = (id: string, v: string) => {
    if (document.activeElement !== $(id)) input(id).value = v;
  };
  set("item", data.items.get(settings.item)?.name ?? settings.item);
  $<HTMLSelectElement>("qty-unit").value = settings.mode;
  // Affichage arrondi ; le réglage garde la valeur exacte (un palier tombe juste).
  set("qty", settings.mode === "rate" ? String(Number(settings.rate.toFixed(4))) : String(settings.machines));
  set("money", String(settings.money));
  $<HTMLSelectElement>("energy-unit").value = settings.energyUnit;
  set("energy", String(Number((settings.energyMFps / (settings.energyUnit === "M" ? 1e6 : 1e3)).toFixed(4))));
  $<HTMLSelectElement>("energy-mode").value = settings.energyGuaranteed ? "garantie" : "moyenne";
  input("no-fuel").checked = settings.energyNoFuel;
  set("distance", settings.distanceTiles === null ? "" : String(settings.distanceTiles));
  $<HTMLSelectElement>("rp-mode").value = settings.rpMode;
  set("rp-rate", String(settings.rpRate));
  set("rp-node", settings.rpNode ? nodeName(settings.rpNode) : "");
  set("rp-minutes", String(settings.rpMinutes));
  set("rp-cap", settings.rpCap === null ? "" : String(settings.rpCap));
  input("rp-satellites").checked = settings.rpSatellites;
  input("rp-logic").checked = settings.rpLogic;
  input("rp-current").checked = settings.rpCurrent;
  set("max-pollution", settings.maxPollution === null ? "" : String(settings.maxPollution));
  input("self-powered").checked = settings.selfPowered;
  input("use-budget").checked = settings.useBudget;
  input("use-existing").checked = settings.useExisting;
  input("unverified").checked = settings.useUnverified;
}

function renderPlanPage(): void {
  const v = viewCtx();
  const goal = settings.goal;
  $("plan-title").textContent = GOAL_TITLE[goal];
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".goalnav [data-goal]")) {
    if (a.dataset.goal === goal) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  for (const el of document.querySelectorAll<HTMLElement>("#query [data-goals]")) el.hidden = !el.dataset.goals!.split(" ").includes(goal);
  $("rp-rate-label").hidden = goal !== "recherche" || settings.rpMode !== "rate";
  $("rp-node-label").hidden = goal !== "recherche" || settings.rpMode !== "node";
  $("rp-minutes-label").hidden = goal !== "recherche" || settings.rpMode === "rate";
  syncForm();

  // Priorité : seulement celles qui ont un sens pour cet objectif, avec ce qu'elle fait.
  const crit = $<HTMLSelectElement>("criterion");
  const options = CRITERIA[goal];
  if (crit.dataset.goal !== goal) {
    crit.innerHTML = options.map((c) => `<option value="${c}">${esc(CRITERION_TEXT[c].label)}</option>`).join("");
    crit.dataset.goal = goal;
  }
  crit.value = settings.criteria[goal];
  $("criterion-hint").textContent = criterionHint(goal, settings.criteria[goal]);

  // Textes d'aide propres à l'objectif.
  const existingN = Object.keys(settings.existing).length;
  $("budget-hint").textContent = player.money === null ? "(renseigne ton argent dans Mon usine)" : `(${fmtMoney(player.money)})`;
  $("existing-hint-plan").innerHTML = existingN ? `(${existingN} production${existingN > 1 ? "s" : ""} dans <a href="#usine">Mon usine</a>)` : `(aucune pour l'instant : <a href="#usine">Mon usine</a>)`;
  $("rp-current-hint").textContent = player.rpPerSec ? `(${fmt(player.rpPerSec, 2)} RP/s dans Mon usine)` : "(renseigne-la dans Mon usine)";
  let goalHint = "";
  if (goal === "recherche" && settings.rpMode === "plan") {
    goalHint = `Plan d'objet utilisé : ${esc(settings.mode === "rate" ? `${fmt(settings.rate, 2)} ${itemName(settings.item)}/min` : `${settings.machines} machines finales de ${itemName(settings.item)}`)} — <a href="#objet">le changer</a>.`;
  }
  $("goal-hint").innerHTML = goalHint;
  $("adv-note").textContent =
    goal === "énergie"
      ? `Centrales comparées : thermiques (Firebox, Gas Burner), générateurs à combustible, solaire (avec batteries pour la production garantie), éolien. Non calculées faute de données : ${ENERGY_FILE.notComputed.map((n) => data.machines.get(n.machine)?.name ?? n.machine).join(", ")}.`
      : goal === "recherche" && rpView
        ? `Plafond : ${settings.rpCap === null ? `automatique, ${settings.rpMode === "rate" ? "la recherche la plus chère qu'il te reste" : "la recherche visée la plus chère"} (${fmtRP(rpView.capNeeded)})` : fmtRP(settings.rpCap)}.`
        : "";
  // Options avancées actives (visibles pour cet objectif).
  const adv = [...document.querySelectorAll<HTMLInputElement>("#advanced input")].filter((i) => {
    const label = i.closest<HTMLElement>("[data-goals]");
    if (label?.hidden) return false;
    if (i.id === "use-existing" && !existingN) return false;
    return i.type === "checkbox" ? i.checked : i.value.trim() !== "";
  }).length;
  $("adv-count").textContent = adv ? `(${adv} activée${adv > 1 ? "s" : ""})` : "(aucune activée)";

  $("answer").innerHTML = renderAnswer(v);
  rows = buildRows(v);
  signature = buildSignature(goal, rows);
  renderBuild();
  renderResultTabs();
}

function renderBuild(): void {
  $("build").innerHTML = renderBuildList(viewCtx(), rows, builtFor(built, signature));
}

function renderResultTabs(): void {
  const tab = settings.resultTab;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-rtab]")) {
    const on = b.dataset.rtab === tab;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  for (const t of ["liste", "schema", "details"] as ResultTab[]) $(`rpanel-${t}`).hidden = t !== tab;
  if (tab === "schema") renderFlowCanvas();
  if (tab === "details") $("details").innerHTML = renderDetails(viewCtx());
}

// Schéma : cadre navigable comme l'arbre de recherche.
let flowPZ: PanZoom | null = null;
let flowKey = "";
/** Échelle de départ : tout voir si c'est lisible, sinon assez grand pour lire (calé à gauche). */
const FLOW_MIN_SCALE = 0.6;
function flowStartScale(frame: { w: number; h: number }, content: { w: number; h: number }): number {
  return Math.max(FLOW_MIN_SCALE, Math.min(1, frame.w / content.w, frame.h / content.h));
}
function renderFlowCanvas(): void {
  const f = renderFlow(viewCtx());
  const canvas = $("flow-canvas");
  const frame = $("flow-frame");
  frame.classList.toggle("empty", !f);
  if (!f) {
    canvas.innerHTML = `<p class="flow-empty">Rien à afficher : aucune étape dans ce plan.</p>`;
    frame.style.height = "";
    return;
  }
  canvas.innerHTML = f.svg;
  // Hauteur du cadre : le schéma à l'échelle de départ, entre 240 px et 70 % de l'écran.
  const fw = frame.clientWidth || 800;
  const s = flowStartScale({ w: fw, h: window.innerHeight * 0.7 }, { w: f.width, h: f.height });
  frame.style.height = `${Math.round(Math.min(window.innerHeight * 0.7, Math.max(240, f.height * s + 8)))}px`;
  flowPZ ??= new PanZoom(frame, {
    minWidth: 150,
    initialView: (fr, c) => {
      const k = flowStartScale(fr, c);
      const w = fr.w / k;
      const h = fr.h / k;
      // Tout tient : centré. Sinon : calé à gauche (l'extraction), centré en hauteur.
      return { x: w >= c.w ? (c.w - w) / 2 : 0, y: (c.h - h) / 2, w, h };
    },
  });
  flowPZ.attach(canvas.querySelector("svg")!, f.width, f.height, signature === flowKey);
  flowKey = signature;
}

// ---------------------------------------------------------------- Mon usine

function renderUsine(): void {
  const p = toEngineProgress(prog);
  $("progress-summary").textContent = progressSummary(data, p);
  $("progress-meter").style.width = `${Math.round((unlockedCount() / Math.max(1, researchTotal())) * 100)}%`;
  $("owned").innerHTML = renderOwned(data, p);
  syncPlayerForm();
  renderExisting();
}

function syncPlayerForm(): void {
  const set = (id: string, v: number | null) => {
    if (document.activeElement !== $(id)) input(id).value = v === null ? "" : String(v).replace(".", ",");
  };
  set("p-pollution", player.pollutionPct);
  set("p-money", player.money);
  const rp = currentRp(player);
  set("p-rp", rp === null ? null : Math.floor(rp));
  set("p-rps", player.rpPerSec);
  input("p-spend").checked = player.spendRp;
  input("p-gamepass").checked = player.gamePass;
  renderRpLive();
}

/** RP estimés maintenant, d'après les RP/s. */
function renderRpLive(): void {
  const rp = currentRp(player);
  $("rp-live").textContent =
    rp !== null && player.rpPerSec && player.rpAt !== null
      ? `≈ ${fmtRP(rp)} maintenant : ${fmtRP(player.rp)} saisis le ${new Date(player.rpAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}, + ${fmt(player.rpPerSec, 2)} RP/s depuis. Estimation : si ta production de RP change en jeu, corrige-la ici.`
      : "";
}

/** Liste « Production déjà en place ». */
function renderExisting(): void {
  const entries = Object.entries(settings.existing);
  $("existing-count").textContent = entries.length ? String(entries.length) : "";
  $("existing-list").innerHTML = entries
    .map(([id, v]) => {
      const name = itemName(id);
      return `<li><span class="name">${esc(name)}</span>
        <label class="sr-only" for="ex-${esc(id)}">Débit de ${esc(name)}</label>
        <input id="ex-${esc(id)}" type="number" min="0.01" step="any" inputmode="decimal" data-existing-rate="${esc(id)}" value="${v}"> /min
        <button type="button" class="link small" data-existing-del="${esc(id)}" aria-label="Retirer ${esc(name)}">retirer</button></li>`;
    })
    .join("");
}

// ---------------------------------------------------------------- arbre de recherche

let panzoom: PanZoom | null = null;
const layouts = new Map<string, ResearchLayout>();
let lastLayoutKey = "";

function renderTreePage(focusKey: string | null = null): void {
  const p = toEngineProgress(prog);
  $("tree-summary").textContent = `${progressSummary(data, p)}. Clique une recherche pour la débloquer (avec ses prérequis si besoin).`;
  $("tree-view").hidden = ui.view !== "tree";
  $("list-view").hidden = ui.view !== "list";
  for (const b of document.querySelectorAll<HTMLButtonElement>(".seg [data-view]")) b.setAttribute("aria-checked", String(b.dataset.view === ui.view));
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tabs [data-cat]")) tab.setAttribute("aria-selected", String(tab.dataset.cat === treeView.category));
  if (ui.view === "list") {
    $("tree").innerHTML = renderTree(data, p, treeView);
    if (focusKey) $("tree").querySelector<HTMLElement>(focusKey)?.focus();
  } else renderResearchCanvas(focusKey);
}

function focusedKey(): string | null {
  const focused = (document.activeElement as HTMLElement | null)?.dataset;
  return focused?.node ? `[data-node="${focused.node}"]` : focused?.req ? `[data-req="${focused.req}"]` : focused?.rs ? `[data-rs="${focused.rs}"]` : null;
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
  const key = treeView.category;
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
  const btn = $<HTMLButtonElement>("rs-hud-action");
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
  if (currentPage() === "arbre") renderTreePage();
  if (reveal) revealNode(id);
}

// ---------------------------------------------------------------- données

function renderData(): void {
  const tab = ui.dataTab;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-dtab]")) {
    const on = b.dataset.dtab === tab;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  $("dpanel-verifier").hidden = tab !== "verifier";
  $("dpanel-batiments").hidden = tab !== "batiments";
  document.body.classList.toggle("wide", tab === "batiments");
  if (tab !== "verifier") return;
  const v = viewCtx();
  const where = `<a href="#${GOAL_ROUTE[settings.goal]}">${esc(GOAL_TITLE[settings.goal].toLowerCase())}</a>`;
  $("verify-context").innerHTML = `Valeurs de la chaîne du dernier calcul : ${esc(planLabel(v))} (${where}).`;
  $("verify").innerHTML = renderVerify(v);
  $("verify-count").textContent = String(v.plan.verify.filter((x) => x.used).length);
  $("corrections").innerHTML = renderCorrections(v);
  $("corrections-count").textContent = String(countCorrections(corrections));
  $("data-errors").innerHTML = dataErrors.length ? `<div class="banner bad">Corrections ignorées :<ul>${dataErrors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : "";
}

// ---------------------------------------------------------------- progression

/**
 * Applique une nouvelle progression. Avec l'option « débloquer dépense les RP », le coût des
 * recherches ajoutées est retiré des RP (et rendu pour celles qu'on retire). Si les RP ne
 * suffisent pas, on propose de saisir le montant actuel (les RP du site sont souvent en retard).
 * `spend: false` : import d'un fichier ou remise à zéro, sans effet sur les RP.
 */
async function setProgress(next: ProgressState, opts: { spend?: boolean } = {}): Promise<void> {
  const delta = rpDelta(data, prog.unlocked, next.unlocked);
  const now = currentRp(player);
  if (opts.spend !== false && player.spendRp && now !== null && delta.spent !== 0) {
    let available = now;
    while (delta.spent > available + 1e-9) {
      const choice = await ask(
        "Pas assez de RP",
        `<p>Ce déblocage coûte <b>${esc(fmtRP(delta.spent))}</b> (${delta.added.length} recherche(s)), et le site estime que tu as <b>${esc(fmtRP(available))}</b>.</p>
         <p>Si tu en as plus en jeu, indique ton montant actuel <i>avant</i> ce déblocage :</p>
         <label class="ask-field">RP actuels <input id="ask-rp" inputmode="decimal" autocomplete="off" value="${Math.floor(available)}"></label>`,
        [
          { value: "set", label: "Valider ce montant", primary: true },
          { value: "free", label: "Débloquer sans dépenser" },
          { value: "", label: "Annuler" },
        ],
      );
      if (!choice) return render();
      if (choice === "free") return commitProgress(next);
      const v = parseOptional((document.getElementById("ask-rp") as HTMLInputElement | null)?.value ?? "");
      if (typeof v === "number" && v >= 0) available = v;
    }
    player = { ...player, rp: available - delta.spent, rpAt: Date.now() };
    savePlayer(player);
  }
  commitProgress(next);
}

function commitProgress(next: ProgressState): void {
  const focus = focusedKey();
  prog = next;
  saveProgress(prog);
  planDirty = true;
  renderHeader();
  if (currentPage() === "arbre") renderTreePage(focus);
  else render();
}

/** Petite boîte de dialogue : renvoie la valeur du bouton choisi ("" si fermée). */
function ask(title: string, bodyHtml: string, buttons: { value: string; label: string; primary?: boolean }[]): Promise<string> {
  const dlg = $<HTMLDialogElement>("ask");
  $("ask-title").textContent = title;
  $("ask-body").innerHTML = bodyHtml;
  $("ask-actions").innerHTML = buttons.map((b) => `<button value="${esc(b.value)}"${b.primary ? ` class="primary"` : ""}>${esc(b.label)}</button>`).join("");
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue), { once: true });
    dlg.returnValue = "";
    dlg.showModal();
    (dlg.querySelector<HTMLInputElement>("input") ?? dlg.querySelector<HTMLButtonElement>("button.primary"))?.focus();
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
      if (!choice) return render();
      if (choice === "all") add = [...missing, id];
    }
    void setProgress({ ...prog, unlocked: [...new Set([...prog.unlocked, ...add])] });
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
      if (!choice) return render();
      if (choice === "all") remove = [id, ...deps];
    }
    void setProgress({ ...prog, unlocked: prog.unlocked.filter((x) => !remove.includes(x)) });
  }
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

// ---------------------------------------------------------------- recherche d'items et de recherches

const byName = new Map<string, string>();
function fillLists(): void {
  const items = [...data.items.values()].sort((a, b) => a.name.localeCompare(b.name));
  byName.clear();
  for (const it of items) byName.set(it.name.toLowerCase(), it.id);
  $("item-list").innerHTML = items.map((it) => `<option value="${esc(it.name)}"></option>`).join("");
  $("node-list").innerHTML = [...data.nodes.values()]
    .filter((n) => !n.isRoot)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((n) => `<option value="${esc(n.name)}">${esc(n.category)} · ${fmt(n.rp, 0)} RP</option>`)
    .join("");
}
function resolveItem(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (byName.has(t)) return byName.get(t)!;
  if (data.items.has(t)) return t;
  const partial = [...byName.entries()].filter(([n]) => n.includes(t));
  return partial.length === 1 ? partial[0]![1] : null;
}
function resolveNode(text: string) {
  const t = text.trim().toLowerCase();
  const nodes = [...data.nodes.values()].filter((n) => !n.isRoot);
  return nodes.find((n) => n.name.toLowerCase() === t) ?? (t ? nodes.filter((n) => n.name.toLowerCase().includes(t)).at(0) : undefined);
}

/** Ajoute (ou met à jour) une production existante. */
async function askExisting(id: string, perMin: number): Promise<void> {
  const choice = await ask(
    "Production déjà en place",
    `<p><b>${esc(itemName(id))}</b> : tu en produis déjà ailleurs ? Indique ton débit, le calcul s'en servira avant de construire du neuf.</p>
     <label class="ask-field">Débit (/min) <input id="ask-rate" inputmode="decimal" autocomplete="off" value="${esc(String(Math.round(perMin * 100) / 100).replace(".", ","))}"></label>
     <p class="hint">Tu retrouves tes productions dans Mon usine.</p>`,
    [
      { value: "ok", label: "Ajouter", primary: true },
      { value: "", label: "Annuler" },
    ],
  );
  if (choice !== "ok") return;
  const v = parseOptional((document.getElementById("ask-rate") as HTMLInputElement | null)?.value ?? "");
  if (typeof v !== "number" || !(v > 0)) return;
  settings.existing = { ...settings.existing, [id]: v };
  settings.useExisting = true;
  update();
}

// ---------------------------------------------------------------- événements

function bindPlan(): void {
  const itemInput = input("item");
  const onItem = () => {
    const id = resolveItem(itemInput.value);
    $("item-hint").textContent = id ? "" : itemInput.value.trim() ? "Objet introuvable : choisis un nom dans la liste." : "";
    if (id && id !== settings.item) {
      settings.item = id;
      update();
    }
  };
  itemInput.addEventListener("change", onItem);
  itemInput.addEventListener("input", () => {
    if (byName.has(itemInput.value.trim().toLowerCase())) onItem();
  });
  const num = (id: string, apply: (v: number | null) => boolean, allowEmpty = false) =>
    $(id).addEventListener("input", (e) => {
      const raw = (e.target as HTMLInputElement).value.trim().replace(",", ".");
      const v = parseFloat(raw);
      if (allowEmpty && !raw) {
        if (apply(null)) updateSoon();
      } else if (Number.isFinite(v) && apply(v)) updateSoon();
    });
  num("qty", (v) => {
    if (!(v! > 0)) return false;
    if (settings.mode === "rate") settings.rate = v!;
    else settings.machines = v!;
    return true;
  });
  // Changer d'unité garde la même production : le nombre affiché est converti.
  $("qty-unit").addEventListener("change", (e) => {
    const mode = (e.target as HTMLSelectElement).value as Settings["mode"];
    if (mode === settings.mode) return;
    if (plan && plan.target.kind === "objet" && plan.status !== "impossible") {
      if (mode === "machines") {
        const finals = plan.steps.filter((s) => plan!.finals.includes(s.key));
        settings.machines = Math.max(1, finals.reduce((n, s) => n + s.machines, 0));
      } else if (plan.target.ratePerMin > 0) settings.rate = Math.round(plan.target.ratePerMin * 100) / 100;
    }
    settings.mode = mode;
    update();
  });
  num("money", (v) => (v! > 0 ? ((settings.money = v!), true) : false));
  num("energy", (v) => (v! > 0 ? ((settings.energyMFps = v! * (settings.energyUnit === "M" ? 1e6 : 1e3)), true) : false));
  $("energy-unit").addEventListener("change", (e) => {
    settings.energyUnit = (e.target as HTMLSelectElement).value === "M" ? "M" : "k";
    saveSettings(settings);
    syncForm();
  });
  $("energy-mode").addEventListener("change", (e) => {
    settings.energyGuaranteed = (e.target as HTMLSelectElement).value === "garantie";
    update();
  });
  num("distance", (v) => (v === null ? ((settings.distanceTiles = null), true) : v >= 0 ? ((settings.distanceTiles = v), true) : false), true);
  $("rp-mode").addEventListener("change", (e) => {
    settings.rpMode = (e.target as HTMLSelectElement).value as Settings["rpMode"];
    update();
  });
  num("rp-rate", (v) => (v! > 0 ? ((settings.rpRate = v!), true) : false));
  num("rp-minutes", (v) => (v! > 0 ? ((settings.rpMinutes = v!), true) : false));
  num("rp-cap", (v) => (v === null ? ((settings.rpCap = null), true) : v >= 0 ? ((settings.rpCap = v), true) : false), true);
  $("rp-node").addEventListener("change", (e) => {
    settings.rpNode = resolveNode((e.target as HTMLInputElement).value)?.id ?? null;
    update();
  });
  num("max-pollution", (v) => (v === null ? ((settings.maxPollution = null), true) : v >= 0 ? ((settings.maxPollution = v), true) : false), true);
  const checks: [string, (on: boolean) => void][] = [
    ["no-fuel", (on) => (settings.energyNoFuel = on)],
    ["rp-satellites", (on) => (settings.rpSatellites = on)],
    ["rp-logic", (on) => (settings.rpLogic = on)],
    ["rp-current", (on) => (settings.rpCurrent = on)],
    ["self-powered", (on) => (settings.selfPowered = on)],
    ["use-budget", (on) => (settings.useBudget = on)],
    ["use-existing", (on) => (settings.useExisting = on)],
    ["unverified", (on) => (settings.useUnverified = on)],
  ];
  for (const [id, set] of checks) {
    $(id).addEventListener("change", (e) => {
      set((e.target as HTMLInputElement).checked);
      update();
    });
  }
  $("criterion").addEventListener("change", (e) => {
    settings.criteria = { ...settings.criteria, [settings.goal]: (e.target as HTMLSelectElement).value as Settings["criteria"][Goal] };
    update();
  });
  $("query").addEventListener("submit", (e) => e.preventDefault());

  // Onglets du résultat (flèches gauche/droite comme des onglets).
  const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-rtab]")];
  for (const b of tabs) {
    b.addEventListener("click", () => {
      settings.resultTab = b.dataset.rtab as ResultTab;
      saveSettings(settings);
      renderResultTabs();
    });
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const i = tabs.indexOf(b);
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
      next.click();
      next.focus();
    });
  }
  // Liste de construction : cases « construit ».
  $("build").addEventListener("change", (e) => {
    const box = e.target as HTMLInputElement;
    if (!box.dataset.built) return;
    const set = builtFor(built, signature);
    if (box.checked) set.add(box.dataset.built);
    else set.delete(box.dataset.built);
    built = setBuilt(built, signature, set);
    saveBuilt(built);
    renderBuild();
    $("build").querySelector<HTMLInputElement>(`[data-built="${CSS.escape(box.dataset.built)}"]`)?.focus();
  });
  $("build").addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("[data-built-reset]")) return;
    built = setBuilt(built, signature, []);
    saveBuilt(built);
    renderBuild();
  });
  // Choix d'une recette à la main (onglet Détails).
  $("details").addEventListener("change", (e) => {
    const sel = e.target as HTMLSelectElement;
    const item = sel.dataset.force;
    if (!item) return;
    if (sel.value) settings.forced = { ...settings.forced, [item]: sel.value };
    else {
      const { [item]: _, ...rest } = settings.forced;
      settings.forced = rest;
    }
    update();
    $("details").querySelector<HTMLSelectElement>(`select[data-force="${CSS.escape(item)}"]`)?.focus();
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-fzoom]")) {
    b.addEventListener("click", () => {
      const z = b.dataset.fzoom;
      if (z === "in") flowPZ?.zoom(1.25);
      else if (z === "out") flowPZ?.zoom(1 / 1.25);
      else if (z === "fit") flowPZ?.fit();
      else flowPZ?.reset();
    });
  }
}

/** Boutons présents dans plusieurs vues (réponse, liste, détails) : délégation sur la page. */
function bindShared(): void {
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const tier = t.closest<HTMLElement>("[data-tier]");
    if (tier) {
      const v = Number(tier.dataset.tier);
      const final = Number(tier.dataset.final);
      if (!(v > 0)) return;
      if (settings.goal === "argent") settings.money = Math.round(v * 100) / 100;
      else if (settings.goal === "énergie") settings.energyMFps = v;
      else if (final > 0) {
        // Palier sur un nombre entier de machines finales : calcul exact par ce nombre.
        settings.mode = "machines";
        settings.machines = final;
      } else {
        settings.mode = "rate";
        settings.rate = v;
      }
      return update();
    }
    if (t.closest("[data-forced-reset]")) {
      settings.forced = {};
      return update();
    }
    const have = t.closest<HTMLElement>("[data-have]");
    if (have) return void askExisting(have.dataset.have!, Number(have.dataset.amount) > 0 ? Number(have.dataset.amount) : 1);
    const btn = t.closest<HTMLButtonElement>("button[data-unlock], button[data-own]");
    if (btn?.dataset.unlock) {
      let next = new Set(prog.unlocked);
      for (const id of btn.dataset.unlock.split(",")) next = unlockUpTo(data, { ...toEngineProgress(prog), unlocked: next }, id);
      void setProgress({ ...prog, unlocked: [...next] });
    } else if (btn?.dataset.own) {
      void setProgress({ ...prog, owned: [...new Set([...prog.owned, ...btn.dataset.own.split(",")])] });
    }
  });
}

function bindUsine(): void {
  $("owned").addEventListener("change", (e) => {
    const box = e.target as HTMLInputElement;
    const id = box.dataset.owned;
    if (id) void setProgress({ ...prog, owned: box.checked ? [...new Set([...prog.owned, id])] : prog.owned.filter((x) => x !== id) });
  });
  $("upto-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const node = resolveNode(input("upto").value);
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
    void setProgress({ ...prog, unlocked: [...next] });
  });
  $("progress-reset").addEventListener("click", async () => {
    const choice = await ask("Réinitialiser la progression", "<p>Décocher toutes les recherches et toutes les machines possédées ?</p>", [
      { value: "yes", label: "Réinitialiser", primary: true },
      { value: "", label: "Annuler" },
    ]);
    if (choice === "yes") void setProgress({ unlocked: [], reqItemsDone: [], owned: [] }, { spend: false });
  });

  // Transférer la partie (autre adresse, autre appareil)
  $("progress-export").addEventListener("click", () => {
    const file = exportProgress(prog, player);
    downloadJson(file, `progression-industrialist-${file.exportedAt.slice(0, 10)}.json`);
    $("progress-io-hint").textContent = "Fichier exporté.";
  });
  $("progress-import").addEventListener("change", async (e) => {
    const box = e.target as HTMLInputElement;
    const file = box.files?.[0];
    box.value = "";
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
      "Importer une partie",
      `<p>Remplacer ta progression actuelle (${prog.unlocked.length} recherche(s) cochée(s)) par celle du fichier${esc(when)} : <b>${parsed.progress.unlocked.length}</b> recherche(s), ${parsed.progress.owned.length} machine(s) possédée(s), et tes ressources ?</p>${
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
    void setProgress(parsed.progress, { spend: false });
    $("progress-io-hint").textContent = `Partie importée : ${parsed.progress.unlocked.length} recherche(s).`;
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
      planDirty = true;
      renderHeader();
    });
  }
  $("p-spend").addEventListener("change", (e) => {
    player = { ...player, spendRp: (e.target as HTMLInputElement).checked };
    savePlayer(player);
  });
  $("p-gamepass").addEventListener("change", (e) => {
    player = { ...player, gamePass: (e.target as HTMLInputElement).checked };
    savePlayer(player);
  });

  // Production déjà en place : ajout, modification, retrait.
  $("existing-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("item") as HTMLInputElement).value;
    const id = resolveItem(name);
    const v = parseFloat((form.elements.namedItem("rate") as HTMLInputElement).value.replace(",", "."));
    if (!id) return void ($("existing-hint").textContent = "Objet introuvable : choisis un nom dans la liste.");
    if (!(v > 0)) return void ($("existing-hint").textContent = "Indique un débit positif, par minute.");
    $("existing-hint").textContent = `${itemName(id)} : ${fmt(v, 2)}/min ajoutés.`;
    form.reset();
    settings.existing = { ...settings.existing, [id]: v };
    update();
  });
  $("existing-list").addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const id = t.dataset.existingRate;
    const v = parseFloat(t.value.replace(",", "."));
    if (!id || !(v > 0)) return;
    settings.existing = { ...settings.existing, [id]: v };
    planDirty = true;
    saveSettings(settings);
  });
  $("existing-list").addEventListener("click", (e) => {
    const del = (e.target as HTMLElement).closest<HTMLElement>("[data-existing-del]");
    if (!del) return;
    const { [del.dataset.existingDel!]: _, ...rest } = settings.existing;
    settings.existing = rest;
    update();
  });
}

function bindTree(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".seg [data-view]")) {
    b.addEventListener("click", () => {
      ui.view = b.dataset.view as "tree" | "list";
      saveUi();
      renderTreePage();
    });
  }
  $("tree").addEventListener("change", (e) => {
    const box = e.target as HTMLInputElement;
    if (box.dataset.node) void toggleNode(box.dataset.node, box.checked);
    else if (box.dataset.req) {
      const id = box.dataset.req;
      void setProgress({ ...prog, reqItemsDone: box.checked ? [...new Set([...prog.reqItemsDone, id])] : prog.reqItemsDone.filter((x) => x !== id) });
    }
  });
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tabs [data-cat]")) {
    tab.addEventListener("click", () => {
      treeView.category = tab.dataset.cat as TreeView["category"];
      renderTreePage();
    });
  }
  $("tree-filter").addEventListener("input", (e) => {
    treeView.filter = (e.target as HTMLInputElement).value;
    if (ui.view === "tree" && treeView.filter.trim()) {
      const first = [...data.nodes.values()].filter((n) => !n.isRoot && matchesFilter(n.id)).sort((a, b) => Number(b.category === treeView.category) - Number(a.category === treeView.category))[0];
      if (first) return selectNode(first.id);
    }
    renderTreePage();
  });
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
    const del = t.closest<HTMLElement>("[data-rs-desc-del]");
    if (del) {
      corrections = removeCorrection(corrections, "research", del.dataset.rsDescDel!, "description");
      saveCorrections(corrections);
      rebuildData();
      return update();
    }
    const act = t.closest<HTMLElement>("[data-rs-action]");
    if (!act) return;
    const id = act.dataset.id!;
    if (act.dataset.rsAction === "unlock-all") void setProgress({ ...prog, unlocked: [...unlockUpTo(data, toEngineProgress(prog), id)] });
    else if (act.dataset.rsAction === "unlock-one") void setProgress({ ...prog, unlocked: [...new Set([...prog.unlocked, id])] });
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
    update();
  });
  $("rs-detail").addEventListener("change", (e) => {
    const box = e.target as HTMLInputElement;
    const id = box.dataset.req;
    if (id) void setProgress({ ...prog, reqItemsDone: box.checked ? [...new Set([...prog.reqItemsDone, id])] : prog.reqItemsDone.filter((x) => x !== id) });
  });
}

function bindData(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-dtab]")) {
    b.addEventListener("click", () => {
      ui.dataTab = b.dataset.dtab === "batiments" ? "batiments" : "verifier";
      saveUi();
      renderData();
    });
  }
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
    update();
  });
  $("corrections").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove]");
    if (!btn) return;
    const [scope, id, field] = btn.dataset.remove!.split("|") as [Scope, string, string];
    corrections = removeCorrection(corrections, scope, id, field);
    saveCorrections(corrections);
    rebuildData();
    update();
  });
  $("export").addEventListener("click", () => downloadJson(mergeCorrections(repoOverrides, corrections), "overrides.json"));
  $("import").addEventListener("change", async (e) => {
    const box = e.target as HTMLInputElement;
    const file = box.files?.[0];
    box.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isOverridesFile(parsed)) throw new Error("format inattendu");
      corrections = mergeCorrections(corrections, parsed);
      saveCorrections(corrections);
      rebuildData();
      update();
    } catch (err) {
      $("data-errors").innerHTML = `<div class="banner bad">Import impossible : ${esc((err as Error).message)}</div>`;
    }
  });
  $("clear-corrections").addEventListener("click", async () => {
    if (!countCorrections(corrections)) return;
    const choice = await ask("Effacer mes corrections", "<p>Effacer toutes tes corrections locales ? Pense à les exporter avant.</p>", [
      { value: "yes", label: "Tout effacer", primary: true },
      { value: "", label: "Annuler" },
    ]);
    if (choice !== "yes") return;
    corrections = {};
    saveCorrections(corrections);
    rebuildData();
    update();
  });
}

/** Les RP montent tout seuls : affichage rafraîchi, et l'arbre ou le plan quand ça change quelque chose. */
let rpSignature = "";
let lastRpPlanRender = 0;
function tickRp(): void {
  if (player.rp === null || !player.rpPerSec || player.rpAt === null) return;
  const rp = currentRp(player)!;
  const page = currentPage();
  renderHeader();
  if (page === "usine") {
    if (document.activeElement !== $("p-rp")) input("p-rp").value = String(Math.floor(rp));
    renderRpLive();
  }
  // Recherches qui deviennent abordables : l'arbre change de couleur.
  const sig = [...data.nodes.values()].filter((n) => !n.isRoot && n.rp <= rp).length.toString();
  if (sig !== rpSignature) {
    rpSignature = sig;
    if (page === "arbre") renderTreePage(focusedKey());
  }
  // Temps restant pour les RP du plan : au plus toutes les 30 s.
  if (page === "plan" && (plan?.economy.rpNeeded ?? 0) > 0 && Date.now() - lastRpPlanRender > 30_000) {
    lastRpPlanRender = Date.now();
    update();
  }
}

rebuildData();
if (!data.items.has(settings.item)) settings.item = "crankshaft";
prog = sanitizeProgress(data, prog);
fillLists();
bindPlan();
bindShared();
bindUsine();
bindTree();
bindData();
initBuildings($("bld-root"), data, portsJson as unknown as PortsFile);
window.addEventListener("hashchange", showPage);
showPage();
window.setInterval(tickRp, 5000);
