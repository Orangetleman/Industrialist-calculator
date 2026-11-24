// P3 bis b : pendant une session de lecture, la partie du joueur n'est ni lue ni écrite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProfile } from "../engine/share/index.ts";

const store = new Map<string, string>();
const g = globalThis as { localStorage?: unknown };
const before = g.localStorage;
const load = async () => ({
  ps: await import("./profile-store.ts"),
  pr: await import("./progress.ts"),
  st: await import("./state.ts"),
  sv: await import("./surveys.ts"),
  di: await import("./diesel.ts"),
});
const info = { design: 4, back: 2, mine: { existing: { iron: 3 }, useExisting: true } };
const profile: DesignProfile = { progress: { unlocked: ["a"], reqItemsDone: [], owned: ["press"] }, player: { money: 5, month: 11, difficulty: "normal" }, corrections: { recipes: { r: { durationS: { value: 4 } } } } };

beforeEach(() => {
  store.clear();
  vi.resetModules();
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
});
afterEach(() => void (g.localStorage = before));

describe("profil actif", () => {
  it("lecture : le profil du design, la partie du joueur intacte et retrouvée", async () => {
    const { ps, pr, st, sv, di } = await load();
    pr.saveProgress({ unlocked: ["mine"], reqItemsDone: [], owned: [] });
    pr.savePlayer({ ...pr.EMPTY_PLAYER, money: 1 });
    st.saveCorrections({ items: { x: {} } });
    sv.saveLocalSurveys({});
    di.saveDieselReadings([]);
    const mine = new Map(store);
    ps.enterLecture(profile, info);
    expect(pr.loadProgress().owned).toEqual(["press"]);
    expect(pr.loadPlayer()).toMatchObject({ money: 5, month: 11 });
    expect(st.loadCorrections()).toEqual(profile.corrections);
    pr.saveProgress({ unlocked: ["a", "b"], reqItemsDone: [], owned: [] });
    pr.savePlayer({ ...pr.EMPTY_PLAYER, money: 99 });
    pr.saveJournal({ clock: { playing: false, since: 0, game: 0, seen: 0 }, events: [] });
    st.saveCorrections({});
    sv.saveLocalSurveys({});
    sv.saveLocalInterfaces({});
    di.saveDieselReadings([]);
    expect(pr.loadProgress().unlocked).toEqual(["a", "b"]);
    for (const [k, v] of mine) expect(store.get(k), k).toBe(v);
    expect([...store.keys()].filter((k) => !mine.has(k))).toEqual(["ind-calc:v1:lecture"]);
    ps.leaveLecture();
    expect(pr.loadProgress().unlocked).toEqual(["mine"]);
    expect(store).toEqual(mine);
  });

  it("ce qui n'est pas du profil reste au joueur (réglages, notes, modulaires)", async () => {
    const { ps, st, sv } = await load();
    ps.enterLecture(profile, info);
    st.saveNotes({});
    sv.saveLocalModular({});
    st.saveSettings(st.DEFAULT_SETTINGS);
    for (const k of ["notes", "modulaires", "settings"]) expect(store.has(`ind-calc:v1:${k}`), k).toBe(true);
  });

  it("gardée au rechargement, avec ce qu'on y a changé ; un enregistrement abîmé est ignoré", async () => {
    const a = await load();
    a.ps.enterLecture(profile, info);
    a.pr.savePlayer({ ...a.pr.EMPTY_PLAYER, money: 7 });
    a.ps.setLectureDesign(9);
    vi.resetModules();
    const b = await load();
    expect(b.ps.lecture()).toMatchObject({ design: 9, back: 2, mine: info.mine });
    expect(b.pr.loadPlayer().money).toBe(7);
    store.set("ind-calc:v1:lecture", "{\"keys\":{}}");
    vi.resetModules();
    expect((await load()).ps.lecture()).toBeNull();
  });

  it("l'essai d'un design reçu n'enregistre rien et rend le profil d'avant, même en cas d'erreur", async () => {
    const { ps, pr } = await load();
    pr.saveProgress({ unlocked: ["mine"], reqItemsDone: [], owned: [] });
    const was = new Map(store);
    expect(ps.withProfile(profile, () => { pr.saveProgress({ unlocked: ["z"], reqItemsDone: [], owned: [] }); return pr.loadProgress().unlocked; })).toEqual(["z"]);
    expect(() => ps.withProfile(profile, () => { throw new Error("x"); })).toThrow();
    expect(ps.lecture()).toBeNull();
    expect(store).toEqual(was);
  });
});
