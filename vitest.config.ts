import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure logic in src/lib (SRS scheduling, storage, merge).
 * Node environment on purpose: these modules must not depend on the DOM, so
 * the tests double as a guard that the logic stays testable outside a browser.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts", "api/**/*.test.ts"],
    reporters: ["default"],
  },
});
