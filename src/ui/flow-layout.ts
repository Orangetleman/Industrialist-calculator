import { fmt } from "./format.ts";

/** Débit lisible d'une liaison du plan. */
export const flowLabel = (perMin: number) => `${fmt(perMin, perMin >= 100 ? 0 : 1)}/min`;
