// Schéma : panneau « Comment c'est calculé » (S7). Pour un bloc : le craft utilisé (sa ligne, comme
// dans Recettes), puis chaque nombre du bloc avec son calcul et la source des valeurs du jeu. Pour
// une flèche : qui la produit, qui la consomme, et le calcul de son débit. Fonctions pures (chaînes
// HTML) : main.ts les insère sous la barre du bas du schéma.
//
// Les formules suivent le moteur (solve.ts) :
//   débit d'une machine = sortie nette par cycle × 60 ÷ durée ;
//   demande = tout ce que produit l'étape (ses flèches, plus l'objectif ou un surplus) ;
//   machines = demande ÷ débit d'une machine, puis arrondi au-dessus ;
//   entrée = demande × quantité ÷ sortie (quantités nettes par cycle) ;
//   flèche = besoin de l'arrivée × part du départ dans la production de l'objet.

import { ENERGY, POLLUTION } from "../engine/resources.ts";
import type { Step } from "../engine/solve.ts";
import type { Recipe, Source } from "../engine/types.ts";
import type { MachineInterface } from "../engine/extension-types.ts";
import { choicesFor, factorsFor, numberSettings } from "../engine/interfaces.ts";
import { factorText, screenText } from "./iface-view.ts";
import { controllerPanel } from "./assembly-view.ts";
import { colon, esc, fmt, fmtPct, frRaw, frText } from "./format.ts";
import { t } from "../i18n/i18n.ts";
import { kindLabel } from "./buildings-model.ts";
import { nodeText, type ViewCtx } from "./plan-view.ts";
import { craftHref, fixableHere, fixKey, renderCraft, verifyHref, type RecipesCtx } from "./recipes-view.ts";
import { accessButton, itemN, leafText, lockText, machineN } from "./render.ts";

/** Nombre d'un calcul : assez de décimales pour le refaire à la main, pas plus. */
export function num(x: number): string {
  const a = Math.abs(x);
  return fmt(x, a >= 1000 ? 1 : a >= 1 || a === 0 ? 2 : 4);
}
/** Quantité d'un craft, telle qu'en jeu. */
const qty = (x: number) => fmt(x, 3);
/** Puissance d'un calcul, avec préfixe comme en jeu, sans arrondi qui fausse le calcul (« 6,25 kMF/s »). */
export function mf(w: number | null): string {
  if (w === null || !Number.isFinite(w)) return "—";
  const a = Math.abs(w);
  return a >= 1e9 ? `${fmt(w / 1e9, 3)} GMF/s` : a >= 1e6 ? `${fmt(w / 1e6, 3)} MMF/s` : a >= 1e3 ? `${fmt(w / 1e3, 3)} kMF/s` : `${fmt(w, 2)} MF/s`;
}
const pct = (x: number) => fmtPct(fmt(x * 100, x >= 0.9995 || x === 0 ? 0 : 2));
const isWhole = (x: number) => Math.abs(x - Math.round(x)) < 1e-6;
const EPS = 1e-6;

/** Étiquette courte d'une source : « wiki », « relevé en jeu », « ta correction ». */
const srcLabel = (wiki: string): string => (wiki === "miraheze" || wiki === "fandom" ? t("cv.src.wiki") : wiki === "desmos" ? "Desmos" : wiki === "jeu" ? t("cv.src.jeu") : wiki === "saisie" ? t("cv.src.saisie") : wiki);

/**
 * Étiquette de source d'une valeur de craft : correction (relevé en jeu ou ta saisie), sinon ⚠ à
 * vérifier, sinon craft ajouté (relevé), sinon la source du craft (wiki). `label` : « durée », « sortie »…
 */
