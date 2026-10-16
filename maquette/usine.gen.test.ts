// Générateur de la maquette « Usine entière » (E4b), lancé par `npm run maquette` (hors des tests).
// Vrai calcul figé (Crankshaft 60/min), vrais modules, placement serré sur la grille (plusieurs essais
// puis tassement), tuyaux par le vrai routeur, réseau électrique orienté avec la capacité des poteaux
// (somme des nœuds). Écrit maquette/usine.html : déplacement, zoom, survol, sélection au clic.
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import itemsJson from "../data/items.json";
import machinesJson from "../data/machines.json";
import recipesJson from "../data/recipes.json";
import researchJson from "../data/research.json";
import energyJson from "../data/energy.json";
import overridesJson from "../data/overrides.json";
import portsJson from "../data/ports.json";
import logisticsJson from "../data/logistics.json";
import powerJson from "../data/power.json";
import relevesJson from "../data/releves.json";
import { buildGameData, type RawFiles } from "../src/engine/data.ts";
import type { LogisticsFile, PortsFile, PowerFile } from "../src/engine/extension-types.ts";
import type { OverridesFile } from "../src/engine/types.ts";
import { solve } from "../src/engine/solve.ts";
import { buildCatalog, pipeFor } from "../src/engine/build/catalog.ts";
import { designFactory, factoryInput } from "../src/engine/build/factory.ts";
import { STEP, type Dir } from "../src/engine/build/geometry.ts";

const PORTS = (portsJson as unknown as PortsFile).machines;
const cat = buildCatalog(logisticsJson as unknown as LogisticsFile, powerJson as unknown as PowerFile, (relevesJson as { poleRangeTiles: Record<string, number> }).poleRangeTiles, 2);
const { data } = buildGameData({ items: itemsJson, machines: machinesJson, recipes: recipesJson, research: researchJson, energy: energyJson } as unknown as RawFiles, [overridesJson as unknown as OverridesFile]);
const all = { unlocked: new Set(data.nodes.keys()) };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");
const mf = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(".", ",")} MMF/s` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".", ",")} kMF/s` : `${Math.round(n)} MF/s`);
const PALETTE = ["#f0913a", "#6cc792", "#8fb8d6", "#e3b25a", "#d77fd0", "#5fd4d4", "#ff8a80", "#c5d86d", "#b39ddb", "#ffcc80"];
const PLOT = { w: 160, h: 110 };

// L'algorithme est dans src/engine/build/factory.ts (le site l'appelle aussi) ; ici, le calcul réel figé
// (Crankshaft 60/min, toute la recherche) et le rendu de la maquette.
function design(glue: boolean, globalPoles: boolean, full = false, room = 0, widen = false) {
  const plan = solve(data, all, { item: "crankshaft", ratePerMin: 60, criterion: "energy", tiers: false });
  const name = (id: string) => data.items.get(id)?.name ?? data.machines.get(id)?.name ?? id;
  const input = factoryInput(plan, { name, isFluid: (id) => !!data.items.get(id)?.isFluid, machine: (id) => data.machines.get(id) ?? null, ports: PORTS }, cat, PLOT, { priority: ["forme", "place", "prix", "pieces"] }, { glue, globalPoles, full, room, widen });
  const f = designFactory(input);
  if (process.env.ESSAIS) {
    const tag = (globalPoles ? "g" : "m") + (glue ? "c" : "t");
    writeFileSync(process.env.ESSAIS + tag + ".txt", f.debug.tries.join(String.fromCharCode(10)));
    if (full) writeFileSync(process.env.ESSAIS + `passages${widen ? "-x" : ""}.txt`, f.debug.passages.join(String.fromCharCode(10)));
    if (full) writeFileSync(process.env.ESSAIS + "prises.txt", f.debug.taps.join(String.fromCharCode(10)));
  }
  const color = new Map([...new Set(plan.edges.map((e) => e.item))].map((it, i) => [it, PALETTE[i % PALETTE.length]!]));
  return { ...f, ...f.stats, plan, name, color, grid: { cells: f.cells }, cellsOf: (id: string) => f.netCells[id] ?? 0, passagesKept: new Map([...f.passagesKept].map(([k, v]) => [k, v.text])) };
}

type D = ReturnType<typeof design>;

