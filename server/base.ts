/**
 * Service des remarques (S34) : la base SQLite (`node:sqlite`, sans dépendance).
 *
 * Tables :
 * - `remarques` : ce qu'envoient les joueurs. Aucune adresse ni empreinte n'y est gardée.
 * - `sujets` : le rangement de l'auteur ; seuls les sujets `publie = 1` sont visibles (Propositions).
 * - `plus1` : un +1 par visiteur et par sujet. L'empreinte est effacée au bout de 24 h, le +1 reste compté.
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
    CREATE TABLE IF NOT EXISTS plus1 (
      sujet INTEGER NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
      empreinte TEXT,
      instant INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS plus1_unique ON plus1(sujet, empreinte);
    CREATE TABLE IF NOT EXISTS traces (
      genre TEXT NOT NULL,
      empreinte TEXT NOT NULL,
      instant INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS traces_recherche ON traces(genre, empreinte, instant);
    CREATE TABLE IF NOT EXISTS reglages (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);
  `);
  return base;
}

/** Le sel des empreintes, tiré au hasard à la première ouverture. */
export function selDesEmpreintes(base: DatabaseSync): string {
  const ligne = base.prepare("SELECT valeur FROM reglages WHERE cle = 'sel'").get() as { valeur: string } | undefined;
  if (ligne) return ligne.valeur;
  const sel = jeton(32);
  base.prepare("INSERT INTO reglages (cle, valeur) VALUES ('sel', ?)").run(sel);
  return sel;
}

/** Efface les empreintes de plus de 24 h (traces des limites, et celles des +1, dont le compte reste). */
export function purgerEmpreintes(base: DatabaseSync, maintenant: number): void {
  const limite = maintenant - GARDE_EMPREINTE;
  base.prepare("DELETE FROM traces WHERE instant <= ?").run(limite);
  base.prepare("UPDATE plus1 SET empreinte = NULL WHERE empreinte IS NOT NULL AND instant <= ?").run(limite);
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
    copie.exec("PRAGMA secure_delete = ON; DELETE FROM traces; UPDATE plus1 SET empreinte = NULL; DELETE FROM reglages WHERE cle = 'sel'; VACUUM;");
  } finally {
    copie.close();
  }
  const copies = readdirSync(dossier).filter((f) => /^copie-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const ancienne of copies.slice(0, -COPIES_GARDEES)) rmSync(join(dossier, ancienne));
  return nom;
}