export function sourceTag(r: Recipe, field: string, label = ""): string {
  const pre = label ? `${label}${colon()}` : "";
  const c = r.corrections?.find((x) => x.field === field);
  if (c) {
    const mine = c.source.wiki === "saisie";
    const tip = t("cv.fix.title", { who: t(mine ? "cv.fix.mine" : "cv.fix.game"), date: c.source.fetchedAt.slice(0, 10), before: String(c.previous ?? "—"), note: c.source.note ? ` — ${frRaw(c.source.note)}` : "" });
    return `<span class="src-tag ${mine ? "fix" : "jeu"}" title="${esc(tip)}">${esc(pre)}${srcLabel(mine ? "saisie" : "jeu")}</span>`;
  }
  const f = r.verify.find((x) => x.field === field);
  if (f) {
    const text = `${pre}${t("cv.verify", { d: frRaw(f.detail) })}`;
    return fixableHere("recipes", field)
      ? `<button type="button" class="src-tag warn" data-rc-focus="${esc(fixKey("recipes", r.id, field))}" title="${esc(t("cv.fix.here"))}">${esc(text)}</button>`
      : `<a class="src-tag warn" href="${verifyHref("recette", r.id, field)}" title="${esc(t("cv.fix.data"))}">${esc(text)}</a>`;
  }
  if (r.added) return `<span class="src-tag jeu" title="${esc(t("cv.added.title", { date: r.added.fetchedAt.slice(0, 10) }))}">${esc(pre)}${t("cv.src.jeu")}</span>`;
  const s = r.sources[0];
  if (!s) return `<span class="src-tag warn">${esc(pre)}${t("cv.noSource")}</span>`;
  const name = { miraheze: "Miraheze", fandom: "Fandom", desmos: "Desmos", jeu: t("cv.src.jeu"), saisie: t("cv.src.saisie.name") }[s.wiki];
  const tip = t("cv.src.title", { name, date: s.fetchedAt.slice(0, 10), note: s.note ? ` — ${frRaw(s.note)}` : "" });
  const cls = s.wiki === "jeu" ? "jeu" : s.wiki === "saisie" ? "fix" : "wiki";
  const text = `${pre}${srcLabel(s.wiki)}`;
  return s.url
    ? `<a class="src-tag ${cls}" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(tip)}">${esc(text)}</a>`
    : `<span class="src-tag ${cls}" title="${esc(tip)}">${esc(text)}</span>`;
}

type Row = { label: string; formula: string; result: string; src?: string };

function table(rows: Row[]): string {
  return `<table class="calc-t"><tbody>${rows
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="f">${r.formula}</td><td class="r">${esc(r.result)}</td><td class="s">${r.src ?? ""}</td></tr>`)
    .join("")}</tbody></table>`;
}

function panel(title: string, body: string, link = "", attrs = ""): string {
  return `<section class="calc"${attrs} aria-label="${esc(t("cv.title"))}"><div class="calc-head"><h3>${t("cv.title")} <span>· ${esc(title)}</span></h3>${link}</div>${body}</section>`;
}

/** Nom d'un bloc dans un calcul : l'objet, et la machine s'il y a plusieurs blocs pour le même objet. */
function blockName(v: ViewCtx, key: string): string {
  const st = v.plan.steps.find((s) => s.key === key);
  if (st) return key.includes("@") ? `${itemN(v, st.item)}, ${machineN(v, st.machine)}` : itemN(v, st.item);
  const ex = v.plan.existing.find((x) => x.key === key);
  if (ex) return t("cv.yourProd", { item: itemN(v, ex.item) });
  return t("cv.toBring", { item: itemN(v, key) });
}

/** Quantité nette d'un objet par cycle dans un craft (> 0 produit, < 0 consommé), comme le moteur. */
const netQty = (r: Recipe, item: string) => (r.outputs[item] ?? 0) - (r.inputs[item] ?? 0);

/** Étiquettes de source d'une interface (S10) : chaque sorte de source une fois, avec ses notes au survol. */
function ifaceSources(i: MachineInterface): string {
  // Par étiquette : Miraheze et Fandom font un seul « wiki ».
  const kinds = new Map<string, Source[]>();
  for (const src of i.sources) {
    const label = srcLabel(src.wiki);
    kinds.set(label, [...(kinds.get(label) ?? []), src]);
  }
  return [...kinds]
    .map(([label, list]) => {
      const k = list[0]!.wiki;
      const cls = k === "jeu" ? "jeu" : k === "saisie" ? "fix" : "wiki";
      const tip = list.map((x) => `${x.page ?? label}, ${x.fetchedAt.slice(0, 10)}${x.note ? ` — ${frRaw(x.note)}` : ""}`).join("\n");
      const url = list.find((x) => x.url)?.url;
      const text = esc(label);
      return url ? `<a class="src-tag ${cls}" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(tip)}">${text}</a>` : `<span class="src-tag ${cls}" title="${esc(tip)}">${text}</span>`;
    })
    .join(" ");
}

