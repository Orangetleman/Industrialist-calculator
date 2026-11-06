// Bac à sable, écran (B3, PLAN-BAC-A-SABLE.md) : ce qui se calcule sans page, testé à part. Menu de pose
// (catégories, tiers, familles de tuyaux, raccourcis [tier, catégorie, bloc]), pose en ligne, touches, et les
// textes des alertes du moteur dans la langue choisie. Le calcul du montage reste dans src/engine/sandbox/.

import type { Alert, PipeRole, Reason, RouteError, SbBlock, SbCatalog, WireError } from "../engine/sandbox/index.ts";
import { dims, famOf, type Fam, type Piece } from "../engine/sandbox/index.ts";
import { t, type Key } from "../i18n/i18n.ts";
import { fmt, fmtPct } from "./format.ts";

/** Catégories du menu Build du jeu, dans l'ordre de la capture du tier I (BAS-01) ; `ic` : icône du bouton. */
export const CATS = [
  { id: "Pipes", ic: "pipes" }, { id: "Logic", ic: "logic" }, { id: "Power", ic: "power" },
  { id: "Decorations", ic: "deco" }, { id: "Factories", ic: "factory" }, { id: "Modular", ic: "module" },
  { id: "Miscellaneous", ic: "misc" }, { id: "Extractors", ic: "extract" }, { id: "Storage Silos", ic: "tanks" },
] as const;
export const TIERS = [1, 2, 3, 4] as const;
export const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

/** Familles de tuyaux : un bouton par famille, les variantes dans le cadre d'infos. f4 : grands tuyaux, posés comme des blocs. */
export type UiFam = Fam | "f4";
export const FAMS: Record<UiFam, { kind: "o" | "f"; tier: 1 | 3 | 4 }> = { o1: { kind: "o", tier: 1 }, f1: { kind: "f", tier: 1 }, o3: { kind: "o", tier: 3 }, f3: { kind: "f", tier: 3 }, f4: { kind: "f", tier: 4 } };
const ROLE_ORD: PipeRole[] = ["droit", "coude", "té", "croix", "croisement"];

/** Un bouton de la grille : un bâtiment, ou une famille de tuyaux (`fam`, `def` = sa pièce par défaut). */
export type Entry = { key: string; cat: string; tier: number | null; def: string; fam?: UiFam };
export type Menu = { entries: Entry[]; byKey: Map<string, Entry>; variants: Record<UiFam, string[]> };

export function uiFam(cat: SbCatalog, id: string): UiFam | null {
  const f = famOf(cat, id);
  if (f) return f;
  const p = cat.blocks.get(id)?.pipe;
  return p && p.kind === "f" && p.tier === 4 && p.role !== "spécial" ? "f4" : null;
}

/** Le menu de pose : bâtiments (catégorie relevée du menu Build, sinon celle du wiki), une entrée par famille de tuyaux, les pièces spéciales à part. */
export function buildMenu(cat: SbCatalog, category: (id: string) => string | null): Menu {
  const variants = {} as Record<UiFam, string[]>;
  for (const f of Object.keys(FAMS) as UiFam[]) {
    variants[f] = [...cat.blocks.values()]
      .filter((b) => b.pipe && (uiFam(cat, b.id) === f || (b.pipe.kind === "m" && b.pipe.tier === FAMS[f].tier && f !== "f4")))
      .sort((a, b) => ROLE_ORD.indexOf(a.pipe!.role) - ROLE_ORD.indexOf(b.pipe!.role) || a.pipe!.len - b.pipe!.len || (a.cost ?? 0) - (b.cost ?? 0))
      .map((b) => b.id);
  }
  const entries: Entry[] = [];
  for (const b of cat.blocks.values()) if (!b.pipe) entries.push({ key: b.id, cat: b.buildCat ?? category(b.id) ?? "", tier: b.tier, def: b.id }); // catégorie relevée (S52), sinon celle du wiki
  for (const f of Object.keys(FAMS) as UiFam[]) {
    const def = variants[f].find((id) => cat.blocks.get(id)!.pipe!.role === "droit" && cat.blocks.get(id)!.geo) ?? variants[f][0];
    if (def) entries.push({ key: `fam:${f}`, cat: "Pipes", tier: FAMS[f].tier, def, fam: f });
  }
  for (const b of cat.blocks.values()) if (b.pipe?.role === "spécial") entries.push({ key: b.id, cat: "Pipes", tier: b.tier, def: b.id });
  return { entries, byKey: new Map(entries.map((e) => [e.key, e])), variants };
}

