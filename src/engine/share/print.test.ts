// Lot P3 : l'empreinte d'un design. Stable pour un même design, différente dès qu'une machine, un bloc, une
// rotation, un tuyau ou un câble change, sans effet des textes affichés ni de l'ordre des listes.
import { describe, expect, it } from "vitest";
import { factoryPlan, planFor, settingsWith } from "../../../tests/share-designs.ts";
import { readFileSync } from "node:fs";
import type { FactoryPlan } from "../build/factory.ts";
import { decodeDesign, encodeDesign, SITE_VERSION, type Design } from "./codec.ts";
import { comparePrints, designPrint, hasPose, PRINT } from "./print.ts";

const plan = planFor("gearbox", 120);
const factory = factoryPlan(plan);
const print = designPrint(plan, factory);
const changed = (f: (x: FactoryPlan) => void) => {
  const x = structuredClone(factory);
  f(x);
  return designPrint(plan, x);
};

describe("empreinte", () => {
  it("stable : même design recalculé, plan seul ou avec la pose", () => {
    expect(print).toMatch(PRINT);
    expect(hasPose(print)).toBe(true);
    expect(designPrint(planFor("gearbox", 120), factoryPlan(plan, true))).toBe(print);
    expect(designPrint(plan)).toBe(print.slice(0, 8) + "00000000");
    expect(hasPose(designPrint(plan))).toBe(false);
  }, 300_000);

  it("les designs de référence ont chacun la leur", () => {
    const ps = [["gearbox", 120], ["crankshaft", 600], ["crankshaft", 3600]].map(([i, r]) => designPrint(planFor(i as string, r as number)));
    expect(new Set(ps).size).toBe(3);
    expect([["gearbox", 120], ["crankshaft", 600], ["crankshaft", 3600]].map(([i, r]) => designPrint(planFor(i as string, r as number)))).toEqual(ps);
  }, 120_000);

  it("ni les textes affichés ni l'ordre des listes ne comptent (joueur en anglais)", () => {
    const english = factoryPlan(plan, true, (id) => `EN ${id.split("").reverse().join("")}`);
    expect(english.boxes.map((b) => b.label)).not.toEqual(factory.boxes.map((b) => b.label));
    expect(designPrint(plan, english)).toBe(print);
    expect(changed((x) => {
      x.boxes.reverse();
      x.links.reverse();
      x.poleNodes.reverse();
      x.cells = new Map([...x.cells].reverse());
    })).toBe(print);
  }, 300_000);

  it("différente si une machine du plan change : recette, nombre, liaison", () => {
    const steps = structuredClone(plan.steps);
    steps[0]!.machines += 1;
    const more = designPrint({ steps, edges: plan.edges }, factory);
    expect(more.slice(0, 8)).not.toBe(print.slice(0, 8));
    expect(more.slice(8)).toBe(print.slice(8));
    expect(designPrint({ steps: plan.steps.slice(1), edges: plan.edges })).not.toBe(designPrint(plan));
    expect(designPrint({ steps: plan.steps, edges: plan.edges.slice(1) })).not.toBe(designPrint(plan));
  });

  it("différente si un bloc change d'une case, tourne, ou si un tuyau, un poteau ou un câble change", () => {
    const mod = factory.boxes.findIndex((b) => b.mod);
    const pipe = [...factory.cells].find(([, o]) => o.kind === "tuyau")![0];
    const all = [
      changed((x) => (x.boxes[0]!.x += 1)),
      changed((x) => (x.boxes[0]!.rot = (x.boxes[0]!.rot + 1) % 4)),
      changed((x) => (x.boxes[mod]!.mod!.machines[0]!.y += 1)),
      changed((x) => (x.boxes[mod]!.mod!.machines[0]!.rot = ((x.boxes[mod]!.mod!.machines[0]!.rot + 1) % 4) as 0)),
      changed((x) => x.boxes[mod]!.mod!.pieces.pop()),
      changed((x) => x.cells.delete(pipe)),
      changed((x) => (x.poleNodes[0]!.x += 1)),
      changed((x) => x.links.pop()),
    ];
    for (const p of all) expect(p.slice(0, 8)).toBe(print.slice(0, 8));
    expect(new Set([print, ...all]).size).toBe(all.length + 1);
  });

  it("calcul abrégé par sa limite de temps : pas de pose (elle dépend de l'ordinateur)", () => {
    expect(designPrint(plan, { ...factory, cut: true })).toBe(designPrint(plan));
  });

  it("comparaison à l'ouverture", () => {
    expect(comparePrints(undefined, print)).toBe("sans");
    expect(comparePrints(print, undefined)).toBe("sans");
    expect(comparePrints(print, print)).toBe("identique");
    expect(comparePrints(print, designPrint(plan))).toBe("partiel");
    expect(comparePrints(designPrint(plan), print)).toBe("partiel");
    expect(comparePrints(designPrint(plan), designPrint(plan))).toBe("partiel");
    expect(comparePrints(changed((x) => (x.W += 1)), print)).toBe("pose");
    expect(comparePrints(`ffffffff${print.slice(8)}`, print)).toBe("plan");
  });
});

describe("empreinte dans le lien", () => {
  const d: Design = { site: SITE_VERSION, name: "Gearbox", settings: settingsWith({ item: "gearbox", rate: 120 }) };

  it("aller-retour égal, une quinzaine de caractères de plus au pire", async () => {
    for (const p of [print, "0000000100000000", "ffffffffffffffff"]) expect(await decodeDesign(await encodeDesign({ ...d, print: p }))).toStrictEqual({ ...d, print: p });
    expect((await encodeDesign({ ...d, print })).length - (await encodeDesign(d)).length).toBeLessThan(16);
    await expect(encodeDesign({ ...d, print: "abc" })).rejects.toThrow();
  });

  it("les liens figés d'avant P3 n'en ont pas et se lisent", async () => {
    const lines = readFileSync(new URL("../../../tests/fixtures/liens-v1.txt", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect((await decodeDesign(l.split("\t")[1]!)).print).toBeUndefined();
  });
});
