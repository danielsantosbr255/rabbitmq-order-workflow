import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.integration.spec.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
