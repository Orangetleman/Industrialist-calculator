// Éditeur de bâtiments : modèle pur (sans DOM). Un relevé = empreinte en cases + ports.
// Grille affichée : l'empreinte entourée d'une marge d'une case, où se posent les plots des ports.

import type { InterfaceKind, InterfaceSetting, MachineInterface, Port, PortsEntry, PortsFile } from "../engine/extension-types.ts";
import { EDGES, type Edge, FACES, type FaceKey, type ModularEdit, type ModularEdits } from "../engine/modular.ts";
import type { Source } from "../engine/types.ts";

export const CELL = 30; // pixels par case dans le SVG (la vue est ensuite mise à l'échelle)

export type Tool = "objet" | "fluide" | "énergie" | "logique" | "gomme";

/** Placement de la capture en fond : coin haut-gauche en cases, unités SVG par pixel de l'image. */
export type BgPlacement = { x: number; y: number; scale: number };

/** Case de la marge cliquée → bord et numéro de case ; null si c'est un coin ou hors marge. */
export function marginToPort(w: number, h: number, gx: number, gy: number): { side: Port["side"]; cell: number } | null {
  if (gy === 0 && gx >= 1 && gx <= w) return { side: "haut", cell: gx };
  if (gy === h + 1 && gx >= 1 && gx <= w) return { side: "bas", cell: gx };
  if (gx === 0 && gy >= 1 && gy <= h) return { side: "gauche", cell: gy };
  if (gx === w + 1 && gy >= 1 && gy <= h) return { side: "droite", cell: gy };
  return null;
}

/** Position d'un clic dans le corps → [colonne, ligne] arrondies à la demi-case (1 = première case). */
export function bodyPoint(w: number, h: number, px: number, py: number): [number, number] | null {
  const x = px / CELL - 1 + 0.5; // centre de la première case = 1
  const y = py / CELL - 1 + 0.5;
  if (x < 0.5 || y < 0.5 || x > w + 0.5 || y > h + 0.5) return null;
  const snap = (v: number, max: number) => Math.min(max, Math.max(1, Math.round(v * 2) / 2));
  return [snap(x, w), snap(y, h)];
}

/** Centre d'un port (en pixels du SVG), pour le dessin. */
export function portCenter(w: number, h: number, p: Port): [number, number] {
  if (p.side === "dessus") {
    const [cx, cy] = p.cell as [number, number];
    return [(cx + 0.5) * CELL, (cy + 0.5) * CELL];
  }
  const c = p.cell as number;
  switch (p.side) {
    case "haut":
      return [(c + 0.5) * CELL, 0.5 * CELL];
    case "bas":
      return [(c + 0.5) * CELL, (h + 1.5) * CELL];
    case "gauche":
      return [0.5 * CELL, (c + 0.5) * CELL];
    default:
      return [(w + 1.5) * CELL, (c + 0.5) * CELL];
  }
}

const samePlace = (a: Port, b: Pick<Port, "side" | "cell">) => a.side === b.side && JSON.stringify(a.cell) === JSON.stringify(b.cell);

/** Pose, remplace ou retire un port à un emplacement, selon l'outil. Renvoie la nouvelle liste. */
export function applyTool(ports: Port[], tool: Tool, place: Pick<Port, "side" | "cell">, direction: Port["direction"]): Port[] {
  const others = ports.filter((p) => !samePlace(p, place));
  if (tool === "gomme") return others;
  const type: Port["type"] = tool;
  const previous = ports.find((p) => samePlace(p, place));
  const next: Port = {
    ...(previous && previous.type === type ? previous : {}),
    type,
    direction,
    side: place.side,
    cell: place.cell,
  };
  return [...others, next];
}

/** Contrôles du relevé : renvoie la liste des problèmes (vide = relevé complet). */
export function checkEntry(e: PortsEntry): string[] {
  const out: string[] = [];
  if (!e.footprint || !(e.footprint.w > 0) || !(e.footprint.h > 0)) out.push("empreinte manquante");
  const flowPorts = e.ports.filter((p) => p.type !== "énergie").length;
  if (!e.ports.length && !e.noPorts) out.push("aucun port : pose-les, ou coche « Sans port » si le bâtiment n'en a pas");
  if (flowPorts && e.noPorts) out.push("« Sans port » est coché alors qu'un port est posé");
  const hasPower = e.ports.some((p) => p.type === "énergie");
  if (!hasPower && !e.noPower) out.push("pas de prise électrique : pose-la, ou coche « Sans prise électrique » si le bâtiment n'en a pas");
  if (hasPower && e.noPower) out.push("« Sans prise électrique » est coché alors qu'une prise est posée");
  const w = e.footprint?.w ?? 0;
  const h = e.footprint?.h ?? 0;
  for (const p of e.ports) {
    if (p.side === "dessus") {
      const [x, y] = p.cell as [number, number];
      if (x < 1 || y < 1 || x > w || y > h) out.push(`prise hors de l'empreinte (${x}, ${y})`);
    } else {
      const len = p.side === "haut" || p.side === "bas" ? w : h;
      if ((p.cell as number) < 1 || (p.cell as number) > len) out.push(`port ${p.side} ${p.cell} hors du bord`);
    }
  }
  return out;
}

