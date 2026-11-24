// « Mes designs » (PLAN-PARTAGE.md, lot P2 bis) : l'arbre des dossiers et des designs, pur, sans DOM ni stockage.
// Règles (§ 5 bis) : jamais deux fois le même nom dans un dossier ; la corbeille garde tout sans question ;
// remplacer envoie l'ancien à la corbeille ; les conflits de noms se demandent (`Ask`).

export type DesignNode = {
  id: number;
  type: "des";
  name: string;
  /** Le nom suit l'objectif tant que le joueur ne l'a ni enregistré ni renommé. */
  auto?: true;
  /** Dernier enregistrement, au format du lien. */
  d?: string;
  /** Travail en cours plus récent que `d` (design quitté sans enregistrer) : gardé, jamais perdu. */
  w?: string;
  /** Dernière modification (ms) et machines du plan, pour comparer deux designs. */
  at: number;
  mach?: number;
  /** Le design porte le profil de son auteur : il s'ouvre en session de lecture. */
  lec?: true;
  /** Corbeille : dossier d'origine. */
  from?: number;
};
export type DirNode = { id: number; type: "dir"; name: string; open?: boolean; kids: Node[]; from?: number };
export type Node = DesignNode | DirNode;
export type Tree = { v: 1; next: number; root: DirNode; bin: DirNode; active: number | null; /** Signature du design affiché quand il a été ouvert ou enregistré. */ base: string | null };

export const ROOT = 0, BIN = 1;
export const emptyTree = (): Tree => ({ v: 1, next: 2, root: { id: ROOT, type: "dir", name: "", open: true, kids: [] }, bin: { id: BIN, type: "dir", name: "", kids: [] }, active: null, base: null });

const str = (x: unknown): x is string => typeof x === "string";
/** Relit l'arbre enregistré ; null si ce n'en est pas un. Un élément abîmé est laissé de côté, pas les autres. */
export function readTree(raw: unknown): Tree | null {
  const t = raw as Partial<Tree> | null;
  if (!t || typeof t !== "object" || t.v !== 1 || !t.root || !t.bin) return null;
  const seen = new Set<number>([ROOT, BIN]);
  let top = 1;
  const read = (x: unknown): Node | null => {
    const n = x as Record<string, unknown>;
    if (!n || typeof n !== "object" || !Number.isSafeInteger(n.id) || seen.has(n.id as number) || !str(n.name)) return null;
    const id = n.id as number, from = Number.isSafeInteger(n.from) ? { from: n.from as number } : {};
    seen.add(id);
    top = Math.max(top, id);
    if (n.type === "dir" && Array.isArray(n.kids)) return { id, type: "dir", name: n.name, ...(n.open === true ? { open: true } : {}), kids: list(n.kids), ...from };
    if (n.type !== "des") return null;
    return { id, type: "des", name: n.name, ...(n.auto === true ? { auto: true as const } : {}), ...(str(n.d) ? { d: n.d } : {}), ...(str(n.w) ? { w: n.w } : {}), at: typeof n.at === "number" ? n.at : 0, ...(typeof n.mach === "number" ? { mach: n.mach } : {}), ...(n.lec === true ? { lec: true as const } : {}), ...from };
  };
  const list = (xs: unknown[]) => xs.map(read).filter((n): n is Node => !!n);
  const kids = (x: unknown) => list(Array.isArray((x as DirNode).kids) ? (x as DirNode).kids : []);
  const out = emptyTree();
  out.root.kids = kids(t.root);
  out.bin.kids = kids(t.bin);
  out.bin.open = t.bin.open === true;
  out.next = Math.max(top + 1, Number.isSafeInteger(t.next) ? t.next! : 0);
  const a = find(out, t.active ?? -1);
  out.active = a && a.node.type === "des" && !inBin(out, a.node.id) ? a.node.id : null;
  out.base = str(t.base) ? t.base : null;
  return out;
}

