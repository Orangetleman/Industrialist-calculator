// Toute l'usine (S3) : non-régression sur la chaîne du Crankshaft, mêmes chiffres que la maquette v8 recalculée.
import { describe, expect, it } from "vitest";
import itemsJson from "../../../data/items.json";
import machinesJson from "../../../data/machines.json";
import recipesJson from "../../../data/recipes.json";
import researchJson from "../../../data/research.json";
import energyJson from "../../../data/energy.json";
import overridesJson from "../../../data/overrides.json";
import portsJson from "../../../data/ports.json";
import logisticsJson from "../../../data/logistics.json";
import powerJson from "../../../data/power.json";
import relevesJson from "../../../data/releves.json";
import { buildGameData, type RawFiles } from "../data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../extension-types.ts";
import type { OverridesFile } from "../types.ts";
import { solve } from "../solve.ts";
import { buildCatalog } from "./catalog.ts";
import { designFactory, factoryFits, factoryInput, type FactoryPlan } from "./factory.ts";
import { designModule, passageOptions } from "./module.ts";
import { factoryFlows } from "./flow.ts";
import { renderPassagePick } from "../../ui/module-view.ts";
import { renderFactoryInfo, renderFactoryModules, renderFactorySvg } from "../../ui/factory-view.ts";

const PORTS = (portsJson as unknown as PortsFile).machines;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles);
const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()) };
const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
const look = { name, isFluid: (id: string) => !!data.items.get(id)?.isFluid, machine: (id: string) => data.machines.get(id) ?? null, ports: PORTS };
const PLOT = { w: 160, h: 110 };

