// Mineshaft Drill (remarque joueur n°16) : machine à recettes paramétrées. Le joueur règle la
// profondeur, la tête de forage, l'acide et l'huile ; chaque réglage donne une recette « cycle
// d'une tête » : la tête s'use pendant l'extraction, remonte, est changée, redescend.
// Valeurs lues dans data/mineshaft.json seulement (wiki Miraheze ; ce qui vient d'Industrialist
// Calculator y est marqué et renvoyé à data/a-verifier.md, MSD-xx). Pur : aucune dépendance au DOM.

import { indexProducers, type GameData } from "./data.ts";
import { msg } from "./message.ts";
import type { Recipe, Source, VerifyFlag } from "./types.ts";

type Formula = { kind: "linear" | "pow" | "square" | "hcl"; a?: number; p?: number; text: string };
export type MineshaftHead = Formula & { id: string; item: string };
export type MineshaftAcid = Formula & { id: string; item: string | null; litersPerSec: number };
export type MineshaftDepth = { depth: number; table: string; perSec: Record<string, number> };

export type MineshaftFile = {
  meta: { machine: string; openQuestions: string[] };
  sources: { page: Source; tables: Source[] };
  durability: { base: number; heads: MineshaftHead[]; acids: MineshaftAcid[]; resourceModifier: { value: number }; source: Source };
  oil: { item: string; litersPerSec: number; yieldMultiplier: number; lossMultiplier: number; travelSpeedMultiplier: number; source: Source };
  travel: { metersPerSec: number; roundTrip: boolean; source: Source; roundTripSource: Source };
  replacement: { seconds: number; source: Source };
  power: { passiveMFps: number; drillingMFps: number; travelMFps: number; travelNote: string; alternatives: { drillingMFps: number; travelMFps: number; replacementMFps: number; source: Source }; source: Source };
  acidUse: { duringExtractionOnly: boolean; source: Source };
  depths: MineshaftDepth[];
};

export type HeadId = "copper" | "iron" | "steel" | "tungsten";
export type AcidId = "none" | "water" | "acetic" | "sulfuric" | "hydrochloric";
/**
 * Réglage du plan. `depth` : une profondeur du tableau, ou "auto" : pour chaque objet, la
 * profondeur où une machine en sort le plus (le simplexe choisit ensuite parmi elles).
 */
export type MineshaftChoice = { depth: number | "auto"; head: HeadId; acid: AcidId; oil: boolean };

/**
 * Défaut : tête Steel et Hydrochloric Acid (recommandé par le wiki ; même défaut chez Industrialist
 * Calculator), sans huile, profondeur choisie par objet. Choix du site, pas une valeur du jeu.
 */
export const DEFAULT_MINESHAFT: MineshaftChoice = { depth: "auto", head: "steel", acid: "hydrochloric", oil: false };

export const MINESHAFT_PREFIX = "mineshaft_drill@";
export const isMineshaftRecipe = (id: string): boolean => id.startsWith(MINESHAFT_PREFIX);

function multi(f: Formula, d: number): number {
  switch (f.kind) {
    case "linear":
      return f.a! * d;
    case "pow":
      return f.a! * d ** f.p!;
    case "square":
      return f.a! * d * d;
    case "hcl":
      // Formule du wiki recopiée telle quelle (section Durability).
      return d < 6000 ? 0.000013 * d ** (1.5 - 0.00005 * d) + 4.3875 * 10 ** -13.3 * d ** 3 : 0.09 * d ** 0.25;
  }
}

export type MineshaftCycle = {
  depth: number;
  /** Perte de durabilité (%/s) pendant l'extraction. */
  lossPctPerSec: number;
  /** Secondes d'extraction par tête (100 % / perte). */
  extractS: number;
  /** Trajet du puits (aller-retour) à chaque changement de tête. */
  travelS: number;
  replaceS: number;
  cycleS: number;
  /** Part du cycle passée à extraire. */
  efficiency: number;
  /** Consommation moyenne sur le cycle (MF/s). */
  energyMFps: number;
  /** Par cycle (une tête) : objets extraits, acide et huile consommés. */
  outputs: Record<string, number>;
  inputs: Record<string, number>;
};

export const HEAD_IDS: readonly HeadId[] = ["copper", "iron", "steel", "tungsten"];
export const ACID_IDS: readonly AcidId[] = ["none", "water", "acetic", "sulfuric", "hydrochloric"];

/** Réglage relu (stockage du navigateur, fichier) : tout ce qui n'est pas valide reprend le défaut. */
export function cleanMineshaftChoice(x: unknown): MineshaftChoice | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const depth = typeof o.depth === "number" && Number.isInteger(o.depth) && o.depth > 0 ? o.depth : "auto";
  return {
    depth,
    head: HEAD_IDS.includes(o.head as HeadId) ? (o.head as HeadId) : DEFAULT_MINESHAFT.head,
    acid: ACID_IDS.includes(o.acid as AcidId) ? (o.acid as AcidId) : DEFAULT_MINESHAFT.acid,
    oil: o.oil === true,
  };
}

export const sameMineshaft = (a: MineshaftChoice, b: MineshaftChoice): boolean => a.depth === b.depth && a.head === b.head && a.acid === b.acid && a.oil === b.oil;

