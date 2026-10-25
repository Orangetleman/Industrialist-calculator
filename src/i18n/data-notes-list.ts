// Les notes des données que le site affiche (S32), fichier par fichier : sert au test des notes
// (data-notes.test.ts), qui vérifie que chacune a sa traduction anglaise (data/i18n/en.json).
// Les champs saisis dans les formulaires (notes d'un relevé de ports, effet d'une interface) n'en font pas
// partie : ils restent tels que le joueur les a écrits.

/** Accent ou petit mot français : la note est en français (et non un nom du jeu ou un nombre). */
export const looksFrench = (s: string): boolean =>
  /[àâçéèêëîïôûùüÿœÀÂÇÉÈÊËÎÏÔÛÙÜŸŒ]/.test(s) || /(?:^|[^\p{L}])(le|la|les|des|du|un|une|pour|avec|dans|est|sont|ou|et|au|aux|sur|pas|ce|cette|de|en|qui|que|ne|par)(?=[^\p{L}]|$)/iu.test(s);

type Src = { note?: string; page?: string };
type Flag = { detail?: unknown; alternatives?: { source?: Src }[] };
type Entity = { verify?: Flag[]; sources?: Src[] };

/** Clés des faits d'un bloc modulaire que l'éditeur de bâtiments montre (src/ui/buildings.ts). */
export const SHOWN_FACTS = ["count", "sprinklersPerTank", "needsTankInControllerRange", "mustBeInControllerRange", "extraTanksNeedWater", "multipleOutputs", "placement", "faces", "facesRequired", "rangeTiles"];

/** Les textes affichés d'un fichier de données (nom du fichier → son contenu JSON). */
export function shownNotes(file: string, json: unknown): string[] {
  const out: string[] = [];
  const add = (s: unknown) => {
    if (typeof s === "string" && s) out.push(s);
  };
  const src = (list: Src[] | undefined) => {
    for (const s of list ?? []) add(s.note), add(s.page);
  };
  const entity = (e: Entity) => {
    for (const f of e.verify ?? []) {
      add(f.detail);
      for (const a of f.alternatives ?? []) add(a.source?.note), add(a.source?.page);
    }
    src(e.sources);
  };
  const j = json as Record<string, unknown>;
  if (file === "items.json") for (const x of j.items as Entity[]) entity(x);
  if (file === "machines.json") {
    for (const x of j.machines as Entity[]) entity(x);
    src([(j.treeGrowth as { source: Src }).source]);
  }
  if (file === "recipes.json") for (const x of j.recipes as Entity[]) entity(x);
  if (file === "research.json") for (const x of j.nodes as Entity[]) entity(x);
  if (file === "energy.json")
    for (const s of j.setups as (Entity & { name: string; note?: string; observed?: { note?: string } })[]) {
      add(s.name), add(s.note), add(s.observed?.note);
      entity(s);
    }
  if (file === "overrides.json") {
    const walk = (v: unknown, key: string) => {
      if (key === "note") add(v);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk(json, "");
  }
  if (file === "interfaces.json")
    for (const i of Object.values(j.machines as Record<string, { where?: string; notes?: string; sources?: Src[]; settings: { name: string; note?: string; choices?: { label: string; doubt?: string }[] }[] }>)) {
      add(i.where), add(i.notes);
      src(i.sources);
      for (const s of i.settings) {
        add(s.name), add(s.note);
        for (const c of s.choices ?? []) add(c.label), add(c.doubt);
      }
    }
  if (file === "modular.json") {
    for (const s of Object.values(j.sources as Record<string, Src>)) add(s.page);
    for (const a of j.assemblies as { blocks: { role?: string; facts?: { key: string; text: string }[] }[] }[])
      for (const b of a.blocks) {
        add(b.role);
        for (const f of b.facts ?? []) if (SHOWN_FACTS.includes(f.key)) add(f.text);
      }
  }
  return [...new Set(out)].filter(looksFrench);
}
