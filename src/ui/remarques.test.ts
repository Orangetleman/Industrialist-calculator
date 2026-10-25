// S35 : remarques côté site (envoi, « Mes remarques », réponses nouvelles), sans navigateur ni service.
import { describe, expect, it } from "vitest";
import { checkOutgoing, markSeen, refreshMine, rememberSent, sendRemark, signature, TEXT_MAX, unseenReplies, type MyRemark, type Outgoing } from "./remarques.ts";

const out = (o: Partial<Outgoing> = {}): Outgoing => ({ type: "bogue", texte: "Le bouton ne fait rien.", pseudo: "", page: "Planifier (#objet)", plan: null, langue: "fr", version: "dev", ...o });
const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

describe("S35 : envoyer une remarque", () => {
  it("vérifie comme le service : texte vide sans pièce, plus de 2 000 caractères", () => {
    expect(checkOutgoing(out({ texte: "   " }))).toEqual({ code: "vide" });
    expect(checkOutgoing(out({ texte: "", piece: { fichier: "overrides.json", resume: "1 note", contenu: {} } }))).toBeNull();
    expect(checkOutgoing(out({ texte: "x".repeat(TEXT_MAX) }))).toBeNull();
    expect(checkOutgoing(out({ texte: "x".repeat(TEXT_MAX + 14) }))).toEqual({ code: "long", over: 14 });
  });

  it("envoie le texte nettoyé et la case piège vide, et rend le n° court et le numéro secret", async () => {
    let corps: Record<string, unknown> = {};
    const faux = (async (_url: string, init: RequestInit) => {
      corps = JSON.parse(String(init.body));
      return reponse(201, { numero: "secret123", id: 7 });
    }) as unknown as typeof fetch;
    expect(await sendRemark(out({ texte: "  Bonjour  ", pseudo: "  " }), faux)).toEqual({ ok: true, id: 7, numero: "secret123" });
    expect(corps).toMatchObject({ type: "bogue", texte: "Bonjour", siteWeb: "", langue: "fr" });
    expect(corps).not.toHaveProperty("pseudo");
  });

  it("un refus garde son code ; sans réponse du service (réseau, 502 de nginx), c'est « reseau »", async () => {
    const avec = (status: number, c: unknown) => (async () => reponse(status, c)) as unknown as typeof fetch;
    expect(await sendRemark(out(), avec(429, { erreur: "trop-de-remarques" }))).toEqual({ ok: false, code: "trop-de-remarques" });
    expect(await sendRemark(out(), (async () => new Response("<html>502</html>", { status: 502 })) as unknown as typeof fetch)).toEqual({ ok: false, code: "reseau" });
    expect(await sendRemark(out(), (async () => Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch)).toEqual({ ok: false, code: "reseau" });
  });
});

describe("S35 : Mes remarques", () => {
  const une = (): MyRemark[] => rememberSent([], out(), { id: 3, numero: "abc" }, 1000);

  it("relit l'état et la réponse ; une réponse nouvelle compte jusqu'à l'ouverture de l'onglet", async () => {
    const faux = (async () => reponse(200, { id: 3, type: "bogue", etat: "traitee", reponse: "Corrigé.", repondu: 5000 })) as unknown as typeof fetch;
    const lue = (await refreshMine(une(), faux))!;
    expect(lue[0]).toMatchObject({ id: 3, etat: "traitee", reponse: "Corrigé." });
    expect(unseenReplies(lue)).toBe(1);
    expect(unseenReplies(markSeen(lue))).toBe(0);
  });

  it("une remarque supprimée par l'auteur est marquée ; sans service, rien n'est relu (null)", async () => {
    const absente = (async () => reponse(404, { erreur: "introuvable" })) as unknown as typeof fetch;
    expect((await refreshMine(une(), absente))![0]!.disparue).toBe(true);
    const panne = (async () => Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch;
    expect(await refreshMine(une(), panne)).toBeNull();
  });

  it("une correction garde son résumé, et la signature change quand le fichier change", () => {
    const r = rememberSent([], out({ type: "correction", texte: "", piece: { fichier: "overrides.json", resume: "2 corrections", contenu: { a: 1 } } }), { id: 4, numero: "n" }, 0);
    expect(r[0]).toMatchObject({ type: "correction", resume: "2 corrections", extrait: "" });
    expect(signature({ a: 1 })).toBe(signature({ a: 1 }));
    expect(signature({ a: 1 })).not.toBe(signature({ a: 2 }));
  });
});
