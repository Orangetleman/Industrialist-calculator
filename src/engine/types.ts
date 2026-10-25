// Schéma des données (data/*.json). Partagé par les scripts et le moteur.
// Règle : aucune valeur sans source. Une valeur absente vaut `null` et porte un
// drapeau `verify` ; une valeur contestée garde les alternatives et leurs sources.

import type { FarmGeometry } from "./build/assembly.ts";
import type { Text } from "./message.ts";

export type SourceKind = "miraheze" | "fandom" | "desmos" | "jeu" | "saisie";

export type Source = {
  wiki: SourceKind;
  url?: string;
  page?: string;
  revisionId?: number;
  /** Date de relevé (ISO). */
  fetchedAt: string;
  note?: string;
};

export type VerifyReason =
  | "manquant" // aucune source ne donne la valeur
  | "contradiction" // deux sources diffèrent
  | "non-sourcé" // valeur présente mais sans source exploitable
  | "approximatif" // la source donne « ~ », « au moins », une plage…
  | "variable"; // dépend d'un paramètre du jeu (vitesse du Chemical Plant, température…)

export type Alternative = { value: unknown; source: Source };

/** Correction appliquée par-dessus le wiki (overrides.json ou saisie dans l'appli). */
export type Correction = { field: string; previous: unknown; value: unknown; source: Source; resolvedFlags: VerifyFlag[] };

export type VerifyFlag = {
  /** Chemin du champ : "durationS", "energyMFps", "inputs.steel-ingot", "cost", "size"… */
  field: string;
  reason: VerifyReason;
  /** Note des données (en français, traduite par data/i18n/en.json) ou message du moteur (S32). */
  detail: Text;
  /** Mode du wiki pour une valeur variable (ex. "plant_speed_efficency"). */
  mode?: string;
  alternatives?: Alternative[];
};

export type Item = {
  id: string;
  name: string;
  isFluid: boolean | null;
  sellValue: number | null;
  /** « Research value » (multiplicateur de RP), texte brut quand c'est une plage. */
  researchValue: number | string | null;
  /** Description en jeu (citation du wiki), si elle existe ; sinon recopiée par le joueur (correction). */
  description?: string;
  sources: Source[];
  verify: VerifyFlag[];
  corrections?: Correction[];
  /** Objet ajouté par le joueur (absent des wikis, relevé en jeu) : sa source. */
  added?: Source;
};

export type Size = { w: number; l: number };

export type Machine = {
  id: string;
  name: string;
  /** farm = arbre (hors total des machines) ; building = autre bâtiment de l'arbre, jamais utilisé par le calcul. */
  kind: "machine" | "farm" | "building";
  /** Description en jeu (citation de la page du wiki), si elle existe. */
  description: string | null;
  /** Catégorie du wiki (Factories, Power…). */
  category: string | null;
  /** Nœud de recherche qui la débloque ; null = inconnu (voir verify). */
  unlockedBy: string | null;
  /** Variante esthétique ou alternative d'une autre machine (champ Variant du wiki). */
  variantOf: string | null;
  /** Machine marquée « Limited » sur le wiki (édition limitée). */
  limited: boolean;
  tier: number | null;
  cost: number | null;
  size: Size | null;
  /** Pollution générée en fonctionnement, en %/h ; plage → [min, max]. */
  pollutionPerHour: number | [number, number] | null;
  sources: Source[];
  verify: VerifyFlag[];
  corrections?: Correction[];
};

export type Recipe = {
  id: string;
  machine: string;
  durationS: number | null;
  /** Quantités par cycle ; null = variable ou inconnue (voir verify). */
  inputs: Record<string, number | null>;
  outputs: Record<string, number | null>;
  /** MF/s pendant le cycle ; négatif = production d'énergie. */
  energyMFps: number | null;
  /** Nœud requis (celui de la machine). */
  research: string | null;
  /** Durée qui dépend de la pollution (arbres). */
  durationByPollution?: boolean;
  /**
   * Installation composée (énergie, phase E2) : machines par installation, la recette décrivant
   * l'installation entière (ex. 1 Firebox + 2 Boilers + 2 Large Turbines).
   */
  parts?: { machine: string; count: number; perFarm?: boolean }[];
  /**
   * Ferme d'arbres (S13) : l'arbre est compté avec les blocs de sa ferme (parts, `perFarm` : une
   * fois par ferme) ; l'eau des arroseurs (par seconde) et l'électricité des coupes (par arbre
   * coupé) dépendent de la durée de pousse, calculées avec elle (evalRecipe).
   */
  farm?: {
    waterItem: string;
    waterLpsPerTree: number;
    energyPerCutMF: number;
    /** Géométrie de la ferme (S14) : les blocs se comptent d'après le plan de pose (fermes, récolteurs, sorties…). */
    geometry?: FarmGeometry;
  };
  /** Installation qui ne se pose qu'entière (moteur diesel modulaire) : ses pièces suivent le nombre d'installations arrondi. */
  wholeUnits?: boolean;
  /** Nom lisible d'une installation composée, et sa note (hypothèses, conseils). */
  setupName?: Text;
  setupNote?: Text;
  /** Écart observé en jeu (ex. vapeur moins chaude que le wiki) : à afficher avec le plan. */
  setupObserved?: string;
  /** Pollution propre à la recette (%/h par machine), si elle diffère de celle de la machine (Scrubber). */
  pollutionPerHour?: number;
  /** Production d'énergie constante (nuit, vent faible) ; false : moyenne sur la journée. */
  energyGuaranteed?: boolean;
  sources: Source[];
  verify: VerifyFlag[];
  corrections?: Correction[];
  /** Craft ajouté par le joueur (absent des wikis, relevé en jeu) : sa source. */
  added?: Source;
  /**
   * Réglage chiffré de la machine appliqué (S10, écran de la Chemical Plant) : les quantités et
   * l'énergie ci-dessus sont déjà multipliées ; `base` garde les valeurs du craft à 1×.
   */
  screen?: { inputs: number; outputs: number; energy: number; base: Pick<Recipe, "inputs" | "outputs" | "energyMFps"> };
};

