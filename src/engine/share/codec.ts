// Codec du partage par lien (PLAN-PARTAGE.md § 2, lot P1) : un « design » (réglages + graphe édité + bac à
// sable + usine figée facultative) ↔ octets binaires v1 ↔ lien `#d=1.<base64url>`. Pur, sans DOM.
//
// Octets d'un design : [version = 1] puis le corps compressé en deflate-raw. Corps :
//   drapeaux (varint) · version du site · [nom] · réglages · [graphe édité] · [bac à sable] · [usine figée] · [empreinte] · [profil] · [moteur]
// Réglages : bitmap de présence sur la liste figée `SETTINGS_V1`, puis seulement les champs ≠ défaut v1.
// Graphe : ids `nN` → N, liens vers les nœuds par rang, ids d'arête reconstruits (`edgeId`), coordonnées en
// delta quand c'est exact. Bac à sable : rotation et présences dans un octet, `u` et coordonnées en delta.
// Chaque replis (id non canonique, delta inexact…) est prévu : l'aller-retour redonne toujours le même objet.
//
// Le graphe n'est que LU (types de `engine/graph` ; `GraphEdit` de `ui/graph-edit` recopié ici en structure) : si son format change, on ajoute une
// version du format ici, sans toucher à leur code (§ 7).

import { edgeId, type Graph, type GraphEdge, type GraphGroup, type GraphNode } from "../graph/model.ts";
import type { CrossPair, Layout, Placed, Route, Wire } from "../sandbox/layout.ts";
import type { Dir } from "../sandbox/catalog.ts";
import { deflate, fromBase64url, inflate, Reader, ShareError, toBase64url, Writer } from "./bytes.ts";
import { NODES_V1 } from "./nodes-v1.ts";
import { PRINT } from "./print.ts";
import { TABLE_V1 } from "./table-v1.ts";
import { version as PKG_VERSION } from "../../../package.json";

export { ShareError, type ShareErrorCode } from "./bytes.ts";

/** Version du site (package.json) qui écrit le design. */
export const SITE_VERSION: string = PKG_VERSION;
/** Version du moteur de génération (code du calcul et données du jeu, vite.config.ts), à part de celle du site : 8 chiffres hexadécimaux. */
declare const __FACTORY_VERSION__: string;
export const ENGINE_VERSION: string = typeof __FACTORY_VERSION__ === "string" ? __FACTORY_VERSION__.slice(0, 8) : "00000000";
const ENGINE = /^[0-9a-f]{8}$/;
export const SHARE_VERSION = 1;

/**
 * Ce qu'un lien ou un fichier `.indus` transporte. `factory` : l'usine figée telle que calculée chez l'auteur
 * (seulement dans le fichier, case « Inclure l'usine figée »), au format du bac à sable.
 */
/** Réglages du site (`Settings` de `ui/state.ts`) : le moteur n'importe pas l'interface, il les voit en objet. */
export type DesignSettings = Record<string, unknown>;

/** Même forme que `GraphEdit` (`ui/graph-edit.ts`) : un `GraphEdit` s'y range tel quel. */
export type DesignGraph = { sig: string; graph: Graph; solved: Graph | null; touched: boolean; links?: Record<string, string>; linksFor?: string };

export type Design = {
  site: string;
  /** Version du moteur qui a calculé le design (`ENGINE_VERSION`). */
  engine?: string;
  name?: string;
  settings: DesignSettings;
  graph?: DesignGraph;
  sandbox?: Layout;
  factory?: Layout;
  /** Empreinte du plan et de l'usine chez l'auteur (P3, `print.ts`) : 16 chiffres hexadécimaux, 8 octets dans le lien. */
  print?: string;
  /** Profil de l'auteur (P3 bis), si le lien le porte. */
  profile?: DesignProfile;
};

/**
 * Le profil de l'auteur : de quoi recalculer chez lui ce qu'il voit. `player` : « Ma partie » (`PlayerInfo` de
 * `ui/progress.ts`, vu en objet). Les autres champs (corrections, relevés) n'y sont que s'ils ne sont pas vides.
 */
export type DesignProfile = {
  /** Recherches et « Ma partie », ensemble ; absents : le lien ne porte que les contributions. */
  progress?: { unlocked: string[]; reqItemsDone: string[]; owned: string[] };
  player?: Record<string, unknown>;
  /** L'auteur a des contributions qu'il n'a pas mises dans le lien. */
  partial?: true;
  corrections?: unknown;
  surveys?: unknown;
  interfaces?: unknown;
  diesel?: unknown;
};

