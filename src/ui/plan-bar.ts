// Réglages visibles (S28) : la barre « Ton plan » au-dessus des onglets du résultat, et les ⚠ des
// valeurs à vérifier sur les blocs, les lignes et les modules. Fonctions pures (chaînes HTML) :
// main.ts les insère et branche les clics (data-pb, data-pb-x, data-fix).

import type { Criterion } from "../engine/choose.ts";
import { ENERGY, POLLUTION } from "../engine/resources.ts";
import type { Step, VerifyEntry } from "../engine/solve.ts";
import type { VerifyFlag } from "../engine/types.ts";
import { DEFAULT_DIESEL, type DieselChoice } from "./diesel.ts";
import { lang, t, type Key } from "../i18n/i18n.ts";
import { colon, doubtText, esc, fmt, fmtMF, semi } from "./format.ts";
import { screenText } from "./iface-view.ts";
import { filterSummary } from "./mfilter-view.ts";
import { itemN, machineN, type Ctx } from "./render.ts";
import { DEFAULT_SETTINGS, type Goal, type PlanMachines } from "./state.ts";
import type { Interfaces, MachineSettings } from "../engine/interfaces.ts";
import { dieselFuelName } from "../engine/modular-calc.ts";

/** Une priorité en un mot, pour la barre. */
const critWord = (c: Criterion): string => t(`pb.crit.${c}`);
const critWords = (list: Criterion[]) => list.slice(0, 3).map(critWord).join(" › ");

/** Champs qui ont un mot de joueur (les autres s'affichent tels quels). */
const FIELD_WORDS = new Set(["durationS", "energyMFps", "cost", "size", "machine", "parts", "pollutionPerHour", "unlockedBy"]);

/** Une valeur d'un craft ou d'une machine, en mots de joueur (« durée », « sortie Gear »). */
export function fieldWord(v: Pick<Ctx, "data">, field: string): string {
  const [head, rest] = [field.split(".")[0]!, field.split(".").slice(1).join(".")];
  if (head === "inputs" || head === "outputs") return t(`warn.field.${head}`, { item: itemN(v, rest) });
  return FIELD_WORDS.has(head) ? t(`warn.field.${head}` as Key) : field;
}

// Le doute du wiki en mots de joueur (S28) : défini dans format.ts (S29, aussi pour les fiches Recettes).
export { doubtText };

/** Attribut d'un ⚠ : de quoi ouvrir la correction (portée, id, champ, objet de la fiche). */
export const fixAttr = (e: Pick<VerifyEntry, "scope" | "id" | "item" | "flag">) => `data-fix="${esc(`${e.scope}|${e.id}|${e.flag.field}|${e.item}`)}"`;

/** Valeurs à vérifier qu'utilise une étape : celles de son craft, puis celles de sa machine. */
export function stepWarnings(v: Pick<Ctx, "plan">, s: Pick<Step, "recipeId" | "machine" | "item">): VerifyEntry[] {
  return v.plan.verify.filter((e) => e.used && (e.scope === "recette" ? e.id === s.recipeId : e.id === s.machine && e.item === s.item));
}

/** Petit ⚠ cliquable (ligne, module) : la première valeur à vérifier, les autres au survol. */
export function warnButton(v: Pick<Ctx, "data">, list: VerifyEntry[]): string {
  if (!list.length) return "";
  const what = list.map((e) => `${fieldWord(v, e.flag.field)}${colon()}${doubtText(e.flag)}`).join(semi());
  return `<button type="button" class="warn-btn" ${fixAttr(list[0]!)} title="${esc(t("warn.btn.title", { what }))}">⚠<span class="sr-only">${esc(t("warn.btn.sr", { what }))}</span></button>`;
}

/** « : » avec l'espace du français, « : » collé en anglais. */

