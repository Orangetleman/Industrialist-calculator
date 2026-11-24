// P3 bis c : imprimer un profil, et revenir à la partie d'avant.
import { describe, expect, it } from "vitest";
import { decodeDesign, encodeDesign, SITE_VERSION, type DesignProfile } from "../engine/share/index.ts";
import { EMPTY_PLAYER } from "./progress.ts";
import { PROFILE_KEYS as K } from "./profile-store.ts";
import { groupsOf, hasContrib, noPrints, printOnto, readPrints, reprint, settled, unprint, type OwnKeys } from "./print-profile.ts";
import { assembleProfile, dropAdvice } from "./share-design.ts";

const own: OwnKeys = {
  [K.progress]: JSON.stringify({ unlocked: ["mine"], reqItemsDone: [], owned: [] }),
  [K.player]: JSON.stringify({ ...EMPTY_PLAYER, money: 1, plotW: 10, plotH: 20, spendRp: true }),
  [K.journal]: null,
  [K.corrections]: JSON.stringify({ items: { a: { x: 1 }, b: { x: 1 } } }),
  [K.surveys]: JSON.stringify({ machines: { m1: 1, m2: 1 } }),
  [K.interfaces]: null,
  [K.diesel]: JSON.stringify({ diesel: [{ id: "d1", v: 1 }, { id: "d2" }] }),
};
const p: DesignProfile = {
  progress: { unlocked: ["x", "y"], reqItemsDone: [], owned: ["press"] },
  player: { ...EMPTY_PLAYER, money: 9, rp: 50, month: 11, plotW: 200, plotH: 160 },
  corrections: { items: { b: { x: 2 } } },
  surveys: { m2: 2, m3: 3 },
  diesel: [{ id: "d1", v: 2 }],
};
const get = (k: OwnKeys, key: string) => JSON.parse(k[key]!);

describe("imprimer", () => {
  it("seulement ce qui est coché ; l'original n'est pas touché", () => {
    const was = structuredClone(own);
    const r = printOnto(own, p, ["plot"], 5);
    expect(get(r, K.player)).toMatchObject({ plotW: 200, plotH: 160, money: 1, spendRp: true });
    for (const k of [K.progress, K.corrections, K.surveys, K.diesel, K.journal]) expect(r[k]).toBe(own[k]);
    expect(own).toEqual(was);
  });
  it("recherches remplacées ; RP : le journal reçoit le relevé", () => {
    const r = printOnto(own, p, ["research", "money"], 5);
    expect(get(r, K.progress)).toEqual(p.progress);
    expect(get(r, K.player)).toMatchObject({ money: 9, rp: 50, rpAt: 5, plotW: 10 });
    expect(get(r, K.journal).events.at(-1)).toMatchObject({ type: "releve", rp: 50 });
  });
  it("contributions ajoutées aux siennes, celles du design l'emportent", () => {
    const r = printOnto(own, p, ["contrib"], 5);
    expect(get(r, K.corrections).items).toEqual({ a: { x: 1 }, b: { x: 2 } });
    expect(get(r, K.surveys).machines).toEqual({ m1: 1, m2: 2, m3: 3 });
    expect(get(r, K.diesel).diesel).toEqual([{ id: "d2" }, { id: "d1", v: 2 }]);
    expect(r[K.interfaces]).toBeNull();
  });
  it("« Je joue » est arrêté dans une partie remise", () => {
    const j = { clock: { playing: true, since: 0, game: 0, seen: 1000 }, events: [] };
    expect(get(settled({ ...own, [K.journal]: JSON.stringify(j) }, 9e9), K.journal).clock.playing).toBe(false);
    expect(settled(own, 1)).toBe(own);
  });
});

describe("revenir", () => {
  const A = { a: "0" }, B = { a: "A" }, now = { a: "B+" };
  const two = { on: [{ design: 1, name: "A", keys: A }, { design: 2, name: "B", keys: B }], off: [] };
  it("la dernière impression se défait, et revient si le design est restauré", () => {
    const u = unprint(two, 2, now);
    expect(u.apply).toEqual(B);
    expect(u.prints.on).toEqual([two.on[0]]);
    const r = reprint(u.prints, 2, B);
    expect(r.apply).toEqual(now);
    expect(r.prints).toEqual(two);
  });
  it("une impression plus ancienne : la partie actuelle reste, la suivante rendra la toute première", () => {
    const u = unprint(two, 1, now);
    expect(u.apply).toBeNull();
    expect(unprint(u.prints, 2, now).apply).toEqual(A);
  });
  it("design jamais imprimé : rien ; enregistrement abîmé : écarté", () => {
    expect(unprint(two, 9, now)).toEqual({ prints: two, apply: null });
    expect(readPrints(JSON.parse(JSON.stringify(two)))).toEqual(two);
    expect(readPrints({ on: [{ design: 1 }, { design: 1, name: "x", keys: { a: 4 } }] })).toEqual(noPrints());
  });
});

describe("profil et contributions séparés", () => {
  const src = { progress: p.progress!, player: EMPTY_PLAYER, month: 11, rp: null, corrections: p.corrections as object, surveys: {}, interfaces: {}, diesel: [] };
  const back = async (x: DesignProfile) => (await decodeDesign(await encodeDesign({ site: SITE_VERSION, settings: {}, profile: x }))).profile;
  it("chaque case donne sa part, aller-retour exact", async () => {
    const both = assembleProfile(src), only = assembleProfile(src, { base: false, contrib: true }), bare = assembleProfile(src, { base: true, contrib: false });
    expect([groupsOf(both).length, groupsOf(only), hasContrib(bare), bare.partial]).toEqual([6, ["contrib"], false, true]);
    expect(assembleProfile({ ...src, corrections: {} }, { base: true, contrib: false }).partial).toBeUndefined();
    for (const x of [both, only, bare]) expect(await back(x)).toStrictEqual(x);
  });
  it("lien trop long : la première version allégée qui passe", () => {
    const o = [{ drop: { sandbox: true, contrib: false }, len: 2500 }, { drop: { sandbox: false, contrib: true }, len: 1800 }];
    expect(dropAdvice(2600, o)).toBe(o[1]);
    expect(dropAdvice(1900, o)).toBeNull();
    expect(dropAdvice(9000, o.slice(0, 1))).toBeNull();
  });
});
