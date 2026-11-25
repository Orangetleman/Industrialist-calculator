// Grille animée du calcul (téléphone) : ordre d'allumage des cases.
import { expect, it } from "vitest";
import { litAt } from "./mobile-gen.ts";

it("les cases s'allument du centre vers les bords, toutes entre 0 et 1", () => {
  const all = Array.from({ length: 15 * 21 }, (_, i) => litAt(i % 15, Math.floor(i / 15), 15, 21));
  expect(Math.min(...all)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...all)).toBeLessThanOrEqual(1);
  expect(litAt(7, 10, 15, 21)).toBeLessThan(0.2);
  expect(litAt(0, 0, 15, 21)).toBeGreaterThan(0.8);
});
