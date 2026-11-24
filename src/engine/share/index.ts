// Partage d'un design par lien et par fichier `.indus` (PLAN-PARTAGE.md, lot P1). Pur, sans DOM.
export { ENGINE_VERSION, decodeDesign, decodeDesignBytes, designBody, designLink, encodeDesign, encodeDesignBytes, same, SETTINGS_V1, SHARE_VERSION, ShareError, SITE_VERSION, type Design, type DesignGraph, type DesignProfile, type DesignSettings, type ShareErrorCode } from "./codec.ts";
export { comparePrints, designPrint, hasPose, type PrintVerdict } from "./print.ts";
export { defaultSettingsV1, designFromFile, designFromMschCode, designFromMschFile, designFromSchematic, isIndus, schematicOf } from "./msch.ts";
