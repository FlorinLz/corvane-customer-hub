import { defineConfig, devices } from "@playwright/test";

import { STORAGE_KEYS } from "./src/lib/onboarding/content";
import { SERVER_ENV } from "./tests/e2e/fixtures/server-env";

// The welcome card and the mobile notice show on a visitor's first load. Every project starts with both already dismissed, so they never sit
// over a button another spec clicks; onboarding.spec.ts starts from an empty storage (test.use) to see them.
const dismissed = (port: number) => ({
  cookies: [],
  origins: [
    {
      origin: `http://localhost:${port}`,
      localStorage: [
        { name: STORAGE_KEYS.welcomeDismissed, value: "1" },
        { name: STORAGE_KEYS.mobileDismissed, value: "1" },
      ],
    },
  ],
});

// demo-clock-writes bug fix: a deliberate gap between the demo clock and the
// real calendar date. Any business timestamp still written from the database's
// own real clock instead of the app's own now() would land at least this far
// from the demo clock, exactly the symptom the bug report described ("-2 days").
//
// DEMO_CLOCK_SKEW_START is a fixed weekday anchor: Wednesday 07 Oct 2026,
// 05:00 UTC = 13:00 Asia/Singapore. A partner issue's owner routing depends on
// whether the report lands inside Network's own business hours (09:00-18:00
// Asia/Singapore, Monday to Friday, no holiday calendar, B17), so an anchor
// computed from the real date ("now - 48h") routed to the on-call person
// whenever it fell on a weekend or outside those hours. A fixed anchor passes on
// any date; the gap to real time only grows, which still separates a real-clock
// write from a demo-clock write (demo-clock-skew.spec.ts's lower bound is 36h).
// Without DEMO_CLOCK_ANCHOR, src/lib/dates.ts computes clockOffsetMs from
// Date.now() at module-load time -- fine for the long-running server
// process (one offset for its whole lifetime), but every full page
// navigation re-evaluates the client bundle fresh, each time pinning its
// own "now" back to very nearly DEMO_CLOCK_START, while the server's own
// now() keeps advancing from ITS OWN (earlier) startup moment. A multi-step
// spec (or a demo session open for a while) can see the two drift apart by
// however many real seconds have passed since the server started, exactly
// the gap that once made a genuinely later server write ("Resolved at")
// look like it was after a freshly-loaded client page's own "now". Pinning
// both to the same anchor removes the drift entirely.

