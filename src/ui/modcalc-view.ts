// Éditeur de bâtiments, section « Ensemble modulaire » : bloc « Calcul » (S13). Ferme d'arbres :
// bois, eau et électricité selon les blocs posés ; moteur diesel : la configuration relevée qui
// correspond aux réglages, sinon « à relever » ; turbine : « non fiable ». Fonctions pures (HTML).

import type { GameData } from "../engine/data.ts";
import { DIESEL_FUELS, dieselConfigs, dieselFuelName, dieselLitersPerMMF, dieselLookup, parseDieselReading, type DieselConfig, type DieselReading, farmBlocks, farmOutput, farmRates, turbineReliability, type FarmBlocks } from "../engine/modular-calc.ts";
import type { ModAssembly, ModularFile } from "../engine/modular.ts";
import { treeGrowthSeconds } from "../engine/pollution.ts";
import { esc, fmt, fmtMoney, fmtPct, frText, parseNum } from "./format.ts";
import { t, type Key } from "../i18n/i18n.ts";

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
const LIMITS = ["arbres", "arroseurs", "réservoirs", "récolteurs", "bloc manquant", "deux contrôleurs"];
/** Ce qui limite la ferme (code du moteur), en phrase. */
const limitText = (l: string) => (LIMITS.includes(l) ? t(`mc.limit.${l}` as Key) : l);

function num(field: string, label: Key, value: number, extra = ""): string {
  return `<label class="mc-f">${esc(t(label))} <input type="number" min="0" step="1" inputmode="numeric" data-mc="${field}" value="${value}"${extra}></label>`;
}

/** Résultat de la ferme (mis à jour à chaque saisie, sans toucher aux cases). */
export function farmResultHtml(file: ModularFile, data: GameData, st: ModCalcState): string {
  const rates = farmRates(file);
  if (!rates) return `<p class="must unk">${t("mc.farm.incomplete")}</p>`;
  const g = treeGrowthSeconds(data.treeGrowth, st.farm.pollution);
  const r = farmOutput(rates, st.farm, g.seconds);
  const fit = farmBlocks(rates, st.farm.trees);
  const short = (["sprinklers", "tanks", "harvesters"] as const).filter((k) => st.farm[k] < fit[k]);
  const lines = [
    `<li>${t("mc.logs.html", { rate: fmt(r.logsPerMin, 2), n: fmt(r.harvested, 0), per: String(rates.logsPerTree.value), g: fmt(g.seconds, 1) })}</li>`,
    `<li>${esc(t("mc.limit", { x: limitText(r.limit) }))}</li>`,
    `<li>${t("mc.water.html", { l: fmt(r.waterLpm, 1), n: r.activeSprinklers, c: String(rates.waterCycle.litersPerCycle), p: fmt(rates.waterCycle.periodS, 2) })}</li>`,
    `<li>${t("mc.power.html", { e: mfps(r.energyMFps), n: fmt(r.harvested, 0), k: fmt(rates.energyPerCutMF.value / 1000, 0), g: fmt(g.seconds, 1) })}</li>`,
    ...r.problems.map((p) => `<li class="must unk">⚠ ${frText(p)}</li>`),
  ];
  const hint = short.length
    ? `<p class="hint">${t("mc.fit", { n: fmt(st.farm.trees, 0), s: String(fit.sprinklers), t: String(fit.tanks), h: String(fit.harvesters) })}</p>`
    : "";
  const q = rates.treesPerHarvester.question ? ` <span class="must unk" data-ref="${esc(rates.treesPerHarvester.question)}" title="${esc(t("mc.toRecord.title"))}">${t("mc.toRecord")}</span>` : "";
  const slots = rates.controllerSlots ? t("mc.slots", { n: String(rates.controllerSlots) }) : "";
  return `<ul class="mc-out">${lines.join("")}</ul>${hint}<p class="hint">${t("mc.growth", { detail: frText(g.detail), n: String(rates.treesPerHarvester.value), q, s: String(rates.treesPerSprinkler.value), p: String(rates.sprinklersPerTank.value), slots })}</p>`;
}

