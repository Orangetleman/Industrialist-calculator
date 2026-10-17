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
  /**
   * Consommation électrique par bâtiment (MF/s, infobox du wiki). Pour la RS4, c'est la
   * consommation de la paire RS3 + RS4 (« increases power consumption to 5 MMF/s »).
   */
  power: Record<string, Fact<number>>;
  /** Mini-jeu Logic de la RS4 : durée d'une résolution, en ticks logiques (la plus rapide qui reste stable). */
  logicTicks: Fact<number>;
  /** Bâtiments liés (stations, paraboles) : identifiants dans machines.json. */
  buildings: string[];
};

export type WorldFile = {
  meta: DataMeta;
  facts: Record<string, Fact<unknown>>;
  /** Grille de construction relevée en jeu ; `rotations` vaut pour tous les bâtiments (quarts de tour). */
  grid: { cellStuds: number | null; snap: string | null; rotations: number | null; sources: Source[]; verify: VerifyFlag[] };
};

/** Machine d'une installation composée, et combien par installation (fractionnaire pour les batteries). */
export type EnergySetupPart = { machine: string; count: number };

/**
 * Installation énergétique complète (phase E2) : chauffe-eau + Boilers + turbines, panneau
 * solaire avec son stockage de nuit, éolienne… Calculée à partir des faits du wiki et de la courbe
 * des turbines ; le moteur la traite comme une recette « composée ».
 */
export type EnergySetup = {
  id: string;
  name: string;
  kind: "thermique" | "solaire" | "éolien";
  /** Machine principale (déblocage, affichage). */
  machine: string;
  parts: EnergySetupPart[];
  /** Consommation (combustible) et sorties hors énergie, par seconde et par installation. */
  inputsPerSec: Record<string, number>;
  outputsPerSec: Record<string, number>;
  /** Puissance produite par installation (MF/s). */
  mfps: number;
  /** Production constante, nuit et vent faible compris (sinon : moyenne sur la journée). */
  guaranteed: boolean;
  pollutionPerHour: number | null;
  note: string;
  sources: Source[];
  verify: VerifyFlag[];
  /** Vapeur observée en jeu (thermique) : puissance par installation dans cette fourchette, et la phrase à afficher. */
  observed?: { steamC: [number, number]; mfps: [number, number]; note: string };
};

export type EnergyFile = {
  meta: DataMeta;
  setups: EnergySetup[];
  /** Installations non calculées faute de donnée (à relever en jeu), avec la raison. */
  notComputed: { machine: string; reason: string }[];
  /** Pollution par Scrubber en fonctionnement selon la recette (%/h ; < 0 = retirée). */
  scrubbers: { recipe: string; pollutionPerHour: number; source: Source; quote: string }[];
  facts: Record<string, Fact<unknown>>;
};

/** Port d'un bâtiment, relevé en jeu (RELEVES.md). */
export type Port = {
  type: "objet" | "fluide" | "énergie" | "logique";
  direction: "entrée" | "sortie" | "les deux";
  side: "haut" | "bas" | "gauche" | "droite" | "dessus";
  /** Case le long du bord (depuis 1), ou [colonne, ligne] pour un boîtier sur le dessus. */
  cell: number | [number, number];
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
  /** Bâtiment sans port objet, fluide ni logique (ex. Tree, Farm Harvester) : le relevé est complet sans eux. */
  noPorts?: boolean;
  notes?: string;
  source: Source;
};
export type PortsFile = { _lisezMoi?: string; machines: Record<string, PortsEntry>; interfaces?: Record<string, MachineInterface> };

/**
 * Interface d'une machine (S10, décision Q5) : l'étiquette « [E] Interact », un levier ou un écran
 * qui règle la machine. Rien pour le placement, seulement la configuration et son effet sur le calcul.
 */
export type InterfaceKind = "fenêtre" | "levier" | "choix direct" | "bouton";
/** Position d'un réglage : le texte du jeu et les crafts que la machine fait dans cette position. */
export type InterfaceChoice = { label: string; recipes: string[]; doubt?: string };
/** Réglage chiffré : sa valeur par défaut et ce qu'il multiplie dans tous les crafts de la machine. */
export type InterfaceNumber = { default: number; scales: "entrées" | "sorties" | "énergie" | null };
/** Un réglage : des positions, ou un nombre ; ni l'un ni l'autre : sans effet sur le calcul. */
export type InterfaceSetting = { id: string; name: string; choices?: InterfaceChoice[]; number?: InterfaceNumber; note?: string };
export type MachineInterface = {
  kind: InterfaceKind;
  /** Où se trouve l'interface sur la machine (« sur le côté », « écran à l'avant »…). */
  where?: string;
  /** Choix définitif (fait à la pose, ne se change plus : Quarry). */
  once?: boolean;
  settings: InterfaceSetting[];
  /** Pourquoi le réglage ne change pas le calcul (porte logique, centrale non calculée…). */
  effect?: string;
  notes?: string;
  sources: Source[];
};
export type InterfacesFile = { _lisezMoi?: string; machines: Record<string, MachineInterface> };