export default defineConfig({
  testDir: "./tests/e2e",
  // `scenario*-short.spec.ts` files reset the demo data (fixtures/reset.ts), which
  // truncates and reseeds every table (brief 3.8.2) — a destructive,
  // whole-database action no other spec's assumptions survive if it runs
  // concurrently. forged-writes.spec.ts and access-pages.spec.ts both
  // assume stable seed data (entities found by name, "an entity with
  // groupId not null", forged cookies for specific seeded user ids)
  // across their whole run, so every spec file must run one at a time,
  // not just the tests within one file. Brief 7.3.2's "workers: 1, tests
  // run serially" setup note applies at this project level, not only to
  // the scenario file that mentions it.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: dismissed(3000) }, testIgnore: [/onboarding(-screenshots)?\.spec\.ts$/, /(scenario5-issue-flow-short|seed-worklists-screenshots)\.spec\.ts$/, /(demo-clock-zones|visitor-clock)\.spec\.ts$/, /demo-clock-skew\.spec\.ts$/, /(role-actions(-screenshots)?|action-plan-order-screenshots|assess-after-resolve|root-cause-report(-screenshots)?|issue-v5-screenshots|issue-times(-screenshots)?|issue-sections(-screenshots)?|report-from-home(-screenshots)?|ux-polish(-screenshots)?|small-fixes-v7)\.spec\.ts$/] },
    // Brief 7.3.2 E2E-5 setup: its own project and webServer, since it
    // needs a different DEMO_CLOCK_START (Monday 05 Oct, the E2E-5
    // reference day) from every other spec's Friday 02 Oct clock. A
    // second dev server on its own port keeps the two clocks from ever
    // colliding on one running process.
    // timezoneId: the spec's own plain date/time inputs (e.g. "Corvane aware
    // at") are typed as literal wall-clock values and parsed in the
    // browser's local zone; pinned to a CEST zone so a typed "10:00"
    // means 10:00 CEST, matching every time the brief's own E2E-5 text
    // gives in CEST.
    // expect.timeout: several of this spec's own writes (creating 3 linked
    // issues in one transaction, recording a Compliance assessment) do
    // several sequential DB round trips each -- routing, the Compliance
    // assessor lookup, a contributor lookup-and-create, the issue row,
    // per-field audit entries, two addHistory() calls -- and intermittently
    // took longer than the global 5s default to resolve against this dev
    // server, leaving the submit button genuinely still pending (not
    // stuck or wrong) when the assertion's own timeout ran out.
    { name: "issues", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3101", timezoneId: "Europe/Berlin", storageState: dismissed(3101) }, testMatch: /(scenario5-issue-flow-short|seed-worklists-screenshots)\.spec\.ts$/, expect: { timeout: 30_000 } }, // a dev server compiles each route on its first hit: on a loaded machine a first write can outlast 15 s
    // Milestone 8 live fix: the one spec here deliberately runs against a
    // *production* build (`next build && next start`, not `next dev`) with
    // the browser's own system zone pinned to Europe/Bucharest -- the
    // user's own reported browser zone, and *not* the viewer's configured
    // zone (CEST) -- so a regression to parsing a date/time field in the
    // browser's zone instead of the viewer's own would fail this project
    // even though every other project's `timezoneId: "Europe/Berlin"`
    // workaround (see its own comment above) would hide it by accident.
    { name: "demo-clock-zones", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3102", timezoneId: "Europe/Bucharest", storageState: dismissed(3102) }, testMatch: /(demo-clock-zones|visitor-clock)\.spec\.ts$/ },
    // demo-clock-writes bug fix: another dedicated production build (same
    // reasoning as demo-clock-zones above -- this bug is in server-side
    // write code, not client bundle inlining, but the user's own test
    // instructions asked for a production build specifically, matching
    // how the real deployment actually runs), with its own clock a fixed weekday
    // anchor days behind "now" rather than demo-clock-zones' own fixed value.
    { name: "demo-clock-skew", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3103", timezoneId: "Europe/Berlin", storageState: dismissed(3103) }, testMatch: /demo-clock-skew\.spec\.ts$/ },
    // Role actions PR: a production build too, clocked to the demo time (Mon 05 Oct 2026,
    // 10:48 CEST). The browser's own zone is pinned to Europe/Bucharest, which is none of the viewers'
    // zones (MYT, SGT), so a time formatted in the browser's zone instead of the viewer's would fail.
    { name: "role-actions", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3104", timezoneId: "Europe/Bucharest", storageState: dismissed(3104) }, testMatch: /(onboarding(-screenshots)?|role-actions(-screenshots)?|action-plan-order-screenshots|assess-after-resolve|root-cause-report(-screenshots)?|issue-v5-screenshots|issue-times(-screenshots)?|issue-sections(-screenshots)?|report-from-home(-screenshots)?|ux-polish(-screenshots)?|small-fixes-v7)\.spec\.ts$/, expect: { timeout: 15_000 } },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Brief 7.3.2 "Setup shared by the 4 tests": a frozen, cache-only
      // GLEIF clock so the scenario specs' literal date/field assertions
      // are deterministic. Harmless to the other e2e specs (forged-writes,
      // access-pages), which don't make clock- or GLEIF-sensitive assertions.
      env: SERVER_ENV.main,
    },
    {
      command: "npm run dev:e2e-issues",
      url: "http://localhost:3101",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: SERVER_ENV.issues,
    },
    // Milestone 8 live fix (demo-clock-zones.spec.ts): a real production
    // build (`next build`, not `next dev`), so NODE_ENV=production and the
    // next.config.ts `env` inlining this fix also depends on are both
    // exercised exactly as the live deployment runs them, not approximated
    // by the dev server. `build:e2e-zones`/`start:e2e-zones` give it its
    // own NEXT_DIST_DIR, the same reason dev:e2e-issues has one: a second
    // `next build` must not corrupt the main dev server's own `.next`.
    {
      command: "npm run build:e2e-zones && npm run start:e2e-zones",
      url: "http://localhost:3102",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: SERVER_ENV.zones,
    },
    // demo-clock-writes bug fix: its own production build and port, same
    // reasoning as the demo-clock-zones webServer above.
    {
      command: "npm run build:e2e-skew && npm run start:e2e-skew",
      url: "http://localhost:3103",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: SERVER_ENV.skew,
    },
    // Role actions PR: its own production build and port, same reasoning as the two above.
    {
      command: "npm run build:e2e-roles && npm run start:e2e-roles",
      url: "http://localhost:3104",
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: SERVER_ENV.roles,
    },
  ],
});