function svg(d: D, uid: string): string {
  const C = 10;
  const VW = Math.max(d.W, PLOT.w) + 2;
  const VH = Math.max(d.H, PLOT.h) + 2;
  let s = `<svg viewBox="0 0 ${VW * C} ${VH * C}" xmlns="http://www.w3.org/2000/svg" data-w="${VW * C}" data-h="${VH * C}">`;
  s += `<defs><marker id="pa-${uid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ffd54a"/></marker>
<marker id="pb-${uid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c9a83a"/></marker>
<pattern id="g1-${uid}" width="${C}" height="${C}" patternUnits="userSpaceOnUse"><path d="M${C} 0 L0 0 0 ${C}" fill="none" stroke="#262c33" stroke-width="1"/></pattern>
<pattern id="g10-${uid}" width="${C * 10}" height="${C * 10}" patternUnits="userSpaceOnUse"><rect width="${C * 10}" height="${C * 10}" fill="url(#g1-${uid})"/><path d="M${C * 10} 0 L0 0 0 ${C * 10}" fill="none" stroke="#323a43" stroke-width="1.5"/></pattern></defs>`;
  s += `<rect width="${VW * C}" height="${VH * C}" fill="#1d2126"/><rect width="${VW * C}" height="${VH * C}" fill="url(#g10-${uid})"/>`;
  s += `<rect class="plot" x="0" y="0" width="${PLOT.w * C}" height="${PLOT.h * C}" data-tip="Ta parcelle (exemple : ${PLOT.w} × ${PLOT.h} cases)"/><text class="plot-t" x="${PLOT.w * C - 10}" y="${PLOT.h * C - 10}">parcelle ${PLOT.w} × ${PLOT.h}</text>`;
  s += `<rect class="bbox" x="0" y="0" width="${d.W * C}" height="${d.H * C}"/><text class="bbox-t" x="${d.W * C - 8}" y="${d.H * C + 16}">usine ${d.W} × ${d.H}</text>`;
  for (const b of d.boxes) {
    const farm = !b.mod;
    const tip = `${b.sub} — ${b.label}${b.mod ? ` : module de ${b.w} × ${b.h} cases${b.mod.folds > 1 ? ` en ${b.mod.folds} blocs` : ""}${d.passagesKept.get(b.key) ? ` ; ${d.passagesKept.get(b.key)}` : ""}, ${fr(b.mod.cost)} $, consomme ${mf(b.power)}` : " : arbres, pas encore dessinés (emplacement réservé)"}`;
    s += `<g class="mod" data-tip="${esc(tip)}"><rect x="${b.x * C}" y="${b.y * C}" width="${b.w * C}" height="${b.h * C}" rx="6" class="${farm ? "farm" : "box"}"/>`;
    if (b.mod) {
      s += `<g class="detail">`;
      for (const m of b.mod.machines) s += `<rect x="${(b.x + m.x) * C + 1}" y="${(b.y + m.y) * C + 1}" width="${m.w * C - 2}" height="${m.h * C - 2}" rx="2" class="mach"/>`;
      for (const p of b.mod.pieces) {
        const cx = (b.x + p.x + 0.5) * C;
        const cy = (b.y + p.y + 0.5) * C;
        const item = (net: string) => b.mod!.nets.find((n) => n.id === net)?.item ?? "";
        for (const [net, links] of [[p.net, p.links], ...(p.crossNet ? [[p.crossNet, p.crossLinks ?? []]] : [])] as [string, Dir[]][])
          for (const dd of links) s += `<line x1="${cx}" y1="${cy}" x2="${cx + (STEP[dd].x * C) / 2}" y2="${cy + (STEP[dd].y * C) / 2}" stroke="${d.color.get(item(net)) ?? "#9aa7b4"}" stroke-width="${b.mod!.nets.find((n) => n.id === net)?.pipe?.tier === 3 ? 4 : 2.2}"/>`;
      }
      s += `</g>`;
    }
    const fs = Math.max(5, Math.min(20, ((b.w * C) / Math.max(b.sub.length, b.label.length * 0.62)) * 1.25, (b.h * C) / 4.2));
    const cx = (b.x + b.w / 2) * C;
    const cy = (b.y + b.h / 2) * C;
    s += `<g class="lbl"><text x="${cx}" y="${cy - fs * 0.25}" font-size="${fs.toFixed(1)}" class="t1">${esc(b.sub)}</text><text x="${cx}" y="${cy + fs * 0.95}" font-size="${(fs * 0.62).toFixed(1)}" class="t2">${esc(b.label)}</text><text x="${cx}" y="${cy + fs * 1.75}" font-size="${(fs * 0.55).toFixed(1)}" class="t2">${b.mod ? `${b.w} × ${b.h}${b.mod.folds > 1 ? ` · ${b.mod.folds} blocs` : ""}` : "taille à calculer"}</text></g></g>`;
  }
  // Tuyaux entre modules, groupés par liaison.
  const byNet = new Map<string, string>();
  for (const [k, o] of d.grid.cells) {
    if (o.kind !== "tuyau") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    const cx = (x + 0.5) * C;
    const cy = (y + 0.5) * C;
    for (const [net, links] of [[o.net, o.links], ...(o.cross ? [[o.cross.net, o.cross.links]] : [])] as [string, Set<Dir>][]) {
      let t = byNet.get(net) ?? "";
      for (const dd of links) t += `M${cx},${cy} L${cx + (STEP[dd].x * C) / 2},${cy + (STEP[dd].y * C) / 2} `;
      byNet.set(net, t);
    }
  }
  for (const n of d.nets) {
    const from = d.boxes.find((b) => b.key === n.from)!;
    const dest = n.to.length ? n.to.map((t) => d.boxes.find((b) => b.key === t)!.sub).join(" et ") : "la sortie de l'usine";
    const tip = `${d.name(n.item)}${n.perMin ? ` · ${fr(n.perMin)}/min` : ""} — de ${from.sub} (${from.label}) vers ${dest} · ${d.cellsOf(n.id)} cases de tuyau${d.full ? ", collecteurs des modules compris" : ""}`;
    const tier = pipeFor(cat, data.items.get(n.item)?.isFluid ? "fluide" : "objet", n.perMin / 60)?.tier ?? 3;
    s += `<g class="net${tier === 3 ? " t3" : ""}" data-sel="${esc(n.id)}" data-tip="${esc(`${tip} · tier ${tier === 3 ? "III" : "I"}`)}"><path class="net-hit" d="${byNet.get(n.id) ?? ""}"/><path class="net-line" d="${byNet.get(n.id) ?? ""}" stroke="${d.color.get(n.item)}"/></g>`;
  }
  for (const [k, o] of d.grid.cells) {
    if (o.kind !== "tuyau" || !o.cross) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    s += `<rect class="xing" x="${(x + 0.5) * C - 4}" y="${(y + 0.5) * C - 4}" width="8" height="8" rx="1.5" data-tip="Croisement : ${esc(d.name(d.nets.find((n) => n.id === o.net)?.item ?? ""))} / ${esc(d.name(d.nets.find((n) => n.id === o.cross!.net)?.item ?? ""))}"/>`;
  }
  for (const g of d.glued) {
    const [from, to] = g.split(">");
    const p = d.boxes.find((b) => b.key === from)!;
    const e = d.plan.edges.find((x) => x.from === from && x.to === to)!;
    const out = p.mod!.nets.find((n) => n.role === "sortie" && d.name(n.item) === d.name(e.item))!.end!;
    s += `<circle class="contact" cx="${(p.x + out.x + 1) * C}" cy="${(p.y + out.y + 0.5) * C}" r="7" fill="${d.color.get(e.item)}" data-tip="Contact direct : ${esc(d.name(e.item))}, ${fr(e.perMin)}/min, sans tuyau"/>`;
  }
  // Réseau électrique : câbles poteau → machine (avec « Tout afficher » et l'option), câbles entre poteaux
  // (ceux d'un même module seulement avec « Tout afficher »), poteaux, arrivée.
  s += `<g class="power">`;
  for (const p of d.poleNodes)
    for (const q of p.plugs) s += `<line class="plugline" x1="${p.x * C}" y1="${p.y * C}" x2="${q.x * C}" y2="${q.y * C}" marker-end="url(#pb-${uid})"/>`;
  for (const l of d.links) {
    const to = d.boxes.find((b) => b.key === (l.to.module ?? l.to.plugs[0]?.key))!;
    const tip = `${l.internal ? "Câble entre deux poteaux du module" : "Câble"} vers ${l.to.module ? to.sub : `un poteau (${l.to.plugs.length} prise${l.to.plugs.length > 1 ? "s" : ""})`} : porte ${mf(l.load)} (tout ce qui est en aval) ; un ${l.to.type.name} porte ${mf(l.to.type.capacityMFps)} (tous ses nœuds)${l.lines > 1 ? ` : ${l.lines} lignes en parallèle` : ""}${l.relays ? ` · ${l.relays} relais ${l.relayType.name} (portée ${l.relayType.rangeCells} cases)` : ""}`;
    s += `<g class="cable${l.internal ? " internal" : ""}${l.lines > 1 ? " over" : ""}" data-sel="c${esc(l.to.id)}" data-tip="${esc(tip)}"><line class="cable-hit" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}"/><line class="cable-line" x1="${l.from.x * C}" y1="${l.from.y * C}" x2="${l.to.x * C}" y2="${l.to.y * C}" marker-end="url(#pa-${uid})"/></g>`;
  }
  for (const p of d.poleNodes) s += `<rect class="pole" x="${(p.x - p.type.size.w / 2) * C}" y="${(p.y - p.type.size.h / 2) * C}" width="${p.type.size.w * C}" height="${p.type.size.h * C}" data-tip="${esc(`${p.type.name} : ${p.plugs.length} prise(s), ${mf(p.load)} sur ${mf(p.type.capacityMFps)} (tous ses nœuds)`)}"/>`;
  s += `<circle cx="${d.feed.x * C}" cy="${d.feed.y * C}" r="9" class="feed" data-tip="Arrivée du réseau électrique (${mf(d.total)} pour toute l'usine)"/>`;
  s += `</g>`;
  return s + "</svg>";
}

