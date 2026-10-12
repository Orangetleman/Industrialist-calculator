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
import { currentRp, exportProgress, parseOptional, parseProgressExport, progressSummary, renderOwned, renderTree, sanitizeProgress, toEngineProgress, withRpRate } from "./progress.ts";
import { layoutResearch, RN_H, RN_W } from "./research-layout.ts";
import { nodeState, renderNodeDetail, renderResearchSvg } from "./research-view.ts";
import { DEFAULT_SETTINGS, isOverridesFile, mergeCorrections, pruneIntegratedCorrections, removeCorrection, setCorrection } from "./state.ts";

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

  it("une correction locale déjà intégrée aux données (même date) est retirée", () => {
    const e = (v: number, at: string) => ({ value: v, source: { wiki: "saisie" as const, fetchedAt: at } });
    const local = { recipes: { r1: { durationS: e(15, "a"), energyMFps: e(9, "b") }, r2: { durationS: e(4, "c") } } };
    const repo = { recipes: { r1: { durationS: { ...e(15, "a"), source: { wiki: "jeu" as const, fetchedAt: "a" } } }, r2: { durationS: e(4, "c") } } };
    const r = pruneIntegratedCorrections(local, repo);
    expect(r.dropped).toBe(2);
    expect(r.kept.recipes).toEqual({ r1: { energyMFps: e(9, "b") } });
  });

  it("refuse un fichier importé mal formé", () => {
    expect(isOverridesFile({ recipes: {} })).toBe(true);
    expect(isOverridesFile([])).toBe(false);
    expect(isOverridesFile({ recipes: [] })).toBe(false);
  });
});

describe("progression et « Ma partie »", () => {
  const d = makeData({
    nodes: [
      { id: "a", rp: 10 },
      { id: "b", rp: 20, parents: ["a"], reqItems: [{ item: "x", amount: 5 }] },
    ],
    machines: [{ id: "mb", unlockedBy: "b" }, { id: "limited", unlockedBy: null }],
    recipes: [
      { id: "rx", machine: "mb", t: 10, out: { x: 1 } },
      { id: "rz", machine: "limited", t: 10, out: { z: 1 } },
    ],
  });

  it("saisie facultative : vide → null, virgule acceptée, texte refusé", () => {
    expect(parseOptional("")).toBeNull();
    expect(parseOptional(" 2,5 ")).toBe(2.5);
    expect(parseOptional("12 000")).toBe(12000);
    expect(parseOptional("abc")).toBe("invalide");
  });

  it("nettoie une progression enregistrée avec des ids disparus", () => {
    expect(sanitizeProgress(d, { unlocked: ["a", "ancien"], reqItemsDone: ["zz"], owned: ["limited", "?"] })).toEqual({ unlocked: ["a"], reqItemsDone: [], owned: ["limited"] });
  });

  it("états des nœuds : débloqué, disponible, verrouillé, incohérent", () => {
    const html = (unlocked: string[]) => renderTree(d, toEngineProgress({ unlocked, reqItemsDone: [], owned: [] }), { category: "Production", filter: "" });
    expect(html([])).toMatch(/class="node available"[\s\S]*data-node="a"/);
    expect(html([])).toMatch(/class="node locked"[\s\S]*data-node="b"/);
    expect(html(["a"])).toMatch(/class="node done"[\s\S]*data-node="a"/);
    expect(html(["b"])).toMatch(/class="node incoherent"[\s\S]*data-node="b"/);
    expect(html([])).toContain('data-req="b"'); // condition « vendre 5 x »
    expect(renderTree(d, toEngineProgress({ unlocked: [], reqItemsDone: [], owned: [] }), { category: "Production", filter: "mb" })).not.toContain('data-node="a"');
  });

  it("export puis import de la progression : aller-retour identique", () => {
    const prog = { unlocked: ["a", "b"], reqItemsDone: ["b"], owned: ["limited"] };
    const player = { pollutionPct: 12.5, money: 1000, rp: 500, rpPerSec: 2, rpAt: Date.parse("2026-10-12T09:00:00Z") };
    const file = JSON.parse(JSON.stringify(exportProgress(prog, player, new Date("2026-10-12T10:00:00Z"))));
    expect(parseProgressExport(d, file)).toEqual({ ok: true, progress: prog, player, dropped: 0, exportedAt: "2026-10-12T10:00:00.000Z" });
  });

  it("les RP évoluent avec les RP/s ; changer la vitesse garde les RP accumulés", () => {
    const t0 = Date.parse("2026-10-12T09:00:00Z");
    const p = { pollutionPct: null, money: null, rp: 500, rpPerSec: 2, rpAt: t0 };
    expect(currentRp(p, t0 + 60_000)).toBe(620); // + 2 RP/s × 60 s
    expect(currentRp({ ...p, rpPerSec: null }, t0 + 60_000)).toBe(500);
    expect(currentRp({ ...p, rp: null }, t0)).toBeNull();
    const q = withRpRate(p, 5, t0 + 60_000); // 620 RP acquis, puis 5 RP/s
    expect(q).toMatchObject({ rp: 620, rpPerSec: 5, rpAt: t0 + 60_000 });
    expect(currentRp(q, t0 + 120_000)).toBe(920);
  });

  it("import : refuse un fichier étranger, ignore les ids disparus", () => {
    expect(parseProgressExport(d, { recipes: {} }).ok).toBe(false);
    expect(parseProgressExport(d, { format: "industrialist-progression", version: 2 }).ok).toBe(false);
    const r = parseProgressExport(d, { format: "industrialist-progression", version: 1, progress: { unlocked: ["a", "ancien", 42], owned: ["?"] }, player: { money: "beaucoup" } });
    expect(r).toMatchObject({ ok: true, progress: { unlocked: ["a"], reqItemsDone: [], owned: [] }, player: { money: null }, dropped: 2 });
  });

  it("résumé et machines possédées", () => {
    const p = toEngineProgress({ unlocked: ["a"], reqItemsDone: [], owned: ["limited"] });
    expect(progressSummary(d, p)).toBe("1 / 2 recherches débloquées · 10 RP investis");
    expect(renderOwned(d, p)).toMatch(/data-owned="limited" checked/);
  });
});

