// P2 bis : l'arbre « Mes designs » (noms uniques, corbeille, conflits façon Explorateur Windows).
import { describe, expect, it } from "vitest";
import { addDesign, addDir, BIN, contentOf, destroy, duplicate, emptyTree, find, folder, free, home, inBin, makeDesign, move, place, readTree, rename, ROOT, sorted, toBin, type Ask, type Choice, type Conflict, type DirNode, type Tree } from "./designs-model.ts";

const never: Ask = async () => { throw new Error("pas de question attendue"); };
const answer = (...xs: (Choice | [Choice, true])[]) => {
  const seen: Conflict[] = [];
  const ask: Ask = async (c) => {
    seen.push(c);
    const x = xs.shift();
    if (!x) throw new Error("question de trop");
    return Array.isArray(x) ? { choice: x[0], all: true } : { choice: x };
  };
  return { ask, seen };
};
const names = (d: DirNode) => sorted(d.kids).map((k) => k.name);
function sample(): Tree & { metal: DirNode; energie: DirNode } {
  const t = emptyTree();
  const metal = addDir(t, t.root, "Métal"), energie = addDir(t, t.root, "Énergie");
  addDesign(t, metal, "Vilebrequin", { d: "a" });
  addDesign(t, metal, "Essai", { d: "bb" });
  addDesign(t, energie, "Essai", { d: "c" });
  addDesign(t, t.root, "Essai", { d: "d" });
  return Object.assign(t, { metal, energie });
}
const child = (d: DirNode, name: string) => d.kids.find((k) => k.name === name)!;

describe("noms", () => {
  it("jamais deux fois le même nom dans un dossier (majuscules et espaces ignorés)", () => {
    const t = sample();
    expect(free(t.metal, " essai ")).toBe("essai (2)");
    expect(addDesign(t, t.metal, "Essai").name).toBe("Essai (2)");
    expect(addDesign(t, t.metal, "Essai (2)").name).toBe("Essai (3)");
    expect(addDir(t, t.root, "métal").name).toBe("métal (2)");
  });
  it("renommer : refusé si pris ou vide ; un nom choisi ne suit plus l'objectif", () => {
    const t = sample(), n = addDesign(t, t.metal, "Auto", { auto: true });
    expect(rename(t, n.id, "VILEBREQUIN ")).toBe("pris");
    expect(rename(t, n.id, "  ")).toBe("vide");
    expect(n.auto).toBe(true);
    expect(rename(t, n.id, " Mon plan ")).toBe("ok");
    expect(n).toMatchObject({ name: "Mon plan" });
    expect(n.auto).toBeUndefined();
    expect(rename(t, n.id, "mon PLAN")).toBe("ok"); // son propre nom, autre casse
    expect(rename(t, ROOT, "x")).toBe("vide");
  });
  it("dossiers d'abord, puis alphabétique avec les nombres dans l'ordre", () => {
    const t = emptyTree();
    for (const n of ["Plan 10", "Plan 2", "éclair"]) addDesign(t, t.root, n);
    addDir(t, t.root, "Zinc");
    expect(names(t.root)).toEqual(["Zinc", "éclair", "Plan 2", "Plan 10"]);
  });
  it("le dossier « Reçus » est réutilisé", () => {
    const t = sample();
    const r = folder(t, "Reçus");
    expect(folder(t, "reçus")).toBe(r);
  });
});

describe("corbeille", () => {
  it("garde tout sans question, se souvient du dossier, restaure à sa place", async () => {
    const t = sample(), v = child(t.metal, "Vilebrequin");
    expect(toBin(t, v.id)).toBe(true);
    expect(toBin(t, v.id)).toBe(false);
    expect(inBin(t, v.id)).toBe(true);
    expect(home(t, v)).toBe(t.metal);
    await move(t, v.id, home(t, v).id, never);
    expect(names(t.metal)).toEqual(["Essai", "Vilebrequin"]);
    expect(v.from).toBeUndefined();
  });
  it("dossier d'origine parti : retour à la racine", () => {
    const t = sample(), v = child(t.metal, "Vilebrequin");
    toBin(t, v.id);
    toBin(t, t.metal.id);
    expect(home(t, v)).toBe(t.root);
    destroy(t, t.metal.id);
    expect(home(t, v)).toBe(t.root);
  });
  it("mêmes noms dans la corbeille : numérotés ; supprimer n'agit que dans la corbeille", () => {
    const t = sample();
    const a = child(t.metal, "Essai"), b = child(t.energie, "Essai");
    toBin(t, a.id);
    toBin(t, b.id);
    expect(names(t.bin)).toEqual(["Essai", "Essai (2)"]);
    expect(destroy(t, child(t.metal, "Vilebrequin").id)).toBe(false);
    expect(destroy(t, a.id)).toBe(true);
    expect(find(t, a.id)).toBeNull();
    expect(toBin(t, BIN)).toBe(false);
  });
});

