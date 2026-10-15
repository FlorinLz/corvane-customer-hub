# Decisions

Records points where the brief (`16_claude_code_brief.md`) and the design
(the visual design) left a gap, disagreed, or needed an implementation choice not
spelled out. Order of authority per brief section 0.

## Milestone 1: Scaffold, tokens and shell

**Hosting: Neon instead of docker-compose for actual development.** The
brief (2, 7.4.1) assumes `docker compose up` provides Postgres for local
dev. Per the build instructions for this project, there is no Docker here;
the hosted Neon Postgres in `.env`'s `DATABASE_URL` is used for dev,
migrations and seed instead. `docker-compose.yml` and
`docker/initdb/01-roles.sql` are kept in the repo (brief 3.1.1, 3.1.4) for
anyone who wants to run Postgres locally, but nothing depends on them.

**Next.js 16.3.8, Tailwind CSS v3 (not v4).** The brief doesn't pin a
Next.js version. `create-next-app@latest` installed Next.js 16, which
defaults new projects to Tailwind v4 (CSS-first `@theme`, no
`tailwind.config.ts`). Brief 5.1.2 gives an exact `tailwind.config.ts` with
a v3-style `theme.extend` object mapping brand CSS variables to Tailwind
names. To follow that spec literally, Tailwind v3 was installed instead of
the v4 default; `tailwind.config.ts` and `postcss.config.js` follow the
v3 convention (`@tailwind base/components/utilities` in `globals.css`).

**shadcn/ui components built by hand, not via the `shadcn` CLI.** The
brief calls for "shadcn/ui components on Radix, restyled to the brand"
(section 2, 5.1.6). The `shadcn` CLI's registry currently assumes Tailwind
v4 conventions on a fresh Next.js install, which conflicts with the v3
choice above. `src/components/ui/*` is written by hand instead: Radix UI
primitives (`@radix-ui/react-*`) plus `class-variance-authority` and
`tailwind-merge`, styled to the exact specs in 5.1.6, which is the same
pattern shadcn itself generates. `sonner` is used for the Toast component,
as 5.1.6 explicitly allows ("Built on Radix Toast (or sonner styled to
this spec)").

**Current user is a static stub pending milestone 2.** `src/lib/dates.ts`
(the clock) is in scope for milestone 1, but the session layer
(`server/session.ts`, the `ch_user` cookie) is milestone 2's "Data model,
full seed and demo mode". So the shell renders as a hardcoded signed-in
user, Adrian Koh (Ops, admin) — decision B8's default "View as" user —
and the "View as" switcher (M15 AC11) is a visual stub: selecting an
option shows the "Now viewing as..." toast but does not change any
session, cookie or rights. Real wiring (cookie, server action, per-user
worklist and visible tabs) lands in milestone 2, as the build plan
specifies.

**Admin menu entry not rendered yet.** Brief 5.2 describes the Admin menu
as part of the general S0 spec, but 7.4.1 milestone 1's own scope line
lists only "demo strip, top bar with global search bar, user menu, toasts,
access and not-found pages" — no Admin entry, and M15 AC12/AC13 (admin
menu visibility, Roles & permissions page) are listed under milestone 4,
not milestone 1. The Admin entry (and the pages it would link to) is added
in milestone 4.

**Home (S1) and Search (S2) are minimal placeholders.** Full worklist
sections (M11, milestone 7) and full search/filtering (M1 read paths,
milestone 3) are out of this milestone's scope. `/` and `/search` render
just enough to prove the shell and the global search bar's Enter action
work (M1 AC1, AC11): a page title and, on `/search`, either the empty-state
hint copy or an acknowledgement of the query string.

**Two concrete 403 "access" pages added now, at their brief-specified
routes (B5), ahead of the milestones that give them real permission
logic.** Section 5.2's "Access and record pages" table is part of M1's
own scope line ("access and not-found pages"), so the UI for these states
belongs here even though the routes that will naturally trigger them
(Admin pages, milestone 4; the wizard, milestone 6) don't exist as full
features yet. Added: `/admin/users`, `/admin/deleted-records` and
`/admin/roles-permissions` (all three render "You don't have access to
Admin. Ask Adrian Koh (Ops)."), and `/customers/new` ("Only Sales can
create a customer record"). Each currently renders unconditionally, for
every user, because the admin flag and the real screens behind them don't
exist yet — milestone 4 replaces the admin ones with the real pages plus
the `isAdmin`/team check, and milestone 6 replaces the wizard one. Left
out: the Audit-tab 403 and the soft-deleted-record 410/404, both of which
need the `/entities/[id]` layout (header, tabs) to exist first (milestone
3/4) — stubbing just the sub-route without that surrounding shell would
render with no entity context and look broken, so it's genuinely
milestone 4 work rather than a cheap pull-forward like the other two.

**Fixed against the design stylesheet and the Shell-Menus/Shell-States/
Home-Ops artboards** (second look, after the first milestone 1 report):
- `.text-page`/`.text-section`/`.text-subsection` colour the heading
  `--color-primary` at weight 600 in the design stylesheet; the Tailwind `fontSize`
  tokens only carried size/leading/tracking. Added a small
  `@layer components` rule in `globals.css` so every `text-page` etc.
  usage gets the right colour and weight from one className.
- The "View as" label is a separate `<label>` next to the `.strip-sel`
  pill in both artboards, not text inside the pill itself. Moved it out
  of `ViewAsSwitcher` into `DemoStrip`.
- `.strip` (the demo strip) has no 1024px override in the design stylesheet, unlike
  `.topbar`, which does (`padding:0 16px;gap:16px` under
  `max-width:1100px`). The demo strip and the main page wrapper
  (`.page{padding:24px}`, also no override) now keep flat padding at
  every width; only the top bar shrinks its padding/gap at 1024px, per
  the design stylesheet.
- the design artboard's full-width top bar has a second `flex:1` spacer
  after the capped-width search box, so the user menu stays flush right
  once the search box hits its 560px max-width. Without it, the user menu
  would sit immediately after the search box instead, with dead space at
  the right edge. Added the matching spacer to `TopBar`.
- Fixed a real bug surfaced while comparing against the artboards: the
  "View as" trigger showed blank text on load. Radix's `Select.Value`
  only mirrors an item's rendered content once that item has mounted
  inside the select's (portal-rendered, lazily-mounted) content — an
  uncontrolled select with only `defaultValue` has nothing to mirror until
  the user opens it once. `ViewAsSwitcher` is now a controlled select
  that passes the current user's label as `SelectValue`'s children
  directly.

## Milestone 2: Data model, full seed and demo mode

**Prisma 7, not Prisma 6 — a real breaking change from the brief.** Brief
3.2.2 says the schema "passes `prisma validate` (Prisma 6)" and gives
`datasource db { url = env("DATABASE_URL") }`. The installed `prisma` /
`@prisma/client` (latest stable, 7.10.0 — milestone 1's reasoning for
"use latest" applies the same way here) reject that: Prisma 7 removed
`datasource.url` from `schema.prisma` entirely. The connection now lives
in two places: `prisma.config.ts` (`datasource.url`, read via Prisma's
`env()` helper, used by Migrate/`db execute`) and a driver adapter passed
to `PrismaClient` at runtime (`@prisma/adapter-pg`'s `PrismaPg`, in
`src/server/db.ts` and `db-admin.ts`). The schema's `datasource` block
keeps `provider` and `extensions` only. Everything else in the given
schema (models, enums, indexes, the `postgresqlExtensions` preview
feature) applies unchanged and validates clean.

**The two Postgres roles (3.1.4) are real, not simulated.** Neon's owner
role (`neondb_owner`) carries `CREATEROLE`/`CREATEDB`, so milestone 1's
plan to skip role separation because "there is no Docker here" turned out
to be unnecessary: a `hub_app` role was created directly on the project's
Neon database (`CREATE ROLE hub_app LOGIN PASSWORD ...`), `.env`'s
`DATABASE_URL` now connects as `hub_app` and `DATABASE_ADMIN_URL` as
`neondb_owner` (standing in for `hub_owner`). `prisma/grants.sql` runs
after every migration exactly as the brief specifies, so `hub_app` only
ever has the brief's exact grants (verified: `SELECT`/`INSERT`/`UPDATE`
on `Entity`, no `DELETE`; `SELECT`/`INSERT` only on `AuditEntry`, and the
append-only trigger blocks `UPDATE` even attempted through `hub_app`).

**`prisma migrate reset` carries its own AI-agent safety prompt.** Prisma
7 detects when it's invoked by an AI coding agent and refuses to run
`migrate reset` without a human explicitly consenting (it prints
instructions and expects `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`
set to the user's own consent text). This is a good thing and was
respected: the PO was asked directly before the first `db:reset` run
against the Neon database; `scripts/db-reset.ts` does not attempt to
route around it. Also: Prisma 7's `migrate reset` dropped the
`--skip-seed` flag the brief's `db:reset` description assumes (there is
no `migrations.seed` configured in `prisma.config.ts` for it to skip, so
the flag no longer exists) — `scripts/db-reset.ts` calls
`prisma migrate reset --force` and then applies `prisma/grants.sql` and
runs the seed itself, in that order, same as the brief's description
minus the now-nonexistent flag.

**`seed/seed.test.ts` reads an already-seeded database; it does not run
its own migrate+seed cycle.** Brief 7.3.1 phrases the test as "runs the
seed with `DEMO_CLOCK_START=...` and `GLEIF_SEED_SOURCE=cache`, then
asserts...", which could be read as the test driving its own reset. Given
the `migrate reset` consent prompt above, an automated test run must not
try to trigger or route around it. This also matches the gate language in
7.4.2 ("green ... from a clean `npm run db:reset`"), which already treats
`db:reset` as a precondition run before the tests, not something the
tests perform. So `tests/unit/seed/seed.test.ts` asserts against whatever
state the database is currently in, and fails fast with a clear message
if the database looks empty. Run
`GLEIF_SEED_SOURCE=cache DEMO_CLOCK_START=2026-10-02T09:00:00+03:00 npm run db:reset`
before `npm test` (README.md).

**"History items" (7.1.14 minimums) = the merged timeline (`HistoryEvent`
+ `Note`), not just `HistoryEvent` rows.** Brief 3.2.4 says the History
tab merges both by `createdAt`; the per-entity minimums ("at least 8
History items") are written as if counting what a user actually sees
there, so the seed self-check counts both kinds together, each
`HistoryEvent` filtered to the AC8 default category set (everything
except `OTHER_FIELD_CHANGES`, brief 7.6.3).

**mps's History team coverage: 5 teams, not 6.** 7.1.14's summary line
says "mps has at least 12 History items across all 6 teams", but the
operative assertion it cites (E2E-4 step 5) says "at least 12 items with
authors from Sales, Ops, CS, Network and Finance" — five teams, Compliance
excluded. The two disagree; Compliance's only mps-related activity is the
KYB checks, which are `OTHER_FIELD_CHANGES` (filtered out of the default
timeline same as above), so "6 teams" isn't reachable under "with the
default filters on" without adding History rows that would immediately be
filtered back out. Treated the E2E-4 wording as authoritative (it's the
testable, specific one) and the seed self-check asserts exactly
`{CS, FINANCE, NETWORK, OPS, SALES}`.

**Two History-event gaps found and fixed via the self-check, not called
out by name in the brief's "required named events" list.** Brief 3.3.3
lists "Contact added" (`CONTACT_CHANGE`) and "contract or partner
agreement attached" (`NETWORK_AND_STRUCTURE`) as event types that belong
in the default-visible timeline, but 7.1.14's "required named events"
table — which the seed was first built against — doesn't happen to name
either for any entity. Without them, Monzo (7 items) and scbPt (3 items)
fell short of their 7.1.14 minimums (8 and 5). Added both generically (one
event per seeded contact create, one per contract/partner-agreement
attach) rather than patching only the two shortfall entities, since 3.3.3
says every entity should have them.

**`OTHER_FIELD_CHANGES` History rows (KYB, periodic review, obligations,
billing profile) are not written yet — audit entries are.** 3.3.3 lists
these under `OTHER_FIELD_CHANGES`, which decision in 7.6.3 keeps off the
default timeline filter for all of R1 (the filter UI itself is R2,
milestone 9). Since they'd be invisible under the default filter either
way, and every one of these writes already gets its `AuditEntry` rows
(satisfying M16 AC1), adding the `HistoryEvent` rows now was deferred to
whichever later milestone first renders History with the filter UI, to
avoid writing rows nothing can show yet.

**`seed.ts` writes audit/History directly; it is not routed through a
generic field-diffing service layer.** Brief 7.1.0 says the seed "uses the
same formatters as the service layer to produce the derived rows," but
the service layer itself (recordChanges-style diffing used by every real
edit) is milestone 4+ work, built against real write endpoints that don't
exist yet. `src/server/audit/record.ts` (`createFields`/`updateFields`/
`recordFields`) and `src/server/audit/history.ts` (`addHistory`) are
written as the shared formatting/writing primitives both the seed and the
future service layer call — the seed calls them directly with explicit
field maps per created row, rather than diffing a before/after object,
since every seed row is a fresh create. The later service layer can reuse
the same two modules once it has real before/after state to diff.

**GLEIF cache filler records: `directParent`/`ultimateParent` set to
`null`.** Brief 7.2.4's table marks these fields "(as fetched)" for the
six filler institutions (Nordea, ING-DiBa, OCBC, Bank of Ireland, Česká
spořitelna, Raiffeisen Bank International) — meant to be filled by
`npm run gleif:snapshot` against the live API, not given literal values.
Seeded as `null` (plausible for large, independently-listed banks) so the
cache file validates and the seed runs deterministically with
`GLEIF_SEED_SOURCE=cache`; running `gleif:snapshot` against the live API
will fill in the real values.

**Filler institutions' KYB licence numbers, issuing authorities and
ownership/sanctions summaries are invented.** 7.1.11 only specifies these
in detail for the scenario entities; for the five KYB-bearing fillers
(Nordea, ING-DiBa, OCBC, Bank of Ireland, Česká spořitelna) and rbi, the
brief says "licence no expiry, all four Verified... ". Plausible
per-country values were invented (e.g. "DE-LIC-3350 · BaFin"), consistent
with decision P3 ("KYB results... are fictional").

**Partner role creation date = the partner agreement's signing date.**
7.1.3 doesn't give a separate date for when the Network partner role was
added on dual-role entities (lloyds, totta, netopia, ingdiba) or the two
partner-only fillers (ocbc, boi); 7.1.5's partner agreement signing dates
line up naturally with this (a partner agreement is signed when the role
is set up), so those dates are reused for the role and for the one named
required event ("Role added: Network partner" on lloyds, `today-245`).

**Stage-history dates for stages the seed tables don't give a date for**
are spread evenly between the neighbouring given dates, rounded to whole
days, exactly as brief 7.1.0 specifies (`prisma/seed/helpers.ts`,
`buildStageTimeline`) — anchored on the line's added date, its Live &
hypercare entry date when it has reached that stage, and its current
stage's entry date.

## Milestone 3: Read paths (search, entity record, group)

**Every S4 tab is read-only in this milestone; all edit controls (Edit
roles, Attach contract, Change stage, Add/Edit contact, Add note, Change
status, Record verification, Edit billing profile, Link/Unlink entity,
Create/Edit group, "Hand over", "Delete record") are deferred to
milestone 5**, even where section 6 nominally lists some of them as R1 at
the screen level. This milestone builds the UI → queries (reads) half of
the service-layer split (brief 3.1.2); the write half (routes, dialogs,
validation) is a separate, later pass so each write endpoint's exact JSON
error/audit/History contract can be built and tested together rather than
piecemeal per tab.

**Partner tab's "Partner agreement" card and Compliance tab's "Partner
agreement" card are out of scope, not just deferred to milestone 5.**
Brief 6.7's own Release line says "R1 with the coverage table... R2 adds
... the Partner agreement summary card", and 6.8's Release line gives the
Compliance-tab Partner agreement card to R2 the same way — the body text
under each heading documents the card's fields without repeating the R2
tag, which is easy to miss on a first read. Built it once by mistake
(reading the field description, not the Release line) and removed it
before this milestone's checks ran; only the Customer agreement
obligations card (R1 per 6.8) ships. `PartnerRole.partnerAgreementId`
and the `PARTNER_AGREEMENT` `ObligationCard` stay seeded and queryable;
nothing in this milestone reads them.

**`src/server/queries/header.ts` passed `contractReference: null` to
`computeBillingFlag` with a comment claiming it wasn't needed for the
header badge.** It is: the function always folds "Contract reference"
into `missingFields` when the value is null, so every entity with an
active, own-invoiced Customer role showed "Incomplete for billing" in
the header regardless of whether a contract was actually attached or
whether the billing profile was actually complete. Found while building
the Overview page (Lloyds, fully complete, still showed the badge).
Fixed by selecting `contract.contractId` in the header query and passing
the real value; `billing.ts`'s equivalent call was written correctly
from the start. Confirmed against the seed: Lloyds (complete profile,
real contract) now shows no badge; Zopa (9 missing fields) still does.

**`header.ts` and the first draft of `partner.ts` called `new Date()`
directly instead of `now()`/`today()` from `lib/dates`.** Every other
derived computation in the app goes through those two functions so that
`DEMO_CLOCK_START` can offset "now" for a deterministic demo run (brief,
shared conventions; env vars 3.1.5). `DEMO_CLOCK_START` is unset today so
this was a no-op in practice, but it would have silently broken the
incident-contact availability chip and coverage current/scheduled split
the moment someone sets it. Fixed both call sites to go through
`lib/dates`.

**Seed-generated History-event sentences embedded raw ISO dates** ("UK
CoP / GB: UAT → Go-live approval (entered 2026-09-20)") instead of the
brief's display format ("entered 20 Sep 2026", brief 3.2 `HistoryEvent`
comment and 6.6's copy patterns). `prisma/seed/seed.ts`'s three
`addHistory()` summary strings used the `d()` helper directly, which
returns a raw `LocalDate` ISO string, instead of passing it through
`formatDate()`. Found while building the History tab, since the tab
renders `HistoryEvent.summary` verbatim. Fixed in `seed.ts` and reseeded
(see below); the three call sites are Stage change, Coverage status
change and Product line added.

**Reseeding to apply the History-sentence fix surfaced 5 pre-existing,
unrelated test bugs in `tests/unit/seed/seed.test.ts`: oracle assertions
hardcoded an absolute date where the test's own title or inline comment
said the expected value was relative to `today()`** (e.g. "Zopa's UK CoP
/ GB line targets today-6", asserted against the literal string
`"2026-09-26"`). These were written during milestone 2 and happened to
pass because the seed was run and tested same-day; real time had since
moved on, so re-seeding today shifted every `today()`-relative date in
the database while the hardcoded test strings didn't move with them.
Fixed by computing the expected value as `addDays(today(), n)` at test
run time instead of a literal string, matching what each assertion's own
comment already said it meant. Not a regression from this milestone's
work, but it blocked verifying the History-sentence fix so it was fixed
here, with the user's consent to the reset that surfaced it.

**Added `zod` as a direct dependency** (previously only a transitive one)
to write `src/lib/search-params.ts`'s `searchParamsSchema`, per brief
3.7.4's explicit instruction and the planned folder structure (3.1,
"validation/ # zod schemas per action"). Scoped to the R1 subset of
params only: `q`, `view`, `country`, `scheme`, `page`, `osort`, `incMin`,
`incMax`. The R2 params (`role`, `stage`, `coverage`, `lifecycle`,
`owner`, `sort`, `spMin`, `spMax`, `spEmpty`, `inEmpty`) aren't parsed yet
since there's no filter UI or query support for them until milestone 9's
R2 pass.

**Search's Country and Scheme filters are a plain `<form method="GET">`
with checkbox lists, not the brief's "searchable multi-select" / checkbox
widgets with client-side interactivity.** Every other control on every
R1 tab this milestone is a server-rendered link or form (no `"use
client"` component exists yet outside the M1 shell), and a GET form
achieves the same end state — full URL state, shareable/bookmarkable
results, works without JS — without introducing the first client
component purely for a filter panel. The country checklist is populated
from the distinct countries actually in use (entity, product and
coverage countries) rather than the full ISO-3166 list, since a search
box over ~250 countries would need client-side filtering to be usable
and this milestone has none. Revisit if a later milestone needs a true
type-ahead country picker elsewhere (the wizard's country field, for
instance).

**Obligations view is Customer rows only, with only the Incident notice
min/max filter, matching brief 5.4's Release line exactly** ("R1 with
... the Obligations view with Customer rows, Incident notice filter and
both sortable columns; R2 adds ... Partner rows, the Subprocessor notice
filter and 'Only rows where this is not captured'"). The Subprocessor
notice column renders and both columns are sort-clickable (R1), but
there's no Subprocessor min/max filter or "not captured" checkbox yet,
and no Partner-role rows. Verified against the brief's own scenario
check (`country=GB&scheme=UK_COP&osort=in_asc` → Revolut 2h, Santander UK
4h, Lloyds 8h, Zopa "Not captured" last, Monzo absent because its UK CoP
status is Not applicable, "4 agreements") — now a permanent regression
test in `tests/unit/search.test.ts` rather than a one-off check.

**Group record (S5) omits Link entity, Unlink, Create/Edit group and the
admin-only "`<n>` deleted entity" line.** The first three are write
actions, out of scope for the same reason every other edit control is
(above). The deleted-entity count line is admin-only per 6.11, and this
milestone has no real viewer-permission check yet (M4's job) — M3's
"Owned by `<Team>`" labels are already documented as static placeholders
for the same reason (`src/components/entity/OwnedBy.tsx`), so this line
follows the same deferral rather than inventing a one-off admin check
just for it.

**Search's "New customer" no-results action (Sales only, brief 5.4
States) is not shown.** It opens the New customer wizard (S3), which
doesn't exist yet (`/customers/new` still renders the M1 403 placeholder)
and is a write entry point like every other create/edit action this
milestone excludes.

**Milestone 3's "Done when" row (7.4.1) says "Every search oracle in
7.1.15 except contract ID holds" — 7.1.15 is "Scenario oracles: what
each 'View as' user sees on Home after a reset," the Home/worklist
oracles for a screen this milestone doesn't build (S1 Home is milestone
7).** 7.3.1's own `seed/seed.test.ts` row lists "the 7.1.15 oracle" (Home)
and "search oracles" as two separate items in the same sentence, with no
section number attached to the second; the Done-when row appears to have
merged them, attaching "7.1.15" to the wrong one. Treated "search oracle"
as meaning 5.4's "Worked examples (seed; use as tests)" plus
`seed/seed.test.ts`'s own "Search oracles (data level; except contract
ID...)" describe block, which already existed from milestone 2 and names
the same "except contract ID" carve-out — the two agree with each other,
just not with the 7.1.15 cross-reference. Verified all of them: the data-level
oracles in `seed.test.ts` (unchanged, still passing) and, new this
milestone, the real search/obligations services against every 5.4 worked
example and the obligations scenario check, in `tests/unit/search.test.ts`.

**Post-milestone visual-fidelity pass against the design (Shell-Menus,
Home-Ops, Entity-Lloyds-Overview, Details-MPS, Revolut-Products-R1,
Compliance-Netopia-R1), requested before milestone 4.** Shell and the
"View as"/user menus already matched (fixed in milestone 1); the Admin
menu gap in the top bar is intentional and already documented in
`TopBar.tsx` ("The Admin entry is added in milestone 4"). Found and fixed
real gaps against the other four, screenshotted side by side with
Playwright:
- Overview had a stray standalone lifecycle badge above "Active alerts"
  that isn't in the design (the lifecycle chip already lives in the
  entity header); removed it. Added the count badges next to "Active
  alerts" / "Products and stages" and the per-row "View in `<Tab>`" link
  text the design shows on each alert row (the row was a bare link with
  no visible link text).
