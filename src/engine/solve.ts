// Résolution d'une chaîne de production : de l'item cible vers les matières premières.
// Pur : aucune dépendance au DOM. Le résultat (Plan) est sérialisable.

import { Chooser, machineArea, ratePerMachine, type Candidate, type Choice, type Criterion, type EffRecipe, type LeafReason } from "./choose.ts";
import { itemName, type GameData } from "./data.ts";
import type { TreeGrowthResult } from "./pollution.ts";
import type { VerifyFlag } from "./types.ts";
import { machineAccess, orderByDepth, rpCost, type MachineAccess, type Progress, type ReqItem } from "./unlock.ts";

export type PlayerState = Progress & {
  pollutionPct?: number | null;
  money?: number | null;
  rp?: number | null;
  rpPerSec?: number | null;
};

export type SolveRequest = {
  item: string;
  /** Débit voulu, par minute. */
  ratePerMin?: number;
  /** Ou : nombre de machines pour l'étape finale. */
  finalMachines?: number;
  criterion?: Criterion;
  forced?: Record<string, string>;
  useUnverified?: boolean;
};

export type Flow = { item: string; perMin: number };
export type Edge = { from: string; to: string; perMin: number };

export type Step = {
  item: string;
  recipeId: string;
  machine: string;
  machineKind: "machine" | "farm";
  forced: boolean;
  /** Profondeur depuis la cible (0 = item final). */
  depth: number;
  durationS: number;
  /** Production nette de l'item par cycle. */
  outputPerCycle: number;
  ratePerMachine: number;
  demandPerMin: number;
  machinesExact: number;
  machines: number;
  utilization: number;
  inputs: Flow[];
  consumers: Flow[];
  byproducts: Flow[];
  energyMFps: number | null;
  energyAvg: number | null;
  energyPeak: number | null;
  area: number | null;
  footprint: number | null;
  unitCost: number | null;
  buildCost: number | null;
  pollutionPerHour: number | [number, number] | null;
  isRaw: boolean;
  usesUnverified: boolean;
  verify: VerifyFlag[];
  machineVerify: VerifyFlag[];
  access: MachineAccess;
  growth?: TreeGrowthResult;
  /** Autres recettes possibles pour cet item (pour « forcer une recette »). */
  alternatives: Candidate[];
};

export type Unresolved = {
  item: string;
  perMin: number;
  reason: LeafReason;
  /** L'item est produit ailleurs dans la chaîne : seule la demande de la boucle coupée manque. */
  loopShortfall: boolean;
  /** Option de déblocage la moins chère, si l'item est verrouillé. */
  unlock?: Extract<MachineAccess, { available: false }> & { recipeId: string };
  candidates: Candidate[];
};

export type Surplus = { item: string; perMin: number; from: string[]; alsoDemanded: boolean };

export type Warning = { code: string; message: string; items?: string[] };

export type VerifyEntry = {
  scope: "recette" | "machine";
  id: string;
  item: string;
  flag: VerifyFlag;
  /** true : la valeur sert dans le calcul ; false : elle concerne une recette écartée. */
  used: boolean;
};

export type Economy = {
  buildCost: number;
  buildCostUnknown: number;
  money: number | null;
  moneyMissing: number | null;
  /** Nœuds à débloquer pour tout ce qui est verrouillé dans la chaîne (option la moins chère). */
  nodesToUnlock: string[];
  reqItems: ReqItem[];
  rpNeeded: number;
  rp: number | null;
  rpMissing: number | null;
  rpPerSec: number | null;
  secondsToRp: number | null;
  machinesToOwn: string[];
};

export type Plan = {
  status: "ok" | "partiel" | "impossible";
  target: { item: string; ratePerMin: number; finalMachines: number | null };
  criterion: Criterion;
  steps: Step[];
  edges: Edge[];
  raw: Flow[];
  unresolved: Unresolved[];
  surplus: Surplus[];
  totals: {
    machines: number;
    farms: number;
    energyAvg: number;
    energyPeak: number;
    energyUnknownSteps: number;
    footprint: number;
    footprintUnknownSteps: number;
    buildCost: number;
    buildCostUnknownSteps: number;
    pollutionPerHour: [number, number];
    pollutionUnknownSteps: number;
  };
  verify: VerifyEntry[];
  warnings: Warning[];
  economy: Economy;
};

