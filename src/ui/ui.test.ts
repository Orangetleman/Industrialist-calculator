// Tests des parties pures de l'interface (sans navigateur).
import { describe, expect, it } from "vitest";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { makeData, progress } from "../../tests/engine-helpers.ts";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import { solve } from "../engine/solve.ts";
import { esc, fieldLabel, fmt, fmtDuration, fmtMF, parseInput } from "./format.ts";
import { layoutGraph, NODE_H, NODE_W } from "./graph-layout.ts";
import { renderGraph, renderPlan, renderSummary, renderVerify } from "./render.ts";
import { DEFAULT_SETTINGS, isOverridesFile, mergeCorrections, removeCorrection, setCorrection } from "./state.ts";

describe("mise en forme", () => {
  it("nombres et puissances au format français", () => {
    expect(fmt(52.3256, 2)).toBe("52,33");
    expect(fmt(1234567, 0).replace(/\s/g, " ")).toBe("1 234 567");
    expect(fmt(-0.0001, 2)).toBe("0");
    expect(fmtMF(704836)).toBe("704,8 kMF/s");
    expect(fmtMF(3488)).toBe("3,5 kMF/s");
    expect(fmtMF(120)).toBe("120 MF/s");
    expect(fmtMF(2.5e6)).toBe("2,5 MMF/s");
    expect(fmtMF(null)).toBe("—");
  });

  it("durées lisibles", () => {
    expect(fmtDuration(45)).toBe("45 s");
    expect(fmtDuration(600)).toBe("10 min");
    expect(fmtDuration(3 * 3600 + 5 * 60)).toBe("3 h 05 min");
    expect(fmtDuration(50 * 3600)).toBe("2 j 2 h");
  });

  it("saisie : virgule décimale, tailles, refus des valeurs absurdes", () => {
    expect(parseInput("durationS", "17,2")).toEqual({ ok: true, value: 17.2 });
    expect(parseInput("size", "8x8")).toEqual({ ok: true, value: { w: 8, l: 8 } });
    expect(parseInput("durationS", "0").ok).toBe(false);
    expect(parseInput("energyMFps", "abc").ok).toBe(false);
  });

  it("libellés de champs et échappement HTML", () => {
    expect(fieldLabel("inputs.steel-rod", () => "Steel Rod")).toBe("entrée : Steel Rod");
    expect(esc(`<img src=x onerror="a">`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;");
  });
});

describe("corrections locales", () => {
  it("ajouter, fusionner, retirer", () => {
    let c = setCorrection({}, "recipes", "r1", "durationS", 17.2);
    expect(c.recipes?.r1?.durationS?.value).toBe(17.2);
    expect(c.recipes?.r1?.durationS?.source.wiki).toBe("saisie");
    c = mergeCorrections(c, { recipes: { r1: { energyMFps: { value: 1, source: { wiki: "jeu", fetchedAt: "x" } } } } });
    expect(Object.keys(c.recipes!.r1!)).toEqual(["durationS", "energyMFps"]);
    c = removeCorrection(removeCorrection(c, "recipes", "r1", "durationS"), "recipes", "r1", "energyMFps");
    expect(c.recipes).toEqual({});
  });

  it("refuse un fichier importé mal formé", () => {
    expect(isOverridesFile({ recipes: {} })).toBe(true);
    expect(isOverridesFile([])).toBe(false);
    expect(isOverridesFile({ recipes: [] })).toBe(false);
  });
});

// ---------------------------------------------------------------- graphe et rendu sur les vraies données
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson } as unknown as RawFiles;
const { data } = buildGameData(files);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };

type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("disposition du graphe", () => {
  for (const criterion of ["machines", "energy", "raw"] as const) {
    it(`aucun chevauchement de nœuds, toutes les flèches vont vers le haut (critère ${criterion})`, () => {
      const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion });
      const g = layoutGraph(plan);
      expect(g.nodes).toHaveLength(plan.steps.length + plan.unresolved.filter((u) => !u.loopShortfall).length);
      const boxes = g.nodes.map((n) => ({ x: n.x, y: n.y, w: NODE_W, h: NODE_H }));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i]!, boxes[j]!)).toBe(false);
      for (const e of g.edges) expect(e.y1).toBeGreaterThan(e.y2); // producteur sous le consommateur
      expect(g.edges).toHaveLength(plan.edges.length);
      expect(g.nodes.find((n) => n.item === "crankshaft")?.kind).toBe("final");
    });
  }

  it("un item non produit apparaît comme nœud « non produit »", () => {
    const d = makeData({ recipes: [{ id: "r", machine: "m", t: 10, in: { missing: 1 }, out: { x: 1 } }] });
    const plan = solve(d, progress(), { item: "x", ratePerMin: 6 });
    const g = layoutGraph(plan);
    expect(g.nodes.find((n) => n.item === "missing")).toMatchObject({ kind: "unresolved", depth: 1 });
  });
});

describe("rendu HTML", () => {
  const plan = solve(data, all, { item: "crankshaft", finalMachines: 15, criterion: "energy" });
  const ctx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {} };

  it("résumé, graphe et plan contiennent les chiffres clés", () => {
    expect(renderSummary(ctx)).toContain("Crankshaft / min");
    const svg = renderGraph(ctx);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<g>/g) ?? []).length).toBe(plan.steps.length);
    const html = renderPlan(ctx);
    expect(html).toContain("Produit final");
    expect(html).toContain('data-force="crankshaft"');
  });

  it("le panneau « à vérifier » propose une saisie pour les champs corrigeables", () => {
    const html = renderVerify(ctx);
    expect(html).toContain('data-id="craft_assembler_05"');
    expect(html).toContain('data-field="durationS"');
    expect(html).toContain("17,2");
  });

  it("échappe les noms venant des données", () => {
    const d = makeData({ recipes: [{ id: "r<x>", machine: "m", t: 10, out: { "<b>evil</b>": 1 } }] });
    const p = solve(d, progress(), { item: "<b>evil</b>", ratePerMin: 6 });
    const html = renderPlan({ data: d, plan: p, settings: DEFAULT_SETTINGS, corrections: {} }) + renderGraph({ data: d, plan: p, settings: DEFAULT_SETTINGS, corrections: {} });
    expect(html).not.toContain("<b>evil</b>");
    expect(html).toContain("&lt;b&gt;evil&lt;/b&gt;");
  });
});
