// Chargement des données : index en mémoire + application des corrections
// (data/overrides.json puis corrections locales saisies dans l'appli).

import type {
  Correction,
  Item,
  ItemsFile,
  Machine,
  MachinesFile,
  OverridesFile,
  Recipe,
  RecipesFile,
  ResearchFile,
  ResearchNode,
  Source,
  TreeGrowth,
  VerifyFlag,
} from "./types.ts";

export type GameData = {
  items: Map<string, Item>;
  machines: Map<string, Machine>;
  recipes: Map<string, Recipe>;
  nodes: Map<string, ResearchNode>;
  /** item → recettes qui le produisent (sortie nette > 0 ou quantité inconnue). */
  producers: Map<string, Recipe[]>;
  treeGrowth: TreeGrowth;
};

export type RawFiles = { items: ItemsFile; machines: MachinesFile; recipes: RecipesFile; research: ResearchFile };

export type OverrideResult = { data: GameData; errors: string[]; applied: number };

/** Construit l'index. Les fichiers d'entrée ne sont jamais modifiés (copie profonde). */
export function buildGameData(files: RawFiles, overrides: OverridesFile[] = []): OverrideResult {
  const items = new Map(structuredClone(files.items.items).map((x) => [x.id, x]));
  const machines = new Map(structuredClone(files.machines.machines).map((x) => [x.id, x]));
  const recipes = new Map(structuredClone(files.recipes.recipes).map((x) => [x.id, x]));
  const nodes = new Map(structuredClone(files.research.nodes).map((x) => [x.id, x]));
  const errors: string[] = [];
  let applied = 0;
  for (const o of overrides) {
    const r = applyOverrides({ items, machines, recipes, nodes }, o);
    errors.push(...r.errors);
    applied += r.applied;
  }
  const producers = new Map<string, Recipe[]>();
  for (const r of recipes.values()) {
    for (const [item, amount] of Object.entries(r.outputs)) {
      const net = amount === null ? null : amount - (r.inputs[item] ?? 0);
      if (net !== null && net <= 0) continue;
      if (!producers.has(item)) producers.set(item, []);
      producers.get(item)!.push(r);
    }
  }
  for (const list of producers.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  return { data: { items, machines, recipes, nodes, producers, treeGrowth: structuredClone(files.machines.treeGrowth) }, errors, applied };
}

type Maps = Pick<GameData, "items" | "machines" | "recipes" | "nodes">;
type Entity = { verify: VerifyFlag[]; sources: Source[]; corrections?: Correction[] };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Champs corrigeables et leur validation. Renvoie la valeur normalisée ou une erreur. */
const FIELDS: Record<"recipes" | "machines" | "items" | "research", (field: string, v: unknown, e: any) => { ok: true; value: unknown } | { ok: false; error: string }> = {
  recipes(field, v, r: Recipe) {
    if (field === "durationS") return isNum(v) && v > 0 ? { ok: true, value: v } : { ok: false, error: "durée > 0 attendue" };
    if (field === "energyMFps") return isNum(v) ? { ok: true, value: v } : { ok: false, error: "nombre attendu" };
    const m = /^(inputs|outputs)\.(.+)$/.exec(field);
    if (m) {
      if (!Object.hasOwn(r[m[1] as "inputs" | "outputs"], m[2]!)) return { ok: false, error: `${m[2]} n'est pas dans ${m[1]}` };
      return isNum(v) && v >= 0 ? { ok: true, value: v } : { ok: false, error: "quantité ≥ 0 attendue" };
    }
    return { ok: false, error: "champ non corrigeable" };
  },
  machines(field, v) {
    if (field === "cost" || field === "tier") return isNum(v) && v >= 0 ? { ok: true, value: v } : { ok: false, error: "nombre ≥ 0 attendu" };
    if (field === "pollutionPerHour") return isNum(v) ? { ok: true, value: v } : { ok: false, error: "nombre attendu" };
    if (field === "size") {
      if (typeof v === "string") {
        const m = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(v);
        return m ? { ok: true, value: { w: Number(m[1]), l: Number(m[2]) } } : { ok: false, error: "taille « LxL » attendue" };
      }
      const s = v as { w?: unknown; l?: unknown };
      return isNum(s?.w) && isNum(s?.l) && s.w > 0 && s.l > 0 ? { ok: true, value: { w: s.w, l: s.l } } : { ok: false, error: "taille { w, l } attendue" };
    }
    if (field === "unlockedBy") return v === null || typeof v === "string" ? { ok: true, value: v } : { ok: false, error: "id de nœud ou null attendu" };
    return { ok: false, error: "champ non corrigeable" };
  },
  items(field, v) {
    if (field === "sellValue") return isNum(v) ? { ok: true, value: v } : { ok: false, error: "nombre attendu" };
    if (field === "isFluid") return typeof v === "boolean" ? { ok: true, value: v } : { ok: false, error: "booléen attendu" };
    return { ok: false, error: "champ non corrigeable" };
  },
  research(field, v) {
    if (field === "requires") return v === "all" || v === "any" ? { ok: true, value: v } : { ok: false, error: "« all » ou « any » attendu" };
    if (field === "rp") return isNum(v) && v >= 0 ? { ok: true, value: v } : { ok: false, error: "nombre ≥ 0 attendu" };
    return { ok: false, error: "champ non corrigeable" };
  },
};

function getPath(e: any, field: string): unknown {
  const [a, b] = field.split(/\.(.+)/);
  return b === undefined ? e[a!] : e[a!]?.[b];
}
function setPath(e: any, field: string, v: unknown): void {
  const [a, b] = field.split(/\.(.+)/);
  if (b === undefined) e[a!] = v;
  else e[a!][b] = v;
}

/** Applique un fichier de corrections sur les maps (modifiées en place). */
export function applyOverrides(maps: Maps, o: OverridesFile): { errors: string[]; applied: number } {
  const errors: string[] = [];
  let applied = 0;
  const groups: [keyof typeof FIELDS, Map<string, Entity>][] = [
    ["recipes", maps.recipes],
    ["machines", maps.machines],
    ["items", maps.items],
    ["research", maps.nodes],
  ];
  for (const [kind, map] of groups) {
    for (const [id, fields] of Object.entries(o[kind] ?? {})) {
      const entity = map.get(id);
      if (!entity) {
        errors.push(`${kind}/${id} : objet inconnu`);
        continue;
      }
      for (const [field, entry] of Object.entries(fields ?? {})) {
        if (!entry || typeof entry !== "object" || !("value" in entry) || !entry.source?.fetchedAt) {
          errors.push(`${kind}/${id}.${field} : il faut { value, source: { wiki, fetchedAt } }`);
          continue;
        }
        const check = FIELDS[kind](field, entry.value, entity);
        if (!check.ok) {
          errors.push(`${kind}/${id}.${field} : ${check.error}`);
          continue;
        }
        const resolvedFlags = entity.verify.filter((f) => f.field === field);
        entity.verify = entity.verify.filter((f) => f.field !== field);
        const correction: Correction = { field, previous: getPath(entity, field), value: check.value, source: entry.source, resolvedFlags };
        setPath(entity, field, check.value);
        entity.corrections = [...(entity.corrections ?? []).filter((c) => c.field !== field), correction];
        entity.sources = [...entity.sources, entry.source];
        applied++;
      }
    }
  }
  return { errors, applied };
}

export function itemName(data: GameData, id: string): string {
  return data.items.get(id)?.name ?? id;
}
