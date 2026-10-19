// Machines modulaires (S11 → S12) : lecture de data/modular.json pour l'éditeur de bâtiments.
// Deux familles d'assemblage :
//   - par contact (moteur diesel, turbine) : pour chaque face d'un bloc, les blocs qui peuvent la
//     toucher et si elle doit être touchée ;
//   - par portée (ferme d'arbres) : un cercle autour du bloc, mesuré depuis son bord ; un bloc est
//     à portée dès que le cercle le touche (réponses MOD-01 à MOD-06).
// Les corrections notées dans l'éditeur (`ModularEdit`) remplacent les valeurs du dépôt, champ par
// champ. Pur : ni DOM ni stockage.

import type { Source } from "./types.ts";

export type FaceKey = "back" | "front" | "side";
export const FACES: FaceKey[] = ["back", "front", "side"];
export type Edge = "haut" | "bas" | "gauche" | "droite";
export const EDGES: Edge[] = ["haut", "bas", "gauche", "droite"];

export type ModStatus = "sourcé" | "contradiction" | "déduit" | "inconnu";
export type ModFact = {
  key: string;
  text: string;
  value: unknown;
  unit?: string;
  status: ModStatus;
  sources: string[];
  alternatives?: { value: unknown; sources: string[] }[];
  question?: string;
  note?: string;
};
export type ModBlock = { id: string; role: string; facts: ModFact[] };
export type ModAssembly = {
  id: string;
  name: string;
  tier: number;
  research: string;
  assembly: "portée" | "contact";
  summary: string;
  faceNames?: Partial<Record<FaceKey, string>>;
  rules: ModFact[];
  blocks: ModBlock[];
};
export type ModSource = { wiki: "miraheze" | "fandom" | "jeu" | "utilisateur"; url?: string; page?: string; fetchedAt: string; note?: string };
export type ModularFile = { meta?: { openQuestions?: string[] }; sources: Record<string, ModSource>; assemblies: ModAssembly[] };

/** Question encore ouverte (meta.openQuestions) : l'éditeur la signale ; une valeur « inconnue » l'est toujours. */
export const isOpen = (file: ModularFile, f: ModFact | undefined) => !!f?.question && (f.status === "inconnu" || !!file.meta?.openQuestions?.includes(f.question));

/** Correction d'un bloc notée dans l'éditeur de bâtiments ; chaque champ présent remplace celui du dépôt. */
export type ModularEdit = {
  faces?: Partial<Record<FaceKey, string[]>>;
  facesRequired?: Partial<Record<FaceKey, boolean>>;
  rangeTiles?: number | "infinie";
  serves?: string[];
  frontEdge?: Edge;
  /** Côtés réglés à part dans l'éditeur (S19) ; leur réunion reste la face « side ». */
  sides?: SideSplit;
  note?: string;
  source: Source;
};
/** Côté gauche et côté droit du dessin de l'éditeur, quand ils ne suivent pas la même règle. */
export type SideSplit = { left: string[]; right: string[]; leftRequired?: boolean; rightRequired?: boolean };
export type ModularEdits = Record<string, ModularEdit>;

/** Nom court d'un ensemble, pour le repère de la liste des bâtiments (et la recherche). */
export const ASSEMBLY_SHORT: Record<string, string> = { "tree-farm": "ferme", "diesel-engine": "moteur", "modular-turbine": "turbine" };

export const fact = (b: ModBlock, key: string) => b.facts.find((f) => f.key === key);
export const rule = (a: ModAssembly, key: string) => a.rules.find((f) => f.key === key);

export function findBlock(file: ModularFile, id: string): { assembly: ModAssembly; block: ModBlock } | null {
  for (const assembly of file.assemblies) {
    const block = assembly.blocks.find((b) => b.id === id);
    if (block) return { assembly, block };
  }
  return null;
}

// ---------------------------------------------------------------- contact

export type FaceRule = {
  face: FaceKey;
  blocks: string[];
  /** true : la face doit toucher un des blocs ; null : on ne sait pas. */
  required: boolean | null;
};

export type FacesInfo = {
  /** null : on ne sait pas comment le bloc se pose (question ouverte). */
  faces: FaceRule[] | null;
  facesFact?: ModFact;
  requiredFact?: ModFact;
  /** Une partie vient d'une correction de ce navigateur. */
  local: boolean;
  /** Côtés réglés à part (correction de ce navigateur). */
  sides?: SideSplit;
};

