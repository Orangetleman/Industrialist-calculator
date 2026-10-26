// Interfaces des machines (S10) dans le plan : le réglage à faire sur chaque machine (« ⚙ levier sur
// « container » »), dans la liste de construction, le schéma et le plan de pose ; et les cases de
// l'écran chiffré (Chemical Plant) dans la barre du bas du schéma. Fonctions pures (chaînes HTML).

import type { MachineInterface } from "../engine/extension-types.ts";
import { choicesFor, choiceText, factorsFor, type Interfaces, type MachineSettings, numberSettings, settingValue } from "../engine/interfaces.ts";
import { esc, fmt, parseNum } from "./format.ts";
import { icon, withIcons } from "./icons.ts";
import { t } from "../i18n/i18n.ts";
import { txt } from "./engine-text.ts";

export type SettingLine = { text: string; once: boolean; doubt?: string; screen: boolean };

/** Nombre d'un réglage chiffré, comme l'écran l'affiche (« 1,67 »). */
export const factorText = (x: number) => fmt(x, 3);

/** « entrées × 1,67 · sorties × 2 · énergie × 4 » (seulement ce qui n'est pas à 1×). */
export function screenText(i: MachineInterface | undefined, values: Record<string, number> | undefined): string {
  const f = factorsFor(i, values);
  const parts = [f.inputs !== 1 ? t("if.inputs", { x: factorText(f.inputs) }) : "", f.outputs !== 1 ? t("if.outputs", { x: factorText(f.outputs) }) : "", f.energy !== 1 ? t("if.energy", { x: factorText(f.energy) }) : ""].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Réglages à faire sur une machine pour un craft du plan : la position de chaque réglage qui cite ce
 * craft, puis l'écran chiffré s'il n'est pas à 1×.
 */
export function settingLines(ifaces: Interfaces | undefined, values: MachineSettings | undefined, machine: string, recipeId: string): SettingLine[] {
  const i = ifaces?.[machine];
  if (!i) return [];
  const out: SettingLine[] = choicesFor(i, recipeId).map(({ setting, choice }) => ({ text: txt(choiceText(i, setting, choice)), once: !!i.once, doubt: choice.doubt && txt(choice.doubt), screen: false }));
  const screen = screenText(i, values?.[machine]);
  if (screen) out.push({ text: t("if.screen", { x: screen }), once: false, screen: true });
  return out;
}

/** Pastilles « ⚙ … » ; `prefix` : « à régler sur chaque machine : » dans le plan de pose. */
export function settingChips(lines: SettingLine[], prefix = ""): string {
  return lines
    .map((l) => {
      const title = [l.once ? t("if.once") : "", l.doubt ?? "", t(l.screen ? "if.typed" : "if.forRecipe")].filter(Boolean).join(" ");
      return `<span class="iset${l.once ? " once" : ""}" title="${esc(title)}">${icon("config")} ${esc(prefix)}${esc(l.text)}${l.doubt ? ` ${icon("warn")}` : ""}</span>`;
    })
    .join(" ");
}

/**
 * Cases de l'écran chiffré d'une machine, pour la barre du bas du schéma : une par réglage, et
 * « ↺ 1× » quand l'un n'est pas à sa valeur par défaut. Vide si la machine n'a pas d'écran chiffré.
 */
export function renderScreenInputs(i: MachineInterface | undefined, machine: string, machineName: string, values: Record<string, number> | undefined): string {
  const list = numberSettings(i);
  if (!list.length) return "";
  const changed = list.some((s) => settingValue(s, values) !== s.number!.default);
  const fields = list
    .map((s) => `${esc(txt(s.name))} × <input type="text" inputmode="decimal" data-iset-input data-machine="${esc(machine)}" data-setting="${esc(s.id)}" value="${esc(factorText(settingValue(s, values)))}" aria-label="${esc(`${txt(s.name)} (${machineName})`)}" title="${esc(txt(s.note ?? ""))}">`)
    .join(" ");
  const title = t("if.screen.title", { m: machineName });
  return `<span class="mset${changed ? " on" : ""}" title="${esc(title)}">${withIcons(t("if.screen.label"))} ${fields}</span>${changed ? `<button type="button" class="flow-hud-btn" data-iset-reset="${esc(machine)}" title="${esc(t("if.reset.title"))}">${icon("reset")} 1×</button>` : ""}`;
}

/** Lit un nombre tapé (« 1,67 » ou « 1.67 » en français) ; null si vide ou invalide. */
export function parseFactor(raw: string): number | null {
  const v = parseNum(raw);
  return raw.trim() && v > 0 && Number.isFinite(v) ? v : null;
}
