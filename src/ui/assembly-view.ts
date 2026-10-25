// Plans de pose des ensembles modulaires (S14) : ferme d'arbres (portées) et moteur diesel (contact).
// Fonctions pures (chaînes HTML/SVG) ; main.ts choisit l'étape et gère le cadre navigable.
// Un clic sur un bloc l'éclaire avec son cercle et ce qu'il dessert (sélection « b:<bloc> ») ;
// « Afficher les portées » montre tous les cercles.

import type { AsmBlock, DieselPlan, FarmSet } from "../engine/build/assembly.ts";
import { STEP, type Dir } from "../engine/build/geometry.ts";
import { esc, fmt, fmtMoney, fmtPct, frText } from "./format.ts";
import { t, type Key } from "../i18n/i18n.ts";

const C = 16; // unités SVG par case

/** Blocs de la ferme : couleur, et lettre sur le bloc (clé « as.short.… » ; vide pour l'arbre et le récolteur). */
const FARM: Record<string, { color: string; short: Key | null }> = {
  tree: { color: "#3f8f4f", short: null },
  sprinkler: { color: "#4f8fd6", short: "as.short.sprinkler" },
  tank: { color: "#5fd4d4", short: "as.short.tank" },
  harvester: { color: "#f0913a", short: null },
  output: { color: "#d77fd0", short: "as.short.output" },
  controller: { color: "#ff6b5f", short: "as.short.controller" },
};
const ENGINE: Record<string, { color: string; short: Key }> = {
  controller: { color: "#ff6b5f", short: "as.short.controllerE" },
  crankshaft: { color: "#9aa7b4", short: "as.short.crankshaft" },
  generator: { color: "#6cc792", short: "as.short.generator" },
  cylinder: { color: "#e3b25a", short: "as.short.cylinder" },
  "air-input": { color: "#5fd4d4", short: "as.short.air-input" },
  exhaust: { color: "#8a8a8a", short: "as.short.exhaust" },
  "fuel-input": { color: "#d77fd0", short: "as.short.fuel-input" },
  "info-panel": { color: "#8fb8d6", short: "as.short.info-panel" },
  decoration: { color: "#55606b", short: "as.short.decoration" },
  flywheel: { color: "#b48a6e", short: "as.short.flywheel" },
};

/** « 3 arbres » (nombre, pluriel accordé) : `kind` est tree, sprinkler, tank, harvester, output, controller ou cell. */
const count = (kind: string, n: number) => t(`as.n.${kind}` as Key, { n: Math.round(n) });

/** Petite flèche au bord d'une case de port, dans le sens du tuyau. */
function portArrow(p: { x: number; y: number; facing: Dir }, color: string, ox: number, oy: number): string {
  const d = STEP[p.facing];
  const cx = ox + (p.x + 0.5) * C - d.x * C * 0.5;
  const cy = oy + (p.y + 0.5) * C - d.y * C * 0.5;
  const pts = [
    [cx - 5 * d.y, cy + 5 * d.x],
    [cx + 8 * d.x, cy + 8 * d.y],
    [cx + 5 * d.y, cy - 5 * d.x],
  ];
  return `<path class="a-port" d="M${pts.map(([a, b]) => `${a!.toFixed(1)},${b!.toFixed(1)}`).join(" L")} z" fill="${color}"/>`;
}

function blockG(b: AsmBlock, ox: number, oy: number, color: string, label: string, tip: string, extra = ""): string {
  const x = ox + b.x * C;
  const y = oy + b.y * C;
  const serves = b.serves?.length ? ` data-serves="${esc(b.serves.join(" "))}"` : "";
  const dash = b.todo ? ` stroke-dasharray="5 3"` : "";
  let s = `<g class="ab ab-${esc(b.kind)}" data-sel="b:${esc(b.id)}" data-tip="${esc(tip)}"${serves}>`;
  s += `<rect x="${x + 1}" y="${y + 1}" width="${b.w * C - 2}" height="${b.h * C - 2}" rx="3" fill="${b.todo ? "#1d2126" : color}" stroke="${b.todo ? color : "#1d2126"}" stroke-width="${b.todo ? 2 : 1}"${dash}/>`;
  if (label) s += `<text x="${x + (b.w * C) / 2}" y="${y + (b.h * C) / 2 + 4}" text-anchor="middle"${b.todo ? ` fill="${color}"` : ""}>${esc(label)}</text>`;
  return s + extra + `</g>`;
}

// ---------------------------------------------------------------- ferme