/** Pastilles ⚠ de la barre du bloc : chaque valeur douteuse, en clair, avec « corriger ▸ ». */
export function warnChips(v: Pick<Ctx, "data">, list: VerifyEntry[]): string {
  return list
    .map((e) => {
      const whose = e.scope === "machine" ? t("warn.of", { m: machineN(v, e.id) }) : "";
      return `<button type="button" class="warn-chip" ${fixAttr(e)}>${esc(t("warn.chip", { field: fieldWord(v, e.flag.field), whose, doubt: doubtText(e.flag) }))}</button>`;
    })
    .join("");
}

/** Ce que la barre a besoin de savoir en plus du plan (réglages du plan affiché). */
export type PlanBarInput = {
  goal: Goal;
  criteria: Criterion[];
  /** Filtre de machines (absent : pas de filtre pour cet objectif). */
  filter: PlanMachines | null;
  /** Machines fixées dans le schéma (S8), par clé d'étape. */
  fixed: Record<string, number>;
  /** Recettes choisies à la main (Détails, barre du bloc), par objet. */
  forced: Record<string, string>;
  /** Écrans chiffrés réglés pour ce plan (S10). */
  msettings: MachineSettings;
  ifaces?: Interfaces;
  /** Choix du moteur diesel pour ce plan (S18), s'il a été changé. */
  diesel: DieselChoice | null;
  /** Options avancées activées. */
  advanced: number;
};

type Chip = { label: string; open: string; title: string; set?: boolean; cancel?: { attr: string; title: string } };

function chipHtml(c: Chip): string {
  const x = c.cancel ? `<button type="button" class="pb-x" ${c.cancel.attr} aria-label="${esc(c.cancel.title)}" title="${esc(c.cancel.title)}">✕</button>` : "";
  return `<span class="pb-chip${c.set ? " set" : ""}"><button type="button" class="pb-open" ${c.open} title="${esc(c.title)}">${esc(c.label)}</button>${x}</span>`;
}

/** Nom court d'une étape : « Steel Ingot », « Énergie ». */
const stepName = (v: Pick<Ctx, "data">, s: Step | undefined, key: string) => (s ? (s.item === ENERGY ? t("common.energy") : itemN(v, s.item)) : itemN(v, key.split("@")[0]!));

/**
 * La barre « Ton plan » : priorités, machines permises, réglages faits à la main, options avancées
 * et valeurs à vérifier ; chaque pastille ouvre son réglage, ✕ l'annule.
 */
