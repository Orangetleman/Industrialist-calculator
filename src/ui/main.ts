// Point d'entrée de l'interface : charge les données, route entre les pages (accueil, une page
// par objectif, Mon usine, arbre, données), appelle solve() et affiche le résultat. Toute la
// logique de calcul est dans src/engine ; le rendu du plan dans plan-view.ts.

import "../styles.css";
import { setFarmLogsMult } from "./modcalc-view.ts";
import { difficultyNote, difficultyOptions, monthOptions, renderGameEffects, type GameField, type GameView } from "./game-settings-view.ts";
import { BLOCKED_RESEARCH, isDifficulty, unlockableNodes, withDifficulty } from "../engine/difficulty.ts";
import type { Blocked } from "./research-view.ts";
import { DEFAULT_POLLUTION, logsMultiplier, TREE_SCRUBBER } from "../engine/game-settings.ts";
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
import { lineExtras, type AsmEnd, factoryInput, type FactoryInput, type FactoryPlan } from "../engine/build/factory.ts";
import { factoryFlows, type FactoryArrow } from "../engine/build/flow.ts";
import { designModule, passageOptions, requestFromStep, type ModulePlan, type ModuleRequest, type PassageOption, type PoseCriterion } from "../engine/build/module.ts";
import type { Step } from "../engine/solve.ts";
import { renderModuleInfo, renderModuleSvg, renderPassagePick } from "./module-view.ts";
import { designDiesel, designFarm, farmPipes, turnFarm, type DieselPlan, type FarmSet } from "../engine/build/assembly.ts";
import { dieselConfigs, type DieselConfig, type DieselReading } from "../engine/modular-calc.ts";
import { DEFAULT_DIESEL, dieselRecipeFor, loadDieselReadings, renderDieselHud, saveDieselReadings, type DieselChoice } from "./diesel.ts";
import { rangesButton, renderDieselInfo, renderDieselSvg, renderFarmInfo, renderFarmSvg } from "./assembly-view.ts";
import { factoryFrameClasses, incompleteMachines, linksButton, renderFactoryBar, renderFactoryInfo, renderFactoryEvac, renderFactoryModule, renderFactoryModules, renderFactoryMore, renderFactorySvg, setDrawnInside, turnText } from "./factory-view.ts";
import { loadFactory, runFactory, saveFactory, type FactoryJob } from "./factory-job.ts";
import { buildGameData, type GameData, type RawFiles } from "../engine/data.ts";
import { addMachines, solve, type Plan, type PlayerState, type SolveRequest } from "../engine/solve.ts";
import type { Criterion } from "../engine/choose.ts";
import type { OverridesFile } from "../engine/types.ts";
import type { EnergyFile, InterfacesFile, LogisticsFile, PortsEntry, PortsFile, PowerFile, ResearchStationsFile } from "../engine/extension-types.ts";
import { applyMachineSettings, type Interfaces, type MachineSettings, mergeInterfaces } from "../engine/interfaces.ts";
import interfacesJson from "../../data/interfaces.json";
import modularJson from "../../data/modular.json";
import mineshaftJson from "../../data/mineshaft.json";
import { DEFAULT_MINESHAFT, sameMineshaft, withMineshaft, type MineshaftChoice, type MineshaftFile } from "../engine/mineshaft.ts";
import { mineshaftPatch, renderMineshaftHud, type MineshaftView } from "./mineshaft-view.ts";
import type { ModularFile } from "../engine/modular.ts";
import { parseFactor, renderScreenInputs, settingChips, settingLines } from "./iface-view.ts";
import { designResearch, groupSum, rpParams, type RpResult, type StationKind, type TierSum } from "../engine/research-points.ts";
import { balanceTimeline, emptySetup, nominalRate, TIERS, proposeAddStations, rateAt, researchModel, timeToReach, withAddedStations, type ResearchSetup, type RpModel, type RpTier } from "../engine/research-balance.ts";
import { fillResearchCalc, renderResearchControl, renderResearchForm, renderResearchOut, researchHow } from "./research-mine.ts";
import { parseJournal as parseRpJournal, addEvent, gameNow, needsRecall, removeEvent, rpAtGame, rpHistory, setPlaying, startJournal, stopAtLastSeen, touch, type RpHistory, type RpJournal } from "../engine/rp-history.ts";
import { bindHistoryHover, chartDomain, renderHistory, renderPlay, type Names } from "./rp-chart.ts";
import { dependentsOf, isNodeUnlocked, missingNodes, rpCost, unlockUpTo } from "../engine/unlock.ts";
import { colon, esc, fmt, fmtMF, fmtDate, fmtDuration, fmtMoney, fmtMoneyShort, fmtPct, fmtRP, fmtShort, parseEnergy, parseInput, parseNum } from "./format.ts";
import { icon, iconAt, withIcons } from "./icons.ts";
import { craftableItems } from "../engine/craftable.ts";
import { createItemPalette, itemTile, type PalItem } from "./item-palette.ts";
import { applyStatic } from "../i18n/dom.ts";
import { joinList, KEY_LANG, lang, setLang, startLang, t, type Key, type Lang } from "../i18n/i18n.ts";
import {
  exportProgress,
  loadJournal,
  loadPlayer,
  loadProgress,
  parseOptional,
  parseProgressExport,
  progressSummary,
  renderOwned,
  renderTree,
  rpDelta,
  sanitizeProgress,
  saveJournal,
  savePlayer,
  saveProgress,
  toEngineProgress,
  plotOf,
  type PlayerInfo,
  type ProgressState,
  type TreeView,
} from "./progress.ts";
import { PanZoom } from "./canvas.ts";
import { GraphView, type GraphViewOptions, type GraphViewText } from "./graph-view.ts";
import { applyComparison, balanceGraph, compareWithPlan, exportPollywrath, planToGraph, pollywrathToGraph, solveFromGraph, type Graph, type PollywrathMapFile } from "../engine/graph/index.ts";
import { graphMatchesPlan, keepLinks, linksSig, restoreLinks, loadGraphEdit, storeGraphEdit, type GraphEdit, type StoredGraphEdit } from "./graph-edit.ts";
import { initBuildings } from "./buildings.ts";
import { bindPrioChips, bindPrioList, focusItem, renderPrioChips, renderPrioItems } from "./prio-list.ts";
import { GOAL_ROUTE, goalName, goalTitle, nextStack, PAGES, parseRoute, routeHash, routeTitle, USINE_STEP, type Page, type Route } from "./route.ts";
import { mergeSurveys, surveyState } from "./buildings-model.ts";
import { loadLocalInterfaces, loadLocalSurveys, rawLocalInterfaces, rawLocalSurveys } from "./surveys.ts";
import { layoutResearch, RN_H, RN_W, type ResearchLayout } from "./research-layout.ts";
import { renderNodeBubble, renderNodeDetail, renderResearchSvg } from "./research-view.ts";
import { createTour, SITE_TOUR, type CheckItem } from "./tour.ts";
import { createChecklist, reachedItem } from "./checklist.ts";
import {
  defaultDir,
  draftFrom,
  EDIT_ON,
  fixableHere,
  fixKey,
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
  verifyHref,
} from "./recipes-view.ts";
import { fieldWord, fixAttr, renderPlanBar, stepWarnings, warnButton, warnChips, type PlanBarInput } from "./plan-bar.ts";
import pwMap from "../../data/pollywrath-map.json";
import { parsePollywrathSave, type ImportedGraph, type PollywrathMap } from "./pollywrath-import.ts";
import { exportImages, loadImages, loadPrefs, parseImagesExport, saveImages, savePrefs, type MyImages } from "./recipes-store.ts";
import type { ResearchView } from "./research-plan.ts";
import { allVerifyEntries, itemN, machineN, renderCorrections, renderVerify } from "./render.ts";
import { allowMachine, banMachine, filterableMachines, filterSummary, findMachine, renderFilterBody, withMode } from "./mfilter-view.ts";
import { buildRows, buildSignature, criterionHint, criterionWhy, criterionText, planLabel, renderAnswer, renderBuildList, renderDetails, renderEdgeHud, renderFixBar, renderFlowHud, renderStepLinks, isPosable, assemblyKind, type BuildRow, type ViewCtx } from "./plan-view.ts";
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
  cleanSettings,
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
  saveSettings as storeSettings,
  setBuilt,
  setCorrection,
  DEFAULT_SETTINGS,
  displayRate,
  storedRate,
  engineFilter,
  planKey,
  planMachines,
  type Goal,
  type PlanMachines,
  type ResultTab,
  type Scope,
  type Settings,
} from "./state.ts";
import { txt, txtHtml } from "./engine-text.ts";
import { initRemarks, sentNote } from "./remarques-view.ts";
import { initPropositions } from "./propositions-view.ts";
import { initMethods } from "./methods-view.ts";
import { initSandbox } from "./sandbox-view.ts";
import { initShare, type OpenChoice, type ShareWith } from "./share-view.ts";
import { assembleDesign, assembleProfile, hasSandbox, readShareHash, stableJson } from "./share-design.ts";
import { groupsOf, hasContrib, noPrints, printOnto, readPrints, reprint, settled, unprint, type OwnKeys, type PrintGroup, type Prints } from "./print-profile.ts";
import type { Layout } from "../engine/sandbox/layout.ts";
import { frozenSvg } from "./frozen-view.ts";
import { enterLecture, leaveLecture, lecture, ownItem, ownKeys, writeOwn, PROFILE_KEYS, setLectureDesign, setOwnItem, withProfile } from "./profile-store.ts";
import { initDesigns } from "./designs-view.ts";
import { sorted, addDesign, contentOf, duplicate, emptyTree, find, folder, free, inBin, makeDesign, place, readTree, type DesignNode, type DirNode, type Tree } from "./designs-model.ts";
import { fnv } from "../engine/share/print.ts";
import { ENGINE_VERSION, type DesignProfile, decodeDesign, designPrint, encodeDesign, SITE_VERSION, type Design } from "../engine/share/index.ts";
import { layoutFromFactory, layoutFromModule, type Converted } from "../engine/schematic/convert.ts";
import type { Schematic } from "../engine/schematic/msch.ts";
import type { ModRange } from "./sandbox-draw.ts";
import { buildSandboxCatalog, type SbCatalog } from "../engine/sandbox/index.ts";
import { fact } from "../engine/modular.ts";
import { closePop, openPopMenu, popAnchorEl } from "./popmenu.ts";
import { loadSent, type Piece } from "./remarques.ts";
import type { Message, Text } from "../engine/message.ts";

// Langue (S30) : le choix gardé, sinon celle du navigateur ; avant tout rendu.
setLang(
  startLang(
    (() => {
      try {
        return localStorage.getItem(KEY_LANG);
      } catch {
        return null;
      }
    })(),
    navigator.language,
  ),
);

const REPO_IFACES = interfacesJson as unknown as InterfacesFile;
// Machines modulaires (S13) : la ferme d'arbres et les moteurs diesel relevés entrent dans le calcul.
const REPO_MODULAR = modularJson as unknown as ModularFile;
const MINESHAFT = mineshaftJson as unknown as MineshaftFile;
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: REPO_IFACES, modular: REPO_MODULAR, mineshaft: MINESHAFT } as unknown as RawFiles;
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
// Poteaux qui peuvent alimenter le contrôleur d'une ferme (S14) : ceux des plans de pose (le HV demande un transformateur).
(files as RawFiles).farmPoles = CATALOG.poles.map((p) => ({ id: p.id, name: p.name, rangeCells: p.rangeCells, capacityMFps: p.capacityMFps, w: p.size.w, h: p.size.h, price: p.price }));
const REPO_PORTS = portsJson as unknown as PortsFile;
/** Relevés de bâtiments pour les plans de pose : ceux du dépôt, remplacés par les relevés locaux. */
let ports = { raw: null as string | null, fix: null as unknown, dsl: null as unknown, sig: "", machines: REPO_PORTS.machines, local: {} as Record<string, PortsEntry> };
function currentPorts(): typeof ports {
  const raw = rawLocalSurveys();
  if (raw !== ports.raw) {
    const local = loadLocalSurveys();
    ports = { ...ports, raw, fix: null, machines: mergeSurveys(REPO_PORTS, local), local };
  }
  // La signature suit aussi les corrections et les relevés diesel : ils changent la pose, et d'un profil à l'autre.
  if (ports.fix !== corrections || ports.dsl !== dieselReadings) {
    const extra = countCorrections(corrections) || dieselReadings.length ? `+${fnv(JSON.stringify([corrections, dieselReadings]))}` : "";
    ports = { ...ports, fix: corrections, dsl: dieselReadings, sig: raw + extra };
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
/** Relevés de configuration du moteur diesel notés dans ce navigateur (S18) : ils entrent dans le calcul. */
let dieselReadings: DieselReading[] = loadDieselReadings();
(files as RawFiles).dieselReadings = dieselReadings;
let data: GameData = buildGameData(files, []).data;
let dataErrors: Message[] = [];
let prog: ProgressState = loadProgress();
let player: PlayerInfo = loadPlayer();

// ---------------------------------------------------------------- tutoriel (S24, refait remarque n° 14)
/** Le joueur fait son premier plan pendant le tutoriel : objet et débit sont les siens et restent enregistrés.
 * Seule exception : une partie neuve (aucune recherche renseignée) ne peut rien produire ; le temps du premier
 * parcours, la progression est alors simulée « tout débloqué » (la bulle le dit), puis rétablie. */
let simulated: ProgressState | null = null;
function saveSettings(s: Settings): void {
  storeSettings(s);
}
const KEY_TOUR = "ind-calc:v1:visite";
/** « Modifier la proposition » (G5) : le graphe et le dernier « Appliquer » quand l'étape est atteinte (l'étape avance quand ils changent). */
let tourGraph: { g: Graph | null; solved: Graph | null } = { g: null, solved: null };
/** Graphe édité d'avant le parcours « Modifier la proposition » joué sur une progression simulée : rendu à la fin. */
let tourGedit: { saved: StoredGraphEdit | null } | null = null;
const checklist = createChecklist({ start: (mode) => tour.start(mode), replay: () => tour.start("first") });
const tour = createTour(SITE_TOUR, {
  onStart() {
    checklist.hide(false);
  },
  onStartMode(mode) {
    // Le premier parcours et les mini-parcours de Planifier (construire, régler) ont besoin d'un plan : partie neuve → simulée.
    if ((mode === "first" || mode === "poser" || mode === "regler" || mode === "modifier") && !prog.unlocked.length && !simulated) {
      simulated = prog;
      if (mode === "modifier") tourGedit = { saved: gedit?.touched ? storeGraphEdit(gedit) : null };
      prog = { ...prog, unlocked: [...data.nodes.values()].filter((n) => !n.isRoot).map((n) => n.id) };
      planDirty = true;
      render();
    }
  },
  go(hash) {
    location.hash = hash;
  },
  test(cond) {
    if (cond === "item") return settings.goal === "objet" && !isBlank("objet") && data.items.has(settings.item);
    if (cond === "schema") return settings.resultTab === "schema";
    if (cond === "simulated") return simulated !== null;
    if (cond === "drawer") return !$("plan-drawer").hidden;
    if (cond === "noplan") return settings.goal !== "objet" || isBlank("objet");
    if (cond === "gnode") return !!graphView?.selected;
    if (cond === "gchanged") return !!graphView?.graph && graphView.graph !== tourGraph.g;
    if (cond === "gsolved") return !!gedit?.solved && gedit.solved !== tourGraph.solved;
    return true;
  },
  onReach(mode, index) {
    if (mode === "modifier") tourGraph = { g: graphView?.graph ?? null, solved: gedit?.solved ?? null };
    const it = reachedItem(mode, index);
    if (it) checklist.check(it);
  },
  onEnd(mode) {
    try {
      localStorage.setItem(KEY_TOUR, "1");
    } catch {
      // stockage indisponible : la carte d'accueil reviendra à la prochaine première visite
    }
    if (mode !== "first") checklist.check(mode as CheckItem);
    if (simulated) {
      // Le graphe modifié pendant un parcours simulé ne reste pas : on rend celui d'avant (ou la proposition).
      if (tourGedit) {
        gedit = tourGedit.saved ? loadGraphEdit(tourGedit.saved) : null;
        graphDoc = null;
        tourGedit = null;
        saveGraphEdit(true);
      }
      prog = simulated;
      simulated = null;
      planDirty = true;
      render();
    }
    checklist.show();
  },
});
/** Journal des RP (S21) : temps de jeu, relevés, configurations, dépenses, sessions. */
/** Démarrage en session de lecture alors que « Je joue » du joueur était resté actif : rappelé au retour à sa partie. */
let ownAway = (() => {
  const j = lecture() ? ownJournal() : null;
  return !!j && needsRecall(j, Date.now());
})();
function ownJournal(): RpJournal | null {
  try {
    return parseRpJournal(JSON.parse(ownItem(PROFILE_KEYS.journal) ?? "null"));
  } catch {
    return null;
  }
}
/** Pendant une lecture, l'horloge du joueur reste tenue (le site est ouvert) : rien d'autre de sa partie n'est écrit. */
function touchOwn(): void {
  const j = lecture() && !ownAway ? ownJournal() : null;
  if (j?.clock.playing) setOwnItem(PROFILE_KEYS.journal, JSON.stringify(touch(j, Date.now())));
}
let journal: RpJournal = loadJournal() ?? startJournal(Date.now(), player);
saveJournal(journal);
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
// S33 : sur un écran étroit (liste sans colonne à elle), les tuiles s'affichent par 48 (« Afficher 48 de plus »).
const RC_STEP = 48;
let rcShown = { key: "", n: RC_STEP };
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

/** Graphe édité de Planifier (G4, graph-edit.ts) ; null : l'onglet Schéma suit la proposition. Enregistré au rechargement. */
const KEY_GRAPH = "ind-calc:v1:graph";
let gedit: GraphEdit | null = (() => {
  try {
    return loadGraphEdit(JSON.parse(localStorage.getItem(KEY_GRAPH) ?? "null"));
  } catch {
    return null;
  }
})();
/** Plan montré dans l'aperçu de « Recalculer », repris tel quel par le calcul qui suit « Appliquer ». */
let pendingGraphPlan: { g: Graph; plan: Plan } | null = null;
/** Test de charge en cours (`__grapheCharge`) : ce graphe-là ne s'enregistre pas. */
let graphLoad = false;
let graphSaveTimer: number | undefined;
function saveGraphEdit(now = false): void {
  clearTimeout(graphSaveTimer);
  const write = () => {
    try {
      if (gedit?.touched) localStorage.setItem(KEY_GRAPH, JSON.stringify(storeGraphEdit(gedit)));
      else localStorage.removeItem(KEY_GRAPH);
    } catch {
      // stockage indisponible : le graphe reste pour cette visite
    }
  };
  if (now) write();
  else graphSaveTimer = window.setTimeout(write, 400);
}

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

/** Réglages de partie en vigueur (S50) : 10 % et le mois du jour sans saisie. */
function gameView(): GameView {
  return { pollutionPct: player.pollutionPct ?? DEFAULT_POLLUTION, month: player.month ?? new Date().getMonth() + 1, igloo: player.igloo, scrubber: prog.owned.includes(TREE_SCRUBBER) };
}

/** Recherches que la difficulté retire des plans, pour l'Arbre (S51). */
function blockedView(): Blocked | undefined {
  const ids = BLOCKED_RESEARCH[player.difficulty];
  return ids.length ? { ids: new Set(ids), level: t(`dif.${player.difficulty}` as never) } : undefined;
}

function renderGameBox(): void {
  const g = gameView();
  const dif = $("gs-difficulty") as HTMLSelectElement;
  if (document.activeElement !== dif) dif.innerHTML = difficultyOptions(player.difficulty);
  $("gs-dif-note").innerHTML = difficultyNote(data, player.difficulty);
  setFarmLogsMult(logsMultiplier(g.month, g.igloo));
  const month = $("gs-month") as HTMLSelectElement;
  if (document.activeElement !== month) month.innerHTML = monthOptions(player.month, new Date().getMonth() + 1);
  input("gs-igloo").checked = g.igloo;
  input("gs-scrubber").checked = g.scrubber;
  $("gs-effects").innerHTML = renderGameEffects(data, g);
}

function setGame(p: Partial<PlayerInfo>): void {
  player = { ...player, ...p };
  savePlayer(player);
  planDirty = true;
  renderGameBox();
}

/** Une pastille du plan amène à son réglage : onglet, champ à l'écran, focus. */
function openGameField(field: GameField): void {
  go({ page: "usine", usineTab: "recherche" });
  const id = field === "pollution" ? "p-pollution" : field === "month" ? "gs-month" : field === "difficulty" ? "gs-difficulty" : "gs-igloo";
  setTimeout(() => {
    const el = $(id);
    el.scrollIntoView({ block: "center" });
    el.focus();
    const box = el.closest<HTMLElement>("label") ?? el;
    box.classList.remove("gs-flash");
    void box.offsetWidth;
    box.classList.add("gs-flash");
  }, 80);
}

function playerState(): PlayerState {
  return { ...withDifficulty(data, toEngineProgress(prog), player.difficulty), ...player, pollutionPct: gameView().pollutionPct, month: gameView().month, rp: rpNow() };
}

// ---------------------------------------------------------------- ma recherche (S20)
let rpModelCache: { key: string; data: GameData; model: RpModel | null } | null = null;
/** Le modèle de la recherche du joueur (tiers, seuils, paraboles), d'après « Ma recherche ». */
function rpModel(): RpModel | null {
  if (!RP_PARAMS) return null;
  const key = JSON.stringify([player.research, player.rpPerSec, player.rp]);
  if (rpModelCache?.key !== key || rpModelCache.data !== data) rpModelCache = { key, data, model: researchModel(RP_PARAMS, data, player.research, player.rpPerSec, player.rp) };
  return rpModelCache.model;
}
/** Les tiers qui font évoluer les RP (null : rien de renseigné). */
function rpTiers(): RpTier[] | null {
  const m = rpModel();
  return m && m.source !== "aucune" ? m.tiers : null;
}
/** Temps de jeu pour débloquer ces recherches dans l'ordre, à ton rythme (S22), comme la chronologie de l'objectif recherche. */
function rpEta(ids: string[]): { seconds: number; straight: boolean } | null {
  const m = rpModel();
  const tiers = rpTiers();
  const rp = rpNow();
  if (!m || !tiers || rp === null) return null;
  const tl = balanceTimeline(ids.map((id) => ({ id, rp: data.nodes.get(id)?.rp ?? 0 })), rp, tiers);
  const last = tl?.[tl.length - 1];
  if (!last || !Number.isFinite(last.at)) return null;
  return { seconds: last.at, straight: m.source === "rps" || tiers.every((t) => !Number.isFinite(t.cap)) };
}
/** RP estimés maintenant, avec le plafond souple, en temps de jeu (S21). */
function rpNow(): number | null {
  const g = gameNow(journal.clock, Date.now());
  return rpAtGame(historyTo(g), g);
}

// ---------------------------------------------------------------- historique des RP (S21)
const tiersCache = new Map<string, RpTier[] | null>();
/** Les tiers d'une configuration du journal (même modèle que « Ma recherche »). */
function tiersOf(setup: ResearchSetup | null, rps: number | null): RpTier[] | null {
  if (!RP_PARAMS) return null;
  const key = JSON.stringify([setup, rps]);
  if (!tiersCache.has(key)) {
    if (tiersCache.size > 200) tiersCache.clear();
    const m = researchModel(RP_PARAMS, data, setup, rps, null);
    tiersCache.set(key, m.source === "aucune" ? null : m.tiers);
  }
  return tiersCache.get(key)!;
}
let histCache: { j: RpJournal; end: number; data: GameData; h: RpHistory } | null = null;
/** La courbe du journal jusqu'au temps de jeu `end`. */
function historyTo(end: number): RpHistory {
  if (histCache?.j !== journal || histCache.end !== end || histCache.data !== data) histCache = { j: journal, end, data, h: rpHistory(journal, tiersOf, end) };
  return histCache.h;
}
/** Remplace le contenu seulement s'il change (les boutons rafraîchis toutes les 5 s restent cliquables). */
function setHtml(el: HTMLElement, html: string): void {
  if (el.dataset.html !== html) {
    el.innerHTML = html;
    el.dataset.html = html;
  }
}
/** L'interrupteur : seul le texte change tant que l'état est le même (le bouton reste cliquable). */
function refreshPlay(now: number): void {
  const box = $("rs-play");
  const tmp = document.createElement("div");
  tmp.innerHTML = renderPlay(journal, now);
  const next = tmp.firstElementChild!;
  const cur = box.firstElementChild;
  if (!cur || cur.className !== next.className) return box.replaceChildren(next);
  for (const sel of [".state", ".hint"]) {
    const a = cur.querySelector(sel);
    const b = next.querySelector(sel);
    if (a && b && a.textContent !== b.textContent) a.textContent = b.textContent;
  }
}
/** Change le journal (et le garde). */
function setJournal(j: RpJournal): void {
  if (j === journal) return;
  journal = j;
  saveJournal(journal);
}
const KEY_RP_PERIOD = "ind-calc:v1:rp-period";
let rpPeriod = (() => {
  try {
    const raw = localStorage.getItem(KEY_RP_PERIOD);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? v : 86_400_000;
  } catch {
    return 86_400_000;
  }
})();
let rhJournalOpen = false;
const rhNames: Names = { node: (id) => nodeName(id), item: (id) => itemName(id) };
/** « Je joue » / « Je ne joue plus » (Ma recherche et en-tête). */
function togglePlaying(on: boolean): void {
  setJournal(setPlaying(journal, on, Date.now()));
  planDirty = true;
  renderHeader();
  if (currentPage() === "usine") renderRpLive(true);
}
/** Les deux graphiques et le journal (au changement du journal, de la période, de la largeur). */
function renderHistoryBox(): void {
  const box = document.getElementById("rs-hist");
  if (!box || currentPage() !== "usine") return;
  const gNow = gameNow(journal.clock, Date.now());
  const dom = chartDomain(journal, gNow, rpPeriod);
  const W = Math.max(280, Math.round(box.clientWidth || 600));
  rhJournalOpen = box.querySelector<HTMLDetailsElement>("details.rh-journal")?.open ?? rhJournalOpen;
  box.innerHTML = renderHistory(historyTo(dom[1]), journal, gNow, rpPeriod, W, rhNames, rhJournalOpen);
}
/** Vitesse réelle maintenant (après le seuil), et seuil dépassé ? */
function rpRealRate(): { rate: number; over: boolean } | null {
  const tiers = rpTiers();
  const rp = rpNow();
  if (!tiers || rp === null || !(nominalRate(tiers) > 0)) return null;
  return { rate: rateAt(tiers, rp), over: tiers.some((t) => rp > t.cap) };
}

const nodeName = (id: string) => data.nodes.get(id)?.name ?? id;
const itemName = (id: string) => data.items.get(id)?.name ?? id;

// ---------------------------------------------------------------- pages et adresses

/** Adresses d'avant la refonte. */
const OLD_ROUTES: Record<string, string> = { production: "", accueil: "", recherche: "arbre", verifier: "contribuer", batiments: "contribuer", partie: "usine" };
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
  // Ancien lien du bac à sable (#bac/<code>) : ouvert comme un design partagé (P2), plus chargé d'office.
  if (route.page === "bac" && route.code) {
    legacyCode = route.code;
    delete route.code;
  }
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
/** Titre de l'onglet du navigateur : la vue, puis le nom du site. */
function setDocTitle(): void {
  const page = currentPage();
  const view = page === "plan" ? goalTitle(settings.goal) : t(page === "usine" && route.usineTab === "recherche" ? "page.recherche" : `page.${page}`);
  document.title = `${lecture() ? `${t("lec.title", { name: activeDesign()?.name ?? view })} — ` : ""}${view} — ${t("site.title")}`;
}

/** Partage (P2) : ancien lien du bac à sable en attente, et la vue où revenir après la fenêtre d'un lien. */
let legacyCode: string | null = null;
let shareReturn: string | null = null;

function showPage(): void {
  if (lastHash) scrollOf.set(lastHash, window.scrollY);
  if (readShareHash(location.hash) && lastHash && !readShareHash(lastHash)) shareReturn = lastHash;
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
  setDocTitle();
  document.body.classList.remove("usine-wide");
  document.body.classList.toggle("bac-on", page === "bac");
  document.body.classList.toggle("cmd-on", page === "plan");
  render();
  if (page === "donnees" && route.machine) buildings.show(route.machine);
  if (page === "propositions") props.show();
  // Retour : la vue reprend où on l'avait laissée ; nouvelle page : en haut.
  if (wentBack && scrollOf.has(location.hash)) window.scrollTo(0, scrollOf.get(location.hash)!);
  else if (page !== lastPage || page === "recettes") window.scrollTo(0, 0);
  lastPage = page;
  if (page === "recettes") {
    revealRcCurrent();
    if (route.card?.craft && !wentBack) revealRcCraft();
  }
  // Lien vers un bâtiment (S39, R17) : sa fiche est amenée à l'écran, pas seulement choisie.
  if (page === "donnees" && route.machine && !wentBack) {
    const ed = document.getElementById("bld-editor");
    // Juste sous l'en-tête collant, qui cacherait le nom du bâtiment.
    const top = document.querySelector("header.top")?.getBoundingClientRect().height ?? 0;
    if (ed && !ed.hidden) window.scrollTo(0, Math.max(0, window.scrollY + ed.getBoundingClientRect().top - top - 8));
  }
  if (page === "donnees" && route.verify?.field) {
    const el = document.getElementById(`fix-${route.verify.id}-${route.verify.field}`) as HTMLInputElement | null;
    el?.closest(".vrow")?.classList.add("vfocus");
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  }
  // Partage (P2) : un lien #d=… ouvre la fenêtre « Design partagé » par-dessus la page.
  const sh = readShareHash(location.hash);
  if (sh?.kind === "design") void share.receive(sh.data);
  else if (legacyCode) {
    const c = legacyCode;
    legacyCode = null;
    void share.receiveLegacy(c);
  }
}

// ---------------------------------------------------------------- calcul

/** Objectif recherche : recherches visées, vitesse et plafond nécessaires, installation, chronologie. */
function computeResearch(): ResearchView | null {
  if (!RP_PARAMS) return null;
  const ps = playerState();
  const p = toEngineProgress(prog);
  const rp0 = ps.rp ?? 0;
  // Ma recherche (S20) : vitesse nominale de mes stations, et leurs grandeurs par tier.
  const model = rpModel();
  const mine = settings.rpCurrent && model && model.source !== "aucune" && nominalRate(model.tiers) > 0 ? model : null;
  const current = mine ? nominalRate(mine.tiers) : 0;
  const base: Partial<Record<StationKind, TierSum>> = {};
  if (mine && mine.source !== "rps") for (const t of mine.tiers) if (!t.capMissing) base[t.kind] = t.sum;
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
  const noRate = settings.rpMode === "rate" && settings.rpRate === null;
  const wanted = settings.rpMode === "rate" ? (settings.rpRate ?? 0) : Math.max(0, total - rp0) / (settings.rpMinutes * 60);
  const targetRate = Math.max(0, wanted - current);
  // Rien à calculer : la phrase du site, et si l'objectif est déjà atteint (S32 : plus de lecture des phrases).
  const idle: ResearchView["idle"] = noRate
    ? { text: t("m.rp.noRate"), done: false }
    : settings.rpMode === "node" && !settings.rpNode
      ? { text: t("m.rp.pickNode"), done: false }
      : !nodes.length
        ? { text: t("m.rp.nothing"), done: true }
        : total <= rp0
          ? { text: t("m.rp.enough"), done: true }
          : { text: t("m.rp.fastEnough"), done: true };
  const result: RpResult & Pick<ResearchView, "idle"> =
    !noRate && (targetRate > 0 || settings.rpMode === "rate")
      ? designResearch(data, ps, RP_PARAMS, {
          targetRate: Math.max(targetRate, 1e-6),
          capNeeded,
          satellites: settings.rpSatellites,
          logic: settings.rpLogic,
          criterion: settings.criteria.recherche[0]!, then: settings.criteria.recherche.slice(1),
          useUnverified: settings.useUnverified,
          selfPowered: settings.selfPowered,
          existing: settings.useExisting ? settings.existing : {},
          base,
        })
      : { best: null, others: [], warnings: [], idle };
  const d = result.best?.design;
  // Avec l'installation : du même tier que mes stations, elle s'y ajoute (tier recalculé en entier).
  let withDesign: RpTier[] | null = null;
  if (d) {
    const add = groupSum(RP_PARAMS, d.kind, d.stations, d.items, data, d.logic);
    withDesign = mine
      ? withAddedStations(RP_PARAMS, mine, d.kind, add, { logic: d.logic ? d.stations : 0, extraRate: d.boostRate })
      : [{ kind: d.kind, rate: d.baseRate + d.boostRate, cap: d.cap, circuits: d.circuitRate || undefined }];
  }
  const timeline = withDesign ? balanceTimeline(costs, rp0, withDesign) : null;
  const timelineNow = mine ? balanceTimeline(costs, rp0, mine.tiers) : null;
  // « Ajoute N stations aux tiennes » (niveau détaillé).
  const prop = mine && costs.length + (settings.rpMode === "rate" ? 1 : 0) ? proposeAddStations(RP_PARAMS, data, player.research, mine, wanted, capNeeded) : null;
  let add: ResearchView["add"] = null;
  if (prop && "reason" in prop) add = prop;
  else if (prop) {
    const machines = prop.kind === "rs4" ? ["research-station3", "research-station4"] : [`research-station${prop.kind.slice(2)}`];
    const consumption: Record<string, number> = {};
    if (prop.kind === "rs2") consumption[prop.group.items[0]!] = prop.added * RP_PARAMS.rs2.inputPerSec * 60;
    if (prop.kind === "rs3" || prop.kind === "rs4") for (const i of prop.group.items) consumption[i] = (consumption[i] ?? 0) + prop.added * RP_PARAMS.rs3.inputPerSecPerNode * 60;
    add = {
      ...prop,
      buildingCost: prop.added * machines.reduce((a, m) => a + (data.machines.get(m)?.cost ?? 0), 0),
      consumption,
      timeline: balanceTimeline(costs, rp0, prop.tiers),
    };
  }
  return { ...result, nodes, capNeeded, targetRate, timeline, timelineNow, currentRate: current || null, model: mine, add, mergedTier: d && mine?.tiers.some((t) => t.kind === d.kind && !t.capMissing) && mine.source !== "rps" ? d.kind : null };
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
/** Graphe importé (Industrialist Calculator) du plan affiché, s'il y en a un. */
function importNow(): ImportedGraph | null {
  const key = planKey(settings.goal, settings.item);
  return (key && settings.imports[key]) || null;
}
/**
 * Importe un fichier « …_save.json » du calculateur de Pollywrath. Son graphe s'ouvre tel quel dans
 * l'éditeur (G5 : nœuds, nombres, positions, liaisons, cible), gardé comme un graphe modifié ; son nœud
 * cible donne l'objectif et le débit, ses recettes deviennent les recettes imposées (remarque n°16).
 * Ce qui n'a pas d'équivalent chez nous est signalé, jamais remplacé.
 */
async function importPollywrath(file: File): Promise<void> {
  const close = [{ value: "", label: t("m.close"), primary: true }];
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return void (await ask(t("m.importFailed"), `<p>${esc(t("gv.f.imp.bad"))}</p>`, close));
  }
  const pg = pollywrathToGraph(raw, planData(), pwMap as unknown as PollywrathMapFile, { world: gameView(), fileName: file.name });
  if (!pg || !pg.graph.nodes.length) {
    let msg = t("gv.f.imp.bad");
    try {
      parsePollywrathSave(raw, planData(), pwMap as unknown as PollywrathMap, file.name);
    } catch (err) {
      msg = (err as Error).message;
    }
    return void (await ask(t("m.importFailed"), `<p>${esc(msg)}</p>`, close));
  }
  // Objectif tiré de leur cible (si elle est reconnue) ; sinon l'objectif ne change pas.
  try {
    const res = parsePollywrathSave(raw, planData(), pwMap as unknown as PollywrathMap, file.name);
    settings.goal = "objet";
    if (!settings.entered.includes("objet")) settings.entered = [...settings.entered, "objet"];
    settings.item = res.item;
    settings.mode = "rate";
    settings.rate = res.ratePerMin;
    settings.imports = { ...settings.imports, [planKey("objet", res.item)!]: res.graph };
    syncForm();
  } catch {
    // pas de cible reconnue : le graphe s'ouvre quand même, la cible se marque à la main
  }
  gedit = { sig: goalSig(), graph: pg.graph, solved: null, touched: true };
  graphDoc = null;
  saveGraphEdit(true);
  settings.resultTab = "schema";
  update();
  go({ page: "plan", goal: "objet", tab: "schema" });
  const label = (recipeLabel: string) => `<li>${esc(recipeLabel)}</li>`;
  const html =
    `<p>${esc(t("gv.f.imp.ok"))}</p>` +
    (pg.unknown.length ? `<p>${esc(t("gv.f.imp.unknown"))}</p><ul>${pg.unknown.map((u) => label(u.nodes > 1 ? `${u.label} ×${u.nodes}` : u.label)).join("")}</ul>` : "") +
    (pg.droppedEdges ? `<p class="hint">${esc(t("gv.f.imp.edges", { n: pg.droppedEdges }))}</p>` : "") +
    (pg.targetLost || !pg.graph.target ? `<p class="hint">${esc(t("gv.f.imp.target"))}</p>` : "") +
    `<p class="hint"><a href="https://industrialist-calculator.pages.dev" target="_blank" rel="noopener">${esc(t("pw.credit"))}</a></p>`;
  await ask(t("gv.f.imp.title", { name: pg.name }), html, close);
}

/**
 * Export du graphe de l'éditeur vers Industrialist Calculator (G5) : leur fichier « …_save.json ». Les
 * nœuds sans équivalent chez eux sont signalés avant, et laissés de côté (jamais remplacés).
 */
async function exportGraphPollywrath(): Promise<void> {
  const g = graphView?.graph ?? gedit?.graph;
  if (!g) return;
  const pd = planData();
  const close = [{ value: "", label: t("m.close"), primary: true }];
  const name = g.target ? itemName(g.target.item) : "Industrialist";
  const ex = exportPollywrath(g, pd, pwMap as unknown as PollywrathMapFile, { name, pollutionPct: gameView().pollutionPct ?? null });
  if (!ex.save.data.nodes.length) return void (await ask(t("gv.f.exp.title"), `<p>${esc(t("gv.f.exp.empty"))}</p>`, close));
  const recipeLabel = (id: string) => {
    const r = pd.recipes.get(id);
    const out = r ? Object.keys(r.outputs)[0] : undefined;
    return `${itemName(out ?? id)} (${r ? (pd.machines.get(r.machine)?.name ?? r.machine) : id})`;
  };
  const notes: string[] = [];
  if (ex.missing.length) notes.push(`<p>${esc(t("gv.f.exp.missing"))}</p><ul>${ex.missing.map((m) => `<li>${esc(recipeLabel(m.recipeId))}</li>`).join("")}</ul>`);
  if (ex.droppedEdges) notes.push(`<p class="hint">${esc(t("gv.f.exp.edges", { n: ex.droppedEdges }))}</p>`);
  if (ex.targetLost) notes.push(`<p class="hint">${esc(t("gv.f.exp.target"))}</p>`);
  const fileName = `${name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Industrialist"}_save.json`;
  if (notes.length) {
    const ok = await ask(t("gv.f.exp.title"), notes.join("") + `<p class="hint">${esc(t("gv.f.exp.done", { file: fileName }))}</p>`, [
      { value: "ok", label: t("gv.f.exp.ok"), primary: true },
      { value: "", label: t("m.cancel") },
    ]);
    if (ok !== "ok") return;
  }
  downloadJson(ex.save, fileName);
}

/** Menu « Fichier » de la barre du canevas (G5) : échange avec Industrialist Calculator. */
function openGraphFileMenu(anchor: HTMLElement): void {
  if (popAnchorEl() === anchor) return closePop();
  const opt = (v: string, label: string, note = "") => `<button type="button" data-opt="${v}">${esc(label)}${note ? `<small class="hint">${esc(note)}</small>` : ""}</button>`;
  openPopMenu(document.body, anchor, opt("import", t("gv.f.import"), t("gv.f.note")) + opt("export", t("gv.f.export")), (el) => {
    if (el.dataset.opt === "import") $("pw-import").click();
    else void exportGraphPollywrath();
  }, "pop-menu gv-file-pop");
}

/**
 * Réglages spéciaux d'un nœud dans sa bulle (G5) : ceux de la fiche S62, pour le même plan (écran chiffré
 * S10, moteur diesel S18, Mineshaft Drill), sans rien changer à leur calcul. "" s'il n'y en a pas.
 */
function graphExtra(id: string): string {
  const v = viewCtx();
  if (v.goal === "recherche") return "";
  const node = graphView?.graph?.nodes.find((n) => n.id === id);
  const r = node ? v.data.recipes.get(node.recipeId) : undefined;
  if (!node || !r) return "";
  const m = r.machine;
  const sets: string[] = [renderScreenInputs(v.ifaces?.[m], m, machineN(v, m), v.msettings?.[m])];
  if (m === "diesel-engine-controller" && v.diesel) {
    // Un autre nom de groupe que celui de la fiche : les deux réglages peuvent être à l'écran ensemble.
    sets.push(renderDieselHud(v.diesel.configs, v.diesel.choice, v.diesel.configs.find((c) => c.id === node.recipeId) ?? null).replace(/name="dsl-mode"/g, 'name="dsl-mode-gv"'));
  }
  if (v.mineshaft && m === v.mineshaft.file.meta.machine) {
    const d = Number(/@(\d+)$/.exec(node.recipeId)?.[1]);
    sets.push(renderMineshaftHud(v.mineshaft, Number.isFinite(d) ? d : null, (x) => itemN(v, x)));
  }
  const html = sets.filter(Boolean).join("");
  return html ? `<p class="gv-bx-h">${esc(t("gv.b.extra"))}</p>${html}` : "";
}
/** Fenêtre « graphe importé » : leurs nombres de machines face aux nôtres, recettes non reconnues. */
async function showImported(): Promise<void> {
  const g = importNow();
  if (!g || !plan) return;
  const v = { data: planData() };
  const ours = (id: string) => plan!.steps.filter((s) => s.recipeId === id).reduce((n, s) => n + s.machines, 0);
  const num = (n: number) => fmt(Math.round(n * 100) / 100);
  const rows = g.recipes.map((id) => { const r = v.data.recipes.get(id); const out = r ? Object.keys(r.outputs)[0] : undefined; return `<tr><td>${esc(out ? itemN(v, out) : id)} <span class="hint">(${esc(r ? machineN(v, r.machine) : "")})</span></td><td class="num">${num(g.theirs[id] ?? 0)}</td><td class="num">${ours(id) ? num(ours(id)) : "—"}</td></tr>`; }).join("");
  const miss = Object.values(g.unknown);
  const html = `<p>${esc(t("pw.dlg.intro"))}</p><table class="pw-table"><thead><tr><th>${esc(t("pw.col.recipe"))}</th><th class="num">${esc(t("pw.col.theirs"))}</th><th class="num">${esc(t("pw.col.ours"))}</th></tr></thead><tbody>${rows}</tbody></table>${miss.length ? `<p>${esc(t("pw.unknown"))}</p><ul>${miss.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}<p class="hint"><a href="https://industrialist-calculator.pages.dev" target="_blank" rel="noopener">${esc(t("pw.credit"))}</a></p>`;
  await ask(t("pw.dlg.title", { name: g.name }), html, [{ value: "", label: t("m.close"), primary: true }]);
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
/** Moteur diesel du plan (S18) : configurations connues (wiki et relevés) et choix du plan. */
function dieselNow(): { configs: DieselConfig[]; choice: DieselChoice } {
  const key = planKey(settings.goal, settings.item);
  return { configs: dieselConfigs(REPO_MODULAR, dieselReadings), choice: (key && settings.dieselChoice[key]) || DEFAULT_DIESEL };
}
function dieselRecipeNow(): string {
  const { configs, choice } = dieselNow();
  const size = (id: string) => {
    const sz = data.machines.get(id)?.size;
    return sz ? { w: sz.w, h: sz.l } : { w: 2, h: 2 };
  };
  return dieselRecipeFor(configs, choice, {
    area: (c) => {
      const d = designDiesel(c.parts, 1, size, {});
      return d.width * d.height;
    },
  });
}
function setDieselChoice(patch: Partial<DieselChoice>): void {
  const key = planKey(settings.goal, settings.item);
  if (!key) return;
  settings.dieselChoice = { ...settings.dieselChoice, [key]: { ...dieselNow().choice, ...patch } };
  update();
}
/** Un relevé de configuration ajouté ou retiré dans l'éditeur : il entre dans le calcul tout de suite. */
function setDieselReadings(list: DieselReading[]): void {
  dieselReadings = list;
  saveDieselReadings(list);
  (files as RawFiles).dieselReadings = list;
  rebuildData();
  update();
}

/** Mineshaft Drill du plan (remarque n°16) : données et réglage (défaut : profondeur auto, Steel, HCl). */
function mineshaftNow(): MineshaftView {
  const key = planKey(settings.goal, settings.item);
  return { file: MINESHAFT, choice: (key && settings.mineshaftChoice[key]) || DEFAULT_MINESHAFT };
}
function setMineshaftChoice(patch: Partial<MineshaftChoice>): void {
  const key = planKey(settings.goal, settings.item);
  if (!key) return;
  const next = { ...mineshaftNow().choice, ...patch };
  const { [key]: _, ...rest } = settings.mineshaftChoice;
  settings.mineshaftChoice = sameMineshaft(next, DEFAULT_MINESHAFT) ? rest : { ...rest, [key]: next };
  update();
}

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
  const msd = mineshaftNow().choice;
  const sig = `${JSON.stringify(ms)}|${all.sig}|${JSON.stringify(msd)}`;
  if (!planDataCache || planDataCache.base !== data || planDataCache.sig !== sig) {
    const applied = applyMachineSettings(data, all.all, ms);
    planDataCache = { base: data, sig, data: sameMineshaft(msd, DEFAULT_MINESHAFT) ? applied : withMineshaft(applied, MINESHAFT, msd) };
  }
  return planDataCache.data;
}
let planBuiltFrom: GameData | null = null;

/** Réglages du calcul autres que l'objectif (critères, filtres, contraintes…), communs à la proposition et au recalcul du graphe. */
function baseRequest(): Omit<SolveRequest, "item"> {
  const goal = settings.goal;
  return {
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
    diesel: dieselRecipeNow(),
    onlyRecipes: importNow()?.recipes,
  };
}

/** Overflow Gates permises : recherche débloquée et option « Sans Overflow Gate » décochée. */
function gateAllowed(): { objet: boolean; fluide: boolean } {
  const open = (id: string) => {
    const n = data.nodes.get(id);
    return !settings.usine.noGate && !!n && (n.isRoot || !!n.startUnlocked || (simulated ?? prog).unlocked.includes(id));
  };
  return { objet: open("item-overflow-gate"), fluide: open("liquid-overflow-gate") };
}

/** Le plan, avec les machines qu'il faut en plus pour que chaque débit se partage entre les tuyaux. */
function withLineExtras(p: Plan): Plan {
  return addMachines(p, anyName, lineExtras(p, { isFluid: (id) => !!data.items.get(id)?.isFluid, machine: (id) => data.machines.get(id) ?? null, ports: currentPorts().machines, gate: gateAllowed() }, CATALOG));
}
/** Nombres entiers du plan qui dépassent l'arrondi (débit partagé), pour le graphe. */
function graphWorld() {
  const extra = Object.fromEntries((plan?.lineExtras ?? []).flatMap((x) => {
    const s = plan!.steps.find((q) => q.key === x.key);
    return s ? [[s.recipeId, { exact: s.machinesExact, whole: s.machines }]] : [];
  }));
  return { ...gameView(), extra };
}

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
  const request = (target: Partial<Parameters<typeof solve>[2]>) => solve(pd, playerState(), { item: settings.item, ...target, ...baseRequest() });
  // Graphe édité puis recalculé (G4) : le plan vient de lui (recettes posées, nœuds fixés, cible et
  // débit), plus de la proposition brute. Le solveur ne tourne ici que parce qu'un réglage a changé ;
  // juste après « Appliquer », c'est le plan montré dans l'aperçu.
  const ge = gedit;
  if (goal === "objet" && ge?.solved && ge.sig === goalSig()) {
    poseSchem = null;
    const ready = pendingGraphPlan?.g === ge.solved ? pendingGraphPlan.plan : null;
    pendingGraphPlan = null;
    const p = ready ?? solveFromGraph(pd, playerState(), ge.solved, baseRequest()).plan;
    if (p) {
      plan = withLineExtras(p);
      return;
    }
  }
  poseSchem = null; // le schéma à exporter suit le nouveau plan
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
  plan = withLineExtras(plan);
}

function viewCtx(): ViewCtx {
  ensurePlan();
  return { data: planData(), plan: plan!, settings, corrections, goal: settings.goal, research: rpView, fresh: isFresh(), plot: plotOf(player), ifaces: currentInterfaces().all, msettings: msettingsNow(), diesel: dieselNow(), mineshaft: mineshaftNow(), game: gameView() };
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
  if (page === "plan") renderPlanPage();
  else if (page === "usine") renderUsine();
  else if (page === "arbre") renderTreePage();
  else if (page === "recettes") renderRecettes();
  else if (page === "propositions") props.refresh();
  else if (page === "methodes") methods.show();
  else if (page === "bac") sandbox.show(route.code);
  else renderData();
}

const researchTotal = () => [...data.nodes.values()].filter((n) => !n.isRoot).length;
const unlockedCount = () => [...data.nodes.values()].filter((n) => !n.isRoot && (n.startUnlocked || prog.unlocked.includes(n.id))).length;
const isFresh = () => !prog.unlocked.length && player.money === null && player.rp === null;

/** Les pastilles qui ne tiennent pas dans l'en-tête passent dans un bouton « … » (menu), rien n'est rogné ni caché. */
function fitHeaderChips(): void {
  const me = $("me");
  me.querySelector(".me-more")?.remove();
  const chips = [...me.querySelectorAll<HTMLElement>(".me-chip")];
  chips.forEach((c) => { c.hidden = false; });
  const more = document.createElement("button");
  more.type = "button";
  more.className = "me-chip me-more";
  more.setAttribute("aria-haspopup", "listbox");
  more.setAttribute("aria-expanded", "false");
  me.append(more);
  const hiddenChips: HTMLElement[] = [];
  const over = () => me.scrollWidth > me.clientWidth + 1;
  if (over()) {
    for (let i = chips.length - 1; i >= 0 && over(); i--) { chips[i]!.hidden = true; hiddenChips.unshift(chips[i]!); }
  }
  if (!hiddenChips.length) { more.remove(); return; }
  more.textContent = `+${hiddenChips.length}`;
  more.title = t("header.more.title");
  more.setAttribute("aria-label", t("header.more.title"));
  more.onclick = () => {
    if (popAnchorEl() === more) { closePop(); return; }
    const html = hiddenChips.map((c) => `<button type="button" data-opt data-href="${esc(c.getAttribute("href") ?? "#usine")}" title="${esc(c.title)}">${c.innerHTML}</button>`).join("");
    openPopMenu(document.body, more, html, (el) => { location.hash = el.dataset.href ?? "#usine"; });
  };
}
let fitRaf = 0;
addEventListener("resize", () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => { closePop(); renderHeader(); }); });
// Au premier chargement, Audiowide arrive après le premier rendu et élargit l'en-tête : on remesure.
document.fonts?.ready.then(() => renderHeader());
document.fonts?.addEventListener?.("loadingdone", () => renderHeader());

