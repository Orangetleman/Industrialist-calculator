import { describe, expect, it } from "vitest";
import { extractRpFormulas, extractWorld, parsePerNode, parsePipeTables, parsePowerRange, parseRangeTiles } from "./extension-extract.ts";

describe("valeurs d'énergie", () => {
  it("puissance seule et plages", () => {
    expect(parsePowerRange("7kMF/s")).toBe(7000);
    expect(parsePowerRange("120MF/s - 240MF/s")).toEqual([120, 240]);
    expect(parsePowerRange("55.2kMF/s-90kMF/s")).toEqual([55200, 90000]);
    expect(parsePowerRange("432MF/s - 9.36kMF/s")).toEqual([432, 9360]);
    expect(parsePowerRange("0-550MMF/s")).toEqual([0, 550e6]); // le 0 prend l'unité du second nombre
    expect(parsePowerRange("Depends")).toBeNull();
    expect(parsePowerRange("Varies (HV/MV)")).toBeNull();
  });

  it("débit ou capacité par nœud", () => {
    expect(parsePerNode("37.5kMF * 4")).toEqual({ perNode: 37500, nodes: 4 });
    expect(parsePerNode("1.5MMF/s × 4")).toEqual({ perNode: 1.5e6, nodes: 4 });
    expect(parsePerNode("3MMF/s")).toEqual({ perNode: 3e6, nodes: 1 });
    expect(parsePerNode("1MF - 1.5MMF")).toBeNull();
  });

  it("portée des poteaux, en chiffres ou en toutes lettres", () => {
    expect(parseRangeTiles("has a connection range of ten tiles, which")).toMatchObject({ tiles: 10, approx: false });
    expect(parseRangeTiles("being able to reach 22 tiles shown")).toMatchObject({ tiles: 22 });
    expect(parseRangeTiles("with a radius of approximately 70 tiles")).toMatchObject({ tiles: 70, approx: true });
    expect(parseRangeTiles("no range here")).toBeNull();
  });
});

describe("tableaux de la page Pipes", () => {
  const page = [
    "<tabber>|-|Tier I Pipes=",
    "! Pipe Name !! Price !! Capacity !! Flow Rate !! Dimension in Studs !! Quote",
    "|-",
    '| Short Pipe || {{Money|2}} || 6 units || 6 units/s || 2x2 studs ||"Used for transporting items"',
    "|-|Tier IV Fluid Pipes=",
    '| Long Large Fluid Pipe || {{Money|50,000}} || 2,000L || 12,000L/s || 8x4 studs || "Used for transporting large amounts of fluids."',
    '| Item Rate Meter ([[Gamepass]])|| {{Money|2,560}} || 40 units || 120 units/s  || 4x4 studs || "Displays how many items/s"',
    '| Rusty Fluid Pipe and Item Intersection ({{Tier||1}})|| {{Money|250}} || 6 units & 6L || 6 units/s & 6L/s || 6x6 studs ||"Slower"',
    '|style="height:auto"|',
  ].join("\n");
  const rows = parsePipeTables(page);

  it("lit chaque pièce avec son tier, son type et ses dimensions", () => {
    expect(rows.map((r) => r.name)).toEqual(["Short Pipe", "Long Large Fluid Pipe", "Item Rate Meter", "Rusty Fluid Pipe and Item Intersection"]);
    expect(rows[0]).toMatchObject({ tier: 1, kind: "objet", price: 2, capacity: 6, flowPerSec: 6, sizeStuds: { w: 2, l: 2 }, gamepass: false, complex: false });
    expect(rows[1]).toMatchObject({ tier: 4, kind: "fluide", price: 50000, capacity: 2000, flowPerSec: 12000, sizeStuds: { w: 8, l: 4 }, complex: false });
  });

  it("repère le passe du jeu et les valeurs multiples", () => {
    expect(rows[2]).toMatchObject({ gamepass: true, price: 2560 });
    expect(rows[3]).toMatchObject({ tier: 1, kind: "mixte", complex: true });
  });
});

