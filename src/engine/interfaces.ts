// Interfaces des machines (S10) : l'étiquette « [E] Interact », un levier ou un écran qui règle la
// machine. Rien pour le placement (décision Q5) ; deux effets sur le calcul :
//   - un réglage à positions choisit le craft (levier des mouleurs, écran de la Quarry) : le calcul
//     choisit le craft comme avant, et le plan dit la position à mettre ;
//   - un réglage chiffré multiplie les quantités et l'énergie de tous les crafts de la machine
//     (écran de la Chemical Plant) : on applique les valeurs saisies pour le plan.

import { type GameData, indexProducers } from "./data.ts";
import type { InterfaceChoice, InterfaceSetting, MachineInterface } from "./extension-types.ts";
import type { Recipe } from "./types.ts";
import { msg, type Message } from "./message.ts";

export type Interfaces = Record<string, MachineInterface>;
/** Réglages chiffrés d'un plan : machine → réglage → valeur. */
export type MachineSettings = Record<string, Record<string, number>>;
export type Factors = { inputs: number; outputs: number; energy: number };

/** Interfaces du dépôt, remplacées machine par machine par celles notées dans ce navigateur. */
export function mergeInterfaces(repo: Interfaces, local: Interfaces): Interfaces {
  return { ...repo, ...local };
}

/** Le réglage a-t-il un effet sur le calcul (positions avec crafts, ou nombre qui multiplie) ? */
export const settingCounts = (s: InterfaceSetting) => !!(s.choices?.some((c) => c.recipes.length) || s.number?.scales);
export const hasEffect = (i: MachineInterface | undefined) => !!i?.settings.some(settingCounts);
/** Réglages chiffrés d'une interface (ceux qui multiplient quelque chose). */
export const numberSettings = (i: MachineInterface | undefined) => (i?.settings ?? []).filter((s) => s.number?.scales);

/** Positions à mettre pour faire ce craft : une par réglage à positions qui le cite. */
export function choicesFor(i: MachineInterface | undefined, recipeId: string): { setting: InterfaceSetting; choice: InterfaceChoice }[] {
  const out: { setting: InterfaceSetting; choice: InterfaceChoice }[] = [];
  for (const setting of i?.settings ?? []) {
    const choice = setting.choices?.find((c) => c.recipes.includes(recipeId));
    if (choice) out.push({ setting, choice });
  }
  return out;
}

/** « levier sur « container » », « Écran à l'avant : « Soil & Clay » ». */
export function choiceText(i: MachineInterface, setting: InterfaceSetting, choice: InterfaceChoice): Message {
  return i.kind === "levier" ? msg("if.lever", { setting: { note: setting.name, lower: true }, choice: { note: choice.label } }) : msg("if.screen", { setting: { note: setting.name }, choice: { note: choice.label } });
}

/** Valeur d'un réglage chiffré pour le plan (sa valeur par défaut s'il n'est pas réglé). */
export function settingValue(s: InterfaceSetting, values: Record<string, number> | undefined): number {
  const v = values?.[s.id];
  return typeof v === "number" && v > 0 && Number.isFinite(v) ? v : s.number!.default;
}

/** Multiplicateurs d'une machine pour le plan : entrées, sorties, énergie (1 = craft du wiki). */
export function factorsFor(i: MachineInterface | undefined, values: Record<string, number> | undefined): Factors {
  const f: Factors = { inputs: 1, outputs: 1, energy: 1 };
  for (const s of numberSettings(i)) {
    const v = settingValue(s, values);
    if (s.number!.scales === "entrées") f.inputs *= v;
    else if (s.number!.scales === "sorties") f.outputs *= v;
    else f.energy *= v;
  }
  return f;
}

const isOne = (f: Factors) => f.inputs === 1 && f.outputs === 1 && f.energy === 1;
const scale = (o: Record<string, number | null>, k: number) => Object.fromEntries(Object.entries(o).map(([id, q]) => [id, q === null ? null : q * k]));

/**
 * Données du plan, réglages chiffrés appliqués : les crafts des machines réglées sont copiés et
 * multipliés (data n'est pas modifié). Sans réglage autre que 1× : data tel quel.
 */
export function applyMachineSettings(data: GameData, ifaces: Interfaces, values: MachineSettings): GameData {
  const factors = new Map<string, Factors>();
  for (const [machine, i] of Object.entries(ifaces)) {
    const f = factorsFor(i, values[machine]);
    if (!isOne(f)) factors.set(machine, f);
  }
  if (!factors.size) return data;
  const recipes = new Map<string, Recipe>();
  for (const [id, r] of data.recipes) {
    const f = factors.get(r.machine);
    if (!f || r.parts) {
      recipes.set(id, r);
      continue;
    }
    recipes.set(id, {
      ...r,
      inputs: scale(r.inputs, f.inputs),
      outputs: scale(r.outputs, f.outputs),
      energyMFps: r.energyMFps === null ? null : r.energyMFps * f.energy,
      screen: { ...f, base: { inputs: r.inputs, outputs: r.outputs, energyMFps: r.energyMFps } },
    });
  }
  return { ...data, recipes, producers: indexProducers(recipes) };
}

/**
 * Écran chiffré (Chemical Plant) : le wiki marque « variables » (modes « plant_speed… ») les
 * quantités et l'énergie qui suivent l'écran, mais les donne à 1× (« Speed and Efficiency at
 * 100% »). Avec le réglage du plan, elles sont connues : ces marques ne bloquent plus le calcul.
 * Renvoie le nombre de marques retirées.
 */
export function resolveScreenFlags(recipes: Map<string, Recipe>, ifaces: Interfaces): number {
  let n = 0;
  for (const r of recipes.values()) {
    if (!numberSettings(ifaces[r.machine]).length) continue;
    const before = r.verify.length;
    r.verify = r.verify.filter((f) => !(f.reason === "variable" && f.mode?.startsWith("plant_speed")));
    n += before - r.verify.length;
  }
  return n;
}

/** Contrôles d'une interface notée dans l'éditeur : liste des problèmes (vide = complète). */
export function checkInterface(i: MachineInterface, machineRecipes: string[]): Message[] {
  const out: Message[] = [];
  if (!i.settings.length) out.push(msg("if.none"));
  const ids = new Set<string>();
  const used = new Map<string, string>();
  for (const s of i.settings) {
    const name = { note: s.name };
    if (!s.name.trim()) out.push(msg("if.noName"));
    if (ids.has(s.id)) out.push(msg("if.twice", { s: name }));
    ids.add(s.id);
    if (s.choices && s.number) out.push(msg("if.both", { s: name }));
    for (const c of s.choices ?? []) {
      if (!c.label.trim()) out.push(msg("if.noLabel", { s: name }));
      for (const r of c.recipes) {
        if (!machineRecipes.includes(r)) out.push(msg("if.unknownCraft", { s: name, r }));
        const prev = used.get(`${s.id}|${r}`);
        if (prev) out.push(msg("if.craftTwice", { s: name, r, a: { note: prev }, b: { note: c.label } }));
        used.set(`${s.id}|${r}`, c.label);
      }
    }
    if (s.number && !(s.number.default > 0)) out.push(msg("if.noDefault", { s: name }));
  }
  return out;
}
