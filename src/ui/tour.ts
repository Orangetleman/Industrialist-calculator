// Visite d'orientation (S24, maquette `maquette/orientation.html` validée, Q25) : un voile assombrit la
// page, un projecteur éclaire l'élément décrit, une bulle explique. D'abord l'essentiel (première
// visite), puis une visite détaillée proposée, qui entre dans le schéma, l'usine complète, Mon usine,
// l'arbre et les recettes. Le bouton « ? » de l'en-tête la rejoue.
// Modèle : la visite guidée du site de philosophie de l'utilisateur (voile, projecteur, bulle,
// essentiel puis détail, clic dans le sombre seulement à la dernière étape).
// Retours du 2026-10-20 (S24 bis) : l'élément éclairé reste utilisable (on essaie ce que la bulle
// décrit), la page ne défile plus sous la visite, le projecteur part de la bulle pour guider l'œil,
// la bulle est fixe en bas ou suit le projecteur (choix gardé), et un calcul en cours s'affiche
// dans la bulle.
// S31 : les textes sont des clés du catalogue, lues dans la langue choisie.
// Remarque n° 14 (2026-11-12) : plus de démo ni de visite détaillée. Le joueur fait SON premier plan, guidé par
// l'action (une étape avance quand l'action est faite), textes ≤ 20 mots ; ensuite la liste « Premiers pas »
// (checklist.ts) propose des mini-parcours par page. Le moteur (volets, projecteur, bulle) est inchangé.

import { t, type Key } from "../i18n/i18n.ts";
import { icon, withIcons } from "./icons.ts";

/** Les textes d'une étape sont des clés du catalogue (S31), lues dans la langue choisie à chaque affichage. */
export type TourStep = {
  /** Étape du premier parcours (« Ton premier plan ») ; sinon `mini` dit à quel mini-parcours elle appartient. */
  core?: boolean;
  /** Mini-parcours de la liste « Premiers pas » (remarque n° 14) : son identifiant. */
  mini?: string;
  title: Key;
  /** HTML simple (<b>) écrit par le site, jamais par le joueur. */
  text: Key;
  /** L'action demandée au joueur (ligne « → … ») ; l'étape avance toute seule quand `until` est vrai. */
  act?: Key;
  /** Condition testée par la page (hooks.test) toutes les 250 ms : vraie, l'étape passe à la suivante. */
  until?: string;
  /** Ligne de plus sous le texte, seulement quand la page le confirme (hooks.test) : « progression simulée »… */
  note?: { when: string; text: Key };
  /** Bouton de plus, qui ouvre une adresse du site et termine le parcours (« Ouvrir Mon usine »). */
  alt?: { label: Key; hash: string };
  /** Carte centrée, sans projecteur (bienvenue, fin). */
  center?: boolean;
  /** Adresse à ouvrir avant d'éclairer la cible (« #objet/schema »…). */
  hash?: string;
  /** Sélecteur de l'élément à éclairer. */
  target?: string;
  /** L'élément éclairé reste utilisable (glisser, cliquer) : on essaie ce que la bulle décrit. */
  play?: boolean;
  /** Sélecteur d'une barre d'avancement : tant qu'elle existe, la bulle montre le calcul en cours. */
  wait?: string;
  next?: Key;
};

/** « first » : le premier parcours ; sinon l'identifiant d'un mini-parcours. */
export type BubbleMode = "fixe" | "suit";
export type TourMode = string;

/** Indices des étapes jouées selon le mode (fonction pure, testée). */
export function tourSeq(steps: readonly TourStep[], mode: TourMode): number[] {
  const all = steps.map((_, k) => k);
  if (mode === "first") return all.filter((k) => steps[k]!.core);
  return all.filter((k) => steps[k]!.mini === mode);
}

/** Les cases de la liste « Premiers pas » : les deux premières se cochent pendant le premier parcours, les autres par leur mini-parcours. */
export const CHECKLIST = ["premier-plan", "plan-pose", "poser", "regler", "partie", "arbre", "recettes"] as const;
export type CheckItem = (typeof CHECKLIST)[number];

