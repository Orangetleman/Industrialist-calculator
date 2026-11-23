// Lot G4 (PLAN-GRAPHE.md) : le graphe édité se raccorde au reste du site. Parcours de fin de lot : le
// plan Gearbox modifié à la main se recalcule (graphe → solveur, avant / après, Appliquer), se pose
// (usine) et s'exporte en .msch ; le graphe s'enregistre et se relit (rechargement, plans enregistrés).
import { describe, expect, it } from "vitest";
import energyJson from "../../data/energy.json";
import interfacesJson from "../../data/interfaces.json";
import itemsJson from "../../data/items.json";
import logisticsJson from "../../data/logistics.json";
import machinesJson from "../../data/machines.json";
import modularJson from "../../data/modular.json";
import overridesJson from "../../data/overrides.json";
import portsJson from "../../data/ports.json";
import powerJson from "../../data/power.json";
import recipesJson from "../../data/recipes.json";
import relevesJson from "../../data/releves.json";
import researchJson from "../../data/research.json";
import { buildCatalog } from "../engine/build/catalog.ts";
import { designFactory, factoryInput } from "../engine/build/factory.ts";
import { buildGameData, type RawFiles } from "../engine/data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../engine/extension-types.ts";
import { applyCommand, applyComparison, balanceGraph, compareWithPlan, planToGraph, solveFromGraph, type Graph } from "../engine/graph/index.ts";
import { buildSandboxCatalog } from "../engine/sandbox/index.ts";
import { layoutFromFactory } from "../engine/schematic/convert.ts";
import { fromCode, toCode } from "../engine/schematic/msch.ts";
import { solve } from "../engine/solve.ts";
import { graphMatchesPlan, keepLinks, linkSteps, linksSig, restoreLinks, loadGraphEdit, storeGraphEdit } from "./graph-edit.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as never]);
const player = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
const world = { pollutionPct: 0 };
const base = { tiers: false } as const;
const proposal = solve(data, player, { item: "gearbox", ratePerMin: 120, ...base });
const fluid = (id: string) => !!data.items.get(id)?.isFluid;

