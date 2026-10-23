// Réglages visibles (S28) : la barre « Ton plan » au-dessus des onglets du résultat, et les ⚠ des
// valeurs à vérifier sur les blocs, les lignes et les modules. Fonctions pures (chaînes HTML) :
// main.ts les insère et branche les clics (data-pb, data-pb-x, data-fix).

import type { Criterion } from "../engine/choose.ts";
import { ENERGY, POLLUTION } from "../engine/resources.ts";
import type { Step, VerifyEntry } from "../engine/solve.ts";
import type { VerifyFlag } from "../engine/types.ts";
import { DEFAULT_DIESEL, type DieselChoice } from "./diesel.ts";
import { esc, fmt, fmtMF } from "./format.ts";
import { screenText } from "./iface-view.ts";
import { filterSummary } from "./mfilter-view.ts";
import { itemN, machineN, type Ctx } from "./render.ts";
import { DEFAULT_SETTINGS, type Goal, type PlanMachines } from "./state.ts";
import type { Interfaces, MachineSettings } from "../engine/interfaces.ts";
import { dieselFuelName } from "../engine/modular-calc.ts";

/** Une priorité en un mot, pour la barre. */
const CRIT_WORD: Record<Criterion, string> = {
  area: "place",
  machines: "machines",
  energy: "énergie",
  cost: "prix",
  pollution: "pollution",
  raw: "matières premières",
  steps: "chaîne courte",
};

const DIESEL_MODE: Record<DieselChoice["mode"], string> = { carburant: "meilleur rapport", place: "moins de place", puissance: "meilleure production" };

/** Une valeur d'un craft ou d'une machine, en mots de joueur (« durée », « sortie Gear »). */
export function fieldWord(v: Pick<Ctx, "data">, field: string): string {
  const [head, rest] = [field.split(".")[0]!, field.split(".").slice(1).join(".")];
  if (head === "inputs") return `entrée ${itemN(v, rest)}`;
  if (head === "outputs") return `sortie ${itemN(v, rest)}`;
  return ({ durationS: "durée", energyMFps: "énergie", cost: "prix", size: "taille", machine: "machine", parts: "bâtiments de l'installation", pollutionPerHour: "pollution", unlockedBy: "recherche qui la débloque" } as Record<string, string>)[head] ?? field;
}

/** Le doute du wiki, avec ses unités : « 15 s (Miraheze) ou 17,2 s (Fandom) » ; sinon le texte relevé. */
export function doubtText(f: VerifyFlag): string {
  const pairs = [...f.detail.matchAll(/(Miraheze|Fandom|wiki|jeu)\s*:\s*(-?[\d.]+)/gi)].map((m) => ({ src: m[1]!, n: Number(m[2]) }));
  if (pairs.length < 2 || pairs.some((p) => !Number.isFinite(p.n))) return f.detail;
  const unit = (n: number) => (f.field === "durationS" ? `${fmt(n, 2)} s` : f.field === "energyMFps" ? fmtMF(n) : fmt(n, 3));
  return pairs.map((p) => `${unit(p.n)} (${p.src})`).join(" ou ");
}

/** Attribut d'un ⚠ : de quoi ouvrir la correction (portée, id, champ, objet de la fiche). */
export const fixAttr = (e: Pick<VerifyEntry, "scope" | "id" | "item" | "flag">) => `data-fix="${esc(`${e.scope}|${e.id}|${e.flag.field}|${e.item}`)}"`;

/** Valeurs à vérifier qu'utilise une étape : celles de son craft, puis celles de sa machine. */
export function stepWarnings(v: Pick<Ctx, "plan">, s: Pick<Step, "recipeId" | "machine" | "item">): VerifyEntry[] {
  return v.plan.verify.filter((e) => e.used && (e.scope === "recette" ? e.id === s.recipeId : e.id === s.machine && e.item === s.item));
}

/** Petit ⚠ cliquable (ligne, module) : la première valeur à vérifier, les autres au survol. */
export function warnButton(v: Pick<Ctx, "data">, list: VerifyEntry[]): string {
  if (!list.length) return "";
  const what = list.map((e) => `${fieldWord(v, e.flag.field)} : ${doubtText(e.flag)}`).join(" ; ");
  return `<button type="button" class="warn-btn" ${fixAttr(list[0]!)} title="${esc(`À vérifier — ${what}. Clique pour corriger.`)}">⚠<span class="sr-only"> valeur à vérifier : ${esc(what)}, corriger</span></button>`;
}

