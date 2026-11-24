// Après `npm run build` (npm run deploy) : la copie du site servie à vie sous /v/<version>/ (PLAN-PARTAGE.md, P4).
// Mêmes sources, adresses en /v/<version>/ ; les vignettes (public/img) restent celles du site en ligne.
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const out = join("dist", "v", version);
await build({ base: `/v/${version}/`, logLevel: "warn", build: { outDir: out, emptyOutDir: true, copyPublicDir: false, rolldownOptions: { input: { main: "index.html" } } } });
for (const f of readdirSync("public", { withFileTypes: true })) if (f.isFile()) copyFileSync(join("public", f.name), join(out, f.name));
rmSync(join(out, "tableau"), { recursive: true, force: true }); // le tableau de bord reste celui du site en ligne
// Dit au site en ligne qu'une version est bien servie (une adresse inconnue renvoie la page d'accueil).
writeFileSync(join(out, "version.json"), JSON.stringify({ version }));
console.log(`Version ${version} : ${out}`);
