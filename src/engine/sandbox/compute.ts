// Bac à sable (B1) : ce que donne un montage libre (PLAN-BAC-A-SABLE.md § 5), repris de `compute()` de la maquette.
// 1. raccords face à face ; 2. réseaux de voies (un croisement compte deux voies) ; 3. recettes déduites de ce qui
// arrive ; 4. débits par flot maximal avec la limite de chaque pièce ; 5. électricité, une prise = un flux ;
// 6. bilan et alertes regroupées.

import type { PlacedPort } from "./layout.ts";
import { geo, portKey, facingKey, cellsOf, machineLinks, type Layout, type PlacedGeo, type Placed } from "./layout.ts";
import type { Dir, SbBlock, SbCatalog, SbRecipe } from "./catalog.ts";
import { MaxFlow, type Arc } from "./maxflow.ts";
import { elecRole } from "./wires.ts";

const BIG = 1e12;

/** `runWithoutPower` : continuer le calcul sans courant (sinon la machine ralentit ou s'arrête). */
export type SandboxSettings = { runWithoutPower: boolean };
export const DEFAULT_SETTINGS: SandboxSettings = { runWithoutPower: true };

/** Ce qui limite une machine, en mots de joueur (traduits par l'écran). */
export type Reason =
  | { k: "choose" }
  | { k: "noRecipe" }
  | { k: "mixed" }
  | { k: "saturated"; item: string }
  | { k: "nothing"; item: string }
  | { k: "notEnough"; item: string }
  | { k: "blocked"; item: string }
  | { k: "saturatedOut"; item: string };

export type Alert =
  | { k: "machine"; id: string; pct: number | null; reason: Reason }
  | { k: "saturated"; item: string; offered: number; cap: number; pipe: string }
  | { k: "mixed"; items: string[] }
  | { k: "missing"; id: string }
  | { k: "overlap"; id: string }
  | { k: "unpowered"; id: string; pct: number; continued: boolean }
  | { k: "weakGrid"; need: number; prod: number };

/** `shown` : la recette retenue, « ? » quand plusieurs vont et que le joueur n'a pas choisi, null sinon. */
export type MachineState = { u: number; rec: SbRecipe | null; cand: SbRecipe[]; shown: string | null; f: number; reason: Reason | null };
/** Une voie de tuyau ; `over` : ce que les machines voudraient envoyer dépasse le débit de la pièce. */
export type LaneState = { u: number; lane: number; item: string | null; mixed: boolean; flow: number; offered: number; cap: number; over: boolean };
export type PowerNet = { us: number[]; need: number; got: number; prod: number };

export type SandboxResult = {
  machines: Map<number, MachineState>;
  lanes: LaneState[];
  power: PowerNet[];
  /** Part du courant reçu par chaque machine qui en demande (1 = tout). */
  powerRatio: Map<number, number>;
  stats: {
    /** MF/s consommés (recettes des machines, à leur fraction de marche). */
    energy: number;
    pollution: number;
    price: number;
    pieces: number;
    /** Sorties et entrées du montage, par seconde. */
    outs: Record<string, number>;
    ext: Record<string, number>;
    /** $/s d'après `sellValue` ; les objets sans prix connu sont listés à part. */
    revenue: number;
    unpriced: string[];
    area: [number, number] | null;
  };
  /** Alertes du même type regroupées : `n` = nombre de fois. */
  alerts: { a: Alert; n: number }[];
};

type Term = { u: number; p: PlacedPort; lane: string };
type Comp = { lanes: string[]; src: Term[]; snk: Term[]; open: string[]; conns: { a: string; b: string }[]; items: Set<string> };

export function computeSandbox(cat: SbCatalog, layout: Layout, settings: SandboxSettings = DEFAULT_SETTINGS): SandboxResult {
  let pcap = new Map<number, number>();
  for (let depth = 0; ; depth++) {
    const r = once(cat, layout, settings, pcap);
    if (settings.runWithoutPower || depth >= 4) return r.result;
    // Sans courant, la machine s'arrête si « continuer sans courant » est décoché : on recalcule avec ce plafond.
    let ch = false;
    const next = new Map(pcap);
    for (const [u, mi] of r.result.machines) {
      if (!r.needU.has(u)) continue;
      const c = Math.min(1, mi.f * r.result.powerRatio.get(u)!);
      if (c < (pcap.get(u) ?? 1) - 1e-6) { next.set(u, c); ch = true; }
    }
    if (!ch) return r.result;
    pcap = next;
  }
}