/** Aucun module ne chevauche un autre ; aucun tuyau sur une machine ; chaque liaison a son tuyau (ou est collée). */
function checkLayout(f: FactoryPlan, edges: { from: string; to: string; item: string }[]): void {
  for (const [i, a] of f.boxes.entries())
    for (const b of f.boxes.slice(i + 1)) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.key} / ${b.key}`).toBe(true);
  for (const b of f.boxes) {
    expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= f.W && b.y + b.h <= f.H, b.key).toBe(true);
    for (const m of b.mod?.machines ?? []) for (const c of m.cells) expect(f.cells.get(`${b.x + c.x},${b.y + c.y}`)?.kind, `${b.key} ${m.id}`).toBe("bloc");
  }
  expect(f.problems).toEqual([]);
  for (const e of edges) {
    if (f.glued.includes(`${e.from}>${e.to}`)) continue;
    const id = `${e.from}:${e.item}`;
    expect(f.nets.find((n) => n.id === id)?.to, id).toContain(e.to);
    expect(f.netCells[id] ?? 0, id).toBeGreaterThan(0);
  }
}

describe("toute l'usine", () => {
  it("chaîne du Crankshaft, recalculée pour l'usine entière : chiffres au plus ceux de la maquette v8 (81 × 101, 1 115 cases, 74 croisements, 3 595 $)", () => {
    const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
    const input = factoryInput(plan, look, cat, PLOT, { priority: ["forme", "place", "prix", "pieces"] }, { full: true });
    const steps: number[] = [];
    const t0 = performance.now();
    // L'entrée et le résultat passent par une copie (comme vers et depuis le Web Worker).
    const f = structuredClone(designFactory(structuredClone(input), (done) => steps.push(done)));
    const ms = performance.now() - t0;
    console.info(`Toute l'usine (Crankshaft 60/min, recalculée) : ${Math.round(ms)} ms, ${f.W} × ${f.H}, ${f.stats.allPipeCells} cases de tuyau, ${f.stats.allCrossings} croisements, ${f.stats.polesCost} $`);
    checkLayout(f, input.edges);
    expect(f.W).toBeLessThanOrEqual(81);
    expect(f.H).toBeLessThanOrEqual(101);
    expect(f.stats.allPipeCells).toBeLessThanOrEqual(1090);
    expect(f.stats.allCrossings).toBeLessThanOrEqual(73);
    expect(f.stats.polesCost).toBeLessThanOrEqual(3595);
    expect(f.stats.overloaded).toBe(0);
    expect(factoryFits(f, PLOT)).toBe("oui");
    // Appendices retirés à la fin : plus aucune pièce à une seule liaison (un bout qui ne mène nulle part),
    // dans la grille comme dans les modules (1 115 → 1 090 cases, 74 → 73 croisements le 2026-10-17).
    expect(f.stats.pruned).toBeGreaterThan(0);
    for (const [k, o] of f.cells) if (o.kind === "tuyau") for (const l of [o.links, ...(o.cross ? [o.cross.links] : [])]) expect(l.size, k).toBeGreaterThanOrEqual(2);
    for (const b of f.boxes) for (const pc of b.mod?.pieces ?? []) expect(pc.links.length + (pc.crossLinks?.length ?? 0), `${b.key} ${pc.x},${pc.y}`).toBeGreaterThan(0);
    // Liaisons (S4) : chaque tuyau entre modules a ses vecteurs, et chaque client en reçoit un.
    const arrows = factoryFlows(f);
    for (const n of f.nets) {
      const mine = arrows.filter((a) => a.net === n.id);
      expect(mine.length, n.id).toBeGreaterThan(0);
      for (const to of n.to) {
        const b = f.boxes.find((x) => x.key === to)!;
        expect(arrows.some((a) => a.item === n.item && a.x2 > b.x && a.x2 < b.x + b.w && a.y2 > b.y && a.y2 < b.y + b.h), `${n.id} → ${to}`).toBe(true);
      }
    }
    // Passages du collecteur central gardés (bilan de S2) : vers les voisins, sans élargir le module.
    expect([...f.passagesKept.values()].map((p) => p.wider)).not.toContain(true);
    expect(f.passagesKept.size).toBeGreaterThan(0);
    // Le site : le passage gardé est conseillé dans le plan de pose du module (« vers les voisins »).
    const [key, kept] = [...f.passagesKept][0]!;
    const st = input.steps.find((s) => s.key === key)!;
    const base = designModule(st.req!, st.entry, st.size, cat, name);
    const advised = kept.choices.map((c) => `${c.item}|${c.passage.row}|${c.passage.after}`);
    const pick = renderPassagePick(base, passageOptions(base, st.req!, st.entry, st.size, cat, name), "", name, advised);
    expect(pick).toContain("★ ");
    expect(pick).toContain("vers les modules voisins");
    expect(renderPassagePick(base, passageOptions(base, st.req!, st.entry, st.size, cat, name), "", name, null)).toContain('data-usine="open"');
    const tierOf = () => 1 as const;
    expect(renderFactoryInfo(f, name, PLOT, tierOf, ms).head).toContain("proposition");
    expect(renderFactoryInfo(f, name, PLOT, tierOf, ms).head).toContain("Tient sur ta parcelle");
    expect(renderFactorySvg(f, name, PLOT, tierOf).svg).toContain('class="u-plot"');
    // S25 : le dessin est cadré sur l'usine (la parcelle n'est qu'un repère) ; modules « posés » cochés et comptés.
    const svg = renderFactorySvg(f, name, PLOT, tierOf);
    expect([svg.width, svg.height]).toEqual([(f.W + 2) * 10, (f.H + 3) * 10]);
    const k0 = f.boxes[0]!.key;
    const mods = renderFactoryModules(f, new Set([k0]));
    expect(mods).toContain(`data-posed="${k0}" checked`);
    expect(mods).toContain(`1 posé sur ${f.boxes.length}`);
    // Avancement : croissant, de 0 à 1.
    expect(steps[0]).toBe(0);
    expect(steps.at(-1)).toBe(1);
    expect(steps.every((x, i) => i === 0 || x >= steps[i - 1]!)).toBe(true);
  }, 300_000);

  it("S27 : chaque sous-produit inutilisé sort par un tuyau jusqu'au bord choisi (sinon le plus proche)", () => {
    const plan = solve(data, all, { item: "light-oil", ratePerMin: 60, criterion: "machines", tiers: false });
    const base = factoryInput(plan, look, cat, PLOT, { priority: ["place", "forme", "prix", "pieces"] });
    expect(base.evac?.length).toBeGreaterThan(0);
    // Ce qui reste après les liaisons (tout le sous-produit, ou son surplus).
    for (const ev of base.evac!) {
      const made = plan.steps.find((s) => s.key === ev.from)!.byproducts.find((b) => b.item === ev.item)!.perMin;
      const used = plan.edges.filter((e) => e.from === ev.from && e.item === ev.item).reduce((t, e) => t + e.perMin, 0);
      expect(ev.perMin).toBeCloseTo(made - used, 6);
    }
    const item = base.evac![0]!.item;
    for (const full of [false, true]) {
      const auto = designFactory(structuredClone(factoryInput(plan, look, cat, PLOT, { priority: ["place", "forme", "prix", "pieces"] }, { full })));
      expect(auto.evacs.length, `full=${full}`).toBe(base.evac!.length);
      for (const ev of auto.evacs) {
        expect(ev.ok, `${ev.item} full=${full}`).toBe(true);
        expect(ev.cells.length).toBeGreaterThan(0);
        // Le tracé touche son module (pas de trou d'une case à la sortie) : une case juste devant un de ses bords.
        // (Un surplus d'un produit en partie consommé se raccorde au tuyau qui part déjà vers le client.)
        if (!full && !plan.edges.some((e) => e.from === ev.from && e.item === ev.item)) {
          const b = auto.boxes.find((x) => x.key === ev.from)!;
          const touches = ev.cells.some((k) => {
            const [x, y] = k.split(",").map(Number) as [number, number];
            const inX = x >= b.x && x < b.x + b.w;
            const inY = y >= b.y && y < b.y + b.h;
            return (inY && (x === b.x - 1 || x === b.x + b.w)) || (inX && (y === b.y - 1 || y === b.y + b.h));
          });
          expect(touches, `${ev.item} touche ${b.key}`).toBe(true);
        }
        // La case au bord est bien sur le bord annoncé.
        expect(ev.side === "gauche" ? ev.at.x === 0 : ev.side === "droite" ? ev.at.x === auto.W - 1 : ev.side === "haut" ? ev.at.y === 0 : ev.at.y === auto.H - 1).toBe(true);
      }
      // Bord imposé : en haut.
      const up = designFactory(structuredClone(factoryInput(plan, look, cat, PLOT, { priority: ["place", "forme", "prix", "pieces"] }, { full, evacSides: { [item]: "haut" } })));
      const ev = up.evacs.find((e) => e.item === item)!;
      expect([ev.side, ev.ok, ev.at.y]).toEqual(["haut", true, 0]);
      expect(renderFactorySvg(up, name, PLOT, () => 1).svg).toContain('class="u-net u-evac"');
    }
  }, 300_000);

  it("plan d'une seule étape, et plan vide : pas d'erreur", () => {
    const plan = solve(data, all, { item: "steel-ingot", ratePerMin: 10, criterion: "energy", tiers: false });
    const input = factoryInput({ steps: plan.steps.filter((s) => s.item === "steel-ingot"), edges: plan.edges }, look, cat, PLOT, { priority: ["place", "forme", "prix", "pieces"] }, { full: true });
    expect(input.edges).toEqual([]);
    const f = designFactory(input);
    expect(f.boxes).toHaveLength(1);
    checkLayout(f, []);
    expect(designFactory({ ...input, steps: [], edges: [] }).boxes).toEqual([]);
  }, 120_000);
});
