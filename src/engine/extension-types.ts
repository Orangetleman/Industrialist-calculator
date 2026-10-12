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
  /** Puissance (MF/s) selon la température de la vapeur : points [°C, MF/s], interpolation linéaire. */
  tempCurve?: { points: [number, number][]; source: Source; note: string };
  sources: Source[];
  verify: VerifyFlag[];
};
export type PowerFile = { meta: DataMeta; entries: PowerEntry[] };

export type ResearchStationsFile = {
  meta: DataMeta;
  rs1: { rate: Fact<"sqrt">; capCoef: Fact<number> };
  rs2: { rateCoef: Fact<number>; rateExp: Fact<number>; capCoef: Fact<number>; inputPerSec: Fact<number> };
  rs3: { rateCoef: Fact<number>; rateExp: Fact<number>; capCoef: Fact<number>; samePenalty: Fact<number>; inputPerSecPerNode: Fact<number>; factorThreshold: Fact<number> };
  rs4: {
    rateCoef: Fact<number>;
    rateExp: Fact<number>;
    circuitDivisor: Fact<number>;
    circuitTicksPerSec: Fact<number>;
    capCoef: Fact<number>;
    capExp: Fact<number>;
    logicWeight: Fact<number>;
    factorThreshold: Fact<number>;
  };
  satellite: { boostCoef: Fact<number>; dishes: Fact<string>; liquidPerSec: Fact<number> };
  softCap: { rs123: Fact<string>; rs4: Fact<string>; x: Fact<string> };
  startRp: Fact<{ normal: number; other: number }>;
  /** Bâtiments liés (stations, paraboles) : identifiants dans machines.json. */
  buildings: string[];
};

export type WorldFile = {
  meta: DataMeta;
  facts: Record<string, Fact<unknown>>;
  /** Grille de construction relevée en jeu ; `rotations` vaut pour tous les bâtiments (quarts de tour). */
  grid: { cellStuds: number | null; snap: string | null; rotations: number | null; sources: Source[]; verify: VerifyFlag[] };
};

/** Port d'un bâtiment, relevé en jeu (RELEVES.md). */
export type Port = {
  type: "objet" | "fluide" | "énergie" | "logique";
  direction: "entrée" | "sortie" | "les deux";
  side: "haut" | "bas" | "gauche" | "droite" | "dessus";
  /** Case le long du bord (depuis 1), ou [colonne, ligne] pour un boîtier sur le dessus. */
  cell: number | [number, number];
  /** Nombre de cases dont le plot du port dépasse du bâtiment (souvent 1). */
  stub?: number;
  /** Ce que le jeu affiche (couleur et sens de la flèche, nœuds électriques). */
  shown?: string;
  /** Info-bulle du jeu pour ce port (ex. « Input for Coal or coke Fuel »). */
  tip?: string;
};
/** Relevé d'un bâtiment. Les rotations ne sont pas par bâtiment : 4 quarts de tour pour tous (world.json). */
export type PortsEntry = {
  footprint: { w: number; h: number } | null;
  ports: Port[];
  /** Bâtiment sans prise électrique (ex. Boiler, Firebox) : le relevé est complet sans elle. */
  noPower?: boolean;
  notes?: string;
  source: Source;
};
export type PortsFile = { _lisezMoi?: string; machines: Record<string, PortsEntry> };
