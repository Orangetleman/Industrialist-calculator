import { describe, expect, it } from "vitest";
import { nestSvg } from "./factory-view.ts";

describe("nestSvg (R15 : ensemble modulaire dessiné dans l'usine)", () => {
  it("replace le SVG dans le cadre du module en gardant viewBox et classe", () => {
    const out = nestSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20" class="module asm" role="img" aria-label="x"><rect/></svg>', 5, 6, 100, 200);
    expect(out).toBe('<svg viewBox="0 0 10 20" class="module asm" x="5" y="6" width="100" height="200" preserveAspectRatio="xMidYMid meet"><rect/></svg>');
  });
});
