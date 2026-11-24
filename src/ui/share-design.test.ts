import { describe, expect, it } from "vitest";
import { decodeDesign, designLink, encodeDesign, same } from "../engine/share/index.ts";
import type { Layout } from "../engine/sandbox/layout.ts";
import type { DesignGraph } from "../engine/share/index.ts";
import { DEFAULT_SETTINGS } from "./state.ts";
import { assembleDesign, checkNotes, designFacts, DISCORD_MAX, freeName, hasSandbox, linkAdvice, miniLayout, olderSite, readShareHash, shareErrorKey } from "./share-design.ts";

const graph = (touched = true): DesignGraph => ({
  sig: "objet|crankshaft",
  touched,
  solved: null,
  graph: {
    nodes: [
      { id: "n1", recipeId: "crankshaft", machines: 2, x: 0, y: 0 },
      { id: "n2", recipeId: "iron-ingot", machines: 1.5, x: 300, y: 120 },
    ],
    edges: [{ id: "n2>n1:iron-ingot", from: "n2", to: "n1", item: "iron-ingot" }],
    target: null,
    rate: 60,
  },
} as unknown as DesignGraph);
const bac: Layout = { blocks: [{ u: 1, id: "conveyor", x: 0, y: 0, r: 1 }], wires: [], routes: [], fills: {} };

describe("assemblage du design (P2)", () => {
  it("rassemble réglages, graphe retouché et bac à sable, sans toucher à l'état du site", () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    const g = graph(), sb = structuredClone(bac);
    const before = JSON.stringify([settings, g, sb]);
    const d = assembleDesign({ site: "1.2.3", name: "Mon plan", settings, graph: g, sandbox: sb, withSandbox: true });
    expect(d).toEqual({ site: "1.2.3", name: "Mon plan", settings, graph: g, sandbox: sb });
    // Copies : modifier le design ne modifie pas le site.
    (d.settings as { rate: number }).rate = 1;
    d.graph!.graph.nodes[0]!.x = 999;
    d.sandbox!.blocks.pop();
    expect(JSON.stringify([settings, g, sb])).toBe(before);
  });
  it("laisse le graphe s'il n'a pas été retouché (il se recalcule à l'identique)", () => {
    expect(assembleDesign({ site: "", settings: {}, graph: graph(false), sandbox: null, withSandbox: true }).graph).toBeUndefined();
    expect(assembleDesign({ site: "", settings: {}, graph: null, sandbox: null, withSandbox: true }).graph).toBeUndefined();
  });
  it("bac à sable : seulement coché et non vide", () => {
    expect(assembleDesign({ site: "", settings: {}, graph: null, sandbox: bac, withSandbox: false }).sandbox).toBeUndefined();
    expect(assembleDesign({ site: "", settings: {}, graph: null, sandbox: { blocks: [], wires: [] }, withSandbox: true }).sandbox).toBeUndefined();
    expect(hasSandbox({ blocks: [], wires: [] })).toBe(false);
    expect(hasSandbox(bac)).toBe(true);
    expect(hasSandbox(null)).toBe(false);
  });
  it("aller-retour par le lien : le design reçu est celui envoyé", async () => {
    const d = assembleDesign({ site: "1.0.0", name: "Vilebrequin", settings: { ...structuredClone(DEFAULT_SETTINGS), rate: 90 }, graph: graph(), sandbox: bac, withSandbox: true });
    const link = designLink("https://industrialist.myprisme.fr", await encodeDesign(d));
    const h = readShareHash(new URL(link).hash);
    expect(h?.kind).toBe("design");
    const back = await decodeDesign((h as { data: string }).data);
    expect(same(back.graph, d.graph)).toBe(true);
    expect(same(back.sandbox, d.sandbox)).toBe(true);
    expect(back.name).toBe("Vilebrequin");
    expect(back.settings.rate).toBe(90);
  });
});