/** Barre du haut : où en est le joueur, en bref (cliquable vers « Mon usine »). */
function renderHeader(): void {
  $<HTMLAnchorElement>("nav-plan").href = `#${GOAL_ROUTE[settings.goal]}`;
  if (isFresh()) {
    setHtml($("me"), `<a class="me-chip cta" href="#usine">${esc(t("header.cta"))}</a>`);
    $("me-play").hidden = true;
    fitHeaderChips();
    return;
  }
  const rp = rpNow();
  const real = rpRealRate();
  const total = researchTotal();
  const chips = [
    `<a class="me-chip" href="#usine" title="${esc(t("header.research.title"))}">${esc(t("header.research", { n: total, done: String(unlockedCount()), total: String(total) }))}</a>`,
    rp !== null
      ? `<a class="me-chip" href="#usine/recherche" title="${esc(t("header.rp.title"))}">≈ ${esc(fmtShort(rp))} RP${!journal.clock.playing ? "" : real ? ` · ${esc(fmt(real.rate, real.rate < 10 ? 2 : 1))}/s${real.over ? withIcons(t("header.rp.over")) : ""}` : ""}</a>`
      : "",
    player.money !== null ? `<a class="me-chip" href="#usine" title="${esc(t("header.money.title"))}">${esc(fmtMoneyShort(player.money))}</a>` : "",
  ];
  setHtml($("me"), chips.join(""));
  fitHeaderChips();
  // Interrupteur « Je joue » (S21) : un bouton fixe, pour qu'il reste cliquable quand les puces changent.
  const play = $<HTMLButtonElement>("me-play");
  const on = journal.clock.playing;
  play.hidden = rp === null;
  play.classList.toggle("on", on);
  play.dataset.play = on ? "off" : "on";
  play.innerHTML = withIcons(esc(t(on ? "header.play.on" : "header.play.off")));
  play.title = t(on ? "header.play.on.title" : "header.play.off.title");
  play.setAttribute("aria-label", t(on ? "header.play.on.aria" : "header.play.off.aria"));
}

// ---------------------------------------------------------------- page d'un objectif

/** Objectif pas encore saisi (S23) : champs vides, exemples en grisé, aucun résultat. */
const isBlank = (g: Goal) => g !== "recherche" && !settings.entered.includes(g);
/** Le joueur a saisi quelque chose dans cet objectif : ses valeurs s'affichent et le calcul se fait. */
function enter(g: Goal): boolean {
  if (settings.entered.includes(g)) return false;
  settings.entered = [...settings.entered, g];
  return true;
}
const blankPrompt = (g: Goal): string => (g === "recherche" ? "" : t(`plan.blank.${g}`));

/** Objets de la palette (S61) : nom du jeu et vignette du wiki ou du joueur. */
const palItems = (): PalItem[] =>
  [...data.items.values()].sort((a, b) => a.name.localeCompare(b.name)).map((it) => ({ id: it.id, name: it.name, pic: pictureOf("objet", it.id)?.src ?? null, ...(craftable().has(it.id) ? {} : { note: t("pal.noRecipe") }) }));
