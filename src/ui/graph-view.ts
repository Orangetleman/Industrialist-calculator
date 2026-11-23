// Canevas de l'éditeur de graphe (PLAN-GRAPHE.md, lots G2 et G3) : nœuds en HTML, arêtes SVG orthogonales
// de prise à prise, le tout dans un « monde » déplacé et zoomé par canvas.ts.
// G2 : se déplacer, zoomer, sélectionner un nœud, le glisser (au-delà de 4 px : un clic reste un clic),
// « Ranger » (flow-layout.ts) ; sous 28 % de zoom, vue allégée où les liaisons partent du bord du nœud.
// G3 : l'édition. Chaque geste devient une commande du modèle (src/engine/graph/edit.ts), gardée par
// GraphHistory (Ctrl Z / Ctrl Y) : ajouter une recette (barre, A), clic sur une ligne d'entrée ou de
// sortie → le sélecteur filtré, relier deux prises (glisser, ou deux appuis au doigt ; une prise d'un
// autre produit secoue en rouge), supprimer, cible, bulle du nœud (nombre, chaîne à l'échelle, recette,
// fixer), modes temporaires Alt / Maj / Ctrl lus sur le clic, sélection multiple.
// G5 : groupes (sélection multiple → « Grouper », Ctrl G) : un cadre autour des nœuds, ou replié en une boîte
// dont les prises mandataires mènent au nœud du groupe concerné ; réglages spéciaux du nœud dans la bulle
// (fournis par la page) ; bouton Fichier (échange avec Industrialist Calculator, fourni par la page).

import type { GameData } from "../engine/data.ts";
import {
  addRecipeCommand,
  applyCommand,
  balanceGraph,
  clickMode,
  collapsedOwners,
  countCommand,
  deleteCommand,
  energyRecipes,
  freeSpot,
  freshId,
  GraphError,
  GraphHistory,
  groupCommand,
  groupPorts,
  linkCommand,
  liveGroups,
  mainOutput,
  modeOfKeys,
  modeSource,
  needAt,
  parseCount,
  proxyMember,
  recipeAlternatives,
  recipePorts,
  recipesFor,
  snapPort,
  stepCount,
  targetCommand,
  type Graph,
  type GraphBalance,
  type GraphCommand,
  type GraphEdge,
  type GraphWorld,
  type Mode,
  type NodeId,
  type PortRef,
} from "../engine/graph/index.ts";
import { ENERGY } from "../engine/resources.ts";
import { t } from "../i18n/i18n.ts";
import { PanZoom, type Box } from "./canvas.ts";
import { layoutFlow } from "./flow-layout.ts";
import { icon } from "./icons.ts";
import { openRecipePicker, type PickerCard, type PickerTab } from "./recipe-picker.ts";

/** Un mouvement de moins de 4 px reste un clic (exigence du § 6). */
export const DRAG_SLOP = 4;
/** Sous ce zoom, la vue allégée : machine, nombre et produit ; liaisons au bord du nœud (§ 6, 28 %). */
export const FAR_ZOOM = 0.28;
/** Prise aimantée à l'arrivée d'un tracé : la plus proche à 22 px d'écran (exigence du § 6). */
export const SNAP_PX = 22;
/** Zoom de départ le plus petit : les lignes des nœuds restent lisibles. */
const START_ZOOM = 0.55;
/** Largeur d'un nœud (pixels du monde). */
export const NODE_W = 256;
/** Espaces de « Ranger » : entre colonnes (place des étiquettes) et entre nœuds d'une colonne. */
const GAP_X = 120;
const GAP_Y = 32;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const EPS = 1e-7;

export type GraphViewText = {
  /** Débit lisible (« 12 /min », « 0,2 /s ») d'après une valeur par minute. */
  rate: (perMin: number) => string;
  /** Nombre lisible (« 2,4 », « 30 »), pour les machines et les quantités d'une recette. */
  num: (x: number) => string;
  item: (id: string) => string;
  machine: (id: string) => string;
  cycle: (s: number) => string;
  energy: (mfps: number) => string;
  pollution: (perHour: number) => string;
  /** Libellés : cible, nombre fixé, entrée non alimentée, entrée en partie alimentée, aria du nœud. */
  target: string;
  fixed: string;
  missing: string;
  partial: (got: string, need: string) => string;
  nodeAria: (product: string, count: number, machine: string) => string;
};

export type GraphViewOptions = {
  data: GameData;
  world: () => GraphWorld;
  text: GraphViewText;
  /** HTML ajouté dans l'en-tête du nœud (⚠ d'une valeur à vérifier…). */
  badge?: (id: NodeId) => string;
  /** Sélection d'un nœud (null : plus rien, ou plusieurs). */
  onSelect: (id: NodeId | null) => void;
  /** Clic sur une liaison (null : clic dans le vide). */
  onEdge?: (edge: GraphEdge | null) => void;
  /** Le document a changé par un geste du canevas (glisser, « Ranger », édition, annuler). */
  onChange?: (g: Graph) => void;
  /** Largeur réservée à droite (colonne des boutons de zoom), que la vue de départ évite. */
  reserveRight?: number;
  /** « Recalculer » (G4) : le graphe part au solveur ; la page montre l'avant / après et n'applique rien sans accord. */
  onRecalc?: () => void;
  /** Bouton « Fichier » de la barre (G5) : la page ouvre son menu (import / export) sous le bouton. */
  onFile?: (anchor: HTMLElement) => void;
  /** Réglages spéciaux d'un nœud dans sa bulle (G5 : écrans S10, diesel S18, Mineshaft) : HTML de la page, "" s'il n'y en a pas. */
  extra?: (id: NodeId) => string;
};

type Pt = { x: number; y: number };
type NodeGeom = { w: number; h: number; ins: Map<string, Pt>; outs: Map<string, Pt> };
type EdgeEls = { g: SVGGElement; hit: SVGPathElement; line: SVGPathElement; lab: SVGGElement; rect: SVGRectElement; text: SVGTextElement };
type Cand = Pt & { ref: PortRef };
type Press = {
  kind: "node" | "bg" | "port";
  /** Appui sur un groupe (boîte repliée ou en-tête du cadre) : le groupe. */
  grp?: string;
  id: number;
  sx: number;
  sy: number;
  moved: boolean;
  node?: NodeId;
  /** Nœuds glissés ensemble (sélection multiple) et leur position de départ. */
  group?: { id: NodeId; x0: number; y0: number }[];
  k?: number;
  /** Ligne d'entrée ou de sortie appuyée (clic : le sélecteur filtré). */
  row?: PortRef;
  /** Prise appuyée (glisser : relier ; appui : la choisir). */
  port?: PortRef;
  link?: { r: DOMRect; v: Box; k: number; a: Pt; cands: Cand[]; over: Cand | null };
};

const SVG = "http://www.w3.org/2000/svg";
const MODES: Mode[] = ["link", "target", "del", "multi"];

/** Centre d'un élément dans le repère de `root` (bordures comprises), sans getBoundingClientRect : juste quel que soit le zoom. */
function centerIn(el: HTMLElement, root: HTMLElement): Pt {
  let x = el.offsetWidth / 2;
  let y = el.offsetHeight / 2;
  let e: HTMLElement | null = el;
  while (e && e !== root) {
    x += e.offsetLeft;
    y += e.offsetTop;
    const p = e.offsetParent as HTMLElement | null;
    if (!p) break;
    // offsetLeft part du bord intérieur du parent : on ajoute sa bordure.
    x += p.clientLeft;
    y += p.clientTop;
    e = p;
  }
  return { x, y };
}

/** Tracé orthogonal d'une sortie (a) vers une entrée (b) ; à rebours, il passe sous les deux nœuds. */
export function edgePath(a: Pt, b: Pt, below: number): { d: string; lx: number; ly: number } {
  if (b.x - a.x >= 24) {
    const mx = Math.round((a.x + b.x) / 2);
    return { d: `M${a.x} ${a.y}H${mx}V${b.y}H${b.x}`, lx: mx, ly: (a.y + b.y) / 2 };
  }
  const ax = a.x + 16;
  const bx = b.x - 16;
  return { d: `M${a.x} ${a.y}H${ax}V${below}H${bx}V${b.y}H${b.x}`, lx: (ax + bx) / 2, ly: below };
}

/** Hauteur probable d'un nœud pas encore dessiné (place libre) : en-tête, puis une ligne par prise. */
const guessHeight = (rows: number) => 70 + 31 * Math.max(1, rows);

export class GraphView {
  readonly frame: HTMLElement;
  private readonly opts: GraphViewOptions;
  private readonly pz: PanZoom;
  private readonly worldEl: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly nodesEl: HTMLDivElement;
  private readonly tmp: SVGPathElement;
  private readonly bub: HTMLDivElement;
  private readonly tray: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private readonly voidEl: HTMLDivElement;
  private g: Graph | null = null;
  private hist: GraphHistory | null = null;
  private bal: GraphBalance | null = null;
  private nodeEls = new Map<NodeId, HTMLElement>();
  private geom = new Map<NodeId, NodeGeom>();
  private edgeEls = new Map<string, EdgeEls>();
  /** Nœuds sélectionnés ; `sel` est celui de la bulle et de la fiche (sélection d'un seul). */
  private sels = new Set<NodeId>();
  private sel: NodeId | null = null;
  private edgeSel: string | null = null;
  private far = false;
  private k = 1;
  private press: Press | null = null;
  private frameReq = 0;
  private pending: Pt | null = null;
  /** Outil collant de la barre, touche tenue (Alt / Maj / Ctrl), prise choisie au premier appui. */
  private tool: Mode | null = null;
  private held: Mode | null = null;
  private armed: PortRef | null = null;
  /** Numéro du dernier nœud créé : un identifiant n'est jamais réutilisé dans la session. */
  private seq = 0;
  /** « Mettre la chaîne à l'échelle » allumé : − / + et la saisie changent aussi tout l'amont. */
  private chain = false;
  private bubFor: { id: NodeId; recipe: string } | null = null;
  private bubH = 0;
  private closePicker: (() => void) | null = null;
  private stale = false;
  /** Groupes (G5) : boîtes repliées, cadres dépliés, groupe sélectionné, nœud → groupe replié qui le cache. */
  private groupEls = new Map<string, HTMLElement>();
  private frameEls = new Map<string, HTMLElement>();
  private readonly framesEl: HTMLDivElement;
  private gsel: string | null = null;
  private owners = new Map<NodeId, string>();
  private extraHtml = "";
  /** Sélection faite au Ctrl + clic (outil Sélection) : pas de bulle, elle cacherait les voisins à ajouter. */
  private multiPick = false;