describe("formules des RP et faits du monde", () => {
  const pages = {
    "Research Station1": String.raw`<math>\text{RP/s}=\sqrt n</math> <math>\text{Effective RP Cap}=200\log_{2}(n+1)</math>`,
    "Research Station2": String.raw`(0.5u/s of any [[Item]]) <math>\text{RP/s}=2 * n^{0.6}</math> <math>\text{Effective RP Cap}=2000 * \log_{2}(m +1)</math>`,
    "Research Station3": String.raw`consuming 0.1 units per second from each node. <math>\text{RP/s}=2n^{0.6}</math> There is also a 30% penalty to the sum (n) if both input [[Items]] are the same. <math>\text{RP Cap}=16500*(log_2(C+1)+}\sqrt{C )</math>`,
    "Satellite Dish Controller": String.raw`a liquid (0.5L/s) <math>B \times 0.78\log(R + 1)</math> <math>\bigl \lceil S + \sqrt{S * R} \bigr \rceil</math>`,
    "Research System": String.raw`{{RP|50}} for worlds on {{Difficulties|Normal}} or with {{Difficulties|Sandbox}} enabled, and {{RP|300}} for the other <math>\text{CurrentRPs} * 10 ^ {1-x}</math> <math>\text{CurrentRPs} * 10 ^ {1-\sqrt[]{x}}</math> <math>x = \max(\frac{\text{CurrentRP}}{\text{RPCap}}, 1)</math>`,
    "Weather & Time": "A day lasts around 16 minutes, with time. The default time the player spawns into the world is 7, and. The sun will rise at 6 and set at 17, and",
    Steam: "at a set rate of 3L of [[Water]] -> 90L of '''Steam''' ({{Ratio}}). will lose around {{Heat|0.01}} for every connection",
    Logic: "one logic tick of delay built in (1/6th a second, not related",
    "Truck Depot": "has a capacity of 10 items. After it is filled, it will automatically sell all its contents and return after 15 seconds making it",
    Pollution: "Each Scrubber can remove up to {{Pollution|6.48}} Pollution/hour",
  };

  it("extrait tous les paramètres des formules", () => {
    const f = extractRpFormulas(pages);
    expect([f.rs1.capCoef.value, f.rs2.rateCoef.value, f.rs2.rateExp.value, f.rs2.capCoef.value, f.rs2.inputPerSec.value]).toEqual([200, 2, 0.6, 2000, 0.5]);
    expect([f.rs3.capCoef.value, f.rs3.samePenalty.value, f.rs3.inputPerSecPerNode.value]).toEqual([16500, 0.3, 0.1]);
    expect([f.satellite.boostCoef.value, f.satellite.liquidPerSec.value, f.satellite.dishes.value]).toEqual([0.78, 0.5, "ceil(S+sqrt(S*R))"]);
    expect([f.softCap.rs123.value, f.softCap.rs4.value, f.softCap.x.value]).toEqual(["10^(1-x)", "10^(1-sqrt(x))", "max(RP/cap,1)"]);
    expect(f.startRp.value).toEqual({ normal: 50, other: 300 });
  });

  it("refuse une formule modifiée au lieu de deviner", () => {
    const f = extractRpFormulas({ ...pages, "Research Station2": String.raw`<math>\text{RP/s}=2 * \log(n)</math>` });
    expect(f.rs2.rateCoef.value).toBeNull();
    expect(f.rs2.rateCoef).toMatchObject({ problem: expect.stringMatching(/introuvable/) });
  });

  it("faits du monde", () => {
    const w = extractWorld(pages);
    expect([w.dayMinutes.value, w.sunrise.value, w.sunset.value, w.spawnHour.value]).toEqual([16, 6, 17, 7]);
    expect([w.steamWaterIn.value, w.steamOut.value, w.steamLossPerConnection.value]).toEqual([3, 90, 0.01]);
    expect(w.logicTickSeconds.value).toBeCloseTo(1 / 6);
    expect(w.truckDepot.value).toEqual({ capacity: 10, cycleSeconds: 15 });
    expect(w.scrubberMaxPerHour.value).toBe(6.48);
  });
});
