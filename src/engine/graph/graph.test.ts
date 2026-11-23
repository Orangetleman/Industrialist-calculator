// Modèle de l'éditeur de graphe (PLAN-GRAPHE.md, lot G1) : document et commandes annulables,
// équilibre en direct, plan → graphe, graphe → solve(), fichier, export Industrialist Calculator.
// Chaîne de référence : Gearbox 120/min, tout débloqué, pollution 0 (comme la maquette).
import { describe, expect, it } from "vitest";
import energyJson from "../../../data/energy.json";
import interfacesJson from "../../../data/interfaces.json";
import itemsJson from "../../../data/items.json";
import machinesJson from "../../../data/machines.json";
import modularJson from "../../../data/modular.json";
import overridesJson from "../../../data/overrides.json";
import mapJson from "../../../data/pollywrath-map.json";
import recipesJson from "../../../data/recipes.json";
import researchJson from "../../../data/research.json";
import { parsePollywrathSave, type PollywrathMap } from "../../ui/pollywrath-import.ts";
import { buildGameData, type RawFiles } from "../data.ts";
import { solve } from "../solve.ts";
import {
  applyCommand,
  applyComparison,
  balanceGraph,
  compareWithPlan,
  emptyGraph,
  exportPollywrath,
  GraphError,
  GraphHistory,
  graphToRequest,
  planToGraph,
  readGraphFile,
  recipePorts,
  solveFromGraph,
  writeGraphFile,
  type Graph,
} from "./index.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as never]);
const map = mapJson as unknown as PollywrathMap;
const player = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const world = { pollutionPct: 0 };
const plan = solve(data, player, { item: "gearbox", ratePerMin: 120, tiers: false });
const { graph, nodeOfStep } = planToGraph(plan);
const node = (g: Graph, recipeId: string) => g.nodes.find((n) => n.recipeId === recipeId)!;
const targetNode = graph.nodes.find((n) => n.id === graph.target?.node)!;

const errCode = (f: () => unknown): string | null => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof GraphError ? e.code : "autre";
  }
};

describe("plan → graphe", () => {
  it("une étape = un nœud (nombre exact), un flux entre étapes = une arête, la cible au débit voulu", () => {
    expect(plan.status).toBe("ok");
    expect(plan.unresolved).toEqual([]);
    expect(graph.nodes).toHaveLength(plan.steps.length);
    for (const s of plan.steps) {
      const n = graph.nodes.find((x) => x.id === nodeOfStep.get(s.key))!;
      expect(n.recipeId).toBe(s.recipeId);
      expect(n.machines).toBeCloseTo(s.machinesExact, 9);
    }
    const between = plan.edges.filter((e) => nodeOfStep.has(e.from) && nodeOfStep.has(e.to) && e.item !== "énergie");
    expect(graph.edges.length).toBe(new Set(between.map((e) => `${e.from}>${e.to}:${e.item}`)).size);
    expect(graph.target).toEqual({ node: nodeOfStep.get(plan.finals[0]!), item: "gearbox" });
    expect(graph.rate).toBe(120);
    // Disposition provisoire : l'objectif tout à droite.
    expect(targetNode.x).toBe(Math.max(...graph.nodes.map((n) => n.x)));
  });
});

