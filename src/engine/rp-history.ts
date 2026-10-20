// Historique des RP (lot S21) : temps de jeu, journal et courbe par morceaux. Pur.
//
// Règle de jeu (utilisateur, 2026-10-20) : les RP ne s'accumulent que quand le joueur est connecté.
// Le site compte donc en **temps de jeu** : une horloge qui n'avance qu'entre « Je joue » et « Je ne
// joue plus ». Chaque événement du journal est daté deux fois : `g`, temps de jeu (ms depuis le début
// du journal), qui place la courbe ; `at`, heure réelle, pour l'affichage.
//
// La courbe repart de chaque relevé et de chaque dépense, avec la configuration en vigueur
// (`balanceAfter`, plafond souple compris), et n'avance qu'en temps de jeu.

import { balanceAfter, parseResearchSetup, rateAt, type ResearchSetup, type RpTier } from "./research-balance.ts";

/** Saisies à moins de 2 min de jeu d'écart : fondues en un seul événement (Q21.3). */
export const MERGE_MS = 2 * 60_000;
/** Temps de jeu gardé dans le journal (Q21.4). */
export const KEEP_MS = 90 * 86_400_000;
/** Site fermé plus longtemps que ça pendant « Je joue » : on demande à la réouverture (Q22.1). */
export const RECALL_MS = 30 * 60_000;

/** Horloge de jeu : `game` ms de jeu cumulées jusqu'à `since` (heure réelle du dernier changement). */
export type PlayClock = { playing: boolean; since: number; game: number; seen: number };

type Stamp = { g: number; at: number };
/** RP et RP/s de la 1ʳᵉ ligne du panneau (l'un ou l'autre peut manquer). */
export type ReleveEvent = Stamp & { type: "releve"; rp: number | null; rps: number | null };
/** Toute la saisie de « Ma recherche », enregistrée à chaque modification. */
export type ConfigEvent = Stamp & { type: "config"; setup: ResearchSetup | null };
/** Recherches débloquées (ou rendues) sur le site : `spent` > 0 dépensé, < 0 rendu. */
export type DepenseEvent = Stamp & { type: "depense"; spent: number; added: string[]; removed: string[] };
/** « Je joue » (on) ou « Je ne joue plus ». */
export type SessionEvent = Stamp & { type: "session"; on: boolean };
export type RpEvent = ReleveEvent | ConfigEvent | DepenseEvent | SessionEvent;
type Draft = Omit<ReleveEvent, "g" | "at"> | Omit<ConfigEvent, "g" | "at"> | Omit<DepenseEvent, "g" | "at">;

export type RpJournal = { clock: PlayClock; events: RpEvent[] };

// ---------------------------------------------------------------- horloge

export const newJournal = (now: number): RpJournal => ({ clock: { playing: false, since: now, game: 0, seen: now }, events: [] });

/** Temps de jeu (ms) à l'heure réelle `now`. */
export const gameNow = (c: PlayClock, now: number) => c.game + (c.playing ? Math.max(0, now - c.since) : 0);

/**
 * Premier journal, depuis la saisie d'avant S21 (Q22.2) : le dernier relevé et la configuration
 * deviennent le premier point, hors jeu ; l'estimation en temps réel est abandonnée.
 */
export function startJournal(now: number, player: { rp: number | null; rpPerSec: number | null; rpAt: number | null; research: ResearchSetup | null }): RpJournal {
  const j = newJournal(now);
  const at = player.rpAt ?? now;
  if (player.research) j.events.push({ type: "config", g: 0, at, setup: player.research });
  if (player.rp !== null || player.rpPerSec !== null) j.events.push({ type: "releve", g: 0, at, rp: player.rp, rps: player.rpPerSec });
  return j;
}

/** « Je joue » / « Je ne joue plus ». */
export function setPlaying(j: RpJournal, on: boolean, now: number): RpJournal {
  if (j.clock.playing === on) return j;
  const g = gameNow(j.clock, now);
  return { clock: { playing: on, since: now, game: g, seen: now }, events: [...j.events, { type: "session", g, at: now, on }] };
}

/** Le site est ouvert : retient l'heure (pour savoir, à la réouverture, depuis quand il était fermé). */
export const touch = (j: RpJournal, now: number): RpJournal => ({ ...j, clock: { ...j.clock, seen: now } });

