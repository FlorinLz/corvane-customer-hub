# Customer Hub

An internal portal for Corvane: one record per customer and partner
institution, shared across Sales, Ops, Customer Success, Network,
Compliance and Finance. See `16_claude_code_brief.md` for the full
product and build spec, and `DECISIONS.md` for points where the build
diverged from the brief or the design.

## Stack

Next.js (App Router) and TypeScript, Tailwind CSS v3 with the brand
tokens as CSS variables, shadcn/ui-style components on Radix, PostgreSQL
through Prisma 7 (driver adapters — see DECISIONS.md), Vitest for unit
tests, Playwright for end-to-end tests.

## Running it locally

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Database.** Two roles, `hub_owner` (migrations, seed, Reset demo
   data) and `hub_app` (the running app — restricted grants, see
   `prisma/grants.sql`). Two options:
   - **Hosted Postgres (e.g. Neon):** create both roles on your database
     (`docker/initdb/01-roles.sql` has the SQL), then set `DATABASE_URL`
     (`hub_app`) and `DATABASE_ADMIN_URL` (`hub_owner`) in `.env`. This is
     what this project's own `.env` uses.
   - **Local Postgres via Docker:** `docker compose up -d` creates both
     roles automatically; then set `DATABASE_URL`/`DATABASE_ADMIN_URL` in
     `.env` to the values in `.env.example`.

3. **Environment variables.** Copy `.env.example` to `.env` and fill it
   in; see the table below for what each one does. `.env` is git-ignored.

4. **Migrate and seed:**

   ```bash
   npm run db:reset
   ```

   Runs `prisma migrate reset --force` (drops and recreates every table —
   `prisma/migrations/`), reapplies `prisma/grants.sql`, then loads the
   full demo dataset (brief section 7.1) via `prisma/seed/seed.ts`. Prisma
   shows an interactive safety prompt before `migrate reset` when it's run
   by an AI coding agent; that's expected the first time and is not a
   bug. "Reset demo data" in the app (Admin menu, added in milestone 4)
   calls the same seed function without the migration step.

   For a deterministic demo-day seed (matching the brief's worked
   examples) and offline GLEIF lookups:

   ```bash
   GLEIF_SEED_SOURCE=cache DEMO_CLOCK_START=2026-10-02T09:00:00+03:00 npm run db:reset
   ```

5. **Run the app:**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. Switch "Ops · Adrian Koh" in the demo
   strip's "View as" switcher to any of the 12 seeded users, grouped by
   team — e.g. "Ops · Kevin Lim" for a second Ops perspective. Each
   person keeps their own team's rights.

## Checks

```bash
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm test                 # Vitest (tests/unit); the database tests need a seeded database first
npm run test:e2e         # Playwright (tests/e2e); starts the dev server itself
npm run demo:reset-data  # The data-level reset alone (TRUNCATE + seed; no migration step)
npm run seed:check       # The seed self-check alone (brief 7.1.14/7.3.1)
npm run gleif:snapshot   # Rewrites data/gleif-cache.json from the live GLEIF API
npm run gleif:check      # Pre-demo GLEIF warnings (brief 7.2.5)
npm run test:all         # The full sequence below, in one command
```

Database tests (`tests/unit/seed/seed.test.ts`) read the already-seeded
database rather than running their own migrate+seed cycle — seed first
(either `npm run db:reset` or the lighter `npm run demo:reset-data`, see
below), ideally with `GLEIF_SEED_SOURCE=cache
DEMO_CLOCK_START=2026-10-02T09:00:00+03:00` so the date-relative
assertions line up with the brief's worked examples.

### `npm run test:all`

