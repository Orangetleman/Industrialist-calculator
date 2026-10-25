/**
 * Service des remarques (S35) : le message posté dans le salon Discord réservé de l'auteur, par un webhook du salon
 * (rien ne passe par le bot de MyPrism). Maquette `maquette/remarques.html`, écran 6.
 *
 * - Le message ne mentionne jamais personne (`allowed_mentions.parse` vide : un « @everyone » écrit par un joueur
 *   reste du texte).
 * - Le texte est coupé à 300 caractères ; la remarque entière est dans le tableau de bord.
 * - Si Discord ne répond pas, la remarque est déjà gardée : l'échec est seulement noté dans le journal.
 */
import type { RemarqueRecue } from "./service.ts";

export const EXTRAIT_MAX = 300;
/** Adresse d'un webhook Discord (vérifiée avant d'être gardée sur le Pi, et à chaque lecture). */
export const WEBHOOK = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const TYPES: Record<string, string> = {
  valeur: "⚠ Valeur fausse",
  bogue: "🐞 Bogue",
  idee: "💡 Idée",
  traduction: "🌐 Traduction",
  correction: "📤 Correction",
};
const COULEURS: Record<string, number> = { correction: 0x5b8def };
const ORANGE = 0xf0913a;

function couper(texte: string, max: number): string {
  return texte.length > max ? `${texte.slice(0, max - 1).trimEnd()}…` : texte;
}

/** Le corps JSON du webhook pour une remarque (fonction pure, testée). */
export function messageDiscord(r: RemarqueRecue, tableau: string): Record<string, unknown> {
  const titre = `${TYPES[r.type] ?? r.type} · n° ${r.id}${r.langue ? ` · ${r.langue.toUpperCase()}` : ""}`;
  const piece = typeof r.piece === "object" && r.piece !== null ? (r.piece as Record<string, unknown>) : null;
  const pied: string[] = [];
  if (piece) {
    const fichier = typeof piece.fichier === "string" ? piece.fichier : "fichier joint";
    pied.push(typeof piece.resume === "string" ? `Fichier : ${fichier} (${couper(piece.resume, 120)})` : `Fichier : ${fichier}`);
  }
  if (r.page) pied.push(couper(r.page, 120));
  pied.push(r.pseudo ? couper(r.pseudo, 40) : "sans pseudo");
  if (r.version) pied.push(`version ${couper(r.version, 40)}`);
  return {
    username: "Remarques Industrialist",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: titre,
        url: `${tableau}#${r.id}`,
        description: r.texte ? couper(r.texte, EXTRAIT_MAX) : "(sans texte)",
        color: COULEURS[r.type] ?? ORANGE,
        footer: { text: pied.join(" · ") },
      },
    ],
  };
}

/** Poste le message ; ne lève jamais d'erreur (la remarque est déjà gardée). */
export async function posterDiscord(webhook: string, corps: Record<string, unknown>, envoyer: typeof fetch = fetch): Promise<boolean> {
  if (!WEBHOOK.test(webhook)) {
    console.error("Discord : adresse du webhook invalide, message non posté.");
    return false;
  }
  try {
    const r = await envoyer(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error(`Discord : réponse ${r.status}, message non posté.`);
    return r.ok;
  } catch (e) {
    console.error("Discord injoignable :", (e as Error).message);
    return false;
  }
}