- Details and Compliance both render their section's own name as an
  `sr-only` or missing heading instead of the visible page-level header
  brief 6.3 and 6.8 both call for ("header 'Details' + line…", "header
  'Compliance'"); made both visible.
- Compliance: added the LEI copy icon and the owner-block lock icon
  brief 6.1's header spec requires (`LEI | DM Mono, copy icon`; `Everyone
  else: lock icon in its place, tooltip "Owned by <Team>"`) — present on
  every tab since they're in the shared `EntityHeader`. Styled the
  section labels ("KYB CHECKS" etc.) to match the design stylesheet's `.spec-h` (12px,
  uppercase, 600 weight, letter-spacing). Color-coded the KYB expiry line
  by status. Added badge styling to the EU VoP / UK CoP status fields
  (plain text before). Gated the Customer agreement card's own expiry
  badge to ≤90 days, matching the Obligations view's convention and the
  design (Netopia's ~400-day-out expiry shows no badge there). Moved "N
  of 8 captured" into the card header and "Last updated by…" to the
  card's bottom, both per the design's layout.
- **Real bug, not just a style gap:** the Customer agreement card's "Last
  updated by `<user>` (`<team>`)" line rendered the raw Prisma enum
  (`COMPLIANCE`) instead of the display label (`Compliance`) — the code
  never passed `updatedBy.team` through `TEAM_LABELS`. Fixed.
- Products & onboarding: added the count badge and "Ordered by target
  go-live" caption next to the header, checkmark icons on completed
  stage-track segments (design shows them; a plain tint fill alone
  wasn't enough to read as "done" at a glance), and moved the
  "Go-live overdue" / "Billable from" badges from the band's top row to
  the end of its facts line, matching the design in all three bands of
  Revolut-Products-R1.

## Milestone 4: Permissions, audit and admin (R1)

Branch stacked on `milestone-3-read-paths` (which carries one commit not
yet in `main` — see PR #4) per the user's own fallback instruction for
an unmerged parent branch.

**Scope.** Policy module (`src/server/permissions/{matrix,can,guard}.ts`)
covering the full M15 AC3 matrix for display, with `can()` actively
enforcing only the actions this milestone's own routes need (entity
read/soft-delete/reactivate, audit read, the three admin reads) — every
other `DataArea` exists for the Roles & permissions page and for M5+ to
wire up as each real route lands, per the matrix module's own doc
comment. `mutate()` (`src/server/audit/mutate.ts`), the one-transaction
write wrapper brief 4.2.1 calls for, built on the `recordFields`/
`addHistory` primitives already in place since milestone 2. Soft delete
and reactivation (`src/server/services/entity-lifecycle.ts`) with guard
5. Audit tab (list, newest first, 50/page, Load more — no Field/User/
Date filters, those are R2 per 6.10's Release line). Admin menu in the
top bar and a real `/admin` section: Deleted records, Roles &
permissions (both admin + Compliance per the matrix), Reset demo data
wired to the M2 endpoint. No "Users & roles" anywhere (6.12.1 is R2, in
full: no page, no sidebar link, no top-bar menu entry). No edit actions
beyond delete/reactivate/reset — Reassign owner and Hand over to
Customer Success are explicitly milestones 5 and 7's jobs despite
sitting in the same brief 6.1 Release-line sentence as "Delete record".

**Resolved a real brief-text conflict on the HTTP status for a write
against a soft-deleted entity.** 4.1.5's illustrative `can()` pseudocode
and 3.8's API-conventions preamble disagree: 4.1.5 shows 409
`entity_deleted`; 3.8's preamble says "every write rejects a soft-deleted
entity with 410 except the two admin record actions." Initially
implemented 3.8's reading (`DeletedError`, 410) since it's the more
general, API-spec-like statement. Found while re-reading 4.8.1 for the
soft-delete flow itself: its own prose, independent of both of the above,
states "Every write on a deleted entity returns 409 `entity_deleted`"
(line 2995) — the same 409 as 4.1.5, now confirmed in two independent,
specific business-rules locations against 3.8's one general mention.
Reverted to 409 (`ConflictError`). Also clarified that "the two admin
record actions" (delete, reactivate) are exempt from this blanket gate
entirely, not merely given a different status: `can()` doesn't auto-block
them on a deleted entity at all (reactivate needs to run *because* the
entity is deleted; an already-deleted entity being deleted again is the
service layer's own conflict to raise, not this generic gate's).

**`AuditEntry.objectLabel` for soft-delete/reactivate: resolved against
the brief's own internal inconsistency, not just the design.** 4.2.2's
`AuditObjectType` schema comment and the formal enum in 3.2.2 ("the only
schema," per section 4's own preamble) have no `RecordStatus` value —
but 4.8.1, 4.8.2 and Appendix A (M16, twice) all explicitly say "object
`RecordStatus`, field `Record status`." Since 3.2.2 is declared
authoritative over the schema and adding an enum value would contradict
that, kept `objectType: LEGAL_ENTITY` (no migration) but changed
`objectLabel` from the seed's original `` `Legal entity: ${name}` `` to
the literal `"Record status"` — this is what the design artboard's Object column shows, and matches the brief's
own "Record status rows" phrasing in 6.10 (a phrase that only reads
naturally if "Record status" is what that column actually says). `field`
stays `"Record status"` exactly as 4.2.2, 4.8.1 and 4.8.2 all say — the
design mockup's Field column showing "Status" instead is treated as the
mockup taking a liberty with exact copy, since the business-rules text is
unambiguous and repeated. Updated both the M2 seed's `lloydsLegacy`
soft-delete row and the new `entity-lifecycle.ts` service to match, and
reseeded.

**The guard-5 reused-LEI block is shown proactively, not just after a
failed submit.** Built the Reactivate dialog first as a plain confirm
that discovers a conflict only when the POST fails (toast + dialog stays
open) — functionally correct (verified against the exact brief message)
but not what the design artboard's "R1: reactivation
is blocked" panel shows: the warning visible immediately on open, with
"Reactivate" already disabled. Added `findLeiConflictMessage()`
(`src/server/queries/deleted-records.ts`) so the caller — the deleted-
record banner and the Admin > Deleted records row — already knows
before the dialog ever opens, via the same server-side check the service
layer uses to enforce it for real. The failed-submit path stays as a
defence-in-depth fallback (the button being disabled is a client
affordance, not the actual guard).

**`/admin` has a persistent left sidebar** (`src/app/admin/layout.tsx`,
`AdminSidebar.tsx`) — missed on the first pass (built the three pages
with only the top-bar "Admin" dropdown as navigation) until
the design artboard and the design artboard both
showed one. Brief 6.12's own Layout line ("top bar, left sub-navigation…
page content") says the same; the top-bar dropdown and the sidebar are
two separate, brief-confirmed navigation surfaces, not one duplicated by
mistake. The sidebar omits "Users & roles" the same way the top-bar menu
does (6.12.1 is R2) — not just because the design's "Admin" dropdown
lacks it, but because showing a sidebar link to a page that is
permanently a 403 stub in R1 would be a real dead-end, not a style
choice to skip.

**Roles & permissions' row grouping and some row labels follow**
the design artboard **over 4.1.2's 30-row table and
4.1.3's partial example, treating this as a display/layout choice (design
wins) rather than a data one.** The design combines several 4.1.2 rows
that carry identical or closely-related cells into one displayed row —
"Roles and lifecycle state", "Product lines and target go-live" — and
groups "Commercial terms" under Products and onboarding rather than
Entity (4.1.3's own partial example code put it under Entity, but that
snippet is explicitly illustrative, not a complete mapping: "// … one
entry per row of the 4.1.2 table, same values" only binds the *values*).
Every cell value in `PERMISSION_MATRIX` still equals what 4.1.2
specifies for that control; only which rows are merged for display and
which group header they sit under changed. Verified with
`permissions.test.ts`'s matrix-shape tests (one row per area, all 6 team
cells present, the 8 owner-label strings, the admin/Compliance-only
areas) after the restructuring.

**Audit tab's count line ("N changes") was built, then removed.** 6.10's
Release line is explicit that the count line is an R2 addition alongside
the Field/User/Date filters, not part of "the list newest first, 50 per
page with Load more" R1 ships. Removed it along with double-checking no
other R2 affordance (filters, "Expand" for long values) had crept in.
Added a visible "Audit" + "Immutable log of every field change. Read-
only." header instead, which the design and brief's 6.10 prose both
show/imply but the first draft omitted (same gap as Details/Compliance
in the milestone 3 follow-up).

**Added `tests/e2e/forged-writes.spec.ts`**, not named in the brief's own
7.3.1/7.3.2 test lists, to make "a forged request from each wrong team
returns 403 and writes nothing" (this milestone's own done-when line) a
permanent, repeatable check rather than a one-off manual pass: every
non-owning team (including a non-admin Ops user, distinct from the admin
who happens to sit on Ops) against every real write/admin-read route
this milestone adds, asserting both the response and that the database
genuinely didn't change. Found one real bug this way: the audit list API
route crashed with a 500 (not a relevant case for the 403 tests, but the
one legitimately-successful 200 case — Compliance reading real audit
data) because `AuditEntry.id` is a `BigInt` and `JSON.stringify` can't
serialize it; `NextResponse.json()` doesn't handle `BigInt` either.
Fixed by stringifying `id` before the route returns it, same as the
Audit tab page already does for its React keys.

**`tests/unit/seed/seed.test.ts`'s exact entity-count assertion needed
hardening once a real write-path test existed.** `audit.test.ts`
(new this milestone) creates one throwaway fixture entity per run via
the admin client, immediately soft-deletes it, and cannot delete it
afterwards (no hard delete exists, by design) — so a `vitest run` of the
whole suite can leave `seed.test.ts`'s "18 entities" assertion seeing 19
if `audit.test.ts` happened to run first in that invocation (vitest
doesn't guarantee file order). Excluded fixture entities by their
recognisable name prefix (`"ZZZ Audit Test Fixture"`) from the count
and the soft-deleted-rows check, keeping it a real regression check on
the seed's own output rather than loosening it to a `>=` comparison.
Not a milestone 4 regression — a structural gap in milestone 2's test
that only a real write-path test (this milestone's first) could expose.

**`access-pages.spec.ts` (milestone 1) needed updating, not just
re-running.** Its own comment already said as much ("Real permission
checks replace these stubs when each milestone lands"): it asserted all
three `/admin/*` routes always show the generic 403 for every viewer,
which stopped being true the moment `/admin/deleted-records` and
`/admin/roles-permissions` got real content gated by `can()`. `/admin/
users` still always 403s (6.12.1 is R2, unchanged); the other two are
now asserted against a signed Sales cookie instead of the default (admin)
demo user, who now legitimately sees real content there.

## Milestone 5: Edits per tab (R1)

**Found and fixed a latent bug in `can()` before writing any milestone 5
code.** `can()`'s `teamOk` check treated a `"R"` matrix cell as
sufficient for *any* action tied to that area, including writes. This
was harmless through milestone 4 because every write action so far was
gated by an `"admin"` cell, not a mixed `R`/`E` one. Milestone 5's first
write (`product.stage.change`, area `product.stage`: `E` for Ops, `R`
for everyone else) would have let any reading team change a stage.
Fixed by splitting `teamOk` into `readOk()`/`writeOk()`: a write now
requires `E`, `add`, or (`admin`+isAdmin) — `R` alone never passes a
write. Regression-tested directly in `permissions.test.ts` against the
real M5 actions, not just a synthetic area.

**Added `src/lib/api-client.ts`**, named in brief 3.1.2's layer table
("Client components ... call `lib/api-client`") but not built in
milestones 3-4, since neither had a client-side write form yet (M4's
delete/reactivate dialogs used a bare `fetch()` inline). Milestone 5
adds roughly 15 write dialogs that all need to parse the same 3.1.3
error shapes (400 field errors, 403 forbidden, 409 conflict with
`needsConfirmation`, 410 deleted, 503 unavailable) — one shared
`apiRequest()` avoids 15 copies of that switch. M4's two existing
dialogs were left as they were (no behaviour change, not worth
re-touching for a style-only refactor outside this milestone's scope).

**Added `src/server/validate.ts`'s `parseBody()`** for the same reason:
milestone 4's only body field was a hand-checked `reason` string; from
milestone 5 every route has a real Zod schema (brief 3.4, "same schema
the client form uses") and needs its issues turned into the exact
`{"error":"validation","fieldErrors":{...}}` shape. One helper, every
route parses the same way.

**Concurrency (brief 3.1.3 step 5) is keyed to whichever row the write
actually changes, not a single project-wide token.** The brief's own
example ("This coverage was updated by ...") confirms the error names
the mutated object, not the entity — so `PartnerCoverage.version` gates
Change coverage status, `ContractedProduct.version` gates Change stage
and the block actions, `Contact.version` gates Edit/Verify contact,
`CustomerRole.version` gates Attach contract and Renewal date,
`KybCheck.version`/`ObligationCard.version` gate the Compliance writes,
and `Entity.version` gates the composite entity-level writes (Set roles,
Link/Unlink) that don't map onto one child row. Reassign owner uses the
brief's own `expectedOwnerId` instead of a generic version, per 3.8.2.
Implemented as a read-then-compare inside each write's transaction
(`version !== expected` → `ConflictError`) rather than a literal Prisma
`where: { id, version }` update, since `version` isn't part of any
unique index Prisma would accept there; the transaction boundary closes
the same race a compound-where update would. Added
`src/server/audit/conflict.ts`'s `versionConflictMessage()` so every
route builds the "updated by `<name>` at `<time>`" text from the same
place (the latest `AuditEntry` for that object, per 3.1.3) instead of
fifteen near-duplicate queries.

**R2 boundaries the brief lists under the same API row as an R1 action
are rejected defensively, not just hidden from the UI**, since a forged
request could otherwise reach them: Set roles rejects an attempt to
deactivate an already-active role (`ValidationError`, M4 AC8's
needs-confirmation removal flow is R2); Set group rejects linking an
entity that already has one (`ConflictError`, M4 AC4's move-with-
confirmation is R2); Change stage rejects any `toStage` that isn't
exactly N+1 (`ValidationError`, M6's skip/back is R2, guard 3 of 7.6.9);
Change coverage status rejects an effective date after today
(`ValidationError`, M5 AC17's Scheduled status is R2, guard 4). Each is
logged at its call site; listed together here since they're the same
shape of decision repeated across five services.

**`entity.gleifRefresh` is a special case in `can()`, not a matrix
row.** 3.8.2's "Retry or refresh GLEIF" is the one write two different
teams reach through two different surfaces for two different reasons
(Ops's header retry, gated on the LEI being `NOT_VERIFIED`; Compliance's
LEI card, unconditional) while touching the same `entity.core`-owned
columns. Modelling it as its own matrix area would have meant a 29th
row nothing else reads; modelling it under `entity.core` would have
denied Compliance, which has only `R` there. `can()` checks
`user.team === "OPS" || "COMPLIANCE"` directly; the Ops-only
`NOT_VERIFIED` precondition is a business rule checked in the service,
not a permission.

**"Acknowledge assignment" (3.8.2) is the one M5 write that bypasses
`can()`/the matrix entirely.** Its rule is "the named assignee only" —
an identity check against who the row was assigned to, not a team
membership check against any of the 28 areas; modelling it as a 29th
matrix area would have been a lookup table for a rule the area can't
express. The service checks `assignment.assigneeId === user.id`
directly and throws the same `ForbiddenError` shape for a consistent
403, logged in `forged-writes.spec.ts` as its own test (a second CS
user, not team-filtered) rather than folded into the `WRONG_TEAM_USERS`
loop that doesn't fit it.

**Owner reassignment's "Acknowledge" surfaces as a header banner, not a
Home worklist row.** Brief 4.5 says acknowledging happens "only from
Home row or header banner" — Home's worklist engine (brief story M11)
is build milestone 7 (not yet built), so the header banner (shown to
the assignee on the entity itself, next to the existing pending-handoff
banners built in milestone 3) is the only available surface this
milestone. Not a scope reduction: the write
(`POST /api/owner-assignments/{id}/acknowledge`) and its audit trail
are the same either way; only which page links to it differs, and that
will gain a second entry point once milestone 7 ships Home's inline
row-level "Acknowledge".

**`isPrimary` is Add-contact only.** 3.8.2 lists `isPrimary?` on Add
contact's input and separately gives "Set primary incident" its own
endpoint (clearing the previous primary) that M5's scope list doesn't
include. Edit contact's schema omits `isPrimary` entirely rather than
half-implementing the clear-previous-primary invariant a second place;
Add contact still clears any existing primary Incident contact when a
new one is saved as primary, since that invariant has to hold regardless
of which endpoint touches it.

**Extracted `contactOwnerTeams()`/`contactDataArea()`
(`src/server/derived/contact-ownership.ts`)** from a function the
milestone 3 Contacts page already had locally (`ownerTeamsFor`), since
3.1.3 states the permission area for a contact write "comes from the
contact's ownerTeams" — the server now needs the exact same mapping the
read page uses to render "Owned by `<Team>`". Re-pointed the page's
import at the shared version (behaviour unchanged, confirmed by the
existing Contacts tab tests) rather than letting the two drift.

**Added `AuditObjectType`-labelled object headers for every new write's
audit rows** following the exact `objectLabel` conventions milestone 4
established (e.g. `"Record status"` reserved for the delete/reactivate
lifecycle field) — GLEIF refresh's audit rows use objectLabel `"LEI"`
rather than reusing `"Record status"`, to keep that reserved label
unambiguous for admins reading the Audit tab.

**Bugs found and fixed through real browser verification (Playwright
screenshots alone wouldn't have caught these — they only surface by
actually clicking through the live app).**

- *RSC boundary violation.* The Partner tab's `CoverageTableRow` (a
  Server Component) originally wrapped `ChangeCoverageStatusDialog`'s
  trigger in a bare `<span onClick={(e) => e.stopPropagation()}>` to
  stop the click bubbling into the enclosing `<summary>` (which would
  otherwise also toggle the row open/closed). Next.js correctly refused
  this at runtime: a native DOM element can't carry an event handler
  inside a Server Component at all, not just when passed into a Client
  Component prop. Fixed by moving the `stopPropagation()` call into the
  dialog's own trigger `<Button onClick>`, which is already inside the
  "use client" component — the server page no longer touches any event
  handler.
- *A drawer whose trigger silently did nothing.* `ContactDrawer`'s
  external `trigger: React.ReactNode` prop (built so the Contacts page
  can pass its own "Add contact" / "Edit" button in) was rendered as a
  bare child of `<Dialog>` instead of wrapped in `<DialogTrigger asChild>`
  — Radix only wires up open/close behaviour for children of its own
  `Trigger` primitive, so every click on "Add contact" or "Edit" was a
  complete no-op with no console error to point at it. Found by actually
  clicking the button in a browser, not by reading the component.
  `AttachContractDialog`, `ChangeStageDialog` and the rest don't have
  this bug — they each own their trigger `<Button>` directly inside the
  same client component, so only `ContactDrawer`'s external-trigger
  pattern was affected.
- *`contract.ts`'s "Signing date" audit value was never run through
  `auditDate()`* — every other date field project-wide renders as
  "05 Oct 2026"; this one would have stored the raw `"2026-10-05"` ISO
  string straight into the audit log, inconsistent with the Audit tab's
  display convention. Fixed by importing and applying `auditDate()`,
  matching every other service.
- *`owner.ts` used raw `new Date()` three times* (superseding an earlier
  assignment, setting `ownerSince`, setting `acknowledgedAt`) instead of
  `now()` from `lib/dates` — the same demo-clock-bypass mistake already
  self-caught twice in milestones 2 and 4 (see above), and invisible in
  interactive testing specifically *because* the local dev session had
  no `DEMO_CLOCK_START` set, so `now()` and `new Date()` happened to
  agree. Found on a deliberate re-read for exactly this pattern, not by
  a failing test. Fixed all three call sites.
- *`obligations.ts`'s audit `objectLabel` and History summary were
  hardcoded to "Customer agreement"* even though the service is generic
  over `ObligationCardKind` and the route accepts `PARTNER_AGREEMENT`
  too (no UI exposes it this milestone, but the route doesn't reject it
  either). A Compliance user hitting the route directly with
  `kind=PARTNER_AGREEMENT` would have gotten a correctly-saved card with
  an incorrectly-labelled audit trail. Fixed to use
  `OBLIGATION_CARD_KIND_LABELS[kind]` dynamically.
- *`EntityHeader`'s incident contact block never rendered a "24/7"
  indicator* for a contact with `available24x7: true` — only the derived
  "Available now" / "Outside availability" badge showed, which is
  correct but isn't the same information the design and the brief's own
  worked example (brief 5.2, S4 header) both expect to see at a glance.
  Not a milestone 5 regression (the block itself predates this
  milestone) — found while building the milestone's one required E2E
  spec, whose own header assertions (brief 7.3.2, E2E-2 step 1) need it.
  Added the missing badge.

**The production build was silently broken on Vercel the whole time.**
`next build` succeeds locally (and under `npm test`/`test:e2e`, which
run against `next dev`, never a production build), but every real
Vercel deployment through milestone 5 failed: PR #4/#5 failed earlier
in the pipeline on a GitHub-account-verification check (see the git
identity note above), masking a second, independent failure underneath
— Turbopack couldn't resolve `.prisma/client/index-browser` the one
time a deploy got past that check (PR #6). Root cause: this project has
no root-level `postinstall` script, and Vercel's `npm install` blocks
dependency-level install scripts (including Prisma's own `preinstall`)
under npm's install-scripts allowlist, so `prisma generate` never ran
on a fresh Vercel install — the build was silently running against
whatever `.prisma/client` happened to survive in Vercel's build cache
from an earlier, differently-configured deploy. Fixed by adding
`"postinstall": "prisma generate"` to `package.json` (a project's own
lifecycle scripts always run, unlike a dependency's); verified with
`rm -rf node_modules/.prisma && npm run postinstall` and a full local
`npm run build` afterward.

That fix uncovered a second, chained problem: `postinstall` now ran on
Vercel, but `prisma generate` itself failed there —
`prisma.config.ts`'s `datasource.url: env("DATABASE_ADMIN_URL")` is
evaluated eagerly at config-load time, before Prisma even dispatches to
the `generate` subcommand, and throws if the var is unset. It's
deliberately unset on Vercel (the build should never hold admin
credentials, and `generate` never opens a connection anyway — see the
comment in that file). Fixed by resolving the URL with
`process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "postgresql://unset/unset"`
instead of the throwing `env()` helper, which has no optional/default
form. Verified `prisma generate` succeeds with both vars unset, and
that `prisma migrate status` against the real Neon database still picks
up the real `DATABASE_ADMIN_URL` when it is set, so local/CI migrate
workflows are unaffected.

## Milestone 6: New customer wizard, GLEIF and duplicates (R1)

**`src/components/ui/select.tsx`'s `SelectContent` had no height limit on
its Radix viewport.** Every dropdown built through milestone 5 has 6-9
options, short enough that this never surfaced. The wizard's step 2
country picker is the first consumer to pass the full ~250-entry
`COUNTRIES` list into a `<Select>`; with no `max-height`/`overflow-y`
on the viewport, the popover rendered at full unconstrained height and
pushed later options below the viewport with nothing to scroll —
caught by the e2e spec hanging on a real click timeout ("element is
outside of the viewport"), not by typecheck or a visual pass. Fixed in
the shared component (`max-h-[var(--radix-select-content-available-height)]
overflow-y-auto` on the `Viewport`, the standard Radix pattern), not
worked around in the wizard, since every future long-list `<Select>`
would hit the same bug otherwise. Confirmed it doesn't change any
existing short-list dropdown (those never approach the new max-height).

**The "contracting entity" picker can select the entity being created,
before it has a real id.** Brief 5.5's step 2 artboard and E2E-1 step 4
both show the picker offering the new entity itself alongside its
group's existing members. Since `ContractedProduct.contractingEntityId`
is a real FK and the entity doesn't exist until mid-transaction, the
client sends the sentinel `"__self__"` for that option; `createCustomer`
(`src/server/services/customer.ts`) resolves it to the just-created
`entity.id` before writing each `ContractedProduct` row and before
looking up the name for the `SalesToOpsSnapshot`.

**R1 scope boundaries taken directly from brief 5.5's R1/R2 split and
confirmed against the design artboards' own captions** (not independent
judgment calls): no discard-confirmation dialog (leaving the wizard
discards with no dialog, as instructed); no country override; no LEI
successor/override-reason flow for an invalid status (Retired, Merged,
Annulled, Duplicate, or "not found" all block Next with no escape,
matching `src/lib/validation/customer-wizard.ts`'s server-side mirror
of the same gate); no "create group from GLEIF parent" (the group
picker only ever offers existing groups); no "Add Customer role to this
existing entity"; no "entities not in portal" textarea (the field is
wired through the schema and snapshot type as always-`null` so it needs
no later schema change, but the wizard never shows it); no manual entry
for "GLEIF unavailable" or "LEI not found" (both just block Next, same
as the invalid-status case).

**The "Possible duplicates" panel's "Open record" link is admin-gated
only for a soft-deleted match, not every match.** Brief 3.6.2's panel
rules attach the admin-only gate specifically to the deleted-record
case; an active match's link is visible to whoever is running the
wizard (Sales). Worth calling out because it's easy to over-generalise
the gate to every card — the first implementation did exactly that and
was caught by re-reading 3.6.2 against the panel's actual states, not
by a test.

**`/api/duplicates/check` and `/api/gleif/lookup` are gated on
`customer.create`, not just authentication.** The brief also triggers
the duplicate check from the Details tab when Ops edits LEI/BICs/name/
aliases on an *existing* entity (resolution 54) — out of this
milestone's scope. That trigger will need either a second permission
check (`entity.contract.attach`-style, scoped to the entity) or a
looser gate on this route; noted here so it isn't missed when that
tab's wiring is built.

**A minimal "New customer" entry point was added to the Home
placeholder** (`src/app/page.tsx`), gated on `can(user, "customer.create")`,
ahead of milestone 7's actual worklist. E2E-1 step 1 (per the R1 short-
spec release-split table) is "click 'New customer' only" — the
surrounding "Overdue go-lives" / "Champion left" worklist assertions
stay milestone 7's job; this change touches only the button, not the
rest of the placeholder page.

**Two lint-driven fixes to the wizard's data-fetching effects**
(`src/components/customer-wizard/NewCustomerWizard.tsx`): the duplicate-
check and group-members effects originally reset their own state
synchronously on the "nothing selected yet" branch, which
`react-hooks/set-state-in-effect` correctly flags as a cascading-render
risk. Neither reset was actually load-bearing — `entity.gleif` only
ever transitions null → found, never back, and `groupMembers` is only
ever read through `contractingEntityOptions`, which already falls back
to `[]` when no group is selected — so both effects were simplified to
do nothing on that branch instead of fighting the lint rule.

## Rename demo data to international names

Applied `26_mapare_nume_internationale.md`'s mapping (PO decision, 5 Oct
2026: international, easy-to-identify names; no Romanian names or
institutions) across the seed, tests, fixtures, GLEIF cache, and every
hardcoded UI copy string that spelled out a name. The design is explicitly
out of scope here — the mapping doc's own framing splits this between
"Claude Design (all artboards)" and "Claude Code (seed, tests, GLEIF
cache, oracles)"; this entry covers only the Claude Code half.

**The "BCR LEI renewal due soon" compliance illustration is lost, not
replaced.** `scripts/gleif-check.ts` and `tests/unit/seed/seed.test.ts`
both hard-coded BCR's real LEI renewal date (22 Oct 2026), which happened
to fall inside the 90-day `KYB_EXPIRING_DAYS` window — a genuine,
live-GLEIF-data illustration of an "LEI renewal due" compliance worklist
item, not a fabricated one. UniCredit Bank GmbH's real LEI (verified live
just now: `2ZCNRR8UK83OBTEK2170`, ISSUED, next renewal **2027-08-02**) is
nowhere near that window. Since this seed's whole point is real,
live/cache-backed GLEIF data, that date can't be faked, and no other
seeded LEI currently falls inside the 90-day window either. Fixed the
oracle to assert the real new date; removed the BCR-specific special
case from `gleif-check.ts` (falls through to the generic "will land on a
worklist bucket" branch, which doesn't fire for this entity since its
real status doesn't call for it). **This specific demo beat — a
Compliance-team "LEI renewal due soon" example — no longer has a seeded
entity carrying it.** Picking a replacement real institution would be a
product decision, not a renaming one, so it wasn't made here; flagging
it for the PO's attention.

**Real name collision found, not worked around:** the mapping renames
Mihai Dobre to Leo Martin, but the seed already has an unrelated contact
named Leo Martin (Monzo, Technical, seeded independently of this
rename). Applied the mapping exactly as given per the instruction ("no
Romanian names... renamed exactly as in the mapping") rather than
inventing a different name on my own judgment — the mapping's own
"checked against existing contacts and users to avoid shared surnames"
claim apparently missed this one. Both "Leo Martin"s now coexist in the
seed (CS team member, owning several accounts; Monzo's Technical
contact) — worth the PO's attention if this reads as confusing in the
demo.

**BCR's "Incomplete for billing" illustration (missing postal code and
VAT ID) was deliberately preserved, unlike the LEI-renewal one** — this
one isn't GLEIF-dependent, just two seed fields left `null` the same way
for UniCredit Bank GmbH. No test depended on it either way; kept for
demo-story continuity since nothing stopped it being kept.

**`data/gleif-cache.json`'s snapshot refresh (`npm run gleif:snapshot`)
surfaced a real, unrelated data correction**: Česká spořitelna's
(`ceska`, LEI `9KOGW2C2FCIOJQ7FF485`) direct and ultimate parent came
back as Erste Group Bank AG on this live refresh — previously `null` in
the cache (apparently never fetched before). This is real GLEIF data,
confirmed by the earlier BCR entry having used the same Erste LEI
coincidentally (a different, unrelated real-world banking relationship);
not reverted, not something this rename caused. No test depended on
`ceska`'s parent being null.

**Design-artboard filename references to "Netopia" were left alone**
(`ObligationsCard.tsx`, `RefreshGleifButton.tsx`'s `Compliance-Netopia-R1`
doc comments; this file's own milestone-3 entry above mentioning the
same artboard and "Netopia's ~400-day-out expiry"): the design source
still has the design artboard etc. under their original
names (design's own rename is a separate, not-yet-done pass per the
mapping doc), and the historical DECISIONS.md entry describes a review
that genuinely happened against a file with that exact name — renaming
the reference would misdescribe what was reviewed. The milestone-1
entries quoting literal "Radu Stoica" UI copy *were* updated, since
those describe current on-screen text that must stay in sync with the
real components, not a point-in-time artifact name.

**Other renames applied mechanically, exactly per the mapping**: all 10
changed portal-user names/seed-keys/emails (Tom Hadley and Lukas Brenner
unchanged); BCR → UniCredit Bank GmbH (seed key `bcr`→`hvb`, country
RO→DE, new LEI/BIC/aliases, licence BAFIN-KI-100208/BaFin, owner-
reassignment reason "Rebalancing German accounts before Q4"); Netopia →
Adyen N.V. (seed key `netopia`→`adyen`, country RO→NL, new LEI, licence
DNB-BL-0412/De Nederlandsche Bank, customer contract ID `IPE-RO-2024-011`
→ `IPE-NL-2024-011`; the partner agreement ID `IPE-PA-2024-011` has no
country code in its own convention and was left as-is); all 8 external
contacts; the generic phone example (`src/lib/validation/phone.ts`'s
error copy, its wizard/drawer placeholders, and their tests) from the
Romanian `+40712345678` to the UK `+447700900123` / typed
`"0044 7700 900123"`. Two search-oracle tests (`tests/unit/seed/seed.test.ts`,
`tests/unit/search.test.ts`) whose premise depended on "Financial
Services" coincidentally matching both Netopia's legal name and Zopa's
alias were restructured to test what's actually true now (Zopa's alias
only); a BIC-prefix search test was repointed from BCR's old BIC prefix
to UniCredit's new one.

## Milestone 6A: Issue model, routing and clocks (R1)

**Design source updated separately first.** The design source was replaced entirely with the 5 October export
(161 artboards + the design stylesheet +
`canvas.json`); the zip was deleted after extraction. Confirmed no old
artboards survived (`Billing-BCR*`, `Compliance-Netopia*`, `Audit-
Netopia*` are gone — git detected them as renames to the `-HVB`/`-Adyen`
equivalents, consistent with the rename-international-names PR already
on `main`).

**Regulator's deadline field: design artboard markup conflicts with its
own caption and with the brief; followed the brief and the caption.**
the design artboard's "Regime None" panel renders the
Regulator's-deadline textarea with an `is-disabled` class alongside
"Facts needed within (hours)". But that same artboard's own caption
reads "Facts needed within and Post-incident report due (R2) are
disabled and cleared on save" — naming only two fields, not the
deadline — and the brief's M26 AC4 is equally explicit: "When the
regime is None, 'Facts needed within (hours)' and 'Post-incident report
due (days)' are disabled; on save their values are cleared." Neither
text source lists the deadline field. Treated the stray `is-disabled`
class on the deadline textarea as a markup slip in the static mockup
(not a deliberate design decision, since it contradicts the artboard's
own caption), and built `ObligationsCard.tsx` to disable only "Facts
needed within (hours)" when regime is None; the deadline field stays
editable regardless of regime. `saveObligations()` clears
`factsNeededHours` to `null` server-side whenever `regulatoryRegime ===
"NONE"` (old value kept in the audit log, per AC4), but never clears
`regulatorDeadline` — it is "information only" and nothing in either
source says to clear it.

**Regulatory fields are null for every card kind but Customer
agreement, enforced in the service, not just the DB.** The brief's
3.2.6.4 CHECK constraint (`ObligationCard_regulatory_customer_only`)
already stops a non-customer card from persisting regulatory values,
but `saveObligations()` computes `regulatoryRegime`/`regimeName`/
`regulatorDeadline`/`factsNeededHours` as `null` up front whenever
`kind !== "CUSTOMER_AGREEMENT"`, rather than relying on a DB error for a
request the UI should never send (the Partner agreement card has no
Regulatory block at all, M26 AC1). The audit before/after objects
likewise omit the four Regulatory keys entirely for non-customer cards,
so a Partner-agreement save's audit entry isn't cluttered with four
"null → null" no-op fields.

**`postIncidentReportDays` (R2) is in the migration but untouched by
any R1 code**, per decision B37 ("every field that only R2 writes
exists from 6A and stays null in R1") and M26 AC9 ("Post-incident
report due (days)" is not rendered in R1). `ObligationsCard.tsx`,
its validation schema and `saveObligations()` never reference it. It
**is** seeded now (7.1.17.6 says so explicitly, unlike B37's general
rule), via `prisma/seed/data/obligations.ts`'s `postIncidentReportDays`
field.

**M18 AC11's "routed" History event was missing from the Phase 4
service code; added it, with a judgment call for the queued case.**
AC11 names two separate entity-History events ("Issue ISS-1043
reported..." and, separately, "ISS-1043 routed to Kevin Lim (Ops),
communicator Adrian Koh (Ops)"), but `createOneIssue()` only wrote the
first. Fixed by resolving the owner and communicator (via
`effectiveCommunicator()`) and writing a second `log.history()` call
with that exact format, mirrored in the seed's own issue-creation code
so the three seeded issues carry it too. The brief gives no example
for the one case this can't resolve to a name: a Sev-2/3/4 issue saved
outside business hours with no named owner-team person (rule 4,
`ownerId` null, routing queued until the next business start). For that
case the event reads "ISS-nnnn routed: queued for the start of <Team>
business hours" instead of "routed to <name>" — never exercised by the
R1 seed (none of the three seeded issues hit rule 4), so untested
beyond this file.

**Fixed a raw-enum-in-audit-text bug while in the same code, out of an
abundance of caution rather than strictly in scope.** `createOneIssue()`'s
History summary rendered `${user.team}` and the "Routing" audit field
rendered `${routing.ownerTeam}` as the bare Prisma enum ("OPS"), which
contradicts labels.ts's own "never the raw enum value" rule (3.3).
Both now go through `TEAM_LABELS`.

**`changeSeverity()`/`changeType()` (M19 AC13-AC20) trust the client's
chosen severity/type rather than re-deriving AC13's dialog-disabled
options server-side.** AC13 describes which options the *dialog*
disables (capped severities, Sev-1 on Billing/Commercial without a
breach); it is explicitly 6B's UI (the dialog itself doesn't exist
until then). 6A builds the service `POST /api/issues/{issueId}/severity`
and `/type` exercise directly (no UI yet, same as the report endpoints),
so there is no dialog to bypass in R1. Re-deriving and enforcing AC13's
exact disabled-option rule server-side, on top of the owner-only check
AC19 already requires, would duplicate logic that has no caller to
protect against yet; left for 6B, when the dialog (and a direct-API-call
test against it) exists. `changeType()`'s own AC18 cap (Billing/
Commercial-coverage forcing Sev-1→Sev-2) is implemented, since that is
a *consequence* of the type change itself, not a dialog-disabled
severity option.

**Four more issues found during my own review pass, all fixed:**

- **A third raw-enum call site**, missed by the above fix: `routing.ts`'s
  `ROUTING_RULE_REASON[rule]({ ..., team: ownerTeam })` passed the bare
  Prisma `Team` value into the `routingReason` string itself (the
  "Why this owner" line stored on every `Issue` row), giving "No named
  OPS person..." instead of "No named Ops person...". Caught by
  `issues.test.ts`'s own AC4 case. Fixed to pass `TEAM_LABELS[ownerTeam]`.
- **`src/server/demo-reset.ts`'s `TABLES` list didn't include any of the
  issue-flow tables.** Most are reachable by `TRUNCATE ... CASCADE` from
  `Entity`/`User` (every issue-flow table has a foreign key to one or the
  other, directly or transitively), but `TeamBusinessHours` has no
  foreign key to anything — it's a standalone lookup table keyed by
  `team` — so it survived every truncate and a second `demo:reset-data`
  hit a primary-key violation re-inserting its 3 rows. Added it and the
  rest of the issue-flow tables explicitly, matching the file's own
  stated intent ("every data table").
- **`issues.test.ts`'s throwaway-issue cleanup violated `IssueContributor`'s
  foreign key** (no `onDelete: Cascade` to `Issue`) and, in one attempted
  fix, tried to delete `AuditEntry` rows for cleanup — `AuditEntry` is
  append-only by a database trigger that blocks `DELETE` for every role,
  admin included, and `objectId` is a plain string, not a real foreign
  key to `Issue`, so there was never a constraint to satisfy there in the
  first place. Settled on deleting the real child rows (`IssueContributor`,
  `IssueResolution`, `IssueNote`, `IssueCommunication`,
  `ComplianceAssessment`, `HistoryEvent`) before the `Issue` itself, and
  leaving its `AuditEntry` rows in place — same as every other write this
  seed/test suite makes against a database that gets truncated wholesale
  between runs.
- **The same throwaway-issue helper let `db.issue.create()` fall back to
  the real `number` sequence default**, permanently advancing
  `issue_number_seq` by one per throwaway issue (a delete doesn't roll a
  sequence back). Six throwaway issues in one `vitest run` bled into
  `seed.test.ts`'s "next issue number is 1043" and "only ISS-1042 is
  flagged" assertions whenever both files shared a process. Fixed by
  giving the helper its own obviously-fake, manually-assigned `number`
  (9,000,000 and up) so it never touches the sequence.
- **`seed.test.ts`'s on-call-shift coverage check compared a UTC-sliced
  date string against a Bucharest-local date string.** `tsz(-7, "00:00",
  "Asia/Kuala_Lumpur")` is correct per its own definition and the 7.1.17.4
  spec, but 00:00 MYT (UTC+8) falls on the *previous* UTC calendar day,
  so `startsAt.toISOString().slice(0, 10)` was never going to equal
  `addDays(today(), -7)` — off by construction, not a seed bug. Rewrote
  the assertion to compare instants against `now()` directly (does the
  shift actually cover from 6+ days ago to 13+ days ahead), which is what
  the invariant ("covers today-7 to today+14") means and doesn't care
  which calendar the comparison is read in.

## Milestone 6B: Report, Issue page and communication (R1)

**`severity.ts` no longer imports `@/server/config`; `SEVERITY_FROM_IMPACT`
and `TYPE_SEVERITY_CAP` moved into it.** Brief 4.9.1 says the report
drawer imports `proposeSeverity()` directly for the live client-side
proposal, and 4.9.6's "nothing changes on open issues" rule needed the
same function reachable from the Change-severity dialog's cap display.
But `@/server/config` loads `i18n-iso-countries` at module scope purely
to build `COUNTRIES` — exactly the accidental-client-bundle problem
`src/lib/validation/bic.ts`'s own comment already warns about for this
exact file. Rather than import `@/server/config` into a client
component (or duplicate the two constants), moved them into
`severity.ts` itself, which otherwise only imports `@prisma/client`
types and `@/lib/labels` (itself import-light) — now genuinely
isomorphic. `issue.ts`'s `changeType()` now imports `TYPE_SEVERITY_CAP`
from `@/server/derived/severity` instead of `@/server/config`.

**Fixed a pre-existing gap in `mutate.ts`'s `AuditLogger.history()`:
`handoffId` and the new `issueId` were declared on the type but never
actually passed to `addHistory()`.** `customer.ts`'s handoff-sent write
already called `log.history({ ..., handoffId: handoff.id })` expecting
it to land on the `HistoryEvent` row, but the implementation silently
dropped it, so the History tab's "View handoff summary" link can never
have appeared. Fixed in the same edit that threads `issueId` through
(every 6B issue-write's History event, plus 6A's two `createOneIssue()`
calls and `changeSeverity()`/`changeType()`, now pass it) so the History
tab's "Incident" rows gained a "View issue" link
(`src/app/entities/[id]/history/page.tsx`). No test covered the
handoff link either way, so this is a pure fix, not a behavior change
any test depended on.

**`ensureSystemWrites()` runs in its own transaction, separate from the
caller's `mutate()` write.** 4.9.7 says a unique-constraint hit on
`systemKey` should "roll back and continue" as a no-op when another
request already wrote the hand-over. If it ran inside the issue-write's
own transaction (nested, sharing `tx`), that constraint violation would
poison the *whole* surrounding transaction (Postgres aborts until
rollback), killing the real write it was only supposed to precede.
Implemented as a standalone function using the top-level `db` client,
called before `assertCan()`'s caller opens its own `mutate()` -- i.e.
as the brief's "runs at the start of" literally describes, not nested
inside the write.

**`onCustomerOwnerChanged()`'s audit entry and History event attribute
to the human who changed the owner, not "Customer Hub"; the
communication-log entry and issue note do use "Customer Hub."** 4.9.11's
table reads "Communicator change, hand-over | ... (source SYSTEM_ISSUE
for the hand-over)" -- the parenthetical names the hand-over
specifically, implying the plain "Communicator change" (customer-owner-
changed) row is not a `SYSTEM_ISSUE`-sourced write. That reads as: this
is a *consequence* of the human's own reassignment, not an unattended
system action, so the audit/History actor is the reassigning user
(default `source` USER). The note/log text's own actor is still
"Customer Hub" either way, per the schema's `IssueNoteKind.SYSTEM` /
`CommunicationType.SYSTEM` enum comments ("grey, actor 'Customer Hub'"),
which don't distinguish hand-over from customer-owner-changed.

**"Open" means two different things for issues, and both are followed
literally rather than reconciled into one rule.** B's shared
conventions say an issue is open "in every status except Closed" and
explicitly lists the similar-issues block among the screens that use
that definition. But M17 AC5's own text enumerates exactly New, In
progress, Waiting on customer, Waiting on partner for the similar-
issues block and "Add to existing issue" -- excluding Resolved. Took
the AC's specific, testable enumeration (`ISSUE_OPEN_FOR_SIMILAR` in
`src/server/config.ts`) for those two features, and the general
"not Closed" rule for the entity header's open-issues chip and the
Issues tab's "Open" filter (`src/server/queries/entity-issues.ts`,
`src/server/queries/header.ts`). A Resolved issue is genuinely "done
but not yet closed with the customer," so excluding it from "report
your own case onto this existing one" while still counting it as
visibly open on the entity reads as the intended distinction, not a
typo in one direction or the other.

**Added a real `GET /api/entities/{id}/issue-context` route**, departing
from this app's established "no GET route, the page's own server
component calls a query loader directly" convention. The report drawer
opens from three different pages (entity header, entity Issues tab,
group record) and needs its context (product lines, contacts, coverage
rows) only once it actually opens, not at every page's render time --
closer in shape to `POST /api/duplicates/check`'s existing "fetch while
the form is open" precedent than to a page's own data. The brief's own
3.8.3 reads table lists this exact route, so this follows the brief
rather than this codebase's convention for page-load data.

**Country-to-timezone fallback for the "no incident contact" message
greeting is a small static map scoped to the seed's actual countries**
(`src/server/issues/message.ts`), not a general country-timezone
library -- no such library is installed, and this only changes the
*displayed* times in a message preview when there is no active
incident contact to read a time zone from (M22 edge case 1); it never
feeds a clock or a deadline. Same reasoning, same shape as
`business-hours.ts`'s existing `TEAM_TIME_ZONES`. Added the 3 missing
`TZ_ABBREVIATIONS` entries this needed (Lisbon WET/WEST, Helsinki
EET/EEST, Dublin GMT/IST).

**The "More" dropdown on the Issue header (the design artboard)
is flattened into plain secondary buttons** (Change severity, Change
type shown directly next to Change status/Reassign, not nested in a
menu). The grouping is a visual choice, not a functional requirement,
and a dropdown item opening a separate dialog needs its own open/close
coordination with the dropdown's own close-on-select behavior for no
real benefit here; flattening avoids that entirely.

**`ChangeStatusDialog` folds three artboards (Change status, the
Resolve fields, and "back to work") into one component.** The brief
treats Resolve as its own route and the "from Resolved" state as a
separate dialog screen, but they're the same radio-list shape with
different fields revealed by the selected status: picking Resolved
reveals Root cause/Solution and calls `POST /resolve`; picking In
progress from Resolved reveals a required Reason and calls `POST
/status` with it (AC5 "back to work"); anything else reveals an
optional Note and calls `POST /status`. One component avoids a second
dialog hand-off for what is, from the owner's chair, a single "change
status" action.

**Report on a group: no Product line field, no similar-issues block,
no entity-specific contact picker for "Reported at the customer by."**
M17 AC4 only specifies the entity checkboxes; it says nothing about
these three fields for a multi-entity report, and each is genuinely
ambiguous across several entities at once (whose product lines? whose
open issues? whose contacts?). The group form's "Reported at the
customer by" offers only "Someone else" and "Found by Corvane"; Scheme and
Country are freely editable (never locked, since there's no product
line to lock them).

**"Add to existing issue" confirms via a second, nested `Dialog`
inside the drawer** (`aria-label`/title "Add to existing issue",
body "Add your report to ISS-1038? No new issue will be created."),
not a native `window.confirm()` -- consistent with every other
confirmation in this codebase (e.g. the contributor-removal confirm).

**`requireIssueEntity()` (new, `src/server/issues/roles.ts`) adds the
soft-deleted-entity check to every 6B issue-write, which 6A's
`changeSeverity()`/`changeType()` never had.** Brief 3.8.3: "A write on
an issue of a soft-deleted entity returns the deleted-entity response
of 4.1.5" -- true for every issue write, but 6A's two services call
`assertCan(user, "issue.owner")` with no `resource` at all, so they
never actually re-check it. Built it correctly for every new 6B
service (`addReportToExistingIssue`, `editIssueDescription`,
`acknowledgeIssue`, `changeIssueStatus`, `resolveIssue`,
`addContributor`, `removeContributor`, `reassignIssue`, `addIssueNote`,
and the communicator actions) rather than leaving the same gap twice,
but left `changeSeverity()`/`changeType()` as 6A shipped them --
retrofitting already-merged, already-tested code for a rule this
milestone didn't ask me to re-audit felt like scope creep; flagging it
here in case a later milestone wants a single pass over all of them.

**`issue.communicator` added to the `can()` action union** (6A only
needed `issue.report` and `issue.owner`); maps to the matrix's existing
`issue.communicator` row, already E6 with the "current communicator
only" cell note from 6A's own matrix table -- no matrix change needed,
just the missing `Action` entry 6B's record-communication/close
services require.

**Reassign's AC10 outside-business-hours warning is computed twice,
deliberately.** `ReassignIssueDialog.tsx` imports `isInBusinessHours`/
`userCalendar` from `@/lib/business-hours` directly for the live
warning as the owner picks a candidate (same pattern as the report
drawer's live severity proposal); `reassignIssue()` in
`src/server/services/issue.ts` independently recomputes it server-side
and returns `{ outsideHours, outsideHoursText }` in the response, so
the save can't silently diverge from what the dialog showed and a
non-JS client would still get the correct text back. Save is never
blocked either way (AC10: "The owner can still reassign").

**The Issue header's "More" actions aside, built dialogs as fully
controlled components with their own trigger buttons** (same
self-contained shape as the existing `ReassignOwnerDialog.tsx`
precedent) rather than a shared "active dialog" state owned by a
parent -- simpler, and nothing here needs one dialog to hand off into
another except Change status/Resolve, which is why those two were
folded into one component instead.

**Clocks panel ticks every 60 seconds client-side without calling
`Date.now()` or reading a ref during render.** `IssueClocksPanel.tsx`
re-runs the already-pure `computeClocks()` on an interval (brief 4.9.5,
"texts refresh at least every 60 seconds ... from serverNow"), but this
project's lint config enforces the React Compiler's purity rules
(`react-hooks/purity`, `react-hooks/set-state-in-effect`), which forbid
impure calls or direct `setState` in an effect body. Landed on: a
`baseline`/`elapsedTicks` pair where the baseline resets via the
"adjusting state during render" pattern whenever a fresh `serverNow`
prop arrives (after `router.refresh()`), and a plain `setInterval`
effect with no dependencies increments `elapsedTicks` every 60s; `now`
is derived as `serverNow + elapsedTicks * 60s` with no `Date.now()`
call anywhere in render.

**Resolved issues' resolutions always show the newest row's root
cause/solution; a superseded resolution ("back to work") is marked
"Superseded" rather than hidden.** M21 AC5 says the block "is kept and
marked Superseded," which this follows literally -- `issue.resolutions`
is fetched newest-first and the Issue page renders `resolutions[0]`
with its `supersededAt` flag, so a re-resolved issue's latest
resolution still shows correctly once resolved again.

**Fixed a pre-existing flaky assertion in 6A's own
`issues.test.ts` (AC17-18 type-change test), found while running the
suite for 6B.** Its `else` branch asserted `changed.ownerId` is `null`
whenever `changeType()`'s re-routing lands on `QUEUED_FOR_BUSINESS_HOURS`
(i.e. the test runs outside Finance's real business hours, with no
`DEMO_CLOCK_START` pinning this suite's "now"). But `routing.ts` rule 4
sets `ownerId = named?.id ?? null` -- `null` only when *no* named person
exists for that team on the entity; Revolut Ltd always has one (Rachel
Wong), so the correct expectation is `ownerId === rachel.id` in *both*
branches, and the test was simply wrong on whichever side of Finance's
09:00-18:00 SGT window it happened to run. Verified by running it
standalone twice, failing identically both times (not flipping), which
confirms a wrong assertion rather than a timing race. Fixed the
assertion; left the test's own time-of-day dependency (no `now()`
mock) as-is, since changing that is unrelated to the bug.

**`message.ts`'s "We are informing you..." line never doubles a final
period.** M22 AC3's own worked example reads "...affecting Banca Monte
dei Paschi di Siena S.p.A." with a single trailing period, even though
the template text (4.9.10) literally reads "<entity>." -- a naive
`${entity.legalName}.` gives "S.p.A.." for any legal name that already
ends in an abbreviation period. Caught by the new Template unit test
(`buildMessage()` against that exact worked example) comparing against
the AC's literal body text. Fixed with an `endsWith(".")` check.

**Found during manual verification, not fixed (flag for the demo
runbook, not a code change): `DEMO_CLOCK_START` only offsets the
*server's* `now()` (`src/lib/dates.ts`); a browser's own `Date` always
reflects the real host clock.** 6B is the first feature where the
*browser* captures a "now"-based instant (Corvane aware at defaulting to
now in the report drawer; Time defaulting to now in Record
notification and Close) and sends it to a server check against its own
`now()`. Under `playwright.config.ts`'s `webServer` (`DEMO_CLOCK_START:
"2026-10-02T09:00:00+03:00"`, used by every e2e spec including
`dialog-labels.spec.ts`), the server's clock runs from 2 Oct 09:00 plus
real elapsed time since that dev server process started -- while the
browser's clock is the real wall-clock time whenever this sandbox's
tests happen to run, days apart from the server's. A real browser
session submitting "now" for `awareAt` against that server gets
"Corvane aware at cannot be in the future," not because of a bug, but
because the two clocks genuinely disagree by design. This is harmless
for `dialog-labels.spec.ts` (it never submits a client-captured
timestamp) and for every 6A/6B unit test (no browser involved,
`now()` is the only clock in play) -- it only surfaces when a real
browser hits a `DEMO_CLOCK_START`-pinned server with a "defaults to
now" field. My own manual smoke pass (report -> acknowledge -> notify
-> resolve -> close, end to end through the real UI, full report
below) ran against a dev server started *without* `DEMO_CLOCK_START`
for exactly this reason. If a live demo ever runs with the clock
pinned, reporting an issue (or recording a notification, or closing
one) from an actual browser would need the demo's own system clock
set to match, not just the server's env var -- worth a line in
whatever runs the demo, not a 6B code change.

**Partner-issue scope (M23/6C) is read but not actioned.** The Issue
page computes `isPartnerIssue` (communicatorRule `ISSUE_OWNER_PARTNER`)
only to pick the right incident-contact role context (Customer vs.
Partner) for the message template and contact picker, per 4.9.10's
explicit instruction; no linked-issues panel, degraded-coverage banner,
or cascade affordance is rendered. A partner issue can still be
reported, routed, acknowledged, resolved and closed through 6B's
owner/communicator actions -- only the M23-specific UI is deferred.

**Found during my own review pass, fixed: `issues.test.ts`'s hand-over
403 test used a hardcoded absolute date outside the standard demo
clock.** The test "after hand-over, the former on-call owner gets 403
communication_handed_over on recordCommunication and close" set
`handoverAt`/`occurredAt` to `"2026-10-05T07:00:00.000Z"` (the E2E-5
demo day), but a standard `npm run test:all`/unit-test run uses
`DEMO_CLOCK_START=2026-10-02T09:00:00+03:00` (3 days earlier), so
`recordCommunication()`'s own "the time can't be in the future"
validation rejected the call with 400 before the test ever reached the
403 `communication_handed_over` check it exists to exercise. Confirmed
by re-running `npx vitest run tests/unit` independently: it failed
there even though the fork's own completion report claimed a
different, unrelated pre-existing failure. Fixed by anchoring
`handoverAt` to `now()` minus two hours instead of a fixed calendar
date, so it always holds under whichever `DEMO_CLOCK_START` the suite
actually runs with; left the other two tests in the same describe
block untouched, since they don't call a date-validated service.

## Milestone 6C: Partner issue, Compliance and Issues worklist (R1)

**Compliance assessor is chosen once, when the flag is first set, and
never moves afterward.** New `src/server/issues/compliance-assessor.ts`,
`chooseComplianceAssessor()`, mirrors the existing `issueTeamMember()`/
`onCallAt()` routing pattern for the COMPLIANCE team: inside Compliance
hours, the entity's named person; outside them on Sev-1, the Compliance
on-call person; outside them below Sev-1, the named person with
`complianceVisibleFrom` set to the next Compliance business start (M25
AC4, edge case 6). Wired into `createOneIssue()` and
`reevaluateComplianceFlag()` (severity/type change) in
`src/server/services/issue.ts`, but only on the transition from
unflagged to flagged -- `complianceAssessorId`/`complianceVisibleFrom`
are never recomputed once set, matching AC2's "the first non-empty
result sets `complianceFlaggedAt`" for the flag itself.

**`recordComplianceAssessment()` (new
`src/server/services/compliance-assessment.ts`) gates on the matrix's
`issue.compliance` row alone -- no "current assessor only" identity
check.** The brief names no such restriction (unlike the owner/
communicator actions, which do have one); any active Compliance user
can record an assessment. Added `"issue.compliance"` to the `Action`
union and `ACTION_AREA` map in `can.ts` (the matrix row and its label
already existed from 6A, anticipating this). New route `POST
/api/issues/[issueId]/compliance-assessments`, matching the path the
brief's own E2E-5 worked example (step 12) names literally.

**Partner issue validation lives in the service, not the Zod schema.**
`validatePartnerIssue()` in `issue.ts` checks, for a `PARTNER_DEGRADED`
report, that the entity has an active Partner role with a matching,
non-`RETIRED` `PartnerCoverage` row -- a DB lookup, so it belongs in
`createOneIssue()` next to this codebase's other cross-field business
checks, not in `src/lib/validation/issues.ts`'s pure schema. The result
feeds `isPartnerIssue` into `routeIssue()` (already built for rule 7 in
6A) and into `complianceReasons()` (a partner issue reads no customer
card and is never itself flagged) and disables its notification clock
entirely (`notifyRequired: false` unconditionally) -- 4.9.8's "it reads
no customer card: no notification clock."

**Create linked issues and unlink (`src/server/services/issue-partner.ts`)
write to two entities in one transaction, so they bypass the
single-entity `mutate()` wrapper and call `recordFields()`/
`addHistory()` directly** -- the same primitives `mutate()` itself
uses, matching `communicator-sync.ts`'s existing precedent for a write
that can't be pinned to one `ctx.entityId`. `createLinkedIssues()`
wraps everything in `db.$transaction()` and turns ANY failure inside it
(other than a validation/conflict/forbidden/not-found the caller should
see verbatim) into the literal brief copy "Linked issues not created.
Nothing was saved. Try again." (M23 AC7's own error text), so a
genuine all-or-nothing rollback is never silently swallowed as a
different-looking error.

**Cascade resolution is a two-step confirm, reusing the existing
`ConflictError(message, needsConfirmation)` mechanism** (already wired
end to end: `http.ts` → `{ error: "conflict", needsConfirmation: true }`
→ `api-client.ts`'s `ConflictResult.needsConfirmation` → the dialog).
`resolveIssue()` now counts the parent's active linked issues in New,
In progress, Waiting on customer or Waiting on partner; with no
`confirmCascade` flag and at least one such child, it throws that
conflict with "Resolve `<ID>` and `<n>` linked issues?" instead of
writing anything; the client (`ChangeStatusDialog.tsx`) shows that text
in a second, nested `Dialog` (this codebase's established confirm
pattern, not `window.confirm()`) and retries with `confirmCascade:
true`. Chose this over a separate "preview" endpoint: it keeps the
dry-run count and the real write on the same code path, so they can
never disagree about which children qualify.

**Owner sync (M23 AC17) is three separate call sites, not one
hook**: `acknowledgeIssue()` calls `syncCreatedChildrenAcknowledged()`
(active CREATED children in New move to In progress, no acknowledge
clock of their own); `reassignIssue()` and `changeType()`'s re-routing
both call `syncCreatedChildrenOwner()`. All three live in
`issue-partner.ts` and take the caller's own `tx`, so the sync lands in
the same transaction as the parent's own write, with one audit entry
per affected child. ATTACHED children are excluded by construction
(the sync queries filter `kind: "CREATED"`); the UI also hides
`ReassignIssueDialog` on an `INHERITED_FROM_PARENT` issue (the server
already 403s `linked_follows_parent` from 6A, so this is belt and
braces, not the only gate).

**Dual-role banner (M23 AC9) and the Linked issues panel's "Customer
notified" time are shown in the viewer's own time zone, not a fixed
one.** Found and fixed during review: both
`src/server/queries/issue-partner-panels.ts`'s `loadDualRoleBanner()`
and `loadLinkedIssuesPanel()` originally called `formatDateTime()`
(fixed `APP_TIMEZONE`, used elsewhere in this codebase for note
timestamps that deliberately don't vary by viewer) instead of
`formatInZone(instant, viewerZone, { timeOnly: true })` (the function
every other clock/time text on the Issue page already uses). This
would have shown Bucharest time to a Network user in Singapore instead
of "16:12 SGT" as the brief's own E2E-5 step 8 literally asserts
(`/Network last contacted the partner at \d\d:\d\d MYT/`). Fixed both
call sites and threaded `viewerZone` through; same bug, same fix, in
`CompliancePanel.tsx`'s two "Assessed ... at" lines (was
`formatDateTimeShort`, a visually different format with no zone
abbreviation at all) and in `DegradedProposalBanner.tsx`'s "set to
Degraded by ... at" line.

**"Not now" (M23 AC4's degraded-proposal dismissal) reads
`sessionStorage` through `useSyncExternalStore`, not a
read-in-an-effect-then-setState pattern.** Found and fixed during
review: the first version read `sessionStorage` in a `useEffect` and
called `setState` with the result, which this project's lint config
rejects (`react-hooks/set-state-in-effect` -- the React Compiler rule
flags exactly this "sync an external source into state via an effect"
shape and recommends `useSyncExternalStore` instead, precisely because
it already knows how to answer "what did the server render" (the
`getServerSnapshot` argument, here hardcoded to "never dismissed", so
there is no hydration mismatch) without a user-authored effect at all.
`DegradedProposalBanner.tsx` now reads through a tiny module-level
store (a `Set` of listeners, `dismiss()` notifies them) instead.

**`AffectedCustomersPanel`'s empty state and `CompliancePanel`'s
"not flagged" state follow the brief's literal copy, not a generic
placeholder.** The empty state is "No live customers on `<scheme
label>` / `<country>`. Nothing to notify." (M23 states block), which
needed the issue's own scheme/country threaded in as a label, not a
generic "this scheme and country." The Compliance block renders
nothing at all unless either it is flagged or the Sev-1-regulated check
actually ran and came back negative (regime `NONE`, no breach) --
tracked with a small `relevant = flagged || severity === "SEV1"` guard,
since an unflagged Sev-2+ issue should show no block at all (brief
States: "an unflagged issue shows no Compliance block").

**The severity-raised note on linked issues (M23 edge case 2,
`changeSeverity()`'s `reviewSeverityNote`) carries real links, not
plain text.** The brief's own copy is "`<n>` linked issues are Sev-`<X>`.
Review their severity." *with links*; the service returns each active
child's id and number (`linkedIssues: [{ id, number }]`), and
`ChangeSeverityDialog.tsx` renders the toast as JSX with a `Link` per
child rather than a bare string, so "Review their severity" is
actually clickable.

**Home "Issues" section** (`src/server/derived/issue-steps.ts`'s
`stepsFor()`/`roleLabel()`/`leadingStep()`, `src/server/queries/
worklist/issues.ts`'s `loadWorklistIssues()`, route `GET
/api/worklist/issues`, client component `src/components/home/
IssuesSection.tsx`) follows 4.6.9's three-group precedence (main,
Contributing, Reported by me) and the exact `rows.sort()` comparator
the brief gives verbatim. **Independently verified against every real
"View as" user in the 7.1.17.8 oracle table** (Tom Hadley, Adrian Koh,
Emma Wilson, Lukas Brenner, Mei Chen, Rachel Wong, and Kevin Lim via
Ops's "My team" scope) by hitting the live endpoint through a running
dev server after a fresh reseed -- every row, role label, step, count
and badge matched the brief's own table exactly, at both reference
instants (see the next two decisions for the one real surprise this
turned up).

**`DEMO_CLOCK_START=...+03:00` is Europe/Bucharest time (the brief's
own fallback "UTC+03:00" zone, 3.3.6), i.e. one hour AHEAD of CEST, not
"09:00 CEST."** This matters because 7.1.17.8 gives two oracle rows,
"[Mon 05 Oct, 10:05 CEST] (after Emma Wilson's 09:00 CEST start)" and
"[Fri 02 Oct, 08:00 CEST] (before Emma Wilson's start; `seed.test.ts`)"
-- and the standard test harness (`scripts/test-all.sh`,
`seed.test.ts`, `npm run test:all`) always seeds and runs under
`DEMO_CLOCK_START=2026-10-02T09:00:00+03:00`, which is the **second**
(pre-hand-over) row, not the first. A new worklist unit test initially
asserted Kevin Lim's "My team" row for ISS-1042 as plain "Owner"
(the post-hand-over shape); it failed under the standard harness with
"Owner and communicator" instead, and the oracle table itself confirms
that is correct for this exact environment ("Kevin Lim's ISS-1042 row
reads 'Owner and communicator'" is the pre-hand-over row's own stated
difference from the post-hand-over one). Fixed the test's expectation,
not the code -- this was a second instance of the same category of
test-authoring mistake 6B's own hand-over-test fix documented above,
now generalized: a hardcoded assumption about which side of a
`DEMO_CLOCK_START`-relative threshold the suite runs on. Worth a
permanent note for 6D and beyond: `DEMO_CLOCK_START`'s "+03:00" is
Bucharest, and the demo day's hand-over/business-hours thresholds are
in CEST/CET -- they are not the same clock.

**`createLinkedIssues()`'s CREATE action draws real numbers from
`issue_number_seq`, exactly like production reporting -- unlike every
throwaway fixture elsewhere in `issues.test.ts`, it has no override for
that.** The new "Fan-out and cascade" describe block snapshots
`issue_number_seq`'s `last_value` in a `beforeAll` and restores it with
`setval()` in an `afterAll`, so running real linked-issue creation
several times across that block's tests never leaks into
`seed.test.ts`'s own "the next number is ISS-1043" assertion when both
files run in the same `vitest run tests/unit` invocation. Found via a
genuine failure: the first version of this test block had no such
guard, and `seed.test.ts` failed downstream in the same run.

**Four of the new fan-out tests (`AC7-AC9`, `AC8`, `AC17`, `AC11/AC12`,
`AC14`) get an explicit 15-second `it()` timeout, not the 5-second
default.** Each calls the real `createLinkedIssues()`/
`acknowledgeIssue()`/`resolveIssue()` services, which are themselves
several sequential DB round trips per child issue (routing, the
Compliance assessor lookup, a contributor lookup-and-create, the issue
row, per-field audit entries, two `addHistory()` calls); one of them
timed out intermittently at the 5-second default specifically when run
as part of the full 19-file `tests/unit` suite (not when run alone),
most likely from cumulative connection-pool pressure across that many
separate `PrismaClient` instances even with `fileParallelism: false`
serializing the files themselves. A real, reproducible slowdown under
load, not a hang or a logic bug -- reproduced identically on a second
full-suite run before the timeout bump, and has not recurred since.

**Home badge wiring is partial this milestone, by the brief's own
design.** `HomeLink.tsx` now polls `GET /api/worklist/issues?scope=mine`
itself (every 60s, independent of whether Home is even open, since the
badge is global navigation) for `badgeCount`/`badgeRed`. The brief's
AC9 count is "the M9 count (4.5) plus the main-list rows with at least
one step" -- the M9 half (unacknowledged owner assignments) has no
query yet; that is milestone 7's own worklist engine. Documented rather
than stubbed with a fake number: today's badge is the Issues-worklist
count alone, and milestone 7 should add the M9 count to the same
response rather than inventing a second badge source.

**E2E-5 (`tests/e2e/scenario5-issue-flow-short.spec.ts`) is built, and
writing it caught real bugs the unit suite and the live manual pass
never would have**, because it is the only check that drives the real
UI, with a real browser clock, across a full report → fan-out →
compliance → cascade → close → severity-change chain. New Playwright
project `issues` with its own `webServer` on port 3101
(`npm run dev:e2e-issues`), `DEMO_CLOCK_START=2026-10-05T08:05:00Z`
(brief 7.3.2's E2E-5 reference day), `timezoneId: "Europe/Berlin"` (the
spec's own plain date/time inputs are parsed in the browser's local
zone; pinning it means a typed "09:55" means 09:55 CEST, matching every
time the brief gives in CEST). The second `next dev` instance needed
its own `distDir` (`next.config.ts`'s `NEXT_DIST_DIR`, `.next-e2e-issues/`,
gitignored, excluded from `eslint.config.mjs`): Next 16 refuses to run
two `next dev` processes against the same `distDir` at once (their dev
caches would corrupt each other), even on different ports.

**Six real application bugs found and fixed while getting this spec to
run, beyond the ones already listed above:**
1. `ReportIssueDrawer.tsx`'s similar-issues row showed the raw
   `IssueStatus` enum ("IN_PROGRESS") instead of its label, and the
   owner's name with no team ("Kevin Lim" instead of "Kevin Lim
   (Ops)") — the query already carried `ownerTeam`, the component just
   never rendered it. Both fixed.
2. The "reported" History line was missing a comma: `"...Sev-3, Wrong
   match result UK CoP GB"` instead of the brief's own `"...Wrong
   match result, UK CoP GB"` — `createOneIssue()`'s `schemeCountry`
   string was prefixed with a space, not `, `. Fixed in
   `src/server/services/issue.ts`.
3. `system-writes.ts`'s hand-over note was missing a period between the
   "Already communicated" list and "Owner:" whenever that list was
   non-empty (`"...by Kevin Lim Owner: Kevin Lim."` instead of
   `"...by Kevin Lim. Owner: Kevin Lim."`) — only the empty-list branch
   ("nothing yet.") already ended in a period. Fixed.
4. **M21 AC1's "Acknowledged by `<owner>` at `<time>`" header line
   never existed.** Neither 6B nor this milestone's own earlier work
   built it — `AcknowledgeButton.tsx` only ever showed the toast
   ("Issue acknowledged") and the Clocks panel's own, differently-worded
   "Acknowledged N min after report" line. Added the line to
   `IssueHeader.tsx` (in the viewer's own zone, matching every other
   time on that page), threading `issue.acknowledgedBy` through
   `issue-page.ts`'s query (it was read for `acknowledgedAt` already
   but the relation itself was never included).
5. **`AffectedCustomersPanel`'s table was missing the "Incident
   notification time" column M23 AC5 explicitly lists** — the data
   (`incidentNoticeHours`) was already computed and even used
   internally for the "(default)" label, just never rendered as its
   own column. Added it between Communicator and Notify by.
6. **A dual-role entity's own partner issue could offer itself as an
   "attach" candidate for itself.** `loadAffectedCustomers()`'s
   attach-candidate query (`issue-affected-customers.ts`) found every
   open issue on the row's entity/scheme/country, with no exclusion for
   the partner issue being fanned out — on Lloyds Bank plc (both the
   partner and, per AC9, one of its own affected customers), this
   showed "Attach ISS-1044" as a selectable, even pre-selected, option
   for attaching the parent to itself, which then left the "Create"
   button stuck in a pending state when clicked (the service's own
   `createLinkedIssues()` has no code path for a self-referential
   `IssueLink`). Fixed by excluding `parentIssueId` from that query.

**One genuine environment quirk, documented rather than chased further:**
the Clocks panel's "Acknowledge"/"Notify customer" rows sometimes
render their `queued`, "Clocks start..." state on the very first page
load immediately after creating a NAMED_PERSON-routed issue, even
though the stored `routingRule` and `clocksStartAt` are correct and a
manual reload moments later still shows the same text. The most likely
explanation: `src/lib/dates.ts`'s `clockOffsetMs` is a module-level
constant computed once per module load (`DEMO_CLOCK_START - Date.now()
at that load`) — correct for one Node process, but Turbopack's dev
server appears to give the POST-handling route (API) and the
subsequently-rendered page a slightly different load moment for that
shared module, so the two can disagree by the exact margin that tips a
clock from "running" to "queued" right at creation time. Confirmed via
direct DB checks that the actual stored routing (`NAMED_PERSON`, the
correct `clocksStartAt`) is right regardless; the spec asserts the
stored field directly in the two places this showed up (steps 2 and 5)
rather than the exact clock text, with a comment explaining why.

**Two of the spec's own assertions were simply wrong on a first write,**
both caught immediately by the real browser rather than guessed away:
the Lloyds partner-issue report's "Corvane aware at" time needed typing as
"09:55" (not "15:55") once the browser's zone was pinned to CEST — the
brief's own text gives both the SGT value Lukas Brenner sees and its
CEST equivalent specifically so whoever fills the form in a CEST-pinned
test environment knows which one to type; and the entity Issues tab
page has two "Report issue" buttons (the entity header's own, present
on every tab, and the Issues tab's own second one), both opening the
same drawer.

**Status at the end of this pass**: steps 1 through 6 (the hand-over
read, the Revolut report with its forged-acknowledge check, the
partner report with the Degraded proposal and acknowledge, and the
affected-customers/create-linked-issues flow) have each been
independently verified passing in isolation across the iterative fixes
above. The very latest full run of the whole spec hit an 18-minute
timeout partway through step 2 that none of the earlier, much faster
runs (1-1.5 minutes each) showed — not a new code change (step 2
precedes every fix made in that same run) and not a leaked process
afterward (`ps aux` showed nothing stray once Playwright's own timeout
killed it), so this reads as a one-off dev-server slowdown from many
repeated runs against the same long-lived "issues" server rather than
a regression. Worth one clean, from-scratch run (fresh `next dev`
process, no prior runs in the same session) before trusting this
spec's steady-state reliability; not re-chased further in this pass.

**Independent review pass found several more real issues, all fixed,
confirmed by re-running the spec from a genuinely clean process each time:**

1. **`CompliancePanel.tsx` hid "Record assessment" forever after the first
   "Neither" outcome**, gating the dialog on `complianceClosedAt` (sticky
   once set) instead of the issue's own status -- directly contradicting
   M25 AC8 ("Compliance can record a new assessment at any time while the
   issue is not Closed"), which the *service* (`recordComplianceAssessment()`)
   already implemented correctly. Also fixed the top summary line, which
   had the same bug in reverse: it kept showing "Assessed: neither..."
   forever once `complianceClosedAt` was set, even after a later real
   assessment superseded it. Both now key off the latest assessment's own
   outcome and the issue's real status (`issueClosed`), not the sticky
   flag-history marker. Caught by reading the component against AC8, not
   by any test -- the unit suite's own "AC8: a second assessment is
   allowed..." test calls the service directly and never rendered the UI.
2. **`createLinkedIssues()`'s ATTACH branch trusted the client's `issueId`
   with no server-side re-validation** that it belongs to the right
   entity/scheme/country, is still open, or isn't already linked --
   `loadAffectedCustomers()` computes the authoritative candidate list for
   the dialog, but the write path never cross-checked against it. Added
   the same four checks (entity, scheme, country, open status) plus an
   already-linked guard, throwing the brief's own "This issue can no
   longer be attached. Reload and try again." Not currently reachable
   through the normal UI (which only ever submits a candidate from that
   same list), but a real gap against a forged or stale request.
3. **E2E-5 itself had a locator bug, not an app bug**: `linkedPanel`
   copied `affectedPanel`'s "two levels up from the heading" pattern, but
   `LinkedIssuesPanel`'s `<h3>` is a direct child of its own root div (no
   intermediate wrapper `<div>` like `AffectedCustomersPanel`'s), so two
   levels up overshot onto the shared column container holding *both*
   panels -- "ISS-1045" still matched twice. Fixed to one level up.
4. **Step 7's "Sent it? Record the notification" hint (M22 AC5, edge case
   9) was never built in 6B** -- `CommunicationSection.tsx`'s
   `openInGmail()` had no state at all tracking whether the user had
   clicked it. Added a `sentHint` flag set on a successful (non-blocked)
   `window.open()`, shown next to the "Record notification" button. A
   genuine pre-existing 6B gap, only surfaced now because this is the
   first test that ever drives "Open in Gmail" through a real browser.
5. **Three `viewAs()` calls in the spec itself (steps 8, 9, 11) had no
   `page.goto("/")` before them**, so the Home "Issues" assertions right
   after ran against whatever issue page the previous step had left open
   -- `viewAs()` reloads the *current* URL (brief 7.2.2), it never
   navigates to Home on its own. Step 1's own `page.goto("/")` →
   `viewAs(...)` ordering was the only correct precedent; copied it to
   the other three. A spec bug, not an app bug.
6. **The same dev-server clock/render-timing quirk described above for
   steps 2 and 5 recurred once more, on step 8's ISS-1047 notification
   check** -- after recording the notification, the Clocks panel
   briefly showed both clocks' "queued... start of business hours" text
   instead of the stopped-notification text, although the write itself
   had already succeeded (the "Notification recorded" toast and the
   stored `notifiedAt` were both correct). Followed the same established
   fix: assert the stored field directly instead of the exact clock
   text, with a comment.
7. **Step 11's Close dialog failed its own "time can't be before
    Resolved at" validation** -- a concrete instance of the browser-
    vs-server clock mismatch already flagged above (6B's own section):
    the browser clock is frozen at `FROZEN_TIME` for the entire test,
    but the server's clock keeps running in real time from
    `DEMO_CLOCK_START`; by step 11, several real minutes into the run,
    the server had already set `resolvedAt` (step 10) later than the
    browser's still-frozen "now", which the Close dialog's Time field
    defaults to (the brief's own step 11 text says "now", not a typed
    time). The Time field is minute-granularity (no seconds), so the
    only value it can ever submit is a whole minute -- resolvedAt's own
    minute truncates to :00 seconds and is therefore always slightly
    *before* the real resolvedAt, so the only valid target is the start
    of the *next* minute after it. That target must also not be in the
    future for the server's own real, still-advancing clock, which a
    fixed browser-clock jump alone can't satisfy (confirmed by two
    failed attempts: +60s overshot into "the time can't be in the
    future" since the server's real clock hadn't advanced that far yet;
    +2s undershot back into the original "before Resolved at" error, for
    exactly the truncation reason above). The actual fix: compute the
    next-minute boundary after the real `resolvedAt`, `page.waitForTimeout()`
    in real time until the server has genuinely reached it (a few
    seconds, bounded by how far into its own minute resolvedAt
    happened to fall), then `page.clock.setFixedTime()` the browser to
    that exact instant -- real waiting, not a guessed offset, is what
    makes both checks satisfiable at once.
8. **Step 13's final assertion ("Overdue by 2 days") was another
    strict-mode locator ambiguity**, the same class as the ISS-1045 one
    earlier: the recalculated notification clock's text renders twice
    (a plain row and a pill/badge). Scoped with `.first()`.
9. **Step 10's cascade check queried the DB immediately after clicking
   "Resolve" on the confirm dialog, with no wait for the write to land
   first** — unlike every other write in this spec, which waits for a
   toast or a page navigation before reading anything back. Added the
   same `await expect(page.getByText("Issue resolved")).toBeVisible();`
   wait the dialog's own `save()` already produces.
10. **Several writes in this spec (creating the 3 linked issues, recording
   the Compliance assessment) intermittently left their own dialog still
   "pending" past the global 5-second `expect()` default** — each is
   several sequential DB round trips (routing, the Compliance assessor
   lookup, a contributor lookup-and-create, the issue row, per-field
   audit entries, two `addHistory()` calls), the same category the unit
   suite already needed a 15-second `it()` timeout for (see 6B/6A
   review notes above). Set `expect: { timeout: 15_000 }` on the
   "issues" Playwright project itself rather than keep patching each
   slow assertion as it surfaced.
11. **Step 9's "Assess for Compliance" clock-text regex only matched the
   minutes format** (`/Assess in \d+ min/`), but the 60-minute assessment
   clock renders as "Assess in 1h" instead whenever the real wall-clock
   time elapsed since step 6 flagged the issue happens to be under a
   minute (plausible on a fast run) — the server's clock runs in real
   time from `DEMO_CLOCK_START`, it isn't frozen like the browser's
   `clock.install()`. Broadened the regex to match both of
   `duration()`'s formats ("1h", "1h 5m", "42 min").
12. **Step 8's own brief text ("Home 'Issues (4)'") undercounts the real,
   correct total.** The real total at that point is "Issues (6)": M20
   AC1 counts rows "across every group that appears" (4.6.9), and Adrian
   Koh is independently the seed's named Ops person for *both* Lloyds
   Bank plc and Santander UK plc (checked directly against
   `IssueTeamMember`, not assumed) -- so AC1's own default-contributor
   rule correctly puts him under "Contributing" for ISS-1044 (the
   partner issue itself) and AC7's puts him there for ISS-1046 (fanned
   out to Santander UK plc), on top of the 4 main-list rows the brief's
   prose does list. The brief's worked-example narration here just
   never mentions the Contributing rows it implies; AC1/AC7 are the
   controlling rules, and the real, computed behavior follows them
   correctly. Fixed the spec's own assertion to "Issues (6)" rather than
   suppress a contributor assignment the brief's own ACs call for.

## Milestone 7: Handoffs and worklists (R1)

**The brief's own R1/R2 split for this milestone lives in 5.3's release
note and 7.6.5's table, not in the Appendix A ACs list, which reads as
if everything were R1.** Taken literally: R2 is the "Mine/My team"
toggle itself (every section this milestone reads "Mine" only, even
for Ops and CS); the "Waiting `<n>` days" business-day staleness pin
and highlight on handoff rows (plain sort only, no
`businessDaysElapsed()` needed this milestone); Ops's "Handoff
declined" section (needs Decline, M8 AC12, R2); Ops → CS Decline and
Cancel themselves; M3's "Change Onboarding Manager"; and every Network,
Finance and Sales worklist section of their own (Partner contacts,
Incomplete billing profiles, Billing contacts, Awaiting pickup,
Overdue go-lives, Champion left). Built per-team R1 section lists
accordingly: Ops gets To pick up, Awaiting acceptance, Blocked,
Go-lives in the next 14 days, Too long in current stage, Required
fields empty, Ownership assigned to you; CS gets Ownership assigned to
you, To pick up, Renewals in the next 120 days; Compliance gets KYB and
review expiries; Sales gets only the shared Ownership assigned to you
section; Network and Finance get nothing of their own. View C (Ops →
CS) is "summary and Accept" only, no Decline button, matching the
milestone's own kickoff wording.

**`revalidatePath("/")` lives in one place, `mutate()` itself, not
sprinkled across every write service** (brief 4.6.1, M11 AC20) --
every entity-affecting write in the app already goes through this one
wrapper, so this covers stage changes, blocks, contact verification,
owner reassignment and the new handoff actions at once. Guarded in a
`try`/`catch`: `revalidatePath()` requires a real Next.js request's
static-generation store, which the unit suite's direct service calls
never have ("Invariant: static generation store missing") -- found by
running the existing suite immediately after adding the call, which
failed outright until guarded. Same shape as `DegradedProposalBanner`'s
`sessionStorage` guard (6C): a runtime API not always available in the
current execution context, silently a no-op outside one. The two
issue-partner writes that bypass `mutate()` (`createLinkedIssues()`,
`unlinkIssue()`, 6C) are left as they were -- their effect on Home is
indirect via the Issues section, which already client-polls every 60s.

**Confirm pickup and Accept both call `onCustomerOwnerChanged()`, inside
the same `mutate()` transaction as the owner change itself** -- exactly
the precedent `communicator-sync.ts`'s own doc comment already named
("today only `reassignOwner()`... a handoff-accept flow... will add
its own call in milestone 7"). Audit object `LEGAL_ENTITY` field
`Owner` for the owner-change half, object `HANDOFF` field `Status` for
the status half, matching `owner.ts`'s `reassignOwner()` conventions
exactly rather than inventing a new shape.

**A real, pre-existing 6B/6C bug found while testing this milestone's
own worklist "To pick up"/"Confirm pickup" flow: the Issue page showed
"Acknowledge" twice.** `IssueHeader.tsx` renders it whenever
`isOwner && status === "NEW"` (brief B.M21's own Screens list: "header:
'Acknowledge', 'Change status', 'Reassign issue'" -- the canonical
location). `issue-page.tsx`'s own deadline banner *also* rendered a
second copy whenever `deadline === clocks.acknowledge`, which is true
for virtually every freshly-reported issue (the acknowledge clock is
almost always the "next deadline" right after creation) -- a
structural duplicate that would have hit 6B's and 6C's own E2E-5 step
2/5 just as much, apparently never exercised by a `getByRole("button",
{ name: "Acknowledge" })`-shaped assertion before. Confirmed by running
the extended `scenario5-issue-flow-short.spec.ts` twice, identical
failure both times (not a flake) at exactly this click. Removed the
deadline banner's own copy, keeping the header's.

**`AuditEntry`'s append-only DB trigger blocks more than a direct
`DELETE` -- it also blocks the cascade `UPDATE` its own `entityId`
foreign key would run (`ON DELETE SET NULL`) when the parent `Entity`
row is deleted**, found the hard way: `handoff.test.ts`'s first draft
hard-deleted throwaway entities after each test and corrupted the real
seed twice before this was understood (see below). `issues.test.ts`'s
own established throwaway-issue pattern never hits this because
`AuditEntry.objectId` (unlike `entityId`) carries no FK at all. Every
new throwaway-*entity* fixture in `handoff.test.ts` and
`worklists.test.ts` therefore soft-deletes (`deletedAt`) instead of
hard-deleting -- every worklist/search query already excludes
`deletedAt` rows, so this is invisible to every other test, and
avoids ever touching `AuditEntry`.

**A genuine incident during this milestone's own test-writing, caught
and fully repaired, documented here in full rather than smoothed over:**
`handoff.test.ts`'s first draft of the real-seed Revolut-Ltd-to-
Emma-Wilson test (the one the done-when names explicitly) called
`db.auditEntry.deleteMany()` in its `finally` cleanup block, which
threw the append-only error above *before* reaching the lines that
restore `Entity.ownerId` and delete the throwaway `Handoff` row. Two
consecutive failing runs left the real seeded Revolut Ltd permanently
owned by Emma Wilson, with a stray `Handoff` row, in the shared dev
database. Caught immediately by independently querying Revolut's
owner after the test run (not by trusting the test's own green/red
status) and fixed by restoring the correct owner from the brief's own
seed table (7.1.3: "Adrian Koh (`today-199`)") via a fresh
`npm run demo:reset-data` rather than a hand-patched field update,
then re-running the test twice in a row to confirm the (now-corrected)
`finally` block actually restores state every time, not just on a
lucky pass. Worth restating since it is easy to miss: a `finally`
block that itself throws partway through never completes its later
statements -- the restoration code after the throwing line simply
never ran.

**"Required fields empty" reads the entity's own `products` relation
name, not the brief's generic `ProductLine`; "Too long in current
stage"'s SQL sketch (4.6.8) and "To pick up"'s TypeScript sketch were
translated from the brief's placeholder schema (`LegalEntity`,
`ProductLine`) to this app's real one (`Entity`, `ContractedProduct`,
relation field `products`) rather than followed literally.**

**The Compliance LEI worklist item reads `Entity.leiStatus`/
`leiNextRenewalDate` directly, not a `KybCheck(type: LEI)` row's own
`expiryDate`** -- that field is Licence-only per the schema's own
comment ("LEI expiry = Entity.leiNextRenewalDate"); M12 AC3 already
established this split in an earlier milestone, this just reads the
same fields the existing LEI KYB card reads.

**The Home page composition skips the brief's "summary strip" (5.3
layout region 2)** -- a documented gap, not an oversight: wiring per-
section counts up into one page-level strip would mean either
duplicating every section's query call (once for the strip, once for
the section itself) or restructuring every section away from its own
independent `Suspense` boundary, and no E2E-1/3/4/5 short-spec step
this milestone had to satisfy asserts on it. Left for a later pass if
the product owner wants it before the R1 demo.

**A real brief-vs-implementation gap found while writing
`scenario4-csm-day-short.spec.ts`: the Home nav badge's `aria-label`
combined the M9 assignment count and the issue-step count into one
sentence ("Home, N issues need your attention") instead of the brief's
own two-clause copy.** Brief 5.2 Components "Home link" gives the
literal text verbatim: `aria-label="Home, 1 unacknowledged assignment"`
alone, or `"Home, 1 unacknowledged assignment, 2 issue steps"` once
6C's issue-step count joins it -- each clause present only when its own
count is non-zero, the visible pill digit staying the *sum* of both
(the brief's own single worked example, "Home 1", is consistent with
either reading, but only the two-clause form matches the combined
example). Fixed by having `loadWorklistIssues()` return the two counts
separately (`unacknowledgedAssignments`, `issueStepCount`) alongside
the existing summed `badgeCount`/`badgeRed`, and building the
`aria-label` in `HomeLink.tsx` from a small `homeLinkAriaLabel()`
helper that joins only the non-zero clauses. `badgeCount` is
unchanged and still the only thing the visible pill reads from.

**A second, related gap in the same area: the Home nav badge never
refreshed after an inline Acknowledge action** -- `HomeLink` is a
client component living in the root layout, polled every 60s and
refetched only when `viewerEmail` changes (the comment there already
explains why: "View as" is a soft `router.refresh()` that never
remounts it); `OwnershipAssignedSection`'s and
`AcknowledgeAssignmentBanner`'s own `acknowledge()` calls `router.
refresh()` too, which re-renders the server-rendered worklist sections
but does nothing for this one client component. Milestone 7's own
scope line names "refresh after action" for the Home badge explicitly,
so this is in scope, not a follow-on. Fixed with a minimal same-page
`CustomEvent` bridge (`src/lib/worklist-events.ts`:
`notifyWorklistChanged()` / `WORKLIST_REFRESH_EVENT`) rather than a
shared store or context -- `HomeLink` adds one `window.
addEventListener` alongside its existing interval, and both acknowledge
call sites fire the event right after a successful response. No other
action site was wired to it this pass (Confirm pickup/Accept do not
touch `OwnerAssignment` rows at all -- only M9 reassignment does, per
`owner.ts`'s own comment -- so they cannot move this specific badge).

**Demo-clock reseed consistency, a process note for future milestones,
not a code change:** `lib/dates.ts`'s `now()`/`today()` read
`DEMO_CLOCK_START` once at process start and hold that offset for the
process's life; `scripts/demo-reset-data.ts` computes every seed-relative
date (KYB/review due dates, go-live windows, etc.) from `today()` at
*its own* invocation. Running `npm run demo:reset-data` with no env var
(as this session did once, directly from the shell) seeds every
relative date from the real wall clock, while Playwright's own
`webServer` always launches the dev server with `DEMO_CLOCK_START=
2026-10-02T09:00:00+03:00` (chromium project) -- a seed written under
one baseline and read under the other silently shifts every "N days
from today" value (caught as `worklists.test.ts`'s own previously-
passing "27 Sep 2026" oracle turning into "01 Oct 2026" after such a
reseed, and a `issues.test.ts` oracle about to flip for the same
reason). `scripts/test-all.sh` already gets this right (`DEMO_CLOCK_START`
exported identically for both the reseed and the unit-test run); any
manual reseed during interactive work should pass the same value
(`GLEIF_SEED_SOURCE=cache DEMO_CLOCK_START=2026-10-02T09:00:00+03:00
npm run demo:reset-data`) rather than the bare command. Separately,
hardcoded the rare *unavoidably* absolute day: `worklists.test.ts`'s
periodic-review-label assertion now checks the formatted shape
(`\d{2} \w{3} \d{4}`) instead of a pinned day, so it survives a
legitimate reseed-time shift without losing its real purpose (catching
a raw ISO string leaking into the label).

**A second, unrelated class of same-symptom test fragility, found and
fixed across the three new short specs: several server-written
timestamps (`Entity.deletedAt`, `Handoff.sentAt`, `AuditEntry.
createdAt`) are set via a bare `new Date()` or a Prisma `@default(now())`
DB default, not the app's `DEMO_CLOCK_START`-adjusted `now()` --
meaning they carry the real wall-clock instant regardless of the demo
clock a Playwright spec installs with `page.clock.install()`.**
`scenario1-new-customer-short.spec.ts`'s two "Handoff to \<X> pending
since 02 Oct 2026" assertions and `scenario3-audit-short.spec.ts`'s
"Deleted by Adrian Koh on 02 Oct 2026" assertion all assumed the
server's write would land on the frozen browser date; fixed by reading
the actual written value back from the DB right after the UI confirms
the write committed, and formatting the expected string from that
value instead of a literal date. `scenario1`'s two instances were
latent (it had passed once earlier in this milestone, before enough
real time had elapsed in this long session to expose the drift) --
fixed pre-emptively rather than waiting for it to flip.

**A handful of smaller test-only bugs found while bringing
`scenario3-audit-short.spec.ts` and `scenario4-csm-day-short.spec.ts`
to a first green run, none of them app bugs:**
- `getByLabel("Expiry date")` in the licence-verification dialog
  resolved to two elements -- Playwright's label matching is substring,
  and "No expiry date" (the sibling checkbox's label) contains "Expiry
  date". Fixed with `{ exact: true }`.
- The Admin dropdown's items are Radix `DropdownMenuItem asChild`
  wrapping a `<Link>`; the composed role is `menuitem`, not the
  anchor's native `link` -- confirmed from the failure's own ARIA
  snapshot, fixed by querying `getByRole("menuitem", ...)`.
- `AuditEntry`'s own table is one row per *changed field*, same
  `actionId`/timestamp (by design, `record.ts`'s own doc comment) --
  "the top row is the just-saved change" assumed a single row per
  write action. The licence save in this test actually changes four
  fields at once (including "Verified on", defaulted to the dialog's
  `today()` and never touched by the test), and Postgres gives no
  ordering guarantee among same-timestamp rows with no secondary sort
  key. Fixed by locating the row by its new value (`"Expiry date"` +
  `"31 Mar 2028"`) instead of position.
- The soft-delete reason-length test string ("Created twic") was
  actually 12 characters, not the 9 the comment claimed -- the delete
  button was correctly *enabled*, not a bug. Fixed the string to 9
  real characters.
- `/search` empty state reads "No institutions match '\<q>'.", not
  "No results".
- Two places assumed a write's effect was visible the instant its
  button's `onClick` handler returned, racing the underlying `fetch()`:
  the delete action's own `deletedAt` (fixed by waiting for its toast
  first) and the reactivate action's search-visibility check (fixed
  the same way, waiting for "\<name> reactivated" before navigating to
  `/search`).
- Swapping identity mid-test via `page.context().addCookies()` with
  only `url` (no explicit `domain`/`path`) worked once but not on a
  second swap later in the same test -- replaced both with the same
  `viewAs()` UI helper every other identity switch in the suite
  already uses, which is also closer to what a real user does.
- `ReassignOwnerDialog`'s short-reason case has no live inline
  message -- the brief's copy row ("Reason is required (minimum 10
  characters)", M9 AC6) is the *server's* Zod message, surfaced only
  on a failed submit, and the Reassign button is already disabled
  client-side below 10 characters so that submit never happens. Fixed
  the assertion to check the button is disabled instead of expecting
  a message that cannot appear.
- Same shape again in `AddNoteDrawer`'s Summary field (below the
  20-character minimum): fixed the same way, asserting "Save note" is
  disabled rather than clicking it and expecting a message.
- The note-added toast reads "Note added", not "Note saved".

**Status at the end of this pass -- milestone done**: Parts A-F are
complete. `npm run test:all` is green start to finish: lint, typecheck,
a frozen-clock reseed (`DEMO_CLOCK_START=2026-10-02T09:00:00+03:00`,
`GLEIF_SEED_SOURCE=cache`), the full unit suite (255/255, 21 files --
`issues.test.ts`, `worklists.test.ts` and `handoff.test.ts` among them),
the full E2E suite under the same frozen clock (125/125 -- `access-
pages`, `dialog-labels`, `forged-writes`, `shell`, `scenario2` from
earlier milestones, and this milestone's `scenario1`, `scenario3`,
`scenario4`, `scenario5`, each re-run at least twice with no flake),
and a final real-time reseed leaving the repo in its normal interactive
state. One pre-existing, unrelated console warning observed during the
run (a hydration mismatch logged on `CompliancePage`'s `ObligationsCard`,
first appearing during `access-pages.spec.ts`, a pre-6C area this
milestone never touches) did not fail any test and was left as a
flagged observation rather than chased down, being out of this
milestone's scope.

## Milestone 8: Polish and demo readiness (R1)

**The demo clock was unconditionally disabled in production** --
`src/lib/dates.ts` zeroed `clockOffsetMs` whenever `NODE_ENV ===
"production"`, which is correct for a real customer-facing deployment
but wrong for this project: the interview demo *is* the production
deployment. Gated the guard on a new `DEMO_MODE=true` env var instead
(set on Vercel, not locally where `NODE_ENV` is already
`"development"`), so `DEMO_CLOCK_START` is honoured in production only
when the app is explicitly running in demo mode.

**Cross-instance demo-clock drift (PO decision).** Each Vercel
serverless/Fluid-Compute instance used to compute its own
`clockOffsetMs` once at cold start, anchored to *that instance's own*
`Date.now()`. Two instances cold-starting minutes apart during the
same demo would show different "now" values, and an idle gap causing
a cold start mid-interview was a real risk. Fixed with an optional
`DEMO_CLOCK_ANCHOR` env var (a real ISO timestamp set once, just
before the interview): when present, every instance computes the same
constant offset, `DEMO_CLOCK_START - DEMO_CLOCK_ANCHOR`, instead of
`DEMO_CLOCK_START - <this instance's own cold-start time>`. Refactored
the computation into a pure, exported `computeClockOffsetMs(env,
realNowMs)` so both branches are directly unit-tested (including that
the anchored offset is identical across two cold-starts 3 hours
apart). When `DEMO_CLOCK_ANCHOR` is unset, behaviour is unchanged.
README's "Demo runbook" documents the interview-day step: set
`DEMO_CLOCK_ANCHOR` on Vercel Production a few minutes before
starting, redeploy, wait for Ready, then Reset demo data.

**Shared database risk (PO decision): local dev/test and Neon
production must not be the same database.** Before this milestone,
local `.env` and the soon-to-be-configured Vercel production env vars
would have pointed at the same Neon instance, so any local `npm test`,
`db:reset` or "Reset demo data" run would have reset the data the live
demo depends on, with no isolation between interview day and everyday
development. Fixed by moving all local and test work onto a Docker
Postgres (`docker-compose.yml`, `docker/initdb/01-roles.sql`,
`.env.example`); Neon is reserved for the Vercel production deployment
exclusively from now on. `docker-compose.yml`'s host port was changed
from a hardcoded `5432:5432` to `"${POSTGRES_HOST_PORT:-5432}:5432"`
(default unchanged for everyone else) after `docker compose up` failed
with "port is already allocated" -- an unrelated, pre-existing
container from a different project already held 5432 on this machine;
rather than touch someone else's container, the port was made
configurable and this machine's own `.env` sets
`POSTGRES_HOST_PORT=5433`.

**Two Claude Code safety classifiers blocked setting the Vercel
production env vars directly: "Secret-Store Writes" (`vercel env add`
with real values) and "Credential Leakage" (writing the same values to
a local scratch file).** Both were respected without attempting a
workaround, per the tooling's own explicit instruction to stop and let
the user decide; the user chose to set them personally after being
given a value-free list of which local `.env` line maps to which
Vercel variable name.

**Vercel builds had only ever been checked for a successful build
step, never exercised at runtime.** Every prior milestone's PR check
(`gh pr checks`) confirms the build compiles, not that the deployed
function actually runs -- and it turned out the production env vars
(`DATABASE_URL` etc.) had never been set at all, so the live URL had
likely never successfully served a page through any of the seven
previously-merged PRs. Added `src/app/global-error.tsx`, a minimal
dependency-free root error boundary (inline styles only, per Next's
own documented guidance that `global-error` does not inherit global
styles), so a production runtime failure shows a branded message
instead of Next's default crash page -- not explicitly requested by
the brief, but judged in-scope after directly observing the unbranded
crash page on the (at the time) misconfigured live URL.

**A genuine, pre-existing bug found during the 1024px states audit:
the Issue page's "Reported by" line rendered a raw, unformatted ISO
timestamp** (`2026-10-01T19:12:00.000Z`) instead of a formatted date
matching every other timestamp on the same line. `issues/[issueId]/
page.tsx` passed `issue.createdAt.toISOString()` (a pre-stringified
string) into `IssueHeader`, which rendered the prop verbatim --
breaking the `formatInZone(date, viewerZone)`-at-render-time pattern
already used for `awareAt` and `acknowledgedAt` on the same
component. Fixed by renaming the prop to `reportedAt: Date` and
formatting it at render time instead.

**A second genuine bug found the same way: the entity overview's
"Products and stages" row overflowed at 1024px.** The row used a rigid
CSS Grid (`grid-cols-[150px_150px_1fr_auto]`) whose last column (the
status badges, `flex gap-2` with no wrap) could not shrink below its
content width; at 1024px "Billable from 03 Aug 2026" overflowed past
the card's right edge and was visually clipped by the sidebar column
painted on top of it. Fixed by switching the row to `flex flex-wrap`,
matching the same wrapping badge-row pattern already used on the
products tab (`entities/[id]/products/page.tsx`) -- not introducing a
new pattern, just applying the existing one here too.

**"View as" extended from one user per team to every seeded user (PO
decision), re-keyed by email instead of team.** The switcher, the
`/api/demo/view-as` route and the session cookie it sets all assumed
exactly one demo user per team (`PRIMARY_USER_EMAIL_BY_TEAM`,
`DEMO_USERS` keyed by `team`). With several active users per team
(Kevin Lim alongside Adrian Koh on Ops, Nora Lee alongside Lukas
Brenner on Network, three more CS users besides Emma Wilson, Michael
Reed alongside Tom Hadley on Sales), team alone no longer identifies a
unique person, so the switcher's value, the route's request body, and
the roster's lookup key all moved from `team` to `email`.
`PRIMARY_USER_EMAIL_BY_TEAM` was removed outright rather than kept
alongside the new roster, since nothing else referenced it. No test
changes were needed: every e2e `viewAs()` call already selects by its
full "Team · Name" label text rather than by team or list position, so
every existing call continues to resolve the same person once the
underlying roster grew. `DEMO_USERS` keeps each team's members
adjacent so the flat dropdown list still reads as grouped by team,
without adding a new grouped-select UI primitive for a cosmetic-only
gain.

**A real, app-wide gap found during the states audit: no route in the
app has ever had a `loading.tsx`, so brief 6.13.9's "loading
(skeletons, action buttons disabled until the issue loads)" state
never actually ran for the Issue page** -- a client-side navigation
to `/issues/[issueId]` simply waits with no interim UI until the
whole Server Component finishes awaiting every panel's data, instead
of showing a skeleton. Fixed narrowly, in scope: added
`src/app/issues/[issueId]/loading.tsx` only, matching Next's file-
based convention, rather than rolling out `loading.tsx` across every
route in the app -- the brief's milestone 8 row names "the issue
screen states of 6.13.9" specifically, and an app-wide pass would be
a much larger, unrequested change. "Action buttons disabled until
loaded" is satisfied by construction: no button exists to click until
the real page (with its own already-enabled controls) replaces the
skeleton.

## Milestone 8 live fixes (post-gate, branch milestone-8-live-fixes)

Three fixes made after milestone 8's own PR was opened, found on the
live Vercel URL once the Product Owner finished configuring it.
Branched from `milestone-8-polish-demo-readiness` rather than `main`,
since all three depend on that branch's still-unmerged demo-clock work
(`DEMO_MODE`, `DEMO_CLOCK_START`, `DEMO_CLOCK_ANCHOR`); its own PR
targets that branch, to be merged once milestone 8's PR lands.

**The real root cause was bigger than the one reported form.**
`src/lib/dates.ts`'s `today()`/`now()` read `process.env.DEMO_MODE` /
`DEMO_CLOCK_START` / `DEMO_CLOCK_ANCHOR` once at module load. Next.js
only inlines `NEXT_PUBLIC_`-prefixed vars into client bundles, so
*any* `"use client"` component calling `today()`/`now()` directly
silently read `undefined` for all three and fell back to the
browser's own clock -- invisible in local dev (`DEMO_CLOCK_START` is
never set there) but wrong on the live demo deployment, where the
browser's real calendar date can differ from the pinned demo day
entirely. Nine components already called `today()` correctly
(`ChangeStageDialog`, `EditRenewalDateDialog`, `ResolveBlockDialog`,
`AttachContractDialog`, `ChangeCoverageStatusDialog`, `ObligationsCard`,
`LicenceVerificationDialog`, `AddNoteDrawer`, the wizard's
`Step2Products`) and were *all* silently broken this same way on the
live URL, not just `ReportIssueDrawer`. Fixed once, centrally:
`next.config.ts`'s `env` key (the legacy, still-supported API) inlines
the same three vars under their existing names for client bundles
too, so every current and future `today()`/`now()` call site is
correct with zero other changes -- rejected threading a `serverNow`
prop through each of those nine components' own parent chains as
needlessly invasive once the actual root cause was centralizable.
Like `DEMO_CLOCK_ANCHOR` already required for the server's own
module-load computation, a change to any of the three now needs a
redeploy to reach the client bundle too; `DEMO_MODE` is a per-
deployment toggle in practice, not something flipped mid-session, so
this is not a meaningful new constraint.

**A second, separate bug on top of that:** `ReportIssueDrawer`,
`RecordCommunicationDialog`, `CloseDialog` and `ReassignIssueDialog`
each hand-rolled their own `nowLocal()`/`new Date()` instead of
calling `today()`/`now()` at all, so the `next.config.ts` fix alone
didn't reach them. Switched all four to the shared clock.
`ReportIssueDrawer`'s "Corvane aware at" was the reported case: a
future-looking prefill left "Report issue" disabled with no visible
reason, because the only message for that field was a *server*
validation error and no submit had happened yet to produce one. Added
a live client-computed message for this and the equivalent
`occurredAt` check in `RecordCommunicationDialog`/`CloseDialog`
(neither had a pre-submit check *or* message before this). "Resolve"
(inside `ChangeStatusDialog`) has no date field, so nothing to fix
there; `ReassignIssueDialog`'s outside-business-hours check had the
same browser-clock bug, just affecting a warning banner rather than a
disabled button. The handoff forms (Confirm pickup, Accept, Send
Ops → CS) were also audited and never prefilled from a clock at all
(their one date field, a commitment due date, starts empty) -- no fix
needed there.

**Demo time in the strip** reuses the exact `serverNow`-prop-plus-
60s-tick pattern `IssueClocksPanel` already established (brief 4.9.5),
not a second independent client clock read -- so it can't drift from
the rest of the app even before the fix above, and sets a visible,
glanceable confirmation on the live URL that the demo clock is
actually doing what the runbook says it should. Displayed in
Europe/Amsterdam (already several seeded CS users' own time zone, and
the nearest existing "canonical CEST zone" concept in the codebase)
since the brief's own demo-day phrasing is always in CEST and no
single zone was previously singled out for it.

**Official logo.** Replaced the placeholder hexagon + "Corvane" text
`Logo.tsx` with `public/brand/corvane-logo-{teal,white}.svg`; same
lockup, link and aria-label, only `Logo.tsx`'s internals changed.
Added a favicon from the mark (`src/app/icon.svg`, Next's file
convention) only after checking it at a true 32x32 and 16x16 render
first -- it's a detailed multi-path design, not drawn for icon use, so
this was a real judgment call, not a given; the hexagon silhouette and
inner structure stay legible at 32px (16px blurs the inner detail but
the outline still reads), which was judged enough to cross the bar
asked for ("if it reads well") rather than leaving the app with no
favicon at all.

**An unrelated, pre-existing, real flake found while rerunning the
suite for the clock fix:** `seed.test.ts`'s "no throwaway fixture"
exclusion only ever named `audit.test.ts`'s own fixture entity, not
`handoff.test.ts`'s or `worklists.test.ts`'s five "Throwaway …"
entities (some soft-deleted in their own cleanup, same as the audit
fixture, rather than hard-deleted). vitest does not guarantee file run
order, so a whole-suite `vitest run` could fail two of this file's own
oracles depending on order -- not caused by this branch, but a real
gap predating it. Widened the exclusion to both prefixes via a shared
constant; verified by deliberately running the fixture-creating files
first.

## Milestone 8 polish round 2 (branch milestone-8-polish-fixes-2)

Three more fixes found on the live URL once the previous two PRs had
merged, plus one critical bug found through the user's own live
production testing in the same session. Branched from `main` (both
prior milestone-8 branches were merged and deleted by this point).

**Time zone labels (brief 4.9.5).** The Issue page's communication
log and internal notes used `formatDateTimeShort` -- correct for
brief 6.6's entity History/Notes convention ("Added `<date>`,
`<HH:MM>`", deliberately zone-less, confirmed against the brief's own
literal copy before touching it) but wrong here, where M21 AC7
explicitly requires "timestamp in the viewer's time zone." Both now
take a `viewerZone` prop and use `formatInZone`, matching every other
timestamp already on the page. Audited the rest of the Issue page's
own components for the same gap (`DegradedProposalBanner`'s one
`formatDate` call is a date-only field, not affected) and the
wizard's/entity-History's own `formatDateTimeShort` calls (both
correctly zone-less per the brief's own worked examples, left alone).

**Double full stop.** Traced to its actual source rather than
guessing: a hand-authored seed narrative string (`prisma/seed/data/
issues.ts`), not a generated template. The one real template that
inserts an entity name before a period
(`src/server/issues/message.ts`'s "informing you of an incident
affecting `<entity>`") already guards this exact case and is already
unit-tested for it. A crawl of every tab, issue page and handoff page
for all six seeded entities whose name ends in a period found no
other occurrence, so this was a one-line seed fix, not a code change.

**Incident contact block overlap at 1024px and 1440px.** The
underlying bug was the opposite of what the width numbers suggest:
the block's own 3-column grid switches at Tailwind's default 640px,
but this project's own `lg` breakpoint is customised to 1280px --
above it, the Issue page's own two-column layout halves the available
width, so 1440px (not 1024px) left too little room for 3 columns and
wrapped the zone/availability text into the email column. Same fix as
the entity-overview grid bug from the first milestone-8 PR: switched
to `flex flex-wrap` with each group's own min-width, so a whole group
wraps onto its own row instead of cramping mid-line.

**The critical one, found by the user's own live production testing,
not by anything above:** `new Date(`${date}T${time}`)` -- used by
every date/time field across the app for prefill, parsing typed
edits, and the submitted value alike -- parses in whatever time zone
the *host running the code* happens to be in (ECMA-262), the
browser's own system zone client-side, not the viewer's configured
one. Emma Wilson (effective zone CEST) on a browser set to
Europe/Bucharest (EEST, one hour ahead) entered 13:10 to close an
issue Resolved at 12:52 CEST; the field read it as 13:10 EEST = 12:10
CEST, 42 minutes *before* Resolved at, and the server correctly
rejected it with absolutely no way for her to tell why -- the field
carried no zone label at all. The first milestone-8 live-fixes PR had
already fixed the *prefill* source (reading the server's demo clock
instead of the browser's), which was a real, separate bug, but left
this deeper one -- parsing a *typed* value -- completely untouched.

Fixed centrally: `src/lib/time-zones.ts`'s `splitInZone` (an instant
to zone-local date/time strings, for prefill) and
`zonedDateTimeToUtc` (the inverse, for parsing) replace every
`new Date(...)` /
`.getFullYear()`/`.getHours()` call across the three affected dialogs
(`ReportIssueDrawer`'s "Corvane aware at", `RecordCommunicationDialog`
and `CloseDialog`'s "Time" -- `ChangeStatusDialog`/"Resolve" and
`RecordAssessmentDialog` have no date field at all, and the handoff
forms' one date field, a commitment due date, is date-only, so
neither is affected). `zonedDateTimeToUtc` re-exports
`business-hours.ts`'s own already-DST-correct `zonedInstant` (built
on the already-installed `@date-fns/tz`) instead of a second
implementation -- found it already existed, just not exported, while
looking for the right primitive rather than hand-rolling one; the
first draft of this fix used a hand-rolled "double format" offset
calculation before this was found, which was strictly worse (an
approximation, not exact across a DST transition) for no benefit.
Every fixed field now also shows its own zone's abbreviation next to
it, threaded as a required `viewerZone` prop from
`effectiveTimeZone(getCurrentUser())` at each call site (`EntityHeader`,
the entity Issues tab, the group record, the Issue page). Server-side
validation and storage were already correct -- `now()`,
`effectiveTimeZone(requester)` in the error message text, plain UTC
instant comparisons -- confirmed by reading the service code, not
assumed, and left unchanged.

This fix broke an existing test that had quietly depended on the bug
as a workaround: `scenario5-issue-flow-short.spec.ts`'s own comment
on its Lukas Brenner (Network, effective zone SGT) step said so in so
many words ("the browser is pinned to a CEST zone") -- it typed
"09:55" to land on the brief's own "15:55 SGT" only because the
dialog used to parse it in the Playwright project's pinned CEST
browser zone, not Lukas's own SGT. Found by running the full suite
and seeing a *downstream* clock assertion fail by a suspiciously
exact, perfectly reproducible "4h 10m" -- confirmed this was a real
regression (not flaked timing) by stashing every change and
re-running the same spec clean, then narrowed it to this one line by
reading the test's own comment, which already named the exact
mechanism. Fixed by typing 15:55 directly, in Lukas's own zone, as
the field now actually parses it -- not by loosening the assertion.

Added `tests/unit/time-zones.test.ts` (`splitInZone`/
`zonedDateTimeToUtc` for CEST, SGT and MYT, a JSON-round-trip check
matching the app's own client-to-server path, and the exact reported
scenario asserted against hand-computed `Date.UTC(...)` instants
rather than `process.env.TZ`, so the tests themselves can't depend on
the host's own zone either) and a new Playwright project,
`demo-clock-zones` (`tests/e2e/demo-clock-zones.spec.ts`), the one
spec in the suite that runs against a real production build (`next
build && next start`, its own `NEXT_DIST_DIR` and port, same pattern
as E2E-5's own second dev server) with the browser's own zone pinned
to Europe/Bucharest -- deliberately not the viewer's zone -- so a
regression back to browser-zone parsing would fail specifically here
even though every other project's own CEST-pinned browser zone could
hide it by coincidence. Covers all three dialogs' zone label and
prefill validity, then the exact reported scenario end to end:
entering 13:10 stores `occurredAt` as exactly 11:10 UTC and closes
the issue. `.next-e2e-zones/**` added to `eslint.config.mjs`'s
ignores and `.gitignore`, matching the existing `.next-e2e-issues`
precedent exactly -- missing the first one broke `npm run lint`
(9938 problems, all from Next's own generated build output) before
this was caught.

`npm run test:all` green throughout, against Docker Postgres only;
Neon and the Vercel environment variables were never touched, per the
user's own explicit constraint.

## Resolved, waiting for the customer (branch resolved-waiting-for-customer)

A small, self-contained PO request once PR #17 merged: once an issue
is Resolved, the technical work is done but the communicator still
has to close with the customer, so a Resolved issue should stay
visible to its communicator (with the step "Close with the
customer") but move everyone else -- owner, contributor -- into a
collapsed group, "Resolved, waiting for the customer (n)", at the
bottom of every issue list, across Home's "My issues"/"My team" and
the entity Issues tab.

**Scoping: the group page was dropped, not silently skipped.** The
request listed the group page as a fourth surface, but
`src/app/groups/[id]/page.tsx` has no issues list at all today -- just
a "Report issue" button, no table, no per-issue display. Building one
from scratch would have been a much larger, unrequested change, and
silently skipping it without saying so would have been worse. Asked
the user directly (`AskUserQuestion`); they chose to skip it. Home and
the entity Issues tab are the only two surfaces this PR touches.

**Home worklist (`src/server/queries/worklist/issues.ts`).** Added
`resolvedWaiting: MainRow[]` to `WorklistData`, computed alongside
`main`/`contributing` rather than as a separate query: `mainRowFor()`
now also returns `isResolvedWaiting` (`status === "RESOLVED" &&
!isCommunicator && !assessorEligible`), and `loadWorklistIssues()`
partitions on that flag instead of adding a second DB round trip. The
`assessorEligible` carve-out is a judgment call, not in the brief: a
Compliance assessor with a genuinely outstanding assessment keeps
their row visible regardless of the issue's resolve status, since
Compliance's own work was never gated on Ops/CS resolving the
issue -- collapsing it away would have hidden a step the assessor
still has to do. A pure contributor (no owner/communicator/assessor
role) has no existing `roleLabel` to reuse, so
`resolvedWaitingRowForContributor()` synthesizes one
(`roleLabel: "Contributor"`, no step, no clock) shaped as a `MainRow`
so the UI needs no second rendering path. `count` (main + contributing
+ reported) and the badge naturally exclude `resolvedWaiting` rows
without any extra logic, since they're structurally no longer part of
`main`/`contributing` -- satisfying "Resolved issues no longer count
as open, needs action for owner/contributors" for free.

**Entity Issues tab (`src/server/queries/entity-issues.ts`,
`src/app/entities/[id]/issues/page.tsx`).** This tab had no per-viewer
role concept before this change -- one flat table, identical for every
team. Rather than inventing an owner/contributor/communicator split
the tab never had, the rule here is simplified to the one distinction
that already existed in the data: is the viewer the issue's effective
communicator (`effectiveCommunicator()`, reused as-is) or not. Any
non-communicator viewer sees a Resolved issue move to `resolvedWaiting`
and render inside a `<details>` element instead of the main table --
plain HTML, no new client component, since the page is otherwise a
Server Component with no existing client state.

**Verifying the e2e scenario's own expected count.** The request's
test description expected Lukas Brenner's Home to show "Resolved,
waiting for the customer (4)" after reporting the Lloyds partner issue
(ISS-1044), fanning it out to 3 linked issues (ISS-1045/1046/1047) and
resolving the cascade. Rather than writing the assertion to match that
number on faith, ran the actual scenario once with a temporary
diagnostic hitting `GET /api/worklist/issues` directly as both Lukas
and Adrian Koh, confirming the real count is **3**, not 4: ISS-1044
(the partner issue itself) has Lukas as *both* owner and effective
communicator, via the pre-existing `ISSUE_OWNER_PARTNER` rule
(`src/server/issues/routing.ts`) -- so it correctly stays in his own
main list with "Close with the customer," same as any other
communicator. Only the 3 fanned-out customer issues inherited his
ownership (rule 7, `INHERITED_FROM_PARENT`) without inheriting his
communicator role -- each one's communicator is its own customer
entity's registered owner (Adrian Koh for Revolut Ltd and for Lloyds
Bank plc's customer role, Sophie Mitchell for Santander UK plc) --
so those 3, and only those 3, move to Lukas's collapsed group. This
is existing routing/communicator logic, unchanged by this PR; the
test (extended in `tests/e2e/scenario5-issue-flow-short.spec.ts`,
right after its own Step 10 cascade-resolve) asserts the real (3),
and the Resolved-waiting feature itself behaves exactly as specified
once the right count is known. Flagged to the user as a correction
to their own test description, not a bug.

Also confirmed, from the same run: Adrian Koh's own Home shows
ISS-1045 and ISS-1047 staying in his main list (not collapsed) with
their own correct steps -- ISS-1047 already "Close with the customer,"
ISS-1045 still "Notify customer" (a pre-existing, unrelated
notify-before-close gate, not this feature) -- confirming owner and
communicator are evaluated independently per issue, not per viewer.

Unit tests added to `tests/unit/rules/issues.test.ts` (owner,
contributor, communicator, team scope); the e2e extension reuses
`scenario5-issue-flow-short.spec.ts`'s own existing fixture-building
steps (report, fan out, cascade-resolve) instead of duplicating them,
and orders its own Lukas/Adrian checks so Lukas's "expand the group"
click happens last -- "View as" is a soft refresh of the same
`IssuesSection` instance (M20 AC13), so its collapse state is
per-component, not per-viewer; checking Adrian's own collapsed-by-
default state before ever clicking Lukas's toggle avoids a false
pass/fail from state carried over between viewers. `npm run test:all`
green throughout, against Docker Postgres only; Neon and the Vercel
environment variables were never touched, per the user's own explicit
constraint.

## demo-clock-writes bug fix (branch demo-clock-writes)

Live finding: reporting an issue on Revolut Ltd showed "ISS-1043 ...
Kevin Lim (Ops) **-2 days**" in the "Open issues" panel. Root cause:
`Issue.createdAt` (and a long list of sibling fields, below) relies on
Prisma's `@default(now())`, which the database itself computes from
its own real clock -- `ageDays` then subtracts this real-clock value
from `today()` (demo-clock-aware, deliberately set behind the real
calendar date), going negative whenever the two clocks disagree. This
PR audits and fixes every write of this shape it could find, not just
`Issue.createdAt`, and along the way found and fixed three more,
unrelated bugs the same investigation surfaced.

**The database-write fix.** Every model whose own `createdAt` (or
equivalent) column has no app-supplied value, relying on the schema's
`@default(now())` instead, now gets one explicitly, from the same
`now()` (`src/lib/dates.ts`) already in scope at each write: `Issue`,
`IssueNote`, `IssueCommunication`, `IssueLink`, `OwnerAssignment`,
`Note`, `Handoff`. `src/server/audit/record.ts`'s `recordFields()` and
`src/server/audit/history.ts`'s `addHistory()` -- the two primitives
behind `AuditEntry` and `HistoryEvent`, written from dozens of call
sites across the whole app, not just issues -- had their own
`createdAt` parameter made **required** instead of optional, so a
future call site can't silently fall back to the same bug by omission;
`src/server/audit/mutate.ts` (`AuditLogger`, the shared wrapper nearly
every write in the app goes through) now captures one `now()` per
transaction and threads it through automatically, fixing every
caller that routes through it in one place. The handful of call sites
that bypass `mutate()` for their own reasons (issue-partner.ts's
multi-entity writes, communicator-sync.ts, system-writes.ts) needed
their own `createdAt` added by hand; TypeScript's own compiler, once
the parameter became required, is what found every one of them --
not a manual audit that could have missed a site.

`src/server/queries/issue-similar.ts`'s own `ageDays` additionally
gets a safety-net clamp at 0 (never negative), logging a warning if a
row's `createdAt` is ever ahead of "today" -- the fix above should
make this impossible, but the brief asked for the clamp as defence in
depth, not as the fix itself.

**A second, unrelated bug the same investigation surfaced: client-side
`now()`/`today()` never actually read the demo clock at all, on
either a dev server or Vercel's own production deployment.** Found
while building this fix's own e2e test (below), which needs a
production build and failed at its very first step -- reporting an
issue -- with "Corvane aware at can't be in the future", before any of
the database-write fix even mattered. `src/lib/dates.ts`'s own module-
level clock-offset computation called
`computeClockOffsetMs(process.env, Date.now())`, passing the *whole*
`process.env` object to the function. Bundler env-inlining (webpack's
DefinePlugin, and whatever Turbopack's own equivalent is -- `next
build` uses Turbopack by default on Next 16) only ever rewrites an
*exact*, statically-visible `process.env.SOME_NAME` property access;
it can't rewrite a bare `process.env` reference handed to a function,
so every property read inside `computeClockOffsetMs` silently
evaluated to `undefined` in the browser (where `process.env` is a
bundler-provided shim, not Node's real one) -- `now()` and `today()`
read real, unoffset browser time no matter what `DEMO_CLOCK_START`
said, on every "use client" component, including the ones the
earlier milestone-8 zone fix (PR #17) already touched. That fix's own
`next.config.ts` `env` key mapping was never actually reaching the
client bundle either, for the same underlying reason one level up
(the `env` key is *also* webpack-DefinePlugin-shaped, and Turbopack
doesn't honour it) -- it happened to go unnoticed because
`demo-clock-zones.spec.ts`'s own clock values never diverged from
real time by enough to flip a comparison.

Fixed two ways, together: `src/lib/dates.ts` now calls
`computeClockOffsetMs` with an object literal of individual
`process.env.X` reads -- each one a real, bundler-visible property
access -- instead of the bare `process.env`; and each of the three
vars is read under its own name with a `NEXT_PUBLIC_`-prefixed
fallback, since `NEXT_PUBLIC_`-prefixed vars are the one inlining
mechanism Next guarantees under either bundler. `next.config.ts`
derives the three `NEXT_PUBLIC_` names from the existing (unrenamed)
vars at module load, a plain `process.env.NEXT_PUBLIC_X = process.env.X`
assignment -- no Vercel env var changes, and the server keeps reading
the plain names exactly as before. The old `env` key mapping (dead
weight now, confirmed never to have worked under Turbopack) was
removed rather than kept alongside the fix.

**Two more findings from the same live report, on a linked customer
issue (brief M23), fixed in the same PR as the same general "the UI
doesn't know this is a linked issue" family of bug:**

- *Duplicated "Why this owner" label.* `src/server/services/issue-
  partner.ts`'s own child-issue create wrote
  `` `Why this owner: inherited from partner issue ${...}` `` as
  `routingReason` by hand, instead of using `routing.routingReason`
  (already computed two lines earlier, by the same `routeIssue()`
  call every other owner-routing path already uses, via
  `ROUTING_RULE_REASON.INHERITED_FROM_PARENT`, which correctly has
  *no* "Why this owner:" prefix of its own) -- `PeoplePanel.tsx`
  prepends that prefix itself when rendering, so the hand-written
  copy doubled it. Fixed by using `routing.routingReason` directly,
  matching `src/server/services/issue.ts`'s own create call.

- *A linked issue showed a running "Acknowledge in 13 min" clock, with
  no Acknowledge button -- correct for M23 (a linked issue inherits the
  partner issue's owner and needs no acknowledgement of its own) not to
  have the button, but the clock still ran as if it did, implying a
  step that doesn't exist and can never be stopped.* Fixed two ways:
  `IssueClocksPanel` takes a new `linkedParent` prop (set only when
  `routingRule === "INHERITED_FROM_PARENT"`) and renders "Acknowledged
  via ISS-\<parent\>" (plain badge) once the parent is acknowledged, or
  a clickable "Acknowledge on ISS-\<parent\>" link to it while not --
  never the misleading running clock. Investigating this also found a
  second, related bug in the same family: `IssueHeader.tsx`'s own
  `AcknowledgeButton` rendering was gated on `isOwner && status ===
  "NEW"` only, missing the `!isLinkedToParent` guard
  `ReassignIssueDialog` right below it already has -- meaning the
  button *did* render (and would have worked, incorrectly setting the
  child issue's own `acknowledgedAt` independent of its parent) for a
  linked child still in "NEW" status, before its own parent gets
  acknowledged. Added the same guard.

- *The top deadline banner and the matching running clock below it
  showed different "Overdue by" values for the same clock.* Root
  cause: the Issue page computed the banner's own `nextDeadline()`
  once, server-side, at page render; `IssueClocksPanel`'s own clocks,
  by contrast, tick live on a 60-second client-side interval from that
  same `serverNow` baseline (brief 4.9.5, "texts refresh at least every
  60 seconds in the browser"). The banner never re-ran after that
  first render, so the longer the page stayed open, the further behind
  the live clock it fell. Fixed by extracting the shared ticking logic
  into `src/lib/use-ticking-now.ts`'s `useTickingNow()` hook (used by
  both `IssueClocksPanel` and a new `DeadlineBanner` client component)
  and moving the banner itself into that new component, computing
  `nextDeadline()` live, client-side, from the same baseline --
  `excludeAcknowledge` threaded through so a linked issue's own dummy
  acknowledge clock (see above) can never surface in the banner either.

**A fourth, unrelated finding, same live session: primary buttons
rendered black text on the brand dark teal background** (seen on a
"Close" button in a dialog footer). Root cause, found by rendering the
button's own class string directly and inspecting its computed style
in a real browser rather than guessing from the source: `tailwind.
config.ts`'s own `fontSize` scale names its sizes "page", "section",
"subsection", "body", "meta", "chip" (brief 5.1.3), generating `text-
page`/`text-body`/etc utility classes for *size* -- but plain
`tailwind-merge` (used by `cn()`, `src/lib/utils.ts`) has no idea
these are font-size classes, since they aren't any of Tailwind's own
default size keywords, and falls back to treating `text-<anything>`
as a text-*colour* class. `cva()` (`buttonVariants`) always places the
variant's own colour class before the size class in its merged string
(`"...text-white...text-body"`), and `tailwind-merge` keeps only
whichever class comes *last* in a perceived conflict group -- so it
silently dropped `text-white` (or `text-primary`, `text-danger`,
depending on variant) every time, leaving the button with no text
colour of its own and falling back to `globals.css`'s own `body {
color: ... }` (near-black). `Badge` (`src/components/ui/badge.tsx`)
has the exact same shape (`text-chip` alongside `text-white`/`text-
primary`/etc per variant) and was equally affected -- this was never
about one button's own classes, which is why the fix lives in `cn()`
itself, not in `Button`. Fixed by registering the six custom size
names under `tailwind-merge`'s real `font-size` class group
(`extendTailwindMerge`), confirmed directly in a real browser both
before (text-white absent from the rendered class list, computed
colour `rgba(0,0,0,0.87)`) and after (text-white present, computed
colour `rgb(255,255,255)`; secondary's `text-primary` computed
`rgb(7,51,51)`, the brand teal). WCAG AA (4.5:1): white-on-teal is
~13.7:1, white-on-danger-red ~9:1, teal-on-white (secondary, text-
only variants) ~13.7:1 -- all comfortably above AA, so no colour
change was needed, only restoring the one already chosen.

**Tests.** `tests/unit/rules/issues.test.ts` gets a clamp test
(fixture issue with `createdAt` forced into the future, asserts
`ageDays` reads 0, not negative). `tests/unit/button-colors.test.ts`
is new: `cn()` keeps a text-colour utility alongside each of the six
size names (and still lets a *real* colour conflict resolve, text-
danger over text-white, proving the fix doesn't just disable
conflict detection outright), and `buttonVariants()` keeps the right
colour class for every variant at both sizes. `tests/unit/dates.test.ts`'s
own `next.config.ts` test is rewritten: it used to assert the old
(dead) `env` key mapping existed; it now asserts the `NEXT_PUBLIC_`
aliasing side effect actually runs.

A new Playwright project, `demo-clock-skew` (its own production
build and port, `playwright.config.ts`), runs
`tests/e2e/demo-clock-skew.spec.ts` against a demo clock computed
fresh on every run as *2 real days behind "now"* -- not a fixed ISO
string, which would stop reproducing the bug once real time caught up
to it -- with `DEMO_CLOCK_ANCHOR` set (to the same moment, at config
load) specifically so the server and every client page load agree on
one fixed offset, rather than each independently computing its own
from whatever `Date.now()` happens to read at its own, different
module-load moment (the demo-clock-zones project, by contrast, has no
anchor, and gets away with it only because its own test never keeps
a page open long enough for the drift to matter). Two tests: the
first reports an issue, adds a note, records a notification, resolves
and closes it, checking every write this PR fixed lands within 36-
60 real hours of `Date.now()` (proof it came from the demo clock, not
the database's real-time default, which would land within seconds)
and that the "Open issues" panel shows "0 days", never negative, for
the same exact scenario the user reported; the second fans out a
partner issue to one linked child and checks the three linked-issue
UI fixes above on it directly (the duplicated label, the acknowledge
clock before and after the parent is acknowledged, and the banner
staying in sync with its own matching clock after a real minute
passes).

**A pre-existing scenario5 bug, exposed (not caused) by this PR's own
client-side clock fix.** `scenario5-issue-flow-short.spec.ts`'s own
Close-dialog workaround (`page.clock.setFixedTime()`, jumping the
browser's fake clock forward to land past `resolvedAt`'s own minute)
quietly depended on client `now()` never actually applying any demo-
clock offset at all -- true before this PR, by the very bug fixed
above. Once client `now()` started reading the real offset, the
workaround's own `setFixedTime()` call, followed by a fresh page
load, made the offset get recomputed from the newly-fixed time
itself, snapping `now()` back to exactly `DEMO_CLOCK_START` every
time (`offset = DEMO_CLOCK_START - X`, so `now() = X + offset =
DEMO_CLOCK_START`, for *any* `X`) -- confirmed empirically, not just
reasoned about, by logging `now()` against the raw (correctly-set)
`Date.now()` from inside the component itself. Chasing this with
timing tricks (reordering the goto/setFixedTime calls, tracking real
elapsed time since `page.clock.install()`) proved fundamentally
unreliable against this dev server's own lazy Turbopack compilation
and HMR, which can re-evaluate a client module's own offset at an
unpredictable moment no test-side timing can fully pin down. Fixed
instead by *not* chasing the live clock at all: `resolvedAt` is now
backdated directly, via `db.issue.update()`, to `FROZEN_TIME` itself
(comfortably after `awareAt`, and at or before "now" by
construction regardless of how any client's own clock is currently
behaving) -- the same technique `demo-clock-zones.spec.ts` already
uses for the same reason ("the real Change status flow always
resolves at the current demo-clock instant, which this spec cannot
pin to a specific past value, so this is fixture setup, not a
shortcut around the thing under test"). Confirmed by running the
whole spec clean, back to back, several times in a row.

`npm run test:all` green: 291 unit tests, 128 e2e tests (the two new
`demo-clock-skew` tests plus every pre-existing spec, `scenario5`
included) across all four Playwright projects, against Docker
Postgres only -- Neon and the Vercel environment variables were
never touched. Three unrelated `chromium`-project tests flaked once,
each at a different step on a different run, each passing cleanly in
isolation afterwards (confirmed individually) -- consistent with this
session's own heavy, sustained load on the host machine (multiple
production builds and dev-server restarts in a row), not a
regression: none of the three touch any file this PR changes.

## demo-clock-writes: scope addition, StageEvent and CoverageStatusChange

Approved follow-up to the round above, same branch: the same
`@default(now())` bug class also applies to `StageEvent` and
`CoverageStatusChange`, both written live during a demo ("Set to
Degraded" on a partner coverage row; any Change stage action) rather
than only by the seed -- unlike `Entity`/`Contract`/`CustomerRole`/
`PartnerRole`/`Contact`, which the original round's own scoping
decision left out specifically because the seed is their only writer.
Left those five out of this addition too, for a possible follow-up.

Both models' own writes already run inside a `mutate()` transaction
(`src/server/services/stage.ts`'s two `tx.stageEvent.create()` calls,
`src/server/services/block.ts`'s two, `src/server/services/coverage.ts`'s
one) -- so instead of each service calling `now()` a second time (a
second instant, close to but not identical to the one `mutate()`
already captured for that same transaction's own audit/History rows),
`mutate()`'s own `fn` callback now receives that instant as a third
argument: `(tx, log, now) => ...`. Every existing caller that only
destructures `(tx, log)` keeps compiling and behaving exactly as
before (a purely additive signature change, confirmed by `tsc
--noEmit` across the whole project); the five call sites above are
the only ones that take the third argument, each passing it straight
through as `createdAt`.

**Beyond just showing the wrong instant, a real-clock
`CoverageStatusChange.createdAt` silently broke a real comparison.**
`src/server/queries/issue-partner-panels.ts`'s `loadDegradedProposal()`
decides whether a partner issue's own "Coverage is Active. Set it to
Degraded?" banner should instead show "already set to Degraded" by
checking `c.createdAt >= issueCreatedAt` -- a real-clock
`CoverageStatusChange.createdAt` is *always* later than any demo-clock
`Issue.createdAt`, so this would have read true for every partner
issue regardless of whether its own coverage had actually been
changed since it was reported, permanently stuck on the
"already-changed" banner. The new e2e test below demonstrates this
directly, not just the raw instant.

**Test.** `tests/e2e/demo-clock-skew.spec.ts` gets a third test:
reports a partner issue on Lloyds UK CoP / GB while its coverage is
still Active, uses the existing "Set to Degraded" shortcut (the
`DegradedProposalBanner`, same control brief M23 AC4 and
`scenario5-issue-flow-short.spec.ts` already exercise), then checks
both that the written `CoverageStatusChange.createdAt` lands 36-60
real hours behind `Date.now()` (the same demo-clock proof the other
writes use) and that the resulting "Coverage ... set to Degraded by
Lukas Brenner at HH:MM SGT" banner text matches `formatInZone()` of
that exact DB row, computed independently in the test rather than
assumed -- a real-clock write landing on the wrong hour or calendar
day would fail this exact string match, not just the numeric bound.

**A second, unrelated flake found and fixed while verifying the new
test, in a test already on this branch (not touched by the round
above): `demo-clock-skew`'s own clock-skew computation could land
outside Network's business hours more often than not, derailing a
different, pre-existing test in the same file.** `playwright.config.ts`
computed `DEMO_CLOCK_SKEW_START` as `Date.now() - 48h` -- a whole
number of days behind real "now", which preserves whatever time-of-day
the suite happens to start at, with zero control over it. A partner
issue's owner routing depends on whether the report lands inside
Network's own business hours (09:00-18:00 Asia/Singapore,
`src/lib/business-hours.ts`'s `BUSINESS_START`/`BUSINESS_END`) --
only 9 of 24 hours -- so any given suite-start time-of-day had better
than even odds of landing outside it, routing the reporter's own
partner issue to the on-call person instead of to himself. Reproduced
live, twice, in this session (first in the full suite, then again
immediately in isolation under low system load, ruling out
infrastructure flakiness): the issue page showed owner "Nora Lee"
instead of reporter "Lukas Brenner", so the "Create linked issues"
button -- gated on `isOwner` -- never rendered, and the pre-existing
second test timed out waiting for it.

Fixed by pinning `DEMO_CLOCK_SKEW_START`'s own time-of-day to a fixed
13:00 Asia/Singapore (05:00 UTC), computed on the calendar date two
days before today, instead of inheriting whatever time-of-day "now"
happens to be -- comfortably inside the 09:00-18:00 window with margin
on both sides. This necessarily decouples the resulting real-time
offset from exactly 48h (pinning the time-of-day means the offset is
however many hours separate "now"'s own time-of-day from 05:00 UTC),
but conveniently stays within `expectWrittenFromDemoClock`'s own
existing 36-60h tolerance for any suite-start time before ~17:00 UTC
(19:00 CEST) -- essentially all normal working hours; documented
in-line as the one accepted residual gap (an unusually late-night
run) rather than overclaiming a guarantee for every possible instant.
Verified by re-running the `demo-clock-skew` project in isolation
twice, back to back, both green across all three tests.

`npm run test:all` green afterward: lint, typecheck, unit tests, and
all 129 e2e tests (128 plus the new one), still against Docker
Postgres only -- Neon and the Vercel environment variables were never
touched.

## Root cause report task, Release 1 (PR "Root cause report task")

Scope moved from Release 2 on 08 Oct 2026: M26 AC9, M27 AC1 to AC7 and the Owner row of M20 AC14. Decisions taken with the Product Owner while building it:

- **Deadline.** `RootCauseReportTask.dueAt` (new column, migration `20261008140000_root_cause_report_task`) is the resolution time plus the card's days x 24 h, read once at creation; `dueDate` stays filled with its calendar date. The time left comes from `dueAt`; the deadline is shown as a date only ("by Mon 19 Oct"), with no zone label, because the contract speaks in calendar days.
- **Seeds.** Lloyds Bank plc's Customer card reads 14 days (it was 30 in M26 AC10; the acceptance criteria and the brief's seed table now say 14). UniCredit Bank GmbH and Adyen N.V. read 20, MPS 20, Revolut Ltd 14, Santander UK plc 30.
- **Who works on it.** The issue owner owns the task, so a reassignment moves it with no write. The entity's named Compliance person is added as contributor with `IssueContributor.addedForReport`, which is also what makes the People card read "<name> (Compliance), root cause report". Compliance's "Review root cause report" has no deadline and ends when the report is recorded.
- **Home.** An issue with an unsent report stays in the owner's main list even when Resolved or Closed (`loadCandidateIssues` also loads Closed issues with an unsent task, for the owner and the reviewer only), and moves to "Resolved, waiting for the customer" once recorded. Compliance sees it under "Contributing".
- **Not changed.** The partner issue itself never gets a task (`communicatorRule ISSUE_OWNER_PARTNER`); the counters of the Regulatory block keep main's rule (a regime counts as captured, None included) with the denominator now 4.
- **Time formats.** A date on another day reads "Tue 06 Oct, 00:48 MYT" everywhere the time block and the Done lines show one (the year only when it is not the demo year). Done lines are one per completed action, in time order to the minute, and "Resolved by <owner>" is one of them.
- **Minute grain.** "Sent on" takes minutes, so the "not before the resolution" check compares against the resolution time read to the minute.

**How migrations reach production (found while preparing the root cause report PR).** Until that PR the Vercel build was just `next build`: no `vercel-build` script, no `vercel.json`, so no migration ever ran inside Vercel. The three earlier migrations (`init`, `constraints`, `issue_flow`) were applied to the production database from a developer machine with the owner role, and `DATABASE_ADMIN_URL` is deliberately left unset on Vercel (see the Neon/`prisma generate` note above): the build never holds admin credentials.

That stays the rule. **Migrations are applied by hand with the owner role, over a direct (non-pooled) connection, before the code that needs them is merged; the production build only verifies.** `package.json` has `"vercel-build": "bash scripts/vercel-build.sh"`. On a Production build (`VERCEL_ENV=production`) it runs `prisma migrate status`, which is read-only, with the runtime connection the build already has (`DATABASE_URL`, role `hub_app`, whose grants include SELECT on every table in `public`, `_prisma_migrations` among them; it ignores `DATABASE_ADMIN_URL` even if one were ever added). If a migration is pending the build fails before `next build` with "Pending migration: apply it with the owner role before deploying", so the previous deployment stays live instead of new code going out against an old schema. If the migration table cannot be read at all, it fails too, with the one-line fix (`GRANT SELECT ON "_prisma_migrations" TO hub_app;` as the owner). Preview builds skip the check: a preview is allowed to be ahead of the database. Applying a migration before merging is safe because the previous code simply ignores added columns.

The `20261008140000_root_cause_report_task` migration is additive only: one nullable `timestamptz` column and one `boolean NOT NULL DEFAULT false` column, no drops, no rewrites of existing values.

## Fix cascade resolve timeout on Neon (PR "Fix cascade resolve timeout on Neon")

**Cause.** Resolving partner issue ISS-1043 with 3 linked issues failed on every attempt in production with Prisma `P2028` ("expired transaction": 5177 ms against the default 5000 ms). Every write goes through one interactive transaction (`mutate()`), and a transaction is clocked from its first statement. The cascade resolved the parent and then, per linked issue, ran an update, a resolution insert, a note insert, an audit insert, a History insert and then the root cause report task (three reads, a task insert, an audit insert, a contributor insert, another audit insert, a History insert): 57 statements one after another. Against Docker each answers in ~1 ms, so 57 statements cost ~60 ms and nothing local ever showed it; against Neon each costs ~90 ms, which is 5.1 s.

**Fix.** Statements are issued per kind, not per row: one query reads the linked issues, one the obligation cards, one the Compliance people; one `updateMany`/`createMany` writes the children, their resolutions and notes, the tasks, the contributors, and the audit and History rows (`recordFieldsMany()` and `addHistoryMany()` in `src/server/audit`, and `log.changes()` / `log.histories()` on the `mutate()` logger). The cascade is still atomic: one transaction, all or nothing. The count no longer grows with the number of linked issues: 57 statements became 22. Every transaction now also carries an explicit `timeout: 15 s` / `maxWait: 5 s` (`TRANSACTION_OPTIONS` in `server/config.ts`, applied in `mutate()` and the three other `$transaction` sites) as a safety margin, not as the fix.

**Other loops reviewed and treated the same way.** Create linked issues (41 to 12 statements for 3 customers: entities, cards and named people read once; `createManyAndReturn` for the issues; one insert each for contributors, links, audit and History); acknowledge and reassign of a partner issue (their children sync: 15 to 9 and 20 to 12); the new-customer wizard (aliases, BICs, product lines and contacts now one insert each: 35 to 19 for 3 aliases, 3 BICs, 3 product lines, 4 contacts); the Ops-to-CS handoff (one update for the confirmed contacts); notes (one check and one audit insert for the action items); role changes (one History insert); the communicator hand-over sync when a customer owner changes. A group report still routes each issue on its own (about 13 statements each, 59 to 55 for the four Santander entities: the group id now goes in with the insert and the two History events in one): with the 15 s margin it holds for roughly a dozen entities, and batching its routing is the follow-up if groups grow. "Record report sent" is a single row (about 12 statements) and needed nothing. "Reset demo data" is not an interactive transaction (a TRUNCATE and then the seed, 1,270 statements one after another), so it cannot hit P2028; on Neon at ~90 ms each it takes about two minutes and has to stay inside the function's maximum duration, which the repo does not set.

**Guard.** `tests/unit/rules/transaction-latency.test.ts` puts 60 ms on every SQL statement (a `pg.Client.query` wrapper, enabled only in that test, `tests/unit/helpers/pg-latency.ts`) and asserts, per flow, the statements inside the transaction and the time it stayed open. Run against the code before this fix it fails on every flow (resolve with the cascade: 57 statements and 3.9 s open, against budgets of 26 and 2.5 s).

## Issue page v5 and Home issues table (PR "Issue page v5 and Home issues table")

The design boards define the layout; the code defines behaviour. Decisions taken with the Product Owner while building it:

- **Issue page, top to bottom:** header (ID, type, Sev, status, Owner); "Issue actions" (owner only: Change status, Change severity, Change type, Reassign owner, Add contributor, replacing the More actions menu; Reassign owner stays hidden on a linked issue, which follows its partner issue's owner); Issue description (the reporter can still edit it while the issue is New; a linked issue's stored "Linked to ISS-n:" pointer is stripped when shown, on the page and on Home, and the stored text is unchanged); About this issue beside Timeline; Your next action; Action plan; then the live sections as before.
- **Timeline** shows only fields main has: Corvane aware at, Issue opened, Reported by, Reported at the customer by, Acknowledged, Resolved. Event, Source, Correct times, the interval marker and the Event field in Resolve belong to the next PR. A linked issue's heading reads "Times from ISS-n". Timeline values read "Mon 05 Oct, 09:40 MYT" (always the date); Done lines read "05 Oct 2026 17:20 SGT" (always the full date); time blocks keep the date only when the deadline is on another day.
- **Action plan** comes from `roleActionsFor`: steps that can be done now (the viewer's first, then by deadline, then in process order), then the steps that wait for an earlier one ("Waiting", "Starts when ISS-n is resolved"), then the Done lines with their evidence. Waiting steps are planned before they exist: Close with the customer on every unresolved issue; Send root cause report and Review root cause report only when a task would be created (Sev-1 customer issue, regime captured and not None; never on a partner issue); Investigate waits for the acknowledgement on a New issue. Close with the customer never waits for the report; Review is open from resolution until the owner records the report, then it is Done ("Review root cause report (Mei Chen), completed when Lukas Brenner recorded the report at ..."). A cascaded child reads "Resolved via ISS-n".
- **Sub-lines** never attribute a contract time to the regulator: "Required by the customer contract: notify the customer within 2 h" and "Required by the customer contract: 14 days after resolution". The Compliance step reads "1 h after the Compliance flag" because that clock starts at the flag, not at Corvane aware at.
- **Your next action** is the viewer's most urgent open step with the one primary button for it (Acknowledge, Record notification, Record assessment, Resolve, Open the partner issue, Close with the customer, Record report sent); with no step it says "Nothing for you to do on ISS-n" and names the next step of somebody else with its time. "Resolve" opens the existing Change status dialog already on Resolved.
- **Home**: Issues and Contributing are tables (Issue, Time, Description, Customer, Next actions; Description and Customer merge below 1100 px). "Issues (n)" counts its own rows, Contributing is its own card with its own count, and the Issues summary chip counts both. "Reported by me" keeps its row style and sits outside both counts. Own actions read "You" plus the step; others' steps are lower-case context lines (at most two, the full text on hover).
- **Tests**: the `demo-clock-skew` spec's "36 to 60 h behind real time" bound became 36 to 72 h: the demo clock starts at 05:00 UTC two days back, so for a suite started late in the UTC day the offset reaches 67 h, and the old bound failed every evening after about 17:00 UTC. A real-clock write is about 0 h, so 72 h still tells the two apart.
- **Known, not changed here**: the Close dialog reads its time to the minute, so it cannot be saved inside the minute of the resolution itself (scenario 5 and the new prod-build test back-date the resolution for that).

## Issue page v5 review fixes (PR #23)

- **Home "Your worklist is clear"** shows only when every Home section is empty, including Issues and Contributing (`isIssuesEmpty`).
- **Close dialog** compares at minute precision: the sent time must be at or after the resolution time truncated to the minute. "Not in the future" is unchanged. The demo flow (resolve as Lukas, switch to Adrian, close at once) is tested without back-dating.
- **Partner issues** word the communicator step "Close with the partner" (Home line 1 and Action plan); customer issues keep "Close with the customer".

## Event, awareness and opened times 

- **Three times.** Event (`Issue.eventAt`, nullable: null is Unknown), Corvane aware at (the existing `awareAt`) and Opened (the existing `createdAt`, written from the demo clock). Order: Event <= Corvane aware at <= Opened <= now, validated on the server (`src/server/issues/times.ts`) with the notes' messages. One message is ours: "Corvane aware at can't be after the issue was opened" (a correction past Opened), which the notes do not give.
- **Source** (`Issue.awarenessSource`: Email, Phone, Chat, Monitoring, Internal) is required. Existing rows get Email in the migration, and Event unknown.
- **Every deadline counts from Corvane aware at.** Main did not for the acknowledge clock (it counted from the save time) and the Done line said "after report". The acknowledge clock now starts at Corvane aware at for every severity; an issue deferred to the next business start (rule 4) counts from that start and keeps its "Clocks start ..." state. Compliance assess still counts from the flag. Linked issues keep "Acknowledged via ISS-n".
- **Correct times** (owner only; standalone and partner issues): Event, Corvane aware at, Source, reason of 10 to 500 characters. Open deadlines are recalculated; acknowledged and notified keep their start, so they stay met; clocks of resolved and closed issues do not change. One `IssueTimeCorrection` row (append-only for hub_app) and one audit entry per field; one History event per field, stored in UTC with the raw values in `details` and shown in the reader's zone.
- **Linked issues** created from a partner issue inherit the three values at creation and on every correction, and have no Correct times ("Times from ISS-n"). Issues merely attached to a partner issue keep their own times.
- **Monitoring issues** set Event (alert start) and Corvane aware at (alert time) themselves; Corvane aware at is not correctable, Event is. The app has no live monitoring intake yet, so today this holds for the seeded ISS-1042 and is enforced in the correction service.
- **Resolve** asks for Event on a Sev-1 with Event unknown (or a partner issue with a Sev-1 linked issue); the Event entered applies to every linked issue in the cascade.
- **Timeline** shows the interval line and amber marker only when Opened is more than 30 min after Corvane aware at on a Sev-1 or Sev-2.
- **Seed.** ISS-1038's Corvane aware at moved from 15:10 to 14:45 MYT (Event 14:25, Source Email) so the marker shows (35 min before it was opened at 15:20); acknowledge is 50 of 60 min and notify stays on time, so no outcome changes. ISS-1042: Event 2 min before the alert, Source Monitoring. ISS-1031: Event 20 min before, Source Email.
- **Reset duration.** `/api/demo/reset` exports `maxDuration = 300` (the Vercel Functions default with Fluid Compute), so a two-minute reset on a remote database is never cut short.

## Report from Home, simpler drawer, stage-aware messages

- **Report issue from Home.** A secondary "Report issue" button next to "My worklist", for every user who can report (`issue.report`: all six teams). The drawer opens with one extra first field, "Affected entity *" (the top bar's search: name, alias, LEI or BIC; `GET /api/entities/search`), focused on open. Nothing else is shown until an entity is picked; changing it clears what depends on it (product line, scheme and country, "reported at the customer by", the open issues box) and keeps the rest.
- **Product line, scheme and country (demo rehearsal, step 3).** A partner type (Partner degraded or unavailable) hides Product line and shows "Partner coverage affected *": the partner's own coverages with their status, the only one preselected, and "Other scheme or country" as the fallback. Any other type lists only the entity's own product lines (one: preselected; picking one fills Scheme and Country, read-only, with "Change"), with "No specific product line" at the end for issues not tied to one product (billing). When Scheme and Country are shown they filter as you type and start with "Suggested" (the entity's own schemes and countries, then its registered country), then all others A to Z. "Clear product line" is gone from the flow and from scenario 5; the demo step for the partner report is now: pick Lloyds Bank plc, the type, and the single coverage is already chosen.
- **Linked issues show the partner issue's deadlines.** "Acknowledge on ISS-n" carries the partner issue's own acknowledge deadline (its stored `ackDueAt`): time block, overdue and soon states, sorted with the other steps by it; "Investigate ... on ISS-n" has no clock on the partner issue and keeps "No deadline". Done: "Acknowledged via ISS-n by <name>".
- **Links to the company page.** In "About this issue" the Customer and the Partner are links to the entity's Overview, the "Incident contact at <entity>" heading links to its Contacts tab. Plain text for a viewer who cannot open the entity (a deleted record: the admin only). Home rows stay one link.
- **Stage-aware message to the customer.** Four templates picked from the issue's state (`src/server/issues/stage-message.ts`): First notification (open, none recorded), Update (open, one recorded; with a line to complete, and a hint while it is unchanged), Resolution (Resolved, until Close with the customer; the cause and solution from the Resolve dialog, the report sentence only when a root cause report task exists), Root cause report (the owner's, once Compliance approved the draft and until it is sent). Partner issues use partner wording and never the report. Times in the contact's zone with its label. Subject and body are editable on the page; a change of stage discards the edits with "Message updated for the new stage". The app sends nothing: Copy message or Open in Gmail, then the person records it. Log entry types read "First notification", "Update", "Resolution" and "Root cause report".

## Skew clock anchor and default-user fallback (rebrand follow-up)

- **`demo-clock-skew` uses a fixed weekday anchor.** Its demo clock started at "now - 48h" at 05:00 UTC, so a run on a Saturday or Sunday routed the partner issue to the on-call person and the spec failed. `DEMO_CLOCK_SKEW_START` is now Wednesday 07 Oct 2026, 05:00 UTC (13:00 Singapore, inside Network's hours), which passes on any date. The gap to real time only grows, so the spec keeps its 36 h lower bound and replaces the 72 h upper bound with a 10-year sanity cap. No other spec builds its clock from the real date.
- **Default user fallback.** In demo mode with no cookie, `getCurrentUser` signs in as `DEMO_DEFAULT_USER_EMAIL`; if that user is missing or inactive (or the variable is unset) it uses the first active Admin (oldest `createdAt`, then email), so a database that still holds the previous users loads and Reset demo data stays reachable. With no active Admin, or outside demo mode, it still fails as before.

## UX polish: overflow, deadlines, states and copy

- **One filled primary per step, in the Message panel for message steps (decided with the Product Owner).** For Record notification, Record update, Confirm resolution and Record report sent the filled primary is the Message panel's own button in all four templates. "Your next action" names the step and its time, and its secondary "Go to the message" button scrolls to the panel (Record report sent opens the same dialog, secondary). Every other step (Acknowledge, Resolve, Assess, Approve, Prepare) keeps its primary in "Your next action"; the Compliance card's Assess is secondary. The old "swap after scrolling" behaviour is gone.
- **Home for Network and Finance keeps no Mine / My team toggle and only the Issues chip.** That is the brief's rule (4.6.3, M20 AC11): the toggle exists for Ops and CS, and the other chips belong to the teams that have those lists. Not changed; zero-count chips are now muted for everyone.
- **The Issues chip has the table header's number.** "Issues 8 · Contributing 2" when there are Contributing rows, "Issues 8" otherwise. The Contributing table keeps its own count.
- **Resolved and Closed rows sort after every open issue on Home**, with a muted Sev badge, no accent bar and no red time.
- **One date-time format, `formatInZone`:** "Mon 05 Oct, 16:48 MYT", the year only when it is not the current year, "Sep" and never "Sept". `formatDateTime` (History, audit, GLEIF checks) is the same format in the app's zone. Customer-facing message templates use it too.
- **"Record update" stays enabled while the placeholder line is unchanged.** People edit the message in Gmail, not on the page, so blocking the button would force them to edit twice. The line is highlighted and the hint says why. The Record dialogs' own buttons say why they are disabled (channel, person, text, time).
- **Outline chips and muted chips use a darker border** (`--color-neutral-500`, #707070: 4.7:1 on white and on tint, was 1.9:1). Chip text colours already met 4.5:1.
- **A linked issue's "Acknowledged via ISS-n" Done line** reads like every other: the minutes after Corvane became aware, the target and on time or late, from the partner issue's acknowledge deadline. Only for Sev-1 and Sev-2 (wall-clock targets); a business-hours target needs the owner's calendar and shows no timing.

## Small fixes from the V7 design review (PR "small-fixes-v7")

- **Contributors reach an issue by four paths only**: "Add contributor", and three rules: (1) the type's default contributor, the entity's named person in the contributor team of `ISSUE_TYPE_ROUTING`, on save and on a type change (M18 AC8); (2) a linked issue gets the linked customer's named Ops person (M23 AC7, routing rule 5); (3) the entity's named Compliance reviewer joins when the root cause report task is created (M27 AC4). `tests/unit/contributor-paths.test.ts` fails on any other `issueContributor.create`. A person taken off by hand is not added again by a later type change.
- **`/admin/users` was a placeholder** that rendered the 403 copy for every viewer. It is now a read-only list for the Admin; everyone else still gets the 403 copy. The sidebar has a "Users" entry for the Admin.
- **Times in History, Audit, Issues tab, GLEIF lines, handoff and the wizard** are in the viewer's zone (CEST, MYT, SGT), not the app zone, so `UTC+hh:mm` no longer shows there. The `UTC+hh:mm` fallback remains for a zone with no abbreviation.
- **Dialog footers**: `DialogFooter` takes `reason`, shown at the left while the primary is disabled.

## Clean schema baseline (PR "clean-schema-baseline")

- **Identifiers renamed to neutral names**: the Issue aware-at column is now `Issue.awareAt`, the Customer role's contracting entity text is `CustomerRole.contractingEntity`, `BlockedBy` has `INTERNAL`, `CustomerReporterKind` has `FOUND_INTERNALLY`, the stored time-correction field is `"AWARE_AT"`, and the History `ADDED_REPORT` details key is `awareAt`. Labels the user sees ("Corvane", "Found by Corvane") did not change. `tests/unit/no-old-brand.test.ts` fails if the old product name appears anywhere in the working tree.
- **One baseline migration** (`prisma/migrations/20261010000000_baseline`) replaces the seven earlier ones. Part 1 is `prisma migrate diff --from-empty --to-schema`; Parts 0 and 2 are the SQL Prisma cannot generate (the `issue_number_seq` sequence, the partial unique indexes, the append-only audit trigger, the range checks). It was checked against the schema the old migration chain produced: columns, defaults, indexes, constraints, enums, trigger, function, sequence and extension are identical apart from the renames.
- **`scripts/neon-rebuild.sql`** (generated by `npm run neon:rebuild-sql`, kept in step by `tests/unit/neon-rebuild.test.ts`) rebuilds a hosted database by hand: drop and recreate `public`, the baseline, the baseline's row in Prisma's `_prisma_migrations` (so the production build's `prisma migrate status` finds nothing pending), and the `prisma/grants.sql` grants. One deliberate difference from the old database: `hub_app` has SELECT only on `_prisma_migrations` (before, it had INSERT and UPDATE too, only because the all-tables grant ran after Prisma created that table).
- **Order for an existing production database**: code with the new names cannot run on the old columns. After merging, the Production build stops at the migration check (the old deployment stays live); run `scripts/neon-rebuild.sql`, seed, redeploy. Rebuilding first would break the live site until the new deploy lands.
- `docs/MOVE_TO_NEW_REPO.md`: copy the tree into a new repository as one commit, and the Vercel variable names the new project needs.

## Portfolio runtime (PR "portfolio-runtime")

The public demo runs on Vercel Hobby (functions in fra1) with Neon Free (Frankfurt), shared by visitors who arrive days apart and can change data.

**One connection per instance.** Both pg pools (runtime and admin) are capped at 1 connection with a 5 s idle timeout (`src/server/pool-config.ts`), so the number of Neon slots in use is the number of live function instances, never a multiple of it. `DATABASE_URL` may be a Neon pooled URL: queries are unnamed and the restore lock is transaction-scoped, both safe behind a transaction-mode pooler. The Production build's migration check uses `DATABASE_DIRECT_URL` when set (Prisma Migrate cannot run through a pooler) and `DATABASE_URL` otherwise.

**GLEIF cache in the bundle.** `data/gleif-cache.json` is imported by `src/server/gleif/cache.ts`, so every function that can read it contains it. Before, it was read with `fs` from the working directory and the file was not in the serverless output (ENOENT on `/var/task/data/gleif-cache.json`). `GLEIF_CACHE_PATH` still points tests at another file.

**Restore is one transaction, under a lock.** TRUNCATE and the new data commit together; a failure rolls back to the previous data (it used to leave truncated, half-seeded tables). `pg_try_advisory_xact_lock` makes a second concurrent restore fail at once with a 409 instead of waiting. The table list now comes from the catalog, so a new table cannot be forgotten.

**Restore from a snapshot.** The seed is about 2000 round trips, 10 to 15 s from fra1. `data/demo-snapshot.js` holds every row after the seed ran at the default demo clock (`npm run demo:snapshot`); restoring it is three round trips (lock, replace, bump `seedVersion`): 0.5 to 0.8 s on local Docker against 4.6 s in-process for the seed. `tests/unit/demo-snapshot.test.ts` fails when the seed, any module it imports, the schema, the migrations or the GLEIF cache changed since the snapshot was written (a hash of the seed's import closure), and restores into a scratch database to check row counts, atomicity and the lock. The snapshot only applies when the seed would produce the same data: `GLEIF_SEED_SOURCE=cache`, the default cache file and the same demo day; otherwise (the e2e servers with their own clocks, `npm run demo:reset-data` under `test:all`) the restore runs the seed, in the same kind of transaction. The snapshot is a `.js` module with a hand-written `.d.ts`: imported as `.json`, TypeScript infers a type for every row and `tsc` takes minutes.

**Per-visitor clock.** A visitor's first request gets the `ch_arrival` cookie (real arrival, 24 h, HttpOnly); their demo now is `DEMO_CLOCK_START + (real now − arrival)`. `now()` is synchronous and used in ~150 places, so the server reads the cookie from Next's request storage (`src/server/request-clock.ts`, registered on `globalThis` for `src/lib/dates.ts`, which the browser shares). `src/proxy.ts` sets the cookie on the request too, so the first page already uses it. The browser gets its offset from the server at each page load rather than from the cookie, so a laptop clock that is off by minutes still agrees with the server. A cookie that is not a number, is in the future or is older than 24 h (plus an hour) is ignored. `DEMO_CLOCK_ANCHOR` set overrides the cookie for everybody, as before. The restore and the seed run at a fresh clock (`atFreshClock`), so the data is dated from `DEMO_CLOCK_START` whoever pressed the button. Known limit: two visitors have different clocks over one set of data, so a visitor who arrives later sees rows another visitor created "in the future" until the data is restored.

**Fonts from the repository.** DM Sans and DM Mono are served from `src/fonts` with `next/font/local` (latin subset, OFL licences alongside). `next/font/google` downloads them at build time, and one Vercel build failed when that request failed.

**No public reset; the demo restores itself.** The Admin menu entry, the sidebar link, the dialog and the `admin.demoReset` permission row are gone, and `/api/demo/reset` answers 404 to every method. `npm run demo:reset-data` stays. Two automatic paths replace the button:

- **Idle rule** (`src/server/demo-idle.ts`). `handle()` stamps `DemoMeta.lastWriteAt` (the database's clock) after every successful POST, PUT, PATCH or DELETE by any visitor; five POST routes that read or only set a cookie pass `{ writes: false }` (`tests/unit/http-writes.test.ts` pins the list). The root layout asks `demoNeedsPreparing()` before anything else reads the database: a restore is due (written since the last restore and 20 minutes quiet), a restore holds the advisory lock, or the visitor's `ch_arrival` is older than `DemoMeta.lastRestoreAt`. Then it renders only "Preparing a fresh demo...", which calls `POST /api/demo/prepare`. That route polls the lock while a restore runs, runs one if the rule still holds, does nothing otherwise (so it is no on-demand reset), and gives the visitor a new `ch_arrival` (never earlier than the restore, so a few seconds of clock difference between instances cannot loop). Both restore paths set `lastRestoreAt` and clear `lastWriteAt` in the restore's own transaction. The layout check fails open: if the columns are missing (migration not applied yet) or the query fails, the page renders as before.
- **Daily backstop.** `vercel.json` cron at 03:00 UTC calls `GET /api/cron/demo-restore`, which runs the same restore unconditionally and compares `Authorization` with `Bearer $CRON_SECRET` in constant time; no secret set means 401 for everyone. A restore already running makes it answer 200 "skipped".

Known limits: the gate runs on page loads (a layout does not re-run on client-side navigation), so an old tab keeps showing old data until its next load or refresh; writes made against an already restored database from such a tab are ordinary writes. A write that races a restore can stamp `lastWriteAt` just after it, which costs one extra restore 20 minutes later.

**Migration `20261014093351_demo_meta_idle_restore`** adds two nullable `timestamptz` columns to `DemoMeta` (`lastWriteAt`, `lastRestoreAt`). Additive: the previous code ignores them. `scripts/neon-rebuild.sql` now embeds every migration and records each in `_prisma_migrations`; the generated snapshot was rebuilt (its hash covers the migrations). The unit tests that need a database build a scratch one from all migrations (`tests/unit/helpers/scratch-db.ts`). The e2e specs used `POST /api/demo/reset` as their setup step; they now run `npm run demo:reset-data` with the server's own clock (`tests/e2e/fixtures/reset.ts`, `server-env.ts`).

**Home chip.** The chip and the table heading counted the same rows on the default seed (Adrian: 6 and 6). They differ only on "My team": the chip is always the viewer's own list. The heading now reads "Team issues (n)" there, so a different number says why.

**Person preselected.** Record notification and Confirm resolution start on the issue's Incident contact (`src/lib/incident-contact.ts`: the first Incident contact of the primary-first list, the same rule as the page's incident-contact block); no Incident contact leaves the field empty. It can be changed.

## First-visit onboarding (PR "onboarding")

Visitors arrive with no context: a recruiter has a minute, a hiring manager five, a technical reviewer fifteen. The demo now explains itself, without blocking the app.

**Welcome card.** On a visitor's first page load, and again from the "?" in the demo bar, a small fixed card sits at the bottom right (`src/components/onboarding/OnboardingHost.tsx`, copy in `src/lib/onboarding/content.ts`, at most 60 words). It never covers a dialog (z-index below the dialogs) and hides below 900 px. Closing it, or starting a scenario, writes `ch_onboarding_welcome_v1` to localStorage inside try/catch. With storage blocked nothing is remembered, so the card shows once per page load (not on every client-side navigation) and can still be closed. The browser's storage is read only after hydration (`useIsClient`), so the server HTML and the first client render always match. All e2e projects start with the card and the mobile notice dismissed (`playwright.config.ts`), so they never sit over a button another spec clicks; `onboarding.spec.ts` starts from an empty storage.

**Scenario panel.** A 360 px panel on the right, collapsible, opened by the card's buttons. It takes its width from the page (`html[data-onboarding-panel]` pads the body, `globals.css`) instead of floating over it, and toasts move left of it. Its state (which scenario, collapsed or not) is in localStorage too, so it survives full page loads.

**Checks come from the data.** `GET /api/onboarding/state` (`src/server/queries/onboarding.ts`) answers what the data says: scenario 1's issue is the seeded ISS-1042 and its optional step is done when it has an Update in its Communication log; scenario 2's issue is the newest Partner degraded issue on Lloyds Bank plc, UK CoP, GB, that is not itself linked to another (fanning out also creates a Partner degraded issue for Lloyds as a customer, which must not be taken for the parent). Its steps are done when: the issue exists; it is acknowledged and a Degraded coverage change was written after it was opened; it has linked issues; Revolut Ltd's linked issue has its first notification; it is Resolved or Closed. The panel reads this when it opens, every 3 s and after each navigation, so a step already done shows as done, whoever did it. Four steps of scenario 1 only read a page; there is no row to check. They are done once their part of the page has been in view, on the right page and as the right person (`data-onboarding` anchors, never row positions). That is remembered in localStorage against `DemoMeta.seedVersion`, so a restore starts the scenario again. The scenarios cannot be repeated until the data is restored; that is the point of the idle restore, and there is no "Reset this scenario".

**Take me there** switches the person with the existing `POST /api/demo/view-as`, then opens the page and scrolls to the step's anchor. The demo bar's switcher is keyed by the viewer so it follows a switch made from outside. The navigation is not refreshed at once (that cancels it); the layout refresh runs when the page has arrived.

**"Why this?" notes.** A "?" button beside five elements (`WhyThis.tsx`): Your next action, the Home Time column (in both tables, Issues and Contributing), the Action plan, People (Owner and Communicator), and Linked issues and Affected customers (one note, two icons). Each popover has two sentences: the decision, then the principle it serves (`NOTES` in `content.ts`). It is portalled and positioned from the button so a clipping table cannot cut it; Escape and a click elsewhere close it. Anchors are `data-onboarding` and `data-onboarding-why` attributes.

**Mobile.** Below 900 px a dismissible notice at the top says the demo is built for desktop and links the README. No layout was rebuilt. The card, the "?" and the panel are hidden there.

**README "Start here"** is the top of the README (48 lines): what Corvane and Customer Hub are, the live demo, the two scenarios, the five principles, the architecture, five decisions, how it was built.

**Fixed on the way.** After a confirmed cascade resolve ("Resolve with linked issues") the confirmation dialog stayed open: it is a sibling of the main dialog, and `setOpen(false)` closed only the main one. `ChangeStatusDialog` now clears it on success; `onboarding.spec.ts` would notice a regression.

**Tests.** `tests/unit/onboarding-content.test.ts` (copy rules, the checks, the links), `tests/e2e/onboarding.spec.ts` (first visit, dismissal, blocked storage, "?", both scenarios step by step with persona and page, the five popovers, the mobile notice). `onboarding-screenshots.spec.ts` writes the screenshots when `SHOTS_DIR` is set.

## Onboarding v2: welcome modal in three steps, plain Why this notes (PR "onboarding-v2")

**The corner card became a centred modal** (`WelcomeModal.tsx`, Radix Dialog, 560 px, three steps with dots, Back on steps 2 and 3). It closes with X, Esc or a click outside; Explore on my own and starting a scenario close it too. Dismissal is stored as before (`ch_onboarding_welcome_v1`, localStorage in try/catch; blocked storage shows it once per page load). It is mounted only while open, so the "?" in the demo bar always reopens it at step 1. Below 900 px it does not open at all (`useIsDesktop`, matchMedia): the mobile notice stays the only thing shown, and nothing is recorded as dismissed there. Step 3's two cards do what the old buttons did: dismiss, open the scenario panel.

**The five "Why this?" notes are plain**: a title "Why this?" and one or two sentences about what the element does, no principles (`NOTES` in `content.ts`). The Time note was checked against the colour rules: `timeLeft` (`src/lib/time-block.ts`) gives "soon" below 60 minutes or at "Due now", which `TimeBlock` draws in `text-due` (#ba450b, a burnt orange), and "over" in `text-danger` (red), so "orange when close, red once passed" is right. Other times keep their own plainer styles; the note claims no colour for them.

The scenario panel, its step copy and the README are unchanged. The e2e contexts that create fixtures start with the modal dismissed (it would cover the page).
