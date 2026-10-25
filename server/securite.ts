/**
 * Service des remarques (S34) : mot de passe du tableau de bord et empreinte des visiteurs.
 *
 * - Le mot de passe est gardé haché par scrypt (`scrypt$N$r$p$sel$hache`, en base64url), jamais en clair.
 *   N = 2^14 : environ 16 Mo le temps d'une connexion, compatible avec la limite de 64 Mo du service.
 * - Le visiteur est reconnu par une empreinte HMAC-SHA256 salée de son adresse IP, jamais par l'adresse.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const LONGUEUR = 32;

export function hacherMotDePasse(motDePasse: string): string {
  const sel = randomBytes(16);
  const hache = scryptSync(motDePasse, sel, LONGUEUR, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sel.toString("base64url")}$${hache.toString("base64url")}`;
}

export function verifierMotDePasse(motDePasse: string, ligne: string): boolean {
  const morceaux = ligne.trim().split("$");
  if (morceaux.length !== 6 || morceaux[0] !== "scrypt") return false;
  const [n, r, p] = morceaux.slice(1, 4).map(Number);
  if (!n || !r || !p) return false;
  const sel = Buffer.from(morceaux[4]!, "base64url");
  const attendu = Buffer.from(morceaux[5]!, "base64url");
  if (attendu.length === 0) return false;
  const hache = scryptSync(motDePasse, sel, attendu.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(hache, attendu);
}

/** Empreinte d'une adresse : courte, salée, impossible à remonter sans le sel. */
export function empreinte(adresse: string, sel: string): string {
  return createHmac("sha256", sel).update(adresse).digest("base64url").slice(0, 22);
}

/** Jeton aléatoire (numéro secret d'une remarque, session du tableau de bord). */
export function jeton(octets: number): string {
  return randomBytes(octets).toString("base64url");
}
