// État de l'interface et persistance locale (localStorage, toujours dans un try/catch).

import type { Criterion } from "../engine/choose.ts";
import type { OverrideEntry, OverridesFile, Source } from "../engine/types.ts";

export type Settings = {
  item: string;
  mode: "rate" | "machines";
  rate: number;
  machines: number;
  criterion: Criterion;
  useUnverified: boolean;
  forced: Record<string, string>;
};

export const DEFAULT_SETTINGS: Settings = {
  item: "crankshaft",
  mode: "machines",
  rate: 60,
  machines: 15,
  criterion: "energy",
  useUnverified: false,
  forced: {},
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
  if (!["machines", "energy", "raw"].includes(out.criterion)) out.criterion = DEFAULT_SETTINGS.criterion;
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

/** Valide grossièrement un fichier importé. */
export function isOverridesFile(x: unknown): x is OverridesFile {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  for (const scope of ["recipes", "machines", "items", "research"]) {
    const g = (x as Record<string, unknown>)[scope];
    if (g !== undefined && (typeof g !== "object" || g === null || Array.isArray(g))) return false;
  }
  return true;
}
