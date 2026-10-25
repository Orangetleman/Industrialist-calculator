// S33 : chaque paire de couleurs du site (texte sur fond) garde au moins 4,5:1, dans les deux thèmes (PLAN-PUBLIC.md § 3).
// Les jetons sont lus dans styles.css : changer une couleur sans garder le contraste fait échouer ce test.

/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lu sur le disque : Vitest vide les imports de CSS, même en « ?raw ».
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** Les jetons d'un bloc (`:root {` pour le thème clair, `:root[data-theme="dark"] {` pour le sombre). */
function tokens(head: string): Record<string, string> {
  const at = css.indexOf(head);
  const body = css.slice(at + head.length, css.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}
const light = tokens(":root {");
const dark = { ...light, ...tokens(':root[data-theme="dark"] {') };

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// [texte, fond] : les paires qu'utilise la feuille de style.
const PAIRS: [string, string][] = [
  ["ink", "bg"], ["ink", "surface"], ["muted", "bg"], ["muted", "surface"],
  ["accent", "surface"], ["on-accent", "accent"], ["ink", "accent-soft"], ["ink", "steel-soft"],
  ["warn", "surface"], ["warn", "bg"], ["warn", "warn-soft"], ["ink", "warn-soft"],
  ["bad", "surface"], ["ok", "surface"], ["steel", "surface"],
];

describe("contrastes (S33)", () => {
  it("le dark redéfinit bien les jetons", () => {
    expect(dark.bg).not.toBe(light.bg);
    expect(dark["on-accent"]).toBeDefined();
  });
  for (const [name, theme] of [["clair", light], ["sombre", dark]] as const)
    for (const [fg, bg] of PAIRS)
      it(`${name} : --${fg} sur --${bg} ≥ 4,5:1`, () => {
        expect(theme[fg], fg).toBeDefined();
        expect(theme[bg], bg).toBeDefined();
        expect(ratio(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(4.5);
      });
  it("les deux défauts relevés en S16 sont corrigés", () => {
    expect(ratio(dark["on-accent"]!, dark.accent!)).toBeGreaterThan(6); // était 2,4:1 (texte blanc)
    expect(ratio(light.warn!, light["warn-soft"]!)).toBeGreaterThan(5); // était 3,9:1
  });
});