`scripts/test-all.sh` runs the whole check sequence in order: lint,
typecheck, a data reset under the frozen demo clock
(`DEMO_CLOCK_START=2026-10-02T09:00:00+03:00`, matching
`playwright.config.ts`'s e2e clock and the brief's worked examples), the
unit suite against that deterministic seed, the e2e suite, then a final
reset back to a real-time seed so the database is left in its normal
state for interactive browsing afterward. It uses `npm run
demo:reset-data` (the TRUNCATE + seed path, same as the app's own "Reset
demo data" admin action) for both resets, not `npm run db:reset` — the
latter calls `prisma migrate reset`, which carries its own AI-agent
consent gate (see DECISIONS.md) and would hang when run unattended, e.g.
by an AI coding agent or in CI.

`npm run test:e2e` itself runs serially (`playwright.config.ts`:
`fullyParallel: false`, `workers: 1`) because some specs call
`POST /api/demo/reset` mid-run, which is destructive to every other
spec's seed-data assumptions if it runs concurrently with them.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Runtime Postgres connection (`hub_app` role) |
| `DATABASE_ADMIN_URL` | Migrations, seed and "Reset demo data" (`hub_owner` role) |
| `DEMO_MODE` | `true` shows the demo strip, "View as" and "Reset demo data", and signs in automatically. `false` is the production-shaped mode (no auto sign-in; company SSO is phase 2) |
| `DEMO_DEFAULT_USER_EMAIL` | Session user when no `ch_user` cookie is set (`DEMO_MODE` only) |
| `DEMO_CLOCK_START` | ISO instant where `today()` (`src/lib/dates.ts`) starts counting from and runs forward in real time. Ignored in production (`NODE_ENV=production`) *unless* `DEMO_MODE=true` (milestone 8 decision, see DECISIONS.md) — this lets the production demo deployment pin the issue-flow demo day, while a hypothetical real (non-demo) production deployment always stays on the real clock |
| `DEMO_CLOCK_ANCHOR` | Optional. A real ISO instant recorded once, just before the interview. Pins the `DEMO_CLOCK_START` offset to a fixed constant shared by every serverless instance, instead of each instance's own cold-start time — see "Demo runbook" below. Ignored when `DEMO_CLOCK_START` is unset |
| `SESSION_SECRET` | HMAC key for the `ch_user` session cookie (added in milestone 2) |
| `APP_TIMEZONE` | Definition of "today" and business days (default `Europe/Bucharest`) |
| `GLEIF_BASE_URL`, `GLEIF_TIMEOUT_MS`, `GLEIF_CACHE_PATH`, `GLEIF_FORCE_CACHE`, `GLEIF_SEED_SOURCE` | GLEIF lookup client (added in milestone 2) |
| `APPROVED_DOC_HOSTS` | Comma-separated approved hosts for evidence and contract links |
| `DUPLICATE_NAME_THRESHOLD` | Trigram similarity threshold for the duplicate-name check |

## Deploying to Vercel

Moving the project to a new repository: `docs/MOVE_TO_NEW_REPO.md`. Rebuilding a hosted database from the baseline: `scripts/neon-rebuild.sql` (generated; see that doc).

The app is a standard Next.js App Router project, so it deploys to Vercel
with no extra configuration. Set the environment variables above in the
Vercel project settings (Production and Preview); point `DATABASE_URL` and
`DATABASE_ADMIN_URL` at the two roles on a reachable Postgres instance (a
hosted Postgres such as Neon works from Vercel's serverless functions
without extra networking). Run `npm run db:reset` once against that
database before first deploying (or whenever the schema changes) — it's a
local/CI step, not something Vercel's build runs automatically.
`docker-compose.yml` is for local development only and is not used by the
Vercel build.

For the interview demo deployment specifically, also set
`DEMO_CLOCK_START=2026-10-05T08:05:00Z` on **Production only** (not
Preview, so future PR previews keep showing live dates) — see "Demo
runbook" below for why and how this interacts with "Reset demo data".

## Project status

Building in two releases (brief 1.7). Currently in Release 1 (milestones
1-8, brief 7.4.1). Done so far:

- **Milestone 1**: scaffold, brand tokens, app shell.
- **Milestone 2**: full Prisma schema and migrations, the full seed
  dataset (brief 7.1), the GLEIF client with cache fallback, demo mode
  ("View as", Reset demo data).
- **Milestone 3**: read paths — search, the entity record's eight tabs,
  the group record.
- **Milestone 4**: permissions and audit (the `can()`/`mutate()` policy
  module every write goes through), Admin menu (deleted records, roles &
  permissions, reset demo data), soft delete and reactivation.
- **Milestone 5**: edits per tab — Details, Products & onboarding,
  Contacts, Partner, Compliance, History, and owner reassignment.
- **Milestone 6**: new customer wizard (GLEIF lookup, duplicates,
  submit), plus the rename to international demo names.
- **Milestone 6A-6C**: the issue flow — model, routing and clocks;
  reporting, the Issue page and communication; partner fan-out,
  Compliance assessment, and the Home "Issues" worklist section.
- **Milestone 7**: handoffs (Sales → Ops confirm pickup, Ops → CS send
  and accept) and the R1 worklist engine (Ops, CS, Compliance and Sales
  sections) on Home, below the Issues section.
- **Milestone 8**: polish and demo readiness — states/empty/loading/
  error/read-only audit, 1024px layouts, copy review, the demo clock in
  production, and this README's demo runbook below.

See `DECISIONS.md` for what each milestone added and where the build
diverged from the brief or the design.

## Demo runbook

Reference: brief 7.2.5 "Pre-demo checklist" (full detail, run it in
full the day before and again 1 hour before the session) and 7.3.2's
E2E-5 worked example — `tests/e2e/scenario5-issue-flow-short.spec.ts`
is the actual, currently-passing implementation of the issue-flow walk
below, so if anything here and that file ever disagree, trust the test.

### Two different clocks, two different reset paths

- **Local interactive dev** (`npm run dev` against your own `.env`):
  do **not** set `DEMO_CLOCK_START` there — `npm run demo:reset-data`
  then seeds from the real wall clock, so browsing locally shows real,
  current dates.
- **The live demo deployment** (Vercel, `DEMO_MODE=true` and
  `DEMO_CLOCK_START=2026-10-05T08:05:00Z` set directly in the Vercel
  project's Production environment variables): resetting there — either
  `npm run demo:reset-data` run against that same database, or the
  Admin menu's "Reset demo data" button on the live URL itself — always
  seeds from the pinned demo day, Monday 05 Oct 2026, 10:05 CEST,
  regardless of the real calendar date on the day of the interview
  (`src/lib/dates.ts`: `DEMO_CLOCK_START` is honoured in production
  when `DEMO_MODE=true`). Both reset paths call the same `seed()`
  function, so they can never drift apart.
- **Cross-instance drift**: `DEMO_CLOCK_START` alone anchors each
  serverless instance's offset to *that instance's own* cold-start
  time, so two instances starting minutes apart (or a cold start mid-
  demo) can briefly show different "now" values. `DEMO_CLOCK_ANCHOR`
  (optional) pins the offset to one fixed, shared timestamp instead —
  set it right before the interview, see the next section.

### Before the interview

1. On Vercel, set `DEMO_CLOCK_ANCHOR` on **Production** (not Preview)
   to the current real time, a few minutes before you plan to start,
   then redeploy and wait for the deployment to show **Ready**. Every
   instance needs to pick up the same anchor value, so don't skip the
   wait.
2. Run the brief's own pre-demo checklist (7.2.5) in full: `npm run
   gleif:check`, `npm run gleif:snapshot` if GLEIF is reachable, the
   Corvane-exclusion check, Reset demo data on the live URL (Admin menu —
   this is what actually makes the app show Monday 05 Oct 2026, 10:05
   CEST), walk the Home oracle (7.1.15), the two search counts, the
   paste-ready snippets file, "Reset filters" on Lloyds/MPS History,
   browser zoom 100%/≥1280px.
3. Open the live URL: `<the live Vercel URL>` (fill in once deployed —
   see "Deploying to Vercel" above).
4. Confirm the demo clock: as any user, the page header's subtitle date
   and the Issue page's clocks should read as if "now" is a few minutes
   after 10:05 CEST on Monday 05 Oct 2026, not today's real date.

### Issue-flow walkthrough (scenario 5) — which "View as" user per step

All steps assume a fresh "Reset demo data" first. Switch users with the
demo strip's "View as" selector; each switch reloads on Home, "Mine"
scope.

| Step | View as | What to show |
|---|---|---|
| 1 | Customer Success · Emma Wilson | Home "Issues (2)": ISS-1042 and ISS-1031, both "Communicator", no step (she's past the hand-over). Open ISS-1042: the hand-over log entry, Clocks panel. |
| 2 | (stay as Emma) | Revolut Ltd → Issues tab → "Report issue": Wrong match result, product line auto-locks scheme/country, similar issues shown, proposed Sev-3. Save → ISS-1043. |
| 3 (optional) | (stay as Emma) | A second "Report issue" on Revolut Ltd showing the before-go-live cap and the breach override, then Cancel — a permission/validation regression check, not required for the narrative. |
| 4 | (API only, as Emma) | `POST /api/issues/.../acknowledge` on ISS-1043 returns 403 `not_issue_owner` — she's not its Ops owner. Narrate as "the server enforces this even if the button were somehow clickable." |
| 5 | Network · Lukas Brenner | Lloyds Bank plc → "Report issue": Partner degraded or unavailable → ISS-1044, Sev-1. Show the Degraded-coverage proposal banner → "Set to Degraded" → the prefilled M5 dialog → Acknowledge. |
| 6 | (stay as Lukas) | "Affected customers" panel → "Create linked issues": fans out to Revolut Ltd, Santander UK plc, Lloyds Bank plc as customer (ISS-1045-1047); "Not affected: before go-live" holds Zopa Bank Limited. |
| 7 | (stay as Lukas) | On ISS-1044: "Open in Gmail" (prefilled subject/body), then "Record notification". |
| 8 | Ops · Adrian Koh | Home "Issues": ISS-1045/1047 need "Notify customer". Open ISS-1047 (Lloyds as both partner and customer): the dual-role banner, "Record notification". |
| 9 | Compliance · Mei Chen | Home "Issues": ISS-1045/1046/1047 need "Assess for Compliance". Open ISS-1045, "Record assessment" → "Possible major incident". |
| 10 | Network · Lukas Brenner | On ISS-1044, "Change status" → Resolved, with root cause and solution → the cascade confirm ("Resolve ISS-1044 and 3 linked issues?") → all four resolve together. |
| 11 | Ops · Adrian Koh | Home: ISS-1047 needs "Close with the customer"; ISS-1045 still needs "Notify customer". Close ISS-1047. |
| 12 | (API only) | Three forged writes (wrong-role status change, compliance assessment, close) each return 403 and write nothing — a permission regression check. |
| 13 (optional) | Finance · Rachel Wong | Open ISS-1031, "Change severity": Sev-1 disabled by the Billing type cap, Sev-2 allowed with a reason — the notification clock recalculates. |

### If a step fails

- **A click doesn't do anything / a toast says "Try again"**: reload the
  page once and retry the same action — most of this app's writes are
  idempotent-safe to retry (version-checked), so a stale page is the
  most likely cause, not data corruption.
- **Something looks structurally wrong (wrong owner, missing section,
  stale counts)**: run "Reset demo data" from the Admin menu and restart
  the walkthrough from scenario 1 — every scenario is designed to run
  from a clean reset in any order, so this always recovers cleanly.
- **A GLEIF-dependent screen (the wizard's LEI lookup, "Refresh from
  GLEIF") looks wrong or is slow**: the seed's own LEIs already have a
  cache fallback for exactly this case (`data/gleif-cache.json`), so a
  live GLEIF outage during the room's network shouldn't block anything
  demo-critical — if a non-seeded LEI is needed live and GLEIF is
  unreachable, fall back to narrating "GLEIF unavailable" manual entry
  instead of waiting on it.
- **A contract or evidence link doesn't open** (room network risk, brief
  7.2.5 item 8): skip the click and narrate what it would show instead.
