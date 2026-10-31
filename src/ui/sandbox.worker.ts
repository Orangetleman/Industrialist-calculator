// Web Worker du bac à sable (B4) : quand le calcul d'un geste dépasse le seuil mesuré par l'écran, il tourne ici
// et la page reste fluide. Le worker garde son propre cache par îlots ; le catalogue n'est envoyé que s'il change.

import { computeSandbox, sandboxCache, type Layout, type SandboxResult, type SandboxSettings, type SbCatalog } from "../engine/sandbox/index.ts";

export type SandboxAsk = { id: number; cat?: SbCatalog; layout: Layout; settings: SandboxSettings };
export type SandboxAnswer = { id: number; result: SandboxResult; ms: number } | { id: number; error: string };

const scope = self as unknown as { onmessage: ((e: MessageEvent<SandboxAsk>) => void) | null; postMessage: (m: SandboxAnswer) => void };
let cat: SbCatalog | null = null;
const cache = sandboxCache();

scope.onmessage = (e) => {
  const { id, layout, settings } = e.data;
  try {
    if (e.data.cat) cat = e.data.cat;
    const t0 = performance.now();
    const result = computeSandbox(cat!, layout, settings, cache);
    scope.postMessage({ id, result, ms: performance.now() - t0 });
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