/** « Je joue » est resté actif pendant que le site était fermé plus de 30 min. */
export const needsRecall = (j: RpJournal, now: number) => j.clock.playing && now - j.clock.seen > RECALL_MS;

/** « J'ai arrêté à la fermeture du site » : la session finit à la dernière heure où le site était ouvert. */
export function stopAtLastSeen(j: RpJournal, now: number): RpJournal {
  if (!j.clock.playing) return j;
  const seen = Math.max(j.clock.since, Math.min(j.clock.seen, now));
  const g = gameNow(j.clock, seen);
  return { clock: { playing: false, since: seen, game: g, seen: now }, events: [...j.events, { type: "session", g, at: seen, on: false }] };
}

// ---------------------------------------------------------------- journal

const sameSetup = (a: ResearchSetup | null, b: ResearchSetup | null) => JSON.stringify(a) === JSON.stringify(b);

/** Configuration en vigueur avant l'événement d'indice `i` (exclu). */
function configBefore(events: readonly RpEvent[], i: number): ResearchSetup | null {
  for (let k = i - 1; k >= 0; k--) {
    const e = events[k]!;
    if (e.type === "config") return e.setup;
  }
  return null;
}

/** Indice de l'événement du même type à fondre avec un nouveau (à moins de 2 min de jeu, sans dépense ni session entre eux). */
function mergeTarget(events: readonly RpEvent[], type: RpEvent["type"], g: number): number {
  for (let k = events.length - 1; k >= 0; k--) {
    const e = events[k]!;
    if (g - e.g >= MERGE_MS) return -1;
    if (e.type === type) return k;
    if (e.type === "depense" || e.type === "session") return -1;
  }
  return -1;
}

/** Retire ce qui se compense (une recherche cochée puis décochée). */
function netNodes(added: string[], removed: string[]): { added: string[]; removed: string[] } {
  const a = [...added];
  const r: string[] = [];
  for (const x of removed) {
    const i = a.indexOf(x);
    if (i >= 0) a.splice(i, 1);
    else r.push(x);
  }
  return { added: a, removed: r };
}

/**
 * Ajoute un événement au temps de jeu actuel. Les saisies rapprochées (moins de 2 min de jeu) se
 * fondent : la dernière valeur l'emporte (relevé, configuration), les dépenses s'additionnent. Une
 * configuration identique à celle en vigueur n'est pas notée.
 */
export function addEvent(j: RpJournal, draft: Draft, now: number): RpJournal {
  const g = gameNow(j.clock, now);
  const events = [...j.events];
  const k = mergeTarget(events, draft.type, g);
  if (draft.type === "releve") {
    if (draft.rp === null && draft.rps === null) return j;
    if (k >= 0) {
      const old = events[k] as ReleveEvent;
      events[k] = { type: "releve", g, at: now, rp: draft.rp ?? old.rp, rps: draft.rps ?? old.rps };
    } else events.push({ type: "releve", g, at: now, rp: draft.rp, rps: draft.rps });
  } else if (draft.type === "config") {
    if (k >= 0) {
      if (sameSetup(configBefore(events, k), draft.setup)) events.splice(k, 1);
      else events[k] = { type: "config", g, at: now, setup: draft.setup };
    } else {
      if (sameSetup(configBefore(events, events.length), draft.setup)) return j;
      events.push({ type: "config", g, at: now, setup: draft.setup });
    }
  } else {
    if (k >= 0) {
      const old = events[k] as DepenseEvent;
      const n = netNodes([...old.added, ...draft.added], [...old.removed, ...draft.removed]);
      const spent = old.spent + draft.spent;
      if (Math.abs(spent) < 1e-9 && !n.added.length && !n.removed.length) events.splice(k, 1);
      else events[k] = { type: "depense", g, at: now, spent, ...n };
    } else if (draft.spent !== 0 || draft.added.length || draft.removed.length) events.push({ type: "depense", g, at: now, spent: draft.spent, added: draft.added, removed: draft.removed });
  }
  return prune({ ...j, events }, g);
}

/** Retire l'événement d'indice `i` (faute de frappe…). Les sessions restent (elles font le temps de jeu). */
export function removeEvent(j: RpJournal, i: number): RpJournal {
  const e = j.events[i];
  if (!e || e.type === "session") return j;
  return { ...j, events: j.events.filter((_, k) => k !== i) };
}

