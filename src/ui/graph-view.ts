// Canevas de l'éditeur de graphe (PLAN-GRAPHE.md, lot G2) : nœuds en HTML, arêtes SVG orthogonales de
// prise à prise, le tout dans un « monde » déplacé et zoomé par canvas.ts. Gestes de G2 : se déplacer,
// zoomer, sélectionner un nœud, le glisser (au-delà de 4 px : un clic reste un clic), « Ranger »
// (flow-layout.ts) ; sous 28 % de zoom, vue allégée où les liaisons partent du bord du nœud.
// L'édition (ajouter, relier, supprimer, bulle) viendra au lot G3.

import type { GameData } from "../engine/data.ts";
import { applyCommand, balanceGraph, mainOutput, recipePorts, type Graph, type GraphBalance, type GraphEdge, type GraphWorld, type NodeId } from "../engine/graph/index.ts";
import { PanZoom, type Box } from "./canvas.ts";
import { layoutFlow } from "./flow-layout.ts";

/** Un mouvement de moins de 4 px reste un clic (exigence du § 6). */
export const DRAG_SLOP = 4;
/** Sous ce zoom, la vue allégée : machine, nombre et produit ; liaisons au bord du nœud (§ 6, 28 %). */
export const FAR_ZOOM = 0.28;
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
  /** Sélection d'un nœud (null : plus rien). */
  onSelect: (id: NodeId | null) => void;
  /** Clic sur une liaison (null : clic dans le vide). */
  onEdge?: (edge: GraphEdge | null) => void;
  /** Le document a changé par un geste du canevas (glisser, « Ranger »). */
  onChange?: (g: Graph) => void;
  /** Largeur réservée à droite (colonne des boutons de zoom), que la vue de départ évite. */
  reserveRight?: number;
};

type Pt = { x: number; y: number };
type NodeGeom = { w: number; h: number; ins: Map<string, Pt>; outs: Map<string, Pt> };
type EdgeEls = { g: SVGGElement; hit: SVGPathElement; line: SVGPathElement; lab: SVGGElement; rect: SVGRectElement; text: SVGTextElement };

const SVG = "http://www.w3.org/2000/svg";

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

export class GraphView {
  readonly frame: HTMLElement;
  private readonly opts: GraphViewOptions;
  private readonly pz: PanZoom;
  private readonly worldEl: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly nodesEl: HTMLDivElement;
  private g: Graph | null = null;
  private bal: GraphBalance | null = null;
  private nodeEls = new Map<NodeId, HTMLElement>();
  private geom = new Map<NodeId, NodeGeom>();
  private edgeEls = new Map<string, EdgeEls>();
  private sel: NodeId | null = null;
  private far = false;
  private press: { kind: "node" | "bg"; id: number; sx: number; sy: number; node?: NodeId; x0?: number; y0?: number; k?: number; moved: boolean } | null = null;
  private frameReq = 0;
  private pending: Pt | null = null;

  constructor(frame: HTMLElement, opts: GraphViewOptions) {
    this.frame = frame;
    this.opts = opts;
    frame.classList.add("gv");
    this.worldEl = document.createElement("div");
    this.worldEl.className = "gv-world";
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.classList.add("gv-edges");
    this.svg.setAttribute("aria-hidden", "true");
    this.nodesEl = document.createElement("div");
    this.nodesEl.className = "gv-nodes";
    this.worldEl.append(this.svg, this.nodesEl);
    const reserve = opts.reserveRight ?? 0;
    this.pz = new PanZoom(frame, {
      noPan: ".gn",
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
      if (n && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        this.pick(n.dataset.id!);
      }
    });
  }

  get graph(): Graph | null {
    return this.g;
  }

  get selected(): NodeId | null {
    return this.sel;
  }

  /** Monte le canevas dans `host` (vidé) et dessine le graphe ; `keepView` garde la vue actuelle. */
  show(host: HTMLElement, g: Graph, keepView: boolean): void {
    if (this.worldEl.parentElement !== host) {
      host.replaceChildren(this.worldEl);
    }
    this.g = g;
    this.render();
    this.pz.attachWorld(this.worldEl, this.contentBox(), keepView);
  }

