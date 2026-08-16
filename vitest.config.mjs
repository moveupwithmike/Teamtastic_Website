import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    clearMocks: true,
    // Informational only (`npm run test:coverage`) — no thresholds, and not
    // part of `npm run check`. See Phase 3/5 of the code review: coverage
    // should report against the risk-ranked gap list, not gate merges on a
    // percentage before the highest-value gaps are actually closed.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      // Scoped to server-side logic (routes, lib/server, office actions) —
      // the surface Phase 3 of the code review actually assessed. UI
      // components/pages are plain .js files containing JSX, which the
      // coverage remapper can't parse without a .jsx extension; excluding
      // them also matches Phase 3's stated priority (server-side logic
      // protects money/security/deliverability, UI tests don't).
      include: ["src/lib/**/*.js", "src/app/api/**/*.js"],
      exclude: ["src/**/*.test.{js,jsx}", "src/test/**"],
    },
  },
});