/** Objets qu'au moins une recette complète (durée et quantités connues) fabrique ; les autres portent un avertissement. */
let craftCache: { data: GameData; ids: Set<string> } | null = null;
function craftable(): Set<string> {
  const pd = planData();
  if (craftCache?.data !== pd) craftCache = { data: pd, ids: craftableItems(pd) };
  return craftCache.ids;
}
const itemPal = createItemPalette({
  items: palItems,
  current: () => settings.item,
  onPick: (id) => {
    const inp = input("item");
    inp.value = data.items.get(id)?.name ?? id;
    inp.dispatchEvent(new Event("change"));
  },
});
/** Palettes des machines (filtre du tiroir) et des recherches (objectif « Des RP ») : même choix que l'objet. */
const machinePal = createItemPalette({
  items: () => filterableMachines({ data }).map((id) => ({ id, name: data.machines.get(id)!.name, pic: pictureOf("machine", id)?.src ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
  current: () => null,
  onPick: (id) => {
    const inp = input("mf-search");
    inp.value = data.machines.get(id)?.name ?? id;
    inp.dispatchEvent(new Event("change"));
  },
  recentKey: "ind-calc:v1:recent-machines",
  ph: () => t("pal.ph.machine"),
});
const nodePal = createItemPalette({
  items: () => [...data.nodes.values()].filter((n) => !n.isRoot).sort((a, b) => a.name.localeCompare(b.name)).map((n) => ({ id: n.id, name: n.name, pic: null })),
  current: () => settings.rpNode,
  onPick: (id) => {
    const inp = input("rp-node");
    inp.value = nodeName(id);
    inp.dispatchEvent(new Event("change"));
  },
  recentKey: "ind-calc:v1:recent-nodes",
  ph: () => t("pal.ph.node"),
});
/** Le bouton de l'objet dans la phrase : vignette, nom, raccourci. */
function renderItemPick(): void {
  const it = data.items.get(settings.item);
  $("item-pick").innerHTML = it && !isBlank("objet")
    ? `${itemTile({ id: it.id, name: it.name, pic: pictureOf("objet", it.id)?.src ?? null })}<span class="nm">${esc(it.name)}</span><kbd>Ctrl K</kbd>`
    : `<span class="nm">${esc(t("plan.pick.none"))}</span><kbd>Ctrl K</kbd>`;
}

function syncForm(): void {
  const set = (id: string, v: string) => {
    if (document.activeElement !== $(id)) input(id).value = v;
  };
  set("item", isBlank("objet") ? "" : (data.items.get(settings.item)?.name ?? settings.item));
  renderItemPick();
  $<HTMLSelectElement>("qty-unit").value = settings.mode === "machines" ? "machines" : settings.rateUnit === "s" ? "rate-s" : "rate";
  // Affichage arrondi ; le réglage garde la valeur exacte (un palier tombe juste), toujours par minute.
  set("qty", isBlank("objet") ? "" : settings.mode === "rate" ? String(Number(displayRate(settings.rate, settings.rateUnit).toFixed(4))) : String(settings.machines));
  set("money", isBlank("argent") ? "" : String(settings.money));
  $<HTMLSelectElement>("energy-unit").value = settings.energyUnit;
  set("energy", isBlank("énergie") ? "" : String(Number((settings.energyMFps / (settings.energyUnit === "M" ? 1e6 : 1e3)).toFixed(4))));
  $<HTMLSelectElement>("energy-mode").value = settings.energyGuaranteed ? "garantie" : "moyenne";
  input("no-fuel").checked = settings.energyNoFuel;
  set("distance", settings.distanceTiles === null ? "" : String(settings.distanceTiles));
  $<HTMLSelectElement>("rp-mode").value = settings.rpMode;
  set("rp-rate", settings.rpRate === null ? "" : String(settings.rpRate));
  set("rp-node", settings.rpNode ? nodeName(settings.rpNode) : "");
  $("rp-node-pick").textContent = settings.rpNode ? nodeName(settings.rpNode) : t("pal.ph.node");
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

/** Explication d'un objectif impossible ; sans recette connue, ce n'est pas la progression du joueur qui manque. */
function noPlanAnswer(v: ViewCtx): string {
  const html = renderAnswer(v);
  if (v.goal !== "objet" || craftable().has(settings.item)) return html;
  return html.replace(/<h2>[^]*?<\/h2>/, () => `<h2>${esc(t("noplan.noRecipe", { item: itemName(settings.item) }))}</h2>`);
}
function renderPlanPage(): void {
  const v = viewCtx();
  const goal = settings.goal;
  $("plan-title").textContent = goalTitle(goal);
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".goalnav [data-goal]")) {
    if (a.dataset.goal === goal) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  for (const el of document.querySelectorAll<HTMLElement>("#query [data-goals], #plan-drawer [data-goals]")) el.hidden = !el.dataset.goals!.split(" ").includes(goal);
  $("rp-rate-label").hidden = goal !== "recherche" || settings.rpMode !== "rate";
  $("rp-node-label").hidden = goal !== "recherche" || settings.rpMode !== "node";
  $("rp-minutes-label").hidden = goal !== "recherche" || settings.rpMode === "rate";
  syncForm();

  // Priorités : seulement celles qui ont un sens pour cet objectif, dans l'ordre du joueur.
  renderCriteria();
  if (goal !== "recherche") renderMachineFilter(v.plan);

  // Textes d'aide propres à l'objectif.
  const existingN = Object.keys(settings.existing).length;
  $("budget-hint").textContent = player.money === null ? t("adv.budget.none") : `(${fmtMoney(player.money)})`;
  $("existing-hint-plan").innerHTML = existingN ? t("adv.existing.some.html", { n: existingN }) : t("adv.existing.none.html");
  const mineTiers = rpTiers();
  const mineRate = mineTiers ? nominalRate(mineTiers) : 0;
  const mineCap = mineTiers ? Math.min(...mineTiers.map((tier) => tier.cap)) : Infinity;
  $("rp-current-hint").innerHTML = mineRate
    ? t("adv.rpCurrent.some.html", { rate: esc(fmt(mineRate, 2)), cap: Number.isFinite(mineCap) ? t("adv.rpCurrent.cap", { cap: esc(fmtRP(mineCap)) }) : t("adv.rpCurrent.noCap") })
    : t("adv.rpCurrent.none.html");
  let goalHint = "";
  if (goal === "recherche" && settings.rpMode === "plan") {
    const what = settings.mode === "rate" ? `${fmt(displayRate(settings.rate, settings.rateUnit), 2)} ${itemName(settings.item)}/${settings.rateUnit === "s" ? "s" : "min"}` : t("plan.goalHint.machines", { n: String(settings.machines), item: itemName(settings.item) });
    goalHint = t("plan.goalHint.html", { what: esc(what) });
  }
  $("goal-hint").innerHTML = goalHint;
  $("adv-note").textContent =
    goal === "énergie"
      ? t("adv.note.energy", {
          list: ENERGY_FILE.notComputed
            .filter((n) => n.machine !== "diesel-engine-generator")
            .map((n) => (n.machine === "turbine-generator" ? t("adv.note.turbine") : (data.machines.get(n.machine)?.name ?? n.machine)))
            .join(", "),
        })
      : goal === "recherche" && rpView
        ? t("adv.note.cap", {
            cap: settings.rpCap === null ? t("adv.note.cap.auto", { which: t(settings.rpMode === "rate" ? "adv.note.cap.rate" : "adv.note.cap.node"), cap: fmtRP(rpView.capNeeded) }) : fmtRP(settings.rpCap),
          })
        : "";
  // Options avancées actives (visibles pour cet objectif).
  const adv = [...document.querySelectorAll<HTMLInputElement>("#advanced input")].filter((i) => {
    const label = i.closest<HTMLElement>("[data-goals]");
    if (label?.hidden) return false;
    if (i.id === "use-existing" && !existingN) return false;
    return i.type === "checkbox" ? i.checked : i.value.trim() !== "";
  }).length;
  $("adv-count").textContent = adv ? t("adv.count", { n: adv }) : t("adv.count.none");

  $("first-visit").hidden = !isFresh();
  // Rien de saisi (S23) : une phrase, pas de résultat ni d'onglets vides.
  const blank = isBlank(goal);
  const noResult = blank || (goal === "recherche" && !rpView?.best && !rpView?.timelineNow?.length);
  $("answer").innerHTML = blank ? `<p class="hint blank-prompt">${esc(blankPrompt(goal))}</p>` : renderAnswer(v);
  // Rien à produire (aucune recette utilisable, tout verrouillé…) : le pourquoi au milieu de la page, pas une page vide.
  const impossible = !noResult && goal !== "recherche" && v.plan.status === "impossible" && !v.plan.steps.length;
  $("no-plan").hidden = !impossible;
  $("no-plan").innerHTML = impossible ? `${icon("warn")}${noPlanAnswer(v)}<p><button type="button" class="primary" data-no-plan-pick>${esc(t("noplan.pick"))}</button></p>` : "";
  $("no-plan").classList.toggle("nopick", goal !== "objet");
  renderIoPane();
  const fixBar = $("fix-bar");
  fixBar.innerHTML = blank ? "" : renderFixBar(v);
  fixBar.hidden = !fixBar.innerHTML;
  // Ton plan (S28) : les réglages qui changent ce résultat, chacun cliquable, ✕ pour l'annuler.
  const planBar = $("plan-bar");
  const openWarn = planBar.querySelector<HTMLDetailsElement>(".pb-warn")?.open ?? false;
  planBar.innerHTML = noResult ? "" : renderPlanBar(v, planBarInput(adv));
  planBar.hidden = noResult;
  if (openWarn) planBar.querySelector<HTMLDetailsElement>(".pb-warn")?.setAttribute("open", "");
  $("rtabs-result").hidden = noResult || impossible;
  if (!noResult) syncGraphDoc(v.plan);
  renderGraphBar();
  if (noResult || impossible) {
    // Rien à poser : les étapes du plan précédent (design quitté) ne restent pas dans le rail.
    railSteps = [];
    renderStepRail();
    for (const t of ["liste", "schema", "pose", "details"] as ResultTab[]) $(`rpanel-${t}`).hidden = true;
    return;
  }
  rows = buildRows(v);
  signature = buildSignature(goal, rows);
  renderBuild();
  renderResultTabs();
}

/** Réglages du plan affiché, pour la barre « Ton plan » (S28). */
function planBarInput(advanced: number): PlanBarInput {
  const goal = settings.goal;
  const key = planKey(goal, settings.item);
  return {
    goal,
    criteria: settings.criteria[goal],
    filter: goal === "recherche" ? null : filterNow(),
    fixed: (goal !== "recherche" && fixedNow()) || {},
    forced: goal === "recherche" ? {} : settings.forced,
    msettings: goal === "recherche" ? {} : msettingsNow(),
    ifaces: currentInterfaces().all,
    diesel: (key && settings.dieselChoice[key]) || null,
    mineshaft: goal === "recherche" ? null : mineshaftNow(),
    imported: importNow(),
    advanced,
  };
}

/** Recette choisie à la main pour un objet (Détails, barre du bloc) ; "" : choix automatique. */
function setForced(item: string, recipeId: string): void {
  if (recipeId) settings.forced = { ...settings.forced, [item]: recipeId };
  else {
    const { [item]: _, ...rest } = settings.forced;
    settings.forced = rest;
  }
  update();
}

/**
 * Un ⚠ (S28) : ouvre la correction de la valeur. Dans la fiche (page Recettes, mode « ✎ Corriger », la
 * case sélectionnée) quand elle s'y corrige, sinon dans Contribuer › Valeurs à vérifier.
 */
function openFix(attr: string): void {
  const [scope, id, field, item] = attr.split("|") as ["recette" | "machine", string, string, string];
  if (scope === "recette") {
    const r = data.recipes.get(id);
    if (!r || !fixableHere("recipes", field)) return void (location.hash = verifyHref("recette", id, field));
    const card = item && data.items.has(item) && r.outputs[item] !== undefined ? { kind: "objet" as const, id: item } : { kind: "machine" as const, id: r.machine };
    rcEdit = { ...EDIT_ON, craft: id, focus: fixKey("recipes", id, field) };
    rcEditCard = `${card.kind}/${card.id}`;
    rcRevealPending = true;
    return go({ page: "recettes", card: { ...card, craft: id } });
  }
  if (!fixableHere("machines", field)) return void (location.hash = verifyHref("machine", id, field));
  rcEdit = { ...EDIT_ON, craft: null, focus: fixKey("machines", id, field) };
  rcEditCard = `machine/${id}`;
  rcRevealPending = true;
  go({ page: "recettes", card: { kind: "machine", id } });
}

/** Ouvre un réglage du formulaire depuis « Ton plan » : déplié, amené à l'écran, le focus dessus. */
function openSetting(id: string): void {
  const d = $<HTMLDetailsElement>(id);
  // R28 : les réglages vivent dans le tiroir ; il s'ouvre même quand la rubrique est déjà dépliée.
  if (d.closest("#plan-drawer") && $("plan-drawer").hidden) $("plan-set-open").click();
  d.open = true;
  d.scrollIntoView({ block: "center", behavior: "smooth" });
  d.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
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
  $("plan-insp").hidden = tab !== "schema";
  $("cat-pose").hidden = tab !== "pose";
  if (tab !== "pose" && $("plan-pose-info").classList.contains("on")) paneBack();
  if (tab === "schema") renderFlowCanvas();
  if (tab === "pose") renderPose();
  else fillPoseSteps();
  if (tab === "details") $("details").innerHTML = renderDetails(viewCtx());
}

// Schéma : l'éditeur de graphe (PLAN-GRAPHE.md, lot G2). La proposition du solveur devient un graphe
// (plan → graphe, G1) affiché par graph-view.ts : nœuds HTML, liaisons de prise à prise.
let graphView: GraphView | null = null;
/**
 * Graphe affiché et plan qu'il accompagne : étape du plan → nœud (par recette) et l'inverse. `arranged` :
 * la disposition de départ est faite (« Ranger » d'entrée, avec les vraies hauteurs des nœuds).
 */
/** `links` : les liens étape → nœud posés avec le plan ; `nodeOfStep` : ceux qui valent encore (`keepLinks`). */
let graphDoc: { plan: Plan; g: Graph; links: Map<string, string>; nodeOfStep: Map<string, string>; stepOf: Map<string, string>; arranged: boolean } | null = null;
/** Bloc sélectionné dans le schéma (clé d'étape), ou liaison sélectionnée. */
let flowSel: string | null = null;
let flowEdge: { from: string; to: string; item: string; perMin: number; loop: boolean } | null = null;
let flowKey = "";
/** Largeur réservée aux boutons de zoom, à droite du cadre. */
const FLOW_ZOOM_W = 52;
/** Plan de pose : tout voir si c'est lisible, sinon assez grand pour lire (calé à gauche). */
const FLOW_MIN_SCALE = 0.6;
function flowStartScale(frame: { w: number; h: number }, content: { w: number; h: number }): number {
  return Math.max(FLOW_MIN_SCALE, Math.min(1, frame.w / content.w, frame.h / content.h));
}

function graphText(): GraphViewText {
  const unit = settings.rateUnit;
  const rate = (perMin: number) => {
    const x = displayRate(perMin, unit);
    return `${fmt(x, Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2)}/${unit === "s" ? "s" : "min"}`;
  };
  return {
    rate,
    num: (x) => fmt(x, Math.abs(x) >= 100 || Number.isInteger(x) ? 0 : 2),
    item: (id) => itemName(id),
    machine: (id) => planData().machines.get(id)?.name ?? id,
    cycle: (sec) => `${fmt(sec, sec >= 10 ? 0 : 1)} s`,
    energy: (mf) => fmtMF(mf),
    pollution: (ph) => `${fmtPct(fmt(ph, Math.abs(ph) >= 10 ? 0 : Math.abs(ph) >= 1 ? 1 : 2))}/h`,
    target: t("gv.target"),
    fixed: t("gv.fixed"),
    missing: t("gv.missing"),
    partial: (got, need) => t("gv.partial", { got, need }),
    nodeAria: (product, n, machine) => t("gv.node.aria", { product, n, machine }),
  };
}

/**
 * Étape du plan d'un nœud du graphe : seulement s'il fait encore la recette de cette étape (un nœud
 * ajouté à la main, ou dont la recette a été remplacée, n'a pas de fiche du plan).
 */
function stepOfNode(id: string): string | undefined {
  const d = graphDoc;
  const key = d?.stepOf.get(id);
  if (!key) return undefined;
  const node = d!.g.nodes.find((n) => n.id === id);
  return key && node && d!.plan.steps.find((s) => s.key === key)?.recipeId === node.recipeId ? key : undefined;
}

function renderFlowCanvas(): void {
  const v = viewCtx();
  const p = v.plan;
  const canvas = $("flow-canvas");
  const frame = $("flow-frame");
  const empty = !p.steps.length;
  frame.classList.toggle("empty", empty);
  if (empty) {
    canvas.innerHTML = `<p class="flow-empty">${t("m.flow.empty")}</p>`;
    frame.style.height = "";
    graphDoc = null;
    return;
  }
  // Téléphone : le cadre prend 70 % de l'écran (sur ordinateur, toute la hauteur du centre, en CSS).
  frame.style.height = `${Math.round(Math.max(320, window.innerHeight * 0.7))}px`;
  syncGraphDoc(p);
  const doc = graphDoc!;
  graphView ??= new GraphView(frame, {
    data: planData(),
    world: () => graphWorld(),
    text: graphText(),
    reserveRight: FLOW_ZOOM_W,
    coverTop: () => document.querySelector(".top")?.getBoundingClientRect().bottom ?? 0,
    badge: (id) => {
      const key = stepOfNode(id);
      if (!key) return ""; // nœud sans étape du plan : rien à vérifier (et pas de contexte à construire, ×400 en charge)
      const vc = viewCtx();
      const st = vc.plan.steps.find((s) => s.key === key);
      return st ? warnButton(vc, stepWarnings(vc, st)) : "";
    },
    onSelect: (id) => selectFlow(id ? (stepOfNode(id) ?? null) : null),
    onEdge: (e) => {
      const d = graphDoc;
      // Une liaison tirée à la main (vers un nœud ajouté) n'a pas de fiche du plan.
      const from = e ? stepOfNode(e.from) : undefined;
      const to = e ? stepOfNode(e.to) : undefined;
      const next = e && d && from && to ? { from, to, item: e.item, perMin: balanceGraph(d.g, planData(), gameView()).edges.get(e.id) ?? 0, loop: false } : null;
      // Second clic sur la même liaison : désélectionnée.
      flowEdge = next && flowEdge && next.from === flowEdge.from && next.to === flowEdge.to && next.item === flowEdge.item ? null : next;
      applyFlowSel();
    },
    onChange: (g) => onGraphChange(g),
    onRecalc: () => void recalcGraph(),
    onFile: (b) => openGraphFileMenu(b),
    extra: (id) => graphExtra(id),
  });
  bindGraphBubbleSettings(graphView.bubbleEl);
  // Les données, la langue et l'unité peuvent avoir changé depuis la création du canevas.
  Object.assign((graphView as unknown as { opts: GraphViewOptions }).opts, { data: planData(), text: graphText() });
  const keep = signature === flowKey && doc.arranged;
  graphLoad = false;
  graphView.show(canvas, doc.g, keep, !doc.arranged && frame.clientWidth > 0);
  // « Ranger » d'entrée, avec les vraies hauteurs des nœuds (le cadre doit être affiché pour les mesurer).
  if (!doc.arranged && frame.clientWidth > 0) {
    doc.arranged = true;
    graphView.arrange(false, false); // disposition de départ : pas un pas d'annulation
  }
  flowKey = signature;
  graphView.setStale(graphStale());
  applyFlowSel();
}

/**
 * Test de charge (développement seulement) : le graphe affiché, copié jusqu'à `n` nœuds (copies
 * décalées, liaisons comprises), pour vérifier que le glisser reste fluide. `__grapheCharge(400)`.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __grapheCharge: (n?: number) => number }).__grapheCharge = (n = 400) => {
    const base = graphDoc ? planToGraph(graphDoc.plan).graph : null;
    if (!base || !graphView) return 0;
    graphLoad = true; // le graphe de charge ne s'enregistre pas
    const nodes: Graph["nodes"] = [];
    const edges: Graph["edges"] = [];
    for (let c = 0; nodes.length < n; c++) {
      const id = (x: string) => (c ? `${x}c${c}` : x);
      for (const nd of base.nodes) if (nodes.length < n) nodes.push({ ...nd, id: id(nd.id) });
      for (const e of base.edges) if (nodes.some((x) => x.id === id(e.from)) && nodes.some((x) => x.id === id(e.to))) edges.push({ ...e, id: `${id(e.from)}>${id(e.to)}:${e.item}`, from: id(e.from), to: id(e.to) });
    }
    graphView.show($("flow-canvas"), { ...base, nodes, edges }, false);
    graphView.arrange();
    return nodes.length;
  };
}

/**
 * Réglages spéciaux dans la bulle d'un nœud (G5) : mêmes gestes que dans la fiche S62, mêmes réglages du
 * plan (écran chiffré, moteur diesel, Mineshaft Drill). Branché une fois.
 */
let graphBubbleBound = false;
function bindGraphBubbleSettings(bub: HTMLElement): void {
  if (graphBubbleBound) return;
  graphBubbleBound = true;
  bub.addEventListener("click", (e) => {
    const reset = (e.target as Element).closest<HTMLElement>("[data-iset-reset]");
    if (reset) setMachineSetting(reset.dataset.isetReset!, null, null);
  });
  bub.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (el.matches("[data-iset-input]")) return setMachineSetting(el.dataset.machine!, el.dataset.setting!, parseFactor(el.value));
    if (el.matches("[data-dsl-fuel]")) setDieselChoice({ fuel: el.value, config: null });
    else if (el.matches("[data-dsl-mode]")) setDieselChoice({ mode: (el as HTMLInputElement).dataset.dslMode as DieselChoice["mode"], config: null });
    else if (el.matches("[data-dsl-config]")) setDieselChoice({ config: el.value || null });
    else {
      const msd = mineshaftPatch(el);
      if (msd) setMineshaftChoice(msd);
    }
  });
  bub.addEventListener("keydown", (e) => {
    const inp = (e.target as Element).closest<HTMLInputElement>("[data-iset-input]");
    if (inp && e.key === "Enter") inp.blur();
  });
}

// ---------------------------------------------------------------- graphe édité (G4)

/**
 * Le graphe à afficher pour ce plan. Pas modifié : il suit la proposition (refait quand le plan change).
 * Modifié : il est gardé, même si l'objectif change (le bandeau le dit et propose quoi faire).
 */
function syncGraphDoc(p: Plan): void {
  const sig = goalSig();
  if (!gedit?.touched && (gedit?.sig !== sig || graphDoc?.plan !== p || graphDoc.g !== gedit.graph)) {
    gedit = { sig, graph: planToGraph(p).graph, solved: null, touched: false };
    graphDoc = null;
  }
  const ge = gedit!;
  const g = ge.graph;
  if (graphDoc?.plan === p && graphDoc.g === g) return;
  // Étape ↔ nœud seulement si le graphe vaut pour cet objectif (sinon, pas de fiche du plan sur ses nœuds).
  const nodeOfStep = ge.sig === sig ? restoreLinks(p, g, ge.links, ge.linksFor) : new Map<string, string>();
  if (ge.sig === sig) {
    ge.links = Object.fromEntries(nodeOfStep);
    ge.linksFor = linksSig(p);
  }
  graphDoc = { plan: p, g, links: nodeOfStep, nodeOfStep, stepOf: new Map([...nodeOfStep].map(([k, id]) => [id, k])), arranged: graphDoc ? graphDoc.arranged : ge.touched };
}

/** Un geste du canevas (ou « Appliquer ») : le document suit, s'enregistre, et le bandeau se met à jour. */
function onGraphChange(g: Graph): void {
  if (graphLoad || !gedit) return;
  gedit.graph = g;
  if (graphView?.canUndo) gedit.touched = true;
  if (graphDoc) {
    graphDoc.g = g;
    graphDoc.nodeOfStep = gedit.sig === goalSig() ? keepLinks(graphDoc.links, graphDoc.plan, g) : new Map();
    graphDoc.stepOf = new Map([...graphDoc.nodeOfStep].map(([k, id]) => [id, k]));
    // Enregistrés (ceux qui valent encore : après un rechargement, un identifiant supprimé peut revenir
    // sur un nœud neuf) : au rechargement, un nœud ajouté à la main reste sans étape.
    gedit.links = Object.fromEntries(graphDoc.nodeOfStep);
    gedit.linksFor = linksSig(graphDoc.plan);
  }
  saveGraphEdit();
  renderGraphBar();
  syncHudCount(); // la fiche S62 montre le nombre du graphe (bulle, Ctrl Z…)
}

/** Le plan affiché ne suit plus le graphe édité (pour cet objectif). */
function graphStale(): boolean {
  return !!gedit?.touched && gedit.sig === goalSig() && !!plan && !graphMatchesPlan(gedit.graph, plan);
}

/** « 120/min Gearbox » : la cible du graphe, pour le bandeau. */
function graphGoalLabel(g: Graph): string | null {
  return g.target && g.rate ? `${graphText().rate(g.rate)} ${itemName(g.target.item)}` : null;
}

/** Bandeau au-dessus du résultat : plan tiré du graphe, graphe à recalculer, ou objectif changé. */
/** Bandeau réduit par le joueur : reste réduit tant que sa situation ne change pas (« à recalculer », objectif changé…). */
let graphBarFolded: string | null = null;
function renderGraphBar(): void {
  const bar = $("graph-bar");
  const ge = gedit;
  const b = (attr: string, label: string, primary = false) => `<button type="button"${primary ? ' class="primary"' : ""} ${attr}>${esc(label)}</button>`;
  let cls = "";
  let html = "";
  if (ge?.touched && settings.goal !== "recherche" && !isBlank(settings.goal)) {
    if (ge.sig !== goalSig()) {
      cls = "goal";
      const what = graphGoalLabel(ge.graph);
      const sameItem = settings.goal === "objet" && settings.mode === "rate" && ge.graph.target?.item === settings.item;
      html =
        `<p>${esc(t("gbar.goal", { what: what ?? t("gbar.goal.other") }))}</p><span class="gbar-b">` +
        (sameItem ? b('data-gbar="rate"', t("gbar.rate", { rate: graphText().rate(settings.rate) }), true) : "") +
        (what ? b('data-gbar="restore"', t("gbar.restore"), !sameItem) : "") +
        b('data-gbar="take"', t("gbar.take")) +
        "</span>";
    } else if (graphStale()) {
      cls = "due";
      html = `<p>${esc(t("gbar.due", { what: t(ge.solved ? "gbar.due.last" : "gbar.due.prop") }))}</p><span class="gbar-b">${b('data-gbar="recalc"', t("gbar.recalc"), true)}${b('data-gbar="back"', t("gbar.back"))}</span>`;
    } else if (ge.solved) {
      html = `<p>${esc(t("gbar.solved"))}</p><span class="gbar-b">${b('data-gbar="back"', t("gbar.back"))}</span>`;
    }
  }
  const state = cls || "solved";
  if (graphBarFolded !== null && graphBarFolded !== state) graphBarFolded = null;
  const folded = !!html && graphBarFolded !== null;
  if (folded) html = `<button type="button" class="gbar-open" data-gbar-fold="0" aria-expanded="false">${icon(cls ? "warn" : "info")} ${esc(t(`gbar.short.${state}` as Key))} ${icon("chevR")}</button>`;
  else if (html) html += `<button type="button" class="icon-btn gbar-x" data-gbar-fold="${state}" title="${esc(t("gbar.fold"))}" aria-label="${esc(t("gbar.fold"))}">${icon("close")}</button>`;
  bar.className = `gbar${cls ? ` ${cls}` : ""}${folded ? " folded" : ""}`;
  bar.innerHTML = html;
  bar.hidden = !html;
  graphView?.setStale(cls === "due");
}

/** Oublie le graphe édité : l'onglet Schéma revient à la proposition (après accord si `confirm`). */
async function dropGraphEdit(confirm: boolean): Promise<void> {
  if (confirm) {
    const ok = await ask(t("gbar.drop.title"), t("gbar.drop.html"), [
      { value: "ok", label: t("gbar.drop.ok"), primary: true },
      { value: "", label: t("m.cancel") },
    ]);
    if (ok !== "ok") return;
  }
  gedit = null;
  graphDoc = null;
  saveGraphEdit(true);
  update();
}

/** Objectif du site = cible et débit du graphe (« Appliquer », « Revenir à l'objectif du graphe »). */
function setGoalFromGraph(g: Graph): void {
  enter("objet");
  settings.goal = "objet";
  settings.item = g.target!.item;
  settings.mode = "rate";
  settings.rate = g.rate!;
  // Les machines fixées par l'ancienne fiche (S8) sont dans le graphe (cadenas) : plus de réglage à part.
  settings.fixed = null;
  syncForm();
  if (location.hash.split("/")[0] !== GOAL_HASH.objet) location.hash = GOAL_HASH.objet;
}

function restoreGraphGoal(): void {
  const g = gedit?.graph;
  if (!g?.target || !g.rate) return;
  setGoalFromGraph(g);
  gedit!.sig = goalSig();
  saveGraphEdit(true);
  update();
}

/**
 * « Recalculer » (PLAN-GRAPHE.md § 2, décision 2) : le graphe devient une requête pour le solveur
 * (recettes posées, nœuds fixés, cible et débit) ; l'aperçu montre avant / après par nœud et les
 * manques ; « Appliquer » écrit les nombres (un pas d'annulation) et le plan du site suit le graphe.
 * `rate` : un autre débit pour la cible (bandeau « objectif changé »).
 */
async function recalcGraph(rate?: number): Promise<void> {
  const g0 = graphView?.graph ?? gedit?.graph;
  if (!g0) return;
  const pd = planData();
  const world = gameView();
  const T = graphText();
  const close = [{ value: "", label: t("m.close"), primary: true }];
  if (!g0.target) return void (await ask(t("gv.rc.title"), `<p>${esc(t("gv.rc.noTarget"))}</p>`, close));
  let g: Graph = rate ? { ...g0, rate } : g0;
  let fromGraph = "";
  if (!(g.rate !== null && g.rate > 0)) {
    // Pas de débit (graphe monté à la main) : celui que la cible produit aujourd'hui.
    const out = balanceGraph(g, pd, world).output?.perMin ?? 0;
    if (!(out > 0)) return void (await ask(t("gv.rc.title"), `<p>${esc(t("gv.rc.noRate"))}</p>`, close));
    g = { ...g, rate: Math.round(out * 1e4) / 1e4 };
    fromGraph = `<p class="hint">${esc(t("gv.rc.fromGraph", { rate: T.rate(g.rate!) }))}</p>`;
  }
  const target = g.target!;
  const r = solveFromGraph(pd, playerState(), g, baseRequest());
  if (!r.plan) return void (await ask(t("gv.rc.title"), `<p>${esc(t("gv.rc.noTarget"))}</p>`, close));
  const solved = withLineExtras(r.plan);
  const cmp = compareWithPlan(g, solved);
  const name = (recipeId: string) => {
    const rc = pd.recipes.get(recipeId);
    const out = rc ? Object.keys(rc.outputs)[0] : undefined;
    return `${esc(itemName(out ?? recipeId))} <span class="hint">(${esc(rc ? (pd.machines.get(rc.machine)?.name ?? rc.machine) : recipeId)})</span>`;
  };
  const n = (x: number) => esc(T.num(Math.round(x * 100) / 100));
  const rowsHtml =
    cmp.nodes
      .map((c) => {
        const after = c.after === null ? `<i>${esc(t("gv.rc.unused"))}</i>` : n(c.after);
        const cls = c.after === null ? "gone" : Math.abs(c.after - c.before) > 1e-6 ? "up" : "";
        return `<tr class="${cls}"><td>${name(c.recipeId)}${c.fixed ? ` ${icon("lock")}` : ""}</td><td class="num">${n(c.before)}</td><td class="num">${after}</td></tr>`;
      })
      .join("") + cmp.added.map((a) => `<tr class="new"><td>${name(a.recipeId)} · ${esc(t("gv.rc.added"))}</td><td class="num">—</td><td class="num">${n(a.machines)}</td></tr>`).join("");
  const unused = cmp.nodes.filter((c) => c.after === null).length;
  const preview = applyComparison(g, solved, cmp);
  const gapList = (x: Graph) => {
    const s = balanceGraph(x, pd, world).shortages;
    return s.length ? s.map((q) => `${T.rate(q.perMin)} ${itemName(q.item)}`).join(", ") : t("gv.rc.none");
  };
  const unknown = r.problems.filter((p) => p.code === "recette-inconnue").map((p) => p.id ?? "");
  const html =
    `<p>${esc(t("gv.rc.intro", { rate: T.rate(g.rate!), item: itemName(target.item) }))}</p>${fromGraph}` +
    `<div class="rc-wrap"><table class="rc-table"><thead><tr><th>${esc(t("gv.rc.col.node"))}</th><th class="num">${esc(t("gv.rc.col.before"))}</th><th class="num">${esc(t("gv.rc.col.after"))}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>` +
    `<p class="rc-gaps">${esc(t("gv.rc.rate", { before: T.rate(g.rate!), after: T.rate(cmp.rate.after) }))}<br>${esc(t("gv.rc.gaps", { before: gapList(g), after: gapList(preview) }))}</p>` +
    (solved.unresolved.length ? `<p class="hint">${esc(t("gv.rc.unresolved", { list: solved.unresolved.map((u) => itemName(u.item)).join(", ") }))}</p>` : "") +
    (unknown.length ? `<p class="hint">${esc(t("gv.rc.unknown", { list: unknown.join(", ") }))}</p>` : "") +
    (unused ? `<label class="ask-field"><input type="checkbox" id="rc-drop"> ${esc(t("gv.rc.drop", { n: unused }))}</label>` : "");
  const choice = await ask(t("gv.rc.title"), html, [
    { value: "apply", label: t("gv.rc.apply"), primary: true },
    { value: "", label: t("m.cancel") },
  ]);
  if (choice !== "apply") return;
  const removeUnused = (document.getElementById("rc-drop") as HTMLInputElement | null)?.checked ?? false;
  const next = removeUnused ? applyComparison(g, solved, cmp, { removeUnused }) : preview;
  if (graphView?.graph === g0) graphView.run({ type: "replace", graph: next });
  const ge: GraphEdit = gedit ?? { sig: "", graph: next, solved: null, touched: true };
  gedit = ge;
  ge.graph = next;
  ge.solved = next;
  ge.touched = true;
  if (graphDoc) graphDoc.g = next;
  setGoalFromGraph(next);
  ge.sig = goalSig();
  pendingGraphPlan = { g: next, plan: solved };
  saveGraphEdit(true);
  update();
}

/**
 * Nombre de machines réglé dans la fiche (S62) : il passe par le graphe (nombre fixé, cadenas), comme
 * dans la bulle ; plus de calcul en douce. null : le nombre n'est plus fixé.
 */
function graphMachines(stepKey: string, n: number | null): void {
  const id = graphDoc?.nodeOfStep.get(stepKey);
  if (!id || !graphView) return;
  const node = graphView.graph?.nodes.find((x) => x.id === id);
  if (!node) return;
  if (n === null) graphView.run({ type: "setFixed", id, fixed: false });
  else if (n !== node.machines || !node.fixed) graphView.run({ type: "batch", commands: [{ type: "setMachines", id, machines: n }, { type: "setFixed", id, fixed: true }] });
  syncHudCount();
}

/** La fiche (S62) montre le nombre du graphe (pas celui du dernier calcul) et s'il est fixé. */
function syncHudCount(): void {
  const inp = $("flow-hud").querySelector<HTMLInputElement>("[data-mset-input]");
  const id = inp && graphDoc?.nodeOfStep.get(inp.dataset.key!);
  const node = id ? graphView?.graph?.nodes.find((x) => x.id === id) : undefined;
  if (!inp || !node) return;
  if (document.activeElement !== inp) inp.value = String(Math.ceil(node.machines - 1e-9));
  inp.closest(".mset")?.classList.toggle("on", !!node.fixed);
}

/** Bloc sélectionné : lui et ses liaisons en évidence, et sa fiche (S62) à côté. */
function applyFlowSel(): void {
  const hud = $("flow-hud");
  const nodeId = flowSel && graphDoc ? graphDoc.nodeOfStep.get(flowSel) : undefined;
  if (flowSel && !nodeId) flowSel = null;
  if (flowSel) flowEdge = null;
  // La sélection du canevas suit la fiche, sauf un nœud sans étape du plan (ajouté à la main) ou une
  // sélection multiple : le canevas les garde.
  const gsel = graphView?.selected ?? null;
  if (graphView && gsel !== (nodeId ?? null) && (flowSel || (gsel && stepOfNode(gsel)))) graphView.select(nodeId ?? null);
  const edge = flowEdge;
  hud.hidden = !flowSel && !edge;
  hud.innerHTML = flowSel ? renderFlowHud(viewCtx(), flowSel, (m) => surveyState(m, REPO_PORTS, currentPorts().local)) : edge ? renderEdgeHud(viewCtx(), edge) : "";
  // « Comment c'est calculé » (S7) : sous la barre du bas, pour le bloc ou la liaison sélectionnés.
  syncHudCount();
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
type FactoryState = {
  /** Plan abrégé d'avant « Chercher un meilleur plan » : repris si le joueur arrête la recherche. */
  prev?: FactoryState; key: string; plan: FactoryPlan | null; ms: number; job: FactoryJob | null; done: number; label: Text; error: string | null; cancelled: boolean; flows: FactoryArrow[] | null; cached?: boolean; since?: number };
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

/** Critères des plans de pose, en mots de joueur, dans la langue choisie. */
const critText = (c: PoseCriterion): { label: string; why: string } => ({ label: t(`mv.crit.${c}`), why: t(`m.crit.${c}.why`) });

/** Priorités du plan (objectif en cours) : l'ordre en une ligne, la liste à réordonner dépliée. */
/** Réglage « Machines » du plan (S9) : mode, machines choisies, raccourcis ; la recherche reste en place. */
function renderMachineFilter(p: Plan): void {
  const pm = filterNow();
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mf-mode"]')) r.checked = r.value === pm.mode;
  $("mf-sum").textContent = filterSummary({ data }, pm) ?? t("mf.sum.none");
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
      .map((c, i) => `<span class="ord"><b>${i + 1}</b> ${esc(criterionText(c).label)}</span>`)
      .join(`<span class="sep" aria-hidden="true">›</span>`) + (list.length > 3 ? `<span class="sep">› …</span>` : "");
  $("criteria-list").innerHTML = renderPrioItems(list.map((c, i) => ({ key: c, label: criterionText(c).label, why: i === 0 ? criterionWhy(goal, c) : criterionText(c).why })));
  $("criteria-chips").innerHTML = renderPrioChips(list.map((c, i) => ({ key: c, label: t(`pb.crit.${c}`), why: i === 0 ? criterionWhy(goal, c) : criterionText(c).why })));
  $("criterion-hint").textContent = criterionHint(goal, list[0]!);
}

function setCriteria(list: Criterion[], focus?: Criterion): void {
  settings.criteria = { ...settings.criteria, [settings.goal]: list };
  update();
  if (focus) focusItem($("criteria-list"), focus);
}

function renderPriority(): void {
  $("pose-priority").innerHTML = renderPrioItems(settings.posePriority.map((k) => ({ key: k, ...critText(k) })));
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
    const base = s && m ? requestFromStep(s, (id) => !!data.items.get(id)?.isFluid, m.cost, outOrder(s.recipeId)) : null;
    const req = base && { ...base, tier3Only: settings.tier3Only, priority: settings.posePriority };
    if (req) moduleReqs.set(key, req);
    // S56 : chaque essai est vérifié par le moteur du bac à sable.
    modules.set(key, req && m ? designModule(req, pts.machines[m.id] ?? null, m.size, CATALOG, anyName, sandboxCatalog()) : null);
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
  return st === "local" ? t("m.ports.local") : st === "manquant" ? t("m.ports.assumed") : "";
}

// ---------------------------------------------------------------- schéma du plan affiché (S55)
/** Produits d'une recette dans l'ordre : les ports de sortie sont pris dans cet ordre, comme dans le bac à sable. */
const outOrder = (recipe: string): string[] | undefined => { const r = data.recipes.get(recipe); return r ? Object.keys(r.outputs) : undefined; };
/** Le plan affiché (module ou usine), converti à la demande pour le bac à sable. */
let poseSchem: { name: string; conv: () => Converted } | null = null;
const schemButtons = () =>
  `<button type="button" class="link" data-msch="bac">${t("m.schem.bac")}</button>`;
/** Écran d'attente par-dessus la page pendant un long calcul (conversion d'une grosse usine en schéma). */
async function busy<T>(text: string, fn: () => Promise<T> | T): Promise<T> {
  const el = document.createElement("div");
  el.className = "busy";
  el.setAttribute("role", "status");
  el.innerHTML = `<div class="busy-in"><span class="busy-spin" aria-hidden="true"></span>${esc(text)}</div>`;
  document.body.append(el);
  await new Promise((r) => setTimeout(r, 50)); // l'écran s'affiche avant que le calcul n'occupe la page
  try {
    return await fn();
  } finally {
    await new Promise((r) => setTimeout(r, 0));
    el.remove();
  }
}
async function onSchem(): Promise<void> {
  if (!poseSchem) return;
  const ps = poseSchem;
  await busy(t("m.schem.busy"), () => schemGo(ps));
}
async function schemGo(ps: NonNullable<typeof poseSchem>): Promise<void> {
  const c = ps.conv(), name = ps.name;
  const s: Schematic = { name, description: "", labels: [], width: c.width, height: c.height, layout: c.layout };
  go({ page: "bac" });
  sandbox.open(s);
}
/** Partager ou modifier depuis le tableau de bord (S60) : la vue Usine se calcule d'abord si besoin. */
async function shareGo(kind: string): Promise<void> {
  if (kind === "file") return share.openShare();
  if (!poseSchem) {
    if (settings.resultTab !== "pose") $("rtab-pose").click();
    await busy(t("m.schem.wait"), async () => {
      for (let i = 0; i < 600 && !poseSchem; i++) await new Promise((r) => setTimeout(r, 100));
    });
  }
  await onSchem();
}
document.querySelector(".cmd-right")!.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLElement>("[data-share]");
  if (b) void shareGo(b.dataset.share!);
});
$("pose-links").addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLElement>("[data-msch]");
  if (b) void onSchem();
});

