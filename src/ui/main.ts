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
import relevesJson from "../../data/releves.json";
import imagesJson from "../../data/images.json";
import { buildCatalog, pipeFor } from "../engine/build/catalog.ts";
import { factoryInput, type FactoryPlan } from "../engine/build/factory.ts";
import { factoryFlows, type FactoryArrow } from "../engine/build/flow.ts";
import { designModule, passageOptions, requestFromStep, type ModulePlan, type ModuleRequest, type PassageOption, type PoseCriterion } from "../engine/build/module.ts";
import { renderModuleInfo, renderModuleSvg, renderPassagePick } from "./module-view.ts";
import { factoryFrameClasses, linksButton, renderFactoryBar, renderFactoryInfo, renderFactoryModule, renderFactorySvg, turnText } from "./factory-view.ts";
import { runFactory, type FactoryJob } from "./factory-job.ts";
import { buildGameData, type GameData, type RawFiles } from "../engine/data.ts";
import { solve, type Plan, type PlayerState } from "../engine/solve.ts";
import type { Criterion } from "../engine/choose.ts";
import type { OverridesFile } from "../engine/types.ts";
import type { EnergyFile, InterfacesFile, LogisticsFile, PortsEntry, PortsFile, PowerFile, ResearchStationsFile } from "../engine/extension-types.ts";
import { applyMachineSettings, type Interfaces, type MachineSettings, mergeInterfaces } from "../engine/interfaces.ts";
import interfacesJson from "../../data/interfaces.json";
import { parseFactor, settingChips, settingLines } from "./iface-view.ts";
import { designResearch, rpParams, unlockTimeline, type RpResult } from "../engine/research-points.ts";
import { dependentsOf, isNodeUnlocked, missingNodes, rpCost, unlockUpTo } from "../engine/unlock.ts";
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
  plotOf,
  type PlayerInfo,
  type ProgressState,
  type TreeView,
} from "./progress.ts";
import { PanZoom } from "./canvas.ts";
import { initBuildings } from "./buildings.ts";
import { bindPrioList, focusItem, renderPrioItems } from "./prio-list.ts";
import { GOAL_ROUTE, GOAL_TITLE, nextStack, PAGES, parseRoute, routeHash, routeTitle, USINE_STEP, type Page, type Route } from "./route.ts";
import { mergeSurveys, surveyState } from "./buildings-model.ts";
import { loadLocalInterfaces, loadLocalSurveys, rawLocalInterfaces, rawLocalSurveys } from "./surveys.ts";
import { layoutResearch, RN_H, RN_W, type ResearchLayout } from "./research-layout.ts";
import { renderNodeDetail, renderResearchSvg } from "./research-view.ts";
import {
  defaultDir,
  draftFrom,
  EDIT_ON,
  newDraft,
  parseDraft,
  parseItemForm,
  readNum,
  recipeEntries,
  recipeHref,
  renderEntryList,
  renderEntryRows,
  renderItemCard,
  renderItemForm,
  renderMachineCard,
  searchEntries,
  sortEntries,
  type CraftDraft,
  type DraftAt,
  type DraftLine,
  type EditState,
  type Entry,
  type EntryKind,
  type FixScope,
  type ListFilter,
  type ListView,
  type Picture,
  type RecipesCtx,
  type SortKey,
} from "./recipes-view.ts";
import { exportImages, loadImages, loadPrefs, parseImagesExport, saveImages, savePrefs, type MyImages } from "./recipes-store.ts";
import type { ResearchView } from "./research-plan.ts";
import { allVerifyEntries, itemN, machineN, renderCorrections, renderVerify } from "./render.ts";
import { allowMachine, banMachine, filterableMachines, filterSummary, findMachine, renderFilterBody, withMode } from "./mfilter-view.ts";
import { buildRows, buildSignature, criterionHint, criterionWhy, CRITERION_TEXT, planLabel, renderAnswer, renderBuildList, renderDetails, renderFlow, renderEdgeHud, renderFixBar, renderFlowHud, renderStepLinks, isPosable, type BuildRow, type ViewCtx } from "./plan-view.ts";
import { renderEdgeCalc, renderStepCalc } from "./calc-view.ts";
import {
  builtFor,
  cleanNotes,
  countCorrections,
  loadNotes,
  saveNotes,
  type Notes,
  isOverridesFile,
  loadBuilt,
  loadCorrections,
  loadSettings,
  mergeCorrections,
  newItemId,
  newRecipeId,
  pruneIntegratedCorrections,
  removeAdded,
  removeCorrection,
  setAddedItem,
  setAddedRecipe,
  setRemoved,
  saveBuilt,
  saveCorrections,
  saveSettings,
  setBuilt,
  setCorrection,
  engineFilter,
  planKey,
  planMachines,
  type Goal,
  type PlanMachines,
  type ResultTab,
  type Scope,
  type Settings,
} from "./state.ts";

const REPO_IFACES = interfacesJson as unknown as InterfacesFile;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: REPO_IFACES } as unknown as RawFiles;
/** Poteaux de transport d'énergie (réseau de l'objectif énergie). */
const POLES = (powerJson as unknown as PowerFile).entries
  .filter((e) => e.subcategory === "Transfer Poles" && e.transfer)
  .map((e) => ({ id: e.id, name: e.name, perNodeMFps: e.transfer!.perNode, nodes: e.transfer!.nodes, rangeTiles: e.rangeTiles?.tiles ?? null }));
const ENERGY_FILE = energyJson as unknown as EnergyFile;
const RP_PARAMS = rpParams(stationsJson as unknown as ResearchStationsFile);
const repoOverrides = overridesJson as unknown as OverridesFile;
/** Dépôts de vente (objectif argent) : débit de vente relevé ou lu sur le wiki. */
const DEPOTS = (logisticsJson as unknown as LogisticsFile).depots.map((d) => ({ id: d.id, name: d.name, kind: d.kind, itemsPerSec: d.itemsPerSec }));
/** Pièces de construction (tuyaux, croisements, poteaux) pour les plans de pose. */
const RELEVES = relevesJson as { poleRangeTiles?: Record<string, number>; grid?: { tileCells?: number } };
/** Une tuile (portée des poteaux) = 2 cases, relevé en jeu. */
const CELLS_PER_TILE = RELEVES.grid?.tileCells ?? 2;
const CATALOG = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, RELEVES.poleRangeTiles ?? {}, CELLS_PER_TILE);
const REPO_PORTS = portsJson as unknown as PortsFile;
/** Relevés de bâtiments pour les plans de pose : ceux du dépôt, remplacés par les relevés locaux. */
let ports = { sig: null as string | null, machines: REPO_PORTS.machines, local: {} as Record<string, PortsEntry> };
function currentPorts(): typeof ports {
  const sig = rawLocalSurveys();
  if (sig !== ports.sig) {
    const local = loadLocalSurveys();
    ports = { sig, machines: mergeSurveys(REPO_PORTS, local), local };
  }
  return ports;
}

/** Interfaces des machines (S10) : celles du dépôt, remplacées par celles notées dans ce navigateur. */
let ifaces = { sig: null as string | null, all: REPO_IFACES.machines as Interfaces, local: {} as Interfaces };
function currentInterfaces(): typeof ifaces {
  const sig = rawLocalInterfaces();
  if (sig !== ifaces.sig) {
    const local = loadLocalInterfaces();
    ifaces = { sig, all: mergeInterfaces(REPO_IFACES.machines, local), local };
  }
  return ifaces;
}

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
/** Notes sur les valeurs à vérifier : celles du dépôt (overrides.json, clé `_notes`), puis les miennes. */
const repoNotes: Notes = cleanNotes((overridesJson as { _notes?: unknown })._notes);
let notes: Notes = loadNotes();
let verifyAll = false;
let verifyFilter = "";
const treeView: TreeView = { category: "Production", filter: "" };
/** Page Recettes : présentation de la liste, recherche, images choisies par le joueur. */
let rcPrefs = loadPrefs();
let rcQuery = "";
let rcEntries: Entry[] | null = null;
let myImages: MyImages = loadImages();
/** Mode « ✎ Corriger » de la fiche ouverte (null = lecture), la fiche qu'il concerne, et une case à rendre active. */
let rcEdit: EditState | null = null;
let rcEditCard = "";
let rcFocusPending = false;
/** Arrivée sur une fiche depuis le schéma : montrer le craft mis en évidence (ou la valeur à corriger). */
let rcRevealPending = false;
/** Vignettes du wiki (scripts/fetch-images.ts), servies depuis public/img. */
const WIKI_IMAGES = new Map((imagesJson as { images: { kind: EntryKind; id: string; file: string; url: string; license: string }[] }).images.map((x) => [`${x.kind}|${x.id}`, x]));

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
  rcEntries = null;
}

function playerState(): PlayerState {
  return { ...toEngineProgress(prog), ...player, rp: currentRp(player) };
}

const nodeName = (id: string) => data.nodes.get(id)?.name ?? id;
const itemName = (id: string) => data.items.get(id)?.name ?? id;

// ---------------------------------------------------------------- pages et adresses

/** Adresses d'avant la refonte. */
const OLD_ROUTES: Record<string, string> = { production: "", recherche: "arbre", verifier: "donnees", batiments: "donnees", partie: "usine" };
const KEY_STACK = "ind-calc:v1:pile";

let route: Route = parseRoute(location.hash);
const currentPage = (): Page => route.page;

/** Vues visitées dans cet onglet (pour le bouton « Retour »), et défilement de chacune. */
let stack: string[] = (() => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY_STACK) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
})();
const scrollOf = new Map<string, number>();
function saveStack(): void {
  try {
    sessionStorage.setItem(KEY_STACK, JSON.stringify(stack));
  } catch {
    // pile indisponible : le bouton « Retour » se contente de la session en cours
  }
}

/** Aller à une vue (nouvelle entrée d'historique : « Retour » y ramène). */
function go(r: Route): void {
  const h = routeHash(r);
  if (h === location.hash) showPage();
  else location.hash = h;
}
/** Préciser la vue en cours sans créer d'entrée d'historique (choix d'une étape, d'un bloc). */
function refine(r: Route): void {
  const h = routeHash(r);
  if (h === location.hash) return;
  history.replaceState(null, "", h);
  route = r;
  stack = [...stack.slice(0, -1), h];
  saveStack();
  renderBack();
}

function renderBack(): void {
  const b = $<HTMLButtonElement>("back");
  const prev = stack.length >= 2 ? stack.at(-2)! : null;
  b.hidden = !prev;
  if (!prev) return;
  const t = routeTitle(parseRoute(prev));
  b.title = `Revenir à : ${t}`;
  b.setAttribute("aria-label", `Retour : ${t}`);
  $("back-to").textContent = t;
}

/** Lit l'adresse : vue demandée, anciennes adresses redirigées. */
function readRoute(): void {
  const h = decodeURIComponent(location.hash.replace("#", ""));
  if (h in OLD_ROUTES) {
    if (h === "batiments") ui.dataTab = "batiments";
    if (h === "verifier") ui.dataTab = "verifier";
    history.replaceState(null, "", `#${OLD_ROUTES[h] || GOAL_ROUTE[settings.goal]}`);
  }
  route = parseRoute(location.hash);
  if (route.goal && route.goal !== settings.goal) {
    settings.goal = route.goal;
    planDirty = true;
  }
  if (route.tab && route.tab !== settings.resultTab) {
    settings.resultTab = route.tab;
    saveSettings(settings);
  }
  if (route.tab === "pose" && route.step) poseStep = route.step;
  poseFocus = route.tab === "pose" && route.step === USINE ? (route.focus ?? null) : null;
  if (route.tab === "schema") flowSel = route.step ?? null;
  if (route.dataTab && route.dataTab !== ui.dataTab) {
    ui.dataTab = route.dataTab;
    saveUi();
  }
}

