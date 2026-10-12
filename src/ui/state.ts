// État de l'interface et persistance locale (localStorage, toujours dans un try/catch).

import type { Criterion } from "../engine/choose.ts";
import type { OverrideEntry, OverridesFile, Source } from "../engine/types.ts";

export type Settings = {
  /** Objectif : produire un objet, ou gagner de l'argent ($/min). */
  goal: "objet" | "argent" | "énergie" | "recherche";
  item: string;
  mode: "rate" | "machines";
  rate: number;
  machines: number;
  criterion: Criterion;
  useUnverified: boolean;
  forced: Record<string, string>;
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
  /** Objectif énergie : MF/s voulus, production garantie ou moyenne, sans combustible, distance. */
  energyMFps: number;
  energyGuaranteed: boolean;
  energyNoFuel: boolean;
  distanceTiles: number | null;
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
  mode: "machines",
  rate: 60,
  machines: 15,
  criterion: "energy",
  useUnverified: false,
  forced: {},
  money: 10000,
  selfPowered: false,
  maxPollution: null,
  useBudget: false,
  existing: {},
  energyMFps: 1_000_000,
  energyGuaranteed: false,
  energyNoFuel: false,
  distanceTiles: null,
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
  const { allUnlocked: _ancien, ...rest } = s as Partial<Settings> & { allUnlocked?: unknown };
  const out: Settings = { ...DEFAULT_SETTINGS, ...rest };
  if (!["machines", "energy", "raw", "steps", "pollution", "cost", "area"].includes(out.criterion)) out.criterion = DEFAULT_SETTINGS.criterion;
  if (out.goal !== "objet" && out.goal !== "argent" && out.goal !== "énergie" && out.goal !== "recherche") out.goal = "objet";
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
  return out;
}
export function saveSettings(s: Settings): void {
  write(KEY_SETTINGS, s);
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
  return n;
}

/** Fusionne deux fichiers de corrections (b l'emporte). */
export function mergeCorrections(a: OverridesFile, b: OverridesFile): OverridesFile {
  const out: OverridesFile = structuredClone(a);
  for (const scope of ["recipes", "machines", "items", "research"] as Scope[]) {
    for (const [id, fields] of Object.entries(b[scope] ?? {})) {
      const group = (out[scope] ??= {});
      group[id] = { ...(group[id] ?? {}), ...fields };
    }
  }
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
  return { kept, dropped };
}

/** Valide grossièrement un fichier importé. */
export function isOverridesFile(x: unknown): x is OverridesFile {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  for (const scope of ["recipes", "machines", "items", "research"]) {
    const g = (x as Record<string, unknown>)[scope];
    if (g !== undefined && (typeof g !== "object" || g === null || Array.isArray(g))) return false;
  }
  return true;
}