describe("équilibre en direct", () => {
  const b = balanceGraph(graph, data, world);

  it("Gearbox 120/min : aucun manque sur la chaîne reliée, la cible sort 120/min", () => {
    expect(b.shortages).toEqual([]);
    expect(b.output!.item).toBe("gearbox");
    expect(b.output!.perMin).toBeCloseTo(120, 6);
    for (const nb of b.nodes.values()) expect(nb.problem).toBeNull();
  });

  it("les débits des arêtes sont ceux du solveur ; les excédents sont ses surplus", () => {
    for (const e of plan.edges) {
      const id = `${nodeOfStep.get(e.from)}>${nodeOfStep.get(e.to)}:${e.item}`;
      if (b.edges.has(id)) expect(b.edges.get(id)!).toBeCloseTo(e.perMin, 6);
    }
    const surplus = Object.fromEntries(plan.surplus.map((s) => [s.item, s.perMin]));
    for (const s of b.surpluses) expect(s.perMin).toBeCloseTo(surplus[s.item] ?? 0, 6);
    expect(b.surpluses.map((s) => s.item).sort()).toEqual(plan.surplus.filter((s) => s.perMin > 1e-7).map((s) => s.item).sort());
  });

  it("totaux : machines entières, énergie, prix, cases et pollution comme le plan", () => {
    expect(b.totals.machines).toBe(plan.totals.machines);
    expect(b.totals.farms).toBe(plan.totals.farms);
    expect(b.totals.energyMFps).toBeCloseTo(plan.totals.energyAvg, 3);
    expect(b.totals.cost).toBeCloseTo(plan.totals.buildCost, 3);
    expect(b.totals.area).toBeCloseTo(plan.totals.footprint, 3);
    expect(b.totals.pollutionPerHour).toBeCloseTo(plan.totals.pollutionPerHour[1], 6);
  });

  it("débit d'une prise = machines × quantité nette ÷ durée", () => {
    const n = targetNode;
    const r = data.recipes.get(n.recipeId)!;
    const nb = b.nodes.get(n.id)!;
    const [item, q] = Object.entries(r.inputs)[0]!;
    expect(nb.ins.find((p) => p.item === item)!.perMin).toBeCloseTo((n.machines * q!) / r.durationS! * 60, 9);
  });

  it("moitié moins de machines chez un fournisseur : manque de la moitié, chez son consommateur", () => {
    const e = graph.edges.find((x) => x.to === targetNode.id)!;
    const from = graph.nodes.find((n) => n.id === e.from)!;
    const g = applyCommand(graph, { type: "setMachines", id: from.id, machines: from.machines / 2 }, data, world);
    const b2 = balanceGraph(g, data, world);
    const need = b.nodes.get(targetNode.id)!.ins.find((p) => p.item === e.item)!.perMin;
    const gap = b2.shortages.find((s) => s.item === e.item)!;
    // Le fournisseur sert tous ses consommateurs au prorata : la cible n'en reçoit que la moitié si elle est seule.
    expect(gap.nodes).toContain(targetNode.id);
    const consumers = graph.edges.filter((x) => x.from === from.id && x.item === e.item).length;
    if (consumers === 1) expect(gap.perMin).toBeCloseTo(need / 2, 6);
    // Le doublement donne un excédent de ce produit ; le manque passe en amont (le fournisseur a besoin du double).
    const g3 = applyCommand(graph, { type: "setMachines", id: from.id, machines: from.machines * 2 }, data, world);
    const b3 = balanceGraph(g3, data, world);
    expect(b3.shortages.flatMap((s) => s.nodes)).toEqual(b3.shortages.map(() => from.id));
    expect(b3.shortages.length).toBeGreaterThan(0);
    expect(b3.surpluses.find((s) => s.item === e.item)!.perMin).toBeCloseTo(b.nodes.get(from.id)!.outs.find((p) => p.item === e.item)!.perMin, 6);
  });

  it("deux fournisseurs inégaux (70 / 30) pour la même entrée : pas de faux manque", () => {
    const e = graph.edges.find((x) => x.to === targetNode.id)!;
    const from = graph.nodes.find((n) => n.id === e.from)!;
    let g = applyCommand(graph, { type: "setMachines", id: from.id, machines: from.machines * 0.7 }, data, world);
    g = applyCommand(g, { type: "addNode", node: { recipeId: from.recipeId, machines: from.machines * 0.3, x: from.x, y: from.y + 400 } }, data, world);
    const twin = g.nodes.at(-1)!;
    // Le jumeau reçoit les mêmes entrées que le fournisseur d'origine, et sert les mêmes consommateurs.
    for (const x of graph.edges.filter((y) => y.from === from.id)) g = applyCommand(g, { type: "addEdge", from: twin.id, to: x.to, item: x.item }, data, world);
    for (const x of graph.edges.filter((y) => y.to === from.id)) g = applyCommand(g, { type: "addEdge", from: x.from, to: twin.id, item: x.item }, data, world);
    const b2 = balanceGraph(g, data, world);
    expect(b2.shortages).toEqual([]);
    expect(b2.output!.perMin).toBeCloseTo(120, 6);
  });

  it("entrée sans liaison = manque ; recette inconnue signalée, sans casser le reste", () => {
    const g = applyCommand(graph, { type: "removeEdge", id: graph.edges.find((x) => x.to === targetNode.id)!.id }, data, world);
    expect(balanceGraph(g, data, world).shortages.length).toBeGreaterThan(0);
    const bad: Graph = { ...graph, nodes: [...graph.nodes, { id: "zz", recipeId: "n-existe-pas", machines: 1, x: 0, y: 0 }] };
    const b2 = balanceGraph(bad, data, world);
    expect(b2.nodes.get("zz")!.problem).toBe("recette inconnue");
    expect(b2.shortages).toEqual([]);
  });
});

