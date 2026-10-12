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
  EnergyFile,
  EnergySetup,
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
import { extractEnergyFacts } from "./lib/energy-extract.ts";
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
// ---------------------------------------------------------------- relevés en jeu (prioritaires)
type Releves = {
  source: Source;
  grid: { cellStuds: number | null; snap: string | null; rotations: number | null; rotationsNote?: string; note?: string };
  poleRangeTiles: Record<string, number>;
  storageCapacity: Record<string, number>;
  depotCycleSeconds: Record<string, number>;
  research: { rs3SameItemAllowed?: boolean; startUnlocked?: string[]; note?: string };
};
const relevesPath = join(OUT, "releves.json");
const releves: Releves | null = existsSync(relevesPath) ? JSON.parse(readFileSync(relevesPath, "utf8")) : null;
const appliedLines: string[] = []; // « Relevés en jeu appliqués » dans a-verifier.md
const fmtV = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

// Courbe des turbines (graphique Desmos lié depuis la page Large Turbine) : table °C → MF/s.
const turbineFile = ".cache/wiki/desmos-large-turbine.json";
if (existsSync(turbineFile)) {
  const d = JSON.parse(readFileSync(turbineFile, "utf8")) as { url: string; fetchedAt: string; state: { expressions?: { list?: any[] } } };
  const table = (d.state.expressions?.list ?? []).find((e) => e.type === "table" && e.columns?.length === 2);
  const xs = (table?.columns?.[0]?.values ?? []).map(Number);
  const ys = (table?.columns?.[1]?.values ?? []).map(Number);
  const ok = xs.length >= 20 && xs.length === ys.length && xs.every((x: number, i: number) => Number.isFinite(x) && Number.isFinite(ys[i]) && (i === 0 || (x > xs[i - 1] && ys[i] >= ys[i - 1])));
  const lt = powerEntries.find((e) => e.id === "large-turbine");
  if (ok && lt) {
    lt.tempCurve = {
      points: xs.map((x: number, i: number) => [x, ys[i]] as [number, number]),
      source: { wiki: "desmos", url: d.url, page: "Large Turbine power graph (lié depuis la page Large Turbine)", fetchedAt: d.fetchedAt },
      note: "Puissance à plein régime selon la température de la vapeur ; cohérente avec le code Lua cité sur la page (paliers de puissance × 66).",
    };
    lt.verify = lt.verify.map((f) => (f.field === "output" ? { ...f, detail: `${f.detail} — courbe température → puissance disponible (${xs.length} points, ${xs[0]} à ${xs.at(-1)} °C)` } : f));
  } else issues.push("Courbe des turbines (Desmos) illisible ou absente : la puissance des turbines reste une plage.");
}

