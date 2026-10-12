// Intégrité des données de l'extension (phase E0).
import { describe, expect, it } from "vitest";
import logisticsJson from "../data/logistics.json";
import portsJson from "../data/ports.json";
import powerJson from "../data/power.json";
import stationsJson from "../data/research-stations.json";
import worldJson from "../data/world.json";
import machinesJson from "../data/machines.json";
import type { LogisticsFile, PortsFile, PowerFile, ResearchStationsFile, WorldFile } from "../src/engine/extension-types.ts";
import type { MachinesFile } from "../src/engine/types.ts";

const logistics = logisticsJson as unknown as LogisticsFile;
const power = powerJson as unknown as PowerFile;
const stations = stationsJson as unknown as ResearchStationsFile;
const world = worldJson as unknown as WorldFile;
const ports = portsJson as unknown as PortsFile;
const machineIds = new Set((machinesJson as unknown as MachinesFile).machines.map((m) => m.id));

describe("données de l'extension", () => {
  it("chaque entrée a une source du wiki", () => {
    for (const x of [...logistics.pipes, ...logistics.storage, ...logistics.depots, ...power.entries]) {
      expect(x.sources.length, x.name).toBeGreaterThan(0);
      expect(x.sources[0]!.url, x.name).toMatch(/^https:\/\/industrialist\.miraheze\.org\//);
    }
  });

  it("tuyauterie : tiers I, III et IV, objets et fluides, dimensions en studs", () => {
    expect(logistics.pipes.length).toBeGreaterThanOrEqual(40);
    const tiers = new Set(logistics.pipes.map((p) => p.tier));
    expect([...tiers]).toEqual(expect.arrayContaining([1, 3, 4]));
    const short2 = logistics.pipes.find((p) => p.name === "Short Pipe2")!;
    expect(short2).toMatchObject({ tier: 3, kind: "objet", capacity: 40, flowPerSec: 120, sizeStuds: { w: 2, l: 2 } });
    expect(logistics.pipes.filter((p) => p.gamepass).map((p) => p.name).sort()).toEqual(["Fluid Rate Meter", "Item Rate Meter"]);
    for (const p of logistics.pipes) if (p.sizeStuds === null) expect(p.verify.some((v) => v.field === "sizeStuds"), p.name).toBe(true);
  });

  it("énergie : générateurs, poteaux avec portée, valeurs illisibles signalées", () => {
    const by = new Map(power.entries.map((e) => [e.id, e]));
    expect(by.get("coal-generator")?.output).toBe(7000);
    // Portée relevée en jeu (10,5 tuiles), prioritaire sur le wiki (10).
    expect(by.get("lv-pole")).toMatchObject({ rangeTiles: { tiles: 10.5 }, transfer: { perNode: 2400, nodes: 2 } });
    expect(by.get("hmvt")?.rangeTiles?.tiles).toBe(22);
    for (const e of power.entries) {
      if (e.subcategory === "Transfer Poles" && !e.rangeTiles) expect(e.verify.some((v) => v.field === "rangeTiles"), e.name).toBe(true);
      expect(machineIds.has(e.id), e.id).toBe(true);
    }
  });

  it("RP : toutes les formules extraites, avec leur citation", () => {
    const facts = [
      ...Object.values(stations.rs1),
      ...Object.values(stations.rs2),
      ...Object.values(stations.rs3),
      ...Object.values(stations.rs4),
      ...Object.values(stations.satellite),
      ...Object.values(stations.softCap),
      stations.startRp,
    ];
    for (const f of facts) {
      expect(f.value, f.problem).not.toBeNull();
      expect(f.quote).toBeTruthy();
    }
    // Exemple du wiki : 13 Research Station1 donnent un plafond de 761 RP.
    expect(Math.round(stations.rs1.capCoef.value! * Math.log2(13 + 1))).toBe(761);
  });

  it("monde : jour, vapeur, logique ; grille relevée en jeu (1 case = 1 Short Pipe = 2 studs)", () => {
    const v = (k: string) => world.facts[k]?.value;
    expect([v("dayMinutes"), v("sunrise"), v("sunset"), v("steamWaterIn"), v("steamOut")]).toEqual([16, 6, 17, 3, 90]);
    expect(world.grid.cellStuds).toBe(2);
    expect(world.grid.sources[0]?.wiki).toBe("jeu");
    expect(world.grid.cellStuds === null).toBe(world.grid.verify.some((f) => f.field === "cellStuds"));
    // Cohérence : le Short Pipe du wiki (2×2 studs) occupe bien une case.
    const short = logistics.pipes.find((p) => p.name === "Short Pipe")!;
    expect(short.sizeStuds).toEqual({ w: world.grid.cellStuds, l: world.grid.cellStuds });
  });

  it("relevés appliqués : portées, silos, dépôts", () => {
    const by = new Map(power.entries.map((e) => [e.id, e]));
    expect(by.get("advanced-mv-pole")?.rangeTiles?.tiles).toBe(10.5); // le wiki disait 8
    expect(logistics.storage.find((s) => s.id === "medium-item-storage-silo")?.capacity).toBe(5000);
    expect(logistics.depots.find((d) => d.id === "huge-truck-depot")?.itemsPerSec).toBeCloseTo(400 / 75);
    expect(by.get("large-turbine")?.tempCurve?.points.at(-1)).toEqual([400, 514862]);
  });

  it("ports : bâtiments connus, sources datées, positions dans l'empreinte", () => {
    expect(Object.keys(ports.machines).length).toBeGreaterThanOrEqual(6);
    for (const [id, e] of Object.entries(ports.machines)) {
      expect(machineIds.has(id), id).toBe(true);
      expect(e.source.fetchedAt, id).toBeTruthy();
      const { w, h } = e.footprint!;
      for (const p of e.ports) {
        if (p.side === "dessus") {
          const [x, y] = p.cell as [number, number];
          expect(x >= 0.5 && x <= w && y >= 0.5 && y <= h, `${id} ${p.type} ${x},${y}`).toBe(true);
        } else {
          const len = p.side === "haut" || p.side === "bas" ? w : h;
          expect((p.cell as number) >= 1 && (p.cell as number) <= len, `${id} ${p.side} ${p.cell}`).toBe(true);
        }
      }
    }
  });
});