/** Lignes « réglage » (S10) : la position à mettre pour ce craft, et l'écran chiffré de la machine. */
function settingRows(v: ViewCtx, s: Step, r: Recipe): Row[] {
  const i = v.ifaces?.[s.machine];
  if (!i || s.parts) return [];
  const rows: Row[] = [];
  const kind = kindLabel(i.kind);
  for (const { setting, choice } of choicesFor(i, r.id)) {
    const where = i.where ? ` (${frText(i.where)})` : "";
    const once = i.once ? t("cv.setting.once") : "";
    rows.push({ label: t("cv.setting"), formula: t("cv.setting.formula", { kind: esc(kind), where, name: frText(setting.name), pos: frText(choice.label), once, doubt: choice.doubt ? ` (⚠ ${frText(choice.doubt)})` : "" }), result: frRaw(choice.label), src: ifaceSources(i) });
  }
  const nums = numberSettings(i);
  if (nums.length) {
    const f = factorsFor(i, v.msettings?.[s.machine]);
    const text = screenText(i, v.msettings?.[s.machine]);
    const b = r.screen?.base;
    const out = b && Object.entries(b.outputs).find(([, q]) => q !== null);
    const ex = out ? t("cv.screen.ex", { item: esc(itemN(v, out[0])), a: num(out[1]!), f: factorText(f.outputs), b: num(out[1]! * f.outputs) }) : "";
    rows.push(
      text
        ? { label: t("cv.screen"), formula: t("cv.screen.formula", { text: esc(text), m: esc(machineN(v, s.machine)), ex }), result: t("cv.screen.byYou"), src: `${ifaceSources(i)} ${t("cv.screen.base")}` }
        : { label: t("cv.screen"), formula: t("cv.screen.default", { list: nums.map((x) => frText(x.name)).join(", ") }), result: "1×", src: ifaceSources(i) },
    );
  }
  return rows;
}

/** Lignes « demande » : les flèches qui partent du bloc, plus l'objectif ou le surplus. */
function demandRow(v: ViewCtx, s: Step, unit = "/min"): Row {
  const out = new Map<string, number>();
  for (const e of v.plan.edges) if (e.from === s.key && e.item === s.item) out.set(e.to, (out.get(e.to) ?? 0) + e.perMin);
  const parts = [...out].map(([k, x]) => ({ x, label: blockName(v, k) }));
  const rest = s.demandPerMin - parts.reduce((t, p) => t + p.x, 0);
  if (rest > EPS * Math.max(1, s.demandPerMin)) {
    const sale = v.plan.sales.find((x) => x.item === s.item);
    const label = t(v.plan.finals.includes(s.key) ? (sale ? "cv.sale" : "cv.goal") : "cv.surplus");
    parts.push({ x: rest, label });
  }
  const formula = parts.length ? parts.map((p) => `${num(p.x)} (${esc(p.label)})`).join(" + ") : t("cv.none");
  return { label: t("cv.demand"), formula, result: `${num(s.demandPerMin)} ${unit}`, src: parts.length > 1 ? t("cv.demand.sum") : "" };
}

