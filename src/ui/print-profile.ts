// « Imprimer le profil » d'un design sur la partie du joueur (PLAN-PARTAGE.md § 6 ter, P3 bis c). Pur, sans DOM ni stockage.
// La partie d'avant est gardée avec le design imprimé : le supprimer la remet ; le restaurer remet l'impression.

import type { DesignProfile } from "../engine/share/index.ts";
import { addEvent, parseJournal, startJournal, stopAtLastSeen } from "../engine/rp-history.ts";
import type { PlayerInfo } from "./progress.ts";
import { PROFILE_KEYS } from "./profile-store.ts";
import { mergeCorrections } from "./state.ts";
import type { OverridesFile } from "../engine/types.ts";

export const PRINT_GROUPS = ["research", "game", "plot", "money", "setup", "contrib"] as const;
export type PrintGroup = (typeof PRINT_GROUPS)[number];
/** Les clés de la partie du joueur, telles qu'enregistrées (null : absente). */
export type OwnKeys = Record<string, string | null>;

const FIELDS: Partial<Record<PrintGroup, (keyof PlayerInfo)[]>> = {
  game: ["difficulty", "pollutionPct", "month", "igloo", "gamePass"],
  plot: ["plotW", "plotH"],
  money: ["money", "rp", "rpPerSec"],
  setup: ["research"],
};
const json = (s: string | null | undefined): Record<string, unknown> => {
  try {
    const x: unknown = JSON.parse(s ?? "null");
    return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const obj = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});

export const hasContrib = (p: DesignProfile): boolean => p.corrections !== undefined || p.surveys !== undefined || p.interfaces !== undefined || p.diesel !== undefined;
/** Ce que ce profil permet d'imprimer. */
export const groupsOf = (p: DesignProfile): PrintGroup[] => PRINT_GROUPS.filter((g) => (g === "contrib" ? hasContrib(p) : !!p.player));

/** La partie après impression. Les contributions s'ajoutent aux siennes (celles du design l'emportent), le reste remplace. */
export function printOnto(own: OwnKeys, p: DesignProfile, groups: readonly PrintGroup[], now: number): OwnKeys {
  const K = PROFILE_KEYS, out: OwnKeys = { ...own };
  if (groups.includes("research") && p.progress) out[K.progress] = JSON.stringify(p.progress);
  if (p.player) {
    const before = json(own[K.player]), pl: Record<string, unknown> = { ...before };
    for (const g of groups) for (const f of FIELDS[g] ?? []) pl[f] = p.player[f] ?? null;
    const money = groups.includes("money"), setup = groups.includes("setup");
    if (money) pl.rpAt = pl.rp === null ? null : now;
    out[K.player] = JSON.stringify(pl);
    if (money || setup) {
      // Les RP estimés viennent du journal : il reçoit le relevé et la configuration, comme une saisie.
      const player = { rp: null, rpPerSec: null, rpAt: null, research: null, ...before } as Parameters<typeof startJournal>[1];
      let j = parseJournal(own[K.journal] ? json(own[K.journal]) : null) ?? startJournal(now, player);
      if (setup && pl.research) j = addEvent(j, { type: "config", setup: pl.research as NonNullable<PlayerInfo["research"]> }, now);
      if (money && (pl.rp !== null || pl.rpPerSec !== null)) j = addEvent(j, { type: "releve", rp: pl.rp as number | null, rps: pl.rpPerSec as number | null }, now);
      out[K.journal] = JSON.stringify(j);
    }
  }
  if (groups.includes("contrib")) {
    if (p.corrections !== undefined) out[K.corrections] = JSON.stringify(mergeCorrections(json(own[K.corrections]) as OverridesFile, p.corrections as OverridesFile));
    if (p.surveys !== undefined) out[K.surveys] = JSON.stringify({ machines: { ...obj(json(own[K.surveys]).machines), ...obj(p.surveys) } });
    if (p.interfaces !== undefined) out[K.interfaces] = JSON.stringify({ interfaces: { ...obj(json(own[K.interfaces]).interfaces), ...obj(p.interfaces) } });
    if (Array.isArray(p.diesel)) {
      const mine = json(own[K.diesel]).diesel, theirs = new Set(p.diesel.map((x) => obj(x).id));
      out[K.diesel] = JSON.stringify({ diesel: [...(Array.isArray(mine) ? mine.filter((x) => !theirs.has(obj(x).id)) : []), ...p.diesel] });
    }
  }
  return out;
}

/** Une partie remise : « Je joue » y est arrêté (le temps passé depuis ne compte pas). */
export function settled(keys: OwnKeys, now: number): OwnKeys {
  const raw = keys[PROFILE_KEYS.journal];
  const j = raw ? parseJournal(json(raw)) : null;
  return j?.clock.playing ? { ...keys, [PROFILE_KEYS.journal]: JSON.stringify(stopAtLastSeen(j, now)) } : keys;
}

/** `on` : impressions en vigueur, la dernière en fin, avec la partie d'avant ; `off` : défaites par la corbeille, avec la partie d'alors. */
export type Printed = { design: number; name: string; keys: OwnKeys };
export type Prints = { on: Printed[]; off: Printed[] };
export const noPrints = (): Prints => ({ on: [], off: [] });

export function readPrints(raw: unknown): Prints {
  const r = obj(raw);
  const list = (x: unknown): Printed[] =>
    (Array.isArray(x) ? x : []).filter((e): e is Printed => {
      const o = obj(e);
      return Number.isSafeInteger(o.design) && typeof o.name === "string" && !!o.keys && Object.values(obj(o.keys)).every((v) => v === null || typeof v === "string");
    });
  return { on: list(r.on), off: list(r.off) };
}

export type Undo = { prints: Prints; /** La partie à remettre. */ apply: OwnKeys | null };
/** Un design imprimé n'est plus là. La dernière impression se défait ; une plus ancienne cède sa partie d'avant à la suivante. */
export function unprint(p: Prints, design: number, own: OwnKeys): Undo {
  const i = p.on.findLastIndex((e) => e.design === design);
  if (i < 0) return { prints: p, apply: null };
  const e = p.on[i]!, on = p.on.filter((_, k) => k !== i);
  if (i < p.on.length - 1) {
    on[i] = { ...on[i]!, keys: e.keys };
    return { prints: { on, off: p.off }, apply: null };
  }
  return { prints: { on, off: [...p.off.filter((x) => x.design !== design), { ...e, keys: own }] }, apply: e.keys };
}
/** Un design imprimé, jeté puis restauré : son impression revient. */
export function reprint(p: Prints, design: number, own: OwnKeys): Undo {
  const e = p.off.find((x) => x.design === design);
  if (!e) return { prints: p, apply: null };
  return { prints: { on: [...p.on, { ...e, keys: own }], off: p.off.filter((x) => x !== e) }, apply: e.keys };
}
