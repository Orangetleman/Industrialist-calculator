// Extraction des données de l'extension (énergie, logistique, RP, monde) depuis le texte du wiki.
// Fonctions pures. Règle : on reconnaît une forme précise ou on renvoie null, jamais d'à-peu-près.

import { parseMamyflux } from "./wiki-extract.ts";

const num = (s: string) => Number(s.replace(/,/g, ""));

/** "7kMF/s" → 7000 ; "1.2MMF" → 1 200 000 ; null si ce n'est pas une puissance simple. */
export function parseMF(text: string | undefined): number | null {
  if (!text) return null;
  return parseMamyflux(text.trim().replace(/\s+/g, "").replace(/,(?=\d{3})/g, ""));
}

/**
 * Puissance seule ou plage : "7kMF/s" → 7000 ; "120MF/s - 240MF/s" → [120, 240] ;
 * "0-550MMF/s" → [0, 550e6] (le premier nombre prend l'unité du second).
 */
export function parsePowerRange(text: string | undefined): number | [number, number] | null {
  if (!text) return null;
  const t = text.trim();
  const single = parseMF(t);
  if (single !== null) return single;
  const m = /^([\d.,]+)\s*([kKMGT]?MF)?(?:\/s)?\s*[-–]\s*([\d.,]+)\s*([kKMGT]?MF)(?:\/s)?$/.exec(t);
  if (!m) return null;
  const a = parseMF(`${m[1]}${m[2] ?? m[4]}`);
  const b = parseMF(`${m[3]}${m[4]}`);
  return a === null || b === null ? null : [Math.min(a, b), Math.max(a, b)];
}

/** Débit ou capacité par nœud : "37.5kMF * 4" → { perNode: 37500, nodes: 4 } ; "3MMF/s" → nœuds 1. */
export function parsePerNode(text: string | undefined): { perNode: number; nodes: number } | null {
  if (!text) return null;
  const m = /^\s*([^*×x]+?)\s*(?:[*×]\s*(\d+))?\s*$/.exec(text.trim());
  if (!m) return null;
  const v = parseMF(m[1]!);
  return v === null ? null : { perNode: v, nodes: m[2] ? Number(m[2]) : 1 };
}

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, twenty: 20,
};

/** Portée d'un poteau, en tuiles, telle qu'écrite sur sa page. */
export function parseRangeTiles(content: string): { tiles: number; approx: boolean; quote: string } | null {
  const re = /(connection range of|with a range of|reach|radius of)\s+(approximately\s+)?(\d+|[a-z]+)\s+tiles/i;
  const m = re.exec(content);
  if (!m) return null;
  const raw = m[3]!.toLowerCase();
  const tiles = /^\d+$/.test(raw) ? Number(raw) : WORDS[raw];
  if (tiles === undefined) return null;
  return { tiles, approx: !!m[2], quote: m[0] };
}

// ---------------------------------------------------------------- tableaux de la page Pipes

export type PipeRow = {
  name: string;
  section: string;
  tier: number | null;
  kind: "objet" | "fluide" | "mixte";
  price: number | null;
  capacity: number | null;
  capacityRaw: string;
  flowPerSec: number | null;
  flowRaw: string;
  /** Dimensions en studs, telles que le wiki les donne. */
  sizeStuds: { w: number; l: number } | null;
  quote: string;
  gamepass: boolean;
  /** Le débit ou la capacité décrit plusieurs valeurs (entrée, sortie, dérivation…). */
  complex: boolean;
};

const stripWikiInline = (s: string) =>
  s
    .replace(/\{\{Money\|([^}]*)\}\}/g, "$1")
    .replace(/\{\{Tier\|\|(\d)\}\}/g, "T$1")
    .replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .trim();

