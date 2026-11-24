// Difficulté de la partie (S51). Elle change seulement les plans : la progression cochée reste telle quelle.
// Wiki, page Game Difficulties : ce que chaque niveau interdit. Liste des recherches : Industrialist Calculator
// (src/data/researchRules.ts, BLOCKED_RESEARCH_SEEDS) ; seules ces recherches sont bloquées, pas leurs suites
// (décision du 2026-11-11).

import type { GameData } from "./data.ts";
import type { Progress } from "./unlock.ts";

export const DIFFICULTIES = ["normal", "hard", "impossible", "impossible2", "sandbox", "sandbox_plus"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const isDifficulty = (v: unknown): v is Difficulty => typeof v === "string" && (DIFFICULTIES as readonly string[]).includes(v);

const HARD = ["hand-crank", "wind-turbine-1", "geothermal-plant", "solar-panel-2"];
const IMPOSSIBLE = [...HARD, "advanced-copper-extraction", "advanced-coal-extraction", "lv-pole", "energy-storage", "scrubber", "gold-item-storage-silo", "gold-fluid-storage-silo"];

export const BLOCKED_RESEARCH: Record<Difficulty, readonly string[]> = {
  normal: [],
  hard: HARD,
  impossible: IMPOSSIBLE,
  impossible2: IMPOSSIBLE,
  sandbox: [],
  sandbox_plus: [],
};

/**
 * « Tout débloquer » : les recherches atteignables à cette difficulté. Une recherche interdite reste fermée ;
 * ses suites aussi si elles ne tiennent que par elle (jamais de case cochée sans prérequis).
 */
export function unlockableNodes(data: GameData, unlocked: Iterable<string>, d: Difficulty): Set<string> {
  const blocked = new Set(BLOCKED_RESEARCH[d]);
  const done = new Set(unlocked);
  const ok = (id: string): boolean => {
    const n = data.nodes.get(id);
    return !!n && !blocked.has(id) && (n.isRoot || !!n.startUnlocked || done.has(id));
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of data.nodes.values()) {
      if (done.has(n.id) || n.isRoot || n.startUnlocked || blocked.has(n.id)) continue;
      const fine = !n.parents.length || (n.requires === "any" ? n.parents.some(ok) : n.parents.every(ok));
      if (fine) {
        done.add(n.id);
        changed = true;
      }
    }
  }
  return done;
}

/** Progression vue par les plans : recherches bloquées, ou tout l'arbre (Sandbox), plus les machines à posséder (Sandbox+). */
export function withDifficulty<P extends Progress>(data: GameData, p: P, d: Difficulty | null | undefined): P {
  if (!d || d === "normal") return p;
  if (d === "sandbox" || d === "sandbox_plus") {
    const unlocked = new Set([...p.unlocked, ...data.nodes.keys()]);
    if (d === "sandbox") return { ...p, unlocked };
    const owned = new Set([...(p.owned ?? []), ...[...data.machines.values()].filter((m) => m.unlockedBy === null).map((m) => m.id)]);
    return { ...p, unlocked, owned };
  }
  return { ...p, blocked: new Set(BLOCKED_RESEARCH[d].filter((id) => data.nodes.has(id))), difficulty: d };
}