  constructor(frame: HTMLElement, opts: GraphViewOptions) {
    this.frame = frame;
    this.opts = opts;
    frame.classList.add("gv");
    this.worldEl = document.createElement("div");
    this.worldEl.className = "gv-world";
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.classList.add("gv-edges");
    this.svg.setAttribute("aria-hidden", "true");
    this.tmp = document.createElementNS(SVG, "path");
    this.tmp.classList.add("ge-tmp");
    this.nodesEl = document.createElement("div");
    this.nodesEl.className = "gv-nodes";
    this.framesEl = document.createElement("div");
    this.framesEl.className = "gv-frames";
    this.worldEl.append(this.framesEl, this.svg, this.nodesEl);
    // Outils posés sur le canevas (hors du monde : ni zoomés ni déplacés).
    this.bub = document.createElement("div");
    this.bub.className = "gv-bub gv-ui";
    this.bub.hidden = true;
    this.tray = document.createElement("div");
    this.tray.className = "gv-tray gv-ui";
    this.tray.setAttribute("role", "toolbar");
    this.hintEl = document.createElement("div");
    this.hintEl.className = "gv-hint gv-ui";
    this.hintEl.hidden = true;
    this.hintEl.setAttribute("aria-live", "polite");
    this.voidEl = document.createElement("div");
    this.voidEl.className = "gv-void";
    this.voidEl.hidden = true;
    frame.append(this.voidEl, this.bub, this.hintEl, this.tray);
    const reserve = opts.reserveRight ?? 0;
    this.pz = new PanZoom(frame, {
      noPan: ".gn, .gv-ui, .gf-hd",
      minWidth: 220,
      // Assez loin pour passer sous la vue allégée (28 %), même sur un petit plan.
      maxWidth: () => Math.max(this.contentBox().w * 1.6, frame.getBoundingClientRect().width / 0.12),
      // Vue de départ : tout le graphe s'il tient lisiblement ; sinon assez grand pour lire (START_ZOOM),
      // calé sur l'objectif (à droite) et centré en hauteur. « Tout voir » montre toujours tout.
      initialView: (fr, c) => {
        const room = Math.max(1, fr.w - reserve);
        const fit = Math.min(1, room / Math.max(1, c.w), fr.h / Math.max(1, c.h));
        const k = Math.max(fit, START_ZOOM);
        const w = fr.w / k;
        const h = fr.h / k;
        const x = c.w * k <= room ? (c.w - room / k) / 2 : c.w - room / k;
        return { x, y: (c.h - h) / 2, w, h };
      },
      onView: (k) => this.onView(k),
    });
    frame.addEventListener("pointerdown", (e) => this.onDown(e));
    frame.addEventListener("pointermove", (e) => this.onMove(e));
    frame.addEventListener("pointerup", (e) => this.onUp(e));
    frame.addEventListener("pointercancel", (e) => this.onUp(e, true));
    frame.addEventListener("keydown", (e) => {
      const n = (e.target as Element).closest?.<HTMLElement>(".gn");
      if (n && (e.key === "Enter" || e.key === " ") && !(e.target as Element).closest("button")) {
        e.preventDefault();
        if (n.dataset.group) this.pickGroup(n.dataset.group);
        else this.pick(n.dataset.id!);
      }
    });
    // Raccourcis et touches tenues : à l'écoute de la fenêtre (le focus peut être sur la page après une
    // suppression), en capture pour passer avant Ctrl K de la page quand le canevas a le focus.
    window.addEventListener("keydown", (e) => this.onKey(e), true);
    window.addEventListener("keyup", (e) => this.onKeyUp(e));
    window.addEventListener("blur", () => this.setHeld(null));
    this.tray.addEventListener("click", (e) => this.onTray(e));
    // Boutons des groupes : déplier la boîte repliée (⌄), replier le cadre (‹).
    this.worldEl.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLElement>("[data-gopen], [data-gfold]");
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.gopen) this.setCollapsed(b.dataset.gopen, false);
      else if (b.dataset.gfold) this.setCollapsed(b.dataset.gfold, true);
    });
    this.bindBubble();
  }

  get graph(): Graph | null {
    return this.g;
  }

  /** La bulle du nœud (la page y branche les réglages spéciaux qu'elle fournit par `extra`). */
  get bubbleEl(): HTMLElement {
    return this.bub;
  }

  /** Nœud sélectionné, quand il est seul ; null sinon. */
  get selected(): NodeId | null {
    return this.sels.size === 1 ? this.sel : null;
  }

  get canUndo(): boolean {
    return !!this.hist?.canUndo;
  }

  /**
   * Monte le canevas dans `host` (vidé) et dessine le graphe ; `keepView` garde la vue actuelle. Un
   * document neuf (autre que celui de l'historique) repart avec un historique vide.
   */
  show(host: HTMLElement, g: Graph, keepView: boolean): void {
    if (this.worldEl.parentElement !== host) {
      host.replaceChildren(this.worldEl);
    }
    if (!this.hist || this.hist.graph !== g) {
      this.hist = new GraphHistory(g, this.opts.data, this.opts.world());
      this.armed = null;
      this.edgeSel = null;
    }
    this.g = g;
    this.texts();
    this.render();
    this.pz.attachWorld(this.worldEl, this.contentBox(), keepView);
  }

  zoom(k: number): void {
    this.pz.zoom(k);
  }

  /** Tout voir. */
  fit(): void {
    this.pz.setContent(this.contentBox());
    this.pz.fit();
  }

  /** Vue de départ : lisible, calée sur l'objectif. */
  home(): void {
    this.pz.setContent(this.contentBox());
    this.pz.reset();
  }

  /** Sélectionne un nœud (ou rien) sans prévenir : la sélection vient d'ailleurs (adresse, rail). */
  select(id: NodeId | null, reveal = true): void {
    if (id && !this.nodeEls.has(id)) id = null;
    this.sels = new Set(id ? [id] : []);
    this.sel = id;
    this.multiPick = false;
    if (id) {
      this.edgeSel = null;
      this.gsel = null;
    }
    this.applySel();
    if (id && reveal) this.revealNode(id);
  }

  /**
   * « Ranger » : colonnes de l'extraction à l'objectif (flow-layout.ts), sans chevauchement. Un pas
   * d'annulation, sauf au premier affichage (`record` faux : la disposition de départ).
   */
  arrange(fit = true, record = true): void {
    if (!this.g || !this.g.nodes.length) return;
    const g = this.g;
    // Hauteurs réelles des nœuds complets (même si la vue est allégée en ce moment).
    const wasFar = this.far;
    if (wasFar) this.frame.classList.remove("far");
    const heights = new Map(g.nodes.map((n) => [n.id, this.nodeEls.get(n.id)?.offsetHeight ?? 120]));
    if (wasFar) this.frame.classList.add("far");
    const moves = arrangeGraph(g, this.opts.data, this.opts.world(), heights, this.bal);
    if (record) this.exec({ type: "move", moves });
    else {
      const next = applyCommand(g, { type: "move", moves }, this.opts.data, this.opts.world());
      this.hist = new GraphHistory(next, this.opts.data, this.opts.world());
      this.g = next;
      this.afterChange();
    }
    if (fit) this.fit();
    else this.home();
  }

  /**
   * Le plan du site ne suit plus le graphe (modifié depuis le dernier calcul) : « Recalculer » le signale
   * (pastille), sans rien relancer.
   */
  setStale(on: boolean): void {
    if (this.stale === on) return;
    this.stale = on;
    this.syncTray();
  }

  /** Une commande venue d'ailleurs (fiche S62, « Appliquer » du recalcul) : un pas d'annulation comme un geste. */
  run(cmd: GraphCommand): boolean {
    return this.exec(cmd);
  }

  /** Annuler / rétablir (Ctrl Z / Ctrl Y, boutons de la barre). */
  undo(): void {
    if (!this.hist?.canUndo) return;
    this.g = this.hist.undo();
    this.afterChange();
  }

  redo(): void {
    if (!this.hist?.canRedo) return;
    this.g = this.hist.redo();
    this.afterChange();
  }

  // ------------------------------------------------------------ commandes

  /** Applique une commande (un pas d'annulation) ; un geste refusé ne change rien et rend faux. */
  private exec(cmd: GraphCommand | null, light = false): boolean {
    if (!cmd || !this.hist) return false;
    try {
      this.g = this.hist.apply(cmd);
    } catch (err) {
      if (err instanceof GraphError) return false;
      throw err;
    }
    this.afterChange(light);
    return true;
  }

  /**
   * Après une commande : tout se redessine (l'équilibre a pu changer). `light` : les nœuds sont déjà à
   * leur place à l'écran (fin d'un glisser), rien à redessiner ; sur 400 nœuds, le relâcher coûtait
   * une image de 90 ms.
   */
  private afterChange(light = false): void {
    const g = this.g!;
    if (light) {
      this.syncTray();
      this.pz.setContent(this.contentBox());
      this.opts.onChange?.(g);
      return;
    }
    const has = (id: NodeId) => g.nodes.some((n) => n.id === id);
    // Un nœud sélectionné a disparu : la sélection se vide (pas de bulle qui s'ouvre d'elle-même sur un voisin).
    if ([...this.sels].some((id) => !has(id))) {
      this.sels = new Set();
      this.sel = null;
    }
    if (this.edgeSel && !g.edges.some((e) => e.id === this.edgeSel)) this.edgeSel = null;
    if (this.armed && !has(this.armed.node)) this.armed = null;
    if (this.gsel && !liveGroups(g).some((x) => x.id === this.gsel)) this.gsel = null;
    this.render();
    this.pz.setContent(this.contentBox());
    this.opts.onChange?.(g);
  }

  // ------------------------------------------------------------ rendu

  private contentBox(): Box {
    const g = this.g;
    if (!g || !g.nodes.length) return { x: 0, y: 0, w: 400, h: 300 };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of g.nodes) {
      const gm = this.geom.get(n.id);
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + (gm?.w ?? NODE_W));
      y1 = Math.max(y1, n.y + (gm?.h ?? 120));
    }
    const m = 40;
    return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
  }

  private render(): void {
    const g = this.g!;
    const { data, text: T } = this.opts;
    const world = this.opts.world();
    this.bal = balanceGraph(g, data, world);
    const bal = this.bal;
    const html: string[] = [];
    const rowIn = t("gv.row.in");
    const rowOut = t("gv.row.out");
    this.owners = collapsedOwners(g);
    for (const n of g.nodes) {
      if (this.owners.has(n.id)) continue; // caché dans son groupe replié
      const p = recipePorts(data, n.recipeId, world);
      const nb = bal.nodes.get(n.id)!;
      const main = mainOutput(data, n.recipeId, world);
      const product = T.item(main ?? n.recipeId);
      const machineId = p.eff?.recipe.machine ?? "";
      const machine = machineId ? T.machine(machineId) : "";
      const count = Math.ceil(n.machines - 1e-9);
      const facts = [
        p.eff?.durationS ? `<span>${esc(T.cycle(p.eff.durationS))}</span>` : "",
        nb.energyMFps ? `<span>${esc(T.energy(nb.energyMFps))}</span>` : "",
        nb.pollutionPerHour ? `<span>${esc(T.pollution(nb.pollutionPerHour))}</span>` : "",
      ].join("");
      const ins = nb.ins
        .map((pb) => {
          const cls = pb.perMin - pb.flow <= EPS ? "" : pb.links === 0 ? " miss" : " part";
          const tip = cls === " miss" ? T.missing : cls === " part" ? T.partial(T.rate(pb.flow), T.rate(pb.perMin)) : T.item(pb.item);
          return `<div class="gn-row${cls}" data-dir="in" data-item="${esc(pb.item)}" title="${esc(`${tip} · ${rowIn}`)}"><i class="gn-port" data-dir="in" data-item="${esc(pb.item)}"></i><span class="q">${esc(T.rate(pb.perMin))}</span><span class="it">${esc(T.item(pb.item))}</span></div>`;
        })
        .join("");
      const outs = nb.outs
        .map((pb) => `<div class="gn-row" data-dir="out" data-item="${esc(pb.item)}" title="${esc(`${T.item(pb.item)} · ${rowOut}`)}"><i class="gn-port" data-dir="out" data-item="${esc(pb.item)}"></i><span class="q">${esc(T.rate(pb.perMin))}</span><span class="it">${esc(T.item(pb.item))}</span></div>`)
        .join("");
      const target = g.target?.node === n.id;
      const lock = n.fixed ? `<span class="gn-lock" title="${esc(T.fixed)}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>` : "";
      html.push(
        `<div class="gn${target ? " target" : ""}${n.fixed ? " fixed" : ""}${this.sels.has(n.id) ? " sel" : ""}" data-id="${esc(n.id)}" data-target="${esc(T.target)}" style="transform:translate(${n.x}px,${n.y}px)" tabindex="0" role="button" aria-label="${esc(T.nodeAria(product, count, machine))}">` +
          `<div class="gn-hd"><b>${esc(product)}</b>${this.opts.badge?.(n.id) ?? ""}${lock}<span class="gn-n"><small>×</small>${count}</span></div>` +
          `<div class="gn-m"><span>${esc(machine)}</span>${facts}</div>` +
          `<div class="gn-io"><div class="gn-col i">${ins}</div><div class="gn-col o">${outs}</div></div></div>`,
      );
    }
    for (const grp of liveGroups(g)) if (grp.collapsed) html.push(this.groupBox(grp.id, grp.name));
    this.nodesEl.innerHTML = html.join("");
    const kids = [...this.nodesEl.children] as HTMLElement[];
    this.nodeEls = new Map(kids.filter((el) => el.dataset.id).map((el) => [el.dataset.id!, el]));
    this.groupEls = new Map(kids.filter((el) => el.dataset.group).map((el) => [el.dataset.group!, el]));
    this.measure();
    this.drawFrames();
    this.drawEdges();
    this.applySel();
    if (this.armed) this.portEl(this.armed)?.classList.add("arm");
    this.voidEl.hidden = g.nodes.length > 0;
    this.syncTray();
    this.syncBubble();
  }

  /** Prises de chaque nœud, relevées une fois (le rendu) : un glisser ne relit plus le DOM. */
  private measure(): void {
    this.geom.clear();
    for (const [id, el] of this.nodeEls) {
      const gm: NodeGeom = { w: el.offsetWidth, h: el.offsetHeight, ins: new Map(), outs: new Map() };
      for (const port of el.querySelectorAll<HTMLElement>(".gn-port")) {
        const dir = port.dataset.dir === "in" ? gm.ins : gm.outs;
        // Vue allégée : les lignes sont cachées, la liaison part du milieu du bord du nœud.
        dir.set(port.dataset.item!, this.far ? { x: port.dataset.dir === "in" ? 0 : gm.w, y: gm.h / 2 } : centerIn(port, el));
      }
      this.geom.set(id, gm);
    }
    for (const [gid, el] of this.groupEls) {
      const gm: NodeGeom = { w: el.offsetWidth, h: el.offsetHeight, ins: new Map(), outs: new Map() };
      for (const port of el.querySelectorAll<HTMLElement>(".gn-port")) {
        const dir = port.dataset.dir === "in" ? gm.ins : gm.outs;
        dir.set(port.dataset.item!, this.far ? { x: port.dataset.dir === "in" ? 0 : gm.w, y: gm.h / 2 } : centerIn(port, el));
      }
      this.geom.set(`@${gid}`, gm);
    }
  }

  // ------------------------------------------------------------ groupes (G5)

  /** Coin haut gauche d'un groupe : celui de ses nœuds (la boîte repliée s'y pose ; la glisser les déplace tous). */
  private groupPos(gid: string): Pt {
    let x = Infinity;
    let y = Infinity;
    for (const n of this.g!.nodes)
      if (n.group === gid) {
        x = Math.min(x, n.x);
        y = Math.min(y, n.y);
      }
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
  }

  /** Cadre d'un groupe déplié : la boîte qui entoure ses nœuds, avec la place de l'en-tête. */
  private groupRect(gid: string): Box {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of this.g!.nodes) {
      if (n.group !== gid) continue;
      const gm = this.geom.get(n.id);
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + (gm?.w ?? NODE_W));
      y1 = Math.max(y1, n.y + (gm?.h ?? 120));
    }
    const m = 22;
    return { x: x0 - m, y: y0 - m - 26, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m + 26 };
  }

  /** Boîte visible d'un nœud : la sienne, ou celle de son groupe replié. */
  private boxOf(id: NodeId): Box | null {
    const gid = this.owners.get(id);
    if (gid) {
      const p = this.groupPos(gid);
      const gm = this.geom.get(`@${gid}`);
      return { x: p.x, y: p.y, w: gm?.w ?? NODE_W, h: gm?.h ?? 120 };
    }
    const n = this.g!.nodes.find((x) => x.id === id);
    const gm = this.geom.get(id);
    return n ? { x: n.x, y: n.y, w: gm?.w ?? NODE_W, h: gm?.h ?? 120 } : null;
  }

  /** Boîte d'un groupe replié : son nom, le nombre de nœuds, et ses prises mandataires (ce qu'il reçoit et donne). */
  private groupBox(gid: string, name: string): string {
    const g = this.g!;
    const T = this.opts.text;
    const ports = groupPorts(g, this.bal!, gid);
    const n = g.nodes.filter((x) => x.group === gid).length;
    const p = this.groupPos(gid);
    const rowIn = t("gv.row.in");
    const rowOut = t("gv.row.out");
    const ins = ports.ins
      .map((pb) => {
        const cls = pb.perMin - pb.flow <= EPS ? "" : pb.links === 0 ? " miss" : " part";
        return `<div class="gn-row${cls}" data-dir="in" data-item="${esc(pb.item)}" title="${esc(`${T.item(pb.item)} · ${rowIn}`)}"><i class="gn-port" data-dir="in" data-item="${esc(pb.item)}"></i><span class="q">${esc(T.rate(pb.perMin))}</span><span class="it">${esc(T.item(pb.item))}</span></div>`;
      })
      .join("");
    const outs = ports.outs
      .map((pb) => `<div class="gn-row" data-dir="out" data-item="${esc(pb.item)}" title="${esc(`${T.item(pb.item)} · ${rowOut}`)}"><i class="gn-port" data-dir="out" data-item="${esc(pb.item)}"></i><span class="q">${esc(T.rate(pb.perMin))}</span><span class="it">${esc(T.item(pb.item))}</span></div>`)
      .join("");
    const target = !!g.target && g.nodes.find((x) => x.id === g.target!.node)?.group === gid;
    return (
      `<div class="gn gg${target ? " target" : ""}${this.gsel === gid ? " sel" : ""}" data-group="${esc(gid)}" data-target="${esc(T.target)}" style="transform:translate(${p.x}px,${p.y}px)" tabindex="0" role="button" aria-label="${esc(t("gv.g.aria", { name, n }))}">` +
      `<div class="gn-hd"><b>${esc(name)}</b><button type="button" class="gg-open" data-gopen="${esc(gid)}" title="${esc(t("gv.g.open"))}" aria-label="${esc(t("gv.g.open"))}">${icon("more")}</button></div>` +
      `<div class="gn-m"><span>${esc(t("gv.g.count", { n }))}</span></div>` +
      `<div class="gn-io"><div class="gn-col i">${ins}</div><div class="gn-col o">${outs}</div></div></div>`
    );
  }

  /** Cadres des groupes dépliés, sous les nœuds ; leur en-tête se glisse (tout le groupe suit) et se clique. */
  private drawFrames(): void {
    const g = this.g!;
    const html: string[] = [];
    for (const grp of liveGroups(g)) {
      if (grp.collapsed) continue;
      const n = g.nodes.filter((x) => x.group === grp.id).length;
      html.push(
        `<div class="gf${this.gsel === grp.id ? " sel" : ""}" data-group="${esc(grp.id)}"><div class="gf-hd" title="${esc(t("gv.g.hd.tip"))}"><b>${esc(grp.name)}</b><small>${esc(t("gv.g.count", { n }))}</small><button type="button" data-gfold="${esc(grp.id)}" title="${esc(t("gv.g.fold"))}" aria-label="${esc(t("gv.g.fold"))}">${icon("prev")}</button></div></div>`,
      );
    }
    this.framesEl.innerHTML = html.join("");
    this.frameEls = new Map(([...this.framesEl.children] as HTMLElement[]).map((el) => [el.dataset.group!, el]));
    for (const gid of this.frameEls.keys()) this.placeFrame(gid);
  }

  private placeFrame(gid: string): void {
    const el = this.frameEls.get(gid);
    if (!el) return;
    const r = this.groupRect(gid);
    el.style.transform = `translate(${r.x}px,${r.y}px)`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  }

  /** Clic sur un groupe : sa bulle (nom, replier / déplier, dégrouper) ; second clic : désélectionné. */
  private pickGroup(gid: string | null): void {
    const next = gid && this.gsel === gid ? null : gid;
    this.sels = new Set();
    this.sel = null;
    this.edgeSel = null;
    this.gsel = next;
    this.applySel();
    this.opts.onSelect(null);
  }

  /** « Grouper » (barre, Ctrl G) : les nœuds sélectionnés, en un pas ; le groupe neuf est sélectionné. */
  private groupSelection(): void {
    if (!this.g) return;
    const cmd = groupCommand(this.g, this.sels, (n) => t("gv.g.name", { n }));
    if (!cmd || cmd.type !== "group") return;
    if (!this.exec(cmd)) return;
    this.pickGroup(cmd.id);
  }

  private setCollapsed(gid: string, collapsed: boolean): void {
    this.exec({ type: "setGroup", id: gid, collapsed });
  }

  private drawEdges(): void {
    const g = this.g!;
    this.svg.replaceChildren();
    this.edgeEls.clear();
    for (const e of g.edges) {
      const g0 = document.createElementNS(SVG, "g");
      g0.classList.add("ge");
      g0.dataset.edge = e.id;
      const title = document.createElementNS(SVG, "title");
      const hit = document.createElementNS(SVG, "path");
      hit.classList.add("ge-hit");
      const line = document.createElementNS(SVG, "path");
      line.classList.add("ge-line");
      const lab = document.createElementNS(SVG, "g");
      lab.classList.add("ge-lab");
      const rect = document.createElementNS(SVG, "rect");
      rect.setAttribute("height", "16");
      const text = document.createElementNS(SVG, "text");
      lab.append(rect, text);
      g0.append(title, hit, line, lab);
      const flow = this.bal!.edges.get(e.id) ?? 0;
      const into = this.bal!.nodes.get(e.to)?.ins.find((p) => p.item === e.item);
      if (into && into.perMin - into.flow > EPS) g0.classList.add("short");
      const label = this.opts.text.rate(flow);
      text.textContent = label;
      title.textContent = `${this.opts.text.item(e.item)} : ${label}`;
      const w = label.length * 6.6 + 10;
      rect.setAttribute("width", String(w));
      text.setAttribute("x", "5");
      text.setAttribute("y", "12");
      this.svg.append(g0);
      this.edgeEls.set(e.id, { g: g0, hit, line, lab, rect, text });
      this.placeEdge(e);
    }
    this.tmp.removeAttribute("d");
    this.svg.append(this.tmp);
  }

  private placeEdge(e: GraphEdge): void {
    const els = this.edgeEls.get(e.id);
    const a = this.portAt(e.from, "outs", e.item);
    const b = this.portAt(e.to, "ins", e.item);
    if (!els) return;
    const ga = this.owners.get(e.from);
    if (!a || !b || (ga && ga === this.owners.get(e.to))) {
      els.g.style.display = "none"; // liaison à l'intérieur d'un groupe replié : cachée
      return;
    }
    els.g.style.display = "";
    const na = this.boxOf(e.from)!;
    const nbn = this.boxOf(e.to)!;
    const below = Math.max(na.y + na.h, nbn.y + nbn.h) + 24;
    const p = edgePath(a, b, below);
    els.hit.setAttribute("d", p.d);
    els.line.setAttribute("d", p.d);
    const w = Number(els.rect.getAttribute("width"));
    els.lab.setAttribute("transform", `translate(${(p.lx - w / 2).toFixed(1)},${(p.ly - 8).toFixed(1)})`);
  }

  private portAt(id: NodeId, dir: "ins" | "outs", item: string): Pt | null {
    const gid = this.owners.get(id);
    if (gid) {
      const o = this.geom.get(`@${gid}`)?.[dir].get(item);
      const p = this.groupPos(gid);
      return o ? { x: p.x + o.x, y: p.y + o.y } : null;
    }
    const n = this.g!.nodes.find((x) => x.id === id);
    const o = this.geom.get(id)?.[dir].get(item);
    return n && o ? { x: n.x + o.x, y: n.y + o.y } : null;
  }

  private portEl(ref: PortRef): HTMLElement | null {
    const gid = this.owners.get(ref.node);
    if (gid) return this.groupEls.get(gid)?.querySelector<HTMLElement>(`.gn-port[data-dir="${ref.side}"][data-item="${CSS.escape(ref.item)}"]`) ?? null;
    return this.nodeEls.get(ref.node)?.querySelector<HTMLElement>(`.gn-port[data-dir="${ref.side}"][data-item="${CSS.escape(ref.item)}"]`) ?? null;
  }

  private applySel(): void {
    for (const [nid, el] of this.nodeEls) el.classList.toggle("sel", this.sels.has(nid));
    for (const [gid, el] of this.groupEls) el.classList.toggle("sel", this.gsel === gid || [...this.sels].some((id) => this.owners.get(id) === gid));
    for (const [gid, el] of this.frameEls) el.classList.toggle("sel", this.gsel === gid);
    for (const [eid, els] of this.edgeEls) {
      const e = this.g!.edges.find((x) => x.id === eid);
      els.g.classList.toggle("hl", !!e && (this.sels.has(e.from) || this.sels.has(e.to)));
      els.g.classList.toggle("on", eid === this.edgeSel);
    }
    this.frame.classList.toggle("has-sel", this.sels.size > 0 || !!this.gsel);
    const gr = this.tray.querySelector<HTMLButtonElement>('[data-act="group"]');
    if (gr) gr.disabled = this.sels.size < 2;
    this.syncBubble();
  }

  private onView(k: number): void {
    this.k = k;
    const v = this.pz.view();
    const s = this.frame.style;
    s.setProperty("--gv-cs", `${28 * k}px`);
    s.setProperty("--gv-cx", `${-v.x * k}px`);
    s.setProperty("--gv-cy", `${-v.y * k}px`);
    const far = k < FAR_ZOOM;
    if (far !== this.far) {
      this.far = far;
      this.frame.classList.toggle("far", far);
      if (this.g) {
        this.measure();
        for (const gid of this.frameEls.keys()) this.placeFrame(gid);
        for (const e of this.g.edges) this.placeEdge(e);
      }
    }
    this.placeBubble();
  }

  private revealNode(id: NodeId): void {
    const n = this.g!.nodes.find((x) => x.id === id);
    if (!n) return;
    const gm = this.geom.get(id);
    this.pz.reveal(n.x - 10, n.y - 10, (gm?.w ?? NODE_W) + 60, Math.min(gm?.h ?? 120, 400) + 20);
  }

  // ------------------------------------------------------------ barre d'outils, rappel du mode

  /** Textes de la barre et du canevas vide (la langue peut avoir changé). */
  private texts(): void {
    const b = (attr: string, ic: Parameters<typeof icon>[0], label: string, title: string) =>
      `<button type="button" ${attr} title="${esc(title)}" aria-label="${esc(title)}">${icon(ic)}<span>${esc(label)}</span></button>`;
    this.tray.setAttribute("aria-label", t("gv.tray"));
    this.tray.innerHTML =
      b('data-act="recalc" class="gv-recalc"', "rotate", t("gv.t.recalc"), t("gv.t.recalc.tip")) +
      "<hr>" +
      b('data-act="add"', "plus", t("gv.t.add"), t("gv.t.add.tip")) +
      b('data-tool="link" aria-pressed="false"', "link", t("gv.t.link"), t("gv.t.link.tip")) +
      b('data-tool="target" aria-pressed="false"', "target", t("gv.t.target"), t("gv.t.target.tip")) +
      b('data-tool="del" aria-pressed="false"', "trash", t("gv.t.del"), t("gv.t.del.tip")) +
      b('data-tool="multi" aria-pressed="false"', "select", t("gv.t.multi"), t("gv.t.multi.tip")) +
      b('data-act="group"', "group", t("gv.t.group"), t("gv.t.group.tip")) +
      "<hr>" +
      b('data-act="undo"', "undo", t("gv.t.undo"), t("gv.t.undo.tip")) +
      b('data-act="redo"', "redo", t("gv.t.redo"), t("gv.t.redo.tip")) +
      (this.opts.onFile ? "<hr>" + b('data-act="file" aria-haspopup="true" aria-expanded="false"', "folder", t("gv.t.file"), t("gv.t.file.tip")) : "");
    this.voidEl.textContent = t("gv.void");
    this.bubFor = null;
  }

  private syncTray(): void {
    for (const b of this.tray.querySelectorAll<HTMLButtonElement>("[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === this.tool));
    const u = this.tray.querySelector<HTMLButtonElement>('[data-act="undo"]');
    const r = this.tray.querySelector<HTMLButtonElement>('[data-act="redo"]');
    if (u) u.disabled = !this.hist?.canUndo;
    if (r) r.disabled = !this.hist?.canRedo;
    const gr = this.tray.querySelector<HTMLButtonElement>('[data-act="group"]');
    if (gr) gr.disabled = this.sels.size < 2;
    const rc = this.tray.querySelector<HTMLButtonElement>('[data-act="recalc"]');
    if (rc) {
      rc.hidden = !this.opts.onRecalc;
      rc.classList.toggle("due", this.stale);
    }
    this.syncHint();
  }

  private onTray(e: MouseEvent): void {
    const b = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === "recalc") return this.opts.onRecalc?.();
    if (act === "add") return this.openPicker(null);
    if (act === "undo") return this.undo();
    if (act === "redo") return this.redo();
    if (act === "group") return this.groupSelection();
    if (act === "file") return this.opts.onFile?.(b);
    const tool = b.dataset.tool as Mode | undefined;
    if (tool && MODES.includes(tool)) {
      this.tool = this.tool === tool ? null : tool;
      if (this.tool !== "link") this.disarm();
      this.syncTray();
    }
  }

  /** Rappel au-dessus de la barre : le mode, d'où il vient (touche tenue ou outil), ce que fait le clic. */
  private syncHint(): void {
    const src = modeSource(this.held, this.tool);
    let text = "";
    // Une prise choisie (premier appui) : le rappel dit quoi toucher ensuite, avant celui de l'outil Relier.
    if (this.armed && (!src || src.mode === "link")) text = t(this.armed.side === "out" ? "gv.armed.out" : "gv.armed.in", { item: this.opts.text.item(this.armed.item) });
    else if (src) text = `${t(src.from === "key" ? `gv.key.${src.mode}` : `gv.tool.${src.mode}`)} : ${t(`gv.does.${src.mode}`)}${src.from === "tool" ? ` · ${t("gv.esc")}` : ""}`;    this.hintEl.hidden = !text;
    this.hintEl.textContent = text;
  }

  private setHeld(m: Mode | null): void {
    if (m === this.held) return;
    this.held = m;
    this.syncHint();
  }

  private visible(): boolean {
    return this.frame.isConnected && this.frame.offsetParent !== null && !this.frame.classList.contains("empty");
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.visible() || this.closePicker) return;
    const typing = e.target instanceof Element && !!e.target.closest("input, textarea, select, [contenteditable]");
    if (typing) return;
    if (e.key === "Alt" || e.key === "Shift" || e.key === "Control" || e.key === "Meta") {
      if (e.key === "Alt") e.preventDefault(); // pas de menu du navigateur pendant qu'on tient Alt
      this.setHeld(modeOfKeys({ altKey: e.key === "Alt", shiftKey: e.key === "Shift", ctrlKey: e.key === "Control", metaKey: e.key === "Meta" }));
      return;
    }
    // Les raccourcis valent quand le canevas a le focus, ou quand plus rien ne l'a (après une suppression).
    const a = document.activeElement;
    if (!(a === document.body || !a || this.frame.contains(a))) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    let done = true;
    if (ctrl && key === "z") e.shiftKey ? this.redo() : this.undo();
    else if (ctrl && key === "y") this.redo();
    else if (ctrl && key === "g") this.groupSelection();
    else if (ctrl && key === "a") {
      this.sels = new Set(this.g?.nodes.map((n) => n.id) ?? []);
      this.sel = this.sels.size === 1 ? [...this.sels][0]! : null;
      this.applySel();
      this.opts.onSelect(this.selected);
    } else if ((ctrl && key === "k") || (!ctrl && !e.altKey && key === "a")) this.openPicker(null);
    else if (!ctrl && (e.key === "Delete" || e.key === "Backspace")) this.deleteSelection();
    else if (e.key === "Escape" && (this.armed || this.tool)) {
      this.disarm();
      this.tool = null;
      this.syncTray();
    } else if (e.key === "Escape" && this.gsel) {
      this.pickGroup(null);
    } else if (e.key === "Escape" && this.sels.size) {
      this.select(null);
      this.opts.onSelect(null);
      done = false; // la page ferme aussi la fiche
    } else done = false;
    if (done) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (["Alt", "Shift", "Control", "Meta"].includes(e.key)) this.setHeld(modeOfKeys(e));
  }

  private deleteSelection(): void {
    if (!this.g) return;
    // Un groupe sélectionné : Suppr retire ses nœuds (un pas, Ctrl Z les rend).
    const ids = this.gsel ? this.g.nodes.filter((n) => n.group === this.gsel).map((n) => n.id) : this.sels;
    this.exec(deleteCommand(this.g, ids, this.edgeSel ? [this.edgeSel] : []));
    if (!this.sels.size) this.opts.onSelect(null);
  }

  // ------------------------------------------------------------ sélecteur de recettes

  /** Ouvre le sélecteur ; depuis une prise, il est filtré (Produire pour une entrée, Consommer pour une sortie). */
  private openPicker(port: PortRef | null): void {
    if (!this.g) return;
    const { data, text: T } = this.opts;
    const world = this.opts.world();
    const all = [...data.recipes.keys()].filter((id) => recipePorts(data, id, world).eff);
    const gens = energyRecipes(data);
    const item = port?.item ?? null;
    const tabs: PickerTab[] = port
      ? [
          { key: "produce", label: t("gv.pick.produce", { item: T.item(port.item) }), ids: () => recipesFor(data, port.item, "produce", world) },
          { key: "consume", label: t("gv.pick.consume", { item: T.item(port.item) }), ids: () => recipesFor(data, port.item, "consume", world) },
          { key: "energy", label: t("gv.pick.energy"), ids: () => gens },
        ]
      : [
          { key: "all", label: t("gv.pick.all"), ids: () => all },
          { key: "energy", label: t("gv.pick.energy"), ids: () => gens },
        ];
    if (port?.side === "out") tabs.unshift(tabs.splice(1, 1)[0]!);
    const q = (v: number | null) => (v === null ? "?" : T.num(v));
    const card = (id: string): PickerCard => {
      const r = data.recipes.get(id)!;
      const side = (o: Record<string, number | null>) => Object.entries(o).filter(([k]) => k !== ENERGY).map(([k, v]) => ({ item: k, name: T.item(k), q: q(v) }));
      const info = [r.durationS ? T.cycle(r.durationS) : "", r.energyMFps ? T.energy(r.energyMFps) : ""].filter(Boolean).join(" · ");
      return { ins: side(r.inputs), outs: side(r.outputs), machine: T.machine(r.machine), info };
    };
    const title = port ? t(port.side === "in" ? "gv.pick.title.in" : "gv.pick.title.out", { item: T.item(port.item) }) : t("gv.pick.title");
    this.closePicker = openRecipePicker({
      title,
      tabs,
      item,
      card,
      onPick: (id) => this.addRecipe(id, port),
      onClose: () => {
        this.closePicker = null;
        this.frame.focus({ preventScroll: true });
      },
    });
  }

  /** Pose la recette choisie à une place libre (à gauche d'une entrée, à droite d'une sortie, au centre sinon). */
  private addRecipe(recipeId: string, port: PortRef | null): void {
    const g = this.g!;
    const { data } = this.opts;
    const world = this.opts.world();
    const p = recipePorts(data, recipeId, world);
    const size = { w: NODE_W, h: guessHeight(Math.max(p.ins.length, p.outs.length)) };
    let want: Pt;
    const anchor = port ? this.boxOf(port.node) : null;
    if (port && anchor) {
      const py = (this.portAt(port.node, port.side === "in" ? "ins" : "outs", port.item)?.y ?? anchor.y + 40) - anchor.y;
      want = { x: port.side === "in" ? anchor.x - NODE_W - GAP_X : anchor.x + anchor.w + GAP_X, y: Math.round(anchor.y + py - 60) };
    } else {
      const v = this.pz.view();
      want = { x: Math.round(v.x + v.w / 2 - NODE_W / 2), y: Math.round(v.y + v.h / 2 - size.h / 2) };
    }
    const at = freeSpot(g, want, size, (id) => this.geom.get(id) ?? { w: NODE_W, h: 120 });
    const { id, seq } = freshId(g, this.seq);
    const cmd = addRecipeCommand(data, recipeId, { id, at, world, ...(port && this.bal ? { from: { port, perMin: needAt(this.bal, port) } } : {}) });
    if (!this.exec(cmd)) return;
    this.seq = seq;
    this.edgeSel = null;
    this.select(id);
    this.opts.onSelect(id);
  }

  // ------------------------------------------------------------ bulle du nœud (S67)

  private bindBubble(): void {
    const b = this.bub;
    // La molette et les touches de la bulle restent à elle (pas de zoom, pas de Suppr du nœud).
    b.addEventListener("wheel", (e) => {
      e.stopPropagation();
      if ((e.target as Element).closest("[data-b=n]")) {
        e.preventDefault();
        this.bumpCount(e.deltaY < 0 ? 1 : -1);
      }
    });
    b.addEventListener("click", (e) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-b]");
      const gid = this.gsel;
      if (el && gid && this.g) {
        const grp = this.g.groups?.find((x) => x.id === gid);
        if (el.dataset.b === "fold" && grp) this.setCollapsed(gid, !grp.collapsed);
        else if (el.dataset.b === "ungroup") {
          this.exec({ type: "ungroup", id: gid });
          this.frame.focus({ preventScroll: true });
        } else if (el.dataset.b === "gdel") this.deleteSelection();
        else if (el.dataset.b === "close") {
          this.pickGroup(null);
          this.frame.focus({ preventScroll: true });
        }
        return;
      }
      const id = this.sel;
      if (!el || !id || !this.g) return;
      const n = this.g.nodes.find((x) => x.id === id);
      if (!n) return;
      switch (el.dataset.b) {
        case "less":
          return this.bumpCount(-1);
        case "more":
          return this.bumpCount(1);
        case "fix":
          this.exec({ type: "setFixed", id, fixed: !n.fixed });
          return;
        case "chain":
          this.chain = !this.chain;
          return this.syncBubble();
        case "target":
          this.exec(targetCommand(this.g, id));
          return;
        case "del":
          this.exec(deleteCommand(this.g, [id]));
          this.opts.onSelect(null);
          this.frame.focus({ preventScroll: true });
          return;
        case "close":
          this.select(null);
          this.opts.onSelect(null);
          this.frame.focus({ preventScroll: true });
          return;
      }
    });
    b.addEventListener("change", (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement;
      if (el.dataset.b === "gname" && this.gsel) {
        this.exec({ type: "setGroup", id: this.gsel, name: el.value });
        return;
      }
      const id = this.sel;
      if (!id || !this.g) return;
      if (el.dataset.b === "n") {
        const v = parseCount(el.value);
        if (v === null || !this.exec(countCommand(this.g, id, v, this.chain))) this.syncBubble(true);
      } else if (el.dataset.b === "recipe") this.exec({ type: "replaceRecipe", id, recipeId: el.value });
    });
    b.addEventListener("keydown", (e) => {
      const el = e.target as HTMLElement;
      if (el.dataset.b === "gname" && e.key === "Enter") return (el as HTMLInputElement).blur();
      if (el.dataset.b !== "n") return;
      if (e.key === "Enter") (el as HTMLInputElement).blur();
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        this.bumpCount(e.key === "ArrowUp" ? 1 : -1);
      } else if (e.key === "Escape") {
        this.syncBubble(true);
        (el as HTMLInputElement).blur();
      }
    });
  }

  private bumpCount(d: 1 | -1): void {
    const id = this.sel;
    const n = id && this.g?.nodes.find((x) => x.id === id);
    if (!n || !this.g) return;
    this.exec(countCommand(this.g, n.id, stepCount(n.machines, d), this.chain));
    this.syncBubble(true);
  }

  /** La bulle du nœud sélectionné seul (construite à la sélection, remplie à chaque changement). */
  private syncBubble(forceCount = false): void {
    if (this.gsel) return this.syncGroupBubble();
    const id = this.sels.size === 1 && !this.multiPick ? this.sel : null;
    const n = id ? this.g?.nodes.find((x) => x.id === id) : undefined;
    if (!n) {
      this.bub.hidden = true;
      this.bubFor = null;
      return;
    }
    const { data, text: T } = this.opts;
    const world = this.opts.world();
    if (this.bubFor?.id !== n.id) this.chain = false;
    const r = data.recipes.get(n.recipeId);
    const product = T.item(mainOutput(data, n.recipeId, world) ?? n.recipeId);
    if (this.bubFor?.id !== n.id || this.bubFor.recipe !== n.recipeId) {
      const alts = recipeAlternatives(data, n.recipeId, world);
      const opt = (rid: string) => {
        const x = data.recipes.get(rid)!;
        const ins = Object.keys(x.inputs).filter((k) => k !== ENERGY).map((k) => T.item(k));
        return `<option value="${esc(rid)}"${rid === n.recipeId ? " selected" : ""}>${esc([T.machine(x.machine), x.durationS ? T.cycle(x.durationS) : "", ins.join(" + ")].filter(Boolean).join(" · "))}</option>`;
      };
      this.bub.innerHTML = `<header><b data-b-title></b><button type="button" data-b="close" title="${esc(t("gv.close"))}" aria-label="${esc(t("gv.close"))}">${icon("close")}</button></header>
        <div class="gv-brow"><span>${esc(t("gv.b.machines"))}</span><span class="gv-cnt"><button type="button" data-b="less" title="${esc(t("gv.b.less"))}" aria-label="${esc(t("gv.b.less"))}">−</button><input data-b="n" inputmode="decimal" aria-label="${esc(t("gv.b.machines"))}" title="${esc(t("gv.b.n.tip"))}"><button type="button" data-b="more" title="${esc(t("gv.b.more"))}" aria-label="${esc(t("gv.b.more"))}">+</button></span></div>
        <div class="gv-brow"><span>${esc(t("gv.b.exact"))}</span><span class="num" data-b-exact></span></div>
        <div class="gv-brow"><span>${esc(t("gv.b.recipe"))}</span><select data-b="recipe" aria-label="${esc(t("gv.b.recipe"))}"${alts.length < 2 ? " disabled" : ""}>${alts.map(opt).join("")}</select></div>
        <div class="gv-brow"><span>${esc(t("gv.b.fix"))}</span><button type="button" class="gv-sw" data-b="fix" role="switch" title="${esc(t("gv.fixed"))}"><i></i><small>${esc(t("gv.b.fix.note"))}</small></button></div>
        <div class="gv-bx" data-b-extra></div>
        <div class="gv-acts"><button type="button" data-b="chain" title="${esc(t("gv.b.chain.tip"))}">${icon("scale")}${esc(t("gv.b.chain"))}</button><button type="button" data-b="target" title="${esc(t("gv.t.target.tip"))}">${icon("target")}${esc(t("gv.b.target"))}</button><button type="button" data-b="del" title="${esc(t("gv.t.del.tip"))}">${icon("trash")}${esc(t("gv.b.del"))}</button></div>`;
      this.extraHtml = "";
      this.bub.setAttribute("role", "dialog");
      this.bub.setAttribute("aria-label", t("gv.b.aria", { product }));
      forceCount = true;
    }
    this.bubFor = { id: n.id, recipe: n.recipeId };
    this.bub.querySelector("[data-b-title]")!.textContent = `${r ? T.machine(r.machine) : n.recipeId} — ${product}`;
    const input = this.bub.querySelector<HTMLInputElement>("[data-b=n]")!;
    const whole = Math.ceil(n.machines - 1e-9);
    if (forceCount || document.activeElement !== input) input.value = T.num(whole);
    const exact = Math.abs(n.machines - Math.round(n.machines)) < 1e-9 ? T.num(Math.round(n.machines)) : t("gv.b.use", { n: T.num(n.machines), pct: T.num(Math.round((n.machines / whole) * 100)) });
    this.bub.querySelector("[data-b-exact]")!.textContent = exact;
    const fix = this.bub.querySelector<HTMLElement>("[data-b=fix]")!;
    fix.setAttribute("aria-checked", String(!!n.fixed));
    this.bub.querySelector("[data-b=chain]")!.setAttribute("aria-pressed", String(this.chain));
    this.bub.querySelector("[data-b=target]")!.setAttribute("aria-pressed", String(this.g?.target?.node === n.id));
    const less = this.bub.querySelector<HTMLButtonElement>("[data-b=less]")!;
    less.disabled = n.machines <= 1 + 1e-9;
    // Réglages spéciaux (écrans S10, diesel S18, Mineshaft) : ceux de la fiche S62, fournis par la page ;
    // réécrits seulement s'ils changent (un champ en cours de saisie garde son focus).
    const extra = this.opts.extra?.(n.id) ?? "";
    if (extra !== this.extraHtml) {
      const box = this.bub.querySelector<HTMLElement>("[data-b-extra]")!;
      if (!box.contains(document.activeElement)) {
        box.innerHTML = extra;
        box.hidden = !extra;
        this.extraHtml = extra;
      }
    }
    this.bub.hidden = false;
    this.bubH = this.bub.offsetHeight;
    this.placeBubble();
  }

  /** Bulle d'un groupe (G5) : nom, nombre de nœuds, replier / déplier, dégrouper, supprimer ses nœuds. */
  private syncGroupBubble(): void {
    const g = this.g;
    const grp = g?.groups?.find((x) => x.id === this.gsel);
    const n = grp ? g!.nodes.filter((x) => x.group === grp.id).length : 0;
    if (!grp || !n) {
      this.bub.hidden = true;
      this.bubFor = null;
      return;
    }
    const key = `@${grp.id}`;
    if (this.bubFor?.id !== key || this.bubFor.recipe !== String(!!grp.collapsed)) {
      this.bub.innerHTML = `<header><b data-b-title></b><button type="button" data-b="close" title="${esc(t("gv.close"))}" aria-label="${esc(t("gv.close"))}">${icon("close")}</button></header>
        <div class="gv-brow"><span>${esc(t("gv.g.nameLabel"))}</span><input data-b="gname" class="gv-gname" aria-label="${esc(t("gv.g.nameLabel"))}"></div>
        <div class="gv-brow"><span>${esc(t("gv.g.nodes"))}</span><span class="num" data-b-count></span></div>
        <p class="gv-bnote">${esc(t(grp.collapsed ? "gv.g.note.shut" : "gv.g.note.open"))}</p>
        <div class="gv-acts"><button type="button" data-b="fold">${icon(grp.collapsed ? "more" : "prev")}${esc(t(grp.collapsed ? "gv.g.open" : "gv.g.fold"))}</button><button type="button" data-b="ungroup" title="${esc(t("gv.g.ungroup.tip"))}">${icon("select")}${esc(t("gv.g.ungroup"))}</button><button type="button" data-b="gdel" title="${esc(t("gv.g.del.tip"))}">${icon("trash")}${esc(t("gv.b.del"))}</button></div>`;
      this.bub.setAttribute("role", "dialog");
      this.bub.setAttribute("aria-label", t("gv.g.bubble", { name: grp.name }));
      this.bubFor = { id: key, recipe: String(!!grp.collapsed) };
    }
    this.bub.querySelector("[data-b-title]")!.textContent = grp.name;
    const inp = this.bub.querySelector<HTMLInputElement>("[data-b=gname]")!;
    if (document.activeElement !== inp) inp.value = grp.name;
    this.bub.querySelector("[data-b-count]")!.textContent = String(n);
    this.bub.hidden = false;
    this.bubH = this.bub.offsetHeight;
    this.placeBubble();
  }

  /** Bulle accrochée sous le nœud (au-dessus s'il n'y a pas la place), dans le cadre, à l'échelle de l'écran. */
  private placeBubble(): void {
    if (this.bub.hidden || !this.g) return;
    let n: { x: number; y: number } | undefined;
    let h = 120;
    if (this.gsel) {
      const grp = this.g.groups?.find((x) => x.id === this.gsel);
      if (!grp) return;
      if (grp.collapsed) {
        n = this.groupPos(grp.id);
        h = this.geom.get(`@${grp.id}`)?.h ?? 120;
      } else {
        const r = this.groupRect(grp.id);
        n = { x: r.x, y: r.y };
        h = r.h; // sous le cadre (au-dessus faute de place)
      }
    } else {
      if (!this.sel) return;
      n = this.g.nodes.find((x) => x.id === this.sel);
      if (!n) return;
      h = this.geom.get(this.sel)?.h ?? 120;
    }
    const v = this.pz.view();
    const k = this.k;
    const fw = this.frame.clientWidth;
    const fh = this.frame.clientHeight;
    const bw = 264;
    const bh = this.bubH || 200;
    let x = (n.x - v.x) * k;
    let y = (n.y + h - v.y) * k + 10;
    // Pas la place dessous (la barre d'outils occupe le bas) : au-dessus du nœud.
    if (y + bh > fh - 64) y = (n.y - v.y) * k - bh - 10;
    x = Math.max(6, Math.min(x, fw - bw - 6));
    y = Math.max(6, Math.min(y, fh - bh - 64));
    this.bub.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }

  // ------------------------------------------------------------ gestes

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || !this.g) return;
    const t0 = e.target as Element;
    if (t0.closest("button, input, select, a, .rs-zoom, .gv-ui")) return;
    const node = t0.closest<HTMLElement>(".gn");
    const base = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
    const gid = node?.dataset.group ?? t0.closest<HTMLElement>(".gf-hd")?.closest<HTMLElement>(".gf")?.dataset.group;
    if (gid) {
      // Boîte repliée ou en-tête du cadre : glisser déplace tout le groupe ; une prise ou une ligne mène au nœud du groupe concerné.
      const g = this.g;
      const members = g.nodes.filter((x) => x.group === gid);
      const portEl = node ? t0.closest<HTMLElement>(".gn-port") : null;
      const row = node ? t0.closest<HTMLElement>(".gn-row") : null;
      const at = (el: HTMLElement) => (this.bal ? proxyMember(g, this.bal, gid, el.dataset.item!, el.dataset.dir === "in" ? "in" : "out") : null);
      if (portEl && !this.far) {
        const ref = at(portEl);
        if (ref) this.press = { ...base, kind: "port", node: ref.node, grp: gid, port: ref };
        return;
      }
      const rowRef = row ? at(row) : null;
      this.press = { ...base, kind: "node", grp: gid, group: members.map((x) => ({ id: x.id, x0: x.x, y0: x.y })), ...(rowRef ? { row: rowRef } : {}) };
      return;
    }
    if (node) {
      const n = this.g.nodes.find((x) => x.id === node.dataset.id)!;
      const portEl = t0.closest<HTMLElement>(".gn-port");
      if (portEl && !this.far) {
        this.press = { ...base, kind: "port", node: n.id, port: { node: n.id, item: portEl.dataset.item!, side: portEl.dataset.dir === "in" ? "in" : "out" } };
        return;
      }
      const row = t0.closest<HTMLElement>(".gn-row");
      const group = this.sels.has(n.id) && this.sels.size > 1 ? this.g.nodes.filter((x) => this.sels.has(x.id)) : [n];
      this.press = {
        ...base,
        kind: "node",
        node: n.id,
        group: group.map((x) => ({ id: x.id, x0: x.x, y0: x.y })),
        ...(row ? { row: { node: n.id, item: row.dataset.item!, side: row.dataset.dir === "in" ? "in" : "out" } } : {}),
      };
    } else if (t0.closest(".gv-world, #flow-canvas") || t0 === this.frame) {
      this.press = { ...base, kind: "bg" };
    }
  }

  private onMove(e: PointerEvent): void {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    if (!p.moved) {
      if (Math.hypot(dx, dy) <= DRAG_SLOP) return;
      p.moved = true;
      if (p.kind === "bg") return;
      try {
        this.frame.setPointerCapture(e.pointerId);
      } catch {
        // Pointeur déjà relâché : le geste continue sans capture.
      }
      document.body.classList.add("panning");
      if (p.kind === "node") {
        // Échelle lue une fois : pendant le glisser, aucune lecture de mise en page.
        p.k = this.scale();
        for (const m of p.group!) this.nodeEls.get(m.id)?.classList.add("dragging");
        if (p.grp) this.groupEls.get(p.grp)?.classList.add("dragging");
      } else if (p.kind === "port") this.startLink(p);
    }
    if (p.kind === "port" && p.link) return this.dragLink(p, e);
    if (p.kind !== "node") return;
    const k = p.k!;
    this.pending = { x: dx / k, y: dy / k };
    // Un seul dessin par image : le glisser reste fluide même avec des centaines de nœuds.
    this.frameReq ||= requestAnimationFrame(() => {
      this.frameReq = 0;
      if (this.pending && this.press?.group) this.moveGroup(this.press.group, this.pending);
    });
  }

  private onUp(e: PointerEvent, cancel = false): void {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    this.press = null;
    if (this.frame.hasPointerCapture(e.pointerId)) this.frame.releasePointerCapture(e.pointerId);
    document.body.classList.remove("panning");
    if (p.kind === "node" && p.moved) {
      if (this.frameReq) cancelAnimationFrame(this.frameReq);
      this.frameReq = 0;
      if (this.pending) this.moveGroup(p.group!, this.pending);
      this.pending = null;
      for (const m of p.group!) this.nodeEls.get(m.id)?.classList.remove("dragging");
      if (p.grp) this.groupEls.get(p.grp)?.classList.remove("dragging");
      // Le document reçoit les positions finales en une commande : un pas d'annulation.
      const at = new Map(this.g!.nodes.map((n) => [n.id, n]));
      const moves = p.group!.map((m) => ({ id: m.id, x: at.get(m.id)!.x, y: at.get(m.id)!.y })).filter((m) => {
        const m0 = p.group!.find((x) => x.id === m.id)!;
        return m.x !== m0.x0 || m.y !== m0.y0;
      });
      if (moves.length) this.exec({ type: "move", moves }, true);
      return;
    }
    if (p.kind === "port" && p.moved) return this.endLink(p, cancel);
    if (cancel || p.moved) return;
    this.onTap(p, e);
  }

  /** Un clic (moins de 4 px) : son mode se lit sur le clic lui-même (Alt, Maj, Ctrl), puis la touche tenue, puis l'outil. */
  private onTap(p: Press, e: PointerEvent): void {
    const g = this.g!;
    const m = clickMode(e, this.held, this.tool);
    if (p.kind === "bg") {
      const hit = (e.target as Element).closest?.<SVGGElement>(".ge");
      const edge = hit ? (g.edges.find((x) => x.id === hit.dataset.edge) ?? null) : null;
      if (edge && m === "del") {
        this.exec(deleteCommand(g, [], [edge.id]));
        this.opts.onEdge?.(null);
        return;
      }
      this.disarm();
      if (this.sels.size || this.gsel) {
        this.gsel = null;
        this.select(null);
        this.opts.onSelect(null);
      }
      this.edgeSel = edge && this.edgeSel !== edge.id ? edge.id : null;
      this.applySel();
      this.opts.onEdge?.(edge);
      return;
    }
    if (p.grp) return this.tapGroup(p, m);
    const id = p.node!;
    const item = p.port?.side === "out" ? p.port.item : p.row?.side === "out" ? p.row.item : undefined;
    if (m === "del") {
      this.exec(deleteCommand(g, [id]));
      if (!this.sels.size) this.opts.onSelect(null);
      return;
    }
    if (m === "target") {
      this.exec(targetCommand(g, id, item));
      return;
    }
    if (m === "multi") {
      this.multiPick = true;
      this.gsel = null;
      if (this.sels.has(id)) this.sels.delete(id);
      else this.sels.add(id);
      this.sel = this.sels.size === 1 ? [...this.sels][0]! : this.sels.has(id) ? id : null;
      this.edgeSel = null;
      this.applySel();
      this.opts.onSelect(this.selected);
      return;
    }
    // Prise touchée (ou, avec l'outil Relier, n'importe où sur sa ligne) : relier en deux appuis.
    const port = p.port ?? (m === "link" ? p.row : undefined);
    if (port) return this.tapPort(port);
    if (p.row) return this.openPicker(p.row);
    this.pick(id);
  }

  /** Clic sur un groupe : mêmes modes que sur un nœud, appliqués à ses nœuds ; une prise ou une ligne mandataire agit sur le nœud concerné. */
  private tapGroup(p: Press, m: Mode | null): void {
    const g = this.g!;
    const gid = p.grp!;
    const ids = g.nodes.filter((x) => x.group === gid).map((x) => x.id);
    if (m === "del") {
      this.exec(deleteCommand(g, ids));
      this.opts.onSelect(null);
      return;
    }
    if (m === "multi") {
      this.multiPick = true;
      const all = ids.every((id) => this.sels.has(id));
      for (const id of ids) all ? this.sels.delete(id) : this.sels.add(id);
      this.sel = this.sels.size === 1 ? [...this.sels][0]! : null;
      this.gsel = null;
      this.edgeSel = null;
      this.applySel();
      this.opts.onSelect(this.selected);
      return;
    }
    const out = p.port?.side === "out" ? p.port : p.row?.side === "out" ? p.row : undefined;
    if (m === "target") {
      if (out) this.exec(targetCommand(g, out.node, out.item));
      return;
    }
    const port = p.port ?? (m === "link" ? p.row : undefined);
    if (port) return this.tapPort(port);
    if (p.row) return this.openPicker(p.row);
    this.pickGroup(gid);
  }

  /** Clic sur un nœud : sélectionné, ou désélectionné au second clic. */
  private pick(id: NodeId): void {
    const next = this.sel === id && this.sels.size === 1 ? null : id;
    this.edgeSel = null;
    this.gsel = null;
    this.multiPick = false;
    this.select(next, false);
    this.opts.onSelect(next);
  }

  // ------------------------------------------------------------ relier

  private disarm(): void {
    if (!this.armed) return;
    this.portEl(this.armed)?.classList.remove("arm");
    this.armed = null;
    this.syncHint();
  }

  /** Au doigt : un appui choisit une prise, un appui sur une prise de l'autre côté relie. */
  private tapPort(ref: PortRef): void {
    const a = this.armed;
    if (a && a.node === ref.node && a.item === ref.item && a.side === ref.side) return this.disarm();
    if (!a || a.side === ref.side) {
      this.disarm();
      this.armed = ref;
      this.portEl(ref)?.classList.add("arm");
      this.syncHint();
      return;
    }
    const r = linkCommand(this.g!, a, ref);
    if ("refused" in r) return this.refuse(ref);
    this.armed = null;
    this.exec(r.cmd);
    this.syncHint();
  }

  /** Liaison refusée (autre produit, même nœud, déjà là) : la prise secoue en rouge. */
  private refuse(ref: PortRef): void {
    const el = this.portEl(ref);
    if (!el) return;
    el.classList.remove("no");
    void el.offsetWidth; // relance l'animation si la prise secouait déjà
    el.classList.add("no");
    setTimeout(() => el.classList.remove("no"), 450);
  }

  private startLink(p: Press): void {
    const g = this.g!;
    const from = p.port!;
    const r = this.frame.getBoundingClientRect();
    const v = this.pz.view();
    const k = r.width / Math.max(1, v.w);
    const a = this.portAt(from.node, from.side === "out" ? "outs" : "ins", from.item);
    if (!a) return;
    // Prises de l'autre côté, en coordonnées du monde, relevées une fois.
    const cands: Cand[] = [];
    const other = from.side === "out" ? "ins" : "outs";
    const side = from.side === "out" ? "in" : "out";
    for (const n of g.nodes) {
      if (this.owners.has(n.id)) continue;
      for (const [item, o] of this.geom.get(n.id)?.[other] ?? []) cands.push({ x: n.x + o.x, y: n.y + o.y, ref: { node: n.id, item, side } });
    }
    // Groupe replié : chaque prise mandataire mène au nœud du groupe concerné (pas à un nœud du groupe d'où l'on part).
    for (const grp of liveGroups(g)) {
      if (!grp.collapsed || this.owners.get(from.node) === grp.id || !this.bal) continue;
      const at = this.groupPos(grp.id);
      for (const [item, o] of this.geom.get(`@${grp.id}`)?.[other] ?? []) {
        const ref = proxyMember(g, this.bal, grp.id, item, side);
        if (ref) cands.push({ x: at.x + o.x, y: at.y + o.y, ref });
      }
    }
    this.disarm();
    this.portEl(from)?.classList.add("arm");
    p.link = { r, v, k, a, cands, over: null };
    this.frame.classList.add("linking");
  }

  private dragLink(p: Press, e: PointerEvent): void {
    const L = p.link!;
    const at = { x: L.v.x + (e.clientX - L.r.left) / L.k, y: L.v.y + (e.clientY - L.r.top) / L.k };
    const over = snapPort(L.cands, at, SNAP_PX / L.k);
    if (over !== L.over) {
      if (L.over) this.portEl(L.over.ref)?.classList.remove("ok", "bad");
      if (over) this.portEl(over.ref)?.classList.add("cmd" in linkCommand(this.g!, p.port!, over.ref) ? "ok" : "bad");
      L.over = over;
    }
    const b = over ?? at;
    const [s, d] = p.port!.side === "out" ? [L.a, b] : [b, L.a];
    this.tmp.setAttribute("d", edgePath(s, d, Math.max(s.y, d.y) + 40).d);
  }

  private endLink(p: Press, cancel: boolean): void {
    const L = p.link;
    this.frame.classList.remove("linking");
    this.tmp.removeAttribute("d");
    this.portEl(p.port!)?.classList.remove("arm");
    if (!L) return;
    if (L.over) this.portEl(L.over.ref)?.classList.remove("ok", "bad");
    if (cancel || !L.over) return;
    const r = linkCommand(this.g!, p.port!, L.over.ref);
    if ("refused" in r) this.refuse(L.over.ref);
    else this.exec(r.cmd);
  }

  /** Déplace des nœuds pendant le glisser : leurs boîtes et leurs seules liaisons, sans tout redessiner. */
  private moveGroup(group: { id: NodeId; x0: number; y0: number }[], d: Pt): void {
    const g = this.g!;
    const at = new Map(group.map((m) => [m.id, m]));
    // Copie locale (le document lui-même change au lâcher, par une commande).
    const nodes = g.nodes.map((n) => {
      const m = at.get(n.id);
      return m ? { ...n, x: Math.round(m.x0 + d.x), y: Math.round(m.y0 + d.y) } : n;
    });
    this.g = { ...g, nodes };
    const groups = new Set<string>();
    for (const n of nodes) {
      if (!at.has(n.id)) continue;
      if (n.group) groups.add(n.group);
      // Position par transformation : le navigateur ne refait pas la mise en page des autres nœuds.
      const el = this.nodeEls.get(n.id);
      if (el) el.style.transform = `translate(${n.x}px,${n.y}px)`;
    }
    for (const gid of groups) {
      const box = this.groupEls.get(gid);
      if (box) {
        const p = this.groupPos(gid);
        box.style.transform = `translate(${p.x}px,${p.y}px)`;
      }
      this.placeFrame(gid);
    }
    for (const e of g.edges) if (at.has(e.from) || at.has(e.to)) this.placeEdge(e);
    if ((this.sel && at.has(this.sel)) || (this.gsel && groups.has(this.gsel))) this.placeBubble();
  }

  private scale(): number {
    const r = this.frame.getBoundingClientRect();
    return r.width / Math.max(1, this.pz.view().w);
  }
}

