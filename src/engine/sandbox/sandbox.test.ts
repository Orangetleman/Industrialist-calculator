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
import { buildSandboxCatalog, computeSandbox, autoConnect, contacts, geo, links, machineLinks, powerWires, powered, rot, routeError, stillMissing, withFills, type Dir, type Layout, type Placed, type Wire } from "./index.ts";

const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const cat = buildSandboxCatalog(data, { ports: portsJson as unknown as PortsFile, logistics: logisticsJson as unknown as LogisticsFile, power: powerJson as unknown as PowerFile, releves: relevesJson });

/** Petit constructeur de montage pour les tests (le tracé automatique des tuyaux viendra en B2). */
function builder() {
  const L: Layout = { blocks: [], wires: [] };
  let n = 1;
  const put = (id: string, x: number, y: number, r = 0, choice: string | null = null): number => { const b: Placed = { u: n++, id, x, y, r, choice }; L.blocks.push(b); return b.u; };
  /** Pièce de tuyau tournée pour avoir exactement ces ouvertures. */
  const piece = (id: string, x: number, y: number, open: Dir[]) => {
    const g = cat.blocks.get(id)!.geo!;
    const r = [0, 1, 2, 3].find((rr) => { const s = g.ports.map((p) => rot(p.s as Dir, rr)); return s.length === open.length && open.every((d) => s.includes(d)); });
    if (r === undefined) throw new Error(`${id} : aucune rotation pour ${open}`);
    return put(id, x, y, r);
  };
  return { L, put, piece };
}
const near = (a: number | undefined, b: number) => expect(a).toBeCloseTo(b, 6);
/** Alertes hors électricité (les exemples n'ont pas de câbles : leurs machines sont « sans courant », comme dans la maquette). */
const noPowerAlerts = (R: ReturnType<typeof computeSandbox>) => R.alerts.map((a) => a.a).filter((a) => a.k !== "unpowered");

describe("catalogue", () => {
  it("passe par buildGameData et lit les ports tournés", () => {
    expect(cat.blocks.get("roller")!.recipes.map((r) => r.id)).toContain("roller_02");
    const g = geo(cat.blocks.get("press")!, { u: 1, id: "press", x: 0, y: 0, r: 1 })!;
    expect([g.w, g.h]).toEqual([2, 4]);
    // Entrée relevée « bas, case 1 » : après un quart de tour, à gauche, en haut.
    const inp = g.ports.find((p) => p.t === "o" && p.d === "e")!;
    expect(inp.dir).toBe("W");
    expect(inp.cells).toEqual([[0, 0]]);
    // Prise posée dessus, tournée aussi.
    expect(g.ports.find((p) => p.t === "p")).toMatchObject({ dir: "top", px: 0.5, py: 0.5 });
  });
  it("fait des grands tuyaux un port de 2 cases", () => {
    const g = cat.blocks.get("short-large-fluid-pipe")!.geo!;
    expect(g.ports.map((p) => p.span)).toEqual([2, 2]);
  });
});

