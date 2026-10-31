/**
 * Schémas au format .msch de Mindustry (lot S54, R25), lus et écrits sans dépendance.
 *
 * Disposition (Mindustry, `Schematics.write`) : « msch », un octet de version (1), puis le reste compressé en zlib :
 * largeur et hauteur (int16), étiquettes (un octet de nombre, puis clé et valeur en UTF Java), table des noms de
 * bâtiments (un octet de nombre, puis chaque nom), nombre de cases (int32), puis par case : indice du nom (octet),
 * position `Point2.pack` ((x << 16) | y), réglage (`TypeIO.writeObject` : 0 rien, 4 texte) et rotation (octet).
 * Le code à copier est ce fichier en base64, comme le presse-papiers de Mindustry.
 *
 * Différences assumées : les noms sont ceux d'Industrialist (Mindustry n'ouvrira pas ces fichiers) ; la position est
 * le coin haut-gauche du bâtiment ; le réglage est un texte JSON (recette choisie, côtés ouverts, voies d'un
 * croisement) ; câbles et liaisons vont dans les étiquettes `wires` et `routes`, en indices de cases.
 */
import type { Dir } from "../sandbox/catalog";
import type { CrossPair, Layout, Placed, Route, Wire } from "../sandbox/layout";

export type Schematic = { name: string; description: string; labels: string[]; width: number; height: number; layout: Layout };

const MAGIC = [0x6d, 0x73, 0x63, 0x68]; // « msch »
const VERSION = 1;

/** UTF « modifié » de Java : longueur en int16 puis UTF-8 (le caractère nul s'écrit sur deux octets). */
function utf(s: string): number[] {
  const out: number[] = [];
  for (const b of new TextEncoder().encode(s)) out.push(b);
  const z: number[] = [];
  for (const b of out) b === 0 ? z.push(0xc0, 0x80) : z.push(b);
  if (z.length > 0xffff) throw new Error("schematic: text too long");
  return [z.length >> 8, z.length & 0xff, ...z];
}

class Writer {
  b: number[] = [];
  u8(v: number) { this.b.push(v & 0xff); }
  i16(v: number) { this.b.push((v >> 8) & 0xff, v & 0xff); }
  i32(v: number) { this.b.push((v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }
  str(s: string) { this.b.push(...utf(s)); }
}

class Reader {
  p = 0;
  d: Uint8Array;
  constructor(d: Uint8Array) { this.d = d; }
  u8() { if (this.p >= this.d.length) throw new Error("schematic: truncated"); return this.d[this.p++]!; }
  i16() { const v = (this.u8() << 8) | this.u8(); return v & 0x8000 ? v - 0x10000 : v; }
  i32() { return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) | 0; }
  str() {
    const n = (this.u8() << 8) | this.u8(), raw: number[] = [];
    for (let i = 0; i < n; i++) raw.push(this.u8());
    const z: number[] = [];
    for (let i = 0; i < raw.length; i++) raw[i] === 0xc0 && raw[i + 1] === 0x80 ? (z.push(0), i++) : z.push(raw[i]!);
    return new TextDecoder().decode(new Uint8Array(z));
  }
}

async function pipe(data: Uint8Array, s: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Response(data as Uint8Array<ArrayBuffer>).body!.pipeThrough(s));
  return new Uint8Array(await out.arrayBuffer());
}

type Cfg = { c?: string; o?: Dir[]; p?: CrossPair };