let lastPage: Page | null = null;
let lastHash = "";
function showPage(): void {
  if (lastHash) scrollOf.set(lastHash, window.scrollY);
  readRoute();
  const before = stack.length;
  stack = nextStack(stack, location.hash);
  const wentBack = stack.length < before;
  saveStack();
  lastHash = location.hash;
  const page = currentPage();
  for (const p of PAGES) $(`page-${p}`).hidden = p !== page;
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
    if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.body.classList.toggle("wide", page === "arbre" || (page === "donnees" && ui.dataTab === "batiments"));
  const titles: Record<Page, string> = { accueil: "", plan: GOAL_TITLE[settings.goal], usine: "Mon usine", arbre: "Arbre de recherche", recettes: "Recettes", donnees: "Données" };
  document.title = titles[page] ? `${titles[page]} — Calculateur de production` : "Calculateur de production";
  renderBack();
  document.body.classList.remove("usine-wide");
  render();
  if (page === "donnees" && route.machine) buildings.show(route.machine);
  // Retour : la vue reprend où on l'avait laissée ; nouvelle page : en haut.
  if (wentBack && scrollOf.has(location.hash)) window.scrollTo(0, scrollOf.get(location.hash)!);
  else if (page !== lastPage || page === "recettes") window.scrollTo(0, 0);
  lastPage = page;
  if (page === "recettes") {
    revealRcCurrent();
    if (route.card?.craft && !wentBack) revealRcCraft();
  }
  if (page === "donnees" && route.verify?.field) {
    const el = document.getElementById(`fix-${route.verify.id}-${route.verify.field}`) as HTMLInputElement | null;
    el?.closest(".vrow")?.classList.add("vfocus");
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  }
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
      criterion: settings.criteria.objet[0], then: settings.criteria.objet.slice(1),
      forced: settings.forced,
      useUnverified: settings.useUnverified,
      machines: engineFilter(planMachines(settings, planKey("objet", settings.item))),
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
          criterion: settings.criteria.recherche[0]!, then: settings.criteria.recherche.slice(1),
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

/** L'objectif affiché, pour savoir si les machines fixées dans le schéma valent encore (S8). */
function goalSig(): string {
  const g = settings.goal;
  if (g === "argent") return `argent|${settings.money}`;
  if (g === "énergie") return `énergie|${settings.energyMFps}|${settings.energyGuaranteed}|${settings.energyNoFuel}`;
  if (g === "objet") return `objet|${settings.item}|${settings.mode}|${settings.mode === "rate" ? settings.rate : settings.machines}`;
  return g;
}
/** Machines fixées pour l'objectif affiché ; changer d'objet ou d'objectif les annule. */
function fixedNow(): Record<string, number> | undefined {
  if (!settings.fixed || settings.goal === "recherche") return undefined;
  if (settings.fixed.sig === goalSig()) return settings.fixed.machines;
  settings.fixed = null;
  saveSettings(settings);
  return undefined;
}
/** Filtre de machines du plan affiché (S9) : un par objet, un pour l'énergie, un pour l'argent. */
function filterNow(): PlanMachines {
  return planMachines(settings, planKey(settings.goal, settings.item));
}
function setFilter(pm: PlanMachines): void {
  const key = planKey(settings.goal, settings.item);
  if (!key) return;
  const { [key]: _, ...rest } = settings.machineFilters;
  const empty = pm.mode === "toutes" && !pm.exclure.length && !pm.seulement.length && !pm.noExtraction.length;
  settings.machineFilters = empty ? rest : { ...rest, [key]: pm };
  update();
}

/**
 * Règle le nombre de machines d'un bloc du schéma (S8). null : le libère, comme le remettre au
 * nombre du calcul sans réglage.
 */
const fixFrom = new Map<string, number>();
function setFixed(key: string, n: number | null): void {
  const machines = { ...(fixedNow() ?? {}) };
  const current = plan?.steps.find((s) => s.key === key)?.machines;
  // Nombre d'avant le réglage : celui du calcul sans réglage, ou celui affiché quand on a commencé.
  if (!(key in machines) && current !== undefined) fixFrom.set(key, current);
  const planN = plan?.fixed?.steps.find((s) => s.key === key)?.planMachines ?? fixFrom.get(key);
  if (n === null || !(n >= 1) || (key in machines && n === planN)) delete machines[key];
  else if (!(key in machines) && n === current) return;
  else machines[key] = Math.round(n);
  settings.fixed = Object.keys(machines).length ? { sig: goalSig(), machines } : null;
  updateSoon();
}

/** Réglages chiffrés des machines du plan affiché (S10, écran de la Chemical Plant). */
function msettingsNow(): MachineSettings {
  const key = planKey(settings.goal, settings.item);
  return (key && settings.machineSettings[key]) || {};
}
/**
 * Règle un réglage chiffré d'une machine pour ce plan ; null ou sa valeur par défaut : le retire.
 * `id` null : remet tous les réglages de la machine à leur valeur par défaut (« ↺ 1× »).
 */
function setMachineSetting(machine: string, id: string | null, value: number | null): void {
  const key = planKey(settings.goal, settings.item);
  if (!key) return;
  const def = currentInterfaces().all[machine]?.settings.find((s) => s.id === id)?.number?.default ?? 1;
  const perPlan = { ...(settings.machineSettings[key] ?? {}) };
  const { [id ?? ""]: _, ...rest } = perPlan[machine] ?? {};
  const next = id === null ? {} : value === null || value === def ? rest : { ...rest, [id]: value };
  if (Object.keys(next).length) perPlan[machine] = next;
  else delete perPlan[machine];
  const { [key]: __, ...others } = settings.machineSettings;
  settings.machineSettings = Object.keys(perPlan).length ? { ...others, [key]: perPlan } : others;
  update();
}
/** Données du plan : celles du jeu, réglages chiffrés appliqués (gardées tant que rien ne change). */
let planDataCache: { base: GameData; sig: string; data: GameData } | null = null;
function planData(): GameData {
  const ms = msettingsNow();
  const all = currentInterfaces();
  const sig = `${JSON.stringify(ms)}|${all.sig}`;
  if (!planDataCache || planDataCache.base !== data || planDataCache.sig !== sig) planDataCache = { base: data, sig, data: applyMachineSettings(data, all.all, ms) };
  return planDataCache.data;
}
let planBuiltFrom: GameData | null = null;

function ensurePlan(): void {
  const pd = planData();
  if (!planDirty && plan && planBuiltFrom === pd) return;
  planDirty = false;
  planBuiltFrom = pd;
  const goal = settings.goal;
  rpView = goal === "recherche" ? computeResearch() : null;
  if (goal === "recherche") {
    plan = rpView?.best?.plan ?? solve(pd, playerState(), { item: "", demands: {}, tiers: false });
    return;
  }
  const request = (target: Partial<Parameters<typeof solve>[2]>) =>
    solve(pd, playerState(), {
      item: settings.item,
      ...target,
      poles: POLES,
      distanceTiles: settings.distanceTiles === null ? null : settings.distanceTiles / CELLS_PER_TILE,
      criterion: settings.criteria[goal][0], then: settings.criteria[goal].slice(1),
      forced: settings.forced,
      useUnverified: settings.useUnverified,
      selfPowered: settings.selfPowered,
      maxPollution: settings.maxPollution,
      budget: settings.useBudget && player.money !== null ? player.money : null,
      depots: DEPOTS,
      existing: settings.useExisting ? Object.fromEntries(Object.entries(settings.existing).filter(([id]) => data.items.has(id))) : {},
      fixedMachines: fixedNow(),
      machines: engineFilter(filterNow()),
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
  return { data: planData(), plan: plan!, settings, corrections, goal: settings.goal, research: rpView, fresh: isFresh(), plot: plotOf(player), ifaces: currentInterfaces().all, msettings: msettingsNow() };
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
  else if (page === "recettes") renderRecettes();
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

  // Priorités : seulement celles qui ont un sens pour cet objectif, dans l'ordre du joueur.
  renderCriteria();
  if (goal !== "recherche") renderMachineFilter(v.plan);

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
  const fixBar = $("fix-bar");
  fixBar.innerHTML = renderFixBar(v);
  fixBar.hidden = !fixBar.innerHTML;
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
  for (const t of ["liste", "schema", "pose", "details"] as ResultTab[]) $(`rpanel-${t}`).hidden = t !== tab;
  if (tab === "schema") renderFlowCanvas();
  if (tab === "pose") renderPose();
  if (tab === "details") $("details").innerHTML = renderDetails(viewCtx());
}

// Schéma : cadre navigable comme l'arbre de recherche.
let flowPZ: PanZoom | null = null;
/** Bloc sélectionné dans le schéma (clé d'étape), ou flèche sélectionnée (numéro). */
let flowSel: string | null = null;
let flowEdge: number | null = null;
let flowEdgeBefore: number | null = null;
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
  frame.style.height = `${Math.round(Math.max(240, Math.min(window.innerHeight * 0.7, f.height * s + 8)))}px`;
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
  applyFlowSel();
}

/** Bloc sélectionné : lui et ses flux en évidence, et la barre du bas pour aller plus loin. */
function applyFlowSel(): void {
  const svg = $("flow-canvas").querySelector("svg");
  const hud = $("flow-hud");
  if (flowSel && !svg?.querySelector(`.fn[data-key="${CSS.escape(flowSel)}"]`)) flowSel = null;
  if (svg) {
    svg.classList.toggle("has-sel", !!flowSel);
    for (const el of svg.querySelectorAll<SVGElement>(".sel, .hl")) el.classList.remove("sel", "hl");
    if (flowSel) {
      const k = CSS.escape(flowSel);
      const node = svg.querySelector(`.fn[data-key="${k}"]`)!;
      node.classList.add("sel");
      const r = node.querySelector("rect")!;
      const n = (a: string) => Number(r.getAttribute(a));
      flowPZ?.reveal(n("x") - 20, n("y"), n("width") + 70, n("height")); // à l'écart des boutons de zoom
      for (const el of svg.querySelectorAll<SVGElement>(`[data-from="${k}"], [data-to="${k}"]`)) el.classList.add("hl");
      for (const el of svg.querySelectorAll<SVGElement>(".fe.hl, .fl.hl")) {
        const other = el.dataset.from === flowSel ? el.dataset.to : el.dataset.from;
        if (other) svg.querySelector(`.fn[data-key="${CSS.escape(other)}"]`)?.classList.add("hl");
      }
    }
  }
  // Flèche sélectionnée : elle, son étiquette et ses deux blocs en évidence.
  const hit = flowEdge !== null && !flowSel ? svg?.querySelector<SVGElement>(`.fe-hit[data-edge="${flowEdge}"]`) : null;
  if (!hit) flowEdge = null;
  if (svg && hit) {
    svg.classList.add("has-sel");
    for (const el of svg.querySelectorAll<SVGElement>(`[data-edge="${flowEdge}"]`)) el.classList.add("hl");
    for (const k of [hit.dataset.from!, hit.dataset.to!]) svg.querySelector(`.fn[data-key="${CSS.escape(k)}"]`)?.classList.add("hl");
  }
  hud.hidden = !flowSel && !hit;
  const edge = hit ? { from: hit.dataset.from!, to: hit.dataset.to!, item: hit.dataset.item!, perMin: Number(hit.dataset.rate), loop: !!hit.dataset.loop } : null;
  hud.innerHTML = flowSel ? renderFlowHud(viewCtx(), flowSel, (m) => surveyState(m, REPO_PORTS, currentPorts().local)) : edge ? renderEdgeHud(viewCtx(), edge) : "";
  // « Comment c'est calculé » (S7) : sous la barre du bas, pour le bloc ou la flèche sélectionnés.
  const calc = $("flow-calc");
  calc.innerHTML = flowSel ? renderStepCalc(viewCtx(), recipesCtx(), flowSel) : edge ? renderEdgeCalc(viewCtx(), edge) : "";
  calc.hidden = !calc.innerHTML;
}

function selectFlow(key: string | null): void {
  flowSel = key;
  flowEdge = null;
  refine({ page: "plan", goal: settings.goal, tab: "schema", ...(key ? { step: key } : {}) });
  applyFlowSel();
}

// ---------------------------------------------------------------- plans de pose (E4)

/** Étape choisie et modules déjà calculés pour le plan affiché. */
let poseStep: string | null = null;
const modules = new Map<string, ModulePlan | null>();
/** Demande de chaque module calculé, et ses passages du collecteur central (double rangée), calculés à la demande. */
const moduleReqs = new Map<string, ModuleRequest>();
const modulePassages = new Map<string, PassageOption[]>();
/** Passage choisi pour une étape (« ressource|haut|1 ») ; aucun : les collecteurs sortent par leurs bouts. */
const poseVia = new Map<string, string>();
let modulesFor = "";
let posePZ: PanZoom | null = null;
/** Entrée « Toute l'usine » de la liste des étapes (dans l'adresse : #…/pose/usine-entiere). */
const USINE = USINE_STEP;
/** La vue de départ du plan de pose montre tout (toute l'usine). */
let poseFitAll = false;
/**
 * Calculs de toute l'usine, en arrière-plan (Web Worker) : un par réglage de calcul (recalculée, module par
 * module, collée), gardé tant que le plan, les priorités, les relevés et la parcelle ne changent pas.
 */
type FactoryState = { key: string; plan: FactoryPlan | null; ms: number; job: FactoryJob | null; done: number; label: string; error: string | null; cancelled: boolean; flows: FactoryArrow[] | null };
const factories = new Map<string, FactoryState>();
/** Module ouvert dans le panneau à côté de l'usine (adresse #…/pose/usine-entiere/<étape>). */
let poseFocus: string | null = null;
let focusPZ: PanZoom | null = null;
let focusKey = "";
/** Sélection : « n:<liaison> » ou « c:<poteau> » dans l'usine, « i:<ressource> » dans un module. */
let poseSel: string | null = null;
let focusSel: string | null = null;
let poseKey = "";
const anyName = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;

/** Critères des plans de pose, en mots de joueur. */
const CRIT_TEXT: Record<PoseCriterion, { label: string; why: string }> = {
  place: { label: "Place au sol", why: "la plus petite surface, poteaux compris" },
  forme: { label: "Forme ramassée", why: "le plus grand côté le plus court : rangées repliées plutôt qu'une longue bande" },
  prix: { label: "Prix", why: "le moins de dépenses : croisements, tuyaux, poteaux" },
  pieces: { label: "Pièces à poser", why: "le moins de tuyaux et de poteaux à placer" },
};

/** Priorités du plan (objectif en cours) : l'ordre en une ligne, la liste à réordonner dépliée. */
/** Réglage « Machines » du plan (S9) : mode, machines choisies, raccourcis ; la recherche reste en place. */
function renderMachineFilter(p: Plan): void {
  const pm = filterNow();
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mf-mode"]')) r.checked = r.value === pm.mode;
  $("mf-sum").textContent = filterSummary({ data }, pm) ?? "toutes celles que tu as débloquées";
  const body = renderFilterBody({ data }, pm, p);
  $("mf-pick").hidden = pm.mode === "toutes";
  $("mf-label").textContent = body.label;
  $("mf-chips").innerHTML = body.chips;
  input("mf-search").placeholder = body.placeholder;
  $("mf-more").innerHTML = body.more;
}

function renderCriteria(): void {
  const goal = settings.goal;
  const list = settings.criteria[goal];
  // Repliée : les trois premières suffisent (les suivantes ne jouent qu'à égalité).
  $("criteria-order").innerHTML =
    list
      .slice(0, 3)
      .map((c, i) => `<span class="ord"><b>${i + 1}</b> ${esc(CRITERION_TEXT[c].label)}</span>`)
      .join(`<span class="sep" aria-hidden="true">›</span>`) + (list.length > 3 ? `<span class="sep">› …</span>` : "");
  $("criteria-list").innerHTML = renderPrioItems(list.map((c, i) => ({ key: c, label: CRITERION_TEXT[c].label, why: i === 0 ? criterionWhy(goal, c) : CRITERION_TEXT[c].why })));
  $("criterion-hint").textContent = criterionHint(goal, list[0]!);
}

function setCriteria(list: Criterion[], focus?: Criterion): void {
  settings.criteria = { ...settings.criteria, [settings.goal]: list };
  update();
  if (focus) focusItem($("criteria-list"), focus);
}

function renderPriority(): void {
  $("pose-priority").innerHTML = renderPrioItems(settings.posePriority.map((k) => ({ key: k, ...CRIT_TEXT[k] })));
}

function setPriority(list: PoseCriterion[], focus?: PoseCriterion): void {
  settings.posePriority = list;
  saveSettings(settings);
  renderPose();
  if (focus) focusItem($("pose-priority"), focus);
}

function moduleOf(key: string): ModulePlan | null {
  const pts = currentPorts();
  if (modulesFor !== `${signature}|${settings.tier3Only}|${settings.posePriority.join(",")}|${pts.sig}`) {
    modules.clear();
    moduleReqs.clear();
    modulePassages.clear();
    poseVia.clear();
    modulesFor = `${signature}|${settings.tier3Only}|${settings.posePriority.join(",")}|${pts.sig}`;
  }
  if (!modules.has(key)) {
    const s = plan?.steps.find((x) => x.key === key);
    const m = s ? data.machines.get(s.machine) : undefined;
    const base = s && m ? requestFromStep(s, (id) => !!data.items.get(id)?.isFluid, m.cost) : null;
    const req = base && { ...base, tier3Only: settings.tier3Only, priority: settings.posePriority };
    if (req) moduleReqs.set(key, req);
    modules.set(key, req && m ? designModule(req, pts.machines[m.id] ?? null, m.size, CATALOG, anyName) : null);
  }
  return modules.get(key) ?? null;
}

/** Passages possibles du collecteur central d'un module en double rangée (vide sinon). */
function passagesOf(key: string, mod: ModulePlan): PassageOption[] {
  if (!modulePassages.has(key)) {
    const req = moduleReqs.get(key);
    const m = data.machines.get(mod.machine);
    modulePassages.set(key, req && m ? passageOptions(mod, req, currentPorts().machines[m.id] ?? null, m.size, CATALOG, anyName) : []);
  }
  return modulePassages.get(key)!;
}

const viaKey = (o: Pick<PassageOption, "item" | "passage">) => `${o.item}|${o.passage.row}|${o.passage.after}`;

/** Après le nom d'une étape : d'où viennent les ports de sa machine, quand ce n'est pas le dépôt. */
function portsLabel(machine: string): string {
  const st = surveyState(machine, REPO_PORTS, currentPorts().local);
  return st === "local" ? " (relevé local)" : st === "manquant" ? " (ports supposés)" : "";
}

function renderPose(): void {
  const p = plan!;
  const choices = p.steps.filter(isPosable);
  const sel = $<HTMLSelectElement>("pose-step");
  if (!choices.length) {
    sel.innerHTML = "";
    $("pose-head").innerHTML = `<p class="muted">Aucune étape à poser dans ce plan (les arbres et les centrales composées ne sont pas encore dessinés).</p>`;
    $("pose-frame").hidden = true;
    $("pose-legend").innerHTML = $("pose-details").innerHTML = $("pose-links").innerHTML = "";
    return;
  }
  if (!poseStep || (poseStep !== USINE && !choices.some((s) => s.key === poseStep))) poseStep = (choices.find((s) => p.finals.includes(s.key)) ?? choices[0]!).key;
  sel.innerHTML =
    `<option value="${USINE}"${poseStep === USINE ? " selected" : ""}>Toute l'usine (proposition, calculée en arrière-plan)</option><optgroup label="Un module par étape">` +
    choices.map((s) => `<option value="${esc(s.key)}"${s.key === poseStep ? " selected" : ""}>${esc(`${s.machines} × ${anyName(s.machine)} — ${anyName(s.item)}`)}${portsLabel(s.machine)}</option>`).join("") +
    `</optgroup>`;
  input("pose-tier3").checked = settings.tier3Only;
  renderPriority();
  if (poseStep === USINE) return renderFactory();
  showFocus(null);
  const base = moduleOf(poseStep);
  $("pose-frame").hidden = !base;
  if (!base) {
    $("pose-head").innerHTML = `<p class="muted">Pas de plan de pose pour cette étape.</p>`;
    $("pose-links").innerHTML = "";
    return;
  }
  // Double rangée : le collecteur central peut sortir par un passage entre deux machines (au choix).
  const vias = base.template === "double rangée" && base.folds === 1 ? passagesOf(poseStep, base) : [];
  const chosen = vias.find((o) => viaKey(o) === poseVia.get(poseStep!));
  const m = chosen?.plan ?? base;
  const survey = surveyState(m.machine, REPO_PORTS, currentPorts().local);
  const info = renderModuleInfo(m, anyName, survey, plotOf(player));
  const surveyText = survey === "depot" ? "ports relevés" : survey === "local" ? "relevé local, à envoyer" : "ports pas encore relevés";
  const inFactory = fullFactory()?.plan?.boxes.find((b) => b.key === poseStep);
  const factoryLine = inFactory?.mod
    ? `Dans « Toute l'usine », ce module est recalculé${turnText(inFactory.rot) ? ` et ${turnText(inFactory.rot)}` : ""} (${inFactory.w} × ${inFactory.h} cases) : <button type="button" class="link" data-focus="${esc(poseStep)}">voir sa version dans l'usine</button>`
    : `<button type="button" class="link" data-focus="${esc(poseStep)}">Voir sa version dans « Toute l'usine »</button> <span class="muted">(recalculée et tournée vers ses voisins${fullFactory()?.plan ? "" : ", calcul en arrière-plan"})</span>`;
  $("pose-links").innerHTML = `<p class="pose-actions"><button type="button" class="link" data-flow="${esc(poseStep)}">Voir cette étape au schéma</button> · <button type="button" class="link" data-edit="${esc(m.machine)}">${esc(anyName(m.machine))} : ${surveyText} ✎</button></p><p class="pose-actions">${factoryLine}</p>${renderStepLinks(viewCtx(), poseStep)}`;
  $("pose-bar").innerHTML = `<div class="u-bar">${linksButton(settings.usine.links)}<span class="hint">${settings.usine.links ? "Une flèche blanche par liaison, dans le sens du flux, et les câbles de chaque poteau vers ses machines." : "Ou clique un tuyau pour voir les liaisons de sa ressource. Clique une machine pour ouvrir sa fiche."}</span></div>`;
  $("pose-head").innerHTML = info.head + stepSettingLine(poseStep) + renderPassagePick(base, vias, chosen ? viaKey(chosen) : "", anyName, advisedPassages(poseStep));
  $("pose-legend").innerHTML = info.legend;
  $("pose-details").innerHTML = info.details;
  showPoseSvg(renderModuleSvg(m, anyName), `${signature}|${poseStep}|${settings.tier3Only}|${settings.posePriority.join(",")}`);
  setFrameClasses($("pose-frame"), { "u-links": settings.usine.links });
}

/** Réglage à faire sur chaque machine d'une étape (S10), pour le plan de pose et le panneau d'un module. */
function stepSettingLine(key: string): string {
  const st = plan?.steps.find((s) => s.key === key);
  const chips = st && !st.parts ? settingChips(settingLines(currentInterfaces().all, msettingsNow(), st.machine, st.recipeId), "à régler sur chaque machine : ") : "";
  return chips ? `<p class="pose-setting">${chips}</p>` : "";
}

/** Classes d'affichage d'un cadre (les autres classes « u-… » sont retirées). */
function setFrameClasses(frame: HTMLElement, on: Record<string, boolean>): void {
  for (const c of [...frame.classList]) if (c.startsWith("u-") && !(c in on)) frame.classList.remove(c);
  for (const [c, v] of Object.entries(on)) frame.classList.toggle(c, v);
}

/** Dessin du plan de pose (un module, ou toute l'usine) dans le cadre navigable ; `k` : vue gardée si inchangé. */
function showPoseSvg(f: { svg: string; width: number; height: number }, k: string, fitAll = false): void {
  const canvas = $("pose-canvas");
  const frame = $("pose-frame");
  frame.hidden = false;
  $("pose-tip").hidden = true;
  canvas.innerHTML = f.svg;
  poseFitAll = fitAll;
  const fw = frame.clientWidth || 800;
  const sc = flowStartScale({ w: fw, h: window.innerHeight * 0.7 }, { w: f.width, h: f.height });
  frame.style.height = `${Math.round(Math.max(260, Math.min(window.innerHeight * 0.7, f.height * sc + 8)))}px`;
  posePZ ??= new PanZoom(frame, {
    minWidth: 120,
    initialView: (fr, c) => {
      // Toute l'usine : la vue de départ la montre en entier ; un module : taille lisible, centré.
      const k = poseFitAll ? Math.min(fr.w / c.w, fr.h / c.h) * 0.97 : flowStartScale(fr, c);
      const w = fr.w / k;
      const h = fr.h / k;
      return { x: w >= c.w ? (c.w - w) / 2 : 0, y: (c.h - h) / 2, w, h };
    },
  });
  posePZ.attach(canvas.querySelector("svg")!, f.width, f.height, k === poseKey);
  if (k !== poseKey) poseSel = null;
  poseKey = k;
  applySel($("pose-frame"), poseSel, "pose-pick");
}

/** Clé du calcul de toute l'usine : il est refait quand l'un de ces réglages change. */
function factoryKey(v = settings.usine): string {
  const plot = plotOf(player);
  return `${signature}|${settings.tier3Only}|${settings.posePriority.join(",")}|${currentPorts().sig}|${plot ? `${plot.w}x${plot.h}` : ""}|${v.full ? "full" : v.glue ? "glue" : "mod"}`;
}

/** Le calcul pour les réglages en cours, et celui de l'usine recalculée (passages conseillés, version d'un module). */
const currentFactory = () => factories.get(factoryKey()) ?? null;
const fullFactory = () => factories.get(factoryKey({ ...settings.usine, full: true })) ?? null;

/** Tier du tuyau d'une liaison entre modules, d'après son débit. */
const tierOf = (item: string, perMin: number) => pipeFor(CATALOG, data.items.get(item)?.isFluid ? "fluide" : "objet", perMin / 60, settings.tier3Only)?.tier ?? null;

/** Lance le calcul de toute l'usine dans un Web Worker (annule celui en cours, garde ceux qui sont finis). */
function startFactory(): void {
  for (const [k, other] of factories)
    if (other.job || other.key.split("|").slice(0, -1).join("|") !== factoryKey().split("|").slice(0, -1).join("|")) {
      other.job?.cancel();
      factories.delete(k);
    }
  const key = factoryKey();
  const pts = currentPorts();
  const v = settings.usine;
  // Sans parcelle renseignée, le placement n'a pas de limite (seulement la place la plus petite).
  const plot = plotOf(player) ?? { w: 100_000, h: 100_000 };
  const input = factoryInput(
    plan!,
    { name: anyName, isFluid: (id) => !!data.items.get(id)?.isFluid, machine: (id) => data.machines.get(id) ?? null, ports: pts.machines },
    CATALOG,
    plot,
    { priority: settings.posePriority, tier3Only: settings.tier3Only },
    v.full ? { full: true } : { glue: v.glue },
  );
  const st: FactoryState = { key, plan: null, ms: 0, job: null, done: 0, label: "Démarrage", error: null, cancelled: false, flows: null };
  factories.set(key, st);
  const showing = () => factories.get(factoryKey()) === st && !$("rpanel-pose").hidden && poseStep === USINE;
  st.job = runFactory(input, {
    progress: (done, label) => {
      [st.done, st.label] = [done, label];
      if (showing()) updateFactoryProgress();
    },
    done: (fp, ms) => {
      [st.plan, st.ms, st.job] = [fp, ms, null];
      if (showing() || (!$("rpanel-pose").hidden && poseStep !== USINE)) renderPose();
    },
    error: (message) => {
      [st.error, st.job] = [message, null];
      if (showing()) renderPose();
    },
  });
}

function updateFactoryProgress(): void {
  const el = document.getElementById("usine-progress");
  const st = currentFactory();
  if (!el || !st) return;
  el.querySelector<HTMLElement>(".bar i")!.style.width = `${Math.round(st.done * 100)}%`;
  el.querySelector(".pct")!.textContent = `${Math.round(st.done * 100)} %`;
  el.querySelector(".lbl")!.textContent = st.label;
}

/** Passages du collecteur central que toute l'usine (recalculée) a gardés pour cette étape (null : pas encore calculée). */
function advisedPassages(step: string): string[] | null {
  const st = fullFactory();
  if (!st?.plan) return null;
  return (st.plan.passagesKept.get(step)?.choices ?? []).map((c) => `${c.item}|${c.passage.row}|${c.passage.after}`);
}

/** Vecteurs des liaisons de l'usine (calculés une fois par résultat). */
function flowsOf(st: FactoryState): FactoryArrow[] {
  return (st.flows ??= st.plan ? factoryFlows(st.plan) : []);
}

/** « Toute l'usine » dans l'onglet Plans de pose : barre d'options, avancement du calcul, puis la vue de dessus. */
function renderFactory(): void {
  if (!currentFactory()) startFactory();
  const st = currentFactory()!;
  $("pose-links").innerHTML = "";
  $("pose-bar").innerHTML = renderFactoryBar(settings.usine);
  if (!st.plan) {
    $("pose-frame").hidden = true;
    showFocus(null);
    $("pose-legend").innerHTML = $("pose-details").innerHTML = "";
    const pct = Math.round(st.done * 100);
    $("pose-head").innerHTML = st.error
      ? `<p class="warn-text">Le calcul de toute l'usine a échoué : ${esc(st.error)}</p><p><button type="button" data-usine="run">Relancer le calcul</button></p>`
      : st.cancelled
        ? `<p class="muted">Calcul de toute l'usine annulé.</p><p><button type="button" data-usine="run">Relancer le calcul</button></p>`
        : `<p class="mod-sum"><b>Toute l'usine — proposition</b> : calcul en arrière-plan${settings.usine.full ? ", quelques secondes à une minute selon la taille du plan" : ""}. Tu peux continuer à utiliser le site pendant ce temps.</p>
          <div class="progress" id="usine-progress" role="status" aria-live="polite"><span class="lbl">${esc(st.label)}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="pct">${pct} %</span><button type="button" data-usine="cancel">Annuler</button></div>`;
    return;
  }
  const plot = plotOf(player);
  const info = renderFactoryInfo(st.plan, anyName, plot, tierOf, st.ms, !settings.usine.full && settings.usine.glue);
  $("pose-head").innerHTML = info.head;
  $("pose-legend").innerHTML = info.legend;
  $("pose-details").innerHTML = info.details;
  // Le panneau d'abord : il change la largeur du cadre de l'usine.
  showFocus(poseFocus);
  showPoseSvg(renderFactorySvg(st.plan, anyName, plot, tierOf, flowsOf(st)), `${st.key}|${USINE}`, true);
  setFrameClasses($("pose-frame"), factoryFrameClasses(settings.usine, st.plan.full));
  markFocused();
}

/** Le module ouvert est encadré dans l'usine. */
function markFocused(): void {
  for (const g of $("pose-canvas").querySelectorAll(".u-mod")) g.classList.toggle("focus", (g as SVGGElement).dataset.mod === poseFocus);
}

/** Panneau du module à côté de l'usine (null : fermé), dans la version que l'usine utilise. */
function showFocus(key: string | null): void {
  const panel = $("pose-focus");
  const split = $("pose-split");
  const st = currentFactory();
  const out = key && st?.plan ? renderFactoryModule(st.plan, key, anyName, tierOf, flowsOf(st)) : null;
  panel.hidden = !out;
  split.classList.toggle("focus", !!out);
  document.body.classList.toggle("usine-wide", !!out);
  if (!out) {
    panel.classList.remove("full");
    document.body.classList.remove("focus-full");
    return;
  }
  $("focus-title").textContent = out.title;
  $("focus-bar-opts").innerHTML = `<div class="u-bar">${linksButton(settings.usine.links)}<span class="hint">Clique une machine pour ouvrir sa fiche, un tuyau pour voir ses liaisons.</span></div>`;
  $("focus-head").innerHTML = out.head + stepSettingLine(key!) + `<p class="pose-actions"><button type="button" class="link" data-pose="${esc(key!)}">Plan de pose seul de cette étape</button> · <button type="button" class="link" data-flow="${esc(key!)}">Voir au schéma</button></p>`;
  $("focus-legend").innerHTML = out.legend;
  $("focus-details").innerHTML = out.details;
  const frame = $("focus-frame");
  $("focus-canvas").innerHTML = out.svg.svg;
  focusPZ ??= new PanZoom(frame, { minWidth: 80, fitOnReset: true });
  const k = `${st!.key}|${key}`;
  focusPZ.attach($("focus-canvas").querySelector("svg")!, out.svg.width, out.svg.height, k === focusKey);
  if (k !== focusKey) focusSel = null;
  focusKey = k;
  setFrameClasses(frame, { "u-links": settings.usine.links });
  applySel(frame, focusSel, null);
}

/**
 * Sélection dans un cadre : une liaison (« n:… ») et les vecteurs de sa ressource, un câble (« c:… ») et tout ce
 * qu'il alimente, ou une ressource d'un module (« i:… ») ; le reste s'estompe.
 */
function applySel(frame: HTMLElement, sel: string | null, pickId: string | null): void {
  for (const el of frame.querySelectorAll(".on")) el.classList.remove("on");
  for (const el of document.querySelectorAll("#pose-details tr.on")) el.classList.remove("on");
  frame.classList.toggle("hl", !!sel);
  const pick = pickId ? document.getElementById(pickId) : null;
  if (pick) pick.hidden = !sel;
  if (!sel) return;
  const [kind, id] = [sel.slice(0, 1), sel.slice(2)];
  const mark = (q: string) => frame.querySelectorAll(q).forEach((el) => el.classList.add("on"));
  let text = "";
  if (kind === "n") {
    const g = frame.querySelector<SVGGElement>(`[data-sel="${CSS.escape(sel)}"]`);
    mark(`[data-sel="${CSS.escape(sel)}"]`);
    if (g?.dataset.item) mark(`.u-flow[data-item="${CSS.escape(g.dataset.item)}"]`);
    document.querySelectorAll(`#pose-details tr[data-sel="${CSS.escape(sel)}"]`).forEach((el) => el.classList.add("on"));
    text = (g?.dataset.tip ?? "").split("\n")[0]!;
  } else if (kind === "c") {
    // Le câble et tout ce qui est en aval : poteaux, câbles et prises.
    const cables = [...frame.querySelectorAll<SVGGElement>(".u-cable")];
    const down = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const c of cables) if (down.has(c.dataset.parent!) && !down.has(c.dataset.pole!)) grew = !!down.add(c.dataset.pole!);
    }
    for (const c of cables) if (down.has(c.dataset.pole!)) c.classList.add("on");
    for (const l of frame.querySelectorAll<SVGLineElement>(".u-plug")) if (down.has(l.dataset.pole!)) l.classList.add("on");
    text = (frame.querySelector<SVGGElement>(`[data-sel="${CSS.escape(sel)}"]`)?.dataset.tip ?? "").split("\n")[0]!;
  } else {
    mark(`.m-pipe[data-item="${CSS.escape(id)}"], .m-flow[data-item="${CSS.escape(id)}"]`);
    text = `${anyName(id)} : liaisons dans le sens du flux`;
  }
  if (pick) pick.innerHTML = `<span>${esc(text)}</span> <button type="button" class="link small" data-unsel>✕</button>`;
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
  set("p-plotw", player.plotW);
  set("p-ploth", player.plotH);
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
  const everything = allVerifyEntries(v);
  $("verify-all-count").textContent = String(new Set(everything.map((x) => `${x.scope}|${x.id}`)).size);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-vscope]")) b.setAttribute("aria-checked", String((b.dataset.vscope === "all") === verifyAll));
  const q = verifyFilter.trim().toLowerCase();
  const match = (x: (typeof everything)[number]) => {
    if (!q) return true;
    const r = x.scope === "recette" ? data.recipes.get(x.id) : undefined;
    const names = [x.id, x.item && itemN(v, x.item), x.scope === "machine" ? machineN(v, x.id) : r ? machineN(v, r.machine) : "", ...(r ? Object.keys({ ...r.inputs, ...r.outputs }).map((i) => itemN(v, i)) : [])];
    return names.some((n) => n && n.toLowerCase().includes(q));
  };
  // Lien ⚠ (page Recettes, schéma) : seulement les valeurs de cette recette ou de cette machine.
  const vt = route.page === "donnees" ? route.verify : undefined;
  const shown = vt ? everything.filter((x) => x.scope === vt.scope && x.id === vt.id) : (verifyAll ? everything : v.plan.verify).filter(match);
  $("verify-focus").innerHTML = vt ? verifyFocusBanner(vt, shown.length) : "";
  $("verify").innerHTML = renderVerify(v, { entries: shown, notes: { ...repoNotes, ...notes }, all: verifyAll });
  $("verify-count").textContent = String(v.plan.verify.filter((x) => x.used).length);
  $("corrections").innerHTML = renderCorrections(v);
  $("corrections-count").textContent = String(countCorrections(corrections));
  $("data-errors").innerHTML = dataErrors.length ? `<div class="banner bad">Corrections ignorées :<ul>${dataErrors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : "";
}

/** Bandeau des valeurs d'une seule recette ou machine (arrivée par un lien ⚠). */
function verifyFocusBanner(vt: NonNullable<Route["verify"]>, count: number): string {
  const r = vt.scope === "recette" ? data.recipes.get(vt.id) : undefined;
  const machine = vt.scope === "machine" ? vt.id : r?.machine;
  const name = vt.scope === "machine" ? machineN(viewCtx(), vt.id) : `${machineN(viewCtx(), r?.machine ?? "")} → ${itemN(viewCtx(), Object.keys(r?.outputs ?? {})[0] ?? "")}`;
  const back = machine ? ` · <a href="${recipeHref("machine", machine)}">fiche de la machine</a>` : "";
  return `<div class="banner">Valeurs à vérifier de <b>${esc(name)}</b>${count ? "" : " : il n'en reste aucune (déjà corrigée ? voir « Mes corrections » plus bas)"}${back} · <a href="#donnees/verifier">voir toutes les valeurs</a></div>`;
}

// ---------------------------------------------------------------- recettes

/** Image d'un objet ou d'une machine : celle du joueur, sinon la vignette du wiki. */
function pictureOf(kind: EntryKind, id: string): Picture | null {
  const key = `${kind}|${id}`;
  const wiki = WIKI_IMAGES.get(key);
  if (myImages[key]) return { src: myImages[key]!, own: true, fallback: !!wiki };
  if (!wiki) return null;
  return { src: `${import.meta.env.BASE_URL}${wiki.file}`, own: false, credit: { label: `wiki Miraheze, ${wiki.license}`, url: wiki.url } };
}

function recipesCtx(): RecipesCtx {
  const p = toEngineProgress(prog);
  // Sans progression renseignée, tout serait « à débloquer » : on n'affiche pas les cadenas.
  const fresh = isFresh();
  return {
    data,
    image: pictureOf,
    locked: (r) => (fresh || !r.research || !data.nodes.has(r.research) || isNodeUnlocked(data, p, r.research) ? null : nodeName(r.research)),
    edit: rcEdit,
    mine: corrections,
    highlight: route.page === "recettes" ? (route.card?.craft ?? null) : null,
  };
}

function renderRecettes(ctx?: RecipesCtx): void {
  const card = route.page === "recettes" ? (route.card ?? null) : null;
  // Autre fiche : le mode correction reste, ses formulaires ouverts se ferment.
  const key = card ? `${card.kind}/${card.id}` : "";
  if (key !== rcEditCard) {
    rcEditCard = key;
    if (rcEdit && !(rcEdit.newItem && !rcEdit.newItem.inDraft)) rcEdit = { ...EDIT_ON };
  }
  ctx ??= recipesCtx();
  const standalone = rcEdit?.newItem && !rcEdit.newItem.inDraft ? rcEdit.newItem : null;
  $("rc-layout").classList.toggle("has-card", !!card || !!standalone);
  $("rc-layout").classList.toggle("rows", rcPrefs.view === "lignes");
  const rejected = dataErrors.filter((e) => /^(added|removed)\//.test(e));
  const banner = rejected.length ? `<div class="banner bad">Ajouts ou retraits ignorés :<ul>${rejected.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : "";
  $("rc-card").innerHTML =
    banner +
    (standalone
      ? `<article class="rc-card">${renderItemForm(standalone)}<p class="hint">L'objet s'ajoute à la liste ; sa fiche permet ensuite d'ajouter les crafts qui le donnent ou l'utilisent.</p></article>`
      : card
        ? card.kind === "objet"
          ? renderItemCard(ctx, card.id)
          : renderMachineCard(ctx, card.id)
        : `<p class="rc-hello panel">Choisis un objet ou une machine dans la liste.</p>`);
  if (rcFocusPending) {
    rcFocusPending = false;
    const box = $("rc-card");
    const el = box.querySelector<HTMLInputElement>(".focus") ?? box.querySelector<HTMLInputElement>("[data-rc-itemform] input") ?? box.querySelector<HTMLInputElement>("[data-rc-draft] input");
    el?.focus();
    el?.scrollIntoView({ block: "center" });
    if (el instanceof HTMLInputElement) el.select();
  }
  if (input("rc-q").value !== rcQuery) input("rc-q").value = rcQuery;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-rc-filter]")) b.setAttribute("aria-pressed", String(b.dataset.rcFilter === rcPrefs.filter));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-rc-view]")) b.setAttribute("aria-pressed", String(b.dataset.rcView === rcPrefs.view));
  $<HTMLSelectElement>("rc-sort").value = rcPrefs.sort.key;
  $("rc-dir").textContent = rcPrefs.sort.dir === "asc" ? "▲" : "▼";
  $("rc-dir").title = rcPrefs.sort.dir === "asc" ? "Ordre croissant (cliquer pour inverser)" : "Ordre décroissant (cliquer pour inverser)";
  const n = Object.keys(myImages).length;
  $("rc-imgs").innerHTML = `Images : vignettes du <a href="https://industrialist.miraheze.org/" target="_blank" rel="noopener">wiki Miraheze</a> (CC BY-NC-SA 4.0), sinon une pastille. Mes images (${n}), gardées dans ce navigateur : <button type="button" class="link" id="rc-img-export"${n ? "" : " disabled"}>exporter</button> · <button type="button" class="link" id="rc-img-import-btn">importer</button>${n ? ` · <button type="button" class="link" id="rc-img-clear">tout effacer</button>` : ""}.`;
  renderRcList(ctx);
}

