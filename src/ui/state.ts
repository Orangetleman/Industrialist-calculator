// État de l'interface et persistance locale (localStorage, toujours dans un try/catch).

import { normalPriority, POSE_CRITERIA, type PoseCriterion } from "../engine/build/module.ts";
import type { Criterion } from "../engine/choose.ts";
import type { AddedItem, AddedRecipe, OverrideEntry, OverridesFile, Source } from "../engine/types.ts";

export type Goal = "objet" | "argent" | "énergie" | "recherche";
export const GOALS: Goal[] = ["objet", "énergie", "recherche", "argent"];

/** Priorités proposées pour chaque objectif (celles qui ont un sens pour lui), la première par défaut. */
export const CRITERIA: Record<Goal, Criterion[]> = {
  objet: ["energy", "machines", "cost", "pollution", "area", "raw", "steps"],
  argent: ["machines", "energy", "cost", "pollution", "area", "raw"],
  énergie: ["machines", "cost", "raw", "pollution", "area"],
  recherche: ["machines", "energy", "cost"],
};

/** Liste complète des priorités d'un objectif : celles enregistrées (valides, sans doublon), puis les autres. */
export function criteriaList(goal: Goal, raw: unknown): Criterion[] {
  const allowed = CRITERIA[goal];
  const asked = (Array.isArray(raw) ? raw : [raw]).filter((c): c is Criterion => allowed.includes(c as Criterion));
  const seen = [...new Set(asked)];
  const rest = DEFAULT_SETTINGS.criteria[goal].filter((c) => !seen.includes(c));
  return [...seen, ...rest];
}

export type ResultTab = "liste" | "schema" | "pose" | "details";

/** Réglages de la vue « Toute l'usine » : `full` recalculée (sinon module par module), `glue` liaisons collées (module par module). */
export type UsineView = { full: boolean; glue: boolean; detail: boolean; power: boolean; plugs: boolean; links: boolean };

export type Settings = {
  /** Objectif affiché : produire un objet, de l'énergie, des RP, ou de l'argent. */
  goal: Goal;
  item: string;
  mode: "rate" | "machines";
  rate: number;
  machines: number;
  /** Priorité de chaque objectif (critère d'optimisation). */
  /** Priorités par objectif, dans l'ordre : la première décide, les suivantes départagent. */
  criteria: Record<Goal, Criterion[]>;
  useUnverified: boolean;
  forced: Record<string, string>;
  /**
   * Machines fixées dans le schéma (S8) : clé d'étape → nombre. `sig` : l'objectif pour lequel elles
   * ont été réglées ; changer d'objet ou d'objectif les annule.
   */
  fixed: { sig: string; machines: Record<string, number> } | null;
  /** Revenu voulu ($/min) pour l'objectif argent. */
  money: number;
  /** La chaîne produit sa propre énergie. */
  selfPowered: boolean;
  /** Pollution maximale (%/h) ; null = sans limite. */
  maxPollution: number | null;
  /** Ne pas dépasser l'argent renseigné dans « Ma partie ». */
  useBudget: boolean;
  /** Production déjà en place chez le joueur : item → débit (/min). */
  existing: Record<string, number>;
  /** Les calculs s'en servent (option, activée par défaut). */
  useExisting: boolean;
  /** Onglet de résultat ouvert : liste de construction, schéma, détails. */
  resultTab: ResultTab;
  /** Unité de saisie de la puissance voulue : kMF/s ou MMF/s. */
  energyUnit: "k" | "M";
  /** Objectif énergie : MF/s voulus, production garantie ou moyenne, sans combustible, distance. */
  energyMFps: number;
  energyGuaranteed: boolean;
  energyNoFuel: boolean;
  /** Distance jusqu'aux machines, en cases (Short Pipes) ; le moteur compte en tuiles (2 cases). */
  distanceTiles: number | null;
  /** Plans de pose : seulement des tuyaux de tier III. */
  tier3Only: boolean;
  /** Plans de pose : ordre des critères qui départagent les dispositions. */
  posePriority: PoseCriterion[];
  /** Toute l'usine (S4) : calcul, liaisons collées, affichage (intérieur des modules, électricité, câbles vers les machines, vecteurs des liaisons). */
  usine: UsineView;
  /** Objectif recherche : but, vitesse, recherche visée, délai, plafond (null = automatique), options. */
  rpMode: "rate" | "node" | "plan";
  rpRate: number;
  rpNode: string | null;
  rpMinutes: number;
  rpCap: number | null;
  rpSatellites: boolean;
  rpLogic: boolean;
  rpCurrent: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  goal: "objet",
  item: "crankshaft",
  mode: "rate",
  rate: 60,
  machines: 15,
  criteria: { objet: ["energy", "machines", "cost", "pollution", "area", "raw", "steps"], argent: ["machines", "energy", "cost", "pollution", "area", "raw"], énergie: ["machines", "cost", "raw", "pollution", "area"], recherche: ["machines", "energy", "cost"] },
  useUnverified: false,
  forced: {},
  fixed: null,
  money: 10000,
  selfPowered: false,
  maxPollution: null,
  useBudget: false,
  existing: {},
  useExisting: true,
  resultTab: "liste",
  energyUnit: "k",
  energyMFps: 1_000_000,
  energyGuaranteed: false,
  energyNoFuel: false,
  distanceTiles: null,
  tier3Only: false,
  posePriority: [...POSE_CRITERIA],
  usine: { full: true, glue: false, detail: false, power: true, plugs: false, links: false },
  rpMode: "rate",
  rpRate: 50,
  rpNode: null,
  rpMinutes: 60,
  rpCap: null,
  rpSatellites: true,
  rpLogic: false,
  rpCurrent: true,
};

