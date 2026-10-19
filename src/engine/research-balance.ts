// Solde de RP avec le plafond souple (lot S20) : installation du joueur par tier, RP estimés à un
// instant, temps pour atteindre un solde, vitesse à un solde donné, stations à ajouter. Pur.
//
// Au-delà du seuil d'un tier, ses RP/s sont multipliés par 10^(1−x) (tiers 1 à 3) ou 10^(1−√x)
// (tier 4), x = solde ÷ seuil (wiki, Research System). Le solde est celui des RP non dépensés.
// Pour un seul seuil (tiers 1 à 3), dRP/dt = r·10^(1−RP/seuil) s'intègre exactement :
//   10^(RP/seuil − 1) = 10^(RP₀/seuil − 1) + ln 10 · r · t ÷ seuil.
// Plusieurs seuils, ou le tier 4 : intégration numérique (Simpson).
//
// Supposé (data/a-verifier.md, RP-04, RP-05, RP-11, RP-12) : un seuil par tier, appliqué aux RP/s
// de ce tier ; la part des paraboles se répartit entre les tiers au prorata et baisse avec eux ;
// des groupes d'items différents dans un tier additionnent leurs valeurs et leurs facteurs de seuil.

import type { GameData } from "./data.ts";
import {
  circuitRate,
  dishesNeeded,
  groupSum,
  satelliteBoost,
  softCapFactor,
  tierCap,
  tierRate,
  tierSumFromPanel,
  type RpParams,
  type StationKind,
  type TierSum,
} from "./research-points.ts";

export const TIERS: StationKind[] = ["rs1", "rs2", "rs3", "rs4"];

/** Un tier en marche : RP/s nominaux (stations + part des paraboles), seuil, circuits Logic (sous le seuil). */
export type RpTier = { kind: StationKind; rate: number; cap: number; circuits?: number };

// ---------------------------------------------------------------- vitesse et solde

/** RP/s quand le solde vaut `rp`. */
export function rateAt(tiers: readonly RpTier[], rp: number): number {
  return tiers.reduce((s, t) => s + t.rate * softCapFactor(rp, t.cap, t.kind) + (t.circuits && rp < t.cap ? t.circuits : 0), 0);
}

/** RP/s sous tous les seuils. */
export const nominalRate = (tiers: readonly RpTier[]) => tiers.reduce((s, t) => s + t.rate + (t.circuits ?? 0), 0);

/** Un seul seuil fini, tiers 1 à 3, sans circuits : la formule exacte s'applique. */
const exactTier = (tiers: readonly RpTier[]): RpTier | null => {
  const t = tiers.length === 1 ? tiers[0]! : null;
  return t && t.kind !== "rs4" && !t.circuits && Number.isFinite(t.cap) && t.cap > 0 ? t : null;
};

/** Solde au bout de `t` secondes, depuis `rp0`, à `rate` RP/s nominaux et un seuil `cap` (tiers 1 à 3). */
export function exactBalance(rp0: number, rate: number, cap: number, t: number): number {
  if (rate <= 0 || t <= 0) return rp0;
  let rp = rp0;
  let left = t;
  if (rp < cap) {
    const below = (cap - rp) / rate;
    if (left <= below) return rp + rate * left;
    left -= below;
    rp = cap;
  }
  return cap * (1 + Math.log10(10 ** (rp / cap - 1) + (Math.LN10 * rate * left) / cap));
}

/** Secondes pour passer d'un solde `from` à `to` (sans rien dépenser) ; Infinity si la vitesse est nulle. */
export function timeToReach(tiers: readonly RpTier[], from: number, to: number): number {
  if (to <= from) return 0;
  if (!(nominalRate(tiers) > 0)) return Infinity;
  const one = exactTier(tiers);
  if (one) {
    const r = one.rate;
    const c = one.cap;
    const below = Math.max(0, Math.min(to, c) - from) / r;
    if (to <= c) return below;
    const a = Math.max(from, c);
    return below + (c * (10 ** (to / c - 1) - 10 ** (a / c - 1))) / (Math.LN10 * r);
  }
  // Morceaux entre les seuils : vitesse constante sous le plus petit, Simpson au-delà.
  const caps = tiers.map((t) => t.cap).filter((c) => Number.isFinite(c) && c > from && c < to);
  const points = [from, ...[...new Set(caps)].sort((x, y) => x - y), to];
  const minCap = Math.min(...tiers.map((t) => t.cap));
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (b <= minCap) {
      total += (b - a) / rateAt(tiers, a);
      continue;
    }
    const scale = Number.isFinite(minCap) && minCap > 0 ? minCap : b - a;
    const steps = 2 * Math.min(10000, Math.max(100, Math.ceil(((b - a) / scale) * 200)));
    const h = (b - a) / steps;
    let sum = 0;
    for (let k = 0; k <= steps; k++) {
      const w = k === 0 || k === steps ? 1 : k % 2 ? 4 : 2;
      const r = rateAt(tiers, a + k * h);
      if (!(r > 0)) return Infinity;
      sum += w / r;
    }
    total += (sum * h) / 3;
  }
  return total;
}

