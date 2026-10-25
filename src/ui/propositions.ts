// Page « Propositions » (S36), côté site, sans DOM (sauf localStorage, crypto et fetch, passés en paramètre pour
// les tests) : sujets publiés par l'auteur, votes ▲ / ▼ comme sur Reddit (modifiables et retirables), texte dans la
// langue du visiteur. Il n'y a pas de compte : le navigateur tire une fois pour toutes un identifiant de vote au
// hasard (rien de personnel), qui seul permet au service de reconnaître son vote pour le changer plus tard.

import type { Lang } from "../i18n/i18n.ts";

const API = "/api/propositions";
const KEY_VOTANT = "ind-calc:v1:votant";
const KEY_VOTES = "ind-calc:v1:votes";

export type SubjectState = "propose" | "prevu" | "fait" | "refuse";
export const SUBJECT_STATES: SubjectState[] = ["propose", "prevu", "fait", "refuse"];
export type Vote = 1 | -1 | 0;

/** Un sujet publié, tel que le rend le service (server/service.ts, propositions). */
export type Subject = {
  id: number;
  titre: string;
  titre_en: string | null;
  description: string | null;
  description_en: string | null;
  reponse: string | null;
  reponse_en: string | null;
  /** Champs traduits automatiquement et pas encore relus par l'auteur. */
  auto: string[];
  etat: SubjectState;
  maj: number | null;
  cree: number;
  demandes: number;
  pour: number;
  contre: number;
  score: number;
  monVote: Vote;
};

/** Un texte public d'un sujet dans la langue du visiteur. */
export type Shown = {
  text: string;
  /** Traduit automatiquement et pas encore relu : l'original est montré à la demande. */
  auto: boolean;
  /** Pas de texte dans la langue du visiteur : celui de l'autre langue, marqué « (FR) » ou « (EN) ». */
  other: Lang | null;
  original: string | null;
};

type Field = "titre" | "description" | "reponse";
/** Le champ anglais de chaque texte public (colonnes du service). */
const EN_FIELD = { titre: "titre_en", description: "description_en", reponse: "reponse_en" } as const;

/** Le texte à montrer : celui de la langue du visiteur, sinon celui de l'autre langue (marqué). */
export function shown(s: Subject, field: Field, lang: Lang): Shown | null {
  const fr = s[field]?.trim() || null;
  const en = s[EN_FIELD[field]]?.trim() || null;
  const mine = lang === "en" ? en : fr;
  const other = lang === "en" ? fr : en;
  const key = lang === "en" ? EN_FIELD[field] : field;
  if (mine) return { text: mine, auto: s.auto.includes(key), other: null, original: s.auto.includes(key) ? other : null };
  if (other) return { text: other, auto: false, other: lang === "en" ? "fr" : "en", original: null };
  return null;
}

/** Nombre de joueurs qui l'ont demandé : les remarques rangées et les votes ▲. */
export const askedBy = (s: Subject): number => s.demandes + s.pour;

/** Nouveau vote après un clic sur ▲ (1) ou ▼ (−1) : un 2ᵉ clic sur le même le retire (comme sur Reddit). */
export const nextVote = (current: Vote, clicked: 1 | -1): Vote => (current === clicked ? 0 : clicked);

/** Le sujet tel qu'il sera après ce vote (affiché tout de suite, avant la réponse du service). */
export function withVote(s: Subject, v: Vote): Subject {
  const pour = s.pour - (s.monVote === 1 ? 1 : 0) + (v === 1 ? 1 : 0);
  const contre = s.contre - (s.monVote === -1 ? 1 : 0) + (v === -1 ? 1 : 0);
  return { ...s, pour, contre, score: s.demandes + pour - contre, monVote: v };
}

export type Sort = "score" | "recent";
/** Recherche (titre et description, dans les deux langues), filtre d'état, tri ; faits et refusés en bas. */
export function filterSubjects(list: Subject[], q: string, state: SubjectState | "", sort: Sort): Subject[] {
  const words = q.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/\s+/).filter(Boolean);
  const hay = (s: Subject) =>
    [s.titre, s.titre_en, s.description, s.description_en].filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const done = (s: Subject) => (s.etat === "fait" || s.etat === "refuse" ? 1 : 0);
  return list
    .filter((s) => (!state || s.etat === state) && words.every((w) => hay(s).includes(w)))
    .sort((a, b) => done(a) - done(b) || (sort === "recent" ? (b.maj ?? b.cree) - (a.maj ?? a.cree) : b.score - a.score) || a.id - b.id);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible : pour cette visite seulement
  }
}

let session: string | null = null;
/** L'identifiant de vote de ce navigateur : tiré au hasard la première fois, puis gardé. */
export function voterId(random: (a: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (a) => crypto.getRandomValues(a)): string {
  const kept = read<string | null>(KEY_VOTANT, null);
  if (typeof kept === "string" && /^[\w-]{16,64}$/.test(kept)) return kept;
  if (session) return session;
  const bytes = random(new Uint8Array(18));
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  session = id;
  write(KEY_VOTANT, id);
  return id;
}

/** Les votes de ce navigateur, gardés aussi ici (montrés même si le service ne répond pas). */
export const loadVotes = (): Record<string, Vote> => read<Record<string, Vote>>(KEY_VOTES, {});
export function rememberVote(id: number, v: Vote): void {
  const all = loadVotes();
  if (v === 0) delete all[id];
  else all[id] = v;
  write(KEY_VOTES, all);
}

export type LoadResult = { ok: true; list: Subject[] } | { ok: false };
/** Relit les sujets publiés, avec le vote de ce navigateur ; ne lève jamais d'erreur. */
export async function loadSubjects(envoyer: typeof fetch = fetch, votant = voterId()): Promise<LoadResult> {
  try {
    const r = await envoyer(API, { headers: { "X-Votant": votant } });
    if (!r.ok) return { ok: false };
    const list = (await r.json()) as Subject[];
    if (!Array.isArray(list)) return { ok: false };
    return { ok: true, list: list.map((s) => ({ ...s, auto: Array.isArray(s.auto) ? s.auto : [] })) };
  } catch {
    return { ok: false };
  }
}

export type VoteResult = { ok: true; pour: number; contre: number; score: number; demandes: number; monVote: Vote } | { ok: false; code: string };
/** Envoie un vote (1, −1, ou 0 pour le retirer) ; ne lève jamais d'erreur. */
export async function sendVote(id: number, v: Vote, envoyer: typeof fetch = fetch, votant = voterId()): Promise<VoteResult> {
  try {
    const r = await envoyer(`${API}/${id}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ votant, valeur: v }) });
    const corps = (await r.json().catch(() => ({}))) as Partial<Extract<VoteResult, { ok: true }>> & { erreur?: string };
    if (r.ok && typeof corps.score === "number") return { ok: true, pour: corps.pour!, contre: corps.contre!, score: corps.score, demandes: corps.demandes!, monVote: corps.monVote! };
    return { ok: false, code: corps.erreur ?? (r.status >= 500 ? "reseau" : `http-${r.status}`) };
  } catch {
    return { ok: false, code: "reseau" };
  }
}