/** Résultat du moteur diesel : la configuration relevée qui correspond, sinon « à relever » ; puis le tableau des configurations connues. */
export function dieselResultHtml(file: ModularFile, data: GameData, st: ModCalcState, readings: DieselReading[] = []): string {
  const configs = dieselConfigs(file, readings);
  const d = st.diesel;
  const c = dieselLookup(configs, d.cylinders, d.airFuel, d.throttle, d.fuel);
  const list = dieselTable(configs, c);
  if (!c) return `<p class="must unk">${t("mc.dsl.unknown", { c: fmt(d.cylinders, 0), a: fmt(d.airFuel, 0), t: fmtPct(fmt(d.throttle, 0)), fuel: esc(dieselFuelName(d.fuel)) })}</p>${list}`;
  const cost = c.parts.reduce<number | null>((s, p) => (s === null || data.machines.get(p.machine)?.cost == null ? null : s + p.count * data.machines.get(p.machine)!.cost!), 0);
  const blocks = c.parts.map((p) => `${p.count} ${name(data, p.machine)}`).join(", ");
  const lines = [
    `<li>${t("mc.dsl.power.html", { p: mfps(c.powerMFps), l: fmt(c.fuelLps, 3), fuel: esc(dieselFuelName(c.fuel)), m: fmt(c.fuelLps * 60, 2), r: fmt(dieselLitersPerMMF(c), 3), torque: c.torqueMT !== null ? t("mc.dsl.torque", { x: fmt(c.torqueMT, 0) }) : "" })}</li>`,
    `<li>${t("mc.dsl.blocks", { list: blocks })}${c.partsComplete ? (cost !== null ? ` · ${fmtMoney(cost)}` : "") : ` <span class="must unk">${t("mc.dsl.incomplete")}</span>`}</li>`,
    ...(c.throttleAssumed ? [`<li class="hint">${t("mc.dsl.assumed")}</li>`] : []),
    `<li class="hint">${t("mc.dsl.otherFuel")}</li>`,
  ];
  return `<ul class="mc-out">${lines.join("")}</ul>${list}`;
}

/** Tableau des configurations connues (wiki et relevés en jeu), la configuration choisie éclairée. */
function dieselTable(configs: DieselConfig[], on: DieselConfig | null): string {
  const rows = configs
    .map((x) => {
      const src = x.reading
        ? `<span class="src-tag jeu">${t("mc.src.game")}</span> <button type="button" class="link" data-dr-del="${esc(x.reading)}" title="${esc(t("mc.src.del"))}">✕</button>`
        : `<span class="src-tag">wiki</span>${x.partsComplete ? "" : ` <span class="must unk" title="${esc(t("mc.blocks.title"))}">${t("mc.blocks.toRecord")}</span>`}`;
      return `<tr${x === on ? ' class="on"' : ""}><td><button type="button" class="link" data-mc-cfg="${esc(x.id)}" title="${esc(t("mc.cfg.see"))}">${fmt(x.cylinders, 0)}</button></td><td>${fmt(x.airFuel, 0)}</td><td>${fmtPct(fmt(x.throttle, 0))}${x.throttleAssumed ? "*" : ""}</td><td>${esc(dieselFuelName(x.fuel))}</td><td class="num">${mfps(x.powerMFps)}</td><td class="num">${fmt(x.fuelLps, 3)}</td><td class="num">${fmt(dieselLitersPerMMF(x), 3)}</td><td>${src}</td></tr>`;
    })
    .join("");
  return `<div class="tablewrap"><table class="mini dsl-cfg"><thead><tr><th>${t("mc.th.cyl")}</th><th>${t("mc.th.ratio")}</th><th>${t("mc.th.throttle")}</th><th>${t("mc.th.fuel")}</th><th>${t("mc.th.power")}</th><th>L/s</th><th>${t("mc.th.lmmf")}</th><th>${t("mc.th.src")}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="hint">${t("mc.table.hint")}</p>`;
}

