import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { ouvrirBase } from "./base.ts";
import { EXTRAIT_MAX, messageDiscord, posterDiscord, WEBHOOK } from "./discord.ts";
import { hacherMotDePasse } from "./securite.ts";
import { creerService, type RemarqueRecue } from "./service.ts";

const TABLEAU = "https://industrialist.myprisme.fr/tableau/";
const ADRESSE = "https://discord.com/api/webhooks/123456789/abc_DEF-123";
const recue = (r: Partial<RemarqueRecue> = {}): RemarqueRecue => ({ id: 14, type: "idee", texte: "Share a plan with a link.", pseudo: "steelworker_42", page: "Plan › 60 Gearbox/min", langue: "en", version: "2026-10-25 a1b2c3d", piece: null, ...r });

describe("message Discord (S35)", () => {
  it("titre, extrait, pied et lien vers le tableau de bord ; personne n'est mentionné", () => {
    const m = messageDiscord(recue({ texte: "@everyone regardez" }), TABLEAU);
    expect(m.allowed_mentions).toEqual({ parse: [] });
    const [e] = m.embeds as Record<string, unknown>[];
    expect(e).toMatchObject({ title: "💡 Idée · n° 14 · EN", url: `${TABLEAU}#14`, description: "@everyone regardez" });
    expect((e!.footer as { text: string }).text).toBe("Plan › 60 Gearbox/min · steelworker_42 · version 2026-10-25 a1b2c3d");
  });

  it("coupe le texte à 300 caractères, dit « sans pseudo », et résume le fichier d'une correction", () => {
    const m = messageDiscord(recue({ type: "correction", texte: "x".repeat(1000), pseudo: null, page: null, version: null, piece: { fichier: "overrides.json", resume: "3 corrections, 1 note", contenu: {} } }), TABLEAU);
    const [e] = m.embeds as { description: string; title: string; footer: { text: string } }[];
    expect(e!.description).toHaveLength(EXTRAIT_MAX);
    expect(e!.description.endsWith("…")).toBe(true);
    expect(e!.title).toBe("📤 Correction · n° 14 · EN");
    expect(e!.footer.text).toBe("Fichier : overrides.json (3 corrections, 1 note) · sans pseudo");
  });

  it("n'accepte que l'adresse d'un webhook Discord, et un échec ne lève jamais d'erreur", async () => {
    expect(WEBHOOK.test(ADRESSE)).toBe(true);
    expect(WEBHOOK.test("https://example.com/api/webhooks/1/a")).toBe(false);
    expect(WEBHOOK.test(`${ADRESSE}?wait=true`)).toBe(false);
    const appels: string[] = [];
    const faux = (async (url: string) => {
      appels.push(url);
      throw new Error("réseau");
    }) as unknown as typeof fetch;
    expect(await posterDiscord("https://example.com/x", {}, faux)).toBe(false);
    expect(appels).toHaveLength(0);
    expect(await posterDiscord(ADRESSE, {}, faux)).toBe(false);
    expect(appels).toEqual([ADRESSE]);
  });

  it("le service annonce chaque remarque gardée, avec son n° court, et pas celles du piège", async () => {
    const base = ouvrirBase(":memory:");
    const annonces: RemarqueRecue[] = [];
    const service = creerService({
      base,
      origines: ["https://industrialist.myprisme.fr"],
      lireMotDePasse: () => hacherMotDePasse("x"),
      annoncer: (r) => {
        annonces.push(r);
        throw new Error("Discord en panne");
      },
    });
    await new Promise<void>((ok) => service.serveur.listen(0, "127.0.0.1", ok));
    const url = `http://127.0.0.1:${(service.serveur.address() as AddressInfo).port}/api/remarques`;
    const envoyer = (corps: unknown) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://industrialist.myprisme.fr" }, body: JSON.stringify(corps) }).then(async (r) => ({ statut: r.status, corps: (await r.json()) as Record<string, unknown> }));
    try {
      const a = await envoyer({ type: "bogue", texte: "Le bouton ne fait rien.", langue: "fr" });
      expect(a.statut).toBe(201);
      expect(a.corps.id).toBe(1);
      const piece = { fichier: "overrides.json", resume: "1 correction", contenu: { recipes: {} } };
      const b = await envoyer({ type: "correction", texte: "", piece });
      expect(b.corps.id).toBe(2);
      await envoyer({ type: "idee", texte: "pub", siteWeb: "http://pub.example" });
      expect(annonces.map((r) => [r.id, r.type])).toEqual([[1, "bogue"], [2, "correction"]]);
      expect(annonces[1]!.piece).toEqual(piece);
      const relue = await fetch(`${url}/${a.corps.numero}`).then((r) => r.json());
      expect(relue).toMatchObject({ id: 1, type: "bogue", etat: "nouvelle" });
    } finally {
      await new Promise((ok) => service.serveur.close(ok));
      base.close();
    }
  });
});
