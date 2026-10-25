/**
 * Hache un mot de passe lu sur l'entrée standard et écrit la ligne `scrypt$…` sur la sortie.
 * Utilisé par `industrialist-remarques-mot-de-passe` sur le Pi (le mot de passe ne passe jamais en argument).
 */
import { hacherMotDePasse } from "./securite.ts";

const morceaux: Buffer[] = [];
for await (const m of process.stdin) morceaux.push(m as Buffer);
const motDePasse = Buffer.concat(morceaux).toString("utf8").replace(/\r?\n$/, "");
if (motDePasse.length < 10) {
  console.error("Mot de passe trop court (10 caractères au moins).");
  process.exit(1);
}
process.stdout.write(hacherMotDePasse(motDePasse) + "\n");