/** Lit les lignes de tableau « | a || b || c… » de la page Pipes, section par section. */
export function parsePipeTables(content: string): PipeRow[] {
  const rows: PipeRow[] = [];
  let section = "";
  for (const line of content.split("\n")) {
    const tab = /\|-\|([^=]+)=/.exec(line); // « <tabber>|-|Tier I Pipes= » ou « |-|Tier III Pipes= »
    if (tab) {
      section = tab[1]!.trim();
      continue;
    }
    if (!line.startsWith("|") || /^\|[-+}]/.test(line) || line.startsWith("|style") || !line.includes("||")) continue;
    // Les « || » à l'intérieur d'un modèle ({{Tier||1}}) ne séparent pas les cellules.
    const masked = line.replace(/\{\{[^}]*\}\}/g, (m) => m.replace(/\|\|/g, "\u0001"));
    const cells = masked.slice(1).split("||").map((c) => c.replace(/\u0001/g, "||").trim());
    if (cells.length < 5) continue;
    const [rawName, rawPrice, rawCap, rawFlow, rawSize, rawQuote = ""] = cells;
    const tierInName = /\{\{Tier\|\|(\d)\}\}/.exec(rawName!);
    const tierInSection = /Tier\s+(I{1,3}|IV)\b/.exec(section);
    const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
    const name = stripWikiInline(rawName!).replace(/\s*\(T\d\)\s*/, "").replace(/\s*\((?:\[\[)?Gamepass(?:\]\])?\)\s*/i, "").trim();
    const capacityRaw = stripWikiInline(rawCap!);
    const flowRaw = stripWikiInline(rawFlow!);
    const hasUnits = /units?/i.test(capacityRaw);
    const hasLiters = /\d\s*L\b/.test(capacityRaw);
    const size = /(\d+)\s*x\s*(\d+)\s*studs/i.exec(rawSize!);
    const firstNum = (s: string) => {
      const m = /[\d][\d,]*(?:\.\d+)?/.exec(s);
      return m ? num(m[0]) : null;
    };
    rows.push({
      name,
      section,
      tier: tierInName ? Number(tierInName[1]) : tierInSection ? roman[tierInSection[1]!]! : null,
      kind: hasUnits && hasLiters ? "mixte" : hasLiters ? "fluide" : "objet",
      price: firstNum(stripWikiInline(rawPrice!)),
      capacity: firstNum(capacityRaw),
      capacityRaw,
      flowPerSec: firstNum(flowRaw),
      flowRaw,
      sizeStuds: size ? { w: Number(size[1]), l: Number(size[2]) } : null,
      quote: stripWikiInline(rawQuote).replace(/^"|"$/g, ""),
      gamepass: /Gamepass/i.test(rawName!),
      // (séparateurs de milliers retirés : « 12,000 » n'est pas une liste)
      complex: /,|\/.*\/|\(Small\)|&|input|output|bypass/i.test(`${capacityRaw} ${flowRaw}`.replace(/(\d),(\d{3})/g, "$1$2")),
    });
  }
  return rows;
}

// ---------------------------------------------------------------- formules des RP

export type Found<T> = { value: T; page: string; quote: string } | { value: null; page: string; problem: string };

function find<T>(page: string, content: string, re: RegExp, read: (m: RegExpExecArray) => T, what: string): Found<T> {
  const m = re.exec(content);
  if (!m) return { value: null, page, problem: `${what} : forme attendue introuvable` };
  return { value: read(m), page, quote: m[0] };
}

export type RpFormulas = {
  rs1: { rate: Found<"sqrt">; capCoef: Found<number> };
  rs2: { rateCoef: Found<number>; rateExp: Found<number>; capCoef: Found<number>; inputPerSec: Found<number> };
  rs3: { rateCoef: Found<number>; rateExp: Found<number>; capCoef: Found<number>; samePenalty: Found<number>; inputPerSecPerNode: Found<number> };
  satellite: { boostCoef: Found<number>; dishes: Found<"ceil(S+sqrt(S*R))">; liquidPerSec: Found<number> };
  softCap: { rs123: Found<"10^(1-x)">; rs4: Found<"10^(1-sqrt(x))">; x: Found<"max(RP/cap,1)"> };
  startRp: Found<{ normal: number; other: number }>;
};

const N = "(\\d+(?:\\.\\d+)?)";

