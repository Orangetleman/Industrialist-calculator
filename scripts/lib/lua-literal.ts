// Parseur de tables Lua *littérales* (données des modules du wiki).
// Pas de VM : seules les constantes (chaînes, nombres, booléens, nil) et les tables
// sont acceptées. Tout le reste (appel de fonction, opérateur, variable) lève une
// LuaParseError avec la ligne, pour échouer explicitement plutôt que deviner.

export type LuaValue = string | number | boolean | null | LuaValue[] | { [key: string]: LuaValue };

export class LuaParseError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(`${message} (ligne ${line})`);
    this.name = "LuaParseError";
    this.line = line;
  }
}

class Parser {
  private pos: number;
  private readonly src: string;

  constructor(src: string, start: number) {
    this.src = src;
    this.pos = start;
  }

  line(at = this.pos): number {
    let n = 1;
    for (let i = 0; i < at && i < this.src.length; i++) if (this.src[i] === "\n") n++;
    return n;
  }

  fail(message: string): never {
    throw new LuaParseError(message, this.line());
  }

  /** Saute espaces et commentaires (`-- …`, `--[[ … ]]`, `--[==[ … ]==]`). */
  skip(): void {
    const s = this.src;
    for (;;) {
      while (this.pos < s.length && /\s/.test(s[this.pos]!)) this.pos++;
      if (s.startsWith("--", this.pos)) {
        const long = /^--\[(=*)\[/.exec(s.slice(this.pos, this.pos + 64));
        if (long) {
          const close = `]${long[1]}]`;
          const end = s.indexOf(close, this.pos + long[0].length);
          if (end < 0) this.fail("commentaire long non fermé");
          this.pos = end + close.length;
        } else {
          const end = s.indexOf("\n", this.pos);
          this.pos = end < 0 ? s.length : end + 1;
        }
        continue;
      }
      return;
    }
  }

  peek(): string {
    this.skip();
    return this.src[this.pos] ?? "";
  }

  expect(ch: string): void {
    if (this.peek() !== ch) this.fail(`« ${ch} » attendu, trouvé « ${this.src[this.pos] ?? "fin"} »`);
    this.pos++;
  }

  get offset(): number {
    return this.pos;
  }

  value(): LuaValue {
    const c = this.peek();
    if (c === "{") return this.table();
    if (c === '"' || c === "'") return this.quoted();
    if (c === "[") {
      const long = this.longString();
      if (long !== null) return long;
      this.fail("crochet inattendu");
    }
    if (c === "-" || c === "." || /[0-9]/.test(c)) return this.number();
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.src.slice(this.pos));
    if (word) {
      if (word[0] === "true" || word[0] === "false" || word[0] === "nil") {
        this.pos += word[0].length;
        return word[0] === "true" ? true : word[0] === "false" ? false : null;
      }
      this.fail(`expression non littérale « ${word[0]} »`);
    }
    this.fail(`valeur attendue, trouvé « ${c || "fin"} »`);
  }

  number(): number {
    const m = /^-?\s*(0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(this.src.slice(this.pos));
    if (!m) this.fail("nombre invalide");
    this.pos += m[0].length;
    const text = m[0].replace(/\s+/g, "");
    const n = /0x/i.test(text) ? (text.startsWith("-") ? -1 : 1) * parseInt(text.replace("-", ""), 16) : Number(text);
    if (!Number.isFinite(n)) this.fail(`nombre invalide « ${text} »`);
    // Un opérateur juste après (ex. `3 * 2`) n'est pas littéral.
    const next = this.peek();
    if (next && "+-*/%^".includes(next)) this.fail("expression arithmétique non supportée");
    return n;
  }

  quoted(): string {
    const q = this.src[this.pos]!;
    this.pos++;
    let out = "";
    const esc: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'", "\n": "\n" };
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === q) {
        this.pos++;
        return out;
      }
      if (ch === "\n") this.fail("chaîne non fermée");
      if (ch === "\\") {
        const nx = this.src[this.pos + 1] ?? "";
        const dec = /^\d{1,3}/.exec(this.src.slice(this.pos + 1));
        if (dec) {
          out += String.fromCharCode(Number(dec[0]));
          this.pos += 1 + dec[0].length;
          continue;
        }
        if (!(nx in esc)) this.fail(`échappement inconnu « \\${nx} »`);
        out += esc[nx];
        this.pos += 2;
        continue;
      }
      out += ch;
      this.pos++;
    }
    this.fail("chaîne non fermée");
  }

  longString(): string | null {
    const m = /^\[(=*)\[/.exec(this.src.slice(this.pos, this.pos + 64));
    if (!m) return null;
    const close = `]${m[1]}]`;
    const start = this.pos + m[0].length;
    const end = this.src.indexOf(close, start);
    if (end < 0) this.fail("chaîne longue non fermée");
    this.pos = end + close.length;
    return this.src.slice(start, end).replace(/^\r?\n/, "");
  }

  table(): LuaValue {
    this.expect("{");
    const positional: LuaValue[] = [];
    const keyed: Record<string, LuaValue> = {};
    let hasKeys = false;
    for (;;) {
      const c = this.peek();
      if (c === "}") {
        this.pos++;
        break;
      }
      let key: string | null = null;
      if (c === "[" && !/^\[=*\[/.test(this.src.slice(this.pos, this.pos + 8))) {
        this.pos++;
        const k = this.value();
        if (typeof k !== "string" && typeof k !== "number") this.fail("clé de table invalide");
        key = String(k);
        this.expect("]");
        this.expect("=");
      } else {
        const id = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(this.src.slice(this.pos));
        if (id) {
          key = id[1]!;
          this.pos += id[0].length;
        }
      }
      const v = this.value();
      if (key === null) positional.push(v);
      else {
        if (Object.hasOwn(keyed, key)) this.fail(`clé en double « ${key} »`);
        keyed[key] = v;
        hasKeys = true;
      }
      const sep = this.peek();
      if (sep === "," || sep === ";") {
        this.pos++;
        continue;
      }
      if (sep === "}") continue;
      this.fail(`« , » ou « } » attendu, trouvé « ${sep || "fin"} »`);
    }
    if (!hasKeys) return positional;
    positional.forEach((v, i) => {
      const k = String(i + 1);
      if (Object.hasOwn(keyed, k)) this.fail(`clé en double « ${k} »`);
      keyed[k] = v;
    });
    return keyed;
  }
}

/** Parse une valeur Lua littérale qui commence à `start`. */
export function parseLuaValue(src: string, start = 0): { value: LuaValue; end: number } {
  const p = new Parser(src, start);
  const value = p.value();
  return { value, end: p.offset };
}

/**
 * Extrait la table de données d'un module Lua :
 * - `return { … }` (modules de recettes),
 * - ou `local <nom> = { … }` si `localName` est fourni (ex. `p` dans RS/Data).
 * Le reste du module (fonctions, appels) est ignoré : seule la table est lue.
 */
export function extractModuleTable(src: string, localName?: string): LuaValue {
  const re = localName ? new RegExp(`(^|\\n)\\s*local\\s+${localName}\\s*=\\s*(?=\\{)`) : /(^|\n)\s*return\s*(?=\{)/;
  const m = re.exec(src);
  if (!m) throw new LuaParseError(localName ? `table « local ${localName} = { » introuvable` : "« return { » introuvable", 1);
  return parseLuaValue(src, m.index + m[0].length).value;
}
