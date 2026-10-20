// Lot S21 : temps de jeu, journal des RP, courbe par morceaux, écart prévision / relevé.
// Point de départ : la capture du 2026-10-18 (19 273,50 RP, 50,40 RP/s ; tier 3 : 4 stations,
// 47,47 RP/s, seuil 76 875 ; paraboles 2,93 RP/s), au niveau rapide de « Ma recherche ».
import { describe, expect, it } from "vitest";
import stationsJson from "../data/research-stations.json";
import type { ResearchStationsFile } from "../src/engine/extension-types.ts";
import { balanceAfter, emptySetup, rateAt, researchModel, type ResearchSetup } from "../src/engine/research-balance.ts";
import { rpParams } from "../src/engine/research-points.ts";
import {
  addEvent,
  gameNow,
  KEEP_MS,
  MERGE_MS,
  needsRecall,
  parseJournal,
  prune,
  readingGap,
  realTimeAt,
  removable,
  removeEvent,
  rpAtGame,
  rpHistory,
  setPlaying,
  startJournal,
  stopAtLastSeen,
  type RpJournal,
  type TiersOf,
} from "../src/engine/rp-history.ts";
import { describeSetupChange, renderHistory, renderPlay } from "../src/ui/rp-chart.ts";
import { EMPTY_PLAYER, exportProgress, parseProgressExport } from "../src/ui/progress.ts";
import type { GameData } from "../src/engine/data.ts";

const p = rpParams(stationsJson as unknown as ResearchStationsFile)!;
const RP0 = 19273.5;
const MIN = 60_000;
const H = 3_600_000;
const t0 = Date.parse("2026-10-20T10:00:00Z");

/** La configuration de la capture (niveau rapide), avec `stations` stations du tier 3 recopiées du panneau. */
function capture(rate = 47.47, cap = 76875, stations = 4): ResearchSetup {
  const s = emptySetup();
  s.panel.rs3 = { stations, rate, cap };
  s.dish.rate = 2.93;
  return s;
}
const tiersOf: TiersOf = (setup, rps) => {
  const m = researchModel(p, null, setup, rps, null);
  return m.source === "aucune" ? null : m.tiers;
};
const tiers = tiersOf(capture(), 50.4)!;
/** Le journal de départ : la capture, hors jeu, au début du temps de jeu. */
const start = () => startJournal(t0, { rp: RP0, rpPerSec: 50.4, rpAt: Date.parse("2026-10-18T15:00:00Z"), research: capture() });
const now = (j: RpJournal, t: number) => {
  const g = gameNow(j.clock, t);
  return rpAtGame(rpHistory(j, tiersOf, g), g)!;
};