if (releves) {
  for (const [id, tiles] of Object.entries(releves.poleRangeTiles)) {
    const e = powerEntries.find((x) => x.id === id);
    if (!e) {
      issues.push(`Relevé de portée pour « ${id} » : bâtiment inconnu.`);
      continue;
    }
    appliedLines.push(`| ${e.name} | portée (tuiles) | ${fmtV(e.rangeTiles?.tiles)} | **${tiles}** |`);
    e.rangeTiles = { tiles, approx: false };
    e.verify = e.verify.filter((f) => f.field !== "rangeTiles");
    e.sources = [...e.sources, releves.source];
  }
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
    const measured = releves?.storageCapacity[m.id];
    if (measured !== undefined) appliedLines.push(`| ${m.name} | capacité | — | **${measured} ${kind === "fluide" ? "L" : "unités"}** |`);
    storage.push({
      id: m.id,
      name: m.name,
      kind,
      size: m.size,
      cost: m.cost,
      capacity: measured ?? null,
      sources: measured !== undefined && releves ? [sourceOf(page), releves.source] : [sourceOf(page)],
      verify: measured !== undefined ? [] : [{ field: "capacity", reason: "manquant", detail: "capacité de stockage non structurée sur le wiki : à relever en jeu" }],
    });
  } else if (sub === "Depots") {
    // Capacité par voyage : phrase du wiki ; durée du cycle : relevé en jeu, sinon la page.
    const hugePage = pageOf("Huge Truck Depot")?.content ?? "";
    const capacities: Record<string, number | undefined> = {
      "truck-depot": world.truckDepot.value?.capacity,
      "huge-truck-depot": Number(/it can hold (\d+) items/.exec(hugePage)?.[1]) || undefined,
      "van-depot": Number(/Van Depot\]?\]?'s (\d+) unit limit/.exec(hugePage)?.[1]) || undefined,
    };
    const cap = capacities[m.id];
    const measuredCycle = releves?.depotCycleSeconds[m.id];
    const wikiCycle = m.id === "truck-depot" ? world.truckDepot.value?.cycleSeconds : /1 minute and 20 seconds/.test(page.content) ? 80 : undefined;
    const cycle = measuredCycle ?? wikiCycle;
    const verify: VerifyFlag[] = [];
    if (measuredCycle !== undefined) {
      appliedLines.push(`| ${m.name} | durée d'un cycle de vente (s) | ${fmtV(wikiCycle)} | **${measuredCycle}**${measuredCycle === wikiCycle ? " (confirmé)" : ""} |`);
    }
    const unit = kind === "fluide" ? "litres" : "objets";
    if (cap === undefined && cycle !== undefined)
      verify.push({ field: "itemsPerSec", reason: "manquant", detail: `${unit} par voyage inconnus (cycle ${measuredCycle !== undefined ? "relevé en jeu" : "d'après le wiki"} : ${cycle} s) : à relever en jeu` });
    else if (cap === undefined || cycle === undefined) verify.push({ field: "itemsPerSec", reason: "manquant", detail: `capacité par voyage (${fmtV(cap)}) ou durée du cycle (${fmtV(cycle)}) inconnue : à relever en jeu` });
    else if (measuredCycle === undefined) verify.push({ field: "itemsPerSec", reason: "approximatif", detail: `${cap} objets toutes les ~${cycle} s d'après le wiki` });
    depots.push({
      id: m.id,
      name: m.name,
      kind,
      size: m.size,
      cost: m.cost,
      itemsPerSec: cap !== undefined && cycle !== undefined ? cap / cycle : null,
      sources: measuredCycle !== undefined && releves ? [sourceOf(page), releves.source] : [sourceOf(page)],
      verify,
    });
  }
}
for (const x of [...storage, ...depots]) for (const f of x.verify) flagLines.push(`| ${x.name} | logistique · ${f.field} | ${f.reason} | ${f.detail} |`);

// ---------------------------------------------------------------- RP
const rpPageNames = ["Research Station1", "Research Station2", "Research Station3", "Research Station4", "Satellite Dish Controller", "Research System"];
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
if (releves?.research.startUnlocked?.length) {
  appliedLines.push(`| Recherche | acquises d'office dans un nouveau monde | — | **${releves.research.startUnlocked.join(", ")}** |`);
}
if (releves?.research.rs3SameItemAllowed) {
  appliedLines.push("| Research Station3 | deux fois le même item | contradiction sur le wiki | **accepté, avec la pénalité de 30 %** |");
} else if (/two different Items/i.test(rs3Text) && formulas.rs3.samePenalty.value !== null) {
  flagLines.push(
    "| Research Station3 | RP · items en entrée | contradiction | La page dit « Requires two different Items to operate » et décrit aussi une pénalité de 30 % « if both input Items are the same ». À vérifier en jeu : la station accepte-t-elle deux fois le même item ? |",
  );
}

