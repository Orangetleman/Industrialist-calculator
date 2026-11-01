// Bac à sable, écran (B3) : le dessin SVG du montage, repris de la maquette validée (maquette/bac-a-sable.html).
// Une case = 1 unité du dessin. Tuyaux (S57) : la texture dit le type (objet : parallélépipède à rails et nervures ;
// fluide : cylindre ombré à bagues), une teinte légère le tier (I laiton, III acier, IV sombre) ; hachures rouge et
// orange quand ils sont saturés, filet de la couleur de l'objet qui passe. Ports : objet en jaune, fluide en bleu ;
// triangle vers l'extérieur = sortie, vers l'intérieur = entrée, barre = les deux sens. Prises dessus : carré à
// éclair, losange logique. Mode câblage (S57) : un bouton par port et par voie de tuyau, comme en jeu.

import type { Dir, FlowBtn, LaneState, MachineState, Placed, PlacedPort, SbCatalog } from "../engine/sandbox/index.ts";
import { CROSS_PAIRS, DV, cellOpen, cellsOf, dims, geo } from "../engine/sandbox/index.ts";
import { uiFam } from "./sandbox-model.ts";
import { esc, fmtPct } from "./format.ts";

export type ImgOf = (kind: "machine" | "objet", id: string) => string | null;
/** `compact` : vue dézoomée (B4), des formes simples sans image, texte ni port. */
/** `wiring` : mode câblage, les ports se voient par leurs boutons (dessinés à part), pas par les triangles. */
export type DrawCtx = { cat: SbCatalog; img: ImgOf; itemName: (id: string) => string; status: boolean; compact?: boolean; wiring?: boolean; lane?: (u: number, l: number) => LaneState | undefined; mi?: MachineState };
/** Portée d'une pièce modulaire (modular.json) : depuis le bord (`edge`, null = infinie) et ce qu'elle dessert. */
export type ModRange = { edge: number | null; serves: string[] };

/** Teinte du tier (réponse de l'utilisateur, S57 : tier I laiton, tier III acier, tier IV sombre) ; le type se lit à la texture. */
export const PIPE_COL: Record<string, string> = { o1: "#b39b62", f1: "#a8925e", o3: "#9ba2a9", f3: "#8f99a3", f4: "#505b67" };
export const PORT_COL: Record<string, string> = { o: "#f0c330", f: "#4aa3df", p: "#ffd84d", g: "#b48ef0" };
const ST_COL = { ok: "rgb(92 230 119)", out: "#f0a040", bad: "#e55454" };

export const hue = (s: string): number => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
export const rect = (r: number[], fill: string, extra = "") => `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${fill}" ${extra}/>`;
function band(x: number, y: number, d: Dir, w: number): number[] {
  const a = 0.5 - w / 2;
  return d === "N" ? [x + a, y, w, 0.5 + w / 2] : d === "S" ? [x + a, y + a, w, 0.5 + w / 2] : d === "E" ? [x + a, y + a, 0.5 + w / 2, w] : [x, y + a, 0.5 + w / 2, w];
}
function tri(cx: number, cy: number, dir: Dir, out: boolean): string {
  const [dx, dy] = DV[dir], ex = cx + dx * 0.5, ey = cy + dy * 0.5, tip = out ? 0.22 : -0.26, px = -dy * 0.17, py = dx * 0.17;
  return `${ex + px},${ey + py} ${ex - px},${ey - py} ${ex + dx * tip},${ey + dy * tip}`;
}
const CLOSE = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';