function machinesLabel(v: ViewCtx, s: Step, n: number): string {
  return s.machineKind === "farm" ? `≈ ${fmt(n, 0)} × ${machineN(v, s.machine)}` : `${fmt(n, 0)} ${machineN(v, s.machine)}`;
}

/** Machines exactes → arrondies, puis utilisation et énergie (communes à toutes les étapes). */
function countRows(v: ViewCtx, s: Step, r: Recipe, formula: string): Row[] {
  const rows: Row[] = [];
  const fx = v.plan.fixed?.steps.find((x) => x.key === s.key);
  const round = fx ? t("cv.fixedN", { n: fx.machines }) : isWhole(s.machinesExact) ? "" : t("cv.roundUp");
  if (r.farm && s.parts) {
    rows.push({ label: t("cv.trees"), formula: `${formula} = ${num(s.machinesExact)}${round}`, result: machinesLabel(v, s, s.machines) });
    return [...rows, ...farmRows(v, s, r)];
  }
  rows.push({ label: t(s.parts ? "cv.setups" : "cv.machines"), formula: `${formula} = ${num(s.machinesExact)}${round}`, result: s.parts ? num(s.machinesExact) : machinesLabel(v, s, s.machines) });
  if (s.parts) {
    for (const q of s.parts) {
      const per = r.parts?.find((p) => p.machine === q.machine)?.count ?? 0;
      const formula = r.wholeUnits ? t("cv.engines", { n: s.machines, q: qty(per) }) : `${num(s.machinesExact)} × ${qty(per)} = ${num(q.exact)}${isWhole(q.exact) ? "" : t("cv.roundUp")}`;
      rows.push({ label: machineN(v, q.machine), formula, result: `${fmt(q.count, 0)} ${machineN(v, q.machine)}` });
    }
    return rows;
  }
  if (s.machines) rows.push({ label: t("cv.use"), formula: `${num(s.machinesExact)} ÷ ${fmt(s.machines, 0)}`, result: pct(s.utilization) });
  const e = s.energyMFps;
  if (s.machineKind !== "farm" && s.item !== ENERGY) {
    rows.push(
      e === null
        ? { label: t("common.energy"), formula: t("cv.energy.unknown"), result: "—", src: sourceTag(r, "energyMFps") }
        : e === 0
          ? { label: t("common.energy"), formula: t("cv.energy.none"), result: "0", src: sourceTag(r, "energyMFps") }
          : {
              label: t("common.energy"),
              formula: `${num(s.machinesExact)} × ${esc(mf(e))}${!isWhole(s.machinesExact) ? t("cv.peak", { n: fmt(s.machines, 0), e: mf(e), p: mf(s.energyPeak) }) : ""}`,
              result: mf(s.energyAvg),
              src: sourceTag(r, "energyMFps"),
            },
    );
  }
  return rows;
}

/** Étiquette vers la page du wiki d'une valeur de la ferme (sources de la recette dont la page contient `page`). */
function farmSrc(r: Recipe, page: string): string {
  const s = r.sources.find((x) => x.page?.includes(page));
  if (!s) return "";
  const t = `${s.page}, ${s.fetchedAt.slice(0, 10)}`;
  return s.url ? `<a class="src-tag wiki" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(t)}">wiki</a>` : `<span class="src-tag wiki" title="${esc(t)}">wiki</span>`;
}

/** Proportions de la ferme lues sur ses pièces : arbres par arroseur, arroseurs par réservoir, arbres par récolteur. */
function farmRatios(r: Recipe): { perSpr: number; perTank: number; perHarv: number } {
  const c = (id: string) => r.parts?.find((p) => p.machine === id)?.count ?? 0;
  const spr = c("tree-farm-sprinkler");
  return { perSpr: Math.round(1 / spr), perTank: Math.round(spr / c("tree-farm-water-tank")), perHarv: Math.round(1 / c("farm-harvester")) };
}

