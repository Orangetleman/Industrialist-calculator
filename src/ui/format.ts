// Mise en forme des nombres et libellés (pur, sans DOM). S30 : selon la langue choisie
// (« 1 234,5 » en français, « 1,234.5 » en anglais) ; les unités du jeu ne changent pas.

import type { VerifyFlag } from "../engine/types.ts";
import { lang, locale, t, type Key } from "../i18n/i18n.ts";
import { txt } from "./engine-text.ts";

const nf = (d: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: 0, maximumFractionDigits: d });
const cache = new Map<string, Intl.NumberFormat>();
const en = () => lang() === "en";

/** Nombre arrondi à d décimales, selon la langue (en français : espace insécable pour les milliers). */
export function fmt(x: number, d = 1): string {
  if (!Number.isFinite(x)) return "—";
  const k = `${lang()}|${d}`;
  let f = cache.get(k);
  if (!f) {
    f = nf(d);
    cache.set(k, f);
  }
  const r = Math.round(x * 10 ** d) / 10 ** d;
  return f.format(Object.is(r, -0) ? 0 : r);
}

/** Puissance en MF/s avec préfixe (comme le jeu : MF, kMF, MMF, GMF). */
export function fmtMF(w: number | null): string {
  if (w === null || !Number.isFinite(w)) return "—";
  const a = Math.abs(w);
  if (a >= 1e9) return `${fmt(w / 1e9, 2)} GMF/s`;
  if (a >= 1e6) return `${fmt(w / 1e6, 2)} MMF/s`;
  if (a >= 1e3) return `${fmt(w / 1e3, 1)} kMF/s`;
  return `${fmt(w, 0)} MF/s`;
}

/** Énergie dans une case à corriger (S29, comme ailleurs) : « 4 k » pour 4 000 MF/s, « 2,5 M », « 30 ». */
export function energyInputText(w: number | null): string {
  if (w === null || !Number.isFinite(w)) return "";
  const a = Math.abs(w);
  const t = a >= 1e9 ? `${fmt(w / 1e9, 4)} G` : a >= 1e6 ? `${fmt(w / 1e6, 4)} M` : a >= 1e3 ? `${fmt(w / 1e3, 4)} k` : fmt(w, 4);
  return t.replace(/\s(?=\d)/g, "");
}

/**
 * Nombre saisi, selon la langue (S31) : en français « 1 234,5 » ou « 1.5 » ; en anglais « 1,234.5 », où la
 * virgule sépare les milliers (« 1,234 » vaut 1234, « 1,5 » n'est pas un nombre). NaN si ce n'en est pas un.
 */
export function parseNum(raw: string): number {
  let s = raw.trim().replace(/[\s  ]/g, "").replace("−", "-");
  if (en()) {
    if (s.includes(",") && !/^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) return NaN;
    s = s.replace(/,/g, "");
  } else s = s.replace(",", ".");
  return s ? Number(s) : NaN;
}

/** Lit une énergie saisie en MF/s : « 4500 », « 4,5 k », « 4,5 kMF/s », « -2 M » (« 4.5k », « 4,500 » en anglais) ; null si ce n'est pas un nombre. */
export function parseEnergy(raw: string): number | null {
  const m = /^([-+−]?\d[\d.,]*)\s*([kKmMgG]?)\s*(?:MF(?:\/s)?)?$/.exec(raw.replace(/[\s  ](?=\d)/g, "").trim());
  if (!m) return null;
  const n = parseNum(m[1]!);
  const mult = { "": 1, k: 1e3, m: 1e6, g: 1e9 }[m[2]!.toLowerCase() as "" | "k" | "m" | "g"];
  return Number.isFinite(n) ? n * mult : null;
}

/** Le doute du wiki, avec ses unités : « 15 s (Miraheze) ou 17,2 s (Fandom) » ; sinon le texte relevé (S28). */
export function doubtText(f: Pick<VerifyFlag, "field" | "detail"> & Partial<VerifyFlag>): string {
  const pairs = typeof f.detail === "string" ? [...f.detail.matchAll(/(Miraheze|Fandom|wiki|jeu)\s*:\s*(-?[\d.]+)/gi)].map((m) => ({ src: m[1]!, n: Number(m[2]) })) : [];
  if (pairs.length < 2 || pairs.some((p) => !Number.isFinite(p.n))) return txt(f.detail);
  const unit = (n: number) => (f.field === "durationS" ? `${fmt(n, 2)} s` : f.field === "energyMFps" ? fmtMF(n) : fmt(n, 3));
  return pairs.map((p) => `${unit(p.n)} (${p.src})`).join(` ${t("common.or")} `);
}

/** Le signe $ devant le nombre, en anglais : « $950 », « -$5 ». */
const dollarsEn = (text: string) => (text.startsWith("-") ? `-$${text.slice(1)}` : `$${text}`);