function renderRcList(ctx: RecipesCtx = recipesCtx()): void {
  rcEntries ??= recipeEntries(data);
  const found = searchEntries(rcEntries, rcQuery, rcPrefs.filter);
  // Avec une recherche et le tri par nom, les noms qui commencent par la saisie restent devant.
  const list = rcQuery.trim() && rcPrefs.sort.key === "nom" && rcPrefs.sort.dir === "asc" ? found : sortEntries(data, found, rcPrefs.sort);
  const card = route.page === "recettes" && route.card ? `${route.card.kind}/${route.card.id}` : null;
  $("rc-count").textContent = `${list.length} résultat${list.length > 1 ? "s" : ""}`;
  $("rc-list").innerHTML = rcPrefs.view === "lignes" ? renderEntryRows(ctx, list, card, rcPrefs.sort) : renderEntryList(ctx, list, card);
}

/** La liste défile jusqu'à l'objet ouvert (sinon, sur ordinateur, on ne le voit pas). */
function revealRcCurrent(): void {
  const box = $("rc-list");
  const on = box.querySelector<HTMLElement>(".rc-tile.on, tr.on");
  if (!on || box.scrollHeight <= box.clientHeight) return;
  const b = box.getBoundingClientRect();
  const r = on.getBoundingClientRect();
  if (r.top < b.top + 30 || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 3;
}

/** Fiche ouverte depuis le schéma : le craft mis en évidence (ou la valeur à corriger) au milieu de l'écran. */
function revealRcCraft(): void {
  const box = $("rc-card");
  const fix = rcRevealPending ? box.querySelector<HTMLInputElement>("input.focus") : null;
  rcRevealPending = false;
  const el = fix ?? box.querySelector<HTMLElement>(".rc-craft.on");
  el?.scrollIntoView({ block: "center" });
  if (fix) {
    fix.focus({ preventScroll: true });
    fix.select();
  }
}

/** Image choisie : réduite à 128 px au plus (le navigateur garde peu de place). */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 128 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image illisible"));
    };
    img.src = url;
  });
}

