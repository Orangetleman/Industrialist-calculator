// Calcul de l'usine sur téléphone : la zone du plan devient une grille de pose vivante. Les cases s'allument du centre
// vers les bords selon l'avancement réel du calcul, une onde montre qu'il travaille ; à la fin, la grille se fond dans
// le plan. Aucun bâtiment n'est dessiné : rien ne laisse croire à un résultat.

const CELL = 26;

/** Seuil d'allumage d'une case (0 au centre, 1 dans les coins), un peu brouillé pour un bord vivant (fonction pure, testée). */
export function litAt(x: number, y: number, cols: number, rows: number): number {
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  const d = Math.hypot((x - cx) / Math.max(1, cx), (y - cy) / Math.max(1, cy)) / Math.SQRT2;
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  const noise = s - Math.floor(s);
  return Math.min(1, Math.max(0, d * 0.82 + noise * 0.18));
}

export function createGen(host: HTMLElement, busy: HTMLElement): { sync(active: boolean): void } {
  const cv = document.createElement("canvas");
  cv.className = "m-gen";
  cv.hidden = true;
  cv.setAttribute("aria-hidden", "true"); // l'avancement est annoncé par le bandeau
  host.append(cv);
  let raf = 0, last = 0, shown = 0, out = 0;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const pct = () => parseFloat(busy.querySelector<HTMLElement>("#usine-progress .bar i")?.style.width ?? "") || 0;
  function draw(now: number): void {
    raf = requestAnimationFrame(draw);
    if (now - last < 40) return; // 25 images par seconde : le calcul garde le téléphone
    last = now;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#120c20";
    g.fillRect(0, 0, w, h);
    const cols = Math.ceil(w / CELL) + 1, rows = Math.ceil(h / CELL) + 1;
    const ox = (w - cols * CELL) / 2, oy = (h - rows * CELL) / 2;
    shown += (pct() / 100 - shown) * 0.08;
    const t = still.matches ? 0 : now / 1000;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const at = litAt(x, y, cols, rows), done = at < shown;
        const wave = still.matches ? 0 : Math.max(0, Math.sin(t * 1.9 - at * 9)) ** 3;
        const edge = shown > 0.01 ? Math.max(0, 1 - Math.abs(at - shown) * 14) : 0;
        g.fillStyle = `rgba(124,92,190,${(done ? 0.3 : 0.1) + wave * 0.16})`;
        const s = done ? 2 : 5;
        g.fillRect(ox + x * CELL + s, oy + y * CELL + s, CELL - 2 * s, CELL - 2 * s);
        const glow = edge * 0.6 + wave * 0.2;
        if (glow > 0.02) {
          g.fillStyle = `rgba(255,106,26,${glow})`;
          g.fillRect(ox + x * CELL + 4, oy + y * CELL + 4, CELL - 8, CELL - 8);
        }
      }
    g.strokeStyle = "rgba(255,255,255,.09)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= cols; x++) g.moveTo(Math.round(ox + x * CELL) + 0.5, 0), g.lineTo(Math.round(ox + x * CELL) + 0.5, h);
    for (let y = 0; y <= rows; y++) g.moveTo(0, Math.round(oy + y * CELL) + 0.5), g.lineTo(w, Math.round(oy + y * CELL) + 0.5);
    g.stroke();
  }
  function stop(): void {
    cancelAnimationFrame(raf);
    raf = 0;
    cv.hidden = true;
    cv.classList.remove("out");
  }
  return {
    sync(active) {
      const run = active && !busy.hidden && !!busy.querySelector("#usine-progress");
      if (run) {
        clearTimeout(out);
        out = 0;
        cv.classList.remove("out");
        if (cv.hidden) {
          shown = 0;
          cv.hidden = false;
        }
        host.style.setProperty("--m-busy", `${busy.offsetHeight}px`);
        if (!raf) raf = requestAnimationFrame(draw);
      } else if (!cv.hidden && !out) {
        if (!active || !busy.hidden) return stop(); // quitté, arrêté ou en erreur : pas de fondu
        cv.classList.add("out");
        out = window.setTimeout(() => ((out = 0), stop()), 600);
      }
    },
  };
}