describe("exemples de la maquette", () => {
  it("1 : Press → Roller, 30 Iron Coil/min et 15 Iron Ingot/min", () => {
    const { L, put, piece } = builder();
    const press = put("press", 0, 0, 0, "press_02"), roller = put("roller", 8, 0, 0, null);
    piece("pipe-turn", 3, 2, ["N", "E"]);
    for (let x = 4; x <= 7; x++) put("short-pipe", x, 2, 1);
    piece("pipe-turn", 8, 2, ["N", "W"]);
    const R = computeSandbox(cat, L);
    expect(R.machines.get(roller)!.shown).toBe("roller_02");
    near(R.stats.outs["iron-coil"]! * 60, 30);
    near(R.stats.ext["iron-ingot"]! * 60, 15);
    expect(R.stats.outs["iron-plate"]).toBeUndefined();
    near(R.stats.energy, 2750);
    expect(R.machines.get(press)!.f).toBe(1);
    expect(noPowerAlerts(R)).toEqual([]);
    expect(R.alerts.map((a) => a.a)).toContainEqual({ k: "unpowered", id: "roller", pct: 0, continued: true });
    near(R.stats.revenue, R.stats.outs["iron-coil"]! * cat.items.get("iron-coil")!.sell!);
    expect(R.stats.pieces).toBe(6);
  });

  it("2 : 5 Roller sur un tuyau de tier I, 80 % et saturation", () => {
    const { L, put, piece } = builder();
    const rollers = [0, 1, 2, 3, 4].map((i) => put("roller", i * 5, 0, 0, "roller_01"));
    put("short-pipe", 3, 2, 0);
    piece("pipe-turn", 3, 3, ["N", "E"]);
    for (let x = 4; x <= 27; x++) {
      if (x % 5 === 3) { put("short-pipe", x, 2, 0); piece("pipe-junction", x, 3, ["W", "E", "N"]); }
      else put("short-pipe", x, 3, 1);
    }
    const R = computeSandbox(cat, L);
    for (const u of rollers) {
      near(R.machines.get(u)!.f, 0.8);
      expect(R.machines.get(u)!.reason).toEqual({ k: "saturatedOut", item: "copper-wire" });
    }
    near(R.stats.outs["copper-wire"], 6);
    // Saturées : le 5e té (x = 23) et les pièces après lui ; 6/s juste avant, sans dépassement.
    const over = R.lanes.filter((l) => l.over).map((l) => L.blocks.find((b) => b.u === l.u)!).map((b) => b.x).sort((a, b) => a - b);
    expect(over).toEqual([23, 24, 25, 26, 27]);
    expect(R.alerts).toContainEqual({ a: { k: "machine", id: "roller", pct: 80, reason: { k: "saturatedOut", item: "copper-wire" } }, n: 5 });
    const sat = R.alerts.find((a) => a.a.k === "saturated")!.a as { offered: number; cap: number };
    near(sat.offered, 7.5);
    expect(sat.cap).toBe(6);
  });

  it("3 : tier III, croisement objet × fluide sans mélange", () => {
    const { L, put, piece } = builder();
    put("press", 0, 0, 0, "press_02");
    const roller = put("roller", 24, 0, 0, null);
    piece("pipe-turn2", 3, 2, ["N", "E"]);
    put("long-pipe2", 4, 2, 1); put("long-pipe2", 8, 2, 1);
    const x = put("fluid-pipe-and-item-intersection", 12, 2, 0);
    put("long-pipe2", 13, 2, 1); put("long-pipe2", 17, 2, 1); put("pipe2", 21, 2, 1); put("short-pipe2", 23, 2, 1);
    piece("pipe-turn2", 24, 2, ["N", "W"]);
    put("long-fluid-pipe2", 12, -2, 0); put("long-fluid-pipe2", 12, 3, 0);
    const R = computeSandbox(cat, L);
    expect(R.machines.get(roller)!.shown).toBe("roller_02");
    near(R.stats.outs["iron-coil"]! * 60, 30);
    expect(noPowerAlerts(R)).toEqual([]);
    const lanes = R.lanes.filter((l) => l.u === x);
    expect(lanes.find((l) => l.lane === 0)!.item).toBe("iron-plate"); // voie ↔
    expect(lanes.find((l) => l.lane === 1)!.item).toBeNull(); // voie ↕ : le fluide, vide
  });
});

describe("cas signalés", () => {
  it("recette ambiguë → « ? »", () => {
    const { L, put } = builder();
    const u = put("roller", 0, 0);
    const R = computeSandbox(cat, L);
    expect(R.machines.get(u)!.shown).toBe("?");
    expect(R.machines.get(u)!.reason).toEqual({ k: "choose" });
  });
  it("le choix du joueur est gardé tant qu'il reste possible", () => {
    const { L, put } = builder();
    const u = put("roller", 0, 0, 0, "roller_05");
    expect(computeSandbox(cat, L).machines.get(u)!.shown).toBe("roller_05");
  });
  it("tuyau mélangé", () => {
    const { L, put, piece } = builder();
    // Sortie du 1er en (3,1) ↓, sortie du 2e (demi-tour) en (4,3) ↑ : un même réseau, deux objets.
    put("press", 0, 0, 0, "press_01"); put("press", 4, 3, 2, "press_02");
    piece("pipe-turn", 3, 2, ["N", "E"]); piece("pipe-turn", 4, 2, ["W", "S"]);
    const R = computeSandbox(cat, L);
    expect(R.alerts.map((a) => a.a)).toContainEqual({ k: "mixed", items: ["copper-plate", "iron-plate"] });
    expect(R.lanes.some((l) => l.mixed)).toBe(true);
  });
  it("pièce non relevée", () => {
    const { L, put } = builder();
    put("pipe-fluid-turn2", 0, 0);
    expect(computeSandbox(cat, L).alerts.map((a) => a.a)).toContainEqual({ k: "missing", id: "pipe-fluid-turn2" });
  });
  it("deux entrées face à face ne se raccordent pas", () => {
    const a = builder();
    a.put("cold-bypass-pipe", 0, 0, 0); a.put("cold-bypass-pipe", 0, 3, 2); // entrées (0,2)↓ et (0,3)↑
    expect(links(cat, a.L)).toEqual([]);
    const b = builder();
    b.put("cold-bypass-pipe", 0, 0, 0); b.put("cold-bypass-pipe", 0, 3, 0); // sortie (0,3)↑ face à l'entrée (0,2)↓
    expect(links(cat, b.L)).toHaveLength(1);
  });
  it("alertes du même type regroupées", () => {
    const { L, put } = builder();
    put("roller", 0, 0); put("roller", 0, 4);
    expect(computeSandbox(cat, L).alerts).toEqual([{ a: { k: "machine", id: "roller", pct: null, reason: { k: "choose" } }, n: 2 }]);
  });
});

