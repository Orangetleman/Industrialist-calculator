// Données de la maquette du bac à sable (S17), lancé à la main : `node maquette/bac-a-sable.gen.mjs`.
// Écrit maquette/bac-a-sable.data.js : toutes les machines et tous les tuyaux du dépôt, avec leur empreinte et
// leurs ports quand ils sont relevés (sinon la machine est montrée grisée, à compléter : décision S17), leurs
// recettes (valeurs du wiki, sans les corrections d'overrides.json), leur prix, leur image du wiki.
// Aucune valeur n'est ajoutée à la main.
import { readFileSync, writeFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const ports = read("ports.json").machines;
const machines = read("machines.json").machines;
const recipes = read("recipes.json").recipes;
const items = read("items.json").items;
const pipes = read("logistics.json").pipes;
const images = Object.values(read("images.json").images);
const research = read("research.json");
const resList = Array.isArray(research) ? research : research.nodes ?? research.research ?? [];
const resName = Object.fromEntries((Array.isArray(resList) ? resList : Object.values(resList)).filter((r) => r && r.id).map((r) => [r.id, r.name]));
const img = (kind, id) => images.find((i) => i.kind === kind && i.id === id)?.file ?? null;
const SIDE = { haut: "N", bas: "S", gauche: "W", droite: "E" };
const DIR = { "entrée": "e", sortie: "s", "les deux": "l" };

function relevé(id) {
  const p = ports[id];
  if (!p || !p.footprint) return null;
  return {
    w: p.footprint.w, h: p.footprint.h,
    ports: (p.ports ?? []).filter((x) => (x.type === "objet" || x.type === "fluide") && typeof x.cell === "number" && SIDE[x.side])
      .map((x) => ({ t: x.type === "objet" ? "o" : "f", d: DIR[x.direction] ?? "l", s: SIDE[x.side], c: x.cell })),
  };
}
function role(id) {
  if (/intersection/.test(id)) return "croisement";
  if (/turn/.test(id)) return "coude";
  if (/junction/.test(id)) return "té";
  if (/section/.test(id)) return "croix";
  if (/^(short-|long-)?(large-)?(fluid-)?pipe2?$|^short-large-fluid-pipe$|^long-large-fluid-pipe$/.test(id)) return "droit";
  return "spécial";
}

const out = { blocks: [], items: {} };
const usedItems = new Set();
const pipeIds = new Set(pipes.map((p) => p.id));
for (const m of machines) {
  if (pipeIds.has(m.id) || m.category == null) continue;
  const rs = recipes.filter((r) => r.machine === m.id).map((r) => ({ id: r.id, s: r.durationS, in: r.inputs, out: r.outputs, e: r.energyMFps }));
  rs.forEach((r) => [...Object.keys(r.in), ...Object.keys(r.out)].forEach((i) => usedItems.add(i)));
  out.blocks.push({
    id: m.id, name: m.name, cat: m.category, tier: m.tier, cost: m.cost, desc: m.description ?? "", poll: m.pollutionPerHour ?? 0,
    unlock: m.unlockedBy ? resName[m.unlockedBy] ?? m.unlockedBy : null, img: img("machine", m.id), geo: relevé(m.id), recipes: rs,
  });
}
for (const p of pipes) {
  const r = role(p.id), g = relevé(p.id);
  const kind = p.kind === "objet" ? "o" : p.kind === "fluide" ? "f" : "m";
  out.blocks.push({
    id: p.id, name: p.name, cat: "Pipes", tier: p.tier ?? null, cost: p.price, desc: p.quote ?? "", poll: 0, unlock: null, img: null, geo: g, recipes: [],
    pipe: { kind, flow: p.flowPerSec, role: r, len: r === "droit" && g ? Math.max(g.w, g.h) : 1, rusty: /rusty/.test(p.id), section: p.section },
  });
}
for (const i of items) if (usedItems.has(i.id)) out.items[i.id] = { name: i.name, fluid: !!i.isFluid, img: img("objet", i.id) };
writeFileSync(new URL("./bac-a-sable.data.js", import.meta.url), `// Généré par bac-a-sable.gen.mjs, ne pas modifier à la main.\nwindow.BAS = ${JSON.stringify(out)};\n`);
const n = (f) => out.blocks.filter(f).length;
console.log(out.blocks.length, "blocs,", n((b) => b.geo), "relevés,", n((b) => b.pipe), "tuyaux,", Object.keys(out.items).length, "objets,", Object.keys(resName).length, "recherches nommées");
