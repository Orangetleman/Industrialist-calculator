// Éditeur de bâtiments, section « Ensemble modulaire » : bloc « Calcul » (S13). Ferme d'arbres :
// bois, eau et électricité selon les blocs posés ; moteur diesel : la configuration relevée qui
// correspond aux réglages, sinon « à relever » ; turbine : « non fiable ». Fonctions pures (HTML).

import type { GameData } from "../engine/data.ts";
import { DIESEL_FUELS, dieselConfigs, dieselFuelName, dieselLitersPerMMF, dieselLookup, parseDieselReading, type DieselConfig, type DieselReading, farmBlocks, farmOutput, farmRates, turbineReliability, type FarmBlocks } from "../engine/modular-calc.ts";
import type { ModAssembly, ModularFile } from "../engine/modular.ts";
import { treeGrowthSeconds } from "../engine/pollution.ts";
import { esc, fmt } from "./format.ts";

export type ModCalcState = {
  farm: FarmBlocks & { pollution: number };
  diesel: { cylinders: number; airFuel: number; throttle: number; fuel: string };
};

/** Départ : la ferme du guide Miraheze (88 arbres) et le montage simple du moteur (6 cylindres, rapport 16). */
export const MODCALC_DEFAULT: ModCalcState = {
  farm: { trees: 88, sprinklers: 2, tanks: 1, harvesters: 4, controllers: 1, outputs: 1, pollution: 0 },
  diesel: { cylinders: 6, airFuel: 16, throttle: 100, fuel: "refined-diesel" },
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
  return `<ul class="mc-out">${lines.join("")}</ul>${hint}<p class="hint">Pousse : ${esc(g.detail)}. ${rates.treesPerHarvester.value} arbres par récolteur d'après le guide Miraheze${rates.treesPerHarvester.question ? ` <span class="must unk" data-ref="${esc(rates.treesPerHarvester.question)}" title="maximum réel à relever en jeu">⚠ à relever</span>` : ""} ; ${rates.treesPerSprinkler.value} arbres par arroseur, ${rates.sprinklersPerTank.value} arroseurs par réservoir (wikis).${rates.controllerSlots ? ` La portée du contrôleur touche au plus ${rates.controllerSlots} emplacements d'arbres, sans compter la place des autres blocs.` : ""}</p>`;
}

/** Résultat du moteur diesel : la configuration relevée qui correspond, sinon « à relever » ; puis le tableau des configurations connues. */
export function dieselResultHtml(file: ModularFile, data: GameData, st: ModCalcState, readings: DieselReading[] = []): string {
  const configs = dieselConfigs(file, readings);
  const d = st.diesel;
  const c = dieselLookup(configs, d.cylinders, d.airFuel, d.throttle, d.fuel);
  const list = dieselTable(configs, c);
  if (!c) return `<p class="must unk">À relever : pas de configuration connue pour ${fmt(d.cylinders, 0)} cylindres, rapport ${fmt(d.airFuel, 0)}, accélérateur ${fmt(d.throttle, 0)} %, ${esc(dieselFuelName(d.fuel))} (aucune formule connue). Le calcul n'utilise que les configurations relevées : note-la ci-dessous.</p>${list}`;
  const cost = c.parts.reduce<number | null>((s, p) => (s === null || data.machines.get(p.machine)?.cost == null ? null : s + p.count * data.machines.get(p.machine)!.cost!), 0);
  const blocks = c.parts.map((p) => `${p.count} ${name(data, p.machine)}`).join(", ");
  const lines = [
    `<li><b>${mfps(c.powerMFps)}</b> pour <b>${fmt(c.fuelLps, 3)} L/s</b> de ${esc(dieselFuelName(c.fuel))} (${fmt(c.fuelLps * 60, 2)} L/min, ${fmt(dieselLitersPerMMF(c), 3)} L par MMF)${c.torqueMT !== null ? ` · couple ${fmt(c.torqueMT, 0)} MT` : ""}</li>`,
    `<li>Blocs : ${blocks}${c.partsComplete ? (cost !== null ? ` · ${fmt(cost, 0)} $` : "") : ` <span class="must unk">⚠ liste incomplète : vilebrequins, entrées d'air, échappements et entrées de carburant à relever en jeu</span>`}</li>`,
    ...(c.throttleAssumed ? [`<li class="hint">Accélérateur non écrit par le tableau du contrôleur : supposé à 100 %.</li>`] : []),
    `<li class="hint">Un autre carburant change la consommation, pas la puissance : chaque carburant a ses relevés. Pollution de l'échappement : inconnue.</li>`,
  ];
  return `<ul class="mc-out">${lines.join("")}</ul>${list}`;
}

/** Tableau des configurations connues (wiki et relevés en jeu), la configuration choisie éclairée. */
function dieselTable(configs: DieselConfig[], on: DieselConfig | null): string {
  const rows = configs
    .map((x) => {
      const src = x.reading
        ? `<span class="src-tag jeu">relevé en jeu</span> <button type="button" class="link" data-dr-del="${esc(x.reading)}" title="Retirer ce relevé de ce navigateur">✕</button>`
        : `<span class="src-tag">wiki</span>${x.partsComplete ? "" : ` <span class="must unk" title="nombre de blocs à relever en jeu">blocs ⚠ à relever</span>`}`;
      return `<tr${x === on ? ' class="on"' : ""}><td><button type="button" class="link" data-mc-cfg="${esc(x.id)}" title="Voir cette configuration">${fmt(x.cylinders, 0)}</button></td><td>${fmt(x.airFuel, 0)}</td><td>${fmt(x.throttle, 0)} %${x.throttleAssumed ? "*" : ""}</td><td>${esc(dieselFuelName(x.fuel))}</td><td class="num">${mfps(x.powerMFps)}</td><td class="num">${fmt(x.fuelLps, 3)}</td><td class="num">${fmt(dieselLitersPerMMF(x), 3)}</td><td>${src}</td></tr>`;
    })
    .join("");
  return `<div class="tablewrap"><table class="mini dsl-cfg"><thead><tr><th>Cyl.</th><th>Rapport</th><th>Accél.</th><th>Carburant</th><th>Puissance</th><th>L/s</th><th>L par MMF</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div><p class="hint">* accélérateur supposé (non écrit sur le wiki). Clique le nombre de cylindres pour voir une configuration.</p>`;
}

