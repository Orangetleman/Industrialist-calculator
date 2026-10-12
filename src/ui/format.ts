// Mise en forme des nombres et libellés (pur, sans DOM).

const nf = (d: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: d });
const cache = new Map<number, Intl.NumberFormat>();

/** Nombre arrondi à d décimales, format français (espace insécable pour les milliers). */
export function fmt(x: number, d = 1): string {
  if (!Number.isFinite(x)) return "—";
  let f = cache.get(d);
  if (!f) {
    f = nf(d);
    cache.set(d, f);
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

export function fmtMoney(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return "—";
  return `${fmt(x, x < 100 ? 2 : 0)} $`;
}

export function fmtRP(x: number | null): string {
  return x === null || !Number.isFinite(x) ? "—" : `${fmt(x, 0)} RP`;
}

/** Durée lisible : « 45 s », « 12 min », « 3 h 05 min », « 2 j 4 h ». */
export function fmtDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
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
      energyMFps: "énergie (MF/s)",
      outputs: "sorties",
      cost: "prix ($)",
      size: "taille (cases)",
      pollutionPerHour: "pollution (%/h)",
      unlockedBy: "nœud de recherche",
      page: "page du wiki",
      requires: "règle des prérequis",
      description: "description (jeu)",
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
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  if (!t || !Number.isFinite(n)) return { ok: false, error: "nombre attendu" };
  if (field === "durationS" && n <= 0) return { ok: false, error: "durée > 0 attendue" };
  return { ok: true, value: n };
}