const KEY_SETTINGS = "ind-calc:v1:settings";
const KEY_CORRECTIONS = "ind-calc:v1:corrections";
const KEY_BUILT = "ind-calc:v1:built";
const KEY_NOTES = "ind-calc:v1:notes";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée…) : l'appli fonctionne sans.
  }
}

export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(KEY_SETTINGS) ?? {};
  // « allUnlocked » : réglage provisoire de l'étape (c), ignoré désormais.
  // « criterion » : critère unique d'avant la refonte, repris comme priorité de l'objectif objet.
  const { allUnlocked: _ancien, criterion: old, ...rest } = s as Partial<Settings> & { allUnlocked?: unknown; criterion?: unknown };
  const out: Settings = { ...DEFAULT_SETTINGS, ...rest };
  const saved = (rest.criteria && typeof rest.criteria === "object" ? rest.criteria : {}) as Partial<Record<Goal, unknown>>;
  if (typeof old === "string" && saved.objet === undefined) saved.objet = old;
  // Ancien format : une seule priorité par objectif ; elle passe en tête de la liste.
  out.criteria = Object.fromEntries(GOALS.map((g) => [g, criteriaList(g, saved[g])])) as Settings["criteria"];
  if (!GOALS.includes(out.goal)) out.goal = "objet";
  out.useExisting = out.useExisting !== false;
  if (!["liste", "schema", "pose", "details"].includes(out.resultTab)) out.resultTab = "liste";
  if (out.energyUnit !== "k" && out.energyUnit !== "M") out.energyUnit = "k";
  if (out.rpMode !== "rate" && out.rpMode !== "node" && out.rpMode !== "plan") out.rpMode = "rate";
  if (!(out.rpRate > 0)) out.rpRate = DEFAULT_SETTINGS.rpRate;
  if (!(out.rpMinutes > 0)) out.rpMinutes = DEFAULT_SETTINGS.rpMinutes;
  if (out.rpCap !== null && !(out.rpCap >= 0)) out.rpCap = null;
  if (typeof out.rpNode !== "string") out.rpNode = null;
  for (const k of ["rpSatellites", "rpLogic", "rpCurrent"] as const) out[k] = out[k] === true;
  if (!(out.energyMFps > 0)) out.energyMFps = DEFAULT_SETTINGS.energyMFps;
  out.energyGuaranteed = out.energyGuaranteed === true;
  out.energyNoFuel = out.energyNoFuel === true;
  if (out.distanceTiles !== null && !(out.distanceTiles >= 0)) out.distanceTiles = null;
  out.tier3Only = out.tier3Only === true;
  out.posePriority = normalPriority(Array.isArray(out.posePriority) ? out.posePriority : undefined);
  const u = out.usine && typeof out.usine === "object" ? (out.usine as Partial<UsineView>) : {};
  out.usine = Object.fromEntries(Object.entries(DEFAULT_SETTINGS.usine).map(([k, v]) => [k, typeof u[k as keyof UsineView] === "boolean" ? u[k as keyof UsineView] : v])) as UsineView;
  if (!(out.money > 0)) out.money = DEFAULT_SETTINGS.money;
  if (out.maxPollution !== null && !(out.maxPollution >= 0)) out.maxPollution = null;
  out.selfPowered = out.selfPowered === true;
  out.useBudget = out.useBudget === true;
  const ex = out.existing && typeof out.existing === "object" && !Array.isArray(out.existing) ? out.existing : {};
  out.existing = Object.fromEntries(Object.entries(ex).filter(([k, v]) => typeof k === "string" && typeof v === "number" && v > 0));
  if (out.mode !== "rate" && out.mode !== "machines") out.mode = DEFAULT_SETTINGS.mode;
  if (!(out.rate > 0)) out.rate = DEFAULT_SETTINGS.rate;
  if (!(out.machines > 0)) out.machines = DEFAULT_SETTINGS.machines;
  if (!out.forced || typeof out.forced !== "object") out.forced = {};
  const fx = out.fixed as Settings["fixed"] | undefined;
  const fm = fx && typeof fx.sig === "string" && fx.machines && typeof fx.machines === "object" ? Object.entries(fx.machines).filter(([, n]) => Number.isInteger(n) && n >= 1) : [];
  out.fixed = fm.length ? { sig: fx!.sig, machines: Object.fromEntries(fm) } : null;
  return out;
}
export function saveSettings(s: Settings): void {
  write(KEY_SETTINGS, s);
}