function bindRecettes(): void {
  const prefsChanged = () => {
    savePrefs(rcPrefs);
    renderRecettes();
    revealRcCurrent();
  };
  input("rc-q").addEventListener("input", (e) => {
    rcQuery = (e.target as HTMLInputElement).value;
    renderRcList();
  });
  // Entrée : ouvre le premier résultat.
  input("rc-q").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = $("rc-list").querySelector<HTMLAnchorElement>("a[href^='#recettes/']");
    if (first) location.hash = first.getAttribute("href")!;
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-rc-filter]")) {
    b.addEventListener("click", () => {
      rcPrefs = { ...rcPrefs, filter: b.dataset.rcFilter as ListFilter };
      prefsChanged();
    });
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-rc-view]")) {
    b.addEventListener("click", () => {
      rcPrefs = { ...rcPrefs, view: b.dataset.rcView as ListView };
      prefsChanged();
    });
  }
  const setSort = (key: SortKey, flip: boolean) => {
    const dir = rcPrefs.sort.key === key ? (flip ? (rcPrefs.sort.dir === "asc" ? "desc" : "asc") : rcPrefs.sort.dir) : defaultDir(key);
    rcPrefs = { ...rcPrefs, sort: { key, dir } };
    prefsChanged();
  };
  $<HTMLSelectElement>("rc-sort").addEventListener("change", (e) => setSort((e.target as HTMLSelectElement).value as SortKey, false));
  $("rc-dir").addEventListener("click", () => setSort(rcPrefs.sort.key, true));
  // En-têtes du tableau : un clic trie par la colonne, un second inverse l'ordre.
  $("rc-list").addEventListener("click", (e) => {
    const th = (e.target as Element).closest<HTMLElement>("[data-rc-sort]");
    if (th) setSort(th.dataset.rcSort as SortKey, true);
  });
  // Fiche : image (choisir, retirer) et description recopiée du jeu.
  let imgTarget: string | null = null;
  $("rc-card").addEventListener("click", (e) => {
    const t = e.target as Element;
    const pick = t.closest<HTMLElement>("[data-rc-img]");
    if (pick) {
      imgTarget = pick.dataset.rcImg!;
      return $("rc-file").click();
    }
    const del = t.closest<HTMLElement>("[data-rc-img-del]");
    if (del) {
      const { [del.dataset.rcImgDel!]: _, ...rest } = myImages;
      myImages = rest;
      saveImages(myImages);
      return renderRecettes();
    }
    const descDel = t.closest<HTMLElement>("[data-rc-desc-del]");
    if (descDel) {
      corrections = removeCorrection(corrections, "items", descDel.dataset.rcDescDel!, "description");
      saveCorrections(corrections);
      rebuildData();
      renderRecettes();
    }
  });
  $("rc-card").addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>("form[data-rc-desc]");
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.rcDesc!;
    const text = (form.elements.namedItem("text") as HTMLTextAreaElement).value.trim();
    corrections = text ? setCorrection(corrections, "items", id, "description", text, "description recopiée du jeu") : removeCorrection(corrections, "items", id, "description");
    saveCorrections(corrections);
    rebuildData();
    renderRecettes();
  });
  $("rc-file").addEventListener("change", async () => {
    const box = input("rc-file");
    const file = box.files?.[0];
    box.value = "";
    if (!file || !imgTarget) return;
    try {
      const url = await shrinkImage(file);
      const next = { ...myImages, [imgTarget]: url };
      if (!saveImages(next)) throw new Error("plus de place dans ce navigateur (exporte puis efface des images)");
      myImages = next;
      renderRecettes();
    } catch (err) {
      await ask("Image non enregistrée", `<p>${esc((err as Error).message)}.</p>`, [{ value: "", label: "Fermer", primary: true }]);
    }
  });
  $("rc-imgs").addEventListener("click", async (e) => {
    const id = (e.target as Element).closest<HTMLElement>("button")?.id;
    if (id === "rc-img-export") downloadJson(exportImages(myImages), "mes-images.json");
    else if (id === "rc-img-import-btn") $("rc-img-import").click();
    else if (id === "rc-img-clear") {
      const choice = await ask("Effacer mes images", "<p>Effacer toutes les images que tu as choisies ? Pense à les exporter avant.</p>", [
        { value: "yes", label: "Tout effacer", primary: true },
        { value: "", label: "Annuler" },
      ]);
      if (choice !== "yes") return;
      myImages = {};
      saveImages(myImages);
      renderRecettes();
    }
  });
  $("rc-img-import").addEventListener("change", async () => {
    const box = input("rc-img-import");
    const file = box.files?.[0];
    box.value = "";
    if (!file) return;
    try {
      const next = { ...myImages, ...parseImagesExport(JSON.parse(await file.text())) };
      if (!saveImages(next)) throw new Error("plus de place dans ce navigateur");
      myImages = next;
      renderRecettes();
    } catch (err) {
      await ask("Import impossible", `<p>${esc((err as Error).message)}.</p>`, [{ value: "", label: "Fermer", primary: true }]);
    }
  });
  bindRecettesEdit();
}

