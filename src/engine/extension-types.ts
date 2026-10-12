// Schéma des données de l'extension (énergie, logistique, RP, monde, ports).
// Même règle que le reste : chaque valeur a une source ; une valeur absente vaut null et est signalée.

import type { DataMeta, Size, Source, VerifyFlag } from "./types.ts";

/** Valeur tirée d'une phrase ou d'une formule du wiki, avec la citation exacte. */
export type Fact<T> = { value: T | null; source: Source; quote?: string; problem?: string };

export type PipePiece = {
  id: string;
  name: string;
  section: string;
  tier: number | null;
  kind: "objet" | "fluide" | "mixte";
  price: number | null;
  capacity: number | null;
  capacityRaw: string;
  flowPerSec: number | null;
  flowRaw: string;
  /** Dimensions en studs (unité du wiki pour les tuyaux). */
  sizeStuds: { w: number; l: number } | null;
  quote: string;
  gamepass: boolean;
  complex: boolean;
  sources: Source[];
  verify: VerifyFlag[];
};

export type StorageEntry = { id: string; name: string; kind: "objet" | "fluide"; size: Size | null; cost: number | null; capacity: number | null; sources: Source[]; verify: VerifyFlag[] };
export type DepotEntry = { id: string; name: string; kind: "objet" | "fluide"; size: Size | null; cost: number | null; itemsPerSec: number | null; sources: Source[]; verify: VerifyFlag[] };
export type LogisticsFile = { meta: DataMeta; pipes: PipePiece[]; storage: StorageEntry[]; depots: DepotEntry[] };

export type PerNode = { perNode: number; nodes: number };
export type PowerEntry = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  /** Puissance produite (MF/s), seule ou en plage selon la météo, l'heure ou la vapeur. */
  output: number | [number, number] | null;
  input: number | [number, number] | null;
  transfer: PerNode | null;
  capacity: PerNode | null;
  rangeTiles: { tiles: number; approx: boolean } | null;
  size: Size | null;
  cost: number | null;
  pollutionPerHour: number | [number, number] | null;
  sources: Source[];
  verify: VerifyFlag[];
};
export type PowerFile = { meta: DataMeta; entries: PowerEntry[] };

export type ResearchStationsFile = {
  meta: DataMeta;
  rs1: { rate: Fact<"sqrt">; capCoef: Fact<number> };
  rs2: { rateCoef: Fact<number>; rateExp: Fact<number>; capCoef: Fact<number>; inputPerSec: Fact<number> };
  rs3: { rateCoef: Fact<number>; rateExp: Fact<number>; capCoef: Fact<number>; samePenalty: Fact<number>; inputPerSecPerNode: Fact<number> };
  satellite: { boostCoef: Fact<number>; dishes: Fact<string>; liquidPerSec: Fact<number> };
  softCap: { rs123: Fact<string>; rs4: Fact<string>; x: Fact<string> };
  startRp: Fact<{ normal: number; other: number }>;
  /** Bâtiments liés (stations, paraboles) : identifiants dans machines.json. */
  buildings: string[];
};

export type WorldFile = {
  meta: DataMeta;
  facts: Record<string, Fact<unknown>>;
  /** Unité de la grille de construction : à relever en jeu (RELEVES.md § 0). */
  grid: { cellStuds: number | null; snap: string | null; rotations: number | null; sources: Source[]; verify: VerifyFlag[] };
};

/** Port d'un bâtiment, relevé en jeu (RELEVES.md). */
export type Port = {
  type: "objet" | "fluide" | "énergie" | "logique";
  direction: "entrée" | "sortie" | "les deux";
  side: "haut" | "bas" | "gauche" | "droite" | "dessus";
  /** Case le long du bord (depuis 1), ou [colonne, ligne] pour un boîtier sur le dessus. */
  cell: number | [number, number];
  shown?: string;
  height?: "bas" | "mi-hauteur" | "sommet";
};
export type PortsEntry = { footprint: { w: number; h: number } | null; rotations: number | null; ports: Port[]; notes?: string; source: Source };
export type PortsFile = { _lisezMoi?: string; machines: Record<string, PortsEntry> };
