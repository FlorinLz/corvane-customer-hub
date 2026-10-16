import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    // Several test files share one live Postgres database and assert
    // global invariants against it (seed.test.ts's "exactly 3 issues",
    // "only ISS-1042 is flagged", etc.) while other files create and
    // delete their own throwaway rows against that same database
    // (issues.test.ts). Running test files in parallel workers races
    // those checks against each other's in-flight fixtures; serialize
    // files so each one's setup/assertions/cleanup complete before the
    // next starts. See DECISIONS.md, milestone 6B.
    fileParallelism: false,
    // Worklist and issue-page loads run the deadline engine over every issue: a few seconds on a loaded machine.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@seed": fileURLToPath(new URL("./prisma/seed", import.meta.url)),
    },
  },
});
