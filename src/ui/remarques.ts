// Remarques des joueurs (S35), côté site : envoi au service (server/, S34), « Mes remarques » gardées dans ce
// navigateur, brouillon et pseudo. Sans DOM (sauf localStorage et fetch, passés en paramètre pour les tests).
// Il n'y a pas de compte : le site garde le numéro secret de chaque remarque envoyée d'ici, qui seul permet de
// relire son état et la réponse de l'auteur (GET /api/remarques/<numéro>).

export type RemarkType = "valeur" | "bogue" | "idee" | "traduction" | "correction";
export const PLAYER_TYPES: RemarkType[] = ["valeur", "bogue", "idee", "traduction"];
/** Limite du service (server/service.ts, TEXTE_MAX), comptée de la même façon (longueur JS, après trim). */
export const TEXT_MAX = 2000;
/** Limite de la pièce jointe (server/service.ts, PIECE_MAX : JSON.stringify de la pièce). */
export const PIECE_MAX = 200_000;
/** Discord du jeu, où l'on peut aussi écrire (en mentionnant @orangentleman, réponses de l'utilisateur du 2026-10-25). */
export const GAME_DISCORD = "https://discord.com/invite/SWERdzfdNF";
const API = "/api/remarques";

/** Le fichier joint d'une correction : le même contenu que l'export (intégré à la main par « Importer… »). */
export type Piece = { fichier: string; resume: string; contenu: unknown };

/** Une remarque envoyée depuis ce navigateur. */
export type MyRemark = {
  numero: string;
  id: number;
  type: RemarkType;
  /** Début du texte (120 caractères), pour se souvenir de ce qu'on a écrit. */
  extrait: string;
  /** Pour une correction : son résumé (« 3 corrections de valeur, 1 note »). */
  resume?: string;
  cree: number;
  /** Dernier état relu au service. */
  etat?: "nouvelle" | "lue" | "traitee";
  reponse?: string | null;
  repondu?: number | null;
  /** Date de la réponse déjà vue par le joueur (onglet « Mes remarques » ouvert). */
  vu?: number | null;
  /** Le service ne la connaît plus (supprimée par l'auteur). */
  disparue?: boolean;
};

export type Outgoing = {
  type: RemarkType;
  texte: string;
  pseudo: string;
  page: string;
  plan: string | null;
  langue: "fr" | "en";
  version: string;
  piece?: Piece;
  /** Case piège (server/service.ts, CHAMP_PIEGE) : vide pour un humain. */
  siteWeb?: string;
};

/** Code d'un échec : ceux du service (`{ erreur }`), plus « reseau » (pas de réponse) et « vide » / « long » (avant l'envoi). */
export type SendResult = { ok: true; id: number; numero: string } | { ok: false; code: string };

const KEY_MINE = "ind-calc:v1:remarques";
const KEY_DRAFT = "ind-calc:v1:remarque-brouillon";
const KEY_PSEUDO = "ind-calc:v1:remarque-pseudo";
const KEY_SENT = "ind-calc:v1:corrections-envoyees";
const KEY_CHECKED = "ind-calc:v1:remarques-relues";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible : pour cette visite seulement
  }
}

export const loadMine = (): MyRemark[] => {
  const list = read<unknown>(KEY_MINE, []);
  return Array.isArray(list) ? list.filter((r): r is MyRemark => typeof r?.numero === "string" && typeof r?.id === "number") : [];
};
export const saveMine = (list: MyRemark[]): void => write(KEY_MINE, list);

/** Brouillon de la fenêtre (gardé tant qu'il n'est pas envoyé, Q26 : « le texte est gardé »). */
export type Draft = { type: RemarkType; texte: string };
export const loadDraft = (): Draft | null => read<Draft | null>(KEY_DRAFT, null);
export const saveDraft = (d: Draft | null): void => write(KEY_DRAFT, d && d.texte.trim() ? d : null);
export const loadPseudo = (): string => read<string>(KEY_PSEUDO, "");
export const savePseudo = (p: string): void => write(KEY_PSEUDO, p.trim() || null);

/** Dernier envoi de chaque fichier de corrections (« Envoyées le 25/10 (n° 12) ») et ce qui était envoyé. */
export type SentFix = { id: number; at: number; sig: string };
export const loadSent = (): Record<string, SentFix> => read<Record<string, SentFix>>(KEY_SENT, {});
export function markSent(fichier: string, s: SentFix): void {
  write(KEY_SENT, { ...loadSent(), [fichier]: s });
}