/** La liste « Vue » des modules, et le rail des étapes à gauche qui la reprend (S60). */
function fillPoseSteps(): { mods: Step[]; asms: Step[] } {
  const choices = plan ? plan.steps.filter(isPosable) : [];
  const sel = $<HTMLSelectElement>("pose-step");
  if (!choices.length) {
    sel.innerHTML = "";
    railSteps = [];
    renderStepRail();
    return { mods: [], asms: [] };
  }
  // S25 : l'onglet Usine s'ouvre sur toute l'usine ; un module s'ouvre en cliquant dessus (ou par la liste « Vue »).
  if (!poseStep || (poseStep !== USINE && !choices.some((s) => s.key === poseStep))) poseStep = USINE;
  const mods = choices.filter((s) => !assemblyKind(s));
  const asms = choices.filter((s) => assemblyKind(s));
  const opt = (s: (typeof choices)[number], text: string) => `<option value="${esc(s.key)}"${s.key === poseStep ? " selected" : ""}>${esc(text)}</option>`;
  sel.innerHTML =
    `<option value="${USINE}"${poseStep === USINE ? " selected" : ""}>${esc(t("m.pose.usine"))}</option>` +
    (mods.length ? `<optgroup label="${esc(t("m.pose.perStep"))}">${mods.map((s) => opt(s, `${s.machines} × ${anyName(s.machine)} — ${anyName(s.item)}`)).join("")}</optgroup>` : "") +
    (asms.length ? `<optgroup label="${esc(t("m.pose.asms"))}">${asms.map((s) => opt(s, assemblyKind(s) === "ferme" ? t("m.pose.farm", { n: String(s.machines), item: anyName(s.item) }) : t("m.pose.engine", { n: String(s.machines) }))).join("")}</optgroup>` : "");
  // Les ports locaux après le nom d'un module (relevé local, ports supposés).
  for (const s of mods) {
    const o = sel.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(s.key)}"]`);
    if (o) o.textContent += portsLabel(s.machine);
  }
  railSteps = [
    { key: USINE, name: t("plan.steps.usine"), sub: "" },
    ...mods.map((s) => ({ key: s.key, name: anyName(s.machine), sub: anyName(s.item), n: s.machines })),
    ...asms.map((s) => ({ key: s.key, name: assemblyKind(s) === "ferme" ? t("plan.steps.farm") : t("plan.steps.engine"), sub: anyName(s.item), n: s.machines })),
  ];
  renderStepRail();
  return { mods, asms };
}

// ---------------------------------------------------------------- mes designs (P2 bis, designs-model.ts)
/** Ancien plan enregistré (S64, avant P2 bis) : lu une fois, pour le ranger dans « Mes designs ». */
type SavedPlan = { name: string; goal: Goal; item: string; mode: "rate" | "machines"; rate: number; machines: number; energyMFps: number; money: number; graph?: StoredGraphEdit; d?: string; active?: true };
/** P2 : `d` le design entier (réglages, graphe, bac à sable) au format du lien ; `active` le design affiché avant d'ouvrir un lien. */
const SAVED_MAX = 50;
const KEY_SAVED = "ind-calc:v1:saved-plans";
function loadSaved(): SavedPlan[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_SAVED) ?? "[]");
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p.name === "string" && typeof p.goal === "string").slice(0, SAVED_MAX) : [];
  } catch {
    return [];
  }
}
const GOAL_HASH: Record<Goal, string> = { objet: "#objet", "énergie": "#energie", recherche: "#rp", argent: "#argent" };
function savedName(s: Settings = settings): string {
  const g = s.goal;
  if (g === "objet") return s.mode === "rate" ? `${fmt(displayRate(s.rate, s.rateUnit), 2)}/${s.rateUnit === "s" ? "s" : "min"} ${itemName(s.item)}` : `${s.machines} × ${itemName(s.item)}`;
  if (g === "énergie") return `${fmt(s.energyMFps, 2)} MF/s`;
  if (g === "argent") return `${fmt(s.money, 0)}/min`;
  return t("plan.goal.recherche");
}
// ---------------------------------------------------------------- partage par lien (P2, PLAN-PARTAGE.md)

/** Réglages complets d'un design reçu (un champ venu d'une autre version prend la valeur par défaut). */
const designSettings = (d: Design): Settings => {
  const { schema: _s, ...rest } = d.settings; // description et étiquettes d'un schéma du bac à sable
  return { ...DEFAULT_SETTINGS, ...rest } as Settings;
};
/** Le design affiché : réglages, graphe édité et bac à sable (relus, jamais modifiés). */
function currentDesign(withSandbox: boolean): Design {
  const d = assembleDesign({ site: SITE_VERSION, engine: ENGINE_VERSION, name: activeDesign()?.name ?? savedName(), settings, graph: gedit, sandbox: sandbox.layout(), withSandbox, profile: lectureProfile() });
  return frozenOn() ? { ...d, site: frozen!.site, ...(frozen!.engine ? { engine: frozen!.engine } : {}), factory: frozen!.layout } : d;
}

// ---- usine figée d'un fichier .indus (P4) : montrée telle quelle tant que le design n'est pas modifié
const KEY_FROZEN = "ind-calc:v1:frozen";
/** `sig` : le design auquel elle va (null : pas encore affiché) ; `show` : montrée à la place de l'usine recalculée. */
let frozen: { design: number | null; layout: Layout; site: string; engine?: string; sig: string | null; show: boolean } | null = null;
const frozenSig = () => {
  const { resultTab: _r, usine, entered: _e, existing: _x, useExisting: _y, ...rest } = settings;
  return fnv(stableJson([usine.noGate ? { ...rest, noGate: true } : rest, gedit?.touched ? [gedit.graph, gedit.solved] : null]));
};
const frozenOn = () => !!frozen && frozen.sig !== null && frozen.sig === frozenSig();
async function storeFrozen(): Promise<void> {
  try {
    if (!frozen) return localStorage.removeItem(KEY_FROZEN);
    const { layout, ...rest } = frozen;
    localStorage.setItem(KEY_FROZEN, JSON.stringify({ ...rest, data: await encodeDesign({ site: rest.site, settings: {}, factory: layout }) }));
  } catch {
    // stockage plein : elle reste dans le design enregistré
  }
}
async function loadFrozen(): Promise<void> {
  try {
    const x = JSON.parse(localStorage.getItem(KEY_FROZEN) ?? "null") as { design: number; site: string; engine?: string; sig: string; show: boolean; data: string } | null;
    if (!x || x.design !== designs.active) return;
    const layout = (await decodeDesign(x.data)).factory;
    if (!layout || frozen || x.design !== designs.active) return;
    frozen = { design: x.design, layout, site: x.site, ...(x.engine ? { engine: x.engine } : {}), sig: x.sig, show: x.show !== false };
    render();
  } catch {
    frozen = null;
  }
}
/** Le bandeau de l'usine figée, et son dessin s'il est demandé ; vrai : rien d'autre à montrer. */
function renderFrozen(): boolean {
  const bar = $("pose-frozen"), on = frozenOn(), usine = !poseStep || poseStep === USINE || !plan?.steps.some(isPosable);
  bar.hidden = !frozen || !usine;
  if (!frozen || !usine) return false;
  const key = on ? (frozen.show ? "frz.on" : "frz.off") : "frz.stale";
  bar.innerHTML = `<span>${esc(t(key, { v: frozen.site || "?" }))}</span>${on ? ` <button type="button" class="small" data-frozen>${esc(t(frozen.show ? "frz.recalc" : "frz.show"))}</button>` : ""}`;
  if (!on || !frozen.show) return false;
  const f = frozenSvg(frozen.layout, { cat: sandboxCatalog(), img: (kind, id) => pictureOf(kind, id)?.src ?? null, itemName });
  if (f.unknown) bar.firstElementChild!.textContent += ` ${t("frz.unknown", { n: f.unknown })}`;
  $("pose-busy").hidden = $("pose-cut").hidden = $("cat-cut").hidden = true;
  $("pose-head").innerHTML = $("pose-legend").innerHTML = $("pose-details").innerHTML = $("pose-links").innerHTML = $("pose-mods").innerHTML = $("pose-bar").innerHTML = $("pose-more-usine").innerHTML = "";
  showFocus(null);
  const layout = frozen.layout;
  poseSchem = { name: t("m.schem.factory"), conv: () => ({ width: 0, height: 0, layout: structuredClone(layout) }) as Converted };
  $("rpanel-pose").classList.remove("computing");
  showPoseSvg(f, `frozen|${frozen.sig}`, true);
  return true;
}
/** L'usine à mettre dans un fichier : celle qui est figée, sinon celle du site, calculée au besoin. */
function factoryForFile(): { now: Layout | null; later: Promise<Layout | null> | null } {
  if (frozenOn()) return { now: frozen!.layout, later: null };
  ensurePlan();
  if (!printable()) return { now: null, later: null };
  if (!currentFactory()) startFactory();
  const st = currentFactory()!, p = plan;
  const conv = (fp: FactoryPlan) => layoutFromFactory(fp, sandboxCatalog(), CATALOG, (id) => !!data.items.get(id)?.isFluid, settings.tier3Only).layout;
  if (st.plan) return { now: conv(st.plan), later: null };
  if (st.error || st.cancelled) return { now: null, later: null };
  const wait = async () => {
    while (!st.plan && !st.error && !st.cancelled && factories.get(st.key) === st) await new Promise((r) => setTimeout(r, 200));
    return st.plan && plan === p ? conv(st.plan) : null;
  };
  return { now: null, later: wait() };
}
/** Affiche un design : réglages, graphe et bac à sable (`sandboxOnly` : ancien lien du bac à sable). */
function applyDesign(d: Design, sandboxOnly = false): void {
  if (d.sandbox) sandbox.setLayout(d.sandbox);
  if (sandboxOnly) return;
  showProfile(d.profile ?? null);
  frozen = d.factory ? { design: null, layout: d.factory, site: d.site, ...(d.engine ? { engine: d.engine } : {}), sig: null, show: true } : null;
  saveSettings(designSettings(d));
  Object.assign(settings, loadSettings());
  gedit = d.graph ? (structuredClone(d.graph) as GraphEdit) : null;
  graphDoc = null;
  pendingGraphPlan = null;
  saveGraphEdit(true);
  planDirty = true;
  syncForm();
}
// ---- session de lecture (P3 bis b) : le profil du design affiché est celui du site (profile-store.ts)
/** Le profil en vigueur dans la session de lecture, à ranger dans le design (null : c'est la partie du joueur). */
function lectureProfile(): DesignProfile | null {
  return lecture() ? profileNow() : null;
}
/** Le profil en vigueur, celui du joueur ou de la session de lecture, pour un design ou un lien. */
function profileNow(w = { base: true, contrib: true }): DesignProfile {
  return assembleProfile({ progress: simulated ?? prog, player, month: gameView().month, rp: rpNow(), corrections, surveys: loadLocalSurveys(), interfaces: loadLocalInterfaces(), diesel: dieselReadings }, w);
}
const hasContribNow = () => hasContrib(profileNow({ base: false, contrib: true }));
/** Le design du lien, avec ce qui est coché dans « Partager ». */
function sharedDesign(w: ShareWith): Design {
  const { profile: _p, factory: _f, ...cur } = currentDesign(w.sandbox);
  const d = { ...cur, site: SITE_VERSION, engine: ENGINE_VERSION };
  const p = w.profile || w.contrib ? profileNow({ base: w.profile, contrib: w.contrib }) : null;
  return p && (p.player || hasContrib(p)) ? { ...d, profile: p } : d;
}

// ---- imprimer le profil (P3 bis c, print-profile.ts)
const KEY_PRINTS = "ind-calc:v1:prints";
let prints: Prints = loadPrints();
function loadPrints(): Prints {
  try {
    return readPrints(JSON.parse(localStorage.getItem(KEY_PRINTS) ?? "null"));
  } catch {
    return noPrints();
  }
}
/** Remplace la partie du joueur et la pile des impressions, ou rien (stockage plein). */
function writeGame(keys: OwnKeys, next: Prints): boolean {
  const before = ownItem(KEY_PRINTS);
  try {
    localStorage.setItem(KEY_PRINTS, JSON.stringify(next));
  } catch {
    share.toast(t("dsg.full"), true, 8000);
    return false;
  }
  if (!writeOwn(keys)) {
    setOwnItem(KEY_PRINTS, before ?? "null");
    share.toast(t("dsg.full"), true, 8000);
    return false;
  }
  prints = next;
  return true;
}
function gameChanged(): void {
  if (!lecture()) {
    ownAway = false;
    reloadProfile();
    render();
  }
  designsView.refresh();
}
const countNow = (c: unknown) => countCorrections((c ?? {}) as OverridesFile);
/** La fenêtre « Que reprendre sur ta partie ? » ; null : annulé. */
async function choosePrint(p: DesignProfile, name: string): Promise<PrintGroup[] | null> {
  const own = withOwnProfile();
  const num = (v: unknown) => (typeof v === "number" ? fmt(v, 2) : "—");
  const cell = (g: PrintGroup, x: DesignProfile): string => {
    const pl = (x.player ?? {}) as unknown as PlayerInfo;
    if (g === "research") return `${x.progress?.unlocked.length ?? 0}`;
    if (g === "game") return [t(`dif.${pl.difficulty}` as never), `${num(pl.pollutionPct ?? DEFAULT_POLLUTION)} %`, pl.month ? t("prn.month", { n: pl.month }) : t("prn.month.auto"), ...(pl.igloo ? [t("prn.igloo")] : []), ...(pl.gamePass ? [t("prn.pass")] : [])].join(" · ");
    if (g === "plot") return pl.plotW && pl.plotH ? `${num(pl.plotW)} × ${num(pl.plotH)}` : "—";
    if (g === "money") return `${num(pl.money)} $ · ${num(pl.rp)} RP`;
    if (g === "setup") return t(pl.research ? "prn.filled" : "prn.empty");
    return t("prn.contrib.n", { n: countNow(x.corrections) + [x.surveys, x.interfaces, x.diesel].reduce<number>((s, v) => s + Object.keys((v ?? {}) as object).length, 0) });
  };
  const groups = groupsOf(p);
  const rows = groups.map((g) => `<tr><td><input type="checkbox" id="prn-${g}" checked aria-label="${esc(t(`prn.g.${g}`))}"></td><td><label for="prn-${g}">${esc(t(`prn.g.${g}`))}</label></td><td>${esc(cell(g, own))}</td><td><b>${g === "contrib" ? "+ " : ""}${esc(cell(g, p))}</b></td></tr>`).join("");
  const body = `<table class="prn-t"><thead><tr><th></th><th></th><th>${esc(t("prn.mine"))}</th><th>${esc(t("prn.after"))}</th></tr></thead><tbody>${rows}</tbody></table>${groups.includes("contrib") ? `<p class="hint">${esc(t("prn.contrib.hint"))}</p>` : ""}<p class="hint">${esc(t("prn.kept", { name }))}</p>`;
  if ((await ask(t("prn.title"), body, [{ value: "ok", label: t("prn.go"), primary: true }, { value: "", label: t("m.cancel") }])) !== "ok") return null;
  const on = groups.filter((g) => input(`prn-${g}`).checked);
  return on.length ? on : null;
}
/** Le profil du joueur, même pendant une session de lecture, pour la colonne « Ma partie ». */
function withOwnProfile(): DesignProfile {
  const k = ownKeys();
  const o = (key: string): Record<string, unknown> => {
    try {
      return (JSON.parse(k[key] ?? "null") ?? {}) as Record<string, unknown>;
    } catch {
      return {};
    }
  };
  return {
    progress: { unlocked: (o(PROFILE_KEYS.progress).unlocked as string[] | undefined) ?? [], reqItemsDone: [], owned: [] },
    player: { difficulty: "normal", ...o(PROFILE_KEYS.player) },
    corrections: o(PROFILE_KEYS.corrections),
    surveys: o(PROFILE_KEYS.surveys).machines,
    interfaces: o(PROFILE_KEYS.interfaces).interfaces,
    diesel: o(PROFILE_KEYS.diesel).diesel,
  };
}
/** Imprime le profil de la session de lecture affichée : le design devient un design ordinaire. */
async function printActive(groups: PrintGroup[]): Promise<void> {
  const n = activeDesign(), p = lectureProfile();
  if (!n || !p) return;
  const dirty = designDirty(n);
  const clean = async (s: string) => {
    const { profile: _p, ...d } = await decodeDesign(s);
    return encodeDesign(d);
  };
  let data = n.d;
  try {
    if (data) data = await clean(data);
  } catch {
    data = undefined;
  }
  if (designs.active !== n.id || !lecture()) return;
  const own = ownKeys();
  touchOwn();
  if (!writeGame(printOnto(ownKeys(), p, groups, Date.now()), { ...prints, on: [...prints.on, { design: n.id, name: n.name, keys: own }] })) return;
  const work = dirty ? await encodeDesign({ ...currentDesign(true), profile: undefined } as Design) : undefined;
  if (data) n.d = data;
  else delete n.d;
  delete n.w;
  delete n.lec;
  ownAway = false;
  showProfile(null);
  rebase();
  if (work !== undefined) designs.base = ""; // ce qui n'était pas enregistré le reste
  storeDesigns();
  designsView.refresh();
  share.toast(t("prn.done", { name: n.name }), false, 5000);
}
const printLecture = () =>
  withDesigns(async () => {
    const p = lectureProfile(), n = activeDesign();
    const groups = p && n ? await choosePrint(p, n.name) : null;
    if (groups) await printActive(groups);
  });
/** Après un changement de l'arbre : un design imprimé jeté rend la partie d'avant, restauré remet la sienne. Le joueur est prévenu. */
async function settlePrints(): Promise<void> {
  const live = (id: number) => !!find(designs, id) && !inBin(designs, id);
  for (const e of [...prints.on].reverse()) {
    if (live(e.design)) continue;
    const u = unprint(prints, e.design, ownKeys());
    if (!u.apply) {
      writeGame(ownKeys(), u.prints);
      continue;
    }
    if (!writeGame(settled(u.apply, Date.now()), u.prints)) return;
    gameChanged();
    const a = await ask(t("prn.back.title"), `<p>${esc(t("prn.back.text", { name: e.name }))}</p>`, [{ value: "ok", label: t("prn.back.ok"), primary: true }, { value: "keep", label: t("prn.back.keep") }]);
    if (a === "keep") {
      const was = prints.off.find((x) => x.design === e.design);
      if (was && writeGame(was.keys, { ...prints, off: prints.off.filter((x) => x !== was) })) gameChanged();
    }
  }
  for (const e of [...prints.off]) {
    if (live(e.design)) {
      const u = reprint(prints, e.design, ownKeys());
      if (!u.apply || !writeGame(settled(u.apply, Date.now()), u.prints)) return;
      gameChanged();
      await ask(t("prn.again.title"), `<p>${esc(t("prn.again.text", { name: e.name }))}</p>`, [{ value: "ok", label: t("prn.back.ok"), primary: true }]);
    } else if (!find(designs, e.design)) writeGame(ownKeys(), { ...prints, off: prints.off.filter((x) => x !== e) });
  }
}
/** « Remettre ma partie d'avant » : défait la dernière impression, le design reste. */
async function undoPrint(): Promise<void> {
  const e = prints.on.at(-1);
  if (!e || (await ask(t("prn.undo.title"), `<p>${esc(t("prn.undo.text", { name: e.name }))}</p>`, [{ value: "ok", label: t("prn.undo.ok"), primary: true }, { value: "", label: t("m.cancel") }])) !== "ok") return;
  if (!writeGame(settled(e.keys, Date.now()), { ...prints, on: prints.on.slice(0, -1) })) return;
  gameChanged();
  share.toast(t("lec.toast"));
}
/** Le design affiché juste avant celui qui s'ouvre (là où « Revenir à ma partie » ramène). */
let leftDesign: number | null = null;
/** Le design affiché porte un profil : la session s'ouvre (ou change) ; sinon on revient à la partie du joueur. */
function showProfile(p: DesignProfile | null): void {
  const was = lecture();
  if (!p && !was) return;
  if (p) {
    if (!was && journal.clock.playing) setJournal(touch(journal, Date.now()));
    enterLecture(p, { design: designs.active, back: was ? was.back : leftDesign, mine: was ? was.mine : { existing: settings.existing, useExisting: settings.useExisting } });
  } else {
    touchOwn();
    leaveLecture();
  }
  reloadProfile();
  if (!p && ownAway) {
    ownAway = false;
    void recallPlaying();
  }
}
/** Compte les changements de profil : une réponse attendue d'avant ne s'applique plus. */
let profileEpoch = 0;
/** Relit tout ce qui vient du profil actif, et refait ce qui en dépend. */
function readProfile(): void {
  corrections = pruneIntegratedCorrections(loadCorrections(), repoOverrides).kept;
  dieselReadings = loadDieselReadings();
  (files as RawFiles).dieselReadings = dieselReadings;
  player = loadPlayer();
  journal = loadJournal() ?? startJournal(Date.now(), player);
  rebuildData();
  prog = sanitizeProgress(data, loadProgress());
  simulated = null;
  planDirty = true;
}
function reloadProfile(): void {
  profileEpoch++;
  // Parcours guidé sur une progression simulée : elle appartenait à l'autre profil.
  tourGedit = null;
  readProfile();
  modulesFor = "";
  $("recall").hidden = true;
  syncPlayerForm();
  buildings.reload();
  renderLecture();
}
function renderLecture(): void {
  const on = !!lecture();
  document.body.classList.toggle("lecture", on);
  $("lecture").hidden = !on;
  if (on) setHtml($("lecture-txt"), t("lec.text.html", { name: esc(activeDesign()?.name ?? "") }));
  setDocTitle();
}
/** « Revenir à ma partie » : le design d'avant la lecture, sinon le premier sans profil, sinon un design neuf. */
async function backToMine(): Promise<void> {
  const ok = (n: Tree["root"]["kids"][number] | undefined): n is DesignNode => n?.type === "des" && !n.lec;
  const first = (d: DirNode): DesignNode | undefined => {
    for (const k of sorted(d.kids)) {
      const r = k.type === "dir" ? first(k) : ok(k) ? k : undefined;
      if (r) return r;
    }
    return undefined;
  };
  const b = lecture()?.back ?? null;
  const kept = b === null || inBin(designs, b) ? undefined : find(designs, b)?.node;
  const to = ok(kept) ? kept : first(designs.root);
  if (to) await openDesign(to.id);
  else await createDesign(designs.root);
  if (!lecture()) share.toast(t("lec.toast"));
}
/**
 * Ouvre un design reçu par lien : rangé dans « Reçus » (nom pris : la fenêtre de conflit) et affiché ; le design
 * affiché reste dans « Mes designs » avec son travail en cours. Rend son nom, ou null s'il n'a pas été ouvert.
 */
async function openReceived(d: Design, choice: OpenChoice, legacy: boolean): Promise<string | null> {
  const groups = choice === "print" && d.profile ? await choosePrint(d.profile, d.name?.trim() || savedName(designSettings(d))) : null;
  if ((choice === "print" && !groups) || !(await keepActive())) return null;
  // Ancien lien du bac à sable : seul le montage change, les réglages et le graphe restent ceux affichés.
  const cur = currentDesign(true);
  const { print: _print, ...got }: Design = legacy ? { ...cur, ...(d.sandbox ? { sandbox: d.sandbox } : {}) } : d;
  const name = d.name?.trim() || savedName(designSettings(got));
  // L'empreinte de l'auteur a servi à la fenêtre ; le design rangé s'en passe.
  const n = makeDesign(designs, name, { d: await encodeDesign({ ...got, name }), ...(got.profile ? { lec: true as const } : {}) });
  const inbox = folder(designs, t("dsg.inbox"));
  const r = await place(designs, n, null, inbox, designsView.asker("link", t("dsg.from.link")));
  if (!r.done) {
    if (!inbox.kids.length) designs.root.kids = designs.root.kids.filter((k) => k !== inbox);
    storeDesigns();
    designsView.refresh();
    return null;
  }
  inbox.open = true;
  const left = (leftDesign = designs.active);
  designs.active = n.id;
  dropBlank(left);
  applyDesign(got, legacy);
  rebase();
  if (!storeDesigns()) return n.name;
  designsView.select(n.id);
  await settlePrints(); // « remplacer » a pu envoyer un design imprimé à la corbeille
  if (groups) await printActive(groups);
  return n.name;
}

// ---- l'arbre « Mes designs » : stockage, design affiché, travail en cours (P2 bis)
const KEY_DESIGNS = "ind-calc:v1:designs";
let designs: Tree = emptyTree();
/** Une action à la fois (ouvrir, enregistrer…) : deux doubles clics rapides ne se croisent pas. */
let designBusy = false;
function storeDesigns(): boolean {
  setLectureDesign(designs.active);
  try {
    localStorage.setItem(KEY_DESIGNS, JSON.stringify(designs));
    return true;
  } catch {
    share.toast(t("dsg.full"), true, 8000);
    return false;
  }
}
const activeDesign = (): DesignNode | null => {
  const n = designs.active === null ? null : find(designs, designs.active)?.node;
  return n?.type === "des" ? n : null;
};
/** Le profil de la session de lecture, hors ce qui ne se range pas dans le design (journal, heure du relevé, dépense des RP). */
function profileSig(): unknown[] {
  const { rpAt: _a, spendRp: _s, month: _m, ...rest } = player;
  const p = simulated ?? prog;
  return [[...p.unlocked].sort(), [...p.reqItemsDone].sort(), [...p.owned].sort(), rest, gameView().month, corrections, loadLocalSurveys(), loadLocalInterfaces(), dieselReadings];
}
/** Signature du design affiché (hors vue : onglet, affichage de l'usine) : dit s'il a changé depuis son ouverture. */
function designSig(): string {
  const { resultTab: _r, usine, entered, ...rest } = settings;
  const sb = sandbox.layout();
  return fnv(stableJson([usine.noGate ? { ...rest, noGate: true } : rest, [...entered].sort(), gedit?.touched ? [gedit.graph, gedit.solved] : null, hasSandbox(sb) ? sb : null, ...(lecture() ? [profileSig()] : [])]));
}
/** Le design affiché devient la référence : rien à enregistrer. */
function rebase(): void {
  render(); // le rendu peut annuler un réglage périmé : la référence se prend après
  if (!frozen) void storeFrozen();
  else if (frozen.sig === null) {
    Object.assign(frozen, { sig: frozenSig(), design: designs.active });
    void storeFrozen();
    if (settings.resultTab === "pose") render();
  }
  designs.base = designSig();
  renderLecture();
}
const changedSinceOpen = () => designs.base !== null && designSig() !== designs.base;
function designDirty(n: DesignNode): boolean {
  if (n.w !== undefined) return true;
  if (n.id !== designs.active) return false;
  return changedSinceOpen() || (!n.d && !isBlank(settings.goal));
}
const machinesNow = () => (plan && !isBlank(settings.goal) && settings.goal !== "recherche" ? { mach: Math.round(plan.totals.machines) } : {});
/** Avant de quitter le design affiché : son travail non enregistré y est gardé. Faux si le stockage le refuse. */
async function keepActive(): Promise<boolean> {
  nameActive();
  const n = activeDesign();
  if (!n || !designDirty(n)) return true;
  if (n.w !== undefined && !changedSinceOpen()) return true; // déjà gardé tel quel
  const before = { w: n.w, at: n.at };
  Object.assign(n, { w: await encodeDesign(currentDesign(true)), at: Date.now(), ...machinesNow() });
  if (storeDesigns()) return true;
  if (before.w === undefined) delete n.w;
  else n.w = before.w;
  n.at = before.at;
  return false;
}
/** Un design neuf quitté sans rien y avoir mis ne reste pas dans la liste. */
function dropBlank(id: number | null): void {
  const f = id === null || id === designs.active ? null : find(designs, id);
  if (f?.parent && f.node.type === "des" && f.node.auto && f.node.d === undefined && f.node.w === undefined && !inBin(designs, f.node.id)) f.parent.kids = f.parent.kids.filter((k) => k !== f.node);
}
/** Un design jamais enregistré ni renommé porte le nom de son objectif. */
function nameActive(): void {
  const n = activeDesign(), p = n?.auto ? find(designs, n.id)?.parent : null;
  if (!n || !p) return;
  const name = free(p, isBlank(settings.goal) ? t("dsg.newdesign") : savedName(), n);
  if (name === n.name) return;
  n.name = name;
  storeDesigns();
}
async function withDesigns<R>(fn: () => Promise<R>): Promise<R | null> {
  if (designBusy) return null;
  designBusy = true;
  try {
    return await fn();
  } finally {
    designBusy = false;
  }
}
/** Réglages d'un design vide : les défauts du site, en gardant l'affichage et « Ma production ». */
const blankSettings = (): Settings => ({ ...structuredClone(DEFAULT_SETTINGS), goal: settings.goal, rateUnit: settings.rateUnit, energyUnit: settings.energyUnit, usine: settings.usine, resultTab: settings.resultTab, ...(lecture()?.mine ?? { existing: settings.existing, useExisting: settings.useExisting }) });
function showBlank(): void {
  applyDesign({ site: SITE_VERSION, settings: blankSettings() as unknown as Design["settings"] });
}
function afterShow(): void {
  if (currentPage() === "plan" && location.hash.split("/")[0] !== GOAL_HASH[settings.goal]) location.hash = GOAL_HASH[settings.goal];
  rebase();
  storeDesigns();
  designsView.refresh();
}
const openDesign = (id: number) =>
  withDesigns(async () => {
    const n = find(designs, id)?.node;
    if (n?.type !== "des" || !(await keepActive())) return;
    const data = contentOf(n);
    let d: Design | null = null;
    if (data) {
      try {
        d = await decodeDesign(data);
      } catch {
        return share.toast(t("share.saved.bad"), true);
      }
    }
    const left = (leftDesign = designs.active);
    designs.active = id;
    dropBlank(left);
    if (d) applyDesign(d);
    else showBlank();
    afterShow();
    share.toast(t("dsg.opened", { name: n.name }));
  });
