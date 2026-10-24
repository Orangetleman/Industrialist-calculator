// Plans de pose des ensembles modulaires (S14) : ferme d'arbres (portées) et moteur diesel (contact).
// Fonctions pures (chaînes HTML/SVG) ; main.ts choisit l'étape et gère le cadre navigable.
// Un clic sur un bloc l'éclaire avec son cercle et ce qu'il dessert (sélection « b:<bloc> ») ;
// « Afficher les portées » montre tous les cercles.

import type { AsmBlock, DieselPlan, FarmSet } from "../engine/build/assembly.ts";
import { STEP, type Dir } from "../engine/build/geometry.ts";
import { esc, fmt, fmtMoney } from "./format.ts";

const C = 16; // unités SVG par case

const FARM: Record<string, { color: string; one: string; many: string; short: string }> = {
  tree: { color: "#3f8f4f", one: "arbre", many: "arbres", short: "" },
  sprinkler: { color: "#4f8fd6", one: "arroseur", many: "arroseurs", short: "A" },
  tank: { color: "#5fd4d4", one: "réservoir", many: "réservoirs", short: "Eau" },
  harvester: { color: "#f0913a", one: "récolteur", many: "récolteurs", short: "" },
  output: { color: "#d77fd0", one: "sortie", many: "sorties", short: "S" },
  controller: { color: "#ff6b5f", one: "contrôleur", many: "contrôleurs", short: "C" },
};
const ENGINE: Record<string, { color: string; short: string }> = {
  controller: { color: "#ff6b5f", short: "Ctrl" },
  crankshaft: { color: "#9aa7b4", short: "Vil" },
  generator: { color: "#6cc792", short: "Gén" },
  cylinder: { color: "#e3b25a", short: "Cyl" },
  "air-input": { color: "#5fd4d4", short: "Air" },
  exhaust: { color: "#8a8a8a", short: "Éch" },
  "fuel-input": { color: "#d77fd0", short: "Carb" },
  "info-panel": { color: "#8fb8d6", short: "Pan" },
  decoration: { color: "#55606b", short: "Déco" },
  flywheel: { color: "#b48a6e", short: "Vol" },
};

