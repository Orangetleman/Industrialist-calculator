// Éditeur de bâtiments : modèle pur (sans DOM). Un relevé = empreinte en cases + ports.
// Grille affichée : l'empreinte entourée d'une marge d'une case, où se posent les plots des ports.

import type { Port, PortsEntry, PortsFile } from "../engine/extension-types.ts";
import type { Source } from "../engine/types.ts";

export const CELL = 30; // pixels par case dans le SVG (la vue est ensuite mise à l'échelle)

export type Tool = "objet" | "fluide" | "énergie" | "logique" | "gomme";

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
    direction: type === "énergie" ? "entrée" : direction,
    side: place.side,
    cell: place.cell,
    ...(place.side !== "dessus" ? { stub: previous?.stub ?? 1 } : {}),
  };
  return [...others, next];
}

/** Contrôles avant export : renvoie la liste des problèmes (vide = relevé exploitable). */
export function checkEntry(e: PortsEntry): string[] {
  const out: string[] = [];
  if (!e.footprint || !(e.footprint.w > 0) || !(e.footprint.h > 0)) out.push("empreinte manquante");
  if (!e.ports.length) out.push("aucun port");
  if (!e.ports.some((p) => p.type === "énergie")) out.push("pas de prise électrique (normal seulement pour un bâtiment sans énergie)");
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

/** Fichier d'export (même format que data/ports.json). */
export function exportSurveys(local: Record<string, PortsEntry>): PortsFile {
  return {
    _lisezMoi: "Relevés de bâtiments faits dans l'éditeur du calculateur. À intégrer à data/ports.json (même format).",
    machines: local,
  };
}

export function surveySource(note = "relevé dans l'éditeur de bâtiments du calculateur"): Source {
  return { wiki: "saisie", fetchedAt: new Date().toISOString(), note };
}

/** Lecture prudente d'un fichier importé. */
export function parseSurveys(raw: unknown): Record<string, PortsEntry> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = (raw as { machines?: unknown }).machines;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const out: Record<string, PortsEntry> = {};
  for (const [id, e] of Object.entries(m as Record<string, PortsEntry>)) {
    if (e && Array.isArray(e.ports) && e.source?.fetchedAt) out[id] = e;
  }
  return out;
}
