// Lancement du calcul de « Toute l'usine » en arrière-plan (Web Worker de Vite, sans dépendance), avec
// avancement et annulation. Un calcul à la fois : en lancer un autre annule le précédent.

import type { FactoryInput, FactoryPlan } from "../engine/build/factory.ts";
import { t } from "../i18n/i18n.ts";
import type { Message } from "../engine/message.ts";

export type FactoryMessage = { kind: "progress"; done: number; label: Message } | { kind: "done"; plan: FactoryPlan; ms: number } | { kind: "error"; message: string };

export type FactoryJob = { cancel: () => void };

export function runFactory(input: FactoryInput, on: { progress: (done: number, label: Message) => void; done: (plan: FactoryPlan, ms: number) => void; error: (message: string) => void }): FactoryJob {
  const worker = new Worker(new URL("./factory.worker.ts", import.meta.url), { type: "module" });
  let over = false;
  const stop = () => {
    over = true;
    worker.terminate();
  };
  worker.onmessage = (e: MessageEvent<FactoryMessage>) => {
    if (over) return;
    const m = e.data;
    if (m.kind === "progress") on.progress(m.done, m.label);
    else {
      stop();
      if (m.kind === "done") on.done(m.plan, m.ms);
      else on.error(m.message);
    }
  };
  worker.onerror = (e) => {
    if (over) return;
    stop();
    on.error(e.message || t("job.stopped"));
  };
  worker.postMessage({ input });
  return { cancel: stop };
}

// ---------------------------------------------------------------- résultats gardés (S27 bis)
// Un gros calcul peut prendre des minutes : son résultat est gardé dans ce navigateur (IndexedDB, qui sait garder
// les Map et Set du plan tels quels), sous la clé du calcul et l'empreinte du code et des données (vite.config.ts).
// Les 12 derniers seulement. Sans IndexedDB (navigation privée…), rien n'est gardé et le calcul se refait.

declare const __FACTORY_VERSION__: string;
const VERSION = typeof __FACTORY_VERSION__ === "string" ? __FACTORY_VERSION__ : "dev";
const DB_NAME = "ind-calc-usine";
const STORE = "plans";
const KEEP = 12;
type Saved = { key: string; plan: FactoryPlan; ms: number; at: number };

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Le résultat gardé pour cette clé de calcul, s'il existe et vient du même code et des mêmes données. */
export async function loadFactory(key: string): Promise<{ plan: FactoryPlan; ms: number } | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(`${VERSION}|${key}`);
      req.onsuccess = () => {
        const s = req.result as Saved | undefined;
        resolve(s ? { plan: s.plan, ms: s.ms } : null);
        db.close();
      };
      req.onerror = () => {
        resolve(null);
        db.close();
      };
    } catch {
      resolve(null);
      db.close();
    }
  });
}

/** Garde un résultat (et retire les plus anciens au-delà de 12, ou ceux d'une autre version du calcul). */
export async function saveFactory(key: string, plan: FactoryPlan, ms: number): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put({ key: `${VERSION}|${key}`, plan, ms, at: Date.now() } satisfies Saved);
    const all = store.getAll();
    all.onsuccess = () => {
      const list = (all.result as Saved[]).sort((a, b) => b.at - a.at);
      list.forEach((s, i) => {
        if (i >= KEEP || !s.key.startsWith(`${VERSION}|`)) store.delete(s.key);
      });
    };
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {
    db.close();
  }
}
