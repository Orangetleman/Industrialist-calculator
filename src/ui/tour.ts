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

export type TourStep = {
  /** Étape de l'essentiel (première visite) ; les autres forment la visite détaillée. */
  core?: boolean;
  part: string;
  title: string;
  /** HTML simple (<b>) écrit par le site, jamais par le joueur. */
  text: string;
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
  next?: string;
};

export type TourMode = "core" | "detail" | "full";
export type BubbleMode = "fixe" | "suit";

/** Indices des étapes jouées selon le mode (fonction pure, testée). */
export function tourSeq(steps: readonly TourStep[], mode: TourMode): number[] {
  const all = steps.map((_, k) => k);
  if (mode === "core") return all.filter((k) => steps[k]!.core);
  if (mode === "detail") return all.filter((k) => !steps[k]!.core);
  return all;
}

/** Les étapes de la visite du calculateur. L'exemple affiché pendant la visite : 60 Crankshaft/min. */
export const SITE_TOUR: TourStep[] = [
  {
    core: true, part: "Bienvenue", center: true, hash: "#objet", title: "Bienvenue sur le calculateur", next: "Commencer ▶",
    text: "Dis ce que tu veux produire dans <b>Industrialist</b> : le site donne <b>toute la chaîne</b> (les machines, l'énergie, la place au sol, les plans de pose), avec <b>seulement ce que tu as débloqué</b>. Pendant la visite, l'exemple montre <b>60 Crankshaft/min avec toutes les recherches</b> ; ta partie revient telle quelle à la fin.",
  },
  { core: true, part: "Ta partie", hash: "#objet", target: "#me", title: "D'abord : où tu en es", text: "En haut à droite, ces puces résument <b>ta partie</b> : recherches débloquées, RP, argent. Un clic ouvre <b>Mon usine</b>, où tu la renseignes (ou l'<b>importes</b> d'un autre appareil). Tout reste dans ton navigateur." },
  { core: true, part: "Planifier", hash: "#objet", target: "#query", title: "L'objet à produire", text: "Tape le nom de l'objet <b>comme dans le Recipe Book</b> du jeu, puis la quantité par minute (ou le nombre de machines finales). Ici : <b>Crankshaft, 60</b>." },
  { core: true, part: "Planifier", hash: "#objet", target: "#answer", title: "La réponse", text: "En une ligne : combien de machines, puis la <b>place au sol</b>, l'énergie et le prix. Si une recherche manque, le site te dit laquelle." },
  { core: true, part: "Planifier", hash: "#objet", target: "#rtabs-result", play: true, title: "Tes vues de travail", text: "Le <b>schéma</b> montre la chaîne ; les <b>plans de pose</b> dessinent l'usine module par module, comme tu la construis en jeu ; la liste et les détails donnent le reste. La visite détaillée les ouvre pour toi." },
  { core: true, part: "Le reste du site", hash: "#objet", target: "[data-nav=arbre]", title: "L'arbre de recherche", text: "Comme en jeu. Pour une recherche pas encore débloquée : ce qui te manque, et <b>dans combien de temps de jeu</b> tu l'auras à ton rythme." },
  { core: true, part: "Le reste du site", hash: "#objet", target: "[data-nav=recettes]", title: "Recettes et Contribuer", text: "<b>Recettes</b> : tous les crafts, comme l'onglet du jeu. À côté, <b>Contribuer</b> : corriger une valeur ⚠ qui ne colle pas au jeu, relever les ports d'un bâtiment." },
  { core: true, part: "Fin", hash: "#objet", target: "#help", title: "Revoir la visite", text: "Ce bouton <b>?</b> rejoue la visite quand tu veux, en entier." },
  // Visite détaillée : elle entre dans les vues (au minimum le schéma et l'usine complète, Q25), et on y touche.
  { part: "Le schéma", hash: "#objet/schema", target: "#flow-frame", play: true, title: "Le graphe de la chaîne", text: "Toute la chaîne, de l'extraction à l'objet. <b>Essaie</b> : glisse pour te déplacer, molette pour zoomer, <b>clique un bloc</b> (son nombre de machines, « Comment c'est calculé » apparaissent dessous)." },
  { part: "L'usine", hash: "#objet/pose/usine-entiere", target: "#pose-frame", play: true, wait: "#usine-progress", title: "L'usine complète", text: "Le plan de toute l'usine vue de dessus : modules, tuyaux, poteaux. <b>Essaie</b> : glisse, zoome, <b>survole un module</b> pour voir ce qu'il produit, clique-le pour ouvrir son plan." },
  { part: "Régler le plan", hash: "#objet", target: "#criteria", play: true, title: "Les priorités", text: "Quand un objet se fabrique de plusieurs façons, la <b>première priorité</b> décide (par défaut : le moins de place). <b>Essaie</b> : ouvre la liste et change l'ordre (la visite ne garde rien)." },
  { part: "Régler le plan", hash: "#objet", target: "#mfilter", play: true, title: "Les machines", text: "Écarte une machine que tu ne veux pas, ou n'utilise <b>que</b> celles que tu as déjà posées." },
  { part: "Ma recherche", hash: "#usine", target: "#rs-box", title: "Ma recherche et « Je joue »", text: "Recopie ton <b>Research Tracking Panel</b> : le site estime tes RP et leur baisse au-delà du seuil. Les RP ne montent qu'en jeu : clique <b>▶ Je joue</b> en lançant le jeu." },
  { part: "L'arbre", hash: "#arbre", target: ".rs-workspace", play: true, title: "L'arbre, comme en jeu", text: "<b>Essaie</b> : glisse l'arbre et <b>clique une recherche</b>. À droite : ce qu'elle débloque, son prix, et le temps de jeu qu'il te faut pour l'avoir." },
  { part: "Recettes", hash: "#recettes", target: "#rc-layout", play: true, title: "Les recettes", text: "<b>Essaie</b> : cherche un objet (« steel ») et clique-le : ses crafts, d'où il vient, à quoi il sert. Une valeur fausse se corrige depuis sa fiche (« ✎ Corriger »)." },
  { part: "Fin", center: true, hash: "#objet", title: "C'est parti", text: "Tout plan est une <b>proposition</b> : sers-t'en comme base et optimise en jeu. Bonne construction !", next: "Terminer" },
];