const createDesign = (dir: DirNode) =>
  withDesigns(async () => {
    if (!(await keepActive())) return null;
    const n = addDesign(designs, dir, t("dsg.newdesign"), { auto: true });
    designs.active = n.id;
    showBlank();
    afterShow();
    return n.id;
  });
const saveDesign = (id: number) =>
  withDesigns(async () => {
    const n = find(designs, id)?.node;
    if (n?.type !== "des") return;
    nameActive();
    const before = { d: n.d, w: n.w };
    if (n.id === designs.active) {
      n.d = await encodeDesign(currentDesign(true));
      Object.assign(n, { at: Date.now(), ...machinesNow() });
      designs.base = designSig();
    } else if (n.w) n.d = n.w;
    delete n.w;
    delete n.auto;
    if (storeDesigns()) share.toast(t("dsg.saved", { name: n.name }));
    else {
      if (before.d !== undefined) n.d = before.d;
      else delete n.d;
      if (before.w !== undefined) n.w = before.w;
      if (n.id === designs.active) designs.base = "";
    }
  });
/** Revient au dernier enregistrement (le travail en cours est abandonné, après confirmation). */
const revertDesign = (id: number) =>
  withDesigns(async () => {
    const n = find(designs, id)?.node;
    if (n?.type !== "des" || !n.d) return;
    if ((await ask(t("dsg.revert.title"), `<p>${esc(t("dsg.revert.ask", { name: n.name }))}</p>`, [{ value: "ok", label: t("dsg.revert.ok"), primary: true }, { value: "", label: t("m.cancel") }])) !== "ok") return;
    const d = await decodeDesign(n.d);
    delete n.w;
    if (id === designs.active) {
      applyDesign(d);
      afterShow();
    } else storeDesigns();
  });
const copyDesign = (id: number) =>
  withDesigns(async () => {
    const n = find(designs, id)?.node;
    if (n?.type !== "des") return;
    const data = id === designs.active ? await encodeDesign(currentDesign(true)) : contentOf(n);
    const c = duplicate(designs, id, t("dsg.copyname", { name: n.name }), data);
    if (!c) return;
    if (!storeDesigns()) return void find(designs, c.id)?.parent?.kids.pop();
    designsView.select(c.id);
  });
/** Le design affiché n'est plus dans l'arbre (corbeille, suppression) : un design vide s'ouvre aussitôt. */
async function settleDesigns(): Promise<void> {
  await settleActive();
  await settlePrints();
}
async function settleActive(): Promise<void> {
  if (designs.active !== null && find(designs, designs.active) && !inBin(designs, designs.active)) return;
  const n = addDesign(designs, designs.root, t("dsg.newdesign"), { auto: true });
  designs.active = n.id;
  showBlank();
  afterShow();
}
/** Au démarrage : la session de lecture gardée doit être celle du design affiché. */
async function settleLecture(): Promise<void> {
  const n = activeDesign();
  if (lecture() && lecture()!.design === n?.id && n?.lec) return renderLecture();
  const content = n?.lec ? contentOf(n) : undefined;
  let p: DesignProfile | null = null;
  try {
    if (content) p = (await decodeDesign(content)).profile ?? null;
  } catch {
    p = null; // design abîmé : la partie du joueur
  }
  if (designs.active !== n?.id || (!p && !lecture())) return;
  showProfile(p);
  render();
}
/** Au démarrage : l'arbre enregistré, ou les anciens plans enregistrés rangés dedans (une fois ; l'ancienne liste reste). */
async function bootDesigns(): Promise<void> {
  const read = () => {
    try {
      return readTree(JSON.parse(localStorage.getItem(KEY_DESIGNS) ?? "null"));
    } catch {
      return null;
    }
  };
  const got = read();
  if (got) designs = got;
  else {
    const t0 = emptyTree();
    for (const p of loadSaved().reverse()) {
      let data = p.d;
      if (!data) {
        const graph = p.graph ? loadGraphEdit(p.graph) : null;
        const s = { ...settings, goal: p.goal, item: p.item, mode: p.mode, rate: p.rate, machines: p.machines, energyMFps: p.energyMFps, money: p.money, entered: [...new Set([...settings.entered, p.goal])] };
        data = await encodeDesign(assembleDesign({ site: SITE_VERSION, name: p.name, settings: s, graph, sandbox: null, withSandbox: false }));
      }
      addDesign(t0, t0.root, p.name, p.active ? { w: data } : { d: data });
    }
    designs = t0;
  }
  if (!activeDesign()) {
    const n = addDesign(designs, designs.root, t("dsg.newdesign"), { auto: true });
    designs.active = n.id;
    designs.base = null;
    nameActive();
    storeDesigns();
  }
  await settleLecture();
  await loadFrozen();
  designsView.refresh();
  await settlePrints();
  // Un autre onglet a changé l'arbre : on repart du sien (le design affiché ici y reste, s'il existe encore).
  addEventListener("storage", (e) => {
    if (e.key === KEY_PRINTS) {
      // Un autre onglet a imprimé ou remis la partie : celle-ci est relue.
      prints = loadPrints();
      return gameChanged();
    }
    if (e.key !== KEY_DESIGNS) return;
    const other = read();
    if (!other) return;
    const mine = designs.active, base = designs.base;
    designs = other;
    if (mine !== null && find(other, mine) && !inBin(other, mine)) [designs.active, designs.base] = [mine, base];
    designsView.refresh();
  });
  setInterval(() => {
    if (document.hidden || currentPage() !== "plan" || designBusy) return;
    nameActive();
    if (lecture()) renderLecture(); // le design a pu être renommé
    designsView.render();
  }, 1500);
}

// ---- empreinte (P3) : le plan et l'usine de l'auteur, comparés à ceux recalculés à l'ouverture
/** Y a-t-il un plan à empreinter (objectif saisi, usine à poser) ? */
const printable = () => !isBlank(settings.goal) && settings.goal !== "recherche" && !!plan?.steps.some(isPosable);
/** Empreinte du design affiché ; la pose dès que l'usine est calculée (lancée ici si elle ne l'est pas encore). */
function currentPrint(): { now: string | undefined; later: Promise<string | undefined> | null } {
  ensurePlan();
  if (!printable()) return { now: undefined, later: null };
  if (!currentFactory()) startFactory();
  const p = plan!, st = currentFactory()!, now = designPrint(p, st.plan);
  if (st.plan || st.error || st.cancelled) return { now, later: null };
  const wait = async () => {
    // Fini, arrêté, ou remplacé (réglages changés) : dans ces deux derniers cas, rien à compléter.
    while (!st.plan && !st.error && !st.cancelled && factories.get(st.key) === st) await new Promise((r) => setTimeout(r, 200));
    return st.plan && plan === p ? designPrint(p, st.plan) : undefined;
  };
  return { now, later: wait() };
}
/**
 * Empreinte d'un design reçu, sans l'afficher : ses réglages et son graphe prennent la place des nôtres le temps de
 * préparer le calcul (tout d'un trait, rien ne s'affiche entre-temps), puis l'usine se calcule en arrière-plan.
 * Le résultat est gardé comme celui de la page : ouvrir ensuite le design ne le recalcule pas.
 */
function probeDesign(d: Design): { print: Promise<string | undefined>; cancel: () => void } {
  return withProfile(d.profile ?? null, () => probeNow(d));
}
function probeNow(d: Design): ReturnType<typeof probeDesign> {
  // Avec un profil, l'essai se fait avec lui (c'est la session de lecture qui s'ouvrira) : le nôtre revient aussitôt.
  const keep = { corrections, dieselReadings, player, journal, data, dataErrors, prog, simulated, settings, gedit, plan, rpView, planDirty, planBuiltFrom, rows, signature, poseSchem, pendingGraphPlan, planDataCache };
  let job: FactoryJob | null = null;
  let stopped = false;
  let todo: { plan: Plan; key: string; input: FactoryInput } | null = null;
  let empty: string | undefined;
  try {
    if (d.profile) readProfile();
    settings = cleanSettings(designSettings(structuredClone(d)));
    gedit = d.graph ? (structuredClone(d.graph) as GraphEdit) : null;
    pendingGraphPlan = null;
    planDirty = true;
    const v = viewCtx();
    if (printable()) {
      rows = buildRows(v);
      signature = buildSignature(settings.goal, rows);
      todo = { plan: plan!, key: factoryKey(), input: factoryInputNow() };
    } else if (plan && !isBlank(settings.goal) && settings.goal !== "recherche") empty = designPrint(plan); // rien à poser ici (recherches manquantes…) : le plan diffère
  } catch {
    todo = null; // design illisible pour ce moteur : « pas pu être comparée »
  } finally {
    ({ corrections, dieselReadings, player, journal, data, dataErrors, prog, simulated, settings, gedit, plan, rpView, planDirty, planBuiltFrom, rows, signature, poseSchem, pendingGraphPlan, planDataCache } = keep);
    (files as RawFiles).dieselReadings = dieselReadings;
    if (d.profile) {
      layouts.clear();
      rcEntries = null;
      modulesFor = "";
    }
    saveSettings(settings); // le calcul a pu annuler un réglage périmé du design reçu et l'enregistrer
  }
  const run = async (): Promise<string | undefined> => {
    if (!todo) return empty;
    const { plan: p, key, input } = todo;
    const hit = await loadFactory(key);
    if (hit) return designPrint(p, hit.plan);
    if (stopped) return undefined;
    return new Promise((resolve) => {
      job = runFactory(input, {
        progress: () => {},
        done: (fp, ms) => {
          void saveFactory(key, fp, ms);
          resolve(designPrint(p, fp));
        },
        error: () => resolve(designPrint(p)),
      });
    });
  };
  return {
    print: run(),
    cancel: () => {
      stopped = true;
      job?.cancel();
    },
  };
}
/** Pastilles de la fenêtre « Partager » : étapes et machines du plan affiché, graphe retouché (le nom dit l'objectif). */
function shareFacts(): string[] {
  const out: string[] = [];
  if (plan && settings.entered.includes(settings.goal) && settings.goal !== "recherche") {
    out.push(t("share.steps", { n: plan.steps.length }), t("share.machines", { n: Math.round(plan.totals.machines) }));
  }
  if (gedit?.touched) out.push(t("share.nodes", { n: gedit.graph.nodes.length }));
  return out;
}

/** Fenêtre « Entrées / sorties » (maquette volets.html) : ce qui entre et ce qui sort, repris de la réponse. */
function renderIoPane(): void {
  const ins = $("answer").querySelector(".io-in"), outs = $("answer").querySelector(".io-out");
  const n = (p: Element | null) => (p ? Math.max(0, p.children.length - 1) : 0); // le premier enfant est le titre « À extraire » / « À évacuer »
  $("cat-io").hidden = !ins && !outs;
  $("cat-io-n").textContent = `${n(ins)} · ${n(outs)}`;
  $("io-list").replaceChildren(...[ins, outs].filter((x): x is Element => !!x).map((x) => x.cloneNode(true)));
  // Le reste de la réponse (centrales, remarques) : fenêtre « Notes », pour garder le menu léger.
  const rest = [...$("answer").querySelectorAll(".answer > :not(h2):not(.kpis):not(.io-in):not(.io-out)")];
  $("cat-notes").hidden = !rest.length;
  $("notes-list").replaceChildren(...rest.map((x) => x.cloneNode(true)));
}

/** Fenêtre « À régler » du volet droit : les modules qu'on ne peut pas reproduire tels quels en jeu (un clic ouvre
 *  leur bulle dans l'Usine), puis les valeurs à vérifier utilisées par le plan (un clic ouvre la correction). */
function renderWarnPane(): void {
  const v = viewCtx();
  const fp = currentFactory()?.plan;
  const mods = fp ? incompleteMachines(fp) : [];
  const vals = v.plan.verify.filter((e) => e.used);
  const n = mods.length + vals.length;
  $("cat-warn").hidden = !n;
  $("cat-warn-n").textContent = n ? String(n) : "";
  const row = (attr: string, name: string, why: string) => `<button type="button" class="cmd-li" ${attr} title="${esc(why)}">${icon("warn")}<span class="nm">${esc(name)}</span><span class="q">${esc(why)}</span>${icon("chevR")}</button>`;
  $("warn-list").innerHTML =
    (mods.length ? `<p class="cmd-sub">${esc(t("plan.warn.mods"))}</p>` + mods.map((m) => row(`data-warn-mod="${esc(m.box.key)}"`, m.box.label, m.reasons[0] ?? "")).join("") : "") +
    (vals.length ? `<p class="cmd-sub">${esc(t("plan.warn.vals"))}</p>` + vals.map((e) => row(fixAttr(e), e.scope === "machine" ? machineN(v, e.id) : itemName(e.item), fieldWord(v, e.flag.field))).join("") : "");
}

// ---------------------------------------------------------------- volets (S66, maquette volets.html)
/** Largeur des volets, gardée dans ce navigateur ; un volet réduit n'est plus qu'une colonne d'icônes. */
const KEY_RAILS = "ind-calc:v1:rails";
const RAIL_W = { l: 250, r: 320 };
let rails = { l: RAIL_W.l, r: RAIL_W.r, lOff: false, rOff: false };
try {
  const raw = JSON.parse(localStorage.getItem(KEY_RAILS) ?? "null");
  if (raw && typeof raw === "object") rails = { ...rails, ...raw };
} catch {
  // largeurs par défaut
}
function applyRails(save = false): void {
  const body = document.querySelector<HTMLElement>(".cmd-body")!;
  body.style.setProperty("--lw", `${rails.l}px`);
  body.style.setProperty("--rw", `${rails.r}px`);
  body.classList.toggle("l-off", rails.lOff);
  body.classList.toggle("r-off", rails.rOff);
  if (!save) return;
  try {
    localStorage.setItem(KEY_RAILS, JSON.stringify(rails));
  } catch {
    // stockage indisponible : réglage pour cette visite
  }
}
function bindRails(): void {
  applyRails();
  for (const sp of document.querySelectorAll<HTMLElement>(".cmd-split")) {
    const side = sp.dataset.split as "l" | "r";
    sp.addEventListener("pointerdown", (e) => {
      sp.setPointerCapture(e.pointerId);
      sp.classList.add("drag");
      const move = (ev: PointerEvent) => {
        const x = side === "l" ? ev.clientX : innerWidth - ev.clientX;
        // Tiré presque au bord : le volet se réduit ; sinon il prend la largeur voulue.
        if (side === "l") rails.lOff = x < 100;
        else rails.rOff = x < 100;
        if (x >= 100) rails[side] = Math.round(Math.max(180, Math.min(innerWidth * 0.45, x)));
        applyRails();
      };
      const up = () => {
        sp.classList.remove("drag");
        sp.removeEventListener("pointermove", move);
        sp.removeEventListener("pointerup", up);
        applyRails(true);
        posePZ?.fit?.();
      };
      sp.addEventListener("pointermove", move);
      sp.addEventListener("pointerup", up);
    });
    sp.addEventListener("dblclick", () => {
      rails[side] = RAIL_W[side];
      if (side === "l") rails.lOff = false;
      else rails.rOff = false;
      applyRails(true);
    });
  }
  $("page-plan").addEventListener("click", (e) => {
    const f = (e.target as Element).closest<HTMLElement>("[data-fold]");
    if (!f) return;
    if (f.dataset.fold === "l") rails.lOff = !rails.lOff;
    else rails.rOff = !rails.rOff;
    applyRails(true);
  });
  // Volet droit : chaque catégorie glisse vers sa fenêtre ; ‹ revient au menu.
  document.querySelector(".cmd-panes")!.addEventListener("click", (e) => {
    const c = (e.target as Element).closest<HTMLElement>(".cmd-cat");
    if (c) return paneOpen(c.dataset.pane!);
    if ((e.target as Element).closest("[data-back]")) paneBack();
    const wm = (e.target as Element).closest<HTMLElement>("[data-warn-mod]");
    if (wm) go({ page: "plan", goal: settings.goal, tab: "pose", step: USINE, focus: wm.dataset.warnMod! });
  });
}
function paneOpen(name: string): void {
  const p = document.querySelector<HTMLElement>(`.cmd-pane.sub[data-pane="${name}"]`);
  if (!p) return;
  $("pane-root").classList.add("away");
  p.classList.add("on");
  p.querySelector<HTMLElement>("[data-back]")?.focus({ preventScroll: true });
}
function paneBack(): void {
  const p = document.querySelector<HTMLElement>(".cmd-pane.sub.on");
  p?.classList.remove("on");
  $("pane-root").classList.remove("away");
  if (p) document.querySelector<HTMLElement>(`.cmd-cat[data-pane="${p.dataset.pane}"]`)?.focus({ preventScroll: true });
}

/** Étapes du rail : nom court, objet, nombre de machines (la liste « Vue » garde le texte long). */
let railSteps: { key: string; name: string; sub: string; n?: number }[] = [];
/** Levier du calcul de l'usine (R28) : module par module (S25, par défaut) ou recalculée pour l'usine entière. */
function modeLever(): string {
  const b = (full: boolean, key: Key) => `<button type="button" data-full="${full ? 1 : 0}" aria-pressed="${settings.usine.full === full}">${esc(t(key))}</button>`;
  return `<div class="cmd-seg" role="group" aria-label="${esc(t("uf.calc"))}">${b(false, "plan.mode.module")}${b(true, "plan.mode.full")}</div>`;
}
/** Rail des étapes (S60, maquette S58) : les vues de la liste « Vue », toujours visibles ; un clic ouvre l'onglet Usine. */
function renderStepRail(): void {
  let i = 0;
  const posed = posedSet();
  const mods = railSteps.filter((r) => r.key !== USINE);
  const done = mods.filter((r) => posed.has(r.key)).length;
  $("plan-steps-n").textContent = mods.length ? `${done} / ${mods.length}` : "";
  $("plan-steps-prog").querySelector("i")!.style.width = mods.length ? `${(100 * done) / mods.length}%` : "0";
  renderWarnPane();
  $("plan-steps-prog").title = mods.length ? t("plan.steps.n", { n: done, total: mods.length }) : "";
  $("plan-steps").innerHTML = railSteps.length
    ? railSteps
        .map((r) => {
          const on = r.key === poseStep && settings.resultTab === "pose";
          const isUsine = r.key === USINE;
          const p = !isUsine && posed.has(r.key);
          const mark = isUsine ? icon("home") : String(++i);
          const label = r.sub ? `${r.name} — ${r.sub}` : r.name;
          // S64 : chaque étape se coche « posée » dans le rail (le même stockage que « module posé ✓ », S25).
          const box = isUsine ? `<span class="cmd-box"></span>` : `<input type="checkbox" class="cmd-box" data-posed="${esc(r.key)}"${p ? " checked" : ""} aria-label="${esc(t("plan.steps.posed", { name: label }))}" title="${esc(t("plan.steps.posed", { name: label }))}">`;
          return `<div class="cmd-row${on ? " on" : ""}${p ? " done" : ""}">${box}<button type="button" class="cmd-step" data-step="${esc(r.key)}" aria-pressed="${on}" title="${esc(t("plan.steps.aria", { name: label }))}"><span class="n">${mark}</span><span class="nm">${esc(r.name)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span>${r.n ? `<span class="x">×${r.n}</span>` : ""}</button>${isUsine ? "" : moduleWarn(r.key)}</div>${isUsine ? modeLever() : ""}`;
        })
        .join("")
    : `<p class="hint">${esc(t("plan.steps.none"))}</p>`;
}

function renderPose(): void {
  // La boîte de calcul et le bandeau du plan abrégé ne concernent que « Toute l'usine » ; renderFactory les remet.
  $("pose-busy").hidden = $("pose-cut").hidden = $("pose-frozen").hidden = true;
  const { mods, asms } = fillPoseSteps();
  if (renderFrozen()) return;
  if (!mods.length && !asms.length) {
    $("pose-head").innerHTML = `<p class="muted">${t("m.pose.none")}</p>`;
    $("pose-frame").hidden = true;
    $("pose-legend").innerHTML = $("pose-details").innerHTML = $("pose-links").innerHTML = "";
    // S37 : la liste des modules du plan précédent (l'exemple de la visite…) ne doit pas rester affichée.
    $("pose-mods").innerHTML = $("pose-more-usine").innerHTML = $("pose-bar").innerHTML = "";
    return;
  }
  if (!poseStep) return;
  $("pose-mods").innerHTML = "";
  $("pose-more-usine").innerHTML = "";
  input("pose-tier3").checked = settings.tier3Only;
  input("pose-nogate").checked = !!settings.usine.noGate;
  renderPriority();
  // Priorités et tuyaux de tier III : seulement pour les modules et l'usine (rien à départager dans un ensemble).
  const curAsm = poseStep !== USINE && asms.some((s) => s.key === poseStep);
  $("pose-priority").closest<HTMLElement>(".pose-prio")!.hidden = curAsm;
  input("pose-tier3").closest<HTMLElement>("label")!.hidden = curAsm;
  $("pose-more").hidden = curAsm;
  if (poseStep === USINE) return renderFactory();
  showFocus(null);
  if (curAsm) {
    const a = assemblyOf(poseStep);
    $("pose-frame").hidden = !a;
    if (a) return renderAssembly(poseStep, a);
    $("pose-head").innerHTML = `<p class="muted">${t("m.pose.noAsm")}</p>`;
    $("pose-links").innerHTML = $("pose-legend").innerHTML = $("pose-details").innerHTML = $("pose-bar").innerHTML = "";
    return;
  }
  const base = moduleOf(poseStep);
  $("pose-frame").hidden = !base;
  if (!base) {
    $("pose-head").innerHTML = `<p class="muted">${t("m.pose.noStep")}</p>`;
    $("pose-links").innerHTML = "";
    return;
  }
  // Double rangée : le collecteur central peut sortir par un passage entre deux machines (au choix).
  const vias = base.template === "double rangée" && base.folds === 1 ? passagesOf(poseStep, base) : [];
  const chosen = vias.find((o) => viaKey(o) === poseVia.get(poseStep!));
  const m = chosen?.plan ?? base;
  const survey = surveyState(m.machine, REPO_PORTS, currentPorts().local);
  const info = renderModuleInfo(m, anyName, survey, plotOf(player));
  const surveyText = t(survey === "depot" ? "m.pose.survey.depot" : survey === "local" ? "m.pose.survey.local" : "m.pose.survey.none");
  const inFactory = fullFactory()?.plan?.boxes.find((b) => b.key === poseStep);
  const factoryLine = inFactory?.mod
    ? t("m.pose.inFactory.html", { turn: turnText(inFactory.rot) ? t("m.pose.inFactory.turn", { turn: turnText(inFactory.rot) }) : "", w: String(inFactory.w), h: String(inFactory.h), btn: `<button type="button" class="link" data-focus="${esc(poseStep)}">${t("m.pose.seeInFactory")}</button>` })
    : `<button type="button" class="link" data-focus="${esc(poseStep)}">${t("m.pose.seeFactory")}</button> <span class="muted">${t("m.pose.recalc", { bg: fullFactory()?.plan ? "" : t("m.pose.bg") })}</span>`;
  poseSchem = { name: anyName(m.machine), conv: () => layoutFromModule(m, sandboxCatalog()) };
  $("pose-links").innerHTML = `<p class="pose-actions">${schemButtons()} · <button type="button" class="link" data-flow="${esc(poseStep)}">${t("m.pose.toFlow")}</button> · <button type="button" class="link" data-edit="${esc(m.machine)}">${esc(anyName(m.machine))}${colon()}${surveyText} ${icon("edit")}</button></p><p class="pose-actions">${factoryLine}</p>${renderStepLinks(viewCtx(), poseStep)}`;
  $("pose-bar").innerHTML = `<div class="u-bar">${linksButton(settings.usine.links)}<span class="hint">${t(settings.usine.links ? "m.pose.links.on" : "m.pose.links.off")}</span></div>`;
  $("pose-head").innerHTML = info.head + stepSettingLine(poseStep) + renderPassagePick(base, vias, chosen ? viaKey(chosen) : "", anyName, advisedPassages(poseStep));
  $("pose-legend").innerHTML = info.legend;
  $("pose-details").innerHTML = info.details;
  showPoseSvg(renderModuleSvg(m, anyName), `${signature}|${poseStep}|${settings.tier3Only}|${settings.posePriority.join(",")}`);
  setFrameClasses($("pose-frame"), { "u-links": settings.usine.links });
}

// ---------------------------------------------------------------- ensembles modulaires (S14)

/** Plan de pose d'un ensemble modulaire : ferme d'arbres (portées) ou moteurs diesel (contact). */
type Assembly =
  | { kind: "ferme"; farm: FarmSet; pipes: ReturnType<typeof farmPipes>; water: string; loadMFps: number; perHarvester: number; width: number; height: number; label: string }
  | { kind: "moteur"; diesel: DieselPlan; config: DieselConfig | null; todo: string[]; width: number; height: number; label: string };
/** Poteau choisi pour une ferme (par étape) ; portées affichées. */
const asmPole = new Map<string, string>();
let asmRanges = false;
const asmCache = new Map<string, Assembly | null>();
// R15 : un ensemble dont on sait dessiner l'intérieur n'est plus « une place seulement réservée ».
setDrawnInside((k) => !!assemblyOf(k));

function assemblyOf(key: string): Assembly | null {
  const st = plan?.steps.find((s) => s.key === key);
  const kind = st ? assemblyKind(st) : null;
  if (!st || !kind) return null;
  const k = `${signature}|${currentPorts().sig}|${key}|${asmPole.get(key) ?? ""}`;
  if (asmCache.has(k)) return asmCache.get(k)!;
  if (asmCache.size > 40) asmCache.clear();
  const r = data.recipes.get(st.recipeId);
  let a: Assembly | null = null;
  if (kind === "ferme" && r?.farm?.geometry) {
    const farm = designFarm(r.farm.geometry, st.machines, st.energyAvg ?? 0, asmPole.get(key));
    const total = farm.trees.reduce((x, y) => x + y, 0);
    const water = r.farm.waterItem;
    const pipes = farmPipes(farm, CATALOG, (st.ratePerMachine * st.machines) / 60, (st.inputs.find((i) => i.item === water)?.perMin ?? 0) / 60, settings.tier3Only);
    a = { kind, farm, pipes, water, loadMFps: st.energyAvg ?? 0, perHarvester: r.farm.geometry.perHarvester, width: farm.width, height: farm.height, label: farm.farms > 1 ? t("m.asm.farms", { n: String(farm.farms), t: String(total) }) : t("m.asm.farm", { t: String(total) }) };
  } else if (kind === "moteur" && r?.parts) {
    const config = dieselConfigs(REPO_MODULAR, dieselReadings).find((c) => c.id === r.id) ?? null;
    // Moteur à 32 cylindres : nombres de blocs à relever (MOD-14), posés au minimum du wiki.
    const todo = r.verify.some((v) => v.field === "parts" && v.reason === "manquant") ? ["diesel-engine-air-input", "diesel-engine-exhaust", "diesel-engine-fuel-input", "diesel-engine-generator"] : [];
    const size = (id: string) => {
      const sz = data.machines.get(id)?.size;
      return sz ? { w: sz.w, h: sz.l } : { w: 2, h: 2 };
    };
    const diesel = designDiesel(r.parts, st.machines, size, currentPorts().machines, todo);
    a = { kind, diesel, config, todo, width: diesel.width, height: diesel.height, label: t("m.asm.engine", { n: String(st.machines), cyl: config ? t("m.asm.cyl", { n: String(config.cylinders) }) : "" }) };
  }
  asmCache.set(k, a);
  return a;
}

/** Texte et dessin d'un ensemble (plan de pose ou panneau de l'usine). */
function assemblyView(key: string, a: Assembly, rot = 0): { title: string; head: string; legend: string; details: string; svg: { svg: string; width: number; height: number }; bar: string } {
  const price = (id: string) => data.machines.get(id)?.cost ?? null;
  if (a.kind === "ferme") {
    const info = renderFarmInfo(a.farm, { name: anyName, price, loadMFps: a.loadMFps, capacity: a.farm.capacity || null, perHarvester: a.perHarvester, pipes: a.pipes });
    return {
      title: a.label,
      ...info,
      svg: renderFarmSvg(turnFarm(a.farm, rot), anyName),
      bar: `<div class="u-bar">${rangesButton(asmRanges)}<span class="hint">${t(asmRanges ? "m.asm.ranges.on" : "m.asm.ranges.off")}</span></div>`,
    };
  }
  const c = a.config;
  const info = renderDieselInfo(a.diesel, {
    name: anyName,
    price,
    label: c?.label ?? t("m.asm.recorded"),
    airFuel: c?.airFuel ?? 0,
    throttle: c?.throttle ?? 0,
    throttleAssumed: c?.throttleAssumed ?? false,
    powerMFps: c?.powerMFps ?? 0,
    fuelLps: c?.fuelLps ?? 0,
    fuel: c?.fuel ?? "refined-diesel",
    todo: a.todo,
    reading: !!c?.reading,
  });
  return { title: a.label, ...info, svg: renderDieselSvg(a.diesel, anyName), bar: `<div class="u-bar"><span class="hint">${t("m.asm.dsl.hint")}</span></div>` };
}