describe("graphe édité ↔ plan", () => {
  it("la proposition telle quelle correspond au plan ; chaque étape a son nœud", () => {
    const g = planToGraph(proposal).graph;
    expect(graphMatchesPlan(g, proposal)).toBe(true);
    const link = linkSteps(proposal, g);
    expect(link.size).toBe(proposal.steps.length);
    for (const s of proposal.steps) expect(g.nodes.find((n) => n.id === link.get(s.key))!.recipeId).toBe(s.recipeId);
  });

  it("un nœud ajouté à la main n'hérite pas de l'étape du plan de même recette ; Ctrl Z rend le lien", () => {
    const g = planToGraph(proposal).graph;
    const links = linkSteps(proposal, g);
    const step = proposal.steps[proposal.steps.length - 1]!;
    const id = links.get(step.key)!;
    const node = g.nodes.find((n) => n.id === id)!;
    // Supprimé, puis la même recette posée à la main (identifiant neuf, comme l'éditeur) : plus de lien.
    let e = applyCommand(g, { type: "removeNode", id }, data, world);
    e = applyCommand(e, { type: "addNode", node: { id: `n${g.nodes.length + 1}`, recipeId: node.recipeId, machines: 1, x: 0, y: 0 } }, data, world);
    const kept = keepLinks(links, proposal, e);
    expect(kept.has(step.key)).toBe(false);
    expect(kept.size).toBe(links.size - 1);
    expect(linkSteps(proposal, e).has(step.key)).toBe(true); // ce que faisait l'ancien lien par recette
    // Le nœud d'origine revenu (Ctrl Z) : son lien aussi.
    expect(keepLinks(links, proposal, g)).toEqual(links);
    // Un autre nœud supprimé : son lien tombe, les autres restent.
    const other = g.nodes.find((n) => n.recipeId !== node.recipeId)!;
    expect(keepLinks(links, proposal, applyCommand(g, { type: "removeNode", id: other.id }, data, world)).size).toBe(links.size - 1);
  });

  it("rechargé : les liens enregistrés reviennent, un nœud ajouté à la main reste sans étape", () => {
    const g = planToGraph(proposal).graph;
    const step = proposal.steps[proposal.steps.length - 1]!;
    const links = linkSteps(proposal, g);
    const id = links.get(step.key)!;
    const recipeId = g.nodes.find((n) => n.id === id)!.recipeId;
    let e = applyCommand(g, { type: "removeNode", id }, data, world);
    e = applyCommand(e, { type: "addNode", node: { id: `n${g.nodes.length + 1}`, recipeId, machines: 1, x: 0, y: 0 } }, data, world);
    const kept = keepLinks(links, proposal, e);
    const saved = { sig: "s", graph: e, solved: null, touched: true, links: Object.fromEntries(kept), linksFor: linksSig(proposal) };
    const back = loadGraphEdit(JSON.parse(JSON.stringify(storeGraphEdit(saved))))!;
    expect(back.links).toEqual(saved.links);
    expect(back.linksFor).toBe(linksSig(proposal));
    // Le nœud ajouté a les nombres de l'étape (le graphe correspond au plan) : toujours sans étape.
    const again = restoreLinks(proposal, back.graph, back.links, back.linksFor);
    expect(again.has(step.key)).toBe(false);
    expect(again.size).toBe(links.size - 1);
    // Sans liens enregistrés (ancien état) ou pour un autre plan (« Appliquer ») : par recette.
    expect(restoreLinks(proposal, back.graph, undefined, undefined).has(step.key)).toBe(true);
    expect(restoreLinks(proposal, back.graph, back.links, "autre").has(step.key)).toBe(true);
  });

  it("un nombre changé à la main : le plan ne suit plus le graphe (à recalculer)", () => {
    const g = planToGraph(proposal).graph;
    const n = g.nodes.find((x) => x.id === g.target!.node)!;
    const edited = applyCommand(g, { type: "setMachines", id: n.id, machines: n.machines - 5 }, data, world);
    expect(graphMatchesPlan(edited, proposal)).toBe(false);
    // Fixé (cadenas, fiche S62) : toujours à recalculer.
    expect(graphMatchesPlan(applyCommand(edited, { type: "setFixed", id: n.id, fixed: true }, data, world), proposal)).toBe(false);
    // Un déplacement ne compte pas.
    expect(graphMatchesPlan(applyCommand(g, { type: "move", moves: [{ id: n.id, x: 9999, y: 0 }] }, data, world), proposal)).toBe(true);
  });

  it("enregistré puis relu : le même graphe, le même graphe recalculé ; un état abîmé est écarté", () => {
    const g = planToGraph(proposal).graph;
    const e = { sig: "objet|gearbox|rate|120", graph: g, solved: g, touched: true };
    const back = loadGraphEdit(JSON.parse(JSON.stringify(storeGraphEdit(e))))!;
    expect(back.sig).toBe(e.sig);
    expect(back.graph).toEqual(g);
    expect(back.solved).toEqual(g);
    expect(back.touched).toBe(true);
    expect(loadGraphEdit(null)).toBeNull();
    expect(loadGraphEdit({ v: 2, sig: "x", graph: "{}" })).toBeNull();
    expect(loadGraphEdit({ v: 1, sig: "x", graph: "pas du json" })).toBeNull();
  });
});