export function fmtMoney(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return "—";
  const text = fmt(x, x < 100 ? 2 : 0);
  return en() ? dollarsEn(text) : `${text} $`;
}

/** Nombre court pour les pastilles : « 950 », « 12,4 k », « 2,1 M » (« 12.4k » en anglais). */
export function fmtShort(x: number): string {
  const a = Math.abs(x);
  const u = (s: string) => (en() ? s : ` ${s}`);
  if (a >= 1e9) return `${fmt(x / 1e9, 2)}${u("G")}`;
  if (a >= 1e6) return `${fmt(x / 1e6, a >= 1e7 ? 1 : 2)}${u("M")}`;
  if (a >= 1e4) return `${fmt(x / 1e3, a >= 1e5 ? 0 : 1)}${u("k")}`;
  return fmt(x, 0);
}

/** Somme d'argent courte : « 950 $ », « 2,1 M$ » (« $950 », « $2.1M » en anglais). */
export function fmtMoneyShort(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return "—";
  if (Math.abs(x) < 1e4) return fmtMoney(x);
  return en() ? dollarsEn(fmtShort(x)) : `${fmtShort(x)}$`;
}

/** Deux-points entre un nom et sa valeur : « Gear : 60/min » en français, « Gear: 60/min » en anglais. */
export const colon = () => (en() ? ": " : " : ");
/** Point-virgule entre deux éléments d'une liste : « a ; b » en français, « a; b » en anglais (S37). */
export const semi = () => (en() ? "; " : " ; ");

/** Citation : « texte » en français, “texte” en anglais. */
export const quote = (s: string) => (en() ? `“${s}”` : `« ${s} »`);

/** Pourcentage déjà arrondi : « 96 % » en français, « 96% » en anglais. */
export const fmtPct = (text: string) => (en() ? `${text}%` : `${text} %`);

/** Date et heure selon la langue (les options d'Intl.DateTimeFormat). */
export function fmtDate(ms: number, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleString(locale(), opts);
}

export function fmtRP(x: number | null): string {
  return x === null || !Number.isFinite(x) ? "—" : `${fmt(x, 0)} RP`;
}

/** Durée lisible : « 45 s », « 12 min », « 3 h 05 min », « 2 j 4 h » (« 2 d 4 h » en anglais). */
export function fmtDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
  return `${Math.floor(h / 24)} ${en() ? "d" : "j"} ${h % 24} h`;
}

export function fmtPollution(p: [number, number] | number | null): string {
  if (p === null) return "—";
  if (typeof p === "number") return `${fmtPct(fmt(p, 3))}/h`;
  return `${fmtPct(p[0] === p[1] ? fmt(p[0], 3) : `${fmt(p[0], 3)} – ${fmt(p[1], 3)}`)}/h`;
}

/** Échappe une chaîne pour l'insérer dans du HTML. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const REASONS = ["manquant", "contradiction", "non-sourcé", "approximatif", "variable"];
/** Libellé du motif d'une valeur à vérifier (codes des données : manquant, contradiction…). */
export const reasonLabel = (reason: string): string => (REASONS.includes(reason) ? t(`reason.${reason}` as Key) : reason);

/** Libellé d'un champ de recette ou de machine ; `name` traduit les ids d'items. */
export function fieldLabel(field: string, name: (id: string) => string): string {
  const m = /^(inputs|outputs)\.(.+)$/.exec(field);
  if (m) return t(m[1] === "inputs" ? "field.input" : "field.output", { item: name(m[2]!) });
  const FIELDS = ["durationS", "energyMFps", "outputs", "cost", "size", "pollutionPerHour", "unlockedBy", "page", "requires", "description", "machine", "sellValue", "researchValue"];
  return FIELDS.includes(field) ? t(`field.${field}` as Key) : field;
}

/** Champs qu'on peut corriger depuis l'interface. */
export function isEditableField(scope: "recette" | "machine", field: string): boolean {
  if (scope === "recette") return field === "durationS" || field === "energyMFps" || /^(inputs|outputs)\..+/.test(field);
  return field === "cost" || field === "size" || field === "pollutionPerHour";
}

/** Convertit la saisie (nombre selon la langue, « 8x8 » pour une taille). */
export function parseInput(field: string, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const s = raw.trim();
  if (field === "size") {
    const m = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)$/i.exec(s);
    const w = m ? parseNum(m[1]!) : NaN;
    const l = m ? parseNum(m[2]!) : NaN;
    return Number.isFinite(w) && Number.isFinite(l) ? { ok: true, value: { w, l } } : { ok: false, error: t("parse.size") };
  }
  if (field === "energyMFps") {
    const e = parseEnergy(s);
    return e === null ? { ok: false, error: t("parse.energy") } : { ok: true, value: e };
  }
  const n = parseNum(s);
  if (!Number.isFinite(n)) return { ok: false, error: t("parse.number") };
  if (field === "durationS" && n <= 0) return { ok: false, error: t("parse.duration") };
  return { ok: true, value: n };
}