/** Le premier parcours (remarque n° 14) : le joueur fait SON plan, une action par bulle, puis les mini-parcours de « Premiers pas ». */
export const SITE_TOUR: TourStep[] = [
  { core: true, center: true, hash: "#objet", title: "tour.welcome.title", text: "tour.welcome.html", next: "tour.welcome.next" },
  { core: true, hash: "#objet", target: "#query", play: true, title: "tour.item.title", text: "tour.item.html", act: "tour.item.act", until: "item" },
  { core: true, hash: "#objet", target: "#answer", play: true, title: "tour.answer.title", text: "tour.answer.html", note: { when: "simulated", text: "tour.answer.simulated" } },
  { core: true, hash: "#objet", target: ".prio-bar", play: true, title: "tour.prio.title", text: "tour.prio.html" },
  { core: true, hash: "#objet/pose", target: "#pose-frame", play: true, wait: "#usine-progress", title: "tour.pose.title", text: "tour.pose.html" },
  { core: true, hash: "#objet", target: ".cmd-left", play: true, title: "tour.left.title", text: "tour.left.html" },
  { core: true, hash: "#objet", target: "#rtabs-result", play: true, title: "tour.views.title", text: "tour.views.html", act: "tour.views.act", until: "schema" },
  { core: true, hash: "#objet", target: ".cmd-right", play: true, title: "tour.right.title", text: "tour.right.html" },
  { core: true, target: "#me", play: true, title: "tour.game.title", text: "tour.game.html", note: { when: "simulated", text: "tour.game.simulated" }, next: "tour.later", alt: { label: "tour.game.open", hash: "#usine" } },
  // Mini-parcours de « Premiers pas » : chacun sur sa page, le joueur y touche.
  { mini: "poser", hash: "#objet", target: ".cmd-left", play: true, title: "tour.poser1.title", text: "tour.poser1.html", note: { when: "simulated", text: "tour.mini.simulated" } },
  { mini: "poser", hash: "#objet/pose", target: "#pose-frame", play: true, wait: "#usine-progress", title: "tour.poser2.title", text: "tour.poser2.html" },
  { mini: "poser", hash: "#objet", target: "#plan-share", play: true, title: "tour.poser3.title", text: "tour.poser3.html" },
  { mini: "regler", hash: "#objet", target: "#plan-set-open", play: true, title: "tour.regler1.title", text: "tour.regler1.html", act: "tour.regler1.act", until: "drawer", note: { when: "simulated", text: "tour.mini.simulated" } },
  { mini: "regler", target: "#plan-drawer", play: true, title: "tour.regler2.title", text: "tour.regler2.html" },
  { mini: "partie", hash: "#usine", target: "#upto-form", play: true, title: "tour.partie.title", text: "tour.partie.html" },
  { mini: "partie", hash: "#usine/recherche", target: "#rs-box", play: true, title: "tour.research.title", text: "tour.research.html" },
  { mini: "arbre", hash: "#arbre", target: ".rs-workspace", play: true, title: "tour.arbre.title", text: "tour.arbre.html" },
  { mini: "recettes", hash: "#recettes", target: "#rc-layout", play: true, title: "tour.recettes.title", text: "tour.recettes.html" },
  { mini: "recettes", hash: "#objet", target: "#remark-btn", play: true, title: "tour.remark.title", text: "tour.remark.html" },
];

export type TourHooks = {
  /** Avant la première étape (une seule fois par parcours ouvert). */
  onStart(): void;
  /** À chaque parcours lancé, avec son mode : la page peut simuler une progression pour le premier. */
  onStartMode?(mode: TourMode): void;
  /** Ouvrir une adresse du site. */
  go(hash: string): void;
  /** À la fin (ou si on passe) : la liste « Premiers pas » apparaît. */
  onEnd(mode: TourMode): void;
  /** Condition d'une étape guidée par l'action (`until`). */
  test(cond: string): boolean;
  /** Une étape atteinte : la page coche la case correspondante de « Premiers pas ». */
  onReach?(mode: TourMode, index: number): void;
};

const KEY_BUBBLE = "ind-calc:v1:visite-bulle";
function readBubble(): BubbleMode {
  try {
    return localStorage.getItem(KEY_BUBBLE) === "suit" ? "suit" : "fixe";
  } catch {
    return "fixe";
  }
}

type Rect = { top: number; left: number; width: number; height: number };

