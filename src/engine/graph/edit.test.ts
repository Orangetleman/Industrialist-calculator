// Gestes d'édition du graphe (G3) : chaque geste du canevas passe par une fonction de edit.ts, testée
// ici ; puis le parcours « construire Gearbox à la main depuis un canevas vide ».
import { describe, expect, it } from "vitest";
import energyJson from "../../../data/energy.json";
import interfacesJson from "../../../data/interfaces.json";
import itemsJson from "../../../data/items.json";
import machinesJson from "../../../data/machines.json";
import modularJson from "../../../data/modular.json";
import overridesJson from "../../../data/overrides.json";
import recipesJson from "../../../data/recipes.json";
import researchJson from "../../../data/research.json";
import { buildGameData, type RawFiles } from "../data.ts";
import { ENERGY } from "../resources.ts";
import { solve } from "../solve.ts";
import {
  addRecipeCommand,
  applyCommand,
  balanceGraph,
  clickMode,
  countCommand,
  countFor,
  deleteCommand,
  emptyGraph,
  energyRecipes,
  freeSpot,
  freshId,
  GraphHistory,
  linkCommand,
  modeSource,
  needAt,
  parseCount,
  perMachine,
  planToGraph,
  recipeAlternatives,
  recipePorts,
  recipesFor,
  snapPort,
  stepCount,
  targetCommand,
  type Graph,
  type PortRef,
} from "./index.ts";

const files = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, interfaces: interfacesJson, modular: modularJson } as unknown as RawFiles;
const { data } = buildGameData(files, [overridesJson as never]);
const world = { pollutionPct: 0 };

const G0 = (): Graph => {
  let g = emptyGraph();
  g = applyCommand(g, { type: "addNode", node: { id: "a", recipeId: "craft_assembler_06", machines: 30, x: 600, y: 0 } }, data, world); // Gearbox
  g = applyCommand(g, { type: "addNode", node: { id: "b", recipeId: "craft_assembler_05", machines: 30, x: 300, y: 0 } }, data, world); // Crankshaft
  g = applyCommand(g, { type: "addEdge", from: "b", to: "a", item: "crankshaft" }, data, world);
  return g;
};

describe("modes temporaires (Alt / Maj / Ctrl), lus sur le clic", () => {
  it("la touche du clic l'emporte, puis la touche tenue, puis l'outil", () => {
    expect(clickMode({ altKey: true }, null, null)).toBe("del");
    expect(clickMode({ shiftKey: true }, null, "del")).toBe("target");
    expect(clickMode({ ctrlKey: true }, null, null)).toBe("multi");
    expect(clickMode({ metaKey: true }, null, null)).toBe("multi");
    expect(clickMode({}, "del", "target")).toBe("del");
    expect(clickMode({}, null, "link")).toBe("link");
    expect(clickMode({}, null, null)).toBeNull();
  });
  it("le rappel dit d'où vient le mode", () => {
    expect(modeSource("target", "del")).toEqual({ mode: "target", from: "key" });
    expect(modeSource(null, "del")).toEqual({ mode: "del", from: "tool" });
    expect(modeSource(null, null)).toBeNull();
  });
});

describe("recettes proposées (clic sur une ligne, palette)", () => {
  it("une entrée : les recettes qui la produisent ; une sortie : celles qui la consomment", () => {
    expect(recipesFor(data, "gearbox", "produce", world)).toContain("craft_assembler_06");
    const users = recipesFor(data, "steel-ingot", "consume", world);
    expect(users).toEqual(expect.arrayContaining(["roller_03", "press_03"]));
    for (const id of users) expect(recipePorts(data, id, world).ins).toContain("steel-ingot");
  });
  it("produit principal d'abord", () => {
    const list = recipesFor(data, "plastic-casing", "produce", world);
    expect(list.length).toBeGreaterThan(1);
    expect(list.slice(0, 2)).toEqual(expect.arrayContaining(["industrial_plastic_molder_02", "plastic_molding_machine_02"]));
  });
  it("onglet Énergie : des générateurs seulement", () => {
    const gen = energyRecipes(data);
    expect(gen.length).toBeGreaterThan(3);
    for (const id of gen) {
      const r = data.recipes.get(id)!;
      expect((r.energyMFps ?? 0) < 0 || Object.hasOwn(r.outputs, ENERGY)).toBe(true);
    }
  });
  it("remplacer la recette : les autres façons de faire le même produit", () => {
    const alts = recipeAlternatives(data, "industrial_plastic_molder_02", world);
    expect(alts).toEqual(expect.arrayContaining(["industrial_plastic_molder_02", "plastic_molding_machine_02"]));
  });
  it("assez de machines pour le débit demandé (valeurs de data/recipes.json)", () => {
    // Craft Assembler : 1 Gearbox en 15 s, soit 4 /min par machine.
    expect(perMachine(data, "craft_assembler_06", "gearbox", world)).toBeCloseTo(4);
    expect(countFor(data, "craft_assembler_06", "gearbox", 120, world)).toBeCloseTo(30);
  });
});

