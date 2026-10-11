// Point d'entrée de l'interface : charge les données, lit les réglages, appelle
// solve() et affiche le résultat. Toute la logique de calcul est dans src/engine.

import "../styles.css";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type GameData, type RawFiles } from "../engine/data.ts";
import { solve, type Plan } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import type { Progress } from "../engine/unlock.ts";
import { esc, fmt, parseInput } from "./format.ts";
import { renderCorrections, renderGraph, renderPlan, renderRecipes, renderStatus, renderSummary, renderVerify, renderWarnings, type Ctx } from "./render.ts";
import {
  countCorrections,
  isOverridesFile,
  loadCorrections,
  loadSettings,
  mergeCorrections,
  removeCorrection,
  saveCorrections,
  saveSettings,
  setCorrection,
  type Scope,
  type Settings,
} from "./state.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson } as unknown as RawFiles;
const repoOverrides = overridesJson as unknown as OverridesFile;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings = loadSettings();
let corrections: OverridesFile = loadCorrections();
let data: GameData = buildGameData(files, []).data;
let dataErrors: string[] = [];
let plan: Plan | undefined;

function rebuildData(): void {
  const r = buildGameData(files, [repoOverrides, corrections]);
  data = r.data;
  dataErrors = r.errors;
}

function progress(): Progress {
  // Étape (c) : progression simplifiée. L'arbre de recherche arrive à l'étape (d).
  // Les machines « Limited » sans nœud ne sont jamais supposées possédées.
  return settings.allUnlocked ? { unlocked: new Set(data.nodes.keys()) } : { unlocked: new Set() };
}

// ---------------------------------------------------------------- recherche d'item
const byName = new Map<string, string>();
function fillItemList(): void {
  const list = $("item-list");
  const items = [...data.items.values()].sort((a, b) => a.name.localeCompare(b.name));
  byName.clear();
  for (const it of items) byName.set(it.name.toLowerCase(), it.id);
  list.innerHTML = items.map((it) => `<option value="${esc(it.name)}"></option>`).join("");
}
function resolveItem(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (byName.has(t)) return byName.get(t)!;
  if (data.items.has(t)) return t;
  const partial = [...byName.entries()].filter(([n]) => n.includes(t));
  return partial.length === 1 ? partial[0]![1] : null;
}

// ---------------------------------------------------------------- rendu
function syncForm(): void {
  ($("item") as HTMLInputElement).value = data.items.get(settings.item)?.name ?? settings.item;
  ($("criterion") as HTMLSelectElement).value = settings.criterion;
  ($("unverified") as HTMLInputElement).checked = settings.useUnverified;
  ($("all-unlocked") as HTMLInputElement).checked = settings.allUnlocked;
  ($("rate") as HTMLInputElement).value = String(settings.rate);
  ($("machines") as HTMLInputElement).value = String(settings.machines);
}

