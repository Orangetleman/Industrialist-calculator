import { describe, expect, it } from "vitest";
import energyJson from "../data/energy.json";
import itemsJson from "../data/items.json";
import logisticsJson from "../data/logistics.json";
import machinesJson from "../data/machines.json";
import modularJson from "../data/modular.json";
import overridesJson from "../data/overrides.json";
import portsJson from "../data/ports.json";
import powerJson from "../data/power.json";
import recipesJson from "../data/recipes.json";
import relevesJson from "../data/releves.json";
import researchJson from "../data/research.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../src/engine/extension-types.ts";
import { dieselConfigs, farmGeometry } from "../src/engine/modular-calc.ts";
import type { ModularFile } from "../src/engine/modular.ts";
import { solve } from "../src/engine/solve.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { crankshaftsFor, designDiesel, designFarm, DIESEL_IDS, farmCapacity, FARM_IDS, sprinklerOffsets, type AsmBlock, type FarmGeometry, type FarmSet } from "./ferme-collecteur.proto.ts";
import { buildCatalog } from "../src/engine/build/catalog.ts";
import { STEP } from "../src/engine/build/geometry.ts";

const file = modularJson as unknown as ModularFile;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const farmPoles = cat.poles.map((p) => ({ id: p.id, name: p.name, rangeCells: p.rangeCells, capacityMFps: p.capacityMFps, w: p.size.w, h: p.size.h, price: p.price }));
const base = { items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson, modular: file, farmPoles } as unknown as RawFiles;
const { data } = buildGameData(base, [overridesJson as unknown as OverridesFile]);
const g = farmGeometry(file, data.machines, farmPoles)!;
const ports = (portsJson as unknown as PortsFile).machines;

const rect = (b: { x: number; y: number; w: number; h: number }) => ({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h });
const rdist = (cx: number, cy: number, r: ReturnType<typeof rect>) => Math.hypot(Math.max(r.x0 - cx, 0, cx - r.x1), Math.max(r.y0 - cy, 0, cy - r.y1));
const center = (b: AsmBlock) => [b.x + b.w / 2, b.y + b.h / 2] as const;
const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Toutes les règles de la ferme, vérifiées sur le plan. */
function checkFarm(f: FarmSet, geo: FarmGeometry) {
  const byId = new Map(f.blocks.map((b) => [b.id, b]));
  const of = (kind: string) => f.blocks.filter((b) => b.kind === kind);
  // Rien ne se chevauche (blocs et poteaux).
  const rs = [...f.blocks.map(rect), ...f.poles.map(rect)];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(overlap(rs[i]!, rs[j]!), `chevauchement ${i}/${j}`).toBe(false);
  for (const u of Array.from({ length: f.farms }, (_, k) => k + 1)) {
    const mine = f.blocks.filter((b) => b.unit === u);
    const ctrl = mine.filter((b) => b.kind === "controller");
    expect(ctrl).toHaveLength(1);
    const [cx, cy] = center(ctrl[0]!);
    // Tout bloc de la ferme touche le cercle de son contrôleur…
    for (const b of mine) expect(rdist(cx, cy, rect(b)), `${b.id} hors de portée du contrôleur`).toBeLessThanOrEqual(geo.reach.controller + 1e-9);
    // … et aucun bloc d'une autre ferme.
    for (const b of f.blocks.filter((q) => q.unit !== u)) expect(rdist(cx, cy, rect(b)), `${b.id} touché par le contrôleur ${u}`).toBeGreaterThan(geo.reach.controller);
    // Réservoirs : un pour trois arroseurs.
    expect(mine.filter((b) => b.kind === "tank")).toHaveLength(Math.ceil(mine.filter((b) => b.kind === "sprinkler").length / geo.perTank));
  }
  // Chaque arbre est à portée d'un arroseur et suivi par un seul récolteur à portée (22 au plus).
  const harvOf = new Map<string, string>();
  for (const h of of("harvester")) {
    const trees = h.serves!.filter((id) => byId.get(id)?.kind === "tree");
    expect(trees.length).toBeLessThanOrEqual(geo.perHarvester);
    const [hx, hy] = center(h);
    for (const t of trees) {
      expect(harvOf.has(t)).toBe(false);
      harvOf.set(t, h.id);
      expect(rdist(hx, hy, rect(byId.get(t)!))).toBeLessThanOrEqual(geo.reach.harvester + 1e-9);
    }
    // Sa sortie, à portée.
    const outs = h.serves!.filter((id) => byId.get(id)?.kind === "output");
    expect(outs, h.id).toHaveLength(1);
    expect(rdist(hx, hy, rect(byId.get(outs[0]!)!))).toBeLessThanOrEqual(geo.reach.harvester + 1e-9);
  }
  for (const t of of("tree")) {
    expect(harvOf.has(t.id), `${t.id} sans récolteur`).toBe(true);
    expect(of("sprinkler").some((s) => s.unit === t.unit && rdist(...center(s), rect(t)) <= geo.reach.sprinkler + 1e-9)).toBe(true);
  }
  // Passages : de la case du port jusqu'au bord, aucune case occupée.
  const blocked = (x: number, y: number) => f.blocks.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || f.poles.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
  expect(f.corridors).toHaveLength(0);
  for (const c of f.corridors) for (let n = 0; n < c.len; n++) expect(blocked(c.x + STEP[c.dir].x * n, c.y + STEP[c.dir].y * n), `passage de ${c.block}`).toBe(false);
  // Câbles : de la prise au bord, chaque portée tenue.
  if (f.pole) for (const c of f.cables) expect(Math.hypot(c.x2 - c.x1, c.y2 - c.y1)).toBeLessThanOrEqual(f.pole.rangeCells + 1e-9);
}

