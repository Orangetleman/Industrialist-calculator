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
  KIND_LABEL,
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
import { esc, fmt, fmtMF } from "./format.ts";

type Bg = BgPlacement & { url: string; rot: number; opacity: number; natW: number; natH: number };
/** Ce que fait la souris sur la grille. */
type Mode = "ports" | "capture" | "coins";
type PortTool = Exclude<Tool, "gomme">;
type Place = Pick<Port, "side" | "cell">;
/** Bulle ouverte : un port posé (le modifier), ou une case vide (y poser un port, mode « Bulle »). */
type Bubble = { kind: "port"; index: number } | { kind: "new"; place: Place } | null;

const STATE_BADGE: Record<SurveyState, string> = {
  depot: `<span class="bld-badge ok" title="intégré aux données du site : sert à tout le monde">dépôt</span>`,
  local: `<span class="bld-badge local" title="relevé dans ce navigateur : déjà utilisé par tes plans de pose ; exporte-le pour l'intégrer au site">local · à envoyer</span>`,
  manquant: `<span class="bld-badge none" title="pas encore relevé : les plans de pose supposent ses ports">manquant</span>`,
};

const TOOL_LABEL: Record<Tool, string> = { objet: "Objet", fluide: "Fluide", énergie: "Prise ⚡", logique: "Logique", gomme: "Gomme" };
const TYPE_NAME: Record<PortTool, string> = { objet: "objet", fluide: "fluide", énergie: "prise ⚡", logique: "logique" };
const DIRS = ["entrée", "sortie", "les deux"] as const;
const TIER = ["", "I", "II", "III", "IV", "V"];
const BOX_LABEL: Record<FaceBox, string> = { haut: "Devant", bas: "Derrière", gauche: "Côté", droite: "Côté" };
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
): { show(id: string): void } {
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
  let message = pruned.dropped.length ? `${pruned.dropped.length} relevé(s) local(aux) déjà intégré(s) aux données : copie locale retirée.` : "";

  const machines = [...data.machines.values()].sort((a, b) => Number(a.kind === "building") - Number(b.kind === "building") || a.name.localeCompare(b.name));

  root.innerHTML = `
    <div class="bld">
      <aside class="bld-list panel">
        <label class="sr-only" for="bld-search">Chercher un bâtiment</label>
        <input id="bld-search" type="search" placeholder="Chercher un bâtiment…" autocomplete="off">
        <p class="hint bld-states" id="bld-states"></p>
        <ul id="bld-items"></ul>
        <div class="actions">
          <button type="button" id="bld-export">Exporter mes relevés</button>
          <label class="button">Importer…<input type="file" id="bld-import" accept="application/json,.json" hidden></label>
        </div>
        <p class="hint" id="bld-io"></p>
      </aside>
      <div class="bld-main">
        <div class="panel" id="bld-intro">
          <h3>Éditeur de bâtiments</h3>
          <p>Choisis un bâtiment dans la liste, puis pose ses entrées, ses sorties et sa prise électrique sur la grille, en t'aidant si besoin d'une capture d'écran en vue de dessus. Tes relevés servent tout de suite à tes plans, dans ce navigateur ; « Exporter mes relevés » en fait un fichier, à partager pour que le site les intègre.</p>
          <p class="hint">1 case = 1 Short Pipe. Pose le bâtiment sans le faire pivoter : tous les bâtiments ont 4 rotations (quarts de tour), le calculateur les déduit.</p>
        </div>
        <div class="panel bld-editor" id="bld-editor" hidden>
          <div class="bld-head" id="bld-head"></div>
          <div class="bld-row" id="bld-dims" hidden></div>
          <div class="bld-range" id="bld-range" hidden></div>
          <div class="bld-tools" id="bld-tools" role="toolbar" aria-label="Outils"></div>
          <div class="bld-cross" id="bld-cross">
            ${FACE_BOXES.map((b) => `<button type="button" class="bld-face bld-face-${b}" data-box="${b}" hidden></button>`).join("")}
            <div class="bld-stage">
              <div class="bld-frame" id="bld-frame" tabindex="0" aria-label="Grille du bâtiment : glisser pour se déplacer, molette ou + / − pour zoomer, 0 pour tout voir">
                <div id="bld-canvas"></div>
                <p class="bld-help" id="bld-help"></p>
                <div class="seg bld-mode" id="bld-mode" role="radiogroup" aria-label="Ce que fait la souris" hidden>
                  <button type="button" role="radio" data-mode="ports" title="Poser et modifier les ports">✎ Ports</button>
                  <button type="button" role="radio" data-mode="capture" title="Déplacer et agrandir la capture à la main">✥ Capture</button>
                </div>
                <button type="button" class="bld-rangebtn" id="bld-rangebtn" hidden>◯ Portée</button>
                <div class="rs-zoom">
                  <button type="button" data-bzoom="in" aria-label="Zoomer">+</button>
                  <button type="button" data-bzoom="out" aria-label="Dézoomer">−</button>
                  <button type="button" data-bzoom="fit" aria-label="Tout voir">⤢</button>
                </div>
              </div>
              <div class="bld-bubble" id="bld-bubble" role="dialog" aria-label="Port" hidden></div>
            </div>
          </div>
          <div id="bld-facepop"></div>
          <p class="bld-msg" id="bld-msg" aria-live="polite"></p>
          <div class="bld-foot" id="bld-foot">
            <label class="bld-check"><input type="checkbox" id="bld-nopower"> Sans prise électrique</label>
            <label class="bld-check"><input type="checkbox" id="bld-noports"> Sans port</label>
            <div class="bld-status" id="bld-status" aria-live="polite"></div>
            <div class="actions" id="bld-actions"></div>
          </div>
          <div class="bld-more">
            <details id="bld-d-mod" hidden><summary id="bld-s-mod"></summary><div id="bld-mod"></div></details>
            <details id="bld-d-iface"><summary id="bld-s-iface"></summary><div id="bld-iface"></div></details>
            <details class="bld-bg" id="bld-bg"><summary>Capture d'écran en fond <span class="hint">· reste dans ton navigateur</span></summary><div id="bld-bgbody"></div></details>
            <details id="bld-d-notes"><summary id="bld-s-notes">Remarques</summary><label class="bld-notes"><span class="sr-only">Remarques</span><textarea id="bld-notes" rows="2" placeholder="ex. ce que la capture ne montre pas, un poteau en hauteur"></textarea></label></details>
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
    $("#bld-states").innerHTML =
      `<span title="intégrés aux données du site">${n.depot} relevés</span> · <span title="relevés dans ce navigateur, déjà utilisés par tes plans de pose : « Exporter mes relevés » pour les envoyer">${n.local} à envoyer</span> · <span title="pas encore relevés : les plans de pose supposent leurs ports">${n.manquant} manquants</span>`;
    $("#bld-items").innerHTML = machines
      .filter((m) => !q || m.name.toLowerCase().includes(q) || !!ASSEMBLY_SHORT[assemblyOf.get(m.id)?.id ?? ""]?.includes(q))
      .map((m) => {
        const asm = assemblyOf.get(m.id);
        const modBadge = asm
          ? `<span class="bld-badge mod" title="bloc de l'ensemble ${esc(asm.name)}${localMod[m.id] ? " · correction locale à envoyer" : ""}">⬡ ${esc(ASSEMBLY_SHORT[asm.id] ?? asm.name)}${localMod[m.id] ? " ✎" : ""}</span>`
          : "";
        const e = local[m.id] ?? repo.machines[m.id];
        const st = surveyState(m.id, repo, local);
        const hasIface = !!(localIfaces[m.id] ?? repoIfaces[m.id]);
        const badges = `<span class="bld-badges">${modBadge}${hasIface ? `<span class="bld-badge iface" title="a une interface ([E] Interact, levier ou écran)">⚙</span>` : ""}${STATE_BADGE[st]}${e && !isComplete(e) ? `<span class="bld-badge warn" title="${esc(checkEntry(e).join(" ; "))}">incomplet</span>` : ""}</span>`;
        return `<li><button type="button" data-bld="${esc(m.id)}" class="${m.id === selectedId ? "on" : ""}"><span>${esc(m.name)}</span>${badges}</button></li>`;
      })
      .join("");
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
    const where = p.side === "dessus" ? `dessus, case ${(p.cell as number[]).join(", ")}` : `${p.side}, case ${p.cell}`;
    return `${TYPE_NAME[p.type]} · ${p.direction} · ${where}${p.tip ? ` — « ${p.tip} »` : ""} · clic : modifier`;
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
    let s = `<svg id="bld-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grille du bâtiment : marge pour les ports, corps pour la prise électrique"><g transform="translate(${off} ${off})">`;
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
    if (radius) s += `<circle class="bld-circ" cx="${(1 + w / 2) * CELL}" cy="${(1 + h / 2) * CELL}" r="${radius * CELL}"><title>Portée : ${fmt(radius, 2)} cases depuis le centre</title></circle>`;
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
    return max === 0 ? "D'après le wiki, ce bâtiment ne consomme pas d'énergie." : `D'après le wiki, il consomme jusqu'à ${fmtMF(max)} : il a une prise électrique.`;
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
    const wiki = sameSize(fp, m.size) ? "" : ` <span class="must unk" title="taille donnée par le wiki">⚠ wiki : ${m.size!.w} × ${m.size!.l}</span>`;
    const mod = asm ? `<span class="bld-badge mod" title="${esc(findBlock(repoModular, id)?.block.role ?? "")}">⬡ ${esc(asm.name)} · Tier ${TIER[asm.tier] ?? asm.tier}</span>` : "";
    const fix = localMod[id] ? `<span class="bld-badge local" title="correction des faces ou de la portée notée dans ce navigateur">correction locale</span>` : "";
    $("#bld-head").innerHTML = `<h3>${esc(m.name)}</h3>${STATE_BADGE[surveyState(id, repo, local)]}${mod}${fix}<span class="bld-size">${fp.w} × ${fp.h} cases <button type="button" class="link small" id="bld-size" aria-expanded="${sizeOpen}" title="Changer la taille">✎</button>${wiki}</span>`;
  }

  function renderDims(): void {
    const box = $("#bld-dims");
    box.hidden = !sizeOpen;
    if (!sizeOpen) return;
    box.innerHTML = `
      <label>Largeur (cases) <input type="number" min="1" max="200" id="bld-w" value="${entry!.footprint!.w}"></label>
      <label>Hauteur (cases) <input type="number" min="1" max="200" id="bld-h" value="${entry!.footprint!.h}"></label>
      <button type="button" id="bld-swap" title="Échanger largeur et hauteur">⇄</button>`;
  }

  function renderTools(): void {
    const dir = tool === "gomme" ? null : dirByTool[tool];
    const pose = `<span class="bld-sep"></span><span class="bld-dirlabel">Pose</span><span class="seg" role="radiogroup" aria-label="Façon de poser un port">
      <button type="button" role="radio" data-posemode="outils" aria-checked="${!poseBubble}" title="Choisir un outil, puis chaque clic dans la marge pose un port">Outils</button>
      <button type="button" role="radio" data-posemode="bulle" aria-checked="${poseBubble}" title="Un clic sur une case vide ouvre une bulle : on y choisit le type et le sens">Bulle</button></span>`;
    if (poseBubble) {
      $("#bld-tools").innerHTML = pose;
      return;
    }
    $("#bld-tools").innerHTML = `
      ${(["objet", "fluide", "énergie", "logique", "gomme"] as Tool[]).map((t) => `<button type="button" data-tool="${t}" aria-pressed="${t === tool}">${t === "gomme" ? "" : `<i class="bld-sw ${t}"></i>`}${TOOL_LABEL[t]}</button>`).join("")}
      <span class="bld-sep"></span><span class="bld-dirlabel">Sens</span>
      ${DIRS.map((d) => `<button type="button" data-dir="${d}" aria-pressed="${d === dir}"${dir ? "" : " disabled"}>${d}</button>`).join("")}${pose}`;
  }

  // ---------------------------------------------------------------- bulle d'un port (S19)
  const placeText = (p: Place) => (p.side === "dessus" ? `dessus, case ${(p.cell as number[]).join(", ")}` : `${p.side}, case ${p.cell}`);
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
      const types = typesAt(p).map((t) => `<button type="button" data-bb-type="${t}" ${pressed(p.type === t)}>${TYPE_NAME[t]}</button>`).join("");
      const dirs = DIRS.map((d) => `<button type="button" data-bb-dir="${d}" ${pressed(p.direction === d)}>${d}</button>`).join("");
      box.innerHTML = `<div class="row"><b>${esc(TYPE_NAME[p.type])} · ${esc(p.direction)}</b><span class="hint">${esc(placeText(p))}</span></div>
        <div class="row"><span class="hint">Type</span>${types}</div>
        <div class="row"><span class="hint">Sens</span>${dirs}</div>
        <label class="hint">Info-bulle du jeu (facultatif)<input type="text" data-pf="tip" value="${esc(p.tip ?? "")}" placeholder="ex. Input for Coal or coke Fuel"></label>
        <div class="row"><button type="button" data-bb-del>Supprimer</button><button type="button" class="link small" data-bb-close>Fermer</button></div>`;
    } else if (bubble.kind === "new") {
      const place = bubble.place;
      const dirs = DIRS.map((d) => `<button type="button" data-bb-ndir="${d}" ${pressed(bubbleDir === d)}>${d}</button>`).join("");
      const types = typesAt(place).map((t) => `<button type="button" data-bb-new="${t}"><i class="bld-sw ${t}"></i>${TYPE_NAME[t]}</button>`).join("");
      box.innerHTML = `<div class="row"><b>Nouveau port</b><span class="hint">${esc(placeText(place))}</span></div>
        <div class="row"><span class="hint">Sens</span>${dirs}</div>
        <div class="row"><span class="hint">Poser</span>${types}</div>
        <div class="row"><button type="button" class="link small" data-bb-close>Fermer</button></div>`;
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
      const scales = (["entrées", "sorties", "énergie"] as const).map((x) => `<option${st.number!.scales === x ? " selected" : ""}>${x}</option>`).join("");
      return `<div class="row"><label>Valeur par défaut <input type="text" inputmode="decimal" class="num" data-if="default" data-s="${k}" value="${esc(fmt(st.number.default, 3))}"></label>
        <label>Multiplie, dans tous les crafts <select data-if="scales" data-s="${k}">${scales}<option value=""${st.number.scales ? "" : " selected"}>rien</option></select></label></div>`;
    }
    if (!st.choices) return "";
    const crafts = (j: number, c: NonNullable<InterfaceSetting["choices"]>[number]) =>
      recs.length
        ? recs
            .map((r) => `<label class="bld-check"><input type="checkbox" data-if="recipe" data-s="${k}" data-c="${j}" data-r="${esc(r.id)}"${c.recipes.includes(r.id) ? " checked" : ""}> ${esc(qtyText(r.inputs) || "rien")} → ${esc(qtyText(r.outputs))}</label>`)
            .join("")
        : `<span class="hint">aucun craft pour cette machine</span>`;
    const rows = st.choices
      .map(
        (c, j) =>
          `<tr><td><input type="text" data-if="label" data-s="${k}" data-c="${j}" value="${esc(c.label)}" placeholder="ex. container">${c.doubt ? `<div class="hint">⚠ ${esc(c.doubt)}</div>` : ""}</td><td>${crafts(j, c)}</td><td><button type="button" class="link small" data-if-del-choice data-s="${k}" data-c="${j}">retirer</button></td></tr>`,
      )
      .join("");
    return `<table><thead><tr><th>Position (texte du jeu)</th><th>Crafts de cette position</th><th></th></tr></thead><tbody>${rows}</tbody></table><button type="button" class="link small" data-if-add-choice data-s="${k}">+ une position</button>`;
  }

  /** Interface en vigueur (copie locale, sinon dépôt), pour savoir si la saisie a changé. */
  const ifaceBase = (id: string) => localIfaces[id] ?? repoIfaces[id] ?? null;
  const ifaceChanged = (id: string) => JSON.stringify(iface) !== JSON.stringify(ifaceBase(id));

  function renderIface(): void {
    const box = $("#bld-iface");
    if (!selectedId) return;
    const i = iface;
    const state = localIfaces[selectedId] ? ` <span class="bld-badge local">local · à envoyer</span>` : "";
    $("#bld-s-iface").innerHTML = `⚙ Interface <span class="hint">· ${i ? esc(KIND_LABEL[i.kind]) : "aucune"}</span>${state}`;
    const kinds = `<select data-if="kind"><option value=""${i ? "" : " selected"}>aucune</option>${INTERFACE_KINDS.map((k) => `<option value="${esc(k)}"${i?.kind === k ? " selected" : ""}>${esc(KIND_LABEL[k])}</option>`).join("")}</select>`;
    let body = "";
    if (i) {
      const recs = machineRecipes(selectedId);
      body += `<div class="row"><label>Où <input type="text" data-if="where" value="${esc(i.where ?? "")}" placeholder="ex. sur le côté de la machine"></label>
        <label class="bld-check"><input type="checkbox" data-if="once"${i.once ? " checked" : ""}> Choix définitif (fait à la pose)</label></div>`;
      i.settings.forEach((st, k) => {
        const sort = st.choices ? "positions" : st.number ? "nombre" : "aucun";
        const opt = (v: string, label: string) => `<option value="${v}"${sort === v ? " selected" : ""}>${label}</option>`;
        body += `<div class="set"><div class="row"><label>Réglage <input type="text" data-if="name" data-s="${k}" value="${esc(st.name)}" placeholder="ex. Levier"></label>
          <label>Sorte <select data-if="sort" data-s="${k}">${opt("positions", "un choix parmi des positions")}${opt("nombre", "un nombre")}${opt("aucun", "sans effet sur le calcul")}</select></label>
          <button type="button" class="link small" data-if-del-setting data-s="${k}">retirer ce réglage</button></div>${st.note ? `<p class="hint">${esc(st.note)}</p>` : ""}${settingDetail(st, k, recs)}</div>`;
      });
      body += `<div class="row"><button type="button" class="link small" data-if-add-setting>+ un réglage</button></div>
        <label class="bld-notes">Sans effet sur le calcul : pourquoi <input type="text" data-if="effect" value="${esc(i.effect ?? "")}" placeholder="ex. signal logique seulement"></label>`;
      if (i.notes) body += `<p class="hint">${esc(i.notes)}</p>`;
      const src = i.sources.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.page ?? x.wiki)}</a>` : esc(x.note ?? x.wiki))).join(" · ");
      if (src) body += `<p class="hint">Sources : ${src}</p>`;
      const problems = checkInterface(i, recs.map((r) => r.id));
      if (problems.length) body += `<ul class="bld-problems">${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
    }
    box.innerHTML = `<div class="bld-iface"><p class="hint">L'étiquette « [E] Interact », un levier ou un écran : seulement le réglage de la machine, rien pour le placement.</p>
      <div class="row"><label>Type ${kinds}</label></div>${body}</div>`;
  }

  /** Une saisie dans la section « Interface » (champ, case ou liste). `redraw` : redessiner la section. */
  function ifaceInput(t: HTMLInputElement, redraw: boolean): void {
    const f = t.dataset.if!;
    if (f === "kind") {
      iface = t.value ? { ...(iface ?? { settings: [], sources: [] }), kind: t.value as InterfaceKind } : null;
      renderStatus();
      return renderIface();
    }
    if (!iface) return;
    const st = t.dataset.s !== undefined ? iface.settings[Number(t.dataset.s)] : undefined;
    const choice = st?.choices?.[Number(t.dataset.c)];
    if (f === "where") iface.where = t.value || undefined;
    else if (f === "once") iface.once = t.checked || undefined;
    else if (f === "effect") iface.effect = t.value || undefined;
    else if (f === "name" && st) st.name = t.value;
    else if (f === "label" && choice) choice.label = t.value;
    else if (f === "recipe" && choice) choice.recipes = t.checked ? [...choice.recipes, t.dataset.r!] : choice.recipes.filter((r) => r !== t.dataset.r);
    else if (f === "default" && st?.number) {
      const v = Number(t.value.replace(",", "."));
      if (v > 0) st.number.default = v;
    } else if (f === "scales" && st?.number) st.number.scales = (t.value || null) as NonNullable<InterfaceSetting["number"]>["scales"];
    else if (f === "sort" && st) {
      delete st.choices;
      delete st.number;
      if (t.value === "positions") st.choices = [{ label: "", recipes: [] }];
      if (t.value === "nombre") st.number = { default: 1, scales: null };
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
  const modChip = (a: ModAssembly) => (id: string) => `<span class="mchip"><button type="button" class="link" data-bld="${esc(id)}" title="Ouvrir ${esc(modName(id))}">${esc(shortName(a, id))}</button></span>`;

  /** Sources d'un ensemble de faits, en texte (pour le survol). */
  function srcText(ids: string[]): string {
    return [...new Set(ids)]
      .map((id) => repoModular.sources[id])
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => `${s.wiki === "miraheze" ? "Miraheze" : s.wiki === "fandom" ? "Fandom" : s.wiki === "jeu" ? "relevé en jeu" : "ta réponse"}${s.page ? ` (${s.page})` : ""}`)
      .filter((x, i, all) => all.indexOf(x) === i)
      .join(" · ");
  }
  /** ⚠ sur une question encore ouverte (le détail au survol). */
  const openMark = (f: ModFact | undefined) => (isOpen(repoModular, f) ? `<span class="must unk" data-ref="${esc(f!.question!)}" title="${esc(f!.text)} — pas encore confirmé en jeu">⚠ à relever</span>` : "");

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
    const title = `${texts.map((f) => f.text).join(" ")}${texts.length ? ` — sources : ${srcText(texts.flatMap((f) => f.sources))}` : ""}${info.local ? " — ta correction" : ""} · clic : modifier`;
    const split = !!(modDraft ?? localMod[b.id])?.sides;
    for (const el of buttons) {
      const box = el.dataset.box as FaceBox;
      el.hidden = false;
      el.classList.toggle("on", openBox === box);
      if (!boxes) {
        el.className = `bld-face bld-face-${box} unk${openBox === box ? " on" : ""}`;
        el.title = `On ne sait pas encore comment ce bloc se pose · clic : le noter`;
        el.innerHTML = `<b>${BOX_LABEL[box]}</b><span class="names">?</span>${openMark(info.facesFact)}`;
        continue;
      }
      const f = boxes[box];
      const side = box === "gauche" || box === "droite";
      el.className = `bld-face bld-face-${box}${f.required ? " req" : ""}${f.blocks.length ? "" : " none"}${openBox === box ? " on" : ""}`;
      el.title = title;
      el.setAttribute("aria-expanded", String(openBox === box));
      const label = side ? (split ? `Côté ${box}` : "Côtés") : BOX_LABEL[box];
      const names = f.blocks.length ? f.blocks.map((id) => esc(shortName(a, id))).join(" · ") : "rien";
      // La question ouverte vaut pour tout le bloc : un seul ⚠, sur la case du bas.
      el.innerHTML = `<b>${label}${f.required ? ` <span class="req-tag">obligatoire</span>` : ""}</b><span class="names">${names}</span>${box === "bas" ? openMark(info.facesFact) : ""}`;
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
    const label = side ? (split ? `Côté ${openBox}` : "Côtés (gauche et droite)") : BOX_LABEL[openBox];
    const chips = a.blocks
      .map((x) => `<label class="mchip${f.blocks.includes(x.id) ? "" : " off"}"><input type="checkbox" data-fp="block" data-id="${esc(x.id)}"${f.blocks.includes(x.id) ? " checked" : ""}> ${esc(shortName(a, x.id))}</label>`)
      .join("");
    const texts = [info.facesFact, info.requiredFact].filter((x): x is ModFact => !!x);
    const src = texts.length ? `<p class="hint">${texts.map((x) => `${esc(x.text)} ${openMark(x)}`).join(" ")} <span title="${esc(srcText(texts.flatMap((x) => x.sources)))}">· sources au survol</span></p>` : "";
    box.innerHTML = `<div class="bld-facepop"><div class="row"><b>${label}</b><span class="hint">— ce que la face accueille :</span></div>
      <div class="row">${chips}</div>
      <div class="row"><label class="bld-check"><input type="checkbox" data-fp="req"${f.required ? " checked" : ""}> doit être touchée (obligatoire)</label>
      ${side ? `<label class="bld-check" title="Par défaut, les deux côtés suivent la même règle"><input type="checkbox" data-fp="split"${split ? " checked" : ""}> Côtés réglés à part</label>` : ""}</div>
      ${src}
      <label class="bld-notes">Note sur la correction <input type="text" data-fp="note" value="${esc(modDraft.note ?? "")}" placeholder="ex. vu en jeu : le côté plat regarde le contrôleur"></label>
      <div class="row"><button type="button" data-fp-close>Fermer</button><button type="button" class="link small" data-mod-cancel>Annuler mes changements des faces</button></div></div>`;
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
        `<span><b>Portée</b> <input type="text" inputmode="decimal" class="num" data-mod="range" value="${v}"${r.tiles === "infinie" ? " disabled" : ""} aria-label="Portée en cases depuis le bord"> cases depuis le bord <label class="bld-check"><input type="checkbox" data-mod="infinite"${r.tiles === "infinie" ? " checked" : ""}> infinie</label></span>`,
      );
      const others = a.blocks.filter((x) => x.id !== b.id);
      parts.push(`<span><b>Dessert</b> ${others.map((x) => `<label class="mchip${r.serves.includes(x.id) ? "" : " off"}"><input type="checkbox" data-mod="serve" data-id="${esc(x.id)}"${r.serves.includes(x.id) ? " checked" : ""}> ${esc(shortName(a, x.id))}</label>`).join("")}</span>`);
      parts.push(`<span><button type="button" data-range-done>Fermer</button> <button type="button" class="link small" data-mod-cancel>Annuler</button></span>`);
    } else {
      const src = r.rangeFact ? ` title="${esc(`${r.rangeFact.text} — sources : ${srcText(r.rangeFact.sources)}`)}"` : "";
      const tiles =
        r.tiles === null ? `<span class="hint">aucune : desservi par d'autres blocs</span>` : r.tiles === "infinie" ? "infinie" : `${fmt(r.tiles, 2)} cases depuis le bord${r.fromCenter !== null ? ` (${fmt(r.fromCenter, 2)} depuis le centre)` : ""}`;
      parts.push(`<span${src}><b>Portée</b> ${tiles} ${openMark(r.rangeFact)}</span>`);
      if (r.serves.length) parts.push(`<span><b>Dessert</b> ${r.serves.map(modChip(a)).join("")}</span>`);
      if (r.servedBy.length) {
        const reach = (t: number | "infinie" | null) => (t === "infinie" ? "portée infinie" : typeof t === "number" ? `${fmt(t, 2)} cases` : "portée inconnue");
        parts.push(`<span><b>Doit être à portée de</b> ${r.servedBy.map((x) => `${modChip(a)(x.id)}<span class="hint">(${reach(x.tiles)})</span>`).join(" ")}</span>`);
      }
      parts.push(`<button type="button" class="link small" data-range-edit>✎ Corriger</button>`);
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
      if (notes.length) body += `<h5>À savoir</h5><ul class="bld-know">${notes.map((f) => `<li title="${esc(srcText(f.sources))}">${esc(f.text)} ${openMark(f)}</li>`).join("")}</ul>`;
    }
    body += modCalcHtml(repoModular, data, a, mcState, diesel.get(), mcMsg);
    const what = a.id === "diesel-engine" ? "configurations et calcul" : a.id === "tree-farm" ? "à savoir et calcul" : "calcul";
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
  function facePopInput(t: HTMLInputElement): void {
    if (!modDraft || !openBox) return;
    const f = t.dataset.fp!;
    if (f === "note") return void (modDraft.note = t.value || undefined);
    if (f === "block") modDraft = toggleFaceBlock(modDraft, openBox, t.dataset.id!, t.checked);
    else if (f === "req") modDraft = setFaceRequired(modDraft, openBox, t.checked);
    else if (f === "split") modDraft = splitSides(modDraft, t.checked);
    renderModular();
    renderStatus();
  }

  /** Saisie dans la portée en cours de correction. */
  function rangeInput(t: HTMLInputElement): void {
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found || !modDraft) return;
    const b = found.block;
    const f = t.dataset.mod!;
    const id = t.dataset.id;
    if (f === "serve" && id) modDraft.serves = t.checked ? [...(modDraft.serves ?? []).filter((x) => x !== id), id] : (modDraft.serves ?? []).filter((x) => x !== id);
    else if (f === "infinite") {
      const repoTiles = fact(b, "rangeTiles")?.value;
      modDraft.rangeTiles = t.checked ? "infinie" : typeof repoTiles === "number" ? repoTiles : undefined;
    } else if (f === "range") {
      const v = Number(t.value.replace(",", "."));
      if (v > 0) {
        modDraft.rangeTiles = v;
        message = "";
      } else message = "Portée : un nombre de cases plus grand que 0.";
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
  function mcInput(t: HTMLInputElement): void {
    const a = selectedId ? assemblyOf.get(selectedId) : undefined;
    if (!a) return;
    const k = t.dataset.mc!;
    if (k === "fuel") {
      mcState.diesel.fuel = t.value;
      const out = root.querySelector("#mc-out");
      if (out) out.innerHTML = modCalcOut(repoModular, data, a, mcState, diesel.get());
      return;
    }
    const v = Number(t.value.replace(",", "."));
    if (!Number.isFinite(v) || t.value === "") return;
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
        <label class="button">${bg ? "Changer de capture…" : "Choisir une capture…"}<input type="file" id="bld-bgfile" accept="image/*" hidden></label>
        ${
          bg
            ? `<button type="button" id="bld-corners"${mode === "coins" ? ' aria-pressed="true"' : ""}>Caler sur 2 coins</button>
          <button type="button" id="bld-bgr">Pivoter 90°</button>
          <label>Opacité <input type="range" id="bld-bgo" min="0.1" max="1" step="0.05" value="${bg.opacity}"></label>
          <button type="button" class="link" id="bld-bgdel">Retirer la capture</button>`
            : ""
        }
      </div>
      <ol class="hint bld-steps">
        <li>Choisis ta capture vue de dessus : elle s'affiche derrière la grille.</li>
        <li><b>Caler sur 2 coins</b> : clique le coin haut-gauche du bâtiment sur la capture, puis son coin bas-droit. La capture se met à l'échelle toute seule (zoome avant de cliquer pour être précis).</li>
        <li>Pour ajuster : mode <b>✥ Capture</b> (en bas à gauche de la grille), glisse pour la déplacer, molette pour l'agrandir (Maj + molette : plus fin), flèches du clavier pour un réglage fin.</li>
      </ol>`;
  }

  function renderNotesSummary(): void {
    $("#bld-s-notes").innerHTML = `Remarques${entry?.notes ? ` <span class="hint">· 1 remarque</span>` : ""}`;
  }

  /** Ce qui n'est pas encore enregistré : relevé, interface, correction du bloc. */
  function pendingParts(): string[] {
    if (!entry || !selectedId) return [];
    const out: string[] = [];
    if (entryChanged(entry, local[selectedId] ?? repo.machines[selectedId])) out.push("relevé");
    if (ifaceChanged(selectedId)) out.push("interface");
    const mod = modPending();
    // Comparaison sans la source : sa date change à chaque brouillon.
    const strip = (x: ModularEdit | null | undefined) => (x ? JSON.stringify({ ...x, source: undefined }) : "null");
    if (mod !== undefined && strip(mod) !== strip(localMod[selectedId])) out.push(findBlock(repoModular, selectedId)?.assembly.assembly === "contact" ? "faces" : "portée");
    return out;
  }

  function renderStatus(): void {
    if (!entry || !selectedId) return;
    const list = checkEntry(entry);
    const hint = powerHint(selectedId);
    const noPlug = !entry.noPower && !entry.ports.some((p) => p.type === "énergie");
    const problems = list.length
      ? `<ul class="bld-problems">${list.map((p) => `<li>${esc(p)}</li>`).join("")}${noPlug && hint ? `<li class="hint">${esc(hint)}</li>` : ""}</ul>`
      : `<span class="ok-text">✓ Relevé complet</span>`;
    const pending = pendingParts();
    const dirty = pending.length ? `<span class="bld-dirty">● non enregistré : ${esc(pending.join(", "))}</span>` : "";
    $("#bld-status").innerHTML = `${problems}${dirty}`;
  }

  function renderActions(): void {
    const id = selectedId;
    const any = !!id && !!(local[id] || localIfaces[id] || localMod[id]);
    $("#bld-actions").innerHTML = `<button type="button" class="primary" id="bld-save">Enregistrer</button>${
      any ? `<button type="button" class="link" id="bld-forget" title="Revenir aux données du site pour ce bâtiment : relevé, interface et correction locaux">Oublier mes modifications locales</button>` : ""
    }`;
  }

  const HELP_TOOLS = "Glisse pour te déplacer · molette pour zoomer · clique dans la marge (ports) ou sur le corps (prise ⚡) · clic sur un port : le modifier";
  const HELP_BUBBLE = "Glisse pour te déplacer · molette pour zoomer · clique une case de la marge (port) ou du corps (prise ⚡) : une bulle s'ouvre";

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
          ? "Clique maintenant le coin bas-droit du bâtiment · Échap pour annuler"
          : "Clique le coin haut-gauche du bâtiment sur ta capture (zoome si besoin) · Échap pour annuler"
        : mode === "capture"
          ? "Glisse pour déplacer la capture · molette pour l'agrandir ou la réduire (Maj : plus fin) · flèches : réglage fin"
          : poseBubble
            ? HELP_BUBBLE
            : HELP_TOOLS;
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
      done.push(isComplete(entry) ? "relevé" : "relevé (encore incomplet)");
    }
    if (ifaceChanged(id)) {
      if (iface) {
        // Sources : celles du dépôt, plus cette saisie (une seule, la dernière).
        iface.sources = [...iface.sources.filter((x) => x.wiki !== "saisie"), surveySource("interface notée dans l'éditeur de bâtiments du calculateur")];
        if (JSON.stringify(iface) === JSON.stringify(repoIfaces[id])) delete localIfaces[id];
        else localIfaces[id] = structuredClone(iface);
        done.push(checkInterface(iface, machineRecipes(id).map((r) => r.id)).length ? "interface (incomplète)" : "interface");
      } else {
        delete localIfaces[id];
        done.push("interface retirée");
      }
      saveLocalInterfaces(localIfaces);
    }
    const mod = modPending();
    if (mod !== undefined) {
      const had = !!localMod[id];
      if (mod) localMod[id] = mod;
      else delete localMod[id];
      saveLocalModular(localMod);
      if (mod || had) done.push(findBlock(repoModular, id)?.assembly.assembly === "contact" ? "faces" : "portée");
      modDraft = null;
      openBox = null;
      rangeEdit = false;
    }
    message = done.length ? `Enregistré dans ce navigateur : ${done.join(", ")}. Pense à l'exporter (« Exporter mes relevés »).` : "Rien à enregistrer : aucune modification.";
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
      message = mode === "coins" ? "Calage annulé." : "";
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
    const t = ev.target as HTMLInputElement;
    if (t.id === "bld-search") {
      filter = t.value;
      renderList();
      return;
    }
    if (!entry) return;
    if (t.id === "bld-w" || t.id === "bld-h") {
      const v = Math.max(1, Math.min(200, Math.round(Number(t.value)) || 1));
      entry.footprint = { w: t.id === "bld-w" ? v : entry.footprint!.w, h: t.id === "bld-h" ? v : entry.footprint!.h };
      bubble = null;
      renderHead();
      refreshCanvas();
    } else if (t.dataset.if && t.type === "text") ifaceInput(t, false);
    else if (t.dataset.fp === "note") facePopInput(t);
    else if (t.dataset.mod === "range") rangeInput(t);
    else if (t.dataset.mc) mcInput(t);
    else if (t.id === "bld-notes") {
      entry.notes = t.value || undefined;
      renderStatus();
    } else if (t.id === "bld-bgo" && bg) {
      bg.opacity = Number(t.value);
      root.querySelector("#bld-bgimg")?.setAttribute("opacity", String(bg.opacity));
    } else if (t.dataset.pf === "tip" && bubble?.kind === "port") {
      const p = entry.ports[bubble.index]!;
      p.tip = t.value || undefined;
      root.querySelector(`[data-port="${bubble.index}"] title`)!.textContent = portTitle(p);
      renderStatus();
    }
  });

  root.addEventListener("change", async (ev) => {
    const t = ev.target as HTMLInputElement & HTMLSelectElement;
    if (!entry && t.id !== "bld-import") return;
    if (t.dataset.if) {
      // Les champs texte sont pris en compte à la frappe (pas de redessin : un clic qui suit doit garder son bouton).
      if ((t as HTMLInputElement).type !== "text") ifaceInput(t as HTMLInputElement, true);
      return;
    }
    if (t.dataset.fp) {
      if (t.dataset.fp !== "note") facePopInput(t);
      return;
    }
    if (t.dataset.mod) {
      if (t.dataset.mod !== "range") rangeInput(t);
      return;
    }
    if (t.id === "bld-nopower") {
      if (t.checked) entry!.noPower = true;
      else delete entry!.noPower;
      renderStatus();
    } else if (t.id === "bld-noports") {
      if (t.checked) entry!.noPorts = true;
      else delete entry!.noPorts;
      renderStatus();
    } else if (t.id === "bld-bgfile" && t.files?.[0]) {
      const url = URL.createObjectURL(t.files[0]);
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
      } catch {
        URL.revokeObjectURL(url);
        message = "Image illisible : choisis une capture PNG ou JPEG.";
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
    } else if (t.id === "bld-import" && t.files?.[0]) {
      try {
        const raw = JSON.parse(await t.files[0].text());
        const parsed = parseSurveys(raw);
        if (!parsed) throw new Error("format inattendu");
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
        $("#bld-io").textContent = `${Object.keys(parsed).length} relevé(s)${nIf ? `, ${nIf} interface(s)` : ""}${nMod ? `, ${nMod} correction(s) de blocs modulaires` : ""}${dsl.length ? `, ${dsl.length} relevé(s) de moteur` : ""} importé(s).`;
        renderList();
        if (selectedId) select(selectedId);
      } catch (err) {
        $("#bld-io").textContent = `Import impossible : ${(err as Error).message}`;
      }
      t.value = "";
    }
  });

  root.addEventListener("click", (ev) => {
    const target = ev.target as Element;
    const item = target.closest<HTMLElement>("[data-bld]");
    if (item) return select(item.dataset.bld!);
    if (target.closest("#bld-export")) return exportFile();
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
        mcMsg = "Relevé enregistré : il entre dans le calcul et l'export.";
        mcState.diesel = { cylinders: r.cylinders, airFuel: r.airFuel, throttle: r.throttle, fuel: r.fuel };
      }
      return renderModMore();
    }
    const del = target.closest<HTMLElement>("[data-dr-del]");
    if (del) {
      diesel.set(diesel.get().filter((r) => r.id !== del.dataset.drDel));
      mcMsg = "Relevé retiré.";
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
      message = "Modifications locales oubliées : retour aux données du site.";
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
        message = "Les deux coins sont trop proches : recommence (coin haut-gauche, puis bas-droit).";
        refreshCanvas(true);
        return renderMode();
      }
      bg.x = fit.x;
      bg.y = fit.y;
      bg.scale = fit.scale;
      const gap = Math.max(fit.ratio, 1 / fit.ratio) - 1;
      message =
        gap > 0.12
          ? `Capture calée, mais ses proportions diffèrent de ${Math.round(gap * 100)} % de l'empreinte : vérifie la largeur et la hauteur (⇄ si elles sont inversées), puis recommence.`
          : "Capture calée. Ajuste si besoin en mode ✥ Capture, puis pose les ports.";
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

  function exportFile(): void {
    const n = Object.keys(local).length;
    const nIf = Object.keys(localIfaces).length;
    const nMod = Object.keys(localMod).length;
    const nDsl = diesel.get().length;
    if (!n && !nIf && !nMod && !nDsl) {
      $("#bld-io").textContent = "Aucun relevé local à exporter : enregistre d'abord un relevé.";
      return;
    }
    const blob = new Blob([JSON.stringify(exportSurveys(local, localIfaces, localMod, diesel.get()), null, 1) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `releves-batiments-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("#bld-io").textContent = `${n} relevé(s)${nIf ? `, ${nIf} interface(s)` : ""}${nMod ? `, ${nMod} correction(s) de blocs modulaires` : ""}${nDsl ? `, ${nDsl} relevé(s) de moteur` : ""} exporté(s). Envoie ce fichier pour l'intégrer aux données.`;
  }

  renderList();
  renderEditor();
  if (message) $("#bld-io").textContent = message;

  return {
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
