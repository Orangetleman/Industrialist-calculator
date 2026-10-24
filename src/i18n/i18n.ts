// Traduction du site (S30) : la langue choisie, et `t()` qui lit le catalogue de cette langue.
// Pur, sans DOM : la page (main.ts) lit le choix gardé et appelle setLang() avant le premier rendu.
//   t("plan.title.objet")                      texte simple
//   t("plan.machines", { n: 3 })               trous {n} remplis, pluriel accordé par Intl.PluralRules
// Les noms du jeu (objets, machines, recherches) restent en anglais dans les deux langues.

import { en } from "./en.ts";
import { fr, type Msg } from "./fr.ts";

export type Lang = "fr" | "en";
export type Key = keyof typeof fr;
export const LANGS: Lang[] = ["fr", "en"];
/** Clé du choix gardé dans le navigateur (décision S16 Langues). */
export const KEY_LANG = "ind-calc:v1:langue";

const CATALOGS: Record<Lang, Record<Key, Msg>> = { fr, en };
let current: Lang = "fr";

export const lang = (): Lang => current;
export function setLang(l: Lang): void {
  current = l;
}
/** Locale des nombres et des dates (Intl). */
export const locale = (l: Lang = current): string => (l === "fr" ? "fr-FR" : "en-US");

/** Langue au premier passage : français si le navigateur est en français, sinon anglais. */
export function detectLang(navLanguage: string | undefined | null): Lang {
  return /^fr\b/i.test(navLanguage ?? "") ? "fr" : "en";
}
/** Le choix gardé s'il est valable, sinon la langue du navigateur. */
export function startLang(stored: string | null, navLanguage: string | undefined | null): Lang {
  return stored === "fr" || stored === "en" ? stored : detectLang(navLanguage);
}

const rules = new Map<Lang, Intl.PluralRules>();
const ints = new Map<Lang, Intl.NumberFormat>();

/** Remplit les trous {nom} ; un nombre est écrit selon la langue (sans décimales au-delà de 2). */
function fill(text: string, vals: Record<string, string | number> | undefined): string {
  if (!vals) return text;
  return text.replace(/\{(\w+)\}/g, (all, k: string) => {
    const v = vals[k];
    if (v === undefined) return all;
    if (typeof v === "string") return v;
    let f = ints.get(current);
    if (!f) ints.set(current, (f = new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 })));
    return f.format(v);
  });
}

/** Texte de `key` dans la langue choisie ; `vals.n` (nombre) choisit la forme du pluriel. */
export function t(key: Key, vals?: Record<string, string | number>): string {
  const msg = CATALOGS[current][key] ?? fr[key];
  if (typeof msg === "string") return fill(msg, vals);
  const n = typeof vals?.n === "number" ? vals.n : 0;
  let r = rules.get(current);
  if (!r) rules.set(current, (r = new Intl.PluralRules(locale())));
  const form = r.select(n) as keyof typeof msg;
  return fill(msg[form] ?? msg.other, vals);
}

/** « a », « a et b », « a, b et c » (« a, b and c » en anglais). */
export function joinList(list: string[]): string {
  if (list.length < 2) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} ${t("common.and")} ${list.at(-1)}`;
}
