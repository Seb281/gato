import { defineConfig } from "vitest/config";

/**
 * Vitest config for the web app's unit tests.
 *
 * Scope is intentionally narrow: pure TypeScript utilities under `src/**`.
 * UI behavior is covered by Playwright E2E (`tests/e2e/**`) — those specs use
 * the Playwright runner, so they're excluded here to keep the two suites from
 * stepping on each other.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