// ---------------------------------------------------------------- graphe et rendu sur les vraies données
const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson } as unknown as RawFiles;
const { data } = buildGameData(files);
const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };

type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("disposition du graphe", () => {
  for (const criterion of ["machines", "energy", "raw", "steps", "pollution", "cost"] as const) {
    it(`aucun chevauchement de nœuds, toutes les flèches vont vers le haut (critère ${criterion})`, () => {
      const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion });
      const g = layoutGraph(plan);
      expect(g.nodes).toHaveLength(plan.steps.length + plan.unresolved.filter((u) => !u.loopShortfall).length);
      const boxes = g.nodes.map((n) => ({ x: n.x, y: n.y, w: NODE_W, h: NODE_H }));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i]!, boxes[j]!)).toBe(false);
      for (const e of g.edges) {
        // Arc de retour d'une boucle rentable (sous-produit qui remonte) : tracé à part, sur le côté.
        if (e.loop) expect(plan.edges.some((x) => x.loop && x.from === e.from && x.to === e.to), `${e.from}→${e.to}`).toBe(true);
        else expect(e.points[0]![1]).toBeGreaterThan(e.points.at(-1)![1]); // producteur sous le consommateur
        // Aucun tronçon ne traverse un nœud (hors ses deux extrémités).
        for (const n of g.nodes) {
          if (n.item === e.from || n.item === e.to) continue;
          for (let k = 1; k < e.points.length; k++) {
            const [ax, ay] = e.points[k - 1]!;
            const [bx, by] = e.points[k]!;
            for (let s = 0; s <= 20; s++) {
              const x = ax + ((bx - ax) * s) / 20;
              const y = ay + ((by - ay) * s) / 20;
              expect(x > n.x + 1 && x < n.x + NODE_W - 1 && y > n.y + 1 && y < n.y + NODE_H - 1, `${e.from}→${e.to} traverse ${n.item}`).toBe(false);
            }
          }
        }
      }
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

