// S31 : test « rien d'oublié ». Deux contrôles :
//  1. le code des vues (src/ui) n'écrit plus de texte français en dur : chaque texte passe par t() ;
//  2. en anglais, les vues rendues avec les vraies données (comme vocabulaire.test.ts) ne montrent ni
//     lettre accentuée ni mot français courant. Les noms du jeu sont retirés avant. S32 : les textes du
//     moteur et les notes des données sont traduits et contrôlés comme le reste.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import interfacesJson from "../../data/interfaces.json";
import modularJson from "../../data/modular.json";
import indexHtml from "../../index.html?raw";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import { solve, type Plan } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { setLang } from "../i18n/i18n.ts";
import { renderStepCalc } from "./calc-view.ts";
import { buildRows, renderAnswer, renderBuildList, renderDetails, renderFlow, renderFlowHud, renderStepLinks, type ViewCtx } from "./plan-view.ts";
import { renderItemCard, renderMachineCard } from "./recipes-view.ts";
import { allVerifyEntries, renderVerify } from "./render.ts";
import { renderNodeBubble, renderNodeDetail } from "./research-view.ts";
import { DEFAULT_SETTINGS } from "./state.ts";

// ---------------------------------------------------------------- 1. le code

/**
 * Textes écrits dans un fichier TypeScript : chaînes et morceaux fixes des gabarits, avec leur ligne (commentaires et
 * expressions régulières sautés). `part` : morceau d'un gabarit collé à un ${…} (« ${n} résultat${s} »).
 */
function literals(src: string): { line: number; text: string; part?: boolean }[] {
  const out: { line: number; text: string; part?: boolean }[] = [];
  let i = 0;
  let line = 1;
  const stack: number[] = []; // profondeur d'accolades de chaque ${…} ouvert
  let depth = 0;
  let prev = ""; // dernier caractère significatif du code (pour reconnaître une expression régulière)
  const readTemplate = (afterExpr = false) => {
    // i est juste après ` ou après la } qui ferme un ${…}
    let buf = "";
    const start = line;
    while (i < src.length) {
      const c = src[i]!;
      if (c === "\\") {
        buf += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === "`") {
        i++;
        out.push({ line: start, text: buf, ...(afterExpr ? { part: true } : {}) });
        prev = "x";
        return;
      }
      if (c === "$" && src[i + 1] === "{") {
        i += 2;
        out.push({ line: start, text: buf, part: true });
        stack.push(depth);
        depth++;
        prev = "{";
        return;
      }
      if (c === "\n") line++;
      buf += c;
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i]!;
    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      line += (src.slice(i, end).match(/\n/g) ?? []).length;
      i = end + 2;
      continue;
    }
    if (c === "/" && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(prev)) {
      // expression régulière
      i++;
      let cls = false;
      while (i < src.length) {
        const d = src[i]!;
        if (d === "\\") i += 2;
        else if (d === "[") (cls = true), i++;
        else if (d === "]") (cls = false), i++;
        else if (d === "/" && !cls) break;
        else i++;
      }
      i++;
      while (/[a-z]/.test(src[i] ?? "")) i++;
      prev = "x";
      continue;
    }
    if (c === '"' || c === "'") {
      let buf = "";
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") {
          buf += src[i + 1];
          i += 2;
        } else buf += src[i++];
      }
      i++;
      out.push({ line, text: buf });
      prev = "x";
      continue;
    }
    if (c === "`") {
      i++;
      readTemplate();
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (stack.length && stack[stack.length - 1] === depth) {
        stack.pop();
        i++;
        readTemplate(true);
        continue;
      }
    }
    if (!/\s/.test(c)) prev = /[\w$)\]]/.test(c) ? "x" : c;
    // « return /…/ » : le mot-clé précède une expression régulière
    if (/[a-z]/.test(c) && src.startsWith("return", i) && !/[\w$]/.test(src[i - 1] ?? "")) {
      i += 6;
      prev = "(";
      continue;
    }
    i++;
  }
  return out;
}

