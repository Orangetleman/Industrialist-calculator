// Réglages de partie (S50) : ce qu'ils changent, et les pastilles de rappel sur les étapes du plan.

import type { GameData } from "../engine/data.ts";
import { BLOCKED_RESEARCH, DIFFICULTIES, type Difficulty } from "../engine/difficulty.ts";
import { asuResidue, isWinter, logsMultiplier, TREE_SCRUBBER_RECIPE, treeScrubberPollution, treeScrubberResidue } from "../engine/game-settings.ts";
import { treeGrowthSeconds } from "../engine/pollution.ts";
import { t } from "../i18n/i18n.ts";
import { esc, fmt } from "./format.ts";

export type GameView = { pollutionPct: number; month: number; igloo: boolean; scrubber: boolean };
/** Champ de « Ma recherche » visé par une pastille. */
export type GameField = "pollution" | "month" | "igloo" | "difficulty";

const ASU_RECIPE = "air_separation_unit_01";
const monthName = (m: number): string => t(`gs.m.${m}` as never);

function chip(field: GameField, label: string): string {
  return `<button type="button" class="src-tag gs-chip" data-gset="${field}" title="${esc(t("gs.chip.title"))}">${esc(label)}</button>`;
}

/** Pastilles d'une étape : un bouton par réglage qui agit sur sa recette. */
export function gameChips(data: GameData, g: GameView | undefined, recipeId: string): string {
  if (!g) return "";
  const pollution = chip("pollution", t("gs.chip.pollution", { p: fmt(g.pollutionPct, 1) }));
  if (recipeId === ASU_RECIPE || recipeId === TREE_SCRUBBER_RECIPE) return pollution;
  if (!data.recipes.get(recipeId)?.durationByPollution) return "";
  return [pollution, ...(g.igloo ? [chip("month", monthName(g.month)), chip("igloo", t("gs.chip.igloo"))] : [])].join(" ");
}

export function monthOptions(selected: number | null, now: number): string {
  const opt = (v: string, label: string, on: boolean) => `<option value="${v}"${on ? " selected" : ""}>${esc(label)}</option>`;
  return [opt("", t("gs.month.now", { m: monthName(now) }), selected === null), ...Array.from({ length: 12 }, (_, i) => opt(String(i + 1), monthName(i + 1), selected === i + 1))].join("");
}

/** Tableau « Ce que ça change ». */
export function renderGameEffects(data: GameData, g: GameView): string {
  const wiki = `<span class="src-tag">${t("gs.src.wiki")}</span>`;
  const ic = `<span class="src-tag warn">${t("gs.src.ic")}</span>`;
  const growth = treeGrowthSeconds(data.treeGrowth, g.pollutionPct).seconds;
  const logs = 2 * logsMultiplier(g.month, g.igloo);
  const row = (what: string, value: string, src: string) => `<tr><td>${esc(what)}</td><td>${value}</td><td>${src}</td></tr>`;
  const b = (x: string) => `<b class="num">${esc(x)}</b>`;
  const logsText = !g.igloo ? t("gs.eff.logs.off") : isWinter(g.month) ? t("gs.eff.logs.on", { n: b(fmt(logs, 1)) }) : t("gs.eff.logs.summer");
  const scrubber = g.scrubber
    ? t("gs.eff.scrub.on", { x: b(fmt(treeScrubberPollution(g.pollutionPct), 2)), r: fmt(treeScrubberResidue(g.pollutionPct), 0) })
    : t("gs.eff.scrub.off");
  return `<div class="tw"><table class="gs-eff"><thead><tr><th>${t("gs.eff.what")}</th><th>${t("gs.eff.value")}</th><th>${t("gs.eff.src")}</th></tr></thead><tbody>${[
    row(t("gs.eff.tree"), t("gs.eff.tree.v", { s: b(fmt(growth, 0)) }), wiki),
    row(t("gs.eff.asu"), t("gs.eff.asu.v", { r: b(fmt(asuResidue(g.pollutionPct), 1)) }), wiki),
    row(t("gs.eff.logs"), logsText, wiki),
    row(t("gs.eff.scrub"), scrubber, `${wiki} ${ic}`),
  ].join("")}</tbody></table></div>`;
}

/** Menu de la difficulté (S51). */
export function difficultyOptions(selected: string): string {
  return DIFFICULTIES.map((d) => `<option value="${d}"${d === selected ? " selected" : ""}>${esc(t(`dif.${d}` as never))}</option>`).join("");
}

/** Phrase sous le menu : ce que le niveau change pour les plans. */
export function difficultyNote(data: GameData, d: Difficulty): string {
  const names = BLOCKED_RESEARCH[d].map((id) => data.nodes.get(id)?.name ?? id);
  const src = `<span class="src-tag">${t("gs.src.wiki")}</span> <span class="src-tag warn">${t("dif.src.ic")}</span>`;
  if (names.length) return `${t("dif.note.blocked", { d: t(`dif.${d}` as never), n: String(names.length), list: esc(names.join(", ")) })} ${src}`;
  return `${t(`dif.note.${d}` as never)} <span class="src-tag">${t("gs.src.wiki")}</span>`;
}