// ---------------------------------------------------------------- réglages : défauts figés de la v1

/**
 * Champs des réglages et leur valeur par défaut, figés pour la v1 (copie de `DEFAULT_SETTINGS` au 2026-11-24).
 * Un lien ne porte que les champs qui diffèrent : changer un défaut du site ne doit pas changer ce qu'un ancien
 * lien veut dire, d'où cette copie. Un nouveau champ de `Settings` s'ajoute EN FIN (le test le rappelle).
 */
export const SETTINGS_V1: readonly (readonly [string, unknown])[] = [
  ["goal", "objet"],
  ["entered", []],
  ["item", "crankshaft"],
  ["mode", "rate"],
  ["rateUnit", "s"],
  ["rate", 60],
  ["machines", 15],
  ["criteria", { objet: ["area", "machines", "energy", "cost", "pollution", "raw", "steps"], argent: ["machines", "energy", "cost", "pollution", "area", "raw"], énergie: ["machines", "cost", "raw", "pollution", "area"], recherche: ["machines", "energy", "cost"] }],
  ["useUnverified", false],
  ["forced", {}],
  ["fixed", null],
  ["machineFilters", {}],
  ["machineSettings", {}],
  ["dieselChoice", {}],
  ["mineshaftChoice", {}],
  ["imports", {}],
  ["evacSides", {}],
  ["money", 10000],
  ["selfPowered", false],
  ["maxPollution", null],
  ["useBudget", false],
  ["existing", {}],
  ["useExisting", true],
  ["resultTab", "pose"],
  ["energyUnit", "k"],
  ["energyMFps", 1_000_000],
  ["energyGuaranteed", false],
  ["energyNoFuel", false],
  ["distanceTiles", null],
  ["tier3Only", false],
  ["posePriority", ["place", "forme", "prix", "pieces"]],
  ["usine", { full: false, glue: false, detail: false, power: true, plugs: false, links: false }],
  ["rpMode", "node"],
  ["rpRate", null],
  ["rpNode", null],
  ["rpMinutes", 60],
  ["rpCap", null],
  ["rpSatellites", true],
  ["rpLogic", false],
  ["rpCurrent", true],
];

