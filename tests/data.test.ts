// Validation des données générées (data/*.json) et concordance avec la référence.
import { describe, expect, it } from "vitest";
import itemsJson from "../data/items.json";
import machinesJson from "../data/machines.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import aVerifier from "../data/a-verifier.md?raw";
import fixtureJson from "./fixtures/reference-crankshaft.json";
import type { ItemsFile, MachinesFile, Recipe, RecipesFile, ResearchFile, Source, VerifyFlag } from "../src/engine/types.ts";

const { items } = itemsJson as unknown as ItemsFile;
const { machines, treeGrowth } = machinesJson as unknown as MachinesFile;
const { recipes } = recipesJson as unknown as RecipesFile;
const { nodes } = researchJson as unknown as ResearchFile;

const itemIds = new Set(items.map((i) => i.id));
const machineIds = new Set(machines.map((m) => m.id));
const nodeIds = new Set(nodes.map((n) => n.id));
const hasFlag = (verify: VerifyFlag[], field: string) => verify.some((v) => v.field === field || field.startsWith(`${v.field}.`));
const validSource = (s: Source) => !!s.wiki && !!s.fetchedAt && (s.wiki !== "miraheze" && s.wiki !== "fandom" ? true : !!s.url);

describe("intégrité des données", () => {
  it("contient des données", () => {
    expect(recipes.length).toBeGreaterThan(400);
    expect(machines.length).toBeGreaterThan(90);
    expect(items.length).toBeGreaterThan(200);
    expect(nodes.length).toBeGreaterThan(140);
  });

  it("identifiants uniques", () => {
    for (const xs of [items, machines, recipes, nodes] as { id: string }[][]) {
      expect(new Set(xs.map((x) => x.id)).size).toBe(xs.length);
    }
  });

  it("chaque objet a au moins une source valide", () => {
    for (const x of [...items, ...machines, ...recipes, ...nodes]) {
      expect(x.sources.length, x.id).toBeGreaterThan(0);
      for (const s of x.sources) expect(validSource(s), x.id).toBe(true);
    }
  });

  it("aucune valeur manquante sans drapeau « à vérifier »", () => {
    for (const r of recipes) {
      if (r.durationS === null) expect(hasFlag(r.verify, "durationS"), r.id).toBe(true);
      if (r.energyMFps === null) expect(hasFlag(r.verify, "energyMFps"), r.id).toBe(true);
      for (const kind of ["inputs", "outputs"] as const) {
        for (const [k, v] of Object.entries(r[kind])) if (v === null) expect(hasFlag(r.verify, `${kind}.${k}`), `${r.id} ${kind}.${k}`).toBe(true);
      }
    }
    for (const m of machines) {
      for (const f of ["cost", "size", "pollutionPerHour", "unlockedBy"] as const) {
        if (m[f] === null) expect(hasFlag(m.verify, f) || hasFlag(m.verify, "page"), `${m.id}.${f}`).toBe(true);
      }
    }
  });

  it("les recettes référencent des machines et des items existants", () => {
    for (const r of recipes) {
      expect(machineIds.has(r.machine), r.id).toBe(true);
      for (const k of [...Object.keys(r.inputs), ...Object.keys(r.outputs)]) expect(itemIds.has(k), `${r.id} → ${k}`).toBe(true);
      if (r.durationS !== null) expect(r.durationS).toBeGreaterThan(0);
      if (r.research !== null) expect(nodeIds.has(r.research), r.id).toBe(true);
    }
  });

  it("une recette sans sortie est un générateur (énergie négative) ou est signalée", () => {
    for (const r of recipes) {
      if (Object.keys(r.outputs).length) continue;
      expect((r.energyMFps ?? 0) < 0 || hasFlag(r.verify, "outputs"), r.id).toBe(true);
    }
  });

  it("l'arbre de recherche est cohérent", () => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(nodes.filter((n) => n.isRoot).map((n) => n.category).sort()).toEqual(["Energy", "Production", "Utility"]);
    for (const n of nodes) {
      for (const c of n.children) expect(byId.get(c)?.parents, `${n.id} → ${c}`).toContain(n.id);
      for (const p of n.parents) expect(byId.get(p)?.children, `${p} → ${n.id}`).toContain(n.id);
      for (const m of n.unlocksMachines) expect(machineIds.has(m), m).toBe(true);
      for (const r of n.reqItems) expect(itemIds.has(r.item), r.item).toBe(true);
      expect(n.rp).toBeGreaterThanOrEqual(0);
    }
    for (const m of machines) if (m.unlockedBy !== null) expect(nodeIds.has(m.unlockedBy), m.id).toBe(true);
  });

  it("le tableau de pousse des arbres est présent et a une ligne « Normal »", () => {
    expect(treeGrowth.bands.length).toBeGreaterThanOrEqual(8);
    expect(treeGrowth.bands.some((b) => b.label.includes("Normal"))).toBe(true);
    expect(treeGrowth.source.url).toMatch(/miraheze/);
  });

  it("valeurs de contrôle relevées à la main sur Miraheze (2026-10-11)", () => {
    const get = (id: string) => recipes.find((r) => r.id === id)!;
    expect(get("craft_assembler_05")).toMatchObject({ durationS: 15, energyMFps: 4000, inputs: { "steel-rod": 2, gear: 4 }, outputs: { crankshaft: 1 } });
    expect(get("press_03")).toMatchObject({ durationS: 4, energyMFps: 12500 });
    expect(machines.find((m) => m.id === "blast-furnace")).toMatchObject({ cost: 60000, size: { w: 8, l: 8 }, pollutionPerHour: 0.216, unlockedBy: "steel" });
    expect(nodes.find((n) => n.id === "advanced-assembler")).toMatchObject({ rp: 100000, reqItems: [{ item: "crankshaft", amount: 20 }] });
    expect(nodes.find((n) => n.id === "oil-fracking")?.parents.sort()).toEqual(["industrial-diesel-refining", "quarry"]);
  });
});

