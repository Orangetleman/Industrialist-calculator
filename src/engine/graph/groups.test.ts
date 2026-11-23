// Lot G5 : groupes repliables (prises mandataires, annulables, fichier) et échange avec Industrialist
// Calculator depuis l'éditeur (import en graphe, export, aller-retour sur leur graphe tutoriel « Gearbox »).
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
import gearbox from "../../ui/fixtures/pollywrath-gearbox-tutorial.json";
import { buildGameData, type RawFiles } from "../data.ts";
import {
  applyComparison,
  applyCommand,
  compareWithPlan,
  solveFromGraph,
  balanceGraph,
  collapsedOwners,
  emptyGraph,
  exportPollywrath,
  groupCommand,
  groupPorts,
  GraphHistory,
  liveGroups,
  membersOf,
  pollywrathToGraph,
  proxyMember,
  readGraphFile,
  writeGraphFile,
  type Graph,
  type PollywrathMapFile,
} from "./index.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as never]);
const world = { pollutionPct: 0 };
const map = mapJson as unknown as PollywrathMapFile;
const player = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };

/** Gearbox ← Crankshaft ← Steel Rod… : trois nœuds en chaîne. */
const chain = (): Graph => {
  let g = emptyGraph();
  const add = (id: string, recipeId: string, machines: number, x: number) => (g = applyCommand(g, { type: "addNode", node: { id, recipeId, machines, x, y: 0 } }, data, world));
  add("a", "craft_assembler_06", 30, 900); // Gearbox
  add("b", "craft_assembler_05", 30, 600); // Crankshaft
  g = applyCommand(g, { type: "addEdge", from: "b", to: "a", item: "crankshaft" }, data, world);
  return g;
};