it("maquette usine", () => {
  const V = { tm: design(false, false), gm: design(true, false), f: design(false, false, true) };
  const sum = (d: D) => {
    const fit = d.W <= PLOT.w && d.H <= PLOT.h ? ["ok", "tient sur ta parcelle"] : d.H <= PLOT.w && d.W <= PLOT.h ? ["ok", "tient en tournant d'un quart de tour"] : ["warn", "ne tient pas sur ta parcelle"];
    return `<b>${d.W} × ${d.H} cases</b> · <span class="${fit[0]}">${fit[1]}</span> <span class="hint">(${PLOT.w} × ${PLOT.h}, exemple)</span> · tuyaux : ${d.full ? `${fr(d.allPipeCells)} cases en tout` : `${d.pipeCells} cases entre modules, ${fr(d.allPipeCells)} en tout`}, ${d.allCrossings} croisements en tout${d.glued.length ? `, ${d.glued.length} contact direct` : ""} · électricité : ${mf(d.total)}, ${d.poleNodes.length} poteaux${d.full ? ` (${d.keptPoles} des modules gardés, ${d.newPoles} nouveaux)` : ""}${d.relays ? ` + ${d.relays} relais` : ""}${d.upgraded ? ` (${d.upgraded} renforcés)` : ""}, ${d.links.filter((l) => l.from.id === "feed").length} branche(s) depuis l'arrivée (la plus chargée : ${mf(Math.max(...d.links.filter((l) => l.from.id === "feed").map((l) => l.load)))}), ${fr(d.polesCost)} $${d.overloaded ? ` · <span class="warn">${d.overloaded} câble(s) à doubler</span>` : ""}${d.problems.length ? ` · <span class="warn">${d.problems.length} liaison(s) non tracée(s)</span>` : ""}${d.full ? ` · passages entre machines : ${d.passagesKept.size ? [...d.passagesKept.values()].map(esc).join(" ; ") : "aucun"}` : ""}`;
  };
  const rows = (d: D) =>
    d.nets
      .map((n) => {
        const tier = pipeFor(cat, data.items.get(n.item)?.isFluid ? "fluide" : "objet", n.perMin / 60);
        return `<tr data-sel="${esc(n.id)}"><td><i style="background:${d.color.get(n.item)}"></i>${esc(d.name(n.item))}</td><td>${esc(d.boxes.find((b) => b.key === n.from)!.sub)}</td><td>${n.to.length ? n.to.map((t) => esc(d.boxes.find((b) => b.key === t)!.sub)).join(", ") : "sortie de l'usine"}</td><td class="num">${fr(n.perMin)}/min</td><td class="num">${d.cellsOf(n.id)}</td><td>${tier ? `tier ${tier.tier === 1 ? "I" : "III"}` : "—"}</td></tr>`;
      })
      .join("");
  const block = (k: keyof typeof V) =>
    `<div class="variant v-${k}${V[k].full ? " full" : ""}"><p class="sum">${sum(V[k])}</p>
<div class="frame" tabindex="0">${svg(V[k], k)}<p class="help">Glisse pour te déplacer · molette pour zoomer · survole ou clique un tuyau, un câble, un module</p><div class="zoom"><button data-z="in" aria-label="Zoomer">+</button><button data-z="out" aria-label="Dézoomer">−</button><button data-z="fit" aria-label="Tout voir">⤢</button></div><div class="tip"></div><div class="pick" hidden></div></div>
<details><summary>Liste des liaisons (${V[k].nets.length})</summary><table><thead><tr><th>Produit</th><th>De</th><th>Vers</th><th>Débit</th><th>Cases</th><th>Tuyau</th></tr></thead><tbody>${rows(V[k])}</tbody></table></details></div>`;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Usine entière (maquette)</title>
<style>
:root { --bg:#12171c; --surface:#1b222a; --ink:#e6ebf0; --muted:#9aa7b4; --line:#34404c; --accent:#f0913a; --ok:#6cc792; --warn:#e3b25a; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, "Segoe UI", sans-serif; }
main { max-width: 1240px; margin: 0 auto; padding: 14px 16px 30px; }
h1 { font-size: 1.35rem; margin: 2px 0; } h2 { font-size: 1.05rem; margin: 18px 0 6px; }
.lead, .hint { color: var(--muted); } .hint { font-size: .84rem; }
.tag { font-size: .72rem; border: 1px solid var(--accent); color: var(--accent); border-radius: 999px; padding: 0 8px; }
.bar { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; margin: 10px 0 6px; }
.bar label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.bar .grp { display: inline-flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; padding: 4px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.bar .sub { display: none; } .show-detail .bar .sub { display: inline-flex; } .no-power .bar .sub { display: none; }
.sum { margin: 4px 0 8px; } .ok { color: var(--ok); } .warn { color: var(--warn); }
.frame { position: relative; height: min(72vh, 680px); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #1d2126; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
.frame.drag { cursor: grabbing; }
.frame svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.zoom { position: absolute; right: 10px; top: 10px; display: flex; flex-direction: column; gap: 4px; }
.zoom button { width: 34px; height: 34px; border-radius: 8px; border: 1px solid #4a525c; background: #2a3038; color: #e6ebf0; font-size: 1.1rem; cursor: pointer; }
.help { position: absolute; left: 10px; bottom: 8px; margin: 0; font-size: .78rem; color: var(--muted); pointer-events: none; }
.tip { position: absolute; pointer-events: none; max-width: 360px; padding: 6px 9px; border-radius: 8px; background: #262c33f2; border: 1px solid #4a525c; font-size: .82rem; display: none; }
.pick { position: absolute; left: 10px; right: 54px; top: 10px; padding: 8px 10px; border-radius: 10px; background: #262c33f2; border: 1px solid #ffc27a; font-size: .85rem; }
svg .box { fill: #2a3038; stroke: #4a525c; stroke-width: 2; } svg .farm { fill: #22282f; stroke: #9aa7b4; stroke-width: 2; stroke-dasharray: 8 6; }
svg .mod:hover .box, svg .mod:hover .farm { stroke: #8fb8d6; }
svg .lbl text { text-anchor: middle; pointer-events: none; } svg .t1 { fill: #e6ebf0; font-weight: 600; } svg .t2 { fill: #9aa7b4; }
svg .plot { fill: none; stroke: #6cc792; stroke-dasharray: 14 10; stroke-width: 3; } svg .plot-t { fill: #6cc792; font-size: 14px; text-anchor: end; }
svg .bbox { fill: none; stroke: #e6ebf0; stroke-dasharray: 3 5; stroke-width: 1.5; opacity: .6; pointer-events: none; } svg .bbox-t { fill: #9aa7b4; font-size: 12px; text-anchor: end; }
svg .detail { display: none; } .show-detail svg .detail { display: inline; } .show-detail svg .lbl { opacity: .35; } .show-detail svg .box { fill: #22272e; }
svg .mach { fill: #39414b; stroke: #56606b; }
svg .net-line { fill: none; stroke-width: 2.6; stroke-linecap: round; pointer-events: none; } svg .net.t3 .net-line { stroke-width: 4.6; } svg .net-hit { fill: none; stroke: transparent; stroke-width: 16; cursor: pointer; }
svg .net:hover .net-line { stroke-width: 7; }
.frame.hl svg .net:not(.on), .frame.hl svg .cable:not(.on), .frame.hl svg .plugline { opacity: .15; } svg .on .net-line { stroke-width: 7; } svg .on .cable-line { stroke-width: 4; }
svg .xing { fill: #1d2126; stroke: #e6ebf0; stroke-width: 1.4; } svg .contact { stroke: #fff; stroke-width: 2; }
svg .cable-line { stroke: #ffd54a; stroke-width: 2; stroke-dasharray: 7 5; pointer-events: none; } svg .cable-hit { stroke: transparent; stroke-width: 14; cursor: pointer; }
svg .cable:hover .cable-line { stroke-width: 4; } svg .cable.over .cable-line { stroke: #ff8a80; }
svg .cable.internal { display: none; } .show-detail svg .cable.internal { display: inline; } svg .cable.internal .cable-line { stroke-dasharray: 3 3; }
svg .plugline { display: none; stroke: #c9a83a; stroke-width: 1; opacity: .8; pointer-events: none; } .show-detail.show-plugs svg .plugline { display: inline; }
svg .pole { fill: #5a4320; stroke: #ffd54a; stroke-width: 1.2; } svg .feed { fill: #ffd54a; stroke: #1d2126; stroke-width: 3; }
.no-power svg .power { display: none; }
.variant { display: none; }
body:has(#k-mod:checked):has(#l-tubes:checked) .v-tm, body:has(#k-mod:checked):has(#l-glue:checked) .v-gm, body:has(#k-all:checked) .v-f { display: block; }
body:has(#k-all:checked) .bar .liaisons { opacity: .45; pointer-events: none; }
.full svg .detail { display: inline; } .full svg .lbl { opacity: .35; } .full svg .box { fill: #22272e; }
table { border-collapse: collapse; width: 100%; font-size: .86rem; } th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--line); }
tr[data-sel] { cursor: pointer; } tr.on td { background: #2b1f14; }
td.num { text-align: right; font-variant-numeric: tabular-nums; } td i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
details summary { cursor: pointer; color: var(--muted); margin-top: 10px; }
ol.q li { margin-bottom: 5px; }
</style></head><body><main>
<p><span class="tag">MAQUETTE v8 à valider</span></p>
<h1>Plans de pose : toute l'usine</h1>
<p><b>C'est une proposition :</b> une base pour construire, à optimiser comme tu le souhaites.</p>
<p class="lead">Calcul réel figé : Crankshaft 60/min, toute la recherche. Modules = vrais plans de pose (« forme ramassée » d'abord), placés au plus serré sur la grille ; tuyaux tracés par le vrai routeur ; poteaux comptés avec tous leurs nœuds. Parcelle : exemple.</p>
<div class="bar">
  <span class="grp"><b>Calcul</b><label><input type="radio" name="calcul" id="k-mod" checked> module par module</label><label><input type="radio" name="calcul" id="k-all"> recalculé pour l'usine entière <span class="hint">(une seule prise par collecteur, modules réorganisés vers leurs voisins, collecteur central d’une double rangée sorti entre deux machines quand ça raccourcit les tuyaux sans élargir le module, puis poteaux ; plus de calcul)</span></label></span>
  <span class="grp liaisons"><b>Liaisons</b><label><input type="radio" name="liaison" id="l-tubes" checked> des tuyaux</label><label><input type="radio" name="liaison" id="l-glue"> coller quand c'est possible</label></span>
  <span class="grp"><label><input type="checkbox" id="detail"> Tout afficher</label><label><input type="checkbox" id="power" checked> Réseau électrique</label></span>
  <span class="grp sub"><b>Câbles</b><label><input type="radio" name="cables" id="c-poles" checked> entre poteaux</label><label><input type="radio" name="cables" id="c-plugs"> et vers chaque machine</label></span>
</div>
${block("tm")}${block("gm")}${block("f")}
<h2>Notes</h2>
<ul class="hint">
<li>Portée d'un câble : la même entre deux poteaux et vers une machine ; quand le câble part d'une machine qui produit de l'électricité (générateur…), c'est la portée de cette machine (à relever).</li>
<li>Avec « Tout afficher » : câbles entre les poteaux d'un même module (pointillés courts), et, au choix, ceux vers chaque machine.</li>
</ul>
</main>
<script>
for (const frame of document.querySelectorAll(".frame")) {
  const svg = frame.querySelector("svg");
  const W = +svg.dataset.w, H = +svg.dataset.h;
  let vb = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
  const fit = () => { const r = frame.getBoundingClientRect(); if (!r.width) return; const k = Math.max(W / r.width, H / r.height) * 1.04; vb = { w: r.width * k, h: r.height * k, x: (W - r.width * k) / 2, y: (H - r.height * k) / 2 }; apply(); };
  const zoom = (f, cx, cy) => { const r = frame.getBoundingClientRect(); const px = cx === undefined ? 0.5 : (cx - r.left) / r.width, py = cy === undefined ? 0.5 : (cy - r.top) / r.height; const nw = Math.min(W * 3, Math.max(W / 40, vb.w / f)); const nh = vb.h * nw / vb.w; vb = { x: vb.x + (vb.w - nw) * px, y: vb.y + (vb.h - nh) * py, w: nw, h: nh }; apply(); };
  frame.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  let drag = null;
  frame.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; e.preventDefault(); drag = { x: e.clientX, y: e.clientY, vb: { ...vb }, moved: false, target: e.target.closest("[data-sel]") }; try { frame.setPointerCapture(e.pointerId); } catch {} });
  frame.addEventListener("pointermove", (e) => { if (!drag) return; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) { drag.moved = true; frame.classList.add("drag"); } if (!drag.moved) return; const r = frame.getBoundingClientRect(); vb = { ...drag.vb, x: drag.vb.x - (e.clientX - drag.x) * vb.w / r.width, y: drag.vb.y - (e.clientY - drag.y) * vb.h / r.height }; apply(); });
  const tip = frame.querySelector(".tip"), pick = frame.querySelector(".pick");
  const variant = frame.closest(".variant");
  let selected = null;
  const select = (id, text) => {
    for (const x of variant.querySelectorAll(".on")) x.classList.remove("on");
    selected = selected === id ? null : id;
    frame.classList.toggle("hl", !!selected);
    pick.hidden = !selected;
    if (!selected) return;
    for (const x of variant.querySelectorAll('[data-sel="' + CSS.escape(id) + '"]')) x.classList.add("on");
    pick.textContent = text;
  };
  frame.addEventListener("pointerup", () => {
    const was = drag; drag = null; frame.classList.remove("drag");
    if (!was || was.moved) return;
    if (was.target) select(was.target.dataset.sel, was.target.dataset.tip); else if (selected) select(selected, "");
  });
  for (const tr of variant.querySelectorAll("tr[data-sel]")) tr.addEventListener("click", () => { const g = frame.querySelector('[data-sel="' + CSS.escape(tr.dataset.sel) + '"]'); select(tr.dataset.sel, g?.dataset.tip ?? ""); });
  for (const b of frame.querySelectorAll("[data-z]")) b.addEventListener("click", () => b.dataset.z === "fit" ? fit() : zoom(b.dataset.z === "in" ? 1.3 : 1 / 1.3));
  frame.addEventListener("pointerover", (e) => { const t = e.target.closest("[data-tip]"); if (!t || drag?.moved) return; tip.textContent = t.dataset.tip; tip.style.display = "block"; });
  frame.addEventListener("pointerout", (e) => { if (e.target.closest("[data-tip]")) tip.style.display = "none"; });
  frame.addEventListener("pointermove", (e) => { const r = frame.getBoundingClientRect(); tip.style.left = Math.max(4, Math.min(r.width - 370, e.clientX - r.left + 14)) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px"; });
  new ResizeObserver(fit).observe(frame);
}
const sync = () => {
  document.body.classList.toggle("show-detail", document.getElementById("detail").checked);
  document.body.classList.toggle("no-power", !document.getElementById("power").checked);
  document.body.classList.toggle("show-plugs", document.getElementById("c-plugs").checked);
};
for (const id of ["detail", "power", "c-poles", "c-plugs"]) document.getElementById(id).addEventListener("change", sync);
</script>
</body></html>
`;
  writeFileSync("maquette/usine.html", html);
  const NL = String.fromCharCode(10);
  if (process.env.ESSAIS) writeFileSync(process.env.ESSAIS + "pb.txt", V.f.problems.join(NL));
  writeFileSync("maquette/usine-resume.txt", (Object.keys(V) as (keyof typeof V)[]).map((k) => `${k}: ${sum(V[k]).replace(/<[^>]+>/g, "")}`).join(NL) + NL);
}, 900_000);