export const locked = (cat: SbCatalog, id: string) => !cat.blocks.get(id)?.geo;

/** Les blocs d'une catégorie d'un tier : posables d'abord, les autres en gris à la fin (jamais cachés). */
export function entriesFor(cat: SbCatalog, menu: Menu, tier: number, catId: string): Entry[] {
  return menu.entries.filter((e) => e.tier === tier && e.cat === catId).sort((a, b) => +locked(cat, a.def) - +locked(cat, b.def));
}

/** Raccourci `[tier, catégorie, bloc]` ; au-delà de 9 : dizaine puis unité, comme Mindustry. */
export function shortcut(cat: SbCatalog, menu: Menu, e: Entry): string {
  const ti = TIERS.indexOf(e.tier as 1) + 1, ci = CATS.findIndex((c) => c.id === e.cat) + 1, n = entriesFor(cat, menu, e.tier ?? 0, e.cat).indexOf(e) + 1;
  return `[${ti},${ci},${n < 10 ? n : `${Math.floor(n / 10)},${n % 10}`}]`;
}

/** Case d'ancrage (coin haut gauche) d'un bloc centré sur la case visée. */
export function anchor(def: SbBlock, c: [number, number], r: number): [number, number] {
  const [w, h] = dims(def, r);
  return [c[0] - Math.floor((w - 1) / 2), c[1] - Math.floor((h - 1) / 2)];
}

/** Maintenir et glisser : une ligne droite sur l'axe le plus long (à égalité, vertical), au pas du bloc, jamais en diagonale. */
export function linePositions(def: SbBlock, s: [number, number], e: [number, number], r: number): Piece[] {
  const [w, h] = dims(def, r), hor = Math.abs(e[0] - s[0]) > Math.abs(e[1] - s[1]), step = hor ? w : h, dist = hor ? e[0] - s[0] : e[1] - s[1];
  const n = Math.floor(Math.abs(dist) / step), sg = Math.sign(dist) || 1, a = anchor(def, s, r), out: Piece[] = [];
  for (let i = 0; i <= n; i++) out.push({ id: def.id, x: a[0] + (hor ? i * step * sg : 0), y: a[1] + (hor ? 0 : i * step * sg), r });
  return out;
}

/** Machines qui produisent (`side` = "out") ou consomment (`side` = "in") l'un de ces objets : la grille filtrée d'un port libre. */
export function machinesFor(cat: SbCatalog, items: string[], side: "in" | "out"): string[] {
  const want = new Set(items);
  return [...cat.blocks.values()]
    .filter((b) => !b.pipe && [...b.recipes, ...b.incomplete].some((r) => Object.keys(r[side]).some((i) => want.has(i))))
    .sort((a, b) => +!a.geo - +!b.geo || a.name.localeCompare(b.name))
    .map((b) => b.id);
}

// ---------------------------------------------------------------- touches

