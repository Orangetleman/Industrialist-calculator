// Visite d'orientation (S24, maquette `maquette/orientation.html` validée, Q25) : un voile assombrit la
// page, un projecteur éclaire l'élément décrit, une bulle fixe en bas de l'écran explique. D'abord
// l'essentiel (première visite), puis une visite détaillée proposée, qui entre dans le schéma, l'usine
// complète, Mon usine, l'arbre et les recettes. Le bouton « ? » de l'en-tête la rejoue.
// Modèle : la visite guidée du site de philosophie de l'utilisateur (voile, projecteur, bulle,
// essentiel puis détail, clic dans le sombre seulement à la dernière étape).

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
  next?: string;
};

export type TourMode = "core" | "detail" | "full";

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
  { core: true, part: "Ta partie", hash: "#objet", target: "#me", title: "D'abord : où tu en es", text: "<b>Mon usine</b> garde ta progression : recherches débloquées, argent, RP. Ces puces la résument, un clic l'ouvre. Tu peux aussi y <b>importer</b> une partie exportée d'un autre appareil. Tout reste dans ton navigateur." },
  { core: true, part: "Planifier", hash: "#objet", target: "label[for=item]", title: "L'objet à produire", text: "Tape le nom de l'objet <b>comme dans le Recipe Book</b> du jeu, puis la quantité par minute (ou le nombre de machines finales)." },
  { core: true, part: "Planifier", hash: "#objet", target: "#answer", title: "La réponse", text: "En une ligne : combien de machines, puis la <b>place au sol</b>, l'énergie et le prix. Si une recherche manque, le site te dit laquelle." },
  { core: true, part: "Planifier", hash: "#objet", target: "#rtabs-result", title: "Tes vues de travail", text: "Le <b>schéma</b> montre la chaîne ; les <b>plans de pose</b> dessinent l'usine module par module, comme tu la construis en jeu ; la liste et les détails donnent le reste. La visite détaillée les ouvre pour toi." },
  { core: true, part: "Le reste du site", hash: "#objet", target: "[data-nav=arbre]", title: "L'arbre de recherche", text: "Comme en jeu. Pour une recherche pas encore débloquée : ce qui te manque, et <b>dans combien de temps de jeu</b> tu l'auras à ton rythme." },
  { core: true, part: "Le reste du site", hash: "#objet", target: "[data-nav=recettes]", title: "Recettes et Contribuer", text: "<b>Recettes</b> : tous les crafts, comme l'onglet du jeu. À côté, <b>Contribuer</b> : corriger une valeur ⚠ qui ne colle pas au jeu, relever les ports d'un bâtiment." },
  { core: true, part: "Fin", hash: "#objet", target: "#help", title: "Revoir la visite", text: "Ce bouton <b>?</b> rejoue la visite quand tu veux, en entier." },
  // Visite détaillée : elle entre dans les vues (au minimum le schéma et l'usine complète, Q25).
  { part: "Le schéma", hash: "#objet/schema", target: "#flow-frame", title: "Le graphe de la chaîne", text: "Toute la chaîne, de l'extraction à l'objet : glisse pour te déplacer, molette pour zoomer. <b>Clique un bloc</b> : tu règles son nombre de machines, tu écartes une machine, et « Comment c'est calculé » détaille chaque nombre." },
  { part: "L'usine", hash: "#objet/pose/usine-entiere", target: "#pose-frame", title: "L'usine complète", text: "Le plan de toute l'usine vue de dessus, calculé en quelques secondes : modules, tuyaux, poteaux. <b>Clique un module</b> pour ouvrir son plan de pose ; « Afficher les liaisons » montre qui alimente qui." },
  { part: "Régler le plan", hash: "#objet", target: "#criteria", title: "Les priorités", text: "Quand un objet se fabrique de plusieurs façons, la <b>première priorité</b> décide (par défaut : le moins de place). Glisse les lignes pour changer l'ordre." },
  { part: "Régler le plan", hash: "#objet", target: "#mfilter", title: "Les machines", text: "Écarte une machine que tu ne veux pas, ou n'utilise <b>que</b> celles que tu as déjà posées." },
  { part: "Ma recherche", hash: "#usine", target: "#rs-box", title: "Ma recherche et « Je joue »", text: "Recopie ton <b>Research Tracking Panel</b> : le site estime tes RP et leur baisse au-delà du seuil. Les RP ne montent qu'en jeu : clique <b>▶ Je joue</b> en lançant le jeu." },
  { part: "L'arbre", hash: "#arbre", target: "#rs-frame", title: "L'arbre, comme en jeu", text: "Clique une recherche : ce qu'elle débloque, son prix, et le temps de jeu qu'il te faut pour l'avoir. « Marquer comme débloquée » met ta partie à jour." },
  { part: "Recettes", hash: "#recettes", target: "#rc-list", title: "Les recettes", text: "Cherche un objet ou une machine : ses crafts, d'où il vient, à quoi il sert. Une valeur fausse se corrige depuis sa fiche (« ✎ Corriger »)." },
  { part: "Fin", center: true, hash: "#objet", title: "C'est parti", text: "Tout plan est une <b>proposition</b> : sers-t'en comme base et optimise en jeu. Bonne construction !", next: "Terminer" },
];

export type TourHooks = {
  /** Avant la première étape : mettre l'exemple en place. */
  onStart(): void;
  /** Ouvrir une adresse du site. */
  go(hash: string): void;
  /** À la fin (ou si on passe) : rendre la partie du joueur. */
  onEnd(): void;
};

