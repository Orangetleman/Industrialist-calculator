// Catalogue français, textes communs à plusieurs vues (S31) : champs, motifs des doutes, saisie, fichiers.
import type { Msg } from "../fr.ts";

export const communFr = {
  // ------------------------------------------------------------ motifs d'une valeur à vérifier
  "reason.manquant": "manquant",
  "reason.contradiction": "contradiction",
  "reason.non-sourcé": "non sourcé",
  "reason.approximatif": "approximatif",
  "reason.variable": "variable",

  // ------------------------------------------------------------ champs d'une recette ou d'une machine
  "field.input": "entrée : {item}",
  "field.output": "sortie : {item}",
  "field.durationS": "durée du cycle (s)",
  "field.energyMFps": "énergie",
  "field.outputs": "sorties",
  "field.cost": "prix ($)",
  "field.size": "taille (cases)",
  "field.pollutionPerHour": "pollution (%/h)",
  "field.unlockedBy": "nœud de recherche",
  "field.page": "page du wiki",
  "field.requires": "règle des prérequis",
  "field.description": "description (jeu)",
  "field.machine": "machine",
  "field.sellValue": "prix de vente ($)",
  "field.researchValue": "facteur RP",

  // ------------------------------------------------------------ saisie
  "parse.size": "format attendu : 8x8",
  "parse.energy": "nombre de MF/s attendu (ex. 4500 ou 4,5 k)",
  "parse.number": "nombre attendu",
  "parse.duration": "durée > 0 attendue",
} satisfies Record<string, Msg>;
