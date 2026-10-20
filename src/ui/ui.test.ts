// Tests des parties pures de l'interface (sans navigateur).
import { describe, expect, it } from "vitest";
import itemsJson from "../../data/items.json";
import machinesJson from "../../data/machines.json";
import recipesJson from "../../data/recipes.json";
import researchJson from "../../data/research.json";
import { makeData, progress } from "../../tests/engine-helpers.ts";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import { emptySetup } from "../engine/research-balance.ts";
import { solve } from "../engine/solve.ts";
import { esc, fieldLabel, fmt, fmtDuration, fmtMF, parseInput } from "./format.ts";
import { FH, FW, LABEL_H, layoutFlow } from "./flow-layout.ts";
import { buildRows, buildSignature, criterionHint, CRITERION_TEXT, renderAnswer, renderBuildList, renderDetails, renderFlow, type ViewCtx } from "./plan-view.ts";
import { renderVerify } from "./render.ts";
import { currentRp, EMPTY_PLAYER, exportProgress, fitsPlot, parseOptional, parseProgressExport, plotOf, progressSummary, renderOwned, renderTree, sanitizeProgress, rpDelta, toEngineProgress, withRpRate } from "./progress.ts";
import { layoutResearch, RN_H, RN_W } from "./research-layout.ts";
import { nodeState, renderNodeDetail, renderResearchSvg } from "./research-view.ts";
import { moveBefore, moveItem } from "./prio-list.ts";
import { builtFor, CRITERIA, criteriaList, DEFAULT_SETTINGS, GOALS, isOverridesFile, loadSettings, mergeCorrections, pruneIntegratedCorrections, removeCorrection, setBuilt, setCorrection } from "./state.ts";

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
    const player = { pollutionPct: 12.5, money: 1000, rp: 500, rpPerSec: 2, rpAt: Date.parse("2026-10-12T09:00:00Z"), spendRp: true, gamePass: true, plotW: 120, plotH: 96, research: { ...emptySetup(), mode: "detaille" as const, groups: { rs1: [], rs2: [], rs3: [{ count: 4, items: ["crankshaft", "crankshaft"] }], rs4: [] } } };
    const file = JSON.parse(JSON.stringify(exportProgress(prog, player, new Date("2026-10-12T10:00:00Z"))));
    expect(parseProgressExport(d, file)).toEqual({ ok: true, progress: prog, player, history: null, dropped: 0, exportedAt: "2026-10-12T10:00:00.000Z" }); // ancien fichier, sans journal (S21)
  });

  it("les RP évoluent avec les RP/s ; changer la vitesse garde les RP accumulés", () => {
    const t0 = Date.parse("2026-10-12T09:00:00Z");
    const p = { pollutionPct: null, money: null, rp: 500, rpPerSec: 2, rpAt: t0, spendRp: false, gamePass: false, plotW: null, plotH: null, research: null };
    expect(currentRp(p, t0 + 60_000)).toBe(620); // + 2 RP/s × 60 s
    expect(currentRp({ ...p, rpPerSec: null }, t0 + 60_000)).toBe(500);
    expect(currentRp({ ...p, rp: null }, t0)).toBeNull();
    const q = withRpRate(p, 5, t0 + 60_000); // 620 RP acquis, puis 5 RP/s
    expect(q).toMatchObject({ rp: 620, rpPerSec: 5, rpAt: t0 + 60_000 });
    expect(currentRp(q, t0 + 120_000)).toBe(920);
  });

  it("S20 : avec les tiers de « Ma recherche », la vitesse baisse au-delà du seuil", () => {
    const t0 = Date.parse("2026-10-18T12:00:00Z");
    const p = { ...EMPTY_PLAYER, rp: 19273.5, rpPerSec: 50.4, rpAt: t0 };
    const tiers = [{ kind: "rs3" as const, rate: 50.4, cap: 76875 }];
    expect(currentRp(p, t0 + 600_000, tiers)).toBeCloseTo(19273.5 + 50.4 * 600, 6); // sous le seuil : ligne droite
    expect(currentRp(p, t0 + 86_400_000, tiers)!).toBeCloseTo(239307, -1); // 24 h : ≈ 239 300, pas 4,4 millions
    const q = withRpRate(p, 10, t0 + 86_400_000, tiers);
    expect(q.rp!).toBeCloseTo(239307, -1);
  });

  it("parcelle : le plan tient tel quel, tourné d'un quart de tour, ou pas", () => {
    expect(fitsPlot(60, 20, { w: 100, h: 50 })).toBe("oui");
    expect(fitsPlot(20, 60, { w: 100, h: 50 })).toBe("tourné");
    expect(fitsPlot(120, 13, { w: 100, h: 100 })).toBe("non");
    expect(plotOf({ ...EMPTY_PLAYER, plotW: 100 })).toBeNull(); // un seul côté : pas de vérification
  });

  it("coût en RP d'un changement de progression : ajoutées dépensées, retirées rendues", () => {
    expect(rpDelta(d, [], ["a", "b"])).toMatchObject({ spent: d.nodes.get("a")!.rp + d.nodes.get("b")!.rp });
    expect(rpDelta(d, ["a", "b"], ["a"]).spent).toBe(-d.nodes.get("b")!.rp);
    expect(rpDelta(d, ["a"], ["a"]).spent).toBe(0);
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

describe("schéma des flux (de gauche à droite)", () => {
  const items = ["crankshaft", "electric-motor", "lithium-battery-pack", "tire", "8x-microchip", "steel-plate"];
  for (const criterion of ["machines", "energy", "raw", "steps", "pollution", "cost"] as const) {
    it(`aucun chevauchement, flèches vers la droite, boucles repérées (priorité ${criterion})`, () => {
      for (const item of items) {
        const plan = solve(data, all, { item, ratePerMin: 60, criterion, tiers: false });
        const g = layoutFlow(plan, (id) => data.items.get(id)?.name ?? id);
        const known = new Set(plan.steps.map((st) => st.key));
        const extra = plan.unresolved.filter((u) => !known.has(u.item)).length + plan.existing.length;
        expect(g.nodes, item).toHaveLength(plan.steps.length + extra);
        const nodes = g.nodes.map((n) => ({ x: n.x, y: n.y, w: FW, h: FH }));
        const labels = g.edges.map((e) => ({ x: e.lx - e.lw / 2, y: e.ly - LABEL_H / 2, w: e.lw, h: LABEL_H }));
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) expect(hit(nodes[i]!, nodes[j]!), `${item} : nœuds ${i}/${j}`).toBe(false);
        // Les quantités ne se chevauchent jamais (« les nombres fusionnent ») ni ne cachent un bloc.
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) expect(hit(labels[i]!, labels[j]!), `${item} : étiquettes ${i}/${j}`).toBe(false);
        for (const l of labels) for (const n of nodes) expect(hit(l, n), `${item} : étiquette sur un bloc`).toBe(false);
        const col = new Map(g.nodes.map((n) => [n.id, n.col]));
        for (const e of g.edges) {
          if (e.loop) expect(plan.edges.some((x) => x.loop && x.from === e.from && x.to === e.to), `${item} ${e.from}→${e.to}`).toBe(true);
          else expect(col.get(e.from)!, `${item} ${e.from}→${e.to}`).toBeLessThan(col.get(e.to)!);
        }
        expect(g.edges).toHaveLength(plan.edges.length);
        expect(g.nodes.find((n) => n.id === item)?.kind, item).toBe("final");
      }
    });
  }

  it("un item non produit apparaît comme bloc « non produit », à gauche de son consommateur", () => {
    const d = makeData({ recipes: [{ id: "r", machine: "m", t: 10, in: { missing: 1 }, out: { x: 1 } }] });
    const plan = solve(d, progress(), { item: "x", ratePerMin: 6 });
    const g = layoutFlow(plan);
    const miss = g.nodes.find((n) => n.id === "missing")!;
    expect(miss.kind).toBe("unresolved");
    expect(miss.col).toBeLessThan(g.nodes.find((n) => n.id === "x")!.col);
  });
});

