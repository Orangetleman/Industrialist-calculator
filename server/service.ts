/**
 * Service des remarques (S34) : les accès HTTP, sans dépendance (`node:http`).
 *
 * Publics :
 *   POST /api/remarques                    envoyer une remarque (5 par heure et par visiteur, 2 000 caractères)
 *   GET  /api/remarques/<numéro>           relire sa remarque et la réponse de l'auteur (numéro secret)
 *   GET  /api/propositions                 sujets publiés par l'auteur
 *   POST /api/propositions/<id>/plus1      un +1 par visiteur et par sujet
 * Réservés (cookie de session, après POST /api/admin/connexion) :
 *   /api/admin/session, /deconnexion, /remarques[/<id>], /sujets[/<id>], /export, /mesures
 *
 * Toute écriture vérifie l'en-tête Origin. Les réponses sont du JSON : les textes reçus ne sont jamais servis en HTML.
 * Les erreurs sont des codes (`{ erreur: "trop-de-remarques" }`), traduits par le site.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { purgerEmpreintes, selDesEmpreintes } from "./base.ts";
import { empreinte, jeton, verifierMotDePasse } from "./securite.ts";

export const TYPES = ["valeur", "bogue", "idee", "traduction", "correction"] as const;
export const ETATS_REMARQUE = ["nouvelle", "lue", "traitee"] as const;
export const ETATS_SUJET = ["propose", "prevu", "fait", "refuse"] as const;
export const TEXTE_MAX = 2000;
export const ENVOIS_PAR_HEURE = 5;
export const CONNEXIONS_PAR_HEURE = 10;
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
    if (typeof corps[CHAMP_PIEGE] === "string" && corps[CHAMP_PIEGE] !== "") return [201, { numero: jeton(12) }];
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
    base
      .prepare("INSERT INTO remarques (numero, cree, type, texte, pseudo, page, langue, version, plan, piece) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        numero,
        maintenant(),
        type,
        contenu ?? "",
        texte(corps.pseudo, PSEUDO_MAX, "pseudo-trop-long"),
        texte(corps.page, COURT_MAX, "page-trop-longue"),
        langue,
        texte(corps.version, COURT_MAX, "version-trop-longue"),
        texte(corps.plan, PLAN_MAX, "plan-trop-long"),
        piece,
      );
    tracer("envoi", qui);
    return [201, { numero }];
  }

  function propositions(): unknown[] {
    return base
      .prepare(
        `SELECT s.id, s.titre, s.etat, s.reponse,
           (SELECT COUNT(*) FROM remarques r WHERE r.sujet = s.id) AS demandes,
           (SELECT COUNT(*) FROM plus1 p WHERE p.sujet = s.id) AS plus1
         FROM sujets s WHERE s.publie = 1 ORDER BY demandes + plus1 DESC, s.id`,
      )
      .all();
  }

  function plus1(id: number, qui: string): [number, unknown] {
    const sujet = base.prepare("SELECT id FROM sujets WHERE id = ? AND publie = 1").get(id);
    if (!sujet) throw new Refus(404, "introuvable");
    const deja = base.prepare("SELECT 1 FROM plus1 WHERE sujet = ? AND empreinte = ?").get(id, qui);
    if (deja) throw new Refus(409, "deja-compte");
    base.prepare("INSERT INTO plus1 (sujet, empreinte, instant) VALUES (?, ?, ?)").run(id, qui, maintenant());
    const { n } = base.prepare("SELECT COUNT(*) AS n FROM plus1 WHERE sujet = ?").get(id) as { n: number };
    return [200, { plus1: n }];
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

  function modifierSujet(id: number, corps: Corps): [number, unknown] {
    if (!base.prepare("SELECT id FROM sujets WHERE id = ?").get(id)) throw new Refus(404, "introuvable");
    if (corps.titre !== undefined) {
      const titre = texte(corps.titre, COURT_MAX, "titre");
      if (!titre) throw new Refus(400, "titre");
      base.prepare("UPDATE sujets SET titre = ? WHERE id = ?").run(titre, id);
    }
    if (corps.etat !== undefined) {
      if (typeof corps.etat !== "string" || !(ETATS_SUJET as readonly string[]).includes(corps.etat)) throw new Refus(400, "etat");
      base.prepare("UPDATE sujets SET etat = ? WHERE id = ?").run(corps.etat, id);
    }
    if (corps.reponse !== undefined) base.prepare("UPDATE sujets SET reponse = ? WHERE id = ?").run(texte(corps.reponse, TEXTE_MAX, "reponse-trop-longue"), id);
    if (corps.publie !== undefined) base.prepare("UPDATE sujets SET publie = ? WHERE id = ?").run(corps.publie ? 1 : 0, id);
    return [200, base.prepare("SELECT * FROM sujets WHERE id = ?").get(id)];
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
      .prepare(`SELECT id, cree, type, texte, pseudo, page, langue, version, plan, piece IS NOT NULL AS aPiece, etat, reponse, repondu, sujet FROM remarques ${ou} ORDER BY etat = 'nouvelle' DESC, cree DESC`)
      .all(...valeurs);
  }

  function admin(methode: string, morceaux: string[], params: URLSearchParams, corps: Corps): [number, unknown, string?] {
    const [quoi, id] = morceaux;
    if (quoi === "session" && methode === "GET") return [200, { connecte: true }];
    if (quoi === "remarques") {
      if (id === undefined && methode === "GET") return [200, listeRemarques(params)];
      const n = entier(id);
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
        return [
          200,
          base
            .prepare(
              `SELECT s.*, (SELECT COUNT(*) FROM remarques r WHERE r.sujet = s.id) AS demandes, (SELECT COUNT(*) FROM plus1 p WHERE p.sujet = s.id) AS plus1
               FROM sujets s ORDER BY demandes + plus1 DESC, s.id`,
            )
            .all(),
        ];
      }
      if (id === undefined && methode === "POST") {
        const titre = texte(corps.titre, COURT_MAX, "titre");
        if (!titre) throw new Refus(400, "titre");
        const { lastInsertRowid } = base.prepare("INSERT INTO sujets (cree, titre) VALUES (?, ?)").run(maintenant(), titre);
        return [201, base.prepare("SELECT * FROM sujets WHERE id = ?").get(lastInsertRowid)];
      }
      const n = entier(id);
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
        const ligne = base.prepare("SELECT type, cree, etat, reponse, repondu FROM remarques WHERE numero = ?").get(a);
        if (!ligne) throw new Refus(404, "introuvable");
        return [200, ligne];
      }
    }
    if (section === "propositions") {
      if (a === undefined && methode === "GET") return [200, propositions()];
      if (b === "plus1" && reste.length === 0 && methode === "POST") return plus1(entier(a), qui);
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
