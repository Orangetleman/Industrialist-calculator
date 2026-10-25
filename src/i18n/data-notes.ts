// Notes des données en anglais (S32). Les fichiers data/*.json gardent leurs notes en français (notes,
// doutes, descriptions saisies) ; leur traduction est dans data/i18n/en.json, rangée par fichier puis par
// texte français. Une note qui change perd donc sa traduction (le site la montre en français, marquée
// « (FR) », et le test des notes la compte). Les doutes écrits par les scripts d'extraction suivent des
// gabarits : ils sont traduits par les règles ci-dessous.

import enJson from "../../data/i18n/en.json";

/** Dictionnaire français → anglais, tous fichiers confondus. */
const DICT = new Map<string, string>();
for (const [file, entries] of Object.entries(enJson as Record<string, Record<string, string> | string>)) {
  if (file.startsWith("_") || typeof entries !== "object") continue;
  for (const [fr, en] of Object.entries(entries)) DICT.set(fr, en);
}

/** Gabarits des scripts d'extraction (scripts/lib/wiki-extract.ts…) : français → anglais. */
const RULES: [RegExp, (...m: string[]) => string][] = [
  [/^quantité de (.+) variable \(mode « (.+) »\), valeur de base (.+)$/, (_, item, mode, base) => `amount of ${item} varies (mode “${mode}”), base value ${base}`],
  [/^quantité de (.+) variable \(mode « (.+) »\)$/, (_, item, mode) => `amount of ${item} varies (mode “${mode}”)`],
  [/^énergie variable \(mode « (.+) »\), valeur de base (.+)$/, (_, mode, base) => `power varies (mode “${mode}”), base value ${base}`],
  [/^énergie variable \(mode « (.+) »\)$/, (_, mode) => `power varies (mode “${mode}”)`],
  [/^durée variable \(mode « (.+) »\)$/, (_, mode) => `duration varies (mode “${mode}”)`],
  [/^(.+) apparaît deux fois ; quantités additionnées$/, (_, item) => `${item} appears twice; amounts added up`],
  [/^(\d+) parents ; règle « tous requis » déduite d'une capture du jeu \((.+)\), le wiki ne la précise pas$/, (_, n, from) => `${n} parents; “all required” rule taken from a game screenshot (${from}), the wiki doesn't say`],
  [/^enfant « (.+) » introuvable dans RS\/Data$/, (_, child) => `child “${child}” not found in RS/Data`],
  [/^débloquée par plusieurs nœuds : (.+)$/, (_, list) => `unlocked by several nodes: ${list}`],
  // Deux sources en désaccord : « Miraheze : 5 ; Fandom : 17.2 » (nombres, ponctuation anglaise).
  [/^(Miraheze|Fandom|wiki|jeu) : (.+) ; (Miraheze|Fandom|wiki|jeu) : (.+)$/, (_, a, x, b, y) => `${a === "jeu" ? "game" : a}: ${x}; ${b === "jeu" ? "game" : b}: ${y}`],
];

/** La note en anglais ; null si elle n'a pas de traduction. */
export function dataNote(fr: string): string | null {
  const d = DICT.get(fr);
  if (d !== undefined) return d;
  for (const [re, f] of RULES) {
    const m = re.exec(fr);
    if (m) return f(...m);
  }
  return null;
}

/** Les fichiers et textes du dictionnaire (pour le test des notes). */
export const dataNoteEntries = (): [string, string, string][] =>
  Object.entries(enJson as Record<string, Record<string, string> | string>).flatMap(([file, e]) => (file.startsWith("_") || typeof e !== "object" ? [] : Object.entries(e).map(([fr, en]) => [file, fr, en] as [string, string, string])));
