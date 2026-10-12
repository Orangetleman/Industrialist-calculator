// Construit les données de l'extension à partir du cache du wiki (aucun accès réseau) :
// data/logistics.json, power.json, research-stations.json, world.json, et data/ports.json
// (vide au départ, rempli par les relevés en jeu). Ajoute une section à data/a-verifier.md.
//
//   node scripts/build-extension.ts      (lancé aussi par « npm run build-data »)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DataMeta, MachinesFile, Source, VerifyFlag } from "../src/engine/types.ts";
import type {
  DepotEntry,
  Fact,
  LogisticsFile,
  PipePiece,
  PortsFile,
  PowerEntry,
  PowerFile,
  ResearchStationsFile,
  StorageEntry,
  WorldFile,
} from "../src/engine/extension-types.ts";
import { extractRpFormulas, extractWorld, parsePerNode, parsePipeTables, parsePowerRange, parseRangeTiles, type Found } from "./lib/extension-extract.ts";
import type { CachedPage } from "./lib/wiki-config.ts";
import { parseTemplate, slugify } from "./lib/wiki-extract.ts";

const CACHE = ".cache/wiki/miraheze";
const OUT = "data";
const index: Record<string, { file: string; title: string; missing?: boolean }> = JSON.parse(readFileSync(join(CACHE, "_index.json"), "utf8"));
let latest = "";
const pageOf = (title: string): CachedPage | null => {
  const e = index[title] ?? Object.values(index).find((v) => v.title === title);
  if (!e || e.missing) return null;
  const p: CachedPage = JSON.parse(readFileSync(join(CACHE, e.file), "utf8"));
  if (p.fetchedAt > latest) latest = p.fetchedAt;
  return p;
};
const sourceOf = (p: CachedPage): Source => ({ wiki: "miraheze", url: p.url, page: p.title, revisionId: p.revid, fetchedAt: p.fetchedAt });
const issues: string[] = [];
const flagLines: string[] = [];

const machines = (JSON.parse(readFileSync(join(OUT, "machines.json"), "utf8")) as MachinesFile).machines;

/** Infobox Machine2 d'un bâtiment (si sa page lui est propre). */
function infobox(m: (typeof machines)[number]): { ib: Record<string, string>; page: CachedPage } | null {
  const src = m.sources[0];
  if (!src?.page || src.note) return null;
  const page = pageOf(src.page);
  const ib = page ? parseTemplate(page.content, "Machine2") : null;
  return page && ib ? { ib, page } : null;
}

// ---------------------------------------------------------------- énergie
const powerEntries: PowerEntry[] = [];
for (const m of machines) {
  const found = infobox(m);
  if (!found) continue;
  const { ib, page } = found;
  const cat = ib.Category?.trim() || null;
  const sub = ib.Subcategory?.trim() || null;
  const outRaw = ib.PowerOutput?.trim() || "";
  if (!(cat === "Power" || cat === "Modular" || outRaw)) continue;
  const verify: VerifyFlag[] = [];
  const read = <T>(field: string, raw: string | undefined, parse: (s: string) => T | null): T | null => {
    const t = (raw ?? "").trim();
    if (!t || t === "-") return null;
    const v = parse(t);
    if (v === null) verify.push({ field, reason: /depend|varies/i.test(t) ? "variable" : "non-sourcé", detail: `valeur du wiki non lisible telle quelle : « ${t.replace(/<br\s*\/?>/g, " ")} »` });
    return v;
  };
  const output = read("output", outRaw, parsePowerRange);
  const input = read("input", ib.PowerInput, parsePowerRange);
  const transfer = read("transfer", ib.TransferRate, parsePerNode);
  const capacity = read("capacity", ib.Capacity, parsePerNode);
  const range = parseRangeTiles(page.content);
  if (sub === "Transfer Poles" && !range) verify.push({ field: "rangeTiles", reason: "manquant", detail: "portée du poteau absente de sa page : à relever en jeu" });
  if (Array.isArray(output)) verify.push({ field: "output", reason: "approximatif", detail: `puissance variable (météo, heure, vapeur ou combustible) : ${outRaw}` });
  powerEntries.push({
    id: m.id,
    name: m.name,
    category: cat,
    subcategory: sub,
    output,
    input,
    transfer,
    capacity,
    rangeTiles: range ? { tiles: range.tiles, approx: range.approx } : null,
    size: m.size,
    cost: m.cost,
    pollutionPerHour: m.pollutionPerHour,
    sources: [sourceOf(page)],
    verify,
  });
}
for (const e of powerEntries) for (const f of e.verify) flagLines.push(`| ${e.name} | énergie · ${f.field} | ${f.reason} | ${f.detail.replace(/\|/g, "\\|")} |`);

