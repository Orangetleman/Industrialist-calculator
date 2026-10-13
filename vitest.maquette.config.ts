import { defineConfig } from "vitest/config";

// Générateurs de maquettes (npm run maquette) : hors des tests habituels.
export default defineConfig({
  test: {
    include: ["maquette/**/*.gen.test.ts"],
    testTimeout: 900_000,
  },
});