// ---------------------------------------------------------------- liste de construction cochée

/** Lignes cochées « construit », par plan (signature) ; seuls les plans récents sont gardés. */
export type BuiltStore = { plans: { sig: string; keys: string[] }[] };
const BUILT_KEEP = 30;

export function loadBuilt(): BuiltStore {
  const b = read<BuiltStore>(KEY_BUILT);
  const plans = b && Array.isArray(b.plans) ? b.plans.filter((p) => p && typeof p.sig === "string" && Array.isArray(p.keys)) : [];
  return { plans: plans.map((p) => ({ sig: p.sig, keys: p.keys.filter((k): k is string => typeof k === "string") })) };
}
export function builtFor(store: BuiltStore, sig: string): Set<string> {
  return new Set(store.plans.find((p) => p.sig === sig)?.keys ?? []);
}
/** Enregistre les lignes cochées d'un plan (le plus récent en tête). */
export function setBuilt(store: BuiltStore, sig: string, keys: Iterable<string>): BuiltStore {
  const list = [...keys];
  const others = store.plans.filter((p) => p.sig !== sig);
  return { plans: (list.length ? [{ sig, keys: list }, ...others] : others).slice(0, BUILT_KEEP) };
}
export function saveBuilt(store: BuiltStore): void {
  write(KEY_BUILT, store);
}

// ---------------------------------------------------------------- corrections locales

export type Scope = "recipes" | "machines" | "items" | "research";

export function loadCorrections(): OverridesFile {
  const c = read<OverridesFile>(KEY_CORRECTIONS);
  return c && typeof c === "object" ? c : {};
}
export function saveCorrections(c: OverridesFile): void {
  write(KEY_CORRECTIONS, c);
}

export function setCorrection(c: OverridesFile, scope: Scope, id: string, field: string, value: unknown, note?: string): OverridesFile {
  const source: Source = { wiki: "saisie", fetchedAt: new Date().toISOString(), note: note || "saisie dans le calculateur (relevé en jeu)" };
  const next: OverridesFile = structuredClone(c);
  const group = (next[scope] ??= {});
  (group[id] ??= {})[field] = { value, source } satisfies OverrideEntry;
  return next;
}

export function removeCorrection(c: OverridesFile, scope: Scope, id: string, field: string): OverridesFile {
  const next: OverridesFile = structuredClone(c);
  const group = next[scope];
  if (group?.[id]) {
    delete group[id]![field];
    if (!Object.keys(group[id]!).length) delete group[id];
  }
  return next;
}