export type TourHooks = {
  /** Avant la première étape : mettre l'exemple en place (et redessiner la page). */
  onStart(): void;
  /** Ouvrir une adresse du site. */
  go(hash: string): void;
  /** À la fin (ou si on passe) : rendre la partie du joueur. */
  onEnd(): void;
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
  const st = { i: -1, mode: "core" as TourMode, decision: false, timers: [] as number[], poll: 0, hole: null as Rect | null, bubble: readBubble() };
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
        if (st.decision) decide();
        else render(false);
      } else if (a === "detail") {
        st.decision = false;
        st.mode = "detail";
        st.i = tourSeq(steps, "detail")[0]!;
        render();
      }
    });
    document.body.append(...shades, spot, bubble);
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") end();
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
    st.mode = mode;
    st.decision = false;
    st.i = tourSeq(steps, mode)[0]!;
    st.hole = null;
    if (fresh) {
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", follow);
      window.addEventListener("scroll", follow, { passive: true });
      hooks.onStart();
    }
    render();
  }
  function next(): void {
    const s = tourSeq(steps, st.mode);
    const p = s.indexOf(st.i);
    if (p < s.length - 1) {
      st.i = s[p + 1]!;
      render();
    } else if (st.mode === "core") decide();
    else end();
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
    hooks.onEnd();
  }
  const toggle = () =>
    `<button type="button" class="tour-pin" data-tour="bubble" title="${st.bubble === "fixe" ? "La bulle suit le projecteur" : "La bulle reste en bas de l'écran"}">${st.bubble === "fixe" ? "Bulle fixe ⇅" : "Bulle qui suit ⇅"}</button>`;
  function decide(): void {
    stopTimers();
    st.decision = true;
    st.hole = null;
    document.documentElement.classList.add("touring");
    shade(null);
    spot.style.display = "none";
    bubble.style.display = "block";
    bubble.classList.remove("near");
    bubble.innerHTML = `${toggle()}<div class="tour-part">L'essentiel est vu</div><div class="tour-title">Tu sais t'orienter 👍</div>
      <div class="tour-text">Tu veux la <b>visite détaillée</b> ? Elle ouvre le <b>schéma</b> et l'<b>usine complète</b> (tu peux y toucher), les réglages du plan, Ma recherche, l'arbre et les recettes. Le bouton <b>?</b> la rejoue quand tu veux.</div>
      <div class="tour-decision"><button type="button" class="tour-btn next" data-tour="detail">Oui, le détail ▶</button><button type="button" class="tour-link" data-tour="end">Non merci, j'ai compris</button></div>`;
    bubble.style.removeProperty("top");
    bubble.style.removeProperty("left");
  }
  function render(navigate = true): void {
    const step = steps[st.i]!;
    const s = tourSeq(steps, st.mode);
    const p = s.indexOf(st.i);
    if (navigate && step.hash && location.hash !== step.hash) hooks.go(step.hash);
    bubble.style.display = "block";
    const last = p === s.length - 1;
    const label = step.next ?? (last ? (st.mode === "core" ? "Continuer ▶" : "Terminer") : "Suivant ▶");
    bubble.innerHTML = `${toggle()}<div class="tour-part">${step.part}</div><div class="tour-title">${step.title}</div><div class="tour-text">${step.text}</div>
      <div class="tour-wait" hidden></div>
      <div class="tour-dots">${s.map((_, j) => `<span class="tour-dot${j < p ? " done" : j === p ? " cur" : ""}"></span>`).join("")}</div>
      <div class="tour-ctrl">${p > 0 ? `<button type="button" class="tour-btn" data-tour="prev">◀ Précédent</button>` : ""}<button type="button" class="tour-btn next" data-tour="next">${label}</button>
      <span class="tour-skip">${last ? "" : `<button type="button" class="tour-link" data-tour="end">${p === 0 ? "Passer la visite" : "Tout passer"}</button>`}</span></div>`;
    bubble.querySelector<HTMLButtonElement>("[data-tour=next]")?.focus({ preventScroll: true });
    // On regarde : la page est figée. On essaie (play) : la page défile, le projecteur suit sa cible.
    document.documentElement.classList.toggle("touring", !step.play);
    // Plusieurs passes de cadrage : la page change d'adresse, le schéma et l'usine se dessinent après.
    stopTimers();
    st.timers = [0, 150, 450].map((ms) => window.setTimeout(() => place(true), ms));
    // Puis le projecteur suit la cible (un bloc sélectionné agrandit la page, l'usine se calcule…).
    st.poll = window.setInterval(() => {
      if (step.wait) waitTick(step);
      place(false);
    }, 250);
  }
  /** Un calcul en cours (usine) : son avancement dans la bulle, puis le projecteur sur le résultat. */
  function waitTick(step: TourStep): void {
    const box = bubble.querySelector<HTMLElement>(".tour-wait");
    const bar = document.querySelector<HTMLElement>(step.wait!);
    if (!box) return;
    if (bar) {
      const label = bar.querySelector(".lbl")?.textContent ?? "Calcul en cours";
      const pct = bar.querySelector(".pct")?.textContent ?? "";
      box.hidden = false;
      box.innerHTML = `<span>⏳ ${label} ${pct}</span><span class="bar"><i style="width:${parseFloat(pct) || 0}%"></i></span>`;
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