/** Actions réassignables : [action, touche physique par défaut (KeyboardEvent.code), groupe]. */
export const ACTIONS = [
  ["up", "KeyW", "move"], ["left", "KeyA", "move"], ["down", "KeyS", "move"], ["right", "KeyD", "move"],
  ["rotate", "KeyR", "build"], ["variant", "KeyQ", "build"], ["catPrev", "Comma", "build"], ["catNext", "Period", "build"],
  ["schem", "KeyF", "schem"], ["save", "KeyE", "schem"], ["flipX", "KeyZ", "schem"], ["flipY", "KeyX", "schem"], ["schemMenu", "KeyT", "schem"],
  ["links", "KeyL", "view"], ["map", "KeyM", "view"], ["wires", "F5", "view"], ["status", "F6", "view"], ["info", "F1", "view"], ["menus", "KeyC", "view"], ["research", "KeyJ", "view"],
] as const;
export type Action = (typeof ACTIONS)[number][0];
export type KeyMap = Record<Action, string | null>;
export const defaultKeys = (): KeyMap => Object.fromEntries(ACTIONS.map(([a, k]) => [a, k])) as KeyMap;
/** Touches fixes, jamais réassignées. */
export const FIXED_KEYS = ["Escape", "ShiftLeft", "ControlLeft", "Delete", "Backspace"];

const PUNCT: Record<string, string> = { Comma: ",", Period: ".", Semicolon: ";", Quote: "'", Slash: "/", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", IntlBackslash: "<" };
/** Ce qu'affiche une touche physique : la lettre du clavier du joueur si on la connaît (`layout`), sinon celle du QWERTY. */
export function keyLabel(code: string, layout: Map<string, string>): string {
  return layout.get(code) ?? (/^Key/.test(code) ? code.slice(3) : /^Digit/.test(code) ? code.slice(5) : PUNCT[code] ?? code);
}

// ---------------------------------------------------------------- textes du moteur

export type Names = { block: (id: string) => string; item: (id: string) => string };

export function reasonText(r: Reason, n: Names): string {
  return t(`bac.reason.${r.k}` as Key, "item" in r ? { item: n.item(r.item) } : undefined);
}

export function alertText(a: Alert, n: Names): string {
  switch (a.k) {
    case "machine": return t("bac.alert.machine", { name: n.block(a.id), pct: a.pct == null ? "" : ` ${t("bac.at", { pct: fmtPct(String(a.pct)) })}`, reason: reasonText(a.reason, n) });
    case "saturated": return t("bac.alert.saturated", { offered: fmt(a.offered, 2), cap: fmt(a.cap, 2), item: n.item(a.item), pipe: n.block(a.pipe) });
    case "mixed": return t("bac.alert.mixed", { items: a.items.map(n.item).join(", ") });
    case "missing": return t("bac.alert.missing", { name: n.block(a.id) });
    case "overlap": return t("bac.alert.overlap", { name: n.block(a.id) });
    case "unpowered": return t(a.pct === 0 ? "bac.alert.unpowered0" : "bac.alert.unpowered", { name: n.block(a.id), pct: fmtPct(String(a.pct)) }) + (a.continued ? ` ${t("bac.alert.continued")}` : "");
    case "weakGrid": return t("bac.alert.weakGrid", { need: fmt(a.need, 0), prod: fmt(a.prod, 0) });
    case "reversed": return t("bac.alert.reversed", { name: n.block(a.id) });
  }
}

export const routeErrorText = (e: RouteError): string => t(`bac.route.err.${e}` as Key);
export function wireErrorText(e: WireError): string {
  return e.k === "tooFar" ? t("bac.wire.tooFar", { dist: fmt(e.dist, 1), range: fmt(e.range, 1) }) : t(`bac.wire.${e.k}` as Key);
}

/** Recette en une ligne : « 2 Iron Ingot → 1 Iron Plate (4 s) » ; une quantité inconnue s'écrit « ? ». */
export function recipeLine(r: { s: number | null; in: Record<string, number | null>; out: Record<string, number | null> }, item: (id: string) => string): string {
  const side = (o: Record<string, number | null>) => Object.entries(o).map(([i, q]) => `${q == null ? "?" : fmt(q, 2)} ${item(i)}`).join(" + ");
  return `${side(r.in) || t("bac.nothing")} → ${side(r.out)} (${r.s == null ? "?" : fmt(r.s, 2)} s)`;
}
