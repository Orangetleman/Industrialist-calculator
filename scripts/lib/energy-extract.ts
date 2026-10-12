// Faits de l'énergie lus dans le texte du wiki (phase E2), avec la même méthode stricte que les
// formules RP : une forme attendue, la citation gardée ; si la phrase change, on le dit.

import type { Found } from "./extension-extract.ts";

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const num = (s: string) => WORDS[s.toLowerCase()] ?? Number(s);

function find<T>(page: string, content: string, re: RegExp, read: (m: RegExpExecArray) => T, what: string): Found<T> {
  const m = re.exec(content);
  if (!m) return { value: null, page, problem: `${what} : forme attendue introuvable` };
  return { value: read(m), page, quote: m[0] };
}

export type EnergyFacts = {
  firebox: { coolantTempC: Found<number>; steamTempC: Found<number>; steamTempMaxC: Found<number>; boilers: Found<number> };
  boiler: { coolantPerSec: Found<number>; steamPerSec: Found<number> };
  largeTurbine: { steamPerSec: Found<number> };
  gasBurner: { powerMFps: Found<[number, number]>; boilers: Found<number>; coolantTempC: Found<number> };
  industrialFirebox: { coolantTempC: Found<number>; boilers: Found<number> };
  geothermal: { maxTempC: Found<number> };
  scrubber: { water: Found<number>; filtered: Found<number>; distilled: Found<number>; residue: Found<number> };
  /** Production du Solar Panel heure par heure (24 valeurs, MF/s). */
  solarPanel: Found<number[]>;
  /** « La vitesse du vent n'est jamais nulle » : la production minimale des éoliennes est garantie. */
  windNeverZero: Found<true>;
};

/** Tableau « heure → MF/s » de la page Solar Panel (plages « 6 – 16 », « 24 – 3 »…). */
export function parseHourlyTable(content: string): number[] | null {
  const rows = [...content.matchAll(/\|\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*\n\|\s*\{\{Power\|([\d.]+)MF\/s\}\}/g)];
  if (!rows.length) return null;
  const hours = new Array<number | null>(24).fill(null);
  for (const [, a, b, v] of rows) {
    const from = Number(a) % 24;
    const to = b === undefined ? from : Number(b) % 24;
    for (let h = from; ; h = (h + 1) % 24) {
      hours[h] = Number(v);
      if (h === to) break;
    }
  }
  return hours.every((h) => h !== null) ? (hours as number[]) : null;
}

export function extractEnergyFacts(pages: Record<string, string>): EnergyFacts {
  const p = (t: string) => (pages[t] ?? "").replace(/[ \t]+/g, " ");
  const fb = p("Firebox");
  const bo = p("Boiler");
  const lt = p("Large Turbine");
  const gb = p("Gas Burner");
  const ifb = p("Industrial Firebox");
  const geo = p("Geothermal Well");
  const sc = p("Scrubber");
  const solar = pages["Solar Panel"] ?? "";
  const n1 = (m: RegExpExecArray) => num(m[1]!);
  const hourly = parseHourlyTable(solar);
  return {
    firebox: {
      coolantTempC: find("Firebox", fb, /guaranteed to be at \{\{Heat\|(\d+)\}\}/, n1, "température de l'eau chaude"),
      steamTempC: find("Firebox", fb, /should yield around \{\{Heat\|(\d+)\}\} of \[\[Steam\]\]/, n1, "température de la vapeur"),
      steamTempMaxC: find("Firebox", fb, /can reach up to \{\{Heat\|(\d+)\}\}/, n1, "température maximale de la vapeur"),
      boilers: find("Firebox", fb, /can sustain (\w+) \[\[Boiler\]\]s/, n1, "nombre de Boilers"),
    },
    boiler: {
      coolantPerSec: find("Boiler", bo, /(\d+)L \[\[Water\]\] is used per second/, n1, "eau chaude consommée"),
      steamPerSec: find("Boiler", bo, /will output (\d+)L\/s of \[\[Steam\]\]/, n1, "vapeur produite"),
    },
    largeTurbine: { steamPerSec: find("Large Turbine", lt, /\((\d+)L\/s of \[\[Steam\]\] is needed for a fully online turbine\)/, n1, "vapeur à plein régime") },
    gasBurner: {
      powerMFps: find("Gas Burner", gb, /expected to produce \{\{Power\|([\d.]+)MMF\/s\}\} to \{\{Power\|([\d.]+)MMF\/s\}\}/, (m) => [Number(m[1]) * 1e6, Number(m[2]) * 1e6] as [number, number], "puissance par brûleur"),
      boilers: find("Gas Burner", gb, /can supply up to (\w+) \[\[Boiler\]\]s/, n1, "nombre de Boilers"),
      coolantTempC: find("Gas Burner", gb, /heat \[\[Water\]\] up to \{\{Heat\|(\d+)\}\}/, n1, "température de l'eau chaude"),
    },
    industrialFirebox: {
      coolantTempC: find("Industrial Firebox", ifb, /only capable of reaching \{\{Heat\|(\d+)\}\}/, n1, "température de l'eau chaude"),
      boilers: find("Industrial Firebox", ifb, /can support (\w+) \[\[Boiler\]\]s/, n1, "nombre de Boilers"),
    },
    geothermal: { maxTempC: find("Geothermal Well", geo, /cannot be increased above \{\{Heat\|(\d+)\}\}/, n1, "température maximale") },
    scrubber: {
      water: find("Scrubber", sc, /Regular \[\[Water\]\] will decrease the world's \[\[Pollution\]\] by \{\{Pollution\|([\d.]+)\|negate=1\}\} per hour/, (m) => -Number(m[1]), "pollution retirée (eau)"),
      filtered: find("Scrubber", sc, /\[\[Filtered Water\]\] will remove \{\{Pollution\|([\d.]+)\|negate=1\}\} per hour/, (m) => -Number(m[1]), "pollution retirée (eau filtrée)"),
      distilled: find("Scrubber", sc, /\[\[Distilled Water\]\] which removes \{\{Pollution\|([\d.]+)\|negate=1\}\} per hour/, (m) => -Number(m[1]), "pollution retirée (eau distillée)"),
      residue: find("Scrubber", sc, /increases world \[\[Pollution\]\] by \{\{Pollution\|([\d.]+)\}\} per h/, (m) => Number(m[1]), "pollution ajoutée (Residue)"),
    },
    solarPanel: hourly
      ? { value: hourly, page: "Solar Panel", quote: "tableau « Time / MamyFlux production » de la page Solar Panel" }
      : { value: null, page: "Solar Panel", problem: "tableau heure par heure introuvable" },
    windNeverZero: find("Wind Turbine3", p("Wind Turbine3"), /The \[\[Wind Speed\]\] can never be zero/, () => true as const, "vent jamais nul"),
  };
}
