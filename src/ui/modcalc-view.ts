// Éditeur de bâtiments, section « Ensemble modulaire » : bloc « Calcul » (S13). Ferme d'arbres :
// bois, eau et électricité selon les blocs posés ; moteur diesel : la configuration relevée qui
// correspond aux réglages, sinon « à relever » ; turbine : « non fiable ». Fonctions pures (HTML).

import type { GameData } from "../engine/data.ts";
import { dieselConfigs, dieselLookup, farmBlocks, farmOutput, farmRates, turbineReliability, type FarmBlocks } from "../engine/modular-calc.ts";
import type { ModAssembly, ModularFile } from "../engine/modular.ts";
import { treeGrowthSeconds } from "../engine/pollution.ts";
import { esc, fmt } from "./format.ts";

export type ModCalcState = {
  farm: FarmBlocks & { pollution: number };
  diesel: { cylinders: number; airFuel: number; throttle: number };
};

/** Départ : la ferme du guide Miraheze (88 arbres) et le montage simple du moteur (6 cylindres, rapport 16). */
export const MODCALC_DEFAULT: ModCalcState = {
  farm: { trees: 88, sprinklers: 2, tanks: 1, harvesters: 4, controllers: 1, outputs: 1, pollution: 0 },
  diesel: { cylinders: 6, airFuel: 16, throttle: 100 },
};

const mfps = (w: number) => (w >= 1e6 ? `${fmt(w / 1e6, 3)} MMF/s` : w >= 1e3 ? `${fmt(w / 1e3, 2)} kMF/s` : `${fmt(w, 1)} MF/s`);
const name = (data: GameData, id: string) => esc(data.machines.get(id)?.name ?? id);
const LIMIT_TEXT: Record<string, string> = {
  arbres: "les arbres eux-mêmes : chaque arbre est arrosé et récolté",
  arroseurs: "les arroseurs : des arbres ne sont pas arrosés",
  réservoirs: "les réservoirs : des arroseurs n'ont pas d'eau",
  récolteurs: "les récolteurs : des arbres ne sont pas coupés",
  "bloc manquant": "un bloc manque : la ferme ne marche pas",
  "deux contrôleurs": "deux contrôleurs : la ferme ne marche pas",
};

function num(field: string, label: string, value: number, extra = ""): string {
  return `<label class="mc-f">${esc(label)} <input type="number" min="0" step="1" inputmode="numeric" data-mc="${field}" value="${value}"${extra}></label>`;
}

/** Résultat de la ferme (mis à jour à chaque saisie, sans toucher aux cases). */
export function farmResultHtml(file: ModularFile, data: GameData, st: ModCalcState): string {
  const rates = farmRates(file);
  if (!rates) return `<p class="must unk">Valeurs de la ferme incomplètes dans data/modular.json : calcul impossible.</p>`;
  const g = treeGrowthSeconds(data.treeGrowth, st.farm.pollution);
  const r = farmOutput(rates, st.farm, g.seconds);
  const fit = farmBlocks(rates, st.farm.trees);
  const short = (["sprinklers", "tanks", "harvesters"] as const).filter((k) => st.farm[k] < fit[k]);
  const lines = [
    `<li><b>${fmt(r.logsPerMin, 2)} Oak Log/min</b> (${fmt(r.harvested, 0)} arbres coupés × ${rates.logsPerTree.value} Oak Logs × 60 ÷ ${fmt(g.seconds, 1)} s de pousse)</li>`,
    `<li>Limite : ${esc(LIMIT_TEXT[r.limit] ?? r.limit)}</li>`,
    `<li>Eau : <b>${fmt(r.waterLpm, 1)} L/min</b> (${fmt(r.activeSprinklers, 0)} arroseur${r.activeSprinklers > 1 ? "s" : ""} × ${rates.waterCycle.litersPerCycle} L toutes les ${fmt(rates.waterCycle.periodS, 2)} s)</li>`,
    `<li>Électricité : <b>${mfps(r.energyMFps)}</b> en moyenne (${fmt(r.harvested, 0)} × ${fmt(rates.energyPerCutMF.value / 1000, 0)} kMF par coupe ÷ ${fmt(g.seconds, 1)} s), par la prise du contrôleur</li>`,
    ...r.problems.map((p) => `<li class="must unk">⚠ ${esc(p)}</li>`),
  ];
  const hint = short.length
    ? `<p class="hint">Pour ${fmt(st.farm.trees, 0)} arbres, il faut au moins ${fit.sprinklers} arroseur(s), ${fit.tanks} réservoir(s) et ${fit.harvesters} récolteur(s).</p>`
    : "";
  return `<ul class="mc-out">${lines.join("")}</ul>${hint}<p class="hint">Pousse : ${esc(g.detail)}. ${rates.treesPerHarvester.value} arbres par récolteur d'après le guide Miraheze${rates.treesPerHarvester.question ? ` <span class="must unk" title="maximum réel à relever">⚠ ${esc(rates.treesPerHarvester.question)}</span>` : ""} ; ${rates.treesPerSprinkler.value} arbres par arroseur, ${rates.sprinklersPerTank.value} arroseurs par réservoir (wikis).${rates.controllerSlots ? ` La portée du contrôleur touche au plus ${rates.controllerSlots} emplacements d'arbres, sans compter la place des autres blocs.` : ""}</p>`;
}