// ---------------------------------------------------------------- monde et grille
const worldFacts: Record<string, Fact<unknown>> = {};
for (const [k, f] of Object.entries(world)) {
  const p = pageOf(f.page);
  const source: Source = p ? sourceOf(p) : { wiki: "miraheze", page: f.page, fetchedAt: latest };
  if (f.value === null) issues.push(`Monde — ${f.page} : ${"problem" in f ? f.problem : "?"}`);
  worldFacts[k] = f.value === null ? { value: null, source, problem: "problem" in f ? f.problem : undefined } : { value: f.value, source, quote: "quote" in f ? f.quote : undefined };
}
const grid = releves?.grid ?? { cellStuds: null, snap: null, rotations: null };
const gridVerify: VerifyFlag[] = [];
if (grid.cellStuds === null) gridVerify.push({ field: "cellStuds", reason: "manquant", detail: "taille d'une case de la grille, en studs : à relever en jeu (RELEVES.md § 0)" });
else appliedLines.push(`| Grille de construction | 1 case | — | **${grid.cellStuds} studs = 1 Short Pipe ; ${grid.snap ?? ""}** |`);
if (grid.rotations !== null) appliedLines.push(`| Grille de construction | rotations | — | **${grid.rotations}${grid.rotationsNote ? ` : ${grid.rotationsNote}` : ""}** |`);
else gridVerify.push({ field: "rotations", reason: "manquant", detail: "nombre de rotations possibles d'une machine (4 quarts de tour ?) : à confirmer en jeu" });
for (const f of gridVerify) flagLines.push(`| Grille de construction | monde · ${f.field} | ${f.reason} | ${f.detail} |`);
if (!powerEntries.find((e) => e.id === "large-turbine")?.tempCurve) {
  flagLines.push("| Large Turbine | énergie · puissance selon la température | manquant | Courbe température → puissance introuvable (graphique Desmos de la page Large Turbine). |");
}
flagLines.push("| Steam Turbine | énergie · puissance selon la température | approximatif | Seulement une plage (432 MF/s à 9,36 kMF/s) : pas de courbe sur le wiki. |");

// ---------------------------------------------------------------- énergie : installations complètes (E2)
const energyPageNames = ["Firebox", "Boiler", "Large Turbine", "Gas Burner", "Industrial Firebox", "Geothermal Well", "Scrubber", "Solar Panel", "Wind Turbine3"];
const energyPages = Object.fromEntries(energyPageNames.map((t) => [t, pageOf(t)])) as Record<string, CachedPage | null>;
const ef = extractEnergyFacts(Object.fromEntries(energyPageNames.map((t) => [t, energyPages[t]?.content ?? ""])));
const energyFacts: Record<string, Fact<unknown>> = {};
const factOf = <T>(key: string, f: Found<T>): T | null => {
  const pg = energyPages[f.page];
  const source: Source = pg ? sourceOf(pg) : { wiki: "miraheze", page: f.page, fetchedAt: latest };
  if (f.value === null) {
    issues.push(`Énergie — ${f.page} : ${"problem" in f ? f.problem : "?"}`);
    energyFacts[key] = { value: null, source, problem: "problem" in f ? f.problem : undefined };
    return null;
  }
  energyFacts[key] = { value: f.value, source, quote: "quote" in f ? f.quote : undefined };
  return f.value;
};
const srcOfPage = (t: string): Source[] => (energyPages[t] ? [sourceOf(energyPages[t]!)] : []);
const recipesFile = JSON.parse(readFileSync(join(OUT, "recipes.json"), "utf8")) as { recipes: { id: string; machine: string; durationS: number | null; inputs: Record<string, number | null> }[] };
const recipeById = new Map(recipesFile.recipes.map((r) => [r.id, r]));
const machineById = new Map(machines.map((m) => [m.id, m]));
const pollutionOfMachine = (id: string) => {
  const p = machineById.get(id)?.pollutionPerHour;
  return p == null ? null : typeof p === "number" ? p : p[1];
};
const partsPollution = (parts: { machine: string; count: number }[]) => parts.reduce((s, p) => s + (pollutionOfMachine(p.machine) ?? 0) * p.count, 0);