// ---------------------------------------------------------------- logistique
const pipesPage = pageOf("Pipes");
const pipes: PipePiece[] = [];
if (!pipesPage) issues.push("Page Pipes absente du cache : relancer fetch-wiki.");
else {
  for (const r of parsePipeTables(pipesPage.content)) {
    const verify: VerifyFlag[] = [];
    if (r.complex) verify.push({ field: "flowPerSec", reason: "approximatif", detail: `plusieurs valeurs : capacité « ${r.capacityRaw} », débit « ${r.flowRaw} »` });
    if (!r.sizeStuds) verify.push({ field: "sizeStuds", reason: "manquant", detail: "dimensions absentes du tableau" });
    pipes.push({ id: slugify(r.name), ...r, sources: [sourceOf(pipesPage)], verify });
  }
  if (pipes.length < 30) issues.push(`Page Pipes : seulement ${pipes.length} pièces lues (≥ 30 attendues). La mise en page a peut-être changé.`);
}
const storage: StorageEntry[] = [];
const depots: DepotEntry[] = [];
const world = extractWorld(Object.fromEntries(["Weather & Time", "Steam", "Logic", "Truck Depot", "Pollution"].map((t) => [t, pageOf(t)?.content ?? ""])));
for (const m of machines) {
  const found = infobox(m);
  if (!found) continue;
  const { ib, page } = found;
  const sub = ib.Subcategory?.trim() ?? "";
  const kind = /fluid|liquid/i.test(`${m.name} ${sub}`) ? ("fluide" as const) : ("objet" as const);
  if (ib.Category?.trim() === "Storage Silos") {
    storage.push({ id: m.id, name: m.name, kind, size: m.size, cost: m.cost, capacity: null, sources: [sourceOf(page)], verify: [{ field: "capacity", reason: "manquant", detail: "capacité de stockage non structurée sur le wiki : à relever en jeu" }] });
  } else if (sub === "Depots") {
    const truck = m.id === "truck-depot" && world.truckDepot.value ? world.truckDepot.value.capacity / world.truckDepot.value.cycleSeconds : null;
    depots.push({
      id: m.id,
      name: m.name,
      kind,
      size: m.size,
      cost: m.cost,
      itemsPerSec: truck,
      sources: [sourceOf(page)],
      verify: truck === null ? [{ field: "itemsPerSec", reason: "manquant", detail: "rythme de vente non structuré sur le wiki : à relever en jeu" }] : [{ field: "itemsPerSec", reason: "approximatif", detail: "« environ » 0,66 objet/s d'après la page Truck Depot" }],
    });
  }
}
for (const x of [...storage, ...depots]) for (const f of x.verify) flagLines.push(`| ${x.name} | logistique · ${f.field} | ${f.reason} | ${f.detail} |`);

// ---------------------------------------------------------------- RP
const rpPageNames = ["Research Station1", "Research Station2", "Research Station3", "Satellite Dish Controller", "Research System"];
const rpPages = Object.fromEntries(rpPageNames.map((t) => [t, pageOf(t)])) as Record<string, CachedPage | null>;
const formulas = extractRpFormulas(Object.fromEntries(rpPageNames.map((t) => [t, rpPages[t]?.content ?? ""])));
const toFact = <T>(f: Found<T>): Fact<T> => {
  const p = rpPages[f.page] ?? pageOf(f.page);
  const source: Source = p ? sourceOf(p) : { wiki: "miraheze", page: f.page, fetchedAt: latest };
  if (f.value === null) {
    issues.push(`RP — ${f.page} : ${"problem" in f ? f.problem : "?"}`);
    return { value: null, source, problem: "problem" in f ? f.problem : undefined };
  }
  return { value: f.value, source, quote: "quote" in f ? f.quote : undefined };
};
const mapFacts = <T extends Record<string, Found<unknown>>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toFact(v)]));
const rs3Text = rpPages["Research Station3"]?.content ?? "";
if (/two different Items/i.test(rs3Text) && formulas.rs3.samePenalty.value !== null) {
  flagLines.push(
    "| Research Station3 | RP · items en entrée | contradiction | La page dit « Requires two different Items to operate » et décrit aussi une pénalité de 30 % « if both input Items are the same ». À vérifier en jeu : la station accepte-t-elle deux fois le même item ? |",
  );
}
flagLines.push("| Research Station4 | RP · formule | manquant | Formule de vitesse et de plafond de la RS4 non transcrite (forme trop complexe pour une extraction sûre) : à transcrire à la main depuis la page avant la phase E3. |");

