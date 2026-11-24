// Partage d'un design par lien (PLAN-PARTAGE.md, lot P2) : la partie pure, sans DOM. Assemble le design à
// partager depuis l'état du site (relu, jamais modifié), lit l'adresse (#d=1.…, anciens #bac/<code>)
// et dit si le lien passe sur Discord (question B, § 5 bis).

import type { Design, DesignGraph, DesignProfile, DesignSettings, PrintVerdict, ShareErrorCode } from "../engine/share/index.ts";
import { canonNodes } from "../engine/share/codec.ts";
import type { PlayerInfo, ProgressState } from "./progress.ts";
import type { Layout } from "../engine/sandbox/layout.ts";

/** Au-delà, le lien ne tient plus dans un message Discord (2 000 caractères, avec un peu de marge pour le texte). */
export const DISCORD_MAX = 1900;

/**
 * Le design à partager : réglages courants, graphe édité (seulement s'il a été retouché : sinon il se recalcule
 * à l'identique depuis les réglages) et bac à sable s'il est demandé et non vide. Tout est copié : l'état du
 * site n'est jamais touché, ni maintenant ni plus tard (le lien s'encode après coup).
 */
export function assembleDesign(o: {
  site: string;
  name?: string;
  settings: object;
  graph: DesignGraph | null;
  sandbox: Layout | null;
  withSandbox: boolean;
  profile?: DesignProfile | null;
}): Design {
  const d: Design = { site: o.site, settings: structuredClone(o.settings) as DesignSettings };
  if (o.name) d.name = o.name;
  if (o.graph?.touched) d.graph = structuredClone(o.graph);
  if (o.withSandbox && o.sandbox && o.sandbox.blocks.length) d.sandbox = structuredClone(o.sandbox);
  if (o.profile) d.profile = structuredClone(o.profile);
  return d;
}

/**
 * Profil de l'auteur à mettre dans le lien (P3 bis, § 6 ter), copié. `month` : le mois de sa partie, résolu (sinon
 * « mois du jour » changerait chez le lecteur) ; `rp` : ses RP estimés à l'instant, sans l'heure du relevé (pas de
 * journal dans le lien : ils ne bougent plus). Corrections et relevés : seulement s'il y en a.
 */
export function assembleProfile(o: { progress: ProgressState; player: PlayerInfo; month: number; rp: number | null; corrections: object; surveys: object; interfaces: object; diesel: readonly unknown[] }, with_: { base: boolean; contrib: boolean } = { base: true, contrib: true }): DesignProfile {
  const full = (x: object) => Object.values(x).some((v) => v && (typeof v !== "object" || Object.keys(v).length));
  const p: DesignProfile = with_.base ? {
    progress: { unlocked: canonNodes(o.progress.unlocked), reqItemsDone: canonNodes(o.progress.reqItemsDone), owned: [...new Set(o.progress.owned)].sort() },
    player: { ...structuredClone(o.player), month: o.month, rp: o.rp, rpAt: null, spendRp: false },
  } : {};
  if (!with_.contrib) {
    if ([o.corrections, o.surveys, o.interfaces].some(full) || o.diesel.length) p.partial = true;
    return p;
  }
  if (full(o.corrections)) p.corrections = structuredClone(o.corrections);
  if (full(o.surveys)) p.surveys = structuredClone(o.surveys);
  if (full(o.interfaces)) p.interfaces = structuredClone(o.interfaces);
  if (o.diesel.length) p.diesel = structuredClone(o.diesel);
  return p;
}

/** Le bac à sable a-t-il quelque chose à partager ? */
export const hasSandbox = (l: Layout | null): boolean => !!l && l.blocks.length > 0;

/** Ce que porte l'adresse : un design (`#d=…`), un ancien montage du bac à sable (`#bac/<code>`), ou rien. */
export type ShareHash = { kind: "design"; data: string } | { kind: "ancien"; code: string } | null;