export function find(t: Tree, id: number): { node: Node; parent: DirNode | null } | null {
  const walk = (n: Node, parent: DirNode | null): { node: Node; parent: DirNode | null } | null => {
    if (n.id === id) return { node: n, parent };
    if (n.type === "dir") for (const k of n.kids) { const r = walk(k, n); if (r) return r; }
    return null;
  };
  return walk(t.root, null) ?? walk(t.bin, null);
}
export const within = (n: Node, id: number): boolean => n.id === id || (n.type === "dir" && n.kids.some((k) => within(k, id)));
export const inBin = (t: Tree, id: number): boolean => id !== BIN && within(t.bin, id);
export const isDir = (n: Node | null | undefined): n is DirNode => n?.type === "dir";
/** Un design se sert de son travail en cours s'il en a un, sinon de son enregistrement. */
export const contentOf = (n: DesignNode): string | undefined => n.w ?? n.d;
export const sizeOf = (n: DesignNode): number => contentOf(n)?.length ?? 0;

const key = (s: string) => s.trim().toLocaleLowerCase("fr");
export const taken = (dir: DirNode, name: string, except?: Node): Node | undefined => dir.kids.find((k) => k !== except && key(k.name) === key(name));
/** « Nom », sinon « Nom (2) », « Nom (3) »… */
export function free(dir: DirNode, name: string, except?: Node): string {
  const n = name.trim();
  if (!taken(dir, n, except)) return n;
  const base = n.replace(/ \(\d+\)$/, "");
  for (let i = 2; ; i++) if (!taken(dir, `${base} (${i})`, except)) return `${base} (${i})`;
}
/** Dossiers d'abord, puis ordre alphabétique (les nombres dans leur ordre). */
export const sorted = (kids: readonly Node[]): Node[] => [...kids].sort((a, b) => (a.type === b.type ? 0 : a.type === "dir" ? -1 : 1) || a.name.localeCompare(b.name, "fr", { numeric: true }));

/** Le même dossier (« Reçus ») à la racine, créé au besoin. Un design du même nom ne gêne pas : le dossier prend « (2) ». */
export function folder(t: Tree, name: string): DirNode {
  const k = t.root.kids.find((x): x is DirNode => x.type === "dir" && key(x.name) === key(name));
  return k ?? addDir(t, t.root, name);
}
export function addDir(t: Tree, dir: DirNode, name: string): DirNode {
  const n: DirNode = { id: t.next++, type: "dir", name: free(dir, name), open: true, kids: [] };
  dir.kids.push(n);
  dir.open = true;
  return n;
}
/** Un design neuf, pas encore rangé (`place`) ou rangé tout de suite avec un nom libre (`addDesign`). */
export const makeDesign = (t: Tree, name: string, rest: Partial<Omit<DesignNode, "id" | "type" | "name">> = {}): DesignNode => ({ id: t.next++, type: "des", name, at: Date.now(), ...rest });
export function addDesign(t: Tree, dir: DirNode, name: string, rest: Parameters<typeof makeDesign>[2] = {}): DesignNode {
  const n = makeDesign(t, free(dir, name), rest);
  dir.kids.push(n);
  dir.open = true;
  return n;
}

export type RenameResult = "ok" | "vide" | "pris";
export function rename(t: Tree, id: number, name: string): RenameResult {
  const f = find(t, id);
  if (!f?.parent || !name.trim()) return "vide";
  if (taken(f.parent, name, f.node)) return "pris";
  f.node.name = name.trim();
  if (f.node.type === "des") delete f.node.auto;
  return "ok";
}

const detach = (p: DirNode, n: Node) => { const i = p.kids.indexOf(n); if (i >= 0) p.kids.splice(i, 1); };

/** Met à la corbeille, sans question. */
export function toBin(t: Tree, id: number): boolean {
  const f = find(t, id);
  if (!f?.parent || id === BIN || inBin(t, id)) return false;
  detach(f.parent, f.node);
  f.node.from = f.parent.id;
  f.node.name = free(t.bin, f.node.name);
  t.bin.kids.push(f.node);
  return true;
}
/** Où restaurer : le dossier d'origine s'il existe encore hors de la corbeille, sinon la racine. */
export function home(t: Tree, n: Node): DirNode {
  const f = n.from === undefined ? null : find(t, n.from)?.node;
  return isDir(f) && f.id !== BIN && !inBin(t, f.id) ? f : t.root;
}
/** Suppression définitive (dans la corbeille seulement). */
export function destroy(t: Tree, id: number): boolean {
  const f = find(t, id);
  if (!f?.parent || !inBin(t, id)) return false;
  detach(f.parent, f.node);
  return true;
}

