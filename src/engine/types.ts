// Schéma des données (data/*.json). Partagé par les scripts et le moteur.
// Règle : aucune valeur sans source. Une valeur absente vaut `null` et porte un
// drapeau `verify` ; une valeur contestée garde les alternatives et leurs sources.

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
  detail: string;
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
  sources: Source[];
  verify: VerifyFlag[];
  corrections?: Correction[];
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
  sources: Source[];
  verify: VerifyFlag[];
  corrections?: Correction[];
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
};