const ceilTol = (x: number) => Math.ceil(x - 1e-9);

export function solve(data: GameData, player: PlayerState, req: SolveRequest): Plan {
  const criterion = req.criterion ?? "machines";
  const chooser = new Chooser(data, player, {
    criterion,
    forced: req.forced ?? {},
    useUnverified: !!req.useUnverified,
    pollutionPct: player.pollutionPct ?? null,
  });
  const name = (id: string) => itemName(data, id);
  const warnings: Warning[] = [];
  if (!data.items.has(req.item)) warnings.push({ code: "item-inconnu", message: `Item inconnu : « ${req.item} ».`, items: [req.item] });

  // 1. Graphe des recettes retenues, depuis la cible.
  const choices = new Map<string, Choice>();
  const consumersOf = new Map<string, Set<string>>(); // producteur → consommateurs
  const cutEdges = new Set<string>(); // "consommateur>entrée" coupées pour boucle
  const order: string[] = []; // post-ordre (entrées avant consommateurs)
  const state = new Map<string, "gris" | "noir">();
  const visit = (item: string, path: string[]) => {
    state.set(item, "gris");
    const c = chooser.choose(item);
    choices.set(item, c);
    if (c.eff) {
      for (const [input, v] of Object.entries(c.eff.net)) {
        if (!(v! < 0)) continue;
        const s = state.get(input);
        if (s === "gris") {
          cutEdges.add(`${item}>${input}`);
          const cyc = [...path.slice(path.indexOf(input)), item, input];
          warnings.push({ code: "boucle", message: `Boucle de dépendance : ${cyc.map(name).join(" → ")}. Cette entrée n'est pas développée.`, items: cyc });
          continue;
        }
        if (!consumersOf.has(input)) consumersOf.set(input, new Set());
        consumersOf.get(input)!.add(item);
        if (!s) visit(input, [...path, item]);
      }
    }
    state.set(item, "noir");
    order.push(item);
  };
  visit(req.item, []);
  const topo = [...order].reverse(); // consommateurs avant producteurs

  // 2. Débit cible.
  const targetChoice = choices.get(req.item)!;
  const targetRate = targetChoice.eff ? ratePerMachine(targetChoice.eff, req.item) : null;
  let ratePerMin = req.ratePerMin ?? 0;
  if (req.finalMachines !== undefined) {
    if (targetRate !== null) ratePerMin = req.finalMachines * targetRate;
    else warnings.push({ code: "machines-finales", message: `Impossible de convertir ${req.finalMachines} machines en débit : ${name(req.item)} n'a pas de recette utilisable.` });
  }

  // 3. Demande agrégée par item AVANT arrondi.
  const demand = new Map<string, number>([[req.item, ratePerMin]]);
  const exactOf = new Map<string, number>();
  const edges: Edge[] = [];
  const surplusMap = new Map<string, { perMin: number; from: Set<string> }>();
  const unresolvedDemand = new Map<string, number>();
  for (const item of topo) {
    const d = demand.get(item) ?? 0;
    const c = choices.get(item)!;
    if (!c.eff) {
      unresolvedDemand.set(item, (unresolvedDemand.get(item) ?? 0) + d);
      continue;
    }
    const rate = ratePerMachine(c.eff, item)!;
    const exact = d / rate;
    exactOf.set(item, exact);
    const cyclesPerMin = (exact * 60) / c.eff.durationS!;
    for (const [k, v] of Object.entries(c.eff.net)) {
      if (k === item || v === 0) continue;
      const perMin = Math.abs(v!) * cyclesPerMin;
      if (v! < 0) {
        if (cutEdges.has(`${item}>${k}`)) {
          unresolvedDemand.set(k, (unresolvedDemand.get(k) ?? 0) + perMin);
          continue;
        }
        demand.set(k, (demand.get(k) ?? 0) + perMin);
        edges.push({ from: k, to: item, perMin });
      } else {
        const s = surplusMap.get(k) ?? { perMin: 0, from: new Set<string>() };
        s.perMin += perMin;
        s.from.add(c.eff.recipe.id);
        surplusMap.set(k, s);
      }
    }
  }

  // 4. Profondeur (plus long chemin depuis la cible).
  const depth = new Map<string, number>([[req.item, 0]]);
  for (const item of topo) {
    const dItem = depth.get(item) ?? 0;
    const c = choices.get(item)!;
    if (!c.eff) continue;
    for (const [k, v] of Object.entries(c.eff.net)) {
      if (v! < 0 && !cutEdges.has(`${item}>${k}`)) depth.set(k, Math.max(depth.get(k) ?? 0, dItem + 1));
    }
  }

  // 5. Étapes.
  const steps: Step[] = [];
  const verify: VerifyEntry[] = [];
  for (const item of topo) {
    const c = choices.get(item)!;
    if (!c.eff) continue;
    const eff: EffRecipe = c.eff;
    const r = eff.recipe;
    const m = eff.machine;
    const exact = exactOf.get(item) ?? 0;
    const machines = ceilTol(exact);
    const rate = ratePerMachine(eff, item)!;
    const area = machineArea(m);
    const energy = r.energyMFps;
    const access = machineAccess(data, player, r.machine);
    const pollution = m?.pollutionPerHour ?? null;
    const step: Step = {
      item,
      recipeId: r.id,
      machine: r.machine,
      machineKind: m?.kind ?? "machine",
      forced: c.forced,
      depth: depth.get(item) ?? 0,
      durationS: eff.durationS!,
      outputPerCycle: eff.net[item]!,
      ratePerMachine: rate,
      demandPerMin: demand.get(item) ?? 0,
      machinesExact: exact,
      machines,
      utilization: machines ? exact / machines : 0,
      inputs: edges.filter((e) => e.to === item).map((e) => ({ item: e.from, perMin: e.perMin })),
      consumers: edges.filter((e) => e.from === item).map((e) => ({ item: e.to, perMin: e.perMin })),
      byproducts: Object.entries(eff.net)
        .filter(([k, v]) => k !== item && v! > 0)
        .map(([k, v]) => ({ item: k, perMin: (v! * exact * 60) / eff.durationS! })),
      energyMFps: energy,
      energyAvg: energy === null ? null : exact * energy,
      energyPeak: energy === null ? null : machines * energy,
      area,
      footprint: area === null ? null : machines * area,
      unitCost: m?.cost ?? null,
      buildCost: m?.cost == null ? null : machines * m.cost,
      pollutionPerHour: pollution === null ? null : typeof pollution === "number" ? machines * pollution : [machines * pollution[0], machines * pollution[1]],
      isRaw: !Object.values(eff.net).some((v) => v! < 0),
      usesUnverified: eff.blocking.length > 0,
      verify: r.verify,
      machineVerify: m?.verify ?? [],
      access,
      ...(eff.growth ? { growth: eff.growth } : {}),
      alternatives: c.candidates,
    };
    steps.push(step);
    for (const f of r.verify) verify.push({ scope: "recette", id: r.id, item, flag: f, used: true });
    for (const f of m?.verify ?? []) verify.push({ scope: "machine", id: r.machine, item, flag: f, used: true });
    // Recettes écartées seulement parce qu'elles sont « à vérifier » : on les montre aussi.
    for (const cand of c.candidates) {
      if (cand.status !== "à vérifier") continue;
      for (const f of cand.flags ?? []) verify.push({ scope: "recette", id: cand.recipeId, item, flag: f, used: false });
    }
    if (c.forced && !access.available) {
      warnings.push({ code: "forcée-verrouillée", message: `Recette forcée pour ${name(item)} : la machine ${m?.name ?? r.machine} n'est pas débloquée.`, items: [item] });
    }
    if (step.usesUnverified) {
      warnings.push({ code: "à-vérifier", message: `${name(item)} utilise une recette à vérifier (${r.id}) : ${eff.blocking.map((f) => f.detail).join(" ; ")}.`, items: [item] });
    }
    if (eff.growth) {
      warnings.push({ code: "arbres", message: `Pousse des arbres : ${eff.growth.detail} (${eff.growth.seconds.toFixed(1).replace(".", ",")} s). Le nombre d'arbres est indicatif.`, items: [item] });
    }
  }
  steps.sort((a, b) => a.depth - b.depth || topo.indexOf(a.item) - topo.indexOf(b.item));

  // 6. Feuilles non résolues (verrouillées, sans recette, boucles…).
  const unresolved: Unresolved[] = [];
  for (const [item, perMin] of unresolvedDemand) {
    const c = choices.get(item) ?? chooser.choose(item);
    const reason: LeafReason = c.leafReason ?? "boucle";
    let unlock: Unresolved["unlock"];
    for (const cand of c.candidates) {
      if (cand.status !== "verrouillée" || !cand.access || cand.access.available) continue;
      const a = cand.access;
      const better = !unlock || (unlock.needsOwnership && !a.needsOwnership) || (!a.needsOwnership && a.rpCost < unlock.rpCost);
      if (better) unlock = { ...a, recipeId: cand.recipeId };
    }
    unresolved.push({ item, perMin, reason, loopShortfall: !!c.eff, ...(unlock ? { unlock } : {}), candidates: c.candidates });
    for (const cand of c.candidates) {
      if (cand.status === "à vérifier" || cand.status === "incalculable") {
        for (const f of cand.flags ?? []) verify.push({ scope: "recette", id: cand.recipeId, item, flag: f, used: false });
      }
    }
  }
  for (const u of unresolved) {
    const label =
      u.reason === "verrouillé"
        ? u.unlock?.needsOwnership
          ? `il faut posséder la machine ${data.machines.get(u.unlock.machine)?.name ?? u.unlock.machine}`
          : `recherche manquante : ${(u.unlock?.missingNodes ?? []).map((n) => data.nodes.get(n)?.name ?? n).join(", ")}`
        : u.reason === "aucune recette"
          ? "aucune recette connue (source inconnue)"
          : u.reason === "seulement à vérifier"
            ? "seules des recettes « à vérifier » existent (active l'option pour les utiliser)"
            : u.reason === "incalculable"
              ? "les recettes connues ont des valeurs manquantes"
              : "boucle de dépendance";
    warnings.push(
      u.loopShortfall
        ? { code: "boucle", message: `${name(u.item)} : ${fmtNum(u.perMin)}/min supplémentaires seraient nécessaires pour alimenter une boucle de la chaîne ; cette quantité n'est pas comptée.`, items: [u.item] }
        : { code: `non-résolu:${u.reason}`, message: `${name(u.item)} (${fmtNum(u.perMin)}/min) n'est pas produit : ${label}.`, items: [u.item] },
    );
  }

  // 7. Surplus (sous-produits à évacuer).
  const demanded = new Set([...demand.keys()].filter((k) => (demand.get(k) ?? 0) > 0));
  const surplus: Surplus[] = [...surplusMap].map(([item, s]) => ({ item, perMin: s.perMin, from: [...s.from], alsoDemanded: demanded.has(item) }));
  surplus.sort((a, b) => b.perMin - a.perMin);
  for (const s of surplus) {
    if (s.alsoDemanded) {
      warnings.push({ code: "surplus-réutilisable", message: `${name(s.item)} est produit en surplus (${fmtNum(s.perMin)}/min) et aussi consommé dans la chaîne : il pourrait être réutilisé (non pris en compte dans le calcul).`, items: [s.item] });
    }
  }

  // 8. Avertissements de choix.
  for (const f of chooser.invalidForced) warnings.push({ code: "forcée-invalide", message: `Recette forcée ignorée pour ${name(f.item)} (${f.recipeId}) : ${f.reason}.`, items: [f.item] });
  for (const cyc of chooser.brokenLoops) {
    warnings.push({ code: "boucle-écartée", message: `Recettes en boucle écartées : ${[...cyc, cyc[0]!].map(name).join(" → ")}. Une autre source a été choisie.`, items: cyc });
  }
  if (chooser.notConverged.length) {
    warnings.push({ code: "convergence", message: "Le choix des recettes n'a pas convergé (boucle qui s'auto-alimente) : le résultat peut ne pas être optimal." });
  }

  // 9. Totaux.
  const totals: Plan["totals"] = {
    machines: 0,
    farms: 0,
    energyAvg: 0,
    energyPeak: 0,
    energyUnknownSteps: 0,
    footprint: 0,
    footprintUnknownSteps: 0,
    buildCost: 0,
    buildCostUnknownSteps: 0,
    pollutionPerHour: [0, 0],
    pollutionUnknownSteps: 0,
  };
  for (const s of steps) {
    if (s.machineKind === "farm") totals.farms += s.machines;
    else totals.machines += s.machines;
    if (s.energyAvg === null) totals.energyUnknownSteps++;
    else {
      totals.energyAvg += s.energyAvg;
      totals.energyPeak += s.energyPeak!;
    }
    if (s.footprint === null) totals.footprintUnknownSteps++;
    else totals.footprint += s.footprint;
    if (s.buildCost === null) totals.buildCostUnknownSteps++;
    else totals.buildCost += s.buildCost;
    if (s.pollutionPerHour === null) totals.pollutionUnknownSteps++;
    else if (typeof s.pollutionPerHour === "number") {
      totals.pollutionPerHour[0] += s.pollutionPerHour;
      totals.pollutionPerHour[1] += s.pollutionPerHour;
    } else {
      totals.pollutionPerHour[0] += s.pollutionPerHour[0];
      totals.pollutionPerHour[1] += s.pollutionPerHour[1];
    }
  }
  if (totals.energyUnknownSteps) {
    warnings.push({ code: "énergie-inconnue", message: `Énergie inconnue pour ${totals.energyUnknownSteps} étape(s) : le total affiché est un minimum.` });
  }

  // 10. Économie et recherche.
  const nodeSet = new Set<string>();
  const machinesToOwn = new Set<string>();
  for (const s of steps) {
    if (s.access.available) continue;
    if (s.access.needsOwnership) machinesToOwn.add(s.machine);
    for (const n of s.access.missingNodes) nodeSet.add(n);
  }
  for (const u of unresolved) {
    if (!u.unlock) continue;
    if (u.unlock.needsOwnership) machinesToOwn.add(u.unlock.machine);
    for (const n of u.unlock.missingNodes) nodeSet.add(n);
  }
  const nodesToUnlock = orderByDepth(data, [...nodeSet]);
  const rpNeeded = rpCost(data, nodesToUnlock);
  const money = player.money ?? null;
  const rp = player.rp ?? null;
  const rpPerSec = player.rpPerSec ?? null;
  const rpMissing = rp === null ? null : Math.max(0, rpNeeded - rp);
  const economy: Economy = {
    buildCost: totals.buildCost,
    buildCostUnknown: totals.buildCostUnknownSteps,
    money,
    moneyMissing: money === null ? null : Math.max(0, totals.buildCost - money),
    nodesToUnlock,
    reqItems: nodesToUnlock.flatMap((id) => (data.nodes.get(id)?.reqItems ?? []).map((r) => ({ node: id, item: r.item, amount: r.amount, done: !!player.reqItemsDone?.has(id) }))),
    rpNeeded,
    rp,
    rpMissing,
    rpPerSec,
    secondsToRp: rpMissing === null || !rpPerSec || rpPerSec <= 0 ? null : rpMissing / rpPerSec,
    machinesToOwn: [...machinesToOwn],
  };

  const raw: Flow[] = steps.filter((s) => s.isRaw).map((s) => ({ item: s.item, perMin: s.demandPerMin }));
  const status: Plan["status"] = !targetChoice.eff ? "impossible" : unresolved.length ? "partiel" : "ok";
  return {
    status,
    target: { item: req.item, ratePerMin, finalMachines: req.finalMachines ?? null },
    criterion,
    steps,
    edges,
    raw,
    unresolved,
    surplus,
    totals,
    verify: dedupeVerify(verify),
    warnings,
    economy,
  };
}

function fmtNum(x: number): string {
  return (Math.round(x * 100) / 100).toString();
}


function dedupeVerify(v: VerifyEntry[]): VerifyEntry[] {
  const seen = new Map<string, VerifyEntry>();
  for (const e of v) {
    const k = `${e.scope}|${e.id}|${e.flag.field}|${e.flag.reason}`;
    const prev = seen.get(k);
    if (!prev || (e.used && !prev.used)) seen.set(k, e);
  }
  return [...seen.values()];
}
