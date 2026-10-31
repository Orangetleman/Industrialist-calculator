// Bac à sable (B1) : les blocs posables, tirés des données du jeu.
// Machines et recettes viennent de `buildGameData` (corrections d'overrides.json comprises), les ports de
// ports.json, les tuyaux de logistics.json, l'électricité de power.json et des relevés. Aucune valeur ajoutée
// à la main : ce que les fichiers ne disent pas reste inconnu (null).

import type { GameData } from "../data.ts";
import type { LogisticsFile, PortsEntry, PortsFile, PowerFile } from "../extension-types.ts";

export type Dir = "N" | "E" | "S" | "W";
/** o objet, f fluide, p électrique, g logique. */
export type PortType = "o" | "f" | "p" | "g";
/** e entrée, s sortie, l les deux. */
export type PortRole = "e" | "s" | "l";
/**
 * Port relevé, bâtiment non tourné. Sur un côté : `c` = case le long du bord (depuis 1), `span` = largeur
 * (2 pour un grand tuyau). Sur le dessus (prise électrique ou logique) : centre `cx`, `cy` (depuis 1, demi-cases).
 */
export type RawPort = { t: PortType; d: PortRole; tip?: string; items?: string[]; s: Dir | "top"; c?: number; span?: number; cx?: number; cy?: number };
export type BlockGeo = { w: number; h: number; ports: RawPort[] };
/** Recette par cycle de `s` secondes ; `e` en MF/s (négatif = produit), null = inconnu. */
export type SbRecipe = { id: string; s: number; in: Record<string, number>; out: Record<string, number>; e: number | null };
export type PipeRole = "droit" | "coude" | "té" | "croix" | "croisement" | "spécial";
export type PipeInfo = { kind: "o" | "f" | "m"; flow: number | null; role: PipeRole; len: number; rusty: boolean; tier: number };
/** `out` : MF/s produits ; `cap` : ce que transporte chaque prise (« transfer » par nœud) ; `range` : portée en cases. */
export type ElecInfo = { out: number | number[] | null; cap: number | null; range: number | null };
export type SbBlock = { id: string; name: string; tier: number | null; cost: number | null; poll: number; geo: BlockGeo | null; recipes: SbRecipe[]; pipe?: PipeInfo; elec?: ElecInfo };
export type SbItem = { name: string; fluid: boolean; sell: number | null };
export type SbCatalog = { blocks: Map<string, SbBlock>; items: Map<string, SbItem> };

export type SandboxFiles = { ports: PortsFile; logistics: LogisticsFile; power: PowerFile; releves: { poleRangeTiles?: Record<string, number> } };

const SIDE: Record<string, Dir> = { haut: "N", bas: "S", gauche: "W", droite: "E" };
const ROLE: Record<string, PortRole> = { "entrée": "e", sortie: "s", "les deux": "l" };
const TYPE: Record<string, PortType> = { objet: "o", fluide: "f", "énergie": "p", logique: "g" };

/** Ports d'un relevé. Les grands tuyaux notent chaque port en deux moitiés (« 1/2 », « 2/2 ») : un seul port de 2 cases. */
export function readGeo(entry: PortsEntry | undefined): BlockGeo | null {
  if (!entry?.footprint) return null;
  const out: RawPort[] = [];
  for (const x of entry.ports ?? []) {
    const t = TYPE[x.type];
    if (!t) continue;
    const base = { t, d: ROLE[x.direction] ?? "l", ...(x.tip ? { tip: x.tip } : {}), ...(x.items?.length ? { items: x.items } : {}) };
    if (x.side === "dessus" && Array.isArray(x.cell)) out.push({ ...base, s: "top", cx: x.cell[0], cy: x.cell[1] });
    else if (SIDE[x.side] && typeof x.cell === "number") out.push({ ...base, s: SIDE[x.side]!, c: x.cell });
  }
  const half = (q: RawPort) => q.c != null && /large fluid pipe/i.test(q.tip ?? "") && /(^|\s)[12]?\/2\b/.test(q.tip ?? "");
  const merged: (RawPort & { full?: boolean })[] = [];
  for (const q of out) {
    if (!half(q)) { merged.push(q); continue; }
    const mate = merged.find((m) => m.span === 2 && m.s === q.s && m.t === q.t && Math.abs(m.c! - q.c!) === 1 && !m.full);
    if (mate) { mate.c = Math.min(mate.c!, q.c!); mate.full = true; }
    else merged.push({ ...q, span: 2, tip: q.tip!.replace(/\s*[12]?\/2\s*/, " ") });
  }
  return { w: entry.footprint.w, h: entry.footprint.h, ports: merged.map(({ full: _f, ...p }) => p) };
}

