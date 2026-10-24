// Mise en forme des nombres et libellés (pur, sans DOM). S30 : selon la langue choisie
// (« 1 234,5 » en français, « 1,234.5 » en anglais) ; les unités du jeu ne changent pas.

import type { VerifyFlag } from "../engine/types.ts";
import { lang, locale, t } from "../i18n/i18n.ts";

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

/** Lit une énergie saisie en MF/s : « 4500 », « 4,5 k », « 4,5 kMF/s », « -2 M » ; null si ce n'est pas un nombre. */
export function parseEnergy(raw: string): number | null {
  const m = /^([-+−]?\d+(?:[.,]\d+)?)\s*([kKmMgG]?)\s*(?:MF(?:\/s)?)?$/.exec(raw.replace(/[\s  ](?=\d)/g, "").trim());
  if (!m) return null;
  const n = Number(m[1]!.replace("−", "-").replace(",", "."));
  const mult = { "": 1, k: 1e3, m: 1e6, g: 1e9 }[m[2]!.toLowerCase() as "" | "k" | "m" | "g"];
  return Number.isFinite(n) ? n * mult : null;
}

/** Le doute du wiki, avec ses unités : « 15 s (Miraheze) ou 17,2 s (Fandom) » ; sinon le texte relevé (S28). */
export function doubtText(f: Pick<VerifyFlag, "field" | "detail"> & Partial<VerifyFlag>): string {
  const pairs = [...f.detail.matchAll(/(Miraheze|Fandom|wiki|jeu)\s*:\s*(-?[\d.]+)/gi)].map((m) => ({ src: m[1]!, n: Number(m[2]) }));
  if (pairs.length < 2 || pairs.some((p) => !Number.isFinite(p.n))) return f.detail;
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
  if (typeof p === "number") return `${fmt(p, 3)} %/h`;
  return p[0] === p[1] ? `${fmt(p[0], 3)} %/h` : `${fmt(p[0], 3)} – ${fmt(p[1], 3)} %/h`;
}

/** Échappe une chaîne pour l'insérer dans du HTML. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const REASON_LABEL: Record<string, string> = {
  manquant: "manquant",
  contradiction: "contradiction",
  "non-sourcé": "non sourcé",
  approximatif: "approximatif",
  variable: "variable",
};

/** Libellé d'un champ de recette ou de machine ; `name` traduit les ids d'items. */
export function fieldLabel(field: string, name: (id: string) => string): string {
  const m = /^(inputs|outputs)\.(.+)$/.exec(field);
  if (m) return `${m[1] === "inputs" ? "entrée" : "sortie"} : ${name(m[2]!)}`;
  return (
    {
      durationS: "durée du cycle (s)",
      energyMFps: "énergie",
      outputs: "sorties",
      cost: "prix ($)",
      size: "taille (cases)",
      pollutionPerHour: "pollution (%/h)",
      unlockedBy: "nœud de recherche",
      page: "page du wiki",
      requires: "règle des prérequis",
      description: "description (jeu)",
      machine: "machine",
      sellValue: "prix de vente ($)",
      researchValue: "facteur RP",
    } as Record<string, string>
  )[field] ?? field;
}

/** Champs qu'on peut corriger depuis l'interface. */
export function isEditableField(scope: "recette" | "machine", field: string): boolean {
  if (scope === "recette") return field === "durationS" || field === "energyMFps" || /^(inputs|outputs)\..+/.test(field);
  return field === "cost" || field === "size" || field === "pollutionPerHour";
}

/** Convertit la saisie (virgule décimale acceptée, « 8x8 » pour une taille). */
export function parseInput(field: string, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = raw.trim();
  if (field === "size") {
    const m = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)$/i.exec(t);
    return m ? { ok: true, value: { w: Number(m[1]!.replace(",", ".")), l: Number(m[2]!.replace(",", ".")) } } : { ok: false, error: "format attendu : 8x8" };
  }
  if (field === "energyMFps") {
    const e = parseEnergy(t);
    return e === null ? { ok: false, error: "nombre de MF/s attendu (ex. 4500 ou 4,5 k)" } : { ok: true, value: e };
  }
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  if (!t || !Number.isFinite(n)) return { ok: false, error: "nombre attendu" };
  if (field === "durationS" && n <= 0) return { ok: false, error: "durée > 0 attendue" };
  return { ok: true, value: n };
}
