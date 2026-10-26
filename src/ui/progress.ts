// Progression du joueur (arbre de recherche, machines possédées) et « Ma partie »
// (pollution, argent, RP, RP/s). Persistance locale + rendu HTML (pur).

import type { GameData } from "../engine/data.ts";
import { balanceAfter, parseResearchSetup, type ResearchSetup, type RpTier } from "../engine/research-balance.ts";
import { parseJournal, type RpJournal } from "../engine/rp-history.ts";
import type { ResearchCategory } from "../engine/types.ts";
import { isNodeUnlocked, nodeDepths, type Progress } from "../engine/unlock.ts";
import { esc, fmt, parseNum } from "./format.ts";
import { withIcons } from "./icons.ts";
import { t } from "../i18n/i18n.ts";

// ---------------------------------------------------------------- état

export type ProgressState = { unlocked: string[]; reqItemsDone: string[]; owned: string[] };
/**
 * « Ma partie ». `rp`, `rpPerSec` : le dernier relevé (1ʳᵉ ligne du panneau) ; `rpAt` : heure réelle de
 * la saisie. Depuis S21, l'estimation vient du journal (`rp-history.ts`), en temps de jeu.
 */
export type PlayerInfo = {
  pollutionPct: number | null;
  money: number | null;
  rp: number | null;
  rpPerSec: number | null;
  rpAt: number | null;
  /** Débloquer une recherche sur le site dépense ses RP (et la retirer les rend). */
  spendRp: boolean;
  /** Le joueur a le passe du jeu (compteurs de débit Item Rate Meter et Fluid Rate Meter). */
  gamePass: boolean;
  /** Taille de sa parcelle, en cases (1 case = 1 Short Pipe) ; null si non renseignée. */
  plotW: number | null;
  plotH: number | null;
  /** « Ma recherche » (S20) : le panneau de suivi recopié, ou les stations ; null si non renseignée. */
  research: ResearchSetup | null;
};

/** Un module (ou une usine) de `w` × `h` cases tient-il sur la parcelle, tel quel ou tourné d'un quart de tour ? */
export function fitsPlot(w: number, h: number, plot: { w: number; h: number }): "oui" | "tourné" | "non" {
  if (w <= plot.w && h <= plot.h) return "oui";
  if (h <= plot.w && w <= plot.h) return "tourné";
  return "non";
}

/** La parcelle, si ses deux côtés sont renseignés. */
export const plotOf = (p: PlayerInfo) => (p.plotW && p.plotH ? { w: p.plotW, h: p.plotH } : null);

/**
 * RP estimés à l'instant `now`, depuis les RP saisis, en temps réel continu (avant S21 ; le site
 * compte désormais en temps de jeu avec le journal, `rpHistory`). Avec `tiers` (S20, « Ma recherche ») : la
 * vitesse baisse au-delà du seuil de chaque tier (plafond souple). Sans : RP/s × temps, en ligne droite.
 */
export function currentRp(p: PlayerInfo, now = Date.now(), tiers?: readonly RpTier[] | null): number | null {
  if (p.rp === null) return null;
  if (p.rpAt === null) return p.rp;
  const dt = Math.max(0, now - p.rpAt) / 1000;
  if (tiers?.length) return balanceAfter(tiers, p.rp, dt);
  if (!p.rpPerSec) return p.rp;
  return p.rp + p.rpPerSec * dt;
}

/** RP dépensés (> 0) ou rendus (< 0) en passant de `before` à `after` (racines et acquises d'office : gratuites). */
export function rpDelta(data: GameData, before: readonly string[], after: readonly string[]): { spent: number; added: string[]; removed: string[] } {
  const b = new Set(before);
  const a = new Set(after);
  const paid = (id: string) => {
    const n = data.nodes.get(id);
    return n && !n.isRoot && !n.startUnlocked ? n.rp : 0;
  };
  const added = [...a].filter((x) => !b.has(x) && paid(x) > 0);
  const removed = [...b].filter((x) => !a.has(x) && paid(x) > 0);
  return { spent: added.reduce((s, x) => s + paid(x), 0) - removed.reduce((s, x) => s + paid(x), 0), added, removed };
}

