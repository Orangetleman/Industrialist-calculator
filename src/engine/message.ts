// Messages du moteur (S32) : un code et des valeurs, jamais une phrase. Le site les écrit dans la langue
// choisie (catalogue src/i18n/vues/moteur.*.ts, clé « eng.<code> », fonction say() de src/ui/engine-text.ts).
// Pur, sans DOM : les messages se copient tels quels vers et depuis le Web Worker de l'usine.
//
// Valeurs d'un message :
//   - un nombre (écrit selon la langue, 2 décimales au plus) ou un texte (nom du jeu, identifiant) ;
//   - un autre message (morceau de phrase : « d'entrée », « vers le haut »…) ;
//   - { mf } : une puissance (« 1,5 MMF/s ») ; { join, by } : une liste, avec son séparateur ;
//   - { note } : un texte des données (note, doute), traduit par le dictionnaire data/i18n/en.json
//     (`lower` : écrit en minuscules) ;
//   - { lc } : un message écrit avec une minuscule au début (« Dans chaque bloc : poser… »).

import type { moteurFr } from "../i18n/vues/moteur.fr.ts";

/** Codes connus : les clés « eng.* » du catalogue français, sans le préfixe (une faute de frappe ne compile pas). */
export type MessageCode = keyof typeof moteurFr extends infer K ? (K extends `eng.${infer C}` ? C : never) : never;

export type MessageValue =
  | string
  | number
  | Message
  | { mf: number }
  | { note: Text; lower?: boolean }
  | { lc: Message }
  | { join: MessageValue[]; by: "virgule" | "flèche" | "point-virgule" | "et" }
  | undefined;
export type Message = { code: MessageCode; [k: string]: MessageValue };

/** Un message : son code et ses valeurs. */
export const msg = (code: MessageCode, values: Record<string, MessageValue> = {}): Message => ({ ...values, code });

/** Texte venu des données (note, doute, nom d'installation saisi, en français) ou message du moteur. */
export type Text = string | Message;

export const isMessage = (x: unknown): x is Message => !!x && typeof x === "object" && typeof (x as { code?: unknown }).code === "string";

/** Clé de comparaison d'un message (deux messages égaux s'écrivent pareil dans toutes les langues). */
export const messageKey = (m: Text): string => (typeof m === "string" ? m : JSON.stringify(m));
