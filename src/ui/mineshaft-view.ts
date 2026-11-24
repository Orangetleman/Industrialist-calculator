// Mineshaft Drill (remarque n°16) : réglage du plan (profondeur, tête, acide, huile) dans la barre
// du bloc, et sa pastille dans « Ton plan ». Fonctions pures pour le HTML.

import { esc, fmt } from "./format.ts";
import { t } from "../i18n/i18n.ts";
import { ACID_IDS, DEFAULT_MINESHAFT, HEAD_IDS, mineshaftCycle, sameMineshaft, type MineshaftChoice, type MineshaftFile } from "../engine/mineshaft.ts";

export type MineshaftView = { file: MineshaftFile; choice: MineshaftChoice };

const headItem = (f: MineshaftFile, id: string) => f.durability.heads.find((h) => h.id === id)?.item ?? id;
const acidItem = (f: MineshaftFile, id: string) => f.durability.acids.find((a) => a.id === id)?.item ?? null;

/** Contrôles de la barre du bas pour un bloc de Mineshaft Drill. `depth` : profondeur de l'étape. */
export function renderMineshaftHud(v: MineshaftView, depth: number | null, name: (id: string) => string): string {
  const { file, choice } = v;
  const depths = [`<option value="auto"${choice.depth === "auto" ? " selected" : ""}>${esc(t("msd.depth.auto"))}</option>`, ...file.depths.map((d) => `<option value="${d.depth}"${choice.depth === d.depth ? " selected" : ""}>${d.depth} m</option>`)].join("");
  const heads = HEAD_IDS.map((h) => `<option value="${h}"${choice.head === h ? " selected" : ""}>${esc(name(headItem(file, h)))}</option>`).join("");
  const acids = ACID_IDS.map((a) => {
    const item = acidItem(file, a);
    return `<option value="${a}"${choice.acid === a ? " selected" : ""}>${esc(item ? name(item) : t("msd.acid.none"))}</option>`;
  }).join("");
  const cy = depth !== null ? mineshaftCycle(file, depth, choice) : null;
  const info = cy ? ` <small>${esc(t("msd.cycle", { extract: fmt(cy.extractS, 0), cycle: fmt(cy.cycleS, 0), pct: fmt(cy.efficiency * 100, 0) }))}</small>` : "";
  return `<span class="mset msd" title="${esc(t("msd.title"))}">${t("msd.depth")} <select data-msd-depth aria-label="${esc(t("msd.depth"))}">${depths}</select> ${t("msd.head")} <select data-msd-head aria-label="${esc(t("msd.head"))}">${heads}</select> ${t("msd.acid")} <select data-msd-acid aria-label="${esc(t("msd.acid"))}">${acids}</select> <label title="${esc(t("msd.oil.title"))}"><input type="checkbox" data-msd-oil${choice.oil ? " checked" : ""}> ${esc(name(file.oil.item))}</label>${info}</span>`;
}

/** Texte de la pastille « Ton plan » ; null si le réglage est celui par défaut. */
export function mineshaftChipLabel(v: MineshaftView, name: (id: string) => string): string | null {
  if (sameMineshaft(v.choice, DEFAULT_MINESHAFT)) return null;
  const acid = acidItem(v.file, v.choice.acid);
  return t("pb.msd", { depth: v.choice.depth === "auto" ? t("pb.msd.auto") : `${v.choice.depth} m`, head: name(headItem(v.file, v.choice.head)), acid: acid ? name(acid) : t("msd.acid.none") });
}

/** Lit un changement d'un contrôle de la barre du bloc ; null si l'élément n'en est pas un. */
export function mineshaftPatch(el: HTMLInputElement | HTMLSelectElement): Partial<MineshaftChoice> | null {
  if (el.matches("[data-msd-depth]")) return { depth: el.value === "auto" ? "auto" : Number(el.value) };
  if (el.matches("[data-msd-head]")) return { head: el.value as MineshaftChoice["head"] };
  if (el.matches("[data-msd-acid]")) return { acid: el.value as MineshaftChoice["acid"] };
  if (el.matches("[data-msd-oil]")) return { oil: (el as HTMLInputElement).checked };
  return null;
}