/** Change la vitesse sans perdre les RP déjà accumulés (on repart de l'estimation actuelle). */
export function withRpRate(p: PlayerInfo, rpPerSec: number | null, now = Date.now(), tiers?: readonly RpTier[] | null): PlayerInfo {
  const rp = currentRp(p, now, tiers);
  return { ...p, rp, rpPerSec, rpAt: rp === null ? null : now };
}

const KEY_PROGRESS = "ind-calc:v1:progress";
const KEY_PLAYER = "ind-calc:v1:player";

export const EMPTY_PROGRESS: ProgressState = { unlocked: [], reqItemsDone: [], owned: [] };
export const EMPTY_PLAYER: PlayerInfo = { pollutionPct: null, money: null, rp: null, rpPerSec: null, rpAt: null, spendRp: false, gamePass: false, plotW: null, plotH: null, research: null };

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);
const numOrNull = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function loadProgress(): ProgressState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_PROGRESS) ?? "null");
    if (!raw || typeof raw !== "object") return { ...EMPTY_PROGRESS };
    return { unlocked: strings(raw.unlocked), reqItemsDone: strings(raw.reqItemsDone), owned: strings(raw.owned) };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}
export function saveProgress(p: ProgressState): void {
  try {
    localStorage.setItem(KEY_PROGRESS, JSON.stringify(p));
  } catch {
    // stockage indisponible : la progression vaut pour la session seulement
  }
}
export function loadPlayer(): PlayerInfo {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_PLAYER) ?? "null");
    if (!raw || typeof raw !== "object") return { ...EMPTY_PLAYER };
    return { pollutionPct: numOrNull(raw.pollutionPct), money: numOrNull(raw.money), rp: numOrNull(raw.rp), rpPerSec: numOrNull(raw.rpPerSec), rpAt: numOrNull(raw.rpAt), spendRp: raw.spendRp === true, gamePass: raw.gamePass === true, plotW: numOrNull(raw.plotW), plotH: numOrNull(raw.plotH), research: parseResearchSetup(raw.research) };
  } catch {
    return { ...EMPTY_PLAYER };
  }
}
export function savePlayer(p: PlayerInfo): void {
  try {
    localStorage.setItem(KEY_PLAYER, JSON.stringify(p));
  } catch {
    // idem
  }
}

/** Journal des RP (S21), sous sa propre clé ; null s'il n'existe pas encore (premier passage après S21). */
const KEY_JOURNAL = "ind-calc:v1:rp-journal";
export function loadJournal(): RpJournal | null {
  try {
    return parseJournal(JSON.parse(localStorage.getItem(KEY_JOURNAL) ?? "null"));
  } catch {
    return null;
  }
}
export function saveJournal(j: RpJournal): void {
  try {
    localStorage.setItem(KEY_JOURNAL, JSON.stringify(j));
  } catch {
    // idem
  }
}

/** Ne garde que les ids qui existent encore dans les données (après une mise à jour du wiki). */
export function sanitizeProgress(data: GameData, p: ProgressState): ProgressState {
  return {
    unlocked: p.unlocked.filter((id) => data.nodes.has(id)),
    reqItemsDone: p.reqItemsDone.filter((id) => data.nodes.has(id)),
    owned: p.owned.filter((id) => data.machines.has(id)),
  };
}

export function toEngineProgress(p: ProgressState): Progress {
  return { unlocked: new Set(p.unlocked), reqItemsDone: new Set(p.reqItemsDone), owned: new Set(p.owned) };
}

// ---------------------------------------------------------------- export / import

/** Fichier d'export : progression + « Ma partie », pour passer d'une adresse (ou d'un appareil) à l'autre. */
export const PROGRESS_FORMAT = "industrialist-progression";
/** `history` (S21, facultatif) : le journal des RP ; un fichier plus ancien s'importe sans lui. */
export type ProgressExport = { format: typeof PROGRESS_FORMAT; version: 1; exportedAt: string; progress: ProgressState; player: PlayerInfo; history?: RpJournal };

