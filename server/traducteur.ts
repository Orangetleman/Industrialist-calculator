/**
 * Service des remarques (S36) : la traduction automatique, par l'API de DeepL (décision S36 : DeepL API Free).
 *
 * - Appelée seulement depuis le tableau de bord, d'un clic de l'auteur (« 🌐 Traduire ») : un visiteur ne déclenche
 *   jamais de traduction, et le résultat est gardé dans la base.
 * - La clé est créée par l'auteur sur son compte DeepL et collée par lui sur le Pi (`npm run remarques:traducteur`) ;
 *   elle est relue à chaque appel et n'est jamais renvoyée au navigateur.
 * - Une clé « Free » finit par « :fx » et passe par api-free.deepl.com, une autre par api.deepl.com
 *   (documentation DeepL, « Usage and limits » : 500 000 caractères par mois avec l'offre gratuite).
 */

export type Langue = "fr" | "en";
/** Échec d'une traduction, en code (traduit par le tableau de bord). */
export class ErreurTraduction extends Error {
  code: "traducteur-absent" | "traducteur-cle" | "traducteur-quota" | "traducteur";
  constructor(code: ErreurTraduction["code"]) {
    super(code);
    this.code = code;
  }
}
export type Traduire = (textes: string[], vers: Langue) => Promise<string[]>;

/** Le site parle anglais américain du jeu (Roblox) ; DeepL demande une variante pour l'anglais. */
const CIBLE: Record<Langue, string> = { fr: "FR", en: "EN-US" };
export const TEXTES_MAX = 20;
export const CARACTERES_MAX = 10_000;

export function adresseDeepL(cle: string): string {
  return cle.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
}

/** Un traducteur DeepL ; `lireCle` rend null tant que l'auteur n'a pas posé sa clé. */
export function traducteurDeepL(lireCle: () => string | null, envoyer: typeof fetch = fetch): Traduire {
  return async (textes, vers) => {
    const cle = lireCle();
    if (!cle) throw new ErreurTraduction("traducteur-absent");
    let r: Response;
    try {
      r = await envoyer(adresseDeepL(cle), {
        method: "POST",
        headers: { Authorization: `DeepL-Auth-Key ${cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: textes, target_lang: CIBLE[vers] }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ErreurTraduction("traducteur");
    }
    if (r.status === 401 || r.status === 403) throw new ErreurTraduction("traducteur-cle");
    if (r.status === 456) throw new ErreurTraduction("traducteur-quota");
    if (!r.ok) throw new ErreurTraduction("traducteur");
    const corps = (await r.json().catch(() => null)) as { translations?: { text?: unknown }[] } | null;
    const sortie = corps?.translations?.map((t) => t.text);
    if (!sortie || sortie.length !== textes.length || sortie.some((t) => typeof t !== "string")) throw new ErreurTraduction("traducteur");
    return sortie as string[];
  };
}

/** Traducteur d'essai (`npm run remarques`, REMARQUES_TRADUCTEUR=essai) : marque le texte sans rien envoyer dehors. */
export const traducteurEssai: Traduire = async (textes, vers) => textes.map((t) => `[${vers.toUpperCase()}] ${t}`);