/** Formulaire « Relevé de configuration » : ce qu'affiche l'Info Panel, avec les réglages et les blocs posés. */
function dieselReadingForm(st: ModCalcState, msg: string): string {
  const d = st.diesel;
  const f = (k: string, label: Key, v: number | string, extra = "") => `<label class="mc-f">${t(label)} <input type="text" inputmode="decimal" data-dr="${k}" value="${esc(String(v))}"${extra}></label>`;
  const ph = ` placeholder="${esc(t("mc.read.ph"))}"`;
  const fuels = DIESEL_FUELS.map((x) => `<option value="${x}"${x === d.fuel ? " selected" : ""}>${esc(dieselFuelName(x))}</option>`).join("");
  return `<section class="mcalc" aria-label="${esc(t("mc.read.aria"))}"><h5>${t("mc.read.title")}</h5>
    <div class="mc-in">${f("cylinders", "mc.cylinders", d.cylinders)}${f("airFuel", "mc.airFuel", d.airFuel)}${f("throttle", "mc.throttle", d.throttle)}<label class="mc-f">${t("mc.fuel")} <select data-dr="fuel">${fuels}</select></label></div>
    <div class="mc-in">${f("air", "mc.air", 1)}${f("exhaust", "mc.exhaust", 1)}${f("fuelIn", "mc.fuelIn", 1)}${f("generator", "mc.generator", 1)}${f("flywheel", "mc.flywheel", 0)}</div>
    <div class="mc-in">${f("power", "mc.power", "", ph)}${f("fuelLps", "mc.fuelLps", "", ph)}${f("torque", "mc.torque", "")}<button type="button" data-dr-save>${t("mc.read.save")}</button></div>
    ${msg ? `<p class="hint" role="status">${esc(msg)}</p>` : ""}<p class="hint">${t("mc.read.hint")}</p></section>`;
}

/** Lit le formulaire du relevé ; un texte d'erreur si une valeur manque. */
export function readDieselForm(root: ParentNode, now = new Date()): DieselReading | string {
  const val = (k: string) => (root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-dr="${k}"]`)?.value ?? "").trim();
  const num = (k: string) => {
    const v = val(k);
    return v === "" ? null : parseNum(v);
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
  return r ?? t("mc.read.incomplete");
}

/** Bloc « Calcul » d'un ensemble ; `out` est l'élément mis à jour à chaque saisie. */
export function modCalcHtml(file: ModularFile, data: GameData, a: ModAssembly, st: ModCalcState, readings: DieselReading[] = [], msg = ""): string {
  if (a.id === "tree-farm") {
    const f = st.farm;
    const fields = [
      num("trees", "mc.trees", f.trees),
      num("sprinklers", "mc.sprinklers", f.sprinklers),
      num("tanks", "mc.tanks", f.tanks),
      num("harvesters", "mc.harvesters", f.harvesters),
      num("controllers", "mc.controllers", f.controllers),
      num("outputs", "mc.outputs", f.outputs),
      `<label class="mc-f">${t("mc.pollution")} <input type="number" step="1" data-mc="pollution" value="${f.pollution}"></label>`,
    ].join("");
    return `<section class="mcalc" aria-label="${esc(t("mc.farm.aria"))}"><h5>${t("mc.farm.title")}</h5><div class="mc-in">${fields}<button type="button" data-mc-fit>${t("mc.fitBtn")}</button></div><div id="mc-out">${farmResultHtml(file, data, st)}</div></section>`;
  }
  if (a.id === "diesel-engine") {
    const d = st.diesel;
    const fields = [num("cylinders", "mc.cylinders", d.cylinders), num("airFuel", "mc.airFuel", d.airFuel), num("throttle", "mc.throttle", d.throttle, ' max="100"'), `<label class="mc-f">${t("mc.fuel")} <select data-mc="fuel">${DIESEL_FUELS.map((x) => `<option value="${x}"${x === d.fuel ? " selected" : ""}>${esc(dieselFuelName(x))}</option>`).join("")}</select></label>`].join("");
    return `<section class="mcalc" aria-label="${esc(t("mc.dsl.aria"))}"><h5>${t("mc.dsl.title")}</h5><div class="mc-in">${fields}</div><div id="mc-out">${dieselResultHtml(file, data, st, readings)}</div></section>${dieselReadingForm(st, msg)}`;
  }
  if (a.id === "modular-turbine") {
    const tb = turbineReliability(file);
    return tb ? `<section class="mcalc" aria-label="${esc(t("mc.turbine.aria"))}"><h5>${t("mc.turbine.title.html")}</h5><p class="hint">${frText(tb.text)}</p></section>` : "";
  }
  return "";
}

/** Résultat seul, après une saisie. */
export function modCalcOut(file: ModularFile, data: GameData, a: ModAssembly, st: ModCalcState, readings: DieselReading[] = []): string {
  return a.id === "tree-farm" ? farmResultHtml(file, data, st) : a.id === "diesel-engine" ? dieselResultHtml(file, data, st, readings) : "";
}
