// Interfaces des machines (S10) dans le plan : le réglage à faire sur chaque machine (« ⚙ levier sur
// « container » »), dans la liste de construction, le schéma et le plan de pose ; et les cases de
// l'écran chiffré (Chemical Plant) dans la barre du bas du schéma. Fonctions pures (chaînes HTML).

import type { MachineInterface } from "../engine/extension-types.ts";
import { choicesFor, choiceText, factorsFor, type Interfaces, type MachineSettings, numberSettings, settingValue } from "../engine/interfaces.ts";
import { esc, fmt } from "./format.ts";

export type SettingLine = { text: string; once: boolean; doubt?: string; screen: boolean };

/** Nombre d'un réglage chiffré, comme l'écran l'affiche (« 1,67 »). */
export const factorText = (x: number) => fmt(x, 3);

/** « entrées × 1,67 · sorties × 2 · énergie × 4 » (seulement ce qui n'est pas à 1×). */
export function screenText(i: MachineInterface | undefined, values: Record<string, number> | undefined): string {
  const f = factorsFor(i, values);
  const parts = [f.inputs !== 1 ? `entrées × ${factorText(f.inputs)}` : "", f.outputs !== 1 ? `sorties × ${factorText(f.outputs)}` : "", f.energy !== 1 ? `énergie × ${factorText(f.energy)}` : ""].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Réglages à faire sur une machine pour un craft du plan : la position de chaque réglage qui cite ce
 * craft, puis l'écran chiffré s'il n'est pas à 1×.
 */
export function settingLines(ifaces: Interfaces | undefined, values: MachineSettings | undefined, machine: string, recipeId: string): SettingLine[] {
  const i = ifaces?.[machine];
  if (!i) return [];
  const out: SettingLine[] = choicesFor(i, recipeId).map(({ setting, choice }) => ({ text: choiceText(i, setting, choice), once: !!i.once, doubt: choice.doubt, screen: false }));
  const screen = screenText(i, values?.[machine]);
  if (screen) out.push({ text: `écran : ${screen}`, once: false, screen: true });
  return out;
}

const ONCE_TITLE = "Choisis-le au moment de poser la machine : il ne se change plus ensuite.";

/** Pastilles « ⚙ … » ; `prefix` : « à régler sur chaque machine : » dans le plan de pose. */
export function settingChips(lines: SettingLine[], prefix = ""): string {
  return lines
    .map((l) => {
      const title = [l.once ? ONCE_TITLE : "", l.doubt ? `⚠ ${l.doubt}` : "", l.screen ? "Réglage de l'écran que tu as saisi pour ce plan." : "Réglage de la machine pour ce craft."].filter(Boolean).join(" ");
      return `<span class="iset${l.once ? " once" : ""}" title="${esc(title)}">⚙ ${esc(prefix)}${esc(l.text)}${l.doubt ? " ⚠" : ""}</span>`;
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
    .map((s) => `${esc(s.name)} × <input type="text" inputmode="decimal" data-iset-input data-machine="${esc(machine)}" data-setting="${esc(s.id)}" value="${esc(factorText(settingValue(s, values)))}" aria-label="${esc(`${s.name} (${machineName})`)}" title="${esc(s.note ?? "")}">`)
    .join(" ");
  const title = `Les multiplicateurs que l'écran de la machine affiche. Valent pour toutes les ${machineName} de ce plan.`;
  return `<span class="mset${changed ? " on" : ""}" title="${esc(title)}">⚙ Écran : ${fields}</span>${changed ? `<button type="button" class="flow-hud-btn" data-iset-reset="${esc(machine)}" title="Remettre l'écran à 1× (réglage d'usine)">↺ 1×</button>` : ""}`;
}

/** Lit un nombre tapé (« 1,67 » ou « 1.67 ») ; null si vide ou invalide. */
export function parseFactor(raw: string): number | null {
  const v = Number(raw.trim().replace(",", "."));
  return raw.trim() && v > 0 && Number.isFinite(v) ? v : null;
}
