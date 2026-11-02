import { describe, expect, it } from "vitest";
import machinesJson from "../../../data/machines.json";
import portsJson from "../../../data/ports.json";
import logisticsJson from "../../../data/logistics.json";
import { EDITOR_ID, editorId } from "./catalog.ts";

// S39 (R17) : chaque pièce de tuyau du bac à sable ouvre une fiche de l'éditeur de bâtiments.
const machines = new Set(machinesJson.machines.map((m) => m.id));
const pipes = logisticsJson.pipes.map((p) => p.id);

describe("pièces de tuyau et fiches de l'éditeur (S39)", () => {
  it("chaque lien relie une pièce de logistics.json à un bâtiment de machines.json", () => {
    for (const [from, to] of Object.entries(EDITOR_ID)) {
      expect(pipes, from).toContain(from);
      expect(machines.has(to), to).toBe(true);
    }
  });
  it("toutes les pièces de tuyau ont une fiche dans l'éditeur", () => {
    expect(pipes.filter((id) => !machines.has(editorId(id)))).toEqual([]);
  });
  it("les coudes, tés et croix fluides du tier III ont leurs ports relevés", () => {
    const ports = (portsJson as { machines: Record<string, unknown> }).machines;
    for (const id of ["pipe-fluid-turn2", "pipe-fluid-junction2", "pipe-fluid-section2", "pipe-valve"]) expect(ports[editorId(id)], id).toBeTruthy();
  });
});