export type ResearchCategory = "Production" | "Energy" | "Utility";

export type ResearchNode = {
  id: string;
  name: string;
  category: ResearchCategory;
  rp: number;
  children: string[];
  parents: string[];
  /** Règle des prérequis quand il y a plusieurs parents (déduction, cf. PLAN Q4). */
  requires: "all" | "any";
  unlocksMachines: string[];
  /** Bâtiments cités par le wiki qui ne sont pas des machines de production. */
  unlocksOther: string[];
  reqItems: { item: string; amount: number }[];
  isRoot: boolean;
  /** Acquise d'office dans un nouveau monde (relevé en jeu), comme les racines. */
  startUnlocked?: boolean;
  /** Description affichée en jeu : absente des wikis, saisie par le joueur (correction). */
  description?: string | null;
  sources: Source[];
  verify: VerifyFlag[];
  corrections?: Correction[];
};

/** Temps de pousse des arbres selon la pollution (page Tree). */
export type GrowthBand = {
  minPct: number | null; // null = -∞
  maxPct: number | null; // null = +∞
  seconds: [number, number];
  label: string;
};

/**
 * Formule de pousse des arbres (calculateur Desmos communautaire lié depuis la page Tree).
 *   D(p) = p > 0 : a + b·p + c·p²  |  p < negBelow : negSlope·p + negIntercept  |  1
 *   M(p) = clamp(D(p), clampMin, clampMax)
 *   N    = ceil(points / (pointsDivisor · M(p)))
 *   A(n) = n ≤ 0 : 0  |  1 + moyenne(A(n − k) pour k ∈ avgOffsets)
 *   durée (s) = cycleFactor · (1000 / tickMs) · A(N)
 */
export type TreeGrowthFormula = {
  posCoefs: [number, number, number];
  negBelow: number;
  negSlope: number;
  negIntercept: number;
  clampMin: number;
  clampMax: number;
  points: number;
  pointsDivisor: number;
  avgOffsets: number[];
  cycleFactor: number;
  tickMs: number;
  logsPerTree: number;
  source: Source;
};

export type DataMeta = {
  generatedAt: string;
  primary: SourceKind;
  counts: Record<string, number>;
};

export type ItemsFile = { meta: DataMeta; items: Item[] };
export type TreeGrowth = { bands: GrowthBand[]; source: Source; calculatorUrl?: string; formula?: TreeGrowthFormula };
export type MachinesFile = { meta: DataMeta; machines: Machine[]; treeGrowth: TreeGrowth };
export type RecipesFile = { meta: DataMeta; recipes: Recipe[] };
export type ResearchFile = { meta: DataMeta; nodes: ResearchNode[] };

/**
 * Corrections prioritaires (data/overrides.json, ou saisies dans l'appli).
 * Clé = id de l'objet, puis chemin du champ.
 */
export type OverrideEntry = { value: unknown; source: Source };
export type OverridesFile = {
  recipes?: Record<string, Record<string, OverrideEntry>>;
  machines?: Record<string, Record<string, OverrideEntry>>;
  items?: Record<string, Record<string, OverrideEntry>>;
  research?: Record<string, Record<string, OverrideEntry>>;
  /** Objets et crafts absents des wikis, relevés en jeu (S6). */
  added?: { items?: Record<string, AddedItem>; recipes?: Record<string, AddedRecipe> };
  /** Crafts qui n'existent pas en jeu : retirés des calculs (S6), réversibles. */
  removed?: { recipes?: Record<string, RemovedEntry> };
};

/** Objet manquant : valeurs inconnues à null. */
export type AddedItem = { name: string; isFluid: boolean | null; sellValue: number | null; researchValue: number | null; source: Source };
/** Craft manquant : la recherche nécessaire est celle de la machine. */
export type AddedRecipe = { machine: string; durationS: number; energyMFps: number; inputs: Record<string, number>; outputs: Record<string, number>; source: Source };
export type RemovedEntry = { source: Source };