export function countCorrections(c: OverridesFile): number {
  let n = 0;
  for (const scope of ["recipes", "machines", "items", "research"] as Scope[]) for (const fields of Object.values(c[scope] ?? {})) n += Object.keys(fields).length;
  n += Object.keys(c.added?.items ?? {}).length + Object.keys(c.added?.recipes ?? {}).length + Object.keys(c.removed?.recipes ?? {}).length;
  return n;
}

// ---------------------------------------------------------------- crafts et objets ajoutés ou retirés (S6)

const fromGame = (note: string): Source => ({ wiki: "jeu", fetchedAt: new Date().toISOString(), note });

/** Marque un craft « n'existe pas en jeu » (retiré des calculs), ou le rétablit. */
export function setRemoved(c: OverridesFile, id: string, removed: boolean): OverridesFile {
  const next: OverridesFile = structuredClone(c);
  if (removed) ((next.removed ??= {}).recipes ??= {})[id] = { source: fromGame("n'existe pas en jeu (relevé du joueur)") };
  else if (next.removed?.recipes) {
    delete next.removed.recipes[id];
    tidy(next);
  }
  return next;
}

export function setAddedRecipe(c: OverridesFile, id: string, r: Omit<AddedRecipe, "source">): OverridesFile {
  const next: OverridesFile = structuredClone(c);
  ((next.added ??= {}).recipes ??= {})[id] = { ...structuredClone(r), source: fromGame("craft manquant, relevé en jeu par le joueur") };
  return next;
}

export function setAddedItem(c: OverridesFile, id: string, it: Omit<AddedItem, "source">): OverridesFile {
  const next: OverridesFile = structuredClone(c);
  ((next.added ??= {}).items ??= {})[id] = { ...it, source: fromGame("objet manquant, relevé en jeu par le joueur") };
  return next;
}

/**
 * Efface un ajout. Un objet emporte les crafts ajoutés qui l'utilisent (sinon ils seraient
 * refusés) ; renvoie aussi leurs identifiants.
 */
export function removeAdded(c: OverridesFile, kind: "items" | "recipes", id: string): { next: OverridesFile; alsoRemoved: string[] } {
  const next: OverridesFile = structuredClone(c);
  const alsoRemoved: string[] = [];
  delete next.added?.[kind]?.[id];
  if (kind === "items") {
    for (const [rid, r] of Object.entries(next.added?.recipes ?? {})) {
      if (Object.hasOwn(r.inputs, id) || Object.hasOwn(r.outputs, id)) {
        delete next.added!.recipes![rid];
        alsoRemoved.push(rid);
      }
    }
  }
  tidy(next);
  return { next, alsoRemoved };
}

