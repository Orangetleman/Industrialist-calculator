// Tableau de bord de l'auteur (S36) : ce qui se calcule sans page (filtres, champs traduits, liens), testé seul.
// Le tableau de bord est en français seulement (décision S36 Remarques) : ses textes ne passent pas par le catalogue.

export type TypeRemarque = "valeur" | "bogue" | "idee" | "traduction" | "correction";
export type EtatRemarque = "nouvelle" | "lue" | "traitee";
export type EtatSujet = "propose" | "prevu" | "fait" | "refuse";

/** Une remarque de la liste (server/service.ts, listeRemarques : sans la pièce jointe). */
export type Remarque = {
  id: number;
  cree: number;
  type: TypeRemarque;
  texte: string;
  pseudo: string | null;
  page: string | null;
  langue: "fr" | "en" | null;
  version: string | null;
  plan: string | null;
  aPiece: number;
  etat: EtatRemarque;
  reponse: string | null;
  repondu: number | null;
  sujet: number | null;
  traduction: string | null;
};

export const CHAMPS = ["titre", "titre_en", "description", "description_en", "reponse", "reponse_en"] as const;
export type Champ = (typeof CHAMPS)[number];

export type Sujet = { id: number; cree: number; maj: number | null; etat: EtatSujet; publie: number; auto: Champ[]; demandes: number; pour: number; contre: number; score: number } & Record<
  Champ,
  string | null
>;

export const TYPES: Record<TypeRemarque, string> = {
  valeur: "{i:warn} Valeur fausse",
  bogue: "{i:bug} Bogue",
  idee: "{i:idea} Idée",
  traduction: "{i:lang} Traduction",
  correction: "{i:send} Correction",
};
export const ETATS_REMARQUE: Record<EtatRemarque, string> = { nouvelle: "Nouvelle", lue: "Lue", traitee: "Traitée {i:check}" };
export const ETATS_SUJET: Record<EtatSujet, string> = { propose: "Proposé", prevu: "Prévu", fait: "Fait {i:check}", refuse: "Refusé" };

/** Filtre d'état de la boîte : « À traiter » (nouvelles et lues) par défaut. */
export type FiltreEtat = "a-traiter" | "nouvelle" | "non-rangees" | "traitee" | "toutes";
export const FILTRES_ETAT: Record<FiltreEtat, string> = {
  "a-traiter": "À traiter",
  nouvelle: "Nouvelles",
  "non-rangees": "Non rangées",
  traitee: "Traitées",
  toutes: "Toutes",
};
export type Filtres = { type: TypeRemarque | ""; etat: FiltreEtat; langue: "fr" | "en" | "" };

export function filtrer(liste: Remarque[], f: Filtres): Remarque[] {
  return liste.filter((r) => {
    if (f.type && r.type !== f.type) return false;
    if (f.langue && r.langue !== f.langue) return false;
    if (f.etat === "a-traiter") return r.etat !== "traitee";
    if (f.etat === "non-rangees") return r.sujet === null;
    if (f.etat === "nouvelle" || f.etat === "traitee") return r.etat === f.etat;
    return true;
  });
}

/** Le champ de l'autre langue (titre ↔ titre_en…). */
export const autreChamp = (c: Champ): Champ => (c.endsWith("_en") ? (c.slice(0, -3) as Champ) : (`${c}_en` as Champ));
export const estAnglais = (c: Champ): boolean => c.endsWith("_en");

/**
 * Ce que « 🌐 Traduire automatiquement » doit remplir : chaque champ vide dont l'autre langue est écrite, groupé par
 * langue d'arrivée (un appel au traducteur par langue).
 */
export function aTraduire(valeurs: Partial<Record<Champ, string>>): { vers: "fr" | "en"; depuis: Champ[]; vides: Champ[] }[] {
  const groupes = { fr: { depuis: [] as Champ[], vides: [] as Champ[] }, en: { depuis: [] as Champ[], vides: [] as Champ[] } };
  for (const c of CHAMPS) {
    const ici = (valeurs[c] ?? "").trim();
    const la = (valeurs[autreChamp(c)] ?? "").trim();
    if (!ici && la) {
      const g = groupes[estAnglais(c) ? "en" : "fr"];
      g.vides.push(c);
      g.depuis.push(autreChamp(c));
    }
  }
  return (["en", "fr"] as const).filter((v) => groupes[v].vides.length).map((v) => ({ vers: v, ...groupes[v] }));
}

/** L'adresse de la page d'où vient la remarque (« Planifier › Usine (#objet/pose) » → « /#objet/pose »). */
export function lienPage(page: string | null): string | null {
  const m = page?.match(/\((#[^()\s]*)\)\s*$/);
  return m ? `/${m[1]}` : null;
}

/** « il y a 4 min », « il y a 3 h », « hier », « le 21/10 ». */
export function depuis(ms: number, maintenant = Date.now()): string {
  const min = Math.floor((maintenant - ms) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.floor(min / 60)} h`;
  const jour = (x: number) => Math.floor((x - new Date(x).getTimezoneOffset() * 60_000) / 86_400_000);
  if (jour(maintenant) - jour(ms) === 1) return "hier";
  return `le ${new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`;
}

/** Titre d'un sujet pour une liste : le français, sinon l'anglais. */
export const titreDe = (s: Pick<Sujet, "titre" | "titre_en">): string => s.titre?.trim() || s.titre_en?.trim() || "(sans titre)";

/** Les messages d'erreur du service, en clair. */
export const ERREURS: Record<string, string> = {
  "mot-de-passe": "Mot de passe incorrect.",
  "trop-d-essais": "Trop d'essais : réessaie dans une heure.",
  "mot-de-passe-absent": "Aucun mot de passe n'est encore choisi sur le Pi (npm run remarques:mot-de-passe).",
  "non-connecte": "La session a expiré : entre à nouveau ton mot de passe.",
  reseau: "Le service des remarques ne répond pas.",
  "traducteur-absent": "Traducteur pas encore réglé : crée une clé gratuite DeepL (offre « Developer »), puis lance npm run remarques:traducteur.",
  "traducteur-cle": "DeepL refuse la clé : vérifie-la, puis relance npm run remarques:traducteur.",
  "traducteur-quota": "Le quota DeepL du mois est épuisé.",
  traducteur: "DeepL ne répond pas : réessaie dans un moment.",
  titre: "Il faut un titre, en français ou en anglais.",
  "reponse-vide": "Écris d'abord la réponse.",
};
export const erreur = (code: string): string => ERREURS[code] ?? `Refusé par le service (${code}).`;
