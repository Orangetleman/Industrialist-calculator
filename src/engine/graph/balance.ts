// Équilibre en direct du graphe (PLAN-GRAPHE.md § 2, décision 2) : à chaque geste, sans solveur.
// Pour chaque nœud, débit d'un produit = machines × quantité nette par cycle ÷ durée (par minute).
// Chaque sortie se partage entre les entrées qui lui sont reliées ; ce qu'une entrée ne reçoit pas
// est un manque, ce qu'une sortie ne donne pas est un excédent (sauf le produit de la cible, qui
// est l'objectif). Totaux comme ceux du plan : machines entières, énergie, prix, cases, pollution.

import type { GameData } from "../data.ts";
import { recipeProc } from "../resources.ts";
import type { Graph, NodeId } from "./model.ts";
import { recipePorts, type GraphWorld } from "./ports.ts";

const EPS = 1e-9;
const ceilTol = (x: number) => Math.ceil(x - EPS);

export type PortBalance = {
  item: string;
  /** Entrée : ce qu'il faut ; sortie : ce qui est produit (par minute). */
  perMin: number;
  /** Entrée : ce qui arrive par les liaisons ; sortie : ce qui part. */
  flow: number;
  /** Nombre de liaisons sur la prise. */
  links: number;
};

export type NodeBalance = {
  id: NodeId;
  /** « recette inconnue » : absente des données ; « incalculable » : durée ou quantité inconnue. */
  problem: "recette inconnue" | "incalculable" | null;
  ins: PortBalance[];
  outs: PortBalance[];
  /** Machines à poser (entier vers le haut ; installation composée : ses pièces ; ferme : ses blocs, sans les arbres). */
  machinesWhole: number;
  /** Arbres d'une ferme (entier vers le haut) ; 0 sinon. */
  trees: number;
  /** MF/s moyens (machines exactes) ; < 0 : énergie produite ; null : inconnu. */
  energyMFps: number | null;
  /** Prix, cases et pollution des machines posées (entières) ; null : inconnu. */
  cost: number | null;
  area: number | null;
  pollutionPerHour: number | null;
};

export type ItemGap = { item: string; perMin: number; nodes: NodeId[] };

export type GraphTotals = {
  /** Machines posées (entières), hors arbres des fermes ; arbres à part. */
  machines: number;
  farms: number;
  /** Énergie consommée (moyenne, machines exactes) et produite par les générateurs du graphe, MF/s. */
  energyMFps: number;
  energyProduced: number;
  cost: number;
  area: number;
  pollutionPerHour: number;
  /** Nœuds dont la valeur est inconnue (non comptés). */
  unknown: { energy: number; cost: number; area: number; pollution: number };
};

export type GraphBalance = {
  nodes: Map<NodeId, NodeBalance>;
  /** Débit qui passe par chaque arête (par minute). */
  edges: Map<string, number>;
  /** Entrées pas (ou pas assez) alimentées, par produit. */
  shortages: ItemGap[];
  /** Sorties pas (entièrement) consommées, par produit, hors produit de la cible. */
  surpluses: ItemGap[];
  /** Production de la cible (ce qui ne part pas vers d'autres nœuds du graphe). */
  output: { item: string; perMin: number } | null;
  totals: GraphTotals;
};

/** Machines entières d'un nœud : l'entier au-dessus, ou le nombre du plan s'il en a ajouté (débit partagé entre des tuyaux). */
export function wholeOf(n: { recipeId: string; machines: number }, world: GraphWorld = {}): number {
  const x = world.extra?.[n.recipeId];
  return x && Math.abs(x.exact - n.machines) < 1e-6 * Math.max(1, x.exact) ? x.whole : ceilTol(n.machines);
}

