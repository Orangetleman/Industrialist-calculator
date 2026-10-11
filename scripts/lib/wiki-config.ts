// Configuration commune aux scripts de récupération et de construction des données.

export type WikiId = "miraheze" | "fandom";

export const WIKIS: Record<WikiId, { api: string; pageUrl: (title: string) => string }> = {
  miraheze: {
    api: "https://industrialist.miraheze.org/w/api.php",
    pageUrl: (t) => `https://industrialist.miraheze.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":")}`,
  },
  fandom: {
    api: "https://industrialist.fandom.com/api.php",
    pageUrl: (t) => `https://industrialist.fandom.com/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":")}`,
  },
};

/** Page telle qu'enregistrée dans .cache/wiki/<wiki>/. */
export type CachedPage = {
  wiki: WikiId;
  requestedTitle: string;
  title: string;
  pageid: number;
  revid: number;
  timestamp: string;
  fetchedAt: string;
  url: string;
  content: string;
};

/** Nom de fichier sûr (Windows compris) pour un titre de page. */
export function cacheFileName(title: string): string {
  return (
    title
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .replace(/\s+/g, "_") + ".json"
  );
}