/** Faces d'un bloc par contact, dans l'ordre derrière, devant, côtés (seulement celles que les données citent). */
export function blockFaces(block: ModBlock, edit?: ModularEdit): FacesInfo {
  const facesFact = fact(block, "faces");
  const requiredFact = fact(block, "facesRequired");
  const value = (edit?.faces ?? (facesFact?.value as Partial<Record<FaceKey, string[]>> | null)) ?? null;
  const req = edit?.facesRequired ?? (requiredFact?.value as Partial<Record<FaceKey, boolean>> | undefined);
  const local = !!(edit?.faces || edit?.facesRequired || edit?.sides);
  const sides = edit?.sides ? { sides: edit.sides } : {};
  if (!value) return { faces: null, facesFact, requiredFact, local, ...sides };
  const faces = FACES.filter((f) => value[f] !== undefined).map((face) => ({ face, blocks: value[face]!, required: req ? req[face] === true : null }));
  return { faces, facesFact, requiredFact, local, ...sides };
}

/** Un bloc qui peut se suivre lui-même dans la chaîne (vilebrequin, HPT, LPT) se pose en plusieurs exemplaires. */
export function repeats(block: ModBlock): boolean {
  const v = fact(block, "faces")?.value as Partial<Record<FaceKey, string[]>> | null | undefined;
  return !!(v?.back?.includes(block.id) && v.front?.includes(block.id));
}

/** Bord du relevé qui regarde devant (MOD-17) : correction locale, sinon donnée du dépôt, sinon null. */
export function frontEdge(block: ModBlock, edit?: ModularEdit): Edge | null {
  const v = edit?.frontEdge ?? fact(block, "frontEdge")?.value;
  return EDGES.includes(v as Edge) ? (v as Edge) : null;
}

/**
 * Correction à garder : seulement ce qui diffère du dépôt (faces, faces obligatoires, portée,
 * blocs desservis), plus la note et le bord « devant ». null s'il ne reste rien à garder.
 * Une face est gardée si elle porte un bloc, si elle est obligatoire, ou si le dépôt la cite.
 */
export function editDiff(a: ModAssembly, b: ModBlock, draft: ModularEdit): ModularEdit | null {
  const order = (ids: string[]) => a.blocks.map((x) => x.id).filter((id) => ids.includes(id));
  draft = withSides(draft);
  const out: ModularEdit = { source: draft.source };
  if (draft.faces) {
    const repoFaces = (fact(b, "faces")?.value as Partial<Record<FaceKey, string[]>> | null) ?? {};
    const keep = (f: FaceKey) => (draft.faces![f]?.length ?? 0) > 0 || draft.facesRequired?.[f] === true || repoFaces[f] !== undefined;
    const faces: Partial<Record<FaceKey, string[]>> = Object.fromEntries(FACES.filter(keep).map((f) => [f, order(draft.faces![f] ?? [])]));
    const sig = (rec: Partial<Record<FaceKey, string[]>>) => FACES.map((f) => (rec[f] ? `${f}:${order(rec[f]!).join("+")}` : "")).join("|");
    if (sig(faces) !== sig(repoFaces)) out.faces = faces;
  }
  if (draft.facesRequired) {
    const repoReq = (fact(b, "facesRequired")?.value as Partial<Record<FaceKey, boolean>> | undefined) ?? {};
    const req: Partial<Record<FaceKey, boolean>> = Object.fromEntries(FACES.filter((f) => draft.facesRequired![f]).map((f) => [f, true]));
    const sig = (x: Partial<Record<FaceKey, boolean>>) => FACES.filter((f) => x[f]).join(",");
    if (sig(req) !== sig(repoReq)) out.facesRequired = req;
  }
  if (draft.rangeTiles !== undefined && draft.rangeTiles !== fact(b, "rangeTiles")?.value) out.rangeTiles = draft.rangeTiles;
  if (draft.serves) {
    const repoServes = (fact(b, "serves")?.value as string[] | undefined) ?? [];
    if (order(draft.serves).join() !== order(repoServes).join()) out.serves = order(draft.serves);
  }
  if (draft.sides) {
    const { left, right, leftRequired, rightRequired } = draft.sides;
    out.sides = { left: order(left), right: order(right), ...(leftRequired ? { leftRequired } : {}), ...(rightRequired ? { rightRequired } : {}) };
  }
  if (draft.note) out.note = draft.note;
  if (draft.frontEdge) out.frontEdge = draft.frontEdge;
  return Object.keys(out).length > 1 ? out : null;
}

