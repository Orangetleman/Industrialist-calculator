// Empreinte d'un design (PLAN-PARTAGE.md, lot P3) : 8 octets, en 16 chiffres hexadécimaux. Pur, sans DOM.
//   4 octets « plan » : étapes (recette, machine, nombre) et liaisons. Toujours connus.
//   4 octets « pose » : l'usine (blocs, positions, rotations, tuyaux, poteaux, câbles). 00000000 : pas connus
//   (usine pas calculée, ou calcul abrégé par sa limite de temps : le résultat dépend alors de l'ordinateur).
// Rien d'affiché n'y entre (noms, textes, langue) ; l'ordre interne des listes non plus : tout est trié.

import type { FactoryPlan } from "../build/factory.ts";
import type { ModulePlan } from "../build/module.ts";
import type { Plan } from "../solve.ts";

const NO_POSE = "00000000";
export const PRINT = /^[0-9a-f]{16}$/;

/** FNV-1a 32 bits sur les unités UTF-16 (deux octets chacune), jamais 0 (réservé à « pas connu »). */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = Math.imul(h ^ (c & 0xff), 0x01000193);
    h = Math.imul(h ^ (c >> 8), 0x01000193);
  }
  return ((h >>> 0) || 1).toString(16).padStart(8, "0");
}

/** Tri des lignes par unités UTF-16 (pas `localeCompare`, qui dépend de la langue). */
const canon = (rows: unknown[][]) => rows.map((r) => JSON.stringify(r)).sort();
const dirs = (d: Iterable<string>) => [...d].sort().join("");

type PlanLike = { steps: Pick<Plan["steps"][number], "key" | "recipeId" | "machine" | "machines">[]; edges: Pick<Plan["edges"][number], "from" | "to" | "item">[] };

const planText = (p: PlanLike) => JSON.stringify([canon(p.steps.map((s) => [s.key, s.recipeId, s.machine, s.machines])), canon(p.edges.map((e) => [e.from, e.to, e.item]))]);

const moduleText = (m: ModulePlan) => [
  m.width,
  m.height,
  canon(m.machines.map((q) => [q.machine, q.x, q.y, q.rot])),
  canon(m.pieces.map((q) => [q.x, q.y, q.pieceId, q.net, dirs(q.links), q.crossNet ?? "", dirs(q.crossLinks ?? [])])),
  canon(m.poles.map((q) => [q.pole, q.x, q.y])),
];

type PoseLike = Pick<FactoryPlan, "W" | "H" | "boxes" | "cells" | "nets" | "evacs" | "glued" | "touches" | "poleNodes" | "links" | "feed">;

function poseText(f: PoseLike): string {
  const cells: unknown[][] = [];
  for (const [k, o] of f.cells) if (o.kind === "tuyau") cells.push([k, o.net, dirs(o.links), o.cross?.net ?? "", dirs(o.cross?.links ?? [])]);
  const at = (p: { x: number; y: number }) => [p.x, p.y];
  return JSON.stringify([
    f.W,
    f.H,
    canon(f.boxes.map((b) => [b.key, b.machine, b.x, b.y, b.w, b.h, b.rot, b.mod ? moduleText(b.mod) : 0])),
    canon(cells),
    canon(f.nets.map((n) => [n.id, n.item, n.from, [...n.to].sort()])),
    canon(f.evacs.map((e) => [e.id, e.item, e.side, e.at.x, e.at.y, e.ok])),
    [...f.glued].sort(),
    canon(f.touches.map((t) => [t.from, t.to, t.item, t.x, t.y, t.dir])),
    at(f.feed),
    canon(f.poleNodes.map((p) => [p.type.id, ...at(p), canon(p.plugs.map((q) => [q.key, ...at(q)]))])),
    canon(f.links.map((l) => [...at(l.from), ...at(l.to), l.relays, l.relayType.id, l.lines])),
  ]);
}

/** Empreinte d'un plan et, si elle est connue et complète, de son usine. */
export function designPrint(plan: PlanLike, factory: (PoseLike & { cut?: true }) | null = null): string {
  return fnv(planText(plan)) + (factory && !factory.cut ? fnv(poseText(factory)) : NO_POSE);
}

/** L'empreinte comprend-elle la pose ? */
export const hasPose = (print: string) => print.slice(8) !== NO_POSE;

/**
 * Comparaison à l'ouverture. « identique » : plan et pose ; « plan » : les machines diffèrent ; « pose » : mêmes
 * machines, posées autrement ; « partiel » : mêmes machines, pose pas comparable ; « sans » : pas d'empreinte.
 */
export type PrintVerdict = "sans" | "identique" | "partiel" | "plan" | "pose";
export function comparePrints(author: string | undefined, here: string | undefined): PrintVerdict {
  if (!author || !here) return "sans";
  if (author.slice(0, 8) !== here.slice(0, 8)) return "plan";
  if (!hasPose(author) || !hasPose(here)) return "partiel";
  return author === here ? "identique" : "pose";
}