describe("commandes et historique", () => {
  const e0 = graph.edges.find((x) => x.to === targetNode.id)!;

  it("liaisons : seulement d'une sortie vers une entrée du même produit, sans doublon", () => {
    const g = applyCommand(graph, { type: "removeEdge", id: e0.id }, data, world);
    expect(errCode(() => applyCommand(g, { type: "addEdge", from: e0.to, to: e0.from, item: e0.item }, data, world))).toBe("pas-une-sortie");
    const otherIn = recipePorts(data, targetNode.recipeId).ins.find((i) => i !== e0.item)!;
    expect(errCode(() => applyCommand(g, { type: "addEdge", from: e0.from, to: e0.to, item: otherIn }, data, world))).toBe("pas-une-sortie");
    expect(errCode(() => applyCommand(g, { type: "addEdge", from: e0.from, to: e0.from, item: e0.item }, data, world))).toBe("même-nœud");
    const g2 = applyCommand(g, { type: "addEdge", from: e0.from, to: e0.to, item: e0.item }, data, world);
    expect(g2.edges.some((x) => x.id === e0.id)).toBe(true);
    expect(errCode(() => applyCommand(g2, { type: "addEdge", from: e0.from, to: e0.to, item: e0.item }, data, world))).toBe("arête-existe");
  });

  it("supprimer un nœud retire ses liaisons et la cible", () => {
    const g = applyCommand(graph, { type: "removeNode", id: targetNode.id }, data, world);
    expect(g.nodes.some((n) => n.id === targetNode.id)).toBe(false);
    expect(g.edges.some((x) => x.to === targetNode.id || x.from === targetNode.id)).toBe(false);
    expect(g.target).toBeNull();
    expect(errCode(() => applyCommand(g, { type: "removeNode", id: targetNode.id }, data, world))).toBe("nœud-inconnu");
  });

  it("remplacer la recette garde les liaisons compatibles et efface les réglages", () => {
    // Une autre recette qui produit le même objet que le fournisseur de la cible.
    const from = graph.nodes.find((n) => n.id === e0.from)!;
    const alt = (data.producers.get(e0.item) ?? []).find((r) => r.id !== from.recipeId && recipePorts(data, r.id).outs.includes(e0.item));
    expect(alt).toBeDefined();
    const withSettings = { ...graph, nodes: graph.nodes.map((n) => (n.id === from.id ? { ...n, settings: { écran: 2 } } : n)) };
    const g = applyCommand(withSettings, { type: "replaceRecipe", id: from.id, recipeId: alt!.id }, data, world);
    const n = g.nodes.find((x) => x.id === from.id)!;
    expect(n.recipeId).toBe(alt!.id);
    expect(n.settings).toBeUndefined();
    expect(g.edges.some((x) => x.id === e0.id)).toBe(true);
    const altIns = recipePorts(data, alt!.id).ins;
    for (const x of g.edges.filter((y) => y.to === from.id)) expect(altIns).toContain(x.item);
  });

  it("cible : produit principal par défaut, refus d'un produit absent ; débit", () => {
    const g = applyCommand(graph, { type: "setTarget", id: e0.from }, data, world);
    expect(g.target).toEqual({ node: e0.from, item: e0.item });
    expect(errCode(() => applyCommand(graph, { type: "setTarget", id: e0.from, item: "gearbox" }, data, world))).toBe("produit-absent");
    expect(applyCommand(graph, { type: "setRate", rate: 60 }, data, world).rate).toBe(60);
    expect(errCode(() => applyCommand(graph, { type: "setRate", rate: -1 }, data, world))).toBe("nombre-invalide");
  });

  it("mettre la chaîne à l'échelle : la cible et tout l'amont suivent ; un nœud fixé ne bouge pas", () => {
    const g = applyCommand(graph, { type: "scaleChain", id: targetNode.id, machines: targetNode.machines * 2 }, data, world);
    for (const n of graph.nodes) expect(node(g, n.recipeId).machines).toBeCloseTo(n.machines * 2, 9);
    expect(balanceGraph(g, data, world).output!.perMin).toBeCloseTo(240, 6);
    const fixed = applyCommand(graph, { type: "setFixed", id: e0.from, fixed: true }, data, world);
    const g2 = applyCommand(fixed, { type: "scaleChain", id: targetNode.id, machines: targetNode.machines * 2 }, data, world);
    expect(g2.nodes.find((n) => n.id === e0.from)!.machines).toBe(graph.nodes.find((n) => n.id === e0.from)!.machines);
  });

  it("annuler / rétablir ; un lot = un pas ; une commande refusée ne laisse pas de trace", () => {
    const h = new GraphHistory(emptyGraph(), data, world);
    expect(h.canUndo).toBe(false);
    const from = graph.nodes.find((n) => n.id === e0.from)!;
    h.apply({ type: "addNode", node: { recipeId: from.recipeId, machines: 2, x: 0, y: 0 } });
    h.apply({
      type: "batch",
      commands: [
        { type: "addNode", node: { recipeId: targetNode.recipeId, machines: 1, x: 300, y: 0 } },
        { type: "addEdge", from: "n1", to: "n2", item: e0.item },
        { type: "setTarget", id: "n2" },
      ],
    });
    expect(h.graph.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(h.graph.edges).toHaveLength(1);
    expect(() => h.apply({ type: "addEdge", from: "n1", to: "n2", item: e0.item })).toThrow(GraphError);
    expect(() => h.apply({ type: "batch", commands: [{ type: "setMachines", id: "n1", machines: 9 }, { type: "removeNode", id: "nx" }] })).toThrow(GraphError);
    expect(h.graph.nodes[0]!.machines).toBe(2);
    h.apply({ type: "move", moves: [{ id: "n1", x: 40, y: 50 }] });
    expect(h.graph.nodes[0]).toMatchObject({ x: 40, y: 50 });
    h.undo();
    expect(h.graph.nodes[0]).toMatchObject({ x: 0, y: 0 });
    h.undo();
    expect(h.graph.nodes).toHaveLength(1);
    expect(h.graph.target).toBeNull();
    h.redo();
    expect(h.graph.edges).toHaveLength(1);
    expect(h.graph.target).toEqual({ node: "n2", item: "gearbox" });
    h.undo();
    h.undo();
    expect(h.graph).toEqual(emptyGraph());
    expect(h.canUndo).toBe(false);
    h.apply({ type: "setRate", rate: 30 });
    expect(h.canRedo).toBe(false);
  });
});

describe("fichier maison", () => {
  it("aller-retour identique (texte et document)", () => {
    const g: Graph = { ...graph, nodes: graph.nodes.map((n, i) => (i === 0 ? { ...n, fixed: true, settings: { écran: 2 }, group: "g1" } : n)) };
    const text = writeGraphFile(g, "Gearbox");
    const back = readGraphFile(text);
    expect(back.warnings).toEqual([]);
    expect(back.name).toBe("Gearbox");
    expect(back.graph).toEqual(g);
    expect(writeGraphFile(back.graph, "Gearbox")).toBe(text);
  });

  it("lecture prudente : morceaux abîmés écartés et signalés ; version future et non-graphe refusés", () => {
    const raw = JSON.parse(writeGraphFile(graph));
    raw.graph.nodes.push({ id: "x", recipeId: 3, machines: 1 }, { ...raw.graph.nodes[0] });
    raw.graph.edges.push({ from: "n1", to: "fantôme", item: "gearbox" }, { from: "n1" }, { ...raw.graph.edges[0] });
    raw.graph.rate = "beaucoup";
    const r = readGraphFile(raw);
    expect(r.graph.nodes).toEqual(graph.nodes);
    expect(r.graph.edges).toEqual(graph.edges);
    expect(r.graph.rate).toBeNull();
    expect(r.warnings.map((w) => w.code).sort()).toEqual(["arête-abîmée", "arête-en-double", "arête-orpheline", "débit-abîmé", "id-en-double", "nœud-abîmé"]);
    expect(errCode(() => readGraphFile({ ...raw, version: 2 }))).toBe("version-future");
    expect(errCode(() => readGraphFile("{pas du json"))).toBe("pas-un-graphe");
    expect(errCode(() => readGraphFile({ nodes: [] }))).toBe("pas-un-graphe");
  });
});

describe("graphe → solve()", () => {
  it("requête : recettes du graphe imposées, objet et débit de la cible", () => {
    const r = graphToRequest(graph, data, { criterion: "machines", fixedMachines: { x: 1 } });
    expect(r.problems).toEqual([]);
    expect(r.request).toMatchObject({ item: "gearbox", ratePerMin: 120, criterion: "machines" });
    expect(r.request!.fixedMachines).toBeUndefined();
    expect(new Set(r.request!.onlyRecipes)).toEqual(new Set(plan.steps.map((s) => s.recipeId)));
    expect(graphToRequest({ ...graph, target: null }, data).problems).toEqual([{ code: "sans-cible" }]);
    expect(graphToRequest({ ...graph, rate: null }, data).request).toBeNull();
  });

  it("garde les nombres fixés ; avant / après par nœud ; Appliquer reste équilibré", () => {
    const e = graph.edges.find((x) => x.to === targetNode.id)!;
    const from = graph.nodes.find((n) => n.id === e.from)!;
    const n = Math.ceil(from.machines) + 3;
    let g = applyCommand(graph, { type: "setMachines", id: from.id, machines: n }, data, world);
    g = applyCommand(g, { type: "setFixed", id: from.id, fixed: true }, data, world);
    const res = solveFromGraph(data, player, g, { tiers: false });
    expect(res.request!.fixedMachines).toEqual({ [res.plan!.steps.find((s) => s.recipeId === from.recipeId)!.key]: n });
    const st = res.plan!.steps.find((s) => s.recipeId === from.recipeId)!;
    expect(st.machines).toBe(n);
    // Plus de machines au fournisseur : le débit monte.
    expect(res.plan!.target.ratePerMin).toBeGreaterThan(120);
    const cmp = compareWithPlan(g, res.plan!);
    expect(cmp.nodes.find((c) => c.id === from.id)).toMatchObject({ before: n, after: n, fixed: true });
    expect(cmp.added).toEqual([]);
    const t = cmp.nodes.find((c) => c.id === targetNode.id)!;
    expect(t.after!).toBeGreaterThan(t.before);
    const applied = applyComparison(g, res.plan!, cmp);
    expect(applied.nodes.find((x) => x.id === from.id)!.machines).toBe(n);
    expect(applied.rate).toBeCloseTo(res.plan!.target.ratePerMin, 9);
    const b = balanceGraph(applied, data, world);
    expect(b.shortages).toEqual([]);
    expect(b.output!.perMin).toBeCloseTo(res.plan!.target.ratePerMin, 6);
  });

  it("une étape retirée revient, signalée comme ajoutée par le solveur et reliée", () => {
    const leaf = graph.nodes.find((n) => !graph.edges.some((e) => e.to === n.id) && graph.edges.some((e) => e.from === n.id))!;
    const g = applyCommand(graph, { type: "removeNode", id: leaf.id }, data, world);
    const res = solveFromGraph(data, player, g, { tiers: false });
    const cmp = compareWithPlan(g, res.plan!);
    expect(cmp.added.map((a) => a.recipeId)).toContain(leaf.recipeId);
    const applied = applyComparison(g, res.plan!, cmp);
    const back = applied.nodes.find((n) => n.recipeId === leaf.recipeId)!;
    expect(back.added).toBe(true);
    expect(applied.edges.some((e) => e.from === back.id)).toBe(true);
    expect(balanceGraph(applied, data, world).shortages).toEqual([]);
    // Nœud inutilisé : gardé par défaut, retiré seulement sur demande.
    // Coal Drill : absente de la chaîne Gearbox (le solveur ne la prend pas).
    expect(plan.steps.some((s) => s.recipeId === "coal_drill_01")).toBe(false);
    const extra = applyCommand(graph, { type: "addNode", node: { recipeId: "coal_drill_01", machines: 1, x: 0, y: 900 } }, data, world);
    const res2 = solveFromGraph(data, player, extra, { tiers: false });
    const cmp2 = compareWithPlan(extra, res2.plan!);
    expect(cmp2.nodes.filter((c) => c.after === null).map((c) => c.recipeId)).toEqual(["coal_drill_01"]);
    expect(applyComparison(extra, res2.plan!, cmp2).nodes).toHaveLength(extra.nodes.length);
    expect(applyComparison(extra, res2.plan!, cmp2, { removeUnused: true }).nodes).toHaveLength(extra.nodes.length - 1);
  });
});

describe("export Industrialist Calculator", () => {
  const ex = exportPollywrath(graph, data, map, { name: "Gearbox", pollutionPct: 0, now: 1_700_000_000_000 });

  it("relu par notre import : même objet, même débit, mêmes recettes ; sans équivalent : signalé", () => {
    const back = parsePollywrathSave(JSON.parse(JSON.stringify(ex.save)), data, map);
    expect(back.item).toBe("gearbox");
    expect(back.ratePerMin).toBeCloseTo(120, 2);
    expect(back.graph.name).toBe("Gearbox");
    expect(back.graph.unknown).toEqual({});
    const exported = graph.nodes.filter((n) => !ex.missing.some((m) => m.node === n.id));
    expect(new Set(back.graph.recipes)).toEqual(new Set(exported.map((n) => n.recipeId)));
    for (const n of exported) expect(back.graph.theirs[n.recipeId]).toBeCloseTo(graph.nodes.filter((m) => m.recipeId === n.recipeId).reduce((s, m) => s + m.machines, 0), 9);
    for (const m of ex.missing) expect(Object.values(map.recipes)).not.toContain(m.recipeId);
    expect(ex.targetLost).toBe(false);
  });

  it("arêtes : rang de la prise dans la recette, chaque bout retombe sur le bon produit", () => {
    const inv = new Map(ex.save.data.nodes.flatMap((n) => (n.type === "recipe" ? [[n.id, data.recipes.get(map.recipes[n.recipeId]!)!] as const] : [])));
    expect(ex.save.data.edges.length + ex.droppedEdges).toBe(graph.edges.length);
    for (const e of ex.save.data.edges) expect(Object.keys(inv.get(e.source)!.outputs)[e.sourceIndex]).toBe(Object.keys(inv.get(e.target)!.inputs)[e.targetIndex]);
    expect(ex.save.data.nodes.filter((n) => n.type === "recipe" && n.isTarget)).toHaveLength(1);
  });

  it("une recette sans équivalent chez eux n'est jamais remplacée", () => {
    const ours = new Set(Object.values(map.recipes));
    const lonely = [...data.recipes.keys()].find((id) => !ours.has(id) && recipePorts(data, id).outs.length)!;
    const g = applyCommand(graph, { type: "addNode", node: { recipeId: lonely, machines: 1, x: 0, y: 0 } }, data, world);
    const ex2 = exportPollywrath(g, data, map, { now: 1 });
    expect(ex2.missing.map((m) => m.recipeId)).toContain(lonely);
    expect(ex2.save.data.nodes).toHaveLength(ex.save.data.nodes.length);
  });
});
