// Progression dans l'arbre de recherche : ce qui est débloqué, ce qui manque.

import type { GameData } from "./data.ts";

export type Progress = {
  /** Nœuds cochés par le joueur. Les racines (Production, Energy, Utility) sont toujours acquises. */
  unlocked: ReadonlySet<string>;
  /** Conditions « vendre N items » déjà remplies, par id de nœud. */
  reqItemsDone?: ReadonlySet<string>;
  /** Machines sans nœud (Limited, variantes) que le joueur possède. */
  owned?: ReadonlySet<string>;
};

export type ReqItem = { node: string; item: string; amount: number; done: boolean };

export type MachineAccess =
  | { available: true }
  | {
      available: false;
      machine: string;
      /** Nœuds à débloquer, du plus proche de la racine au plus lointain. */
      missingNodes: string[];
      reqItems: ReqItem[];
      rpCost: number;
      /** Machine qui ne dépend d'aucun nœud : il faut la posséder. */
      needsOwnership: boolean;
    };

export function isNodeUnlocked(data: GameData, progress: Progress, nodeId: string): boolean {
  const n = data.nodes.get(nodeId);
  return !!n && (n.isRoot || progress.unlocked.has(nodeId));
}

/**
 * Nœuds à débloquer pour obtenir `nodeId` (lui compris), ancêtres manquants inclus.
 * `requires: "all"` → tous les parents ; `"any"` → la branche la moins chère en RP.
 * Résistant aux cycles éventuels des données.
 */
export function missingNodes(data: GameData, progress: Progress, nodeId: string): string[] {
  const memo = new Map<string, Set<string>>();
  const visit = (id: string, stack: Set<string>): Set<string> => {
    if (isNodeUnlocked(data, progress, id)) return new Set();
    const cached = memo.get(id);
    if (cached) return cached;
    const node = data.nodes.get(id);
    const out = new Set<string>([id]);
    if (!node || stack.has(id)) return out;
    stack.add(id);
    const parents = node.parents.map((p) => visit(p, stack));
    stack.delete(id);
    if (node.requires === "any" && parents.length) {
      let best = parents[0]!;
      for (const p of parents) if (rpOf(data, p) < rpOf(data, best)) best = p;
      for (const x of best) out.add(x);
    } else for (const p of parents) for (const x of p) out.add(x);
    memo.set(id, out);
    return out;
  };
  return orderByDepth(data, [...visit(nodeId, new Set())]);
}

function rpOf(data: GameData, ids: Iterable<string>): number {
  let s = 0;
  for (const id of ids) s += data.nodes.get(id)?.rp ?? 0;
  return s;
}

export function rpCost(data: GameData, ids: Iterable<string>): number {
  return rpOf(data, ids);
}

/** Trie des nœuds de la racine vers les feuilles (profondeur croissante, puis nom). */
export function orderByDepth(data: GameData, ids: string[]): string[] {
  const depth = new Map<string, number>();
  const d = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    const n = data.nodes.get(id);
    if (!n || !n.parents.length || seen.has(id)) return 0;
    seen.add(id);
    const v = 1 + Math.max(...n.parents.map((p) => d(p, seen)));
    seen.delete(id);
    depth.set(id, v);
    return v;
  };
  return [...ids].sort((a, b) => d(a, new Set()) - d(b, new Set()) || (data.nodes.get(a)?.name ?? a).localeCompare(data.nodes.get(b)?.name ?? b));
}

function reqItemsOf(data: GameData, progress: Progress, ids: string[]): ReqItem[] {
  return ids.flatMap((id) => (data.nodes.get(id)?.reqItems ?? []).map((r) => ({ node: id, item: r.item, amount: r.amount, done: !!progress.reqItemsDone?.has(id) })));
}

export function machineAccess(data: GameData, progress: Progress, machineId: string): MachineAccess {
  const m = data.machines.get(machineId);
  if (!m) return { available: false, machine: machineId, missingNodes: [], reqItems: [], rpCost: 0, needsOwnership: false };
  if (m.unlockedBy === null) {
    return progress.owned?.has(machineId)
      ? { available: true }
      : { available: false, machine: machineId, missingNodes: [], reqItems: [], rpCost: 0, needsOwnership: true };
  }
  if (isNodeUnlocked(data, progress, m.unlockedBy)) return { available: true };
  const missing = missingNodes(data, progress, m.unlockedBy);
  return { available: false, machine: machineId, missingNodes: missing, reqItems: reqItemsOf(data, progress, missing), rpCost: rpCost(data, missing), needsOwnership: false };
}

/** « Tout débloquer jusqu'à ce nœud » : renvoie le nouvel ensemble de nœuds cochés. */
export function unlockUpTo(data: GameData, progress: Progress, nodeId: string): Set<string> {
  const next = new Set(progress.unlocked);
  for (const id of missingNodes(data, progress, nodeId)) next.add(id);
  return next;
}

/** Nœuds cochés dont un prérequis n'est pas coché (incohérence à signaler dans l'interface). */
export function inconsistentNodes(data: GameData, progress: Progress): string[] {
  const out: string[] = [];
  for (const id of progress.unlocked) {
    const n = data.nodes.get(id);
    if (!n) continue;
    const ok = n.requires === "any" ? n.parents.some((p) => isNodeUnlocked(data, progress, p)) : n.parents.every((p) => isNodeUnlocked(data, progress, p));
    if (n.parents.length && !ok) out.push(id);
  }
  return out;
}
