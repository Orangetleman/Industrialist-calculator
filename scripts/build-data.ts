// Construit data/*.json et data/a-verifier.md à partir du cache .cache/wiki/
// (aucun accès réseau). Source principale : Miraheze. Contrôle croisé : Fandom.
//
//   node scripts/build-data.ts
//
// Règles : aucune valeur inventée. Une valeur absente vaut null et reçoit un
// drapeau `verify` ; une contradiction garde la valeur Miraheze et range l'autre
// dans `alternatives`. Tout est listé dans a-verifier.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractModuleTable, type LuaValue } from "./lib/lua-literal.ts";
import type { CachedPage, WikiId } from "./lib/wiki-config.ts";
import {
  fandomProduction,
  desmosTreeFormula,
  parseAllTemplates,
  parseMamyflux,
  parseNumber,
  parsePollution,
  parseSize,
  parseTemplate,
  parseTreeGrowth,
  wikiQuote,
  researchNodes,
  slugify,
  type FandomRecipe,
} from "./lib/wiki-extract.ts";
import type {
  DataMeta,
  GrowthBand,
  Item,
  ItemsFile,
  Machine,
  MachinesFile,
  Recipe,
  RecipesFile,
  ResearchCategory,
  ResearchFile,
  ResearchNode,
  Source,
  TreeGrowthFormula,
  VerifyFlag,
} from "../src/engine/types.ts";

const CACHE = ".cache/wiki";
const OUT = "data";
const FIXTURE = "tests/fixtures/reference-crankshaft.json";
const NOTES_START = "<!-- notes-manuelles:debut -->";
const NOTES_END = "<!-- notes-manuelles:fin -->";

// ---------------------------------------------------------------- cache
type Index = Record<string, { file: string; title: string; revid: number | null; missing?: boolean }>;
const indexes: Record<WikiId, Index> = { miraheze: {}, fandom: {} };
for (const w of ["miraheze", "fandom"] as WikiId[]) {
  const f = join(CACHE, w, "_index.json");
  if (existsSync(f)) indexes[w] = JSON.parse(readFileSync(f, "utf8"));
}
if (!Object.keys(indexes.miraheze).length) {
  console.error("Cache vide : lance d'abord `node scripts/fetch-wiki.ts`.");
  process.exit(1);
}
let latestFetch = "";
function page(wiki: WikiId, title: string): CachedPage | null {
  const e = indexes[wiki][title];
  if (!e || e.missing) return null;
  const p: CachedPage = JSON.parse(readFileSync(join(CACHE, wiki, e.file), "utf8"));
  if (p.fetchedAt > latestFetch) latestFetch = p.fetchedAt;
  return p;
}
function sourceOf(p: CachedPage): Source {
  return { wiki: p.wiki, url: p.url, page: p.title, revisionId: p.revid, fetchedAt: p.fetchedAt };
}

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "number" ? String(v) : JSON.stringify(v));

// Problèmes globaux (non rattachés à un objet) pour a-verifier.md
const globalIssues: string[] = [];

// ---------------------------------------------------------------- items (noms)
const itemNames = new Map<string, Set<string>>(); // slug → noms rencontrés
function itemId(name: string): string {
  const id = slugify(name);
  if (!itemNames.has(id)) itemNames.set(id, new Set());
  itemNames.get(id)!.add(name);
  return id;
}

// ---------------------------------------------------------------- recettes (Miraheze)
const recipes: Recipe[] = [];
const recipeIds = new Set<string>();
const machineNames = new Map<string, string>(); // id → nom
const moduleTitles = Object.keys(indexes.miraheze).filter((t) => t.startsWith("Module:Recipes/")).sort();

