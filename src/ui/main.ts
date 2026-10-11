// Point d'entrée de l'interface : charge les données, lit les réglages, appelle
// solve() et affiche le résultat. Toute la logique de calcul est dans src/engine.

import "../styles.css";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import overridesJson from "../../data/overrides.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { buildGameData, type GameData, type RawFiles } from "../engine/data.ts";
import { solve, type Plan, type PlayerState } from "../engine/solve.ts";
import type { OverridesFile } from "../engine/types.ts";
import { dependentsOf, missingNodes, rpCost, unlockUpTo } from "../engine/unlock.ts";
import { esc, fmt, fmtMoney, fmtRP, parseInput } from "./format.ts";
import {
  loadPlayer,
  loadProgress,
  parseOptional,
  progressSummary,
  renderOwned,
  renderTree,
  sanitizeProgress,
  savePlayer,
  saveProgress,
  toEngineProgress,
  type PlayerInfo,
  type ProgressState,
  type TreeView,
} from "./progress.ts";
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
let prog: ProgressState = loadProgress();
let player: PlayerInfo = loadPlayer();
const treeView: TreeView = { category: "Production", filter: "" };

function rebuildData(): void {
  const r = buildGameData(files, [repoOverrides, corrections]);
  data = r.data;
  dataErrors = r.errors;
}

function playerState(): PlayerState {
  return { ...toEngineProgress(prog), ...player };
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
  ($("rate") as HTMLInputElement).value = String(settings.rate);
  ($("machines") as HTMLInputElement).value = String(settings.machines);
}

function render(): void {
  plan = solve(data, playerState(), {
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
  renderProgress();
}

// ---------------------------------------------------------------- progression et « Ma partie »
function renderProgress(): void {
  const p = toEngineProgress(prog);
  $("progress-summary").textContent = progressSummary(data, p);
  const focused = (document.activeElement as HTMLElement | null)?.dataset;
  const focusKey = focused?.node ? `[data-node="${focused.node}"]` : focused?.req ? `[data-req="${focused.req}"]` : null;
  $("tree").innerHTML = renderTree(data, p, treeView);
  $("owned").innerHTML = renderOwned(data, p);
  if (focusKey) $("tree").querySelector<HTMLElement>(focusKey)?.focus();
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tabs [data-cat]")) tab.setAttribute("aria-selected", String(tab.dataset.cat === treeView.category));
  const parts = [
    player.pollutionPct !== null ? `pollution ${fmt(player.pollutionPct, 1)} %` : null,
    player.money !== null ? fmtMoney(player.money) : null,
    player.rp !== null ? fmtRP(player.rp) : null,
    player.rpPerSec !== null ? `${fmt(player.rpPerSec, 2)} RP/s` : null,
  ].filter(Boolean);
  $("player-summary").textContent = parts.length ? parts.join(" · ") : "non renseignée";
}

function fillNodeList(): void {
  $("node-list").innerHTML = [...data.nodes.values()]
    .filter((n) => !n.isRoot)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((n) => `<option value="${esc(n.name)}">${esc(n.category)} · ${fmt(n.rp, 0)} RP</option>`)
    .join("");
}

function syncPlayerForm(): void {
  const set = (id: string, v: number | null) => {
    ($(id) as HTMLInputElement).value = v === null ? "" : String(v).replace(".", ",");
  };
  set("p-pollution", player.pollutionPct);
  set("p-money", player.money);
  set("p-rp", player.rp);
  set("p-rps", player.rpPerSec);
}

function setProgress(next: ProgressState): void {
  prog = next;
  saveProgress(prog);
  render();
}

const nodeName = (id: string) => data.nodes.get(id)?.name ?? id;

/** Petite boîte de dialogue : renvoie la valeur du bouton choisi ("" si fermée). */
function ask(title: string, bodyHtml: string, buttons: { value: string; label: string; primary?: boolean }[]): Promise<string> {
  const dlg = $("ask") as HTMLDialogElement;
  $("ask-title").textContent = title;
  $("ask-body").innerHTML = bodyHtml;
  $("ask-actions").innerHTML = buttons.map((b) => `<button value="${esc(b.value)}"${b.primary ? ` class="primary"` : ""}>${esc(b.label)}</button>`).join("");
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue), { once: true });
    dlg.returnValue = "";
    dlg.showModal();
    dlg.querySelector<HTMLButtonElement>("button.primary")?.focus();
  });
}