describe("grands tuyaux", () => {
  it("se raccordent à un port de 2 cases qui leur fait face exactement", () => {
    const a = builder();
    a.put("short-large-fluid-pipe", 0, 0); a.put("short-large-fluid-pipe", 0, 1);
    expect(links(cat, a.L)).toHaveLength(1);
  });
  it("pas à un port d'une case, ni à un port de 2 cases décalé", () => {
    const a = builder();
    a.put("short-large-fluid-pipe", 0, 0); a.put("short-fluid-pipe2", 0, 1);
    expect(links(cat, a.L)).toEqual([]);
    const b = builder();
    b.put("short-large-fluid-pipe", 0, 0); b.put("short-large-fluid-pipe", 1, 1);
    expect(links(cat, b.L)).toEqual([]);
  });
});

describe("électricité", () => {
  // Coal Generator (prise de sortie), LV Pole (deux prises, 2 400 MF/s chacune), Roller (prise d'entrée).
  const setup = () => {
    const t = builder();
    const gen = t.put("coal-generator", 0, 0), p1 = t.put("lv-pole", 6, 0), m = t.put("roller", 10, 0, 0, "roller_04");
    return { ...t, gen, p1, m };
  };
  const add = (L: Layout, r: ReturnType<typeof powerWires>): Wire[] => { if (!r || !("wires" in r)) throw new Error(JSON.stringify(r)); L.wires.push(...r.wires); return r.wires; };

  it("machine ↔ poteau : une prise du poteau = un flux ; la machine reçoit par les deux", () => {
    const { L, gen, p1, m } = setup();
    expect(add(L, powerWires(cat, L, gen, p1))).toHaveLength(2);
    const ws = add(L, powerWires(cat, L, m, p1));
    expect(ws).toHaveLength(2);
    expect(ws.every((w) => w.a === p1 && w.b === m)).toBe(true);
    expect(new Set(ws.map((w) => w.ia)).size).toBe(2);
    expect(powered(cat, L, m)).toBe(true);
    const need = cat.blocks.get("roller")!.recipes.find((r) => r.id === "roller_04")!.e!;
    const R = computeSandbox(cat, L);
    near(R.powerRatio.get(m)!, (2 * 2400) / need);
    // Une seule prise reliée : moitié moins.
    L.wires = L.wires.filter((w) => !(w.b === m && w.ia === ws[1]!.ia));
    near(computeSandbox(cat, L).powerRatio.get(m)!, 2400 / need);
  });

  it("« continuer sans courant » décoché : la machine ralentit", () => {
    const { L, gen, p1, m } = setup();
    add(L, powerWires(cat, L, gen, p1)); add(L, powerWires(cat, L, p1, m));
    expect(computeSandbox(cat, L).machines.get(m)!.f).toBe(1);
    const need = cat.blocks.get("roller")!.recipes.find((r) => r.id === "roller_04")!.e!;
    near(computeSandbox(cat, L, { runWithoutPower: false }).machines.get(m)!.f, 4800 / need);
    expect(computeSandbox(cat, L).alerts.map((a) => a.a)).toContainEqual({ k: "unpowered", id: "roller", pct: Math.round((4800 / need) * 100), continued: true });
  });

  it("câbles automatiques entre poteaux : (1,0) et (0,1), jamais (1,1) ni (0,0)", () => {
    const { L, put, gen, p1, m } = setup();
    const p2 = put("lv-pole", 6, 6), p3 = put("lv-pole", 12, 6);
    expect(powerWires(cat, L, p2, p3, true)).toBeNull(); // (0,0)
    add(L, powerWires(cat, L, gen, p1));
    const ws = add(L, powerWires(cat, L, p2, p1, true)); // (0,1) : du poteau alimenté vers l'autre
    expect(ws.every((w) => w.a === p1 && w.b === p2)).toBe(true);
    expect(ws).toHaveLength(2);
    expect(powerWires(cat, L, p1, p2, true)).toBeNull(); // (1,1)
    expect(powerWires(cat, L, p2, p3, false)).not.toBeNull(); // à la main : permis
    // Re-clic sur p3 (sans source) : les poteaux alimentés p1 et p2 vers p3, le Roller depuis p3 ; jamais de p3 vers
    // un poteau alimenté. Pas le générateur : c'est sa portée qui compte, et elle n'est pas relevée.
    const auto = autoConnect(cat, L, p3);
    const toP3 = auto.filter((w) => w.b === p3);
    expect(new Set(toP3.map((w) => w.a))).toEqual(new Set([p1, p2]));
    expect(auto.filter((w) => w.a === p3).every((w) => w.b === m)).toBe(true);
  });

  it("portée : un câble trop long est refusé", () => {
    const { L, put, p1 } = setup();
    const far = put("lv-pole", 100, 0);
    expect(powerWires(cat, L, p1, far)).toMatchObject({ err: { k: "tooFar", range: 21 } });
  });

  it("portée : celle du bâtiment d'où part le câble", () => {
    const { L, put, gen, p1 } = setup();
    // Générateur → poteau : portée du générateur, non relevée : posé à la main avec un avertissement, jamais en auto.
    expect(powerWires(cat, L, gen, p1)).toMatchObject({ rangeUnknown: true });
    expect(powerWires(cat, L, p1, gen, true)).toBeNull();
    // HMVT (22 tiles = 44 cases) et LV Pole (21 cases), à 30 cases : seul le câble qui part du HMVT tient.
    const h = put("hmvt", 0, 40), lv = put("lv-pole", 30, 40);
    L.wires.push({ a: gen, ia: powerPortsOf(L, gen)[0]!, b: h, ib: powerPortsOf(L, h)[0]!, t: "p" });
    expect(powerWires(cat, L, lv, h)).toHaveProperty("wires"); // HMVT alimenté → LV
    L.wires = [{ a: gen, ia: powerPortsOf(L, gen)[0]!, b: lv, ib: powerPortsOf(L, lv)[0]!, t: "p" }];
    expect(powerWires(cat, L, lv, h)).toMatchObject({ err: { k: "tooFar", range: 21 } }); // LV alimenté → HMVT
  });
});

