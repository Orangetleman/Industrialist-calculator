// Données de la maquette du bac à sable (S17), lancé à la main : `node maquette/bac-a-sable.gen.mjs`.
// Écrit maquette/bac-a-sable.data.js : toutes les machines et tous les tuyaux du dépôt, avec leur empreinte et
// TOUS leurs ports relevés (objet, fluide, énergie, logique), leurs recettes (valeurs du wiki, sans les
// corrections d'overrides.json), leur prix, leur image du wiki, leurs données électriques (power.json).
// Aucune valeur n'est ajoutée à la main.
import { readFileSync, writeFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const ports = read("ports.json").machines;
const machines = read("machines.json").machines;
const recipes = read("recipes.json").recipes;
const items = read("items.json").items;
const pipes = read("logistics.json").pipes;
const power = Object.fromEntries(read("power.json").entries.map((e) => [e.id, e]));
const releves = read("releves.json");
const images = Object.values(read("images.json").images);
const research = read("research.json");
const resList = Array.isArray(research) ? research : research.nodes ?? research.research ?? [];
const resName = Object.fromEntries((Array.isArray(resList) ? resList : Object.values(resList)).filter((r) => r && r.id).map((r) => [r.id, r.name]));
const img = (kind, id) => images.find((i) => i.kind === kind && i.id === id)?.file ?? null;
const SIDE = { haut: "N", bas: "S", gauche: "W", droite: "E" };
const DIR = { "entrée": "e", sortie: "s", "les deux": "l" };
const TYPE = { objet: "o", fluide: "f", "énergie": "p", logique: "g" };

function relevé(id) {
  const p = ports[id];
  if (!p || !p.footprint) return null;
  const out = [];
  for (const x of p.ports ?? []) {
    const t = TYPE[x.type]; if (!t) continue;
    const base = { t, d: DIR[x.direction] ?? "l", ...(x.tip ? { tip: x.tip } : {}), ...(x.items?.length ? { items: x.items } : {}) };
    // Prise électrique ou logique posée sur le bâtiment : [colonne, ligne] depuis 1, demi-cases permises.
    if (x.side === "dessus" && Array.isArray(x.cell)) out.push({ ...base, s: "top", cx: x.cell[0], cy: x.cell[1] });
    else if (SIDE[x.side] && typeof x.cell === "number") out.push({ ...base, s: SIDE[x.side], c: x.cell });
  }
  // Grands tuyaux : le relevé note chaque port en deux moitiés (« 1/2 », « 2/2 » dans l'infobulle). On en fait un
  // seul port de 2 cases (span 2), qui ne se raccorde qu'à un autre port de 2 cases.
  const half = (q) => q.c && /large fluid pipe/i.test(q.tip ?? "") && /(^|\s)[12]?\/2\b/.test(q.tip ?? ""); // « /2 » seul : moitié dont le chiffre manque au relevé
  const merged = [];
  for (const q of out) {
    if (!half(q)) { merged.push(q); continue; }
    const mate = merged.find((m) => m.span === 2 && m.s === q.s && m.t === q.t && Math.abs(m.c - q.c) === 1 && !m.full);
    if (mate) { mate.c = Math.min(mate.c, q.c); mate.full = true; }
    else merged.push({ ...q, span: 2, tip: q.tip.replace(/\s*[12]?\/2\s*/, " ") });
  }
  merged.forEach((m) => delete m.full);
  return { w: p.footprint.w, h: p.footprint.h, ports: merged };
}
function role(id) {
  if (/intersection/.test(id)) return "croisement";
  if (/turn/.test(id)) return "coude";
  if (/junction/.test(id)) return "té";
  if (/section/.test(id)) return "croix";
  if (/^(short-|long-)?(large-)?(fluid-)?pipe2?$|^short-large-fluid-pipe$|^long-large-fluid-pipe$/.test(id)) return "droit";
  return "spécial";
}
const elec = (id) => {
  const e = power[id]; const r = releves.poleRangeTiles?.[id] ?? e?.rangeTiles?.tiles;
  if (!e && r == null) return undefined;
  return { out: e?.output ?? null, in: e?.input ?? null, nodes: e?.capacity?.nodes ?? e?.transfer?.nodes ?? null, range: r != null ? r * 2 : null }; // 1 tile = 2 cases (relevé du 2026-10-13)
};

const out = { blocks: [], items: {} };
const usedItems = new Set();
const pipeIds = new Set(pipes.map((p) => p.id));
for (const m of machines) {
  if (pipeIds.has(m.id) || m.category == null) continue;
  const rs = recipes.filter((r) => r.machine === m.id).map((r) => ({ id: r.id, s: r.durationS, in: r.inputs, out: r.outputs, e: r.energyMFps }));
  rs.forEach((r) => [...Object.keys(r.in), ...Object.keys(r.out)].forEach((i) => usedItems.add(i)));
  out.blocks.push({
    id: m.id, name: m.name, cat: m.category, tier: m.tier, cost: m.cost, desc: m.description ?? "", poll: m.pollutionPerHour ?? 0,
    unlock: m.unlockedBy ? resName[m.unlockedBy] ?? m.unlockedBy : null, img: img("machine", m.id), geo: relevé(m.id), recipes: rs, elec: elec(m.id),
  });
}
for (const p of pipes) {
  const r = role(p.id), g = relevé(p.id);
  const kind = p.kind === "objet" ? "o" : p.kind === "fluide" ? "f" : "m";
  // Tuyaux sans tier dans le wiki (Special Pipes) : T3, sauf les « Large … » en T4 (décision de l'utilisateur, 2026-10-27).
  const tier = p.tier ?? (/^large/.test(p.id) ? 4 : 3);
  out.blocks.push({
    id: p.id, name: p.name, cat: "Pipes", tier, cost: p.price, desc: p.quote ?? "", poll: 0, unlock: null, img: null, geo: g, recipes: [],
    // L'éditeur de bâtiments ne liste que machines.json : 6 pièces de tuyau n'y sont pas encore (R17).
    ...(machines.some((m) => m.id === p.id) ? {} : { noEditor: true }),
    pipe: { kind, flow: p.flowPerSec, role: r, len: r === "droit" && g ? Math.max(g.w, g.h) : 1, rusty: /rusty/.test(p.id), section: p.section },
  });
}
for (const i of items) if (usedItems.has(i.id)) out.items[i.id] = { name: i.name, fluid: !!i.isFluid, img: img("objet", i.id) };
writeFileSync(new URL("./bac-a-sable.data.js", import.meta.url), `// Généré par bac-a-sable.gen.mjs, ne pas modifier à la main.\nwindow.BAS = ${JSON.stringify(out)};\n`);
const n = (f) => out.blocks.filter(f).length;
console.log(out.blocks.length, "blocs,", n((b) => b.geo), "relevés,", n((b) => b.elec), "électriques,", n((b) => b.geo?.ports.some((p) => p.span)), "à ports larges,", n((b) => b.tier == null), "sans tier");