export function pipeRole(id: string): PipeRole {
  if (/intersection/.test(id)) return "croisement";
  if (/turn/.test(id)) return "coude";
  if (/junction/.test(id)) return "té";
  if (/section/.test(id)) return "croix";
  if (/^(short-|long-)?(large-)?(fluid-)?pipe2?$|^short-large-fluid-pipe$|^long-large-fluid-pipe$/.test(id)) return "droit";
  return "spécial";
}

export function buildSandboxCatalog(data: GameData, files: SandboxFiles): SbCatalog {
  const ports = files.ports.machines;
  const power = new Map(files.power.entries.map((e) => [e.id, e]));
  const elec = (id: string): ElecInfo | undefined => {
    const e = power.get(id), r = files.releves.poleRangeTiles?.[id] ?? e?.rangeTiles?.tiles;
    if (!e && r == null) return undefined;
    return { out: e?.output ?? null, cap: e?.transfer?.perNode ?? null, range: r != null ? r * 2 : null }; // 1 tile = 2 cases (relevé du 2026-10-13)
  };
  const blocks = new Map<string, SbBlock>();
  const pipeIds = new Set(files.logistics.pipes.map((p) => p.id));
  for (const m of data.machines.values()) {
    if (pipeIds.has(m.id) || m.category == null) continue;
    const recipes: SbRecipe[] = [];
    for (const r of data.recipes.values()) {
      // Recettes aux quantités ou à la durée inconnues : hors du bac à sable (rien n'est supposé).
      if (r.machine !== m.id || r.parts || !(r.durationS! > 0)) continue;
      if (![...Object.values(r.inputs), ...Object.values(r.outputs)].every((q) => typeof q === "number")) continue;
      recipes.push({ id: r.id, s: r.durationS!, in: r.inputs as Record<string, number>, out: r.outputs as Record<string, number>, e: r.energyMFps });
    }
    recipes.sort((a, b) => a.id.localeCompare(b.id));
    const poll = typeof m.pollutionPerHour === "number" ? m.pollutionPerHour : 0;
    blocks.set(m.id, { id: m.id, name: m.name, tier: m.tier, cost: m.cost, poll, geo: readGeo(ports[m.id]), recipes, elec: elec(m.id) });
  }
  for (const p of files.logistics.pipes) {
    const role = pipeRole(p.id), geo = readGeo(ports[p.id]);
    const kind = p.kind === "objet" ? "o" : p.kind === "fluide" ? "f" : "m";
    const tier = p.tier ?? (/^large/.test(p.id) ? 4 : 3); // Special Pipes : T3, « Large … » en T4 (décision du 2026-10-27)
    blocks.set(p.id, { id: p.id, name: p.name, tier, cost: p.price, poll: 0, geo, recipes: [], pipe: { kind, flow: p.flowPerSec, role, len: role === "droit" && geo ? Math.max(geo.w, geo.h) : 1, rusty: /rusty/.test(p.id), tier } });
  }
  const items = new Map<string, SbItem>();
  for (const i of data.items.values()) items.set(i.id, { name: i.name, fluid: !!i.isFluid, sell: i.sellValue });
  return { blocks, items };
}
