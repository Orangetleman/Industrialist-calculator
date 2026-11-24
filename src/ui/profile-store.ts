// Profil actif du site (PLAN-PARTAGE.md § 6 ter, P3 bis b). D'ordinaire, « Ma partie » vient du stockage du navigateur.
// Pendant une session de lecture, les clés du profil se lisent et s'écrivent dans un enregistrement à part : ce qu'on
// y change ne peut pas toucher la partie du joueur, dont les clés ne sont alors plus écrites.

import type { DesignProfile } from "../engine/share/index.ts";

/** Les clés du profil. Tout le reste (langue, thème, images, notes, remarques, modulaires…) reste au joueur. */
export const PROFILE_KEYS = {
  progress: "ind-calc:v1:progress",
  player: "ind-calc:v1:player",
  journal: "ind-calc:v1:rp-journal",
  corrections: "ind-calc:v1:corrections",
  surveys: "ind-calc:v1:batiments",
  interfaces: "ind-calc:v1:interfaces",
  diesel: "ind-calc:v1:diesel",
} as const;
const ROUTED = new Set<string>(Object.values(PROFILE_KEYS));
const KEY_LECTURE = "ind-calc:v1:lecture";

/** `design` : le design affiché ; `back` : celui où revenir ; `mine` : « Ma production » d'avant (rangée dans les réglages). */
export type Lecture = { design: number | null; back: number | null; mine: { existing: Record<string, number>; useExisting: boolean } | null; keys: Record<string, string> };
export type LectureInfo = Omit<Lecture, "keys">;

/** Le profil d'un lien, au format de chaque clé. Le journal des RP n'y est jamais. */
export function profileKeys(p: DesignProfile): Record<string, string> {
  const out: Record<string, string> = { [PROFILE_KEYS.progress]: JSON.stringify(p.progress), [PROFILE_KEYS.player]: JSON.stringify(p.player) };
  if (p.corrections !== undefined) out[PROFILE_KEYS.corrections] = JSON.stringify(p.corrections);
  if (p.surveys !== undefined) out[PROFILE_KEYS.surveys] = JSON.stringify({ machines: p.surveys });
  if (p.interfaces !== undefined) out[PROFILE_KEYS.interfaces] = JSON.stringify({ interfaces: p.interfaces });
  if (p.diesel !== undefined) out[PROFILE_KEYS.diesel] = JSON.stringify({ diesel: p.diesel });
  return out;
}

export function readLecture(raw: unknown): Lecture | null {
  const l = raw as Partial<Lecture> | null;
  if (!l || typeof l !== "object" || !l.keys || typeof l.keys !== "object") return null;
  const keys = Object.fromEntries(Object.entries(l.keys).filter(([k, v]) => ROUTED.has(k) && typeof v === "string"));
  if (!keys[PROFILE_KEYS.progress] || !keys[PROFILE_KEYS.player]) return null;
  const id = (x: unknown) => (Number.isSafeInteger(x) ? (x as number) : null);
  const m = l.mine;
  return { design: id(l.design), back: id(l.back), mine: m && typeof m === "object" && m.existing && typeof m.existing === "object" ? { existing: m.existing, useExisting: m.useExisting !== false } : null, keys };
}

const bare = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
let cur: Lecture | null = (() => {
  try {
    return readLecture(JSON.parse(bare(KEY_LECTURE) ?? "null"));
  } catch {
    return null;
  }
})();
/** Pendant l'essai d'un design reçu (`withProfile`), rien n'est enregistré. */
let trial = false;
function persist(): void {
  if (trial) return;
  try {
    if (cur) localStorage.setItem(KEY_LECTURE, JSON.stringify(cur));
    else localStorage.removeItem(KEY_LECTURE);
  } catch {
    // stockage indisponible : la session vaut pour cette visite
  }
}

/** Lecture et écriture d'une clé du profil actif (lève comme `localStorage` s'il est indisponible). */
export function getItem(key: string): string | null {
  if (cur && ROUTED.has(key)) return cur.keys[key] ?? null;
  return localStorage.getItem(key);
}
export function setItem(key: string, value: string): void {
  if (!cur || !ROUTED.has(key)) return localStorage.setItem(key, value);
  if (cur.keys[key] === value) return;
  cur.keys[key] = value;
  persist();
}

export const lecture = (): LectureInfo | null => cur;
export function enterLecture(p: DesignProfile, info: LectureInfo): void {
  cur = { ...info, keys: profileKeys(p) };
  persist();
}
/** Le design affiché a changé d'identité (remplacé, lien de bac à sable) sans changer de profil. */
export function setLectureDesign(design: number | null): void {
  if (!cur || cur.design === design) return;
  cur.design = design;
  persist();
}
export function leaveLecture(): void {
  cur = null;
  persist();
}
/** Essai d'un design reçu avec le profil de son auteur : le temps de `fn`, rien ne s'enregistre. */
export function withProfile<T>(p: DesignProfile | null, fn: () => T): T {
  if (!p) return fn();
  const keep = cur, was = trial;
  trial = true;
  cur = { design: null, back: null, mine: null, keys: profileKeys(p) };
  try {
    return fn();
  } finally {
    cur = keep;
    trial = was;
  }
}
/** Une clé de la partie du joueur, même pendant une session de lecture (horloge « Je joue » seulement). */
export const ownItem = bare;
export function setOwnItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // idem
  }
}
