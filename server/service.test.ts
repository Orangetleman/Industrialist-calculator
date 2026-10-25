import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GARDE_EMPREINTE, ouvrirBase, sauvegarder } from "./base.ts";
import { hacherMotDePasse, verifierMotDePasse } from "./securite.ts";
import { CHAMP_PIEGE, creerService, DUREE_SESSION, ENVOIS_PAR_HEURE, TEXTE_MAX, VOTES_PAR_HEURE, type Service } from "./service.ts";
import { adresseDeepL, traducteurDeepL } from "./traducteur.ts";

const ORIGINE = "https://industrialist.myprisme.fr";
const MOT_DE_PASSE = "essai-des-tests";
const LIGNE = hacherMotDePasse(MOT_DE_PASSE);

let base: DatabaseSync;
let service: Service;
let adresse: string;
let horloge: number;

beforeEach(async () => {
  horloge = Date.UTC(2026, 9, 25, 12);
  base = ouvrirBase(":memory:");
  service = creerService({ base, origines: [ORIGINE], lireMotDePasse: () => LIGNE, maintenant: () => horloge });
  await new Promise<void>((ok) => service.serveur.listen(0, "127.0.0.1", ok));
  adresse = `http://127.0.0.1:${(service.serveur.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((ok) => service.serveur.close(ok));
  base.close();
});

interface Requete {
  methode?: string;
  corps?: unknown;
  ip?: string;
  origine?: string | null;
  cookie?: string;
}

async function appel(chemin: string, { methode = "GET", corps, ip = "203.0.113.7", origine = ORIGINE, cookie }: Requete = {}) {
  const entetes: Record<string, string> = { "CF-Connecting-IP": ip };
  if (corps !== undefined) entetes["Content-Type"] = "application/json";
  if (origine && methode !== "GET") entetes.Origin = origine;
  if (cookie) entetes.Cookie = cookie;
  const r = await fetch(adresse + chemin, { method: methode, headers: entetes, body: corps === undefined ? undefined : JSON.stringify(corps) });
  return { statut: r.status, corps: (await r.json()) as Record<string, unknown> & unknown[], cookie: r.headers.get("set-cookie") };
}

const remarque = (texte = "La recette du fer donne 2, pas 3.") => ({ type: "valeur", texte, page: "#recettes/fer", langue: "fr", version: "4ee0ec6" });

async function seConnecter(): Promise<string> {
  const r = await appel("/api/admin/connexion", { methode: "POST", corps: { motDePasse: MOT_DE_PASSE } });
  expect(r.statut).toBe(200);
  return r.cookie!.split(";")[0]!;
}

describe("mot de passe (scrypt)", () => {
  it("vérifie le bon et refuse le mauvais, sans garder le mot de passe en clair", () => {
    expect(LIGNE.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(LIGNE).not.toContain(MOT_DE_PASSE);
    expect(verifierMotDePasse(MOT_DE_PASSE, LIGNE)).toBe(true);
    expect(verifierMotDePasse("autre-chose", LIGNE)).toBe(false);
    expect(verifierMotDePasse(MOT_DE_PASSE, "n'importe quoi")).toBe(false);
  });
});

describe("envoyer une remarque", () => {
  it("une remarque envoyée est relue par l'accès réservé, et le joueur lit la réponse par son numéro", async () => {
    const envoi = await appel("/api/remarques", { methode: "POST", corps: { ...remarque(), pseudo: "Joueur#1" } });
    expect(envoi.statut).toBe(201);
    const numero = envoi.corps.numero as string;
    expect(numero).toMatch(/^[\w-]{16}$/);

    const cookie = await seConnecter();
    const liste = await appel("/api/admin/remarques", { cookie });
    expect(liste.statut).toBe(200);
    expect(liste.corps).toHaveLength(1);
    const lue = liste.corps[0] as Record<string, unknown>;
    expect(lue).toMatchObject({ type: "valeur", texte: remarque().texte, pseudo: "Joueur#1", page: "#recettes/fer", langue: "fr", etat: "nouvelle" });

    expect((await appel(`/api/admin/remarques/${lue.id}`, { methode: "POST", corps: { reponse: "Corrigé, merci !", etat: "traitee" }, cookie })).statut).toBe(200);
    const vue = await appel(`/api/remarques/${numero}`);
    expect(vue.corps).toMatchObject({ type: "valeur", etat: "traitee", reponse: "Corrigé, merci !" });
    expect(vue.corps).not.toHaveProperty("texte");
    expect((await appel("/api/remarques/inconnu")).statut).toBe(404);
  });

  it("la 6ᵉ remarque dans l'heure est refusée, et l'envoi revient une heure après", async () => {
    for (let i = 0; i < ENVOIS_PAR_HEURE; i++) expect((await appel("/api/remarques", { methode: "POST", corps: remarque() })).statut).toBe(201);
    const sixieme = await appel("/api/remarques", { methode: "POST", corps: remarque() });
    expect(sixieme).toMatchObject({ statut: 429, corps: { erreur: "trop-de-remarques" } });
    // Un autre visiteur n'est pas gêné.
    expect((await appel("/api/remarques", { methode: "POST", corps: remarque(), ip: "198.51.100.2" })).statut).toBe(201);
    horloge += 3600_000 + 1;
    expect((await appel("/api/remarques", { methode: "POST", corps: remarque() })).statut).toBe(201);
  });

  it("refuse plus de 2 000 caractères, un type inconnu et un texte vide", async () => {
    expect((await appel("/api/remarques", { methode: "POST", corps: remarque("x".repeat(TEXTE_MAX)) })).statut).toBe(201);
    expect(await appel("/api/remarques", { methode: "POST", corps: remarque("x".repeat(TEXTE_MAX + 1)) })).toMatchObject({ statut: 400, corps: { erreur: "texte-trop-long" } });
    expect((await appel("/api/remarques", { methode: "POST", corps: { ...remarque(), type: "pub" } })).statut).toBe(400);
    expect((await appel("/api/remarques", { methode: "POST", corps: { ...remarque("   ") } })).statut).toBe(400);
  });

  it("la case piège fait croire au robot qu'il a réussi, mais rien n'est gardé", async () => {
    const r = await appel("/api/remarques", { methode: "POST", corps: { ...remarque(), [CHAMP_PIEGE]: "http://pub.example" } });
    expect(r.statut).toBe(201);
    expect((base.prepare("SELECT COUNT(*) AS n FROM remarques").get() as { n: number }).n).toBe(0);
    expect((await appel(`/api/remarques/${r.corps.numero}`)).statut).toBe(404);
  });

  it("une correction garde sa pièce jointe, lue une par une par l'accès réservé", async () => {
    const piece = { ports: { "Iron Furnace": [{ cote: "N", case: 2 }] } };
    expect((await appel("/api/remarques", { methode: "POST", corps: { type: "correction", piece } })).statut).toBe(201);
    const cookie = await seConnecter();
    const [ligne] = (await appel("/api/admin/remarques", { cookie })).corps as Record<string, unknown>[];
    expect(ligne).toMatchObject({ type: "correction", aPiece: 1 });
    expect(ligne).not.toHaveProperty("piece");
    expect(JSON.parse((await appel(`/api/admin/remarques/${ligne!.id}`, { cookie })).corps.piece as string)).toEqual(piece);
  });

  it("l'envoi peut être fermé par un réglage", async () => {
    const ferme = creerService({ base, origines: [ORIGINE], lireMotDePasse: () => LIGNE, fermees: true });
    await new Promise<void>((ok) => ferme.serveur.listen(0, "127.0.0.1", ok));
    const r = await fetch(`http://127.0.0.1:${(ferme.serveur.address() as AddressInfo).port}/api/remarques`, { method: "POST", headers: { Origin: ORIGINE }, body: JSON.stringify(remarque()) });
    expect(r.status).toBe(503);
    await new Promise((ok) => ferme.serveur.close(ok));
  });
});

