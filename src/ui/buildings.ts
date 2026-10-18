// Éditeur de bâtiments (onglet « Bâtiments ») : relever l'empreinte et les ports d'un bâtiment
// directement sur une grille, en s'aidant d'une capture d'écran posée en fond.
// La grille se manipule comme l'arbre de recherche (glisser, molette). La capture se cale en
// deux clics (deux coins du bâtiment), puis s'ajuste à la main en mode « Capture ».
// La capture reste dans le navigateur (jamais envoyée) ; les relevés sont gardés localement
// et s'exportent au format de data/ports.json.

import type { GameData } from "../engine/data.ts";
import type { InterfaceKind, InterfaceSetting, MachineInterface, Port, PortsEntry, PortsFile } from "../engine/extension-types.ts";
import { checkInterface, type Interfaces } from "../engine/interfaces.ts";
import {
  ASSEMBLY_SHORT,
  blockFaces,
  blockRange,
  EDGES,
  type Edge,
  editDiff,
  FACES,
  type FaceKey,
  fact,
  findBlock,
  frontEdge,
  isOpen,
  type ModAssembly,
  type ModBlock,
  type ModFact,
  type ModularEdit,
  type ModularFile,
  repeats,
  rule,
  treeGrid,
} from "../engine/modular.ts";
import { dieselConfigs, farmBlocks, farmRates } from "../engine/modular-calc.ts";
import { MODCALC_DEFAULT, modCalcHtml, modCalcOut, type ModCalcState } from "./modcalc-view.ts";
import {
  applyTool,
  type BgPlacement,
  bodyPoint,
  CELL,
  checkEntry,
  exportSurveys,
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
  scaleAround,
  type SurveyState,
  surveySource,
  surveyState,
  type Tool,
} from "./buildings-model.ts";
import { PanZoom } from "./canvas.ts";
import { loadLocalInterfaces, loadLocalModular, loadLocalSurveys, saveLocalInterfaces, saveLocalModular, saveLocalSurveys } from "./surveys.ts";
import { esc, fmt, fmtMF } from "./format.ts";

type Bg = BgPlacement & { url: string; rot: number; opacity: number; natW: number; natH: number };
/** Ce que fait la souris sur la grille. */
type Mode = "ports" | "capture" | "coins";
type PortTool = Exclude<Tool, "gomme">;

const STATE_BADGE: Record<SurveyState, string> = {
  depot: `<span class="bld-badge ok" title="intégré aux données du site : sert à tout le monde">dépôt</span>`,
  local: `<span class="bld-badge local" title="relevé dans ce navigateur : déjà utilisé par tes plans de pose ; exporte-le pour l'intégrer au site">local · à envoyer</span>`,
  manquant: `<span class="bld-badge none" title="pas encore relevé : les plans de pose supposent ses ports">manquant</span>`,
};

const TOOL_LABEL: Record<Tool, string> = { objet: "Port objet", fluide: "Port fluide", énergie: "Prise ⚡", logique: "Logique", gomme: "Gomme" };
const TIER = ["", "I", "II", "III", "IV", "V"];
const FACE_LABEL: Record<FaceKey, string> = { back: "Derrière", front: "Devant", side: "Côtés" };
const EDGE_LABEL: Record<Edge, string> = { haut: "bord haut", bas: "bord bas", gauche: "bord gauche", droite: "bord droit" };
/** Ce qu'on rappelle d'un bloc de la ferme sous « À savoir » (règles de pose, pas de calcul). */
const RANGE_NOTES = ["count", "sprinklersPerTank", "needsTankInControllerRange", "mustBeInControllerRange", "extraTanksNeedWater", "multipleOutputs", "placement"];