/** Ferme d'arbres (S13) : blocs pour les arbres posés, puis l'électricité des coupes. */
function farmRows(v: ViewCtx, s: Step, r: Recipe): Row[] {
  const { perSpr, perTank, perHarv } = farmRatios(r);
  const n = (id: string) => s.parts!.find((q) => q.machine === id)?.count ?? 0;
  const spr = n("tree-farm-sprinkler");
  const rows: Row[] = [
    { label: t("cv.sprinklers"), formula: t("cv.sprinklers.f", { n: fmt(s.machines, 0), per: perSpr }), result: `${fmt(spr, 0)} ${machineN(v, "tree-farm-sprinkler")}`, src: farmSrc(r, "Sprinkler") },
    { label: t("cv.tanks"), formula: t("cv.tanks.f", { n: fmt(spr, 0), per: perTank }), result: `${fmt(n("tree-farm-water-tank"), 0)} ${machineN(v, "tree-farm-water-tank")}`, src: farmSrc(r, "Water Tank") },
    {
      label: t("cv.harvesters"),
      formula: t("cv.harvesters.f", { n: fmt(s.machines, 0), per: perHarv }),
      result: `${fmt(n("farm-harvester"), 0)} ${machineN(v, "farm-harvester")}`,
      src: r.verify.some((f) => f.field === "parts") ? sourceTag(r, "parts") : farmSrc(r, "Guide"),
    },
    { label: t("cv.controller"), formula: t("cv.controller.f"), result: `${fmt(n("tree-farm-controller"), 0)} + ${fmt(n("tree-farm-output"), 0)}`, src: farmSrc(r, "Controller") },
  ];
  if (r.farm) {
    rows.push({
      label: t("cv.power"),
      formula: t("cv.power.f", { n: num(s.machinesExact), e: fmt(r.farm.energyPerCutMF / 1000, 0), d: num(s.durationS) }),
      result: mf(s.energyAvg),
      src: farmSrc(r, "Controller"),
    });
  }
  return rows;
}

/** Entrées (et sous-produits) : demande × quantité ÷ sortie, ou machines × quantité × 60 ÷ durée. */
function flowRows(v: ViewCtx, s: Step, r: Recipe, byDemand: boolean): Row[] {
  const out = s.outputPerCycle;
  const formula = (q: number) => (byDemand ? `${num(s.demandPerMin)} × ${qty(q)} ÷ ${qty(out)}` : `${num(s.machinesExact)} × ${qty(q)} × 60 ÷ ${num(s.durationS)} s`);
  const rows: Row[] = [];
  for (const f of s.inputs) {
    // Eau de la ferme (S13) : les arroseurs arrosent en continu, au prorata des arbres.
    if (r.farm && f.item === r.farm.waterItem) {
      const per = r.farm.waterLpsPerTree * farmRatios(r).perSpr;
      rows.push({
        label: t("cv.input", { item: itemN(v, f.item) }),
        formula: t("cv.water.f", { n: num(s.machinesExact), per: farmRatios(r).perSpr, l: num(per) }),
        result: `${num(f.perMin)} /min`,
        src: farmSrc(r, "Sprinkler"),
      });
      continue;
    }
    rows.push({ label: t("cv.input", { item: itemN(v, f.item) }), formula: formula(-netQty(r, f.item)), result: `${num(f.perMin)} /min`, src: sourceTag(r, `inputs.${f.item}`) });
  }
  for (const f of s.byproducts) rows.push({ label: t("cv.byproduct", { item: itemN(v, f.item) }), formula: formula(netQty(r, f.item)), result: `${num(f.perMin)} /min`, src: sourceTag(r, `outputs.${f.item}`) });
  return rows;
}

