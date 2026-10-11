// Fabrique de jeux de données factices pour les tests du moteur.
import { buildGameData, type GameData } from "../src/engine/data.ts";
import type { Item, Machine, OverridesFile, Recipe, ResearchNode, Source, TreeGrowth, VerifyFlag } from "../src/engine/types.ts";

export const SRC: Source = { wiki: "jeu", fetchedAt: "2026-10-11T00:00:00Z", note: "test" };

export type R = {
  id: string;
  machine: string;
  t: number | null;
  e?: number | null;
  in?: Record<string, number | null>;
  out: Record<string, number | null>;
  verify?: VerifyFlag[];
  tree?: boolean;
};
export type M = { id: string; size?: [number, number]; cost?: number | null; unlockedBy?: string | null; kind?: "machine" | "farm"; pollution?: number };
export type N = { id: string; rp: number; parents?: string[]; requires?: "all" | "any"; reqItems?: { item: string; amount: number }[] };

export function makeData(spec: { recipes: R[]; machines?: M[]; nodes?: N[]; treeGrowth?: TreeGrowth; overrides?: OverridesFile[] }): GameData {
  const roots: ResearchNode[] = (["Production", "Energy", "Utility"] as const).map((c) => ({
    id: c.toLowerCase(),
    name: c,
    category: c,
    rp: 0,
    children: [],
    parents: [],
    requires: "all",
    unlocksMachines: [],
    unlocksOther: [],
    reqItems: [],
    isRoot: true,
    sources: [SRC],
    verify: [],
  }));
  const nodes: ResearchNode[] = [
    ...roots,
    ...(spec.nodes ?? []).map((n) => ({
      id: n.id,
      name: n.id,
      category: "Production" as const,
      rp: n.rp,
      children: [],
      parents: n.parents ?? ["production"],
      requires: n.requires ?? "all",
      unlocksMachines: [],
      unlocksOther: [],
      reqItems: n.reqItems ?? [],
      isRoot: false,
      sources: [SRC],
      verify: [],
    })),
  ];
  for (const n of nodes) for (const p of n.parents) nodes.find((x) => x.id === p)?.children.push(n.id);

  const machineSpecs = new Map((spec.machines ?? []).map((m) => [m.id, m]));
  for (const r of spec.recipes) if (!machineSpecs.has(r.machine)) machineSpecs.set(r.machine, { id: r.machine });
  const machines: Machine[] = [...machineSpecs.values()].map((m) => ({
    id: m.id,
    name: m.id,
    kind: m.kind ?? "machine",
    description: null,
    category: null,
    unlockedBy: m.unlockedBy === undefined ? "production" : m.unlockedBy,
    variantOf: null,
    limited: false,
    tier: null,
    cost: m.cost === undefined ? 100 : m.cost,
    size: m.size ? { w: m.size[0], l: m.size[1] } : null,
    pollutionPerHour: m.pollution ?? 0,
    sources: [SRC],
    verify: [],
  }));

  const itemIds = new Set<string>();
  const recipes: Recipe[] = spec.recipes.map((r) => {
    for (const k of [...Object.keys(r.in ?? {}), ...Object.keys(r.out)]) itemIds.add(k);
    return {
      id: r.id,
      machine: r.machine,
      durationS: r.t,
      inputs: r.in ?? {},
      outputs: r.out,
      energyMFps: r.e === undefined ? 1000 : r.e,
      research: null,
      ...(r.tree ? { durationByPollution: true } : {}),
      sources: [SRC],
      verify: r.verify ?? [],
    };
  });
  const items: Item[] = [...itemIds].map((id) => ({ id, name: id, isFluid: false, sellValue: 1, researchValue: 1, sources: [SRC], verify: [] }));
  const meta = { generatedAt: SRC.fetchedAt, primary: "miraheze" as const, counts: {} };
  const { data, errors } = buildGameData(
    {
      items: { meta, items },
      machines: { meta, machines, treeGrowth: spec.treeGrowth ?? { bands: [], source: SRC } },
      recipes: { meta, recipes },
      research: { meta, nodes },
    },
    spec.overrides ?? [],
  );
  if (errors.length) throw new Error(errors.join("\n"));
  return data;
}

/** Progression : tout ce qui est passé, plus les racines. */
export const progress = (unlocked: string[] = [], owned: string[] = []) => ({ unlocked: new Set(unlocked), owned: new Set(owned) });
