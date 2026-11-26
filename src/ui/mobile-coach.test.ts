// Tutoriel au téléphone (MB10) : répartition des leçons et suite proposée.
import { describe, expect, it } from "vitest";
import { fr } from "../i18n/fr.ts";
import { LESSONS, nextLesson } from "./mobile-coach.ts";

describe("leçons", () => {
  it("huit leçons de trois gestes, chacune avec son nom et ses consignes", () => {
    expect(LESSONS).toHaveLength(8);
    for (const l of LESSONS) {
      expect(l.steps).toHaveLength(3);
      expect(fr).toHaveProperty(`coach.${l.id}`);
      for (const s of l.steps) expect(fr).toHaveProperty(`coach.${l.id}.${s.key}`);
    }
  });
  it("la suite : la leçon suivante pas encore faite, en reprenant au début ; rien quand tout est vu", () => {
    expect(nextLesson("plan", new Set(["plan"]))).toBe("usine");
    expect(nextLesson("plan", new Set(["plan", "usine", "vues"]))).toBe("schema");
    expect(nextLesson("recettes", new Set(["recettes"]))).toBe("plan");
    expect(nextLesson("plan", new Set(LESSONS.map((l) => l.id)))).toBeNull();
  });
});