/** Un événement peut-il être retiré ? Pas les sessions, ni la dernière configuration (celle de « Ma recherche »). */
export function removable(j: RpJournal, i: number): boolean {
  const e = j.events[i];
  if (!e || e.type === "session") return false;
  if (e.type === "config") return j.events.slice(i + 1).some((x) => x.type === "config");
  return true;
}

/**
 * Ne garde que 90 jours de jeu. Les points de départ plus anciens restent (dernier relevé des RP,
 * dernières RP/s, dernière configuration) : la courbe repart d'eux.
 */
export function prune(j: RpJournal, gNow: number, keep = KEEP_MS): RpJournal {
  const cut = gNow - keep;
  if (!j.events.some((e) => e.g < cut)) return j;
  const anchor = (pred: (e: RpEvent) => boolean) => {
    for (let k = j.events.length - 1; k >= 0; k--) if (j.events[k]!.g < cut && pred(j.events[k]!)) return k;
    return -1;
  };
  const kept = new Set([anchor((e) => e.type === "releve" && e.rp !== null), anchor((e) => e.type === "releve" && e.rps !== null), anchor((e) => e.type === "config")]);
  return { ...j, events: j.events.filter((e, k) => e.g >= cut || kept.has(k)) };
}

// ---------------------------------------------------------------- lecture (navigateur, fichier)

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);

/** Relit un journal gardé ou exporté ; null s'il est absent ou illisible. */
export function parseJournal(raw: unknown): RpJournal | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const c = (r.clock ?? {}) as Record<string, unknown>;
  const since = num(c.since);
  const game = num(c.game);
  if (since === null || game === null || !Array.isArray(r.events)) return null;
  const clock: PlayClock = { playing: c.playing === true, since, game, seen: num(c.seen) ?? since };
  const events: RpEvent[] = [];
  for (const x of r.events) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    const g = num(e.g);
    const at = num(e.at);
    if (g === null || at === null) continue;
    if (e.type === "releve") events.push({ type: "releve", g, at, rp: num(e.rp), rps: num(e.rps) });
    else if (e.type === "config") events.push({ type: "config", g, at, setup: parseResearchSetup(e.setup) });
    else if (e.type === "depense" && num(e.spent) !== null) events.push({ type: "depense", g, at, spent: num(e.spent)!, added: strs(e.added), removed: strs(e.removed) });
    else if (e.type === "session") events.push({ type: "session", g, at, on: e.on === true });
  }
  events.sort((a, b) => a.g - b.g); // tri stable : l'ordre de saisie est gardé à temps égal
  return { clock, events };
}

// ---------------------------------------------------------------- courbe

/** Les tiers d'une configuration (null : rien de renseigné, les RP ne bougent pas). */
export type TiersOf = (setup: ResearchSetup | null, rps: number | null) => RpTier[] | null;

/** Un morceau de courbe : entre `from` et `to` (ms de jeu), depuis `rp0`, avec `tiers`. */
export type Piece = { from: number; to: number; rp0: number; tiers: RpTier[] | null };
/** Un relevé et ce que le site prévoyait juste avant. */
export type Reading = { index: number; g: number; at: number; rp: number | null; rps: number | null; predRp: number | null; predRps: number | null };
/** Un repère : changement de configuration ou dépense, avec les RP avant et après. */
export type Mark =
  | { index: number; g: number; at: number; type: "config"; prev: ResearchSetup | null; setup: ResearchSetup | null; rp: number | null; rateBefore: number | null; rateAfter: number | null }
  | { index: number; g: number; at: number; type: "depense"; spent: number; added: string[]; removed: string[]; before: number | null; after: number | null };
/** Une reconnexion : « Je joue » après « Je ne joue plus » (hors jeu de `offAt` à `onAt`, heures réelles). */
export type Reconnect = { g: number; offAt: number; onAt: number };

export type RpHistory = { pieces: Piece[]; readings: Reading[]; marks: Mark[]; reconnects: Reconnect[]; first: number | null; end: number };

/** Solde d'un morceau au temps de jeu `g` (borné à sa fin). */
export const evalPiece = (p: Piece, g: number) => (p.tiers ? balanceAfter(p.tiers, p.rp0, (Math.min(g, p.to) - p.from) / 1000) : p.rp0);

/**
 * Refait la courbe du journal jusqu'à `end` (ms de jeu ; au-delà de maintenant, c'est la prévision
 * avec la configuration actuelle). Chaque relevé de RP et chaque dépense ouvre un nouveau morceau ;
 * chaque changement de configuration aussi (la vitesse change, le solde continue).
 */
