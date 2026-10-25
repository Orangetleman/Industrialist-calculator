// Textes du moteur et des données dans la langue choisie (S32). Pur, sans DOM.
//   say(m)      message du moteur ({ code, valeurs }) → phrase (catalogue « eng.* »)
//   txt(x)      message, ou texte des données (note, doute) traduit par data/i18n/en.json
//   txtHtml(x)  la même chose, échappée ; une note sans traduction garde son français, marquée « (FR) »

import { isMessage, type Message, type MessageValue, type Text } from "../engine/message.ts";
import { joinList, lang, t, type Key } from "../i18n/i18n.ts";
import { dataNote } from "../i18n/data-notes.ts";
import { looksFrench } from "../i18n/data-notes-list.ts";
import { moteurFr as KNOWN } from "../i18n/vues/moteur.fr.ts";
import { esc, fmtMF } from "./format.ts";

const SEP = { virgule: ", ", flèche: " → " } as const;

/** Une valeur d'un message, écrite (un nombre reste un nombre : t() l'écrit selon la langue et accorde le pluriel). */
function value(v: MessageValue): string | number {
  if (v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return v;
  if (isMessage(v)) return say(v);
  if ("mf" in v) return fmtMF(v.mf);
  if ("note" in v) return v.lower ? txt(v.note).toLowerCase() : txt(v.note);
  if ("lc" in v) {
    const s = say(v.lc);
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  const parts = v.join.map((x) => String(value(x)));
  if (v.by === "et") return joinList(parts);
  if (v.by === "point-virgule") return parts.join(lang() === "fr" ? " ; " : "; ");
  return parts.join(SEP[v.by]);
}

/** Le message du moteur, en phrase. */
export function say(m: Message): string {
  const vals: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(m)) if (k !== "code") vals[k] = value(v);
  // Un trou sans valeur (morceau facultatif absent) ne s'écrit pas.
  return t(`eng.${m.code}` as Key, vals).replace(/\{\w+\}/g, "");
}

/**
 * Message du moteur, ou texte des données : dans la langue choisie ; une note sans traduction reste en français,
 * marquée « (FR) ». Un texte qui n'a rien de français (nom du jeu, nombres) s'écrit tel quel.
 */
export function txt(x: Text): string {
  if (isMessage(x)) return say(x);
  if (!x || lang() === "fr") return x;
  return dataNote(x) ?? (looksFrench(x) ? `(FR) ${x}` : x);
}

/** txt(), échappé pour le HTML ; une note restée en français est balisée lang="fr" (lecteurs d'écran, test « rien d'oublié »). */
export function txtHtml(x: Text): string {
  if (isMessage(x) || !x || lang() === "fr") return esc(txt(x));
  const en = dataNote(x);
  return en !== null ? esc(en) : looksFrench(x) ? `(FR) <span lang="fr">${esc(x)}</span>` : esc(x);
}

/** Banc d'empreintes (S32) : un message connu écrit en français, sinon null. */
export function sayAny(x: unknown): string | null {
  return isMessage(x) && `eng.${x.code}` in KNOWN ? say(x) : null;
}

// ---------------------------------------------------------------- ordre de pose (S26)

/** Étape du joueur d'une phrase de l'ordre de pose : bâtiments, tuyaux, électricité (logique : aucune pour l'instant). */
export function orderPhase(m: Message): "batiments" | "tuyaux" | "electricite" | "logique" {
  const o = m.o as MessageValue;
  if (m.code === "ord.eachBlock" && isMessage(o)) return orderPhase(o);
  if (m.code === "ord.eachBlock" && o && typeof o === "object" && "lc" in o) return orderPhase((o as { lc: Message }).lc);
  if (m.code === "ord.place" || m.code === "ord.blocks") return "batiments";
  if (m.code === "ord.poles") return "electricite";
  return "tuyaux";
}

const DIRS = ["N", "E", "S", "W"] as const;
const PAIRS: Record<string, string> = { "d.updown": "d.leftright", "d.leftright": "d.updown", "d.stacked": "d.sideBySide", "d.sideBySide": "d.stacked" };

/**
 * Une phrase de l'ordre de pose dans le sens où le module est posé dans l'usine (S26, défaut G3 de S15) : le module est
 * tourné de `rot` quarts de tour (sens horaire), ses directions (« vers le haut », « à droite »…) tournent avec lui.
 */
export function turnMessage<T extends MessageValue>(v: T, rot: number): T {
  const r = ((rot % 4) + 4) % 4;
  if (!r || v === undefined || typeof v !== "object") return v;
  if (isMessage(v)) {
    const dir = /^(d\.(?:a|par|vers))\.([NESW])$/.exec(v.code);
    if (dir) return { ...v, code: `${dir[1]}.${DIRS[(DIRS.indexOf(dir[2] as "N") + r) % 4]}` } as T;
    if (PAIRS[v.code]) return (r % 2 ? { ...v, code: PAIRS[v.code] } : v) as T;
    const out: Record<string, MessageValue> = {};
    for (const [k, x] of Object.entries(v) as [string, MessageValue][]) out[k] = k === "code" ? x : turnMessage(x, r);
    return out as T;
  }
  if ("lc" in v) return { lc: turnMessage(v.lc, r) } as T;
  if ("join" in v) return { ...v, join: v.join.map((x) => turnMessage(x, r)) } as T;
  return v;
}
