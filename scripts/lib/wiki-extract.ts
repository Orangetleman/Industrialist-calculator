// Fonctions pures qui lisent le contenu brut des pages du wiki.
// Elles ne devinent rien : une valeur illisible renvoie null (ou une erreur explicite),
// et c'est build-data qui la signale dans a-verifier.md.

import type { GrowthBand, TreeGrowthFormula } from "../../src/engine/types.ts";
import type { LuaValue } from "./lua-literal.ts";

/** Identifiant stable : "Steel Ingot" → "steel-ingot", "Plank^2" → "plank-2". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SI: Record<string, number> = { "": 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };

/**
 * "4kMF" → 4000, "-1.25MMF" → -1 250 000, "15000MF" → 15000, "3488" → 3488.
 * Même logique que l'affichage du wiki (préfixes SI devant « MF »).
 * Renvoie null si le texte n'est pas une puissance simple.
 */
export function parseMamyflux(text: unknown): number | null {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  if (typeof text !== "string") return null;
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*([kKMGT]?)(?:MF)?(?:\/s)?\s*$/.exec(text.replace(/(\d),(\d{3})/g, "$1$2"));
  if (!m) return null;
  return Number(m[1]!.replace(",", ".")) * SI[m[2]!]!;
}

/** "150,000" → 150000 ; renvoie null si ce n'est pas un nombre seul. */
export function parseNumber(text: string | undefined): number | null {
  if (text === undefined) return null;
  const t = text.trim().replace(/,(?=\d{3}\b)/g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** "12x6" → { w: 12, l: 6 }. */
export function parseSize(text: string | undefined): { w: number; l: number } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(text ?? "");
  return m ? { w: Number(m[1]), l: Number(m[2]) } : null;
}

/** "0.216%/h" → 0.216 ; "0.05-0.29%/h" → [0.05, 0.29] ; "Depends on recipes" → null. */
export function parsePollution(text: string | undefined): number | [number, number] | null {
  const t = (text ?? "").trim();
  const one = /^(-?\d+(?:\.\d+)?)\s*%\s*\/\s*h$/i.exec(t);
  if (one) return Number(one[1]);
  const range = /^(-?\d+(?:\.\d+)?)\s*%?\s*-\s*(-?\d+(?:\.\d+)?)\s*%\s*\/\s*h$/i.exec(t);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return [Math.min(a, b), Math.max(a, b)];
  }
  return null;
}

/**
 * Lit les paramètres nommés d'un modèle (ex. {{Machine2 | Cost=409 | Size=4x2 }}).
 * Les modèles imbriqués ({{Money|5}}) sont conservés tels quels dans la valeur.
 */