/** Solde au bout de `t` secondes, depuis `rp0`, sans rien dépenser. */
export function balanceAfter(tiers: readonly RpTier[], rp0: number, t: number): number {
  const nominal = nominalRate(tiers);
  if (!(nominal > 0) || t <= 0) return rp0;
  const one = exactTier(tiers);
  if (one) return exactBalance(rp0, one.rate, one.cap, t);
  if (tiers.every((x) => !Number.isFinite(x.cap))) return rp0 + nominal * t;
  // La vitesse ne dépasse jamais la vitesse nominale : le solde est entre rp0 et rp0 + nominal·t.
  let lo = rp0;
  let hi = rp0 + nominal * t;
  for (let i = 0; i < 60 && hi - lo > 1e-6 * Math.max(1, hi); i++) {
    const mid = (lo + hi) / 2;
    if (timeToReach(tiers, rp0, mid) <= t) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Solde où la vitesse tombe à 1 % de la vitesse nominale (« Max RP before RP/s is nearly zero »). */
export function nearlyZero(tiers: readonly RpTier[]): number | null {
  const nominal = nominalRate(tiers);
  const finite = tiers.filter((t) => Number.isFinite(t.cap) && t.cap > 0);
  if (!(nominal > 0) || finite.length !== tiers.length) return null;
  let lo = Math.min(...finite.map((t) => t.cap));
  let hi = 9 * Math.max(...finite.map((t) => t.cap));
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (rateAt(tiers, mid) > nominal / 100) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Temps pour débloquer des recherches dans l'ordre (chaque déblocage dépense son coût), depuis `rp0`. */
export function balanceTimeline(nodes: { id: string; rp: number }[], rp0: number, tiers: readonly RpTier[]): { node: string; rp: number; at: number; overCap: boolean }[] | null {
  if (!(nominalRate(tiers) > 0)) return null;
  const minCap = Math.min(...tiers.map((t) => t.cap));
  let t = 0;
  let rp = rp0;
  return nodes.map((n) => {
    t += timeToReach(tiers, rp, n.rp);
    rp = Math.max(rp, n.rp) - n.rp;
    return { node: n.id, rp: n.rp, at: t, overCap: n.rp > minCap };
  });
}

// ---------------------------------------------------------------- ce que le joueur saisit

/** Une ligne du Research Tracking Panel. */
export type PanelTier = { stations: number | null; rate: number | null; cap: number | null };
/** Stations identiques d'un tier (niveau détaillé). RS4 : `logic` = mini-jeu résolu. */
export type StationGroup = { count: number; items: string[]; logic?: boolean };
export type ControllerGroup = { count: number; fluid: string };

/** « Ma recherche » (Mon usine) : les deux niveaux de saisie, gardés tous les deux. */
export type ResearchSetup = {
  mode: "rapide" | "detaille";
  panel: Record<StationKind, PanelTier>;
  /** Écran du bas : contrôleurs actifs, leurs RP/s, paraboles alimentées, efficacité (%). */
  dish: { controllers: number | null; rate: number | null; dishes: number | null; efficiency: number | null };
  maxRp: number | null;
  groups: Record<StationKind, StationGroup[]>;
  controllers: ControllerGroup[];
};

const EMPTY_PANEL: PanelTier = { stations: null, rate: null, cap: null };
export const emptySetup = (): ResearchSetup => ({
  mode: "rapide",
  panel: { rs1: { ...EMPTY_PANEL }, rs2: { ...EMPTY_PANEL }, rs3: { ...EMPTY_PANEL }, rs4: { ...EMPTY_PANEL } },
  dish: { controllers: null, rate: null, dishes: null, efficiency: null },
  maxRp: null,
  groups: { rs1: [], rs2: [], rs3: [], rs4: [] },
  controllers: [],
});

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** Relit une saisie gardée (navigateur ou fichier exporté) ; null si absente. */
export function parseResearchSetup(raw: unknown): ResearchSetup | null {
  if (!raw || typeof raw !== "object") return null;
  const r = obj(raw);
  const s = emptySetup();
  s.mode = r.mode === "detaille" ? "detaille" : "rapide";
  for (const k of TIERS) {
    const p = obj(obj(r.panel)[k]);
    s.panel[k] = { stations: num(p.stations), rate: num(p.rate), cap: num(p.cap) };
    s.groups[k] = arr(obj(r.groups)[k]).flatMap((g) => {
      const o = obj(g);
      const count = num(o.count);
      const items = arr(o.items).filter((i): i is string => typeof i === "string");
      return count !== null ? [{ count, items, ...(o.logic === true ? { logic: true } : {}) }] : [];
    });
  }
  const d = obj(r.dish);
  s.dish = { controllers: num(d.controllers), rate: num(d.rate), dishes: num(d.dishes), efficiency: num(d.efficiency) };
  s.maxRp = num(r.maxRp);
  s.controllers = arr(r.controllers).flatMap((g) => {
    const o = obj(g);
    const count = num(o.count);
    return count !== null && typeof o.fluid === "string" ? [{ count, fluid: o.fluid }] : [];
  });
  return s;
}

/** Nombre d'items par station selon le tier. */
export const itemsPerStation = (kind: StationKind) => (kind === "rs1" ? 0 : kind === "rs2" ? 1 : 2);

// ---------------------------------------------------------------- modèle

/** Un tier du modèle, avec de quoi l'expliquer. */
export type TierModel = RpTier & {
  /** Stations actives (null : inconnu au niveau rapide). */
  stations: number | null;
  /** RP/s des stations seules, et part des paraboles. */
  stationsRate: number;
  boostRate: number;
  sum: TierSum;
  /** RS4 dont le mini-jeu Logic est résolu (niveau détaillé). */
  logic: number;
  /** Seuil inconnu (non saisi) : ce tier ne ralentit pas. */
  capMissing: boolean;
};

export type Check = { label: string; computed: number; panel: number; ok: boolean; digits: number };

export type RpModel = {
  /** D'où viennent les nombres : le panneau, les stations, ou seulement les RP/s de la 1ʳᵉ ligne. */
  source: "panneau" | "stations" | "rps" | "aucune";
  tiers: TierModel[];
  /** Multiplicateur des paraboles (part ajoutée aux RP/s des stations), efficacité comprise. */
  boost: number;
  /** Détaillé : somme des valeurs des liquides, paraboles pour 100 %, efficacité retenue (0 à 1). */
  liquids: number | null;
  dishesFor100: number | null;
  efficiency: number;
  efficiencyAssumed: boolean;
  /** Contrôles « comme en jeu » (niveau détaillé, ou 1ʳᵉ ligne et Max RP). */
  checks: Check[];
};

const close = (a: number, b: number, digits: number) => Math.abs(a - b) <= Math.max(0.5 * 10 ** -digits, Math.abs(b) * 0.002);

/**
 * Le modèle de la recherche du joueur. `rpPerSec` : la 1ʳᵉ ligne du panneau, utilisée seule (en ligne
 * droite, sans seuil) quand aucun tier n'est renseigné.
 */
export function researchModel(p: RpParams, data: GameData | null, setup: ResearchSetup | null, rpPerSec: number | null, rpNow: number | null): RpModel {
  const s = setup ?? emptySetup();
  const checks: Check[] = [];
  let tiers: TierModel[] = [];
  let boost = 0;
  let liquids: number | null = null;
  let dishesFor100: number | null = null;
  let efficiency = s.dish.efficiency !== null ? Math.max(0, Math.min(1, s.dish.efficiency / 100)) : 1;
  let efficiencyAssumed = s.dish.efficiency === null;
  let source: RpModel["source"] = "aucune";

  if (s.mode === "detaille" && data && TIERS.some((k) => s.groups[k].some((g) => g.count > 0))) {
    source = "stations";
    for (const kind of TIERS) {
      const groups = s.groups[kind].filter((g) => g.count > 0);
      if (!groups.length) continue;
      const sum = groups.reduce<TierSum>(
        (acc, g) => {
          const x = groupSum(p, kind, g.count, g.items, data, !!g.logic);
          return { value: acc.value + x.value, factor: acc.factor + x.factor };
        },
        { value: 0, factor: 0 },
      );
      const cap = tierCap(p, kind, sum.factor);
      const logicStations = kind === "rs4" ? groups.filter((g) => g.logic).reduce((a, g) => a + g.count, 0) : 0;
      tiers.push({
        kind,
        rate: 0,
        cap,
        circuits: logicStations ? circuitRate(p, cap, logicStations) : undefined,
        stations: groups.reduce((a, g) => a + g.count, 0),
        stationsRate: tierRate(p, kind, sum.value),
        boostRate: 0,
        sum,
        logic: logicStations,
        capMissing: false,
      });
    }
    const controllers = s.controllers.filter((c) => c.count > 0);
    if (controllers.length) {
      const value = (id: string) => {
        const v = data.items.get(id)?.researchValue;
        return typeof v === "number" ? v : 0;
      };
      liquids = controllers.reduce((a, c) => a + c.count * value(c.fluid), 0);
      const S = controllers.reduce((a, c) => a + c.count, 0);
      dishesFor100 = dishesNeeded(S, liquids);
      if (s.dish.efficiency === null && s.dish.dishes !== null) {
        // Faute de formule (RP-03) : chaque parabole ajoute la même part, jusqu'à 100 %.
        efficiency = Math.min(1, s.dish.dishes / Math.max(1, dishesFor100));
      }
      boost = satelliteBoost(p, liquids) * efficiency;
    }
  } else {
    const filled = TIERS.filter((k) => (s.panel[k].rate ?? 0) > 0);
    if (filled.length) {
      source = "panneau";
      for (const kind of filled) {
        const row = s.panel[kind];
        const capMissing = !(row.cap !== null && row.cap > 0);
        const cap = capMissing ? Infinity : row.cap!;
        tiers.push({ kind, rate: 0, cap, stations: row.stations, stationsRate: row.rate!, boostRate: 0, sum: tierSumFromPanel(p, kind, row.rate!, cap), logic: 0, capMissing });
      }
      efficiencyAssumed = false;
      efficiency = 1;
      const stationsTotal = tiers.reduce((a, t) => a + t.stationsRate, 0);
      boost = (s.dish.rate ?? 0) > 0 && stationsTotal > 0 ? s.dish.rate! / stationsTotal : 0;
    } else if (rpPerSec && rpPerSec > 0) {
      source = "rps";
      tiers = [{ kind: "rs3", rate: rpPerSec, cap: Infinity, stations: null, stationsRate: rpPerSec, boostRate: 0, sum: { value: 0, factor: 0 }, logic: 0, capMissing: true }];
    }
  }
  if (source !== "rps") {
    for (const t of tiers) {
      t.boostRate = t.stationsRate * boost;
      t.rate = t.stationsRate + t.boostRate;
    }
  }

  // Contrôles : ce que le site calcule contre ce que le panneau affiche.
  if (source === "stations") {
    for (const t of tiers) {
      const row = s.panel[t.kind];
      if (row.rate !== null) checks.push({ label: `Tier ${t.kind.slice(2)} : RP/s`, computed: t.stationsRate, panel: row.rate, ok: close(t.stationsRate, row.rate, 2), digits: 2 });
      if (row.cap !== null) checks.push({ label: `Tier ${t.kind.slice(2)} : seuil`, computed: t.cap, panel: row.cap, ok: close(t.cap, row.cap, 0), digits: 0 });
    }
    const dishRate = tiers.reduce((a, t) => a + t.boostRate, 0);
    if (s.dish.rate !== null) checks.push({ label: "Paraboles : RP/s", computed: dishRate, panel: s.dish.rate, ok: close(dishRate, s.dish.rate, 2), digits: 2 });
  }
  if (source === "stations" || source === "panneau") {
    const nz = nearlyZero(tiers);
    // Le panneau écrit « > 231 000 » : le site arrondit au millier supérieur (supposé, RP-06).
    if (nz !== null && s.maxRp !== null) checks.push({ label: "Max RP before RP/s is nearly zero", computed: nz, panel: s.maxRp, ok: Math.ceil(nz / 1000) * 1000 === s.maxRp || close(nz, s.maxRp, 0), digits: 0 });
    if (rpPerSec !== null && rpNow !== null) {
      const expected = rateAt(tiers, rpNow);
      checks.push({ label: "1ʳᵉ ligne : RP/s", computed: expected, panel: rpPerSec, ok: close(expected, rpPerSec, 2), digits: 2 });
    }
  }
  return { source, tiers, boost, liquids, dishesFor100, efficiency, efficiencyAssumed, checks };
}

// ---------------------------------------------------------------- installations

/**
 * Les tiers après l'ajout de stations : du même tier, elles se fusionnent avec celles du joueur
 * (vitesse et seuil recalculés sur le tier entier) ; sinon, elles forment un nouveau tier. `logic` :
 * RS4 ajoutées dont le mini-jeu est résolu ; `extraRate` : RP/s ajoutés tels quels à ce tier (les
 * paraboles d'une installation neuve) ; les paraboles du joueur s'appliquent à toutes les stations.
 */
export function withAddedStations(p: RpParams, model: RpModel, kind: StationKind, add: TierSum, opts: { logic?: number; extraRate?: number } = {}): RpTier[] {
  const out: RpTier[] = model.source === "rps" ? model.tiers.map((t) => ({ kind: t.kind, rate: t.rate, cap: t.cap })) : model.tiers.map((t) => ({ kind: t.kind, rate: t.rate, cap: t.cap, circuits: t.circuits }));
  const i = model.source === "rps" ? -1 : model.tiers.findIndex((t) => t.kind === kind);
  const old = i >= 0 ? model.tiers[i]! : null;
  const sum = { value: (old?.sum.value ?? 0) + add.value, factor: (old?.sum.factor ?? 0) + add.factor };
  const cap = old?.capMissing ? Infinity : tierCap(p, kind, sum.factor);
  const logic = (old?.logic ?? 0) + (opts.logic ?? 0);
  const tier: RpTier = { kind, rate: tierRate(p, kind, sum.value) * (1 + (model.source === "rps" ? 0 : model.boost)) + (opts.extraRate ?? 0), cap };
  if (kind === "rs4" && logic && Number.isFinite(cap)) tier.circuits = circuitRate(p, cap, logic);
  if (i >= 0) out[i] = tier;
  else out.push(tier);
  return out;
}

export type AddProposal = {
  kind: StationKind;
  group: StationGroup;
  /** Stations ajoutées, identiques au groupe. */
  added: number;
  before: { stations: number; stationsRate: number; cap: number };
  after: { stations: number; stationsRate: number; boostRate: number; cap: number };
  tiers: RpTier[];
};

/**
 * « Ajoute N stations aux tiennes » : le plus petit N de stations identiques au plus grand groupe du
 * tier le plus haut (niveau détaillé) pour atteindre `targetRate` RP/s nominaux en tout et un seuil
 * ≥ `capNeeded`. Null si le joueur n'a pas décrit ses stations, ou si rien n'y suffit (≤ `max`).
 */
export function proposeAddStations(p: RpParams, data: GameData, setup: ResearchSetup | null, model: RpModel, targetRate: number, capNeeded: number, max = 200): AddProposal | { reason: string } | null {
  if (!setup || model.source !== "stations") return null;
  const tier = [...model.tiers].reverse().find((t) => setup.groups[t.kind].some((g) => g.count > 0));
  if (!tier) return null;
  const group = [...setup.groups[tier.kind]].filter((g) => g.count > 0).sort((a, b) => b.count - a.count)[0]!;
  if (group.items.filter(Boolean).length < itemsPerStation(tier.kind)) return { reason: "Indique les items de tes stations pour savoir quoi ajouter." };
  const tiersFor = (n: number) => withAddedStations(p, model, tier.kind, groupSum(p, tier.kind, n, group.items, data, !!group.logic), { logic: group.logic ? n : 0 });
  const ok = (n: number) => {
    const ts = tiersFor(n);
    const t = ts.find((x) => x.kind === tier.kind)!;
    return nominalRate(ts) >= targetRate - 1e-9 && t.cap >= capNeeded - 1e-9;
  };
  if (ok(0)) return null;
  let n = 1;
  while (n <= max && !ok(n)) n++;
  if (n > max) return { reason: `Même ${max} stations de plus ne suffisent pas : vise une installation neuve, ou un objectif plus proche.` };
  const ts = tiersFor(n);
  const after = ts.find((x) => x.kind === tier.kind)!;
  const stationsRate = (after.rate) / (1 + model.boost);
  return {
    kind: tier.kind,
    group,
    added: n,
    before: { stations: tier.stations ?? 0, stationsRate: tier.stationsRate, cap: tier.cap },
    after: { stations: (tier.stations ?? 0) + n, stationsRate, boostRate: after.rate - stationsRate, cap: after.cap },
    tiers: ts,
  };
}