/** Extrait les paramètres des formules RP des pages du wiki (texte brut des balises <math>). */
export function extractRpFormulas(pages: Record<string, string>): RpFormulas {
  const p = (t: string) => pages[t] ?? "";
  const rs1 = "Research Station1";
  const rs2 = "Research Station2";
  const rs3 = "Research Station3";
  const sat = "Satellite Dish Controller";
  const sys = "Research System";
  return {
    rs1: {
      rate: find(rs1, p(rs1), /\\text\{RP\/s\}=\\sqrt n/, () => "sqrt" as const, "RP/s = √n"),
      capCoef: find(rs1, p(rs1), new RegExp(`Cap\\}=${N}\\\\log_\\{2\\}\\(n\\+1\\)`), (m) => Number(m[1]), "plafond k·log₂(n+1)"),
    },
    rs2: {
      rateCoef: find(rs2, p(rs2), new RegExp(`\\\\text\\{RP/s\\}=${N} \\* n\\^\\{${N}\\}`), (m) => Number(m[1]), "RP/s = a·n^b"),
      rateExp: find(rs2, p(rs2), new RegExp(`\\\\text\\{RP/s\\}=${N} \\* n\\^\\{${N}\\}`), (m) => Number(m[2]), "RP/s = a·n^b"),
      capCoef: find(rs2, p(rs2), new RegExp(`Cap\\}=${N} \\* \\\\log_\\{2\\}\\(m \\+1\\)`), (m) => Number(m[1]), "plafond k·log₂(m+1)"),
      inputPerSec: find(rs2, p(rs2), new RegExp(`${N}u/s of any`), (m) => Number(m[1]), "consommation en u/s"),
    },
    rs3: {
      rateCoef: find(rs3, p(rs3), new RegExp(`\\\\text\\{RP/s\\}=${N}n\\^\\{${N}\\}`), (m) => Number(m[1]), "RP/s = a·n^b"),
      rateExp: find(rs3, p(rs3), new RegExp(`\\\\text\\{RP/s\\}=${N}n\\^\\{${N}\\}`), (m) => Number(m[2]), "RP/s = a·n^b"),
      capCoef: find(rs3, p(rs3), new RegExp(`RP Cap\\}=${N}\\*\\(log_2\\(C\\+1\\)\\+\\}\\\\sqrt\\{C \\)`), (m) => Number(m[1]), "plafond k·(log₂(C+1)+√C)"),
      samePenalty: find(rs3, p(rs3), /(\d+)% penalty[^.]*if both input/, (m) => Number(m[1]) / 100, "pénalité si les deux items sont identiques"),
      inputPerSecPerNode: find(rs3, p(rs3), new RegExp(`consuming ${N} units per second from each node`), (m) => Number(m[1]), "consommation par entrée"),
    },
    satellite: {
      boostCoef: find(sat, p(sat), new RegExp(`B \\\\times ${N}\\\\log\\(R \\+ 1\\)`), (m) => Number(m[1]), "bonus B·k·log(R+1)"),
      dishes: find(sat, p(sat), /\\lceil S \+ \\sqrt\{S \* R\} \\bigr \\rceil/, () => "ceil(S+sqrt(S*R))" as const, "nombre de paraboles"),
      liquidPerSec: find(sat, p(sat), new RegExp(`liquid \\(${N}L/s\\)`), (m) => Number(m[1]), "liquide consommé en L/s"),
    },
    softCap: {
      rs123: find(sys, p(sys), /\\text\{CurrentRPs\} \* 10 \^ \{1-x\}/, () => "10^(1-x)" as const, "décroissance RS1/2/3"),
      rs4: find(sys, p(sys), /\\text\{CurrentRPs\} \* 10 \^ \{1-\\sqrt\[\]\{x\}\}/, () => "10^(1-sqrt(x))" as const, "décroissance RS4"),
      x: find(sys, p(sys), /x = \\max\(\\frac\{\\text\{CurrentRP\}\}\{\\text\{RPCap\}\}, 1\)/, () => "max(RP/cap,1)" as const, "définition de x"),
    },
    startRp: find(
      sys,
      p(sys),
      /\{\{RP\|(\d+)\}\} for worlds on \{\{Difficulties\|Normal\}\}[\s\S]{0,80}?\{\{RP\|(\d+)\}\} for the other/,
      (m) => ({ normal: Number(m[1]), other: Number(m[2]) }),
      "RP de départ selon la difficulté",
    ),
  };
}

// ---------------------------------------------------------------- monde (jour, vapeur, logique, dépôts)

export type WorldFacts = {
  dayMinutes: Found<number>;
  sunrise: Found<number>;
  sunset: Found<number>;
  spawnHour: Found<number>;
  steamWaterIn: Found<number>;
  steamOut: Found<number>;
  steamLossPerConnection: Found<number>;
  logicTickSeconds: Found<number>;
  truckDepot: Found<{ capacity: number; cycleSeconds: number }>;
  scrubberMaxPerHour: Found<number>;
};

export function extractWorld(pages: Record<string, string>): WorldFacts {
  const p = (t: string) => pages[t] ?? "";
  const w = "Weather & Time";
  return {
    dayMinutes: find(w, p(w), /A day lasts around (\d+) minutes/, (m) => Number(m[1]), "durée du jour"),
    sunrise: find(w, p(w), /sun will rise at (\d+) and set at (\d+)/, (m) => Number(m[1]), "lever du soleil"),
    sunset: find(w, p(w), /sun will rise at (\d+) and set at (\d+)/, (m) => Number(m[2]), "coucher du soleil"),
    spawnHour: find(w, p(w), /spawns into the world is (\d+)/, (m) => Number(m[1]), "heure de départ"),
    steamWaterIn: find("Steam", p("Steam"), /rate of (\d+)L of \[\[Water\]\] -> (\d+)L of '''Steam'''/, (m) => Number(m[1]), "eau → vapeur"),
    steamOut: find("Steam", p("Steam"), /rate of (\d+)L of \[\[Water\]\] -> (\d+)L of '''Steam'''/, (m) => Number(m[2]), "eau → vapeur"),
    steamLossPerConnection: find("Steam", p("Steam"), /lose around \{\{Heat\|([\d.]+)\}\} for every connection/, (m) => Number(m[1]), "perte de chaleur par raccord"),
    logicTickSeconds: find("Logic", p("Logic"), /logic tick of delay built in \((\d+)\/(\d+)th a second/, (m) => Number(m[1]) / Number(m[2]), "tick logique"),
    truckDepot: find(
      "Truck Depot",
      p("Truck Depot"),
      /capacity of (\d+) items\. After it is filled, it will automatically sell all its contents and return after (\d+) seconds/,
      (m) => ({ capacity: Number(m[1]), cycleSeconds: Number(m[2]) }),
      "cycle du Truck Depot",
    ),
    scrubberMaxPerHour: find("Pollution", p("Pollution"), /remove up to \{\{Pollution\|([\d.]+)\}\}/, (m) => Number(m[1]), "pollution retirée par Scrubber"),
  };
}