export function parseTemplate(content: string, name: string): Record<string, string> | null {
  const start = new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?=[|}\\n])`).exec(content);
  if (!start) return null;
  // Trouve la fin en comptant les accolades doubles.
  let depth = 0;
  let i = start.index;
  let end = -1;
  while (i < content.length) {
    if (content.startsWith("{{", i)) {
      depth++;
      i += 2;
    } else if (content.startsWith("}}", i)) {
      depth--;
      i += 2;
      if (depth === 0) {
        end = i;
        break;
      }
    } else i++;
  }
  if (end < 0) return null;
  const body = content.slice(start.index + start[0].length, end - 2);
  // Découpe sur les « | » de premier niveau.
  const parts: string[] = [];
  let cur = "";
  let d = 0;
  for (let j = 0; j < body.length; j++) {
    if (body.startsWith("{{", j) || body.startsWith("[[", j)) {
      d++;
      cur += body.slice(j, j + 2);
      j++;
      continue;
    }
    if ((body.startsWith("}}", j) || body.startsWith("]]", j)) && d > 0) {
      d--;
      cur += body.slice(j, j + 2);
      j++;
      continue;
    }
    if (body[j] === "|" && d === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += body[j];
  }
  parts.push(cur);
  const out: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    out[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  }
  return out;
}

/** Tous les modèles {{Production|…}} d'une page (format Fandom). */
export function parseAllTemplates(content: string, name: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const re = new RegExp(`\\{\\{\\s*${name}\\s*\\|`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const t = parseTemplate(content.slice(m.index), name);
    if (t) out.push(t);
  }
  return out;
}

export type FandomRecipe = {
  machine: string;
  durationS: number | null;
  energyMFps: number | null;
  inputs: Record<string, number | null>;
  outputs: Record<string, number | null>;
  raw: Record<string, string>;
};

/** Convertit un {{Production}} de Fandom (clés insensibles à la casse, items en slug). */
export function fandomProduction(t: Record<string, string>): FandomRecipe | null {
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) p[k.toLowerCase()] = v;
  if (!p.machine) return null;
  const io = (kind: "input" | "output"): Record<string, number | null> => {
    const out: Record<string, number | null> = {};
    for (let i = 1; i <= 9; i++) {
      const item = p[`${kind}${i}`];
      if (!item) continue;
      out[slugify(item)] = parseNumber(p[`${kind}${i}amount`]);
    }
    return out;
  };
  return {
    machine: p.machine.trim(),
    durationS: parseNumber(p.time),
    energyMFps: parseMamyflux(p.mamyflux),
    inputs: io("input"),
    outputs: io("output"),
    raw: t,
  };
}

/** Retire le balisage wiki courant (gras, liens, modèles simples). */
export function stripWiki(text: string): string {
  return text
    .replace(/'''?/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{\s*Pollution\s*\|\s*(-?[\d.]+)\s*\}\}/gi, "$1%")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Tableau « Tree Growth » de la page Tree :
 *   | {{Pollution|51}} - {{Pollution|99}} | ~370s - ~689s
 *   | {{Pollution|100}}+ (Max)            | ~696s (Max)
 *   | {{Pollution|-149}}- (Min)           | ~696s (Max)
 */
export function parseTreeGrowth(content: string): GrowthBand[] {
  const start = content.search(/\|\+\s*Tree Growth/i);
  if (start < 0) return [];
  const end = content.indexOf("|}", start);
  const table = content.slice(start, end < 0 ? undefined : end);
  const rows = table.split(/\n\|-\s*\n/).slice(1);
  const bands: GrowthBand[] = [];
  for (const row of rows) {
    const cells = row
      .split("\n")
      .filter((l) => l.startsWith("|") && !l.startsWith("|-") && !l.startsWith("|+"))
      .map((l) => l.slice(1));
    if (cells.length < 2) continue;
    const pol = stripWiki(cells[0]!);
    const secs = stripWiki(cells[1]!);
    const nums = [...pol.matchAll(/-?\d+(?:\.\d+)?(?=%)/g)].map((x) => Number(x[0]));
    let minPct: number | null;
    let maxPct: number | null;
    if (nums.length >= 2) {
      minPct = Math.min(nums[0]!, nums[1]!);
      maxPct = Math.max(nums[0]!, nums[1]!);
    } else if (nums.length === 1) {
      const after = pol.slice(pol.indexOf("%") + 1).trim();
      if (after.startsWith("+")) {
        minPct = nums[0]!;
        maxPct = null;
      } else if (after.startsWith("-")) {
        minPct = null;
        maxPct = nums[0]!;
      } else {
        minPct = nums[0]!;
        maxPct = nums[0]!;
      }
    } else continue;
    const s = [...secs.matchAll(/(\d+(?:\.\d+)?)\s*s/g)].map((x) => Number(x[1]));
    if (!s.length) continue;
    bands.push({ minPct, maxPct, seconds: [s[0]!, s[1] ?? s[0]!], label: `${pol} → ${secs}` });
  }
  return bands;
}

export type RawResearchNode = {
  name: string;
  category: string;
  rp: number;
  buildings: string[];
  children: string[];
  reqItems: { item: string; amount: number }[];
};

/** Table `p` de Module:RS/Data → liste de nœuds. Lève une erreur si la forme est inattendue. */
export function researchNodes(p: LuaValue): RawResearchNode[] {
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("RS/Data : table de catégories attendue");
  const out: RawResearchNode[] = [];
  for (const [category, nodes] of Object.entries(p)) {
    if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) throw new Error(`RS/Data : catégorie ${category} illisible`);
    for (const [name, raw] of Object.entries(nodes)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`RS/Data : nœud ${name} illisible`);
      const n = raw as Record<string, LuaValue>;
      const list = (v: LuaValue | undefined): string[] => (Array.isArray(v) ? v.map(String) : []);
      const req = n.reqItems;
      const reqItems: { item: string; amount: number }[] = [];
      const reqList = Array.isArray(req) ? req : req ? [req] : [];
      for (const r of reqList) {
        if (r && typeof r === "object" && !Array.isArray(r)) {
          const rr = r as Record<string, LuaValue>;
          reqItems.push({ item: String(rr.Item), amount: Number(rr.Amount) });
        }
      }
      if (typeof n.RP !== "number") throw new Error(`RS/Data : RP manquant pour ${name}`);
      out.push({ name, category, rp: n.RP, buildings: list(n.Buildings), children: list(n.Nodes), reqItems });
    }
  }
  return out;
}

// ---------------------------------------------------------------- calculateur Desmos des arbres

/** Simplifie le LaTeX Desmos : retire \left, \right, espaces et barres obliques inverses. */
export function normalizeLatex(latex: string): string {
  return latex
    .split("\\left").join("")
    .split("\\right").join("")
    .split("\\cdot").join("*")
    .split("\\operatorname").join("")
    .split("\\le").join("<=")
    .replace(/\\/g, "")
    .replace(/\s+/g, "")
    .replace(/\{([a-z]+)\}\(/g, "$1("); // {ceil}( → ceil(
}

/** Remplace chaque nombre par « # » et renvoie la forme et les nombres, dans l'ordre. */
function shapeOf(expr: string): { shape: string; nums: number[] } {
  const nums: number[] = [];
  const shape = expr.replace(/-?\d+(?:\.\d+)?/g, (m) => {
    nums.push(Number(m));
    return "#";
  });
  return { shape, nums };
}

/**
 * Extrait les constantes de la formule de pousse des arbres depuis l'état Desmos.
 * Chaque expression attendue doit avoir exactement la forme connue, sinon une
 * erreur explicite est renvoyée : on n'applique jamais une formule mal comprise.
 */
export function desmosTreeFormula(state: unknown): { ok: true; value: Omit<TreeGrowthFormula, "source"> } | { ok: false; error: string } {
  const list = (state as { expressions?: { list?: { latex?: string }[] } })?.expressions?.list;
  if (!Array.isArray(list)) return { ok: false, error: "état Desmos sans liste d'expressions" };
  const exprs = list.map((e) => (typeof e.latex === "string" ? shapeOf(normalizeLatex(e.latex)) : null)).filter((e) => e !== null);
  const find = (what: string, test: (shape: string) => boolean): number[] => {
    const hits = exprs.filter((e) => test(e.shape));
    if (hits.length !== 1) throw new Error(`${what} : ${hits.length} expression(s) de la forme attendue, 1 attendue`);
    return hits[0]!.nums;
  };
  const exact = (template: string) => (s: string) => s === template;
  try {
    const [tick] = find("T_tick", exact("T_{ick}=#"));
    const [points] = find("P", exact("P=#*(##C_{andycanetree})"));
    const [logs] = find("L_og", exact("L_{og}=#+I_{gloocontroller}*(#-C_{andycanetree})"));
    const d = find("D(x)", exact("D(x)={x>#:#+#x#x^{#},x<#:#x+#,#}"));
    const m = find("M(x)", exact("M(x)=max(#,min(#,D(x)))"));
    const a = find("A(n)", (s) => /^A\(n\)=\{n<=#:#,#\+frac\{A\(n#\)(\+A\(n#\))*\}\{#\}\}$/.test(s));
    const g = find("y_avgDetailed", exact("y_{avgDetailed}=#*frac{#}{T_{ick}}*A(ceil(frac{P}{#*M(x)}))"));
    // a = [0, 0, 1, -7, -8, …, diviseur]
    const offsets = a.slice(3, -1).map((x) => -x);
    if (a[0] !== 0 || a[1] !== 0 || a[2] !== 1 || offsets.length !== a.at(-1)) throw new Error("A(n) : moyenne inattendue");
    // d = [0, a, b, c, 2, negBelow, slope, intercept, 1]
    if (d[0] !== 0 || d[4] !== 2 || d[8] !== 1) throw new Error("D(x) : forme inattendue");
    if (g[1] !== 1000) throw new Error("y_avgDetailed : facteur 1000 attendu");
    return {
      ok: true,
      value: {
        posCoefs: [d[1]!, d[2]!, d[3]!],
        negBelow: d[5]!,
        negSlope: d[6]!,
        negIntercept: d[7]!,
        clampMin: m[0]!,
        clampMax: m[1]!,
        points: points!,
        pointsDivisor: g[2]!,
        avgOffsets: offsets,
        cycleFactor: g[0]!,
        tickMs: tick!,
        logsPerTree: logs!,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