const plural = (n: number, one: string, many: string) => `${fmt(n, 0)} ${n > 1 ? many : one}`;

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
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="module asm" role="img" aria-label="Plan de pose de la ferme d'arbres, vue de dessus">`;
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
    s += `<line class="a-lane" x1="${x1}" y1="${y1}" x2="${x1 + d.x * (c.len - 0.5) * C}" y2="${y1 + d.y * (c.len - 0.5) * C}" stroke="${water ? "#5fd4d4" : "#d77fd0"}"><title>${esc(water ? "Passage du tuyau d'eau vers le réservoir" : "Passage du tuyau des Oak Logs depuis la sortie")}</title></line>`;
  }
  // Portées (cachées tant que « Afficher les portées » est éteint ou que le bloc n'est pas choisi).
  for (const b of f.blocks)
    if (b.reach) s += `<circle class="a-rng a-rng-${esc(b.kind)}" data-of="${esc(b.id)}" cx="${ox + (b.x + b.w / 2) * C}" cy="${oy + (b.y + b.h / 2) * C}" r="${b.reach * C}" stroke="${FARM[b.kind]!.color}"/>`;
  // Câbles : de la prise du contrôleur vers le bord.
  for (const c of f.cables) s += `<line class="a-cable" x1="${ox + c.x1 * C}" y1="${oy + c.y1 * C}" x2="${ox + c.x2 * C}" y2="${oy + c.y2 * C}"/>`;
  const order = ["tree", "sprinkler", "harvester", "output", "tank", "controller"];
  for (const b of [...f.blocks].sort((p, q) => order.indexOf(p.kind) - order.indexOf(q.kind))) {
    const k = FARM[b.kind]!;
    const farm = f.farms > 1 ? ` (ferme ${b.unit})` : "";
    const nTrees = b.serves?.filter((id) => id.includes(":t")).length ?? 0;
    const tip =
      b.kind === "tree"
        ? `Arbre${farm}`
        : b.kind === "harvester"
          ? `Récolteur${farm} : coupe ${plural(nTrees, "arbre", "arbres")} à sa portée et les dépose dans sa sortie · clique pour voir sa portée`
          : b.kind === "sprinkler"
            ? `Arroseur${farm} : arrose ${plural(nTrees, "arbre", "arbres")} · clique pour voir sa portée`
            : b.kind === "tank"
              ? `Réservoir${farm} : alimente ${plural(b.serves?.length ?? 0, "arroseur", "arroseurs")} ; arrivée d'eau au bout du passage`
              : b.kind === "output"
                ? `Sortie${farm} : les Oak Logs en partent par tuyau, le long du passage`
                : `Contrôleur${farm} : tout bloc de sa ferme doit toucher son cercle, aucun bloc d'une autre ferme · prise électrique`;
    let extra = "";
    if (b.port) extra += portArrow(b.port, "#fff", ox, oy);
    if (b.plug) extra += `<circle class="plug" cx="${ox + b.plug.x * C}" cy="${oy + b.plug.y * C}" r="3.5"/>`;
    s += blockG(b, ox, oy, k.color, b.kind === "harvester" ? (b.tag ?? "") : k.short, `${tip} — ${name(b.machine)}`, extra);
  }
  for (const p of f.poles)
    s += `<g class="pole${p.used ? "" : " a-free"}" data-tip="${esc(p.used ? `${name(p.pole)} : relie la prise du contrôleur au réseau` : "Place gardée pour un poteau (inutile avec ce poteau-ci)")}"><rect x="${ox + p.x * C}" y="${oy + p.y * C}" width="${p.w * C}" height="${p.h * C}" rx="4"/>${p.used ? `<text x="${ox + (p.x + p.w / 2) * C}" y="${oy + (p.y + p.h / 2) * C + 4}" text-anchor="middle">P</text>` : ""}</g>`;
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
  const what = [plural(c(ids.sprinkler), "arroseur", "arroseurs"), plural(c(ids.tank), "réservoir", "réservoirs"), plural(c(ids.harvester), "récolteur", "récolteurs"), plural(c(ids.output), "sortie", "sorties"), plural(c(ids.controller), "contrôleur", "contrôleurs")].join(", ");
  const title = f.farms > 1 ? `${f.farms} fermes d'arbres (${f.trees.join(" + ")} arbres)` : `Ferme d'arbres de ${plural(total, "arbre", "arbres")}`;
  let head = `<p class="mod-sum"><b>${esc(title)}</b> : ${esc(what)} — ${f.width} × ${f.height} cases, ${esc(fmtMoney(cost))}${unknown ? " (prix incomplets)" : ""}.</p>`;
  if (f.farms > 1)
    head += `<p class="mod-other">Une ferme tient au plus ${plural(ctx.capacity ?? f.capacity, "arbre", "arbres")} : au-delà, tout ne touche plus la portée du contrôleur. Les fermes sont écartées de ${plural(f.gap ?? 0, "case", "cases")}, pour que le cercle d'un contrôleur ne touche aucun bloc de l'autre ferme (sinon les deux s'arrêtent).</p>`;
  else if (ctx.capacity) head += `<p class="mod-other">Une ferme tient au plus ${plural(ctx.capacity, "arbre", "arbres")} (portée du contrôleur).</p>`;
  // Poteaux : celui du plan, et ceux qui conviennent aussi.
  if (f.pole) {
    const opts = f.poleOptions.map((p) => `<option value="${esc(p.id)}"${p.id === f.pole!.id ? " selected" : ""}>${esc(`${p.name} — portée ${fmt(p.rangeCells, 0)} cases, ${p.price === null ? "prix ?" : fmtMoney(p.price)}`)}</option>`).join("");
    const used = Object.values(f.poleCounts).reduce((a, b) => a + b, 0);
    head += `<div class="pose-via"><label class="pose-pick" for="asm-pole">Poteaux jusqu'au contrôleur <select id="asm-pole">${opts}</select></label><p class="hint">La ferme consomme ${esc(fmt(ctx.loadMFps / 1000, 1))} kMF/s. ${plural(used, "poteau relie", "poteaux relient")} la prise du contrôleur au bord de la ferme ; les places sont gardées pour le poteau le moins cher qui porte la ferme. Un poteau de plus grande portée, si tu l'as débloqué, en laisse libres. Le poteau HV n'est pas proposé : il lui faut un transformateur.</p></div>`;
  }
  if (f.problems.length) head += `<ul class="notices">${f.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
  const sw = (kind: string) => `<i style="background:${FARM[kind]!.color}"></i>`;
  const legend = `<ul class="mod-legend"><li>${sw("tree")}Arbre</li><li>${sw("sprinkler")}Arroseur</li><li>${sw("harvester")}Récolteur (arbres qu'il suit)</li><li>${sw("output")}Sortie</li><li>${sw("tank")}Réservoir</li><li>${sw("controller")}Contrôleur</li><li><i class="sw-plug"></i>Prise électrique</li><li><i class="sw-pole"></i>Poteau</li><li><i class="sw-cable"></i>Câble</li><li><i class="sw-lane"></i>Passage d'un tuyau</li></ul>`;
  const rows = parts
    .map((p) => {
      const u = unit(p.id);
      return `<tr><td>${esc(ctx.name(p.id))}</td><td class="num">${p.count}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u))}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u * p.count))}</td></tr>`;
    })
    .join("");
  const steps = [
    `Pose ${f.farms > 1 ? "chaque contrôleur" : "le contrôleur"} (rouge, « C ») : il définit la ferme ; chaque bloc de sa ferme doit toucher son cercle.`,
    `Pose les poteaux (« P ») du bord de la ferme jusqu'à la prise du contrôleur, et relie-les à ton réseau.`,
    `Pose ${c(ids.tank) > 1 ? "les réservoirs" : "le réservoir"} et amène l'eau par ${c(ids.tank) > 1 ? "leur" : "son"} passage (un réservoir pour trois arroseurs, chacun alimenté).`,
    `Pose les arroseurs (« A ») puis les arbres autour : chaque arbre doit toucher le cercle d'un arroseur.`,
    `Pose les récolteurs dans les trous des coins (le chiffre : arbres qu'il suit, ${fmt(ctx.perHarvester, 0)} au plus), puis les sorties (« S ») à leur portée.`,
    `Tire le tuyau des Oak Logs de chaque sortie le long de son passage : garde-le libre.`,
  ];
  const assumptions = [
    `${fmt(ctx.perHarvester, 0)} arbres au plus par récolteur : chiffre du guide Miraheze ; le maximum réel est à relever en jeu.`,
    "Portées relevées en jeu depuis le bord du bloc ; un bloc est à portée dès que le cercle le touche.",
    "Les passages sont tracés en ligne droite jusqu'au bord de la ferme ; un passage qui traverse le bois prend la place d'arbres, replacés ailleurs.",
    "Les câbles électriques ne sont pas gênés par les obstacles (relevé du 2026-10-12).",
    "La liste de construction et le prix comptent les blocs de ce plan.",
  ];
  const details = `<details class="more" open><summary>Ordre de pose</summary><ol class="steps-list">${steps.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></details>
    <details class="more"><summary>Pièces à acheter (${parts.reduce((s, p) => s + p.count, 0)})</summary><div class="tablewrap"><table class="mini"><thead><tr><th>Pièce</th><th>Nombre</th><th>Prix</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>Hypothèses à vérifier en jeu (${assumptions.length})</summary><ul class="notes">${assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>`;
  return { head, legend, details };
}