export function readShareHash(hash: string): ShareHash {
  const h = hash.replace(/^#/, "");
  if (h.startsWith("d=")) return { kind: "design", data: h.slice(2) };
  const m = /^bac\/(.+)$/s.exec(h);
  if (!m) return null;
  let code = m[1]!;
  try {
    code = decodeURIComponent(code);
  } catch {
    // code mal échappé : lu tel quel (il sera refusé s'il est abîmé)
  }
  return code.trim() ? { kind: "ancien", code } : null;
}

/**
 * Conseil sur la longueur (question B) : `fits` le lien passe sur Discord ; `sandboxOnly` il ne passe pas, mais
 * passerait sans le bac à sable (`without` caractères) : on propose le lien sans lui.
 */
export function linkAdvice(len: number, without: number | null): { fits: boolean; sandboxOnly: boolean } {
  const fits = len <= DISCORD_MAX;
  return { fits, sandboxOnly: !fits && without !== null && without <= DISCORD_MAX };
}

/** Le lien est trop long : ce qu'on peut laisser dehors, dans l'ordre, pour qu'il passe (null : rien ne suffit). */
export type Drop = { sandbox: boolean; contrib: boolean };
export function dropAdvice(len: number, options: readonly { drop: Drop; len: number }[]): { drop: Drop; len: number } | null {
  return len <= DISCORD_MAX ? null : (options.find((o) => o.len <= DISCORD_MAX) ?? null);
}

/** Clé du catalogue pour une erreur de lien. */
export const shareErrorKey = (code: ShareErrorCode | null): `share.err.${ShareErrorCode}` => `share.err.${code ?? "abîmé"}`;

/** Version `a` plus ancienne que `b` (« 0.1.0 » < « 0.2.0 ») ; faux si l'une n'est pas une version. */
export function olderSite(a: string, b: string): boolean {
  const p = (s: string) => (/^\d+\.\d+\.\d+$/.test(s) ? s.split(".").map(Number) : null);
  const x = p(a), y = p(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! < y[i]!;
  return false;
}

export type CheckKey = "share.r.older" | "share.r.other" | "share.r.diff.plan" | "share.r.diff.pose" | "share.r.same" | "share.r.same.other" | "share.r.part" | "share.r.noprint" | "share.r.checking" | "share.r.unchecked";
/** Verdict de la vérification ; null : en cours ; « impossible » : l'usine n'a pas pu être recalculée. */
export type CheckState = PrintVerdict | "impossible" | null;
/**
 * Ce que dit la fenêtre « Design partagé » (P3) : les lignes d'alerte (`warn`) et l'information neutre (`info`).
 * Alerte seulement si l'empreinte diffère vraiment, ou si la version du site diffère sans qu'on ait pu vérifier que
 * rien ne change ; `advice` (le fichier indestructible) seulement si l'empreinte diffère vraiment.
 */
export function checkNotes(d: Pick<Design, "site" | "print">, site: string, verdict: CheckState): { warn: CheckKey[]; info: CheckKey | null; advice: boolean } {
  const other = d.site !== site;
  const version: CheckKey[] = other ? [olderSite(d.site, site) ? "share.r.older" : "share.r.other"] : [];
  if (!d.print || verdict === "sans") return { warn: version, info: "share.r.noprint", advice: false };
  if (verdict === null) return { warn: version, info: "share.r.checking", advice: false };
  if (verdict === "impossible") return { warn: version, info: "share.r.unchecked", advice: false };
  if (verdict === "identique") return { warn: [], info: other ? "share.r.same.other" : "share.r.same", advice: false };
  if (verdict === "partiel") return { warn: version, info: "share.r.part", advice: false };
  return { warn: [...version, verdict === "plan" ? "share.r.diff.plan" : "share.r.diff.pose"], info: null, advice: true };
}

/** Résumé d'un design reçu : nœuds du graphe, et blocs du bac à sable. */
export function designFacts(d: Design): { nodes: number | null; blocks: number | null } {
  return { nodes: d.graph ? d.graph.graph.nodes.length : null, blocks: d.sandbox ? d.sandbox.blocks.length : null };
}

/** Positions des nœuds du graphe ramenées dans un cadre `w` × `h` (aperçu miniature), marge comprise. */
export function miniLayout(d: Design, w: number, h: number, pad = 12): { x: number; y: number }[] {
  const ns = d.graph?.graph.nodes ?? [];
  if (!ns.length) return [];
  const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = x1 > x0 ? (w - 2 * pad) / (x1 - x0) : 0, sy = y1 > y0 ? (h - 2 * pad) / (y1 - y0) : 0;
  return ns.map((n) => ({ x: sx ? pad + (n.x - x0) * sx : w / 2, y: sy ? pad + (n.y - y0) * sy : h / 2 }));
}
