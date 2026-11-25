// Pincement (MB2, PLAN-MOBILE.md) : calcul pur entre deux positions de deux doigts.
import { describe, expect, it } from "vitest";
import { pinchStep } from "./canvas.ts";

describe("pinchStep", () => {
  it("écarter les doigts agrandit, le centre ne bouge pas", () => {
    expect(pinchStep({ x: 90, y: 50 }, { x: 110, y: 50 }, { x: 80, y: 50 }, { x: 120, y: 50 })).toEqual({ factor: 2, from: { x: 100, y: 50 }, dx: 0, dy: 0 });
  });
  it("deux doigts déplacés ensemble : pas de zoom, le dessin suit", () => {
    expect(pinchStep({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 7 }, { x: 15, y: 7 })).toEqual({ factor: 1, from: { x: 5, y: 0 }, dx: 5, dy: 7 });
  });
  it("doigts au même point : facteur 1, jamais infini ni nul", () => {
    const p = { x: 3, y: 3 };
    expect(pinchStep(p, p, { x: 0, y: 0 }, { x: 9, y: 0 }).factor).toBe(1);
    expect(pinchStep({ x: 0, y: 0 }, { x: 9, y: 0 }, p, p).factor).toBe(1);
  });
});