describe("parcours G4 : Gearbox modifié à la main → Recalculer → Appliquer → usine → .msch", () => {
  it("se recalcule, se pose et s'exporte", async () => {
    // 1. Le joueur part de la proposition (120 Gearbox/min) et la modifie à la main :
    //    l'objectif fixé à 5 machines de moins (cadenas), et une étape amont supprimée.
    let g: Graph = planToGraph(proposal).graph;
    const target = g.nodes.find((n) => n.id === g.target!.node)!;
    const fixedN = target.machines - 5;
    const wantRate = (120 * fixedN) / target.machines;
    g = applyCommand(g, { type: "batch", commands: [{ type: "setMachines", id: target.id, machines: fixedN }, { type: "setFixed", id: target.id, fixed: true }] }, data, world);
    const upstream = g.edges.find((e) => e.to === target.id)!.from;
    const removed = g.nodes.find((n) => n.id === upstream)!.recipeId;
    g = applyCommand(g, { type: "removeNode", id: upstream }, data, world);
    expect(balanceGraph(g, data, world).shortages.length).toBeGreaterThan(0);
    expect(graphMatchesPlan(g, proposal)).toBe(false);

    // 2. « Recalculer » : la requête garde les recettes posées et le nombre fixé.
    const r = solveFromGraph(data, player, g, base);
    expect(r.request?.onlyRecipes).not.toContain(removed);
    const plan = r.plan!;
    expect(plan.status).not.toBe("impossible");
    // Le débit devient ce que les machines fixées permettent (120/min avec la proposition).
    expect(plan.target.ratePerMin).toBeCloseTo(wantRate, 4);
    expect(plan.steps.find((s) => s.recipeId === target.recipeId)!.machines).toBe(fixedN);

    // 3. Avant / après, puis « Appliquer » : le graphe suit le plan, les manques disparaissent.
    const cmp = compareWithPlan(g, plan);
    expect(cmp.nodes.find((c) => c.id === target.id)).toMatchObject({ before: fixedN, after: fixedN, fixed: true });
    expect(cmp.rate.after).toBeCloseTo(wantRate, 4);
    const next = applyComparison(g, plan, cmp);
    expect(next.rate).toBeCloseTo(wantRate, 4);
    expect(next.nodes.find((n) => n.id === target.id)!.fixed).toBe(true);
    expect(graphMatchesPlan(next, plan)).toBe(true);
    for (const s of plan.steps) expect(next.nodes.some((n) => n.recipeId === s.recipeId), s.recipeId).toBe(true);
    // Le même graphe recalculé redonne le même plan (rechargement de la page).
    const again = solveFromGraph(data, player, next, base).plan!;
    expect(again.target.ratePerMin).toBeCloseTo(plan.target.ratePerMin, 6);
    expect(again.steps.map((s) => [s.recipeId, s.machines])).toEqual(plan.steps.map((s) => [s.recipeId, s.machines]));

    // 4. Se pose : l'usine du plan recalculé.
    const ports = portsJson as unknown as PortsFile;
    const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
    const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
    const f = designFactory(factoryInput(plan, { name, isFluid: fluid, machine: (id) => data.machines.get(id) ?? null, ports: ports.machines }, cat, { w: 160, h: 110 }, { priority: ["forme", "place", "prix", "pieces"] }));
    const posed = f.boxes.filter((b) => b.mod).map((b) => b.key);
    expect(posed.length).toBeGreaterThan(0);
    const final = plan.steps.find((s) => s.recipeId === target.recipeId)!;
    expect(posed).toContain(final.key);

    // 5. S'exporte en .msch (code du schéma relu à l'identique).
    const sb = buildSandboxCatalog(data, { ports, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson });
    const c = layoutFromFactory(f, sb, cat, fluid);
    expect(c.layout.blocks.length).toBeGreaterThan(0);
    const back = await fromCode(await toCode({ name: "Gearbox", description: "", labels: [], width: c.width, height: c.height, layout: c.layout }));
    expect(back.layout.blocks.map(({ id, x, y, r }) => [id, x, y, r])).toEqual(c.layout.blocks.map(({ id, x, y, r }) => [id, x, y, r]));

    // 6. Le graphe recalculé s'enregistre avec le plan et se relit.
    const stored = storeGraphEdit({ sig: `objet|gearbox|rate|${wantRate}`, graph: next, solved: next, touched: true });
    const read = loadGraphEdit(JSON.parse(JSON.stringify(stored)))!;
    expect(graphMatchesPlan(read.solved!, plan)).toBe(true);
  }, 180000);
});