// ---------------------------------------------------------------- recettes : « ✎ Corriger » (S6)

/** Enregistre de nouvelles corrections : données et calcul refaits, fiche redessinée. */
function commitCorrections(next: typeof corrections): void {
  corrections = next;
  saveCorrections(corrections);
  rebuildData();
  planDirty = true;
  renderRecettes();
}

/** Section où s'ouvre le formulaire d'un craft, d'après la fiche ouverte. */
function draftAtFor(r: { outputs: Record<string, number | null> }): DraftAt {
  const card = route.page === "recettes" ? route.card : undefined;
  if (!card || card.kind === "machine") return "crafts";
  return Object.hasOwn(r.outputs, card.id) ? "sources" : "uses";
}

/** Le formulaire de craft tel que saisi (relu avant chaque nouveau dessin). */
function readDraft(): CraftDraft | null {
  const d = rcEdit?.draft;
  const box = $("rc-card").querySelector<HTMLElement>("[data-rc-draft]");
  if (!d || !box) return d ?? null;
  const val = (name: string) => box.querySelector<HTMLInputElement>(`:scope > label > input[name="${name}"]`)?.value ?? "";
  const lines = (side: "inputs" | "outputs"): DraftLine[] =>
    [...box.querySelectorAll<HTMLElement>(`.rc-line[data-side="${side}"]`)].map((l) => ({ item: l.querySelector<HTMLInputElement>("input[name=item]")!.value, qty: l.querySelector<HTMLInputElement>("input[name=qty]")!.value }));
  return { ...d, machine: val("machine"), durationS: val("durationS"), energyMFps: val("energyMFps"), inputs: lines("inputs"), outputs: lines("outputs") };
}