const HELP: Record<Mode, string> = {
  ports: "Glisse pour te déplacer · molette pour zoomer · clique dans la marge (ports) ou sur le corps (prise ⚡)",
  capture: "Glisse pour déplacer la capture · molette pour l'agrandir ou la réduire (Maj : plus fin) · flèches : réglage fin",
  coins: "",
};

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
): { show(id: string): void } {
  const pruned = pruneIntegrated(loadLocalSurveys(), repo);
  let local: Record<string, PortsEntry> = pruned.kept;
  if (pruned.dropped.length) save();
  // Interfaces notées dans ce navigateur ; une copie identique à celle du dépôt n'a plus lieu d'être.
  let localIfaces: Interfaces = Object.fromEntries(Object.entries(loadLocalInterfaces()).filter(([id, i]) => JSON.stringify(i) !== JSON.stringify(repoIfaces[id])));
  saveLocalInterfaces(localIfaces);
  /** Interface du bâtiment choisi, en cours de saisie (null : aucune). */
  let iface: MachineInterface | null = null;
  let ifaceMsg = "";
  // Corrections des blocs modulaires notées dans ce navigateur (S12) ; brouillon pendant « ✎ Corriger ».
  let localMod = loadLocalModular();
  let modDraft: ModularEdit | null = null;
  let modMsg = "";
  /** Bloc « Calcul » des ensembles (S13) : blocs saisis, gardés le temps de la page. */
  const mcState: ModCalcState = structuredClone(MODCALC_DEFAULT);
  const assemblyOf = new Map(repoModular.assemblies.flatMap((a) => a.blocks.map((b) => [b.id, a] as const)));
  let selectedId: string | null = null;
  let entry: PortsEntry | null = null;
  let tool: Tool = "objet";
  // Un sens par outil : passer de « sortie objet » à la prise ⚡ ne fait pas une prise en sortie.
  const dirByTool: Record<PortTool, Port["direction"]> = { objet: "entrée", fluide: "entrée", énergie: "entrée", logique: "entrée" };
  let selectedPort: number | null = null;
  let filter = "";
  let bg: Bg | null = null;
  let mode: Mode = "ports";
  let corners: [number, number][] = [];
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
          <p>Choisis un bâtiment dans la liste. Tu poses ses entrées, ses sorties et sa prise électrique sur une grille, en t'aidant d'une capture d'écran en vue de dessus. Les relevés sont gardés dans ce navigateur ; « Exporter mes relevés » produit un fichier à m'envoyer (ou à mettre dans <code>data/ports.json</code>).</p>
          <p class="hint">1 case = 1 Short Pipe. Pose le bâtiment sans le faire pivoter : tous les bâtiments ont 4 rotations (quarts de tour), le calculateur les déduit.</p>
        </div>
        <div class="panel bld-editor" id="bld-editor" hidden>
          <div class="bld-head" id="bld-head"></div>
          <div class="bld-row" id="bld-dims"></div>
          <div class="bld-tools" id="bld-tools" role="toolbar" aria-label="Outils"></div>
          <div class="bld-frame" id="bld-frame" tabindex="0" aria-label="Grille du bâtiment : glisser pour se déplacer, molette ou + / − pour zoomer, 0 pour tout voir">
            <div id="bld-canvas"></div>
            <p class="bld-help" id="bld-help"></p>
            <div class="seg bld-mode" id="bld-mode" role="radiogroup" aria-label="Ce que fait la souris" hidden>
              <button type="button" role="radio" data-mode="ports" title="Poser et modifier les ports">✎ Ports</button>
              <button type="button" role="radio" data-mode="capture" title="Déplacer et agrandir la capture à la main">✥ Capture</button>
            </div>
            <div class="rs-zoom">
              <button type="button" data-bzoom="in" aria-label="Zoomer">+</button>
              <button type="button" data-bzoom="out" aria-label="Dézoomer">−</button>
              <button type="button" data-bzoom="fit" aria-label="Tout voir">⤢</button>
            </div>
          </div>
          <p class="bld-legend">
            <span><i class="sw-oi"></i>objet entrée</span><span><i class="sw-oo"></i>objet sortie</span>
            <span><i class="sw-fi"></i>fluide entrée</span><span><i class="sw-fo"></i>fluide sortie</span>
            <span><i class="sw-ei"></i>prise ⚡</span><span><i class="sw-eo"></i>⚡ produite</span><span><i class="sw-l"></i>logique</span>
            <span><i class="sw-both"></i>deux couleurs = les deux sens</span>
          </p>
          <p class="bld-msg" id="bld-msg" aria-live="polite"></p>
          <div id="bld-portform"></div>
          <div id="bld-iface"></div>
          <div id="bld-mod"></div>
          <details class="bld-bg" id="bld-bg"><summary>Capture d'écran en fond (reste dans ton navigateur)</summary><div id="bld-bgbody"></div></details>
          <label class="bld-notes">Remarques <textarea id="bld-notes" rows="2" placeholder="ex. ce que la capture ne montre pas"></textarea></label>
          <div id="bld-status" aria-live="polite"></div>
          <div class="actions" id="bld-actions"></div>
        </div>
      </div>
    </div>`;
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  const frame = $("#bld-frame");
  const pz = new PanZoom(frame, { minWidth: 2 * CELL, maxWidth: maxViewWidth, fitOnReset: true });

  function save(): void {
    saveLocalSurveys(local);
  }

  // ---------------------------------------------------------------- liste
  function renderList(): void {
    const q = filter.trim().toLowerCase();
    const n = { depot: 0, local: 0, manquant: 0 };
    for (const m of machines) n[surveyState(m.id, repo, local)]++;
    $("#bld-states").innerHTML = `<b>${n.depot}</b> dans le dépôt (intégrés au site) · <b>${n.local}</b> local (dans ce navigateur, déjà utilisés par tes plans de pose ; « Exporter » pour les envoyer) · <b>${n.manquant}</b> manquants (ports supposés)`;
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
    ifaceMsg = "";
    modDraft = null;
    modMsg = "";
    selectedPort = null;
    mode = "ports";
    corners = [];
    message = "";
    renderList();
    renderEditor(false);
    onSelect(id);
  }

  // ---------------------------------------------------------------- dessin
  const bgTransform = (b: Bg) => `translate(${b.x * CELL} ${b.y * CELL}) scale(${b.scale}) rotate(${b.rot} ${b.natW / 2} ${b.natH / 2})`;

  function svg(): string {
    const e = entry!;
    const { w, h } = e.footprint!;
    const W = (w + 2) * CELL;
    const H = (h + 2) * CELL;
    let s = `<svg id="bld-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grille du bâtiment : marge pour les ports, corps pour la prise électrique">`;
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
    e.ports.forEach((p, i) => {
      const [x, y] = portCenter(w, h, p);
      const sel = i === selectedPort ? " sel" : "";
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
      s += `<g class="bld-port ${p.type} ${dir}${sel}" data-port="${i}"><rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="${p.side === "dessus" ? 3 : 4}"/>${half}<text x="${x}" y="${y + (p.side === "dessus" ? 5 : 6)}" text-anchor="middle">${glyph}</text></g>`;
    });
    for (const [cx, cy] of corners) s += `<g class="bld-mark"><line x1="${cx - 12}" y1="${cy}" x2="${cx + 12}" y2="${cy}"/><line x1="${cx}" y1="${cy - 12}" x2="${cx}" y2="${cy + 12}"/></g>`;
    return `${s}</svg>`;
  }

  /** Redessine la grille ; `keepView` garde le cadrage (sauf si la taille de la grille change). */
  function refreshCanvas(keepView = true): void {
    if (!entry) return;
    const c = $("#bld-canvas");
    c.innerHTML = svg();
    const { w, h } = entry.footprint!;
    pz.attach(c.querySelector("svg") as SVGSVGElement, (w + 2) * CELL, (h + 2) * CELL, keepView);
    renderStatus();
  }

  function maxViewWidth(): number {
    const { w, h } = entry?.footprint ?? { w: 2, h: 2 };
    const grid = Math.max(w + 2, h + 2) * CELL;
    const img = bg ? Math.max(bg.natW, bg.natH) * bg.scale + 2 * Math.max(Math.abs(bg.x), Math.abs(bg.y)) * CELL : 0;
    return Math.max(grid, img) * 2;
  }

  function imageBox(b: Bg) {
    return { x: b.x * CELL, y: b.y * CELL, w: b.natW * b.scale, h: b.natH * b.scale };
  }

  function toSvg(clientX: number, clientY: number): [number, number] | null {
    const el = root.querySelector<SVGSVGElement>("#bld-svg");
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y];
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

  // ---------------------------------------------------------------- panneaux
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
    const m = data.machines.get(selectedId)!;
    const st = surveyState(selectedId, repo, local);
    const where =
      st === "local"
        ? `relevé local : déjà utilisé par tes plans de pose${repo.machines[selectedId] ? " (à la place de celui du dépôt)" : ""}, à envoyer`
        : st === "depot"
          ? "dans le dépôt : intégré au site"
          : "manquant : les plans de pose supposent ses ports";
    $("#bld-head").innerHTML = `<h3>${esc(m.name)}</h3><span class="hint">Taille wiki : ${m.size ? `${m.size.w}×${m.size.l}` : "—"} · ${where}</span>`;
    const hint = powerHint(selectedId);
    $("#bld-dims").innerHTML = `
      <label>Largeur (cases) <input type="number" min="1" max="200" id="bld-w" value="${entry.footprint!.w}"></label>
      <label>Hauteur (cases) <input type="number" min="1" max="200" id="bld-h" value="${entry.footprint!.h}"></label>
      <button type="button" id="bld-swap" title="Échanger largeur et hauteur">⇄</button>
      <label class="bld-check"><input type="checkbox" id="bld-nopower"${entry.noPower ? " checked" : ""}> Sans prise électrique</label>
      <label class="bld-check"><input type="checkbox" id="bld-noports"${entry.noPorts ? " checked" : ""}> Sans port</label>
      ${hint ? `<span class="hint bld-powerhint">${esc(hint)}</span>` : ""}`;
    renderTools();
    refreshCanvas(keepView);
    renderPortForm();
    renderIface();
    renderModular();
    renderBgPanel();
    ($("#bld-notes") as HTMLTextAreaElement).value = entry.notes ?? "";
    renderActions();
    renderMode();
  }

  function renderTools(): void {
    const dir = tool === "gomme" ? null : dirByTool[tool];
    $("#bld-tools").innerHTML = `
      ${(["objet", "fluide", "énergie", "logique", "gomme"] as Tool[]).map((t) => `<button type="button" data-tool="${t}" aria-pressed="${t === tool}">${TOOL_LABEL[t]}</button>`).join("")}
      <span class="bld-sep"></span><span class="bld-dirlabel">Sens</span>
      ${(["entrée", "sortie", "les deux"] as const).map((d) => `<button type="button" data-dir="${d}" aria-pressed="${d === dir}"${dir ? "" : " disabled"}>${d}</button>`).join("")}`;
  }

  function renderPortForm(): void {
    const box = $("#bld-portform");
    if (selectedPort === null || !entry!.ports[selectedPort]) {
      box.innerHTML = `<p class="hint">Clique dans la marge pour poser une entrée ou une sortie, et sur le corps pour la prise électrique. Clique sur un port pour le modifier. « Les deux » sert aux poteaux et aux stockages.</p>`;
      return;
    }
    const p = entry!.ports[selectedPort]!;
    const where = p.side === "dessus" ? `dessus, case ${(p.cell as number[]).join(", ")}` : `${p.side}, case ${p.cell}`;
    box.innerHTML = `<div class="bld-portform">
      <b>${esc(p.type)} · ${esc(where)}</b>
      <label>Sens <select data-pf="direction">${(["entrée", "sortie", "les deux"] as const).map((d) => `<option${p.direction === d ? " selected" : ""}>${d}</option>`).join("")}</select></label>
      <label>Info-bulle du jeu <input data-pf="tip" value="${esc(p.tip ?? "")}" placeholder="ex. Input for Coal or coke Fuel"></label>
      <label>Ce que le jeu affiche <input data-pf="shown" value="${esc(p.shown ?? "")}" placeholder="ex. flèche violette vers le bas"></label>
      <button type="button" class="link" data-pf-del>Supprimer ce port</button>
    </div>`;
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

  function renderIface(): void {
    const box = $("#bld-iface");
    if (!selectedId) return;
    const i = iface;
    const state = localIfaces[selectedId] ? `<span class="bld-badge local">local · à envoyer</span>` : repoIfaces[selectedId] ? `<span class="bld-badge ok">dépôt</span>` : "";
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
    const save = i || localIfaces[selectedId] ? `<button type="button" id="bld-if-save">Enregistrer l'interface</button>` : "";
    const forget = localIfaces[selectedId] ? `<button type="button" class="link" id="bld-if-forget">Oublier mon interface locale</button>` : "";
    box.innerHTML = `<div class="bld-iface"><h4>Interface ${state} <span class="hint">· l'étiquette « [E] Interact », un levier ou un écran : seulement le réglage de la machine, rien pour le placement</span></h4>
      <div class="row"><label>Type ${kinds}</label></div>${body}<div class="actions">${save}${forget}</div><p class="bld-msg" aria-live="polite">${esc(ifaceMsg)}</p></div>`;
  }

  /** Une saisie dans la section « Interface » (champ, case ou liste). `redraw` : redessiner la section. */
  function ifaceInput(t: HTMLInputElement, redraw: boolean): void {
    const f = t.dataset.if!;
    if (f === "kind") {
      iface = t.value ? { ...(iface ?? { settings: [], sources: [] }), kind: t.value as InterfaceKind } : null;
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
    if (redraw) renderIface();
  }

  // ---------------------------------------------------------------- ensemble modulaire (S12)
  const modName = (id: string) => data.machines.get(id)?.name ?? id;
  /** Nom sans le début commun à tous les blocs de l'ensemble (« Diesel Engine Crankshaft » → « Crankshaft »). */
  function shortName(a: ModAssembly, id: string): string {
    const names = a.blocks.map((b) => modName(b.id).split(" "));
    let k = 0;
    while (names.every((n) => n.length > k + 1 && n[k] === names[0]![k])) k++;
    return modName(id).split(" ").slice(k).join(" ");
  }
  const modChip = (a: ModAssembly) => (id: string) => `<span class="mchip"><button type="button" class="link" data-bld="${esc(id)}" title="Ouvrir ${esc(modName(id))}">${esc(shortName(a, id))}</button></span>`;

  /** Étiquettes de source, une par wiki (les pages au survol), plus « ta correction » si besoin. */
  function srcTags(ids: string[], local = false): string {
    const groups = new Map<string, { cls: string; url?: string; titles: string[] }>();
    for (const id of new Set(ids)) {
      const s = repoModular.sources[id];
      if (!s) continue;
      const label = s.wiki === "miraheze" ? "Miraheze" : s.wiki === "fandom" ? "Fandom" : s.wiki === "jeu" ? "relevé en jeu" : "ta réponse";
      const g = groups.get(label) ?? { cls: s.wiki === "miraheze" || s.wiki === "fandom" ? "wiki" : "jeu", url: s.url, titles: [] };
      g.titles.push(s.page ?? s.note ?? id);
      groups.set(label, g);
    }
    let out = [...groups]
      .map(([label, g]) =>
        g.url
          ? `<a class="src-tag ${g.cls}" href="${esc(g.url)}" target="_blank" rel="noopener" title="${esc(g.titles.join(" · "))}">${label}</a>`
          : `<span class="src-tag ${g.cls}" title="${esc(g.titles.join(" · "))}">${label}</span>`,
      )
      .join("");
    if (local) out += `<span class="src-tag fix" title="notée dans ce navigateur">ta correction</span>`;
    return out;
  }
  /** ⚠ sur une question encore ouverte : un clic ouvre « ✎ Corriger ». */
  const openTag = (f: ModFact | undefined) =>
    isOpen(repoModular, f) ? `<button type="button" class="must unk" data-mod-edit title="${esc(f!.text)} — voir data/a-verifier.md ; clic : corriger">⚠ ${esc(f!.question!)}</button>` : "";

  function chainHtml(a: ModAssembly, b: ModBlock): string {
    const order = (rule(a, "order")?.value as string[] | undefined) ?? [];
    if (!order.length) return "";
    const box = (id: string) => {
      const blk = a.blocks.find((x) => x.id === id);
      return `<span class="b${id === b.id ? " on" : ""}">${esc(shortName(a, id))}${blk && repeats(blk) ? " × n" : ""}</span>`;
    };
    const list = (key: string, label: string) => {
      const ids = rule(a, key)?.value as string[] | undefined;
      return ids?.length ? `<p class="mchain-side">${label} : ${ids.map((id) => (id === b.id ? `<b>${esc(shortName(a, id))}</b>` : esc(shortName(a, id)))).join(", ")}.</p>` : "";
    };
    return `<div class="mchain">${order.map(box).join('<span class="arrow">→</span>')}</div>${list("optionalInLine", "Dans la ligne, facultatif")}${list("sideMounted", "Sur les côtés de la ligne")}`;
  }

  function contactHtml(a: ModAssembly, b: ModBlock): string {
    const edit = localMod[b.id];
    const info = blockFaces(b, modDraft ?? edit);
    let h = chainHtml(a, b);
    const names = a.faceNames ?? {};
    h += `<p class="hint">Les faces se lisent dans le sens de la chaîne : <b>devant</b> = ${esc(names.front ?? "")}, <b>derrière</b> = ${esc(names.back ?? "")}, <b>côtés</b> = ${esc(names.side ?? "")}.</p>`;
    if (modDraft) {
      const faces = modDraft.faces ?? {};
      const rows = FACES.map((f) => {
        const list = faces[f] ?? [];
        const chips = a.blocks
          .map((x) => `<label class="mchip${list.includes(x.id) ? "" : " off"}"><input type="checkbox" data-mod="face" data-face="${f}" data-id="${esc(x.id)}"${list.includes(x.id) ? " checked" : ""}> ${esc(shortName(a, x.id))}</label>`)
          .join("");
        return `<tr><th>${FACE_LABEL[f]}</th><td><label class="bld-check"><input type="checkbox" data-mod="req" data-face="${f}"${modDraft!.facesRequired?.[f] ? " checked" : ""}> obligatoire</label></td><td>${chips}</td></tr>`;
      }).join("");
      h += `<table><thead><tr><th>Face</th><th>Doit être touchée ?</th><th>Blocs qui peuvent la toucher</th></tr></thead><tbody>${rows}</tbody></table>`;
    } else if (!info.faces) {
      h += `<p>On ne sait pas encore comment ce bloc se pose. ${openTag(info.facesFact)}</p>`;
    } else {
      const rows = info.faces
        .map((r) => {
          const must = r.required === null ? `<span class="must unk">inconnu</span>` : r.required ? `<span class="must yes">obligatoire</span>` : `<span class="must no">facultatif</span>`;
          return `<tr><th>${FACE_LABEL[r.face]}</th><td>${must}</td><td>${r.blocks.length ? r.blocks.map(modChip(a)).join("") : `<span class="hint">rien</span>`}</td></tr>`;
        })
        .join("");
      h += `<table><thead><tr><th>Face</th><th>Doit être touchée ?</th><th>Blocs qui peuvent la toucher (clic : ouvrir le bloc)</th></tr></thead><tbody>${rows}</tbody></table>`;
      const texts = [info.facesFact, info.requiredFact].filter((f): f is ModFact => !!f);
      h += texts.map((f) => `<p class="hint">${esc(f.text)} ${openTag(f)}</p>`).join("");
      h += `<p class="hint">Sources : ${srcTags(texts.flatMap((f) => f.sources), info.local)}</p>`;
    }
    const fe = frontEdge(b, edit);
    const edges = EDGES.map((e) => `<option value="${e}"${fe === e ? " selected" : ""}>${EDGE_LABEL[e]}</option>`).join("");
    h += `<div class="row"><label>Devant, sur la grille du relevé <select data-mod="front"><option value="">inconnu</option>${edges}</select></label><span class="hint">le bord qui regarde dans le sens de la chaîne, le bloc posé sans rotation ; sert aux plans de pose (S14)</span>${fe ? "" : openTag(rule(a, "frontEdge"))}</div>`;
    return h;
  }

  function rangeSvg(side: number, radius: number): { svg: string; count: number } {
    const g = treeGrid(side, radius);
    const v = radius + 2;
    let s = `<svg viewBox="${-v} ${-v} ${2 * v} ${2 * v}" role="img" aria-label="Portée sur une grille d'arbres : ${g.count} emplacements touchés">`;
    for (const t of g.trees) s += `<rect x="${t.x0 + 0.2}" y="${t.y0 + 0.2}" width="${t.x1 - t.x0 - 0.4}" height="${t.y1 - t.y0 - 0.4}" rx=".6" class="${t.inRange ? "t-in" : "t-out"}"/>`;
    s += `<rect x="${-side / 2}" y="${-side / 2}" width="${side}" height="${side}" class="blk"/><circle r="${radius}" class="circ"/></svg>`;
    return { svg: s, count: g.count };
  }

  function rangeHtml(a: ModAssembly, b: ModBlock): string {
    const size = data.machines.get(b.id)?.size ?? null;
    const edits = modDraft ? { ...localMod, [b.id]: modDraft } : localMod;
    const r = blockRange(a, b, size, edits);
    const rows: string[] = [];
    const item = (dt: string, dd: string) => rows.push(`<dt>${dt}</dt><dd>${dd}</dd>`);
    if (modDraft) {
      const v = typeof r.tiles === "number" ? fmt(r.tiles, 2) : "";
      item(
        "Portée",
        `<input type="text" inputmode="decimal" class="num" data-mod="range" value="${v}"${r.tiles === "infinie" ? " disabled" : ""} aria-label="Portée en cases depuis le bord"> cases depuis le bord <label class="bld-check"><input type="checkbox" data-mod="infinite"${r.tiles === "infinie" ? " checked" : ""}> infinie</label>`,
      );
      const others = a.blocks.filter((x) => x.id !== b.id);
      item("Dessert", others.map((x) => `<label class="mchip${r.serves.includes(x.id) ? "" : " off"}"><input type="checkbox" data-mod="serve" data-id="${esc(x.id)}"${r.serves.includes(x.id) ? " checked" : ""}> ${esc(modName(x.id))}</label>`).join(""));
    } else {
      const tilesText =
        r.tiles === null
          ? `<span class="hint">pas de portée : ce bloc est desservi par d'autres</span>`
          : r.tiles === "infinie"
            ? `<b>infinie</b> ${esc(r.rangeFact?.text ?? "")}`
            : `<b>${fmt(r.tiles, 2)} cases</b> depuis le bord${r.fromCenter !== null ? ` (${fmt(r.fromCenter, 2)} depuis le centre, le bloc faisant ${size!.w} × ${size!.l})` : ""}`;
      item("Portée", `${tilesText} ${r.rangeFact ? srcTags(r.rangeFact.sources, edits[b.id]?.rangeTiles !== undefined) : ""}`);
      if (typeof r.tiles === "number") {
        const crit = rule(a, "rangeCriterion");
        const shape = rule(a, "rangeShape");
        item("Forme", `cercle ; ${esc(crit?.text ?? "")} ${srcTags([...(shape?.sources ?? []), ...(crit?.sources ?? [])])}`);
      }
      if (r.serves.length) item("Dessert", `${r.serves.map(modChip(a)).join("")} ${esc(r.servesFact?.text ?? "")} ${srcTags(r.servesFact?.sources ?? [], !!edits[b.id]?.serves)}`);
      else if (r.tiles !== null) item("Dessert", `<span class="hint">rien</span>`);
    }
    if (r.servedBy.length) {
      const reach = (t: number | "infinie" | null) => (t === "infinie" ? "portée infinie" : typeof t === "number" ? `${fmt(t, 2)} cases depuis son bord` : "portée inconnue");
      item("Doit être à portée de", r.servedBy.map((x) => `${modChip(a)(x.id)} <span class="hint">(${reach(x.tiles)})</span>`).join(" "));
    }
    const notes = RANGE_NOTES.map((k) => fact(b, k)).filter((f): f is ModFact => !!f);
    if (notes.length && !modDraft) item("À savoir", `<ul>${notes.map((f) => `<li>${esc(f.text)} ${srcTags(f.sources)} ${openTag(f)}</li>`).join("")}</ul>`);
    let drawing = "";
    if (r.fromCenter !== null && size && r.serves.includes("tree")) {
      const d = rangeSvg(size.w, r.fromCenter);
      drawing = d.svg;
      const grid = (fact(b, "treesPerSprinkler")?.value as { grid?: number } | undefined)?.grid;
      let check = `Sur une grille régulière d'arbres (4 × 4 cases), le cercle touche <b>${d.count}</b> emplacements d'arbre (en vert).`;
      if (grid !== undefined) check += d.count === grid ? ` C'est le nombre que donnent les deux wikis (${grid}). <span class="ok-text">✓ cohérent</span>` : ` <span class="must unk">⚠ les wikis disent ${grid} : vérifie la portée</span>`;
      const perHarvester = fact(b, "treesPerHarvester");
      if (perHarvester) check += ` Ce n'est pas le nombre qu'il récolte : ${esc(perHarvester.text)} ${openTag(perHarvester)}`;
      item("Contrôle", check);
    }
    return `<div class="mrange">${drawing}<dl>${rows.join("")}</dl></div>`;
  }

  function renderModular(): void {
    const box = $("#bld-mod");
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found) {
      box.innerHTML = "";
      return;
    }
    const { assembly: a, block: b } = found;
    const edit = localMod[b.id];
    const state = edit ? `<span class="bld-badge local">local · à envoyer</span>` : "";
    const how = a.assembly === "contact" ? "par contact : les blocs se touchent, face contre face" : "par portée : les blocs ne se touchent pas, chacun doit être dans le cercle du bloc qui le dessert";
    let body = `<p class="hint">${esc(b.role)}</p>${a.assembly === "contact" ? contactHtml(a, b) : rangeHtml(a, b)}`;
    if (modDraft) body += `<label class="bld-notes">Note <input type="text" data-mod="note" value="${esc(modDraft.note ?? "")}" placeholder="ex. vu en jeu : le côté plat regarde le contrôleur"></label>`;
    else if (edit?.note) body += `<p class="hint">Ta note : ${esc(edit.note)}</p>`;
    if (!modDraft) body += modCalcHtml(repoModular, data, a, mcState);
    const actions = modDraft
      ? `<button type="button" class="primary" data-mod-save>Enregistrer</button><button type="button" class="link" data-mod-cancel>Annuler</button>`
      : `<button type="button" data-mod-edit>✎ Corriger</button>${edit ? `<button type="button" class="link" data-mod-forget>Oublier ma correction locale</button>` : ""}`;
    box.innerHTML = `<div class="bld-mod${modDraft ? " editing" : ""}"><h4>Ensemble modulaire · ${esc(a.name)} (Tier ${TIER[a.tier] ?? a.tier}) ${state}<span class="hint">· ${how}</span></h4>${body}<div class="actions">${actions}</div><p class="bld-msg" aria-live="polite">${esc(modMsg)}</p></div>`;
  }

  /** Brouillon de correction : les valeurs en vigueur (dépôt, ou correction locale). */
  function modDraftFrom(a: ModAssembly, b: ModBlock): ModularEdit {
    const edit = localMod[b.id];
    const draft: ModularEdit = { source: surveySource("correction notée dans l'éditeur de bâtiments du calculateur") };
    if (a.assembly === "contact") {
      const faces = blockFaces(b, edit).faces ?? [];
      draft.faces = Object.fromEntries(faces.map((r) => [r.face, [...r.blocks]]));
      draft.facesRequired = Object.fromEntries(faces.map((r) => [r.face, r.required === true]));
    } else {
      const r = blockRange(a, b, data.machines.get(b.id)?.size ?? null, localMod);
      if (r.tiles !== null) draft.rangeTiles = r.tiles;
      draft.serves = [...r.serves];
    }
    if (edit?.note) draft.note = edit.note;
    return draft;
  }

  function modInput(t: HTMLInputElement & HTMLSelectElement): void {
    const found = selectedId ? findBlock(repoModular, selectedId) : null;
    if (!found) return;
    const b = found.block;
    const f = t.dataset.mod!;
    if (f === "front") {
      // Le bord « devant » s'enregistre tout de suite (pas besoin de « ✎ Corriger »).
      const next: ModularEdit = { ...(localMod[b.id] ?? {}), source: surveySource("correction notée dans l'éditeur de bâtiments du calculateur") };
      if (t.value) next.frontEdge = t.value as Edge;
      else delete next.frontEdge;
      if (Object.keys(next).length > 1) localMod[b.id] = next;
      else delete localMod[b.id];
      saveLocalModular(localMod);
      modMsg = t.value ? `Devant = ${EDGE_LABEL[t.value as Edge]}, enregistré dans ce navigateur. Pense à l'exporter.` : "Bord « devant » remis à inconnu.";
      renderList();
      return renderModular();
    }
    if (!modDraft) return;
    const face = t.dataset.face as FaceKey | undefined;
    const id = t.dataset.id;
    const toggle = (list: string[] | undefined) => (t.checked ? [...(list ?? []).filter((x) => x !== id), id!] : (list ?? []).filter((x) => x !== id));
    if (f === "note") return void (modDraft.note = t.value || undefined);
    if (f === "req" && face) modDraft.facesRequired = { ...modDraft.facesRequired, [face]: t.checked };
    else if (f === "face" && face && id) modDraft.faces = { ...modDraft.faces, [face]: toggle(modDraft.faces?.[face]) };
    else if (f === "serve" && id) modDraft.serves = toggle(modDraft.serves);
    else if (f === "infinite") {
      const repoTiles = fact(b, "rangeTiles")?.value;
      modDraft.rangeTiles = t.checked ? "infinie" : typeof repoTiles === "number" ? repoTiles : undefined;
    } else if (f === "range") {
      const v = Number(t.value.replace(",", "."));
      if (v > 0) {
        modDraft.rangeTiles = v;
        modMsg = "";
      } else modMsg = "Portée : un nombre de cases plus grand que 0.";
    }
    renderModular();
  }

  /** Saisie du bloc « Calcul » : seul le résultat est redessiné (la case garde le curseur). */
  function mcInput(t: HTMLInputElement): void {
    const a = selectedId ? assemblyOf.get(selectedId) : undefined;
    if (!a) return;
    const v = Number(t.value.replace(",", "."));
    if (!Number.isFinite(v) || t.value === "") return;
    const k = t.dataset.mc!;
    if (a.id === "tree-farm" && k in mcState.farm) (mcState.farm as Record<string, number>)[k] = k === "pollution" ? v : Math.max(0, Math.round(v));
    else if (a.id === "diesel-engine" && k in mcState.diesel) (mcState.diesel as Record<string, number>)[k] = Math.max(0, v);
    const out = root.querySelector("#mc-out");
    if (out) out.innerHTML = modCalcOut(repoModular, data, a, mcState);
  }

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

  function renderStatus(): void {
    if (!entry) return;
    const list = checkEntry(entry);
    $("#bld-status").innerHTML = list.length ? `<ul class="bld-problems">${list.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p class="ok-text">Relevé complet.</p>`;
  }

  function renderActions(): void {
    $("#bld-actions").innerHTML = `<button type="button" class="primary" id="bld-save">Enregistrer le relevé</button>${
      selectedId && local[selectedId] ? `<button type="button" class="link" id="bld-forget">Oublier mon relevé local</button>` : ""
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
      mode === "coins" ? (corners.length ? "Clique maintenant le coin bas-droit du bâtiment · Échap pour annuler" : "Clique le coin haut-gauche du bâtiment sur ta capture (zoome si besoin) · Échap pour annuler") : HELP[mode];
    $("#bld-msg").textContent = message;
    const cb = root.querySelector("#bld-corners");
    if (cb) cb.setAttribute("aria-pressed", String(mode === "coins"));
  }

  function setMode(m: Mode): void {
    mode = m;
    corners = [];
    refreshCanvas(true);
    renderMode();
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
      if (mode !== "capture" || !bg) return;
      e.preventDefault();
      // Maj + molette : certains navigateurs envoient alors un défilement horizontal.
      const delta = (e.deltaY || e.deltaX) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      const p = toSvg(e.clientX, e.clientY);
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
      refreshCanvas();
    } else if (t.dataset.if && t.type === "text") ifaceInput(t, false);
    else if (t.dataset.mod === "note") modInput(t as HTMLInputElement & HTMLSelectElement);
    else if (t.dataset.mc) mcInput(t);
    else if (t.id === "bld-notes") entry.notes = t.value || undefined;
    else if (t.id === "bld-bgo" && bg) {
      bg.opacity = Number(t.value);
      root.querySelector("#bld-bgimg")?.setAttribute("opacity", String(bg.opacity));
    } else if (t.dataset.pf && selectedPort !== null) {
      const p = entry.ports[selectedPort]!;
      if (t.dataset.pf === "tip") p.tip = t.value || undefined;
      if (t.dataset.pf === "shown") p.shown = t.value || undefined;
      refreshCanvas();
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
    if (t.dataset.mod) {
      // La note est prise à la frappe ; le reste redessine la section.
      if (t.dataset.mod !== "note") modInput(t);
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
    } else if (t.dataset.pf === "direction" && selectedPort !== null) {
      entry!.ports[selectedPort]!.direction = t.value as Port["direction"];
      refreshCanvas();
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
        $("#bld-io").textContent = `${Object.keys(parsed).length} relevé(s)${nIf ? `, ${nIf} interface(s)` : ""}${nMod ? `, ${nMod} correction(s) de blocs modulaires` : ""} importé(s).`;
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
      return renderModular();
    }
    const cfgBtn = target.closest<HTMLElement>("[data-mc-cfg]");
    if (cfgBtn) {
      const c = dieselConfigs(repoModular).find((x) => x.id === cfgBtn.dataset.mcCfg);
      if (c) mcState.diesel = { cylinders: c.cylinders, airFuel: c.airFuel, throttle: c.throttle };
      return renderModular();
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
      return;
    }
    if (target.closest("#bld-swap")) {
      const f = entry.footprint!;
      entry.footprint = { w: f.h, h: f.w };
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
    if (target.closest("[data-pf-del]") && selectedPort !== null) {
      entry.ports.splice(selectedPort, 1);
      selectedPort = null;
      return renderEditor();
    }
    if (target.closest("#bld-save")) {
      entry.source = surveySource();
      local[selectedId] = structuredClone(entry);
      save();
      message = isComplete(entry) ? "Relevé enregistré dans ce navigateur. Pense à l'exporter." : "Relevé enregistré, mais encore incomplet (voir la liste ci-dessous).";
      renderList();
      return renderEditor();
    }
    if (target.closest("[data-if-add-setting]") && iface) {
      iface.settings.push({ id: newSettingId(iface), name: "", choices: [{ label: "", recipes: [] }] });
      return renderIface();
    }
    const sIdx = Number(target.closest<HTMLElement>("[data-s]")?.dataset.s);
    if (target.closest("[data-if-del-setting]") && iface) {
      iface.settings.splice(sIdx, 1);
      return renderIface();
    }
    if (target.closest("[data-if-add-choice]") && iface?.settings[sIdx]?.choices) {
      iface.settings[sIdx]!.choices!.push({ label: "", recipes: [] });
      return renderIface();
    }
    if (target.closest("[data-if-del-choice]") && iface?.settings[sIdx]?.choices) {
      iface.settings[sIdx]!.choices!.splice(Number(target.closest<HTMLElement>("[data-c]")!.dataset.c), 1);
      return renderIface();
    }
    if (target.closest("#bld-if-save")) {
      if (iface) {
        // Sources : celles du dépôt, plus cette saisie (une seule, la dernière).
        iface.sources = [...iface.sources.filter((x) => x.wiki !== "saisie"), surveySource("interface notée dans l'éditeur de bâtiments du calculateur")];
        localIfaces[selectedId] = structuredClone(iface);
        ifaceMsg = checkInterface(iface, machineRecipes(selectedId).map((r) => r.id)).length
          ? "Interface enregistrée, mais incomplète (voir la liste)."
          : "Interface enregistrée dans ce navigateur : les plans l'utilisent déjà. Pense à l'exporter.";
      } else {
        delete localIfaces[selectedId];
        ifaceMsg = "Interface retirée de ce navigateur.";
      }
      saveLocalInterfaces(localIfaces);
      renderList();
      return renderIface();
    }
    if (target.closest("#bld-if-forget")) {
      delete localIfaces[selectedId];
      saveLocalInterfaces(localIfaces);
      const known = repoIfaces[selectedId];
      iface = known ? structuredClone(known) : null;
      ifaceMsg = "Interface locale oubliée.";
      renderList();
      return renderIface();
    }
    if (target.closest("[data-mod-edit]")) {
      const found = findBlock(repoModular, selectedId);
      if (!found || modDraft) return;
      modDraft = modDraftFrom(found.assembly, found.block);
      modMsg = "";
      renderModular();
      return root.querySelector("#bld-mod .bld-mod")?.scrollIntoView({ block: "nearest" });
    }
    if (target.closest("[data-mod-cancel]")) {
      modDraft = null;
      modMsg = "";
      return renderModular();
    }
    if (target.closest("[data-mod-save]") && modDraft) {
      const found = findBlock(repoModular, selectedId)!;
      const next = editDiff(found.assembly, found.block, { ...modDraft, frontEdge: localMod[selectedId]?.frontEdge });
      if (next) localMod[selectedId] = next;
      else delete localMod[selectedId];
      saveLocalModular(localMod);
      modDraft = null;
      modMsg = next ? "Correction enregistrée dans ce navigateur. Pense à l'exporter (« Exporter mes relevés »)." : "Aucune différence avec les données du site : rien d'enregistré.";
      renderList();
      return renderModular();
    }
    if (target.closest("[data-mod-forget]")) {
      delete localMod[selectedId];
      saveLocalModular(localMod);
      modDraft = null;
      modMsg = "Correction locale oubliée : retour aux données du site.";
      renderList();
      return renderModular();
    }
    if (target.closest("#bld-forget")) {
      delete local[selectedId];
      save();
      return select(selectedId);
    }

    // Clic sur la grille.
    if (!target.closest("#bld-svg") || pz.suppressClick || mode === "capture") return;
    const pt = toSvg((ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
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
      if (tool === "gomme") {
        entry.ports.splice(i, 1);
        selectedPort = null;
      } else selectedPort = i;
      refreshCanvas(true);
      return renderPortForm();
    }
    const gx = Math.floor(pt[0] / CELL);
    const gy = Math.floor(pt[1] / CELL);
    const inBody = gx >= 1 && gx <= w && gy >= 1 && gy <= h;
    let place: Pick<Port, "side" | "cell"> | null = null;
    if (inBody && (tool === "énergie" || tool === "logique" || tool === "gomme")) {
      const p = bodyPoint(w, h, pt[0], pt[1]);
      if (p) place = { side: "dessus", cell: p };
    } else if (!inBody && tool !== "énergie") {
      place = marginToPort(w, h, gx, gy);
    }
    if (!place) return;
    entry.ports = applyTool(entry.ports, tool, place, tool === "gomme" ? "entrée" : dirByTool[tool]);
    selectedPort = tool === "gomme" ? null : entry.ports.length - 1;
    refreshCanvas(true);
    renderPortForm();
  });

  function exportFile(): void {
    const n = Object.keys(local).length;
    const nIf = Object.keys(localIfaces).length;
    const nMod = Object.keys(localMod).length;
    if (!n && !nIf && !nMod) {
      $("#bld-io").textContent = "Aucun relevé local à exporter : enregistre d'abord un relevé.";
      return;
    }
    const blob = new Blob([JSON.stringify(exportSurveys(local, localIfaces, localMod), null, 1) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `releves-batiments-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("#bld-io").textContent = `${n} relevé(s)${nIf ? `, ${nIf} interface(s)` : ""}${nMod ? `, ${nMod} correction(s) de blocs modulaires` : ""} exporté(s). Envoie ce fichier pour l'intégrer aux données.`;
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
