// Icônes (S41) : les jetons « {i:nom} » des catalogues sont tous dessinés, et retirés des attributs.
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en.ts";
import { fr } from "../i18n/fr.ts";
import { icon, isIcon, noIcons, withIcons } from "./icons.ts";

const texts = (cat: Record<string, unknown>) => Object.values(cat).flatMap((m) => (typeof m === "string" ? [m] : Object.values(m as object) as string[]));

describe("icônes", () => {
  it("chaque jeton des deux catalogues nomme une icône connue", () => {
    for (const cat of [fr, en]) {
      const names = texts(cat).flatMap((s) => [...s.matchAll(/\{i:([a-z-]+)\}/g)].map((m) => m[1]!));
      expect(names.length).toBeGreaterThan(50);
      expect(names.filter((n) => !isIcon(n))).toEqual([]);
    }
  });

  it("aucun émoji d'icône ne reste dans les catalogues (★ et ▲ des listes et du graphique mis à part)", () => {
    const left = texts(fr).concat(texts(en)).filter((s) => /[⚠✎✕💬✓⚙▸📤▶▾⚡↺●⤢✥⏸⇄▦◀⇅↗◯☰🐞💡■◂⊘🔒👍]/u.test(s));
    expect(left).toEqual([]);
  });

  it("dessine dans du HTML, retire d'un attribut", () => {
    expect(withIcons("{i:warn} 2 valeurs")).toBe(`${icon("warn")} 2 valeurs`);
    expect(noIcons("{i:warn} 2 valeurs {i:more}")).toBe("2 valeurs");
    expect(noIcons("Prise {i:power}")).toBe("Prise");
    expect(noIcons(" {i:warn} seuil")).toBe(" seuil");
    expect(icon("close", "Fermer")).toContain('<span class="sr-only">Fermer</span>');
    expect(icon("warn")).toContain('aria-hidden="true"');
  });
});