const powerPortsOf = (L: Layout, u: number) => {
  const b = L.blocks.find((x) => x.u === u)!;
  return geo(cat.blocks.get(b.id)!, b)!.ports.flatMap((p, i) => (p.dir === "top" && p.t === "p" ? [i] : []));
};

describe("machines collées", () => {
  /** Pose un Roller sous la Press, son entrée objet face au port `target` de la Press. */
  const glued = (target: "e" | "s") => {
    const t = builder();
    const press = t.put("press", 0, 0, 0, "press_02");
    const pb = t.L.blocks[0]!, pg = geo(cat.blocks.get("press")!, pb)!;
    const ip = pg.ports.findIndex((p) => p.t === "o" && p.d === target && p.dir === "S"), cell = pg.ports[ip]!.cells![0]!;
    for (let r = 0; r < 4; r++) {
      const rg = geo(cat.blocks.get("roller")!, { u: 0, id: "roller", x: 0, y: 0, r })!;
      const k = rg.ports.findIndex((p) => p.t === "o" && p.d === "e" && p.dir === "N");
      if (k < 0) continue;
      const [ix, iy] = rg.ports[k]!.cells![0]!;
      const roller = t.put("roller", cell[0] - ix, cell[1] + 1 - iy, r);
      const out = pg.ports.findIndex((p) => p.t === "o" && p.d === "s");
      return { ...t, press, roller, ip, ir: k, out };
    }
    throw new Error("Roller : aucune entrée à tourner vers le haut");
  };

  it("une sortie collée à une entrée s'y raccorde seule ; le choix du joueur remplace ces raccords", () => {
    const { L, press, roller, ir, ip, out } = glued("s");
    expect(ip).toBe(out);
    // Ici le Roller touche la Press par deux contacts : Press → Roller, et la sortie du Roller sur l'entrée de la Press.
    const auto = machineLinks(cat, L);
    expect(auto).toContainEqual(expect.objectContaining({ a: press, ia: out, b: roller, ib: ir, auto: true }));
    expect(auto).toContainEqual(expect.objectContaining({ a: roller, b: press, auto: true }));
    expect(computeSandbox(cat, L).machines.get(press)!.reason).toEqual({ k: "noRecipe" }); // l'Iron Coil revient dans la Press
    L.routes = [{ a: press, ia: out, b: roller, ib: ir }];
    expect(machineLinks(cat, L)).toEqual([expect.objectContaining({ a: press, b: roller, auto: false })]);
    const R = computeSandbox(cat, L);
    expect(R.machines.get(roller)!.shown).toBe("roller_02");
    near(R.stats.outs["iron-coil"]! * 60, 30);
    expect(R.lanes).toEqual([]); // le raccord direct n'est pas une pièce
  });

  it("deux entrées collées : liées, et le joueur envoie la sortie de la Press dans le Roller", () => {
    const { L, press, roller, ip, ir, out } = glued("e");
    expect(ip).not.toBe(out);
    expect(contacts(cat, L)).toHaveLength(1);
    expect(machineLinks(cat, L)).toEqual([]); // rien par défaut
    expect(computeSandbox(cat, L).machines.get(roller)!.shown).not.toBe("roller_02");
    const route = { a: press, ia: out, b: roller, ib: ir };
    expect(routeError(cat, L, route)).toBeNull();
    L.routes = [route];
    const R = computeSandbox(cat, L);
    expect(R.machines.get(roller)!.shown).toBe("roller_02");
    near(R.stats.outs["iron-coil"]! * 60, 30);
    // Une seule marchandise par contact ; une sortie part de son port de sortie ; types différents ; sans contact.
    expect(routeError(cat, L, route)).toBe("full");
    expect(routeError(cat, { ...L, routes: [] }, { a: press, ia: ip, b: roller, ib: ir })).toBe("notOutput");
    const fp = geo(cat.blocks.get("roller")!, L.blocks[1]!)!.ports.findIndex((p) => p.t === "p");
    expect(routeError(cat, { ...L, routes: [] }, { a: press, ia: out, b: roller, ib: fp })).toBe("type");
    L.blocks[1]!.y += 5;
    expect(routeError(cat, { ...L, routes: [] }, route)).toBe("noContact");
    expect(machineLinks(cat, L)).toEqual([]); // la liaison d'une machine déplacée est ignorée
  });
});