async function toggleNode(id: string, checked: boolean): Promise<void> {
  const p = toEngineProgress(prog);
  if (checked) {
    const missing = missingNodes(data, p, id).filter((x) => x !== id);
    let add = [id];
    if (missing.length) {
      const choice = await ask(
        "Prérequis non cochés",
        `<p><b>${esc(nodeName(id))}</b> demande ${missing.length} recherche(s) que tu n'as pas cochée(s) (${esc(fmtRP(rpCost(data, missing)))}) :</p><ul>${missing.map((x) => `<li>${esc(nodeName(x))}</li>`).join("")}</ul>`,
        [
          { value: "all", label: "Tout débloquer", primary: true },
          { value: "one", label: "Seulement celle-ci" },
          { value: "", label: "Annuler" },
        ],
      );
      if (!choice) return renderProgress();
      if (choice === "all") add = [...missing, id];
    }
    setProgress({ ...prog, unlocked: [...new Set([...prog.unlocked, ...add])] });
  } else {
    const deps = dependentsOf(data, p, id);
    let remove = [id];
    if (deps.length) {
      const choice = await ask(
        "Recherches qui en dépendent",
        `<p>${deps.length} recherche(s) cochée(s) dépendent de <b>${esc(nodeName(id))}</b> :</p><ul>${deps.map((x) => `<li>${esc(nodeName(x))}</li>`).join("")}</ul>`,
        [
          { value: "all", label: "Tout décocher", primary: true },
          { value: "one", label: "Seulement celle-ci" },
          { value: "", label: "Annuler" },
        ],
      );
      if (!choice) return renderProgress();
      if (choice === "all") remove = [id, ...deps];
    }
    setProgress({ ...prog, unlocked: prog.unlocked.filter((x) => !remove.includes(x)) });
  }
}

function bindProgress(): void {
  $("tree").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.node) void toggleNode(input.dataset.node, input.checked);
    else if (input.dataset.req) {
      const id = input.dataset.req;
      setProgress({ ...prog, reqItemsDone: input.checked ? [...new Set([...prog.reqItemsDone, id])] : prog.reqItemsDone.filter((x) => x !== id) });
    }
  });
  $("owned").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.owned;
    if (id) setProgress({ ...prog, owned: input.checked ? [...new Set([...prog.owned, id])] : prog.owned.filter((x) => x !== id) });
  });
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tabs [data-cat]")) {
    tab.addEventListener("click", () => {
      treeView.category = tab.dataset.cat as TreeView["category"];
      renderProgress();
    });
  }
  $("tree-filter").addEventListener("input", (e) => {
    treeView.filter = (e.target as HTMLInputElement).value;
    renderProgress();
  });
  $("upto-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = ($("upto") as HTMLInputElement).value.trim().toLowerCase();
    const nodes = [...data.nodes.values()].filter((n) => !n.isRoot);
    const node = nodes.find((n) => n.name.toLowerCase() === text) ?? (text ? nodes.filter((n) => n.name.toLowerCase().includes(text)).at(0) : undefined);
    if (!node) {
      $("upto-hint").textContent = "Recherche introuvable : choisis un nom dans la liste.";
      return;
    }
    const before = new Set(prog.unlocked);
    const next = unlockUpTo(data, toEngineProgress(prog), node.id);
    const added = [...next].filter((x) => !before.has(x)).length;
    $("upto-hint").textContent = `${node.name} : ${added} recherche(s) cochée(s).`;
    treeView.category = node.category;
    setProgress({ ...prog, unlocked: [...next] });
  });
  $("progress-reset").addEventListener("click", async () => {
    const choice = await ask("Réinitialiser la progression", "<p>Décocher toutes les recherches et toutes les machines possédées ?</p>", [
      { value: "yes", label: "Réinitialiser", primary: true },
      { value: "", label: "Annuler" },
    ]);
    if (choice === "yes") setProgress({ unlocked: [], reqItemsDone: [], owned: [] });
  });

  const playerFields: [string, keyof PlayerInfo][] = [
    ["p-pollution", "pollutionPct"],
    ["p-money", "money"],
    ["p-rp", "rp"],
    ["p-rps", "rpPerSec"],
  ];
  for (const [id, key] of playerFields) {
    $(id).addEventListener("input", (e) => {
      const v = parseOptional((e.target as HTMLInputElement).value);
      $(id).setAttribute("aria-invalid", String(v === "invalide"));
      $("player-hint").textContent = v === "invalide" ? "Nombre attendu (ou laisse vide)." : "";
      if (v === "invalide") return;
      player = { ...player, [key]: v };
      savePlayer(player);
      renderSoon();
    });
  }

  // Boutons du plan : « Je les ai débloquées », « Je la possède »
  document.querySelector(".wrap")!.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-unlock], button[data-own]");
    if (!btn) return;
    if (btn.dataset.unlock) {
      let next = new Set(prog.unlocked);
      for (const id of btn.dataset.unlock.split(",")) next = unlockUpTo(data, { ...toEngineProgress(prog), unlocked: next }, id);
      setProgress({ ...prog, unlocked: [...next] });
    } else if (btn.dataset.own) {
      setProgress({ ...prog, owned: [...new Set([...prog.owned, ...btn.dataset.own.split(",")])] });
    }
  });
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
prog = sanitizeProgress(data, prog);
fillItemList();
fillNodeList();
syncForm();
syncPlayerForm();
bind();
bindProgress();
render();
// Première visite : on ouvre la progression pour inviter à la remplir.
if (!prog.unlocked.length) ($("progress-panel") as HTMLDetailsElement).open = true;
