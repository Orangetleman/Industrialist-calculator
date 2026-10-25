/**
 * Service des remarques (S34) : les accès HTTP, sans dépendance (`node:http`).
 *
 * Publics :
 *   POST /api/remarques                    envoyer une remarque (5 par heure et par visiteur, 2 000 caractères)
 *   GET  /api/remarques/<numéro>           relire sa remarque et la réponse de l'auteur (numéro secret)
 *   GET  /api/propositions                 sujets publiés par l'auteur (en-tête X-Votant : le vote de ce navigateur)
 *   POST /api/propositions/<id>/vote       ▲ / ▼ / retrait (S36, comme sur Reddit) : { votant, valeur: 1 | -1 | 0 }
 * Réservés (cookie de session, après POST /api/admin/connexion) :
 *   /api/admin/session, /deconnexion, /remarques[/<id>[/traduire]], /sujets[/<id>[/repondre]], /traduire, /export,
 *   /mesures
 *
 * Toute écriture vérifie l'en-tête Origin. Les réponses sont du JSON : les textes reçus ne sont jamais servis en HTML.
 * Les erreurs sont des codes (`{ erreur: "trop-de-remarques" }`), traduits par le site.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { purgerEmpreintes, selDesEmpreintes } from "./base.ts";
import { empreinte, jeton, verifierMotDePasse } from "./securite.ts";
import { CARACTERES_MAX, ErreurTraduction, TEXTES_MAX, type Traduire } from "./traducteur.ts";

export const TYPES = ["valeur", "bogue", "idee", "traduction", "correction"] as const;
export const ETATS_REMARQUE = ["nouvelle", "lue", "traitee"] as const;
export const ETATS_SUJET = ["propose", "prevu", "fait", "refuse"] as const;
export const TEXTE_MAX = 2000;
export const ENVOIS_PAR_HEURE = 5;
export const CONNEXIONS_PAR_HEURE = 10;
/** Votes (nouveaux ou changés) par heure et par visiteur. */
export const VOTES_PAR_HEURE = 60;
/** Textes publics d'un sujet, en français et en anglais (S36) ; `auto` ne cite que ceux-là. */
export const CHAMPS_SUJET = ["titre", "titre_en", "description", "description_en", "reponse", "reponse_en"] as const;
/** Identifiant de vote tiré au hasard par le navigateur (src/ui/propositions.ts). */
const VOTANT = /^[\w-]{16,64}$/;
export const DUREE_SESSION = 12 * 3600_000;
const PSEUDO_MAX = 40;
const COURT_MAX = 300;
const PLAN_MAX = 2000;
const PIECE_MAX = 200_000;
const CORPS_MAX = 256 * 1024;
const HEURE = 3600_000;
const COOKIE = "remarques_session";
/** Nom du champ caché du formulaire : un humain ne le voit pas, un robot le remplit. */
export const CHAMP_PIEGE = "siteWeb";

export interface OptionsService {
  base: DatabaseSync;
  /** Origines admises pour les écritures, ex. `https://industrialist.myprisme.fr`. */
  origines: readonly string[];
  /** La ligne `scrypt$…` du mot de passe, relue à chaque connexion (null : pas encore choisi). */
  lireMotDePasse: () => string | null;
  /** Horloge (ms), simulée par les tests. */
  maintenant?: () => number;
  /** REMARQUES_FERMEES=1 : plus aucun envoi, le reste marche. */
  fermees?: boolean;
  /** Appelé après chaque remarque gardée (S35 : message dans le salon Discord). Une erreur n'empêche pas l'envoi. */
  annoncer?: (remarque: RemarqueRecue) => void;
  /** Traduction automatique (S36, server/traducteur.ts) ; absente : « traducteur-absent ». */
  traduire?: Traduire;
  /** Le traducteur est-il réglé (clé posée) ? Montré par le tableau de bord. */
  traducteurPret?: () => boolean;
}

/** Une remarque telle qu'elle vient d'être gardée (sans le numéro secret). */
export interface RemarqueRecue {
  id: number;
  type: string;
  texte: string;
  pseudo: string | null;
  page: string | null;
  langue: string | null;
  version: string | null;
  piece: unknown;
}

