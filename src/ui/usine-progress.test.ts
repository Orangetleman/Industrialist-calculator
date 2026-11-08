import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Garde-fou : la barre de calcul de « Toute l'usine » (S33) et « Continuer le calcul » (S42) ont disparu une fois
 * pendant la refonte de Planifier (S66) parce qu'elles s'affichaient dans une fenêtre repliée du volet droit.
 * Elles doivent rester dans des boîtes posées sur le plan lui-même (#pose-busy, #pose-cut).
 */
const html = readFileSync("index.html", "utf8");
const main = readFileSync("src/ui/main.ts", "utf8");
const css = readFileSync("src/styles.css", "utf8");

describe("barre de calcul de l'usine", () => {
  it("les boîtes sont dans le cadre du plan, pas dans le volet droit", () => {
    const frame = html.slice(html.indexOf('id="pose-frame"'), html.indexOf('id="pose-focus"'));
    expect(frame).toContain('id="pose-busy"');
    expect(frame).toContain('id="pose-cut"');
  });
  it("avancement, temps écoulé, Arrêter, module par module, relancer et continuer y sont branchés", () => {
    for (const s of ['id="usine-progress"', 'class="since', 'data-usine="cancel"', 'data-usine="bymodule"', 'data-usine="run"', 'data-usine="complete"', 'role="status"'])
      expect(main).toContain(s);
    expect(main).toMatch(/busy\.innerHTML = st\.error/);
    expect(main).toMatch(/for \(const id of \["pose-busy", "pose-cut"\]\)/);
    expect(main).toMatch(/FACTORY_BUDGET_MS/);
  });
  it("à plat, sans arrondis (charte S59)", () => {
    expect(css).toMatch(/\.u-busy \{[^}]*border-radius: 0/);
    expect(css).toMatch(/\.u-cut \{/);
  });
});
