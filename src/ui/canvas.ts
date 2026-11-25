// Déplacement et zoom d'un SVG dans un cadre, comme le canevas de recherche du jeu :
// glisser pour se déplacer, molette (ou boutons, ou touches + / − / 0) pour zoomer ; deux doigts : pincer.

export type Box = { x: number; y: number; w: number; h: number };

export type PanZoomOptions = {
  /** Largeur visible minimale, en unités SVG (zoom maximal). 200 par défaut. */
  minWidth?: number;
  /** Largeur visible maximale (zoom minimal) ; par défaut 1,6 × le contenu. */
  maxWidth?: () => number;
  /** La vue de départ montre tout le contenu (au lieu de la taille réelle calée à gauche). */
  fitOnReset?: boolean;
  /** Vue de départ calculée (cadre et contenu en pixels / unités SVG) ; prioritaire sur fitOnReset. */
  initialView?: (frame: { w: number; h: number }, content: { w: number; h: number }) => Box;
  /** Appelé à chaque changement de vue, avec l'échelle (pixels écran par unité SVG). */
  onView?: (pxPerUnit: number) => void;
  /** Éléments sur lesquels un appui n'entame pas le déplacement (les nœuds de l'éditeur de graphe, qui se glissent eux-mêmes). */
  noPan?: string;
  /** Deux doigts posés : le geste à un doigt en cours (nœud, liaison) est abandonné, le zoom prend la main. */
  onPinch?: () => void;
};

export type Pt = { x: number; y: number };
/** Pincement : facteur de zoom et déplacement (pixels) entre deux positions de deux doigts (fonction pure, testée). */
export function pinchStep(a0: Pt, b0: Pt, a1: Pt, b1: Pt): { factor: number; from: Pt; dx: number; dy: number } {
  const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
  const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
  const from = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  return { factor: d0 > 0 && d1 > 0 ? d1 / d0 : 1, from, dx: (a1.x + b1.x) / 2 - from.x, dy: (a1.y + b1.y) / 2 - from.y };
}

export class PanZoom {
  private readonly frame: HTMLElement;
  private readonly opts: PanZoomOptions;
  /** En pause, le cadre laisse la molette, le glisser et les touches à un autre gestionnaire. */
  paused = false;
  private svg: SVGSVGElement | null = null;
  /** Monde HTML (éditeur de graphe) : déplacé et zoomé par une transformation CSS au lieu d'un viewBox. */
  private world: HTMLElement | null = null;
  private content = { x: 0, y: 0, w: 1, h: 1 };
  /** Point à montrer au départ (ex. la racine de l'arbre), calé à gauche et centré en hauteur. */
  private home: { x: number; y: number } | null = null;
  private vb: Box = { x: 0, y: 0, w: 1, h: 1 };
  private drag: { id: number; x: number; y: number; vb: Box; moved: boolean } | null = null;
  /** Vrai juste après un glisser : le clic qui suit ne doit pas sélectionner un nœud. */
  suppressClick = false;
  private measuredWidth = 0;
  /** Doigts posés sur le cadre. */
  private readonly touches = new Map<number, Pt>();
  private pinching = false;

  constructor(frame: HTMLElement, opts: PanZoomOptions = {}) {
    this.frame = frame;
    this.opts = opts;
    frame.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    // En capture, avant les gestes propres au cadre : un second doigt fait un pincement, même posé sur un nœud.
    frame.addEventListener("pointerdown", (e) => this.touchDown(e), true);
    frame.addEventListener("pointermove", (e) => this.touchMove(e), true);
    frame.addEventListener("pointerup", (e) => this.touchUp(e), true);
    frame.addEventListener("pointercancel", (e) => this.touchUp(e), true);
    frame.addEventListener("pointerdown", (e) => this.onDown(e));
    frame.addEventListener("pointermove", (e) => this.onMove(e));
    frame.addEventListener("pointerup", (e) => this.onUp(e));
    frame.addEventListener("pointercancel", (e) => this.onUp(e));
    frame.addEventListener("keydown", (e) => this.onKey(e));
    new ResizeObserver(() => {
      // Cadre caché (onglet inactif) puis affiché : la vue de départ est recalculée à la bonne taille.
      const w = frame.getBoundingClientRect().width;
      // Idem si la vue de départ a été calculée dans un cadre presque sans largeur (page en arrière-plan).
      if (w > 0 && this.measuredWidth < 50) this.reset();
      else this.apply();
      this.measuredWidth = w;
    }).observe(frame);
  }