export interface Mesures {
  requetes: number;
  dureeTotaleMs: number;
  dureeMaxMs: number;
  parStatut: Record<string, number>;
  depuis: number;
}

export interface Service {
  serveur: Server;
  mesures: Mesures;
  purger(): void;
}

class Refus extends Error {
  statut: number;
  constructor(statut: number, code: string) {
    super(code);
    this.statut = statut;
  }
}

type Corps = Record<string, unknown>;

function texte(valeur: unknown, max: number, code: string): string | null {
  if (valeur === undefined || valeur === null) return null;
  if (typeof valeur !== "string") throw new Refus(400, code);
  const propre = valeur.trim();
  if (propre.length > max) throw new Refus(400, code);
  return propre === "" ? null : propre;
}

/** Les champs traduits automatiquement et pas encore relus (colonne `auto`, une liste JSON). */
function lireAuto(valeur: string | null): string[] {
  try {
    const liste: unknown = valeur ? JSON.parse(valeur) : [];
    return Array.isArray(liste) ? liste.filter((c): c is string => (CHAMPS_SUJET as readonly string[]).includes(c)) : [];
  } catch {
    return [];
  }
}
function ecrireAuto(valeur: unknown): string {
  if (!Array.isArray(valeur) || valeur.some((c) => typeof c !== "string" || !(CHAMPS_SUJET as readonly string[]).includes(c))) throw new Refus(400, "auto");
  return JSON.stringify([...new Set(valeur)]);
}
/** Ordre des sujets : les faits et refusés en bas, puis le score le plus haut, puis le plus ancien. */
function ordreSujets(a: { etat?: unknown; score: number; id: number }, b: { etat?: unknown; score: number; id: number }): number {
  const fin = (s: { etat?: unknown }) => (s.etat === "fait" || s.etat === "refuse" ? 1 : 0);
  return fin(a) - fin(b) || b.score - a.score || a.id - b.id;
}

function entier(valeur: string | undefined): number {
  const n = Number(valeur);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Refus(404, "introuvable");
  return n;
}

function lireCorps(req: IncomingMessage): Promise<Corps> {
  return new Promise((resoudre, rejeter) => {
    const morceaux: Buffer[] = [];
    let taille = 0;
    req.on("data", (m: Buffer) => {
      taille += m.length;
      // Au-delà de la limite, on lit sans garder : la réponse 413 part une fois la requête reçue.
      if (taille > CORPS_MAX) return;
      morceaux.push(m);
    });
    req.on("end", () => {
      if (taille > CORPS_MAX) return rejeter(new Refus(413, "trop-long"));
      if (taille === 0) return resoudre({});
      try {
        const valeur: unknown = JSON.parse(Buffer.concat(morceaux).toString("utf8"));
        if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) throw new Error();
        resoudre(valeur as Corps);
      } catch {
        rejeter(new Refus(400, "json"));
      }
    });
    req.on("error", rejeter);
  });
}

function cookies(req: IncomingMessage): Map<string, string> {
  const liste = new Map<string, string>();
  for (const morceau of (req.headers.cookie ?? "").split(";")) {
    const i = morceau.indexOf("=");
    if (i > 0) liste.set(morceau.slice(0, i).trim(), morceau.slice(i + 1).trim());
  }
  return liste;
}

/** L'adresse du visiteur : celle que donne Cloudflare, sinon celle que passe nginx, sinon la connexion. */
function adresse(req: IncomingMessage): string {
  const cf = req.headers["cf-connecting-ip"];
  const reelle = req.headers["x-real-ip"];
  return (typeof cf === "string" && cf) || (typeof reelle === "string" && reelle) || req.socket.remoteAddress || "?";
}