describe("groupes repliables", () => {
  it("Grouper : au moins deux nœuds, un pas d'annulation, replier / déplier / renommer / dégrouper", () => {
    const g0 = chain();
    expect(groupCommand(g0, ["a"], (n) => `Groupe ${n}`)).toBeNull();
    const h = new GraphHistory(g0, data, world);
    h.apply(groupCommand(g0, ["a", "b"], (n) => `Groupe ${n}`)!);
    expect(liveGroups(h.graph)).toEqual([{ id: "g1", name: "Groupe 1" }]);
    expect(membersOf(h.graph, "g1")).toEqual(["a", "b"]);
    h.apply({ type: "setGroup", id: "g1", collapsed: true });
    expect([...collapsedOwners(h.graph)]).toEqual([["a", "g1"], ["b", "g1"]]);
    h.apply({ type: "setGroup", id: "g1", name: "Boîte de vitesses" });
    expect(h.graph.groups).toEqual([{ id: "g1", name: "Boîte de vitesses", collapsed: true }]);
    h.undo();
    h.undo();
    h.undo();
    expect(h.graph).toBe(g0);
    expect(h.graph.groups).toBeUndefined();
    h.redo();
    h.apply({ type: "ungroup", id: "g1" });
    expect(h.graph.groups).toBeUndefined();
    expect(h.graph.nodes.every((n) => !n.group)).toBe(true);
  });

  it("un nœud regroupé quitte son ancien groupe ; un groupe vidé disparaît, aussi par suppression", () => {
    let g = applyCommand(chain(), { type: "addNode", node: { id: "c", recipeId: "craft_assembler_05", machines: 1, x: 0, y: 300 } }, data, world);
    g = applyCommand(g, groupCommand(g, ["a", "b"], () => "A")!, data, world);
    g = applyCommand(g, groupCommand(g, ["b", "c"], () => "B")!, data, world);
    expect(liveGroups(g).map((x) => [x.id, membersOf(g, x.id)])).toEqual([
      ["g1", ["a"]],
      ["g2", ["b", "c"]],
    ]);
    g = applyCommand(g, { type: "removeNode", id: "a" }, data, world);
    expect(g.groups?.map((x) => x.id)).toEqual(["g2"]);
  });

  it("prises mandataires : ce que le groupe reçoit et donne au reste, pas ce qui circule dedans", () => {
    const g0 = chain();
    const bal = balanceGraph(g0, data, world);
    const g = applyCommand(g0, groupCommand(g0, ["a", "b"], () => "G")!, data, world);
    const p = groupPorts(g, bal, "g1");
    // Le Crankshaft va de b à a, dans le groupe : pas de prise mandataire pour lui.
    expect(p.ins.map((x) => x.item)).not.toContain("crankshaft");
    expect(p.outs.map((x) => x.item)).toEqual(["gearbox"]);
    // Les entrées sont celles des deux nœuds que le groupe ne se fournit pas, au débit voulu.
    const want = [...bal.nodes.get("a")!.ins, ...bal.nodes.get("b")!.ins].filter((x) => x.item !== "crankshaft");
    expect(p.ins.map((x) => x.item).sort()).toEqual([...new Set(want.map((x) => x.item))].sort());
    for (const x of p.ins) expect(x.perMin).toBeCloseTo(want.filter((w) => w.item === x.item).reduce((s, w) => s + w.perMin, 0), 9);
    // Une prise mandataire mène au nœud du groupe qui en manque.
    const item = p.ins[0]!.item;
    const ref = proxyMember(g, bal, "g1", item, "in");
    expect(ref && bal.nodes.get(ref.node)!.ins.some((x) => x.item === item)).toBe(true);
  });

  it("« Appliquer » (Recalculer) garde les groupes", () => {
    let g = chain();
    g = applyCommand(g, groupCommand(g, ["a", "b"], () => "G")!, data, world);
    g = applyCommand(g, { type: "setGroup", id: "g1", collapsed: true }, data, world);
    g = applyCommand(g, { type: "setTarget", id: "a" }, data, world);
    const plan = solveFromGraph(data, player, { ...g, rate: 60 }, { tiers: false }).plan!;
    const next = applyComparison(g, plan, compareWithPlan(g, plan));
    expect(next.groups).toEqual([{ id: "g1", name: "G", collapsed: true }]);
    expect(next.nodes.filter((n) => n.group === "g1").map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("fichier : groupes écrits et relus à l'identique", () => {
    let g = chain();
    g = applyCommand(g, groupCommand(g, ["a", "b"], () => "Gearbox")!, data, world);
    g = applyCommand(g, { type: "setGroup", id: "g1", collapsed: true }, data, world);
    const text = writeGraphFile(g);
    expect(readGraphFile(text).graph).toEqual(g);
    expect(writeGraphFile(readGraphFile(text).graph)).toBe(text);
  });
});

describe("Industrialist Calculator depuis l'éditeur", () => {
  const imp = pollywrathToGraph(gearbox, data, map, { world })!;

  it("leur graphe devient notre document : nœuds, positions, liaisons, cible ; sans équivalent : signalé", () => {
    expect(imp.name).toBe("Gearbox Tutorial");
    const known = gearbox.data.nodes.filter((n) => map.recipes[n.recipeId] && data.recipes.has(map.recipes[n.recipeId]!));
    expect(imp.graph.nodes).toHaveLength(known.length);
    expect(imp.unknown.reduce((s, u) => s + u.nodes, 0)).toBe(gearbox.data.nodes.length - known.length);
    for (const u of imp.unknown) expect(map.recipes[u.id]).toBeUndefined();
    // 21 arêtes sur 30 entre recettes connues (data/a-verifier.md, GRA-01), les autres comptées.
    expect(imp.graph.edges).toHaveLength(21);
    expect(imp.droppedEdges).toBe(9);
    expect(imp.graph.target?.item).toBe("gearbox");
    expect(imp.graph.rate).toBeGreaterThan(0);
    expect(imp.targetLost).toBe(false);
    // Positions et nombres de machines repris tels quels.
    const first = gearbox.data.nodes[0]!;
    expect(imp.graph.nodes[0]).toMatchObject({ machines: first.machineCount, x: first.position.x, y: first.position.y });
  });

  it("aller-retour : notre export relu par notre import redonne le même graphe", () => {
    const ex = exportPollywrath(imp.graph, data, map, { name: imp.name, now: 1_700_000_000_000 });
    expect(ex.missing).toEqual([]);
    expect(ex.droppedEdges).toBe(0);
    const back = pollywrathToGraph(JSON.parse(JSON.stringify(ex.save)), data, map, { world })!;
    expect(back.name).toBe(imp.name);
    expect(back.graph).toEqual(imp.graph);
    expect(back.unknown).toEqual([]);
    expect(back.droppedEdges).toBe(0);
  });

  it("pas leur format : null", () => {
    expect(pollywrathToGraph({ foo: 1 }, data, map)).toBeNull();
  });
});