const ACCENT = /[àâçéèêëîïôûùüÿœÀÂÇÉÈÊËÎÏÔÛÙÜŸŒ]/;
const FRENCH_WORDS = /(?:^|[^\p{L}])(le|la|les|des|du|un|une|pour|avec|dans|est|sont|ou|et|à|au|aux|sur|pas|ton|ta|tes|tu|ce|cette|ces|de|en|qui|que|ne|par|il|elle|clique|choisis)(?=[^\p{L}]|$)/iu;

/** Texte français écrit en dur ? Les clés du catalogue (« plan.goal.énergie ») et les identifiants internes ne comptent pas. */
function isFrenchText(raw: string, part = false): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/^[\p{L}\d_-]+(?:\.[\p{L}\d_-]+)+$/u.test(s)) return false; // clé du catalogue
  if (!part && /^[\p{L}\d_:@-]+$/u.test(s)) return false; // identifiant, chaîne entière (« énergie », « dépôt », « sous-produit-réutilisé »)
  // Le texte seul : sans balises, ni attributs techniques (class="rs-est"), ni morceaux de balise coupés par un
  // ${…} ; les infobulles (title, aria-label, placeholder, data-tip) restent contrôlées.
  const bare = s
    .replace(/(?<![\w-])(?!(?:title|aria-label|placeholder|data-tip|alt|label)=)[\w-]+="[^"]*"?/g, " ")
    .replace(/<[^>]*>?/g, " ")
    .replace(/^[^<>]*>/, " ")
    .replace(/&\w+;/g, " ");
  return ACCENT.test(bare) || FRENCH_WORDS.test(bare);
}

/**
 * Textes français permis dans le code des vues, par fichier (S32 : les lectures des phrases du moteur ont disparu) :
 * identifiants internes à plusieurs mots (codes du moteur et des données, gardés tels quels), et notes écrites dans
 * les fichiers exportés ou gardées avec une correction (traduites à l'affichage par data/i18n/en.json, section « site »).
 */
const ALLOWED: Record<string, (string | RegExp)[]> = {
  // Fichiers exportés et sources gardées avec une correction : restent en français (PLAN-PUBLIC.md § 2).
  "buildings-model.ts": [/^Relevés de bâtiments faits dans l'éditeur/, "relevé dans l'éditeur de bâtiments du calculateur"],
  "buildings.ts": ["correction notée dans l'éditeur de bâtiments du calculateur", "interface notée dans l'éditeur de bâtiments du calculateur"],
  "recipes-store.ts": [/^Images choisies dans la page Recettes/],
  "main.ts": ["description recopiée du jeu", "relevé en jeu (page Recettes)"],
  "state.ts": ["saisie dans le calculateur (relevé en jeu)", "n'existe pas en jeu (relevé du joueur)", "craft manquant, relevé en jeu par le joueur", "objet manquant, relevé en jeu par le joueur"],
  // Clés internes : signature d'un objectif, nœud d'un dépôt ou du réseau dans le schéma.
  "plan-view.ts": ["dépôt:", "réseau:"],
};
/** Codes du moteur et des données, permis partout. */
const ALL_ALLOWED: (string | RegExp)[] = ["machine écartée", "seulement à vérifier", "aucune recette", "les deux", "double rangée", "deux contrôleurs", "bloc manquant", "énergie|"];

/** Le code des vues (src/ui), sans les tests. */
const SOURCES = import.meta.glob<string>(["./*.ts", "!./*.test.ts"], { query: "?raw", import: "default", eager: true });

/** Textes et infobulles en français d'une page HTML qui ne portent pas leur clé (data-i18n, data-i18n-html, data-i18n-attr). */
function untaggedFrench(html: string): string[] {
  const found: string[] = [];
  const src = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<head>[\s\S]*?<\/head>/, "");
  // Pile des éléments ouverts : couvert si lui ou un parent porte data-i18n / data-i18n-html, ou lang="fr".
  const stack: boolean[] = [];
  const VOID = /^(input|br|img|meta|link|hr|source)$/i;
  for (const m of src.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    const [, close, tag, attrs = "", text] = m;
    if (text !== undefined) {
      if (!stack.at(-1) && isFrenchText(text)) found.push(text.trim().slice(0, 80));
      continue;
    }
    if (close) {
      stack.pop();
      continue;
    }
    const covered = !!stack.at(-1) || /\bdata-i18n(-html)?="/.test(attrs) || /\blang="fr"/.test(attrs);
    const keyed = new Set([...attrs.matchAll(/data-i18n-attr="([^"]*)"/g)].flatMap((a) => a[1]!.split(";").map((p) => p.split("=")[0]!.trim())));
    for (const a of attrs.matchAll(/\b(title|aria-label|placeholder|alt)="([^"]*)"/g)) {
      if (!covered && !keyed.has(a[1]!) && isFrenchText(a[2]!)) found.push(`${a[1]}="${a[2]!.slice(0, 70)}"`);
    }
    if (!VOID.test(tag!) && !attrs.trimEnd().endsWith("/")) stack.push(covered);
  }
  return found;
}

