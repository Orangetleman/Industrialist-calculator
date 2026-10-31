// Bac à sable, écran (B3) : le dessin SVG du montage, repris de la maquette validée (maquette/bac-a-sable.html).
// Une case = 1 unité du dessin. Tuyaux : couleur de la famille, hachures rouge et orange quand ils sont saturés,
// filet de la couleur de l'objet qui passe. Ports : objet en jaune, fluide en bleu ; triangle vers l'extérieur =
// sortie, vers l'intérieur = entrée, barre = les deux sens. Prises dessus : carré à éclair, losange logique.

import type { Dir, LaneState, MachineState, Placed, PlacedPort, SbCatalog } from "../engine/sandbox/index.ts";
import { CROSS_PAIRS, DV, cellOpen, cellsOf, dims, geo } from "../engine/sandbox/index.ts";
import { uiFam } from "./sandbox-model.ts";
import { esc, fmtPct } from "./format.ts";

export type ImgOf = (kind: "machine" | "objet", id: string) => string | null;
/** `compact` : vue dézoomée (B4), des formes simples sans image, texte ni port. */
export type DrawCtx = { cat: SbCatalog; img: ImgOf; itemName: (id: string) => string; status: boolean; compact?: boolean; lane?: (u: number, l: number) => LaneState | undefined; mi?: MachineState };
/** Portée d'une pièce modulaire (modular.json) : depuis le bord (`edge`, null = infinie) et ce qu'elle dessert. */
export type ModRange = { edge: number | null; serves: string[] };

export const PIPE_COL: Record<string, string> = { o1: "#8a8a8a", o3: "#c2ab70", f1: "#5d7f9c", f3: "#6aa6c9", f4: "#3f74a3" };
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

function pipeMarkup(c: DrawCtx, b: Placed): string {
  const def = c.cat.blocks.get(b.id)!, p = def.pipe!, fam = uiFam(c.cat, b.id), [w, h] = dims(def, b.r), g = geo(def, b);
  const large = fam === "f4" || (!!def.geo && Math.min(def.geo.w, def.geo.h) > 1);
  let s = "";
  if (large) {
    const L = c.lane?.(b.u, 0);
    s += rect([b.x + 0.08, b.y + 0.08, w - 0.16, h - 0.16], L?.over ? "url(#bac-over)" : PIPE_COL.f4!, `rx=".3" stroke="#000" stroke-opacity=".5" stroke-width=".05"`);
  } else for (const [x, y] of cellsOf(def, b)) {
    const open = [...cellOpen(def, b, x, y)];
    const pairs = CROSS_PAIRS[p.kind === "m" ? 0 : b.pair ?? 0];
    const lanes: [Dir[], number][] = p.role === "croisement" ? [[pairs[0], 0], [pairs[1], 1]] : [[open, 0]];
    const kindAt = (d: Dir) => (p.kind === "m" ? g?.ports.find((q) => q.dir === d)?.t : p.kind);
    for (const [dirs, l] of lanes) {
      const L = c.lane?.(b.u, l), k = kindAt(dirs[0]!) ?? "o", W = k === "f" ? 0.46 : 0.34;
      const col = b.open ? "#c0392b" : L?.over ? "url(#bac-over)" : PIPE_COL[fam ?? (k === "f" ? "f3" : "o3")] ?? "#888";
      const ex = l === 1 ? `stroke="#000" stroke-width=".05"` : "";
      s += rect([x + 0.5 - W / 2, y + 0.5 - W / 2, W, W], col, ex);
      for (const d of dirs) s += rect(band(x, y, d, W), col, ex);
      if (L?.item && L.flow > 1e-9) for (const d of dirs) s += rect(band(x, y, d, 0.09), `hsl(${hue(L.item)} 80% 62%)`);
    }
  }
  s += rect([b.x + 0.03, b.y + 0.03, w - 0.06, h - 0.06], "none", `stroke="#000" stroke-opacity=".55" stroke-width=".05"`);
  s += portsMarkup(c.cat, b);
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
  s += portsMarkup(c.cat, b);
  const mi = c.mi;
  if (mi && (def.recipes.length || def.incomplete.length)) {
    if (c.status) s += rect([x + 0.16, y + h - 0.46, 0.3, 0.3], statusColor(mi), `stroke="#000" stroke-width=".04"`);
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