/** Dessin de la ferme (vue de dessus) ; chaque bloc se sélectionne. */
export function renderFarmSvg(f: FarmSet, name: (id: string) => string): { svg: string; width: number; height: number } {
  const ox = C;
  const oy = C;
  const W = (f.width + 2) * C;
  const H = (f.height + 2) * C;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="module asm" role="img" aria-label="${esc(t("as.farm.aria"))}">`;
  s += `<g class="mg">`;
  for (let x = 0; x <= f.width; x += 4) s += `<line x1="${ox + x * C}" y1="${oy}" x2="${ox + x * C}" y2="${oy + f.height * C}"/>`;
  for (let y = 0; y <= f.height; y += 4) s += `<line x1="${ox}" y1="${oy + y * C}" x2="${ox + f.width * C}" y2="${oy + y * C}"/>`;
  s += `</g>`;
  // Passages des tuyaux (sorties, réservoirs), en pointillés jusqu'au bord de la ferme.
  for (const c of f.corridors) {
    const d = STEP[c.dir];
    const x1 = ox + (c.x + 0.5) * C;
    const y1 = oy + (c.y + 0.5) * C;
    const water = f.blocks.find((b) => b.id === c.block)?.kind === "tank";
    s += `<line class="a-lane" x1="${x1}" y1="${y1}" x2="${x1 + d.x * (c.len - 0.5) * C}" y2="${y1 + d.y * (c.len - 0.5) * C}" stroke="${water ? "#5fd4d4" : "#d77fd0"}"><title>${esc(t(water ? "as.lane.water" : "as.lane.logs"))}</title></line>`;
  }
  // Portées (cachées tant que « Afficher les portées » est éteint ou que le bloc n'est pas choisi).
  for (const b of f.blocks)
    if (b.reach) s += `<circle class="a-rng a-rng-${esc(b.kind)}" data-of="${esc(b.id)}" cx="${ox + (b.x + b.w / 2) * C}" cy="${oy + (b.y + b.h / 2) * C}" r="${b.reach * C}" stroke="${FARM[b.kind]!.color}"/>`;
  // Câbles : de la prise du contrôleur vers le bord.
  for (const c of f.cables) s += `<line class="a-cable" x1="${ox + c.x1 * C}" y1="${oy + c.y1 * C}" x2="${ox + c.x2 * C}" y2="${oy + c.y2 * C}"/>`;
  const order = ["tree", "sprinkler", "harvester", "output", "tank", "controller"];
  for (const b of [...f.blocks].sort((p, q) => order.indexOf(p.kind) - order.indexOf(q.kind))) {
    const k = FARM[b.kind]!;
    const farm = f.farms > 1 ? t("as.farmN", { n: String(b.unit) }) : "";
    const nTrees = b.serves?.filter((id) => id.includes(":t")).length ?? 0;
    const tip =
      b.kind === "tree"
        ? t("as.tip.tree", { farm })
        : b.kind === "harvester"
          ? t("as.tip.harvester", { farm, trees: count("tree", nTrees) })
          : b.kind === "sprinkler"
            ? t("as.tip.sprinkler", { farm, trees: count("tree", nTrees) })
            : b.kind === "tank"
              ? t("as.tip.tank", { farm, spr: count("sprinkler", b.serves?.length ?? 0) })
              : b.kind === "output"
                ? t("as.tip.output", { farm })
                : t("as.tip.controller", { farm });
    let extra = "";
    if (b.port) extra += portArrow(b.port, "#fff", ox, oy);
    if (b.plug) extra += `<circle class="plug" cx="${ox + b.plug.x * C}" cy="${oy + b.plug.y * C}" r="3.5"/>`;
    s += blockG(b, ox, oy, k.color, b.kind === "harvester" ? (b.tag ?? "") : k.short ? t(k.short) : "", `${tip} — ${name(b.machine)}`, extra);
  }
  for (const p of f.poles)
    s += `<g class="pole${p.used ? "" : " a-free"}" data-tip="${esc(p.used ? t("as.pole.used", { p: name(p.pole) }) : t("as.pole.free"))}"><rect x="${ox + p.x * C}" y="${oy + p.y * C}" width="${p.w * C}" height="${p.h * C}" rx="4"/>${p.used ? `<text x="${ox + (p.x + p.w / 2) * C}" y="${oy + (p.y + p.h / 2) * C + 4}" text-anchor="middle">P</text>` : ""}</g>`;
  return { svg: s + "</svg>", width: W, height: H };
}