describe("temps de jeu (S21)", () => {
  it("la capture devient le premier point, hors jeu : l'heure de la capture ne compte pas", () => {
    const j = start();
    expect(j.clock.playing).toBe(false);
    expect(j.events.map((e) => [e.type, e.g])).toEqual([
      ["config", 0],
      ["releve", 0],
    ]);
    expect(now(j, t0 + 48 * H)).toBe(RP0); // deux jours hors jeu : rien ne bouge
  });

  it("une pause n'ajoute aucun RP, la reprise repart du même solde", () => {
    let j = setPlaying(start(), true, t0);
    const after10 = now(j, t0 + 10 * MIN);
    expect(after10).toBeCloseTo(balanceAfter(tiers, RP0, 600), 6);
    expect(after10).toBeCloseTo(RP0 + 50.4 * 600, 6); // sous le seuil : ligne droite
    j = setPlaying(j, false, t0 + 10 * MIN);
    expect(now(j, t0 + 10 * MIN)).toBeCloseTo(after10, 6);
    expect(now(j, t0 + 9 * H)).toBeCloseTo(after10, 6); // 9 h hors jeu
    j = setPlaying(j, true, t0 + 9 * H);
    expect(now(j, t0 + 9 * H)).toBeCloseTo(after10, 6);
    // 10 min de plus en jeu = 20 min de jeu en tout, comme sans pause (le seuil est franchi entre-temps)
    expect(now(j, t0 + 9 * H + 10 * MIN)).toBeCloseTo(balanceAfter(tiers, RP0, 1200), 4);
    expect(gameNow(j.clock, t0 + 9 * H + 10 * MIN)).toBe(20 * MIN);
    expect(j.events.filter((e) => e.type === "session").map((e) => (e.type === "session" ? e.on : null))).toEqual([true, false, true]);
  });

  it("site fermé pendant « Je joue » : question à la réouverture, arrêt à la fermeture par défaut", () => {
    let j = setPlaying(start(), true, t0);
    j = { ...j, clock: { ...j.clock, seen: t0 + H } }; // dernier signe de vie du site
    expect(needsRecall(j, t0 + H + 20 * MIN)).toBe(false);
    expect(needsRecall(j, t0 + 9 * H)).toBe(true);
    const stopped = stopAtLastSeen(j, t0 + 9 * H);
    expect(stopped.clock.playing).toBe(false);
    expect(gameNow(stopped.clock, t0 + 9 * H)).toBe(H); // 1 h de jeu, pas 9
    const last = stopped.events[stopped.events.length - 1]!;
    expect(last).toMatchObject({ type: "session", on: false, g: H, at: t0 + H });
  });

  it("heure réelle d'un instant de jeu, pendant une session", () => {
    let j = setPlaying(start(), true, t0);
    j = setPlaying(j, false, t0 + H);
    j = setPlaying(j, true, t0 + 10 * H);
    expect(realTimeAt(j, 30 * MIN)).toBe(t0 + 30 * MIN);
    expect(realTimeAt(j, H + 30 * MIN)).toBe(t0 + 10 * H + 30 * MIN); // 2ᵉ session
  });

  it("l'interrupteur dit l'état", () => {
    const j = start();
    expect(renderPlay(j, t0)).toContain("▶ Je joue");
    expect(renderPlay(setPlaying(j, true, t0), t0 + 72 * MIN)).toContain("En jeu depuis 1 h 12 min");
  });
});