/** Phrase d'explication en tête du tableau, pour les cas particuliers. */
function stepNote(v: ViewCtx, s: Step): string {
  const notes: string[] = [];
  const r = v.data.recipes.get(s.recipeId);
  if (r?.farm && s.parts)
    notes.push(
      t("cv.note.farm", { l: fmt(r.farm.waterLpsPerTree * farmRatios(r).perSpr * 60, 1) }),
    );
  else if (s.parts) notes.push(t("cv.note.setup"));
  if (r?.wholeUnits) {
    const c = v.diesel?.configs.find((x) => x.id === s.recipeId);
    const how = v.diesel ? (v.diesel.choice.config === s.recipeId ? t("cv.dsl.forced") : t("cv.dsl.chosen", { why: t(`cv.dsl.${v.diesel.choice.mode}`) })) : t("cv.dsl.recorded");
    notes.push(`${t("cv.dsl.note", { src: t(c?.reading ? "cv.src.jeu" : "cv.dsl.wiki"), how })}${c ? ` ${controllerPanel(c.airFuel, c.throttle, c.throttleAssumed)}` : ""}`);
  }
  if (s.growth)
    notes.push(
      t("cv.growth.html", { detail: frText(s.growth.detail), src: s.growth.sourceUrl ? ` (<a href="${esc(s.growth.sourceUrl)}" target="_blank" rel="noopener">${t("cv.growth.src")}</a>)` : "" }),
    );
  else if (s.isRaw && s.item !== ENERGY && s.item !== POLLUTION) notes.push(t("cv.raw"));
  if (!s.access.available) notes.push(`${esc(lockText(v, s.access))} ${accessButton(s.access)}`);
  return notes.length ? `<p class="calc-note">${notes.join(" ")}</p>` : "";
}

/** Débit d'une machine pour un objet : sortie nette × 60 ÷ durée (le détail si le craft en consomme aussi). */
function rateRow(s: Step, r: Recipe, name: string): Row {
  const gross = r.outputs[s.item] ?? 0;
  const back = r.inputs[s.item] ?? 0;
  const out = back ? `(${qty(gross)} − ${qty(back)})` : qty(s.outputPerCycle);
  const duration = s.growth ? `<span class="src-tag warn" title="${esc(frRaw(s.growth.detail))}">${t("cv.growth.tag", { how: s.growth.method === "formule" ? t("cv.growth.approx") : frRaw(s.growth.method) })}</span>` : sourceTag(r, "durationS", t("cv.duration"));
  return {
    label: t("cv.rate"),
    formula: `${out} ${esc(name)} × 60 ÷ ${num(s.durationS)} s`,
    result: `${num(s.ratePerMachine)} /min`,
    src: `${sourceTag(r, `outputs.${s.item}`, t("cv.output"))} ${duration}`,
  };
}

/** Panneau d'un bloc du schéma : étape, production existante ou objet non produit. */
/**
 * Bloc au nombre de machines fixé (S8) : ce nombre, puis le débit obtenu. Sans production
 * existante, le nombre exact de machines est proportionnel au débit : la règle de trois se refait
 * à la main avec le nombre de machines exact du calcul sans réglage.
 */
function fixedRows(v: ViewCtx, s: Step): Row[] {
  const f = v.plan.fixed;
  const fx = f?.steps.find((x) => x.key === s.key);
  if (!f || !fx) return [];
  const rate = (r: number) => (v.goal === "énergie" ? mf(r) : `${num(r)} ${v.goal === "argent" ? "$/min" : `${itemN(v, v.plan.target.item)}/min`}`);
  const n = fx.machines;
  const rows: Row[] = [
    { label: t("cv.fixed"), formula: t("cv.fixed.f", { n: fmt(fx.planMachines, 0) }), result: machinesLabel(v, s, n) },
  ];
  const limit = f.limit === s.key;
  const other = f.limit ? v.plan.steps.find((x) => x.key === f.limit) : null;
  if (limit && !f.existingUsed) {
    const baseExact = (f.baseRate * n) / f.rate;
    rows.push({ label: t("cv.got"), formula: t("cv.got.f", { base: rate(f.baseRate), n: String(n), exact: num(baseExact) }), result: rate(f.rate), src: t("cv.limits") });
  } else if (limit) {
    rows.push({ label: t("cv.got"), formula: t("cv.got.existing", { n: String(n) }), result: rate(f.rate), src: t("cv.limits") });
  } else {
    const by = other ? t("cv.limitBy", { item: esc(itemN(v, other.item)) }) : t("cv.limitOther");
    rows.push({ label: t("cv.got"), formula: t("cv.got.other", { by, exact: num(fx.exact), n: String(n) }), result: rate(f.rate) });
  }
  return rows;
}