// ---------------------------------------------------------------- monde et grille
const worldFacts: Record<string, Fact<unknown>> = {};
for (const [k, f] of Object.entries(world)) {
  const p = pageOf(f.page);
  const source: Source = p ? sourceOf(p) : { wiki: "miraheze", page: f.page, fetchedAt: latest };
  if (f.value === null) issues.push(`Monde — ${f.page} : ${"problem" in f ? f.problem : "?"}`);
  worldFacts[k] = f.value === null ? { value: null, source, problem: "problem" in f ? f.problem : undefined } : { value: f.value, source, quote: "quote" in f ? f.quote : undefined };
}
const gridVerify: VerifyFlag[] = [
  { field: "cellStuds", reason: "manquant", detail: "taille d'une case de la grille, en studs : à relever en jeu (RELEVES.md § 0)" },
  { field: "rotations", reason: "manquant", detail: "nombre de rotations possibles d'une machine : à relever en jeu" },
];
flagLines.push("| Grille de construction | monde · unité | manquant | Les tuyaux sont en studs, la portée des poteaux en tuiles, les machines sans unité : à relever en jeu (RELEVES.md § 0). |");
flagLines.push("| Turbines (Large, Steam) | énergie · puissance selon la température | manquant | Le wiki donne des plages et quelques points (vapeur ~190–215 ° avec une Firebox, 220 ° max en géothermie) mais pas la relation exacte : relevés en jeu bienvenus. |");

// ---------------------------------------------------------------- écriture
const meta = (counts: Record<string, number>): DataMeta => ({ generatedAt: latest, primary: "miraheze", counts });
const write = (file: string, data: unknown) => writeFileSync(join(OUT, file), JSON.stringify(data, null, 1) + "\n");
write("logistics.json", { meta: meta({ pipes: pipes.length, storage: storage.length, depots: depots.length }), pipes, storage, depots } satisfies LogisticsFile);
write("power.json", { meta: meta({ entries: powerEntries.length }), entries: powerEntries } satisfies PowerFile);
write("research-stations.json", {
  meta: meta({}),
  rs1: mapFacts(formulas.rs1) as ResearchStationsFile["rs1"],
  rs2: mapFacts(formulas.rs2) as ResearchStationsFile["rs2"],
  rs3: mapFacts(formulas.rs3) as ResearchStationsFile["rs3"],
  satellite: mapFacts(formulas.satellite) as ResearchStationsFile["satellite"],
  softCap: mapFacts(formulas.softCap) as ResearchStationsFile["softCap"],
  startRp: toFact(formulas.startRp),
  buildings: machines.filter((m) => /^research-station\d$|^satellite-dish|^research-tracking-panel$/.test(m.id)).map((m) => m.id),
} satisfies ResearchStationsFile);
write("world.json", { meta: meta({ facts: Object.keys(worldFacts).length }), facts: worldFacts, grid: { cellStuds: null, snap: null, rotations: null, sources: [], verify: gridVerify } } satisfies WorldFile);
if (!existsSync(join(OUT, "ports.json"))) {
  write("ports.json", {
    _lisezMoi: "Ports des bâtiments relevés en jeu (voir RELEVES.md). Clé = id du bâtiment (machines.json). Rempli au fil des relevés ; source « jeu » datée.",
    machines: {},
  } satisfies PortsFile);
}
const ports: PortsFile = JSON.parse(readFileSync(join(OUT, "ports.json"), "utf8"));

// Section de a-verifier.md (remplacée à chaque génération, avant les notes manuelles).
const mdPath = join(OUT, "a-verifier.md");
const START = "<!-- extension:debut -->";
const END = "<!-- extension:fin -->";
const section = [
  START,
  "## Extension : énergie, logistique, RP, monde",
  "",
  `Lu dans le cache du ${latest.slice(0, 10)} : ${powerEntries.length} bâtiments d'énergie, ${pipes.length} pièces de tuyauterie, ${storage.length} silos, ${depots.length} dépôts, formules RP et faits du monde. Ports relevés en jeu : **${Object.keys(ports.machines).length}** bâtiment(s) (voir RELEVES.md).`,
  "",
  ...(issues.length ? ["**Problèmes d'extraction :**", "", ...issues.map((i) => `- ${i}`), ""] : ["Toutes les formules et tous les faits attendus ont été reconnus.", ""]),
  "| Élément | Champ | Raison | Détail |",
  "|---|---|---|---|",
  ...flagLines,
  END,
  "",
].join("\n");
let md = readFileSync(mdPath, "utf8");
if (md.includes(START) && md.includes(END)) md = md.slice(0, md.indexOf(START)) + section + md.slice(md.indexOf(END) + END.length + 1);
else md = md.replace("## Notes manuelles", `${section}\n## Notes manuelles`);
writeFileSync(mdPath, md);

console.log(`power.json            ${powerEntries.length} bâtiments (${powerEntries.filter((e) => e.verify.length).length} à vérifier)`);
console.log(`logistics.json        ${pipes.length} pièces, ${storage.length} silos, ${depots.length} dépôts`);
console.log(`research-stations.json formules RP ${issues.some((i) => i.startsWith("RP")) ? "INCOMPLÈTES" : "complètes"}`);
console.log(`world.json            ${Object.keys(worldFacts).length} faits ; grille à relever en jeu`);
console.log(`ports.json            ${Object.keys(ports.machines).length} bâtiment(s) relevé(s)`);
if (issues.length) console.log(`⚠ ${issues.length} problème(s) : voir a-verifier.md`);