describe("ajouter une recette", () => {
  it("depuis une entrée : le producteur, relié, avec ce qui manque", () => {
    const g = G0();
    const port: PortRef = { node: "a", item: "plastic-casing", side: "in" };
    const bal = balanceGraph(g, data, world);
    const need = needAt(bal, port);
    expect(need).toBeCloseTo(240); // 30 machines × 2 Plastic Casing / 15 s
    const cmd = addRecipeCommand(data, "plastic_molding_machine_02", { id: "c", at: { x: 300, y: 300 }, from: { port, perMin: need }, world });
    const next = applyCommand(g, cmd, data, world);
    expect(next.edges.map((e) => e.id)).toContain("c>a:plastic-casing");
    const after = balanceGraph(next, data, world);
    expect(after.shortages.map((x) => x.item)).not.toContain("plastic-casing");
    expect(after.nodes.get("a")!.ins.find((x) => x.item === "plastic-casing")!.flow).toBeCloseTo(240);
  });
  it("depuis une sortie : un consommateur relié", () => {
    const g = applyCommand(emptyGraph(), { type: "addNode", node: { id: "s", recipeId: "press_03", machines: 2, x: 0, y: 0 } }, data, world);
    const port: PortRef = { node: "s", item: "steel-plate", side: "out" };
    const cmd = addRecipeCommand(data, "roller_04", { id: "r", at: { x: 400, y: 0 }, from: { port, perMin: needAt(balanceGraph(g, data, world), port) }, world });
    const next = applyCommand(g, cmd, data, world);
    expect(next.edges).toEqual([expect.objectContaining({ from: "s", to: "r", item: "steel-plate" })]);
    expect(balanceGraph(next, data, world).surpluses.map((x) => x.item)).not.toContain("steel-plate");
  });
  it("sans prise (palette) : une machine, pas de liaison ; une recette sans la prise voulue ne se relie pas", () => {
    expect(addRecipeCommand(data, "press_03", { id: "x", at: { x: 1, y: 2 } })).toEqual({ type: "addNode", node: { id: "x", recipeId: "press_03", machines: 1, x: 1, y: 2 } });
    const gen = energyRecipes(data)[0]!;
    const cmd = addRecipeCommand(data, gen, { id: "x", at: { x: 0, y: 0 }, from: { port: { node: "a", item: "plastic-casing", side: "in" }, perMin: 10 } });
    expect(cmd.type).toBe("addNode");
  });
  it("à une place libre, jamais sur un autre nœud", () => {
    const g = G0();
    const size = { w: 256, h: 150 };
    const sizeOf = () => size;
    expect(freeSpot(g, { x: 0, y: 400 }, size, sizeOf)).toEqual({ x: 0, y: 400 });
    const p = freeSpot(g, { x: 310, y: 10 }, size, sizeOf);
    for (const n of g.nodes) {
      const overlap = n.x < p.x + size.w && p.x < n.x + size.w && n.y < p.y + size.h && p.y < n.y + size.h;
      expect(overlap).toBe(false);
    }
  });
  it("identifiant jamais réutilisé, même après une suppression", () => {
    const g = G0();
    const a = freshId(g, 0);
    expect(a.id).toBe("n1");
    const b = freshId(g, a.seq);
    expect(b.id).toBe("n2");
  });
});