/** Plan de pose d'un ensemble modulaire dans l'onglet Plans de pose. */
function renderAssembly(key: string, a: Assembly): void {
  const v = assemblyView(key, a);
  $("pose-links").innerHTML = `<p class="pose-actions"><button type="button" class="link" data-flow="${esc(key)}">${t("m.pose.toFlow")}</button> · <button type="button" class="link" data-focus="${esc(key)}">${t("m.asm.seeInFactory")}</button></p>${renderStepLinks(viewCtx(), key)}`;
  $("pose-bar").innerHTML = v.bar;
  $("pose-head").innerHTML = v.head;
  $("pose-legend").innerHTML = v.legend;
  $("pose-details").innerHTML = v.details;
  showPoseSvg(v.svg, `${signature}|${key}|${asmPole.get(key) ?? ""}`, true);
  setFrameClasses($("pose-frame"), { "u-ranges": asmRanges && a.kind === "ferme" });
}

/** Réglage à faire sur chaque machine d'une étape (S10), pour le plan de pose et le panneau d'un module. */
function stepSettingLine(key: string): string {
  const st = plan?.steps.find((s) => s.key === key);
  const chips = st && !st.parts ? settingChips(settingLines(currentInterfaces().all, msettingsNow(), st.machine, st.recipeId), t("m.setOnEach")) : "";
  // Valeurs à vérifier de l'étape (S28) : ⚠ cliquables vers la correction.
  const warns = st && plan ? warnChips(viewCtx(), stepWarnings(viewCtx(), st)) : "";
  return (warns ? `<p class="pose-warn">${warns}</p>` : "") + (chips ? `<p class="pose-setting">${chips}</p>` : "");
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
  return `${signature}|${settings.tier3Only}|${JSON.stringify(gateAllowed())}|${settings.posePriority.join(",")}|${currentPorts().sig}|${plot ? `${plot.w}x${plot.h}` : ""}|${JSON.stringify(evacNow())}|${v.full ? "full" : v.glue ? "glue" : "mod"}`;
}
/** Bords choisis pour les produits à évacuer de ce plan (S27). */
const evacNow = () => settings.evacSides[planKey(settings.goal, settings.item) ?? ""] ?? {};

/** Le calcul pour les réglages en cours, et celui de l'usine recalculée (passages conseillés, version d'un module). */
const currentFactory = () => factories.get(factoryKey()) ?? null;
const fullFactory = () => factories.get(factoryKey({ ...settings.usine, full: true })) ?? null;

/** Tier du tuyau d'une liaison entre modules, d'après son débit. */
const tierOf = (item: string, perMin: number) => pipeFor(CATALOG, data.items.get(item)?.isFluid ? "fluide" : "objet", perMin / 60, settings.tier3Only)?.tier ?? null;

/** Lance le calcul de toute l'usine dans un Web Worker (annule celui en cours, garde ceux qui sont finis). */
/** S42 : temps visé pour l'usine entière ; `complete` le lève (bouton « Continuer le calcul »). */
const FACTORY_BUDGET_MS = 20_000;

function startFactory(complete = false): void {
  for (const [k, other] of factories)
    if (other.job || other.key.split("|").slice(0, -1).join("|") !== factoryKey().split("|").slice(0, -1).join("|")) {
      other.job?.cancel();
      factories.delete(k);
    }
  const key = factoryKey();
  const input = factoryInputNow(complete);
  const was = factories.get(key);
  const st: FactoryState = { key, plan: null, ms: 0, job: null, done: 0, label: t("m.f.lookup"), error: null, cancelled: false, flows: null };
  if (complete && was?.plan) st.prev = was;
  factories.set(key, st);
  const showing = () => factories.get(factoryKey()) === st && !$("rpanel-pose").hidden && poseStep === USINE;
  const refresh = () => {
    if (showing() || (!$("rpanel-pose").hidden && poseStep !== USINE)) renderPose();
  };
  // S27 bis : un calcul déjà fait pour ces réglages (même code, mêmes données) est repris tel quel ;
  // sinon il tourne dans le Web Worker et son résultat est gardé pour la prochaine fois.
  void loadFactory(key).then((hit) => {
    if (factories.get(key) !== st || st.cancelled) return;
    if (hit && !(complete && hit.plan.cut)) {
      [st.plan, st.ms, st.cached] = [hit.plan, hit.ms, true];
      return refresh();
    }
    st.label = t("m.f.start");
    st.since = Date.now();
    st.job = runFactory(input, {
      progress: (done, label) => {
        [st.done, st.label] = [done, label];
        if (showing()) updateFactoryProgress();
      },
      done: (fp, ms) => {
        [st.plan, st.ms, st.job] = [fp, ms, null];
        void saveFactory(key, fp, ms);
        refresh();
      },
      error: (message) => {
        [st.error, st.job] = [message, null];
        if (showing()) renderPose();
      },
    });
  });
}

/** Entrée du calcul de l'usine pour le plan et les réglages en cours. */
function factoryInputNow(complete = false): FactoryInput {
  const pts = currentPorts();
  const v = settings.usine;
  // Sans parcelle renseignée, le placement n'a pas de limite (seulement la place la plus petite).
  const plot = plotOf(player) ?? { w: 100_000, h: 100_000 };
  return factoryInput(
    plan!,
    {
      name: anyName,
      isFluid: (id) => !!data.items.get(id)?.isFluid,
      machine: (id) => data.machines.get(id) ?? null,
      ports: pts.machines,
      // Ensembles modulaires (S14) : leur place réservée a la taille de leur plan de pose.
      reserve: (key) => {
        const a = assemblyOf(key);
        if (!a) return null;
        const base = { w: a.width, h: a.height, label: a.label };
        if (a.kind !== "ferme") return base;
        const item = plan!.steps.find((s) => s.key === key)!.item;
        const ends: AsmEnd[] = [];
        if (a.farm.exit) ends.push({ item, role: "sortie", x: a.farm.exit.x, y: a.farm.exit.y, dir: "E" });
        if (a.farm.entry) ends.push({ item: a.water, role: "entrée", x: a.farm.entry.x, y: a.farm.entry.y, dir: "W" });
        return { ...base, ends, pipes: a.pipes.count, pipesCost: a.pipes.cost };
      },
      sb: sandboxCatalog(),
      outOrder,
      gate: gateAllowed(),
    },
    CATALOG,
    plot,
    { priority: settings.posePriority, tier3Only: settings.tier3Only },
    { ...(v.full ? { full: true } : { glue: v.glue }), evacSides: evacNow(), ...(complete ? {} : { budgetMs: FACTORY_BUDGET_MS }) },
  );
}

function updateFactoryProgress(): void {
  const el = document.getElementById("usine-progress");
  const st = currentFactory();
  if (!el || !st) return;
  el.querySelector<HTMLElement>(".bar i")!.style.width = `${Math.round(st.done * 100)}%`;
  el.querySelector(".pct")!.textContent = fmtPct(String(Math.round(st.done * 100)));
  el.querySelector(".lbl")!.textContent = txt(st.label);
  el.querySelector(".since")!.textContent = sinceText(st);
}

/** Temps écoulé depuis le début du calcul (S33), « depuis 1 min 12 s ». */
function sinceText(st: FactoryState): string {
  if (!st.since) return "";
  const s = Math.max(0, Math.round((Date.now() - st.since) / 1000));
  return t("m.f.since", { d: s >= 60 ? t("m.f.minsec", { m: Math.floor(s / 60), s: s % 60 }) : t("m.f.sec", { s }) });
}
// Le temps écoulé avance même quand le calcul n'envoie pas d'avancement.
setInterval(() => {
  if (currentFactory()?.job) updateFactoryProgress();
}, 1000);

/** S33 : pendant (ou après l'arrêt d') un calcul « recalculé pour l'usine entière », proposer le module par module. */
const byModuleTip = () => (settings.usine.full ? `<div class="long-tip">${icon("clock")} ${t("m.f.tip")} <button type="button" class="small" data-usine="bymodule">${t("m.f.byModule")}</button></div>` : "");

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
  const fp = currentFactory()?.plan;
  poseSchem = fp ? { name: t("m.schem.factory"), conv: () => layoutFromFactory(fp, sandboxCatalog(), CATALOG, (id) => !!data.items.get(id)?.isFluid, settings.tier3Only) } : null;
  $("pose-links").innerHTML = currentFactory()?.plan ? `<p class="pose-actions">${schemButtons()}</p>` : "";
  $("pose-bar").innerHTML = renderFactoryBar(settings.usine);
  $("pose-more-usine").innerHTML = renderFactoryMore(settings.usine);
  const panel = $("rpanel-pose");
  if (!st.plan) {
    // Pendant le calcul, l'usine précédente reste affichée, estompée : la page ne bouge pas (S25, F10).
    const keep = !$("pose-frame").hidden && !!$("pose-canvas").querySelector("svg.usine");
    panel.classList.toggle("computing", keep);
    if (!keep) {
      $("pose-mods").innerHTML = "";
      $("pose-frame").hidden = true;
      showFocus(null);
      $("pose-legend").innerHTML = $("pose-details").innerHTML = "";
    }
    const pct = Math.round(st.done * 100);
    // S33 : le temps écoulé hors de la zone annoncée (il change chaque seconde), « Arrêter » bien visible.
    const progress = `<div class="progress" id="usine-progress"><span class="lbl" role="status" aria-live="polite">${esc(txt(st.label))}</span><span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="pct">${fmtPct(String(pct))}</span><span class="since hint">${esc(sinceText(st))}</span><button type="button" class="btn-stop" data-usine="cancel">${withIcons(t("m.f.cancel"))}</button></div>${byModuleTip()}`;
    // Toujours dans la boîte posée sur le plan (#pose-busy) : depuis S66, #pose-head est dans une fenêtre repliée
    // du volet droit, la barre y devenait invisible (régression). Test : usine-progress.test.ts.
    const busy = $("pose-busy");
    busy.innerHTML = st.error
      ? `<p class="warn-text" role="alert">${esc(t("m.f.failed", { err: st.error }))}</p><p><button type="button" data-usine="run">${t("m.f.rerun")}</button></p>`
      : st.cancelled
        ? `<p class="muted" role="status">${t("m.f.cancelled")}</p><p><button type="button" data-usine="run">${t("m.f.rerun")}</button></p>${byModuleTip()}`
        : `${keep ? "" : `<p class="mod-sum">${t("m.f.computing.html", { long: settings.usine.full ? t("m.f.long") : "" })}</p>`}${progress}`;
    busy.hidden = false;
    if (!keep) {
      $("pose-frame").hidden = false;
      $("pose-canvas").innerHTML = "";
    }
    $("pose-cut").hidden = $("cat-cut").hidden = true;
    $("pose-head").innerHTML = "";
    return;
  }
  $("pose-busy").hidden = true;
  $("pose-busy").innerHTML = "";
  // S42 : plan abrégé, « Continuer le calcul » sur le plan lui-même (pas seulement dans le volet replié).
  const cut = $("pose-cut");
  cut.hidden = $("cat-cut").hidden = !st.plan.cut;
  // Le même bouton dans « Ce plan » (volet droit), avec la durée déjà passée.
  $("cat-cut-n").textContent = st.plan.cut ? t("m.f.sec", { s: fmt(st.ms / 1000, 0) }) : "";
  cut.innerHTML = st.plan.cut ? `<span class="u-cut-t"><b>${t("uf.cut.title")}</b> <span>${t("uf.cut", { s: fmt(st.ms / 1000, 0) })}</span></span> <button type="button" class="primary" data-usine="complete">${icon("rotate")} ${t("uf.cut.more")}</button>` : "";
  const plot = plotOf(player);
  const info = renderFactoryInfo(st.plan, anyName, plot, tierOf, st.ms, !settings.usine.full && settings.usine.glue, st.cached);
  $("pose-head").innerHTML = info.head;
  $("pose-legend").innerHTML = info.legend;
  $("pose-details").innerHTML = info.details;
  // Le panneau d'abord : il change la largeur du cadre de l'usine.
  showFocus(poseFocus);
  showPoseSvg(renderFactorySvg(st.plan, anyName, plot, tierOf, flowsOf(st), (k, rot) => {
    const asm = assemblyOf(k);
    return asm ? assemblyView(k, asm, rot).svg : null;
  }), `${st.key}|${USINE}`, true);
  setFrameClasses($("pose-frame"), factoryFrameClasses(settings.usine, st.plan.full));
  markFocused();
  $("pose-mods").innerHTML = renderFactoryModules(st.plan, posedSet(), moduleWarn) + renderFactoryEvac(st.plan, anyName, evacNow());
  markPosed();
  panel.classList.remove("computing");
}

// ---------------------------------------------------------------- modules posés (S25)
const POSED = "posé:";
/** Modules de l'usine cochés « posé » pour ce plan (dans le même stockage que la liste à cocher). */
/** ⚠ d'un module de l'usine (S28) : les valeurs à vérifier de son étape. */
function moduleWarn(key: string): string {
  const v = viewCtx();
  const st = v.plan.steps.find((s) => s.key === key);
  return st ? warnButton(v, stepWarnings(v, st)) : "";
}

function posedSet(): Set<string> {
  return new Set([...builtFor(built, signature)].filter((k) => k.startsWith(POSED)).map((k) => k.slice(POSED.length)));
}
function setPosed(key: string, on: boolean): void {
  const keys = builtFor(built, signature);
  if (on) keys.add(POSED + key);
  else keys.delete(POSED + key);
  built = setBuilt(built, signature, keys);
  saveBuilt(built);
  const st = currentFactory();
  if (st?.plan) $("pose-mods").innerHTML = renderFactoryModules(st.plan, posedSet(), moduleWarn);
  markPosed();
  renderStepRail();
}
/** Un module posé se grise dans le dessin de l'usine. */
function markPosed(): void {
  const posed = posedSet();
  for (const g of $("pose-canvas").querySelectorAll<SVGGElement>(".u-mod")) g.classList.toggle("posed", posed.has(g.dataset.mod!));
  markIncomplete();
}
/** R28 : un module qu'on ne peut pas reproduire tel quel en jeu (bâtiment non relevé, ports supposés, prix
 *  inconnu, problème de pose) est cerclé et marqué d'un ⚠ sur l'usine, avec la raison au survol. */
function markIncomplete(): void {
  const fp = currentFactory()?.plan;
  renderWarnPane();
  if (!fp) return;
  const bad = new Map(incompleteMachines(fp).map((m) => [m.box.key, m.reasons]));
  for (const g of $("pose-canvas").querySelectorAll<SVGGElement>(".u-mod")) {
    const why = bad.get(g.dataset.mod!);
    g.classList.toggle("bad", !!why);
    g.querySelector(".u-bad")?.remove();
    if (!why) continue;
    const r = g.querySelector<SVGRectElement>(":scope > rect");
    if (!r) continue;
    const x = Number(r.getAttribute("x")), y = Number(r.getAttribute("y")), w = Number(r.getAttribute("width")), h = Number(r.getAttribute("height"));
    // Un voile jaune sur tout le module et la pastille au centre (R28 suite).
    const size = Math.max(16, Math.min(56, Math.min(w, h) / 2.6));
    const cx = x + w / 2, cy = y + h / 2;
    g.insertAdjacentHTML("beforeend", `<g class="u-bad"><title>${esc(why.join(" ; "))}</title><rect class="u-bad-film" x="${x}" y="${y}" width="${w}" height="${h}"/><circle cx="${cx}" cy="${cy}" r="${size / 2 + 4}"/>${iconAt("warn", cx - size / 2, cy - size / 2 - size * 0.04, size)}</g>`);
  }
}

/** Le module ouvert est encadré dans l'usine. */
function markFocused(): void {
  for (const g of $("pose-canvas").querySelectorAll(".u-mod")) g.classList.toggle("focus", (g as SVGGElement).dataset.mod === poseFocus);
}

// ---------------------------------------------------------------- bulle d'un module (S67, maquette volets.html)
/** Les alertes d'un module, cliquables comme dans « À régler » : ports supposés → l'éditeur de bâtiments ;
 *  valeur à vérifier → sa correction ; les autres raisons s'affichent seulement. */
function bubbleAlerts(key: string): string {
  const fp = currentFactory()?.plan;
  const m = fp ? incompleteMachines(fp).find((x) => x.box.key === key) : undefined;
  const v = viewCtx();
  const st = v.plan.steps.find((s) => s.key === key);
  const vals = st ? stepWarnings(v, st) : [];
  const ports = t("uf.why.ports");
  const row = (attr: string, text: string) =>
    attr ? `<button type="button" class="cmd-li" ${attr}>${icon("warn")}<span class="nm">${esc(text)}</span>${icon("chevR")}</button>` : `<span class="cmd-li">${icon("warn")}<span class="nm">${esc(text)}</span></span>`;
  const rows = [
    ...(m?.reasons ?? []).map((r) => row(m!.survey && r === ports ? `data-edit="${esc(m!.box.machine)}"` : "", r)),
    ...vals.map((e) => row(fixAttr(e), `${fieldWord(v, e.flag.field)} : ${t("plan.warn.check")}`)),
  ];
  return rows.length ? `<div class="cmd-alerts">${rows.join("")}</div>` : "";
}
/** À l'ordinateur, le module cliqué s'ouvre dans une bulle accrochée à lui : elle suit le plan quand on le déplace,
 *  grandit quand on zoome, et le bouton ⤢ l'agrandit pour montrer le dessin du module. */