describe("empreinte des visiteurs", () => {
  it("l'adresse n'est jamais gardée, et son empreinte salée est effacée au bout de 24 h", async () => {
    const ip = "203.0.113.99";
    await appel("/api/remarques", { methode: "POST", corps: remarque(), ip });
    const tout = () => JSON.stringify([base.prepare("SELECT * FROM remarques").all(), base.prepare("SELECT * FROM traces").all(), base.prepare("SELECT * FROM votes").all()]);
    expect(tout()).not.toContain(ip);
    const traces = () => base.prepare("SELECT empreinte FROM traces").all() as { empreinte: string }[];
    expect(traces()).toHaveLength(1);
    expect(traces()[0]!.empreinte).toMatch(/^[\w-]{22}$/);

    horloge += GARDE_EMPREINTE - 1000;
    service.purger();
    expect(traces()).toHaveLength(1);
    horloge += 1000;
    service.purger();
    expect(traces()).toHaveLength(0);
    // La remarque, elle, reste.
    expect((base.prepare("SELECT COUNT(*) AS n FROM remarques").get() as { n: number }).n).toBe(1);
  });

  it("la purge passe aussi d'elle-même à la requête suivante", async () => {
    await appel("/api/remarques", { methode: "POST", corps: remarque() });
    horloge += GARDE_EMPREINTE + 1;
    await appel("/api/propositions");
    expect(base.prepare("SELECT * FROM traces").all()).toHaveLength(0);
  });

  it("la copie de la nuit ne garde ni empreinte ni sel, et 7 copies au plus", () => {
    const dossier = mkdtempSync(join(tmpdir(), "remarques-"));
    try {
      const disque = ouvrirBase(join(dossier, "remarques.db"));
      disque.prepare("INSERT INTO traces (genre, empreinte, instant) VALUES ('envoi', 'abc', ?)").run(horloge);
      disque.prepare("INSERT INTO reglages (cle, valeur) VALUES ('sel', 'secret')").run();
      disque.prepare("INSERT INTO remarques (numero, cree, type, texte) VALUES ('n1', ?, 'idee', 'Bonne idée')").run(horloge);
      for (let jour = 0; jour < 9; jour++) expect(sauvegarder(disque, dossier, horloge + jour * 86_400_000)).toMatch(/^copie-/);
      expect(sauvegarder(disque, dossier, horloge + 8 * 86_400_000)).toBeNull();
      disque.close();
      const copies = readdirSync(dossier).filter((f) => f.startsWith("copie-"));
      expect(copies).toHaveLength(7);
      const copie = new DatabaseSync(join(dossier, copies.at(-1)!));
      expect(copie.prepare("SELECT COUNT(*) AS n FROM traces").get()).toMatchObject({ n: 0 });
      expect(copie.prepare("SELECT COUNT(*) AS n FROM reglages").get()).toMatchObject({ n: 0 });
      expect(copie.prepare("SELECT texte FROM remarques").get()).toMatchObject({ texte: "Bonne idée" });
      copie.close();
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe("accès réservé /api/admin/", () => {
  it("sans session, tout est refusé", async () => {
    for (const [chemin, methode] of [
      ["/api/admin/remarques", "GET"],
      ["/api/admin/remarques/1", "GET"],
      ["/api/admin/remarques/1", "DELETE"],
      ["/api/admin/sujets", "GET"],
      ["/api/admin/sujets", "POST"],
      ["/api/admin/export", "GET"],
      ["/api/admin/mesures", "GET"],
      ["/api/admin/session", "GET"],
    ] as const) {
      expect((await appel(chemin, { methode, corps: methode === "POST" ? {} : undefined, cookie: "remarques_session=faux" })).statut).toBe(401);
    }
  });

  it("le mauvais mot de passe est refusé, et les essais sont limités", async () => {
    for (let i = 0; i < 10; i++) expect((await appel("/api/admin/connexion", { methode: "POST", corps: { motDePasse: "mauvais" } })).statut).toBe(401);
    expect((await appel("/api/admin/connexion", { methode: "POST", corps: { motDePasse: MOT_DE_PASSE } })).statut).toBe(429);
  });

  it("le cookie de session est HttpOnly, Secure, SameSite=Strict, limité à /api/admin, et expire", async () => {
    const r = await appel("/api/admin/connexion", { methode: "POST", corps: { motDePasse: MOT_DE_PASSE } });
    const attributs = r.cookie!.split(";").map((a) => a.trim());
    expect(attributs).toEqual(expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Strict", "Path=/api/admin"]));
    const cookie = attributs[0]!;
    expect((await appel("/api/admin/session", { cookie })).statut).toBe(200);
    horloge += DUREE_SESSION;
    expect((await appel("/api/admin/session", { cookie })).statut).toBe(401);
  });

  it("la déconnexion ferme la session", async () => {
    const cookie = await seConnecter();
    expect((await appel("/api/admin/deconnexion", { methode: "POST", cookie })).statut).toBe(200);
    // La session est oubliée côté service, pas seulement côté navigateur.
    expect((await appel("/api/admin/session", { cookie })).statut).toBe(401);
  });

  it("toute écriture sans la bonne Origin est refusée, même connectée", async () => {
    const cookie = await seConnecter();
    expect(await appel("/api/admin/sujets", { methode: "POST", corps: { titre: "X" }, cookie, origine: "https://pirate.example" })).toMatchObject({ statut: 403, corps: { erreur: "origine" } });
    expect((await appel("/api/admin/sujets", { methode: "POST", corps: { titre: "X" }, cookie, origine: null })).statut).toBe(403);
    expect((await appel("/api/remarques", { methode: "POST", corps: remarque(), origine: "https://pirate.example" })).statut).toBe(403);
    expect((await appel("/api/admin/connexion", { methode: "POST", corps: { motDePasse: MOT_DE_PASSE }, origine: null })).statut).toBe(403);
  });

  it("sans mot de passe choisi, la connexion est impossible", async () => {
    const sans = creerService({ base, origines: [ORIGINE], lireMotDePasse: () => null });
    await new Promise<void>((ok) => sans.serveur.listen(0, "127.0.0.1", ok));
    const r = await fetch(`http://127.0.0.1:${(sans.serveur.address() as AddressInfo).port}/api/admin/connexion`, { method: "POST", headers: { Origin: ORIGINE }, body: JSON.stringify({ motDePasse: "" }) });
    expect(r.status).toBe(503);
    await new Promise((ok) => sans.serveur.close(ok));
  });

  it("supprimer une remarque, exporter, mesurer", async () => {
    await appel("/api/remarques", { methode: "POST", corps: remarque() });
    const cookie = await seConnecter();
    const [ligne] = (await appel("/api/admin/remarques", { cookie })).corps as { id: number }[];
    expect(((await appel("/api/admin/export", { cookie })).corps.remarques as unknown[]).length).toBe(1);
    expect((await appel(`/api/admin/remarques/${ligne!.id}`, { methode: "DELETE", cookie })).statut).toBe(200);
    expect((await appel(`/api/admin/remarques/${ligne!.id}`, { cookie })).statut).toBe(404);
    const mesures = (await appel("/api/admin/mesures", { cookie })).corps;
    expect(mesures.requetes).toBeGreaterThan(3);
    expect(JSON.stringify(mesures)).not.toContain("203.0.113");
  });
});


describe("sujets, Propositions et votes (S36)", () => {
  async function sujetPublie(cookie: string, corps: Record<string, unknown> = {}): Promise<number> {
    const cree = await appel("/api/admin/sujets", { methode: "POST", corps: { titre: "Ajouter le moteur électrique", publie: true, ...corps }, cookie });
    expect(cree.statut).toBe(201);
    return cree.corps.id as number;
  }
  const VOTANT_A = "votant-aaaaaaaaaaaaaaaa";
  const VOTANT_B = "votant-bbbbbbbbbbbbbbbb";
  const vote = (id: number, votant: string, valeur: number, ip?: string) => appel(`/api/propositions/${id}/vote`, { methode: "POST", corps: { votant, valeur }, ip });

  it("3 remarques rangées, réponse, publication : le sujet apparaît avec « 3 joueurs l'ont demandé »", async () => {
    const cookie = await seConnecter();
    const cree = await appel("/api/admin/sujets", { methode: "POST", corps: { titre: "Ajouter le moteur électrique" }, cookie });
    const id = cree.corps.id as number;
    for (let i = 0; i < 3; i++) await appel("/api/remarques", { methode: "POST", corps: { type: "idee", texte: `Idée ${i}` }, ip: `198.51.100.${i}` });
    const remarques = (await appel("/api/admin/remarques", { cookie })).corps as { id: number }[];
    for (const r of remarques) await appel(`/api/admin/remarques/${r.id}`, { methode: "POST", corps: { sujet: id }, cookie });
    expect((await appel("/api/propositions")).corps).toEqual([]);
    await appel(`/api/admin/sujets/${id}`, { methode: "POST", corps: { publie: true, etat: "prevu", reponse: "Pour la prochaine version.", reponse_en: "For the next version.", auto: ["reponse_en"] }, cookie });
    expect((await appel("/api/propositions")).corps).toMatchObject([
      { id, titre: "Ajouter le moteur électrique", etat: "prevu", reponse: "Pour la prochaine version.", reponse_en: "For the next version.", auto: ["reponse_en"], demandes: 3, pour: 0, contre: 0, score: 3, monVote: 0 },
    ]);
  });

  it("un vote ▲ / ▼ se change et se retire, comme sur Reddit, et reste compté après l'effacement des empreintes", async () => {
    const cookie = await seConnecter();
    const id = await sujetPublie(cookie, { publie: false });
    expect((await vote(id, VOTANT_A, 1)).statut).toBe(404);
    await appel(`/api/admin/sujets/${id}`, { methode: "POST", corps: { publie: true }, cookie });

    expect(await vote(id, VOTANT_A, 1)).toMatchObject({ statut: 200, corps: { pour: 1, contre: 0, score: 1, monVote: 1 } });
    expect(await vote(id, VOTANT_A, 1)).toMatchObject({ statut: 200, corps: { pour: 1, score: 1 } });
    expect(await vote(id, VOTANT_A, -1)).toMatchObject({ statut: 200, corps: { pour: 0, contre: 1, score: -1, monVote: -1 } });
    expect(await vote(id, VOTANT_A, 0)).toMatchObject({ statut: 200, corps: { pour: 0, contre: 0, score: 0, monVote: 0 } });
    await vote(id, VOTANT_A, 1);
    // Un autre navigateur à la même adresse : un seul vote par adresse et par sujet pendant 24 h.
    expect(await vote(id, VOTANT_B, 1)).toMatchObject({ statut: 409, corps: { erreur: "deja-compte" } });
    expect(await vote(id, VOTANT_B, 1, "198.51.100.50")).toMatchObject({ statut: 200, corps: { pour: 2 } });
    expect((await appel("/api/propositions")).corps).toMatchObject([{ id, pour: 2, monVote: 0 }]);
    const mien = await fetch(`${adresse}/api/propositions`, { headers: { "X-Votant": VOTANT_A } });
    expect(await mien.json()).toMatchObject([{ id, monVote: 1 }]);

    horloge += GARDE_EMPREINTE + 1;
    service.purger();
    expect(base.prepare("SELECT COUNT(*) AS n FROM votes WHERE empreinte IS NOT NULL").get()).toMatchObject({ n: 0 });
    // Le votant reste reconnu : il peut encore changer d'avis.
    expect(await vote(id, VOTANT_A, -1)).toMatchObject({ statut: 200, corps: { pour: 1, contre: 1 } });
    expect(JSON.stringify(base.prepare("SELECT * FROM votes").all())).not.toContain(VOTANT_A);
  });

  it("refuse un votant mal formé et plus de 60 votes par heure et par visiteur", async () => {
    const cookie = await seConnecter();
    const id = await sujetPublie(cookie);
    expect(await vote(id, "court", 1)).toMatchObject({ statut: 400, corps: { erreur: "votant" } });
    expect(await vote(id, VOTANT_A, 2)).toMatchObject({ statut: 400, corps: { erreur: "valeur" } });
    for (let i = 0; i < VOTES_PAR_HEURE; i++) expect((await vote(id, VOTANT_A, i % 2 ? -1 : 1)).statut).toBe(200);
    expect(await vote(id, VOTANT_A, 0)).toMatchObject({ statut: 429, corps: { erreur: "trop-de-votes" } });
  });

  it("score = remarques + ▲ − ▼ ; les sujets faits ou refusés passent en bas", async () => {
    const cookie = await seConnecter();
    const fait = await sujetPublie(cookie, { titre: "Site en anglais" });
    await appel(`/api/admin/sujets/${fait}`, { methode: "POST", corps: { etat: "fait" }, cookie });
    const petit = await sujetPublie(cookie, { titre: "Petit" });
    const grand = await sujetPublie(cookie, { titre: "Grand" });
    await vote(fait, VOTANT_A, 1);
    await vote(grand, VOTANT_A, 1);
    await vote(petit, VOTANT_B, -1, "198.51.100.9");
    expect(((await appel("/api/propositions")).corps as { id: number; score: number }[]).map((s) => [s.id, s.score])).toEqual([
      [grand, 1],
      [petit, -1],
      [fait, 1],
    ]);
  });

  it("crée un sujet en y rangeant une remarque, en anglais seulement s'il le faut ; supprimer le sujet libère ses remarques", async () => {
    const cookie = await seConnecter();
    const { corps } = await appel("/api/remarques", { methode: "POST", corps: { type: "idee", texte: "Share a plan with a link", langue: "en" } });
    expect((await appel("/api/admin/sujets", { methode: "POST", corps: {}, cookie })).corps).toEqual({ erreur: "titre" });
    const cree = await appel("/api/admin/sujets", { methode: "POST", corps: { titre_en: "Share a plan with a link", remarque: corps.id }, cookie });
    expect(cree.corps).toMatchObject({ titre: "", titre_en: "Share a plan with a link", demandes: 1, publie: 0 });
    const id = cree.corps.id as number;
    expect((await appel(`/api/admin/sujets/${id}`, { methode: "POST", corps: { titre_en: "" }, cookie })).corps).toEqual({ erreur: "titre" });
    expect((await appel(`/api/admin/remarques/${corps.id}`, { cookie })).corps).toMatchObject({ sujet: id });
    expect((await appel(`/api/admin/sujets/${id}`, { methode: "DELETE", cookie })).statut).toBe(200);
    expect((await appel(`/api/admin/remarques/${corps.id}`, { cookie })).corps).toMatchObject({ sujet: null });
  });

  it("répond à tous les joueurs d'un sujet dans leur langue, sans écraser une réponse déjà écrite", async () => {
    const cookie = await seConnecter();
    const id = await sujetPublie(cookie);
    const envoyer = async (langue: string, ip: string) => (await appel("/api/remarques", { methode: "POST", corps: { type: "idee", texte: "x", langue }, ip })).corps;
    const fr = await envoyer("fr", "198.51.100.1");
    const en = await envoyer("en", "198.51.100.2");
    const deja = await envoyer("en", "198.51.100.3");
    for (const r of [fr, en, deja]) await appel(`/api/admin/remarques/${r.id}`, { methode: "POST", corps: { sujet: id }, cookie });
    await appel(`/api/admin/remarques/${deja.id}`, { methode: "POST", corps: { reponse: "Déjà répondu." }, cookie });
    const r = await appel(`/api/admin/sujets/${id}/repondre`, { methode: "POST", corps: { reponse: "C'est prévu.", reponse_en: "It's planned." }, cookie });
    expect(r.corps).toEqual({ repondu: [fr.id, en.id] });
    expect((await appel(`/api/remarques/${fr.numero}`)).corps).toMatchObject({ reponse: "C'est prévu." });
    expect((await appel(`/api/remarques/${en.numero}`)).corps).toMatchObject({ reponse: "It's planned." });
    expect((await appel(`/api/remarques/${deja.numero}`)).corps).toMatchObject({ reponse: "Déjà répondu." });
  });

  it("sans mot de passe, tous les accès réservés sont refusés", async () => {
    for (const [chemin, methode] of [
      ["/api/admin/remarques", "GET"],
      ["/api/admin/remarques/1", "POST"],
      ["/api/admin/remarques/1/traduire", "POST"],
      ["/api/admin/sujets", "POST"],
      ["/api/admin/sujets/1/repondre", "POST"],
      ["/api/admin/traduire", "POST"],
      ["/api/admin/export", "GET"],
    ] as const)
      expect((await appel(chemin, { methode, corps: methode === "GET" ? undefined : {} })).statut).toBe(401);
  });
});

describe("traduction automatique (S36)", () => {
  it("passe par le traducteur et garde la traduction d'une remarque ; sans traducteur, le dit", async () => {
    const cookie = await seConnecter();
    expect((await appel("/api/admin/traduire", { methode: "POST", corps: { textes: ["Bonjour"], vers: "en" }, cookie })).corps).toEqual({ erreur: "traducteur-absent" });
    await new Promise((ok) => service.serveur.close(ok));
    const vus: [string[], string][] = [];
    const traduire = async (t: string[], v: string) => {
      vus.push([t, v]);
      return t.map((x) => `${v}:${x}`);
    };
    service = creerService({ base, origines: [ORIGINE], lireMotDePasse: () => LIGNE, maintenant: () => horloge, traduire });
    await new Promise<void>((ok) => service.serveur.listen(0, "127.0.0.1", ok));
    adresse = `http://127.0.0.1:${(service.serveur.address() as AddressInfo).port}`;
    const c = await seConnecter();
    expect((await appel("/api/admin/session", { cookie: c })).corps).toEqual({ connecte: true, traducteur: true });
    expect((await appel("/api/admin/traduire", { methode: "POST", corps: { textes: ["Bonjour", "Merci"], vers: "en" }, cookie: c })).corps).toEqual({ textes: ["en:Bonjour", "en:Merci"] });
    expect((await appel("/api/admin/traduire", { methode: "POST", corps: { textes: [""], vers: "en" }, cookie: c })).statut).toBe(400);
    expect((await appel("/api/admin/traduire", { methode: "POST", corps: { textes: ["x"], vers: "de" }, cookie: c })).statut).toBe(400);
    const { corps } = await appel("/api/remarques", { methode: "POST", corps: { type: "idee", texte: "Share a plan", langue: "en" } });
    expect((await appel(`/api/admin/remarques/${corps.id}/traduire`, { methode: "POST", corps: {}, cookie: c })).corps).toEqual({ traduction: "fr:Share a plan" });
    expect((await appel(`/api/admin/remarques/${corps.id}`, { cookie: c })).corps).toMatchObject({ traduction: "fr:Share a plan" });
    expect(vus.at(-1)).toEqual([["Share a plan"], "fr"]);
  });

  it("DeepL : clé Free vers api-free, erreurs en codes, rien sans clé", async () => {
    const appels: { url: string; init: RequestInit }[] = [];
    let statut = 200;
    const faux = (async (url: string, init: RequestInit) => {
      appels.push({ url, init });
      return new Response(JSON.stringify({ translations: [{ detected_source_language: "FR", text: "Hello" }] }), { status: statut });
    }) as unknown as typeof fetch;
    let cle: string | null = null;
    const t = traducteurDeepL(() => cle, faux);
    await expect(t(["Bonjour"], "en")).rejects.toMatchObject({ code: "traducteur-absent" });
    expect(appels).toHaveLength(0);
    cle = "0000aaaa-1111-bbbb-2222-cccc3333dddd:fx";
    expect(await t(["Bonjour"], "en")).toEqual(["Hello"]);
    expect(appels[0]!.url).toBe("https://api-free.deepl.com/v2/translate");
    expect((appels[0]!.init.headers as Record<string, string>).Authorization).toBe(`DeepL-Auth-Key ${cle}`);
    expect(JSON.parse(appels[0]!.init.body as string)).toEqual({ text: ["Bonjour"], target_lang: "EN-US" });
    expect(adresseDeepL("0000aaaa-1111-bbbb-2222-cccc3333dddd")).toBe("https://api.deepl.com/v2/translate");
    statut = 456;
    await expect(t(["Bonjour"], "fr")).rejects.toMatchObject({ code: "traducteur-quota" });
    statut = 403;
    await expect(t(["Bonjour"], "fr")).rejects.toMatchObject({ code: "traducteur-cle" });
  });
});

describe("base d'avant S36", () => {
  it("garde ses sujets et ses remarques, et ses +1 deviennent des votes ▲", () => {
    const dossier = mkdtempSync(join(tmpdir(), "remarques-"));
    try {
      const chemin = join(dossier, "ancienne.db");
      const ancienne = new DatabaseSync(chemin);
      ancienne.exec(`
        CREATE TABLE sujets (id INTEGER PRIMARY KEY, cree INTEGER NOT NULL, titre TEXT NOT NULL, etat TEXT NOT NULL DEFAULT 'propose', reponse TEXT, publie INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE remarques (id INTEGER PRIMARY KEY, numero TEXT NOT NULL UNIQUE, cree INTEGER NOT NULL, type TEXT NOT NULL, texte TEXT NOT NULL, pseudo TEXT, page TEXT, langue TEXT, version TEXT, plan TEXT, piece TEXT, etat TEXT NOT NULL DEFAULT 'nouvelle', reponse TEXT, repondu INTEGER, sujet INTEGER REFERENCES sujets(id) ON DELETE SET NULL);
        CREATE TABLE plus1 (sujet INTEGER NOT NULL REFERENCES sujets(id) ON DELETE CASCADE, empreinte TEXT, instant INTEGER NOT NULL);
        INSERT INTO sujets (id, cree, titre, publie) VALUES (1, 1, 'Ancien', 1);
        INSERT INTO remarques (numero, cree, type, texte, sujet) VALUES ('n1', 1, 'idee', 'Gardée', 1);
        INSERT INTO plus1 VALUES (1, NULL, 1), (1, 'abc', 2);
      `);
      ancienne.close();
      const b = ouvrirBase(chemin);
      expect(b.prepare("SELECT titre, titre_en FROM sujets").all()).toEqual([{ titre: "Ancien", titre_en: null }]);
      expect(b.prepare("SELECT texte, traduction FROM remarques").all()).toEqual([{ texte: "Gardée", traduction: null }]);
      expect(b.prepare("SELECT COUNT(*) AS n FROM votes WHERE valeur = 1").get()).toMatchObject({ n: 2 });
      expect(b.prepare("SELECT 1 FROM sqlite_master WHERE name = 'plus1'").get()).toBeUndefined();
      b.close();
      ouvrirBase(chemin).close(); // une 2ᵉ ouverture ne change rien
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe("numéros jamais redonnés (S36)", () => {
  it("une remarque ou un sujet supprimé ne laisse pas son numéro au suivant", async () => {
    const cookie = await seConnecter();
    const envoyer = async (ip: string) => (await appel("/api/remarques", { methode: "POST", corps: remarque(), ip })).corps.id as number;
    const a = await envoyer("198.51.100.1");
    const b = await envoyer("198.51.100.2");
    await appel(`/api/admin/remarques/${b}`, { methode: "DELETE", cookie });
    expect(await envoyer("198.51.100.3")).toBe(b + 1);
    expect(a).toBe(1);
    const s1 = (await appel("/api/admin/sujets", { methode: "POST", corps: { titre: "Un" }, cookie })).corps.id as number;
    await appel(`/api/admin/sujets/${s1}`, { methode: "DELETE", cookie });
    expect((await appel("/api/admin/sujets", { methode: "POST", corps: { titre: "Deux" }, cookie })).corps.id).toBe(s1 + 1);
  });
});