/** Pastilles ⚠ de la barre du bloc : chaque valeur douteuse, en clair, avec « corriger ▸ ». */
export function warnChips(v: Pick<Ctx, "data">, list: VerifyEntry[]): string {
  return list
    .map((e) => {
      const whose = e.scope === "machine" ? ` de ${machineN(v, e.id)}` : "";
      return `<button type="button" class="warn-chip" ${fixAttr(e)}>⚠ ${esc(fieldWord(v, e.flag.field))}${esc(whose)} à vérifier : ${esc(doubtText(e.flag))} — corriger ▸</button>`;
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
const stepName = (v: Pick<Ctx, "data">, s: Step | undefined, key: string) => (s ? (s.item === ENERGY ? "Énergie" : itemN(v, s.item)) : itemN(v, key.split("@")[0]!));

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
      label: `Priorités : ${b.criteria.slice(0, 3).map((c) => CRIT_WORD[c]).join(" › ")} ▾`,
      open: `data-pb="criteria"`,
      title: "Changer l'ordre des priorités du calcul",
      set: !isDefault,
      cancel: isDefault ? undefined : { attr: `data-pb-x="criteria"`, title: `Revenir à l'ordre par défaut (${DEFAULT_SETTINGS.criteria[b.goal].slice(0, 3).map((c) => CRIT_WORD[c]).join(" › ")})` },
    }),
  );
  if (b.filter) {
    const sum = filterSummary(v, b.filter);
    chips.push(chipHtml({ label: `Machines : ${sum ?? "toutes"} ▾`, open: `data-pb="mfilter"`, title: "Exclure des machines, ou n'utiliser que certaines", set: !!sum, cancel: sum ? { attr: `data-mf-clear`, title: "Retirer le filtre : toutes les machines débloquées" } : undefined }));
  }
  // Réglages faits à la main : machines fixées, recettes choisies, écrans des machines, moteur diesel.
  for (const [key, n] of Object.entries(b.fixed)) {
    const s = p.steps.find((x) => x.key === key);
    chips.push(
      chipHtml({
        label: `${n} × ${s ? machineN(v, s.machine) : "machines"} (${stepName(v, s, key)}) fixé${n > 1 ? "s" : ""}`,
        open: `data-flow="${esc(key)}"`,
        title: "Voir ce bloc dans le schéma",
        set: true,
        cancel: { attr: `data-pb-x="fixed" data-key="${esc(key)}"`, title: "Ne plus fixer ce nombre : revenir au calcul" },
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
        label: `Recette de ${itemN(v, item)} : ${r ? machineN(v, r.machine) : recipeId}`,
        open: s ? `data-flow="${esc(s.key)}"` : `data-pb="details"`,
        title: s ? "Voir ce bloc dans le schéma (la recette se change dans sa barre)" : "Voir les recettes dans Détails",
        set: true,
        cancel: { attr: `data-pb-x="forced" data-item="${esc(item)}"`, title: "Revenir au choix automatique pour cet objet" },
      }),
    );
  }
  for (const [machine, values] of Object.entries(b.msettings)) {
    const text = screenText(b.ifaces?.[machine], values);
    if (!text) continue;
    const s = p.steps.find((x) => x.machine === machine);
    chips.push(
      chipHtml({
        label: `${machineN(v, machine)} : écran ${text}`,
        open: s ? `data-flow="${esc(s.key)}"` : `data-pb="schema"`,
        title: "Voir la machine dans le schéma, où se règle son écran",
        set: true,
        cancel: { attr: `data-pb-x="msetting" data-machine="${esc(machine)}"`, title: "Remettre l'écran à 1×" },
      }),
    );
  }
  if (b.diesel && (b.diesel.fuel !== DEFAULT_DIESEL.fuel || b.diesel.mode !== DEFAULT_DIESEL.mode || b.diesel.config)) {
    const s = p.steps.find((x) => x.machine === "diesel-engine-controller");
    chips.push(
      chipHtml({
        label: `Moteur diesel : ${dieselFuelName(b.diesel.fuel)}, ${b.diesel.config ? "configuration imposée" : DIESEL_MODE[b.diesel.mode]}`,
        open: s ? `data-flow="${esc(s.key)}"` : `data-pb="schema"`,
        title: "Voir le moteur dans le schéma, où se règle son carburant",
        set: true,
        cancel: { attr: `data-pb-x="diesel"`, title: "Revenir au choix par défaut (Refined Diesel, meilleur rapport)" },
      }),
    );
  }
  if (b.advanced) chips.push(chipHtml({ label: `Options avancées : ${b.advanced} ▾`, open: `data-pb="advanced"`, title: "Voir les options avancées activées", set: true }));
  return `<div class="plan-bar" role="group" aria-label="Ton plan : les réglages qui changent ce résultat"><b class="pb-title">Ton plan</b>${chips.join("")}${verifyMenu(v)}</div>`;
}

/** « ⚠ N valeurs à vérifier ▾ » : la liste, chaque ligne mène à sa correction. */
function verifyMenu(v: Pick<Ctx, "data" | "plan">): string {
  const used = v.plan.verify.filter((e) => e.used);
  if (!used.length) return "";
  const rows = used.map((e) => {
    const s = v.plan.steps.find((x) => (e.scope === "recette" ? x.recipeId === e.id : x.machine === e.id && x.item === e.item));
    const who = s ? `${itemN(v, s.item === ENERGY || s.item === POLLUTION ? s.item : e.item)} (${machineN(v, s.machine)})` : e.scope === "machine" ? machineN(v, e.id) : itemN(v, e.item);
    const whose = e.scope === "machine" ? ` de ${machineN(v, e.id)}` : "";
    return `<li><button type="button" class="link" ${fixAttr(e)}><b>${esc(who)}</b> : ${esc(fieldWord(v, e.flag.field))}${esc(whose)} — ${esc(doubtText(e.flag))} <span class="pb-go">corriger ▸</span></button></li>`;
  });
  const n = used.length;
  return `<details class="pb-warn"><summary class="pb-chip warn">⚠ ${n} valeur${n > 1 ? "s" : ""} à vérifier ▾</summary><div class="pb-menu"><p class="hint">Ces valeurs servent à ton plan, mais les wikis se contredisent ou ne les donnent pas. Clique pour la corriger avec ce que tu vois en jeu.</p><ul>${rows.join("")}</ul></div></details>`;
}