/** Formulaire « Relevé de configuration » : ce qu'affiche l'Info Panel, avec les réglages et les blocs posés. */
function dieselReadingForm(st: ModCalcState, msg: string): string {
  const d = st.diesel;
  const f = (k: string, label: string, v: number | string, extra = "") => `<label class="mc-f">${label} <input type="text" inputmode="decimal" data-dr="${k}" value="${esc(String(v))}"${extra}></label>`;
  const ph = ' placeholder="lue sur l&#39;Info Panel"';
  const fuels = DIESEL_FUELS.map((x) => `<option value="${x}"${x === d.fuel ? " selected" : ""}>${esc(dieselFuelName(x))}</option>`).join("");
  return `<section class="mcalc" aria-label="Relevé de configuration du moteur"><h5>Relevé de configuration · lu sur l'Info Panel</h5>
    <div class="mc-in">${f("cylinders", "Cylindres", d.cylinders)}${f("airFuel", "Rapport air/carburant", d.airFuel)}${f("throttle", "Accélérateur (%)", d.throttle)}<label class="mc-f">Carburant <select data-dr="fuel">${fuels}</select></label></div>
    <div class="mc-in">${f("air", "Entrées d'air", 1)}${f("exhaust", "Échappements", 1)}${f("fuelIn", "Entrées de carburant", 1)}${f("generator", "Générateurs", 1)}${f("flywheel", "Volants", 0)}</div>
    <div class="mc-in">${f("power", "Puissance (MF/s)", "", ph)}${f("fuelLps", "Consommation (L/s)", "", ph)}${f("torque", "Couple (MT, facultatif)", "")}<button type="button" data-dr-save>Enregistrer le relevé</button></div>
    ${msg ? `<p class="hint" role="status">${esc(msg)}</p>` : ""}<p class="hint">Gardé dans ce navigateur, exporté avec les autres relevés (clé « diesel »). Il entre tout de suite dans le calcul ; les blocs comptés servent au plan de pose et au prix. Note la consommation telle que l'écran l'affiche.</p></section>`;
}

/** Lit le formulaire du relevé ; un texte d'erreur si une valeur manque. */
export function readDieselForm(root: ParentNode, now = new Date()): DieselReading | string {
  const val = (k: string) => (root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-dr="${k}"]`)?.value ?? "").trim();
  const num = (k: string) => {
    const v = val(k).replace(/\s/g, "").replace(",", ".");
    return v === "" ? null : Number(v);
  };
  const r = parseDieselReading({
    id: `r${now.getTime().toString(36)}`,
    date: now.toISOString().slice(0, 10),
    cylinders: num("cylinders"),
    airFuel: num("airFuel"),
    throttle: num("throttle"),
    fuel: val("fuel"),
    powerMFps: num("power"),
    fuelLps: num("fuelLps"),
    torqueMT: num("torque"),
    blocks: { air: num("air"), exhaust: num("exhaust"), fuel: num("fuelIn"), generator: num("generator"), flywheel: num("flywheel") },
  });
  return r ?? "Relevé incomplet : cylindres, rapport, accélérateur (1 à 100 %), puissance et consommation (plus grandes que 0) sont nécessaires.";
}

/** Bloc « Calcul » d'un ensemble ; `out` est l'élément mis à jour à chaque saisie. */
export function modCalcHtml(file: ModularFile, data: GameData, a: ModAssembly, st: ModCalcState, readings: DieselReading[] = [], msg = ""): string {
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
    const fields = [num("cylinders", "Cylindres", d.cylinders), num("airFuel", "Rapport air/carburant", d.airFuel), num("throttle", "Accélérateur (%)", d.throttle, ' max="100"'), `<label class="mc-f">Carburant <select data-mc="fuel">${DIESEL_FUELS.map((x) => `<option value="${x}"${x === d.fuel ? " selected" : ""}>${esc(dieselFuelName(x))}</option>`).join("")}</select></label>`].join("");
    return `<section class="mcalc" aria-label="Calcul du moteur"><h5>Calcul · puissance du moteur</h5><div class="mc-in">${fields}</div><div id="mc-out">${dieselResultHtml(file, data, st, readings)}</div></section>${dieselReadingForm(st, msg)}`;
  }
  if (a.id === "modular-turbine") {
    const t = turbineReliability(file);
    return t ? `<section class="mcalc" aria-label="Calcul de la turbine"><h5>Calcul · <span class="must unk">non fiable</span></h5><p class="hint">${esc(t.text)}</p></section>` : "";
  }
  return "";
}

/** Résultat seul, après une saisie. */
export function modCalcOut(file: ModularFile, data: GameData, a: ModAssembly, st: ModCalcState, readings: DieselReading[] = []): string {
  return a.id === "tree-farm" ? farmResultHtml(file, data, st) : a.id === "diesel-engine" ? dieselResultHtml(file, data, st, readings) : "";
}