/** Retire les sections vides (export lisible). */
function tidy(c: OverridesFile): void {
  for (const k of ["items", "recipes"] as const) if (c.added?.[k] && !Object.keys(c.added[k]!).length) delete c.added[k];
  if (c.added && !Object.keys(c.added).length) delete c.added;
  if (c.removed?.recipes && !Object.keys(c.removed.recipes).length) delete c.removed.recipes;
  if (c.removed && !Object.keys(c.removed).length) delete c.removed;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Identifiant libre : « base », sinon « base-2 », « base-3 »… */
function freeId(base: string, taken: (id: string) => boolean): string {
  const b = base || "ajout";
  if (!taken(b)) return b;
  for (let n = 2; ; n++) if (!taken(`${b}-${n}`)) return `${b}-${n}`;
}

/** Identifiant d'un objet ajouté, tiré de son nom (« Titanium Bolt » → « titanium-bolt »). */
export const newItemId = (name: string, taken: (id: string) => boolean) => freeId(slug(name), taken);
/** Identifiant d'un craft ajouté : « ajout-<machine>-<première sortie> ». */
export const newRecipeId = (machine: string, output: string, taken: (id: string) => boolean) => freeId(`ajout-${machine}-${output}`.slice(0, 70), taken);

/** Fusionne deux fichiers de corrections (b l'emporte). */
export function mergeCorrections(a: OverridesFile, b: OverridesFile): OverridesFile {
  const out: OverridesFile = structuredClone(a);
  for (const scope of ["recipes", "machines", "items", "research"] as Scope[]) {
    for (const [id, fields] of Object.entries(b[scope] ?? {})) {
      const group = (out[scope] ??= {});
      group[id] = { ...(group[id] ?? {}), ...fields };
    }
  }
  for (const k of ["items", "recipes"] as const) {
    const add = b.added?.[k];
    if (add && Object.keys(add).length) ((out.added ??= {})[k] as Record<string, unknown>) = { ...(out.added?.[k] ?? {}), ...structuredClone(add) };
  }
  if (b.removed?.recipes && Object.keys(b.removed.recipes).length) (out.removed ??= {}).recipes = { ...(out.removed?.recipes ?? {}), ...structuredClone(b.removed.recipes) };
  return out;
}

/**
 * Corrections locales déjà intégrées à data/overrides.json (même date de saisie) : la copie
 * locale est retirée. Renvoie le nombre de corrections retirées.
 */
export function pruneIntegratedCorrections(local: OverridesFile, repo: OverridesFile): { kept: OverridesFile; dropped: number } {
  const kept: OverridesFile = structuredClone(local);
  let dropped = 0;
  for (const scope of ["recipes", "machines", "items", "research"] as Scope[]) {
    for (const [id, fields] of Object.entries(kept[scope] ?? {})) {
      for (const [field, entry] of Object.entries(fields)) {
        if (repo[scope]?.[id]?.[field]?.source.fetchedAt === entry.source?.fetchedAt) {
          delete fields[field];
          dropped++;
        }
      }
      if (!Object.keys(fields).length) delete kept[scope]![id];
    }
  }
  const same = (a: { source?: Source } | undefined, b: { source?: Source } | undefined) => !!a?.source?.fetchedAt && a.source.fetchedAt === b?.source?.fetchedAt;
  for (const k of ["items", "recipes"] as const) {
    for (const [id, a] of Object.entries(kept.added?.[k] ?? {})) {
      if (same(a, repo.added?.[k]?.[id])) {
        delete kept.added![k]![id];
        dropped++;
      }
    }
  }
  for (const [id, r] of Object.entries(kept.removed?.recipes ?? {})) {
    if (same(r, repo.removed?.recipes?.[id])) {
      delete kept.removed!.recipes![id];
      dropped++;
    }
  }
  tidy(kept);
  return { kept, dropped };
}

// ---------------------------------------------------------------- notes sur les valeurs à vérifier

/**
 * Notes laissées sur une valeur à vérifier, quand une valeur seule ne suffit pas (ex. deux ports
 * d'entrée pour la même ressource). Clé : « recipes|id|champ » ou « machines|id|champ ».
 * Exportées avec les corrections (clé `_notes` de overrides.json), ignorées par le calcul.
 */
export type Notes = Record<string, { text: string; at: string }>;

export const noteKey = (scope: "recipes" | "machines", id: string, field: string) => `${scope}|${id}|${field}`;

export function loadNotes(): Notes {
  const n = read<Notes>(KEY_NOTES);
  return n && typeof n === "object" && !Array.isArray(n) ? cleanNotes(n) : {};
}
export function saveNotes(n: Notes): void {
  write(KEY_NOTES, n);
}
/** Garde les notes bien formées (texte non vide, 1000 caractères au plus). */
export function cleanNotes(raw: unknown): Notes {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Notes = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const t = (v as { text?: unknown })?.text;
    const at = (v as { at?: unknown })?.at;
    if (typeof t === "string" && t.trim() && /^(recipes|machines)\|[^|]+\|.+$/.test(k)) out[k] = { text: t.trim().slice(0, 1000), at: typeof at === "string" ? at : new Date().toISOString() };
  }
  return out;
}

/** Valide grossièrement un fichier importé. */
export function isOverridesFile(x: unknown): x is OverridesFile {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  for (const scope of ["recipes", "machines", "items", "research"]) {
    const g = (x as Record<string, unknown>)[scope];
    if (g !== undefined && (typeof g !== "object" || g === null || Array.isArray(g))) return false;
  }
  const isMap = (g: unknown) => g === undefined || (typeof g === "object" && g !== null && !Array.isArray(g));
  const o = x as OverridesFile;
  if (!isMap(o.added) || !isMap(o.removed) || !isMap(o.added?.items) || !isMap(o.added?.recipes) || !isMap(o.removed?.recipes)) return false;
  return true;
}