export const isComplete = (e: PortsEntry) => checkEntry(e).length === 0;

/**
 * Fichier d'export (même format que data/ports.json) ; les interfaces notées (S10) vont à
 * data/interfaces.json, les corrections des blocs modulaires (S12) à data/modular.json.
 */
export function exportSurveys(local: Record<string, PortsEntry>, interfaces: Record<string, MachineInterface> = {}, modular: ModularEdits = {}): PortsFile {
  return {
    _lisezMoi: "Relevés de bâtiments faits dans l'éditeur du calculateur. « machines » : à intégrer à data/ports.json (même format) ; « interfaces » : à data/interfaces.json ; « modular » : à data/modular.json.",
    machines: local,
    ...(Object.keys(interfaces).length ? { interfaces } : {}),
    ...(Object.keys(modular).length ? { modular } : {}),
  };
}

// ---------------------------------------------------------------- blocs modulaires (S12)

/** Lecture prudente des corrections de blocs modulaires d'un fichier (clé « modular »). */
export function parseModular(raw: unknown): ModularEdits | null {
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (!obj(raw) || !obj(raw.modular)) return null;
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : null);
  const out: ModularEdits = {};
  for (const [id, e] of Object.entries(raw.modular)) {
    if (!obj(e) || !obj(e.source) || typeof e.source.fetchedAt !== "string" || typeof e.source.wiki !== "string") continue;
    const edit: ModularEdit = { source: e.source as unknown as Source };
    if (obj(e.faces)) {
      const faces: Partial<Record<FaceKey, string[]>> = {};
      for (const f of FACES) {
        const list = strings(e.faces[f]);
        if (list) faces[f] = list;
      }
      edit.faces = faces;
    }
    if (obj(e.facesRequired)) {
      const req: Partial<Record<FaceKey, boolean>> = {};
      for (const f of FACES) if (typeof e.facesRequired[f] === "boolean") req[f] = e.facesRequired[f] as boolean;
      edit.facesRequired = req;
    }
    if ((typeof e.rangeTiles === "number" && e.rangeTiles > 0) || e.rangeTiles === "infinie") edit.rangeTiles = e.rangeTiles;
    const serves = strings(e.serves);
    if (serves) edit.serves = serves;
    if (EDGES.includes(e.frontEdge as Edge)) edit.frontEdge = e.frontEdge as Edge;
    if (typeof e.note === "string" && e.note) edit.note = e.note;
    out[id] = edit;
  }
  return out;
}

// ---------------------------------------------------------------- interfaces (S10)

export const INTERFACE_KINDS: InterfaceKind[] = ["fenêtre", "levier", "choix direct", "bouton"];
export const KIND_LABEL: Record<InterfaceKind, string> = { fenêtre: "fenêtre de réglages", levier: "levier", "choix direct": "choix direct sur la machine", bouton: "bouton" };
const SCALES = ["entrées", "sorties", "énergie"] as const;

/** Identifiant d'un nouveau réglage, unique dans l'interface. */
export function newSettingId(i: MachineInterface): string {
  let n = i.settings.length + 1;
  while (i.settings.some((s) => s.id === `reglage-${n}`)) n++;
  return `reglage-${n}`;
}

/** Lecture prudente des interfaces d'un fichier (export de l'éditeur ou data/interfaces.json). */
export function parseInterfaces(raw: unknown): Record<string, MachineInterface> | null {
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (!obj(raw)) return null;
  const m = raw.interfaces ?? (raw as { machines?: unknown }).machines;
  if (!obj(m)) return null;
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  const out: Record<string, MachineInterface> = {};
  for (const [id, e] of Object.entries(m)) {
    if (!obj(e) || !INTERFACE_KINDS.includes(e.kind as InterfaceKind) || !Array.isArray(e.settings) || !Array.isArray(e.sources)) continue;
    const sources = e.sources.filter((x): x is MachineInterface["sources"][number] => obj(x) && typeof x.wiki === "string" && typeof x.fetchedAt === "string");
    if (!sources.length) continue;
    const settings: InterfaceSetting[] = e.settings.filter(obj).map((x, k) => {
      const s: InterfaceSetting = { id: str(x.id) || `reglage-${k + 1}`, name: str(x.name) };
      if (Array.isArray(x.choices)) s.choices = x.choices.filter(obj).map((c) => ({ label: str(c.label), recipes: Array.isArray(c.recipes) ? c.recipes.filter((r): r is string => typeof r === "string") : [], ...(str(c.doubt) ? { doubt: str(c.doubt) } : {}) }));
      if (obj(x.number) && typeof x.number.default === "number" && x.number.default > 0) s.number = { default: x.number.default, scales: SCALES.includes(x.number.scales as (typeof SCALES)[number]) ? (x.number.scales as (typeof SCALES)[number]) : null };
      if (str(x.note)) s.note = str(x.note);
      return s;
    });
    out[id] = {
      kind: e.kind as InterfaceKind,
      ...(str(e.where) ? { where: str(e.where) } : {}),
      ...(e.once === true ? { once: true } : {}),
      settings,
      ...(str(e.effect) ? { effect: str(e.effect) } : {}),
      ...(str(e.notes) ? { notes: str(e.notes) } : {}),
      sources,
    };
  }
  return out;
}

