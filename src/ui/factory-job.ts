// Lancement du calcul de « Toute l'usine » en arrière-plan (Web Worker de Vite, sans dépendance), avec
// avancement et annulation. Un calcul à la fois : en lancer un autre annule le précédent.

import type { FactoryInput, FactoryPlan } from "../engine/build/factory.ts";

export type FactoryMessage = { kind: "progress"; done: number; label: string } | { kind: "done"; plan: FactoryPlan; ms: number } | { kind: "error"; message: string };

export type FactoryJob = { cancel: () => void };

export function runFactory(input: FactoryInput, on: { progress: (done: number, label: string) => void; done: (plan: FactoryPlan, ms: number) => void; error: (message: string) => void }): FactoryJob {
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
    on.error(e.message || "le calcul s'est arrêté");
  };
  worker.postMessage({ input });
  return { cancel: stop };
}
