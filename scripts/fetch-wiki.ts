// Récupère les pages utiles des wikis Industrialist via l'API MediaWiki (api.php)
// et les range dans .cache/wiki/<wiki>/. Aucune donnée n'est transformée ici :
// c'est build-data.ts qui produit data/*.json à partir de ce cache.
//
//   node scripts/fetch-wiki.ts            (ne recharge que les pages modifiées)
//   node scripts/fetch-wiki.ts --force    (recharge tout)
//   node scripts/fetch-wiki.ts --only=miraheze
//
// Politesse : User-Agent identifié, une requête à la fois, pause >= 1,5 s,
// maxlag=5, respect de Retry-After. En cas de blocage (403, 429 répétés,
// page anti-bot) : arrêt propre, sans contournement.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractModuleTable } from "./lib/lua-literal.ts";
import { WIKIS, cacheFileName, type CachedPage, type WikiId } from "./lib/wiki-config.ts";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const ONLY = [...args].find((a) => a.startsWith("--only="))?.slice(7) as WikiId | undefined;
const CACHE_ROOT = ".cache/wiki";
const DELAY_MS = 1500;
const BATCH = 50;
const CONTACT = process.env.WIKI_CONTACT ? `; ${process.env.WIKI_CONTACT}` : "";
const USER_AGENT = `IndustrialistProductionCalculator/0.1 (outil local personnel non commercial, lecture seule${CONTACT}) node/${process.versions.node}`;

class BlockedError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;
let requestCount = 0;

