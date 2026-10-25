// Éditeur de bâtiments (onglet « Bâtiments ») : relever l'empreinte et les ports d'un bâtiment
// directement sur une grille, en s'aidant d'une capture d'écran posée en fond.
// La grille se manipule comme l'arbre de recherche (glisser, molette). La capture se cale en
// deux clics (deux coins du bâtiment), puis s'ajuste à la main en mode « Capture ».
// S19 : un port se modifie dans une bulle à côté de lui ; un bloc modulaire a une case par face
// autour de la grille ; un seul « Enregistrer » ; le reste est replié sous la grille.
// La capture reste dans le navigateur (jamais envoyée) ; les relevés sont gardés localement
// et s'exportent au format de data/ports.json.

import type { GameData } from "../engine/data.ts";
import type { InterfaceKind, InterfaceSetting, MachineInterface, Port, PortsEntry, PortsFile } from "../engine/extension-types.ts";
import { checkInterface, type Interfaces } from "../engine/interfaces.ts";
import {
  ASSEMBLY_SHORT,
  blockFaces,
  blockRange,
  editDiff,
  fact,
  findBlock,
  isOpen,
  type ModAssembly,
  type ModBlock,
  type ModFact,
  type ModularEdit,
  type ModularFile,
} from "../engine/modular.ts";
import { dieselConfigs, farmBlocks, farmRates, parseDieselReading, type DieselReading } from "../engine/modular-calc.ts";
import { MODCALC_DEFAULT, modCalcHtml, modCalcOut, readDieselForm, type ModCalcState } from "./modcalc-view.ts";
import {
  applyTool,
  type BgPlacement,
  bodyPoint,
  CELL,
  checkEntry,
  entryChanged,
  exportSurveys,
  FACE_BOXES,
  type FaceBox,
  faceBoxes,
  fitTwoCorners,
  INTERFACE_KINDS,
  isComplete,
  kindLabel,
  marginToPort,
  newSettingId,
  parseInterfaces,
  parseModular,
  parseSurveys,
  portCenter,
  pruneIntegrated,
  sameSize,
  scaleAround,
  setFaceRequired,
  splitSides,
  type SurveyState,
  surveySource,
  surveyState,
  toggleFaceBlock,
  type Tool,
} from "./buildings-model.ts";
import { PanZoom } from "./canvas.ts";
import { loadLocalInterfaces, loadLocalModular, loadLocalSurveys, saveLocalInterfaces, saveLocalModular, saveLocalSurveys } from "./surveys.ts";
import { esc, fmt, fmtMF, fmtPct, parseNum, quote } from "./format.ts";
import { t, type Key } from "../i18n/i18n.ts";
import { txt, txtHtml } from "./engine-text.ts";
import { sentNote } from "./remarques-view.ts";
import { loadSent, type Piece } from "./remarques.ts";

type Bg = BgPlacement & { url: string; rot: number; opacity: number; natW: number; natH: number };
/** Ce que fait la souris sur la grille. */
type Mode = "ports" | "capture" | "coins";
type PortTool = Exclude<Tool, "gomme">;
type Place = Pick<Port, "side" | "cell">;
/** Bulle ouverte : un port posé (le modifier), ou une case vide (y poser un port, mode « Bulle »). */
type Bubble = { kind: "port"; index: number } | { kind: "new"; place: Place } | null;

/** Pastille de l'état d'un relevé (S31 : textes du catalogue). */
function stateBadge(st: SurveyState): string {
  const [cls, key] = ({ depot: ["ok", "bld.badge.depot"], local: ["local", "bld.badge.local"], manquant: ["none", "bld.badge.none"] } as const)[st];
  return `<span class="bld-badge ${cls}" title="${esc(t(`${key}.title`))}">${t(key)}</span>`;
}

/** Libellés d'un outil, d'un type de port, d'un sens, d'un côté (les valeurs restent celles des données). */
const toolLabel = (x: Tool) => t(`tool.${x}`);
const typeName = (x: PortTool) => t(`ptype.${x}`);
const dirLabel = (d: Port["direction"]) => t(`dir.${d}`);
const sideLabel = (s: string) => (s === "dessus" || s === "haut" || s === "bas" || s === "gauche" || s === "droite" ? t(`side.${s}`) : s);
const DIRS = ["entrée", "sortie", "les deux"] as const;
const TIER = ["", "I", "II", "III", "IV", "V"];
const boxLabel = (b: FaceBox) => t(b === "haut" ? "box.haut" : b === "bas" ? "box.bas" : "box.side");
/** Nom court d'un ensemble modulaire (« ferme », « moteur ») pour la liste et la recherche. */
const asmShort = (id: string): string | undefined => (id in ASSEMBLY_SHORT ? t(`asm.short.${id}` as Key) : undefined);
/** Ce qu'on rappelle d'un bloc de la ferme sous « À savoir » (règles de pose, pas de calcul). */
const RANGE_NOTES = ["count", "sprinklersPerTank", "needsTankInControllerRange", "mustBeInControllerRange", "extraTanksNeedWater", "multipleOutputs", "placement"];
/** Choix du mode de pose (outils ou bulle), gardé dans ce navigateur. */
const POSE_KEY = "ind-calc:v1:pose-bulle";

/**
 * `onSelect` : appelé quand un bâtiment est choisi (pour l'adresse de la page).
 * `repoIfaces` : interfaces des machines du dépôt (data/interfaces.json, S10).
 * `repoModular` : règles des machines modulaires (data/modular.json, S11-S12).
 * Renvoie `show(id)` : ouvrir un bâtiment depuis une autre page (schéma, plan de pose).
 */
