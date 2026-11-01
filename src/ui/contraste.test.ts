// S33 : chaque paire de couleurs du site (texte sur fond) garde au moins 4,5:1, dans les deux thèmes (PLAN-PUBLIC.md § 3).
// Les jetons sont lus dans styles.css : changer une couleur sans garder le contraste fait échouer ce test.

/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lu sur le disque : Vitest vide les imports de CSS, même en « ?raw ».
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** Les jetons d'un bloc (S59 : `:root {` pour le sombre, par défaut ; `:root[data-theme="light"] {` pour le clair, en option). */
function tokens(head: string): Record<string, string> {
  const at = css.indexOf(head);
  const body = css.slice(at + head.length, css.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}
const dark = tokens(":root {");
const light = { ...dark, ...tokens(':root[data-theme="light"] {') };

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
  // S59 : entrée / sortie, deuxième panneau, accent sur le fond
  ["in-ink", "in-soft"], ["out-ink", "out-soft"], ["in-ink", "surface"], ["out-ink", "surface"], ["accent", "bg"], ["ink", "panel2"], ["muted", "panel2"],
];

describe("contrastes (S33)", () => {
  it("le dark redéfinit bien les jetons", () => {
    expect(dark.bg).not.toBe(light.bg);
    expect(light["on-accent"]).not.toBe(dark["on-accent"]);
    expect(dark["on-accent"]).toBeDefined();
  });
  for (const [name, theme] of [["clair", light], ["sombre", dark]] as const)
    for (const [fg, bg] of PAIRS)
      it(`${name} : --${fg} sur --${bg} ≥ 4,5:1`, () => {
        expect(theme[fg], fg).toBeDefined();
        expect(theme[bg], bg).toBeDefined();
        expect(ratio(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(4.5);
      });
  it("les deux défauts relevés en S16 restent corrigés", () => {
    expect(ratio(dark["on-accent"]!, dark.accent!)).toBeGreaterThan(6); // était 2,4:1 (texte blanc)
    expect(ratio(light.warn!, light["warn-soft"]!)).toBeGreaterThan(5); // était 3,9:1
  });
});

// B3 : le bac à sable a ses propres jetons (sombre dans les deux thèmes, comme Mindustry), dans sandbox.css.
describe("contrastes du bac à sable (B3)", () => {
  const sb = readFileSync(new URL("../sandbox.css", import.meta.url), "utf8");
  const at = sb.indexOf(".bac-root {");
  const b = Object.fromEntries([...sb.slice(at, sb.indexOf("}", at)).matchAll(/--b-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
  // [texte, fond] : panneaux (#121212), boutons, bouton choisi, plan.
  const SB_PAIRS: [string, string][] = [
    ["ink", "panel"], ["muted", "panel"], ["accent", "panel"], ["red", "panel"], ["green", "panel"],
    ["ink", "btn"], ["muted", "btn"], ["ink", "sel"], ["accent", "sel"], ["ink", "bg"],
  ];
  for (const [fg, bg] of SB_PAIRS)
    it(`--b-${fg} sur --b-${bg} ≥ 4,5:1`, () => {
      expect(b[fg], fg).toBeDefined();
      expect(b[bg], bg).toBeDefined();
      expect(ratio(b[fg]!, b[bg]!)).toBeGreaterThanOrEqual(4.5);
    });
});