export function renderPlanBar(v: Pick<Ctx, "data" | "plan">, b: PlanBarInput): string {
  const p = v.plan;
  const chips: string[] = [];
  const isDefault = b.criteria.join() === DEFAULT_SETTINGS.criteria[b.goal].slice(0, b.criteria.length).join();
  chips.push(
    chipHtml({
      label: t("pb.criteria", { list: critWords(b.criteria) }),
      open: `data-pb="criteria"`,
      title: t("pb.criteria.title"),
      set: !isDefault,
      cancel: isDefault ? undefined : { attr: `data-pb-x="criteria"`, title: t("pb.criteria.reset", { list: critWords(DEFAULT_SETTINGS.criteria[b.goal]) }) },
    }),
  );
  if (b.filter) {
    const sum = filterSummary(v, b.filter);
    chips.push(chipHtml({ label: t("pb.mf", { sum: sum ?? t("pb.mf.all") }), open: `data-pb="mfilter"`, title: t("pb.mf.title"), set: !!sum, cancel: sum ? { attr: `data-mf-clear`, title: t("pb.mf.clear") } : undefined }));
  }
  // Réglages faits à la main : machines fixées, recettes choisies, écrans des machines, moteur diesel.
  for (const [key, n] of Object.entries(b.fixed)) {
    const s = p.steps.find((x) => x.key === key);
    chips.push(
      chipHtml({
        label: t("pb.fixed", { n, m: s ? machineN(v, s.machine) : t("common.machines"), step: stepName(v, s, key) }),
        open: `data-flow="${esc(key)}"`,
        title: t("pb.toFlow"),
        set: true,
        cancel: { attr: `data-pb-x="fixed" data-key="${esc(key)}"`, title: t("pb.fixed.clear") },
      }),
    );
  }
  const planItems = new Set([...p.steps.map((s) => s.item), ...p.unresolved.map((u) => u.item)]);
  for (const [item, recipeId] of Object.entries(b.forced)) {
    if (!planItems.has(item)) continue;
    const r = v.data.recipes.get(recipeId);
    const s = p.steps.find((x) => x.item === item);
    chips.push(
      chipHtml({
        label: t("pb.forced", { item: itemN(v, item), m: r ? machineN(v, r.machine) : recipeId }),
        open: s ? `data-flow="${esc(s.key)}"` : `data-pb="details"`,
        title: t(s ? "pb.forced.title" : "pb.forced.details"),
        set: true,
        cancel: { attr: `data-pb-x="forced" data-item="${esc(item)}"`, title: t("pb.forced.clear") },
      }),
    );
  }
  for (const [machine, values] of Object.entries(b.msettings)) {
    const text = screenText(b.ifaces?.[machine], values);
    if (!text) continue;
    const s = p.steps.find((x) => x.machine === machine);
    chips.push(
      chipHtml({
        label: t("pb.screen", { m: machineN(v, machine), text }),
        open: s ? `data-flow="${esc(s.key)}"` : `data-pb="schema"`,
        title: t("pb.screen.title"),
        set: true,
        cancel: { attr: `data-pb-x="msetting" data-machine="${esc(machine)}"`, title: t("pb.screen.clear") },
      }),
    );
  }
  if (b.diesel && (b.diesel.fuel !== DEFAULT_DIESEL.fuel || b.diesel.mode !== DEFAULT_DIESEL.mode || b.diesel.config)) {
    const s = p.steps.find((x) => x.machine === "diesel-engine-controller");
    chips.push(
      chipHtml({
        label: t("pb.diesel", { fuel: dieselFuelName(b.diesel.fuel), mode: t(b.diesel.config ? "pb.diesel.config" : `pb.diesel.${b.diesel.mode}`) }),
        open: s ? `data-flow="${esc(s.key)}"` : `data-pb="schema"`,
        title: t("pb.diesel.title"),
        set: true,
        cancel: { attr: `data-pb-x="diesel"`, title: t("pb.diesel.clear") },
      }),
    );
  }
  if (b.advanced) chips.push(chipHtml({ label: t("pb.advanced", { n: String(b.advanced) }), open: `data-pb="advanced"`, title: t("pb.advanced.title"), set: true }));
  return `<div class="plan-bar" role="group" aria-label="${esc(t("pb.aria"))}"><b class="pb-title">${t("pb.title")}</b>${chips.join("")}${verifyMenu(v)}</div>`;
}

/** « ⚠ N valeurs à vérifier ▾ » : la liste, chaque ligne mène à sa correction. */
function verifyMenu(v: Pick<Ctx, "data" | "plan">): string {
  const used = v.plan.verify.filter((e) => e.used);
  if (!used.length) return "";
  const rows = used.map((e) => {
    const s = v.plan.steps.find((x) => (e.scope === "recette" ? x.recipeId === e.id : x.machine === e.id && x.item === e.item));
    const who = s ? `${itemN(v, s.item === ENERGY || s.item === POLLUTION ? s.item : e.item)} (${machineN(v, s.machine)})` : e.scope === "machine" ? machineN(v, e.id) : itemN(v, e.item);
    const whose = e.scope === "machine" ? t("warn.of", { m: machineN(v, e.id) }) : "";
    return `<li><button type="button" class="link" ${fixAttr(e)}><b>${esc(who)}</b>${colon()}${esc(fieldWord(v, e.flag.field))}${esc(whose)} — ${esc(doubtText(e.flag))} <span class="pb-go">${t("pb.fix")}</span></button></li>`;
  });
  return `<details class="pb-warn"><summary class="pb-chip warn">${t("pb.verify", { n: used.length })}</summary><div class="pb-menu"><p class="hint">${t("pb.verify.hint")}</p><ul>${rows.join("")}</ul></div></details>`;
}