function setEdit(next: EditState | null, focus = false): void {
  rcEdit = next;
  rcFocusPending = focus;
  renderRecettes();
}

/** Une case de l'en-tête (prix, facteur RP, prix d'achat) : correction, ou valeur d'un objet que j'ai ajouté. */
function saveFix(input: HTMLInputElement): void {
  const [scope, id, field] = input.dataset.rcFix!.split("|") as [FixScope, string, string];
  const raw = input.value;
  const n = readNum(raw);
  const added = scope === "items" ? corrections.added?.items?.[id] : undefined;
  if (added) {
    if (raw.trim() && (n === null || n < 0)) return void (input.setCustomValidity("nombre ≥ 0, ou vide si inconnu"), input.reportValidity());
    const { source: _, ...rest } = added;
    return commitCorrections(setAddedItem(corrections, id, { ...rest, [field]: raw.trim() ? n : null }));
  }
  const entity = scope === "items" ? data.items.get(id) : data.machines.get(id);
  const current = (entity as Record<string, unknown> | undefined)?.[field];
  if (!raw.trim() || n === null || n < 0) {
    input.value = typeof current === "number" ? String(current) : "";
    if (raw.trim()) {
      input.setCustomValidity("nombre ≥ 0 attendu");
      input.reportValidity();
    }
    return;
  }
  if (n === current) return;
  commitCorrections(setCorrection(corrections, scope, id, field, n, "relevé en jeu (page Recettes)"));
}

/** « Enregistrer » d'un craft modifié : une correction par valeur changée. */
function saveCraftEdit(li: HTMLElement, id: string): void {
  const r = data.recipes.get(id);
  if (!r) return;
  const err = li.querySelector<HTMLElement>("[data-rc-err]")!;
  let next = corrections;
  for (const el of li.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-f]")) {
    const field = el.dataset.f!;
    if (field === "machine") {
      if (el.value !== r.machine) next = setCorrection(next, "recipes", id, "machine", el.value, "relevé en jeu (page Recettes)");
      continue;
    }
    const n = readNum(el.value);
    const m = /^(inputs|outputs)\.(.+)$/.exec(field);
    const current = m ? r[m[1] as "inputs" | "outputs"][m[2]!] : r[field as "durationS" | "energyMFps"];
    if (n === null && !el.value.trim() && current === null) continue;
    const bad = n === null ? "un nombre" : field === "durationS" && n <= 0 ? "une durée > 0" : m && n < 0 ? "une quantité ≥ 0" : null;
    if (bad) {
      err.textContent = `${bad} est attendu pour chaque case (${el.getAttribute("aria-label") ?? field}).`;
      el.focus();
      return;
    }
    if (n !== current) next = setCorrection(next, "recipes", id, field, n, "relevé en jeu (page Recettes)");
  }
  rcEdit = { ...EDIT_ON };
  if (next === corrections) return renderRecettes();
  commitCorrections(next);
}

function saveDraft(): void {
  const d = readDraft();
  if (!d) return;
  const p = parseDraft(data, d);
  if (!p.ok) return setEdit({ ...rcEdit!, draft: { ...d, errors: p.errors, unknown: p.unknown } });
  const taken = (x: string) => data.recipes.has(x) || data.removed.has(x) || !!corrections.added?.recipes?.[x];
  const id = d.id ?? newRecipeId(p.recipe.machine, Object.keys(p.recipe.outputs)[0]!, taken);
  let next = setAddedRecipe(corrections, id, p.recipe);
  if (d.replace) next = setRemoved(next, d.replace, true);
  rcEdit = { ...EDIT_ON };
  commitCorrections(next);
}

function saveItemForm(box: HTMLElement): void {
  const ni = rcEdit?.newItem;
  if (!ni) return;
  const val = (name: string) => box.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? "";
  const draft = ni.inDraft ? readDraft() : null;
  const p = parseItemForm(data, { name: val("name"), fluid: val("fluid"), sellValue: val("sellValue"), researchValue: val("researchValue") });
  if (!p.ok) return setEdit({ ...rcEdit!, draft, newItem: { ...ni, name: val("name"), error: p.error } }, true);
  const id = newItemId(p.item.name, (x) => data.items.has(x) || !!corrections.added?.items?.[x]);
  const next = setAddedItem(corrections, id, p.item);
  if (ni.inDraft && draft) {
    // Retour au craft : le nom saisi est maintenant connu.
    rcEdit = { ...rcEdit!, newItem: null, draft: { ...draft, errors: [], unknown: draft.unknown.filter((u) => u.toLowerCase() !== p.item.name.toLowerCase()) } };
    commitCorrections(next);
    return;
  }
  corrections = next;
  saveCorrections(corrections);
  rebuildData();
  planDirty = true;
  rcEdit = { ...EDIT_ON };
  rcEditCard = `objet/${id}`;
  go({ page: "recettes", card: { kind: "objet", id } });
}

