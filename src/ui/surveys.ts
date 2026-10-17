// Relevés de bâtiments gardés dans ce navigateur (éditeur de bâtiments), partagés avec les plans
// de pose : un relevé local sert tout de suite, sans attendre son intégration aux données.

import type { MachineInterface, PortsEntry } from "../engine/extension-types.ts";
import { parseInterfaces, parseSurveys } from "./buildings-model.ts";

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

// Interfaces des machines notées dans l'éditeur (S10) : à part des relevés de ports, pour qu'une
// interface notée sur un bâtiment sans relevé ne change pas ses ports supposés.
const KEY_IFACES = "ind-calc:v1:interfaces";

export function rawLocalInterfaces(): string {
  try {
    return localStorage.getItem(KEY_IFACES) ?? "";
  } catch {
    return "";
  }
}

export function loadLocalInterfaces(): Record<string, MachineInterface> {
  try {
    return parseInterfaces(JSON.parse(rawLocalInterfaces() || "null")) ?? {};
  } catch {
    return {};
  }
}

export function saveLocalInterfaces(local: Record<string, MachineInterface>): void {
  try {
    localStorage.setItem(KEY_IFACES, JSON.stringify({ interfaces: local }));
  } catch {
    // stockage indisponible : l'interface vaut pour la session
  }
}
