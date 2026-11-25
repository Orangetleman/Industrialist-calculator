// Maquette : lignes de steam avec et sans Overflow Gate (src/engine/build/lines.ts), vérifiées par la simulation.
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { planLines, simulate, type Client } from "../src/engine/build/lines.ts";

const CAP = 120;
const S = 90;
const NAMES: Record<string, string> = { planks: "Planks", chunk: "Chunk Plank", cut: "Cut Oak Log" };
const COL = ["#5fd4d4", "#ff5fd2", "#ffd23f", "#7ee081", "#ff8a5c", "#9aa8ff", "#c48bff", "#ffffff", "#ffb3c7", "#8de0ff"];
const r1 = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

it("maquette", () => {
  let html = "";
  for (const rate of [60, 90, 120]) {
    const q = rate / 60;
    const n = Math.ceil(375 * q / S - 1e-9);
    const cl: Client[] = [["planks", 5, 150], ["chunk", 5, 150], ["cut", 3, 75]].map(([key, m, d]) => ({ key: key as string, n: Math.ceil((m as number) * q - 1e-9), p: ((d as number) * q) / Math.ceil((m as number) * q - 1e-9) }));
    html += `<section><h2>${rate} Chair/min : ${r1(375 * q)} L/s de steam, ${n} Boiler dans le plan</h2><div class="two">`;
    for (const gate of [true, false]) {
      const p = planLines(cl, n, S, CAP, gate)!;
      const sim = simulate(p.chains, S, CAP, p.gate);
      let y = 20, s = "", boiler = 0;
      p.chains.forEach((ch, i) => ch.forEach((l, j) => {
        const c = COL[(i * 2 + j) % COL.length]!;
        expect(sim[i]![j]!).toBeGreaterThanOrEqual(l.demand * 0.99);
        if (l.source >= 0) s += `<rect x="10" y="${y - 12}" width="90" height="24" fill="#33265a"/><text x="55" y="${y + 5}" text-anchor="middle">Boiler ${++boiler}</text><path d="M100 ${y}H300" stroke="${c}" stroke-width="6"/>`;
        else s += `<path d="M200 ${y}H300" stroke="${c}" stroke-width="6"/>`;
        if (l.machines) s += `<path d="M300 ${y}H380" stroke="${c}" stroke-width="6"/><rect x="380" y="${y - 12}" width="220" height="24" fill="#33265a"/><text x="390" y="${y + 5}">${l.machines} × ${NAMES[l.client!]} : ${r1(l.demand)} L/s</text><text x="612" y="${y + 5}" fill="#7ee081">servi ${r1(sim[i]![j]!)}</text>`;
        if (j < ch.length - 1) s += `<path d="M300 ${y + 12}V${y + 22}H200V${y + 36}" fill="none" stroke="${c}" stroke-width="4" stroke-dasharray="6 4"/>` + (p.gate ? `<rect x="285" y="${y - 11}" width="30" height="22" fill="#ff6a1a"/><text x="300" y="${y + 5}" text-anchor="middle" fill="#1a0800" font-weight="700">OG</text>` : "");
        y += 36;
      }));
      html += `<figure><figcaption><b>${gate ? "Overflow Gate permise (défaut)" : "Option : sans Overflow Gate"}</b> — ${p.sources} Boiler${p.extra ? ` (<b class="w">+${p.extra}</b>)` : ""}, ${p.gates ? `${p.gates} Overflow Gate (${p.gates * 1000} $)` : "aucune Overflow Gate"}</figcaption><svg viewBox="0 0 720 ${y}">${s}</svg></figure>`;
    }
    html += "</div></section>";
  }
  writeFileSync("maquette/overflow-gate.html", `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Maquette — Overflow Gate</title><style>body{background:#0e0a18;color:#f0ecfa;font:15px system-ui;margin:16px}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;min-width:0}figcaption{margin:0 0 6px}svg{width:100%;height:auto;background:#171322}svg text{fill:#f0ecfa;font-size:14px}.w{color:#ffd23f}@media(max-width:760px){.two{grid-template-columns:1fr}}</style><h1>Lignes de steam avec et sans Overflow Gate</h1><p>Schéma de raccord (pas les positions). Une couleur = un tuyau. <b>OG</b> orange = Overflow Gate : la ligne est servie d'abord, les pointillés portent le surplus. « Servi » : simulation du partage à parts égales.</p>${html}</html>`);
});
