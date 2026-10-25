/**
 * Service des remarques (S34) : la base SQLite (`node:sqlite`, sans dépendance).
 *
 * Tables :
 * - `remarques` : ce qu'envoient les joueurs. Aucune adresse ni empreinte n'y est gardée.
 * - `sujets` : le rangement de l'auteur ; seuls les sujets `publie = 1` sont visibles (Propositions). Textes publics en
 *   français et en anglais (S36) ; `auto` liste les champs traduits automatiquement et pas encore relus.
 * - `votes` (S36, remplace `plus1`) : ▲ (+1) ou ▼ (−1), un par votant et par sujet, comme sur Reddit. Le votant est
 *   l'empreinte d'un identifiant tiré au hasard par le navigateur (rien de personnel), pour changer d'avis plus tard.
 *   L'empreinte d'adresse (un vote par adresse et par sujet) est effacée au bout de 24 h, le vote reste compté.
 * - `traces` : envois et essais de connexion récents (limites par visiteur), effacés au bout de 24 h.
 * - `reglages` : le sel des empreintes.
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { jeton } from "./securite.ts";

export const GARDE_EMPREINTE = 24 * 3600_000;
export const COPIES_GARDEES = 7;

export function ouvrirBase(chemin: string): DatabaseSync {
  const base = new DatabaseSync(chemin);
  // secure_delete : une empreinte effacée est réellement écrasée sur la carte, pas seulement oubliée.
  base.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA secure_delete = ON;
    CREATE TABLE IF NOT EXISTS sujets (
      id INTEGER PRIMARY KEY,
      cree INTEGER NOT NULL,
      titre TEXT NOT NULL,
      etat TEXT NOT NULL DEFAULT 'propose',
      reponse TEXT,
      publie INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS remarques (
      id INTEGER PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      cree INTEGER NOT NULL,
      type TEXT NOT NULL,
      texte TEXT NOT NULL,
      pseudo TEXT,
      page TEXT,
      langue TEXT,
      version TEXT,
      plan TEXT,
      piece TEXT,
      etat TEXT NOT NULL DEFAULT 'nouvelle',
      reponse TEXT,
      repondu INTEGER,
      sujet INTEGER REFERENCES sujets(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS votes (
      sujet INTEGER NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
      votant TEXT NOT NULL,
      valeur INTEGER NOT NULL,
      empreinte TEXT,
      instant INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS votes_unique ON votes(sujet, votant);
    CREATE INDEX IF NOT EXISTS votes_empreinte ON votes(sujet, empreinte);
    CREATE TABLE IF NOT EXISTS traces (
      genre TEXT NOT NULL,
      empreinte TEXT NOT NULL,
      instant INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS traces_recherche ON traces(genre, empreinte, instant);
    CREATE TABLE IF NOT EXISTS reglages (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);
  `);
  migrer(base);
  return base;
}

/** Colonnes ajoutées après S34 : une base déjà en place les gagne à l'ouverture, sans rien perdre. */
const AJOUTS: Record<string, string[]> = {
  sujets: ["titre_en TEXT", "description TEXT", "description_en TEXT", "reponse_en TEXT", "auto TEXT", "maj INTEGER"],
  remarques: ["traduction TEXT"],
};

function migrer(base: DatabaseSync): void {
  for (const [table, colonnes] of Object.entries(AJOUTS)) {
    const presentes = new Set((base.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
    for (const colonne of colonnes) if (!presentes.has(colonne.split(" ")[0]!)) base.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne}`);
  }
  // S36 : les +1 de S34-S35 deviennent des votes ▲ (un votant inconnu chacun : ils restent comptés).
  if (base.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'plus1'").get()) {
    base.exec(`
      INSERT OR IGNORE INTO votes (sujet, votant, valeur, empreinte, instant) SELECT sujet, 'ancien-' || rowid, 1, empreinte, instant FROM plus1;
      DROP TABLE plus1;
    `);
  }
}

/** Le sel des empreintes, tiré au hasard à la première ouverture. */
export function selDesEmpreintes(base: DatabaseSync): string {
  const ligne = base.prepare("SELECT valeur FROM reglages WHERE cle = 'sel'").get() as { valeur: string } | undefined;
  if (ligne) return ligne.valeur;
  const sel = jeton(32);
  base.prepare("INSERT INTO reglages (cle, valeur) VALUES ('sel', ?)").run(sel);
  return sel;
}

/**
 * Le numéro de la prochaine remarque ou du prochain sujet : jamais un numéro déjà donné, même supprimé (S36 : sans
 * cela SQLite redonne le plus grand numéro libéré, et un ancien lien `/tableau/#n°` ou « Mes remarques » d'un joueur
 * désignerait une autre remarque). Le dernier numéro donné est gardé dans `reglages`.
 */
export function prochainNumero(base: DatabaseSync, table: "remarques" | "sujets"): number {
  const cle = `dernier-${table}`;
  const garde = base.prepare("SELECT valeur FROM reglages WHERE cle = ?").get(cle) as { valeur: string } | undefined;
  const { max } = base.prepare(`SELECT COALESCE(MAX(id), 0) AS max FROM ${table}`).get() as { max: number };
  const n = Math.max(Number(garde?.valeur ?? 0), max) + 1;
  base.prepare("INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur").run(cle, String(n));
  return n;
}

/** Efface les empreintes de plus de 24 h (traces des limites, et celles des votes, qui restent comptés). */
export function purgerEmpreintes(base: DatabaseSync, maintenant: number): void {
  const limite = maintenant - GARDE_EMPREINTE;
  base.prepare("DELETE FROM traces WHERE instant <= ?").run(limite);
  base.prepare("UPDATE votes SET empreinte = NULL WHERE empreinte IS NOT NULL AND instant <= ?").run(limite);
}

/**
 * Copie de la nuit (`copie-AAAA-MM-JJ.db`, 7 gardées) dans le dossier des données. La copie ne garde ni les
 * empreintes ni le sel : elles ne survivent pas plus de 24 h, même dans une copie.
 */
export function sauvegarder(base: DatabaseSync, dossier: string, maintenant: number): string | null {
  const nom = `copie-${new Date(maintenant).toISOString().slice(0, 10)}.db`;
  const chemin = join(dossier, nom);
  if (existsSync(chemin)) return null;
  base.prepare("VACUUM INTO ?").run(chemin);
  const copie = new DatabaseSync(chemin);
  try {
    copie.exec("PRAGMA secure_delete = ON; DELETE FROM traces; UPDATE votes SET empreinte = NULL; DELETE FROM reglages WHERE cle = 'sel'; VACUUM;");
  } finally {
    copie.close();
  }
  const copies = readdirSync(dossier).filter((f) => /^copie-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const ancienne of copies.slice(0, -COPIES_GARDEES)) rmSync(join(dossier, ancienne));
  return nom;
}
