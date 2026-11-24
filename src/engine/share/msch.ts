// Anciens codes et fichiers .msch du bac à sable (PLAN-PARTAGE.md § 4) : lus à vie, en lecture seule, et
// convertis en design (bac à sable seul, réglages par défaut). Plus aucun .msch ne s'écrit à l'écran.

import { fromCode, readMsch, type Schematic } from "../schematic/msch.ts";
import { SETTINGS_V1, ShareError, type Design, type DesignSettings } from "./codec.ts";

/** Réglages par défaut de la v1 du format (copie neuve à chaque appel). */
export const defaultSettingsV1 = (): DesignSettings => Object.fromEntries(SETTINGS_V1.map(([k, v]) => [k, structuredClone(v)]));

const toDesign = (s: Schematic): Design => ({ site: "", ...(s.name ? { name: s.name } : {}), settings: defaultSettingsV1(), sandbox: s.layout });

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
