// Chargement des données : index en mémoire + application des corrections
// (data/overrides.json puis corrections locales saisies dans l'appli).

import type {
  AddedItem,
  AddedRecipe,
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
import type { EnergyFile, InterfacesFile } from "./extension-types.ts";
import { resolveScreenFlags } from "./interfaces.ts";
import type { FarmPole } from "./build/assembly.ts";
import { applyModular, type DieselReading } from "./modular-calc.ts";
import type { ModularFile } from "./modular.ts";
import { msg, type Message } from "./message.ts";

export type GameData = {
  items: Map<string, Item>;
  machines: Map<string, Machine>;
  recipes: Map<string, Recipe>;
  nodes: Map<string, ResearchNode>;
  /** item → recettes qui le produisent (sortie nette > 0 ou quantité inconnue). */
  producers: Map<string, Recipe[]>;
  treeGrowth: TreeGrowth;
  /** Crafts « n'existe pas en jeu » (S6) : hors des calculs, gardés pour les montrer et les rétablir. */
  removed: Map<string, { recipe: Recipe; source: Source }>;
};

/**
 * `energy` (facultatif) : installations énergétiques composées et pollution des Scrubbers (E2).
 * `interfaces` (facultatif) : interfaces des machines (S10) ; un écran chiffré rend connues les
 * valeurs « variables » du wiki (données à 1×, le plan applique le réglage).
 * `modular` (facultatif) : machines modulaires (S13) : l'arbre devient une ferme, les moteurs
 * diesel relevés deviennent des installations énergétiques.
 */
export type RawFiles = { items: ItemsFile; machines: MachinesFile; recipes: RecipesFile; research: ResearchFile; energy?: EnergyFile; interfaces?: InterfacesFile; modular?: ModularFile; /** Poteaux qui peuvent alimenter une ferme d'arbres (catalogue des plans de pose, S14). */ farmPoles?: FarmPole[]; /** Relevés de configuration du moteur diesel notés dans ce navigateur (S18). */ dieselReadings?: DieselReading[] };

export type OverrideResult = { data: GameData; errors: Message[]; applied: number };

/** Construit l'index. Les fichiers d'entrée ne sont jamais modifiés (copie profonde). */
export function buildGameData(files: RawFiles, overrides: OverridesFile[] = []): OverrideResult {
  const items = new Map(structuredClone(files.items.items).map((x) => [x.id, x]));
  const machines = new Map(structuredClone(files.machines.machines).map((x) => [x.id, x]));
  const recipes = new Map(structuredClone(files.recipes.recipes).map((x) => [x.id, x]));
  const nodes = new Map(structuredClone(files.research.nodes).map((x) => [x.id, x]));
  const errors: Message[] = [];
  let applied = 0;
  addEnergy(recipes, machines, files.energy);
  if (files.modular) applyModular(recipes, machines, files.modular, files.farmPoles ?? [], files.dieselReadings ?? []);
  for (const o of overrides) {
    const r = applyOverrides({ items, machines, recipes, nodes }, o);
    errors.push(...r.errors);
    applied += r.applied;
  }
  // Retraits en dernier : une correction ou un ajout d'un autre fichier peut viser le craft retiré.
  const removed: GameData["removed"] = new Map();
  for (const o of overrides) {
    for (const [id, entry] of Object.entries(o.removed?.recipes ?? {})) {
      const r = recipes.get(id) ?? removed.get(id)?.recipe;
      if (!r) errors.push(err(`removed/recipes/${id}`, msg("data.unknownRecipe")));
      else if (!entry?.source?.fetchedAt) errors.push(err(`removed/recipes/${id}`, msg("data.needSource")));
      else {
        recipes.delete(id);
        removed.set(id, { recipe: r, source: entry.source });
        applied++;
      }
    }
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
    for (const f of m.verify) if (f.field === "pollutionPerHour") f.detail = msg("data.pollutionMax", { detail: { note: f.detail }, p: m.pollutionPerHour });
  }
  if (files.interfaces) resolveScreenFlags(recipes, files.interfaces.machines);
  // S29 : « Water Pump2 », « Research Station4 »… (nom du wiki et du jeu, chiffre collé) s'affichent
  // « Water Pump 2 », « Research Station 4 » : plus lisible (choix de l'utilisateur, 2026-10-24).
  for (const m of machines.values()) m.name = spacedName(m.name);
  return { data: { items, machines, recipes, nodes, producers: indexProducers(recipes), treeGrowth: structuredClone(files.machines.treeGrowth), removed }, errors, applied };
}

/** item → recettes qui le produisent (sortie nette > 0 ou quantité inconnue), triées par id. */
/** « Water Pump2 » → « Water Pump 2 » (chiffre final collé à une minuscule) ; « Press MK2 » ne change pas. */
export const spacedName = (name: string): string => name.replace(/([a-z])(\d+)$/, "$1 $2");

export function indexProducers(recipes: Map<string, Recipe>): Map<string, Recipe[]> {
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
  return producers;
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
/** Erreur d'un fichier de corrections : le chemin de l'entrée (« recipes/x.durationS ») et ce qui ne va pas. */
const err = (path: string, e: Message): Message => msg("data.err", { path, e });

/** Champs corrigeables et leur validation. Renvoie la valeur normalisée ou une erreur. */
const FIELDS: Record<"recipes" | "machines" | "items" | "research", (field: string, v: unknown, e: any, maps: Maps) => { ok: true; value: unknown } | { ok: false; error: Message }> = {
  recipes(field, v, r: Recipe, maps) {
    if (field === "machine") return typeof v === "string" && maps.machines.has(v) ? { ok: true, value: v } : { ok: false, error: msg("data.unknownMachine") };
    if (field === "durationS") return isNum(v) && v > 0 ? { ok: true, value: v } : { ok: false, error: msg("data.duration") };
    if (field === "energyMFps") return isNum(v) ? { ok: true, value: v } : { ok: false, error: msg("data.number") };
    const m = /^(inputs|outputs)\.(.+)$/.exec(field);
    if (m) {
      if (!Object.hasOwn(r[m[1] as "inputs" | "outputs"], m[2]!)) return { ok: false, error: msg("data.notInSide", { item: m[2]!, side: m[1]! }) };
      return isNum(v) && v >= 0 ? { ok: true, value: v } : { ok: false, error: msg("data.quantity") };
    }
    return { ok: false, error: msg("data.notEditable") };
  },
  machines(field, v) {
    if (field === "cost" || field === "tier") return isNum(v) && v >= 0 ? { ok: true, value: v } : { ok: false, error: msg("data.positive") };
    if (field === "pollutionPerHour") return isNum(v) ? { ok: true, value: v } : { ok: false, error: msg("data.number") };
    if (field === "size") {
      if (typeof v === "string") {
        const m = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(v);
        return m ? { ok: true, value: { w: Number(m[1]), l: Number(m[2]) } } : { ok: false, error: msg("data.size") };
      }
      const s = v as { w?: unknown; l?: unknown };
      return isNum(s?.w) && isNum(s?.l) && s.w > 0 && s.l > 0 ? { ok: true, value: { w: s.w, l: s.l } } : { ok: false, error: msg("data.sizeObj") };
    }
    if (field === "unlockedBy") return v === null || typeof v === "string" ? { ok: true, value: v } : { ok: false, error: msg("data.node") };
    return { ok: false, error: msg("data.notEditable") };
  },
  items(field, v) {
    if (field === "sellValue") return isNum(v) ? { ok: true, value: v } : { ok: false, error: msg("data.number") };
    if (field === "researchValue") return isNum(v) && v >= 0 ? { ok: true, value: v } : { ok: false, error: msg("data.positive") };
    if (field === "isFluid") return typeof v === "boolean" ? { ok: true, value: v } : { ok: false, error: msg("data.bool") };
    // Description en jeu : absente des wikis pour la plupart des objets, recopiée par le joueur.
    if (field === "description") {
      const t = typeof v === "string" ? v.trim() : "";
      return t && t.length <= 2000 ? { ok: true, value: t } : { ok: false, error: msg("data.text") };
    }
    return { ok: false, error: msg("data.notEditable") };
  },
  research(field, v) {
    if (field === "requires") return v === "all" || v === "any" ? { ok: true, value: v } : { ok: false, error: msg("data.requires") };
    if (field === "rp") return isNum(v) && v >= 0 ? { ok: true, value: v } : { ok: false, error: msg("data.positive") };
    // Description en jeu : absente des wikis, recopiée par le joueur.
    if (field === "description") {
      const t = typeof v === "string" ? v.trim() : "";
      return t && t.length <= 2000 ? { ok: true, value: t } : { ok: false, error: msg("data.text") };
    }
    return { ok: false, error: msg("data.notEditable") };
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
export function applyOverrides(maps: Maps, o: OverridesFile): { errors: Message[]; applied: number } {
  const errors: Message[] = [];
  let applied = 0;
  // Ajouts d'abord (objets, puis crafts qui peuvent les utiliser) : les corrections peuvent les viser.
  for (const [id, a] of Object.entries(o.added?.items ?? {})) {
    const e = checkAddedItem(maps, id, a);
    if (e) {
      errors.push(err(`added/items/${id}`, e));
      continue;
    }
    maps.items.set(id, { id, name: a.name.trim(), isFluid: a.isFluid ?? null, sellValue: a.sellValue ?? null, researchValue: a.researchValue ?? null, sources: [a.source], verify: [], added: a.source });
    applied++;
  }
  for (const [id, a] of Object.entries(o.added?.recipes ?? {})) {
    const e = checkAddedRecipe(maps, id, a);
    if (e) {
      errors.push(err(`added/recipes/${id}`, e));
      continue;
    }
    maps.recipes.set(id, {
      id,
      machine: a.machine,
      durationS: a.durationS,
      inputs: { ...a.inputs },
      outputs: { ...a.outputs },
      energyMFps: a.energyMFps,
      research: maps.machines.get(a.machine)!.unlockedBy,
      sources: [a.source],
      verify: [],
      added: a.source,
    });
    applied++;
  }
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
        errors.push(err(`${kind}/${id}`, msg("data.unknownEntity")));
        continue;
      }
      for (const [field, entry] of Object.entries(fields ?? {})) {
        if (!entry || typeof entry !== "object" || !("value" in entry) || !entry.source?.fetchedAt) {
          errors.push(err(`${kind}/${id}.${field}`, msg("data.needValue")));
          continue;
        }
        const check = FIELDS[kind](field, entry.value, entity, maps);
        if (!check.ok) {
          errors.push(err(`${kind}/${id}.${field}`, check.error));
          continue;
        }
        const resolvedFlags = entity.verify.filter((f) => f.field === field);
        entity.verify = entity.verify.filter((f) => f.field !== field);
        const correction: Correction = { field, previous: getPath(entity, field), value: check.value, source: entry.source, resolvedFlags };
        setPath(entity, field, check.value);
        // Autre machine : la recherche nécessaire du craft est la sienne.
        if (kind === "recipes" && field === "machine") (entity as Recipe).research = maps.machines.get(check.value as string)!.unlockedBy;
        entity.corrections = [...(entity.corrections ?? []).filter((c) => c.field !== field), correction];
        entity.sources = [...entity.sources, entry.source];
        applied++;
      }
    }
  }
  return { errors, applied };
}

const ID = /^[a-z0-9][\w.-]{0,79}$/i;

/** Objet manquant : identifiant libre, nom, valeurs connues ou null. Renvoie l'erreur, ou null. */
function checkAddedItem(maps: Maps, id: string, a: AddedItem): Message | null {
  if (!ID.test(id)) return msg("data.badId");
  if (maps.items.has(id)) return msg("data.itemExists");
  if (!a || typeof a !== "object" || !a.source?.fetchedAt) return msg("data.itemShape");
  if (typeof a.name !== "string" || !a.name.trim() || a.name.length > 100) return msg("data.name");
  if (a.isFluid !== null && a.isFluid !== undefined && typeof a.isFluid !== "boolean") return msg("data.fluid");
  for (const k of ["sellValue", "researchValue"] as const) if (a[k] !== null && a[k] !== undefined && !(isNum(a[k]) && a[k] >= 0)) return msg("data.optNumber", { k });
  return null;
}

/** Craft manquant : machine connue, au moins une sortie, objets connus, quantités > 0, durée > 0. */
function checkAddedRecipe(maps: Maps, id: string, a: AddedRecipe): Message | null {
  if (!ID.test(id)) return msg("data.badId");
  if (maps.recipes.has(id)) return msg("data.recipeExists");
  if (!a || typeof a !== "object" || !a.source?.fetchedAt) return msg("data.recipeShape");
  if (typeof a.machine !== "string" || !maps.machines.has(a.machine)) return msg("data.unknownMachineId", { id: String(a.machine) });
  if (!(isNum(a.durationS) && a.durationS > 0)) return msg("data.duration");
  if (!isNum(a.energyMFps)) return msg("data.energy");
  for (const k of ["inputs", "outputs"] as const) {
    const side = a[k];
    if (!side || typeof side !== "object" || Array.isArray(side)) return msg("data.sideShape", { k });
    for (const [item, q] of Object.entries(side)) {
      if (!maps.items.has(item)) return msg("data.unknownItemIn", { k, item });
      if (!(isNum(q) && q > 0)) return msg("data.quantityPos", { item });
    }
  }
  if (!Object.keys(a.outputs).length) return msg("data.noOutput");
  return null;
}

export function itemName(data: GameData, id: string): string {
  return data.items.get(id)?.name ?? id;
}