describe("conflits", () => {
  it("ni sur soi, ni dans soi-même, ni dans le même dossier", async () => {
    const t = sample(), sub = addDir(t, t.metal, "Sous");
    expect(await move(t, t.metal.id, sub.id, never)).toBeNull();
    expect(await move(t, sub.id, t.metal.id, never)).toBeNull();
    expect(await move(t, sub.id, t.energie.id, never)).toEqual({ done: 1, skipped: 0, cancelled: false });
  });
  it("remplacer : l'ancien part à la corbeille ; ignorer et annuler : rien ne bouge ; garder : numéroté", async () => {
    const t = sample(), e = child(t.root, "Essai"), old = child(t.metal, "Essai");
    expect(await move(t, e.id, t.metal.id, answer("skip").ask)).toEqual({ done: 0, skipped: 1, cancelled: false });
    expect(await move(t, e.id, t.metal.id, answer("cancel").ask)).toEqual({ done: 0, skipped: 0, cancelled: true });
    expect(child(t.root, "Essai")).toBe(e);
    t.active = old.id;
    await move(t, e.id, t.metal.id, answer("replace").ask);
    expect(child(t.metal, "Essai")).toBe(e);
    expect(inBin(t, old.id)).toBe(true);
    expect(t.active).toBe(e.id);
    const x = child(t.energie, "Essai");
    await move(t, x.id, t.metal.id, answer("keep").ask);
    expect(x.name).toBe("Essai (2)");
  });
  it("un arrivant (lien) qui n'est nulle part : posé, ou laissé dehors s'il est ignoré", async () => {
    const t = sample();
    const n = makeDesign(t, "Essai", { d: "z" });
    await place(t, n, null, t.metal, answer("skip").ask);
    expect(find(t, n.id)).toBeNull();
    await place(t, n, null, t.metal, answer("keep").ask);
    expect(names(t.metal)).toEqual(["Essai", "Essai (2)", "Vilebrequin"]);
  });
  it("fusionner des dossiers : chaque doublon repose la question, « pour les suivants » les règle tous", async () => {
    const t = sample(), a = addDir(t, t.root, "A"), b = addDir(t, t.root, "B"), src = addDir(t, a, "Lot"), dst = addDir(t, b, "Lot");
    for (const n of ["1", "2", "3"]) { addDesign(t, src, n, { d: "neuf" }); addDesign(t, dst, n, { d: "vieux" }); }
    addDesign(t, src, "seul");
    const { ask, seen } = answer("merge", "skip", ["replace", true]);
    expect(await move(t, src.id, b.id, ask)).toEqual({ done: 3, skipped: 1, cancelled: false });
    expect(seen.map((c) => [c.kind, c.left])).toEqual([["dossiers", 1], ["designs", 3], ["designs", 2]]);
    expect(names(dst)).toEqual(["1", "2", "3", "seul"]);
    expect(names(src)).toEqual(["1"]); // l'ignoré reste à sa place
    expect(find(t, src.id)?.parent).toBe(a);
    expect(t.bin.kids).toHaveLength(2);
  });
  it("fusion complète : le dossier vidé disparaît ; annuler garde ce qui est déjà posé", async () => {
    const t = sample(), a = addDir(t, t.root, "A"), src = addDir(t, a, "Métal");
    addDesign(t, src, "Neuf");
    await move(t, src.id, ROOT, answer("merge").ask);
    expect(find(t, src.id)).toBeNull();
    expect(names(t.metal)).toEqual(["Essai", "Neuf", "Vilebrequin"]);
    const s2 = addDir(t, a, "Métal");
    for (const n of ["Essai", "Vilebrequin"]) addDesign(t, s2, n);
    expect(await move(t, s2.id, ROOT, answer("merge", "keep", "cancel").ask)).toEqual({ done: 1, skipped: 0, cancelled: true });
    expect(names(s2)).toEqual(["Vilebrequin"]);
  });
});

describe("enregistrement", () => {
  it("relu à l'identique ; ids neufs jamais réutilisés", () => {
    const t = sample();
    t.active = child(t.metal, "Essai").id;
    t.base = "x";
    toBin(t, child(t.energie, "Essai").id);
    const { metal: _m, energie: _e, ...plain } = t;
    const back = readTree(JSON.parse(JSON.stringify(plain)))!;
    expect(back).toEqual({ ...plain, bin: { ...plain.bin, open: false } });
    expect(readTree({ ...JSON.parse(JSON.stringify(plain)), next: 0 })!.next).toBe(plain.next);
  });
  it("abîmé : refusé, ou seul l'élément abîmé est laissé de côté ; un design affiché disparu ne l'est plus", () => {
    expect(readTree(null)).toBeNull();
    expect(readTree({ v: 2 })).toBeNull();
    const t = JSON.parse(JSON.stringify(sample()));
    t.root.kids.push({ id: "x" }, { id: t.root.kids[0].id, type: "des", name: "doublon" }, null);
    t.active = 999;
    const r = readTree(t)!;
    expect(names(r.root)).toEqual(["Énergie", "Métal", "Essai"]);
    expect(r.active).toBeNull();
  });
  it("dupliquer prend un nom libre ; le travail en cours passe avant l'enregistrement", () => {
    const t = sample(), v = child(t.metal, "Vilebrequin");
    const c = duplicate(t, v.id, "Essai", "zz")!;
    expect([c.name, c.d]).toEqual(["Essai (2)", "zz"]);
    expect(contentOf({ ...c, w: "w" })).toBe("w");
    expect(contentOf(c)).toBe("zz");
    expect(duplicate(t, t.metal.id, "x", "y")).toBeNull();
  });
});
