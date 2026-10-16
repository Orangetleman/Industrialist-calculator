// Forme de data/modular.json (session S11) : chaque valeur a sa source, ou une question dans
// data/a-verifier.md.
import { describe, expect, it } from "vitest";
import notes from "../data/a-verifier.md?raw";
import modularJson from "../data/modular.json";
import machinesJson from "../data/machines.json";
import researchJson from "../data/research.json";
import type { MachinesFile } from "../src/engine/types.ts";

type Status = "sourcé" | "contradiction" | "déduit" | "inconnu";
interface Fact {
  key: string;
  text: string;
  value: unknown;
  status: Status;
  sources: string[];
  alternatives?: { value: unknown; sources: string[] }[];
  question?: string;
}
interface Measurement {
  id: string;
  text: string;
  status: Status;
  sources: string[];
  columns?: string[];
  rows?: unknown[][];
  alternatives?: { value: unknown; sources: string[] }[];
}
interface Assembly {
  id: string;
  research: string;
  assembly: "portée" | "contact";
  rules: Fact[];
  blocks: { id: string; role: string; facts: Fact[] }[];
  examples?: Measurement[];
  measurements?: Measurement[];
}
interface Source {
  wiki: string;
  url?: string;
  fetchedAt: string;
}
interface ModularFile {
  sources: Record<string, Source>;
  assemblies: Assembly[];
}

const modular = modularJson as unknown as ModularFile;
const machines = (machinesJson as unknown as MachinesFile).machines;
const machineById = new Map(machines.map((m) => [m.id, m]));
const researchIds = new Set((researchJson as unknown as { nodes: { id: string }[] }).nodes.map((n) => n.id));
const STATUSES: Status[] = ["sourcé", "contradiction", "déduit", "inconnu"];

function allFacts(a: Assembly): Fact[] {
  return [...a.rules, ...a.blocks.flatMap((b) => b.facts)];
}

describe("données des machines modulaires (modular.json)", () => {
  it("les trois ensembles, dans l'ordre de Q9 : ferme d'arbres, moteur diesel, turbine", () => {
    expect(modular.assemblies.map((a) => a.id)).toEqual(["tree-farm", "diesel-engine", "modular-turbine"]);
    expect(modular.assemblies.map((a) => a.assembly)).toEqual(["portée", "contact", "contact"]);
    for (const a of modular.assemblies) expect(researchIds.has(a.research), a.id).toBe(true);
  });

  it("chaque source est un wiki avec son adresse, un relevé en jeu ou une réponse de l'utilisateur, datée", () => {
    for (const [key, s] of Object.entries(modular.sources)) {
      expect(["miraheze", "fandom", "jeu", "utilisateur"], key).toContain(s.wiki);
      expect(s.fetchedAt, key).toMatch(/^\d{4}-\d{2}-\d{2}/);
      if (s.wiki === "miraheze") expect(s.url, key).toMatch(/^https:\/\/industrialist\.miraheze\.org\/wiki\//);
      if (s.wiki === "fandom") expect(s.url, key).toMatch(/^https:\/\/industrialist\.fandom\.com\/wiki\//);
    }
  });

  it("chaque bloc existe dans machines.json, et tous les blocs de chaque recherche sont décrits", () => {
    for (const a of modular.assemblies) {
      const ids = a.blocks.map((b) => b.id);
      expect(new Set(ids).size, a.id).toBe(ids.length);
      for (const id of ids) {
        expect(machineById.get(id)?.category, id).toBe("Modular");
        expect(machineById.get(id)?.unlockedBy, id).toBe(a.research);
      }
      const expected = machines.filter((m) => m.category === "Modular" && m.unlockedBy === a.research).map((m) => m.id);
      expect([...ids].sort(), a.id).toEqual(expected.sort());
    }
  });

  it("chaque valeur a une source, ou une question dans a-verifier.md", () => {
    for (const a of modular.assemblies) {
      for (const f of allFacts(a)) {
        const label = `${a.id} / ${f.key}`;
        expect(f.text.length, label).toBeGreaterThan(0);
        expect(STATUSES, label).toContain(f.status);
        for (const s of [...f.sources, ...(f.alternatives ?? []).flatMap((x) => x.sources)]) {
          expect(modular.sources[s], `${label} → ${s}`).toBeDefined();
        }
        if (f.status === "inconnu") {
          expect(f.value, label).toBeNull();
          expect(f.question, label).toMatch(/^MOD-\d{2}$/);
        } else {
          expect(f.sources.length, label).toBeGreaterThan(0);
        }
        if (f.status === "contradiction") {
          expect(f.alternatives?.length, label).toBeGreaterThan(0);
          for (const alt of f.alternatives!) expect(alt.sources.length, label).toBeGreaterThan(0);
        }
        if (f.question) expect(notes, `${label} → ${f.question}`).toContain(`**${f.question}**`);
      }
    }
  });

  it("les tableaux et exemples sont sourcés et bien formés", () => {
    for (const a of modular.assemblies) {
      for (const m of [...(a.examples ?? []), ...(a.measurements ?? [])]) {
        expect(m.sources.length, m.id).toBeGreaterThan(0);
        for (const s of m.sources) expect(modular.sources[s], `${m.id} → ${s}`).toBeDefined();
        if (m.rows) for (const row of m.rows) expect(row.length, m.id).toBe(m.columns!.length);
        if (m.status === "contradiction") expect(m.alternatives?.length, m.id).toBeGreaterThan(0);
      }
    }
  });

  it("contact : chaque face ne cite que des blocs du même ensemble", () => {
    for (const a of modular.assemblies.filter((x) => x.assembly === "contact")) {
      const ids = new Set(a.blocks.map((b) => b.id));
      for (const b of a.blocks) {
        const faces = b.facts.find((f) => f.key === "faces");
        expect(faces, `${a.id} / ${b.id}`).toBeDefined();
        if (faces!.value === null) continue;
        for (const [side, list] of Object.entries(faces!.value as Record<string, string[]>)) {
          expect(["front", "back", "side"], `${b.id} ${side}`).toContain(side);
          for (const id of list) expect(ids.has(id), `${b.id} ${side} → ${id}`).toBe(true);
        }
      }
    }
  });

  it("portée : la ferme dit pour chaque bloc ce qu'on sait de sa portée (valeur ou question)", () => {
    const farm = modular.assemblies.find((a) => a.id === "tree-farm")!;
    expect(farm.rules.find((r) => r.key === "rangeShape")?.value).toBe("cercle");
    for (const id of ["tree-farm-controller", "tree-farm-sprinkler", "farm-harvester"]) {
      const range = farm.blocks.find((b) => b.id === id)!.facts.find((f) => f.key === "rangeTiles");
      expect(range, id).toBeDefined();
      expect(range!.status === "inconnu" ? range!.question : range!.value, id).toBeTruthy();
    }
  });
});
