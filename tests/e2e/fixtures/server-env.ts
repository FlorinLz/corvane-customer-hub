/**
 * The environment of each e2e web server, by port. playwright.config.ts starts the servers with it; fixtures/reset.ts runs the data-level
 * reset with the same values, so the seed is dated from the same demo clock the server reads.
 */

// One anchor for the whole run: the config is loaded in the main process and again in every worker, and they must agree. Workers inherit it.
process.env.CH_E2E_CLOCK_ANCHOR ??= new Date().toISOString();
export const E2E_CLOCK_ANCHOR = process.env.CH_E2E_CLOCK_ANCHOR;

const BASE = {
  DEMO_MODE: "true",
  GLEIF_FORCE_CACHE: "true",
  GLEIF_SEED_SOURCE: "cache",
  GLEIF_CACHE_PATH: "tests/e2e/fixtures/gleif-cache.json",
};

export const DEMO_CLOCK_SKEW_START = "2026-10-07T05:00:00.000Z";

export const SERVER_ENV: Record<"main" | "issues" | "zones" | "skew" | "roles" | "sandbox", Record<string, string>> = {
  // Brief 7.3.2 "Setup shared by the 4 tests": a frozen, cache-only GLEIF clock so the scenario specs' literal date/field assertions are deterministic.
  main: { ...BASE, DEMO_CLOCK_START: "2026-10-02T09:00:00+03:00" },
  // Brief 7.3.2 E2E-5 setup: Monday 05 Oct 2026, 10:05 CEST.
  issues: { ...BASE, DEMO_CLOCK_START: "2026-10-05T08:05:00Z" },
  zones: { ...BASE, DEMO_CLOCK_START: "2026-10-06T13:14:00+02:00" },
  skew: { ...BASE, DEMO_CLOCK_START: DEMO_CLOCK_SKEW_START, DEMO_CLOCK_ANCHOR: E2E_CLOCK_ANCHOR },
  roles: { ...BASE, DEMO_CLOCK_START: "2026-10-05T08:48:00Z", DEMO_CLOCK_ANCHOR: E2E_CLOCK_ANCHOR },
  // Sandbox per visitor: the default demo clock, Mon 05 Oct 2026 10:05 CEST, which is the day the generated snapshot is valid for. The snapshot only
  // restores with the default GLEIF cache path, so this server does not use the e2e fixture cache.
  sandbox: {
    DEMO_MODE: "true",
    GLEIF_FORCE_CACHE: "true",
    GLEIF_SEED_SOURCE: "cache",
    DEMO_CLOCK_START: "2026-10-05T10:05:00+02:00",
    DEMO_SANDBOXES: "true",
    DEMO_SANDBOX_SPARES: "1",
    DEMO_SANDBOX_MAX: "40",
    DEMO_SANDBOX_TEST_HOOKS: "true",
    CRON_SECRET: "e2e-cron-secret-e2e-cron-secret",
  },
};

export const SERVER_ENV_BY_PORT: Record<string, Record<string, string>> = {
  "3000": SERVER_ENV.main,
  "3101": SERVER_ENV.issues,
  "3102": SERVER_ENV.zones,
  "3103": SERVER_ENV.skew,
  "3104": SERVER_ENV.roles,
  "3105": SERVER_ENV.sandbox,
};
