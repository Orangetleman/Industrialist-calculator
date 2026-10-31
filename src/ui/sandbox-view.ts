// Bac à sable / Sandbox (lot B3, PLAN-BAC-A-SABLE.md § 7) : la page, calquée sur la maquette validée
// (maquette/bac-a-sable.html, menu de pose de Mindustry). Le calcul vient du moteur (src/engine/sandbox/, B1 et
// B2) ; ici, seulement l'écran : grille, menu de pose, gestes, panneaux, fenêtres.
// Tracés d'icônes Lucide 0.460 (ISC, © Lucide Contributors ; portions © Cole Bemis, Feather, MIT), comme icons.ts.

import "../sandbox.css";
import {
  applyPlan, autoConnect, cellKey, CROSS_PAIRS, DV, cellsOf, clickRoute, computeSandbox, contacts, crossId, dims, droitLens, elecRole, explicitPlan, facingKey, geo, links,
  machineLinks, occupancy, pipePath, pipePlan, portKey, powerWires, rectPlan, sandboxCache, stillMissing, straightPath, withFills,
  type Dir, type Layout, type Placed, type Plan, type Piece, type PlacedPort, type RecipeFill, type Route, type SandboxResult, type SandboxSettings, type SbCatalog, type SbIncomplete, type Wire, type Fam,
} from "../engine/sandbox/index.ts";
import type { SandboxAnswer, SandboxAsk } from "./sandbox.worker.ts";
import { fromCode, readMsch, toCode, writeMsch, type Schematic } from "../engine/schematic/msch.ts";
import { t, type Key } from "../i18n/i18n.ts";
import { colon, esc, fmt, fmtMoney, fmtPct, parseNum, quote } from "./format.ts";
import { blockIcon, blockMarkup, hue, portEdge, PORT_COL, rangeMarkup, rect, type DrawCtx, type ImgOf, type ModRange } from "./sandbox-draw.ts";
import {
  ACTIONS, alertText, anchor, buildMenu, CATS, defaultKeys, entriesFor, FAMS, FIXED_KEYS, keyLabel, linePositions, locked, machinesFor, reasonText, recipeLine,
  ROMAN, routeErrorText, shortcut, TIERS, wireErrorText, type Action, type Entry, type KeyMap, type Menu, type Names,
} from "./sandbox-model.ts";

const IC: Record<string, string> = {
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
  schem: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  db: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  tree: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  break: '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  select: '<path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  updown: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  filter: '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
  pipes: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  logic: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  power: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  deco: '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
  module: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  misc: '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  extract: '<path d="M14.531 12.469 6.619 20.38a1 1 0 1 1-3-3l7.912-7.912"/><path d="M15.686 4.314A12.5 12.5 0 0 0 5.461 2.958 1 1 0 0 0 5.58 4.71a22 22 0 0 1 6.318 3.393"/><path d="M17.7 3.7a1 1 0 0 0-1.4 0l-4.6 4.6a1 1 0 0 0 0 1.4l2.6 2.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z"/><path d="M19.686 8.314a12.501 12.501 0 0 1 1.356 10.225 1 1 0 0 1-1.751-.119 22 22 0 0 0-3.393-6.319"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  tanks: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/>',
};
const ic = (n: string) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IC[n] ?? ""}</svg>`;

/** Ce que la page reçoit du site : catalogue (données corrigées et relevés du joueur), images, portées, liens. */
export type SandboxDeps = {
  catalog: () => SbCatalog;
  category: (id: string) => string | null;
  meta: (id: string) => { desc: string | null; unlock: string | null };
  img: ImgOf;
  mods: Map<string, ModRange>;
  /** Le bâtiment est dans l'éditeur de bâtiments (6 pièces de tuyau n'y sont pas encore). */
  inEditor: (id: string) => boolean;
  /** Proposer les chiffres saisis pour une recette incomplète (fenêtre Remarque). */
  propose: (fills: Record<string, RecipeFill>, from: HTMLElement) => void;
};

type State = { blocks: Placed[]; wires: Wire[]; routes: Route[]; fills: Record<string, RecipeFill> };
type Clip = { id: number; items: { id: string; dx: number; dy: number; r: number; choice: string | null }[]; W: number; H: number; saved?: string };
type Op =
  | { t: "line"; s: [number, number] }
  | { t: "break"; s: [number, number]; moved: boolean }
  | { t: "schem"; s: [number, number] }
  | { t: "mid"; sx: number; sy: number; cx: number; cy: number; moved: boolean }
  /** Appui sur un port libre : un clic filtre la grille, un glisser trace un tuyau depuis la case devant le port. */
  | { t: "port"; pr: PortRef & { p: PlacedPort }; s: [number, number]; fam: Fam; moved: boolean };
type PortRef = { u: number; i: number };
type Sel = { e: Entry; v: string; locked: boolean };
type Settings = { hideEmptyCats: boolean; runWithoutPower: boolean };
type PlanView = Plan & { bad?: [number, number][]; invalid?: Piece[] };

/** Au-delà de ce temps de calcul sur place (la moitié d'une image à 60 Hz), le calcul passe dans un worker (B4). */
const WORKER_MS = 8;
/** En dessous de ce zoom (pixels par case), la vue compacte : formes simples, sans image, texte ni port (B4). */
const COMPACT_Z = 12;

const KEY_STATE = "ind-calc:v1:bac";
const KEY_SET = "ind-calc:v1:bac-reglages";
const KEY_KEYS = "ind-calc:v1:bac-touches";
const KEY_SCHEM = "ind-calc:v1:bac-schemas";
const SIDE_KEY: Record<string, Key> = { N: "bac.side.N", S: "bac.side.S", W: "bac.side.W", E: "bac.side.E", top: "bac.side.top" };
const load = <T>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? { ...d, ...JSON.parse(v) } : d;
  } catch {
    return d;
  }
};
const store = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // stockage indisponible : gardé pour cette visite
  }
};
/** Anciens codes (avant le .msch, S55) : JSON en base64, toujours lus. */
const decOld =<T>(s: string): T => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0)))) as T;

export function initSandbox(root: HTMLElement, deps: SandboxDeps) {
  // ------------------------------------------------------------ état
  let S: State = { blocks: [], wires: [], routes: [], fills: {}, ...load<Partial<State>>(KEY_STATE, {}) };
  const SET: Settings = load(KEY_SET, { hideEmptyCats: false, runWithoutPower: true });
  const KB: KeyMap = load(KEY_KEYS, defaultKeys());
  const LAB = new Map<string, string>();
  let undo: string[] = [], redo: string[] = [];
  const ui = {
    tier: 1, cat: "Factories", sel: null as Sel | null, auto: true, rot: 0, vec: false, status: true, wires: true, hidden: false,
    pinned: null as number | null, hoverU: null as number | null, hoverBtn: null as string | null, cell: [0, 0] as [number, number], sub: [0.5, 0.5] as [number, number],
    op: null as Op | null, clip: null as Clip | null, ctrl: false, choice: null as { id: string; c: string } | null, breakMode: false, schemMode: false,
    filter: null as { ids: string[]; title: string } | null, routeFrom: null as PortRef | null, unit: 60, mounted: false,
  };
  const cam = { x: -6, y: -6, z: 30 };
  let baseCat: SbCatalog | null = null, cat!: SbCatalog, menu!: Menu, fillSig = "";
  let occ = new Map<string, number>(), byU = new Map<number, Placed>();
  let R: SandboxResult | null = null, laneMap = new Map<string, SandboxResult["lanes"][number]>();
  const layout = (): Layout => ({ blocks: S.blocks, wires: S.wires, routes: S.routes });
  const names: Names = { block: (id) => cat.blocks.get(id)?.name ?? id, item: (id) => cat.items.get(id)?.name ?? id };
  const dctx = (): DrawCtx => ({ cat, img: deps.img, itemName: names.item, status: ui.status, compact: cam.z < COMPACT_Z, lane: (u, l) => laneMap.get(`${u}:${l}`) });

  /** Catalogue avec les recettes complétées par le joueur ; reconstruit seulement quand les données ou les saisies changent. */
  function refreshCatalog(): void {
    const b = deps.catalog(), sig = JSON.stringify(S.fills);
    if (b === baseCat && sig === fillSig) return;
    const first = !baseCat || b !== baseCat;
    baseCat = b;
    fillSig = sig;
    cat = withFills(b, S.fills);
    if (first) menu = buildMenu(cat, (id) => (cat.blocks.get(id)?.pipe ? "Pipes" : deps.category(id)));
  }
  function reindex(): void {
    S.blocks = S.blocks.filter((b) => cat.blocks.has(b.id));
    occ = occupancy(cat, layout()).occ;
    byU = new Map(S.blocks.map((b) => [b.u, b]));
    S.wires = S.wires.filter((w) => byU.has(w.a) && byU.has(w.b));
  }
  // Calcul (B4) : incrémental (seuls les îlots touchés par un geste) ; s'il dépasse WORKER_MS sur place, les
  // suivants partent dans un worker, et reviennent sur place quand ils redeviennent courts.
  const cache = sandboxCache();
  let lastMs = 0, worker: Worker | null = null, workerCat: SbCatalog | null = null, workerOff = false, ask = 0;
  function setResult(r: SandboxResult): void {
    R = r;
    laneMap = new Map(R.lanes.map((l) => [`${l.u}:${l.lane}`, l]));
  }
  function compute(): void {
    const settings = { runWithoutPower: SET.runWithoutPower };
    if (lastMs > WORKER_MS && !workerOff && typeof Worker !== "undefined") return computeAway(settings);
    ask++; // une réponse du worker encore en route est périmée
    const t0 = performance.now();
    setResult(computeSandbox(cat, layout(), settings, cache));
    lastMs = performance.now() - t0;
  }
  function computeAway(settings: SandboxSettings): void {
    if (!worker) {
      worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<SandboxAnswer>) => {
        if (e.data.id !== ask) return;
        if ("error" in e.data) { workerOff = true; lastMs = 0; compute(); }
        else { lastMs = e.data.ms; setResult(e.data.result); }
        drawAll();
        renderInfo(true);
      };
      worker.onerror = () => { workerOff = true; worker?.terminate(); worker = null; lastMs = 0; compute(); drawAll(); renderInfo(true); };
    }
    const m: SandboxAsk = { id: ++ask, layout: layout(), settings };
    if (workerCat !== cat) { m.cat = cat; workerCat = cat; }
    worker.postMessage(m);
  }
  function snap(): void {
    undo.push(JSON.stringify(S));
    if (undo.length > 200) undo.shift();
    redo = [];
  }
  function changed(): void {
    refreshCatalog();
    reindex();
    compute();
    store(KEY_STATE, S);
    drawAll();
    renderInfo(true);
    renderHint();
  }
  function apply(p: Plan): void {
    if (!p.remove.length && !p.add.length) return;
    snap();
    S = { ...applyPlan(layout(), p), fills: S.fills } as State;
    S.routes ??= [];
    if (ui.pinned != null && p.remove.includes(ui.pinned)) ui.pinned = null;
    changed();
  }

  // ------------------------------------------------------------ squelette
  function skeleton(): void {
    const k = (a: Action) => (KB[a] ? keyLabel(KB[a]!, LAB) : "—");
    root.innerHTML = `
<svg class="bac-map" id="bac-map" role="application" aria-label="${esc(t("bac.map.aria"))}">
  <defs>
    <pattern id="bac-cells" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".04"/></pattern>
    <pattern id="bac-over" width=".5" height=".5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".5" height=".5" fill="#c0392b"/><rect width=".25" height=".5" fill="#f5b041"/></pattern>
    <marker id="bac-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="#fff"/></marker>
  </defs>
  <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#bac-cells)"/>
  <g id="bac-layer"></g><g id="bac-over-l"></g><g id="bac-ghost"></g>
</svg>
<details class="bac-pan bac-stats" id="bac-stats" ${innerWidth > 760 ? "open" : ""}><summary>${ic("chart")} ${esc(t("bac.stats.title"))}</summary><div id="bac-stats-in"></div></details>
<div class="bac-pan bac-top" id="bac-top">
  <button type="button" id="bac-ex" aria-haspopup="listbox">${esc(t("bac.ex"))} ${ic("down")}</button>
  <button type="button" id="bac-keys">${ic("keyboard")} ${esc(t("bac.keys"))}</button>
  <button type="button" id="bac-undo" title="${esc(t("bac.undo"))}" aria-label="${esc(t("bac.undo"))}">${ic("undo")}</button>
  <button type="button" id="bac-redo" title="${esc(t("bac.redo"))}" aria-label="${esc(t("bac.redo"))}">${ic("redo")}</button>
  <button type="button" id="bac-set">${esc(t("bac.settings"))}</button>
  <button type="button" id="bac-clear">${esc(t("bac.clear"))}</button>
</div>
<div class="bac-pan bac-pf" id="bac-pf">
  <div class="bac-info" id="bac-info" aria-live="polite"></div>
  <div class="bac-pf-body">
    <div class="bac-pf-left">
      <div class="bac-filter" id="bac-filter" hidden></div>
      <div class="bac-grid" id="bac-grid" role="toolbar" aria-label="${esc(t("bac.grid.aria"))}"></div>
      <div class="bac-tools">
        <button type="button" id="bac-schem" title="${esc(t("bac.tool.schem", { k: k("schemMenu") }))}" aria-label="${esc(t("bac.tool.schem", { k: k("schemMenu") }))}">${ic("schem")}</button>
        <button type="button" id="bac-db" title="${esc(t("bac.tool.db"))}" aria-label="${esc(t("bac.tool.db"))}">${ic("db")}</button>
        <a href="#arbre" title="${esc(t("bac.tool.tree", { k: k("research") }))}" aria-label="${esc(t("bac.tool.tree", { k: k("research") }))}">${ic("tree")}</a>
        <button type="button" id="bac-vec" class="${ui.vec ? "on" : ""}" aria-pressed="${ui.vec}" title="${esc(t("bac.tool.links", { k: k("links") }))}" aria-label="${esc(t("bac.tool.links", { k: k("links") }))}">${ic("link")}</button>
      </div>
    </div>
    <div class="bac-col" id="bac-cats" role="toolbar" aria-label="${esc(t("bac.cats.aria"))}"></div>
    <div class="bac-col tiers" id="bac-tiers" role="toolbar" aria-label="${esc(t("bac.tiers.aria"))}"></div>
  </div>
</div>
<div class="bac-pan bac-mob" id="bac-mob" aria-label="${esc(t("bac.mob.aria"))}">
  <button type="button" data-mob="break" title="${esc(t("bac.mob.break"))}" aria-label="${esc(t("bac.mob.break"))}">${ic("break")}</button>
  <button type="button" data-mob="schem" title="${esc(t("bac.mob.schem"))}" aria-label="${esc(t("bac.mob.schem"))}">${ic("select")}</button>
  <button type="button" data-mob="rot" title="${esc(t("bac.mob.rot"))}" aria-label="${esc(t("bac.mob.rot"))}">${ic("rotate")}</button>
  <button type="button" data-mob="cancel" title="${esc(t("bac.mob.cancel"))}" aria-label="${esc(t("bac.mob.cancel"))}">${ic("close")}</button>
  <button type="button" data-mob="undo" title="${esc(t("bac.undo"))}" aria-label="${esc(t("bac.undo"))}">${ic("undo")}</button>
