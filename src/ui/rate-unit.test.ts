import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, displayRate, storedRate } from "./state";

describe("débit par seconde", () => {
  it("convertit entre par minute (stocké) et par seconde (affiché)", () => {
    expect(displayRate(60, "s")).toBe(1);
    expect(displayRate(90, "min")).toBe(90);
    expect(storedRate(2, "s")).toBe(120);
    expect(storedRate(2, "min")).toBe(2);
    expect(storedRate(displayRate(37.5, "s"), "s")).toBeCloseTo(37.5);
  });
  it("par défaut : par minute", () => expect(DEFAULT_SETTINGS.rateUnit).toBe("min"));
});