describe("vérification de l'empreinte à l'ouverture (P3)", () => {
  const print = "0123456789abcdef";
  it("même version : alerte seulement si l'empreinte diffère, avec le conseil du fichier", () => {
    const d = { site: "0.2.0", print };
    expect(checkNotes(d, "0.2.0", null)).toEqual({ warn: [], info: "share.r.checking", advice: false });
    expect(checkNotes(d, "0.2.0", "identique")).toEqual({ warn: [], info: "share.r.same", advice: false });
    expect(checkNotes(d, "0.2.0", "partiel")).toEqual({ warn: [], info: "share.r.part", advice: false });
    expect(checkNotes(d, "0.2.0", "impossible")).toEqual({ warn: [], info: "share.r.unchecked", advice: false });
    expect(checkNotes(d, "0.2.0", "plan")).toEqual({ warn: ["share.r.diff.plan"], info: null, advice: true });
    expect(checkNotes(d, "0.2.0", "pose")).toEqual({ warn: ["share.r.diff.pose"], info: null, advice: true });
  });
  it("autre version : l'avertissement de la maquette, levé si l'usine est vérifiée identique", () => {
    const d = { site: "0.1.0", print };
    expect(checkNotes(d, "0.2.0", null)).toEqual({ warn: ["share.r.older"], info: "share.r.checking", advice: false });
    expect(checkNotes(d, "0.2.0", "pose")).toEqual({ warn: ["share.r.older", "share.r.diff.pose"], info: null, advice: true });
    expect(checkNotes(d, "0.2.0", "identique")).toEqual({ warn: [], info: "share.r.same.other", advice: false });
    expect(checkNotes({ ...d, site: "0.3.0" }, "0.2.0", null).warn).toEqual(["share.r.other"]);
  });
  it("sans empreinte (ancien lien) : mention neutre, alerte seulement si la version diffère", () => {
    expect(checkNotes({ site: "0.2.0" }, "0.2.0", null)).toEqual({ warn: [], info: "share.r.noprint", advice: false });
    expect(checkNotes({ site: "0.1.0" }, "0.2.0", null)).toEqual({ warn: ["share.r.older"], info: "share.r.noprint", advice: false });
  });
  it("ordre des versions", () => {
    expect(olderSite("0.9.0", "0.10.0")).toBe(true);
    expect(olderSite("1.0.0", "0.10.0")).toBe(false);
    expect(olderSite("0.1.0", "0.1.0")).toBe(false);
    expect(olderSite("", "0.1.0")).toBe(false);
  });
});

describe("lecture de l'adresse", () => {
  it("reconnaît un design, un ancien montage, ou rien", () => {
    expect(readShareHash("#d=1.abc_-")).toEqual({ kind: "design", data: "1.abc_-" });
    expect(readShareHash("d=9.zz")).toEqual({ kind: "design", data: "9.zz" }); // version future : l'erreur se dira à la lecture
    expect(readShareHash("#d=")).toEqual({ kind: "design", data: "" });
    expect(readShareHash("#bac/AAEC%2Bx%3D%3D")).toEqual({ kind: "ancien", code: "AAEC+x==" });
    expect(readShareHash("#bac/%E0%A4%A")).toEqual({ kind: "ancien", code: "%E0%A4%A" }); // mal échappé : tel quel
    expect(readShareHash("#bac")).toBeNull();
    expect(readShareHash("#bac/")).toBeNull();
    expect(readShareHash("#objet/pose")).toBeNull();
    expect(readShareHash("")).toBeNull();
  });
});

describe("noms libres dans les plans enregistrés", () => {
  it("ajoute (2), (3)… sans tenir compte des majuscules ni des espaces autour", () => {
    expect(freeName([], "Vilebrequin")).toBe("Vilebrequin");
    expect(freeName(["vilebrequin "], "Vilebrequin")).toBe("Vilebrequin (2)");
    expect(freeName(["Vilebrequin", "Vilebrequin (2)"], "Vilebrequin")).toBe("Vilebrequin (3)");
    expect(freeName(["Vilebrequin", "Vilebrequin (2)"], "Vilebrequin (2)")).toBe("Vilebrequin (3)");
    expect(freeName(["A"], "  B  ")).toBe("B");
  });
});

describe("longueur du lien (question B)", () => {
  it("passe sur Discord jusqu'à 1 900 caractères", () => {
    expect(DISCORD_MAX).toBe(1900);
    expect(linkAdvice(1900, null)).toEqual({ fits: true, sandboxOnly: false });
    expect(linkAdvice(1901, null)).toEqual({ fits: false, sandboxOnly: false });
  });
  it("trop long à cause du seul bac à sable : on propose le lien sans lui", () => {
    expect(linkAdvice(10_553, 954)).toEqual({ fits: false, sandboxOnly: true });
    expect(linkAdvice(10_553, 2_400)).toEqual({ fits: false, sandboxOnly: false });
  });
});

describe("fenêtre « Design partagé »", () => {
  it("résume le design et place l'aperçu dans son cadre", () => {
    const d = assembleDesign({ site: "", settings: {}, graph: graph(), sandbox: bac, withSandbox: true });
    expect(designFacts(d)).toEqual({ nodes: 2, blocks: 1 });
    expect(designFacts({ site: "", settings: {} })).toEqual({ nodes: null, blocks: null });
    expect(miniLayout(d, 200, 100, 10)).toEqual([{ x: 10, y: 10 }, { x: 190, y: 90 }]);
    expect(miniLayout({ site: "", settings: {} }, 200, 100)).toEqual([]);
  });
  it("chaque erreur de lien a son message", () => {
    expect(shareErrorKey("version-future")).toBe("share.err.version-future");
    expect(shareErrorKey("pas-un-lien")).toBe("share.err.pas-un-lien");
    expect(shareErrorKey(null)).toBe("share.err.abîmé");
  });
});