export function exportProgress(progress: ProgressState, player: PlayerInfo, now = new Date(), history: RpJournal | null = null): ProgressExport {
  return { format: PROGRESS_FORMAT, version: 1, exportedAt: now.toISOString(), progress, player, ...(history ? { history } : {}) };
}

/**
 * Lit un fichier exporté. Les ids inconnus des données actuelles sont écartés et comptés
 * (une mise à jour du wiki a pu renommer une recherche).
 */
export function parseProgressExport(
  data: GameData,
  raw: unknown,
): { ok: true; progress: ProgressState; player: PlayerInfo; history: RpJournal | null; dropped: number; exportedAt: string | null } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: t("prog.notFile") };
  const r = raw as Record<string, unknown>;
  if (r.format !== PROGRESS_FORMAT) return { ok: false, error: t("prog.unknownFormat") };
  if (r.version !== 1) return { ok: false, error: t("prog.badVersion", { v: String(r.version) }) };
  const p = (r.progress ?? {}) as Record<string, unknown>;
  const pl = (r.player ?? {}) as Record<string, unknown>;
  const read: ProgressState = { unlocked: strings(p.unlocked), reqItemsDone: strings(p.reqItemsDone), owned: strings(p.owned) };
  const clean = sanitizeProgress(data, read);
  const dropped = read.unlocked.length + read.reqItemsDone.length + read.owned.length - (clean.unlocked.length + clean.reqItemsDone.length + clean.owned.length);
  return {
    ok: true,
    progress: { unlocked: [...new Set(clean.unlocked)], reqItemsDone: [...new Set(clean.reqItemsDone)], owned: [...new Set(clean.owned)] },
    player: { pollutionPct: numOrNull(pl.pollutionPct), money: numOrNull(pl.money), rp: numOrNull(pl.rp), rpPerSec: numOrNull(pl.rpPerSec), rpAt: numOrNull(pl.rpAt), spendRp: pl.spendRp === true, gamePass: pl.gamePass === true, plotW: numOrNull(pl.plotW), plotH: numOrNull(pl.plotH), research: parseResearchSetup(pl.research) },
    history: parseJournal(r.history),
    dropped,
    exportedAt: typeof r.exportedAt === "string" ? r.exportedAt : null,
  };
}

/** Saisie facultative : vide → null ; nombre selon la langue (parseNum). */
export function parseOptional(raw: string): number | null | "invalide" {
  if (!raw.trim()) return null;
  const n = parseNum(raw);
  return Number.isFinite(n) ? n : "invalide";
}

// ---------------------------------------------------------------- rendu

export type TreeView = { category: ResearchCategory; filter: string };

export function progressSummary(data: GameData, p: Progress): string {
  const nodes = [...data.nodes.values()].filter((n) => !n.isRoot);
  const done = nodes.filter((n) => p.unlocked.has(n.id) || n.startUnlocked);
  const rp = done.reduce((s, n) => s + n.rp, 0);
  return t("prog.summary", { done: done.length, total: nodes.length, rp: fmt(rp, 0) });
}

