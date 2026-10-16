// Toute l'usine : les modules de chaque étape du plan placés sur une même grille, reliés par des tuyaux
// et alimentés par un réseau électrique. Algorithme de la maquette v8 (maquette/usine.gen.test.ts, qui
// l'appelle) : plusieurs essais de placement serré, puis, en mode « recalculé pour l'usine entière »,
// collecteurs sans bout imposé, dispositions internes et rotations choisies vers les voisins, recuit,
// passages du collecteur central d'une double rangée, et une seule prise par collecteur. Pur, sans DOM :
// tourne aussi dans un Web Worker (entrée et résultat se copient tels quels).

import type { PortsEntry } from "../extension-types.ts";
import type { Catalog } from "./catalog.ts";
import { OPPOSITE, STEP, type Dir } from "./geometry.ts";
import { alternatives, designModule, passageOptions, passageText, redesign, requestFromStep, type ModulePlan, type ModuleRequest, type Namer, type Passage, type PoseCriterion } from "./module.ts";
import { Grid, route, type Occupant } from "./route.ts";

/** Une étape du plan, prête à devenir un module de l'usine. */
export type FactoryStep = {
  key: string;
  /** Machine de l'étape (id). */
  machine: string;
  /** « 3 × Blast Furnace » ; « ≈ » devant pour des arbres. */
  label: string;
  /** Ce que l'étape produit. */
  sub: string;
  /** Profondeur depuis l'objectif (0 = produit final). */
  depth: number;
  /** Consommation électrique moyenne du module (MF/s). */
  power: number;
  /** Demande de module (null : pas encore dessiné, comme les arbres). */
  req: ModuleRequest | null;
  entry: PortsEntry | null;
  size: { w: number; l: number } | null;
};
export type FactoryEdge = { from: string; to: string; item: string; perMin: number; loop?: boolean };
export type FactoryOptions = {
  /** Coller deux modules (sortie contre entrée) quand c'est possible, sans tuyau. */
  glue?: boolean;
  /** Poteaux recalculés pour toute l'usine, au lieu de garder ceux des modules. */
  globalPoles?: boolean;
  /** Recalculé pour l'usine entière : une seule prise par collecteur, modules réorganisés vers leurs voisins. */
  full?: boolean;
  /** Cases de plus permises dans chaque sens pendant le recuit. */
  room?: number;
  /** Un passage du collecteur central qui élargit son module est permis. */
  widen?: boolean;
};
export type FactoryInput = {
  steps: FactoryStep[];
  edges: FactoryEdge[];
  /** Noms des objets et des machines (id → nom). */
  names: Record<string, string>;
  cat: Catalog;
  /** Parcelle du joueur, en cases (sert au placement : on évite d'en sortir). */
  plot: { w: number; h: number };
  options?: FactoryOptions;
};
/** Avancement : part faite (0 à 1) et étape en cours, en mots de joueur. */
export type FactoryProgress = (done: number, label: string) => void;

type Pole = Catalog["poles"][number];
type Pt = { x: number; y: number };
export type FactoryBox = { key: string; machine: string; label: string; sub: string; x: number; y: number; w: number; h: number; rot: number; col: number; mod: ModulePlan | null; power: number };
export type FactoryPlug = Pt & { key: string; load: number };
export type FactoryPole = Pt & { id: string; type: Pole; plugs: FactoryPlug[]; load: number; module?: string };
export type FactoryCable = { from: Pt & { id: string }; to: FactoryPole; d: number; relays: number; relayType: Pole; load: number; lines: number; internal: boolean };
export type FactoryNet = { id: string; item: string; perMin: number; from: string; to: string[] };
/**
 * Passage du collecteur central gardé pour un module : le texte, les choix (ressource, rangée, machine) et si
 * le module en devient plus grand qu'avant (seulement avec l'option `widen`).
 */
export type FactoryPassage = { text: string; choices: { item: string; passage: Passage }[]; wider: boolean };

export type FactoryPlan = {
  W: number;
  H: number;
  boxes: FactoryBox[];
  /** Cases de la grille de l'usine : tuyaux entre modules (et collecteurs des modules en mode complet). */
  cells: Map<string, Occupant>;
  nets: FactoryNet[];
  /** Cases de tuyau de chaque liaison (collecteurs compris en mode complet). */
  netCells: Record<string, number>;
  /** Liaisons collées (« fournisseur>client »), sans tuyau. */
  glued: string[];
  /** Liaisons non tracées. */
  problems: string[];
  poleNodes: FactoryPole[];
  links: FactoryCable[];
  feed: Pt;
  passagesKept: Map<string, FactoryPassage>;
  full: boolean;
  /** Écart gardé entre deux modules. */
  CLRused: number;
  stats: {
    /** Cases de tuyau entre modules. */
    pipeCells: number;
    /** Cases de tuyau en tout (collecteurs des modules compris). */
    allPipeCells: number;
    /** Croisements des tuyaux entre modules. */
    crossings: number;
    allCrossings: number;
    /** Électricité consommée par toute l'usine (MF/s). */
    total: number;
    relays: number;
    upgraded: number;
    overloaded: number;
    polesCost: number;
    modulesCost: number;
    keptPoles: number;
    newPoles: number;
  };
  /** Traces de calcul (essais, passages, prises), pour la mise au point. */
  debug: { tries: string[]; passages: string[]; taps: string[] };
};

/** Le module tourné d'un quart de tour (sens horaire) : tous les bâtiments ont 4 rotations en jeu. */
const TURN: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };
export function turnModule(m: ModulePlan): ModulePlan {
  const H = m.height;
  const cell = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: H - 1 - o.y, y: o.x });
  const point = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: H - o.y, y: o.x });
  const rect = <T extends { x: number; y: number; w: number; h: number }>(o: T): T => ({ ...o, x: H - o.y - o.h, y: o.x, w: o.h, h: o.w });
  return {
    ...m,
    width: m.height,
    height: m.width,
    machines: m.machines.map((q) => ({ ...rect(q), cells: q.cells.map(cell), power: q.power.map(point), ports: q.ports.map((pt) => ({ ...pt, cell: cell(pt.cell), facing: TURN[pt.facing] })) })),
    pieces: m.pieces.map((pc) => ({ ...cell(pc), links: pc.links.map((d) => TURN[d]), ...(pc.crossLinks ? { crossLinks: pc.crossLinks.map((d) => TURN[d]) } : {}) })),
    nets: m.nets.map((n) => ({ ...n, end: n.end ? { ...cell(n.end), dir: TURN[n.end.dir] } : null })),
    poles: m.poles.map(rect),
  };
}
const fourTurns = (m: ModulePlan) => [m, turnModule(m), turnModule(turnModule(m)), turnModule(turnModule(turnModule(m)))];

/** Case `p` d'un module de `w` × `h` cases, tourné `r` fois d'un quart de tour. */
function turnCell(p: Pt, w: number, h: number, r: number): Pt {
  let q = p;
  let [ww, hh] = [w, h];
  for (let k = 0; k < r; k++) {
    q = { x: hh - 1 - q.y, y: q.x };
    [ww, hh] = [hh, ww];
  }
  return q;
}

/** Ce qu'il faut savoir d'une étape du plan (champs de `Step`). */
type PlanStep = Parameters<typeof requestFromStep>[0] & { key: string; depth: number };

/**
 * Entrée de `designFactory` pour un plan : une étape par module (demande, relevé des ports, taille du wiki),
 * les liaisons et les noms. Les étapes sans module (arbres, centrales composées) gardent une place réservée.
 */