let bubbleRaf = 0;
function followBubble(key: string): void {
  cancelAnimationFrame(bubbleRaf);
  const panel = $("pose-focus");
  let w0 = 0;
  const tick = () => {
    if (panel.hidden || !matchMedia("(min-width: 900px)").matches) return;
    if (panel.classList.contains("full")) {
      panel.style.transform = ""; // plein écran : la bulle n'est plus accrochée au module
      bubbleRaf = requestAnimationFrame(tick);
      return;
    }
    const box = $("pose-canvas").querySelector(`.u-mod[data-mod="${CSS.escape(key)}"] > rect`); // module (u-box) ou ensemble (u-farm…)
    const host = $("pose-split").getBoundingClientRect();
    if (box && host.width) {
      const r = box.getBoundingClientRect();
      w0 ||= r.width || 1;
      // Jamais sous les onglets ni sous le bandeau du graphe (son ✕ y disparaissait), ni plus haute que le plan.
      const bar = $("graph-bar");
      const top = Math.max(48, bar.hidden ? 0 : bar.getBoundingClientRect().bottom - host.top + 8);
      const room = (host.height - top - 8) / Math.max(1, panel.offsetHeight);
      const sc = Math.max(0.6, Math.min(1.6, Math.max(0.75, r.width / w0), room));
      const pw = panel.offsetWidth * sc, ph = panel.offsetHeight * sc;
      let x = r.left - host.left, y = r.bottom - host.top + 10;
      if (y + ph > host.height) y = r.top - host.top - ph - 10; // pas la place dessous : au-dessus
      x = Math.max(6, Math.min(x, host.width - pw - 6));
      y = Math.max(top, Math.min(y, host.height - ph - 6));
      panel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${sc.toFixed(3)})`;
    }
    bubbleRaf = requestAnimationFrame(tick);
  };
  tick();
}

/** Panneau du module à côté de l'usine (null : fermé), dans la version que l'usine utilise. */
function showFocus(key: string | null): void {
  const panel = $("pose-focus");
  const split = $("pose-split");
  const st = currentFactory();
  const asm = key && st?.plan && !st.plan.boxes.find((b) => b.key === key)?.mod ? assemblyOf(key) : null;
  if (asm && key) return showAssemblyFocus(key, asm);
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
  followBubble(key!);
  $("focus-bar-opts").innerHTML = `<div class="u-bar">${linksButton(settings.usine.links)}<span class="hint">${t("m.focus.hint")}</span></div>`;
  // S26 : « Module posé ✓ » dans le panneau aussi (le même réglage que la liste sous l'usine).
  const posed = posedSet().has(key!);
  $("focus-head").innerHTML = `<p class="focus-posed"><label${posed ? ' class="done"' : ""}><input type="checkbox" data-posed="${esc(key!)}"${posed ? " checked" : ""}> ${withIcons(t("m.focus.posed"))}</label></p>` + out.head + bubbleAlerts(key!) + stepSettingLine(key!) + `<p class="pose-actions"><button type="button" class="link" data-pose="${esc(key!)}">${t("m.focus.poseAlone")}</button> · <button type="button" class="link" data-flow="${esc(key!)}">${t("m.focus.toFlow")}</button></p>`;
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

/** Panneau à côté de l'usine pour un ensemble modulaire : son plan de pose (la même disposition). */
function showAssemblyFocus(key: string, a: Assembly): void {
  const v = assemblyView(key, a, currentFactory()?.plan?.boxes.find((b) => b.key === key)?.rot ?? 0);
  $("pose-focus").hidden = false;
  $("pose-split").classList.add("focus");
  document.body.classList.add("usine-wide");
  $("focus-title").textContent = v.title;
  followBubble(key);
  $("focus-bar-opts").innerHTML = v.bar;
  $("focus-head").innerHTML = v.head.replace('id="asm-pole"', 'id="asm-pole-focus"').replace('for="asm-pole"', 'for="asm-pole-focus"') + bubbleAlerts(key) + `<p class="pose-actions"><button type="button" class="link" data-pose="${esc(key)}">${t("m.focus.asmAlone")}</button> · <button type="button" class="link" data-flow="${esc(key)}">${t("m.focus.toFlow")}</button></p>`;
  $("focus-legend").innerHTML = v.legend;
  $("focus-details").innerHTML = v.details;
  const frame = $("focus-frame");
  $("focus-canvas").innerHTML = v.svg.svg;
  focusPZ ??= new PanZoom(frame, { minWidth: 80, fitOnReset: true });
  const k = `asm|${signature}|${key}|${asmPole.get(key) ?? ""}`;
  focusPZ.attach($("focus-canvas").querySelector("svg")!, v.svg.width, v.svg.height, k === focusKey);
  if (k !== focusKey) focusSel = null;
  focusKey = k;
  setFrameClasses(frame, { "u-ranges": asmRanges && a.kind === "ferme" });
  applySel(frame, focusSel, null);
}

/**
 * Sélection dans un cadre : une liaison (« n:… ») et les vecteurs de sa ressource, un câble (« c:… ») et tout ce
 * qu'il alimente, ou une ressource d'un module (« i:… ») ; le reste s'estompe.
 */
function applySel(frame: HTMLElement, sel: string | null, pickId: string | null, clicked?: string): void {
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
  } else if (kind === "b") {
    const g = frame.querySelector<SVGGElement>(`[data-sel="${CSS.escape(sel)}"]`);
    mark(`[data-sel="${CSS.escape(sel)}"], .a-rng[data-of="${CSS.escape(id)}"]`);
    for (const x of (g?.dataset.serves ?? "").split(" ").filter(Boolean)) mark(`[data-sel="b:${CSS.escape(x)}"]`);
    for (const el of frame.querySelectorAll<SVGGElement>("[data-serves]")) if (el.dataset.serves!.split(" ").includes(id)) el.classList.add("on");
    text = (g?.dataset.tip ?? "").split(" — ")[0]!;
  } else {
    mark(`.m-pipe[data-item="${CSS.escape(id)}"], .m-flow[data-item="${CSS.escape(id)}"]`);
    // L'info du tuyau cliqué (produit, collecteur, débit, tuyau), sans la ligne « Clique pour… ».
    const tipOf = clicked ?? frame.querySelector<SVGGElement>(`.m-pipe[data-item="${CSS.escape(id)}"]`)?.dataset.tip ?? "";
    text = tipOf.split("\n").filter((l) => l && !/^(Clique|Click)\b/.test(l)).join(" · ") || t("m.sel.links", { item: anyName(id) });
  }
  if (pick) pick.innerHTML = `<span>${esc(text)}</span> <button type="button" class="link small" data-unsel aria-label="${esc(t("common.close"))}" title="${esc(t("common.close"))}">${icon("close")}</button>`;
}

// ---------------------------------------------------------------- Mon usine

function renderUsine(): void {
  // S29 : deux onglets, « Ma partie » (#usine) et « Ma recherche » (#usine/recherche).
  const tab = route.usineTab ?? "partie";
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-utab]")) b.setAttribute("aria-selected", String(b.dataset.utab === tab));
  $("upanel-partie").hidden = tab !== "partie";
  $("upanel-recherche").hidden = tab !== "recherche";
  const p = toEngineProgress(prog);
  $("progress-summary").textContent = progressSummary(data, p);
  $("progress-meter").style.width = `${Math.round((unlockedCount() / Math.max(1, researchTotal())) * 100)}%`;
  $("owned").innerHTML = renderOwned(data, p, !!$("owned").querySelector<HTMLDetailsElement>("details")?.open);
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
  // S29 : le champ garde ton dernier relevé ; l'estimation de maintenant s'affiche à côté (`rp-est`).
  set("p-rp", player.rp === null ? null : Math.floor(player.rp));
  set("p-rps", player.rpPerSec);
  renderRpEstimate();
  input("p-spend").checked = player.spendRp;
  input("p-gamepass").checked = player.gamePass;
  renderGameBox();
  renderResearchBox();
}

/** À côté du relevé : quand il a été fait (temps de jeu depuis) et les RP estimés maintenant, s'ils en diffèrent. */
function renderRpEstimate(): void {
  const rp = rpNow();
  const gNow = gameNow(journal.clock, Date.now());
  const last = [...journal.events].reverse().find((e) => e.type === "releve" && e.rp !== null);
  const when = last
    ? t("m.rp.reading", { when: gNow - last.g < 30_000 ? t("m.rp.noPlaytime") : t("m.rp.ago", { t: fmtDuration((gNow - last.g) / 1000) }), date: fmtDate(last.at, { dateStyle: "short", timeStyle: "short" }) })
    : "";
  const same = rp === null || player.rp === null || Math.floor(rp) === Math.floor(player.rp);
  const est = rp === null || same ? "" : t("m.rp.now", { rp: fmtRP(Math.floor(rp)) });
  const el = $("rp-est");
  el.textContent = [when, est].filter(Boolean).join(" · ");
  el.hidden = !el.textContent;
}

/** « Ma recherche » : le formulaire (à l'ouverture et quand sa forme change) et ce qu'en tire le site. */
function renderResearchBox(): void {
  const s = player.research ?? emptySetup();
  // Panneau recopié : déplié s'il l'était, ou si c'est la seule saisie (ancien niveau « rapide »).
  const wasOpen = !!$("rs-form").querySelector<HTMLDetailsElement>("details.rs-panel-d")?.open;
  const panelOnly = !TIERS.some((k) => s.groups[k].length) && TIERS.some((k) => s.panel[k].rate !== null);
  $("rs-form").innerHTML = renderResearchForm(data, s, wasOpen || panelOnly);
  renderRpLive(true);
}

/**
 * RP estimés maintenant, seuil, vitesse réelle (rafraîchi à chaque saisie et toutes les 5 s), en
 * temps de jeu. `full` : aussi « Comment c'est calculé » et les graphiques.
 */
let rsHowKey = "";
/** Temps de jeu où le solde a franchi le seuil le plus bas (en remontant les morceaux de la courbe). */
function overSince(h: RpHistory, model: RpModel): number | null {
  const caps = model.tiers.map((t) => t.cap).filter((c) => Number.isFinite(c));
  if (!caps.length) return null;
  const cap = Math.min(...caps);
  for (let i = h.pieces.length - 1; i >= 0; i--) {
    const p = h.pieces[i]!;
    if (p.rp0 < cap) return p.tiers ? Math.min(p.to, p.from + timeToReach(p.tiers, p.rp0, cap) * 1000) : p.to; // franchi dans ce morceau, ou par un relevé juste après
  }
  return null;
}
function renderRpLive(full = false): void {
  const now = Date.now();
  const gNow = gameNow(journal.clock, now);
  refreshPlay(now);
  const h = historyTo(gNow);
  renderRpEstimate();
  const model = rpModel();
  if (!model) return;
  fillResearchCalc($("rs-form"), model);
  $("rs-control").innerHTML = renderResearchControl(model, player.rp, player.rpPerSec);
  const base = h.pieces[h.pieces.length - 1] ?? null;
  const nominal = model.source === "aucune" ? 0 : nominalRate(model.tiers);
  const linear = base && nominal > 0 ? base.rp0 + (nominal * (gNow - base.from)) / 1000 : null;
  $("rs-out").innerHTML = renderResearchOut({ model, rp0: base?.rp0 ?? null, rpAt: base?.from ?? null, rpNow: rpNow(), now: gNow, playing: journal.clock.playing, realNow: now, linearNow: linear, how: false, overSince: overSince(h, model), stepsOpen: !!$("rs-out").querySelector<HTMLDetailsElement>("details.rs-steps-d")?.open });
  const howKey = JSON.stringify([player.research, player.rpPerSec, model.source, lang()]);
  if (full || howKey !== rsHowKey) {
    rsHowKey = howKey;
    $("rs-how").innerHTML = model.source === "aucune" ? "" : `<details class="more"><summary>${t("cv.title")}</summary>${researchHow(model)}</details>`;
  }
  if (full) renderHistoryBox();
}

/** Modifie « Ma recherche » et recalcule ce qui en dépend. `form` : redessiner le formulaire (groupe ajouté, mode…). */
function updateResearch(fn: (s: ResearchSetup) => void, form = false): void {
  const s: ResearchSetup = structuredClone(player.research ?? emptySetup());
  fn(s);
  player = { ...player, research: s };
  savePlayer(player);
  setJournal(addEvent(journal, { type: "config", setup: s }, Date.now()));
  planDirty = true;
  renderHeader();
  if (form) renderResearchBox();
  else renderRpLive(true);
}

/** Liste « Production déjà en place ». */
function renderExisting(): void {
  const entries = Object.entries(settings.existing);
  $("existing-count").textContent = entries.length ? String(entries.length) : "";
  $("existing-list").innerHTML = entries
    .map(([id, v]) => {
      const name = itemName(id);
      return `<li><span class="name">${esc(name)}</span>
        <label class="sr-only" for="ex-${esc(id)}">${esc(t("m.ex.rate", { item: name }))}</label>
        <input id="ex-${esc(id)}" type="number" min="0.01" step="any" inputmode="decimal" data-existing-rate="${esc(id)}" value="${v}"> /min
        <button type="button" class="link small" data-existing-del="${esc(id)}" aria-label="${esc(t("m.ex.remove", { item: name }))}">${t("m.ex.removeBtn")}</button></li>`;
    })
    .join("");
}

// ---------------------------------------------------------------- arbre de recherche

let panzoom: PanZoom | null = null;
const layouts = new Map<string, ResearchLayout>();
let lastLayoutKey = "";

function renderTreePage(focusKey: string | null = null): void {
  const p = toEngineProgress(prog);
  $("tree-summary").textContent = t("m.tree.summary", { summary: progressSummary(data, p) });
  $("tree-view").hidden = ui.view !== "tree";
  $("list-view").hidden = ui.view !== "list";
  for (const b of document.querySelectorAll<HTMLButtonElement>(".seg [data-view]")) b.setAttribute("aria-checked", String(b.dataset.view === ui.view));
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tabs [data-cat]")) tab.setAttribute("aria-selected", String(tab.dataset.cat === treeView.category));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-unlockmode]")) b.setAttribute("aria-checked", String((b.dataset.unlockmode === "bulle") === treeBubble));
  document.querySelector<HTMLElement>(".tree-unlockmode")!.hidden = ui.view !== "tree";
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
  $("rs-canvas").innerHTML = renderResearchSvg(data, p, layout, ui.selected, rpNow(), blockedView());
  const svg = $("rs-canvas").querySelector("svg") as SVGSVGElement;
  if (treeView.filter.trim()) {
    for (const g of svg.querySelectorAll<SVGGElement>("[data-rs]")) g.classList.toggle("dim", !matchesFilter(g.dataset.rs!));
  }
  panzoom ??= new PanZoom($("rs-frame"), { onView: () => placeTreeBubble() });
  const key = treeView.category;
  const rootNode = layout.nodes.find((n) => data.nodes.get(n.id)?.isRoot);
  panzoom.attach(svg, layout.width, layout.height, key === lastLayoutKey, rootNode ? { x: rootNode.x, y: rootNode.y + RN_H / 2 } : undefined);
  lastLayoutKey = key;
  $("rs-detail").innerHTML = renderNodeDetail(data, p, ui.selected, rpNow(), rpEta, blockedView());
  renderHud();
  renderTreeBubble();
  if (focusKey) svg.querySelector<SVGGElement>(focusKey)?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- bulle de l'arbre (S29)
// Option « Débloquer : Bulle » (pas par défaut), comme « Pose : Bulle » de l'éditeur de bâtiments : un clic sur
// une recherche ouvre une bulle à côté d'elle avec ses boutons, sans aller jusqu'au panneau. Choix gardé ici.
const KEY_TREE_BUBBLE = "ind-calc:v1:arbre-bulle";
let treeBubble = (() => {
  try {
    return localStorage.getItem(KEY_TREE_BUBBLE) === "1";
  } catch {
    return false;
  }
})();
/** Recherche dont la bulle est ouverte. */
let bubbleFor: string | null = null;

function setTreeBubble(on: boolean): void {
  treeBubble = on;
  try {
    localStorage.setItem(KEY_TREE_BUBBLE, on ? "1" : "0");
  } catch {
    // choix non gardé : il vaut pour cette visite
  }
  if (!on) bubbleFor = null;
  renderTreePage();
}

function renderTreeBubble(): void {
  const box = $("rs-bubble");
  const html = treeBubble && bubbleFor && bubbleFor === ui.selected ? renderNodeBubble(data, toEngineProgress(prog), bubbleFor, rpNow(), rpEta, blockedView()) : "";
  box.innerHTML = html;
  box.hidden = !html;
  placeTreeBubble();
}

/** Clic dans le panneau d'une recherche ou dans sa bulle : aller à une autre, « L'avoir plus vite », débloquer… */
async function onResearchClick(e: Event): Promise<void> {
  const t = e.target as HTMLElement;
  const go = t.closest<HTMLElement>("[data-rs-goto]");
  if (go) return selectNode(go.dataset.rsGoto!);
  const faster = t.closest<HTMLElement>("[data-rs-faster]");
  if (faster) {
    // « L'avoir plus vite » : l'objectif recherche, réglé sur cette recherche (S22).
    settings.rpMode = "node";
    settings.rpNode = faster.dataset.rsFaster!;
    planDirty = true;
    saveSettings(settings);
    location.hash = "#rp";
    return;
  }
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
}

/** Place la bulle à côté de sa recherche, dans le cadre, et la fait suivre au glisser et au zoom. */
function placeTreeBubble(): void {
  const box = $("rs-bubble");
  if (box.hidden || !bubbleFor) return;
  const g = $("rs-canvas").querySelector<SVGGElement>(`[data-rs="${CSS.escape(bubbleFor)}"]`);
  if (!g) return;
  const r = g.getBoundingClientRect();
  const f = $("rs-frame").getBoundingClientRect();
  const bw = box.offsetWidth || 260;
  const bh = box.offsetHeight || 160;
  let left = r.right - f.left + 10;
  if (left + bw > f.width - 4) left = r.left - f.left - 10 - bw;
  left = Math.max(4, Math.min(f.width - bw - 4, left));
  const top = Math.max(4, Math.min(f.height - bh - 4, r.top - f.top + r.height / 2 - bh / 2));
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
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
  $("rs-hud-info").innerHTML = `<b>${esc(fmtRP(n.rp))}</b> <span>${esc(n.name)} · ${esc(unlocked ? t("m.hud.unlocked") : missing.length ? t("m.hud.missing", { n: String(missing.length) }) : t("m.hud.available"))}</span>`;
  // Bulle ouverte : ses boutons suffisent (pas de doublon dans le coin du cadre).
  btn.hidden = treeBubble && bubbleFor === n.id;
  btn.dataset.id = n.id;
  btn.dataset.unlocked = String(unlocked);
  btn.textContent = unlocked ? t("m.hud.remove") : missing.length ? t("m.hud.unlockN", { n: String(missing.length) }) : t("m.hud.unlock");
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
  const where = `<a href="#${GOAL_ROUTE[settings.goal]}">${esc(goalName(settings.goal).toLowerCase())}</a>`;
  $("verify-context").innerHTML = t("m.verify.context", { label: esc(planLabel(v)), where });
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
  renderFixSend();
  $("data-errors").innerHTML = dataErrors.length ? `<div class="banner bad">${t("m.dataErrors")}<ul>${dataErrors.map((e) => `<li>${txtHtml(e)}</li>`).join("")}</ul></div>` : "";
}

/** Bandeau des valeurs d'une seule recette ou machine (arrivée par un lien ⚠). */
function verifyFocusBanner(vt: NonNullable<Route["verify"]>, count: number): string {
  const r = vt.scope === "recette" ? data.recipes.get(vt.id) : undefined;
  const machine = vt.scope === "machine" ? vt.id : r?.machine;
  const name = vt.scope === "machine" ? machineN(viewCtx(), vt.id) : `${machineN(viewCtx(), r?.machine ?? "")} → ${itemN(viewCtx(), Object.keys(r?.outputs ?? {})[0] ?? "")}`;
  const back = machine ? ` · <a href="${recipeHref("machine", machine)}">${t("m.vf.machineCard")}</a>` : "";
  return `<div class="banner">${t("m.vf.banner", { name: esc(name), none: count ? "" : t("m.vf.none"), back })}</div>`;
}

// ---------------------------------------------------------------- recettes

/** Image d'un objet ou d'une machine : celle du joueur, sinon la vignette du wiki. */
function pictureOf(kind: EntryKind, id: string): Picture | null {
  const key = `${kind}|${id}`;
  const wiki = WIKI_IMAGES.get(key);
  if (myImages[key]) return { src: myImages[key]!, own: true, fallback: !!wiki };
  if (!wiki) return null;
  return { src: `/${wiki.file}`, own: false, credit: { label: t("m.rc.wikiCredit", { license: wiki.license }), url: wiki.url } };
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
    fixCount: !hasOwnFixes() ? 0 : countCorrections(corrections) + Object.keys(notes).length,
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
  const rejected = dataErrors.filter((e) => /^(added|removed)\//.test(String(e.path)));
  const banner = rejected.length ? `<div class="banner bad">${t("m.rc.rejected")}<ul>${rejected.map((e) => `<li>${txtHtml(e)}</li>`).join("")}</ul></div>` : "";
  $("rc-card").innerHTML =
    banner +
    (standalone
      ? `<article class="rc-card">${renderItemForm(standalone)}<p class="hint">${t("m.rc.itemFormHint")}</p></article>`
      : card
        ? card.kind === "objet"
          ? renderItemCard(ctx, card.id)
          : renderMachineCard(ctx, card.id)
        : `<p class="rc-hello panel">${t("m.rc.hello")}</p>`);
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
  $("rc-dir").innerHTML = icon(rcPrefs.sort.dir === "asc" ? "asc" : "desc");
  $("rc-dir").title = t(rcPrefs.sort.dir === "asc" ? "m.rc.asc" : "m.rc.desc");
  $("rc-dir").setAttribute("aria-label", $("rc-dir").title);
  const n = Object.keys(myImages).length;
  $("rc-imgs").innerHTML = t("m.rc.imgs.html", {
    n: String(n),
    export: `<button type="button" class="link" id="rc-img-export"${n ? "" : " disabled"}>${t("m.rc.export")}</button>`,
    import: `<button type="button" class="link" id="rc-img-import-btn">${t("m.rc.import")}</button>`,
    clear: n ? ` · <button type="button" class="link" id="rc-img-clear">${t("m.rc.clear")}</button>` : "",
  });
  renderRcList(ctx);
}

function renderRcList(ctx: RecipesCtx = recipesCtx()): void {
  rcEntries ??= recipeEntries(data);
  const found = searchEntries(rcEntries, rcQuery, rcPrefs.filter);
  // Avec une recherche et le tri par nom, les noms qui commencent par la saisie restent devant.
  const list = rcQuery.trim() && rcPrefs.sort.key === "nom" && rcPrefs.sort.dir === "asc" ? found : sortEntries(data, found, rcPrefs.sort);
  const card = route.page === "recettes" && route.card ? `${route.card.kind}/${route.card.id}` : null;
  $("rc-count").textContent = t("m.rc.count", { n: list.length });
  const key = `${rcQuery}|${rcPrefs.filter}|${rcPrefs.view}|${rcPrefs.sort.key}|${rcPrefs.sort.dir}`;
  if (rcShown.key !== key) rcShown = { key, n: RC_STEP };
  let shown = list;
  if (matchMedia("(max-width: 899px)").matches && list.length > rcShown.n) {
    shown = list.slice(0, rcShown.n);
    // L'objet ouvert reste dans la liste (décision S5).
    const open = card ? list.find((e) => `${e.kind}/${e.id}` === card) : undefined;
    if (open && !shown.includes(open)) shown.push(open);
  }
  const rest = list.length - shown.length;
  $("rc-list").innerHTML =
    (rcPrefs.view === "lignes" ? renderEntryRows(ctx, shown, card, rcPrefs.sort) : renderEntryList(ctx, shown, card)) +
    (rest > 0 ? `<button type="button" class="rc-more" data-rc-more>${t("m.rc.more", { n: Math.min(RC_STEP, rest), rest })}</button>` : "");
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
  $("rc-list").addEventListener("click", (e) => {
    if (!(e.target as Element).closest("[data-rc-more]")) return;
    const before = $("rc-list").querySelectorAll("li, tbody tr").length;
    rcShown = { ...rcShown, n: rcShown.n + RC_STEP };
    renderRcList();
    // Le focus passe à la première tuile ajoutée.
    $("rc-list").querySelectorAll<HTMLElement>("li, tbody tr")[before]?.querySelector<HTMLElement>("a, button")?.focus();
  });
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
      if (!saveImages(next)) throw new Error(t("m.img.full"));
      myImages = next;
      renderRecettes();
    } catch (err) {
      await ask(t("m.img.notSaved"), `<p>${esc((err as Error).message)}.</p>`, [{ value: "", label: t("m.close"), primary: true }]);
    }
  });
  $("rc-imgs").addEventListener("click", async (e) => {
    const id = (e.target as Element).closest<HTMLElement>("button")?.id;
    if (id === "rc-img-export") downloadJson(exportImages(myImages), "mes-images.json");
    else if (id === "rc-img-import-btn") $("rc-img-import").click();
    else if (id === "rc-img-clear") {
      const choice = await ask(t("m.img.clear.title"), t("m.img.clear.html"), [
        { value: "yes", label: t("m.clearAll"), primary: true },
        { value: "", label: t("m.cancel") },
      ]);
      if (choice !== "yes") return;
      myImages = {};
      saveImages(myImages);
      renderRecettes();
    }
  });
  $("pw-import").addEventListener("change", async () => {
    const box = input("pw-import");
    const file = box.files?.[0];
    box.value = "";
    if (file) await importPollywrath(file);
  });
  $("rc-img-import").addEventListener("change", async () => {
    const box = input("rc-img-import");
    const file = box.files?.[0];
    box.value = "";
    if (!file) return;
    try {
      const next = { ...myImages, ...parseImagesExport(JSON.parse(await file.text())) };
      if (!saveImages(next)) throw new Error(t("m.img.fullShort"));
      myImages = next;
      renderRecettes();
    } catch (err) {
      await ask(t("m.importFailed"), `<p>${esc((err as Error).message)}.</p>`, [{ value: "", label: t("m.close"), primary: true }]);
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
    if (raw.trim() && (n === null || n < 0)) return void (input.setCustomValidity(t("m.num.geq0")), input.reportValidity());
    const { source: _, ...rest } = added;
    return commitCorrections(setAddedItem(corrections, id, { ...rest, [field]: raw.trim() ? n : null }));
  }
  const entity = scope === "items" ? data.items.get(id) : data.machines.get(id);
  const current = (entity as Record<string, unknown> | undefined)?.[field];
  if (!raw.trim() || n === null || n < 0) {
    input.value = typeof current === "number" ? String(current) : "";
    if (raw.trim()) {
      input.setCustomValidity(t("m.num.geq0Expected"));
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
    const n = field === "energyMFps" ? parseEnergy(el.value) : readNum(el.value);
    const m = /^(inputs|outputs)\.(.+)$/.exec(field);
    const current = m ? r[m[1] as "inputs" | "outputs"][m[2]!] : r[field as "durationS" | "energyMFps"];
    if (n === null && !el.value.trim() && current === null) continue;
    const bad = n === null ? t("m.bad.number") : field === "durationS" && n <= 0 ? t("m.bad.duration") : m && n < 0 ? t("m.bad.qty") : null;
    if (bad) {
      err.textContent = t("m.bad", { what: bad, field: el.getAttribute("aria-label") ?? field });
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
    const tg = e.target as Element;
    const on = (attr: string) => tg.closest<HTMLElement>(`[${attr}]`);
    let el: HTMLElement | null;
    if (on("data-rc-edit-on")) return setEdit({ ...EDIT_ON });
    if (on("data-rc-edit-off")) return setEdit(null);
    if (on("data-rc-send")) return remarks.open({ piece: correctionsPiece(), kind: "fix" });
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
      const more = alsoRemoved.length ? t("m.delItem.more", { n: alsoRemoved.length }) : "";
      const choice = await ask(t("m.delItem.title"), t("m.delItem.html", { name: esc(name), more: esc(more) }), [
        { value: "yes", label: t("m.delete"), primary: true },
        { value: "", label: t("m.cancel") },
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
  if (simulated) {
    // Progression simulée pendant le tutoriel : rien n'est enregistré ni dépensé.
    prog = next;
    planDirty = true;
    return render();
  }
  const delta = rpDelta(data, prog.unlocked, next.unlocked);
  const now = rpNow();
  if (opts.spend !== false && player.spendRp && now !== null && delta.spent !== 0) {
    let available = now;
    while (delta.spent > available + 1e-9) {
      const choice = await ask(
        t("m.rp.short.title"),
        `${t("m.rp.short.html", { cost: esc(fmtRP(delta.spent)), n: String(delta.added.length), have: esc(fmtRP(available)) })}
         <label class="ask-field">${t("m.rp.current")} <input id="ask-rp" inputmode="decimal" autocomplete="off" value="${Math.floor(available)}"></label>`,
        [
          { value: "set", label: t("m.rp.setAmount"), primary: true },
          { value: "free", label: t("m.rp.free") },
          { value: "", label: t("m.cancel") },
        ],
      );
      if (!choice) return render();
      if (choice === "free") return commitProgress(next);
      const v = parseOptional((document.getElementById("ask-rp") as HTMLInputElement | null)?.value ?? "");
      if (typeof v === "number" && v >= 0) available = v;
    }
    const at = Date.now();
    if (Math.abs(available - now) > 0.5) setJournal(addEvent(journal, { type: "releve", rp: available, rps: null }, at));
    setJournal(addEvent(journal, { type: "depense", spent: delta.spent, added: delta.added, removed: delta.removed }, at));
    player = { ...player, rp: available - delta.spent, rpAt: at };
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
        t("m.prereq.title"),
        `${t("m.prereq.html", { name: esc(nodeName(id)), n: String(missing.length), rp: esc(fmtRP(rpCost(data, missing))) })}<ul>${missing.map((x) => `<li>${esc(nodeName(x))}</li>`).join("")}</ul>`,
        [
          { value: "all", label: t("m.prereq.all"), primary: true },
          { value: "one", label: t("m.only") },
          { value: "", label: t("m.cancel") },
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
        t("m.deps.title"),
        `${t("m.deps.html", { n: String(deps.length), name: esc(nodeName(id)) })}<ul>${deps.map((x) => `<li>${esc(nodeName(x))}</li>`).join("")}</ul>`,
        [
          { value: "all", label: t("m.deps.all"), primary: true },
          { value: "one", label: t("m.only") },
          { value: "", label: t("m.cancel") },
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
    t("m.existing.title"),
    `${t("m.existing.html", { item: esc(itemName(id)) })}
     <label class="ask-field">${t("m.existing.rate")} <input id="ask-rate" inputmode="decimal" autocomplete="off" value="${esc(lang() === "fr" ? String(Math.round(perMin * 100) / 100).replace(".", ",") : String(Math.round(perMin * 100) / 100))}"></label>
     <p class="hint">${t("m.existing.where")}</p>`,
    [
      { value: "ok", label: t("m.add"), primary: true },
      { value: "", label: t("m.cancel") },
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
  $("item-pick").addEventListener("click", () => itemPal.open());
  $("mf-pick-btn").addEventListener("click", () => machinePal.open());
  $("rp-node-pick").addEventListener("click", () => nodePal.open());
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K") && !$("page-plan").hidden && settings.goal === "objet") {
      e.preventDefault();
      itemPal.open();
    }
  });
  const onItem = () => {
    const id = resolveItem(itemInput.value);
    $("item-hint").textContent = id ? "" : itemInput.value.trim() ? t("form.item.notFound") : "";
    if (!id) return;
    const changed = enter("objet") || id !== settings.item;
    settings.item = id;
    if (changed) update();
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
    if (settings.mode === "rate") settings.rate = storedRate(v!, settings.rateUnit);
    else settings.machines = v!;
    enter("objet");
    return true;
  });
  // Changer d'unité garde la même production : le nombre affiché est converti.
  $("qty-unit").addEventListener("change", (e) => {
    const choice = (e.target as HTMLSelectElement).value;
    const mode: Settings["mode"] = choice === "machines" ? "machines" : "rate";
    if (mode === "rate") {
      const unit = choice === "rate-s" ? "s" : "min";
      if (settings.mode === "rate") {
        // Même débit stocké (par minute) : seul l'affichage change.
        settings.rateUnit = unit;
        return update();
      }
      settings.rateUnit = unit;
    }
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
  num("money", (v) => (v! > 0 ? ((settings.money = v!), enter("argent"), true) : false));
  num("energy", (v) => (v! > 0 ? ((settings.energyMFps = v! * (settings.energyUnit === "M" ? 1e6 : 1e3)), enter("énergie"), true) : false));
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
  num("rp-rate", (v) => (v === null ? ((settings.rpRate = null), true) : v > 0 ? ((settings.rpRate = v), true) : false), true);
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
  bindPrioChips($("criteria-chips"), () => settings.criteria[settings.goal], setCriteria);
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
    inp.setCustomValidity(id || !inp.value.trim() ? "" : t("mf.unknown"));
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
    built = setBuilt(built, signature, [...builtFor(built, signature)].filter((k) => k.startsWith(POSED))); // les modules posés restent
    saveBuilt(built);
    renderBuild();
  });
  // Choix d'une recette à la main (onglet Détails).
  $("details").addEventListener("change", (e) => {
    const sel = e.target as HTMLSelectElement;
    const item = sel.dataset.force;
    if (!item) return;
    setForced(item, sel.value);
    $("details").querySelector<HTMLSelectElement>(`select[data-force="${CSS.escape(item)}"]`)?.focus();
  });
  // « Le mettre en premier » (sous le résumé du plan).
  // Toute l'usine : arrêter ou relancer le calcul, passer au module par module (S33) ; l'ouvrir (depuis le choix d'un
  // passage). Les mêmes boutons sont dans la boîte posée sur l'ancienne usine pendant un recalcul (#pose-busy).
  const onUsine = (u: HTMLElement) => {
    const st = currentFactory();
    if (u.dataset.usine === "cancel" && st) {
      st.job?.cancel();
      if (st.prev) {
        // Recherche d'un meilleur plan arrêtée : le plan d'avant revient tel quel.
        st.cancelled = true;
        factories.set(st.key, st.prev);
        renderPose();
        $("pose-cut").querySelector<HTMLElement>("[data-usine]")?.focus();
        return true;
      }
      Object.assign(st, { job: null, cancelled: true });
      renderPose();
      $("pose-busy").querySelector<HTMLElement>("[data-usine]")?.focus();
    } else if (u.dataset.usine === "bymodule") {
      settings.usine = { ...settings.usine, full: false };
      saveSettings(settings);
      renderPose();
    } else if (u.dataset.usine === "run" || u.dataset.usine === "complete") {
      startFactory(u.dataset.usine === "complete");
      renderPose();
      $("pose-busy").querySelector<HTMLElement>("[data-usine]")?.focus();
    } else return false;
    return true;
  };
  $("no-plan").addEventListener("click", (e) => {
    if ((e.target as Element).closest("[data-no-plan-pick]")) itemPal.open();
  });
  $("cat-cut").addEventListener("click", () => {
    startFactory(true);
    poseStep = USINE;
    refine({ page: "plan", goal: settings.goal, tab: "pose", step: USINE });
    renderPose();
  });
  for (const id of ["pose-busy", "pose-cut"])
    $(id).addEventListener("click", (e) => {
      const u = (e.target as Element).closest<HTMLElement>("[data-usine]");
      if (u) onUsine(u);
    });
  $("pose-head").addEventListener("click", (e) => {
    const u = (e.target as Element).closest<HTMLElement>("[data-usine]");
    if (u) {
      if (onUsine(u)) return;
      if (u.dataset.usine === "run") {
        startFactory();
        renderPose();
      } else if (u.dataset.usine === "complete") {
        startFactory(true);
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
  $("pose-nogate").addEventListener("change", (e) => {
    const { noGate: _, ...usine } = settings.usine;
    settings.usine = (e.target as HTMLInputElement).checked ? { ...usine, noGate: true } : usine;
    update(); // le plan peut avoir une machine de plus ou de moins
  });
  // Tiroir des réglages (S60, maquette S58) : tout à plat ; R l'ouvre, Échap le ferme. Un lien qui ouvre une
  // rubrique (barre « Ton plan », visite…) ouvre le tiroir avec elle.
  const drawer = $("plan-drawer");
  const setDrawer = (on: boolean) => {
    if (drawer.hidden === !on) return;
    drawer.hidden = !on;
    $("plan-set-open").setAttribute("aria-expanded", String(on));
    if (on) for (const d of drawer.querySelectorAll<HTMLDetailsElement>(":scope > details")) d.open = true;
    // R28 : pas de phrase sous chaque option ; l'explication passe au survol de l'option.
    if (on) for (const h of drawer.querySelectorAll<HTMLElement>("label > .hint[data-i18n]")) h.parentElement!.title = h.textContent!.replace(/^(|)$/g, "");
    (on ? drawer.querySelector<HTMLElement>("summary") : $("plan-set-open"))?.focus();
  };
  $("plan-set-open").addEventListener("click", () => setDrawer(drawer.hidden !== false));
  $("plan-set-close").addEventListener("click", () => setDrawer(false));
  for (const d of drawer.querySelectorAll<HTMLDetailsElement>(":scope > details"))
    d.addEventListener("toggle", () => {
      if (d.open && drawer.hidden) setDrawer(true);
    });
  document.addEventListener("keydown", (e) => {
    if ($("page-plan").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]");
    if (e.key === "Escape" && !drawer.hidden) setDrawer(false);
    else if (e.key === "Escape" && !$("pose-focus").hidden && !document.body.classList.contains("focus-full") && !document.querySelector("dialog[open], .cmd-pal:not([hidden])"))
      $("pose-focus").querySelector<HTMLElement>("button[data-focus-back].icon-btn")?.click();
    else if (e.key === "Escape" && document.querySelector(".cmd-pane.sub.on") && $("flow-hud").hidden) paneBack();
    else if (e.key === "Escape" && !$("flow-hud").hidden && !document.querySelector("dialog[open], .cmd-pal:not([hidden])")) selectFlow(null);
    else if (!typing && (e.key === "r" || e.key === "R") && !document.querySelector("dialog[open]")) setDrawer(drawer.hidden !== false);
  });
  bindRails();
  // Bandeau du graphe édité (G4).
  $("graph-bar").addEventListener("click", (e) => {
    const fold = (e.target as Element).closest<HTMLElement>("[data-gbar-fold]");
    if (fold) {
      graphBarFolded = fold.dataset.gbarFold === "0" ? null : fold.dataset.gbarFold!;
      renderGraphBar();
      $("graph-bar").querySelector<HTMLElement>("[data-gbar-fold]")?.focus();
      return;
    }
    const a = (e.target as Element).closest<HTMLElement>("[data-gbar]")?.dataset.gbar;
    if (a === "recalc") void recalcGraph();
    else if (a === "rate") void recalcGraph(settings.rate);
    else if (a === "restore") restoreGraphGoal();
    else if (a === "back" || a === "take") void dropGraphEdit(true);
  });
  // Rail des étapes (S60) : la même chose que la liste « Vue », dans l'onglet Usine.
  $("plan-steps").addEventListener("click", (e) => {
    const lever = (e.target as Element).closest<HTMLElement>("[data-full]");
    if (lever) {
      settings.usine = { ...settings.usine, full: lever.dataset.full === "1" };
      saveSettings(settings);
      if (settings.resultTab !== "pose") $("rtab-pose").click();
      else renderPose();
      return renderStepRail();
    }
    const b = (e.target as Element).closest<HTMLElement>("[data-step]");
    if (!b) return;
    const sel = $<HTMLSelectElement>("pose-step");
    sel.value = b.dataset.step!;
    if (settings.resultTab !== "pose") $("rtab-pose").click();
    sel.dispatchEvent(new Event("change"));
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
  // Modules posés (S25).
  // Bord de sortie d'un produit à évacuer (S27) : gardé par plan, l'usine se recalcule.
  $("pose-mods").addEventListener("change", (e) => {
    const sel = (e.target as Element).closest<HTMLSelectElement>("select[data-evac]");
    if (!sel) return;
    const key = planKey(settings.goal, settings.item) ?? "";
    const sides = { ...(settings.evacSides[key] ?? {}) };
    if (sel.value) sides[sel.dataset.evac!] = sel.value as "haut" | "bas" | "gauche" | "droite";
    else delete sides[sel.dataset.evac!];
    settings.evacSides = { ...settings.evacSides, [key]: sides };
    saveSettings(settings);
    renderPose();
  });
  for (const id of ["pose-mods", "pose-focus", "plan-steps"])
    $(id).addEventListener("change", (e) => {
      const box = (e.target as Element).closest<HTMLInputElement>("[data-posed]");
      if (!box) return;
      setPosed(box.dataset.posed!, box.checked);
      box.closest("label")?.classList.toggle("done", box.checked);
    });
  for (const id of ["pose-bar", "focus-bar-opts", "pose-more-usine"]) {
    $(id).addEventListener("change", onOption);
    $(id).addEventListener("click", (e) => {
      if ((e.target as Element).closest("button[data-uopt]")) onOption(e);
    });
  }
  // Ensembles modulaires (S14) : « Afficher les portées » et le poteau qui alimente le contrôleur.
  document.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-asm="ranges"]');
    if (!b) return;
    asmRanges = !asmRanges;
    if (!$("pose-focus").hidden && poseStep === USINE && poseFocus) showFocus(poseFocus);
    else renderPose();
  });
  document.addEventListener("change", (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.id !== "asm-pole" && t.id !== "asm-pole-focus") return;
    const key = t.id === "asm-pole" ? poseStep : poseFocus;
    if (!key) return;
    asmPole.set(key, t.value);
    if (t.id === "asm-pole") renderPose();
    else showFocus(key);
  });
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
      return applySel($("pose-frame"), poseSel, "pose-pick", t.closest<SVGGElement>(".m-pipe[data-tip]")?.dataset.tip);
    }
    const mod = t.closest<SVGGElement>("[data-mod]");
    // Un module, ou un ensemble modulaire posé à sa place (S14) : son panneau à côté.
    if (mod?.querySelector(".u-box") || (mod && (currentFactory()?.plan?.boxes.find((b) => b.key === mod.dataset.mod)?.assembly || assemblyOf(mod.dataset.mod!)))) return go({ page: "plan", goal: settings.goal, tab: "pose", step: USINE, focus: mod.dataset.mod! });
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
    const blk = t.closest<SVGGElement>(".ab[data-sel]")?.dataset.sel ?? null;
    const sel = blk ?? (pipe ? `i:${pipe.dataset.item}` : null);
    focusSel = sel && focusSel !== sel ? sel : null;
    // Le tuyau cliqué donne son info dans l'encadré (S27 bis : « on a aucune info dessus »).
    applySel($("focus-frame"), focusSel, "focus-pick", pipe?.dataset.tip);
  });
  $("focus-frame").addEventListener("click", (e) => {
    if (!(e.target as Element).closest("[data-unsel]")) return;
    focusSel = null;
    applySel($("focus-frame"), null, "focus-pick");
  });
  // Infobulles des dessins (usine, module, panneau d'un module) : suivent la souris, cachées pendant un glisser.
  for (const [frameId, tipId] of [["pose-frame", "pose-tip"], ["focus-frame", "focus-tip"]] as const) {
    const frame = $(frameId);
    const tip = $(tipId);
    frame.addEventListener("pointerover", (e) => {
      const t = (e.target as Element).closest<SVGElement>("[data-tip]");
      if (!t || frame.classList.contains("dragging")) return;
      tip.textContent = t.dataset.tip!;
      tip.hidden = false;
    });
    frame.addEventListener("pointerout", (e) => {
      if ((e.target as Element).closest("[data-tip]")) tip.hidden = true;
    });
    frame.addEventListener("pointermove", (e) => {
      if (tip.hidden) return;
      if (frame.classList.contains("dragging")) return void (tip.hidden = true);
      const r = frame.getBoundingClientRect();
      const x = e.clientX - r.left + 14;
      const y = e.clientY - r.top + 16;
      tip.style.left = `${Math.max(4, Math.min(r.width - tip.offsetWidth - 4, x))}px`;
      tip.style.top = `${y + tip.offsetHeight > r.height - 4 ? Math.max(4, e.clientY - r.top - tip.offsetHeight - 10) : y}px`;
    });
  }
  // Panneau du module : retour à l'usine, plein écran (Échap pour revenir), zoom.
  const setFull = (on: boolean) => {
    $("pose-focus").classList.toggle("full", on);
    document.body.classList.toggle("focus-full", on);
    // R15 : un seul bouton ; en plein écran il montre l'icône inverse (réduire).
    const b = $("pose-focus").querySelector<HTMLElement>("[data-focus-full]");
    if (b) {
      b.setAttribute("aria-pressed", String(on));
      b.innerHTML = icon(on ? "shrink" : "full");
      b.title = t(on ? "focus.unfull" : "focus.full");
      b.setAttribute("aria-label", b.title);
    }
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
  $("flow-hud").addEventListener("click", (e) => {
    if ((e.target as Element).closest("[data-flow-close]")) selectFlow(null);
    // Écran chiffré (S10) : « ↺ 1× » remet tous ses réglages à leur valeur par défaut.
    const reset = (e.target as Element).closest<HTMLElement>("[data-iset-reset]");
    if (reset) setMachineSetting(reset.dataset.isetReset!, null, null);
    const step = (e.target as Element).closest<HTMLElement>("[data-mset]");
    if (step) stepMachines(Number(step.dataset.mset));
  });
  // Moteur diesel (S18) : carburant, critère ou configuration imposée, pour ce plan.
  $("flow-hud").addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    // Recette choisie dans la barre du bloc (S28), comme dans Détails.
    if (el.matches("select[data-force]")) {
      setForced(el.dataset.force!, el.value);
      return $("flow-hud").querySelector<HTMLSelectElement>(`select[data-force="${CSS.escape(el.dataset.force!)}"]`)?.focus();
    }
    if (el.matches("[data-dsl-fuel]")) setDieselChoice({ fuel: el.value, config: null });
    else if (el.matches("[data-dsl-mode]")) setDieselChoice({ mode: (el as HTMLInputElement).dataset.dslMode as DieselChoice["mode"], config: null });
    else if (el.matches("[data-dsl-config]")) setDieselChoice({ config: el.value || null });
    else {
      const msd = mineshaftPatch(el);
      if (msd) setMineshaftChoice(msd);
    }
  });
  // Nombre de machines d'un bloc (S8) : −/+, molette sur le nombre, ou un nombre tapé (Entrée, ou en quittant le champ).
  const msetInput = () => $("flow-hud").querySelector<HTMLInputElement>("[data-mset-input]");
  const stepMachines = (d: number) => {
    const inp = msetInput();
    if (!inp) return;
    const n = Math.max(1, (parseInt(inp.value, 10) || 1) + d);
    inp.value = String(n);
    graphMachines(inp.dataset.key!, n);
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
    graphMachines(inp.dataset.key!, raw ? (n >= 1 ? n : 1) : null);
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
      if (z === "in") graphView?.zoom(1.25);
      else if (z === "out") graphView?.zoom(1 / 1.25);
      else graphView?.fit(); // ⤢ : toute la chaîne, comme la vue de départ (S28)
    });
  }
}

/** Boutons présents dans plusieurs vues (réponse, liste, détails) : délégation sur la page. */
function bindShared(): void {
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    // Menu des valeurs à vérifier : un clic ailleurs le referme.
    const menu = document.querySelector<HTMLDetailsElement>(".pb-warn[open]");
    if (menu && !menu.contains(t)) menu.open = false;
    // Un ⚠ (S28) : la correction de la valeur, où qu'il soit (barre « Ton plan », bloc, ligne, module).
    const fix = t.closest<HTMLElement>("[data-fix]");
    if (fix) return openFix(fix.dataset.fix!);
    // Ton plan (S28) : ouvrir un réglage, ou l'annuler (✕).
    const pb = t.closest<HTMLElement>("[data-pb]")?.dataset.pb;
    if (pb === "criteria" || pb === "mfilter" || pb === "advanced") return openSetting(pb);
    if (pb === "pw") return void showImported();
    if (pb === "details" || pb === "schema") return go({ page: "plan", goal: settings.goal, tab: pb });
    const pbx = t.closest<HTMLElement>("[data-pb-x]");
    if (pbx) {
      const what = pbx.dataset.pbX;
      if (what === "criteria") return setCriteria([...DEFAULT_SETTINGS.criteria[settings.goal]]);
      if (what === "fixed") return setFixed(pbx.dataset.key!, null);
      if (what === "forced") return setForced(pbx.dataset.item!, "");
      if (what === "msetting") return setMachineSetting(pbx.dataset.machine!, null, null);
      if (what === "pw") {
        const key = planKey(settings.goal, settings.item);
        if (key) {
          const { [key]: _, ...rest } = settings.imports;
          settings.imports = rest;
        }
        return update();
      }
      if (what === "mineshaft") return setMineshaftChoice({ ...DEFAULT_MINESHAFT });
      if (what === "diesel") {
        const key = planKey(settings.goal, settings.item);
        if (key) {
          const { [key]: _, ...rest } = settings.dieselChoice;
          settings.dieselChoice = rest;
        }
        return update();
      }
    }
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
      // Plan tiré du graphe (G4) : les nombres fixés sont ses cadenas ; on les retire du graphe (à recalculer).
      const fixedNodes = gedit?.solved && gedit.sig === goalSig() ? gedit.graph.nodes.filter((n) => n.fixed) : [];
      if (fixedNodes.length) {
        if (graphView?.graph === gedit!.graph) graphView.run({ type: "batch", commands: fixedNodes.map((n) => ({ type: "setFixed" as const, id: n.id, fixed: false })) });
        else {
          gedit!.graph = { ...gedit!.graph, nodes: gedit!.graph.nodes.map(({ fixed: _f, ...n }) => n) };
          graphDoc = null;
          saveGraphEdit(true);
          render();
        }
        return;
      }
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
      $("upto-hint").textContent = t("m.upto.notFound");
      return;
    }
    const before = new Set(prog.unlocked);
    const next = unlockUpTo(data, toEngineProgress(prog), node.id);
    const added = [...next].filter((x) => !before.has(x)).length;
    $("upto-hint").textContent = t("m.upto.done", { name: node.name, n: String(added) });
    treeView.category = node.category;
    ui.selected = node.id;
    saveUi();
    void setProgress({ ...prog, unlocked: [...next] });
  });
  $("progress-reset").addEventListener("click", async () => {
    const choice = await ask(t("m.reset.title"), t("m.reset.html"), [
      { value: "yes", label: t("m.reset"), primary: true },
      { value: "", label: t("m.cancel") },
    ]);
    if (choice === "yes") void setProgress({ unlocked: [], reqItemsDone: [], owned: [] }, { spend: false });
  });

  // Transférer la partie (autre adresse, autre appareil)
  $("progress-export").addEventListener("click", () => {
    const file = exportProgress(prog, player, new Date(), journal);
    downloadJson(file, `progression-industrialist-${file.exportedAt.slice(0, 10)}.json`);
    $("progress-io-hint").textContent = t("m.exported");
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
      parsed = { ok: false, error: t("m.import.unreadable") };
    }
    if (!parsed.ok) {
      $("progress-io-hint").textContent = t("m.import.failed", { err: parsed.error });
      return;
    }
    const when = parsed.exportedAt ? t("m.import.when", { date: fmtDate(new Date(parsed.exportedAt).getTime()) }) : "";
    const choice = await ask(
      t("m.import.title"),
      `${t("m.import.html", { cur: String(prog.unlocked.length), when: esc(when), n: String(parsed.progress.unlocked.length), owned: String(parsed.progress.owned.length) })}${
        parsed.dropped ? `<p class="hint">${t("m.import.dropped", { n: String(parsed.dropped) })}</p>` : ""
      }`,
      [
        { value: "yes", label: t("m.replace"), primary: true },
        { value: "", label: t("m.cancel") },
      ],
    );
    if (choice !== "yes") return;
    player = parsed.player;
    savePlayer(player);
    setJournal(parsed.history ?? startJournal(Date.now(), player));
    void setProgress(parsed.progress, { spend: false });
    // S29 : le même compte que l'en-tête (les recherches acquises d'office comprises).
    const n = [...data.nodes.values()].filter((x) => !x.isRoot && (x.startUnlocked || parsed.progress.unlocked.includes(x.id))).length;
    $("progress-io-hint").textContent = t("m.imported", { n: String(n), total: String(researchTotal()) });
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
      $(key === "plotW" || key === "plotH" ? "plot-hint" : key === "rp" || key === "rpPerSec" ? "rp-hint" : key === "money" ? "money-hint" : "player-hint").textContent = v === "invalide" ? t("m.numOrEmpty") : "";
      if (v === "invalide") return;
      if (key === "rp" || key === "rpPerSec") {
        const t = Date.now();
        player = key === "rp" ? { ...player, rp: v, rpAt: v === null ? null : t } : { ...player, rpPerSec: v };
        setJournal(addEvent(journal, { type: "releve", rp: key === "rp" ? v : null, rps: key === "rpPerSec" ? v : null }, t));
      } else player = { ...player, [key]: v };
      savePlayer(player);
      renderRpLive(key === "rp" || key === "rpPerSec");
      planDirty = true;
      renderHeader();
      if (key === "pollutionPct") renderGameBox();
    });
  }
  bindResearchBox();
  $("gs-month").addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value;
    setGame({ month: v ? Number(v) : null });
  });
  $("gs-igloo").addEventListener("change", (e) => setGame({ igloo: (e.target as HTMLInputElement).checked }));
  $("gs-difficulty").addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (isDifficulty(v)) setGame({ difficulty: v });
  });
  $("gs-scrubber").addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    void setProgress({ ...prog, owned: on ? [...new Set([...prog.owned, TREE_SCRUBBER])] : prog.owned.filter((m) => m !== TREE_SCRUBBER) });
    planDirty = true;
  });
  document.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-gset]");
    if (b) openGameField(b.dataset.gset as GameField);
  });
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
    const v = parseNum((form.elements.namedItem("rate") as HTMLInputElement).value);
    if (!id) return void ($("existing-hint").textContent = t("m.ex.notFound"));
    if (!(v > 0)) return void ($("existing-hint").textContent = t("m.ex.positive"));
    $("existing-hint").textContent = t("m.ex.added", { item: itemName(id), r: fmt(v, 2) });
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
    // Mode bulle (S29) : la bulle s'ouvre à côté de la recherche cliquée ; un clic dans le vide la ferme.
    if (treeBubble) bubbleFor = g ? g.dataset.rs! : null;
    if (g) selectNode(g.dataset.rs!, false);
    else if (treeBubble) renderTreeBubble();
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-unlockmode]")) b.addEventListener("click", () => setTreeBubble(b.dataset.unlockmode === "bulle"));
  $("tree-unlock-all").addEventListener("click", async () => {
    const target = unlockableNodes(data, prog.unlocked, player.difficulty);
    const added = [...target].filter((id) => !prog.unlocked.includes(id));
    if (!added.length) {
      await ask(t("tr.all.confirm.title"), t("tr.all.none"), [{ value: "", label: t("m.cancel") }]);
      return;
    }
    const left = [...data.nodes.values()].filter((n) => !n.isRoot && !n.startUnlocked && !target.has(n.id)).map((n) => n.name);
    const skip = left.length ? t("tr.all.skip", { list: esc(left.join(", ")) }) : "";
    const choice = await ask(t("tr.all.confirm.title"), t("tr.all.confirm.html", { n: String(added.length), d: t(`dif.${player.difficulty}` as never), skip }), [
      { value: "yes", label: t("tr.all"), primary: true },
      { value: "", label: t("m.cancel") },
    ]);
    if (choice === "yes") void setProgress({ ...prog, unlocked: [...target] });
  });
  $("tree-lock-all").addEventListener("click", async () => {
    if (!prog.unlocked.length) return;
    const choice = await ask(t("tr.none.confirm.title"), t("tr.none.confirm.html", { n: String(prog.unlocked.length) }), [
      { value: "yes", label: t("tr.none"), primary: true },
      { value: "", label: t("m.cancel") },
    ]);
    if (choice === "yes") void setProgress({ ...prog, unlocked: [] }, { spend: false });
  });
  const bubble = $("rs-bubble");
  bubble.addEventListener("pointerdown", (e) => e.stopPropagation()); // pas de glisser du canevas depuis la bulle
  bubble.addEventListener("click", (e) => {
    e.stopPropagation();
    const gset = (e.target as Element).closest<HTMLElement>("[data-gset]");
    if (gset) return openGameField(gset.dataset.gset as GameField);
    if ((e.target as Element).closest("[data-rsb-close]")) {
      bubbleFor = null;
      renderTreeBubble();
      renderHud();
      return;
    }
    void onResearchClick(e);
  });
  $("rs-frame").addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bubbleFor) {
      bubbleFor = null;
      renderTreeBubble();
      renderHud();
    }
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
  $("rs-detail").addEventListener("click", (e) => void onResearchClick(e));
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
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-utab]")) {
    b.addEventListener("click", () => go(b.dataset.utab === "recherche" ? { page: "usine", usineTab: "recherche" } : { page: "usine" }));
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
  $("send-fixes").addEventListener("click", (e) => remarks.open({ piece: correctionsPiece(), kind: "fix" }, e.currentTarget as HTMLElement));
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
      $("data-errors").innerHTML = `<div class="banner bad">${esc(t("m.cor.importFailed", { err: (err as Error).message }))}</div>`;
    }
  });
  $("clear-corrections").addEventListener("click", async () => {
    if (!countCorrections(corrections)) return;
    const choice = await ask(t("m.cor.clear.title"), t("m.cor.clear.html"), [
      { value: "yes", label: t("m.clearAll"), primary: true },
      { value: "", label: t("m.cancel") },
    ]);
    if (choice !== "yes") return;
    corrections = {};
    saveCorrections(corrections);
    rebuildData();
    update();
  });
}

/** « Ma recherche » (S20) : saisie rapide (le panneau) ou détaillée (les stations). */
function bindResearchBox(): void {
  const box = $("rs-box");
  const tier = (k: string) => k as StationKind;
  box.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-rsg-addbtn]")) {
      const k = tier(box.querySelector<HTMLSelectElement>("[data-rsg-add]")!.value);
      return updateResearch((s) => void s.groups[k].push({ count: 1, items: [] }), true);
    }
    const del = t.closest<HTMLElement>("[data-rsg-del]")?.dataset.rsgDel;
    if (del) {
      const [k, i] = del.split(":");
      return updateResearch((s) => void s.groups[tier(k!)].splice(Number(i), 1), true);
    }
    if (t.closest("[data-rsc-add]")) return updateResearch((s) => void s.controllers.push({ count: 1, fluid: "" }), true);
    const cdel = t.closest<HTMLElement>("[data-rsc-del]")?.dataset.rscDel;
    if (cdel !== undefined) return updateResearch((s) => void s.controllers.splice(Number(cdel), 1), true);
  });
  // Nombres : pris à chaque frappe (le formulaire n'est pas redessiné, le focus reste).
  box.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    const d = el.dataset;
    // Tier sans groupe : la 1ʳᵉ frappe d'un nombre crée le groupe, puis le curseur y revient.
    if (d.rsgNew) {
      const k = tier(d.rsgNew);
      const v = parseOptional(el.value);
      if (v === "invalide" || v === null || !(v > 0)) return;
      updateResearch((s) => void s.groups[k].push({ count: v, items: [] }), true);
      const next = box.querySelector<HTMLInputElement>(`[data-rsg="${k}:0:count"]`);
      next?.focus();
      next?.setSelectionRange(next.value.length, next.value.length);
      return;
    }
    const numeric = d.rsp ?? d.rsd ?? (d.rsmax !== undefined ? "max" : undefined) ?? (d.rsg?.endsWith(":count") ? d.rsg : undefined) ?? (d.rsc?.endsWith(":count") ? d.rsc : undefined);
    if (numeric === undefined) return;
    const v = parseOptional(el.value);
    el.setAttribute("aria-invalid", String(v === "invalide"));
    $("rp-hint").textContent = v === "invalide" ? t("m.numOrEmpty") : "";
    if (v === "invalide") return;
    updateResearch((s) => {
      if (d.rsp) {
        const [k, f] = d.rsp.split(":") as [StationKind, "stations" | "rate" | "cap"];
        s.panel[k][f] = v;
      } else if (d.rsd) s.dish[d.rsd as keyof ResearchSetup["dish"]] = v;
      else if (d.rsmax !== undefined) s.maxRp = v;
      else if (d.rsg) {
        const [k, i] = d.rsg.split(":");
        const g = s.groups[tier(k!)][Number(i)];
        if (g) g.count = v ?? 0;
      } else if (d.rsc) {
        const c = s.controllers[Number(d.rsc.split(":")[0])];
        if (c) c.count = v ?? 0;
      }
    });
  });
  // Items, liquides (noms résolus en quittant le champ) et mini-jeu Logic.
  box.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    const g = el.dataset.rsg;
    const c = el.dataset.rsc;
    const field = g?.split(":")[2] ?? c?.split(":")[1];
    if (!field || field === "count") return;
    if (field === "logic") {
      const [k, i] = g!.split(":");
      return updateResearch((s) => {
        const x = s.groups[tier(k!)][Number(i)];
        if (x) x.logic = el.checked || undefined;
      });
    }
    const id = el.value.trim() ? resolveItem(el.value) : "";
    el.setAttribute("aria-invalid", String(id === null));
    $("rp-hint").textContent = id === null ? t("m.rs.unknownItem", { v: el.value }) : "";
    if (id === null) return;
    if (id) el.value = itemName(id);
    updateResearch((s) => {
      if (g) {
        const [k, i, f] = g.split(":");
        const x = s.groups[tier(k!)][Number(i)];
        if (x) x.items[Number(f!.slice(4))] = id;
        if (x) for (let j = 0; j < x.items.length; j++) x.items[j] ??= ""; // pas de trou si l'item 2 vient avant le 1
      } else {
        const x = s.controllers[Number(c!.split(":")[0])];
        if (x) x.fluid = id;
      }
    });
  });
}

/** Les RP montent tout seuls : affichage rafraîchi, et l'arbre ou le plan quand ça change quelque chose. */
let rpSignature = "";
let lastRpPlanRender = 0;
let lastHistRender = 0;
function tickRp(): void {
  const page = currentPage();
  if (journal.clock.playing) setJournal(touch(journal, Date.now()));
  if (page === "usine") refreshPlay(Date.now());
  const rp = rpNow();
  if (rp === null || !rpTiers() || !journal.clock.playing) return;
  renderHeader();
  if (page === "usine") {
    renderRpEstimate();
    renderRpLive();
    // Les graphiques avancent avec le temps de jeu, sans gêner une lecture en cours.
    if (Date.now() - lastHistRender > 60_000 && document.querySelector<HTMLElement>("#rs-hist .rh-tip")?.hidden !== false) {
      lastHistRender = Date.now();
      renderHistoryBox();
    }
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
bindLang();
bindTheme();
const buildings = initBuildings($("bld-root"), data, REPO_PORTS, (id) => refine({ page: "donnees", dataTab: "batiments", machine: id }), REPO_IFACES.machines, REPO_MODULAR, { get: () => dieselReadings, set: setDieselReadings }, (piece) => remarks.open({ piece, kind: "surveys" }));
// S35 : la fenêtre « Remarque ». Un envoi de corrections redessine les boutons « 📤 » (« Envoyées le… »).
const remarks = initRemarks(remarkContext, () => {
  renderData();
  if (route.page === "recettes") renderRecettes();
  buildings.refresh();
});
// S36 : la page Propositions (son bouton « 💬 Proposer une idée » ouvre la fenêtre Remarque).
const props = initPropositions($("page-propositions"), (from) => remarks.open(null, from));
// Remarque n° 16 : la page « Méthodes de calcul », son exemple recalculé avec les données du moment.
const methods = initMethods($("page-methodes"), () => data);
// B3 : le bac à sable. Catalogue refait seulement quand les données (corrections) ou les relevés changent.
let sbCat: { data: GameData; ports: unknown; cat: SbCatalog } | null = null;
const SB_MODS = new Map<string, ModRange>();
for (const a of REPO_MODULAR.assemblies) for (const b of a.blocks) {
  const r = fact(b, "rangeTiles")?.value;
  if (r == null) continue;
  SB_MODS.set(b.id, { edge: typeof r === "number" ? r : null, serves: (fact(b, "serves")?.value as string[] | undefined) ?? [] });
}
function sandboxCatalog() {
    const p = currentPorts().machines;
    if (!sbCat || sbCat.data !== data || sbCat.ports !== p) {
      sbCat = { data, ports: p, cat: buildSandboxCatalog(data, { ports: { machines: p } as unknown as PortsFile, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: RELEVES }) };
    }
    return sbCat.cat;
}
const sandbox = initSandbox($("page-bac"), {
  catalog: sandboxCatalog,
  category: (id) => data.machines.get(id)?.category ?? null,
  meta: (id) => { const m = data.machines.get(id); return { desc: m?.description ?? null, unlock: m?.unlockedBy ? nodeName(m.unlockedBy) : null }; },
  img: (kind, id) => pictureOf(kind, id)?.src ?? null,
  mods: SB_MODS,
  inEditor: (id) => data.machines.has(id),
  propose: (fills, from) => remarks.open({ piece: { fichier: "bac-recettes.json", resume: t("bac.rec.proposeN", { n: Object.keys(fills).length }), contenu: fills }, kind: "fix" }, from),
});
const designsView = initDesigns($("plan-saved"), {
  tree: () => designs,
  save: storeDesigns,
  dirty: designDirty,
  open: async (id) => void (await openDesign(id)),
  create: createDesign,
  store: async (id) => void (await saveDesign(id)),
  revert: async (id) => void (await revertDesign(id)),
  copy: async (id) => void (await copyDesign(id)),
  share: async (id) => {
    if (id !== designs.active) await openDesign(id);
    if (id === designs.active) share.openShare();
  },
  keep: keepActive,
  settle: settleDesigns,
  confirm: async (text, ok) => (await ask(t("dsg.sure"), `<p>${esc(text)}</p>`, [{ value: "ok", label: ok, primary: true }, { value: "", label: t("m.cancel") }])) === "ok",
  toast: (m, bad) => share.toast(m, bad),
  printed: () => prints.on.at(-1)?.name ?? null,
  unprint: undoPrint,
  openFile: () => {
    const inp = document.createElement("input");
    inp.type = "file"; // pas de filtre : un ancien fichier du bac à sable s'ouvre aussi
    inp.onchange = () => inp.files?.[0] && void share.receiveFile(inp.files[0]);
    inp.click();
  },
});
const share = initShare({
  build: sharedDesign,
  factory: factoryForFile,
  busy,
  contribs: hasContribNow,
  sandboxEmpty: () => !hasSandbox(sandbox.layout()),
  print: currentPrint,
  probe: probeDesign,
  facts: shareFacts,
  nameOf: (d) => savedName(designSettings(d)),
  currentName: () => activeDesign()?.name ?? savedName(),
  open: openReceived,
  done: (legacy, opened) => {
    // Le choix est fait : l'adresse perd son #d=… (ou #bac/<code>), « Retour » ne la repropose pas.
    stack = stack.filter((h) => !readShareHash(h));
    saveStack();
    const to = legacy || (opened && isBlank(settings.goal) && hasSandbox(sandbox.layout())) ? "#bac" : opened || !shareReturn ? GOAL_HASH[settings.goal] : shareReturn;
    shareReturn = null;
    history.replaceState(null, "", to);
    showPage();
  },
  legacyFallback: (code) => {
    // Code d'avant le format actuel (JSON en base64) : le bac à sable le lit comme avant.
    if (currentPage() === "bac") sandbox.show(code);
    else location.hash = `#bac/${encodeURIComponent(code)}`;
  },
});
$("pose-frozen").addEventListener("click", (e) => {
  if (!frozen || !(e.target as Element).closest("[data-frozen]")) return;
  frozen.show = !frozen.show;
  void storeFrozen();
  renderPose();
});
if (location.pathname.startsWith("/v/")) {
  $("vbar").hidden = false;
  $("vbar-txt").textContent = t("ver.old", { v: SITE_VERSION });
}
$("lecture-print").addEventListener("click", () => void printLecture());
$("lecture-back").addEventListener("click", () => void backToMine());
window.addEventListener("hashchange", showPage);
const cameByLink = !!readShareHash(location.hash); // avant showPage, qui ouvre le lien
void bootDesigns();
showPage();
// Tutoriel (remarque n° 14) : la carte d'accueil seule à la toute première visite ; « ? Tutoriel » rouvre la liste « Premiers pas ».
$("help").addEventListener("click", () => checklist.show());
{
  let seen: string | null = "1";
  try {
    seen = localStorage.getItem(KEY_TOUR);
  } catch {
    // stockage indisponible : pas de visite automatique
  }
  if (!seen && isFresh()) {
    if (!cameByLink) tour.start("first"); // arrivé par un lien : on montre le design reçu, la visite attendra
  } else if (seen) checklist.render(); // la liste reste là d'une visite à l'autre, tant qu'elle n'est pas masquée
}
window.setInterval(tickRp, 5000);
bindHistory();
void recallPlaying();