export function renderTree(data: GameData, p: Progress, view: TreeView): string {
  const depth = nodeDepths(data);
  const q = view.filter.trim().toLowerCase();
  const machineName = (id: string) => data.machines.get(id)?.name ?? id;
  const itemName = (id: string) => data.items.get(id)?.name ?? id;
  const nodeName = (id: string) => data.nodes.get(id)?.name ?? id;
  const nodes = [...data.nodes.values()]
    .filter((n) => n.category === view.category && !n.isRoot)
    .filter((n) => !q || n.name.toLowerCase().includes(q) || n.unlocksMachines.some((m) => machineName(m).toLowerCase().includes(q)))
    .sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || a.name.localeCompare(b.name));
  if (!nodes.length) return `<p class="muted">${t("prog.noMatch")}</p>`;

  const levels = new Map<number, string[]>();
  for (const n of nodes) {
    const unlocked = p.unlocked.has(n.id);
    const parentsOk = n.requires === "any" ? n.parents.some((x) => isNodeUnlocked(data, p, x)) : n.parents.every((x) => isNodeUnlocked(data, p, x));
    const missingParents = n.parents.filter((x) => !isNodeUnlocked(data, p, x));
    const state = unlocked ? (parentsOk ? "done" : "incoherent") : parentsOk ? "available" : "locked";
    const stateLabel = t(`prog.state.${state}`);
    const machines = n.unlocksMachines.map(machineName);
    const parentsText = n.parents.length
      ? t(n.requires === "any" && n.parents.length > 1 ? "prog.requires.any" : "prog.requires", {
          list: n.parents.map((x) => `<span class="${missingParents.includes(x) ? "miss" : ""}">${esc(nodeName(x))}</span>`).join(n.requires === "any" ? ` ${t("common.or")} ` : " + "),
        })
      : "";
    const req = n.reqItems.length
      ? `<label class="req"><input type="checkbox" data-req="${esc(n.id)}"${p.reqItemsDone?.has(n.id) ? " checked" : ""}> ${t("prog.sell", { list: n.reqItems.map((r) => `${r.amount} ${esc(itemName(r.item))}`).join(" + ") })}</label>`
      : "";
    const row = `<li class="node ${state}">
      <label class="node-main"><input type="checkbox" data-node="${esc(n.id)}"${unlocked ? " checked" : ""} aria-describedby="nd-${esc(n.id)}">
        <span class="node-name">${esc(n.name)}</span><span class="node-rp num">${fmt(n.rp, 0)} RP</span></label>
      <div class="node-meta" id="nd-${esc(n.id)}"><span class="sr-only">${stateLabel}. </span>${n.description ? `<span class="node-desc">${esc(n.description.length > 140 ? `${n.description.slice(0, 139)}…` : n.description)}</span>` : ""}${machines.length ? `<span>${esc(t("prog.unlocks", { list: machines.join(", ") }))}</span>` : ""}${
        n.unlocksOther.length ? `<span class="muted">${esc(n.unlocksOther.join(", "))}</span>` : ""
      }${parentsText ? `<span>${parentsText}</span>` : ""}${state === "incoherent" ? `<span class="warn-text">${withIcons(t("prog.unticked"))}</span>` : ""}</div>
      ${req}</li>`;
    const d = depth.get(n.id)!;
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d)!.push(row);
  }
  return [...levels]
    .map(([d, rows]) => `<div class="level"><h4 class="eyebrow">${t("prog.tier", { n: d })}</h4><ul class="nodes">${rows.join("")}</ul></div>`)
    .join("");
}

/** Machines qu'aucun nœud ne débloque (Limited, variantes) : à cocher si on les possède. */
/** Machines hors arbre (Limited, variantes) à cocher ; repliées derrière leur compte (S29), `open` : dépliées. */
export function renderOwned(data: GameData, p: Progress, open = false): string {
  const list = [...data.machines.values()].filter((m) => m.unlockedBy === null).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return "";
  const n = list.filter((m) => p.owned?.has(m.id)).length;
  return `<details class="more owned-d"${open ? " open" : ""}><summary>${t("prog.owned", { n, total: list.length })}</summary><ul class="owned">${list
    .map(
      (m) => `<li><label><input type="checkbox" data-owned="${esc(m.id)}"${p.owned?.has(m.id) ? " checked" : ""}> ${esc(m.name)}${
        m.variantOf ? ` <span class="muted">${esc(t("prog.variant", { m: data.machines.get(m.variantOf)?.name ?? m.variantOf }))}</span>` : ""
      }${m.limited ? ` <span class="muted">· Limited</span>` : ""}</label></li>`,
    )
    .join("")}</ul></details>`;
}
