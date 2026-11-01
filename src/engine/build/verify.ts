// Vérification d'un plan de pose par le moteur du bac à sable (S56, maquette `generation-contacts.html`). Le plan est
// converti en montage (`convert.ts`), une source posée au bout de chaque collecteur d'entrée l'alimente, et le moteur
// dit ce que fait chaque machine. L'essai est rejeté si une machine ne reçoit pas tout, ou si un contact mélange des
// ressources. Pur, sans DOM.

import type { Dir, SbBlock, SbCatalog } from "../sandbox/catalog.ts";
import { computeSandbox } from "../sandbox/compute.ts";
import { orientPipes } from "../sandbox/orient.ts";
import { DIRS, DV, OPP, type Layout, type Placed } from "../sandbox/layout.ts";
import { layoutFromModule } from "../schematic/convert.ts";
import { tierOneTwin } from "./catalog.ts";
import type { ModulePlan, ModuleRequest } from "./module.ts";

/** Un collecteur à alimenter : la case de son bout, le sens vers l'extérieur, la ressource, le débit prévu (sans : illimité). */
export type Feed = { x: number; y: number; dir: Dir; item: string; perSec?: number };
/** Ce qui ne va pas, en codes courts (pour les tests et la mise au point). */
export type CheckIssue = { k: "recipe" | "short" | "mixed" | "overlap" | "cut"; at?: number; item?: string };
export type Check = { ok: boolean; issues: CheckIssue[]; result?: ReturnType<typeof computeSandbox>; layout?: Layout };

/** Id du bâtiment source d'une ressource et de son débit (n'existe que dans le catalogue de vérification). */
const srcId = (f: Pick<Feed, "item" | "perSec">) => `__source:${f.item}@${f.perSec === undefined ? "max" : Math.round(f.perSec * 1e6) / 1e6}`;

/**
 * Catalogue de vérification : celui du bac à sable, avec une source par ressource (un port de sortie au nord, débit sans
 * limite), et chaque pièce de tier III d'une case sans ports relevés prise avec la forme de la même pièce en tier I (son
 * débit reste le sien ; supposition BAS-12).
 */
const withSources = new WeakMap<SbCatalog, SbCatalog>();
function sourceCatalog(sb: SbCatalog, feeds: Pick<Feed, "item" | "perSec">[]): SbCatalog {
  let c = withSources.get(sb);
  if (!c) {
    withSources.set(sb, (c = { blocks: new Map(sb.blocks), items: sb.items }));
    for (const [id, b] of sb.blocks) {
      const twin = b.pipe && !b.geo ? tierOneTwin(id) : null;
      const geo = twin ? sb.blocks.get(twin)?.geo : null;
      if (geo) c.blocks.set(id, { ...b, geo });
    }
  }
  for (const f of feeds) {
    const id = srcId(f);
    if (c.blocks.has(id)) continue;
    const t = sb.items.get(f.item)?.fluid ? "f" : "o";
    const b: SbBlock = { id, name: f.item, tier: null, cost: 0, poll: 0, geo: { w: 1, h: 1, ports: [{ t, d: "s", s: "N", c: 1 }] }, recipes: [{ id, s: 1, in: {}, out: { [f.item]: f.perSec ?? 1e6 }, e: null }], incomplete: [] };
    c.blocks.set(b.id, b);
  }
  return c;
}

/** La recette du bac à sable qui correspond à la demande (sa sortie principale et toutes ses entrées). */
export function runFor(sb: SbCatalog, req: Pick<ModuleRequest, "machine" | "count" | "inputs" | "outputs">): Run | null {
  const main = req.outputs[0];
  // Les mêmes entrées que le plan, ni plus ni moins (sinon le moteur jugerait une autre recette).
  const r = sb.blocks.get(req.machine)?.recipes.find((x) => main !== undefined && main.item in x.out && req.inputs.every((f) => f.item in x.in) && Object.keys(x.in).every((i) => req.inputs.some((f) => f.item === i)));
  if (!r || !main) return null;
  // Part de la vitesse : ce que le plan demande à chaque machine, rapporté à ce qu'elle fait à fond, d'après sa sortie
  // principale et chacune de ses entrées ; la plus petite (le plan et la recette du bac à sable peuvent différer).
  const part = (perMin: number, q: number) => perMin / 60 / req.count / (q / r.s);
  return { recipe: r.id, need: Math.min(part(main.perMin, r.out[main.item]!), ...req.inputs.map((f) => part(f.perMin, r.in[f.item]!))) };
}

/** Ce qu'une machine doit faire : sa recette, et la part de sa vitesse que le plan lui demande (1 : à fond). */
export type Run = { recipe: string; need: number };