// ---------------------------------------------------------------- moteur diesel

/** Dessin des moteurs (vue de dessus) : la ligne au milieu, les blocs de côté au-dessus et au-dessous. */
export function renderDieselSvg(p: DieselPlan, name: (id: string) => string): { svg: string; width: number; height: number } {
  const ox = 2 * C;
  const oy = C;
  const W = (p.width + 4) * C;
  const H = (p.height + 2) * C;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="module asm" role="img" aria-label="Plan de pose du moteur diesel modulaire, vue de dessus">`;
  s += `<g class="mg">`;
  for (let x = 0; x <= p.width; x += 2) s += `<line x1="${ox + x * C}" y1="${oy}" x2="${ox + x * C}" y2="${oy + p.height * C}"/>`;
  for (let y = 0; y <= p.height; y += 2) s += `<line x1="${ox}" y1="${oy + y * C}" x2="${ox + p.width * C}" y2="${oy + y * C}"/>`;
  s += `</g>`;
  for (const b of p.blocks) {
    const k = ENGINE[b.kind] ?? { color: "#9aa7b4", short: "" };
    const unit = p.units > 1 ? ` (moteur ${b.unit})` : "";
    const tip = `${name(b.machine)}${unit}${b.todo ? " — nombre à relever en jeu : au moins un" : ""}${b.port ? " · arrivée du carburant par ce côté" : ""}`;
    s += blockG(b, ox, oy, k.color, k.short, tip, b.port ? portArrow(b.port, "#d77fd0", ox, oy) : "");
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
  return `<span class="iset" title="À régler dans le panneau du contrôleur, sur chaque moteur.">⚙ Panneau du contrôleur : rapport air/carburant ${esc(fmt(airFuel, 0))} · accélérateur ${esc(fmt(throttle, 0))} %${assumed ? " (supposé)" : ""}</span>`;
}

export function renderDieselInfo(p: DieselPlan, ctx: DieselInfoCtx): { head: string; legend: string; details: string } {
  const per = Object.entries(p.counts).map(([id, n]) => ({ id, count: n / p.units }));
  const order = ["diesel-engine-controller", "diesel-engine-crankshaft", "diesel-engine-flywheel", "diesel-engine-cylinder", "diesel-engine-air-input", "diesel-engine-exhaust", "diesel-engine-fuel-input", "diesel-engine-generator"];
  per.sort((a, b) => ((order.indexOf(a.id) + 99) % 99) - ((order.indexOf(b.id) + 99) % 99));
  const unknown = per.filter((q) => ctx.price(q.id) === null).length;
  const cost = per.reduce((s, q) => s + (ctx.price(q.id) ?? 0) * q.count, 0) * p.units;
  const title = `${p.units > 1 ? `${p.units} moteurs diesel modulaires` : "Moteur diesel modulaire"}, ${ctx.label}`;
  let head = `<p class="mod-sum"><b>${esc(title)}</b> : ${p.units > 1 ? "par moteur " : ""}${esc(per.map((q) => `${q.count} ${ctx.name(q.id)}`).join(", "))} — ${p.width} × ${p.height} cases, ${ctx.todo.length ? "au moins " : ""}${esc(fmtMoney(cost))}${unknown ? " (prix incomplets)" : ""}.</p>`;
  head += `<p class="mod-other">${esc(fmt(ctx.powerMFps / 1e6, 2))} MMF/s et ${esc(fmt(ctx.fuelLps, 3))} L/s de ${esc(ctx.name(ctx.fuel))} par moteur. Le moins de vilebrequins possible : un bloc de côté par côté, contrôleur compris (la longueur ne change pas la puissance).${p.freeSides ? ` ${plural(p.freeSides, "place de côté reste libre", "places de côté restent libres")} par moteur : une décoration (facultative) peut la cacher.` : ""}${p.units > 1 ? " Les moteurs sont côte à côte, sans toucher la ligne du voisin : leurs deux côtés restent libres." : ""}</p>`;
  head += `<p class="mod-other">${controllerPanel(ctx.airFuel, ctx.throttle, ctx.throttleAssumed)}</p>`;
  const notes: string[] = [];
  if (ctx.todo.length) notes.push(`${ctx.todo.map((id) => ctx.name(id)).join(", ")} : nombre à relever en jeu ; le plan en pose un de chaque, le minimum du wiki (en pointillés).`);
  notes.push("Prise électrique du générateur : place à relever en jeu ; relie-le au réseau.");
  head += `<ul class="notices">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
  const sw = (kind: string) => `<i style="background:${ENGINE[kind]!.color}"></i>`;
  const legend = `<ul class="mod-legend"><li>${sw("controller")}Contrôleur</li><li>${sw("crankshaft")}Vilebrequin</li><li>${sw("generator")}Générateur</li>${p.counts["diesel-engine-flywheel"] ? `<li>${sw("flywheel")}Volant</li>` : ""}<li>${sw("cylinder")}Cylindre</li><li>${sw("air-input")}Entrée d'air</li><li>${sw("exhaust")}Échappement</li><li>${sw("fuel-input")}Entrée de carburant</li>${ctx.todo.length ? `<li><i class="sw-todo"></i>À relever</li>` : ""}</ul>`;
  const rows = per
    .map((q) => {
      const u = ctx.price(q.id);
      const n = q.count * p.units;
      return `<tr><td>${esc(ctx.name(q.id))}${ctx.todo.includes(q.id) ? " <span class=\"warn-text\">(au moins)</span>" : ""}</td><td class="num">${n}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u))}</td><td class="num">${u === null ? "?" : esc(fmtMoney(u * n))}</td></tr>`;
    })
    .join("");
  const steps = [
    "Pose le contrôleur au bout du moteur.",
    `Pose ${p.cranks} vilebrequin${p.cranks > 1 ? "s" : ""} en ligne droite devant lui, puis le générateur au bout de la ligne.`,
    "Pose les blocs de côté contre les côtés du contrôleur et des vilebrequins, au-dessus et au-dessous de la ligne : un bloc par côté (le sens des blocs ne compte pas).",
    `Règle le contrôleur : rapport air/carburant ${ctx.airFuel}, accélérateur ${ctx.throttle} %${ctx.throttleAssumed ? " (supposé : le tableau du wiki ne l'écrit pas)" : ""}.`,
    `Amène le ${ctx.name(ctx.fuel)} à l'entrée de carburant (flèche), et relie le générateur au réseau.`,
  ];
  const assumptions = [
    ctx.reading ? "Configuration relevée en jeu (Info Panel) ; aucune formule connue." : "Configuration relevée sur le wiki (aucune formule connue) ; ajoute les tiennes dans l'éditeur de bâtiments (Diesel Engine Controller, « Relevé de configuration »).",
    "La longueur du moteur ne change pas la puissance (réponse du 2026-10-18).",
    "Deux moteurs voisins peuvent se coller : ici, leurs rangées de côté se touchent, pas leurs lignes.",
  ];
  const details = `<details class="more" open><summary>Ordre de pose${p.units > 1 ? " (par moteur)" : ""}</summary><ol class="steps-list">${steps.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></details>
    <details class="more"><summary>Pièces à acheter (${per.reduce((s, q) => s + q.count, 0) * p.units})</summary><div class="tablewrap"><table class="mini"><thead><tr><th>Pièce</th><th>Nombre</th><th>Prix</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="more"><summary>Hypothèses à vérifier en jeu (${assumptions.length})</summary><ul class="notes">${assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>`;
  return { head, legend, details };
}

/** Bouton « Afficher les portées » de la ferme. */
export function rangesButton(on: boolean): string {
  return `<button type="button" class="u-links-btn" data-asm="ranges" aria-pressed="${on}">◯ ${on ? "Portées affichées" : "Afficher les portées"}</button>`;
}