/**
 * Disposition de « Ranger » (pur) : `layoutFlow` donne la colonne (profondeur depuis l'objectif) et
 * l'ordre dans la colonne (peu de croisements) ; les nœuds sont ensuite empilés avec leur vraie
 * hauteur, colonnes centrées. Rend les déplacements à appliquer.
 */
export function arrangeGraph(g: Graph, data: GameData, world: GraphWorld, heights: Map<NodeId, number>, bal: GraphBalance | null = null): { id: NodeId; x: number; y: number }[] {
  if (!g.nodes.length) return [];
  const ids = new Set(g.nodes.map((n) => n.id));
  const edges = g.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  // Profondeur = plus long chemin vers l'objectif (0), boucles ouvertes d'abord : un parcours en
  // profondeur, de l'objectif vers l'amont, écarte la liaison qui referme chaque boucle.
  const sinks = g.nodes.filter((n) => !edges.some((e) => e.from === n.id)).map((n) => n.id);
  const roots = [...new Set([...(g.target ? [g.target.node] : []), ...sinks, ...g.nodes.map((n) => n.id)])];
  const back = new Set<GraphEdge>();
  const state = new Map<NodeId, 1 | 2>(); // 1 : en cours, 2 : fini
  const feeders = new Map<NodeId, GraphEdge[]>();
  for (const e of edges) feeders.set(e.to, [...(feeders.get(e.to) ?? []), e]);
  for (const r of roots) {
    if (state.has(r)) continue;
    const stack: { id: NodeId; i: number }[] = [{ id: r, i: 0 }];
    state.set(r, 1);
    while (stack.length) {
      const top = stack.at(-1)!;
      const list = feeders.get(top.id) ?? [];
      if (top.i >= list.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const e = list[top.i++]!;
      const st = state.get(e.from);
      if (st === 1) back.add(e);
      else if (!st) {
        state.set(e.from, 1);
        stack.push({ id: e.from, i: 0 });
      }
    }
  }
  const dag = edges.filter((e) => !back.has(e));
  const depth = new Map(g.nodes.map((n) => [n.id, 0]));
  for (let k = 0; k < g.nodes.length; k++) {
    let changed = false;
    for (const e of dag) {
      const d = depth.get(e.to)! + 1;
      if (d > depth.get(e.from)!) {
        depth.set(e.from, d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const steps = g.nodes.map((n) => ({ key: n.id, depth: depth.get(n.id)!, isRaw: recipePorts(data, n.recipeId, world).ins.length === 0 }));
  const flowEdges = edges.map((e) => ({ from: e.from, to: e.to, item: e.item, perMin: bal?.edges.get(e.id) ?? 0 }));
  const finals = g.nodes.map((n) => n.id).filter((id) => depth.get(id) === 0);
  const L = layoutFlow({ steps, unresolved: [], edges: flowEdges, finals } as unknown as Parameters<typeof layoutFlow>[0]);
  const byCol = new Map<number, { id: string; y: number }[]>();
  for (const n of L.nodes) {
    if (!ids.has(n.id)) continue;
    const list = byCol.get(n.col) ?? [];
    list.push({ id: n.id, y: n.y });
    byCol.set(n.col, list);
  }
  const colH = new Map<number, number>();
  for (const [c, list] of byCol) {
    list.sort((a, b) => a.y - b.y);
    colH.set(c, list.reduce((s, x) => s + (heights.get(x.id) ?? 120), 0) + GAP_Y * (list.length - 1));
  }
  const H = Math.max(...colH.values());
  const moves: { id: NodeId; x: number; y: number }[] = [];
  for (const [c, list] of byCol) {
    let y = (H - colH.get(c)!) / 2;
    for (const x of list) {
      moves.push({ id: x.id, x: c * (NODE_W + GAP_X), y: Math.round(y) });
      y += (heights.get(x.id) ?? 120) + GAP_Y;
    }
  }
  return moves;
}