/**
 * Le montage, alimenté par `feeds`, avec la recette de `runs` choisie sur chaque machine de ce type. Une machine qui ne
 * reçoit rien, ou un groupe de machines (même `Run`) qui produit moins que ce que le plan lui demande, ne reçoit pas tout
 * (le moteur fait tourner certaines machines plus vite que d'autres : seul le total du groupe compte). `allowBlocked` :
 * une machine ralentie seulement parce que sa sortie bouche (BAS-11, Q4 : surplus d'une étape collée) passe.
 */
export function checkLayout(sb: SbCatalog, layout: Layout, feeds: Feed[], runs: Record<string, Run> | ((b: Placed) => Run | undefined), allowBlocked = false): Check {
  const cat = sourceCatalog(sb, feeds);
  const runOf = typeof runs === "function" ? runs : (b: Placed) => runs[b.id];
  const placed: Placed[] = layout.blocks.map((b) => (runOf(b) ? { ...b, choice: runOf(b)!.recipe } : b));
  for (const f of feeds) placed.push({ u: placed.length, id: srcId(f), x: f.x + DV[f.dir][0], y: f.y + DV[f.dir][1], r: DIRS.indexOf(OPP[f.dir]) });
  // Tuyaux droits tournés dans le sens du flux, sources comprises (S57).
  const blocks = orientPipes(cat, { ...layout, blocks: placed }, placed.slice(layout.blocks.length).map((b) => b.u)).blocks;
  const res = computeSandbox(cat, { ...layout, blocks });
  const issues: CheckIssue[] = [];
  const groups = new Map<Run, { got: number; need: number; worst: { at: number; f: number; item?: string } | null }>();
  for (const b of blocks) {
    const run = runOf(b);
    if (!run) continue;
    const st = res.machines.get(b.u);
    if (!st?.rec) {
      issues.push({ k: "recipe", at: b.u });
      continue;
    }
    const need = Math.min(1, run.need);
    const ok = allowBlocked && st.reason?.k === "blocked";
    const item = st.reason && "item" in st.reason ? st.reason.item : undefined;
    if (need > 1e-9 && st.f < 1e-6 && !ok) issues.push({ k: "short", at: b.u, item });
    const g = groups.get(run) ?? { got: 0, need: 0, worst: null };
    g.got += ok ? Math.max(st.f, need) : st.f;
    g.need += need;
    if (!ok && (!g.worst || st.f < g.worst.f)) g.worst = { at: b.u, f: st.f, item };
    groups.set(run, g);
  }
  for (const g of groups.values()) if (g.got < g.need - 1e-6 && g.worst && !issues.some((i) => i.at === g.worst!.at)) issues.push({ k: "short", at: g.worst.at, item: g.worst.item });
  for (const { a } of res.alerts) {
    if (a.k === "mixed") issues.push({ k: "mixed", item: a.items.join("+") });
    if (a.k === "overlap") issues.push({ k: "overlap" });
    if (a.k === "reversed") issues.push({ k: "cut" });
  }
  return { ok: !issues.length, issues, result: res, layout: { ...layout, blocks } };
}

/** Le catalogue de vérification, à donner au convertisseur (pièces de tier III tournées avec la forme du tier I). */
export const checkCatalog = (sb: SbCatalog): SbCatalog => sourceCatalog(sb, []);

/** Chaque bâtiment a ses ports relevés (sinon le moteur ne peut pas juger : pièce de tier III pas encore relevée…). */
export const allKnown = (sb: SbCatalog, layout: Layout) => layout.blocks.every((b) => !!sourceCatalog(sb, []).blocks.get(b.id)?.geo);

/** Les bouts des collecteurs d'entrée d'un module posé en (x, y) ; null si l'un n'a pas de bout. */
export function feedsOf(m: ModulePlan, x = 0, y = 0): Feed[] | null {
  const feeds: Feed[] = [];
  for (const n of m.nets) {
    if (n.role !== "entrée") continue;
    if (!n.end) return null;
    feeds.push({ x: n.end.x + x, y: n.end.y + y, dir: n.end.dir, item: n.item, perSec: n.perSec });
  }
  return feeds;
}

/**
 * Un module : chaque collecteur d'entrée est alimenté par son bout. null quand le moteur ne peut pas le juger (ports
 * non relevés, pièce ou recette inconnue du bac à sable, collecteur d'entrée sans bout).
 */
export function checkModule(m: ModulePlan, req: ModuleRequest, sb: SbCatalog): Check | null {
  if (!m.portsKnown || !sb.blocks.get(req.machine)?.geo) return null;
  const run = runFor(sb, req);
  if (!run) return null;
  const conv = layoutFromModule(m, checkCatalog(sb));
  if (conv.skipped.length || !allKnown(sb, conv.layout)) return null;
  const feeds = feedsOf(m);
  if (!feeds) return null;
  return checkLayout(sb, conv.layout, feeds, { [req.machine]: run });
}
