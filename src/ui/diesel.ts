// Moteur diesel (S18) : relevés de configuration gardés dans ce navigateur, choix de la
// configuration pour un plan (carburant, critère ou configuration imposée), et ses contrôles
// dans la barre du bas du schéma. Fonctions pures pour le HTML.

import { esc, fmt } from "./format.ts";
import { DIESEL_FUELS, dieselFuelName, dieselLitersPerMMF, dieselPick, parseDieselReading, type DieselConfig, type DieselPickMode, type DieselReading } from "../engine/modular-calc.ts";
import { controllerPanel } from "./assembly-view.ts";

const KEY = "ind-calc:v1:diesel";

export function loadDieselReadings(): DieselReading[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as { diesel?: unknown } | null;
    return Array.isArray(raw?.diesel) ? raw!.diesel.map(parseDieselReading).filter((r): r is DieselReading => !!r) : [];
  } catch {
    return [];
  }
}

export function saveDieselReadings(list: DieselReading[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ diesel: list }));
  } catch {
    // stockage indisponible : le relevé vaut pour la session
  }
}

/** Choix du moteur pour un plan : carburant, critère, configuration imposée (null : selon le critère). */
export type DieselChoice = { fuel: string; mode: DieselPickMode; config: string | null };
export const DEFAULT_DIESEL: DieselChoice = { fuel: "refined-diesel", mode: "carburant", config: null };

export function cleanDieselChoice(x: unknown): DieselChoice | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  return {
    fuel: typeof o.fuel === "string" && (DIESEL_FUELS as readonly string[]).includes(o.fuel) ? o.fuel : DEFAULT_DIESEL.fuel,
    mode: o.mode === "place" || o.mode === "puissance" ? o.mode : "carburant",
    config: typeof o.config === "string" ? o.config : null,
  };
}

export type DieselMeasures = { area: (c: DieselConfig) => number | null };

/** Id de la recette du moteur à garder pour ce plan ; « aucun » si aucun moteur relevé avec ce carburant. */
export function dieselRecipeFor(configs: DieselConfig[], choice: DieselChoice, m: DieselMeasures): string {
  return dieselPick(configs, choice.fuel, choice.mode, choice.config, m.area)?.id ?? "aucun";
}

/** Contrôles de la barre du bas pour un bloc de moteurs diesel : carburant, critère, configuration, réglages. */
export function renderDieselHud(configs: DieselConfig[], choice: DieselChoice, current: DieselConfig | null): string {
  const fuels = DIESEL_FUELS.map((f) => {
    const n = configs.filter((c) => c.fuel === f).length;
    return `<option value="${f}"${f === choice.fuel ? " selected" : ""}${n ? "" : " disabled"}>${esc(dieselFuelName(f))}${n ? (f === "refined-diesel" ? "" : ` (relevé : ${n})`) : " — à relever"}</option>`;
  }).join("");
  const modes: [DieselPickMode, string][] = [["carburant", "meilleur rapport production/consommation"], ["place", "moins de place"], ["puissance", "meilleure production énergétique"]];
  const radios = modes.map(([m, t]) => `<label><input type="radio" name="dsl-mode" data-dsl-mode="${m}"${!choice.config && choice.mode === m ? " checked" : ""}> ${t}</label>`).join(" ");
  const opts = configs
    .filter((c) => c.fuel === choice.fuel)
    .map((c) => `<option value="${esc(c.id)}"${choice.config === c.id ? " selected" : ""}>${esc(c.label)} · ${esc(fmt(dieselLitersPerMMF(c), 3))} L/MMF</option>`)
    .join("");
  const panel = current ? controllerPanel(current.airFuel, current.throttle, current.throttleAssumed) : "";
  return `<span class="mset dsl">Carburant : <select data-dsl-fuel aria-label="Carburant du moteur">${fuels}</select> Choisir : ${radios} <select data-dsl-config aria-label="Configuration imposée"><option value="">ou cette configuration…</option>${opts}</select></span>${panel}`;
}