  /** Branche un nouveau SVG ; `keepView` conserve la position actuelle (re-rendu après un clic). */
  attach(svg: SVGSVGElement, width: number, height: number, keepView: boolean, home?: { x: number; y: number }): void {
    this.svg = svg;
    this.world = null;
    this.home = home ?? null;
    const changed = this.content.w !== width || this.content.h !== height;
    this.content = { x: 0, y: 0, w: width, h: height };
    if (!keepView || changed) this.reset();
    else this.apply();
  }

  /**
   * Branche un monde HTML (nœuds HTML, arêtes SVG) : 1 unité = 1 pixel au zoom 100 %. `box` est le
   * rectangle occupé par le contenu (il peut commencer ailleurs qu'en 0, 0). `keepView` garde la vue.
   */
  attachWorld(world: HTMLElement, box: Box, keepView: boolean): void {
    this.world = world;
    this.svg = null;
    this.home = null;
    this.content = { ...box };
    if (!keepView) this.reset();
    else this.apply();
  }

  /** Contenu agrandi ou déplacé (un nœud glissé hors du cadre) : la vue ne bouge pas. */
  setContent(box: Box): void {
    this.content = { ...box };
  }

  /** Vue courante (en unités du contenu). */
  view(): Box {
    return { ...this.vb };
  }

  /** Point de l'écran → coordonnées du contenu. */
  toContent(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.frame.getBoundingClientRect();
    const s = this.scale();
    return { x: this.vb.x + (clientX - r.left) * s, y: this.vb.y + (clientY - r.top) * s };
  }

  private scale(): number {
    // unités SVG par pixel écran
    const r = this.frame.getBoundingClientRect();
    return Math.max(this.vb.w / Math.max(1, r.width), this.vb.h / Math.max(1, r.height));
  }

  /** Unités SVG par pixel écran (pour convertir un glisser). */
  unitsPerPixel(): number {
    return this.scale();
  }

  /** Vue de départ : taille réelle, calée à gauche sur la racine, comme en jeu (ou tout le contenu). */
  reset(): void {
    const r = this.frame.getBoundingClientRect();
    this.measuredWidth = r.width;
    const w = r.width > 0 ? r.width : 800;
    const h = r.height > 0 ? r.height : 500;
    if (this.opts.initialView) {
      const v = this.opts.initialView({ w, h }, { w: this.content.w, h: this.content.h });
      this.vb = { ...v, x: v.x + this.content.x, y: v.y + this.content.y };
      return this.apply();
    }
    if (this.opts.fitOnReset) return this.fit();
    this.vb = { x: 0, y: this.home ? Math.max(0, Math.min(this.home.y - h / 2, this.content.h - h)) : 0, w, h };
    this.apply();
  }

  /** Tout voir. */
  fit(): void {
    this.fitBox({ ...this.content });
  }