describe("arbre de recherche « comme en jeu »", () => {
  for (const category of ["Production", "Energy", "Utility"] as const) {
    it(`${category} : tous les nœuds placés, sans chevauchement, enfants à droite des parents`, () => {
      const l = layoutResearch(data, category);
      const expected = [...data.nodes.values()].filter((n) => n.category === category);
      expect(l.nodes).toHaveLength(expected.length);
      for (let i = 0; i < l.nodes.length; i++)
        for (let j = i + 1; j < l.nodes.length; j++) {
          const a = l.nodes[i]!;
          const b = l.nodes[j]!;
          expect(hit({ x: a.x, y: a.y, w: RN_W, h: RN_H }, { x: b.x, y: b.y, w: RN_W, h: RN_H }), `${a.id} / ${b.id}`).toBe(false);
        }
      const pos = new Map(l.nodes.map((n) => [n.id, n]));
      for (const e of l.edges) expect(pos.get(e.to)!.x).toBeGreaterThan(pos.get(e.from)!.x);
      const links = expected.reduce((s, n) => s + n.parents.filter((p) => data.nodes.get(p)?.category === category).length, 0);
      expect(l.edges).toHaveLength(links);
    });
  }

  it("comme en jeu : enfants dans l'ordre des données, de haut en bas", () => {
    const l = layoutResearch(data, "Production");
    const y = new Map(l.nodes.map((n) => [n.id, n.y]));
    for (const parent of ["sawmill", "diesel-refining", "mineshaft-drill", "research-station-2"]) {
      const kids = data.nodes.get(parent)!.children.filter((c) => data.nodes.get(c)!.parents.length === 1);
      const ys = kids.map((k) => y.get(k)!);
      expect(ys, parent).toEqual([...ys].sort((a, b) => a - b));
    }
  });

  it("comme en jeu : la ligne principale Production → … → Quarry est droite", () => {
    const l = layoutResearch(data, "Production");
    const y = new Map(l.nodes.map((n) => [n.id, n.y]));
    const line = ["production", "water-pump", "oil-extraction", "oil-refining", "diesel-refining", "quarry"].map((id) => y.get(id));
    expect(new Set(line).size).toBe(1);
  });

  it("couleurs du jeu : débloquée, disponible, trop chère, verrouillée", () => {
    const n = data.nodes.get("craft-assembler")!;
    const none = { unlocked: new Set<string>() };
    const parents = { unlocked: new Set(["water-pump", "modular-tree-farm", "sawmill"]) };
    expect(nodeState(data, none, n, null)).toBe("locked");
    expect(nodeState(data, parents, n, null)).toBe("available");
    expect(nodeState(data, parents, n, 100)).toBe("expensive");
    expect(nodeState(data, { unlocked: new Set([...parents.unlocked, n.id]) }, n, 100)).toBe("done");
  });

  it("le SVG et la fiche décrivent la recherche et ses bâtiments", () => {
    const p = { unlocked: new Set<string>() };
    const svg = renderResearchSvg(data, p, layoutResearch(data, "Production"), "craft-assembler", null);
    expect(svg).toContain('data-rs="craft-assembler"');
    expect(svg).toMatch(/aria-label="Craft Assembler, 3\s000 RP, Prérequis manquants"/);
    const detail = renderNodeDetail(data, p, "craft-assembler", null);
    expect(detail).toContain("Combines two items to craft a more advanced one");
    expect(detail).toContain('data-rs-action="unlock-all"');
    expect(detail).toContain("Water Pump → Modular Tree Farm → Sawmill → Craft Assembler");
  });
});

describe("description des recherches (recopiée du jeu)", () => {
  it("une correction « description » s'applique et s'affiche ; texte vide refusé", () => {
    const src = { wiki: "saisie" as const, fetchedAt: "2026-10-12T09:00:00Z" };
    const text = "Unlocks several machines required for plastic production.";
    const { data: d, errors } = buildGameData(files, [{ research: { plastics: { description: { value: text, source: src } } } }]);
    expect(errors).toEqual([]);
    expect(d.nodes.get("plastics")!.description).toBe(text);
    const html = renderNodeDetail(d, { unlocked: new Set() }, "plastics", null);
    expect(html).toContain(text);
    expect(html).toContain("Recopiée du jeu le 2026-10-12");
    expect(html).toContain('data-rs-desc="plastics"');
    expect(buildGameData(files, [{ research: { plastics: { description: { value: "  ", source: src } } } }]).errors[0]).toMatch(/1 à 2000/);
    // Sans saisie : le formulaire invite à la recopier.
    expect(renderNodeDetail(data, { unlocked: new Set() }, "plastics", null)).toContain("Recopier la description du jeu");
  });
});
