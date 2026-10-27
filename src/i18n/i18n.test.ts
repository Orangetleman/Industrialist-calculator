// S30 : catalogue, t(), langue de départ, nombres et dates selon la langue, clés d'index.html.
import { afterEach, describe, expect, it } from "vitest";
import html from "../../index.html?raw";
import { fmt, fmtDuration, fmtMoney, fmtMoneyShort, fmtPct, fmtShort, parseEnergy, parseInput, parseNum } from "../ui/format.ts";
import { goalTitle, parseRoute, routeTitle } from "../ui/route.ts";
import { en } from "./en.ts";
import { fr } from "./fr.ts";
import { detectLang, joinList, setLang, startLang, t, type Key } from "./i18n.ts";

afterEach(() => setLang("fr"));

describe("langue de départ", () => {
  it("français si le navigateur est en français, sinon anglais", () => {
    expect(detectLang("fr-FR")).toBe("fr");
    expect(detectLang("fr")).toBe("fr");
    expect(detectLang("fr-CA")).toBe("fr");
    expect(detectLang("en-US")).toBe("en");
    expect(detectLang("de-DE")).toBe("en");
    expect(detectLang("frr")).toBe("en");
    expect(detectLang(undefined)).toBe("en");
  });
  it("le choix gardé l'emporte sur le navigateur", () => {
    expect(startLang("en", "fr-FR")).toBe("en");
    expect(startLang("fr", "en-US")).toBe("fr");
    expect(startLang("xx", "fr-FR")).toBe("fr");
    expect(startLang(null, "en-GB")).toBe("en");
  });
});

describe("t()", () => {
  it("remplit les trous et accorde le pluriel selon la langue", () => {
    expect(t("ans.machines", { n: 1 })).toBe("1 machine");
    expect(t("ans.machines", { n: 0 })).toBe("0 machine");
    expect(t("ans.machines", { n: 3 })).toBe("3 machines");
    setLang("en");
    expect(t("ans.machines", { n: 0 })).toBe("0 machines");
    expect(t("ans.machines", { n: 1 })).toBe("1 machine");
    expect(t("pb.verify", { n: 2 })).toBe("{i:warn} 2 unverified values {i:more}");
    expect(t("ans.item.ok", { rate: "60", item: "Gear", by: "", counts: "3 machines", partial: "" })).toBe("For 60 Gear/min: 3 machines.");
  });
  it("écrit un nombre selon la langue", () => {
    expect(t("ans.machines", { n: 1234 })).toBe("1 234 machines");
    setLang("en");
    expect(t("ans.machines", { n: 1234 })).toBe("1,234 machines");
  });
  it("relie une liste avec « et » / « and »", () => {
    expect(joinList(["a", "b", "c"])).toBe("a, b et c");
    setLang("en");
    expect(joinList(["a", "b"])).toBe("a and b");
  });
  it("titres des vues traduits, adresses inchangées", () => {
    setLang("en");
    expect(goalTitle("objet")).toBe("What do you want to make?");
    expect(routeTitle(parseRoute("#objet/schema/x"))).toBe("Chart");
    expect(routeTitle(parseRoute("#usine/recherche"))).toBe("My research");
    expect(parseRoute("#energie")).toEqual({ page: "plan", goal: "énergie" });
  });
});

describe("nombres et dates", () => {
  it("français : virgule, espace fine insécable pour les milliers, $ après", () => {
    expect(fmt(1234.5)).toBe("1 234,5");
    expect(fmtMoney(950)).toBe("950 $");
    expect(fmtMoneyShort(2_100_000)).toBe("2,1 M$");
    expect(fmtShort(12_400)).toBe("12,4 k");
    expect(fmtPct("96")).toBe("96 %");
    expect(fmtDuration(2 * 86400 + 4 * 3600)).toBe("2 j 4 h");
  });
  it("anglais : point, virgule pour les milliers, $ devant", () => {
    setLang("en");
    expect(fmt(1234.5)).toBe("1,234.5");
    expect(fmtMoney(950)).toBe("$950");
    expect(fmtMoney(-5)).toBe("-$5");
    expect(fmtMoneyShort(2_100_000)).toBe("$2.1M");
    expect(fmtShort(12_400)).toBe("12.4k");
    expect(fmtPct("96")).toBe("96%");
    expect(fmtDuration(2 * 86400 + 4 * 3600)).toBe("2 d 4 h");
  });
});

describe("saisie des nombres (S31)", () => {
  it("français : virgule décimale (le point aussi), espaces des milliers", () => {
    expect(parseNum("1 234,5")).toBe(1234.5);
    expect(parseNum("1.5")).toBe(1.5);
    expect(parseNum("1,234")).toBe(1.234);
    expect(parseInput("durationS", "17,2")).toEqual({ ok: true, value: 17.2 });
    expect(parseEnergy("4,5 k")).toBe(4500);
  });
  it("anglais : « 1,234 » vaut 1234, le point est décimal, « 1,5 » n'est pas un nombre", () => {
    setLang("en");
    expect(parseNum("1,234")).toBe(1234);
    expect(parseNum("1,234.5")).toBe(1234.5);
    expect(parseNum("12,000,000")).toBe(12_000_000);
    expect(parseNum("1.5")).toBe(1.5);
    expect(parseNum("1,5")).toBeNaN();
    expect(parseInput("durationS", "1,234")).toEqual({ ok: true, value: 1234 });
    expect(parseInput("durationS", "abc")).toEqual({ ok: false, error: "number expected" });
    expect(parseInput("size", "8x8")).toEqual({ ok: true, value: { w: 8, l: 8 } });
    expect(parseEnergy("4.5k")).toBe(4500);
    expect(parseEnergy("4,500 MF/s")).toBe(4500);
  });
});

describe("catalogues", () => {
  const keys = Object.keys(fr) as Key[];
  it("l'anglais a toutes les clés du français, et pas d'autres", () => {
    expect(Object.keys(en).sort()).toEqual([...keys].sort());
  });
  it("mêmes trous {…} et mêmes formes de pluriel dans les deux langues", () => {
    const holes = (m: unknown) => [...new Set(JSON.stringify(m).match(/\{\w+\}/g) ?? [])].sort();
    for (const k of keys) {
      expect(holes(en[k]), k).toEqual(holes(fr[k]));
      expect(typeof en[k], k).toBe(typeof fr[k]);
    }
  });
  it("l'anglais n'a ni lettre accentuée ni mot français courant (hors « Français » du bouton)", () => {
    const FRENCH = /\b(le|la|les|des|pour|avec|dans|une|est|sont|à|ou|et)\b/;
    for (const k of keys) {
      if (k === "header.lang.fr" || k === "header.lang.aria") continue;
      const text = JSON.stringify(en[k]).replace(/<[^>]+>/g, " ");
      expect(text, k).not.toMatch(/[àâçéèêëîïôûùüÿœ]/i);
      expect(text, k).not.toMatch(FRENCH);
    }
  });
  it("chaque clé d'index.html existe dans le catalogue", () => {
    const used = [
      ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]!),
      ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1]!.split(";").map((p: string) => p.split("=")[1]!.trim())),
    ];
    expect(used.length).toBeGreaterThan(80);
    for (const k of used) expect(keys, k).toContain(k);
  });
});
