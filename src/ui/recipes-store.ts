// Page « Recettes » : préférences d'affichage et images choisies par le joueur, gardées dans ce
// navigateur (localStorage). Les images s'exportent dans un fichier à part (mes-images.json),
// comme les corrections.

import { defaultDir, type ListFilter, type ListSort, type ListView, type SortKey } from "./recipes-view.ts";

const KEY_PREFS = "ind-calc:v1:recettes";
const KEY_IMAGES = "ind-calc:v1:images";

export type RecipesPrefs = { view: ListView; filter: ListFilter; sort: ListSort };
export const DEFAULT_PREFS: RecipesPrefs = { view: "tuiles", filter: "tout", sort: { key: "nom", dir: "asc" } };

export function cleanPrefs(raw: unknown): RecipesPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const key: SortKey = ["nom", "valeur", "rp"].includes(r.sort?.key) ? r.sort.key : "nom";
  return {
    view: r.view === "lignes" ? "lignes" : "tuiles",
    filter: r.filter === "objets" || r.filter === "machines" ? r.filter : "tout",
    sort: { key, dir: r.sort?.dir === "asc" || r.sort?.dir === "desc" ? r.sort.dir : defaultDir(key) },
  };
}

export function loadPrefs(): RecipesPrefs {
  try {
    return cleanPrefs(JSON.parse(localStorage.getItem(KEY_PREFS) ?? "null"));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: RecipesPrefs): void {
  try {
    localStorage.setItem(KEY_PREFS, JSON.stringify(p));
  } catch {
    // préférences non gardées : sans conséquence
  }
}

/** Images du joueur : « objet|<id> » ou « machine|<id> » → adresse data:image/… */
export type MyImages = Record<string, string>;

/** Garde seulement les entrées valides (clé connue, image en data:). */
export function cleanImages(raw: unknown): MyImages {
  const out: MyImages = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^(objet|machine)\|[\w.@-]+$/.test(k) && typeof v === "string" && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(v)) out[k] = v;
  }
  return out;
}

export function loadImages(): MyImages {
  try {
    return cleanImages(JSON.parse(localStorage.getItem(KEY_IMAGES) ?? "null"));
  } catch {
    return {};
  }
}

/** Renvoie false si le navigateur refuse (quota plein). */
export function saveImages(m: MyImages): boolean {
  try {
    localStorage.setItem(KEY_IMAGES, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

/** Fichier d'export : { images: { « objet|id »: data:… } }. */
export function exportImages(m: MyImages): { _lisezMoi: string; images: MyImages } {
  return { _lisezMoi: "Images choisies dans la page Recettes du calculateur (à réimporter avec « Importer mes images »).", images: m };
}

export function parseImagesExport(raw: unknown): MyImages {
  const imgs = (raw as { images?: unknown } | null)?.images;
  const out = cleanImages(imgs);
  if (!Object.keys(out).length) throw new Error("aucune image reconnue dans ce fichier");
  return out;
}