for (const title of moduleTitles) {
  const p = page("miraheze", title);
  if (!p) continue;
  const machineName = title.slice("Module:Recipes/".length);
  const machine = slugify(machineName);
  machineNames.set(machine, machineName);
  let table: LuaValue;
  try {
    table = extractModuleTable(p.content);
  } catch (e) {
    globalIssues.push(`Module illisible [${title}](${p.url}) : ${(e as Error).message}. Ses recettes sont absentes des données.`);
    continue;
  }
  if (!Array.isArray(table)) {
    globalIssues.push(`Module [${title}](${p.url}) : la table renvoyée n'est pas une liste. Ignoré.`);
    continue;
  }
  for (const raw of table) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const r = raw as Record<string, LuaValue>;
    const verify: VerifyFlag[] = [];
    let id = typeof r.id === "string" ? r.id : "";
    if (!id) {
      id = `${machine}-sans-id-${recipes.length}`;
      verify.push({ field: "id", reason: "manquant", detail: "recette sans `id` dans le module" });
    }
    if (recipeIds.has(id)) {
      globalIssues.push(`Identifiant de recette en double : \`${id}\` (${title}). Le second est renommé \`${id}~${machine}\`.`);
      id = `${id}~${machine}`;
    }
    recipeIds.add(id);

    let durationS: number | null = typeof r.time === "number" ? r.time : null;
    if (typeof r.time_mode === "string") {
      verify.push({ field: "durationS", reason: "variable", mode: r.time_mode, detail: `durée variable (mode « ${r.time_mode} »)${durationS !== null ? `, valeur de base ${durationS} s` : ""}` });
    } else if (durationS === null) verify.push({ field: "durationS", reason: "manquant", detail: "`time` absent ou non numérique" });
    else if (durationS <= 0) {
      verify.push({ field: "durationS", reason: "non-sourcé", detail: `durée ≤ 0 (${durationS})` });
      durationS = null;
    }

    const energyMFps = parseMamyflux(r.mamyflux);
    if (typeof r.mamyflux_mode === "string") {
      verify.push({ field: "energyMFps", reason: "variable", mode: r.mamyflux_mode, detail: `énergie variable (mode « ${r.mamyflux_mode} »)${energyMFps !== null ? `, valeur de base ${r.mamyflux}` : ""}` });
    } else if (energyMFps === null) verify.push({ field: "energyMFps", reason: "manquant", detail: `\`mamyflux\` illisible : ${fmt(r.mamyflux)}` });

    const io = (list: LuaValue | undefined, kind: "inputs" | "outputs"): Record<string, number | null> => {
      const out: Record<string, number | null> = {};
      if (!Array.isArray(list)) return out;
      for (const e of list) {
        if (!e || typeof e !== "object" || Array.isArray(e)) continue;
        const x = e as Record<string, LuaValue>;
        if (typeof x.item !== "string") continue;
        const iid = itemId(x.item);
        const amount = typeof x.amount === "number" ? x.amount : null;
        if (Object.hasOwn(out, iid)) {
          verify.push({ field: `${kind}.${iid}`, reason: "non-sourcé", detail: `${x.item} apparaît deux fois ; quantités additionnées` });
          out[iid] = out[iid] === null || amount === null ? null : out[iid]! + amount;
          continue;
        }
        out[iid] = amount;
        if (typeof x.amount_mode === "string") {
          verify.push({ field: `${kind}.${iid}`, reason: "variable", mode: x.amount_mode, detail: `quantité de ${x.item} variable (mode « ${x.amount_mode} »)${amount !== null ? `, valeur de base ${amount}` : ""}` });
        } else if (amount === null) verify.push({ field: `${kind}.${iid}`, reason: "manquant", detail: `quantité de ${x.item} absente` });
      }
      return out;
    };
    const inputs = io(r.inputs, "inputs");
    const outputs = io(r.outputs, "outputs");
    // Un générateur (énergie négative = production) n'a pas d'item en sortie : c'est normal.
    const generator = energyMFps !== null && energyMFps < 0;
    if (!Object.keys(outputs).length && !generator) verify.push({ field: "outputs", reason: "manquant", detail: "aucune sortie" });

    recipes.push({ id, machine, durationS, inputs, outputs, energyMFps, research: null, sources: [sourceOf(p)], verify });
  }
}

// ---------------------------------------------------------------- arbre de recherche
const rsPage = page("miraheze", "Module:RS/Data");
if (!rsPage) throw new Error("Module:RS/Data absent du cache");
const rsSource = sourceOf(rsPage);
const rawNodes = researchNodes(extractModuleTable(rsPage.content, "p"));
const nodes: ResearchNode[] = [];
const nodeByName = new Map<string, ResearchNode>();
const CATEGORIES: ResearchCategory[] = ["Production", "Energy", "Utility"];
for (const n of rawNodes) {
  const category = (CATEGORIES as string[]).includes(n.category) ? (n.category as ResearchCategory) : null;
  if (!category) {
    globalIssues.push(`Catégorie de recherche inconnue « ${n.category} » (nœud ${n.name}).`);
    continue;
  }
  let id = slugify(n.name);
  if (nodes.some((x) => x.id === id)) {
    globalIssues.push(`Nom de nœud en double « ${n.name} » ; celui de la catégorie ${category} devient \`${id}--${slugify(category)}\`.`);
    id = `${id}--${slugify(category)}`;
  }
  const node: ResearchNode = {
    id,
    name: n.name,
    category,
    rp: n.rp,
    children: [],
    parents: [],
    requires: "all",
    unlocksMachines: [],
    unlocksOther: [],
    reqItems: n.reqItems.map((r) => ({ item: itemNames.has(slugify(r.item)) ? slugify(r.item) : itemId(r.item), amount: r.amount })),
    isRoot: n.rp === 0 && n.name === category,
    sources: [rsSource],
    verify: [],
  };
  nodes.push(node);
  if (!nodeByName.has(n.name)) nodeByName.set(n.name, node);
}
for (const n of rawNodes) {
  const node = nodeByName.get(n.name);
  if (!node) continue;
  for (const childName of n.children) {
    const child = nodeByName.get(childName);
    if (!child) {
      node.verify.push({ field: "children", reason: "manquant", detail: `enfant « ${childName} » introuvable dans RS/Data` });
      continue;
    }
    node.children.push(child.id);
    child.parents.push(node.id);
  }
}
for (const node of nodes) {
  if (node.parents.length > 1) {
    node.verify.push({
      field: "requires",
      reason: "non-sourcé",
      detail: `${node.parents.length} parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas`,
    });
  }
  if (!node.isRoot && !node.parents.length) node.verify.push({ field: "parents", reason: "manquant", detail: "aucun parent : nœud inaccessible dans l'arbre" });
}
// Recherches acquises d'office dans un nouveau monde (relevé en jeu, data/releves.json).
{
  const relevesPath = join(OUT, "releves.json");
  const releves = existsSync(relevesPath) ? (JSON.parse(readFileSync(relevesPath, "utf8")) as { source: Source; research?: { startUnlocked?: string[] } }) : null;
  for (const id of releves?.research?.startUnlocked ?? []) {
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error(`releves.json : recherche acquise d'office inconnue « ${id} »`);
    node.startUnlocked = true;
    node.sources = [...node.sources, releves!.source];
  }
}

