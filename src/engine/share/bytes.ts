// Octets du format de partage (PLAN-PARTAGE.md § 2) : varint, zigzag, nombres exacts, chaînes par table.
// Pur, sans DOM. Toute lecture hors des octets lève une ShareError « abîmé » (jamais de valeur devinée).

export type ShareErrorCode = "version-future" | "abîmé" | "pas-un-lien";

/** Lien ou fichier refusé : `code` se traduit dans l'interface (P2). */
export class ShareError extends Error {
  readonly code: ShareErrorCode;
  constructor(code: ShareErrorCode, detail = "") {
    super(detail ? `${code} : ${detail}` : code);
    this.code = code;
  }
}

/** Entiers écrits en varint : |n| < 2^48 (au-delà, un nombre part en float64). */
const SMALL = 2 ** 48;

const zz = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1);
const unzz = (v: number) => (v % 2 === 0 ? v / 2 : -(v + 1) / 2);

export class Writer {
  private buf = new Uint8Array(256);
  private n = 0;
  /** Chaînes déjà écrites, par rang (la table figée d'abord, puis les nouvelles dans l'ordre). */
  private strs: Map<string, number>;
  private next: number;

  constructor(table: readonly string[]) {
    this.strs = new Map();
    table.forEach((s, i) => { if (!this.strs.has(s)) this.strs.set(s, i); });
    this.next = table.length;
  }

  private room(k: number) {
    if (this.n + k <= this.buf.length) return;
    const b = new Uint8Array(Math.max(this.buf.length * 2, this.n + k));
    b.set(this.buf.subarray(0, this.n));
    this.buf = b;
  }

  bytes(): Uint8Array {
    return this.buf.slice(0, this.n);
  }

  u8(v: number) {
    this.room(1);
    this.buf[this.n++] = v & 0xff;
  }

  /** Entier ≥ 0 jusqu'à 2^53, 7 bits par octet. */
  uv(v: number) {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`share: varint ${v}`);
    while (v >= 0x80) {
      this.u8((v % 0x80) | 0x80);
      v = Math.floor(v / 0x80);
    }
    this.u8(v);
  }

  sv(v: number) {
    this.uv(zz(v));
  }

  f64(x: number) {
    this.room(8);
    new DataView(this.buf.buffer, this.n, 8).setFloat64(0, x, true);
    this.n += 8;
  }

  /**
   * Nombre exact, ou null : un varint dont les 2 bits du bas disent la forme. 0 entier, 1 quarts (x × 4 entier),
   * 2 float64 brut à suivre (tout le reste : décimaux, -0, très grands, NaN, infinis), 3 null. Aucun arrondi.
   */
  num(x: number | null) {
    if (x === null) return this.uv(3);
    if (Number.isInteger(x) && Math.abs(x) < SMALL && !Object.is(x, -0)) return this.uv(zz(x) * 4);
    const q = x * 4;
    if (Number.isInteger(q) && Math.abs(q) < SMALL && q / 4 === x && !Object.is(x, -0)) return this.uv(zz(q) * 4 + 1);
    this.uv(2);
    this.f64(x);
  }

  bool(b: boolean) {
    this.u8(b ? 1 : 0);
  }

  /** Chaîne : 0 puis le texte (UTF-8) la première fois, rang + 1 ensuite (ou rang dans la table figée). */
  str(s: string) {
    const k = this.strs.get(s);
    if (k !== undefined) return this.uv(k + 1);
    this.uv(0);
    const b = new TextEncoder().encode(s);
    this.uv(b.length);
    this.room(b.length);
    this.buf.set(b, this.n);
    this.n += b.length;
    this.strs.set(s, this.next++);
  }
}

export class Reader {
  private p = 0;
  private readonly d: Uint8Array;
  private readonly strs: string[];

  constructor(d: Uint8Array, table: readonly string[]) {
    this.d = d;
    this.strs = [...table];
  }

  get done(): boolean {
    return this.p === this.d.length;
  }

  /** Octets restants : borne tout nombre d'éléments annoncé (un lien abîmé n'alloue pas des milliards de cases). */
  count(): number {
    const n = this.uv();
    if (n > this.d.length - this.p) throw new ShareError("abîmé", "nombre d'éléments");
    return n;
  }

  u8(): number {
    if (this.p >= this.d.length) throw new ShareError("abîmé", "trop court");
    return this.d[this.p++]!;
  }

  uv(): number {
    let v = 0, mul = 1;
    for (;;) {
      const b = this.u8();
      v += (b & 0x7f) * mul;
      if (!(b & 0x80)) break;
      mul *= 0x80;
      if (mul > 2 ** 56) throw new ShareError("abîmé", "varint");
    }
    if (!Number.isSafeInteger(v)) throw new ShareError("abîmé", "varint");
    return v;
  }

  sv(): number {
    return unzz(this.uv());
  }

  f64(): number {
    if (this.p + 8 > this.d.length) throw new ShareError("abîmé", "trop court");
    const x = new DataView(this.d.buffer, this.d.byteOffset + this.p, 8).getFloat64(0, true);
    this.p += 8;
    return x;
  }

  num(): number | null {
    const v = this.uv(), kind = v % 4, k = unzz((v - kind) / 4);
    if (kind === 0) return k;
    if (kind === 1) return k / 4;
    if (v === 2) return this.f64();
    if (v === 3) return null;
    throw new ShareError("abîmé", "nombre");
  }

  /** Nombre qui ne peut pas être null. */
  num1(): number {
    const x = this.num();
    if (x === null) throw new ShareError("abîmé", "nombre absent");
    return x;
  }

  bool(): boolean {
    const b = this.u8();
    if (b > 1) throw new ShareError("abîmé", "booléen");
    return b === 1;
  }

  str(): string {
    const k = this.uv();
    if (k > 0) {
      const s = this.strs[k - 1];
      if (s === undefined) throw new ShareError("abîmé", "chaîne inconnue");
      return s;
    }
    const n = this.count();
    let s: string;
    try {
      s = new TextDecoder("utf-8", { fatal: true }).decode(this.d.subarray(this.p, this.p + n));
    } catch {
      throw new ShareError("abîmé", "texte");
    }
    this.p += n;
    this.strs.push(s);
    return s;
  }
}


// ---------------------------------------------------------------- deflate-raw et base64url

async function pipe(data: Uint8Array, s: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Response(data as Uint8Array<ArrayBuffer>).body!.pipeThrough(s));
  return new Uint8Array(await out.arrayBuffer());
}

export const deflate = (d: Uint8Array) => pipe(d, new CompressionStream("deflate-raw"));

export async function inflate(d: Uint8Array): Promise<Uint8Array> {
  try {
    return await pipe(d, new DecompressionStream("deflate-raw"));
  } catch {
    throw new ShareError("abîmé", "compression");
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** base64url sans « = » (sûr dans une URL, rien à échapper). */
export function toBase64url(d: Uint8Array): string {
  let s = "";
  for (let i = 0; i < d.length; i += 3) {
    const a = d[i]!, b = d[i + 1], c = d[i + 2];
    s += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) s += B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) s += B64[c & 63]!;
  }
  return s;
}

export function fromBase64url(s: string): Uint8Array {
  if (s.length % 4 === 1) throw new ShareError("abîmé", "base64");
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0, acc = 0, bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new ShareError("abîmé", "base64");
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}