describe("vue d'un plan : réponse, liste de construction, schéma, détails", () => {
  const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy" });
  const v: ViewCtx = { data, plan, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet" };

  it("la réponse tient en une phrase et quatre chiffres", () => {
    const html = renderAnswer(v);
    expect(html).toMatch(/<h2>Pour 60 Crankshaft\/min : \d+ machines/);
    expect((html.match(/class="kpi"/g) ?? []).length).toBe(4);
    expect(html).toContain("À extraire");
  });

  it("liste de construction : chaque étape une fois, de l'extraction à l'objet final", () => {
    const rows = buildRows(v);
    const steps = rows.filter((r) => !r.key.includes(":"));
    expect(steps.map((r) => r.key).sort()).toEqual(plan.steps.map((s) => s.key).sort());
    const order = ["Extraction", "Transformation", "Produit final"];
    const stages = rows.map((r) => order.indexOf(r.stage)).filter((i) => i >= 0);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
    expect(rows.at(-1)).toMatchObject({ key: "crankshaft", stage: "Produit final" });
    const machines = rows.reduce((s, r) => s + (r.countText.startsWith("≈") ? 0 : r.count), 0);
    expect(machines).toBe(plan.totals.machines);
  });

  it("les cases cochées suivent le plan : même plan, même signature ; autres nombres, autre signature", () => {
    const rows = buildRows(v);
    const sig = buildSignature("objet", rows);
    expect(buildSignature("objet", buildRows({ ...v, plan: solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy" }) }))).toBe(sig);
    expect(buildSignature("objet", buildRows({ ...v, plan: solve(data, all, { item: "crankshaft", ratePerMin: 120, criterion: "energy" }) }))).not.toBe(sig);
    const html = renderBuildList(v, rows, new Set(["crankshaft"]));
    expect(html).toMatch(/data-built="crankshaft" checked/);
    expect(html).toContain(`1 ligne construite sur ${rows.filter((r) => r.buildable).length}`);
  });

  it("garde les cases cochées des plans récents seulement", () => {
    let store = { plans: [] as { sig: string; keys: string[] }[] };
    for (let i = 0; i < 40; i++) store = setBuilt(store, `p${i}`, ["a"]);
    expect(store.plans).toHaveLength(30);
    expect(store.plans[0]!.sig).toBe("p39");
    expect(builtFor(store, "p39").has("a")).toBe(true);
    expect(builtFor(setBuilt(store, "p39", []), "p39").size).toBe(0);
  });

  it("schéma et détails", () => {
    const f = renderFlow(v)!;
    expect(f.svg.startsWith("<svg")).toBe(true);
    expect((f.svg.match(/class="fn /g) ?? []).length).toBe(plan.steps.length);
    expect(f.svg).toContain('class="fn final"');
    const details = renderDetails(v);
    expect(details).toContain('data-force="crankshaft"');
    expect(details).toContain("Remarques sur le calcul");
  });

  it("échappe les noms venant des données", () => {
    const d = makeData({ recipes: [{ id: "r<x>", machine: "m", t: 10, out: { "<b>evil</b>": 1 } }] });
    const p = solve(d, progress(), { item: "<b>evil</b>", ratePerMin: 6 });
    const w: ViewCtx = { data: d, plan: p, settings: DEFAULT_SETTINGS, corrections: {}, goal: "objet" };
    const html = renderAnswer(w) + renderBuildList(w, buildRows(w), new Set()) + renderFlow(w)!.svg + renderDetails(w);
    expect(html).not.toContain("<b>evil</b>");
    expect(html).toContain("&lt;b&gt;evil&lt;/b&gt;");
  });
});

describe("priorité (critère) expliquée, par objectif", () => {
  it("chaque objectif propose ses priorités, avec un libellé et une explication", () => {
    for (const g of GOALS) {
      expect([...DEFAULT_SETTINGS.criteria[g]].sort()).toEqual([...CRITERIA[g]].sort()); // toutes, dans un ordre
      for (const c of CRITERIA[g]) expect(criterionHint(g, c)).toContain(CRITERION_TEXT[c].label);
    }
    expect(CRITERIA["énergie"]).not.toContain("energy");
    expect(CRITERIA["énergie"]).not.toContain("steps");
  });

  it("liste des priorités : complétée, sans doublon ni priorité hors sujet", () => {
    expect(criteriaList("énergie", ["cost", "energy", "cost"])).toEqual(["cost", "machines", "raw", "pollution", "area"]);
    expect(criteriaList("recherche", "nimporte")).toEqual(DEFAULT_SETTINGS.criteria.recherche);
  });

  it("reprend l'ancien critère unique comme priorité de l'objectif objet", () => {
    const store = new Map<string, string>([["ind-calc:v1:settings", JSON.stringify({ criterion: "cost", goal: "inconnu", criteria: { énergie: "energy" } })]]);
    const g = globalThis as { localStorage?: unknown };
    const before = g.localStorage;
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} };
    try {
      const st = loadSettings();
      expect(st.criteria.objet[0]).toBe("cost"); // l'ancien choix unique passe en tête
      expect(st.criteria.objet).toHaveLength(CRITERIA.objet.length);
      expect(st.criteria["énergie"]).toEqual(DEFAULT_SETTINGS.criteria["énergie"]); // « energy » n'a pas de sens pour l'objectif énergie
      expect(st.goal).toBe("objet");
      expect(st.useExisting).toBe(true);
    } finally {
      g.localStorage = before;
    }
  });
});

describe("liste à réordonner", () => {
  it("↑ ↓ : échange avec la voisine, sans sortir de la liste", () => {
    expect(moveItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
  it("glisser sur une ligne : prend sa place, vers le haut comme vers le bas", () => {
    expect(moveBefore(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveBefore(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveBefore(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });
});

describe("panneau « à vérifier »", () => {
  const plan = solve(data, all, { item: "crankshaft", finalMachines: 15, criterion: "energy" });
  it("propose une saisie pour les champs corrigeables", () => {
    const html = renderVerify({ data, plan, settings: DEFAULT_SETTINGS, corrections: {} });
    expect(html).toContain('data-id="craft_assembler_05"');
    expect(html).toContain('data-field="durationS"');
    expect(html).toContain("17,2");
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