export function renderStepCalc(v: ViewCtx, rc: RecipesCtx, key: string): string {
  const p = v.plan;
  const s = p.steps.find((x) => x.key === key);
  if (!s) {
    const ex = p.existing.find((x) => x.key === key);
    if (ex) {
      return panel(
        itemN(v, ex.item),
        `<p class="calc-note">${t("cv.existing.html", { a: num(ex.available), u: num(ex.used) })}</p>`,
      );
    }
    const u = p.unresolved.find((x) => x.item === key);
    if (!u) return "";
    const why = u.loopShortfall ? t("pv.loop.note") : u.unlock && u.reason !== "machine écartée" ? `${esc(lockText(v, u.unlock))} ${accessButton(u.unlock)}` : esc(leafText(u.reason));
    return panel(itemN(v, u.item), `<p class="calc-note">${t("cv.missing.html", { x: num(u.perMin), why })}</p>`);
  }
  const r = v.data.recipes.get(s.recipeId);
  if (!r) return "";
  const card = s.item === ENERGY || s.item === POLLUTION || !v.data.items.has(s.item) ? craftHref("machine", r.machine, r.id) : craftHref("objet", s.item, r.id);
  const link = `<a href="${card}" class="calc-link">${t("cv.seeRecipes")}</a>`;
  const craft = `<ul class="rc-crafts calc-craft">${renderCraft({ ...rc, edit: null, highlight: null }, r)}</ul>`;
  const name = itemN(v, s.item);
  const rows: Row[] = [...settingRows(v, s, r), ...fixedRows(v, s)];
  if (s.item === ENERGY) {
    const made = -(s.energyAvg ?? 0);
    rows.push({ label: t(s.parts ? "cv.prod.setup" : "cv.prod.machine"), formula: t("cv.prod.f"), result: mf(s.ratePerMachine), src: sourceTag(r, "energyMFps") });
    rows.push({ label: t("cv.toMake"), formula: t("cv.toMake.f"), result: mf(made) });
    rows.push(...countRows(v, s, r, `${esc(mf(made))} ÷ ${esc(mf(s.ratePerMachine))}`));
    rows.push(...flowRows(v, s, r, false));
  } else if (s.item === POLLUTION || !(s.outputPerCycle > 0)) {
    rows.push(...countRows(v, s, r, t("cv.scrub.f")));
    rows.push(...flowRows(v, s, r, false));
  } else {
    rows.push(rateRow(s, r, name));
    rows.push(demandRow(v, s));
    rows.push(...countRows(v, s, r, `${num(s.demandPerMin)} ÷ ${num(s.ratePerMachine)}`));
    rows.push(...flowRows(v, s, r, true));
  }
  // S29 : plus l'identifiant interne du craft ; seulement ce qui sert au joueur.
  const foot = r.verify.length ? `<p class="calc-foot">${t("cv.foot", { n: r.verify.length })}</p>` : "";
  return panel(name, `${craft}${stepNote(v, s)}${table(rows)}${foot}`, link, ` data-calc-item="${esc(s.item === ENERGY || s.item === POLLUTION ? "" : s.item)}" data-calc-machine="${esc(r.machine)}" data-calc-craft="${esc(r.id)}"`);
}

export type EdgeSel = { from: string; to: string; item: string; perMin: number; loop: boolean };

/** Ce que produit un bloc d'un objet (/min) : son objet principal, un sous-produit, ta production, un manque. */
function producedBy(v: ViewCtx, key: string, item: string): number {
  const s = v.plan.steps.find((x) => x.key === key);
  if (s) return s.item === item ? s.demandPerMin : (s.byproducts.find((f) => f.item === item)?.perMin ?? 0);
  const ex = v.plan.existing.find((x) => x.key === key);
  if (ex) return ex.item === item ? ex.used : 0;
  return v.plan.unresolved.find((u) => u.item === key && u.item === item)?.perMin ?? 0;
}

