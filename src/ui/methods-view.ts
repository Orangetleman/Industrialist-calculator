// Page « Méthodes de calcul » (remarque n° 16) : explique au joueur comment le calcul choisit les
// recettes et compte machines, énergie, pollution… Les textes viennent du catalogue (methodes.*.ts) ;
// l'exemple Purple Gold est recalculé ici avec le vrai moteur, pour que ses chiffres restent justes.

import type { GameData } from "../engine/data.ts";
import type { Criterion } from "../engine/choose.ts";
import { solve, type Plan } from "../engine/solve.ts";
import { solveV1 } from "../engine/solve-v1.ts";
import { lang as curLang, t, type Key } from "../i18n/i18n.ts";
import { esc, fmtMF, fmtMoneyShort, fmtPollution, fmtShort } from "./format.ts";

/** Objet et débit de l'exemple (/min). */
export const EXAMPLE_ITEM = "purple-gold-ingot";
export const EXAMPLE_RATE = 60;
const CRITERIA: Criterion[] = ["machines", "cost", "pollution", "energy", "area", "raw", "steps"];

export type ExampleRow = { label: string; machines: number; trommel: number; energy: number; cost: number; pollution: number; area: number; steps: number };

type PlanTotals = { totals: Plan["totals"]; steps: { machine: string; machines: number }[] };
const row = (label: string, p: PlanTotals): ExampleRow => ({
  label,
  machines: p.totals.machines,
  trommel: p.steps.filter((s) => s.machine === "trommel").reduce((n, s) => n + s.machines, 0),
  energy: p.totals.energyPeak,
  cost: p.totals.buildCost,
  pollution: p.totals.pollutionPerHour[1],
  area: p.totals.footprint,
  steps: p.steps.length,
});

/** Plans de l'exemple : une ligne par première priorité, puis l'ancien moteur. Pur (testé). */
export function exampleRows(data: GameData): ExampleRow[] | null {
  if (!data.items.has(EXAMPLE_ITEM)) return null;
  const all = { unlocked: new Set(data.nodes.keys()), pollutionPct: 0 };
  const rows = CRITERIA.map((c) => row(t(`crit.${c}.label` as Key), solve(data, all, { item: EXAMPLE_ITEM, ratePerMin: EXAMPLE_RATE, criterion: c, tiers: false })));
  const v1 = solveV1(data, all, { item: EXAMPLE_ITEM, ratePerMin: EXAMPLE_RATE, criterion: "machines" }) as unknown as PlanTotals;
  rows.push(row(t("me.row.v1"), v1));
  return rows;
}

const p = (k: Key) => `<p>${t(k)}</p>`;

function sections(): string {
  const steps = [1, 2, 3, 4, 5]
    .map((i) => `<li><h3>${esc(t(`me.s1.${i}.h` as Key))}</h3><p>${t(`me.s1.${i}.html` as Key)}</p></li>`)
    .join("");
  const crit = CRITERIA.map(
    (c) => `<tr><th scope="row">${esc(t(`crit.${c}.label` as Key))}</th><td>${t(`me.c.${c}.html` as Key)}</td><td>${t(`me.c.${c}.lim.html` as Key)}</td></tr>`,
  ).join("");
  const toc: [string, Key][] = [
    ["me-s1", "me.s1.h"],
    ["me-s2", "me.s2.h"],
    ["me-s3", "me.s3.h"],
    ["me-s4", "me.s4.h"],
    ["me-s5", "me.s5.h"],
    ["me-s6", "me.s6.h"],
    ["me-s7", "me.s7.h"],
  ];
  return `
  <nav class="me-toc" aria-label="${esc(t("me.toc"))}"><ol>${toc.map(([id, k]) => `<li><a href="#methodes" data-me-to="${id}">${esc(t(k))}</a></li>`).join("")}</ol></nav>
  <section class="me-sec" id="me-s1"><h2>${esc(t("me.s1.h"))}</h2><ol class="me-pipe">${steps}</ol></section>
  <section class="me-sec" id="me-s2"><h2>${esc(t("me.s2.h"))}</h2>${p("me.s2.p1.html")}${p("me.s2.p2.html")}
    <ol class="me-levels"><li>${t("me.s2.l1.html")}</li><li>${t("me.s2.l2.html")}</li><li>${t("me.s2.l3.html")}</li></ol>${p("me.s2.p3.html")}</section>
  <section class="me-sec" id="me-s3"><h2>${esc(t("me.s3.h"))}</h2><p class="lead">${esc(t("me.s3.lead"))}</p>
    <div class="me-scroll"><table class="me-tbl"><thead><tr><th scope="col">${esc(t("me.th.prio"))}</th><th scope="col">${esc(t("me.th.counts"))}</th><th scope="col">${esc(t("me.th.limits"))}</th></tr></thead><tbody>${crit}</tbody></table></div></section>
  <section class="me-sec" id="me-s4"><h2>${esc(t("me.s4.h"))}</h2>${p("me.s4.p1.html")}${p("me.s4.p2.html")}<p class="me-warn">${t("me.s4.p3.html")}</p>${p("me.s4.p4.html")}${p("me.s4.p5.html")}</section>
  <section class="me-sec" id="me-s5"><h2>${esc(t("me.s5.h"))}</h2><ul class="me-list">${(["rate", "energy", "pollution", "budget", "existing", "depots", "fixed"] as const).map((k) => `<li>${t(`me.s5.${k}.html` as Key)}</li>`).join("")}</ul></section>
  <section class="me-sec" id="me-s6"><h2>${esc(t("me.s6.h"))}</h2>${p("me.s6.p1.html")}${p("me.s6.p2.html")}</section>
  <section class="me-sec" id="me-s7"><h2>${esc(t("me.s7.h"))}</h2><p class="lead">${esc(t("me.s7.lead", { rate: EXAMPLE_RATE }))}</p><div id="me-example"><p class="hint">${esc(t("me.s7.wait"))}</p></div></section>`;
}