describe("recettes à compléter", () => {
  const block = [...cat.blocks.values()].find((b) => b.incomplete.length)!;
  const r = block.incomplete[0]!;
  const fill = { s: 1, in: Object.fromEntries(Object.keys(r.in).map((i) => [i, 1])), out: Object.fromEntries(Object.keys(r.out).map((i) => [i, 1])) };

  it("gardées à part avec ce qui leur manque, jamais dans le calcul", () => {
    expect(r.missing.length).toBeGreaterThan(0);
    expect(block.recipes.some((x) => x.id === r.id)).toBe(false);
  });
  it("complétées par le joueur, elles passent dans le calcul, marquées", () => {
    expect(stillMissing(r, fill)).toEqual([]);
    const c2 = withFills(cat, { [r.id]: fill });
    expect(c2.blocks.get(block.id)!.recipes.find((x) => x.id === r.id)).toMatchObject({ filled: true });
    expect(c2.blocks.get(block.id)!.incomplete.some((x) => x.id === r.id)).toBe(false);
    expect(cat.blocks.get(block.id)!.incomplete.some((x) => x.id === r.id)).toBe(true); // catalogue d'origine intact
  });
  it("une saisie partielle ne suffit pas", () => {
    expect(stillMissing(r, {})).toEqual(r.missing);
    expect(withFills(cat, { [r.id]: {} }).blocks.get(block.id)!.recipes.some((x) => x.id === r.id)).toBe(false);
  });
});