export function rpHistory(j: RpJournal, tiersOf: TiersOf, end: number): RpHistory {
  const pieces: Piece[] = [];
  const readings: Reading[] = [];
  const marks: Mark[] = [];
  const reconnects: Reconnect[] = [];
  let setup: ResearchSetup | null = null;
  let rps: number | null = null;
  let tiers: RpTier[] | null = null;
  let rp: number | null = null;
  let g = 0;
  let first: number | null = null;
  let lastOff: number | null = null;
  let configs = 0;
  const advance = (to: number, last = false) => {
    if (rp !== null && (to > g || last)) {
      const p: Piece = { from: g, to, rp0: rp, tiers };
      pieces.push(p);
      rp = evalPiece(p, to);
    }
    g = Math.max(g, to);
  };
  const rate = (x: number | null) => (tiers && x !== null ? rateAt(tiers, x) : null);
  j.events.forEach((e, index) => {
    advance(e.g);
    if (e.type === "releve") {
      readings.push({ index, g: e.g, at: e.at, rp: e.rp, rps: e.rps, predRp: rp, predRps: rate(rp) });
      if (e.rp !== null) {
        rp = e.rp;
        first ??= e.g;
      }
      if (e.rps !== null && e.rps !== rps) {
        rps = e.rps;
        tiers = tiersOf(setup, rps);
      }
    } else if (e.type === "config") {
      const before = rate(rp);
      const prev = setup;
      setup = e.setup;
      tiers = tiersOf(setup, rps);
      if (configs++ > 0) marks.push({ index, g: e.g, at: e.at, type: "config", prev, setup, rp, rateBefore: before, rateAfter: rate(rp) });
    } else if (e.type === "depense") {
      const before = rp;
      if (rp !== null) rp = Math.max(0, rp - e.spent);
      marks.push({ index, g: e.g, at: e.at, type: "depense", spent: e.spent, added: e.added, removed: e.removed, before, after: rp });
    } else if (!e.on) lastOff = e.at;
    else if (lastOff !== null) {
      reconnects.push({ g: e.g, offAt: lastOff, onAt: e.at });
      lastOff = null;
    }
  });
  advance(Math.max(end, g), true); // le dernier morceau existe même de longueur nulle (relevé à l'instant)
  return { pieces, readings, marks, reconnects, first, end };
}

/** Morceau de courbe en vigueur au temps de jeu `g` (le dernier qui commence avant). */
function pieceAt(h: RpHistory, g: number): Piece | null {
  let found: Piece | null = null;
  for (const p of h.pieces) {
    if (p.from > g) break;
    found = p;
  }
  return found;
}

/** Solde prévu au temps de jeu `g` (null avant le premier relevé). */
export function rpAtGame(h: RpHistory, g: number): number | null {
  const p = pieceAt(h, g);
  return p ? evalPiece(p, g) : null;
}

/** Vitesse prévue au temps de jeu `g`. */
export function rateAtGame(h: RpHistory, g: number): number | null {
  const p = pieceAt(h, g);
  return p?.tiers ? rateAt(p.tiers, evalPiece(p, g)) : null;
}

/** Tiers en vigueur à la fin de la courbe. */
export const lastTiers = (h: RpHistory) => h.pieces[h.pieces.length - 1]?.tiers ?? null;

/** Écart entre un relevé et la prévision, en RP et en % (null s'il n'y avait pas de prévision). */
export function readingGap(r: Reading): { rp: number; pct: number } | null {
  if (r.rp === null || r.predRp === null || !(r.predRp > 0)) return null;
  return { rp: r.rp - r.predRp, pct: ((r.rp - r.predRp) / r.predRp) * 100 };
}

/** Heure réelle d'un instant de jeu (pendant une session, ou à un événement) ; null si inconnue. */
export function realTimeAt(j: RpJournal, g: number): number | null {
  let start: { g: number; at: number } | null = null;
  for (const e of j.events) {
    if (e.type !== "session") continue;
    if (e.on) start = { g: e.g, at: e.at };
    else if (start) {
      if (g >= start.g && g <= e.g) return start.at + (g - start.g);
      start = null;
    }
  }
  // Session en cours : l'heure réelle avance avec le temps de jeu (prévision : « si tu continues »).
  if (j.clock.playing && start && g >= start.g) return start.at + (g - start.g);
  return null;
}