const boilerCoolant = factOf("boiler.coolantPerSec", ef.boiler.coolantPerSec);
const boilerSteam = factOf("boiler.steamPerSec", ef.boiler.steamPerSec);
const turbineSteam = factOf("largeTurbine.steamPerSec", ef.largeTurbine.steamPerSec);
const curve = powerEntries.find((e) => e.id === "large-turbine")?.tempCurve ?? null;
/** Puissance d'une Large Turbine à plein régime selon la température de la vapeur (interpolation de la courbe). */
const turbineAt = (t: number): number | null => {
  const pts = curve?.points;
  if (!pts?.length || t < pts[0]![0] || t > pts.at(-1)![0]) return null;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    if (t <= x1) return y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  }
  return pts.at(-1)![1];
};
/** Nombre au format français, pour les notes affichées (virgule décimale, espace des milliers). */
const frNum = (x: number, d: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(x);
const turbinesPerBoiler = boilerSteam && turbineSteam ? boilerSteam / turbineSteam : null;
const setups: EnergySetup[] = [];
const notComputed: EnergyFile["notComputed"] = [];
const steamRelevé = (releves as unknown as { steamTempC?: Record<string, number> } | null)?.steamTempC ?? {};

/** Chauffe-eau + Boilers + Large Turbines, à partir de la température de la vapeur (ou d'une puissance donnée par le wiki). */
function thermal(heater: string, recipeId: string, boilers: number | null, steam: { tempC: number; note: string; flag: VerifyFlag | null; sources: Source[] } | { mfps: number; note: string; flag: VerifyFlag; sources: Source[] }) {
  const r = recipeById.get(recipeId);
  const m = machineById.get(heater);
  if (!r || !m || !boilers || !turbinesPerBoiler || !r.durationS) {
    notComputed.push({ machine: heater, reason: `données incomplètes (recette ${recipeId}, Boilers par chauffe-eau, vapeur par turbine)` });
    return;
  }
  const turbines = boilers * turbinesPerBoiler;
  const perTurbine = "tempC" in steam ? turbineAt(steam.tempC) : null;
  const mfps = "mfps" in steam ? steam.mfps : perTurbine === null ? null : perTurbine * turbines;
  if (mfps === null) {
    notComputed.push({ machine: heater, reason: "température de la vapeur hors de la courbe des turbines" });
    return;
  }
  // Combustible seulement : l'eau tourne en boucle fermée (Firebox, Gas Burner : aucune perte).
  const fuel = Object.fromEntries(
    Object.entries(r.inputs)
      .filter(([k, v]) => v !== null && !/water/.test(k))
      .map(([k, v]) => [k, v! / r.durationS!]),
  );
  const parts = [
    { machine: heater, count: 1 },
    { machine: "boiler", count: boilers },
    { machine: "large-turbine", count: turbines },
  ];
  const fuelName = Object.keys(fuel).join(" + ") || "?";
  setups.push({
    id: `centrale:${recipeId}`,
    name: `${m.name} (${fuelName}) + ${boilers} Boiler${boilers > 1 ? "s" : ""} + ${turbines} Large Turbine${turbines > 1 ? "s" : ""}`,
    kind: "thermique",
    machine: heater,
    parts,
    inputsPerSec: fuel,
    outputsPerSec: {},
    mfps,
    guaranteed: true,
    pollutionPerHour: partsPollution(parts),
    note: `${steam.note} Boucle d'eau fermée : seul le remplissage initial demande de l'eau.`,
    sources: [...steam.sources, ...srcOfPage("Boiler"), ...srcOfPage("Large Turbine"), ...(curve ? [curve.source] : [])],
    verify: steam.flag ? [steam.flag] : [],
  });
}

// Firebox : eau chaude à 240 °C, vapeur vers 190 °C (215 °C avec recirculation), 2 Boilers.
{
  const t = factOf("firebox.steamTempC", ef.firebox.steamTempC);
  const tMax = factOf("firebox.steamTempMaxC", ef.firebox.steamTempMaxC);
  factOf("firebox.coolantTempC", ef.firebox.coolantTempC);
  const boilers = factOf("firebox.boilers", ef.firebox.boilers);
  const measured = steamRelevé["firebox"];
  // Eau normale seulement : l'eau tourne en boucle, les variantes filtrée et distillée brûlent le même charbon
  // (leur gain d'efficacité dans le Boiler n'est pas chiffré par le wiki).
  for (const rid of ["firebox_01"]) {
    if (measured !== undefined) {
      thermal("firebox", rid, boilers, { tempC: measured, note: `Vapeur à ${measured} °C (relevé en jeu).`, flag: null, sources: releves ? [releves.source] : [] });
    } else if (t !== null) {
      thermal("firebox", rid, boilers, {
        tempC: t,
        note: `Vapeur vers ${t} °C d'après le wiki${tMax ? ` (jusqu'à ${tMax} °C en renvoyant l'eau usée du Boiler dans sa seconde entrée)` : ""}.`,
        flag: { field: "energyMFps", reason: "approximatif", detail: `température de la vapeur « around ${t} » °C d'après la page Firebox : à confirmer en jeu` },
        sources: srcOfPage("Firebox"),
      });
    }
  }
}
// Gas Burner : le wiki donne directement la puissance d'un brûleur et de ses 10 Boilers.
{
  const power = factOf("gasBurner.powerMFps", ef.gasBurner.powerMFps);
  const boilers = factOf("gasBurner.boilers", ef.gasBurner.boilers);
  factOf("gasBurner.coolantTempC", ef.gasBurner.coolantTempC);
  const measured = steamRelevé["gas-burner"];
  for (const rid of ["gas_burner_01", "gas_burner_02"]) {
    if (measured !== undefined) thermal("gas-burner", rid, boilers, { tempC: measured, note: `Vapeur à ${measured} °C (relevé en jeu).`, flag: null, sources: releves ? [releves.source] : [] });
    else if (power) {
      thermal("gas-burner", rid, boilers, {
        mfps: power[0],
        note: `Puissance d'un brûleur : ${frNum(power[0] / 1e6, 2)} à ${frNum(power[1] / 1e6, 2)} MMF/s d'après le wiki ; on compte la borne basse.`,
        flag: { field: "energyMFps", reason: "approximatif", detail: `${power[0] / 1e6} à ${power[1] / 1e6} MMF/s par brûleur d'après la page Gas Burner : borne basse retenue` },
        sources: srcOfPage("Gas Burner"),
      });
    }
  }
}
// Chauffe-eau dont la vapeur n'est pas documentée : calculés seulement avec un relevé en jeu.
{
  const ifbTemp = factOf("industrialFirebox.coolantTempC", ef.industrialFirebox.coolantTempC);
  const ifbBoilers = factOf("industrialFirebox.boilers", ef.industrialFirebox.boilers);
  const geoMax = factOf("geothermal.maxTempC", ef.geothermal.maxTempC);
  const ifb = steamRelevé["industrial-firebox"];
  if (ifb !== undefined) {
    for (const rid of ["industrial_firebox_09", "industrial_firebox_10", "industrial_firebox_11", "industrial_firebox_12"]) {
      thermal("industrial-firebox", rid, ifbBoilers, { tempC: ifb, note: `Vapeur à ${ifb} °C (relevé en jeu).`, flag: null, sources: releves ? [releves.source] : [] });
    }
  } else notComputed.push({ machine: "industrial-firebox", reason: `eau chaude à ${ifbTemp ?? "?"} °C, mais température de la vapeur inconnue : à relever en jeu` });
  notComputed.push({ machine: "geothermal-well", reason: `jusqu'à ${geoMax ?? "?"} °C avec trois puits en chaîne, perte d'un tiers de l'eau ; température de la vapeur inconnue : à relever en jeu` });
  notComputed.push({ machine: "electric-water-heater", reason: "d'après le wiki, une installation Boiler + turbine ne couvre même pas sa propre consommation" });
  notComputed.push({ machine: "steam-turbine", reason: "puissance de 432 MF/s à 9,36 kMF/s selon la température, sans courbe" });
  for (const id of ["coal-power-plant", "nuclear-power-plant", "turbine-generator", "diesel-engine-generator"]) {
    notComputed.push({ machine: id, reason: "grande centrale modulaire : réglages et données insuffisants pour un calcul fiable" });
  }
}
// Solaire : seul le Solar Panel a un profil heure par heure (moyenne et stockage de nuit exacts).
{
  const hourly = factOf("solarPanel.hourly", ef.solarPanel);
  const dayMinutes = Number(worldFacts.dayMinutes?.value) || null;
  const panel = machineById.get("solar-panel");
  if (hourly && panel && dayMinutes) {
    const avg = hourly.reduce((s, v) => s + v, 0) / 24;
    const hourSec = (dayMinutes * 60) / 24;
    // Niveau de la batterie sur une journée si l'on garantit « avg » : l'amplitude est la capacité utile.
    let level = 0;
    let lo = 0;
    let hi = 0;
    for (const v of hourly) {
      level += (v - avg) * hourSec;
      lo = Math.min(lo, level);
      hi = Math.max(hi, level);
    }
    const storage = hi - lo;
    const rate = Math.max(avg - Math.min(...hourly), Math.max(...hourly) - avg);
    const src = srcOfPage("Solar Panel");
    const pollutionNote = "La pollution et les orages réduisent la production : valeur par temps clair, à 0 % de pollution.";
    setups.push({
      id: "solaire:solar-panel",
      name: "Solar Panel",
      kind: "solaire",
      machine: "solar-panel",
      parts: [{ machine: "solar-panel", count: 1 }],
      inputsPerSec: {},
      outputsPerSec: {},
      mfps: avg,
      guaranteed: false,
      pollutionPerHour: 0,
      note: `Moyenne sur la journée (${Math.min(...hourly)} à ${Math.max(...hourly)} MF/s selon l'heure). ${pollutionNote}`,
      sources: src,
      verify: [],
    });
    for (const b of ["rusty-battery", "mv-battery", "double-mv-battery", "hv-battery", "hv-battery-mk2"]) {
      const e = powerEntries.find((x) => x.id === b);
      const cap = e?.capacity?.perNode;
      const tr = e?.transfer?.perNode;
      if (!e || !cap || !tr) continue;
      const f = Math.max(storage / cap, rate / tr);
      setups.push({
        id: `solaire+stockage:${b}`,
        name: `Solar Panel + ${e.name} (stockage de nuit)`,
        kind: "solaire",
        machine: "solar-panel",
        parts: [
          { machine: "solar-panel", count: 1 },
          { machine: b, count: f },
        ],
        inputsPerSec: {},
        outputsPerSec: {},
        mfps: avg,
        guaranteed: true,
        pollutionPerHour: 0,
        note: `Production lissée jour et nuit : chaque panneau demande ${frNum(storage, 0)} MF de stockage et ${frNum(rate, 2)} MF/s de débit de batterie (1 ${e.name} pour ${frNum(Math.floor(1 / f), 0)} panneaux). ${pollutionNote}`,
        sources: [...src, ...e.sources],
        verify: [],
      });
    }
  }
  notComputed.push({ machine: "solar-panel2", reason: "production selon l'heure inconnue (seulement une plage) : moyenne impossible à calculer" });
  notComputed.push({ machine: "solar-panel3", reason: "production selon l'heure inconnue (seulement une plage) : moyenne impossible à calculer" });
  notComputed.push({ machine: "solar-farm1", reason: "production selon l'heure inconnue (seulement une plage) : moyenne impossible à calculer" });
}
// Éolien : la vitesse du vent n'est jamais nulle ; on compte la production minimale (garantie).
{
  const never = factOf("wind.neverZero", ef.windNeverZero);
  for (const id of ["wind-turbine1", "wind-turbine2", "wind-turbine3"]) {
    const e = powerEntries.find((x) => x.id === id);
    const range = Array.isArray(e?.output) ? (e!.output as [number, number]) : null;
    if (!e || !range || !never) continue;
    setups.push({
      id: `éolien:${id}`,
      name: e.name,
      kind: "éolien",
      machine: id,
      parts: [{ machine: id, count: 1 }],
      inputsPerSec: {},
      outputsPerSec: {},
      mfps: range[0],
      guaranteed: true,
      pollutionPerHour: 0,
      note: `Production minimale (vent faible) : ${range[0]} MF/s ; jusqu'à ${range[1]} MF/s par grand vent. La moyenne n'est pas connue.${id === "wind-turbine3" ? " Une seule par cercle de 50 studs." : ""}`,
      sources: [...e.sources, ...srcOfPage("Wind Turbine3")],
      verify: [],
    });
  }
}
// Scrubbers : pollution retirée selon l'eau utilisée (et ajoutée par la recette au Residue).
const scrubbers: EnergyFile["scrubbers"] = [];
{
  const pairs: [string, Found<number>, string][] = [
    ["scrubber_01", ef.scrubber.water, "scrubber.water"],
    ["scrubber_02", ef.scrubber.filtered, "scrubber.filtered"],
    ["scrubber_03", ef.scrubber.distilled, "scrubber.distilled"],
    ["scrubber_04", ef.scrubber.residue, "scrubber.residue"],
  ];
  for (const [recipe, f, key] of pairs) {
    const v = factOf(key, f);
    if (v === null || !recipeById.has(recipe) || !energyPages["Scrubber"]) continue;
    scrubbers.push({ recipe, pollutionPerHour: v, source: sourceOf(energyPages["Scrubber"]!), quote: "quote" in f ? f.quote : "" });
  }
}
for (const s of setups) for (const f of s.verify) flagLines.push(`| ${s.name} | énergie · ${f.field} | ${f.reason} | ${f.detail} |`);
for (const n of notComputed) flagLines.push(`| ${machineById.get(n.machine)?.name ?? n.machine} | énergie · non calculé | manquant | ${n.reason} |`);

// ---------------------------------------------------------------- écriture
const meta = (counts: Record<string, number>): DataMeta => ({ generatedAt: latest, primary: "miraheze", counts });
const write = (file: string, data: unknown) => writeFileSync(join(OUT, file), JSON.stringify(data, null, 1) + "\n");
write("energy.json", { meta: meta({ setups: setups.length, notComputed: notComputed.length, scrubbers: scrubbers.length }), setups, notComputed, scrubbers, facts: energyFacts } satisfies EnergyFile);
write("logistics.json", { meta: meta({ pipes: pipes.length, storage: storage.length, depots: depots.length }), pipes, storage, depots } satisfies LogisticsFile);
write("power.json", { meta: meta({ entries: powerEntries.length }), entries: powerEntries } satisfies PowerFile);
write("research-stations.json", {
  meta: meta({}),
  rs1: mapFacts(formulas.rs1) as ResearchStationsFile["rs1"],
  rs2: mapFacts(formulas.rs2) as ResearchStationsFile["rs2"],
  rs3: mapFacts(formulas.rs3) as ResearchStationsFile["rs3"],
  rs4: mapFacts(formulas.rs4) as ResearchStationsFile["rs4"],
  satellite: mapFacts(formulas.satellite) as ResearchStationsFile["satellite"],
  softCap: mapFacts(formulas.softCap) as ResearchStationsFile["softCap"],
  startRp: toFact(formulas.startRp),
  buildings: machines.filter((m) => /^research-station\d$|^satellite-dish|^research-tracking-panel$/.test(m.id)).map((m) => m.id),
} satisfies ResearchStationsFile);
write("world.json", { meta: meta({ facts: Object.keys(worldFacts).length }), facts: worldFacts, grid: { cellStuds: grid.cellStuds, snap: grid.snap, rotations: grid.rotations, sources: releves && grid.cellStuds !== null ? [releves.source] : [], verify: gridVerify } } satisfies WorldFile);
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
  ...(appliedLines.length
    ? [`**Relevés en jeu appliqués** (source « jeu », ${releves?.source.fetchedAt.slice(0, 10) ?? "?"} ; prioritaires sur le wiki) :`, "", "| Élément | Champ | Wiki | Relevé en jeu |", "|---|---|---|---|", ...appliedLines, ""]
    : []),
  "**Reste à vérifier :**",
  "",
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
console.log(`world.json            ${Object.keys(worldFacts).length} faits ; grille ${grid.cellStuds === null ? "à relever en jeu" : `relevée (1 case = ${grid.cellStuds} studs)`}`);
console.log(`ports.json            ${Object.keys(ports.machines).length} bâtiment(s) relevé(s)`);
console.log(`energy.json           ${setups.length} installations, ${notComputed.length} non calculées, ${scrubbers.length} recettes de Scrubber`);
if (issues.length) console.log(`⚠ ${issues.length} problème(s) : voir a-verifier.md`);