describe("journal (S21)", () => {
  it("frappes rapprochées : un seul relevé, la dernière valeur l'emporte ; RP et RP/s réunis", () => {
    let j = setPlaying(start(), true, t0);
    j = addEvent(j, { type: "releve", rp: 1, rps: null }, t0 + 30 * MIN);
    j = addEvent(j, { type: "releve", rp: 12, rps: null }, t0 + 30 * MIN + 1000);
    j = addEvent(j, { type: "releve", rp: 120000, rps: null }, t0 + 30 * MIN + 2000);
    j = addEvent(j, { type: "releve", rp: null, rps: 25.2 }, t0 + 31 * MIN);
    const r = j.events.filter((e) => e.type === "releve");
    expect(r).toHaveLength(2); // la capture + un relevé
    expect(r[1]).toMatchObject({ rp: 120000, rps: 25.2, g: 31 * MIN });
    j = addEvent(j, { type: "releve", rp: 130000, rps: null }, t0 + 31 * MIN + MERGE_MS);
    expect(j.events.filter((e) => e.type === "releve")).toHaveLength(3); // 2 min plus tard : nouveau relevé
  });

  it("une dépense entre deux relevés empêche de les fondre", () => {
    let j = setPlaying(start(), true, t0);
    j = addEvent(j, { type: "releve", rp: 150000, rps: null }, t0 + H);
    j = addEvent(j, { type: "depense", spent: 100000, added: ["foundry"], removed: [] }, t0 + H + 1000);
    j = addEvent(j, { type: "releve", rp: 50000, rps: null }, t0 + H + 2000);
    expect(j.events.map((e) => e.type).slice(-3)).toEqual(["releve", "depense", "releve"]);
  });

  it("dépenses rapprochées : additionnées ; débloquée puis rendue : rien", () => {
    let j = setPlaying(start(), true, t0);
    j = addEvent(j, { type: "depense", spent: 100000, added: ["foundry"], removed: [] }, t0 + H);
    j = addEvent(j, { type: "depense", spent: 125000, added: ["asu"], removed: [] }, t0 + H + 30_000);
    const d = j.events.filter((e) => e.type === "depense");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ spent: 225000, added: ["foundry", "asu"], removed: [] });
    j = addEvent(j, { type: "depense", spent: -225000, added: [], removed: ["foundry", "asu"] }, t0 + H + 60_000);
    expect(j.events.filter((e) => e.type === "depense")).toHaveLength(0);
  });

  it("configuration : notée automatiquement, sauf si rien ne change ; un aller-retour rapide s'efface", () => {
    let j = setPlaying(start(), true, t0);
    const n = j.events.length;
    expect(addEvent(j, { type: "config", setup: capture() }, t0 + H).events).toHaveLength(n); // identique
    j = addEvent(j, { type: "config", setup: capture(54.27, 85534, 5) }, t0 + H);
    expect(j.events).toHaveLength(n + 1);
    expect(addEvent(j, { type: "config", setup: capture() }, t0 + H + 30_000).events).toHaveLength(n); // retour à l'identique
    expect(addEvent(j, { type: "config", setup: capture(55, 85534, 5) }, t0 + H + 30_000).events).toHaveLength(n + 1); // fondue
  });

  it("garde 90 jours de jeu, avec les points de départ plus anciens", () => {
    let j = setPlaying(start(), true, t0);
    j = addEvent(j, { type: "releve", rp: 50000, rps: null }, t0 + 10 * H);
    j = addEvent(j, { type: "config", setup: capture(54.27, 85534, 5) }, t0 + 20 * H);
    j = addEvent(j, { type: "releve", rp: 60000, rps: null }, t0 + 30 * H);
    const late = 30 * H + KEEP_MS + H; // la capture et les deux premiers événements sont trop vieux
    const pr = prune(j, late);
    expect(pr.events.some((e) => e.g === 10 * H)).toBe(false); // relevé remplacé par un plus récent
    expect(pr.events.find((e) => e.type === "config")?.g).toBe(20 * H); // dernière configuration gardée
    expect(pr.events.find((e) => e.type === "releve" && e.rps !== null)?.g).toBe(0); // dernières RP/s connues
    expect(pr.events.some((e) => e.g === 30 * H)).toBe(true);
    const at = (x: RpJournal) => rpAtGame(rpHistory(x, tiersOf, late), late)!;
    expect(at(pr)).toBeCloseTo(at(j), 6); // la courbe actuelle ne change pas
  });

  it("✕ retire un relevé ou une dépense, pas une session ni la configuration en vigueur", () => {
    let j = setPlaying(start(), true, t0);
    j = addEvent(j, { type: "releve", rp: 999999, rps: null }, t0 + H); // faute de frappe
    const i = j.events.length - 1;
    expect(removable(j, i)).toBe(true);
    expect(removable(j, 0)).toBe(false); // seule configuration
    expect(removable(j, 2)).toBe(false); // session
    j = removeEvent(j, i);
    expect(now(j, t0 + 2 * H)).toBeCloseTo(balanceAfter(tiers, RP0, 7200), 4);
  });

  it("export puis import : le journal survit ; un ancien fichier sans journal reste lisible", () => {
    let j = setPlaying(start(), true, t0);
    j = addEvent(j, { type: "depense", spent: 100000, added: ["foundry"], removed: [] }, t0 + H);
    j = setPlaying(j, false, t0 + 2 * H);
    const d = { nodes: new Map(), machines: new Map() } as unknown as GameData;
    const prog = { unlocked: [], reqItemsDone: [], owned: [] };
    const file = JSON.parse(JSON.stringify(exportProgress(prog, EMPTY_PLAYER, new Date(t0), j)));
    const back = parseProgressExport(d, file);
    expect(back.ok && back.history).toEqual(j);
    const old = JSON.parse(JSON.stringify(exportProgress(prog, EMPTY_PLAYER, new Date(t0))));
    expect(old.history).toBeUndefined();
    const read = parseProgressExport(d, old);
    expect(read.ok && read.history).toBeNull();
    expect(parseJournal({ clock: {}, events: [] })).toBeNull();
    expect(parseJournal(JSON.parse(JSON.stringify(j)))).toEqual(j); // navigateur : même lecture
  });
});