export function creerService(options: OptionsService): Service {
  const { base } = options;
  const maintenant = options.maintenant ?? Date.now;
  const sel = selDesEmpreintes(base);
  const sessions = new Map<string, number>();
  const mesures: Mesures = { requetes: 0, dureeTotaleMs: 0, dureeMaxMs: 0, parStatut: {}, depuis: maintenant() };

  const compter = (genre: string, qui: string): number =>
    (base.prepare("SELECT COUNT(*) AS n FROM traces WHERE genre = ? AND empreinte = ? AND instant > ?").get(genre, qui, maintenant() - HEURE) as { n: number }).n;
  const tracer = (genre: string, qui: string): void => {
    base.prepare("INSERT INTO traces (genre, empreinte, instant) VALUES (?, ?, ?)").run(genre, qui, maintenant());
  };

  function connecte(req: IncomingMessage): boolean {
    const valeur = cookies(req).get(COOKIE);
    if (!valeur) return false;
    const fin = sessions.get(valeur);
    if (fin === undefined) return false;
    if (fin <= maintenant()) {
      sessions.delete(valeur);
      return false;
    }
    return true;
  }

  function envoyerRemarque(corps: Corps, qui: string): [number, unknown] {
    if (options.fermees) throw new Refus(503, "fermees");
    // Le robot qui remplit la case piège croit avoir réussi ; rien n'est gardé.
    if (typeof corps[CHAMP_PIEGE] === "string" && corps[CHAMP_PIEGE] !== "") return [201, { numero: jeton(12), id: 0 }];
    if (compter("envoi", qui) >= ENVOIS_PAR_HEURE) throw new Refus(429, "trop-de-remarques");
    const type = corps.type;
    if (typeof type !== "string" || !(TYPES as readonly string[]).includes(type)) throw new Refus(400, "type");
    const contenu = texte(corps.texte, TEXTE_MAX, "texte-trop-long");
    let piece: string | null = null;
    if (type === "correction" && corps.piece !== undefined) {
      piece = JSON.stringify(corps.piece);
      if (piece.length > PIECE_MAX) throw new Refus(413, "piece-trop-longue");
    }
    if (!contenu && !piece) throw new Refus(400, "texte-vide");
    const langue = corps.langue === "fr" || corps.langue === "en" ? corps.langue : null;
    const numero = jeton(12);
    const pseudo = texte(corps.pseudo, PSEUDO_MAX, "pseudo-trop-long");
    const page = texte(corps.page, COURT_MAX, "page-trop-longue");
    const version = texte(corps.version, COURT_MAX, "version-trop-longue");
    const { lastInsertRowid } = base
      .prepare("INSERT INTO remarques (numero, cree, type, texte, pseudo, page, langue, version, plan, piece) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        numero,
        maintenant(),
        type,
        contenu ?? "",
        pseudo,
        page,
        langue,
        version,
        texte(corps.plan, PLAN_MAX, "plan-trop-long"),
        piece,
      );
    tracer("envoi", qui);
    const id = Number(lastInsertRowid);
    if (options.annoncer) {
      try {
        options.annoncer({ id, type, texte: contenu ?? "", pseudo, page, langue, version, piece: piece === null ? null : corps.piece });
      } catch (e) {
        console.error("Annonce impossible :", e);
      }
    }
    // Le n° court (id) se montre au joueur et dans le tableau de bord ; le numéro secret seul permet de relire.
    return [201, { numero, id }];
  }

  /** Comptes d'un sujet : demandes (remarques rangées), ▲, ▼ ; score = demandes + ▲ − ▼ (comme sur Reddit). */
  const COMPTES = `(SELECT COUNT(*) FROM remarques r WHERE r.sujet = s.id) AS demandes,
    (SELECT COUNT(*) FROM votes v WHERE v.sujet = s.id AND v.valeur > 0) AS pour,
    (SELECT COUNT(*) FROM votes v WHERE v.sujet = s.id AND v.valeur < 0) AS contre`;
  type LigneSujet = Record<string, unknown> & { id: number; demandes: number; pour: number; contre: number; auto: string | null };
  const avecScore = (s: LigneSujet) => ({ ...s, auto: lireAuto(s.auto), score: s.demandes + s.pour - s.contre });

  /** Le votant : l'empreinte (sans sel, pour qu'elle survive aux copies) de l'identifiant tiré par le navigateur. */
  const votantDe = (valeur: unknown): string | null =>
    typeof valeur === "string" && VOTANT.test(valeur) ? createHash("sha256").update(`votant:${valeur}`).digest("base64url").slice(0, 32) : null;

  function propositions(votant: string | null): unknown[] {
    const lignes = base
      .prepare(
        `SELECT s.id, s.titre, s.titre_en, s.description, s.description_en, s.reponse, s.reponse_en, s.auto, s.etat, s.maj, s.cree, ${COMPTES},
           (SELECT valeur FROM votes v WHERE v.sujet = s.id AND v.votant = ?) AS monVote
         FROM sujets s WHERE s.publie = 1`,
      )
      .all(votant ?? "") as LigneSujet[];
    return lignes.map((s) => ({ ...avecScore(s), monVote: s.monVote ?? 0 })).sort(ordreSujets);
  }

  function voter(id: number, corps: Corps, qui: string): [number, unknown] {
    if (!base.prepare("SELECT id FROM sujets WHERE id = ? AND publie = 1").get(id)) throw new Refus(404, "introuvable");
    const votant = votantDe(corps.votant);
    if (!votant) throw new Refus(400, "votant");
    const valeur = corps.valeur;
    if (valeur !== 1 && valeur !== -1 && valeur !== 0) throw new Refus(400, "valeur");
    const avant = base.prepare("SELECT valeur FROM votes WHERE sujet = ? AND votant = ?").get(id, votant) as { valeur: number } | undefined;
    if ((avant?.valeur ?? 0) !== valeur) {
      if (compter("vote", qui) >= VOTES_PAR_HEURE) throw new Refus(429, "trop-de-votes");
      if (valeur === 0) base.prepare("DELETE FROM votes WHERE sujet = ? AND votant = ?").run(id, votant);
      else if (avant) base.prepare("UPDATE votes SET valeur = ?, empreinte = ?, instant = ? WHERE sujet = ? AND votant = ?").run(valeur, qui, maintenant(), id, votant);
      else {
        // Un autre navigateur de la même adresse a déjà voté sur ce sujet dans les 24 h : un seul vote.
        if (base.prepare("SELECT 1 FROM votes WHERE sujet = ? AND empreinte = ?").get(id, qui)) throw new Refus(409, "deja-compte");
        base.prepare("INSERT INTO votes (sujet, votant, valeur, empreinte, instant) VALUES (?, ?, ?, ?, ?)").run(id, votant, valeur, qui, maintenant());
      }
      tracer("vote", qui);
    }
    const s = base.prepare(`SELECT s.id, ${COMPTES} FROM sujets s WHERE s.id = ?`).get(id) as LigneSujet;
    return [200, { id, demandes: s.demandes, pour: s.pour, contre: s.contre, score: s.demandes + s.pour - s.contre, monVote: valeur }];
  }

  async function traduire(textes: string[], vers: unknown): Promise<string[]> {
    if (vers !== "fr" && vers !== "en") throw new Refus(400, "langue");
    if (!textes.length || textes.length > TEXTES_MAX || textes.some((t) => typeof t !== "string" || !t.trim()) || textes.join("").length > CARACTERES_MAX)
      throw new Refus(400, "textes");
    if (!options.traduire) throw new Refus(503, "traducteur-absent");
    try {
      return await options.traduire(textes, vers);
    } catch (e) {
      if (e instanceof ErreurTraduction) throw new Refus(e.code === "traducteur-absent" ? 503 : 502, e.code);
      throw new Refus(502, "traducteur");
    }
  }

  function connexion(corps: Corps, qui: string): [number, unknown, string?] {
    if (compter("connexion", qui) >= CONNEXIONS_PAR_HEURE) throw new Refus(429, "trop-d-essais");
    const ligne = options.lireMotDePasse();
    if (!ligne) throw new Refus(503, "mot-de-passe-absent");
    tracer("connexion", qui);
    if (typeof corps.motDePasse !== "string" || !verifierMotDePasse(corps.motDePasse, ligne)) throw new Refus(401, "mot-de-passe");
    const valeur = jeton(32);
    sessions.set(valeur, maintenant() + DUREE_SESSION);
    const cookie = `${COOKIE}=${valeur}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${DUREE_SESSION / 1000}`;
    return [200, { connecte: true }, cookie];
  }

  function modifierRemarque(id: number, corps: Corps): [number, unknown] {
    const existe = base.prepare("SELECT id FROM remarques WHERE id = ?").get(id);
    if (!existe) throw new Refus(404, "introuvable");
    if (corps.etat !== undefined) {
      if (typeof corps.etat !== "string" || !(ETATS_REMARQUE as readonly string[]).includes(corps.etat)) throw new Refus(400, "etat");
      base.prepare("UPDATE remarques SET etat = ? WHERE id = ?").run(corps.etat, id);
    }
    if (corps.reponse !== undefined) {
      const reponse = texte(corps.reponse, TEXTE_MAX, "reponse-trop-longue");
      base.prepare("UPDATE remarques SET reponse = ?, repondu = ? WHERE id = ?").run(reponse, reponse ? maintenant() : null, id);
    }
    if (corps.sujet !== undefined) {
      const sujet = corps.sujet === null ? null : Number(corps.sujet);
      if (sujet !== null && !base.prepare("SELECT id FROM sujets WHERE id = ?").get(sujet)) throw new Refus(400, "sujet");
      base.prepare("UPDATE remarques SET sujet = ? WHERE id = ?").run(sujet, id);
    }
    return [200, base.prepare("SELECT * FROM remarques WHERE id = ?").get(id)];
  }

  /** Titres courts (300 caractères), descriptions et réponses longues (2 000). */
  const maxChamp = (champ: string) => (champ.startsWith("titre") ? COURT_MAX : TEXTE_MAX);

  function modifierSujet(id: number, corps: Corps): [number, unknown] {
    const avant = base.prepare("SELECT titre, titre_en FROM sujets WHERE id = ?").get(id) as { titre: string; titre_en: string | null } | undefined;
    if (!avant) throw new Refus(404, "introuvable");
    const changes: Record<string, unknown> = {};
    for (const champ of CHAMPS_SUJET) if (corps[champ] !== undefined) changes[champ] = texte(corps[champ], maxChamp(champ), `${champ}-trop-long`);
    const titre = changes.titre !== undefined ? changes.titre : avant.titre || null;
    const titreEn = changes.titre_en !== undefined ? changes.titre_en : avant.titre_en;
    if (!titre && !titreEn) throw new Refus(400, "titre");
    if ("titre" in changes) changes.titre = changes.titre ?? "";
    if (corps.etat !== undefined) {
      if (typeof corps.etat !== "string" || !(ETATS_SUJET as readonly string[]).includes(corps.etat)) throw new Refus(400, "etat");
      changes.etat = corps.etat;
    }
    if (corps.auto !== undefined) changes.auto = ecrireAuto(corps.auto);
    if (corps.publie !== undefined) changes.publie = corps.publie ? 1 : 0;
    const colonnes = Object.keys(changes);
    if (colonnes.length) {
      base.prepare(`UPDATE sujets SET ${colonnes.map((c) => `${c} = ?`).join(", ")}, maj = ? WHERE id = ?`).run(...(Object.values(changes) as (string | number | null)[]), maintenant(), id);
    }
    return [200, sujet(id)];
  }

  function sujet(id: number): unknown {
    return avecScore(base.prepare(`SELECT s.*, ${COMPTES} FROM sujets s WHERE s.id = ?`).get(id) as LigneSujet);
  }

  function creerSujet(corps: Corps): [number, unknown] {
    const valeurs = CHAMPS_SUJET.map((champ) => texte(corps[champ], maxChamp(champ), `${champ}-trop-long`));
    if (!valeurs[0] && !valeurs[1]) throw new Refus(400, "titre");
    const remarque = corps.remarque === undefined || corps.remarque === null ? null : Number(corps.remarque);
    if (remarque !== null && !base.prepare("SELECT id FROM remarques WHERE id = ?").get(remarque)) throw new Refus(400, "remarque");
    const { lastInsertRowid } = base
      .prepare(`INSERT INTO sujets (cree, maj, ${CHAMPS_SUJET.join(", ")}, auto, publie) VALUES (?, ?, ${CHAMPS_SUJET.map(() => "?").join(", ")}, ?, ?)`)
      .run(maintenant(), maintenant(), valeurs[0] ?? "", ...valeurs.slice(1), ecrireAuto(corps.auto ?? []), corps.publie ? 1 : 0);
    const id = Number(lastInsertRowid);
    if (remarque !== null) base.prepare("UPDATE remarques SET sujet = ? WHERE id = ?").run(id, remarque);
    return [201, sujet(id)];
  }

  /** La même réponse à chaque joueur du sujet qui n'en a pas encore, dans la langue de sa remarque. */
  function repondreATous(id: number, corps: Corps): [number, unknown] {
    if (!base.prepare("SELECT id FROM sujets WHERE id = ?").get(id)) throw new Refus(404, "introuvable");
    const fr = texte(corps.reponse, TEXTE_MAX, "reponse-trop-longue");
    const en = texte(corps.reponse_en, TEXTE_MAX, "reponse-trop-longue");
    if (!fr && !en) throw new Refus(400, "reponse-vide");
    const cibles = base.prepare("SELECT id, langue FROM remarques WHERE sujet = ? AND reponse IS NULL").all(id) as { id: number; langue: string | null }[];
    const ecrire = base.prepare("UPDATE remarques SET reponse = ?, repondu = ? WHERE id = ?");
    for (const r of cibles) ecrire.run(r.langue === "en" ? (en ?? fr) : (fr ?? en), maintenant(), r.id);
    return [200, { repondu: cibles.map((r) => r.id) }];
  }

  function listeRemarques(params: URLSearchParams): unknown[] {
    const conditions: string[] = [];
    const valeurs: string[] = [];
    for (const champ of ["type", "etat", "langue"] as const) {
      const v = params.get(champ);
      if (v) {
        conditions.push(`${champ} = ?`);
        valeurs.push(v);
      }
    }
    const ou = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    // La liste ne porte pas les pièces jointes (elles peuvent être longues) : on les lit une par une.
    return base
      .prepare(`SELECT id, cree, type, texte, pseudo, page, langue, version, plan, piece IS NOT NULL AS aPiece, etat, reponse, repondu, sujet, traduction FROM remarques ${ou} ORDER BY etat = 'nouvelle' DESC, cree DESC`)
      .all(...valeurs);
  }

  async function admin(methode: string, morceaux: string[], params: URLSearchParams, corps: Corps): Promise<[number, unknown, string?]> {
    const [quoi, id, suite] = morceaux;
    if (quoi === "session" && methode === "GET") return [200, { connecte: true, traducteur: options.traducteurPret?.() ?? !!options.traduire }];
    if (quoi === "traduire" && id === undefined && methode === "POST") {
      if (!Array.isArray(corps.textes)) throw new Refus(400, "textes");
      return [200, { textes: await traduire(corps.textes as string[], corps.vers) }];
    }
    if (quoi === "remarques") {
      if (id === undefined && methode === "GET") return [200, listeRemarques(params)];
      const n = entier(id);
      if (suite === "traduire" && methode === "POST") {
        const ligne = base.prepare("SELECT texte FROM remarques WHERE id = ?").get(n) as { texte: string } | undefined;
        if (!ligne) throw new Refus(404, "introuvable");
        if (!ligne.texte.trim()) throw new Refus(400, "texte-vide");
        const [traduction] = await traduire([ligne.texte], corps.vers ?? "fr");
        base.prepare("UPDATE remarques SET traduction = ? WHERE id = ?").run(traduction!, n);
        return [200, { traduction }];
      }
      if (suite !== undefined) throw new Refus(404, "introuvable");
      if (methode === "GET") {
        const ligne = base.prepare("SELECT * FROM remarques WHERE id = ?").get(n);
        if (!ligne) throw new Refus(404, "introuvable");
        return [200, ligne];
      }
      if (methode === "POST") return modifierRemarque(n, corps);
      if (methode === "DELETE") {
        const { changes } = base.prepare("DELETE FROM remarques WHERE id = ?").run(n);
        if (!changes) throw new Refus(404, "introuvable");
        return [200, { supprime: n }];
      }
    }
    if (quoi === "sujets") {
      if (id === undefined && methode === "GET") {
        return [200, (base.prepare(`SELECT s.*, ${COMPTES} FROM sujets s`).all() as LigneSujet[]).map(avecScore).sort(ordreSujets)];
      }
      if (id === undefined && methode === "POST") return creerSujet(corps);
      const n = entier(id);
      if (suite === "repondre" && methode === "POST") return repondreATous(n, corps);
      if (suite !== undefined) throw new Refus(404, "introuvable");
      if (methode === "GET") {
        if (!base.prepare("SELECT id FROM sujets WHERE id = ?").get(n)) throw new Refus(404, "introuvable");
        return [200, sujet(n)];
      }
      if (methode === "POST") return modifierSujet(n, corps);
      if (methode === "DELETE") {
        const { changes } = base.prepare("DELETE FROM sujets WHERE id = ?").run(n);
        if (!changes) throw new Refus(404, "introuvable");
        return [200, { supprime: n }];
      }
    }
    if (quoi === "export" && methode === "GET") {
      return [200, { exporte: maintenant(), remarques: base.prepare("SELECT * FROM remarques ORDER BY id").all(), sujets: base.prepare("SELECT * FROM sujets ORDER BY id").all() }];
    }
    if (quoi === "mesures" && methode === "GET") return [200, mesures];
    throw new Refus(404, "introuvable");
  }

  async function router(req: IncomingMessage): Promise<[number, unknown, string?]> {
    const url = new URL(req.url ?? "/", "http://service");
    const methode = req.method ?? "GET";
    const morceaux = url.pathname.split("/").filter(Boolean);
    if (morceaux[0] !== "api") throw new Refus(404, "introuvable");
    const ecriture = methode !== "GET" && methode !== "HEAD";
    if (ecriture) {
      const origine = req.headers.origin;
      if (typeof origine !== "string" || !options.origines.includes(origine)) throw new Refus(403, "origine");
    }
    purgerEmpreintes(base, maintenant());
    const corps = ecriture ? await lireCorps(req) : {};
    const qui = empreinte(adresse(req), sel);
    const [, section, a, b, ...reste] = morceaux;

    if (section === "remarques") {
      if (a === undefined && methode === "POST") return envoyerRemarque(corps, qui);
      if (a !== undefined && b === undefined && methode === "GET") {
        const ligne = base.prepare("SELECT id, type, cree, etat, reponse, repondu FROM remarques WHERE numero = ?").get(a);
        if (!ligne) throw new Refus(404, "introuvable");
        return [200, ligne];
      }
    }
    if (section === "propositions") {
      if (a === undefined && methode === "GET") return [200, propositions(votantDe(req.headers["x-votant"]))];
      if (b === "vote" && reste.length === 0 && methode === "POST") return voter(entier(a), corps, qui);
    }
    if (section === "admin") {
      if (a === "connexion" && methode === "POST") return connexion(corps, qui);
      if (!connecte(req)) throw new Refus(401, "non-connecte");
      if (a === "deconnexion" && methode === "POST") {
        sessions.delete(cookies(req).get(COOKIE)!);
        return [200, { connecte: false }, `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`];
      }
      return admin(methode, [a, b, ...reste].filter((m): m is string => m !== undefined), url.searchParams, corps);
    }
    throw new Refus(404, "introuvable");
  }

  function repondre(res: ServerResponse, statut: number, valeur: unknown, cookie?: string): void {
    const corps = JSON.stringify(valeur);
    res.writeHead(statut, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(corps),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    });
    res.end(corps);
  }

  const serveur = createServer((req, res) => {
    const debut = performance.now();
    res.on("finish", () => {
      const duree = performance.now() - debut;
      mesures.requetes += 1;
      mesures.dureeTotaleMs += duree;
      mesures.dureeMaxMs = Math.max(mesures.dureeMaxMs, duree);
      mesures.parStatut[res.statusCode] = (mesures.parStatut[res.statusCode] ?? 0) + 1;
    });
    router(req).then(
      ([statut, valeur, cookie]) => repondre(res, statut, valeur, cookie),
      (e: unknown) => {
        if (e instanceof Refus) return repondre(res, e.statut, { erreur: e.message });
        console.error(e);
        repondre(res, 500, { erreur: "interne" });
      },
    );
  });
  serveur.requestTimeout = 15_000;
  serveur.headersTimeout = 10_000;

  return { serveur, mesures, purger: () => purgerEmpreintes(base, maintenant()) };
}