/** Résultat du moteur diesel : la configuration relevée qui correspond, sinon « à relever ». */
export function dieselResultHtml(file: ModularFile, data: GameData, st: ModCalcState): string {
  const configs = dieselConfigs(file);
  const c = dieselLookup(configs, st.diesel.cylinders, st.diesel.airFuel, st.diesel.throttle);
  const list = `<p class="hint">Configurations relevées : ${configs
    .map((x) => `<button type="button" class="chip${x === c ? " on" : ""}" data-mc-cfg="${esc(x.id)}">${esc(x.label)}</button>`)
    .join(" ")}</p>`;
  if (!c) return `<p class="must unk">À relever : pas de formule connue pour ${fmt(st.diesel.cylinders, 0)} cylindres, rapport ${fmt(st.diesel.airFuel, 0)}, accélérateur ${fmt(st.diesel.throttle, 0)} % (MOD-12). Le calcul n'utilise que les configurations relevées.</p>${list}`;
  const cost = c.parts.reduce<number | null>((s, p) => (s === null || data.machines.get(p.machine)?.cost == null ? null : s + p.count * data.machines.get(p.machine)!.cost!), 0);
  const blocks = c.parts.map((p) => `${p.count} ${name(data, p.machine)}`).join(", ");
  const lines = [
    `<li><b>${mfps(c.powerMFps)}</b> pour <b>${fmt(c.fuelLps, 3)} L/s</b> de Refined Diesel (${fmt(c.fuelLps * 60, 2)} L/min)${c.torqueMT !== null ? ` · couple ${fmt(c.torqueMT, 0)} MT` : ""}</li>`,
    `<li>Blocs : ${blocks}${c.partsComplete ? (cost !== null ? ` · ${fmt(cost, 0)} $` : "") : ` <span class="must unk">⚠ liste incomplète : vilebrequins, entrées d'air, échappements et entrées de carburant à relever (MOD-14)</span>`}</li>`,
    ...(c.throttleAssumed ? [`<li class="hint">Accélérateur non écrit par le tableau du contrôleur : supposé à 100 %.</li>`] : []),
    `<li class="hint">Autres diesels : consommation inconnue. Pollution de l'échappement : inconnue (MOD-15).</li>`,
  ];
  return `<ul class="mc-out">${lines.join("")}</ul>${list}`;
}

/** Bloc « Calcul » d'un ensemble ; `out` est l'élément mis à jour à chaque saisie. */
export function modCalcHtml(file: ModularFile, data: GameData, a: ModAssembly, st: ModCalcState): string {
  if (a.id === "tree-farm") {
    const f = st.farm;
    const fields = [
      num("trees", "Arbres", f.trees),
      num("sprinklers", "Arroseurs", f.sprinklers),
      num("tanks", "Réservoirs", f.tanks),
      num("harvesters", "Récolteurs", f.harvesters),
      num("controllers", "Contrôleurs", f.controllers),
      num("outputs", "Sorties", f.outputs),
      `<label class="mc-f">Pollution (%) <input type="number" step="1" data-mc="pollution" value="${f.pollution}"></label>`,
    ].join("");
    return `<section class="mcalc" aria-label="Calcul de la ferme"><h5>Calcul · bois de la ferme</h5><div class="mc-in">${fields}<button type="button" data-mc-fit>Au plus juste pour ces arbres</button></div><div id="mc-out">${farmResultHtml(file, data, st)}</div></section>`;
  }
  if (a.id === "diesel-engine") {
    const d = st.diesel;
    const fields = [num("cylinders", "Cylindres", d.cylinders), num("airFuel", "Rapport air/carburant", d.airFuel), num("throttle", "Accélérateur (%)", d.throttle, ' max="100"')].join("");
    return `<section class="mcalc" aria-label="Calcul du moteur"><h5>Calcul · puissance du moteur</h5><div class="mc-in">${fields}</div><div id="mc-out">${dieselResultHtml(file, data, st)}</div></section>`;
  }
  if (a.id === "modular-turbine") {
    const t = turbineReliability(file);
    return t ? `<section class="mcalc" aria-label="Calcul de la turbine"><h5>Calcul · <span class="must unk">non fiable</span></h5><p class="hint">${esc(t.text)} (MOD-16)</p></section>` : "";
  }
  return "";
}

/** Résultat seul, après une saisie. */
export function modCalcOut(file: ModularFile, data: GameData, a: ModAssembly, st: ModCalcState): string {
  return a.id === "tree-farm" ? farmResultHtml(file, data, st) : a.id === "diesel-engine" ? dieselResultHtml(file, data, st) : "";
}
