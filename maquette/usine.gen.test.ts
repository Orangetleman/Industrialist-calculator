// Générateur de la maquette « Usine entière » (E4b), lancé par `npm run maquette` (hors des tests).
// Vrai calcul figé (Crankshaft 60/min), vrais modules, placement serré sur la grille (plusieurs essais
// puis tassement), tuyaux par le vrai routeur, réseau électrique orienté avec la capacité des poteaux
// (somme des nœuds). Écrit maquette/usine.html : déplacement, zoom, survol, sélection au clic.
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import itemsJson from "../data/items.json";
import machinesJson from "../data/machines.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import energyJson from "../data/energy.json";
import overridesJson from "../data/overrides.json";
import portsJson from "../data/ports.json";
import logisticsJson from "../data/logistics.json";
import powerJson from "../data/power.json";
import relevesJson from "../data/releves.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import type { LogisticsFile, PortsEntry, PortsFile, PowerFile } from "../src/engine/extension-types.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { solve } from "../src/engine/solve.ts";
import { buildCatalog, pipeFor, type Catalog } from "../src/engine/build/catalog.ts";
import { alternatives, designModule, passageOptions, passageText, redesign, requestFromStep, type ModulePlan, type ModuleRequest } from "../src/engine/build/module.ts";
import { OPPOSITE, STEP, type Dir } from "../src/engine/build/geometry.ts";
import { Grid, route } from "../src/engine/build/route.ts";

const PORTS = (portsJson as unknown as PortsFile).machines;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles, 2);
const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()) };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");
const mf = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(".", ",")} MMF/s` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".", ",")} kMF/s` : `${Math.round(n)} MF/s`);
const PALETTE = ["#f0913a", "#6cc792", "#8fb8d6", "#e3b25a", "#d77fd0", "#5fd4d4", "#ff8a80", "#c5d86d", "#b39ddb", "#ffcc80"];
const PLOT = { w: 160, h: 110 };
type Pole = Catalog["poles"][number];
type Pt = { x: number; y: number };
type Box = { key: string; label: string; sub: string; w: number; h: number; x: number; y: number; col: number; mod: ModulePlan | null; placed: boolean; power: number; variants: ModulePlan[]; rot: number; req: ModuleRequest | null; entry: PortsEntry | null; size: { w: number; l: number } | null };