/** La visite (une seule instance) : voile, projecteur, bulle fixe en bas. */
export function createTour(steps: readonly TourStep[], hooks: TourHooks) {
  const st = { i: -1, mode: "core" as TourMode, decision: false, timers: [] as number[] };
  let blocker: HTMLDivElement, spot: HTMLDivElement, bubble: HTMLDivElement;
  const built = () => !!blocker;
  function build(): void {
    if (built()) return;
    blocker = Object.assign(document.createElement("div"), { className: "tour-blocker" });
    spot = Object.assign(document.createElement("div"), { className: "tour-spot" });
    bubble = Object.assign(document.createElement("div"), { className: "tour-bubble" });
    bubble.setAttribute("role", "dialog");
    bubble.setAttribute("aria-live", "polite");
    blocker.addEventListener("click", () => {
      const s = tourSeq(steps, st.mode);
      if (!st.decision && s.indexOf(st.i) === s.length - 1) next();
    });
    bubble.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-tour]")?.dataset.tour;
      if (a === "next") next();
      else if (a === "prev") prev();
      else if (a === "end") end();
      else if (a === "detail") {
        st.decision = false;
        st.mode = "detail";
        st.i = tourSeq(steps, "detail")[0]!;
        render();
      }
    });
    document.body.append(blocker, spot, bubble);
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") end();
  };
  const onResize = () => place();

  function start(mode: TourMode): void {
    build();
    if (st.i < 0 && !st.decision) hooks.onStart();
    st.mode = mode;
    st.decision = false;
    st.i = tourSeq(steps, mode)[0]!;
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
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
  function end(): void {
    if (st.i < 0 && !st.decision) return;
    st.i = -1;
    st.decision = false;
    for (const t of st.timers) clearTimeout(t);
    blocker.classList.remove("open", "dim");
    spot.style.display = "none";
    bubble.style.display = "none";
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    hooks.onEnd();
  }
  function decide(): void {
    st.decision = true;
    blocker.classList.add("open", "dim");
    spot.style.display = "none";
    bubble.style.display = "block";
    bubble.innerHTML = `<div class="tour-part">L'essentiel est vu</div><div class="tour-title">Tu sais t'orienter 👍</div>
      <div class="tour-text">Tu veux la <b>visite détaillée</b> ? Elle ouvre le <b>schéma</b>, l'<b>usine complète</b>, les réglages du plan, Ma recherche, l'arbre et les recettes. Le bouton <b>?</b> la rejoue quand tu veux.</div>
      <div class="tour-decision"><button type="button" class="tour-btn next" data-tour="detail">Oui, le détail ▶</button><button type="button" class="tour-link" data-tour="end">Non merci, j'ai compris</button></div>`;
  }
  function render(): void {
    const step = steps[st.i]!;
    const s = tourSeq(steps, st.mode);
    const p = s.indexOf(st.i);
    if (step.hash && location.hash !== step.hash) hooks.go(step.hash);
    blocker.classList.add("open");
    bubble.style.display = "block";
    const last = p === s.length - 1;
    const label = step.next ?? (last ? (st.mode === "core" ? "Continuer ▶" : "Terminer") : "Suivant ▶");
    bubble.innerHTML = `<div class="tour-part">${step.part}</div><div class="tour-title">${step.title}</div><div class="tour-text">${step.text}</div>
      <div class="tour-dots">${s.map((_, j) => `<span class="tour-dot${j < p ? " done" : j === p ? " cur" : ""}"></span>`).join("")}</div>
      <div class="tour-ctrl">${p > 0 ? `<button type="button" class="tour-btn" data-tour="prev">◀ Précédent</button>` : ""}<button type="button" class="tour-btn next" data-tour="next">${label}</button>
      <span class="tour-skip">${last ? "" : `<button type="button" class="tour-link" data-tour="end">${p === 0 ? "Passer la visite" : "Tout passer"}</button>`}</span></div>`;
    bubble.querySelector<HTMLButtonElement>("[data-tour=next]")?.focus({ preventScroll: true });
    // Plusieurs passes : la page change d'adresse, le schéma et l'usine se dessinent après.
    for (const t of st.timers) clearTimeout(t);
    st.timers = [0, 150, 450, 1200, 3000, 8000].map((ms) => window.setTimeout(place, ms));
  }
  function place(): void {
    if (st.i < 0 || st.decision) return;
    const step = steps[st.i]!;
    const el = !step.center && step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const visible = el && el.getClientRects().length > 0;
    if (!visible) {
      blocker.classList.add("dim");
      spot.style.display = "none";
      return;
    }
    blocker.classList.remove("dim");
    // La bulle est fixe en bas (Q25.1) : la cible doit tenir au-dessus d'elle.
    const room = window.innerHeight - bubble.offsetHeight - 24;
    let r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > room) {
      window.scrollBy(0, r.top - Math.max(70, (room - Math.min(r.height, room - 70)) / 2));
      r = el.getBoundingClientRect();
    }
    const pad = 6;
    const top = Math.max(4, r.top - pad);
    const bottom = Math.min(room, r.bottom + pad);
    Object.assign(spot.style, {
      display: "block",
      top: `${top}px`,
      left: `${Math.max(4, r.left - pad)}px`,
      width: `${Math.min(window.innerWidth - 8, r.width + pad * 2)}px`,
      height: `${Math.max(0, bottom - top)}px`,
    });
  }
  return { start, end, active: () => st.i >= 0 || st.decision };
}