function render(): void {
  plan = solve(data, progress(), {
    item: settings.item,
    ...(settings.mode === "rate" ? { ratePerMin: settings.rate } : { finalMachines: settings.machines }),
    criterion: settings.criterion,
    forced: settings.forced,
    useUnverified: settings.useUnverified,
  });
  const ctx: Ctx = { data, plan, settings, corrections };

  // Champ « complémentaire » : débit calculé en mode machines, et inversement.
  const final = plan.steps.find((s) => s.item === settings.item);
  if (settings.mode === "machines" && document.activeElement !== $("rate")) ($("rate") as HTMLInputElement).value = fmt(plan.target.ratePerMin, 2).replace(/\s/g, "").replace(",", ".");
  if (settings.mode === "rate" && final && document.activeElement !== $("machines")) ($("machines") as HTMLInputElement).value = String(final.machines);
  $("mode-hint").textContent = settings.mode === "machines" ? "Calcul à partir du nombre de machines finales." : "Calcul à partir du débit voulu.";
  $("rate").closest("label")!.classList.toggle("active", settings.mode === "rate");
  $("machines").closest("label")!.classList.toggle("active", settings.mode === "machines");

  $("status").innerHTML = renderStatus(ctx);
  $("stats").innerHTML = renderSummary(ctx);
  $("graph").innerHTML = renderGraph(ctx);
  $("plan").innerHTML = renderPlan(ctx);
  $("verify").innerHTML = renderVerify(ctx);
  $("verify-count").textContent = String(plan.verify.filter((v) => v.used).length);
  $("corrections").innerHTML = renderCorrections(ctx);
  $("corrections-count").textContent = String(countCorrections(corrections));
  $("data-errors").innerHTML = dataErrors.length ? `<div class="banner bad">Corrections ignorées :<ul>${dataErrors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : "";
  $("rec").innerHTML = renderRecipes(ctx);
  $("warnings").innerHTML = renderWarnings(ctx);
  $("forced-reset").hidden = !Object.keys(settings.forced).length;
  saveSettings(settings);
}

let timer: number | undefined;
function renderSoon(): void {
  clearTimeout(timer);
  timer = window.setTimeout(render, 120);
}

// ---------------------------------------------------------------- événements
function bind(): void {
  const itemInput = $("item") as HTMLInputElement;
  const onItem = () => {
    const id = resolveItem(itemInput.value);
    $("item-hint").textContent = id ? "" : itemInput.value.trim() ? "Item introuvable : choisis un nom dans la liste." : "";
    if (id && id !== settings.item) {
      settings.item = id;
      render();
    }
  };
  itemInput.addEventListener("change", onItem);
  itemInput.addEventListener("input", () => {
    if (byName.has(itemInput.value.trim().toLowerCase())) onItem();
  });

  $("rate").addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value.replace(",", "."));
    if (v > 0) {
      settings.mode = "rate";
      settings.rate = v;
      renderSoon();
    }
  });
  $("machines").addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value.replace(",", "."));
    if (v > 0) {
      settings.mode = "machines";
      settings.machines = v;
      renderSoon();
    }
  });
  $("criterion").addEventListener("change", (e) => {
    settings.criterion = (e.target as HTMLSelectElement).value as Settings["criterion"];
    render();
  });
  $("unverified").addEventListener("change", (e) => {
    settings.useUnverified = (e.target as HTMLInputElement).checked;
    render();
  });
  $("all-unlocked").addEventListener("change", (e) => {
    settings.allUnlocked = (e.target as HTMLInputElement).checked;
    render();
  });
  $("forced-reset").addEventListener("click", () => {
    settings.forced = {};
    render();
  });

  // Forcer une recette (menu sur chaque étape du plan)
  $("plan").addEventListener("change", (e) => {
    const sel = e.target as HTMLSelectElement;
    const item = sel.dataset.force;
    if (!item) return;
    if (sel.value) settings.forced = { ...settings.forced, [item]: sel.value };
    else {
      const { [item]: _, ...rest } = settings.forced;
      settings.forced = rest;
    }
    render();
    document.getElementById(`step-${item}`)?.querySelector("select")?.focus();
  });

  // Saisie d'une valeur relevée en jeu
  $("verify").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const { scope, id, field } = form.dataset as { scope: Scope; id: string; field: string };
    const raw = (form.elements.namedItem("value") as HTMLInputElement).value;
    const parsed = parseInput(field, raw);
    const err = form.querySelector(".fix-error")!;
    if (!parsed.ok) {
      err.textContent = parsed.error;
      return;
    }
    corrections = setCorrection(corrections, scope, id, field, parsed.value);
    saveCorrections(corrections);
    rebuildData();
    render();
  });
  $("corrections").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove]");
    if (!btn) return;
    const [scope, id, field] = btn.dataset.remove!.split("|") as [Scope, string, string];
    corrections = removeCorrection(corrections, scope, id, field);
    saveCorrections(corrections);
    rebuildData();
    render();
  });
  $("export").addEventListener("click", () => {
    const merged = mergeCorrections(repoOverrides, corrections);
    const blob = new Blob([JSON.stringify(merged, null, 1) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "overrides.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("import").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isOverridesFile(parsed)) throw new Error("format inattendu");
      corrections = mergeCorrections(corrections, parsed);
      saveCorrections(corrections);
      rebuildData();
      render();
    } catch (err) {
      $("data-errors").innerHTML = `<div class="banner bad">Import impossible : ${esc((err as Error).message)}</div>`;
    }
  });
  $("clear-corrections").addEventListener("click", () => {
    if (!countCorrections(corrections)) return;
    if (!confirm("Effacer toutes tes corrections locales ? (Pense à les exporter avant.)")) return;
    corrections = {};
    saveCorrections(corrections);
    rebuildData();
    render();
  });
}

rebuildData();
if (!data.items.has(settings.item)) settings.item = "crankshaft";
fillItemList();
syncForm();
bind();
render();