describe("rien d'oublié (S31) : le code", () => {
  it("le repérage des textes reconnaît chaînes, gabarits, commentaires et expressions régulières", () => {
    const src = 'const a = "Bonjour à toi"; // pas ça\nconst r = /déjà|suffit/;\nconst b = `x ${t("plan.goal.énergie")} y ${c ? `Tu as ${n} machines` : ""} z`;\n/* ni ça */ const d = \'énergie\';';
    expect(literals(src).map((l) => l.text)).toEqual(["Bonjour à toi", "x ", "plan.goal.énergie", " y ", "Tu as ", " machines", "", " z", "énergie"]);
    expect(literals(src).filter((l) => isFrenchText(l.text, l.part)).map((l) => l.line)).toEqual([1, 3]);
    expect(literals("const c = `${n} résultat${s}`;").filter((l) => isFrenchText(l.text, l.part)).map((l) => l.text)).toEqual([" résultat"]);
  });

  it("aucun texte français écrit en dur dans src/ui : tout passe par le catalogue", () => {
    const found: string[] = [];
    for (const [path, src] of Object.entries(SOURCES)) {
      const f = path.slice(2);
      const allowed = [...ALL_ALLOWED, ...(ALLOWED[f] ?? [])];
      for (const l of literals(src)) {
        if (!isFrenchText(l.text, l.part)) continue;
        if (allowed.some((a) => (typeof a === "string" ? a === l.text : a.test(l.text)))) continue;
        found.push(`${f}:${l.line} ${JSON.stringify(l.text.trim().slice(0, 90))}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("index.html : chaque texte français affiché porte sa clé (data-i18n, data-i18n-html, data-i18n-attr)", () => {
    expect(untaggedFrench(`<p>Bonjour à toi</p><p data-i18n="x">Salut à <b>toi</b></p><input placeholder="ex. un nom" data-i18n-attr="placeholder=y"><input title="Clique ici">`)).toEqual(["Bonjour à toi", 'title="Clique ici"']);
    expect(untaggedFrench(indexHtml)).toEqual([]);
  });
});

// ---------------------------------------------------------------- 2. les vues rendues, en anglais

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const fresh = { unlocked: new Set<string>(), pollutionPct: 0 };

/** Noms du jeu (objets, machines, recherches, installations) : ils restent en anglais, mais certains ont des accents ou des mots courts. */
const GAME_NAMES = [
  ...[...data.items.values()].map((x) => x.name),
  ...[...data.machines.values()].map((x) => x.name),
  ...[...data.nodes.values()].map((x) => x.name),
  ...[...data.recipes.values()].map((x) => (typeof x.setupName === "string" ? x.setupName : "")),
]
  .filter((n) => n.length > 2)
  .sort((a, b) => b.length - a.length);

/**
 * Ce que lit un joueur anglais, sans les noms du jeu. S32 : les textes du moteur et les notes des données sont
 * traduits, et comptent donc aussi (une note sans traduction, marquée « (FR) », ferait échouer le test).
 */
function visibleEn(html: string): string {
  const noFr = html.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, " "); // pastilles d'initiales (« Ce » pour Cement…)
  const tips = [...noFr.matchAll(/(?:title|data-tip|aria-label|placeholder)="([^"]*)"/g)].map((m) => m[1]!);
  const svgTitles = [...noFr.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]!);
  let text = [noFr.replace(/<[^>]+>/g, " "), ...tips, ...svgTitles].join(" ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  for (const n of GAME_NAMES) text = text.split(n).join(" ");
  return text;
}

/** Les morceaux de texte en français : phrase autour du mot trouvé. */
function frenchBits(text: string): string[] {
  const out = new Set<string>();
  for (const part of text.split(/\s{2,}|\n/)) {
    const s = part.trim();
    if (s && (ACCENT.test(s) || FRENCH_WORDS.test(s))) out.add(s.slice(0, 120));
  }
  return [...out];
}

const views = (plan: Plan): string[] => {
  const v: ViewCtx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet" };
  const out = [renderAnswer(v), renderBuildList(v, buildRows(v), new Set()), renderFlow(v)?.svg ?? "", renderDetails(v)];
  for (const s of plan.steps) {
    out.push(renderStepCalc(v, { data }, s.key));
    out.push(renderFlowHud(v, s.key, () => "depot"), renderStepLinks(v, s.key));
  }
  return out;
};

describe("rien d'oublié (S31) : les vues en anglais", () => {
  beforeAll(() => setLang("en"));
  afterAll(() => setLang("fr"));

  it("le test reconnaît du français et laisse passer l'anglais", () => {
    expect(frenchBits(visibleEn(`<p>Pour 60 Gear/min : 3 machines</p>`))).toHaveLength(1);
    expect(frenchBits(visibleEn(`<p>For 60 Gear/min: 3 machines</p>`))).toEqual([]);
    // Une note des données sans traduction (marquée « (FR) ») compte comme du français.
    expect(frenchBits(visibleEn(`<p>For 60 Gear/min: 3 machines</p> (FR) <span lang="fr">note pas encore traduite</span>`))).toHaveLength(1);
  });

  it("plans Crankshaft, Light Oil, Steel Plate (réponse, liste, schéma, détails, panneau de chaque bloc)", () => {
    for (const [item, rate] of [["crankshaft", 60], ["light-oil", 60], ["steel-plate", 30]] as const) {
      const plan = solve(data, all, { item, ratePerMin: rate, criterion: "area", tiers: false });
      expect(frenchBits(visibleEn(views(plan).join("  "))), item).toEqual([]);
    }
  });

  it("partie neuve (recherches manquantes)", () => {
    const plan = solve(data, fresh, { item: "crankshaft", ratePerMin: 60, criterion: "area", tiers: false });
    expect(frenchBits(visibleEn(views(plan).join("  ")))).toEqual([]);
  });

  it("valeurs à vérifier, fiches Recettes et arbre", () => {
    const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "area", tiers: false });
    const ctx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {} };
    const html = [renderVerify(ctx, { entries: allVerifyEntries(ctx), all: true })];
    // Une valeur composée (bâtiments d'une installation, « parts ») s'écrit avec ses noms, jamais « [object Object] ».
    expect(html[0]).not.toContain("[object");
    expect(html[0]).toContain("1/44 × Tree Farm Sprinkler");
    for (const id of ["crankshaft", "gear", "oak-log", "light-oil", "water"]) html.push(renderItemCard({ data }, id));
    for (const id of ["blast-furnace", "water-pump2", "coal-generator", "craft-assembler"]) html.push(renderMachineCard({ data }, id));
    const p = { unlocked: new Set<string>() };
    for (const id of ["water-pump-2", "research-station-4", "foundry"]) {
      html.push(renderNodeDetail(data, p, id, 1000), renderNodeBubble(data, p, id, 1000));
    }
    expect(frenchBits(visibleEn(html.join("  ")))).toEqual([]);
  });
});