// ---------------------------------------------------------------- machines
/** RS/Data écrit parfois « Page#ancre; Nom affiché » : on garde le nom affiché. */
const displayName = (b: string) => (b.includes(";") ? b.slice(b.lastIndexOf(";") + 1).trim() : b);
const bid = (b: string) => slugify(displayName(b));
const buildingToNodes = new Map<string, ResearchNode[]>();
for (const n of rawNodes) {
  const node = nodeByName.get(n.name)!;
  for (const b of n.buildings) {
    const k = bid(b);
    if (!buildingToNodes.has(k)) buildingToNodes.set(k, []);
    buildingToNodes.get(k)!.push(node);
  }
}
machineNames.set("tree", "Tree");
// Autres bâtiments de l'arbre (poteaux, batteries, tuyaux…) : affichés dans l'arbre, jamais utilisés par le calcul.
const buildingNames = new Map<string, string>();
for (const n of rawNodes) for (const b of n.buildings) if (!machineNames.has(bid(b))) buildingNames.set(bid(b), b);
const machines: Machine[] = [];
const allBuildings = [...[...machineNames].map(([id, name]) => [id, name, false] as const), ...[...buildingNames].map(([id, name]) => [id, name, true] as const)];
for (const [id, rawName, isBuilding] of allBuildings.sort(([a], [b]) => a.localeCompare(b))) {
  const name = displayName(rawName);
  const fetched = page("miraheze", rawName);
  // Une redirection vers une page commune (ex. « Pipes ») décrit plusieurs bâtiments : on n'en tire aucune valeur.
  const shared = !!fetched && fetched.title !== name;
  const p = shared ? null : fetched;
  const verify: VerifyFlag[] = [];
  const sources: Source[] = [];
  let ib: Record<string, string> | null = null;
  if (shared) sources.push({ ...sourceOf(fetched!), note: `page commune à plusieurs bâtiments (« ${fetched!.title} ») : valeurs non reprises` });
  else if (!p) {
    if (!isBuilding) verify.push({ field: "page", reason: "manquant", detail: `page « ${name} » absente du wiki` });
  } else {
    sources.push(sourceOf(p));
    ib = parseTemplate(p.content, "Machine2");
    if (!ib && !isBuilding) verify.push({ field: "page", reason: "manquant", detail: "pas d'infobox Machine2" });
  }
  if (!sources.length) sources.push({ ...rsSource, note: "cité dans Module:RS/Data, sans page dédiée" });
  const description = p ? wikiQuote(p.content) : null;
  // Pour les bâtiments hors production, les valeurs manquantes ne gênent pas le calcul : pas de drapeau.
  const flag = (f: VerifyFlag) => { if (!isBuilding) verify.push(f); };
  const cost = parseNumber(ib?.Cost);
  if (ib && cost === null) flag({ field: "cost", reason: "manquant", detail: `Cost illisible : ${fmt(ib.Cost)}` });
  const size = parseSize(ib?.Size);
  if (ib && !size) flag({ field: "size", reason: "manquant", detail: `Size illisible : ${fmt(ib.Size)}` });
  const pollutionPerHour = parsePollution(ib?.Pollution);
  if (ib && pollutionPerHour === null) {
    flag({ field: "pollutionPerHour", reason: ib.Pollution ? "variable" : "manquant", detail: `Pollution : ${fmt(ib.Pollution)}` });
  } else if (Array.isArray(pollutionPerHour)) {
    flag({ field: "pollutionPerHour", reason: "approximatif", detail: `plage ${ib?.Pollution}` });
  }
  const tier = parseNumber(ib?.Tier);

  // Déblocage : bâtiments de RS/Data (principal), champ Research de l'infobox (contrôle)
  const fromRs = buildingToNodes.get(id) ?? [];
  const ibResearch = ib?.Research?.trim() || null;
  const ibNode = ibResearch ? nodeByName.get(ibResearch) ?? null : null;
  let unlockedBy: string | null = null;
  if (fromRs.length) {
    unlockedBy = fromRs[0]!.id;
    if (fromRs.length > 1) {
      verify.push({ field: "unlockedBy", reason: "contradiction", detail: `débloquée par plusieurs nœuds : ${fromRs.map((n) => n.name).join(", ")}`, alternatives: fromRs.slice(1).map((n) => ({ value: n.id, source: rsSource })) });
    }
    if (ibResearch && (!ibNode || ibNode.id !== unlockedBy) && p) {
      verify.push({ field: "unlockedBy", reason: "contradiction", detail: `RS/Data : « ${fromRs[0]!.name} » ; infobox : « ${ibResearch} »`, alternatives: [{ value: ibNode?.id ?? ibResearch, source: sourceOf(p) }] });
    }
  } else if (ibNode) {
    unlockedBy = ibNode.id;
  } else {
    verify.push({ field: "unlockedBy", reason: "manquant", detail: ibResearch ? `infobox : « ${ibResearch} », nœud introuvable dans RS/Data` : "aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox)" });
  }
  for (const n of fromRs) if (!n.unlocksMachines.includes(id)) n.unlocksMachines.push(id);
  if (!fromRs.length && ibNode && !ibNode.unlocksMachines.includes(id)) ibNode.unlocksMachines.push(id);

  const variant = ib?.Variant?.trim() || null;
  machines.push({
    id,
    name,
    kind: id === "tree" ? "farm" : isBuilding ? "building" : "machine",
    description,
    category: ib?.Category?.trim() || null,
    unlockedBy,
    variantOf: variant ? slugify(variant) : null,
    limited: /^yes$/i.test(ib?.Limited?.trim() ?? ""),
    tier,
    cost,
    size,
    pollutionPerHour,
    sources,
    verify,
  });
}
for (const n of rawNodes) {
  const node = nodeByName.get(n.name)!;
  for (const b of n.buildings) if (!machineNames.has(bid(b)) && !buildingNames.has(bid(b))) node.unlocksOther.push(displayName(b));
}
const machineById = new Map(machines.map((m) => [m.id, m]));
for (const r of recipes) r.research = machineById.get(r.machine)?.unlockedBy ?? null;