/** Égalité en profondeur (valeurs JSON, -0 ≠ 0, ordre des clés indifférent, clé à undefined ≠ clé absente). */
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => same(x, (b as unknown[])[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

// ---------------------------------------------------------------- valeur quelconque (JSON)

const V_NULL = 0, V_FALSE = 1, V_TRUE = 2, V_NUM = 3, V_STR = 4, V_ARR = 5, V_OBJ = 6, V_UNDEF = 7;

function wValue(w: Writer, v: unknown): void {
  if (v === null) return w.u8(V_NULL);
  if (v === undefined) return w.u8(V_UNDEF);
  if (v === false) return w.u8(V_FALSE);
  if (v === true) return w.u8(V_TRUE);
  if (typeof v === "number") return w.u8(V_NUM), w.num(v);
  if (typeof v === "string") return w.u8(V_STR), w.str(v);
  if (Array.isArray(v)) {
    w.u8(V_ARR);
    w.uv(v.length);
    for (const x of v) wValue(w, x);
    return;
  }
  if (typeof v === "object") {
    const e = Object.entries(v);
    w.u8(V_OBJ);
    w.uv(e.length);
    for (const [k, x] of e) {
      w.str(k);
      wValue(w, x);
    }
    return;
  }
  throw new Error(`share: valeur non transportable (${typeof v})`);
}

function rValue(r: Reader, depth = 0): unknown {
  if (depth > 64) throw new ShareError("abîmé", "trop imbriqué");
  const t = r.u8();
  switch (t) {
    case V_NULL: return null;
    case V_UNDEF: return undefined;
    case V_FALSE: return false;
    case V_TRUE: return true;
    case V_NUM: return r.num1();
    case V_STR: return r.str();
    case V_ARR: {
      const n = r.count(), out: unknown[] = [];
      for (let i = 0; i < n; i++) out.push(rValue(r, depth + 1));
      return out;
    }
    case V_OBJ: {
      const n = r.count(), out: Record<string, unknown> = {};
      for (let i = 0; i < n; i++) {
        const k = r.str();
        // defineProperty : une clé « __proto__ » reste une clé comme une autre.
        Object.defineProperty(out, k, { value: rValue(r, depth + 1), enumerable: true, writable: true, configurable: true });
      }
      return out;
    }
  }
  throw new ShareError("abîmé", "valeur");
}

// ---------------------------------------------------------------- réglages

type Fields = readonly (readonly [string, unknown])[];

function wSettings(w: Writer, s: DesignSettings, list: Fields = SETTINGS_V1): void {
  const fields = list.map(([k, d]) => [k, Object.hasOwn(s, k) && !same(s[k], d)] as const);
  w.uv(fields.length);
  for (let i = 0; i < fields.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8 && i + j < fields.length; j++) if (fields[i + j]![1]) b |= 1 << j;
    w.u8(b);
  }
  for (const [k, on] of fields) if (on) wValue(w, s[k]);
  // Champs absents (réglages d'un autre âge) et champs inconnus de la v1 : écrits à part, tels quels.
  const missing = list.filter(([k]) => !Object.hasOwn(s, k)).map(([k]) => k as string);
  const known = new Set(list.map(([k]) => k as string));
  const extra = Object.entries(s).filter(([k]) => !known.has(k));
  w.uv(missing.length);
  for (const k of missing) w.str(k);
  w.uv(extra.length);
  for (const [k, v] of extra) {
    w.str(k);
    wValue(w, v);
  }
}

function rSettings(r: Reader, list: Fields = SETTINGS_V1): DesignSettings {
  const n = r.uv();
  if (n > list.length) throw new ShareError("abîmé", "réglages");
  const bits: boolean[] = [];
  for (let i = 0; i < n; i += 8) {
    const b = r.u8();
    for (let j = 0; j < 8 && i + j < n; j++) bits.push(!!(b & (1 << j)));
  }
  const out: Record<string, unknown> = {};
  list.forEach(([k, d], i) => (out[k] = bits[i] ? rValue(r) : structuredClone(d)));
  for (let m = r.count(); m > 0; m--) delete out[r.str()];
  for (let m = r.count(); m > 0; m--) {
    const k = r.str();
    Object.defineProperty(out, k, { value: rValue(r), enumerable: true, writable: true, configurable: true });
  }
  return out as DesignSettings;
}

// ---------------------------------------------------------------- graphe

const NODE_ID = /^n([1-9]\d{0,14})$/;
// Drapeaux du graphe.
const G_IDS = 1, G_EDGE_IDS = 2, G_TARGET = 4, G_GROUPS = 8, G_DELTA = 16;
// Tri-états des nœuds : rien, false, true (deux bits chacun).
const tri = (v: boolean | undefined, present: boolean) => (!present ? 0 : v === true ? 2 : v === false ? 1 : 3);

/** Coordonnées en delta : seulement si chaque delta se ré-additionne exactement (sinon absolues). */
function deltasExact(points: { x: number; y: number }[]): boolean {
  let px = 0, py = 0;
  for (const p of points) {
    if (!Object.is(px + (p.x - px), p.x) || !Object.is(py + (p.y - py), p.y)) return false;
    px = p.x;
    py = p.y;
  }
  return true;
}

function wGraph(w: Writer, g: Graph): void {
  const ids = g.nodes.map((n) => NODE_ID.exec(n.id));
  const canonIds = ids.every(Boolean) && new Set(g.nodes.map((n) => n.id)).size === g.nodes.length;
  const canonEdges = g.edges.every((e) => e.id === edgeId(e.from, e.to, e.item));
  const delta = deltasExact(g.nodes);
  const idx = new Map<string, number>();
  g.nodes.forEach((n, i) => { if (!idx.has(n.id)) idx.set(n.id, i); });
  const ref = (id: string) => {
    const i = idx.get(id);
    if (i === undefined) {
      w.uv(0);
      w.str(id);
    } else w.uv(i + 1);
  };
  w.uv((canonIds ? G_IDS : 0) | (canonEdges ? G_EDGE_IDS : 0) | (g.target ? G_TARGET : 0) | (g.groups ? G_GROUPS : 0) | (delta ? G_DELTA : 0));
  w.uv(g.nodes.length);
  let prev = 0, px = 0, py = 0;
  g.nodes.forEach((n, i) => {
    if (canonIds) {
      const k = Number(ids[i]![1]);
      w.sv(k - prev - 1);
      prev = k;
    } else w.str(n.id);
    w.str(n.recipeId);
    w.num(n.machines);
    const hasSettings = Object.hasOwn(n, "settings"), hasGroup = Object.hasOwn(n, "group");
    w.u8(tri(n.fixed, Object.hasOwn(n, "fixed")) | (tri(n.added, Object.hasOwn(n, "added")) << 2) | (hasSettings ? 16 : 0) | (hasGroup ? 32 : 0));
    if (Object.hasOwn(n, "fixed") && typeof n.fixed !== "boolean") wValue(w, n.fixed);
    if (Object.hasOwn(n, "added") && typeof n.added !== "boolean") wValue(w, n.added);
    if (hasSettings) wValue(w, n.settings);
    if (hasGroup) wValue(w, n.group);
    w.num(delta ? n.x - px : n.x);
    w.num(delta ? n.y - py : n.y);
    px = n.x;
    py = n.y;
  });
  w.uv(g.edges.length);
  for (const e of g.edges) {
    ref(e.from);
    ref(e.to);
    w.str(e.item);
    if (!canonEdges) w.str(e.id);
  }
  if (g.target) {
    ref(g.target.node);
    w.str(g.target.item);
  }
  w.num(g.rate);
  if (g.groups) {
    w.uv(g.groups.length);
    for (const x of g.groups) {
      w.str(x.id);
      w.str(x.name);
      w.u8(tri(x.collapsed, Object.hasOwn(x, "collapsed")));
      if (Object.hasOwn(x, "collapsed") && typeof x.collapsed !== "boolean") wValue(w, x.collapsed);
    }
  }
}

function rTri(r: Reader, code: number): { present: boolean; v?: unknown } {
  if (code === 0) return { present: false };
  if (code === 1) return { present: true, v: false };
  if (code === 2) return { present: true, v: true };
  return { present: true, v: rValue(r) };
}

function rGraph(r: Reader): Graph {
  const f = r.uv();
  if (f >= 32) throw new ShareError("abîmé", "graphe");
  const nodes: GraphNode[] = [];
  let prev = 0, px = 0, py = 0;
  for (let n = r.count(); n > 0; n--) {
    let id: string;
    if (f & G_IDS) {
      const k = prev + 1 + r.sv();
      if (!Number.isSafeInteger(k) || k < 1) throw new ShareError("abîmé", "id de nœud");
      id = `n${k}`;
      prev = k;
    } else id = r.str();
    const recipeId = r.str(), machines = r.num1(), fl = r.u8();
    if (fl >= 64) throw new ShareError("abîmé", "nœud");
    const node: Record<string, unknown> = { id, recipeId, machines };
    const fixed = rTri(r, fl & 3), added = rTri(r, (fl >> 2) & 3);
    if (fixed.present) node.fixed = fixed.v;
    if (added.present) node.added = added.v;
    if (fl & 16) node.settings = rValue(r);
    if (fl & 32) node.group = rValue(r);
    const x = r.num1(), y = r.num1();
    node.x = f & G_DELTA ? px + x : x;
    node.y = f & G_DELTA ? py + y : y;
    px = node.x as number;
    py = node.y as number;
    nodes.push(node as GraphNode);
  }
  const ref = () => {
    const i = r.uv();
    if (i === 0) return r.str();
    const n = nodes[i - 1];
    if (!n) throw new ShareError("abîmé", "nœud inconnu");
    return n.id;
  };
  const edges: GraphEdge[] = [];
  for (let n = r.count(); n > 0; n--) {
    const from = ref(), to = ref(), item = r.str();
    edges.push({ id: f & G_EDGE_IDS ? edgeId(from, to, item) : r.str(), from, to, item });
  }
  let target: Graph["target"] = null;
  if (f & G_TARGET) {
    const node = ref();
    target = { node, item: r.str() };
  }
  const rate = r.num();
  const g: Graph = { nodes, edges, target, rate };
  if (f & G_GROUPS) {
    const groups: GraphGroup[] = [];
    for (let n = r.count(); n > 0; n--) {
      const x: Record<string, unknown> = { id: r.str(), name: r.str() };
      const c = r.u8();
      if (c > 3) throw new ShareError("abîmé", "groupe");
      const col = rTri(r, c);
      if (col.present) x.collapsed = col.v;
      groups.push(x as GraphGroup);
    }
    g.groups = groups;
  }
  return g;
}

// ---------------------------------------------------------------- graphe édité (DesignGraph)

const E_SOLVED = 1, E_TOUCHED = 2, E_LINKS = 4, E_LINKS_FOR = 8;

function wEdit(w: Writer, e: DesignGraph): void {
  const hasLinks = Object.hasOwn(e, "links") && e.links !== undefined, hasFor = Object.hasOwn(e, "linksFor") && e.linksFor !== undefined;
  w.uv((e.solved ? E_SOLVED : 0) | (e.touched ? E_TOUCHED : 0) | (hasLinks ? E_LINKS : 0) | (hasFor ? E_LINKS_FOR : 0));
  w.str(e.sig);
  wGraph(w, e.graph);
  if (e.solved) wGraph(w, e.solved);
  if (hasLinks) {
    const l = Object.entries(e.links!);
    w.uv(l.length);
    for (const [k, v] of l) {
      w.str(k);
      w.str(v);
    }
  }
  if (hasFor) w.str(e.linksFor!);
}

function rEdit(r: Reader): DesignGraph {
  const f = r.uv();
  if (f >= 16) throw new ShareError("abîmé", "graphe édité");
  const sig = r.str(), graph = rGraph(r), solved = f & E_SOLVED ? rGraph(r) : null;
  const e: DesignGraph = { sig, graph, solved, touched: !!(f & E_TOUCHED) };
  if (f & E_LINKS) {
    const links: Record<string, string> = {};
    for (let n = r.count(); n > 0; n--) {
      const k = r.str();
      Object.defineProperty(links, k, { value: r.str(), enumerable: true, writable: true, configurable: true });
    }
    e.links = links;
  }
  if (f & E_LINKS_FOR) e.linksFor = r.str();
  return e;
}

// ---------------------------------------------------------------- bac à sable (Layout)

const DIRS: Dir[] = ["N", "E", "S", "W"];
// Octet d'un bâtiment : rotation sur 2 bits, puis présences.
const B_ROT_RAW = 4, B_CHOICE = 8, B_CHOICE_NULL = 16, B_OPEN = 32, B_PAIR = 64;
const L_DELTA = 1, L_ROUTES = 2, L_FILLS = 4;

function wLayout(w: Writer, l: Layout): void {
  const delta = deltasExact(l.blocks);
  const hasRoutes = Object.hasOwn(l, "routes") && l.routes !== undefined, hasFills = Object.hasOwn(l, "fills") && l.fills !== undefined;
  w.uv((delta ? L_DELTA : 0) | (hasRoutes ? L_ROUTES : 0) | (hasFills ? L_FILLS : 0));
  const idx = new Map<number, number>();
  // -0 et 0 sont la même clé d'une Map : un -0 s'écrit toujours en brut.
  l.blocks.forEach((b, i) => { if (!idx.has(b.u) && !Object.is(b.u, -0)) idx.set(b.u, i); });
  const ref = (u: number) => {
    const i = Object.is(u, -0) ? undefined : idx.get(u);
    if (i === undefined) {
      w.uv(0);
      w.num(u);
    } else w.uv(i + 1);
  };
  w.uv(l.blocks.length);
  let pu = -1, px = 0, py = 0;
  for (const b of l.blocks) {
    const rawRot = !(Number.isInteger(b.r) && b.r >= 0 && b.r <= 3 && !Object.is(b.r, -0));
    const hasChoice = Object.hasOwn(b, "choice") && b.choice !== undefined, hasOpen = Object.hasOwn(b, "open") && b.open !== undefined, hasPair = Object.hasOwn(b, "pair") && b.pair !== undefined;
    w.u8((rawRot ? B_ROT_RAW : b.r) | (hasChoice ? (b.choice === null ? B_CHOICE_NULL : B_CHOICE) : 0) | (hasOpen ? B_OPEN : 0) | (hasPair ? B_PAIR : 0));
    if (rawRot) w.num(b.r);
    // `u` en delta du précédent (le plus souvent +1) quand c'est un entier sûr, sinon brut.
    if (Number.isSafeInteger(b.u) && !Object.is(b.u, -0) && Number.isSafeInteger(b.u - pu - 1)) {
      w.uv(0);
      w.sv(b.u - pu - 1);
      pu = b.u;
    } else {
      w.uv(1);
      w.num(b.u);
    }
    w.str(b.id);
    w.num(delta ? b.x - px : b.x);
    w.num(delta ? b.y - py : b.y);
    px = b.x;
    py = b.y;
    if (hasChoice && b.choice !== null) w.str(b.choice!);
    if (hasOpen) {
      w.uv(b.open!.length);
      for (const d of b.open!) {
        const k = DIRS.indexOf(d);
        if (k >= 0) w.uv(k);
        else {
          w.uv(4);
          w.str(String(d));
        }
      }
    }
    if (hasPair) w.num(b.pair!);
  }
  w.uv(l.wires.length);
  for (const x of l.wires) {
    ref(x.a);
    w.num(x.ia);
    ref(x.b);
    w.num(x.ib);
    if (x.t === "p") w.uv(0);
    else if (x.t === "g") w.uv(1);
    else {
      w.uv(2);
      w.str(String(x.t));
    }
  }
  if (hasRoutes) {
    w.uv(l.routes!.length);
    for (const x of l.routes!) {
      ref(x.a);
      w.num(x.ia);
      ref(x.b);
      w.num(x.ib);
      w.u8(tri(x.off, Object.hasOwn(x, "off")));
      if (Object.hasOwn(x, "off") && typeof x.off !== "boolean") wValue(w, x.off);
    }
  }
  if (hasFills) wValue(w, l.fills);
}

function rLayout(r: Reader): Layout {
  const f = r.uv();
  if (f >= 8) throw new ShareError("abîmé", "bac à sable");
  const blocks: Placed[] = [];
  let pu = -1, px = 0, py = 0;
  for (let n = r.count(); n > 0; n--) {
    const h = r.u8();
    if (h >= 128 || (h & B_CHOICE && h & B_CHOICE_NULL)) throw new ShareError("abîmé", "bâtiment");
    const rr = h & B_ROT_RAW ? r.num1() : h & 3;
    let u: number;
    const how = r.uv();
    if (how === 0) {
      u = pu + 1 + r.sv();
      pu = u;
    } else if (how === 1) u = r.num1();
    else throw new ShareError("abîmé", "bâtiment");
    const id = r.str(), x = r.num1(), y = r.num1();
    const b: Placed = { u, id, x: f & L_DELTA ? px + x : x, y: f & L_DELTA ? py + y : y, r: rr };
    px = b.x;
    py = b.y;
    if (h & B_CHOICE) b.choice = r.str();
    if (h & B_CHOICE_NULL) b.choice = null;
    if (h & B_OPEN) {
      const open: Dir[] = [];
      for (let k = r.count(); k > 0; k--) {
        const d = r.uv();
        if (d < 4) open.push(DIRS[d]!);
        else if (d === 4) open.push(r.str() as Dir);
        else throw new ShareError("abîmé", "côté");
      }
      b.open = open;
    }
    if (h & B_PAIR) b.pair = r.num1() as CrossPair;
    blocks.push(b);
  }
  const ref = () => {
    const i = r.uv();
    if (i === 0) return r.num1();
    const b = blocks[i - 1];
    if (!b) throw new ShareError("abîmé", "bâtiment inconnu");
    return b.u;
  };
  const wires: Wire[] = [];
  for (let n = r.count(); n > 0; n--) {
    const a = ref(), ia = r.num1(), b = ref(), ib = r.num1(), t = r.uv();
    wires.push({ a, ia, b, ib, t: t === 0 ? "p" : t === 1 ? "g" : t === 2 ? (r.str() as Wire["t"]) : bad("câble") });
  }
  const out: Layout = { blocks, wires };
  if (f & L_ROUTES) {
    const routes: Route[] = [];
    for (let n = r.count(); n > 0; n--) {
      const x: Record<string, unknown> = { a: ref(), ia: r.num1(), b: ref(), ib: r.num1() };
      const c = r.u8();
      if (c > 3) throw new ShareError("abîmé", "liaison");
      const off = rTri(r, c);
      if (off.present) x.off = off.v;
      routes.push(x as Route);
    }
    out.routes = routes;
  }
  if (f & L_FILLS) out.fills = rValue(r) as Layout["fills"];
  return out;
}

const bad = (what: string): never => {
  throw new ShareError("abîmé", what);
};

// ---------------------------------------------------------------- profil de l'auteur

/** « Ma partie » et ses défauts, figés pour la v1 (copie de `EMPTY_PLAYER`). Un nouveau champ s'ajoute EN FIN. */
export const PLAYER_V1: Fields = [
  ["pollutionPct", null],
  ["month", null],
  ["igloo", false],
  ["difficulty", "normal"],
  ["money", null],
  ["rp", null],
  ["rpPerSec", null],
  ["rpAt", null],
  ["spendRp", false],
  ["gamePass", false],
  ["plotW", null],
  ["plotH", null],
  ["research", null],
];
const NODE_RANK = new Map(NODES_V1.map((id, i) => [id, i]));
/** Recherches dans l'ordre de la table figée (puis les inconnues, triées), sans doublon : la forme la plus courte. */
export function canonNodes(ids: readonly string[]): string[] {
  const set = new Set(ids);
  return [...NODES_V1.filter((id) => set.has(id)), ...[...set].filter((id) => !NODE_RANK.has(id)).sort()];
}

/** Liste de recherches : nombre de rangs + 1 puis un bit par rang, puis les inconnues ; 0 : liste en clair (ordre ou doublons à garder). */
function wNodes(w: Writer, ids: string[]): void {
  if (!same(ids, canonNodes(ids))) {
    w.uv(0);
    return wStrings(w, ids);
  }
  const ranks = ids.filter((id) => NODE_RANK.has(id)).map((id) => NODE_RANK.get(id)!);
  const n = ranks.length ? ranks.at(-1)! + 1 : 0, bits = new Uint8Array(Math.ceil(n / 8));
  for (const k of ranks) bits[k >> 3]! |= 1 << (k & 7);
  w.uv(n + 1);
  for (const b of bits) w.u8(b);
  wStrings(w, ids.filter((id) => !NODE_RANK.has(id)));
}

function rNodes(r: Reader): string[] {
  const n = r.uv() - 1;
  if (n < 0) return rStrings(r);
  if (n > NODES_V1.length) throw new ShareError("abîmé", "recherches");
  const out: string[] = [];
  for (let i = 0; i < n; i += 8) {
    const b = r.u8();
    for (let j = 0; j < 8 && i + j < n; j++) if (b & (1 << j)) out.push(NODES_V1[i + j]!);
  }
  return [...out, ...rStrings(r)];
}

function wStrings(w: Writer, xs: string[]): void {
  w.uv(xs.length);
  for (const x of xs) w.str(x);
}
function rStrings(r: Reader): string[] {
  const out: string[] = [];
  for (let n = r.count(); n > 0; n--) out.push(r.str());
  return out;
}

const PROFILE_EXTRAS = ["corrections", "surveys", "interfaces", "diesel"] as const;
const P_NOBASE = 16, P_PARTIAL = 32;

function wProfile(w: Writer, p: DesignProfile): void {
  const on = PROFILE_EXTRAS.map((k) => Object.hasOwn(p, k) && p[k] !== undefined);
  w.uv(on.reduce((f, v, i) => f | (v ? 1 << i : 0), 0) | (p.progress && p.player ? 0 : P_NOBASE) | (p.partial ? P_PARTIAL : 0));
  if (p.progress && p.player) {
    wNodes(w, p.progress.unlocked);
    wNodes(w, p.progress.reqItemsDone);
    wStrings(w, p.progress.owned);
    wSettings(w, p.player, PLAYER_V1);
  }
  PROFILE_EXTRAS.forEach((k, i) => on[i] && wValue(w, p[k]));
}

function rProfile(r: Reader): DesignProfile {
  const f = r.uv();
  if (f >= P_PARTIAL * 2) throw new ShareError("abîmé", "profil");
  const p: DesignProfile = {};
  if (!(f & P_NOBASE)) {
    p.progress = { unlocked: rNodes(r), reqItemsDone: rNodes(r), owned: rStrings(r) };
    p.player = rSettings(r, PLAYER_V1);
  }
  if (f & P_PARTIAL) p.partial = true;
  PROFILE_EXTRAS.forEach((k, i) => f & (1 << i) && (p[k] = rValue(r)));
  return p;
}

// ---------------------------------------------------------------- design entier

const D_NAME = 1, D_GRAPH = 2, D_SANDBOX = 4, D_FACTORY = 8, D_PRINT = 16, D_PROFILE = 32, D_ENGINE = 64;

/** Corps non compressé (utile aux mesures et aux tests). */
export function designBody(d: Design): Uint8Array {
  const w = new Writer(TABLE_V1);
  const has = (k: keyof Design) => Object.hasOwn(d, k) && d[k] !== undefined;
  w.uv((has("name") ? D_NAME : 0) | (has("graph") ? D_GRAPH : 0) | (has("sandbox") ? D_SANDBOX : 0) | (has("factory") ? D_FACTORY : 0) | (has("print") ? D_PRINT : 0) | (has("profile") ? D_PROFILE : 0) | (has("engine") ? D_ENGINE : 0));
  w.str(d.site);
  if (has("name")) w.str(d.name!);
  wSettings(w, d.settings);
  if (has("graph")) wEdit(w, d.graph!);
  if (has("sandbox")) wLayout(w, d.sandbox!);
  if (has("factory")) wLayout(w, d.factory!);
  if (has("print")) {
    if (!PRINT.test(d.print!)) throw new Error(`share: empreinte ${d.print}`);
    for (let i = 0; i < 16; i += 2) w.u8(parseInt(d.print!.slice(i, i + 2), 16));
  }
  if (has("profile")) wProfile(w, d.profile!);
  if (has("engine")) {
    if (!ENGINE.test(d.engine!)) throw new Error(`share: moteur ${d.engine}`);
    for (let i = 0; i < 8; i += 2) w.u8(parseInt(d.engine!.slice(i, i + 2), 16));
  }
  return w.bytes();
}

function readBody(body: Uint8Array): Design {
  const r = new Reader(body, TABLE_V1);
  const f = r.uv();
  if (f >= 128) throw new ShareError("abîmé", "design");
  const d: Design = { site: r.str(), settings: {} };
  if (f & D_NAME) d.name = r.str();
  d.settings = rSettings(r);
  if (f & D_GRAPH) d.graph = rEdit(r);
  if (f & D_SANDBOX) d.sandbox = rLayout(r);
  if (f & D_FACTORY) d.factory = rLayout(r);
  if (f & D_PRINT) {
    let p = "";
    for (let i = 0; i < 8; i++) p += r.u8().toString(16).padStart(2, "0");
    d.print = p;
  }
  if (f & D_PROFILE) d.profile = rProfile(r);
  if (f & D_ENGINE) {
    let e = "";
    for (let i = 0; i < 4; i++) e += r.u8().toString(16).padStart(2, "0");
    d.engine = e;
  }
  if (!r.done) throw new ShareError("abîmé", "octets en trop");
  // Ordre des clés comme à l'écriture habituelle (sans effet sur l'égalité, plus lisible au débogage).
  const { site, engine, name, settings, graph, sandbox, factory, print, profile } = d;
  return { site, ...(engine ? { engine } : {}), ...(name !== undefined ? { name } : {}), settings, ...(graph ? { graph } : {}), ...(sandbox ? { sandbox } : {}), ...(factory ? { factory } : {}), ...(print ? { print } : {}), ...(profile ? { profile } : {}) };
}

/** Octets du design (contenu du fichier `.indus`) : version, puis le corps en deflate-raw. */
export async function encodeDesignBytes(d: Design): Promise<Uint8Array> {
  const z = await deflate(designBody(d));
  const out = new Uint8Array(1 + z.length);
  out[0] = SHARE_VERSION;
  out.set(z, 1);
  return out;
}

export async function decodeDesignBytes(bytes: Uint8Array): Promise<Design> {
  if (!bytes.length) throw new ShareError("abîmé", "vide");
  if (bytes[0]! > SHARE_VERSION) throw new ShareError("version-future", String(bytes[0]));
  if (bytes[0] !== SHARE_VERSION) throw new ShareError("abîmé", "version");
  return readBody(await inflate(bytes.subarray(1)));
}

/** Données du lien : `1.<base64url>` (à placer après `#d=`). */
export async function encodeDesign(d: Design): Promise<string> {
  return `${SHARE_VERSION}.${toBase64url(await encodeDesignBytes(d))}`;
}

/**
 * Relit un lien : accepte l'adresse entière, `#d=1.…`, `d=1.…` ou `1.…`. Version plus récente que ce site :
 * ShareError « version-future » ; rien de reconnaissable : « pas-un-lien » ; données abîmées : « abîmé ».
 */
export async function decodeDesign(s: string): Promise<Design> {
  const t = s.trim(), at = t.lastIndexOf("d="); // base64url n'a jamais de « = »
  const m = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(at >= 0 ? t.slice(at + 2) : t);
  if (!m) throw new ShareError("pas-un-lien");
  const v = Number(m[1]);
  if (v > SHARE_VERSION) throw new ShareError("version-future", m[1]);
  if (v !== SHARE_VERSION) throw new ShareError("pas-un-lien", m[1]);
  const bytes = fromBase64url(m[2]!);
  if (bytes[0] !== v) throw new ShareError("abîmé", "version");
  return decodeDesignBytes(bytes);
}

/** Lien complet vers le site (le fragment n'est jamais envoyé au serveur). */
export const designLink = (origin: string, data: string) => `${origin.replace(/\/+$/, "")}/#d=${data}`;