  /** Remplace le document (sans toucher à la vue). */
  update(g: Graph): void {
    this.g = g;
    this.render();
    this.pz.setContent(this.contentBox());
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
    this.sel = id;
    for (const [nid, el] of this.nodeEls) el.classList.toggle("sel", nid === id);
    for (const [eid, els] of this.edgeEls) {
      const e = this.g!.edges.find((x) => x.id === eid);
      els.g.classList.toggle("hl", !!id && !!e && (e.from === id || e.to === id));
    }
    this.frame.classList.toggle("has-sel", !!id);
    if (id && reveal) {
      const n = this.g!.nodes.find((x) => x.id === id)!;
      const gm = this.geom.get(id);
      this.pz.reveal(n.x - 10, n.y - 10, (gm?.w ?? NODE_W) + 60, Math.min(gm?.h ?? 120, 400) + 20);
    }
  }

  /** « Ranger » : colonnes de l'extraction à l'objectif (flow-layout.ts), sans chevauchement. */
  arrange(fit = true): void {
    if (!this.g || !this.g.nodes.length) return;
    const g = this.g;
    // Hauteurs réelles des nœuds complets (même si la vue est allégée en ce moment).
    const wasFar = this.far;
    if (wasFar) this.frame.classList.remove("far");
    const heights = new Map(g.nodes.map((n) => [n.id, this.nodeEls.get(n.id)?.offsetHeight ?? 120]));
    if (wasFar) this.frame.classList.add("far");
    const moves = arrangeGraph(g, this.opts.data, this.opts.world(), heights, this.bal);
    const next = applyCommand(g, { type: "move", moves }, this.opts.data, this.opts.world());
    this.update(next);
    this.opts.onChange?.(next);
    if (fit) this.fit();
    else this.home();
    if (this.sel) this.select(this.sel, false);
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
    for (const n of g.nodes) {
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
          return `<div class="gn-row${cls}" title="${esc(tip)}"><i class="gn-port" data-dir="in" data-item="${esc(pb.item)}"></i><span class="q">${esc(T.rate(pb.perMin))}</span><span class="it">${esc(T.item(pb.item))}</span></div>`;
        })
        .join("");
      const outs = nb.outs
        .map((pb) => `<div class="gn-row" title="${esc(T.item(pb.item))}"><i class="gn-port" data-dir="out" data-item="${esc(pb.item)}"></i><span class="q">${esc(T.rate(pb.perMin))}</span><span class="it">${esc(T.item(pb.item))}</span></div>`)
        .join("");
      const target = g.target?.node === n.id;
      const lock = n.fixed ? `<span class="gn-lock" title="${esc(T.fixed)}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>` : "";
      html.push(
        `<div class="gn${target ? " target" : ""}${n.fixed ? " fixed" : ""}${n.id === this.sel ? " sel" : ""}" data-id="${esc(n.id)}" data-target="${esc(T.target)}" style="transform:translate(${n.x}px,${n.y}px)" tabindex="0" role="button" aria-label="${esc(T.nodeAria(product, count, machine))}">` +
          `<div class="gn-hd"><b>${esc(product)}</b>${this.opts.badge?.(n.id) ?? ""}${lock}<span class="gn-n"><small>×</small>${count}</span></div>` +
          `<div class="gn-m"><span>${esc(machine)}</span>${facts}</div>` +
          `<div class="gn-io"><div class="gn-col i">${ins}</div><div class="gn-col o">${outs}</div></div></div>`,
      );
    }
    this.nodesEl.innerHTML = html.join("");
    this.nodeEls = new Map([...this.nodesEl.children].map((el) => [(el as HTMLElement).dataset.id!, el as HTMLElement]));
    this.measure();
    this.drawEdges();
    this.select(this.sel, false);
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
  }

  private placeEdge(e: GraphEdge): void {
    const els = this.edgeEls.get(e.id);
    const a = this.portAt(e.from, "outs", e.item);
    const b = this.portAt(e.to, "ins", e.item);
    if (!els) return;
    if (!a || !b) {
      els.g.style.display = "none";
      return;
    }
    const na = this.g!.nodes.find((n) => n.id === e.from)!;
    const nbn = this.g!.nodes.find((n) => n.id === e.to)!;
    const below = Math.max(na.y + (this.geom.get(na.id)?.h ?? 0), nbn.y + (this.geom.get(nbn.id)?.h ?? 0)) + 24;
    const p = edgePath(a, b, below);
    els.hit.setAttribute("d", p.d);
    els.line.setAttribute("d", p.d);
    const w = Number(els.rect.getAttribute("width"));
    els.lab.setAttribute("transform", `translate(${(p.lx - w / 2).toFixed(1)},${(p.ly - 8).toFixed(1)})`);
  }

  private portAt(id: NodeId, dir: "ins" | "outs", item: string): Pt | null {
    const n = this.g!.nodes.find((x) => x.id === id);
    const o = this.geom.get(id)?.[dir].get(item);
    return n && o ? { x: n.x + o.x, y: n.y + o.y } : null;
  }

  private onView(k: number): void {
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
        for (const e of this.g.edges) this.placeEdge(e);
      }
    }
  }

  // ------------------------------------------------------------ gestes

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || !this.g) return;
    const t = e.target as Element;
    if (t.closest("button, input, select, a, .rs-zoom")) return;
    const node = t.closest<HTMLElement>(".gn");
    if (node) {
      const n = this.g.nodes.find((x) => x.id === node.dataset.id)!;
      this.press = { kind: "node", id: e.pointerId, sx: e.clientX, sy: e.clientY, node: n.id, x0: n.x, y0: n.y, moved: false };
    } else if (t.closest(".gv-world, #flow-canvas") || t === this.frame) {
      this.press = { kind: "bg", id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
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
      if (p.kind === "node") {
        // Échelle lue une fois : pendant le glisser, aucune lecture de mise en page.
        p.k = this.scale();
        try {
          this.frame.setPointerCapture(e.pointerId);
        } catch {
          // Pointeur déjà relâché : le glisser continue sans capture.
        }
        this.nodeEls.get(p.node!)?.classList.add("dragging");
        document.body.classList.add("panning");
      }
    }
    if (p.kind !== "node") return;
    const k = p.k!;
    this.pending = { x: p.x0! + dx / k, y: p.y0! + dy / k };
    // Un seul dessin par image : le glisser reste fluide même avec des centaines de nœuds.
    this.frameReq ||= requestAnimationFrame(() => {
      this.frameReq = 0;
      if (this.pending && this.press?.node) this.moveNode(this.press.node, this.pending);
    });
  }

  private onUp(e: PointerEvent, cancel = false): void {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    this.press = null;
    if (p.kind === "node" && p.moved) {
      if (this.frameReq) cancelAnimationFrame(this.frameReq);
      this.frameReq = 0;
      if (this.pending) this.moveNode(p.node!, this.pending);
      this.pending = null;
      this.nodeEls.get(p.node!)?.classList.remove("dragging");
      document.body.classList.remove("panning");
      if (this.frame.hasPointerCapture(e.pointerId)) this.frame.releasePointerCapture(e.pointerId);
      const n = this.g!.nodes.find((x) => x.id === p.node)!;
      // Le document reçoit la position finale en une commande (un pas d'annulation, au lot G3).
      const next = applyCommand(this.g!, { type: "move", moves: [{ id: n.id, x: n.x, y: n.y }] }, this.opts.data, this.opts.world());
      this.g = next;
      this.pz.setContent(this.contentBox());
      this.opts.onChange?.(next);
      return;
    }
    if (cancel || p.moved) return;
    if (p.kind === "node") return this.pick(p.node!);
    // Clic dans le vide ou sur une liaison.
    const hit = (e.target as Element).closest?.<SVGGElement>(".ge");
    const edge = hit ? (this.g!.edges.find((x) => x.id === hit.dataset.edge) ?? null) : null;
    if (this.sel) {
      this.select(null);
      this.opts.onSelect(null);
    }
    this.opts.onEdge?.(edge);
    for (const [id, els] of this.edgeEls) els.g.classList.toggle("on", !!edge && id === edge.id);
  }

  /** Clic sur un nœud : sélectionné, ou désélectionné au second clic. */
  private pick(id: NodeId): void {
    const next = this.sel === id ? null : id;
    for (const els of this.edgeEls.values()) els.g.classList.remove("on");
    this.select(next, false);
    this.opts.onSelect(next);
  }

  /** Déplace un nœud pendant le glisser : sa boîte et ses seules liaisons, sans tout redessiner. */
  private moveNode(id: NodeId, to: Pt): void {
    const g = this.g!;
    const i = g.nodes.findIndex((n) => n.id === id);
    if (i < 0) return;
    // Copie locale (le document lui-même change au lâcher, par une commande).
    const nodes = g.nodes.slice();
    nodes[i] = { ...nodes[i]!, x: Math.round(to.x), y: Math.round(to.y) };
    this.g = { ...g, nodes };
    const el = this.nodeEls.get(id)!;
    // Position par transformation : le navigateur ne refait pas la mise en page des autres nœuds.
    el.style.transform = `translate(${nodes[i]!.x}px,${nodes[i]!.y}px)`;
    for (const e of g.edges) if (e.from === id || e.to === id) this.placeEdge(e);
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
