import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.spec.ts"],
    testTimeout: 60000, // E2E tests involving temporal can take some time
  },
});
