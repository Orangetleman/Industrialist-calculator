// Filtre de machines d'un plan (S9) : réglage « Machines » sous « Priorités », note dans la réponse,
// et les changements qu'on y fait (fonctions pures : main.ts insère le HTML et branche les événements).

import type { GameData } from "../engine/data.ts";
import { isExtractor } from "../engine/machine-filter.ts";
import type { Plan } from "../engine/solve.ts";
import { t } from "../i18n/i18n.ts";
import { esc } from "./format.ts";
import { machineN } from "./render.ts";
import type { PlanMachines } from "./state.ts";

type Data = { data: GameData };

const byName = (ctx: Data) => (a: string, b: string) => machineN(ctx, a).localeCompare(machineN(ctx, b));
const extractor = (ctx: Data, id: string) => isExtractor(ctx.data.machines.get(id));

/** Machines du plan (étapes et bâtiments des installations composées), dans l'ordre des noms. */
export function planMachineIds(ctx: Data, plan: Plan): string[] {
  const ids = new Set<string>();
  for (const s of plan.steps) {
    if (s.parts) for (const p of s.parts) ids.add(p.machine);
    else ids.add(s.machine);
  }
  return [...ids].sort(byName(ctx));
}

/** Machines qu'on peut chercher : celles qui ont au moins un craft (débloquées ou non). */
export function filterableMachines(ctx: Data): string[] {
  const ids = new Set<string>();
  for (const r of ctx.data.recipes.values()) {
    ids.add(r.machine);
    for (const p of r.parts ?? []) ids.add(p.machine);
  }
  return [...ids].filter((id) => ctx.data.machines.has(id)).sort(byName(ctx));
}

/** Retrouve une machine par son nom tapé : nom exact (sans la casse), sinon début de nom unique. */
export function findMachine(ctx: Data, text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const all = filterableMachines(ctx);
  const exact = all.find((id) => machineN(ctx, id).toLowerCase() === t || id === t);
  if (exact) return exact;
  const starts = all.filter((id) => machineN(ctx, id).toLowerCase().startsWith(t));
  return starts.length === 1 ? starts[0]! : null;
}

// ---------------------------------------------------------------- changements

/** Change de mode ; « Seulement… » part des machines du plan affiché si sa liste est vide (décision S9). */
export function withMode(ctx: Data, pm: PlanMachines, mode: PlanMachines["mode"], plan: Plan): PlanMachines {
  if (mode === "seulement" && !pm.seulement.length) {
    return { ...pm, mode, seulement: planMachineIds(ctx, plan).filter((id) => !extractor(ctx, id)) };
  }
  return { ...pm, mode };
}

/** « Ne plus utiliser » : écartée en mode « exclure » (« toutes » y passe), retirée en mode « seulement ». */
export function banMachine(ctx: Data, pm: PlanMachines, id: string): PlanMachines {
  if (pm.mode === "seulement") {
    if (pm.seulement.includes(id)) return { ...pm, seulement: pm.seulement.filter((x) => x !== id) };
    return extractor(ctx, id) && !pm.noExtraction.includes(id) ? { ...pm, noExtraction: [...pm.noExtraction, id] } : pm;
  }
  return { ...pm, mode: "exclure", exclure: pm.exclure.includes(id) ? pm.exclure : [...pm.exclure, id] };
}

/** « Permettre » : n'est plus écartée (mode « exclure »), ou ajoutée aux machines permises (mode « seulement »). */
export function allowMachine(ctx: Data, pm: PlanMachines, id: string): PlanMachines {
  if (pm.mode === "seulement") {
    if (pm.noExtraction.includes(id)) return { ...pm, noExtraction: pm.noExtraction.filter((x) => x !== id) };
    return extractor(ctx, id) || pm.seulement.includes(id) ? pm : { ...pm, seulement: [...pm.seulement, id] };
  }
  return { ...pm, exclure: pm.exclure.filter((x) => x !== id) };
}

// ---------------------------------------------------------------- affichage

const names = (ctx: Data, ids: string[]) => [...ids].sort(byName(ctx)).map((id) => machineN(ctx, id)).join(", ");