/** La visite (une seule instance) : quatre volets sombres autour du projecteur, et la bulle. */
export function createTour(steps: readonly TourStep[], hooks: TourHooks) {
  const st = { i: -1, mode: "first" as TourMode, decision: false, timers: [] as number[], poll: 0, hole: null as Rect | null, bubble: readBubble() };
  let shades: HTMLDivElement[] = [];
  let pulsed = -1;
  let spot: HTMLDivElement;
  let bubble: HTMLDivElement;
  function build(): void {
    if (bubble) return;
    // Quatre volets (haut, bas, gauche, droite) : le trou du projecteur reste cliquable.
    shades = [0, 1, 2, 3].map(() => {
      const d = Object.assign(document.createElement("div"), { className: "tour-shade" });
      d.addEventListener("click", () => {
        const s = tourSeq(steps, st.mode);
        if (!st.decision && s.indexOf(st.i) === s.length - 1) next();
      });
      return d;
    });
    spot = Object.assign(document.createElement("div"), { className: "tour-spot" });
    bubble = Object.assign(document.createElement("div"), { className: "tour-bubble" });
    bubble.setAttribute("role", "dialog");
    bubble.setAttribute("aria-live", "polite");
    bubble.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-tour]")?.dataset.tour;
      if (a === "next") next();
      else if (a === "prev") prev();
      else if (a === "end") end();
      else if (a === "bubble") {
        st.bubble = st.bubble === "fixe" ? "suit" : "fixe";
        try {
          localStorage.setItem(KEY_BUBBLE, st.bubble);
        } catch {
          // choix gardé pour cette visite seulement
        }
        render(false);
      } else if (a === "alt") {
        const h = steps[st.i]?.alt?.hash;
        end();
        if (h) hooks.go(h);
      }
    });
    document.body.append(...shades, spot, bubble);
  }
  const palOpen = () => [...document.querySelectorAll<HTMLElement>(".cmd-pal")].some((e) => !e.hidden);
  const onKey = (e: KeyboardEvent) => {
    // Échap ferme d'abord la palette d'objets si elle est ouverte ; sinon il quitte le tutoriel.
    if (e.key === "Escape" && !palOpen()) end();
  };
  // Le projecteur suit sa cible : défilement, fenêtre redimensionnée, page qui change (bloc sélectionné…).
  let frame = 0;
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => place(false));
  };

  function start(mode: TourMode): void {
    build();
    const fresh = st.i < 0 && !st.decision;
    const seq = tourSeq(steps, mode);
    if (!seq.length) return;
    st.mode = mode;
    st.decision = false;
    st.i = seq[0]!;
    st.hole = null;
    if (fresh) {
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", follow);
      window.addEventListener("scroll", follow, { passive: true });
      hooks.onStart();
    }
    hooks.onStartMode?.(mode);
    render();
  }
  function next(): void {
    const s = tourSeq(steps, st.mode);
    const p = s.indexOf(st.i);
    if (p < s.length - 1) {
      st.i = s[p + 1]!;
      render();
    } else end();
  }
  function prev(): void {
    const s = tourSeq(steps, st.mode);
    const p = s.indexOf(st.i);
    if (p > 0) {
      st.i = s[p - 1]!;
      render();
    }
  }
  function stopTimers(): void {
    for (const t of st.timers) clearTimeout(t);
    st.timers = [];
    clearInterval(st.poll);
  }
  function end(): void {
    if (st.i < 0 && !st.decision) return;
    st.i = -1;
    st.decision = false;
    st.hole = null;
    stopTimers();
    for (const d of shades) d.style.display = "none";
    spot.style.display = "none";
    bubble.style.display = "none";
    document.documentElement.classList.remove("touring");
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", follow);
    window.removeEventListener("scroll", follow);
    hooks.onEnd(st.mode);
  }
  const toggle = () =>
    `<button type="button" class="tour-pin" data-tour="bubble" title="${t(st.bubble === "fixe" ? "tour.bubble.toFollow" : "tour.bubble.toFixed")}">${t(st.bubble === "fixe" ? "tour.bubble.fixed" : "tour.bubble.follows")}</button>`;
  function render(navigate = true): void {
    const step = steps[st.i]!;
    const s = tourSeq(steps, st.mode);
    const p = s.indexOf(st.i);
    if (navigate && step.hash && location.hash !== step.hash) hooks.go(step.hash);
    hooks.onReach?.(st.mode, st.i);
    bubble.style.display = "block";
    const last = p === s.length - 1;
    // Étape guidée par l'action : pas de « Suivant » tant que l'action n'est pas faite (sauf si elle l'est déjà).
    const waiting = !!step.until && !hooks.test(step.until);
    const label = t(step.next ?? (last ? "tour.finish" : "tour.next"));
    const offset = steps[s[0]!]!.center ? 1 : 0;
    const head = step.center ? t("tour.part.welcome") : t("tour.step", { n: p + 1 - offset, total: s.length - offset });
    bubble.innerHTML = withIcons(`${toggle()}<div class="tour-part">${head}</div><div class="tour-title">${t(step.title)}</div><div class="tour-text">${t(step.text)}</div>
      ${step.act ? `<div class="tour-act${waiting ? "" : " done"}">${t(waiting ? step.act : "tour.act.done")}</div>` : ""}
      ${step.note && hooks.test(step.note.when) ? `<div class="tour-note">${t(step.note.text)}</div>` : ""}
      <div class="tour-wait" hidden></div>
      <div class="tour-dots">${s.map((_, j) => (steps[s[j]!]!.center ? "" : `<span class="tour-dot${j < p ? " done" : j === p ? " cur" : ""}"></span>`)).join("")}</div>
      <div class="tour-ctrl">${p > 0 ? `<button type="button" class="tour-btn" data-tour="prev">${t("tour.prev")}</button>` : ""}
      ${step.alt ? `<button type="button" class="tour-btn next" data-tour="alt">${t(step.alt.label)}</button>` : ""}
      ${waiting ? "" : `<button type="button" class="tour-btn${step.alt ? "" : " next"}" data-tour="next">${label}</button>`}
      <span class="tour-skip">${last ? "" : `<button type="button" class="tour-link" data-tour="end">${t(p === 0 ? "tour.skip" : "tour.quit")}</button>`}</span></div>`);
    if (!waiting) bubble.querySelector<HTMLButtonElement>("[data-tour=next]")?.focus({ preventScroll: true });
    // On regarde : la page est figée. On essaie (play) : la page défile, le projecteur suit sa cible.
    document.documentElement.classList.toggle("touring", !step.play);
    // Plusieurs passes de cadrage : la page change d'adresse, le schéma et l'usine se dessinent après.
    stopTimers();
    st.timers = [0, 150, 450].map((ms) => window.setTimeout(() => place(true), ms));
    // Puis le projecteur suit la cible (un bloc sélectionné agrandit la page, l'usine se calcule…), et l'action est guettée.
    let armed = false;
    st.poll = window.setInterval(() => {
      if (step.wait) waitTick(step);
      place(false);
      if (waiting && !armed && hooks.test(step.until!)) {
        armed = true;
        const at = st.i;
        st.timers.push(window.setTimeout(() => { if (st.i === at) next(); }, 600));
      }
    }, 250);
  }
  /** Un calcul en cours (usine) : son avancement dans la bulle, puis le projecteur sur le résultat. */
  function waitTick(step: TourStep): void {
    const box = bubble.querySelector<HTMLElement>(".tour-wait");
    const bar = document.querySelector<HTMLElement>(step.wait!);
    if (!box) return;
    if (bar) {
      const label = bar.querySelector(".lbl")?.textContent ?? t("tour.waiting");
      const pct = bar.querySelector(".pct")?.textContent ?? "";
      box.hidden = false;
      box.innerHTML = `<span>${icon("wait")} ${label} ${pct}</span><span class="bar"><i style="width:${parseFloat(pct) || 0}%"></i></span>`;
    } else if (!box.hidden) {
      box.hidden = true;
      place(true);
    }
  }
  /** Les volets autour du trou (null : un volet plein) ; `dim` : ils assombrissent eux-mêmes (pas de projecteur). */
  function shade(h: Rect | null, dim = true): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const boxes: Rect[] = h
      ? [
          { top: 0, left: 0, width: W, height: h.top },
          { top: h.top + h.height, left: 0, width: W, height: H - h.top - h.height },
          { top: h.top, left: 0, width: h.left, height: h.height },
          { top: h.top, left: h.left + h.width, width: W - h.left - h.width, height: h.height },
        ]
      : [{ top: 0, left: 0, width: W, height: H }];
    shades.forEach((d, k) => {
      const b = boxes[k];
      d.classList.toggle("dim", dim);
      if (!b || b.width <= 0 || b.height <= 0) return void (d.style.display = "none");
      Object.assign(d.style, { display: "block", top: `${b.top}px`, left: `${b.left}px`, width: `${b.width}px`, height: `${b.height}px` });
    });
  }
  /** `frame` : recadrer la page sur la cible (entrée dans l'étape) ; sinon suivre la cible là où elle est. */
  function place(frame = true): void {
    if (st.i < 0 || st.decision) return;
    const step = steps[st.i]!;
    // La palette d'objets (fenêtre au-dessus de la page) : la visite s'efface le temps du choix.
    const pal = palOpen();
    bubble.style.visibility = pal ? "hidden" : "";
    if (pal) {
      for (const d of shades) d.style.display = "none";
      spot.style.display = "none";
      st.hole = null;
      return;
    }
    const el = !step.center && step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const near = st.bubble === "suit";
    bubble.classList.toggle("near", near && !!el);
    if (!el || !el.getClientRects().length) {
      st.hole = null;
      shade(null);
      spot.style.display = "none";
      bubble.style.removeProperty("top");
      bubble.style.removeProperty("left");
      return;
    }
    // La cible doit tenir sous l'en-tête et, bulle fixe, au-dessus de la bulle.
    const header = document.querySelector(".top")?.getBoundingClientRect().bottom ?? 0;
    const minTop = Math.max(8, header + 8);
    const room = near ? window.innerHeight - 8 : window.innerHeight - bubble.offsetHeight - 24;
    let r = el.getBoundingClientRect();
    const inHeader = !!el.closest(".top");
    if (frame && !inHeader && (r.top < minTop || r.bottom > room)) {
      window.scrollBy(0, r.top - minTop);
      r = el.getBoundingClientRect();
    }
    const pad = 6;
    // La partie visible de la cible : sous l'en-tête et, bulle fixe, au-dessus de la bulle.
    const top = inHeader ? Math.max(4, r.top - pad) : Math.max(header + 2, r.top - pad);
    const bottom = Math.min(inHeader ? r.bottom + pad : room, r.bottom + pad);
    if (bottom - top < 12) {
      // Cible sortie de l'écran (on a fait défiler) : voile plein, on peut redéfiler vers elle.
      st.hole = null;
      spot.style.display = "none";
      shade(null);
      return;
    }
    const hole: Rect = { top, left: Math.max(4, r.left - pad), width: Math.min(window.innerWidth - 8, r.width + pad * 2), height: bottom - top };
    if (!frame && st.hole && Math.abs(st.hole.top - hole.top) + Math.abs(st.hole.left - hole.left) + Math.abs(st.hole.width - hole.width) + Math.abs(st.hole.height - hole.height) < 1) return;
    // Premier éclairage après une carte centrée : le projecteur part de la bulle, l'œil le suit.
    if (!st.hole && pulsed !== st.i) {
      const b = bubble.getBoundingClientRect();
      Object.assign(spot.style, { display: "block", transition: "none", top: `${b.top}px`, left: `${b.left}px`, width: `${b.width}px`, height: `${b.height}px` });
      void spot.offsetWidth;
      spot.style.removeProperty("transition");
    }
    // Une pulsation à chaque nouvelle étape seulement.
    if (pulsed !== st.i) {
      pulsed = st.i;
      spot.classList.remove("pulse");
      void spot.offsetWidth;
      spot.classList.add("pulse");
    }
    // Suivre la cible (défilement, page qui change) sans glissade : le projecteur colle à elle.
    spot.style.transition = frame ? "" : "none";
    st.hole = hole;
    Object.assign(spot.style, { display: "block", top: `${hole.top}px`, left: `${hole.left}px`, width: `${hole.width}px`, height: `${hole.height}px` });
    // Élément utilisable : les volets laissent le trou ; sinon un volet plein, transparent (le projecteur assombrit).
    shade(step.play ? hole : null, false);
    if (near) {
      const bw = bubble.offsetWidth;
      const bh = bubble.offsetHeight;
      let bt = hole.top + hole.height + 12;
      if (bt + bh > window.innerHeight - 8) bt = hole.top - bh - 12;
      if (bt < 8) bt = Math.max(8, window.innerHeight - bh - 16);
      bubble.style.top = `${bt}px`;
      bubble.style.left = `${Math.min(Math.max(8, hole.left), window.innerWidth - bw - 8)}px`;
    } else {
      bubble.style.removeProperty("top");
      bubble.style.removeProperty("left");
    }
  }
  return { start, end, active: () => st.i >= 0 || st.decision };
}
