import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Empreinte du calcul de « Toute l'usine » (S27 bis) : le code du moteur et les données. Un résultat gardé dans le
 * navigateur n'est réutilisé que si cette empreinte n'a pas changé (une mise à jour du site qui touche le calcul ou
 * les données le fait refaire).
 */
function factoryVersion(): string {
  const files = (dir: string, ext: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name), ext) : e.name.endsWith(ext) && !e.name.endsWith(".test.ts") ? [join(dir, e.name)] : []));
  const h = createHash("sha256");
  // Les traductions des notes (data/i18n, S32) ne changent pas le calcul : un résultat gardé reste valable.
  for (const f of [...files("src/engine", ".ts"), ...files("data", ".json").filter((p) => !/[\\/]i18n[\\/]/.test(p))].sort()) h.update(f).update(readFileSync(f));
  return h.digest("hex").slice(0, 16);
}

/** Version du site envoyée avec une remarque (S35) : jour de la construction et dernier commit. */
function siteVersion(): string {
  let commit = "local";
  try {
    commit = execSync("git rev-parse --short HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // pas de git (copie du dossier) : la date suffit
  }
  return `${new Date().toISOString().slice(0, 10)} ${commit}`;
}

export default defineConfig({
  define: {
    __FACTORY_VERSION__: JSON.stringify(factoryVersion()),
    __SITE_VERSION__: JSON.stringify(siteVersion()),
  },
  server: {
    // Le service des remarques (npm run remarques, S34) : même chemin qu'en ligne, où nginx le passe au service.
    proxy: { "/api/": "http://127.0.0.1:8091" },
  },
  build: {
    // Les données du wiki (data/*.json) sont intégrées à la page : ~550 kB, 78 kB compressés.
    // Pour un outil local, c'est attendu : on relève le seuil d'avertissement.
    chunkSizeWarningLimit: 1000,
    // S36 : le tableau de bord de l'auteur est une page à part (/tableau/), servie par nginx comme un fichier du site.
    rolldownOptions: { input: { main: "index.html", tableau: "tableau/index.html" } },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "scripts/**/*.test.ts", "server/**/*.test.ts"],
    // Tests de justesse, pas de vitesse : sur une machine chargée (un jeu ouvert), un calcul
    // complet peut prendre plusieurs secondes.
    testTimeout: 30_000,
  },
});