/** Le module tourné d'un quart de tour (sens horaire) : tous les bâtiments ont 4 rotations en jeu. */
const TURN: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };
function turnModule(m: ModulePlan): ModulePlan {
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
type Plug = Pt & { key: string; load: number };
type PNode = Pt & { id: string; type: Pole; plugs: Plug[]; load: number; module?: string };

function modules() {
  const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
  const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
  const maxD = Math.max(...plan.steps.map((s) => s.depth));
  const boxes: Box[] = plan.steps.map((s) => {
    const m = data.machines.get(s.machine)!;
    const req = requestFromStep(s as never, (id) => !!data.items.get(id)?.isFluid, m.cost);
    const mod = req ? designModule({ ...req, priority: ["forme", "place", "prix", "pieces"] }, PORTS[m.id] ?? null, m.size, cat, name) : null;
    return { key: s.key, label: `${s.machineKind === "farm" ? "≈ " : ""}${s.machines} × ${name(s.machine)}`, sub: name(s.item), w: mod?.width ?? 12, h: mod?.height ?? 12, x: 0, y: 0, col: maxD - s.depth, mod, placed: false, power: Math.max(0, s.energyAvg ?? 0), variants: mod ? [mod, turnModule(mod), turnModule(turnModule(mod)), turnModule(turnModule(turnModule(mod)))] : [], rot: 0, req: req ? { ...req, priority: ["forme", "place", "prix", "pieces"] } : null, entry: PORTS[m.id] ?? null, size: m.size };
  });
  return { plan, boxes, name };
}

// `widen` (usine entière) : un passage du collecteur central qui élargit son module est permis (option).
function design(glue: boolean, globalPoles: boolean, full = false, room = 0, widen = false) {
  const { plan, boxes, name } = modules();
  const byKey = new Map(boxes.map((b) => [b.key, b]));
  const endOf = (b: Box, item: string, role: "entrée" | "sortie") => b.mod?.nets.find((n) => n.role === role && name(n.item) === name(item))?.end ?? null;
  const anchorAbs = (b: Box, end: { x: number; y: number; dir: Dir }) => ({ x: b.x + end.x + STEP[end.dir].x, y: b.y + end.y + STEP[end.dir].y });
  const producers = (k: string) => plan.edges.filter((e) => e.to === k && !e.loop).map((e) => ({ e, p: byKey.get(e.from)! }));

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
  type Rect = { x0: number; y0: number; x1: number; y1: number };
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
      plan.edges
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
        const curW = Math.max(...others.map((o) => o.x + o.w));
        const curH = Math.max(...others.map((o) => o.y + o.h));
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
      if (glue && prods.length === 1 && plan.edges.filter((e) => e.from === prods[0]!.e.from).length === 1) {
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
      const links = plan.edges
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
  let nets: { id: string; item: string; perMin: number; from: string; to: string[] }[] = [];
  let problems: string[] = [];
  let W = 0;
  let H = 0;
  let CLRused = 0;
  // Tuyaux entre modules : de la sortie (unique) de chaque module vers l'entrée de ses clients.
  // Liaison à départs multiples (A*) : d'une case du réseau `from` (sans prendre de liaison déjà prise) vers une
  // case du réseau `to` ; croisements à angle droit, et cases de port traversées en travers du port seulement.
  // Cases à l'intérieur d'un module : on peut y passer (entre les machines), mais on préfère les couloirs.
  let inside = new Set<string>();
  // Liaison à départs multiples (A*) : d'une case de `from` (par un côté libre) vers une case de `to` ;
  // croisements à angle droit. Renvoie les cases du chemin posé, ou null.
  const connect = (net: string, from: Set<string>, to: Set<string>, bounds: { x0: number; y0: number; x1: number; y1: number }): string[] | null => {
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
  const turnCell = (p: Pt, w: number, h: number, r: number) => {
    let q = p;
    let [ww, hh] = [w, h];
    for (let k = 0; k < r; k++) {
      q = { x: hh - 1 - q.y, y: q.x };
      [ww, hh] = [hh, ww];
    }
    return q;
  };
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
  const routeTaps = (edges0: typeof plan.edges, bounds: { x0: number; y0: number; x1: number; y1: number }) => {
    const k0 = (e: (typeof plan.edges)[number]) => `${e.from}>${e.to}:${e.item}`;
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
      tapLog.push(`${name(e.item)} ${e.from}->${e.to} : ${path.length} cases ajoutées ; écart des collecteurs ${rectGap(collRect(p, e.item, "sortie"), collRect(c, e.item, "entrée"))} (${JSON.stringify(collRect(p, e.item, "sortie"))} / ${JSON.stringify(collRect(c, e.item, "entrée"))}) ; écart entre modules ${Math.max(0, Math.max(p.x, c.x) - Math.min(p.x + p.w, c.x + c.w)) + Math.max(0, Math.max(p.y, c.y) - Math.min(p.y + p.h, c.y + c.h))}`);
      // Les clients suivants se branchent sur le tuyau sorti du module, jamais sur le collecteur.
      if (!exits.has(id)) exits.set(id, new Set(path));
      else for (const k of path) exits.get(id)!.add(k);
    }
  };
  let failedEdges: string[] = [];
  // `through` (usine entière) : les tuyaux entre modules peuvent passer entre les machines d'un module et
  // croiser ses collecteurs à angle droit ; sinon, ils contournent chaque module entier.
  let through = false;
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
    const edges = plan.edges.filter((e) => !glued.includes(`${e.from}>${e.to}`));
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
  const attempt = (CLR: number, wDist: number, bySize: boolean) => {
    glued = place(CLR, wDist, bySize);
    CLRused = CLR;
    const M = 3;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    for (const b of boxes) [b.x, b.y] = [b.x + M - minX, b.y + M - minY];
    W = Math.max(...boxes.map((b) => b.x + b.w)) + M;
    H = Math.max(...boxes.map((b) => b.y + b.h)) + M;
    routeBetween();
    const fits = (W <= PLOT.w && H <= PLOT.h) || (H <= PLOT.w && W <= PLOT.h);
    return { area: W * H, pipes: [...grid.cells.values()].filter((o) => o.kind === "tuyau").length, fits };
  };
  // Parmi les essais entièrement raccordés : le meilleur compromis surface / longueur des tuyaux.
  // Le gagnant est refait pour retrouver ses tuyaux.
  const tries: { area: number; pipes: number; fits: boolean; CLR: number; wDist: number; bySize: boolean }[] = [];
  for (const CLR of [2, 3])
    for (const wDist of [3, 8, 15, 30])
      for (const bySize of [false, true]) {
        const r = attempt(CLR, wDist, bySize);
        if (!problems.length) tries.push({ ...r, CLR, wDist, bySize });
      }
  const minArea = Math.min(...tries.map((t) => t.area));
  if (process.env.ESSAIS) writeFileSync(process.env.ESSAIS + (globalPoles ? "g" : "m") + (glue ? "c" : "t") + ".txt", tries.map((t) => `${t.area} ${t.pipes} CLR${t.CLR} w${t.wDist} ${t.bySize}`).join(String.fromCharCode(10)));
  void minArea;
  // Une case de tuyau compte comme 10 cases de surface : un peu plus de place plutôt que des détours.
  // D'abord ceux qui tiennent sur la parcelle.
  const pool = tries.some((t) => t.fits) ? tries.filter((t) => t.fits) : tries;
  const bestTry = [...pool].sort((a, b) => a.area + 10 * a.pipes - (b.area + 10 * b.pipes))[0];
  if (bestTry) attempt(bestTry.CLR, bestTry.wDist, bestTry.bySize);
  // ------------------------------------------------------------ recalcul complet du tuyautage
  // Option « recalculé pour l'usine entière » : chaque module simple est refait avec des collecteurs sans bout
  // imposé (du premier au dernier port) ; l'usine y raccorde un seul tuyau par ressource, au meilleur endroit.
  // Les modules repliés gardent leur tuyau principal, sur lequel se fait la prise unique.
  const passagesKept = new Map<string, string>(); // module → passage gardé (texte)
  if (full) {
    for (const b of boxes) {
      if (!b.mod || !b.req) continue;
      const base = b.variants[0]!;
      if (base.folds > 1) continue;
      const ends = Object.fromEntries(base.nets.map((n) => [n.item, "milieu" as const]));
      const r = redesign(base, { ...b.req, ends }, b.entry, b.size, cat, name);
      if (!r || r.width !== base.width || r.height !== base.height) continue;
      b.variants = [r, turnModule(r), turnModule(turnModule(r)), turnModule(turnModule(turnModule(r)))];
      b.mod = b.variants[b.rot]!;
    }
    // Modules repliés : chaque tuyau principal (où se fera la prise) passe du côté de ses partenaires.
    useCollectors = true;
    const sideTrunks = () => {
      for (const b of boxes) {
        if (!b.mod || !b.req || b.variants[0]!.folds <= 1) continue;
        const base = b.variants[0]!;
        const ends: Record<string, "début" | "fin"> = {};
        for (const n of base.nets) {
          const partners = plan.edges
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
        const r = redesign(base, { ...b.req, ends }, b.entry, b.size, cat, name);
        if (!r || r.width !== base.width || r.height !== base.height) continue;
        b.variants = [r, turnModule(r), turnModule(turnModule(r)), turnModule(turnModule(turnModule(r)))];
        b.mod = b.variants[b.rot]!;
      }
    };
    // Modules simples : parmi leurs dispositions internes de même taille, celle qui rapproche le plus leurs
    // collecteurs de ceux de leurs partenaires (et coûte peu en tuyaux et croisements internes).
    const alts = new Map<string, ModulePlan[]>();
    for (const b of boxes) {
      if (!b.mod || !b.req || b.variants[0]!.folds > 1) continue;
      const ends = Object.fromEntries(b.variants[0]!.nets.map((n) => [n.item, "milieu" as const]));
      alts.set(b.key, [b.variants[0]!, ...alternatives(b.variants[0]!, { ...b.req, ends }, b.entry, b.size, cat, name)]);
    }
    if (process.env.ESSAIS) writeFileSync(process.env.ESSAIS + "alts.txt", [...alts].map(([k, l]) => `${k}: ${l.length} (${l.map((m) => `${m.width}x${m.height}`).slice(0, 4).join(" ")}) base ${byKey.get(k)!.variants[0]!.width}x${byKey.get(k)!.variants[0]!.height} cfg ${JSON.stringify({ ...byKey.get(k)!.variants[0]!.config, assign: undefined })}`).join(String.fromCharCode(10)));
    const setVariant = (b: Box, m: ModulePlan) => {
      b.variants = [m, turnModule(m), turnModule(turnModule(m)), turnModule(turnModule(turnModule(m)))];
      b.mod = b.variants[b.rot]!;
    };
    const chooseAlts = () => {
      for (const b of boxes) {
        const list = alts.get(b.key);
        if (!list || list.length < 2) continue;
        const score = () =>
          10 *
            plan.edges
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
      const dist = () => plan.edges.filter((e) => !e.loop).reduce((t, e) => t + rectGap(collRect(byKey.get(e.from)!, e.item, "sortie"), collRect(byKey.get(e.to)!, e.item, "entrée")), 0);
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
    {
      const M = 3;
      const minX = Math.min(...boxes.map((b) => b.x));
      const minY = Math.min(...boxes.map((b) => b.y));
      for (const b of boxes) [b.x, b.y] = [b.x + M - minX, b.y + M - minY];
      W = Math.max(...boxes.map((b) => b.x + b.w)) + M;
      H = Math.max(...boxes.map((b) => b.y + b.h)) + M;
    }
    through = true;
    routeBetween();
    // Double rangée : le collecteur central peut sortir par un passage entre deux machines. À placement égal
    // (l'usine ne grandit pas), chaque passage est essayé, seul ou avec un second passage dans le même module ;
    // il est gardé s'il raccourcit les tuyaux sans ajouter de croisement. Un passage qui élargit son module
    // n'est permis qu'en option (`widen`), s'il tient encore à sa place.
    const tally = () => {
      const cells = [...grid.cells.values()].filter((o) => o.kind === "tuyau");
      return { ok: !problems.length, pipes: cells.length, cross: cells.filter((o) => o.kind === "tuyau" && o.cross).length };
    };
    let cur = tally();
    const passLog: string[] = [];
    type Opt = ReturnType<typeof passageOptions>[number];
    for (const b of boxes) {
      if (!b.mod || !b.req || b.variants[0]!.folds > 1 || b.variants[0]!.template !== "double rangée") continue;
      const req = b.req;
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
        .flatMap((m) => passageOptions(m, { ...req, ends }, b.entry, b.size, cat, name))
        .filter((o) => {
          const k = JSON.stringify([o.item, o.passage, o.plan.config, o.plan.width, o.plan.height, o.plan.pieces.length]);
          return !seen.has(k) && !!seen.add(k);
        });
      const tried = singles.map((o) => trial([o])).filter((t): t is NonNullable<typeof t> => !!t);
      // Les plus prometteurs (moins de tuyaux) avec un second passage, pour une autre ressource.
      for (const t of tried.filter((x) => x.r.pipes < cur.pipes).sort((x, y) => x.r.pipes - y.r.pipes).slice(0, 3)) {
        const first = t.os[0]!;
        for (const o of passageOptions(first.plan, { ...req, ends, passages: { [first.item]: first.passage } }, b.entry, b.size, cat, name).filter((x) => x.item !== first.item)) {
          const u = trial([first, o]);
          if (u) tried.push(u);
        }
      }
      const best = tried.filter((x) => x.r.pipes < cur.pipes && x.r.cross <= cur.cross).sort((x, y) => x.r.pipes - y.r.pipes || x.r.cross - y.r.cross)[0];
      if (!best) continue;
      setVariant(b, best.os.at(-1)!.plan);
      [b.w, b.h] = [b.mod!.width, b.mod!.height];
      cur = best.r;
      passagesKept.set(b.key, label(best.os, best.wider));
    }
    routeBetween();
    if (process.env.ESSAIS) writeFileSync(process.env.ESSAIS + `passages${widen ? "-x" : ""}.txt`, passLog.join(String.fromCharCode(10)));
  }
  const modulePipeCells = boxes.reduce((t, b) => t + (b.mod?.pieces.length ?? 0), 0);
  const moduleCrossings = boxes.reduce((t, b) => t + (b.mod?.pieces.filter((pc) => pc.role === "croisement").length ?? 0), 0);
  const interIds = new Set(nets.map((n) => n.id));
  const isInter = (o: { net: string; cross?: { net: string } }) => interIds.has(o.net) || (!!o.cross && interIds.has(o.cross.net));
  const allPipeCells = [...grid.cells.values()].filter((o) => o.kind === "tuyau").length + (through ? 0 : modulePipeCells);
  const color = new Map([...new Set(plan.edges.map((e) => e.item))].map((it, i) => [it, PALETTE[i % PALETTE.length]!]));
  const cellsOf = (id: string) => [...grid.cells.values()].filter((o) => o.kind === "tuyau" && (o.net === id || o.cross?.net === id)).length;
  const crossings = [...grid.cells.values()].filter((o) => o.kind === "tuyau" && o.cross && isInter(o)).length;
  const pipeCells = [...grid.cells.values()].filter((o) => o.kind === "tuyau" && isInter(o)).length;

  // ------------------------------------------------------------ réseau électrique
  const plugs: Plug[] = [];
  const plugsByMachine = new Map<string, Plug[]>(); // `${module}|${machine}` → ses prises
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
  const cover = (list: Plug[], tag: string): PNode[] => {
    let bestSet: { nodes: PNode[]; cost: number } | null = null;
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
      const nodes: PNode[] = [];
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
  let poleNodes: PNode[] = [];
  let keptPoles = 0;
  let newPoles = 0;
  if (globalPoles) poleNodes = cover(plugs, "p");
  else {
    // Les poteaux de chaque module ; en mode complet, on garde ceux qu'aucun tuyau ne traverse, et on
    // recouvre seulement les prises des poteaux retirés.
    const uncovered: Plug[] = [];
    for (const b of boxes) {
      if (!b.mod) continue;
      for (const [i, q] of b.mod.poles.entries()) {
        const type = cat.poles.find((t) => t.id === q.pole)!;
        const ps = q.covers.flatMap((m) => plugsByMachine.get(`${b.key}|${m}`) ?? []);
        let hit = false;
        for (let a = 0; a < q.w && !hit; a++) for (let c = 0; c < q.h && !hit; c++) if (grid.get({ x: b.x + q.x + a, y: b.y + q.y + c })?.kind === "tuyau") hit = true;
        if (hit) {
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
  /** Modèle d'un poteau qui porte `load` : le sien s'il suffit, sinon le moins cher qui suffit. */
  const typeFor = (own: Pole, load: number) => (own.capacityMFps >= load ? own : ([...poleTypes].filter((t) => t.capacityMFps >= load).sort((a, b) => price(a) - price(b))[0] ?? strongest));
  const strongest = cat.poles.reduce((a, b) => (b.capacityMFps > a.capacityMFps ? b : a));
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
  type Link = { from: Pt & { id: string }; to: PNode; d: number; relays: number; relayType: Pole; load: number; lines: number; internal: boolean };
  const own = new Map(poleNodes.map((p) => [p.id, p.type]));
  const parent = new Map<string, string>(); // poteau → son amont ("feed" pour l'arrivée)
  const sub = new Map<string, number>(); // charge portée par chaque poteau (lui et son aval)
  const nodeById = new Map<string, Pt & { id: string }>([["feed", { ...feed, id: "feed" }], ...poleNodes.map((p) => [p.id, p] as [string, PNode])]);
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const isInternal = (a: string, n: PNode) => !!n.module && a.startsWith(`${n.module}#`);
  // Surcoût d'ajouter `extra` de charge à partir de `a` jusqu'à l'arrivée (renforts et relais en amont).
  const upstream = (a: string, extra: number) => {
    let cost = 0;
    for (let u = a; u !== "feed"; u = parent.get(u)!) {
      const t0 = own.get(u)!;
      cost += price(typeFor(t0, sub.get(u)! + extra)) - price(typeFor(t0, sub.get(u)!));
      const pu = parent.get(u)!;
      if (!isInternal(pu, poleNodes.find((p) => p.id === u)!)) {
        const d = dist(nodeById.get(u)!, nodeById.get(pu)!);
        cost += relaysFor(d, sub.get(u)! + extra).cost - relaysFor(d, sub.get(u)!).cost;
      }
    }
    return cost;
  };
  const inTree = ["feed"];
  const todo = new Set(poleNodes.map((p) => p.id));
  while (todo.size) {
    let best: { a: string; n: PNode; cost: number } | null = null;
    for (const id of todo) {
      const n = poleNodes.find((p) => p.id === id)!;
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
  const links: Link[] = [];
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
  const overloaded = links.filter((l) => l.lines > 1).length;
  const relays = links.reduce((s, l) => s + l.relays, 0);
  const cellsOfNet = (id: string) => [...grid.cells.values()].filter((o) => o.kind === "tuyau" && (o.net === id || o.cross?.net === id)).length;
  const total = boxes.reduce((s, b) => s + b.power, 0);
  const polesCost = poleNodes.reduce((s, p) => s + price(p.type), 0) + links.reduce((s, l) => s + l.relays * price(l.relayType), 0);
  const modulesCost = boxes.reduce((s, b) => s + (b.mod?.cost ?? 0), 0);
  if (process.env.ESSAIS && full) {
    const lines: string[] = [];
    for (const e of plan.edges) {
      const p = byKey.get(e.from)!;
      const c = byKey.get(e.to)!;
      const a = endOf(p, e.item, "sortie");
      const z = endOf(c, e.item, "entrée");
      const A = a ? { x: p.x + a.x + STEP[a.dir].x, y: p.y + a.y + STEP[a.dir].y, d: a.dir } : null;
      const Z = z ? { x: c.x + z.x + STEP[z.dir].x, y: c.y + z.y + STEP[z.dir].y, d: z.dir } : null;
      const man = A && Z ? Math.abs(A.x - Z.x) + Math.abs(A.y - Z.y) : -1;
      lines.push(`${name(e.item)} ${e.from}->${e.to} | sortie ${JSON.stringify(A)} entrée ${JSON.stringify(Z)} | manhattan ${man} | cases réseau ${cellsOfNet(`${e.from}:${e.item}`)} | prod box ${p.x},${p.y} ${p.w}x${p.h} rot${p.rot} f${p.mod?.folds} | cons box ${c.x},${c.y} ${c.w}x${c.h} rot${c.rot} f${c.mod?.folds}`);
    }
    writeFileSync(process.env.ESSAIS + "liens.txt", [...lines, "--- prises", ...tapLog].join(String.fromCharCode(10)));
  }
  return { plan, boxes, grid, nets, W, H, color, pipeCells, crossings, modulesCost, glued, problems, name, cellsOf, links, relays, poleNodes, feed, total, overloaded, polesCost, CLRused, upgraded, plugs, full, allPipeCells, keptPoles, newPoles, passagesKept, allCrossings: [...grid.cells.values()].filter((o) => o.kind === "tuyau" && o.cross).length + (through ? 0 : moduleCrossings) };
}

type D = ReturnType<typeof design>;

function svg(d: D, uid: string): string {
  const C = 10;
  const VW = Math.max(d.W, PLOT.w) + 2;
  const VH = Math.max(d.H, PLOT.h) + 2;
  let s = `<svg viewBox="0 0 ${VW * C} ${VH * C}" xmlns="http://www.w3.org/2000/svg" data-w="${VW * C}" data-h="${VH * C}">`;
  s += `<defs><marker id="pa-${uid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ffd54a"/></marker>
<marker id="pb-${uid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c9a83a"/></marker>
<pattern id="g1-${uid}" width="${C}" height="${C}" patternUnits="userSpaceOnUse"><path d="M${C} 0 L0 0 0 ${C}" fill="none" stroke="#262c33" stroke-width="1"/></pattern>
<pattern id="g10-${uid}" width="${C * 10}" height="${C * 10}" patternUnits="userSpaceOnUse"><rect width="${C * 10}" height="${C * 10}" fill="url(#g1-${uid})"/><path d="M${C * 10} 0 L0 0 0 ${C * 10}" fill="none" stroke="#323a43" stroke-width="1.5"/></pattern></defs>`;
  s += `<rect width="${VW * C}" height="${VH * C}" fill="#1d2126"/><rect width="${VW * C}" height="${VH * C}" fill="url(#g10-${uid})"/>`;
  s += `<rect class="plot" x="0" y="0" width="${PLOT.w * C}" height="${PLOT.h * C}" data-tip="Ta parcelle (exemple : ${PLOT.w} × ${PLOT.h} cases)"/><text class="plot-t" x="${PLOT.w * C - 10}" y="${PLOT.h * C - 10}">parcelle ${PLOT.w} × ${PLOT.h}</text>`;
  s += `<rect class="bbox" x="0" y="0" width="${d.W * C}" height="${d.H * C}"/><text class="bbox-t" x="${d.W * C - 8}" y="${d.H * C + 16}">usine ${d.W} × ${d.H}</text>`;
  for (const b of d.boxes) {
    const farm = !b.mod;
    const tip = `${b.sub} — ${b.label}${b.mod ? ` : module de ${b.w} × ${b.h} cases${b.mod.folds > 1 ? ` en ${b.mod.folds} blocs` : ""}${d.passagesKept.get(b.key) ? ` ; ${d.passagesKept.get(b.key)}` : ""}, ${fr(b.mod.cost)} $, consomme ${mf(b.power)}` : " : arbres, pas encore dessinés (emplacement réservé)"}`;
    s += `<g class="mod" data-tip="${esc(tip)}"><rect x="${b.x * C}" y="${b.y * C}" width="${b.w * C}" height="${b.h * C}" rx="6" class="${farm ? "farm" : "box"}"/>`;
    if (b.mod) {
      s += `<g class="detail">`;
      for (const m of b.mod.machines) s += `<rect x="${(b.x + m.x) * C + 1}" y="${(b.y + m.y) * C + 1}" width="${m.w * C - 2}" height="${m.h * C - 2}" rx="2" class="mach"/>`;
      for (const p of b.mod.pieces) {
        const cx = (b.x + p.x + 0.5) * C;
        const cy = (b.y + p.y + 0.5) * C;
        const item = (net: string) => b.mod!.nets.find((n) => n.id === net)?.item ?? "";
        for (const [net, links] of [[p.net, p.links], ...(p.crossNet ? [[p.crossNet, p.crossLinks ?? []]] : [])] as [string, Dir[]][])
          for (const dd of links) s += `<line x1="${cx}" y1="${cy}" x2="${cx + (STEP[dd].x * C) / 2}" y2="${cy + (STEP[dd].y * C) / 2}" stroke="${d.color.get(item(net)) ?? "#9aa7b4"}" stroke-width="${b.mod!.nets.find((n) => n.id === net)?.pipe?.tier === 3 ? 4 : 2.2}"/>`;
      }
      s += `</g>`;
    }
    const fs = Math.max(5, Math.min(20, ((b.w * C) / Math.max(b.sub.length, b.label.length * 0.62)) * 1.25, (b.h * C) / 4.2));
    const cx = (b.x + b.w / 2) * C;
    const cy = (b.y + b.h / 2) * C;
    s += `<g class="lbl"><text x="${cx}" y="${cy - fs * 0.25}" font-size="${fs.toFixed(1)}" class="t1">${esc(b.sub)}</text><text x="${cx}" y="${cy + fs * 0.95}" font-size="${(fs * 0.62).toFixed(1)}" class="t2">${esc(b.label)}</text><text x="${cx}" y="${cy + fs * 1.75}" font-size="${(fs * 0.55).toFixed(1)}" class="t2">${b.mod ? `${b.w} × ${b.h}${b.mod.folds > 1 ? ` · ${b.mod.folds} blocs` : ""}` : "taille à calculer"}</text></g></g>`;
  }
  // Tuyaux entre modules, groupés par liaison.
  const byNet = new Map<string, string>();
  for (const [k, o] of d.grid.cells) {
    if (o.kind !== "tuyau") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    const cx = (x + 0.5) * C;
    const cy = (y + 0.5) * C;
    for (const [net, links] of [[o.net, o.links], ...(o.cross ? [[o.cross.net, o.cross.links]] : [])] as [string, Set<Dir>][]) {
      let t = byNet.get(net) ?? "";
      for (const dd of links) t += `M${cx},${cy} L${cx + (STEP[dd].x * C) / 2},${cy + (STEP[dd].y * C) / 2} `;
      byNet.set(net, t);
    }
  }
  for (const n of d.nets) {
    const from = d.boxes.find((b) => b.key === n.from)!;
    const dest = n.to.length ? n.to.map((t) => d.boxes.find((b) => b.key === t)!.sub).join(" et ") : "la sortie de l'usine";
    const tip = `${d.name(n.item)}${n.perMin ? ` · ${fr(n.perMin)}/min` : ""} — de ${from.sub} (${from.label}) vers ${dest} · ${d.cellsOf(n.id)} cases de tuyau${d.full ? ", collecteurs des modules compris" : ""}`;
    const tier = pipeFor(cat, data.items.get(n.item)?.isFluid ? "fluide" : "objet", n.perMin / 60)?.tier ?? 3;
    s += `<g class="net${tier === 3 ? " t3" : ""}" data-sel="${esc(n.id)}" data-tip="${esc(`${tip} · tier ${tier === 3 ? "III" : "I"}`)}"><path class="net-hit" d="${byNet.get(n.id) ?? ""}"/><path class="net-line" d="${byNet.get(n.id) ?? ""}" stroke="${d.color.get(n.item)}"/></g>`;
  }
  for (const [k, o] of d.grid.cells) {
    if (o.kind !== "tuyau" || !o.cross) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    s += `<rect class="xing" x="${(x + 0.5) * C - 4}" y="${(y + 0.5) * C - 4}" width="8" height="8" rx="1.5" data-tip="Croisement : ${esc(d.name(d.nets.find((n) => n.id === o.net)?.item ?? ""))} / ${esc(d.name(d.nets.find((n) => n.id === o.cross!.net)?.item ?? ""))}"/>`;
  }
  for (const g of d.glued) {
    const [from, to] = g.split(">");
    const p = d.boxes.find((b) => b.key === from)!;
    const e = d.plan.edges.find((x) => x.from === from && x.to === to)!;
    const out = p.mod!.nets.find((n) => n.role === "sortie" && d.name(n.item) === d.name(e.item))!.end!;
    s += `<circle class="contact" cx="${(p.x + out.x + 1) * C}" cy="${(p.y + out.y + 0.5) * C}" r="7" fill="${d.color.get(e.item)}" data-tip="Contact direct : ${esc(d.name(e.item))}, ${fr(e.perMin)}/min, sans tuyau"/>`;
  }
  // Réseau électrique : câbles poteau → machine (avec « Tout afficher » et l'option), câbles entre poteaux
  // (ceux d'un même module seulement avec « Tout afficher »), poteaux, arrivée.
  s += `<g class="power">`;
  for (const p of d.poleNodes)
    for (const q of p.plugs) s += `<line class="plugline" x1="${p.x * C}" y1="${p.y * C}" x2="${q.x * C}" y2="${q.y * C}" marker-end="url(#pb-${uid})"/>`;
  for (const l of d.links) {
    const to = d.boxes.find((b) => b.key === (l.to.module ?? l.to.plugs[0]?.key))!;
    const tip = `${l.internal ? "Câble entre deux poteaux du module" : "Câble"} vers ${l.to.module ? to.sub : `un poteau (${l.to.plugs.length} prise${l.to.plugs.length > 1 ? "s" : ""})`} : porte ${mf(l.load)} (tout ce qui est en aval) ; un ${l.to.type.name} porte ${mf(l.to.type.capacityMFps)} (tous ses nœuds)${l.lines > 1 ? ` : ${l.lines} lignes en parallèle` : ""}${l.relays ? ` · ${l.relays} relais ${l.relayType.name} (portée ${l.relayType.rangeCells} cases)` : ""}`;
    s += `<g class="cable${l.internal ? " internal" : ""}${l.lines > 1 ? " over" : ""}" data-sel="c${esc(l.to.id)}" data-tip="${esc(tip)}"><line class="cable-hit" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}"/><line class="cable-line" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}" marker-end="url(#pa-${uid})"/></g>`;
  }
  for (const p of d.poleNodes) s += `<rect class="pole" x="${(p.x - p.type.size.w / 2) * C}" y="${(p.y - p.type.size.h / 2) * C}" width="${p.type.size.w * C}" height="${p.type.size.h * C}" data-tip="${esc(`${p.type.name} : ${p.plugs.length} prise(s), ${mf(p.load)} sur ${mf(p.type.capacityMFps)} (tous ses nœuds)`)}"/>`;
  s += `<circle cx="${d.feed.x * C}" cy="${d.feed.y * C}" r="9" class="feed" data-tip="Arrivée du réseau électrique (${mf(d.total)} pour toute l'usine)"/>`;
  s += `</g>`;
  return s + "</svg>";
}

it("maquette usine", () => {
  const V = { tm: design(false, false), gm: design(true, false), f: design(false, false, true) };
  const sum = (d: D) => {
    const fit = d.W <= PLOT.w && d.H <= PLOT.h ? ["ok", "tient sur ta parcelle"] : d.H <= PLOT.w && d.W <= PLOT.h ? ["ok", "tient en tournant d'un quart de tour"] : ["warn", "ne tient pas sur ta parcelle"];
    return `<b>${d.W} × ${d.H} cases</b> · <span class="${fit[0]}">${fit[1]}</span> <span class="hint">(${PLOT.w} × ${PLOT.h}, exemple)</span> · tuyaux : ${d.full ? `${fr(d.allPipeCells)} cases en tout` : `${d.pipeCells} cases entre modules, ${fr(d.allPipeCells)} en tout`}, ${d.allCrossings} croisements en tout${d.glued.length ? `, ${d.glued.length} contact direct` : ""} · électricité : ${mf(d.total)}, ${d.poleNodes.length} poteaux${d.full ? ` (${d.keptPoles} des modules gardés, ${d.newPoles} nouveaux)` : ""}${d.relays ? ` + ${d.relays} relais` : ""}${d.upgraded ? ` (${d.upgraded} renforcés)` : ""}, ${d.links.filter((l) => l.from.id === "feed").length} branche(s) depuis l'arrivée (la plus chargée : ${mf(Math.max(...d.links.filter((l) => l.from.id === "feed").map((l) => l.load)))}), ${fr(d.polesCost)} $${d.overloaded ? ` · <span class="warn">${d.overloaded} câble(s) à doubler</span>` : ""}${d.problems.length ? ` · <span class="warn">${d.problems.length} liaison(s) non tracée(s)</span>` : ""}${d.full ? ` · passages entre machines : ${d.passagesKept.size ? [...d.passagesKept.values()].map(esc).join(" ; ") : "aucun"}` : ""}`;
  };
  const rows = (d: D) =>
    d.nets
      .map((n) => {
        const tier = pipeFor(cat, data.items.get(n.item)?.isFluid ? "fluide" : "objet", n.perMin / 60);
        return `<tr data-sel="${esc(n.id)}"><td><i style="background:${d.color.get(n.item)}"></i>${esc(d.name(n.item))}</td><td>${esc(d.boxes.find((b) => b.key === n.from)!.sub)}</td><td>${n.to.length ? n.to.map((t) => esc(d.boxes.find((b) => b.key === t)!.sub)).join(", ") : "sortie de l'usine"}</td><td class="num">${fr(n.perMin)}/min</td><td class="num">${d.cellsOf(n.id)}</td><td>${tier ? `tier ${tier.tier === 1 ? "I" : "III"}` : "—"}</td></tr>`;
      })
      .join("");
  const block = (k: keyof typeof V) =>
    `<div class="variant v-${k}${V[k].full ? " full" : ""}"><p class="sum">${sum(V[k])}</p>
<div class="frame" tabindex="0">${svg(V[k], k)}<p class="help">Glisse pour te déplacer · molette pour zoomer · survole ou clique un tuyau, un câble, un module</p><div class="zoom"><button data-z="in" aria-label="Zoomer">+</button><button data-z="out" aria-label="Dézoomer">−</button><button data-z="fit" aria-label="Tout voir">⤢</button></div><div class="tip"></div><div class="pick" hidden></div></div>
<details><summary>Liste des liaisons (${V[k].nets.length})</summary><table><thead><tr><th>Produit</th><th>De</th><th>Vers</th><th>Débit</th><th>Cases</th><th>Tuyau</th></tr></thead><tbody>${rows(V[k])}</tbody></table></details></div>`;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Usine entière (maquette)</title>
<style>
:root { --bg:#12171c; --surface:#1b222a; --ink:#e6ebf0; --muted:#9aa7b4; --line:#34404c; --accent:#f0913a; --ok:#6cc792; --warn:#e3b25a; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, "Segoe UI", sans-serif; }
main { max-width: 1240px; margin: 0 auto; padding: 14px 16px 30px; }
h1 { font-size: 1.35rem; margin: 2px 0; } h2 { font-size: 1.05rem; margin: 18px 0 6px; }
.lead, .hint { color: var(--muted); } .hint { font-size: .84rem; }
.tag { font-size: .72rem; border: 1px solid var(--accent); color: var(--accent); border-radius: 999px; padding: 0 8px; }
.bar { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; margin: 10px 0 6px; }
.bar label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.bar .grp { display: inline-flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; padding: 4px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.bar .sub { display: none; } .show-detail .bar .sub { display: inline-flex; } .no-power .bar .sub { display: none; }
.sum { margin: 4px 0 8px; } .ok { color: var(--ok); } .warn { color: var(--warn); }
.frame { position: relative; height: min(72vh, 680px); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #1d2126; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
.frame.drag { cursor: grabbing; }
.frame svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.zoom { position: absolute; right: 10px; top: 10px; display: flex; flex-direction: column; gap: 4px; }
.zoom button { width: 34px; height: 34px; border-radius: 8px; border: 1px solid #4a525c; background: #2a3038; color: #e6ebf0; font-size: 1.1rem; cursor: pointer; }
.help { position: absolute; left: 10px; bottom: 8px; margin: 0; font-size: .78rem; color: var(--muted); pointer-events: none; }
.tip { position: absolute; pointer-events: none; max-width: 360px; padding: 6px 9px; border-radius: 8px; background: #262c33f2; border: 1px solid #4a525c; font-size: .82rem; display: none; }
.pick { position: absolute; left: 10px; right: 54px; top: 10px; padding: 8px 10px; border-radius: 10px; background: #262c33f2; border: 1px solid #ffc27a; font-size: .85rem; }
svg .box { fill: #2a3038; stroke: #4a525c; stroke-width: 2; } svg .farm { fill: #22282f; stroke: #9aa7b4; stroke-width: 2; stroke-dasharray: 8 6; }
svg .mod:hover .box, svg .mod:hover .farm { stroke: #8fb8d6; }
svg .lbl text { text-anchor: middle; pointer-events: none; } svg .t1 { fill: #e6ebf0; font-weight: 600; } svg .t2 { fill: #9aa7b4; }
svg .plot { fill: none; stroke: #6cc792; stroke-dasharray: 14 10; stroke-width: 3; } svg .plot-t { fill: #6cc792; font-size: 14px; text-anchor: end; }
svg .bbox { fill: none; stroke: #e6ebf0; stroke-dasharray: 3 5; stroke-width: 1.5; opacity: .6; pointer-events: none; } svg .bbox-t { fill: #9aa7b4; font-size: 12px; text-anchor: end; }
svg .detail { display: none; } .show-detail svg .detail { display: inline; } .show-detail svg .lbl { opacity: .35; } .show-detail svg .box { fill: #22272e; }
svg .mach { fill: #39414b; stroke: #56606b; }
svg .net-line { fill: none; stroke-width: 2.6; stroke-linecap: round; pointer-events: none; } svg .net.t3 .net-line { stroke-width: 4.6; } svg .net-hit { fill: none; stroke: transparent; stroke-width: 16; cursor: pointer; }
svg .net:hover .net-line { stroke-width: 7; }
.frame.hl svg .net:not(.on), .frame.hl svg .cable:not(.on), .frame.hl svg .plugline { opacity: .15; } svg .on .net-line { stroke-width: 7; } svg .on .cable-line { stroke-width: 4; }
svg .xing { fill: #1d2126; stroke: #e6ebf0; stroke-width: 1.4; } svg .contact { stroke: #fff; stroke-width: 2; }
svg .cable-line { stroke: #ffd54a; stroke-width: 2; stroke-dasharray: 7 5; pointer-events: none; } svg .cable-hit { stroke: transparent; stroke-width: 14; cursor: pointer; }
svg .cable:hover .cable-line { stroke-width: 4; } svg .cable.over .cable-line { stroke: #ff8a80; }
svg .cable.internal { display: none; } .show-detail svg .cable.internal { display: inline; } svg .cable.internal .cable-line { stroke-dasharray: 3 3; }
svg .plugline { display: none; stroke: #c9a83a; stroke-width: 1; opacity: .8; pointer-events: none; } .show-detail.show-plugs svg .plugline { display: inline; }
svg .pole { fill: #5a4320; stroke: #ffd54a; stroke-width: 1.2; } svg .feed { fill: #ffd54a; stroke: #1d2126; stroke-width: 3; }
.no-power svg .power { display: none; }
.variant { display: none; }
body:has(#k-mod:checked):has(#l-tubes:checked) .v-tm, body:has(#k-mod:checked):has(#l-glue:checked) .v-gm, body:has(#k-all:checked) .v-f { display: block; }
body:has(#k-all:checked) .bar .liaisons { opacity: .45; pointer-events: none; }
.full svg .detail { display: inline; } .full svg .lbl { opacity: .35; } .full svg .box { fill: #22272e; }
table { border-collapse: collapse; width: 100%; font-size: .86rem; } th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--line); }
tr[data-sel] { cursor: pointer; } tr.on td { background: #2b1f14; }
td.num { text-align: right; font-variant-numeric: tabular-nums; } td i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
details summary { cursor: pointer; color: var(--muted); margin-top: 10px; }
ol.q li { margin-bottom: 5px; }
</style></head><body><main>
<p><span class="tag">MAQUETTE v8 à valider</span></p>
<h1>Plans de pose : toute l'usine</h1>
<p><b>C'est une proposition :</b> une base pour construire, à optimiser comme tu le souhaites.</p>
<p class="lead">Calcul réel figé : Crankshaft 60/min, toute la recherche. Modules = vrais plans de pose (« forme ramassée » d'abord), placés au plus serré sur la grille ; tuyaux tracés par le vrai routeur ; poteaux comptés avec tous leurs nœuds. Parcelle : exemple.</p>
<div class="bar">
  <span class="grp"><b>Calcul</b><label><input type="radio" name="calcul" id="k-mod" checked> module par module</label><label><input type="radio" name="calcul" id="k-all"> recalculé pour l'usine entière <span class="hint">(une seule prise par collecteur, modules réorganisés vers leurs voisins, collecteur central d’une double rangée sorti entre deux machines quand ça raccourcit les tuyaux sans élargir le module, puis poteaux ; plus de calcul)</span></label></span>
  <span class="grp liaisons"><b>Liaisons</b><label><input type="radio" name="liaison" id="l-tubes" checked> des tuyaux</label><label><input type="radio" name="liaison" id="l-glue"> coller quand c'est possible</label></span>
  <span class="grp"><label><input type="checkbox" id="detail"> Tout afficher</label><label><input type="checkbox" id="power" checked> Réseau électrique</label></span>
  <span class="grp sub"><b>Câbles</b><label><input type="radio" name="cables" id="c-poles" checked> entre poteaux</label><label><input type="radio" name="cables" id="c-plugs"> et vers chaque machine</label></span>
</div>
${block("tm")}${block("gm")}${block("f")}
<h2>Notes</h2>
<ul class="hint">
<li>Portée d'un câble : la même entre deux poteaux et vers une machine ; quand le câble part d'une machine qui produit de l'électricité (générateur…), c'est la portée de cette machine (à relever).</li>
<li>Avec « Tout afficher » : câbles entre les poteaux d'un même module (pointillés courts), et, au choix, ceux vers chaque machine.</li>
</ul>
</main>
<script>
for (const frame of document.querySelectorAll(".frame")) {
  const svg = frame.querySelector("svg");
  const W = +svg.dataset.w, H = +svg.dataset.h;
  let vb = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
  const fit = () => { const r = frame.getBoundingClientRect(); if (!r.width) return; const k = Math.max(W / r.width, H / r.height) * 1.04; vb = { w: r.width * k, h: r.height * k, x: (W - r.width * k) / 2, y: (H - r.height * k) / 2 }; apply(); };
  const zoom = (f, cx, cy) => { const r = frame.getBoundingClientRect(); const px = cx === undefined ? 0.5 : (cx - r.left) / r.width, py = cy === undefined ? 0.5 : (cy - r.top) / r.height; const nw = Math.min(W * 3, Math.max(W / 40, vb.w / f)); const nh = vb.h * nw / vb.w; vb = { x: vb.x + (vb.w - nw) * px, y: vb.y + (vb.h - nh) * py, w: nw, h: nh }; apply(); };
  frame.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  let drag = null;
  frame.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; e.preventDefault(); drag = { x: e.clientX, y: e.clientY, vb: { ...vb }, moved: false, target: e.target.closest("[data-sel]") }; try { frame.setPointerCapture(e.pointerId); } catch {} });
  frame.addEventListener("pointermove", (e) => { if (!drag) return; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) { drag.moved = true; frame.classList.add("drag"); } if (!drag.moved) return; const r = frame.getBoundingClientRect(); vb = { ...drag.vb, x: drag.vb.x - (e.clientX - drag.x) * vb.w / r.width, y: drag.vb.y - (e.clientY - drag.y) * vb.h / r.height }; apply(); });
  const tip = frame.querySelector(".tip"), pick = frame.querySelector(".pick");
  const variant = frame.closest(".variant");
  let selected = null;
  const select = (id, text) => {
    for (const x of variant.querySelectorAll(".on")) x.classList.remove("on");
    selected = selected === id ? null : id;
    frame.classList.toggle("hl", !!selected);
    pick.hidden = !selected;
    if (!selected) return;
    for (const x of variant.querySelectorAll('[data-sel="' + CSS.escape(id) + '"]')) x.classList.add("on");
    pick.textContent = text;
  };
  frame.addEventListener("pointerup", () => {
    const was = drag; drag = null; frame.classList.remove("drag");
    if (!was || was.moved) return;
    if (was.target) select(was.target.dataset.sel, was.target.dataset.tip); else if (selected) select(selected, "");
  });
  for (const tr of variant.querySelectorAll("tr[data-sel]")) tr.addEventListener("click", () => { const g = frame.querySelector('[data-sel="' + CSS.escape(tr.dataset.sel) + '"]'); select(tr.dataset.sel, g?.dataset.tip ?? ""); });
  for (const b of frame.querySelectorAll("[data-z]")) b.addEventListener("click", () => b.dataset.z === "fit" ? fit() : zoom(b.dataset.z === "in" ? 1.3 : 1 / 1.3));
  frame.addEventListener("pointerover", (e) => { const t = e.target.closest("[data-tip]"); if (!t || drag?.moved) return; tip.textContent = t.dataset.tip; tip.style.display = "block"; });
  frame.addEventListener("pointerout", (e) => { if (e.target.closest("[data-tip]")) tip.style.display = "none"; });
  frame.addEventListener("pointermove", (e) => { const r = frame.getBoundingClientRect(); tip.style.left = Math.max(4, Math.min(r.width - 370, e.clientX - r.left + 14)) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px"; });
  new ResizeObserver(fit).observe(frame);
}
const sync = () => {
  document.body.classList.toggle("show-detail", document.getElementById("detail").checked);
  document.body.classList.toggle("no-power", !document.getElementById("power").checked);
  document.body.classList.toggle("show-plugs", document.getElementById("c-plugs").checked);
};
for (const id of ["detail", "power", "c-poles", "c-plugs"]) document.getElementById(id).addEventListener("change", sync);
</script>
</body></html>
`;
  writeFileSync("maquette/usine.html", html);
  const NL = String.fromCharCode(10);
  if (process.env.ESSAIS) writeFileSync(process.env.ESSAIS + "pb.txt", V.f.problems.join(NL));
  writeFileSync("maquette/usine-resume.txt", (Object.keys(V) as (keyof typeof V)[]).map((k) => `${k}: ${sum(V[k]).replace(/<[^>]+>/g, "")}`).join(NL) + NL);
}, 900_000);