describe("relier des prises", () => {
  const g = (() => {
    let x = G0();
    x = applyCommand(x, { type: "addNode", node: { id: "c", recipeId: "plastic_molding_machine_02", machines: 3, x: 300, y: 300 } }, data, world);
    return x;
  })();
  it("une sortie vers une entrée du même produit, dans les deux sens du geste", () => {
    const out: PortRef = { node: "c", item: "plastic-casing", side: "out" };
    const inp: PortRef = { node: "a", item: "plastic-casing", side: "in" };
    expect(linkCommand(g, out, inp)).toEqual({ cmd: { type: "addEdge", from: "c", to: "a", item: "plastic-casing" } });
    expect(linkCommand(g, inp, out)).toEqual({ cmd: { type: "addEdge", from: "c", to: "a", item: "plastic-casing" } });
  });
  it("refusée vers un autre produit (la prise secoue en rouge), entre deux entrées, sur soi-même ou en double", () => {
    expect(linkCommand(g, { node: "c", item: "plastic-casing", side: "out" }, { node: "a", item: "crankshaft", side: "in" })).toEqual({ refused: "autre-produit" });
    expect(linkCommand(g, { node: "c", item: "plastic-pellets", side: "in" }, { node: "a", item: "crankshaft", side: "in" })).toEqual({ refused: "même-côté" });
    expect(linkCommand(g, { node: "b", item: "crankshaft", side: "out" }, { node: "b", item: "crankshaft", side: "in" })).toEqual({ refused: "même-nœud" });
    expect(linkCommand(g, { node: "b", item: "crankshaft", side: "out" }, { node: "a", item: "crankshaft", side: "in" })).toEqual({ refused: "existe" });
  });
  it("prise aimantée à 22 px : la plus proche dans le rayon, rien au-delà", () => {
    const ports = [
      { x: 100, y: 100, k: "p1" },
      { x: 130, y: 100, k: "p2" },
    ];
    expect(snapPort(ports, { x: 118, y: 104 }, 22)?.k).toBe("p2");
    expect(snapPort(ports, { x: 100, y: 121 }, 22)?.k).toBe("p1");
    expect(snapPort(ports, { x: 100, y: 130 }, 22)).toBeNull();
  });
});