/** Tous les blocs qui produisent un objet, avec leur production. */
function producersOf(v: ViewCtx, item: string): { key: string; x: number; by: boolean }[] {
  const p = v.plan;
  const list: { key: string; x: number; by: boolean }[] = [];
  for (const s of p.steps) {
    const x = producedBy(v, s.key, item);
    if (x > 0) list.push({ key: s.key, x, by: s.item !== item });
  }
  for (const ex of p.existing) if (ex.item === item && ex.used > 0) list.push({ key: ex.key, x: ex.used, by: false });
  for (const u of p.unresolved) if (u.item === item && u.perMin > 0) list.push({ key: u.item, x: u.perMin, by: false });
  return list;
}

/** Panneau d'une flèche : qui la produit, qui la consomme, et le calcul de son débit. */
export function renderEdgeCalc(v: ViewCtx, e: EdgeSel): string {
  const name = itemN(v, e.item);
  const a = nodeText(v, e.from);
  const b = nodeText(v, e.to);
  const made = producedBy(v, e.from, e.item);
  const to = b.step;
  const need = to?.inputs.find((f) => f.item === e.item)?.perMin ?? e.perMin;
  const who = `<div class="calc-who"><div><h4>${t("cv.madeBy")}</h4>${esc(a.text)}${colon()}${num(made)} /min <button type="button" class="link small" data-flow="${esc(e.from)}">${t("pv.node.flow")}</button></div><div><h4>${t("cv.usedBy")}</h4>${esc(b.text)}${colon()}${num(need)} /min <button type="button" class="link small" data-flow="${esc(e.to)}">${t("pv.node.flow")}</button></div></div>`;
  const rows: Row[] = [];
  const r = to ? v.data.recipes.get(to.recipeId) : undefined;
  if (to && r && to.outputPerCycle > 0 && to.item !== ENERGY && to.item !== POLLUTION) {
    rows.push({ label: t("cv.need"), formula: `${num(to.demandPerMin)} × ${qty(-netQty(r, e.item))} ÷ ${qty(to.outputPerCycle)}${t("cv.need.of", { item: esc(name), block: esc(blockName(v, e.to)) })}`, result: `${num(need)} /min`, src: sourceTag(r, `inputs.${e.item}`) });
  } else if (to && r) {
    rows.push({ label: t("cv.need"), formula: `${num(to.machinesExact)} × ${qty(-netQty(r, e.item))} × 60 ÷ ${num(to.durationS)} s`, result: `${num(need)} /min`, src: sourceTag(r, `inputs.${e.item}`) });
  }
  const prods = producersOf(v, e.item);
  if (prods.length > 1) {
    const total = prods.reduce((t, x) => t + x.x, 0);
    rows.push({ label: t("cv.total", { item: name }), formula: prods.map((x) => `${num(x.x)} (${x.by ? t("cv.byproduct.of") : ""}${esc(blockName(v, x.key))})`).join(" + "), result: `${num(total)} /min` });
    rows.push({ label: t("cv.share"), formula: `${num(made)} ÷ ${num(total)}`, result: pct(made / total), src: t("cv.share.src") });
    rows.push({ label: t("cv.edge"), formula: `${num(need)} × ${pct(made / total)}`, result: `${num(e.perMin)} /min` });
  } else {
    rows.push({ label: t("cv.edge"), formula: t("cv.edge.all", { block: esc(blockName(v, e.from)) }), result: `${num(e.perMin)} /min` });
  }
  const loop = e.loop ? `<p class="calc-note">${t("cv.loop")}</p>` : "";
  return panel(`${name}, ${num(e.perMin)} /min`, `${who}${loop}${table(rows)}`);
}
