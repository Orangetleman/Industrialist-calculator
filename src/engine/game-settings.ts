// Réglages de partie (S50) : la pollution globale et le mois changent certaines recettes.
// Sources : pages du wiki citées ; la seule règle absente du wiki (retrait du Tree Scrubber selon
// la pollution) vient d'Industrialist Calculator, qui la dit supposée (data/a-verifier.md, POL-13).

import { msg } from "./message.ts";
import type { Machine, Recipe, Source } from "./types.ts";

/** Valeur par défaut d'Industrialist Calculator (décision S40). */
export const DEFAULT_POLLUTION = 10;
export const TREE_SCRUBBER = "tree-scrubber";
export const TREE_SCRUBBER_RECIPE = "tree_scrubber_01";
const FETCHED = "2026-11-06T00:00:00.000Z";
const wiki = (page: string): Source => ({ wiki: "miraheze", url: `https://industrialist.miraheze.org/wiki/${page}`, page: page.replace(/_/g, " "), fetchedAt: FETCHED }) as Source;

/** Page Air Separation Unit, « Formulae » : 1 L/s jusqu'à 10 %, p ÷ 10, 20 L/s dès 200 %. */
export function asuResidue(pollutionPct: number): number {
  return Math.max(1, Math.min(20, pollutionPct / 10));
}

/** Page Igloo Farm Controller : décembre, janvier et février. */
export const isWinter = (month: number | null | undefined): boolean => month === 12 || month === 1 || month === 2;
/** Page Igloo Farm Controller : 50 % de bûches en plus en hiver. */
export const logsMultiplier = (month: number | null | undefined, igloo: boolean | undefined): number => (igloo && isWinter(month) ? 1.5 : 1);

// Courbe d'Industrialist Calculator (tree_scrubber.ts, « only assumptions »), calée sur le wiki à 0 %.
const MAX_REMOVAL = 6.6;
const STEEPNESS = 0.55;
const TAIL = 10;
const AT_ZERO = 3.88; // page Tree Scrubber : −3,88 %/h à 0 %
const CENTER = -TAIL * Math.sinh(Math.log(AT_ZERO / (MAX_REMOVAL - AT_ZERO)) / STEEPNESS);
/** Page Tree Scrubber : sous −1 500 %, il ne filtre plus (mais boit encore). */
const treeScrubberStopped = (p: number): boolean => p < -1500;

/** Pollution de la machine, en %/h (négative : elle en retire). */
export function treeScrubberPollution(pollutionPct: number): number {
  if (treeScrubberStopped(pollutionPct)) return 0;
  return -MAX_REMOVAL / (1 + Math.exp(-STEEPNESS * Math.asinh((pollutionPct - CENTER) / TAIL)));
}
export const treeScrubberResidue = (pollutionPct: number): number => (treeScrubberStopped(pollutionPct) ? 0 : 6);

/** Le Tree Scrubber, absent du relevé des machines : objet d'événement, à posséder. */
export function addTreeScrubber(machines: Map<string, Machine>, recipes: Map<string, Recipe>): void {
  const source = wiki("Tree_Scrubber");
  machines.set(TREE_SCRUBBER, {
    id: TREE_SCRUBBER,
    name: "Tree Scrubber",
    kind: "machine",
    description: "Removes pollution using only Water. Limited: obtained during Christmas Events.",
    category: "Miscellaneous",
    unlockedBy: null,
    variantOf: null,
    limited: true,
    tier: null,
    cost: 25000,
    size: { w: 9, l: 8 },
    pollutionPerHour: -AT_ZERO,
    sources: [source],
    verify: [],
  } as Machine);
  recipes.set(TREE_SCRUBBER_RECIPE, {
    id: TREE_SCRUBBER_RECIPE,
    machine: TREE_SCRUBBER,
    durationS: 1,
    inputs: { water: 18 },
    outputs: { residue: 6 },
    energyMFps: 0,
    research: null,
    pollutionPerHour: -AT_ZERO,
    sources: [source],
    verify: [{ field: "pollutionPerHour", reason: "approximatif", detail: msg("scrubber.curve") }],
  } as Recipe);
}