/** Écrit un schéma en octets .msch. Les bâtiments sont décalés pour que le coin du montage soit en (0, 0). */
export async function writeMsch(s: Schematic): Promise<Uint8Array> {
  const bl = s.layout.blocks, x0 = Math.min(0, ...bl.map((b) => b.x)), y0 = Math.min(0, ...bl.map((b) => b.y));
  const names = [...new Set(bl.map((b) => b.id))];
  if (names.length > 255) throw new Error("schematic: too many block kinds");
  const idx = new Map(bl.map((b, i) => [b.u, i]));
  const re = <T extends { a: number; b: number }>(l: T[]) => l.filter((w) => idx.has(w.a) && idx.has(w.b)).map((w) => ({ ...w, a: idx.get(w.a)!, b: idx.get(w.b)! }));
  const tags: [string, string][] = [["name", s.name], ["description", s.description], ["labels", JSON.stringify(s.labels)]];
  if (s.layout.wires.length) tags.push(["wires", JSON.stringify(re(s.layout.wires))]);
  if (s.layout.routes?.length) tags.push(["routes", JSON.stringify(re(s.layout.routes))]);
  const w = new Writer();
  w.i16(s.width); w.i16(s.height);
  w.u8(tags.length);
  for (const [k, v] of tags) { w.str(k); w.str(v); }
  w.u8(names.length);
  for (const n of names) w.str(n);
  w.i32(bl.length);
  for (const b of bl) {
    w.u8(names.indexOf(b.id));
    w.i32(((b.x - x0) << 16) | ((b.y - y0) & 0xffff));
    const cfg: Cfg = {};
    if (b.choice) cfg.c = b.choice;
    if (b.open?.length) cfg.o = b.open;
    if (b.pair) cfg.p = b.pair;
    if (Object.keys(cfg).length) { w.u8(4); w.u8(1); w.str(JSON.stringify(cfg)); } else w.u8(0);
    w.u8(b.r);
  }
  const body = await pipe(new Uint8Array(w.b), new CompressionStream("deflate"));
  const out = new Uint8Array(5 + body.length);
  out.set(MAGIC); out[4] = VERSION; out.set(body, 5);
  return out;
}

/** Lit des octets .msch. Les bâtiments reçoivent les numéros 0, 1, 2… dans l'ordre du fichier. */
export async function readMsch(data: Uint8Array): Promise<Schematic> {
  if (data.length < 5 || MAGIC.some((m, i) => data[i] !== m)) throw new Error("schematic: not a .msch file");
  if (data[4]! > VERSION) throw new Error("schematic: unknown version");
  const r = new Reader(await pipe(data.subarray(5), new DecompressionStream("deflate")));
  const width = r.i16(), height = r.i16(), tags = new Map<string, string>();
  for (let n = r.u8(); n > 0; n--) tags.set(r.str(), r.str());
  const names: string[] = [];
  for (let n = r.u8(); n > 0; n--) names.push(r.str());
  const blocks: Placed[] = [];
  for (let n = r.i32(), u = 0; u < n; u++) {
    const id = names[r.u8()];
    if (id === undefined) throw new Error("schematic: unknown block index");
    const pos = r.i32(), t = r.u8();
    let cfg: Cfg = {};
    if (t === 4) { if (r.u8()) cfg = JSON.parse(r.str()); } else if (t !== 0) throw new Error("schematic: unsupported config");
    const b: Placed = { u, id, x: pos >> 16, y: (pos << 16) >> 16, r: r.u8() };
    if (cfg.c) b.choice = cfg.c;
    if (cfg.o) b.open = cfg.o;
    if (cfg.p) b.pair = cfg.p;
    blocks.push(b);
  }
  const json = <T>(k: string): T[] => (tags.has(k) ? JSON.parse(tags.get(k)!) : []);
  const routes = json<Route>("routes");
  return {
    name: tags.get("name") ?? "", description: tags.get("description") ?? "", labels: json<string>("labels"), width, height,
    layout: { blocks, wires: json<Wire>("wires"), ...(routes.length ? { routes } : {}) },
  };
}

/** Code à copier : le fichier .msch en base64, comme Mindustry. */
export async function toCode(s: Schematic): Promise<string> {
  let t = "";
  for (const b of await writeMsch(s)) t += String.fromCharCode(b);
  return btoa(t);
}

export async function fromCode(code: string): Promise<Schematic> {
  const t = atob(code.trim());
  return readMsch(Uint8Array.from(t, (c) => c.charCodeAt(0)));
}
