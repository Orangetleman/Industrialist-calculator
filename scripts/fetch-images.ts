// Récupère les vignettes (96 px) des images d'objets et de machines du wiki Miraheze (accord de
// l'utilisateur le 2026-10-17, S5). Les originaux sont trop lourds (39 Mo + 126 Mo) : seule la
// vignette générée par le wiki est téléchargée.
//
//   node scripts/fetch-images.ts [--cache=.cache/wiki/miraheze] [--force]
//
// Écrit public/img/<objet|machine>/<id>.<ext> et data/images.json (fichier, page de l'image,
// licence, date). Politesse : User-Agent identifié, une requête à la fois, pause >= 1,5 s ;
// arrêt propre en cas de blocage (403, 429 répétés).
// Licence du wiki : CC BY-NC-SA 4.0 (usage non commercial, source citée sur le site).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WIKIS, cacheFileName, type CachedPage } from "./lib/wiki-config.ts";

const args = process.argv.slice(2);
const CACHE = args.find((a) => a.startsWith("--cache="))?.slice(8) ?? ".cache/wiki/miraheze";
const FORCE = args.includes("--force");
const WIDTH = 96;
const DELAY_MS = 1500;
const USER_AGENT = `IndustrialistProductionCalculator/0.1 (outil local personnel non commercial, lecture seule) node/${process.versions.node}`;
const LICENSE = "CC BY-NC-SA 4.0";

type Kind = "objet" | "machine";
type ImageEntry = { kind: Kind; id: string; file: string; image: string; url: string; license: string; fetchedAt: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const wait = last + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT } });
    if (res.status === 403) throw new Error(`HTTP 403 sur ${url} : arrêt.`);
    if (res.status === 429 || res.status === 503) {
      if (attempt >= 3) throw new Error(`HTTP ${res.status} répété : le wiki demande de ralentir, arrêt.`);
      await sleep((Number(res.headers.get("retry-after")) || 10) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    return res;
  }
}

const items = JSON.parse(readFileSync("data/items.json", "utf8")).items as { id: string; sources: { wiki: string; page?: string }[] }[];
const machines = (JSON.parse(readFileSync("data/machines.json", "utf8")).machines as { id: string; kind: string; sources: { wiki: string; page?: string }[] }[]).filter((m) => m.kind !== "building");

// Nom du fichier image donné par l'infobox de chaque page (Item : itemImage ; Machine2 : image).
const wanted: { kind: Kind; id: string; image: string }[] = [];
for (const [kind, list] of [["objet", items], ["machine", machines]] as const) {
  for (const e of list) {
    const page = e.sources.find((s) => s.wiki === "miraheze" && s.page)?.page;
    const f = page && join(CACHE, cacheFileName(page));
    if (!f || !existsSync(f)) continue;
    const content = (JSON.parse(readFileSync(f, "utf8")) as CachedPage).content;
    const m = /\|\s*(?:itemImage|image|Image)\s*=\s*([^\n|}]+)/.exec(content);
    if (m?.[1]?.trim()) wanted.push({ kind, id: e.id, image: m[1].trim() });
  }
}
console.log(`${wanted.length} images citées par les pages en cache (${CACHE}).`);

const manifestPath = "data/images.json";
const old: ImageEntry[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")).images : [];
const done = new Map(old.map((x) => [`${x.kind}|${x.id}`, x]));
const out: ImageEntry[] = [];
const missing: string[] = [];

// Adresses des vignettes, 50 titres par requête.
const thumbs = new Map<string, string>();
for (let i = 0; i < wanted.length; i += 50) {
  const titles = wanted.slice(i, i + 50).map((w) => `File:${w.image}`);
  const u = new URL(WIKIS.miraheze.api);
  for (const [k, v] of Object.entries({ action: "query", format: "json", formatversion: "2", prop: "imageinfo", iiprop: "url", iiurlwidth: String(WIDTH), titles: titles.join("|") })) u.searchParams.set(k, v);
  const body = (await (await get(u.toString())).json()) as any;
  const norm = new Map<string, string>((body.query.normalized ?? []).map((n: any) => [n.to, n.from]));
  for (const p of body.query.pages) {
    const thumb = p.imageinfo?.[0]?.thumburl;
    if (thumb) thumbs.set((norm.get(p.title) ?? p.title).replace(/^File:/, ""), thumb);
  }
}

for (const w of wanted) {
  const key = `${w.kind}|${w.id}`;
  const prev = done.get(key);
  if (prev && !FORCE && existsSync(join("public", prev.file))) {
    out.push(prev);
    continue;
  }
  const thumb = thumbs.get(w.image) ?? thumbs.get(w.image.replace(/_/g, " "));
  if (!thumb) {
    missing.push(`${key} (${w.image})`);
    continue;
  }
  const ext = (/\.(png|jpe?g|webp|gif)(?:\?|$)/i.exec(thumb)?.[1] ?? "png").toLowerCase().replace("jpeg", "jpg");
  const file = `img/${w.kind}/${w.id}.${ext}`;
  mkdirSync(join("public", "img", w.kind), { recursive: true });
  const buf = Buffer.from(await (await get(thumb)).arrayBuffer());
  writeFileSync(join("public", file), buf);
  out.push({ kind: w.kind, id: w.id, file, image: w.image, url: `https://industrialist.miraheze.org/wiki/File:${encodeURIComponent(w.image.replace(/ /g, "_"))}`, license: LICENSE, fetchedAt: new Date().toISOString() });
  if (out.length % 25 === 0) console.log(`  ${out.length}/${wanted.length}`);
}

out.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
writeFileSync(
  manifestPath,
  `${JSON.stringify({ meta: { source: "industrialist.miraheze.org", license: LICENSE, width: WIDTH, note: "Vignettes générées par le wiki ; accord de l'utilisateur le 2026-10-17 (S5)." }, images: out }, null, 1)}\n`,
);
console.log(`${out.length} vignettes, ${missing.length} absentes${missing.length ? ` : ${missing.join(", ")}` : ""}.`);
