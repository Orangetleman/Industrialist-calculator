/**
 * Service des remarques (S34) : point d'entrée, lancé directement par Node 24 (`node server/remarques.ts`).
 *
 * Sur le Pi (unité `industrialist-remarques`, voir scripts/pi/remarques.sh), réglages par l'environnement :
 *   REMARQUES_DONNEES      dossier de la base et des copies (/var/lib/industrialist-remarques)
 *   REMARQUES_MOT_DE_PASSE fichier du mot de passe haché (/etc/industrialist-remarques/mot-de-passe)
 *   REMARQUES_ORIGINES     origines admises pour les écritures, séparées par des virgules
 *   REMARQUES_PORT         port d'écoute sur 127.0.0.1 (8091)
 *   REMARQUES_FERMEES=1    ferme les envois
 *   REMARQUES_DISCORD      fichier de l'adresse du webhook du salon réservé (/etc/industrialist-remarques/discord,
 *                          posé par `npm run remarques:discord`) ; relu à chaque remarque, absent = pas de message
 *   REMARQUES_TABLEAU      adresse du tableau de bord citée dans le message (https://industrialist.myprisme.fr/tableau/)
 *   REMARQUES_DEEPL        fichier de la clé DeepL de l'auteur (/etc/industrialist-remarques/deepl, posé par
 *                          `npm run remarques:traducteur`, S36) ; relu à chaque traduction, absent = pas de traduction
 *   REMARQUES_TRADUCTEUR=essai  traducteur d'essai (« [EN] texte »), sans rien envoyer dehors (d'office en local sans clé)
 *
 * En local (`npm run remarques`, option --local) : base de test dans `.remarques-local/`, origines du serveur de
 * développement, et un mot de passe d'essai (`essai-local`, voir HEBERGEMENT.md) haché à la première fois.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ouvrirBase, purgerEmpreintes, sauvegarder } from "./base.ts";
import { messageDiscord, posterDiscord } from "./discord.ts";
import { hacherMotDePasse } from "./securite.ts";
import { traducteurDeepL, traducteurEssai } from "./traducteur.ts";
import { creerService } from "./service.ts";

const local = process.argv.includes("--local");
const env = process.env;
const donnees = resolve(env.REMARQUES_DONNEES ?? (local ? ".remarques-local" : "/var/lib/industrialist-remarques"));
const fichierMotDePasse = env.REMARQUES_MOT_DE_PASSE ?? (local ? join(donnees, "mot-de-passe") : "/etc/industrialist-remarques/mot-de-passe");
// En local, le serveur de développement prend le port suivant si 5173 est pris (jusqu'à 5179).
const portsLocaux = [5173, 5174, 5175, 5176, 5177, 5178, 5179].flatMap((p) => [`http://localhost:${p}`, `http://127.0.0.1:${p}`]).join(",");
const origines = (env.REMARQUES_ORIGINES ?? (local ? portsLocaux : "https://industrialist.myprisme.fr"))
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const port = Number(env.REMARQUES_PORT ?? 8091);
const fichierDiscord = env.REMARQUES_DISCORD ?? (local ? join(donnees, "discord") : "/etc/industrialist-remarques/discord");
const fichierDeepL = env.REMARQUES_DEEPL ?? (local ? join(donnees, "deepl") : "/etc/industrialist-remarques/deepl");
// En local sans clé DeepL, le traducteur d'essai : rien ne part dehors.
const essai = env.REMARQUES_TRADUCTEUR === "essai" || (local && !existsSync(fichierDeepL));
const tableau = env.REMARQUES_TABLEAU ?? (local ? "http://localhost:5173/tableau/" : "https://industrialist.myprisme.fr/tableau/");

/** Un fichier de réglage d'une ligne (webhook, clé DeepL), relu à chaque usage : posé ou changé sans redémarrer. */
function lireLigne(fichier: string): string | null {
  try {
    return readFileSync(fichier, "utf8").trim() || null;
  } catch {
    return null;
  }
}
const lireWebhook = () => lireLigne(fichierDiscord);
const lireCleDeepL = () => lireLigne(fichierDeepL);

mkdirSync(donnees, { recursive: true });
if (local && !existsSync(fichierMotDePasse)) writeFileSync(fichierMotDePasse, hacherMotDePasse("essai-local") + "\n", { mode: 0o600 });

const base = ouvrirBase(join(donnees, "remarques.db"));
const service = creerService({
  base,
  origines,
  fermees: env.REMARQUES_FERMEES === "1",
  traduire: essai ? traducteurEssai : traducteurDeepL(lireCleDeepL),
  traducteurPret: () => essai || lireCleDeepL() !== null,
  annoncer: (remarque) => {
    const webhook = lireWebhook();
    if (webhook) void posterDiscord(webhook, messageDiscord(remarque, tableau));
  },
  lireMotDePasse: () => {
    try {
      return readFileSync(fichierMotDePasse, "utf8").trim() || null;
    } catch {
      return null;
    }
  },
});

/** Chaque heure : empreintes de plus de 24 h effacées, et la copie du jour si elle manque. */
function entretien(): void {
  try {
    purgerEmpreintes(base, Date.now());
    const copie = sauvegarder(base, donnees, Date.now());
    if (copie) console.log(`Copie faite : ${copie}`);
  } catch (e) {
    console.error("Entretien impossible :", e);
  }
}
entretien();
const minuterie = setInterval(entretien, 3600_000);

service.serveur.listen(port, "127.0.0.1", () => {
  console.log(`Remarques : http://127.0.0.1:${port}/api/ (données ${donnees}, origines ${origines.join(" ")}${env.REMARQUES_FERMEES === "1" ? ", envois fermés" : ""})`);
});

function arreter(): void {
  clearInterval(minuterie);
  service.serveur.close(() => {
    base.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", arreter);
process.on("SIGINT", arreter);
