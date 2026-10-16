// Web Worker de « Toute l'usine » : le calcul (plusieurs secondes) tourne ici, la page reste utilisable.
// Reçoit une entrée de designFactory, renvoie l'avancement puis le plan. L'annulation arrête le worker.

import { designFactory, type FactoryInput } from "../engine/build/factory.ts";
import type { FactoryMessage } from "./factory-job.ts";

const scope = self as unknown as { onmessage: ((e: MessageEvent<{ input: FactoryInput }>) => void) | null; postMessage: (m: FactoryMessage) => void };

scope.onmessage = (e) => {
  let last = 0;
  try {
    const t0 = performance.now();
    const plan = designFactory(e.data.input, (done, label) => {
      const now = performance.now();
      // Pas plus de 10 messages par seconde.
      if (done > 0 && done < 1 && now - last < 100) return;
      last = now;
      scope.postMessage({ kind: "progress", done, label });
    });
    scope.postMessage({ kind: "done", plan, ms: performance.now() - t0 });
  } catch (err) {
    scope.postMessage({ kind: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