// ---------------------------------------------------------------- remarques (S35)

/** Ce qui part avec une remarque : la vue (« Planifier › Usine ») et son adresse, et le plan affiché en bref. */
function remarkContext(): { label: string; hash: string; plan: string | null } {
  const page = currentPage();
  const top = page === "plan" ? goalName(settings.goal) : t(page === "usine" && route.usineTab === "recherche" ? "page.recherche" : `page.${page}`);
  const view = routeTitle(route);
  let plan: string | null = null;
  if (page === "plan" && settings.entered.includes(settings.goal)) {
    try {
      const v = viewCtx();
      plan = `${settings.goal} · ${planLabel(v)} · ${settings.criteria[settings.goal].join(" > ")}`;
    } catch {
      plan = settings.goal;
    }
  }
  return { label: view && view !== top ? `${top} › ${view}` : top, hash: location.hash || "#objet", plan };
}

/** Le fichier des corrections joint à un envoi : exactement celui de « Exporter mes corrections ». */
function correctionsPiece(): Piece {
  const n = countCorrections(corrections);
  const nNotes = Object.keys(notes).length;
  const parts = [n ? t("rm.mine.fix", { n }) : "", nNotes ? t("rm.fix.notes", { n: nNotes }) : ""].filter(Boolean);
  return { fichier: "overrides.json", resume: joinList(parts), contenu: { ...mergeCorrections(repoOverrides, corrections), _notes: { ...repoNotes, ...notes } } };
}
/** Il y a quelque chose à envoyer : des corrections ou des notes du joueur. */
// Une fonction, pas une constante : la page ouverte directement sur Recettes ou Contribuer s'en sert avant d'arriver à cette ligne.
function hasOwnFixes(): boolean {
  return !lecture() && countCorrections(corrections) + Object.keys(notes).length > 0;
}

/** Bouton « 📤 Envoyer mes corrections » de Contribuer, et la note « Envoyées le… » (maquette S35, écran 1). */
function renderFixSend(): void {
  const btn = $("send-fixes") as HTMLButtonElement;
  btn.hidden = !hasOwnFixes();
  $("send-fixes-note").textContent = hasOwnFixes() ? [t("rm.fix.hint"), sentNote(loadSent()["overrides.json"], correctionsPiece().contenu)].filter(Boolean).join(" · ") : "";
}

// ---------------------------------------------------------------- langue (S30)

/** Textes fixes, <html lang>, description et bouton FR / EN dans la langue choisie. */
function applyLang(): void {
  document.documentElement.lang = lang();
  applyStatic(document);
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("site.description"));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang()));
}

/** S59 : thème sombre par défaut, clair en option ; le choix est gardé (lu dès index.html). */
function bindTheme(): void {
  const btn = $("theme-btn");
  const draw = (): void => {
    const light = document.documentElement.dataset.theme === "light";
    btn.innerHTML = icon(light ? "moon" : "sun");
    btn.setAttribute("aria-pressed", String(light));
  };
  draw();
  btn.addEventListener("click", () => {
    const light = document.documentElement.dataset.theme !== "light";
    if (light) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("theme", light ? "light" : "dark");
    } catch {
      // choix pour cette visite seulement
    }
    draw();
  });
}

/** Bouton FR / EN : la page est redessinée sur place (saisie et usine calculée gardées), le choix est gardé. */
function bindLang(): void {
  applyLang();
  $("lang-sw").addEventListener("click", (e) => {
    const l = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-lang]")?.dataset.lang as Lang | undefined;
    if (!l || l === lang()) return;
    setLang(l);
    try {
      localStorage.setItem(KEY_LANG, l);
    } catch {
      // choix pour cette visite seulement
    }
    applyLang();
    setDocTitle();
    render();
    buildings.refresh();
    remarks.refresh();
    props.refresh();
    sandbox.refresh();
    // La liste « Premiers pas » (et sa case « Modifier la proposition ») suit la langue.
    if (!document.getElementById("steps-box")?.hidden) checklist.render();
  });
}

/** Interrupteur (Ma recherche, en-tête), période, ✕ du journal, survol des graphiques (S21). */
function bindHistory(): void {
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const play = t.closest<HTMLElement>("[data-play]")?.dataset.play;
    if (play) return togglePlaying(play === "on");
    const period = t.closest<HTMLElement>("[data-rh-period]")?.dataset.rhPeriod;
    if (period !== undefined) {
      rpPeriod = Number(period);
      try {
        localStorage.setItem(KEY_RP_PERIOD, period);
      } catch {
        // période pour cette visite seulement
      }
      return renderHistoryBox();
    }
    const del = t.closest<HTMLElement>("[data-rh-del]")?.dataset.rhDel;
    if (del !== undefined) {
      setJournal(removeEvent(journal, Number(del)));
      planDirty = true;
      renderHeader();
      renderRpLive(true);
    }
  });
  const box = $("rs-hist");
  bindHistoryHover(box, () => {
    const gNow = gameNow(journal.clock, Date.now());
    return { h: historyTo(chartDomain(journal, gNow, rpPeriod)[1]), j: journal, gNow, period: rpPeriod, names: rhNames };
  });
  let width = box.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(box.clientWidth - width) < 8) return;
    width = box.clientWidth;
    renderHistoryBox();
  }).observe(box);
  const keepSeen = () => {
    if (journal.clock.playing) setJournal(touch(journal, Date.now()));
    touchOwn();
  };
  window.addEventListener("pagehide", keepSeen);
  document.addEventListener("visibilitychange", keepSeen);
}

/** À l'ouverture : « Je joue » est resté actif pendant que le site était fermé (Q22.1). */
async function recallPlaying(): Promise<void> {
  const now = Date.now();
  if (!needsRecall(journal, now)) {
    if (journal.clock.playing) setJournal(touch(journal, now));
    return;
  }
  const before = journal;
  const epoch = profileEpoch;
  const away = fmtDuration((now - before.clock.seen) / 1000);
  // Tant qu'il n'y a pas de réponse : « arrêté à la fermeture du site ».
  setJournal(stopAtLastSeen(journal, now));
  const stop = journal.events[journal.events.length - 1];
  planDirty = true;
  renderHeader();
  if (currentPage() === "usine") renderRpLive(true);
  // Un bandeau sous l'en-tête (S23), pas une fenêtre par-dessus la page : on peut l'ignorer.
  const bar = $("recall");
  bar.innerHTML = `<span>${t("recall.text.html", { away: esc(away) })}</span>
    <button type="button" class="small" data-recall="go">${esc(t("recall.go", { away }))}</button>
    <button type="button" class="small" data-recall="stop" aria-label="${esc(t("recall.close"))}" title="${esc(t("recall.close"))}">${icon("close")}</button>`;
  bar.hidden = false;
  const choice = await new Promise<string>((resolve) =>
    bar.addEventListener("click", function on(e) {
      const v = (e.target as HTMLElement).closest<HTMLElement>("[data-recall]")?.dataset.recall;
      if (!v) return;
      bar.removeEventListener("click", on);
      resolve(v);
    }),
  );
  if (epoch !== profileEpoch) return;
  bar.hidden = true;
  if (choice !== "go" || journal.clock.playing) return;
  // La session continue : l'arrêt ajouté disparaît, l'horloge reprend comme avant la fermeture.
  setJournal({ clock: { ...before.clock, seen: Date.now() }, events: journal.events.filter((e) => e !== stop) });
  planDirty = true;
  renderHeader();
  if (currentPage() === "usine") renderRpLive(true);
}