async function api(wiki: WikiId, params: Record<string, string>): Promise<any> {
  const url = new URL(WIKIS[wiki].api);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", maxlag: "5", ...params })) url.searchParams.set(k, v);
  for (let attempt = 1; ; attempt++) {
    const wait = lastRequest + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    requestCount++;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT, Accept: "application/json" } });
    const retryAfter = Number(res.headers.get("retry-after")) || 5;
    const type = res.headers.get("content-type") ?? "";
    if (res.status === 403) throw new BlockedError(`${wiki} : HTTP 403 (accès refusé).`);
    if (res.status === 429 || res.status === 503) {
      if (attempt >= 3) throw new BlockedError(`${wiki} : HTTP ${res.status} répété, le wiki demande de ralentir.`);
      console.warn(`  ${wiki} : HTTP ${res.status}, nouvelle tentative dans ${retryAfter} s`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${wiki} : HTTP ${res.status} sur ${url}`);
    if (!type.includes("json")) {
      throw new BlockedError(`${wiki} : réponse non-JSON (${type || "type inconnu"}), probablement une page anti-bot.`);
    }
    const body: any = await res.json();
    if (body?.error?.code === "maxlag") {
      if (attempt >= 5) throw new BlockedError(`${wiki} : serveur surchargé (maxlag) de façon persistante.`);
      console.warn(`  ${wiki} : serveur chargé (maxlag), attente ${retryAfter} s`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (body?.error) throw new Error(`${wiki} : erreur API ${body.error.code} — ${body.error.info}`);
    return body;
  }
}

/** Requête paginée (gère `continue`). */
async function apiAll(wiki: WikiId, params: Record<string, string>, onPage: (body: any) => void): Promise<void> {
  let cont: Record<string, string> = {};
  for (;;) {
    const body = await api(wiki, { ...params, ...cont });
    onPage(body);
    if (!body.continue) return;
    cont = body.continue;
  }
}

function dir(wiki: WikiId): string {
  const d = join(CACHE_ROOT, wiki);
  mkdirSync(d, { recursive: true });
  return d;
}

type Index = Record<string, { file: string; title: string; revid: number | null; missing?: boolean }>;
function loadIndex(wiki: WikiId): Index {
  const f = join(dir(wiki), "_index.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}
function saveIndex(wiki: WikiId, index: Index): void {
  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(dir(wiki), "_index.json"), JSON.stringify(sorted, null, 1));
}

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Résout titres demandés → titre final (normalisation + redirections). */
function resolveMap(body: any): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of body.query?.normalized ?? []) m.set(n.from, n.to);
  for (const r of body.query?.redirects ?? []) m.set(r.from, r.to);
  return m;
}
function finalTitle(m: Map<string, string>, t: string): string {
  let cur = t;
  for (let i = 0; i < 5 && m.has(cur); i++) cur = m.get(cur)!;
  return cur;
}

/**
 * Récupère une liste de titres. Étape 1 : révision courante (léger).
 * Étape 2 : contenu seulement pour les pages nouvelles ou modifiées.
 */
async function fetchPages(wiki: WikiId, titles: string[]): Promise<{ fetched: number; unchanged: number; missing: string[] }> {
  const index = loadIndex(wiki);
  const unique = [...new Set(titles)].sort();
  const toFetch: string[] = [];
  const missing: string[] = [];
  let unchanged = 0;

  for (const batch of chunks(unique, BATCH)) {
    const body = await api(wiki, { action: "query", prop: "info", redirects: "1", titles: batch.join("|") });
    const map = resolveMap(body);
    const byTitle = new Map<string, any>((body.query?.pages ?? []).map((p: any) => [p.title, p]));
    for (const t of batch) {
      const page = byTitle.get(finalTitle(map, t));
      if (!page || page.missing || page.invalid) {
        missing.push(t);
        index[t] = { file: "", title: t, revid: null, missing: true };
        continue;
      }
      const known = index[t];
      if (!FORCE && known && known.revid === page.lastrevid && existsSync(join(dir(wiki), known.file))) unchanged++;
      else toFetch.push(t);
    }
  }

  let fetched = 0;
  // Le contenu de 50 pages peut dépasser la limite de réponse : lots plus petits.
  for (const batch of chunks(toFetch, 20)) {
    await apiAll(
      wiki,
      { action: "query", prop: "revisions", rvprop: "ids|timestamp|content", rvslots: "main", redirects: "1", titles: batch.join("|") },
      (body) => {
        const map = resolveMap(body);
        const byTitle = new Map<string, any>((body.query?.pages ?? []).map((p: any) => [p.title, p]));
        for (const t of batch) {
          const page = byTitle.get(finalTitle(map, t));
          const rev = page?.revisions?.[0];
          if (!rev) continue; // contenu arrivera dans la suite (continue)
          const cached: CachedPage = {
            wiki,
            requestedTitle: t,
            title: page.title,
            pageid: page.pageid,
            revid: rev.revid,
            timestamp: rev.timestamp,
            fetchedAt: new Date().toISOString(),
            url: WIKIS[wiki].pageUrl(page.title),
            content: rev.slots.main.content,
          };
          const file = cacheFileName(page.title);
          writeFileSync(join(dir(wiki), file), JSON.stringify(cached, null, 1));
          index[t] = { file, title: page.title, revid: rev.revid };
          fetched++;
        }
      },
    );
  }
  saveIndex(wiki, index);
  return { fetched, unchanged, missing };
}

function readCached(wiki: WikiId, title: string): CachedPage | null {
  const entry = loadIndex(wiki)[title];
  if (!entry || entry.missing) return null;
  return JSON.parse(readFileSync(join(dir(wiki), entry.file), "utf8"));
}

async function listModules(wiki: WikiId, prefix: string): Promise<string[]> {
  const out: string[] = [];
  await apiAll(wiki, { action: "query", list: "allpages", apnamespace: "828", apprefix: prefix, aplimit: "500" }, (b) => {
    for (const p of b.query.allpages) out.push(p.title);
  });
  return out;
}

/** Noms d'items cités dans les modules de recettes en cache. */
function itemsFromRecipeModules(titles: string[]): string[] {
  const items = new Set<string>();
  for (const t of titles) {
    const page = readCached("miraheze", t);
    if (!page) continue;
    try {
      const recipes = extractModuleTable(page.content);
      if (!Array.isArray(recipes)) continue;
      for (const r of recipes as any[]) for (const io of [...(r.inputs ?? []), ...(r.outputs ?? [])]) if (io?.item) items.add(String(io.item));
    } catch {
      // Le module sera signalé par build-data ; on ne bloque pas la récupération.
    }
  }
  return [...items];
}

function report(label: string, r: { fetched: number; unchanged: number; missing: string[] }): void {
  console.log(`  ${label} : ${r.fetched} téléchargée(s), ${r.unchanged} inchangée(s), ${r.missing.length} absente(s)`);
  if (r.missing.length) console.log(`    absentes : ${r.missing.slice(0, 30).join(", ")}${r.missing.length > 30 ? " …" : ""}`);
}

/**
 * Calculateur Desmos des arbres, lié depuis la page Tree de Miraheze.
 * Une seule requête (état JSON public), mise en cache ; rechargée avec --force.
 */
async function fetchTreeCalculator(): Promise<void> {
  const tree = readCached("miraheze", "Tree");
  const url = tree && /\[(https:\/\/www\.desmos\.com\/calculator\/[A-Za-z0-9]+)/.exec(tree.content)?.[1];
  if (!url) {
    console.log("  calculateur des arbres : lien Desmos absent de la page Tree");
    return;
  }
  const file = join(CACHE_ROOT, "desmos-tree.json");
  if (!FORCE && existsSync(file) && JSON.parse(readFileSync(file, "utf8")).url === url) {
    console.log("  calculateur des arbres : en cache");
    return;
  }
  const wait = lastRequest + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  requestCount++;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
    console.warn(`  calculateur des arbres : HTTP ${res.status}, ignoré (le tableau du wiki sera utilisé)`);
    return;
  }
  const body: any = await res.json();
  const state = body?.state ?? body; // la réponse Desmos enveloppe l'état dans { state }
  writeFileSync(file, JSON.stringify({ url, fetchedAt: new Date().toISOString(), state }, null, 1));
  console.log("  calculateur des arbres : téléchargé");
}

async function main(): Promise<void> {
  console.log(`User-Agent : ${USER_AGENT}`);
  const runMiraheze = !ONLY || ONLY === "miraheze";
  const runFandom = !ONLY || ONLY === "fandom";
  const machineNames: string[] = [];
  let itemNames: string[] = [];

  if (runMiraheze) {
    console.log("Miraheze");
    const modules = (await listModules("miraheze", "Recipes/")).filter((t) => t !== "Module:Recipes/Recipes Bucket");
    report("modules de recettes", await fetchPages("miraheze", modules));
    report("arbre de recherche", await fetchPages("miraheze", ["Module:RS/Data", "Research System"]));
    machineNames.push(...modules.map((t) => t.replace("Module:Recipes/", "")));
    report("pages machines", await fetchPages("miraheze", [...machineNames, "Tree"]));
    itemNames = itemsFromRecipeModules(modules);
    report("pages items", await fetchPages("miraheze", itemNames));
  }
  if (runMiraheze) await fetchTreeCalculator();
  if (runFandom) {
    console.log("Fandom (contrôle croisé)");
    if (!itemNames.length) {
      const idx = loadIndex("miraheze");
      itemNames = itemsFromRecipeModules(Object.keys(idx).filter((t) => t.startsWith("Module:Recipes/")));
    }
    report("pages items", await fetchPages("fandom", itemNames));
  }
  console.log(`Terminé : ${requestCount} requête(s).`);
}

main().catch((e) => {
  if (e instanceof BlockedError) {
    console.error(`\n⛔ Arrêt : ${e.message}`);
    console.error("Aucun contournement n'est tenté. Replis possibles :");
    console.error("  1. Exporter les pages à la main via Special:Export et les déposer dans .cache/import/ ;");
    console.error("  2. Saisir les valeurs manquantes dans data/overrides.json (ou depuis l'appli, puis « Exporter »).");
    process.exit(2);
  }
  console.error(e);
  process.exit(1);
});