/** Tableau et commentaire de l'exemple ; la plus petite valeur de chaque colonne est marquée. Pur (testé). */
export function renderExample(rows: ExampleRow[] | null): string {
  if (!rows) return `<p class="hint">${esc(t("me.s7.none"))}</p>`;
  const cols: [keyof ExampleRow, Key, (x: number) => string][] = [
    ["machines", "me.th.machines", (x) => fmtShort(x)],
    ["trommel", "me.th.trommel", (x) => fmtShort(x)],
    ["energy", "me.th.energy", (x) => fmtMF(x)],
    ["cost", "me.th.cost", (x) => fmtMoneyShort(x)],
    ["pollution", "me.th.pollution", (x) => fmtPollution(x)],
    ["area", "me.th.area", (x) => fmtShort(x)],
    ["steps", "me.th.steps", (x) => fmtShort(x)],
  ];
  const min = new Map(cols.map(([k]) => [k, Math.min(...rows.map((r) => r[k] as number))]));
  const maxM = Math.max(...rows.map((r) => r.machines));
  const body = rows
    .map((r, i) => {
      const cells = cols
        .map(([k, , f]) => {
          const v = r[k] as number;
          const best = Math.abs(v - min.get(k)!) < 1e-6;
          const bar = k === "machines" ? `<span class="me-bar" style="width:${Math.round((v / maxM) * 100)}%"></span>` : "";
          return `<td class="num${best ? " me-best" : ""}"${best ? ` title="${esc(t("me.best"))}"` : ""}>${bar}<span>${esc(f(v))}</span></td>`;
        })
        .join("");
      return `<tr${i === rows.length - 1 ? ' class="me-v1"' : ""}><th scope="row">${esc(r.label)}</th>${cells}</tr>`;
    })
    .join("");
  const head = `<tr><th scope="col">${esc(t("me.th.prio"))}</th>${cols.map(([, k]) => `<th scope="col">${esc(t(k))}</th>`).join("")}</tr>`;
  const opt = rows.slice(0, -1);
  const ms = opt.map((r) => r.machines);
  const ts = opt.map((r) => r.trommel);
  return `<div class="me-scroll"><table class="me-tbl me-ex"><thead>${head}</thead><tbody>${body}</tbody></table></div>
  <p>${esc(t("me.s7.p1", { min: Math.min(...ms), max: Math.max(...ms), m: rows[0]!.machines, v1: rows.at(-1)!.machines }))}</p>
  <p>${esc(t("me.s7.p2", { tmin: Math.min(...ts), tmax: Math.max(...ts) }))}</p>`;
}

/** Page entière : le texte tout de suite, l'exemple calculé juste après (quelques centaines de ms). */
export function initMethods(root: HTMLElement, getData: () => GameData) {
  let shownFor = "";
  let cache: { data: GameData; rows: ExampleRow[] | null; lang: string } | null = null;
  root.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-me-to]");
    if (!a) return;
    e.preventDefault();
    document.getElementById(a.dataset.meTo!)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return {
    show() {
      const data = getData();
      const lang = curLang();
      const key = lang;
      const body = root.querySelector<HTMLElement>(".me-body")!;
      if (shownFor !== key) {
        body.innerHTML = sections();
        shownFor = key;
      }
      const box = root.querySelector<HTMLElement>("#me-example")!;
      if (cache && cache.data === data && cache.lang === lang) {
        box.innerHTML = renderExample(cache.rows);
        return;
      }
      setTimeout(() => {
        const rows = exampleRows(data);
        cache = { data, rows, lang };
        box.innerHTML = renderExample(rows);
      }, 30);
    },
    /** Langue changée : tout est réécrit au prochain affichage. */
    reset() {
      shownFor = "";
      cache = null;
    },
  };
}