export type FarmInfoCtx = {
  name: (id: string) => string;
  price: (id: string) => number | null;
  /** Électricité de toutes les fermes (MF/s). */
  loadMFps: number;
  /** Arbres que tient une ferme, s'il est connu. */
  capacity: number | null;
  /** Arbres suivis par un récolteur au plus (modular.json). */
  perHarvester: number;
};

/** Texte autour du dessin de la ferme : résumé, poteaux, légende, ordre de pose, pièces, hypothèses. */
export function renderFarmInfo(f: FarmSet, ctx: FarmInfoCtx): { head: string; legend: string; details: string } {
  const c = (id: string) => f.counts[id] ?? 0;
  const ids = { tree: "tree", sprinkler: "tree-farm-sprinkler", tank: "tree-farm-water-tank", harvester: "farm-harvester", output: "tree-farm-output", controller: "tree-farm-controller" };
  const parts = [...Object.values(ids).map((id) => ({ id, count: c(id) })), ...Object.entries(f.poleCounts).map(([id, count]) => ({ id, count }))].filter((p) => p.count);
  const unit = (id: string) => (f.pole && id === f.pole.id ? f.pole.price : ctx.price(id));
  const unknown = parts.filter((p) => unit(p.id) === null).length;
  const cost = parts.reduce((s, p) => s + (unit(p.id) ?? 0) * p.count, 0);
  const total = f.trees.reduce((a, b) => a + b, 0);
  const what = [count("sprinkler", c(ids.sprinkler)), count("tank", c(ids.tank)), count("harvester", c(ids.harvester)), count("output", c(ids.output)), count("controller", c(ids.controller))].join(", ");
  const title = f.farms > 1 ? t("as.farms", { n: String(f.farms), list: f.trees.join(" + ") }) : t("as.farm", { trees: count("tree", total) });
  let head = `<p class="mod-sum">${t("as.sum.html", { title: esc(title), what: esc(what), w: String(f.width), h: String(f.height), cost: esc(fmtMoney(cost)), unknown: unknown ? t("mv.sum.unknown") : "" })}</p>`;
  if (f.farms > 1) head += `<p class="mod-other">${t("as.capacity.many", { trees: count("tree", ctx.capacity ?? f.capacity), cells: count("cell", f.gap ?? 0) })}</p>`;
  else if (ctx.capacity) head += `<p class="mod-other">${t("as.capacity", { trees: count("tree", ctx.capacity) })}</p>`;
  // Poteaux : celui du plan, et ceux qui conviennent aussi.
  if (f.pole) {
    const opts = f.poleOptions.map((p) => `<option value="${esc(p.id)}"${p.id === f.pole!.id ? " selected" : ""}>${esc(t("as.pole.opt", { name: p.name, r: fmt(p.rangeCells, 0), price: p.price === null ? t("as.price.unknown") : fmtMoney(p.price) }))}</option>`).join("");
    const used = Object.values(f.poleCounts).reduce((a, b) => a + b, 0);
    head += `<div class="pose-via"><label class="pose-pick" for="asm-pole">${t("as.poles.label")} <select id="asm-pole">${opts}</select></label><p class="hint">${t("as.poles.hint", { kmf: esc(fmt(ctx.loadMFps / 1000, 1)), used: t("as.poles.link", { n: used }) })}</p></div>`;
  }
  if (f.problems.length) head += `<ul class="notices">${f.problems.map((p) => `<li>${frText(p)}</li>`).join("")}</ul>`;
  const sw = (kind: string) => `<i style="background:${FARM[kind]!.color}"></i>`;
  const legend = `<ul class="mod-legend"><li>${sw("tree")}${t("as.lg.tree")}</li><li>${sw("sprinkler")}${t("as.lg.sprinkler")}</li><li>${sw("harvester")}${t("as.lg.harvester")}</li><li>${sw("output")}${t("as.lg.output")}</li><li>${sw("tank")}${t("as.lg.tank")}</li><li>${sw("controller")}${t("as.lg.controller")}</li><li><i class="sw-plug"></i>${t("mv.lg.plug")}</li><li><i class="sw-pole"></i>${t("mv.lg.pole")}</li><li><i class="sw-cable"></i>${t("as.lg.cable")}</li><li><i class="sw-lane"></i>${t("as.lg.lane")}</li></ul>`;
  const rows = parts
    .map((p) => {
      const u = unit(p.id);
      return `<tr><td>${esc(ctx.name(p.id))}</td><td class="num">${p.count}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u))}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u * p.count))}</td></tr>`;
    })
    .join("");
  const steps = [
    t("as.step.controller", { which: t(f.farms > 1 ? "as.step.controller.each" : "as.step.controller.one") }),
    t("as.step.poles"),
    t(c(ids.tank) > 1 ? "as.step.tanks" : "as.step.tank"),
    t("as.step.sprinklers"),
    t("as.step.harvesters", { n: fmt(ctx.perHarvester, 0) }),
    t("as.step.logs"),
  ];
  const assumptions = [
    t("as.hyp.harvester", { n: fmt(ctx.perHarvester, 0) }),
    t("as.hyp.ranges"),
    t("as.hyp.lanes"),
    t("as.hyp.cables"),
    t("as.hyp.list"),
  ];
  const details = `<details class="more" open><summary>${t("mv.order")}</summary><ol class="steps-list">${steps.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></details>
    <details class="more"><summary>${t("mv.parts", { n: parts.reduce((s, p) => s + p.count, 0) })}</summary><div class="tablewrap"><table class="mini"><thead><tr><th>${t("mv.th.piece")}</th><th>${t("mv.th.n")}</th><th>${t("mv.th.price")}</th><th>${t("mv.th.total")}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>${t("mv.assumptions", { n: assumptions.length })}</summary><ul class="notes">${assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>`;
  return { head, legend, details };
}