</div>
<div class="bac-pan bac-schbar" id="bac-schbar" hidden></div>
<div class="bac-hint" id="bac-hint"></div>
<div class="bac-toast" id="bac-toast" role="status"></div>
<div class="bac-dlg" id="bac-dlg" role="dialog" aria-modal="true" hidden><div class="in" id="bac-dlg-in"></div><button type="button" class="back" id="bac-dlg-back">${ic("back")} ${esc(t("bac.back"))}</button></div>`;
    root.classList.toggle("ui-off", ui.hidden);
    bindDom();
    renderPanel();
    applyView();
    drawAll();
    renderInfo(true);
    renderHint();
  }
  const $ = <T extends Element = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;

  // ------------------------------------------------------------ dessin
  const hasNodes = (b: Placed) => !!geo(cat.blocks.get(b.id)!, b)?.ports.some((p) => p.dir === "top");
  /** Dessin par bâtiment (B4) : seuls ceux dont l'état dessiné change sont refaits, dans l'ordre de pose. */
  let drawn = new Map<number, { sig: string; el: SVGGElement }>(), drawnCompact = false;
  const drawSig = (c: DrawCtx, b: Placed) => {
    const d = cat.blocks.get(b.id), mi = R?.machines.get(b.u);
    let s = `${b.id},${b.x},${b.y},${b.r},${b.open},${b.pair},${c.compact},${c.status}`;
    if (d?.pipe) for (const l of [0, 1]) { const L = laneMap.get(`${b.u}:${l}`); s += L ? `|${L.over},${L.item},${L.flow > 1e-9}` : "|"; }
    else {
      // les images peuvent arriver après le premier dessin
      s += `|${c.img("machine", b.id)},${d?.recipes.length},${d?.incomplete.length}`;
      if (mi) s += `|${mi.rec?.id},${mi.rec && c.img("objet", Object.keys(mi.rec.out)[0] ?? "")},${mi.cand.length},${Math.round(mi.f * 100)},${mi.f > 0.999},${mi.f < 0.999},${mi.reason?.k}`;
    }
    return s;
  };
  function drawAll(): void {
    if (!ui.mounted) return;
    const c = dctx(), layer = $("bac-layer"), seen = new Set<number>();
    drawnCompact = !!c.compact;
    if (layer.dataset.n !== "1") { layer.textContent = ""; drawn = new Map(); layer.dataset.n = "1"; } // squelette refait
    let prev: Element | null = null;
    for (const b of S.blocks) {
      seen.add(b.u);
      let d = drawn.get(b.u);
      if (!d) { d = { sig: "", el: document.createElementNS("http://www.w3.org/2000/svg", "g") }; drawn.set(b.u, d); }
      const sig = drawSig(c, b);
      if (d.sig !== sig) { d.el.innerHTML = blockMarkup({ ...c, mi: R?.machines.get(b.u) }, b); d.sig = sig; }
      const want: ChildNode | null = prev ? prev.nextSibling : layer.firstChild;
      if (want !== d.el) layer.insertBefore(d.el, want);
      prev = d.el;
    }
    for (const [u, d] of drawn) if (!seen.has(u)) { d.el.remove(); drawn.delete(u); }
    let o = "";
    if (ui.vec) o += linksMarkup();
    if (ui.wires) for (const w of S.wires) {
      const A = byU.get(w.a), B = byU.get(w.b), pa = A && geo(cat.blocks.get(A.id)!, A)?.ports[w.ia], pb = B && geo(cat.blocks.get(B.id)!, B)?.ports[w.ib];
      if (!pa || !pb) continue;
      const mx = (pa.px! + pb.px!) / 2, my = (pa.py! + pb.py!) / 2;
      o += `<line x1="${pa.px}" y1="${pa.py}" x2="${pb.px}" y2="${pb.py}" stroke="${PORT_COL[w.t]}" stroke-width=".08" stroke-opacity=".85"/><line x1="${pa.px}" y1="${pa.py}" x2="${mx}" y2="${my}" stroke="${PORT_COL[w.t]}" stroke-width=".08" marker-end="url(#bac-ar)"/>`;
    }
    $("bac-over-l").innerHTML = o;
    renderStats();
    drawGhost();
  }
  /** Outil Liaisons : chaque raccord. Machine → tuyau ou machine : flèche dans le sens du flux ; tuyau ↔ tuyau : un trait de la couleur de l'objet. */
  function linksMarkup(): string {
    let o = "";
    const arrow = (a: [number, number], b: [number, number], col: string, dash: boolean) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width=".09" marker-end="url(#bac-ar)" ${dash ? 'stroke-dasharray=".14 .1"' : ""}/>`;
    for (const l of links(cat, layout())) {
      const A = byU.get(l.a)!, B = byU.get(l.b)!, pipeA = !!cat.blocks.get(A.id)!.pipe, pipeB = !!cat.blocks.get(B.id)!.pipe;
      const ea = portEdge(l.pa), [dx, dy] = [ea[0] - (l.pa.cells![0]![0] + 0.5), ea[1] - (l.pa.cells![0]![1] + 0.5)];
      const inA: [number, number] = [ea[0] - dx * 0.9, ea[1] - dy * 0.9], inB: [number, number] = [ea[0] + dx * 0.9, ea[1] + dy * 0.9];
      const lane = pipeA ? laneMap.get(`${l.a}:0`) : laneMap.get(`${l.b}:0`), col = lane?.item ? `hsl(${hue(lane.item)} 85% 65%)` : "#bbb";
      if (pipeA && pipeB) o += `<line x1="${inA[0]}" y1="${inA[1]}" x2="${inB[0]}" y2="${inB[1]}" stroke="${col}" stroke-width=".09"/>`;
      else if (!pipeA) o += l.pa.d === "s" ? arrow(inA, inB, col, false) : arrow(inB, inA, col, false);
      else o += l.pb.d === "s" ? arrow(inB, inA, col, false) : arrow(inA, inB, col, false);
    }
    for (const r of machineLinks(cat, layout())) {
      const A = byU.get(r.a)!, B = byU.get(r.b)!, pa = geo(cat.blocks.get(A.id)!, A)!.ports[r.ia]!, pb = geo(cat.blocks.get(B.id)!, B)!.ports[r.ib]!;
      const a = portEdge(pa), b = portEdge(pb), ca: [number, number] = [pa.cells![0]![0] + 0.5, pa.cells![0]![1] + 0.5], cb: [number, number] = [pb.cells![0]![0] + 0.5, pb.cells![0]![1] + 0.5];
      o += arrow([(a[0] + ca[0]) / 2, (a[1] + ca[1]) / 2], [(b[0] + cb[0]) / 2, (b[1] + cb[1]) / 2], r.auto ? "#9ad" : "#ffd37f", r.auto);
    }
    return o;
  }
  function drawGhost(): void {
    if (!ui.mounted) return;
    frameGhost = false;
    let s = "";
    const c = ui.cell, d = dctx();
    const hb = ui.hoverU ?? ui.pinned;
    if (hb != null && byU.has(hb) && !ui.sel) {
      const b = byU.get(hb)!, [w, h] = dims(cat.blocks.get(b.id)!, b.r);
      s += rect([b.x, b.y, w, h], "none", `stroke="#ffd37f" stroke-width=".08"`);
    }
    if (ui.pinned != null && byU.has(ui.pinned) && !ui.sel) { const b = byU.get(ui.pinned)!; s += rangeMarkup(d, deps.mods, S.blocks, b.id, b.x, b.y, b.r, hasNodes); }
    if (ui.sel && !ui.sel.locked && !ui.op) { const a = anchor(cat.blocks.get(ui.sel.v)!, c, ui.rot); s += rangeMarkup(d, deps.mods, S.blocks, ui.sel.v, a[0], a[1], ui.rot, hasNodes); }
    // Liaison en cours : le port de départ, et les ports qu'on peut viser.
    if (ui.routeFrom) {
      const b = byU.get(ui.routeFrom.u), p = b && geo(cat.blocks.get(b.id)!, b)?.ports[ui.routeFrom.i];
      if (p?.cells) for (const [x, y] of p.cells) s += rect([x + 0.05, y + 0.05, 0.9, 0.9], "none", `stroke="#ffd37f" stroke-width=".1"`);
    }
    const op = ui.op;
    if (op?.t === "break") {
      const s0 = op.moved ? op.s : c, x0 = Math.min(s0[0], c[0]), x1 = Math.max(s0[0], c[0]), y0 = Math.min(s0[1], c[1]), y1 = Math.max(s0[1], c[1]);
      for (const b of S.blocks) {
        const def = cat.blocks.get(b.id)!, cs = cellsOf(def, b).filter(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
        if (!cs.length) continue;
        if (def.pipe && Math.max(...dims(def, b.r)) > 1 && Math.min(...dims(def, b.r)) === 1) for (const [x, y] of cs) s += rect([x, y, 1, 1], "none", `stroke="#e55454" stroke-width=".08"`);
        else { const [w, h] = dims(def, b.r); s += rect([b.x, b.y, w, h], "none", `stroke="#e55454" stroke-width=".08"`); }
      }
      if (op.moved) s += rect([x0, y0, x1 - x0 + 1, y1 - y0 + 1], "rgba(229,84,84,.18)", `stroke="#e55454" stroke-width=".08"`);
    }
    if (op?.t === "schem") {
      const x0 = Math.min(op.s[0], c[0]), x1 = Math.max(op.s[0], c[0]), y0 = Math.min(op.s[1], c[1]), y1 = Math.max(op.s[1], c[1]);
      s += rect([x0, y0, x1 - x0 + 1, y1 - y0 + 1], "rgba(255,211,127,.12)", `stroke="#ffd37f" stroke-width=".08"`);
    }
    if (ui.clip) {
      const a = [c[0] - Math.floor(ui.clip.W / 2), c[1] - Math.floor(ui.clip.H / 2)] as const;
      for (const it of ui.clip.items) {
        const b: Placed = { u: -1, id: it.id, x: a[0] + it.dx, y: a[1] + it.dy, r: it.r };
        s += `<g opacity=".55">${blockMarkup(d, b)}</g>` + (fitsAt(b.id, b.x, b.y, b.r) ? "" : rect([b.x, b.y, ...dims(cat.blocks.get(b.id)!, b.r)], "rgba(229,84,84,.35)"));
      }
    } else if (op?.t === "port") {
      const p = op.moved ? tracePlan(op.s, c, op.fam) : null;
      if (p?.bad) for (const [x, y] of p.bad) s += rect([x + 0.1, y + 0.1, 0.8, 0.8], "rgba(229,84,84,.45)");
      else if (p) {
        for (const u of p.remove) { const b = byU.get(u); if (b) for (const [x, y] of cellsOf(cat.blocks.get(b.id)!, b)) s += rect([x, y, 1, 1], "rgba(0,0,0,.45)"); }
        for (const b of p.add) s += `<g opacity=".7">${blockMarkup(d, { ...b, u: -1 })}</g>`;
      }
    } else if (ui.sel && !ui.sel.locked && !(op && op.t !== "line")) {
      const p = op?.t === "line" ? planFor(op.s, c) : planFor(c, c);
      if (p.bad) for (const [x, y] of p.bad) s += rect([x + 0.1, y + 0.1, 0.8, 0.8], "rgba(229,84,84,.45)");
      else {
        for (const u of p.remove) { const b = byU.get(u); if (b) for (const [x, y] of cellsOf(cat.blocks.get(b.id)!, b)) s += rect([x, y, 1, 1], "rgba(0,0,0,.45)"); }
        for (const b of p.add) s += `<g opacity=".7">${blockMarkup(d, { ...b, u: -1 })}</g>`;
        for (const b of p.invalid ?? []) s += `<g opacity=".5">${blockMarkup(d, { ...b, u: -1 })}</g>` + rect([b.x, b.y, ...dims(cat.blocks.get(b.id)!, b.r)], "rgba(229,84,84,.4)");
      }
    }
    $("bac-ghost").innerHTML = s;
  }

  // ------------------------------------------------------------ pose
  function fitsAt(id: string, x: number, y: number, r: number, ignore?: number): boolean {
    const [w, h] = dims(cat.blocks.get(id)!, r);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = occ.get(cellKey(x + i, y + j)); if (u != null && u !== ignore) return false; }
    return true;
  }
  const isTraced = (e: Entry) => !!e.fam && e.fam !== "f4";
  /** Famille tracée depuis un port libre : la dernière choisie de ce type, sinon le tier I. */
  const lastFam: Record<"o" | "f", Fam> = { o: "o1", f: "f1" };
  const famFor = (k: string): Fam => lastFam[k === "f" ? "f" : "o"];
  /** Tracé glissé d'un tuyau de la famille `fam` (A* ; Ctrl : ligne droite) ; `lenMax` : longueur auto décochée. */
  function tracePlan(s: [number, number], c: [number, number], fam: Fam, lenMax = Infinity): PlanView {
    const path = (ui.ctrl ? null : pipePath(cat, layout(), s, c, FAMS[fam].kind as "o" | "f")) ?? straightPath(s, c);
    return pipePlan(cat, layout(), path, fam, lenMax, ui.rot % 2 ? "H" : "V") ?? { remove: [], add: [], bad: path };
  }
  function planFor(s: [number, number], c: [number, number]): PlanView {
    const { e, v } = ui.sel!, def = cat.blocks.get(v)!;
    if (isTraced(e)) {
      if (c[0] === s[0] && c[1] === s[1]) { const a = anchor(def, c, ui.rot); return explicitPlan(cat, layout(), v, a[0], a[1], ui.rot) ?? { remove: [], add: [], bad: [c] }; }
      return tracePlan(s, c, e.fam as Fam, ui.auto ? Infinity : def.pipe!.role === "droit" ? def.pipe!.len : 1);
    }
    const all = linePositions(def, s, c, ui.rot), ok = all.filter((b) => fitsAt(b.id, b.x, b.y, b.r));
    return { remove: [], add: ok.map((b) => ({ ...b, choice: ui.choice?.id === v ? ui.choice.c : null })), invalid: all.filter((b) => !ok.includes(b)) };
  }

  // ------------------------------------------------------------ menu de pose
  function renderPanel(): void {
    if (!ui.mounted) return;
    const d = dctx();
    $("bac-tiers").innerHTML = TIERS.map((tr) => `<button type="button" class="bac-b ${ui.tier === tr ? "on" : ""}" data-tier="${tr}" aria-pressed="${ui.tier === tr}" title="${esc(t("bac.tier", { t: ROMAN[tr]! }))}">${ROMAN[tr]}</button>`).join("");
    $("bac-cats").innerHTML = CATS.map((c) => {
      const has = entriesFor(cat, menu, ui.tier, c.id).length;
      if (!has && SET.hideEmptyCats) return "";
      const nm = t(`bac.cat.${c.id}` as Key);
      return `<button type="button" class="bac-b ${ui.cat === c.id && !ui.filter ? "on" : ""}" ${has ? "" : "disabled"} data-cat="${c.id}" aria-pressed="${ui.cat === c.id}" title="${esc(nm)}" aria-label="${esc(nm)}">${ic(c.ic)}</button>`;
    }).join("");
    const list = ui.filter
      ? ui.filter.ids.map((id) => menu.entries.find((e) => e.def === id && !e.fam)).filter((e): e is Entry => !!e)
      : entriesFor(cat, menu, ui.tier, ui.cat);
    $("bac-grid").innerHTML = list.length
      ? list.map((e) => {
        const v = ui.sel?.e === e ? ui.sel.v : e.def, nm = entryName(e);
        return `<button type="button" class="bac-blk ${locked(cat, e.def) ? "locked" : ""} ${ui.sel?.e === e ? "on" : ""}" data-key="${esc(e.key)}" aria-pressed="${ui.sel?.e === e}" aria-label="${esc(nm)}">${blockIcon(d, v, 34)}</button>`;
      }).join("")
      : `<p class="bac-empty">${esc(t("bac.filter.none"))}</p>`;
    const f = $("bac-filter");
    f.hidden = !ui.filter;
    if (ui.filter) f.innerHTML = `${ic("filter")} <span>${esc(ui.filter.title)}</span><button type="button" data-filter-x title="${esc(t("bac.filter.clear"))}" aria-label="${esc(t("bac.filter.clear"))}">${ic("close")}</button>`;
    pfHeight();
  }
  /**
   * Hauteur du menu de pose, pour placer la barre d'aide (B4) : lue une fois par image et écrite seulement si
   * elle change, car toucher une variable CSS de la page refait le style de tout le plan.
   */
  let pfRaf = 0, pfh = -1;
  function pfHeight(): void {
    if (pfRaf) return;
    pfRaf = requestAnimationFrame(() => {
      pfRaf = 0;
      const h = $("bac-pf").offsetHeight;
      if (h !== pfh) { pfh = h; root.style.setProperty("--bac-pfh", `${h}px`); }
    });
  }
  const entryName = (e: Entry) => (e.fam ? t(`bac.fam.${FAMS[e.fam].kind}` as Key, { t: ROMAN[FAMS[e.fam].tier]! }) : names.block(e.def));
  function setTier(tr: number): void {
    ui.tier = tr;
    ui.filter = null;
    if (!entriesFor(cat, menu, tr, ui.cat).length) ui.cat = CATS.find((c) => entriesFor(cat, menu, tr, c.id).length)?.id ?? ui.cat;
    renderPanel();
  }
  function select(e: Entry | undefined, v?: string): void {
    if (!e) return;
    if (ui.sel?.e === e && !v) ui.sel = null;
    else {
      ui.sel = { e, v: v ?? (ui.sel?.e === e ? ui.sel.v : e.def), locked: locked(cat, e.def) };
      ui.clip = null;
      ui.pinned = null;
      ui.routeFrom = null;
      if (isTraced(e)) lastFam[FAMS[e.fam!].kind] = e.fam as Fam;
      if (e.tier != null) ui.tier = e.tier;
      if (!ui.filter) ui.cat = e.cat;
    }
    renderPanel();
    renderInfo(true);
    drawGhost();
    renderHint();
  }

  // ------------------------------------------------------------ cadre d'infos
  let infoSig = "";
  const editorLink = (id: string) => (!deps.inEditor(id)
    ? `<span class="muted">${esc(t("bac.editor.none", { name: names.block(id) }))}</span>`
    : `<a href="#contribuer/batiments/${encodeURIComponent(id)}">${esc(cat.blocks.get(id)?.geo ? t("bac.editor.edit") : t("bac.editor.complete", { name: names.block(id) }))} ${ic("next")}</a>`);
  function head(id: string, name: string, sc: string | null, q: boolean): string {
    return `<div class="i-head">${blockIcon(dctx(), id, 32)}<div><b>${esc(name)}</b>${sc ? `<small>${esc(t("bac.shortcut", { sc }))}</small>` : ""}</div>${q ? `<button type="button" class="i-q" data-info="${esc(id)}" title="${esc(t("bac.info.more"))}" aria-label="${esc(t("bac.info.more"))}">?</button>` : ""}</div>`;
  }
  function portLine(p: PlacedPort, pipe = false): string {
    const role = t(`bac.port.${p.d}` as Key), type = t(`bac.ptype.${p.t}` as Key);
    const what = p.items?.length ? `${colon()}${p.items.map(names.item).join(", ")}` : p.tip ? `${colon()}${quote(p.tip)}` : !pipe && (p.t === "o" || p.t === "f") ? ` ${t("bac.port.noTip")}` : "";
    return `${role} ${type}${what}`;
  }
  /** Port sous le curseur (le bord d'une case de machine), ou null. */
  function portUnder(): (PortRef & { p: PlacedPort }) | null {
    const u = occ.get(cellKey(...ui.cell));
    if (u == null) return null;
    const b = byU.get(u)!, def = cat.blocks.get(b.id)!, g = geo(def, b);
    if (!g || def.pipe) return null;
    const wx = ui.cell[0] + ui.sub[0], wy = ui.cell[1] + ui.sub[1];
    let best: (PortRef & { p: PlacedPort }) | null = null, bd = 0.36;
    g.ports.forEach((p, i) => {
      if (!p.cells || !p.cells.some(([x, y]) => x === ui.cell[0] && y === ui.cell[1])) return;
      const [ex, ey] = portEdge(p), dd = Math.hypot(wx - ex, wy - ey);
      if (dd < bd) { bd = dd; best = { u, i, p }; }
    });
    return best;
  }
  /** Port libre : rien du même type ne lui fait face. */
  function portFree(p: PlacedPort): boolean {
    const fk = facingKey(p);
    for (const b of S.blocks) { const g = geo(cat.blocks.get(b.id)!, b); if (g?.ports.some((q) => q.cells && q.t === p.t && portKey(q.cells, q.dir as Dir) === fk)) return false; }
    return true;
  }
  const hasContact = (u: number, t2: string) => contacts(cat, layout()).some((c) => (c.a === u || c.b === u) && c.t === t2);

  function renderInfo(force = false): void {
    if (!ui.mounted || (pop && !force)) return;
    const tg = ui.hoverBtn ? { k: "e" as const, e: menu.byKey.get(ui.hoverBtn)! } : ui.sel ? { k: "e" as const, e: ui.sel.e }
      : ui.hoverU != null && byU.has(ui.hoverU) ? { k: "b" as const, u: ui.hoverU, pin: false } : ui.pinned != null && byU.has(ui.pinned) ? { k: "b" as const, u: ui.pinned, pin: true } : null;
    const pu = tg?.k === "b" ? portUnder() : null;
    const sig = JSON.stringify([tg, ui.sel?.v, ui.auto, pu && [pu.u, pu.i], ui.routeFrom, R?.machines.size, undo.length, redo.length]);
    if (!force && sig === infoSig) return;
    infoSig = sig;
    closePop();
    const el = $("bac-info");
    if (!tg) { el.innerHTML = ""; pfHeight(); return; }
    let h = "";
    if (tg.k === "e") {
      const e = tg.e, v = ui.sel?.e === e ? ui.sel.v : e.def, d = cat.blocks.get(v)!, lk = locked(cat, v);
      h += head(v, e.fam ? `${entryName(e)} · ${d.name}` : d.name, shortcut(cat, menu, e), true);
      if (lk) h += `<div class="i-line warn">${ic("warn")} ${esc(t(e.fam ? "bac.locked.piece" : "bac.locked.block"))}</div><div class="i-btns">${editorLink(v)}</div>`;
      const facts = [d.geo ? t("bac.size", { w: dims(d, 0)[0], h: dims(d, 0)[1] }) : "", fmtMoney(d.cost), d.pipe?.flow != null ? t("bac.flow.max", { v: fmt(d.pipe.flow, 2) }) : "", d.recipes.length ? t("bac.recipes.n", { n: d.recipes.length }) : ""].filter(Boolean);
      h += `<div class="i-line">${esc(facts.join(" · "))}</div>`;
      if (e.fam) {
        h += `<div class="i-var">${menu.variants[e.fam].map((id) => `<button type="button" class="${id === v ? "on" : ""} ${locked(cat, id) ? "locked" : ""}" data-var="${esc(id)}" aria-pressed="${id === v}" title="${esc(names.block(id) + (locked(cat, id) ? ` ${t("bac.var.locked")}` : "") + (cat.blocks.get(id)!.pipe!.rusty ? ` ${t("bac.var.rusty")}` : ""))}">${blockIcon(dctx(), id, 26)}</button>`).join("")}</div>`;
        if (isTraced(e)) h += `<label class="i-chk"><input type="checkbox" id="bac-auto" ${ui.auto ? "checked" : ""}> ${esc(t("bac.auto"))}${droitLens(cat, e.fam as Fam).length < 2 ? ` <span class="muted">${esc(t("bac.auto.short"))}</span>` : ""}</label>`;
      }
    } else {
      const b = byU.get(tg.u)!, d = cat.blocks.get(b.id)!;
      h += head(b.id, d.name, null, true);
      const g = geo(d, b);
      if (g) {
        const [cx, cy] = ui.cell, ps = g.ports.map((p, i) => ({ p, i })).filter(({ p }) => (p.cells ? p.cells.some(([x, y]) => x === cx && y === cy) : Math.floor(p.px!) === cx && Math.floor(p.py!) === cy));
        for (const { p, i } of ps) {
          const near = pu?.i === i && pu.u === tg.u;
          h += `<div class="i-line ${near ? "i-port" : ""}"><b>${esc(t("bac.port"))}</b> (${esc(t(SIDE_KEY[p.dir]!))}${(p.cells?.length ?? 0) > 1 ? `, ${esc(t("bac.port.wide"))}` : ""})${esc(colon())}${esc(portLine(p, !!d.pipe))}</div>`;
          if (near && !d.pipe && p.cells && (p.t === "o" || p.t === "f")) h += `<div class="i-line muted">${esc(hasContact(tg.u, p.t) ? t("bac.port.hint.route") : portFree(p) ? t("bac.port.hint.free") : "")}</div>`;
        }
        if (hasNodes(b)) {
          const n = S.wires.filter((w) => w.a === tg.u || w.b === tg.u).length;
          h += `<div class="i-line muted">${esc([t("bac.wires.n", { n }), d.elec?.range ? t("bac.range", { v: fmt(d.elec.range, 1) }) : "", tg.pin ? t("bac.wires.hint") : ""].filter(Boolean).join(" · "))}</div>`;
        }
      }
      if (d.pipe) {
        if (b.open) h += `<div class="i-line warn">${ic("warn")} ${esc(t("bac.piece.open"))}</div><div class="i-btns">${editorLink(b.id)}</div>`;
        const ls = d.pipe.role === "croisement" ? [0, 1] : [0];
        for (const l of ls) {
          const L = laneMap.get(`${b.u}:${l}`);
          const what = L?.item ? t("bac.lane.carries", { item: names.item(L.item) }) : L?.mixed ? t("bac.lane.mixed") : t("bac.lane.empty");
          const sides = CROSS_PAIRS[d.pipe.kind === "m" ? 0 : b.pair ?? 0][l as 0 | 1].map((x) => t(`bac.dir.${x}` as Key)).join("-");
          h += `<div class="i-line">${ls.length > 1 ? `${esc(t("bac.lane", { sides }))}${esc(colon())}` : ""}${esc(what)} · ${esc(t("bac.lane.flow", { f: fmt(L?.flow ?? 0, 2), cap: fmt(d.pipe.flow ?? 0, 2) }))}${L?.over ? ` · <span class="warn">${esc(t("bac.lane.over", { v: fmt(L.offered, 2) }))}</span>` : ""}</div>`;
        }
        if (d.pipe.role === "croisement" && d.pipe.kind !== "m") {
          const cur = b.pair ?? 0;
          h += `<div class="i-line">${esc(t("bac.pair"))}</div><div class="i-btns" role="group" aria-label="${esc(t("bac.pair"))}">${([0, 1, 2] as const).map((k) => `<button type="button" data-pair="${k}" aria-pressed="${cur === k}" class="${cur === k ? "on" : ""}">${esc(t(`bac.pair.${k}` as Key))}</button>`).join("")}</div>`;
        }
      } else {
        const mi = R?.machines.get(tg.u);
        if (mi && (d.recipes.length || d.incomplete.length)) {
          if (d.recipes.length + d.incomplete.length > 1 || b.choice || d.incomplete.length) {
            const cur = mi.rec ? recipeLine(mi.rec, names.item) + (mi.rec.filled ? ` ${t("bac.rec.filled")}` : "") : t("bac.rec.choose");
            h += `<button type="button" class="i-sel" id="bac-rec" aria-haspopup="listbox" aria-expanded="false"><span>${esc(cur)}</span>${ic("down")}</button>`;
          } else if (mi.rec) h += `<div class="i-line">${esc(t("bac.rec", { r: recipeLine(mi.rec, names.item) }))}</div>`;
          h += mi.rec
            ? `<div class="i-line">${esc(t("bac.run"))} <b>${esc(fmtPct(String(Math.round(mi.f * 100))))}</b>${mi.reason ? ` · <span class="warn">${esc(reasonText(mi.reason, names))}</span>` : ""} · ${esc(fmt((mi.rec.e ?? 0) * mi.f, 0))} MF/s</div>`
            : mi.reason ? `<div class="i-line warn">${esc(reasonText(mi.reason, names))}</div>` : "";
          if (mi.rec?.filled) h += `<div class="i-btns"><button type="button" data-act="propose">${esc(t("bac.rec.propose"))}</button></div>`;
        }
      }
      h += `<div class="i-btns"><button type="button" data-act="rot">${esc(t("bac.rotate", { k: KB.rotate ? keyLabel(KB.rotate, LAB) : "—" }))}</button><button type="button" data-act="del">${esc(t("bac.delete"))}</button></div>`;
    }
    el.innerHTML = h;
    pfHeight();
  }
  const target = () => ui.pinned ?? ui.hoverU;

  // ------------------------------------------------------------ menu déroulant maison (survole la page)
  let pop: HTMLElement | null = null, popAnchor: HTMLElement | null = null;
  function closePop(): void {
    pop?.remove();
    popAnchor?.setAttribute("aria-expanded", "false");
    pop = popAnchor = null;
  }
  /** Liste flottante par-dessus la page, sous (ou au-dessus de) son bouton ; fermée au clic ailleurs ou par Échap. */
  function openPop(anchorEl: HTMLElement, html: string, onPick: (el: HTMLElement) => void): void {
    closePop();
    const el = document.createElement("div");
    el.className = "bac-pop";
    el.setAttribute("role", "listbox");
    el.innerHTML = html;
    root.append(el);
    const r = anchorEl.getBoundingClientRect(), below = innerHeight - r.bottom - 8, above = r.top - 8, up = el.offsetHeight > below && above > below;
    el.style.minWidth = `${Math.min(r.width, innerWidth - 16)}px`;
    el.style.maxHeight = `${Math.max(120, up ? above : below)}px`;
    el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8))}px`;
    el.style.top = up ? `${Math.max(8, r.top - Math.min(el.offsetHeight, above) - 4)}px` : `${r.bottom + 4}px`;
    pop = el;
    popAnchor = anchorEl;
    anchorEl.setAttribute("aria-expanded", "true");
    el.addEventListener("click", (e) => { const o = (e.target as HTMLElement).closest<HTMLElement>("[data-opt]"); if (o) { const keep = o; closePop(); onPick(keep); } });
    el.addEventListener("keydown", (e) => {
      const opts = [...el.querySelectorAll<HTMLElement>("[data-opt]")], i = opts.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); opts[(i + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length]?.focus(); }
    });
    (el.querySelector<HTMLElement>("[aria-selected=true]") ?? el.querySelector<HTMLElement>("[data-opt]"))?.focus();
  }
  function recipeMenu(anchorEl: HTMLElement): void {
    const u = target();
    if (u == null) return;
    const b = byU.get(u)!, d = cat.blocks.get(b.id)!, mi = R?.machines.get(u);
    const cand = mi?.cand ?? d.recipes;
    const opt = (v: string, label: string, sel: boolean, extra = "") => `<button type="button" role="option" data-opt="${esc(v)}" aria-selected="${sel}" class="${sel ? "on" : ""}">${esc(label)}${extra}</button>`;
    let h = opt("", t("bac.rec.choose"), !b.choice);
    for (const r of cand) h += opt(r.id, recipeLine(r, names.item), mi?.rec?.id === r.id, r.filled ? ` <small class="tag">${esc(t("bac.rec.filled"))}</small>` : "");
    for (const r of d.incomplete) h += opt(`inc:${r.id}`, recipeLine(r, names.item), false, ` <small class="tag warn">${esc(t("bac.rec.toFill"))}</small>`);
    openPop(anchorEl, h, (o) => {
      const v = o.dataset.opt!;
      if (v.startsWith("inc:")) return fillDialog(u, d.incomplete.find((r) => r.id === v.slice(4))!);
      snap();
      b.choice = v || null;
      changed();
    });
  }

  // ------------------------------------------------------------ fenêtres
  let dlgBack: (() => void) | null = null;
  function openDlg(h: string, back: (() => void) | null = null): void {
    closePop();
    dlgBack = back;
    $("bac-dlg-in").innerHTML = h;
    $("bac-dlg").hidden = false;
    $("bac-dlg").scrollTop = 0;
    $<HTMLElement>("bac-dlg-back").focus();
  }
  const closeDlg = () => { $("bac-dlg").hidden = true; dlgBack = null; kbArm = null; kbPick = null; };
  /** Fiche de complétion d'une recette incomplète : durée et quantités manquantes, saisies par le joueur. */
  function fillDialog(u: number, r: SbIncomplete, err = ""): void {
    const f = S.fills[r.id] ?? {}, v = (n: number | undefined) => (n != null ? fmt(n, 4) : "");
    const field = (k: string) => {
      const [side, item] = k.split(".") as ["s" | "in" | "out", string?];
      const label = side === "s" ? t("bac.fill.s") : t(side === "in" ? "bac.fill.in" : "bac.fill.out", { item: names.item(item!) });
      const cur = side === "s" ? f.s : f[side]?.[item!];
      return `<label class="row"><span class="grow">${esc(label)}</span><input data-fill="${esc(k)}" inputmode="decimal" value="${esc(v(cur))}" size="8"></label>`;
    };
    openDlg(`<div class="ttl">${esc(t("bac.fill.title"))}</div><p>${esc(names.block(cat.blocks.get(byU.get(u)!.id)!.id))}${esc(colon())}${esc(recipeLine(r, names.item))}</p><p class="muted">${esc(t("bac.fill.lead"))}</p>`
      + `<form id="bac-fill" data-u="${u}" data-r="${esc(r.id)}">${r.missing.map(field).join("")}${err ? `<p class="warn" role="alert">${esc(err)}</p>` : ""}<div class="row"><button type="submit" class="primary">${esc(t("bac.fill.ok"))}</button></div></form>`);
    root.querySelector<HTMLInputElement>("[data-fill]")?.focus();
  }
  function submitFill(form: HTMLFormElement): void {
    const u = Number(form.dataset.u), rid = form.dataset.r!, b = byU.get(u), r = b && cat.blocks.get(b.id)!.incomplete.find((x) => x.id === rid);
    if (!b || !r) return closeDlg();
    const fill: RecipeFill = { ...(S.fills[rid] ?? {}) };
    for (const inp of form.querySelectorAll<HTMLInputElement>("[data-fill]")) {
      const n = parseNum(inp.value), [side, item] = inp.dataset.fill!.split(".") as ["s" | "in" | "out", string?];
      if (!(n > 0)) return fillDialog(u, r, t("bac.fill.err"));
      if (side === "s") fill.s = n;
      else fill[side] = { ...(fill[side] ?? {}), [item!]: n };
    }
    if (stillMissing(r, fill).length) return fillDialog(u, r, t("bac.fill.err"));
    snap();
    S.fills = { ...S.fills, [rid]: fill };
    b.choice = rid;
    closeDlg();
    changed();
  }
  function settingsDlg(): void {
    const c = (k: keyof Settings) => `<label class="row"><input type="checkbox" data-set="${k}" ${SET[k] ? "checked" : ""}> <span><b>${esc(t(`bac.set.${k}` as Key))}</b><br><span class="muted">${esc(t(`bac.set.${k}.d` as Key))}</span></span></label>`;
    openDlg(`<div class="ttl">${esc(t("bac.settings"))}</div>${c("hideEmptyCats")}${c("runWithoutPower")}`);
  }
  function blockInfo(id: string, back: (() => void) | null = null): void {
    const d = cat.blocks.get(id)!, m = deps.meta(id), cn = CATS.find((c) => c.id === (d.pipe ? "Pipes" : deps.category(id)));
    let h = `<div class="ttl">${blockIcon(dctx(), id, 40)} ${esc(d.name)}</div>`;
    if (m.desc) h += `<h3>${esc(t("bac.db.desc"))}</h3><div class="kv"><div>${esc(m.desc)}</div></div>`;
    h += `<h3>${esc(t("bac.db.facts"))}</h3><div class="kv"><div>${esc(t("bac.db.size"))}${esc(colon())}${d.geo ? esc(t("bac.size", { w: d.geo.w, h: d.geo.h })) : `<span class="warn">${esc(t("bac.db.noGeo"))}</span>`}</div><div>${esc(t("bac.db.price"))}${esc(colon())}${esc(fmtMoney(d.cost))}</div><div>${esc(t("bac.db.tier"))}${esc(colon())}${d.tier ? ROMAN[d.tier] : esc(t("bac.db.noTier"))}</div>${cn ? `<div>${esc(t("bac.db.cat"))}${esc(colon())}${esc(t(`bac.cat.${cn.id}` as Key))}</div>` : ""}${m.unlock ? `<div>${esc(t("bac.db.unlock"))}${esc(colon())}${esc(m.unlock)}</div>` : ""}${d.poll ? `<div>${esc(t("bac.db.poll"))}${esc(colon())}${esc(fmt(d.poll, 2))} %/h</div>` : ""}</div>`;
    if (d.pipe) h += `<h3>${esc(t("bac.db.pipe"))}</h3><div class="kv"><div>${esc(t("bac.flow.max", { v: d.pipe.flow != null ? fmt(d.pipe.flow, 2) : "?" }))}</div><div>${esc(t(`bac.role.${d.pipe.role}` as Key))}${d.pipe.role === "droit" ? `, ${esc(t("bac.cells", { n: d.pipe.len }))}` : ""}</div>${d.pipe.rusty ? `<div class="warn">${esc(t("bac.var.rusty"))}</div>` : ""}</div>`;
    if (d.geo?.ports.length) h += `<h3>${esc(t("bac.db.ports"))}</h3><div class="kv">${d.geo.ports.map((p) => `<div>${esc(t(`bac.port.${d.pipe && p.d !== "e" && p.d !== "s" ? "l" : p.d}` as Key))} ${esc(t(`bac.ptype.${p.t}` as Key))}${esc(colon())}${esc(t(SIDE_KEY[p.s]!))}${p.c ? `, ${esc(t("bac.db.cell", { n: p.c }))}` : ""}${p.tip ? ` — <i>${esc(quote(p.tip))}</i>` : ""}</div>`).join("")}</div>`;
    const rows = [...d.recipes, ...d.incomplete];
    if (rows.length) {
      const side = (o: Record<string, number | null>, s: number | null) => Object.entries(o).map(([i, q]) => `${q == null ? "?" : esc(fmt(q, 2))} ${esc(names.item(i))}${q != null && s ? ` <span class="muted">${esc(fmt(q / s, 3))}/s</span>` : ""}`).join("<br>") || "—";
      h += `<h3>${esc(t("bac.db.make"))}</h3><table><tr><th>${esc(t("bac.db.in"))}</th><th>${esc(t("bac.db.out"))}</th><th>${esc(t("bac.db.time"))}</th><th>${esc(t("bac.db.energy"))}</th></tr>${rows.map((r) => `<tr><td>${side(r.in, r.s)}</td><td>${side(r.out, r.s)}${"missing" in r ? ` <small class="warn">${esc(t("bac.rec.toFill"))}</small>` : ""}</td><td>${r.s == null ? "?" : esc(fmt(r.s, 2))} s</td><td>${r.e == null ? "?" : esc(fmt(r.e, 0))} MF/s</td></tr>`).join("")}</table>`;
    }
    h += `<p>${editorLink(id)}</p>`;
    openDlg(h, back);
  }
  function openDb(): void {
    openDlg(`<div class="ttl">${ic("db")} ${esc(t("bac.tool.db"))}</div>` + CATS.map((c) => {
      const bs = [...cat.blocks.values()].filter((b) => (b.pipe ? "Pipes" : deps.category(b.id)) === c.id);
      return bs.length ? `<h3>${ic(c.ic)} ${esc(t(`bac.cat.${c.id}` as Key))}</h3><div class="db">${bs.map((b) => `<button type="button" class="bac-blk ${b.geo ? "" : "locked"}" data-db="${esc(b.id)}" title="${esc(b.name)}" aria-label="${esc(b.name)}">${blockIcon(dctx(), b.id, 34)}</button>`).join("")}</div>` : "";
    }).join(""));
  }

  // ------------------------------------------------------------ schémas (F, Z / X, T)
  // Fenêtre copiée de SchematicsDialog (Mindustry, maquette S53) ; code, fichier et lien au format .msch (S54, S55).
  type Saved = { name: string; desc?: string; tags?: string[]; clip: Clip };
  const loadSch = (): Saved[] => { try { return JSON.parse(localStorage.getItem(KEY_SCHEM) || "[]") as Saved[]; } catch { return []; } };
  const schUi = { q: "", tags: [] as string[] };
  const clipToSch = (s: Omit<Saved, "clip">, c: Clip): Schematic => ({
    name: s.name, description: s.desc ?? "", labels: s.tags ?? [], width: c.W, height: c.H,
    layout: { blocks: c.items.map((it, u) => ({ u, id: it.id, x: it.dx, y: it.dy, r: it.r, ...(it.choice ? { choice: it.choice } : {}) })), wires: [] },
  });
  /** Un schéma lu devient une copie à coller : bâtiments inconnus écartés, coin ramené en (0, 0). */
  function toClip(items: Clip["items"]): Clip | null {
    const ok = items.filter((it) => cat.blocks.has(it.id));
    if (!ok.length) return null;
    const mx = Math.min(...ok.map((it) => it.dx)), my = Math.min(...ok.map((it) => it.dy));
    const norm = ok.map((it) => ({ ...it, dx: it.dx - mx, dy: it.dy - my }));
    const W = Math.max(...norm.map((it) => it.dx + dims(cat.blocks.get(it.id)!, it.r)[0])), H = Math.max(...norm.map((it) => it.dy + dims(cat.blocks.get(it.id)!, it.r)[1]));
    return { id: Date.now(), items: norm, W, H };
  }
  const schItems = (s: Schematic): Clip["items"] => s.layout.blocks.map((b) => ({ id: b.id, dx: b.x, dy: b.y, r: b.r, choice: b.choice ?? null }));
  /** Lit un code .msch, ou un ancien code (JSON en base64). */
  async function readCode(code: string): Promise<{ meta: Omit<Saved, "clip">; items: Clip["items"] }> {
    try {
      const s = await fromCode(code);
      return { meta: { name: s.name, desc: s.description, tags: s.labels }, items: schItems(s) };
    } catch {
      const c = decOld<{ items: Clip["items"] }>(code);
      if (!Array.isArray(c.items)) throw new Error("items");
      return { meta: { name: "" }, items: c.items };
    }
  }
  const preview = (c: Clip, px: number) => {
    const m = Math.max(c.W, c.H) + 1, d = dctx();
    return `<svg width="${px}" height="${px}" viewBox="-0.5 -0.5 ${m} ${m}" class="sch-pv" aria-hidden="true">${c.items.map((it) => blockMarkup(d, { u: -1, id: it.id, x: it.dx, y: it.dy, r: it.r })).join("")}</svg>`;
  };
  const sbtn = (a: string, i: number, n: string, k: Key) => `<button type="button" data-sch="${a}" data-i="${i}" title="${esc(t(k))}" aria-label="${esc(t(k))}">${ic(n)}</button>`;
  function addSch(meta: Omit<Saved, "clip">, items: Clip["items"]): boolean {
    const c = toClip(items);
    if (!c) return false;
    const l = loadSch();
    l.push({ name: meta.name || t("bac.sch.default", { n: l.length + 1 }), desc: meta.desc ?? "", tags: meta.tags ?? [], clip: c });
    store(KEY_SCHEM, l);
    return true;
  }
  function schematics(): void {
    const l = loadSch(), all = [...new Set(l.flatMap((s) => s.tags ?? []))].sort();
    const vis = l.map((s, i) => [s, i] as const).filter(([s]) => s.name.toLowerCase().includes(schUi.q.toLowerCase()) && schUi.tags.every((x) => (s.tags ?? []).includes(x)));
    openDlg(`<div class="ttl">${ic("schem")} ${esc(t("bac.sch.title"))}</div>
      <div class="row sch-top">${ic("search")}<input id="bac-sch-q" value="${esc(schUi.q)}" placeholder="${esc(t("bac.sch.search"))}" aria-label="${esc(t("bac.sch.search"))}"></div>
      <div class="row sch-tags">${ic("tag")}${all.map((x) => `<button type="button" class="chip${schUi.tags.includes(x) ? " on" : ""}" data-sch="tag" data-t="${esc(x)}" aria-pressed="${schUi.tags.includes(x)}">${esc(x)}</button>`).join("") || `<span class="muted">${esc(t("bac.sch.noTags"))}</span>`}</div>
      <div class="sch-grid">${vis.map(([s, i]) => `<div class="sch-card"><button type="button" class="sch-use" data-sch="use" data-i="${i}" title="${esc(t("bac.sch.useTip", { name: s.name }))}">${preview(s.clip, 150)}<span class="sch-nm">${esc(s.name)}</span></button><div class="sch-bar">${sbtn("info", i, "info", "bac.sch.info")}${sbtn("exp", i, "share", "bac.sch.export")}${sbtn("edit", i, "pencil", "bac.sch.edit")}${sbtn("del", i, "trash", "bac.delete")}</div></div>`).join("")
        || `<p class="muted">${esc(l.length ? t("bac.sch.noMatch") : t("bac.sch.none", { k: KB.schem ? keyLabel(KB.schem, LAB) : "—" }))}</p>`}</div>
      <div class="row sch-foot"><button type="button" data-sch="impmenu">${ic("download")} ${esc(t("bac.sch.importBtn"))}</button><button type="button" data-sch="whole">${ic("share")} ${esc(t("bac.sch.share"))}</button></div>`);
  }
  function schInfo(i: number): void {
    const s = loadSch()[i]!, c = s.clip, n = new Map<string, number>();
    let price = 0;
    for (const it of c.items) { n.set(it.id, (n.get(it.id) ?? 0) + 1); price += cat.blocks.get(it.id)?.cost ?? 0; }
    openDlg(`<div class="ttl">${esc(s.name)}</div><div class="sch-big">${preview(c, 300)}</div>${s.desc ? `<p>${esc(s.desc)}</p>` : ""}
      <h3>${esc(t("bac.sch.cost"))}</h3><div class="kv"><div>${esc(fmtMoney(price))}</div><div>${esc(t("bac.sch.size", { w: c.W, h: c.H }))}</div></div>
      <h3>${esc(t("bac.sch.blocks"))}</h3><div class="kv">${[...n].map(([id, k]) => `<div>${k} × ${esc(cat.blocks.get(id)?.name ?? id)}</div>`).join("")}</div>`, schematics);
  }
  function schExport(i: number): void {
    const s = loadSch()[i]!;
    openDlg(`<div class="ttl">${ic("share")} ${esc(t("bac.sch.exportOf", { name: s.name }))}</div>
      <div class="sch-menu"><button type="button" data-sch="copy" data-i="${i}">${ic("copy")} ${esc(t("bac.sch.copy"))}</button><button type="button" data-sch="file" data-i="${i}">${ic("save")} ${esc(t("bac.sch.file"))}</button><button type="button" data-sch="link" data-i="${i}">${ic("link")} ${esc(t("bac.sch.link"))}</button></div>
      <p class="muted" id="bac-sch-msg"></p>`, schematics);
  }
  function schImport(): void {
    openDlg(`<div class="ttl">${ic("download")} ${esc(t("bac.sch.import"))}</div>
      <div class="sch-menu"><button type="button" data-sch="paste">${ic("copy")} ${esc(t("bac.sch.fromClip"))}</button><button type="button" data-sch="openf">${ic("download")} ${esc(t("bac.sch.fromFile"))}</button></div>
      <h3>${esc(t("bac.sch.code"))}</h3><textarea id="bac-sch-in" aria-label="${esc(t("bac.sch.code"))}"></textarea><div class="row"><button type="button" data-sch="imp">${esc(t("bac.sch.importBtn"))}</button></div>
      <p class="muted">${esc(t("bac.sch.noWorkshop"))}</p>`, schematics);
  }
  function schEdit(i: number): void {
    const s = loadSch()[i]!;
    openDlg(`<div class="ttl">${ic("pencil")} ${esc(t("bac.sch.edit"))}</div>
      <h3>${esc(t("bac.sch.name"))}</h3><div class="row"><input id="bac-se-n" value="${esc(s.name)}" aria-label="${esc(t("bac.sch.name"))}"></div>
      <h3>${esc(t("bac.sch.desc"))}</h3><textarea id="bac-se-d" aria-label="${esc(t("bac.sch.desc"))}">${esc(s.desc ?? "")}</textarea>
      <h3>${esc(t("bac.sch.tags"))}</h3><div class="row">${(s.tags ?? []).map((x) => `<button type="button" class="chip on" data-sch="untag" data-i="${i}" data-t="${esc(x)}" title="${esc(t("bac.delete"))}">${esc(x)} ${ic("close")}</button>`).join("")}<input id="bac-se-t" placeholder="${esc(t("bac.sch.newTag"))}" aria-label="${esc(t("bac.sch.newTag"))}"><button type="button" data-sch="addtag" data-i="${i}">${esc(t("bac.sch.addTag"))}</button></div>
      <div class="row"><button type="button" data-sch="okedit" data-i="${i}">${ic("save")} ${esc(t("bac.sch.ok"))}</button></div>`, schematics);
  }
  const download = (bytes: Uint8Array, name: string) => {
    const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" })), a = document.createElement("a");
    a.href = u; a.download = `${name.replace(/[\\/:*?"<>|]/g, "_") || "schema"}.msch`; a.click(); URL.revokeObjectURL(u);
  };
  /** Tout le montage en schéma (câbles et liaisons compris) : code, fichier et lien. */
  async function schWhole(): Promise<void> {
    const blocks = S.blocks.filter((b) => !b.open);
    if (!blocks.length) return say(t("bac.sch.empty"));
    const keep = new Set(blocks.map((b) => b.u)), x0 = Math.min(...blocks.map((b) => b.x)), y0 = Math.min(...blocks.map((b) => b.y));
    const c = toClip(blocks.map((b) => ({ id: b.id, dx: b.x, dy: b.y, r: b.r, choice: b.choice ?? null })))!;
    const sch: Schematic = { name: t("bac.sch.wholeName"), description: "", labels: [], width: c.W, height: c.H,
      layout: { blocks: blocks.map((b) => ({ ...b, x: b.x - x0, y: b.y - y0 })), wires: S.wires.filter((w) => keep.has(w.a) && keep.has(w.b)), routes: S.routes.filter((w) => keep.has(w.a) && keep.has(w.b)) } };
    const code = await toCode(sch), url = `${location.origin}${location.pathname}#bac/${encodeURIComponent(code)}`;
    openDlg(`<div class="ttl">${ic("share")} ${esc(t("bac.sch.share"))}</div><textarea readonly aria-label="${esc(t("bac.sch.code"))}">${esc(code)}</textarea>
      <div class="sch-menu"><button type="button" data-sch="wcopy">${ic("copy")} ${esc(t("bac.sch.copy"))}</button><button type="button" data-sch="wfile">${ic("save")} ${esc(t("bac.sch.file"))}</button><button type="button" data-sch="wsave">${ic("schem")} ${esc(t("bac.sch.wholeSave"))}</button></div>
      <p class="${url.length <= 2000 ? "muted" : "warn"}">${esc(t(url.length <= 2000 ? "bac.sch.linkOk" : "bac.sch.linkLong", { n: url.length }))}${url.length <= 2000 ? ` <a href="${esc(url)}">${esc(t("bac.sch.link"))}</a>` : ""}</p>`, schematics);
    wholeCache = { sch, code, items: c.items };
  }
  let wholeCache: { sch: Schematic; code: string; items: Clip["items"] } | null = null;
  async function copyText(s: string): Promise<void> {
    try { await navigator.clipboard.writeText(s); say(t("bac.sch.copied")); } catch { say(t("bac.sch.copyFail")); }
  }
  async function onSch(el: HTMLElement): Promise<void> {
    const l = loadSch(), i = Number(el.dataset.i), a = el.dataset.sch, s = l[i];
    const val = (id: string) => root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value ?? "";
    if (a === "use" && s) { ui.clip = { ...structuredClone(s.clip), id: Date.now() }; ui.sel = null; closeDlg(); renderPanel(); renderHint(); drawGhost(); }
    else if (a === "tag") { const x = el.dataset.t!; schUi.tags = schUi.tags.includes(x) ? schUi.tags.filter((y) => y !== x) : [...schUi.tags, x]; schematics(); }
    else if (a === "info") schInfo(i);
    else if (a === "exp") schExport(i);
    else if (a === "edit") schEdit(i);
    else if (a === "del" && s && confirm(t("bac.sch.delAsk", { name: s.name }))) { l.splice(i, 1); store(KEY_SCHEM, l); schematics(); }
    else if (a === "impmenu") schImport();
    else if (a === "whole") await schWhole();
    else if (a === "copy" && s) await copyText(await toCode(clipToSch(s, s.clip)));
    else if (a === "file" && s) download(await writeMsch(clipToSch(s, s.clip)), s.name);
    else if (a === "link" && s) await copyText(`${location.origin}${location.pathname}#bac/${encodeURIComponent(await toCode(clipToSch(s, s.clip)))}`);
    else if (a === "wcopy" && wholeCache) await copyText(wholeCache.code);
    else if (a === "wfile" && wholeCache) download(await writeMsch(wholeCache.sch), wholeCache.sch.name);
    else if (a === "wsave" && wholeCache) { addSch({ name: wholeCache.sch.name }, wholeCache.items); schematics(); }
    else if (a === "paste" || a === "imp") {
      let code = val("bac-sch-in");
      if (a === "paste") try { code = await navigator.clipboard.readText(); } catch { return say(t("bac.sch.pasteFail")); }
      try { const r = await readCode(code); if (!addSch(r.meta, r.items)) throw new Error("vide"); schematics(); say(t("bac.sch.imported")); } catch { say(t("bac.sch.bad")); }
    } else if (a === "openf") {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".msch";
      inp.onchange = async () => {
        const f = inp.files?.[0];
        if (!f) return;
        try { const s2 = await readMsch(new Uint8Array(await f.arrayBuffer())); if (!addSch({ name: s2.name || f.name.replace(/\.msch$/i, ""), desc: s2.description, tags: s2.labels }, schItems(s2))) throw new Error("vide"); schematics(); say(t("bac.sch.imported")); } catch { say(t("bac.sch.bad")); }
      };
      inp.click();
    } else if (a === "addtag" && s) {
      const x = val("bac-se-t").trim();
      if (x) { s.name = val("bac-se-n").trim() || s.name; s.desc = val("bac-se-d"); s.tags = [...new Set([...(s.tags ?? []), x])]; store(KEY_SCHEM, l); schEdit(i); }
    } else if (a === "untag" && s) { s.tags = (s.tags ?? []).filter((y) => y !== el.dataset.t); store(KEY_SCHEM, l); schEdit(i); }
    else if (a === "okedit" && s) { s.name = val("bac-se-n").trim() || s.name; s.desc = val("bac-se-d"); store(KEY_SCHEM, l); schematics(); }
  }
  function renderSchBar(): void {
    const el = $("bac-schbar");
    el.hidden = !ui.clip;
    if (!ui.clip) return;
    el.innerHTML = (ui.clip.saved ? `<span class="saved">${esc(t("bac.sch.saved", { name: ui.clip.saved }))}</span>` : `<input id="bac-sch-nm" placeholder="${esc(t("bac.sch.name"))}" aria-label="${esc(t("bac.sch.name"))}"><button type="button" data-sb="save">${ic("save")} ${esc(t("bac.sch.save", { k: KB.save ? keyLabel(KB.save, LAB) : "—" }))}</button>`)
      + `<button type="button" data-sb="rot" title="${esc(t("bac.mob.rot"))}" aria-label="${esc(t("bac.mob.rot"))}">${ic("rotate")}</button><button type="button" data-sb="fx" title="${esc(t("bac.act.flipX"))}" aria-label="${esc(t("bac.act.flipX"))}">${ic("swap")}</button><button type="button" data-sb="fy" title="${esc(t("bac.act.flipY"))}" aria-label="${esc(t("bac.act.flipY"))}">${ic("updown")}</button><button type="button" data-sb="x" title="${esc(t("bac.mob.cancel"))}" aria-label="${esc(t("bac.mob.cancel"))}">${ic("close")}</button>`;
  }
  function saveClip(): void {
    if (!ui.clip || ui.clip.saved) return;
    const l = loadSch(), nm = root.querySelector<HTMLInputElement>("#bac-sch-nm")?.value.trim() || t("bac.sch.default", { n: l.length + 1 });
    const { saved: _s, ...clip } = ui.clip;
    l.push({ name: nm, clip });
    store(KEY_SCHEM, l);
    ui.clip.saved = nm;
    renderSchBar();
    say(t("bac.sch.savedToast", { name: nm, k: KB.schemMenu ? keyLabel(KB.schemMenu, LAB) : "—" }));
  }
  function copyRect(s: [number, number], c: [number, number]): void {
    const x0 = Math.min(s[0], c[0]), x1 = Math.max(s[0], c[0]), y0 = Math.min(s[1], c[1]), y1 = Math.max(s[1], c[1]);
    const items = S.blocks.filter((b) => !b.open && cellsOf(cat.blocks.get(b.id)!, b).every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)).map((b) => ({ id: b.id, dx: b.x - x0, dy: b.y - y0, r: b.r, choice: b.choice ?? null }));
    if (items.length) { ui.clip = { id: Date.now(), items, W: x1 - x0 + 1, H: y1 - y0 + 1 }; ui.sel = null; renderPanel(); }
    renderHint();
    renderInfo(true);
  }
  function pasteClip(c: [number, number]): void {
    const clip = ui.clip!, a = [c[0] - Math.floor(clip.W / 2), c[1] - Math.floor(clip.H / 2)] as const, add: Piece[] = [];
    for (const it of clip.items) {
      const b: Piece = { id: it.id, x: a[0] + it.dx, y: a[1] + it.dy, r: it.r, choice: it.choice };
      const cells = cellsOf(cat.blocks.get(b.id)!, { u: 0, ...b });
      if (fitsAt(b.id, b.x, b.y, b.r) && !add.some((o) => cellsOf(cat.blocks.get(o.id)!, { u: 0, ...o }).some(([x, y]) => cells.some(([p, q]) => p === x && q === y)))) add.push(b);
    }
    apply({ remove: [], add });
  }
  function flipClip(x: boolean): void {
    const c = ui.clip;
    if (!c) return;
    c.items = c.items.map((it) => { const [w, h] = dims(cat.blocks.get(it.id)!, it.r); return x ? { ...it, dx: c.W - (it.dx + w), r: it.r % 2 ? (it.r + 2) % 4 : it.r } : { ...it, dy: c.H - (it.dy + h), r: it.r % 2 ? it.r : (it.r + 2) % 4 }; });
    drawGhost();
  }

  // ------------------------------------------------------------ touches
  let kbArm: Action | null = null, kbPick: string | null = null;
  const actsOf = (code: string) => ACTIONS.filter(([a]) => KB[a] === code).map(([a]) => a);
  const actName = (a: Action) => t(`bac.act.${a}` as Key);
  const KB_ROWS = [
    ["Escape", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"],
    ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
    ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Delete"],
    ["CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash"],
    ["ShiftLeft", "IntlBackslash", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
  ];
  const keyName = (c: string | null) => (!c ? "—" : ["Escape", "Backspace", "Tab", "CapsLock", "ShiftLeft", "Delete"].includes(c) ? t(`bac.key.${c}` as Key) : keyLabel(c, LAB));
  const fixedTag = (c: string) => (FIXED_KEYS.includes(c) ? t(`bac.fixed.${c}` as Key) : /^Digit/.test(c) ? t("bac.fixed.digit") : null);
  function keysDialog(): void {
    const grp = Object.fromEntries(ACTIONS.map(([a, , g]) => [a, g]));
    const key = (c: string) => {
      const acts = actsOf(c), fx = fixedTag(c), tag = acts.length ? acts.map(actName).join(" + ") : fx ?? "";
      return `<button type="button" class="kb-k ${acts.length ? `g-${grp[acts[0]!]}` : ""} ${acts.length > 1 ? "conflict" : ""} ${fx ? "fixed" : ""}" data-kc="${c}" title="${esc(tag || t("bac.keys.free"))}">${esc(keyName(c))}<small>${esc(tag)}</small></button>`;
    };
    const pick = kbPick ? `<div class="kb-pick"><b>${esc(t("bac.keys.pick", { k: keyName(kbPick) }))}</b><div class="row">${ACTIONS.map(([a]) => `<button type="button" data-pickact="${a}" class="${KB[a] === kbPick ? "arm" : ""}">${esc(actName(a))}</button>`).join("")}<button type="button" data-pickact="">${esc(t("bac.keys.none"))}</button><button type="button" data-pickclose>${esc(t("bac.keys.close"))}</button></div></div>` : "";
    const hl = new Set(kbPick ? actsOf(kbPick) : []);
    const list = (["move", "build", "schem", "view"] as const).map((g) => `<h3 class="kb-g"><span class="kb-sw g-${g}"></span>${esc(t(`bac.keys.g.${g}` as Key))}</h3><div class="kb-act">${ACTIONS.filter((x) => x[2] === g).map(([a, d]) => {
      const others = KB[a] ? actsOf(KB[a]!).filter((o) => o !== a) : [];
      return `<span class="${hl.has(a) ? "kb-hl" : ""}">${esc(actName(a))}</span><span><kbd class="${others.length ? "warn" : ""}">${esc(keyName(KB[a]))}</kbd>${others.length ? ` <span class="warn">${esc(t("bac.keys.also", { list: others.map(actName).join(", ") }))}</span>` : ""}</span><span class="row tight"><button type="button" data-arm="${a}" class="${kbArm === a ? "arm" : ""}">${esc(t(kbArm === a ? "bac.keys.press" : "bac.keys.change"))}</button><button type="button" data-def="${a}" ${KB[a] === d ? "disabled" : ""}>${esc(t("bac.keys.default", { k: keyName(d) }))}</button><button type="button" data-none="${a}" ${KB[a] ? "" : "disabled"}>${esc(t("bac.keys.none"))}</button></span>`;
    }).join("")}</div>`).join("");
    const sc = $("bac-dlg").hidden ? 0 : $("bac-dlg").scrollTop;
    openDlg(`<div class="ttl">${ic("keyboard")} ${esc(t("bac.keys"))}</div><p class="muted">${esc(t("bac.keys.lead"))}${kbArm ? ` <b>${esc(t("bac.keys.armed"))}</b>` : ""}</p><div class="kb">${KB_ROWS.map((r) => `<div class="kb-row">${r.map(key).join("")}</div>`).join("")}</div>${pick}${list}<div class="row"><button type="button" data-kbreset>${esc(t("bac.keys.reset"))}</button><span class="muted">${esc(t("bac.keys.fixed"))}</span></div>${commandsTable()}`);
    $("bac-dlg").scrollTop = sc;
  }
  /** Le tableau des commandes (PLAN-BAC-A-SABLE.md § 3), avec les touches du joueur. */
  function commandsTable(): string {
    const k = (a: Action) => keyName(KB[a]);
    const rows: [Key, Record<string, string>][] = [
      ["bac.cmd.move", { k: `${k("up")} ${k("left")} ${k("down")} ${k("right")}` }], ["bac.cmd.zoom", {}], ["bac.cmd.pick", {}], ["bac.cmd.browse", { p: k("catPrev"), n: k("catNext") }],
      ["bac.cmd.info", {}], ["bac.cmd.place", {}], ["bac.cmd.pipe", {}], ["bac.cmd.variant", { k: k("variant") }], ["bac.cmd.rotate", { k: k("rotate") }],
      ["bac.cmd.drop", { k: k("variant") }], ["bac.cmd.delete", {}], ["bac.cmd.pipette", {}], ["bac.cmd.config", {}], ["bac.cmd.copy", { k: k("schem"), x: k("flipX"), y: k("flipY"), r: k("rotate") }],
      ["bac.cmd.schem", { k: k("schemMenu") }], ["bac.cmd.db", {}], ["bac.cmd.links", { k: k("links") }], ["bac.cmd.ports", {}], ["bac.cmd.status", { k: k("status") }], ["bac.cmd.wires", { k: k("wires") }],
      ["bac.cmd.menus", { k: k("menus") }], ["bac.cmd.research", { k: k("research") }], ["bac.cmd.undo", {}], ["bac.cmd.touch", {}],
    ];
    return `<h3>${esc(t("bac.cmd.title"))}</h3><table>${rows.map(([key, v]) => { const [a, b] = t(key, v).split(" | "); return `<tr><td>${esc(a!)}</td><td>${esc(b ?? "")}</td></tr>`; }).join("")}</table>`;
  }
  function assignKey(code: string): void {
    if (!kbArm || FIXED_KEYS.includes(code) || /^Digit|^Arrow/.test(code)) return;
    KB[kbArm] = code;
    kbArm = null;
    store(KEY_KEYS, KB);
    keysDialog();
    renderHint();
  }
  function renderHint(): void {
    if (!ui.mounted) return;
    const k = (a: Action) => `<kbd>${esc(keyName(KB[a]))}</kbd>`;
    let h: string;
    if (ui.clip) h = t("bac.hint.clip");
    else if (ui.routeFrom) h = t("bac.hint.route");
    else if (ui.pinned != null && byU.has(ui.pinned) && hasNodes(byU.get(ui.pinned)!) && !ui.sel) h = t("bac.hint.wires");
    else if (ui.sel?.locked) h = t("bac.hint.locked");
    else if (ui.sel && isTraced(ui.sel.e)) h = t("bac.hint.pipe");
    else if (ui.sel) h = t("bac.hint.block");
    else h = t("bac.hint.idle");
    $("bac-hint").innerHTML = esc(h).replace(/\{(\w+)\}/g, (all, a: string) => (ACTIONS.some((x) => x[0] === a) ? k(a as Action) : all));
    renderSchBar();
  }

  // ------------------------------------------------------------ statistiques
  function renderStats(): void {
    const el = root.querySelector("#bac-stats-in");
    if (!el || !R) return;
    const st = R.stats, u = ui.unit, un = t(`bac.unit.${u}` as Key);
    if (!S.blocks.length) { el.innerHTML = `<p class="muted">${esc(t("bac.stats.empty"))}</p>`; return; }
    const row = (a: string, b: string) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`;
    const list = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([i, v]) => row(esc(names.item(i)), esc(`${fmt(v * u, 2)}${un}`))).join("");
    const unitSel = `<div class="bac-units" role="group" aria-label="${esc(t("bac.unit.aria"))}">${[1, 60, 3600].map((x) => `<button type="button" data-unit="${x}" aria-pressed="${u === x}" class="${u === x ? "on" : ""}">${esc(t(`bac.unit.${x}` as Key))}</button>`).join("")}</div>`;
    const pw = R.power;
    el.innerHTML = `${unitSel}<table>${row(esc(t("bac.st.blocks")), String(S.blocks.length - st.pieces))}${row(esc(t("bac.st.pieces")), String(st.pieces))}${st.area ? row(esc(t("bac.st.area")), esc(t("bac.st.cells", { w: st.area[0], h: st.area[1] }))) : ""}${row(esc(t(st.energy < 0 ? "bac.st.energyProd" : "bac.st.energy")), `${esc(fmt(Math.abs(st.energy), 0))} MF/s`)}${row(esc(t("bac.st.poll")), `${esc(fmt(st.pollution, 2))} %/h`)}${row(esc(t("bac.st.price")), esc(fmtMoney(st.price)))}${row(esc(t("bac.st.revenue")), `${esc(fmtMoney(st.revenue * u))}${un}`)}</table>`
      + (st.unpriced.length ? `<p class="muted">${esc(t("bac.st.unpriced", { list: st.unpriced.map(names.item).join(", ") }))}</p>` : "")
      + `<h4>${esc(t("bac.st.power"))}</h4>${pw.length ? pw.map((n, i) => `<p><b>${esc(t("bac.st.net", { i: i + 1, n: n.us.length }))}</b><br>${esc(t("bac.st.netv", { got: fmt(n.got, 0), need: fmt(n.need, 0), prod: fmt(n.prod, 0) }))}</p>`).join("") : `<p class="muted">${esc(t("bac.st.noWire"))}</p>`}`
      + `<h4>${esc(t("bac.st.outs"))}</h4>${Object.keys(st.outs).length ? `<table>${list(st.outs)}</table>` : `<p class="muted">${esc(t("bac.st.noOut"))}</p>`}`
      + `<h4>${esc(t("bac.st.ext"))}</h4>${Object.keys(st.ext).length ? `<table>${list(st.ext)}</table>` : `<p class="muted">${esc(t("bac.st.noExt"))}</p>`}`
      + `<h4>${esc(t("bac.st.limits"))}</h4>${R.alerts.length ? `<ul>${R.alerts.map(({ a, n }, i) => `<li><button type="button" class="link warn" data-alert="${i}">${n > 1 ? `${n} × ` : ""}${esc(alertText(a, names))}</button></li>`).join("")}</ul>` : `<p class="muted">${esc(t("bac.st.allOk"))}</p>`}`;
  }
  /** Un clic sur une ligne de « Ce qui limite » centre la vue sur le bâtiment concerné. */
  function focusAlert(i: number): void {
    const a = R?.alerts[i]?.a;
    if (!a) return;
    const id = "id" in a ? a.id : a.k === "saturated" ? a.pipe : null;
    const b = id ? S.blocks.find((x) => x.id === id && (a.k !== "machine" || R!.machines.get(x.u)?.reason)) ?? S.blocks.find((x) => x.id === id) : null;
    if (!b) return;
    const r = svgEl().getBoundingClientRect(), [w, h] = dims(cat.blocks.get(b.id)!, b.r);
    cam.x = b.x + w / 2 - r.width / 2 / cam.z;
    cam.y = b.y + h / 2 - r.height / 2 / cam.z;
    ui.pinned = b.u;
    applyView();
    renderInfo(true);
    drawGhost();
  }

  // ------------------------------------------------------------ câbles
  const toastT = { id: 0 };
  function say(s: string): void {
    const el = root.querySelector<HTMLElement>("#bac-toast");
    if (!el) return;
    el.textContent = s;
    el.classList.add("on");
    clearTimeout(toastT.id);
    toastT.id = window.setTimeout(() => el.classList.remove("on"), 3200);
  }
  const between = (ua: number, ub: number) => S.wires.filter((w) => (w.a === ua && w.b === ub) || (w.a === ub && w.b === ua));
  function linkToggle(ua: number, ub: number): void {
    const ex = between(ua, ub);
    if (ex.length) { snap(); S.wires = S.wires.filter((w) => !ex.includes(w)); changed(); return say(t("bac.wire.removed", { n: ex.length })); }
    if (elecRole(cat, layout(), ua) && elecRole(cat, layout(), ub)) {
      const r = powerWires(cat, layout(), ua, ub, false);
      if (!r) return say(t("bac.wire.noPort"));
      if ("err" in r) return say(wireErrorText(r.err));
      snap();
      S.wires = [...S.wires, ...r.wires];
      changed();
      return say(r.rangeUnknown ? t("bac.wire.rangeUnknown", { n: r.wires.length }) : t("bac.wire.added", { n: r.wires.length }));
    }
    // Câble logique : les deux prises compatibles les plus proches, de la sortie vers l'entrée (portée non relevée).
    const A = byU.get(ua)!, B = byU.get(ub)!, nodes = (b: Placed) => geo(cat.blocks.get(b.id)!, b)!.ports.map((p, i) => ({ p, i })).filter((x) => x.p.dir === "top" && x.p.t === "g");
    let best: { x: { p: PlacedPort; i: number }; y: { p: PlacedPort; i: number }; dd: number } | null = null;
    for (const x of nodes(A)) for (const y of nodes(B)) {
      if ((x.p.d === "e" && y.p.d === "e") || (x.p.d === "s" && y.p.d === "s")) continue;
      const dd = Math.hypot(x.p.px! - y.p.px!, x.p.py! - y.p.py!);
      if (!best || dd < best.dd) best = { x, y, dd };
    }
    if (!best) return say(t("bac.wire.noPort"));
    const rev = best.y.p.d === "s" || best.x.p.d === "e";
    snap();
    S.wires = [...S.wires, rev ? { a: ub, ia: best.y.i, b: ua, ib: best.x.i, t: "g" } : { a: ua, ia: best.x.i, b: ub, ib: best.y.i, t: "g" }];
    changed();
    say(t("bac.wire.logic"));
  }
  function autoWire(u: number): void {
    const ws = autoConnect(cat, layout(), u);
    if (!ws.length) return say(t("bac.wire.nothing"));
    snap();
    S.wires = [...S.wires, ...ws];
    changed();
    say(t("bac.wire.auto", { n: new Set(ws.map((w) => (w.a === u ? w.b : w.a))).size }));
  }

  // ------------------------------------------------------------ liaisons et ports libres
  function routeClick(pr: PortRef): void {
    if (!ui.routeFrom) { ui.routeFrom = pr; say(t("bac.route.start")); drawGhost(); renderHint(); return; }
    const from = ui.routeFrom;
    ui.routeFrom = null;
    if (from.u === pr.u && from.i === pr.i) { drawGhost(); renderHint(); return; }
    const res = clickRoute(cat, layout(), { a: from.u, ia: from.i, b: pr.u, ib: pr.i });
    if ("err" in res) { say(t("bac.route.refused", { why: routeErrorText(res.err) })); drawGhost(); renderHint(); return; }
    snap();
    S.routes = res.routes;
    changed();
    say(t(res.did === "added" ? "bac.route.added" : "bac.route.removed"));
  }
  /** Port libre cliqué : la grille ne montre plus que les machines qui fournissent (entrée) ou utilisent (sortie) ce qu'il porte. */
  function filterFor(pr: PortRef & { p: PlacedPort }): void {
    const b = byU.get(pr.u)!, mi = R?.machines.get(pr.u), fluid = pr.p.t === "f", isIn = pr.p.d !== "s";
    const recs = mi?.rec ? [mi.rec] : mi?.cand ?? cat.blocks.get(b.id)!.recipes;
    const items = pr.p.items?.length ? pr.p.items : [...new Set(recs.flatMap((r) => Object.keys(isIn ? r.in : r.out)))].filter((i) => !!cat.items.get(i)?.fluid === fluid);
    if (!items.length) return say(t("bac.filter.nothing"));
    const ids = machinesFor(cat, items, isIn ? "out" : "in").filter((id) => id !== b.id || !isIn);
    ui.filter = { ids, title: t(isIn ? "bac.filter.in" : "bac.filter.out", { items: items.map(names.item).join(", ") }) };
    ui.sel = null;
    renderPanel();
    renderInfo(true);
  }

  // ------------------------------------------------------------ gestes
  const svgEl = () => $<SVGSVGElement>("bac-map");
  /** Le glisser continue même hors du plan (un pointeur déjà relâché ne se capture pas : sans effet). */
  const capture = (e: PointerEvent) => {
    try {
      svgEl().setPointerCapture(e.pointerId);
    } catch {
      // pointeur inconnu du navigateur
    }
  };
  function cellAt(e: { clientX: number; clientY: number }): [number, number] {
    const r = svgEl().getBoundingClientRect(), wx = cam.x + (e.clientX - r.left) / cam.z, wy = cam.y + (e.clientY - r.top) / cam.z;
    ui.sub = [wx - Math.floor(wx), wy - Math.floor(wy)];
    return [Math.floor(wx), Math.floor(wy)];
  }
  function applyView(): void {
    if (!ui.mounted) return;
    const r = svgEl().getBoundingClientRect();
    if (r.width) svgEl().setAttribute("viewBox", `${cam.x} ${cam.y} ${r.width / cam.z} ${r.height / cam.z}`);
    if (cam.z < COMPACT_Z !== drawnCompact) drawAll(); // vue compacte quand on dézoome
  }
  function zoomAt(f: number, cx: number, cy: number): void {
    const r = svgEl().getBoundingClientRect(), px = cx - r.left, py = cy - r.top, wx = cam.x + px / cam.z, wy = cam.y + py / cam.z;
    cam.z = Math.min(90, Math.max(6, cam.z * f));
    cam.x = wx - px / cam.z;
    cam.y = wy - py / cam.z;
    applyView();
  }
  /**
   * Survol et glisser (B4) : le cadre d'infos et l'aperçu se refont une fois par image, quel que soit le nombre
   * d'événements du pointeur ; rien d'autre ne se redessine pendant un glisser.
   */
  let frame = 0, frameGhost = false;
  function hover(c: [number, number]): void {
    const moved = c[0] !== ui.cell[0] || c[1] !== ui.cell[1];
    ui.cell = c;
    const u = occ.get(cellKey(...c)) ?? null;
    if (u !== ui.hoverU) ui.hoverU = u;
    frameGhost ||= moved;
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderInfo(); if (frameGhost) drawGhost(); });
  }
  function rotatePlaced(u: number): void {
    const b = byU.get(u);
    if (!b || b.open) return;
    const nr = (b.r + 1) % 4;
    if (!fitsAt(b.id, b.x, b.y, nr, u)) return say(t("bac.rotate.blocked"));
    snap();
    b.r = nr;
    changed();
  }
  function rotateSel(dir = 1): void {
    if (ui.clip) {
      const c = ui.clip;
      c.items = c.items.map((it) => { const [, h] = dims(cat.blocks.get(it.id)!, it.r); return { ...it, dx: c.H - (it.dy + h), dy: it.dx, r: (it.r + 1) % 4 }; });
      [c.W, c.H] = [c.H, c.W];
    } else if (ui.sel) ui.rot = (ui.rot + (dir > 0 ? 1 : 3)) % 4;
    else if (ui.hoverU != null) rotatePlaced(ui.hoverU);
    else if (ui.pinned != null) rotatePlaced(ui.pinned);
    drawGhost();
  }
  function pick(c: [number, number]): void {
    const u = occ.get(cellKey(...c));
    if (u == null) return;
    const b = byU.get(u)!, e = menu.entries.find((x) => x.def === b.id && !x.fam) ?? menu.entries.find((x) => x.fam && menu.variants[x.fam].includes(b.id));
    if (!e) return;
    ui.rot = b.r;
    ui.choice = b.choice ? { id: b.id, c: b.choice } : null;
    ui.filter = null;
    select(e, e.fam ? b.id : undefined);
    if (ui.sel?.e !== e) select(e, e.fam ? b.id : undefined);
  }
  function deleteBlock(u: number): void {
    const b = byU.get(u);
    if (!b) return;
    const cs = cellsOf(cat.blocks.get(b.id)!, b);
    apply(rectPlan(cat, layout(), cs[0]![0], cs[0]![1], cs.at(-1)![0], cs.at(-1)![1]));
  }
  function finishOp(c: [number, number]): void {
    const op = ui.op;
    ui.op = null;
    if (!op) return;
    if (op.t === "line") { const p = planFor(op.s, c); if (!p.bad) apply(p); else say(t("bac.place.refused")); }
    else if (op.t === "port") {
      if (!op.moved) { ui.pinned = op.pr.u; filterFor(op.pr); }
      else { const p = tracePlan(op.s, c, op.fam); if (!p.bad) apply(p); else say(t("bac.place.refused")); }
    }
    else if (op.t === "break") { const s = op.moved ? op.s : c; apply(rectPlan(cat, layout(), Math.min(s[0], c[0]), Math.min(s[1], c[1]), Math.max(s[0], c[0]), Math.max(s[1], c[1]))); }
    else if (op.t === "schem") copyRect(op.s, c);
    drawGhost();
  }
  function leftClick(c: [number, number]): void {
    const u = occ.get(cellKey(...c)) ?? null, pr = portUnder();
    if (pr && (pr.p.t === "o" || pr.p.t === "f")) {
      if (ui.routeFrom || hasContact(pr.u, pr.p.t)) return routeClick(pr);
      if (portFree(pr.p)) { ui.pinned = pr.u; return filterFor(pr); }
    }
    if (ui.routeFrom) { ui.routeFrom = null; say(t("bac.route.cancel")); }
    if (u != null && ui.pinned != null && u !== ui.pinned && byU.has(ui.pinned) && hasNodes(byU.get(ui.pinned)!) && hasNodes(byU.get(u)!)) return linkToggle(ui.pinned, u);
    if (u != null && u === ui.pinned && elecRole(cat, layout(), u) === "pole") return autoWire(u);
    ui.pinned = u;
    renderInfo(true);
    drawGhost();
    renderHint();
  }
  const touches = new Map<number, { x: number; y: number }>();
  let ts: { pinch?: boolean; d?: number; z?: number; sx?: number; sy?: number; cx?: number; cy?: number; c?: [number, number]; moved?: boolean; timer?: number } | null = null;
  function bindDom(): void {
    const svg = svgEl();
    svg.addEventListener("contextmenu", (e) => e.preventDefault());
    svg.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
    svg.addEventListener("pointerdown", (e) => {
      closePop();
      if (e.pointerType === "touch") return touchDown(e);
      capture(e);
      ui.ctrl = e.ctrlKey;
      const c = cellAt(e);
      ui.cell = c;
      if (e.button === 1) { e.preventDefault(); ui.op = { t: "mid", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false }; return; }
      if (e.button === 2) {
        if (ui.clip) { ui.clip = null; renderHint(); drawGhost(); return; }
        if (ui.sel) { select(ui.sel.e); return; }
        if (ui.routeFrom) { ui.routeFrom = null; drawGhost(); renderHint(); return; }
        ui.op = { t: "break", s: c, moved: false };
        drawGhost();
        return;
      }
      if (e.button !== 0) return;
      if (ui.clip) return pasteClip(c);
      // Port libre d'une machine (même avec une machine en main) : clic = quoi brancher, glisser = un tuyau.
      const pr = !ui.routeFrom && !(ui.sel && isTraced(ui.sel.e)) ? portUnder() : null;
      if (pr && (pr.p.t === "o" || pr.p.t === "f") && portFree(pr.p) && !hasContact(pr.u, pr.p.t)) {
        const [dx, dy] = DV[pr.p.dir as Dir], [px, py] = pr.p.cells![0]!;
        ui.op = { t: "port", pr, s: [px + dx, py + dy], fam: famFor(pr.p.t), moved: false };
        return;
      }
      if (ui.sel && !ui.sel.locked) { ui.op = { t: "line", s: c }; drawGhost(); return; }
      leftClick(c);
    });
    svg.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return touchMove(e);
      ui.ctrl = e.ctrlKey;
      const op = ui.op;
      if (op?.t === "mid") {
        if (Math.hypot(e.clientX - op.sx, e.clientY - op.sy) > 4) op.moved = true;
        if (op.moved) { cam.x = op.cx - (e.clientX - op.sx) / cam.z; cam.y = op.cy - (e.clientY - op.sy) / cam.z; applyView(); }
        return;
      }
      const c = cellAt(e);
      if (op?.t === "break" && (c[0] !== op.s[0] || c[1] !== op.s[1])) op.moved = true;
      if (op?.t === "port" && !op.moved && (c[0] !== op.pr.p.cells![0]![0] || c[1] !== op.pr.p.cells![0]![1])) op.moved = true;
      hover(c);
    });
    svg.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") return touchUp(e);
      const op = ui.op, c = cellAt(e);
      if (op?.t === "mid") { ui.op = null; if (!op.moved) pick(c); return; }
      if (op && op.t !== "schem") finishOp(c);
    });
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      if ((ui.clip || ui.sel) && !e.ctrlKey) rotateSel(e.deltaY < 0 ? 1 : -1);
      else zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    }, { passive: false });
    svg.addEventListener("mouseleave", () => { ui.hoverU = null; renderInfo(); drawGhost(); });

    $("bac-tiers").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tier]"); if (b) setTier(Number(b.dataset.tier)); });
    $("bac-cats").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cat]"); if (b && !b.disabled) { ui.cat = b.dataset.cat!; ui.filter = null; renderPanel(); } });
    $("bac-grid").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-key]"); if (b) select(menu.byKey.get(b.dataset.key!)); });
    $("bac-grid").addEventListener("mouseover", (e) => { const k = (e.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key ?? null; if (k !== ui.hoverBtn) { ui.hoverBtn = k; renderInfo(); } });
    $("bac-grid").addEventListener("mouseleave", () => { ui.hoverBtn = null; renderInfo(); });
    $("bac-filter").addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("[data-filter-x]")) { ui.filter = null; renderPanel(); } });
    const info = $("bac-info");
    info.addEventListener("click", (e) => {
      const el = e.target as HTMLElement;
      const q = el.closest<HTMLElement>("[data-info]");
      if (q) return blockInfo(q.dataset.info!);
      const v = el.closest<HTMLElement>("[data-var]");
      if (v) { const en = ui.hoverBtn ? menu.byKey.get(ui.hoverBtn) : ui.sel?.e; if (en) select(en, v.dataset.var); return; }
      if (el.closest("#bac-rec")) return recipeMenu(el.closest<HTMLElement>("#bac-rec")!);
      const u = target();
      const pr = el.closest<HTMLElement>("[data-pair]");
      if (pr && u != null) { snap(); const n = Number(pr.dataset.pair) as 0 | 1 | 2; byU.get(u)!.pair = n || undefined; return changed(); }
      const a = el.closest<HTMLElement>("[data-act]");
      if (!a || u == null) return;
      if (a.dataset.act === "del") deleteBlock(u);
      else if (a.dataset.act === "propose") deps.propose(S.fills, a);
      else rotatePlaced(u);
    });
    info.addEventListener("change", (e) => { if ((e.target as HTMLElement).id === "bac-auto") { ui.auto = (e.target as HTMLInputElement).checked; drawGhost(); } });
    $("bac-stats").addEventListener("click", (e) => {
      const el = e.target as HTMLElement;
      const un = el.closest<HTMLElement>("[data-unit]");
      if (un) { ui.unit = Number(un.dataset.unit); return renderStats(); }
      const al = el.closest<HTMLElement>("[data-alert]");
      if (al) focusAlert(Number(al.dataset.alert));
    });
    $("bac-ex").addEventListener("click", (e) => {
      const b = e.currentTarget as HTMLElement;
      if (pop && popAnchor === b) return closePop();
      openPop(b, [1, 2, 3].map((n) => `<button type="button" role="option" data-opt="${n}">${esc(t(`bac.ex.${n}` as Key))}</button>`).join(""), (o) => example(Number(o.dataset.opt)));
    });
    $("bac-keys").addEventListener("click", keysDialog);
    $("bac-undo").addEventListener("click", doUndo);
    $("bac-redo").addEventListener("click", doRedo);
    $("bac-set").addEventListener("click", settingsDlg);
    $("bac-clear").addEventListener("click", () => { if (!S.blocks.length) return; snap(); S = { blocks: [], wires: [], routes: [], fills: S.fills }; ui.pinned = null; changed(); say(t("bac.cleared")); });
    $("bac-schem").addEventListener("click", schematics);
    $("bac-db").addEventListener("click", openDb);
    $("bac-vec").addEventListener("click", toggleLinks);
    $("bac-mob").addEventListener("click", (e) => {
      const m = (e.target as HTMLElement).closest<HTMLElement>("[data-mob]")?.dataset.mob;
      if (m === "break") { ui.breakMode = !ui.breakMode; ui.schemMode = false; ui.sel = null; }
      else if (m === "schem") { ui.schemMode = !ui.schemMode; ui.breakMode = false; ui.sel = null; }
      else if (m === "rot") rotateSel(1);
      else if (m === "cancel") { ui.sel = null; ui.clip = null; ui.breakMode = ui.schemMode = false; ui.routeFrom = null; }
      else if (m === "undo") doUndo();
      for (const b of root.querySelectorAll<HTMLElement>("[data-mob]")) b.classList.toggle("on", (b.dataset.mob === "break" && ui.breakMode) || (b.dataset.mob === "schem" && ui.schemMode));
      renderPanel();
      drawGhost();
    });
    $("bac-schbar").addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-sb]")?.dataset.sb;
      if (a === "save") saveClip();
      else if (a === "rot") rotateSel(1);
      else if (a === "fx") flipClip(true);
      else if (a === "fy") flipClip(false);
      else if (a === "x") { ui.clip = null; drawGhost(); renderHint(); }
    });
    $("bac-schbar").addEventListener("keydown", (e) => { if (e.key === "Enter") saveClip(); });
    const dlg = $("bac-dlg");
    $("bac-dlg-back").addEventListener("click", () => { const f = dlgBack; closeDlg(); if (f) f(); });
    dlg.addEventListener("submit", (e) => { e.preventDefault(); if ((e.target as HTMLElement).id === "bac-fill") submitFill(e.target as HTMLFormElement); });
    dlg.addEventListener("change", (e) => {
      const k = (e.target as HTMLElement).dataset?.set as keyof Settings | undefined;
      if (!k) return;
      SET[k] = (e.target as HTMLInputElement).checked;
      store(KEY_SET, SET);
      setTier(ui.tier);
      changed();
    });
    dlg.addEventListener("click", (e) => {
      const el = e.target as HTMLElement, at = (s: string) => el.closest<HTMLElement>(s);
      if (at("[data-db]")) return blockInfo(at("[data-db]")!.dataset.db!, openDb);
      const sch = at("[data-sch]");
      if (sch) {
        void onSch(sch);
        return;
      }
      if (at("[data-arm]")) { kbPick = null; const a = at("[data-arm]")!.dataset.arm as Action; kbArm = kbArm === a ? null : a; return keysDialog(); }
      if (at("[data-def]")) { const a = at("[data-def]")!.dataset.def as Action; KB[a] = ACTIONS.find((x) => x[0] === a)![1]; store(KEY_KEYS, KB); renderHint(); return keysDialog(); }
      if (at("[data-none]")) { KB[at("[data-none]")!.dataset.none as Action] = null; store(KEY_KEYS, KB); renderHint(); return keysDialog(); }
      if (at("[data-pickact]")) { const a = at("[data-pickact]")!.dataset.pickact as Action | ""; if (a) KB[a] = kbPick; else for (const x of actsOf(kbPick!)) KB[x] = null; store(KEY_KEYS, KB); renderHint(); return keysDialog(); }
      if (at("[data-pickclose]")) { kbPick = null; return keysDialog(); }
      const k = at("[data-kc]");
      if (k && kbArm) return assignKey(k.dataset.kc!);
      if (k && !fixedTag(k.dataset.kc!)) { kbPick = k.dataset.kc!; return keysDialog(); }
      if (at("[data-kbreset]")) { Object.assign(KB, defaultKeys()); store(KEY_KEYS, KB); keysDialog(); renderHint(); }
    });
  }
  function touchDown(e: PointerEvent): void {
    capture(e);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { clearTimeout(ts?.timer); const [a, b] = [...touches.values()]; ts = { pinch: true, d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: cam.z }; ui.op = null; return; }
    const c = cellAt(e);
    ui.cell = c;
    const st = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, c, moved: false, timer: 0 };
    st.timer = window.setTimeout(() => {
      if (ui.breakMode) ui.op = { t: "break", s: c, moved: true };
      else if (ui.schemMode) ui.op = { t: "schem", s: c };
      else if (ui.sel && !ui.sel.locked) ui.op = { t: "line", s: c };
      drawGhost();
    }, 350);
    ts = st;
  }
  function touchMove(e: PointerEvent): void {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ts?.pinch && touches.size === 2) { const [a, b] = [...touches.values()]; zoomAt((ts.z! * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / ts.d! / cam.z, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2); return; }
    if (!ts) return;
    if (ui.op) return hover(cellAt(e));
    if (Math.hypot(e.clientX - ts.sx!, e.clientY - ts.sy!) > 8) { ts.moved = true; clearTimeout(ts.timer); }
    if (ts.moved) { cam.x = ts.cx! - (e.clientX - ts.sx!) / cam.z; cam.y = ts.cy! - (e.clientY - ts.sy!) / cam.z; applyView(); }
  }
  function touchUp(e: PointerEvent): void {
    touches.delete(e.pointerId);
    if (!ts) return;
    if (ts.pinch) { if (!touches.size) ts = null; return; }
    clearTimeout(ts.timer);
    const c = cellAt(e);
    if (ui.op) finishOp(c);
    else if (!ts.moved) {
      if (ui.clip) pasteClip(c);
      else if (ui.breakMode) apply(rectPlan(cat, layout(), c[0], c[1], c[0], c[1]));
      else if (ui.sel && !ui.sel.locked) { const p = planFor(c, c); if (!p.bad) apply(p); }
      else leftClick(c);
    }
    ts = null;
  }

  // ------------------------------------------------------------ clavier
  const held = new Set<string>();
  let digits: number[] = [], lastDigit = 0, raf = 0, lastT = 0;
  function doUndo(): void { if (!undo.length) return; redo.push(JSON.stringify(S)); S = JSON.parse(undo.pop()!) as State; ui.pinned = null; changed(); }
  function doRedo(): void { if (!redo.length) return; undo.push(JSON.stringify(S)); S = JSON.parse(redo.pop()!) as State; changed(); }
  function cancelAll(): void { ui.sel = null; ui.clip = null; ui.op = null; ui.pinned = null; ui.routeFrom = null; ui.filter = null; renderPanel(); renderInfo(true); renderHint(); drawGhost(); }
  function toggleLinks(): void {
    ui.vec = !ui.vec;
    const b = $("bac-vec");
    b.classList.toggle("on", ui.vec);
    b.setAttribute("aria-pressed", String(ui.vec));
    drawAll();
    say(t(ui.vec ? "bac.links.on" : "bac.links.off"));
  }
  function tick(now: number): void {
    const dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000)); // l'heure d'une image peut précéder l'appui
    lastT = now;
    const dx = +held.has(KB.right ?? "") - +held.has(KB.left ?? ""), dy = +held.has(KB.down ?? "") - +held.has(KB.up ?? "");
    if (dx || dy) { const v = (held.has("Shift") ? 40 : 15) * dt; cam.x += dx * v; cam.y += dy * v; applyView(); }
    raf = held.size ? requestAnimationFrame(tick) : 0;
  }
  function onKey(e: KeyboardEvent): void {
    if (root.hidden || !ui.mounted) return;
    if (/^Key/.test(e.code) && e.key.length === 1 && !e.ctrlKey && !e.altKey && !LAB.has(e.code)) LAB.set(e.code, e.key.toUpperCase());
    if (kbArm) { e.preventDefault(); if (e.key === "Escape") { KB[kbArm] = null; kbArm = null; store(KEY_KEYS, KB); renderHint(); keysDialog(); } else assignKey(e.code); return; }
    if (pop) { if (e.key === "Escape") { e.preventDefault(); const a = popAnchor; closePop(); a?.focus(); } return; }
    if (!$("bac-dlg").hidden) { if (e.key === "Escape") closeDlg(); return; }
    if ((e.target as HTMLElement).closest?.("input, select, textarea")) return;
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); doRedo(); }
      ui.ctrl = true;
      drawGhost();
      return;
    }
    if ([KB.up, KB.left, KB.down, KB.right].includes(e.code)) { held.add(e.code); if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } e.preventDefault(); return; }
    if (e.key === "Shift") { held.add("Shift"); return; }
    if (/^Digit\d$/.test(e.code)) {
      const d = Number(e.code.slice(5)), now = performance.now();
      digits = now - lastDigit > 400 ? [d] : [...digits, d];
      lastDigit = now;
      const tr = TIERS[(digits[0] || 10) - 1];
      if (!tr) return;
      setTier(tr);
      if (digits.length >= 2) { const c = CATS[(digits[1] || 10) - 1]; if (c && entriesFor(cat, menu, ui.tier, c.id).length) { ui.cat = c.id; renderPanel(); } }
      if (digits.length >= 3) { const rest = digits.slice(2), n = rest.length === 1 ? rest[0] || 10 : rest[0]! * 10 + rest[1]!; select(entriesFor(cat, menu, ui.tier, ui.cat)[n - 1]); }
      return;
    }
    const list = entriesFor(cat, menu, ui.tier, ui.cat), i = ui.sel ? list.indexOf(ui.sel.e) : -1;
    for (const a of actsOf(e.code)) {
      if (/^F\d+$/.test(e.code)) e.preventDefault();
      switch (a) {
        case "rotate": rotateSel(1); break;
        case "schem": if (!e.repeat && !ui.op) { ui.op = { t: "schem", s: ui.cell }; drawGhost(); } break;
        case "save": saveClip(); break;
        case "flipX": flipClip(true); break;
        case "flipY": flipClip(false); break;
        case "schemMenu": schematics(); break;
        case "variant": if (ui.sel?.e.fam) { const vs = menu.variants[ui.sel.e.fam]; select(ui.sel.e, vs[(vs.indexOf(ui.sel.v) + 1) % vs.length]); } else cancelAll(); break;
        case "links": toggleLinks(); break;
        case "wires": ui.wires = !ui.wires; drawAll(); say(t(ui.wires ? "bac.wires.on" : "bac.wires.off")); break;
        case "status": ui.status = !ui.status; drawAll(); say(t(ui.status ? "bac.status.on" : "bac.status.off")); break;
        case "menus": ui.hidden = !ui.hidden; root.classList.toggle("ui-off", ui.hidden); break;
        case "research": location.hash = "#arbre"; break;
        case "info": { const id = ui.sel?.v ?? (target() != null ? byU.get(target()!)?.id : null); if (id) blockInfo(id); } break;
        case "catPrev": case "catNext": {
          const ne = CATS.filter((c) => entriesFor(cat, menu, ui.tier, c.id).length), j = ne.findIndex((c) => c.id === ui.cat);
          ui.cat = ne[(j + (a === "catNext" ? 1 : ne.length - 1)) % ne.length]!.id;
          ui.filter = null;
          renderPanel();
          break;
        }
        default: break;
      }
    }
    switch (e.code) {
      case "Escape": cancelAll(); break;
      case "Delete": case "Backspace": if (ui.pinned != null) deleteBlock(ui.pinned); break;
      case "ArrowLeft": case "ArrowRight": case "ArrowUp": case "ArrowDown": {
        e.preventDefault();
        if (!list.length) break;
        const st = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[e.code];
        select(list[(((i < 0 ? 0 : i + st) % list.length) + list.length) % list.length]);
        break;
      }
      default: break;
    }
    renderHint();
  }
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", (e) => {
    held.delete(e.code);
    if (e.key === "Shift") held.delete("Shift");
    if (root.hidden || !ui.mounted) return;
    if (e.key === "Control") { ui.ctrl = false; drawGhost(); }
    if (e.code === KB.schem && ui.op?.t === "schem") finishOp(ui.cell);
  });
  window.addEventListener("blur", () => held.clear());
  window.addEventListener("resize", () => { if (!root.hidden) { placeRoot(); applyView(); } });
  document.addEventListener("pointerdown", (e) => { if (pop && !pop.contains(e.target as Node) && !popAnchor?.contains(e.target as Node)) closePop(); }, true);
  (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard?.getLayoutMap?.()
    .then((m) => { for (const [c, k] of m) LAB.set(c, k.toUpperCase()); if (ui.mounted) { renderHint(); } })
    .catch(() => undefined);

  // ------------------------------------------------------------ exemples
  function example(n: number): void {
    snap();
    let L: Layout = { blocks: [], wires: [], routes: [] };
    const put = (id: string, x: number, y: number, r: number, choice: string | null) => { L = applyPlan(L, { remove: [], add: [{ id, x, y, r, choice }] }); };
    const pipe = (path: [number, number][], fam: Fam) => { const p = pipePlan(cat, L, path, fam); if (p) L = applyPlan(L, p); };
    const line = (x0: number, y0: number, x1: number, y1: number) => { const o: [number, number][] = []; for (let x = x0, y = y0; ;) { o.push([x, y]); if (x === x1 && y === y1) break; if (x !== x1) x += Math.sign(x1 - x); else y += Math.sign(y1 - y); } return o; };
    if (n === 1) { put("press", 0, 0, 0, "press_02"); put("roller", 8, 0, 0, null); pipe(line(3, 2, 8, 2), "o1"); }
    if (n === 2) { for (let i = 0; i < 5; i++) put("roller", i * 5, 0, 0, "roller_01"); pipe([[3, 2], ...line(3, 3, 27, 3)], "o1"); for (let i = 1; i < 5; i++) pipe([[i * 5 + 3, 2], [i * 5 + 3, 3]], "o1"); }
    if (n === 3) { put("press", 0, 0, 0, "press_02"); put("roller", 24, 0, 0, null); pipe(line(3, 2, 24, 2), "o3"); pipe(line(12, -2, 12, 6), "f3"); }
    S = { blocks: L.blocks, wires: [], routes: [], fills: S.fills };
    ui.pinned = null;
    changed();
    fit();
  }
  /** Cadre la vue sur le montage, entre les statistiques et le menu de pose. */
  function fit(): void {
    if (!S.blocks.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of S.blocks) for (const [x, y] of cellsOf(cat.blocks.get(b.id)!, b)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    const r = svgEl().getBoundingClientRect(), wide = r.width > 760, L = wide ? 300 : 0, fw = r.width - L - (wide ? 390 : 0);
    cam.z = Math.max(8, Math.min(48, (fw * 0.85) / (x1 - x0), (r.height * 0.6) / (y1 - y0)));
    cam.x = (x0 + x1) / 2 - (L + fw / 2) / cam.z;
    cam.y = (y0 + y1) / 2 - (r.height * 0.42) / cam.z;
    applyView();
  }
  /** Remplace le montage par un schéma (lien partagé, ou plan de l'Usine ouvert dans le bac à sable). */
  function loadSchematic(s: Schematic): void {
    const items = schItems(s), c = toClip(items);
    if (!c) return say(t("bac.sch.bad"));
    snap();
    S = { blocks: [], wires: [], routes: [], fills: S.fills };
    reindex();
    apply({ remove: [], add: c.items.map((it) => ({ id: it.id, x: it.dx, y: it.dy, r: it.r, choice: it.choice })) });
    // Câbles et liaisons : indices de cases du fichier → numéros des bâtiments posés (même ordre, inconnus écartés).
    const kept = s.layout.blocks.map((b) => cat.blocks.has(b.id)), u = new Map<number, number>();
    let k = 0;
    kept.forEach((ok, i) => { if (ok) u.set(i, S.blocks[S.blocks.length - c.items.length + k++]?.u ?? -1); });
    const re = <T extends { a: number; b: number }>(l: T[]) => l.filter((w) => (u.get(w.a) ?? -1) >= 0 && (u.get(w.b) ?? -1) >= 0).map((w) => ({ ...w, a: u.get(w.a)!, b: u.get(w.b)! }));
    if (s.layout.wires.length || s.layout.routes?.length) { S.wires = re(s.layout.wires); S.routes = re(s.layout.routes ?? []); changed(); }
    fit();
  }
  async function importCode(code: string): Promise<void> {
    try {
      const s = await fromCode(code).catch(() => null);
      if (s) return loadSchematic(s);
      const r = await readCode(code);
      loadSchematic({ name: "", description: "", labels: [], width: 0, height: 0, layout: { blocks: r.items.map((it, i) => ({ u: i, id: it.id, x: it.dx, y: it.dy, r: it.r, ...(it.choice ? { choice: it.choice } : {}) })), wires: [] } });
    } catch {
      say(t("bac.sch.bad"));
    }
  }

  // ------------------------------------------------------------ page
  function placeRoot(): void {
    const top = document.querySelector(".top")?.getBoundingClientRect().bottom ?? 0;
    root.style.setProperty("--bac-top", `${Math.max(0, top)}px`);
  }
  return {
    /** La page s'affiche (`code` : un montage partagé par un lien #bac/<code>). */
    show(code?: string): void {
      refreshCatalog();
      reindex();
      compute();
      placeRoot();
      if (!ui.mounted) { ui.mounted = true; skeleton(); if (S.blocks.length) fit(); }
      else { applyView(); drawAll(); renderInfo(true); }
      if (code) { void importCode(decodeURIComponent(code)); history.replaceState(null, "", "#bac"); }
    },
    /** Ouvre un plan du site (module, usine) converti en schéma. */
    open(s: Schematic): void {
      if (!ui.mounted) { ui.mounted = true; skeleton(); }
      loadSchematic(s);
    },
    /** Langue changée ou données corrigées : tout est redessiné, le montage et la vue gardés. */
    refresh(): void {
      if (!ui.mounted) return;
      refreshCatalog();
      reindex();
      compute();
      closePop();
      skeleton();
    },
  };
}
