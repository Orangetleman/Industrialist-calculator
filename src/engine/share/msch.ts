// Anciens codes et fichiers .msch du bac à sable (PLAN-PARTAGE.md § 4) : lus à vie, en lecture seule, et
// convertis en design (bac à sable seul, réglages par défaut). Plus aucun .msch ne s'écrit à l'écran.

import { fromCode, readMsch, type Schematic } from "../schematic/msch.ts";
import { decodeDesignBytes, SETTINGS_V1, SHARE_VERSION, ShareError, SITE_VERSION, type Design, type DesignSettings } from "./codec.ts";

/** Réglages par défaut de la v1 du format (copie neuve à chaque appel). */
export const defaultSettingsV1 = (): DesignSettings => Object.fromEntries(SETTINGS_V1.map(([k, v]) => [k, structuredClone(v)]));

const toDesign = (s: Schematic): Design => ({ site: "", ...(s.name ? { name: s.name } : {}), settings: defaultSettingsV1(), sandbox: s.layout });

/** Schéma du bac à sable → design (bac à sable seul), et retour ; la description et les étiquettes vont dans `settings.schema`. */
export function designFromSchematic(s: Schematic): Design {
  const schema = s.description || s.labels.length ? { schema: { desc: s.description, tags: s.labels } } : {};
  return { site: SITE_VERSION, ...(s.name ? { name: s.name } : {}), settings: { ...defaultSettingsV1(), ...schema }, sandbox: s.layout };
}
export function schematicOf(d: Design): Schematic | null {
  if (!d.sandbox) return null;
  const x = d.settings.schema as { desc?: unknown; tags?: unknown } | undefined;
  const tags = Array.isArray(x?.tags) ? x.tags.filter((v): v is string => typeof v === "string") : [];
  return { name: d.name ?? "", description: typeof x?.desc === "string" ? x.desc : "", labels: tags, width: 0, height: 0, layout: d.sandbox };
}
/** Fichier choisi par le joueur : `.indus`, ou un ancien fichier du bac à sable. */
export const designFromFile = (bytes: Uint8Array): Promise<Design> => (bytes[0] === 0x6d ? designFromMschFile(bytes) : decodeDesignBytes(bytes));
/** Le fichier est-il un `.indus` (son premier octet est la version du format) ? */
export const isIndus = (bytes: Uint8Array): boolean => bytes.length > 0 && bytes[0]! <= SHARE_VERSION;

/** Code texte .msch (base64) → design. Version du site inconnue : `site` vide. */
export async function designFromMschCode(code: string): Promise<Design> {
  try {
    return toDesign(await fromCode(code));
  } catch {
    throw new ShareError("abîmé", "msch");
  }
}

/** Fichier .msch → design. */
export async function designFromMschFile(bytes: Uint8Array): Promise<Design> {
  try {
    return toDesign(await readMsch(bytes));
  } catch {
    throw new ShareError("abîmé", "msch");
  }
}
