// Données de la maquette du bac à sable (S17), lancé à la main : `node maquette/bac-a-sable.gen.mjs`.
// Écrit maquette/bac-a-sable.data.js : seulement les machines dont les ports sont relevés (décision S17,
// Q14-3), avec leur empreinte, leurs ports, leurs recettes (valeurs du wiki, sans les corrections
// d'overrides.json) et le débit des tuyaux de tier I. Aucune valeur n'est ajoutée à la main.
import { readFileSync, writeFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const ports = read("ports.json").machines;
const machines = read("machines.json").machines;
const recipes = read("recipes.json").recipes;
const items = read("items.json").items;
const pipes = read("logistics.json").pipes;

const out = { machines: [], items: {}, pipes: {} };
const used = new Set();
for (const m of machines) {
  const p = ports[m.id];
  if (!p || !p.footprint || !p.ports?.some((x) => x.type === "objet" || x.type === "fluide")) continue;
  if (m.category === "Logic") continue;
  const rs = recipes.filter((r) => r.machine === m.id).map((r) => ({ id: r.id, s: r.durationS, in: r.inputs, out: r.outputs, e: r.energyMFps }));
  if (!rs.length) continue;
  rs.forEach((r) => [...Object.keys(r.in), ...Object.keys(r.out)].forEach((i) => used.add(i)));
  out.machines.push({
    id: m.id, name: m.name, category: m.category, tier: m.tier, cost: m.cost,
    w: p.footprint.w, h: p.footprint.h,
    ports: p.ports.filter((x) => (x.type === "objet" || x.type === "fluide") && typeof x.cell === "number").map((x) => ({ t: x.type, d: x.direction, side: x.side, cell: x.cell })),
    recipes: rs,
  });
}
for (const i of items) if (used.has(i.id)) out.items[i.id] = { name: i.name, fluid: !!i.isFluid };
for (const k of ["short-pipe", "short-fluid-pipe"]) {
  const p = pipes.find((x) => x.id === k);
  out.pipes[p.kind] = { name: p.name, flowPerSec: p.flowPerSec, price: p.price };
}
writeFileSync(new URL("./bac-a-sable.data.js", import.meta.url), `// Généré par bac-a-sable.gen.mjs, ne pas modifier à la main.\nwindow.BAS = ${JSON.stringify(out)};\n`);
console.log(out.machines.length, "machines,", Object.keys(out.items).length, "objets");