export function surveySource(note = "relevé dans l'éditeur de bâtiments du calculateur"): Source {
  return { wiki: "saisie", fetchedAt: new Date().toISOString(), note };
}

/**
 * Lecture prudente d'un fichier importé. Les anciens champs sont ignorés : « rotations » par
 * bâtiment, et le plot (`stub`) des ports, supprimé le 2026-10-16 (aucun port ne dépasse).
 */
export function parseSurveys(raw: unknown): Record<string, PortsEntry> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = (raw as { machines?: unknown }).machines;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const out: Record<string, PortsEntry> = {};
  for (const [id, e] of Object.entries(m as Record<string, PortsEntry & { rotations?: unknown }>)) {
    if (!e || !Array.isArray(e.ports) || !e.source?.fetchedAt) continue;
    const { rotations: _old, noPower, noPorts, ports, ...rest } = e;
    const clean = ports.map((p) => {
      const { stub: _stub, ...port } = p as Port & { stub?: unknown };
      return port;
    });
    out[id] = { ...rest, ports: clean, ...(noPower === true ? { noPower: true } : {}), ...(noPorts === true ? { noPorts: true } : {}) };
  }
  return out;
}

/**
 * Relevés locaux déjà intégrés aux données (même date de relevé) : la copie locale n'a plus
 * lieu d'être, sinon elle masquerait la version intégrée (éventuellement corrigée).
 */
export function pruneIntegrated(local: Record<string, PortsEntry>, repo: PortsFile): { kept: Record<string, PortsEntry>; dropped: string[] } {
  const kept: Record<string, PortsEntry> = {};
  const dropped: string[] = [];
  for (const [id, e] of Object.entries(local)) {
    if (repo.machines[id]?.source.fetchedAt === e.source.fetchedAt) dropped.push(id);
    else kept[id] = e;
  }
  return { kept, dropped };
}

/**
 * Où en est le relevé d'un bâtiment :
 * - « depot » : intégré aux données du site (data/ports.json), il sert à tout le monde ;
 * - « local » : relevé dans ce navigateur, déjà utilisé par les plans de pose, à envoyer ;
 * - « manquant » : aucun relevé, les plans de pose supposent ses ports.
 */
export type SurveyState = "depot" | "local" | "manquant";

export function surveyState(id: string, repo: PortsFile, local: Record<string, PortsEntry>): SurveyState {
  return local[id] ? "local" : repo.machines[id] ? "depot" : "manquant";
}

/** Relevés utilisés par les plans de pose : ceux du dépôt, remplacés par les relevés locaux. */
export function mergeSurveys(repo: PortsFile, local: Record<string, PortsEntry>): Record<string, PortsEntry> {
  return { ...repo.machines, ...local };
}

/** Agrandit ou réduit la capture d'un facteur, autour d'un point fixe (px, py) en unités SVG. */
export function scaleAround(b: BgPlacement, factor: number, px: number, py: number): BgPlacement {
  const tx = b.x * CELL;
  const ty = b.y * CELL;
  return { x: (px - factor * (px - tx)) / CELL, y: (py - factor * (py - ty)) / CELL, scale: b.scale * factor };
}

/**
 * Calage sur deux coins : p1 et p2 (en unités SVG) sont deux coins opposés du bâtiment tels
 * qu'on les voit sur la capture. On cherche l'agrandissement et le déplacement qui les amènent
 * sur les coins du rectangle de l'empreinte. L'échelle reste la même en largeur et en hauteur ;
 * `ratio` mesure l'écart entre les deux (1 = proportions identiques).
 */
export function fitTwoCorners(
  b: BgPlacement,
  p1: [number, number],
  p2: [number, number],
  w: number,
  h: number,
): (BgPlacement & { ratio: number }) | null {
  const dx = Math.abs(p2[0] - p1[0]);
  const dy = Math.abs(p2[1] - p1[1]);
  if (dx < 2 || dy < 2) return null;
  const kx = (w * CELL) / dx;
  const ky = (h * CELL) / dy;
  const k = Math.sqrt(kx * ky);
  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;
  const cx = CELL + (w * CELL) / 2;
  const cy = CELL + (h * CELL) / 2;
  // nouveau point = k × (ancien − milieu cliqué) + centre de l'empreinte
  return { x: (k * (b.x * CELL - mx) + cx) / CELL, y: (k * (b.y * CELL - my) + cy) / CELL, scale: b.scale * k, ratio: kx / ky };
}