/** Ce qu'on vérifie avant l'envoi, comme le service (texte vide sans pièce, trop long). */
export function checkOutgoing(o: Pick<Outgoing, "texte" | "piece">): { code: "vide" | "long" | "piece"; over?: number } | null {
  const texte = o.texte.trim();
  if (texte.length > TEXT_MAX) return { code: "long", over: texte.length - TEXT_MAX };
  if (!texte && !o.piece) return { code: "vide" };
  if (o.piece && JSON.stringify(o.piece).length > PIECE_MAX) return { code: "piece" };
  return null;
}

/** Envoie une remarque ; ne lève jamais d'erreur. */
export async function sendRemark(o: Outgoing, envoyer: typeof fetch = fetch): Promise<SendResult> {
  const avant = checkOutgoing(o);
  if (avant) return { ok: false, code: avant.code === "piece" ? "piece-trop-longue" : avant.code };
  try {
    const r = await envoyer(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...o, texte: o.texte.trim(), pseudo: o.pseudo.trim() || undefined, siteWeb: o.siteWeb ?? "" }),
    });
    const corps = (await r.json().catch(() => ({}))) as { numero?: string; id?: number; erreur?: string };
    if (r.ok && typeof corps.numero === "string" && typeof corps.id === "number") return { ok: true, id: corps.id, numero: corps.numero };
    // Sans réponse JSON du service (nginx : 502, 504…), c'est le service qui ne répond pas.
    return { ok: false, code: corps.erreur ?? (r.status >= 500 ? "reseau" : `http-${r.status}`) };
  } catch {
    return { ok: false, code: "reseau" };
  }
}

/** Ajoute une remarque envoyée à « Mes remarques » (la plus récente d'abord). */
export function rememberSent(list: MyRemark[], o: Outgoing, res: { id: number; numero: string }, now: number): MyRemark[] {
  const r: MyRemark = { numero: res.numero, id: res.id, type: o.type, extrait: o.texte.trim().slice(0, 120), cree: now, etat: "nouvelle" };
  if (o.piece) r.resume = o.piece.resume;
  return [r, ...list.filter((x) => x.numero !== res.numero)];
}

/** Relit l'état et la réponse de chaque remarque ; `null` si le service ne répond pas. */
export async function refreshMine(list: MyRemark[], envoyer: typeof fetch = fetch): Promise<MyRemark[] | null> {
  let joint = false;
  const next = await Promise.all(
    list.map(async (r) => {
      if (r.disparue) return r;
      try {
        const rep = await envoyer(`${API}/${encodeURIComponent(r.numero)}`);
        if (rep.status === 404) {
          joint = true;
          return { ...r, disparue: true };
        }
        if (!rep.ok) return r;
        joint = true;
        const c = (await rep.json()) as Partial<MyRemark>;
        return { ...r, etat: c.etat ?? r.etat, reponse: c.reponse ?? null, repondu: c.repondu ?? null };
      } catch {
        return r;
      }
    }),
  );
  return joint || list.length === 0 ? next : null;
}

/** Réponses pas encore vues (pastille sur « 💬 » et sur l'onglet). */
export const unseenReplies = (list: MyRemark[]): number => list.filter((r) => r.reponse && r.repondu && r.repondu !== r.vu).length;
/** L'onglet « Mes remarques » a été ouvert : les réponses affichées sont vues. */
export const markSeen = (list: MyRemark[]): MyRemark[] => list.map((r) => (r.reponse && r.repondu ? { ...r, vu: r.repondu } : r));

/** Relire au chargement du site une fois par jour au plus (le service est petit, sur un Raspberry Pi). */
export function shouldCheck(list: MyRemark[], now: number): boolean {
  if (!list.some((r) => !r.disparue)) return false;
  return now - read<number>(KEY_CHECKED, 0) > 24 * 3600_000;
}
export const markChecked = (now: number): void => write(KEY_CHECKED, now);

/** Signature d'un contenu (pour savoir si des corrections ont changé depuis leur envoi). */
export function signature(contenu: unknown): string {
  const s = JSON.stringify(contenu);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}-${h.toString(36)}`;
}