export function initBuildings(
  root: HTMLElement,
  data: GameData,
  repo: PortsFile,
  onSelect: (id: string) => void = () => {},
  repoIfaces: Interfaces = {},
  repoModular: ModularFile = { sources: {}, assemblies: [] },
  diesel: { get(): DieselReading[]; set(list: DieselReading[]): void } = { get: () => [], set: () => {} },
  /** S35 : « 📤 Envoyer mes relevés » ouvre la fenêtre « Remarque » avec ce fichier joint. */
  onSend?: (piece: Piece) => void,
): { show(id: string): void; refresh(): void } {
  const pruned = pruneIntegrated(loadLocalSurveys(), repo);
  let local: Record<string, PortsEntry> = pruned.kept;
  if (pruned.dropped.length) save();
  // Interfaces notées dans ce navigateur ; une copie identique à celle du dépôt n'a plus lieu d'être.
  let localIfaces: Interfaces = Object.fromEntries(Object.entries(loadLocalInterfaces()).filter(([id, i]) => JSON.stringify(i) !== JSON.stringify(repoIfaces[id])));
  saveLocalInterfaces(localIfaces);
  /** Interface du bâtiment choisi, en cours de saisie (null : aucune). */
  let iface: MachineInterface | null = null;
  // Corrections des blocs modulaires notées dans ce navigateur (S12) ; brouillon dès qu'on touche une case de face ou la portée.
  let localMod = loadLocalModular();
  let modDraft: ModularEdit | null = null;
  /** Case de face ouverte sous la grille (null : aucune). */
  let openBox: FaceBox | null = null;
  /** Portée en cours de correction (ferme d'arbres). */
  let rangeEdit = false;
  /** Cercle de portée dessiné dans la grille. */
  let showRange = false;
  /** Bloc « Calcul » des ensembles (S13) : blocs saisis, gardés le temps de la page. */
  const mcState: ModCalcState = structuredClone(MODCALC_DEFAULT);
  /** Message du relevé de configuration du moteur (S18). */
  let mcMsg = "";
  const assemblyOf = new Map(repoModular.assemblies.flatMap((a) => a.blocks.map((b) => [b.id, a] as const)));
  let selectedId: string | null = null;
  let entry: PortsEntry | null = null;
  let tool: Tool = "objet";
  // Un sens par outil : passer de « sortie objet » à la prise ⚡ ne fait pas une prise en sortie.
  const dirByTool: Record<PortTool, Port["direction"]> = { objet: "entrée", fluide: "entrée", énergie: "entrée", logique: "entrée" };
  /** Mode « Bulle » : un clic sur une case vide ouvre une bulle (type et sens choisis dedans). */
  let poseBubble = loadPose();
  /** Sens proposé dans la bulle d'une case vide (le dernier choisi). */
  let bubbleDir: Port["direction"] = "entrée";
  let bubble: Bubble = null;
  let sizeOpen = false;
  let filter = "";
  let bg: Bg | null = null;
  let mode: Mode = "ports";
  let corners: [number, number][] = [];
  /** Décalage de la grille dans le SVG (en unités SVG) quand le cercle de portée dépasse. */
  let off = 0;
  let message = pruned.dropped.length ? t("bld.pruned", { n: String(pruned.dropped.length) }) : "";

  const machines = [...data.machines.values()].sort((a, b) => Number(a.kind === "building") - Number(b.kind === "building") || a.name.localeCompare(b.name));

  root.innerHTML = `
    <div class="bld">
      <aside class="bld-list panel">
        <label class="sr-only" for="bld-search" data-i18n="bld.search">${t("bld.search")}</label>
        <input id="bld-search" type="search" placeholder="${esc(t("bld.search.ph"))}" data-i18n-attr="placeholder=bld.search.ph" autocomplete="off">
        <p class="hint bld-states" id="bld-states"></p>
        <ul id="bld-items"></ul>
        <div class="actions">
          ${onSend ? `<button type="button" id="bld-send" class="primary" aria-haspopup="dialog" data-i18n="rm.surveys.send" hidden>${t("rm.surveys.send")}</button>` : ""}
          <button type="button" id="bld-export" data-i18n="bld.export">${t("bld.export")}</button>
          <label class="button"><span data-i18n="bld.import">${t("bld.import")}</span><input type="file" id="bld-import" accept="application/json,.json" hidden></label>
        </div>
        <p class="hint" id="bld-io"></p>
      </aside>
      <div class="bld-main">
        <div class="panel" id="bld-intro">
          <h3 data-i18n="bld.title">${t("bld.title")}</h3>
          <p data-i18n="bld.intro">${t("bld.intro")}</p>
          <p class="hint" data-i18n="bld.intro.hint">${t("bld.intro.hint")}</p>
        </div>
        <div class="panel bld-editor" id="bld-editor" hidden>
          <div class="bld-head" id="bld-head"></div>
          <div class="bld-row" id="bld-dims" hidden></div>
          <div class="bld-range" id="bld-range" hidden></div>
          <div class="bld-tools" id="bld-tools" role="toolbar" aria-label="${esc(t("bld.tools.aria"))}" data-i18n-attr="aria-label=bld.tools.aria"></div>
          <div class="bld-cross" id="bld-cross">
            ${FACE_BOXES.map((b) => `<button type="button" class="bld-face bld-face-${b}" data-box="${b}" hidden></button>`).join("")}
            <div class="bld-stage">
              <div class="bld-frame" id="bld-frame" tabindex="0" aria-label="${esc(t("bld.frame.aria"))}" data-i18n-attr="aria-label=bld.frame.aria">
                <div id="bld-canvas"></div>
                <p class="bld-help" id="bld-help"></p>
                <div class="seg bld-mode" id="bld-mode" role="radiogroup" aria-label="${esc(t("bld.mode.aria"))}" data-i18n-attr="aria-label=bld.mode.aria" hidden>
                  <button type="button" role="radio" data-mode="ports" title="${esc(t("bld.mode.ports.title"))}" data-i18n="bld.mode.ports" data-i18n-attr="title=bld.mode.ports.title">${t("bld.mode.ports")}</button>
                  <button type="button" role="radio" data-mode="capture" title="${esc(t("bld.mode.capture.title"))}" data-i18n="bld.mode.capture" data-i18n-attr="title=bld.mode.capture.title">${t("bld.mode.capture")}</button>
                </div>
                <button type="button" class="bld-rangebtn" id="bld-rangebtn" data-i18n="bld.range" hidden>${t("bld.range")}</button>
                <div class="rs-zoom">
                  <button type="button" data-bzoom="in" aria-label="${esc(t("zoom.in"))}" data-i18n-attr="aria-label=zoom.in">+</button>
                  <button type="button" data-bzoom="out" aria-label="${esc(t("zoom.out"))}" data-i18n-attr="aria-label=zoom.out">−</button>
                  <button type="button" data-bzoom="fit" aria-label="${esc(t("zoom.fit"))}" data-i18n-attr="aria-label=zoom.fit">⤢</button>
                </div>
              </div>
              <div class="bld-bubble" id="bld-bubble" role="dialog" aria-label="${esc(t("bld.port"))}" data-i18n-attr="aria-label=bld.port" hidden></div>
            </div>
          </div>
          <div id="bld-facepop"></div>
          <p class="bld-msg" id="bld-msg" aria-live="polite"></p>
          <div class="bld-foot" id="bld-foot">
            <label class="bld-check"><input type="checkbox" id="bld-nopower"> <span data-i18n="bld.noPower">${t("bld.noPower")}</span></label>
            <label class="bld-check"><input type="checkbox" id="bld-noports"> <span data-i18n="bld.noPorts">${t("bld.noPorts")}</span></label>
            <div class="bld-status" id="bld-status" aria-live="polite"></div>
            <div class="actions" id="bld-actions"></div>
          </div>
          <div class="bld-more">
            <details id="bld-d-mod" hidden><summary id="bld-s-mod"></summary><div id="bld-mod"></div></details>
            <details id="bld-d-iface"><summary id="bld-s-iface"></summary><div id="bld-iface"></div></details>
            <details class="bld-bg" id="bld-bg"><summary><span data-i18n="bld.bg">${t("bld.bg")}</span> <span class="hint" data-i18n="bld.bg.hint">${t("bld.bg.hint")}</span></summary><div id="bld-bgbody"></div></details>
            <details id="bld-d-notes"><summary id="bld-s-notes">${t("bld.notes")}</summary><label class="bld-notes"><span class="sr-only" data-i18n="bld.notes">${t("bld.notes")}</span><textarea id="bld-notes" rows="2" placeholder="${esc(t("bld.notes.ph"))}" data-i18n-attr="placeholder=bld.notes.ph"></textarea></label></details>
          </div>
        </div>
      </div>
    </div>`;
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  const frame = $("#bld-frame");
  const pz = new PanZoom(frame, { minWidth: 2 * CELL, maxWidth: maxViewWidth, fitOnReset: true });

  function save(): void {
    saveLocalSurveys(local);
  }
  function loadPose(): boolean {
    try {
      return localStorage.getItem(POSE_KEY) === "1";
    } catch {
      return false;
    }
  }
  function savePose(): void {
    try {
      localStorage.setItem(POSE_KEY, poseBubble ? "1" : "0");
    } catch {
      // stockage indisponible : le choix vaut pour la page
    }
  }

  // ---------------------------------------------------------------- liste
  function renderList(): void {
    const q = filter.trim().toLowerCase();
    const n = { depot: 0, local: 0, manquant: 0 };
    for (const m of machines) n[surveyState(m.id, repo, local)]++;
    $("#bld-states").innerHTML = t("bld.states.html", { depot: n.depot, local: n.local, missing: n.manquant });
    $("#bld-items").innerHTML = machines
      .filter((m) => !q || m.name.toLowerCase().includes(q) || !!asmShort(assemblyOf.get(m.id)?.id ?? "")?.includes(q))
      .map((m) => {
        const asm = assemblyOf.get(m.id);
        const modBadge = asm
          ? `<span class="bld-badge mod" title="${esc(t("bld.mod.title", { name: asm.name, local: localMod[m.id] ? t("bld.mod.local") : "" }))}">⬡ ${esc(asmShort(asm.id) ?? asm.name)}${localMod[m.id] ? " ✎" : ""}</span>`
          : "";
        const e = local[m.id] ?? repo.machines[m.id];
        const st = surveyState(m.id, repo, local);
        const hasIface = !!(localIfaces[m.id] ?? repoIfaces[m.id]);
        const badges = `<span class="bld-badges">${modBadge}${hasIface ? `<span class="bld-badge iface" title="${esc(t("bld.iface.title"))}">⚙</span>` : ""}${stateBadge(st)}${e && !isComplete(e) ? `<span class="bld-badge warn" title="${esc(checkEntry(e).join(" ; "))}">${t("bld.incomplete")}</span>` : ""}</span>`;
        return `<li><button type="button" data-bld="${esc(m.id)}" class="${m.id === selectedId ? "on" : ""}"><span>${esc(m.name)}</span>${badges}</button></li>`;
      })
      .join("");
    renderSend();
  }

  function select(id: string): void {
    if (id !== selectedId) clearBg();
    selectedId = id;
    const m = data.machines.get(id)!;
    const base = local[id] ?? repo.machines[id];
    entry = base ? structuredClone(base) : { footprint: m.size ? { w: m.size.w, h: m.size.l } : { w: 2, h: 2 }, ports: [], source: surveySource() };
    const known = localIfaces[id] ?? repoIfaces[id];
    iface = known ? structuredClone(known) : null;
    modDraft = null;
    openBox = null;
    rangeEdit = false;
    showRange = false;
    bubble = null;
    sizeOpen = false;
    mode = "ports";
    corners = [];
    message = "";
    // Ce qui est replié : ouvert d'office seulement quand il y a quelque chose à voir.
    ($("#bld-d-iface") as HTMLDetailsElement).open = !!iface;
    ($("#bld-d-notes") as HTMLDetailsElement).open = !!entry.notes;
    ($("#bld-d-mod") as HTMLDetailsElement).open = id === "diesel-engine-controller";
    renderList();
    renderEditor(false);
    onSelect(id);
  }

  // ---------------------------------------------------------------- dessin
  const bgTransform = (b: Bg) => `translate(${b.x * CELL} ${b.y * CELL}) scale(${b.scale}) rotate(${b.rot} ${b.natW / 2} ${b.natH / 2})`;

  /** Bloc à portée (ferme) : rayon depuis le centre, en cases, s'il est connu. */
  function rangeRadius(): number | null {
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found || found.assembly.assembly === "contact") return null;
    const size = data.machines.get(found.block.id)?.size ?? null;
    const edits = modDraft ? { ...localMod, [found.block.id]: modDraft } : localMod;
    return blockRange(found.assembly, found.block, size, edits).fromCenter;
  }

  function portTitle(p: Port): string {
    return t("bld.port.title", { type: typeName(p.type), dir: dirLabel(p.direction), where: placeText(p), tip: p.tip ? ` — ${quote(p.tip)}` : "" });
  }

  function svg(): string {
    const e = entry!;
    const { w, h } = e.footprint!;
    const radius = showRange ? rangeRadius() : null;
    // Le cercle de portée dépasse de la grille : on l'agrandit autour (décalage `off`).
    const pad = radius ? Math.max(0, Math.ceil(radius - Math.min(w, h) / 2 - 1) + 1) : 0;
    off = pad * CELL;
    const W = (w + 2) * CELL + 2 * off;
    const H = (h + 2) * CELL + 2 * off;
    let s = `<svg id="bld-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("bld.svg.aria"))}"><g transform="translate(${off} ${off})">`;
    if (bg) s += `<g id="bld-bgimg" opacity="${bg.opacity}" transform="${bgTransform(bg)}"><image href="${bg.url}" width="${bg.natW}" height="${bg.natH}"/></g>`;
    // Sans capture : cases pleines. Avec capture : seulement les traits, pour voir les plots dessous.
    for (let gx = 0; gx < w + 2; gx++) {
      for (let gy = 0; gy < h + 2; gy++) {
        const inBody = gx >= 1 && gx <= w && gy >= 1 && gy <= h;
        const corner = (gx === 0 || gx === w + 1) && (gy === 0 || gy === h + 1);
        const cls = bg ? (inBody ? "bld-bodyline" : corner ? "" : "bld-cellline") : inBody ? "bld-body" : corner ? "bld-corner" : "bld-margin";
        if (cls) s += `<rect x="${gx * CELL}" y="${gy * CELL}" width="${CELL}" height="${CELL}" class="${cls}"/>`;
      }
    }
    s += `<rect x="${CELL}" y="${CELL}" width="${w * CELL}" height="${h * CELL}" class="bld-outline"/>`;
    if (radius) s += `<circle class="bld-circ" cx="${(1 + w / 2) * CELL}" cy="${(1 + h / 2) * CELL}" r="${radius * CELL}"><title>${esc(t("bld.range.title", { r: fmt(radius, 2) }))}</title></circle>`;
    if (bubble?.kind === "new") {
      const [x, y] = portCenter(w, h, { ...bubble.place, type: "objet", direction: "entrée" });
      s += `<rect class="bld-target" x="${x - 13}" y="${y - 13}" width="26" height="26" rx="4"/>`;
    }
    e.ports.forEach((p, i) => {
      const [x, y] = portCenter(w, h, p);
      const sel = bubble?.kind === "port" && bubble.index === i ? " sel" : "";
      const dir = p.direction === "sortie" ? "out" : p.direction === "les deux" ? "both" : "in";
      const r = p.side === "dessus" ? 11 : 13;
      const half = dir === "both" ? `<path class="half" d="M${x + r} ${y - r}L${x + r} ${y + r}L${x - r} ${y + r}Z"/>` : "";
      let glyph: string;
      if (p.side === "dessus") glyph = p.type === "énergie" ? "⚡" : "◆";
      else if (dir === "both") glyph = p.side === "haut" || p.side === "bas" ? "↕" : "↔";
      else {
        const inward = { haut: "▼", bas: "▲", gauche: "▶", droite: "◀" }[p.side];
        const outward = { haut: "▲", bas: "▼", gauche: "◀", droite: "▶" }[p.side];
        glyph = dir === "out" ? outward : inward;
      }
      s += `<g class="bld-port ${p.type} ${dir}${sel}" data-port="${i}"><title>${esc(portTitle(p))}</title><rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="${p.side === "dessus" ? 3 : 4}"/>${half}<text x="${x}" y="${y + (p.side === "dessus" ? 5 : 6)}" text-anchor="middle">${glyph}</text></g>`;
    });
    for (const [cx, cy] of corners) s += `<g class="bld-mark"><line x1="${cx - 12}" y1="${cy}" x2="${cx + 12}" y2="${cy}"/><line x1="${cx}" y1="${cy - 12}" x2="${cx}" y2="${cy + 12}"/></g>`;
    return `${s}</g></svg>`;
  }

  /** Redessine la grille ; `keepView` garde le cadrage (sauf si la taille de la grille change). */
  function refreshCanvas(keepView = true): void {
    if (!entry) return;
    const c = $("#bld-canvas");
    c.innerHTML = svg();
    const { w, h } = entry.footprint!;
    pz.attach(c.querySelector("svg") as SVGSVGElement, (w + 2) * CELL + 2 * off, (h + 2) * CELL + 2 * off, keepView);
    renderStatus();
    renderBubble();
  }

  function maxViewWidth(): number {
    const { w, h } = entry?.footprint ?? { w: 2, h: 2 };
    const grid = Math.max(w + 2, h + 2) * CELL + 2 * off;
    const img = bg ? Math.max(bg.natW, bg.natH) * bg.scale + 2 * Math.max(Math.abs(bg.x), Math.abs(bg.y)) * CELL : 0;
    return Math.max(grid, img) * 2;
  }

  function imageBox(b: Bg) {
    return { x: b.x * CELL + off, y: b.y * CELL + off, w: b.natW * b.scale, h: b.natH * b.scale };
  }

  /** Point de l'écran → coordonnées de la grille (unités SVG, la marge commençant à 0). */
  function toGrid(clientX: number, clientY: number): [number, number] | null {
    const el = root.querySelector<SVGSVGElement>("#bld-svg");
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x - off, p.y - off];
  }

  /** Déplacement fluide de la capture : seule la transformation de l'image change. */
  function moveBg(): void {
    const g = root.querySelector("#bld-bgimg");
    if (g && bg) g.setAttribute("transform", bgTransform(bg));
  }

  function clearBg(): void {
    if (bg) URL.revokeObjectURL(bg.url);
    bg = null;
    if (mode !== "ports") mode = "ports";
  }

  // ---------------------------------------------------------------- en-tête et outils
  function powerHint(id: string): string {
    const recs = [...data.recipes.values()].filter((r) => r.machine === id && r.energyMFps !== null);
    if (!recs.length) return "";
    const max = Math.max(...recs.map((r) => r.energyMFps!));
    return max === 0 ? t("bld.power.none") : t("bld.power.some", { x: fmtMF(max) });
  }

  function renderEditor(keepView = true): void {
    $("#bld-intro").hidden = !!entry;
    $("#bld-editor").hidden = !entry;
    if (!entry || !selectedId) return;
    renderHead();
    renderDims();
    renderTools();
    ($("#bld-nopower") as HTMLInputElement).checked = !!entry.noPower;
    ($("#bld-noports") as HTMLInputElement).checked = !!entry.noPorts;
    renderModular();
    refreshCanvas(keepView);
    renderIface();
    renderBgPanel();
    ($("#bld-notes") as HTMLTextAreaElement).value = entry.notes ?? "";
    renderNotesSummary();
    renderActions();
    renderMode();
  }

  function renderHead(): void {
    const id = selectedId!;
    const m = data.machines.get(id)!;
    const asm = assemblyOf.get(id);
    const fp = entry!.footprint!;
    const wiki = sameSize(fp, m.size) ? "" : ` <span class="must unk" title="${esc(t("bld.wiki.title"))}">${esc(t("bld.wiki", { w: String(m.size!.w), h: String(m.size!.l) }))}</span>`;
    const mod = asm ? `<span class="bld-badge mod" title="${esc(txt(findBlock(repoModular, id)?.block.role ?? ""))}">⬡ ${esc(asm.name)} · Tier ${TIER[asm.tier] ?? asm.tier}</span>` : "";
    const fix = localMod[id] ? `<span class="bld-badge local" title="${esc(t("bld.localFix.title"))}">${t("bld.localFix")}</span>` : "";
    $("#bld-head").innerHTML = `<h3>${esc(m.name)}</h3>${stateBadge(surveyState(id, repo, local))}${mod}${fix}<span class="bld-size">${esc(t("bld.size", { w: String(fp.w), h: String(fp.h) }))} <button type="button" class="link small" id="bld-size" aria-expanded="${sizeOpen}" title="${esc(t("bld.size.change"))}">✎</button>${wiki}</span>`;
  }

  function renderDims(): void {
    const box = $("#bld-dims");
    box.hidden = !sizeOpen;
    if (!sizeOpen) return;
    box.innerHTML = `
      <label>${t("bld.width")} <input type="number" min="1" max="200" id="bld-w" value="${entry!.footprint!.w}"></label>
      <label>${t("bld.height")} <input type="number" min="1" max="200" id="bld-h" value="${entry!.footprint!.h}"></label>
      <button type="button" id="bld-swap" title="${esc(t("bld.swap"))}">⇄</button>`;
  }

  function renderTools(): void {
    const dir = tool === "gomme" ? null : dirByTool[tool];
    const pose = `<span class="bld-sep"></span><span class="bld-dirlabel">${t("bld.pose")}</span><span class="seg" role="radiogroup" aria-label="${esc(t("bld.pose.aria"))}">
      <button type="button" role="radio" data-posemode="outils" aria-checked="${!poseBubble}" title="${esc(t("bld.pose.tools.title"))}">${t("bld.pose.tools")}</button>
      <button type="button" role="radio" data-posemode="bulle" aria-checked="${poseBubble}" title="${esc(t("bld.pose.bubble.title"))}">${t("bld.pose.bubble")}</button></span>`;
    if (poseBubble) {
      $("#bld-tools").innerHTML = pose;
      return;
    }
    $("#bld-tools").innerHTML = `
      ${(["objet", "fluide", "énergie", "logique", "gomme"] as Tool[]).map((x) => `<button type="button" data-tool="${x}" aria-pressed="${x === tool}">${x === "gomme" ? "" : `<i class="bld-sw ${x}"></i>`}${toolLabel(x)}</button>`).join("")}
      <span class="bld-sep"></span><span class="bld-dirlabel">${t("bld.dir")}</span>
      ${DIRS.map((d) => `<button type="button" data-dir="${d}" aria-pressed="${d === dir}"${dir ? "" : " disabled"}>${dirLabel(d)}</button>`).join("")}${pose}`;
  }

  // ---------------------------------------------------------------- bulle d'un port (S19)
  const placeText = (p: Place) => (p.side === "dessus" ? t("bld.port.where.top", { cell: (p.cell as number[]).join(", ") }) : t("bld.port.where", { side: sideLabel(p.side), cell: String(p.cell) }));
  /** Types possibles à un emplacement : la marge reçoit les ports, le corps la prise et la logique. */
  const typesAt = (p: Place): PortTool[] => (p.side === "dessus" ? ["énergie", "logique"] : ["objet", "fluide", "logique"]);

  function renderBubble(): void {
    const box = $("#bld-bubble");
    const p = bubble?.kind === "port" ? entry?.ports[bubble.index] : undefined;
    if (!bubble || !entry || (bubble.kind === "port" && !p)) {
      box.hidden = true;
      box.innerHTML = "";
      if (bubble) bubble = null;
      return;
    }
    const pressed = (on: boolean) => `aria-pressed="${on}"`;
    if (bubble.kind === "port" && p) {
      const types = typesAt(p).map((x) => `<button type="button" data-bb-type="${x}" ${pressed(p.type === x)}>${typeName(x)}</button>`).join("");
      const dirs = DIRS.map((d) => `<button type="button" data-bb-dir="${d}" ${pressed(p.direction === d)}>${dirLabel(d)}</button>`).join("");
      box.innerHTML = `<div class="row"><b>${esc(typeName(p.type))} · ${esc(dirLabel(p.direction))}</b><span class="hint">${esc(placeText(p))}</span></div>
        <div class="row"><span class="hint">${t("bld.type")}</span>${types}</div>
        <div class="row"><span class="hint">${t("bld.dir")}</span>${dirs}</div>
        <label class="hint">${t("bld.tip")}<input type="text" data-pf="tip" value="${esc(p.tip ?? "")}" placeholder="${esc(t("bld.tip.ph"))}"></label>
        <div class="row"><button type="button" data-bb-del>${t("bld.delete")}</button><button type="button" class="link small" data-bb-close>${t("bld.close")}</button></div>`;
    } else if (bubble.kind === "new") {
      const place = bubble.place;
      const dirs = DIRS.map((d) => `<button type="button" data-bb-ndir="${d}" ${pressed(bubbleDir === d)}>${dirLabel(d)}</button>`).join("");
      const types = typesAt(place).map((x) => `<button type="button" data-bb-new="${x}"><i class="bld-sw ${x}"></i>${typeName(x)}</button>`).join("");
      box.innerHTML = `<div class="row"><b>${t("bld.newPort")}</b><span class="hint">${esc(placeText(place))}</span></div>
        <div class="row"><span class="hint">${t("bld.dir")}</span>${dirs}</div>
        <div class="row"><span class="hint">${t("bld.place")}</span>${types}</div>
        <div class="row"><button type="button" class="link small" data-bb-close>${t("bld.close")}</button></div>`;
    }
    box.hidden = false;
    placeBubble();
  }

  /** Place la bulle à côté de son port (ou de sa case), dans le cadre, en suivant le zoom. */
  function placeBubble(): void {
    const box = $("#bld-bubble");
    if (!bubble || box.hidden || !entry) return;
    const el = root.querySelector<SVGSVGElement>("#bld-svg");
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return;
    const { w, h } = entry.footprint!;
    const at = bubble.kind === "port" ? entry.ports[bubble.index] : { ...bubble.place, type: "objet" as const, direction: "entrée" as const };
    if (!at) return;
    const [x, y] = portCenter(w, h, at);
    const pt = el.createSVGPoint();
    pt.x = x + off;
    pt.y = y + off;
    const s = pt.matrixTransform(ctm);
    const stage = (box.parentElement as HTMLElement).getBoundingClientRect();
    const bw = box.offsetWidth || 250;
    const bh = box.offsetHeight || 150;
    let left = s.x - stage.left + 22;
    if (left + bw > stage.width) left = s.x - stage.left - 22 - bw;
    left = Math.max(0, Math.min(stage.width - bw, left));
    const top = Math.max(0, Math.min(stage.height - bh, s.y - stage.top - bh / 2));
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  function closeBubble(): void {
    if (!bubble) return;
    bubble = null;
    refreshCanvas(true);
  }

  // ---------------------------------------------------------------- interface (S10)
  const machineRecipes = (id: string) => [...data.recipes.values()].filter((r) => r.machine === id && !r.parts);
  const qtyText = (o: Record<string, number | null>) =>
    Object.entries(o)
      .map(([k, q]) => `${q === null ? "?" : fmt(q, 3)} ${data.items.get(k)?.name ?? k}`)
      .join(" + ");

  /** Détail d'un réglage : ses positions (texte du jeu et crafts), ou son nombre. */
  function settingDetail(st: InterfaceSetting, k: number, recs: ReturnType<typeof machineRecipes>): string {
    if (st.number) {
      const scales = (["entrées", "sorties", "énergie"] as const).map((x) => `<option value="${x}"${st.number!.scales === x ? " selected" : ""}>${t(`if.scale.${x}`)}</option>`).join("");
      return `<div class="row"><label>${t("if.default")} <input type="text" inputmode="decimal" class="num" data-if="default" data-s="${k}" value="${esc(fmt(st.number.default, 3))}"></label>
        <label>${t("if.scales")} <select data-if="scales" data-s="${k}">${scales}<option value=""${st.number.scales ? "" : " selected"}>${t("if.scale.none")}</option></select></label></div>`;
    }
    if (!st.choices) return "";
    const crafts = (j: number, c: NonNullable<InterfaceSetting["choices"]>[number]) =>
      recs.length
        ? recs
            .map((r) => `<label class="bld-check"><input type="checkbox" data-if="recipe" data-s="${k}" data-c="${j}" data-r="${esc(r.id)}"${c.recipes.includes(r.id) ? " checked" : ""}> ${esc(qtyText(r.inputs) || t("rc.nothing"))} → ${esc(qtyText(r.outputs))}</label>`)
            .join("")
        : `<span class="hint">${t("if.noCraft")}</span>`;
    const rows = st.choices
      .map(
        (c, j) =>
          `<tr><td><input type="text" data-if="label" data-s="${k}" data-c="${j}" value="${esc(c.label)}" placeholder="${esc(t("if.pos.ph"))}">${c.doubt ? `<div class="hint">⚠ ${txtHtml(c.doubt)}</div>` : ""}</td><td>${crafts(j, c)}</td><td><button type="button" class="link small" data-if-del-choice data-s="${k}" data-c="${j}">${t("if.remove")}</button></td></tr>`,
      )
      .join("");
    return `<table><thead><tr><th>${t("if.th.pos")}</th><th>${t("if.th.crafts")}</th><th></th></tr></thead><tbody>${rows}</tbody></table><button type="button" class="link small" data-if-add-choice data-s="${k}">${t("if.addPos")}</button>`;
  }

  /** Interface en vigueur (copie locale, sinon dépôt), pour savoir si la saisie a changé. */
  const ifaceBase = (id: string) => localIfaces[id] ?? repoIfaces[id] ?? null;
  const ifaceChanged = (id: string) => JSON.stringify(iface) !== JSON.stringify(ifaceBase(id));

  function renderIface(): void {
    const box = $("#bld-iface");
    if (!selectedId) return;
    const i = iface;
    const state = localIfaces[selectedId] ? ` <span class="bld-badge local">${t("bld.badge.local")}</span>` : "";
    $("#bld-s-iface").innerHTML = `${t("if.summary")} <span class="hint">· ${i ? esc(kindLabel(i.kind)) : t("if.none")}</span>${state}`;
    const kinds = `<select data-if="kind"><option value=""${i ? "" : " selected"}>${t("if.none")}</option>${INTERFACE_KINDS.map((k) => `<option value="${esc(k)}"${i?.kind === k ? " selected" : ""}>${esc(kindLabel(k))}</option>`).join("")}</select>`;
    let body = "";
    if (i) {
      const recs = machineRecipes(selectedId);
      body += `<div class="row"><label>${t("if.where")} <input type="text" data-if="where" value="${esc(i.where ?? "")}" placeholder="${esc(t("if.where.ph"))}"></label>
        <label class="bld-check"><input type="checkbox" data-if="once"${i.once ? " checked" : ""}> ${t("if.once.label")}</label></div>`;
      i.settings.forEach((st, k) => {
        const sort = st.choices ? "positions" : st.number ? "nombre" : "aucun";
        const opt = (v: string, label: string) => `<option value="${v}"${sort === v ? " selected" : ""}>${label}</option>`;
        body += `<div class="set"><div class="row"><label>${t("if.setting")} <input type="text" data-if="name" data-s="${k}" value="${esc(st.name)}" placeholder="${esc(t("if.setting.ph"))}"></label>
          <label>${t("if.sort")} <select data-if="sort" data-s="${k}">${opt("positions", t("if.sort.positions"))}${opt("nombre", t("if.sort.nombre"))}${opt("aucun", t("if.sort.aucun"))}</select></label>
          <button type="button" class="link small" data-if-del-setting data-s="${k}">${t("if.delSetting")}</button></div>${st.note ? `<p class="hint">${txtHtml(st.note)}</p>` : ""}${settingDetail(st, k, recs)}</div>`;
      });
      body += `<div class="row"><button type="button" class="link small" data-if-add-setting>${t("if.addSetting")}</button></div>
        <label class="bld-notes">${t("if.effect")} <input type="text" data-if="effect" value="${esc(i.effect ?? "")}" placeholder="${esc(t("if.effect.ph"))}"></label>`;
      if (i.notes) body += `<p class="hint">${txtHtml(i.notes)}</p>`;
      const src = i.sources.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(txt(x.page ?? x.wiki))}</a>` : txtHtml(x.note ?? x.wiki))).join(" · ");
      if (src) body += `<p class="hint">${t("if.sources", { list: src })}</p>`;
      const problems = checkInterface(i, recs.map((r) => r.id));
      if (problems.length) body += `<ul class="bld-problems">${problems.map((p) => `<li>${txtHtml(p)}</li>`).join("")}</ul>`;
    }
    box.innerHTML = `<div class="bld-iface"><p class="hint">${t("if.intro")}</p>
      <div class="row"><label>${t("bld.type")} ${kinds}</label></div>${body}</div>`;
  }

  /** Une saisie dans la section « Interface » (champ, case ou liste). `redraw` : redessiner la section. */
  function ifaceInput(el: HTMLInputElement, redraw: boolean): void {
    const f = el.dataset.if!;
    if (f === "kind") {
      iface = el.value ? { ...(iface ?? { settings: [], sources: [] }), kind: el.value as InterfaceKind } : null;
      renderStatus();
      return renderIface();
    }
    if (!iface) return;
    const st = el.dataset.s !== undefined ? iface.settings[Number(el.dataset.s)] : undefined;
    const choice = st?.choices?.[Number(el.dataset.c)];
    if (f === "where") iface.where = el.value || undefined;
    else if (f === "once") iface.once = el.checked || undefined;
    else if (f === "effect") iface.effect = el.value || undefined;
    else if (f === "name" && st) st.name = el.value;
    else if (f === "label" && choice) choice.label = el.value;
    else if (f === "recipe" && choice) choice.recipes = el.checked ? [...choice.recipes, el.dataset.r!] : choice.recipes.filter((r) => r !== el.dataset.r);
    else if (f === "default" && st?.number) {
      const v = parseNum(el.value);
      if (v > 0) st.number.default = v;
    } else if (f === "scales" && st?.number) st.number.scales = (el.value || null) as NonNullable<InterfaceSetting["number"]>["scales"];
    else if (f === "sort" && st) {
      delete st.choices;
      delete st.number;
      if (el.value === "positions") st.choices = [{ label: "", recipes: [] }];
      if (el.value === "nombre") st.number = { default: 1, scales: null };
    }
    renderStatus();
    if (redraw) renderIface();
  }

  // ---------------------------------------------------------------- ensemble modulaire (S12, S19)
  const modName = (id: string) => data.machines.get(id)?.name ?? id;
  /** Nom sans le début commun à tous les blocs de l'ensemble (« Diesel Engine Crankshaft » → « Crankshaft »). */
  function shortName(a: ModAssembly, id: string): string {
    const names = a.blocks.map((b) => modName(b.id).split(" "));
    let k = 0;
    while (names.every((n) => n.length > k + 1 && n[k] === names[0]![k])) k++;
    return modName(id).split(" ").slice(k).join(" ");
  }
  const modChip = (a: ModAssembly) => (id: string) => `<span class="mchip"><button type="button" class="link" data-bld="${esc(id)}" title="${esc(t("bld.open", { m: modName(id) }))}">${esc(shortName(a, id))}</button></span>`;

  /** Sources d'un ensemble de faits, en texte (pour le survol). */
  function srcText(ids: string[]): string {
    return [...new Set(ids)]
      .map((id) => repoModular.sources[id])
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => `${s.wiki === "miraheze" ? "Miraheze" : s.wiki === "fandom" ? "Fandom" : s.wiki === "jeu" ? t("bld.src.game") : t("bld.src.mine")}${s.page ? ` (${txt(s.page)})` : ""}`)
      .filter((x, i, all) => all.indexOf(x) === i)
      .join(" · ");
  }
  /** ⚠ sur une question encore ouverte (le détail au survol). */
  const openMark = (f: ModFact | undefined) => (isOpen(repoModular, f) ? `<span class="must unk" data-ref="${esc(f!.question!)}" title="${esc(t("bld.open.title", { text: txt(f!.text) }))}">${t("bld.toRecord")}</span>` : "");

  /** Les quatre cases autour de la grille (blocs par contact) ; cachées pour les autres bâtiments. */
  function renderFaces(): void {
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    const contact = !!found && found.assembly.assembly === "contact";
    $("#bld-cross").classList.toggle("with-faces", contact);
    const buttons = root.querySelectorAll<HTMLButtonElement>("[data-box]");
    if (!contact) {
      for (const b of buttons) b.hidden = true;
      return;
    }
    const { assembly: a, block: b } = found!;
    const info = blockFaces(b, modDraft ?? localMod[b.id]);
    const boxes = faceBoxes(info);
    const texts = [info.facesFact, info.requiredFact].filter((f): f is ModFact => !!f);
    const title = `${texts.map((f) => txt(f.text)).join(" ")}${texts.length ? t("bld.faces.sources", { list: srcText(texts.flatMap((f) => f.sources)) }) : ""}${info.local ? t("bld.faces.yours") : ""}${t("bld.faces.click")}`;
    const split = !!(modDraft ?? localMod[b.id])?.sides;
    for (const el of buttons) {
      const box = el.dataset.box as FaceBox;
      el.hidden = false;
      el.classList.toggle("on", openBox === box);
      if (!boxes) {
        el.className = `bld-face bld-face-${box} unk${openBox === box ? " on" : ""}`;
        el.title = t("bld.faces.unknown");
        el.innerHTML = `<b>${boxLabel(box)}</b><span class="names">?</span>${openMark(info.facesFact)}`;
        continue;
      }
      const f = boxes[box];
      const side = box === "gauche" || box === "droite";
      el.className = `bld-face bld-face-${box}${f.required ? " req" : ""}${f.blocks.length ? "" : " none"}${openBox === box ? " on" : ""}`;
      el.title = title;
      el.setAttribute("aria-expanded", String(openBox === box));
      const label = side ? (split ? t("box.sideOf", { side: sideLabel(box) }) : t("box.sides")) : boxLabel(box);
      const names = f.blocks.length ? f.blocks.map((id) => esc(shortName(a, id))).join(" · ") : t("bld.faces.nothing");
      // La question ouverte vaut pour tout le bloc : un seul ⚠, sur la case du bas.
      el.innerHTML = `<b>${label}${f.required ? ` <span class="req-tag">${t("bld.required")}</span>` : ""}</b><span class="names">${names}</span>${box === "bas" ? openMark(info.facesFact) : ""}`;
    }
  }

  /** Case de face ouverte sous la grille : blocs qu'elle accueille, obligatoire, côtés à part. */
  function renderFacePop(): void {
    const box = $("#bld-facepop");
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found || !openBox || !modDraft) {
      box.innerHTML = "";
      return;
    }
    const { assembly: a } = found;
    const info = blockFaces(found.block, modDraft);
    const f = faceBoxes(info)?.[openBox] ?? { blocks: [], required: false };
    const side = openBox === "gauche" || openBox === "droite";
    const split = !!modDraft.sides;
    const label = side ? (split ? t("box.sideOf", { side: sideLabel(openBox) }) : t("box.sidesBoth")) : boxLabel(openBox);
    const chips = a.blocks
      .map((x) => `<label class="mchip${f.blocks.includes(x.id) ? "" : " off"}"><input type="checkbox" data-fp="block" data-id="${esc(x.id)}"${f.blocks.includes(x.id) ? " checked" : ""}> ${esc(shortName(a, x.id))}</label>`)
      .join("");
    const texts = [info.facesFact, info.requiredFact].filter((x): x is ModFact => !!x);
    const src = texts.length ? `<p class="hint">${texts.map((x) => `${txtHtml(x.text)} ${openMark(x)}`).join(" ")} <span title="${esc(srcText(texts.flatMap((x) => x.sources)))}">${t("bld.facepop.srcHover")}</span></p>` : "";
    box.innerHTML = `<div class="bld-facepop"><div class="row"><b>${label}</b><span class="hint">${t("bld.facepop.what")}</span></div>
      <div class="row">${chips}</div>
      <div class="row"><label class="bld-check"><input type="checkbox" data-fp="req"${f.required ? " checked" : ""}> ${t("bld.facepop.req")}</label>
      ${side ? `<label class="bld-check" title="${esc(t("bld.facepop.split.title"))}"><input type="checkbox" data-fp="split"${split ? " checked" : ""}> ${t("bld.facepop.split")}</label>` : ""}</div>
      ${src}
      <label class="bld-notes">${t("bld.facepop.note")} <input type="text" data-fp="note" value="${esc(modDraft.note ?? "")}" placeholder="${esc(t("bld.facepop.note.ph"))}"></label>
      <div class="row"><button type="button" data-fp-close>${t("bld.close")}</button><button type="button" class="link small" data-mod-cancel>${t("bld.facepop.cancel")}</button></div></div>`;
  }

  /** Portée d'un bloc de la ferme, sur une ligne (S19) ; ✎ la corrige sur place. */
  function renderRange(): void {
    const el = $("#bld-range");
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    const btn = $("#bld-rangebtn");
    if (!found || found.assembly.assembly === "contact") {
      el.hidden = true;
      btn.hidden = true;
      return;
    }
    const { assembly: a, block: b } = found;
    const size = data.machines.get(b.id)?.size ?? null;
    const edits = modDraft ? { ...localMod, [b.id]: modDraft } : localMod;
    const r = blockRange(a, b, size, edits);
    btn.hidden = r.fromCenter === null;
    btn.setAttribute("aria-pressed", String(showRange));
    const parts: string[] = [];
    if (rangeEdit && modDraft) {
      const v = typeof r.tiles === "number" ? fmt(r.tiles, 2) : "";
      parts.push(
        `<span><b>${t("bld.range.label")}</b> <input type="text" inputmode="decimal" class="num" data-mod="range" value="${v}"${r.tiles === "infinie" ? " disabled" : ""} aria-label="${esc(t("bld.range.aria"))}"> ${t("bld.range.fromEdge")} <label class="bld-check"><input type="checkbox" data-mod="infinite"${r.tiles === "infinie" ? " checked" : ""}> ${t("bld.range.infinite")}</label></span>`,
      );
      const others = a.blocks.filter((x) => x.id !== b.id);
      parts.push(`<span><b>${t("bld.serves")}</b> ${others.map((x) => `<label class="mchip${r.serves.includes(x.id) ? "" : " off"}"><input type="checkbox" data-mod="serve" data-id="${esc(x.id)}"${r.serves.includes(x.id) ? " checked" : ""}> ${esc(shortName(a, x.id))}</label>`).join("")}</span>`);
      parts.push(`<span><button type="button" data-range-done>${t("bld.close")}</button> <button type="button" class="link small" data-mod-cancel>${t("bld.cancel")}</button></span>`);
    } else {
      const src = r.rangeFact ? ` title="${esc(`${txt(r.rangeFact.text)}${t("bld.faces.sources", { list: srcText(r.rangeFact.sources) })}`)}"` : "";
      const tiles =
        r.tiles === null ? `<span class="hint">${t("bld.range.none")}</span>` : r.tiles === "infinie" ? t("bld.range.infinite") : esc(t("bld.range.text", { r: fmt(r.tiles, 2), c: r.fromCenter !== null ? t("bld.range.center", { c: fmt(r.fromCenter, 2) }) : "" }));
      parts.push(`<span${src}><b>${t("bld.range.label")}</b> ${tiles} ${openMark(r.rangeFact)}</span>`);
      if (r.serves.length) parts.push(`<span><b>${t("bld.serves")}</b> ${r.serves.map(modChip(a)).join("")}</span>`);
      if (r.servedBy.length) {
        const reach = (x: number | "infinie" | null) => (x === "infinie" ? t("bld.reach.infinite") : typeof x === "number" ? t("bld.reach.cells", { n: fmt(x, 2) }) : t("bld.reach.unknown"));
        parts.push(`<span><b>${t("bld.servedBy")}</b> ${r.servedBy.map((x) => `${modChip(a)(x.id)}<span class="hint">(${reach(x.tiles)})</span>`).join(" ")}</span>`);
      }
      parts.push(`<button type="button" class="link small" data-range-edit>${t("bld.fix")}</button>`);
    }
    el.hidden = false;
    el.innerHTML = parts.join("");
  }

  /** Repliable « Ensemble » : « À savoir » (ferme) et le bloc « Calcul » (S13, S18). */
  function renderModMore(): void {
    const det = $("#bld-d-mod") as HTMLDetailsElement;
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found) {
      det.hidden = true;
      $("#bld-mod").innerHTML = "";
      return;
    }
    det.hidden = false;
    const { assembly: a, block: b } = found;
    let body = "";
    if (a.assembly !== "contact") {
      const notes = RANGE_NOTES.map((k) => fact(b, k)).filter((f): f is ModFact => !!f);
      if (notes.length) body += `<h5>${t("bld.know")}</h5><ul class="bld-know">${notes.map((f) => `<li title="${esc(srcText(f.sources))}">${txtHtml(f.text)} ${openMark(f)}</li>`).join("")}</ul>`;
    }
    body += modCalcHtml(repoModular, data, a, mcState, diesel.get(), mcMsg);
    const what = t(a.id === "diesel-engine" ? "bld.mod.what.dsl" : a.id === "tree-farm" ? "bld.mod.what.farm" : "bld.mod.what");
    $("#bld-s-mod").innerHTML = `⬡ ${esc(a.name)} <span class="hint">· ${what}</span>`;
    $("#bld-mod").innerHTML = `<div class="bld-mod">${body}</div>`;
  }

  function renderModular(): void {
    renderFaces();
    renderFacePop();
    renderRange();
    renderModMore();
  }

  /** Brouillon de correction : les valeurs en vigueur (dépôt, ou correction locale). */
  function modDraftFrom(a: ModAssembly, b: ModBlock): ModularEdit {
    const edit = localMod[b.id];
    const draft: ModularEdit = { source: surveySource("correction notée dans l'éditeur de bâtiments du calculateur") };
    if (a.assembly === "contact") {
      const faces = blockFaces(b, edit).faces ?? [];
      draft.faces = Object.fromEntries(faces.map((r) => [r.face, [...r.blocks]]));
      draft.facesRequired = Object.fromEntries(faces.map((r) => [r.face, r.required === true]));
      if (edit?.sides) draft.sides = structuredClone(edit.sides);
    } else {
      const r = blockRange(a, b, data.machines.get(b.id)?.size ?? null, localMod);
      if (r.tiles !== null) draft.rangeTiles = r.tiles;
      draft.serves = [...r.serves];
    }
    if (edit?.note) draft.note = edit.note;
    return draft;
  }

  function ensureDraft(): ModularEdit | null {
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found) return null;
    modDraft ??= modDraftFrom(found.assembly, found.block);
    return modDraft;
  }

  /** Saisie dans une case de face ouverte. */
  function facePopInput(el: HTMLInputElement): void {
    if (!modDraft || !openBox) return;
    const f = el.dataset.fp!;
    if (f === "note") return void (modDraft.note = el.value || undefined);
    if (f === "block") modDraft = toggleFaceBlock(modDraft, openBox, el.dataset.id!, el.checked);
    else if (f === "req") modDraft = setFaceRequired(modDraft, openBox, el.checked);
    else if (f === "split") modDraft = splitSides(modDraft, el.checked);
    renderModular();
    renderStatus();
  }

  /** Saisie dans la portée en cours de correction. */
  function rangeInput(el: HTMLInputElement): void {
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found || !modDraft) return;
    const b = found.block;
    const f = el.dataset.mod!;
    const id = el.dataset.id;
    if (f === "serve" && id) modDraft.serves = el.checked ? [...(modDraft.serves ?? []).filter((x) => x !== id), id] : (modDraft.serves ?? []).filter((x) => x !== id);
    else if (f === "infinite") {
      const repoTiles = fact(b, "rangeTiles")?.value;
      modDraft.rangeTiles = el.checked ? "infinie" : typeof repoTiles === "number" ? repoTiles : undefined;
    } else if (f === "range") {
      const v = parseNum(el.value);
      if (v > 0) {
        modDraft.rangeTiles = v;
        message = "";
      } else message = t("bld.range.bad");
    }
    renderRange();
    renderMode();
    renderStatus();
    if (showRange) refreshCanvas(true);
  }

  /** Correction des faces ou de la portée qui serait enregistrée (null : rien de différent). */
  function modPending(): ModularEdit | null | undefined {
    if (!modDraft || !selectedId) return undefined;
    const found = findBlock(repoModular, selectedId)!;
    return editDiff(found.assembly, found.block, { ...modDraft, frontEdge: localMod[selectedId]?.frontEdge });
  }

  /** Saisie du bloc « Calcul » : seul le résultat est redessiné (la case garde le curseur). */
  function mcInput(el: HTMLInputElement): void {
    const a = selectedId ? assemblyOf.get(selectedId) : undefined;
    if (!a) return;
    const k = el.dataset.mc!;
    if (k === "fuel") {
      mcState.diesel.fuel = el.value;
      const out = root.querySelector("#mc-out");
      if (out) out.innerHTML = modCalcOut(repoModular, data, a, mcState, diesel.get());
      return;
    }
    const v = parseNum(el.value);
    if (!Number.isFinite(v) || el.value === "") return;
    if (a.id === "tree-farm" && k in mcState.farm) (mcState.farm as Record<string, number>)[k] = k === "pollution" ? v : Math.max(0, Math.round(v));
    else if (a.id === "diesel-engine" && k in mcState.diesel) (mcState.diesel as unknown as Record<string, number>)[k] = Math.max(0, v);
    const out = root.querySelector("#mc-out");
    if (out) out.innerHTML = modCalcOut(repoModular, data, a, mcState, diesel.get());
  }

  // ---------------------------------------------------------------- capture, manques, boutons
  function renderBgPanel(): void {
    const details = $("#bld-bg") as HTMLDetailsElement;
    if (bg) details.open = true;
    $("#bld-bgbody").innerHTML = `
      <div class="bld-row">
        <label class="button">${t(bg ? "bld.bg.change" : "bld.bg.pick")}<input type="file" id="bld-bgfile" accept="image/*" hidden></label>
        ${
          bg
            ? `<button type="button" id="bld-corners"${mode === "coins" ? ' aria-pressed="true"' : ""}>${t("bld.bg.corners")}</button>
          <button type="button" id="bld-bgr">${t("bld.bg.rotate")}</button>
          <label>${t("bld.bg.opacity")} <input type="range" id="bld-bgo" min="0.1" max="1" step="0.05" value="${bg.opacity}"></label>
          <button type="button" class="link" id="bld-bgdel">${t("bld.bg.del")}</button>`
            : ""
        }
      </div>
      <ol class="hint bld-steps">
        <li>${t("bld.bg.step1")}</li>
        <li>${t("bld.bg.step2.html")}</li>
        <li>${t("bld.bg.step3.html")}</li>
      </ol>`;
  }

  function renderNotesSummary(): void {
    $("#bld-s-notes").innerHTML = `${t("bld.notes")}${entry?.notes ? ` <span class="hint">${t("bld.notes.one")}</span>` : ""}`;
  }

  /** Ce qui n'est pas encore enregistré : relevé, interface, correction du bloc. */
  function pendingParts(): string[] {
    if (!entry || !selectedId) return [];
    const out: string[] = [];
    if (entryChanged(entry, local[selectedId] ?? repo.machines[selectedId])) out.push(t("bld.pend.record"));
    if (ifaceChanged(selectedId)) out.push(t("bld.pend.iface"));
    const mod = modPending();
    // Comparaison sans la source : sa date change à chaque brouillon.
    const strip = (x: ModularEdit | null | undefined) => (x ? JSON.stringify({ ...x, source: undefined }) : "null");
    if (mod !== undefined && strip(mod) !== strip(localMod[selectedId])) out.push(t(findBlock(repoModular, selectedId)?.assembly.assembly === "contact" ? "bld.pend.faces" : "bld.pend.range"));
    return out;
  }

  function renderStatus(): void {
    if (!entry || !selectedId) return;
    const list = checkEntry(entry);
    const hint = powerHint(selectedId);
    const noPlug = !entry.noPower && !entry.ports.some((p) => p.type === "énergie");
    const problems = list.length
      ? `<ul class="bld-problems">${list.map((p) => `<li>${esc(p)}</li>`).join("")}${noPlug && hint ? `<li class="hint">${esc(hint)}</li>` : ""}</ul>`
      : `<span class="ok-text">${t("bld.complete")}</span>`;
    const pending = pendingParts();
    const dirty = pending.length ? `<span class="bld-dirty">${esc(t("bld.dirty", { list: pending.join(", ") }))}</span>` : "";
    $("#bld-status").innerHTML = `${problems}${dirty}`;
  }

  function renderActions(): void {
    const id = selectedId;
    const any = !!id && !!(local[id] || localIfaces[id] || localMod[id]);
    $("#bld-actions").innerHTML = `<button type="button" class="primary" id="bld-save">${t("bld.save")}</button>${
      any ? `<button type="button" class="link" id="bld-forget" title="${esc(t("bld.forget.title"))}">${t("bld.forget")}</button>` : ""
    }`;
  }

    function renderMode(): void {
    if (!bg && mode !== "ports") mode = "ports";
    pz.paused = mode === "capture";
    frame.classList.toggle("mode-capture", mode === "capture");
    frame.classList.toggle("mode-coins", mode === "coins");
    const seg = $("#bld-mode");
    seg.hidden = !bg;
    for (const b of seg.querySelectorAll<HTMLElement>("[data-mode]")) b.setAttribute("aria-checked", String(b.dataset.mode === mode || (mode === "coins" && b.dataset.mode === "ports")));
    $("#bld-help").textContent =
      mode === "coins"
        ? corners.length
          ? t("bld.help.corner2")
          : t("bld.help.corner1")
        : mode === "capture"
          ? t("bld.help.capture")
          : poseBubble
            ? t("bld.help.bubble")
            : t("bld.help.tools");
    $("#bld-msg").textContent = message;
    const cb = root.querySelector("#bld-corners");
    if (cb) cb.setAttribute("aria-pressed", String(mode === "coins"));
  }

  function setMode(m: Mode): void {
    mode = m;
    corners = [];
    bubble = null;
    refreshCanvas(true);
    renderMode();
  }

  /** Un seul « Enregistrer » (S19) : relevé, interface et correction du bloc, seulement ce qui a changé. */
  function saveAll(): void {
    if (!entry || !selectedId) return;
    const id = selectedId;
    const done: string[] = [];
    if (entryChanged(entry, local[id] ?? repo.machines[id])) {
      entry.source = surveySource();
      local[id] = structuredClone(entry);
      save();
      done.push(t(isComplete(entry) ? "bld.pend.record" : "bld.saved.recordIncomplete"));
    }
    if (ifaceChanged(id)) {
      if (iface) {
        // Sources : celles du dépôt, plus cette saisie (une seule, la dernière).
        iface.sources = [...iface.sources.filter((x) => x.wiki !== "saisie"), surveySource("interface notée dans l'éditeur de bâtiments du calculateur")];
        if (JSON.stringify(iface) === JSON.stringify(repoIfaces[id])) delete localIfaces[id];
        else localIfaces[id] = structuredClone(iface);
        done.push(t(checkInterface(iface, machineRecipes(id).map((r) => r.id)).length ? "bld.saved.ifaceIncomplete" : "bld.pend.iface"));
      } else {
        delete localIfaces[id];
        done.push(t("bld.saved.ifaceRemoved"));
      }
      saveLocalInterfaces(localIfaces);
    }
    const mod = modPending();
    if (mod !== undefined) {
      const had = !!localMod[id];
      if (mod) localMod[id] = mod;
      else delete localMod[id];
      saveLocalModular(localMod);
      if (mod || had) done.push(t(findBlock(repoModular, id)?.assembly.assembly === "contact" ? "bld.pend.faces" : "bld.pend.range"));
      modDraft = null;
      openBox = null;
      rangeEdit = false;
    }
    message = done.length ? t("bld.saved", { list: done.join(", ") }) : t("bld.saved.nothing");
    renderList();
    renderEditor();
  }

  // ---------------------------------------------------------------- capture : glisser, molette, clavier
  let bgDrag: { id: number; x: number; y: number; start: BgPlacement } | null = null;
  frame.addEventListener("pointerdown", (e) => {
    if (mode !== "capture" || !bg || e.button !== 0 || (e.target as Element).closest("button")) return;
    bgDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: { x: bg.x, y: bg.y, scale: bg.scale } };
    frame.setPointerCapture(e.pointerId);
    frame.classList.add("dragging");
    frame.focus({ preventScroll: true });
  });
  frame.addEventListener("pointermove", (e) => {
    if (bubble && e.buttons) placeBubble(); // la bulle suit la grille qu'on fait glisser
    if (!bgDrag || !bg || e.pointerId !== bgDrag.id) return;
    const u = pz.unitsPerPixel() / CELL;
    bg.x = bgDrag.start.x + (e.clientX - bgDrag.x) * u;
    bg.y = bgDrag.start.y + (e.clientY - bgDrag.y) * u;
    moveBg();
  });
  const endDrag = (e: PointerEvent) => {
    if (!bgDrag || e.pointerId !== bgDrag.id) return;
    bgDrag = null;
    frame.classList.remove("dragging");
  };
  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);
  frame.addEventListener(
    "wheel",
    (e) => {
      if (mode !== "capture" || !bg) return void (bubble && placeBubble());
      e.preventDefault();
      // Maj + molette : certains navigateurs envoient alors un défilement horizontal.
      const delta = (e.deltaY || e.deltaX) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      const p = toGrid(e.clientX, e.clientY);
      if (!p) return;
      Object.assign(bg, scaleAround(bg, Math.exp(-delta * (e.shiftKey ? 0.0001 : 0.0005)), p[0], p[1]));
      moveBg();
    },
    { passive: false },
  );
  frame.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mode !== "ports") {
      message = mode === "coins" ? t("bld.cornersCancelled") : "";
      setMode("ports");
      return e.preventDefault();
    }
    if (e.key === "Escape" && bubble) {
      closeBubble();
      return e.preventDefault();
    }
    if (mode !== "capture" || !bg || e.target !== frame) return;
    const step = e.shiftKey ? 1 : 0.1; // en cases
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const { w, h } = entry!.footprint!;
    if (moves[e.key]) {
      bg.x += moves[e.key]![0];
      bg.y += moves[e.key]![1];
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      Object.assign(bg, scaleAround(bg, e.key === "-" ? 1 / 1.01 : 1.01, (w / 2 + 1) * CELL, (h / 2 + 1) * CELL));
    } else return;
    moveBg();
    e.preventDefault();
  });
  $("#bld-bubble").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeBubble();
      frame.focus({ preventScroll: true });
    }
  });

  // ---------------------------------------------------------------- événements
  root.addEventListener("input", (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.id === "bld-search") {
      filter = el.value;
      renderList();
      return;
    }
    if (!entry) return;
    if (el.id === "bld-w" || el.id === "bld-h") {
      const v = Math.max(1, Math.min(200, Math.round(Number(el.value)) || 1));
      entry.footprint = { w: el.id === "bld-w" ? v : entry.footprint!.w, h: el.id === "bld-h" ? v : entry.footprint!.h };
      bubble = null;
      renderHead();
      refreshCanvas();
    } else if (el.dataset.if && el.type === "text") ifaceInput(el, false);
    else if (el.dataset.fp === "note") facePopInput(el);
    else if (el.dataset.mod === "range") rangeInput(el);
    else if (el.dataset.mc) mcInput(el);
    else if (el.id === "bld-notes") {
      entry.notes = el.value || undefined;
      renderStatus();
    } else if (el.id === "bld-bgo" && bg) {
      bg.opacity = Number(el.value);
      root.querySelector("#bld-bgimg")?.setAttribute("opacity", String(bg.opacity));
    } else if (el.dataset.pf === "tip" && bubble?.kind === "port") {
      const p = entry.ports[bubble.index]!;
      p.tip = el.value || undefined;
      root.querySelector(`[data-port="${bubble.index}"] title`)!.textContent = portTitle(p);
      renderStatus();
    }
  });

  root.addEventListener("change", async (ev) => {
    const el = ev.target as HTMLInputElement & HTMLSelectElement;
    if (!entry && el.id !== "bld-import") return;
    if (el.dataset.if) {
      // Les champs texte sont pris en compte à la frappe (pas de redessin : un clic qui suit doit garder son bouton).
      if ((el as HTMLInputElement).type !== "text") ifaceInput(el as HTMLInputElement, true);
      return;
    }
    if (el.dataset.fp) {
      if (el.dataset.fp !== "note") facePopInput(el);
      return;
    }
    if (el.dataset.mod) {
      if (el.dataset.mod !== "range") rangeInput(el);
      return;
    }
    if (el.id === "bld-nopower") {
      if (el.checked) entry!.noPower = true;
      else delete entry!.noPower;
      renderStatus();
    } else if (el.id === "bld-noports") {
      if (el.checked) entry!.noPorts = true;
      else delete entry!.noPorts;
      renderStatus();
    } else if (el.id === "bld-bgfile" && el.files?.[0]) {
      const url = URL.createObjectURL(el.files[0]);
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
      } catch {
        URL.revokeObjectURL(url);
        message = t("bld.bg.unreadable");
        return renderMode();
      }
      if (bg) URL.revokeObjectURL(bg.url);
      // Départ : capture 3 fois plus large que la grille, centrée ; le calage sur 2 coins fait le reste.
      const { w, h } = entry!.footprint!;
      const scale = (3 * (w + 2) * CELL) / img.naturalWidth;
      bg = {
        url,
        natW: img.naturalWidth,
        natH: img.naturalHeight,
        scale,
        x: ((w + 2) / 2) - (img.naturalWidth * scale) / 2 / CELL,
        y: ((h + 2) / 2) - (img.naturalHeight * scale) / 2 / CELL,
        rot: 0,
        opacity: 0.85,
      };
      message = "";
      mode = "coins";
      corners = [];
      bubble = null;
      renderBgPanel();
      refreshCanvas(true);
      pz.fitBox(imageBox(bg));
      renderMode();
      frame.focus({ preventScroll: true });
    } else if (el.id === "bld-import" && el.files?.[0]) {
      try {
        const raw = JSON.parse(await el.files[0].text());
        const parsed = parseSurveys(raw);
        if (!parsed) throw new Error(t("bld.import.badFormat"));
        local = { ...local, ...parsed };
        save();
        const ifs = raw && typeof raw === "object" && "interfaces" in raw ? (parseInterfaces(raw) ?? {}) : {};
        localIfaces = { ...localIfaces, ...ifs };
        saveLocalInterfaces(localIfaces);
        const mods = parseModular(raw) ?? {};
        localMod = { ...localMod, ...mods };
        saveLocalModular(localMod);
        const nIf = Object.keys(ifs).length;
        const nMod = Object.keys(mods).length;
        // Relevés de configuration du moteur diesel (S18) : un relevé de même id remplace l'ancien.
        const dsl = Array.isArray(raw?.diesel) ? (raw.diesel as unknown[]).map(parseDieselReading).filter((r): r is DieselReading => !!r) : [];
        if (dsl.length) diesel.set([...diesel.get().filter((r) => !dsl.some((d) => d.id === r.id)), ...dsl]);
        $("#bld-io").textContent = t("bld.io.imported", { list: ioCounts(Object.keys(parsed).length, nIf, nMod, dsl.length) });
        renderList();
        if (selectedId) select(selectedId);
      } catch (err) {
        $("#bld-io").textContent = t("bld.io.importFailed", { err: (err as Error).message });
      }
      el.value = "";
    }
  });

  root.addEventListener("click", (ev) => {
    const target = ev.target as Element;
    const item = target.closest<HTMLElement>("[data-bld]");
    if (item) return select(item.dataset.bld!);
    if (target.closest("#bld-export")) return exportFile();
    if (target.closest("#bld-send")) return onSend?.(surveysPiece());
    if (!entry || !selectedId) return;
    // Bloc « Calcul » (S13) : blocs au plus juste pour les arbres, ou une configuration relevée du moteur.
    if (target.closest("[data-mc-fit]")) {
      const rates = farmRates(repoModular);
      if (rates) Object.assign(mcState.farm, farmBlocks(rates, mcState.farm.trees));
      return renderModMore();
    }
    const cfgBtn = target.closest<HTMLElement>("[data-mc-cfg]");
    if (cfgBtn) {
      const c = dieselConfigs(repoModular, diesel.get()).find((x) => x.id === cfgBtn.dataset.mcCfg);
      if (c) mcState.diesel = { cylinders: c.cylinders, airFuel: c.airFuel, throttle: c.throttle, fuel: c.fuel };
      return renderModMore();
    }
    // Relevé de configuration du moteur (S18) : enregistrer, ou retirer un relevé de ce navigateur.
    if (target.closest("[data-dr-save]")) {
      const r = readDieselForm(root);
      if (typeof r === "string") mcMsg = r;
      else {
        diesel.set([...diesel.get(), r]);
        mcMsg = t("bld.dsl.saved");
        mcState.diesel = { cylinders: r.cylinders, airFuel: r.airFuel, throttle: r.throttle, fuel: r.fuel };
      }
      return renderModMore();
    }
    const del = target.closest<HTMLElement>("[data-dr-del]");
    if (del) {
      diesel.set(diesel.get().filter((r) => r.id !== del.dataset.drDel));
      mcMsg = t("bld.dsl.removed");
      return renderModMore();
    }
    // Cases des faces (S19).
    const boxBtn = target.closest<HTMLElement>("[data-box]");
    if (boxBtn) {
      const box = boxBtn.dataset.box as FaceBox;
      if (openBox === box) openBox = null;
      else if (ensureDraft()) openBox = box;
      renderModular();
      if (openBox) $("#bld-facepop").scrollIntoView({ block: "nearest" });
      return;
    }
    if (target.closest("[data-fp-close]")) {
      openBox = null;
      return renderModular();
    }
    if (target.closest("[data-mod-cancel]")) {
      modDraft = null;
      openBox = null;
      rangeEdit = false;
      message = "";
      renderModular();
      if (showRange) refreshCanvas(true);
      renderMode();
      return renderStatus();
    }
    if (target.closest("[data-range-edit]")) {
      if (ensureDraft()) rangeEdit = true;
      return renderRange();
    }
    if (target.closest("[data-range-done]")) {
      rangeEdit = false;
      renderRange();
      return renderStatus();
    }
    if (target.closest("#bld-rangebtn")) {
      showRange = !showRange;
      bubble = null;
      refreshCanvas(false);
      return renderRange();
    }
    // Bulle d'un port.
    if (target.closest("[data-bb-close]")) return closeBubble();
    const bbType = target.closest<HTMLElement>("[data-bb-type]");
    if (bbType && bubble?.kind === "port") {
      entry.ports[bubble.index]!.type = bbType.dataset.bbType as Port["type"];
      return refreshCanvas(true);
    }
    const bbDir = target.closest<HTMLElement>("[data-bb-dir]");
    if (bbDir && bubble?.kind === "port") {
      entry.ports[bubble.index]!.direction = bbDir.dataset.bbDir as Port["direction"];
      return refreshCanvas(true);
    }
    if (target.closest("[data-bb-del]") && bubble?.kind === "port") {
      entry.ports.splice(bubble.index, 1);
      bubble = null;
      return refreshCanvas(true);
    }
    const bbNdir = target.closest<HTMLElement>("[data-bb-ndir]");
    if (bbNdir) {
      bubbleDir = bbNdir.dataset.bbNdir as Port["direction"];
      return renderBubble();
    }
    const bbNew = target.closest<HTMLElement>("[data-bb-new]");
    if (bbNew && bubble?.kind === "new") {
      entry.ports = applyTool(entry.ports, bbNew.dataset.bbNew as PortTool, bubble.place, bubbleDir);
      bubble = { kind: "port", index: entry.ports.length - 1 };
      return refreshCanvas(true);
    }
    const poseBtn = target.closest<HTMLElement>("[data-posemode]");
    if (poseBtn) {
      poseBubble = poseBtn.dataset.posemode === "bulle";
      savePose();
      bubble = null;
      renderTools();
      refreshCanvas(true);
      return renderMode();
    }
    const toolBtn = target.closest<HTMLElement>("[data-tool]");
    if (toolBtn) {
      tool = toolBtn.dataset.tool as Tool;
      renderTools();
      if (mode === "capture") setMode("ports"); // choisir un outil, c'est vouloir poser un port
      return;
    }
    const dirBtn = target.closest<HTMLElement>("[data-dir]");
    if (dirBtn && tool !== "gomme") {
      dirByTool[tool] = dirBtn.dataset.dir as Port["direction"];
      return renderTools();
    }
    const modeBtn = target.closest<HTMLElement>("[data-mode]");
    if (modeBtn) {
      message = "";
      return setMode(modeBtn.dataset.mode as Mode);
    }
    const zoomBtn = target.closest<HTMLElement>("[data-bzoom]");
    if (zoomBtn) {
      const z = zoomBtn.dataset.bzoom;
      if (z === "in") pz.zoom(1.25);
      else if (z === "out") pz.zoom(1 / 1.25);
      else pz.fit();
      return placeBubble();
    }
    if (target.closest("#bld-size")) {
      sizeOpen = !sizeOpen;
      renderHead();
      return renderDims();
    }
    if (target.closest("#bld-swap")) {
      const f = entry.footprint!;
      entry.footprint = { w: f.h, h: f.w };
      bubble = null;
      return renderEditor();
    }
    if (target.closest("#bld-corners") && bg) {
      message = "";
      setMode(mode === "coins" ? "ports" : "coins");
      renderBgPanel();
      return frame.focus({ preventScroll: true });
    }
    if (target.closest("#bld-bgr") && bg) {
      bg.rot = (bg.rot + 90) % 360;
      return moveBg();
    }
    if (target.closest("#bld-bgdel")) {
      clearBg();
      renderBgPanel();
      refreshCanvas(true);
      return renderMode();
    }
    if (target.closest("#bld-save")) return saveAll();
    if (target.closest("[data-if-add-setting]") && iface) {
      iface.settings.push({ id: newSettingId(iface), name: "", choices: [{ label: "", recipes: [] }] });
      renderStatus();
      return renderIface();
    }
    const sIdx = Number(target.closest<HTMLElement>("[data-s]")?.dataset.s);
    if (target.closest("[data-if-del-setting]") && iface) {
      iface.settings.splice(sIdx, 1);
      renderStatus();
      return renderIface();
    }
    if (target.closest("[data-if-add-choice]") && iface?.settings[sIdx]?.choices) {
      iface.settings[sIdx]!.choices!.push({ label: "", recipes: [] });
      renderStatus();
      return renderIface();
    }
    if (target.closest("[data-if-del-choice]") && iface?.settings[sIdx]?.choices) {
      iface.settings[sIdx]!.choices!.splice(Number(target.closest<HTMLElement>("[data-c]")!.dataset.c), 1);
      renderStatus();
      return renderIface();
    }
    if (target.closest("#bld-forget")) {
      delete local[selectedId];
      save();
      delete localIfaces[selectedId];
      saveLocalInterfaces(localIfaces);
      delete localMod[selectedId];
      saveLocalModular(localMod);
      select(selectedId);
      message = t("bld.forgotten");
      return renderMode();
    }

    // Clic sur la grille.
    if (!target.closest("#bld-svg") || pz.suppressClick || mode === "capture") return;
    const pt = toGrid((ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
    if (!pt) return;
    const { w, h } = entry.footprint!;
    if (mode === "coins" && bg) {
      corners.push(pt);
      if (corners.length < 2) {
        refreshCanvas(true);
        return renderMode();
      }
      const fit = fitTwoCorners(bg, corners[0]!, corners[1]!, w, h);
      corners = [];
      if (!fit) {
        message = t("bld.corners.close");
        refreshCanvas(true);
        return renderMode();
      }
      bg.x = fit.x;
      bg.y = fit.y;
      bg.scale = fit.scale;
      const gap = Math.max(fit.ratio, 1 / fit.ratio) - 1;
      message =
        gap > 0.12
          ? t("bld.corners.ratio", { pct: fmtPct(String(Math.round(gap * 100))) })
          : t("bld.corners.ok");
      mode = "ports";
      refreshCanvas(true);
      pz.fit();
      renderBgPanel();
      return renderMode();
    }
    const portEl = target.closest<SVGGElement>("[data-port]");
    if (portEl) {
      const i = Number(portEl.dataset.port);
      if (tool === "gomme" && !poseBubble) {
        entry.ports.splice(i, 1);
        bubble = null;
      } else bubble = bubble?.kind === "port" && bubble.index === i ? null : { kind: "port", index: i };
      return refreshCanvas(true);
    }
    const gx = Math.floor(pt[0] / CELL);
    const gy = Math.floor(pt[1] / CELL);
    const inBody = gx >= 1 && gx <= w && gy >= 1 && gy <= h;
    let place: Place | null = null;
    if (poseBubble) {
      if (inBody) {
        const p = bodyPoint(w, h, pt[0], pt[1]);
        if (p) place = { side: "dessus", cell: p };
      } else place = marginToPort(w, h, gx, gy);
      bubble = place ? { kind: "new", place } : null;
      return refreshCanvas(true);
    }
    if (inBody && (tool === "énergie" || tool === "logique" || tool === "gomme")) {
      const p = bodyPoint(w, h, pt[0], pt[1]);
      if (p) place = { side: "dessus", cell: p };
    } else if (!inBody && tool !== "énergie") {
      place = marginToPort(w, h, gx, gy);
    }
    if (!place) return;
    entry.ports = applyTool(entry.ports, tool, place, tool === "gomme" ? "entrée" : dirByTool[tool]);
    bubble = null;
    refreshCanvas(true);
  });

  /** « 3 relevé(s), 1 interface(s)… » : ce qu'un import ou un export contient. */
  function ioCounts(n: number, nIf: number, nMod: number, nDsl: number): string {
    return `${t("bld.io.records", { n: String(n) })}${nIf ? t("bld.io.ifaces", { n: String(nIf) }) : ""}${nMod ? t("bld.io.mods", { n: String(nMod) }) : ""}${nDsl ? t("bld.io.engines", { n: String(nDsl) }) : ""}`;
  }

  /** Le fichier des relevés joint à un envoi (S35) : exactement celui de « Exporter mes relevés ». */
  function surveysPiece(): Piece {
    const n = Object.keys(local).length;
    const nIf = Object.keys(localIfaces).length;
    const nMod = Object.keys(localMod).length;
    const nDsl = diesel.get().length;
    return { fichier: "releves-batiments.json", resume: ioCounts(n, nIf, nMod, nDsl), contenu: exportSurveys(local, localIfaces, localMod, diesel.get()) };
  }

  /** « 📤 Envoyer mes relevés » n'apparaît que s'il y a quelque chose à envoyer, avec « Envoyées le… ». */
  function renderSend(): void {
    const btn = root.querySelector<HTMLButtonElement>("#bld-send");
    if (!btn) return;
    const has = Object.keys(local).length + Object.keys(localIfaces).length + Object.keys(localMod).length + diesel.get().length > 0;
    btn.hidden = !has;
    const note = has ? sentNote(loadSent()["releves-batiments.json"], surveysPiece().contenu) : "";
    const io = $("#bld-io");
    if (note && !io.textContent) io.textContent = note;
  }

  function exportFile(): void {
    const n = Object.keys(local).length;
    const nIf = Object.keys(localIfaces).length;
    const nMod = Object.keys(localMod).length;
    const nDsl = diesel.get().length;
    if (!n && !nIf && !nMod && !nDsl) {
      $("#bld-io").textContent = t("bld.export.none");
      return;
    }
    const blob = new Blob([JSON.stringify(exportSurveys(local, localIfaces, localMod, diesel.get()), null, 1) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `releves-batiments-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("#bld-io").textContent = t("bld.io.exported", { list: ioCounts(n, nIf, nMod, nDsl) });
  }

  renderList();
  renderEditor();
  if (message) $("#bld-io").textContent = message;

  return {
    /** Après un changement de langue (S31) : la liste et l'éditeur sont redessinés. */
    refresh(): void {
      renderList();
      renderEditor();
    },
    show(id: string): void {
      if (id === selectedId || !data.machines.has(id)) return;
      if (filter && !data.machines.get(id)!.name.toLowerCase().includes(filter.trim().toLowerCase())) {
        filter = "";
        ($("#bld-search") as HTMLInputElement).value = "";
      }
      select(id);
      root.querySelector(`[data-bld="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
    },
  };
}