export function factoryInput(
  plan: { steps: PlanStep[]; edges: FactoryEdge[] },
  look: {
    name: Namer;
    isFluid: (item: string) => boolean;
    machine: (id: string) => { cost: number | null; size: { w: number; l: number } | null } | null;
    ports: Record<string, PortsEntry>;
  },
  cat: Catalog,
  plot: { w: number; h: number },
  pose: { priority: PoseCriterion[]; tier3Only?: boolean },
  options: FactoryOptions = {},
): FactoryInput {
  const names: Record<string, string> = {};
  const nm = (id: string) => (names[id] ??= look.name(id));
  const steps = plan.steps.map((s): FactoryStep => {
    const m = look.machine(s.machine);
    const base = m ? requestFromStep(s, look.isFluid, m.cost) : null;
    const req = base ? { ...base, priority: pose.priority, ...(pose.tier3Only ? { tier3Only: true } : {}) } : null;
    for (const f of [...s.inputs, ...s.byproducts]) nm(f.item);
    return { key: s.key, machine: s.machine, label: `${s.machineKind === "farm" ? "≈ " : ""}${s.machines} × ${nm(s.machine)}`, sub: nm(s.item), depth: s.depth, power: Math.max(0, s.energyAvg ?? 0), req, entry: look.ports[s.machine] ?? null, size: m?.size ?? null };
  });
  const keys = new Set(steps.map((s) => s.key));
  const edges = plan.edges.filter((e) => keys.has(e.from) && keys.has(e.to));
  for (const e of edges) nm(e.item);
  return { steps, edges, names, cat, plot, options };
}

type Box = FactoryBox & { placed: boolean; variants: ModulePlan[]; req: ModuleRequest | null; entry: PortsEntry | null; size: { w: number; l: number } | null };
type Rect = { x0: number; y0: number; x1: number; y1: number };