export function balanceGraph(g: Graph, data: GameData, world: GraphWorld = {}): GraphBalance {
  const nodes = new Map<NodeId, NodeBalance>();
  for (const n of g.nodes) {
    const p = recipePorts(data, n.recipeId, world);
    const empty = (item: string): PortBalance => ({ item, perMin: 0, flow: 0, links: 0 });
    const nb: NodeBalance = { id: n.id, problem: null, ins: p.ins.map(empty), outs: p.outs.map(empty), machinesWhole: wholeOf(n, world), trees: 0, energyMFps: null, cost: null, area: null, pollutionPerHour: null };
    nodes.set(n.id, nb);
    if (!p.eff) {
      nb.problem = "recette inconnue";
      continue;
    }
    const d = p.eff.durationS;
    if (d === null || !(d > 0) || [...p.ins, ...p.outs].some((k) => p.eff!.net[k] === null)) {
      nb.problem = "incalculable";
      continue;
    }
    const proc = recipeProc(p.eff, data.machines);
    for (const port of [...nb.ins, ...nb.outs]) port.perMin = Math.abs(proc.perMin[port.item] ?? 0) * n.machines;
    const whole = nb.machinesWhole;
    // Installation composée : ses pièces par unité, plus celles posées une fois par installation.
    const farm = proc.machine?.kind === "farm";
    if (farm) nb.trees = whole;
    const counted = proc.parts?.filter((q) => !(farm && q.machine === p.eff!.recipe.machine));
    nb.machinesWhole = counted ? counted.reduce((s, q) => s + (q.perFarm ? (whole > 0 ? q.count : 0) : ceilTol(whole * q.count)), 0) : farm ? 0 : whole;
    const onceCost = (k: "cost" | "area" | "pollution") => (proc.parts ? proc.parts.filter((q) => q.perFarm).reduce((s, q) => (s === null || q[k] === null ? null : s + q.count * q[k]!), 0 as number | null) : 0);
    const total = (unit: number | null, k: "cost" | "area" | "pollution") => {
      const once = onceCost(k);
      return unit === null || once === null ? null : unit * whole + (whole > 0 ? once : 0);
    };
    nb.energyMFps = proc.energy === null ? null : proc.energy * n.machines;
    nb.cost = total(proc.cost, "cost");
    nb.area = total(proc.area, "area");
    nb.pollutionPerHour = total(proc.pollution, "pollution");
  }

  // Répartition, produit par produit : chaque entrée demande ce qui lui manque aux sorties reliées
  // qui ont encore de quoi donner, au prorata de ce qu'il leur reste ; une sortie trop demandée
  // réduit tout le monde dans la même proportion. On recommence jusqu'à ce que plus rien ne bouge.
  const portOf = (id: NodeId, dir: "ins" | "outs", item: string) => nodes.get(id)?.[dir].find((x) => x.item === item);
  const flows = new Map<string, number>();
  const live = g.edges.filter((e) => portOf(e.from, "outs", e.item) && portOf(e.to, "ins", e.item));
  for (const e of g.edges) flows.set(e.id, 0);
  for (const e of live) {
    portOf(e.from, "outs", e.item)!.links++;
    portOf(e.to, "ins", e.item)!.links++;
  }
  const byItem = new Map<string, typeof live>();
  for (const e of live) byItem.set(e.item, [...(byItem.get(e.item) ?? []), e]);
  for (const [item, es] of byItem) {
    const spare = new Map<NodeId, number>();
    const rem = new Map<NodeId, number>();
    for (const e of es) {
      spare.set(e.from, portOf(e.from, "outs", item)!.perMin);
      rem.set(e.to, portOf(e.to, "ins", item)!.perMin);
    }
    for (let iter = 0; iter < 200; iter++) {
      const ask = new Map<string, number>();
      for (const [to, r] of rem) {
        if (r <= EPS) continue;
        const feeders = es.filter((e) => e.to === to && spare.get(e.from)! > EPS);
        const S = feeders.reduce((s, e) => s + spare.get(e.from)!, 0);
        for (const e of feeders) ask.set(e.id, (r * spare.get(e.from)!) / S);
      }
      if (!ask.size) break;
      let moved = 0;
      for (const [from, s] of [...spare]) {
        const mine = es.filter((e) => e.from === from && ask.has(e.id));
        const want = mine.reduce((t, e) => t + ask.get(e.id)!, 0);
        const k = want > s ? s / want : 1;
        for (const e of mine) {
          const q = ask.get(e.id)! * k;
          flows.set(e.id, flows.get(e.id)! + q);
          spare.set(from, spare.get(from)! - q);
          rem.set(e.to, rem.get(e.to)! - q);
          moved += q;
        }
      }
      if (moved <= EPS) break;
    }
  }
  for (const e of live) {
    const q = flows.get(e.id)!;
    portOf(e.from, "outs", e.item)!.flow += q;
    portOf(e.to, "ins", e.item)!.flow += q;
  }

  const gaps = (pick: (nb: NodeBalance) => { item: string; gap: number }[]): ItemGap[] => {
    const m = new Map<string, ItemGap>();
    for (const nb of nodes.values())
      for (const { item, gap } of pick(nb)) {
        if (gap <= 1e-7) continue;
        const x = m.get(item) ?? { item, perMin: 0, nodes: [] };
        x.perMin += gap;
        if (!x.nodes.includes(nb.id)) x.nodes.push(nb.id);
        m.set(item, x);
      }
    return [...m.values()].sort((a, b) => a.item.localeCompare(b.item));
  };
  const target = g.target && nodes.has(g.target.node) ? g.target : null;
  const shortages = gaps((nb) => (nb.problem ? [] : nb.ins.map((p) => ({ item: p.item, gap: p.perMin - p.flow }))));
  const surpluses = gaps((nb) => (nb.problem ? [] : nb.outs.filter((p) => !(target && target.node === nb.id && target.item === p.item)).map((p) => ({ item: p.item, gap: p.perMin - p.flow }))));
  let output: GraphBalance["output"] = null;
  if (target) {
    const p = portOf(target.node, "outs", target.item);
    if (p) output = { item: target.item, perMin: Math.max(0, p.perMin - p.flow) };
  }

  const totals: GraphTotals = { machines: 0, farms: 0, energyMFps: 0, energyProduced: 0, cost: 0, area: 0, pollutionPerHour: 0, unknown: { energy: 0, cost: 0, area: 0, pollution: 0 } };
  for (const n of g.nodes) {
    const nb = nodes.get(n.id)!;
    totals.farms += nb.trees;
    totals.machines += nb.machinesWhole;
    if (nb.energyMFps === null) totals.unknown.energy++;
    else if (nb.energyMFps >= 0) totals.energyMFps += nb.energyMFps;
    else totals.energyProduced -= nb.energyMFps;
    if (nb.cost === null) totals.unknown.cost++;
    else totals.cost += nb.cost;
    if (nb.area === null) totals.unknown.area++;
    else totals.area += nb.area;
    if (nb.pollutionPerHour === null) totals.unknown.pollution++;
    else totals.pollutionPerHour += nb.pollutionPerHour;
  }
  return { nodes, edges: flows, shortages, surpluses, output, totals };
}