function bindRecettesEdit(): void {
  $("rc-new-item").addEventListener("click", () => setEdit({ ...(rcEdit ?? EDIT_ON), craft: null, draft: null, newItem: { name: rcQuery.trim(), inDraft: false } }, true));
  $("rc-card").addEventListener("click", async (e) => {
    const t = e.target as Element;
    const on = (attr: string) => t.closest<HTMLElement>(`[${attr}]`);
    let el: HTMLElement | null;
    if (on("data-rc-edit-on")) return setEdit({ ...EDIT_ON });
    if (on("data-rc-edit-off")) return setEdit(null);
    if ((el = on("data-rc-focus"))) {
      const key = el.dataset.rcFocus!;
      const [scope, id] = key.split("|") as [FixScope, string];
      return setEdit({ ...EDIT_ON, craft: scope === "recipes" ? id : null, focus: key }, true);
    }
    if ((el = on("data-rc-edit"))) return setEdit({ ...(rcEdit ?? EDIT_ON), craft: el.dataset.rcEdit!, draft: null, newItem: null, focus: null });
    if (on("data-rc-cancel")) return setEdit({ ...(rcEdit ?? EDIT_ON), craft: null, focus: null });
    if ((el = on("data-rc-save"))) return saveCraftEdit(el.closest<HTMLElement>("[data-rc-craftedit]")!, el.dataset.rcSave!);
    if ((el = on("data-rc-replace"))) {
      const r = data.recipes.get(el.dataset.rcReplace!);
      if (r) setEdit({ ...(rcEdit ?? EDIT_ON), craft: null, newItem: null, draft: draftFrom(data, r, draftAtFor(r), "replace") }, true);
      return;
    }
    if ((el = on("data-rc-remove"))) return commitCorrections(setRemoved(corrections, el.dataset.rcRemove!, true));
    if ((el = on("data-rc-restore"))) return commitCorrections(setRemoved(corrections, el.dataset.rcRestore!, false));
    if ((el = on("data-rc-add"))) {
      const [at, id] = el.dataset.rcAdd!.split("|") as [DraftAt, string];
      return setEdit({ ...(rcEdit ?? EDIT_ON), craft: null, newItem: null, draft: newDraft(data, { at, id }) }, true);
    }
    if ((el = on("data-rc-edit-added"))) {
      const r = data.recipes.get(el.dataset.rcEditAdded!);
      if (r) setEdit({ ...(rcEdit ?? EDIT_ON), craft: null, newItem: null, draft: draftFrom(data, r, draftAtFor(r), "id") }, true);
      return;
    }
    if ((el = on("data-rc-del-added"))) return commitCorrections(removeAdded(corrections, "recipes", el.dataset.rcDelAdded!).next);
    if ((el = on("data-rc-del-item"))) {
      const id = el.dataset.rcDelItem!;
      const { next, alsoRemoved } = removeAdded(corrections, "items", id);
      const name = data.items.get(id)?.name ?? id;
      const more = alsoRemoved.length ? ` Les ${alsoRemoved.length} craft${alsoRemoved.length > 1 ? "s" : ""} ajouté${alsoRemoved.length > 1 ? "s" : ""} qui l'utilisent seront effacés aussi.` : "";
      const choice = await ask("Effacer l'objet ajouté", `<p>Effacer « ${esc(name)} » ?${esc(more)}</p>`, [
        { value: "yes", label: "Effacer", primary: true },
        { value: "", label: "Annuler" },
      ]);
      if (choice !== "yes") return;
      corrections = next;
      saveCorrections(corrections);
      rebuildData();
      planDirty = true;
      go({ page: "recettes" });
      return;
    }
    if ((el = on("data-rc-line-add"))) {
      const d = readDraft()!;
      const side = el.dataset.rcLineAdd as "inputs" | "outputs";
      setEdit({ ...rcEdit!, draft: { ...d, [side]: [...d[side], { item: "", qty: "1" }] } });
      const lines = $("rc-card").querySelectorAll<HTMLInputElement>(`.rc-line[data-side="${side}"] input[name=item]`);
      lines[lines.length - 1]?.focus();
      return;
    }
    if ((el = on("data-rc-line-del"))) {
      const d = readDraft()!;
      const [side, i] = el.dataset.rcLineDel!.split("|") as ["inputs" | "outputs", string];
      return setEdit({ ...rcEdit!, draft: { ...d, [side]: d[side].filter((_, k) => k !== Number(i)) } });
    }
    if (on("data-rc-draft-cancel")) return setEdit({ ...(rcEdit ?? EDIT_ON), draft: null, newItem: null });
    if (on("data-rc-draft-save")) return saveDraft();
    if ((el = on("data-rc-newitem"))) return setEdit({ ...rcEdit!, draft: readDraft(), newItem: { name: el.dataset.rcNewitem!, inDraft: true } }, true);
    if (on("data-rc-item-cancel")) return setEdit({ ...(rcEdit ?? EDIT_ON), draft: readDraft(), newItem: null });
    if ((el = on("data-rc-item-save"))) return saveItemForm(el.closest<HTMLElement>("[data-rc-itemform]")!);
    if ((el = on("data-rc-unfix"))) {
      const [scope, id, field] = el.dataset.rcUnfix!.split("|") as [FixScope, string, string];
      return commitCorrections(removeCorrection(corrections, scope, id, field));
    }
  });
  // Cases de l'en-tête : enregistrées quand on les quitte ; Entrée les quitte.
  $("rc-card").addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset?.rcFix) saveFix(t);
  });
  $("rc-card").addEventListener("input", (e) => (e.target as HTMLInputElement).setCustomValidity?.(""));
  $("rc-card").addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (e.key !== "Enter" || !(t instanceof HTMLInputElement)) return;
    if (t.dataset.rcFix) return t.blur();
    if (t.closest("[data-rc-craftedit]")) {
      e.preventDefault();
      t.closest<HTMLElement>("[data-rc-craftedit]")!.querySelector<HTMLButtonElement>("[data-rc-save]")!.click();
    } else if (t.closest("[data-rc-itemform]")) {
      e.preventDefault();
      t.closest<HTMLElement>("[data-rc-itemform]")!.querySelector<HTMLButtonElement>("[data-rc-item-save]")!.click();
    } else if (t.closest("[data-rc-draft]")) {
      e.preventDefault();
      $("rc-card").querySelector<HTMLButtonElement>("[data-rc-draft-save]")!.click();
    }
  });
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
  $("mf-list").innerHTML = filterableMachines({ data }).map((id) => `<option value="${esc(data.machines.get(id)!.name)}"></option>`).join("");
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
  bindPrioList($("criteria-list"), () => settings.criteria[settings.goal], setCriteria);
  $("query").addEventListener("submit", (e) => e.preventDefault());
  // Filtre de machines (S9) : le mode, puis une machine cherchée par son nom (Entrée ou choix dans la liste).
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mf-mode"]')) {
    r.addEventListener("change", () => {
      if (r.checked) setFilter(withMode({ data }, filterNow(), r.value as PlanMachines["mode"], viewCtx().plan));
    });
  }
  const pickMachine = () => {
    const inp = input("mf-search");
    const id = findMachine({ data }, inp.value);
    inp.setCustomValidity(id || !inp.value.trim() ? "" : "Machine inconnue : choisis-la dans la liste.");
    if (!id) return void (inp.value.trim() && inp.reportValidity());
    inp.value = "";
    const pm = filterNow();
    setFilter(pm.mode === "seulement" ? allowMachine({ data }, pm, id) : banMachine({ data }, pm, id));
    input("mf-search").focus();
  };
  $("mf-search").addEventListener("change", pickMachine);
  // Choisie dans la liste proposée : le nom est complet, on l'applique sans attendre Entrée.
  // (Une frappe au clavier attend Entrée : « Press » est le début de « Press MK2 ».)
  $("mf-search").addEventListener("input", (e) => {
    const t = input("mf-search").value.trim().toLowerCase();
    input("mf-search").setCustomValidity("");
    const typed = e instanceof InputEvent && e.inputType !== "insertReplacementText";
    if (t && !typed && filterableMachines({ data }).some((id) => data.machines.get(id)!.name.toLowerCase() === t)) pickMachine();
  });
  $("mf-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pickMachine();
    }
  });

  // Onglets du résultat (flèches gauche/droite comme des onglets).
  const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-rtab]")];
  for (const b of tabs) {
    b.addEventListener("click", () => go({ page: "plan", goal: settings.goal, tab: b.dataset.rtab as ResultTab }));
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
  // « Le mettre en premier » (sous le résumé du plan).
  $("pose-head").addEventListener("click", (e) => {
    // Toute l'usine : annuler ou relancer le calcul ; l'ouvrir (depuis le choix d'un passage).
    const u = (e.target as Element).closest<HTMLElement>("[data-usine]");
    if (u) {
      const st = currentFactory();
      if (u.dataset.usine === "cancel" && st) {
        st.job?.cancel();
        Object.assign(st, { job: null, cancelled: true });
        renderPose();
      } else if (u.dataset.usine === "run") {
        startFactory();
        renderPose();
      } else if (u.dataset.usine === "open") {
        poseStep = USINE;
        refine({ page: "plan", goal: settings.goal, tab: "pose", step: USINE });
        renderPose();
      }
      return;
    }
    const b = (e.target as Element).closest<HTMLElement>("[data-first]");
    if (!b) return;
    const k = b.dataset.first as PoseCriterion;
    setPriority([k, ...settings.posePriority.filter((x) => x !== k)]);
  });
  // Sortie du collecteur central (double rangée) : par les bouts, ou par un passage entre deux machines.
  $("pose-head").addEventListener("change", (e) => {
    const s = (e.target as Element).closest<HTMLSelectElement>("#pose-via");
    if (!s || !poseStep) return;
    if (s.value) poseVia.set(poseStep, s.value);
    else poseVia.delete(poseStep);
    renderPose();
    $("pose-via")?.focus();
  });
  // Liste des priorités : ↑ ↓, ou glisser une ligne.
  bindPrioList($("pose-priority"), () => settings.posePriority, setPriority);
  $("pose-tier3").addEventListener("change", (e) => {
    settings.tier3Only = (e.target as HTMLInputElement).checked;
    saveSettings(settings);
    renderPose();
  });
  $("pose-step").addEventListener("change", (e) => {
    poseStep = (e.target as HTMLSelectElement).value;
    refine({ page: "plan", goal: settings.goal, tab: "pose", step: poseStep });
    renderPose();
  });
  // Toute l'usine (S4) : options de calcul et d'affichage, bouton « Afficher les liaisons » (aussi dans un module).
  const onOption = (e: Event) => {
    const el = (e.target as Element).closest<HTMLInputElement | HTMLButtonElement>("[data-uopt]");
    if (!el) return;
    const opt = el.dataset.uopt as keyof typeof settings.usine;
    const v = { ...settings.usine };
    if (opt === "links") v.links = !v.links;
    else if (el instanceof HTMLInputElement && el.type === "checkbox") v[opt] = el.checked;
    else if (el instanceof HTMLInputElement) v[opt] = el.value === "1";
    else return;
    settings.usine = v;
    saveSettings(settings);
    renderPose();
    document.querySelector<HTMLElement>(`#${el.closest("[id]")?.id ?? "pose-bar"} [data-uopt="${opt}"]${el instanceof HTMLInputElement && el.type === "radio" ? `[value="${el.value}"]` : ""}`)?.focus();
  };
  for (const id of ["pose-bar", "focus-bar-opts"]) {
    $(id).addEventListener("change", onOption);
    $(id).addEventListener("click", (e) => {
      if ((e.target as Element).closest("button[data-uopt]")) onOption(e);
    });
  }
  // Clics dans le dessin : machine → sa fiche (page Recettes) ; tuyau ou câble → ses liaisons ; module de l'usine → son panneau.
  const goMachine = (id: string) => go({ page: "recettes", card: { kind: "machine", id } });
  $("pose-canvas").addEventListener("click", (e) => {
    if (posePZ?.suppressClick) return;
    const t = e.target as Element;
    const machine = t.closest<SVGGElement>("[data-machine]");
    if (machine && poseStep !== USINE) return goMachine(machine.dataset.machine!);
    const sel = t.closest<SVGElement>("[data-sel]")?.dataset.sel ?? (t.closest<SVGGElement>(".m-pipe[data-item]") ? `i:${t.closest<SVGGElement>(".m-pipe")!.dataset.item}` : null);
    if (sel) {
      poseSel = poseSel === sel ? null : sel;
      return applySel($("pose-frame"), poseSel, "pose-pick");
    }
    const mod = t.closest<SVGGElement>("[data-mod]");
    if (mod?.querySelector(".u-box")) return go({ page: "plan", goal: settings.goal, tab: "pose", step: USINE, focus: mod.dataset.mod! });
    if (poseSel) {
      poseSel = null;
      applySel($("pose-frame"), null, "pose-pick");
    }
  });
  $("pose-frame").addEventListener("click", (e) => {
    if (!(e.target as Element).closest("[data-unsel]")) return;
    poseSel = null;
    applySel($("pose-frame"), null, "pose-pick");
  });
  // Liste des liaisons : une ligne sélectionne son tuyau sur le dessin.
  $("pose-details").addEventListener("click", (e) => {
    const tr = (e.target as Element).closest<HTMLTableRowElement>("tr[data-sel]");
    if (!tr) return;
    poseSel = poseSel === tr.dataset.sel ? null : tr.dataset.sel!;
    applySel($("pose-frame"), poseSel, "pose-pick");
  });
  $("focus-canvas").addEventListener("click", (e) => {
    if (focusPZ?.suppressClick) return;
    const t = e.target as Element;
    const machine = t.closest<SVGGElement>("[data-machine]");
    if (machine) return goMachine(machine.dataset.machine!);
    const pipe = t.closest<SVGGElement>(".m-pipe[data-item]");
    const sel = pipe ? `i:${pipe.dataset.item}` : null;
    focusSel = sel && focusSel !== sel ? sel : null;
    applySel($("focus-frame"), focusSel, null);
  });
  // Infobulle du dessin de l'usine (modules, tuyaux, câbles) : suit la souris, cachée pendant un glisser.
  const tip = $("pose-tip");
  $("pose-frame").addEventListener("pointerover", (e) => {
    const t = (e.target as Element).closest<SVGElement>("[data-tip]");
    if (!t || $("pose-frame").classList.contains("dragging")) return;
    tip.textContent = t.dataset.tip!;
    tip.hidden = false;
  });
  $("pose-frame").addEventListener("pointerout", (e) => {
    if ((e.target as Element).closest("[data-tip]")) tip.hidden = true;
  });
  $("pose-frame").addEventListener("pointermove", (e) => {
    if (tip.hidden) return;
    if ($("pose-frame").classList.contains("dragging")) return void (tip.hidden = true);
    const r = $("pose-frame").getBoundingClientRect();
    const x = e.clientX - r.left + 14;
    const y = e.clientY - r.top + 16;
    tip.style.left = `${Math.max(4, Math.min(r.width - tip.offsetWidth - 4, x))}px`;
    tip.style.top = `${y + tip.offsetHeight > r.height - 4 ? Math.max(4, e.clientY - r.top - tip.offsetHeight - 10) : y}px`;
  });
  // Panneau du module : retour à l'usine, plein écran (Échap pour revenir), zoom.
  const setFull = (on: boolean) => {
    $("pose-focus").classList.toggle("full", on);
    document.body.classList.toggle("focus-full", on);
    $("pose-focus").querySelector("[data-focus-full]")?.setAttribute("aria-pressed", String(on));
    requestAnimationFrame(() => focusPZ?.fit());
  };
  $("pose-focus").addEventListener("click", (e) => {
    const t = e.target as Element;
    if (t.closest("[data-focus-back]")) {
      setFull(false);
      return go({ page: "plan", goal: settings.goal, tab: "pose", step: USINE });
    }
    if (t.closest("[data-focus-full]")) return setFull(!$("pose-focus").classList.contains("full"));
    const z = t.closest<HTMLElement>("[data-qzoom]")?.dataset.qzoom;
    if (z === "in") focusPZ?.zoom(1.25);
    else if (z === "out") focusPZ?.zoom(1 / 1.25);
    else if (z === "fit") focusPZ?.fit();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("pose-focus").classList.contains("full")) setFull(false);
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-pzoom]")) {
    b.addEventListener("click", () => {
      const z = b.dataset.pzoom;
      if (z === "in") posePZ?.zoom(1.25);
      else if (z === "out") posePZ?.zoom(1 / 1.25);
      else if (z === "fit") posePZ?.fit();
      else posePZ?.reset();
    });
  }
  // Schéma : un clic sur un bloc le sélectionne ; ailleurs, désélectionne (pas après un glisser).
  $("flow-canvas").addEventListener("click", (e) => {
    if (flowPZ?.suppressClick) return;
    const node = (e.target as Element).closest<SVGGElement>(".fn[data-key]");
    const edge = (e.target as Element).closest<SVGElement>("[data-edge]");
    if (!node && edge) {
      // Flèche (ou son étiquette) : sélectionnée, ou désélectionnée au second clic.
      const i = Number(edge.dataset.edge);
      selectFlow(null);
      flowEdge = i === flowEdgeBefore ? null : i;
      flowEdgeBefore = flowEdge;
      applyFlowSel();
      return;
    }
    flowEdgeBefore = null;
    selectFlow(node ? (node.dataset.key === flowSel ? null : node.dataset.key!) : null);
  });
  // Survol d'une flèche : elle et son étiquette ressortent.
  let hovered: string | null = null;
  const hover = (i: string | null) => {
    const svg = $("flow-canvas").querySelector("svg");
    if (!svg || i === hovered) return;
    for (const el of svg.querySelectorAll(".hover")) el.classList.remove("hover");
    hovered = i;
    if (i !== null) for (const el of svg.querySelectorAll(`[data-edge="${i}"]`)) el.classList.add("hover");
  };
  $("flow-canvas").addEventListener("pointerover", (e) => hover((e.target as Element).closest<SVGElement>("[data-edge]")?.dataset.edge ?? null));
  $("flow-canvas").addEventListener("pointerleave", () => hover(null));
  $("flow-hud").addEventListener("click", (e) => {
    if ((e.target as Element).closest("[data-flow-close]")) selectFlow(null);
    // Écran chiffré (S10) : « ↺ 1× » remet tous ses réglages à leur valeur par défaut.
    const reset = (e.target as Element).closest<HTMLElement>("[data-iset-reset]");
    if (reset) setMachineSetting(reset.dataset.isetReset!, null, null);
    const step = (e.target as Element).closest<HTMLElement>("[data-mset]");
    if (step) stepMachines(Number(step.dataset.mset));
  });
  // Nombre de machines d'un bloc (S8) : −/+, molette sur le nombre, ou un nombre tapé (Entrée, ou en quittant le champ).
  const msetInput = () => $("flow-hud").querySelector<HTMLInputElement>("[data-mset-input]");
  const stepMachines = (d: number) => {
    const inp = msetInput();
    if (!inp) return;
    const n = Math.max(1, (parseInt(inp.value, 10) || 1) + d);
    inp.value = String(n);
    setFixed(inp.dataset.key!, n);
  };
  $("flow-hud").addEventListener(
    "wheel",
    (e) => {
      if (!(e.target as Element).closest(".mset")) return;
      e.preventDefault();
      stepMachines(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  $("flow-hud").addEventListener("change", (e) => {
    const inp = (e.target as Element).closest<HTMLInputElement>("[data-mset-input]");
    if (!inp) return;
    const raw = inp.value.trim();
    const n = parseInt(raw, 10);
    setFixed(inp.dataset.key!, raw ? (n >= 1 ? n : 1) : null);
  });
  // Écran chiffré d'une machine (S10) : un nombre tapé (« 1,67 »), appliqué en quittant le champ ou avec Entrée.
  $("flow-hud").addEventListener("change", (e) => {
    const inp = (e.target as Element).closest<HTMLInputElement>("[data-iset-input]");
    if (inp) setMachineSetting(inp.dataset.machine!, inp.dataset.setting!, parseFactor(inp.value));
  });
  $("flow-hud").addEventListener("keydown", (e) => {
    const inp = (e.target as Element).closest<HTMLInputElement>("[data-iset-input]");
    if (inp && e.key === "Enter") inp.blur();
  });
  $("flow-hud").addEventListener("keydown", (e) => {
    const inp = (e.target as Element).closest<HTMLInputElement>("[data-mset-input]");
    if (!inp) return;
    if (e.key === "Enter") inp.blur();
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      stepMachines(e.key === "ArrowUp" ? 1 : -1);
    }
  });
  // Un ⚠ du panneau « Comment c'est calculé » : la valeur, dans la fiche de l'objet, en mode « ✎ Corriger ».
  $("flow-calc").addEventListener("click", (e) => {
    const warn = (e.target as Element).closest<HTMLElement>("[data-rc-focus]");
    const box = warn?.closest<HTMLElement>("[data-calc-craft]");
    if (!warn || !box) return;
    const key = warn.dataset.rcFocus!;
    const item = box.dataset.calcItem;
    const card = item ? { kind: "objet" as const, id: item } : { kind: "machine" as const, id: box.dataset.calcMachine! };
    rcEdit = { ...EDIT_ON, craft: key.startsWith("recipes|") ? key.split("|")[1]! : null, focus: key };
    rcEditCard = `${card.kind}/${card.id}`;
    rcRevealPending = true;
    go({ page: "recettes", card: { ...card, craft: box.dataset.calcCraft! } });
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
    // Liens entre vues : plan de pose d'une étape, bloc du schéma, bâtiment dans l'éditeur.
    const focus = t.closest<HTMLElement>("[data-focus]");
    if (focus) return go({ page: "plan", goal: settings.goal, tab: "pose", step: USINE, focus: focus.dataset.focus! });
    const pose = t.closest<HTMLElement>("[data-pose]");
    if (pose) return go({ page: "plan", goal: settings.goal, tab: "pose", step: pose.dataset.pose! });
    const flow = t.closest<HTMLElement>("[data-flow]");
    if (flow) return go({ page: "plan", goal: settings.goal, tab: "schema", step: flow.dataset.flow! });
    const edit = t.closest<HTMLElement>("[data-edit]");
    if (edit) return go({ page: "donnees", dataTab: "batiments", machine: edit.dataset.edit! });
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
    // Filtre de machines (S9) : retirer, permettre, ne plus utiliser (réglage, réponse, barre du schéma).
    if (t.closest("[data-mf-clear]")) return setFilter({ ...filterNow(), mode: "toutes" });
    const mfAllow = t.closest<HTMLElement>("[data-mf-allow]");
    if (mfAllow) return setFilter(allowMachine({ data }, filterNow(), mfAllow.dataset.mfAllow!));
    const mfBan = t.closest<HTMLElement>("[data-mf-ban]");
    if (mfBan) {
      if (mfBan.closest("#flow-hud")) selectFlow(null);
      return setFilter(banMachine({ data }, filterNow(), mfBan.dataset.mfBan!));
    }
    if (t.closest("[data-forced-reset]")) {
      settings.forced = {};
      return update();
    }
    if (t.closest("[data-fix-reset]")) {
      settings.fixed = null;
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
    ["p-plotw", "plotW"],
    ["p-ploth", "plotH"],
  ];
  for (const [id, key] of playerFields) {
    $(id).addEventListener("input", (e) => {
      const v = parseOptional((e.target as HTMLInputElement).value);
      $(id).setAttribute("aria-invalid", String(v === "invalide"));
      $(key === "plotW" || key === "plotH" ? "plot-hint" : "player-hint").textContent = v === "invalide" ? "Nombre attendu (ou laisse vide)." : "";
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
    b.addEventListener("click", () => go({ page: "donnees", dataTab: b.dataset.dtab === "batiments" ? "batiments" : "verifier" }));
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
    const [scope, id, field] = btn.dataset.remove!.split("|") as [Scope | "added" | "removed", string, string];
    // Ajouts et retraits (S6) : « added|items|id », « added|recipes|id », « removed|recipes|id ».
    if (scope === "added") corrections = removeAdded(corrections, id as "items" | "recipes", field).next;
    else if (scope === "removed") corrections = setRemoved(corrections, field, false);
    else corrections = removeCorrection(corrections, scope, id, field);
    saveCorrections(corrections);
    rebuildData();
    update();
  });
  $("export").addEventListener("click", () => downloadJson({ ...mergeCorrections(repoOverrides, corrections), _notes: { ...repoNotes, ...notes } }, "overrides.json"));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-vscope]")) {
    b.addEventListener("click", () => {
      verifyAll = b.dataset.vscope === "all";
      renderData();
    });
  }
  $("verify-filter").addEventListener("input", (e) => {
    verifyFilter = (e.target as HTMLInputElement).value;
    renderData();
  });
  // Notes : une explication au lieu d'une valeur, gardée dans ce navigateur et exportée.
  $("verify").addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>("form.note-form");
    if (!form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const k = form.dataset.note!;
    const text = (form.elements.namedItem("note") as HTMLTextAreaElement).value.trim();
    if (text) notes = { ...notes, [k]: { text: text.slice(0, 1000), at: new Date().toISOString() } };
    else {
      const { [k]: _, ...rest } = notes;
      notes = rest;
    }
    saveNotes(notes);
    renderData();
  }, true);
  $("verify").addEventListener("click", (e) => {
    const del = (e.target as HTMLElement).closest<HTMLElement>("[data-note-del]");
    if (!del) return;
    const { [del.dataset.noteDel!]: _, ...rest } = notes;
    notes = rest;
    saveNotes(notes);
    renderData();
  });
  $("import").addEventListener("change", async (e) => {
    const box = e.target as HTMLInputElement;
    const file = box.files?.[0];
    box.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isOverridesFile(parsed)) throw new Error("format inattendu");
      notes = { ...notes, ...cleanNotes((parsed as { _notes?: unknown })._notes) };
      saveNotes(notes);
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
bindRecettes();
const buildings = initBuildings($("bld-root"), data, REPO_PORTS, (id) => refine({ page: "donnees", dataTab: "batiments", machine: id }), REPO_IFACES.machines);
$("back").addEventListener("click", () => history.back());
window.addEventListener("hashchange", showPage);
showPage();
window.setInterval(tickRp, 5000);
