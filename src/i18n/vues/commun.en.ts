// Catalogue anglais, textes communs (S31) : les mêmes clés que commun.fr.ts.
import type { Msg } from "../fr.ts";
import type { communFr } from "./commun.fr.ts";

export const communEn: { [K in keyof typeof communFr]: Msg } = {
  // ------------------------------------------------------------ motifs d'une valeur à vérifier
  "reason.manquant": "missing",
  "reason.contradiction": "conflict",
  "reason.non-sourcé": "unsourced",
  "reason.approximatif": "approximate",
  "reason.variable": "variable",

  // ------------------------------------------------------------ champs d'une recette ou d'une machine
  "field.input": "input: {item}",
  "field.output": "output: {item}",
  "field.durationS": "cycle time (s)",
  "field.energyMFps": "power",
  "field.outputs": "outputs",
  "field.cost": "price ($)",
  "field.size": "size (cells)",
  "field.pollutionPerHour": "pollution (%/h)",
  "field.unlockedBy": "research node",
  "field.page": "wiki page",
  "field.requires": "prerequisite rule",
  "field.description": "description (game)",
  "field.machine": "machine",
  "field.sellValue": "sell price ($)",
  "field.researchValue": "RP factor",

  // ------------------------------------------------------------ saisie
  "parse.size": "expected format: 8x8",
  "parse.energy": "MF/s number expected (e.g. 4500 or 4.5k)",
  "parse.number": "number expected",
  "parse.duration": "duration > 0 expected",
};