/** Tous les ports relevés se voient, y compris sur les tuyaux (retour du 2026-10-27). */
export function portsMarkup(cat: SbCatalog, b: Placed): string {
  const def = cat.blocks.get(b.id), g = def && geo(def, b);
  if (!g) return "";
  let s = "";
  for (const p of g.ports) {
    const col = PORT_COL[p.t] ?? "#ccc";
    if (p.dir === "top") {
      const r = 0.2, x = p.px!, y = p.py!;
      s += p.t === "g"
        ? `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${col}" stroke="#000" stroke-width=".04"/>`
        : `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx=".04" fill="#222" stroke="${col}" stroke-width=".06"/><path d="M${x + 0.04} ${y - 0.14}l-.1 .16h.12l-.1 .16" fill="none" stroke="${col}" stroke-width=".05" stroke-linecap="round"/>`;
      continue;
    }
    if (p.d === "l") {
      const [dx, dy] = DV[p.dir], xs = p.cells!.map((c) => c[0]), ys = p.cells!.map((c) => c[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1, th = 0.12;
      const rr = dx === 0 ? [x0 + 0.2, dy < 0 ? y0 : y1 - th, x1 - x0 - 0.4, th] : [dx < 0 ? x0 : x1 - th, y0 + 0.2, th, y1 - y0 - 0.4];
      s += rect(rr, col, `stroke="#fff" stroke-width=".035"`);
    } else for (const [cx, cy] of p.cells!) s += `<polygon points="${tri(cx + 0.5, cy + 0.5, p.dir, p.d === "s")}" fill="${col}" stroke="#000" stroke-width=".03"/>`;
  }
  return s;
}

/** Un bras de tuyau texturé : objet = bande à rails et nervures ; fluide = tube ombré, bague au bord de la case. */
function armTex(x: number, y: number, d: Dir, W: number, k: string, col: string, ex: string): string {
  const r = band(x, y, d, W), v = d === "N" || d === "S";
  let s = rect(r, col, ex);
  if (k === "f") {
    s += rect(r, `url(#bac-cyl-${v ? "x" : "y"})`);
    const t = 0.07, w2 = W + 0.08, ring = `stroke="#000" stroke-opacity=".6" stroke-width=".02"`;
    s += rect(d === "N" ? [x + 0.5 - w2 / 2, y, w2, t] : d === "S" ? [x + 0.5 - w2 / 2, y + 1 - t, w2, t] : d === "E" ? [x + 1 - t, y + 0.5 - w2 / 2, t, w2] : [x, y + 0.5 - w2 / 2, t, w2], col, ring);
  } else {
    const e = 0.05, dark = "rgba(0,0,0,.45)"; // rails le long du bras, nervures en travers
    s += v ? rect([r[0]!, r[1]!, e, r[3]!], dark) + rect([r[0]! + r[2]! - e, r[1]!, e, r[3]!], dark) : rect([r[0]!, r[1]!, r[2]!, e], dark) + rect([r[0]!, r[1]! + r[3]! - e, r[2]!, e], dark);
    for (const q of [0.12, 0.32]) {
      const o = d === "N" || d === "W" ? q : 1 - q - 0.03;
      s += v ? rect([r[0]!, y + o, r[2]!, 0.03], "rgba(0,0,0,.35)") : rect([x + o, r[1]!, 0.03, r[3]!], "rgba(0,0,0,.35)");
    }
  }
  return s;
}

function pipeMarkup(c: DrawCtx, b: Placed): string {
  const def = c.cat.blocks.get(b.id)!, p = def.pipe!, fam = uiFam(c.cat, b.id), [w, h] = dims(def, b.r), g = geo(def, b);
  const large = fam === "f4" || (!!def.geo && Math.min(def.geo.w, def.geo.h) > 1);
  let s = "";
  if (large) {
    const L = c.lane?.(b.u, 0);
    s += rect([b.x + 0.08, b.y + 0.08, w - 0.16, h - 0.16], L?.over ? "url(#bac-over)" : PIPE_COL.f4!, `rx=".3" stroke="#000" stroke-opacity=".5" stroke-width=".05"`);
    s += rect([b.x + 0.08, b.y + 0.08, w - 0.16, h - 0.16], `url(#bac-cyl-${w < h ? "x" : "y"})`, `rx=".3"`);
  } else for (const [x, y] of cellsOf(def, b)) {
    const open = [...cellOpen(def, b, x, y)];
    const pairs = CROSS_PAIRS[p.kind === "m" ? 0 : b.pair ?? 0];
    const lanes: [Dir[], number][] = p.role === "croisement" ? [[pairs[0], 0], [pairs[1], 1]] : [[open, 0]];
    const kindAt = (d: Dir) => (p.kind === "m" ? g?.ports.find((q) => q.dir === d)?.t : p.kind);
    for (const [dirs, l] of lanes) {
      const L = c.lane?.(b.u, l), k = kindAt(dirs[0]!) ?? "o", W = k === "f" ? 0.46 : 0.34;
      const col = b.open ? "#c0392b" : L?.over ? "url(#bac-over)" : PIPE_COL[fam ?? (k === "f" ? "f3" : "o3")] ?? "#888";
      const ex = l === 1 ? `stroke="#000" stroke-width=".05"` : "";
      s += rect([x + 0.5 - W / 2, y + 0.5 - W / 2, W, W], col, `${k === "f" ? `rx="${W / 2}"` : ""} ${ex}`);
      for (const d of dirs) s += armTex(x, y, d, W, k, col, ex);
      if (L?.item && L.flow > 1e-9) for (const d of dirs) s += rect(band(x, y, d, 0.09), `hsl(${hue(L.item)} 80% 62%)`);
    }
  }
  s += rect([b.x + 0.03, b.y + 0.03, w - 0.06, h - 0.06], "none", `stroke="#000" stroke-opacity=".55" stroke-width=".05"`);
  if (!c.wiring) s += portsMarkup(c.cat, b);
  if (b.open) s += `<svg x="${b.x + 0.25}" y="${b.y + 0.25}" width=".5" height=".5" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">${CLOSE}</svg>`;
  return s;
}

/** Couleur de la pastille d'état (F6) : verte, orange (sortie bloquée ou recette à choisir), rouge (entrée manquante). */
export function statusColor(mi: MachineState): string {
  if (!mi.rec) return mi.cand.length > 1 ? ST_COL.out : ST_COL.bad;
  if (mi.f > 0.999) return ST_COL.ok;
  return mi.reason?.k === "blocked" || mi.reason?.k === "saturatedOut" ? ST_COL.out : ST_COL.bad;
}

function machineMarkup(c: DrawCtx, b: Placed): string {
  const def = c.cat.blocks.get(b.id)!, [w, h] = dims(def, b.r), x = b.x, y = b.y, im = c.img("machine", b.id);
  let s = rect([x + 0.06, y + 0.06, w - 0.12, h - 0.12], "#323232", `rx=".15" stroke="#5c5c5c" stroke-width=".06"`);
  if (im) s += `<image href="${esc(im)}" x="${x + 0.2}" y="${y + 0.2}" width="${w - 0.4}" height="${h - 0.4}" preserveAspectRatio="xMidYMid meet" opacity=".85"/>`;
  if (Math.min(w, h) >= 2) s += `<text x="${x + 0.18}" y="${y + 0.45}" font-size=".3" font-weight="700" fill="#eee" stroke="#000" stroke-width=".06" paint-order="stroke">${esc(def.name)}</text>`;
  if (!c.wiring) s += portsMarkup(c.cat, b);
  const mi = c.mi;
  if (mi && (def.recipes.length || def.incomplete.length)) {
    if (c.status && !c.wiring) s += rect([x + 0.16, y + h - 0.46, 0.3, 0.3], statusColor(mi), `stroke="#000" stroke-width=".04"`); // en câblage, elle cacherait un bouton
    // La recette retenue se voit sur la machine : l'objet qu'elle produit, ou « ? » s'il faut la choisir.
    const bx = x + w - 0.62, by = y + 0.12;
    if (mi.rec) {
      const it = Object.keys(mi.rec.out)[0] ?? "", ii = c.img("objet", it);
      s += `<circle cx="${bx + 0.25}" cy="${by + 0.25}" r=".28" fill="#111" stroke="#777" stroke-width=".04"/>`
        + (ii ? `<image href="${esc(ii)}" x="${bx + 0.04}" y="${by + 0.04}" width=".42" height=".42"/>` : `<text x="${bx + 0.25}" y="${by + 0.36}" font-size=".26" text-anchor="middle" fill="#fff">${esc(c.itemName(it).slice(0, 2))}</text>`);
    } else if (mi.cand.length > 1 || def.incomplete.length) s += `<circle cx="${bx + 0.25}" cy="${by + 0.25}" r=".28" fill="#f0a040"/><text x="${bx + 0.25}" y="${by + 0.36}" font-size=".32" font-weight="700" text-anchor="middle" fill="#000">?</text>`;
    if (mi.rec && mi.f < 0.999) s += `<text x="${x + w - 0.15}" y="${y + h - 0.18}" font-size=".28" text-anchor="end" fill="#fff" stroke="#000" stroke-width=".06" paint-order="stroke">${fmtPct(String(Math.round(mi.f * 100)))}</text>`;
  }
  return s;
}

/**
 * Vue compacte (B4) : une machine = un pavé et sa pastille d'état agrandie ; un tuyau = ses cases à la couleur de
 * la famille (hachurées si saturées). Assez lisible de loin, et bien plus léger à dessiner.
 */
function compactMarkup(c: DrawCtx, b: Placed): string {
  const def = c.cat.blocks.get(b.id)!, [w, h] = dims(def, b.r);
  if (def.pipe) {
    const L = c.lane?.(b.u, 0), fam = uiFam(c.cat, b.id);
    const col = b.open ? "#c0392b" : L?.over ? "url(#bac-over)" : PIPE_COL[fam ?? (def.pipe.kind === "f" ? "f3" : "o3")] ?? "#888";
    if (fam === "f4" || Math.min(w, h) > 1) return rect([b.x + 0.1, b.y + 0.1, w - 0.2, h - 0.2], col);
    let s = "";
    for (const [x, y] of cellsOf(def, b)) {
      s += rect([x + 0.25, y + 0.25, 0.5, 0.5], col);
      for (const d of cellOpen(def, b, x, y)) s += rect(band(x, y, d, 0.5), col);
    }
    return s;
  }
  let s = rect([b.x + 0.08, b.y + 0.08, w - 0.16, h - 0.16], "#3a3a3a", `stroke="#6a6a6a" stroke-width=".12"`);
  const mi = c.mi;
  if (c.status && mi && (def.recipes.length || def.incomplete.length)) s += rect([b.x + w / 2 - 0.5, b.y + h / 2 - 0.5, 1, 1], statusColor(mi));
  return s;
}

/**
 * Vue dézoomée de tout le montage en quelques tracés (un par couleur) au lieu d'un élément par bâtiment : de
 * gros montages se déplacent sans à-coups. Même dessin que `compactMarkup`.
 */
export function compactBatch(c: DrawCtx, blocks: Placed[], mi: (u: number) => MachineState | undefined): string {
  const paths = new Map<string, string[]>(), add = (col: string, r: number[]) => { let a = paths.get(col); if (!a) paths.set(col, (a = [])); a.push(`M${r[0]} ${r[1]}h${r[2]}v${r[3]}h${-r[2]!}z`); };
  const MACH = " m";
  for (const b of blocks) {
    const def = c.cat.blocks.get(b.id);
    if (!def) continue;
    const [w, h] = dims(def, b.r);
    if (def.pipe) {
      const L = c.lane?.(b.u, 0), fam = uiFam(c.cat, b.id);
      const col = b.open ? "#c0392b" : L?.over ? "url(#bac-over)" : PIPE_COL[fam ?? (def.pipe.kind === "f" ? "f3" : "o3")] ?? "#888";
      if (fam === "f4" || Math.min(w, h) > 1) { add(col, [b.x + 0.1, b.y + 0.1, w - 0.2, h - 0.2]); continue; }
      for (const [x, y] of cellsOf(def, b)) {
        add(col, [x + 0.25, y + 0.25, 0.5, 0.5]);
        for (const d of cellOpen(def, b, x, y)) add(col, band(x, y, d, 0.5));
      }
      continue;
    }
    add(MACH, [b.x + 0.08, b.y + 0.08, w - 0.16, h - 0.16]);
    const m = mi(b.u);
    if (c.status && m && (def.recipes.length || def.incomplete.length)) add(statusColor(m), [b.x + w / 2 - 0.5, b.y + h / 2 - 0.5, 1, 1]);
  }
  let s = "";
  const mach = paths.get(MACH);
  if (mach) s += `<path d="${mach.join("")}" fill="#3a3a3a" stroke="#6a6a6a" stroke-width=".12"/>`;
  for (const [col, a] of paths) if (col !== MACH) s += `<path d="${a.join("")}" fill="${col}"/>`;
  return s;
}

export function blockMarkup(c: DrawCtx, b: Placed): string {
  const def = c.cat.blocks.get(b.id);
  if (!def) return "";
  if (c.compact) return compactMarkup(c, b);
  return def.pipe ? pipeMarkup(c, b) : machineMarkup(c, b);
}

/** Icône d'un bloc pour le menu : l'image du wiki, sinon son dessin, sinon « ? » (ports non relevés). */
export function blockIcon(c: DrawCtx, id: string, px = 34): string {
  const def = c.cat.blocks.get(id);
  if (!def) return "";
  const im = def.pipe ? null : c.img("machine", id);
  if (im) return `<img src="${esc(im)}" width="${px}" height="${px}" alt="" draggable="false" style="object-fit:contain">`;
  if (!def.geo) return `<svg width="${px}" height="${px}" viewBox="0 0 1 1" aria-hidden="true"><rect x=".1" y=".1" width=".8" height=".8" rx=".1" fill="#333" stroke="#666" stroke-width=".04"/><text x=".5" y=".66" font-size=".45" text-anchor="middle" fill="#999">?</text></svg>`;
  const [w, h] = dims(def, 0), m = Math.max(w, h);
  return `<svg width="${px}" height="${px}" viewBox="${(w - m) / 2 - 0.05} ${(h - m) / 2 - 0.05} ${m + 0.1} ${m + 0.1}" aria-hidden="true">${blockMarkup({ ...c, lane: undefined, mi: undefined, compact: false }, { u: -1, id, x: 0, y: 0, r: 0 })}</svg>`;
}

/** Portée d'un bâtiment (poteaux : power.json et relevés ; pièces modulaires : modular.json, depuis le bord), null sinon. */
export function rangeOf(c: DrawCtx, mods: Map<string, ModRange>, id: string, r: number): { R: number; serves: string[] | null; col: string } | null {
  const def = c.cat.blocks.get(id);
  if (!def) return null;
  const [w, h] = dims(def, r), m = mods.get(id);
  if (m) return m.edge != null ? { R: m.edge + Math.max(w, h) / 2, serves: m.serves, col: "#7fd67f" } : null;
  return def.elec?.range ? { R: def.elec.range, serves: null, col: "#ffd84d" } : null;
}

/** Cercle de portée, et les bâtiments couverts encadrés (desservis pour une pièce modulaire, à prises pour un poteau). */
export function rangeMarkup(c: DrawCtx, mods: Map<string, ModRange>, blocks: Placed[], id: string, x: number, y: number, r: number, hasNodes: (b: Placed) => boolean): string {
  const def = c.cat.blocks.get(id), g = rangeOf(c, mods, id, r);
  if (!def || !g) return "";
  const [w, h] = dims(def, r), cx = x + w / 2, cy = y + h / 2;
  let s = `<circle cx="${cx}" cy="${cy}" r="${g.R}" fill="${g.col}" fill-opacity=".06" stroke="${g.col}" stroke-width=".07" stroke-dasharray=".4 .25"/>`;
  for (const b of blocks) {
    if (b.x === x && b.y === y) continue;
    if (g.serves ? !g.serves.includes(b.id) : !hasNodes(b)) continue;
    const bd = c.cat.blocks.get(b.id);
    if (!bd) continue;
    const [bw, bh] = dims(bd, b.r), dd = Math.hypot(Math.max(b.x - cx, 0, cx - (b.x + bw)), Math.max(b.y - cy, 0, cy - (b.y + bh)));
    if (dd <= g.R) s += rect([b.x, b.y, bw, bh], "none", `stroke="${g.col}" stroke-width=".07" stroke-opacity=".8"`);
  }
  return s;
}

/** Centre du bord d'un port de côté (pour les flèches des liaisons et la visée au clic). */
export function portEdge(p: PlacedPort): [number, number] {
  const [dx, dy] = DV[p.dir as Dir], n = p.cells!.length;
  const cx = p.cells!.reduce((a, q) => a + q[0], 0) / n + 0.5, cy = p.cells!.reduce((a, q) => a + q[1], 0) / n + 0.5;
  return [cx + dx * 0.5, cy + dy * 0.5];
}

// ---------------------------------------------------------------- mode câblage (S57)

/** Couleurs indicatives du jeu (réponse de l'utilisateur) : entrées jaunes, sorties violettes, voies de tuyau bleues (2e voie d'un croisement rouge), logique jaune. */
export const BTN_COL = { e: "#f0c330", s: "#b040e0", lane: ["#3d6bff", "#e83a3a"], g: "#f0c330" } as const;
/** Prises électriques : rouge et bleu, puis vert et jaune pour les poteaux à 4 prises ; Small MV Pole rouge, Small MV Pole 2 bleu. */
const POWER_COL = ["#e83a3a", "#3d6bff", "#4caf50", "#f0c330"];
/** Un bouton : sa place, sa couleur, son type, ce qu'il désigne (`top` : rang d'une prise du dessus) et le trait du port. */
export type Btn = { key: string; x: number; y: number; col: string; t: string; ref: FlowBtn | { u: number; top: number }; trait?: number[] };
export const btnKey = (r: FlowBtn | { u: number; top: number }) => ("port" in r ? `${r.u}:p${r.port}` : "lane" in r ? `${r.u}:l${r.lane}` : `${r.u}:t${r.top}`);

export function buttonsOf(cat: SbCatalog, b: Placed): Btn[] {
  const def = cat.blocks.get(b.id), g = def && geo(def, b);
  if (!def || !g) return [];
  const out: Btn[] = [];
  if (def.pipe) {
    const [w, h] = dims(def, b.r), cx = b.x + w / 2, cy = b.y + h / 2;
    const lanes = def.pipe.role === "croisement" ? [0, 1] : [0];
    for (const l of lanes) {
      const p = g.ports.find((q) => q.cells && (lanes.length === 1 || CROSS_PAIRS[def.pipe!.kind === "m" ? 0 : b.pair ?? 0][l]!.includes(q.dir as Dir)));
      const ref = { u: b.u, lane: l };
      out.push({ key: btnKey(ref), x: cx + (lanes.length > 1 ? (l ? 0.17 : -0.17) : 0), y: cy, col: BTN_COL.lane[l]!, t: p?.t ?? "o", ref });
    }
    return out;
  }
  let nTop = b.id === "small-mv-pole2" ? 1 : 0;
  g.ports.forEach((p, i) => {
    if (p.dir === "top") {
      const ref = { u: b.u, top: i };
      out.push({ key: btnKey(ref), x: p.px!, y: p.py!, col: p.t === "p" ? POWER_COL[nTop++ % 4]! : BTN_COL.g, t: p.t, ref });
      return;
    }
    if (p.t !== "o" && p.t !== "f") return;
    const [dx, dy] = DV[p.dir], xs = p.cells!.map((c) => c[0]), ys = p.cells!.map((c) => c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1, th = 0.1;
    const cx = (x0 + x1) / 2 + dx * 0.2, cy = (y0 + y1) / 2 + dy * 0.2, col = p.d === "s" ? BTN_COL.s : BTN_COL.e;
    const trait = dx === 0 ? [x0 + 0.2, dy < 0 ? y0 : y1 - th, x1 - x0 - 0.4, th] : [dx < 0 ? x0 : x1 - th, y0 + 0.2, th, y1 - y0 - 0.4];
    const ref = { u: b.u, port: i };
    out.push({ key: btnKey(ref), x: cx, y: cy, col, t: p.t, ref, trait });
  });
  return out;
}

/** Dessin d'un bouton (et du trait de son port) ; `on` : départ d'un réglage, `glow` : arrivée possible, `dim` : effacé. */
export function btnMarkup(x: Btn, o: { on?: boolean; glow?: boolean; dim?: boolean } = {}): string {
  const s = 0.3, op = o.dim ? ` opacity=".3"` : "";
  let m = x.trait ? rect(x.trait, x.col, `stroke="#000" stroke-width=".03"${op}`) : "";
  if (o.glow) m += `<rect x="${x.x - 0.26}" y="${x.y - 0.26}" width=".52" height=".52" rx=".06" fill="none" stroke="#fff" stroke-width=".05" stroke-dasharray=".1 .07"/>`;
  return m + `<rect x="${x.x - s / 2}" y="${x.y - s / 2}" width="${s}" height="${s}" rx=".05" fill="${x.col}" stroke="${o.on ? "#fff" : "#000"}" stroke-width="${o.on ? 0.07 : 0.03}"${op}/>`;
}

const markerId = (col: string) => col.replace("#", "");
/** Une flèche d'un bouton à l'autre : couleur du bouton de départ ; grise en pointillés si rien ne passe ; rouge hachurée si saturée. */
export function arrowMarkup(a: Btn, b: Btn, o: { idle?: boolean; over?: boolean; dir?: boolean; pin?: boolean } = {}): string {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 1e-6) return "";
  const k = Math.min(0.2, L / 3), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const x1 = a.x + ux * k, y1 = a.y + uy * k, x2 = b.x - ux * k, y2 = b.y - uy * k;
  const col = o.over ? "#ff4d4d" : o.idle ? "#8a8a8a" : a.col, mk = o.dir === false ? "" : ` marker-end="url(#bac-ar-${markerId(col)})"`;
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width=".07"${mk}${o.idle || o.over ? ` stroke-dasharray=".12 .08"` : ""}/>`;
  if (o.pin) s += `<circle cx="${x1}" cy="${y1}" r=".07" fill="#fff" stroke="#000" stroke-width=".02"/>`;
  return s;
}
/** Les pointes de flèche, une par couleur (petites : retour de l'utilisateur sur la maquette). */
const ARROW_COLS = [BTN_COL.e, BTN_COL.s, ...BTN_COL.lane, ...POWER_COL, "#8a8a8a", "#ff4d4d"];
export const arrowDefs = () => [...new Set(ARROW_COLS)].map((c) => `<marker id="bac-ar-${markerId(c)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`).join("");

/** Tuyau à l'envers : il clignote en rouge, avec une infobulle courte. */
export function cutMarkup(cat: SbCatalog, b: Placed, tip: string): string {
  const def = cat.blocks.get(b.id);
  if (!def) return "";
  const [w, h] = dims(def, b.r), tw = tip.length * 0.15 + 0.3, tx = b.x + w / 2 - tw / 2, ty = b.y - 0.62;
  return `<rect x="${b.x + 0.02}" y="${b.y + 0.02}" width="${w - 0.04}" height="${h - 0.04}" fill="#ff3b3b" fill-opacity=".25" stroke="#ff3b3b" stroke-width=".09"><animate attributeName="opacity" values="1;.2;1" dur="1s" repeatCount="indefinite"/></rect>`
    + `<rect x="${tx}" y="${ty}" width="${tw}" height=".44" rx=".08" fill="#2a1111" stroke="#ff3b3b" stroke-width=".03"/><text x="${b.x + w / 2}" y="${ty + 0.3}" font-size=".26" text-anchor="middle" fill="#ffd0d0">${esc(tip)}</text>`;
}