export type Choice = "replace" | "skip" | "keep" | "merge" | "cancel";
/** Un conflit à trancher. `left` : conflits restants à ce niveau, celui-ci compris ; rendre `all` l'applique aux suivants. */
export type Conflict = { node: Node; clash: Node; dir: DirNode; kind: "dossiers" | "designs" | "mixte"; left: number };
export type Ask = (c: Conflict) => Promise<{ choice: Choice; all?: boolean }>;
export type Moved = { done: number; skipped: number; cancelled: boolean };

/**
 * Pose `n` (venu de `parent`, ou d'ailleurs si null) dans `dir`. Nom libre : posé. Nom pris : la question. Un choix
 * « pour les suivants » ne s'applique qu'aux conflits du même genre. Annuler arrête tout, ce qui est posé le reste.
 */
export async function place(t: Tree, n: Node, parent: DirNode | null, dir: DirNode, ask: Ask): Promise<Moved> {
  const out: Moved = { done: 0, skipped: 0, cancelled: false };
  const all = new Map<Conflict["kind"], Choice>();
  const one = async (x: Node, from: DirNode | null, to: DirNode, left: number): Promise<void> => {
    if (from === to) return;
    const clash = taken(to, x.name, x);
    const take = () => {
      if (from) detach(from, x);
      delete x.from;
      to.kids.push(x);
      out.done++;
    };
    if (!clash) return take();
    const kind = x.type === "dir" && clash.type === "dir" ? "dossiers" : x.type === "des" && clash.type === "des" ? "designs" : "mixte";
    let choice = all.get(kind);
    if (!choice) {
      const a = await ask({ node: x, clash, dir: to, kind, left });
      choice = a.choice;
      if (a.all && choice !== "cancel") all.set(kind, choice);
    }
    if (choice === "cancel") return void (out.cancelled = true);
    if (choice === "skip") return void out.skipped++;
    if (choice === "merge" && x.type === "dir" && clash.type === "dir") {
      const kids = [...x.kids];
      let more = kids.filter((k) => taken(clash, k.name)).length;
      for (const k of kids) {
        const hit = !!taken(clash, k.name);
        await one(k, x, clash, more);
        if (hit) more--;
        if (out.cancelled) return;
      }
      if (!x.kids.length && from) detach(from, x); // vidé : il disparaît
      return;
    }
    if (choice === "replace" && kind === "designs") {
      toBin(t, clash.id);
      if (t.active === clash.id) t.active = x.id;
      return take();
    }
    x.name = free(to, x.name, x);
    take();
  };
  await one(n, parent, dir, 1);
  return out;
}

/** Déplace un élément vers un dossier (glisser, restaurer) ; vers la corbeille : sans question. */
export async function move(t: Tree, id: number, dirId: number, ask: Ask): Promise<Moved | null> {
  const f = find(t, id), d = find(t, dirId)?.node;
  if (!f?.parent || !isDir(d) || f.parent === d || id === BIN || within(f.node, dirId)) return null;
  if (d.id === BIN || inBin(t, d.id)) return toBin(t, id) ? { done: 1, skipped: 0, cancelled: false } : null;
  const r = await place(t, f.node, f.parent, d, ask);
  if (!r.cancelled) d.open = true;
  return r;
}

/** Copie un design dans son dossier. */
export function duplicate(t: Tree, id: number, label: string, content: string | undefined): DesignNode | null {
  const f = find(t, id);
  if (!f?.parent || f.node.type !== "des" || inBin(t, id)) return null;
  return addDesign(t, f.parent, label, { ...(content ? { d: content } : {}), ...(f.node.mach !== undefined ? { mach: f.node.mach } : {}), ...(f.node.lec ? { lec: true as const } : {}) });
}