/** Le résumé, réglage replié (et la note de la réponse) ; null : aucun filtre actif. */
export function filterSummary(ctx: Data, pm: PlanMachines): string | null {
  if (pm.mode === "exclure" && pm.exclure.length) return t("mf.sum.except", { names: names(ctx, pm.exclure) });
  if (pm.mode === "seulement") {
    const n = pm.seulement.length;
    const noExt = pm.noExtraction.length ? names(ctx, pm.noExtraction) : "";
    const ext = noExt ? t("mf.sum.plusExtExcept", { names: noExt }) : t("mf.sum.plusExt");
    const what = n ? (n === 1 ? names(ctx, pm.seulement) : t("mf.sum.n", { n })) : t("mf.sum.extraction");
    return t("mf.sum.only", { what }) + (n ? ` (${ext})` : noExt ? t("mf.sum.butNot", { names: noExt }) : "");
  }
  return null;
}

const chip = (ctx: Data, id: string, attr: string, label: string, sign: string, off = false) =>
  `<span class="chip mf${off ? " off" : ""}">${esc(machineN(ctx, id))} <button type="button" ${attr}="${esc(id)}" aria-label="${esc(label)}">${sign}</button></span>`;

/**
 * Le contenu du réglage ouvert : les machines choisies (la recherche est fixe dans la page), puis les
 * raccourcis vers les machines du plan, et l'extraction en mode « seulement ».
 */
export function renderFilterBody(ctx: Data, pm: PlanMachines, plan: Plan): { chips: string; more: string; label: string; placeholder: string } {
  const inPlan = planMachineIds(ctx, plan);
  if (pm.mode === "toutes") {
    return { chips: "", more: `<p class="hint">${t("mf.free")}</p>`, label: "", placeholder: "" };
  }
  const none = `<span class="hint">${t("mf.none")}</span>`;
  if (pm.mode === "exclure") {
    const chips = [...pm.exclure].sort(byName(ctx)).map((id) => chip(ctx, id, "data-mf-allow", t("mf.unban", { m: machineN(ctx, id) }), "×")).join("");
    const add = inPlan.filter((id) => !pm.exclure.includes(id));
    const more = [
      add.length ? `<div class="mf-row"><span class="hint">${t("mf.inPlan")}</span> ${add.map((id) => `<button type="button" class="chip add" data-mf-ban="${esc(id)}">+ ${esc(machineN(ctx, id))}</button>`).join("")}</div>` : "",
      `<p class="hint">${t("mf.excluded.note")}</p>`,
    ].join("");
    return { chips: chips || none, more, label: t("mf.excluded"), placeholder: t("mf.excluded.ph") };
  }
  const chips = [...pm.seulement].sort(byName(ctx)).map((id) => chip(ctx, id, "data-mf-ban", t("mf.remove", { m: machineN(ctx, id) }), "×")).join("");
  const ext = [...new Set([...inPlan.filter((id) => extractor(ctx, id)), ...pm.noExtraction])].sort(byName(ctx));
  const others = filterableMachines(ctx).filter((id) => extractor(ctx, id) && !ext.includes(id)).length;
  const extChips = ext
    .map((id) => (pm.noExtraction.includes(id) ? chip(ctx, id, "data-mf-allow", t("mf.allow", { m: machineN(ctx, id) }), "↺", true) : chip(ctx, id, "data-mf-ban", t("mf.ban", { m: machineN(ctx, id) }), "×")))
    .join("");
  const rest = ext.length ? (others === 1 ? t("mf.ext.others1") : t("mf.ext.others", { n: others })) : t("mf.ext.all", { n: others });
  const more = [
    `<div class="mf-row"><span class="k">${t("mf.ext")}</span> ${extChips}<span class="hint">${rest} ${t("mf.ext.source")}</span></div>`,
    pm.seulement.length ? "" : `<p class="hint warn-text">${t("mf.ext.only")}</p>`,
  ].join("");
  return { chips: chips || none, more, label: t("mf.allowed"), placeholder: t("mf.allowed.ph") };
}

