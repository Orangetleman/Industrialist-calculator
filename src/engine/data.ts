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
import type { EnergyFile } from "./extension-types.ts";

export type GameData = {
  items: Map<string, Item>;
  machines: Map<string, Machine>;
  recipes: Map<string, Recipe>;
  nodes: Map<string, ResearchNode>;
  /** item → recettes qui le produisent (sortie nette > 0 ou quantité inconnue). */
  producers: Map<string, Recipe[]>;
  treeGrowth: TreeGrowth;
};

/** `energy` (facultatif) : installations énergétiques composées et pollution des Scrubbers (E2). */
export type RawFiles = { items: ItemsFile; machines: MachinesFile; recipes: RecipesFile; research: ResearchFile; energy?: EnergyFile };

export type OverrideResult = { data: GameData; errors: string[]; applied: number };

/** Construit l'index. Les fichiers d'entrée ne sont jamais modifiés (copie profonde). */
export function buildGameData(files: RawFiles, overrides: OverridesFile[] = []): OverrideResult {
  const items = new Map(structuredClone(files.items.items).map((x) => [x.id, x]));
  const machines = new Map(structuredClone(files.machines.machines).map((x) => [x.id, x]));
  const recipes = new Map(structuredClone(files.recipes.recipes).map((x) => [x.id, x]));
  const nodes = new Map(structuredClone(files.research.nodes).map((x) => [x.id, x]));
  const errors: string[] = [];
  let applied = 0;
  addEnergy(recipes, machines, files.energy);
  for (const o of overrides) {
    const r = applyOverrides({ items, machines, recipes, nodes }, o);
    errors.push(...r.errors);
    applied += r.applied;
  }
  // « Contradiction » de recherche qui n'en est pas une : les deux sources nomment la même recherche
  // (son nom d'un côté, son identifiant de l'autre).
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const nodeOf = (v: unknown) => {
    if (typeof v !== "string") return null;
    if (nodes.has(v)) return v;
    const byName = [...nodes.values()].find((n) => n.name.toLowerCase() === v.toLowerCase());
    return byName?.id ?? (nodes.has(slug(v)) ? slug(v) : null);
  };
  for (const m of machines.values()) {
    m.verify = m.verify.filter((f) => !(f.field === "unlockedBy" && f.reason === "contradiction" && f.alternatives?.length && f.alternatives.every((x) => nodeOf(x.value) === m.unlockedBy)));
  }
  // Par prudence (consigne de l'utilisateur, 2026-10-13) : une pollution donnée en plage compte
  // pour sa borne la plus forte, tant qu'aucun relevé ne la remplace.
  for (const m of machines.values()) {
    const p = m.pollutionPerHour;
    if (!Array.isArray(p)) continue;
    m.pollutionPerHour = Math.max(p[0], p[1]);
    for (const f of m.verify) if (f.field === "pollutionPerHour") f.detail = `${f.detail} : la plus forte (${String(m.pollutionPerHour).replace(".", ",")} %/h) est retenue, par prudence`;
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

/**
 * Installations énergétiques : une recette composée par installation (durée 1 s, quantités par
 * seconde, énergie négative = production). Les Scrubbers reçoivent leur pollution propre.
 */
function addEnergy(recipes: Map<string, Recipe>, machines: Map<string, Machine>, energy: EnergyFile | undefined): void {
  if (!energy) return;
  for (const s of energy.setups) {
    if (!machines.has(s.machine) || s.parts.some((p) => !machines.has(p.machine))) continue;
    recipes.set(s.id, {
      id: s.id,
      machine: s.machine,
      durationS: 1,
      inputs: { ...s.inputsPerSec },
      outputs: { ...s.outputsPerSec },
      energyMFps: -s.mfps,
      research: null,
      parts: s.parts.map((p) => ({ ...p })),
      setupName: s.name,
      setupNote: s.note,
      ...(s.observed ? { setupObserved: s.observed.note } : {}),
      ...(s.pollutionPerHour !== null ? { pollutionPerHour: s.pollutionPerHour } : {}),
      energyGuaranteed: s.guaranteed,
      sources: structuredClone(s.sources),
      verify: structuredClone(s.verify),
    });
  }
  for (const sc of energy.scrubbers) {
    const r = recipes.get(sc.recipe);
    if (!r) continue;
    r.pollutionPerHour = sc.pollutionPerHour;
    // La pollution « selon l'entrée » de la machine est donnée recette par recette (page Scrubber).
    const m = machines.get(r.machine);
    if (m) m.verify = m.verify.filter((f) => f.field !== "pollutionPerHour");
  }
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
    // Description en jeu : absente des wikis, recopiée par le joueur.
    if (field === "description") {
      const t = typeof v === "string" ? v.trim() : "";
      return t && t.length <= 2000 ? { ok: true, value: t } : { ok: false, error: "texte de 1 à 2000 caractères attendu" };
    }
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