  /** Cadre la vue sur un rectangle (en unités SVG), centré. */
  fitBox(b: Box): void {
    const r = this.frame.getBoundingClientRect();
    const ratio = Math.max(1, r.width) / Math.max(1, r.height);
    let w = b.w;
    let h = w / ratio;
    if (h < b.h) {
      h = b.h;
      w = h * ratio;
    }
    this.vb = { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
    this.apply();
  }

  zoom(factor: number, clientX?: number, clientY?: number): void {
    const r = this.frame.getBoundingClientRect();
    const cx = clientX ?? r.left + r.width / 2;
    const cy = clientY ?? r.top + r.height / 2;
    const s = this.scale();
    const px = this.vb.x + (cx - r.left) * s;
    const py = this.vb.y + (cy - r.top) * s;
    const minW = this.opts.minWidth ?? 200;
    const maxW = this.opts.maxWidth?.() ?? Math.max(this.content.w, this.content.h * (r.width / Math.max(1, r.height))) * 1.6;
    const w = Math.min(maxW, Math.max(minW, this.vb.w / factor));
    const k = w / this.vb.w;
    this.vb = { x: px - (px - this.vb.x) * k, y: py - (py - this.vb.y) * k, w, h: this.vb.h * k };
    this.apply();
  }

  /** Amène un rectangle (en unités SVG) dans la vue si besoin. */
  reveal(x: number, y: number, w: number, h: number): void {
    const m = 30;
    let { x: vx, y: vy } = this.vb;
    if (x - m < vx) vx = x - m;
    else if (x + w + m > vx + this.vb.w) vx = x + w + m - this.vb.w;
    if (y - m < vy) vy = y - m;
    else if (y + h + m > vy + this.vb.h) vy = y + h + m - this.vb.h;
    if (vx !== this.vb.x || vy !== this.vb.y) {
      this.vb = { ...this.vb, x: vx, y: vy };
      this.apply();
    }
  }

  private apply(): void {
    if (!this.svg && !this.world) return;
    const r = this.frame.getBoundingClientRect();
    // Garde le rapport du cadre pour que 1 unité = 1 pixel au zoom 100 %.
    if (r.width && r.height) this.vb.h = this.vb.w * (r.height / r.width);
    if (this.svg) this.svg.setAttribute("viewBox", `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
    else if (r.width) {
      const k = r.width / this.vb.w;
      this.world!.style.transform = `translate(${-this.vb.x * k}px, ${-this.vb.y * k}px) scale(${k})`;
    }
    this.frame.dataset.zoom = String(Math.round((r.width / this.vb.w) * 100));
    if (r.width) this.opts.onView?.(r.width / this.vb.w);
  }

  private onWheel(e: WheelEvent): void {
    if (this.paused) return;
    e.preventDefault();
    this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  }

  private touchDown(e: PointerEvent): void {
    if (e.pointerType !== "touch" || this.paused) return;
    if (e.isPrimary) this.touches.clear(); // nouveau geste : un doigt perdu (levé hors de la page) ne reste pas compté
    if ((e.target as Element).closest?.("button, input, select, a")) return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size < 2) return;
    e.stopImmediatePropagation();
    if (!this.pinching) {
      this.pinching = true;
      this.drag = null;
      this.frame.classList.remove("dragging");
      document.body.classList.remove("panning");
      this.opts.onPinch?.();
    }
    // Le cadre reçoit la suite du geste, même si l'élément touché est redessiné entre-temps.
    for (const id of this.touches.keys()) {
      try {
        this.frame.setPointerCapture(id);
      } catch {
        // doigt déjà levé
      }
    }
  }

  private touchMove(e: PointerEvent): void {
    const old = this.touches.get(e.pointerId);
    if (!old) return;
    const now = { x: e.clientX, y: e.clientY };
    this.touches.set(e.pointerId, now);
    if (!this.pinching) return;
    e.stopImmediatePropagation();
    const ids = [...this.touches.keys()].slice(0, 2);
    if (this.touches.size < 2 || !ids.includes(e.pointerId)) return;
    const other = this.touches.get(ids.find((i) => i !== e.pointerId)!)!;
    const s = pinchStep(old, other, now, other);
    this.zoom(s.factor, s.from.x, s.from.y);
    const u = this.scale();
    this.vb = { ...this.vb, x: this.vb.x - s.dx * u, y: this.vb.y - s.dy * u };
    this.apply();
  }

  private touchUp(e: PointerEvent): void {
    if (!this.touches.delete(e.pointerId) || !this.pinching) return;
    e.stopImmediatePropagation();
    if (this.touches.size) return; // le doigt qui reste ne déplace rien : pas de saut
    this.pinching = false;
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false), 0);
  }

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || this.paused) return;
    // Un bouton du cadre (zoom, ⤢) n'entame pas un glisser : son clic agit sur le dessin, rien d'autre.
    if ((e.target as Element).closest?.("button, input, select, a")) return;
    if (this.opts.noPan && (e.target as Element).closest?.(this.opts.noPan)) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, vb: { ...this.vb }, moved: false };
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      this.frame.setPointerCapture(e.pointerId);
      this.frame.classList.add("dragging");
      // Pas de texte sélectionné pendant le glisser, même si le pointeur sort du cadre.
      document.body.classList.add("panning");
      window.getSelection()?.removeAllRanges();
    }
    const s = this.scale();
    this.vb = { ...this.vb, x: d.vb.x - dx * s, y: d.vb.y - dy * s };
    this.apply();
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    this.frame.classList.remove("dragging");
    document.body.classList.remove("panning");
    if (d.moved) {
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false), 0);
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target !== this.frame || this.paused) return; // les nœuds gèrent leurs propres touches
    const step = 60 * this.scale();
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === "+" || e.key === "=") this.zoom(1.2);
    else if (e.key === "-") this.zoom(1 / 1.2);
    else if (e.key === "0") this.reset();
    else if (moves[e.key]) {
      this.vb = { ...this.vb, x: this.vb.x + moves[e.key]![0], y: this.vb.y + moves[e.key]![1] };
      this.apply();
    } else return;
    e.preventDefault();
  }
}
