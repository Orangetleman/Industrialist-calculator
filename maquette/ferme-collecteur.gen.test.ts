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
  expect(f.corridors).toHaveLength(of("tank").length);
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
  for (const n of [20, 60, 88, 91, 150, 200, 300, 400, 600, 900]) {
    const t0 = Date.now();
    const f = designFarm(g, n, n * 551);
    const ms = Date.now() - t0;
    const o = old.designFarm(g, n, n * 551);
    let bad = f.problems.length ? `problems ${JSON.stringify(f.problems)}` : "";
    try {
      checkFarm(f, g);
      const S = new Set(f.pipes.map((c) => `${c.x},${c.y}`));
      for (const c of f.pipes) expect(f.blocks.some((b) => c.x >= b.x && c.x < b.x + b.w && c.y >= b.y && c.y < b.y + b.h) || f.poles.some((b) => c.x >= b.x && c.x < b.x + b.w && c.y >= b.y && c.y < b.y + b.h), "tuyau sur bloc").toBe(false);
      for (const c of f.corridors) for (let k = 0; k < c.len; k++) expect(S.has(`${c.x + STEP[c.dir].x * k},${c.y + STEP[c.dir].y * k}`), "eau sur tuyau").toBe(false);
      const q = [f.exit!]; const got = new Set([`${f.exit!.x},${f.exit!.y}`]);
      while (q.length) { const c = q.pop()!; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${c.x + a!},${c.y + b!}`; if (S.has(k) && !got.has(k)) { got.add(k); q.push({ x: c.x + a!, y: c.y + b! }); } } }
      for (const b of f.blocks) if (b.kind === "output") expect(got.has(`${b.port!.x},${b.port!.y}`), `${b.id} relié`).toBe(true);
      expect(got.size, "tout relié").toBe(S.size);
      expect(f.exit!.x).toBe(f.width - 1);
      expect(f.counts.tree).toBe(n);
    } catch (e) { bad += String(e).split("\n")[0]; }
    const c = (s: old.FarmSet, k: string) => s.blocks.filter((b) => b.kind === k).length;
    const row = `${n} arbres | avant ${c(o, "output")} sorties ${o.width}x${o.height} rec ${c(o, "harvester")} fermes ${o.farms} | après ${c(f, "output")} sorties ${f.pipes.length} tuyaux ${f.width}x${f.height} rec ${c(f, "harvester")} fermes ${f.farms} ${ms}ms ${bad}`;
    log += row + "\n";
    const svg = (s: old.FarmSet, pipes: { x: number; y: number }[], exit: { x: number; y: number } | null) => {
      const r = renderFarmSvg(s, name).svg; const C = renderFarmSvg(s, name).width / (s.width + 2);
      const set = new Set(pipes.map((p) => `${p.x},${p.y}`));
      let d = "";
      for (const p of pipes) for (const [a, b] of [[1, 0], [0, 1]]) if (set.has(`${p.x + a!},${p.y + b!}`)) d += `M${(p.x + 1.5) * C},${(p.y + 1.5) * C}l${a! * C},${b! * C}`;
      const more = `<path d="${d}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#d77fd0" stroke-width="6" stroke-linecap="round"/>` + (exit ? `<circle cx="${(exit.x + 1.5) * C}" cy="${(exit.y + 1.5) * C}" r="${C * 1.4}" fill="#ff6a1a" stroke="#fff" stroke-width="3"/>` : "");
      return r.replace("</svg>", more + "</svg>");
    };
    if ([60, 91, 200, 400, 600].includes(n)) html += `<section><h2>${n} arbres</h2><div class="two"><figure><figcaption>Aujourd'hui : ${c(o, "output")} sortie(s), ${o.width} × ${o.height} cases, ${c(o, "harvester")} récolteurs</figcaption>${svg(o, [], null)}</figure><figure><figcaption><b>Proposé : ${c(f, "output")} sortie(s), un seul départ</b>, ${f.width} × ${f.height} cases, ${c(f, "harvester")} récolteurs, ${f.pipes.length} cases de tuyau</figcaption>${svg(f, f.pipes, f.exit)}</figure></div></section>`;
  }
  log += `capacité ${old.farmCapacity(g, 42)} -> ${farmCapacity(g, 42)}\n`;
  writeFileSync("maquette/ferme-collecteur.log", log);
  writeFileSync("maquette/ferme-collecteur.html", `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Maquette — sorties de la ferme réunies</title><link rel="stylesheet" href="/src/styles.css"><style>body{background:#0e0a18;color:#f0ecfa;font:15px system-ui;margin:16px;overflow:auto}section{margin:0 0 28px}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;min-width:0}figcaption{margin:0 0 6px}svg{width:100%;height:auto;max-height:85vh;background:#1d2126}.a-rng{display:none!important}@media(max-width:760px){.two{grid-template-columns:1fr}}</style><h1>Sorties de la ferme d'arbres réunies</h1><p>Calcul réel du prototype. Trait rose : tuyau des Oak Logs. Rond orange : le point unique où l'usine se branche. Pointillés bleus : arrivée d'eau des réservoirs (inchangée).</p>${html}</html>`);
});