describe("courbe de l'historique (S21)", () => {
  // Journal fictif : capture → je joue → 1 h → relevé (+0,6 %) → 15 min → dépense 100 000 → 2 h 45
  // → une 5ᵉ station (le panneau donne 54,27 RP/s et 85 534) → 4 h → relevé.
  const cfg5 = capture(54.27, 85534, 5);
  const t5 = tiersOf(cfg5, 50.4)!;
  let j = setPlaying(start(), true, t0);
  const pred1 = balanceAfter(tiers, RP0, 3600);
  const meas1 = Math.round(pred1 * 1.006);
  j = addEvent(j, { type: "releve", rp: meas1, rps: null }, t0 + H);
  j = addEvent(j, { type: "depense", spent: 100000, added: ["foundry"], removed: [] }, t0 + H + 15 * MIN);
  j = addEvent(j, { type: "config", setup: cfg5 }, t0 + 4 * H);
  j = addEvent(j, { type: "releve", rp: 200000, rps: 2.1 }, t0 + 8 * H);
  const h = rpHistory(j, tiersOf, 10 * H);

  it("morceau par morceau, comme balanceAfter", () => {
    const a = balanceAfter(tiers, meas1, 15 * 60) - 100000;
    const b = balanceAfter(tiers, a, 2.75 * 3600);
    const c = balanceAfter(t5, b, 4 * 3600);
    expect(rpAtGame(h, 30 * MIN)).toBeCloseTo(balanceAfter(tiers, RP0, 1800), 4);
    expect(rpAtGame(h, H + 15 * MIN)).toBeCloseTo(a, 4); // juste après la dépense
    expect(rpAtGame(h, 4 * H)).toBeCloseTo(b, 4);
    expect(h.readings[2]!.predRp).toBeCloseTo(c, 4);
    expect(h.readings[2]!.predRps).toBeCloseTo(rateAt(t5, c), 6);
    expect(rpAtGame(h, 10 * H)).toBeCloseTo(balanceAfter(t5, 200000, 2 * 3600), 4); // prévision : repart du relevé
  });

  it("écart de chaque relevé avec la prévision, en RP et en %", () => {
    expect(readingGap(h.readings[0]!)).toBeNull(); // premier relevé : rien à comparer
    const g1 = readingGap(h.readings[1]!)!;
    expect(g1.rp).toBeCloseTo(meas1 - pred1, 6);
    expect(g1.pct).toBeCloseTo(0.6, 2);
  });

  it("repères : la dépense et la configuration, avec ce qui a changé", () => {
    expect(h.marks.map((m) => m.type)).toEqual(["depense", "config"]);
    const dep = h.marks[0]!;
    expect(dep.type === "depense" && dep.after! - dep.before!).toBeCloseTo(-100000, 6);
    const names = { node: (id: string) => (id === "foundry" ? "Foundry" : id), item: (id: string) => id };
    const cfg = h.marks[1]!;
    expect(cfg.type === "config" && describeSetupChange(cfg.prev, cfg.setup, names)).toBe("tier 3 : stations 4 → 5, RP/s 47,47 → 54,27, seuil 76 875 → 85 534");
    const html = renderHistory(h, j, 8 * H, 24 * H, 375, names, false);
    expect(html.match(/<svg class="rh-svg"/g)).toHaveLength(2);
    expect(html).toContain('class="flag"');
    expect(html).toContain("Foundry débloquée : −100 000 RP");
    expect(html).toContain("<details class=\"more rh-journal\">"); // journal replié par défaut (Q22.3)
  });
});
