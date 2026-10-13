// Relevés de bâtiments gardés dans ce navigateur (éditeur de bâtiments), partagés avec les plans
// de pose : un relevé local sert tout de suite, sans attendre son intégration aux données.

import type { PortsEntry } from "../engine/extension-types.ts";
import { parseSurveys } from "./buildings-model.ts";

const KEY = "ind-calc:v1:batiments";

/** Texte brut stocké : sert aussi de signature pour savoir si les relevés ont changé. */
export function rawLocalSurveys(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function loadLocalSurveys(): Record<string, PortsEntry> {
  try {
    return parseSurveys(JSON.parse(rawLocalSurveys() || "null")) ?? {};
  } catch {
    return {};
  }
}

export function saveLocalSurveys(local: Record<string, PortsEntry>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ machines: local }));
  } catch {
    // stockage indisponible : le relevé vaut pour la session
  }
}
