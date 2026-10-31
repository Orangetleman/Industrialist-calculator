// Vérification d'un plan de pose par le moteur du bac à sable (S56, maquette `generation-contacts.html`). Le plan est
// converti en montage (`convert.ts`), une source posée au bout de chaque collecteur d'entrée l'alimente, et le moteur
// dit ce que fait chaque machine. L'essai est rejeté si une machine ne reçoit pas tout, ou si un contact mélange des
// ressources. Pur, sans DOM.

import type { Dir, SbBlock, SbCatalog } from "../sandbox/catalog.ts";
import { computeSandbox } from "../sandbox/compute.ts";
import { DIRS, DV, OPP, type Layout, type Placed } from "../sandbox/layout.ts";
import { layoutFromModule } from "../schematic/convert.ts";
import type { ModulePlan, ModuleRequest } from "./module.ts";

/** Un collecteur à alimenter : la case de son bout, le sens vers l'extérieur, la ressource. */
export type Feed = { x: number; y: number; dir: Dir; item: string };
/** Ce qui ne va pas, en codes courts (pour les tests et la mise au point). */
export type CheckIssue = { k: "recipe" | "short" | "mixed" | "overlap"; at?: number; item?: string };
export type Check = { ok: boolean; issues: CheckIssue[]; result?: ReturnType<typeof computeSandbox>; layout?: Layout };

/** Id du bâtiment source d'une ressource (n'existe que dans le catalogue de vérification). */
const srcId = (item: string) => `__source:${item}`;

/** Catalogue du bac à sable avec une source par ressource (un port de sortie au nord, débit sans limite). */
const withSources = new WeakMap<SbCatalog, SbCatalog>();
function sourceCatalog(sb: SbCatalog, items: string[]): SbCatalog {
  let c = withSources.get(sb);
  if (!c) withSources.set(sb, (c = { blocks: new Map(sb.blocks), items: sb.items }));
  for (const item of items) {
    if (c.blocks.has(srcId(item))) continue;
    const t = sb.items.get(item)?.fluid ? "f" : "o";
    const b: SbBlock = { id: srcId(item), name: item, tier: null, cost: 0, poll: 0, geo: { w: 1, h: 1, ports: [{ t, d: "s", s: "N", c: 1 }] }, recipes: [{ id: srcId(item), s: 1, in: {}, out: { [item]: 1e6 }, e: null }], incomplete: [] };
    c.blocks.set(b.id, b);
  }
  return c;
}

/** La recette du bac à sable qui correspond à la demande (sa sortie principale et toutes ses entrées). */
export function runFor(sb: SbCatalog, req: Pick<ModuleRequest, "machine" | "count" | "inputs" | "outputs">): Run | null {
  const main = req.outputs[0];
  const r = sb.blocks.get(req.machine)?.recipes.find((x) => main !== undefined && main.item in x.out && req.inputs.every((f) => f.item in x.in));
  if (!r || !main) return null;
  // Part de la vitesse : ce que le plan demande à chaque machine, rapporté à ce qu'elle fait à fond.
  return { recipe: r.id, need: main.perMin / 60 / req.count / (r.out[main.item]! / r.s) };
}

/** Ce qu'une machine doit faire : sa recette, et la part de sa vitesse que le plan lui demande (1 : à fond). */
export type Run = { recipe: string; need: number };

/**
 * Le montage, alimenté par `feeds`, avec la recette de `runs` choisie sur chaque machine de ce type. Une machine qui
 * tourne moins vite que ce que le plan lui demande ne reçoit pas tout. `allowBlocked` : une machine ralentie seulement
 * parce que sa sortie bouche (BAS-11, Q4 : surplus d'une étape collée à la machine suivante) passe.
 */
export function checkLayout(sb: SbCatalog, layout: Layout, feeds: Feed[], runs: Record<string, Run> | ((b: Placed) => Run | undefined), allowBlocked = false): Check {
  const cat = sourceCatalog(sb, feeds.map((f) => f.item));
  const runOf = typeof runs === "function" ? runs : (b: Placed) => runs[b.id];
  const blocks: Placed[] = layout.blocks.map((b) => (runOf(b) ? { ...b, choice: runOf(b)!.recipe } : b));
  for (const f of feeds) blocks.push({ u: blocks.length, id: srcId(f.item), x: f.x + DV[f.dir][0], y: f.y + DV[f.dir][1], r: DIRS.indexOf(OPP[f.dir]) });
  const res = computeSandbox(cat, { ...layout, blocks });
  const issues: CheckIssue[] = [];
  for (const b of blocks) {
    const run = runOf(b);
    if (!run) continue;
    const st = res.machines.get(b.u);
    if (!st?.rec) issues.push({ k: "recipe", at: b.u });
    else if (st.f < Math.min(1, run.need) - 1e-6 && !(allowBlocked && st.reason?.k === "blocked")) issues.push({ k: "short", at: b.u, item: st.reason && "item" in st.reason ? st.reason.item : undefined });
  }
  for (const { a } of res.alerts) {
    if (a.k === "mixed") issues.push({ k: "mixed", item: a.items.join("+") });
    if (a.k === "overlap") issues.push({ k: "overlap" });
  }
  return { ok: !issues.length, issues, result: res, layout: { ...layout, blocks } };
}

/** Les bouts des collecteurs d'entrée d'un module posé en (x, y) ; null si l'un n'a pas de bout. */
export function feedsOf(m: ModulePlan, x = 0, y = 0): Feed[] | null {
  const feeds: Feed[] = [];
  for (const n of m.nets) {
    if (n.role !== "entrée") continue;
    if (!n.end) return null;
    feeds.push({ x: n.end.x + x, y: n.end.y + y, dir: n.end.dir, item: n.item });
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
  const conv = layoutFromModule(m, sb);
  if (conv.skipped.length) return null;
  const feeds = feedsOf(m);
  if (!feeds) return null;
  return checkLayout(sb, conv.layout, feeds, { [req.machine]: run });
}