describe("supprimer, cible, nombre", () => {
  it("supprimer un nœud emporte ses liaisons ; une liaison seule ; rien : pas de commande", () => {
    const g = G0();
    const a = applyCommand(g, deleteCommand(g, ["b"])!, data, world);
    expect(a.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(a.edges).toEqual([]);
    const e = applyCommand(g, deleteCommand(g, [], ["b>a:crankshaft"])!, data, world);
    expect(e.nodes).toHaveLength(2);
    expect(e.edges).toEqual([]);
    // Liaison et nœud ensemble : la liaison part avec le nœud, une seule commande.
    expect(applyCommand(g, deleteCommand(g, ["b"], ["b>a:crankshaft"])!, data, world).edges).toEqual([]);
    expect(deleteCommand(g, [], [])).toBeNull();
    expect(deleteCommand(g, ["zz"])).toBeNull();
  });
  it("Maj + clic marque la cible, un second l'efface ; sur une sortie, son produit", () => {
    const g = G0();
    const t = applyCommand(g, targetCommand(g, "a"), data, world);
    expect(t.target).toEqual({ node: "a", item: "gearbox" });
    expect(applyCommand(t, targetCommand(t, "a"), data, world).target).toBeNull();
    expect(applyCommand(t, targetCommand(t, "b", "crankshaft"), data, world).target).toEqual({ node: "b", item: "crankshaft" });
  });
  it("− / + d'un entier au suivant ; saisie à la française ; jamais sous 1", () => {
    expect(stepCount(3, 1)).toBe(4);
    expect(stepCount(3, -1)).toBe(2);
    expect(stepCount(2.4, 1)).toBe(4);
    expect(stepCount(2.4, -1)).toBe(2);
    expect(stepCount(1, -1)).toBe(1);
    expect(parseCount("2,5")).toBe(2.5);
    expect(parseCount(" 12 ")).toBe(12);
    expect(parseCount("0")).toBeNull();
    expect(parseCount("abc")).toBeNull();
    expect(parseCount("")).toBeNull();
  });
  it("« Mettre la chaîne à l'échelle » : l'amont suit au même rapport ; sinon le nœud seul", () => {
    const g = G0();
    const one = applyCommand(g, countCommand(g, "a", 15, false), data, world);
    expect(one.nodes.map((n) => n.machines)).toEqual([15, 30]);
    const chain = applyCommand(g, countCommand(g, "a", 15, true), data, world);
    expect(chain.nodes.map((n) => n.machines)).toEqual([15, 15]);
  });
});

describe("parcours : construire Gearbox à la main depuis un canevas vide", () => {
  // Le joueur suit notre proposition pour 120 Gearbox/min, mais pose tout lui-même : la recette du
  // Gearbox par « Ajouter », puis, de l'objectif vers l'amont, un clic sur chaque ligne d'entrée
  // (la recette proposée dans le sélecteur), ou une liaison tirée vers le nœud déjà posé ; enfin
  // il tape les nombres dans la bulle de chaque nœud.
  const plan = solve(data, { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 }, { item: "gearbox", ratePerMin: 120, tiers: false });
  const reference = planToGraph(plan).graph;

  it("Ajouter, cible, entrées → producteurs, liaisons, nombres : le même équilibre que la proposition, 120 Gearbox/min ; Ctrl Z jusqu'au vide", () => {
    const h = new GraphHistory(emptyGraph(), data, world);
    let seq = 0;
    let steps = 0;
    const apply = (cmd: Parameters<typeof h.apply>[0]) => {
      h.apply(cmd);
      steps++;
    };
    const size = { w: 256, h: 160 };
    const nodeOf = new Map<string, string>(); // étape du plan → nœud posé
    const goalKey = plan.finals.find((k) => plan.steps.find((s) => s.key === k)?.item === "gearbox")!;
    const goal = plan.steps.find((s) => s.key === goalKey)!;
    // 1. « Ajouter » : la palette, la recette du Gearbox ; Maj + clic : cible.
    const first = freshId(h.graph, seq);
    seq = first.seq;
    apply(addRecipeCommand(data, goal.recipeId, { id: first.id, at: { x: 0, y: 0 }, world }));
    nodeOf.set(goal.key, first.id);
    apply(targetCommand(h.graph, first.id));
    // 2. De l'objectif vers l'amont.
    const queue = [goal.key];
    const seen = new Set(queue);
    let links = 0;
    while (queue.length) {
      const key = queue.shift()!;
      const to = nodeOf.get(key)!;
      for (const e of plan.edges) {
        if (e.to !== key || e.from === key || e.item === ENERGY || !plan.steps.some((s) => s.key === e.from)) continue;
        const port: PortRef = { node: to, item: e.item, side: "in" };
        const have = nodeOf.get(e.from);
        if (!have) {
          // Clic sur la ligne d'entrée → la recette de la proposition, posée à une place libre et reliée.
          const step = plan.steps.find((s) => s.key === e.from)!;
          expect(recipesFor(data, e.item, "produce", world)).toContain(step.recipeId);
          const anchor = h.graph.nodes.find((n) => n.id === to)!;
          const at = freeSpot(h.graph, { x: anchor.x - 376, y: anchor.y }, size, () => size);
          const n = freshId(h.graph, seq);
          seq = n.seq;
          apply(addRecipeCommand(data, step.recipeId, { id: n.id, at, from: { port, perMin: needAt(balanceGraph(h.graph, data, world), port) }, world }));
          nodeOf.set(e.from, n.id);
        } else {
          // Le producteur est déjà posé : on tire une liaison de sa sortie vers cette entrée.
          const link = linkCommand(h.graph, { node: have, item: e.item, side: "out" }, port);
          if ("refused" in link) {
            expect(link.refused).toBe("existe");
            continue;
          }
          apply(link.cmd);
        }
        links++;
        if (!seen.has(e.from)) {
          seen.add(e.from);
          queue.push(e.from);
        }
      }
    }
    // 3. La bulle de chaque nœud : le nombre de la proposition, tapé.
    for (const s of plan.steps) {
      const id = nodeOf.get(s.key);
      expect(id, s.key).toBeDefined();
      apply(countCommand(h.graph, id!, reference.nodes.find((n) => n.id === planToGraph(plan).nodeOfStep.get(s.key))!.machines, false));
    }
    const built = h.graph;
    expect(built.nodes).toHaveLength(plan.steps.length);
    expect(built.edges).toHaveLength(reference.edges.length);
    expect(links).toBe(reference.edges.length);
    const bal = balanceGraph(built, data, world);
    const ref = balanceGraph(reference, data, world);
    expect(bal.output?.item).toBe("gearbox");
    expect(bal.output!.perMin).toBeCloseTo(120, 6);
    // Les mêmes manques que la proposition (aucun, ou ceux qu'elle laisse elle-même) ; rien de plus.
    const short = (b: typeof bal) => b.shortages.filter((x) => x.perMin > 1e-6).map((x) => x.item);
    expect(short(bal)).toEqual(short(ref));
    expect(bal.totals.machines).toBe(ref.totals.machines);
    // Aucun nœud sur un autre.
    for (const a of built.nodes)
      for (const b of built.nodes)
        if (a.id < b.id) expect(a.x < b.x + size.w && b.x < a.x + size.w && a.y < b.y + size.h && b.y < a.y + size.h, `${a.id}/${b.id}`).toBe(false);
    // 4. Ctrl Z jusqu'au début : le canevas redevient vide ; Ctrl Y refait tout.
    for (let i = 0; i < steps; i++) h.undo();
    expect(h.graph.nodes).toEqual([]);
    expect(h.canUndo).toBe(false);
    for (let i = 0; i < steps; i++) h.redo();
    expect(h.graph).toBe(built);
  });
});
