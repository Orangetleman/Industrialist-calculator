// Catalogue des pièces de construction (tuyaux, croisements, poteaux), lu dans logistics.json et
// power.json. Pur, sans DOM. Ce que les wikis ne disent pas est marqué comme hypothèse.

import type { LogisticsFile, PowerFile } from "../extension-types.ts";
import type { Message } from "../message.ts";

export type PipeKind = "objet" | "fluide";
export type PipeTier = 1 | 3;
/** Rôle d'une pièce dans un tracé : droite, coude, embranchement à 3 ou 4 voies, croisement de deux lignes. */
export type PieceRole = "droit" | "coude" | "té" | "croix" | "croisement";

export type Piece = { id: string; name: string; price: number | null; flowPerSec: number | null };
export type PipeSet = { kind: PipeKind; tier: PipeTier; flowPerSec: number; pieces: Record<Exclude<PieceRole, "croisement">, Piece> };

export type Catalog = {
  pipes: PipeSet[];
  /** Croisement d'une case (deux lignes qui se croisent sans se mélanger), par paire de types. */
  crossings: { objet: Piece | null; fluide: Piece | null; mixte: Piece | null };
  /** Portée en tuiles (unité du wiki) et en cases : relevé en jeu, une tuile = deux cases. */
  poles: { id: string; name: string; perNodeMFps: number; nodes: number; /** Capacité du poteau : la somme de ses nœuds (relevé du 2026-10-13 : on compte le poteau comme si tous ses nœuds étaient reliés). */ capacityMFps: number; rangeTiles: number; rangeCells: number; size: { w: number; h: number }; price: number | null }[];
  /** Hypothèses faites faute de donnée, à confirmer en jeu (affichées avec chaque plan). */
  assumptions: Message[];
};

/** Pièces de chaque jeu de tuyaux (ids du wiki). Seules les pièces d'une case sont utilisées. */
const SETS: { kind: PipeKind; tier: PipeTier; ids: Record<Exclude<PieceRole, "croisement">, string> }[] = [
  { kind: "objet", tier: 1, ids: { droit: "short-pipe", coude: "pipe-turn", té: "pipe-junction", croix: "pipe-section" } },
  { kind: "fluide", tier: 1, ids: { droit: "short-fluid-pipe", coude: "fluid-pipe-turn", té: "fluid-pipe-junction", croix: "fluid-pipe-section" } },
  { kind: "objet", tier: 3, ids: { droit: "short-pipe2", coude: "pipe-turn2", té: "pipe-junction2", croix: "pipe-section2" } },
  { kind: "fluide", tier: 3, ids: { droit: "short-fluid-pipe2", coude: "pipe-fluid-turn2", té: "pipe-fluid-junction2", croix: "pipe-fluid-section2" } },
];

export function buildCatalog(logistics: LogisticsFile, power: PowerFile, poleRangeTiles: Record<string, number> = {}, cellsPerTile = 2): Catalog {
  const byId = new Map(logistics.pipes.map((p) => [p.id, p]));
  const piece = (id: string): Piece | null => {
    const p = byId.get(id);
    return p ? { id, name: p.name, price: p.price ?? null, flowPerSec: p.flowPerSec ?? null } : null;
  };
  const pipes: PipeSet[] = [];
  for (const s of SETS) {
    const ps = Object.fromEntries(Object.entries(s.ids).map(([role, id]) => [role, piece(id)])) as Record<string, Piece | null>;
    const flow = ps.droit?.flowPerSec;
    if (Object.values(ps).some((x) => !x) || !flow) continue;
    pipes.push({ kind: s.kind, tier: s.tier, flowPerSec: flow, pieces: ps as PipeSet["pieces"] });
  }
  const poles = power.entries
    .filter((e) => e.subcategory === "Transfer Poles" && e.transfer && ["lv-pole", "mv-pole", "small-mv-pole", "advanced-mv-pole", "hmvt"].includes(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      perNodeMFps: e.transfer!.perNode,
      capacityMFps: e.transfer!.perNode * Math.max(1, e.transfer!.nodes ?? 1),
      nodes: e.transfer!.nodes,
      rangeTiles: poleRangeTiles[e.id] ?? e.rangeTiles?.tiles ?? 0,
      rangeCells: (poleRangeTiles[e.id] ?? e.rangeTiles?.tiles ?? 0) * cellsPerTile,
      size: { w: e.size?.w ?? 1, h: e.size?.l ?? 1 },
      price: e.cost,
    }))
    .filter((p) => p.rangeTiles > 0);
  return {
    pipes,
    crossings: { objet: piece("pipe-intersection"), fluide: piece("fluid-pipe-intersection"), mixte: piece("fluid-pipe-and-item-intersection") },
    poles,
    // Relevés de l'utilisateur (2026-10-13) : Junction = 3 voies, Section = 4 voies ; un croisement de
    // tier III se raccorde aux tuyaux de tier I ; un collecteur répartit les objets entre les machines.
    assumptions: [],
  };
}

/** Jeu de tuyaux le moins cher qui porte ce débit (objets ou litres par seconde), ou null s'il n'y en a pas. */
export function pipeFor(cat: Catalog, kind: PipeKind, perSec: number, tier3Only = false): PipeSet | null {
  const ok = cat.pipes.filter((p) => p.kind === kind && p.flowPerSec >= perSec - 1e-9 && (!tier3Only || p.tier === 3));
  return ok.sort((a, b) => (a.pieces.droit.price ?? Infinity) - (b.pieces.droit.price ?? Infinity) || a.tier - b.tier)[0] ?? null;
}
