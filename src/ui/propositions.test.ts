// Page « Propositions » (S36) : texte dans la langue du visiteur, votes comme sur Reddit, tri et recherche.
import { describe, expect, it } from "vitest";
import { askedBy, filterSubjects, nextVote, sendVote, shown, withVote, type Subject } from "./propositions.ts";

const sujet = (s: Partial<Subject> = {}): Subject => ({
  id: 1,
  titre: "Partager un plan par un lien",
  titre_en: null,
  description: null,
  description_en: null,
  reponse: null,
  reponse_en: null,
  auto: [],
  etat: "propose",
  maj: null,
  cree: 0,
  demandes: 2,
  pour: 3,
  contre: 1,
  score: 4,
  monVote: 0,
  ...s,
});

describe("texte d'un sujet selon la langue", () => {
  it("prend la langue du visiteur, sinon l'autre, marquée", () => {
    expect(shown(sujet(), "titre", "fr")).toEqual({ text: "Partager un plan par un lien", auto: false, other: null, original: null });
    expect(shown(sujet(), "titre", "en")).toEqual({ text: "Partager un plan par un lien", auto: false, other: "fr", original: null });
    expect(shown(sujet({ titre: "", titre_en: "Share a plan" }), "titre", "fr")).toMatchObject({ text: "Share a plan", other: "en" });
    expect(shown(sujet(), "description", "fr")).toBeNull();
  });
  it("signale une traduction automatique pas encore relue, avec l'original", () => {
    const s = sujet({ titre_en: "Share a plan with a link", auto: ["titre_en"] });
    expect(shown(s, "titre", "en")).toEqual({ text: "Share a plan with a link", auto: true, other: null, original: "Partager un plan par un lien" });
    expect(shown(s, "titre", "fr")).toMatchObject({ auto: false });
  });
});

describe("votes comme sur Reddit", () => {
  it("un 2ᵉ clic retire le vote, l'autre bouton le change", () => {
    expect(nextVote(0, 1)).toBe(1);
    expect(nextVote(1, 1)).toBe(0);
    expect(nextVote(1, -1)).toBe(-1);
    expect(nextVote(-1, -1)).toBe(0);
  });
  it("recompte le score tout de suite (remarques + ▲ − ▼)", () => {
    const s = sujet();
    expect(withVote(s, 1)).toMatchObject({ pour: 4, contre: 1, score: 5, monVote: 1 });
    expect(withVote(withVote(s, 1), -1)).toMatchObject({ pour: 3, contre: 2, score: 3, monVote: -1 });
    expect(withVote(withVote(s, -1), 0)).toMatchObject({ pour: 3, contre: 1, score: 4, monVote: 0 });
    expect(askedBy(s)).toBe(5);
  });
  it("envoie l'identifiant de vote et rend les codes du service", async () => {
    const vus: RequestInit[] = [];
    const ok = (async (_u: string, init: RequestInit) => {
      vus.push(init);
      return new Response(JSON.stringify({ id: 1, demandes: 2, pour: 4, contre: 1, score: 5, monVote: 1 }));
    }) as unknown as typeof fetch;
    expect(await sendVote(1, 1, ok, "votant-aaaaaaaaaaaaaaaa")).toEqual({ ok: true, demandes: 2, pour: 4, contre: 1, score: 5, monVote: 1 });
    expect(JSON.parse(vus[0]!.body as string)).toEqual({ votant: "votant-aaaaaaaaaaaaaaaa", valeur: 1 });
    const refus = (async () => new Response(JSON.stringify({ erreur: "deja-compte" }), { status: 409 })) as unknown as typeof fetch;
    expect(await sendVote(1, 1, refus, "votant-aaaaaaaaaaaaaaaa")).toEqual({ ok: false, code: "deja-compte" });
    const panne = (async () => {
      throw new Error("x");
    }) as unknown as typeof fetch;
    expect(await sendVote(1, 1, panne, "votant-aaaaaaaaaaaaaaaa")).toEqual({ ok: false, code: "reseau" });
  });
});

describe("recherche et tri", () => {
  const liste = [
    sujet({ id: 1, titre: "Turbine modulaire", score: 3, maj: 10 }),
    sujet({ id: 2, titre: "Partager un plan", titre_en: "Share a plan", score: 9, maj: 5 }),
    sujet({ id: 3, titre: "Site en anglais", score: 20, etat: "fait", maj: 20 }),
  ];
  it("les plus demandées d'abord, les faits en bas ; ou les plus récentes", () => {
    expect(filterSubjects(liste, "", "", "score").map((s) => s.id)).toEqual([2, 1, 3]);
    expect(filterSubjects(liste, "", "", "recent").map((s) => s.id)).toEqual([1, 2, 3]);
  });
  it("cherche dans les deux langues, sans accents, et filtre par état", () => {
    expect(filterSubjects(liste, "share", "", "score").map((s) => s.id)).toEqual([2]);
    expect(filterSubjects(liste, "modulaire turbine", "", "score").map((s) => s.id)).toEqual([1]);
    expect(filterSubjects(liste, "", "fait", "score").map((s) => s.id)).toEqual([3]);
  });
});