import { writeFileSync } from "node:fs";
import * as old from "../src/engine/build/assembly.ts";
import { renderFarmSvg } from "../src/ui/assembly-view.ts";
const name = (id: string) => data.machines.get(id)?.name ?? id;
it("maquette", () => {
  let log = "", html = "";
  for (const n of [20, 60, 88, 91, 150, 200, 300, 400, 600, 900, 1800]) {
    const t0 = Date.now();
    const f = designFarm(g, n, n * 551);
    const ms = Date.now() - t0;
    const o = old.designFarm(g, n, n * 551);
    let bad = f.problems.length ? `problems ${JSON.stringify(f.problems)}` : "";
    try {
      checkFarm(f, g);
      const taken = (c: { x: number; y: number }) => [...f.blocks, ...f.poles].some((b) => c.x >= b.x && c.x < b.x + b.w && c.y >= b.y && c.y < b.y + b.h);
      const both = new Set([...f.pipes, ...f.water].map((c) => `${c.x},${c.y}`));
      expect(both.size, "bûches et eau séparées").toBe(f.pipes.length + f.water.length);
      for (const [pp, end, kind] of [[f.pipes, f.exit, "output"], [f.water, f.entry, "tank"]] as const) {
        const S = new Set(pp.map((c) => `${c.x},${c.y}`));
        for (const c of pp) expect(taken(c), "tuyau sur bloc").toBe(false);
        const q = [end!]; const got = new Set([`${end!.x},${end!.y}`]);
        while (q.length) { const c = q.pop()!; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${c.x + a!},${c.y + b!}`; if (S.has(k) && !got.has(k)) { got.add(k); q.push({ x: c.x + a!, y: c.y + b! }); } } }
        for (const b of f.blocks) if (b.kind === kind) expect(got.has(`${b.port!.x},${b.port!.y}`), `${b.id} relié`).toBe(true);
        expect(got.size, "tout relié").toBe(S.size);
      }
      expect(f.entry!.x).toBe(0);
      expect(f.exit!.x).toBe(f.width - 1);
      expect(f.counts.tree).toBe(n);
    } catch (e) { bad += String(e).split("\n")[0]; }
    const c = (s: old.FarmSet, k: string) => s.blocks.filter((b) => b.kind === k).length;
    const row = `${n} arbres | avant ${c(o, "output")} sorties ${o.width}x${o.height} rec ${c(o, "harvester")} fermes ${o.farms} | après ${c(f, "output")} sorties ${f.pipes.length} tuyaux ${f.water.length} eau ${f.width}x${f.height} rec ${c(f, "harvester")} fermes ${f.farms} ${ms}ms ${bad}`;
    log += row + "\n";
    const svg = (s: old.FarmSet, nets: { p: { x: number; y: number }[]; e: { x: number; y: number } | null; c: string; t: string }[]) => {
      const r = renderFarmSvg(s, name); const C = r.width / (s.width + 2);
      let more = "";
      for (const { p: pipes, e, c, t } of nets) {
        const set = new Set(pipes.map((p) => `${p.x},${p.y}`));
        let d = "";
        for (const p of pipes) for (const [a, b] of [[1, 0], [0, 1]]) if (set.has(`${p.x + a!},${p.y + b!}`)) d += `M${(p.x + 1.5) * C},${(p.y + 1.5) * C}l${a! * C},${b! * C}`;
        more += `<path d="${d}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;
        if (e) more += `<circle cx="${(e.x + 1.5) * C}" cy="${(e.y + 1.5) * C}" r="${C * 1.4}" fill="${c}" stroke="#fff" stroke-width="3"><title>${t}</title></circle>`;
      }
      return r.svg.replace("</svg>", more + "</svg>");
    };
    if ([60, 91, 200, 400, 600, 900].includes(n)) html += `<section><h2>${n} arbres</h2><div class="two"><figure><figcaption>Aujourd'hui : ${c(o, "output")} sortie(s), ${o.width} × ${o.height} cases, ${c(o, "harvester")} récolteurs</figcaption>${svg(o, [])}</figure><figure><figcaption><b>Proposé : ${c(f, "output")} sortie(s), un seul départ, une seule arrivée d'eau pour ${c(f, "tank")} réservoir(s)</b>, ${f.width} × ${f.height} cases, ${c(f, "harvester")} récolteurs, ${f.pipes.length} cases de tuyau pour les bûches, ${f.water.length} pour l'eau</figcaption>${svg(f, [{ p: f.pipes, e: f.exit, c: "#ff5fd2", t: "Départ des Oak Logs" }, { p: f.water, e: f.entry, c: "#2fb7ff", t: "Arrivée d'eau" }])}</figure></div></section>`;
  }
  log += `capacité ${old.farmCapacity(g, 42)} -> ${farmCapacity(g, 42)}\n`;
  writeFileSync("maquette/ferme-collecteur.log", log);
  writeFileSync("maquette/ferme-collecteur.html", `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Maquette — sorties de la ferme réunies</title><link rel="stylesheet" href="/src/styles.css"><style>body{background:#0e0a18;color:#f0ecfa;font:15px system-ui;margin:16px;overflow:auto}section{margin:0 0 28px}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;min-width:0}figcaption{margin:0 0 6px}svg{width:100%;height:auto;max-height:85vh;background:#1d2126}.a-rng{display:none!important}@media(max-width:760px){.two{grid-template-columns:1fr}}</style><h1>Sorties et eau de la ferme d'arbres réunies</h1><p>Calcul réel du prototype. <b style="color:#ff5fd2">Rose</b> : Oak Logs, le rond est le départ unique vers l'usine. <b style="color:#2fb7ff">Bleu</b> : eau, le rond est l'arrivée unique, reliée à tous les réservoirs.</p>${html}</html>`);
});