/** Cycle d'une tête à cette profondeur ; null si la profondeur n'est pas dans le tableau. */
export function mineshaftCycle(file: MineshaftFile, depth: number, c: Omit<MineshaftChoice, "depth">): MineshaftCycle | null {
  const row = file.depths.find((d) => d.depth === depth);
  const head = file.durability.heads.find((h) => h.id === c.head);
  const acid = file.durability.acids.find((a) => a.id === c.acid);
  if (!row || !head || !acid) return null;
  const oil = c.oil ? file.oil : null;
  const loss = file.durability.base * multi(head, depth) * multi(acid, depth) * file.durability.resourceModifier.value * (oil?.lossMultiplier ?? 1);
  const extractS = 100 / loss;
  const speed = file.travel.metersPerSec * (oil?.travelSpeedMultiplier ?? 1);
  const travelS = ((file.travel.roundTrip ? 2 : 1) * depth) / speed;
  const replaceS = file.replacement.seconds;
  const cycleS = extractS + travelS + replaceS;
  const p = file.power;
  const energyMFps = (p.drillingMFps * extractS + p.travelMFps * travelS + p.passiveMFps * replaceS) / cycleS;
  const outputs: Record<string, number> = {};
  for (const [item, perSec] of Object.entries(row.perSec)) outputs[item] = perSec * (oil?.yieldMultiplier ?? 1) * extractS;
  const inputs: Record<string, number> = { [head.item]: 1 };
  if (acid.item && acid.litersPerSec) inputs[acid.item] = acid.litersPerSec * (file.acidUse.duringExtractionOnly ? extractS : cycleS);
  if (oil) inputs[oil.item] = oil.litersPerSec * (extractS + travelS);
  return { depth, lossPctPerSec: loss, extractS, travelS, replaceS, cycleS, efficiency: extractS / cycleS, energyMFps, outputs, inputs };
}

/** Profondeurs retenues : celle du réglage, ou (auto) la meilleure de chaque objet en débit par machine. */
export function mineshaftDepths(file: MineshaftFile, choice: MineshaftChoice): number[] {
  // Profondeur absente du tableau (réglage d'une ancienne version) : comme « auto ».
  if (choice.depth !== "auto" && file.depths.some((d) => d.depth === choice.depth)) return [choice.depth];
  const best = new Map<string, { depth: number; rate: number }>();
  for (const row of file.depths) {
    const cy = mineshaftCycle(file, row.depth, choice);
    if (!cy) continue;
    for (const [item, n] of Object.entries(cy.outputs)) {
      const rate = n / cy.cycleS;
      const b = best.get(item);
      if (!b || rate > b.rate + 1e-12) best.set(item, { depth: row.depth, rate });
    }
  }
  return [...new Set([...best.values()].map((b) => b.depth))].sort((a, b) => a - b);
}

const flag = (field: string, reason: VerifyFlag["reason"], detail: VerifyFlag["detail"]): VerifyFlag => ({ field, reason, detail });

/** Recette d'un cycle de tête à cette profondeur. */
export function mineshaftRecipe(file: MineshaftFile, depth: number, choice: MineshaftChoice, research: string | null, nameOf: (id: string) => string = (id) => id): Recipe | null {
  const cy = mineshaftCycle(file, depth, choice);
  if (!cy) return null;
  const head = file.durability.heads.find((h) => h.id === choice.head)!;
  const acid = file.durability.acids.find((a) => a.id === choice.acid)!;
  const table = file.sources.tables.find((s) => s.page === file.depths.find((d) => d.depth === depth)!.table);
  const verify: VerifyFlag[] = [
    flag("durationS", "approximatif", msg("msd.duration")),
    flag("energyMFps", "approximatif", msg("msd.energy")),
  ];
  if (acid.item) verify.push(flag(`inputs.${acid.item}`, "approximatif", msg("msd.acid")));
  return {
    id: `${MINESHAFT_PREFIX}${depth}`,
    machine: file.meta.machine,
    durationS: cy.cycleS,
    inputs: cy.inputs,
    outputs: cy.outputs,
    energyMFps: cy.energyMFps,
    research,
    setupName: `Mineshaft Drill ${depth} m`,
    setupNote: msg("msd.note", { head: nameOf(head.item), acid: acid.item ? nameOf(acid.item) : msg("msd.noAcid"), oil: choice.oil ? " · " + nameOf(file.oil.item) : "", extract: Math.round(cy.extractS), cycle: Math.round(cy.cycleS), pct: Math.round(cy.efficiency * 100) }),
    sources: [file.sources.page, ...(table ? [table] : []), file.travel.roundTripSource, file.replacement.source],
    verify,
  };
}

/**
 * Applique le réglage : la machine devient utilisable par le calcul, ses recettes sont celles du
 * réglage (les anciennes sont retirées). Modifie les maps en place.
 */
export function applyMineshaft(recipes: Map<string, Recipe>, machines: GameData["machines"], file: MineshaftFile, choice: MineshaftChoice = DEFAULT_MINESHAFT, nameOf?: (id: string) => string): void {
  const m = machines.get(file.meta.machine);
  if (!m) return;
  m.kind = "machine";
  for (const id of [...recipes.keys()]) if (isMineshaftRecipe(id)) recipes.delete(id);
  for (const depth of mineshaftDepths(file, choice)) {
    const r = mineshaftRecipe(file, depth, choice, m.unlockedBy, nameOf);
    if (r) recipes.set(r.id, r);
  }
}

/** Données du plan avec un autre réglage du Mineshaft Drill (copie des recettes, le reste partagé). */
export function withMineshaft(data: GameData, file: MineshaftFile, choice: MineshaftChoice): GameData {
  const recipes = new Map(data.recipes);
  applyMineshaft(recipes, data.machines, file, choice, (id) => data.items.get(id)?.name ?? id);
  return { ...data, recipes, producers: indexProducers(recipes) };
}