function once(cat: SbCatalog, layout: Layout, settings: SandboxSettings, pcap: Map<number, number>) {
  const def = (b: Placed) => cat.blocks.get(b.id) as SbBlock;
  const byU = new Map(layout.blocks.map((b) => [b.u, b]));
  const D = (u: number) => def(byU.get(u)!);
  const isFluid = (i: string) => !!cat.items.get(i)?.fluid;
  const G = new Map<number, PlacedGeo>();
  for (const b of layout.blocks) { const d = def(b); const g = d && geo(d, b); if (g) G.set(b.u, g); }
  const portAt = new Map<string, { u: number; p: PlacedPort }>();
  for (const [u, g] of G) for (const p of g.ports) if (p.cells) portAt.set(portKey(p.cells, p.dir as Dir), { u, p });
  const pipeOf = (u: number) => D(u).pipe;
  const laneOf = (u: number, p: PlacedPort) => (pipeOf(u)?.role === "croisement" ? (p.dir === "N" || p.dir === "S" ? 1 : 0) : 0);
  const par = new Map<string, string>();
  const find = (a: string): string => { while (par.get(a) !== a) { par.set(a, par.get(par.get(a)!)!); a = par.get(a)!; } return a; };
  const node = (u: number, l: number) => { const k = `${u}:${l}`; if (!par.has(k)) par.set(k, k); return k; };
  const pid = (u: number, p: PlacedPort) => `${u}|${p.cells![0]}|${p.dir}`;
  const conns: { a: string; b: string }[] = [], terms: Term[] = [], linked = new Set<string>(), open: string[] = [];

  // 1. Raccords : face à face, même type ; au moins un tuyau ; jamais deux entrées ni deux sorties.
  for (const [u, g] of G) for (const p of g.ports) {
    if (!p.cells) continue; // prises électriques et logiques : câbles
    const pa = pipeOf(u);
    if (pa) node(u, laneOf(u, p));
    const q = portAt.get(facingKey(p));
    if (!q || q.u === u || q.p.t !== p.t) continue;
    const pb = pipeOf(q.u);
    if ((!pa && !pb) || (p.d === "e" && q.p.d === "e") || (p.d === "s" && q.p.d === "s")) continue;
    if (!pa) continue;
    linked.add(pid(u, p));
    const a = node(u, laneOf(u, p));
    if (pb) {
      const b = node(q.u, laneOf(q.u, q.p));
      if (pid(u, p) < pid(q.u, q.p)) conns.push({ a, b });
      par.set(find(a), find(b));
    } else if (q.p.d !== "l") terms.push({ u: q.u, p: q.p, lane: a });
  }
  for (const [u, g] of G) if (pipeOf(u)) for (const p of g.ports) if (p.cells && !linked.has(pid(u, p))) open.push(node(u, laneOf(u, p)));
  // Machines collées : chaque raccord direct est une voie sans pièce (numéro négatif), donc sans limite de débit.
  machineLinks(cat, layout).forEach((r, k) => {
    const pa = G.get(r.a)?.ports[r.ia], pb = G.get(r.b)?.ports[r.ib];
    if (!pa || !pb) return;
    const l = node(-(k + 1), 0);
    terms.push({ u: r.a, p: pa, lane: l }, { u: r.b, p: { ...pb, d: "e" }, lane: l });
  });

  // 2. Réseaux
  const comps = new Map<string, Comp>();
  const comp = (l: string) => { const r = find(l); if (!comps.has(r)) comps.set(r, { lanes: [], src: [], snk: [], open: [], conns: [], items: new Set() }); return comps.get(r)!; };
  for (const l of par.keys()) comp(l).lanes.push(l);
  for (const c of conns) comp(c.a).conns.push(c);
  for (const t of terms) (t.p.d === "s" ? comp(t.lane).src : comp(t.lane).snk).push(t);
  for (const l of open) comp(l).open.push(l);
  const compOf = new Map<Term, Comp>();
  for (const t of terms) compOf.set(t, comp(t.lane));

  // 3. Recettes déduites de ce qui arrive ; plusieurs possibles → « ? », le choix du joueur est gardé s'il va.
  const MI = new Map<number, MachineState & { fin: number; why: ["in" | "out", string] | null }>();
  for (const [u] of G) { const d = D(u); if (!d.pipe) MI.set(u, { u, rec: null, cand: d.recipes, shown: null, f: 0, fin: 0, reason: null, why: null }); }
  const outItem = (u: number, p: PlacedPort): string | null => {
    const mi = MI.get(u);
    if (!mi?.rec) return null;
    const outs = Object.keys(mi.rec.out).filter((i) => isFluid(i) === (p.t === "f"));
    if (!outs.length) return null;
    // Les objets du port (S38), puis l'infobulle relevée (BAS-03), sinon répartition dans l'ordre (à vérifier).
    const byItems = p.items?.length ? outs.filter((i) => p.items!.includes(i)) : [];
    if (byItems.length) return byItems[0]!;
    const byTip = p.tip ? outs.filter((i) => p.tip!.toLowerCase().includes((cat.items.get(i)?.name ?? i).toLowerCase())) : [];
    if (byTip.length) return byTip[0]!;
    const ps = G.get(u)!.ports.filter((q) => q.d === "s" && q.t === p.t);
    return outs[ps.indexOf(p) % outs.length]!;
  };
  for (let pass = 0; pass < 8; pass++) {
    for (const c of comps.values()) { c.items = new Set(); for (const s of c.src) { const i = outItem(s.u, s.p); if (i) c.items.add(i); } }
    for (const [u, mi] of MI) {
      const d = D(u), arr = new Set<string>();
      for (const t of terms) if (t.u === u && t.p.d === "e") for (const i of compOf.get(t)!.items) arr.add(i);
      mi.cand = arr.size ? d.recipes.filter((r) => [...arr].every((i) => i in r.in)) : d.recipes;
      mi.rec = mi.cand.length === 1 ? mi.cand[0]! : mi.cand.find((r) => r.id === byU.get(u)!.choice) ?? null;
      mi.shown = mi.rec ? mi.rec.id : mi.cand.length > 1 ? "?" : null;
    }
  }

  // 4. Débits : chaque machine tourne à f ≤ 1, recalculé jusqu'à l'équilibre.
  for (const mi of MI.values()) mi.f = mi.fin = mi.rec ? 1 : 0;
  const rate = (u: number, i: string, side: "in" | "out") => { const r = MI.get(u)?.rec; return r?.[side][i] ? r[side][i]! / r.s : 0; };
  const laneId = (l: string) => l.split(":").map(Number) as [number, number];
  const capOf = (l: string) => { const u = laneId(l)[0]; return u < 0 ? BIG : pipeOf(u)?.flow ?? BIG; };
  const cnt = new Map<string, number>(); // ports raccordés par machine et par objet, pour partager le débit
  const inc = (k: string) => cnt.set(k, (cnt.get(k) || 0) + 1);
  for (const c of comps.values()) {
    const item = c.items.size === 1 ? [...c.items][0] : null;
    for (const t of c.src) { const i = outItem(t.u, t.p); if (i) inc(`${t.u}|s|${i}`); }
    if (item) for (const t of c.snk) inc(`${t.u}|e|${item}`);
  }
  let deliv = new Map<string, number>(), sent = new Map<string, number>(), supp = new Map<string, number>();
  const lanes = new Map<string, LaneState>();
  for (let it = 0; it < 40; it++) {
    deliv = new Map(); sent = new Map(); supp = new Map();
    const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) || 0) + v);
    for (const c of comps.values()) {
      const item = c.items.size === 1 ? [...c.items][0] : null, idx = new Map(c.lanes.map((l, i) => [l, i]));
      const srcs = c.src.filter((s) => outItem(s.u, s.p)), snks = c.snk.filter((s) => MI.get(s.u)?.rec);
      // Saturation jugée sur ce que les machines voudraient envoyer (freinées par leurs entrées seulement).
      const sup = (s: Term, want = false) => { const i = outItem(s.u, s.p)!, m = MI.get(s.u)!; return ((want ? m.fin : m.f) * rate(s.u, i, "out")) / (cnt.get(`${s.u}|s|${i}`) || 1); };
      const dem = (s: Term) => (item ? (MI.get(s.u)!.f * rate(s.u, item, "in")) / (cnt.get(`${s.u}|e|${item}`) || 1) : 0);
      const laneState = (l: string, o: Partial<LaneState>): LaneState => { const [u, lane] = laneId(l); return { u, lane, item: null, mixed: false, flow: 0, offered: 0, cap: capOf(l), over: false, ...o }; };
      if (!item) { // vide ou mélangé : rien ne passe
        for (const s of srcs) { const i = outItem(s.u, s.p)!; add(supp, `${s.u}|${i}`, sup(s)); add(sent, `${s.u}|${i}`, c.snk.length || c.items.size > 1 ? 0 : sup(s)); }
        for (const s of snks) for (const i of Object.keys(MI.get(s.u)!.rec!.in)) if (c.items.size > 1 || !isFluid(i) === (s.p.t === "o")) add(deliv, `${s.u}|${i}`, 0);
        for (const l of c.lanes) lanes.set(l, laneState(l, { mixed: c.items.size > 1 }));
        continue;
      }
      const run = (limited: boolean) => {
        const n = c.lanes.length, F = new MaxFlow(2 * n + 2), S0 = 2 * n, T0 = 2 * n + 1;
        const na = c.lanes.map((l, i) => F.add(2 * i, 2 * i + 1, limited ? capOf(l) : BIG));
        for (const k of c.conns) { F.add(2 * idx.get(k.a)! + 1, 2 * idx.get(k.b)!, BIG); F.add(2 * idx.get(k.b)! + 1, 2 * idx.get(k.a)!, BIG); }
        const sa = srcs.map((s) => F.add(S0, 2 * idx.get(s.lane)!, outItem(s.u, s.p) === item ? sup(s, !limited) : 0));
        const ta: Arc[] = snks.map((s) => F.add(2 * idx.get(s.lane)! + 1, T0, MI.get(s.u)!.rec!.in[item] ? dem(s) : 0));
        F.run(S0, T0); // les machines d'abord
        for (const l of c.open) F.add(2 * idx.get(l)! + 1, T0, BIG); // puis les bouts ouverts (sorties du montage)
        F.run(S0, T0);
        return { na, sa, ta };
      };
      const A = run(true), U = run(false);
      c.lanes.forEach((l, i) => lanes.set(l, laneState(l, { item, flow: A.na[i]!.f, offered: U.na[i]!.f, over: U.na[i]!.f > capOf(l) + 1e-9 })));
      // Quand tout ne passe pas, toutes les sources ralentissent d'autant (et non une seule coupée).
      const tot = srcs.reduce((a, s) => a + sup(s), 0), ratio = tot > 1e-12 ? A.sa.reduce((a, x) => a + x.f, 0) / tot : 1;
      for (const s of srcs) { const i = outItem(s.u, s.p)!; add(supp, `${s.u}|${i}`, sup(s)); add(sent, `${s.u}|${i}`, sup(s) * ratio); }
      snks.forEach((s, i) => { if (MI.get(s.u)!.rec!.in[item]) add(deliv, `${s.u}|${item}`, A.ta[i]!.f); });
    }
    let change = 0;
    for (const [u, mi] of MI) {
      if (!mi.rec) continue;
      let inL = 1, inW: string | null = null, outL = 1, outW: string | null = null;
      for (const i of Object.keys(mi.rec.in)) { const k = `${u}|${i}`; if (!deliv.has(k)) continue; const r = deliv.get(k)! / (mi.rec.in[i]! / mi.rec.s); if (r < inL - 1e-9) { inL = r; inW = i; } }
      for (const i of Object.keys(mi.rec.out)) { const k = `${u}|${i}`; if (!(supp.get(k)! > 1e-12)) continue; const r = (mi.f * sent.get(k)!) / supp.get(k)!; if (r < outL - 1e-9) { outL = r; outW = i; } }
      const nf = Math.max(0, Math.min(1, inL, outL, mi.f, pcap.get(u) ?? 1));
      mi.fin = Math.min(mi.fin, inL);
      if (inL < outL - 1e-9) mi.why = ["in", inW!]; else if (outL < inL - 1e-9) mi.why = ["out", outW!]; else if (nf > 0.999) mi.why = null;
      change = Math.max(change, Math.abs(nf - mi.f));
      mi.f = nf;
    }
    if (change < 1e-7) break;
  }

  // Raisons
  const lanesOver = (c: Comp) => c.lanes.some((l) => lanes.get(l)?.over);
  for (const [u, mi] of MI) {
    mi.reason = null;
    if (!mi.rec) { mi.reason = mi.cand.length > 1 ? { k: "choose" } : !mi.cand.length && D(u).recipes.length ? { k: "noRecipe" } : null; continue; }
    if (!mi.why || mi.f > 0.999) continue;
    const [side, i] = mi.why;
    if (side === "in") {
      const c = [...comps.values()].find((c2) => c2.snk.some((t) => t.u === u) && (c2.items.has(i) || c2.items.size !== 1));
      mi.reason = c && c.items.size > 1 ? { k: "mixed" } : c && lanesOver(c) ? { k: "saturated", item: i } : !c?.src.length ? { k: "nothing", item: i } : { k: "notEnough", item: i };
    } else {
      const cs = [...comps.values()].filter((c2) => c2.src.some((t) => t.u === u));
      mi.reason = cs.some(lanesOver) ? { k: "saturatedOut", item: i } : { k: "blocked", item: i };
    }
  }

  // 5. Électricité : générateurs → prises (une prise de poteau transporte au plus son « transfer ») → entrées.
  const pList: { u: number; i: number; p: PlacedPort }[] = [], pIdx = new Map<string, number>();
  for (const [u, g] of G) g.ports.forEach((p, i) => { if (p.dir === "top" && p.t === "p") { pIdx.set(`${u}:${i}`, pList.length); pList.push({ u, i, p }); } });
  const PF = new MaxFlow(2 * pList.length + 2), PS = 2 * pList.length, PT = PS + 1;
  const gens: { k: number; cap: number }[] = [], uses: { u: number; k: number; need: number; arc?: Arc }[] = [];
  pList.forEach(({ u, p }, k) => {
    const d = D(u), mi = MI.get(u), same = (dd: string) => G.get(u)!.ports.filter((q) => q.dir === "top" && q.t === "p" && q.d === dd).length;
    PF.add(2 * k, 2 * k + 1, elecRole(cat, layout, u) === "pole" && d.elec?.cap ? d.elec.cap : BIG);
    if (p.d === "s" && d.elec?.out != null) {
      const o = Array.isArray(d.elec.out) ? Math.max(...d.elec.out) : d.elec.out;
      gens.push({ k, cap: (o * (mi?.rec ? mi.f : 1)) / same("s") });
    }
    if (p.d === "e" && mi?.rec?.e != null && mi.rec.e > 0) uses.push({ u, k, need: (mi.rec.e * mi.f) / same("e") });
  });
  const wired = layout.wires.filter((w) => w.t === "p").map((w) => [pIdx.get(`${w.a}:${w.ia}`), pIdx.get(`${w.b}:${w.ib}`)] as const).filter(([a, b]) => a != null && b != null) as [number, number][];
  for (const [a, b] of wired) PF.add(2 * a + 1, 2 * b, BIG);
  for (const x of gens) PF.add(PS, 2 * x.k, x.cap);
  for (const x of uses) x.arc = PF.add(2 * x.k + 1, PT, x.need);
  PF.run(PS, PT);
  // Réseaux (prises reliées par des câbles, sans tenir compte du sens).
  const par2 = pList.map((_, k) => k), f2 = (a: number): number => { while (par2[a] !== a) a = par2[a] = par2[par2[a]!]!; return a; };
  for (const [a, b] of wired) par2[f2(a)] = f2(b);
  const nets = new Map<number, { us: Set<number>; need: number; got: number; prod: number; wired: boolean }>();
  const netOf = (k: number) => { const r = f2(k); if (!nets.has(r)) nets.set(r, { us: new Set(), need: 0, got: 0, prod: 0, wired: false }); return nets.get(r)!; };
  for (const [a] of wired) netOf(a).wired = true;
  pList.forEach(({ u }, k) => netOf(k).us.add(u));
  for (const x of gens) netOf(x.k).prod += x.cap;
  const ratio = new Map<number, number>(), needU = new Map<number, number>();
  for (const x of uses) { const n = netOf(x.k); n.need += x.need; n.got += x.arc!.f; needU.set(x.u, (needU.get(x.u) || 0) + x.need); ratio.set(x.u, (ratio.get(x.u) || 0) + x.arc!.f); }
  for (const [u, nd] of needU) ratio.set(u, nd > 1e-9 ? ratio.get(u)! / nd : 1);

  // 6. Bilan
  const prod: Record<string, number> = {}, used: Record<string, number> = {}, ext: Record<string, number> = {};
  let energy = 0, pollution = 0, price = 0, pieces = 0;
  for (const [u, mi] of MI) {
    const r = mi.rec;
    if (!r) continue;
    energy += (r.e ?? 0) * mi.f;
    pollution += D(u).poll * mi.f;
    for (const [i, q] of Object.entries(r.out)) prod[i] = (prod[i] || 0) + (mi.f * q) / r.s;
    for (const [i, q] of Object.entries(r.in)) {
      const k = `${u}|${i}`;
      if (deliv.has(k)) used[i] = (used[i] || 0) + deliv.get(k)!;
      else ext[i] = (ext[i] || 0) + (mi.f * q) / r.s;
    }
  }
  const outs: Record<string, number> = {};
  for (const i in prod) { const v = prod[i]! - (used[i] || 0); if (v > 1e-9) outs[i] = v; }
  let revenue = 0;
  const unpriced: string[] = [];
  for (const [i, v] of Object.entries(outs)) { const s = cat.items.get(i)?.sell; if (s == null) unpriced.push(i); else revenue += v * s; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const seenCell = new Set<string>();
  const alerts: Alert[] = [];
  for (const b of layout.blocks) {
    const d = def(b);
    if (!d) continue;
    price += d.cost ?? 0;
    if (d.pipe) pieces++;
    if (!d.geo) alerts.push({ k: "missing", id: b.id });
    let clash = false;
    for (const [x, y] of cellsOf(d, b)) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      const k = `${x},${y}`;
      if (seenCell.has(k)) clash = true;
      seenCell.add(k);
    }
    if (clash) alerts.push({ k: "overlap", id: b.id });
  }
  for (const [u, mi] of MI) if (mi.reason) alerts.push({ k: "machine", id: D(u).id, pct: mi.rec ? Math.round(mi.f * 100) : null, reason: mi.reason });
  const seenL = new Set<string>();
  for (const L of lanes.values()) if (L.over && !seenL.has(L.item!)) { seenL.add(L.item!); alerts.push({ k: "saturated", item: L.item!, offered: L.offered, cap: L.cap, pipe: D(L.u).id }); }
  for (const c of comps.values()) if (c.items.size > 1) alerts.push({ k: "mixed", items: [...c.items].sort() });
  for (const [u, r] of ratio) if (r < 0.999) alerts.push({ k: "unpowered", id: D(u).id, pct: Math.round(r * 100), continued: settings.runWithoutPower });
  for (const n of nets.values()) if (n.wired && n.prod > 0 && n.need > n.prod + 1e-9) alerts.push({ k: "weakGrid", need: n.need, prod: n.prod });
  const grouped = new Map<string, { a: Alert; n: number }>();
  for (const a of alerts) { const k = JSON.stringify(a), g = grouped.get(k); if (g) g.n++; else grouped.set(k, { a, n: 1 }); }

  const machines = new Map<number, MachineState>();
  for (const [u, { fin: _fin, why: _why, ...m }] of MI) machines.set(u, m);
  return {
    needU,
    result: {
      machines,
      lanes: [...lanes.values()].filter((L) => L.u >= 0),
      power: [...nets.values()].filter((n) => n.wired).map((n) => ({ us: [...n.us], need: n.need, got: n.got, prod: n.prod })),
      powerRatio: ratio,
      stats: { energy, pollution, price, pieces, outs, ext, revenue, unpriced, area: x1 >= x0 ? [x1 - x0 + 1, y1 - y0 + 1] as [number, number] : null },
      alerts: [...grouped.values()],
    } satisfies SandboxResult,
  };
}