/** Côtés réglés à part : la face « side » devient leur réunion, obligatoire si l'un des deux l'est. */
export function withSides(draft: ModularEdit): ModularEdit {
  if (!draft.sides) return draft;
  const { left, right, leftRequired, rightRequired } = draft.sides;
  return {
    ...draft,
    faces: { ...draft.faces, side: [...new Set([...left, ...right])] },
    facesRequired: { ...draft.facesRequired, side: !!(leftRequired || rightRequired) },
  };
}

// ---------------------------------------------------------------- portée

export type RangeInfo = {
  /** En cases depuis le bord ; « infinie » ; null : pas de portée. */
  tiles: number | "infinie" | null;
  /** Rayon depuis le centre (bloc carré seulement), en cases. */
  fromCenter: number | null;
  rangeFact?: ModFact;
  serves: string[];
  servesFact?: ModFact;
  /** Blocs qui desservent celui-ci, avec leur portée. */
  servedBy: { id: string; tiles: number | "infinie" | null }[];
  local: boolean;
};

const rangeValue = (block: ModBlock, edit?: ModularEdit): number | "infinie" | null => {
  const v = edit?.rangeTiles ?? fact(block, "rangeTiles")?.value;
  return typeof v === "number" || v === "infinie" ? v : null;
};
const servesValue = (block: ModBlock, edit?: ModularEdit): string[] => edit?.serves ?? ((fact(block, "serves")?.value as string[] | undefined) ?? []);

/** Portée d'un bloc d'un ensemble par portée. `size` : empreinte en cases (machines.json). */
export function blockRange(assembly: ModAssembly, block: ModBlock, size: { w: number; l: number } | null, edits: ModularEdits = {}): RangeInfo {
  const edit = edits[block.id];
  const tiles = rangeValue(block, edit);
  const fromCenter = typeof tiles === "number" && size && size.w === size.l ? tiles + size.w / 2 : null;
  const servedBy = assembly.blocks.filter((b) => b.id !== block.id && servesValue(b, edits[b.id]).includes(block.id)).map((b) => ({ id: b.id, tiles: rangeValue(b, edits[b.id]) }));
  return {
    tiles,
    fromCenter,
    rangeFact: fact(block, "rangeTiles"),
    serves: servesValue(block, edit),
    servesFact: fact(block, "serves"),
    servedBy,
    local: !!(edit && (edit.rangeTiles !== undefined || edit.serves)),
  };
}

export type Rect = { x0: number; y0: number; x1: number; y1: number };

/** Distance du point (cx, cy) au rectangle (0 s'il est dedans). */
export function rectDistance(cx: number, cy: number, r: Rect): number {
  return Math.hypot(Math.max(r.x0 - cx, 0, cx - r.x1), Math.max(r.y0 - cy, 0, cy - r.y1));
}

/** Le cercle de rayon `radius` (depuis le centre) touche-t-il le rectangle ? */
export const circleTouches = (radius: number, cx: number, cy: number, r: Rect) => rectDistance(cx, cy, r) <= radius;

/**
 * Grille régulière d'arbres autour d'un bloc carré centré en (0, 0), alignée sur son bord :
 * chaque emplacement d'arbre (tree × tree cases) qui ne chevauche pas le bloc, et s'il est à
 * portée. Sert au dessin de l'éditeur et au contrôle avec le wiki (44 arbres par arroseur).
 */
export function treeGrid(blockSide: number, radius: number, tree = 4): { trees: (Rect & { inRange: boolean })[]; count: number } {
  const half = blockSide / 2;
  const n = Math.ceil((radius + half) / tree) + 1;
  const trees: (Rect & { inRange: boolean })[] = [];
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const x0 = -half + i * tree;
      const y0 = -half + j * tree;
      const r = { x0, y0, x1: x0 + tree, y1: y0 + tree };
      if (r.x0 < half && r.x1 > -half && r.y0 < half && r.y1 > -half) continue; // sous le bloc
      if (rectDistance(0, 0, r) > radius + tree) continue; // trop loin pour le dessin
      trees.push({ ...r, inRange: circleTouches(radius, 0, 0, r) });
    }
  }
  return { trees, count: trees.filter((t) => t.inRange).length };
}
