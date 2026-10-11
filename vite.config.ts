import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // Les données du wiki (data/*.json) sont intégrées à la page : ~550 kB, 78 kB compressés.
    // Pour un outil local, c'est attendu : on relève le seuil d'avertissement.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