// ---------------------------------------------------------------- moteur diesel

/** Dessin des moteurs (vue de dessus) : la ligne au milieu, les blocs de côté au-dessus et au-dessous. */
export function renderDieselSvg(p: DieselPlan, name: (id: string) => string): { svg: string; width: number; height: number } {
  const ox = 2 * C;
  const oy = C;
  const W = (p.width + 4) * C;
  const H = (p.height + 2) * C;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="module asm" role="img" aria-label="${esc(t("as.dsl.aria"))}">`;
  s += `<g class="mg">`;
  for (let x = 0; x <= p.width; x += 2) s += `<line x1="${ox + x * C}" y1="${oy}" x2="${ox + x * C}" y2="${oy + p.height * C}"/>`;
  for (let y = 0; y <= p.height; y += 2) s += `<line x1="${ox}" y1="${oy + y * C}" x2="${ox + p.width * C}" y2="${oy + y * C}"/>`;
  s += `</g>`;
  for (const b of p.blocks) {
    const k = ENGINE[b.kind];
    const unit = p.units > 1 ? t("as.engineN", { n: String(b.unit) }) : "";
    const tip = `${name(b.machine)}${unit}${b.todo ? t("as.dsl.todo") : ""}${b.port ? t("as.dsl.port") : ""}`;
    s += blockG(b, ox, oy, k?.color ?? "#9aa7b4", k ? t(k.short) : "", tip, b.port ? portArrow(b.port, "#d77fd0", ox, oy) : "");
  }
  return { svg: s + "</svg>", width: W, height: H };
}

export type DieselInfoCtx = {
  name: (id: string) => string;
  price: (id: string) => number | null;
  label: string;
  airFuel: number;
  throttle: number;
  throttleAssumed: boolean;
  powerMFps: number;
  fuelLps: number;
  fuel: string;
  todo: string[];
  /** Configuration relevée en jeu (S18). */
  reading?: boolean;
};

/** Réglages à faire dans le panneau du contrôleur du moteur diesel (S18). */
export function controllerPanel(airFuel: number, throttle: number, assumed: boolean): string {
  return `<span class="iset" title="${esc(t("as.panel.title"))}">${esc(t("as.panel", { a: fmt(airFuel, 0), t: fmtPct(fmt(throttle, 0)), assumed: assumed ? t("as.assumed") : "" }))}</span>`;
}

export function renderDieselInfo(p: DieselPlan, ctx: DieselInfoCtx): { head: string; legend: string; details: string } {
  const per = Object.entries(p.counts).map(([id, n]) => ({ id, count: n / p.units }));
  const order = ["diesel-engine-controller", "diesel-engine-crankshaft", "diesel-engine-flywheel", "diesel-engine-cylinder", "diesel-engine-air-input", "diesel-engine-exhaust", "diesel-engine-fuel-input", "diesel-engine-generator"];
  per.sort((a, b) => ((order.indexOf(a.id) + 99) % 99) - ((order.indexOf(b.id) + 99) % 99));
  const unknown = per.filter((q) => ctx.price(q.id) === null).length;
  const cost = per.reduce((s, q) => s + (ctx.price(q.id) ?? 0) * q.count, 0) * p.units;
  const title = p.units > 1 ? t("as.dsl.units", { n: String(p.units), label: frText(ctx.label) }) : t("as.dsl.unit", { label: frText(ctx.label) });
  let head = `<p class="mod-sum">${t("as.dsl.sum.html", { title, per: p.units > 1 ? t("as.dsl.perEngine") : "", list: esc(per.map((q) => `${q.count} ${ctx.name(q.id)}`).join(", ")), w: String(p.width), h: String(p.height), min: ctx.todo.length ? t("as.dsl.atLeast") : "", cost: esc(fmtMoney(cost)), unknown: unknown ? t("mv.sum.unknown") : "" })}</p>`;
  head += `<p class="mod-other">${esc(t("as.dsl.power", { p: fmt(ctx.powerMFps / 1e6, 2), l: fmt(ctx.fuelLps, 3), fuel: ctx.name(ctx.fuel), free: p.freeSides ? t("as.dsl.free", { n: p.freeSides }) : "", units: p.units > 1 ? t("as.dsl.sideBySide") : "" }))}</p>`;
  head += `<p class="mod-other">${controllerPanel(ctx.airFuel, ctx.throttle, ctx.throttleAssumed)}</p>`;
  const notes: string[] = [];
  if (ctx.todo.length) notes.push(t("as.dsl.todoNote", { list: ctx.todo.map((id) => ctx.name(id)).join(", ") }));
  notes.push(t("as.dsl.plug"));
  head += `<ul class="notices">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
  const sw = (kind: string) => `<i style="background:${ENGINE[kind]!.color}"></i>`;
  const legend = `<ul class="mod-legend"><li>${sw("controller")}${t("as.lg.controller")}</li><li>${sw("crankshaft")}${t("as.lg.crankshaft")}</li><li>${sw("generator")}${t("as.lg.generator")}</li>${p.counts["diesel-engine-flywheel"] ? `<li>${sw("flywheel")}${t("as.lg.flywheel")}</li>` : ""}<li>${sw("cylinder")}${t("as.lg.cylinder")}</li><li>${sw("air-input")}${t("as.lg.air")}</li><li>${sw("exhaust")}${t("as.lg.exhaust")}</li><li>${sw("fuel-input")}${t("as.lg.fuel")}</li>${ctx.todo.length ? `<li><i class="sw-todo"></i>${t("as.lg.todo")}</li>` : ""}</ul>`;
  const rows = per
    .map((q) => {
      const u = ctx.price(q.id);
      const n = q.count * p.units;
      return `<tr><td>${esc(ctx.name(q.id))}${ctx.todo.includes(q.id) ? ` <span class="warn-text">${t("as.atLeast")}</span>` : ""}</td><td class="num">${n}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u))}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u * n))}</td></tr>`;
    })
    .join("");
  const steps = [
    t("as.dsl.s1"),
    t("as.dsl.s2", { n: p.cranks }),
    t("as.dsl.s3"),
    t("as.dsl.s4", { a: String(ctx.airFuel), t: fmtPct(String(ctx.throttle)), assumed: ctx.throttleAssumed ? t("as.dsl.s4.assumed") : "" }),
    t("as.dsl.s5", { fuel: ctx.name(ctx.fuel) }),
  ];
  const assumptions = [
    t(ctx.reading ? "as.dsl.h.reading" : "as.dsl.h.wiki"),
    t("as.dsl.h.length"),
    t("as.dsl.h.neighbors"),
  ];
  const details = `<details class="more" open><summary>${t("mv.order")}${p.units > 1 ? t("as.perEngine") : ""}</summary><ol class="steps-list">${steps.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></details>
    <details class="more"><summary>${t("mv.parts", { n: per.reduce((s, q) => s + q.count, 0) * p.units })}</summary><div class="tablewrap"><table class="mini"><thead><tr><th>${t("mv.th.piece")}</th><th>${t("mv.th.n")}</th><th>${t("mv.th.price")}</th><th>${t("mv.th.total")}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>${t("mv.assumptions", { n: assumptions.length })}</summary><ul class="notes">${assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>`;
  return { head, legend, details };
}

/** Bouton « Afficher les portées » de la ferme. */
export function rangesButton(on: boolean): string {
  return `<button type="button" class="u-links-btn" data-asm="ranges" aria-pressed="${on}">◯ ${t(on ? "as.ranges.on" : "as.ranges.off")}</button>`;
}