// ---------------------------------------------------------------- concordance
type FixtureRecipe = { key: string; machine: string; durationS: number; energyMFps: number; inputs: Record<string, number>; outputs: Record<string, number> };
const fixture = fixtureJson as unknown as { recipes: FixtureRecipe[] };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const close = (a: number, b: number | null | undefined) => typeof b === "number" && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));

function findRecipe(fr: FixtureRecipe): Recipe | undefined {
  const ins = Object.keys(fr.inputs).map(slug).sort().join("|");
  const outs = Object.keys(fr.outputs).map(slug).sort().join("|");
  return recipes.find(
    (r) => r.machine === slug(fr.machine) && Object.keys(r.inputs).sort().join("|") === ins && Object.keys(r.outputs).sort().join("|") === outs,
  );
}
function differences(fr: FixtureRecipe, r: Recipe): string[] {
  const out: string[] = [];
  if (!close(fr.durationS, r.durationS)) out.push("durationS");
  if (!close(fr.energyMFps, r.energyMFps)) out.push("energyMFps");
  for (const [k, v] of Object.entries(fr.inputs)) if (!close(v, r.inputs[slug(k)])) out.push(`inputs.${slug(k)}`);
  for (const [k, v] of Object.entries(fr.outputs)) if (!close(v, r.outputs[slug(k)])) out.push(`outputs.${slug(k)}`);
  return out;
}

describe("concordance avec la référence", () => {
  it("chaque recette de la référence est identique ou son écart est documenté dans a-verifier.md", () => {
    for (const fr of fixture.recipes) {
      const r = findRecipe(fr);
      if (!r) {
        expect(aVerifier, `recette ${fr.key} absente`).toContain(`<!-- ref:${fr.key}:recette -->`);
        continue;
      }
      for (const field of differences(fr, r)) expect(aVerifier, `écart ${fr.key}.${field} non documenté`).toContain(`<!-- ref:${fr.key}:${field} -->`);
    }
  });

  it("a-verifier.md ne documente pas d'écart périmé", () => {
    const documented = [...aVerifier.matchAll(/<!-- ref:([^:]+):([^ ]+) -->/g)].map((m) => `${m[1]}:${m[2]}`);
    const actual = fixture.recipes.flatMap((fr) => {
      const r = findRecipe(fr);
      return r ? differences(fr, r).map((f) => `${fr.key}:${f}`) : [`${fr.key}:recette`];
    });
    expect(documented.sort()).toEqual(actual.sort());
  });

  it("les écarts connus du PLAN (§0 bis) sont bien ceux-là", () => {
    const actual = fixture.recipes.flatMap((fr) => {
      const r = findRecipe(fr);
      return r ? differences(fr, r).map((f) => `${fr.key}:${f}`) : [`${fr.key}:recette`];
    });
    expect(actual.sort()).toEqual(
      ["crank:durationS", "crank:energyMFps", "gear:energyMFps", "plate:durationS", "plate:energyMFps", "oak:durationS"].sort(),
    );
  });
});

describe("indépendance du moteur", () => {
  it("src/engine n'utilise ni le DOM ni l'interface", () => {
    const files = import.meta.glob("../src/engine/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(0);
    for (const [path, src] of Object.entries(files)) {
      if (path.endsWith(".test.ts")) continue;
      expect(src, path).not.toMatch(/from\s+["'][^"']*\/ui\//);
      expect(src, path).not.toMatch(/\b(document|window|localStorage)\./);
    }
  });
});
