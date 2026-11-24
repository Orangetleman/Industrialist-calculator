// P3 bis a : le profil de l'auteur dans le lien (PLAN-PARTAGE.md § 6 ter). Aller-retour exact, liste de recherches
// figée, et tailles réelles (PROFIL=1 pour les afficher).
import { describe, expect, it } from "vitest";
import portsJson from "../../data/ports.json";
import researchJson from "../../data/research.json";
import { PLAYER_V1, decodeDesign, encodeDesign, SITE_VERSION, type Design, type DesignProfile } from "../engine/share/codec.ts";
import { NODES_V1 } from "../engine/share/nodes-v1.ts";
import { emptySetup } from "../engine/research-balance.ts";
import { EMPTY_PLAYER, type PlayerInfo, type ProgressState } from "./progress.ts";
import { assembleProfile } from "./share-design.ts";
import { editedGraph, editOf, planFor, settingsWith } from "../../tests/share-designs.ts";

const ids = (researchJson as { nodes: { id: string }[] }).nodes.map((n) => n.id);
const player: PlayerInfo = { ...EMPTY_PLAYER, pollutionPct: 8.5, igloo: true, difficulty: "normal", money: 2_000_000, rp: 900, rpAt: 1764000000000, rpPerSec: 12.5, spendRp: true, plotW: 200, plotH: 160 };
const profile = (progress: Partial<ProgressState> = {}, extra: Partial<Parameters<typeof assembleProfile>[0]> = {}): DesignProfile =>
  assembleProfile({ progress: { unlocked: [], reqItemsDone: [], owned: [], ...progress }, player, month: 11, rp: 950.5, corrections: {}, surveys: {}, interfaces: {}, diesel: [], ...extra });
const g = editedGraph(planFor("gearbox", 120));
const design: Design = { site: SITE_VERSION, name: "Gearbox 120/min", settings: settingsWith({ item: "gearbox", rate: 120, rateUnit: "min", entered: ["objet"] }), graph: editOf("objet|gearbox|rate|120", g, g) };
const back = async (p: DesignProfile) => (await decodeDesign(await encodeDesign({ ...design, profile: p }))).profile;

describe("profil de l'auteur", () => {
  it("chaque recherche du jeu a son rang (une nouvelle recherche va EN FIN de NODES_V1), sans doublon", () => {
    expect(ids.filter((id) => !NODES_V1.includes(id))).toEqual([]);
    expect(new Set(NODES_V1).size).toBe(NODES_V1.length);
    expect(NODES_V1.length).toBeGreaterThanOrEqual(149);
  });

  it("les défauts figés de « Ma partie » sont ceux du site (un nouveau champ va EN FIN de PLAYER_V1)", () => {
    expect(PLAYER_V1.map(([k]) => k)).toEqual(Object.keys(EMPTY_PLAYER));
    expect(Object.fromEntries(PLAYER_V1)).toStrictEqual(EMPTY_PLAYER);
  });

  it("ce qui part : le mois résolu, les RP du moment, jamais l'heure du relevé ni le réglage de dépense", () => {
    const p = profile();
    expect(p.player).toMatchObject({ month: 11, rp: 950.5, rpAt: null, spendRp: false, plotW: 200, difficulty: "normal" });
    expect(Object.keys(p)).toEqual(["progress", "player"]);
    expect(player.rpAt).not.toBeNull(); // la partie de l'auteur n'est pas touchée
  });

  it("l'ordre des recherches débloquées ne change pas le profil", () => {
    expect(profile({ unlocked: [...ids].reverse() })).toStrictEqual(profile({ unlocked: ids }));
  });

  it("aller-retour exact : neuf, moitié, tout, avec corrections, relevés, recherche inconnue", async () => {
    const all: DesignProfile[] = [
      profile(),
      profile({ unlocked: ids.filter((_, i) => i % 2), reqItemsDone: ids.slice(0, 5), owned: ["press", "iron-drill"] }),
      profile({ unlocked: ids }),
      profile({ unlocked: [...ids, "recherche-future"] }),
      profile({ unlocked: ids }, { player: { ...player, research: emptySetup() }, corrections: { recipes: { "iron-ingot": { durationS: { value: 4 } } } }, surveys: portsJson.machines, interfaces: { press: { settings: [] } }, diesel: [{ id: "d1" }] }),
      { ...profile(), progress: { unlocked: [ids[3]!, ids[1]!, ids[1]!], reqItemsDone: [], owned: [] } },
    ];
    for (const p of all) expect(await back(p)).toStrictEqual(p);
  });

  it("tailles : un profil ordinaire coûte moins de 160 caractères", async () => {
    const base = (await encodeDesign(design)).length;
    const cost = async (p: DesignProfile) => (await encodeDesign({ ...design, profile: p })).length - base;
    const one = Object.fromEntries(Object.entries(portsJson.machines).slice(0, 1));
    const rows = {
      "neuf": await cost(profile()),
      "une recherche sur deux, au hasard": await cost(profile({ unlocked: ids.filter((_, i) => (i * 7919) % 13 < 6) })),
      "tout débloqué": await cost(profile({ unlocked: ids })),
      "avec « Ma recherche » (vide)": await cost(profile({ unlocked: ids }, { player: { ...player, research: emptySetup() } })),
      "avec un relevé de ports": await cost(profile({ unlocked: ids }, { surveys: one })),
    };
    if (process.env.PROFIL === "1") console.log(`sans profil : ${base}`, rows);
    for (const k of ["neuf", "une recherche sur deux, au hasard", "tout débloqué"] as const) expect(rows[k], k).toBeLessThan(160);
  });
});