// ---------------------------------------------------------------- arbres (Tree)
const treePage = page("miraheze", "Tree");
let bands: GrowthBand[] = [];
let treeSource: Source = { wiki: "miraheze", fetchedAt: latestFetch, note: "page Tree absente" };
let calculatorUrl: string | undefined;
let formula: TreeGrowthFormula | undefined;
if (treePage) {
  treeSource = sourceOf(treePage);
  bands = parseTreeGrowth(treePage.content);
  calculatorUrl = /\[(https:\/\/www\.desmos\.com\/calculator\/[^\s\]]+)/.exec(treePage.content)?.[1];
  const desmosFile = join(CACHE, "desmos-tree.json");
  if (calculatorUrl && existsSync(desmosFile)) {
    const cached = JSON.parse(readFileSync(desmosFile, "utf8")) as { url: string; fetchedAt: string; state: unknown };
    const f = desmosTreeFormula(cached.state);
    if (f.ok) {
      formula = { ...f.value, source: { wiki: "desmos", url: cached.url, page: "Tree Calculator (communautaire, lié depuis la page Tree)", fetchedAt: cached.fetchedAt } };
    } else globalIssues.push(`Calculateur Desmos des arbres non utilisé : ${f.error}. Le tableau du wiki sert de repli.`);
  } else if (calculatorUrl) globalIssues.push("Calculateur Desmos des arbres absent du cache : relancer fetch-wiki. Le tableau du wiki sert de repli.");
  const normal = bands.find((b) => b.label.includes("Normal"));
  const logs = /produces a minimum of (two|\d+) \[\[Oak Log/i.exec(treePage.content);
  const logCount = logs ? (logs[1] === "two" ? 2 : Number(logs[1])) : null;
  const tree = machineById.get("tree");
  const treeIb = parseTemplate(treePage.content, "Machine2");
  const verify: VerifyFlag[] = [];
  if (normal) verify.push({ field: "durationS", reason: "approximatif", detail: `« ${normal.label} » : valeur arrondie (~) et dépendante de la pollution` });
  else verify.push({ field: "durationS", reason: "manquant", detail: "ligne « Normal » introuvable dans le tableau Tree Growth" });
  if (logCount !== null) verify.push({ field: `outputs.${itemId("Oak Log")}`, reason: "approximatif", detail: `le wiki dit « au moins ${logCount} » Oak Logs par arbre` });
  else verify.push({ field: `outputs.${itemId("Oak Log")}`, reason: "manquant", detail: "nombre d'Oak Logs par arbre introuvable" });
  const noPower = treeIb && !treeIb.PowerInput?.trim() && /^0\s*MF$/i.test(treeIb.Capacity?.trim() ?? "");
  if (!noPower) verify.push({ field: "energyMFps", reason: "manquant", detail: "consommation de l'arbre non indiquée" });
  recipes.push({
    id: "tree_01",
    machine: "tree",
    durationS: normal ? normal.seconds[0] : null,
    inputs: {},
    outputs: { [itemId("Oak Log")]: logCount },
    // PowerInput vide et Capacity=0MF dans l'infobox : l'arbre ne consomme pas d'énergie.
    energyMFps: noPower ? 0 : null,
    research: tree?.unlockedBy ?? null,
    durationByPollution: true,
    sources: [treeSource],
    verify,
  });
}

// ---------------------------------------------------------------- items
const items: Item[] = [];
for (const [id, names] of [...itemNames].sort(([a], [b]) => a.localeCompare(b))) {
  const verify: VerifyFlag[] = [];
  const list = [...names];
  if (list.length > 1) verify.push({ field: "name", reason: "contradiction", detail: `orthographes multiples : ${list.join(" / ")}` });
  let name = list[0]!;
  let p: CachedPage | null = null;
  for (const n of list) {
    p = page("miraheze", n);
    if (p) {
      name = n;
      break;
    }
  }
  const ib = p ? parseTemplate(p.content, "Item") : null;
  if (!p) verify.push({ field: "page", reason: "manquant", detail: `page « ${name} » absente du wiki` });
  else if (!ib) verify.push({ field: "page", reason: "manquant", detail: "pas d'infobox Item" });
  const isFluid = ib?.isFluid === "true" ? true : ib?.isFluid === "false" ? false : null;
  if (ib && isFluid === null) verify.push({ field: "isFluid", reason: "manquant", detail: `isFluid : ${fmt(ib.isFluid)}` });
  const sellValue = parseNumber(ib?.sellValue);
  if (ib && sellValue === null) verify.push({ field: "sellValue", reason: "manquant", detail: `sellValue : ${fmt(ib.sellValue)}` });
  const rv = ib?.resValue?.trim();
  const researchValue = rv ? (parseNumber(rv) ?? rv) : null;
  if (typeof researchValue === "string") verify.push({ field: "researchValue", reason: "approximatif", detail: `plage « ${rv} »` });
  items.push({ id, name, isFluid, sellValue, researchValue, sources: p ? [sourceOf(p)] : [], verify });
}

// ---------------------------------------------------------------- contrôle croisé Fandom
type FandomSeen = FandomRecipe & { source: Source };
const fandomRecipes = new Map<string, FandomSeen>();
const fandomUnreadable: string[] = [];
for (const title of Object.keys(indexes.fandom).sort()) {
  const p = page("fandom", title);
  if (!p) continue;
  for (const t of parseAllTemplates(p.content, "Production")) {
    const f = fandomProduction(t);
    if (!f) {
      fandomUnreadable.push(`[${p.title}](${p.url}) : {{Production}} sans machine`);
      continue;
    }
    const sig = JSON.stringify([slugify(f.machine), f.durationS, f.energyMFps, Object.entries(f.inputs).sort(), Object.entries(f.outputs).sort()]);
    if (!fandomRecipes.has(sig)) fandomRecipes.set(sig, { ...f, source: sourceOf(p) });
  }
}
const sameKeys = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
};
const fandomOnly: FandomSeen[] = [];
const fandomAmbiguous: FandomSeen[] = [];
let fandomAgree = 0;
let fandomConflicts = 0;
for (const f of fandomRecipes.values()) {
  const m = slugify(f.machine);
  const cands = recipes.filter((r) => r.machine === m && sameKeys(r.inputs, f.inputs) && sameKeys(r.outputs, f.outputs));
  if (!cands.length) {
    fandomOnly.push(f);
    continue;
  }
  const amountsEqual = (r: Recipe) =>
    [...Object.entries(f.inputs).map(([k, v]) => [r.inputs[k], v]), ...Object.entries(f.outputs).map(([k, v]) => [r.outputs[k], v])].every(
      ([a, b]) => typeof a === "number" && typeof b === "number" && nearlyEqual(a, b),
    );
  const exact = cands.filter(amountsEqual);
  const target = exact.length === 1 ? exact[0]! : cands.length === 1 ? cands[0]! : null;
  if (!target) {
    if (!exact.length) fandomAmbiguous.push(f);
    continue;
  }
  let conflict = false;
  const check = (field: string, mh: number | null, fd: number | null) => {
    if (fd === null || mh === null) return;
    if (target.verify.some((v) => v.field === field && v.reason === "variable")) return;
    if (nearlyEqual(mh, fd)) return;
    conflict = true;
    const existing = target.verify.find((v) => v.field === field && v.reason === "contradiction");
    if (existing) {
      if (!existing.alternatives?.some((a) => a.value === fd)) existing.alternatives = [...(existing.alternatives ?? []), { value: fd, source: f.source }];
    } else {
      target.verify.push({ field, reason: "contradiction", detail: `Miraheze : ${mh} ; Fandom : ${fd}`, alternatives: [{ value: fd, source: f.source }] });
    }
  };
  check("durationS", target.durationS, f.durationS);
  check("energyMFps", target.energyMFps, f.energyMFps);
  for (const [k, v] of Object.entries(f.inputs)) check(`inputs.${k}`, target.inputs[k] ?? null, v);
  for (const [k, v] of Object.entries(f.outputs)) check(`outputs.${k}`, target.outputs[k] ?? null, v);
  if (conflict) fandomConflicts++;
  else fandomAgree++;
}

// ---------------------------------------------------------------- concordance avec la référence
type FixtureRecipe = { key: string; product: string; machine: string; durationS: number; energyMFps: number; inputs: Record<string, number>; outputs: Record<string, number> };
const fixture: { recipes: FixtureRecipe[] } = JSON.parse(readFileSync(FIXTURE, "utf8"));
type ConcordanceLine = { key: string; product: string; machine: string; field: string; reference: unknown; data: unknown; recipeId: string | null };
const concordance: ConcordanceLine[] = [];
const concordanceOk: string[] = [];
for (const fr of fixture.recipes) {
  const ins = Object.fromEntries(Object.entries(fr.inputs).map(([k, v]) => [slugify(k), v]));
  const outs = Object.fromEntries(Object.entries(fr.outputs).map(([k, v]) => [slugify(k), v]));
  const m = slugify(fr.machine);
  const cands = recipes.filter((r) => r.machine === m && sameKeys(r.inputs, ins) && sameKeys(r.outputs, outs));
  const r =
    cands.find((c) => [...Object.entries(ins).map(([k, v]) => [c.inputs[k], v]), ...Object.entries(outs).map(([k, v]) => [c.outputs[k], v])].every(([a, b]) => typeof a === "number" && nearlyEqual(a, b as number))) ??
    cands[0];
  const base = { key: fr.key, product: fr.product, machine: fr.machine, recipeId: r?.id ?? null };
  if (!r) {
    concordance.push({ ...base, field: "recette", reference: "présente", data: "absente" });
    continue;
  }
  const diffs: ConcordanceLine[] = [];
  const cmp = (field: string, a: number, b: number | null) => {
    if (b === null || !nearlyEqual(a, b)) diffs.push({ ...base, field, reference: a, data: b });
  };
  cmp("durationS", fr.durationS, r.durationS);
  cmp("energyMFps", fr.energyMFps, r.energyMFps);
  for (const [k, v] of Object.entries(ins)) cmp(`inputs.${k}`, v, r.inputs[k] ?? null);
  for (const [k, v] of Object.entries(outs)) cmp(`outputs.${k}`, v, r.outputs[k] ?? null);
  if (diffs.length) concordance.push(...diffs);
  else concordanceOk.push(`${fr.product} (${fr.machine}) = \`${r.id}\``);
}

// ---------------------------------------------------------------- écriture des JSON
const meta = (counts: Record<string, number>): DataMeta => ({ generatedAt: latestFetch, primary: "miraheze", counts });
mkdirSync(OUT, { recursive: true });
const write = (file: string, data: unknown) => writeFileSync(join(OUT, file), JSON.stringify(data, null, 1) + "\n");
const flagged = <T extends { verify: VerifyFlag[] }>(xs: T[]) => xs.filter((x) => x.verify.length).length;

recipes.sort((a, b) => a.machine.localeCompare(b.machine) || a.id.localeCompare(b.id));
nodes.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
write("items.json", { meta: meta({ items: items.length, aVerifier: flagged(items) }), items } satisfies ItemsFile);
write("machines.json", {
  meta: meta({ machines: machines.length, aVerifier: flagged(machines) }),
  machines,
  treeGrowth: { bands, source: treeSource, ...(calculatorUrl ? { calculatorUrl } : {}), ...(formula ? { formula } : {}) },
} satisfies MachinesFile);
write("recipes.json", { meta: meta({ recipes: recipes.length, aVerifier: flagged(recipes) }), recipes } satisfies RecipesFile);
write("research.json", { meta: meta({ nodes: nodes.length, aVerifier: flagged(nodes) }), nodes } satisfies ResearchFile);
if (!existsSync(join(OUT, "overrides.json"))) {
  write("overrides.json", {
    _lisezMoi:
      "Corrections prioritaires sur les données du wiki. Format : { recipes|machines|items|research : { <id> : { <champ> : { value, source: { wiki: 'jeu'|'saisie', fetchedAt, note } } } } }. Ex. champ « durationS » ou « inputs.steel-ingot ». Le plus simple : corriger dans l'appli puis « Exporter mes corrections ».",
    recipes: {},
    machines: {},
    items: {},
    research: {},
  });
}

// ---------------------------------------------------------------- a-verifier.md
const mdPath = join(OUT, "a-verifier.md");
const previous = existsSync(mdPath) ? readFileSync(mdPath, "utf8") : "";
const notes =
  previous.includes(NOTES_START) && previous.includes(NOTES_END)
    ? previous.slice(previous.indexOf(NOTES_START) + NOTES_START.length, previous.indexOf(NOTES_END)).trim()
    : "_Ajoute ici tes remarques ou relevés en jeu. Cette section est conservée à chaque régénération._";
const esc = (s: string) => s.replace(/\|/g, "\\|");
const srcLink = (s: Source | undefined) => (s?.url ? `[${s.wiki}](${s.url})` : (s?.wiki ?? "—"));
const altText = (f: VerifyFlag) => (f.alternatives?.length ? f.alternatives.map((a) => `${fmt(a.value)} (${srcLink(a.source)})`).join(", ") : "");
const name = (id: string) => items.find((i) => i.id === id)?.name ?? id;
const ioText = (r: Recipe) =>
  `${Object.entries(r.inputs).map(([k, v]) => `${fmt(v)} ${name(k)}`).join(" + ") || "∅"} → ${Object.entries(r.outputs).map(([k, v]) => `${fmt(v)} ${name(k)}`).join(" + ")}`;

const L: string[] = [];
L.push("# Données à vérifier");
L.push("");
L.push(`> Fichier généré par \`node scripts/build-data.ts\` à partir du cache du ${latestFetch.slice(0, 10)}. Ne modifie que la section « Notes manuelles » en bas : le reste est réécrit à chaque génération.`);
L.push(">");
L.push("> Source principale : **Miraheze**. Contrôle croisé : **Fandom**. Les corrections vont dans `data/overrides.json`, ou se saisissent directement dans l'appli.");
L.push("");
L.push("## Résumé");
L.push("");
L.push("| Fichier | Objets | Dont à vérifier |");
L.push("|---|---|---|");
L.push(`| recipes.json | ${recipes.length} | ${flagged(recipes)} |`);
L.push(`| machines.json | ${machines.length} | ${flagged(machines)} |`);
L.push(`| items.json | ${items.length} | ${flagged(items)} |`);
L.push(`| research.json | ${nodes.length} | ${flagged(nodes)} |`);
L.push("");
L.push(`Contrôle Fandom : ${fandomRecipes.size} recettes distinctes lues, ${fandomAgree} identiques à Miraheze, ${fandomConflicts} en contradiction, ${fandomOnly.length} absentes de Miraheze, ${fandomAmbiguous.length} ambiguës.`);
L.push("");

L.push("## Concordance avec la référence (`reference/ligne-vilebrequin.html`)");
L.push("");
L.push("La référence n'est pas une source de données. Chaque recette doit soit être identique dans `data/`, soit figurer ci-dessous.");
L.push("");
L.push(`Identiques : ${concordanceOk.length ? concordanceOk.join(" ; ") : "aucune"}.`);
L.push("");
if (concordance.length) {
  L.push("| Recette | Champ | Référence | Données | Recette des données |");
  L.push("|---|---|---|---|---|");
  for (const c of concordance) {
    L.push(`| ${c.product} (${c.machine}) <!-- ref:${c.key}:${c.field} --> | ${c.field} | ${fmt(c.reference)} | ${fmt(c.data)} | ${c.recipeId ? `\`${c.recipeId}\`` : "—"} |`);
  }
  L.push("");
}

if (globalIssues.length) {
  L.push("## Problèmes de structure");
  L.push("");
  for (const g of globalIssues) L.push(`- ${g}`);
  L.push("");
}

const byReason = (xs: { verify: VerifyFlag[] }[], reason: string) => xs.filter((x) => x.verify.some((v) => v.reason === reason));

L.push("## Recettes");
L.push("");
const recipeSections: [string, string, string][] = [
  ["contradiction", "Contradictions (valeur Miraheze retenue)", "Le moteur utilise la valeur Miraheze et affiche l'alternative."],
  ["manquant", "Valeurs manquantes", "Ces recettes donnent un résultat partiel, ou ne sont pas choisies si l'option « recettes à vérifier » est désactivée."],
  ["variable", "Valeurs variables (dépendent d'un réglage du jeu)", "Le wiki donne une valeur de base et un mode (vitesse du Chemical Plant, température de vapeur, pollution…). Le moteur n'utilise ces recettes que si l'option est activée."],
  ["approximatif", "Valeurs approximatives", ""],
  ["non-sourcé", "Valeurs sans source fiable", ""],
];
for (const [reason, title, help] of recipeSections) {
  const list = byReason(recipes, reason) as Recipe[];
  if (!list.length) continue;
  L.push(`### ${title} — ${list.length}`);
  L.push("");
  if (help) L.push(help, "");
  L.push("| Recette | Machine | Entrées → sorties | Champ | Détail | Alternatives |");
  L.push("|---|---|---|---|---|---|");
  for (const r of list) {
    for (const f of r.verify.filter((v) => v.reason === reason)) {
      L.push(`| [\`${r.id}\`](${r.sources[0]?.url ?? ""}) | ${machineNames.get(r.machine) ?? r.machine} | ${esc(ioText(r))} | ${f.field} | ${esc(f.detail)} | ${esc(altText(f))} |`);
    }
  }
  L.push("");
}
if (fandomOnly.length) {
  L.push(`### Recettes présentes seulement sur Fandom — ${fandomOnly.length}`);
  L.push("");
  L.push("Fandom n'est plus mis à jour : ces recettes ont peut-être été retirées du jeu ou renommées. Elles ne sont **pas** dans les données.");
  L.push("");
  L.push("| Machine | Entrées → sorties | Durée | Énergie | Page |");
  L.push("|---|---|---|---|---|");
  for (const f of fandomOnly.sort((a, b) => a.machine.localeCompare(b.machine))) {
    const io = `${Object.entries(f.inputs).map(([k, v]) => `${fmt(v)} ${k}`).join(" + ") || "∅"} → ${Object.entries(f.outputs).map(([k, v]) => `${fmt(v)} ${k}`).join(" + ")}`;
    L.push(`| ${esc(f.machine)} | ${esc(io)} | ${fmt(f.durationS)} | ${fmt(f.energyMFps)} | ${srcLink(f.source)} |`);
  }
  L.push("");
}
if (fandomAmbiguous.length) {
  L.push(`### Recettes Fandom non comparables (plusieurs candidates Miraheze) — ${fandomAmbiguous.length}`);
  L.push("");
  for (const f of fandomAmbiguous) L.push(`- ${f.machine} : ${Object.keys(f.inputs).join(" + ") || "∅"} → ${Object.keys(f.outputs).join(" + ")} (${srcLink(f.source)})`);
  L.push("");
}

L.push("## Machines");
L.push("");
const mFlags = machines.filter((m) => m.verify.length);
if (mFlags.length) {
  L.push("| Machine | Champ | Raison | Détail | Alternatives |");
  L.push("|---|---|---|---|---|");
  for (const m of mFlags) for (const f of m.verify) L.push(`| [${m.name}](${m.sources[0]?.url ?? ""}) | ${f.field} | ${f.reason} | ${esc(f.detail)} | ${esc(altText(f))} |`);
  L.push("");
}
const variants = machines.filter((m) => m.variantOf || m.limited);
if (variants.length) {
  L.push(`**Variantes et éditions limitées** (${variants.length}) : ${variants.map((m) => `${m.name}${m.variantOf ? ` (variante de ${machineNames.get(m.variantOf) ?? m.variantOf})` : ""}${m.limited ? " [Limited]" : ""}`).join(" ; ")}.`);
  L.push("La façon dont elles se débloquent en jeu n'est pas précisée par le wiki ; à confirmer.");
  L.push("");
}

L.push("## Arbre de recherche");
L.push("");
const nFlags = nodes.filter((n) => n.verify.length);
if (nFlags.length) {
  L.push("| Nœud | Catégorie | Champ | Détail |");
  L.push("|---|---|---|---|");
  for (const n of nFlags) for (const f of n.verify) L.push(`| ${n.name} | ${n.category} | ${f.field} | ${esc(f.detail)}${f.field === "requires" ? ` (parents : ${n.parents.map((p) => nodes.find((x) => x.id === p)?.name).join(", ")})` : ""} |`);
  L.push("");
}

L.push("## Items");
L.push("");
const iFlags = items.filter((i) => i.verify.length);
if (iFlags.length) {
  L.push("| Item | Champ | Raison | Détail |");
  L.push("|---|---|---|---|");
  for (const i of iFlags) for (const f of i.verify) L.push(`| ${i.name} | ${f.field} | ${f.reason} | ${esc(f.detail)} |`);
  L.push("");
}
const produced = new Set(recipes.flatMap((r) => Object.keys(r.outputs)));
const unproduced = items.filter((i) => !produced.has(i.id));
if (unproduced.length) {
  L.push(`**Items sans aucune recette de production** (${unproduced.length}) : ${unproduced.map((i) => i.name).join(", ")}.`);
  L.push("Le moteur les signalera comme « source inconnue » s'ils apparaissent dans une chaîne.");
  L.push("");
}
if (fandomUnreadable.length) {
  L.push("## Modèles Fandom illisibles");
  L.push("");
  for (const u of fandomUnreadable) L.push(`- ${u}`);
  L.push("");
}
L.push("## Notes manuelles");
L.push("");
L.push(NOTES_START);
L.push(notes);
L.push(NOTES_END);
L.push("");
writeFileSync(mdPath, L.join("\n"));

console.log(`recipes.json   ${recipes.length} recettes (${flagged(recipes)} à vérifier)`);
console.log(`machines.json  ${machines.length} machines (${flagged(machines)} à vérifier), ${bands.length} plages de pousse des arbres`);
console.log(`items.json     ${items.length} items (${flagged(items)} à vérifier)`);
console.log(`research.json  ${nodes.length} nœuds (${flagged(nodes)} à vérifier)`);
console.log(`Fandom         ${fandomAgree} identiques, ${fandomConflicts} contradictions, ${fandomOnly.length} absentes de Miraheze, ${fandomAmbiguous.length} ambiguës`);
console.log(`Référence      ${concordanceOk.length} recettes identiques, ${concordance.length} écart(s) documenté(s)`);
if (globalIssues.length) console.log(`⚠ ${globalIssues.length} problème(s) de structure (voir a-verifier.md)`);