/** Plan de toute l'usine. `progress` est appelé de temps en temps (pour une barre d'avancement). */
export function designFactory(input: FactoryInput, progress: FactoryProgress = () => {}): FactoryPlan {
  const { cat, plot: PLOT } = input;
  const { glue = false, globalPoles = false, full = false, room = 0, widen = false } = input.options ?? {};
  const edgesAll = input.edges;
  const name: Namer = (id) => input.names[id] ?? id;
  const safe = <T>(f: () => T, fallback: T): T => {
    try {
      return f();
    } catch {
      return fallback;
    }
  };

  progress(0, "Plans de pose des modules");
  const maxD = Math.max(0, ...input.steps.map((s) => s.depth));
  const boxes: Box[] = input.steps.map((s) => {
    const mod = s.req ? designModule(s.req, s.entry, s.size, cat, name) : null;
    return { key: s.key, machine: s.machine, label: s.label, sub: s.sub, w: mod?.width ?? 12, h: mod?.height ?? 12, x: 0, y: 0, col: maxD - s.depth, mod, placed: false, power: s.power, variants: mod ? fourTurns(mod) : [], rot: 0, req: s.req, entry: s.entry, size: s.size };
  });
  const byKey = new Map(boxes.map((b) => [b.key, b]));
  const endOf = (b: Box, item: string, role: "entrée" | "sortie") => b.mod?.nets.find((n) => n.role === role && name(n.item) === name(item))?.end ?? null;
  const anchorAbs = (b: Box, end: { x: number; y: number; dir: Dir }) => ({ x: b.x + end.x + STEP[end.dir].x, y: b.y + end.y + STEP[end.dir].y });
  const producers = (k: string) => edgesAll.filter((e) => e.to === k && !e.loop).map((e) => ({ e, p: byKey.get(e.from)! }));

  const empty = (): FactoryPlan => ({
    W: 0,
    H: 0,
    boxes: [],
    cells: new Map(),
    nets: [],
    netCells: {},
    glued: [],
    problems: [],
    poleNodes: [],
    links: [],
    feed: { x: 1, y: 1 },
    passagesKept: new Map(),
    full,
    CLRused: 0,
    stats: { pipeCells: 0, allPipeCells: 0, crossings: 0, allCrossings: 0, total: 0, relays: 0, upgraded: 0, overloaded: 0, polesCost: 0, modulesCost: 0, keptPoles: 0, newPoles: 0 },
    debug: { tries: [], passages: [], taps: [] },
  });
  if (!boxes.length) return empty();

  // ------------------------------------------------------------ placement serré
  const setRot = (b: Box, r: number) => {
    if (!b.variants.length) return;
    b.rot = r;
    b.mod = b.variants[r]!;
    b.w = b.mod.width;
    b.h = b.mod.height;
  };
  // Usine entière : la distance d'une liaison est celle qui sépare les deux collecteurs (segments), puisque le
  // tuyau peut s'y raccorder n'importe où (une seule prise par collecteur).
  let useCollectors = false;
  const rectGap = (a: Rect, b: Rect) => Math.max(0, a.x0 - b.x1, b.x0 - a.x1) + Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  const collRect = (b: Box, item: string, role: "entrée" | "sortie"): Rect => {
    const base = b.variants[0];
    const n = base?.nets.find((x) => x.role === role && x.item === item);
    if (!base || !n) return { x0: b.x + b.w / 2, y0: b.y + b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2 };
    let p1: Pt;
    let p2: Pt;
    if (n.via && n.end) {
      // Collecteur central sorti par un passage entre deux machines : la prise est au bout du passage.
      p1 = { x: n.end.x, y: n.end.y };
      p2 = p1;
    } else if (base.folds > 1 && n.end) {
      const ys = base.pieces.filter((pc) => pc.x === n.end!.x && (pc.net === n.id || pc.crossNet === n.id)).map((pc) => pc.y);
      p1 = { x: n.end.x, y: Math.min(...ys) };
      p2 = { x: n.end.x, y: Math.max(...ys) };
    } else if (n.lane) {
      p1 = { x: n.lane.x0, y: n.lane.y };
      p2 = { x: n.lane.x1, y: n.lane.y };
    } else return { x0: b.x + b.w / 2, y0: b.y + b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2 };
    const q1 = turnCell(p1, base.width, base.height, b.rot);
    const q2 = turnCell(p2, base.width, base.height, b.rot);
    return { x0: b.x + Math.min(q1.x, q2.x), y0: b.y + Math.min(q1.y, q2.y), x1: b.x + Math.max(q1.x, q2.x), y1: b.y + Math.max(q1.y, q2.y) };
  };
  // Amélioration du placement, puis tassement (sert aussi après le recalcul des modules).
  const improve = (CLR: number, glued: string[]) => {
    const sep = (b: Box, x: number, y: number, o: Box) => x + b.w + CLR <= o.x || o.x + o.w + CLR <= x || y + b.h + CLR <= o.y || o.y + o.h + CLR <= y;
    const free = (b: Box, x: number, y: number, except?: Box) => x >= 0 && y >= 0 && boxes.every((o) => !o.placed || o === b || o === except || sep(b, x, y, o));
    // Amélioration : chaque module est retiré puis reposé (position et rotation) là où surface + 10 × distance
    // entre ses ports et ceux de ses partenaires est la plus faible ; tant que ça s'améliore.
    const portOf = (o: Box, item: string, role: "entrée" | "sortie") => {
      const end = endOf(o, item, role);
      return end ? { x: o.x + end.x + STEP[end.dir].x, y: o.y + end.y + STEP[end.dir].y } : { x: o.x + o.w / 2, y: o.y + o.h / 2 };
    };
    const linkDist = (b: Box) =>
      edgesAll
        .filter((e) => !e.loop && (e.from === b.key || e.to === b.key))
        .reduce((sum, e) => {
          if (useCollectors) return sum + rectGap(collRect(byKey.get(e.from)!, e.item, "sortie"), collRect(byKey.get(e.to)!, e.item, "entrée"));
          const a = portOf(byKey.get(e.from)!, e.item, "sortie");
          const c = portOf(byKey.get(e.to)!, e.item, "entrée");
          return sum + Math.abs(a.x - c.x) + Math.abs(a.y - c.y);
        }, 0);
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      for (const b of boxes) {
        if (glued.some((g) => g.endsWith(`>${b.key}`) || g.startsWith(`${b.key}>`))) continue;
        const others = boxes.filter((o) => o !== b);
        const bbox = (x: number, y: number) => {
          const W = Math.max(x + b.w, ...others.map((o) => o.x + o.w));
          const H = Math.max(y + b.h, ...others.map((o) => o.y + o.h));
          const X0 = Math.min(x, ...others.map((o) => o.x));
          const Y0 = Math.min(y, ...others.map((o) => o.y));
          return { area: (W - X0) * (H - Y0), over: Math.max(0, W - X0 - PLOT.w) + Math.max(0, H - Y0 - PLOT.h) };
        };
        const scoreAt = () => {
          const bb = bbox(b.x, b.y);
          return bb.area + 4000 * bb.over + 10 * linkDist(b);
        };
        const start = { x: b.x, y: b.y, r: b.rot, score: scoreAt() };
        let best = start;
        const curW = Math.max(0, ...others.map((o) => o.x + o.w));
        const curH = Math.max(0, ...others.map((o) => o.y + o.h));
        for (const r of b.variants.length ? [0, 1, 2, 3] : [0]) {
          setRot(b, r);
          for (let x = 0; x <= curW + CLR; x++)
            for (let y = 0; y <= curH + CLR; y++) {
              if (!free(b, x, y)) continue;
              [b.x, b.y] = [x, y];
              const sc = scoreAt();
              if (sc < best.score - 1e-9) best = { x, y, r, score: sc };
            }
        }
        setRot(b, best.r);
        [b.x, b.y] = [best.x, best.y];
        if (best !== start) improved = true;
      }
      if (!improved) break;
    }
    // Tassement : chaque module glisse vers le haut et la gauche tant que c'est libre.
    for (let moved = true, guard = 0; moved && guard < 50; guard++) {
      moved = false;
      for (const b of boxes) {
        if (glued.some((g) => g.endsWith(`>${b.key}`) || g.startsWith(`${b.key}>`))) continue;
        while (free(b, b.x, b.y - 1)) [b.y, moved] = [b.y - 1, true];
        while (free(b, b.x - 1, b.y)) [b.x, moved] = [b.x - 1, true];
      }
    }
  };
  const place = (CLR: number, wDist: number, bySize: boolean) => {
    for (const b of boxes) b.placed = false;
    const glued: string[] = [];
    const sep = (b: Box, x: number, y: number, o: Box) => x + b.w + CLR <= o.x || o.x + o.w + CLR <= x || y + b.h + CLR <= o.y || o.y + o.h + CLR <= y;
    const free = (b: Box, x: number, y: number, except?: Box) => x >= 0 && y >= 0 && boxes.every((o) => !o.placed || o === b || o === except || sep(b, x, y, o));
    const order = [...boxes].sort((a, b) => (bySize ? b.w * b.h - a.w * a.h || a.col - b.col : a.col - b.col || b.w * b.h - a.w * a.h));
    for (const b of boxes) setRot(b, 0);
    for (const b of order) {
      const placed = boxes.filter((o) => o.placed);
      const prods = producers(b.key);
      if (glue && prods.length === 1 && edgesAll.filter((e) => e.from === prods[0]!.e.from).length === 1) {
        const { e, p } = prods[0]!;
        const out = endOf(p, e.item, "sortie");
        const inn = endOf(b, e.item, "entrée");
        if (out && inn && out.dir === "E" && inn.dir === "W") {
          const x = p.x + p.w;
          const y = p.y + out.y - inn.y;
          if (free(b, x, y, p)) {
            Object.assign(b, { x, y, placed: true });
            glued.push(`${p.key}>${b.key}`);
            continue;
          }
        }
      }
      // Toutes les positions de la grille autour de ce qui est posé : la plus serrée, près des fournisseurs.
      const curW = placed.length ? Math.max(...placed.map((o) => o.x + o.w)) : 0;
      const curH = placed.length ? Math.max(...placed.map((o) => o.y + o.h)) : 0;
      // Liaisons avec ce qui est déjà posé, dans les deux sens : distance entre les vrais ports (sortie du
      // fournisseur, entrée du client), pour chaque rotation du module.
      const links = edgesAll
        .filter((e) => !e.loop && ((e.to === b.key && byKey.get(e.from)!.placed) || (e.from === b.key && byKey.get(e.to)!.placed)))
        .map((e) => ({ e, other: byKey.get(e.to === b.key ? e.from : e.to)!, mine: e.to === b.key ? ("entrée" as const) : ("sortie" as const) }));
      const portAt = (o: Box, item: string, role: "entrée" | "sortie") => {
        const end = endOf(o, item, role);
        return end ? { x: o.x + end.x + STEP[end.dir].x, y: o.y + end.y + STEP[end.dir].y } : { x: o.x + o.w / 2, y: o.y + o.h / 2 };
      };
      const fixed = links.map((l) => portAt(l.other, l.e.item, l.mine === "entrée" ? "sortie" : "entrée"));
      let best: [number, number, number] = [0, 0, 0];
      let bestScore = Infinity;
      for (const r of b.variants.length ? [0, 1, 2, 3] : [0]) {
        setRot(b, r);
        const mineEnds = links.map((l) => endOf(b, l.e.item, l.mine));
        for (let x = 0; x <= curW + CLR; x++) {
          for (let y = 0; y <= curH + CLR; y++) {
            if (!free(b, x, y)) continue;
            const W = Math.max(x + b.w, curW);
            const H = Math.max(y + b.h, curH);
            const over = Math.max(0, W - PLOT.w) + Math.max(0, H - PLOT.h);
            let dist = 0;
            links.forEach((_, i) => {
              const end = mineEnds[i];
              const q = end ? { x: x + end.x + STEP[end.dir].x, y: y + end.y + STEP[end.dir].y } : { x: x + b.w / 2, y: y + b.h / 2 };
              dist += Math.abs(q.x - fixed[i]!.x) + Math.abs(q.y - fixed[i]!.y);
            });
            const score = W * H + 4000 * over + wDist * dist;
            if (score < bestScore) [best, bestScore] = [[x, y, r], score];
          }
        }
      }
      setRot(b, best[2]);
      Object.assign(b, { x: best[0], y: best[1], placed: true });
    }
    improve(CLR, glued);
    return glued;
  };

  // ------------------------------------------------------------ tuyaux (vrai routeur), plusieurs essais
  let glued: string[] = [];
  let grid = new Grid();
  let nets: FactoryNet[] = [];
  let problems: string[] = [];
  let W = 0;
  let H = 0;
  let CLRused = 0;
  // Cases à l'intérieur d'un module : on peut y passer (entre les machines), mais on préfère les couloirs.
  let inside = new Set<string>();
  // Liaison à départs multiples (A*) : d'une case de `from` (par un côté libre) vers une case de `to` ;
  // croisements à angle droit. Renvoie les cases du chemin posé, ou null.
  const connect = (net: string, from: Set<string>, to: Set<string>, bounds: Rect): string[] | null => {
    const cellOf = (k: string) => {
      const [x, y] = k.split(",").map(Number) as [number, number];
      return { x, y };
    };
    const tb = [...to].map(cellOf);
    const h = (c: Pt) => Math.min(...tb.map((t) => Math.abs(t.x - c.x) + Math.abs(t.y - c.y)));
    type N = { c: Pt; d: Dir; g: number; f: number; prev: N | null; crossing: boolean; root: string };
    const open: N[] = [];
    const best = new Map<string, number>();
    const pipeOk = (k: string) => {
      const o = grid.cells.get(k);
      return o?.kind === "tuyau" && o.net === net && !o.cross && o.links.size < 4;
    };
    const straightOther = (k: string, d: Dir) => {
      const o = grid.cells.get(k);
      const vertical = d === "N" || d === "S";
      return o?.kind === "tuyau" && o.net !== net && !o.cross && o.links.size === 2 && (vertical ? o.links.has("E") && o.links.has("W") : o.links.has("N") && o.links.has("S"));
    };
    const stepCost = (k: string) => 1 + (inside.has(k) ? 0.8 : 0);
    for (const k of from) {
      if (!pipeOk(k)) continue;
      const c = cellOf(k);
      const links = (grid.cells.get(k) as { links: Set<Dir> }).links;
      for (const d of ["N", "E", "S", "W"] as Dir[]) {
        if (links.has(d)) continue;
        const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y };
        const nk = `${n.x},${n.y}`;
        if (n.x < bounds.x0 || n.y < bounds.y0 || n.x > bounds.x1 || n.y > bounds.y1) continue;
        if (to.has(nk) && pipeOk(nk)) {
          grid.link(c, d, net);
          grid.link(n, OPPOSITE[d], net);
          return [];
        }
        if (grid.cells.get(nk)) {
          if (straightOther(nk, d)) open.push({ c: n, d, g: 9, f: 9 + h(n), prev: null, crossing: true, root: k });
          continue;
        }
        open.push({ c: n, d, g: stepCost(nk), f: stepCost(nk) + h(n), prev: null, crossing: false, root: k });
      }
    }
    let found: N | null = null;
    for (let guard = 0; open.length && guard < 400_000; guard++) {
      let bi = 0;
      for (let q = 1; q < open.length; q++) if (open[q]!.f < open[bi]!.f) bi = q;
      const cur = open.splice(bi, 1)[0]!;
      if (found && cur.f >= found.g) break;
      const dirs: Dir[] = cur.crossing ? [cur.d] : (["N", "E", "S", "W"] as Dir[]).filter((d) => d !== OPPOSITE[cur.d]);
      for (const d of dirs) {
        const n = { x: cur.c.x + STEP[d].x, y: cur.c.y + STEP[d].y };
        if (n.x < bounds.x0 || n.y < bounds.y0 || n.x > bounds.x1 || n.y > bounds.y1) continue;
        const k = `${n.x},${n.y}`;
        const turn = d !== cur.d ? 0.6 : 0;
        if (to.has(k) && pipeOk(k)) {
          const gg = cur.g + 1 + turn;
          if (!found || gg < found.g) found = { c: n, d, g: gg, f: gg, prev: cur, crossing: false, root: cur.root };
          continue;
        }
        let crossing = false;
        if (grid.cells.get(k)) {
          if (!straightOther(k, d)) continue;
          crossing = true;
        }
        const gg = cur.g + stepCost(k) + turn + (crossing ? 8 : 0);
        const sk = `${k}|${d}|${crossing}`;
        if ((best.get(sk) ?? Infinity) <= gg) continue;
        best.set(sk, gg);
        open.push({ c: n, d, g: gg, f: gg + h(n), prev: cur, crossing, root: cur.root });
      }
    }
    if (!found) return null;
    const path: N[] = [];
    for (let n: N | null = found; n; n = n.prev) path.unshift(n);
    let prev = cellOf(path[0]!.root);
    const cells: string[] = [];
    for (const n of path) {
      grid.link(prev, n.d, net);
      grid.link(n.c, OPPOSITE[n.d], net);
      prev = n.c;
      if (n !== path.at(-1)) cells.push(`${n.c.x},${n.c.y}`);
    }
    return cells;
  };
  // Usine entière : sur le collecteur de chaque ressource (la rangée d'un module simple, le tuyau principal d'un
  // module replié), un seul point de raccordement : toute la production y converge, puis un seul tuyau sort et
  // se divise dehors vers les clients. Côté client, une seule arrivée sur son collecteur.
  let tapLog: string[] = [];
  let firstEdges: string[] = []; // liaisons à tracer d'abord (celles qui ont échoué au tour précédent)
  let failedEdges: string[] = [];
  /** Cases du collecteur d'une ressource (coordonnées de l'usine), rebaptisées au nom de la liaison. */
  const collector = (b: Box, item: string, role: "entrée" | "sortie", id: string): Set<string> => {
    const out = new Set<string>();
    const base = b.variants[0];
    if (!base) return out;
    const n = base.nets.find((x) => x.role === role && x.item === item);
    if (!n) return out;
    let cells: Pt[] = [];
    if (n.via && n.end) cells = [{ x: n.end.x, y: n.end.y }];
    else if (base.folds > 1 && n.end) cells = base.pieces.filter((pc) => pc.x === n.end!.x && (pc.net === n.id || pc.crossNet === n.id)).map((pc) => ({ x: pc.x, y: pc.y }));
    else if (n.lane) for (let x = n.lane.x0; x <= n.lane.x1; x++) cells.push({ x, y: n.lane.y });
    const own = `${b.key}~${n.id}`;
    for (const c of cells) {
      const q = turnCell(c, base.width, base.height, b.rot);
      const k = `${b.x + q.x},${b.y + q.y}`;
      const o = grid.cells.get(k);
      if (o?.kind !== "tuyau") continue;
      if (o.net === own) o.net = id;
      else if (o.cross?.net === own) o.cross.net = id;
      else continue;
      out.add(k);
    }
    return out;
  };
  const routeTaps = (edges0: FactoryEdge[], bounds: Rect) => {
    const k0 = (e: FactoryEdge) => `${e.from}>${e.to}:${e.item}`;
    const edges = [...edges0.filter((e) => firstEdges.includes(k0(e))), ...edges0.filter((e) => !firstEdges.includes(k0(e)))];
    failedEdges = [];
    tapLog = [];
    inside = new Set();
    for (const b of boxes) for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) inside.add(`${b.x + i},${b.y + j}`);
    const exits = new Map<string, Set<string>>(); // liaison → cases où un nouveau client peut se brancher
    for (const e of edges) {
      const id = `${e.from}:${e.item}`;
      if (!nets.some((n) => n.id === id)) nets.push({ id, item: e.item, perMin: 0, from: e.from, to: [] });
      const n = nets.find((x) => x.id === id)!;
      n.perMin += e.perMin;
      n.to.push(e.to);
      const p = byKey.get(e.from)!;
      const c = byKey.get(e.to)!;
      let target = exits.get(id);
      if (!target) {
        // Premier client : on se raccorde au collecteur du fournisseur (une seule prise).
        target = p.mod ? collector(p, e.item, "sortie", id) : new Set<string>();
        if (!p.mod) {
          // Arbres (pas encore dessinés) : un départ sur une case libre au bord de leur emplacement.
          const around: { c: Pt; d: Dir }[] = [];
          for (let i = 0; i < p.w; i++) around.push({ c: { x: p.x + i, y: p.y - 1 }, d: "S" }, { c: { x: p.x + i, y: p.y + p.h }, d: "N" });
          for (let j = 0; j < p.h; j++) around.push({ c: { x: p.x - 1, y: p.y + j }, d: "E" }, { c: { x: p.x + p.w, y: p.y + j }, d: "W" });
          const free = around.filter(({ c: q }) => !grid.cells.get(`${q.x},${q.y}`)).sort((u, v) => Math.abs(u.c.x - c.x) + Math.abs(u.c.y - c.y) - (Math.abs(v.c.x - c.x) + Math.abs(v.c.y - c.y)))[0];
          if (free) {
            grid.link(free.c, free.d, id);
            target.add(`${free.c.x},${free.c.y}`);
          }
        }
      }
      const from = c.mod ? collector(c, e.item, "entrée", id) : new Set<string>();
      const path = from.size && target.size ? connect(id, from, target, bounds) : null;
      if (!path) {
        problems.push(`${name(e.item)} : ${e.from} → ${e.to}`);
        failedEdges.push(k0(e));
        continue;
      }
      tapLog.push(`${name(e.item)} ${e.from}->${e.to} : ${path.length} cases ajoutées ; écart des collecteurs ${rectGap(collRect(p, e.item, "sortie"), collRect(c, e.item, "entrée"))}`);
      // Les clients suivants se branchent sur le tuyau sorti du module, jamais sur le collecteur.
      if (!exits.has(id)) exits.set(id, new Set(path));
      else for (const k of path) exits.get(id)!.add(k);
    }
  };
  // `through` (usine entière) : les tuyaux entre modules peuvent passer entre les machines d'un module et
  // croiser ses collecteurs à angle droit ; sinon, ils contournent chaque module entier.
  let through = false;
  const routeBetweenOnce = () => {
    grid = new Grid();
    nets = [];
    problems = [];
    for (const b of boxes) {
      if (!through || !b.mod) {
        for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) grid.block({ x: b.x + i, y: b.y + j }, b.key);
        continue;
      }
      for (const m of b.mod.machines) for (const c of m.cells) grid.block({ x: b.x + c.x, y: b.y + c.y }, b.key);
      for (const pc of b.mod.pieces) {
        const own = (net: string) => `${b.key}~${net}`;
        grid.cells.set(`${b.x + pc.x},${b.y + pc.y}`, { kind: "tuyau", net: own(pc.net), links: new Set(pc.links), ...(pc.crossNet ? { cross: { net: own(pc.crossNet), links: new Set(pc.crossLinks ?? []) } } : {}) });
      }
      // Bout d'un passage entre deux machines : ouvert, pour que le tuyau vers les voisins s'y raccorde.
      for (const n of b.mod.nets) {
        if (!n.via || !n.end) continue;
        const o = grid.cells.get(`${b.x + n.end.x},${b.y + n.end.y}`);
        if (o?.kind === "tuyau" && o.net === `${b.key}~${n.id}`) o.links.delete(n.end.dir);
      }
    }
    const bounds = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
    const edges = edgesAll.filter((e) => !glued.includes(`${e.from}>${e.to}`));
    if (through) return routeTaps(edges, bounds);
    for (const e of edges) {
      const p = byKey.get(e.from)!;
      const c = byKey.get(e.to)!;
      const id = `${e.from}:${e.item}`;
      const out = endOf(p, e.item, "sortie");
      const inn = endOf(c, e.item, "entrée");
      const a = out ? anchorAbs(p, out) : { x: p.x + p.w, y: p.y + Math.floor(p.h / 2) };
      if (!nets.some((n) => n.id === id)) {
        grid.link(a, out ? OPPOSITE[out.dir] : "W", id);
        nets.push({ id, item: e.item, perMin: 0, from: e.from, to: [] });
      }
      const n = nets.find((x) => x.id === id)!;
      n.perMin += e.perMin;
      n.to.push(e.to);
      grid.reserve(inn ? anchorAbs(c, inn) : { x: c.x - 1, y: c.y + Math.floor(c.h / 2) }, id);
    }
    for (const e of edges) {
      const p = byKey.get(e.from)!;
      const c = byKey.get(e.to)!;
      const id = `${e.from}:${e.item}`;
      const inn = endOf(c, e.item, "entrée");
      const start = inn ? anchorAbs(c, inn) : { x: c.x - 1, y: c.y + Math.floor(c.h / 2) };
      const target = { x: p.x + p.w, y: p.y + p.h / 2 };
      if (!route(grid, id, start, inn ? OPPOSITE[inn.dir] : "E", bounds, (q) => Math.abs(q.x - target.x) + Math.abs(q.y - target.y))) problems.push(`${name(e.item)} : ${e.from} → ${e.to}`);
    }
  };
  const routeBetween = (): void => {
    if (through) {
      firstEdges = [];
      for (let k = 0; k < 4; k++) {
        routeBetweenOnce();
        if (!failedEdges.length) return;
        firstEdges = [...failedEdges, ...firstEdges.filter((x) => !failedEdges.includes(x))];
      }
      return;
    }
    routeBetweenOnce();
  };
  const margin = () => {
    const M = 3;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    for (const b of boxes) [b.x, b.y] = [b.x + M - minX, b.y + M - minY];
    W = Math.max(...boxes.map((b) => b.x + b.w)) + M;
    H = Math.max(...boxes.map((b) => b.y + b.h)) + M;
  };
  const attempt = (CLR: number, wDist: number, bySize: boolean) => {
    glued = place(CLR, wDist, bySize);
    CLRused = CLR;
    margin();
    routeBetween();
    const fits = (W <= PLOT.w && H <= PLOT.h) || (H <= PLOT.w && W <= PLOT.h);
    return { area: W * H, pipes: [...grid.cells.values()].filter((o) => o.kind === "tuyau").length, fits, problems: problems.length };
  };
  // Parmi les essais entièrement raccordés : le meilleur compromis surface / longueur des tuyaux.
  // Le gagnant est refait pour retrouver ses tuyaux.
  const tries: { area: number; pipes: number; fits: boolean; problems: number; CLR: number; wDist: number; bySize: boolean }[] = [];
  const settings: [number, number, boolean][] = [];
  for (const CLR of [2, 3]) for (const wDist of [3, 8, 15, 30]) for (const bySize of [false, true]) settings.push([CLR, wDist, bySize]);
  const share = full ? 0.3 : 0.9;
  for (const [i, [CLR, wDist, bySize]] of settings.entries()) {
    progress((share * i) / settings.length, `Placement des modules (essai ${i + 1} sur ${settings.length})`);
    tries.push({ ...attempt(CLR, wDist, bySize), CLR, wDist, bySize });
  }
  // Une case de tuyau compte comme 10 cases de surface : un peu plus de place plutôt que des détours.
  // D'abord ceux qui sont entièrement raccordés, puis ceux qui tiennent sur la parcelle.
  const done = tries.some((t) => !t.problems) ? tries.filter((t) => !t.problems) : tries.filter((t) => t.problems === Math.min(...tries.map((u) => u.problems)));
  const pool = done.some((t) => t.fits) ? done.filter((t) => t.fits) : done;
  const bestTry = [...pool].sort((a, b) => a.area + 10 * a.pipes - (b.area + 10 * b.pipes))[0];
  if (bestTry) attempt(bestTry.CLR, bestTry.wDist, bestTry.bySize);

  // ------------------------------------------------------------ recalcul complet du tuyautage
  // Option « recalculé pour l'usine entière » : chaque module simple est refait avec des collecteurs sans bout
  // imposé (du premier au dernier port) ; l'usine y raccorde un seul tuyau par ressource, au meilleur endroit.
  // Les modules repliés gardent leur tuyau principal, sur lequel se fait la prise unique.
  const passagesKept = new Map<string, FactoryPassage>();
  const passLog: string[] = [];
  const setVariant = (b: Box, m: ModulePlan) => {
    b.variants = fourTurns(m);
    b.mod = b.variants[b.rot]!;
  };
  if (full) {
    progress(0.32, "Collecteurs des modules recalculés pour l'usine");
    for (const b of boxes) {
      if (!b.mod || !b.req) continue;
      const base = b.variants[0]!;
      if (base.folds > 1) continue;
      const ends = Object.fromEntries(base.nets.map((n) => [n.item, "milieu" as const]));
      const r = safe(() => redesign(base, { ...b.req!, ends }, b.entry, b.size, cat, name), null);
      if (!r || r.width !== base.width || r.height !== base.height) continue;
      setVariant(b, r);
    }
    // Modules repliés : chaque tuyau principal (où se fera la prise) passe du côté de ses partenaires.
    useCollectors = true;
    const sideTrunks = () => {
      for (const b of boxes) {
        if (!b.mod || !b.req || b.variants[0]!.folds <= 1) continue;
        const base = b.variants[0]!;
        const ends: Record<string, "début" | "fin"> = {};
        for (const n of base.nets) {
          const partners = edgesAll
            .filter((e) => e.item === n.item && (n.role === "entrée" ? e.to === b.key : e.from === b.key))
            .map((e) => collRect(byKey.get(n.role === "entrée" ? e.from : e.to)!, e.item, n.role === "entrée" ? "sortie" : "entrée"));
          if (!partners.length) continue;
          const side = (x: number) => {
            const q1 = turnCell({ x, y: 0 }, base.width, base.height, b.rot);
            const q2 = turnCell({ x, y: base.height - 1 }, base.width, base.height, b.rot);
            const r = { x0: b.x + Math.min(q1.x, q2.x), y0: b.y + Math.min(q1.y, q2.y), x1: b.x + Math.max(q1.x, q2.x), y1: b.y + Math.max(q1.y, q2.y) };
            return partners.reduce((t, p) => t + rectGap(r, p), 0);
          };
          ends[n.item] = side(0) <= side(base.width - 1) ? "début" : "fin";
        }
        const r = safe(() => redesign(base, { ...b.req!, ends }, b.entry, b.size, cat, name), null);
        if (!r || r.width !== base.width || r.height !== base.height) continue;
        setVariant(b, r);
      }
    };
    // Modules simples : parmi leurs dispositions internes de même taille, celle qui rapproche le plus leurs
    // collecteurs de ceux de leurs partenaires (et coûte peu en tuyaux et croisements internes).
    const alts = new Map<string, ModulePlan[]>();
    for (const b of boxes) {
      if (!b.mod || !b.req || b.variants[0]!.folds > 1) continue;
      const ends = Object.fromEntries(b.variants[0]!.nets.map((n) => [n.item, "milieu" as const]));
      alts.set(b.key, [b.variants[0]!, ...safe(() => alternatives(b.variants[0]!, { ...b.req!, ends }, b.entry, b.size, cat, name), [])]);
    }
    const chooseAlts = () => {
      for (const b of boxes) {
        const list = alts.get(b.key);
        if (!list || list.length < 2) continue;
        const score = () =>
          10 *
            edgesAll
              .filter((e) => !e.loop && (e.from === b.key || e.to === b.key))
              .reduce((t, e) => t + rectGap(collRect(byKey.get(e.from)!, e.item, "sortie"), collRect(byKey.get(e.to)!, e.item, "entrée")), 0) +
          b.variants[0]!.pieces.length +
          8 * b.variants[0]!.pieces.filter((pc) => pc.role === "croisement").length;
        let best = { m: b.variants[0]!, s: score() };
        const fits = () => boxes.every((o) => o === b || b.x + b.w + CLRused <= o.x || o.x + o.w + CLRused <= b.x || b.y + b.h + CLRused <= o.y || o.y + o.h + CLRused <= b.y);
        for (const m of list) {
          setVariant(b, m);
          [b.w, b.h] = [b.mod!.width, b.mod!.height];
          if (!fits()) continue;
          const sc = score();
          if (sc < best.s) best = { m, s: sc };
        }
        setVariant(b, best.m);
        [b.w, b.h] = [b.mod!.width, b.mod!.height];
      }
    };
    // Les modules se replacent (position et rotation) en sachant où sont leurs collecteurs.
    for (let k = 0; k < 3; k++) {
      progress(0.36 + 0.04 * k, "Modules tournés vers leurs voisins");
      sideTrunks();
      chooseAlts();
      improve(CLRused, []);
    }
    sideTrunks();
    chooseAlts();
    // Recuit dans l'emprise actuelle de l'usine (elle ne grandit pas) : déplacements, rotations et échanges de
    // modules pour rapprocher les collecteurs reliés ; chevauchements permis pendant la recherche mais pénalisés,
    // et seul un placement sans chevauchement est retenu.
    {
      const X0 = Math.min(...boxes.map((b) => b.x));
      const Y0 = Math.min(...boxes.map((b) => b.y));
      // `room` : cases de plus permises dans chaque sens (usine un peu plus grande, tuyaux plus courts).
      const X1 = Math.max(...boxes.map((b) => b.x + b.w)) + room;
      const Y1 = Math.max(...boxes.map((b) => b.y + b.h)) + room;
      let seed = 777;
      const rand = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const C = CLRused;
      const overlap = () => {
        let t = 0;
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!;
            const b = boxes[j]!;
            const ox = Math.min(a.x + a.w + C, b.x + b.w + C) - Math.max(a.x, b.x);
            const oy = Math.min(a.y + a.h + C, b.y + b.h + C) - Math.max(a.y, b.y);
            if (ox > 0 && oy > 0) t += ox * oy;
          }
        return t;
      };
      const outside = () => boxes.reduce((t, b) => t + Math.max(0, X0 - b.x) + Math.max(0, Y0 - b.y) + Math.max(0, b.x + b.w - X1) + Math.max(0, b.y + b.h - Y1), 0);
      const dist = () => edgesAll.filter((e) => !e.loop).reduce((t, e) => t + rectGap(collRect(byKey.get(e.from)!, e.item, "sortie"), collRect(byKey.get(e.to)!, e.item, "entrée")), 0);
      const objective = () => 10 * dist() + 60 * overlap() + 400 * outside();
      const snap = () => boxes.map((o) => ({ o, x: o.x, y: o.y, rot: o.rot }));
      const load = (st: ReturnType<typeof snap>) => {
        for (const v of st) {
          setRot(v.o, v.rot);
          [v.o.x, v.o.y] = [v.x, v.y];
        }
      };
      let cur = objective();
      let best = overlap() === 0 && outside() === 0 ? cur : Infinity;
      let bestState = snap();
      const N = 80_000;
      for (let it = 0; it < N; it++) {
        if (it % 4000 === 0) progress(0.48 + (0.27 * it) / N, "Modules rapprochés de leurs voisins");
        const T = 300 * Math.pow(1 / 300, it / N);
        const b = boxes[Math.floor(rand() * boxes.length)]!;
        const st = snap();
        const r = rand();
        if (r < 0.45) {
          b.x += Math.round((rand() - 0.5) * 20);
          b.y += Math.round((rand() - 0.5) * 20);
        } else if (r < 0.7 && b.variants.length) {
          const cx = b.x + b.w / 2;
          const cy = b.y + b.h / 2;
          setRot(b, Math.floor(rand() * 4));
          b.x = Math.round(cx - b.w / 2);
          b.y = Math.round(cy - b.h / 2);
        } else {
          const o = boxes[Math.floor(rand() * boxes.length)]!;
          if (o === b) continue;
          [b.x, b.y, o.x, o.y] = [o.x, o.y, b.x, b.y];
        }
        const next = objective();
        if (next <= cur || rand() < Math.exp((cur - next) / T)) {
          cur = next;
          if (cur < best && overlap() === 0 && outside() === 0) {
            best = cur;
            bestState = snap();
          }
        } else load(st);
      }
      load(bestState);
      sideTrunks();
      chooseAlts();
    }
    margin();
    through = true;
    progress(0.76, "Tuyaux entre les modules");
    routeBetween();
    // Double rangée : le collecteur central peut sortir par un passage entre deux machines. À placement égal
    // (l'usine ne grandit pas), chaque passage est essayé, seul ou avec un second passage dans le même module ;
    // il est gardé s'il raccourcit les tuyaux sans ajouter de croisement : c'est le passage qui va vers les
    // voisins. Un passage qui élargit son module n'est permis qu'en option (`widen`), s'il tient encore à sa place.
    const tally = () => {
      const cells = [...grid.cells.values()].filter((o) => o.kind === "tuyau");
      return { ok: !problems.length, pipes: cells.length, cross: cells.filter((o) => o.kind === "tuyau" && o.cross).length };
    };
    let cur = tally();
    type Opt = ReturnType<typeof passageOptions>[number];
    const doubles = boxes.filter((b) => b.mod && b.req && b.variants[0]!.folds <= 1 && b.variants[0]!.template === "double rangée");
    for (const [i, b] of doubles.entries()) {
      progress(0.8 + (0.15 * i) / doubles.length, `Passages entre les machines (module ${i + 1} sur ${doubles.length})`);
      const req = b.req!;
      const ends = Object.fromEntries(b.variants[0]!.nets.map((n) => [n.item, "milieu" as const]));
      const size = { w: b.variants[0]!.width, h: b.variants[0]!.height };
      const keep = { variants: b.variants, mod: b.mod, w: b.w, h: b.h };
      const label = (os: Opt[], wider: boolean) => os.map((o) => passageText(o.passage, req.count, name(o.item))).join(" ; ") + (wider ? " (module élargi)" : "");
      // Essai d'un module avec passage(s) à la place du module actuel : null s'il ne tient pas ou s'il élargit sans l'option.
      const trial = (os: Opt[]) => {
        const p = os.at(-1)!.plan;
        const wider = p.width > size.w || p.height > size.h;
        if (wider && !widen) return null;
        setVariant(b, p);
        [b.w, b.h] = [b.mod!.width, b.mod!.height];
        const fits = b.x + b.w <= W - 3 && b.y + b.h <= H - 3 && boxes.every((q) => q === b || b.x + b.w + CLRused <= q.x || q.x + q.w + CLRused <= b.x || b.y + b.h + CLRused <= q.y || q.y + q.h + CLRused <= b.y);
        if (fits) routeBetween();
        const r = fits ? tally() : null;
        passLog.push(`${b.key} ${label(os, wider)} ${p.width}x${p.height} rot${b.rot} ${JSON.stringify(r)} actuel ${JSON.stringify(cur)}`);
        Object.assign(b, keep);
        return r && r.ok ? { os, r, wider } : null;
      };
      // Chaque disposition interne du module (pas plus grande), avec chacun de ses passages (sans doublon).
      const seen = new Set<string>();
      const singles = (alts.get(b.key) ?? [b.variants[0]!])
        .filter((m) => m.width <= size.w && m.height <= size.h)
        .flatMap((m) => safe(() => passageOptions(m, { ...req, ends }, b.entry, b.size, cat, name), []))
        .filter((o) => {
          const k = JSON.stringify([o.item, o.passage, o.plan.config, o.plan.width, o.plan.height, o.plan.pieces.length]);
          return !seen.has(k) && !!seen.add(k);
        });
      const tried = singles.map((o) => trial([o])).filter((t): t is NonNullable<typeof t> => !!t);
      // Les plus prometteurs (moins de tuyaux) avec un second passage, pour une autre ressource.
      for (const t of tried.filter((x) => x.r.pipes < cur.pipes).sort((x, y) => x.r.pipes - y.r.pipes).slice(0, 3)) {
        const first = t.os[0]!;
        for (const o of safe(() => passageOptions(first.plan, { ...req, ends, passages: { [first.item]: first.passage } }, b.entry, b.size, cat, name), []).filter((x) => x.item !== first.item)) {
          const u = trial([first, o]);
          if (u) tried.push(u);
        }
      }
      const best = tried.filter((x) => x.r.pipes < cur.pipes && x.r.cross <= cur.cross).sort((x, y) => x.r.pipes - y.r.pipes || x.r.cross - y.r.cross)[0];
      if (!best) continue;
      setVariant(b, best.os.at(-1)!.plan);
      [b.w, b.h] = [b.mod!.width, b.mod!.height];
      cur = best.r;
      passagesKept.set(b.key, { text: label(best.os, best.wider), choices: best.os.map((o) => ({ item: o.item, passage: o.passage })), wider: best.wider });
    }
    routeBetween();
  }
  progress(0.95, "Réseau électrique");
  const modulePipeCells = boxes.reduce((t, b) => t + (b.mod?.pieces.length ?? 0), 0);
  const moduleCrossings = boxes.reduce((t, b) => t + (b.mod?.pieces.filter((pc) => pc.role === "croisement").length ?? 0), 0);
  const interIds = new Set(nets.map((n) => n.id));
  const isInter = (o: { net: string; cross?: { net: string } }) => interIds.has(o.net) || (!!o.cross && interIds.has(o.cross.net));
  const pipeList = [...grid.cells.values()].filter((o) => o.kind === "tuyau");
  const allPipeCells = pipeList.length + (through ? 0 : modulePipeCells);
  const crossings = pipeList.filter((o) => o.kind === "tuyau" && o.cross && isInter(o)).length;
  const pipeCells = pipeList.filter((o) => o.kind === "tuyau" && isInter(o)).length;
  const netCells: Record<string, number> = {};
  for (const o of pipeList) {
    if (o.kind !== "tuyau") continue;
    netCells[o.net] = (netCells[o.net] ?? 0) + 1;
    if (o.cross && o.cross.net !== o.net) netCells[o.cross.net] = (netCells[o.cross.net] ?? 0) + 1;
  }

  // ------------------------------------------------------------ réseau électrique
  const plugs: FactoryPlug[] = [];
  const plugsByMachine = new Map<string, FactoryPlug[]>(); // `${module}|${machine}` → ses prises
  const occupied = new Set<string>();
  for (const b of boxes) {
    if (!b.mod) {
      for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) occupied.add(`${b.x + i},${b.y + j}`);
      continue;
    }
    const each = b.power / Math.max(1, b.mod.machines.length);
    for (const m of b.mod.machines) {
      for (const c of m.cells) occupied.add(`${b.x + c.x},${b.y + c.y}`);
      const ps = m.power.filter((p) => p.direction !== "sortie").map((p) => ({ x: b.x + p.x, y: b.y + p.y, key: b.key, load: each / Math.max(1, m.power.filter((q) => q.direction !== "sortie").length) }));
      plugs.push(...ps);
      plugsByMachine.set(`${b.key}|${m.id}`, ps);
    }
    for (const p of b.mod.pieces) occupied.add(`${b.x + p.x},${b.y + p.y}`);
  }
  for (const [k, o] of grid.cells) if (o.kind === "tuyau") occupied.add(k);
  const feed = { x: 1, y: 1 };
  // Couverture gloutonne d'un ensemble de prises (portée, capacité = somme des nœuds) sur des cases libres ;
  // pour chaque modèle de poteau, puis le moins cher au total.
  const cover = (list: FactoryPlug[], tag: string): FactoryPole[] => {
    let bestSet: { nodes: FactoryPole[]; cost: number } | null = null;
    for (const type of cat.poles.filter((q) => q.id !== "hv-pole")) {
      const R = type.rangeCells;
      const cands: Pt[] = [];
      for (let x = 0; x + type.size.w <= W; x += 2)
        for (let y = 0; y + type.size.h <= H; y += 2) {
          let ok = true;
          for (let a = 0; a < type.size.w && ok; a++) for (let c = 0; c < type.size.h && ok; c++) if (occupied.has(`${x + a},${y + c}`)) ok = false;
          if (ok) cands.push({ x: x + type.size.w / 2, y: y + type.size.h / 2 });
        }
      const left = new Set(list.map((_, k) => k));
      const nodes: FactoryPole[] = [];
      while (left.size) {
        let bestC: { c: Pt; take: number[] } | null = null;
        for (const c of cands) {
          const near = [...left].filter((k) => Math.hypot(list[k]!.x - c.x, list[k]!.y - c.y) <= R).sort((a, b) => list[b]!.load - list[a]!.load);
          const take: number[] = [];
          let load = 0;
          for (const k of near) {
            if (load + list[k]!.load > type.capacityMFps) continue;
            load += list[k]!.load;
            take.push(k);
          }
          if (!bestC || take.length > bestC.take.length) bestC = { c, take };
        }
        if (!bestC || !bestC.take.length) break;
        for (const k of bestC.take) left.delete(k);
        const ps = bestC.take.map((k) => list[k]!);
        nodes.push({ ...bestC.c, id: `${tag}${nodes.length}`, type, plugs: ps, load: ps.reduce((t, q) => t + q.load, 0) });
      }
      if (left.size) continue;
      const cost = nodes.length * (type.price ?? 0);
      if (!bestSet || cost < bestSet.cost) bestSet = { nodes, cost };
    }
    return bestSet?.nodes ?? [];
  };
  let poleNodes: FactoryPole[] = [];
  let keptPoles = 0;
  let newPoles = 0;
  if (globalPoles) poleNodes = cover(plugs, "p");
  else {
    // Les poteaux de chaque module ; en mode complet, on garde ceux qu'aucun tuyau ne traverse, et on
    // recouvre seulement les prises des poteaux retirés.
    const uncovered: FactoryPlug[] = [];
    for (const b of boxes) {
      if (!b.mod) continue;
      for (const [i, q] of b.mod.poles.entries()) {
        const type = cat.poles.find((t) => t.id === q.pole);
        const ps = q.covers.flatMap((m) => plugsByMachine.get(`${b.key}|${m}`) ?? []);
        let hit = false;
        for (let a = 0; a < q.w && !hit; a++) for (let c = 0; c < q.h && !hit; c++) if (grid.get({ x: b.x + q.x + a, y: b.y + q.y + c })?.kind === "tuyau") hit = true;
        if (hit || !type) {
          uncovered.push(...ps);
          continue;
        }
        keptPoles++;
        for (let a = 0; a < q.w; a++) for (let c = 0; c < q.h; c++) occupied.add(`${b.x + q.x + a},${b.y + q.y + c}`);
        poleNodes.push({ x: b.x + q.x + q.w / 2, y: b.y + q.y + q.h / 2, id: `${b.key}#${i}`, type, plugs: ps, load: ps.reduce((s, p) => s + p.load, 0), module: b.key });
      }
    }
    if (uncovered.length) {
      const extra = cover(uncovered, "r");
      newPoles = extra.length;
      poleNodes.push(...extra);
    }
  }
  // Arbre orienté depuis l'arrivée, construit au moindre coût : à chaque étape, on ajoute le raccordement qui
  // coûte le moins en tout — relais sur le câble, et renforts des poteaux en amont qui porteront la charge en
  // plus (capacité = somme des nœuds). Raccorder directement à l'arrivée ouvre une nouvelle branche.
  const poleTypes = cat.poles.filter((t) => t.id !== "hv-pole");
  const price = (t: Pole) => t.price ?? 0;
  const strongest = cat.poles.reduce((a, b) => (b.capacityMFps > a.capacityMFps ? b : a));
  /** Modèle d'un poteau qui porte `load` : le sien s'il suffit, sinon le moins cher qui suffit. */
  const typeFor = (own: Pole, load: number) => (own.capacityMFps >= load ? own : ([...poleTypes].filter((t) => t.capacityMFps >= load).sort((a, b) => price(a) - price(b))[0] ?? strongest));
  /** Relais sur un câble de longueur d qui porte `load` : le modèle le moins cher au total. */
  const relaysFor = (d: number, load: number) => {
    let best = { n: 0, type: strongest, cost: Infinity };
    for (const t of poleTypes.filter((t) => t.capacityMFps >= load)) {
      const n = Math.max(0, Math.ceil(d / t.rangeCells) - 1);
      const cost = n * price(t);
      if (cost < best.cost) best = { n, type: t, cost };
    }
    return best.cost === Infinity ? { n: Math.max(0, Math.ceil(d / strongest.rangeCells) - 1), type: strongest, cost: 0 } : best;
  };
  const own = new Map(poleNodes.map((p) => [p.id, p.type]));
  const parent = new Map<string, string>(); // poteau → son amont ("feed" pour l'arrivée)
  const sub = new Map<string, number>(); // charge portée par chaque poteau (lui et son aval)
  const nodeById = new Map<string, Pt & { id: string }>([["feed", { ...feed, id: "feed" }], ...poleNodes.map((p) => [p.id, p] as [string, FactoryPole])]);
  const poleById = new Map(poleNodes.map((p) => [p.id, p]));
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const isInternal = (a: string, n: FactoryPole) => !!n.module && a.startsWith(`${n.module}#`);
  // Surcoût d'ajouter `extra` de charge à partir de `a` jusqu'à l'arrivée (renforts et relais en amont).
  const upstream = (a: string, extra: number) => {
    let cost = 0;
    for (let u = a; u !== "feed"; u = parent.get(u)!) {
      const t0 = own.get(u)!;
      cost += price(typeFor(t0, sub.get(u)! + extra)) - price(typeFor(t0, sub.get(u)!));
      const pu = parent.get(u)!;
      if (!isInternal(pu, poleById.get(u)!)) {
        const d = dist(nodeById.get(u)!, nodeById.get(pu)!);
        cost += relaysFor(d, sub.get(u)! + extra).cost - relaysFor(d, sub.get(u)!).cost;
      }
    }
    return cost;
  };
  const inTree = ["feed"];
  const todo = new Set(poleNodes.map((p) => p.id));
  while (todo.size) {
    let best: { a: string; n: FactoryPole; cost: number } | null = null;
    for (const id of todo) {
      const n = poleById.get(id)!;
      for (const a of inTree) {
        const internal = isInternal(a, n);
        const d = dist(n, nodeById.get(a)!);
        // Les poteaux d'une même file de module restent reliés entre eux (déjà à portée).
        const cost = (internal ? -1e6 : relaysFor(d, n.load).cost + d * 0.5) + (a === "feed" ? 0 : upstream(a, n.load));
        if (!best || cost < best.cost) best = { a, n, cost };
      }
    }
    const { a, n } = best!;
    parent.set(n.id, a);
    sub.set(n.id, n.load);
    for (let u = a; u !== "feed"; u = parent.get(u)!) sub.set(u, sub.get(u)! + n.load);
    inTree.push(n.id);
    todo.delete(n.id);
  }
  // Modèles et câbles définitifs.
  const links: FactoryCable[] = [];
  let upgraded = 0;
  for (const p of poleNodes) {
    const t = typeFor(own.get(p.id)!, sub.get(p.id)!);
    if (t.id !== p.type.id) {
      p.type = t;
      upgraded++;
    }
    const a = parent.get(p.id)!;
    const internal = isInternal(a, p);
    const d = dist(p, nodeById.get(a)!);
    const r = internal ? { n: 0, type: p.type } : relaysFor(d, sub.get(p.id)!);
    links.push({ from: nodeById.get(a)!, to: p, d, relays: r.n, relayType: r.type, load: sub.get(p.id)!, lines: Math.max(1, Math.ceil(sub.get(p.id)! / strongest.capacityMFps - 1e-9)), internal });
  }
  progress(1, "Terminé");
  return {
    W,
    H,
    boxes: boxes.map((b) => ({ key: b.key, machine: b.machine, label: b.label, sub: b.sub, x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot, col: b.col, mod: b.mod, power: b.power })),
    cells: grid.cells,
    nets,
    netCells,
    glued,
    problems,
    poleNodes,
    links,
    feed,
    passagesKept,
    full,
    CLRused,
    stats: {
      pipeCells,
      allPipeCells,
      crossings,
      allCrossings: pipeList.filter((o) => o.kind === "tuyau" && o.cross).length + (through ? 0 : moduleCrossings),
      total: boxes.reduce((s, b) => s + b.power, 0),
      relays: links.reduce((s, l) => s + l.relays, 0),
      upgraded,
      overloaded: links.filter((l) => l.lines > 1).length,
      polesCost: poleNodes.reduce((s, p) => s + price(p.type), 0) + links.reduce((s, l) => s + l.relays * price(l.relayType), 0),
      modulesCost: boxes.reduce((s, b) => s + (b.mod?.cost ?? 0), 0),
      keptPoles,
      newPoles,
    },
    debug: { tries: tries.map((t) => `${t.area} ${t.pipes} CLR${t.CLR} w${t.wDist} ${t.bySize}${t.problems ? ` (${t.problems} non tracées)` : ""}`), passages: passLog, taps: tapLog },
  };
}

/** La parcelle du joueur : l'usine y tient, y tient en tournant d'un quart de tour, ou n'y tient pas. */
export function factoryFits(f: Pick<FactoryPlan, "W" | "H">, plot: { w: number; h: number }): "oui" | "tourné" | "non" {
  if (f.W <= plot.w && f.H <= plot.h) return "oui";
  if (f.H <= plot.w && f.W <= plot.h) return "tourné";
  return "non";
}
